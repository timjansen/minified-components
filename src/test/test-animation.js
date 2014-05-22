var niaAnim = require('niagara-animation');
var smoothInterpolator = niaAnim.smoothInterpolator;
var createInterpolator = niaAnim.createInterpolator;
var timeline = niaAnim.timeline;

function assertFloat(a, b, maxDiff) {
	assert(Math.abs(a-b) < (maxDiff || 0.0001), "float given="+a+" expected="+b);
}

function createAssertCallback(expectedArgs) {
	var i = 0;
	var f = function(t) {
		assert(i < expectedArgs.length, 'Called more often than expected');
		var a = expectedArgs[i++];
		if (_.isNumber(a))
			assertFloat(t, a);
		else
			assert.equal(t, a);
	};
	f.check = function() {
		assert.equal(i, expectedArgs.length, "Callback has been called only "+i+" times. Expected " + expectedArgs.length + " times.");
	};
	return f;
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

	describe('createInterpolator', function() {
		it('creates simple non-linear functions', function() {
			var f1 = createInterpolator([]);
			assertFloat(f1(0, 100, 0), 0);
			assertFloat(f1(0, 100, 0.5), 50);
			assert(f1(0, 100, 0.02) < 0.15); // check that it's not linear
			assertFloat(f1(0, 100, 1), 100);
			assertFloat(f1(82, -100, 0.745), smoothInterpolator(82, -100, 0.745));
		});
		
		it('creates simple linear functions', function() {
			var f1 = createInterpolator([{t: 0, p: 0, v: 1}, {t: 1, p: 1, v: 1}]);
			assertFloat(f1(0, 100, 0), 0);
			assertFloat(f1(0, 100, 0.11), 11);
			assertFloat(f1(0, 100, 1), 100);
		});

		it('creates simple smooth interpolators functions', function() {
			var f1 = createInterpolator([{t: 0, p: 0, v: 12}, {t: 1, p: 1, v: -0.2}]);
			assertFloat(f1(0, 1, 0.745), smoothInterpolator(0, 1, 0.745, 12, -0.2));
		});

		it('creates four-step interpolators', function() {
			var f1 = createInterpolator([{t: 0, p: 0, v: 0}, {t: 0.25, p: 0.25, v: 1}, {t: 0.75, p: 0.75, v: 1}, {t: 1, p: 1, v: 0}]);
			assertFloat(f1(0, 100, 0), 0);
			assertFloat(f1(0, 10, 0.445), 4.45);
			assertFloat(f1(0, 10, 0.65), 6.5);
		});
	});

	describe('timeline', function() {
		it('returns the duration without any args', function() {
			var tl1 = timeline([]);
			assertFloat(tl1(), 0);
			var tl2 = timeline([{duration: 22}]);
			assertFloat(tl2(), 22);
			var tl3 = timeline([{wait: 100}]);
			assertFloat(tl3(), 100);
			var tl4 = timeline([{wait: 100}, {duration: 7}, {wait: 400}, {wait: 500}, {duration: 14}, {duration: 2000}]);
			assertFloat(tl4(), 3000);
		});

		it('calls dials correctly / forward', function() {
			var a1, a2;
			var tl1 = timeline([{dial: a1 = createAssertCallback([0, 0.2, 0.4, 0.998, 1]), wait: 500}, 
								{dial: a2 = createAssertCallback([0.1, 0.2, 1]), wait: 100}]);
			tl1(0); 
			tl1(100); 
			tl1(200); 
			tl1(499); 
			tl1(510); 
			tl1(520); 
			tl1(600); 
			tl1(600);
			tl1(700);
			a1.check();
			a2.check();
		});

		it('calls dials correctly / backward', function() {
			var a1, a2;
			var tl1 = timeline([{wait: 1000},
								{dial: a1 = createAssertCallback([1, 0.8, 0.2, 0]), wait: 500}, 
								{dial: a2 = createAssertCallback([1, 0.5, 0]), wait: 100},
								{wait: 100}]);
			tl1(1650); 
			tl1(1550); 
			tl1(1400); 
			tl1(1400); 
			tl1(1100); 
			tl1(900);
			tl1(800); 
			tl1(0); 
			a1.check();
			a2.check();
		});

		it('skips dials correctly / backward', function() {
			var a1;
			var tl1 = timeline([{wait: 100},
								{dial: a1 = createAssertCallback([1, 0]), wait: 500}, 
								{wait: 100}]);
			tl1(650); 
			tl1(50);
			a1.check();
		});


		it('calls toggle correctly', function() {
			var a1, a2;
			var tl1 = timeline([{wait: 100},
								{toggle: a1 = createAssertCallback([true, false, true, false, false, false]), duration: 100, wait: 50}, 
								{toggle: a2 = createAssertCallback([false, true, false, false, false]), wait: 50},
								{wait: 100}]);
			tl1(0); 
			tl1(50); 
			tl1(111); 
			tl1(144); 
			tl1(201); 
			tl1(202);
			tl1(199);
			tl1(0); 
			tl1(999); 
			tl1(0); 
			a1.check();
			a2.check();
		});


		it('calls loop correctly', function() {
			var a1, a2;
			var tl1 = timeline([{wait: 100},
								{loop: a1 = createAssertCallback([11, 44, 99]), duration: 100, wait: 50}, 
								{loop: a2 = createAssertCallback([49]), wait: 50},
								{wait: 100}]);
			tl1(7); 
			tl1(50); 
			tl1(111); 
			tl1(144); 
			tl1(201); 
			tl1(202);
			tl1(199);
			tl1(0); 
			tl1(999); 
			tl1(0); 
			a1.check();
			a2.check();
		});


		it('calls callbacks correctly', function() {
			var a1, a2, a3, a4;
			var tl1 = timeline([{callback: a1 = createAssertCallback([0]), wait: 10},
								{callback: a2 = createAssertCallback([0, 5]), forward: false, wait: 10},     // start=10
								{callback: a3 = createAssertCallback([21, 40]), backward: false, wait: 10},  // start=20
								{callback: a4 = createAssertCallback([30, 40, 25]), wait: 10}]);             // start=30 end=40
			tl1(0); 
			tl1(11); 
			tl1(21); 
			tl1(30); 
			tl1(0); 
			tl1(50);
			tl1(25);
			tl1(15);
			tl1(5);
			a1.check();
			a2.check();
			a3.check();
			a4.check();
		});


		it('calls timeline correctly', function() {
			var a1, a2, a3, a4;
			var tl1 = timeline([{wait: 10},
								{timeline: [{loop: a1=createAssertCallback([1, 8, 9, 2, 0]), wait: 10}, {dial: a2=createAssertCallback([0.2, 1, 0.5, 0]), wait: 10}]},
								{wait: 10},
								{timeline: timeline([{dial: a3=createAssertCallback([0, 0.2, 0.5, 0]), wait: 10}]), duration: 5},
								{toggle: a4=createAssertCallback([true, false, false]), wait: 10}]);
			tl1(5); 
			tl1(11); 
			tl1(18);
			tl1(22);
			tl1(35);
			tl1(40);
			tl1(42);
			tl1(48);
			tl1(55);
			tl1(60);
			tl1(40);
			tl1(35);
			tl1(25);
			tl1(20);
			tl1(19);
			tl1(12);
			tl1(0);
			a1.check();
			a2.check();
			a3.check();
			a4.check();
		});

		// check all types: array (parallel execution)
		// check stop is called by timeline
		// test repeat
		// test backAndForth
	});

});




