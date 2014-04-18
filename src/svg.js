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
console.log('creating ' + fullTagName, 'with attributes', attributeString);
	     var match = /(?:([^:]+):)?(.*)/.exec(fullTagName);
	     var el = document.createElementNS(PREFIX_MAP[match[1]]||SVG_NS, match[2]);

	     var re = /(\w+:)?([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/gm;
	     var ma;
	     while (ma = re.exec(attributeString)) {
	          // ma is array [wholeMatch, prefix, localName, attrValue1, attrValue2]
console.log('attrs', ma);
	          var value = resolveTextWithEntities(ma[3] || ma[4] || '');
	          if (ma[1] && PREFIX_MAP[ma[1]])
	               el.setAttributeNS(PREFIX_MAP[ma[1]], ma[2], value);
	          else
	               el.setAttribute(ma[2], value);
	     }
	     return el;
	}

	function parseSvg(svgSnippet) {
	    var m;
	    var result = [];
	    var uncommittedNodes = []; // elements that are either opening elements or standalone without slash, and the following text nodes

	    function addNode(node) {
	    	if (uncommittedNodes.length)
	        	uncommittedNodes.push(node);
	        else
	        	result.push(node);
	    }

	    var re = /([^<]*)<\s*(\/?)\s*([\w:]+)\s*((?:[\w:]+\s*=\s*(?:"[^"]*"|'[^']*')\s*)*)(\/?)\s*>([^<]*)/gm;

	    while (m = re.exec(svgSnippet)) {
			// m is array [wholeMatch, frontText, closingSlash, elementTag, attributes, standaloneSlash, endText]
			if (m[1])
	        	addNode(document.createTextNode(resolveTextWithEntities(m[1])));

			if (m[2]) {
	        	var ucName = m[3].replace(/[^:]+:/, '').toUpperCase();
	        	var pos;
				// find the nearest element to close in uncommittedNodes.
				for (pos = uncommittedNodes.length-1; pos >= 0; pos--)
					if (uncommittedNodes[pos].nodeType == 1 && uncommittedNodes[pos].tagName.toUpperCase() == ucName)
						break;
				if (pos < 0) 
					throw 'No match found for closing tag '+m[3];

				var e = uncommittedNodes[pos];
				for (var i = pos + 1; i < uncommittedNodes.length; i++)
					e.appendChild(uncommittedNodes[i]);
				uncommittedNodes.splice(pos+1, uncommittedNodes.length-pos-1);

				if (uncommittedNodes.length == 1)
					result.push(uncommittedNodes.pop());
	        }
	        else if (m[5])
				addNode(createElement(m[3], m[4]));
			else
				uncommittedNodes.push(createElement(m[3], m[4]));

			if (m[6])
				addNode(document.createTextNode(resolveTextWithEntities(m[6])));
	    }

		for (var i = 0; i < uncommittedNodes.length; i++)
			result.push(uncommittedNodes[i]);

		if (!result.length && svgSnippet != '')
			addNode(document.createTextNode(resolveTextWithEntities(svgSnippet)));

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

	NIAGARA.getter['>'] = function(list, name) {
		return list[0].getAttributeNS(XLINK_NS, name);
	};

	NIAGARA.setter['>'] = function(list, name, value) {
		list.each(function(obj, index) {
			if (!obj || !obj.getAttributeNS)
				return;

			var v;
			if (_.isFunction(value))
				v = value(obj.getAttributeNS(XLINK_NS, name), index, obj);
			else 
				v = value;

			if (v == null)
				obj.removeAttributeNS(XLINK_NS, name);
		 	else
				obj.setAttributeNS(XLINK_NS, name, v);
		});
	};

	NIAGARA.M.prototype.st = st;

	var internalTestObjs = {resolveEntity: resolveEntity, resolveTextWithEntities: resolveTextWithEntities, parseSvg: parseSvg};
	return {SVG_NS: SVG_NS, HTML_NS: HTML_NS, XLINK_NS: XLINK_NS, SEE: SEE, SVG: SVG, internalTestObjs: internalTestObjs};
});
