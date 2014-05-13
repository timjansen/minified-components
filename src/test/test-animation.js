var niaAnim = require('niagara-animation');
var smoothInterpolator = niaAnim.smoothInterpolator;


function assertFloat(a, b, maxDiff) {
	assert(Math.abs(a-b) < (maxDiff || 0.0001), "compared a="+a+" b="+b+" maxDiff="+maxDiff);
}


describe('Animation module', function() {
	it('provides a reference', function() {
		assert(niaAnim);
	});

	describe('smoothInterpolator', function() {
		it('handles numbers outside the t range', function() {
			assertFloat(smoothInterpolator(-584.2, 512, 0), -584.2);
			assertFloat(smoothInterpolator(-584.2, 512, -55445), -584.2);
			assertFloat(smoothInterpolator(-584.2, 512, -0.00001), -584.2);
			assertFloat(smoothInterpolator(-584.2, 512, 1), 512);
			assertFloat(smoothInterpolator(-584.2, 512, 1.00001), 512);
			assertFloat(smoothInterpolator(-584.2, 512, 1545454), 512);
			assertFloat(smoothInterpolator(0, 1, 0), 0);
			assertFloat(smoothInterpolator(1, 0, 0), 1);
			assertFloat(smoothInterpolator(0, 1, 0, 4, 3), 0);
			assertFloat(smoothInterpolator(1, 0, 0, 2), 1);
		});
		it('defaults to 0 velocity', function() {
			assertFloat(smoothInterpolator(0, 1, 0), 0);
			assertFloat(smoothInterpolator(0, 1, 0.5), 0.5);
			assertFloat(smoothInterpolator(0, 1, 1), 1);
			assertFloat(smoothInterpolator(-44, 44, 0.5), 0);
		});
		it('is linear with the right velocity', function() {
			assertFloat(smoothInterpolator(0, 1, 0, 1, 1), 0);
			assertFloat(smoothInterpolator(0, 1, 0.444, 1, 1), 0.444);
			assertFloat(smoothInterpolator(0, 1, 1, 1, 1), 1);
			assertFloat(smoothInterpolator(-5, 20, 0.5, 25, 25), 7.5);
			assertFloat(smoothInterpolator(20, -5, 0.5, -25, -25), 7.5);
		});
		it('is not linear otherwise', function() {
			assert(smoothInterpolator(0, 1, 0.25) < 0.25);
			assert(smoothInterpolator(0, 100, 0.75) > 75);
		});
	});

	describe('smoothDial', function() {
		it('returns functions', function() {
			assert(_.isFunction(_().smoothDial({a: 0}, {a: 1})));
			assert(_.isFunction(_().smoothDial({a: 0}, {a: 1}, {a: 1}, {a: 1})));
		});

		it('interpolates simple numbers', function() {
			var obj = {}, list = _(obj);
			var dial1 = list.smoothDial({a: 0}, {a: 5});
			dial1(1);
			assertFloat(obj.a, 5);
			dial1(0);
			assertFloat(obj.a, 0);
			dial1(0.4);
			assertFloat(obj.a, smoothInterpolator(0, 5, 0.4));
			dial1(0.76);
			assertFloat(obj.a, smoothInterpolator(0, 5, 0.76));
		});

		it('interpolates simple strings', function() {
			var obj = {}, list = _(obj);
			var dial1 = list.smoothDial({a: "0", b: "54.5px", c: "max -5 deg"}, {a: "5", b: "-60.7px", c: "max 20 deg"});
			dial1(1);
			assertFloat(parseFloat(obj.a), 5);
			assert(/-60\.[67]\d*px/.test(obj.b));
			assert(/max 20\.?\d* deg/.test(obj.c));
			dial1(0);
			assertFloat(parseFloat(obj.a), 0);
			assert(/54\.[45]\d*px/.test(obj.b));
			assert(/max -[45]\.?\d* deg/.test(obj.c));
			dial1(0.4);
			assertFloat(parseFloat(obj.a), smoothInterpolator(0, 5, 0.4));
			assertFloat(parseFloat(obj.b), smoothInterpolator(54.5, -60.7, 0.4));
			assertFloat(parseFloat(obj.c.replace(/^max /, '')), smoothInterpolator(-5, 20, 0.4));
		});

		it('interpolates colors', function() {
			var obj = {}, list = _(obj);
			var dial1 = list.smoothDial({a: "rgb(128.2,0,200)", b: "#fff", c: "#1fff02"}, {a: "rgb(228,0,255)", b: "#00f", c: "#ff0000"});
			dial1(1);
			assert.equal(obj.a, "rgb(228,0,255)");
			assert.equal(obj.b, "#00f");
			assert.equal(obj.c, "#ff0000");
			dial1(0);
			assert.equal(obj.a, "rgb(128.2,0,200)");
			assert.equal(obj.b, "#fff");
			assert.equal(obj.c, "#1fff02");
			dial1(0.5);
			assert.equal(obj.a, "rgb(178,0,228)");
			assert.equal(obj.b, "rgb(128,128,255)");
			assert.equal(obj.c, "rgb(143,128,1)");
		});


		it('interpolates multi number strings', function() {
			var obj = {}, list = _(obj);
			var dial1 = list.smoothDial({a: "0 5", b: "2,9", c: "rotate(2 22 90) #111x"}, {a: "-11 -5", b: "2,-1", c: "rotate(1 24.2 100) #333x"});
			dial1(1);
			assert.equal(obj.a, '-11 -5');
			assert.equal(obj.b, '2,-1');
			assert.equal(obj.c, 'rotate(1 24.2 100) #333x');
			dial1(0);
			assert.equal(obj.a, '0 5');
			assert.equal(obj.b, '2,9');
			assert.equal(obj.c, 'rotate(2 22 90) #111x');
			dial1(0.5);
			assert(/^-5\.[45]\d* -?0\.?\d*$/.test(obj.a), obj.a);
			assert(/^2,[34]/.test(obj.b), obj.b);
			assert(/^rotate\(1\.[45]\d* 23\.\d* 9[45]\.?\d*\) rgb\(34,34,34\)x$/.test(obj.c), obj.c);
		});

		it('interpolates with velocities', function() {
			var obj = {}, list = _(obj);
			var dial1 = list.smoothDial(
				{a: 14, b: "288deg", c: "x14,-12 0"}, 
				{a: 19, b: "-1deg", c: "x11.2,0 0"},
				{a: 5, b: [14], c: [22, -1, 211]},
				{a: 5, b: -11, c: [0, 1]});
			dial1(1);
			assert.equal(obj.a, 19);
			assert.equal(obj.b, '-1deg');
			assert.equal(obj.c, 'x11.2,0 0');
			dial1(0);
			assert.equal(obj.a, 14);
			assert.equal(obj.b, '288deg');
			assert.equal(obj.c, 'x14,-12 0');
			dial1(0.321);
			assertFloat(obj.a, smoothInterpolator(14, 19, 0.321, 5, 5));
			assertFloat(parseFloat(obj.b), smoothInterpolator(288, -1, 0.321, 14, -11));
			assertFloat(parseFloat(obj.c.replace(/x/,'').replace(/,.*/, '')), smoothInterpolator(14, 11.2, 0.321, 22, 0));
			assertFloat(parseFloat(obj.c.replace(/[^,]+,/, '').replace(/ .*/, '')), smoothInterpolator(-12, 0, 0.321, -1, 1));
			assertFloat(parseFloat(obj.c.replace(/\S+\s/, '')), smoothInterpolator(0, 0, 0.321, 211, 0));
		});

		it('modifies several list elements', function() {
			var obj1 = {a: -1}, obj2 = {a: 5}, list = _(obj1, obj2);
			var dial1 = list.smoothDial({a: 2}, {a: 0});
			dial1(1);
			assert.equal(obj1.a, 0);
			assert.equal(obj2.a, 0);
			dial1(0);
			assert.equal(obj1.a, 2);
			assert.equal(obj2.a, 2);
			dial1(0.321);
			assertFloat(obj1.a, smoothInterpolator(2, 0, 0.321));
			assertFloat(obj2.a, obj1.a);
		});

		it('ignores missing properties in target and assumes 0', function() {
			var obj1 = {a: -1}, list = _(obj1);
			var dial1 = list.smoothDial({a: "2p"}, {b: 1});
			dial1(1);
			assert.equal(obj1.a, "0p");
			assert(obj1.b == null);
			dial1(0);
			assert.equal(obj1.a, "2p");
			assert(obj1.b == null);
			dial1(0.321);
			assertFloat(parseFloat(obj1.a), smoothInterpolator(2, 0, 0.321));
			assert(obj1.b == null);
		});

		it('supports set() properties', function() {
			var obj1 = EE('span'), obj2 = EE('div'), list = _(obj1, obj2);
			var dial1 = list.smoothDial({'@x': 12}, {'@x': 20});
			dial1(0.5);
			assert.equal(_(obj1).get('@x'), '16');
			assert.equal(_(obj2).get('@x'), '16');
		});
	});

});




