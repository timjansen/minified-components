define('niagara-animation', function(require) {
  var NIAGARA = require('minified'); 
  var $ = NIAGARA.$, $$ = NIAGARA.$$, EE = NIAGARA.EE, _ = NIAGARA._;

    var ANIM_NODEID = 'NiaAnimID';
    var idSequence = 1;
    function getNodeId(el) {
        return (el[ANIM_NODEID] = (el[ANIM_NODEID] || ++idSequence));
    }


	/*$
	 * Creates an interpolation function that will smoothly interpolate from the given start value and velocity
	 * to the given target value with the given target velocity.
	 * @param start the start value
	 * @param target the target value
	 * @param t the current time 0-1
	 * @param startVelocity the initial velocity (using the units from start and duration)
	 * @param endVelocity the target velocity (using the units from start and duration)
	 */
    function smoothInterpolator(start, end, t, vStart, vEnd) {
        vStart = vStart || 0;
        vEnd = vEnd || 0;
        if (t >= 1)
            return end;
        else if (t < 0)
            return start;
        else
            return start + vStart*t + (3*end-3*start-2*vStart-vEnd)*t*t + (2*start+vStart+vEnd-2*end)*t*t*t;
    }

	// list.smoothDial({state1:0}, {state2:0}, {velocity1:0}, {velocity2: 0} )
	// - if no velocity2, velocity1 is used for beginning and end
	// - if no velocity1, velocity=0 is assumed
	// - supports multi-property animation (like 'rotate(0 30 30)' to 'rotate(45 100 100)'). Velocity is then an array.

	function extractInterpolatable(s) {
        if (_.isNumber(s))
            return [s];
		var nums = [], m;
        var re = /(-?[0-9]+(?:\.[0-9]+)?)|(?:#\w{3}(?:\w{3})?)|(?:rgb\([^\)]+\))/g;
		while (m = re.exec(s))
			nums.push(m[1] ? parseFloat(m[0]) : m[0]);
		return nums;
	}

	function setInterpolatables(s, nums) {
        if (_.isNumber(s))
            return nums[0];
		var i = 0;
		return s.replace(/(?:-?[0-9]+(?:\.[0-9]+)?)|(?:#\w{3}(?:\w{3})?)|(?:rgb\([^\)]+\))/g, function() {
			return nums[i++];
		});
	}

    function extractSingleNumber(v) {
        return parseFloat(v.replace(/^[^\d-]+/, ''));
    }

    function getColorComponent(colorCode, index) {
        return (/^#/.test(colorCode)) ?
            parseInt(colorCode.length > 6 ? colorCode.substr(index*2+1, 2) : ((colorCode=colorCode.charAt(index+1))+colorCode), 16)
        :
            extractSingleNumber(colorCode.split(',')[index]);
    }

    function interpolatePropValue(t, start, end, vStart, vEnd) {
        var i = 0;
        return t<=0?start:t>=1?end: 
                    (/^#|rgb\(/.test(start)) ? // color in format '#rgb' or '#rrggbb' or 'rgb(r,g,b)'?
                                ('rgb('+ Math.round(smoothInterpolator(getColorComponent(start, i), getColorComponent(end, i++), t, vStart, vEnd)) 
                                + ',' + Math.round(smoothInterpolator(getColorComponent(start, i), getColorComponent(end, i++), t, vStart, vEnd))
                                + ',' + Math.round(smoothInterpolator(getColorComponent(start, i), getColorComponent(end, i++), t, vStart, vEnd))
                                + ')')
                            : 
                                smoothInterpolator(start, end, t, vStart, vEnd);
    }

    // internal, for use in keyframe timelines
    function singlePropSmoothDial(listOrSelector, ctx, propertyName, propertyTemplate, startValues, startVelocity, endValues, endVelocity) {
        var isSelector = _.isString(listOrSelector);
        var mList = $(listOrSelector);
        return function(t) {
            var list = isSelector ? $(listOrSelector, ctx) : mList;
            list.set(propertyName, setInterpolatables(propertyTemplate, 
                _.map(startValues, function(start, valIndex) {
                    return interpolatePropValue(t, start, endValues[valIndex], startVelocity[valIndex], endVelocity[valIndex]);
               })));
        };
    }

    // internal, for use in keyframe timelines
    function createDialListFunc(list) {
        return function(t) {
            for (var i = 0, l = list.length; i < l; i++)
                list[i](t);
        };
    }

	function smoothDial(properties1, properties2, velocities1, velocities2) {
		var self = this;

        function getValues(properties) {
            return _.mapObj(properties, function(name, start) {
                return extractInterpolatable(start);
            }); 
        }
        var startValues = getValues(properties1);
        var endValues = getValues(properties2);

        function getVelocities(vmap) {
            return _.mapObj(startValues, function(name, startValues) {
                return _.map(startValues, function(startValue, index) {
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
                self.set(name, setInterpolatables(properties1[name], 
                    _.map(valueList, function(start, valIndex) {
                    return interpolatePropValue(t, start, endValues[name] ? endValues[name][valIndex] : 0, startVelocities[name][valIndex], endVelocities[name][valIndex]);
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

    // returns stop function
    function play(timeline, startPosition, autoLoop, onStop, onChange) {
        var duration = timeline() || 1;
        var running = true, lastT;
        var offset = startPosition || 0;
        function callEvents() {
            if (onStop && !running) onStop();
            if (onChange) onChange(lastT, running, duration);
        }
        var stop = $.loop(function(t, stop) {
            lastT = autoLoop ? ((t+offset) % duration) : Math.min(t+offset, duration);
            timeline(lastT, function() { 
                running = false;  
                stop(); 
            });
            callEvents();
        });
        return function() {
            if (running) {
                running = false;
                stop();
                callEvents();
            }
        };
    }

    // toggle to run/stop an animation
    function playToggle(timeline, resetAfterStop, autoLoop) {
        var state = false;
        var stop, lastT;
        return function(s) {
            if (s === state)
                return;
            if (s === true || s === false)
                state = s;
            else
                state = !state;

            if (state)
                stop = play(timeline, lastT, autoLoop, null, resetAfterStop ? function(t, running) {lastT = running?(t%duration):null;} : null)
            else if (stop)
                stop();
        }
    }



	// timeline-based creation of interpolation functions, using smoothInterpolator. 
	// createInterpolator(listOfKeyFrames)
	// var listOfKeyFrames= [ {t: time0to1, p: position0to1, v: velocity0To1} ]  // v is optional
	//
    function createInterpolator(listOfKeyFrames) {
        var keyFrames = _(listOfKeyFrames).array();
        if (!keyFrames.length || keyFrames [0].t != 0)
            keyFrames.unshift({t: 0, p: 0, v: 0});
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
                return smoothInterpolator(kf1.p, kf2.p, (t - kf1.t) / d, kf1.v*d, kf2.v*d);
            };
        }).array();

        return function(start, end, t) {
            return fGen(start, end - start, t, smoothInterpolators);
        };
    }

    var functionEases = _.mapObj({
        sineOut: function(t) {
            return Math.sin(t*Math.PI/2);
        },
        sineIn: function(t) {
            return 1-Math.sin((1-t)*Math.PI/2);
        },
        sineInOut: function(t) {
            return (1+Math.sin((t+1.5)*Math.PI))/2;
        },
        sineSwingUp: function(t) {
            return t+0.25*Math.sin(t*2*Math.PI);
        },
        sineSwingDown: function(t) {
            return t-0.25*Math.sin(t*2*Math.PI);
        }
    }, function(name, f) {
        return function (start, end, t) {
            if (t<=0) return start;
            else if (t >= 1) return end;
            else return start + f(t)*(end-start);
        }
    });
    var constructedEases = _.mapObj({
        linear: [{t: 0, p: 0, v: 1}, {t: 1, p: 1, v: 1}],
        inOut: [],
        in: [{t: 1, p: 1, v: 1}],
        out: [{t: 0, p: 0, v: 1}],
        softInSoftOut: [{t: 0.5, p: 0.5, v: 2.5}],
        softInOut: [{t: 0.7, p: 0.5, v: 2}],
        inSoftOut: [{t: 0.3, p: 0.5, v: 2}],
        softIn: [{t: 0.7, p: 0.4, v: 1.5}, {t: 1, p: 1, v: 1}],
        softOut: [{t: 0, p: 0, v: 1}, {t: 0.3, p: 0.6, v: 1.5}],
        stop: [{t: 0, p: 0, v: 1}, {t: 0.5, p: 0.5, v: 0}, {t: 1, p: 1, v: 1}],
        inSwing: [{t: 0.3, p: -0.1, v: 0}, {t: 1, p: 1, v: 1}],
        outSwing: [{t: 0, p: 0, v: 1}, {t: 0.7, p: 1.1, v: 0}],
        inOutSwing: [{t: 0.25, p: -0.1, v: 0}, {t: 0.75, p: 1.1, v: 0}],
        inElastic: [{t: 0.1, p: -0.05, v: 0}, {t: 0.3, p: 0.15, v: 0}, {t: 0.5, p: -0.25, v: 0}, {t: 1, p: 1, v: 3}],
        outElastic: [{t: 0, p: 0, v: 3}, {t: 0.5, p: 1.25, v: 0}, {t: 0.7, p: 0.85, v: 0}, {t: 0.9, p: 1.05, v: 0}, ],
        inOutElastic: [{t: 0.1, p: -0.05, v: 0}, {t: 0.2, p: 0.1, v: 0}, {t: 0.3, p: -0.2, v: 0},  {t: 0.7, p: 1.2, v: 0},  {t: 0.8, p: 0.9, v: 0}, {t: 0.9, p: 1.05, v: 0}],
        bounce: [{t: 00, p: 0, v: 0.25},
            {t: 0.125, p: 0.125, v: 0}, {t: 0.249999999, p: 0, v: -0.25},  {t: 0.25, p: 0, v: 0.5},
            {t: 0.375, p: 0.25, v: 0},  {t: 0.499999999, p: 0, v: -0.5},  {t: 0.5, p: 0, v: 1},
            {t: 0.625, p: 0.5, v: 0},   {t: 0.749999999, p: 0, v: -1},  {t: 0.75, p: 0, v: 5}]
    }, function(name, def) { return createInterpolator(def); });

    var ease = _.extend(constructedEases,  functionEases);


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
     //     {show: '#invisible', hide: '#visible'},                                   // shows/hides elements using show()/hide(). Can be used everywhere.
     //     // execute several items in parallel. Blocks until all blocking items are done.
     //     [{dial: $('#h').dial({$fade:0},{$fade:1}), wait: 500}, {toggle: $('#i').toggle({$fade:0},{$fade:1}, 100), wait: 2000},]: $('#h').dial({$fade:0},{$fade:1}), wait: 500}, {toggle: $('#i').toggle({$fade:0},{$fade:1}, 100), wait: 2000}],
     //     {keyframe: '.elem', props: {'@x': 34}, wait: 50},                      // keyframe animation: animates x to 34. Uses auto-smooth. Next step in 50.
     //     {keyframe: '.elem', props: {'@x': 55}, start: 61, wait: 10},           // keyframe animation: absolute positioning. Next element in 10.
     //     {keyframe: '.elem', props: {'@x': 30}, linear: true, wait: 10},        // animates x to 30. Linear anim. Next step in 10.
     //     {keyframe: '.elem', props: {'@x': 50}, velocity: {'@x': 2}, wait: 50}, // animates x to 50. Has given velocity at this keyframe. Next step in 50.
     //     {keyframe: '.elem', props: {'@x': 10}, velocityBefore: {'@x': -2}, velocityAfter: {'@x': 2}, wait: 50}, // animates x to 10. Velocity changes from -2 to 2 instantly.
     //     {keyframe: '#elem', auto: ['@x'], wait: 50},                           // Uses the initial value for @x as key frame instead of value in props.
     //     {keystop: '.elem', props: {'@x': 100}},                                // same as {keyframe: '#elem', props: {'@x': 10}, velocity: {'@x': 0}},
     //     {add: function(ctx) { return EE('div', {$:'myBlock'}); }},             // adds the element to the context at the given time
     //     {add: HTML('<div class="myBlock'></div>}),                             // adds the element to the context at the given time. Null/empty list to not add anything.
     //     {remove: '.myBlock'},                                                  // removed the element(s) at the time
     //     {remove: function(ctx) { return $('.myBlock').only(3);}},              // uses a function to determine the element(s). Return null or empty list to not delete anything.
     // ]
     //
     // Each entry can have only either keyframe, dial, toggle, loop, timeline or callback. 
     // show, hide, add and remove can be combined with any of the elements above and with each other, but will also work stand-alone.
     // repeat, repeatMs and backAndForth are only allowed for dial.
     //
     // Returns a timeline function <code>function(t, stop)</code>:
     //  - t is the time passed since the start in ms,
     //  - stop is an optional function that will be called by the timeline function when it was invoked with t>=duration
     // The timeline can be plugged right into $.loop(), or be used on its own.
     // Call the timeline function without arguments to make it return its duration.
     function timeline(ctx, timelineDescriptor) {
        if (!timelineDescriptor)
            return timeline(null, ctx);

        function processItem(prevBlockingEnd, e) {
            if (_.isList(e)) {
                if (!e.length)
                    return null;
                var blockingEnd = prevBlockingEnd;
                var ll = _.map(e, function(li) { 
                    var p = processItem(prevBlockingEnd, li);
                    blockingEnd = Math.max(blockingEnd, p.tBlockingEnd);
                    p.tBlockingEnd = prevBlockingEnd;
                    return p;
                });
                ll[ll.length-1].tBlockingEnd = blockingEnd;
                return ll;
            }
            else if (_.isFunction(e))
                return processItem(prevBlockingEnd, {callback: e});
            else { 
                if (e.timeline)
                    e.tTimeline = _.isFunction(e.timeline) ? e.timeline : timeline(e.timeline);
                var tStart = e.start != null ? e.start : prevBlockingEnd;
                var tWait = e.wait || (e.tTimeline && e.tTimeline()) || 0;
                var tBlockingEnd = tStart+tWait ;
                var tDurationPerRun = e.duration != null ? e.duration : tWait;
                var tBackForth = 1+(e.backAndForth||0);
                var tDuration;
                if (!(e.loop || e.tTimeline || e.dial || e.toggle)) {
                    tDuration = tDurationPerRun = 0;
                }
                else if (e.repeat != 'forever') {
                    var tRepetitions = e.repeat || (e.repeatMs ? e.repeatMs / tDurationPerRun : 1);
                    tDuration = tDurationPerRun * tRepetitions;
                }
                else
                    tDuration = null;   
                return _.extend({}, e, {
                    tStart: tStart,
                    tBlockingEnd: tBlockingEnd,
                    tBackForth: tBackForth,
                    tDurationPerRun: tDurationPerRun,
                    tDuration: tDuration, // null if infinite
                    tForward: e.forward == null ? true : e.forward,
                    tBackward: e.backward == null ? true : e.backward,
                    tContent: !!(e.loop || e.timeline || e.dial || e.toggle || e.callback || e.show || e.hide || e.add || e.remove),
                    tKeyFrame: !!(e.keyframe || e.keystop),
                    tNoDeactivation: !!e.loop,
                    tNoDeactivationBack: !!e.loop
                });
            }
        }

        function processKeyFramesItems(items) {
            var keyframePos = {}; // (selector or nodeId) -> property -> {kf: keyFrame, prevTime: 0, item: item, values: valArray, preValues: valArray}
            function processKeyFrame(kf) {
                var kfTarget = kf.keyframe || kf.keystop;
                var stopFrame = !!kf.keystop;

                function processProps(targetKey) {
                    var newItems = [];
                    var autoProps = {};
                    var target = keyframePos[targetKey];
                    if (!target)
                        target = keyframePos[targetKey] = {};

                    _.each(kf.auto, function(propName) {
                        autoProps[propName] = $(kfTarget, ctx).get(propName);
                    });
                    function processProperty(propName, propValueS) {
                        var propEntry = target[propName];
                        var newValues = extractInterpolatable(propValueS);
                        if (propEntry == null) // 1st keyframe for the property
                            target[propName] = {kf: kf, values: newValues};
                        else {
                            function readVelocity(velocityObj, propName) {
                                if (_.isObject(velocityObj) && !_.isList(velocityObj))
                                    return velocityObj[propName] != null ? _(velocityObj[propName]) : null;
                                else
                                    return velocityObj != null ? _(velocityObj) : null;

                            }

                            var tDuration = kf.tStart - propEntry.kf.tStart;
                            var tLinear = !!propEntry.kf.linear;
                            var vv, veloStartUserSet, veloStart = [0], veloEndUserSet, veloEnd = [0];
                            if (propEntry.prevLinear) {
                                veloStart = propEntry.item.tVeloEnd;
                                veloStartUserSet = true;
                            }
                            if ((vv = readVelocity(propEntry.kf.velocity, propName)) != null) {
                                veloStart = vv;
                                veloStartUserSet = true;
                            }
                            if ((vv = readVelocity(propEntry.kf.velocityAfter, propName)) != null) {
                                veloStart = vv;
                                veloStartUserSet = true;
                            }
                            if ((vv = readVelocity(kf.velocity, propName)) != null) {
                                veloEnd = vv;
                                veloEndUserSet = true;
                            }
                            if ((vv = readVelocity(kf.velocityBefore, propName)) != null) {
                                veloEnd = vv;
                                veloEndUserSet = true;
                            }

                            if (propEntry.kf.linear) {
                                var d = tDuration || 1;
                                var v = _.map(propEntry.values, function(val, index) {
                                    return (newValues[index] - val) / d;
                                });
                                veloStart = veloEnd = v;
                                veloStartUserSet = veloEndUserSet = true;

                                if (propEntry.item && !propEntry.item.tVeloEndUserSet)
                                    propEntry.item.tVeloEnd = v;
                            }
                            else if (propEntry.preValues != null) { // >= 3rd keyframe: correct velocity of PREVIOUS entry and use as start for this entry
                                var d = (kf.tStart - propEntry.prevTime) || 1;
                                var v = _.map(propEntry.preValues, function(val, index) {
                                    return (newValues[index] - val) / d;
                                });                                
                                if (!propEntry.item.tVeloEndUserSet)
                                    propEntry.item.tVeloEnd = v;
                                if (!veloStartUserSet)
                                    veloStart = v;
                                propEntry.item.tNoDeactivation = true;
                            }
                            var newItem = {tStart: propEntry.kf.tStart, tDuration: tDuration, tTarget: kfTarget, 
                                tPropName: propName, tPropTemplate: propValueS, tFrom: propEntry.values, tTo: newValues,
                                tVeloStart: veloStart, tVeloEnd: veloEnd, 
                                tVeloStartUserSet: veloStartUserSet, tVeloEndUserSet: veloEndUserSet,
                                tNoDeactivationBack: propEntry.preValues != null, tLinear: tLinear};
                            propEntry.prevTime = propEntry.kf.tStart;
                            propEntry.preValues = propEntry.values;
                            propEntry.prevLinear = propEntry.kf.linear;
                            propEntry.values = newValues;
                            propEntry.item = newItem;
                            propEntry.kf = kf;
                            newItems.push(newItem);

                            if (stopFrame)
                                delete target[propName];
                        }
                    }
                    _.eachObj(autoProps, processProperty);
                    _.eachObj(kf.props, processProperty);
                    return newItems;
                }
                if (_.isString(kfTarget))
                    return processProps(kfTarget);
                else
                    return $(kfTarget, ctx).collect(processProps);
            }

            if (!items.length)
                return;

            var sortedItems = items.sort(function(a, b) { return a.tStart - b.tStart; });
            var itemMap = {}; // tStart -> tDuration -> tNoDeactivationBack -> []
            _.collect(sortedItems, processKeyFrame).each(function(item) {
                var tStart = item.tStart, tDuration = item.tDuration, tNoDeactivationBack = item.tNoDeactivationBack;
                if (!itemMap[tStart])
                    itemMap[tStart] = {};
                if (!itemMap[tStart][tDuration])
                    itemMap[tStart][tDuration] = {};
                if (!itemMap[tStart][tDuration][tNoDeactivationBack])
                    itemMap[tStart][tDuration][tNoDeactivationBack] = [item];
                else
                    itemMap[tStart][tDuration][tNoDeactivationBack].push(item);
            });
            var optimizedItems = [];
            _.eachObj(itemMap, function(tStart, itemMapBytStart) {
                _.eachObj(itemMapBytStart, function(tDuration, itemMapBytDuration) {
                    _.eachObj(itemMapBytDuration, function(tNoDeactivationBack, itemList) {
                        var it = itemList[0];
                        var newItem = {tStart: it.tStart, tDuration: it.tDuration, tNoDeactivationBack: it.tNoDeactivationBack,
                                tBlockingEnd: it.tStart, tBackForth: 1, tDurationPerRun: it.tDuration, tForward: true, tBackward: true, tContent: true
                        };
                        if (itemList.length == 1) {
                            newItem.dial = singlePropSmoothDial(it.tTarget, ctx, it.tPropName, it.tPropTemplate, it.tFrom, it.tVeloStart, it.tTo, it.tVeloEnd);
                        }
                        else {
                            var dialList = _.map(it, function(item) {
                                return singlePropSmoothDial(it.tTarget, ctx, it.tPropName, it.tPropTemplate, it.tFrom, it.tVeloStart, it.tTo, it.tVeloEnd);
                            });
                            newItem.dial = createDialListFunc(dialList); // external func to prevent closure
                        }
                        optimizedItems.push(newItem);
                    });

                });
            });
            return optimizedItems;
        }

        // make td a flat list of items, with additional t* properties 
        var endOfTimeline = 0;
        var prevBlockingEnd = 0;
        var keyframeItems = [];
        var td = _.collect(timelineDescriptor, function(e) {
            return _(processItem(prevBlockingEnd, e)).collect(function(r) {
                endOfTimeline = Math.max(endOfTimeline, r.tBlockingEnd, r.tDuration != null ? r.tStart+r.tDuration : 0);
                prevBlockingEnd = r.tBlockingEnd;
                if (r.tKeyFrame) {
                    keyframeItems.push(r);
                    if (r.show || r.hide || r.add || r.remove) 
                        return {show: r.show, hide: r.hide, add: r.add, remove: r.remove, tStart: r.tStart, tDuration: 0, tForward: true, tBackward: true};
                    else
                        return null;
                }
                return r.tContent ? r : null;
            });
        });
        var extraKfItems = processKeyFramesItems(keyframeItems);
        if (extraKfItems)
            td = _(td, extraKfItems);
        

        // create a list of all activations and deactivations that is used to activate/deactivate in the right order
        function createTimeEvent(forward, e) {
            if (forward ? e.tForward : e.tBackward) {
                if (e.tDuration == null && !e.tNoDeactivation)
                    return [{time: e.tStart, forwardActive: forward, item: e}, {time: endOfTimeline, forwardActive: !forward, item: e}];
                else if (e.tDuration > 0 && !e.tNoDeactivation)
                    return [{time: e.tStart, forwardActive: forward, item: e}, {time: e.tStart+e.tDuration, forwardActive: !forward, item: e}];
                else
                    return {time: e.tStart, forwardActive: true, item: e};
            }
        };

        var eventTimeline = td.collect(_.partial(createTimeEvent, [true])).sort(function(a, b) { return a.time - b.time; });
        var reverseTimeline = td.collect(_.partial(createTimeEvent, [false])).sort(function(a, b) { return b.time - a.time; });

       
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

            var tSpanLast = lastT  == null ? -1 : lastT;
            var tSpanNow = Math.min(t, endOfTimeline);
            var backward = tSpanLast > tSpanNow;
            lastT = t;
            function isInTimeSpan(t0) {
                return backward ? (t0 < tSpanLast && t0 >= tSpanNow) : (t0 > tSpanLast && t0 <= tSpanNow);
            }

            (backward ? reverseTimeline : eventTimeline).each(function(event, index) {
                var item = event.item;
                var relT = tSpanNow - item.tStart;

                var itemDuration = item.tDuration != null ? item.tDuration : endOfTimeline - item.tStart;
                var itemEnd = item.tDuration != null ? item.tStart+item.tDuration : endOfTimeline;
                var itemIsRunnable = item.loop || item.dial || item.tTimeline; 
                var itemInProgress = itemIsRunnable && itemDuration > 0 && t >= item.tStart && t < itemEnd;
                var eventInTimeSpan = isInTimeSpan(event.time);
                var jumpedOverEvent = backward ? isInTimeSpan(item.tStart) : isInTimeSpan(itemEnd);
                if (eventInTimeSpan) {
                    if (item.add && !backward)
                        $(ctx).add(item.tAddedElements = (_.isFunction(item.add) ? item.add(ctx) : item.add));
                    if (item.remove && backward)
                        $(ctx).add(item.tRemovedElements);
                    if (item.show && !backward)
                        $(item.show, ctx).show();
                    if (item.hide && backward)
                        $(item.hide, ctx).show();

                    if (!itemInProgress && !(backward ? item.tNoDeactivationBack : item.tNoDeactivation)) {
                        if (event.forwardActive) {
                            if (item.toggle && !jumpedOverEvent)
                                item.toggle(true);
                            if (item.callback)
                                item.callback(tSpanNow, !backward);
                        } 
                        else {
                            if (item.toggle)
                                item.toggle(false);
                            if (item.dial) {
                                if (item.tBackForth <= 1)
                                    item.dial(backward ? 0 : (item.tDurationPerRun > 0 && itemDuration % item.tDurationPerRun == 0) ? 1 :
                                        (itemDuration % item.tDurationPerRun / item.tDurationPerRun));
                                else {
                                    var x = backward ? 0 : (item.tDurationPerRun > 0 && itemDuration % (2*item.tDurationPerRun) == 1) ? 1 :
                                        (itemDuration % (2*item.tDurationPerRun) / item.tDurationPerRun);
                                    item.dial(x < 1 ? x : 2-x);
                                }

                            }
                            if (item.tTimeline)
                                item.tTimeline(backward ? 0 : itemDuration);
                        }
                    }
                }
                // Regular anim
                if (itemInProgress && event.forwardActive) {
                    if (item.loop)
                        item.loop(relT);
                    if (item.dial) {
                        if (item.tBackForth <= 1)
                            item.dial(relT == itemDuration ? 1 : relT / item.tDurationPerRun % 1);
                        else {
                            var x = relT == itemDuration ? 1 : relT / item.tDurationPerRun % 2;
                            item.dial(x < 1 ? x : 2-x);
                        }
                        
                    }
                    if (item.tTimeline)
                        item.tTimeline(relT);
                }
                if (eventInTimeSpan) {
                    if (item.hide && !backward && event.forwardActive)
                        $(item.hide, ctx).hide();
                    if (item.show && backward)
                        $(item.show, ctx).hide();
                    if (item.remove && !backward)
                        (item.tRemovedElements = $(_.isFunction(item.remove) ? item.remove(ctx) : item.remove)).remove();
                    if (item.add && backward)
                        $(item.tAddedElements).remove();
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
        animateDial: animateDial ,
        smoothInterpolator: smoothInterpolator,
        createInterpolator: createInterpolator,
        ease: ease,
        play: play,
        playToggle: playToggle
     };
});





