var niaSvg = require('niagara-svg');
var SEE = niaSvg.SEE, SVG = niaSvg.SVG;
var resolveEntity = niaSvg.internalTestObjs.resolveEntity;
var resolveTextWithEntities = niaSvg.internalTestObjs.resolveTextWithEntities;
var parseSvg = niaSvg.internalTestObjs.parseSvg;


var PREFIX_MAP_ELEMENT = {};
PREFIX_MAP_ELEMENT[niaSvg.HTML_NS] = 'html';
PREFIX_MAP_ELEMENT[niaSvg.XLINK_NS] = 'xlink';

var PREFIX_MAP_ATTRIBUTE = {};
PREFIX_MAP_ATTRIBUTE[niaSvg.SVG_NS] = 'svg';
PREFIX_MAP_ATTRIBUTE[niaSvg.HTML_NS] = 'html';
PREFIX_MAP_ATTRIBUTE[niaSvg.XLINK_NS] = 'xlink';

function svgToCanonString(list) {
	if (!_.isList(list))
		return svgToCanonString([list]);

	return _.map(list, function(e) {
		if (e.nodeType == 1) { // element
			var standAlone = !e.childNodes.length;
			var attributes = _.map(e.attributes, function(attr) {
				var prefix = PREFIX_MAP_ATTRIBUTE[attr.namespaceURI];
				return ' ' + (prefix ? (prefix+':') : '') + attr.name + '="' + attr.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') +'"';
			}).sort().join('');
			var prefix = PREFIX_MAP_ELEMENT[e.namespaceURI];
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
		assert.equal(resolveEntity('&lt;'), '<');
		assert.equal(resolveEntity('&amp;'), '&');
		assert.equal(resolveEntity('&auml;'), '\u00e4');
		assert.equal(resolveEntity('&#196;'), '\u00c4');
		assert.equal(resolveEntity('&#xC4;'), '\u00c4');
	});

	it('resolves text with entities', function() {
		assert.equal(resolveTextWithEntities(''), '');
		assert.equal(resolveTextWithEntities('b'), 'b');
		assert.equal(resolveTextWithEntities('&lt;'), '<');
		assert.equal(resolveTextWithEntities('abc&lt;def&auml;\nhij&#196;&#xC4;&auml;\n&auml;s'), 'abc<def\u00e4\nhij\u00c4\u00c4\u00e4\n\u00e4s');
	});

	describe('SVG parser', function() {
		it('parses txt', function() {
			assert.deepEqual(parseSvg(''), []);
			assert.equal(svgToCanonString(parseSvg('abc')), 'abc');
			assert.equal(svgToCanonString(parseSvg('a&quot;c')), 'a"c');
		});
		it('parses elements', function() {
			assert.equal(svgToCanonString(parseSvg('<svg/>')), '<svg/>');
			assert.equal(svgToCanonString(parseSvg('<svg></svg>')), '<svg/>');
			assert.equal(svgToCanonString(parseSvg('<circle/><g></g><rect><circle/>')), '<circle/><g/><rect/><circle/>');
			assert.equal(svgToCanonString(parseSvg('&lt;&amp;<svg/>b')), '&lt;&amp;<svg/>b');
			assert.equal(svgToCanonString(parseSvg('<svg/>&auml;')), '<svg/>\u00e4');
			assert.equal(svgToCanonString(parseSvg('<svg>a&auml;b</svg>')), '<svg>a\u00e4b</svg>');
			assert.equal(svgToCanonString(parseSvg('<svg><g/></svg>')), '<svg><g/></svg>');
			assert.equal(svgToCanonString(parseSvg('<svg>a<g>b</g>c</svg>')), '<svg>a<g>b</g>c</svg>');
			assert.equal(svgToCanonString(parseSvg('<svg>a<g>b</g>c<g>&quot;</g></svg>')), '<svg>a<g>b</g>c<g>"</g></svg>');
			assert.equal(svgToCanonString(parseSvg('<svg>a<g>b</svg>')), '<svg>a<g/>b</svg>');
			assert.equal(svgToCanonString(parseSvg('<svg>a<g>b<g>c</g></svg>')), '<svg>a<g/>b<g>c</g></svg>');
		});
		it('parses attributes', function() {
			assert.equal(svgToCanonString(parseSvg('<svg id="abc"/>')), '<svg id="abc"/>');
			assert.equal(svgToCanonString(parseSvg("<svg id='abc'/>")), '<svg id="abc"/>');
			assert.equal(svgToCanonString(parseSvg("<svg id='a'><g stroke=\"blue\" fill=\"\" id='b'><circle cx='0' cy='2'/></g></svg>")), '<svg id="a"><g fill="" id="b" stroke="blue"><circle cx="0" cy="2"/></g></svg>');

		});
		it('ignores whitespace', function() {
			assert.equal(svgToCanonString(parseSvg(' < svg ><   g  ><circle   r="11"cx="0"cy="2"    /><circle cx=\'20\' cy="20" r="5"/><   / g  >< /  svg >')), 
				' <svg><g><circle cx="0" cy="2" r="11"/><circle cx="20" cy="20" r="5"/></g></svg>');
		});
		it('sets element namespaces', function() {
			assert.equal(parseSvg('<svg/>')[0].namespaceURI, niaSvg.SVG_NS);
			assert.equal(parseSvg('<html:p/>')[0].namespaceURI, niaSvg.HTML_NS);
			assert.equal(parseSvg('<xhtml:p></xhtml:p>')[0].namespaceURI, niaSvg.HTML_NS);
			assert.equal(parseSvg('<xlink:a></xlink:a>')[0].namespaceURI, niaSvg.XLINK_NS);
			assert.equal(svgToCanonString(parseSvg('<html:div><svg><g><circle r="11"cx="0"cy="2"/></g></svg></html:div><xhtml:hr/>')).toLowerCase(), 
				'<html:div><svg><g><circle cx="0" cy="2" r="11"/></g></svg></html:div><html:hr/>');
		});
		it('sets attribute namespaces', function() {
			assert.equal(parseSvg('<circle cx="0" cy="2" r="11"/>')[0].getAttribute("cy"), "2");
			assert.equal(parseSvg('<circle cx="0" cy="2" r="11"/>')[0].getAttributeNS(niaSvg.SVG_NS, "cy"), "");
			assert.equal(parseSvg('<a xlink:href="http://test/">test</a>')[0].getAttributeNS(niaSvg.XLINK_NS, "href"), "http://test/");
			assert.equal(svgToCanonString(parseSvg('<html:div><html:a href="/t">x</html:a><svg><a xlink:href="/b"><rect /></a></svg></html:div>')).toLowerCase(), 
				'<html:div><html:a href="/t">x</html:a><svg><a xlink:href="/b"><rect/></a></svg></html:div>');
		});
	});

	it('supports ^ getter', function() {
		assert.equal($(parseSvg('<a xlink:href="http://test/">test</a>')).get("^href"), "http://test/");
		assert.equal($(parseSvg('<circle cx="0" cy="2" r="11"/>')).get("^cy"), "");
		assert.equal($(parseSvg('<a xlink:href="http://test/">test</a><a xlink:href="http://test2/">test</a>')).get("^href"), "http://test/");
	});

	it('supports ^ setter', function() {
		assert.equal(svgToCanonString($(parseSvg('<a>test</a>')).set("^href", "http://test/")), '<a xlink:href="http://test/">test</a>');
		assert.equal(svgToCanonString($(parseSvg('<a>test</a><html:b>toast</html:b>')).set({"^href": "http://test/"})).toLowerCase(), '<a xlink:href="http://test/">test</a><html:b xlink:href="http://test/">toast</html:b>');
		assert.equal(svgToCanonString($(parseSvg('<a xlink:href="http://test/">test</a><b xlink:href="http://toasty/">toast</b>')).set({"^href": function(oldValue, index, obj) {
			return oldValue.replace(/^http/, 'ftp') + obj.tagName.toLowerCase() + '/' + index;
		}})), 
			'<a xlink:href="ftp://test/a/0">test</a><b xlink:href="ftp://toasty/b/1">toast</b>');
	});

	it('supports SEE', function() {
		assert.equal(SEE('svg')[0].namespaceURI, niaSvg.SVG_NS);
		assert.equal(svgToCanonString(SEE('circle', {'@cx': 10, '@cy': '20', '@r': 11})), '<circle cx="10" cy="20" r="11"/>');
		assert.equal(svgToCanonString(SEE('a', {'^href': "http://example.com/"}, "test")), '<a xlink:href="http://example.com/">test</a>');
		assert.equal(svgToCanonString(SEE('svg', SEE('g', {'@id': 'g1'}, [SEE('g'), SEE('circle', {'@cx': 10, '@cy': '20', '@r': 11})]))), '<svg><g id="g1"><g/><circle cx="10" cy="20" r="11"/></g></svg>');

		assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).add(SEE('g'))), '<svg><g/></svg>');
	});

	describe('.st()', function() {
		it('supports plain code', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).st('<g>x</g>')), '<svg><g>x</g></svg>');
		});
		it('supports string templates', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).st('<a>{{txt}}</a>', {txt: 'foo'})), '<svg><a>foo</a></svg>');
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).st('<a>{{txt1}}{{txt2}}</a>', {txt1: 'what?'}, {txt2: 'bar'}, {txt1: 'foo'})), '<svg><a>foobar</a></svg>');
		});
		it('supports id templates', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).st('#testTemplate', {radius: 100})), '<svg><circle cx="1" cy="2" r="100"/></svg>');
		});
		it('supports function templates', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).st(function(obj) {
				return '<a>' + obj.txt + '</a>';
			}, {txt: 'foobar'})), '<svg><a>foobar</a></svg>');
		});
		it('modifies all list items', function() {
			var g = $(parseSvg('<g><a>a</a><a>b</a><a>c</a></g>'));
			var as = $('a', g);
			assert.equal(as.length, 3);
			as.st('x');
			assert.equal(svgToCanonString(g), '<g><a>x</a><a>x</a><a>x</a></g>');
		});
	});

	describe('SVG()', function() {
		it('supports plain code', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).add(SVG('<g>x</g>'))), '<svg><g>x</g></svg>');
		});
		it('supports string templates', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).fill(SVG('<a>{{txt}}</a>', {txt: 'foo'}))), '<svg><a>foo</a></svg>');
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).addFront(SVG('<a>{{txt1}}{{txt2}}</a>', {txt1: 'what?'}, {txt2: 'bar'}, {txt1: 'foo'}))), '<svg><a>foobar</a></svg>');
		});
		it('supports id templates', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).add(SVG('#testTemplate', {radius: 100}))), '<svg><circle cx="1" cy="2" r="100"/></svg>');
		});
		it('supports function templates', function() {
			assert.equal(svgToCanonString($(document.createElementNS(niaSvg.SVG_NS, 'svg')).add(SVG(function(obj) {
				return '<a>' + obj.txt + '</a>';
			}, {txt: 'foobar'}))), '<svg><a>foobar</a></svg>');
		});
		it('is clonable', function() {
			var g = $(parseSvg('<g><a>a</a><a>b</a><a>c</a></g>'));
			var as = $('a', g);
			as.replace(SVG('<circle cx="1" cy="2" r="100"/>'));
			assert.equal(svgToCanonString(g), '<g><circle cx="1" cy="2" r="100"/><circle cx="1" cy="2" r="100"/><circle cx="1" cy="2" r="100"/></g>');
		});
	});


});




