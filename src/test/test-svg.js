var niaSvg = require('niagara-svg');


var PREFIX_MAP = {};
PREFIX_MAP[niaSvg.HTML_NS] = 'html';
PREFIX_MAP[niaSvg.XLINK_NS] = 'xlink';

function svgToCanonString(list) {
	if (!_.isList(list))
		return svgToCanonString([list]);

	return _.map(list, function(e) {
		if (e.nodeType == 1) { // element
			var standAlone = !e.childNodes.length;
			var attributes = _.map(e.attributes, function(attr) {
				var prefix = PREFIX_MAP[attr.namespaceURI];
				return ' ' + (prefix ? (prefix+':') : '') + attr.name + '="' + attr.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') +'"';
			}).sort().join('');
			var prefix = PREFIX_MAP[e.namespaceURI];
			var fullName = (prefix ? (prefix+':') : '') + e.tagName;

			var elStart = '<' + fullName + attributes;
			if (standAlone)
				return elStart + '/>';
			else
				return elStart + '>' + svgToCanonString(e.childNodes) + '</'+fullName+'>';
		}
		else if (e.nodeType == 3) // text
			return e.data.replace(/&/g, '&amp;').replace(/</g, '&lt;');
		else
			return 'UNSUPPORTED('+e+')';
	}).join('');
}



describe('SVG module', function() {
	it('provides a reference', function() {
		assert.ok(niaSvg);
	});

	it('provides namespaces', function() {
		assert.equal(niaSvg.SVG_NS, "http://www.w3.org/2000/svg");
		assert.equal(niaSvg.HTML_NS, "http://www.w3.org/1999/xhtml");
		assert.equal(niaSvg.XLINK_NS, "http://www.w3.org/1999/xlink");
	});

	it('resolves entities', function() {
		var resolveEntity = niaSvg.internalTestObjs.resolveEntity;
		assert.equal(resolveEntity('&lt;'), '<');
		assert.equal(resolveEntity('&amp;'), '&');
		assert.equal(resolveEntity('&auml;'), '\u00e4');
		assert.equal(resolveEntity('&#196;'), '\u00c4');
		assert.equal(resolveEntity('&#xC4;'), '\u00c4');
	});

	it('resolves text with entities', function() {
		var resolveTextWithEntities = niaSvg.internalTestObjs.resolveTextWithEntities;
		assert.equal(resolveTextWithEntities(''), '');
		assert.equal(resolveTextWithEntities('b'), 'b');
		assert.equal(resolveTextWithEntities('&lt;'), '<');
		assert.equal(resolveTextWithEntities('abc&lt;def&auml;\nhij&#196;&#xC4;&auml;\n&auml;s'), 'abc<def\u00e4\nhij\u00c4\u00c4\u00e4\n\u00e4s');
	});

	it('parses SVG', function() {
		var parseSvg = niaSvg.internalTestObjs.parseSvg;
		assert.deepEqual(parseSvg(''), []);
		assert.equal(svgToCanonString(parseSvg('abc')), 'abc');
		assert.equal(svgToCanonString(parseSvg('a&quot;c')), 'a"c');
		assert.equal(svgToCanonString(parseSvg('<svg/>')), '<svg/>');
		assert.equal(svgToCanonString(parseSvg('<svg></svg>')), '<svg/>');
		assert.equal(svgToCanonString(parseSvg('&lt;&amp;<svg/>b')), '&lt;&amp;<svg/>b');
		assert.equal(svgToCanonString(parseSvg('<svg/>&auml;')), '<svg/>\u00e4');
		assert.equal(svgToCanonString(parseSvg('<svg>a&auml;b</svg>')), '<svg>a\u00e4b</svg>');
		assert.equal(svgToCanonString(parseSvg('<svg><g/></svg>')), '<svg><g/></svg>');
		assert.equal(svgToCanonString(parseSvg('<svg>a<g>b</g>c</svg>')), '<svg>a<g>b</g>c</svg>');
		assert.equal(svgToCanonString(parseSvg('<svg>a<g>b</g>c<g>&quot;</g></svg>')), '<svg>a<g>b</g>c<g>"</g></svg>');
		assert.equal(svgToCanonString(parseSvg('<svg>a<g>b</svg>')), '<svg>a<g/>b</svg>');
		assert.equal(svgToCanonString(parseSvg('<svg>a<g>b<g>c</g></svg>')), '<svg>a<g/>b<g>c</g></svg>');
		assert.equal(svgToCanonString(parseSvg('<svg id="abc"/>')), '<svg id="abc"/>');
		assert.equal(svgToCanonString(parseSvg("<svg id='abc'/>")), '<svg id="abc"/>');
		assert.equal(svgToCanonString(parseSvg("<svg id='a'><g stroke=\"blue\" fill=\"\" id='b'><circle cx='0' cy='2'/></g></svg>")), '<svg id="a"><g fill="" id="b" stroke="blue"><circle cx="0" cy="2"/></g></svg>');
		assert.equal(svgToCanonString(parseSvg(' < svg ><   g  ><circle   r="11"cx="0"cy="2"    /><circle cx=\'20\' cy="20" r="5"/><   / g  >< /  svg >')), 
			' <svg><g><circle cx="0" cy="2" r="11"/><circle cx="20" cy="20" r="5"/></g></svg>');
	});


});

