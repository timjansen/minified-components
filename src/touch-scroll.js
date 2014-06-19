
define('touchScroll' , function(require) {
	var NIA = require('minified'); 
	var $ = NIA.$, $$ = NIA.$$, EE = NIA.EE, _ = NIA._;

	var niaUI = require('niagara-ui');
	var createSmoothInterpolator = niaUI.createSmoothInterpolator;
	var getDataOptions = niaUI.getDataOptions;
	var getBool = niaUI.getBool;
	var getFloat = niaUI.getFloat;
	var createEventDispatcher = niaUI.createEventDispatcher;
	var touchMover = niaUI.touchMover;
	var isSvgPossible = niaUI.isSvgPossible;
	var toPx = niaUI.toPx;
	var isMaximizePossible = niaUI.isMaximizePossible;
	var maximize = niaUI.maximize;
	var createToggle = niaUI.createToggle;
	var SEE = niaUI.SEE;


	// parent: a <div> or similar element. Should have fixed size. touchScroll will set relative positioning if it is not already positioned and $overflow=hidden.
	// content: the element to move inside the parent. If not given, it takes the first child that does not have the classes .background or .overlay.
	// options = {
	//   deceleration:     400,         // deceleration in px/s^2
	//   bumpAnimDuration: 300,         // duration of bump animation in ms
	//   initialPosition: {x: 0, y: 0}, // initial position in px. Will be centered if not set. Alt syntax: "x, y"
	//   axis: 'both',                  // 'x' to move only x-axis, 'y' for y-axis
	//   scrollAlways: false,           // if set true, touch scrolling is supported even when content fits
	//   showInstructions: true,        // if true, show a touch animation to explain how to use this. default: true
	//   instructionParams: {src: '/img/touch-anim.svg', width: 110, height: 100},  // use your own image or animation here.  width/height as number in px
	//   showMaximizeButton: true,      // if true, shows a maximize button in the lower right corner. Default: true if browser supports maximization.
	//   maximizeButton: null,          // if set, either the URL of a maximize button image to show while NOT maximized, or a button to clone. 
	//                                  // Optionally the URL is followed by width and height, comma-separated. Default is the built-in button.
	//   unmaximizeButton: null,        // if set, either the URL of a maximize button image to show while maximized, or a button to clone. Default is the same as 
	//                                  // maximizeButton button.
	//   showFullScreen: false			// Use fullscreen mode if possible when maximized. Default: false.
	// } 
	// 
	// Returns: {
	//	 onTouchStart: function(handler){}    // to register a handler to be called when user touches or presses mouse button
	//   offTouchStart: function(handler){}   // unregisters onTouchStart handler	
	//	 onTouchMove: function(handler){}     // to register a handler to be called when user moves the finger/pointer. Arguments: dx/dy relative movement in px
	//   offTouchMove: function(handler){}    // unregisters onTouchMove handler	
	//	 onTouchEnd: function(handler){}      // to register a handler to be called when user touch ends (lifts finger or releases mouse)
	//   offTouchEnd: function(handler){}     // unregisters onTouchEnd handler	
	//	 onMovementStart: function(handler){} // to register a handler to be called when the animation after touch or move() starts
	//   offMovementStart: function(handler){}// unregisters onMovementStart handler	
	//	 onMovementEnd: function(handler){}   // to register a handler to be called when the animation after the touch ends
	//   offMovementEnd: function(handler){}  // unregisters onMovementEnd handler	
	//	 onClick: function(handler){}         // to register a handler to be called when user clicks
	//   offClick: function(handler){}        // unregisters onClick handler
	//   move: function(dx, dy, t)            // Changes position by dx/dy. Clipped. Optionally animated, duration t ms
	//   moveTo: function(x, y, t)            // Moves to position. Optionally animated, duration t ms
	//   changeContent: function(content, x, y) // replaces current content with given element. Optionally position to x/y (default centers)
	//   position: function(),                // returns object {x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0, viewW: 0, viewH: 0}
	//                                        // with position (x/y), current velocity in px/s (vx/vy), content size (w/h) and view size (viewW/viewH)
    //	 changeViewSize: function(w, h),      // call when you modify view size
    //	 toggleMaximize: function(tog)        // toggle function to enable/disable fullscreen
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

		var instructions; // element list to remove or null
		var preMaximizeSize; // stores width/height during fullscreen

		var touchStartED = createEventDispatcher(parent);
		var touchMoveED = createEventDispatcher(parent);
		var touchEndED = createEventDispatcher(parent);
		var movementStartED = createEventDispatcher(parent);
		var movementEndED = createEventDispatcher(parent);
		var clickED = createEventDispatcher(parent);
		var maximizeED = createEventDispatcher(parent);
		var changeED = createEventDispatcher(parent);

		var opts = options || {};
		var deceleration = getFloat(opts.deceleration, 400) / 1000000;      // deceleration in px/s^2
		var bumpAnimDuration = getFloat(opts.bumpAnimDuration, 300);  // duration of bump animation in ms
		var initialPosition = opts.initialPosition || {x: (w-pw)/2, y: (h-ph)/2};
		var scrollAlways = getBool(opts.scrollAlways, false);
		var axis = opts.axis || 'both';
		var axisX = axis != 'y' && (scrollAlways || pw<w);
		var axisY = axis != 'x' && (scrollAlways || ph<h);
		var showInstructions = getBool(opts.showInstructions, true);
		var instructionParams = opts.instructionParams || {src: '/img/touch-anim.svg', width: 110, height: 100};
		var showMaximizeButton = getBool(opts.showMaximizeButton, isMaximizePossible());
		var maximizeButton = opts.maximizeButton;
		var unmaximizeButton = opts.unmaximizeButton;
		var showFullScreen = opts.showFullScreen;

		if (_.isString(initialPosition))
			initialPosition = {x: parseFloat(initialPosition.replace(/,.*/, '')), y: parseFloat(initialPosition.replace(/.*,/, ''))};
		if (_.isString(instructionParams)) {
			var ia  = instructionParams.split(/\s*;\s*/);
			if (ia.length < 3)
				showInstructions = false;
			instructionParams = {src: ia[0], width: parseFloat(ia[1]), height: parseFloat(ia[2])};
		}

		function createMaximizeButton(str) {
			var fsb = str.split(/\s*,\s*/);
			return EE('button', {$backgroundColor: 'transparent', $border: 0}, 
				EE('img', {'@src': fsb[0], '@width': fsb[1], '@height': fsb[2]}));
		}
		if (_.isString(maximizeButton)) 
			maximizeButton = createMaximizeButton(maximizeButton);
		else if (maximizeButton)
			maximizeButton = $(maximizeButton);
		if (_.isString(unmaximizeButton)) 
			unmaximizeButton = createMaximizeButton(unmaximizeButton);
		else if (unmaximizeButton)
			unmaximizeButton = $(unmaximizeButton);
		else if (maximizeButton)
			unmaximizeButton = maximizeButton;
		

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
				movementEndED();
				animLoopStop = null;
			}
		}
        
		function setPos() {
        	content.set({$left: Math.round(sx)+'px', $top: Math.round(sy)+'px'});
        	fireModelChange();
	    }

        // works with real (negative) coordinates, not user coordinates
        function moveToInternal(x, y, clip, smoothT) {
        	stopAnimation();
            if (smoothT) {
            	movementStartED();
            	var animX = createSmoothInterpolator(smoothT, sx, x, vx, 0);
				var animY = createSmoothInterpolator(smoothT, sy, y, vy, 0);
				animLoopStop = $.loop(function(t) {
					if (t >= smoothT)
						moveToInternal(x, y, false);
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
				if (clip) {
					if (pw < w)
						sx = Math.max(pw-w, Math.min(x, 0));
					else
						sx = (pw-w)/2;
					if (ph < h)
						sy = Math.max(ph-h, Math.min(y, 0));
					else
						sy = (ph-h)/2;
				}
				else {
					sx = x;
					sy = y;
				}
				vx = vy = 0;
				setPos();
			}
		}

		function moveTo(x, y, smoothT) {
			moveToInternal(-x, -y, false, smoothT);
		}

		function move(dx, dy, smoothT) {
			var x = sx, y = sy;
			if (axisX && w > pw)
				x = sx+dx;
			if (axisY && h > ph)
				y = sy+dy;
			moveToInternal(x, y, true, smoothT);
		}

		function getModel() {
			return {x: w+sx, y: h+sy, vx: vx*1000, vy: vy*1000, w: w, h: h, viewW: pw, viewH: ph};
		}

		function fireModelChange() {
			if (changeED.hasHandlers())
				changeED(getModel());
		}

		function changeContent(newContent, initialX, initialY) {
			var nc = $(newContent).only(0);
			content.replace(nc);
			content = nc;
			content.set({$position: 'absolute'}); 
			w = nc.get('clientWidth', true);
			h = nc.get('clientHeight', true);
			var x = initialX != null ? initialX : (w-pw)/2;
			var y = initialY != null ? initialY : (h-ph)/2;
			moveTo(x, y);
		}

		function changeViewSize(newW, newH, newX, newY) {
			var cx = sx - pw/2, cy = sy - ph/2; // center coords before size change
			if (newH != null) {
				pw = newW;
				ph = newH;
			}
			else {
				pw = parent.get('clientWidth', true);
				ph = parent.get('clientHeight', true);
			}
			if (newY != null)
				moveTo(newX, newY);
			else 
				moveToInternal(cx + pw/2, cy + ph/2, true);
		}

		function removeInstructions() {
			if (instructions) {
				instructions.remove();
				instructions = null;
			}
		}

		var maximizeStopFunc;
 		var toggleMaximize = createToggle(function() {
 				if (maximizeStopFunc)
 					maximizeStopFunc();
 			}, function() {
			maximizeStopFunc = maximize(parent, function maximizationHandler(tog) {
				toggleMaximize.override(tog);
	  			changeViewSize();
				maximizeED(tog);
			}, showFullScreen);
		}, removeInstructions);

		var tmv = touchMover(parent, options);
		tmv.onClick(clickED);
		tmv.onStart(function() {
			removeInstructions();
			stopAnimation();
			touchStartED();
		});
		tmv.onMove(function(dx, dy) {
			move(dx, dy);
			touchMoveED(dx, dy);
		});
		tmv.onFinish(function(initVxS, initVyS) {
			var canAnimateX = axisX && w>pw;
			var canAnimateY = axisY && h>ph;
			var initVx = canAnimateX ? initVxS / 1000 : 0;
			var initVy = canAnimateY ? initVyS / 1000 : 0;
			var sx0 = sx;
			var sy0 = sy;
			var v = Math.sqrt(initVx*initVx+initVy*initVy);
			var maxT = v / deceleration;
			var dir = Math.atan2(initVy, initVx);
			var ax = -Math.cos(dir) * deceleration;
			var ay = -Math.sin(dir) * deceleration;
			var animX, animY;
			var animEndT = maxT;

			movementStartED();

			animLoopStop = $.loop(function(t, stop) {
				var tm = Math.min(t, maxT);
				if (animX) {
					sx = animX(t);
					vx = animX(t, true);
				}
				else if (canAnimateX) {
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
		  		else if (canAnimateY) {
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
					if (canAnimateX)
						sx = Math.max(pw-w, Math.min(0, sx));
					if (canAnimateY)
						sy = Math.max(ph-h, Math.min(0, sy));
					vx = vy = 0;
					stop();
					movementEndED();
		  		}
				setPos();
			});
			touchEndED();
		});

		if (showMaximizeButton) {
			var button;
			if (!maximizeButton || !unmaximizeButton) {
				var svgOff = SEE('svg', {'@width': 32, '@height': 32, '@viewBox': '0 0 180 180'},
					SEE('g', [
						SEE('path', {'@d': 'M0,0l180,0l0,180l-180,0l0,-180 M15,15l150,0l0,150l-150,0l0,150', '@fill-rule': 'evenodd', '@fill': '#fff', '@opacity': '0.8'}),
						SEE('rect', {'@class': 'svgFsButtonBg', '@x': 15, '@y': 15, '@width': 150, '@height': 150, '@fill': '#000', '@opacity': '0.5'}),
						SEE('path', {'@stroke': '#000', '@stroke-width': 10, '@fill': '#fff', '@opacity': '0.8',
							'@d': 'M10,10l60,0l-20,20l100,100l20,-20l0,60l-60,0l20,-20l-100,-100l-20,20 z'})
					])); 
				var svgOn = svgOff.clone();
				var arrowPath = svgOn.select('path').sub(-1);
				arrowPath.set({'@d': 'M20,25l10,-10l35,35l20,-20l0,60l-60,0l20,-20l-35,-35z'});
				svgOn.select('g').add(arrowPath.clone().set({'@d': 'M155,155l-10,10l-35,-35l-20,20l0,-60l60,0l-20,20l35,35z'}));

				var maxiButtonStyle = {$backgroundColor: 'transparent', $border: 0};
				if (!maximizeButton)
					maximizeButton = EE('button', maxiButtonStyle, svgOn);
				if (!unmaximizeButton)
					unmaximizeButton = EE('button', maxiButtonStyle, svgOff);
			}

			var buttons = _(unmaximizeButton, maximizeButton);
			function positionButton(onOff) {
				if (button)
					button.remove();
				var dist = Math.round(Math.min(pw, ph)*0.05);
				parent.add(button = buttons.only(+onOff).clone()
												.set({$position: 'absolute', $right: dist+'px', $bottom: dist+'px'})
												.per(function(b) {
					var buttonBg = b.select('.svgFsButtonBg');
					var tc = b.touchClicker();
					tc.onClick(toggleMaximize);
					if (buttonBg.length)
						tc.onOver(buttonBg.toggle({'@fill': '#000'}, {'@fill': '#999'}, 150, 1));
				}));
			}
			positionButton(false);
			maximizeED.on(positionButton);
		}

		if (showInstructions && (isSvgPossible() || !/\.svg$/.test(instructionParams.src))) {
			parent.add(instructions = EE('img', {src: instructionParams.src, $position: 'absolute', 
				$width: toPx(instructionParams.width), $height: toPx(instructionParams.height),
				$left: toPx(Math.round((pw - instructionParams.width)/2)),
				$top: toPx(Math.round((ph - instructionParams.height)/2))}));
		}


		return {
			onTouchStart:  touchStartED.on,  offTouchStart:  touchStartED.off,
			onTouchMove:   touchMoveED.on,   offTouchMove:   touchMoveED.off,
			onTouchEnd:    touchEndED.on,    offTouchEnd:    touchEndED.off,
			onMovementStart: movementStartED.on, offMovementStart: movementStartED.off,
			onMovementEnd: movementEndED.on, offMovementEnd: movementEndED.off,
			onClick: clickED.on, offClick: clickED.off,
			onChange: changeED.on, offChange: changeED.off, 
			onMaximize: maximizeED.on, offMaximize: maximizeED.off,
			move: move, moveTo: moveTo, getModel: getModel, changeContent: changeContent,
			changeViewSize: changeViewSize, toggleMaximize: toggleMaximize
  		};
	}

	$(function() {
		$('.touchScroll').each(function(el) {
			var opts = getDataOptions(el, ['%deceleration', '%bumpAnimDuration', '%initialPosition', '%axis', '%scrollAlways',
					'%showInstructions', '%instructionParams', '%velocityEvalTime', '%velocitySamples', '%velocityMax']);
			touchScroll(el, null, opts);
		});
	});


	return touchScroll;
});


var touchScroll = require('touchScroll');



