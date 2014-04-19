
define('niagara-ui', function(require) {

	var NIAGARA = require('minified'); 
	var $ = NIAGARA.$, $$ = NIAGARA.$$, EE = NIAGARA.EE, _ = NIAGARA._;


	function absLimit(v, limit) {
		return Math.max(Math.min(v, limit), -limit);
	}

	function absReduce(v, v2) {
		if (v >= 0)
			return Math.max(0, v - v2);
		else
			return Math.min(0, v + v2);
	}

	/**
	 * Creates an interpolation function that will smoothly interpolate from the given start value and velocity
	 * to the given target value with the given target velocity.
	 * @param duration duration of the animation (unit does not matter)
	 * @param start the start value
	 * @param target the target value
	 * @param startVelocity the initial velocity (using the units from start and duration)
	 * @param targetVelocity the target velocity (using the units from start and duration)
	 * @param timeOffset a value to add to t in the interpolation function
	 * @return an interpolation function(t) that will return the interpolated value for the time t.
	 */
	function createSmoothInterpolator(duration, start, target, startVelocity, targetVelocity, timeOffset) {
		/*
		 solve(v=b+2*c*z+3*d*z^2,x=a+b*z+c*z^2+d*z^3,c,d)
		 c=(-(3*a)-2*b*z-v*z+3*x)/z^2,d=(2*a+b*z+v*z-2*x)/z^3
		 A=startValue
		 b=startvelocity
		 x=distance
		 z=duration
		 v=targetVelocity
		*/
		var c = (-(3*start)-2*startVelocity*duration-targetVelocity*duration+3*target)/(duration*duration);
		var d = (2*start+startVelocity*duration+targetVelocity*duration-2*target)/(duration*duration*duration);
		timeOffset = timeOffset || 0;
	  
		return function(t, getVelocity) {
			t = t + timeOffset;
			if (t >= duration)
				return target;
			else if (t < 0)
				return start;
			else if (getVelocity)
				return startVelocity + 2*c*t + 3*d*t*t;
			else
				return start + startVelocity*t + c*t*t + d*t*t*t;
		};
	}

	function findTouch(touchEvent, id) {
		return touchEvent.touches ? _.find(touchEvent.touches, function(t) {
			return t.identifier == id ? t : null;
		}) : null;
	}

	// elements: any param for $()
	// function onStart(el, event); // event is the MouseEvent that started the op
	// function onMove(el, dx, dy); // delta x/y since last invocation
	// function onFinish(el, sx, sy); // speed px/s for x/y at end of touch
	// options = {
	//   velocityEvalTime: 250,     // max number of milliseconds to get avg current speed
	//   velocitySamples:  4,       // number of samples to determine speed. Must be >1.
	//   velocityMax:      1000,    // max velocity in px/s
	//   moveOnlyInside: false      // keep on moving when cursor leaves area
	// }
	function touchMover(elements, onStart, onMove, onFinish, options) {
		var opts = options || {};
		var velocityEvalTime = opts.velocityEvalTime || 250;
		var velocitySamples = opts.velocitySamples || 4;
		var velocityMax = opts.velocityMax || 1000;
		var list = $(elements);
		 
		var stopMove;  // function(e) to stop touch, null if not in touch
		var touchId;   // if not null, the id of the current touch
		
		function start(ev, index) {
			if (stopMove)
				stopMove();
			var el = this;
			var touch = ev.changedTouches ? ev.changedTouches[0] : ev;
			var x0 = touch.screenX, y0 = touch.screenY;      // values at last mouse event
			var t0 = +new Date();                       // time of the last event
			var lastDx = [], lastDy = [], lastT = [];  // last vx/vy and t, up to velocitySamples

			touchId = ev.changedTouches ? ev.changedTouches[0].identifier : null;
		 
			function mouseMove(e) {
				var t = +new Date();
				var touch;
				if (touchId != null) {
					touch = findTouch(e, touchId);
					if (!touch)
						return;
				}
				else
					touch = e;
				var nx = touch.screenX, ny = touch.screenY,
				    dx = nx-x0, dy = ny-y0, dt = Math.max(t - t0, 1);
				if (onMove && (dx||dy))
					onMove(el, dx, dy);

				while ((lastT[0] && lastT[0] < t-velocityEvalTime) || lastT.length >= velocitySamples) {
					lastDx.pop();
					lastDy.pop();
					lastT.pop();
				}

				lastDx.push(dx);
				lastDy.push(dy);
				lastT.push(t);

				t0 = t;
				x0 = nx;
				y0 = ny;
			}
			function mouseEnd(e) {
				if (e) {
					var relatedTarget = e['relatedTarget'] || e['toElement'];
					if (e.type == 'mouseout' && 
						($(relatedTarget).trav('parentNode', list[index]).length ||
						relatedTarget == list[index]))
						return;
					mouseMove(e);
				}
				$.off(mouseMove);
				$.off(mouseEnd);
				stopMove = null;
				touchId = null;

				if (onFinish) {
					var t = +new Date();
					var starT = lastT[0], endT = starT;
					var sx = 0, sy = 0;
					var startPos = 1;
					while (startPos < lastT.length && lastT[startPos] < t-velocityEvalTime)
						startT = lastT[startPos++];
					  
					while (startPos < lastT.length) {
						endT = lastT[startPos];
						sx += lastDx[startPos];
						sy += lastDy[startPos++];
					}

					var dt = Math.max(endT - starT, 1);
					onFinish(el, absLimit(sx/dt*1000, velocityMax), absLimit(sy/dt*1000, velocityMax));
				}
			}
	
			stopMove = mouseEnd;
			this.on('mousemove touchmove', mouseMove);
			this.on('mouseup |mouseout touchend touchcancel touchleave' , mouseEnd);

			if (onStart)
				onStart(el, ev);
		}
		
		list.on('mousedown touchstart', start);
  	}

  	function isSvgPossible() {
  		return document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");
  	}

  	// returns true if fullscreen is possible, false if not possible at the moment, or null if not possible at all
  	function isFullscreenPossible(el) {
  		return _('fullscreenEnabled', 'mozFullScreenEnabled', 'webkitFullscreenEnabled', 'msFullscreenEnabled').find(function(name) {
  			return document[name];
  		});
  	}

  	// sets the given element to fullscreen. Returns the current element, or null/undef if failed.
	function setFullscreen(el) {
		var name = _('requestFullscreen', 'mozRequestFullScreen', 'webkitRequestFullscreen', 'msRequestFullscreen').find(function(name) {
			return el[name] && name;
		});
		if (name && name == 'webkitRequestFullscreen')
			el.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		else if (name)
			el[name]();
		else
			return null;

		return _('fullscreenElement', 'mozFullScreenElement', 'webkitFullscreenElement', 'msFullscreenElement').find(function(name) {
			return document[name];
		});
	}

	// exits the current fullscreen
	function exitFullscreen() {
		var name = _('exitFullscreen', 'mozCancelFullScreen', 'webkitExitFullscreen', 'msExitFullscreen').find(function(name) {
			return document[name] && name;
		});
		if (name)
			document[name]();
	}

	function getDataOptions(el, optionList) {
		var opts = {};
		_.eachObj($(el).get(optionList), function(name, value) {
			if (value)
				opts[name.replace(/^\W/, '')] = value;
		});
		return opts;
	}



	return {
		getDataOptions: getDataOptions,
		absLimit: absLimit,
		absReduce: absReduce,
		createSmoothInterpolator: createSmoothInterpolator,
		touchMover: touchMover,
		isSvgPossible: isSvgPossible,
		isFullscreenPossible: isFullscreenPossible,
		setFullscreen: setFullscreen,
		exitFullscreen: exitFullscreen
	};
});



