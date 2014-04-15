var niaSvg = require('niagara-svg');

describe('SVG module', function() {
	it('provides a reference', function() {
		assert.ok(niaSvg);
	});

	it('provides namespaces', function() {
		assert.equal(niaSvg.SVG_NS, "http://www.w3.org/2000/svg");
		assert.equal(niaSvg.HTML_NS, "http://www.w3.org/1999/xhtml");
		assert.equal(niaSvg.XLINK_NS, "http://www.w3.org/1999/xlink");
	});
});