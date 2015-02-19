!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Hls=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/g.dupontavice/workdir/github/mse-hls/node_modules/browserify/node_modules/events/events.js":[function(require,module,exports){
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

},{}],"/Users/g.dupontavice/workdir/github/mse-hls/src/controller/buffer-controller.js":[function(require,module,exports){
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
var TSDemuxer = _interopRequire(require("../demux/tsdemuxer"));




var LOADING_IDLE = 0;
var LOADING_IN_PROGRESS = 1;
var LOADING_WAITING_LEVEL_UPDATE = 2;
// const LOADING_STALLED = 3;
// const LOADING_FRAGMENT_IO_ERROR = 4;
//const LOADING_COMPLETED = 5;

var BufferController = (function () {
  function BufferController(video) {
    this.video = video;
    this.fragmentLoader = new FragmentLoader();
    this.demuxer = new TSDemuxer();
    this.mp4segments = [];
    // Source Buffer listeners
    this.onsbue = this.onSourceBufferUpdateEnd.bind(this);
    this.onsbe = this.onSourceBufferError.bind(this);
    // internal listeners
    this.onll = this.onLevelLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onis = this.onInitSegment.bind(this);
    this.onfp = this.onFragmentParsed.bind(this);
    this.ontick = this.tick.bind(this);
    this.state = LOADING_WAITING_LEVEL_UPDATE;
  }

  _prototypeProperties(BufferController, null, {
    destroy: {
      value: function destroy() {
        this.stop();
        this.fragmentLoader.destroy();
        this.demuxer.destroy();
        this.mp4segments = [];
        var sb = this.sourceBuffer;
        if (sb) {
          //detach sourcebuffer from Media Source
          this.mediaSource.removeSourceBuffer(sb);
          sb.removeEventListener("updateend", this.onsbue);
          sb.removeEventListener("error", this.onsbe);
          this.sourceBuffer = null;
        }
        this.state = LOADING_WAITING_LEVEL_UPDATE;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    start: {
      value: function start(levels, mediaSource) {
        this.levels = levels;
        this.mediaSource = mediaSource;
        this.stop();
        this.timer = setInterval(this.ontick, 100);
        observer.on(Event.FRAGMENT_LOADED, this.onfl);
        observer.on(Event.INIT_SEGMENT, this.onis);
        observer.on(Event.FRAGMENT_PARSED, this.onfp);
        observer.on(Event.LEVEL_LOADED, this.onll);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    stop: {
      value: function stop() {
        if (this.timer) {
          clearInterval(this.ontick);
        }
        this.timer = undefined;
        observer.removeListener(Event.FRAGMENT_LOADED, this.onfl);
        observer.removeListener(Event.FRAGMENT_PARSED, this.onfp);
        observer.removeListener(Event.LEVEL_LOADED, this.onll);
        observer.removeListener(Event.INIT_SEGMENT, this.onis);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tick: {
      value: function tick() {
        if (this.state === LOADING_IDLE && (!this.sourceBuffer || !this.sourceBuffer.updating)) {
          // check if current play position is buffered
          var v = this.video,
              pos = v.currentTime,
              buffered = v.buffered,
              bufferLen,
              bufferEnd,
              i;
          for (i = 0, bufferLen = 0, bufferEnd = pos; i < buffered.length; i++) {
            if (pos >= buffered.start(i) && pos < buffered.end(i)) {
              // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
              bufferEnd = buffered.end(i);
              bufferLen = bufferEnd - pos;
            }
          }
          // if buffer length is less than 60s try to load a new fragment
          if (bufferLen < 60) {
            // find fragment index, contiguous with end of buffer position
            var fragments = this.levels[this.level].fragments;
            for (i = 0; i < fragments.length; i++) {
              if (fragments[i].start <= bufferEnd + 0.1 && fragments[i].start + fragments[i].duration > bufferEnd + 0.1) {
                break;
              }
            }
            if (i < fragments.length) {
              logger.log("loading frag " + i);
              this.fragmentLoader.load(fragments[i].url);
              this.state = LOADING_IN_PROGRESS;
            } else {}
          }
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onLevelLoaded: {
      value: function onLevelLoaded(event, data) {
        this.level = data.level;
        this.demuxer.duration = this.levels[this.level].totalduration;
        this.fragmentIndex = 0;
        var stats = data.stats;
        logger.log("level loaded,RTT(ms)/load(ms)/duration:" + (stats.tfirst - stats.trequest) + "/" + (stats.tend - stats.trequest) + "/" + this.demuxer.duration);
        this.state = LOADING_IDLE;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentLoaded: {
      value: function onFragmentLoaded(event, data) {
        // transmux the MPEG-TS data to ISO-BMFF segments
        this.demuxer.push(new Uint8Array(data.payload));
        this.demuxer.end();
        this.state = LOADING_IDLE;
        var stats, rtt, loadtime, bw;
        stats = data.stats;
        rtt = stats.tfirst - stats.trequest;
        loadtime = stats.tend - stats.trequest;
        bw = stats.length * 8 / (1000 * loadtime);
        //logger.log(data.url + ' loaded, RTT(ms)/load(ms)/bitrate:' + rtt + '/' + loadtime + '/' + bw.toFixed(3) + ' Mb/s');
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onInitSegment: {
      value: function onInitSegment(event, data) {
        // create source Buffer and link them to MediaSource
        var sb = this.sourceBuffer = this.mediaSource.addSourceBuffer("video/mp4;codecs=" + data.codec);
        sb.addEventListener("updateend", this.onsbue);
        sb.addEventListener("error", this.onsbe);
        this.mp4segments.push(data);
        this.appendSegments();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onFragmentParsed: {
      value: function onFragmentParsed(event, data) {
        this.mp4segments.push(data);
        this.appendSegments();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    appendSegments: {
      value: function appendSegments() {
        if (this.sourceBuffer && !this.sourceBuffer.updating && this.mp4segments.length) {
          this.sourceBuffer.appendBuffer(this.mp4segments.shift().data);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onSourceBufferUpdateEnd: {
      value: function onSourceBufferUpdateEnd() {
        //logger.log('buffer appended');
        this.appendSegments();
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
//logger.log('last fragment loaded');
//observer.trigger(Event.LAST_FRAGMENT_LOADED);
//this.state = LOADING_COMPLETED;

},{"../demux/tsdemuxer":"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/tsdemuxer.js","../events":"/Users/g.dupontavice/workdir/github/mse-hls/src/events.js","../loader/fragment-loader":"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/fragment-loader.js","../observer":"/Users/g.dupontavice/workdir/github/mse-hls/src/observer.js","../utils/logger":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/exp-golomb.js":[function(require,module,exports){
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
            numRefFramesInPicOrderCntCycle,
            picWidthInMbsMinus1,
            picHeightInMapUnitsMinus1,
            frameMbsOnlyFlag,
            scalingListCount,
            i;

        profileIdc = this.readUnsignedByte(); // profile_idc
        // constraint_set[0-5]_flag, u(1), reserved_zero_2bits u(2), level_idc u(8)
        this.skipBits(16); //  u(1), reserved_zero_2bits u(2)
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

},{"../utils/logger":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/tsdemuxer.js":[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
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

var MP4 = _interopRequire(require("../remux/mp4-generator"));

var observer = _interopRequire(require("../observer"));

var Stream = _interopRequire(require("../utils/stream"));

var logger = require("../utils/logger").logger;


var MP2T_PACKET_LENGTH = 188; // bytes
var H264_STREAM_TYPE = 27;
var ADTS_STREAM_TYPE = 15;
var PAT_PID = 0;

/**
 * Splits an incoming stream of binary data into MPEG-2 Transport
 * Stream packets.
 */
var TransportPacketStream = (function (Stream) {
  function TransportPacketStream() {
    _get(Object.getPrototypeOf(TransportPacketStream.prototype), "constructor", this).call(this);
    this.buffer = new Uint8Array(MP2T_PACKET_LENGTH);
    this.end = 0;
  }

  _inherits(TransportPacketStream, Stream);

  _prototypeProperties(TransportPacketStream, null, {
    push: {
      value: function push(bytes) {
        var remaining, i;

        // clear out any partial packets in the buffer
        if (this.end > 0) {
          remaining = MP2T_PACKET_LENGTH - this.end;
          this.buffer.set(bytes.subarray(0, remaining), this.end);

          // we still didn't write out a complete packet
          if (bytes.byteLength < remaining) {
            this.end += bytes.byteLength;
            return;
          }

          bytes = bytes.subarray(remaining);
          this.end = 0;
          this.trigger("data", this.buffer);
        }

        // if less than a single packet is available, buffer it up for later
        if (bytes.byteLength < MP2T_PACKET_LENGTH) {
          this.buffer.set(bytes.subarray(i), this.end);
          this.end += bytes.byteLength;
          return;
        }
        // parse out all the completed packets
        i = 0;
        do {
          this.trigger("data", bytes.subarray(i, i + MP2T_PACKET_LENGTH));
          i += MP2T_PACKET_LENGTH;
          remaining = bytes.byteLength - i;
        } while (i < bytes.byteLength && remaining >= MP2T_PACKET_LENGTH);
        // buffer any partial packets left over
        if (remaining > 0) {
          this.buffer.set(bytes.subarray(i));
          this.end = remaining;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TransportPacketStream;
})(Stream);

/**
 * Accepts an MP2T TransportPacketStream and emits data events with parsed
 * forms of the individual transport stream packets.
 */
var TransportParseStream = (function (Stream) {
  function TransportParseStream() {
    _get(Object.getPrototypeOf(TransportParseStream.prototype), "constructor", this).call(this);
    this.programMapTable = {};
  }

  _inherits(TransportParseStream, Stream);

  _prototypeProperties(TransportParseStream, null, {
    parsePsi: {
      value: function parsePsi(payload, psi) {
        var offset = 0;
        // PSI packets may be split into multiple sections and those
        // sections may be split into multiple packets. If a PSI
        // section starts in this packet, the payload_unit_start_indicator
        // will be true and the first byte of the payload will indicate
        // the offset from the current position to the start of the
        // section.
        if (psi.payloadUnitStartIndicator) {
          offset += payload[offset] + 1;
        }

        if (psi.type === "pat") {
          this.parsePat(payload.subarray(offset), psi);
        } else {
          this.parsePmt(payload.subarray(offset), psi);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parsePat: {
      value: function parsePat(payload, pat) {
        pat.sectionNumber = payload[7];
        pat.lastSectionNumber = payload[8];

        // skip the PSI header and parse the first PMT entry
        pat.pmtPid = this.pmtPid = (payload[10] & 31) << 8 | payload[11];
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parsePmt: {

      /**
       * Parse out the relevant fields of a Program Map Table (PMT).
       * @param payload {Uint8Array} the PMT-specific portion of an MP2T
       * packet. The first byte in this array should be the table_id
       * field.
       * @param pmt {object} the object that should be decorated with
       * fields parsed from the PMT.
       */
      value: function parsePmt(payload, pmt) {
        var sectionLength, tableEnd, programInfoLength, offset;

        // PMTs can be sent ahead of the time when they should actually
        // take effect. We don't believe this should ever be the case
        // for HLS but we'll ignore "forward" PMT declarations if we see
        // them. Future PMT declarations have the current_next_indicator
        // set to zero.
        if (!(payload[5] & 1)) {
          return;
        }

        // overwrite any existing program map table
        this.programMapTable = {};

        // the mapping table ends at the end of the current section
        sectionLength = (payload[1] & 15) << 8 | payload[2];
        tableEnd = 3 + sectionLength - 4;

        // to determine where the table is, we have to figure out how
        // long the program info descriptors are
        programInfoLength = (payload[10] & 15) << 8 | payload[11];

        // advance the offset to the first entry in the mapping table
        offset = 12 + programInfoLength;
        while (offset < tableEnd) {
          // add an entry that maps the elementary_pid to the stream_type
          this.programMapTable[(payload[offset + 1] & 31) << 8 | payload[offset + 2]] = payload[offset];

          // move to the next table entry
          // skip past the elementary stream descriptors, if present
          offset += ((payload[offset + 3] & 15) << 8 | payload[offset + 4]) + 5;
        }

        // record the map on the packet as well
        pmt.programMapTable = this.programMapTable;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parsePes: {
      value: function parsePes(payload, pes) {
        var ptsDtsFlags;

        if (!pes.payloadUnitStartIndicator) {
          pes.data = payload;
          return;
        }

        // find out if this packets starts a new keyframe
        pes.dataAlignmentIndicator = (payload[6] & 4) !== 0;
        // PES packets may be annotated with a PTS value, or a PTS value
        // and a DTS value. Determine what combination of values is
        // available to work with.
        ptsDtsFlags = payload[7];

        // PTS and DTS are normally stored as a 33-bit number.  Javascript
        // performs all bitwise operations on 32-bit integers but it's
        // convenient to convert from 90ns to 1ms time scale anyway. So
        // what we are going to do instead is drop the least significant
        // bit (in effect, dividing by two) then we can divide by 45 (45 *
        // 2 = 90) to get ms.
        if (ptsDtsFlags & 192) {
          // the PTS and DTS are not written out directly. For information
          // on how they are encoded, see
          // http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
          pes.pts = (payload[9] & 14) << 28 | (payload[10] & 255) << 21 | (payload[11] & 254) << 13 | (payload[12] & 255) << 6 | (payload[13] & 254) >>> 2;
          pes.pts /= 45;
          pes.dts = pes.pts;
          if (ptsDtsFlags & 64) {
            pes.dts = (payload[14] & 14) << 28 | (payload[15] & 255) << 21 | (payload[16] & 254) << 13 | (payload[17] & 255) << 6 | (payload[18] & 254) >>> 2;
            pes.dts /= 45;
          }
        }

        // the data section starts immediately after the PES header.
        // pes_header_data_length specifies the number of header bytes
        // that follow the last byte of the field.
        pes.data = payload.subarray(9 + payload[8]);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {

      /**
       * Deliver a new MP2T packet to the stream.
       */
      value: function push(packet) {
        var result = {},
            offset = 4;
        // make sure packet is aligned on a sync byte
        if (packet[0] !== 71) {
          return this.trigger("error", "mis-aligned packet");
        }
        result.payloadUnitStartIndicator = !!(packet[1] & 64);

        // pid is a 13-bit field starting at the last bit of packet[1]
        result.pid = packet[1] & 31;
        result.pid <<= 8;
        result.pid |= packet[2];

        // if an adaption field is present, its length is specified by the
        // fifth byte of the TS packet header. The adaptation field is
        // used to add stuffing to PES packets that don't fill a complete
        // TS packet, and to specify some forms of timing and control data
        // that we do not currently use.
        if ((packet[3] & 48) >>> 4 > 1) {
          offset += packet[offset] + 1;
        }

        // parse the rest of the packet based on the type
        if (result.pid === PAT_PID) {
          result.type = "pat";
          this.parsePsi(packet.subarray(offset), result);
        } else if (result.pid === this.pmtPid) {
          result.type = "pmt";
          this.parsePsi(packet.subarray(offset), result);
        } else {
          result.streamType = this.programMapTable[result.pid];
          if (result.streamType === undefined) {
            return;
          } else {
            result.type = "pes";
            this.parsePes(packet.subarray(offset), result);
          }
        }

        this.trigger("data", result);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TransportParseStream;
})(Stream);

/**
 * Reconsistutes program elementary stream (PES) packets from parsed
 * transport stream packets. That is, if you pipe an
 * mp2t.TransportParseStream into a mp2t.ElementaryStream, the output
 * events will be events which capture the bytes for individual PES
 * packets plus relevant metadata that has been extracted from the
 * container.
 */
var ElementaryStream = (function (Stream) {
  function ElementaryStream() {
    _get(Object.getPrototypeOf(ElementaryStream.prototype), "constructor", this).call(this);
    this.audio = { data: [], size: 0 };
    this.video = { data: [], size: 0 };
  }

  _inherits(ElementaryStream, Stream);

  _prototypeProperties(ElementaryStream, null, {
    flushStream: {
      value: function flushStream(stream, type) {
        var event = {
          type: type,
          data: new Uint8Array(stream.size) },
            i = 0,
            fragment;

        // do nothing if there is no buffered data
        if (!stream.data.length) {
          return;
        }
        event.trackId = stream.data[0].pid;
        event.pts = stream.data[0].pts;
        event.dts = stream.data[0].dts;
        // reassemble the packet
        while (stream.data.length) {
          fragment = stream.data.shift();

          event.data.set(fragment.data, i);
          i += fragment.data.byteLength;
        }
        stream.size = 0;
        this.trigger("data", event);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {
      value: function push(data) {
        switch (data.type) {
          case "pat":
            // we have to wait for the PMT to arrive as well before we
            // have any meaningful metadata
            break;
          case "pmt":
            var event = {
              type: "metadata",
              tracks: []
            },
                programMapTable = data.programMapTable,
                k,
                track;

            // translate streams to tracks
            for (k in programMapTable) {
              if (programMapTable.hasOwnProperty(k)) {
                track = {};
                track.id = +k;
                if (programMapTable[k] === H264_STREAM_TYPE) {
                  track.codec = "avc";
                  track.type = "video";
                } else if (programMapTable[k] === ADTS_STREAM_TYPE) {
                  track.codec = "adts";
                  track.type = "audio";
                }
                event.tracks.push(track);
              }
            }
            this.trigger("data", event);
            break;
          case "pes":
            var stream, streamType;

            if (data.streamType === H264_STREAM_TYPE) {
              stream = this.video;
              streamType = "video";
            } else {
              stream = this.audio;
              streamType = "audio";
            }

            // if a new packet is starting, we can flush the completed
            // packet
            if (data.payloadUnitStartIndicator) {
              this.flushStream(stream, streamType);
            }
            // buffer this fragment until we are sure we've received the
            // complete payload
            stream.data.push(data);
            stream.size += data.data.byteLength;
            break;
          default:
            break;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      /**
       * Flush any remaining input. Video PES packets may be of variable
       * length. Normally, the start of a new video packet can trigger the
       * finalization of the previous packet. That is not possible if no
       * more video is forthcoming, however. In that case, some other
       * mechanism (like the end of the file) has to be employed. When it is
       * clear that no additional data is forthcoming, calling this method
       * will flush the buffered packets.
       */
      value: function end() {
        this.flushStream(this.video, "video");
        this.flushStream(this.audio, "audio");
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return ElementaryStream;
})(Stream);

/*
 * Accepts a ElementaryStream and emits data events with parsed
 * AAC Audio Frames of the individual packets.
 */
var AacStream = (function (Stream) {
  function AacStream() {
    _get(Object.getPrototypeOf(AacStream.prototype), "constructor", this).call(this);
  }

  _inherits(AacStream, Stream);

  _prototypeProperties(AacStream, null, {
    getAudioSpecificConfig: {
      value: function getAudioSpecificConfig(data) {
        var adtsProtectionAbsent, // :Boolean
        adtsObjectType, // :int
        adtsSampleingIndex, // :int
        adtsChanelConfig, // :int
        adtsFrameSize, // :int
        adtsSampleCount, // :int
        adtsDuration; // :int

        var adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000];

        // byte 1
        adtsProtectionAbsent = !!(data[1] & 1);

        // byte 2
        adtsObjectType = ((data[2] & 192) >>> 6) + 1;
        adtsSampleingIndex = (data[2] & 60) >>> 2;
        adtsChanelConfig = (data[2] & 1) << 2;

        // byte 3
        adtsChanelConfig |= (data[3] & 192) >>> 6;
        adtsFrameSize = (data[3] & 3) << 11;

        // byte 4
        adtsFrameSize |= data[4] << 3;

        // byte 5
        adtsFrameSize |= (data[5] & 224) >>> 5;
        adtsFrameSize -= adtsProtectionAbsent ? 7 : 9;

        // byte 6
        adtsSampleCount = ((data[6] & 3) + 1) * 1024;
        adtsDuration = adtsSampleCount * 1000 / adtsSampleingRates[adtsSampleingIndex];
        this.config = new Uint8Array(2);
        /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
          Audio Profile
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
        this.config[0] = adtsObjectType << 3;

        // samplingFrequencyIndex
        this.config[0] |= (adtsSampleingIndex & 14) >> 1;
        this.config[1] |= (adtsSampleingIndex & 1) << 7;

        // channelConfiguration
        this.config[1] |= adtsChanelConfig << 3;

        this.stereo = 2 === adtsChanelConfig;
        this.audiosamplerate = adtsSampleingRates[adtsSampleingIndex];
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {
      value: function push(packet) {
        if (packet.type === "audio" && packet.data !== undefined) {
          var aacFrame,
              // :Frame = null;
          nextPTS = packet.pts,
              data = packet.data;

          // byte 0
          if (255 !== data[0]) {
            logger.error("Error no ATDS header found");
          }

          if (this.config === undefined) {
            this.getAudioSpecificConfig(data);
          }

          aacFrame = {};
          aacFrame.pts = nextPTS;
          aacFrame.dts = nextPTS;
          aacFrame.bytes = new Uint8Array();

          // AAC is always 10
          aacFrame.audiocodecid = 10;
          aacFrame.stereo = this.stereo;
          aacFrame.audiosamplerate = this.audiosamplerate;
          // Is AAC always 16 bit?
          aacFrame.audiosamplesize = 16;
          aacFrame.bytes = packet.data.subarray(7, packet.data.length);
          packet.frame = aacFrame;
          packet.config = this.config;
          packet.audiosamplerate = this.audiosamplerate;
          this.trigger("data", packet);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return AacStream;
})(Stream);

/**
 * Accepts a NAL unit byte stream and unpacks the embedded NAL units.
 */
var NalByteStream = (function (Stream) {
  function NalByteStream() {
    _get(Object.getPrototypeOf(NalByteStream.prototype), "constructor", this).call(this);
    this.index = 6;
    this.syncPoint = 1;
    this.buffer = null;
  }

  _inherits(NalByteStream, Stream);

  _prototypeProperties(NalByteStream, null, {
    push: {
      value: function push(data) {
        var swapBuffer;

        if (!this.buffer) {
          this.buffer = data.data;
        } else {
          swapBuffer = new Uint8Array(this.buffer.byteLength + data.data.byteLength);
          swapBuffer.set(this.buffer);
          swapBuffer.set(data.data, this.buffer.byteLength);
          this.buffer = swapBuffer;
        }

        // Rec. ITU-T H.264, Annex B
        // scan for NAL unit boundaries

        // a match looks like this:
        // 0 0 1 .. NAL .. 0 0 1
        // ^ sync point        ^ i
        // or this:
        // 0 0 1 .. NAL .. 0 0 0
        // ^ sync point        ^ i
        var i = this.index;
        var sync = this.syncPoint;
        var buf = this.buffer;
        while (i < buf.byteLength) {
          switch (buf[i]) {
            case 0:
              // skip past non-sync sequences
              if (buf[i - 1] !== 0) {
                i += 2;
                break;
              } else if (buf[i - 2] !== 0) {
                i++;
                break;
              }

              // deliver the NAL unit
              this.trigger("data", buf.subarray(sync + 3, i - 2));

              // drop trailing zeroes
              do {
                i++;
              } while (buf[i] !== 1);
              sync = i - 2;
              i += 3;
              break;
            case 1:
              // skip past non-sync sequences
              if (buf[i - 1] !== 0 || buf[i - 2] !== 0) {
                i += 3;
                break;
              }

              // deliver the NAL unit
              this.trigger("data", buf.subarray(sync + 3, i - 2));
              sync = i - 2;
              i += 3;
              break;
            default:
              i += 3;
              break;
          }
        }
        // filter out the NAL units that were delivered
        this.buffer = buf.subarray(sync);
        i -= sync;
        this.index = i;
        this.syncPoint = 0;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        // deliver the last buffered NAL unit
        if (this.buffer.byteLength > 3) {
          this.trigger("data", this.buffer.subarray(this.syncPoint + 3));
        }
        this.buffer = null;
        this.index = 6;
        this.syncPoint = 1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return NalByteStream;
})(Stream);

/**
 * Accepts input from a ElementaryStream and produces H.264 NAL unit data
 * events.
 */
var H264Stream = (function (Stream) {
  function H264Stream() {
    _get(Object.getPrototypeOf(H264Stream.prototype), "constructor", this).call(this);
    this.nalByteStream = new NalByteStream();
    this.nalByteStream.on("data", (function (data) {
      var event = {
        trackId: this.trackId,
        pts: this.currentPts,
        dts: this.currentDts,
        data: data
      };
      switch (data[0] & 31) {
        case 5:
          event.nalUnitType = "IDR";
          break;
        case 7:
          event.nalUnitType = "SPS";
          var expGolombDecoder = new ExpGolomb(data.subarray(1));
          event.config = expGolombDecoder.readSequenceParameterSet();
          break;
        case 8:
          event.nalUnitType = "PPS";
          break;
        case 9:
          event.nalUnitType = "AUD";
          break;

        default:
          break;
      }
      this.trigger("data", event);
    }).bind(this));
  }

  _inherits(H264Stream, Stream);

  _prototypeProperties(H264Stream, null, {
    push: {
      value: function push(packet) {
        if (packet.type !== "video") {
          return;
        }
        this.trackId = packet.trackId;
        this.currentPts = packet.pts;
        this.currentDts = packet.dts;
        this.nalByteStream.push(packet);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        this.nalByteStream.end();
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return H264Stream;
})(Stream);

/**
 * Constructs a single-track, ISO BMFF media segment from H264 data
 * events. The output of this stream can be fed to a SourceBuffer
 * configured with a suitable initialization segment.
 * @param track {object} track metadata configuration
 */
var VideoSegmentStream = (function (Stream) {
  function VideoSegmentStream(track) {
    _get(Object.getPrototypeOf(VideoSegmentStream.prototype), "constructor", this).call(this);
    this.sequenceNumber = 0;
    this.nalUnits = [];
    this.nalUnitsLength = 0;
    this.track = track;
  }

  _inherits(VideoSegmentStream, Stream);

  _prototypeProperties(VideoSegmentStream, null, {
    push: {
      value: function push(data) {
        // buffer video until end() is called
        this.nalUnits.push(data);
        this.nalUnitsLength += data.data.byteLength;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        var startUnit, currentNal, moof, mdat, boxes, i, data, view, sample, startdts;

        // concatenate the video data and construct the mdat
        // first, we have to build the index from byte locations to
        // samples (that is, frames) in the video data
        data = new Uint8Array(this.nalUnitsLength + 4 * this.nalUnits.length);
        view = new DataView(data.buffer);
        this.track.samples = [];
        sample = {
          size: 0,
          flags: {
            isLeading: 0,
            dependsOn: 1,
            isDependedOn: 0,
            hasRedundancy: 0,
            isNonSyncSample: 1,
            degradationPriority: 0
          }
        };
        i = 0;
        startdts = this.nalUnits[0].dts;
        if (this.initDts === undefined) {
          this.initDts = startdts;
        }
        while (this.nalUnits.length) {
          currentNal = this.nalUnits[0];
          // flush the sample we've been building when a new sample is started
          if (currentNal.nalUnitType === "AUD") {
            if (startUnit) {
              // convert the duration to 90kHZ timescale to match the
              // timescales specified in the init segment
              sample.duration = (currentNal.dts - startUnit.dts) * 90;
              this.track.samples.push(sample);
            }
            sample = {
              size: 0,
              flags: {
                isLeading: 0,
                dependsOn: 1,
                isDependedOn: 0,
                hasRedundancy: 0,
                isNonSyncSample: 1,
                degradationPriority: 0 },
              compositionTimeOffset: currentNal.pts - currentNal.dts
            };
            startUnit = currentNal;
          }
          if (currentNal.nalUnitType === "IDR") {
            // the current sample is a key frame
            sample.flags.dependsOn = 2;
            sample.flags.isNonSyncSample = 0;
          }
          sample.size += 4; // space for the NAL length
          sample.size += currentNal.data.byteLength;

          view.setUint32(i, currentNal.data.byteLength);
          i += 4;
          data.set(currentNal.data, i);
          i += currentNal.data.byteLength;

          this.nalUnits.shift();
        }
        // record the last sample
        if (this.track.samples.length) {
          sample.duration = this.track.samples[this.track.samples.length - 1].duration;
        }
        this.track.samples.push(sample);
        this.nalUnitsLength = 0;
        mdat = MP4.mdat(data);
        moof = MP4.moof(this.sequenceNumber, (startdts - this.initDts) * 90, this.track);
        // it would be great to allocate this array up front instead of
        // throwing away hundreds of media segment fragments
        boxes = new Uint8Array(moof.byteLength + mdat.byteLength);

        // bump the sequence number for next time
        this.sequenceNumber++;

        boxes.set(moof);
        boxes.set(mdat, moof.byteLength);

        this.trigger("data", boxes);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return VideoSegmentStream;
})(Stream);

/**
 * Constructs a single-track, ISO BMFF media segment from AAC data
 * events. The output of this stream can be fed to a SourceBuffer
 * configured with a suitable initialization segment.
 * @param track {object} track metadata configuration
 */
var AudioSegmentStream = (function (Stream) {
  function AudioSegmentStream(track) {
    _get(Object.getPrototypeOf(AudioSegmentStream.prototype), "constructor", this).call(this);
    this.sequenceNumber = 0;
    this.aacUnits = [];
    this.aacUnitsLength = 0;
    this.track = track;
  }

  _inherits(AudioSegmentStream, Stream);

  _prototypeProperties(AudioSegmentStream, null, {
    push: {
      value: function push(data) {
        //remove ADTS header
        data.data = data.data.subarray(7);
        // buffer audio until end() is called
        this.aacUnits.push(data);
        this.aacUnitsLength += data.data.byteLength;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        var data, view, i, currentUnit, startUnitDts, lastUnit, mdat, moof, boxes;
        // // concatenate the audio data and construct the mdat
        // // first, we have to build the index from byte locations to
        // // samples (that is, frames) in the audio data
        data = new Uint8Array(this.aacUnitsLength);
        view = new DataView(data.buffer);
        this.track.samples = [];
        var sample = {
          size: this.aacUnits[0].data.byteLength,
          flags: {
            isLeading: 0,
            dependsOn: 1,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradationPriority: 0
          },
          compositionTimeOffset: 0
        };
        i = 0;
        startUnitDts = this.aacUnits[0].dts;
        if (this.initDts === undefined) {
          this.initDts = startUnitDts;
        }
        lastUnit = null;
        while (this.aacUnits.length) {
          currentUnit = this.aacUnits[0];
          if (lastUnit != null) {
            //flush previous sample, update its duration beforehand
            sample.duration = (currentUnit.dts - lastUnit.dts) * 90;
            this.track.samples.push(sample);
            sample = {
              size: currentUnit.data.byteLength,
              flags: {
                isLeading: 0,
                dependsOn: 1,
                isDependedOn: 0,
                hasRedundancy: 0,
                degradationPriority: 0
              },
              compositionTimeOffset: 0
            };
          }
          //view.setUint32(i, currentUnit.data.byteLength);
          //i += 4;
          data.set(currentUnit.data, i);
          i += currentUnit.data.byteLength;
          this.aacUnits.shift();
          lastUnit = currentUnit;
        }
        // record the last sample
        if (this.track.samples.length) {
          sample.duration = this.track.samples[this.track.samples.length - 1].duration;
          this.track.samples.push(sample);
        }
        this.aacUnitsLength = 0;
        mdat = MP4.mdat(data);
        moof = MP4.moof(this.sequenceNumber, (startUnitDts - this.initDts) * 90, this.track);
        // it would be great to allocate this array up front instead of
        // throwing away hundreds of media segment fragments
        boxes = new Uint8Array(moof.byteLength + mdat.byteLength);

        // bump the sequence number for next time
        this.sequenceNumber++;
        boxes.set(moof);
        boxes.set(mdat, moof.byteLength);

        this.trigger("data", boxes);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return AudioSegmentStream;
})(Stream);

/**
 * A Stream that expects MP2T binary data as input and produces
 * corresponding media segments, suitable for use with Media Source
 * Extension (MSE) implementations that support the ISO BMFF byte
 * stream format, like Chrome.
 * @see test/muxer/mse-demo.html for sample usage of a Transmuxer with
 * MSE
 */


var packetStream, parseStream, elementaryStream, aacStream, h264Stream, audioSegmentStream, videoSegmentStream, configAudio, configVideo, trackVideo, trackAudio, _duration, pps;

var TSDemuxer = (function () {
  function TSDemuxer() {
    // set up the parsing pipeline
    packetStream = new TransportPacketStream();
    parseStream = new TransportParseStream();
    elementaryStream = new ElementaryStream();
    aacStream = new AacStream();
    h264Stream = new H264Stream();

    packetStream.pipe(parseStream);
    parseStream.pipe(elementaryStream);
    elementaryStream.pipe(aacStream);
    elementaryStream.pipe(h264Stream);

    // handle incoming data events
    aacStream.on("data", function (data) {
      if (!configAudio) {
        trackAudio.config = configAudio = data.config;
        trackAudio.audiosamplerate = data.audiosamplerate;
        trackAudio.duration = 90000 * _duration;
        // implicit SBR signalling (HE-AAC) : if sampling rate less than 24kHz
        var codec = data.audiosamplerate <= 24000 ? 5 : (configAudio[0] & 248) >> 3;
        trackAudio.codec = "mp4a.40." + codec;
        console.log(trackAudio.codec);
        if (configVideo) {
          observer.trigger(Event.INIT_SEGMENT, {
            data: MP4.initSegment([trackVideo, trackAudio]),
            codec: trackVideo.codec + "," + trackAudio.codec
          });
        }
      }
    });

    h264Stream.on("data", function (data) {
      // record the track config
      if (data.nalUnitType === "SPS" && !configVideo) {
        configVideo = data.config;
        trackVideo.width = configVideo.width;
        trackVideo.height = configVideo.height;
        trackVideo.sps = [data.data];
        var codecarray = data.data.subarray(1, 4);
        var codecstring = "avc1.";
        for (var i = 0; i < 3; i++) {
          var h = codecarray[i].toString(16);
          if (h.length < 2) {
            h = "0" + h;
          }
          codecstring += h;
        }
        trackVideo.codec = codecstring;
        console.log(trackVideo.codec);
        trackVideo.duration = 90000 * _duration;
      }
      if (data.nalUnitType === "PPS" && !pps) {
        pps = data.data;
        trackVideo.pps = [data.data];

        if (configVideo) {
          if (audioSegmentStream) {
            if (configAudio) {
              observer.trigger(Event.INIT_SEGMENT, {
                data: MP4.initSegment([trackVideo, trackAudio]),
                codec: trackVideo.codec + "," + trackAudio.codec
              });
            }
          } else {
            observer.trigger(Event.INIT_SEGMENT, {
              data: MP4.initSegment([trackVideo]),
              codec: trackVideo.codec
            });
          }
        }
      }
    });
    // hook up the video segment stream once track metadata is delivered
    elementaryStream.on("data", function (data) {
      var i,
          triggerData = function (segment) {
        observer.trigger(Event.FRAGMENT_PARSED, {
          data: segment
        });
      };
      if (data.type === "metadata") {
        i = data.tracks.length;
        while (i--) {
          if (data.tracks[i].type === "video") {
            trackVideo = data.tracks[i];
            if (!videoSegmentStream) {
              videoSegmentStream = new VideoSegmentStream(trackVideo);
              h264Stream.pipe(videoSegmentStream);
              videoSegmentStream.on("data", triggerData);
            }
          } else {
            if (data.tracks[i].type === "audio") {
              trackAudio = data.tracks[i];
              if (!audioSegmentStream) {
                audioSegmentStream = new AudioSegmentStream(trackAudio);
                aacStream.pipe(audioSegmentStream);
                audioSegmentStream.on("data", triggerData);
              }
            }
          }
        }
      }
    });
  }

  _prototypeProperties(TSDemuxer, null, {
    duration: {
      set: function (duration) {
        _duration = duration;
      },
      get: function () {
        return _duration;
      },
      enumerable: true,
      configurable: true
    },
    push: {

      // feed incoming data to the front of the parsing pipeline
      value: function push(data) {
        packetStream.push(data);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      // flush any buffered data
      value: function end() {
        elementaryStream.end();
        h264Stream.end();
        if (videoSegmentStream) {
          videoSegmentStream.end();
        }
        if (audioSegmentStream) {
          audioSegmentStream.end();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    destroy: {
      value: function destroy() {
        audioSegmentStream = videoSegmentStream = null;
        configAudio = configVideo = trackVideo = trackAudio = pps = null;
        _duration = 0;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TSDemuxer;
})();

module.exports = TSDemuxer;

},{"../events":"/Users/g.dupontavice/workdir/github/mse-hls/src/events.js","../observer":"/Users/g.dupontavice/workdir/github/mse-hls/src/observer.js","../remux/mp4-generator":"/Users/g.dupontavice/workdir/github/mse-hls/src/remux/mp4-generator.js","../utils/logger":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js","../utils/stream":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/stream.js","./exp-golomb":"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/exp-golomb.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/events.js":[function(require,module,exports){
"use strict";

module.exports = {
  // Identifier for a framework ready event, triggered when ready to set DataSource
  FRAMEWORK_READY: "hlsFrameworkReady",
  // Identifier for a manifest loading event, triggered after a call to hls.attachSource(url)
  MANIFEST_LOADING: "hlsManifestLoading",
  //Identifier for a manifest loaded event, when this event is received, main manifest and start level has been retrieved
  MANIFEST_LOADED: "hlsManifestLoaded",
  // Identifier for a level loading event
  LEVEL_LOADING: "hlsLevelLoading",
  // Identifier for a level loaded event
  LEVEL_LOADED: "hlsLevelLoaded",
  // Identifier for a level switch event
  LEVEL_SWITCH: "hlsLevelSwitch",
  // Identifier for a level ENDLIST event
  LEVEL_ENDLIST: "hlsLevelEndList",
  // Identifier for a fragment loading event
  FRAGMENT_LOADING: "hlsFragmentLoading",
  // Identifier for a fragment loaded event
  FRAGMENT_LOADED: "hlsFragmentLoaded",
  // Identifier when last fragment of playlist has been loaded
  LAST_FRAGMENT_LOADED: "hlsLastFragmentLoaded",
  // Identifier for a fragment parsed event
  FRAGMENT_PARSED: "hlsFragmentParsed",
  // Identifier for an init segment event
  INIT_SEGMENT: "hlsInitSegment",
  // Identifier for a load error event
  LOAD_ERROR: "hlsLoadError",
  // Identifier for a level switch error
  LEVEL_ERROR: "hlsLevelError",
  // Identifier for a video error event
  VIDEO_ERROR: "hlsVideoError",
  // Identifier for a playback media time change event
  MEDIA_TIME: "hlsMediaTime",
  // Identifier for a playback state switch event
  PLAYBACK_STATE: "hlsPlaybackState",
  // Identifier for a seek state switch event
  SEEK_STATE: "hlsSeekState",
  // Identifier for a playback complete event
  PLAYBACK_COMPLETE: "hlsPlayBackComplete"
};

},{}],"/Users/g.dupontavice/workdir/github/mse-hls/src/hls.js":[function(require,module,exports){
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

var logger = require("./utils/logger").logger;
var enableLogs = require("./utils/logger").enableLogs;
//import MP4Inspect         from '/remux/mp4-inspector';

var Hls = (function () {
  function Hls(video) {
    this.playlistLoader = new PlaylistLoader();
    this.bufferController = new BufferController(video);
    this.Events = Event;
    this.debug = enableLogs;
    this.logEvt = this.logEvt;
    // observer setup
    this.on = observer.on.bind(observer);
    this.off = observer.removeListener.bind(observer);
    this.attachView(video);
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
        this.detachSource();
        this.detachView();
        observer.removeAllListeners();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    attachView: {
      value: function attachView(video) {
        this.video = video;
        this.onverror = this.onVideoError.bind(this);
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
        // listen to all video events
        var listener = (function (evt) {
          this.logEvt(evt);
        }).bind(this);
        this.onve = listener;
        video.addEventListener("loadstart", listener);
        //video.addEventListener('progress',        listener);
        video.addEventListener("suspend", listener);
        video.addEventListener("abort", listener);
        video.addEventListener("error", this.onverror);
        video.addEventListener("emptied", listener);
        video.addEventListener("stalled", listener);
        video.addEventListener("loadedmetadata", listener);
        video.addEventListener("loadeddata", listener);
        video.addEventListener("canplay", listener);
        video.addEventListener("canplaythrough", listener);
        video.addEventListener("playing", listener);
        video.addEventListener("waiting", listener);
        video.addEventListener("seeking", listener);
        video.addEventListener("seeked", listener);
        video.addEventListener("durationchange", listener);
        //video.addEventListener('timeupdate',      listener);
        video.addEventListener("play", listener);
        video.addEventListener("pause", listener);
        video.addEventListener("ratechange", listener);
        video.addEventListener("resize", listener);
        video.addEventListener("volumechange", listener);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    detachView: {
      value: function detachView() {
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
        var listener = this.onve;
        this.onve = null;
        if (video) {
          this.video = null;
          // remove all video listeners
          video.removeEventListener("loadstart", listener);
          //video.removeEventListener('progress',        listener);
          video.removeEventListener("suspend", listener);
          video.removeEventListener("abort", listener);
          video.removeEventListener("error", this.onverror);
          video.removeEventListener("emptied", listener);
          video.removeEventListener("stalled", listener);
          video.removeEventListener("loadedmetadata", listener);
          video.removeEventListener("loadeddata", listener);
          video.removeEventListener("canplay", listener);
          video.removeEventListener("canplaythrough", listener);
          video.removeEventListener("playing", listener);
          video.removeEventListener("waiting", listener);
          video.removeEventListener("seeking", listener);
          video.removeEventListener("seeked", listener);
          video.removeEventListener("durationchange", listener);
          //video.removeEventListener('timeupdate',      listener);
          video.removeEventListener("play", listener);
          video.removeEventListener("pause", listener);
          video.removeEventListener("ratechange", listener);
          video.removeEventListener("resize", listener);
          video.removeEventListener("volumechange", listener);
          this.onverror = null;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    attachSource: {
      value: function attachSource(url) {
        this.url = url;
        logger.log("attachSource:" + url);
        // internal listener setup
        // internal listeners
        this.onml = this.onManifestLoaded.bind(this);
        observer.on(Event.MANIFEST_LOADED, this.onml);
        // when attaching to a source URL, trigger a playlist load
        this.playlistLoader.load(url);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    detachSource: {
      value: function detachSource() {
        this.url = null;
        // internal listener cleanup
        if (this.onml) {
          observer.removeListener(Event.MANIFEST_LOADED, this.onml);
          this.onml = null;
        }
        this.levels = null;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onManifestLoaded: {
      value: function onManifestLoaded(event, data) {
        this.levels = data.levels;
        var stats = data.stats;
        logger.log("manifest loaded,RTT(ms)/load(ms):" + (stats.tfirst - stats.trequest) + "/" + (stats.tend - stats.trequest));
        if (this.levels.length > 1 || this.levels[0].fragments === undefined) {
          // set level, it will trigger a playlist loading request
          this.playlistLoader.level = this.levels.length - 1;
        }
        this.bufferController.start(this.levels, this.mediaSource);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    onMediaSourceOpen: {
      value: function onMediaSourceOpen() {
        observer.trigger(Event.FRAMEWORK_READY);
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
    },
    logEvt: {
      value: function logEvt(evt) {
        var data = "";
        switch (evt.type) {
          case "durationchange":
            data = event.target.duration;
            break;
          case "resize":
            data = "videoWidth:" + evt.target.videoWidth + "/videoHeight:" + evt.target.videoHeight;
            break;
          case "loadedmetadata":
            data = "duration:" + evt.target.duration + "/videoWidth:" + evt.target.videoWidth + "/videoHeight:" + evt.target.videoHeight;
            break;
          case "loadeddata":
          case "canplay":
          case "canplaythrough":
          case "timeupdate":
          case "seeking":
          case "seeked":
          case "pause":
          case "play":
          case "stalled":
            data = "currentTime:" + evt.target.currentTime;
            break;
          // case 'progress':
          //   data = 'currentTime:' + evt.target.currentTime + ',bufferRange:[' + this.video.buffered.start(0) + ',' + this.video.buffered.end(0) + ']';
          //   break;
          default:
            break;
        }
        logger.log(evt.type + ":" + data);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Hls;
})();

module.exports = Hls;

},{"./controller/buffer-controller":"/Users/g.dupontavice/workdir/github/mse-hls/src/controller/buffer-controller.js","./events":"/Users/g.dupontavice/workdir/github/mse-hls/src/events.js","./loader/playlist-loader":"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/playlist-loader.js","./observer":"/Users/g.dupontavice/workdir/github/mse-hls/src/observer.js","./utils/logger":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/fragment-loader.js":[function(require,module,exports){
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
        if (this.xhr && this.xhr.readyState !== 4) {
          this.xhr.abort();
          this.xhr = null;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(url) {
        this.url = url;
        this.trequest = Date.now();
        this.tfirst = null;
        var xhr = this.xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.send();
        observer.trigger(Event.FRAGMENT_LOADING, { url: this.url });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        observer.trigger(Event.FRAGMENT_LOADED, { payload: event.currentTarget.response,
          url: this.url,
          stats: { trequest: this.trequest, tfirst: this.tfirst, tend: Date.now(), length: event.currentTarget.response.byteLength } });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        logger.log("error loading " + this.url);
        observer.trigger(Event.LOAD_ERROR, { url: this.url, event: event });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress() {
        if (this.tfirst === null) {
          this.tfirst = Date.now();
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

},{"../events":"/Users/g.dupontavice/workdir/github/mse-hls/src/events.js","../observer":"/Users/g.dupontavice/workdir/github/mse-hls/src/observer.js","../utils/logger":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/playlist-loader.js":[function(require,module,exports){
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

var logger = require("../utils/logger").logger;
var PlaylistLoader = (function () {
  function PlaylistLoader() {
    this.levels = [];
    this._level = undefined;
  }

  _prototypeProperties(PlaylistLoader, null, {
    destroy: {
      value: function destroy() {
        if (this.xhr && this.xhr.readyState !== 4) {
          this.xhr.abort();
          this.xhr = null;
        }
        this.levels = [];
        this._level = undefined;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    load: {
      value: function load(url) {
        observer.trigger(Event.MANIFEST_LOADING, { url: this.url });
        this._load(url);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    _load: {
      value: function Load(url) {
        this.url = url;
        this.stats = { trequest: Date.now() };
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
    level: {
      get: function () {
        return this._level;
      },
      set: function (newLevel) {
        if (this._level !== newLevel) {
          // check if level idx is valid
          if (newLevel >= 0 && newLevel < this.levels.length) {
            this._level = newLevel;
            // check if we need to load playlist for this new level
            if (this.levels[newLevel].fragments === undefined) {
              // level not retrieved yet, we need to load it
              observer.trigger(Event.LEVEL_LOADING, { level: newLevel });
              this._load(this.levels[newLevel].url);
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
    parseManifest: {
      value: function parseManifest(string, url) {
        if (string.indexOf("#EXTM3U") === 0) {
          if (string.indexOf("#EXTINF:") > 0) {
            // 1 level playlist, create unique level and parse playlist
            this._level = 0;
            this.levels.length = 1;
            this.levels[0] = {};
            this.parseLevelPlaylist(string, url, 0);
            observer.trigger(Event.MANIFEST_LOADED, { levels: this.levels,
              url: url,
              stats: this.stats });
            observer.trigger(Event.LEVEL_LOADED, { level: this._level,
              url: url,
              stats: this.stats });
          } else {
            // multi level playlist, parse level info
            this.levels = this.parseMasterPlaylist(string, url);
            observer.trigger(Event.MANIFEST_LOADED, { levels: this.levels,
              url: url,
              stats: this.stats });
          }
        } else {
          observer.trigger(Event.LOAD_ERROR, { url: url, event: "not an HLS playlist" });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parseMasterPlaylist: {
      value: function parseMasterPlaylist(string, baseurl) {
        var levels = [];
        var level = {};
        var result;
        var re = /#EXT-X-STREAM-INF:([^\n\r]*(BAND)WIDTH=(\d+))?([^\n\r]*(RES)OLUTION=(\d+)x(\d+))?([^\n\r]*(NAME)=\"(.*)\")?[^\n\r]*[\r\n]+([^\r\n]+)/g;
        while ((result = re.exec(string)) != null) {
          result.shift();
          result = result.filter(function (n) {
            return n !== undefined;
          });
          level.url = this.resolve(result.pop(), baseurl);
          while (result.length > 0) {
            switch (result.shift()) {
              case "RES":
                level.width = result.shift();
                level.height = result.shift();
                break;
              case "BAND":
                level.bitrate = result.shift();
                break;
              case "NAME":
                level.name = result.shift();
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
    parseLevelPlaylist: {
      value: function parseLevelPlaylist(string, baseurl, idx) {
        var currentSN = 0,
            totalduration = 0;
        var obj = this.levels[idx];
        obj.url = baseurl;
        obj.fragments = [];
        obj.endList = false;

        var result;
        var re = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):([\d\.]+)[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST)))/g;
        while ((result = re.exec(string)) !== null) {
          result.shift();
          result = result.filter(function (n) {
            return n !== undefined;
          });
          switch (result[0]) {
            case "MEDIA-SEQUENCE":
              currentSN = obj.startSN = parseInt(result[1]);
              break;
            case "TARGETDURATION":
              obj.targetduration = parseFloat(result[1]);
              break;
            case "ENDLIST":
              obj.endList = true;
              break;
            case "INF":
              var duration = parseFloat(result[1]);
              obj.fragments.push({ url: this.resolve(result[2], baseurl), duration: duration, start: totalduration, sn: currentSN++ });
              totalduration += duration;
              break;
            default:
              break;
          }
        }
        logger.log("found " + obj.fragments.length + " fragments");
        obj.totalduration = totalduration;
        obj.endSN = currentSN - 1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        this.stats.tend = Date.now();
        if (this.levels.length === 0) {
          this.parseManifest(event.currentTarget.responseText, this.url);
        } else {
          this.parseLevelPlaylist(event.currentTarget.responseText, this.url, this._level);
          observer.trigger(Event.LEVEL_LOADED, { level: this._level,
            url: this.url,
            stats: this.stats });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        observer.trigger(Event.LOAD_ERROR, { url: this.url, event: event });
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress() {
        if (this.stats.tfirst === undefined) {
          this.stats.tfirst = Date.now();
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

},{"../events":"/Users/g.dupontavice/workdir/github/mse-hls/src/events.js","../observer":"/Users/g.dupontavice/workdir/github/mse-hls/src/observer.js","../utils/logger":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/observer.js":[function(require,module,exports){
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

},{"events":"/Users/g.dupontavice/workdir/github/mse-hls/node_modules/browserify/node_modules/events/events.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/remux/mp4-generator.js":[function(require,module,exports){
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
          vmhd: []
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
        MP4.STSZ = new Uint8Array([0, // version
        0, 0, 0, // flags
        0, 0, 0, 0, // sample_size
        0, 0, 0, 0]);
        MP4.STTS = MP4.STCO;
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

        MP4.MEDIAHEADER_TYPES = {
          video: MP4.VMHD,
          audio: MP4.SMHD
        };

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
        0, 1, 95, 144, // timescale, 90,000 "ticks" per second

        (duration & 4278190080) >> 24, (duration & 16711680) >> 16, (duration & 65280) >> 8, duration & 255, // duration
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
        return MP4.box(MP4.types.mfhd, new Uint8Array([0, 0, 0, 0, // flags
        (sequenceNumber & 4278190080) >> 24, (sequenceNumber & 16711680) >> 16, (sequenceNumber & 65280) >> 8, sequenceNumber & 255]));
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    minf: {
      value: function minf(track) {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.MEDIAHEADER_TYPES[track.type]), MP4.DINF, MP4.stbl(track));
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
        0, 1, 95, 144, // timescale, 90,000 "ticks" per second
        (duration & 4278190080) >> 24, (duration & 16711680) >> 16, (duration & 65280) >> 8, duration & 255, // duration
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
            sample,
            i;

        // leave the full box header (4 bytes) all zero

        // write the sample table
        for (i = 0; i < samples.length; i++) {
          sample = samples[i];
          bytes[i + 4] = sample.flags.dependsOn << 4 | sample.flags.isDependedOn << 2 | sample.flags.hasRedundancy;
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
          sps.push((track.sps[i].byteLength & 65280) >>> 8);
          sps.push(track.sps[i].byteLength & 255); // sequenceParameterSetLength
          sps = sps.concat(Array.prototype.slice.call(track.sps[i])); // SPS
        }

        // assemble the PPSs
        for (i = 0; i < track.pps.length; i++) {
          pps.push((track.pps[i].byteLength & 65280) >>> 8);
          pps.push(track.pps[i].byteLength & 255);
          pps = pps.concat(Array.prototype.slice.call(track.pps[i]));
        }

        return MP4.box(MP4.types.avc1, new Uint8Array([0, 0, 0, // reserved
        0, 0, 0, // reserved
        0, 1, // data_reference_index
        0, 0, // pre_defined
        0, 0, // reserved
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // pre_defined
        (track.width & 65280) >> 8, track.width & 255, // width
        (track.height & 65280) >> 8, track.height & 255, // height
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
        25, // length
        0, 1, //es_id
        0, // stream_priority

        4, // descriptor_type
        17, // length
        64, //codec : mpeg4_audio
        21, // stream_type
        0, 0, 0, // buffer_size
        0, 0, 0, 0, // maxBitrate
        0, 0, 0, 0, // avgBitrate

        5, // descriptor_type
        2, // length
        track.config[0], track.config[1]]);
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
        0, 2, // channelcount:2 channels
        0, 16, // sampleSize:16bits
        0, 0, 0, 0, // reserved2
        (track.audiosamplerate & 65280) >> 8, track.audiosamplerate & 255, //
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
        (track.id & 4278190080) >> 24, (track.id & 16711680) >> 16, (track.id & 65280) >> 8, track.id & 255, // track_ID
        0, 0, 0, 0, // reserved
        (track.duration & 4278190080) >> 24, (track.duration & 16711680) >> 16, (track.duration & 65280) >> 8, track.duration & 255, // duration
        0, 0, 0, 0, 0, 0, 0, 0, // reserved
        0, 0, // layer
        0, 0, // alternate_group
        0, 0, // non-audio track volume
        0, 0, // reserved
        0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, // transformation: unity matrix
        (track.width & 65280) >> 8, track.width & 255, 0, 0, // width
        (track.height & 65280) >> 8, track.height & 255, 0, 0 // height
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
        0, 0, 0, // flags
        (track.id & 4278190080) >> 24, (track.id & 16711680) >> 16, (track.id & 65280) >> 8, track.id & 255])), MP4.box(MP4.types.tfdt, new Uint8Array([0, // version 0
        0, 0, 0, // flags
        (baseMediaDecodeTime & 4278190080) >> 24, (baseMediaDecodeTime & 16711680) >> 16, (baseMediaDecodeTime & 65280) >> 8, baseMediaDecodeTime & 255])), MP4.trun(track, sampleDependencyTable.length + 16 + // tfhd
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
        0, 0, 0, // flags
        (track.id & 4278190080) >> 24, (track.id & 16711680) >> 16, (track.id & 65280) >> 8, track.id & 255, // track_ID
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
        var bytes, samples, sample, i;

        samples = track.samples || [];
        offset += 8 + 12 + 16 * samples.length;

        bytes = [0, // version 0
        0, 15, 1, // flags
        (samples.length & 4278190080) >>> 24, (samples.length & 16711680) >>> 16, (samples.length & 65280) >>> 8, samples.length & 255, // sample_count
        (offset & 4278190080) >>> 24, (offset & 16711680) >>> 16, (offset & 65280) >>> 8, offset & 255 // data_offset
        ];

        for (i = 0; i < samples.length; i++) {
          sample = samples[i];
          bytes = bytes.concat([(sample.duration & 4278190080) >>> 24, (sample.duration & 16711680) >>> 16, (sample.duration & 65280) >>> 8, sample.duration & 255, // sample_duration
          (sample.size & 4278190080) >>> 24, (sample.size & 16711680) >>> 16, (sample.size & 65280) >>> 8, sample.size & 255, // sample_size
          sample.flags.isLeading << 2 | sample.flags.dependsOn, sample.flags.isDependedOn << 6 | sample.flags.hasRedundancy << 4 | sample.flags.paddingValue << 1 | sample.flags.isNonSyncSample, sample.flags.degradationPriority & 240 << 8, sample.flags.degradationPriority & 15, // sample_flags
          (sample.compositionTimeOffset & 4278190080) >>> 24, (sample.compositionTimeOffset & 16711680) >>> 16, (sample.compositionTimeOffset & 65280) >>> 8, sample.compositionTimeOffset & 255 // sample_composition_time_offset
          ]);
        }
        return MP4.box(MP4.types.trun, new Uint8Array(bytes));
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
// sequence_number
// track_ID
// baseMediaDecodeTime

},{}],"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js":[function(require,module,exports){
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

},{}],"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/stream.js":[function(require,module,exports){
/**
 * A lightweight readable stream implemention that handles event dispatching.
 * Objects that inherit from streams should call init in their constructors.
 */

"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var Stream = (function () {
  function Stream() {
    this.listeners = {};
  }

  _prototypeProperties(Stream, null, {
    on: {
      /**
       * Add a listener for a specified event type.
       * @param type {string} the event name
       * @param listener {function} the callback to be invoked when an event of
       * the specified type occurs
       */
      value: function on(type, listener) {
        if (!this.listeners[type]) {
          this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    off: {
      /**
       * Remove a listener for a specified event type.
       * @param type {string} the event name
       * @param listener {function} a function previously registered for this
       * type of event through `on`
       */
      value: function off(type, listener) {
        var index;
        if (!this.listeners[type]) {
          return false;
        }
        index = this.listeners[type].indexOf(listener);
        this.listeners[type].splice(index, 1);
        return index > -1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trigger: {
      /**
       * Trigger an event of the specified type on this stream. Any additional
       * arguments to this function are passed as parameters to event listeners.
       * @param type {string} the event name
       */
      value: function trigger(type) {
        var callbacks, i, length, args;
        callbacks = this.listeners[type];
        if (!callbacks) {
          return;
        }
        // Slicing the arguments on every invocation of this method
        // can add a significant amount of overhead. Avoid the
        // intermediate object creation for the common case of a
        // single callback argument
        if (arguments.length === 2) {
          length = callbacks.length;
          for (i = 0; i < length; ++i) {
            callbacks[i].call(this, arguments[1]);
          }
        } else {
          args = Array.prototype.slice.call(arguments, 1);
          length = callbacks.length;
          for (i = 0; i < length; ++i) {
            callbacks[i].apply(this, args);
          }
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    dispose: {
      /**
       * Destroys the stream and cleans up.
       */
      value: function dispose() {
        this.listeners = {};
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    pipe: {


      /**
       * Forwards all `data` events on this stream to the destination stream. The
       * destination stream should provide a method `push` to receive the data
       * events as they arrive.
       * @param destination {stream} the stream that will receive all `data` events
       * @see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
       */
      value: function pipe(destination) {
        this.on("data", function (data) {
          destination.push(data);
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Stream;
})();

module.exports = Stream;

},{}]},{},["/Users/g.dupontavice/workdir/github/mse-hls/src/hls.js"])("/Users/g.dupontavice/workdir/github/mse-hls/src/hls.js")
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL21zZS1obHMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy9kZW11eC9leHAtZ29sb21iLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvbG9hZGVyL2ZyYWdtZW50LWxvYWRlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL21zZS1obHMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL21zZS1obHMvc3JjL3JlbXV4L21wNC1nZW5lcmF0b3IuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy91dGlscy9sb2dnZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy91dGlscy9zdHJlYW0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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LENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNqQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUNsQixDQUFDLENBQUM7QUFDSCxXQUFHLENBQUMsYUFBYSxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRCxXQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixXQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFVBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFDdEIsR0FBSSxFQUFFLEVBQUksRUFBRSxFQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsQ0FBSTtTQUM3QixDQUFDLENBQUM7QUFDSCxXQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixXQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RC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RyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQ3hCLFFBQVEsR0FBRyxHQUFJO0FBQ2YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7U0FDdkIsQ0FBQyxDQUFDO0FBQ0wsZUFBTyxHQUFHLENBQUMsR0FB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LFFBQVEsQ0FBQSxJQUFLLEVBQUUsRUFDakMsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLEtBQU0sQ0FBQSxJQUFLLENBQUMsRUFDOUIsS0FBSyxDQUFDLFFBQVEsR0FBRyxHQUFJO0FBQ3JCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQzNCLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBSSxFQUNsQixDQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQzVCLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBSSxFQUNuQixDQUFJLEVBQUUsQ0FBSTtTQUNYLENBQUMsQ0FBQyxDQUFDO09BQ0w7Ozs7O0FBRU0sUUFBSTthQUFBLGNBQUMsS0FBSyxFQUFDLG1C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ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvKlxuICogYnVmZmVyIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBGcmFnbWVudExvYWRlciAgICAgICBmcm9tICcuLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IFRTRGVtdXhlciAgICAgICAgICAgICBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuXG5cbiAgY29uc3QgTE9BRElOR19JRExFID0gMDtcbiAgY29uc3QgTE9BRElOR19JTl9QUk9HUkVTUyA9IDE7XG4gIGNvbnN0IExPQURJTkdfV0FJVElOR19MRVZFTF9VUERBVEUgPSAyO1xuICAvLyBjb25zdCBMT0FESU5HX1NUQUxMRUQgPSAzO1xuICAvLyBjb25zdCBMT0FESU5HX0ZSQUdNRU5UX0lPX0VSUk9SID0gNDtcbiAgLy9jb25zdCBMT0FESU5HX0NPTVBMRVRFRCA9IDU7XG5cbiBjbGFzcyBCdWZmZXJDb250cm9sbGVyIHtcblxuICBjb25zdHJ1Y3Rvcih2aWRlbykge1xuICAgIHRoaXMudmlkZW8gPSB2aWRlbztcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKCk7XG4gICAgdGhpcy5kZW11eGVyID0gbmV3IFRTRGVtdXhlcigpO1xuICAgIHRoaXMubXA0c2VnbWVudHMgPSBbXTtcbiAgICAvLyBTb3VyY2UgQnVmZmVyIGxpc3RlbmVyc1xuICAgIHRoaXMub25zYnVlID0gdGhpcy5vblNvdXJjZUJ1ZmZlclVwZGF0ZUVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25zYmUgID0gdGhpcy5vblNvdXJjZUJ1ZmZlckVycm9yLmJpbmQodGhpcyk7XG4gICAgLy8gaW50ZXJuYWwgbGlzdGVuZXJzXG4gICAgdGhpcy5vbmxsID0gdGhpcy5vbkxldmVsTG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZsID0gdGhpcy5vbkZyYWdtZW50TG9hZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmlzID0gdGhpcy5vbkluaXRTZWdtZW50LmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbmZwID0gdGhpcy5vbkZyYWdtZW50UGFyc2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnRpY2sgPSB0aGlzLnRpY2suYmluZCh0aGlzKTtcbiAgICB0aGlzLnN0YXRlID0gTE9BRElOR19XQUlUSU5HX0xFVkVMX1VQREFURTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy5mcmFnbWVudExvYWRlci5kZXN0cm95KCk7XG4gICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgaWYoc2IpIHtcbiAgICAgIC8vZGV0YWNoIHNvdXJjZWJ1ZmZlciBmcm9tIE1lZGlhIFNvdXJjZVxuICAgICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVTb3VyY2VCdWZmZXIoc2IpO1xuICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5zdGF0ZSA9IExPQURJTkdfV0FJVElOR19MRVZFTF9VUERBVEU7XG4gIH1cblxuICBzdGFydChsZXZlbHMsIG1lZGlhU291cmNlKSB7XG4gICAgdGhpcy5sZXZlbHMgPSBsZXZlbHM7XG4gICAgdGhpcy5tZWRpYVNvdXJjZSA9bWVkaWFTb3VyY2U7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdNRU5UX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5JTklUX1NFR01FTlQsIHRoaXMub25pcyk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR01FTlRfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgfVxuXG4gIHN0b3AoKSB7XG4gICAgaWYodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLm9udGljayk7XG4gICAgfVxuICAgIHRoaXMudGltZXIgPSB1bmRlZmluZWQ7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR01FTlRfTE9BREVELCB0aGlzLm9uZmwpO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkZSQUdNRU5UX1BBUlNFRCwgdGhpcy5vbmZwKTtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5MRVZFTF9MT0FERUQsIHRoaXMub25sbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuSU5JVF9TRUdNRU5ULCB0aGlzLm9uaXMpO1xuICB9XG5cblxuICB0aWNrKCkge1xuICAgIGlmKHRoaXMuc3RhdGUgPT09IExPQURJTkdfSURMRSAmJiAoIXRoaXMuc291cmNlQnVmZmVyIHx8ICF0aGlzLnNvdXJjZUJ1ZmZlci51cGRhdGluZykpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGN1cnJlbnQgcGxheSBwb3NpdGlvbiBpcyBidWZmZXJlZFxuICAgICAgdmFyIHYgPSB0aGlzLnZpZGVvLFxuICAgICAgICAgIHBvcyA9IHYuY3VycmVudFRpbWUsXG4gICAgICAgICAgYnVmZmVyZWQgPSB2LmJ1ZmZlcmVkLFxuICAgICAgICAgIGJ1ZmZlckxlbixcbiAgICAgICAgICBidWZmZXJFbmQsXG4gICAgICAgICAgaTtcbiAgICAgIGZvcihpID0gMCwgYnVmZmVyTGVuID0gMCwgYnVmZmVyRW5kID0gcG9zIDsgaSA8IGJ1ZmZlcmVkLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBpZihwb3MgPj0gYnVmZmVyZWQuc3RhcnQoaSkgJiYgcG9zIDwgYnVmZmVyZWQuZW5kKGkpKSB7XG4gICAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckVuZCAtIHBvcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gNjBzIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICBpZihidWZmZXJMZW4gPCA2MCkge1xuICAgICAgICAvLyBmaW5kIGZyYWdtZW50IGluZGV4LCBjb250aWd1b3VzIHdpdGggZW5kIG9mIGJ1ZmZlciBwb3NpdGlvblxuICAgICAgICB2YXIgZnJhZ21lbnRzID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uZnJhZ21lbnRzO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICAgIGlmKGZyYWdtZW50c1tpXS5zdGFydCA8PSAgKGJ1ZmZlckVuZCswLjEpICYmIChmcmFnbWVudHNbaV0uc3RhcnQgKyBmcmFnbWVudHNbaV0uZHVyYXRpb24pID4gKGJ1ZmZlckVuZCswLjEpKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYoaSA8IGZyYWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnbG9hZGluZyBmcmFnICcgKyBpKTtcbiAgICAgICAgdGhpcy5mcmFnbWVudExvYWRlci5sb2FkKGZyYWdtZW50c1tpXS51cmwpO1xuICAgICAgICB0aGlzLnN0YXRlID0gTE9BRElOR19JTl9QUk9HUkVTUztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2xhc3QgZnJhZ21lbnQgbG9hZGVkJyk7XG4gICAgICAgICAgLy9vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxBU1RfRlJBR01FTlRfTE9BREVEKTtcbiAgICAgICAgICAvL3RoaXMuc3RhdGUgPSBMT0FESU5HX0NPTVBMRVRFRDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTGV2ZWxMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMubGV2ZWwgPSBkYXRhLmxldmVsO1xuICAgIHRoaXMuZGVtdXhlci5kdXJhdGlvbiA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLnRvdGFsZHVyYXRpb247XG4gICAgdGhpcy5mcmFnbWVudEluZGV4ID0gMDtcbiAgICB2YXIgc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgIGxvZ2dlci5sb2coJ2xldmVsIGxvYWRlZCxSVFQobXMpL2xvYWQobXMpL2R1cmF0aW9uOicgKyAoc3RhdHMudGZpcnN0IC0gc3RhdHMudHJlcXVlc3QpICsgJy8nICsgKHN0YXRzLnRlbmQgLSBzdGF0cy50cmVxdWVzdCkgKyAnLycgKyB0aGlzLmRlbXV4ZXIuZHVyYXRpb24pO1xuICAgIHRoaXMuc3RhdGUgPSBMT0FESU5HX0lETEU7XG4gIH1cblxuICBvbkZyYWdtZW50TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgdGhpcy5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YS5wYXlsb2FkKSk7XG4gICAgdGhpcy5kZW11eGVyLmVuZCgpO1xuICAgIHRoaXMuc3RhdGUgPSBMT0FESU5HX0lETEU7XG4gICAgdmFyIHN0YXRzLHJ0dCxsb2FkdGltZSxidztcbiAgICBzdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgcnR0ID0gc3RhdHMudGZpcnN0IC0gc3RhdHMudHJlcXVlc3Q7XG4gICAgbG9hZHRpbWUgPSBzdGF0cy50ZW5kIC0gc3RhdHMudHJlcXVlc3Q7XG4gICAgYncgPSBzdGF0cy5sZW5ndGgqOC8oMTAwMCpsb2FkdGltZSk7XG4gICAgLy9sb2dnZXIubG9nKGRhdGEudXJsICsgJyBsb2FkZWQsIFJUVChtcykvbG9hZChtcykvYml0cmF0ZTonICsgcnR0ICsgJy8nICsgbG9hZHRpbWUgKyAnLycgKyBidy50b0ZpeGVkKDMpICsgJyBNYi9zJyk7XG4gIH1cblxuICBvbkluaXRTZWdtZW50KGV2ZW50LGRhdGEpIHtcbiAgICAvLyBjcmVhdGUgc291cmNlIEJ1ZmZlciBhbmQgbGluayB0aGVtIHRvIE1lZGlhU291cmNlXG4gICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXIgPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcigndmlkZW8vbXA0O2NvZGVjcz0nICsgZGF0YS5jb2RlYyk7XG4gICAgc2IuYWRkRXZlbnRMaXN0ZW5lcigndXBkYXRlZW5kJywgdGhpcy5vbnNidWUpO1xuICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKGRhdGEpO1xuICAgIHRoaXMuYXBwZW5kU2VnbWVudHMoKTtcbiAgfVxuXG4gIG9uRnJhZ21lbnRQYXJzZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMubXA0c2VnbWVudHMucHVzaChkYXRhKTtcbiAgICB0aGlzLmFwcGVuZFNlZ21lbnRzKCk7XG4gIH1cblxuICBhcHBlbmRTZWdtZW50cygpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VCdWZmZXIgJiYgIXRoaXMuc291cmNlQnVmZmVyLnVwZGF0aW5nICYmIHRoaXMubXA0c2VnbWVudHMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlci5hcHBlbmRCdWZmZXIodGhpcy5tcDRzZWdtZW50cy5zaGlmdCgpLmRhdGEpO1xuICAgIH1cbiAgfVxuXG4gIG9uU291cmNlQnVmZmVyVXBkYXRlRW5kKCkge1xuICAgIC8vbG9nZ2VyLmxvZygnYnVmZmVyIGFwcGVuZGVkJyk7XG4gICAgdGhpcy5hcHBlbmRTZWdtZW50cygpO1xuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJFcnJvcihldmVudCkge1xuICAgICAgbG9nZ2VyLmxvZygnIGJ1ZmZlciBhcHBlbmQgZXJyb3I6JyArIGV2ZW50KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCdWZmZXJDb250cm9sbGVyO1xuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2RpbmdcbiAqIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4gKi9cblxuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKHdvcmtpbmdEYXRhKSB7XG4gICAgdGhpcy53b3JraW5nRGF0YSA9IHdvcmtpbmdEYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMud29ya2luZ0RhdGFcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA9IHRoaXMud29ya2luZ0RhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JraW5nV29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGggLSB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSk7XG5cbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuXG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLndvcmtpbmdEYXRhLnN1YmFycmF5KHBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29ya2luZ1dvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuXG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLndvcmtpbmdEYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JraW5nV29yZCAgICAgICAgICA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgPj4gMztcblxuICAgICAgY291bnQgLT0gKHNraXBCeXRlcyA+PiAzKTtcbiAgICAgIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcblxuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuXG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9XG5cbiAgLy8gKHNpemU6aW50KTp1aW50XG4gIHJlYWRCaXRzKHNpemUpIHtcbiAgICB2YXJcbiAgICAgIGJpdHMgPSBNYXRoLm1pbih0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmtpbmdXb3JkID4+PiAoMzIgLSBiaXRzKTsgLy8gOnVpbnRcblxuICAgIGlmKHNpemUgPjMyKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0Nhbm5vdCByZWFkIG1vcmUgdGhhbiAzMiBiaXRzIGF0IGEgdGltZScpO1xuICAgIH1cblxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG5cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTGVhZGluZ1plcm9zKCkge1xuICAgIHZhciBsZWFkaW5nWmVyb0NvdW50OyAvLyA6dWludFxuICAgIGZvciAobGVhZGluZ1plcm9Db3VudCA9IDAgOyBsZWFkaW5nWmVyb0NvdW50IDwgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA7ICsrbGVhZGluZ1plcm9Db3VudCkge1xuICAgICAgaWYgKDAgIT09ICh0aGlzLndvcmtpbmdXb3JkICYgKDB4ODAwMDAwMDAgPj4+IGxlYWRpbmdaZXJvQ291bnQpKSkge1xuICAgICAgICAvLyB0aGUgZmlyc3QgYml0IG9mIHdvcmtpbmcgd29yZCBpcyAxXG4gICAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmtpbmdXb3JkIGFuZCBzdGlsbCBoYXZlIG5vdCBmb3VuZCBhIDFcbiAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgcmV0dXJuIGxlYWRpbmdaZXJvQ291bnQgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcFVuc2lnbmVkRXhwR29sb21iKCkge1xuICAgIHRoaXMuc2tpcEJpdHMoMSArIHRoaXMuc2tpcExlYWRpbmdaZXJvcygpKTtcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH1cblxuICAvLyAoKTp1aW50XG4gIHJlYWRVbnNpZ25lZEV4cEdvbG9tYigpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7IC8vIDp1aW50XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoY2x6ICsgMSkgLSAxO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIHZhbHUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyA6aW50XG4gICAgaWYgKDB4MDEgJiB2YWx1KSB7XG4gICAgICAvLyB0aGUgbnVtYmVyIGlzIG9kZCBpZiB0aGUgbG93IG9yZGVyIGJpdCBpcyBzZXRcbiAgICAgIHJldHVybiAoMSArIHZhbHUpID4+PiAxOyAvLyBhZGQgMSB0byBtYWtlIGl0IGV2ZW4sIGFuZCBkaXZpZGUgYnkgMlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gLTEgKiAodmFsdSA+Pj4gMSk7IC8vIGRpdmlkZSBieSB0d28gdGhlbiBtYWtlIGl0IG5lZ2F0aXZlXG4gICAgfVxuICB9XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVuc2lnbmVkQnl0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyg4KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZHZhbmNlIHRoZSBFeHBHb2xvbWIgZGVjb2RlciBwYXN0IGEgc2NhbGluZyBsaXN0LiBUaGUgc2NhbGluZ1xuICAgKiBsaXN0IGlzIG9wdGlvbmFsbHkgdHJhbnNtaXR0ZWQgYXMgcGFydCBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlclxuICAgKiBzZXQgYW5kIGlzIG5vdCByZWxldmFudCB0byB0cmFuc211eGluZy5cbiAgICogQHBhcmFtIGNvdW50IHtudW1iZXJ9IHRoZSBudW1iZXIgb2YgZW50cmllcyBpbiB0aGlzIHNjYWxpbmcgbGlzdFxuICAgKiBAc2VlIFJlY29tbWVuZGF0aW9uIElUVS1UIEguMjY0LCBTZWN0aW9uIDcuMy4yLjEuMS4xXG4gICAqL1xuICBza2lwU2NhbGluZ0xpc3QoY291bnQpIHtcbiAgICB2YXJcbiAgICAgIGxhc3RTY2FsZSA9IDgsXG4gICAgICBuZXh0U2NhbGUgPSA4LFxuICAgICAgaixcbiAgICAgIGRlbHRhU2NhbGU7XG5cbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRXhwR29sb21iKCk7XG4gICAgICAgIG5leHRTY2FsZSA9IChsYXN0U2NhbGUgKyBkZWx0YVNjYWxlICsgMjU2KSAlIDI1NjtcbiAgICAgIH1cblxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU2VxdWVuY2VQYXJhbWV0ZXJTZXQoKSB7XG4gICAgdmFyXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSAwLFxuICAgICAgcHJvZmlsZUlkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG5cbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7IC8vIHByb2ZpbGVfaWRjXG4gICAgLy8gY29uc3RyYWludF9zZXRbMC01XV9mbGFnLCB1KDEpLCByZXNlcnZlZF96ZXJvXzJiaXRzIHUoMiksIGxldmVsX2lkYyB1KDgpXG4gICAgdGhpcy5za2lwQml0cygxNik7IC8vICB1KDEpLCByZXNlcnZlZF96ZXJvXzJiaXRzIHUoMilcbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuXG4gICAgLy8gc29tZSBwcm9maWxlcyBoYXZlIG1vcmUgb3B0aW9uYWwgZGF0YSB3ZSBkb24ndCBuZWVkXG4gICAgaWYgKHByb2ZpbGVJZGMgPT09IDEwMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMTAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTIyIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDE0NCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHZhciBwaWNPcmRlckNudFR5cGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMCkge1xuICAgICAgdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy9sb2cyX21heF9waWNfb3JkZXJfY250X2xzYl9taW51czRcbiAgICB9IGVsc2UgaWYgKHBpY09yZGVyQ250VHlwZSA9PT0gMSkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGVsdGFfcGljX29yZGVyX2Fsd2F5c196ZXJvX2ZsYWdcbiAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX25vbl9yZWZfcGljXG4gICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlOyBpKyspIHtcbiAgICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBtYXhfbnVtX3JlZl9mcmFtZXNcbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBnYXBzX2luX2ZyYW1lX251bV92YWx1ZV9hbGxvd2VkX2ZsYWdcblxuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuXG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG5cbiAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkaXJlY3RfOHg4X2luZmVyZW5jZV9mbGFnXG4gICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBmcmFtZV9jcm9wcGluZ19mbGFnXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMixcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKGZyYW1lQ3JvcFRvcE9mZnNldCAqIDIpIC0gKGZyYW1lQ3JvcEJvdHRvbU9mZnNldCAqIDIpXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIEEgc3RyZWFtLWJhc2VkIG1wMnRzIHRvIG1wNCBjb252ZXJ0ZXIuIFRoaXMgdXRpbGl0eSBpcyB1c2VkIHRvXG4gKiBkZWxpdmVyIG1wNHMgdG8gYSBTb3VyY2VCdWZmZXIgb24gcGxhdGZvcm1zIHRoYXQgc3VwcG9ydCBuYXRpdmVcbiAqIE1lZGlhIFNvdXJjZSBFeHRlbnNpb25zLlxuICovXG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFeHBHb2xvbWIgICAgICAgZnJvbSAnLi9leHAtZ29sb21iJztcbmltcG9ydCBNUDQgICAgICAgICAgICAgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbmltcG9ydCBTdHJlYW0gICAgICAgICAgZnJvbSAnLi4vdXRpbHMvc3RyZWFtJztcbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY29uc3QgTVAyVF9QQUNLRVRfTEVOR1RIID0gMTg4OyAvLyBieXRlc1xuY29uc3QgSDI2NF9TVFJFQU1fVFlQRSA9IDB4MWI7XG5jb25zdCBBRFRTX1NUUkVBTV9UWVBFID0gMHgwZjtcbmNvbnN0IFBBVF9QSUQgPSAwO1xuXG4vKipcbiAqIFNwbGl0cyBhbiBpbmNvbWluZyBzdHJlYW0gb2YgYmluYXJ5IGRhdGEgaW50byBNUEVHLTIgVHJhbnNwb3J0XG4gKiBTdHJlYW0gcGFja2V0cy5cbiAqL1xuY2xhc3MgVHJhbnNwb3J0UGFja2V0U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KE1QMlRfUEFDS0VUX0xFTkdUSCk7XG4gICAgdGhpcy5lbmQgPSAwO1xuICB9XG5cbiAgcHVzaChieXRlcykge1xuICAgIHZhciByZW1haW5pbmcsIGk7XG5cbiAgICAvLyBjbGVhciBvdXQgYW55IHBhcnRpYWwgcGFja2V0cyBpbiB0aGUgYnVmZmVyXG4gICAgaWYgKHRoaXMuZW5kID4gMCkge1xuICAgICAgcmVtYWluaW5nID0gTVAyVF9QQUNLRVRfTEVOR1RIIC0gdGhpcy5lbmQ7XG4gICAgICB0aGlzLmJ1ZmZlci5zZXQoYnl0ZXMuc3ViYXJyYXkoMCwgcmVtYWluaW5nKSwgdGhpcy5lbmQpO1xuXG4gICAgICAvLyB3ZSBzdGlsbCBkaWRuJ3Qgd3JpdGUgb3V0IGEgY29tcGxldGUgcGFja2V0XG4gICAgICBpZiAoYnl0ZXMuYnl0ZUxlbmd0aCA8IHJlbWFpbmluZykge1xuICAgICAgICB0aGlzLmVuZCArPSBieXRlcy5ieXRlTGVuZ3RoO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGJ5dGVzID0gYnl0ZXMuc3ViYXJyYXkocmVtYWluaW5nKTtcbiAgICAgIHRoaXMuZW5kID0gMDtcbiAgICAgIHRoaXMudHJpZ2dlcignZGF0YScsIHRoaXMuYnVmZmVyKTtcbiAgICB9XG5cbiAgICAvLyBpZiBsZXNzIHRoYW4gYSBzaW5nbGUgcGFja2V0IGlzIGF2YWlsYWJsZSwgYnVmZmVyIGl0IHVwIGZvciBsYXRlclxuICAgIGlmIChieXRlcy5ieXRlTGVuZ3RoIDwgTVAyVF9QQUNLRVRfTEVOR1RIKSB7XG4gICAgICB0aGlzLmJ1ZmZlci5zZXQoYnl0ZXMuc3ViYXJyYXkoaSksIHRoaXMuZW5kKTtcbiAgICAgIHRoaXMuZW5kICs9IGJ5dGVzLmJ5dGVMZW5ndGg7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHBhcnNlIG91dCBhbGwgdGhlIGNvbXBsZXRlZCBwYWNrZXRzXG4gICAgaSA9IDA7XG4gICAgZG8ge1xuICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgYnl0ZXMuc3ViYXJyYXkoaSwgaSArIE1QMlRfUEFDS0VUX0xFTkdUSCkpO1xuICAgICAgaSArPSBNUDJUX1BBQ0tFVF9MRU5HVEg7XG4gICAgICByZW1haW5pbmcgPSBieXRlcy5ieXRlTGVuZ3RoIC0gaTtcbiAgICB9IHdoaWxlIChpIDwgYnl0ZXMuYnl0ZUxlbmd0aCAmJiByZW1haW5pbmcgPj0gTVAyVF9QQUNLRVRfTEVOR1RIKTtcbiAgICAvLyBidWZmZXIgYW55IHBhcnRpYWwgcGFja2V0cyBsZWZ0IG92ZXJcbiAgICBpZiAocmVtYWluaW5nID4gMCkge1xuICAgICAgdGhpcy5idWZmZXIuc2V0KGJ5dGVzLnN1YmFycmF5KGkpKTtcbiAgICAgIHRoaXMuZW5kID0gcmVtYWluaW5nO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFjY2VwdHMgYW4gTVAyVCBUcmFuc3BvcnRQYWNrZXRTdHJlYW0gYW5kIGVtaXRzIGRhdGEgZXZlbnRzIHdpdGggcGFyc2VkXG4gKiBmb3JtcyBvZiB0aGUgaW5kaXZpZHVhbCB0cmFuc3BvcnQgc3RyZWFtIHBhY2tldHMuXG4gKi9cbmNsYXNzIFRyYW5zcG9ydFBhcnNlU3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnByb2dyYW1NYXBUYWJsZSA9IHt9O1xuICB9XG5cbiAgcGFyc2VQc2kocGF5bG9hZCwgcHNpKSB7XG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgLy8gUFNJIHBhY2tldHMgbWF5IGJlIHNwbGl0IGludG8gbXVsdGlwbGUgc2VjdGlvbnMgYW5kIHRob3NlXG4gICAgLy8gc2VjdGlvbnMgbWF5IGJlIHNwbGl0IGludG8gbXVsdGlwbGUgcGFja2V0cy4gSWYgYSBQU0lcbiAgICAvLyBzZWN0aW9uIHN0YXJ0cyBpbiB0aGlzIHBhY2tldCwgdGhlIHBheWxvYWRfdW5pdF9zdGFydF9pbmRpY2F0b3JcbiAgICAvLyB3aWxsIGJlIHRydWUgYW5kIHRoZSBmaXJzdCBieXRlIG9mIHRoZSBwYXlsb2FkIHdpbGwgaW5kaWNhdGVcbiAgICAvLyB0aGUgb2Zmc2V0IGZyb20gdGhlIGN1cnJlbnQgcG9zaXRpb24gdG8gdGhlIHN0YXJ0IG9mIHRoZVxuICAgIC8vIHNlY3Rpb24uXG4gICAgaWYgKHBzaS5wYXlsb2FkVW5pdFN0YXJ0SW5kaWNhdG9yKSB7XG4gICAgICBvZmZzZXQgKz0gcGF5bG9hZFtvZmZzZXRdICsgMTtcbiAgICB9XG5cbiAgICBpZiAocHNpLnR5cGUgPT09ICdwYXQnKSB7XG4gICAgICB0aGlzLnBhcnNlUGF0KHBheWxvYWQuc3ViYXJyYXkob2Zmc2V0KSwgcHNpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJzZVBtdChwYXlsb2FkLnN1YmFycmF5KG9mZnNldCksIHBzaSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VQYXQocGF5bG9hZCwgcGF0KSB7XG4gICAgcGF0LnNlY3Rpb25OdW1iZXIgPSBwYXlsb2FkWzddO1xuICAgIHBhdC5sYXN0U2VjdGlvbk51bWJlciA9IHBheWxvYWRbOF07XG5cbiAgICAvLyBza2lwIHRoZSBQU0kgaGVhZGVyIGFuZCBwYXJzZSB0aGUgZmlyc3QgUE1UIGVudHJ5XG4gICAgcGF0LnBtdFBpZCA9IHRoaXMucG10UGlkID0gKHBheWxvYWRbMTBdICYgMHgxRikgPDwgOCB8IHBheWxvYWRbMTFdO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG91dCB0aGUgcmVsZXZhbnQgZmllbGRzIG9mIGEgUHJvZ3JhbSBNYXAgVGFibGUgKFBNVCkuXG4gICAqIEBwYXJhbSBwYXlsb2FkIHtVaW50OEFycmF5fSB0aGUgUE1ULXNwZWNpZmljIHBvcnRpb24gb2YgYW4gTVAyVFxuICAgKiBwYWNrZXQuIFRoZSBmaXJzdCBieXRlIGluIHRoaXMgYXJyYXkgc2hvdWxkIGJlIHRoZSB0YWJsZV9pZFxuICAgKiBmaWVsZC5cbiAgICogQHBhcmFtIHBtdCB7b2JqZWN0fSB0aGUgb2JqZWN0IHRoYXQgc2hvdWxkIGJlIGRlY29yYXRlZCB3aXRoXG4gICAqIGZpZWxkcyBwYXJzZWQgZnJvbSB0aGUgUE1ULlxuICAgKi9cbiAgcGFyc2VQbXQocGF5bG9hZCwgcG10KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgb2Zmc2V0O1xuXG4gICAgLy8gUE1UcyBjYW4gYmUgc2VudCBhaGVhZCBvZiB0aGUgdGltZSB3aGVuIHRoZXkgc2hvdWxkIGFjdHVhbGx5XG4gICAgLy8gdGFrZSBlZmZlY3QuIFdlIGRvbid0IGJlbGlldmUgdGhpcyBzaG91bGQgZXZlciBiZSB0aGUgY2FzZVxuICAgIC8vIGZvciBITFMgYnV0IHdlJ2xsIGlnbm9yZSBcImZvcndhcmRcIiBQTVQgZGVjbGFyYXRpb25zIGlmIHdlIHNlZVxuICAgIC8vIHRoZW0uIEZ1dHVyZSBQTVQgZGVjbGFyYXRpb25zIGhhdmUgdGhlIGN1cnJlbnRfbmV4dF9pbmRpY2F0b3JcbiAgICAvLyBzZXQgdG8gemVyby5cbiAgICBpZiAoIShwYXlsb2FkWzVdICYgMHgwMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBvdmVyd3JpdGUgYW55IGV4aXN0aW5nIHByb2dyYW0gbWFwIHRhYmxlXG4gICAgdGhpcy5wcm9ncmFtTWFwVGFibGUgPSB7fTtcblxuICAgIC8vIHRoZSBtYXBwaW5nIHRhYmxlIGVuZHMgYXQgdGhlIGVuZCBvZiB0aGUgY3VycmVudCBzZWN0aW9uXG4gICAgc2VjdGlvbkxlbmd0aCA9IChwYXlsb2FkWzFdICYgMHgwZikgPDwgOCB8IHBheWxvYWRbMl07XG4gICAgdGFibGVFbmQgPSAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG5cbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKHBheWxvYWRbMTBdICYgMHgwZikgPDwgOCB8IHBheWxvYWRbMTFdO1xuXG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCA9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICAvLyBhZGQgYW4gZW50cnkgdGhhdCBtYXBzIHRoZSBlbGVtZW50YXJ5X3BpZCB0byB0aGUgc3RyZWFtX3R5cGVcbiAgICAgIHRoaXMucHJvZ3JhbU1hcFRhYmxlWyhwYXlsb2FkW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IHBheWxvYWRbb2Zmc2V0ICsgMl1dID0gcGF5bG9hZFtvZmZzZXRdO1xuXG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChwYXlsb2FkW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IHBheWxvYWRbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG5cbiAgICAvLyByZWNvcmQgdGhlIG1hcCBvbiB0aGUgcGFja2V0IGFzIHdlbGxcbiAgICBwbXQucHJvZ3JhbU1hcFRhYmxlID0gdGhpcy5wcm9ncmFtTWFwVGFibGU7XG4gIH1cblxuICBwYXJzZVBlcyhwYXlsb2FkLCBwZXMpIHtcbiAgICB2YXIgcHRzRHRzRmxhZ3M7XG5cbiAgICBpZiAoIXBlcy5wYXlsb2FkVW5pdFN0YXJ0SW5kaWNhdG9yKSB7XG4gICAgICBwZXMuZGF0YSA9IHBheWxvYWQ7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gZmluZCBvdXQgaWYgdGhpcyBwYWNrZXRzIHN0YXJ0cyBhIG5ldyBrZXlmcmFtZVxuICAgIHBlcy5kYXRhQWxpZ25tZW50SW5kaWNhdG9yID0gKHBheWxvYWRbNl0gJiAweDA0KSAhPT0gMDtcbiAgICAvLyBQRVMgcGFja2V0cyBtYXkgYmUgYW5ub3RhdGVkIHdpdGggYSBQVFMgdmFsdWUsIG9yIGEgUFRTIHZhbHVlXG4gICAgLy8gYW5kIGEgRFRTIHZhbHVlLiBEZXRlcm1pbmUgd2hhdCBjb21iaW5hdGlvbiBvZiB2YWx1ZXMgaXNcbiAgICAvLyBhdmFpbGFibGUgdG8gd29yayB3aXRoLlxuICAgIHB0c0R0c0ZsYWdzID0gcGF5bG9hZFs3XTtcblxuICAgIC8vIFBUUyBhbmQgRFRTIGFyZSBub3JtYWxseSBzdG9yZWQgYXMgYSAzMy1iaXQgbnVtYmVyLiAgSmF2YXNjcmlwdFxuICAgIC8vIHBlcmZvcm1zIGFsbCBiaXR3aXNlIG9wZXJhdGlvbnMgb24gMzItYml0IGludGVnZXJzIGJ1dCBpdCdzXG4gICAgLy8gY29udmVuaWVudCB0byBjb252ZXJ0IGZyb20gOTBucyB0byAxbXMgdGltZSBzY2FsZSBhbnl3YXkuIFNvXG4gICAgLy8gd2hhdCB3ZSBhcmUgZ29pbmcgdG8gZG8gaW5zdGVhZCBpcyBkcm9wIHRoZSBsZWFzdCBzaWduaWZpY2FudFxuICAgIC8vIGJpdCAoaW4gZWZmZWN0LCBkaXZpZGluZyBieSB0d28pIHRoZW4gd2UgY2FuIGRpdmlkZSBieSA0NSAoNDUgKlxuICAgIC8vIDIgPSA5MCkgdG8gZ2V0IG1zLlxuICAgIGlmIChwdHNEdHNGbGFncyAmIDB4QzApIHtcbiAgICAgIC8vIHRoZSBQVFMgYW5kIERUUyBhcmUgbm90IHdyaXR0ZW4gb3V0IGRpcmVjdGx5LiBGb3IgaW5mb3JtYXRpb25cbiAgICAgIC8vIG9uIGhvdyB0aGV5IGFyZSBlbmNvZGVkLCBzZWVcbiAgICAgIC8vIGh0dHA6Ly9kdmQuc291cmNlZm9yZ2UubmV0L2R2ZGluZm8vcGVzLWhkci5odG1sXG4gICAgICBwZXMucHRzID0gKHBheWxvYWRbOV0gJiAweDBFKSA8PCAyOFxuICAgICAgICB8IChwYXlsb2FkWzEwXSAmIDB4RkYpIDw8IDIxXG4gICAgICAgIHwgKHBheWxvYWRbMTFdICYgMHhGRSkgPDwgMTNcbiAgICAgICAgfCAocGF5bG9hZFsxMl0gJiAweEZGKSA8PCAgNlxuICAgICAgICB8IChwYXlsb2FkWzEzXSAmIDB4RkUpID4+PiAgMjtcbiAgICAgIHBlcy5wdHMgLz0gNDU7XG4gICAgICBwZXMuZHRzID0gcGVzLnB0cztcbiAgICAgIGlmIChwdHNEdHNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgcGVzLmR0cyA9IChwYXlsb2FkWzE0XSAmIDB4MEUgKSA8PCAyOFxuICAgICAgICAgIHwgKHBheWxvYWRbMTVdICYgMHhGRiApIDw8IDIxXG4gICAgICAgICAgfCAocGF5bG9hZFsxNl0gJiAweEZFICkgPDwgMTNcbiAgICAgICAgICB8IChwYXlsb2FkWzE3XSAmIDB4RkYgKSA8PCA2XG4gICAgICAgICAgfCAocGF5bG9hZFsxOF0gJiAweEZFICkgPj4+IDI7XG4gICAgICAgIHBlcy5kdHMgLz0gNDU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGhlIGRhdGEgc2VjdGlvbiBzdGFydHMgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIFBFUyBoZWFkZXIuXG4gICAgLy8gcGVzX2hlYWRlcl9kYXRhX2xlbmd0aCBzcGVjaWZpZXMgdGhlIG51bWJlciBvZiBoZWFkZXIgYnl0ZXNcbiAgICAvLyB0aGF0IGZvbGxvdyB0aGUgbGFzdCBieXRlIG9mIHRoZSBmaWVsZC5cbiAgICBwZXMuZGF0YSA9IHBheWxvYWQuc3ViYXJyYXkoOSArIHBheWxvYWRbOF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGl2ZXIgYSBuZXcgTVAyVCBwYWNrZXQgdG8gdGhlIHN0cmVhbS5cbiAgICovXG4gIHB1c2gocGFja2V0KSB7XG4gICAgdmFyXG4gICAgICByZXN1bHQgPSB7fSxcbiAgICAgIG9mZnNldCA9IDQ7XG4gICAgLy8gbWFrZSBzdXJlIHBhY2tldCBpcyBhbGlnbmVkIG9uIGEgc3luYyBieXRlXG4gICAgaWYgKHBhY2tldFswXSAhPT0gMHg0Nykge1xuICAgICAgcmV0dXJuIHRoaXMudHJpZ2dlcignZXJyb3InLCAnbWlzLWFsaWduZWQgcGFja2V0Jyk7XG4gICAgfVxuICAgIHJlc3VsdC5wYXlsb2FkVW5pdFN0YXJ0SW5kaWNhdG9yID0gISEocGFja2V0WzFdICYgMHg0MCk7XG5cbiAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIHBhY2tldFsxXVxuICAgIHJlc3VsdC5waWQgPSBwYWNrZXRbMV0gJiAweDFmO1xuICAgIHJlc3VsdC5waWQgPDw9IDg7XG4gICAgcmVzdWx0LnBpZCB8PSBwYWNrZXRbMl07XG5cbiAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGVcbiAgICAvLyBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLiBUaGUgYWRhcHRhdGlvbiBmaWVsZCBpc1xuICAgIC8vIHVzZWQgdG8gYWRkIHN0dWZmaW5nIHRvIFBFUyBwYWNrZXRzIHRoYXQgZG9uJ3QgZmlsbCBhIGNvbXBsZXRlXG4gICAgLy8gVFMgcGFja2V0LCBhbmQgdG8gc3BlY2lmeSBzb21lIGZvcm1zIG9mIHRpbWluZyBhbmQgY29udHJvbCBkYXRhXG4gICAgLy8gdGhhdCB3ZSBkbyBub3QgY3VycmVudGx5IHVzZS5cbiAgICBpZiAoKChwYWNrZXRbM10gJiAweDMwKSA+Pj4gNCkgPiAweDAxKSB7XG4gICAgICBvZmZzZXQgKz0gcGFja2V0W29mZnNldF0gKyAxO1xuICAgIH1cblxuICAgIC8vIHBhcnNlIHRoZSByZXN0IG9mIHRoZSBwYWNrZXQgYmFzZWQgb24gdGhlIHR5cGVcbiAgICBpZiAocmVzdWx0LnBpZCA9PT0gUEFUX1BJRCkge1xuICAgICAgcmVzdWx0LnR5cGUgPSAncGF0JztcbiAgICAgIHRoaXMucGFyc2VQc2kocGFja2V0LnN1YmFycmF5KG9mZnNldCksIHJlc3VsdCk7XG4gICAgfSBlbHNlIGlmIChyZXN1bHQucGlkID09PSB0aGlzLnBtdFBpZCkge1xuICAgICAgcmVzdWx0LnR5cGUgPSAncG10JztcbiAgICAgIHRoaXMucGFyc2VQc2kocGFja2V0LnN1YmFycmF5KG9mZnNldCksIHJlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5zdHJlYW1UeXBlID0gdGhpcy5wcm9ncmFtTWFwVGFibGVbcmVzdWx0LnBpZF07XG4gICAgICBpZihyZXN1bHQuc3RyZWFtVHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC50eXBlID0gJ3Blcyc7XG4gICAgICAgIHRoaXMucGFyc2VQZXMocGFja2V0LnN1YmFycmF5KG9mZnNldCksIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgcmVzdWx0KTtcbiAgfVxufVxuXG4vKipcbiAqIFJlY29uc2lzdHV0ZXMgcHJvZ3JhbSBlbGVtZW50YXJ5IHN0cmVhbSAoUEVTKSBwYWNrZXRzIGZyb20gcGFyc2VkXG4gKiB0cmFuc3BvcnQgc3RyZWFtIHBhY2tldHMuIFRoYXQgaXMsIGlmIHlvdSBwaXBlIGFuXG4gKiBtcDJ0LlRyYW5zcG9ydFBhcnNlU3RyZWFtIGludG8gYSBtcDJ0LkVsZW1lbnRhcnlTdHJlYW0sIHRoZSBvdXRwdXRcbiAqIGV2ZW50cyB3aWxsIGJlIGV2ZW50cyB3aGljaCBjYXB0dXJlIHRoZSBieXRlcyBmb3IgaW5kaXZpZHVhbCBQRVNcbiAqIHBhY2tldHMgcGx1cyByZWxldmFudCBtZXRhZGF0YSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIHRoZVxuICogY29udGFpbmVyLlxuICovXG5jbGFzcyBFbGVtZW50YXJ5U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuYXVkaW8gPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgdGhpcy52aWRlbyA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgfVxuXG4gIGZsdXNoU3RyZWFtKHN0cmVhbSwgdHlwZSkge1xuICAgIHZhclxuICAgICAgZXZlbnQgPSB7XG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGRhdGE6IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKSxcbiAgICAgIH0sXG4gICAgICBpID0gMCxcbiAgICAgIGZyYWdtZW50O1xuXG4gICAgLy8gZG8gbm90aGluZyBpZiB0aGVyZSBpcyBubyBidWZmZXJlZCBkYXRhXG4gICAgaWYgKCFzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZXZlbnQudHJhY2tJZCA9IHN0cmVhbS5kYXRhWzBdLnBpZDtcbiAgICBldmVudC5wdHMgPSBzdHJlYW0uZGF0YVswXS5wdHM7XG4gICAgZXZlbnQuZHRzID0gc3RyZWFtLmRhdGFbMF0uZHRzO1xuICAgIC8vIHJlYXNzZW1ibGUgdGhlIHBhY2tldFxuICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgIGZyYWdtZW50ID0gc3RyZWFtLmRhdGEuc2hpZnQoKTtcblxuICAgICAgZXZlbnQuZGF0YS5zZXQoZnJhZ21lbnQuZGF0YSwgaSk7XG4gICAgICBpICs9IGZyYWdtZW50LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgc3RyZWFtLnNpemUgPSAwO1xuICAgIHRoaXMudHJpZ2dlcignZGF0YScsIGV2ZW50KTtcbiAgfVxuXG4gIHB1c2goZGF0YSkge1xuICAgIHN3aXRjaChkYXRhLnR5cGUpIHtcbiAgICAgIGNhc2UgJ3BhdCc6XG4gICAgICAgICAgLy8gd2UgaGF2ZSB0byB3YWl0IGZvciB0aGUgUE1UIHRvIGFycml2ZSBhcyB3ZWxsIGJlZm9yZSB3ZVxuICAgICAgICAgICAgLy8gaGF2ZSBhbnkgbWVhbmluZ2Z1bCBtZXRhZGF0YVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwbXQnOlxuICAgICAgICB2YXJcbiAgICAgICAgZXZlbnQgPSB7XG4gICAgICAgICAgdHlwZTogJ21ldGFkYXRhJyxcbiAgICAgICAgICB0cmFja3M6IFtdXG4gICAgICAgIH0sXG4gICAgICAgIHByb2dyYW1NYXBUYWJsZSA9IGRhdGEucHJvZ3JhbU1hcFRhYmxlLFxuICAgICAgICBrLFxuICAgICAgICB0cmFjaztcblxuICAgICAgICAvLyB0cmFuc2xhdGUgc3RyZWFtcyB0byB0cmFja3NcbiAgICAgICAgZm9yIChrIGluIHByb2dyYW1NYXBUYWJsZSkge1xuICAgICAgICAgIGlmIChwcm9ncmFtTWFwVGFibGUuaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgIHRyYWNrID0ge307XG4gICAgICAgICAgICB0cmFjay5pZCA9ICtrO1xuICAgICAgICAgICAgaWYgKHByb2dyYW1NYXBUYWJsZVtrXSA9PT0gSDI2NF9TVFJFQU1fVFlQRSkge1xuICAgICAgICAgICAgICB0cmFjay5jb2RlYyA9ICdhdmMnO1xuICAgICAgICAgICAgICB0cmFjay50eXBlID0gJ3ZpZGVvJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvZ3JhbU1hcFRhYmxlW2tdID09PSBBRFRTX1NUUkVBTV9UWVBFKSB7XG4gICAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gJ2FkdHMnO1xuICAgICAgICAgICAgICB0cmFjay50eXBlID0gJ2F1ZGlvJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LnRyYWNrcy5wdXNoKHRyYWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgZXZlbnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3Blcyc6XG4gICAgICAgIHZhciBzdHJlYW0sIHN0cmVhbVR5cGU7XG5cbiAgICAgICAgaWYgKGRhdGEuc3RyZWFtVHlwZSA9PT0gSDI2NF9TVFJFQU1fVFlQRSkge1xuICAgICAgICAgIHN0cmVhbSA9IHRoaXMudmlkZW87XG4gICAgICAgICAgc3RyZWFtVHlwZSA9ICd2aWRlbyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyZWFtID0gdGhpcy5hdWRpbztcbiAgICAgICAgICBzdHJlYW1UeXBlID0gJ2F1ZGlvJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIGEgbmV3IHBhY2tldCBpcyBzdGFydGluZywgd2UgY2FuIGZsdXNoIHRoZSBjb21wbGV0ZWRcbiAgICAgICAgLy8gcGFja2V0XG4gICAgICAgIGlmIChkYXRhLnBheWxvYWRVbml0U3RhcnRJbmRpY2F0b3IpIHtcbiAgICAgICAgICB0aGlzLmZsdXNoU3RyZWFtKHN0cmVhbSwgc3RyZWFtVHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYnVmZmVyIHRoaXMgZnJhZ21lbnQgdW50aWwgd2UgYXJlIHN1cmUgd2UndmUgcmVjZWl2ZWQgdGhlXG4gICAgICAgIC8vIGNvbXBsZXRlIHBheWxvYWRcbiAgICAgICAgc3RyZWFtLmRhdGEucHVzaChkYXRhKTtcbiAgICAgICAgc3RyZWFtLnNpemUgKz0gZGF0YS5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgLyoqXG4gICAqIEZsdXNoIGFueSByZW1haW5pbmcgaW5wdXQuIFZpZGVvIFBFUyBwYWNrZXRzIG1heSBiZSBvZiB2YXJpYWJsZVxuICAgKiBsZW5ndGguIE5vcm1hbGx5LCB0aGUgc3RhcnQgb2YgYSBuZXcgdmlkZW8gcGFja2V0IGNhbiB0cmlnZ2VyIHRoZVxuICAgKiBmaW5hbGl6YXRpb24gb2YgdGhlIHByZXZpb3VzIHBhY2tldC4gVGhhdCBpcyBub3QgcG9zc2libGUgaWYgbm9cbiAgICogbW9yZSB2aWRlbyBpcyBmb3J0aGNvbWluZywgaG93ZXZlci4gSW4gdGhhdCBjYXNlLCBzb21lIG90aGVyXG4gICAqIG1lY2hhbmlzbSAobGlrZSB0aGUgZW5kIG9mIHRoZSBmaWxlKSBoYXMgdG8gYmUgZW1wbG95ZWQuIFdoZW4gaXQgaXNcbiAgICogY2xlYXIgdGhhdCBubyBhZGRpdGlvbmFsIGRhdGEgaXMgZm9ydGhjb21pbmcsIGNhbGxpbmcgdGhpcyBtZXRob2RcbiAgICogd2lsbCBmbHVzaCB0aGUgYnVmZmVyZWQgcGFja2V0cy5cbiAgICovXG4gIGVuZCgpIHtcbiAgICB0aGlzLmZsdXNoU3RyZWFtKHRoaXMudmlkZW8sICd2aWRlbycpO1xuICAgIHRoaXMuZmx1c2hTdHJlYW0odGhpcy5hdWRpbywgJ2F1ZGlvJyk7XG4gIH1cbn1cbi8qXG4gKiBBY2NlcHRzIGEgRWxlbWVudGFyeVN0cmVhbSBhbmQgZW1pdHMgZGF0YSBldmVudHMgd2l0aCBwYXJzZWRcbiAqIEFBQyBBdWRpbyBGcmFtZXMgb2YgdGhlIGluZGl2aWR1YWwgcGFja2V0cy5cbiAqL1xuY2xhc3MgQWFjU3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0QXVkaW9TcGVjaWZpY0NvbmZpZyhkYXRhKSB7XG4gICAgdmFyIGFkdHNQcm90ZWN0aW9uQWJzZW50LCAvLyA6Qm9vbGVhblxuICAgICAgICBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBhZHRzRnJhbWVTaXplLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVDb3VudCwgLy8gOmludFxuICAgICAgICBhZHRzRHVyYXRpb247IC8vIDppbnRcblxuICAgICAgICB2YXIgYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgICAgICAgICAgOTYwMDAsIDg4MjAwLFxuICAgICAgICAgICAgNjQwMDAsIDQ4MDAwLFxuICAgICAgICAgICAgNDQxMDAsIDMyMDAwLFxuICAgICAgICAgICAgMjQwMDAsIDIyMDUwLFxuICAgICAgICAgICAgMTYwMDAsIDEyMDAwXG4gICAgICAgICAgXTtcblxuICAgICAgLy8gYnl0ZSAxXG4gICAgICBhZHRzUHJvdGVjdGlvbkFic2VudCA9ICEhKGRhdGFbMV0gJiAweDAxKTtcblxuICAgICAgLy8gYnl0ZSAyXG4gICAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVsyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhWzJdICYgMHgwMSkgPDwgMik7XG5cbiAgICAgIC8vIGJ5dGUgM1xuICAgICAgYWR0c0NoYW5lbENvbmZpZyB8PSAoKGRhdGFbM10gJiAweEMwKSA+Pj4gNik7XG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhWzNdICYgMHgwMykgPDwgMTEpO1xuXG4gICAgICAvLyBieXRlIDRcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbNF0gPDwgMyk7XG5cbiAgICAgIC8vIGJ5dGUgNVxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBhZHRzRnJhbWVTaXplIC09IChhZHRzUHJvdGVjdGlvbkFic2VudCA/IDcgOiA5KTtcblxuICAgICAgLy8gYnl0ZSA2XG4gICAgICBhZHRzU2FtcGxlQ291bnQgPSAoKGRhdGFbNl0gJiAweDAzKSArIDEpICogMTAyNDtcbiAgICAgIGFkdHNEdXJhdGlvbiA9IChhZHRzU2FtcGxlQ291bnQgKiAxMDAwKSAvIGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdO1xuICAgICAgdGhpcy5jb25maWcgPSBuZXcgVWludDhBcnJheSgyKTtcbiAgICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICBBdWRpbyBQcm9maWxlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAgIDA6IERlZmluZWQgaW4gQU9UIFNwZWNpZmMgQ29uZmlnXG4gICAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgICAqL1xuICAgICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICAgIHRoaXMuY29uZmlnWzBdID0gYWR0c09iamVjdFR5cGUgPDwgMztcblxuICAgICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgICAgdGhpcy5jb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICB0aGlzLmNvbmZpZ1sxXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcblxuICAgICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICAgIHRoaXMuY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcblxuICAgICAgdGhpcy5zdGVyZW8gPSAoMiA9PT0gYWR0c0NoYW5lbENvbmZpZyk7XG4gICAgICB0aGlzLmF1ZGlvc2FtcGxlcmF0ZSA9IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdO1xuICB9XG5cbiAgcHVzaChwYWNrZXQpIHtcblxuICAgIGlmIChwYWNrZXQudHlwZSA9PT0gJ2F1ZGlvJyAmJiBwYWNrZXQuZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG5cbiAgICAgIHZhciBhYWNGcmFtZSwgLy8gOkZyYW1lID0gbnVsbDtcbiAgICAgICAgbmV4dFBUUyA9IHBhY2tldC5wdHMsXG4gICAgICAgIGRhdGEgPSBwYWNrZXQuZGF0YTtcblxuICAgICAgLy8gYnl0ZSAwXG4gICAgICBpZiAoMHhGRiAhPT0gZGF0YVswXSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ0Vycm9yIG5vIEFURFMgaGVhZGVyIGZvdW5kJyk7XG4gICAgICB9XG5cbiAgICAgIGlmKHRoaXMuY29uZmlnID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5nZXRBdWRpb1NwZWNpZmljQ29uZmlnKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICBhYWNGcmFtZSA9IHt9O1xuICAgICAgYWFjRnJhbWUucHRzID0gbmV4dFBUUztcbiAgICAgIGFhY0ZyYW1lLmR0cyA9IG5leHRQVFM7XG4gICAgICBhYWNGcmFtZS5ieXRlcyA9IG5ldyBVaW50OEFycmF5KCk7XG5cbiAgICAgIC8vIEFBQyBpcyBhbHdheXMgMTBcbiAgICAgIGFhY0ZyYW1lLmF1ZGlvY29kZWNpZCA9IDEwO1xuICAgICAgYWFjRnJhbWUuc3RlcmVvID0gdGhpcy5zdGVyZW87XG4gICAgICBhYWNGcmFtZS5hdWRpb3NhbXBsZXJhdGUgPSB0aGlzLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgIC8vIElzIEFBQyBhbHdheXMgMTYgYml0P1xuICAgICAgYWFjRnJhbWUuYXVkaW9zYW1wbGVzaXplID0gMTY7XG4gICAgICBhYWNGcmFtZS5ieXRlcyA9IHBhY2tldC5kYXRhLnN1YmFycmF5KDcsIHBhY2tldC5kYXRhLmxlbmd0aCk7XG4gICAgICBwYWNrZXQuZnJhbWUgPSBhYWNGcmFtZTtcbiAgICAgIHBhY2tldC5jb25maWcgPSB0aGlzLmNvbmZpZztcbiAgICAgIHBhY2tldC5hdWRpb3NhbXBsZXJhdGUgPSB0aGlzLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgIHRoaXMudHJpZ2dlcignZGF0YScsIHBhY2tldCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQWNjZXB0cyBhIE5BTCB1bml0IGJ5dGUgc3RyZWFtIGFuZCB1bnBhY2tzIHRoZSBlbWJlZGRlZCBOQUwgdW5pdHMuXG4gKi9cbmNsYXNzIE5hbEJ5dGVTdHJlYW0gZXh0ZW5kcyBTdHJlYW0ge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleD02O1xuICAgIHRoaXMuc3luY1BvaW50ID0xO1xuICAgIHRoaXMuYnVmZmVyID0gbnVsbDtcbiAgfVxuXG4gIHB1c2ggKGRhdGEpIHtcbiAgICB2YXIgc3dhcEJ1ZmZlcjtcblxuICAgIGlmICghdGhpcy5idWZmZXIpIHtcbiAgICAgIHRoaXMuYnVmZmVyID0gZGF0YS5kYXRhO1xuICAgIH0gZWxzZSB7XG4gICAgICBzd2FwQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5idWZmZXIuYnl0ZUxlbmd0aCArIGRhdGEuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHN3YXBCdWZmZXIuc2V0KHRoaXMuYnVmZmVyKTtcbiAgICAgIHN3YXBCdWZmZXIuc2V0KGRhdGEuZGF0YSwgdGhpcy5idWZmZXIuYnl0ZUxlbmd0aCk7XG4gICAgICB0aGlzLmJ1ZmZlciA9IHN3YXBCdWZmZXI7XG4gICAgfVxuXG4gICAgLy8gUmVjLiBJVFUtVCBILjI2NCwgQW5uZXggQlxuICAgIC8vIHNjYW4gZm9yIE5BTCB1bml0IGJvdW5kYXJpZXNcblxuICAgIC8vIGEgbWF0Y2ggbG9va3MgbGlrZSB0aGlzOlxuICAgIC8vIDAgMCAxIC4uIE5BTCAuLiAwIDAgMVxuICAgIC8vIF4gc3luYyBwb2ludCAgICAgICAgXiBpXG4gICAgLy8gb3IgdGhpczpcbiAgICAvLyAwIDAgMSAuLiBOQUwgLi4gMCAwIDBcbiAgICAvLyBeIHN5bmMgcG9pbnQgICAgICAgIF4gaVxuICAgIHZhciBpID0gdGhpcy5pbmRleDtcbiAgICB2YXIgc3luYyA9IHRoaXMuc3luY1BvaW50O1xuICAgIHZhciBidWYgPSB0aGlzLmJ1ZmZlcjtcbiAgICB3aGlsZSAoaSA8IGJ1Zi5ieXRlTGVuZ3RoKSB7XG4gICAgICBzd2l0Y2ggKGJ1ZltpXSkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICAvLyBza2lwIHBhc3Qgbm9uLXN5bmMgc2VxdWVuY2VzXG4gICAgICAgIGlmIChidWZbaSAtIDFdICE9PSAwKSB7XG4gICAgICAgICAgaSArPSAyO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGVsc2UgaWYgKGJ1ZltpIC0gMl0gIT09IDApIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWxpdmVyIHRoZSBOQUwgdW5pdFxuICAgICAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCBidWYuc3ViYXJyYXkoc3luYyArIDMsIGkgLSAyKSk7XG5cbiAgICAgICAgLy8gZHJvcCB0cmFpbGluZyB6ZXJvZXNcbiAgICAgICAgZG8ge1xuICAgICAgICAgIGkrKztcbiAgICAgICAgfSB3aGlsZSAoYnVmW2ldICE9PSAxKTtcbiAgICAgICAgc3luYyA9IGkgLSAyO1xuICAgICAgICBpICs9IDM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxOlxuICAgICAgICAvLyBza2lwIHBhc3Qgbm9uLXN5bmMgc2VxdWVuY2VzXG4gICAgICAgIGlmIChidWZbaSAtIDFdICE9PSAwIHx8XG4gICAgICAgICAgICBidWZbaSAtIDJdICE9PSAwKSB7XG4gICAgICAgICAgaSArPSAzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsaXZlciB0aGUgTkFMIHVuaXRcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgYnVmLnN1YmFycmF5KHN5bmMgKyAzLCBpIC0gMikpO1xuICAgICAgICBzeW5jID0gaSAtIDI7XG4gICAgICAgIGkgKz0gMztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpICs9IDM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBmaWx0ZXIgb3V0IHRoZSBOQUwgdW5pdHMgdGhhdCB3ZXJlIGRlbGl2ZXJlZFxuICAgIHRoaXMuYnVmZmVyID0gYnVmLnN1YmFycmF5KHN5bmMpO1xuICAgIGkgLT0gc3luYztcbiAgICB0aGlzLmluZGV4ID0gaTtcbiAgICB0aGlzLnN5bmNQb2ludCA9IDA7XG4gIH1cblxuICBlbmQoKSB7XG4gICAgLy8gZGVsaXZlciB0aGUgbGFzdCBidWZmZXJlZCBOQUwgdW5pdFxuICAgIGlmICh0aGlzLmJ1ZmZlci5ieXRlTGVuZ3RoID4gMykge1xuICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgdGhpcy5idWZmZXIuc3ViYXJyYXkodGhpcy5zeW5jUG9pbnQgKyAzKSk7XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyID0gbnVsbDtcbiAgICB0aGlzLmluZGV4ID0gNjtcbiAgICB0aGlzLnN5bmNQb2ludCA9IDE7XG4gIH1cbn1cbi8qKlxuICogQWNjZXB0cyBpbnB1dCBmcm9tIGEgRWxlbWVudGFyeVN0cmVhbSBhbmQgcHJvZHVjZXMgSC4yNjQgTkFMIHVuaXQgZGF0YVxuICogZXZlbnRzLlxuICovXG5jbGFzcyBIMjY0U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubmFsQnl0ZVN0cmVhbSA9IG5ldyBOYWxCeXRlU3RyZWFtKCk7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtLm9uKCdkYXRhJywgZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBldmVudCA9IHtcbiAgICAgIHRyYWNrSWQ6IHRoaXMudHJhY2tJZCxcbiAgICAgIHB0czogdGhpcy5jdXJyZW50UHRzLFxuICAgICAgZHRzOiB0aGlzLmN1cnJlbnREdHMsXG4gICAgICBkYXRhOiBkYXRhXG4gICAgfTtcbiAgICBzd2l0Y2ggKGRhdGFbMF0gJiAweDFmKSB7XG4gICAgY2FzZSAweDA1OlxuICAgICAgZXZlbnQubmFsVW5pdFR5cGUgPSAnSURSJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMHgwNzpcbiAgICAgIGV2ZW50Lm5hbFVuaXRUeXBlID0gJ1NQUyc7XG4gICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIoZGF0YS5zdWJhcnJheSgxKSk7XG4gICAgICBldmVudC5jb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTZXF1ZW5jZVBhcmFtZXRlclNldCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAweDA4OlxuICAgICAgZXZlbnQubmFsVW5pdFR5cGUgPSAnUFBTJztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMHgwOTpcbiAgICAgIGV2ZW50Lm5hbFVuaXRUeXBlID0gJ0FVRCc7XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgZXZlbnQpO1xuICB9LmJpbmQodGhpcykpO1xuICB9XG5cbiAgcHVzaChwYWNrZXQpIHtcbiAgICBpZiAocGFja2V0LnR5cGUgIT09ICd2aWRlbycpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy50cmFja0lkID0gcGFja2V0LnRyYWNrSWQ7XG4gICAgdGhpcy5jdXJyZW50UHRzID0gcGFja2V0LnB0cztcbiAgICB0aGlzLmN1cnJlbnREdHMgPSBwYWNrZXQuZHRzO1xuICAgIHRoaXMubmFsQnl0ZVN0cmVhbS5wdXNoKHBhY2tldCk7XG4gIH1cblxuICBlbmQoKSB7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtLmVuZCgpO1xuICB9XG5cbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgc2luZ2xlLXRyYWNrLCBJU08gQk1GRiBtZWRpYSBzZWdtZW50IGZyb20gSDI2NCBkYXRhXG4gKiBldmVudHMuIFRoZSBvdXRwdXQgb2YgdGhpcyBzdHJlYW0gY2FuIGJlIGZlZCB0byBhIFNvdXJjZUJ1ZmZlclxuICogY29uZmlndXJlZCB3aXRoIGEgc3VpdGFibGUgaW5pdGlhbGl6YXRpb24gc2VnbWVudC5cbiAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSB0cmFjayBtZXRhZGF0YSBjb25maWd1cmF0aW9uXG4gKi9cbmNsYXNzIFZpZGVvU2VnbWVudFN0cmVhbSBleHRlbmRzIFN0cmVhbSB7XG5cbiAgY29uc3RydWN0b3IodHJhY2spIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc2VxdWVuY2VOdW1iZXIgPSAwO1xuICAgIHRoaXMubmFsVW5pdHMgPSBbXTtcbiAgICB0aGlzLm5hbFVuaXRzTGVuZ3RoID0gMDtcbiAgICB0aGlzLnRyYWNrID0gdHJhY2s7XG4gIH1cblxuICBwdXNoKGRhdGEpIHtcbiAgICAvLyBidWZmZXIgdmlkZW8gdW50aWwgZW5kKCkgaXMgY2FsbGVkXG4gICAgdGhpcy5uYWxVbml0cy5wdXNoKGRhdGEpO1xuICAgIHRoaXMubmFsVW5pdHNMZW5ndGggKz0gZGF0YS5kYXRhLmJ5dGVMZW5ndGg7XG4gIH1cblxuICBlbmQoKSB7XG4gICAgdmFyIHN0YXJ0VW5pdCwgY3VycmVudE5hbCwgbW9vZiwgbWRhdCwgYm94ZXMsIGksIGRhdGEsIHZpZXcsIHNhbXBsZSwgc3RhcnRkdHM7XG5cbiAgICAvLyBjb25jYXRlbmF0ZSB0aGUgdmlkZW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0XG4gICAgLy8gZmlyc3QsIHdlIGhhdmUgdG8gYnVpbGQgdGhlIGluZGV4IGZyb20gYnl0ZSBsb2NhdGlvbnMgdG9cbiAgICAvLyBzYW1wbGVzICh0aGF0IGlzLCBmcmFtZXMpIGluIHRoZSB2aWRlbyBkYXRhXG4gICAgZGF0YSA9IG5ldyBVaW50OEFycmF5KHRoaXMubmFsVW5pdHNMZW5ndGggKyAoNCAqIHRoaXMubmFsVW5pdHMubGVuZ3RoKSk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhkYXRhLmJ1ZmZlcik7XG4gICAgdGhpcy50cmFjay5zYW1wbGVzID0gW107XG4gICAgc2FtcGxlID0ge1xuICAgICAgc2l6ZTogMCxcbiAgICAgIGZsYWdzOiB7XG4gICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgIGlzTm9uU3luY1NhbXBsZSA6IDEsXG4gICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDBcbiAgICAgIH1cbiAgICB9O1xuICAgIGkgPSAwO1xuICAgIHN0YXJ0ZHRzID0gdGhpcy5uYWxVbml0c1swXS5kdHM7XG4gICAgaWYodGhpcy5pbml0RHRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuaW5pdER0cyA9IHN0YXJ0ZHRzO1xuICAgIH1cbiAgICB3aGlsZSAodGhpcy5uYWxVbml0cy5sZW5ndGgpIHtcbiAgICAgIGN1cnJlbnROYWwgPSB0aGlzLm5hbFVuaXRzWzBdO1xuICAgICAgLy8gZmx1c2ggdGhlIHNhbXBsZSB3ZSd2ZSBiZWVuIGJ1aWxkaW5nIHdoZW4gYSBuZXcgc2FtcGxlIGlzIHN0YXJ0ZWRcbiAgICAgIGlmIChjdXJyZW50TmFsLm5hbFVuaXRUeXBlID09PSAnQVVEJykge1xuICAgICAgICBpZiAoc3RhcnRVbml0KSB7XG4gICAgICAgICAgLy8gY29udmVydCB0aGUgZHVyYXRpb24gdG8gOTBrSFogdGltZXNjYWxlIHRvIG1hdGNoIHRoZVxuICAgICAgICAgIC8vIHRpbWVzY2FsZXMgc3BlY2lmaWVkIGluIHRoZSBpbml0IHNlZ21lbnRcbiAgICAgICAgICBzYW1wbGUuZHVyYXRpb24gPSAoY3VycmVudE5hbC5kdHMgLSBzdGFydFVuaXQuZHRzKSAqIDkwO1xuICAgICAgICAgIHRoaXMudHJhY2suc2FtcGxlcy5wdXNoKHNhbXBsZSk7XG4gICAgICAgIH1cbiAgICAgICAgc2FtcGxlID0ge1xuICAgICAgICAgIHNpemU6IDAsXG4gICAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICAgIGRlcGVuZHNPbjogMSxcbiAgICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgICBpc05vblN5bmNTYW1wbGUgOiAxLFxuICAgICAgICAgICAgZGVncmFkYXRpb25Qcmlvcml0eTogMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbXBvc2l0aW9uVGltZU9mZnNldDogY3VycmVudE5hbC5wdHMgLSBjdXJyZW50TmFsLmR0c1xuICAgICAgICB9O1xuICAgICAgICBzdGFydFVuaXQgPSBjdXJyZW50TmFsO1xuICAgICAgfVxuICAgICAgaWYgKGN1cnJlbnROYWwubmFsVW5pdFR5cGUgPT09ICdJRFInKSB7XG4gICAgICAgIC8vIHRoZSBjdXJyZW50IHNhbXBsZSBpcyBhIGtleSBmcmFtZVxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVwZW5kc09uID0gMjtcbiAgICAgICAgc2FtcGxlLmZsYWdzLmlzTm9uU3luY1NhbXBsZSA9IDA7XG4gICAgICB9XG4gICAgICBzYW1wbGUuc2l6ZSArPSA0OyAvLyBzcGFjZSBmb3IgdGhlIE5BTCBsZW5ndGhcbiAgICAgIHNhbXBsZS5zaXplICs9IGN1cnJlbnROYWwuZGF0YS5ieXRlTGVuZ3RoO1xuXG4gICAgICB2aWV3LnNldFVpbnQzMihpLCBjdXJyZW50TmFsLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICBpICs9IDQ7XG4gICAgICBkYXRhLnNldChjdXJyZW50TmFsLmRhdGEsIGkpO1xuICAgICAgaSArPSBjdXJyZW50TmFsLmRhdGEuYnl0ZUxlbmd0aDtcblxuICAgICAgdGhpcy5uYWxVbml0cy5zaGlmdCgpO1xuICAgIH1cbiAgICAvLyByZWNvcmQgdGhlIGxhc3Qgc2FtcGxlXG4gICAgaWYgKHRoaXMudHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHNhbXBsZS5kdXJhdGlvbiA9IHRoaXMudHJhY2suc2FtcGxlc1t0aGlzLnRyYWNrLnNhbXBsZXMubGVuZ3RoIC0gMV0uZHVyYXRpb247XG4gICAgfVxuICAgIHRoaXMudHJhY2suc2FtcGxlcy5wdXNoKHNhbXBsZSk7XG4gICAgdGhpcy5uYWxVbml0c0xlbmd0aCA9IDA7XG4gICAgbWRhdCA9IE1QNC5tZGF0KGRhdGEpO1xuICAgIG1vb2YgPSBNUDQubW9vZih0aGlzLnNlcXVlbmNlTnVtYmVyLChzdGFydGR0cyAtIHRoaXMuaW5pdER0cykqOTAsdGhpcy50cmFjayk7XG4gICAgLy8gaXQgd291bGQgYmUgZ3JlYXQgdG8gYWxsb2NhdGUgdGhpcyBhcnJheSB1cCBmcm9udCBpbnN0ZWFkIG9mXG4gICAgLy8gdGhyb3dpbmcgYXdheSBodW5kcmVkcyBvZiBtZWRpYSBzZWdtZW50IGZyYWdtZW50c1xuICAgIGJveGVzID0gbmV3IFVpbnQ4QXJyYXkobW9vZi5ieXRlTGVuZ3RoICsgbWRhdC5ieXRlTGVuZ3RoKTtcblxuICAgIC8vIGJ1bXAgdGhlIHNlcXVlbmNlIG51bWJlciBmb3IgbmV4dCB0aW1lXG4gICAgdGhpcy5zZXF1ZW5jZU51bWJlcisrO1xuXG4gICAgYm94ZXMuc2V0KG1vb2YpO1xuICAgIGJveGVzLnNldChtZGF0LCBtb29mLmJ5dGVMZW5ndGgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgYm94ZXMpO1xuICB9XG59XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIHNpbmdsZS10cmFjaywgSVNPIEJNRkYgbWVkaWEgc2VnbWVudCBmcm9tIEFBQyBkYXRhXG4gKiBldmVudHMuIFRoZSBvdXRwdXQgb2YgdGhpcyBzdHJlYW0gY2FuIGJlIGZlZCB0byBhIFNvdXJjZUJ1ZmZlclxuICogY29uZmlndXJlZCB3aXRoIGEgc3VpdGFibGUgaW5pdGlhbGl6YXRpb24gc2VnbWVudC5cbiAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSB0cmFjayBtZXRhZGF0YSBjb25maWd1cmF0aW9uXG4gKi9cbmNsYXNzIEF1ZGlvU2VnbWVudFN0cmVhbSBleHRlbmRzIFN0cmVhbSB7XG5cbiAgY29uc3RydWN0b3IodHJhY2spIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc2VxdWVuY2VOdW1iZXIgPSAwO1xuICAgIHRoaXMuYWFjVW5pdHMgPSBbXTtcbiAgICB0aGlzLmFhY1VuaXRzTGVuZ3RoID0gMDtcbiAgICB0aGlzLnRyYWNrID0gdHJhY2s7XG4gIH1cblxuICBwdXNoKGRhdGEpIHtcbiAgICAvL3JlbW92ZSBBRFRTIGhlYWRlclxuICAgIGRhdGEuZGF0YSA9IGRhdGEuZGF0YS5zdWJhcnJheSg3KTtcbiAgICAvLyBidWZmZXIgYXVkaW8gdW50aWwgZW5kKCkgaXMgY2FsbGVkXG4gICAgdGhpcy5hYWNVbml0cy5wdXNoKGRhdGEpO1xuICAgIHRoaXMuYWFjVW5pdHNMZW5ndGggKz0gZGF0YS5kYXRhLmJ5dGVMZW5ndGg7XG4gIH1cblxuICBlbmQoKSB7XG4gICAgdmFyIGRhdGEsIHZpZXcsIGksIGN1cnJlbnRVbml0LCBzdGFydFVuaXREdHMsIGxhc3RVbml0LCBtZGF0LCBtb29mLCBib3hlcztcbiAgICAvLyAvLyBjb25jYXRlbmF0ZSB0aGUgYXVkaW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0XG4gICAgLy8gLy8gZmlyc3QsIHdlIGhhdmUgdG8gYnVpbGQgdGhlIGluZGV4IGZyb20gYnl0ZSBsb2NhdGlvbnMgdG9cbiAgICAvLyAvLyBzYW1wbGVzICh0aGF0IGlzLCBmcmFtZXMpIGluIHRoZSBhdWRpbyBkYXRhXG4gICAgZGF0YSA9IG5ldyBVaW50OEFycmF5KHRoaXMuYWFjVW5pdHNMZW5ndGgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcoZGF0YS5idWZmZXIpO1xuICAgIHRoaXMudHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHZhciBzYW1wbGUgPSB7XG4gICAgICBzaXplOiB0aGlzLmFhY1VuaXRzWzBdLmRhdGEuYnl0ZUxlbmd0aCxcbiAgICAgIGZsYWdzOiB7XG4gICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDBcbiAgICAgIH0sXG4gICAgICBjb21wb3NpdGlvblRpbWVPZmZzZXQ6IDBcbiAgICB9O1xuICAgIGkgPSAwO1xuICAgIHN0YXJ0VW5pdER0cyA9IHRoaXMuYWFjVW5pdHNbMF0uZHRzO1xuICAgIGlmKHRoaXMuaW5pdER0cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmluaXREdHMgPSBzdGFydFVuaXREdHM7XG4gICAgfVxuICAgIGxhc3RVbml0ID0gbnVsbDtcbiAgICB3aGlsZSAodGhpcy5hYWNVbml0cy5sZW5ndGgpIHtcbiAgICAgIGN1cnJlbnRVbml0ID0gdGhpcy5hYWNVbml0c1swXTtcbiAgICAgIGlmKGxhc3RVbml0ICE9IG51bGwpIHtcbiAgICAgICAgLy9mbHVzaCBwcmV2aW91cyBzYW1wbGUsIHVwZGF0ZSBpdHMgZHVyYXRpb24gYmVmb3JlaGFuZFxuICAgICAgICAgIHNhbXBsZS5kdXJhdGlvbiA9IChjdXJyZW50VW5pdC5kdHMgLSBsYXN0VW5pdC5kdHMpICogOTA7XG4gICAgICAgICAgdGhpcy50cmFjay5zYW1wbGVzLnB1c2goc2FtcGxlKTtcbiAgICAgICAgICBzYW1wbGUgPSB7XG4gICAgICAgICAgICBzaXplOiBjdXJyZW50VW5pdC5kYXRhLmJ5dGVMZW5ndGgsXG4gICAgICAgICAgICBmbGFnczoge1xuICAgICAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgICAgIGRlcGVuZHNPbjogMSxcbiAgICAgICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiAwXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICAvL3ZpZXcuc2V0VWludDMyKGksIGN1cnJlbnRVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIC8vaSArPSA0O1xuICAgICAgICBkYXRhLnNldChjdXJyZW50VW5pdC5kYXRhLCBpKTtcbiAgICAgICAgaSArPSBjdXJyZW50VW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIHRoaXMuYWFjVW5pdHMuc2hpZnQoKTtcbiAgICAgICAgbGFzdFVuaXQgPSBjdXJyZW50VW5pdDtcbiAgICB9XG4gICAgLy8gcmVjb3JkIHRoZSBsYXN0IHNhbXBsZVxuICAgIGlmICh0aGlzLnRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBzYW1wbGUuZHVyYXRpb24gPSB0aGlzLnRyYWNrLnNhbXBsZXNbdGhpcy50cmFjay5zYW1wbGVzLmxlbmd0aCAtIDFdLmR1cmF0aW9uO1xuICAgICAgdGhpcy50cmFjay5zYW1wbGVzLnB1c2goc2FtcGxlKTtcbiAgICB9XG4gICAgdGhpcy5hYWNVbml0c0xlbmd0aCA9IDA7XG4gICAgbWRhdCA9IE1QNC5tZGF0KGRhdGEpO1xuICAgIG1vb2YgPSBNUDQubW9vZih0aGlzLnNlcXVlbmNlTnVtYmVyLChzdGFydFVuaXREdHMgLSB0aGlzLmluaXREdHMpKjkwLHRoaXMudHJhY2spO1xuICAgIC8vIGl0IHdvdWxkIGJlIGdyZWF0IHRvIGFsbG9jYXRlIHRoaXMgYXJyYXkgdXAgZnJvbnQgaW5zdGVhZCBvZlxuICAgIC8vIHRocm93aW5nIGF3YXkgaHVuZHJlZHMgb2YgbWVkaWEgc2VnbWVudCBmcmFnbWVudHNcbiAgICBib3hlcyA9IG5ldyBVaW50OEFycmF5KG1vb2YuYnl0ZUxlbmd0aCArIG1kYXQuYnl0ZUxlbmd0aCk7XG5cbiAgICAvLyBidW1wIHRoZSBzZXF1ZW5jZSBudW1iZXIgZm9yIG5leHQgdGltZVxuICAgIHRoaXMuc2VxdWVuY2VOdW1iZXIrKztcbiAgICBib3hlcy5zZXQobW9vZik7XG4gICAgYm94ZXMuc2V0KG1kYXQsIG1vb2YuYnl0ZUxlbmd0aCk7XG5cbiAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCBib3hlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBBIFN0cmVhbSB0aGF0IGV4cGVjdHMgTVAyVCBiaW5hcnkgZGF0YSBhcyBpbnB1dCBhbmQgcHJvZHVjZXNcbiAqIGNvcnJlc3BvbmRpbmcgbWVkaWEgc2VnbWVudHMsIHN1aXRhYmxlIGZvciB1c2Ugd2l0aCBNZWRpYSBTb3VyY2VcbiAqIEV4dGVuc2lvbiAoTVNFKSBpbXBsZW1lbnRhdGlvbnMgdGhhdCBzdXBwb3J0IHRoZSBJU08gQk1GRiBieXRlXG4gKiBzdHJlYW0gZm9ybWF0LCBsaWtlIENocm9tZS5cbiAqIEBzZWUgdGVzdC9tdXhlci9tc2UtZGVtby5odG1sIGZvciBzYW1wbGUgdXNhZ2Ugb2YgYSBUcmFuc211eGVyIHdpdGhcbiAqIE1TRVxuICovXG5cblxudmFyIHBhY2tldFN0cmVhbSxwYXJzZVN0cmVhbSwgZWxlbWVudGFyeVN0cmVhbSwgYWFjU3RyZWFtLCBoMjY0U3RyZWFtLFxuICAgIGF1ZGlvU2VnbWVudFN0cmVhbSwgdmlkZW9TZWdtZW50U3RyZWFtLFxuICAgIGNvbmZpZ0F1ZGlvLCBjb25maWdWaWRlbyxcbiAgICB0cmFja1ZpZGVvLCB0cmFja0F1ZGlvLF9kdXJhdGlvbixcbiAgICBwcHM7XG5cbmNsYXNzIFRTRGVtdXhlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gc2V0IHVwIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gICAgcGFja2V0U3RyZWFtID0gbmV3IFRyYW5zcG9ydFBhY2tldFN0cmVhbSgpO1xuICAgIHBhcnNlU3RyZWFtID0gbmV3IFRyYW5zcG9ydFBhcnNlU3RyZWFtKCk7XG4gICAgZWxlbWVudGFyeVN0cmVhbSA9IG5ldyBFbGVtZW50YXJ5U3RyZWFtKCk7XG4gICAgYWFjU3RyZWFtID0gbmV3IEFhY1N0cmVhbSgpO1xuICAgIGgyNjRTdHJlYW0gPSBuZXcgSDI2NFN0cmVhbSgpO1xuXG4gICAgcGFja2V0U3RyZWFtLnBpcGUocGFyc2VTdHJlYW0pO1xuICAgIHBhcnNlU3RyZWFtLnBpcGUoZWxlbWVudGFyeVN0cmVhbSk7XG4gICAgZWxlbWVudGFyeVN0cmVhbS5waXBlKGFhY1N0cmVhbSk7XG4gICAgZWxlbWVudGFyeVN0cmVhbS5waXBlKGgyNjRTdHJlYW0pO1xuXG4gICAgLy8gaGFuZGxlIGluY29taW5nIGRhdGEgZXZlbnRzXG4gICAgYWFjU3RyZWFtLm9uKCdkYXRhJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgaWYoIWNvbmZpZ0F1ZGlvKSB7XG4gICAgICAgIHRyYWNrQXVkaW8uY29uZmlnID0gY29uZmlnQXVkaW8gPSBkYXRhLmNvbmZpZztcbiAgICAgICAgdHJhY2tBdWRpby5hdWRpb3NhbXBsZXJhdGUgPSBkYXRhLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgICAgdHJhY2tBdWRpby5kdXJhdGlvbiA9IDkwMDAwKl9kdXJhdGlvbjtcbiAgICAgICAgLy8gaW1wbGljaXQgU0JSIHNpZ25hbGxpbmcgKEhFLUFBQykgOiBpZiBzYW1wbGluZyByYXRlIGxlc3MgdGhhbiAyNGtIelxuICAgICAgICB2YXIgY29kZWMgPSAoZGF0YS5hdWRpb3NhbXBsZXJhdGUgPD0gMjQwMDApID8gNSA6ICgoY29uZmlnQXVkaW9bMF0gJiAweEY4KSA+PiAzKTtcbiAgICAgICAgdHJhY2tBdWRpby5jb2RlYyA9ICdtcDRhLjQwLicgKyBjb2RlYztcbiAgICAgICAgY29uc29sZS5sb2codHJhY2tBdWRpby5jb2RlYyk7XG4gICAgICAgIGlmIChjb25maWdWaWRlbykge1xuICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5JTklUX1NFR01FTlQse1xuICAgICAgICAgICAgZGF0YTogTVA0LmluaXRTZWdtZW50KFt0cmFja1ZpZGVvLHRyYWNrQXVkaW9dKSxcbiAgICAgICAgICAgIGNvZGVjIDogdHJhY2tWaWRlby5jb2RlYyArICcsJyArIHRyYWNrQXVkaW8uY29kZWNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaDI2NFN0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIC8vIHJlY29yZCB0aGUgdHJhY2sgY29uZmlnXG4gICAgICBpZiAoZGF0YS5uYWxVbml0VHlwZSA9PT0gJ1NQUycgJiYgIWNvbmZpZ1ZpZGVvKSB7XG4gICAgICAgIGNvbmZpZ1ZpZGVvID0gZGF0YS5jb25maWc7XG4gICAgICAgIHRyYWNrVmlkZW8ud2lkdGggPSBjb25maWdWaWRlby53aWR0aDtcbiAgICAgICAgdHJhY2tWaWRlby5oZWlnaHQgPSBjb25maWdWaWRlby5oZWlnaHQ7XG4gICAgICAgIHRyYWNrVmlkZW8uc3BzID0gW2RhdGEuZGF0YV07XG4gICAgICAgIHZhciBjb2RlY2FycmF5ID0gZGF0YS5kYXRhLnN1YmFycmF5KDEsNCk7XG4gICAgICAgIHZhciBjb2RlY3N0cmluZyAgPSAnYXZjMS4nO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgaCA9IGNvZGVjYXJyYXlbaV0udG9TdHJpbmcoMTYpO1xuICAgICAgICAgICAgaWYgKGgubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgIGggPSAnMCcgKyBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29kZWNzdHJpbmcgKz0gaDtcbiAgICAgICAgfVxuICAgICAgICB0cmFja1ZpZGVvLmNvZGVjID0gY29kZWNzdHJpbmc7XG4gICAgICAgIGNvbnNvbGUubG9nKHRyYWNrVmlkZW8uY29kZWMpO1xuICAgICAgICB0cmFja1ZpZGVvLmR1cmF0aW9uID0gOTAwMDAqX2R1cmF0aW9uO1xuICAgICAgfVxuICAgICAgaWYgKGRhdGEubmFsVW5pdFR5cGUgPT09ICdQUFMnICYmICFwcHMpIHtcbiAgICAgICAgICBwcHMgPSBkYXRhLmRhdGE7XG4gICAgICAgICAgdHJhY2tWaWRlby5wcHMgPSBbZGF0YS5kYXRhXTtcblxuICAgICAgICAgIGlmIChjb25maWdWaWRlbykge1xuICAgICAgICAgICAgaWYoYXVkaW9TZWdtZW50U3RyZWFtKSB7XG4gICAgICAgICAgICAgIGlmKGNvbmZpZ0F1ZGlvKSB7XG4gICAgICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5JTklUX1NFR01FTlQse1xuICAgICAgICAgICAgICAgICAgZGF0YTogTVA0LmluaXRTZWdtZW50KFt0cmFja1ZpZGVvLHRyYWNrQXVkaW9dKSxcbiAgICAgICAgICAgICAgICAgIGNvZGVjIDogdHJhY2tWaWRlby5jb2RlYyArICcsJyArIHRyYWNrQXVkaW8uY29kZWNcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5JTklUX1NFR01FTlQse1xuICAgICAgICAgICAgICAgIGRhdGE6IE1QNC5pbml0U2VnbWVudChbdHJhY2tWaWRlb10pLFxuICAgICAgICAgICAgICAgIGNvZGVjIDogdHJhY2tWaWRlby5jb2RlY1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIC8vIGhvb2sgdXAgdGhlIHZpZGVvIHNlZ21lbnQgc3RyZWFtIG9uY2UgdHJhY2sgbWV0YWRhdGEgaXMgZGVsaXZlcmVkXG4gICAgZWxlbWVudGFyeVN0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBpLCB0cmlnZ2VyRGF0YSA9IGZ1bmN0aW9uKHNlZ21lbnQpIHtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHTUVOVF9QQVJTRUQse1xuICAgICAgICAgIGRhdGE6IHNlZ21lbnRcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaWYgKGRhdGEudHlwZSA9PT0gJ21ldGFkYXRhJykge1xuICAgICAgICBpID0gZGF0YS50cmFja3MubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgaWYgKGRhdGEudHJhY2tzW2ldLnR5cGUgPT09ICd2aWRlbycpIHtcbiAgICAgICAgICAgIHRyYWNrVmlkZW8gPSBkYXRhLnRyYWNrc1tpXTtcbiAgICAgICAgICAgIGlmICghdmlkZW9TZWdtZW50U3RyZWFtKSB7XG4gICAgICAgICAgICAgIHZpZGVvU2VnbWVudFN0cmVhbSA9IG5ldyBWaWRlb1NlZ21lbnRTdHJlYW0odHJhY2tWaWRlbyk7XG4gICAgICAgICAgICAgIGgyNjRTdHJlYW0ucGlwZSh2aWRlb1NlZ21lbnRTdHJlYW0pO1xuICAgICAgICAgICAgICB2aWRlb1NlZ21lbnRTdHJlYW0ub24oJ2RhdGEnLCB0cmlnZ2VyRGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChkYXRhLnRyYWNrc1tpXS50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICAgICAgICAgIHRyYWNrQXVkaW8gPSBkYXRhLnRyYWNrc1tpXTtcbiAgICAgICAgICAgICAgaWYgKCFhdWRpb1NlZ21lbnRTdHJlYW0pIHtcbiAgICAgICAgICAgICAgICBhdWRpb1NlZ21lbnRTdHJlYW0gPSBuZXcgQXVkaW9TZWdtZW50U3RyZWFtKHRyYWNrQXVkaW8pO1xuICAgICAgICAgICAgICAgIGFhY1N0cmVhbS5waXBlKGF1ZGlvU2VnbWVudFN0cmVhbSk7XG4gICAgICAgICAgICAgICAgYXVkaW9TZWdtZW50U3RyZWFtLm9uKCdkYXRhJywgdHJpZ2dlckRhdGEpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzZXQgZHVyYXRpb24oZHVyYXRpb24pIHtcbiAgICBfZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgfVxuXG4gIGdldCBkdXJhdGlvbigpIHtcbiAgICByZXR1cm4gX2R1cmF0aW9uO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEpIHtcbiAgICBwYWNrZXRTdHJlYW0ucHVzaChkYXRhKTtcbiAgfVxuICAvLyBmbHVzaCBhbnkgYnVmZmVyZWQgZGF0YVxuICBlbmQoKSB7XG4gICAgZWxlbWVudGFyeVN0cmVhbS5lbmQoKTtcbiAgICBoMjY0U3RyZWFtLmVuZCgpO1xuICAgIGlmKHZpZGVvU2VnbWVudFN0cmVhbSkge1xuICAgICAgdmlkZW9TZWdtZW50U3RyZWFtLmVuZCgpO1xuICAgIH1cbiAgICBpZihhdWRpb1NlZ21lbnRTdHJlYW0pIHtcbiAgICAgIGF1ZGlvU2VnbWVudFN0cmVhbS5lbmQoKTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGF1ZGlvU2VnbWVudFN0cmVhbSA9IHZpZGVvU2VnbWVudFN0cmVhbSA9IG51bGw7XG4gICAgY29uZmlnQXVkaW8gPSBjb25maWdWaWRlbyA9IHRyYWNrVmlkZW8gPSB0cmFja0F1ZGlvID0gcHBzID0gbnVsbDtcbiAgICBfZHVyYXRpb24gPSAwO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFtZXdvcmsgcmVhZHkgZXZlbnQsIHRyaWdnZXJlZCB3aGVuIHJlYWR5IHRvIHNldCBEYXRhU291cmNlXG4gIEZSQU1FV09SS19SRUFEWSA6ICdobHNGcmFtZXdvcmtSZWFkeScsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZGluZyBldmVudCwgdHJpZ2dlcmVkIGFmdGVyIGEgY2FsbCB0byBobHMuYXR0YWNoU291cmNlKHVybClcbiAgTUFOSUZFU1RfTE9BRElORyA6ICdobHNNYW5pZmVzdExvYWRpbmcnLFxuICAvL0lkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCB3aGVuIHRoaXMgZXZlbnQgaXMgcmVjZWl2ZWQsIG1haW4gbWFuaWZlc3QgYW5kIHN0YXJ0IGxldmVsIGhhcyBiZWVuIHJldHJpZXZlZFxuICBNQU5JRkVTVF9MT0FERUQgIDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBsb2FkaW5nIGV2ZW50XG4gIExFVkVMX0xPQURJTkcgICAgOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBsb2FkZWQgZXZlbnRcbiAgTEVWRUxfTE9BREVEIDogICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGV2ZW50XG4gIExFVkVMX1NXSVRDSCA6ICAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIEVORExJU1QgZXZlbnRcbiAgTEVWRUxfRU5ETElTVCA6ICAnaGxzTGV2ZWxFbmRMaXN0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBsb2FkaW5nIGV2ZW50XG4gIEZSQUdNRU5UX0xPQURJTkcgOiAgJ2hsc0ZyYWdtZW50TG9hZGluZycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgbG9hZGVkIGV2ZW50XG4gIEZSQUdNRU5UX0xPQURFRCA6ICAnaGxzRnJhZ21lbnRMb2FkZWQnLFxuICAvLyBJZGVudGlmaWVyIHdoZW4gbGFzdCBmcmFnbWVudCBvZiBwbGF5bGlzdCBoYXMgYmVlbiBsb2FkZWRcbiAgTEFTVF9GUkFHTUVOVF9MT0FERUQgOiAgJ2hsc0xhc3RGcmFnbWVudExvYWRlZCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2VkIGV2ZW50XG4gIEZSQUdNRU5UX1BBUlNFRCA6ICAnaGxzRnJhZ21lbnRQYXJzZWQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbiBpbml0IHNlZ21lbnQgZXZlbnRcbiAgSU5JVF9TRUdNRU5UIDogICdobHNJbml0U2VnbWVudCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbG9hZCBlcnJvciBldmVudFxuICBMT0FEX0VSUk9SIDogICdobHNMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIHN3aXRjaCBlcnJvclxuICBMRVZFTF9FUlJPUiA6ICAnaGxzTGV2ZWxFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgdmlkZW8gZXJyb3IgZXZlbnRcbiAgVklERU9fRVJST1IgOiAgJ2hsc1ZpZGVvRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIHBsYXliYWNrIG1lZGlhIHRpbWUgY2hhbmdlIGV2ZW50XG4gIE1FRElBX1RJTUUgOiAgJ2hsc01lZGlhVGltZScsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgcGxheWJhY2sgc3RhdGUgc3dpdGNoIGV2ZW50XG4gIFBMQVlCQUNLX1NUQVRFIDogICdobHNQbGF5YmFja1N0YXRlJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBzZWVrIHN0YXRlIHN3aXRjaCBldmVudFxuICBTRUVLX1NUQVRFIDogICdobHNTZWVrU3RhdGUnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIHBsYXliYWNrIGNvbXBsZXRlIGV2ZW50XG4gIFBMQVlCQUNLX0NPTVBMRVRFIDogICdobHNQbGF5QmFja0NvbXBsZXRlJ1xufTtcbiIsIi8qKlxuICogSExTIGVuZ2luZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi9vYnNlcnZlcic7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgICAgICAgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBCdWZmZXJDb250cm9sbGVyICAgICBmcm9tICcuL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsZW5hYmxlTG9nc30gIGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbi8vaW1wb3J0IE1QNEluc3BlY3QgICAgICAgICBmcm9tICcvcmVtdXgvbXA0LWluc3BlY3Rvcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0OyBjb2RlY3M9XCJhdmMxLjQyRTAxRSxtcDRhLjQwLjJcIicpKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHZpZGVvKSB7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcigpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBCdWZmZXJDb250cm9sbGVyKHZpZGVvKTtcbiAgICB0aGlzLkV2ZW50cyA9IEV2ZW50O1xuICAgIHRoaXMuZGVidWcgPSBlbmFibGVMb2dzO1xuICAgIHRoaXMubG9nRXZ0ID0gdGhpcy5sb2dFdnQ7XG4gICAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgICB0aGlzLm9uID0gb2JzZXJ2ZXIub24uYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5vZmYgPSBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lci5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLmF0dGFjaFZpZXcodmlkZW8pO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLnBsYXlsaXN0TG9hZGVyKSB7XG4gICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMucGxheWxpc3RMb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBpZih0aGlzLmJ1ZmZlckNvbnRyb2xsZXIpIHtcbiAgICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmRldGFjaFNvdXJjZSgpO1xuICAgIHRoaXMuZGV0YWNoVmlldygpO1xuICAgIG9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoVmlldyh2aWRlbykge1xuICAgIHRoaXMudmlkZW8gPSB2aWRlbztcbiAgICB0aGlzLm9udmVycm9yID0gdGhpcy5vblZpZGVvRXJyb3IuYmluZCh0aGlzKTtcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgdmlkZW8uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gICAgLy8gbGlzdGVuIHRvIGFsbCB2aWRlbyBldmVudHNcbiAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbihldnQpIHsgdGhpcy5sb2dFdnQoZXZ0KTsgfS5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252ZSA9IGxpc3RlbmVyO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRzdGFydCcsICAgICAgIGxpc3RlbmVyKTtcbiAgICAvL3ZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdzdXNwZW5kJywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAgICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgICAgICAgICAgIHRoaXMub252ZXJyb3IpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2VtcHRpZWQnLCAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdzdGFsbGVkJywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZGRhdGEnLCAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdjYW5wbGF5JywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignY2FucGxheXRocm91Z2gnLCAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3BsYXlpbmcnLCAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCd3YWl0aW5nJywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3NlZWtlZCcsICAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdkdXJhdGlvbmNoYW5nZScsICBsaXN0ZW5lcik7XG4gICAgLy92aWRlby5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigncGxheScsICAgICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3BhdXNlJywgICAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdyYXRlY2hhbmdlJywgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3ZvbHVtZWNoYW5nZScsICAgIGxpc3RlbmVyKTtcbiAgfVxuXG4gIGRldGFjaFZpZXcoKSB7XG4gICAgdmFyIHZpZGVvID0gdGhpcy52aWRlbztcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgIGlmKG1zKSB7XG4gICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLm9ubXNvID0gdGhpcy5vbm1zZSA9IHRoaXMub25tc2MgPSBudWxsO1xuICAgIHZhciBsaXN0ZW5lciA9IHRoaXMub252ZTtcbiAgICB0aGlzLm9udmUgPSBudWxsO1xuICAgIGlmKHZpZGVvKSB7XG4gICAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICAgIC8vIHJlbW92ZSBhbGwgdmlkZW8gbGlzdGVuZXJzXG4gICAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2Fkc3RhcnQnLCAgICAgICBsaXN0ZW5lcik7XG4gICAgICAvL3ZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgICAgICAgIGxpc3RlbmVyKTtcbiAgICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3N1c3BlbmQnLCAgICAgICAgIGxpc3RlbmVyKTtcbiAgICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgICAgICAgICAgIGxpc3RlbmVyKTtcbiAgICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgICAgICAgICAgIHRoaXMub252ZXJyb3IpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZW1wdGllZCcsICAgICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc3RhbGxlZCcsICAgICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkZGF0YScsICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2FucGxheScsICAgICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2FucGxheXRocm91Z2gnLCAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigncGxheWluZycsICAgICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2FpdGluZycsICAgICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsICAgICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgICAgICAgICAgbGlzdGVuZXIpO1xuICAgICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHVyYXRpb25jaGFuZ2UnLCAgbGlzdGVuZXIpO1xuICAgICAgLy92aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgICAgICBsaXN0ZW5lcik7XG4gICAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdwbGF5JywgICAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdwYXVzZScsICAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdyYXRlY2hhbmdlJywgICAgICBsaXN0ZW5lcik7XG4gICAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdyZXNpemUnLCAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCd2b2x1bWVjaGFuZ2UnLCAgICBsaXN0ZW5lcik7XG4gICAgICB0aGlzLm9udmVycm9yID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhdHRhY2hTb3VyY2UodXJsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgbG9nZ2VyLmxvZygnYXR0YWNoU291cmNlOicrdXJsKTtcbiAgICAvLyBpbnRlcm5hbCBsaXN0ZW5lciBzZXR1cFxuICAgIC8vIGludGVybmFsIGxpc3RlbmVyc1xuICAgIHRoaXMub25tbCA9IHRoaXMub25NYW5pZmVzdExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHVybCk7XG4gIH1cblxuICBkZXRhY2hTb3VyY2UoKSB7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIC8vIGludGVybmFsIGxpc3RlbmVyIGNsZWFudXBcbiAgICBpZih0aGlzLm9ubWwpIHtcbiAgICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICAgIHRoaXMub25tbCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gbnVsbDtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkZWQoZXZlbnQsZGF0YSkge1xuICAgIHRoaXMubGV2ZWxzID0gZGF0YS5sZXZlbHM7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBsb2dnZXIubG9nKCdtYW5pZmVzdCBsb2FkZWQsUlRUKG1zKS9sb2FkKG1zKTonICsgKHN0YXRzLnRmaXJzdCAtIHN0YXRzLnRyZXF1ZXN0KSsgJy8nICsgKHN0YXRzLnRlbmQgLSBzdGF0cy50cmVxdWVzdCkpO1xuICAgIGlmKHRoaXMubGV2ZWxzLmxlbmd0aCA+IDEgfHwgdGhpcy5sZXZlbHNbMF0uZnJhZ21lbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIHNldCBsZXZlbCwgaXQgd2lsbCB0cmlnZ2VyIGEgcGxheWxpc3QgbG9hZGluZyByZXF1ZXN0XG4gICAgICB0aGlzLnBsYXlsaXN0TG9hZGVyLmxldmVsID0gdGhpcy5sZXZlbHMubGVuZ3RoLTE7XG4gICAgfVxuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5zdGFydCh0aGlzLmxldmVscywgdGhpcy5tZWRpYVNvdXJjZSk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlT3BlbigpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQU1FV09SS19SRUFEWSk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlQ2xvc2UoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGNsb3NlZCcpO1xuICB9XG5cbiAgb25NZWRpYVNvdXJjZUVuZGVkKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBlbmRlZCcpO1xuICB9XG5cbiAgb25WaWRlb0Vycm9yKCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuVklERU9fRVJST1IpO1xuICB9XG5cbiAgbG9nRXZ0KGV2dCkge1xuICAgIHZhciBkYXRhID0gJyc7XG4gICAgc3dpdGNoKGV2dC50eXBlKSB7XG4gICAgICBjYXNlICdkdXJhdGlvbmNoYW5nZSc6XG4gICAgICAgIGRhdGEgPSBldmVudC50YXJnZXQuZHVyYXRpb247XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncmVzaXplJzpcbiAgICAgICAgZGF0YSA9ICd2aWRlb1dpZHRoOicgKyBldnQudGFyZ2V0LnZpZGVvV2lkdGggKyAnL3ZpZGVvSGVpZ2h0OicgKyBldnQudGFyZ2V0LnZpZGVvSGVpZ2h0O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2xvYWRlZG1ldGFkYXRhJzpcbiAgICAgICAgZGF0YSA9ICdkdXJhdGlvbjonICsgZXZ0LnRhcmdldC5kdXJhdGlvbiArICcvdmlkZW9XaWR0aDonICsgZXZ0LnRhcmdldC52aWRlb1dpZHRoICsgJy92aWRlb0hlaWdodDonICsgZXZ0LnRhcmdldC52aWRlb0hlaWdodDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdsb2FkZWRkYXRhJzpcbiAgICAgIGNhc2UgJ2NhbnBsYXknOlxuICAgICAgY2FzZSAnY2FucGxheXRocm91Z2gnOlxuICAgICAgY2FzZSAndGltZXVwZGF0ZSc6XG4gICAgICBjYXNlICdzZWVraW5nJzpcbiAgICAgIGNhc2UgJ3NlZWtlZCc6XG4gICAgICBjYXNlICdwYXVzZSc6XG4gICAgICBjYXNlICdwbGF5JzpcbiAgICAgIGNhc2UgJ3N0YWxsZWQnOlxuICAgICAgICBkYXRhID0gJ2N1cnJlbnRUaW1lOicgKyBldnQudGFyZ2V0LmN1cnJlbnRUaW1lO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIGNhc2UgJ3Byb2dyZXNzJzpcbiAgICAgIC8vICAgZGF0YSA9ICdjdXJyZW50VGltZTonICsgZXZ0LnRhcmdldC5jdXJyZW50VGltZSArICcsYnVmZmVyUmFuZ2U6WycgKyB0aGlzLnZpZGVvLmJ1ZmZlcmVkLnN0YXJ0KDApICsgJywnICsgdGhpcy52aWRlby5idWZmZXJlZC5lbmQoMCkgKyAnXSc7XG4gICAgICAvLyAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBsb2dnZXIubG9nKGV2dC50eXBlICsgJzonICsgZGF0YSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSGxzO1xuIiwiIC8qXG4gKiBmcmFnbWVudCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBGcmFnbWVudExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmKHRoaXMueGhyICYmdGhpcy54aHIucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgdGhpcy54aHIuYWJvcnQoKTtcbiAgICAgIHRoaXMueGhyID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBsb2FkKHVybCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMudHJlcXVlc3QgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudGZpcnN0ID0gbnVsbDtcbiAgICB2YXIgeGhyID0gdGhpcy54aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkPSAgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vbmVycm9yID0gdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHVybCAsIHRydWUpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHhoci5zZW5kKCk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHTUVOVF9MT0FESU5HLCB7IHVybDogdGhpcy51cmx9KTtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHTUVOVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgIHsgcGF5bG9hZCA6IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2UsXG4gICAgICAgICAgICAgICAgICAgICAgdXJsIDogdGhpcy51cmwgLFxuICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDoge3RyZXF1ZXN0IDogdGhpcy50cmVxdWVzdCwgdGZpcnN0IDogdGhpcy50Zmlyc3QsIHRlbmQgOiBEYXRlLm5vdygpLCBsZW5ndGggOmV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2UuYnl0ZUxlbmd0aCB9fSk7XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBsb2dnZXIubG9nKCdlcnJvciBsb2FkaW5nICcgKyB0aGlzLnVybCk7XG4gICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHRoaXMudXJsLCBldmVudDpldmVudH0pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuICAgIGlmKHRoaXMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICB0aGlzLnRmaXJzdCA9IERhdGUubm93KCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIHBsYXlsaXN0IGxvYWRlclxuICpcbiAqL1xuXG5pbXBvcnQgRXZlbnQgICAgICAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBvYnNlcnZlciAgICAgICAgICAgICBmcm9tICcuLi9vYnNlcnZlcic7XG5pbXBvcnQge2xvZ2dlcn0gICAgICAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuIGNsYXNzIFBsYXlsaXN0TG9hZGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmxldmVscyA9IFtdO1xuICAgIHRoaXMuX2xldmVsID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLnhociAmJnRoaXMueGhyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMueGhyLmFib3J0KCk7XG4gICAgICB0aGlzLnhociA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubGV2ZWxzID0gW107XG4gICAgdGhpcy5fbGV2ZWwgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBsb2FkKHVybCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywgeyB1cmw6IHRoaXMudXJsfSk7XG4gICAgdGhpcy5fbG9hZCh1cmwpO1xuICB9XG5cbiAgX2xvYWQodXJsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy5zdGF0cyA9IHsgdHJlcXVlc3QgOiBEYXRlLm5vdygpfTtcbiAgICB2YXIgeGhyID0gdGhpcy54aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkPSAgdGhpcy5sb2Fkc3VjY2Vzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vbmVycm9yID0gdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKTtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyk7XG4gICAgeGhyLm9wZW4oJ0dFVCcsIHVybCwgdHJ1ZSk7XG4gICAgeGhyLnNlbmQoKTtcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZih0aGlzLl9sZXZlbCAhPT0gbmV3TGV2ZWwpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgICAgaWYobmV3TGV2ZWwgPj0gMCAmJiBuZXdMZXZlbCA8IHRoaXMubGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgICAgLy8gY2hlY2sgaWYgd2UgbmVlZCB0byBsb2FkIHBsYXlsaXN0IGZvciB0aGlzIG5ldyBsZXZlbFxuICAgICAgICBpZih0aGlzLmxldmVsc1tuZXdMZXZlbF0uZnJhZ21lbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBsZXZlbCBub3QgcmV0cmlldmVkIHlldCwgd2UgbmVlZCB0byBsb2FkIGl0XG4gICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FESU5HLCB7IGxldmVsIDogbmV3TGV2ZWx9KTtcbiAgICAgICAgICB0aGlzLl9sb2FkKHRoaXMubGV2ZWxzW25ld0xldmVsXS51cmwpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpbnZhbGlkIGxldmVsIGlkIGdpdmVuLCB0cmlnZ2VyIGVycm9yXG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfRVJST1IsIHsgbGV2ZWwgOiBuZXdMZXZlbCwgZXZlbnQ6ICdpbnZhbGlkIGxldmVsIGlkeCd9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHZhciBkb2MgICAgICA9IGRvY3VtZW50LFxuICAgICAgICBvbGRCYXNlID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdiYXNlJylbMF0sXG4gICAgICAgIG9sZEhyZWYgPSBvbGRCYXNlICYmIG9sZEJhc2UuaHJlZixcbiAgICAgICAgZG9jSGVhZCA9IGRvYy5oZWFkIHx8IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdLFxuICAgICAgICBvdXJCYXNlID0gb2xkQmFzZSB8fCBkb2NIZWFkLmFwcGVuZENoaWxkKGRvYy5jcmVhdGVFbGVtZW50KCdiYXNlJykpLFxuICAgICAgICByZXNvbHZlciA9IGRvYy5jcmVhdGVFbGVtZW50KCdhJyksXG4gICAgICAgIHJlc29sdmVkVXJsO1xuXG4gICAgb3VyQmFzZS5ocmVmID0gYmFzZVVybDtcbiAgICByZXNvbHZlci5ocmVmID0gdXJsO1xuICAgIHJlc29sdmVkVXJsICA9IHJlc29sdmVyLmhyZWY7IC8vIGJyb3dzZXIgbWFnaWMgYXQgd29yayBoZXJlXG5cbiAgICBpZiAob2xkQmFzZSkge29sZEJhc2UuaHJlZiA9IG9sZEhyZWY7fVxuICAgIGVsc2Uge2RvY0hlYWQucmVtb3ZlQ2hpbGQob3VyQmFzZSk7fVxuICAgIHJldHVybiByZXNvbHZlZFVybDtcbiAgfVxuXG5cblxuICBwYXJzZU1hbmlmZXN0KHN0cmluZywgdXJsKSB7XG4gICAgaWYoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0LCBjcmVhdGUgdW5pcXVlIGxldmVsIGFuZCBwYXJzZSBwbGF5bGlzdFxuICAgICAgICB0aGlzLl9sZXZlbCA9IDA7XG4gICAgICAgIHRoaXMubGV2ZWxzLmxlbmd0aCA9IDE7XG4gICAgICAgIHRoaXMubGV2ZWxzWzBdID0ge307XG4gICAgICAgIHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZyx1cmwsMCk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbHMgOiB0aGlzLmxldmVscyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsIDogdXJsICxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiB0aGlzLnN0YXRzfSk7XG4gICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbCA6IHRoaXMuX2xldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHRoaXMuc3RhdHN9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG11bHRpIGxldmVsIHBsYXlsaXN0LCBwYXJzZSBsZXZlbCBpbmZvXG4gICAgICAgIHRoaXMubGV2ZWxzID0gdGhpcy5wYXJzZU1hc3RlclBsYXlsaXN0KHN0cmluZyx1cmwpO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5sZXZlbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogdGhpcy5zdGF0c30pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdXJsLCBldmVudDogJ25vdCBhbiBITFMgcGxheWxpc3QnfSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsYmFzZXVybCkge1xuICAgIHZhciBsZXZlbHMgPSBbXTtcbiAgICB2YXIgbGV2ZWwgPSAge307XG4gICAgdmFyIHJlc3VsdDtcbiAgICB2YXIgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSooQkFORClXSURUSD0oXFxkKykpPyhbXlxcblxccl0qKFJFUylPTFVUSU9OPShcXGQrKXgoXFxkKykpPyhbXlxcblxccl0qKE5BTUUpPVxcXCIoLiopXFxcIik/W15cXG5cXHJdKltcXHJcXG5dKyhbXlxcclxcbl0rKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgcmVzdWx0LnNoaWZ0KCk7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGZ1bmN0aW9uKG4peyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7fSk7XG4gICAgICBsZXZlbC51cmwgPSB0aGlzLnJlc29sdmUocmVzdWx0LnBvcCgpLGJhc2V1cmwpO1xuICAgICAgd2hpbGUocmVzdWx0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgc3dpdGNoKHJlc3VsdC5zaGlmdCgpKSB7XG4gICAgICAgICAgY2FzZSAnUkVTJzpcbiAgICAgICAgICAgIGxldmVsLndpZHRoID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXZlbC5oZWlnaHQgPSByZXN1bHQuc2hpZnQoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0JBTkQnOlxuICAgICAgICAgICAgbGV2ZWwuYml0cmF0ZSA9IHJlc3VsdC5zaGlmdCgpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnTkFNRSc6XG4gICAgICAgICAgICBsZXZlbC5uYW1lID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgIGxldmVsID0ge307XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZHgpIHtcbiAgICB2YXIgY3VycmVudFNOID0gMCx0b3RhbGR1cmF0aW9uID0gMDtcbiAgICB2YXIgb2JqID0gdGhpcy5sZXZlbHNbaWR4XTtcbiAgICBvYmoudXJsID0gYmFzZXVybDtcbiAgICBvYmouZnJhZ21lbnRzID0gW107XG4gICAgb2JqLmVuZExpc3QgPSBmYWxzZTtcblxuICAgIHZhciByZXN1bHQ7XG4gICAgdmFyIHJlID0gLyg/OiNFWFQtWC0oTUVESUEtU0VRVUVOQ0UpOihcXGQrKSl8KD86I0VYVC1YLShUQVJHRVREVVJBVElPTik6KFxcZCspKXwoPzojRVhUKElORik6KFtcXGRcXC5dKylbXlxcclxcbl0qW1xcclxcbl0rKFteXFxyXFxuXSspfCg/OiNFWFQtWC0oRU5ETElTVCkpKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9PSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgc3dpdGNoKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gb2JqLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgb2JqLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBvYmouZW5kTGlzdCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIG9iai5mcmFnbWVudHMucHVzaCh7dXJsIDogdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSxiYXNldXJsKSwgZHVyYXRpb24gOiBkdXJhdGlvbiwgc3RhcnQgOiB0b3RhbGR1cmF0aW9uLCBzbiA6IGN1cnJlbnRTTisrfSk7XG4gICAgICAgICAgdG90YWxkdXJhdGlvbis9ZHVyYXRpb247XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGxvZ2dlci5sb2coJ2ZvdW5kICcgKyBvYmouZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgb2JqLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIG9iai5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHRoaXMuc3RhdHMudGVuZCA9IERhdGUubm93KCk7XG4gICAgaWYodGhpcy5sZXZlbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnBhcnNlTWFuaWZlc3QoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVRleHQsIHRoaXMudXJsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJzZUxldmVsUGxheWxpc3QoZXZlbnQuY3VycmVudFRhcmdldC5yZXNwb25zZVRleHQsIHRoaXMudXJsLCB0aGlzLl9sZXZlbCk7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgeyBsZXZlbCA6IHRoaXMuX2xldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB0aGlzLnVybCAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogdGhpcy5zdGF0c30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTE9BRF9FUlJPUiwgeyB1cmwgOiB0aGlzLnVybCwgZXZlbnQ6IGV2ZW50fSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoKSB7XG4gICAgaWYodGhpcy5zdGF0cy50Zmlyc3QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5zdGF0cy50Zmlyc3QgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5bGlzdExvYWRlcjtcbiIsImltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcblxubGV0IG9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuXG5vYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgb2JzZXJ2ZXIuZW1pdChldmVudCwgZXZlbnQsIC4uLmRhdGEpO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgb2JzZXJ2ZXI7XG4iLCIvKipcbiAqIGdlbmVyYXRlIE1QNCBCb3hcbiAqL1xuXG5jbGFzcyBNUDQge1xuICBzdGF0aWMgaW5pdCgpIHtcbiAgICBNUDQudHlwZXMgPSB7XG4gICAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgICAgYXZjQzogW10sXG4gICAgICBidHJ0OiBbXSxcbiAgICAgIGRpbmY6IFtdLFxuICAgICAgZHJlZjogW10sXG4gICAgICBlc2RzOiBbXSxcbiAgICAgIGZ0eXA6IFtdLFxuICAgICAgaGRscjogW10sXG4gICAgICBtZGF0OiBbXSxcbiAgICAgIG1kaGQ6IFtdLFxuICAgICAgbWRpYTogW10sXG4gICAgICBtZmhkOiBbXSxcbiAgICAgIG1pbmY6IFtdLFxuICAgICAgbW9vZjogW10sXG4gICAgICBtb292OiBbXSxcbiAgICAgIG1wNGE6IFtdLFxuICAgICAgbXZleDogW10sXG4gICAgICBtdmhkOiBbXSxcbiAgICAgIHNkdHA6IFtdLFxuICAgICAgc3RibDogW10sXG4gICAgICBzdGNvOiBbXSxcbiAgICAgIHN0c2M6IFtdLFxuICAgICAgc3RzZDogW10sXG4gICAgICBzdHN6OiBbXSxcbiAgICAgIHN0dHM6IFtdLFxuICAgICAgdGZkdDogW10sXG4gICAgICB0ZmhkOiBbXSxcbiAgICAgIHRyYWY6IFtdLFxuICAgICAgdHJhazogW10sXG4gICAgICB0cnVuOiBbXSxcbiAgICAgIHRyZXg6IFtdLFxuICAgICAgdGtoZDogW10sXG4gICAgICB2bWhkOiBbXVxuICAgIH07XG5cbiAgICB2YXIgaTtcbiAgICBmb3IgKGkgaW4gTVA0LnR5cGVzKSB7XG4gICAgICBpZiAoTVA0LnR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgIE1QNC50eXBlc1tpXSA9IFtcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMCksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDEpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMylcbiAgICAgICAgXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBNUDQuTUFKT1JfQlJBTkQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAnaScuY2hhckNvZGVBdCgwKSxcbiAgICAgICdzJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ28nLmNoYXJDb2RlQXQoMCksXG4gICAgICAnbScuY2hhckNvZGVBdCgwKVxuICAgIF0pO1xuICAgIE1QNC5BVkMxX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2EnLmNoYXJDb2RlQXQoMCksXG4gICAgICAndicuY2hhckNvZGVBdCgwKSxcbiAgICAgICdjJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJzEnLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuTUlOT1JfVkVSU0lPTiA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAxXSk7XG4gICAgTVA0LlZJREVPX0hETFIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuICAgIE1QNC5BVURJT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzMsIDB4NmYsIDB4NzUsIDB4NmUsIC8vIGhhbmRsZXJfdHlwZTogJ3NvdW4nXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDUzLCAweDZmLCAweDc1LCAweDZlLFxuICAgICAgMHg2NCwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1NvdW5kSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6TVA0LlZJREVPX0hETFIsXG4gICAgICAnYXVkaW8nOk1QNC5BVURJT19IRExSXG4gICAgfTtcbiAgICBNUDQuRFJFRiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcbiAgICBNUDQuU1RDTyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwIC8vIGVudHJ5X2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlNUU0MgPSBNUDQuU1RDTztcbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlNUVFMgPSBNUDQuU1RDTztcbiAgICBNUDQuVk1IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAvLyBncmFwaGljc21vZGVcbiAgICAgIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCAvLyBvcGNvbG9yXG4gICAgXSk7XG4gICAgTVA0LlNNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gYmFsYW5jZVxuICAgICAgMHgwMCwgMHgwMCAvLyByZXNlcnZlZFxuICAgIF0pO1xuXG4gICAgTVA0LlNUU0QgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxXSk7Ly8gZW50cnlfY291bnRcblxuICAgIE1QNC5NRURJQUhFQURFUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6IE1QNC5WTUhELFxuICAgICAgJ2F1ZGlvJzogTVA0LlNNSERcbiAgICB9O1xuXG4gICAgTVA0LkZUWVAgPSBNUDQuYm94KE1QNC50eXBlcy5mdHlwLCBNUDQuTUFKT1JfQlJBTkQsIE1QNC5NSU5PUl9WRVJTSU9OLCBNUDQuTUFKT1JfQlJBTkQsIE1QNC5BVkMxX0JSQU5EKTtcbiAgICBNUDQuRElORiA9IE1QNC5ib3goTVA0LnR5cGVzLmRpbmYsIE1QNC5ib3goTVA0LnR5cGVzLmRyZWYsIE1QNC5EUkVGKSk7XG4gIH1cblxuICBzdGF0aWMgYm94KHR5cGUpIHtcbiAgdmFyXG4gICAgcGF5bG9hZCA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG4gICAgc2l6ZSA9IDAsXG4gICAgaSA9IHBheWxvYWQubGVuZ3RoLFxuICAgIHJlc3VsdCxcbiAgICB2aWV3O1xuXG4gICAgLy8gY2FsY3VsYXRlIHRoZSB0b3RhbCBzaXplIHdlIG5lZWQgdG8gYWxsb2NhdGVcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSArIDgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcocmVzdWx0LmJ1ZmZlcik7XG4gICAgdmlldy5zZXRVaW50MzIoMCwgcmVzdWx0LmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQodHlwZSwgNCk7XG5cbiAgICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICAgIGZvciAoaSA9IDAsIHNpemUgPSA4OyBpIDwgcGF5bG9hZC5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0LnNldChwYXlsb2FkW2ldLCBzaXplKTtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgc3RhdGljIGhkbHIodHlwZSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5oZGxyLCBNUDQuSERMUl9UWVBFU1t0eXBlXSk7XG4gIH1cblxuICBzdGF0aWMgbWRhdChkYXRhKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kYXQsIGRhdGEpO1xuICB9XG5cbiAgc3RhdGljIG1kaGQoZHVyYXRpb24pIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMywgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDEsIDB4NWYsIDB4OTAsIC8vIHRpbWVzY2FsZSwgOTAsMDAwIFwidGlja3NcIiBwZXIgc2Vjb25kXG5cbiAgICAgIChkdXJhdGlvbiAmIDB4RkYwMDAwMDApID4+IDI0LFxuICAgICAgKGR1cmF0aW9uICYgMHhGRjAwMDApID4+IDE2LFxuICAgICAgKGR1cmF0aW9uICYgMHhGRjAwKSA+PiA4LFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay5kdXJhdGlvbiksIE1QNC5oZGxyKHRyYWNrLnR5cGUpLCBNUDQubWluZih0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1maGQoc2VxdWVuY2VOdW1iZXIpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgIChzZXF1ZW5jZU51bWJlciAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgIChzZXF1ZW5jZU51bWJlciAmIDB4RkYwMCkgPj4gOCxcbiAgICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1pbmYodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMudm1oZCwgTVA0Lk1FRElBSEVBREVSX1RZUEVTW3RyYWNrLnR5cGVdKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbW9vZihzbiwgYmFzZU1lZGlhRGVjb2RlVGltZSwgdHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubW9vZixcbiAgICAgICAgICAgICAgICAgICBNUDQubWZoZChzbiksXG4gICAgICAgICAgICAgICAgICAgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQoZHVyYXRpb24pIHtcbiAgICB2YXJcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAxLCAweDVmLCAweDkwLCAvLyB0aW1lc2NhbGUsIDkwLDAwMCBcInRpY2tzXCIgcGVyIHNlY29uZFxuICAgICAgICAoZHVyYXRpb24gJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgICAgKGR1cmF0aW9uICYgMHhGRjAwMDApID4+IDE2LFxuICAgICAgICAoZHVyYXRpb24gJiAweEZGMDApID4+IDgsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgLy8gMS4wIHJhdGVcbiAgICAgICAgMHgwMSwgMHgwMCwgLy8gMS4wIHZvbHVtZVxuICAgICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgICAgXSk7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm12aGQsIGJ5dGVzKTtcbiAgfVxuXG4gIHN0YXRpYyBzZHRwKHRyYWNrKSB7XG4gICAgdmFyXG4gICAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoNCArIHNhbXBsZXMubGVuZ3RoKSxcbiAgICAgIHNhbXBsZSxcbiAgICAgIGk7XG5cbiAgICAvLyBsZWF2ZSB0aGUgZnVsbCBib3ggaGVhZGVyICg0IGJ5dGVzKSBhbGwgemVyb1xuXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgYnl0ZXNbaSArIDRdID0gKHNhbXBsZS5mbGFncy5kZXBlbmRzT24gPDwgNCkgfFxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaGFzUmVkdW5kYW5jeSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnNkdHAsXG4gICAgICAgICAgICAgICBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc3RibCh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdGJsLFxuICAgICAgICAgICAgICAgTVA0LnN0c2QodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3R0cywgTVA0LlNUVFMpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzYywgTVA0LlNUU0MpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuc3RjbywgTVA0LlNUQ08pKTtcbiAgfVxuXG4gIHN0YXRpYyBhdmMxKHRyYWNrKSB7XG4gICAgdmFyIHNwcyA9IFtdLCBwcHMgPSBbXSwgaTtcbiAgICAvLyBhc3NlbWJsZSB0aGUgU1BTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYwMCkgPj4+IDgpO1xuICAgICAgc3BzLnB1c2goKHRyYWNrLnNwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRikpOyAvLyBzZXF1ZW5jZVBhcmFtZXRlclNldExlbmd0aFxuICAgICAgc3BzID0gc3BzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5zcHNbaV0pKTsgLy8gU1BTXG4gICAgfVxuXG4gICAgLy8gYXNzZW1ibGUgdGhlIFBQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggJiAweEZGMDApID4+PiA4KTtcbiAgICAgIHBwcy5wdXNoKCh0cmFjay5wcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTtcbiAgICAgIHBwcyA9IHBwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodHJhY2sucHBzW2ldKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLmF2YzEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgKHRyYWNrLndpZHRoICYgMHhmZjAwKSA+PiA4LFxuICAgICAgICB0cmFjay53aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAgICh0cmFjay5oZWlnaHQgJiAweGZmMDApID4+IDgsXG4gICAgICAgIHRyYWNrLmhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMyxcbiAgICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSxcbiAgICAgICAgMHg2ZiwgMHg2YSwgMHg3MywgMHgyZCxcbiAgICAgICAgMHg2MywgMHg2ZiwgMHg2ZSwgMHg3NCxcbiAgICAgICAgMHg3MiwgMHg2OSwgMHg2MiwgMHgyZCxcbiAgICAgICAgMHg2OCwgMHg2YywgMHg3MywgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgLy8gZGVwdGggPSAyNFxuICAgICAgICAweDExLCAweDExXSksIC8vIHByZV9kZWZpbmVkID0gLTFcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5hdmNDLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAxLCAvLyBjb25maWd1cmF0aW9uVmVyc2lvblxuICAgICAgICAgICAgdHJhY2sucHJvZmlsZUlkYywgLy8gQVZDUHJvZmlsZUluZGljYXRpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVDb21wYXRpYmlsaXR5LCAvLyBwcm9maWxlX2NvbXBhdGliaWxpdHlcbiAgICAgICAgICAgIHRyYWNrLmxldmVsSWRjLCAvLyBBVkNMZXZlbEluZGljYXRpb25cbiAgICAgICAgICAgIDB4ZmYgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgICBdLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5zcHMubGVuZ3RoIC8vIG51bU9mU2VxdWVuY2VQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHNwcykuY29uY2F0KFtcbiAgICAgICAgICAgIHRyYWNrLnBwcy5sZW5ndGggLy8gbnVtT2ZQaWN0dXJlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChwcHMpKSksIC8vIFwiUFBTXCJcbiAgICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5idHJ0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAweDAwLCAweDFjLCAweDljLCAweDgwLCAvLyBidWZmZXJTaXplREJcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzAsIC8vIG1heEJpdHJhdGVcbiAgICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzBdKSkgLy8gYXZnQml0cmF0ZVxuICAgICAgICAgICk7XG4gIH1cblxuICBzdGF0aWMgZXNkcyh0cmFjaykge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG5cbiAgICAgIDB4MDMsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgxOSwgLy8gbGVuZ3RoXG4gICAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgICAweDAwLCAvLyBzdHJlYW1fcHJpb3JpdHlcblxuICAgICAgMHgwNCwgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICAweDExLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgwMiwgLy8gbGVuZ3RoXG4gICAgICB0cmFjay5jb25maWdbMF0sdHJhY2suY29uZmlnWzFdXG4gICAgXSk7XG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgICAweDAwLCAweDAyLCAvLyBjaGFubmVsY291bnQ6MiBjaGFubmVsc1xuICAgICAgICAweDAwLCAweDEwLCAvLyBzYW1wbGVTaXplOjE2Yml0c1xuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgICAgKHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYwMCkgPj4gOCxcbiAgICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlICYgMHhmZiwgLy9cbiAgICAgICAgMHgwMCwgMHgwMF0pLFxuICAgICAgICBNUDQuYm94KE1QNC50eXBlcy5lc2RzLCBNUDQuZXNkcyh0cmFjaykpKTtcbiAgfVxuXG4gIHN0YXRpYyBzdHNkKHRyYWNrKSB7XG4gICAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCAsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCAsIE1QNC5hdmMxKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIHRraGQodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudGtoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICh0cmFjay5pZCAmIDB4RkYwMDAwMDApID4+IDI0LFxuICAgICAgKHRyYWNrLmlkICYgMHhGRjAwMDApID4+IDE2LFxuICAgICAgKHRyYWNrLmlkICYgMHhGRjAwKSA+PiA4LFxuICAgICAgdHJhY2suaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICh0cmFjay5kdXJhdGlvbiAmIDB4RkYwMDAwMDApID4+IDI0LFxuICAgICAgKHRyYWNrLmR1cmF0aW9uICYgMHhGRjAwMDApID4+IDE2LFxuICAgICAgKHRyYWNrLmR1cmF0aW9uICYgMHhGRjAwKSA+PiA4LFxuICAgICAgdHJhY2suZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAvLyBsYXllclxuICAgICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgICAweDAwLCAweDAwLCAvLyBub24tYXVkaW8gdHJhY2sgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDQwLCAweDAwLCAweDAwLCAweDAwLCAvLyB0cmFuc2Zvcm1hdGlvbjogdW5pdHkgbWF0cml4XG4gICAgICAodHJhY2sud2lkdGggJiAweEZGMDApID4+IDgsXG4gICAgICB0cmFjay53aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKHRyYWNrLmhlaWdodCAmIDB4RkYwMCkgPj4gOCxcbiAgICAgIHRyYWNrLmhlaWdodCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwIC8vIGhlaWdodFxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpIHtcbiAgICB2YXIgc2FtcGxlRGVwZW5kZW5jeVRhYmxlID0gTVA0LnNkdHAodHJhY2spO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFmLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkICYgMHhGRjAwMDAwMCkgPj4gMjQsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkICYgMHhGRjAwKSA+PiA4LFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRjAwKSA+PiA4LFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYpIC8vIGJhc2VNZWRpYURlY29kZVRpbWVcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC50cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgMTYgKyAvLyB0ZmhkXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIHRyYWYgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gbWZoZFxuICAgICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICAgIDgpLCAgLy8gbWRhdCBoZWFkZXJcbiAgICAgICAgICAgICAgIHNhbXBsZURlcGVuZGVuY3lUYWJsZSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gICAqIEBwYXJhbSB0cmFjayB7b2JqZWN0fSBhIHRyYWNrIGRlZmluaXRpb25cbiAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIHRyYWNrIGJveFxuICAgKi9cbiAgc3RhdGljIHRyYWsodHJhY2spIHtcbiAgICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyYWssXG4gICAgICAgICAgICAgICBNUDQudGtoZCh0cmFjayksXG4gICAgICAgICAgICAgICBNUDQubWRpYSh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIHRyZXgodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJleCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgKHRyYWNrLmlkICYgMHhGRjAwMDAwMCkgPj4gMjQsXG4gICAgICAodHJhY2suaWQgJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgICAodHJhY2suaWQgJiAweEZGMDApID4+IDgsXG4gICAgICAodHJhY2suaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgYnl0ZXMsIHNhbXBsZXMsIHNhbXBsZSwgaTtcblxuICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdO1xuICAgIG9mZnNldCArPSA4ICsgMTIgKyAoMTYgKiBzYW1wbGVzLmxlbmd0aCk7XG5cbiAgICBieXRlcyA9IFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwZiwgMHgwMSwgLy8gZmxhZ3NcbiAgICAgIChzYW1wbGVzLmxlbmd0aCAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAgIChzYW1wbGVzLmxlbmd0aCAmIDB4RkYwMDAwKSA+Pj4gMTYsXG4gICAgICAoc2FtcGxlcy5sZW5ndGggJiAweEZGMDApID4+PiA4LFxuICAgICAgc2FtcGxlcy5sZW5ndGggJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgJiAweEZGMDAwMDAwKSA+Pj4gMjQsXG4gICAgICAob2Zmc2V0ICYgMHhGRjAwMDApID4+PiAxNixcbiAgICAgIChvZmZzZXQgJiAweEZGMDApID4+PiA4LFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF07XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGJ5dGVzID0gYnl0ZXMuY29uY2F0KFtcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAgICAgKHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYwMDAwKSA+Pj4gMTYsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gJiAweEZGMDApID4+PiA4LFxuICAgICAgICBzYW1wbGUuZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgICAgKHNhbXBsZS5zaXplICYgMHhGRjAwMDAwMCkgPj4+IDI0LFxuICAgICAgICAoc2FtcGxlLnNpemUgJiAweEZGMDAwMCkgPj4+IDE2LFxuICAgICAgICAoc2FtcGxlLnNpemUgJiAweEZGMDApID4+PiA4LFxuICAgICAgICBzYW1wbGUuc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNMZWFkaW5nIDw8IDIpIHwgc2FtcGxlLmZsYWdzLmRlcGVuZHNPbixcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MuaGFzUmVkdW5kYW5jeSA8PCA0KSB8XG4gICAgICAgICAgKHNhbXBsZS5mbGFncy5wYWRkaW5nVmFsdWUgPDwgMSkgfFxuICAgICAgICAgIHNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUsXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRhdGlvblByaW9yaXR5ICYgMHhGMCA8PCA4LFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkYXRpb25Qcmlvcml0eSAmIDB4MEYsIC8vIHNhbXBsZV9mbGFnc1xuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGMDAwMCkgPj4+IDE2LFxuICAgICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCAmIDB4RkYwMCkgPj4+IDgsXG4gICAgICAgIHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSk7XG4gICAgfVxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cnVuLCBuZXcgVWludDhBcnJheShieXRlcykpO1xuICB9XG5cbiAgc3RhdGljIGluaXRTZWdtZW50KHRyYWNrcykge1xuXG4gICAgaWYoIU1QNC50eXBlcykge1xuICAgICAgTVA0LmluaXQoKTtcbiAgICB9XG4gICAgdmFyXG4gICAgICBtb3ZpZSA9IE1QNC5tb292KHRyYWNrcyksXG4gICAgICByZXN1bHQ7XG5cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShNUDQuRlRZUC5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChNUDQuRlRZUCk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgTVA0LkZUWVAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDQ7XG5cblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCl7fVxubGV0IGZha2VMb2dnZXIgPSB7XG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Zykge1xuICBpZiAoZGVidWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnICAgICAgID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gZGVidWcubG9nICAgPyBkZWJ1Zy5sb2cuYmluZChkZWJ1ZykgICA6IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBkZWJ1Zy5pbmZvICA/IGRlYnVnLmluZm8uYmluZChkZWJ1ZykgIDogY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBkZWJ1Zy5lcnJvciA/IGRlYnVnLmVycm9yLmJpbmQoZGVidWcpIDogY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gZGVidWcud2FybiAgPyBkZWJ1Zy53YXJuLmJpbmQoZGVidWcpICA6IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpO1xuXG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBub29wO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwiLyoqXG4gKiBBIGxpZ2h0d2VpZ2h0IHJlYWRhYmxlIHN0cmVhbSBpbXBsZW1lbnRpb24gdGhhdCBoYW5kbGVzIGV2ZW50IGRpc3BhdGNoaW5nLlxuICogT2JqZWN0cyB0aGF0IGluaGVyaXQgZnJvbSBzdHJlYW1zIHNob3VsZCBjYWxsIGluaXQgaW4gdGhlaXIgY29uc3RydWN0b3JzLlxuICovXG5cbiAndXNlIHN0cmljdCc7XG5cbiBjbGFzcyBTdHJlYW0gIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgZm9yIGEgc3BlY2lmaWVkIGV2ZW50IHR5cGUuXG4gICAqIEBwYXJhbSB0eXBlIHtzdHJpbmd9IHRoZSBldmVudCBuYW1lXG4gICAqIEBwYXJhbSBsaXN0ZW5lciB7ZnVuY3Rpb259IHRoZSBjYWxsYmFjayB0byBiZSBpbnZva2VkIHdoZW4gYW4gZXZlbnQgb2ZcbiAgICogdGhlIHNwZWNpZmllZCB0eXBlIG9jY3Vyc1xuICAgKi9cbiAgIG9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgICB9XG4gICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIH1cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGxpc3RlbmVyIGZvciBhIHNwZWNpZmllZCBldmVudCB0eXBlLlxuICAgKiBAcGFyYW0gdHlwZSB7c3RyaW5nfSB0aGUgZXZlbnQgbmFtZVxuICAgKiBAcGFyYW0gbGlzdGVuZXIge2Z1bmN0aW9ufSBhIGZ1bmN0aW9uIHByZXZpb3VzbHkgcmVnaXN0ZXJlZCBmb3IgdGhpc1xuICAgKiB0eXBlIG9mIGV2ZW50IHRocm91Z2ggYG9uYFxuICAgKi9cbiAgIG9mZih0eXBlLCBsaXN0ZW5lcikge1xuICAgIHZhciBpbmRleDtcbiAgICBpZiAoIXRoaXMubGlzdGVuZXJzW3R5cGVdKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0uaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICByZXR1cm4gaW5kZXggPiAtMTtcbiAgfVxuICAvKipcbiAgICogVHJpZ2dlciBhbiBldmVudCBvZiB0aGUgc3BlY2lmaWVkIHR5cGUgb24gdGhpcyBzdHJlYW0uIEFueSBhZGRpdGlvbmFsXG4gICAqIGFyZ3VtZW50cyB0byB0aGlzIGZ1bmN0aW9uIGFyZSBwYXNzZWQgYXMgcGFyYW1ldGVycyB0byBldmVudCBsaXN0ZW5lcnMuXG4gICAqIEBwYXJhbSB0eXBlIHtzdHJpbmd9IHRoZSBldmVudCBuYW1lXG4gICAqL1xuICAgdHJpZ2dlcih0eXBlKSB7XG4gICAgdmFyIGNhbGxiYWNrcywgaSwgbGVuZ3RoLCBhcmdzO1xuICAgIGNhbGxiYWNrcyA9IHRoaXMubGlzdGVuZXJzW3R5cGVdO1xuICAgIGlmICghY2FsbGJhY2tzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIFNsaWNpbmcgdGhlIGFyZ3VtZW50cyBvbiBldmVyeSBpbnZvY2F0aW9uIG9mIHRoaXMgbWV0aG9kXG4gICAgLy8gY2FuIGFkZCBhIHNpZ25pZmljYW50IGFtb3VudCBvZiBvdmVyaGVhZC4gQXZvaWQgdGhlXG4gICAgLy8gaW50ZXJtZWRpYXRlIG9iamVjdCBjcmVhdGlvbiBmb3IgdGhlIGNvbW1vbiBjYXNlIG9mIGFcbiAgICAvLyBzaW5nbGUgY2FsbGJhY2sgYXJndW1lbnRcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbGVuZ3RoID0gY2FsbGJhY2tzLmxlbmd0aDtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICBjYWxsYmFja3NbaV0uY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgIGxlbmd0aCA9IGNhbGxiYWNrcy5sZW5ndGg7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY2FsbGJhY2tzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvKipcbiAgICogRGVzdHJveXMgdGhlIHN0cmVhbSBhbmQgY2xlYW5zIHVwLlxuICAgKi9cbiAgIGRpc3Bvc2UoKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEZvcndhcmRzIGFsbCBgZGF0YWAgZXZlbnRzIG9uIHRoaXMgc3RyZWFtIHRvIHRoZSBkZXN0aW5hdGlvbiBzdHJlYW0uIFRoZVxuICAgKiBkZXN0aW5hdGlvbiBzdHJlYW0gc2hvdWxkIHByb3ZpZGUgYSBtZXRob2QgYHB1c2hgIHRvIHJlY2VpdmUgdGhlIGRhdGFcbiAgICogZXZlbnRzIGFzIHRoZXkgYXJyaXZlLlxuICAgKiBAcGFyYW0gZGVzdGluYXRpb24ge3N0cmVhbX0gdGhlIHN0cmVhbSB0aGF0IHdpbGwgcmVjZWl2ZSBhbGwgYGRhdGFgIGV2ZW50c1xuICAgKiBAc2VlIGh0dHA6Ly9ub2RlanMub3JnL2FwaS9zdHJlYW0uaHRtbCNzdHJlYW1fcmVhZGFibGVfcGlwZV9kZXN0aW5hdGlvbl9vcHRpb25zXG4gICAqL1xuICAgcGlwZShkZXN0aW5hdGlvbikge1xuICAgIHRoaXMub24oJ2RhdGEnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBkZXN0aW5hdGlvbi5wdXNoKGRhdGEpO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcblxuIl19
