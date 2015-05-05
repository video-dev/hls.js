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
            break;
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
                logger.log("requested position:" + bufferEnd + " is before start of playlist, reset video position to start:" + start);
                this.video.currentTime = start + 0.01;
                break;
              }
              // if one buffer range, load next SN
              if (bufferLen > 0 && this.video.buffered.length === 1) {
                fragIdx = this.frag.sn + 1 - fragments[0].sn;
                if (fragIdx >= fragments.length) {
                  // most certainly live playlist is outdated, let's move to WAITING LEVEL state and come back once it will have been refreshed
                  //logger.log('sn ' + (this.frag.sn + 1) + ' out of range, wait for live playlist update');
                  this.state = WAITING_LEVEL;
                  break;
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
                    break;
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
        // check/update fragment playing
        this._checkFragmentPlaying();
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
    getFragment: {
      value: function getFragment(position) {
        var i, range;
        for (i = this.bufferRange.length - 1; i >= 0; i--) {
          range = this.bufferRange[i];
          if (position >= range.start && position <= range.end) {
            return range.frag;
          }
        }
        return null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    playbackLevel: {
      get: function () {
        var frag = this.getFragment(this.video.currentTime);
        if (frag) {
          return frag.level;
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
    _checkFragmentPlaying: {
      value: function CheckFragmentPlaying() {
        var fragPlaying;
        if (this.video && this.video.seeking === false && this.isBuffered(this.video.currentTime)) {
          fragPlaying = this.getFragment(this.video.currentTime);
        } else {
          fragPlaying = null;
        }

        if (fragPlaying !== this.fragPlaying) {
          this.fragPlaying = fragPlaying;
          observer.trigger(Event.FRAG_PLAYING, { frag: fragPlaying });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMSEAttached: {

      /*
        flushBuffer() {
          var sb = this.sourceBuffer;
          if(sb) {
            if(sb.audio) {
              sb.audio.remove(0,9999);
            }
            if(sb.video) {
              sb.video.remove(0,9999);
            }
          }
          this.bufferRange = {};
        }
      */

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
          this.bufferRange = [];
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
            console.log(track.codec + ",rate:" + config.samplerate + ",nb channel:" + config.channelCount);
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
            stamp = pes.pts + i * 1024 * 1000 / track.audiosamplerate;
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
  // fired when playback of new fragment starts - data : { frag : fragment object }
  FRAG_PLAYING: "hlsFragmentPlaying",
  // Identifier for fragment/playlist load error - data: { url : faulty URL, response : XHR response}
  LOAD_ERROR: "hlsLoadError",
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_ERROR: "hlsLevelError",
  // Identifier for a video error -  data: undefined
  VIDEO_ERROR: "hlsVideoError",
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
    playbackLevel: {

      /* return current playback level */
      get: function () {
        return this.bufferController.playbackLevel;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dlYndvcmtpZnkvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZGVtdXhlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9kZW11eC90c2RlbXV4ZXJ3b3JrZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9obHMuanMvc3JjL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9sb2FkZXIvcGxheWxpc3QtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvaGxzLmpzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL2hscy5qcy9zcmMvdXRpbHMvbG9nZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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Q0FBQztBQUNILFdBQUcsQ0FBQyxhQUFhLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pELFdBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDOUIsQ0FBSTtBQUNKLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsVUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxDQUFJO1NBQzdCLENBQUMsQ0FBQztBQUNILFdBQUcsQ0FBQyxVQUFVLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FDOUIsQ0FBSTtBQUNKLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsVUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFBRSxH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R0FBRyxHQUFJO0FBQ2YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7U0FDdkIsQ0FBQyxDQUFDO0FBQ0wsZUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxF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QUFBQyxLQUFLLENBQUMsUUFBUSxJQUFJLEVBQUUsR0FBSSxHQUFJLEVBQzdCLEFBQUMsS0FBSyxDQUFDLFFBQVEsSUFBSyxDQUFDLEdBQUksR0FBSSxFQUM3QixLQUFLLENBQUMsUUFBUSxHQUFHLEdBQUk7QUFDckIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLEVBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsQUFBQyxhQUFLLENBQUMsS0FBSyxJQUFJLENBQUMsR0FBSSxHQUFJLEVBQ3pCLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBSSxFQUNsQixDQUFJLEVBQUUsQ0FBSTtBQUNWLEFBQUMsYUFBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUksR0FBSSxFQUMxQixLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUksRUFDbkIsQ0FBSSxFQUFFLENBQUk7U0FDWCxDQUFDLENBQUMsQ0FBQztPQUNMOzs7OztBQUVNLFFBQUk7YUFBQSxjQUFDLEtBQUssRUFB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QkFBYyxHQUFHLFVBQVUsQ0FBQztHQUM3QjtDQUNGLENBQUM7QUFDSyxJQUFJLE1BQU0sV0FBTixNQUFNLEdBQUcsY0FBYyxDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsInZhciBidW5kbGVGbiA9IGFyZ3VtZW50c1szXTtcbnZhciBzb3VyY2VzID0gYXJndW1lbnRzWzRdO1xudmFyIGNhY2hlID0gYXJndW1lbnRzWzVdO1xuXG52YXIgc3RyaW5naWZ5ID0gSlNPTi5zdHJpbmdpZnk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICB2YXIgd2tleTtcbiAgICB2YXIgY2FjaGVLZXlzID0gT2JqZWN0LmtleXMoY2FjaGUpO1xuICAgIFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICBpZiAoY2FjaGVba2V5XS5leHBvcnRzID09PSBmbikge1xuICAgICAgICAgICAgd2tleSA9IGtleTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICghd2tleSkge1xuICAgICAgICB3a2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgICAgIHZhciB3Y2FjaGUgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYWNoZUtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0gY2FjaGVLZXlzW2ldO1xuICAgICAgICAgICAgd2NhY2hlW2tleV0gPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlc1t3a2V5XSA9IFtcbiAgICAgICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZScsJ21vZHVsZScsJ2V4cG9ydHMnXSwgJygnICsgZm4gKyAnKShzZWxmKScpLFxuICAgICAgICAgICAgd2NhY2hlXG4gICAgICAgIF07XG4gICAgfVxuICAgIHZhciBza2V5ID0gTWF0aC5mbG9vcihNYXRoLnBvdygxNiwgOCkgKiBNYXRoLnJhbmRvbSgpKS50b1N0cmluZygxNik7XG4gICAgXG4gICAgdmFyIHNjYWNoZSA9IHt9OyBzY2FjaGVbd2tleV0gPSB3a2V5O1xuICAgIHNvdXJjZXNbc2tleV0gPSBbXG4gICAgICAgIEZ1bmN0aW9uKFsncmVxdWlyZSddLCdyZXF1aXJlKCcgKyBzdHJpbmdpZnkod2tleSkgKyAnKShzZWxmKScpLFxuICAgICAgICBzY2FjaGVcbiAgICBdO1xuICAgIFxuICAgIHZhciBzcmMgPSAnKCcgKyBidW5kbGVGbiArICcpKHsnXG4gICAgICAgICsgT2JqZWN0LmtleXMoc291cmNlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdpZnkoa2V5KSArICc6WydcbiAgICAgICAgICAgICAgICArIHNvdXJjZXNba2V5XVswXVxuICAgICAgICAgICAgICAgICsgJywnICsgc3RyaW5naWZ5KHNvdXJjZXNba2V5XVsxXSkgKyAnXSdcbiAgICAgICAgICAgIDtcbiAgICAgICAgfSkuam9pbignLCcpXG4gICAgICAgICsgJ30se30sWycgKyBzdHJpbmdpZnkoc2tleSkgKyAnXSknXG4gICAgO1xuICAgIFxuICAgIHZhciBVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG4gICAgXG4gICAgcmV0dXJuIG5ldyBXb3JrZXIoVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvKlxuICogYnVmZmVyIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBGcmFnbWVudExvYWRlciAgICAgICBmcm9tICcuLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCBEZW11eGVyICAgICAgICAgICAgICBmcm9tICcuLi9kZW11eC9kZW11eGVyJztcblxuICBjb25zdCBTVEFSVElORyA9IC0xO1xuICBjb25zdCBJRExFID0gMDtcbiAgY29uc3QgTE9BRElORyA9ICAxO1xuICBjb25zdCBXQUlUSU5HX0xFVkVMID0gMjtcbiAgY29uc3QgUEFSU0lORyA9IDM7XG4gIGNvbnN0IFBBUlNFRCA9IDQ7XG4gIGNvbnN0IEFQUEVORElORyA9IDU7XG5cbiBjbGFzcyBCdWZmZXJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihsZXZlbENvbnRyb2xsZXIpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlciA9IGxldmVsQ29udHJvbGxlcjtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKCk7XG4gICAgdGhpcy5tcDRzZWdtZW50cyA9IFtdO1xuICAgIC8vIFNvdXJjZSBCdWZmZXIgbGlzdGVuZXJzXG4gICAgdGhpcy5vbnNidWUgPSB0aGlzLm9uU291cmNlQnVmZmVyVXBkYXRlRW5kLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnNiZSAgPSB0aGlzLm9uU291cmNlQnVmZmVyRXJyb3IuYmluZCh0aGlzKTtcbiAgICAvLyBpbnRlcm5hbCBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1TRUF0dGFjaGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1wID0gdGhpcy5vbk1hbmlmZXN0UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdtZW50TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmlzID0gdGhpcy5vbkluaXRTZWdtZW50LmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwZyA9IHRoaXMub25GcmFnbWVudFBhcnNpbmcuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZnAgPSB0aGlzLm9uRnJhZ21lbnRQYXJzZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1TRV9BVFRBQ0hFRCwgdGhpcy5vbm1zZSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB0aGlzLm9ubXApO1xuICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVyKCk7XG4gIH1cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3AoKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyLmRlc3Ryb3koKTtcbiAgICBpZih0aGlzLmRlbXV4ZXIpIHtcbiAgICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgaWYoc2IpIHtcbiAgICAgIGlmKHNiLmF1ZGlvKSB7XG4gICAgICAgICAgLy9kZXRhY2ggc291cmNlYnVmZmVyIGZyb20gTWVkaWEgU291cmNlXG4gICAgICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IuYXVkaW8pO1xuICAgICAgICAgIHNiLmF1ZGlvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgICBzYi5hdWRpby5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgICAgfVxuICAgICAgaWYoc2IudmlkZW8pIHtcbiAgICAgICAgICAvL2RldGFjaCBzb3VyY2VidWZmZXIgZnJvbSBNZWRpYSBTb3VyY2VcbiAgICAgICAgICB0aGlzLm1lZGlhU291cmNlLnJlbW92ZVNvdXJjZUJ1ZmZlcihzYi52aWRlbyk7XG4gICAgICAgICAgc2IudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgICAgIHNiLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50Lk1BTklGRVNUX1BBUlNFRCwgdGhpcy5vbm1wKTtcbiAgICAvLyByZW1vdmUgdmlkZW8gbGlzdGVuZXJcbiAgICBpZih0aGlzLnZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsdGhpcy5vbnZzZWVrZWQpO1xuICAgICAgdGhpcy52aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsdGhpcy5vbnZtZXRhZGF0YSk7XG4gICAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9udnNlZWtlZCA9IHRoaXMub252bWV0YWRhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICB9XG5cbiAgc3RhcnQoKSB7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICB0aGlzLnN0YXRlID0gU1RBUlRJTkc7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMudGltZXIgPSB1bmRlZmluZWQ7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHRoaXMub25mcGcpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgcG9zLGxvYWRMZXZlbCxsb2FkTGV2ZWxEZXRhaWxzLGZyYWdJZHg7XG4gICAgc3dpdGNoKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2UgU1RBUlRJTkc6XG4gICAgICAgIC8vIGRldGVybWluZSBsb2FkIGxldmVsXG4gICAgICAgIHRoaXMuc3RhcnRMZXZlbCA9IHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gICAgICAgIGlmICh0aGlzLnN0YXJ0TGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgLy8gLTEgOiBndWVzcyBzdGFydCBMZXZlbCBieSBkb2luZyBhIGJpdHJhdGUgdGVzdCBieSBsb2FkaW5nIGZpcnN0IGZyYWdtZW50IG9mIGxvd2VzdCBxdWFsaXR5IGxldmVsXG4gICAgICAgICAgdGhpcy5zdGFydExldmVsID0gMDtcbiAgICAgICAgICB0aGlzLmZyYWdtZW50Qml0cmF0ZVRlc3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBuZXcgbGV2ZWwgdG8gcGxheWxpc3QgbG9hZGVyIDogdGhpcyB3aWxsIHRyaWdnZXIgc3RhcnQgbGV2ZWwgbG9hZFxuICAgICAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFdBSVRJTkdfTEVWRUw7XG4gICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIElETEU6XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGNhbmRpZGF0ZSBmcmFnbWVudCB0byBiZSBsb2FkZWQsIGJhc2VkIG9uIGN1cnJlbnQgcG9zaXRpb24gYW5kXG4gICAgICAgIC8vICBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgIC8vICBlbnN1cmUgNjBzIG9mIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIHdlIGhhdmUgbm90IHlldCBsb2FkZWQgYW55IGZyYWdtZW50LCBzdGFydCBsb2FkaW5nIGZyb20gc3RhcnQgcG9zaXRpb25cbiAgICAgICAgaWYodGhpcy5sb2FkZWRtZXRhZGF0YSkge1xuICAgICAgICAgIHBvcyA9IHRoaXMudmlkZW8uY3VycmVudFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5uZXh0TG9hZFBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGxvYWQgbGV2ZWxcbiAgICAgICAgaWYodGhpcy5zdGFydEZyYWdtZW50TG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxvYWRMZXZlbCA9IHRoaXMuc3RhcnRMZXZlbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB3ZSBhcmUgbm90IGF0IHBsYXliYWNrIHN0YXJ0LCBnZXQgbmV4dCBsb2FkIGxldmVsIGZyb20gbGV2ZWwgQ29udHJvbGxlclxuICAgICAgICAgIGxvYWRMZXZlbCA9IHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMZXZlbCgpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBidWZmZXJJbmZvID0gdGhpcy5idWZmZXJJbmZvKHBvcyksIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLCBidWZmZXJFbmQgPSBidWZmZXJJbmZvLmVuZDtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICB2YXIgbWF4QnVmTGVuID0gTWF0aC5taW4oOCo2MCoxMDAwKjEwMDAvdGhpcy5sZXZlbHNbbG9hZExldmVsXS5iaXRyYXRlLDMwKTtcbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmKGJ1ZmZlckxlbiA8IG1heEJ1Zkxlbikge1xuICAgICAgICAgIGlmKGxvYWRMZXZlbCAhPT0gdGhpcy5sZXZlbCkge1xuICAgICAgICAgICAgLy8gc2V0IG5ldyBsZXZlbCB0byBwbGF5bGlzdCBsb2FkZXIgOiB0aGlzIHdpbGwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWQgaWYgbmVlZGVkXG4gICAgICAgICAgICB0aGlzLmxldmVsQ29udHJvbGxlci5sZXZlbCA9IGxvYWRMZXZlbDtcbiAgICAgICAgICAgIC8vIHRlbGwgZGVtdXhlciB0aGF0IHdlIHdpbGwgc3dpdGNoIGxldmVsICh0aGlzIHdpbGwgZm9yY2UgaW5pdCBzZWdtZW50IHRvIGJlIHJlZ2VuZXJhdGVkKVxuICAgICAgICAgICAgaWYgKHRoaXMuZGVtdXhlcikge1xuICAgICAgICAgICAgICB0aGlzLmRlbXV4ZXIuc3dpdGNoTGV2ZWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgbG9hZExldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xvYWRMZXZlbF0uZGV0YWlscztcbiAgICAgICAgICAvLyBpZiBsZXZlbCBkZXRhaWxzIHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgaWYodHlwZW9mIGxvYWRMZXZlbERldGFpbHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gV0FJVElOR19MRVZFTDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBmaW5kIGZyYWdtZW50IGluZGV4LCBjb250aWd1b3VzIHdpdGggZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICAgIHZhciBmcmFnbWVudHMgPSBsb2FkTGV2ZWxEZXRhaWxzLmZyYWdtZW50cywgZnJhZywgc2xpZGluZyA9IGxvYWRMZXZlbERldGFpbHMuc2xpZGluZywgc3RhcnQgPSBmcmFnbWVudHNbMF0uc3RhcnQgKyBzbGlkaW5nO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHJlcXVlc3RlZCBwb3NpdGlvbiBpcyB3aXRoaW4gc2Vla2FibGUgYm91bmRhcmllcyA6XG4gICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmKGJ1ZmZlckVuZCA8IHN0YXJ0KSB7XG4gICAgICAgICAgICBsb2dnZXIubG9nKCdyZXF1ZXN0ZWQgcG9zaXRpb246JyArIGJ1ZmZlckVuZCArICcgaXMgYmVmb3JlIHN0YXJ0IG9mIHBsYXlsaXN0LCByZXNldCB2aWRlbyBwb3NpdGlvbiB0byBzdGFydDonICsgc3RhcnQpO1xuICAgICAgICAgICAgdGhpcy52aWRlby5jdXJyZW50VGltZSA9IHN0YXJ0ICsgMC4wMTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBpZiBvbmUgYnVmZmVyIHJhbmdlLCBsb2FkIG5leHQgU05cbiAgICAgICAgICBpZihidWZmZXJMZW4gPiAwICYmIHRoaXMudmlkZW8uYnVmZmVyZWQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBmcmFnSWR4ID0gdGhpcy5mcmFnLnNuICsgMSAtIGZyYWdtZW50c1swXS5zbjtcbiAgICAgICAgICAgIGlmKGZyYWdJZHggPj0gZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAvLyBtb3N0IGNlcnRhaW5seSBsaXZlIHBsYXlsaXN0IGlzIG91dGRhdGVkLCBsZXQncyBtb3ZlIHRvIFdBSVRJTkcgTEVWRUwgc3RhdGUgYW5kIGNvbWUgYmFjayBvbmNlIGl0IHdpbGwgaGF2ZSBiZWVuIHJlZnJlc2hlZFxuICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NuICcgKyAodGhpcy5mcmFnLnNuICsgMSkgKyAnIG91dCBvZiByYW5nZSwgd2FpdCBmb3IgbGl2ZSBwbGF5bGlzdCB1cGRhdGUnKTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFdBSVRJTkdfTEVWRUw7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gZGF0YSBidWZmZXJlZCwgb3IgbXVsdGlwbGUgYnVmZmVyIHJhbmdlIGxvb2sgZm9yIGZyYWdtZW50cyBtYXRjaGluZyB3aXRoIGN1cnJlbnQgcGxheSBwb3NpdGlvblxuICAgICAgICAgICAgZm9yIChmcmFnSWR4ID0gMDsgZnJhZ0lkeCA8IGZyYWdtZW50cy5sZW5ndGggOyBmcmFnSWR4KyspIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnSWR4XTtcbiAgICAgICAgICAgICAgc3RhcnQgPSBmcmFnLnN0YXJ0K3NsaWRpbmc7XG4gICAgICAgICAgICAgIC8vIG9mZnNldCBzaG91bGQgYmUgd2l0aGluIGZyYWdtZW50IGJvdW5kYXJ5XG4gICAgICAgICAgICAgIGlmKHN0YXJ0IDw9IGJ1ZmZlckVuZCAmJiAoc3RhcnQgKyBmcmFnLmR1cmF0aW9uKSA+IGJ1ZmZlckVuZCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgU04gbWF0Y2hpbmcgd2l0aCBwb3M6JyArICBidWZmZXJFbmQgKyAnOicgKyBmcmFnLnNuKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoZnJhZ0lkeCA+PSAwICYmIGZyYWdJZHggPCBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZih0aGlzLmZyYWcgJiYgZnJhZy5zbiA9PT0gdGhpcy5mcmFnLnNuKSB7XG4gICAgICAgICAgICAgIGlmKGZyYWdJZHggPT09IChmcmFnbWVudHMubGVuZ3RoIC0xKSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIGFyZSBhdCB0aGUgZW5kIG9mIHRoZSBwbGF5bGlzdCBhbmQgd2UgYWxyZWFkeSBsb2FkZWQgbGFzdCBmcmFnbWVudCwgZG9uJ3QgZG8gYW55dGhpbmdcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW2ZyYWdJZHgrMV07XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZygnU04ganVzdCBsb2FkZWQsIGxvYWQgbmV4dCBvbmU6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsb2dnZXIubG9nKCdMb2FkaW5nICAgICAgICcgKyBmcmFnLnNuICsgJyBvZiBbJyArIGZyYWdtZW50c1swXS5zbiArICcsJyArIGZyYWdtZW50c1tmcmFnbWVudHMubGVuZ3RoLTFdLnNuICsgJ10sbGV2ZWwgJyAgKyBsb2FkTGV2ZWwpO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCcgICAgICBsb2FkaW5nIGZyYWcgJyArIGkgKycscG9zL2J1ZkVuZDonICsgcG9zLnRvRml4ZWQoMykgKyAnLycgKyBidWZmZXJFbmQudG9GaXhlZCgzKSk7XG5cbiAgICAgICAgICAgIHRoaXMuZnJhZyA9IGZyYWc7XG4gICAgICAgICAgICB0aGlzLmxldmVsID0gbG9hZExldmVsO1xuICAgICAgICAgICAgdGhpcy5mcmFnbWVudExvYWRlci5sb2FkKGZyYWcsbG9hZExldmVsKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBMT0FESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgTE9BRElORzpcbiAgICAgICAgLy8gbm90aGluZyB0byBkbywgd2FpdCBmb3IgZnJhZ21lbnQgcmV0cmlldmFsXG4gICAgICBjYXNlIFdBSVRJTkdfTEVWRUw6XG4gICAgICAgIC8vIG5vdGhpbmcgdG8gZG8sIHdhaXQgZm9yIGxldmVsIHJldHJpZXZhbFxuICAgICAgY2FzZSBQQVJTSU5HOlxuICAgICAgICAvLyBub3RoaW5nIHRvIGRvLCB3YWl0IGZvciBmcmFnbWVudCBiZWluZyBwYXJzZWRcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFBBUlNFRDpcbiAgICAgIGNhc2UgQVBQRU5ESU5HOlxuICAgICAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgICAvLyBpZiBNUDQgc2VnbWVudCBhcHBlbmRpbmcgaW4gcHJvZ3Jlc3Mgbm90aGluZyB0byBkb1xuICAgICAgICAgIGlmKCh0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpbyAmJiB0aGlzLnNvdXJjZUJ1ZmZlci5hdWRpby51cGRhdGluZykgfHxcbiAgICAgICAgICAgICAodGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gJiYgdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8udXBkYXRpbmcpKSB7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NiIGFwcGVuZCBpbiBwcm9ncmVzcycpO1xuICAgICAgICAvLyBjaGVjayBpZiBhbnkgTVA0IHNlZ21lbnRzIGxlZnQgdG8gYXBwZW5kXG4gICAgICAgICAgfSBlbHNlIGlmKHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgc2VnbWVudCA9IHRoaXMubXA0c2VnbWVudHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHRoaXMuc291cmNlQnVmZmVyW3NlZ21lbnQudHlwZV0uYXBwZW5kQnVmZmVyKHNlZ21lbnQuZGF0YSk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gQVBQRU5ESU5HO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjay91cGRhdGUgZnJhZ21lbnQgcGxheWluZ1xuICAgIHRoaXMuX2NoZWNrRnJhZ21lbnRQbGF5aW5nKCk7XG4gIH1cblxuICAgYnVmZmVySW5mbyhwb3MpIHtcbiAgICB2YXIgdiA9IHRoaXMudmlkZW8sXG4gICAgICAgIGJ1ZmZlcmVkID0gdi5idWZmZXJlZCxcbiAgICAgICAgYnVmZmVyTGVuLFxuICAgICAgICAvLyBidWZmZXJTdGFydCBhbmQgYnVmZmVyRW5kIGFyZSBidWZmZXIgYm91bmRhcmllcyBhcm91bmQgY3VycmVudCB2aWRlbyBwb3NpdGlvblxuICAgICAgICBidWZmZXJTdGFydCxidWZmZXJFbmQsXG4gICAgICAgIGk7XG4gICAgdmFyIGJ1ZmZlcmVkMiA9IFtdO1xuICAgIC8vIHRoZXJlIG1pZ2h0IGJlIHNvbWUgc21hbGwgaG9sZXMgYmV0d2VlbiBidWZmZXIgdGltZSByYW5nZVxuICAgIC8vIGNvbnNpZGVyIHRoYXQgaG9sZXMgc21hbGxlciB0aGFuIDMwMCBtcyBhcmUgaXJyZWxldmFudCBhbmQgYnVpbGQgYW5vdGhlclxuICAgIC8vIGJ1ZmZlciB0aW1lIHJhbmdlIHJlcHJlc2VudGF0aW9ucyB0aGF0IGRpc2NhcmRzIHRob3NlIGhvbGVzXG4gICAgZm9yKGkgPSAwIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgLy9sb2dnZXIubG9nKCdidWYgc3RhcnQvZW5kOicgKyBidWZmZXJlZC5zdGFydChpKSArICcvJyArIGJ1ZmZlcmVkLmVuZChpKSk7XG4gICAgICBpZigoYnVmZmVyZWQyLmxlbmd0aCkgJiYgKGJ1ZmZlcmVkLnN0YXJ0KGkpIC0gYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kICkgPCAwLjMpIHtcbiAgICAgICAgYnVmZmVyZWQyW2J1ZmZlcmVkMi5sZW5ndGgtMV0uZW5kID0gYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyZWQyLnB1c2goe3N0YXJ0IDogYnVmZmVyZWQuc3RhcnQoaSksZW5kIDogYnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yKGkgPSAwLCBidWZmZXJMZW4gPSAwLCBidWZmZXJTdGFydCA9IGJ1ZmZlckVuZCA9IHBvcyA7IGkgPCBidWZmZXJlZDIubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmKChwb3MrMC4zKSA+PSBidWZmZXJlZDJbaV0uc3RhcnQgJiYgcG9zIDwgYnVmZmVyZWQyW2ldLmVuZCkge1xuICAgICAgICAvLyBwbGF5IHBvc2l0aW9uIGlzIGluc2lkZSB0aGlzIGJ1ZmZlciBUaW1lUmFuZ2UsIHJldHJpZXZlIGVuZCBvZiBidWZmZXIgcG9zaXRpb24gYW5kIGJ1ZmZlciBsZW5ndGhcbiAgICAgICAgYnVmZmVyU3RhcnQgPSBidWZmZXJlZDJbaV0uc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQgKyAwLjM7XG4gICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtsZW4gOiBidWZmZXJMZW4sIHN0YXJ0IDogYnVmZmVyU3RhcnQsIGVuZCA6IGJ1ZmZlckVuZH07XG4gIH1cblxuXG4gIGdldEZyYWdtZW50KHBvc2l0aW9uKSB7XG4gICAgdmFyIGkscmFuZ2U7XG4gICAgZm9yIChpID0gdGhpcy5idWZmZXJSYW5nZS5sZW5ndGgtMTsgaSA+PTAgOyBpLS0pIHtcbiAgICAgIHJhbmdlID0gdGhpcy5idWZmZXJSYW5nZVtpXTtcbiAgICAgIGlmKHBvc2l0aW9uID49IHJhbmdlLnN0YXJ0ICYmIHBvc2l0aW9uIDw9IHJhbmdlLmVuZCkge1xuICAgICAgICByZXR1cm4gcmFuZ2UuZnJhZztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuXG4gIGdldCBwbGF5YmFja0xldmVsKCkge1xuICAgIHZhciBmcmFnID0gdGhpcy5nZXRGcmFnbWVudCh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKTtcbiAgICBpZihmcmFnKSB7XG4gICAgICByZXR1cm4gZnJhZy5sZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgfVxuXG4gIGlzQnVmZmVyZWQocG9zaXRpb24pIHtcbiAgICB2YXIgdiA9IHRoaXMudmlkZW8sYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkO1xuICAgIGZvcih2YXIgaSA9IDAgOyBpIDwgYnVmZmVyZWQubGVuZ3RoIDsgaSsrKSB7XG4gICAgICBpZihwb3NpdGlvbiA+PSBidWZmZXJlZC5zdGFydChpKSAmJiBwb3NpdGlvbiA8PSBidWZmZXJlZC5lbmQoaSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIF9jaGVja0ZyYWdtZW50UGxheWluZygpIHtcbiAgICB2YXIgZnJhZ1BsYXlpbmc7XG4gICAgaWYodGhpcy52aWRlbyAmJiB0aGlzLnZpZGVvLnNlZWtpbmcgPT09IGZhbHNlICYmIHRoaXMuaXNCdWZmZXJlZCh0aGlzLnZpZGVvLmN1cnJlbnRUaW1lKSkge1xuICAgICAgZnJhZ1BsYXlpbmcgPSB0aGlzLmdldEZyYWdtZW50KHRoaXMudmlkZW8uY3VycmVudFRpbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmcmFnUGxheWluZyA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYoZnJhZ1BsYXlpbmcgIT09IHRoaXMuZnJhZ1BsYXlpbmcpIHtcbiAgICAgIHRoaXMuZnJhZ1BsYXlpbmcgPSBmcmFnUGxheWluZztcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QTEFZSU5HLCB7IGZyYWcgOiBmcmFnUGxheWluZyB9KTtcbiAgICB9XG4gIH1cblxuLypcbiAgZmx1c2hCdWZmZXIoKSB7XG4gICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgaWYoc2IpIHtcbiAgICAgIGlmKHNiLmF1ZGlvKSB7XG4gICAgICAgIHNiLmF1ZGlvLnJlbW92ZSgwLDk5OTkpO1xuICAgICAgfVxuICAgICAgaWYoc2IudmlkZW8pIHtcbiAgICAgICAgc2IudmlkZW8ucmVtb3ZlKDAsOTk5OSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyUmFuZ2UgPSB7fTtcbiAgfVxuKi9cblxuICBvbk1TRUF0dGFjaGVkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLnZpZGVvID0gZGF0YS52aWRlbztcbiAgICB0aGlzLm1lZGlhU291cmNlID0gZGF0YS5tZWRpYVNvdXJjZTtcbiAgICB0aGlzLm9udnNlZWtpbmcgPSB0aGlzLm9uVmlkZW9TZWVraW5nLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZzZWVrZWQgPSB0aGlzLm9uVmlkZW9TZWVrZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udm1ldGFkYXRhID0gdGhpcy5vblZpZGVvTWV0YWRhdGEuYmluZCh0aGlzKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLHRoaXMub252c2Vla2luZyk7XG4gICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLHRoaXMub252c2Vla2VkKTtcbiAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJyx0aGlzLm9udm1ldGFkYXRhKTtcbiAgICBpZih0aGlzLmxldmVscykge1xuICAgICAgdGhpcy5zdGFydCgpO1xuICAgIH1cbiAgfVxuICBvblZpZGVvU2Vla2luZygpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSBMT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYodGhpcy5idWZmZXJJbmZvKHRoaXMudmlkZW8uY3VycmVudFRpbWUpLmxlbiA9PT0gMCkge1xuICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgdGhpcy5mcmFnbWVudExvYWRlci5hYm9ydCgpO1xuICAgICAgdGhpcy5zdGF0ZSA9IElETEU7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgcHJvY2Vzc2luZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25WaWRlb1NlZWtlZCgpIHtcbiAgICAvLyB0aWNrIHRvIHNwZWVkIHVwIEZSQUdNRU5UX1BMQVlJTkcgdHJpZ2dlcmluZ1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25WaWRlb01ldGFkYXRhKCkge1xuICAgICAgaWYodGhpcy52aWRlby5jdXJyZW50VGltZSAhPT0gdGhpcy5zdGFydFBvc2l0aW9uKSB7XG4gICAgICAgIHRoaXMudmlkZW8uY3VycmVudFRpbWUgPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChldmVudCxkYXRhKSB7XG4gICAgdGhpcy5hdWRpb2NvZGVjc3dpdGNoID0gZGF0YS5hdWRpb2NvZGVjc3dpdGNoO1xuICAgIGlmKHRoaXMuYXVkaW9jb2RlY3N3aXRjaCkge1xuICAgICAgbG9nZ2VyLmxvZygnYm90aCBBQUMvSEUtQUFDIGF1ZGlvIGZvdW5kIGluIGxldmVsczsgZGVjbGFyaW5nIGF1ZGlvIGNvZGVjIGFzIEhFLUFBQycpO1xuICAgIH1cbiAgICB0aGlzLmxldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMuc3RhcnRGcmFnbWVudExvYWRlZCA9IGZhbHNlO1xuICAgIGlmKHRoaXMudmlkZW8pIHtcbiAgICAgIHRoaXMuc3RhcnQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgZnJhZ21lbnRzID0gZGF0YS5kZXRhaWxzLmZyYWdtZW50cyxkdXJhdGlvbiA9IGRhdGEuZGV0YWlscy50b3RhbGR1cmF0aW9uO1xuICAgIGxvZ2dlci5sb2coJ2xldmVsICcgKyBkYXRhLmxldmVsSWQgKyAnIGxvYWRlZCBbJyArIGZyYWdtZW50c1swXS5zbiArICcsJyArIGZyYWdtZW50c1tmcmFnbWVudHMubGVuZ3RoLTFdLnNuICsgJ10sZHVyYXRpb246JyArIGR1cmF0aW9uKTtcblxuICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW2RhdGEubGV2ZWxJZF0sc2xpZGluZyA9IDAsIGxldmVsQ3VycmVudCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdO1xuICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkIChpZiB5ZXMsIGl0IHNob3VsZCBiZSBhIGxpdmUgcGxheWxpc3QpXG4gICAgaWYobGV2ZWxDdXJyZW50ICYmIGxldmVsQ3VycmVudC5kZXRhaWxzICYmIGxldmVsQ3VycmVudC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgIC8vICBwbGF5bGlzdCBzbGlkaW5nIGlzIHRoZSBzdW0gb2YgOiBjdXJyZW50IHBsYXlsaXN0IHNsaWRpbmcgKyBzbGlkaW5nIG9mIG5ldyBwbGF5bGlzdCBjb21wYXJlZCB0byBjdXJyZW50IG9uZVxuICAgICAgc2xpZGluZyA9IGxldmVsQ3VycmVudC5kZXRhaWxzLnNsaWRpbmc7XG4gICAgICAvLyBjaGVjayBzbGlkaW5nIG9mIHVwZGF0ZWQgcGxheWxpc3QgYWdhaW5zdCBjdXJyZW50IG9uZSA6XG4gICAgICAvLyBhbmQgZmluZCBpdHMgcG9zaXRpb24gaW4gY3VycmVudCBwbGF5bGlzdFxuICAgICAgLy9sb2dnZXIubG9nKFwiZnJhZ21lbnRzWzBdLnNuL3RoaXMubGV2ZWwvbGV2ZWxDdXJyZW50LmRldGFpbHMuZnJhZ21lbnRzWzBdLnNuOlwiICsgZnJhZ21lbnRzWzBdLnNuICsgXCIvXCIgKyB0aGlzLmxldmVsICsgXCIvXCIgKyBsZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbMF0uc24pO1xuICAgICAgdmFyIFNOZGlmZiA9IGZyYWdtZW50c1swXS5zbiAtIGxldmVsQ3VycmVudC5kZXRhaWxzLmZyYWdtZW50c1swXS5zbjtcbiAgICAgIGlmKFNOZGlmZiA+PTApIHtcbiAgICAgICAgLy8gcG9zaXRpdmUgc2xpZGluZyA6IG5ldyBwbGF5bGlzdCBzbGlkaW5nIHdpbmRvdyBpcyBhZnRlciBwcmV2aW91cyBvbmVcbiAgICAgICAgc2xpZGluZyArPSBsZXZlbEN1cnJlbnQuZGV0YWlscy5mcmFnbWVudHNbU05kaWZmXS5zdGFydDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5lZ2F0aXZlIHNsaWRpbmc6IG5ldyBwbGF5bGlzdCBzbGlkaW5nIHdpbmRvdyBpcyBiZWZvcmUgcHJldmlvdXMgb25lXG4gICAgICAgIHNsaWRpbmcgLT0gZnJhZ21lbnRzWy1TTmRpZmZdLnN0YXJ0O1xuICAgICAgfVxuICAgICAgbG9nZ2VyLmxvZygnbGl2ZSBwbGF5bGlzdCBzbGlkaW5nOicgKyBzbGlkaW5nLnRvRml4ZWQoMykpO1xuICAgIH1cbiAgICAvLyBvdmVycmlkZSBsZXZlbCBpbmZvXG4gICAgbGV2ZWwuZGV0YWlscyA9IGRhdGEuZGV0YWlscztcbiAgICBsZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBzbGlkaW5nO1xuICAgIHRoaXMuZGVtdXhlci5zZXREdXJhdGlvbihkdXJhdGlvbik7XG4gICAgaWYodGhpcy5zdGFydExldmVsTG9hZGVkID09PSBmYWxzZSkge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgc2V0IHN0YXJ0IHBvc2l0aW9uIHRvIGJlIGZyYWdtZW50IE4tM1xuICAgICAgaWYoZGF0YS5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCxkdXJhdGlvbiAtIDMgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gMDtcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgICAgIHRoaXMuc3RhcnRMZXZlbExvYWRlZCA9IHRydWU7XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmKHRoaXMuc3RhdGUgPT09IFdBSVRJTkdfTEVWRUwpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBJRExFO1xuICAgIH1cbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICB0aGlzLnRpY2soKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IExPQURJTkcpIHtcbiAgICAgIGlmKHRoaXMuZnJhZ21lbnRCaXRyYXRlVGVzdCA9PT0gdHJ1ZSkge1xuICAgICAgICAvLyBzd2l0Y2ggYmFjayB0byBJRExFIHN0YXRlIC4uLiB3ZSBqdXN0IGxvYWRlZCBhIGZyYWdtZW50IHRvIGRldGVybWluZSBhZGVxdWF0ZSBzdGFydCBiaXRyYXRlIGFuZCBpbml0aWFsaXplIGF1dG9zd2l0Y2ggYWxnb1xuICAgICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICAgICAgdGhpcy5mcmFnbWVudEJpdHJhdGVUZXN0ID0gZmFsc2U7XG4gICAgICAgIGRhdGEuc3RhdHMudHBhcnNlZCA9IGRhdGEuc3RhdHMudGJ1ZmZlcmVkID0gbmV3IERhdGUoKTtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0JVRkZFUkVELCB7IHN0YXRzIDogZGF0YS5zdGF0cywgZnJhZyA6IHRoaXMuZnJhZ30pO1xuICAgICAgICB0aGlzLmZyYWcgPSBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHRoaXMuZGVtdXhlci5wdXNoKGRhdGEucGF5bG9hZCx0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnZpZGVvQ29kZWMsdGhpcy5mcmFnLnN0YXJ0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RhcnRGcmFnbWVudExvYWRlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgb25Jbml0U2VnbWVudChldmVudCxkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY29kZWNzIGhhdmUgYmVlbiBleHBsaWNpdGVseSBkZWZpbmVkIGluIHRoZSBtYXN0ZXIgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWw7XG4gICAgLy8gaWYgeWVzIHVzZSB0aGVzZSBvbmVzIGluc3RlYWQgb2YgdGhlIG9uZXMgcGFyc2VkIGZyb20gdGhlIGRlbXV4XG4gICAgdmFyIGF1ZGlvQ29kZWMgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS5hdWRpb0NvZGVjLCB2aWRlb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYyxzYjtcbiAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGxldmVsIEEvViBjb2RlY3M6JyArIGF1ZGlvQ29kZWMgKyAnLCcgKyB2aWRlb0NvZGVjKTtcbiAgICAvL2xvZ2dlci5sb2coJ3BsYXlsaXN0IGNvZGVjczonICsgY29kZWMpO1xuICAgIC8vIGlmIHBsYXlsaXN0IGRvZXMgbm90IHNwZWNpZnkgY29kZWNzLCB1c2UgY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnRcbiAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgfVxuICAgIGlmKHZpZGVvQ29kZWMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICB9XG5cbiAgICAvLyBjb2RlYz1cIm1wNGEuNDAuNSxhdmMxLjQyMDAxNlwiO1xuICAgIC8vIGluIGNhc2Ugc2V2ZXJhbCBhdWRpbyBjb2RlY3MgbWlnaHQgYmUgdXNlZCwgZm9yY2UgSEUtQUFDIGZvciBhdWRpbyAoc29tZSBicm93c2VycyBkb24ndCBzdXBwb3J0IGF1ZGlvIGNvZGVjIHN3aXRjaClcbiAgICAvL2Rvbid0IGRvIGl0IGZvciBtb25vIHN0cmVhbXMgLi4uXG4gICAgaWYodGhpcy5hdWRpb2NvZGVjc3dpdGNoICYmIGRhdGEuYXVkaW9DaGFubmVsQ291bnQgPT09IDIgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2ZpcmVmb3gnKSA9PT0gLTEpIHtcbiAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICB9XG4gICAgaWYoIXRoaXMuc291cmNlQnVmZmVyKSB7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHt9O1xuICAgICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgICAgbG9nZ2VyLmxvZygnc2VsZWN0ZWQgQS9WIGNvZGVjcyBmb3Igc291cmNlQnVmZmVyczonICsgYXVkaW9Db2RlYyArICcsJyArIHZpZGVvQ29kZWMpO1xuICAgICAgLy8gY3JlYXRlIHNvdXJjZSBCdWZmZXIgYW5kIGxpbmsgdGhlbSB0byBNZWRpYVNvdXJjZVxuICAgICAgaWYoYXVkaW9Db2RlYykge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyLmF1ZGlvID0gdGhpcy5tZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoJ3ZpZGVvL21wNDtjb2RlY3M9JyArIGF1ZGlvQ29kZWMpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICAgIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIudmlkZW8gPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcigndmlkZW8vbXA0O2NvZGVjcz0nICsgdmlkZW9Db2RlYyk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICAgICAgc2IuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYoYXVkaW9Db2RlYykge1xuICAgICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKHsgdHlwZSA6ICdhdWRpbycsIGRhdGEgOiBkYXRhLmF1ZGlvTW9vdn0pO1xuICAgIH1cbiAgICBpZih2aWRlb0NvZGVjKSB7XG4gICAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogJ3ZpZGVvJywgZGF0YSA6IGRhdGEudmlkZW9Nb292fSk7XG4gICAgfVxuICAgIC8vdHJpZ2dlciBoYW5kbGVyIHJpZ2h0IG5vd1xuICAgIHRoaXMudGljaygpO1xuICB9XG5cbiAgb25GcmFnbWVudFBhcnNpbmcoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMudHBhcnNlMiA9IERhdGUubm93KCk7XG4gICAgdmFyIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgaWYobGV2ZWwuZGV0YWlscy5saXZlKSB7XG4gICAgICBsZXZlbC5kZXRhaWxzLnNsaWRpbmcgPSBkYXRhLnN0YXJ0UFRTIC0gdGhpcy5mcmFnLnN0YXJ0O1xuICAgIH1cbiAgICBsb2dnZXIubG9nKCcgICAgICBwYXJzZWQgZGF0YSwgdHlwZS9zdGFydFBUUy9lbmRQVFMvc3RhcnREVFMvZW5kRFRTL3NsaWRpbmc6JyArIGRhdGEudHlwZSArICcvJyArIGRhdGEuc3RhcnRQVFMudG9GaXhlZCgzKSArICcvJyArIGRhdGEuZW5kUFRTLnRvRml4ZWQoMykgKyAnLycgKyBkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMykgKyAnLycgKyBkYXRhLmVuZERUUy50b0ZpeGVkKDMpICsgJy8nICsgbGV2ZWwuZGV0YWlscy5zbGlkaW5nLnRvRml4ZWQoMykpO1xuICAgIHRoaXMubXA0c2VnbWVudHMucHVzaCh7IHR5cGUgOiBkYXRhLnR5cGUsIGRhdGEgOiBkYXRhLm1vb2Z9KTtcbiAgICB0aGlzLm1wNHNlZ21lbnRzLnB1c2goeyB0eXBlIDogZGF0YS50eXBlLCBkYXRhIDogZGF0YS5tZGF0fSk7XG4gICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgdGhpcy5idWZmZXJSYW5nZS5wdXNoKHt0eXBlIDogZGF0YS50eXBlLCBzdGFydCA6IGRhdGEuc3RhcnRQVFMsIGVuZCA6IGRhdGEuZW5kUFRTLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkZyYWdtZW50UGFyc2VkKCkge1xuICAgICAgdGhpcy5zdGF0ZSA9IFBBUlNFRDtcbiAgICAgIHRoaXMuc3RhdHMudHBhcnNlZCA9IG5ldyBEYXRlKCk7XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZih0aGlzLnN0YXRlID09PSBBUFBFTkRJTkcgJiYgdGhpcy5tcDRzZWdtZW50cy5sZW5ndGggPT09IDApICB7XG4gICAgICB0aGlzLnN0YXRzLnRidWZmZXJlZCA9IG5ldyBEYXRlKCk7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfQlVGRkVSRUQsIHsgc3RhdHMgOiB0aGlzLnN0YXRzLCBmcmFnIDogdGhpcy5mcmFnfSk7XG4gICAgICB0aGlzLnN0YXRlID0gSURMRTtcbiAgICB9XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlckVycm9yKGV2ZW50KSB7XG4gICAgICBsb2dnZXIubG9nKCcgYnVmZmVyIGFwcGVuZCBlcnJvcjonICsgZXZlbnQpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckNvbnRyb2xsZXI7XG4iLCIvKlxuICogbGV2ZWwgY29udHJvbGxlclxuICpcbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG4gY2xhc3MgTGV2ZWxDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3RvcihwbGF5bGlzdExvYWRlcikge1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBwbGF5bGlzdExvYWRlcjtcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uZmwgPSB0aGlzLm9uRnJhZ21lbnRMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubGwgPSB0aGlzLm9uTGV2ZWxMb2FkZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gICAgLy90aGlzLnN0YXJ0TGV2ZWwgPSBzdGFydExldmVsO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR19MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIGlmKHRoaXMudGltZXIpIHtcbiAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSAtMTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHZhciBsZXZlbHMgPSBbXSxiaXRyYXRlU3RhcnQsaSxiaXRyYXRlU2V0PXt9LCBhYWM9ZmFsc2UsIGhlYWFjPWZhbHNlLGNvZGVjcztcbiAgICAvLyByZW1vdmUgZmFpbG92ZXIgbGV2ZWwgZm9yIG5vdyB0byBzaW1wbGlmeSB0aGUgbG9naWNcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIGlmKCFiaXRyYXRlU2V0Lmhhc093blByb3BlcnR5KGxldmVsLmJpdHJhdGUpKSB7XG4gICAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgICAgYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXSA9IHRydWU7XG4gICAgICB9XG4gICAgICAvLyBkZXRlY3QgaWYgd2UgaGF2ZSBkaWZmZXJlbnQga2luZCBvZiBhdWRpbyBjb2RlY3MgdXNlZCBhbW9uZ3N0IHBsYXlsaXN0c1xuICAgICAgY29kZWNzID0gbGV2ZWwuY29kZWNzO1xuICAgICAgaWYoY29kZWNzKSB7XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEpIHtcbiAgICAgICAgICBhYWMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKGNvZGVjcy5pbmRleE9mKCdtcDRhLjQwLjUnKSAhPT0gLTEpIHtcbiAgICAgICAgICBoZWFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBzdGFydCBiaXRyYXRlIGlzIHRoZSBmaXJzdCBiaXRyYXRlIG9mIHRoZSBtYW5pZmVzdFxuICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgIC8vIHNvcnQgbGV2ZWwgb24gYml0cmF0ZVxuICAgIGxldmVscy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYS5iaXRyYXRlLWIuYml0cmF0ZTtcbiAgICB9KTtcbiAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG5cbiAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICBmb3IoaT0wOyBpIDwgbGV2ZWxzLmxlbmd0aCA7IGkrKykge1xuICAgICAgaWYobGV2ZWxzW2ldLmJpdHJhdGUgPT09IGJpdHJhdGVTdGFydCkge1xuICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgbG9nZ2VyLmxvZygnbWFuaWZlc3QgbG9hZGVkLCcgKyBsZXZlbHMubGVuZ3RoICsgJyBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZTonICsgYml0cmF0ZVN0YXJ0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy90aGlzLl9zdGFydExldmVsID0gLTE7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5fbGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0TGV2ZWwgOiB0aGlzLl9zdGFydExldmVsLFxuICAgICAgICAgICAgICAgICAgICAgIGF1ZGlvY29kZWNzd2l0Y2ggOiAoYWFjICYmIGhlYWFjKVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBnZXQgbGV2ZWxzKCkge1xuICAgIHJldHVybiB0aGlzLl9sZXZlbHM7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsKSB7XG4gICAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICAgIGlmKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLl9sZXZlbHMubGVuZ3RoKSB7XG4gICAgICAgIC8vIHN0b3BwaW5nIGxpdmUgcmVsb2FkaW5nIHRpbWVyIGlmIGFueVxuICAgICAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgICAgbG9nZ2VyLmxvZygnc3dpdGNoaW5nIHRvIGxldmVsICcgKyBuZXdMZXZlbCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfU1dJVENILCB7IGxldmVsSWQgOiBuZXdMZXZlbH0pO1xuICAgICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbmV3TGV2ZWxdO1xuICAgICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIGxldmVsXG4gICAgICAgIGlmKGxldmVsLmxvYWRpbmcgPT09IHVuZGVmaW5lZCB8fCAobGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUgPT09IHRydWUpKSB7XG4gICAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIG9yIGxpdmUgcGxheWxpc3Qgd2UgbmVlZCB0byAocmUpbG9hZCBpdFxuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyBsZXZlbElkIDogbmV3TGV2ZWx9KTtcbiAgICAgICAgICBsb2dnZXIubG9nKCcocmUpbG9hZGluZyBwbGF5bGlzdCBmb3IgbGV2ZWwgJyArIG5ld0xldmVsKTtcbiAgICAgICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmxvYWQobGV2ZWwudXJsLG5ld0xldmVsKTtcbiAgICAgICAgICBsZXZlbC5sb2FkaW5nID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0VSUk9SLCB7IGxldmVsIDogbmV3TGV2ZWwsIGV2ZW50OiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgfVxuXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5fZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgaWYodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB2YXIgc3RhdHMscnR0LGxvYWR0aW1lO1xuICAgIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBydHQgPSBzdGF0cy50Zmlyc3QgLSBzdGF0cy50cmVxdWVzdDtcbiAgICBsb2FkdGltZSA9IHN0YXRzLnRsb2FkIC0gc3RhdHMudHJlcXVlc3Q7XG4gICAgdGhpcy5sYXN0YncgPSBzdGF0cy5sZW5ndGgqODAwMC9sb2FkdGltZTtcbiAgfVxuXG5cbiAgb25MZXZlbExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgLy8gY2hlY2sgaWYgY3VycmVudCBwbGF5bGlzdCBpcyBhIGxpdmUgcGxheWxpc3RcbiAgICBpZihkYXRhLmRldGFpbHMubGl2ZSAmJiAhdGhpcy50aW1lcikge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCB3ZSB3aWxsIGhhdmUgdG8gcmVsb2FkIGl0IHBlcmlvZGljYWxseVxuICAgICAgLy8gc2V0IHJlbG9hZCBwZXJpb2QgdG8gcGxheWxpc3QgdGFyZ2V0IGR1cmF0aW9uXG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMDAqZGF0YS5kZXRhaWxzLnRhcmdldGR1cmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICB0aWNrKCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyBsZXZlbElkIDogdGhpcy5fbGV2ZWx9KTtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmxvYWQodGhpcy5fbGV2ZWxzW3RoaXMuX2xldmVsXS51cmwsdGhpcy5fbGV2ZWwpO1xuICB9XG5cbiAgbmV4dExldmVsKCkge1xuICAgIGlmKHRoaXMuX21hbnVhbExldmVsICE9PSAtMSkge1xuICAgICAgcmV0dXJuIHRoaXMuX21hbnVhbExldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgIHJldHVybiB0aGlzLm5leHRBdXRvTGV2ZWwoKTtcbiAgICB9XG4gIH1cblxuICBuZXh0QXV0b0xldmVsKCkge1xuICAgIHZhciBsYXN0YncgPSB0aGlzLmxhc3RidyxhZGp1c3RlZGJ3LGksbWF4QXV0b0xldmVsO1xuICAgIGlmKHRoaXMuX2F1dG9MZXZlbENhcHBpbmcgPT09IC0xKSB7XG4gICAgICBtYXhBdXRvTGV2ZWwgPSB0aGlzLl9sZXZlbHMubGVuZ3RoLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IHRoaXMuX2F1dG9MZXZlbENhcHBpbmc7XG4gICAgfVxuICAgIC8vIGZvbGxvdyBhbGdvcml0aG0gY2FwdHVyZWQgZnJvbSBzdGFnZWZyaWdodCA6XG4gICAgLy8gaHR0cHM6Ly9hbmRyb2lkLmdvb2dsZXNvdXJjZS5jb20vcGxhdGZvcm0vZnJhbWV3b3Jrcy9hdi8rL21hc3Rlci9tZWRpYS9saWJzdGFnZWZyaWdodC9odHRwbGl2ZS9MaXZlU2Vzc2lvbi5jcHBcbiAgICAvLyBQaWNrIHRoZSBoaWdoZXN0IGJhbmR3aWR0aCBzdHJlYW0gYmVsb3cgb3IgZXF1YWwgdG8gZXN0aW1hdGVkIGJhbmR3aWR0aC5cbiAgICBmb3IoaSA9MDsgaSA8PSBtYXhBdXRvTGV2ZWwgOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmKGkgPD0gdGhpcy5fbGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCpsYXN0Ync7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGp1c3RlZGJ3ID0gMC43Kmxhc3RidztcbiAgICAgIH1cbiAgICAgIGlmKGFkanVzdGVkYncgPCB0aGlzLl9sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCxpLTEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaS0xO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IExldmVsQ29udHJvbGxlcjtcbiIsIiBpbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgVFNEZW11eGVyICAgICAgICAgICAgZnJvbSAnLi90c2RlbXV4ZXInO1xuIGltcG9ydCBUU0RlbXV4ZXJXb3JrZXIgICAgICBmcm9tICcuL3RzZGVtdXhlcndvcmtlcic7XG4gaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuXG5jbGFzcyBEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB2YXIgZW5hYmxlV29ya2VyID0gdHJ1ZTtcbiAgICBpZihlbmFibGVXb3JrZXIgJiYgKHR5cGVvZihXb3JrZXIpICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgIGxvZ2dlci5sb2coJ1RTIGRlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgdmFyIHdvcmsgPSByZXF1aXJlKCd3ZWJ3b3JraWZ5Jyk7XG4gICAgICB0aGlzLncgPSB3b3JrKFRTRGVtdXhlcldvcmtlcik7XG4gICAgICB0aGlzLm9ud21zZyA9IHRoaXMub25Xb3JrZXJNZXNzYWdlLmJpbmQodGhpcyk7XG4gICAgICB0aGlzLncuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMub253bXNnKTtcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdpbml0J30pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgfVxuICAgIHRoaXMuZGVtdXhJbml0aWFsaXplZCA9IHRydWU7XG4gIH1cblxuICBzZXREdXJhdGlvbihuZXdEdXJhdGlvbikge1xuICAgIGlmKHRoaXMudykge1xuICAgICAgLy8gcG9zdCBmcmFnbWVudCBwYXlsb2FkIGFzIHRyYW5zZmVyYWJsZSBvYmplY3RzIChubyBjb3B5KVxuICAgICAgdGhpcy53LnBvc3RNZXNzYWdlKHsgY21kIDogJ2R1cmF0aW9uJyAsIGRhdGEgOiBuZXdEdXJhdGlvbn0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuc2V0RHVyYXRpb24obmV3RHVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICB0aGlzLncucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsdGhpcy5vbndtc2cpO1xuICAgICAgdGhpcy53LnRlcm1pbmF0ZSgpO1xuICAgICAgdGhpcy53ID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQpIHtcbiAgICBpZih0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7IGNtZCA6ICdkZW11eCcgLCBkYXRhIDogZGF0YSwgYXVkaW9Db2RlYyA6IGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWM6IHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQgOiB0aW1lT2Zmc2V0fSxbZGF0YV0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCk7XG4gICAgICB0aGlzLmRlbXV4ZXIuZW5kKCk7XG4gICAgfVxuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgaWYodGhpcy53KSB7XG4gICAgICAvLyBwb3N0IGZyYWdtZW50IHBheWxvYWQgYXMgdHJhbnNmZXJhYmxlIG9iamVjdHMgKG5vIGNvcHkpXG4gICAgICB0aGlzLncucG9zdE1lc3NhZ2UoeyBjbWQgOiAnc3dpdGNoTGV2ZWwnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uV29ya2VyTWVzc2FnZShldikge1xuICAgIC8vY29uc29sZS5sb2coJ29uV29ya2VyTWVzc2FnZTonICsgZXYuZGF0YS5ldmVudCk7XG4gICAgc3dpdGNoKGV2LmRhdGEuZXZlbnQpIHtcbiAgICAgIGNhc2UgRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDpcbiAgICAgICAgdmFyIG9iaiA9IHt9O1xuICAgICAgICBpZihldi5kYXRhLmF1ZGlvTW9vdikge1xuICAgICAgICAgIG9iai5hdWRpb01vb3YgPSBuZXcgVWludDhBcnJheShldi5kYXRhLmF1ZGlvTW9vdik7XG4gICAgICAgICAgb2JqLmF1ZGlvQ29kZWMgPSBldi5kYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgICAgb2JqLmF1ZGlvQ2hhbm5lbENvdW50ID0gZXYuZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGV2LmRhdGEudmlkZW9Nb292KSB7XG4gICAgICAgICAgb2JqLnZpZGVvTW9vdiA9IG5ldyBVaW50OEFycmF5KGV2LmRhdGEudmlkZW9Nb292KTtcbiAgICAgICAgICBvYmoudmlkZW9Db2RlYyA9IGV2LmRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgICBvYmoudmlkZW9XaWR0aCA9IGV2LmRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgICBvYmoudmlkZW9IZWlnaHQgPSBldi5kYXRhLnZpZGVvSGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgb2JqKTtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgbW9vZiA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubW9vZiksXG4gICAgICAgICAgbWRhdCA6IG5ldyBVaW50OEFycmF5KGV2LmRhdGEubWRhdCksXG4gICAgICAgICAgc3RhcnRQVFMgOiBldi5kYXRhLnN0YXJ0UFRTLFxuICAgICAgICAgIGVuZFBUUyA6IGV2LmRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTIDogZXYuZGF0YS5zdGFydERUUyxcbiAgICAgICAgICBlbmREVFMgOiBldi5kYXRhLmVuZERUUyxcbiAgICAgICAgICB0eXBlIDogZXYuZGF0YS50eXBlXG4gICAgICAgIH0pO1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEV2ZW50LkZSQUdfUEFSU0VEOlxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0VEKTtcbiAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRGVtdXhlcjtcbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nXG4gKiBzY2hlbWUgdXNlZCBieSBoMjY0LlxuICovXG5cbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3Rvcih3b3JraW5nRGF0YSkge1xuICAgIHRoaXMud29ya2luZ0RhdGEgPSB3b3JraW5nRGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLndvcmtpbmdEYXRhXG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29ya2luZ1dvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy53b3JraW5nRGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUpO1xuXG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cblxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy53b3JraW5nRGF0YS5zdWJhcnJheShwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmtpbmdXb3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcblxuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy53b3JraW5nRGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH1cblxuICAvLyAoY291bnQ6aW50KTp2b2lkXG4gIHNraXBCaXRzKGNvdW50KSB7XG4gICAgdmFyIHNraXBCeXRlczsgLy8gOmludFxuICAgIGlmICh0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29ya2luZ1dvcmQgICAgICAgICAgPDw9IGNvdW50O1xuICAgICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSAtPSBjb3VudDtcbiAgICB9IGVsc2Uge1xuICAgICAgY291bnQgLT0gdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG5cbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgPj4gMyk7XG4gICAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG5cbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcblxuICAgICAgdGhpcy53b3JraW5nV29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JraW5nV29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG5cbiAgICBpZihzaXplID4zMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG5cbiAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuXG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExlYWRpbmdaZXJvcygpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwIDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JraW5nV29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JraW5nV29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVbnNpZ25lZEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFeHBHb2xvbWIoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVW5zaWduZWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExlYWRpbmdaZXJvcygpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRXhwR29sb21iKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVbnNpZ25lZEJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvKipcbiAgICogQWR2YW5jZSB0aGUgRXhwR29sb21iIGRlY29kZXIgcGFzdCBhIHNjYWxpbmcgbGlzdC4gVGhlIHNjYWxpbmdcbiAgICogbGlzdCBpcyBvcHRpb25hbGx5IHRyYW5zbWl0dGVkIGFzIHBhcnQgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXJcbiAgICogc2V0IGFuZCBpcyBub3QgcmVsZXZhbnQgdG8gdHJhbnNtdXhpbmcuXG4gICAqIEBwYXJhbSBjb3VudCB7bnVtYmVyfSB0aGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhpcyBzY2FsaW5nIGxpc3RcbiAgICogQHNlZSBSZWNvbW1lbmRhdGlvbiBJVFUtVCBILjI2NCwgU2VjdGlvbiA3LjMuMi4xLjEuMVxuICAgKi9cbiAgc2tpcFNjYWxpbmdMaXN0KGNvdW50KSB7XG4gICAgdmFyXG4gICAgICBsYXN0U2NhbGUgPSA4LFxuICAgICAgbmV4dFNjYWxlID0gOCxcbiAgICAgIGosXG4gICAgICBkZWx0YVNjYWxlO1xuXG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEV4cEdvbG9tYigpO1xuICAgICAgICBuZXh0U2NhbGUgPSAobGFzdFNjYWxlICsgZGVsdGFTY2FsZSArIDI1NikgJSAyNTY7XG4gICAgICB9XG5cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNlcXVlbmNlUGFyYW1ldGVyU2V0KCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdGliaWxpdHksbGV2ZWxJZGMsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuXG4gICAgdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7XG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVuc2lnbmVkQnl0ZSgpOyAvLyBwcm9maWxlX2lkY1xuICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7IC8vbGV2ZWxfaWRjIHUoOClcbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuXG4gICAgLy8gc29tZSBwcm9maWxlcyBoYXZlIG1vcmUgb3B0aW9uYWwgZGF0YSB3ZSBkb24ndCBuZWVkXG4gICAgaWYgKHByb2ZpbGVJZGMgPT09IDEwMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTIyIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDE0NCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcblxuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG5cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBwcm9maWxlSWRjIDogcHJvZmlsZUlkYyxcbiAgICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5IDogcHJvZmlsZUNvbXBhdGliaWxpdHksXG4gICAgICBsZXZlbElkYyA6IGxldmVsSWRjLFxuICAgICAgd2lkdGg6ICgocGljV2lkdGhJbk1ic01pbnVzMSArIDEpICogMTYpIC0gZnJhbWVDcm9wTGVmdE9mZnNldCAqIDIgLSBmcmFtZUNyb3BSaWdodE9mZnNldCAqIDIsXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtIChmcmFtZUNyb3BUb3BPZmZzZXQgKiAyKSAtIChmcmFtZUNyb3BCb3R0b21PZmZzZXQgKiAyKVxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXhwR29sb21iO1xuIiwiLyoqXG4gKiBBIHN0cmVhbS1iYXNlZCBtcDJ0cyB0byBtcDQgY29udmVydGVyLiBUaGlzIHV0aWxpdHkgaXMgdXNlZCB0b1xuICogZGVsaXZlciBtcDRzIHRvIGEgU291cmNlQnVmZmVyIG9uIHBsYXRmb3JtcyB0aGF0IHN1cHBvcnQgbmF0aXZlXG4gKiBNZWRpYSBTb3VyY2UgRXh0ZW5zaW9ucy5cbiAqL1xuXG4gaW1wb3J0IEV2ZW50ICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBFeHBHb2xvbWIgICAgICAgZnJvbSAnLi9leHAtZ29sb21iJztcbi8vIGltcG9ydCBIZXggICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvaGV4JztcbiBpbXBvcnQgTVA0ICAgICAgICAgICAgIGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuLy8gaW1wb3J0IE1QNEluc3BlY3QgICAgICBmcm9tICcuLi9yZW11eC9tcDQtaW5zcGVjdG9yJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbiBpbXBvcnQge2xvZ2dlcn0gICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBUU0RlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgfVxuXG4gIHNldER1cmF0aW9uKG5ld0R1cmF0aW9uKSB7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBuZXdEdXJhdGlvbjtcbiAgfVxuXG4gIHN3aXRjaExldmVsKCkge1xuICAgIHRoaXMucG10UGFyc2VkID0gZmFsc2U7XG4gICAgdGhpcy5fcG10SWQgPSB0aGlzLl9hdmNJZCA9IHRoaXMuX2FhY0lkID0gLTE7XG4gICAgdGhpcy5fYXZjVHJhY2sgPSB7dHlwZSA6ICd2aWRlbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7dHlwZSA6ICdhdWRpbycsIHNlcXVlbmNlTnVtYmVyIDogMH07XG4gICAgdGhpcy5fYXZjU2FtcGxlcyA9IFtdO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggPSAwO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgPSAwO1xuICAgIHRoaXMuX2FhY1NhbXBsZXMgPSBbXTtcbiAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gZmFsc2U7XG4gIH1cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSxhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLHRpbWVPZmZzZXQpIHtcbiAgICB0aGlzLmF1ZGlvQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgIHRoaXMudmlkZW9Db2RlYyA9IHZpZGVvQ29kZWM7XG4gICAgdGhpcy50aW1lT2Zmc2V0ID0gdGltZU9mZnNldDtcbiAgICB2YXIgb2Zmc2V0O1xuICAgIGZvcihvZmZzZXQgPSAwOyBvZmZzZXQgPCBkYXRhLmxlbmd0aCA7IG9mZnNldCArPSAxODgpIHtcbiAgICAgIHRoaXMuX3BhcnNlVFNQYWNrZXQoZGF0YSxvZmZzZXQpO1xuICAgIH1cbiAgfVxuICAvLyBmbHVzaCBhbnkgYnVmZmVyZWQgZGF0YVxuICBlbmQoKSB7XG4gICAgaWYodGhpcy5fYXZjRGF0YSkge1xuICAgICAgdGhpcy5fcGFyc2VBVkNQRVModGhpcy5fcGFyc2VQRVModGhpcy5fYXZjRGF0YSkpO1xuICAgICAgdGhpcy5fYXZjRGF0YSA9IG51bGw7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQVZDIHNhbXBsZXM6JyArIHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKTtcbiAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgdGhpcy5fZmx1c2hBVkNTYW1wbGVzKCk7XG4gICAgfVxuICAgIGlmKHRoaXMuX2FhY0RhdGEpIHtcbiAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2FhY0RhdGEpKTtcbiAgICAgIHRoaXMuX2FhY0RhdGEgPSBudWxsO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIEFBQyBzYW1wbGVzOicgKyB0aGlzLl9hYWNTYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYodGhpcy5fYWFjU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQUFDU2FtcGxlcygpO1xuICAgIH1cbiAgICAvL25vdGlmeSBlbmQgb2YgcGFyc2luZ1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VUU1BhY2tldChkYXRhLHN0YXJ0KSB7XG4gICAgdmFyIHN0dCxwaWQsYXRmLG9mZnNldDtcbiAgICBpZihkYXRhW3N0YXJ0XSA9PT0gMHg0Nykge1xuICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCsxXSAmIDB4NDApO1xuICAgICAgLy8gcGlkIGlzIGEgMTMtYml0IGZpZWxkIHN0YXJ0aW5nIGF0IHRoZSBsYXN0IGJpdCBvZiBUU1sxXVxuICAgICAgcGlkID0gKChkYXRhW3N0YXJ0KzFdICYgMHgxZikgPDwgOCkgKyBkYXRhW3N0YXJ0KzJdO1xuICAgICAgYXRmID0gKGRhdGFbc3RhcnQrM10gJiAweDMwKSA+PiA0O1xuICAgICAgLy8gaWYgYW4gYWRhcHRpb24gZmllbGQgaXMgcHJlc2VudCwgaXRzIGxlbmd0aCBpcyBzcGVjaWZpZWQgYnkgdGhlIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuXG4gICAgICBpZihhdGYgPiAxKSB7XG4gICAgICAgIG9mZnNldCA9IHN0YXJ0KzUrZGF0YVtzdGFydCs0XTtcbiAgICAgICAgLy8gcmV0dXJuIGlmIHRoZXJlIGlzIG9ubHkgYWRhcHRhdGlvbiBmaWVsZFxuICAgICAgICBpZihvZmZzZXQgPT09IChzdGFydCsxODgpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvZmZzZXQgPSBzdGFydCs0O1xuICAgICAgfVxuICAgICAgaWYodGhpcy5wbXRQYXJzZWQpIHtcbiAgICAgICAgaWYocGlkID09PSB0aGlzLl9hdmNJZCkge1xuICAgICAgICAgIGlmKHN0dCkge1xuICAgICAgICAgICAgaWYodGhpcy5fYXZjRGF0YSkge1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyh0aGlzLl9hdmNEYXRhKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9hdmNEYXRhID0ge2RhdGE6IFtdLHNpemU6IDB9O1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl9hdmNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCxzdGFydCsxODgpKTtcbiAgICAgICAgICB0aGlzLl9hdmNEYXRhLnNpemUrPXN0YXJ0KzE4OC1vZmZzZXQ7XG4gICAgICAgIH0gZWxzZSBpZihwaWQgPT09IHRoaXMuX2FhY0lkKSB7XG4gICAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgICBpZih0aGlzLl9hYWNEYXRhKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3BhcnNlQUFDUEVTKHRoaXMuX3BhcnNlUEVTKHRoaXMuX2FhY0RhdGEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2FhY0RhdGEgPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX2FhY0RhdGEuZGF0YS5wdXNoKGRhdGEuc3ViYXJyYXkob2Zmc2V0LHN0YXJ0KzE4OCkpO1xuICAgICAgICAgIHRoaXMuX2FhY0RhdGEuc2l6ZSs9c3RhcnQrMTg4LW9mZnNldDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYoc3R0KSB7XG4gICAgICAgICAgb2Zmc2V0ICs9IGRhdGFbb2Zmc2V0XSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYocGlkID09PSAwKSB7XG4gICAgICAgICAgdGhpcy5fcGFyc2VQQVQoZGF0YSxvZmZzZXQpO1xuICAgICAgICB9IGVsc2UgaWYocGlkID09PSB0aGlzLl9wbXRJZCkge1xuICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsb2Zmc2V0KTtcbiAgICAgICAgICB0aGlzLnBtdFBhcnNlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLmxvZygncGFyc2luZyBlcnJvcicpO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZVBBVChkYXRhLG9mZnNldCkge1xuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICB0aGlzLl9wbXRJZCAgPSAoZGF0YVtvZmZzZXQrMTBdICYgMHgxRikgPDwgOCB8IGRhdGFbb2Zmc2V0KzExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSxvZmZzZXQpIHtcbiAgICB2YXIgc2VjdGlvbkxlbmd0aCx0YWJsZUVuZCxwcm9ncmFtSW5mb0xlbmd0aCxwaWQ7XG4gICAgc2VjdGlvbkxlbmd0aCA9IChkYXRhW29mZnNldCsxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCsyXTtcbiAgICB0YWJsZUVuZCA9IG9mZnNldCArIDMgKyBzZWN0aW9uTGVuZ3RoIC0gNDtcbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKGRhdGFbb2Zmc2V0KzEwXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCsxMV07XG5cbiAgICAvLyBhZHZhbmNlIHRoZSBvZmZzZXQgdG8gdGhlIGZpcnN0IGVudHJ5IGluIHRoZSBtYXBwaW5nIHRhYmxlXG4gICAgb2Zmc2V0ICs9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICBwaWQgPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgICAgc3dpdGNoKGRhdGFbb2Zmc2V0XSkge1xuICAgICAgICAvLyBJU08vSUVDIDEzODE4LTcgQURUUyBBQUMgKE1QRUctMiBsb3dlciBiaXQtcmF0ZSBhdWRpbylcbiAgICAgICAgY2FzZSAweDBmOlxuICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY0lkID0gcGlkO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICBicmVhaztcbiAgICAgICAgLy8gSVRVLVQgUmVjLiBILjI2NCBhbmQgSVNPL0lFQyAxNDQ5Ni0xMCAobG93ZXIgYml0LXJhdGUgdmlkZW8pXG4gICAgICAgIGNhc2UgMHgxYjpcbiAgICAgICAgLy9sb2dnZXIubG9nKCdBVkMgUElEOicgICsgcGlkKTtcbiAgICAgICAgdGhpcy5fYXZjSWQgPSBwaWQ7XG4gICAgICAgIHRoaXMuX2F2Y1RyYWNrLmlkID0gcGlkO1xuICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgbG9nZ2VyLmxvZygndW5rb3duIHN0cmVhbSB0eXBlOicgICsgZGF0YVtvZmZzZXRdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChkYXRhW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IGRhdGFbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VQRVMoc3RyZWFtKSB7XG4gICAgdmFyIGkgPSAwLGZyYWcscGVzRmxhZ3MscGVzUHJlZml4LHBlc0xlbixwZXNIZHJMZW4scGVzRGF0YSxwZXNQdHMscGVzRHRzLHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBzdHJlYW0uZGF0YVswXTtcbiAgICBwZXNQcmVmaXggPSAoZnJhZ1swXSA8PCAxNikgKyAoZnJhZ1sxXSA8PCA4KSArIGZyYWdbMl07XG4gICAgaWYocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8vIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICBwZXNQdHMgPSAoZnJhZ1s5XSAmIDB4MEUpIDw8IDI4XG4gICAgICAgICAgfCAoZnJhZ1sxMF0gJiAweEZGKSA8PCAyMVxuICAgICAgICAgIHwgKGZyYWdbMTFdICYgMHhGRSkgPDwgMTNcbiAgICAgICAgICB8IChmcmFnWzEyXSAmIDB4RkYpIDw8ICA2XG4gICAgICAgICAgfCAoZnJhZ1sxM10gJiAweEZFKSA+Pj4gIDI7XG4gICAgICAgIHBlc1B0cyAvPSA0NTtcbiAgICAgICAgaWYgKHBlc0ZsYWdzICYgMHg0MCkge1xuICAgICAgICAgIHBlc0R0cyA9IChmcmFnWzE0XSAmIDB4MEUgKSA8PCAyOFxuICAgICAgICAgICAgfCAoZnJhZ1sxNV0gJiAweEZGICkgPDwgMjFcbiAgICAgICAgICAgIHwgKGZyYWdbMTZdICYgMHhGRSApIDw8IDEzXG4gICAgICAgICAgICB8IChmcmFnWzE3XSAmIDB4RkYgKSA8PCA2XG4gICAgICAgICAgICB8IChmcmFnWzE4XSAmIDB4RkUgKSA+Pj4gMjtcbiAgICAgICAgICBwZXNEdHMgLz0gNDU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVzRHRzID0gcGVzUHRzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZXNIZHJMZW4gPSBmcmFnWzhdO1xuICAgICAgcGF5bG9hZFN0YXJ0T2Zmc2V0ID0gcGVzSGRyTGVuKzk7XG4gICAgICAvLyB0cmltIFBFUyBoZWFkZXJcbiAgICAgIHN0cmVhbS5kYXRhWzBdID0gc3RyZWFtLmRhdGFbMF0uc3ViYXJyYXkocGF5bG9hZFN0YXJ0T2Zmc2V0KTtcbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgLy8gcmVhc3NlbWJsZSB0aGUgcGFja2V0XG4gICAgICB3aGlsZSAoc3RyZWFtLmRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBzdHJlYW0uZGF0YS5zaGlmdCgpO1xuICAgICAgICBwZXNEYXRhLnNldChmcmFnLCBpKTtcbiAgICAgICAgaSArPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBkYXRhIDogcGVzRGF0YSwgcHRzIDogcGVzUHRzLCBkdHMgOiBwZXNEdHMsIGxlbiA6IHBlc0xlbn07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIF9wYXJzZUFWQ1BFUyhwZXMpIHtcbiAgICB2YXIgdW5pdHMsdHJhY2sgPSB0aGlzLl9hdmNUcmFjayxhdmNTYW1wbGUsa2V5ID0gZmFsc2U7XG4gICAgdW5pdHMgPSB0aGlzLl9wYXJzZUFWQ05BTHUocGVzLmRhdGEpO1xuICAgIC8vZnJlZSBwZXMuZGF0YSB0byBzYXZlIHVwIHNvbWUgbWVtb3J5XG4gICAgcGVzLmRhdGEgPSBudWxsO1xuICAgIHVuaXRzLnVuaXRzLmZvckVhY2godW5pdCA9PiB7XG4gICAgICBzd2l0Y2godW5pdC50eXBlKSB7XG4gICAgICAgIC8vSURSXG4gICAgICAgIGNhc2UgNTpcbiAgICAgICAgICBrZXkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvL1NQU1xuICAgICAgICBjYXNlIDc6XG4gICAgICAgICAgaWYoIXRyYWNrLnNwcykge1xuICAgICAgICAgICAgdmFyIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU2VxdWVuY2VQYXJhbWV0ZXJTZXQoKTtcbiAgICAgICAgICAgIHRyYWNrLndpZHRoID0gY29uZmlnLndpZHRoO1xuICAgICAgICAgICAgdHJhY2suaGVpZ2h0ID0gY29uZmlnLmhlaWdodDtcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMgPSBjb25maWcucHJvZmlsZUlkYztcbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXRpYmlsaXR5ID0gY29uZmlnLnByb2ZpbGVDb21wYXRpYmlsaXR5O1xuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMgPSBjb25maWcubGV2ZWxJZGM7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gOTAwMDAqdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB2YXIgY29kZWNhcnJheSA9IHVuaXQuZGF0YS5zdWJhcnJheSgxLDQpO1xuICAgICAgICAgICAgdmFyIGNvZGVjc3RyaW5nICA9ICdhdmMxLic7XG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGggPSBjb2RlY2FycmF5W2ldLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICAgICAgICBpZiAoaC5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgIGggPSAnMCcgKyBoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb2RlY3N0cmluZyArPSBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhY2suY29kZWMgPSBjb2RlY3N0cmluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vUFBTXG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICBpZighdHJhY2sucHBzKSB7XG4gICAgICAgICAgICB0cmFjay5wcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy9idWlsZCBzYW1wbGUgZnJvbSBQRVNcbiAgICAvLyBBbm5leCBCIHRvIE1QNCBjb252ZXJzaW9uIHRvIGJlIGRvbmVcbiAgICBhdmNTYW1wbGUgPSB7IHVuaXRzIDogdW5pdHMsIHB0cyA6IHBlcy5wdHMsIGR0cyA6IHBlcy5kdHMgLCBrZXkgOiBrZXl9O1xuICAgIHRoaXMuX2F2Y1NhbXBsZXMucHVzaChhdmNTYW1wbGUpO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNMZW5ndGggKz0gdW5pdHMubGVuZ3RoO1xuICAgIHRoaXMuX2F2Y1NhbXBsZXNOYk5hbHUgKz0gdW5pdHMudW5pdHMubGVuZ3RoO1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZighdGhpcy5faW5pdFNlZ0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5fZ2VuZXJhdGVJbml0U2VnbWVudCgpO1xuICAgIH1cbiAgfVxuXG5cbiAgX2ZsdXNoQVZDU2FtcGxlcygpIHtcbiAgICB2YXIgdmlldyxpPTgsYXZjU2FtcGxlLG1wNFNhbXBsZSxtcDRTYW1wbGVMZW5ndGgsdW5pdCx0cmFjayA9IHRoaXMuX2F2Y1RyYWNrLFxuICAgICAgICBsYXN0U2FtcGxlRFRTLG1kYXQsbW9vZixzdGFydE9mZnNldCxlbmRPZmZzZXQsXG4gICAgICAgIGZpcnN0UFRTLGZpcnN0RFRTO1xuICAgIHRyYWNrLnNhbXBsZXMgPSBbXTtcblxuICAgIC8qIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXQgaW4gcGxhY2VcbiAgICAgIChuZWVkIDggbW9yZSBieXRlcyB0byBmaWxsIGxlbmd0aCBhbmQgbXBkYXQgdHlwZSkgKi9cbiAgICBtZGF0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fYXZjU2FtcGxlc0xlbmd0aCArICg0ICogdGhpcy5fYXZjU2FtcGxlc05iTmFsdSkrOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCxtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LDQpO1xuICAgIHdoaWxlKHRoaXMuX2F2Y1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhdmNTYW1wbGUgPSB0aGlzLl9hdmNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICBtcDRTYW1wbGVMZW5ndGggPSAwO1xuXG4gICAgICAvLyBjb252ZXJ0IE5BTFUgYml0c3RyZWFtIHRvIE1QNCBmb3JtYXQgKHByZXBlbmQgTkFMVSB3aXRoIHNpemUgZmllbGQpXG4gICAgICB3aGlsZShhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIoaSwgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICBpICs9IDQ7XG4gICAgICAgIG1kYXQuc2V0KHVuaXQuZGF0YSwgaSk7XG4gICAgICAgIGkgKz0gdW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCs9NCt1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgYXZjU2FtcGxlLnB0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgYXZjU2FtcGxlLmR0cyAtPSB0aGlzLl9pbml0RFRTO1xuICAgICAgLy9sb2dnZXIubG9nKCdWaWRlby9QVFMvRFRTOicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyk7XG5cbiAgICAgIGlmKGxhc3RTYW1wbGVEVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtcDRTYW1wbGUuZHVyYXRpb24gPSBNYXRoLnJvdW5kKChhdmNTYW1wbGUuZHRzIC0gbGFzdFNhbXBsZURUUykqOTApO1xuICAgICAgICBpZihtcDRTYW1wbGUuZHVyYXRpb24gPCAwKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdpbnZhbGlkIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMvRFRTOjonICsgYXZjU2FtcGxlLnB0cyArICcvJyArIGF2Y1NhbXBsZS5kdHMgKyAnOicgKyBtcDRTYW1wbGUuZHVyYXRpb24pO1xuICAgICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IDA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNoZWNrIGlmIGZyYWdtZW50cyBhcmUgY29udGlndW91cyAoaS5lLiBubyBtaXNzaW5nIGZyYW1lcyBiZXR3ZWVuIGZyYWdtZW50KVxuICAgICAgICBpZih0aGlzLm5leHRBdmNQdHMpIHtcbiAgICAgICAgICB2YXIgZGVsdGEgPSBhdmNTYW1wbGUucHRzIC0gdGhpcy5uZXh0QXZjUHRzLGFic2RlbHRhPU1hdGguYWJzKGRlbHRhKTtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fic2RlbHRhL2F2Y1NhbXBsZS5wdHM6JyArIGFic2RlbHRhICsgJy8nICsgYXZjU2FtcGxlLnB0cyk7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihhYnNkZWx0YSA8IDMwMCkge1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdWaWRlbyBuZXh0IFBUUzonICsgdGhpcy5uZXh0QXZjUHRzKTtcbiAgICAgICAgICAgIGlmKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdBVkM6JyArIGRlbHRhLnRvRml4ZWQoMCkgKyAnIG1zIGhvbGUgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQsZmlsbGluZyBpdCcpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YSA8IC0xKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FWQzonICsgKC1kZWx0YS50b0ZpeGVkKDApKSArICcgbXMgb3ZlcmxhcHBpbmcgYmV0d2VlbiBmcmFnbWVudHMgZGV0ZWN0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFNcbiAgICAgICAgICAgIGF2Y1NhbXBsZS5wdHMgPSB0aGlzLm5leHRBdmNQdHM7XG4gICAgICAgICAgICAvLyBvZmZzZXQgRFRTIGFzIHdlbGwsIGVuc3VyZSB0aGF0IERUUyBpcyBzbWFsbGVyIG9yIGVxdWFsIHRoYW4gbmV3IFBUU1xuICAgICAgICAgICAgYXZjU2FtcGxlLmR0cyA9IE1hdGgubWF4KGF2Y1NhbXBsZS5kdHMtZGVsdGEsIHRoaXMubGFzdEF2Y0R0cyk7XG4gICAgICAgICAgIC8vIGxvZ2dlci5sb2coJ1ZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6JyArIGF2Y1NhbXBsZS5wdHMgKyAnLycgKyBhdmNTYW1wbGUuZHRzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIG91ciBhdmNTYW1wbGVzXG4gICAgICAgIGZpcnN0UFRTID0gYXZjU2FtcGxlLnB0cztcbiAgICAgICAgZmlyc3REVFMgPSBhdmNTYW1wbGUuZHRzO1xuICAgICAgfVxuXG4gICAgICBtcDRTYW1wbGUgPSB7XG4gICAgICAgIHNpemU6IG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiAoYXZjU2FtcGxlLnB0cyAtIGF2Y1NhbXBsZS5kdHMpKjkwLFxuICAgICAgICBmbGFnczoge1xuICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGlmKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1wNFNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBtcDRTYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlID0gMTtcbiAgICAgIH1cbiAgICAgIHRyYWNrLnNhbXBsZXMucHVzaChtcDRTYW1wbGUpO1xuICAgICAgbGFzdFNhbXBsZURUUyA9IGF2Y1NhbXBsZS5kdHM7XG4gICAgfVxuICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHRyYWNrLnNhbXBsZXNbdHJhY2suc2FtcGxlcy5sZW5ndGgtMl0uZHVyYXRpb247XG4gICAgdGhpcy5sYXN0QXZjRHRzID0gYXZjU2FtcGxlLmR0cztcbiAgICAvLyBuZXh0IEFWQyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEF2Y1B0cyA9IGF2Y1NhbXBsZS5wdHMgKyBtcDRTYW1wbGUuZHVyYXRpb24vOTA7XG4gICAgLy9sb2dnZXIubG9nKCdWaWRlby9sYXN0QXZjRHRzL25leHRBdmNQdHM6JyArIHRoaXMubGFzdEF2Y0R0cyArICcvJyArIHRoaXMubmV4dEF2Y1B0cyk7XG5cbiAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoID0gMDtcbiAgICB0aGlzLl9hdmNTYW1wbGVzTmJOYWx1ID0gMDtcblxuICAgIHN0YXJ0T2Zmc2V0ID0gZmlyc3RQVFMvMTAwMDtcbiAgICBlbmRPZmZzZXQgPSB0aGlzLm5leHRBdmNQdHMvMTAwMDtcblxuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLGZpcnN0RFRTKjkwLHRyYWNrKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBzdGFydE9mZnNldCxcbiAgICAgIGVuZFBUUyA6IGVuZE9mZnNldCxcbiAgICAgIHN0YXJ0RFRTIDogZmlyc3REVFMvMTAwMCxcbiAgICAgIGVuZERUUyA6IChhdmNTYW1wbGUuZHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uLzkwKS8xMDAwLFxuICAgICAgdHlwZSA6ICd2aWRlbydcbiAgICB9KTtcbiAgfVxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsbGVuID0gYXJyYXkuYnl0ZUxlbmd0aCx2YWx1ZSxvdmVyZmxvdyxzdGF0ZSA9IDA7XG4gICAgdmFyIHVuaXRzID0gW10sIHVuaXQsIHVuaXRUeXBlLCBsYXN0VW5pdFN0YXJ0LGxhc3RVbml0VHlwZSxsZW5ndGggPSAwO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuXG4gICAgd2hpbGUoaTwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaChzdGF0ZSkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgaWYodmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZih2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAzO1xuICAgICAgICAgIH0gZWxzZSBpZih2YWx1ZSA9PT0gMSkge1xuICAgICAgICAgICAgdW5pdFR5cGUgPSBhcnJheVtpXSAmIDB4MWY7XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ZpbmQgTkFMVSBAIG9mZnNldDonICsgaSArICcsdHlwZTonICsgdW5pdFR5cGUpO1xuICAgICAgICAgICAgaWYobGFzdFVuaXRTdGFydCkge1xuICAgICAgICAgICAgICB1bml0ID0geyBkYXRhIDogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCxpLXN0YXRlLTEpLCB0eXBlIDogbGFzdFVuaXRUeXBlfTtcbiAgICAgICAgICAgICAgbGVuZ3RoKz1pLXN0YXRlLTEtbGFzdFVuaXRTdGFydDtcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdwdXNoaW5nIE5BTFUsIHR5cGUvc2l6ZTonICsgdW5pdC50eXBlICsgJy8nICsgdW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICB1bml0cy5wdXNoKHVuaXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgTkFMIHVuaXRzIGFyZSBub3Qgc3RhcnRpbmcgcmlnaHQgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgUEVTIHBhY2tldCwgcHVzaCBwcmVjZWRpbmcgZGF0YSBpbnRvIHByZXZpb3VzIE5BTCB1bml0LlxuICAgICAgICAgICAgICBvdmVyZmxvdyAgPSBpIC0gc3RhdGUgLSAxO1xuICAgICAgICAgICAgICBpZiAob3ZlcmZsb3cpIHtcbiAgICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICBpZih0aGlzLl9hdmNTYW1wbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHRoaXMuX2F2Y1NhbXBsZXNbdGhpcy5fYXZjU2FtcGxlcy5sZW5ndGgtMV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGgtMV07XG4gICAgICAgICAgICAgICAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgrb3ZlcmZsb3cpO1xuICAgICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsMCk7XG4gICAgICAgICAgICAgICAgICAgIHRtcC5zZXQoYXJyYXkuc3ViYXJyYXkoMCxvdmVyZmxvdyksbGFzdFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGgrPW92ZXJmbG93O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hdmNTYW1wbGVzTGVuZ3RoKz1vdmVyZmxvdztcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGFzdFVuaXRTdGFydCA9IGk7XG4gICAgICAgICAgICBsYXN0VW5pdFR5cGUgPSB1bml0VHlwZTtcbiAgICAgICAgICAgIGlmKHVuaXRUeXBlID09PSAxIHx8IHVuaXRUeXBlID09PSA1KSB7XG4gICAgICAgICAgICAgIC8vIE9QVEkgISEhIGlmIElEUi9ORFIgdW5pdCwgY29uc2lkZXIgaXQgaXMgbGFzdCBOQUx1XG4gICAgICAgICAgICAgIGkgPSBsZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGxhc3RVbml0U3RhcnQpIHtcbiAgICAgIHVuaXQgPSB7IGRhdGEgOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LGxlbiksIHR5cGUgOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgbGVuZ3RoKz1sZW4tbGFzdFVuaXRTdGFydDtcbiAgICAgIHVuaXRzLnB1c2godW5pdCk7XG4gICAgICAvL2xvZ2dlci5sb2coJ3B1c2hpbmcgTkFMVSwgdHlwZS9zaXplOicgKyB1bml0LnR5cGUgKyAnLycgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiB7IHVuaXRzIDogdW5pdHMgLCBsZW5ndGggOiBsZW5ndGh9O1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLGFhY1NhbXBsZSxkYXRhID0gcGVzLmRhdGEsY29uZmlnLGFkdHNGcmFtZVNpemUsYWR0c1N0YXJ0T2Zmc2V0LGFkdHNIZWFkZXJMZW4sc3RhbXAsaTtcbiAgICBpZih0aGlzLmFhY092ZXJGbG93KSB7XG4gICAgICB2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoK2RhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICB0bXAuc2V0KHRoaXMuYWFjT3ZlckZsb3csMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsdGhpcy5hYWNPdmVyRmxvdy5ieXRlTGVuZ3RoKTtcbiAgICAgIGRhdGEgPSB0bXA7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChkYXRhKSk7XG4gICAgaWYoZGF0YVswXSA9PT0gMHhmZikge1xuICAgICAgaWYoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgICBjb25maWcgPSB0aGlzLl9BRFRTdG9BdWRpb0NvbmZpZyhwZXMuZGF0YSx0aGlzLmF1ZGlvQ29kZWMpO1xuICAgICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgPSBjb25maWcuc2FtcGxlcmF0ZTtcbiAgICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICAgIHRyYWNrLmR1cmF0aW9uID0gOTAwMDAqdGhpcy5fZHVyYXRpb247XG4gICAgICAgIGNvbnNvbGUubG9nKHRyYWNrLmNvZGVjICsnLHJhdGU6JyArIGNvbmZpZy5zYW1wbGVyYXRlICsgJyxuYiBjaGFubmVsOicgKyBjb25maWcuY2hhbm5lbENvdW50KTtcbiAgICAgIH1cbiAgICAgIGFkdHNTdGFydE9mZnNldCA9IGkgPSAwO1xuICAgICAgd2hpbGUoKGFkdHNTdGFydE9mZnNldCArIDUpIDwgZGF0YS5sZW5ndGgpIHtcbiAgICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhW2FkdHNTdGFydE9mZnNldCszXSAmIDB4MDMpIDw8IDExKTtcbiAgICAgICAgLy8gYnl0ZSA0XG4gICAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzRdIDw8IDMpO1xuICAgICAgICAvLyBieXRlIDVcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgICBhZHRzSGVhZGVyTGVuID0gKCEhKGRhdGFbYWR0c1N0YXJ0T2Zmc2V0KzFdICYgMHgwMSkgPyA3IDogOSk7XG4gICAgICAgIGFkdHNGcmFtZVNpemUgLT0gYWR0c0hlYWRlckxlbjtcbiAgICAgICAgc3RhbXAgPSBwZXMucHRzICsgaSoxMDI0KjEwMDAvdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgICAvL3N0YW1wID0gcGVzLnB0cztcbiAgICAgICAgLy9jb25zb2xlLmxvZygnQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3B0czonICsgKGFkdHNTdGFydE9mZnNldCs3KSArICcvJyArIGFkdHNGcmFtZVNpemUgKyAnLycgKyBzdGFtcC50b0ZpeGVkKDApKTtcbiAgICAgICAgaWYoYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4rYWR0c0ZyYW1lU2l6ZSA8PSBkYXRhLmxlbmd0aCkge1xuICAgICAgICAgIGFhY1NhbXBsZSA9IHsgdW5pdCA6IGRhdGEuc3ViYXJyYXkoYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4sYWR0c1N0YXJ0T2Zmc2V0K2FkdHNIZWFkZXJMZW4rYWR0c0ZyYW1lU2l6ZSkgLCBwdHMgOiBzdGFtcCwgZHRzIDogc3RhbXB9O1xuICAgICAgICAgIHRoaXMuX2FhY1NhbXBsZXMucHVzaChhYWNTYW1wbGUpO1xuICAgICAgICAgIHRoaXMuX2FhY1NhbXBsZXNMZW5ndGggKz0gYWR0c0ZyYW1lU2l6ZTtcbiAgICAgICAgICBhZHRzU3RhcnRPZmZzZXQrPWFkdHNGcmFtZVNpemUrYWR0c0hlYWRlckxlbjtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfRVJST1IsJ1N0cmVhbSBkaWQgbm90IHN0YXJ0IHdpdGggQURUUyBoZWFkZXIuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKCF0aGlzLl9pbml0U2VnR2VuZXJhdGVkKSB7XG4gICAgICB0aGlzLl9nZW5lcmF0ZUluaXRTZWdtZW50KCk7XG4gICAgfVxuICAgIGlmKGFkdHNTdGFydE9mZnNldCA8IGRhdGEubGVuZ3RoKSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gZGF0YS5zdWJhcnJheShhZHRzU3RhcnRPZmZzZXQsZGF0YS5sZW5ndGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfZmx1c2hBQUNTYW1wbGVzKCkge1xuICAgIHZhciB2aWV3LGk9OCxhYWNTYW1wbGUsbXA0U2FtcGxlLHVuaXQsdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgbGFzdFNhbXBsZURUUyxtZGF0LG1vb2Ysc3RhcnRPZmZzZXQsZW5kT2Zmc2V0LFxuICAgICAgICBmaXJzdFBUUyxmaXJzdERUUztcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG5cbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRoaXMuX2FhY1NhbXBsZXNMZW5ndGgrOCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhtZGF0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCxtZGF0LmJ5dGVMZW5ndGgpO1xuICAgIG1kYXQuc2V0KE1QNC50eXBlcy5tZGF0LDQpO1xuICAgIHdoaWxlKHRoaXMuX2FhY1NhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBhYWNTYW1wbGUgPSB0aGlzLl9hYWNTYW1wbGVzLnNoaWZ0KCk7XG4gICAgICB1bml0ID0gYWFjU2FtcGxlLnVuaXQ7XG4gICAgICBtZGF0LnNldCh1bml0LCBpKTtcbiAgICAgIGkgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuXG4gICAgICBhYWNTYW1wbGUucHRzIC09IHRoaXMuX2luaXREVFM7XG4gICAgICBhYWNTYW1wbGUuZHRzIC09IHRoaXMuX2luaXREVFM7XG5cbiAgICAgIC8vbG9nZ2VyLmxvZygnQXVkaW8vUFRTOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkpO1xuICAgICAgaWYobGFzdFNhbXBsZURUUyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHdlIHVzZSBEVFMgdG8gY29tcHV0ZSBzYW1wbGUgZHVyYXRpb24sIGJ1dCB3ZSB1c2UgUFRTIHRvIGNvbXB1dGUgaW5pdFBUUyB3aGljaCBpcyB1c2VkIHRvIHN5bmMgYXVkaW8gYW5kIHZpZGVvXG4gICAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IE1hdGgucm91bmQoKGFhY1NhbXBsZS5kdHMgLSBsYXN0U2FtcGxlRFRTKSo5MCk7XG4gICAgICAgIGlmKG1wNFNhbXBsZS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2ludmFsaWQgc2FtcGxlIGR1cmF0aW9uIGF0IFBUUy9EVFM6OicgKyBhdmNTYW1wbGUucHRzICsgJy8nICsgYXZjU2FtcGxlLmR0cyArICc6JyArIG1wNFNhbXBsZS5kdXJhdGlvbik7XG4gICAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gY2hlY2sgaWYgZnJhZ21lbnRzIGFyZSBjb250aWd1b3VzIChpLmUuIG5vIG1pc3NpbmcgZnJhbWVzIGJldHdlZW4gZnJhZ21lbnQpXG4gICAgICAgIGlmKHRoaXMubmV4dEFhY1B0cyAmJiB0aGlzLm5leHRBYWNQdHMgIT09IGFhY1NhbXBsZS5wdHMpIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvIG5leHQgUFRTOicgKyB0aGlzLm5leHRBYWNQdHMpO1xuICAgICAgICAgIHZhciBkZWx0YSA9IGFhY1NhbXBsZS5wdHMgLSB0aGlzLm5leHRBYWNQdHM7XG4gICAgICAgICAgLy8gaWYgZGVsdGEgaXMgbGVzcyB0aGFuIDMwMCBtcywgbmV4dCBsb2FkZWQgZnJhZ21lbnQgaXMgYXNzdW1lZCB0byBiZSBjb250aWd1b3VzIHdpdGggbGFzdCBvbmVcbiAgICAgICAgICBpZihNYXRoLmFicyhkZWx0YSkgPiAxICYmIE1hdGguYWJzKGRlbHRhKSA8IDMwMCkge1xuICAgICAgICAgICAgaWYoZGVsdGEgPiAwKSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coJ0FBQzonICsgZGVsdGEudG9GaXhlZCgwKSArICcgbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0Jyk7XG4gICAgICAgICAgICAgIC8vIHNldCBQVFMgdG8gbmV4dCBQVFMsIGFuZCBlbnN1cmUgUFRTIGlzIGdyZWF0ZXIgb3IgZXF1YWwgdGhhbiBsYXN0IERUU1xuICAgICAgICAgICAgICBhYWNTYW1wbGUucHRzID0gTWF0aC5tYXgodGhpcy5uZXh0QWFjUHRzLCB0aGlzLmxhc3RBYWNEdHMpO1xuICAgICAgICAgICAgICBhYWNTYW1wbGUuZHRzID0gYWFjU2FtcGxlLnB0cztcbiAgICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvRFRTIGFkanVzdGVkOicgKyBhYWNTYW1wbGUucHRzICsgJy8nICsgYWFjU2FtcGxlLmR0cyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKCdBQUM6JyArICgtZGVsdGEudG9GaXhlZCgwKSkgKyAnIG1zIG92ZXJsYXBwaW5nIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiBvdXIgYXZjU2FtcGxlc1xuICAgICAgICBmaXJzdFBUUyA9IGFhY1NhbXBsZS5wdHM7XG4gICAgICAgIGZpcnN0RFRTID0gYWFjU2FtcGxlLmR0cztcbiAgICAgIH1cblxuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGNvbXBvc2l0aW9uVGltZU9mZnNldDogMCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkYXRpb25Qcmlvcml0eTogMCxcbiAgICAgICAgICBkZXBlbmRzT24gOiAxLFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0U2FtcGxlRFRTID0gYWFjU2FtcGxlLmR0cztcbiAgICB9XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IHRyYWNrLnNhbXBsZXNbdHJhY2suc2FtcGxlcy5sZW5ndGgtMl0uZHVyYXRpb247XG4gICAgdGhpcy5sYXN0QWFjRHRzID0gYWFjU2FtcGxlLmR0cztcbiAgICAvLyBuZXh0IGFhYyBzYW1wbGUgUFRTIHNob3VsZCBiZSBlcXVhbCB0byBsYXN0IHNhbXBsZSBQVFMgKyBkdXJhdGlvblxuICAgIHRoaXMubmV4dEFhY1B0cyA9IGFhY1NhbXBsZS5wdHMgKyBtcDRTYW1wbGUuZHVyYXRpb24vOTA7XG4gICAgLy9sb2dnZXIubG9nKCdBdWRpby9QVFMvUFRTZW5kOicgKyBhYWNTYW1wbGUucHRzLnRvRml4ZWQoMCkgKyAnLycgKyB0aGlzLm5leHRBYWNEdHMudG9GaXhlZCgwKSk7XG5cbiAgICB0aGlzLl9hYWNTYW1wbGVzTGVuZ3RoID0gMDtcblxuICAgIHN0YXJ0T2Zmc2V0ID0gZmlyc3RQVFMvMTAwMDtcbiAgICBlbmRPZmZzZXQgPSB0aGlzLm5leHRBYWNQdHMvMTAwMDtcblxuICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLGZpcnN0RFRTKjkwLHRyYWNrKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLHtcbiAgICAgIG1vb2Y6IG1vb2YsXG4gICAgICBtZGF0OiBtZGF0LFxuICAgICAgc3RhcnRQVFMgOiBzdGFydE9mZnNldCxcbiAgICAgIGVuZFBUUyA6IGVuZE9mZnNldCxcbiAgICAgIHN0YXJ0RFRTIDogZmlyc3REVFMvMTAwMCxcbiAgICAgIGVuZERUUyA6IChhYWNTYW1wbGUuZHRzICsgbXA0U2FtcGxlLmR1cmF0aW9uLzkwKS8xMDAwLFxuICAgICAgdHlwZSA6ICdhdWRpbydcbiAgICB9KTtcbiAgfVxuXG4gIF9BRFRTdG9BdWRpb0NvbmZpZyhkYXRhLGF1ZGlvQ29kZWMpIHtcbiAgICB2YXIgYWR0c09iamVjdFR5cGUsIC8vIDppbnRcbiAgICAgICAgYWR0c1NhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCwgLy8gOmludFxuICAgICAgICBhZHRzQ2hhbmVsQ29uZmlnLCAvLyA6aW50XG4gICAgICAgIGNvbmZpZyxcbiAgICAgICAgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwXG4gICAgICAgICAgXTtcblxuICAgIC8vIGJ5dGUgMlxuICAgIGFkdHNPYmplY3RUeXBlID0gKChkYXRhWzJdICYgMHhDMCkgPj4+IDYpICsgMTtcbiAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVsyXSAmIDB4MDEpIDw8IDIpO1xuXG4gICAgLy8gIGFsd2F5cyBmb3JjZSBhdWRpbyB0eXBlIHRvIGJlIEhFLUFBQyBTQlIuIHNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgYXVkaW8gY29kZWMgc3dpdGNoIHByb3Blcmx5XG4gICAgLy8gaW4gY2FzZSBzdHJlYW0gaXMgcmVhbGx5IEhFLUFBQzogaXQgc2hvdWxkIGJlIGVpdGhlciAgYWR2ZXJ0aXNlZCBkaXJlY3RseSBpbiBjb2RlY3MgKHJldHJpZXZlZCBmcm9tIHBhcnNpbmcgbWFuaWZlc3QpXG4gICAgLy8gb3IgaWYgbm8gY29kZWMgc3BlY2lmaWVkLHdlIGltcGxpY2l0ZWx5IGFzc3VtZSB0aGF0IGF1ZGlvIHdpdGggc2FtcGxpbmcgcmF0ZSBsZXNzIG9yIGVxdWFsIHRoYW4gMjQga0h6IGlzIEhFLUFBQyAoaW5kZXggNilcbiAgICAvLyBjdXJyZW50bHkgYnJva2VuIG9uIENocm9tZS9BbmRyb2lkXG4gICAgaWYobmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoJ2FuZHJvaWQnKSA9PT0gLTEgJiZcbiAgICAgICgoYXVkaW9Db2RlYyAmJiBhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB8fCAoIWF1ZGlvQ29kZWMgJiYgYWR0c1NhbXBsZWluZ0luZGV4ID49NikpKSAge1xuICAgICAgYWR0c09iamVjdFR5cGUgPSA1O1xuICAgICAgLy8gSEUtQUFDIHVzZXMgU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKSAsIGhpZ2ggZnJlcXVlbmNpZXMgYXJlIGNvbnN0cnVjdGVkIGZyb20gbG93IGZyZXF1ZW5jaWVzXG4gICAgICAvLyB0aGVyZSBpcyBhIGZhY3RvciAyIGJldHdlZW4gZnJhbWUgc2FtcGxlIHJhdGUgYW5kIG91dHB1dCBzYW1wbGUgcmF0ZVxuICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleCAtIDM7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdhbmRyb2lkJykgPT09IC0xICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgfWVsc2Uge1xuICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgIGNvbmZpZyA9IG5ldyBBcnJheSgyKTtcbiAgICAgIH1cbiAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICB9XG4gICAgLy8gYnl0ZSAzXG4gICAgYWR0c0NoYW5lbENvbmZpZyB8PSAoKGRhdGFbM10gJiAweEMwKSA+Pj4gNik7XG4gIC8qIHJlZmVyIHRvIGh0dHA6Ly93aWtpLm11bHRpbWVkaWEuY3gvaW5kZXgucGhwP3RpdGxlPU1QRUctNF9BdWRpbyNBdWRpb19TcGVjaWZpY19Db25maWdcbiAgICAgIElTTyAxNDQ5Ni0zIChBQUMpLnBkZiAtIFRhYmxlIDEuMTMg4oCUIFN5bnRheCBvZiBBdWRpb1NwZWNpZmljQ29uZmlnKClcbiAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAwOiBOdWxsXG4gICAgMTogQUFDIE1haW5cbiAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICA2OiBBQUMgU2NhbGFibGVcbiAgIHNhbXBsaW5nIGZyZXFcbiAgICAwOiA5NjAwMCBIelxuICAgIDE6IDg4MjAwIEh6XG4gICAgMjogNjQwMDAgSHpcbiAgICAzOiA0ODAwMCBIelxuICAgIDQ6IDQ0MTAwIEh6XG4gICAgNTogMzIwMDAgSHpcbiAgICA2OiAyNDAwMCBIelxuICAgIDc6IDIyMDUwIEh6XG4gICAgODogMTYwMDAgSHpcbiAgICA5OiAxMjAwMCBIelxuICAgIDEwOiAxMTAyNSBIelxuICAgIDExOiA4MDAwIEh6XG4gICAgMTI6IDczNTAgSHpcbiAgICAxMzogUmVzZXJ2ZWRcbiAgICAxNDogUmVzZXJ2ZWRcbiAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmKGFkdHNPYmplY3RUeXBlID09PSA1KSB7XG4gICAgICAvLyBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXhcbiAgICAgIGNvbmZpZ1sxXSB8PSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICAgIGNvbmZpZ1syXSA9IChhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggJiAweDAxKSA8PCA3O1xuICAgICAgLy8gYWR0c09iamVjdFR5cGUgKGZvcmNlIHRvIDIsIGNocm9tZSBpcyBjaGVja2luZyB0aGF0IG9iamVjdCB0eXBlIGlzIGxlc3MgdGhhbiA1ID8/P1xuICAgICAgLy8gICAgaHR0cHM6Ly9jaHJvbWl1bS5nb29nbGVzb3VyY2UuY29tL2Nocm9taXVtL3NyYy5naXQvKy9tYXN0ZXIvbWVkaWEvZm9ybWF0cy9tcDQvYWFjLmNjXG4gICAgICBjb25maWdbMl0gfD0gMiA8PCAyO1xuICAgICAgY29uZmlnWzNdID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIHsgY29uZmlnIDogY29uZmlnLCBzYW1wbGVyYXRlIDogYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF0sIGNoYW5uZWxDb3VudCA6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjIDogKCdtcDRhLjQwLicgKyBhZHRzT2JqZWN0VHlwZSl9O1xuICB9XG5cbiAgX2dlbmVyYXRlSW5pdFNlZ21lbnQoKSB7XG4gICAgaWYodGhpcy5fYXZjSWQgPT09IC0xKSB7XG4gICAgICAvL2F1ZGlvIG9ubHlcbiAgICAgIGlmKHRoaXMuX2FhY1RyYWNrLmNvbmZpZykge1xuICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULHtcbiAgICAgICAgICBhdWRpb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYWFjVHJhY2tdKSxcbiAgICAgICAgICBhdWRpb0NvZGVjIDogdGhpcy5fYWFjVHJhY2suY29kZWMsXG4gICAgICAgICAgYXVkaW9DaGFubmVsQ291bnQgOiB0aGlzLl9hYWNUcmFjay5jaGFubmVsQ291bnRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIHJlbWVtYmVyIGZpcnN0IFBUUyBvZiB0aGlzIGRlbXV4aW5nIGNvbnRleHRcbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2FhY1NhbXBsZXNbMF0ucHRzIC0gMTAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgIHRoaXMuX2luaXREVFMgPSB0aGlzLl9hYWNTYW1wbGVzWzBdLmR0cyAtIDEwMDAqdGhpcy50aW1lT2Zmc2V0O1xuICAgICAgfVxuICAgIH0gZWxzZVxuICAgIGlmKHRoaXMuX2FhY0lkID09PSAtMSkge1xuICAgICAgLy92aWRlbyBvbmx5XG4gICAgICBpZih0aGlzLl9hdmNUcmFjay5zcHMgJiYgdGhpcy5fYXZjVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIHZpZGVvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hdmNUcmFja10pLFxuICAgICAgICAgIHZpZGVvQ29kZWMgOiB0aGlzLl9hdmNUcmFjay5jb2RlYyxcbiAgICAgICAgICB2aWRlb1dpZHRoIDogdGhpcy5fYXZjVHJhY2sud2lkdGgsXG4gICAgICAgICAgdmlkZW9IZWlnaHQgOiB0aGlzLl9hdmNUcmFjay5oZWlnaHRcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2luaXRTZWdHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgICBpZih0aGlzLl9pbml0UFRTID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2YgdGhpcyBkZW11eGluZyBjb250ZXh0XG4gICAgICAgICAgdGhpcy5faW5pdFBUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0ucHRzIC0gMTAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgICAgdGhpcy5faW5pdERUUyA9IHRoaXMuX2F2Y1NhbXBsZXNbMF0uZHRzIC0gMTAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy9hdWRpbyBhbmQgdmlkZW9cbiAgICAgIGlmKHRoaXMuX2FhY1RyYWNrLmNvbmZpZyAmJiB0aGlzLl9hdmNUcmFjay5zcHMgJiYgdGhpcy5fYXZjVHJhY2sucHBzKSB7XG4gICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQse1xuICAgICAgICAgIGF1ZGlvTW9vdjogTVA0LmluaXRTZWdtZW50KFt0aGlzLl9hYWNUcmFja10pLFxuICAgICAgICAgIGF1ZGlvQ29kZWMgOiB0aGlzLl9hYWNUcmFjay5jb2RlYyxcbiAgICAgICAgICBhdWRpb0NoYW5uZWxDb3VudCA6IHRoaXMuX2FhY1RyYWNrLmNoYW5uZWxDb3VudCxcbiAgICAgICAgICB2aWRlb01vb3Y6IE1QNC5pbml0U2VnbWVudChbdGhpcy5fYXZjVHJhY2tdKSxcbiAgICAgICAgICB2aWRlb0NvZGVjIDogdGhpcy5fYXZjVHJhY2suY29kZWMsXG4gICAgICAgICAgdmlkZW9XaWR0aCA6IHRoaXMuX2F2Y1RyYWNrLndpZHRoLFxuICAgICAgICAgIHZpZGVvSGVpZ2h0IDogdGhpcy5fYXZjVHJhY2suaGVpZ2h0XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9pbml0U2VnR2VuZXJhdGVkID0gdHJ1ZTtcbiAgICAgICAgaWYodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dFxuICAgICAgICAgIHRoaXMuX2luaXRQVFMgPSBNYXRoLm1pbih0aGlzLl9hdmNTYW1wbGVzWzBdLnB0cyx0aGlzLl9hYWNTYW1wbGVzWzBdLnB0cykgLSAxMDAwKnRoaXMudGltZU9mZnNldDtcbiAgICAgICAgICB0aGlzLl9pbml0RFRTID0gTWF0aC5taW4odGhpcy5fYXZjU2FtcGxlc1swXS5kdHMsdGhpcy5fYWFjU2FtcGxlc1swXS5kdHMpIC0gMTAwMCp0aGlzLnRpbWVPZmZzZXQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgVFNEZW11eGVyO1xuIiwiIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBUU0RlbXV4ZXIgICAgICAgICAgICBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuIGltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5cbmNsYXNzIFRTRGVtdXhlcldvcmtlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJyxmdW5jdGlvbiAoZXYpe1xuICAgICAgLy9jb25zb2xlLmxvZygnZGVtdXhlciBjbWQ6JyArIGV2LmRhdGEuY21kKTtcbiAgICAgIHN3aXRjaChldi5kYXRhLmNtZCkge1xuICAgICAgICBjYXNlICdpbml0JzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2R1cmF0aW9uJzpcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIuc2V0RHVyYXRpb24oZXYuZGF0YS5kYXRhKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnc3dpdGNoTGV2ZWwnOlxuICAgICAgICAgIHNlbGYuZGVtdXhlci5zd2l0Y2hMZXZlbCgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdkZW11eCc6XG4gICAgICAgICAgc2VsZi5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZXYuZGF0YS5kYXRhKSwgZXYuZGF0YS5hdWRpb0NvZGVjLGV2LmRhdGEudmlkZW9Db2RlYywgZXYuZGF0YS50aW1lT2Zmc2V0KTtcbiAgICAgICAgICBzZWxmLmRlbXV4ZXIuZW5kKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBUUyBEZW11eGVyXG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCwgZnVuY3Rpb24oZXYsZGF0YSkge1xuICAgICAgdmFyIG9iakRhdGEgPSB7IGV2ZW50IDogZXYgfTtcbiAgICAgIHZhciBvYmpUcmFuc2ZlcmFibGUgPSBbXTtcbiAgICAgIGlmKGRhdGEuYXVkaW9Db2RlYykge1xuICAgICAgICBvYmpEYXRhLmF1ZGlvQ29kZWMgPSBkYXRhLmF1ZGlvQ29kZWM7XG4gICAgICAgIG9iakRhdGEuYXVkaW9Nb292ID0gZGF0YS5hdWRpb01vb3YuYnVmZmVyO1xuICAgICAgICBvYmpEYXRhLmF1ZGlvQ2hhbm5lbENvdW50ID0gZGF0YS5hdWRpb0NoYW5uZWxDb3VudDtcbiAgICAgICAgb2JqVHJhbnNmZXJhYmxlLnB1c2gob2JqRGF0YS5hdWRpb01vb3YpO1xuICAgICAgfVxuICAgICAgaWYoZGF0YS52aWRlb0NvZGVjKSB7XG4gICAgICAgIG9iakRhdGEudmlkZW9Db2RlYyA9IGRhdGEudmlkZW9Db2RlYztcbiAgICAgICAgb2JqRGF0YS52aWRlb01vb3YgPSBkYXRhLnZpZGVvTW9vdi5idWZmZXI7XG4gICAgICAgIG9iakRhdGEudmlkZW9XaWR0aCA9IGRhdGEudmlkZW9XaWR0aDtcbiAgICAgICAgb2JqRGF0YS52aWRlb0hlaWdodCA9IGRhdGEudmlkZW9IZWlnaHQ7XG4gICAgICAgIG9ialRyYW5zZmVyYWJsZS5wdXNoKG9iakRhdGEudmlkZW9Nb292KTtcbiAgICAgIH1cbiAgICAgIC8vIHBhc3MgbW9vdiBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhLG9ialRyYW5zZmVyYWJsZSk7XG4gICAgfSk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIGZ1bmN0aW9uKGV2LGRhdGEpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2ICwgdHlwZSA6IGRhdGEudHlwZSwgc3RhcnRQVFMgOiBkYXRhLnN0YXJ0UFRTLCBlbmRQVFMgOiBkYXRhLmVuZFBUUyAsIHN0YXJ0RFRTIDogZGF0YS5zdGFydERUUywgZW5kRFRTIDogZGF0YS5lbmREVFMgLG1vb2YgOiBkYXRhLm1vb2YuYnVmZmVyLCBtZGF0IDogZGF0YS5tZGF0LmJ1ZmZlcn07XG4gICAgICAvLyBwYXNzIG1vb2YvbWRhdCBkYXRhIGFzIHRyYW5zZmVyYWJsZSBvYmplY3QgKG5vIGNvcHkpXG4gICAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEsW29iakRhdGEubW9vZixvYmpEYXRhLm1kYXRdKTtcbiAgICB9KTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNFRCwgZnVuY3Rpb24oZXYpIHtcbiAgICAgIHZhciBvYmpEYXRhID0geyBldmVudCA6IGV2IH07XG4gICAgICBzZWxmLnBvc3RNZXNzYWdlKG9iakRhdGEpO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcldvcmtlcjtcblxuIiwiZXhwb3J0IGRlZmF1bHQge1xuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIHZpZGVvIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhU291cmNlIH1cbiAgTVNFX0FUVEFDSEVEIDogJ2hsc01lZGlhU291cmNlQXR0YWNoZWQnLFxuICAvLyBmaXJlZCBhZnRlciBtYW5pZmVzdCBoYXMgYmVlbiBsb2FkZWQgLSBkYXRhOiB7IGxldmVscyA6IFthdmFpbGFibGUgcXVhbGl0eSBsZXZlbHNdICwgdXJsIDogbWFuaWZlc3RVUkwsIHN0YXRzIDogeyB0cmVxdWVzdCwgdGZpcnN0LCB0bG9hZCwgbXRpbWV9fVxuICBNQU5JRkVTVF9MT0FERUQgIDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIHN0YXJ0TGV2ZWwgOiBwbGF5YmFjayBzdGFydCBsZXZlbCwgYXVkaW9jb2RlY3N3aXRjaDogdHJ1ZSBpZiBkaWZmZXJlbnQgYXVkaW8gY29kZWNzIHVzZWR9XG4gIE1BTklGRVNUX1BBUlNFRCAgOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGxldmVsSWQgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkcgICAgOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHBsYXlsaXN0IGxvYWRpbmcgZmluaXNoZXMgLSBkYXRhOiB7IGRldGFpbHMgOiBsZXZlbERldGFpbHMgb2JqZWN0LCBsZXZlbElkIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRCA6ICAnaGxzTGV2ZWxMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgc3dpdGNoIGlzIHJlcXVlc3RlZCAtIGRhdGE6IHsgbGV2ZWxJZCA6IGlkIG9mIG5ldyBsZXZlbCB9XG4gIExFVkVMX1NXSVRDSCA6ICAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORyA6ICAnaGxzRnJhZ21lbnRMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgY29tcGxldGVkIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBwYXlsb2FkIDogZnJhZ21lbnQgcGF5bG9hZCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBsZW5ndGh9fVxuICBGUkFHX0xPQURFRCA6ICAnaGxzRnJhZ21lbnRMb2FkZWQnLFxuICAvLyBmaXJlZCB3aGVuIEluaXQgU2VnbWVudCBoYXMgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgbW9vdiA6IG1vb3YgTVA0IGJveCwgY29kZWNzIDogY29kZWNzIGZvdW5kIHdoaWxlIHBhcnNpbmcgZnJhZ21lbnR9XG4gIEZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0luaXRTZWdtZW50JyxcbiAgLy8gZmlyZWQgd2hlbiBtb29mL21kYXQgaGF2ZSBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb29mIDogbW9vZiBNUDQgYm94LCBtZGF0IDogbWRhdCBNUDQgYm94fVxuICBGUkFHX1BBUlNJTkdfREFUQSA6ICAnaGxzRnJhZ21lbnRQYXJzaW5nRGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcGFyc2luZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB1bmRlZmluZWRcbiAgRlJBR19QQVJTRUQgOiAgJ2hsc0ZyYWdtZW50UGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCByZW11eGVkIE1QNCBib3hlcyBoYXZlIGFsbCBiZWVuIGFwcGVuZGVkIGludG8gU291cmNlQnVmZmVyIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIHRwYXJzZWQsIHRidWZmZXJlZCwgbGVuZ3RofSB9XG4gIEZSQUdfQlVGRkVSRUQgOiAgJ2hsc0ZyYWdtZW50QnVmZmVyZWQnLFxuICAvLyBmaXJlZCB3aGVuIHBsYXliYWNrIG9mIG5ldyBmcmFnbWVudCBzdGFydHMgLSBkYXRhIDogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0IH1cbiAgRlJBR19QTEFZSU5HIDogICdobHNGcmFnbWVudFBsYXlpbmcnLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudC9wbGF5bGlzdCBsb2FkIGVycm9yIC0gZGF0YTogeyB1cmwgOiBmYXVsdHkgVVJMLCByZXNwb25zZSA6IFhIUiByZXNwb25zZX1cbiAgTE9BRF9FUlJPUiA6ICAnaGxzTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9FUlJPUiA6ICAnaGxzTGV2ZWxFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgdmlkZW8gZXJyb3IgLSAgZGF0YTogdW5kZWZpbmVkXG4gIFZJREVPX0VSUk9SIDogICdobHNWaWRlb0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1IgOiAgJ2hsc0ZyYWdtZW50UGFyc2luZ0Vycm9yJ1xufTtcbiIsIi8qKlxuICogSExTIGVuZ2luZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi9vYnNlcnZlcic7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgICAgICAgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBCdWZmZXJDb250cm9sbGVyICAgICBmcm9tICcuL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXInO1xuaW1wb3J0IExldmVsQ29udHJvbGxlciAgICAgIGZyb20gJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCB7bG9nZ2VyLGVuYWJsZUxvZ3N9ICBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG4vL2ltcG9ydCBNUDRJbnNwZWN0ICAgICAgICAgZnJvbSAnL3JlbXV4L21wNC1pbnNwZWN0b3InO1xuXG5jbGFzcyBIbHMge1xuXG4gIHN0YXRpYyBpc1N1cHBvcnRlZCgpIHtcbiAgICByZXR1cm4gKHdpbmRvdy5NZWRpYVNvdXJjZSAmJiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbmV3IFBsYXlsaXN0TG9hZGVyKCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIgPSBuZXcgTGV2ZWxDb250cm9sbGVyKHRoaXMucGxheWxpc3RMb2FkZXIpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBCdWZmZXJDb250cm9sbGVyKHRoaXMubGV2ZWxDb250cm9sbGVyKTtcbiAgICB0aGlzLkV2ZW50cyA9IEV2ZW50O1xuICAgIHRoaXMuZGVidWcgPSBlbmFibGVMb2dzO1xuICAgIHRoaXMubG9nRXZ0ID0gdGhpcy5sb2dFdnQ7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lci5iaW5kKG9ic2VydmVyKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy5wbGF5bGlzdExvYWRlcikge1xuICAgICAgdGhpcy5wbGF5bGlzdExvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5idWZmZXJDb250cm9sbGVyKSB7XG4gICAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYodGhpcy5sZXZlbENvbnRyb2xsZXIpIHtcbiAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubGV2ZWxDb250cm9sbGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51bmxvYWRTb3VyY2UoKTtcbiAgICB0aGlzLmRldGFjaFZpZGVvKCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gIH1cblxuICBhdHRhY2hWaWRlbyh2aWRlbykge1xuICAgIHRoaXMudmlkZW8gPSB2aWRlbztcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgdmlkZW8uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gICAgdGhpcy5vbnZlcnJvciA9IHRoaXMub25WaWRlb0Vycm9yLmJpbmQodGhpcyk7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLHRoaXMub252ZXJyb3IpO1xuICB9XG5cbiAgZGV0YWNoVmlkZW8oKSB7XG4gICAgdmFyIHZpZGVvID0gdGhpcy52aWRlbztcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmKG1zKSB7XG4gICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIGlmKHZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSB2aWRlbyBlcnJvciBsaXN0ZW5lclxuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLHRoaXMub252ZXJyb3IpO1xuICAgICAgdGhpcy5vbnZlcnJvciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgbG9hZFNvdXJjZSh1cmwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICBsb2dnZXIubG9nKCdsb2FkU291cmNlOicrdXJsKTtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHVybCxudWxsKTtcbiAgfVxuXG4gIHVubG9hZFNvdXJjZSgpIHtcbiAgICB0aGlzLnVybCA9IG51bGw7XG4gIH1cblxuICAvKiogUmV0dXJuIGFsbCBxdWFsaXR5IGxldmVscyAqKi9cbiAgZ2V0IGxldmVscygpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWxzO1xuICB9XG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbGFzdCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5maXJzdExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBmaXJzdCBsZXZlbCAoaW5kZXggb2YgZmlyc3QgbGV2ZWwgcmVmZXJlbmNlZCBpbiBtYW5pZmVzdClcbiAgKiovXG4gIHNldCBmaXJzdExldmVsKG5ld0xldmVsKSB7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0ICBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSBjYXBwaW5nL21heCBsZXZlbCB2YWx1ZSB0aGF0IGNvdWxkIGJlIHVzZWQgYnkgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbiBhbGdvcml0aG0gKiovXG4gIGdldCBhdXRvTGV2ZWxDYXBwaW5nKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmcgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qIGNoZWNrIGlmIHdlIGFyZSBpbiBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIG1vZGUgKi9cbiAgZ2V0IGF1dG9MZXZlbEVuYWJsZWQoKSB7XG4gICAgcmV0dXJuICh0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCAgPT09IC0xKTtcbiAgfVxuXG4gIC8qIHJldHVybiBtYW51YWwgbGV2ZWwgKi9cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbDtcbiAgfVxuXG4gIC8qIHJldHVybiBjdXJyZW50IHBsYXliYWNrIGxldmVsICovXG4gIGdldCBwbGF5YmFja0xldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIucGxheWJhY2tMZXZlbDtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VPcGVuKCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTVNFX0FUVEFDSEVELCB7IHZpZGVvOiB0aGlzLnZpZGVvLCBtZWRpYVNvdXJjZSA6IHRoaXMubWVkaWFTb3VyY2UgfSk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlQ2xvc2UoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGNsb3NlZCcpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBlbmRlZCcpO1xuICB9XG5cbiAgb25WaWRlb0Vycm9yKCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuVklERU9fRVJST1IpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEhscztcbiIsIiAvKlxuICogZnJhZ21lbnQgbG9hZGVyXG4gKlxuICovXG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmFib3J0KCk7XG4gICAgdGhpcy54aHIgPSBudWxsO1xuICB9XG5cbiAgYWJvcnQoKSB7XG4gICAgaWYodGhpcy54aHIgJiZ0aGlzLnhoci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnhoci5hYm9ydCgpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQoZnJhZyxsZXZlbElkKSB7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICB0aGlzLmxldmVsSWQgPSBsZXZlbElkO1xuICAgIHRoaXMudHJlcXVlc3QgPSBuZXcgRGF0ZSgpO1xuICAgIHRoaXMudGZpcnN0ID0gbnVsbDtcbiAgICB2YXIgeGhyID0gdGhpcy54aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkPSAgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vbmVycm9yID0gdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIGZyYWcudXJsICwgdHJ1ZSk7XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgeGhyLnNlbmQoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRElORywgeyBmcmFnIDogZnJhZ30pO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQpIHtcbiAgICB2YXIgcGF5bG9hZCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2U7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgeyBwYXlsb2FkIDogcGF5bG9hZCxcbiAgICAgICAgICAgICAgICAgICAgICBmcmFnIDogdGhpcy5mcmFnICxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHt0cmVxdWVzdCA6IHRoaXMudHJlcXVlc3QsIHRmaXJzdCA6IHRoaXMudGZpcnN0LCB0bG9hZCA6IG5ldyBEYXRlKCksIGxlbmd0aCA6cGF5bG9hZC5ieXRlTGVuZ3RoIH19KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGxvZ2dlci5sb2coJ2Vycm9yIGxvYWRpbmcgJyArIHRoaXMuZnJhZy51cmwpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTE9BRF9FUlJPUiwgeyB1cmwgOiB0aGlzLmZyYWcudXJsLCBldmVudDpldmVudH0pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuICAgIGlmKHRoaXMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICB0aGlzLnRmaXJzdCA9IG5ldyBEYXRlKCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIHBsYXlsaXN0IGxvYWRlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG4vL2ltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgUGxheWxpc3RMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubWFuaWZlc3RMb2FkZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy54aHIgJiZ0aGlzLnhoci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnhoci5hYm9ydCgpO1xuICAgICAgdGhpcy54aHIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnVybCA9IHRoaXMuaWQgPSBudWxsO1xuICB9XG5cbiAgbG9hZCh1cmwscmVxdWVzdElkKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5pZCA9IHJlcXVlc3RJZDtcbiAgICB0aGlzLnN0YXRzID0geyB0cmVxdWVzdCA6IG5ldyBEYXRlKCl9O1xuICAgIHZhciB4aHIgPSB0aGlzLnhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHhoci5vbmxvYWQ9ICB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9uZXJyb3IgPSB0aGlzLmxvYWRlcnJvci5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub3BlbignR0VUJywgdXJsLCB0cnVlKTtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICB2YXIgZG9jICAgICAgPSBkb2N1bWVudCxcbiAgICAgICAgb2xkQmFzZSA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdLFxuICAgICAgICBvbGRIcmVmID0gb2xkQmFzZSAmJiBvbGRCYXNlLmhyZWYsXG4gICAgICAgIGRvY0hlYWQgPSBkb2MuaGVhZCB8fCBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXSxcbiAgICAgICAgb3VyQmFzZSA9IG9sZEJhc2UgfHwgZG9jSGVhZC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnYmFzZScpKSxcbiAgICAgICAgcmVzb2x2ZXIgPSBkb2MuY3JlYXRlRWxlbWVudCgnYScpLFxuICAgICAgICByZXNvbHZlZFVybDtcblxuICAgIG91ckJhc2UuaHJlZiA9IGJhc2VVcmw7XG4gICAgcmVzb2x2ZXIuaHJlZiA9IHVybDtcbiAgICByZXNvbHZlZFVybCAgPSByZXNvbHZlci5ocmVmOyAvLyBicm93c2VyIG1hZ2ljIGF0IHdvcmsgaGVyZVxuXG4gICAgaWYgKG9sZEJhc2UpIHtvbGRCYXNlLmhyZWYgPSBvbGRIcmVmO31cbiAgICBlbHNlIHtkb2NIZWFkLnJlbW92ZUNoaWxkKG91ckJhc2UpO31cbiAgICByZXR1cm4gcmVzb2x2ZWRVcmw7XG4gIH1cblxuICBwYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyxiYXNldXJsKSB7XG4gICAgdmFyIGxldmVscyA9IFtdLGxldmVsID0gIHt9LHJlc3VsdCxjb2RlY3MsY29kZWM7XG4gICAgdmFyIHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOihbXlxcblxccl0qKEJBTkQpV0lEVEg9KFxcZCspKT8oW15cXG5cXHJdKihDT0RFQ1MpPVxcXCIoLiopXFxcIiwpPyhbXlxcblxccl0qKFJFUylPTFVUSU9OPShcXGQrKXgoXFxkKykpPyhbXlxcblxccl0qKE5BTUUpPVxcXCIoLiopXFxcIik/W15cXG5cXHJdKltcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4peyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7fSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0LnBvcCgpLGJhc2V1cmwpO1xuICAgICAgd2hpbGUocmVzdWx0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgc3dpdGNoKHJlc3VsdC5zaGlmdCgpKSB7XG4gICAgICAgICAgY2FzZSAnUkVTJzpcbiAgICAgICAgICAgIGxldmVsLndpZHRoID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnQkFORCc6XG4gICAgICAgICAgICBsZXZlbC5iaXRyYXRlID0gcGFyc2VJbnQocmVzdWx0LnNoaWZ0KCkpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnTkFNRSc6XG4gICAgICAgICAgICBsZXZlbC5uYW1lID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdDT0RFQ1MnOlxuICAgICAgICAgICAgY29kZWNzID0gcmVzdWx0LnNoaWZ0KCkuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHdoaWxlKGNvZGVjcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvZGVjID0gY29kZWNzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgIGlmKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBsZXZlbC52aWRlb0NvZGVjID0gdGhpcy5hdmMxdG9hdmNvdGkoY29kZWMpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXZlbHMucHVzaChsZXZlbCk7XG4gICAgICBsZXZlbCA9IHt9O1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCxhdmNkYXRhID0gY29kZWMuc3BsaXQoJy4nKTtcbiAgICBpZihhdmNkYXRhLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJlc3VsdCA9IGF2Y2RhdGEuc2hpZnQoKSArICcuJztcbiAgICAgIHJlc3VsdCArPSBwYXJzZUludChhdmNkYXRhLnNoaWZ0KCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgIHJlc3VsdCArPSAoJzAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwsIGlkKSB7XG4gICAgdmFyIGN1cnJlbnRTTiA9IDAsdG90YWxkdXJhdGlvbiA9IDAsIGxldmVsID0geyB1cmwgOiBiYXNldXJsLCBmcmFnbWVudHMgOiBbXSwgbGl2ZSA6IHRydWV9LCByZXN1bHQsIHJlZ2V4cDtcbiAgICByZWdleHAgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQoSU5GKTooW1xcZFxcLl0rKVteXFxyXFxuXSpbXFxyXFxuXSsoW15cXHJcXG5dKyl8KD86I0VYVC1YLShFTkRMSVNUKSkpL2c7XG4gICAgd2hpbGUoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgc3dpdGNoKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gbGV2ZWwuc3RhcnRTTiA9IHBhcnNlSW50KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ1RBUkdFVERVUkFUSU9OJzpcbiAgICAgICAgICBsZXZlbC50YXJnZXRkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRU5ETElTVCc6XG4gICAgICAgICAgbGV2ZWwubGl2ZSA9IGZhbHNlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdJTkYnOlxuICAgICAgICAgIHZhciBkdXJhdGlvbiA9IHBhcnNlRmxvYXQocmVzdWx0WzFdKTtcbiAgICAgICAgICBsZXZlbC5mcmFnbWVudHMucHVzaCh7dXJsIDogdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSxiYXNldXJsKSwgZHVyYXRpb24gOiBkdXJhdGlvbiwgc3RhcnQgOiB0b3RhbGR1cmF0aW9uLCBzbiA6IGN1cnJlbnRTTisrLCBsZXZlbDppZH0pO1xuICAgICAgICAgIHRvdGFsZHVyYXRpb24rPWR1cmF0aW9uO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZvdW5kICcgKyBsZXZlbC5mcmFnbWVudHMubGVuZ3RoICsgJyBmcmFnbWVudHMnKTtcbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gICAgcmV0dXJuIGxldmVsO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQpIHtcbiAgICB2YXIgZGF0YSxzdHJpbmcgPSBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlVGV4dCwgdXJsID0gZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVVSTCwgaWQgPSB0aGlzLmlkO1xuICAgIC8vIHJlc3BvbnNlVVJMIG5vdCBzdXBwb3J0ZWQgb24gc29tZSBicm93c2VycyAoaXQgaXMgdXNlZCB0byBkZXRlY3QgVVJMIHJlZGlyZWN0aW9uKVxuICAgIGlmKHVybCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBmYWxsYmFjayB0byBpbml0aWFsIFVSTFxuICAgICAgdXJsID0gdGhpcy51cmw7XG4gICAgfVxuICAgIHRoaXMuc3RhdHMudGxvYWQgPSBuZXcgRGF0ZSgpO1xuICAgIHRoaXMuc3RhdHMubXRpbWUgPSBuZXcgRGF0ZSh0aGlzLnhoci5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcblxuICAgIGlmKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgaXRcbiAgICAgICAgZGF0YSA9IHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZyx1cmwsaWQpO1xuICAgICAgICAvLyBpZiBmaXJzdCByZXF1ZXN0LCBmaXJlIG1hbmlmZXN0IGxvYWRlZCBldmVudCBiZWZvcmVoYW5kXG4gICAgICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiBbZGF0YV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsIDogdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogdGhpcy5zdGF0c30pO1xuICAgICAgICB9XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBkZXRhaWxzIDogZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWxJZCA6IGlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHRoaXMuc3RhdHN9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG11bHRpIGxldmVsIHBsYXlsaXN0LCBwYXJzZSBsZXZlbCBpbmZvXG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiB0aGlzLnBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLHVybCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWQgOiBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiB0aGlzLnN0YXRzfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTE9BRF9FUlJPUiwgeyB1cmwgOiB1cmwsIHJlc3BvbnNlIDogZXZlbnQuY3VycmVudFRhcmdldH0pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTE9BRF9FUlJPUiwgeyB1cmwgOiB0aGlzLnVybCwgcmVzcG9uc2UgOiBldmVudC5jdXJyZW50VGFyZ2V0fSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoKSB7XG4gICAgaWYodGhpcy5zdGF0cy50Zmlyc3QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zdGF0cy50Zmlyc3QgPSBuZXcgRGF0ZSgpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5bGlzdExvYWRlcjtcbiIsImltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcblxubGV0IG9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuXG5vYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgb2JzZXJ2ZXI7XG4iLCIvKipcbiAqIGdlbmVyYXRlIE1QNCBCb3hcbiAqL1xuXG5jbGFzcyBNUDQge1xuICBzdGF0aWMgaW5pdCgpIHtcbiAgICBNUDQudHlwZXMgPSB7XG4gICAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgICAgYXZjQzogW10sXG4gICAgICBidHJ0OiBbXSxcbiAgICAgIGRpbmY6IFtdLFxuICAgICAgZHJlZjogW10sXG4gICAgICBlc2RzOiBbXSxcbiAgICAgIGZ0eXA6IFtdLFxuICAgICAgaGRscjogW10sXG4gICAgICBtZGF0OiBbXSxcbiAgICAgIG1kaGQ6IFtdLFxuICAgICAgbWRpYTogW10sXG4gICAgICBtZmhkOiBbXSxcbiAgICAgIG1pbmY6IFtdLFxuICAgICAgbW9vZjogW10sXG4gICAgICBtb292OiBbXSxcbiAgICAgIG1wNGE6IFtdLFxuICAgICAgbXZleDogW10sXG4gICAgICBtdmhkOiBbXSxcbiAgICAgIHNkdHA6IFtdLFxuICAgICAgc3RibDogW10sXG4gICAgICBzdGNvOiBbXSxcbiAgICAgIHN0c2M6IFtdLFxuICAgICAgc3RzZDogW10sXG4gICAgICBzdHN6OiBbXSxcbiAgICAgIHN0dHM6IFtdLFxuICAgICAgdGZkdDogW10sXG4gICAgICB0ZmhkOiBbXSxcbiAgICAgIHRyYWY6IFtdLFxuICAgICAgdHJhazogW10sXG4gICAgICB0cnVuOiBbXSxcbiAgICAgIHRyZXg6IFtdLFxuICAgICAgdGtoZDogW10sXG4gICAgICB2bWhkOiBbXSxcbiAgICAgIHNtaGQ6IFtdXG4gICAgfTtcblxuICAgIHZhciBpO1xuICAgIGZvciAoaSBpbiBNUDQudHlwZXMpIHtcbiAgICAgIGlmIChNUDQudHlwZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgTVA0LnR5cGVzW2ldID0gW1xuICAgICAgICAgIGkuY2hhckNvZGVBdCgwKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMSksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDIpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgzKVxuICAgICAgICBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIE1QNC5NQUpPUl9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdpJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3MnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnbycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdtJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG4gICAgTVA0LkFWQzFfQlJBTkQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAnYScuY2hhckNvZGVBdCgwKSxcbiAgICAgICd2Jy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ2MnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnMScuY2hhckNvZGVBdCgwKVxuICAgIF0pO1xuICAgIE1QNC5NSU5PUl9WRVJTSU9OID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDAsIDAsIDFdKTtcbiAgICBNUDQuVklERU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LCAvLyBoYW5kbGVyX3R5cGU6ICd2aWRlJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgIDB4NmYsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdWaWRlb0hhbmRsZXInXG4gICAgXSk7XG4gICAgTVA0LkFVRElPX0hETFIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTMsIDB4NmYsIDB4NzUsIDB4NmUsXG4gICAgICAweDY0LCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICAgIF0pO1xuICAgIE1QNC5IRExSX1RZUEVTID0ge1xuICAgICAgJ3ZpZGVvJzpNUDQuVklERU9fSERMUixcbiAgICAgICdhdWRpbyc6TVA0LkFVRElPX0hETFJcbiAgICB9O1xuICAgIE1QNC5EUkVGID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZW50cnlfY291bnRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MGMsIC8vIGVudHJ5X3NpemVcbiAgICAgIDB4NzUsIDB4NzIsIDB4NmMsIDB4MjAsIC8vICd1cmwnIHR5cGVcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSAvLyBlbnRyeV9mbGFnc1xuICAgIF0pO1xuICAgIE1QNC5TVENPID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAgLy8gZW50cnlfY291bnRcbiAgICBdKTtcbiAgICBNUDQuU1RTQyA9IE1QNC5TVENPO1xuICAgIE1QNC5TVFRTID0gTVA0LlNUQ087XG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5WTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGdyYXBoaWNzbW9kZVxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwIC8vIG9wY29sb3JcbiAgICBdKTtcbiAgICBNUDQuU01IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBiYWxhbmNlXG4gICAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gICAgXSk7XG5cbiAgICBNUDQuU1RTRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTsvLyBlbnRyeV9jb3VudFxuXG4gICAgTVA0LkZUWVAgPSBNUDQuYm94KE1QNC50eXBlcy5mdHlwLCBNUDQuTUFKT1JfQlJBTkQsIE1QNC5NSU5PUl9WRVJTSU9OLCBNUDQuTUFKT1JfQlJBTkQsIE1QNC5BVkMxX0JSQU5EKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIE1QNC5EUkVGKSk7XG4gIH1cblxuICBzdGF0aWMgYm94KHR5cGUpIHtcbiAgdmFyXG4gICAgcGF5bG9hZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG4gICAgc2l6ZSA9IDAsXG4gICAgaSA9IHBheWxvYWQubGVuZ3RoLFxuICAgIHJlc3VsdCxcbiAgICB2aWV3O1xuXG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSArIDgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcocmVzdWx0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgcmVzdWx0LmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQodHlwZSwgNCk7XG5cbiAgICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICAgIGZvciAoaSA9IDAsIHNpemUgPSA4OyBpIDwgcGF5bG9hZC5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0LnNldChwYXlsb2FkW2ldLCBzaXplKTtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgc3RhdGljIGhkbHIodHlwZSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5oZGxyLCBNUDQuSERMUl9UWVBFU1t0eXBlXSk7XG4gIH1cblxuICBzdGF0aWMgbWRhdChkYXRhKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kYXQsIGRhdGEpO1xuICB9XG5cbiAgc3RhdGljIG1kaGQoZHVyYXRpb24pIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMywgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDEsIDB4NWYsIDB4OTAsIC8vIHRpbWVzY2FsZSwgOTAsMDAwIFwidGlja3NcIiBwZXIgc2Vjb25kXG4gICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgKGR1cmF0aW9uID4+IDE2KSAmIDB4RkYsXG4gICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4NTUsIDB4YzQsIC8vICd1bmQnIGxhbmd1YWdlICh1bmRldGVybWluZWQpXG4gICAgICAweDAwLCAweDAwXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1kaWEodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRpYSwgTVA0Lm1kaGQodHJhY2suZHVyYXRpb24pLCBNUDQuaGRscih0cmFjay50eXBlKSwgTVA0Lm1pbmYodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyBtZmhkKHNlcXVlbmNlTnVtYmVyKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1maGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+IDI0KSxcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAxNikgJiAweEZGLFxuICAgICAgKHNlcXVlbmNlTnVtYmVyID4+ICA4KSAmIDB4RkYsXG4gICAgICBzZXF1ZW5jZU51bWJlciAmIDB4RkYsIC8vIHNlcXVlbmNlX251bWJlclxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtaW5mKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5taW5mLCBNUDQuYm94KE1QNC50eXBlcy5zbWhkLCBNUDQuU01IRCksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMudm1oZCwgTVA0LlZNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgbW9vZihzbiwgYmFzZU1lZGlhRGVjb2RlVGltZSwgdHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubW9vZixcbiAgICAgICAgICAgICAgICAgICBNUDQubWZoZChzbiksXG4gICAgICAgICAgICAgICAgICAgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQoZHVyYXRpb24pIHtcbiAgICB2YXJcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAxLCAweDVmLCAweDkwLCAvLyB0aW1lc2NhbGUsIDkwLDAwMCBcInRpY2tzXCIgcGVyIHNlY29uZFxuICAgICAgICAoZHVyYXRpb24gPj4gMjQpLFxuICAgICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIGZsYWdzLFxuICAgICAgaTtcblxuICAgIC8vIGxlYXZlIHRoZSBmdWxsIGJveCBoZWFkZXIgKDQgYnl0ZXMpIGFsbCB6ZXJvXG5cbiAgICAvLyB3cml0ZSB0aGUgc2FtcGxlIHRhYmxlXG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZsYWdzID0gc2FtcGxlc1tpXS5mbGFncztcbiAgICAgIGJ5dGVzW2kgKyA0XSA9IChmbGFncy5kZXBlbmRzT24gPDwgNCkgfFxuICAgICAgICAoZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDIpIHxcbiAgICAgICAgKGZsYWdzLmhhc1JlZHVuZGFuY3kpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zZHRwLFxuICAgICAgICAgICAgICAgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCxcbiAgICAgICAgICAgICAgIE1QNC5zdHNkKHRyYWNrKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0dHMsIE1QNC5TVFRTKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0Y28sIE1QNC5TVENPKSk7XG4gIH1cblxuICBzdGF0aWMgYXZjMSh0cmFjaykge1xuICAgIHZhciBzcHMgPSBbXSwgcHBzID0gW10sIGk7XG4gICAgLy8gYXNzZW1ibGUgdGhlIFNQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzcHMucHVzaCgodHJhY2suc3BzW2ldLmJ5dGVMZW5ndGggPj4+IDgpICYgMHhGRik7XG4gICAgICBzcHMucHVzaCgodHJhY2suc3BzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7IC8vIHNlcXVlbmNlUGFyYW1ldGVyU2V0TGVuZ3RoXG4gICAgICBzcHMgPSBzcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRyYWNrLnNwc1tpXSkpOyAvLyBTUFNcbiAgICB9XG5cbiAgICAvLyBhc3NlbWJsZSB0aGUgUFBTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5wcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHBwcy5wdXNoKCh0cmFjay5wcHNbaV0uYnl0ZUxlbmd0aCA+Pj4gOCkgJiAweEZGKTtcbiAgICAgIHBwcy5wdXNoKCh0cmFjay5wcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTtcbiAgICAgIHBwcyA9IHBwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodHJhY2sucHBzW2ldKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmF2YzEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgKHRyYWNrLndpZHRoID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2sud2lkdGggJiAweGZmLCAvLyB3aWR0aFxuICAgICAgICAodHJhY2suaGVpZ2h0ID4+IDgpICYgMHhGRixcbiAgICAgICAgdHJhY2suaGVpZ2h0ICYgMHhmZiwgLy8gaGVpZ2h0XG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIGhvcml6cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyB2ZXJ0cmVzb2x1dGlvblxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBmcmFtZV9jb3VudFxuICAgICAgICAweDEzLFxuICAgICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgICAweDZmLCAweDZhLCAweDczLCAweDJkLFxuICAgICAgICAweDYzLCAweDZmLCAweDZlLCAweDc0LFxuICAgICAgICAweDcyLCAweDY5LCAweDYyLCAweDJkLFxuICAgICAgICAweDY4LCAweDZjLCAweDczLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBjb21wcmVzc29ybmFtZVxuICAgICAgICAweDAwLCAweDE4LCAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmF2Y0MsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDEsIC8vIGNvbmZpZ3VyYXRpb25WZXJzaW9uXG4gICAgICAgICAgICB0cmFjay5wcm9maWxlSWRjLCAvLyBBVkNQcm9maWxlSW5kaWNhdGlvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUNvbXBhdGliaWxpdHksIC8vIHByb2ZpbGVfY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgdHJhY2subGV2ZWxJZGMsIC8vIEFWQ0xldmVsSW5kaWNhdGlvblxuICAgICAgICAgICAgMHhmZiAvLyBsZW5ndGhTaXplTWludXNPbmUsIGhhcmQtY29kZWQgdG8gNCBieXRlc1xuICAgICAgICAgIF0uY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnNwcy5sZW5ndGggLy8gbnVtT2ZTZXF1ZW5jZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQoc3BzKS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2sucHBzLmxlbmd0aCAvLyBudW1PZlBpY3R1cmVQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHBwcykpKSwgLy8gXCJQUFNcIlxuICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmJ0cnQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgIDB4MDAsIDB4MWMsIDB4OWMsIDB4ODAsIC8vIGJ1ZmZlclNpemVEQlxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMF0pKSAvLyBhdmdCaXRyYXRlXG4gICAgICAgICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBlc2RzKHRyYWNrKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcblxuICAgICAgMHgwMywgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDE3K3RyYWNrLmNvbmZpZy5sZW5ndGgsIC8vIGxlbmd0aFxuICAgICAgMHgwMCwgMHgwMSwgLy9lc19pZFxuICAgICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAgIDB4MDQsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgwZit0cmFjay5jb25maWcubGVuZ3RoLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICBdLmNvbmNhdChbdHJhY2suY29uZmlnLmxlbmd0aF0pLmNvbmNhdCh0cmFjay5jb25maWcpLmNvbmNhdChbMHgwNiwgMHgwMSwgMHgwMl0pKTsgLy8gR0FTcGVjaWZpY0NvbmZpZykpOyAvLyBsZW5ndGggKyBhdWRpbyBjb25maWcgZGVzY3JpcHRvclxuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgdHJhY2suY2hhbm5lbENvdW50LCAvLyBjaGFubmVsY291bnRcbiAgICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWQyXG4gICAgICAgICh0cmFjay5hdWRpb3NhbXBsZXJhdGUgPj4gOCkgJiAweEZGLFxuICAgICAgICB0cmFjay5hdWRpb3NhbXBsZXJhdGUgJiAweGZmLCAvL1xuICAgICAgICAweDAwLCAweDAwXSksXG4gICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLmVzZHMsIE1QNC5lc2RzKHRyYWNrKSkpO1xuICB9XG5cbiAgc3RhdGljIHN0c2QodHJhY2spIHtcbiAgICBpZiAodHJhY2sudHlwZSA9PT0gJ2F1ZGlvJykge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNEICwgTVA0Lm1wNGEodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnN0c2QsIE1QNC5TVFNEICwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKHRyYWNrLmlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAodHJhY2suaWQgPj4gMTYpICYgMHhGRixcbiAgICAgICh0cmFjay5pZCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5pZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+IDI0KSxcbiAgICAgICh0cmFjay5kdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKHRyYWNrLmR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5kdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh0cmFjay53aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay53aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKHRyYWNrLmhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICB0cmFjay5oZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLFxuICAgICAgICAgICAgICAgTVA0LnRraGQodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0Lm1kaWEodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmV4KHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyZXgsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgKHRyYWNrLmlkID4+IDI0KSxcbiAgICAgKHRyYWNrLmlkID4+IDE2KSAmIDBYRkYsXG4gICAgICh0cmFjay5pZCA+PiA4KSAmIDBYRkYsXG4gICAgICh0cmFjay5pZCAmIDB4RkYpLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZGVmYXVsdF9zYW1wbGVfZGVzY3JpcHRpb25faW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX2R1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9zaXplXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAxIC8vIGRlZmF1bHRfc2FtcGxlX2ZsYWdzXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIHRydW4odHJhY2ssIG9mZnNldCkge1xuICAgIHZhciBzYW1wbGVzLCBzYW1wbGUsIGksIGFycmF5O1xuXG4gICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW107XG4gICAgYXJyYXkgPSBuZXcgVWludDhBcnJheSgxMiArICgxNiAqIHNhbXBsZXMubGVuZ3RoKSk7XG4gICAgb2Zmc2V0ICs9IDggKyBhcnJheS5ieXRlTGVuZ3RoO1xuXG4gICAgYXJyYXkuc2V0KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gMTYpICYgMHhGRixcbiAgICAgIChzYW1wbGVzLmxlbmd0aCA+Pj4gOCkgJiAweEZGLFxuICAgICAgc2FtcGxlcy5sZW5ndGggJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGFycmF5LnNldChbXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLmR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzYW1wbGUuc2l6ZSA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKHNhbXBsZS5zaXplID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLnNpemUgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2FtcGxlLnNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzTGVhZGluZyA8PCAyKSB8IHNhbXBsZS5mbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLmhhc1JlZHVuZGFuY3kgPDwgNCkgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBzYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlLFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkYXRpb25Qcmlvcml0eSAmIDB4RjAgPDwgOCxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZGF0aW9uUHJpb3JpdHkgJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0sMTIrMTYqaSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBhcnJheSk7XG4gIH1cblxuICBzdGF0aWMgaW5pdFNlZ21lbnQodHJhY2tzKSB7XG5cbiAgICBpZighTVA0LnR5cGVzKSB7XG4gICAgICBNUDQuaW5pdCgpO1xuICAgIH1cbiAgICB2YXJcbiAgICAgIG1vdmllID0gTVA0Lm1vb3YodHJhY2tzKSxcbiAgICAgIHJlc3VsdDtcblxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KE1QNC5GVFlQLmJ5dGVMZW5ndGggKyBtb3ZpZS5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KE1QNC5GVFlQKTtcbiAgICByZXN1bHQuc2V0KG1vdmllLCBNUDQuRlRZUC5ieXRlTGVuZ3RoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNDtcblxuXG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vb3AoKXt9XG5sZXQgZmFrZUxvZ2dlciA9IHtcbiAgbG9nOiBub29wLFxuICB3YXJuOiBub29wLFxuICBpbmZvOiBub29wLFxuICBlcnJvcjogbm9vcFxufTtcbmxldCBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG5cbmV4cG9ydCB2YXIgZW5hYmxlTG9ncyA9IGZ1bmN0aW9uKGRlYnVnKSB7XG4gIGlmIChkZWJ1ZyA9PT0gdHJ1ZSB8fCB0eXBlb2YgZGVidWcgICAgICAgPT09ICdvYmplY3QnKSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBkZWJ1Zy5sb2cgICA/IGRlYnVnLmxvZy5iaW5kKGRlYnVnKSAgIDogY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci5pbmZvICA9IGRlYnVnLmluZm8gID8gZGVidWcuaW5mby5iaW5kKGRlYnVnKSAgOiBjb25zb2xlLmluZm8uYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci5lcnJvciA9IGRlYnVnLmVycm9yID8gZGVidWcuZXJyb3IuYmluZChkZWJ1ZykgOiBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBkZWJ1Zy53YXJuICA/IGRlYnVnLndhcm4uYmluZChkZWJ1ZykgIDogY29uc29sZS53YXJuLmJpbmQoY29uc29sZSk7XG5cbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGFsbG93IHRvIHVzZSBiaW5kIG9uIGNvbnNvbGUgb2JqZWN0IGFueXdheVxuICAgIC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgZXhwb3J0ZWRMb2dnZXIubG9nKCk7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICBleHBvcnRlZExvZ2dlci5sb2cgICA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci5pbmZvICA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci5lcnJvciA9IG5vb3A7XG4gICAgICBleHBvcnRlZExvZ2dlci53YXJuICA9IG5vb3A7XG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcbiAgfVxufTtcbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iXX0=
