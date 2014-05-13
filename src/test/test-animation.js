var niaAnim = require('niagara-animation');
var smoothInterpolator = niaAnim.smoothInterpolator;


function assertFloat(a, b, max) {
	assert(Math.abs(a-b) < (max || 0.0001));
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

});




