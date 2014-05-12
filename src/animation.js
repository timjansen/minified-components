define('niagara-animation', function(require) {
  var NIAGARA = require('minified'); 
  var $ = NIAGARA.$, $$ = NIAGARA.$$, EE = NIAGARA.EE, _ = NIAGARA._;


	/*$
	 * Creates an interpolation function that will smoothly interpolate from the given start value and velocity
	 * to the given target value with the given target velocity.
	 * @param start the start value
	 * @param target the target value
	 * @param t the current time 0-1
	 * @param startVelocity the initial velocity (using the units from start and duration)
	 * @param targetVelocity the target velocity (using the units from start and duration)
	 */
	function smoothInterpolator(startValue, endValue, t, startVelocity, targetVelocity) {
		var delta = endValue - startValue;
		if (delta == 0)
			return startValue;

		var vStart = (startVelocity||0) / delta;
		var vEnd = (endVelocity||0) / delta;
		
		if (t >= 1)
			return endValue;
		else if (t <= 0)
			return startValue;
		else
			return startValue + (vStart*t + (-2*vStart*vEnd)*t*t + (2*vStart*vEnd-2)*t*t*t) * delta;
	}


	// TODO
	// list.smoothDial({state1:0}, {state2:0}, {velocity1:0}, {velocity2: 0} )
	// - if no velocity2, velocity1 is used for beginning and end
	// - if no velocity1, velocity=0 is assumed
	// - supports multi-property animation (like 'rotate(0 30 30)' to 'rotate(45 100 100)'). Velocity is then an array.

	function extractInterpolatable(s) {
		var nums = [], m;
		while (m = /(?:-?[0-9]+(?:\.[0-9]+)?)|(?:#\w{3}(?:\w{3})?)|(?:rgb\([^\)]+\))/g.exec(s))
			nums.push(parseFloat(m[0]));
		return nums;
	}

	function setInterpolatables(s, nums) {
		var i = 0;
		return s.replace(/-?[0-9]+(?:\.[0-9]+)?/, function() {
			return nums[i++];
		});
	}

    function extractSingleNumber(v) {
        return parseFloat(replace(v, /^[^\d-]+/));
    }

    function getColorComponent(colorCode, index) {
        return (/^#/.test(colorCode)) ?
            parseInt(colorCode.length > 6 ? colorCode.substr(index*2+1, 2) : ((colorCode=colorCode.charAt(index+1))+colorCode), 16)
        :
            extractSingleNumber(colorCode.split(',')[index]);
    }

	function smoothDial(properties1, properties2, velocities1, velocities2) {
		var self = this;

        function getValues(properties) {
            return _.mapObj(properties, function(name, start) {
                return _(extractInterpolatable(start));
            });   
        }
        var startValues = getValues(properties1);
        var endValues = getValues(properties2);
        function getVelocities(vmap) {
            return _.mapObj(startValues, function(name, startValues) {
                return startValues.map(function(startValue, index) {
                    if (vmap && vmap[name] != null) {
                        if (_.isList(vmap[name]))
                            return vmap[name][index] || 0;
                        else if (index == 0)
                            return vmap[name];
                    }
                    else
                        return 0;
                });
            });
        }
        var startVelocities = getVelocities(velocities1);
        var endVelocities = getVelocities(velocities2 || velocities1);

		return function(t) {
			_.eachObj(startValues, function(name, valueList) {
                self.set(name, setInterpolatables(startValues[name], 
                    valueList.map(function(start, valIndex) {
                    var i = 0;
                    var end = endValues[name][valIndex];
                    var vStart = startVelocities[name][valIndex];
                    var vEnd = endVelocities[name][valIndex];
                    return t<=0?start:t>=1?end: 
                        (/^#|rgb\(/.test(start)) ? // color in format '#rgb' or '#rrggbb' or 'rgb(r,g,b)'?
                                    ('rgb('+ Math.round(smoothInterpolator(getColorComponent(start, i), getColorComponent(end, i++), t, vStart, vEnd)) 
    								+ ',' + Math.round(smoothInterpolator(getColorComponent(start, i), getColorComponent(end, i++), t, vStart, vEnd))
    								+ ',' + Math.round(smoothInterpolator(getColorComponent(start, i), getColorComponent(end, i++), t, vStart, vEnd))
    							    + ')')
    							: 
    								smoothInterpolator(start, end, t, vStart, vEnd);
                })));
			});
		};
	}

    function animateDial(dial, duration, promiseArguments) {
        var prom = promise(); 
        var durationMs = duration || 500;
        var loopStop;

        prom['stop0'] = function() { prom(false); return loopStop(); };

        loopStop = $.loop(function(timePassedMs) {
            dial(timePassedMs/durationMs);
            if (timePassedMs >= durationMs) {
                loopStop();
                prom(true);
            }
        });
        return prom;        
    }


	function smoothAnimate(properties1, properties2, velStart, velEnd, duration) {
        return animateDial(this.smoothDial(properties1, properties2, velStart, velEnd), duration, [this]);
    }



	// timeline-based creation of interpolation functions, using smoothInterpolator. 
	// createInterpolator(listOfKeyFrames)
	// var listOfKeyFrames= [ {t: time0to1, p: position0to1, v: velocity0To1} ]
	//
    function createInterpolator(listOfKeyFrames) {
        var keyFrames = _(listOfKeyFrames).array();
        if (keyFrames [0].t != 0)
            keyFrames.shift({t: 0, p: 0, v: 0});
        if (keyFrames[keyFrames.length-1].t != 1)
            keyFrames.push({t: 1, p: 1, v: 0});
        var fGen =  new Function("start", "d", "t", "subInterpolators",
            "if (t <= 0) return start;\n"+
            "else if (t >= 1) return start+d;\n"+
            _(keyFrames).sub(1).map(function(kf, i) {
                return ' else if (t < '+(kf.t)+') return start+d*subInterpolators['+(i)+'](t);\n';
            }).join('')
        );

        var smoothInterpolators = _(keyFrames).sub(1).map(function(kf2, index) {
            var kf1 = keyFrames[index];
            var d = (kf2.t - kf1.t) || 1;
            return function(t) {
                return smoothInterpolator(kf1.p, kf2.p, (t - kf1.t) / d, kf1.v, kf2.v);
            };
        }).array();

        return function(start, end, t) {
            return fGen(start, end - start, t, smoothInterpolators);
        };
    }


	// TODO: 
	// additional easing functions (http://easings.net/), but based on timelineInterpolator
	// easeInOut (same as default), easeIn, easeOut, elasticEaseIn, elasticEaseOut, elasticEaseInOut
	// easeInBack, easeOutBack, easeInOutBack

	// TODO: keyframe anim
	// two elements:
	//      To create smooth anim:
	//           {keyframe: '#elem', props: {'@x': 34}, wait: 50},                 // animates x to 34. Uses auto-smooth. Next step in 50.
	//           {keyframe: '#elem', props: {'@x': 30}, linear: 1, wait: 10},   // animates x to 30. Linear anim. Next step in 10.
	//           {keyframe: '#elem', props: {'@x': 50}, velocity: {'@x': 2}, wait: 50}, // animates x to 50. Has given velocity at this keyframe. Next step in 50.
	//           {keyframe: '#elem', props: {'@x': 10}, velocityBefore: {'@x': -2}, velocityAfter: {'@x': 2}, wait: 50}, // animates x to 10. Velocity chnages from -2 to 2 instantly.
	//           {keyframe: '#elem', auto: {'@x': null}, wait: 50},  // Uses the initial value for @x as key frame instead of value in props.
	//           {keyframe: '#elem', auto: ['@x'], wait: 50},         // same using array syntax
	//
	//        To end anim:
	//           {keystop: '#elem', props: {'@x': 100}}   // same as {keyframe: '#elem', props: {'@x': 10}, velocity: {'@x': 0}},
	//
	//
	// '#elem' can be anything allowed by $()
	// props are regular set() names
	// wait can be used, optional.
	// base impl on smoothDial() with velocity and dial() without
	// multi-property animation in keyframes (something like <rect transform="rotate(0 30 30)"> to <rect transform="rotate(45 100 100)">)



     // Creates a flexible timeline of events, toggles and animations. It does no impose any specific definition of time - it is suggested to use
     // it with milliseconds, but you could for example also control the time by the y scroll coordinate (see examples).
     //
     // The timeline is defined in a descriptor like this:
     // [                                                     // list of items on the timeline, in the order they have been declared
     //     {wait: 100},                                   // waits for the given amount of time. Blocks timeline (the following items will be executed when finished).
     //     {dial: $('#a').dial({$fade:0},{$fade:1}), wait: 500},  // adds a dial that will be moved from 0 to 500 during the given duration. Blocks timeline.
     //     {dial: $('#b').dial({$fade:0},{$fade:1}), duration: 500},        // the same, but does not block the timeline (the following items will be executed immediately)
     //     {toggle: $('#e').toggle({$fade:0},{$fade:1}, 100), wait: 2000}, // toggle will be called with true on start, and with false when it ends. Blocks timeline.
     //     {toggle: $('#f').toggle({$fade:0},{$fade:1}, 100), duration: 2000},        // the same, but does not block the timeline
     //     {loop: function(t){}, wait: 500},          // callback will be called repeatedly for the duration with t the time in ms since it has been reached
     //     {loop: function(t){}, duration: 500},          // same, but non-blocking
     //     {timeline: timelineDescriptor}            // sub-timeline.
     //     {callback: function(tSinceStart){}} , // simple callback, will be called when reached/passed on timeline.     
     //     {callback: function(tSinceStart){}, forward: false, backward: true} , // the same, but only called when passed going backward. Default is forward and backward.
     //     {dial: $('#g').dial({$fade:0},{$fade:1}), wait: 500, duration: 100},  // combines wait and duration. animates for 100, but blocks for 500
     //     {dial: $('#h').dial({$fade:0},{$fade:1}), duration: 100, repeat: 4},  // repeats the animation 4 times (actual duration is 400ms then)
     //     {dial: $('#h').dial({$fade:0},{$fade:1}), duration: 100, repeat: 'forever'},  // repeats the animation very often (actually 1e6, but not inifitely)
     //     {dial: $('#i').dial({$fade:0},{$fade:1}), duration: 100, repeat: 4, backAndForth: true},  // plays the animation back and forth 4 times (acutal duration 800ms!)
     //     {dial: $('#j').dial({$fade:0},{$fade:1}), duration: 100, repeatMs: 750},  // repeats the animation for 750 ms (will be executed 7.5 times)
     //     // execute several items in parallel. Blocks until all blocking items are done.
     //     [{dial: $('#h').dial({$fade:0},{$fade:1}), wait: 500}, {toggle: $('#i').toggle({$fade:0},{$fade:1}, 100), wait: 2000},]: $('#h').dial({$fade:0},{$fade:1}), wait: 500}, {toggle: $('#i').toggle({$fade:0},{$fade:1}, 100), wait: 2000},]
     // ]
     //
     // repeat, repeatMs and backAndForth are only allowed for dial.
     //
     // Returns a timeline function <code>function(t, stop)</code>:
     //  - t is the time passed since the start in ms,
     //  - stop is an optional function that will be called by the timeline function when it was invoked with t>=duration
     // The timeline can be plugged right into $.loop(), or be used on its own.
     // Call the timeline function without arguments to make it return its duration.
     function timeline(timelineDescriptor) {
          function processItem(tStart, e) {
               if (_.isList(e)) {
                    var ll = _.map(e, function(li) { return processItem(tStart, li); });
                    return [
                         ll.reduce(function(memo, r) { return Math.max(r[0], memo); }, tStart),
                         ll.reduce(function(memo, r) { return Math.max(r[1], memo); }, tStart),
                         ll.map(function(r) { return r[2]; })
                    ];
               }
               else if (_.isFunction(e))
                    return processItem(tStart, {callback: e});
               else {
                    if (e.timeline)
                         e.tTimeline = create(e.timeline);
              var tWait = e.wait || (e.tTimeline && e.tTimeline()) || 0;
              var tBlockingEnd = tStart+tWait ;
              var tDurationPerRun = e.duration != null ? e.duration : tWait;
              var tBackForth = 1+e.backAndForth;
              var tDuration, tActualEnd;
              if (e.repeat != 'forever') {
                   var tRepetitions = e.repeat || (e.repeatMs ? e.repeatMs / tDurationPerRun : 1);
                   tDuration = tDurationPerRun * tBackForth * tRepetitions;
                   tActualEnd = tStart+tDuration;
              }
              else
               tActualEnd = tDuration = null;   
                    return [tBlockingEnd, tActualEnd,
                              _.extend({}, e, {tStart: tStart,
                                        tBlockingEnd: tBlockingEnd,
                                        tActualEnd: tActualEnd, // null if no end
                                        tWait: tWait,
                                        tBackForth: tBackForth,
                                        tDurationPerRun: tDurationPerRun,
                                        tDuration: tDuration, // null if infinite
                                        tForward: e.forward == null ? true : e.forward,
                                        tBackward: e.backward == null ? true : e.backward})];
               }
          }

          // make td a flat list of items, with additional t* properties
          var t = 0;
          var endOfTimeline = 0;
          var td = _.collect(function(e) {
               var r = processItem(t, e);
               t = r[0];
               endOfTimeline = Math.max(endOfTimeline, r[0], r[1] || 0);
               return r[2];
          });

          // create a list of all activations and deactivations that is used to activate/deactivate in the right order
          function createTimeEvent(forward, e) {
               if (forward ? e.tForward : e.tBackward)
                 return [
                   {time: e.tStart, active: forward, item: e},
                   e.tDuration == null ? {time: endOfTimeline, active: !forward, item: e} :
                    e.tDuration > 0 ? {time: e.tActualEnd, active: !forward, item: e} : null
                 ];
          };
          var eventTimeline = td.collect(_.partial(true, createTimeEvent))
                                           .sort(function(a, b) { return a.time - b.time; });
          var reverseTimeline = td.collect(_.partial(false, createTimeEvent))
                                           .sort(function(a, b) { return b.time - a.time; });
   
          var lastT = null;
          return function(t, stop) {
               if (t == null)   // if no arg/no t -> return duration
                    return endOfTimeline;
               if (t == lastT) // no time change -> nothing to do
                    return;
               if (t >= endOfTimeline && lastT != null && lastT >= endOfTimeline) { // animation already ended
                    lastT = t;
                    return;
               }

               var tSpanLast = lastT || 0;
               var tSpanNow = Math.min(t, endOfTimeline);
               var backward = tSpanLast > tSpanNow;
               lastT = t;

               function isInTimeSpan(t) {
                     return backward ? (t < tSpanLast && t >= tSpanNow) : (t > tSpanLast || t <= tSpanNow);
               }
   
               (backward ? reverseTimeline : eventTimeline).each(function(event) {
                    var item = event.item;
                    var relT = tSpanNow - item.tStart;

                    // Regular anim
                    if (t >= item.tStart && t < item.tActualEnd) {
                         if (item.loop)
                              item.loop(relT);
                         if (item.dial && item.tDurationPerRun > 0) {
                    var x = relT / item.tDurationPerRun;
                    item.dial(item.tBackForth == 1 ? x : (x < 0.5 ? x*2 : 2-(2*x) ));
               }
                         if (item.tTimeline)
                              item.tTimeline(relT);
                    }

                    // Activation / Deactivation
                    if (isInTimeSpan(event.time)) {
                         if (event.active) {
                              if (item.toggle && !(isInTimeSpan(item.tActualEnd) && isInTimeSpan(item.tStart)))
                                   item.toggle(true);
                              if (item.callback)
                                  item.callback(tSpanNow);
                         } else {
                              if (item.toggle)
                                   item.toggle(false);
                              if (item.dial)
                                   item.dial(backward ? 0 : (item.tDuration / item.tDurationPerRun % 1));
                         }
                    }
               });
          
               if (t >= endOfTimeline && stop)
                    stop();
          }
     }

     NIAGARA.M.prototype.smoothDial = smoothDial;
     NIAGARA.M.prototype.smoothAnimate = smoothAnimate;
   
     return {
        timeline: timeline,
        animateDial: animateDial 
     };
});





