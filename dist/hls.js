(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hls = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);
    
    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        if (cache[key].exports === fn) {
            wkey = key;
            break;
        }
    }
    
    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
    
    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'],'require(' + stringify(wkey) + ')(self)'),
        scache
    ];
    
    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;
    
    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
    
    return new Worker(URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],3:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * buffer controller
 *
 */

var Event = _interopRequire(require("../events"));

var FragmentLoader = _interopRequire(require("../loader/fragment-loader"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var Demuxer = _interopRequire(require("../demux/demuxer"));

var STARTING = -1;
var IDLE = 0;
var LOADING = 1;
var WAITING_LEVEL = 2;
var PARSING = 3;
var PARSED = 4;
var APPENDING = 5;

var BufferController = (function () {
  function BufferController(levelController) {
    this.levelController = levelController;
    this.fragmentLoader = new FragmentLoader();
    this.mp4segments = [];
    // Source Buffer listeners
    this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
    this.onsbe = this.onSourceBufferError.bind(this);
    // internal listeners
    this.onmse = this.onMSEAttached.bind(this);
    this.onmp = this.onManifestParsed.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfpg = this.onFragmentParsing.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.ontick = this.tick.bind(this);
    observer.on(Event.MSE_ATTACHED, this.onmse);
    observer.on(Event.MANIFEST_PARSED, this.onmp);
    this.demuxer = new Demuxer();
  }

  _prototypeProperties(BufferController, null, {
    destroy: {
      value: function destroy() {
        this.stop();
        this.fragmentLoader.destroy();
        if (this.demuxer) {
          this.demuxer.destroy();
          this.demuxer = null;
        }
        this.mp4segments = [];
        var sb = this.sourceBuffer;
        if (sb) {
          if (sb.audio) {
            //detach sourcebuffer from Media Source
            this.mediaSource.removeSourceBuffer(sb.audio);
            sb.audio.removeEventListener("updateend", this.onsbue);
            sb.audio.removeEventListener("error", this.onsbe);
          }
          if (sb.video) {
            //detach sourcebuffer from Media Source
            this.mediaSource.removeSourceBuffer(sb.video);
            sb.video.removeEventListener("updateend", this.onsbue);
            sb.video.removeEventListener("error", this.onsbe);
          }
          this.sourceBuffer = null;
        }
        observer.removeListener(Event.MANIFEST_PARSED, this.onmp);
        // remove video listener
        this.video.removeEventListener("seeking", this.onvseeking);
        this.video.removeEventListener("loadedmetadata", this.onvmetadata);
        this.onvseeking = null;
        this.onvmetadata = null;
        this.state = IDLE;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    start: {
      value: function start() {
        this.stop();
        this.timer = setInterval(this.ontick, 100);
        observer.on(Event.FRAG_LOADED, this.onfl);
        observer.on(Event.FRAG_PARSING_INIT_SEGMENT, this.onis);
        observer.on(Event.FRAG_PARSING_DATA, this.onfpg);
        observer.on(Event.FRAG_PARSED, this.onfp);
        observer.on(Event.LEVEL_LOADED, this.onll);
        this.state = STARTING;
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stop: {
      value: function stop() {
        if (this.timer) {
          clearInterval(this.timer);
        }
        this.timer = undefined;
        observer.removeListener(Event.FRAG_LOADED, this.onfl);
        observer.removeListener(Event.FRAG_PARSED, this.onfp);
        observer.removeListener(Event.FRAG_PARSING_DATA, this.onfpg);
        observer.removeListener(Event.LEVEL_LOADED, this.onll);
        observer.removeListener(Event.FRAG_PARSING_INIT_SEGMENT, this.onis);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tick: {
      value: function tick() {
        var pos, loadLevel, loadLevelDetails, fragIdx;
        switch (this.state) {
          case STARTING:
            // determine load level
            this.startLevel = this.levelController.startLevel;
            if (this.startLevel === -1) {
              // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
              this.startLevel = 0;
              this.fragmentBitrateTest = true;
            }
            // set new level to playlist loader : this will trigger start level load
            this.levelController.level = this.startLevel;
            this.state = WAITING_LEVEL;
            this.loadedmetadata = false;
            return;
          case IDLE:
            // determine next candidate fragment to be loaded, based on current position and
            //  end of buffer position
            //  ensure 60s of buffer upfront
            // if we have not yet loaded any fragment, start loading from start position
            if (this.loadedmetadata) {
              pos = this.video.currentTime;
            } else {
              pos = this.nextLoadPosition;
            }
            // determine next load level
            if (this.startFragmentLoaded === false) {
              loadLevel = this.startLevel;
            } else {
              // we are not at playback start, get next load level from level Controller
              loadLevel = this.levelController.nextLevel();
            }
            var bufferInfo = this.bufferInfo(pos),
                bufferLen = bufferInfo.len,
                bufferEnd = bufferInfo.end;
            // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
            var maxBufLen = Math.min(8 * 60 * 1000 * 1000 / this.levels[loadLevel].bitrate, 30);
            // if buffer length is less than maxBufLen try to load a new fragment
            if (bufferLen < maxBufLen) {
              if (loadLevel !== this.level) {
                // set new level to playlist loader : this will trigger a playlist load if needed
                this.levelController.level = loadLevel;
                // tell demuxer that we will switch level (this will force init segment to be regenerated)
                if (this.demuxer) {
                  this.demuxer.switchLevel();
                }
              }
              loadLevelDetails = this.levels[loadLevel].details;
              // if level details retrieved yet, switch state and wait for level retrieval
              if (typeof loadLevelDetails === "undefined") {
                this.state = WAITING_LEVEL;
                return;
              }
              // find fragment index, contiguous with end of buffer position
              var fragments = loadLevelDetails.fragments,
                  frag,
                  sliding = loadLevelDetails.sliding,
                  start = fragments[0].start + sliding;
              // check if requested position is within seekable boundaries :
              // in case of live playlist we need to ensure that requested position is not located before playlist start
              if (bufferEnd < start) {
                logger.log("requested position:" + bufferEnd + " is before start of playlist, reset video position to start:" + start);
                this.video.currentTime = start + 0.01;
                return;
              }
              // if one buffer range, load next SN
              if (bufferLen > 0 && this.video.buffered.length === 1) {
                fragIdx = this.frag.sn + 1 - fragments[0].sn;
                if (fragIdx >= fragments.length) {
                  // most certainly live playlist is outdated, let's move to WAITING LEVEL state and come back once it will have been refreshed
                  //logger.log('sn ' + (this.frag.sn + 1) + ' out of range, wait for live playlist update');
                  this.state = WAITING_LEVEL;
                  return;
                }
                frag = fragments[fragIdx];
              } else {
                // no data buffered, or multiple buffer range look for fragments matching with current play position
                for (fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
                  frag = fragments[fragIdx];
                  start = frag.start + sliding;
                  // offset should be within fragment boundary
                  if (start <= bufferEnd && start + frag.duration > bufferEnd) {
                    break;
                  }
                }
                //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
              }
              if (fragIdx >= 0 && fragIdx < fragments.length) {
                if (this.frag && frag.sn === this.frag.sn) {
                  if (fragIdx === fragments.length - 1) {
                    // we are at the end of the playlist and we already loaded last fragment, don't do anything
                    return;
                  } else {
                    frag = fragments[fragIdx + 1];
                    logger.log("SN just loaded, load next one:" + frag.sn);
                  }
                }
                logger.log("Loading       " + frag.sn + " of [" + fragments[0].sn + "," + fragments[fragments.length - 1].sn + "],level " + loadLevel);
                //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));

                this.frag = frag;
                this.level = loadLevel;
                this.fragmentLoader.load(frag, loadLevel);
                this.state = LOADING;
              }
            }
            break;
          case LOADING:
          // nothing to do, wait for fragment retrieval
          case WAITING_LEVEL:
          // nothing to do, wait for level retrieval
          case PARSING:
            // nothing to do, wait for fragment being parsed
            break;
          case PARSED:
          case APPENDING:
            if (this.sourceBuffer) {
              // if MP4 segment appending in progress nothing to do
              if (this.sourceBuffer.audio && this.sourceBuffer.audio.updating || this.sourceBuffer.video && this.sourceBuffer.video.updating) {} else if (this.mp4segments.length) {
                var segment = this.mp4segments.shift();
                this.sourceBuffer[segment.type].appendBuffer(segment.data);
                this.state = APPENDING;
              }
            }
            break;
          default:
            break;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    bufferInfo: {
      value: function bufferInfo(pos) {
        var v = this.video,
            buffered = v.buffered,
            bufferLen,

        // bufferStart and bufferEnd are buffer boundaries around current video position
        bufferStart,
            bufferEnd,
            i;
        var buffered2 = [];
        // there might be some small holes between buffer time range
        // consider that holes smaller than 300 ms are irrelevant and build another
        // buffer time range representations that discards those holes
        for (i = 0; i < buffered.length; i++) {
          //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
          if (buffered2.length && buffered.start(i) - buffered2[buffered2.length - 1].end < 0.3) {
            buffered2[buffered2.length - 1].end = buffered.end(i);
          } else {
            buffered2.push({ start: buffered.start(i), end: buffered.end(i) });
          }
        }

        for (i = 0, bufferLen = 0, bufferStart = bufferEnd = pos; i < buffered2.length; i++) {
          //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
          if (pos + 0.3 >= buffered2[i].start && pos < buffered2[i].end) {
            // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
            bufferStart = buffered2[i].start;
            bufferEnd = buffered2[i].end + 0.3;
            bufferLen = bufferEnd - pos;
          }
        }
        return { len: bufferLen, start: bufferStart, end: bufferEnd };
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMSEAttached: {
      value: function onMSEAttached(event, data) {
        this.video = data.video;
        this.mediaSource = data.mediaSource;
        this.onvseeking = this.onVideoSeeking.bind(this);
        this.onvmetadata = this.onVideoMetadata.bind(this);
        this.video.addEventListener("seeking", this.onvseeking);
        this.video.addEventListener("loadedmetadata", this.onvmetadata);
        if (this.levels) {
          this.start();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoSeeking: {
      value: function onVideoSeeking() {
        if (this.state === LOADING) {
          // check if currently loaded fragment is inside buffer.
          //if outside, cancel fragment loading, otherwise do nothing
          if (this.bufferInfo(this.video.currentTime).len === 0) {
            logger.log("seeking outside of buffer while fragment load in progress, cancel fragment load");
            this.fragmentLoader.abort();
            this.state = IDLE;
          }
        }
        // tick to speed up processing
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoMetadata: {
      value: function onVideoMetadata() {
        if (this.video.currentTime !== this.startPosition) {
          this.video.currentTime = this.startPosition;
        }
        this.loadedmetadata = true;
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onManifestParsed: {
      value: function onManifestParsed(event, data) {
        this.audiocodecswitch = data.audiocodecswitch;
        if (this.audiocodecswitch) {
          logger.log("both AAC/HE-AAC audio found in levels; declaring audio codec as HE-AAC");
        }
        this.levels = data.levels;
        this.startLevelLoaded = false;
        this.startFragmentLoaded = false;
        if (this.video) {
          this.start();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onLevelLoaded: {
      value: function onLevelLoaded(event, data) {
        var fragments = data.details.fragments,
            duration = data.details.totalduration;
        logger.log("level " + data.levelId + " loaded [" + fragments[0].sn + "," + fragments[fragments.length - 1].sn + "],duration:" + duration);

        var level = this.levels[data.levelId],
            sliding = 0,
            levelCurrent = this.levels[this.level];
        // check if playlist is already loaded (if yes, it should be a live playlist)
        if (levelCurrent && levelCurrent.details && levelCurrent.details.live) {
          //  playlist sliding is the sum of : current playlist sliding + sliding of new playlist compared to current one
          sliding = levelCurrent.details.sliding;
          // check sliding of updated playlist against current one :
          // and find its position in current playlist
          //logger.log("fragments[0].sn/this.level/levelCurrent.details.fragments[0].sn:" + fragments[0].sn + "/" + this.level + "/" + levelCurrent.details.fragments[0].sn);
          var SNdiff = fragments[0].sn - levelCurrent.details.fragments[0].sn;
          if (SNdiff >= 0) {
            // positive sliding : new playlist sliding window is after previous one
            sliding += levelCurrent.details.fragments[SNdiff].start;
          } else {
            // negative sliding: new playlist sliding window is before previous one
            sliding -= fragments[-SNdiff].start;
          }
          logger.log("live playlist sliding:" + sliding.toFixed(3));
        }
        // override level info
        level.details = data.details;
        level.details.sliding = sliding;
        this.demuxer.setDuration(duration);
        if (this.startLevelLoaded === false) {
          // if live playlist, set start position to be fragment N-3
          if (data.details.live) {
            this.startPosition = Math.max(0, duration - 3 * data.details.targetduration);
          } else {
            this.startPosition = 0;
          }
          this.nextLoadPosition = this.startPosition;
          this.startLevelLoaded = true;
        }
        // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
        if (this.state === WAITING_LEVEL) {
          this.state = IDLE;
        }
        //trigger handler right now
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentLoaded: {
      value: function onFragmentLoaded(event, data) {
        if (this.state === LOADING) {
          if (this.fragmentBitrateTest === true) {
            // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
            this.state = IDLE;
            this.fragmentBitrateTest = false;
            data.stats.tparsed = data.stats.tbuffered = new Date();
            observer.trigger(Event.FRAG_BUFFERED, { stats: data.stats, frag: this.frag });
            this.frag = null;
          } else {
            this.state = PARSING;
            // transmux the MPEG-TS data to ISO-BMFF segments
            this.stats = data.stats;
            this.demuxer.push(data.payload, this.levels[this.level].audioCodec, this.levels[this.level].videoCodec, this.frag.start);
          }
          this.startFragmentLoaded = true;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onInitSegment: {
      value: function onInitSegment(event, data) {
        // check if codecs have been explicitely defined in the master playlist for this level;
        // if yes use these ones instead of the ones parsed from the demux
        var audioCodec = this.levels[this.level].audioCodec,
            videoCodec = this.levels[this.level].videoCodec,
            sb;
        //logger.log('playlist level A/V codecs:' + audioCodec + ',' + videoCodec);
        //logger.log('playlist codecs:' + codec);
        // if playlist does not specify codecs, use codecs found while parsing fragment
        if (audioCodec === undefined) {
          audioCodec = data.audioCodec;
        }
        if (videoCodec === undefined) {
          videoCodec = data.videoCodec;
        }

        // codec="mp4a.40.5,avc1.420016";
        // in case several audio codecs might be used, force HE-AAC for audio (some browsers don't support audio codec switch)
        //don't do it for mono streams ...
        if (this.audiocodecswitch && data.audioChannelCount === 2 && navigator.userAgent.toLowerCase().indexOf("android") === -1 && navigator.userAgent.toLowerCase().indexOf("firefox") === -1) {
          audioCodec = "mp4a.40.5";
        }
        if (!this.sourceBuffer) {
          this.sourceBuffer = {};
          logger.log("selected A/V codecs for sourceBuffers:" + audioCodec + "," + videoCodec);
          // create source Buffer and link them to MediaSource
          if (audioCodec) {
            sb = this.sourceBuffer.audio = this.mediaSource.addSourceBuffer("video/mp4;codecs=" + audioCodec);
            sb.addEventListener("updateend", this.onsbue);
            sb.addEventListener("error", this.onsbe);
          }
          if (videoCodec) {
            sb = this.sourceBuffer.video = this.mediaSource.addSourceBuffer("video/mp4;codecs=" + videoCodec);
            sb.addEventListener("updateend", this.onsbue);
            sb.addEventListener("error", this.onsbe);
          }
        }
        if (audioCodec) {
          this.mp4segments.push({ type: "audio", data: data.audioMoov });
        }
        if (videoCodec) {
          this.mp4segments.push({ type: "video", data: data.videoMoov });
        }
        //trigger handler right now
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentParsing: {
      value: function onFragmentParsing(event, data) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level];
        if (level.details.live) {
          level.details.sliding = data.startPTS - this.frag.start;
        }
        logger.log("      parsed data, type/startPTS/endPTS/startDTS/endDTS/sliding:" + data.type + "/" + data.startPTS.toFixed(3) + "/" + data.endPTS.toFixed(3) + "/" + data.startDTS.toFixed(3) + "/" + data.endDTS.toFixed(3) + "/" + level.details.sliding.toFixed(3));
        this.mp4segments.push({ type: data.type, data: data.moof });
        this.mp4segments.push({ type: data.type, data: data.mdat });
        this.nextLoadPosition = data.endPTS;
        //trigger handler right now
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentParsed: {
      value: function onFragmentParsed() {
        this.state = PARSED;
        this.stats.tparsed = new Date();
        //trigger handler right now
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onSourceBufferUpdateEnd: {
      value: function onSourceBufferUpdateEnd() {
        //trigger handler right now
        if (this.state === APPENDING && this.mp4segments.length === 0) {
          this.stats.tbuffered = new Date();
          observer.trigger(Event.FRAG_BUFFERED, { stats: this.stats, frag: this.frag });
          this.state = IDLE;
        }
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onSourceBufferError: {
      value: function onSourceBufferError(event) {
        logger.log(" buffer append error:" + event);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return BufferController;
})();

module.exports = BufferController;
//logger.log('sb append in progress');
// check if any MP4 segments left to append

},{"../demux/demuxer":5,"../events":9,"../loader/fragment-loader":11,"../observer":13,"../utils/logger":15}],4:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * level controller
 *
 */

var Event = _interopRequire(require("../events"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var LevelController = (function () {
  function LevelController(playlistLoader) {
    this.playlistLoader = playlistLoader;
    this.onml = this.onManifestLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.ontick = this.tick.bind(this);
    observer.on(Event.MANIFEST_LOADED, this.onml);
    observer.on(Event.FRAG_LOADED, this.onfl);
    observer.on(Event.LEVEL_LOADED, this.onll);
    this._manualLevel = this._autoLevelCapping = -1;
    //this.startLevel = startLevel;
  }

  _prototypeProperties(LevelController, null, {
    destroy: {
      value: function destroy() {
        observer.removeListener(Event.MANIFEST_LOADED, this.onml);
        observer.removeListener(Event.FRAG_LOADED, this.onfl);
        observer.removeListener(Event.LEVEL_LOADED, this.onll);
        if (this.timer) {
          clearInterval(this.timer);
        }
        this._manualLevel = -1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onManifestLoaded: {
      value: function onManifestLoaded(event, data) {
        var levels = [],
            bitrateStart,
            i,
            bitrateSet = {},
            aac = false,
            heaac = false,
            codecs;
        // remove failover level for now to simplify the logic
        data.levels.forEach(function (level) {
          if (!bitrateSet.hasOwnProperty(level.bitrate)) {
            levels.push(level);
            bitrateSet[level.bitrate] = true;
          }
          // detect if we have different kind of audio codecs used amongst playlists
          codecs = level.codecs;
          if (codecs) {
            if (codecs.indexOf("mp4a.40.2") !== -1) {
              aac = true;
            }
            if (codecs.indexOf("mp4a.40.5") !== -1) {
              heaac = true;
            }
          }
        });
        // start bitrate is the first bitrate of the manifest
        bitrateStart = levels[0].bitrate;
        // sort level on bitrate
        levels.sort(function (a, b) {
          return a.bitrate - b.bitrate;
        });
        this._levels = levels;

        if (this._startLevel === undefined) {
          // find index of start level in sorted levels
          for (i = 0; i < levels.length; i++) {
            if (levels[i].bitrate === bitrateStart) {
              this._startLevel = i;
              logger.log("manifest loaded," + levels.length + " level(s) found, start bitrate:" + bitrateStart);
              break;
            }
          }
        }

        //this._startLevel = -1;
        observer.trigger(Event.MANIFEST_PARSED, { levels: this._levels,
          startLevel: this._startLevel,
          audiocodecswitch: aac && heaac
        });
        return;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    levels: {
      get: function () {
        return this._levels;
      },
      enumerable: true,
      configurable: true
    },
    level: {
      get: function () {
        return this._level;
      },
      set: function (newLevel) {
        if (this._level !== newLevel) {
          // check if level idx is valid
          if (newLevel >= 0 && newLevel < this._levels.length) {
            // stopping live reloading timer if any
            if (this.timer) {
              clearInterval(this.timer);
              this.timer = null;
            }
            this._level = newLevel;
            logger.log("switching to level " + newLevel);
            observer.trigger(Event.LEVEL_SWITCH, { levelId: newLevel });
            var level = this._levels[newLevel];
            // check if we need to load playlist for this level
            if (level.loading === undefined || level.details && level.details.live === true) {
              // level not retrieved yet, or live playlist we need to (re)load it
              observer.trigger(Event.LEVEL_LOADING, { levelId: newLevel });
              logger.log("(re)loading playlist for level " + newLevel);
              this.playlistLoader.load(level.url, newLevel);
              level.loading = true;
            }
          } else {
            // invalid level id given, trigger error
            observer.trigger(Event.LEVEL_ERROR, { level: newLevel, event: "invalid level idx" });
          }
        }
      },
      enumerable: true,
      configurable: true
    },
    manualLevel: {
      get: function () {
        return this._manualLevel;
      },
      set: function (newLevel) {
        this._manualLevel = newLevel;
        this.level = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    autoLevelCapping: {

      /** Return the capping/max level value that could be used by automatic level selection algorithm **/
      get: function () {
        return this._autoLevelCapping;
      },


      /** set the capping/max level value that could be used by automatic level selection algorithm **/
      set: function (newLevel) {
        this._autoLevelCapping = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    startLevel: {
      get: function () {
        return this._startLevel;
      },
      set: function (newLevel) {
        this._startLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    onFragmentLoaded: {
      value: function onFragmentLoaded(event, data) {
        var stats, rtt, loadtime;
        stats = data.stats;
        rtt = stats.tfirst - stats.trequest;
        loadtime = stats.tload - stats.trequest;
        this.lastbw = stats.length * 8000 / loadtime;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onLevelLoaded: {
      value: function onLevelLoaded(event, data) {
        // check if current playlist is a live playlist
        if (data.details.live && !this.timer) {
          // if live playlist we will have to reload it periodically
          // set reload period to playlist target duration
          this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tick: {
      value: function tick() {
        observer.trigger(Event.LEVEL_LOADING, { levelId: this._level });
        this.playlistLoader.load(this._levels[this._level].url, this._level);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextLevel: {
      value: function nextLevel() {
        if (this._manualLevel !== -1) {
          return this._manualLevel;
        } else {
          return this.nextAutoLevel();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextAutoLevel: {
      value: function nextAutoLevel() {
        var lastbw = this.lastbw,
            adjustedbw,
            i,
            maxAutoLevel;
        if (this._autoLevelCapping === -1) {
          maxAutoLevel = this._levels.length - 1;
        } else {
          maxAutoLevel = this._autoLevelCapping;
        }
        // follow algorithm captured from stagefright :
        // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
        // Pick the highest bandwidth stream below or equal to estimated bandwidth.
        for (i = 0; i <= maxAutoLevel; i++) {
          // consider only 80% of the available bandwidth, but if we are switching up,
          // be even more conservative (70%) to avoid overestimating and immediately
          // switching back.
          if (i <= this._level) {
            adjustedbw = 0.8 * lastbw;
          } else {
            adjustedbw = 0.7 * lastbw;
          }
          if (adjustedbw < this._levels[i].bitrate) {
            return Math.max(0, i - 1);
          }
        }
        return i - 1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return LevelController;
})();

module.exports = LevelController;

},{"../events":9,"../observer":13,"../utils/logger":15}],5:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var Event = _interopRequire(require("../events"));

var TSDemuxer = _interopRequire(require("./tsdemuxer"));

var TSDemuxerWorker = _interopRequire(require("./tsdemuxerworker"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var Demuxer = (function () {
  function Demuxer() {
    var enableWorker = true;
    if (enableWorker && typeof Worker !== "undefined") {
      logger.log("TS demuxing in webworker");
      var work = require("webworkify");
      this.w = work(TSDemuxerWorker);
      this.onwmsg = this.onWorkerMessage.bind(this);
      this.w.addEventListener("message", this.onwmsg);
      this.w.postMessage({ cmd: "init" });
    } else {
      this.demuxer = new TSDemuxer();
    }
    this.demuxInitialized = true;
  }

  _prototypeProperties(Demuxer, null, {
    setDuration: {
      value: function setDuration(newDuration) {
        if (this.w) {
          // post fragment payload as transferable objects (no copy)
          this.w.postMessage({ cmd: "duration", data: newDuration });
        } else {
          this.demuxer.setDuration(newDuration);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    destroy: {
      value: function destroy() {
        if (this.w) {
          this.w.removeEventListener("message", this.onwmsg);
          this.w.terminate();
          this.w = null;
        } else {
          this.demuxer.destroy();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {
      value: function push(data, audioCodec, videoCodec, timeOffset) {
        if (this.w) {
          // post fragment payload as transferable objects (no copy)
          this.w.postMessage({ cmd: "demux", data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset }, [data]);
        } else {
          this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset);
          this.demuxer.end();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    switchLevel: {
      value: function switchLevel() {
        if (this.w) {
          // post fragment payload as transferable objects (no copy)
          this.w.postMessage({ cmd: "switchLevel" });
        } else {
          this.demuxer.switchLevel();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onWorkerMessage: {
      value: function onWorkerMessage(ev) {
        //console.log('onWorkerMessage:' + ev.data.event);
        switch (ev.data.event) {
          case Event.FRAG_PARSING_INIT_SEGMENT:
            var obj = {};
            if (ev.data.audioMoov) {
              obj.audioMoov = new Uint8Array(ev.data.audioMoov);
              obj.audioCodec = ev.data.audioCodec;
              obj.audioChannelCount = ev.data.audioChannelCount;
            }

            if (ev.data.videoMoov) {
              obj.videoMoov = new Uint8Array(ev.data.videoMoov);
              obj.videoCodec = ev.data.videoCodec;
              obj.videoWidth = ev.data.videoWidth;
              obj.videoHeight = ev.data.videoHeight;
            }
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, obj);
            break;
          case Event.FRAG_PARSING_DATA:
            observer.trigger(Event.FRAG_PARSING_DATA, {
              moof: new Uint8Array(ev.data.moof),
              mdat: new Uint8Array(ev.data.mdat),
              startPTS: ev.data.startPTS,
              endPTS: ev.data.endPTS,
              startDTS: ev.data.startDTS,
              endDTS: ev.data.endDTS,
              type: ev.data.type
            });
            break;
          case Event.FRAG_PARSED:
            observer.trigger(Event.FRAG_PARSED);
            break;
          default:
            break;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Demuxer;
})();

module.exports = Demuxer;

},{"../events":9,"../observer":13,"../utils/logger":15,"./tsdemuxer":7,"./tsdemuxerworker":8,"webworkify":2}],6:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding
 * scheme used by h264.
 */

var logger = require("../utils/logger").logger;
var ExpGolomb = (function () {
  function ExpGolomb(workingData) {
    this.workingData = workingData;
    // the number of bytes left to examine in this.workingData
    this.workingBytesAvailable = this.workingData.byteLength;
    // the current word being examined
    this.workingWord = 0; // :uint
    // the number of bits left to examine in the current word
    this.workingBitsAvailable = 0; // :uint
  }

  _prototypeProperties(ExpGolomb, null, {
    loadWord: {

      // ():void
      value: function loadWord() {
        var position = this.workingData.byteLength - this.workingBytesAvailable,
            workingBytes = new Uint8Array(4),
            availableBytes = Math.min(4, this.workingBytesAvailable);

        if (availableBytes === 0) {
          throw new Error("no bytes available");
        }

        workingBytes.set(this.workingData.subarray(position, position + availableBytes));
        this.workingWord = new DataView(workingBytes.buffer).getUint32(0);

        // track the amount of this.workingData that has been processed
        this.workingBitsAvailable = availableBytes * 8;
        this.workingBytesAvailable -= availableBytes;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipBits: {

      // (count:int):void
      value: function skipBits(count) {
        var skipBytes; // :int
        if (this.workingBitsAvailable > count) {
          this.workingWord <<= count;
          this.workingBitsAvailable -= count;
        } else {
          count -= this.workingBitsAvailable;
          skipBytes = count >> 3;

          count -= skipBytes >> 3;
          this.workingBytesAvailable -= skipBytes;

          this.loadWord();

          this.workingWord <<= count;
          this.workingBitsAvailable -= count;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readBits: {

      // (size:int):uint
      value: function readBits(size) {
        var bits = Math.min(this.workingBitsAvailable, size),
            // :uint
        valu = this.workingWord >>> 32 - bits; // :uint

        if (size > 32) {
          logger.error("Cannot read more than 32 bits at a time");
        }

        this.workingBitsAvailable -= bits;
        if (this.workingBitsAvailable > 0) {
          this.workingWord <<= bits;
        } else if (this.workingBytesAvailable > 0) {
          this.loadWord();
        }

        bits = size - bits;
        if (bits > 0) {
          return valu << bits | this.readBits(bits);
        } else {
          return valu;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipLeadingZeros: {

      // ():uint
      value: function skipLeadingZeros() {
        var leadingZeroCount; // :uint
        for (leadingZeroCount = 0; leadingZeroCount < this.workingBitsAvailable; ++leadingZeroCount) {
          if (0 !== (this.workingWord & 2147483648 >>> leadingZeroCount)) {
            // the first bit of working word is 1
            this.workingWord <<= leadingZeroCount;
            this.workingBitsAvailable -= leadingZeroCount;
            return leadingZeroCount;
          }
        }

        // we exhausted workingWord and still have not found a 1
        this.loadWord();
        return leadingZeroCount + this.skipLeadingZeros();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipUnsignedExpGolomb: {

      // ():void
      value: function skipUnsignedExpGolomb() {
        this.skipBits(1 + this.skipLeadingZeros());
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipExpGolomb: {

      // ():void
      value: function skipExpGolomb() {
        this.skipBits(1 + this.skipLeadingZeros());
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readUnsignedExpGolomb: {

      // ():uint
      value: function readUnsignedExpGolomb() {
        var clz = this.skipLeadingZeros(); // :uint
        return this.readBits(clz + 1) - 1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readExpGolomb: {

      // ():int
      value: function readExpGolomb() {
        var valu = this.readUnsignedExpGolomb(); // :int
        if (1 & valu) {
          // the number is odd if the low order bit is set
          return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
        } else {
          return -1 * (valu >>> 1); // divide by two then make it negative
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readBoolean: {

      // Some convenience functions
      // :Boolean
      value: function readBoolean() {
        return 1 === this.readBits(1);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readUnsignedByte: {

      // ():int
      value: function readUnsignedByte() {
        return this.readBits(8);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipScalingList: {

      /**
       * Advance the ExpGolomb decoder past a scaling list. The scaling
       * list is optionally transmitted as part of a sequence parameter
       * set and is not relevant to transmuxing.
       * @param count {number} the number of entries in this scaling list
       * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
       */
      value: function skipScalingList(count) {
        var lastScale = 8,
            nextScale = 8,
            j,
            deltaScale;

        for (j = 0; j < count; j++) {
          if (nextScale !== 0) {
            deltaScale = this.readExpGolomb();
            nextScale = (lastScale + deltaScale + 256) % 256;
          }

          lastScale = nextScale === 0 ? lastScale : nextScale;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readSequenceParameterSet: {

      /**
       * Read a sequence parameter set and return some interesting video
       * properties. A sequence parameter set is the H264 metadata that
       * describes the properties of upcoming video frames.
       * @param data {Uint8Array} the bytes of a sequence parameter set
       * @return {object} an object with configuration parsed from the
       * sequence parameter set, including the dimensions of the
       * associated video frames.
       */
      value: function readSequenceParameterSet() {
        var frameCropLeftOffset = 0,
            frameCropRightOffset = 0,
            frameCropTopOffset = 0,
            frameCropBottomOffset = 0,
            profileIdc,
            profileCompatibility,
            levelIdc,
            numRefFramesInPicOrderCntCycle,
            picWidthInMbsMinus1,
            picHeightInMapUnitsMinus1,
            frameMbsOnlyFlag,
            scalingListCount,
            i;

        this.readUnsignedByte();
        profileIdc = this.readUnsignedByte(); // profile_idc
        profileCompatibility = this.readBits(5); // constraint_set[0-4]_flag, u(5)
        this.skipBits(3); // reserved_zero_3bits u(3),
        levelIdc = this.readUnsignedByte(); //level_idc u(8)
        this.skipUnsignedExpGolomb(); // seq_parameter_set_id

        // some profiles have more optional data we don't need
        if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 144) {
          var chromaFormatIdc = this.readUnsignedExpGolomb();
          if (chromaFormatIdc === 3) {
            this.skipBits(1); // separate_colour_plane_flag
          }
          this.skipUnsignedExpGolomb(); // bit_depth_luma_minus8
          this.skipUnsignedExpGolomb(); // bit_depth_chroma_minus8
          this.skipBits(1); // qpprime_y_zero_transform_bypass_flag
          if (this.readBoolean()) {
            // seq_scaling_matrix_present_flag
            scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
            for (i = 0; i < scalingListCount; i++) {
              if (this.readBoolean()) {
                // seq_scaling_list_present_flag[ i ]
                if (i < 6) {
                  this.skipScalingList(16);
                } else {
                  this.skipScalingList(64);
                }
              }
            }
          }
        }

        this.skipUnsignedExpGolomb(); // log2_max_frame_num_minus4
        var picOrderCntType = this.readUnsignedExpGolomb();

        if (picOrderCntType === 0) {
          this.readUnsignedExpGolomb(); //log2_max_pic_order_cnt_lsb_minus4
        } else if (picOrderCntType === 1) {
          this.skipBits(1); // delta_pic_order_always_zero_flag
          this.skipExpGolomb(); // offset_for_non_ref_pic
          this.skipExpGolomb(); // offset_for_top_to_bottom_field
          numRefFramesInPicOrderCntCycle = this.readUnsignedExpGolomb();
          for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
            this.skipExpGolomb(); // offset_for_ref_frame[ i ]
          }
        }

        this.skipUnsignedExpGolomb(); // max_num_ref_frames
        this.skipBits(1); // gaps_in_frame_num_value_allowed_flag

        picWidthInMbsMinus1 = this.readUnsignedExpGolomb();
        picHeightInMapUnitsMinus1 = this.readUnsignedExpGolomb();

        frameMbsOnlyFlag = this.readBits(1);
        if (frameMbsOnlyFlag === 0) {
          this.skipBits(1); // mb_adaptive_frame_field_flag
        }

        this.skipBits(1); // direct_8x8_inference_flag
        if (this.readBoolean()) {
          // frame_cropping_flag
          frameCropLeftOffset = this.readUnsignedExpGolomb();
          frameCropRightOffset = this.readUnsignedExpGolomb();
          frameCropTopOffset = this.readUnsignedExpGolomb();
          frameCropBottomOffset = this.readUnsignedExpGolomb();
        }

        return {
          profileIdc: profileIdc,
          profileCompatibility: profileCompatibility,
          levelIdc: levelIdc,
          width: (picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2,
          height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - frameCropTopOffset * 2 - frameCropBottomOffset * 2
        };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return ExpGolomb;
})();

module.exports = ExpGolomb;

},{"../utils/logger":15}],7:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/**
 * A stream-based mp2ts to mp4 converter. This utility is used to
 * deliver mp4s to a SourceBuffer on platforms that support native
 * Media Source Extensions.
 */

var Event = _interopRequire(require("../events"));

var ExpGolomb = _interopRequire(require("./exp-golomb"));

// import Hex             from '../utils/hex';
var MP4 = _interopRequire(require("../remux/mp4-generator"));

// import MP4Inspect      from '../remux/mp4-inspector';
var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var TSDemuxer = (function () {
  function TSDemuxer() {
    this.switchLevel();
  }

  _prototypeProperties(TSDemuxer, null, {
    setDuration: {
      value: function setDuration(newDuration) {
        this._duration = newDuration;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    switchLevel: {
      value: function switchLevel() {
        this.pmtParsed = false;
        this._pmtId = this._avcId = this._aacId = -1;
        this._avcTrack = { type: "video", sequenceNumber: 0 };
        this._aacTrack = { type: "audio", sequenceNumber: 0 };
        this._avcSamples = [];
        this._avcSamplesLength = 0;
        this._avcSamplesNbNalu = 0;
        this._aacSamples = [];
        this._aacSamplesLength = 0;
        this._initSegGenerated = false;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {

      // feed incoming data to the front of the parsing pipeline
      value: function push(data, audioCodec, videoCodec, timeOffset) {
        this.audioCodec = audioCodec;
        this.videoCodec = videoCodec;
        this.timeOffset = timeOffset;
        var offset;
        for (offset = 0; offset < data.length; offset += 188) {
          this._parseTSPacket(data, offset);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      // flush any buffered data
      value: function end() {
        if (this._avcData) {
          this._parseAVCPES(this._parsePES(this._avcData));
          this._avcData = null;
        }
        //logger.log('nb AVC samples:' + this._avcSamples.length);
        if (this._avcSamples.length) {
          this._flushAVCSamples();
        }
        if (this._aacData) {
          this._parseAACPES(this._parsePES(this._aacData));
          this._aacData = null;
        }
        //logger.log('nb AAC samples:' + this._aacSamples.length);
        if (this._aacSamples.length) {
          this._flushAACSamples();
        }
        //notify end of parsing
        observer.trigger(Event.FRAG_PARSED);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    destroy: {
      value: function destroy() {
        this._duration = 0;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseTSPacket: {
      value: function ParseTSPacket(data, start) {
        var stt, pid, atf, offset;
        if (data[start] === 71) {
          stt = !!(data[start + 1] & 64);
          // pid is a 13-bit field starting at the last bit of TS[1]
          pid = ((data[start + 1] & 31) << 8) + data[start + 2];
          atf = (data[start + 3] & 48) >> 4;
          // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
          if (atf > 1) {
            offset = start + 5 + data[start + 4];
            // return if there is only adaptation field
            if (offset === start + 188) {
              return;
            }
          } else {
            offset = start + 4;
          }
          if (this.pmtParsed) {
            if (pid === this._avcId) {
              if (stt) {
                if (this._avcData) {
                  this._parseAVCPES(this._parsePES(this._avcData));
                }
                this._avcData = { data: [], size: 0 };
              }
              this._avcData.data.push(data.subarray(offset, start + 188));
              this._avcData.size += start + 188 - offset;
            } else if (pid === this._aacId) {
              if (stt) {
                if (this._aacData) {
                  this._parseAACPES(this._parsePES(this._aacData));
                }
                this._aacData = { data: [], size: 0 };
              }
              this._aacData.data.push(data.subarray(offset, start + 188));
              this._aacData.size += start + 188 - offset;
            }
          } else {
            if (stt) {
              offset += data[offset] + 1;
            }
            if (pid === 0) {
              this._parsePAT(data, offset);
            } else if (pid === this._pmtId) {
              this._parsePMT(data, offset);
              this.pmtParsed = true;
            }
          }
        } else {
          logger.log("parsing error");
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parsePAT: {
      value: function ParsePAT(data, offset) {
        // skip the PSI header and parse the first PMT entry
        this._pmtId = (data[offset + 10] & 31) << 8 | data[offset + 11];
        //logger.log('PMT PID:'  + this._pmtId);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parsePMT: {
      value: function ParsePMT(data, offset) {
        var sectionLength, tableEnd, programInfoLength, pid;
        sectionLength = (data[offset + 1] & 15) << 8 | data[offset + 2];
        tableEnd = offset + 3 + sectionLength - 4;
        // to determine where the table is, we have to figure out how
        // long the program info descriptors are
        programInfoLength = (data[offset + 10] & 15) << 8 | data[offset + 11];

        // advance the offset to the first entry in the mapping table
        offset += 12 + programInfoLength;
        while (offset < tableEnd) {
          pid = (data[offset + 1] & 31) << 8 | data[offset + 2];
          switch (data[offset]) {
            // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
            case 15:
              //logger.log('AAC PID:'  + pid);
              this._aacId = pid;
              this._aacTrack.id = pid;
              break;
            // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
            case 27:
              //logger.log('AVC PID:'  + pid);
              this._avcId = pid;
              this._avcTrack.id = pid;
              break;
            default:
              logger.log("unkown stream type:" + data[offset]);
              break;
          }
          // move to the next table entry
          // skip past the elementary stream descriptors, if present
          offset += ((data[offset + 3] & 15) << 8 | data[offset + 4]) + 5;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parsePES: {
      value: function ParsePES(stream) {
        var i = 0,
            frag,
            pesFlags,
            pesPrefix,
            pesLen,
            pesHdrLen,
            pesData,
            pesPts,
            pesDts,
            payloadStartOffset;
        //retrieve PTS/DTS from first fragment
        frag = stream.data[0];
        pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
        if (pesPrefix === 1) {
          pesLen = (frag[4] << 8) + frag[5];
          pesFlags = frag[7];
          if (pesFlags & 192) {
            // PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
            pesPts = (frag[9] & 14) << 28 | (frag[10] & 255) << 21 | (frag[11] & 254) << 13 | (frag[12] & 255) << 6 | (frag[13] & 254) >>> 2;
            pesPts /= 45;
            if (pesFlags & 64) {
              pesDts = (frag[14] & 14) << 28 | (frag[15] & 255) << 21 | (frag[16] & 254) << 13 | (frag[17] & 255) << 6 | (frag[18] & 254) >>> 2;
              pesDts /= 45;
            } else {
              pesDts = pesPts;
            }
          }
          pesHdrLen = frag[8];
          payloadStartOffset = pesHdrLen + 9;
          // trim PES header
          stream.data[0] = stream.data[0].subarray(payloadStartOffset);
          stream.size -= payloadStartOffset;
          //reassemble PES packet
          pesData = new Uint8Array(stream.size);
          // reassemble the packet
          while (stream.data.length) {
            frag = stream.data.shift();
            pesData.set(frag, i);
            i += frag.byteLength;
          }
          return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
        } else {
          return null;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseAVCPES: {
      value: function ParseAVCPES(pes) {
        var _this = this;
        var units,
            track = this._avcTrack,
            avcSample,
            key = false;
        units = this._parseAVCNALu(pes.data);
        //free pes.data to save up some memory
        pes.data = null;
        units.units.forEach(function (unit) {
          switch (unit.type) {
            //IDR
            case 5:
              key = true;
              break;
            //SPS
            case 7:
              if (!track.sps) {
                var expGolombDecoder = new ExpGolomb(unit.data);
                var config = expGolombDecoder.readSequenceParameterSet();
                track.width = config.width;
                track.height = config.height;
                track.profileIdc = config.profileIdc;
                track.profileCompatibility = config.profileCompatibility;
                track.levelIdc = config.levelIdc;
                track.sps = [unit.data];
                track.duration = 90000 * _this._duration;
                var codecarray = unit.data.subarray(1, 4);
                var codecstring = "avc1.";
                for (var i = 0; i < 3; i++) {
                  var h = codecarray[i].toString(16);
                  if (h.length < 2) {
                    h = "0" + h;
                  }
                  codecstring += h;
                }
                track.codec = codecstring;
              }
              break;
            //PPS
            case 8:
              if (!track.pps) {
                track.pps = [unit.data];
              }
              break;
            default:
              break;
          }
        });
        //build sample from PES
        // Annex B to MP4 conversion to be done
        avcSample = { units: units, pts: pes.pts, dts: pes.dts, key: key };
        this._avcSamples.push(avcSample);
        this._avcSamplesLength += units.length;
        this._avcSamplesNbNalu += units.units.length;
        // generate Init Segment if needed
        if (!this._initSegGenerated) {
          this._generateInitSegment();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _flushAVCSamples: {
      value: function FlushAVCSamples() {
        var view,
            i = 8,
            avcSample,
            mp4Sample,
            mp4SampleLength,
            unit,
            track = this._avcTrack,
            lastSampleDTS,
            mdat,
            moof,
            startOffset,
            endOffset,
            firstPTS,
            firstDTS;
        track.samples = [];

        /* concatenate the video data and construct the mdat in place
          (need 8 more bytes to fill length and mpdat type) */
        mdat = new Uint8Array(this._avcSamplesLength + 4 * this._avcSamplesNbNalu + 8);
        view = new DataView(mdat.buffer);
        view.setUint32(0, mdat.byteLength);
        mdat.set(MP4.types.mdat, 4);
        while (this._avcSamples.length) {
          avcSample = this._avcSamples.shift();
          mp4SampleLength = 0;

          // convert NALU bitstream to MP4 format (prepend NALU with size field)
          while (avcSample.units.units.length) {
            unit = avcSample.units.units.shift();
            view.setUint32(i, unit.data.byteLength);
            i += 4;
            mdat.set(unit.data, i);
            i += unit.data.byteLength;
            mp4SampleLength += 4 + unit.data.byteLength;
          }

          avcSample.pts -= this._initDTS;
          avcSample.dts -= this._initDTS;
          //logger.log('Video/PTS/DTS:' + avcSample.pts + '/' + avcSample.dts);

          if (lastSampleDTS !== undefined) {
            mp4Sample.duration = Math.round((avcSample.dts - lastSampleDTS) * 90);
            if (mp4Sample.duration < 0) {
              //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
              mp4Sample.duration = 0;
            }
          } else {
            // check if fragments are contiguous (i.e. no missing frames between fragment)
            if (this.nextAvcPts) {
              var delta = avcSample.pts - this.nextAvcPts,
                  absdelta = Math.abs(delta);
              //logger.log('absdelta/avcSample.pts:' + absdelta + '/' + avcSample.pts);
              // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
              if (absdelta < 300) {
                //logger.log('Video next PTS:' + this.nextAvcPts);
                if (delta > 1) {
                  logger.log("AVC:" + delta.toFixed(0) + " ms hole between fragments detected,filling it");
                } else if (delta < -1) {
                  logger.log("AVC:" + -delta.toFixed(0) + " ms overlapping between fragments detected");
                }
                // set PTS to next PTS
                avcSample.pts = this.nextAvcPts;
                // offset DTS as well, ensure that DTS is smaller or equal than new PTS
                avcSample.dts = Math.max(avcSample.dts - delta, this.lastAvcDts);
                // logger.log('Video/PTS/DTS adjusted:' + avcSample.pts + '/' + avcSample.dts);
              }
            }
            // remember first PTS of our avcSamples
            firstPTS = avcSample.pts;
            firstDTS = avcSample.dts;
          }

          mp4Sample = {
            size: mp4SampleLength,
            compositionTimeOffset: (avcSample.pts - avcSample.dts) * 90,
            flags: {
              isLeading: 0,
              isDependedOn: 0,
              hasRedundancy: 0,
              degradationPriority: 0
            }
          };

          if (avcSample.key === true) {
            // the current sample is a key frame
            mp4Sample.flags.dependsOn = 2;
            mp4Sample.flags.isNonSyncSample = 0;
          } else {
            mp4Sample.flags.dependsOn = 1;
            mp4Sample.flags.isNonSyncSample = 1;
          }
          track.samples.push(mp4Sample);
          lastSampleDTS = avcSample.dts;
        }
        mp4Sample.duration = track.samples[track.samples.length - 2].duration;
        this.lastAvcDts = avcSample.dts;
        // next AVC sample PTS should be equal to last sample PTS + duration
        this.nextAvcPts = avcSample.pts + mp4Sample.duration / 90;
        //logger.log('Video/lastAvcDts/nextAvcPts:' + this.lastAvcDts + '/' + this.nextAvcPts);

        this._avcSamplesLength = 0;
        this._avcSamplesNbNalu = 0;

        startOffset = firstPTS / 1000;
        endOffset = this.nextAvcPts / 1000;

        moof = MP4.moof(track.sequenceNumber++, firstDTS * 90, track);
        observer.trigger(Event.FRAG_PARSING_DATA, {
          moof: moof,
          mdat: mdat,
          startPTS: startOffset,
          endPTS: endOffset,
          startDTS: firstDTS / 1000,
          endDTS: (avcSample.dts + mp4Sample.duration / 90) / 1000,
          type: "video"
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseAVCNALu: {
      value: function ParseAVCNALu(array) {
        var i = 0,
            len = array.byteLength,
            value,
            state = 0;
        var units = [],
            unit,
            unitType,
            lastUnitStart,
            lastUnitType,
            length = 0;
        //logger.log('PES:' + Hex.hexDump(array));

        while (i < len) {
          value = array[i++];
          // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
          switch (state) {
            case 0:
              if (value === 0) {
                state = 1;
              }
              break;
            case 1:
              if (value === 0) {
                state = 2;
              } else {
                state = 0;
              }
              break;
            case 2:
            case 3:
              if (value === 0) {
                state = 3;
              } else if (value === 1) {
                unitType = array[i] & 31;
                //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
                if (lastUnitStart) {
                  unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
                  length += i - state - 1 - lastUnitStart;
                  //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                  units.push(unit);
                }
                lastUnitStart = i;
                lastUnitType = unitType;
                if (unitType === 1 || unitType === 5) {
                  // OPTI !!! if IDR/NDR unit, consider it is last NALu
                  i = len;
                }
                state = 0;
              } else {
                state = 0;
              }
              break;
            default:
              break;
          }
        }
        if (lastUnitStart) {
          unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType };
          length += len - lastUnitStart;
          units.push(unit);
          //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
        }
        return { units: units, length: length };
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _parseAACPES: {
      value: function ParseAACPES(pes) {
        //logger.log('PES:' + Hex.hexDump(pes.data));
        var track = this._aacTrack,
            aacSample,
            data = pes.data,
            config,
            adtsFrameSize,
            adtsStartOffset,
            adtsHeaderLen,
            stamp,
            i;
        if (data[0] === 255) {
          if (!track.audiosamplerate) {
            config = this._ADTStoAudioConfig(pes.data, this.audioCodec);
            track.config = config.config;
            track.audiosamplerate = config.samplerate;
            track.channelCount = config.channelCount;
            track.codec = config.codec;
            track.duration = 90000 * this._duration;
            console.log(track.codec + ",rate:" + config.samplerate + ",nb channel:" + config.channelCount);
          }
          adtsStartOffset = i = 0;
          while (adtsStartOffset < data.length) {
            // retrieve frame size
            adtsFrameSize = (data[adtsStartOffset + 3] & 3) << 11;
            // byte 4
            adtsFrameSize |= data[adtsStartOffset + 4] << 3;
            // byte 5
            adtsFrameSize |= (data[adtsStartOffset + 5] & 224) >>> 5;
            adtsHeaderLen = !!(data[adtsStartOffset + 1] & 1) ? 7 : 9;
            adtsFrameSize -= adtsHeaderLen;
            stamp = pes.pts + i * 1024 * 1000 / track.audiosamplerate;
            //stamp = pes.pts;
            //console.log('AAC frame, offset/length/pts:' + (adtsStartOffset+7) + '/' + adtsFrameSize + '/' + stamp.toFixed(0));
            aacSample = { unit: pes.data.subarray(adtsStartOffset + adtsHeaderLen, adtsStartOffset + adtsHeaderLen + adtsFrameSize), pts: stamp, dts: stamp };
            adtsStartOffset += adtsFrameSize + adtsHeaderLen;
            this._aacSamples.push(aacSample);
            this._aacSamplesLength += adtsFrameSize;
            i++;
          }
        } else {
          observer.trigger(Event.FRAG_PARSING_ERROR, "Stream did not start with ADTS header.");
          return;
        }
        if (!this._initSegGenerated) {
          this._generateInitSegment();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _flushAACSamples: {
      value: function FlushAACSamples() {
        var view,
            i = 8,
            aacSample,
            mp4Sample,
            unit,
            track = this._aacTrack,
            lastSampleDTS,
            mdat,
            moof,
            startOffset,
            endOffset,
            firstPTS,
            firstDTS;
        track.samples = [];

        /* concatenate the audio data and construct the mdat in place
          (need 8 more bytes to fill length and mpdat type) */
        mdat = new Uint8Array(this._aacSamplesLength + 8);
        view = new DataView(mdat.buffer);
        view.setUint32(0, mdat.byteLength);
        mdat.set(MP4.types.mdat, 4);
        while (this._aacSamples.length) {
          aacSample = this._aacSamples.shift();
          unit = aacSample.unit;
          mdat.set(unit, i);
          i += unit.byteLength;

          aacSample.pts -= this._initDTS;
          aacSample.dts -= this._initDTS;

          //logger.log('Audio/PTS:' + aacSample.pts.toFixed(0));
          if (lastSampleDTS !== undefined) {
            // we use DTS to compute sample duration, but we use PTS to compute initPTS which is used to sync audio and video
            mp4Sample.duration = Math.round((aacSample.dts - lastSampleDTS) * 90);
            if (mp4Sample.duration < 0) {
              //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
              mp4Sample.duration = 0;
            }
          } else {
            // check if fragments are contiguous (i.e. no missing frames between fragment)
            if (this.nextAacPts && this.nextAacPts !== aacSample.pts) {
              //logger.log('Audio next PTS:' + this.nextAacPts);
              var delta = aacSample.pts - this.nextAacPts;
              // if delta is less than 300 ms, next loaded fragment is assumed to be contiguous with last one
              if (Math.abs(delta) > 1 && Math.abs(delta) < 300) {
                if (delta > 0) {
                  logger.log("AAC:" + delta.toFixed(0) + " ms hole between fragments detected,filling it");
                  // set PTS to next PTS, and ensure PTS is greater or equal than last DTS
                  aacSample.pts = Math.max(this.nextAacPts, this.lastAacDts);
                  aacSample.dts = aacSample.pts;
                  //logger.log('Audio/PTS/DTS adjusted:' + aacSample.pts + '/' + aacSample.dts);
                } else {
                  logger.log("AAC:" + -delta.toFixed(0) + " ms overlapping between fragments detected");
                }
              }
            }
            // remember first PTS of our avcSamples
            firstPTS = aacSample.pts;
            firstDTS = aacSample.dts;
          }

          mp4Sample = {
            size: unit.byteLength,
            compositionTimeOffset: 0,
            flags: {
              isLeading: 0,
              isDependedOn: 0,
              hasRedundancy: 0,
              degradationPriority: 0,
              dependsOn: 1 }
          };
          track.samples.push(mp4Sample);
          lastSampleDTS = aacSample.dts;
        }
        //set last sample duration as being identical to previous sample
        mp4Sample.duration = track.samples[track.samples.length - 2].duration;
        this.lastAacDts = aacSample.dts;
        // next aac sample PTS should be equal to last sample PTS + duration
        this.nextAacPts = aacSample.pts + mp4Sample.duration / 90;
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));

        this._aacSamplesLength = 0;

        startOffset = firstPTS / 1000;
        endOffset = this.nextAacPts / 1000;

        moof = MP4.moof(track.sequenceNumber++, firstDTS * 90, track);
        observer.trigger(Event.FRAG_PARSING_DATA, {
          moof: moof,
          mdat: mdat,
          startPTS: startOffset,
          endPTS: endOffset,
          startDTS: firstDTS / 1000,
          endDTS: (aacSample.dts + mp4Sample.duration / 90) / 1000,
          type: "audio"
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _ADTStoAudioConfig: {
      value: function ADTStoAudioConfig(data, audioCodec) {
        var adtsObjectType,
            // :int
        adtsSampleingIndex,
            // :int
        adtsExtensionSampleingIndex,
            // :int
        adtsChanelConfig,
            // :int
        config,
            adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000];

        // byte 2
        adtsObjectType = ((data[2] & 192) >>> 6) + 1;
        adtsSampleingIndex = (data[2] & 60) >>> 2;
        adtsChanelConfig = (data[2] & 1) << 2;

        //  always force audio type to be HE-AAC SBR. some browsers do not support audio codec switch properly
        // in case stream is really HE-AAC: it should be either  advertised directly in codecs (retrieved from parsing manifest)
        // or if no codec specified,we implicitely assume that audio with sampling rate less or equal than 24 kHz is HE-AAC (index 6)
        // currently broken on Chrome/Android
        if (navigator.userAgent.toLowerCase().indexOf("android") === -1 && (audioCodec && audioCodec.indexOf("mp4a.40.5") !== -1 || !audioCodec && adtsSampleingIndex >= 6)) {
          adtsObjectType = 5;
          // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
          // there is a factor 2 between frame sample rate and output sample rate
          // multiply frequency by 2 (see table below, equivalent to substract 3)
          adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
          config = new Array(4);
        } else {
          if (navigator.userAgent.toLowerCase().indexOf("android") === -1 && navigator.userAgent.toLowerCase().indexOf("firefox") === -1) {
            adtsObjectType = 5;
            config = new Array(4);
          } else {
            adtsObjectType = 2;
            config = new Array(2);
          }
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        }
        // byte 3
        adtsChanelConfig |= (data[3] & 192) >>> 6;
        /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
            ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
          Audio Profile / Audio Object Type
          0: Null
          1: AAC Main
          2: AAC LC (Low Complexity)
          3: AAC SSR (Scalable Sample Rate)
          4: AAC LTP (Long Term Prediction)
          5: SBR (Spectral Band Replication)
          6: AAC Scalable
         sampling freq
          0: 96000 Hz
          1: 88200 Hz
          2: 64000 Hz
          3: 48000 Hz
          4: 44100 Hz
          5: 32000 Hz
          6: 24000 Hz
          7: 22050 Hz
          8: 16000 Hz
          9: 12000 Hz
          10: 11025 Hz
          11: 8000 Hz
          12: 7350 Hz
          13: Reserved
          14: Reserved
          15: frequency is written explictly
          Channel Configurations
          These are the channel configurations:
          0: Defined in AOT Specifc Config
          1: 1 channel: front-center
          2: 2 channels: front-left, front-right
        */
        // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
        config[0] = adtsObjectType << 3;
        // samplingFrequencyIndex
        config[0] |= (adtsSampleingIndex & 14) >> 1;
        config[1] |= (adtsSampleingIndex & 1) << 7;
        // channelConfiguration
        config[1] |= adtsChanelConfig << 3;
        if (adtsObjectType === 5) {
          // adtsExtensionSampleingIndex
          config[1] |= (adtsExtensionSampleingIndex & 14) >> 1;
          config[2] = (adtsExtensionSampleingIndex & 1) << 7;
          // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
          //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
          config[2] |= 2 << 2;
          config[3] = 0;
        }
        return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: "mp4a.40." + adtsObjectType };
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _generateInitSegment: {
      value: function GenerateInitSegment() {
        if (this._avcId === -1) {
          //audio only
          if (this._aacTrack.config) {
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
              audioMoov: MP4.initSegment([this._aacTrack]),
              audioCodec: this._aacTrack.codec,
              audioChannelCount: this._aacTrack.channelCount
            });
            this._initSegGenerated = true;
          }
          if (this._initPTS === undefined) {
            // remember first PTS of this demuxing context
            this._initPTS = this._aacSamples[0].pts - 1000 * this.timeOffset;
            this._initDTS = this._aacSamples[0].dts - 1000 * this.timeOffset;
          }
        } else if (this._aacId === -1) {
          //video only
          if (this._avcTrack.sps && this._avcTrack.pps) {
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
              videoMoov: MP4.initSegment([this._avcTrack]),
              videoCodec: this._avcTrack.codec,
              videoWidth: this._avcTrack.width,
              videoHeight: this._avcTrack.height
            });
            this._initSegGenerated = true;
            if (this._initPTS === undefined) {
              // remember first PTS of this demuxing context
              this._initPTS = this._avcSamples[0].pts - 1000 * this.timeOffset;
              this._initDTS = this._avcSamples[0].dts - 1000 * this.timeOffset;
            }
          }
        } else {
          //audio and video
          if (this._aacTrack.config && this._avcTrack.sps && this._avcTrack.pps) {
            observer.trigger(Event.FRAG_PARSING_INIT_SEGMENT, {
              audioMoov: MP4.initSegment([this._aacTrack]),
              audioCodec: this._aacTrack.codec,
              audioChannelCount: this._aacTrack.channelCount,
              videoMoov: MP4.initSegment([this._avcTrack]),
              videoCodec: this._avcTrack.codec,
              videoWidth: this._avcTrack.width,
              videoHeight: this._avcTrack.height
            });
            this._initSegGenerated = true;
            if (this._initPTS === undefined) {
              // remember first PTS of this demuxing context
              this._initPTS = Math.min(this._avcSamples[0].pts, this._aacSamples[0].pts) - 1000 * this.timeOffset;
              this._initDTS = Math.min(this._avcSamples[0].dts, this._aacSamples[0].dts) - 1000 * this.timeOffset;
            }
          }
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TSDemuxer;
})();

module.exports = TSDemuxer;

},{"../events":9,"../observer":13,"../remux/mp4-generator":14,"../utils/logger":15,"./exp-golomb":6}],8:[function(require,module,exports){
"use strict";

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var Event = _interopRequire(require("../events"));

var TSDemuxer = _interopRequire(require("../demux/tsdemuxer"));

var observer = _interopRequire(require("../observer"));

var TSDemuxerWorker = function TSDemuxerWorker() {
  self.addEventListener("message", function (ev) {
    //console.log('demuxer cmd:' + ev.data.cmd);
    switch (ev.data.cmd) {
      case "init":
        self.demuxer = new TSDemuxer();
        break;
      case "duration":
        self.demuxer.setDuration(ev.data.data);
        break;
      case "switchLevel":
        self.demuxer.switchLevel();
        break;
      case "demux":
        self.demuxer.push(new Uint8Array(ev.data.data), ev.data.audioCodec, ev.data.videoCodec, ev.data.timeOffset);
        self.demuxer.end();
        break;
      default:
        break;
    }
  });

  // listen to events triggered by TS Demuxer
  observer.on(Event.FRAG_PARSING_INIT_SEGMENT, function (ev, data) {
    var objData = { event: ev };
    var objTransferable = [];
    if (data.audioCodec) {
      objData.audioCodec = data.audioCodec;
      objData.audioMoov = data.audioMoov.buffer;
      objData.audioChannelCount = data.audioChannelCount;
      objTransferable.push(objData.audioMoov);
    }
    if (data.videoCodec) {
      objData.videoCodec = data.videoCodec;
      objData.videoMoov = data.videoMoov.buffer;
      objData.videoWidth = data.videoWidth;
      objData.videoHeight = data.videoHeight;
      objTransferable.push(objData.videoMoov);
    }
    // pass moov as transferable object (no copy)
    self.postMessage(objData, objTransferable);
  });
  observer.on(Event.FRAG_PARSING_DATA, function (ev, data) {
    var objData = { event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, moof: data.moof.buffer, mdat: data.mdat.buffer };
    // pass moof/mdat data as transferable object (no copy)
    self.postMessage(objData, [objData.moof, objData.mdat]);
  });
  observer.on(Event.FRAG_PARSED, function (ev) {
    var objData = { event: ev };
    self.postMessage(objData);
  });
};

module.exports = TSDemuxerWorker;

},{"../demux/tsdemuxer":7,"../events":9,"../observer":13}],9:[function(require,module,exports){
"use strict";

module.exports = {
  // triggered when MediaSource has been attached to video tag
  MSE_ATTACHED: "hlsMediaSourceAttached",
  //Identifier for a manifest loaded event
  MANIFEST_LOADED: "hlsManifestLoaded",
  //Identifier for a manifest parsed event, when this event is received, main manifest and start level has been retrieved
  MANIFEST_PARSED: "hlsManifestParsed",
  // Identifier for a level loading event
  LEVEL_LOADING: "hlsLevelLoading",
  // Identifier for a level loaded event
  LEVEL_LOADED: "hlsLevelLoaded",
  // Identifier for a level switch event
  LEVEL_SWITCH: "hlsLevelSwitch",
  // Identifier for a fragment loading event
  FRAG_LOADING: "hlsFragmentLoading",
  // Identifier for a fragment loaded event
  FRAG_LOADED: "hlsFragmentLoaded",
  // Identifier for a fragment parsing init segment event
  FRAG_PARSING_INIT_SEGMENT: "hlsFragmentParsingInitSegment",
  // Identifier for a fragment parsing data event
  FRAG_PARSING_DATA: "hlsFragmentParsingData",
  // Identifier for a fragment parsing error event
  FRAG_PARSING_ERROR: "hlsFragmentParsingError",
  // Identifier for a fragment parsed event
  FRAG_PARSED: "hlsFragmentParsed",
  // Identifier for a fragment buffered  event
  FRAG_BUFFERED: "hlsFragmentBuffered",
  // Identifier for a load error event
  LOAD_ERROR: "hlsLoadError",
  // Identifier for a level switch error
  LEVEL_ERROR: "hlsLevelError",
  // Identifier for a video error event
  VIDEO_ERROR: "hlsVideoError"
};

},{}],10:[function(require,module,exports){
/**
 * HLS engine
 */
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var Event = _interopRequire(require("./events"));

var observer = _interopRequire(require("./observer"));

var PlaylistLoader = _interopRequire(require("./loader/playlist-loader"));

var BufferController = _interopRequire(require("./controller/buffer-controller"));

var LevelController = _interopRequire(require("./controller/level-controller"));

var logger = require("./utils/logger").logger;
var enableLogs = require("./utils/logger").enableLogs;
//import MP4Inspect         from '/remux/mp4-inspector';

var Hls = (function () {
  function Hls() {
    this.playlistLoader = new PlaylistLoader();
    this.levelController = new LevelController(this.playlistLoader);
    this.bufferController = new BufferController(this.levelController);
    this.Events = Event;
    this.debug = enableLogs;
    this.logEvt = this.logEvt;
    // observer setup
    this.on = observer.on.bind(observer);
    this.off = observer.removeListener.bind(observer);
  }

  _prototypeProperties(Hls, {
    isSupported: {
      value: function isSupported() {
        return window.MediaSource && MediaSource.isTypeSupported("video/mp4; codecs=\"avc1.42E01E,mp4a.40.2\"");
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  }, {
    destroy: {
      value: function destroy() {
        if (this.playlistLoader) {
          this.playlistLoader.destroy();
          this.playlistLoader = null;
        }
        if (this.bufferController) {
          this.bufferController.destroy();
          this.bufferController = null;
        }
        if (this.levelController) {
          this.levelController.destroy();
          this.levelController = null;
        }
        this.detachSource();
        this.detachVideo();
        observer.removeAllListeners();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    attachVideo: {
      value: function attachVideo(video) {
        this.video = video;
        // setup the media source
        var ms = this.mediaSource = new MediaSource();
        //Media Source listeners
        this.onmso = this.onMediaSourceOpen.bind(this);
        this.onmse = this.onMediaSourceEnded.bind(this);
        this.onmsc = this.onMediaSourceClose.bind(this);
        ms.addEventListener("sourceopen", this.onmso);
        ms.addEventListener("sourceended", this.onmse);
        ms.addEventListener("sourceclose", this.onmsc);
        // link video and media Source
        video.src = URL.createObjectURL(ms);
        this.onverror = this.onVideoError.bind(this);
        video.addEventListener("error", this.onverror);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    detachVideo: {
      value: function detachVideo() {
        var video = this.video;
        var ms = this.mediaSource;
        if (ms) {
          ms.endOfStream();
          ms.removeEventListener("sourceopen", this.onmso);
          ms.removeEventListener("sourceended", this.onmse);
          ms.removeEventListener("sourceclose", this.onmsc);
          // unlink MediaSource from video tag
          video.src = "";
          this.mediaSource = null;
        }
        this.onmso = this.onmse = this.onmsc = null;
        if (video) {
          this.video = null;
          // remove video error listener
          video.removeEventListener("error", this.onverror);
          this.onverror = null;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadSource: {
      value: function loadSource(url) {
        this.url = url;
        logger.log("loadSource:" + url);
        // when attaching to a source URL, trigger a playlist load
        this.playlistLoader.load(url, null);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    unloadSource: {
      value: function unloadSource() {
        this.url = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    levels: {

      /** Return all quality levels **/
      get: function () {
        return this.levelController.levels;
      },
      enumerable: true,
      configurable: true
    },
    level: {
      /** Return the quality level of last loaded fragment **/
      get: function () {
        return this.levelController.level;
      },


      /* set quality level for next loaded fragment (-1 for automatic level selection) */
      set: function (newLevel) {
        this.levelController.manualLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    startLevel: {

      /** Return start level (level of first fragment that will be played back)
          if undefined : first level appearing in manifest will be used as start level
          if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
      **/
      get: function () {
        return this.levelController.startLevel;
      },


      /** set  start level (level of first fragment that will be played back)
          if undefined : first level appearing in manifest will be used as start level
          if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
      **/
      set: function (newLevel) {
        this.levelController.startLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    autoLevelCapping: {

      /** Return the capping/max level value that could be used by automatic level selection algorithm **/
      get: function () {
        return this.levelController.autoLevelCapping;
      },


      /** set the capping/max level value that could be used by automatic level selection algorithm **/
      set: function (newLevel) {
        this.levelController.autoLevelCapping = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    autoLevelEnabled: {

      /* check if we are in automatic level selection mode */
      get: function () {
        return this.levelController.manualLevel === -1;
      },
      enumerable: true,
      configurable: true
    },
    manualLevel: {

      /* return manual level */
      get: function () {
        return this.levelController.manualLevel;
      },
      enumerable: true,
      configurable: true
    },
    onMediaSourceOpen: {
      value: function onMediaSourceOpen() {
        observer.trigger(Event.MSE_ATTACHED, { video: this.video, mediaSource: this.mediaSource });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMediaSourceClose: {
      value: function onMediaSourceClose() {
        logger.log("media source closed");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMediaSourceEnded: {
      value: function onMediaSourceEnded() {
        logger.log("media source ended");
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoError: {
      value: function onVideoError() {
        observer.trigger(Event.VIDEO_ERROR);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Hls;
})();

module.exports = Hls;

},{"./controller/buffer-controller":3,"./controller/level-controller":4,"./events":9,"./loader/playlist-loader":12,"./observer":13,"./utils/logger":15}],11:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
* fragment loader
*
*/

var Event = _interopRequire(require("../events"));

var observer = _interopRequire(require("../observer"));

var logger = require("../utils/logger").logger;
var FragmentLoader = (function () {
  function FragmentLoader() {}

  _prototypeProperties(FragmentLoader, null, {
    destroy: {
      value: function destroy() {
        this.abort();
        this.xhr = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    abort: {
      value: function abort() {
        if (this.xhr && this.xhr.readyState !== 4) {
          this.xhr.abort();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(frag, levelId) {
        this.frag = frag;
        this.levelId = levelId;
        this.trequest = new Date();
        this.tfirst = null;
        var xhr = this.xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open("GET", frag.url, true);
        xhr.responseType = "arraybuffer";
        xhr.send();
        observer.trigger(Event.FRAG_LOADING, { frag: frag });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        var payload = event.currentTarget.response;
        observer.trigger(Event.FRAG_LOADED, { payload: payload,
          frag: this.frag,
          stats: { trequest: this.trequest, tfirst: this.tfirst, tload: new Date(), length: payload.byteLength } });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        logger.log("error loading " + this.frag.url);
        observer.trigger(Event.LOAD_ERROR, { url: this.frag.url, event: event });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress() {
        if (this.tfirst === null) {
          this.tfirst = new Date();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return FragmentLoader;
})();

module.exports = FragmentLoader;

},{"../events":9,"../observer":13,"../utils/logger":15}],12:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * playlist loader
 *
 */

var Event = _interopRequire(require("../events"));

var observer = _interopRequire(require("../observer"));

//import {logger}             from '../utils/logger';

var PlaylistLoader = (function () {
  function PlaylistLoader() {
    this.manifestLoaded = false;
  }

  _prototypeProperties(PlaylistLoader, null, {
    destroy: {
      value: function destroy() {
        if (this.xhr && this.xhr.readyState !== 4) {
          this.xhr.abort();
          this.xhr = null;
        }
        this.url = this.id = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(url, requestId) {
        this.url = url;
        this.id = requestId;
        this.stats = { trequest: new Date() };
        var xhr = this.xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open("GET", url, true);
        xhr.send();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    resolve: {
      value: function resolve(url, baseUrl) {
        var doc = document,
            oldBase = doc.getElementsByTagName("base")[0],
            oldHref = oldBase && oldBase.href,
            docHead = doc.head || doc.getElementsByTagName("head")[0],
            ourBase = oldBase || docHead.appendChild(doc.createElement("base")),
            resolver = doc.createElement("a"),
            resolvedUrl;

        ourBase.href = baseUrl;
        resolver.href = url;
        resolvedUrl = resolver.href; // browser magic at work here

        if (oldBase) {
          oldBase.href = oldHref;
        } else {
          docHead.removeChild(ourBase);
        }
        return resolvedUrl;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parseMasterPlaylist: {
      value: function parseMasterPlaylist(string, baseurl) {
        var levels = [],
            level = {},
            result,
            codecs,
            codec;
        var re = /#EXT-X-STREAM-INF:([^\n\r]*(BAND)WIDTH=(\d+))?([^\n\r]*(CODECS)=\"(.*)\",)?([^\n\r]*(RES)OLUTION=(\d+)x(\d+))?([^\n\r]*(NAME)=\"(.*)\")?[^\n\r]*[\r\n]+([^\r\n]+)/g;
        while ((result = re.exec(string)) != null) {
          result.shift();
          result = result.filter(function (n) {
            return n !== undefined;
          });
          level.url = this.resolve(result.pop(), baseurl);
          while (result.length > 0) {
            switch (result.shift()) {
              case "RES":
                level.width = parseInt(result.shift());
                level.height = parseInt(result.shift());
                break;
              case "BAND":
                level.bitrate = parseInt(result.shift());
                break;
              case "NAME":
                level.name = result.shift();
                break;
              case "CODECS":
                codecs = result.shift().split(",");
                while (codecs.length > 0) {
                  codec = codecs.shift();
                  if (codec.indexOf("avc1") !== -1) {
                    level.videoCodec = this.avc1toavcoti(codec);
                  } else {
                    level.audioCodec = codec;
                  }
                }
                break;
              default:
                break;
            }
          }
          levels.push(level);
          level = {};
        }
        return levels;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    avc1toavcoti: {
      value: function avc1toavcoti(codec) {
        var result,
            avcdata = codec.split(".");
        if (avcdata.length > 2) {
          result = avcdata.shift() + ".";
          result += parseInt(avcdata.shift()).toString(16);
          result += ("00" + parseInt(avcdata.shift()).toString(16)).substr(-4);
        } else {
          result = codec;
        }
        return result;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parseLevelPlaylist: {
      value: function parseLevelPlaylist(string, baseurl, id) {
        var currentSN = 0,
            totalduration = 0,
            level = { url: baseurl, fragments: [], live: true },
            result,
            regexp;
        regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):([\d\.]+)[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST)))/g;
        while ((result = regexp.exec(string)) !== null) {
          result.shift();
          result = result.filter(function (n) {
            return n !== undefined;
          });
          switch (result[0]) {
            case "MEDIA-SEQUENCE":
              currentSN = level.startSN = parseInt(result[1]);
              break;
            case "TARGETDURATION":
              level.targetduration = parseFloat(result[1]);
              break;
            case "ENDLIST":
              level.live = false;
              break;
            case "INF":
              var duration = parseFloat(result[1]);
              level.fragments.push({ url: this.resolve(result[2], baseurl), duration: duration, start: totalduration, sn: currentSN++, level: id });
              totalduration += duration;
              break;
            default:
              break;
          }
        }
        //logger.log('found ' + level.fragments.length + ' fragments');
        level.totalduration = totalduration;
        level.endSN = currentSN - 1;
        return level;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        var data,
            string = event.currentTarget.responseText,
            url = event.currentTarget.responseURL,
            id = this.id;
        // responseURL not supported on some browsers (it is used to detect URL redirection)
        if (url === undefined) {
          // fallback to initial URL
          url = this.url;
        }
        this.stats.tload = new Date();
        this.stats.mtime = new Date(this.xhr.getResponseHeader("Last-Modified"));

        if (string.indexOf("#EXTM3U") === 0) {
          if (string.indexOf("#EXTINF:") > 0) {
            // 1 level playlist, parse it
            data = this.parseLevelPlaylist(string, url, id);
            // if first request, fire manifest loaded event beforehand
            if (this.id === null) {
              observer.trigger(Event.MANIFEST_LOADED, { levels: [data],
                url: url,
                stats: this.stats });
            }
            observer.trigger(Event.LEVEL_LOADED, { details: data,
              levelId: id,
              stats: this.stats });
          } else {
            // multi level playlist, parse level info
            observer.trigger(Event.MANIFEST_LOADED, { levels: this.parseMasterPlaylist(string, url),
              url: url,
              id: id,
              stats: this.stats });
          }
        } else {
          observer.trigger(Event.LOAD_ERROR, { url: url, response: event.currentTarget });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        observer.trigger(Event.LOAD_ERROR, { url: this.url, response: event.currentTarget });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress() {
        if (this.stats.tfirst === undefined) {
          this.stats.tfirst = new Date();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return PlaylistLoader;
})();

module.exports = PlaylistLoader;

},{"../events":9,"../observer":13}],13:[function(require,module,exports){
"use strict";

var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var EventEmitter = _interopRequire(require("events"));

var observer = new EventEmitter();

observer.trigger = function trigger(event) {
  for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    data[_key - 1] = arguments[_key];
  }

  observer.emit.apply(observer, [event, event].concat(_toArray(data)));
};

module.exports = observer;

},{"events":1}],14:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/**
 * generate MP4 Box
 */

var MP4 = (function () {
  function MP4() {}

  _prototypeProperties(MP4, {
    init: {
      value: function init() {
        MP4.types = {
          avc1: [], // codingname
          avcC: [],
          btrt: [],
          dinf: [],
          dref: [],
          esds: [],
          ftyp: [],
          hdlr: [],
          mdat: [],
          mdhd: [],
          mdia: [],
          mfhd: [],
          minf: [],
          moof: [],
          moov: [],
          mp4a: [],
          mvex: [],
          mvhd: [],
          sdtp: [],
          stbl: [],
          stco: [],
          stsc: [],
          stsd: [],
          stsz: [],
          stts: [],
          tfdt: [],
          tfhd: [],
          traf: [],
          trak: [],
          trun: [],
          trex: [],
          tkhd: [],
          vmhd: [],
          smhd: []
        };

        var i;
        for (i in MP4.types) {
          if (MP4.types.hasOwnProperty(i)) {
            MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
          }
        }

        MP4.MAJOR_BRAND = new Uint8Array(["i".charCodeAt(0), "s".charCodeAt(0), "o".charCodeAt(0), "m".charCodeAt(0)]);
        MP4.AVC1_BRAND = new Uint8Array(["a".charCodeAt(0), "v".charCodeAt(0), "c".charCodeAt(0), "1".charCodeAt(0)]);
        MP4.MINOR_VERSION = new Uint8Array([0, 0, 0, 1]);
        MP4.VIDEO_HDLR = new Uint8Array([0, // version 0
        0, 0, 0, // flags
        0, 0, 0, 0, // pre_defined
        118, 105, 100, 101, // handler_type: 'vide'
        0, 0, 0, 0, // reserved
        0, 0, 0, 0, // reserved
        0, 0, 0, 0, // reserved
        86, 105, 100, 101, 111, 72, 97, 110, 100, 108, 101, 114, 0 // name: 'VideoHandler'
        ]);
        MP4.AUDIO_HDLR = new Uint8Array([0, // version 0
        0, 0, 0, // flags
        0, 0, 0, 0, // pre_defined
        115, 111, 117, 110, // handler_type: 'soun'
        0, 0, 0, 0, // reserved
        0, 0, 0, 0, // reserved
        0, 0, 0, 0, // reserved
        83, 111, 117, 110, 100, 72, 97, 110, 100, 108, 101, 114, 0 // name: 'SoundHandler'
        ]);
        MP4.HDLR_TYPES = {
          video: MP4.VIDEO_HDLR,
          audio: MP4.AUDIO_HDLR
        };
        MP4.DREF = new Uint8Array([0, // version 0
        0, 0, 0, // flags
        0, 0, 0, 1, // entry_count
        0, 0, 0, 12, // entry_size
        117, 114, 108, 32, // 'url' type
        0, // version 0
        0, 0, 1 // entry_flags
        ]);
        MP4.STCO = new Uint8Array([0, // version
        0, 0, 0, // flags
        0, 0, 0, 0 // entry_count
        ]);
        MP4.STSC = MP4.STCO;
        MP4.STTS = MP4.STCO;
        MP4.STSZ = new Uint8Array([0, // version
        0, 0, 0, // flags
        0, 0, 0, 0, // sample_size
        0, 0, 0, 0]);
        MP4.VMHD = new Uint8Array([0, // version
        0, 0, 1, // flags
        0, 0, // graphicsmode
        0, 0, 0, 0, 0, 0 // opcolor
        ]);
        MP4.SMHD = new Uint8Array([0, // version
        0, 0, 0, // flags
        0, 0, // balance
        0, 0 // reserved
        ]);

        MP4.STSD = new Uint8Array([0, // version 0
        0, 0, 0, // flags
        0, 0, 0, 1]); // entry_count

        MP4.FTYP = MP4.box(MP4.types.ftyp, MP4.MAJOR_BRAND, MP4.MINOR_VERSION, MP4.MAJOR_BRAND, MP4.AVC1_BRAND);
        MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, MP4.DREF));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    box: {
      value: function box(type) {
        var payload = Array.prototype.slice.call(arguments, 1),
            size = 0,
            i = payload.length,
            result,
            view;

        // calculate the total size we need to allocate
        while (i--) {
          size += payload[i].byteLength;
        }
        result = new Uint8Array(size + 8);
        view = new DataView(result.buffer);
        view.setUint32(0, result.byteLength);
        result.set(type, 4);

        // copy the payload into the result
        for (i = 0, size = 8; i < payload.length; i++) {
          result.set(payload[i], size);
          size += payload[i].byteLength;
        }
        return result;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    hdlr: {
      value: function hdlr(type) {
        return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mdat: {
      value: function mdat(data) {
        return MP4.box(MP4.types.mdat, data);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mdhd: {
      value: function mdhd(duration) {
        return MP4.box(MP4.types.mdhd, new Uint8Array([0, // version 0
        0, 0, 0, // flags
        0, 0, 0, 2, // creation_time
        0, 0, 0, 3, // modification_time
        0, 1, 95, 144, duration >> 24, duration >> 16 & 255, duration >> 8 & 255, duration & 255, // duration
        85, 196, // 'und' language (undetermined)
        0, 0]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mdia: {
      value: function mdia(track) {
        return MP4.box(MP4.types.mdia, MP4.mdhd(track.duration), MP4.hdlr(track.type), MP4.minf(track));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mfhd: {
      value: function mfhd(sequenceNumber) {
        return MP4.box(MP4.types.mfhd, new Uint8Array([0, 0, 0, 0, sequenceNumber >> 24, sequenceNumber >> 16 & 255, sequenceNumber >> 8 & 255, sequenceNumber & 255]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    minf: {
      value: function minf(track) {
        if (track.type === "audio") {
          return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
        } else {
          return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    moof: {
      value: function moof(sn, baseMediaDecodeTime, track) {
        return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    moov: {
      /**
       * @param tracks... (optional) {array} the tracks associated with this movie
       */
      value: function moov(tracks) {
        var i = tracks.length,
            boxes = [];

        while (i--) {
          boxes[i] = MP4.trak(tracks[i]);
        }

        return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mvex: {
      value: function mvex(tracks) {
        var i = tracks.length,
            boxes = [];

        while (i--) {
          boxes[i] = MP4.trex(tracks[i]);
        }
        return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mvhd: {
      value: function mvhd(duration) {
        var bytes = new Uint8Array([0, // version 0
        0, 0, 0, // flags
        0, 0, 0, 1, // creation_time
        0, 0, 0, 2, // modification_time
        0, 1, 95, 144, duration >> 24, duration >> 16 & 255, duration >> 8 & 255, duration & 255, // duration
        0, 1, 0, 0, // 1.0 rate
        1, 0, // 1.0 volume
        0, 0, // reserved
        0, 0, 0, 0, // reserved
        0, 0, 0, 0, // reserved
        0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, // transformation: unity matrix
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // pre_defined
        255, 255, 255, 255 // next_track_ID
        ]);
        return MP4.box(MP4.types.mvhd, bytes);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    sdtp: {
      value: function sdtp(track) {
        var samples = track.samples || [],
            bytes = new Uint8Array(4 + samples.length),
            flags,
            i;

        // leave the full box header (4 bytes) all zero

        // write the sample table
        for (i = 0; i < samples.length; i++) {
          flags = samples[i].flags;
          bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
        }

        return MP4.box(MP4.types.sdtp, bytes);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stbl: {
      value: function stbl(track) {
        return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    avc1: {
      value: function avc1(track) {
        var sps = [],
            pps = [],
            i;
        // assemble the SPSs
        for (i = 0; i < track.sps.length; i++) {
          sps.push(track.sps[i].byteLength >>> 8 & 255);
          sps.push(track.sps[i].byteLength & 255); // sequenceParameterSetLength
          sps = sps.concat(Array.prototype.slice.call(track.sps[i])); // SPS
        }

        // assemble the PPSs
        for (i = 0; i < track.pps.length; i++) {
          pps.push(track.pps[i].byteLength >>> 8 & 255);
          pps.push(track.pps[i].byteLength & 255);
          pps = pps.concat(Array.prototype.slice.call(track.pps[i]));
        }

        return MP4.box(MP4.types.avc1, new Uint8Array([0, 0, 0, // reserved
        0, 0, 0, // reserved
        0, 1, // data_reference_index
        0, 0, // pre_defined
        0, 0, // reserved
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // pre_defined
        track.width >> 8 & 255, track.width & 255, // width
        track.height >> 8 & 255, track.height & 255, // height
        0, 72, 0, 0, // horizresolution
        0, 72, 0, 0, // vertresolution
        0, 0, 0, 0, // reserved
        0, 1, // frame_count
        19, 118, 105, 100, 101, 111, 106, 115, 45, 99, 111, 110, 116, 114, 105, 98, 45, 104, 108, 115, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // compressorname
        0, 24, // depth = 24
        17, 17]), // pre_defined = -1
        MP4.box(MP4.types.avcC, new Uint8Array([1, // configurationVersion
        track.profileIdc, // AVCProfileIndication
        track.profileCompatibility, // profile_compatibility
        track.levelIdc, // AVCLevelIndication
        255 // lengthSizeMinusOne, hard-coded to 4 bytes
        ].concat([track.sps.length // numOfSequenceParameterSets
        ]).concat(sps).concat([track.pps.length // numOfPictureParameterSets
        ]).concat(pps))), // "PPS"
        MP4.box(MP4.types.btrt, new Uint8Array([0, 28, 156, 128, // bufferSizeDB
        0, 45, 198, 192, // maxBitrate
        0, 45, 198, 192])) // avgBitrate
        );
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    esds: {
      value: function esds(track) {
        return new Uint8Array([0, // version 0
        0, 0, 0, // flags

        3, // descriptor_type
        23 + track.config.length, // length
        0, 1, //es_id
        0, // stream_priority

        4, // descriptor_type
        15 + track.config.length, // length
        64, //codec : mpeg4_audio
        21, // stream_type
        0, 0, 0, // buffer_size
        0, 0, 0, 0, // maxBitrate
        0, 0, 0, 0, // avgBitrate

        5 // descriptor_type
        ].concat([track.config.length]).concat(track.config).concat([6, 1, 2])); // GASpecificConfig)); // length + audio config descriptor
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    mp4a: {
      value: function mp4a(track) {
        return MP4.box(MP4.types.mp4a, new Uint8Array([0, 0, 0, // reserved
        0, 0, 0, // reserved
        0, 1, // data_reference_index
        0, 0, 0, 0, 0, 0, 0, 0, // reserved
        0, track.channelCount, // channelcount
        0, 16, // sampleSize:16bits
        0, 0, 0, 0, // reserved2
        track.audiosamplerate >> 8 & 255, track.audiosamplerate & 255, //
        0, 0]), MP4.box(MP4.types.esds, MP4.esds(track)));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stsd: {
      value: function stsd(track) {
        if (track.type === "audio") {
          return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
        } else {
          return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tkhd: {
      value: function tkhd(track) {
        return MP4.box(MP4.types.tkhd, new Uint8Array([0, // version 0
        0, 0, 7, // flags
        0, 0, 0, 0, // creation_time
        0, 0, 0, 0, // modification_time
        track.id >> 24 & 255, track.id >> 16 & 255, track.id >> 8 & 255, track.id & 255, // track_ID
        0, 0, 0, 0, track.duration >> 24, track.duration >> 16 & 255, track.duration >> 8 & 255, track.duration & 255, // duration
        0, 0, 0, 0, 0, 0, 0, 0, // reserved
        0, 0, // layer
        0, 0, // alternate_group
        0, 0, // non-audio track volume
        0, 0, // reserved
        0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, // transformation: unity matrix
        track.width >> 8 & 255, track.width & 255, 0, 0, // width
        track.height >> 8 & 255, track.height & 255, 0, 0 // height
        ]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    traf: {
      value: function traf(track, baseMediaDecodeTime) {
        var sampleDependencyTable = MP4.sdtp(track);
        return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0, // version 0
        0, 0, 0, track.id >> 24, track.id >> 16 & 255, track.id >> 8 & 255, track.id & 255])), MP4.box(MP4.types.tfdt, new Uint8Array([0, // version 0
        0, 0, 0, baseMediaDecodeTime >> 24, baseMediaDecodeTime >> 16 & 255, baseMediaDecodeTime >> 8 & 255, baseMediaDecodeTime & 255])), MP4.trun(track, sampleDependencyTable.length + 16 + // tfhd
        16 + // tfdt
        8 + // traf header
        16 + // mfhd
        8 + // moof header
        8), // mdat header
        sampleDependencyTable);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trak: {

      /**
       * Generate a track box.
       * @param track {object} a track definition
       * @return {Uint8Array} the track box
       */
      value: function trak(track) {
        track.duration = track.duration || 4294967295;
        return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trex: {
      value: function trex(track) {
        return MP4.box(MP4.types.trex, new Uint8Array([0, // version 0
        0, 0, 0, track.id >> 24, track.id >> 16 & 255, track.id >> 8 & 255, track.id & 255, // track_ID
        0, 0, 0, 1, // default_sample_description_index
        0, 0, 0, 0, // default_sample_duration
        0, 0, 0, 0, // default_sample_size
        0, 1, 0, 1 // default_sample_flags
        ]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trun: {
      value: function trun(track, offset) {
        var samples, sample, i, array;

        samples = track.samples || [];
        array = new Uint8Array(12 + 16 * samples.length);
        offset += 8 + array.byteLength;

        array.set([0, // version 0
        0, 15, 1, // flags
        samples.length >>> 24 & 255, samples.length >>> 16 & 255, samples.length >>> 8 & 255, samples.length & 255, // sample_count
        offset >>> 24 & 255, offset >>> 16 & 255, offset >>> 8 & 255, offset & 255 // data_offset
        ], 0);

        for (i = 0; i < samples.length; i++) {
          sample = samples[i];
          array.set([sample.duration >>> 24 & 255, sample.duration >>> 16 & 255, sample.duration >>> 8 & 255, sample.duration & 255, // sample_duration
          sample.size >>> 24 & 255, sample.size >>> 16 & 255, sample.size >>> 8 & 255, sample.size & 255, // sample_size
          sample.flags.isLeading << 2 | sample.flags.dependsOn, sample.flags.isDependedOn << 6 | sample.flags.hasRedundancy << 4 | sample.flags.paddingValue << 1 | sample.flags.isNonSyncSample, sample.flags.degradationPriority & 240 << 8, sample.flags.degradationPriority & 15, // sample_flags
          sample.compositionTimeOffset >>> 24 & 255, sample.compositionTimeOffset >>> 16 & 255, sample.compositionTimeOffset >>> 8 & 255, sample.compositionTimeOffset & 255 // sample_composition_time_offset
          ], 12 + 16 * i);
        }
        return MP4.box(MP4.types.trun, array);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    initSegment: {
      value: function initSegment(tracks) {
        if (!MP4.types) {
          MP4.init();
        }
        var movie = MP4.moov(tracks),
            result;

        result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
        result.set(MP4.FTYP);
        result.set(movie, MP4.FTYP.byteLength);
        return result;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return MP4;
})();

module.exports = MP4;
// sample_count
// timescale, 90,000 "ticks" per second
// flags
// sequence_number
// timescale, 90,000 "ticks" per second
// reserved
// flags
// track_ID
// flags
// baseMediaDecodeTime
// flags

},{}],15:[function(require,module,exports){
"use strict";

function noop() {}
var fakeLogger = {
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};
var exportedLogger = fakeLogger;

var enableLogs = exports.enableLogs = function (debug) {
  if (debug === true || typeof debug === "object") {
    exportedLogger.log = debug.log ? debug.log.bind(debug) : console.log.bind(console);
    exportedLogger.info = debug.info ? debug.info.bind(debug) : console.info.bind(console);
    exportedLogger.error = debug.error ? debug.error.bind(debug) : console.error.bind(console);
    exportedLogger.warn = debug.warn ? debug.warn.bind(debug) : console.warn.bind(console);

    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log();
    } catch (e) {
      exportedLogger.log = noop;
      exportedLogger.info = noop;
      exportedLogger.error = noop;
      exportedLogger.warn = noop;
    }
  } else {
    exportedLogger = fakeLogger;
  }
};
var logger = exports.logger = exportedLogger;

},{}]},{},[10])(10)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvcGxheWxpc3QtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUFDSCxXQUFHLENBQUMsYUFBYSxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRCxXQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixXQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFVBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFDdEIsR0FBSSxFQUFFLEVBQUksRUFBRSxFQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsQ0FBSTtTQUM3QixDQUFDLENBQUM7QUFDSCxXQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixXQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFVBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFDdEIsR0FBSSxFQUFFLEVBQUksRUFBRSxFQUFJLEVBQUUsR0FBSSxF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R0FBSTtBQUNmLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsRUFBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixXQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO1NBQ3ZCLENBQUMsQ0FBQztBQUNMLGVBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxL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S0FBSyxDQUFDLFFBQVEsSUFBSSxFQUFFLEdBQUksR0FBSSxFQUM3QixBQUFDLEtBQUssQ0FBQyxRQUFRLElBQUssQ0FBQyxHQUFJLEdBQUksRUFDN0IsS0FBSyxDQUFDLFFBQVEsR0FBRyxHQUFJO0FBQ3JCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLEFBQUMsYUFBSyxDQUFDLEtBQUssSUFBSSxDQUFDLEdBQUksR0FBSSxFQUN6QixLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUksRUFDbEIsQ0FBSSxFQUFFLENBQUk7QUFDVixBQUFDLGFBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFJLEdBQUksRUFDMUIsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFJLEVBQ25CLENBQUksRUFBRSxDQUFJO1NBQ1gsQ0FBQyxDQUFDLENBQUM7T0FDTDs7Ozs7QUFFTSxRQUFJO2FBQUEsY0FBQyxLQUFLLEVBQUMsbUJB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R0FBRyxVQUFVLENBQUM7R0FDN0I7Q0FDRixDQUFDO0FBQ0ssSUFBSSxNQUFNLFdBQU4sTUFBTSxHQUFHLGNBQWMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgaWYgKGNhY2hlW2tleV0uZXhwb3J0cyA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgIFxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwncmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJykoc2VsZiknKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcbiAgICBcbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcbiAgICBcbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuICAgIFxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwiLypcbiAqIGJ1ZmZlciBjb250cm9sbGVyXG4gKlxuICovXG5cbiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRnJhZ21lbnRMb2FkZXIgICAgICAgZnJvbSAnLi4vbG9hZGVyL2ZyYWdtZW50LWxvYWRlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQgRGVtdXhlciAgICAgICAgICAgICAgZnJvbSAnLi4vZGVtdXgvZGVtdXhlcic7XG5cbiAgY29uc3QgU1RBUlRJTkcgPSAtMTtcbiAgY29uc3QgSURMRSA9IDA7XG4gIGNvbnN0IExPQURJTkcgPSAgMTtcbiAgY29uc3QgV0FJVElOR19MRVZFTCA9IDI7XG4gIGNvbnN0IFBBUlNJTkcgPSAzO1xuICBjb25zdCBQQVJTRUQgPSA0O1xuICBjb25zdCBBUFBFTkRJTkcgPSA1O1xuXG4gY2xhc3MgQnVmZmVyQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IobGV2ZWxDb250cm9sbGVyKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBsZXZlbENvbnRyb2xsZXI7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlciA9IG5ldyBGcmFnbWVudExvYWRlcigpO1xuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25zYmUgID0gdGhpcy5vblNvdXJjZUJ1ZmZlckVycm9yLmJpbmQodGhpcyk7XG4gICAgLy8gaW50ZXJuYWwgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NU0VBdHRhY2hlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnbWVudExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25pcyA9IHRoaXMub25Jbml0U2VnbWVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcGcgPSB0aGlzLm9uRnJhZ21lbnRQYXJzaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwID0gdGhpcy5vbkZyYWdtZW50UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NU0VfQVRUQUNIRUQsIHRoaXMub25tc2UpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcigpO1xuICB9XG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgaWYodGhpcy5kZW11eGVyKSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5tcDRzZWdtZW50cyA9IFtdO1xuICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyO1xuICAgIGlmKHNiKSB7XG4gICAgICBpZihzYi5hdWRpbykge1xuICAgICAgICAgIC8vZGV0YWNoIHNvdXJjZWJ1ZmZlciBmcm9tIE1lZGlhIFNvdXJjZVxuICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlU291cmNlQnVmZmVyKHNiLmF1ZGlvKTtcbiAgICAgICAgICBzYi5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IuYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgIH1cbiAgICAgIGlmKHNiLnZpZGVvKSB7XG4gICAgICAgICAgLy9kZXRhY2ggc291cmNlYnVmZmVyIGZyb20gTWVkaWEgU291cmNlXG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IudmlkZW8pO1xuICAgICAgICAgIHNiLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsIHRoaXMub25tcCk7XG4gICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyXG4gICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVraW5nJyx0aGlzLm9udnNlZWtpbmcpO1xuICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLHRoaXMub252bWV0YWRhdGEpO1xuICAgIHRoaXMub252c2Vla2luZyA9IG51bGw7XG4gICAgdGhpcy5vbnZtZXRhZGF0YSA9IG51bGw7XG4gICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gIH1cblxuICBzdGFydCgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgdGhpcy5vbmlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIHRoaXMuc3RhdGUgPSBTVEFSVElORztcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy50aW1lciA9IHVuZGVmaW5lZDtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgdGhpcy5vbmZwZyk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gIH1cblxuICB0aWNrKCkge1xuICAgIHZhciBwb3MsbG9hZExldmVsLGxvYWRMZXZlbERldGFpbHMsZnJhZ0lkeDtcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTVEFSVElORzpcbiAgICAgICAgLy8gZGV0ZXJtaW5lIGxvYWQgbGV2ZWxcbiAgICAgICAgdGhpcy5zdGFydExldmVsID0gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyAtMSA6IGd1ZXNzIHN0YXJ0IExldmVsIGJ5IGRvaW5nIGEgYml0cmF0ZSB0ZXN0IGJ5IGxvYWRpbmcgZmlyc3QgZnJhZ21lbnQgb2YgbG93ZXN0IHF1YWxpdHkgbGV2ZWxcbiAgICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSAwO1xuICAgICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBzdGFydCBsZXZlbCBsb2FkXG4gICAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB0aGlzLnN0YXRlID0gV0FJVElOR19MRVZFTDtcbiAgICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICBjYXNlIElETEU6XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYodGhpcy5sb2FkZWRtZXRhZGF0YSkge1xuICAgICAgICAgIHBvcyA9IHRoaXMudmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5uZXh0TG9hZFBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGxvYWQgbGV2ZWxcbiAgICAgICAgaWYodGhpcy5zdGFydEZyYWdtZW50TG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxvYWRMZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3ZSBhcmUgbm90IGF0IHBsYXliYWNrIHN0YXJ0LCBnZXQgbmV4dCBsb2FkIGxldmVsIGZyb20gbGV2ZWwgQ29udHJvbGxlclxuICAgICAgICAgIGxvYWRMZXZlbCA9IHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMZXZlbCgpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gdGhpcy5idWZmZXJJbmZvKHBvcyksIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLCBidWZmZXJFbmQgPSBidWZmZXJJbmZvLmVuZDtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICB2YXIgbWF4QnVmTGVuID0gTWF0aC5taW4oOCo2MCoxMDAwKjEwMDAvdGhpcy5sZXZlbHNbbG9hZExldmVsXS5iaXRyYXRlLDMwKTtcbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmKGJ1ZmZlckxlbiA8IG1heEJ1Zkxlbikge1xuICAgICAgICAgIGlmKGxvYWRMZXZlbCAhPT0gdGhpcy5sZXZlbCkge1xuICAgICAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWQgaWYgbmVlZGVkXG4gICAgICAgICAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IGxvYWRMZXZlbDtcbiAgICAgICAgICAgIC8vIHRlbGwgZGVtdXhlciB0aGF0IHdlIHdpbGwgc3dpdGNoIGxldmVsICh0aGlzIHdpbGwgZm9yY2UgaW5pdCBzZWdtZW50IHRvIGJlIHJlZ2VuZXJhdGVkKVxuICAgICAgICAgICAgaWYgKHRoaXMuZGVtdXhlcikge1xuICAgICAgICAgICAgICB0aGlzLmRlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbG9hZExldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xvYWRMZXZlbF0uZGV0YWlscztcbiAgICAgICAgICAvLyBpZiBsZXZlbCBkZXRhaWxzIHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgaWYodHlwZW9mIGxvYWRMZXZlbERldGFpbHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZmluZCBmcmFnbWVudCBpbmRleCwgY29udGlndW91cyB3aXRoIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgICB2YXIgZnJhZ21lbnRzID0gbG9hZExldmVsRGV0YWlscy5mcmFnbWVudHMsIGZyYWcsIHNsaWRpbmcgPSBsb2FkTGV2ZWxEZXRhaWxzLnNsaWRpbmcsIHN0YXJ0ID0gZnJhZ21lbnRzWzBdLnN0YXJ0ICsgc2xpZGluZztcbiAgICAgICAgICAvLyBjaGVjayBpZiByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgd2l0aGluIHNlZWthYmxlIGJvdW5kYXJpZXMgOlxuICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICBpZihidWZmZXJFbmQgPCBzdGFydCkge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZygncmVxdWVzdGVkIHBvc2l0aW9uOicgKyBidWZmZXJFbmQgKyAnIGlzIGJlZm9yZSBzdGFydCBvZiBwbGF5bGlzdCwgcmVzZXQgdmlkZW8gcG9zaXRpb24gdG8gc3RhcnQ6JyArIHN0YXJ0KTtcbiAgICAgICAgICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUgPSBzdGFydCArIDAuMDE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIG9uZSBidWZmZXIgcmFuZ2UsIGxvYWQgbmV4dCBTTlxuICAgICAgICAgIGlmKGJ1ZmZlckxlbiA+IDAgJiYgdGhpcy52aWRlby5idWZmZXJlZC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGZyYWdJZHggPSB0aGlzLmZyYWcuc24gKyAxIC0gZnJhZ21lbnRzWzBdLnNuO1xuICAgICAgICAgICAgaWYoZnJhZ0lkeCA+PSBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIC8vIG1vc3QgY2VydGFpbmx5IGxpdmUgcGxheWxpc3QgaXMgb3V0ZGF0ZWQsIGxldCdzIG1vdmUgdG8gV0FJVElORyBMRVZFTCBzdGF0ZSBhbmQgY29tZSBiYWNrIG9uY2UgaXQgd2lsbCBoYXZlIGJlZW4gcmVmcmVzaGVkXG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnc24gJyArICh0aGlzLmZyYWcuc24gKyAxKSArICcgb3V0IG9mIHJhbmdlLCB3YWl0IGZvciBsaXZlIHBsYXlsaXN0IHVwZGF0ZScpO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gZGF0YSBidWZmZXJlZCwgb3IgbXVsdGlwbGUgYnVmZmVyIHJhbmdlIGxvb2sgZm9yIGZyYWdtZW50cyBtYXRjaGluZyB3aXRoIGN1cnJlbnQgcGxheSBwb3NpdGlvblxuICAgICAgICAgICAgZm9yIChmcmFnSWR4ID0gMDsgZnJhZ0lkeCA8IGZyYWdtZW50cy5sZW5ndGggOyBmcmFnSWR4KyspIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICAgICAgICAgICAgc3RhcnQgPSBmcmFnLnN0YXJ0K3NsaWRpbmc7XG4gICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICAgIGlmKHN0YXJ0IDw9IGJ1ZmZlckVuZCAmJiAoc3RhcnQgKyBmcmFnLmR1cmF0aW9uKSA+IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgU04gbWF0Y2hpbmcgd2l0aCBwb3M6JyArICBidWZmZXJFbmQgKyAnOicgKyBmcmFnLnNuKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZ0lkeCA+PSAwICYmIGZyYWdJZHggPCBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZih0aGlzLmZyYWcgJiYgZnJhZy5zbiA9PT0gdGhpcy5mcmFnLnNuKSB7XG4gICAgICAgICAgICAgIGlmKGZyYWdJZHggPT09IChmcmFnbWVudHMubGVuZ3RoIC0xKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGFyZSBhdCB0aGUgZW5kIG9mIHRoZSBwbGF5bGlzdCBhbmQgd2UgYWxyZWFkeSBsb2FkZWQgbGFzdCBmcmFnbWVudCwgZG9uJ3QgZG8gYW55dGhpbmdcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4KzFdO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coJ1NOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOicgKyBmcmFnLnNuKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbG9nZ2VyLmxvZygnTG9hZGluZyAgICAgICAnICsgZnJhZy5zbiArICcgb2YgWycgKyBmcmFnbWVudHNbMF0uc24gKyAnLCcgKyBmcmFnbWVudHNbZnJhZ21lbnRzLmxlbmd0aC0xXS5zbiArICddLGxldmVsICcgICsgbG9hZExldmVsKTtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuXG4gICAgICAgICAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgICAgICAgICAgdGhpcy5sZXZlbCA9IGxvYWRMZXZlbDtcbiAgICAgICAgICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIubG9hZChmcmFnLGxvYWRMZXZlbCk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gTE9BRElORztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIExPQURJTkc6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGZyYWdtZW50IHJldHJpZXZhbFxuICAgICAgY2FzZSBXQUlUSU5HX0xFVkVMOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBsZXZlbCByZXRyaWV2YWxcbiAgICAgIGNhc2UgUEFSU0lORzpcbiAgICAgICAgLy8gbm90aGluZyB0byBkbywgd2FpdCBmb3IgZnJhZ21lbnQgYmVpbmcgcGFyc2VkXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBQQVJTRUQ6XG4gICAgICBjYXNlIEFQUEVORElORzpcbiAgICAgICAgaWYgKHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgICAgLy8gaWYgTVA0IHNlZ21lbnQgYXBwZW5kaW5nIGluIHByb2dyZXNzIG5vdGhpbmcgdG8gZG9cbiAgICAgICAgICBpZigodGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIuYXVkaW8udXBkYXRpbmcpIHx8XG4gICAgICAgICAgICAgKHRoaXMuc291cmNlQnVmZmVyLnZpZGVvICYmIHRoaXMuc291cmNlQnVmZmVyLnZpZGVvLnVwZGF0aW5nKSkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdzYiBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgLy8gY2hlY2sgaWYgYW55IE1QNCBzZWdtZW50cyBsZWZ0IHRvIGFwcGVuZFxuICAgICAgICAgIH0gZWxzZSBpZih0aGlzLm1wNHNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHNlZ21lbnQgPSB0aGlzLm1wNHNlZ21lbnRzLnNoaWZ0KCk7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IEFQUEVORElORztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAgYnVmZmVySW5mbyhwb3MpIHtcbiAgICB2YXIgdiA9IHRoaXMudmlkZW8sXG4gICAgICAgIGJ1ZmZlcmVkID0gdi5idWZmZXJlZCxcbiAgICAgICAgYnVmZmVyTGVuLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJTdGFydCxidWZmZXJFbmQsXG4gICAgICAgIGk7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdO1xuICAgIC8vIHRoZXJlIG1pZ2h0IGJlIHNvbWUgc21hbGwgaG9sZXMgYmV0d2VlbiBidWZmZXIgdGltZSByYW5nZVxuICAgIC8vIGNvbnNpZGVyIHRoYXQgaG9sZXMgc21hbGxlciB0aGFuIDMwMCBtcyBhcmUgaXJyZWxldmFudCBhbmQgYnVpbGQgYW5vdGhlclxuICAgIC8vIGJ1ZmZlciB0aW1lIHJhbmdlIHJlcHJlc2VudGF0aW9ucyB0aGF0IGRpc2NhcmRzIHRob3NlIGhvbGVzXG4gICAgZm9yKGkgPSAwIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZigoYnVmZmVyZWQyLmxlbmd0aCkgJiYgKGJ1ZmZlcmVkLnN0YXJ0KGkpIC0gYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kICkgPCAwLjMpIHtcbiAgICAgICAgYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kID0gYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goe3N0YXJ0IDogYnVmZmVyZWQuc3RhcnQoaSksZW5kIDogYnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvcyA7IGkgPCBidWZmZXJlZDIubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmKChwb3MrMC4zKSA+PSBidWZmZXJlZDJbaV0uc3RhcnQgJiYgcG9zIDwgYnVmZmVyZWQyW2ldLmVuZCkge1xuICAgICAgICAvLyBwbGF5IHBvc2l0aW9uIGlzIGluc2lkZSB0aGlzIGJ1ZmZlciBUaW1lUmFuZ2UsIHJldHJpZXZlIGVuZCBvZiBidWZmZXIgcG9zaXRpb24gYW5kIGJ1ZmZlciBsZW5ndGhcbiAgICAgICAgYnVmZmVyU3RhcnQgPSBidWZmZXJlZDJbaV0uc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQgKyAwLjM7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtsZW4gOiBidWZmZXJMZW4sIHN0YXJ0IDogYnVmZmVyU3RhcnQsIGVuZCA6IGJ1ZmZlckVuZH07XG4gIH1cblxuXG4gIG9uTVNFQXR0YWNoZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMudmlkZW8gPSBkYXRhLnZpZGVvO1xuICAgIHRoaXMubWVkaWFTb3VyY2UgPSBkYXRhLm1lZGlhU291cmNlO1xuICAgIHRoaXMub252c2Vla2luZyA9IHRoaXMub25WaWRlb1NlZWtpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udm1ldGFkYXRhID0gdGhpcy5vblZpZGVvTWV0YWRhdGEuYmluZCh0aGlzKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgaWYodGhpcy5sZXZlbHMpIHtcbiAgICAgIHRoaXMuc3RhcnQoKTtcbiAgICB9XG4gIH1cbiAgb25WaWRlb1NlZWtpbmcoKSB7XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gTE9BRElORykge1xuICAgICAgLy8gY2hlY2sgaWYgY3VycmVudGx5IGxvYWRlZCBmcmFnbWVudCBpcyBpbnNpZGUgYnVmZmVyLlxuICAgICAgLy9pZiBvdXRzaWRlLCBjYW5jZWwgZnJhZ21lbnQgbG9hZGluZywgb3RoZXJ3aXNlIGRvIG5vdGhpbmdcbiAgICAgIGlmKHRoaXMuYnVmZmVySW5mbyh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKS5sZW4gPT09IDApIHtcbiAgICAgIGxvZ2dlci5sb2coJ3NlZWtpbmcgb3V0c2lkZSBvZiBidWZmZXIgd2hpbGUgZnJhZ21lbnQgbG9hZCBpbiBwcm9ncmVzcywgY2FuY2VsIGZyYWdtZW50IGxvYWQnKTtcbiAgICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIHByb2Nlc3NpbmdcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uVmlkZW9NZXRhZGF0YSgpIHtcbiAgICAgIGlmKHRoaXMudmlkZW8uY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lID0gdGhpcy5zdGFydFBvc2l0aW9uO1xuICAgIH1cbiAgICB0aGlzLmxvYWRlZG1ldGFkYXRhID0gdHJ1ZTtcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RQYXJzZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMuYXVkaW9jb2RlY3N3aXRjaCA9IGRhdGEuYXVkaW9jb2RlY3N3aXRjaDtcbiAgICBpZih0aGlzLmF1ZGlvY29kZWNzd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBhdWRpbyBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ21lbnRMb2FkZWQgPSBmYWxzZTtcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnN0YXJ0KCk7XG4gICAgfVxuICB9XG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgdmFyIGZyYWdtZW50cyA9IGRhdGEuZGV0YWlscy5mcmFnbWVudHMsZHVyYXRpb24gPSBkYXRhLmRldGFpbHMudG90YWxkdXJhdGlvbjtcbiAgICBsb2dnZXIubG9nKCdsZXZlbCAnICsgZGF0YS5sZXZlbElkICsgJyBsb2FkZWQgWycgKyBmcmFnbWVudHNbMF0uc24gKyAnLCcgKyBmcmFnbWVudHNbZnJhZ21lbnRzLmxlbmd0aC0xXS5zbiArICddLGR1cmF0aW9uOicgKyBkdXJhdGlvbik7XG5cbiAgICB2YXIgbGV2ZWwgPSB0aGlzLmxldmVsc1tkYXRhLmxldmVsSWRdLHNsaWRpbmcgPSAwLCBsZXZlbEN1cnJlbnQgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXTtcbiAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZCAoaWYgeWVzLCBpdCBzaG91bGQgYmUgYSBsaXZlIHBsYXlsaXN0KVxuICAgIGlmKGxldmVsQ3VycmVudCAmJiBsZXZlbEN1cnJlbnQuZGV0YWlscyAmJiBsZXZlbEN1cnJlbnQuZGV0YWlscy5saXZlKSB7XG4gICAgICAvLyAgcGxheWxpc3Qgc2xpZGluZyBpcyB0aGUgc3VtIG9mIDogY3VycmVudCBwbGF5bGlzdCBzbGlkaW5nICsgc2xpZGluZyBvZiBuZXcgcGxheWxpc3QgY29tcGFyZWQgdG8gY3VycmVudCBvbmVcbiAgICAgIHNsaWRpbmcgPSBsZXZlbEN1cnJlbnQuZGV0YWlscy5zbGlkaW5nO1xuICAgICAgLy8gY2hlY2sgc2xpZGluZyBvZiB1cGRhdGVkIHBsYXlsaXN0IGFnYWluc3QgY3VycmVudCBvbmUgOlxuICAgICAgLy8gYW5kIGZpbmQgaXRzIHBvc2l0aW9uIGluIGN1cnJlbnQgcGxheWxpc3RcbiAgICAgIC8vbG9nZ2VyLmxvZyhcImZyYWdtZW50c1swXS5zbi90aGlzLmxldmVsL2xldmVsQ3VycmVudC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbjpcIiArIGZyYWdtZW50c1swXS5zbiArIFwiL1wiICsgdGhpcy5sZXZlbCArIFwiL1wiICsgbGV2ZWxDdXJyZW50LmRldGFpbHMuZnJhZ21lbnRzWzBdLnNuKTtcbiAgICAgIHZhciBTTmRpZmYgPSBmcmFnbWVudHNbMF0uc24gLSBsZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbMF0uc247XG4gICAgICBpZihTTmRpZmYgPj0wKSB7XG4gICAgICAgIC8vIHBvc2l0aXZlIHNsaWRpbmcgOiBuZXcgcGxheWxpc3Qgc2xpZGluZyB3aW5kb3cgaXMgYWZ0ZXIgcHJldmlvdXMgb25lXG4gICAgICAgIHNsaWRpbmcgKz0gbGV2ZWxDdXJyZW50LmRldGFpbHMuZnJhZ21lbnRzW1NOZGlmZl0uc3RhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBuZWdhdGl2ZSBzbGlkaW5nOiBuZXcgcGxheWxpc3Qgc2xpZGluZyB3aW5kb3cgaXMgYmVmb3JlIHByZXZpb3VzIG9uZVxuICAgICAgICBzbGlkaW5nIC09IGZyYWdtZW50c1stU05kaWZmXS5zdGFydDtcbiAgICAgIH1cbiAgICAgIGxvZ2dlci5sb2coJ2xpdmUgcGxheWxpc3Qgc2xpZGluZzonICsgc2xpZGluZy50b0ZpeGVkKDMpKTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGxldmVsLmRldGFpbHMgPSBkYXRhLmRldGFpbHM7XG4gICAgbGV2ZWwuZGV0YWlscy5zbGlkaW5nID0gc2xpZGluZztcbiAgICB0aGlzLmRlbXV4ZXIuc2V0RHVyYXRpb24oZHVyYXRpb24pO1xuICAgIGlmKHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3QsIHNldCBzdGFydCBwb3NpdGlvbiB0byBiZSBmcmFnbWVudCBOLTNcbiAgICAgIGlmKGRhdGEuZGV0YWlscy5saXZlKSB7XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IE1hdGgubWF4KDAsZHVyYXRpb24gLSAzICogZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IDA7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBvbmx5IHN3aXRjaCBiYXRjayB0byBJRExFIHN0YXRlIGlmIHdlIHdlcmUgd2FpdGluZyBmb3IgbGV2ZWwgdG8gc3RhcnQgZG93bmxvYWRpbmcgYSBuZXcgZnJhZ21lbnRcbiAgICBpZih0aGlzLnN0YXRlID09PSBXQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSBMT0FESU5HKSB7XG4gICAgICBpZih0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPT09IHRydWUpIHtcbiAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSAuLi4gd2UganVzdCBsb2FkZWQgYSBmcmFnbWVudCB0byBkZXRlcm1pbmUgYWRlcXVhdGUgc3RhcnQgYml0cmF0ZSBhbmQgaW5pdGlhbGl6ZSBhdXRvc3dpdGNoIGFsZ29cbiAgICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IGRhdGEuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBQQVJTSU5HO1xuICAgICAgICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgICAgIHRoaXMuc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgICAgICB0aGlzLmRlbXV4ZXIucHVzaChkYXRhLnBheWxvYWQsdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYyx0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjLHRoaXMuZnJhZy5zdGFydCk7XG4gICAgICB9XG4gICAgICB0aGlzLnN0YXJ0RnJhZ21lbnRMb2FkZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIG9uSW5pdFNlZ21lbnQoZXZlbnQsZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGNvZGVjcyBoYXZlIGJlZW4gZXhwbGljaXRlbHkgZGVmaW5lZCBpbiB0aGUgbWFzdGVyIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsO1xuICAgIC8vIGlmIHllcyB1c2UgdGhlc2Ugb25lcyBpbnN0ZWFkIG9mIHRoZSBvbmVzIHBhcnNlZCBmcm9tIHRoZSBkZW11eFxuICAgIHZhciBhdWRpb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYywgdmlkZW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWMsc2I7XG4gICAgLy9sb2dnZXIubG9nKCdwbGF5bGlzdCBsZXZlbCBBL1YgY29kZWNzOicgKyBhdWRpb0NvZGVjICsgJywnICsgdmlkZW9Db2RlYyk7XG4gICAgLy9sb2dnZXIubG9nKCdwbGF5bGlzdCBjb2RlY3M6JyArIGNvZGVjKTtcbiAgICAvLyBpZiBwbGF5bGlzdCBkb2VzIG5vdCBzcGVjaWZ5IGNvZGVjcywgdXNlIGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50XG4gICAgaWYoYXVkaW9Db2RlYyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBhdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgIH1cbiAgICBpZih2aWRlb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgfVxuXG4gICAgLy8gY29kZWM9XCJtcDRhLjQwLjUsYXZjMS40MjAwMTZcIjtcbiAgICAvLyBpbiBjYXNlIHNldmVyYWwgYXVkaW8gY29kZWNzIG1pZ2h0IGJlIHVzZWQsIGZvcmNlIEhFLUFBQyBmb3IgYXVkaW8gKHNvbWUgYnJvd3NlcnMgZG9uJ3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2gpXG4gICAgLy9kb24ndCBkbyBpdCBmb3IgbW9ubyBzdHJlYW1zIC4uLlxuICAgIGlmKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCAmJiBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID09PSAyICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICBhdWRpb0NvZGVjID0gJ21wNGEuNDAuNSc7XG4gICAgfVxuICAgIGlmKCF0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSB7fTtcbiAgICAgIGxvZ2dlci5sb2coJ3NlbGVjdGVkIEEvViBjb2RlY3MgZm9yIHNvdXJjZUJ1ZmZlcnM6JyArIGF1ZGlvQ29kZWMgKyAnLCcgKyB2aWRlb0NvZGVjKTtcbiAgICAgIC8vIGNyZWF0ZSBzb3VyY2UgQnVmZmVyIGFuZCBsaW5rIHRoZW0gdG8gTWVkaWFTb3VyY2VcbiAgICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKCd2aWRlby9tcDQ7Y29kZWNzPScgKyBhdWRpb0NvZGVjKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoJ3ZpZGVvL21wNDtjb2RlY3M9JyArIHZpZGVvQ29kZWMpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiAnYXVkaW8nLCBkYXRhIDogZGF0YS5hdWRpb01vb3Z9KTtcbiAgICB9XG4gICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6ICd2aWRlbycsIGRhdGEgOiBkYXRhLnZpZGVvTW9vdn0pO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRQYXJzaW5nKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgIGlmKGxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgbGV2ZWwuZGV0YWlscy5zbGlkaW5nID0gZGF0YS5zdGFydFBUUyAtIHRoaXMuZnJhZy5zdGFydDtcbiAgICB9XG4gICAgbG9nZ2VyLmxvZygnICAgICAgcGFyc2VkIGRhdGEsIHR5cGUvc3RhcnRQVFMvZW5kUFRTL3N0YXJ0RFRTL2VuZERUUy9zbGlkaW5nOicgKyBkYXRhLnR5cGUgKyAnLycgKyBkYXRhLnN0YXJ0UFRTLnRvRml4ZWQoMykgKyAnLycgKyBkYXRhLmVuZFBUUy50b0ZpeGVkKDMpICsgJy8nICsgZGF0YS5zdGFydERUUy50b0ZpeGVkKDMpICsgJy8nICsgZGF0YS5lbmREVFMudG9GaXhlZCgzKSArICcvJyArIGxldmVsLmRldGFpbHMuc2xpZGluZy50b0ZpeGVkKDMpKTtcbiAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogZGF0YS50eXBlLCBkYXRhIDogZGF0YS5tb29mfSk7XG4gICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6IGRhdGEudHlwZSwgZGF0YSA6IGRhdGEubWRhdH0pO1xuICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IGRhdGEuZW5kUFRTO1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25GcmFnbWVudFBhcnNlZCgpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBQQVJTRUQ7XG4gICAgICB0aGlzLnN0YXRzLnRwYXJzZWQgPSBuZXcgRGF0ZSgpO1xuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQoKSB7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgaWYodGhpcy5zdGF0ZSA9PT0gQVBQRU5ESU5HICYmIHRoaXMubXA0c2VnbWVudHMubGVuZ3RoID09PSAwKSAge1xuICAgICAgdGhpcy5zdGF0cy50YnVmZmVyZWQgPSBuZXcgRGF0ZSgpO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7IHN0YXRzIDogdGhpcy5zdGF0cywgZnJhZyA6IHRoaXMuZnJhZ30pO1xuICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgfVxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJFcnJvcihldmVudCkge1xuICAgICAgbG9nZ2VyLmxvZygnIGJ1ZmZlciBhcHBlbmQgZXJyb3I6JyArIGV2ZW50KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCdWZmZXJDb250cm9sbGVyO1xuIiwiLypcbiAqIGxldmVsIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cblxuIGNsYXNzIExldmVsQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IocGxheWxpc3RMb2FkZXIpIHtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gcGxheWxpc3RMb2FkZXI7XG4gICAgdGhpcy5vbm1sID0gdGhpcy5vbk1hbmlmZXN0TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdtZW50TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICAgIC8vdGhpcy5zdGFydExldmVsID0gc3RhcnRMZXZlbDtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB0aGlzLm9ubWwpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMuX21hbnVhbExldmVsID0gLTE7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgbGV2ZWxzID0gW10sYml0cmF0ZVN0YXJ0LGksYml0cmF0ZVNldD17fSwgYWFjPWZhbHNlLCBoZWFhYz1mYWxzZSxjb2RlY3M7XG4gICAgLy8gcmVtb3ZlIGZhaWxvdmVyIGxldmVsIGZvciBub3cgdG8gc2ltcGxpZnkgdGhlIGxvZ2ljXG4gICAgZGF0YS5sZXZlbHMuZm9yRWFjaChsZXZlbCA9PiB7XG4gICAgICBpZighYml0cmF0ZVNldC5oYXNPd25Qcm9wZXJ0eShsZXZlbC5iaXRyYXRlKSkge1xuICAgICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICAgIGJpdHJhdGVTZXRbbGV2ZWwuYml0cmF0ZV0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgLy8gZGV0ZWN0IGlmIHdlIGhhdmUgZGlmZmVyZW50IGtpbmQgb2YgYXVkaW8gY29kZWNzIHVzZWQgYW1vbmdzdCBwbGF5bGlzdHNcbiAgICAgIGNvZGVjcyA9IGxldmVsLmNvZGVjcztcbiAgICAgIGlmKGNvZGVjcykge1xuICAgICAgICBpZihjb2RlY3MuaW5kZXhPZignbXA0YS40MC4yJykgIT09IC0xKSB7XG4gICAgICAgICAgYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZihjb2RlY3MuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSB7XG4gICAgICAgICAgaGVhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICBiaXRyYXRlU3RhcnQgPSBsZXZlbHNbMF0uYml0cmF0ZTtcbiAgICAvLyBzb3J0IGxldmVsIG9uIGJpdHJhdGVcbiAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgcmV0dXJuIGEuYml0cmF0ZS1iLmJpdHJhdGU7XG4gICAgfSk7XG4gICAgdGhpcy5fbGV2ZWxzID0gbGV2ZWxzO1xuXG4gICAgaWYodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmaW5kIGluZGV4IG9mIHN0YXJ0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICAgIGZvcihpPTA7IGkgPCBsZXZlbHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIGlmKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLl9zdGFydExldmVsID0gaTtcbiAgICAgICAgICBsb2dnZXIubG9nKCdtYW5pZmVzdCBsb2FkZWQsJyArIGxldmVscy5sZW5ndGggKyAnIGxldmVsKHMpIGZvdW5kLCBzdGFydCBiaXRyYXRlOicgKyBiaXRyYXRlU3RhcnQpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy90aGlzLl9zdGFydExldmVsID0gLTE7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5fbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0TGV2ZWwgOiB0aGlzLl9zdGFydExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvY29kZWNzd2l0Y2ggOiAoYWFjICYmIGhlYWFjKVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsKSB7XG4gICAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICAgIGlmKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLl9sZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgICAgbG9nZ2VyLmxvZygnc3dpdGNoaW5nIHRvIGxldmVsICcgKyBuZXdMZXZlbCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7IGxldmVsSWQgOiBuZXdMZXZlbH0pO1xuICAgICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdO1xuICAgICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICAgIGlmKGxldmVsLmxvYWRpbmcgPT09IHVuZGVmaW5lZCB8fCAobGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpKSB7XG4gICAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIG9yIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byAocmUpbG9hZCBpdFxuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyBsZXZlbElkIDogbmV3TGV2ZWx9KTtcbiAgICAgICAgICBsb2dnZXIubG9nKCcocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJyArIG5ld0xldmVsKTtcbiAgICAgICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmxvYWQobGV2ZWwudXJsLG5ld0xldmVsKTtcbiAgICAgICAgICBsZXZlbC5sb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0VSUk9SLCB7IGxldmVsIDogbmV3TGV2ZWwsIGV2ZW50OiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RhcnRMZXZlbDtcbiAgfVxuXG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMscnR0LGxvYWR0aW1lO1xuICAgIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBydHQgPSBzdGF0cy50Zmlyc3QgLSBzdGF0cy50cmVxdWVzdDtcbiAgICBsb2FkdGltZSA9IHN0YXRzLnRsb2FkIC0gc3RhdHMudHJlcXVlc3Q7XG4gICAgdGhpcy5sYXN0YncgPSBzdGF0cy5sZW5ndGgqODAwMC9sb2FkdGltZTtcbiAgfVxuXG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZihkYXRhLmRldGFpbHMubGl2ZSAmJiAhdGhpcy50aW1lcikge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCB3ZSB3aWxsIGhhdmUgdG8gcmVsb2FkIGl0IHBlcmlvZGljYWxseVxuICAgICAgLy8gc2V0IHJlbG9hZCBwZXJpb2QgdG8gcGxheWxpc3QgdGFyZ2V0IGR1cmF0aW9uXG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMDAqZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyBsZXZlbElkIDogdGhpcy5fbGV2ZWx9KTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmxvYWQodGhpcy5fbGV2ZWxzW3RoaXMuX2xldmVsXS51cmwsdGhpcy5fbGV2ZWwpO1xuICB9XG5cbiAgbmV4dExldmVsKCkge1xuICAgIGlmKHRoaXMuX21hbnVhbExldmVsICE9PSAtMSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgIHJldHVybiB0aGlzLm5leHRBdXRvTGV2ZWwoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidyxhZGp1c3RlZGJ3LGksbWF4QXV0b0xldmVsO1xuICAgIGlmKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9sZXZlbHMubGVuZ3RoLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IoaSA9MDsgaSA8PSBtYXhBdXRvTGV2ZWwgOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmKGkgPD0gdGhpcy5fbGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCpsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43Kmxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmKGFkanVzdGVkYncgPCB0aGlzLl9sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCxpLTEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaS0xO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi90c2RlbXV4ZXInO1xuIGltcG9ydCBUU0RlbXV4ZXJXb3JrZXIgICAgICBmcm9tICcuL3RzZGVtdXhlcndvcmtlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB2YXIgZW5hYmxlV29ya2VyID0gdHJ1ZTtcbiAgICBpZihlbmFibGVXb3JrZXIgJiYgKHR5cGVvZihXb3JrZXIpICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgIGxvZ2dlci5sb2coJ1RTIGRlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgdmFyIHdvcmsgPSByZXF1aXJlKCd3ZWJ3b3JraWZ5Jyk7XG4gICAgICB0aGlzLncgPSB3b3JrKFRTRGVtdXhlcldvcmtlcik7XG4gICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLncuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdpbml0J30pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgfVxuICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBzZXREdXJhdGlvbihuZXdEdXJhdGlvbikge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2R1cmF0aW9uJyAsIGRhdGEgOiBuZXdEdXJhdGlvbn0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuc2V0RHVyYXRpb24obmV3RHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQpIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdkZW11eCcgLCBkYXRhIDogZGF0YSwgYXVkaW9Db2RlYyA6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQgOiB0aW1lT2Zmc2V0fSxbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCk7XG4gICAgICB0aGlzLmRlbXV4ZXIuZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnc3dpdGNoTGV2ZWwnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZihldi5kYXRhLmF1ZGlvTW9vdikge1xuICAgICAgICAgIG9iai5hdWRpb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLmF1ZGlvTW9vdik7XG4gICAgICAgICAgb2JqLmF1ZGlvQ29kZWMgPSBldi5kYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgICAgb2JqLmF1ZGlvQ2hhbm5lbENvdW50ID0gZXYuZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgbW9vZiA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubW9vZiksXG4gICAgICAgICAgbWRhdCA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFMgOiBldi5kYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUyA6IGV2LmRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTIDogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFMgOiBldi5kYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlIDogZXYuZGF0YS50eXBlXG4gICAgICAgIH0pO1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0VEOlxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcjtcbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nXG4gKiBzY2hlbWUgdXNlZCBieSBoMjY0LlxuICovXG5cbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3Rvcih3b3JraW5nRGF0YSkge1xuICAgIHRoaXMud29ya2luZ0RhdGEgPSB3b3JraW5nRGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLndvcmtpbmdEYXRhXG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29ya2luZ1dvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy53b3JraW5nRGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUpO1xuXG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cblxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy53b3JraW5nRGF0YS5zdWJhcnJheShwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmtpbmdXb3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcblxuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy53b3JraW5nRGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH1cblxuICAvLyAoY291bnQ6aW50KTp2b2lkXG4gIHNraXBCaXRzKGNvdW50KSB7XG4gICAgdmFyIHNraXBCeXRlczsgLy8gOmludFxuICAgIGlmICh0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29ya2luZ1dvcmQgICAgICAgICAgPDw9IGNvdW50O1xuICAgICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9IGVsc2Uge1xuICAgICAgY291bnQgLT0gdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG5cbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgPj4gMyk7XG4gICAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG5cbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcblxuICAgICAgdGhpcy53b3JraW5nV29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JraW5nV29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG5cbiAgICBpZihzaXplID4zMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG5cbiAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuXG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExlYWRpbmdaZXJvcygpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwIDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JraW5nV29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JraW5nV29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVbnNpZ25lZEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFeHBHb2xvbWIoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVW5zaWduZWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExlYWRpbmdaZXJvcygpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRXhwR29sb21iKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVbnNpZ25lZEJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvKipcbiAgICogQWR2YW5jZSB0aGUgRXhwR29sb21iIGRlY29kZXIgcGFzdCBhIHNjYWxpbmcgbGlzdC4gVGhlIHNjYWxpbmdcbiAgICogbGlzdCBpcyBvcHRpb25hbGx5IHRyYW5zbWl0dGVkIGFzIHBhcnQgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXJcbiAgICogc2V0IGFuZCBpcyBub3QgcmVsZXZhbnQgdG8gdHJhbnNtdXhpbmcuXG4gICAqIEBwYXJhbSBjb3VudCB7bnVtYmVyfSB0aGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhpcyBzY2FsaW5nIGxpc3RcbiAgICogQHNlZSBSZWNvbW1lbmRhdGlvbiBJVFUtVCBILjI2NCwgU2VjdGlvbiA3LjMuMi4xLjEuMVxuICAgKi9cbiAgc2tpcFNjYWxpbmdMaXN0KGNvdW50KSB7XG4gICAgdmFyXG4gICAgICBsYXN0U2NhbGUgPSA4LFxuICAgICAgbmV4dFNjYWxlID0gOCxcbiAgICAgIGosXG4gICAgICBkZWx0YVNjYWxlO1xuXG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEV4cEdvbG9tYigpO1xuICAgICAgICBuZXh0U2NhbGUgPSAobGFzdFNjYWxlICsgZGVsdGFTY2FsZSArIDI1NikgJSAyNTY7XG4gICAgICB9XG5cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNlcXVlbmNlUGFyYW1ldGVyU2V0KCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdGliaWxpdHksbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuXG4gICAgdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVuc2lnbmVkQnl0ZSgpOyAvLyBwcm9maWxlX2lkY1xuICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuXG4gICAgLy8gc29tZSBwcm9maWxlcyBoYXZlIG1vcmUgb3B0aW9uYWwgZGF0YSB3ZSBkb24ndCBuZWVkXG4gICAgaWYgKHByb2ZpbGVJZGMgPT09IDEwMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTIyIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDE0NCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcblxuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG5cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBwcm9maWxlSWRjIDogcHJvZmlsZUlkYyxcbiAgICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5IDogcHJvZmlsZUNvbXBhdGliaWxpdHksXG4gICAgICBsZXZlbElkYyA6IGxldmVsSWRjLFxuICAgICAgd2lkdGg6ICgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtIChmcmFtZUNyb3BUb3BPZmZzZXQgKiAyKSAtIChmcmFtZUNyb3BCb3R0b21PZmZzZXQgKiAyKVxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBBIHN0cmVhbS1iYXNlZCBtcDJ0cyB0byBtcDQgY29udmVydGVyLiBUaGlzIHV0aWxpdHkgaXMgdXNlZCB0b1xuICogZGVsaXZlciBtcDRzIHRvIGEgU291cmNlQnVmZmVyIG9uIHBsYXRmb3JtcyB0aGF0IHN1cHBvcnQgbmF0aXZlXG4gKiBNZWRpYSBTb3VyY2UgRXh0ZW5zaW9ucy5cbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFeHBHb2xvbWIgICAgICAgZnJvbSAnLi9leHAtZ29sb21iJztcbi8vIGltcG9ydCBIZXggICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvaGV4JztcbiBpbXBvcnQgTVA0ICAgICAgICAgICAgIGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuLy8gaW1wb3J0IE1QNEluc3BlY3QgICAgICBmcm9tICcuLi9yZW11eC9tcDQtaW5zcGVjdG9yJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgfVxuXG4gIHNldER1cmF0aW9uKG5ld0R1cmF0aW9uKSB7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBuZXdEdXJhdGlvbjtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSB0aGlzLl9hdmNJZCA9IHRoaXMuX2FhY0lkID0gLTE7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7dHlwZSA6ICd2aWRlbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZSA6ICdhdWRpbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYXZjU2FtcGxlcyA9IFtdO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgPSAwO1xuICAgIHRoaXMuX2FhY1NhbXBsZXMgPSBbXTtcbiAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSxhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLHRpbWVPZmZzZXQpIHtcbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB2YXIgb2Zmc2V0O1xuICAgIGZvcihvZmZzZXQgPSAwOyBvZmZzZXQgPCBkYXRhLmxlbmd0aCA7IG9mZnNldCArPSAxODgpIHtcbiAgICAgIHRoaXMuX3BhcnNlVFNQYWNrZXQoZGF0YSxvZmZzZXQpO1xuICAgIH1cbiAgfVxuICAvLyBmbHVzaCBhbnkgYnVmZmVyZWQgZGF0YVxuICBlbmQoKSB7XG4gICAgaWYodGhpcy5fYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYXZjRGF0YSkpO1xuICAgICAgdGhpcy5fYXZjRGF0YSA9IG51bGw7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBVkNTYW1wbGVzKCk7XG4gICAgfVxuICAgIGlmKHRoaXMuX2FhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2FhY0RhdGEpKTtcbiAgICAgIHRoaXMuX2FhY0RhdGEgPSBudWxsO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyB0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQUFDU2FtcGxlcygpO1xuICAgIH1cbiAgICAvL25vdGlmeSBlbmQgb2YgcGFyc2luZ1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VUU1BhY2tldChkYXRhLHN0YXJ0KSB7XG4gICAgdmFyIHN0dCxwaWQsYXRmLG9mZnNldDtcbiAgICBpZihkYXRhW3N0YXJ0XSA9PT0gMHg0Nykge1xuICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCsxXSAmIDB4NDApO1xuICAgICAgLy8gcGlkIGlzIGEgMTMtYml0IGZpZWxkIHN0YXJ0aW5nIGF0IHRoZSBsYXN0IGJpdCBvZiBUU1sxXVxuICAgICAgcGlkID0gKChkYXRhW3N0YXJ0KzFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0KzJdO1xuICAgICAgYXRmID0gKGRhdGFbc3RhcnQrM10gJiAweDMwKSA+PiA0O1xuICAgICAgLy8gaWYgYW4gYWRhcHRpb24gZmllbGQgaXMgcHJlc2VudCwgaXRzIGxlbmd0aCBpcyBzcGVjaWZpZWQgYnkgdGhlIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuXG4gICAgICBpZihhdGYgPiAxKSB7XG4gICAgICAgIG9mZnNldCA9IHN0YXJ0KzUrZGF0YVtzdGFydCs0XTtcbiAgICAgICAgLy8gcmV0dXJuIGlmIHRoZXJlIGlzIG9ubHkgYWRhcHRhdGlvbiBmaWVsZFxuICAgICAgICBpZihvZmZzZXQgPT09IChzdGFydCsxODgpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvZmZzZXQgPSBzdGFydCs0O1xuICAgICAgfVxuICAgICAgaWYodGhpcy5wbXRQYXJzZWQpIHtcbiAgICAgICAgaWYocGlkID09PSB0aGlzLl9hdmNJZCkge1xuICAgICAgICAgIGlmKHN0dCkge1xuICAgICAgICAgICAgaWYodGhpcy5fYXZjRGF0YSkge1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyh0aGlzLl9hdmNEYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9hdmNEYXRhID0ge2RhdGE6IFtdLHNpemU6IDB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9hdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCxzdGFydCsxODgpKTtcbiAgICAgICAgICB0aGlzLl9hdmNEYXRhLnNpemUrPXN0YXJ0KzE4OC1vZmZzZXQ7XG4gICAgICAgIH0gZWxzZSBpZihwaWQgPT09IHRoaXMuX2FhY0lkKSB7XG4gICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICBpZih0aGlzLl9hYWNEYXRhKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2FhY0RhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2FhY0RhdGEgPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2FhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LHN0YXJ0KzE4OCkpO1xuICAgICAgICAgIHRoaXMuX2FhY0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgb2Zmc2V0ICs9IGRhdGFbb2Zmc2V0XSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYocGlkID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5fcGFyc2VQQVQoZGF0YSxvZmZzZXQpO1xuICAgICAgICB9IGVsc2UgaWYocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsb2Zmc2V0KTtcbiAgICAgICAgICB0aGlzLnBtdFBhcnNlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLmxvZygncGFyc2luZyBlcnJvcicpO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBBVChkYXRhLG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQrMTBdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0KzExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSxvZmZzZXQpIHtcbiAgICB2YXIgc2VjdGlvbkxlbmd0aCx0YWJsZUVuZCxwcm9ncmFtSW5mb0xlbmd0aCxwaWQ7XG4gICAgc2VjdGlvbkxlbmd0aCA9IChkYXRhW29mZnNldCsxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCsyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0KzEwXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCsxMV07XG5cbiAgICAvLyBhZHZhbmNlIHRoZSBvZmZzZXQgdG8gdGhlIGZpcnN0IGVudHJ5IGluIHRoZSBtYXBwaW5nIHRhYmxlXG4gICAgb2Zmc2V0ICs9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICBwaWQgPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgICAgc3dpdGNoKGRhdGFbb2Zmc2V0XSkge1xuICAgICAgICAvLyBJU08vSUVDIDEzODE4LTcgQURUUyBBQUMgKE1QRUctMiBsb3dlciBiaXQtcmF0ZSBhdWRpbylcbiAgICAgICAgY2FzZSAweDBmOlxuICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY0lkID0gcGlkO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgLy9sb2dnZXIubG9nKCdBVkMgUElEOicgICsgcGlkKTtcbiAgICAgICAgdGhpcy5fYXZjSWQgPSBwaWQ7XG4gICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgbG9nZ2VyLmxvZygndW5rb3duIHN0cmVhbSB0eXBlOicgICsgZGF0YVtvZmZzZXRdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChkYXRhW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VQRVMoc3RyZWFtKSB7XG4gICAgdmFyIGkgPSAwLGZyYWcscGVzRmxhZ3MscGVzUHJlZml4LHBlc0xlbixwZXNIZHJMZW4scGVzRGF0YSxwZXNQdHMscGVzRHRzLHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBzdHJlYW0uZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8vIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICBwZXNQdHMgPSAoZnJhZ1s5XSAmIDB4MEUpIDw8IDI4XG4gICAgICAgICAgfCAoZnJhZ1sxMF0gJiAweEZGKSA8PCAyMVxuICAgICAgICAgIHwgKGZyYWdbMTFdICYgMHhGRSkgPDwgMTNcbiAgICAgICAgICB8IChmcmFnWzEyXSAmIDB4RkYpIDw8ICA2XG4gICAgICAgICAgfCAoZnJhZ1sxM10gJiAweEZFKSA+Pj4gIDI7XG4gICAgICAgIHBlc1B0cyAvPSA0NTtcbiAgICAgICAgaWYgKHBlc0ZsYWdzICYgMHg0MCkge1xuICAgICAgICAgIHBlc0R0cyA9IChmcmFnWzE0XSAmIDB4MEUgKSA8PCAyOFxuICAgICAgICAgICAgfCAoZnJhZ1sxNV0gJiAweEZGICkgPDwgMjFcbiAgICAgICAgICAgIHwgKGZyYWdbMTZdICYgMHhGRSApIDw8IDEzXG4gICAgICAgICAgICB8IChmcmFnWzE3XSAmIDB4RkYgKSA8PCA2XG4gICAgICAgICAgICB8IChmcmFnWzE4XSAmIDB4RkUgKSA+Pj4gMjtcbiAgICAgICAgICBwZXNEdHMgLz0gNDU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVzRHRzID0gcGVzUHRzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZXNIZHJMZW4gPSBmcmFnWzhdO1xuICAgICAgcGF5bG9hZFN0YXJ0T2Zmc2V0ID0gcGVzSGRyTGVuKzk7XG4gICAgICAvLyB0cmltIFBFUyBoZWFkZXJcbiAgICAgIHN0cmVhbS5kYXRhWzBdID0gc3RyZWFtLmRhdGFbMF0uc3ViYXJyYXkocGF5bG9hZFN0YXJ0T2Zmc2V0KTtcbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgLy8gcmVhc3NlbWJsZSB0aGUgcGFja2V0XG4gICAgICB3aGlsZSAoc3RyZWFtLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBzdHJlYW0uZGF0YS5zaGlmdCgpO1xuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSArPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBkYXRhIDogcGVzRGF0YSwgcHRzIDogcGVzUHRzLCBkdHMgOiBwZXNEdHMsIGxlbiA6IHBlc0xlbn07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUFWQ1BFUyhwZXMpIHtcbiAgICB2YXIgdW5pdHMsdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxhdmNTYW1wbGUsa2V5ID0gZmFsc2U7XG4gICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpO1xuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHVuaXRzLnVuaXRzLmZvckVhY2godW5pdCA9PiB7XG4gICAgICBzd2l0Y2godW5pdC50eXBlKSB7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NQU1xuICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgaWYoIXRyYWNrLnNwcykge1xuICAgICAgICAgICAgdmFyIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU2VxdWVuY2VQYXJhbWV0ZXJTZXQoKTtcbiAgICAgICAgICAgIHRyYWNrLndpZHRoID0gY29uZmlnLndpZHRoO1xuICAgICAgICAgICAgdHJhY2suaGVpZ2h0ID0gY29uZmlnLmhlaWdodDtcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMgPSBjb25maWcucHJvZmlsZUlkYztcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXRpYmlsaXR5ID0gY29uZmlnLnByb2ZpbGVDb21wYXRpYmlsaXR5O1xuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMgPSBjb25maWcubGV2ZWxJZGM7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gOTAwMDAqdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB2YXIgY29kZWNhcnJheSA9IHVuaXQuZGF0YS5zdWJhcnJheSgxLDQpO1xuICAgICAgICAgICAgdmFyIGNvZGVjc3RyaW5nICA9ICdhdmMxLic7XG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGggPSBjb2RlY2FycmF5W2ldLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgIGggPSAnMCcgKyBoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlY3N0cmluZyArPSBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhY2suY29kZWMgPSBjb2RlY3N0cmluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vUFBTXG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICBpZighdHJhY2sucHBzKSB7XG4gICAgICAgICAgICB0cmFjay5wcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy9idWlsZCBzYW1wbGUgZnJvbSBQRVNcbiAgICAvLyBBbm5leCBCIHRvIE1QNCBjb252ZXJzaW9uIHRvIGJlIGRvbmVcbiAgICBhdmNTYW1wbGUgPSB7IHVuaXRzIDogdW5pdHMsIHB0cyA6IHBlcy5wdHMsIGR0cyA6IHBlcy5kdHMgLCBrZXkgOiBrZXl9O1xuICAgIHRoaXMuX2F2Y1NhbXBsZXMucHVzaChhdmNTYW1wbGUpO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggKz0gdW5pdHMubGVuZ3RoO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgKz0gdW5pdHMudW5pdHMubGVuZ3RoO1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgfVxuXG5cbiAgX2ZsdXNoQVZDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYXZjU2FtcGxlLG1wNFNhbXBsZSxtcDRTYW1wbGVMZW5ndGgsdW5pdCx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBsYXN0U2FtcGxlRFRTLG1kYXQsbW9vZixzdGFydE9mZnNldCxlbmRPZmZzZXQsXG4gICAgICAgIGZpcnN0UFRTLGZpcnN0RFRTO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArICg0ICogdGhpcy5fYXZjU2FtcGxlc05iTmFsdSkrOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCxtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LDQpO1xuICAgIHdoaWxlKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuXG4gICAgICAvLyBjb252ZXJ0IE5BTFUgYml0c3RyZWFtIHRvIE1QNCBmb3JtYXQgKHByZXBlbmQgTkFMVSB3aXRoIHNpemUgZmllbGQpXG4gICAgICB3aGlsZShhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoaSwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBpICs9IDQ7XG4gICAgICAgIG1kYXQuc2V0KHVuaXQuZGF0YSwgaSk7XG4gICAgICAgIGkgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCs9NCt1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgYXZjU2FtcGxlLnB0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgYXZjU2FtcGxlLmR0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTOicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyk7XG5cbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBNYXRoLnJvdW5kKChhdmNTYW1wbGUuZHRzIC0gbGFzdFNhbXBsZURUUykqOTApO1xuICAgICAgICBpZihtcDRTYW1wbGUuZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdpbnZhbGlkIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMvRFRTOjonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMgKyAnOicgKyBtcDRTYW1wbGUuZHVyYXRpb24pO1xuICAgICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IDA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNoZWNrIGlmIGZyYWdtZW50cyBhcmUgY29udGlndW91cyAoaS5lLiBubyBtaXNzaW5nIGZyYW1lcyBiZXR3ZWVuIGZyYWdtZW50KVxuICAgICAgICBpZih0aGlzLm5leHRBdmNQdHMpIHtcbiAgICAgICAgICB2YXIgZGVsdGEgPSBhdmNTYW1wbGUucHRzIC0gdGhpcy5uZXh0QXZjUHRzLGFic2RlbHRhPU1hdGguYWJzKGRlbHRhKTtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fic2RlbHRhL2F2Y1NhbXBsZS5wdHM6JyArIGFic2RlbHRhICsgJy8nICsgYXZjU2FtcGxlLnB0cyk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihhYnNkZWx0YSA8IDMwMCkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdWaWRlbyBuZXh0IFBUUzonICsgdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdBVkM6JyArIGRlbHRhLnRvRml4ZWQoMCkgKyAnIG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdCcpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FWQzonICsgKC1kZWx0YS50b0ZpeGVkKDApKSArICcgbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFNcbiAgICAgICAgICAgIGF2Y1NhbXBsZS5wdHMgPSB0aGlzLm5leHRBdmNQdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgRFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IERUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IFBUU1xuICAgICAgICAgICAgYXZjU2FtcGxlLmR0cyA9IE1hdGgubWF4KGF2Y1NhbXBsZS5kdHMtZGVsdGEsIHRoaXMubGFzdEF2Y0R0cyk7XG4gICAgICAgICAgIC8vIGxvZ2dlci5sb2coJ1ZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzXG4gICAgICAgIGZpcnN0UFRTID0gYXZjU2FtcGxlLnB0cztcbiAgICAgICAgZmlyc3REVFMgPSBhdmNTYW1wbGUuZHRzO1xuICAgICAgfVxuXG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiAoYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMpKjkwLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGlmKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlID0gMTtcbiAgICAgIH1cbiAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGF2Y1NhbXBsZS5kdHM7XG4gICAgfVxuICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHRyYWNrLnNhbXBsZXNbdHJhY2suc2FtcGxlcy5sZW5ndGgtMl0uZHVyYXRpb247XG4gICAgdGhpcy5sYXN0QXZjRHRzID0gYXZjU2FtcGxlLmR0cztcbiAgICAvLyBuZXh0IEFWQyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEF2Y1B0cyA9IGF2Y1NhbXBsZS5wdHMgKyBtcDRTYW1wbGUuZHVyYXRpb24vOTA7XG4gICAgLy9sb2dnZXIubG9nKCdWaWRlby9sYXN0QXZjRHRzL25leHRBdmNQdHM6JyArIHRoaXMubGFzdEF2Y0R0cyArICcvJyArIHRoaXMubmV4dEF2Y1B0cyk7XG5cbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcblxuICAgIHN0YXJ0T2Zmc2V0ID0gZmlyc3RQVFMvMTAwMDtcbiAgICBlbmRPZmZzZXQgPSB0aGlzLm5leHRBdmNQdHMvMTAwMDtcblxuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLGZpcnN0RFRTKjkwLHRyYWNrKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBzdGFydE9mZnNldCxcbiAgICAgIGVuZFBUUyA6IGVuZE9mZnNldCxcbiAgICAgIHN0YXJ0RFRTIDogZmlyc3REVFMvMTAwMCxcbiAgICAgIGVuZERUUyA6IChhdmNTYW1wbGUuZHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uLzkwKS8xMDAwLFxuICAgICAgdHlwZSA6ICd2aWRlbydcbiAgICB9KTtcbiAgfVxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsbGVuID0gYXJyYXkuYnl0ZUxlbmd0aCx2YWx1ZSxzdGF0ZSA9IDA7XG4gICAgdmFyIHVuaXRzID0gW10sIHVuaXQsIHVuaXRUeXBlLCBsYXN0VW5pdFN0YXJ0LGxhc3RVbml0VHlwZSxsZW5ndGggPSAwO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuXG4gICAgd2hpbGUoaTwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaChzdGF0ZSkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZih2YWx1ZSA9PT0gMSkge1xuICAgICAgICAgICAgdW5pdFR5cGUgPSBhcnJheVtpXSAmIDB4MWY7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgTkFMVSBAIG9mZnNldDonICsgaSArICcsdHlwZTonICsgdW5pdFR5cGUpO1xuICAgICAgICAgICAgaWYobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0geyBkYXRhIDogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCxpLXN0YXRlLTEpLCB0eXBlIDogbGFzdFVuaXRUeXBlfTtcbiAgICAgICAgICAgICAgbGVuZ3RoKz1pLXN0YXRlLTEtbGFzdFVuaXRTdGFydDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmKHVuaXRUeXBlID09PSAxIHx8IHVuaXRUeXBlID09PSA1KSB7XG4gICAgICAgICAgICAgIC8vIE9QVEkgISEhIGlmIElEUi9ORFIgdW5pdCwgY29uc2lkZXIgaXQgaXMgbGFzdCBOQUx1XG4gICAgICAgICAgICAgIGkgPSBsZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgIHVuaXQgPSB7IGRhdGEgOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LGxlbiksIHR5cGUgOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgbGVuZ3RoKz1sZW4tbGFzdFVuaXRTdGFydDtcbiAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiB7IHVuaXRzIDogdW5pdHMgLCBsZW5ndGggOiBsZW5ndGh9O1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChwZXMuZGF0YSkpO1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLGFhY1NhbXBsZSxkYXRhID0gcGVzLmRhdGEsY29uZmlnLGFkdHNGcmFtZVNpemUsYWR0c1N0YXJ0T2Zmc2V0LGFkdHNIZWFkZXJMZW4sc3RhbXAsaTtcbiAgICBpZihkYXRhWzBdID09PSAweGZmKSB7XG4gICAgICBpZighdHJhY2suYXVkaW9zYW1wbGVyYXRlKSB7XG4gICAgICAgIGNvbmZpZyA9IHRoaXMuX0FEVFN0b0F1ZGlvQ29uZmlnKHBlcy5kYXRhLHRoaXMuYXVkaW9Db2RlYyk7XG4gICAgICAgIHRyYWNrLmNvbmZpZyA9IGNvbmZpZy5jb25maWc7XG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgICB0cmFjay5jb2RlYyA9IGNvbmZpZy5jb2RlYztcbiAgICAgICAgdHJhY2suZHVyYXRpb24gPSA5MDAwMCp0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgY29uc29sZS5sb2codHJhY2suY29kZWMgKycscmF0ZTonICsgY29uZmlnLnNhbXBsZXJhdGUgKyAnLG5iIGNoYW5uZWw6JyArIGNvbmZpZy5jaGFubmVsQ291bnQpO1xuICAgICAgfVxuICAgICAgYWR0c1N0YXJ0T2Zmc2V0ID0gaSA9IDA7XG4gICAgICB3aGlsZShhZHRzU3RhcnRPZmZzZXQgPCBkYXRhLmxlbmd0aCkge1xuICAgICAgICAvLyByZXRyaWV2ZSBmcmFtZSBzaXplXG4gICAgICAgIGFkdHNGcmFtZVNpemUgPSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzNdICYgMHgwMykgPDwgMTEpO1xuICAgICAgICAvLyBieXRlIDRcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoZGF0YVthZHRzU3RhcnRPZmZzZXQrNF0gPDwgMyk7XG4gICAgICAgIC8vIGJ5dGUgNVxuICAgICAgICBhZHRzRnJhbWVTaXplIHw9ICgoZGF0YVthZHRzU3RhcnRPZmZzZXQrNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICAgIGFkdHNIZWFkZXJMZW4gPSAoISEoZGF0YVthZHRzU3RhcnRPZmZzZXQrMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSBhZHRzSGVhZGVyTGVuO1xuICAgICAgICBzdGFtcCA9IHBlcy5wdHMgKyBpKjEwMjQqMTAwMC90cmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuICAgICAgICAvL2NvbnNvbGUubG9nKCdBQUMgZnJhbWUsIG9mZnNldC9sZW5ndGgvcHRzOicgKyAoYWR0c1N0YXJ0T2Zmc2V0KzcpICsgJy8nICsgYWR0c0ZyYW1lU2l6ZSArICcvJyArIHN0YW1wLnRvRml4ZWQoMCkpO1xuICAgICAgICBhYWNTYW1wbGUgPSB7IHVuaXQgOiBwZXMuZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQrYWR0c0hlYWRlckxlbixhZHRzU3RhcnRPZmZzZXQrYWR0c0hlYWRlckxlbithZHRzRnJhbWVTaXplKSAsIHB0cyA6IHN0YW1wLCBkdHMgOiBzdGFtcH07XG4gICAgICAgIGFkdHNTdGFydE9mZnNldCs9YWR0c0ZyYW1lU2l6ZSthZHRzSGVhZGVyTGVuO1xuICAgICAgICB0aGlzLl9hYWNTYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdGhpcy5fYWFjU2FtcGxlc0xlbmd0aCArPSBhZHRzRnJhbWVTaXplO1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0VSUk9SLCdTdHJlYW0gZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgfVxuXG4gIF9mbHVzaEFBQ1NhbXBsZXMoKSB7XG4gICAgdmFyIHZpZXcsaT04LGFhY1NhbXBsZSxtcDRTYW1wbGUsdW5pdCx0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBsYXN0U2FtcGxlRFRTLG1kYXQsbW9vZixzdGFydE9mZnNldCxlbmRPZmZzZXQsXG4gICAgICAgIGZpcnN0UFRTLGZpcnN0RFRTO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYWFjU2FtcGxlc0xlbmd0aCs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHRoaXMuX2FhY1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIG1kYXQuc2V0KHVuaXQsIGkpO1xuICAgICAgaSArPSB1bml0LmJ5dGVMZW5ndGg7XG5cbiAgICAgIGFhY1NhbXBsZS5wdHMgLT0gdGhpcy5faW5pdERUUztcbiAgICAgIGFhY1NhbXBsZS5kdHMgLT0gdGhpcy5faW5pdERUUztcblxuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFM6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSk7XG4gICAgICBpZihsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gd2UgdXNlIERUUyB0byBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbiwgYnV0IHdlIHVzZSBQVFMgdG8gY29tcHV0ZSBpbml0UFRTIHdoaWNoIGlzIHVzZWQgdG8gc3luYyBhdWRpbyBhbmQgdmlkZW9cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gTWF0aC5yb3VuZCgoYWFjU2FtcGxlLmR0cyAtIGxhc3RTYW1wbGVEVFMpKjkwKTtcbiAgICAgICAgaWYobXA0U2FtcGxlLmR1cmF0aW9uIDwgMCkge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnaW52YWxpZCBzYW1wbGUgZHVyYXRpb24gYXQgUFRTL0RUUzo6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzICsgJzonICsgbXA0U2FtcGxlLmR1cmF0aW9uKTtcbiAgICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSAwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjaGVjayBpZiBmcmFnbWVudHMgYXJlIGNvbnRpZ3VvdXMgKGkuZS4gbm8gbWlzc2luZyBmcmFtZXMgYmV0d2VlbiBmcmFnbWVudClcbiAgICAgICAgaWYodGhpcy5uZXh0QWFjUHRzICYmIHRoaXMubmV4dEFhY1B0cyAhPT0gYWFjU2FtcGxlLnB0cykge1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8gbmV4dCBQVFM6JyArIHRoaXMubmV4dEFhY1B0cyk7XG4gICAgICAgICAgdmFyIGRlbHRhID0gYWFjU2FtcGxlLnB0cyAtIHRoaXMubmV4dEFhY1B0cztcbiAgICAgICAgICAvLyBpZiBkZWx0YSBpcyBsZXNzIHRoYW4gMzAwIG1zLCBuZXh0IGxvYWRlZCBmcmFnbWVudCBpcyBhc3N1bWVkIHRvIGJlIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZVxuICAgICAgICAgIGlmKE1hdGguYWJzKGRlbHRhKSA+IDEgJiYgTWF0aC5hYnMoZGVsdGEpIDwgMzAwKSB7XG4gICAgICAgICAgICBpZihkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnQUFDOicgKyBkZWx0YS50b0ZpeGVkKDApICsgJyBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXQnKTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUUywgYW5kIGVuc3VyZSBQVFMgaXMgZ3JlYXRlciBvciBlcXVhbCB0aGFuIGxhc3QgRFRTXG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5wdHMgPSBNYXRoLm1heCh0aGlzLm5leHRBYWNQdHMsIHRoaXMubGFzdEFhY0R0cyk7XG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5kdHMgPSBhYWNTYW1wbGUucHRzO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGFhY1NhbXBsZS5wdHMgKyAnLycgKyBhYWNTYW1wbGUuZHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FBQzonICsgKC1kZWx0YS50b0ZpeGVkKDApKSArICcgbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzXG4gICAgICAgIGZpcnN0UFRTID0gYWFjU2FtcGxlLnB0cztcbiAgICAgICAgZmlyc3REVFMgPSBhYWNTYW1wbGUuZHRzO1xuICAgICAgfVxuXG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IHVuaXQuYnl0ZUxlbmd0aCxcbiAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiAwLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwLFxuICAgICAgICAgIGRlcGVuZHNPbiA6IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB0cmFjay5zYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3RTYW1wbGVEVFMgPSBhYWNTYW1wbGUuZHRzO1xuICAgIH1cbiAgICAvL3NldCBsYXN0IHNhbXBsZSBkdXJhdGlvbiBhcyBiZWluZyBpZGVudGljYWwgdG8gcHJldmlvdXMgc2FtcGxlXG4gICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gdHJhY2suc2FtcGxlc1t0cmFjay5zYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB0aGlzLmxhc3RBYWNEdHMgPSBhYWNTYW1wbGUuZHRzO1xuICAgIC8vIG5leHQgYWFjIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QWFjUHRzID0gYWFjU2FtcGxlLnB0cyArIG1wNFNhbXBsZS5kdXJhdGlvbi85MDtcbiAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcblxuICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggPSAwO1xuXG4gICAgc3RhcnRPZmZzZXQgPSBmaXJzdFBUUy8xMDAwO1xuICAgIGVuZE9mZnNldCA9IHRoaXMubmV4dEFhY1B0cy8xMDAwO1xuXG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMqOTAsdHJhY2spO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUyA6IHN0YXJ0T2Zmc2V0LFxuICAgICAgZW5kUFRTIDogZW5kT2Zmc2V0LFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy8xMDAwLFxuICAgICAgZW5kRFRTIDogKGFhY1NhbXBsZS5kdHMgKyBtcDRTYW1wbGUuZHVyYXRpb24vOTApLzEwMDAsXG4gICAgICB0eXBlIDogJ2F1ZGlvJ1xuICAgIH0pO1xuICB9XG5cbiAgX0FEVFN0b0F1ZGlvQ29uZmlnKGRhdGEsYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICBhZHRzU2FtcGxlaW5nUmF0ZXMgPSBbXG4gICAgICAgICAgICA5NjAwMCwgODgyMDAsXG4gICAgICAgICAgICA2NDAwMCwgNDgwMDAsXG4gICAgICAgICAgICA0NDEwMCwgMzIwMDAsXG4gICAgICAgICAgICAyNDAwMCwgMjIwNTAsXG4gICAgICAgICAgICAxNjAwMCwgMTIwMDBcbiAgICAgICAgICBdO1xuXG4gICAgLy8gYnl0ZSAyXG4gICAgYWR0c09iamVjdFR5cGUgPSAoKGRhdGFbMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVsyXSAmIDB4M0MpID4+PiAyKTtcbiAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhWzJdICYgMHgwMSkgPDwgMik7XG5cbiAgICAvLyAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUi4gc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHlcbiAgICAvLyBpbiBjYXNlIHN0cmVhbSBpcyByZWFsbHkgSEUtQUFDOiBpdCBzaG91bGQgYmUgZWl0aGVyICBhZHZlcnRpc2VkIGRpcmVjdGx5IGluIGNvZGVjcyAocmV0cmlldmVkIGZyb20gcGFyc2luZyBtYW5pZmVzdClcbiAgICAvLyBvciBpZiBubyBjb2RlYyBzcGVjaWZpZWQsd2UgaW1wbGljaXRlbHkgYXNzdW1lIHRoYXQgYXVkaW8gd2l0aCBzYW1wbGluZyByYXRlIGxlc3Mgb3IgZXF1YWwgdGhhbiAyNCBrSHogaXMgSEUtQUFDIChpbmRleCA2KVxuICAgIC8vIGN1cnJlbnRseSBicm9rZW4gb24gQ2hyb21lL0FuZHJvaWRcbiAgICBpZihuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignYW5kcm9pZCcpID09PSAtMSAmJlxuICAgICAgKChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHx8ICghYXVkaW9Db2RlYyAmJiBhZHRzU2FtcGxlaW5nSW5kZXggPj02KSkpICB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSA9PT0gLTEpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICB9ZWxzZSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgfVxuICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4O1xuICAgIH1cbiAgICAvLyBieXRlIDNcbiAgICBhZHRzQ2hhbmVsQ29uZmlnIHw9ICgoZGF0YVszXSAmIDB4QzApID4+PiA2KTtcbiAgLyogcmVmZXIgdG8gaHR0cDovL3dpa2kubXVsdGltZWRpYS5jeC9pbmRleC5waHA/dGl0bGU9TVBFRy00X0F1ZGlvI0F1ZGlvX1NwZWNpZmljX0NvbmZpZ1xuICAgICAgSVNPIDE0NDk2LTMgKEFBQykucGRmIC0gVGFibGUgMS4xMyDigJQgU3ludGF4IG9mIEF1ZGlvU3BlY2lmaWNDb25maWcoKVxuICAgIEF1ZGlvIFByb2ZpbGUgLyBBdWRpbyBPYmplY3QgVHlwZVxuICAgIDA6IE51bGxcbiAgICAxOiBBQUMgTWFpblxuICAgIDI6IEFBQyBMQyAoTG93IENvbXBsZXhpdHkpXG4gICAgMzogQUFDIFNTUiAoU2NhbGFibGUgU2FtcGxlIFJhdGUpXG4gICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgNTogU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKVxuICAgIDY6IEFBQyBTY2FsYWJsZVxuICAgc2FtcGxpbmcgZnJlcVxuICAgIDA6IDk2MDAwIEh6XG4gICAgMTogODgyMDAgSHpcbiAgICAyOiA2NDAwMCBIelxuICAgIDM6IDQ4MDAwIEh6XG4gICAgNDogNDQxMDAgSHpcbiAgICA1OiAzMjAwMCBIelxuICAgIDY6IDI0MDAwIEh6XG4gICAgNzogMjIwNTAgSHpcbiAgICA4OiAxNjAwMCBIelxuICAgIDk6IDEyMDAwIEh6XG4gICAgMTA6IDExMDI1IEh6XG4gICAgMTE6IDgwMDAgSHpcbiAgICAxMjogNzM1MCBIelxuICAgIDEzOiBSZXNlcnZlZFxuICAgIDE0OiBSZXNlcnZlZFxuICAgIDE1OiBmcmVxdWVuY3kgaXMgd3JpdHRlbiBleHBsaWN0bHlcbiAgICBDaGFubmVsIENvbmZpZ3VyYXRpb25zXG4gICAgVGhlc2UgYXJlIHRoZSBjaGFubmVsIGNvbmZpZ3VyYXRpb25zOlxuICAgIDA6IERlZmluZWQgaW4gQU9UIFNwZWNpZmMgQ29uZmlnXG4gICAgMTogMSBjaGFubmVsOiBmcm9udC1jZW50ZXJcbiAgICAyOiAyIGNoYW5uZWxzOiBmcm9udC1sZWZ0LCBmcm9udC1yaWdodFxuICAqL1xuICAgIC8vIGF1ZGlvT2JqZWN0VHlwZSA9IHByb2ZpbGUgPT4gcHJvZmlsZSwgdGhlIE1QRUctNCBBdWRpbyBPYmplY3QgVHlwZSBtaW51cyAxXG4gICAgY29uZmlnWzBdID0gYWR0c09iamVjdFR5cGUgPDwgMztcbiAgICAvLyBzYW1wbGluZ0ZyZXF1ZW5jeUluZGV4XG4gICAgY29uZmlnWzBdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgIGNvbmZpZ1sxXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAvLyBjaGFubmVsQ29uZmlndXJhdGlvblxuICAgIGNvbmZpZ1sxXSB8PSBhZHRzQ2hhbmVsQ29uZmlnIDw8IDM7XG4gICAgaWYoYWR0c09iamVjdFR5cGUgPT09IDUpIHtcbiAgICAgIC8vIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleFxuICAgICAgY29uZmlnWzFdIHw9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDBFKSA+PiAxO1xuICAgICAgY29uZmlnWzJdID0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgICAvLyBhZHRzT2JqZWN0VHlwZSAoZm9yY2UgdG8gMiwgY2hyb21lIGlzIGNoZWNraW5nIHRoYXQgb2JqZWN0IHR5cGUgaXMgbGVzcyB0aGFuIDUgPz8/XG4gICAgICAvLyAgICBodHRwczovL2Nocm9taXVtLmdvb2dsZXNvdXJjZS5jb20vY2hyb21pdW0vc3JjLmdpdC8rL21hc3Rlci9tZWRpYS9mb3JtYXRzL21wNC9hYWMuY2NcbiAgICAgIGNvbmZpZ1syXSB8PSAyIDw8IDI7XG4gICAgICBjb25maWdbM10gPSAwO1xuICAgIH1cbiAgICByZXR1cm4geyBjb25maWcgOiBjb25maWcsIHNhbXBsZXJhdGUgOiBhZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XSwgY2hhbm5lbENvdW50IDogYWR0c0NoYW5lbENvbmZpZywgY29kZWMgOiAoJ21wNGEuNDAuJyArIGFkdHNPYmplY3RUeXBlKX07XG4gIH1cblxuICBfZ2VuZXJhdGVJbml0U2VnbWVudCgpIHtcbiAgICBpZih0aGlzLl9hdmNJZCA9PT0gLTEpIHtcbiAgICAgIC8vYXVkaW8gb25seVxuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIGF1ZGlvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hYWNUcmFja10pLFxuICAgICAgICAgIGF1ZGlvQ29kZWMgOiB0aGlzLl9hYWNUcmFjay5jb2RlYyxcbiAgICAgICAgICBhdWRpb0NoYW5uZWxDb3VudCA6IHRoaXMuX2FhY1RyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5fYWFjU2FtcGxlc1swXS5wdHMgLSAxMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzIC0gMTAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICB9XG4gICAgfSBlbHNlXG4gICAgaWYodGhpcy5fYWFjSWQgPT09IC0xKSB7XG4gICAgICAvL3ZpZGVvIG9ubHlcbiAgICAgIGlmKHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgdmlkZW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2F2Y1RyYWNrXSksXG4gICAgICAgICAgdmlkZW9Db2RlYyA6IHRoaXMuX2F2Y1RyYWNrLmNvZGVjLFxuICAgICAgICAgIHZpZGVvV2lkdGggOiB0aGlzLl9hdmNUcmFjay53aWR0aCxcbiAgICAgICAgICB2aWRlb0hlaWdodCA6IHRoaXMuX2F2Y1RyYWNrLmhlaWdodFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICAgIGlmKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5fYXZjU2FtcGxlc1swXS5wdHMgLSAxMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gdGhpcy5fYXZjU2FtcGxlc1swXS5kdHMgLSAxMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnICYmIHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50LFxuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzKSAtIDEwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSBNYXRoLm1pbih0aGlzLl9hdmNTYW1wbGVzWzBdLmR0cyx0aGlzLl9hYWNTYW1wbGVzWzBdLmR0cykgLSAxMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXI7XG4iLCIgaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IFRTRGVtdXhlciAgICAgICAgICAgIGZyb20gJy4uL2RlbXV4L3RzZGVtdXhlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcblxuY2xhc3MgVFNEZW11eGVyV29ya2VyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLGZ1bmN0aW9uIChldil7XG4gICAgICAvL2NvbnNvbGUubG9nKCdkZW11eGVyIGNtZDonICsgZXYuZGF0YS5jbWQpO1xuICAgICAgc3dpdGNoKGV2LmRhdGEuY21kKSB7XG4gICAgICAgIGNhc2UgJ2luaXQnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZHVyYXRpb24nOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5zZXREdXJhdGlvbihldi5kYXRhLmRhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdzd2l0Y2hMZXZlbCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyLnN3aXRjaExldmVsKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShldi5kYXRhLmRhdGEpLCBldi5kYXRhLmF1ZGlvQ29kZWMsZXYuZGF0YS52aWRlb0NvZGVjLCBldi5kYXRhLnRpbWVPZmZzZXQpO1xuICAgICAgICAgIHNlbGYuZGVtdXhlci5lbmQoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIGxpc3RlbiB0byBldmVudHMgdHJpZ2dlcmVkIGJ5IFRTIERlbXV4ZXJcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCBmdW5jdGlvbihldixkYXRhKSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiB9O1xuICAgICAgdmFyIG9ialRyYW5zZmVyYWJsZSA9IFtdO1xuICAgICAgaWYoZGF0YS5hdWRpb0NvZGVjKSB7XG4gICAgICAgIG9iakRhdGEuYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICAgICAgb2JqRGF0YS5hdWRpb01vb3YgPSBkYXRhLmF1ZGlvTW9vdi5idWZmZXI7XG4gICAgICAgIG9iakRhdGEuYXVkaW9DaGFubmVsQ291bnQgPSBkYXRhLmF1ZGlvQ2hhbm5lbENvdW50O1xuICAgICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLmF1ZGlvTW9vdik7XG4gICAgICB9XG4gICAgICBpZihkYXRhLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgb2JqRGF0YS52aWRlb0NvZGVjID0gZGF0YS52aWRlb0NvZGVjO1xuICAgICAgICBvYmpEYXRhLnZpZGVvTW9vdiA9IGRhdGEudmlkZW9Nb292LmJ1ZmZlcjtcbiAgICAgICAgb2JqRGF0YS52aWRlb1dpZHRoID0gZGF0YS52aWRlb1dpZHRoO1xuICAgICAgICBvYmpEYXRhLnZpZGVvSGVpZ2h0ID0gZGF0YS52aWRlb0hlaWdodDtcbiAgICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS52aWRlb01vb3YpO1xuICAgICAgfVxuICAgICAgLy8gcGFzcyBtb292IGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsb2JqVHJhbnNmZXJhYmxlKTtcbiAgICB9KTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSwgZnVuY3Rpb24oZXYsZGF0YSkge1xuICAgICAgdmFyIG9iakRhdGEgPSB7IGV2ZW50IDogZXYgLCB0eXBlIDogZGF0YS50eXBlLCBzdGFydFBUUyA6IGRhdGEuc3RhcnRQVFMsIGVuZFBUUyA6IGRhdGEuZW5kUFRTICwgc3RhcnREVFMgOiBkYXRhLnN0YXJ0RFRTLCBlbmREVFMgOiBkYXRhLmVuZERUUyAsbW9vZiA6IGRhdGEubW9vZi5idWZmZXIsIG1kYXQgOiBkYXRhLm1kYXQuYnVmZmVyfTtcbiAgICAgIC8vIHBhc3MgbW9vZi9tZGF0IGRhdGEgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxbb2JqRGF0YS5tb29mLG9iakRhdGEubWRhdF0pO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCBmdW5jdGlvbihldikge1xuICAgICAgdmFyIG9iakRhdGEgPSB7IGV2ZW50IDogZXYgfTtcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVFNEZW11eGVyV29ya2VyO1xuXG4iLCJleHBvcnQgZGVmYXVsdCB7XG4gIC8vIHRyaWdnZXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIGF0dGFjaGVkIHRvIHZpZGVvIHRhZ1xuICBNU0VfQVRUQUNIRUQgOiAnaGxzTWVkaWFTb3VyY2VBdHRhY2hlZCcsXG4gIC8vSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBsb2FkZWQgZXZlbnRcbiAgTUFOSUZFU1RfTE9BREVEICA6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCBwYXJzZWQgZXZlbnQsIHdoZW4gdGhpcyBldmVudCBpcyByZWNlaXZlZCwgbWFpbiBtYW5pZmVzdCBhbmQgc3RhcnQgbGV2ZWwgaGFzIGJlZW4gcmV0cmlldmVkXG4gIE1BTklGRVNUX1BBUlNFRCAgOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIGxvYWRpbmcgZXZlbnRcbiAgTEVWRUxfTE9BRElORyAgICA6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIGxvYWRlZCBldmVudFxuICBMRVZFTF9MT0FERUQgOiAgJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXZlbnRcbiAgTEVWRUxfU1dJVENIIDogICdobHNMZXZlbFN3aXRjaCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgbG9hZGluZyBldmVudFxuICBGUkFHX0xPQURJTkcgOiAgJ2hsc0ZyYWdtZW50TG9hZGluZycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgbG9hZGVkIGV2ZW50XG4gIEZSQUdfTE9BREVEIDogICdobHNGcmFnbWVudExvYWRlZCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBpbml0IHNlZ21lbnQgZXZlbnRcbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCA6ICAnaGxzRnJhZ21lbnRQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGZyYWdtZW50IHBhcnNpbmcgZGF0YSBldmVudFxuICBGUkFHX1BBUlNJTkdfREFUQSA6ICAnaGxzRnJhZ21lbnRQYXJzaW5nRGF0YScsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2luZyBlcnJvciBldmVudFxuICBGUkFHX1BBUlNJTkdfRVJST1IgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzZWQgZXZlbnRcbiAgRlJBR19QQVJTRUQgOiAgJ2hsc0ZyYWdtZW50UGFyc2VkJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBidWZmZXJlZCAgZXZlbnRcbiAgRlJBR19CVUZGRVJFRCA6ICAnaGxzRnJhZ21lbnRCdWZmZXJlZCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbG9hZCBlcnJvciBldmVudFxuICBMT0FEX0VSUk9SIDogICdobHNMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIHN3aXRjaCBlcnJvclxuICBMRVZFTF9FUlJPUiA6ICAnaGxzTGV2ZWxFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgdmlkZW8gZXJyb3IgZXZlbnRcbiAgVklERU9fRVJST1IgOiAgJ2hsc1ZpZGVvRXJyb3InXG59O1xuIiwiLyoqXG4gKiBITFMgZW5naW5lXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuL29ic2VydmVyJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciAgICAgICBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEJ1ZmZlckNvbnRyb2xsZXIgICAgIGZyb20gJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyICAgICAgZnJvbSAnLi9jb250cm9sbGVyL2xldmVsLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsZW5hYmxlTG9nc30gIGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbi8vaW1wb3J0IE1QNEluc3BlY3QgICAgICAgICBmcm9tICcvcmVtdXgvbXA0LWluc3BlY3Rvcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0OyBjb2RlY3M9XCJhdmMxLjQyRTAxRSxtcDRhLjQwLjJcIicpKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBuZXcgUGxheWxpc3RMb2FkZXIoKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IG5ldyBMZXZlbENvbnRyb2xsZXIodGhpcy5wbGF5bGlzdExvYWRlcik7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbmV3IEJ1ZmZlckNvbnRyb2xsZXIodGhpcy5sZXZlbENvbnRyb2xsZXIpO1xuICAgIHRoaXMuRXZlbnRzID0gRXZlbnQ7XG4gICAgdGhpcy5kZWJ1ZyA9IGVuYWJsZUxvZ3M7XG4gICAgdGhpcy5sb2dFdnQgPSB0aGlzLmxvZ0V2dDtcbiAgICAvLyBvYnNlcnZlciBzZXR1cFxuICAgIHRoaXMub24gPSBvYnNlcnZlci5vbi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLm9mZiA9IG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyLmJpbmQob2JzZXJ2ZXIpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLnBsYXlsaXN0TG9hZGVyKSB7XG4gICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmJ1ZmZlckNvbnRyb2xsZXIpIHtcbiAgICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmxldmVsQ29udHJvbGxlcikge1xuICAgICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmRldGFjaFNvdXJjZSgpO1xuICAgIHRoaXMuZGV0YWNoVmlkZW8oKTtcbiAgICBvYnNlcnZlci5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGF0dGFjaFZpZGVvKHZpZGVvKSB7XG4gICAgdGhpcy52aWRlbyA9IHZpZGVvO1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICB2aWRlby5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgICB0aGlzLm9udmVycm9yID0gdGhpcy5vblZpZGVvRXJyb3IuYmluZCh0aGlzKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsdGhpcy5vbnZlcnJvcik7XG4gIH1cblxuICBkZXRhY2hWaWRlbygpIHtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYobXMpIHtcbiAgICAgIG1zLmVuZE9mU3RyZWFtKCk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgICAvLyB1bmxpbmsgTWVkaWFTb3VyY2UgZnJvbSB2aWRlbyB0YWdcbiAgICAgIHZpZGVvLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgaWYodmlkZW8pIHtcbiAgICAgIHRoaXMudmlkZW8gPSBudWxsO1xuICAgICAgLy8gcmVtb3ZlIHZpZGVvIGVycm9yIGxpc3RlbmVyXG4gICAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsdGhpcy5vbnZlcnJvcik7XG4gICAgICB0aGlzLm9udmVycm9yID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsb2FkU291cmNlKHVybCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIGxvZ2dlci5sb2coJ2xvYWRTb3VyY2U6Jyt1cmwpO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmxvYWQodXJsLG51bGwpO1xuICB9XG5cbiAgdW5sb2FkU291cmNlKCkge1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gYWxsIHF1YWxpdHkgbGV2ZWxzICoqL1xuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbHM7XG4gIH1cbiAgLyoqIFJldHVybiB0aGUgcXVhbGl0eSBsZXZlbCBvZiBsYXN0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IGxldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGxvYWRlZCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBsZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiB1bmRlZmluZWQgOiBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0ICBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgdW5kZWZpbmVkIDogZmlyc3QgbGV2ZWwgYXBwZWFyaW5nIGluIG1hbmlmZXN0IHdpbGwgYmUgdXNlZCBhcyBzdGFydCBsZXZlbFxuICAgICAgaWYgLTEgOiBhdXRvbWF0aWMgc3RhcnQgbGV2ZWwgc2VsZWN0aW9uLCBwbGF5YmFjayB3aWxsIHN0YXJ0IGZyb20gbGV2ZWwgbWF0Y2hpbmcgZG93bmxvYWQgYmFuZHdpZHRoIChkZXRlcm1pbmVkIGZyb20gZG93bmxvYWQgb2YgZmlyc3Qgc2VnbWVudClcbiAgKiovXG4gIHNldCBzdGFydExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiBjaGVjayBpZiB3ZSBhcmUgaW4gYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBtb2RlICovXG4gIGdldCBhdXRvTGV2ZWxFbmFibGVkKCkge1xuICAgIHJldHVybiAodGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgID09PSAtMSk7XG4gIH1cblxuICAvKiByZXR1cm4gbWFudWFsIGxldmVsICovXG4gIGdldCBtYW51YWxMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWw7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1TRV9BVFRBQ0hFRCwgeyB2aWRlbzogdGhpcy52aWRlbywgbWVkaWFTb3VyY2UgOiB0aGlzLm1lZGlhU291cmNlIH0pO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUNsb3NlKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBjbG9zZWQnKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VFbmRlZCgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgZW5kZWQnKTtcbiAgfVxuXG4gIG9uVmlkZW9FcnJvcigpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LlZJREVPX0VSUk9SKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBIbHM7XG4iLCIgLypcbiAqIGZyYWdtZW50IGxvYWRlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIEZyYWdtZW50TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMueGhyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIGlmKHRoaXMueGhyICYmdGhpcy54aHIucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgdGhpcy54aHIuYWJvcnQoKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKGZyYWcsbGV2ZWxJZCkge1xuICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgdGhpcy5sZXZlbElkID0gbGV2ZWxJZDtcbiAgICB0aGlzLnRyZXF1ZXN0ID0gbmV3IERhdGUoKTtcbiAgICB0aGlzLnRmaXJzdCA9IG51bGw7XG4gICAgdmFyIHhociA9IHRoaXMueGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9ubG9hZD0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vcGVuKCdHRVQnLCBmcmFnLnVybCAsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHhoci5zZW5kKCk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURJTkcsIHsgZnJhZyA6IGZyYWd9KTtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdmFyIHBheWxvYWQgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgIHsgcGF5bG9hZCA6IHBheWxvYWQsXG4gICAgICAgICAgICAgICAgICAgICAgZnJhZyA6IHRoaXMuZnJhZyAsXG4gICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiB7dHJlcXVlc3QgOiB0aGlzLnRyZXF1ZXN0LCB0Zmlyc3QgOiB0aGlzLnRmaXJzdCwgdGxvYWQgOiBuZXcgRGF0ZSgpLCBsZW5ndGggOnBheWxvYWQuYnl0ZUxlbmd0aCB9fSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBsb2dnZXIubG9nKCdlcnJvciBsb2FkaW5nICcgKyB0aGlzLmZyYWcudXJsKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdGhpcy5mcmFnLnVybCwgZXZlbnQ6ZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcbiAgICBpZih0aGlzLnRmaXJzdCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy50Zmlyc3QgPSBuZXcgRGF0ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBGcmFnbWVudExvYWRlcjtcbiIsIi8qXG4gKiBwbGF5bGlzdCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuLy9pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFBsYXlsaXN0TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLm1hbmlmZXN0TG9hZGVkID0gZmFsc2U7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMueGhyICYmdGhpcy54aHIucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgdGhpcy54aHIuYWJvcnQoKTtcbiAgICAgIHRoaXMueGhyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgfVxuXG4gIGxvYWQodXJsLHJlcXVlc3RJZCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuaWQgPSByZXF1ZXN0SWQ7XG4gICAgdGhpcy5zdGF0cyA9IHsgdHJlcXVlc3QgOiBuZXcgRGF0ZSgpfTtcbiAgICB2YXIgeGhyID0gdGhpcy54aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkPSAgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vbmVycm9yID0gdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgeGhyLnNlbmQoKTtcbiAgfVxuXG4gIHJlc29sdmUodXJsLCBiYXNlVXJsKSB7XG4gICAgdmFyIGRvYyAgICAgID0gZG9jdW1lbnQsXG4gICAgICAgIG9sZEJhc2UgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2Jhc2UnKVswXSxcbiAgICAgICAgb2xkSHJlZiA9IG9sZEJhc2UgJiYgb2xkQmFzZS5ocmVmLFxuICAgICAgICBkb2NIZWFkID0gZG9jLmhlYWQgfHwgZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0sXG4gICAgICAgIG91ckJhc2UgPSBvbGRCYXNlIHx8IGRvY0hlYWQuYXBwZW5kQ2hpbGQoZG9jLmNyZWF0ZUVsZW1lbnQoJ2Jhc2UnKSksXG4gICAgICAgIHJlc29sdmVyID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2EnKSxcbiAgICAgICAgcmVzb2x2ZWRVcmw7XG5cbiAgICBvdXJCYXNlLmhyZWYgPSBiYXNlVXJsO1xuICAgIHJlc29sdmVyLmhyZWYgPSB1cmw7XG4gICAgcmVzb2x2ZWRVcmwgID0gcmVzb2x2ZXIuaHJlZjsgLy8gYnJvd3NlciBtYWdpYyBhdCB3b3JrIGhlcmVcblxuICAgIGlmIChvbGRCYXNlKSB7b2xkQmFzZS5ocmVmID0gb2xkSHJlZjt9XG4gICAgZWxzZSB7ZG9jSGVhZC5yZW1vdmVDaGlsZChvdXJCYXNlKTt9XG4gICAgcmV0dXJuIHJlc29sdmVkVXJsO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsYmFzZXVybCkge1xuICAgIHZhciBsZXZlbHMgPSBbXSxsZXZlbCA9ICB7fSxyZXN1bHQsY29kZWNzLGNvZGVjO1xuICAgIHZhciByZSA9IC8jRVhULVgtU1RSRUFNLUlORjooW15cXG5cXHJdKihCQU5EKVdJRFRIPShcXGQrKSk/KFteXFxuXFxyXSooQ09ERUNTKT1cXFwiKC4qKVxcXCIsKT8oW15cXG5cXHJdKihSRVMpT0xVVElPTj0oXFxkKyl4KFxcZCspKT8oW15cXG5cXHJdKihOQU1FKT1cXFwiKC4qKVxcXCIpP1teXFxuXFxyXSpbXFxyXFxuXSsoW15cXHJcXG5dKykvZztcbiAgICB3aGlsZSgocmVzdWx0ID0gcmUuZXhlYyhzdHJpbmcpKSAhPSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgbGV2ZWwudXJsID0gdGhpcy5yZXNvbHZlKHJlc3VsdC5wb3AoKSxiYXNldXJsKTtcbiAgICAgIHdoaWxlKHJlc3VsdC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHN3aXRjaChyZXN1bHQuc2hpZnQoKSkge1xuICAgICAgICAgIGNhc2UgJ1JFUyc6XG4gICAgICAgICAgICBsZXZlbC53aWR0aCA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGxldmVsLmhlaWdodCA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0JBTkQnOlxuICAgICAgICAgICAgbGV2ZWwuYml0cmF0ZSA9IHBhcnNlSW50KHJlc3VsdC5zaGlmdCgpKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ05BTUUnOlxuICAgICAgICAgICAgbGV2ZWwubmFtZSA9IHJlc3VsdC5zaGlmdCgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQ09ERUNTJzpcbiAgICAgICAgICAgIGNvZGVjcyA9IHJlc3VsdC5zaGlmdCgpLnNwbGl0KCcsJyk7XG4gICAgICAgICAgICB3aGlsZShjb2RlY3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBjb2RlYyA9IGNvZGVjcy5zaGlmdCgpO1xuICAgICAgICAgICAgICBpZihjb2RlYy5pbmRleE9mKCdhdmMxJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwudmlkZW9Db2RlYyA9IHRoaXMuYXZjMXRvYXZjb3RpKGNvZGVjKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXZlbC5hdWRpb0NvZGVjID0gY29kZWM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgbGV2ZWwgPSB7fTtcbiAgICB9XG4gICAgcmV0dXJuIGxldmVscztcbiAgfVxuXG4gIGF2YzF0b2F2Y290aShjb2RlYykge1xuICAgIHZhciByZXN1bHQsYXZjZGF0YSA9IGNvZGVjLnNwbGl0KCcuJyk7XG4gICAgaWYoYXZjZGF0YS5sZW5ndGggPiAyKSB7XG4gICAgICByZXN1bHQgPSBhdmNkYXRhLnNoaWZ0KCkgKyAnLic7XG4gICAgICByZXN1bHQgKz0gcGFyc2VJbnQoYXZjZGF0YS5zaGlmdCgpKS50b1N0cmluZygxNik7XG4gICAgICByZXN1bHQgKz0gKCcwMCcgKyBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KSkuc3Vic3RyKC00KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gY29kZWM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZCkge1xuICAgIHZhciBjdXJyZW50U04gPSAwLHRvdGFsZHVyYXRpb24gPSAwLCBsZXZlbCA9IHsgdXJsIDogYmFzZXVybCwgZnJhZ21lbnRzIDogW10sIGxpdmUgOiB0cnVlfSwgcmVzdWx0LCByZWdleHA7XG4gICAgcmVnZXhwID0gLyg/OiNFWFQtWC0oTUVESUEtU0VRVUVOQ0UpOihcXGQrKSl8KD86I0VYVC1YLShUQVJHRVREVVJBVElPTik6KFxcZCspKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qW1xcclxcbl0rKFteXFxyXFxuXSspfCg/OiNFWFQtWC0oRU5ETElTVCkpKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZWdleHAuZXhlYyhzdHJpbmcpKSAhPT0gbnVsbCl7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obil7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTt9KTtcbiAgICAgIHN3aXRjaChyZXN1bHRbMF0pIHtcbiAgICAgICAgY2FzZSAnTUVESUEtU0VRVUVOQ0UnOlxuICAgICAgICAgIGN1cnJlbnRTTiA9IGxldmVsLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgbGV2ZWwudGFyZ2V0ZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VORExJU1QnOlxuICAgICAgICAgIGxldmVsLmxpdmUgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgbGV2ZWwuZnJhZ21lbnRzLnB1c2goe3VybCA6IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sYmFzZXVybCksIGR1cmF0aW9uIDogZHVyYXRpb24sIHN0YXJ0IDogdG90YWxkdXJhdGlvbiwgc24gOiBjdXJyZW50U04rKywgbGV2ZWw6aWR9KTtcbiAgICAgICAgICB0b3RhbGR1cmF0aW9uKz1kdXJhdGlvbjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCdmb3VuZCAnICsgbGV2ZWwuZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgbGV2ZWwudG90YWxkdXJhdGlvbiA9IHRvdGFsZHVyYXRpb247XG4gICAgbGV2ZWwuZW5kU04gPSBjdXJyZW50U04gLSAxO1xuICAgIHJldHVybiBsZXZlbDtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdmFyIGRhdGEsc3RyaW5nID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVRleHQsIHVybCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VVUkwsIGlkID0gdGhpcy5pZDtcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZih1cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgLy8gZmFsbGJhY2sgdG8gaW5pdGlhbCBVUkxcbiAgICAgIHVybCA9IHRoaXMudXJsO1xuICAgIH1cbiAgICB0aGlzLnN0YXRzLnRsb2FkID0gbmV3IERhdGUoKTtcbiAgICB0aGlzLnN0YXRzLm10aW1lID0gbmV3IERhdGUodGhpcy54aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnKSk7XG5cbiAgICBpZihzdHJpbmcuaW5kZXhPZignI0VYVE0zVScpID09PSAwKSB7XG4gICAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRJTkY6JykgPiAwKSB7XG4gICAgICAgIC8vIDEgbGV2ZWwgcGxheWxpc3QsIHBhcnNlIGl0XG4gICAgICAgIGRhdGEgPSB0aGlzLnBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsdXJsLGlkKTtcbiAgICAgICAgLy8gaWYgZmlyc3QgcmVxdWVzdCwgZmlyZSBtYW5pZmVzdCBsb2FkZWQgZXZlbnQgYmVmb3JlaGFuZFxuICAgICAgICBpZih0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogW2RhdGFdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHRoaXMuc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgZGV0YWlscyA6IGRhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsSWQgOiBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiB0aGlzLnN0YXRzfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyx1cmwpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlkIDogaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogdGhpcy5zdGF0c30pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdXJsLCByZXNwb25zZSA6IGV2ZW50LmN1cnJlbnRUYXJnZXR9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdGhpcy51cmwsIHJlc3BvbnNlIDogZXZlbnQuY3VycmVudFRhcmdldH0pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuICAgIGlmKHRoaXMuc3RhdHMudGZpcnN0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbmV3IERhdGUoKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCJpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbmxldCBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblxub2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IG9ic2VydmVyO1xuIiwiLyoqXG4gKiBnZW5lcmF0ZSBNUDQgQm94XG4gKi9cblxuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBNUDQuTUFKT1JfQlJBTkQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAnaScuY2hhckNvZGVBdCgwKSxcbiAgICAgICdzJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ28nLmNoYXJDb2RlQXQoMCksXG4gICAgICAnbScuY2hhckNvZGVBdCgwKVxuICAgIF0pO1xuICAgIE1QNC5BVkMxX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2EnLmNoYXJDb2RlQXQoMCksXG4gICAgICAndicuY2hhckNvZGVBdCgwKSxcbiAgICAgICdjJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJzEnLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuTUlOT1JfVkVSU0lPTiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG4gICAgTVA0LlZJREVPX0hETFIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuICAgIE1QNC5BVURJT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzMsIDB4NmYsIDB4NzUsIDB4NmUsIC8vIGhhbmRsZXJfdHlwZTogJ3NvdW4nXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDUzLCAweDZmLCAweDc1LCAweDZlLFxuICAgICAgMHg2NCwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1NvdW5kSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6TVA0LlZJREVPX0hETFIsXG4gICAgICAnYXVkaW8nOk1QNC5BVURJT19IRExSXG4gICAgfTtcbiAgICBNUDQuRFJFRiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcbiAgICBNUDQuU1RDTyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlNUU0MgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RUUyA9IE1QNC5TVENPO1xuICAgIE1QNC5TVFNaID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfY291bnRcbiAgICBdKTtcbiAgICBNUDQuVk1IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBncmFwaGljc21vZGVcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCAvLyBvcGNvbG9yXG4gICAgXSk7XG4gICAgTVA0LlNNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gYmFsYW5jZVxuICAgICAgMHgwMCwgMHgwMCAvLyByZXNlcnZlZFxuICAgIF0pO1xuXG4gICAgTVA0LlNUU0QgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxXSk7Ly8gZW50cnlfY291bnRcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuTUlOT1JfVkVSU0lPTiwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuQVZDMV9CUkFORCk7XG4gICAgTVA0LkRJTkYgPSBNUDQuYm94KE1QNC50eXBlcy5kaW5mLCBNUDQuYm94KE1QNC50eXBlcy5kcmVmLCBNUDQuRFJFRikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSAwLFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICByZXN1bHQsXG4gICAgdmlldztcblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgc2l6ZSB3ZSBuZWVkIHRvIGFsbG9jYXRlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHNpemUgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KHJlc3VsdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIHJlc3VsdC5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuXG4gICAgLy8gY29weSB0aGUgcGF5bG9hZCBpbnRvIHRoZSByZXN1bHRcbiAgICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IHBheWxvYWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKGR1cmF0aW9uKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAxLCAweDVmLCAweDkwLCAvLyB0aW1lc2NhbGUsIDkwLDAwMCBcInRpY2tzXCIgcGVyIHNlY29uZFxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgICAgMHgwMCwgMHgwMFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGlhKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaWEsIE1QNC5tZGhkKHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsXG4gICAgICAgICAgICAgICAgICAgTVA0Lm1maGQoc24pLFxuICAgICAgICAgICAgICAgICAgIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKGR1cmF0aW9uKSB7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMSwgMHg1ZiwgMHg5MCwgLy8gdGltZXNjYWxlLCA5MCwwMDAgXCJ0aWNrc1wiIHBlciBzZWNvbmRcbiAgICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAgIDB4MDEsIDB4MDAsIC8vIDEuMCB2b2x1bWVcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweGZmLCAweGZmLCAweGZmLCAweGZmIC8vIG5leHRfdHJhY2tfSURcbiAgICAgIF0pO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tdmhkLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc2R0cCh0cmFjaykge1xuICAgIHZhclxuICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgICBmbGFncyxcbiAgICAgIGk7XG5cbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCxcbiAgICAgICAgICAgICAgIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsXG4gICAgICAgICAgICAgICBNUDQuc3RzZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHN6LCBNUDQuU1RTWiksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnNwcy5sZW5ndGg7IGkrKykge1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpOyAvLyBzZXF1ZW5jZVBhcmFtZXRlclNldExlbmd0aFxuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5zcHNbaV0pKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggPj4+IDgpICYgMHhGRik7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRyYWNrLnBwc1tpXSkpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLndpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMyxcbiAgICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgICAgMHg2ZiwgMHg2YSwgMHg3MywgMHgyZCxcbiAgICAgICAgMHg2MywgMHg2ZiwgMHg2ZSwgMHg3NCxcbiAgICAgICAgMHg3MiwgMHg2OSwgMHg2MiwgMHgyZCxcbiAgICAgICAgMHg2OCwgMHg2YywgMHg3MywgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5hdmNDLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAxLCAvLyBjb25maWd1cmF0aW9uVmVyc2lvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYywgLy8gQVZDUHJvZmlsZUluZGljYXRpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXRpYmlsaXR5LCAvLyBwcm9maWxlX2NvbXBhdGliaWxpdHlcbiAgICAgICAgICAgIHRyYWNrLmxldmVsSWRjLCAvLyBBVkNMZXZlbEluZGljYXRpb25cbiAgICAgICAgICAgIDB4ZmYgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICBdLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5zcHMubGVuZ3RoIC8vIG51bU9mU2VxdWVuY2VQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5idHJ0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAwLCAweDFjLCAweDljLCAweDgwLCAvLyBidWZmZXJTaXplREJcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzAsIC8vIG1heEJpdHJhdGVcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzBdKSkgLy8gYXZnQml0cmF0ZVxuICAgICAgICAgICk7XG4gIH1cblxuICBzdGF0aWMgZXNkcyh0cmFjaykge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG5cbiAgICAgIDB4MDMsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgxNyt0cmFjay5jb25maWcubGVuZ3RoLCAvLyBsZW5ndGhcbiAgICAgIDB4MDAsIDB4MDEsIC8vZXNfaWRcbiAgICAgIDB4MDAsIC8vIHN0cmVhbV9wcmlvcml0eVxuXG4gICAgICAweDA0LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MGYrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAgIDB4MTUsIC8vIHN0cmVhbV90eXBlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBidWZmZXJfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYXZnQml0cmF0ZVxuXG4gICAgICAweDA1IC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgXS5jb25jYXQoW3RyYWNrLmNvbmZpZy5sZW5ndGhdKS5jb25jYXQodHJhY2suY29uZmlnKS5jb25jYXQoWzB4MDYsIDB4MDEsIDB4MDJdKSk7IC8vIEdBU3BlY2lmaWNDb25maWcpKTsgLy8gbGVuZ3RoICsgYXVkaW8gY29uZmlnIGRlc2NyaXB0b3JcbiAgfVxuXG4gIHN0YXRpYyBtcDRhKHRyYWNrKSB7XG4gICAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tcDRhLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIHRyYWNrLmNoYW5uZWxDb3VudCwgLy8gY2hhbm5lbGNvdW50XG4gICAgICAgIDB4MDAsIDB4MTAsIC8vIHNhbXBsZVNpemU6MTZiaXRzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkMlxuICAgICAgICAodHJhY2suYXVkaW9zYW1wbGVyYXRlID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlICYgMHhmZiwgLy9cbiAgICAgICAgMHgwMCwgMHgwMF0pLFxuICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5lc2RzLCBNUDQuZXNkcyh0cmFjaykpKTtcbiAgfVxuXG4gIHN0YXRpYyBzdHNkKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCAsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCAsIE1QNC5hdmMxKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHRraGQodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0cmFjay5pZCA+PiAyNCkgJiAweEZGLFxuICAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDB4RkYsXG4gICAgICAodHJhY2suaWQgPj4gOCkgJiAweEZGLFxuICAgICAgdHJhY2suaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAyNCksXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgdHJhY2suZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAodHJhY2sud2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgdHJhY2sud2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgICh0cmFjay5oZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgdHJhY2suaGVpZ2h0ICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkge1xuICAgIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBNUDQuc2R0cCh0cmFjayk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWYsXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gMjQpLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+MjQpLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LnRydW4odHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmR0XG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gdHJhZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gbW9vZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgOCksICAvLyBtZGF0IGhlYWRlclxuICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIHRyYWNrIGJveC5cbiAgICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IGEgdHJhY2sgZGVmaW5pdGlvblxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gICAqL1xuICBzdGF0aWMgdHJhayh0cmFjaykge1xuICAgIHRyYWNrLmR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24gfHwgMHhmZmZmZmZmZjtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhayxcbiAgICAgICAgICAgICAgIE1QNC50a2hkKHRyYWNrKSxcbiAgICAgICAgICAgICAgIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAodHJhY2suaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcywgc2FtcGxlLCBpLCBhcnJheTtcblxuICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdO1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoMTIgKyAoMTYgKiBzYW1wbGVzLmxlbmd0aCkpO1xuICAgIG9mZnNldCArPSA4ICsgYXJyYXkuYnl0ZUxlbmd0aDtcblxuICAgIGFycmF5LnNldChbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MGYsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAoc2FtcGxlcy5sZW5ndGggPj4+IDI0KSAmIDB4RkYsXG4gICAgICAoc2FtcGxlcy5sZW5ndGggPj4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2FtcGxlcy5sZW5ndGggPj4+IDgpICYgMHhGRixcbiAgICAgIHNhbXBsZXMubGVuZ3RoICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdLDApO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5zaXplICYgMHhGRiwgLy8gc2FtcGxlX3NpemVcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0xlYWRpbmcgPDwgMikgfCBzYW1wbGUuZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzRGVwZW5kZWRPbiA8PCA2KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgc2FtcGxlLmZsYWdzLmlzTm9uU3luY1NhbXBsZSxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZGF0aW9uUHJpb3JpdHkgJiAweEYwIDw8IDgsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRhdGlvblByaW9yaXR5ICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCAmIDB4RkYgLy8gc2FtcGxlX2NvbXBvc2l0aW9uX3RpbWVfb2Zmc2V0XG4gICAgICBdLDEyKzE2KmkpO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJ1biwgYXJyYXkpO1xuICB9XG5cbiAgc3RhdGljIGluaXRTZWdtZW50KHRyYWNrcykge1xuXG4gICAgaWYoIU1QNC50eXBlcykge1xuICAgICAgTVA0LmluaXQoKTtcbiAgICB9XG4gICAgdmFyXG4gICAgICBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksXG4gICAgICByZXN1bHQ7XG5cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG5cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCl7fVxubGV0IGZha2VMb2dnZXIgPSB7XG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Zykge1xuICBpZiAoZGVidWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnICAgICAgID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gZGVidWcubG9nICAgPyBkZWJ1Zy5sb2cuYmluZChkZWJ1ZykgICA6IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBkZWJ1Zy5pbmZvICA/IGRlYnVnLmluZm8uYmluZChkZWJ1ZykgIDogY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBkZWJ1Zy5lcnJvciA/IGRlYnVnLmVycm9yLmJpbmQoZGVidWcpIDogY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gZGVidWcud2FybiAgPyBkZWJ1Zy53YXJuLmJpbmQoZGVidWcpICA6IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpO1xuXG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBub29wO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIl19
