define('niagara-svg', function(require) {
	var NIAGARA = require('minified'); 
  	var $ = NIAGARA.$, $$ = NIAGARA.$$, EE = NIAGARA.EE, _ = NIAGARA._;

	var SVG_NS = "http://www.w3.org/2000/svg";
	var HTML_NS = "http://www.w3.org/1999/xhtml";
	var XLINK_NS = "http://www.w3.org/1999/xlink";

	var PREFIX_MAP = { xlink: XLINK_NS, svg: SVG_NS, html: HTML_NS, xhtml: HTML_NS};




	var mappedEntities = {};
	function resolveEntity(entity) {
	     var r = mappedEntities[entity];
	     if (r != null)
	          return r;
	     else 
	          return mappedEntities[entity] = EE('div').set('innerHTML', entity).text();
	}

	function resolveTextWithEntities(txt) {
	     return txt.replace(/&#(\d+);|&#x(\w+);|(&[\w:-]+;)|(&)/g, function(entity, numEntity, hexEntity, nameEntity, rogueAmp) {
	          if (numEntity)
	               return String.fromCharCode(numEntity);
	          else if (hexEntity)
	               return String.fromCharCode(parseInt(hexEntity, 16));
	          else if (nameEntity)
	               return resolveEntity(nameEntity);
	          else // rogue amp - ignored for now
	               return entity;
	     });
	}

	function createElement(fullTagName, attributeString) {
	     var match = /(?:([^:]+):)?(.*)/.exec(fullTagName);
	     var el = document.createElementNS(prefixMap[match[1]]||SVG_NS, match[2]);

	     var ma;
	     while (ma = /([\w:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')\s/gm.exec(attributeString)) {
	          // ma is array [wholeMatch, fullAttrName, attrValue1, attrValue2]
	          var value = resolveTextWithEntities(attrValue1 || attrValue2 || '');
	          var maa = /(?:([^:]+):)?(.*)/.exec(fullAttrName);
	          if (maa[1] && prefixMap[maa[1]])
	               el.setAttributeNS(prefixMap[maa[1]], maa[2], value);
	          else
	               el.setAttribute(fullAttrName, value);
	     }

	     return el;
	}

	function parseSvg(svgSnippet) {
	     var m;
	     var result = [];
	     var unsureNodes = []; // elements that are either opening elements or standalone without slash, and the following text nodes

	     function addNode(node) {
	           if (unsureNodes.length)
	                 unsureNodes.push(node);
	           else
	                 result.push(node);
	          }

	     while (m = /([^<]*)<\s*(\/?)\s*([\w:]+)\s*((?:[\w:]+\s*=\s*(?:"[^"]*"|'[^']*')\s*)*)(\/?)\s*>([^<]*)/gm.exec(svgSnippet)) {
	          // m is array [wholeMatch, frontText, closingSlash, elementTag, attributes, standaloneSlash, endText]
	          if (m[1])
	               addNode(document.createTextNode(m[1]));

	          if (closingSlash) {
	               var ucName = elementTag.replace(/[^:]+:/, '').toUpperCase();
	               var pos;
	               // find the nearest element to close in unsureNodes.
	               for (pos = unsureNodes.length-1; pos >= 0; pos--)
	                    if (unsureNodes[pos].nodeType == 1 && unsureNodes[pos].tagName.toUpperCase() == ucName)
	                         break;
	               if (pos < 0) 
	                    throw 'No match found for closing tag '+elementTag;

	               var e = unsureNodes[pos];
	               for (var i = pos + 1; i < unsureNodes.length; i++)
	                    e.appendChild(unsureNodes[i]);
	               unsureNodes.splice(pos, unsureNodes.length-pos);

	               if (!unsureNodes.length)
	                    result.push(e);
	          }
	          else if (standaloneSlash)
	               addNode(createElement(m[3], m[4]));
	          else
	               unsureNodes.push(createElement(m[3], m[4]));

	          if (m[6])
	               addNode(document.createTextNode(m[6]));
	     }

	     var target = startWith && unsureNodes[startWith];
	     for (var i = 0; i < unsureNodes.length; i++)
	          result.push(unsureNodes[i]);

	     return result;
	}

	function resolveSvg(svgTemplate, resolvedObject) {
		return parseSvg(isFunction(svgTemplate) ? svgTemplate(o) : 
                    /{{/.test(svgTemplate) ? formatHtml(svgTemplate, o) : 
                    /^#\S+$/.test(svgTemplate) ? formatHtml($$(svgTemplate).text, o) : svgTemplate);
	}



	function SEE(elementName, attributes, children) {
		var e = $(_document.createElementNS(SVG_NS, elementName));
		return (_.isList(attributes) || (attributes != null && !_.isObject(attributes)) ) ? e.add(attributes) : e.set(attributes).add(children);
	}

	function st(svgTemplate, object) {
		return this.fill(resolveSvg(svgTemplate, arguments.length > 2 ? _.merge(sub(arguments, 1)) : object));
	}

	function SVG(svgTemplate, object) {
		return _(resolveSvg(svgTemplate, arguments.length > 2 ? _.merge(sub(arguments, 1)) : object));

	}

	var internalTestObjs = {resolveEntity: resolveEntity, resolveTextWithEntities: resolveTextWithEntities, parseSvg: parseSvg};

	NIAGARA.M.prototype.st = st;
	return {SVG_NS: SVG_NS, HTML_NS: HTML_NS, XLINK_NS: XLINK_NS, SEE: SEE, SVG: SVG, internalTestObjs: internalTestObjs};
}
