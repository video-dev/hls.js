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
var BUFFER_FLUSHING = 6;

var BufferController = (function () {
  function BufferController(levelController, config) {
    this.levelController = levelController;
    this.config = config;
    this.startPosition = 0;
    this.fragmentLoader = new FragmentLoader(config);
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
  }

  _prototypeProperties(BufferController, null, {
    destroy: {
      value: function destroy() {
        this.stop();
        this.fragmentLoader.destroy();
        observer.removeListener(Event.MANIFEST_PARSED, this.onmp);
        // remove video listener
        if (this.video) {
          this.video.removeEventListener("seeking", this.onvseeking);
          this.video.removeEventListener("seeked", this.onvseeked);
          this.video.removeEventListener("loadedmetadata", this.onvmetadata);
          this.onvseeking = this.onvseeked = this.onvmetadata = null;
        }
        this.state = IDLE;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    start: {
      value: function start() {
        this.startInternal();
        if (this.lastCurrentTime) {
          logger.log("resuming video @ " + this.lastCurrentTime);
          this.startPosition = this.lastCurrentTime;
          this.state = IDLE;
        } else {
          this.state = STARTING;
        }
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    restart: {
      value: function restart() {
        this.startInternal();
        // this will flush everything and restart playback
        //this.immediateLevelSwitch();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    startInternal: {
      value: function startInternal() {
        this.stop();
        this.demuxer = new Demuxer(this.config);
        this.timer = setInterval(this.ontick, 100);
        observer.on(Event.FRAG_LOADED, this.onfl);
        observer.on(Event.FRAG_PARSING_INIT_SEGMENT, this.onis);
        observer.on(Event.FRAG_PARSING_DATA, this.onfpg);
        observer.on(Event.FRAG_PARSED, this.onfp);
        observer.on(Event.LEVEL_LOADED, this.onll);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stop: {
      value: function stop() {
        this.mp4segments = [];
        this.flushRange = [];
        this.bufferRange = [];
        this.frag = null;
        this.fragmentLoader.abort();
        this.flushBufferCounter = 0;
        if (this.sourceBuffer) {
          for (var type in this.sourceBuffer) {
            var sb = this.sourceBuffer[type];
            try {
              this.mediaSource.removeSourceBuffer(sb);
              sb.removeEventListener("updateend", this.onsbue);
              sb.removeEventListener("error", this.onsbe);
            } catch (err) {}
          }
          this.sourceBuffer = null;
        }
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        if (this.demuxer) {
          this.demuxer.destroy();
          this.demuxer = null;
        }
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
            break;
          case IDLE:
            // handle end of immediate switching if needed
            if (this.immediateSwitch) {
              this.immediateLevelSwitchEnd();
            }
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
                bufferEnd = bufferInfo.end,
                maxBufLen;
            // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
            if (this.levels[loadLevel].hasOwnProperty("bitrate")) {
              maxBufLen = Math.min(8 * this.config.maxBufferSize / this.levels[loadLevel].bitrate, this.config.maxBufferLength);
            } else {
              maxBufLen = this.config.maxBufferLength;
            }
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
                break;
              }
              // find fragment index, contiguous with end of buffer position
              var fragments = loadLevelDetails.fragments,
                  frag,
                  sliding = loadLevelDetails.sliding,
                  start = fragments[0].start + sliding;
              // check if requested position is within seekable boundaries :
              // in case of live playlist we need to ensure that requested position is not located before playlist start
              if (bufferEnd < start) {
                logger.log("requested position: " + bufferEnd + " is before start of playlist, reset video position to start: " + start);
                this.video.currentTime = start + 0.01;
                break;
              }
              //look for fragments matching with current play position
              for (fragIdx = 0; fragIdx < fragments.length; fragIdx++) {
                frag = fragments[fragIdx];
                start = frag.start + sliding;
                //logger.log(`level/sn/start/end/bufEnd:${loadLevel}/${frag.sn}/${start}/${start+frag.duration}/${bufferEnd}`);
                // offset should be within fragment boundary
                if (start <= bufferEnd && start + frag.duration > bufferEnd) {
                  break;
                }
                //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
              }
              if (fragIdx >= 0 && fragIdx < fragments.length) {
                if (this.frag && frag.sn === this.frag.sn) {
                  if (fragIdx === fragments.length - 1) {
                    // we are at the end of the playlist and we already loaded last fragment, don't do anything
                    break;
                  } else {
                    frag = fragments[fragIdx + 1];
                    logger.log("SN just loaded, load next one: " + frag.sn);
                  }
                }
                logger.log("Loading       " + frag.sn + " of [" + fragments[0].sn + " ," + fragments[fragments.length - 1].sn + "],level " + loadLevel);
                //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));

                this.frag = frag;
                this.level = loadLevel;
                this.fragmentLoader.load(frag);
                this.state = LOADING;
              }
            }
            break;
          case WAITING_LEVEL:
            var level = this.levels[this.level];
            // check if playlist is already loaded
            if (level && level.details) {
              this.state = IDLE;
            }
            break;
          case LOADING:
          // nothing to do, wait for fragment retrieval
          case PARSING:
            // nothing to do, wait for fragment being parsed
            break;
          case PARSED:
          case APPENDING:
            if (this.sourceBuffer) {
              // if MP4 segment appending in progress nothing to do
              if (this.sourceBuffer.audio && this.sourceBuffer.audio.updating || this.sourceBuffer.video && this.sourceBuffer.video.updating) {} else if (this.mp4segments.length) {
                var segment = this.mp4segments.shift();
                try {
                  //logger.log(`appending ${segment.type} SB, size:${segment.data.length}`);
                  this.sourceBuffer[segment.type].appendBuffer(segment.data);
                } catch (err) {
                  // in case any error occured while appending, put back segment in mp4segments table
                  logger.log("error while trying to append buffer:" + err.message + ",try appending later");
                  this.mp4segments.unshift(segment);
                }
                this.state = APPENDING;
              }
            }
            break;
          case BUFFER_FLUSHING:
            // loop through all buffer ranges to flush
            while (this.flushRange.length) {
              var range = this.flushRange[0];
              // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
              if (this.flushBuffer(range.start, range.end)) {
                // range flushed, remove from flush array
                this.flushRange.shift();
                // reset flush counter
                this.flushBufferCounter = 0;
              } else {
                // flush in progress, come back later
                break;
              }
            }

            if (this.flushRange.length === 0) {
              // move to IDLE once flush complete. this should trigger new fragment loading
              this.state = IDLE;
            }
            /* if not everything flushed, stay in BUFFER_FLUSHING state. we will come back here
               each time sourceBuffer updateend() callback will be triggered
               */
            break;
          default:
            break;
        }
        // check/update current fragment
        this._checkFragmentChanged();
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
    getBufferRange: {
      value: function getBufferRange(position) {
        var i, range;
        for (i = this.bufferRange.length - 1; i >= 0; i--) {
          range = this.bufferRange[i];
          if (position >= range.start && position <= range.end) {
            return range;
          }
        }
        return null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    currentLevel: {
      get: function () {
        if (this.video) {
          var range = this.getBufferRange(this.video.currentTime);
          if (range) {
            return range.frag.level;
          }
        }
        return -1;
      },
      enumerable: true,
      configurable: true
    },
    nextBufferRange: {
      get: function () {
        if (this.video) {
          // first get end range of current fragment
          return this.followingBufferRange(this.getBufferRange(this.video.currentTime));
        } else {
          return null;
        }
      },
      enumerable: true,
      configurable: true
    },
    followingBufferRange: {
      value: function followingBufferRange(range) {
        if (range) {
          // try to get range of next fragment (500ms after this range)
          return this.getBufferRange(range.end + 0.5);
        }
        return null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextLevel: {
      get: function () {
        var range = this.nextBufferRange;
        if (range) {
          return range.frag.level;
        } else {
          return -1;
        }
      },
      enumerable: true,
      configurable: true
    },
    isBuffered: {
      value: function isBuffered(position) {
        var v = this.video,
            buffered = v.buffered;
        for (var i = 0; i < buffered.length; i++) {
          if (position >= buffered.start(i) && position <= buffered.end(i)) {
            return true;
          }
        }
        return false;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _checkFragmentChanged: {
      value: function CheckFragmentChanged() {
        var rangeCurrent, currentTime;
        if (this.video && this.video.seeking === false) {
          this.lastCurrentTime = currentTime = this.video.currentTime;
          if (this.isBuffered(currentTime)) {
            rangeCurrent = this.getBufferRange(currentTime);
          }
        }

        if (rangeCurrent && rangeCurrent.frag !== this.fragCurrent) {
          this.fragCurrent = rangeCurrent.frag;
          observer.trigger(Event.FRAG_CHANGED, { frag: this.fragCurrent });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    flushBuffer: {

      /*
        abort any buffer append in progress, and flush all buffered data
        return true once everything has been flushed.
        sourceBuffer.abort() and sourceBuffer.remove() are asynchronous operations
        the idea is to call this function from tick() timer and call it again until all resources have been cleaned
        the timer is rearmed upon sourceBuffer updateend() event, so this should be optimal
      */
      value: function flushBuffer(startOffset, endOffset) {
        var sb, i, bufStart, bufEnd, flushStart, flushEnd;
        //logger.log('flushBuffer,pos/start/end: ' + this.video.currentTime + '/' + startOffset + '/' + endOffset);
        // safeguard to avoid infinite looping
        if (this.flushBufferCounter++ < 2 * this.bufferRange.length && this.sourceBuffer) {
          for (var type in this.sourceBuffer) {
            sb = this.sourceBuffer[type];
            if (!sb.updating) {
              for (i = 0; i < sb.buffered.length; i++) {
                bufStart = sb.buffered.start(i);
                bufEnd = sb.buffered.end(i);
                // workaround firefox not able to properly flush multiple buffered range.
                if (navigator.userAgent.toLowerCase().indexOf("firefox") !== -1 && endOffset === Number.POSITIVE_INFINITY) {
                  flushStart = startOffset;
                  flushEnd = endOffset;
                } else {
                  flushStart = Math.max(bufStart, startOffset);
                  flushEnd = Math.min(bufEnd, endOffset);
                }
                /* sometimes sourcebuffer.remove() does not flush
                   the exact expected time range.
                   to avoid rounding issues/infinite loop,
                   only flush buffer range of length greater than 500ms.
                */
                if (flushEnd - flushStart > 0.5) {
                  logger.log("flush " + type + " [" + flushStart + "," + flushEnd + "], of [" + bufStart + "," + bufEnd + "], pos:" + this.video.currentTime);
                  sb.remove(flushStart, flushEnd);
                  return false;
                }
              }
            } else {
              //logger.log('abort ' + type + ' append in progress');
              // this will abort any appending in progress
              //sb.abort();
              return false;
            }
          }
        }

        /* after successful buffer flushing, rebuild buffer Range array
          loop through existing buffer range and check if
          corresponding range is still buffered. only push to new array already buffered range
        */
        var newRange = [],
            range;
        for (i = 0; i < this.bufferRange.length; i++) {
          range = this.bufferRange[i];
          if (this.isBuffered((range.start + range.end) / 2)) {
            newRange.push(range);
          }
        }
        this.bufferRange = newRange;

        logger.log("buffer flushed");
        // everything flushed !
        return true;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    immediateLevelSwitch: {

      /*
        on immediate level switch :
         - pause playback if playing
         - cancel any pending load request
         - and trigger a buffer flush
      */
      value: function immediateLevelSwitch() {
        if (!this.immediateSwitch) {
          this.immediateSwitch = true;
          this.previouslyPaused = this.video.paused;
          this.video.pause();
        }
        this.fragmentLoader.abort();
        // flush everything
        this.flushRange.push({ start: 0, end: Number.POSITIVE_INFINITY });
        // trigger a sourceBuffer flush
        this.state = BUFFER_FLUSHING;
        // speed up switching, trigger timer function
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    immediateLevelSwitchEnd: {

      /*
         on immediate level switch end, after new fragment has been buffered :
          - nudge video decoder by slightly adjusting video currentTime
          - resume the playback if needed
      */
      value: function immediateLevelSwitchEnd() {
        this.immediateSwitch = false;
        this.video.currentTime -= 0.0001;
        if (!this.previouslyPaused) {
          this.video.play();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    nextLevelSwitch: {
      value: function nextLevelSwitch() {
        /* try to switch ASAP without breaking video playback :
           in order to ensure smooth but quick level switching,
          we need to find the next flushable buffer range
          we should take into account new segment fetch time
        */
        var fetchdelay, currentRange, nextRange;

        currentRange = this.getBufferRange(this.video.currentTime);
        if (currentRange) {
          // flush buffer preceding current fragment (flush until current fragment start offset)
          // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
          this.flushRange.push({ start: 0, end: currentRange.start - 1 });
        }

        if (!this.video.paused) {
          // add a safety delay of 1s
          fetchdelay = this.levelController.nextFetchDuration() + 1;
        } else {
          fetchdelay = 0;
        }
        //logger.log('fetchdelay:'+fetchdelay);
        // find buffer range that will be reached once new fragment will be fetched
        nextRange = this.getBufferRange(this.video.currentTime + fetchdelay);
        if (nextRange) {
          // we can flush buffer range following this one without stalling playback
          nextRange = this.followingBufferRange(nextRange);
          if (nextRange) {
            // flush position is the start position of this new buffer
            this.flushRange.push({ start: nextRange.start, end: Number.POSITIVE_INFINITY });
          }
        }
        if (this.flushRange.length) {
          // trigger a sourceBuffer flush
          this.state = BUFFER_FLUSHING;
          // speed up switching, trigger timer function
          this.tick();
        }
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
        this.onvseeked = this.onVideoSeeked.bind(this);
        this.onvmetadata = this.onVideoMetadata.bind(this);
        this.video.addEventListener("seeking", this.onvseeking);
        this.video.addEventListener("seeked", this.onvseeked);
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
        if (this.video) {
          this.lastCurrentTime = this.video.currentTime;
        }
        // tick to speed up processing
        this.tick();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onVideoSeeked: {
      value: function onVideoSeeked() {
        // tick to speed up FRAGMENT_PLAYING triggering
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
            this.demuxer.setDuration(this.levels[this.level].details.totalduration);
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
        if (audioCodec === undefined || data.audiocodec === undefined) {
          audioCodec = data.audioCodec;
        }
        if (videoCodec === undefined || data.videocodec === undefined) {
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
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: this.frag });
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
        if (data.levels.length > 1) {
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

          // find index of first level in sorted levels
          for (i = 0; i < levels.length; i++) {
            if (levels[i].bitrate === bitrateStart) {
              this._firstLevel = i;
              logger.log("manifest loaded," + levels.length + " level(s) found, first bitrate:" + bitrateStart);
              break;
            }
          }

          //this._startLevel = -1;
          observer.trigger(Event.MANIFEST_PARSED, { levels: this._levels,
            startLevel: this._startLevel,
            audiocodecswitch: aac && heaac
          });
        } else {
          this._levels = data.levels;
          this._firstLevel = 0;
          observer.trigger(Event.MANIFEST_PARSED, { levels: this._levels,
            startLevel: 0,
            audiocodecswitch: false
          });
        }

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
    firstLevel: {
      get: function () {
        return this._firstLevel;
      },
      set: function (newLevel) {
        this._firstLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    startLevel: {
      get: function () {
        if (this._startLevel === undefined) {
          return this._firstLevel;
        } else {
          return this._startLevel;
        }
      },
      set: function (newLevel) {
        this._startLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    onFragmentLoaded: {
      value: function onFragmentLoaded(event, data) {
        var stats = data.stats;
        this.lastfetchduration = (stats.tload - stats.trequest) / 1000;
        this.lastfetchlevel = data.frag.level;
        this.lastbw = stats.length * 8 / this.lastfetchduration;
        //console.log(`len:${stats.length},fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}`);
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
    nextFetchDuration: {
      value: function nextFetchDuration() {
        if (this.lastfetchduration) {
          return this.lastfetchduration * this._levels[this._level].bitrate / this._levels[this.lastfetchlevel].bitrate;
        } else {
          return 0;
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
  function Demuxer(config) {
    if (config.enableWorker && typeof Worker !== "undefined") {
      logger.log("TS demuxing in webworker");
      try {
        var work = require("webworkify");
        this.w = work(TSDemuxerWorker);
        this.onwmsg = this.onWorkerMessage.bind(this);
        this.w.addEventListener("message", this.onwmsg);
        this.w.postMessage({ cmd: "init" });
      } catch (err) {
        logger.log("error while initializing TSDemuxerWorker, fallback on regular TSDemuxer");
        this.demuxer = new TSDemuxer();
      }
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
        this.switchLevel();
        this._initPTS = this._initDTS = undefined;
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
            pesPts = (frag[9] & 14) << 29 | (frag[10] & 255) << 22 | (frag[11] & 254) << 14 | (frag[12] & 255) << 7 | (frag[13] & 254) >>> 1;
            if (pesFlags & 64) {
              pesDts = (frag[14] & 14) << 29 | (frag[15] & 255) << 22 | (frag[16] & 254) << 14 | (frag[17] & 255) << 7 | (frag[18] & 254) >>> 1;
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
            mp4Sample.duration = avcSample.dts - lastSampleDTS;
            if (mp4Sample.duration < 0) {
              //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
              mp4Sample.duration = 0;
            }
          } else {
            // check if fragments are contiguous (i.e. no missing frames between fragment)
            if (this.nextAvcPts) {
              var delta = (avcSample.pts - this.nextAvcPts) / 90,
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
            compositionTimeOffset: avcSample.pts - avcSample.dts,
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
        this.nextAvcPts = avcSample.pts + mp4Sample.duration;
        //logger.log('Video/lastAvcDts/nextAvcPts:' + this.lastAvcDts + '/' + this.nextAvcPts);

        this._avcSamplesLength = 0;
        this._avcSamplesNbNalu = 0;

        moof = MP4.moof(track.sequenceNumber++, firstDTS, track);
        observer.trigger(Event.FRAG_PARSING_DATA, {
          moof: moof,
          mdat: mdat,
          startPTS: firstPTS / 90000,
          endPTS: this.nextAvcPts / 90000,
          startDTS: firstDTS / 90000,
          endDTS: (avcSample.dts + mp4Sample.duration) / 90000,
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
            overflow,
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
                } else {
                  // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                  overflow = i - state - 1;
                  if (overflow) {
                    //logger.log('first NALU found with overflow:' + overflow);
                    if (this._avcSamples.length) {
                      var lastavcSample = this._avcSamples[this._avcSamples.length - 1];
                      var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
                      var tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                      tmp.set(lastUnit.data, 0);
                      tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                      lastUnit.data = tmp;
                      lastavcSample.units.length += overflow;
                      this._avcSamplesLength += overflow;
                    }
                  }
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
        var track = this._aacTrack,
            aacSample,
            data = pes.data,
            config,
            adtsFrameSize,
            adtsStartOffset,
            adtsHeaderLen,
            stamp,
            i;
        if (this.aacOverFlow) {
          var tmp = new Uint8Array(this.aacOverFlow.byteLength + data.byteLength);
          tmp.set(this.aacOverFlow, 0);
          tmp.set(data, this.aacOverFlow.byteLength);
          data = tmp;
        }
        //logger.log('PES:' + Hex.hexDump(data));
        if (data[0] === 255) {
          if (!track.audiosamplerate) {
            config = this._ADTStoAudioConfig(pes.data, this.audioCodec);
            track.config = config.config;
            track.audiosamplerate = config.samplerate;
            track.channelCount = config.channelCount;
            track.codec = config.codec;
            track.duration = 90000 * this._duration;
            console.log("parsed   codec:" + track.codec + ",rate:" + config.samplerate + ",nb channel:" + config.channelCount);
          }
          adtsStartOffset = i = 0;
          while (adtsStartOffset + 5 < data.length) {
            // retrieve frame size
            adtsFrameSize = (data[adtsStartOffset + 3] & 3) << 11;
            // byte 4
            adtsFrameSize |= data[adtsStartOffset + 4] << 3;
            // byte 5
            adtsFrameSize |= (data[adtsStartOffset + 5] & 224) >>> 5;
            adtsHeaderLen = !!(data[adtsStartOffset + 1] & 1) ? 7 : 9;
            adtsFrameSize -= adtsHeaderLen;
            stamp = pes.pts + i * 1024 * 90000 / track.audiosamplerate;
            //stamp = pes.pts;
            //console.log('AAC frame, offset/length/pts:' + (adtsStartOffset+7) + '/' + adtsFrameSize + '/' + stamp.toFixed(0));
            if (adtsStartOffset + adtsHeaderLen + adtsFrameSize <= data.length) {
              aacSample = { unit: data.subarray(adtsStartOffset + adtsHeaderLen, adtsStartOffset + adtsHeaderLen + adtsFrameSize), pts: stamp, dts: stamp };
              this._aacSamples.push(aacSample);
              this._aacSamplesLength += adtsFrameSize;
              adtsStartOffset += adtsFrameSize + adtsHeaderLen;
              i++;
            } else {
              break;
            }
          }
        } else {
          observer.trigger(Event.FRAG_PARSING_ERROR, "Stream did not start with ADTS header.");
          return;
        }
        if (!this._initSegGenerated) {
          this._generateInitSegment();
        }
        if (adtsStartOffset < data.length) {
          this.aacOverFlow = data.subarray(adtsStartOffset, data.length);
        } else {
          this.aacOverFlow = null;
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
            mp4Sample.duration = aacSample.dts - lastSampleDTS;
            if (mp4Sample.duration < 0) {
              //logger.log('invalid sample duration at PTS/DTS::' + avcSample.pts + '/' + avcSample.dts + ':' + mp4Sample.duration);
              mp4Sample.duration = 0;
            }
          } else {
            // check if fragments are contiguous (i.e. no missing frames between fragment)
            if (this.nextAacPts && this.nextAacPts !== aacSample.pts) {
              //logger.log('Audio next PTS:' + this.nextAacPts);
              var delta = (aacSample.pts - this.nextAacPts) / 90;
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
        this.nextAacPts = aacSample.pts + mp4Sample.duration;
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));

        this._aacSamplesLength = 0;

        moof = MP4.moof(track.sequenceNumber++, firstDTS, track);
        observer.trigger(Event.FRAG_PARSING_DATA, {
          moof: moof,
          mdat: mdat,
          startPTS: firstPTS / 90000,
          endPTS: this.nextAacPts / 90000,
          startDTS: firstDTS / 90000,
          endDTS: (aacSample.dts + mp4Sample.duration) / 90000,
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
            userAgent = navigator.userAgent.toLowerCase(),
            adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000];

        // byte 2
        adtsObjectType = ((data[2] & 192) >>> 6) + 1;
        adtsSampleingIndex = (data[2] & 60) >>> 2;
        adtsChanelConfig = (data[2] & 1) << 2;
        // byte 3
        adtsChanelConfig |= (data[3] & 192) >>> 6;

        console.log("manifest codec:" + audioCodec + ",ADTS data:type:" + adtsObjectType + ",sampleingIndex:" + adtsSampleingIndex + "[" + adtsSampleingRates[adtsSampleingIndex] + "kHz],channelConfig:" + adtsChanelConfig);


        // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
        if (userAgent.indexOf("firefox") !== -1) {
          if (adtsSampleingIndex >= 6) {
            adtsObjectType = 5;
            config = new Array(4);
            // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
            // there is a factor 2 between frame sample rate and output sample rate
            // multiply frequency by 2 (see table below, equivalent to substract 3)
            adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
          } else {
            adtsObjectType = 2;
            config = new Array(2);
            adtsExtensionSampleingIndex = adtsSampleingIndex;
          }
          // Android : always use AAC
        } else if (userAgent.indexOf("android") !== -1) {
          adtsObjectType = 2;
          config = new Array(2);
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        } else {
          /*  for other browsers
              always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
          */
          adtsObjectType = 5;
          config = new Array(4);
          // if (manifest codec is HE-AAC) OR (manifest codec not specified AND frequency less than 24kHz)
          if (audioCodec && audioCodec.indexOf("mp4a.40.5") !== -1 || !audioCodec && adtsSampleingIndex >= 6) {
            // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
            // there is a factor 2 between frame sample rate and output sample rate
            // multiply frequency by 2 (see table below, equivalent to substract 3)
            adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
          } else {
            adtsExtensionSampleingIndex = adtsSampleingIndex;
          }
        }
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
            this._initPTS = this._aacSamples[0].pts - 90000 * this.timeOffset;
            this._initDTS = this._aacSamples[0].dts - 90000 * this.timeOffset;
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
              this._initPTS = this._avcSamples[0].pts - 90000 * this.timeOffset;
              this._initDTS = this._avcSamples[0].dts - 90000 * this.timeOffset;
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
              this._initPTS = Math.min(this._avcSamples[0].pts, this._aacSamples[0].pts) - 90000 * this.timeOffset;
              this._initDTS = Math.min(this._avcSamples[0].dts, this._aacSamples[0].dts) - 90000 * this.timeOffset;
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
  // fired when MediaSource has been succesfully attached to video element - data: { mediaSource }
  MSE_ATTACHED: "hlsMediaSourceAttached",
  // fired after manifest has been loaded - data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  MANIFEST_LOADED: "hlsManifestLoaded",
  // fired after manifest has been parsed - data: { levels : [available quality levels] , startLevel : playback start level, audiocodecswitch: true if different audio codecs used}
  MANIFEST_PARSED: "hlsManifestParsed",
  // fired when a level playlist loading starts - data: { levelId : id of level being loaded}
  LEVEL_LOADING: "hlsLevelLoading",
  // fired when a level playlist loading finishes - data: { details : levelDetails object, levelId : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  LEVEL_LOADED: "hlsLevelLoaded",
  // fired when a level switch is requested - data: { levelId : id of new level }
  LEVEL_SWITCH: "hlsLevelSwitch",
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING: "hlsFragmentLoading",
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED: "hlsFragmentLoaded",
  // fired when Init Segment has been extracted from fragment - data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT: "hlsFragmentParsingInitSegment",
  // fired when moof/mdat have been extracted from fragment - data: { moof : moof MP4 box, mdat : mdat MP4 box}
  FRAG_PARSING_DATA: "hlsFragmentParsingData",
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: "hlsFragmentParsed",
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: "hlsFragmentBuffered",
  // fired when fragment matching with current video position is changing - data : { frag : fragment object }
  FRAG_CHANGED: "hlsFragmentChanged",
  // Identifier for fragment/playlist load error - data: { url : faulty URL, response : XHR response}
  LOAD_ERROR: "hlsLoadError",
  // Identifier for fragment/playlist load timeout - data: { url : faulty URL, response : XHR response}
  LOAD_TIMEOUT: "hlsLoadTimeOut",
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_ERROR: "hlsLevelError",
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR: "hlsFragmentParsingError"
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
var XhrLoader = _interopRequire(require("./utils/xhr-loader"));

//import MP4Inspect         from '/remux/mp4-inspector';

var Hls = (function () {
  function Hls() {
    var config = arguments[0] === undefined ? {} : arguments[0];
    var configDefault = {
      debug: false,
      maxBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      enableWorker: true,
      fragLoadingTimeOut: 60000,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 500,
      manifestLoadingTimeOut: 10000,
      manifestLoadingMaxRetry: 3,
      manifestLoadingRetryDelay: 500,
      loader: XhrLoader
    };
    for (var prop in configDefault) {
      if (prop in config) {
        continue;
      }
      config[prop] = configDefault[prop];
    }
    enableLogs(config.debug);

    this.playlistLoader = new PlaylistLoader(config);
    this.levelController = new LevelController(this.playlistLoader);
    this.bufferController = new BufferController(this.levelController, config);
    this.Events = Event;
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
        this.unloadSource();
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
    recoverError: {
      value: function recoverError() {
        var video = this.video;
        this.detachVideo();
        this.attachVideo(video);
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
    currentLevel: {

      /** Return current playback quality level **/
      get: function () {
        return this.bufferController.currentLevel;
      },


      /* set quality level immediately (-1 for automatic level selection) */
      set: function (newLevel) {
        this.loadLevel = newLevel;
        this.bufferController.immediateLevelSwitch();
      },
      enumerable: true,
      configurable: true
    },
    nextLevel: {

      /** Return next playback quality level (quality level of next fragment) **/
      get: function () {
        return this.bufferController.nextLevel;
      },


      /* set quality level for next fragment (-1 for automatic level selection) */
      set: function (newLevel) {
        this.loadLevel = newLevel;
        this.bufferController.nextLevelSwitch();
      },
      enumerable: true,
      configurable: true
    },
    loadLevel: {

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
    firstLevel: {

      /** Return first level (index of first level referenced in manifest)
      **/
      get: function () {
        return this.levelController.firstLevel;
      },


      /** set first level (index of first level referenced in manifest)
      **/
      set: function (newLevel) {
        this.levelController.firstLevel = newLevel;
      },
      enumerable: true,
      configurable: true
    },
    startLevel: {

      /** Return start level (level of first fragment that will be played back)
          if not overrided by user, first level appearing in manifest will be used as start level
          if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
      **/
      get: function () {
        return this.levelController.startLevel;
      },


      /** set  start level (level of first fragment that will be played back)
          if not overrided by user, first level appearing in manifest will be used as start level
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
    }
  });

  return Hls;
})();

module.exports = Hls;

},{"./controller/buffer-controller":3,"./controller/level-controller":4,"./events":9,"./loader/playlist-loader":12,"./observer":13,"./utils/logger":15,"./utils/xhr-loader":16}],11:[function(require,module,exports){
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

var FragmentLoader = (function () {
  function FragmentLoader(config) {
    this.config = config;
  }

  _prototypeProperties(FragmentLoader, null, {
    destroy: {
      value: function destroy() {
        if (this.loader) {
          this.loader.destroy();
          this.loader = null;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    abort: {
      value: function abort() {
        if (this.loader) {
          this.loader.abort();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(frag) {
        this.frag = frag;
        this.loader = new this.config.loader();
        this.loader.load(frag.url, "arraybuffer", this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), this.config.fragLoadingTimeOut, this.config.fragLoadingMaxRetry, this.config.fragLoadingRetryDelay);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event, stats) {
        var payload = event.currentTarget.response;
        stats.length = payload.byteLength;
        observer.trigger(Event.FRAG_LOADED, { payload: payload,
          frag: this.frag,
          stats: stats });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        observer.trigger(Event.LOAD_ERROR, { url: this.frag.url, event: event });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadtimeout: {
      value: function loadtimeout() {
        observer.trigger(Event.LOAD_TIMEOUT, { url: this.frag.url });
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return FragmentLoader;
})();

module.exports = FragmentLoader;

},{"../events":9,"../observer":13}],12:[function(require,module,exports){
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
  function PlaylistLoader(config) {
    this.config = config;
    this.manifestLoaded = false;
  }

  _prototypeProperties(PlaylistLoader, null, {
    destroy: {
      value: function destroy() {
        if (this.loader) {
          this.loader.destroy();
          this.loader = null;
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
        this.loader = new this.config.loader();
        this.loader.load(url, "", this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), this.config.manifestLoadingTimeOut, this.config.manifestLoadingMaxRetry, this.config.manifestLoadingRetryDelay);
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
      value: function loadsuccess(event, stats) {
        var string = event.currentTarget.responseText,
            url = event.currentTarget.responseURL,
            id = this.id,
            levels;
        // responseURL not supported on some browsers (it is used to detect URL redirection)
        if (url === undefined) {
          // fallback to initial URL
          url = this.url;
        }
        stats.tload = new Date();
        stats.mtime = new Date(event.currentTarget.getResponseHeader("Last-Modified"));

        if (string.indexOf("#EXTM3U") === 0) {
          if (string.indexOf("#EXTINF:") > 0) {
            // 1 level playlist
            // if first request, fire manifest loaded event, level will be reloaded afterwards
            // (this is to have a uniform logic for 1 level/multilevel playlists)
            if (this.id === null) {
              observer.trigger(Event.MANIFEST_LOADED, { levels: [{ url: url }],
                url: url,
                stats: stats });
            } else {
              observer.trigger(Event.LEVEL_LOADED, { details: this.parseLevelPlaylist(string, url, id),
                levelId: id,
                stats: stats });
            }
          } else {
            levels = this.parseMasterPlaylist(string, url);
            // multi level playlist, parse level info
            if (levels.length) {
              observer.trigger(Event.MANIFEST_LOADED, { levels: levels,
                url: url,
                id: id,
                stats: stats });
            } else {
              observer.trigger(Event.LOAD_ERROR, { url: url, response: "no level found in manifest" });
            }
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
    loadtimeout: {
      value: function loadtimeout() {
        observer.trigger(Event.LOAD_TIMEOUT, { url: this.url });
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

},{}],16:[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/*
 * Xhr based Loader
 *
 */

var logger = require("../utils/logger").logger;
var XhrLoader = (function () {
  function XhrLoader() {}

  _prototypeProperties(XhrLoader, null, {
    destroy: {
      value: function destroy() {
        this.abort();
        this.loader = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    abort: {
      value: function abort() {
        if (this.loader && this.loader.readyState !== 4) {
          this.loader.abort();
        }
        if (this.timeoutHandle) {
          window.clearTimeout(this.timeoutHandle);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay) {
        this.url = url;
        this.responseType = responseType;
        this.onSuccess = onSuccess;
        this.onTimeout = onTimeout;
        this.onError = onError;
        this.trequest = new Date();
        this.timeout = timeout;
        this.maxRetry = maxRetry;
        this.retryDelay = retryDelay;
        this.retry = 0;
        this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this), timeout);
        this.loadInternal();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadInternal: {
      value: function loadInternal() {
        var xhr = this.loader = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open("GET", this.url, true);
        xhr.responseType = this.responseType;
        this.tfirst = null;
        this.loaded = 0;
        xhr.send();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        window.clearTimeout(this.timeoutHandle);
        this.onSuccess(event, { trequest: this.trequest, tfirst: this.tfirst, tload: new Date(), loaded: this.loaded });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        if (this.retry < this.maxRetry) {
          logger.log("" + event.type + " while loading " + this.url + ", retrying in " + this.retryDelay + "...");
          this.destroy();
          window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
          // exponential backoff
          this.retryDelay = Math.min(2 * this.retryDelay, 64000);
          this.retry++;
        } else {
          window.clearTimeout(this.timeoutHandle);
          logger.log("" + event.type + " while loading " + this.url);
          this.onError(event);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadtimeout: {
      value: function loadtimeout(event) {
        logger.log("timeout while loading " + this.url);
        this.onTimeout(event, { trequest: this.trequest, tfirst: this.tfirst, loaded: this.loaded });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress(event) {
        if (this.tfirst === null) {
          this.tfirst = new Date();
        }
        if (event.lengthComputable) {
          this.loaded = event.loaded;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return XhrLoader;
})();

module.exports = XhrLoader;

},{"../utils/logger":15}]},{},[10])(10)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvcGxheWxpc3QtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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RyxJQUFJLFVBQVUsQ0FBQyxDQUNyQixDQUFJO0FBQ0osU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ2hCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3JCLFFBQVEsSUFBSSxFQUFFLEVBQ2YsQUFBQyxRQUFRLElBQUksRUFBRSxHQUFJLEdBQUksRUFDdkIsQUFBQyxRQUFRLElBQUssQ0FBQyxHQUFJLEdBQUksRUFDdkIsUUFBUSxHQUFHLEdBQUk7QUFDZixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLEVBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFB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dEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixBQUFDLGFBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxHQUFJLEdBQUksRUFDdkIsQUFBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBSSxHQUFJLEVBQ3ZCLEFBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUksR0FBSSxFQUN0QixLQUFLLENBQUMsRUFBRSxHQUFHLEdBQUk7QUFDZixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3JCLEtBQUssQ0FBQyxRQUFRLElBQUksRUFBRSxFQUNyQixBQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksRUFBRSxHQUFJLEdBQUksRUFDN0IsQUFBQyxLQUFLLENBQUMsUUFBUSxJQUFLLENBQUMsR0FBSSxHQUFJLEVBQzdCLEtBQUssQ0FBQyxRQUFRLEdBQUcsR0FBSTtBQUNyQixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsRUFB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TUFBSSxLQUFLLENBQUMsSUFBSSx1QkFBa0IsSUFBSSxDQUFDLEdBQUcsQ0FBSSxDQUFDO0FBQ3ZELGNBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDckI7T0FDRjs7Ozs7QUFFRCxlQUFXO2FBQUEscUJBQUMsS0FBSyxFQUFFO0FBQ2pCLGNBQU0sQ0FBQyxHQUFHLDRCQUEwQixJQUFJLENBQUMsR0FBRyxDQUFJLENBQUM7QUFDakQsWUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUMsRUFBQyxRQUFRLEVBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUcsSUFBSSxDQUFDLE1BQU0sRUFBQyxDQUFDLENBQUM7T0FDOUY7Ozs7O0FBRUQsZ0JBQVk7YUFBQSxzQkFBQyxLQUFLLEVBQUU7QUFDbEIsWUFBRyxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtBQUN2QixjQUFJLENBQUMsTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7U0FDMUI7QUFDRCxZQUFHLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRTtBQUN6QixjQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7U0FDNUI7T0FDRjs7Ozs7OztTQTlFSSxTQUFTOzs7aUJBaUZELFNBQVMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICAgICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgYXJncyA9IG5ldyBBcnJheShsZW4gLSAxKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghZW1pdHRlci5fZXZlbnRzIHx8ICFlbWl0dGVyLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gMDtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbihlbWl0dGVyLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IDE7XG4gIGVsc2VcbiAgICByZXQgPSBlbWl0dGVyLl9ldmVudHNbdHlwZV0ubGVuZ3RoO1xuICByZXR1cm4gcmV0O1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGJ1bmRsZUZuID0gYXJndW1lbnRzWzNdO1xudmFyIHNvdXJjZXMgPSBhcmd1bWVudHNbNF07XG52YXIgY2FjaGUgPSBhcmd1bWVudHNbNV07XG5cbnZhciBzdHJpbmdpZnkgPSBKU09OLnN0cmluZ2lmeTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciB3a2V5O1xuICAgIHZhciBjYWNoZUtleXMgPSBPYmplY3Qua2V5cyhjYWNoZSk7XG4gICAgXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgIGlmIChjYWNoZVtrZXldLmV4cG9ydHMgPT09IGZuKSB7XG4gICAgICAgICAgICB3a2V5ID0ga2V5O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgaWYgKCF3a2V5KSB7XG4gICAgICAgIHdrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgdmFyIHdjYWNoZSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgICAgICB3Y2FjaGVba2V5XSA9IGtleTtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2VzW3drZXldID0gW1xuICAgICAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJywnbW9kdWxlJywnZXhwb3J0cyddLCAnKCcgKyBmbiArICcpKHNlbGYpJyksXG4gICAgICAgICAgICB3Y2FjaGVcbiAgICAgICAgXTtcbiAgICB9XG4gICAgdmFyIHNrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICBcbiAgICB2YXIgc2NhY2hlID0ge307IHNjYWNoZVt3a2V5XSA9IHdrZXk7XG4gICAgc291cmNlc1tza2V5XSA9IFtcbiAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJ10sJ3JlcXVpcmUoJyArIHN0cmluZ2lmeSh3a2V5KSArICcpKHNlbGYpJyksXG4gICAgICAgIHNjYWNoZVxuICAgIF07XG4gICAgXG4gICAgdmFyIHNyYyA9ICcoJyArIGJ1bmRsZUZuICsgJykoeydcbiAgICAgICAgKyBPYmplY3Qua2V5cyhzb3VyY2VzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ2lmeShrZXkpICsgJzpbJ1xuICAgICAgICAgICAgICAgICsgc291cmNlc1trZXldWzBdXG4gICAgICAgICAgICAgICAgKyAnLCcgKyBzdHJpbmdpZnkoc291cmNlc1trZXldWzFdKSArICddJ1xuICAgICAgICAgICAgO1xuICAgICAgICB9KS5qb2luKCcsJylcbiAgICAgICAgKyAnfSx7fSxbJyArIHN0cmluZ2lmeShza2V5KSArICddKSdcbiAgICA7XG4gICAgXG4gICAgdmFyIFVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3cubW96VVJMIHx8IHdpbmRvdy5tc1VSTDtcbiAgICBcbiAgICByZXR1cm4gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKFxuICAgICAgICBuZXcgQmxvYihbc3JjXSwgeyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9KVxuICAgICkpO1xufTtcbiIsIi8qXG4gKiBidWZmZXIgY29udHJvbGxlclxuICpcbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEZyYWdtZW50TG9hZGVyICAgICAgIGZyb20gJy4uL2xvYWRlci9mcmFnbWVudC1sb2FkZXInO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4gaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4gaW1wb3J0IERlbXV4ZXIgICAgICAgICAgICAgIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXInO1xuXG4gIGNvbnN0IFNUQVJUSU5HID0gLTE7XG4gIGNvbnN0IElETEUgPSAwO1xuICBjb25zdCBMT0FESU5HID0gIDE7XG4gIGNvbnN0IFdBSVRJTkdfTEVWRUwgPSAyO1xuICBjb25zdCBQQVJTSU5HID0gMztcbiAgY29uc3QgUEFSU0VEID0gNDtcbiAgY29uc3QgQVBQRU5ESU5HID0gNTtcbiAgY29uc3QgQlVGRkVSX0ZMVVNISU5HID0gNjtcblxuIGNsYXNzIEJ1ZmZlckNvbnRyb2xsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGxldmVsQ29udHJvbGxlcixjb25maWcpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IGxldmVsQ29udHJvbGxlcjtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSAwO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIgPSBuZXcgRnJhZ21lbnRMb2FkZXIoY29uZmlnKTtcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25zYmUgID0gdGhpcy5vblNvdXJjZUJ1ZmZlckVycm9yLmJpbmQodGhpcyk7XG4gICAgLy8gaW50ZXJuYWwgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NU0VBdHRhY2hlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25tcCA9IHRoaXMub25NYW5pZmVzdFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnbWVudExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25pcyA9IHRoaXMub25Jbml0U2VnbWVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcGcgPSB0aGlzLm9uRnJhZ21lbnRQYXJzaW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwID0gdGhpcy5vbkZyYWdtZW50UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5NU0VfQVRUQUNIRUQsIHRoaXMub25tc2UpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgfVxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuZGVzdHJveSgpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsdGhpcy5vbnZzZWVrZWQpO1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCA9IHRoaXMub252bWV0YWRhdGEgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgfVxuXG4gIHN0YXJ0KCkge1xuICAgIHRoaXMuc3RhcnRJbnRlcm5hbCgpO1xuICAgIGlmKHRoaXMubGFzdEN1cnJlbnRUaW1lKSB7XG4gICAgICBsb2dnZXIubG9nKGByZXN1bWluZyB2aWRlbyBAICR7dGhpcy5sYXN0Q3VycmVudFRpbWV9YCk7XG4gICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnN0YXRlID0gU1RBUlRJTkc7XG4gICAgfVxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgcmVzdGFydCgpIHtcbiAgICB0aGlzLnN0YXJ0SW50ZXJuYWwoKTtcbiAgICAvLyB0aGlzIHdpbGwgZmx1c2ggZXZlcnl0aGluZyBhbmQgcmVzdGFydCBwbGF5YmFja1xuICAgIC8vdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgc3RhcnRJbnRlcm5hbCgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgRGVtdXhlcih0aGlzLmNvbmZpZyk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgfVxuXG5cbiAgc3RvcCgpIHtcbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgdGhpcy5mbHVzaFJhbmdlID0gW107XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIHRoaXMuZnJhZyA9IG51bGw7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5hYm9ydCgpO1xuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICBpZih0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlU291cmNlQnVmZmVyKHNiKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcblxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5kZW11eGVyKSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgcG9zLGxvYWRMZXZlbCxsb2FkTGV2ZWxEZXRhaWxzLGZyYWdJZHg7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFdBSVRJTkdfTEVWRUw7XG4gICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIElETEU6XG4gICAgICAgIC8vIGhhbmRsZSBlbmQgb2YgaW1tZWRpYXRlIHN3aXRjaGluZyBpZiBuZWVkZWRcbiAgICAgICAgaWYodGhpcy5pbW1lZGlhdGVTd2l0Y2gpIHtcbiAgICAgICAgICB0aGlzLmltbWVkaWF0ZUxldmVsU3dpdGNoRW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgY2FuZGlkYXRlIGZyYWdtZW50IHRvIGJlIGxvYWRlZCwgYmFzZWQgb24gY3VycmVudCBwb3NpdGlvbiBhbmRcbiAgICAgICAgLy8gIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgLy8gIGVuc3VyZSA2MHMgb2YgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBub3QgeWV0IGxvYWRlZCBhbnkgZnJhZ21lbnQsIHN0YXJ0IGxvYWRpbmcgZnJvbSBzdGFydCBwb3NpdGlvblxuICAgICAgICBpZih0aGlzLmxvYWRlZG1ldGFkYXRhKSB7XG4gICAgICAgICAgcG9zID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwb3MgPSB0aGlzLm5leHRMb2FkUG9zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgbG9hZCBsZXZlbFxuICAgICAgICBpZih0aGlzLnN0YXJ0RnJhZ21lbnRMb2FkZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgbG9hZExldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbG9hZExldmVsID0gdGhpcy5sZXZlbENvbnRyb2xsZXIubmV4dExldmVsKCk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJ1ZmZlckluZm8gPSB0aGlzLmJ1ZmZlckluZm8ocG9zKSwgYnVmZmVyTGVuID0gYnVmZmVySW5mby5sZW4sIGJ1ZmZlckVuZCA9IGJ1ZmZlckluZm8uZW5kLCBtYXhCdWZMZW47XG4gICAgICAgIC8vIGNvbXB1dGUgbWF4IEJ1ZmZlciBMZW5ndGggdGhhdCB3ZSBjb3VsZCBnZXQgZnJvbSB0aGlzIGxvYWQgbGV2ZWwsIGJhc2VkIG9uIGxldmVsIGJpdHJhdGUuIGRvbid0IGJ1ZmZlciBtb3JlIHRoYW4gNjAgTUIgYW5kIG1vcmUgdGhhbiAzMHNcbiAgICAgICAgaWYoKHRoaXMubGV2ZWxzW2xvYWRMZXZlbF0pLmhhc093blByb3BlcnR5KCdiaXRyYXRlJykpIHtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1pbig4KnRoaXMuY29uZmlnLm1heEJ1ZmZlclNpemUvdGhpcy5sZXZlbHNbbG9hZExldmVsXS5iaXRyYXRlLHRoaXMuY29uZmlnLm1heEJ1ZmZlckxlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF4QnVmTGVuID0gdGhpcy5jb25maWcubWF4QnVmZmVyTGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIGJ1ZmZlciBsZW5ndGggaXMgbGVzcyB0aGFuIG1heEJ1ZkxlbiB0cnkgdG8gbG9hZCBhIG5ldyBmcmFnbWVudFxuICAgICAgICBpZihidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICBpZihsb2FkTGV2ZWwgIT09IHRoaXMubGV2ZWwpIHtcbiAgICAgICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWwgPSBsb2FkTGV2ZWw7XG4gICAgICAgICAgICAvLyB0ZWxsIGRlbXV4ZXIgdGhhdCB3ZSB3aWxsIHN3aXRjaCBsZXZlbCAodGhpcyB3aWxsIGZvcmNlIGluaXQgc2VnbWVudCB0byBiZSByZWdlbmVyYXRlZClcbiAgICAgICAgICAgIGlmICh0aGlzLmRlbXV4ZXIpIHtcbiAgICAgICAgICAgICAgdGhpcy5kZW11eGVyLnN3aXRjaExldmVsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxvYWRMZXZlbERldGFpbHMgPSB0aGlzLmxldmVsc1tsb2FkTGV2ZWxdLmRldGFpbHM7XG4gICAgICAgICAgLy8gaWYgbGV2ZWwgZGV0YWlscyByZXRyaWV2ZWQgeWV0LCBzd2l0Y2ggc3RhdGUgYW5kIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgICAgIGlmKHR5cGVvZiBsb2FkTGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFdBSVRJTkdfTEVWRUw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZmluZCBmcmFnbWVudCBpbmRleCwgY29udGlndW91cyB3aXRoIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgICB2YXIgZnJhZ21lbnRzID0gbG9hZExldmVsRGV0YWlscy5mcmFnbWVudHMsIGZyYWcsIHNsaWRpbmcgPSBsb2FkTGV2ZWxEZXRhaWxzLnNsaWRpbmcsIHN0YXJ0ID0gZnJhZ21lbnRzWzBdLnN0YXJ0ICsgc2xpZGluZztcbiAgICAgICAgICAvLyBjaGVjayBpZiByZXF1ZXN0ZWQgcG9zaXRpb24gaXMgd2l0aGluIHNlZWthYmxlIGJvdW5kYXJpZXMgOlxuICAgICAgICAgIC8vIGluIGNhc2Ugb2YgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIGVuc3VyZSB0aGF0IHJlcXVlc3RlZCBwb3NpdGlvbiBpcyBub3QgbG9jYXRlZCBiZWZvcmUgcGxheWxpc3Qgc3RhcnRcbiAgICAgICAgICBpZihidWZmZXJFbmQgPCBzdGFydCkge1xuICAgICAgICAgICAgbG9nZ2VyLmxvZyhgcmVxdWVzdGVkIHBvc2l0aW9uOiAke2J1ZmZlckVuZH0gaXMgYmVmb3JlIHN0YXJ0IG9mIHBsYXlsaXN0LCByZXNldCB2aWRlbyBwb3NpdGlvbiB0byBzdGFydDogJHtzdGFydH1gKTtcbiAgICAgICAgICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUgPSBzdGFydCArIDAuMDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy9sb29rIGZvciBmcmFnbWVudHMgbWF0Y2hpbmcgd2l0aCBjdXJyZW50IHBsYXkgcG9zaXRpb25cbiAgICAgICAgICBmb3IgKGZyYWdJZHggPSAwOyBmcmFnSWR4IDwgZnJhZ21lbnRzLmxlbmd0aCA7IGZyYWdJZHgrKykge1xuICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICAgICAgICAgIHN0YXJ0ID0gZnJhZy5zdGFydCtzbGlkaW5nO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKGBsZXZlbC9zbi9zdGFydC9lbmQvYnVmRW5kOiR7bG9hZExldmVsfS8ke2ZyYWcuc259LyR7c3RhcnR9LyR7c3RhcnQrZnJhZy5kdXJhdGlvbn0vJHtidWZmZXJFbmR9YCk7XG4gICAgICAgICAgICAvLyBvZmZzZXQgc2hvdWxkIGJlIHdpdGhpbiBmcmFnbWVudCBib3VuZGFyeVxuICAgICAgICAgICAgaWYoc3RhcnQgPD0gYnVmZmVyRW5kICYmIChzdGFydCArIGZyYWcuZHVyYXRpb24pID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIFNOIG1hdGNoaW5nIHdpdGggcG9zOicgKyAgYnVmZmVyRW5kICsgJzonICsgZnJhZy5zbik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWdJZHggPj0gMCAmJiBmcmFnSWR4IDwgZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYodGhpcy5mcmFnICYmIGZyYWcuc24gPT09IHRoaXMuZnJhZy5zbikge1xuICAgICAgICAgICAgICBpZihmcmFnSWR4ID09PSAoZnJhZ21lbnRzLmxlbmd0aCAtMSkpIHtcbiAgICAgICAgICAgICAgICAvLyB3ZSBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgcGxheWxpc3QgYW5kIHdlIGFscmVhZHkgbG9hZGVkIGxhc3QgZnJhZ21lbnQsIGRvbid0IGRvIGFueXRoaW5nXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4KzFdO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZ2dlci5sb2coYExvYWRpbmcgICAgICAgJHtmcmFnLnNufSBvZiBbJHtmcmFnbWVudHNbMF0uc259ICwke2ZyYWdtZW50c1tmcmFnbWVudHMubGVuZ3RoLTFdLnNufV0sbGV2ZWwgJHtsb2FkTGV2ZWx9YCk7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJyAgICAgIGxvYWRpbmcgZnJhZyAnICsgaSArJyxwb3MvYnVmRW5kOicgKyBwb3MudG9GaXhlZCgzKSArICcvJyArIGJ1ZmZlckVuZC50b0ZpeGVkKDMpKTtcblxuICAgICAgICAgICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICAgICAgICAgIHRoaXMubGV2ZWwgPSBsb2FkTGV2ZWw7XG4gICAgICAgICAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmxvYWQoZnJhZyk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gTE9BRElORztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFdBSVRJTkdfTEVWRUw6XG4gICAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgICAgICAvLyBjaGVjayBpZiBwbGF5bGlzdCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICBpZihsZXZlbCAmJiBsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIExPQURJTkc6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGZyYWdtZW50IHJldHJpZXZhbFxuICAgICAgY2FzZSBQQVJTSU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCBiZWluZyBwYXJzZWRcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFBBUlNFRDpcbiAgICAgIGNhc2UgQVBQRU5ESU5HOlxuICAgICAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICAvLyBpZiBNUDQgc2VnbWVudCBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3Mgbm90aGluZyB0byBkb1xuICAgICAgICAgIGlmKCh0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpby51cGRhdGluZykgfHxcbiAgICAgICAgICAgICAodGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NiIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgTVA0IHNlZ21lbnRzIGxlZnQgdG8gYXBwZW5kXG4gICAgICAgICAgfSBlbHNlIGlmKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgYXBwZW5kaW5nICR7c2VnbWVudC50eXBlfSBTQiwgc2l6ZToke3NlZ21lbnQuZGF0YS5sZW5ndGh9YCk7XG4gICAgICAgICAgICAgIHRoaXMuc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0uYXBwZW5kQnVmZmVyKHNlZ21lbnQuZGF0YSk7XG4gICAgICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBtcDRzZWdtZW50cyB0YWJsZVxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBlcnJvciB3aGlsZSB0cnlpbmcgdG8gYXBwZW5kIGJ1ZmZlcjoke2Vyci5tZXNzYWdlfSx0cnkgYXBwZW5kaW5nIGxhdGVyYCk7XG4gICAgICAgICAgICAgIHRoaXMubXA0c2VnbWVudHMudW5zaGlmdChzZWdtZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBBUFBFTkRJTkc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBCVUZGRVJfRkxVU0hJTkc6XG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgYnVmZmVyIHJhbmdlcyB0byBmbHVzaFxuICAgICAgICB3aGlsZSh0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHJhbmdlID0gdGhpcy5mbHVzaFJhbmdlWzBdO1xuICAgICAgICAgIC8vIGZsdXNoQnVmZmVyIHdpbGwgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MgYW5kIGZsdXNoIEF1ZGlvL1ZpZGVvIEJ1ZmZlclxuICAgICAgICAgIGlmKHRoaXMuZmx1c2hCdWZmZXIocmFuZ2Uuc3RhcnQscmFuZ2UuZW5kKSkge1xuICAgICAgICAgICAgLy8gcmFuZ2UgZmx1c2hlZCwgcmVtb3ZlIGZyb20gZmx1c2ggYXJyYXlcbiAgICAgICAgICAgIHRoaXMuZmx1c2hSYW5nZS5zaGlmdCgpO1xuICAgICAgICAgICAgLy8gcmVzZXQgZmx1c2ggY291bnRlclxuICAgICAgICAgICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBmbHVzaCBpbiBwcm9ncmVzcywgY29tZSBiYWNrIGxhdGVyXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gbW92ZSB0byBJRExFIG9uY2UgZmx1c2ggY29tcGxldGUuIHRoaXMgc2hvdWxkIHRyaWdnZXIgbmV3IGZyYWdtZW50IGxvYWRpbmdcbiAgICAgICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICAgICAgfVxuICAgICAgICAgLyogaWYgbm90IGV2ZXJ5dGhpbmcgZmx1c2hlZCwgc3RheSBpbiBCVUZGRVJfRkxVU0hJTkcgc3RhdGUuIHdlIHdpbGwgY29tZSBiYWNrIGhlcmVcbiAgICAgICAgICAgIGVhY2ggdGltZSBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgY2FsbGJhY2sgd2lsbCBiZSB0cmlnZ2VyZWRcbiAgICAgICAgICAgICovXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG4gICBidWZmZXJJbmZvKHBvcykge1xuICAgIHZhciB2ID0gdGhpcy52aWRlbyxcbiAgICAgICAgYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkLFxuICAgICAgICBidWZmZXJMZW4sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlclN0YXJ0LGJ1ZmZlckVuZCxcbiAgICAgICAgaTtcbiAgICB2YXIgYnVmZmVyZWQyID0gW107XG4gICAgLy8gdGhlcmUgbWlnaHQgYmUgc29tZSBzbWFsbCBob2xlcyBiZXR3ZWVuIGJ1ZmZlciB0aW1lIHJhbmdlXG4gICAgLy8gY29uc2lkZXIgdGhhdCBob2xlcyBzbWFsbGVyIHRoYW4gMzAwIG1zIGFyZSBpcnJlbGV2YW50IGFuZCBidWlsZCBhbm90aGVyXG4gICAgLy8gYnVmZmVyIHRpbWUgcmFuZ2UgcmVwcmVzZW50YXRpb25zIHRoYXQgZGlzY2FyZHMgdGhvc2UgaG9sZXNcbiAgICBmb3IoaSA9IDAgOyBpIDwgYnVmZmVyZWQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmKChidWZmZXJlZDIubGVuZ3RoKSAmJiAoYnVmZmVyZWQuc3RhcnQoaSkgLSBidWZmZXJlZDJbYnVmZmVyZWQyLmxlbmd0aC0xXS5lbmQgKSA8IDAuMykge1xuICAgICAgICBidWZmZXJlZDJbYnVmZmVyZWQyLmxlbmd0aC0xXS5lbmQgPSBidWZmZXJlZC5lbmQoaSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWZmZXJlZDIucHVzaCh7c3RhcnQgOiBidWZmZXJlZC5zdGFydChpKSxlbmQgOiBidWZmZXJlZC5lbmQoaSl9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zIDsgaSA8IGJ1ZmZlcmVkMi5sZW5ndGggOyBpKyspIHtcbiAgICAgIC8vbG9nZ2VyLmxvZygnYnVmIHN0YXJ0L2VuZDonICsgYnVmZmVyZWQuc3RhcnQoaSkgKyAnLycgKyBidWZmZXJlZC5lbmQoaSkpO1xuICAgICAgaWYoKHBvcyswLjMpID49IGJ1ZmZlcmVkMltpXS5zdGFydCAmJiBwb3MgPCBidWZmZXJlZDJbaV0uZW5kKSB7XG4gICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICBidWZmZXJTdGFydCA9IGJ1ZmZlcmVkMltpXS5zdGFydDtcbiAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVyZWQyW2ldLmVuZCArIDAuMztcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge2xlbiA6IGJ1ZmZlckxlbiwgc3RhcnQgOiBidWZmZXJTdGFydCwgZW5kIDogYnVmZmVyRW5kfTtcbiAgfVxuXG5cbiAgZ2V0QnVmZmVyUmFuZ2UocG9zaXRpb24pIHtcbiAgICB2YXIgaSxyYW5nZTtcbiAgICBmb3IgKGkgPSB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aC0xOyBpID49MCA7IGktLSkge1xuICAgICAgcmFuZ2UgPSB0aGlzLmJ1ZmZlclJhbmdlW2ldO1xuICAgICAgaWYocG9zaXRpb24gPj0gcmFuZ2Uuc3RhcnQgJiYgcG9zaXRpb24gPD0gcmFuZ2UuZW5kKSB7XG4gICAgICAgIHJldHVybiByYW5nZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdmFyIHJhbmdlID0gdGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICAgIGlmKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIC8vIGZpcnN0IGdldCBlbmQgcmFuZ2Ugb2YgY3VycmVudCBmcmFnbWVudFxuICAgICAgcmV0dXJuIHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UodGhpcy5nZXRCdWZmZXJSYW5nZSh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGZvbGxvd2luZ0J1ZmZlclJhbmdlKHJhbmdlKSB7XG4gICAgaWYocmFuZ2UpIHtcbiAgICAgIC8vIHRyeSB0byBnZXQgcmFuZ2Ugb2YgbmV4dCBmcmFnbWVudCAoNTAwbXMgYWZ0ZXIgdGhpcyByYW5nZSlcbiAgICAgIHJldHVybiB0aGlzLmdldEJ1ZmZlclJhbmdlKHJhbmdlLmVuZCswLjUpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG5cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICB2YXIgcmFuZ2UgPSB0aGlzLm5leHRCdWZmZXJSYW5nZTtcbiAgICBpZihyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLnZpZGVvLGJ1ZmZlcmVkID0gdi5idWZmZXJlZDtcbiAgICBmb3IodmFyIGkgPSAwIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgaWYocG9zaXRpb24gPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zaXRpb24gPD0gYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBfY2hlY2tGcmFnbWVudENoYW5nZWQoKSB7XG4gICAgdmFyIHJhbmdlQ3VycmVudCwgY3VycmVudFRpbWU7XG4gICAgaWYodGhpcy52aWRlbyAmJiB0aGlzLnZpZGVvLnNlZWtpbmcgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICAgIGlmKHRoaXMuaXNCdWZmZXJlZChjdXJyZW50VGltZSkpIHtcbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYocmFuZ2VDdXJyZW50ICYmIHJhbmdlQ3VycmVudC5mcmFnICE9PSB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICB0aGlzLmZyYWdDdXJyZW50ID0gcmFuZ2VDdXJyZW50LmZyYWc7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQ0hBTkdFRCwgeyBmcmFnIDogdGhpcy5mcmFnQ3VycmVudCB9KTtcbiAgICB9XG4gIH1cblxuLypcbiAgYWJvcnQgYW55IGJ1ZmZlciBhcHBlbmQgaW4gcHJvZ3Jlc3MsIGFuZCBmbHVzaCBhbGwgYnVmZmVyZWQgZGF0YVxuICByZXR1cm4gdHJ1ZSBvbmNlIGV2ZXJ5dGhpbmcgaGFzIGJlZW4gZmx1c2hlZC5cbiAgc291cmNlQnVmZmVyLmFib3J0KCkgYW5kIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBhcmUgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcbiAgdGhlIGlkZWEgaXMgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIGZyb20gdGljaygpIHRpbWVyIGFuZCBjYWxsIGl0IGFnYWluIHVudGlsIGFsbCByZXNvdXJjZXMgaGF2ZSBiZWVuIGNsZWFuZWRcbiAgdGhlIHRpbWVyIGlzIHJlYXJtZWQgdXBvbiBzb3VyY2VCdWZmZXIgdXBkYXRlZW5kKCkgZXZlbnQsIHNvIHRoaXMgc2hvdWxkIGJlIG9wdGltYWxcbiovXG4gIGZsdXNoQnVmZmVyKHN0YXJ0T2Zmc2V0LCBlbmRPZmZzZXQpIHtcbiAgICB2YXIgc2IsaSxidWZTdGFydCxidWZFbmQsIGZsdXNoU3RhcnQsIGZsdXNoRW5kO1xuICAgIC8vbG9nZ2VyLmxvZygnZmx1c2hCdWZmZXIscG9zL3N0YXJ0L2VuZDogJyArIHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyAnLycgKyBzdGFydE9mZnNldCArICcvJyArIGVuZE9mZnNldCk7XG4gICAgLy8gc2FmZWd1YXJkIHRvIGF2b2lkIGluZmluaXRlIGxvb3BpbmdcbiAgICBpZih0aGlzLmZsdXNoQnVmZmVyQ291bnRlcisrIDwgMip0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yKHZhciB0eXBlIGluIHRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXJbdHlwZV07XG4gICAgICAgIGlmKCFzYi51cGRhdGluZykge1xuICAgICAgICAgIGZvcihpID0gMCA7IGkgPCBzYi5idWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgICAgIGJ1ZlN0YXJ0ID0gc2IuYnVmZmVyZWQuc3RhcnQoaSk7XG4gICAgICAgICAgICBidWZFbmQgPSBzYi5idWZmZXJlZC5lbmQoaSk7XG4gICAgICAgICAgICAvLyB3b3JrYXJvdW5kIGZpcmVmb3ggbm90IGFibGUgdG8gcHJvcGVybHkgZmx1c2ggbXVsdGlwbGUgYnVmZmVyZWQgcmFuZ2UuXG4gICAgICAgICAgICBpZihuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSAmJiAgZW5kT2Zmc2V0ID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgICAgICAgICAgZmx1c2hTdGFydCA9IHN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgICBmbHVzaEVuZCA9IGVuZE9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBNYXRoLm1heChidWZTdGFydCxzdGFydE9mZnNldCk7XG4gICAgICAgICAgICAgIGZsdXNoRW5kID0gTWF0aC5taW4oYnVmRW5kLGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZihmbHVzaEVuZCAtIGZsdXNoU3RhcnQgPiAwLjUpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgZmx1c2ggJHt0eXBlfSBbJHtmbHVzaFN0YXJ0fSwke2ZsdXNoRW5kfV0sIG9mIFske2J1ZlN0YXJ0fSwke2J1ZkVuZH1dLCBwb3M6JHt0aGlzLnZpZGVvLmN1cnJlbnRUaW1lfWApO1xuICAgICAgICAgICAgICBzYi5yZW1vdmUoZmx1c2hTdGFydCxmbHVzaEVuZCk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdhYm9ydCAnICsgdHlwZSArICcgYXBwZW5kIGluIHByb2dyZXNzJyk7XG4gICAgICAgICAgLy8gdGhpcyB3aWxsIGFib3J0IGFueSBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3NcbiAgICAgICAgICAvL3NiLmFib3J0KCk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZTtcbiAgICBmb3IgKGkgPSAwIDsgaSA8IHRoaXMuYnVmZmVyUmFuZ2UubGVuZ3RoIDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZih0aGlzLmlzQnVmZmVyZWQoKHJhbmdlLnN0YXJ0ICsgcmFuZ2UuZW5kKS8yKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuXG4gICAgbG9nZ2VyLmxvZygnYnVmZmVyIGZsdXNoZWQnKTtcbiAgICAvLyBldmVyeXRoaW5nIGZsdXNoZWQgIVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgICAvKlxuICAgICAgb24gaW1tZWRpYXRlIGxldmVsIHN3aXRjaCA6XG4gICAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgICAgLSBjYW5jZWwgYW55IHBlbmRpbmcgbG9hZCByZXF1ZXN0XG4gICAgICAgLSBhbmQgdHJpZ2dlciBhIGJ1ZmZlciBmbHVzaFxuICAgICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGlmKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy52aWRlby5wYXVzZWQ7XG4gICAgICB0aGlzLnZpZGVvLnBhdXNlKCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICAvLyBmbHVzaCBldmVyeXRoaW5nXG4gICAgdGhpcy5mbHVzaFJhbmdlLnB1c2goeyBzdGFydCA6IDAsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIC8vIHRyaWdnZXIgYSBzb3VyY2VCdWZmZXIgZmx1c2hcbiAgICB0aGlzLnN0YXRlID0gQlVGRkVSX0ZMVVNISU5HO1xuICAgIC8vIHNwZWVkIHVwIHN3aXRjaGluZywgdHJpZ2dlciB0aW1lciBmdW5jdGlvblxuICAgIHRoaXMudGljaygpO1xuICB9XG5cbi8qXG4gICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAtIG51ZGdlIHZpZGVvIGRlY29kZXIgYnkgc2xpZ2h0bHkgYWRqdXN0aW5nIHZpZGVvIGN1cnJlbnRUaW1lXG4gICAgLSByZXN1bWUgdGhlIHBsYXliYWNrIGlmIG5lZWRlZFxuKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lLT0wLjAwMDE7XG4gICAgaWYoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy52aWRlby5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LGN1cnJlbnRSYW5nZSxuZXh0UmFuZ2U7XG5cbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgIGlmKGN1cnJlbnRSYW5nZSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmZsdXNoUmFuZ2UucHVzaCh7IHN0YXJ0IDogMCwgZW5kIDogY3VycmVudFJhbmdlLnN0YXJ0LTF9KTtcbiAgICB9XG5cbiAgICBpZighdGhpcy52aWRlby5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgZmV0Y2hkZWxheT10aGlzLmxldmVsQ29udHJvbGxlci5uZXh0RmV0Y2hEdXJhdGlvbigpKzE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMudmlkZW8uY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZihuZXh0UmFuZ2UpIHtcbiAgICAgIC8vIHdlIGNhbiBmbHVzaCBidWZmZXIgcmFuZ2UgZm9sbG93aW5nIHRoaXMgb25lIHdpdGhvdXQgc3RhbGxpbmcgcGxheWJhY2tcbiAgICAgIG5leHRSYW5nZSA9IHRoaXMuZm9sbG93aW5nQnVmZmVyUmFuZ2UobmV4dFJhbmdlKTtcbiAgICAgIGlmKG5leHRSYW5nZSkge1xuICAgICAgICAvLyBmbHVzaCBwb3NpdGlvbiBpcyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhpcyBuZXcgYnVmZmVyXG4gICAgICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHsgc3RhcnQgOiBuZXh0UmFuZ2Uuc3RhcnQsIGVuZCA6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpZih0aGlzLmZsdXNoUmFuZ2UubGVuZ3RoKSB7XG4gICAgICAvLyB0cmlnZ2VyIGEgc291cmNlQnVmZmVyIGZsdXNoXG4gICAgICB0aGlzLnN0YXRlID0gQlVGRkVSX0ZMVVNISU5HO1xuICAgICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG4gIH1cblxuICBvbk1TRUF0dGFjaGVkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLnZpZGVvID0gZGF0YS52aWRlbztcbiAgICB0aGlzLm1lZGlhU291cmNlID0gZGF0YS5tZWRpYVNvdXJjZTtcbiAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9uVmlkZW9TZWVraW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9uVmlkZW9TZWVrZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udm1ldGFkYXRhID0gdGhpcy5vblZpZGVvTWV0YWRhdGEuYmluZCh0aGlzKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLHRoaXMub252c2Vla2VkKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJyx0aGlzLm9udm1ldGFkYXRhKTtcbiAgICBpZih0aGlzLmxldmVscykge1xuICAgICAgdGhpcy5zdGFydCgpO1xuICAgIH1cbiAgfVxuICBvblZpZGVvU2Vla2luZygpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSBMT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYodGhpcy5idWZmZXJJbmZvKHRoaXMudmlkZW8uY3VycmVudFRpbWUpLmxlbiA9PT0gMCkge1xuICAgICAgICBsb2dnZXIubG9nKCdzZWVraW5nIG91dHNpZGUgb2YgYnVmZmVyIHdoaWxlIGZyYWdtZW50IGxvYWQgaW4gcHJvZ3Jlc3MsIGNhbmNlbCBmcmFnbWVudCBsb2FkJyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHRoaXMubGFzdEN1cnJlbnRUaW1lID0gdGhpcy52aWRlby5jdXJyZW50VGltZTtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblZpZGVvTWV0YWRhdGEoKSB7XG4gICAgICBpZih0aGlzLnZpZGVvLmN1cnJlbnRUaW1lICE9PSB0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICB9XG4gICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IHRydWU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1hbmlmZXN0UGFyc2VkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLmF1ZGlvY29kZWNzd2l0Y2ggPSBkYXRhLmF1ZGlvY29kZWNzd2l0Y2g7XG4gICAgaWYodGhpcy5hdWRpb2NvZGVjc3dpdGNoKSB7XG4gICAgICBsb2dnZXIubG9nKCdib3RoIEFBQy9IRS1BQUMgYXVkaW8gZm91bmQgaW4gbGV2ZWxzOyBkZWNsYXJpbmcgYXVkaW8gY29kZWMgYXMgSEUtQUFDJyk7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgdGhpcy5zdGFydExldmVsTG9hZGVkID0gZmFsc2U7XG4gICAgdGhpcy5zdGFydEZyYWdtZW50TG9hZGVkID0gZmFsc2U7XG4gICAgaWYodGhpcy52aWRlbykge1xuICAgICAgdGhpcy5zdGFydCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBmcmFnbWVudHMgPSBkYXRhLmRldGFpbHMuZnJhZ21lbnRzLGR1cmF0aW9uID0gZGF0YS5kZXRhaWxzLnRvdGFsZHVyYXRpb247XG4gICAgbG9nZ2VyLmxvZyhgbGV2ZWwgJHtkYXRhLmxldmVsSWR9IGxvYWRlZCBbJHtmcmFnbWVudHNbMF0uc259LCR7ZnJhZ21lbnRzW2ZyYWdtZW50cy5sZW5ndGgtMV0uc259XSxkdXJhdGlvbjoke2R1cmF0aW9ufWApO1xuXG4gICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbZGF0YS5sZXZlbElkXSxzbGlkaW5nID0gMCwgbGV2ZWxDdXJyZW50ID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgLy8gY2hlY2sgaWYgcGxheWxpc3QgaXMgYWxyZWFkeSBsb2FkZWQgKGlmIHllcywgaXQgc2hvdWxkIGJlIGEgbGl2ZSBwbGF5bGlzdClcbiAgICBpZihsZXZlbEN1cnJlbnQgJiYgbGV2ZWxDdXJyZW50LmRldGFpbHMgJiYgbGV2ZWxDdXJyZW50LmRldGFpbHMubGl2ZSkge1xuICAgICAgLy8gIHBsYXlsaXN0IHNsaWRpbmcgaXMgdGhlIHN1bSBvZiA6IGN1cnJlbnQgcGxheWxpc3Qgc2xpZGluZyArIHNsaWRpbmcgb2YgbmV3IHBsYXlsaXN0IGNvbXBhcmVkIHRvIGN1cnJlbnQgb25lXG4gICAgICBzbGlkaW5nID0gbGV2ZWxDdXJyZW50LmRldGFpbHMuc2xpZGluZztcbiAgICAgIC8vIGNoZWNrIHNsaWRpbmcgb2YgdXBkYXRlZCBwbGF5bGlzdCBhZ2FpbnN0IGN1cnJlbnQgb25lIDpcbiAgICAgIC8vIGFuZCBmaW5kIGl0cyBwb3NpdGlvbiBpbiBjdXJyZW50IHBsYXlsaXN0XG4gICAgICAvL2xvZ2dlci5sb2coXCJmcmFnbWVudHNbMF0uc24vdGhpcy5sZXZlbC9sZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbMF0uc246XCIgKyBmcmFnbWVudHNbMF0uc24gKyBcIi9cIiArIHRoaXMubGV2ZWwgKyBcIi9cIiArIGxldmVsQ3VycmVudC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbik7XG4gICAgICB2YXIgU05kaWZmID0gZnJhZ21lbnRzWzBdLnNuIC0gbGV2ZWxDdXJyZW50LmRldGFpbHMuZnJhZ21lbnRzWzBdLnNuO1xuICAgICAgaWYoU05kaWZmID49MCkge1xuICAgICAgICAvLyBwb3NpdGl2ZSBzbGlkaW5nIDogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGFmdGVyIHByZXZpb3VzIG9uZVxuICAgICAgICBzbGlkaW5nICs9IGxldmVsQ3VycmVudC5kZXRhaWxzLmZyYWdtZW50c1tTTmRpZmZdLnN0YXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbmVnYXRpdmUgc2xpZGluZzogbmV3IHBsYXlsaXN0IHNsaWRpbmcgd2luZG93IGlzIGJlZm9yZSBwcmV2aW91cyBvbmVcbiAgICAgICAgc2xpZGluZyAtPSBmcmFnbWVudHNbLVNOZGlmZl0uc3RhcnQ7XG4gICAgICB9XG4gICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0IHNsaWRpbmc6JHtzbGlkaW5nLnRvRml4ZWQoMyl9YCk7XG4gICAgfVxuICAgIC8vIG92ZXJyaWRlIGxldmVsIGluZm9cbiAgICBsZXZlbC5kZXRhaWxzID0gZGF0YS5kZXRhaWxzO1xuICAgIGxldmVsLmRldGFpbHMuc2xpZGluZyA9IHNsaWRpbmc7XG4gICAgdGhpcy5kZW11eGVyLnNldER1cmF0aW9uKGR1cmF0aW9uKTtcbiAgICBpZih0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBzZXQgc3RhcnQgcG9zaXRpb24gdG8gYmUgZnJhZ21lbnQgTi0zXG4gICAgICBpZihkYXRhLmRldGFpbHMubGl2ZSkge1xuICAgICAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSBNYXRoLm1heCgwLGR1cmF0aW9uIC0gMyAqIGRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBvbmx5IHN3aXRjaCBiYXRjayB0byBJRExFIHN0YXRlIGlmIHdlIHdlcmUgd2FpdGluZyBmb3IgbGV2ZWwgdG8gc3RhcnQgZG93bmxvYWRpbmcgYSBuZXcgZnJhZ21lbnRcbiAgICBpZih0aGlzLnN0YXRlID09PSBXQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSBMT0FESU5HKSB7XG4gICAgICBpZih0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPT09IHRydWUpIHtcbiAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSAuLi4gd2UganVzdCBsb2FkZWQgYSBmcmFnbWVudCB0byBkZXRlcm1pbmUgYWRlcXVhdGUgc3RhcnQgYml0cmF0ZSBhbmQgaW5pdGlhbGl6ZSBhdXRvc3dpdGNoIGFsZ29cbiAgICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9IGZhbHNlO1xuICAgICAgICBkYXRhLnN0YXRzLnRwYXJzZWQgPSBkYXRhLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwgeyBzdGF0cyA6IGRhdGEuc3RhdHMsIGZyYWcgOiB0aGlzLmZyYWd9KTtcbiAgICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBQQVJTSU5HO1xuICAgICAgICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgICAgIHRoaXMuc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgICAgICB0aGlzLmRlbXV4ZXIuc2V0RHVyYXRpb24odGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uZGV0YWlscy50b3RhbGR1cmF0aW9uKTtcbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYyx0aGlzLmZyYWcuc3RhcnQpO1xuICAgICAgfVxuICAgICAgdGhpcy5zdGFydEZyYWdtZW50TG9hZGVkID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBvbkluaXRTZWdtZW50KGV2ZW50LGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjb2RlY3MgaGF2ZSBiZWVuIGV4cGxpY2l0ZWx5IGRlZmluZWQgaW4gdGhlIG1hc3RlciBwbGF5bGlzdCBmb3IgdGhpcyBsZXZlbDtcbiAgICAvLyBpZiB5ZXMgdXNlIHRoZXNlIG9uZXMgaW5zdGVhZCBvZiB0aGUgb25lcyBwYXJzZWQgZnJvbSB0aGUgZGVtdXhcbiAgICB2YXIgYXVkaW9Db2RlYyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS52aWRlb0NvZGVjLHNiO1xuICAgIC8vbG9nZ2VyLmxvZygncGxheWxpc3QgbGV2ZWwgQS9WIGNvZGVjczonICsgYXVkaW9Db2RlYyArICcsJyArIHZpZGVvQ29kZWMpO1xuICAgIC8vbG9nZ2VyLmxvZygncGxheWxpc3QgY29kZWNzOicgKyBjb2RlYyk7XG4gICAgLy8gaWYgcGxheWxpc3QgZG9lcyBub3Qgc3BlY2lmeSBjb2RlY3MsIHVzZSBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudFxuICAgIGlmKGF1ZGlvQ29kZWMgPT09IHVuZGVmaW5lZCB8fCBkYXRhLmF1ZGlvY29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgYXVkaW9Db2RlYyA9IGRhdGEuYXVkaW9Db2RlYztcbiAgICB9XG4gICAgaWYodmlkZW9Db2RlYyA9PT0gdW5kZWZpbmVkICB8fCBkYXRhLnZpZGVvY29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICB9XG5cbiAgICAvLyBjb2RlYz1cIm1wNGEuNDAuNSxhdmMxLjQyMDAxNlwiO1xuICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAvL2Rvbid0IGRvIGl0IGZvciBtb25vIHN0cmVhbXMgLi4uXG4gICAgaWYodGhpcy5hdWRpb2NvZGVjc3dpdGNoICYmIGRhdGEuYXVkaW9DaGFubmVsQ291bnQgPT09IDIgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSA9PT0gLTEpIHtcbiAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICB9XG4gICAgaWYoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHt9O1xuICAgICAgbG9nZ2VyLmxvZyhgc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczoke2F1ZGlvQ29kZWN9LCR7dmlkZW9Db2RlY31gKTtcbiAgICAgIC8vIGNyZWF0ZSBzb3VyY2UgQnVmZmVyIGFuZCBsaW5rIHRoZW0gdG8gTWVkaWFTb3VyY2VcbiAgICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgICAgc2IgPSB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyA9IHRoaXMubWVkaWFTb3VyY2UuYWRkU291cmNlQnVmZmVyKGB2aWRlby9tcDQ7Y29kZWNzPSR7YXVkaW9Db2RlY31gKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLnZpZGVvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoYHZpZGVvL21wNDtjb2RlY3M9JHt2aWRlb0NvZGVjfWApO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGF1ZGlvQ29kZWMpIHtcbiAgICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiAnYXVkaW8nLCBkYXRhIDogZGF0YS5hdWRpb01vb3Z9KTtcbiAgICB9XG4gICAgaWYodmlkZW9Db2RlYykge1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6ICd2aWRlbycsIGRhdGEgOiBkYXRhLnZpZGVvTW9vdn0pO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRQYXJzaW5nKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLnRwYXJzZTIgPSBEYXRlLm5vdygpO1xuICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgIGlmKGxldmVsLmRldGFpbHMubGl2ZSkge1xuICAgICAgbGV2ZWwuZGV0YWlscy5zbGlkaW5nID0gZGF0YS5zdGFydFBUUyAtIHRoaXMuZnJhZy5zdGFydDtcbiAgICB9XG4gICAgbG9nZ2VyLmxvZyhgICAgICAgcGFyc2VkIGRhdGEsIHR5cGUvc3RhcnRQVFMvZW5kUFRTL3N0YXJ0RFRTL2VuZERUUy9zbGlkaW5nOiR7ZGF0YS50eXBlfS8ke2RhdGEuc3RhcnRQVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZFBUUy50b0ZpeGVkKDMpfS8ke2RhdGEuc3RhcnREVFMudG9GaXhlZCgzKX0vJHtkYXRhLmVuZERUUy50b0ZpeGVkKDMpfS8ke2xldmVsLmRldGFpbHMuc2xpZGluZy50b0ZpeGVkKDMpfWApO1xuICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiBkYXRhLnR5cGUsIGRhdGEgOiBkYXRhLm1vb2Z9KTtcbiAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogZGF0YS50eXBlLCBkYXRhIDogZGF0YS5tZGF0fSk7XG4gICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlIDogZGF0YS50eXBlLCBzdGFydCA6IGRhdGEuc3RhcnRQVFMsIGVuZCA6IGRhdGEuZW5kUFRTLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2VkKCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IFBBUlNFRDtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IG5ldyBEYXRlKCk7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZih0aGlzLnN0YXRlID09PSBBUFBFTkRJTkcgJiYgdGhpcy5tcDRzZWdtZW50cy5sZW5ndGggPT09IDApICB7XG4gICAgICB0aGlzLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHsgc3RhdHMgOiB0aGlzLnN0YXRzLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICB9XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlckVycm9yKGV2ZW50KSB7XG4gICAgICBsb2dnZXIubG9nKGAgYnVmZmVyIGFwcGVuZCBlcnJvcjoke2V2ZW50fWApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG4iLCIvKlxuICogbGV2ZWwgY29udHJvbGxlclxuICpcbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG4gY2xhc3MgTGV2ZWxDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihwbGF5bGlzdExvYWRlcikge1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBwbGF5bGlzdExvYWRlcjtcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ21lbnRMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgLy90aGlzLnN0YXJ0TGV2ZWwgPSBzdGFydExldmVsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBsZXZlbHMgPSBbXSxiaXRyYXRlU3RhcnQsaSxiaXRyYXRlU2V0PXt9LCBhYWM9ZmFsc2UsIGhlYWFjPWZhbHNlLGNvZGVjcztcbiAgICBpZihkYXRhLmxldmVscy5sZW5ndGggPiAxKSB7XG4gICAgICAvLyByZW1vdmUgZmFpbG92ZXIgbGV2ZWwgZm9yIG5vdyB0byBzaW1wbGlmeSB0aGUgbG9naWNcbiAgICAgIGRhdGEubGV2ZWxzLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICBpZighYml0cmF0ZVNldC5oYXNPd25Qcm9wZXJ0eShsZXZlbC5iaXRyYXRlKSkge1xuICAgICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgICBiaXRyYXRlU2V0W2xldmVsLmJpdHJhdGVdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgICBjb2RlY3MgPSBsZXZlbC5jb2RlY3M7XG4gICAgICAgIGlmKGNvZGVjcykge1xuICAgICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGhlYWFjID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgICAgLy8gc29ydCBsZXZlbCBvbiBiaXRyYXRlXG4gICAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5iaXRyYXRlLWIuYml0cmF0ZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fbGV2ZWxzID0gbGV2ZWxzO1xuXG4gICAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICAgIGZvcihpPTA7IGkgPCBsZXZlbHMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgIGlmKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBsb2FkZWQsJHtsZXZlbHMubGVuZ3RofSBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZToke2JpdHJhdGVTdGFydH1gKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvL3RoaXMuX3N0YXJ0TGV2ZWwgPSAtMTtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELFxuICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5fbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRMZXZlbCA6IHRoaXMuX3N0YXJ0TGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdWRpb2NvZGVjc3dpdGNoIDogKGFhYyAmJiBoZWFhYylcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICAgIHRoaXMuX2ZpcnN0TGV2ZWwgPSAwO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiB0aGlzLl9sZXZlbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydExldmVsIDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvY29kZWNzd2l0Y2ggOiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVscztcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZih0aGlzLl9sZXZlbCAhPT0gbmV3TGV2ZWwpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgICAgaWYobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMuX2xldmVscy5sZW5ndGgpIHtcbiAgICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgICBsb2dnZXIubG9nKGBzd2l0Y2hpbmcgdG8gbGV2ZWwgJHtuZXdMZXZlbH1gKTtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9TV0lUQ0gsIHsgbGV2ZWxJZCA6IG5ld0xldmVsfSk7XG4gICAgICAgIHZhciBsZXZlbCA9IHRoaXMuX2xldmVsc1tuZXdMZXZlbF07XG4gICAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgICAgaWYobGV2ZWwubG9hZGluZyA9PT0gdW5kZWZpbmVkIHx8IChsZXZlbC5kZXRhaWxzICYmIGxldmVsLmRldGFpbHMubGl2ZSA9PT0gdHJ1ZSkpIHtcbiAgICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgb3IgbGl2ZSBwbGF5bGlzdCB3ZSBuZWVkIHRvIChyZSlsb2FkIGl0XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7IGxldmVsSWQgOiBuZXdMZXZlbH0pO1xuICAgICAgICAgIGxvZ2dlci5sb2coYChyZSlsb2FkaW5nIHBsYXlsaXN0IGZvciBsZXZlbCAke25ld0xldmVsfWApO1xuICAgICAgICAgIHRoaXMucGxheWxpc3RMb2FkZXIubG9hZChsZXZlbC51cmwsbmV3TGV2ZWwpO1xuICAgICAgICAgIGxldmVsLmxvYWRpbmcgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfRVJST1IsIHsgbGV2ZWwgOiBuZXdMZXZlbCwgZXZlbnQ6ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICB9XG5cbiAgc2V0IG1hbnVhbExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgICB0aGlzLmxldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICB9XG5cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICBpZih0aGlzLl9zdGFydExldmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3RhcnRMZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX3N0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBzdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbiA9IChzdGF0cy50bG9hZCAtIHN0YXRzLnRyZXF1ZXN0KS8xMDAwO1xuICAgIHRoaXMubGFzdGZldGNobGV2ZWwgPSBkYXRhLmZyYWcubGV2ZWw7XG4gICAgdGhpcy5sYXN0YncgPSBzdGF0cy5sZW5ndGgqOC90aGlzLmxhc3RmZXRjaGR1cmF0aW9uO1xuICAgIC8vY29uc29sZS5sb2coYGxlbjoke3N0YXRzLmxlbmd0aH0sZmV0Y2hEdXJhdGlvbjoke3RoaXMubGFzdGZldGNoZHVyYXRpb259LGJ3OiR7KHRoaXMubGFzdGJ3LzEwMDApLnRvRml4ZWQoMCl9YCk7XG4gIH1cblxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheWxpc3QgaXMgYSBsaXZlIHBsYXlsaXN0XG4gICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUgJiYgIXRoaXMudGltZXIpIHtcbiAgICAgIC8vIGlmIGxpdmUgcGxheWxpc3Qgd2Ugd2lsbCBoYXZlIHRvIHJlbG9hZCBpdCBwZXJpb2RpY2FsbHlcbiAgICAgIC8vIHNldCByZWxvYWQgcGVyaW9kIHRvIHBsYXlsaXN0IHRhcmdldCBkdXJhdGlvblxuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDAwKmRhdGEuZGV0YWlscy50YXJnZXRkdXJhdGlvbik7XG4gICAgfVxuICB9XG5cbiAgdGljaygpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHsgbGV2ZWxJZCA6IHRoaXMuX2xldmVsfSk7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHRoaXMuX2xldmVsc1t0aGlzLl9sZXZlbF0udXJsLHRoaXMuX2xldmVsKTtcbiAgfVxuXG4gIG5leHRMZXZlbCgpIHtcbiAgICBpZih0aGlzLl9tYW51YWxMZXZlbCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICByZXR1cm4gdGhpcy5uZXh0QXV0b0xldmVsKCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dEZldGNoRHVyYXRpb24oKSB7XG4gICAgaWYodGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMubGFzdGZldGNoZHVyYXRpb24qdGhpcy5fbGV2ZWxzW3RoaXMuX2xldmVsXS5iaXRyYXRlL3RoaXMuX2xldmVsc1t0aGlzLmxhc3RmZXRjaGxldmVsXS5iaXRyYXRlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH1cblxuICBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidyxhZGp1c3RlZGJ3LGksbWF4QXV0b0xldmVsO1xuICAgIGlmKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9sZXZlbHMubGVuZ3RoLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IoaSA9MDsgaSA8PSBtYXhBdXRvTGV2ZWwgOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmKGkgPD0gdGhpcy5fbGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCpsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43Kmxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmKGFkanVzdGVkYncgPCB0aGlzLl9sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCxpLTEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaS0xO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi90c2RlbXV4ZXInO1xuIGltcG9ydCBUU0RlbXV4ZXJXb3JrZXIgICAgICBmcm9tICcuL3RzZGVtdXhlcndvcmtlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3Rvcihjb25maWcpIHtcbiAgICBpZihjb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ1RTIGRlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoVFNEZW11eGVyV29ya2VyKTtcbiAgICAgICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICAgICAgdGhpcy53LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2luaXQnfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnZXJyb3Igd2hpbGUgaW5pdGlhbGl6aW5nIFRTRGVtdXhlcldvcmtlciwgZmFsbGJhY2sgb24gcmVndWxhciBUU0RlbXV4ZXInKTtcbiAgICAgICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBzZXREdXJhdGlvbihuZXdEdXJhdGlvbikge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2R1cmF0aW9uJyAsIGRhdGEgOiBuZXdEdXJhdGlvbn0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuc2V0RHVyYXRpb24obmV3RHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQpIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdkZW11eCcgLCBkYXRhIDogZGF0YSwgYXVkaW9Db2RlYyA6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQgOiB0aW1lT2Zmc2V0fSxbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCk7XG4gICAgICB0aGlzLmRlbXV4ZXIuZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnc3dpdGNoTGV2ZWwnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZihldi5kYXRhLmF1ZGlvTW9vdikge1xuICAgICAgICAgIG9iai5hdWRpb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLmF1ZGlvTW9vdik7XG4gICAgICAgICAgb2JqLmF1ZGlvQ29kZWMgPSBldi5kYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgICAgb2JqLmF1ZGlvQ2hhbm5lbENvdW50ID0gZXYuZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgbW9vZiA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubW9vZiksXG4gICAgICAgICAgbWRhdCA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFMgOiBldi5kYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUyA6IGV2LmRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTIDogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFMgOiBldi5kYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlIDogZXYuZGF0YS50eXBlXG4gICAgICAgIH0pO1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0VEOlxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcjtcbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nXG4gKiBzY2hlbWUgdXNlZCBieSBoMjY0LlxuICovXG5cbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3Rvcih3b3JraW5nRGF0YSkge1xuICAgIHRoaXMud29ya2luZ0RhdGEgPSB3b3JraW5nRGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLndvcmtpbmdEYXRhXG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29ya2luZ1dvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy53b3JraW5nRGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUpO1xuXG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cblxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy53b3JraW5nRGF0YS5zdWJhcnJheShwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmtpbmdXb3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcblxuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy53b3JraW5nRGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH1cblxuICAvLyAoY291bnQ6aW50KTp2b2lkXG4gIHNraXBCaXRzKGNvdW50KSB7XG4gICAgdmFyIHNraXBCeXRlczsgLy8gOmludFxuICAgIGlmICh0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29ya2luZ1dvcmQgICAgICAgICAgPDw9IGNvdW50O1xuICAgICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9IGVsc2Uge1xuICAgICAgY291bnQgLT0gdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG5cbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgPj4gMyk7XG4gICAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG5cbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcblxuICAgICAgdGhpcy53b3JraW5nV29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JraW5nV29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG5cbiAgICBpZihzaXplID4zMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG5cbiAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuXG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExlYWRpbmdaZXJvcygpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwIDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JraW5nV29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JraW5nV29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVbnNpZ25lZEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFeHBHb2xvbWIoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVW5zaWduZWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExlYWRpbmdaZXJvcygpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRXhwR29sb21iKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVbnNpZ25lZEJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvKipcbiAgICogQWR2YW5jZSB0aGUgRXhwR29sb21iIGRlY29kZXIgcGFzdCBhIHNjYWxpbmcgbGlzdC4gVGhlIHNjYWxpbmdcbiAgICogbGlzdCBpcyBvcHRpb25hbGx5IHRyYW5zbWl0dGVkIGFzIHBhcnQgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXJcbiAgICogc2V0IGFuZCBpcyBub3QgcmVsZXZhbnQgdG8gdHJhbnNtdXhpbmcuXG4gICAqIEBwYXJhbSBjb3VudCB7bnVtYmVyfSB0aGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhpcyBzY2FsaW5nIGxpc3RcbiAgICogQHNlZSBSZWNvbW1lbmRhdGlvbiBJVFUtVCBILjI2NCwgU2VjdGlvbiA3LjMuMi4xLjEuMVxuICAgKi9cbiAgc2tpcFNjYWxpbmdMaXN0KGNvdW50KSB7XG4gICAgdmFyXG4gICAgICBsYXN0U2NhbGUgPSA4LFxuICAgICAgbmV4dFNjYWxlID0gOCxcbiAgICAgIGosXG4gICAgICBkZWx0YVNjYWxlO1xuXG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEV4cEdvbG9tYigpO1xuICAgICAgICBuZXh0U2NhbGUgPSAobGFzdFNjYWxlICsgZGVsdGFTY2FsZSArIDI1NikgJSAyNTY7XG4gICAgICB9XG5cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNlcXVlbmNlUGFyYW1ldGVyU2V0KCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdGliaWxpdHksbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuXG4gICAgdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVuc2lnbmVkQnl0ZSgpOyAvLyBwcm9maWxlX2lkY1xuICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuXG4gICAgLy8gc29tZSBwcm9maWxlcyBoYXZlIG1vcmUgb3B0aW9uYWwgZGF0YSB3ZSBkb24ndCBuZWVkXG4gICAgaWYgKHByb2ZpbGVJZGMgPT09IDEwMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTIyIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDE0NCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcblxuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG5cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBwcm9maWxlSWRjIDogcHJvZmlsZUlkYyxcbiAgICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5IDogcHJvZmlsZUNvbXBhdGliaWxpdHksXG4gICAgICBsZXZlbElkYyA6IGxldmVsSWRjLFxuICAgICAgd2lkdGg6ICgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtIChmcmFtZUNyb3BUb3BPZmZzZXQgKiAyKSAtIChmcmFtZUNyb3BCb3R0b21PZmZzZXQgKiAyKVxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBBIHN0cmVhbS1iYXNlZCBtcDJ0cyB0byBtcDQgY29udmVydGVyLiBUaGlzIHV0aWxpdHkgaXMgdXNlZCB0b1xuICogZGVsaXZlciBtcDRzIHRvIGEgU291cmNlQnVmZmVyIG9uIHBsYXRmb3JtcyB0aGF0IHN1cHBvcnQgbmF0aXZlXG4gKiBNZWRpYSBTb3VyY2UgRXh0ZW5zaW9ucy5cbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFeHBHb2xvbWIgICAgICAgZnJvbSAnLi9leHAtZ29sb21iJztcbi8vIGltcG9ydCBIZXggICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvaGV4JztcbiBpbXBvcnQgTVA0ICAgICAgICAgICAgIGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuLy8gaW1wb3J0IE1QNEluc3BlY3QgICAgICBmcm9tICcuLi9yZW11eC9tcDQtaW5zcGVjdG9yJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgfVxuXG4gIHNldER1cmF0aW9uKG5ld0R1cmF0aW9uKSB7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBuZXdEdXJhdGlvbjtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSB0aGlzLl9hdmNJZCA9IHRoaXMuX2FhY0lkID0gLTE7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7dHlwZSA6ICd2aWRlbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZSA6ICdhdWRpbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYXZjU2FtcGxlcyA9IFtdO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgPSAwO1xuICAgIHRoaXMuX2FhY1NhbXBsZXMgPSBbXTtcbiAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSxhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLHRpbWVPZmZzZXQpIHtcbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB2YXIgb2Zmc2V0O1xuICAgIGZvcihvZmZzZXQgPSAwOyBvZmZzZXQgPCBkYXRhLmxlbmd0aCA7IG9mZnNldCArPSAxODgpIHtcbiAgICAgIHRoaXMuX3BhcnNlVFNQYWNrZXQoZGF0YSxvZmZzZXQpO1xuICAgIH1cbiAgfVxuICAvLyBmbHVzaCBhbnkgYnVmZmVyZWQgZGF0YVxuICBlbmQoKSB7XG4gICAgaWYodGhpcy5fYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYXZjRGF0YSkpO1xuICAgICAgdGhpcy5fYXZjRGF0YSA9IG51bGw7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBVkNTYW1wbGVzKCk7XG4gICAgfVxuICAgIGlmKHRoaXMuX2FhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2FhY0RhdGEpKTtcbiAgICAgIHRoaXMuX2FhY0RhdGEgPSBudWxsO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyB0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQUFDU2FtcGxlcygpO1xuICAgIH1cbiAgICAvL25vdGlmeSBlbmQgb2YgcGFyc2luZ1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN3aXRjaExldmVsKCk7XG4gICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2luaXREVFMgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSAwO1xuICB9XG5cbiAgX3BhcnNlVFNQYWNrZXQoZGF0YSxzdGFydCkge1xuICAgIHZhciBzdHQscGlkLGF0ZixvZmZzZXQ7XG4gICAgaWYoZGF0YVtzdGFydF0gPT09IDB4NDcpIHtcbiAgICAgIHN0dCA9ICEhKGRhdGFbc3RhcnQrMV0gJiAweDQwKTtcbiAgICAgIC8vIHBpZCBpcyBhIDEzLWJpdCBmaWVsZCBzdGFydGluZyBhdCB0aGUgbGFzdCBiaXQgb2YgVFNbMV1cbiAgICAgIHBpZCA9ICgoZGF0YVtzdGFydCsxXSAmIDB4MWYpIDw8IDgpICsgZGF0YVtzdGFydCsyXTtcbiAgICAgIGF0ZiA9IChkYXRhW3N0YXJ0KzNdICYgMHgzMCkgPj4gNDtcbiAgICAgIC8vIGlmIGFuIGFkYXB0aW9uIGZpZWxkIGlzIHByZXNlbnQsIGl0cyBsZW5ndGggaXMgc3BlY2lmaWVkIGJ5IHRoZSBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLlxuICAgICAgaWYoYXRmID4gMSkge1xuICAgICAgICBvZmZzZXQgPSBzdGFydCs1K2RhdGFbc3RhcnQrNF07XG4gICAgICAgIC8vIHJldHVybiBpZiB0aGVyZSBpcyBvbmx5IGFkYXB0YXRpb24gZmllbGRcbiAgICAgICAgaWYob2Zmc2V0ID09PSAoc3RhcnQrMTg4KSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2Zmc2V0ID0gc3RhcnQrNDtcbiAgICAgIH1cbiAgICAgIGlmKHRoaXMucG10UGFyc2VkKSB7XG4gICAgICAgIGlmKHBpZCA9PT0gdGhpcy5fYXZjSWQpIHtcbiAgICAgICAgICBpZihzdHQpIHtcbiAgICAgICAgICAgIGlmKHRoaXMuX2F2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYXZjRGF0YSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fYXZjRGF0YSA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fYXZjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsc3RhcnQrMTg4KSk7XG4gICAgICAgICAgdGhpcy5fYXZjRGF0YS5zaXplKz1zdGFydCsxODgtb2Zmc2V0O1xuICAgICAgICB9IGVsc2UgaWYocGlkID09PSB0aGlzLl9hYWNJZCkge1xuICAgICAgICAgIGlmKHN0dCkge1xuICAgICAgICAgICAgaWYodGhpcy5fYWFjRGF0YSkge1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyh0aGlzLl9hYWNEYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9hYWNEYXRhID0ge2RhdGE6IFtdLHNpemU6IDB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9hYWNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCxzdGFydCsxODgpKTtcbiAgICAgICAgICB0aGlzLl9hYWNEYXRhLnNpemUrPXN0YXJ0KzE4OC1vZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmKHN0dCkge1xuICAgICAgICAgIG9mZnNldCArPSBkYXRhW29mZnNldF0gKyAxO1xuICAgICAgICB9XG4gICAgICAgIGlmKHBpZCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuX3BhcnNlUEFUKGRhdGEsb2Zmc2V0KTtcbiAgICAgICAgfSBlbHNlIGlmKHBpZCA9PT0gdGhpcy5fcG10SWQpIHtcbiAgICAgICAgICB0aGlzLl9wYXJzZVBNVChkYXRhLG9mZnNldCk7XG4gICAgICAgICAgdGhpcy5wbXRQYXJzZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5sb2coJ3BhcnNpbmcgZXJyb3InKTtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSxvZmZzZXQpIHtcbiAgICAvLyBza2lwIHRoZSBQU0kgaGVhZGVyIGFuZCBwYXJzZSB0aGUgZmlyc3QgUE1UIGVudHJ5XG4gICAgdGhpcy5fcG10SWQgID0gKGRhdGFbb2Zmc2V0KzEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCsxMV07XG4gICAgLy9sb2dnZXIubG9nKCdQTVQgUElEOicgICsgdGhpcy5fcG10SWQpO1xuICB9XG5cbiAgX3BhcnNlUE1UKGRhdGEsb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsdGFibGVFbmQscHJvZ3JhbUluZm9MZW5ndGgscGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQrMV0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQrMl07XG4gICAgdGFibGVFbmQgPSBvZmZzZXQgKyAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG4gICAgLy8gdG8gZGV0ZXJtaW5lIHdoZXJlIHRoZSB0YWJsZSBpcywgd2UgaGF2ZSB0byBmaWd1cmUgb3V0IGhvd1xuICAgIC8vIGxvbmcgdGhlIHByb2dyYW0gaW5mbyBkZXNjcmlwdG9ycyBhcmVcbiAgICBwcm9ncmFtSW5mb0xlbmd0aCA9IChkYXRhW29mZnNldCsxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQrMTFdO1xuXG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgLy9sb2dnZXIubG9nKCdBQUMgUElEOicgICsgcGlkKTtcbiAgICAgICAgICB0aGlzLl9hYWNJZCA9IHBpZDtcbiAgICAgICAgICB0aGlzLl9hYWNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vIElUVS1UIFJlYy4gSC4yNjQgYW5kIElTTy9JRUMgMTQ0OTYtMTAgKGxvd2VyIGJpdC1yYXRlIHZpZGVvKVxuICAgICAgICBjYXNlIDB4MWI6XG4gICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgIHRoaXMuX2F2Y0lkID0gcGlkO1xuICAgICAgICB0aGlzLl9hdmNUcmFjay5pZCA9IHBpZDtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCxmcmFnLHBlc0ZsYWdzLHBlc1ByZWZpeCxwZXNMZW4scGVzSGRyTGVuLHBlc0RhdGEscGVzUHRzLHBlc0R0cyxwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgLy9yZXRyaWV2ZSBQVFMvRFRTIGZyb20gZmlyc3QgZnJhZ21lbnRcbiAgICBmcmFnID0gc3RyZWFtLmRhdGFbMF07XG4gICAgcGVzUHJlZml4ID0gKGZyYWdbMF0gPDwgMTYpICsgKGZyYWdbMV0gPDwgOCkgKyBmcmFnWzJdO1xuICAgIGlmKHBlc1ByZWZpeCA9PT0gMSkge1xuICAgICAgcGVzTGVuID0gKGZyYWdbNF0gPDwgOCkgKyBmcmFnWzVdO1xuICAgICAgcGVzRmxhZ3MgPSBmcmFnWzddO1xuICAgICAgaWYgKHBlc0ZsYWdzICYgMHhDMCkge1xuICAgICAgICAvLyBQRVMgaGVhZGVyIGRlc2NyaWJlZCBoZXJlIDogaHR0cDovL2R2ZC5zb3VyY2Vmb3JnZS5uZXQvZHZkaW5mby9wZXMtaGRyLmh0bWxcbiAgICAgICAgcGVzUHRzID0gKGZyYWdbOV0gJiAweDBFKSA8PCAyOVxuICAgICAgICAgIHwgKGZyYWdbMTBdICYgMHhGRikgPDwgMjJcbiAgICAgICAgICB8IChmcmFnWzExXSAmIDB4RkUpIDw8IDE0XG4gICAgICAgICAgfCAoZnJhZ1sxMl0gJiAweEZGKSA8PCAgN1xuICAgICAgICAgIHwgKGZyYWdbMTNdICYgMHhGRSkgPj4+ICAxO1xuICAgICAgICBpZiAocGVzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgICAgcGVzRHRzID0gKGZyYWdbMTRdICYgMHgwRSApIDw8IDI5XG4gICAgICAgICAgICB8IChmcmFnWzE1XSAmIDB4RkYgKSA8PCAyMlxuICAgICAgICAgICAgfCAoZnJhZ1sxNl0gJiAweEZFICkgPDwgMTRcbiAgICAgICAgICAgIHwgKGZyYWdbMTddICYgMHhGRiApIDw8IDdcbiAgICAgICAgICAgIHwgKGZyYWdbMThdICYgMHhGRSApID4+PiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlc0R0cyA9IHBlc1B0cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVzSGRyTGVuID0gZnJhZ1s4XTtcbiAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IHBlc0hkckxlbis5O1xuICAgICAgLy8gdHJpbSBQRVMgaGVhZGVyXG4gICAgICBzdHJlYW0uZGF0YVswXSA9IHN0cmVhbS5kYXRhWzBdLnN1YmFycmF5KHBheWxvYWRTdGFydE9mZnNldCk7XG4gICAgICBzdHJlYW0uc2l6ZSAtPSBwYXlsb2FkU3RhcnRPZmZzZXQ7XG4gICAgICAvL3JlYXNzZW1ibGUgUEVTIHBhY2tldFxuICAgICAgcGVzRGF0YSA9IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKTtcbiAgICAgIC8vIHJlYXNzZW1ibGUgdGhlIHBhY2tldFxuICAgICAgd2hpbGUgKHN0cmVhbS5kYXRhLmxlbmd0aCkge1xuICAgICAgICBmcmFnID0gc3RyZWFtLmRhdGEuc2hpZnQoKTtcbiAgICAgICAgcGVzRGF0YS5zZXQoZnJhZywgaSk7XG4gICAgICAgIGkgKz0gZnJhZy5ieXRlTGVuZ3RoO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHsgZGF0YSA6IHBlc0RhdGEsIHB0cyA6IHBlc1B0cywgZHRzIDogcGVzRHRzLCBsZW4gOiBwZXNMZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VBVkNQRVMocGVzKSB7XG4gICAgdmFyIHVuaXRzLHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssYXZjU2FtcGxlLGtleSA9IGZhbHNlO1xuICAgIHVuaXRzID0gdGhpcy5fcGFyc2VBVkNOQUx1KHBlcy5kYXRhKTtcbiAgICAvL2ZyZWUgcGVzLmRhdGEgdG8gc2F2ZSB1cCBzb21lIG1lbW9yeVxuICAgIHBlcy5kYXRhID0gbnVsbDtcbiAgICB1bml0cy51bml0cy5mb3JFYWNoKHVuaXQgPT4ge1xuICAgICAgc3dpdGNoKHVuaXQudHlwZSkge1xuICAgICAgICAvL0lEUlxuICAgICAgICBjYXNlIDU6XG4gICAgICAgICAga2V5ID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TUFNcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgIGlmKCF0cmFjay5zcHMpIHtcbiAgICAgICAgICAgIHZhciBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNlcXVlbmNlUGFyYW1ldGVyU2V0KCk7XG4gICAgICAgICAgICB0cmFjay53aWR0aCA9IGNvbmZpZy53aWR0aDtcbiAgICAgICAgICAgIHRyYWNrLmhlaWdodCA9IGNvbmZpZy5oZWlnaHQ7XG4gICAgICAgICAgICB0cmFjay5wcm9maWxlSWRjID0gY29uZmlnLnByb2ZpbGVJZGM7XG4gICAgICAgICAgICB0cmFjay5wcm9maWxlQ29tcGF0aWJpbGl0eSA9IGNvbmZpZy5wcm9maWxlQ29tcGF0aWJpbGl0eTtcbiAgICAgICAgICAgIHRyYWNrLmxldmVsSWRjID0gY29uZmlnLmxldmVsSWRjO1xuICAgICAgICAgICAgdHJhY2suc3BzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgICB0cmFjay5kdXJhdGlvbiA9IDkwMDAwKnRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgdmFyIGNvZGVjYXJyYXkgPSB1bml0LmRhdGEuc3ViYXJyYXkoMSw0KTtcbiAgICAgICAgICAgIHZhciBjb2RlY3N0cmluZyAgPSAnYXZjMS4nO1xuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBoID0gY29kZWNhcnJheVtpXS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAgICAgaWYgKGgubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgICAgICBoID0gJzAnICsgaDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1BQU1xuICAgICAgICBjYXNlIDg6XG4gICAgICAgICAgaWYoIXRyYWNrLnBwcykge1xuICAgICAgICAgICAgdHJhY2sucHBzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vYnVpbGQgc2FtcGxlIGZyb20gUEVTXG4gICAgLy8gQW5uZXggQiB0byBNUDQgY29udmVyc2lvbiB0byBiZSBkb25lXG4gICAgYXZjU2FtcGxlID0geyB1bml0cyA6IHVuaXRzLCBwdHMgOiBwZXMucHRzLCBkdHMgOiBwZXMuZHRzICwga2V5IDoga2V5fTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzLnB1c2goYXZjU2FtcGxlKTtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoICs9IHVuaXRzLmxlbmd0aDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ICs9IHVuaXRzLnVuaXRzLmxlbmd0aDtcbiAgICAvLyBnZW5lcmF0ZSBJbml0IFNlZ21lbnQgaWYgbmVlZGVkXG4gICAgaWYoIXRoaXMuX2luaXRTZWdHZW5lcmF0ZWQpIHtcbiAgICAgIHRoaXMuX2dlbmVyYXRlSW5pdFNlZ21lbnQoKTtcbiAgICB9XG4gIH1cblxuXG4gIF9mbHVzaEFWQ1NhbXBsZXMoKSB7XG4gICAgdmFyIHZpZXcsaT04LGF2Y1NhbXBsZSxtcDRTYW1wbGUsbXA0U2FtcGxlTGVuZ3RoLHVuaXQsdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxcbiAgICAgICAgbGFzdFNhbXBsZURUUyxtZGF0LG1vb2YsZmlyc3RQVFMsZmlyc3REVFM7XG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuXG4gICAgLyogY29uY2F0ZW5hdGUgdGhlIHZpZGVvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtcGRhdCB0eXBlKSAqL1xuICAgIG1kYXQgPSBuZXcgVWludDhBcnJheSh0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoICsgKDQgKiB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1KSs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGF2Y1NhbXBsZSA9IHRoaXMuX2F2Y1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIG1wNFNhbXBsZUxlbmd0aCA9IDA7XG5cbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlKGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgpIHtcbiAgICAgICAgdW5pdCA9IGF2Y1NhbXBsZS51bml0cy51bml0cy5zaGlmdCgpO1xuICAgICAgICB2aWV3LnNldFVpbnQzMihpLCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIGkgKz0gNDtcbiAgICAgICAgbWRhdC5zZXQodW5pdC5kYXRhLCBpKTtcbiAgICAgICAgaSArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoKz00K3VuaXQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgICAgfVxuXG4gICAgICBhdmNTYW1wbGUucHRzIC09IHRoaXMuX2luaXREVFM7XG4gICAgICBhdmNTYW1wbGUuZHRzIC09IHRoaXMuX2luaXREVFM7XG4gICAgICAvL2xvZ2dlci5sb2coJ1ZpZGVvL1BUUy9EVFM6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzKTtcblxuICAgICAgaWYobGFzdFNhbXBsZURUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGF2Y1NhbXBsZS5kdHMgLSBsYXN0U2FtcGxlRFRTO1xuICAgICAgICBpZihtcDRTYW1wbGUuZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdpbnZhbGlkIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMvRFRTOjonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMgKyAnOicgKyBtcDRTYW1wbGUuZHVyYXRpb24pO1xuICAgICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IDA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNoZWNrIGlmIGZyYWdtZW50cyBhcmUgY29udGlndW91cyAoaS5lLiBubyBtaXNzaW5nIGZyYW1lcyBiZXR3ZWVuIGZyYWdtZW50KVxuICAgICAgICBpZih0aGlzLm5leHRBdmNQdHMpIHtcbiAgICAgICAgICB2YXIgZGVsdGEgPSAoYXZjU2FtcGxlLnB0cyAtIHRoaXMubmV4dEF2Y1B0cykvOTAsYWJzZGVsdGE9TWF0aC5hYnMoZGVsdGEpO1xuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnYWJzZGVsdGEvYXZjU2FtcGxlLnB0czonICsgYWJzZGVsdGEgKyAnLycgKyBhdmNTYW1wbGUucHRzKTtcbiAgICAgICAgICAvLyBpZiBkZWx0YSBpcyBsZXNzIHRoYW4gMzAwIG1zLCBuZXh0IGxvYWRlZCBmcmFnbWVudCBpcyBhc3N1bWVkIHRvIGJlIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZVxuICAgICAgICAgIGlmKGFic2RlbHRhIDwgMzAwKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ1ZpZGVvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBdmNQdHMpO1xuICAgICAgICAgICAgaWYoZGVsdGEgPiAxKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzoke2RlbHRhLnRvRml4ZWQoMCl9IG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYEFWQzokeygtZGVsdGEudG9GaXhlZCgwKSl9IG1zIG92ZXJsYXBwaW5nIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBzZXQgUFRTIHRvIG5leHQgUFRTXG4gICAgICAgICAgICBhdmNTYW1wbGUucHRzID0gdGhpcy5uZXh0QXZjUHRzO1xuICAgICAgICAgICAgLy8gb2Zmc2V0IERUUyBhcyB3ZWxsLCBlbnN1cmUgdGhhdCBEVFMgaXMgc21hbGxlciBvciBlcXVhbCB0aGFuIG5ldyBQVFNcbiAgICAgICAgICAgIGF2Y1NhbXBsZS5kdHMgPSBNYXRoLm1heChhdmNTYW1wbGUuZHRzLWRlbHRhLCB0aGlzLmxhc3RBdmNEdHMpO1xuICAgICAgICAgICAvLyBsb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTIGFkanVzdGVkOicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYXZjU2FtcGxlc1xuICAgICAgICBmaXJzdFBUUyA9IGF2Y1NhbXBsZS5wdHM7XG4gICAgICAgIGZpcnN0RFRTID0gYXZjU2FtcGxlLmR0cztcbiAgICAgIH1cblxuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIGNvbXBvc2l0aW9uVGltZU9mZnNldDogYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDBcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYoYXZjU2FtcGxlLmtleSA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyB0aGUgY3VycmVudCBzYW1wbGUgaXMgYSBrZXkgZnJhbWVcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbXA0U2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDE7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUgPSAxO1xuICAgICAgfVxuICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0U2FtcGxlRFRTID0gYXZjU2FtcGxlLmR0cztcbiAgICB9XG4gICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gdHJhY2suc2FtcGxlc1t0cmFjay5zYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB0aGlzLmxhc3RBdmNEdHMgPSBhdmNTYW1wbGUuZHRzO1xuICAgIC8vIG5leHQgQVZDIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QXZjUHRzID0gYXZjU2FtcGxlLnB0cyArIG1wNFNhbXBsZS5kdXJhdGlvbjtcbiAgICAvL2xvZ2dlci5sb2coJ1ZpZGVvL2xhc3RBdmNEdHMvbmV4dEF2Y1B0czonICsgdGhpcy5sYXN0QXZjRHRzICsgJy8nICsgdGhpcy5uZXh0QXZjUHRzKTtcblxuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgPSAwO1xuXG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMsdHJhY2spO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUyA6IGZpcnN0UFRTLzkwMDAwLFxuICAgICAgZW5kUFRTIDogdGhpcy5uZXh0QXZjUHRzLzkwMDAwLFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy85MDAwMCxcbiAgICAgIGVuZERUUyA6IChhdmNTYW1wbGUuZHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uKS85MDAwMCxcbiAgICAgIHR5cGUgOiAndmlkZW8nXG4gICAgfSk7XG4gIH1cblxuICBfcGFyc2VBVkNOQUx1KGFycmF5KSB7XG4gICAgdmFyIGkgPSAwLGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsdmFsdWUsb3ZlcmZsb3csc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCxsYXN0VW5pdFR5cGUsbGVuZ3RoID0gMDtcbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoYXJyYXkpKTtcblxuICAgIHdoaWxlKGk8IGxlbikge1xuICAgICAgdmFsdWUgPSBhcnJheVtpKytdO1xuICAgICAgLy8gZmluZGluZyAzIG9yIDQtYnl0ZSBzdGFydCBjb2RlcyAoMDAgMDAgMDEgT1IgMDAgMDAgMDAgMDEpXG4gICAgICBzd2l0Y2goc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmKHZhbHVlID09PSAwKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYodmFsdWUgPT09IDEpIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgICAgICAgICAgdW5pdCA9IHsgZGF0YSA6IGFycmF5LnN1YmFycmF5KGxhc3RVbml0U3RhcnQsaS1zdGF0ZS0xKSwgdHlwZSA6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIGxlbmd0aCs9aS1zdGF0ZS0xLWxhc3RVbml0U3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpcnN0IE5BTFUgZm91bmQgd2l0aCBvdmVyZmxvdzonICsgb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgaWYodGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxhc3RhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzW3RoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdFVuaXQgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzW2xhc3RhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoLTFdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkobGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoK292ZXJmbG93KTtcbiAgICAgICAgICAgICAgICAgICAgdG1wLnNldChsYXN0VW5pdC5kYXRhLDApO1xuICAgICAgICAgICAgICAgICAgICB0bXAuc2V0KGFycmF5LnN1YmFycmF5KDAsb3ZlcmZsb3cpLGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RVbml0LmRhdGEgPSB0bXA7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoKz1vdmVyZmxvdztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXZjU2FtcGxlc0xlbmd0aCs9b3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxhc3RVbml0U3RhcnQgPSBpO1xuICAgICAgICAgICAgbGFzdFVuaXRUeXBlID0gdW5pdFR5cGU7XG4gICAgICAgICAgICBpZih1bml0VHlwZSA9PT0gMSB8fCB1bml0VHlwZSA9PT0gNSkge1xuICAgICAgICAgICAgICAvLyBPUFRJICEhISBpZiBJRFIvTkRSIHVuaXQsIGNvbnNpZGVyIGl0IGlzIGxhc3QgTkFMdVxuICAgICAgICAgICAgICBpID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZihsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICB1bml0ID0geyBkYXRhIDogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCxsZW4pLCB0eXBlIDogbGFzdFVuaXRUeXBlfTtcbiAgICAgIGxlbmd0aCs9bGVuLWxhc3RVbml0U3RhcnQ7XG4gICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4geyB1bml0cyA6IHVuaXRzICwgbGVuZ3RoIDogbGVuZ3RofTtcbiAgfVxuXG4gIF9wYXJzZUFBQ1BFUyhwZXMpIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxhYWNTYW1wbGUsZGF0YSA9IHBlcy5kYXRhLGNvbmZpZyxhZHRzRnJhbWVTaXplLGFkdHNTdGFydE9mZnNldCxhZHRzSGVhZGVyTGVuLHN0YW1wLGk7XG4gICAgaWYodGhpcy5hYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCtkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldCh0aGlzLmFhY092ZXJGbG93LDApO1xuICAgICAgdG1wLnNldChkYXRhLHRoaXMuYWFjT3ZlckZsb3cuYnl0ZUxlbmd0aCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ1BFUzonICsgSGV4LmhleER1bXAoZGF0YSkpO1xuICAgIGlmKGRhdGFbMF0gPT09IDB4ZmYpIHtcbiAgICAgIGlmKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgICAgY29uZmlnID0gdGhpcy5fQURUU3RvQXVkaW9Db25maWcocGVzLmRhdGEsdGhpcy5hdWRpb0NvZGVjKTtcbiAgICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICAgIHRyYWNrLmNoYW5uZWxDb3VudCA9IGNvbmZpZy5jaGFubmVsQ291bnQ7XG4gICAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgICB0cmFjay5kdXJhdGlvbiA9IDkwMDAwKnRoaXMuX2R1cmF0aW9uO1xuICAgICAgICBjb25zb2xlLmxvZyhgcGFyc2VkICAgY29kZWM6JHt0cmFjay5jb2RlY30scmF0ZToke2NvbmZpZy5zYW1wbGVyYXRlfSxuYiBjaGFubmVsOiR7Y29uZmlnLmNoYW5uZWxDb3VudH1gKTtcbiAgICAgIH1cbiAgICAgIGFkdHNTdGFydE9mZnNldCA9IGkgPSAwO1xuICAgICAgd2hpbGUoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCszXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgICAgLy8gYnl0ZSA0XG4gICAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzRdIDw8IDMpO1xuICAgICAgICAvLyBieXRlIDVcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgICBhZHRzSGVhZGVyTGVuID0gKCEhKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgICAgc3RhbXAgPSBwZXMucHRzICsgaSoxMDI0KjkwMDAwL3RyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ0FBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC9wdHM6JyArIChhZHRzU3RhcnRPZmZzZXQrNykgKyAnLycgKyBhZHRzRnJhbWVTaXplICsgJy8nICsgc3RhbXAudG9GaXhlZCgwKSk7XG4gICAgICAgIGlmKGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUgPD0gZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgICBhYWNTYW1wbGUgPSB7IHVuaXQgOiBkYXRhLnN1YmFycmF5KGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuLGFkdHNTdGFydE9mZnNldCthZHRzSGVhZGVyTGVuK2FkdHNGcmFtZVNpemUpICwgcHRzIDogc3RhbXAsIGR0cyA6IHN0YW1wfTtcbiAgICAgICAgICB0aGlzLl9hYWNTYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoICs9IGFkdHNGcmFtZVNpemU7XG4gICAgICAgICAgYWR0c1N0YXJ0T2Zmc2V0Kz1hZHRzRnJhbWVTaXplK2FkdHNIZWFkZXJMZW47XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0VSUk9SLCdTdHJlYW0gZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgICBpZihhZHRzU3RhcnRPZmZzZXQgPCBkYXRhLmxlbmd0aCkge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0LGRhdGEubGVuZ3RoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hYWNPdmVyRmxvdyA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgX2ZsdXNoQUFDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYWFjU2FtcGxlLG1wNFNhbXBsZSx1bml0LHRyYWNrID0gdGhpcy5fYWFjVHJhY2ssXG4gICAgICAgIGxhc3RTYW1wbGVEVFMsbWRhdCxtb29mLGZpcnN0UFRTLGZpcnN0RFRTO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYWFjU2FtcGxlc0xlbmd0aCs4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KG1kYXQuYnVmZmVyKTtcbiAgICB2aWV3LnNldFVpbnQzMigwLG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsNCk7XG4gICAgd2hpbGUodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIGFhY1NhbXBsZSA9IHRoaXMuX2FhY1NhbXBsZXMuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIG1kYXQuc2V0KHVuaXQsIGkpO1xuICAgICAgaSArPSB1bml0LmJ5dGVMZW5ndGg7XG5cbiAgICAgIGFhY1NhbXBsZS5wdHMgLT0gdGhpcy5faW5pdERUUztcbiAgICAgIGFhY1NhbXBsZS5kdHMgLT0gdGhpcy5faW5pdERUUztcblxuICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFM6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSk7XG4gICAgICBpZihsYXN0U2FtcGxlRFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gd2UgdXNlIERUUyB0byBjb21wdXRlIHNhbXBsZSBkdXJhdGlvbiwgYnV0IHdlIHVzZSBQVFMgdG8gY29tcHV0ZSBpbml0UFRTIHdoaWNoIGlzIHVzZWQgdG8gc3luYyBhdWRpbyBhbmQgdmlkZW9cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gYWFjU2FtcGxlLmR0cyAtIGxhc3RTYW1wbGVEVFM7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEFhY1B0cyAmJiB0aGlzLm5leHRBYWNQdHMgIT09IGFhY1NhbXBsZS5wdHMpIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAgIHZhciBkZWx0YSA9IChhYWNTYW1wbGUucHRzIC0gdGhpcy5uZXh0QWFjUHRzKS85MDtcbiAgICAgICAgICAvLyBpZiBkZWx0YSBpcyBsZXNzIHRoYW4gMzAwIG1zLCBuZXh0IGxvYWRlZCBmcmFnbWVudCBpcyBhc3N1bWVkIHRvIGJlIGNvbnRpZ3VvdXMgd2l0aCBsYXN0IG9uZVxuICAgICAgICAgIGlmKE1hdGguYWJzKGRlbHRhKSA+IDEgJiYgTWF0aC5hYnMoZGVsdGEpIDwgMzAwKSB7XG4gICAgICAgICAgICBpZihkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnQUFDOicgKyBkZWx0YS50b0ZpeGVkKDApICsgJyBtcyBob2xlIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkLGZpbGxpbmcgaXQnKTtcbiAgICAgICAgICAgICAgLy8gc2V0IFBUUyB0byBuZXh0IFBUUywgYW5kIGVuc3VyZSBQVFMgaXMgZ3JlYXRlciBvciBlcXVhbCB0aGFuIGxhc3QgRFRTXG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5wdHMgPSBNYXRoLm1heCh0aGlzLm5leHRBYWNQdHMsIHRoaXMubGFzdEFhY0R0cyk7XG4gICAgICAgICAgICAgIGFhY1NhbXBsZS5kdHMgPSBhYWNTYW1wbGUucHRzO1xuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGFhY1NhbXBsZS5wdHMgKyAnLycgKyBhYWNTYW1wbGUuZHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FBQzonICsgKC1kZWx0YS50b0ZpeGVkKDApKSArICcgbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzXG4gICAgICAgIGZpcnN0UFRTID0gYWFjU2FtcGxlLnB0cztcbiAgICAgICAgZmlyc3REVFMgPSBhYWNTYW1wbGUuZHRzO1xuICAgICAgfVxuXG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IHVuaXQuYnl0ZUxlbmd0aCxcbiAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiAwLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwLFxuICAgICAgICAgIGRlcGVuZHNPbiA6IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB0cmFjay5zYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3RTYW1wbGVEVFMgPSBhYWNTYW1wbGUuZHRzO1xuICAgIH1cbiAgICAvL3NldCBsYXN0IHNhbXBsZSBkdXJhdGlvbiBhcyBiZWluZyBpZGVudGljYWwgdG8gcHJldmlvdXMgc2FtcGxlXG4gICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gdHJhY2suc2FtcGxlc1t0cmFjay5zYW1wbGVzLmxlbmd0aC0yXS5kdXJhdGlvbjtcbiAgICB0aGlzLmxhc3RBYWNEdHMgPSBhYWNTYW1wbGUuZHRzO1xuICAgIC8vIG5leHQgYWFjIHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGR1cmF0aW9uXG4gICAgdGhpcy5uZXh0QWFjUHRzID0gYWFjU2FtcGxlLnB0cyArIG1wNFNhbXBsZS5kdXJhdGlvbjtcbiAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcblxuICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggPSAwO1xuXG4gICAgbW9vZiA9IE1QNC5tb29mKHRyYWNrLnNlcXVlbmNlTnVtYmVyKyssZmlyc3REVFMsdHJhY2spO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEse1xuICAgICAgbW9vZjogbW9vZixcbiAgICAgIG1kYXQ6IG1kYXQsXG4gICAgICBzdGFydFBUUyA6IGZpcnN0UFRTLzkwMDAwLFxuICAgICAgZW5kUFRTIDogdGhpcy5uZXh0QWFjUHRzLzkwMDAwLFxuICAgICAgc3RhcnREVFMgOiBmaXJzdERUUy85MDAwMCxcbiAgICAgIGVuZERUUyA6IChhYWNTYW1wbGUuZHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uKS85MDAwMCxcbiAgICAgIHR5cGUgOiAnYXVkaW8nXG4gICAgfSk7XG4gIH1cblxuICBfQURUU3RvQXVkaW9Db25maWcoZGF0YSxhdWRpb0NvZGVjKSB7XG4gICAgdmFyIGFkdHNPYmplY3RUeXBlLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBjb25maWcsXG4gICAgICAgIHVzZXJBZ2VudCA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwXG4gICAgICAgICAgXTtcblxuICAgIC8vIGJ5dGUgMlxuICAgIGFkdHNPYmplY3RUeXBlID0gKChkYXRhWzJdICYgMHhDMCkgPj4+IDYpICsgMTtcbiAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVsyXSAmIDB4MDEpIDw8IDIpO1xuICAgIC8vIGJ5dGUgM1xuICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhWzNdICYgMHhDMCkgPj4+IDYpO1xuXG4gICAgY29uc29sZS5sb2coYG1hbmlmZXN0IGNvZGVjOiR7YXVkaW9Db2RlY30sQURUUyBkYXRhOnR5cGU6JHthZHRzT2JqZWN0VHlwZX0sc2FtcGxlaW5nSW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9WyR7YWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF19a0h6XSxjaGFubmVsQ29uZmlnOiR7YWR0c0NoYW5lbENvbmZpZ31gKTtcblxuXG4gICAgLy8gZmlyZWZveDogZnJlcSBsZXNzIHRoYW4gMjRrSHogPSBBQUMgU0JSIChIRS1BQUMpXG4gICAgaWYodXNlckFnZW50LmluZGV4T2YoJ2ZpcmVmb3gnKSAhPT0gLTEpIHtcbiAgICAgIGlmKGFkdHNTYW1wbGVpbmdJbmRleCA+PTYpIHtcbiAgICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAgIC8vIEhFLUFBQyB1c2VzIFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbikgLCBoaWdoIGZyZXF1ZW5jaWVzIGFyZSBjb25zdHJ1Y3RlZCBmcm9tIGxvdyBmcmVxdWVuY2llc1xuICAgICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgICAvLyBtdWx0aXBseSBmcmVxdWVuY3kgYnkgMiAoc2VlIHRhYmxlIGJlbG93LCBlcXVpdmFsZW50IHRvIHN1YnN0cmFjdCAzKVxuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXgtMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgICAvLyBBbmRyb2lkIDogYWx3YXlzIHVzZSBBQUNcbiAgICB9IGVsc2UgaWYodXNlckFnZW50LmluZGV4T2YoJ2FuZHJvaWQnKSAhPT0gLTEpIHtcbiAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogIGZvciBvdGhlciBicm93c2Vyc1xuICAgICAgICAgIGFsd2F5cyBmb3JjZSBhdWRpbyB0eXBlIHRvIGJlIEhFLUFBQyBTQlIsIGFzIHNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoIHByb3Blcmx5IChsaWtlIENocm9tZSAuLi4pXG4gICAgICAqL1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSg0KTtcbiAgICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgSEUtQUFDKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBBTkQgZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeilcbiAgICAgIGlmKChhdWRpb0NvZGVjICYmIGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHx8ICghYXVkaW9Db2RlYyAmJiBhZHRzU2FtcGxlaW5nSW5kZXggPj02KSkgIHtcbiAgICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAgIC8vIHRoZXJlIGlzIGEgZmFjdG9yIDIgYmV0d2VlbiBmcmFtZSBzYW1wbGUgcmF0ZSBhbmQgb3V0cHV0IHNhbXBsZSByYXRlXG4gICAgICAgIC8vIG11bHRpcGx5IGZyZXF1ZW5jeSBieSAyIChzZWUgdGFibGUgYmVsb3csIGVxdWl2YWxlbnQgdG8gc3Vic3RyYWN0IDMpXG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgfVxuICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICBJU08gMTQ0OTYtMyAoQUFDKS5wZGYgLSBUYWJsZSAxLjEzIOKAlCBTeW50YXggb2YgQXVkaW9TcGVjaWZpY0NvbmZpZygpXG4gICAgQXVkaW8gUHJvZmlsZSAvIEF1ZGlvIE9iamVjdCBUeXBlXG4gICAgMDogTnVsbFxuICAgIDE6IEFBQyBNYWluXG4gICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAzOiBBQUMgU1NSIChTY2FsYWJsZSBTYW1wbGUgUmF0ZSlcbiAgICA0OiBBQUMgTFRQIChMb25nIFRlcm0gUHJlZGljdGlvbilcbiAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgNjogQUFDIFNjYWxhYmxlXG4gICBzYW1wbGluZyBmcmVxXG4gICAgMDogOTYwMDAgSHpcbiAgICAxOiA4ODIwMCBIelxuICAgIDI6IDY0MDAwIEh6XG4gICAgMzogNDgwMDAgSHpcbiAgICA0OiA0NDEwMCBIelxuICAgIDU6IDMyMDAwIEh6XG4gICAgNjogMjQwMDAgSHpcbiAgICA3OiAyMjA1MCBIelxuICAgIDg6IDE2MDAwIEh6XG4gICAgOTogMTIwMDAgSHpcbiAgICAxMDogMTEwMjUgSHpcbiAgICAxMTogODAwMCBIelxuICAgIDEyOiA3MzUwIEh6XG4gICAgMTM6IFJlc2VydmVkXG4gICAgMTQ6IFJlc2VydmVkXG4gICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICBUaGVzZSBhcmUgdGhlIGNoYW5uZWwgY29uZmlndXJhdGlvbnM6XG4gICAgMDogRGVmaW5lZCBpbiBBT1QgU3BlY2lmYyBDb25maWdcbiAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgIDI6IDIgY2hhbm5lbHM6IGZyb250LWxlZnQsIGZyb250LXJpZ2h0XG4gICovXG4gICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICBjb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuICAgIC8vIHNhbXBsaW5nRnJlcXVlbmN5SW5kZXhcbiAgICBjb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgY29uZmlnWzFdIHw9IChhZHRzU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcbiAgICBpZihhZHRzT2JqZWN0VHlwZSA9PT0gNSkge1xuICAgICAgLy8gYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4XG4gICAgICBjb25maWdbMV0gfD0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICBjb25maWdbMl0gPSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAgIC8vIGFkdHNPYmplY3RUeXBlIChmb3JjZSB0byAyLCBjaHJvbWUgaXMgY2hlY2tpbmcgdGhhdCBvYmplY3QgdHlwZSBpcyBsZXNzIHRoYW4gNSA/Pz9cbiAgICAgIC8vICAgIGh0dHBzOi8vY2hyb21pdW0uZ29vZ2xlc291cmNlLmNvbS9jaHJvbWl1bS9zcmMuZ2l0LysvbWFzdGVyL21lZGlhL2Zvcm1hdHMvbXA0L2FhYy5jY1xuICAgICAgY29uZmlnWzJdIHw9IDIgPDwgMjtcbiAgICAgIGNvbmZpZ1szXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiB7IGNvbmZpZyA6IGNvbmZpZywgc2FtcGxlcmF0ZSA6IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdLCBjaGFubmVsQ291bnQgOiBhZHRzQ2hhbmVsQ29uZmlnLCBjb2RlYyA6ICgnbXA0YS40MC4nICsgYWR0c09iamVjdFR5cGUpfTtcbiAgfVxuXG4gIF9nZW5lcmF0ZUluaXRTZWdtZW50KCkge1xuICAgIGlmKHRoaXMuX2F2Y0lkID09PSAtMSkge1xuICAgICAgLy9hdWRpbyBvbmx5XG4gICAgICBpZih0aGlzLl9hYWNUcmFjay5jb25maWcpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmKHRoaXMuX2luaXRQVFMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9hYWNTYW1wbGVzWzBdLnB0cyAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0uZHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH0gZWxzZVxuICAgIGlmKHRoaXMuX2FhY0lkID09PSAtMSkge1xuICAgICAgLy92aWRlbyBvbmx5XG4gICAgICBpZih0aGlzLl9hdmNUcmFjay5zcHMgJiYgdGhpcy5fYXZjVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICAgIHRoaXMuX2luaXREVFMgPSB0aGlzLl9hdmNTYW1wbGVzWzBdLmR0cyAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvL2F1ZGlvIGFuZCB2aWRlb1xuICAgICAgaWYodGhpcy5fYWFjVHJhY2suY29uZmlnICYmIHRoaXMuX2F2Y1RyYWNrLnNwcyAmJiB0aGlzLl9hdmNUcmFjay5wcHMpIHtcbiAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCx7XG4gICAgICAgICAgYXVkaW9Nb292OiBNUDQuaW5pdFNlZ21lbnQoW3RoaXMuX2FhY1RyYWNrXSksXG4gICAgICAgICAgYXVkaW9Db2RlYyA6IHRoaXMuX2FhY1RyYWNrLmNvZGVjLFxuICAgICAgICAgIGF1ZGlvQ2hhbm5lbENvdW50IDogdGhpcy5fYWFjVHJhY2suY2hhbm5lbENvdW50LFxuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IE1hdGgubWluKHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzLHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzKSAtIDkwMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5kdHMsdGhpcy5fYWFjU2FtcGxlc1swXS5kdHMpIC0gOTAwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi4vZGVtdXgvdHNkZW11eGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuXG5jbGFzcyBUU0RlbXV4ZXJXb3JrZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsZnVuY3Rpb24gKGV2KXtcbiAgICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBldi5kYXRhLmNtZCk7XG4gICAgICBzd2l0Y2goZXYuZGF0YS5jbWQpIHtcbiAgICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkdXJhdGlvbic6XG4gICAgICAgICAgc2VsZi5kZW11eGVyLnNldER1cmF0aW9uKGV2LmRhdGEuZGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3N3aXRjaExldmVsJzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnZGVtdXgnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGV2LmRhdGEuZGF0YSksIGV2LmRhdGEuYXVkaW9Db2RlYyxldi5kYXRhLnZpZGVvQ29kZWMsIGV2LmRhdGEudGltZU9mZnNldCk7XG4gICAgICAgICAgc2VsZi5kZW11eGVyLmVuZCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gbGlzdGVuIHRvIGV2ZW50cyB0cmlnZ2VyZWQgYnkgVFMgRGVtdXhlclxuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LGRhdGEpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2IH07XG4gICAgICB2YXIgb2JqVHJhbnNmZXJhYmxlID0gW107XG4gICAgICBpZihkYXRhLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NvZGVjID0gZGF0YS5hdWRpb0NvZGVjO1xuICAgICAgICBvYmpEYXRhLmF1ZGlvTW9vdiA9IGRhdGEuYXVkaW9Nb292LmJ1ZmZlcjtcbiAgICAgICAgb2JqRGF0YS5hdWRpb0NoYW5uZWxDb3VudCA9IGRhdGEuYXVkaW9DaGFubmVsQ291bnQ7XG4gICAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEuYXVkaW9Nb292KTtcbiAgICAgIH1cbiAgICAgIGlmKGRhdGEudmlkZW9Db2RlYykge1xuICAgICAgICBvYmpEYXRhLnZpZGVvQ29kZWMgPSBkYXRhLnZpZGVvQ29kZWM7XG4gICAgICAgIG9iakRhdGEudmlkZW9Nb292ID0gZGF0YS52aWRlb01vb3YuYnVmZmVyO1xuICAgICAgICBvYmpEYXRhLnZpZGVvV2lkdGggPSBkYXRhLnZpZGVvV2lkdGg7XG4gICAgICAgIG9iakRhdGEudmlkZW9IZWlnaHQgPSBkYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICBvYmpUcmFuc2ZlcmFibGUucHVzaChvYmpEYXRhLnZpZGVvTW9vdik7XG4gICAgICB9XG4gICAgICAvLyBwYXNzIG1vb3YgYXMgdHJhbnNmZXJhYmxlIG9iamVjdCAobm8gY29weSlcbiAgICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSxvYmpUcmFuc2ZlcmFibGUpO1xuICAgIH0pO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldixkYXRhKSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiAsIHR5cGUgOiBkYXRhLnR5cGUsIHN0YXJ0UFRTIDogZGF0YS5zdGFydFBUUywgZW5kUFRTIDogZGF0YS5lbmRQVFMgLCBzdGFydERUUyA6IGRhdGEuc3RhcnREVFMsIGVuZERUUyA6IGRhdGEuZW5kRFRTICxtb29mIDogZGF0YS5tb29mLmJ1ZmZlciwgbWRhdCA6IGRhdGEubWRhdC5idWZmZXJ9O1xuICAgICAgLy8gcGFzcyBtb29mL21kYXQgZGF0YSBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLFtvYmpEYXRhLm1vb2Ysb2JqRGF0YS5tZGF0XSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICB2YXIgb2JqRGF0YSA9IHsgZXZlbnQgOiBldiB9O1xuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBUU0RlbXV4ZXJXb3JrZXI7XG5cbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gZmlyZWQgd2hlbiBNZWRpYVNvdXJjZSBoYXMgYmVlbiBzdWNjZXNmdWxseSBhdHRhY2hlZCB0byB2aWRlbyBlbGVtZW50IC0gZGF0YTogeyBtZWRpYVNvdXJjZSB9XG4gIE1TRV9BVFRBQ0hFRCA6ICdobHNNZWRpYVNvdXJjZUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gbG9hZGVkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHVybCA6IG1hbmlmZXN0VVJMLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfX1cbiAgTUFOSUZFU1RfTE9BREVEICA6ICdobHNNYW5pZmVzdExvYWRlZCcsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIHBhcnNlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCBzdGFydExldmVsIDogcGxheWJhY2sgc3RhcnQgbGV2ZWwsIGF1ZGlvY29kZWNzd2l0Y2g6IHRydWUgaWYgZGlmZmVyZW50IGF1ZGlvIGNvZGVjcyB1c2VkfVxuICBNQU5JRkVTVF9QQVJTRUQgIDogJ2hsc01hbmlmZXN0UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBsZXZlbElkIDogaWQgb2YgbGV2ZWwgYmVpbmcgbG9hZGVkfVxuICBMRVZFTF9MT0FESU5HICAgIDogJ2hsc0xldmVsTG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCBwbGF5bGlzdCBsb2FkaW5nIGZpbmlzaGVzIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWxJZCA6IGlkIG9mIGxvYWRlZCBsZXZlbCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX0gfVxuICBMRVZFTF9MT0FERUQgOiAgJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsSWQgOiBpZCBvZiBuZXcgbGV2ZWwgfVxuICBMRVZFTF9TV0lUQ0ggOiAgJ2hsc0xldmVsU3dpdGNoJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURJTkcgOiAgJ2hsc0ZyYWdtZW50TG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBmcmFnbWVudCBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGZyYWdtZW50IHBheWxvYWQsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbGVuZ3RofX1cbiAgRlJBR19MT0FERUQgOiAgJ2hsc0ZyYWdtZW50TG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBJbml0IFNlZ21lbnQgaGFzIGJlZW4gZXh0cmFjdGVkIGZyb20gZnJhZ21lbnQgLSBkYXRhOiB7IG1vb3YgOiBtb292IE1QNCBib3gsIGNvZGVjcyA6IGNvZGVjcyBmb3VuZCB3aGlsZSBwYXJzaW5nIGZyYWdtZW50fVxuICBGUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UIDogICdobHNGcmFnbWVudFBhcnNpbmdJbml0U2VnbWVudCcsXG4gIC8vIGZpcmVkIHdoZW4gbW9vZi9tZGF0IGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vZiA6IG1vb2YgTVA0IGJveCwgbWRhdCA6IG1kYXQgTVA0IGJveH1cbiAgRlJBR19QQVJTSU5HX0RBVEEgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0RhdGEnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IHBhcnNpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogdW5kZWZpbmVkXG4gIEZSQUdfUEFSU0VEIDogICdobHNGcmFnbWVudFBhcnNlZCcsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcmVtdXhlZCBNUDQgYm94ZXMgaGF2ZSBhbGwgYmVlbiBhcHBlbmRlZCBpbnRvIFNvdXJjZUJ1ZmZlciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCB0cGFyc2VkLCB0YnVmZmVyZWQsIGxlbmd0aH0gfVxuICBGUkFHX0JVRkZFUkVEIDogICdobHNGcmFnbWVudEJ1ZmZlcmVkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCBtYXRjaGluZyB3aXRoIGN1cnJlbnQgdmlkZW8gcG9zaXRpb24gaXMgY2hhbmdpbmcgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19DSEFOR0VEIDogICdobHNGcmFnbWVudENoYW5nZWQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudC9wbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTE9BRF9FUlJPUiA6ICAnaGxzTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQvcGxheWxpc3QgbG9hZCB0aW1lb3V0IC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTE9BRF9USU1FT1VUIDogICdobHNMb2FkVGltZU91dCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGVycm9yIC0gZGF0YTogeyBsZXZlbCA6IGZhdWx0eSBsZXZlbCBJZCwgZXZlbnQgOiBlcnJvciBkZXNjcmlwdGlvbn1cbiAgTEVWRUxfRVJST1IgOiAgJ2hsc0xldmVsRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGZyYWdtZW50IHBhcnNpbmcgZXJyb3IgZXZlbnQgLSBkYXRhOiBwYXJzaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEZSQUdfUEFSU0lOR19FUlJPUiA6ICAnaGxzRnJhZ21lbnRQYXJzaW5nRXJyb3InXG59O1xuIiwiLyoqXG4gKiBITFMgZW5naW5lXG4gKi9cbid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuL29ic2VydmVyJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciAgICAgICBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IEJ1ZmZlckNvbnRyb2xsZXIgICAgIGZyb20gJy4vY29udHJvbGxlci9idWZmZXItY29udHJvbGxlcic7XG5pbXBvcnQgTGV2ZWxDb250cm9sbGVyICAgICAgZnJvbSAnLi9jb250cm9sbGVyL2xldmVsLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsZW5hYmxlTG9nc30gIGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgICAgICAgICAgICBmcm9tICcuL3V0aWxzL3hoci1sb2FkZXInO1xuLy9pbXBvcnQgTVA0SW5zcGVjdCAgICAgICAgIGZyb20gJy9yZW11eC9tcDQtaW5zcGVjdG9yJztcblxuY2xhc3MgSGxzIHtcblxuICBzdGF0aWMgaXNTdXBwb3J0ZWQoKSB7XG4gICAgcmV0dXJuICh3aW5kb3cuTWVkaWFTb3VyY2UgJiYgTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQ7IGNvZGVjcz1cImF2YzEuNDJFMDFFLG1wNGEuNDAuMlwiJykpO1xuICB9XG5cbiAgY29uc3RydWN0b3IoY29uZmlnID0ge30pIHtcbiAgIHZhciBjb25maWdEZWZhdWx0ID0ge1xuICAgICAgZGVidWcgOiBmYWxzZSxcbiAgICAgIG1heEJ1ZmZlckxlbmd0aCA6IDMwLFxuICAgICAgbWF4QnVmZmVyU2l6ZSA6IDYwKjEwMDAqMTAwMCxcbiAgICAgIGVuYWJsZVdvcmtlciA6IHRydWUsXG4gICAgICBmcmFnTG9hZGluZ1RpbWVPdXQgOiA2MDAwMCxcbiAgICAgIGZyYWdMb2FkaW5nTWF4UmV0cnkgOiAzLFxuICAgICAgZnJhZ0xvYWRpbmdSZXRyeURlbGF5IDogNTAwLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nVGltZU91dCA6IDEwMDAwLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nTWF4UmV0cnkgOiAzLFxuICAgICAgbWFuaWZlc3RMb2FkaW5nUmV0cnlEZWxheSA6IDUwMCxcbiAgICAgIGxvYWRlciA6IFhockxvYWRlclxuICAgIH07XG4gICAgZm9yICh2YXIgcHJvcCBpbiBjb25maWdEZWZhdWx0KSB7XG4gICAgICAgIGlmIChwcm9wIGluIGNvbmZpZykgeyBjb250aW51ZTsgfVxuICAgICAgICBjb25maWdbcHJvcF0gPSBjb25maWdEZWZhdWx0W3Byb3BdO1xuICAgIH1cbiAgICBlbmFibGVMb2dzKGNvbmZpZy5kZWJ1Zyk7XG5cbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKGNvbmZpZyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMucGxheWxpc3RMb2FkZXIpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBCdWZmZXJDb250cm9sbGVyKHRoaXMubGV2ZWxDb250cm9sbGVyLGNvbmZpZyk7XG4gICAgdGhpcy5FdmVudHMgPSBFdmVudDtcbiAgICAvLyBvYnNlcnZlciBzZXR1cFxuICAgIHRoaXMub24gPSBvYnNlcnZlci5vbi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLm9mZiA9IG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyLmJpbmQob2JzZXJ2ZXIpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLnBsYXlsaXN0TG9hZGVyKSB7XG4gICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmJ1ZmZlckNvbnRyb2xsZXIpIHtcbiAgICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmxldmVsQ29udHJvbGxlcikge1xuICAgICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnVubG9hZFNvdXJjZSgpO1xuICAgIHRoaXMuZGV0YWNoVmlkZW8oKTtcbiAgICBvYnNlcnZlci5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGF0dGFjaFZpZGVvKHZpZGVvKSB7XG4gICAgdGhpcy52aWRlbyA9IHZpZGVvO1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICB2aWRlby5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsdGhpcy5vbnZlcnJvcik7XG4gIH1cblxuICBkZXRhY2hWaWRlbygpIHtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHZhciBtcyA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYobXMpIHtcbiAgICAgIG1zLmVuZE9mU3RyZWFtKCk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgIHRoaXMub25tc28pO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgICAvLyB1bmxpbmsgTWVkaWFTb3VyY2UgZnJvbSB2aWRlbyB0YWdcbiAgICAgIHZpZGVvLnNyYyA9ICcnO1xuICAgICAgdGhpcy5tZWRpYVNvdXJjZSA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMub25tc28gPSB0aGlzLm9ubXNlID0gdGhpcy5vbm1zYyA9IG51bGw7XG4gICAgaWYodmlkZW8pIHtcbiAgICAgIHRoaXMudmlkZW8gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRTb3VyY2UodXJsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgbG9nZ2VyLmxvZyhgbG9hZFNvdXJjZToke3VybH1gKTtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHVybCxudWxsKTtcbiAgfVxuXG4gIHJlY292ZXJFcnJvcigpIHtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHRoaXMuZGV0YWNoVmlkZW8oKTtcbiAgICB0aGlzLmF0dGFjaFZpZGVvKHZpZGVvKTtcbiAgfVxuXG4gIHVubG9hZFNvdXJjZSgpIHtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG5cbiAgLyoqIFJldHVybiBjdXJyZW50IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKiovXG4gIGdldCBjdXJyZW50TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5jdXJyZW50TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBpbW1lZGlhdGVseSAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBjdXJyZW50TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5pbW1lZGlhdGVMZXZlbFN3aXRjaCgpO1xuICB9XG5cbiAgLyoqIFJldHVybiBuZXh0IHBsYXliYWNrIHF1YWxpdHkgbGV2ZWwgKHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBmcmFnbWVudCkgKiovXG4gIGdldCBuZXh0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBuZXh0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxvYWRMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsb2FkTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgZm9yIG5leHQgbG9hZGVkIGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IGxvYWRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgZ2V0IGZpcnN0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmZpcnN0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0IGZpcnN0IGxldmVsIChpbmRleCBvZiBmaXJzdCBsZXZlbCByZWZlcmVuY2VkIGluIG1hbmlmZXN0KVxuICAqKi9cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgIHN0YXJ0IGxldmVsIChsZXZlbCBvZiBmaXJzdCBmcmFnbWVudCB0aGF0IHdpbGwgYmUgcGxheWVkIGJhY2spXG4gICAgICBpZiBub3Qgb3ZlcnJpZGVkIGJ5IHVzZXIsIGZpcnN0IGxldmVsIGFwcGVhcmluZyBpbiBtYW5pZmVzdCB3aWxsIGJlIHVzZWQgYXMgc3RhcnQgbGV2ZWxcbiAgICAgIGlmIC0xIDogYXV0b21hdGljIHN0YXJ0IGxldmVsIHNlbGVjdGlvbiwgcGxheWJhY2sgd2lsbCBzdGFydCBmcm9tIGxldmVsIG1hdGNoaW5nIGRvd25sb2FkIGJhbmR3aWR0aCAoZGV0ZXJtaW5lZCBmcm9tIGRvd25sb2FkIG9mIGZpcnN0IHNlZ21lbnQpXG4gICoqL1xuICBzZXQgc3RhcnRMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmc7XG4gIH1cblxuICAvKiogc2V0IHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIHNldCBhdXRvTGV2ZWxDYXBwaW5nKG5ld0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuYXV0b0xldmVsQ2FwcGluZyA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyogY2hlY2sgaWYgd2UgYXJlIGluIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gbW9kZSAqL1xuICBnZXQgYXV0b0xldmVsRW5hYmxlZCgpIHtcbiAgICByZXR1cm4gKHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsICA9PT0gLTEpO1xuICB9XG5cbiAgLyogcmV0dXJuIG1hbnVhbCBsZXZlbCAqL1xuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZU9wZW4oKSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NU0VfQVRUQUNIRUQsIHsgdmlkZW86IHRoaXMudmlkZW8sIG1lZGlhU291cmNlIDogdGhpcy5tZWRpYVNvdXJjZSB9KTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiIC8qXG4gKiBmcmFnbWVudCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuXG4gY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnPWNvbmZpZztcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhYm9ydCgpIHtcbiAgICBpZih0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gIH1cblxuICBsb2FkKGZyYWcpIHtcbiAgICB0aGlzLmZyYWcgPSBmcmFnO1xuICAgIHRoaXMubG9hZGVyID0gbmV3IHRoaXMuY29uZmlnLmxvYWRlcigpO1xuICAgIHRoaXMubG9hZGVyLmxvYWQoZnJhZy51cmwsJ2FycmF5YnVmZmVyJyx0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdUaW1lT3V0LCB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5LHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSk7XG4gIH1cblxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50LCBzdGF0cykge1xuICAgIHZhciBwYXlsb2FkID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZTtcbiAgICBzdGF0cy5sZW5ndGggPSBwYXlsb2FkLmJ5dGVMZW5ndGg7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgeyBwYXlsb2FkIDogcGF5bG9hZCxcbiAgICAgICAgICAgICAgICAgICAgICBmcmFnIDogdGhpcy5mcmFnICxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHN0YXRzfSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdGhpcy5mcmFnLnVybCwgZXZlbnQ6ZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX1RJTUVPVVQsIHsgdXJsIDogdGhpcy5mcmFnLnVybH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIHBsYXlsaXN0IGxvYWRlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4vL2ltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgUGxheWxpc3RMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIHRoaXMubWFuaWZlc3RMb2FkZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgfVxuXG4gIGxvYWQodXJsLHJlcXVlc3RJZCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuaWQgPSByZXF1ZXN0SWQ7XG4gICAgdGhpcy5sb2FkZXIgPSBuZXcgdGhpcy5jb25maWcubG9hZGVyKCk7XG4gICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsJycsdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpLCB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpLCB0aGlzLmxvYWR0aW1lb3V0LmJpbmQodGhpcyksIHRoaXMuY29uZmlnLm1hbmlmZXN0TG9hZGluZ1RpbWVPdXQsIHRoaXMuY29uZmlnLm1hbmlmZXN0TG9hZGluZ01heFJldHJ5LHRoaXMuY29uZmlnLm1hbmlmZXN0TG9hZGluZ1JldHJ5RGVsYXkpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICB2YXIgZG9jICAgICAgPSBkb2N1bWVudCxcbiAgICAgICAgb2xkQmFzZSA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdLFxuICAgICAgICBvbGRIcmVmID0gb2xkQmFzZSAmJiBvbGRCYXNlLmhyZWYsXG4gICAgICAgIGRvY0hlYWQgPSBkb2MuaGVhZCB8fCBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXSxcbiAgICAgICAgb3VyQmFzZSA9IG9sZEJhc2UgfHwgZG9jSGVhZC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnYmFzZScpKSxcbiAgICAgICAgcmVzb2x2ZXIgPSBkb2MuY3JlYXRlRWxlbWVudCgnYScpLFxuICAgICAgICByZXNvbHZlZFVybDtcblxuICAgIG91ckJhc2UuaHJlZiA9IGJhc2VVcmw7XG4gICAgcmVzb2x2ZXIuaHJlZiA9IHVybDtcbiAgICByZXNvbHZlZFVybCAgPSByZXNvbHZlci5ocmVmOyAvLyBicm93c2VyIG1hZ2ljIGF0IHdvcmsgaGVyZVxuXG4gICAgaWYgKG9sZEJhc2UpIHtvbGRCYXNlLmhyZWYgPSBvbGRIcmVmO31cbiAgICBlbHNlIHtkb2NIZWFkLnJlbW92ZUNoaWxkKG91ckJhc2UpO31cbiAgICByZXR1cm4gcmVzb2x2ZWRVcmw7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyxiYXNldXJsKSB7XG4gICAgdmFyIGxldmVscyA9IFtdLGxldmVsID0gIHt9LHJlc3VsdCxjb2RlY3MsY29kZWM7XG4gICAgdmFyIHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOihbXlxcblxccl0qKEJBTkQpV0lEVEg9KFxcZCspKT8oW15cXG5cXHJdKihDT0RFQ1MpPVxcXCIoLiopXFxcIiwpPyhbXlxcblxccl0qKFJFUylPTFVUSU9OPShcXGQrKXgoXFxkKykpPyhbXlxcblxccl0qKE5BTUUpPVxcXCIoLiopXFxcIik/W15cXG5cXHJdKltcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4peyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7fSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0LnBvcCgpLGJhc2V1cmwpO1xuICAgICAgd2hpbGUocmVzdWx0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgc3dpdGNoKHJlc3VsdC5zaGlmdCgpKSB7XG4gICAgICAgICAgY2FzZSAnUkVTJzpcbiAgICAgICAgICAgIGxldmVsLndpZHRoID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQkFORCc6XG4gICAgICAgICAgICBsZXZlbC5iaXRyYXRlID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnTkFNRSc6XG4gICAgICAgICAgICBsZXZlbC5uYW1lID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdDT0RFQ1MnOlxuICAgICAgICAgICAgY29kZWNzID0gcmVzdWx0LnNoaWZ0KCkuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHdoaWxlKGNvZGVjcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvZGVjID0gY29kZWNzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgIGlmKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsZXZlbC52aWRlb0NvZGVjID0gdGhpcy5hdmMxdG9hdmNvdGkoY29kZWMpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICBsZXZlbCA9IHt9O1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCxhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZihhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsdG90YWxkdXJhdGlvbiA9IDAsIGxldmVsID0geyB1cmwgOiBiYXNldXJsLCBmcmFnbWVudHMgOiBbXSwgbGl2ZSA6IHRydWV9LCByZXN1bHQsIHJlZ2V4cDtcbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSpbXFxyXFxuXSsoW15cXHJcXG5dKyl8KD86I0VYVC1YLShFTkRMSVNUKSkpL2c7XG4gICAgd2hpbGUoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgc3dpdGNoKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdJTkYnOlxuICAgICAgICAgIHZhciBkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBsZXZlbC5mcmFnbWVudHMucHVzaCh7dXJsIDogdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSxiYXNldXJsKSwgZHVyYXRpb24gOiBkdXJhdGlvbiwgc3RhcnQgOiB0b3RhbGR1cmF0aW9uLCBzbiA6IGN1cnJlbnRTTisrLCBsZXZlbDppZH0pO1xuICAgICAgICAgIHRvdGFsZHVyYXRpb24rPWR1cmF0aW9uO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZvdW5kICcgKyBsZXZlbC5mcmFnbWVudHMubGVuZ3RoICsgJyBmcmFnbWVudHMnKTtcbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gICAgcmV0dXJuIGxldmVsO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHN0cmluZyA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VUZXh0LCB1cmwgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVVJMLCBpZCA9IHRoaXMuaWQsbGV2ZWxzO1xuICAgIC8vIHJlc3BvbnNlVVJMIG5vdCBzdXBwb3J0ZWQgb24gc29tZSBicm93c2VycyAoaXQgaXMgdXNlZCB0byBkZXRlY3QgVVJMIHJlZGlyZWN0aW9uKVxuICAgIGlmKHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWxsYmFjayB0byBpbml0aWFsIFVSTFxuICAgICAgdXJsID0gdGhpcy51cmw7XG4gICAgfVxuICAgIHN0YXRzLnRsb2FkID0gbmV3IERhdGUoKTtcbiAgICBzdGF0cy5tdGltZSA9IG5ldyBEYXRlKGV2ZW50LmN1cnJlbnRUYXJnZXQuZ2V0UmVzcG9uc2VIZWFkZXIoJ0xhc3QtTW9kaWZpZWQnKSk7XG5cbiAgICBpZihzdHJpbmcuaW5kZXhPZignI0VYVE0zVScpID09PSAwKSB7XG4gICAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRJTkY6JykgPiAwKSB7XG4gICAgICAgIC8vIDEgbGV2ZWwgcGxheWxpc3RcbiAgICAgICAgLy8gaWYgZmlyc3QgcmVxdWVzdCwgZmlyZSBtYW5pZmVzdCBsb2FkZWQgZXZlbnQsIGxldmVsIHdpbGwgYmUgcmVsb2FkZWQgYWZ0ZXJ3YXJkc1xuICAgICAgICAvLyAodGhpcyBpcyB0byBoYXZlIGEgdW5pZm9ybSBsb2dpYyBmb3IgMSBsZXZlbC9tdWx0aWxldmVsIHBsYXlsaXN0cylcbiAgICAgICAgaWYodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IFt7dXJsIDogdXJsfV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsIDogdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyBkZXRhaWxzIDogdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLHVybCxpZCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWxJZCA6IGlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogc3RhdHN9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyx1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZihsZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZCA6IGlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdXJsLCByZXNwb25zZSA6ICdubyBsZXZlbCBmb3VuZCBpbiBtYW5pZmVzdCd9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdXJsLCByZXNwb25zZSA6IGV2ZW50LmN1cnJlbnRUYXJnZXR9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdGhpcy51cmwsIHJlc3BvbnNlIDogZXZlbnQuY3VycmVudFRhcmdldH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfVElNRU9VVCwgeyB1cmwgOiB0aGlzLnVybH0pO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCJpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbmxldCBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblxub2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IG9ic2VydmVyO1xuIiwiLyoqXG4gKiBnZW5lcmF0ZSBNUDQgQm94XG4gKi9cblxuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW10sXG4gICAgICBzbWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBNUDQuTUFKT1JfQlJBTkQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAnaScuY2hhckNvZGVBdCgwKSxcbiAgICAgICdzJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ28nLmNoYXJDb2RlQXQoMCksXG4gICAgICAnbScuY2hhckNvZGVBdCgwKVxuICAgIF0pO1xuICAgIE1QNC5BVkMxX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2EnLmNoYXJDb2RlQXQoMCksXG4gICAgICAndicuY2hhckNvZGVBdCgwKSxcbiAgICAgICdjJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJzEnLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuTUlOT1JfVkVSU0lPTiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG4gICAgTVA0LlZJREVPX0hETFIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuICAgIE1QNC5BVURJT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzMsIDB4NmYsIDB4NzUsIDB4NmUsIC8vIGhhbmRsZXJfdHlwZTogJ3NvdW4nXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDUzLCAweDZmLCAweDc1LCAweDZlLFxuICAgICAgMHg2NCwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1NvdW5kSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6TVA0LlZJREVPX0hETFIsXG4gICAgICAnYXVkaW8nOk1QNC5BVURJT19IRExSXG4gICAgfTtcbiAgICBNUDQuRFJFRiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcbiAgICBNUDQuU1RDTyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlNUU0MgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RUUyA9IE1QNC5TVENPO1xuICAgIE1QNC5TVFNaID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfY291bnRcbiAgICBdKTtcbiAgICBNUDQuVk1IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBncmFwaGljc21vZGVcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCAvLyBvcGNvbG9yXG4gICAgXSk7XG4gICAgTVA0LlNNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gYmFsYW5jZVxuICAgICAgMHgwMCwgMHgwMCAvLyByZXNlcnZlZFxuICAgIF0pO1xuXG4gICAgTVA0LlNUU0QgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxXSk7Ly8gZW50cnlfY291bnRcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuTUlOT1JfVkVSU0lPTiwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuQVZDMV9CUkFORCk7XG4gICAgTVA0LkRJTkYgPSBNUDQuYm94KE1QNC50eXBlcy5kaW5mLCBNUDQuYm94KE1QNC50eXBlcy5kcmVmLCBNUDQuRFJFRikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSAwLFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICByZXN1bHQsXG4gICAgdmlldztcblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgc2l6ZSB3ZSBuZWVkIHRvIGFsbG9jYXRlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHNpemUgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KHJlc3VsdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIHJlc3VsdC5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuXG4gICAgLy8gY29weSB0aGUgcGF5bG9hZCBpbnRvIHRoZSByZXN1bHRcbiAgICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IHBheWxvYWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKGR1cmF0aW9uKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAxLCAweDVmLCAweDkwLCAvLyB0aW1lc2NhbGUsIDkwLDAwMCBcInRpY2tzXCIgcGVyIHNlY29uZFxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgICAgMHgwMCwgMHgwMFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGlhKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaWEsIE1QNC5tZGhkKHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsXG4gICAgICAgICAgICAgICAgICAgTVA0Lm1maGQoc24pLFxuICAgICAgICAgICAgICAgICAgIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKGR1cmF0aW9uKSB7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMSwgMHg1ZiwgMHg5MCwgLy8gdGltZXNjYWxlLCA5MCwwMDAgXCJ0aWNrc1wiIHBlciBzZWNvbmRcbiAgICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAgIDB4MDEsIDB4MDAsIC8vIDEuMCB2b2x1bWVcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweGZmLCAweGZmLCAweGZmLCAweGZmIC8vIG5leHRfdHJhY2tfSURcbiAgICAgIF0pO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tdmhkLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc2R0cCh0cmFjaykge1xuICAgIHZhclxuICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgICBmbGFncyxcbiAgICAgIGk7XG5cbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCxcbiAgICAgICAgICAgICAgIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzdGJsKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0YmwsXG4gICAgICAgICAgICAgICBNUDQuc3RzZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHNjLCBNUDQuU1RTQyksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdHN6LCBNUDQuU1RTWiksXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpO1xuICAgIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnNwcy5sZW5ndGg7IGkrKykge1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpOyAvLyBzZXF1ZW5jZVBhcmFtZXRlclNldExlbmd0aFxuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5zcHNbaV0pKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggPj4+IDgpICYgMHhGRik7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRyYWNrLnBwc1tpXSkpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLndpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHRyYWNrLmhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMyxcbiAgICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgICAgMHg2ZiwgMHg2YSwgMHg3MywgMHgyZCxcbiAgICAgICAgMHg2MywgMHg2ZiwgMHg2ZSwgMHg3NCxcbiAgICAgICAgMHg3MiwgMHg2OSwgMHg2MiwgMHgyZCxcbiAgICAgICAgMHg2OCwgMHg2YywgMHg3MywgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5hdmNDLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAxLCAvLyBjb25maWd1cmF0aW9uVmVyc2lvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYywgLy8gQVZDUHJvZmlsZUluZGljYXRpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXRpYmlsaXR5LCAvLyBwcm9maWxlX2NvbXBhdGliaWxpdHlcbiAgICAgICAgICAgIHRyYWNrLmxldmVsSWRjLCAvLyBBVkNMZXZlbEluZGljYXRpb25cbiAgICAgICAgICAgIDB4ZmYgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICBdLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5zcHMubGVuZ3RoIC8vIG51bU9mU2VxdWVuY2VQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5idHJ0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAwLCAweDFjLCAweDljLCAweDgwLCAvLyBidWZmZXJTaXplREJcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzAsIC8vIG1heEJpdHJhdGVcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzBdKSkgLy8gYXZnQml0cmF0ZVxuICAgICAgICAgICk7XG4gIH1cblxuICBzdGF0aWMgZXNkcyh0cmFjaykge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG5cbiAgICAgIDB4MDMsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgxNyt0cmFjay5jb25maWcubGVuZ3RoLCAvLyBsZW5ndGhcbiAgICAgIDB4MDAsIDB4MDEsIC8vZXNfaWRcbiAgICAgIDB4MDAsIC8vIHN0cmVhbV9wcmlvcml0eVxuXG4gICAgICAweDA0LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MGYrdHJhY2suY29uZmlnLmxlbmd0aCwgLy8gbGVuZ3RoXG4gICAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAgIDB4MTUsIC8vIHN0cmVhbV90eXBlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBidWZmZXJfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYXZnQml0cmF0ZVxuXG4gICAgICAweDA1IC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgXS5jb25jYXQoW3RyYWNrLmNvbmZpZy5sZW5ndGhdKS5jb25jYXQodHJhY2suY29uZmlnKS5jb25jYXQoWzB4MDYsIDB4MDEsIDB4MDJdKSk7IC8vIEdBU3BlY2lmaWNDb25maWcpKTsgLy8gbGVuZ3RoICsgYXVkaW8gY29uZmlnIGRlc2NyaXB0b3JcbiAgfVxuXG4gIHN0YXRpYyBtcDRhKHRyYWNrKSB7XG4gICAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tcDRhLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIHRyYWNrLmNoYW5uZWxDb3VudCwgLy8gY2hhbm5lbGNvdW50XG4gICAgICAgIDB4MDAsIDB4MTAsIC8vIHNhbXBsZVNpemU6MTZiaXRzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkMlxuICAgICAgICAodHJhY2suYXVkaW9zYW1wbGVyYXRlID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlICYgMHhmZiwgLy9cbiAgICAgICAgMHgwMCwgMHgwMF0pLFxuICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5lc2RzLCBNUDQuZXNkcyh0cmFjaykpKTtcbiAgfVxuXG4gIHN0YXRpYyBzdHNkKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCAsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCAsIE1QNC5hdmMxKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHRraGQodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0cmFjay5pZCA+PiAyNCkgJiAweEZGLFxuICAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDB4RkYsXG4gICAgICAodHJhY2suaWQgPj4gOCkgJiAweEZGLFxuICAgICAgdHJhY2suaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAyNCksXG4gICAgICAodHJhY2suZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgdHJhY2suZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAodHJhY2sud2lkdGggPj4gOCkgJiAweEZGLFxuICAgICAgdHJhY2sud2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgICh0cmFjay5oZWlnaHQgPj4gOCkgJiAweEZGLFxuICAgICAgdHJhY2suaGVpZ2h0ICYgMHhGRixcbiAgICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkge1xuICAgIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBNUDQuc2R0cCh0cmFjayk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWYsXG4gICAgICAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgICAgICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gMjQpLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gMTYpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+MjQpLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSA+PiA4KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LnRydW4odHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZS5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmR0XG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gdHJhZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICAgIDggKyAgLy8gbW9vZiBoZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgOCksICAvLyBtZGF0IGhlYWRlclxuICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIHRyYWNrIGJveC5cbiAgICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IGEgdHJhY2sgZGVmaW5pdGlvblxuICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gICAqL1xuICBzdGF0aWMgdHJhayh0cmFjaykge1xuICAgIHRyYWNrLmR1cmF0aW9uID0gdHJhY2suZHVyYXRpb24gfHwgMHhmZmZmZmZmZjtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhayxcbiAgICAgICAgICAgICAgIE1QNC50a2hkKHRyYWNrKSxcbiAgICAgICAgICAgICAgIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAodHJhY2suaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcywgc2FtcGxlLCBpLCBhcnJheTtcblxuICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdO1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoMTIgKyAoMTYgKiBzYW1wbGVzLmxlbmd0aCkpO1xuICAgIG9mZnNldCArPSA4ICsgYXJyYXkuYnl0ZUxlbmd0aDtcblxuICAgIGFycmF5LnNldChbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MGYsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAoc2FtcGxlcy5sZW5ndGggPj4+IDI0KSAmIDB4RkYsXG4gICAgICAoc2FtcGxlcy5sZW5ndGggPj4+IDE2KSAmIDB4RkYsXG4gICAgICAoc2FtcGxlcy5sZW5ndGggPj4+IDgpICYgMHhGRixcbiAgICAgIHNhbXBsZXMubGVuZ3RoICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChvZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdLDApO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYsIC8vIHNhbXBsZV9kdXJhdGlvblxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIHNhbXBsZS5zaXplICYgMHhGRiwgLy8gc2FtcGxlX3NpemVcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0xlYWRpbmcgPDwgMikgfCBzYW1wbGUuZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzRGVwZW5kZWRPbiA8PCA2KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgICAgc2FtcGxlLmZsYWdzLmlzTm9uU3luY1NhbXBsZSxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZGF0aW9uUHJpb3JpdHkgJiAweEYwIDw8IDgsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRhdGlvblByaW9yaXR5ICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCAmIDB4RkYgLy8gc2FtcGxlX2NvbXBvc2l0aW9uX3RpbWVfb2Zmc2V0XG4gICAgICBdLDEyKzE2KmkpO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJ1biwgYXJyYXkpO1xuICB9XG5cbiAgc3RhdGljIGluaXRTZWdtZW50KHRyYWNrcykge1xuXG4gICAgaWYoIU1QNC50eXBlcykge1xuICAgICAgTVA0LmluaXQoKTtcbiAgICB9XG4gICAgdmFyXG4gICAgICBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksXG4gICAgICByZXN1bHQ7XG5cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG5cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCl7fVxubGV0IGZha2VMb2dnZXIgPSB7XG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Zykge1xuICBpZiAoZGVidWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnICAgICAgID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gZGVidWcubG9nICAgPyBkZWJ1Zy5sb2cuYmluZChkZWJ1ZykgICA6IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBkZWJ1Zy5pbmZvICA/IGRlYnVnLmluZm8uYmluZChkZWJ1ZykgIDogY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBkZWJ1Zy5lcnJvciA/IGRlYnVnLmVycm9yLmJpbmQoZGVidWcpIDogY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gZGVidWcud2FybiAgPyBkZWJ1Zy53YXJuLmJpbmQoZGVidWcpICA6IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpO1xuXG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBub29wO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwiIC8qXG4gICogWGhyIGJhc2VkIExvYWRlclxuICAqXG4gICovXG5cbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgWGhyTG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIGlmKHRoaXMubG9hZGVyICYmdGhpcy5sb2FkZXIucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgaWYodGhpcy50aW1lb3V0SGFuZGxlKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgfVxuICB9XG5cbiAgbG9hZCh1cmwscmVzcG9uc2VUeXBlLG9uU3VjY2VzcyxvbkVycm9yLG9uVGltZW91dCx0aW1lb3V0LG1heFJldHJ5LHJldHJ5RGVsYXkpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uVGltZW91dCA9IG9uVGltZW91dDtcbiAgICB0aGlzLm9uRXJyb3IgPSBvbkVycm9yO1xuICAgIHRoaXMudHJlcXVlc3QgPSBuZXcgRGF0ZSgpO1xuICAgIHRoaXMudGltZW91dCA9IHRpbWVvdXQ7XG4gICAgdGhpcy5tYXhSZXRyeSA9IG1heFJldHJ5O1xuICAgIHRoaXMucmV0cnlEZWxheSA9IHJldHJ5RGVsYXk7XG4gICAgdGhpcy5yZXRyeSA9IDA7XG4gICAgdGhpcy50aW1lb3V0SGFuZGxlID0gd2luZG93LnNldFRpbWVvdXQodGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLHRpbWVvdXQpO1xuICAgIHRoaXMubG9hZEludGVybmFsKCk7XG4gIH1cblxuICBsb2FkSW50ZXJuYWwoKSB7XG4gICAgdmFyIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9ubG9hZCA9ICB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9uZXJyb3IgPSB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub3BlbignR0VUJywgdGhpcy51cmwgLCB0cnVlKTtcbiAgICB4aHIucmVzcG9uc2VUeXBlID0gdGhpcy5yZXNwb25zZVR5cGU7XG4gICAgdGhpcy50Zmlyc3QgPSBudWxsO1xuICAgIHRoaXMubG9hZGVkID0gMDtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgdGhpcy5vblN1Y2Nlc3MoZXZlbnQse3RyZXF1ZXN0IDogdGhpcy50cmVxdWVzdCwgdGZpcnN0IDogdGhpcy50Zmlyc3QsIHRsb2FkIDogbmV3IERhdGUoKSwgbG9hZGVkIDogdGhpcy5sb2FkZWR9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmKHRoaXMucmV0cnkgPCB0aGlzLm1heFJldHJ5KSB7XG4gICAgICBsb2dnZXIubG9nKGAke2V2ZW50LnR5cGV9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICB3aW5kb3cuc2V0VGltZW91dCh0aGlzLmxvYWRJbnRlcm5hbC5iaW5kKHRoaXMpLHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAgICB0aGlzLnJldHJ5RGVsYXk9TWF0aC5taW4oMip0aGlzLnJldHJ5RGVsYXksNjQwMDApO1xuICAgICAgdGhpcy5yZXRyeSsrO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICBsb2dnZXIubG9nKGAke2V2ZW50LnR5cGV9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgICB0aGlzLm9uRXJyb3IoZXZlbnQpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWR0aW1lb3V0KGV2ZW50KSB7XG4gICAgbG9nZ2VyLmxvZyhgdGltZW91dCB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgIHRoaXMub25UaW1lb3V0KGV2ZW50LHt0cmVxdWVzdCA6IHRoaXMudHJlcXVlc3QsIHRmaXJzdCA6IHRoaXMudGZpcnN0LCBsb2FkZWQgOiB0aGlzLmxvYWRlZH0pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgaWYodGhpcy50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHRoaXMudGZpcnN0ID0gbmV3IERhdGUoKTtcbiAgICB9XG4gICAgaWYoZXZlbnQubGVuZ3RoQ29tcHV0YWJsZSkge1xuICAgICAgdGhpcy5sb2FkZWQgPSBldmVudC5sb2FkZWQ7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFhockxvYWRlcjtcbiJdfQ==
