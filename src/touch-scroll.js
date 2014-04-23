
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

	// gets a list of data-attribute options to get from the elements, returns the options as object.
	function getDataOptions(el, optionList) {
		var opts = {};
		_.eachObj($(el).get(optionList), function(name, value) {
			if (value)
				opts[name.replace(/^\W/, '')] = value;
		});
		return opts;
	}

	// converts string into boolean
	function getBool(str, defaultValue) {
		if (str === true || str === false)
			return str;
		else if (str == null || str === '')
			return !!defaultValue;
		else
			return /true|on|yes/i.test(str);
	}
	
	// converts string into float
	function getFloat(str, defaultValue) {
		if (str == null || str == '')
			return defaultValue||0;
		else if (_.isNumber(str))
			return str;
		else
			return parseFloat(str);
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
	//   velocityMax:      1000    // max velocity in px/s
	// }
	function touchMover(elements, onStart, onMove, onFinish, options) {
		var opts = options || {};
		var velocityEvalTime = getFloat(opts.velocityEvalTime, 250);
		var velocitySamples = getFloat(opts.velocitySamples, 4);
		var velocityMax = getFloat(opts.velocityMax, 1000);
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

  	// copied from SVG module to reduce dependencies
	function SEE(elementName, attributes, children) {
		var e = $(document.createElementNS("http://www.w3.org/2000/svg", elementName));
		return (_.isList(attributes) || (attributes != null && !_.isObject(attributes)) ) ? e.add(attributes) : e.set(attributes).add(children);
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

	// returns an event dispatcher that can register/unregister handlers and trigger events for them.
	function createEventDispatcher(obj) {
		var handlers = [];
		return {
			on: function(handler) {
				handlers.push(handler);
			},
			off: function(handler) {
				for (var i = 0; i < handlers.length; i++)
					if (handlers[i] === handler)
						handlers.slice(i--, 1);
			},
			trigger: function() {
				if (handlers.length)
					_.call(handlers, obj, arguments);
			}
		};
	}

	return {
		getDataOptions: getDataOptions,
		getBool: getBool,
		getFloat: getFloat,
		createEventDispatcher: createEventDispatcher,
		absLimit: absLimit,
		absReduce: absReduce,
		createSmoothInterpolator: createSmoothInterpolator,
		touchMover: touchMover,
		isSvgPossible: isSvgPossible,
		SEE: SEE,
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
	var getBool = niaUI.getBool;
	var getFloat = niaUI.getFloat;
	var createEventDispatcher = niaUI.createEventDispatcher;
	var touchMover = niaUI.touchMover;
	var isSvgPossible = niaUI.isSvgPossible;


	// parent: a <div> or similar element. Should have fixed size. touchScroll will set relative positioning if it is not already positioned and $overflow=hidden.
	// content: the element to move inside the parent. If not given, it takes the first child that does not have the classes .background or .overlay.
	// options = {
	//   deceleration:     400,         // deceleration in px/s^2
	//   bumpAnimDuration: 300,         // duration of bump animation in ms
	//   initialPosition: {x: 0, y: 0}, // initial position in px. Will be centered if not set. Alt syntax: "x, y"
	//   axis: 'both',                  // 'x' to move only x-axis, 'y' for y-axis
	//   scrollAlways: false,           // if set true, touch scrolling is supported even when content fits
	//   touchAnimation: true,          // if true, show a touch animation to explain how to use this. default: true
	// } 
	// 
	// Returns: {
	//	 onTouchStart: function(handler){}    // to register a handler to be called when user touches or presses mouse button
	//   offTouchStart: function(handler){}   // unregisters onTouchStart handler	
	//	 onTouchMove: function(handler){}     // to register a handler to be called when user moves the finger/pointer. Arguments: dx/dy relative movement in px
	//   offTouchMove: function(handler){}    // unregisters onTouchMove handler	
	//	 onTouchEnd: function(handler){}      // to register a handler to be called when user touch ends (lifts finger or releases mouse)
	//   offTouchEnd: function(handler){}     // unregisters onTouchEnd handler	
	//	 onMovementEnd: function(handler){}   // to register a handler to be called when the animation after the touch ends
	//   offMovementEnd: function(handler){}  // unregisters onMovementEnd handler	
	//}

	function touchScroll(parent, content, options) {
		parent = $(parent).only(0);
		content = $(content).only(0);
		if (!parent.length)
			return;
		if (!content.length)
			content = $('*', parent, true).not('.background').not('.overlay').only(0);
		if (!content.length)
			return;

		var w = content.get('clientWidth', true);
		var h = content.get('clientHeight', true);
		var pw = parent.get('clientWidth', true);
		var ph = parent.get('clientHeight', true);

		var touchStartED = createEventDispatcher(parent);
		var touchMoveED = createEventDispatcher(parent);
		var touchEndED = createEventDispatcher(parent);
		var movementEndED = createEventDispatcher(parent);

		var opts = options || {};
		var deceleration = getFloat(opts.deceleration, 400) / 1000000;      // deceleration in px/s^2
		var bumpAnimDuration = getFloat(opts.bumpAnimDuration, 300);  // duration of bump animation in ms
		var initialPosition = opts.initialPosition || {x: (w-pw)/2, y: (h-ph)/2};
		var scrollAlways = getBool(opts.scrollAlways, false);
		var axis = opts.axis || 'both';
		var axisX = axis != 'y' && (scrollAlways || pw<w);
		var axisY = axis != 'x' && (scrollAlways || ph<h);
		var touchAnimation = getBool(opts.touchAnimation, isSvgPossible());

		if (_.isString(initialPosition))
			initialPosition = {x: parseFloat(initialPosition.replace(/,.*/, '')), y: parseFloat(initialPosition.replace(/.*,/, ''))};

		parent.set({$overflow: 'hidden'});
		content.set({$position: 'absolute', 
					 $left: -Math.round(initialPosition.x)+'px', 
					 $top: -Math.round(initialPosition.y)+'px'});
		if (!/relative|absolute|fixed|sticky/.test(parent.get('$position')))
			parent.set({$position: 'relative'});

		var sx = content.get('offsetLeft', true); // position of the image
		var sy = content.get('offsetTop', true);  
		var vx = 0, vy = 0;                       // current velocity
		var animLoopStop;

		function stopAnimation() {
			if (animLoopStop) {
				animLoopStop();
				movementEndED.trigger();
				animLoopStop = null;
			}
		}
        
		function setPos() {
        	content.set({$left: Math.round(sx)+'px', $top: Math.round(sy)+'px'});
        }

        // works with real (negative) coordinates, not user coordinates
        function moveToInternal(x, y, smoothT) {
        	stopAnimation();
            if (smoothT) {
            	var animX = createSmoothInterpolator(smoothT, sx, x, vx, 0);
				var animY = createSmoothInterpolator(smoothT, sy, y, vy, 0);
				animLoopStop = $.loop(function(t) {
					if (t >= smoothT)
						moveToInternal(x, y);
					else {
						sx = animX(t);
						sy = animY(t);
						vx = animX(t, true);
						vy = animY(t, true);
						setPos();
					}
				});
			}
			else {
				sx = x;
				sy = y;
				vx = vy = 0;
				setPos();
			}
		}

		function moveTo(x, y, smoothT) {
			moveToInternal(-x, -y, smoothT);
		}
         
		function move(dx, dy, smoothT) {
			var x = sx, y = sy;
			if (axisX)
				x = Math.max(pw-w, Math.min(sx+dx, 0));
			if (axisY)
				y = Math.max(ph-h, Math.min(sy+dy, 0));
			moveToInternal(x, y, smoothT);
		}

		function position() {
			return {x: w+sx, y: h+sy, vx: vx*1000, vy: vy*1000, w: w, h: h, viewW: pw, viewH: ph};
		}

		touchMover(parent, function start() {
			stopAnimation();
			touchStartED.trigger();
		},
		function touchMove(el, dx, dy) {
			move(dx, dy);
			touchMoveED.trigger(dx, dy);
		}, 
		function end(el, initVxS, initVyS) {
			var initVx = axisX ? initVxS / 1000 : 0;
			var initVy = axisY ? initVyS / 1000 : 0;
			var sx0 = sx;
			var sy0 = sy;
			var v = Math.sqrt(initVx*initVx+initVy*initVy);
			var maxT = v / deceleration;
			var dir = Math.atan2(initVy, initVx);
			var ax = -Math.cos(dir) * deceleration;
			var ay = -Math.sin(dir) * deceleration;
			var animX, animY;
			var animEndT = maxT;

			animLoopStop = $.loop(function(t, stop) {
				var tm = Math.min(t, maxT);
				if (animX) {
					sx = animX(t);
					vx = animX(t, true);
				}
				else {
					sx = sx0 + initVx*tm + 0.5*ax*tm*tm;
					vx = initVx + 0.5*ax*tm;
					if (sx < pw-w)
						animX = createSmoothInterpolator(bumpAnimDuration, sx, pw-w, initVx+ax*tm, 0, -tm);
					else if (sx > 0)
						animX = createSmoothInterpolator(bumpAnimDuration, sx, 0, initVx+ax*tm, 0, -tm);
					if (animX)
						animEndT = Math.max(animEndT, tm + bumpAnimDuration);
		 		}
		 		if (animY) {
					sy = animY(t);
					vy = animY(t, true);
		 		}
		  		else {
					sy = sy0 + initVy*tm + 0.5*ay*tm*tm;
					vy = initVy + 0.5*ay*tm;
					if (sy < ph-h)
			  			animY = createSmoothInterpolator(bumpAnimDuration, sy, ph-h, initVy+ay*tm, 0, -tm);
					else if (sy > 0)
			  			animY = createSmoothInterpolator(bumpAnimDuration, sy, 0, initVy+ay*tm, 0, -tm);
					if (animY)
						animEndT = Math.max(animEndT, tm + bumpAnimDuration);
				}
				if (t >= animEndT) {
					sx = Math.max(pw-w, Math.min(0, sx));
					sy = Math.max(ph-h, Math.min(0, sy));
					vx = vy = 0;
					stop();
					movementEndED.trigger();
		  		}
				setPos();
			});
			touchEndED.trigger();
		}, options);

		return {
			onTouchStart:  touchStartED.on,  offTouchStart:  touchStartED.off,
			onTouchMove:   touchMoveED.on,   offTouchMove:   touchMoveED.off,
			onTouchEnd:    touchEndED.on,    offTouchEnd:    touchEndED.off,
			onMovementEnd: movementEndED.on, offMovementEnd: movementEndED.off,
			move: move, moveTo: moveTo, position: position
		};
	}

	$(function() {
		$('.touchScroll').each(function(el) {
			var opts = getDataOptions(el, ['%deceleration', '%bumpAnimDuration', '%initialPosition', '%axis', '%scrollAlways',
					'%touchAnimation', '%velocityEvalTime', '%velocitySamples', '%velocityMax']);
			touchScroll(el, null, opts);
		});
	});


	return touchScroll;
});


var touchScroll = require('touchScroll');