define('touchScroll' , function(require) {
	var NIAGARA = require('minified'); 
	var $ = NIAGARA.$, $$ = NIAGARA.$$, EE = NIAGARA.EE, _ = NIAGARA._;

	var niaUI = require('niagara-ui');
	var createSmoothInterpolator = niaUI.createSmoothInterpolator;
	var getDataOptions = niaUI.getDataOptions;
	var touchMover = niaUI.touchMover;


	// options = {
	//   deceleration:     400,         // deceleration in px/s^2
	//   bumpAnimDuration: 300,         // duration of bump animation in ms
	//   initialPosition: {x: 0, y: 0}, // initial position in px. Will be centered if not set. Alt syntax: "x, y"
	//   axis: 'both',                  // 'x' to move only x-axis, 'y' for y-axis
	//   scrollAlways: false            // if set true, touch scrolling is supported even when content fits
	// } 

	function touchScroll(parent, content, options) {
		parent = $(parent).only(0);
		content = $(content).only(0);
console.log(parent, content);
		if (!parent.length)
			return;
		if (!content.length)
			content = $('*', parent, true).not('.background').not('.overlay').only(0);
console.log(2, parent, content);
		if (!content.length)
			return;
console.log(parent, content);

		var w = content.get('clientWidth', true);
		var h = content.get('clientHeight', true);
		var pw = parent.get('clientWidth', true);
		var ph = parent.get('clientHeight', true);

		var opts = options || {};
		var decceleration = (opts.deceleration || 400) / 1000000;      // deceleration in px/s^2
		var bumpAnimDuration = opts.bumpAnimDuration || 300;  // duration of bump animation in ms
		var initialPosition = opts.initialPosition || {x: (w-pw)/2, y: (h-ph)/2};
		var scrollAlways = !!opts.scrollAlways;
		var axis = opts.axis || 'both';
		var axisX = axis != 'y' && (scrollAlways || pw<w);
		var axisY = axis != 'x' && (scrollAlways || ph<h);

		if (_.isString(initialPosition))
			initialPosition = {x: parseFloat(initialPosition.replace(/,.*/, '')), y: parseFloat(initialPosition.replace(/.*,/, ''))};

		parent.set({$overflow: 'hidden'});
		content.set({$position: 'absolute', 
					 $left: -Math.round(initialPosition.x)+'px', 
					 $top: -Math.round(initialPosition.y)+'px'});
		if (!/relative|absolute|fixed|sticky/.test(parent.get('$position')))
			parent.set({$position: 'relative'});

		var sx = content.get('offsetLeft', true);
		var sy = content.get('offsetTop', true);
		var animLoopStop;

		touchMover(parent, function start() {
			if (animLoopStop)
				animLoopStop();
		},
		function move(el, dx, dy) {
			if (axisX)
				sx += dx;
			if (axisY)
				sy += dy;
			content.set({$left: Math.round(sx)+'px', $top: Math.round(sy)+'px'});	
		}, 
		function end(el, vxS, vyS) {
			var vx = axisX ? vxS / 1000 : 0;
			var vy = axisY ? vyS / 1000 : 0;
			var sx0 = sx;
			var sy0 = sy;
			var v = Math.sqrt(vx*vx+vy*vy);
			var maxT = v / decceleration;
			var endT = maxT;
			var dir = Math.atan2(vy, vx);
			var ax = -Math.cos(dir) * decceleration;
			var ay = -Math.sin(dir) * decceleration;
			var bumpAnimX, bumpAnimY;

			animLoopStop = $.loop(function(t, stop) {
				var tm = Math.min(t, maxT);
				if (bumpAnimX)
					sx = bumpAnimX(t);
				else {
					sx = sx0 + vx*tm + 0.5*ax*tm*tm;
					if (sx < pw-w)
						bumpAnimX = createSmoothInterpolator(bumpAnimDuration, sx, pw-w, vx+ax*tm, 0, -tm);
					else if (sx > 0)
						bumpAnimX = createSmoothInterpolator(bumpAnimDuration, sx, 0, vx+ax*tm, 0, -tm);
					if (bumpAnimX)
						endT = Math.max(endT, tm + bumpAnimDuration);
		 		}
		 		if (bumpAnimY)
					sy = bumpAnimY(t);
		  		else {
					sy = sy0 + vy*tm + 0.5*ay*tm*tm;
					if (sy < ph-h)
			  			bumpAnimY = createSmoothInterpolator(bumpAnimDuration, sy, ph-h, vy+ay*tm, 0, -tm);
					else if (sy > 0)
			  			bumpAnimY = createSmoothInterpolator(bumpAnimDuration, sy, 0, vy+ay*tm, 0, -tm);
					if (bumpAnimY)
						endT = Math.max(endT, tm + bumpAnimDuration);
				}
				if (t >= endT) {
					sx = Math.max(pw-w, Math.min(0, sx));
					sy = Math.max(ph-h, Math.min(0, sy));
					stop();
		  		}
				content.set({$left: Math.round(sx)+'px', $top: Math.round(sy)+'px'});
			});
		}, options);
	}

	$(function() {
		$('.touchScroll').each(function(el) {
			var opts = getDataOptions(el, ['%deceleration', '%bumpAnimDuration', '%initialPosition', '%axis', '%scrollAlways']);
			touchScroll(el, null, opts);
		});
	});


	return touchScroll;
});


var touchScroll = require('touchScroll');



