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

	function toPx(number) {
		if (!_.isNumber(number) && /[a-zA-Z]\s*$/.test(number))
			return number;
		else
			return number + 'px';
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

	// returns an event dispatcher that can register/unregister handlers and trigger events for them.
	function createEventDispatcher(obj) {
		var handlers = [];
		function trigger() {
			if (handlers.length)
				_.call(handlers, obj, arguments);
		}
		trigger.on = function(handler) {
			handlers.push(handler);
		};
		trigger.off = function(handler) {
			for (var i = 0; i < handlers.length; i++)
				if (handlers[i] === handler)
					handlers.slice(i--, 1);
		};
		trigger.hasHandlers = function() {
			return !!handlers.length;
		};
		return trigger;
	}

	function createToggle(f1, f2opt) {
		var f2 = f2opt || f1;
		var state = false;
		var toggle = function(tog) {
			if (tog !== state) {
				if (tog === true || tog === false) {
					if (state = tog)
						f2(true);
					else
						f1(false);
				}
				else
					toggle(!state);
			}
		};
		toggle.override = function(tog) {
			state = !!tog;
		}
		return toggle;
	}


	function findTouch(touchEvent, id) {
		return touchEvent.touches ? _.find(touchEvent.touches, function(t) {
			return t.identifier == id ? t : null;
		}) : null;
	}

	// element: any param for $()
	// options = {
	//   velocityEvalTime: 250,     // max number of milliseconds to get avg current speed
	//   velocitySamples:  3,       // number of samples to determine speed. Must be >1.
	//   velocityMax:      1000,    // max velocity in px/s
	//   maxClickDuration: 750,     // if touch longer than this in ms, it's not a click
	//   maxClickTravel:   5        // if that many pixels have been moved, it's not a click
	// }
 	// Returns event dispatchers:
 	// function onStart(event); // event is the MouseEvent that started the op
	// function onMove(dx, dy); // delta x/y since last invocation
	// function onFinish(sx, sy); // speed px/s for x/y at end of touch
	// function onClick()
	function touchMover(element, options) {
		var opts = options || {};
		var velocityEvalTime = getFloat(opts.velocityEvalTime, 250);
		var velocitySamples = getFloat(opts.velocitySamples, 3);
		var velocityMax = getFloat(opts.velocityMax, 1000);
		var maxClickDuration = getFloat(opts.maxClickDuration, 750);
		var maxClickTravel = getFloat(opts.maxClickTravel, 5);
		var list = $(element).only(0);
		 
		var onStartED = createEventDispatcher(list);
		var onMoveED = createEventDispatcher(list);
		var onFinishED = createEventDispatcher(list);
		var onClickED = createEventDispatcher(list);

		var stopMove;  // function(e) to stop touch, null if not in touch
		var touchId;   // the id of the current touch. null for mouse events.
		
		function start(ev, index) {
			if (stopMove)
				stopMove();
			var el = this;
			var touch = ev.changedTouches ? ev.changedTouches[0] : ev;
			var x0 = touch.screenX, y0 = touch.screenY;      // values at last mouse event
			var t0 = +new Date();                       // time of the last event
			var tStart = t0;                            // begin of the touch
			var lastDx = [], lastDy = [], lastT = [];   // last vx/vy and t, up to velocitySamples
			var travelDistance = 0;                     // distance travelled during touch (to determine clicks)

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
				if (dx||dy)
					onMoveED(dx, dy);
				travelDistance += Math.abs(dx) + Math.abs(dy); // avoid using sqrt() here. precision not required

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

				var t = +new Date();
				if (onFinishED.hasHandlers()) {
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
					onFinishED(absLimit(sx/dt*1000, velocityMax), absLimit(sy/dt*1000, velocityMax));
				}
				if ((t - tStart <= maxClickDuration) && (travelDistance <= maxClickTravel))
					onClickED();
			}
	
			stopMove = mouseEnd;
			this.on('mousemove touchmove', mouseMove);
			this.on('mouseup |mouseout touchend touchcancel touchleave' , mouseEnd);

			onStartED(ev);
		}
		
		list.on('mousedown touchstart', start);

		return {onStart: onStartED.on, onMove: onMoveED.on, onFinish: onFinishED.on, onClick: onClickED.on};
  	}

  	function isSvgPossible() {
  		return document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1");
  	}

  	// copied from SVG module to reduce dependencies
	function SEE(elementName, attributes, children) {
		var e = $(document.createElementNS("http://www.w3.org/2000/svg", elementName));
		return (_.isList(attributes) || (attributes != null && !_.isObject(attributes)) ) ? e.add(attributes) : e.set(attributes).add(children);
	}


	// throttled notification of window resize events
	function onResizeWindow(handler) {
    	var pending = false;
		var loopRunning;
     
		function resizeLoop(t, stop) {
			if (!pending) {
				stop();
				loopRunning = null;
			}
			else
				handler();
			pending = false;
		}

		function eventHandler() {
			if (pending)
				return;
			pending = true;
			if (!loopRunning)
			loopRunning = $.loop(resizeLoop);
		}

		$(window).on('|resize', eventHandler);
		return eventHandler;
	}


  	// returns true if fullscreen is possible, false if not possible at the moment, or null if not possible at all
  	function isFullscreenPossible(el) {
  		return _('fullscreenEnabled', 'mozFullScreenEnabled', 'webkitFullscreenEnabled', 'msFullscreenEnabled').find(function(name) {
  			return document[name];
  		});
  	}

  	// sets the given element to fullscreen. 
  	// The toggle is invoked with true if FS is entered and false if exited.
	function setFullscreen(el, toggle) {
		el = $$(el);
		var name = _('requestFullscreen', 'mozRequestFullScreen', 'webkitRequestFullscreen', 'msRequestFullscreen').find(function(name) {
			return el[name] && name;
		});

		if (toggle)
			$(document).on('|fullscreenchange |webkitfullscreenchange |mozfullscreenchange |msfullscreenchange', function handler(e) {
				var fsEl = _('fullscreenElement', 'mozFullScreenElement', 'webkitFullscreenElement', 'msFullscreenElement').find(function(name) {
					return document[name];
				});
				if (fsEl == el)
					toggle(true);
				else if (!fsEl) {
					toggle(false);
					$.off(handler);
				}
			});

		if (name && name == 'webkitRequestFullscreen')
			el.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
		else if (name)
			el[name]();
		else
			return null;

		return 
	}

	// exits the current fullscreen
	function exitFullscreen() {
		var name = _('exitFullscreen', 'mozCancelFullScreen', 'webkitExitFullscreen', 'msExitFullscreen').find(function(name) {
			return document[name] && name;
		});
		if (name)
			document[name]();
	}


	function isMaximizePossible() {
		var el = EE('div', {$position: 'fixed'});
		$('body').add(el);
		return el.get('$position') == 'fixed';
	}

	// Maximizes the given element to use the whole browser screen, optionally in fullscreen mode.
	//
	// Please note that fullscreen mode will not be entered immediately and your control over it is limited.
	// The user may leave fullscreen on her own. Use the onChange callback to be notified when the fullscreen
	// mode has been established or when the user leaves it. onChange may also important in case the browser
	// window's size changes (typically when the user changes the browser window manually on a desktop system, or caused
	// by an orientation change on hand-held devices).
	// onChange syntax: function(w, h, isMaximized, isFullscreen)
	// Returns a stop() function to call when you want to unmaximize. stop() will also cause one final onChange() invokation.
	//  onChange() is a callback.
	function maximize(el, onChange, useFullscreen) {
		var tryFullscreen = useFullscreen && isFullscreenPossible();
		var resizeHandler;
		var active = true, inFullscreen = false, stopped = false;
		var e = $(el).only(0);
		var oldProps = el.get(['$position', '$display', '$width', '$height', '$top', '$left', '$zIndex']);
		el.set({$position: 'fixed', $display: 'block', $width: '100%', $height: '100%', $top: 0, $left: 0, $zIndex: 10000});

		
		function stateChange(isMaximized) {
			if (active) {
				active = isMaximized;
				if (!isMaximized) {
					el.set(oldProps);
					$.off(resizeHandler);
				}
				onChange && onChange(isMaximized, window.innerWidth || document.body.clientWidth, window.innerHeight || document.body.clientHeight);
			}
		}
 
		if (tryFullscreen)
			setFullscreen(el, function (fs) {
				if (fs && stopped) // if stop() called before pending fullscreen is ready, exit immediately
					exitFullscreen();
				else
					stateChange(inFullscreen = fs);
			});
	
		$.loop(function(t, stop) { // send onChange in loop(), hoping this may minimize the number of events
			if (!inFullscreen)
				stateChange(true);
			stop();
		});

		resizeHandler = onResizeWindow(function() {
			stateChange(true);
		});

		return function() {
			if (!stopped) {
				stopped = true;
				if (inFullscreen)
					exitFullscreen();
				else
					stateChange(false);
			}
		};
	}



	function createCustomButton(content, basicStyling, onStateChange) {
		var button = EE('button', basicStyling, content);
		var isOver = false, isPressed = false, isFocussed = false, currentState;
		button.onOver(function(o) {
			isOver = o;
			if (!isPressed)
				onStateChange(currentState = o ? 'over' : 'plain', isFocussed);
		});
        button.onPressUI(function(p) {
            if (p)
                onStateChange(currentState = 'pressed', isFocussed)
            else
                onStateChange(currentState = isOver ? 'over' : 'plain', isFocussed);
        });
        button.onFocus(function(focus) {
            onStateChange(currentState, isFocussed = focus)
        });
            
        return button;
    }


    function createStyledButton(content, basicStyling, states, focusStyles, effectDuration) {
        states = states || {};
        basicStyling = basicStyling || {$border: 0, $outline: 'none'};

        var button, animator, focusToggle, lastContentChange = 'plain';
        if (!content.plain) {
            content = {plain: content};
        }
        if (effectDuration == null)
            effectDuration = 400;
        if (!effectDuration.plain)
            effectDuration = {plain: effectDuration};
        effectDuration.over = effectDuration.over || effectDuration.plain;
        effectDuration.pressed = effectDuration.pressed || 0;
        effectDuration.focus = effectDuration.focus || 0;
        
        function stateChange(s, focus) {
            animator(s, effectDuration[s]);
            focusToggle(focus);
            if (content[s] != null && lastContentChange != s)
                button.fill(content[lastContentChange = s]);
        }
        button = createCustomButton(content.plain, basicStyling, stateChange).set(states.plain);
        animator = button.multiAnimUI(states, 400);
        focusToggle = focusStyles ? button.toggle(focusStyles[0], focusStyles[1], effectDuration.focus) : function(){};
        return button;
    }



	function multiAnimUI(stateDescs, defaultDurationMs, defaultLinearity) {
		var self = this;
		var promise;
		var state, prevState;

		return function(newState, durationMs, linearity) {
			if (newState === state || !stateDescs[newState])
				return;
			var d = durationMs != null ? durationMs : defaultDurationMs;
			if (promise) {
				var d0 = promise.stop();
				if (prevState === newState)
					d = d0;
			}
			if (d) {
				promise = self.animate(stateDescs[newState], d, linearity || defaultLinearity);
				promise.then(function(){
					promise = null;
				});
			}
			else {
				self.set(stateDescs[newState]);
				promise = null;
			}

			prevState = state;
			state = newState;
		};
	};

	// TODO: touch events needed?
	function onPressUI(subSelector, handler, unpressArg, pressArg) {
		if (handler) {
			var downStates = [];
			return this.per(function(el, index) {
				downStates[index] = false;
				el.onOver(function(over) {
					if (downStates[index] && !over)
						handler.call(el, downStates[index] = false);
				});
			}).on('|mousedown |mouseup', function(e, index) {
				var down = (e.type == 'mousedown');
				if (downStates[index] != down)
					handler.call(this, downStates[index] = down);
			});
		}
		else
			return this.onPressUI(null, subSelector);
	};

	NIAGARA.M.prototype.multiAnimUI = multiAnimUI;
	NIAGARA.M.prototype.onPressUI = onPressUI;

	return {
		getDataOptions: getDataOptions,
		getBool: getBool,
		getFloat: getFloat,
		toPx: toPx,
		createEventDispatcher: createEventDispatcher,
		createToggle: createToggle,
		absLimit: absLimit,
		absReduce: absReduce,
		createSmoothInterpolator: createSmoothInterpolator,
		touchMover: touchMover,
		isSvgPossible: isSvgPossible,
		SEE: SEE,
		isFullscreenPossible: isFullscreenPossible,
		setFullscreen: setFullscreen,
		exitFullscreen: exitFullscreen,
		maximize: maximize, 
		isMaximizePossible: isMaximizePossible
	};
});
