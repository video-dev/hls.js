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
var LOADING_COMPLETED = 5;

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
        this.sourceBuffer.removeEventListener("updateend", this.onsbue);
        this.sourceBuffer.removeEventListener("error", this.onsbe);
        this.state = LOADING_WAITING_LEVEL_UPDATE;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    start: {
      value: function start(levels, sb) {
        this.levels = levels;
        this.sourceBuffer = sb;
        this.stop();
        this.timer = setInterval(this.ontick, 100);
        observer.on(Event.FRAGMENT_LOADED, this.onfl);
        observer.on(Event.FRAGMENT_PARSED, this.onfp);
        observer.on(Event.LEVEL_LOADED, this.onll);
        sb.addEventListener("updateend", this.onsbue);
        sb.addEventListener("error", this.onsbe);
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    tick: {
      value: function tick() {
        if (this.state === LOADING_IDLE && !this.sourceBuffer.updating) {
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
            } else {
              logger.log("last fragment loaded");
              observer.trigger(Event.LAST_FRAGMENT_LOADED);
              this.state = LOADING_COMPLETED;
            }
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
      value: function onSourceBufferError() {
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
          skipBytes = count / 8;

          count -= skipBytes * 8;
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
            levelIdc,
            profileCompatibility,
            chromaFormatIdc,
            picOrderCntType,
            numRefFramesInPicOrderCntCycle,
            picWidthInMbsMinus1,
            picHeightInMapUnitsMinus1,
            frameMbsOnlyFlag,
            scalingListCount,
            i;

        profileIdc = this.readUnsignedByte(); // profile_idc
        profileCompatibility = this.readBits(5); // constraint_set[0-5]_flag
        this.skipBits(3); //  u(1), reserved_zero_2bits u(2)
        levelIdc = this.readUnsignedByte(); // level_idc u(8)
        this.skipUnsignedExpGolomb(); // seq_parameter_set_id

        // some profiles have more optional data we don't need
        if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
          chromaFormatIdc = this.readUnsignedExpGolomb();
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
        picOrderCntType = this.readUnsignedExpGolomb();

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
          levelIdc: levelIdc,
          profileCompatibility: profileCompatibility,
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
    this.adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000];
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
        adtsDuration = adtsSampleCount * 1000 / this.adtsSampleingRates[adtsSampleingIndex];
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
        this.audiosamplerate = this.adtsSampleingRates[adtsSampleingIndex];
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
        if (configVideo) {
          observer.trigger(Event.FRAGMENT_PARSED, {
            data: MP4.initSegment([trackVideo, trackAudio])
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
        trackVideo.profileIdc = configVideo.profileIdc;
        trackVideo.levelIdc = configVideo.levelIdc;
        trackVideo.profileCompatibility = configVideo.profileCompatibility;
        trackVideo.duration = 90000 * _duration;

        // generate an init segment once all the metadata is available
        if (pps) {
          observer.trigger(Event.FRAGMENT_PARSED, {
            data: MP4.initSegment([trackVideo, trackAudio])
          });
        }
      }
      if (data.nalUnitType === "PPS" && !pps) {
        pps = data.data;
        trackVideo.pps = [data.data];

        if (configVideo && configAudio) {
          observer.trigger(Event.FRAGMENT_PARSED, {
            data: MP4.initSegment([trackVideo, trackAudio])
          });
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
        videoSegmentStream.end();
        audioSegmentStream.end();
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
  // Identifier for a load error event
  LOAD_ERROR: "hlsLoadError",
  // Identifier for a level switch error
  LEVEL_ERROR: "hlsLevelError",
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
    //Media Source listeners
    this.onmso = this.onMediaSourceOpen.bind(this);
    this.onmse = this.onMediaSourceEnded.bind(this);
    this.onmsc = this.onMediaSourceClose.bind(this);
    // internal listeners
    this.onml = this.onManifestLoaded.bind(this);
    // observer setup
    this.on = observer.on.bind(observer);
    this.off = observer.removeListener.bind(observer);
    this.video = video;
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
        this.detachSource();
        this.detachView();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    attachView: {
      value: function attachView(video) {
        // setup the media source
        var ms = this.mediaSource = new MediaSource();
        ms.addEventListener("sourceopen", this.onmso);
        ms.addEventListener("sourceended", this.onmse);
        ms.addEventListener("sourceclose", this.onmsc);
        // link video and media Source
        video.src = URL.createObjectURL(ms);
        // listen to all video events
        var listener = (function (evt) {
          this.logEvt(evt);
        }).bind(this);
        this.videoListenerBind = listener;
        video.addEventListener("loadstart", listener);
        //video.addEventListener('progress',        listener);
        video.addEventListener("suspend", listener);
        video.addEventListener("abort", listener);
        video.addEventListener("error", listener);
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
        var listener = this.videoListenerBind;
        var ms = this.mediaSource;
        if (ms) {
          var sb = this.sourceBuffer;
          if (sb) {
            //detach sourcebuffer from Media Source
            ms.removeSourceBuffer(sb);
            this.sourceBuffer = null;
          }
          ms.removeEventListener("sourceopen", this.onmso);
          ms.removeEventListener("sourceended", this.onmse);
          ms.removeEventListener("sourceclose", this.onmsc);
          // unlink MediaSource from video tag
          video.src = "";
          this.mediaSource = null;
        }
        this.video = null;
        // remove all video listeners
        video.removeEventListener("loadstart", listener);
        //video.removeEventListener('progress',        listener);
        video.removeEventListener("suspend", listener);
        video.removeEventListener("abort", listener);
        video.removeEventListener("error", listener);
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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    attachSource: {
      value: function attachSource(url) {
        this.url = url;
        logger.log("attachSource:" + url);
        // create source Buffer and link them to MediaSource
        this.sourceBuffer = this.mediaSource.addSourceBuffer("video/mp4;codecs=avc1.4d400d,mp4a.40.5");
        // internal listener setup
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
        this.playlistLoader.destroy();
        this.bufferController.destroy();
        // internal listener setup
        observer.removeListener(Event.MANIFEST_LOADED, this.onml);
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
        if (this.levels.length > 1) {
          // set level, it will trigger a playlist loading request
          this.playlistLoader.level = this.levels.length - 1;
        }
        this.bufferController.start(this.levels, this.sourceBuffer);
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
        xhr.responseType = "arraybuffer";
        xhr.open("GET", url, true);
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
        var re = /#EXT-X-STREAM-INF:[^\n\r]*(BANDWIDTH)=(\d+)*[^\n\r](RESOLUTION)=(\d+)x(\d+)[^\r\n]*[\r\n]+([^\r\n]+)/g;
        while ((result = re.exec(string)) != null) {
          result.shift();
          result = result.filter(function (n) {
            return n !== undefined;
          });
          level.url = this.resolve(result.pop(), baseurl);
          while (result.length > 0) {
            switch (result.shift()) {
              case "RESOLUTION":
                level.width = result.shift();
                level.height = result.shift();
                break;
              case "BANDWIDTH":
                level.bitrate = result.shift();
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
        var currentSN,
            totalduration = 0;
        var obj = this.levels[idx];
        obj.url = baseurl;
        obj.fragments = [];
        obj.endList = false;

        var result;
        var re = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):(\d+)[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST)))/g;
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
      value: function loadsuccess() {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL21zZS1obHMvc3JjL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy9kZW11eC9leHAtZ29sb21iLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvZXZlbnRzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvaGxzLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvbG9hZGVyL2ZyYWdtZW50LWxvYWRlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL21zZS1obHMvc3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy9vYnNlcnZlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL21zZS1obHMvc3JjL3JlbXV4L21wNC1nZW5lcmF0b3IuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy91dGlscy9sb2dnZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy91dGlscy9zdHJlYW0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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akIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFDakIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FDbEIsQ0FBQyxDQUFDO0FBQ0gsV0FBRyxDQUFDLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUM5QixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNqQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNqQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNqQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUNsQixDQUFDLENBQUM7QUFDSCxXQUFHLENBQUMsYUFBYSxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRCxXQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixXQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFVBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFDdEIsR0FBSSxFQUFFLEVBQUksRUFBRSxFQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsQ0FBSTtTQUM3QixDQUFDLENBQUM7QUFDSCxXQUFHLENBQUMsVUFBVSxHQUFHLElBQUksVUFBVSxDQUFDLENBQzlCLENBQUk7QUFDSixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFD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QUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLEVBQUksRUFBRSxHQUFJO0FBQ3RCLFNBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQSxJQUFLLEVBQUUsRUFDN0IsQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFBLElBQUssRUFBRSxFQUMzQixDQUFDLFFBQVEsR0FBRyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQ3hCLFFBQVEsR0FBRyxHQUFJO0FBQ2YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7U0FDdkIsQ0FBQyxDQUFDO0FBQ0wsZUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQ3ZDOzs7OztBQUVNLFFBQUk7YUFBQSxjQUFDLEtBQUssRUFBRTtBQUNqQixZQUNFLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxJQUFJLEVBQUU7WUFDN0IsS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1lBQzFDLE1BQU07WUFDTixDQUFDLENBQUM7Ozs7O0FBS0osYUFBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ25DLGdCQUFNLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCLGVBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQUFBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQ3hDLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxJQUFJLENBQUMsQUFBQyxHQUMvQixNQUFNLENBQUMsS0FBSyxDQUFDLGFBQWEsQUFBQyxDQUFDO1NBQ2hDOztBQUVELGVBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFDbEIsS0FBSyxDQUFDLENBQUM7T0FDbkI7Ozs7O0FBRU0sUUFBSTthQUFBLGNBQUMsS0FBSyxFQUFFO0FBQ2pCLGVBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFDbEIsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFDZixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFDakMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQ2pDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUNqQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO09BQy9DOzs7OztBQUVNLFFBQUk7YUFBQSxjQUFDLEtBQUssRUFBRTtBQUNqQixZQUFJLEdBQUcsR0FBRyxFQUFFO1lBQUUsR0FBRyxHQUFHLEVBQUU7WUFBRSxDQUFDLENBQUM7O0FBRTFCLGFBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDckMsYUFBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxHQUFHLEtBQU0sQ0FBQSxLQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ25ELGFBQUcsQ0FBQyxJQUFJLENBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEdBQUcsR0FBSSxDQUFFLENBQUM7QUFDM0MsYUFBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzVEOzs7QUFHRCxhQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3JDLGFBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsR0FBRyxLQUFNLENBQUEsS0FBTSxDQUFDLENBQUMsQ0FBQztBQUNuRCxhQUFHLENBQUMsSUFBSSxDQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxHQUFHLEdBQUksQ0FBRSxDQUFDO0FBQzNDLGFBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM1RDs7QUFFRCxlQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxVQUFVLENBQUMsQ0FDMUMsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ2hCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBTSxDQUFBLElBQUssQ0FBQyxFQUMzQixLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUk7QUFDbEIsU0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQU0sQ0FBQSxJQUFLLENBQUMsRUFDNUIsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFJO0FBQ25CLFNBQUksRUFBRSxFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLEVBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJO0FBQ1YsVUFBSSxFQUNKLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFDdEIsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsRUFBSSxFQUN0QixFQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsRUFBSSxFQUFFLEVBQUksRUFDdEIsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ2hCLFNBQUksRUFBRSxFQUFJO0FBQ1YsVUFBSSxFQUFFLEVBQUksQ0FBQyxDQUFDO0FBQ1YsV0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUNyQyxDQUFJO0FBQ0osYUFBSyxDQUFDLFVBQVU7QUFDaEIsYUFBSyxDQUFDLG9CQUFvQjtBQUMxQixhQUFLLENBQUMsUUFBUTtBQUNkLFdBQUk7U0FDTCxDQUFDLE1BQU0sQ0FBQyxDQUNQLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUFBLFNBQ2pCLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQ3BCLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUFBLFNBQ2pCLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoQixXQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLENBQ3JDLENBQUksRUFBRSxFQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUk7QUFDdEIsU0FBSSxFQUFFLEVBQUksRUFBRSxHQUFJLEVBQUUsR0FBSTtBQUN0QixTQUFJLEVBQUUsRUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLENBQUMsQ0FBQyxDQUFDO1NBQzFCLENBQUM7T0FDVDs7Ozs7QUFFTSxRQUFJO2FBQUEsY0FBQyxLQUFLLEVBQUU7QUFDakIsZUFBTyxJQUFJLFVBQVUsQ0FBQyxDQUNwQixDQUFJO0FBQ0osU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJOztBQUVoQixTQUFJO0FBQ0osVUFBSTtBQUNKLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSTs7QUFFSixTQUFJO0FBQ0osVUFBSTtBQUNKLFVBQUk7QUFDSixVQUFJO0FBQ0osU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ2hCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTs7QUFFdEIsU0FBSTtBQUNKLFNBQUk7QUFDSixhQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQ2hDLENBQUMsQ0FBQztPQUNKOzs7OztBQUVNLFFBQUk7YUFBQSxjQUFDLEtBQUssRUFBRTtBQUNiLGVBQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxDQUM5QyxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ2hCLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLEVBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQ3JDLEtBQUssQ0FBQyxlQUFlLEdBQUcsR0FBSTtBQUM1QixTQUFJLEVBQUUsQ0FBSSxDQUFDLENBQUMsRUFDWixHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQy9DOzs7OztBQUVNLFFBQUk7YUFBQSxjQUFDLEtBQUssRUFBRTtBQUNqQixZQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFO0FBQzFCLGlCQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7U0FDNUQsTUFBTTtBQUNMLGlCQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7U0FDNUQ7T0FDRjs7Ozs7QUFFTSxRQUFJO2FBQUEsY0FBQyxLQUFLLEVBQUU7QUFDakIsZUFBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLENBQzVDLENBQUk7QUFDSixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDaEIsU0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUEsSUFBSyxFQUFFLEVBQzdCLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxRQUFRLENBQUEsSUFBSyxFQUFFLEVBQzNCLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQ3hCLEtBQUssQ0FBQyxFQUFFLEdBQUcsR0FBSTtBQUNmLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsU0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQSxJQUFLLEVBQUUsRUFDbkMsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQSxJQUFLLEVBQUUsRUFDakMsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLEtBQU0sQ0FBQSxJQUFLLENBQUMsRUFDOUIsS0FBSyxDQUFDLFFBQVEsR0FBRyxHQUFJO0FBQ3JCLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJO0FBQ1YsU0FBSSxFQUFFLENBQUk7QUFDVixTQUFJLEVBQUUsQ0FBSTtBQUNWLFNBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLFNBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQzNCLEtB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ckI7Ozs7O0FBVUEsUUFBSTs7Ozs7Ozs7OzthQUFBLGNBQUMsV0FBVyxFQUFFO0FBQ2pCLFlBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLFVBQVMsSUFBSSxFQUFFO0FBQzdCLHFCQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3hCLENBQUMsQ0FBQztPQUNKOzs7Ozs7O1NBOUVJLE1BQU07OztpQkFpRkUsTUFBTSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvKlxuICogYnVmZmVyIGNvbnRyb2xsZXJcbiAqXG4gKi9cblxuIGltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuIGltcG9ydCBGcmFnbWVudExvYWRlciAgICAgICBmcm9tICcuLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbiBpbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuIGltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IFRTRGVtdXhlciAgICAgICAgICAgICBmcm9tICcuLi9kZW11eC90c2RlbXV4ZXInO1xuXG5cbiAgY29uc3QgTE9BRElOR19JRExFID0gMDtcbiAgY29uc3QgTE9BRElOR19JTl9QUk9HUkVTUyA9IDE7XG4gIGNvbnN0IExPQURJTkdfV0FJVElOR19MRVZFTF9VUERBVEUgPSAyO1xuICAvLyBjb25zdCBMT0FESU5HX1NUQUxMRUQgPSAzO1xuICAvLyBjb25zdCBMT0FESU5HX0ZSQUdNRU5UX0lPX0VSUk9SID0gNDtcbiAgY29uc3QgTE9BRElOR19DT01QTEVURUQgPSA1O1xuXG4gY2xhc3MgQnVmZmVyQ29udHJvbGxlciB7XG5cbiAgY29uc3RydWN0b3IodmlkZW8pIHtcbiAgICB0aGlzLnZpZGVvID0gdmlkZW87XG4gICAgdGhpcy5mcmFnbWVudExvYWRlciA9IG5ldyBGcmFnbWVudExvYWRlcigpO1xuICAgIHRoaXMuZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoKTtcbiAgICB0aGlzLm1wNHNlZ21lbnRzID0gW107XG4gICAgLy8gU291cmNlIEJ1ZmZlciBsaXN0ZW5lcnNcbiAgICB0aGlzLm9uc2J1ZSA9IHRoaXMub25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uc2JlICA9IHRoaXMub25Tb3VyY2VCdWZmZXJFcnJvci5iaW5kKHRoaXMpO1xuICAgIC8vIGludGVybmFsIGxpc3RlbmVyc1xuICAgIHRoaXMub25sbCA9IHRoaXMub25MZXZlbExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mbCA9IHRoaXMub25GcmFnbWVudExvYWRlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25mcCA9IHRoaXMub25GcmFnbWVudFBhcnNlZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgdGhpcy5zdGF0ZSA9IExPQURJTkdfV0FJVElOR19MRVZFTF9VUERBVEU7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3RvcCgpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuZGVtdXhlci5kZXN0cm95KCk7XG4gICAgdGhpcy5tcDRzZWdtZW50cyA9IFtdO1xuICAgIHRoaXMuc291cmNlQnVmZmVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICB0aGlzLnNvdXJjZUJ1ZmZlci5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICAgIHRoaXMuc3RhdGUgPSBMT0FESU5HX1dBSVRJTkdfTEVWRUxfVVBEQVRFO1xuICB9XG5cbiAgc3RhcnQobGV2ZWxzLCBzYikge1xuICAgIHRoaXMubGV2ZWxzID0gbGV2ZWxzO1xuICAgIHRoaXMuc291cmNlQnVmZmVyID0gc2I7XG4gICAgdGhpcy5zdG9wKCk7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub250aWNrLCAxMDApO1xuICAgIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdNRU5UX0xPQURFRCwgdGhpcy5vbmZsKTtcbiAgICBvYnNlcnZlci5vbihFdmVudC5GUkFHTUVOVF9QQVJTRUQsIHRoaXMub25mcCk7XG4gICAgb2JzZXJ2ZXIub24oRXZlbnQuTEVWRUxfTE9BREVELCB0aGlzLm9ubGwpO1xuICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIHRoaXMub25zYnVlKTtcbiAgICBzYi5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIHRoaXMub25zYmUpO1xuICB9XG5cbiAgc3RvcCgpIHtcbiAgICBpZih0aGlzLnRpbWVyKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMub250aWNrKTtcbiAgICB9XG4gICAgdGhpcy50aW1lciA9IHVuZGVmaW5lZDtcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5GUkFHTUVOVF9MT0FERUQsIHRoaXMub25mbCk7XG4gICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoRXZlbnQuRlJBR01FTlRfUEFSU0VELCB0aGlzLm9uZnApO1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKEV2ZW50LkxFVkVMX0xPQURFRCwgdGhpcy5vbmxsKTtcbiAgfVxuXG5cbiAgdGljaygpIHtcbiAgICBpZih0aGlzLnN0YXRlID09PSBMT0FESU5HX0lETEUgJiYgIXRoaXMuc291cmNlQnVmZmVyLnVwZGF0aW5nKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50IHBsYXkgcG9zaXRpb24gaXMgYnVmZmVyZWRcbiAgICAgIHZhciB2ID0gdGhpcy52aWRlbyxcbiAgICAgICAgICBwb3MgPSB2LmN1cnJlbnRUaW1lLFxuICAgICAgICAgIGJ1ZmZlcmVkID0gdi5idWZmZXJlZCxcbiAgICAgICAgICBidWZmZXJMZW4sXG4gICAgICAgICAgYnVmZmVyRW5kLFxuICAgICAgICAgIGk7XG4gICAgICBmb3IoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlckVuZCA9IHBvcyA7IGkgPCBidWZmZXJlZC5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgaWYocG9zID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvcyA8IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICAgIC8vIHBsYXkgcG9zaXRpb24gaXMgaW5zaWRlIHRoaXMgYnVmZmVyIFRpbWVSYW5nZSwgcmV0cmlldmUgZW5kIG9mIGJ1ZmZlciBwb3NpdGlvbiBhbmQgYnVmZmVyIGxlbmd0aFxuICAgICAgICAgIGJ1ZmZlckVuZCA9IGJ1ZmZlcmVkLmVuZChpKTtcbiAgICAgICAgICBidWZmZXJMZW4gPSBidWZmZXJFbmQgLSBwb3M7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIGlmIGJ1ZmZlciBsZW5ndGggaXMgbGVzcyB0aGFuIDYwcyB0cnkgdG8gbG9hZCBhIG5ldyBmcmFnbWVudFxuICAgICAgaWYoYnVmZmVyTGVuIDwgNjApIHtcbiAgICAgICAgLy8gZmluZCBmcmFnbWVudCBpbmRleCwgY29udGlndW91cyB3aXRoIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgdmFyIGZyYWdtZW50cyA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLmZyYWdtZW50cztcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGZyYWdtZW50cy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgICBpZihmcmFnbWVudHNbaV0uc3RhcnQgPD0gIChidWZmZXJFbmQrMC4xKSAmJiAoZnJhZ21lbnRzW2ldLnN0YXJ0ICsgZnJhZ21lbnRzW2ldLmR1cmF0aW9uKSA+IChidWZmZXJFbmQrMC4xKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmKGkgPCBmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ2xvYWRpbmcgZnJhZyAnICsgaSk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIubG9hZChmcmFnbWVudHNbaV0udXJsKTtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IExPQURJTkdfSU5fUFJPR1JFU1M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnbGFzdCBmcmFnbWVudCBsb2FkZWQnKTtcbiAgICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxBU1RfRlJBR01FTlRfTE9BREVEKTtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gTE9BRElOR19DT01QTEVURUQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLmxldmVsID0gZGF0YS5sZXZlbDtcbiAgICB0aGlzLmRlbXV4ZXIuZHVyYXRpb24gPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXS50b3RhbGR1cmF0aW9uO1xuICAgIHRoaXMuZnJhZ21lbnRJbmRleCA9IDA7XG4gICAgdmFyIHN0YXRzID0gZGF0YS5zdGF0cztcbiAgICBsb2dnZXIubG9nKCdsZXZlbCBsb2FkZWQsUlRUKG1zKS9sb2FkKG1zKS9kdXJhdGlvbjonICsgKHN0YXRzLnRmaXJzdCAtIHN0YXRzLnRyZXF1ZXN0KSArICcvJyArIChzdGF0cy50ZW5kIC0gc3RhdHMudHJlcXVlc3QpICsgJy8nICsgdGhpcy5kZW11eGVyLmR1cmF0aW9uKTtcbiAgICB0aGlzLnN0YXRlID0gTE9BRElOR19JRExFO1xuICB9XG5cbiAgb25GcmFnbWVudExvYWRlZChldmVudCxkYXRhKSB7XG4gICAgLy8gdHJhbnNtdXggdGhlIE1QRUctVFMgZGF0YSB0byBJU08tQk1GRiBzZWdtZW50c1xuICAgIHRoaXMuZGVtdXhlci5wdXNoKG5ldyBVaW50OEFycmF5KGRhdGEucGF5bG9hZCkpO1xuICAgIHRoaXMuZGVtdXhlci5lbmQoKTtcbiAgICB0aGlzLnN0YXRlID0gTE9BRElOR19JRExFO1xuICAgIHZhciBzdGF0cyxydHQsbG9hZHRpbWUsYnc7XG4gICAgc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgIHJ0dCA9IHN0YXRzLnRmaXJzdCAtIHN0YXRzLnRyZXF1ZXN0O1xuICAgIGxvYWR0aW1lID0gc3RhdHMudGVuZCAtIHN0YXRzLnRyZXF1ZXN0O1xuICAgIGJ3ID0gc3RhdHMubGVuZ3RoKjgvKDEwMDAqbG9hZHRpbWUpO1xuICAgIC8vbG9nZ2VyLmxvZyhkYXRhLnVybCArICcgbG9hZGVkLCBSVFQobXMpL2xvYWQobXMpL2JpdHJhdGU6JyArIHJ0dCArICcvJyArIGxvYWR0aW1lICsgJy8nICsgYncudG9GaXhlZCgzKSArICcgTWIvcycpO1xuICB9XG5cbiAgb25GcmFnbWVudFBhcnNlZChldmVudCxkYXRhKSB7XG4gICAgdGhpcy5tcDRzZWdtZW50cy5wdXNoKGRhdGEpO1xuICAgIHRoaXMuYXBwZW5kU2VnbWVudHMoKTtcbiAgfVxuXG4gIGFwcGVuZFNlZ21lbnRzKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUJ1ZmZlciAmJiAhdGhpcy5zb3VyY2VCdWZmZXIudXBkYXRpbmcgJiYgdGhpcy5tcDRzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuc291cmNlQnVmZmVyLmFwcGVuZEJ1ZmZlcih0aGlzLm1wNHNlZ21lbnRzLnNoaWZ0KCkuZGF0YSk7XG4gICAgfVxuICB9XG5cbiAgb25Tb3VyY2VCdWZmZXJVcGRhdGVFbmQoKSB7XG4gICAgLy9sb2dnZXIubG9nKCdidWZmZXIgYXBwZW5kZWQnKTtcbiAgICB0aGlzLmFwcGVuZFNlZ21lbnRzKCk7XG4gIH1cblxuICBvblNvdXJjZUJ1ZmZlckVycm9yKCkge1xuICAgICAgbG9nZ2VyLmxvZygnIGJ1ZmZlciBhcHBlbmQgZXJyb3I6JyArIGV2ZW50KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCdWZmZXJDb250cm9sbGVyO1xuIiwiLyoqXG4gKiBQYXJzZXIgZm9yIGV4cG9uZW50aWFsIEdvbG9tYiBjb2RlcywgYSB2YXJpYWJsZS1iaXR3aWR0aCBudW1iZXIgZW5jb2RpbmdcbiAqIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4gKi9cblxuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBFeHBHb2xvbWIge1xuXG4gIGNvbnN0cnVjdG9yKHdvcmtpbmdEYXRhKSB7XG4gICAgdGhpcy53b3JraW5nRGF0YSA9IHdvcmtpbmdEYXRhO1xuICAgIC8vIHRoZSBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byBleGFtaW5lIGluIHRoaXMud29ya2luZ0RhdGFcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA9IHRoaXMud29ya2luZ0RhdGEuYnl0ZUxlbmd0aDtcbiAgICAvLyB0aGUgY3VycmVudCB3b3JkIGJlaW5nIGV4YW1pbmVkXG4gICAgdGhpcy53b3JraW5nV29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IDA7IC8vIDp1aW50XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIGxvYWRXb3JkKCkge1xuICAgIHZhclxuICAgICAgcG9zaXRpb24gPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGggLSB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSk7XG5cbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuXG4gICAgd29ya2luZ0J5dGVzLnNldCh0aGlzLndvcmtpbmdEYXRhLnN1YmFycmF5KHBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24gKyBhdmFpbGFibGVCeXRlcykpO1xuICAgIHRoaXMud29ya2luZ1dvcmQgPSBuZXcgRGF0YVZpZXcod29ya2luZ0J5dGVzLmJ1ZmZlcikuZ2V0VWludDMyKDApO1xuXG4gICAgLy8gdHJhY2sgdGhlIGFtb3VudCBvZiB0aGlzLndvcmtpbmdEYXRhIHRoYXQgaGFzIGJlZW4gcHJvY2Vzc2VkXG4gICAgdGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBhdmFpbGFibGVCeXRlcztcbiAgfVxuXG4gIC8vIChjb3VudDppbnQpOnZvaWRcbiAgc2tpcEJpdHMoY291bnQpIHtcbiAgICB2YXIgc2tpcEJ5dGVzOyAvLyA6aW50XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiBjb3VudCkge1xuICAgICAgdGhpcy53b3JraW5nV29yZCAgICAgICAgICA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb3VudCAtPSB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlO1xuICAgICAgc2tpcEJ5dGVzID0gY291bnQgLyA4O1xuXG4gICAgICBjb3VudCAtPSAoc2tpcEJ5dGVzICogOCk7XG4gICAgICB0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG5cbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcblxuICAgICAgdGhpcy53b3JraW5nV29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JraW5nV29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG5cbiAgICBpZihzaXplID4zMikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcbiAgICB9XG5cbiAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGJpdHM7XG4gICAgaWYgKHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBiaXRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgfVxuXG4gICAgYml0cyA9IHNpemUgLSBiaXRzO1xuICAgIGlmIChiaXRzID4gMCkge1xuICAgICAgcmV0dXJuIHZhbHUgPDwgYml0cyB8IHRoaXMucmVhZEJpdHMoYml0cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB2YWx1O1xuICAgIH1cbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExlYWRpbmdaZXJvcygpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwIDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JraW5nV29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JraW5nV29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVbnNpZ25lZEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFeHBHb2xvbWIoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCkpO1xuICB9XG5cbiAgLy8gKCk6dWludFxuICByZWFkVW5zaWduZWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExlYWRpbmdaZXJvcygpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkRXhwR29sb21iKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gOmludFxuICAgIGlmICgweDAxICYgdmFsdSkge1xuICAgICAgLy8gdGhlIG51bWJlciBpcyBvZGQgaWYgdGhlIGxvdyBvcmRlciBiaXQgaXMgc2V0XG4gICAgICByZXR1cm4gKDEgKyB2YWx1KSA+Pj4gMTsgLy8gYWRkIDEgdG8gbWFrZSBpdCBldmVuLCBhbmQgZGl2aWRlIGJ5IDJcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIC0xICogKHZhbHUgPj4+IDEpOyAvLyBkaXZpZGUgYnkgdHdvIHRoZW4gbWFrZSBpdCBuZWdhdGl2ZVxuICAgIH1cbiAgfVxuXG4gIC8vIFNvbWUgY29udmVuaWVuY2UgZnVuY3Rpb25zXG4gIC8vIDpCb29sZWFuXG4gIHJlYWRCb29sZWFuKCkge1xuICAgIHJldHVybiAxID09PSB0aGlzLnJlYWRCaXRzKDEpO1xuICB9XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVbnNpZ25lZEJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvKipcbiAgICogQWR2YW5jZSB0aGUgRXhwR29sb21iIGRlY29kZXIgcGFzdCBhIHNjYWxpbmcgbGlzdC4gVGhlIHNjYWxpbmdcbiAgICogbGlzdCBpcyBvcHRpb25hbGx5IHRyYW5zbWl0dGVkIGFzIHBhcnQgb2YgYSBzZXF1ZW5jZSBwYXJhbWV0ZXJcbiAgICogc2V0IGFuZCBpcyBub3QgcmVsZXZhbnQgdG8gdHJhbnNtdXhpbmcuXG4gICAqIEBwYXJhbSBjb3VudCB7bnVtYmVyfSB0aGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhpcyBzY2FsaW5nIGxpc3RcbiAgICogQHNlZSBSZWNvbW1lbmRhdGlvbiBJVFUtVCBILjI2NCwgU2VjdGlvbiA3LjMuMi4xLjEuMVxuICAgKi9cbiAgc2tpcFNjYWxpbmdMaXN0KGNvdW50KSB7XG4gICAgdmFyXG4gICAgICBsYXN0U2NhbGUgPSA4LFxuICAgICAgbmV4dFNjYWxlID0gOCxcbiAgICAgIGosXG4gICAgICBkZWx0YVNjYWxlO1xuXG4gICAgZm9yIChqID0gMDsgaiA8IGNvdW50OyBqKyspIHtcbiAgICAgIGlmIChuZXh0U2NhbGUgIT09IDApIHtcbiAgICAgICAgZGVsdGFTY2FsZSA9IHRoaXMucmVhZEV4cEdvbG9tYigpO1xuICAgICAgICBuZXh0U2NhbGUgPSAobGFzdFNjYWxlICsgZGVsdGFTY2FsZSArIDI1NikgJSAyNTY7XG4gICAgICB9XG5cbiAgICAgIGxhc3RTY2FsZSA9IChuZXh0U2NhbGUgPT09IDApID8gbGFzdFNjYWxlIDogbmV4dFNjYWxlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZWFkIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldCBhbmQgcmV0dXJuIHNvbWUgaW50ZXJlc3RpbmcgdmlkZW9cbiAgICogcHJvcGVydGllcy4gQSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGlzIHRoZSBIMjY0IG1ldGFkYXRhIHRoYXRcbiAgICogZGVzY3JpYmVzIHRoZSBwcm9wZXJ0aWVzIG9mIHVwY29taW5nIHZpZGVvIGZyYW1lcy5cbiAgICogQHBhcmFtIGRhdGEge1VpbnQ4QXJyYXl9IHRoZSBieXRlcyBvZiBhIHNlcXVlbmNlIHBhcmFtZXRlciBzZXRcbiAgICogQHJldHVybiB7b2JqZWN0fSBhbiBvYmplY3Qgd2l0aCBjb25maWd1cmF0aW9uIHBhcnNlZCBmcm9tIHRoZVxuICAgKiBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0LCBpbmNsdWRpbmcgdGhlIGRpbWVuc2lvbnMgb2YgdGhlXG4gICAqIGFzc29jaWF0ZWQgdmlkZW8gZnJhbWVzLlxuICAgKi9cbiAgcmVhZFNlcXVlbmNlUGFyYW1ldGVyU2V0KCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHByb2ZpbGVJZGMsIGxldmVsSWRjLCBwcm9maWxlQ29tcGF0aWJpbGl0eSxcbiAgICAgIGNocm9tYUZvcm1hdElkYywgcGljT3JkZXJDbnRUeXBlLFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlLCBwaWNXaWR0aEluTWJzTWludXMxLFxuICAgICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSxcbiAgICAgIGZyYW1lTWJzT25seUZsYWcsXG4gICAgICBzY2FsaW5nTGlzdENvdW50LFxuICAgICAgaTtcblxuICAgIHByb2ZpbGVJZGMgPSB0aGlzLnJlYWRVbnNpZ25lZEJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0aWJpbGl0eSA9IHRoaXMucmVhZEJpdHMoNSk7IC8vIGNvbnN0cmFpbnRfc2V0WzAtNV1fZmxhZ1xuICAgIHRoaXMuc2tpcEJpdHMoMyk7IC8vICB1KDEpLCByZXNlcnZlZF96ZXJvXzJiaXRzIHUoMilcbiAgICBsZXZlbElkYyA9IHRoaXMucmVhZFVuc2lnbmVkQnl0ZSgpOyAvLyBsZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIHNlcV9wYXJhbWV0ZXJfc2V0X2lkXG5cbiAgICAvLyBzb21lIHByb2ZpbGVzIGhhdmUgbW9yZSBvcHRpb25hbCBkYXRhIHdlIGRvbid0IG5lZWRcbiAgICBpZiAocHJvZmlsZUlkYyA9PT0gMTAwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExMCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjIgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMjQ0IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDQ0IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDgzIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDg2IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDExOCB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAxMjgpIHtcbiAgICAgIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBpZiAoY2hyb21hRm9ybWF0SWRjID09PSAzKSB7XG4gICAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHNlcGFyYXRlX2NvbG91cl9wbGFuZV9mbGFnXG4gICAgICB9XG4gICAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBiaXRfZGVwdGhfbHVtYV9taW51czhcbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gbG9nMl9tYXhfZnJhbWVfbnVtX21pbnVzNFxuICAgIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG5cbiAgICBpZiAocGljT3JkZXJDbnRUeXBlID09PSAwKSB7XG4gICAgICB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3Jfbm9uX3JlZl9waWNcbiAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX3RvcF90b19ib3R0b21fZmllbGRcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGU7IGkrKykge1xuICAgICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl9yZWZfZnJhbWVbIGkgXVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuXG4gICAgcGljV2lkdGhJbk1ic01pbnVzMSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgcGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG5cbiAgICBmcmFtZU1ic09ubHlGbGFnID0gdGhpcy5yZWFkQml0cygxKTtcbiAgICBpZiAoZnJhbWVNYnNPbmx5RmxhZyA9PT0gMCkge1xuICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gbWJfYWRhcHRpdmVfZnJhbWVfZmllbGRfZmxhZ1xuICAgIH1cblxuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRpcmVjdF84eDhfaW5mZXJlbmNlX2ZsYWdcbiAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIGZyYW1lX2Nyb3BwaW5nX2ZsYWdcbiAgICAgIGZyYW1lQ3JvcExlZnRPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wVG9wT2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHByb2ZpbGVJZGM6IHByb2ZpbGVJZGMsXG4gICAgICBsZXZlbElkYzogbGV2ZWxJZGMsXG4gICAgICBwcm9maWxlQ29tcGF0aWJpbGl0eTogcHJvZmlsZUNvbXBhdGliaWxpdHksXG4gICAgICB3aWR0aDogKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMixcbiAgICAgIGhlaWdodDogKCgyIC0gZnJhbWVNYnNPbmx5RmxhZykgKiAocGljSGVpZ2h0SW5NYXBVbml0c01pbnVzMSArIDEpICogMTYpIC0gKGZyYW1lQ3JvcFRvcE9mZnNldCAqIDIpIC0gKGZyYW1lQ3JvcEJvdHRvbU9mZnNldCAqIDIpXG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIEEgc3RyZWFtLWJhc2VkIG1wMnRzIHRvIG1wNCBjb252ZXJ0ZXIuIFRoaXMgdXRpbGl0eSBpcyB1c2VkIHRvXG4gKiBkZWxpdmVyIG1wNHMgdG8gYSBTb3VyY2VCdWZmZXIgb24gcGxhdGZvcm1zIHRoYXQgc3VwcG9ydCBuYXRpdmVcbiAqIE1lZGlhIFNvdXJjZSBFeHRlbnNpb25zLlxuICovXG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFeHBHb2xvbWIgICAgICAgZnJvbSAnLi9leHAtZ29sb21iJztcbmltcG9ydCBNUDQgICAgICAgICAgICAgZnJvbSAnLi4vcmVtdXgvbXA0LWdlbmVyYXRvcic7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbmltcG9ydCBTdHJlYW0gICAgICAgICAgZnJvbSAnLi4vdXRpbHMvc3RyZWFtJztcbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY29uc3QgTVAyVF9QQUNLRVRfTEVOR1RIID0gMTg4OyAvLyBieXRlc1xuY29uc3QgSDI2NF9TVFJFQU1fVFlQRSA9IDB4MWI7XG5jb25zdCBBRFRTX1NUUkVBTV9UWVBFID0gMHgwZjtcbmNvbnN0IFBBVF9QSUQgPSAwO1xuXG4vKipcbiAqIFNwbGl0cyBhbiBpbmNvbWluZyBzdHJlYW0gb2YgYmluYXJ5IGRhdGEgaW50byBNUEVHLTIgVHJhbnNwb3J0XG4gKiBTdHJlYW0gcGFja2V0cy5cbiAqL1xuY2xhc3MgVHJhbnNwb3J0UGFja2V0U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KE1QMlRfUEFDS0VUX0xFTkdUSCk7XG4gICAgdGhpcy5lbmQgPSAwO1xuICB9XG5cbiAgcHVzaChieXRlcykge1xuICAgIHZhciByZW1haW5pbmcsIGk7XG5cbiAgICAvLyBjbGVhciBvdXQgYW55IHBhcnRpYWwgcGFja2V0cyBpbiB0aGUgYnVmZmVyXG4gICAgaWYgKHRoaXMuZW5kID4gMCkge1xuICAgICAgcmVtYWluaW5nID0gTVAyVF9QQUNLRVRfTEVOR1RIIC0gdGhpcy5lbmQ7XG4gICAgICB0aGlzLmJ1ZmZlci5zZXQoYnl0ZXMuc3ViYXJyYXkoMCwgcmVtYWluaW5nKSwgdGhpcy5lbmQpO1xuXG4gICAgICAvLyB3ZSBzdGlsbCBkaWRuJ3Qgd3JpdGUgb3V0IGEgY29tcGxldGUgcGFja2V0XG4gICAgICBpZiAoYnl0ZXMuYnl0ZUxlbmd0aCA8IHJlbWFpbmluZykge1xuICAgICAgICB0aGlzLmVuZCArPSBieXRlcy5ieXRlTGVuZ3RoO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGJ5dGVzID0gYnl0ZXMuc3ViYXJyYXkocmVtYWluaW5nKTtcbiAgICAgIHRoaXMuZW5kID0gMDtcbiAgICAgIHRoaXMudHJpZ2dlcignZGF0YScsIHRoaXMuYnVmZmVyKTtcbiAgICB9XG5cbiAgICAvLyBpZiBsZXNzIHRoYW4gYSBzaW5nbGUgcGFja2V0IGlzIGF2YWlsYWJsZSwgYnVmZmVyIGl0IHVwIGZvciBsYXRlclxuICAgIGlmIChieXRlcy5ieXRlTGVuZ3RoIDwgTVAyVF9QQUNLRVRfTEVOR1RIKSB7XG4gICAgICB0aGlzLmJ1ZmZlci5zZXQoYnl0ZXMuc3ViYXJyYXkoaSksIHRoaXMuZW5kKTtcbiAgICAgIHRoaXMuZW5kICs9IGJ5dGVzLmJ5dGVMZW5ndGg7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHBhcnNlIG91dCBhbGwgdGhlIGNvbXBsZXRlZCBwYWNrZXRzXG4gICAgaSA9IDA7XG4gICAgZG8ge1xuICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgYnl0ZXMuc3ViYXJyYXkoaSwgaSArIE1QMlRfUEFDS0VUX0xFTkdUSCkpO1xuICAgICAgaSArPSBNUDJUX1BBQ0tFVF9MRU5HVEg7XG4gICAgICByZW1haW5pbmcgPSBieXRlcy5ieXRlTGVuZ3RoIC0gaTtcbiAgICB9IHdoaWxlIChpIDwgYnl0ZXMuYnl0ZUxlbmd0aCAmJiByZW1haW5pbmcgPj0gTVAyVF9QQUNLRVRfTEVOR1RIKTtcbiAgICAvLyBidWZmZXIgYW55IHBhcnRpYWwgcGFja2V0cyBsZWZ0IG92ZXJcbiAgICBpZiAocmVtYWluaW5nID4gMCkge1xuICAgICAgdGhpcy5idWZmZXIuc2V0KGJ5dGVzLnN1YmFycmF5KGkpKTtcbiAgICAgIHRoaXMuZW5kID0gcmVtYWluaW5nO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFjY2VwdHMgYW4gTVAyVCBUcmFuc3BvcnRQYWNrZXRTdHJlYW0gYW5kIGVtaXRzIGRhdGEgZXZlbnRzIHdpdGggcGFyc2VkXG4gKiBmb3JtcyBvZiB0aGUgaW5kaXZpZHVhbCB0cmFuc3BvcnQgc3RyZWFtIHBhY2tldHMuXG4gKi9cbmNsYXNzIFRyYW5zcG9ydFBhcnNlU3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnByb2dyYW1NYXBUYWJsZSA9IHt9O1xuICB9XG5cbiAgcGFyc2VQc2kocGF5bG9hZCwgcHNpKSB7XG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgLy8gUFNJIHBhY2tldHMgbWF5IGJlIHNwbGl0IGludG8gbXVsdGlwbGUgc2VjdGlvbnMgYW5kIHRob3NlXG4gICAgLy8gc2VjdGlvbnMgbWF5IGJlIHNwbGl0IGludG8gbXVsdGlwbGUgcGFja2V0cy4gSWYgYSBQU0lcbiAgICAvLyBzZWN0aW9uIHN0YXJ0cyBpbiB0aGlzIHBhY2tldCwgdGhlIHBheWxvYWRfdW5pdF9zdGFydF9pbmRpY2F0b3JcbiAgICAvLyB3aWxsIGJlIHRydWUgYW5kIHRoZSBmaXJzdCBieXRlIG9mIHRoZSBwYXlsb2FkIHdpbGwgaW5kaWNhdGVcbiAgICAvLyB0aGUgb2Zmc2V0IGZyb20gdGhlIGN1cnJlbnQgcG9zaXRpb24gdG8gdGhlIHN0YXJ0IG9mIHRoZVxuICAgIC8vIHNlY3Rpb24uXG4gICAgaWYgKHBzaS5wYXlsb2FkVW5pdFN0YXJ0SW5kaWNhdG9yKSB7XG4gICAgICBvZmZzZXQgKz0gcGF5bG9hZFtvZmZzZXRdICsgMTtcbiAgICB9XG5cbiAgICBpZiAocHNpLnR5cGUgPT09ICdwYXQnKSB7XG4gICAgICB0aGlzLnBhcnNlUGF0KHBheWxvYWQuc3ViYXJyYXkob2Zmc2V0KSwgcHNpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJzZVBtdChwYXlsb2FkLnN1YmFycmF5KG9mZnNldCksIHBzaSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VQYXQocGF5bG9hZCwgcGF0KSB7XG4gICAgcGF0LnNlY3Rpb25OdW1iZXIgPSBwYXlsb2FkWzddO1xuICAgIHBhdC5sYXN0U2VjdGlvbk51bWJlciA9IHBheWxvYWRbOF07XG5cbiAgICAvLyBza2lwIHRoZSBQU0kgaGVhZGVyIGFuZCBwYXJzZSB0aGUgZmlyc3QgUE1UIGVudHJ5XG4gICAgcGF0LnBtdFBpZCA9IHRoaXMucG10UGlkID0gKHBheWxvYWRbMTBdICYgMHgxRikgPDwgOCB8IHBheWxvYWRbMTFdO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhcnNlIG91dCB0aGUgcmVsZXZhbnQgZmllbGRzIG9mIGEgUHJvZ3JhbSBNYXAgVGFibGUgKFBNVCkuXG4gICAqIEBwYXJhbSBwYXlsb2FkIHtVaW50OEFycmF5fSB0aGUgUE1ULXNwZWNpZmljIHBvcnRpb24gb2YgYW4gTVAyVFxuICAgKiBwYWNrZXQuIFRoZSBmaXJzdCBieXRlIGluIHRoaXMgYXJyYXkgc2hvdWxkIGJlIHRoZSB0YWJsZV9pZFxuICAgKiBmaWVsZC5cbiAgICogQHBhcmFtIHBtdCB7b2JqZWN0fSB0aGUgb2JqZWN0IHRoYXQgc2hvdWxkIGJlIGRlY29yYXRlZCB3aXRoXG4gICAqIGZpZWxkcyBwYXJzZWQgZnJvbSB0aGUgUE1ULlxuICAgKi9cbiAgcGFyc2VQbXQocGF5bG9hZCwgcG10KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgb2Zmc2V0O1xuXG4gICAgLy8gUE1UcyBjYW4gYmUgc2VudCBhaGVhZCBvZiB0aGUgdGltZSB3aGVuIHRoZXkgc2hvdWxkIGFjdHVhbGx5XG4gICAgLy8gdGFrZSBlZmZlY3QuIFdlIGRvbid0IGJlbGlldmUgdGhpcyBzaG91bGQgZXZlciBiZSB0aGUgY2FzZVxuICAgIC8vIGZvciBITFMgYnV0IHdlJ2xsIGlnbm9yZSBcImZvcndhcmRcIiBQTVQgZGVjbGFyYXRpb25zIGlmIHdlIHNlZVxuICAgIC8vIHRoZW0uIEZ1dHVyZSBQTVQgZGVjbGFyYXRpb25zIGhhdmUgdGhlIGN1cnJlbnRfbmV4dF9pbmRpY2F0b3JcbiAgICAvLyBzZXQgdG8gemVyby5cbiAgICBpZiAoIShwYXlsb2FkWzVdICYgMHgwMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBvdmVyd3JpdGUgYW55IGV4aXN0aW5nIHByb2dyYW0gbWFwIHRhYmxlXG4gICAgdGhpcy5wcm9ncmFtTWFwVGFibGUgPSB7fTtcblxuICAgIC8vIHRoZSBtYXBwaW5nIHRhYmxlIGVuZHMgYXQgdGhlIGVuZCBvZiB0aGUgY3VycmVudCBzZWN0aW9uXG4gICAgc2VjdGlvbkxlbmd0aCA9IChwYXlsb2FkWzFdICYgMHgwZikgPDwgOCB8IHBheWxvYWRbMl07XG4gICAgdGFibGVFbmQgPSAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG5cbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKHBheWxvYWRbMTBdICYgMHgwZikgPDwgOCB8IHBheWxvYWRbMTFdO1xuXG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCA9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICAvLyBhZGQgYW4gZW50cnkgdGhhdCBtYXBzIHRoZSBlbGVtZW50YXJ5X3BpZCB0byB0aGUgc3RyZWFtX3R5cGVcbiAgICAgIHRoaXMucHJvZ3JhbU1hcFRhYmxlWyhwYXlsb2FkW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IHBheWxvYWRbb2Zmc2V0ICsgMl1dID0gcGF5bG9hZFtvZmZzZXRdO1xuXG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChwYXlsb2FkW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IHBheWxvYWRbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG5cbiAgICAvLyByZWNvcmQgdGhlIG1hcCBvbiB0aGUgcGFja2V0IGFzIHdlbGxcbiAgICBwbXQucHJvZ3JhbU1hcFRhYmxlID0gdGhpcy5wcm9ncmFtTWFwVGFibGU7XG4gIH1cblxuICBwYXJzZVBlcyhwYXlsb2FkLCBwZXMpIHtcbiAgICB2YXIgcHRzRHRzRmxhZ3M7XG5cbiAgICBpZiAoIXBlcy5wYXlsb2FkVW5pdFN0YXJ0SW5kaWNhdG9yKSB7XG4gICAgICBwZXMuZGF0YSA9IHBheWxvYWQ7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gZmluZCBvdXQgaWYgdGhpcyBwYWNrZXRzIHN0YXJ0cyBhIG5ldyBrZXlmcmFtZVxuICAgIHBlcy5kYXRhQWxpZ25tZW50SW5kaWNhdG9yID0gKHBheWxvYWRbNl0gJiAweDA0KSAhPT0gMDtcbiAgICAvLyBQRVMgcGFja2V0cyBtYXkgYmUgYW5ub3RhdGVkIHdpdGggYSBQVFMgdmFsdWUsIG9yIGEgUFRTIHZhbHVlXG4gICAgLy8gYW5kIGEgRFRTIHZhbHVlLiBEZXRlcm1pbmUgd2hhdCBjb21iaW5hdGlvbiBvZiB2YWx1ZXMgaXNcbiAgICAvLyBhdmFpbGFibGUgdG8gd29yayB3aXRoLlxuICAgIHB0c0R0c0ZsYWdzID0gcGF5bG9hZFs3XTtcblxuICAgIC8vIFBUUyBhbmQgRFRTIGFyZSBub3JtYWxseSBzdG9yZWQgYXMgYSAzMy1iaXQgbnVtYmVyLiAgSmF2YXNjcmlwdFxuICAgIC8vIHBlcmZvcm1zIGFsbCBiaXR3aXNlIG9wZXJhdGlvbnMgb24gMzItYml0IGludGVnZXJzIGJ1dCBpdCdzXG4gICAgLy8gY29udmVuaWVudCB0byBjb252ZXJ0IGZyb20gOTBucyB0byAxbXMgdGltZSBzY2FsZSBhbnl3YXkuIFNvXG4gICAgLy8gd2hhdCB3ZSBhcmUgZ29pbmcgdG8gZG8gaW5zdGVhZCBpcyBkcm9wIHRoZSBsZWFzdCBzaWduaWZpY2FudFxuICAgIC8vIGJpdCAoaW4gZWZmZWN0LCBkaXZpZGluZyBieSB0d28pIHRoZW4gd2UgY2FuIGRpdmlkZSBieSA0NSAoNDUgKlxuICAgIC8vIDIgPSA5MCkgdG8gZ2V0IG1zLlxuICAgIGlmIChwdHNEdHNGbGFncyAmIDB4QzApIHtcbiAgICAgIC8vIHRoZSBQVFMgYW5kIERUUyBhcmUgbm90IHdyaXR0ZW4gb3V0IGRpcmVjdGx5LiBGb3IgaW5mb3JtYXRpb25cbiAgICAgIC8vIG9uIGhvdyB0aGV5IGFyZSBlbmNvZGVkLCBzZWVcbiAgICAgIC8vIGh0dHA6Ly9kdmQuc291cmNlZm9yZ2UubmV0L2R2ZGluZm8vcGVzLWhkci5odG1sXG4gICAgICBwZXMucHRzID0gKHBheWxvYWRbOV0gJiAweDBFKSA8PCAyOFxuICAgICAgICB8IChwYXlsb2FkWzEwXSAmIDB4RkYpIDw8IDIxXG4gICAgICAgIHwgKHBheWxvYWRbMTFdICYgMHhGRSkgPDwgMTNcbiAgICAgICAgfCAocGF5bG9hZFsxMl0gJiAweEZGKSA8PCAgNlxuICAgICAgICB8IChwYXlsb2FkWzEzXSAmIDB4RkUpID4+PiAgMjtcbiAgICAgIHBlcy5wdHMgLz0gNDU7XG4gICAgICBwZXMuZHRzID0gcGVzLnB0cztcbiAgICAgIGlmIChwdHNEdHNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgcGVzLmR0cyA9IChwYXlsb2FkWzE0XSAmIDB4MEUgKSA8PCAyOFxuICAgICAgICAgIHwgKHBheWxvYWRbMTVdICYgMHhGRiApIDw8IDIxXG4gICAgICAgICAgfCAocGF5bG9hZFsxNl0gJiAweEZFICkgPDwgMTNcbiAgICAgICAgICB8IChwYXlsb2FkWzE3XSAmIDB4RkYgKSA8PCA2XG4gICAgICAgICAgfCAocGF5bG9hZFsxOF0gJiAweEZFICkgPj4+IDI7XG4gICAgICAgIHBlcy5kdHMgLz0gNDU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGhlIGRhdGEgc2VjdGlvbiBzdGFydHMgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIFBFUyBoZWFkZXIuXG4gICAgLy8gcGVzX2hlYWRlcl9kYXRhX2xlbmd0aCBzcGVjaWZpZXMgdGhlIG51bWJlciBvZiBoZWFkZXIgYnl0ZXNcbiAgICAvLyB0aGF0IGZvbGxvdyB0aGUgbGFzdCBieXRlIG9mIHRoZSBmaWVsZC5cbiAgICBwZXMuZGF0YSA9IHBheWxvYWQuc3ViYXJyYXkoOSArIHBheWxvYWRbOF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGl2ZXIgYSBuZXcgTVAyVCBwYWNrZXQgdG8gdGhlIHN0cmVhbS5cbiAgICovXG4gIHB1c2gocGFja2V0KSB7XG4gICAgdmFyXG4gICAgICByZXN1bHQgPSB7fSxcbiAgICAgIG9mZnNldCA9IDQ7XG4gICAgLy8gbWFrZSBzdXJlIHBhY2tldCBpcyBhbGlnbmVkIG9uIGEgc3luYyBieXRlXG4gICAgaWYgKHBhY2tldFswXSAhPT0gMHg0Nykge1xuICAgICAgcmV0dXJuIHRoaXMudHJpZ2dlcignZXJyb3InLCAnbWlzLWFsaWduZWQgcGFja2V0Jyk7XG4gICAgfVxuICAgIHJlc3VsdC5wYXlsb2FkVW5pdFN0YXJ0SW5kaWNhdG9yID0gISEocGFja2V0WzFdICYgMHg0MCk7XG5cbiAgICAvLyBwaWQgaXMgYSAxMy1iaXQgZmllbGQgc3RhcnRpbmcgYXQgdGhlIGxhc3QgYml0IG9mIHBhY2tldFsxXVxuICAgIHJlc3VsdC5waWQgPSBwYWNrZXRbMV0gJiAweDFmO1xuICAgIHJlc3VsdC5waWQgPDw9IDg7XG4gICAgcmVzdWx0LnBpZCB8PSBwYWNrZXRbMl07XG5cbiAgICAvLyBpZiBhbiBhZGFwdGlvbiBmaWVsZCBpcyBwcmVzZW50LCBpdHMgbGVuZ3RoIGlzIHNwZWNpZmllZCBieSB0aGVcbiAgICAvLyBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLiBUaGUgYWRhcHRhdGlvbiBmaWVsZCBpc1xuICAgIC8vIHVzZWQgdG8gYWRkIHN0dWZmaW5nIHRvIFBFUyBwYWNrZXRzIHRoYXQgZG9uJ3QgZmlsbCBhIGNvbXBsZXRlXG4gICAgLy8gVFMgcGFja2V0LCBhbmQgdG8gc3BlY2lmeSBzb21lIGZvcm1zIG9mIHRpbWluZyBhbmQgY29udHJvbCBkYXRhXG4gICAgLy8gdGhhdCB3ZSBkbyBub3QgY3VycmVudGx5IHVzZS5cbiAgICBpZiAoKChwYWNrZXRbM10gJiAweDMwKSA+Pj4gNCkgPiAweDAxKSB7XG4gICAgICBvZmZzZXQgKz0gcGFja2V0W29mZnNldF0gKyAxO1xuICAgIH1cblxuICAgIC8vIHBhcnNlIHRoZSByZXN0IG9mIHRoZSBwYWNrZXQgYmFzZWQgb24gdGhlIHR5cGVcbiAgICBpZiAocmVzdWx0LnBpZCA9PT0gUEFUX1BJRCkge1xuICAgICAgcmVzdWx0LnR5cGUgPSAncGF0JztcbiAgICAgIHRoaXMucGFyc2VQc2kocGFja2V0LnN1YmFycmF5KG9mZnNldCksIHJlc3VsdCk7XG4gICAgfSBlbHNlIGlmIChyZXN1bHQucGlkID09PSB0aGlzLnBtdFBpZCkge1xuICAgICAgcmVzdWx0LnR5cGUgPSAncG10JztcbiAgICAgIHRoaXMucGFyc2VQc2kocGFja2V0LnN1YmFycmF5KG9mZnNldCksIHJlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5zdHJlYW1UeXBlID0gdGhpcy5wcm9ncmFtTWFwVGFibGVbcmVzdWx0LnBpZF07XG4gICAgICBpZihyZXN1bHQuc3RyZWFtVHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC50eXBlID0gJ3Blcyc7XG4gICAgICAgIHRoaXMucGFyc2VQZXMocGFja2V0LnN1YmFycmF5KG9mZnNldCksIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgcmVzdWx0KTtcbiAgfVxufVxuXG4vKipcbiAqIFJlY29uc2lzdHV0ZXMgcHJvZ3JhbSBlbGVtZW50YXJ5IHN0cmVhbSAoUEVTKSBwYWNrZXRzIGZyb20gcGFyc2VkXG4gKiB0cmFuc3BvcnQgc3RyZWFtIHBhY2tldHMuIFRoYXQgaXMsIGlmIHlvdSBwaXBlIGFuXG4gKiBtcDJ0LlRyYW5zcG9ydFBhcnNlU3RyZWFtIGludG8gYSBtcDJ0LkVsZW1lbnRhcnlTdHJlYW0sIHRoZSBvdXRwdXRcbiAqIGV2ZW50cyB3aWxsIGJlIGV2ZW50cyB3aGljaCBjYXB0dXJlIHRoZSBieXRlcyBmb3IgaW5kaXZpZHVhbCBQRVNcbiAqIHBhY2tldHMgcGx1cyByZWxldmFudCBtZXRhZGF0YSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIHRoZVxuICogY29udGFpbmVyLlxuICovXG5jbGFzcyBFbGVtZW50YXJ5U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuYXVkaW8gPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgdGhpcy52aWRlbyA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgfVxuXG4gIGZsdXNoU3RyZWFtKHN0cmVhbSwgdHlwZSkge1xuICAgIHZhclxuICAgICAgZXZlbnQgPSB7XG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGRhdGE6IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKSxcbiAgICAgIH0sXG4gICAgICBpID0gMCxcbiAgICAgIGZyYWdtZW50O1xuXG4gICAgLy8gZG8gbm90aGluZyBpZiB0aGVyZSBpcyBubyBidWZmZXJlZCBkYXRhXG4gICAgaWYgKCFzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZXZlbnQudHJhY2tJZCA9IHN0cmVhbS5kYXRhWzBdLnBpZDtcbiAgICBldmVudC5wdHMgPSBzdHJlYW0uZGF0YVswXS5wdHM7XG4gICAgZXZlbnQuZHRzID0gc3RyZWFtLmRhdGFbMF0uZHRzO1xuICAgIC8vIHJlYXNzZW1ibGUgdGhlIHBhY2tldFxuICAgIHdoaWxlIChzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgIGZyYWdtZW50ID0gc3RyZWFtLmRhdGEuc2hpZnQoKTtcblxuICAgICAgZXZlbnQuZGF0YS5zZXQoZnJhZ21lbnQuZGF0YSwgaSk7XG4gICAgICBpICs9IGZyYWdtZW50LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgc3RyZWFtLnNpemUgPSAwO1xuICAgIHRoaXMudHJpZ2dlcignZGF0YScsIGV2ZW50KTtcbiAgfVxuXG4gIHB1c2goZGF0YSkge1xuICAgIHN3aXRjaChkYXRhLnR5cGUpIHtcbiAgICAgIGNhc2UgJ3BhdCc6XG4gICAgICAgICAgLy8gd2UgaGF2ZSB0byB3YWl0IGZvciB0aGUgUE1UIHRvIGFycml2ZSBhcyB3ZWxsIGJlZm9yZSB3ZVxuICAgICAgICAgICAgLy8gaGF2ZSBhbnkgbWVhbmluZ2Z1bCBtZXRhZGF0YVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwbXQnOlxuICAgICAgICB2YXJcbiAgICAgICAgZXZlbnQgPSB7XG4gICAgICAgICAgdHlwZTogJ21ldGFkYXRhJyxcbiAgICAgICAgICB0cmFja3M6IFtdXG4gICAgICAgIH0sXG4gICAgICAgIHByb2dyYW1NYXBUYWJsZSA9IGRhdGEucHJvZ3JhbU1hcFRhYmxlLFxuICAgICAgICBrLFxuICAgICAgICB0cmFjaztcblxuICAgICAgICAvLyB0cmFuc2xhdGUgc3RyZWFtcyB0byB0cmFja3NcbiAgICAgICAgZm9yIChrIGluIHByb2dyYW1NYXBUYWJsZSkge1xuICAgICAgICAgIGlmIChwcm9ncmFtTWFwVGFibGUuaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgIHRyYWNrID0ge307XG4gICAgICAgICAgICB0cmFjay5pZCA9ICtrO1xuICAgICAgICAgICAgaWYgKHByb2dyYW1NYXBUYWJsZVtrXSA9PT0gSDI2NF9TVFJFQU1fVFlQRSkge1xuICAgICAgICAgICAgICB0cmFjay5jb2RlYyA9ICdhdmMnO1xuICAgICAgICAgICAgICB0cmFjay50eXBlID0gJ3ZpZGVvJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvZ3JhbU1hcFRhYmxlW2tdID09PSBBRFRTX1NUUkVBTV9UWVBFKSB7XG4gICAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gJ2FkdHMnO1xuICAgICAgICAgICAgICB0cmFjay50eXBlID0gJ2F1ZGlvJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LnRyYWNrcy5wdXNoKHRyYWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgZXZlbnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3Blcyc6XG4gICAgICAgIHZhciBzdHJlYW0sIHN0cmVhbVR5cGU7XG5cbiAgICAgICAgaWYgKGRhdGEuc3RyZWFtVHlwZSA9PT0gSDI2NF9TVFJFQU1fVFlQRSkge1xuICAgICAgICAgIHN0cmVhbSA9IHRoaXMudmlkZW87XG4gICAgICAgICAgc3RyZWFtVHlwZSA9ICd2aWRlbyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyZWFtID0gdGhpcy5hdWRpbztcbiAgICAgICAgICBzdHJlYW1UeXBlID0gJ2F1ZGlvJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIGEgbmV3IHBhY2tldCBpcyBzdGFydGluZywgd2UgY2FuIGZsdXNoIHRoZSBjb21wbGV0ZWRcbiAgICAgICAgLy8gcGFja2V0XG4gICAgICAgIGlmIChkYXRhLnBheWxvYWRVbml0U3RhcnRJbmRpY2F0b3IpIHtcbiAgICAgICAgICB0aGlzLmZsdXNoU3RyZWFtKHN0cmVhbSwgc3RyZWFtVHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gYnVmZmVyIHRoaXMgZnJhZ21lbnQgdW50aWwgd2UgYXJlIHN1cmUgd2UndmUgcmVjZWl2ZWQgdGhlXG4gICAgICAgIC8vIGNvbXBsZXRlIHBheWxvYWRcbiAgICAgICAgc3RyZWFtLmRhdGEucHVzaChkYXRhKTtcbiAgICAgICAgc3RyZWFtLnNpemUgKz0gZGF0YS5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgLyoqXG4gICAqIEZsdXNoIGFueSByZW1haW5pbmcgaW5wdXQuIFZpZGVvIFBFUyBwYWNrZXRzIG1heSBiZSBvZiB2YXJpYWJsZVxuICAgKiBsZW5ndGguIE5vcm1hbGx5LCB0aGUgc3RhcnQgb2YgYSBuZXcgdmlkZW8gcGFja2V0IGNhbiB0cmlnZ2VyIHRoZVxuICAgKiBmaW5hbGl6YXRpb24gb2YgdGhlIHByZXZpb3VzIHBhY2tldC4gVGhhdCBpcyBub3QgcG9zc2libGUgaWYgbm9cbiAgICogbW9yZSB2aWRlbyBpcyBmb3J0aGNvbWluZywgaG93ZXZlci4gSW4gdGhhdCBjYXNlLCBzb21lIG90aGVyXG4gICAqIG1lY2hhbmlzbSAobGlrZSB0aGUgZW5kIG9mIHRoZSBmaWxlKSBoYXMgdG8gYmUgZW1wbG95ZWQuIFdoZW4gaXQgaXNcbiAgICogY2xlYXIgdGhhdCBubyBhZGRpdGlvbmFsIGRhdGEgaXMgZm9ydGhjb21pbmcsIGNhbGxpbmcgdGhpcyBtZXRob2RcbiAgICogd2lsbCBmbHVzaCB0aGUgYnVmZmVyZWQgcGFja2V0cy5cbiAgICovXG4gIGVuZCgpIHtcbiAgICB0aGlzLmZsdXNoU3RyZWFtKHRoaXMudmlkZW8sICd2aWRlbycpO1xuICAgIHRoaXMuZmx1c2hTdHJlYW0odGhpcy5hdWRpbywgJ2F1ZGlvJyk7XG4gIH1cbn1cbi8qXG4gKiBBY2NlcHRzIGEgRWxlbWVudGFyeVN0cmVhbSBhbmQgZW1pdHMgZGF0YSBldmVudHMgd2l0aCBwYXJzZWRcbiAqIEFBQyBBdWRpbyBGcmFtZXMgb2YgdGhlIGluZGl2aWR1YWwgcGFja2V0cy5cbiAqL1xuY2xhc3MgQWFjU3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuYWR0c1NhbXBsZWluZ1JhdGVzID0gW1xuICAgIDk2MDAwLCA4ODIwMCxcbiAgICA2NDAwMCwgNDgwMDAsXG4gICAgNDQxMDAsIDMyMDAwLFxuICAgIDI0MDAwLCAyMjA1MCxcbiAgICAxNjAwMCwgMTIwMDBcbiAgXTtcbiAgfVxuXG4gIGdldEF1ZGlvU3BlY2lmaWNDb25maWcoZGF0YSkge1xuICAgIHZhciBhZHRzUHJvdGVjdGlvbkFic2VudCwgLy8gOkJvb2xlYW5cbiAgICAgICAgYWR0c09iamVjdFR5cGUsIC8vIDppbnRcbiAgICAgICAgYWR0c1NhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgYWR0c0ZyYW1lU2l6ZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlQ291bnQsIC8vIDppbnRcbiAgICAgICAgYWR0c0R1cmF0aW9uOyAvLyA6aW50XG5cbiAgICAgIC8vIGJ5dGUgMVxuICAgICAgYWR0c1Byb3RlY3Rpb25BYnNlbnQgPSAhIShkYXRhWzFdICYgMHgwMSk7XG5cbiAgICAgIC8vIGJ5dGUgMlxuICAgICAgYWR0c09iamVjdFR5cGUgPSAoKGRhdGFbMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgICAgYWR0c1NhbXBsZWluZ0luZGV4ID0gKChkYXRhWzJdICYgMHgzQykgPj4+IDIpO1xuICAgICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVsyXSAmIDB4MDEpIDw8IDIpO1xuXG4gICAgICAvLyBieXRlIDNcbiAgICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhWzNdICYgMHhDMCkgPj4+IDYpO1xuICAgICAgYWR0c0ZyYW1lU2l6ZSA9ICgoZGF0YVszXSAmIDB4MDMpIDw8IDExKTtcblxuICAgICAgLy8gYnl0ZSA0XG4gICAgICBhZHRzRnJhbWVTaXplIHw9IChkYXRhWzRdIDw8IDMpO1xuXG4gICAgICAvLyBieXRlIDVcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKChkYXRhWzVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgYWR0c0ZyYW1lU2l6ZSAtPSAoYWR0c1Byb3RlY3Rpb25BYnNlbnQgPyA3IDogOSk7XG5cbiAgICAgIC8vIGJ5dGUgNlxuICAgICAgYWR0c1NhbXBsZUNvdW50ID0gKChkYXRhWzZdICYgMHgwMykgKyAxKSAqIDEwMjQ7XG4gICAgICBhZHRzRHVyYXRpb24gPSAoYWR0c1NhbXBsZUNvdW50ICogMTAwMCkgLyB0aGlzLmFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdO1xuICAgICAgdGhpcy5jb25maWcgPSBuZXcgVWludDhBcnJheSgyKTtcbiAgICAvKiByZWZlciB0byBodHRwOi8vd2lraS5tdWx0aW1lZGlhLmN4L2luZGV4LnBocD90aXRsZT1NUEVHLTRfQXVkaW8jQXVkaW9fU3BlY2lmaWNfQ29uZmlnXG4gICAgICBBdWRpbyBQcm9maWxlXG4gICAgICAwOiBOdWxsXG4gICAgICAxOiBBQUMgTWFpblxuICAgICAgMjogQUFDIExDIChMb3cgQ29tcGxleGl0eSlcbiAgICAgIDM6IEFBQyBTU1IgKFNjYWxhYmxlIFNhbXBsZSBSYXRlKVxuICAgICAgNDogQUFDIExUUCAoTG9uZyBUZXJtIFByZWRpY3Rpb24pXG4gICAgICA1OiBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pXG4gICAgICA2OiBBQUMgU2NhbGFibGVcbiAgICAgc2FtcGxpbmcgZnJlcVxuICAgICAgMDogOTYwMDAgSHpcbiAgICAgIDE6IDg4MjAwIEh6XG4gICAgICAyOiA2NDAwMCBIelxuICAgICAgMzogNDgwMDAgSHpcbiAgICAgIDQ6IDQ0MTAwIEh6XG4gICAgICA1OiAzMjAwMCBIelxuICAgICAgNjogMjQwMDAgSHpcbiAgICAgIDc6IDIyMDUwIEh6XG4gICAgICA4OiAxNjAwMCBIelxuICAgICAgOTogMTIwMDAgSHpcbiAgICAgIDEwOiAxMTAyNSBIelxuICAgICAgMTE6IDgwMDAgSHpcbiAgICAgIDEyOiA3MzUwIEh6XG4gICAgICAxMzogUmVzZXJ2ZWRcbiAgICAgIDE0OiBSZXNlcnZlZFxuICAgICAgMTU6IGZyZXF1ZW5jeSBpcyB3cml0dGVuIGV4cGxpY3RseVxuICAgIENoYW5uZWwgQ29uZmlndXJhdGlvbnNcbiAgICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAgIDA6IERlZmluZWQgaW4gQU9UIFNwZWNpZmMgQ29uZmlnXG4gICAgICAxOiAxIGNoYW5uZWw6IGZyb250LWNlbnRlclxuICAgICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgICAqL1xuICAgICAgLy8gYXVkaW9PYmplY3RUeXBlID0gcHJvZmlsZSA9PiBwcm9maWxlLCB0aGUgTVBFRy00IEF1ZGlvIE9iamVjdCBUeXBlIG1pbnVzIDFcbiAgICAgIHRoaXMuY29uZmlnWzBdID0gYWR0c09iamVjdFR5cGUgPDwgMztcblxuICAgICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgICAgdGhpcy5jb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICB0aGlzLmNvbmZpZ1sxXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcblxuICAgICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICAgIHRoaXMuY29uZmlnWzFdIHw9IGFkdHNDaGFuZWxDb25maWcgPDwgMztcblxuICAgICAgdGhpcy5zdGVyZW8gPSAoMiA9PT0gYWR0c0NoYW5lbENvbmZpZyk7XG4gICAgICB0aGlzLmF1ZGlvc2FtcGxlcmF0ZSA9IHRoaXMuYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF07XG4gIH1cblxuICBwdXNoKHBhY2tldCkge1xuXG4gICAgaWYgKHBhY2tldC50eXBlID09PSAnYXVkaW8nICYmIHBhY2tldC5kYXRhICE9PSB1bmRlZmluZWQpIHtcblxuICAgICAgdmFyIGFhY0ZyYW1lLCAvLyA6RnJhbWUgPSBudWxsO1xuICAgICAgICBuZXh0UFRTID0gcGFja2V0LnB0cyxcbiAgICAgICAgZGF0YSA9IHBhY2tldC5kYXRhO1xuXG4gICAgICAvLyBieXRlIDBcbiAgICAgIGlmICgweEZGICE9PSBkYXRhWzBdKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcignRXJyb3Igbm8gQVREUyBoZWFkZXIgZm91bmQnKTtcbiAgICAgIH1cblxuICAgICAgaWYodGhpcy5jb25maWcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLmdldEF1ZGlvU3BlY2lmaWNDb25maWcoZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIGFhY0ZyYW1lID0ge307XG4gICAgICBhYWNGcmFtZS5wdHMgPSBuZXh0UFRTO1xuICAgICAgYWFjRnJhbWUuZHRzID0gbmV4dFBUUztcbiAgICAgIGFhY0ZyYW1lLmJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoKTtcblxuICAgICAgLy8gQUFDIGlzIGFsd2F5cyAxMFxuICAgICAgYWFjRnJhbWUuYXVkaW9jb2RlY2lkID0gMTA7XG4gICAgICBhYWNGcmFtZS5zdGVyZW8gPSB0aGlzLnN0ZXJlbztcbiAgICAgIGFhY0ZyYW1lLmF1ZGlvc2FtcGxlcmF0ZSA9IHRoaXMuYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgLy8gSXMgQUFDIGFsd2F5cyAxNiBiaXQ/XG4gICAgICBhYWNGcmFtZS5hdWRpb3NhbXBsZXNpemUgPSAxNjtcbiAgICAgIGFhY0ZyYW1lLmJ5dGVzID0gcGFja2V0LmRhdGEuc3ViYXJyYXkoNywgcGFja2V0LmRhdGEubGVuZ3RoKTtcbiAgICAgIHBhY2tldC5mcmFtZSA9IGFhY0ZyYW1lO1xuICAgICAgcGFja2V0LmNvbmZpZyA9IHRoaXMuY29uZmlnO1xuICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgcGFja2V0KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBY2NlcHRzIGEgTkFMIHVuaXQgYnl0ZSBzdHJlYW0gYW5kIHVucGFja3MgdGhlIGVtYmVkZGVkIE5BTCB1bml0cy5cbiAqL1xuY2xhc3MgTmFsQnl0ZVN0cmVhbSBleHRlbmRzIFN0cmVhbSB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4PTY7XG4gICAgdGhpcy5zeW5jUG9pbnQgPTE7XG4gICAgdGhpcy5idWZmZXIgPSBudWxsO1xuICB9XG5cbiAgcHVzaCAoZGF0YSkge1xuICAgIHZhciBzd2FwQnVmZmVyO1xuXG4gICAgaWYgKCF0aGlzLmJ1ZmZlcikge1xuICAgICAgdGhpcy5idWZmZXIgPSBkYXRhLmRhdGE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3YXBCdWZmZXIgPSBuZXcgVWludDhBcnJheSh0aGlzLmJ1ZmZlci5ieXRlTGVuZ3RoICsgZGF0YS5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgc3dhcEJ1ZmZlci5zZXQodGhpcy5idWZmZXIpO1xuICAgICAgc3dhcEJ1ZmZlci5zZXQoZGF0YS5kYXRhLCB0aGlzLmJ1ZmZlci5ieXRlTGVuZ3RoKTtcbiAgICAgIHRoaXMuYnVmZmVyID0gc3dhcEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvLyBSZWMuIElUVS1UIEguMjY0LCBBbm5leCBCXG4gICAgLy8gc2NhbiBmb3IgTkFMIHVuaXQgYm91bmRhcmllc1xuXG4gICAgLy8gYSBtYXRjaCBsb29rcyBsaWtlIHRoaXM6XG4gICAgLy8gMCAwIDEgLi4gTkFMIC4uIDAgMCAxXG4gICAgLy8gXiBzeW5jIHBvaW50ICAgICAgICBeIGlcbiAgICAvLyBvciB0aGlzOlxuICAgIC8vIDAgMCAxIC4uIE5BTCAuLiAwIDAgMFxuICAgIC8vIF4gc3luYyBwb2ludCAgICAgICAgXiBpXG4gICAgdmFyIGkgPSB0aGlzLmluZGV4O1xuICAgIHZhciBzeW5jID0gdGhpcy5zeW5jUG9pbnQ7XG4gICAgdmFyIGJ1ZiA9IHRoaXMuYnVmZmVyO1xuICAgIHdoaWxlIChpIDwgYnVmLmJ5dGVMZW5ndGgpIHtcbiAgICAgIHN3aXRjaCAoYnVmW2ldKSB7XG4gICAgICBjYXNlIDA6XG4gICAgICAgIC8vIHNraXAgcGFzdCBub24tc3luYyBzZXF1ZW5jZXNcbiAgICAgICAgaWYgKGJ1ZltpIC0gMV0gIT09IDApIHtcbiAgICAgICAgICBpICs9IDI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAoYnVmW2kgLSAyXSAhPT0gMCkge1xuICAgICAgICAgIGkrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGl2ZXIgdGhlIE5BTCB1bml0XG4gICAgICAgIHRoaXMudHJpZ2dlcignZGF0YScsIGJ1Zi5zdWJhcnJheShzeW5jICsgMywgaSAtIDIpKTtcblxuICAgICAgICAvLyBkcm9wIHRyYWlsaW5nIHplcm9lc1xuICAgICAgICBkbyB7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9IHdoaWxlIChidWZbaV0gIT09IDEpO1xuICAgICAgICBzeW5jID0gaSAtIDI7XG4gICAgICAgIGkgKz0gMztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIC8vIHNraXAgcGFzdCBub24tc3luYyBzZXF1ZW5jZXNcbiAgICAgICAgaWYgKGJ1ZltpIC0gMV0gIT09IDAgfHxcbiAgICAgICAgICAgIGJ1ZltpIC0gMl0gIT09IDApIHtcbiAgICAgICAgICBpICs9IDM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWxpdmVyIHRoZSBOQUwgdW5pdFxuICAgICAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCBidWYuc3ViYXJyYXkoc3luYyArIDMsIGkgLSAyKSk7XG4gICAgICAgIHN5bmMgPSBpIC0gMjtcbiAgICAgICAgaSArPSAzO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGkgKz0gMztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGZpbHRlciBvdXQgdGhlIE5BTCB1bml0cyB0aGF0IHdlcmUgZGVsaXZlcmVkXG4gICAgdGhpcy5idWZmZXIgPSBidWYuc3ViYXJyYXkoc3luYyk7XG4gICAgaSAtPSBzeW5jO1xuICAgIHRoaXMuaW5kZXggPSBpO1xuICAgIHRoaXMuc3luY1BvaW50ID0gMDtcbiAgfVxuXG4gIGVuZCgpIHtcbiAgICAvLyBkZWxpdmVyIHRoZSBsYXN0IGJ1ZmZlcmVkIE5BTCB1bml0XG4gICAgaWYgKHRoaXMuYnVmZmVyLmJ5dGVMZW5ndGggPiAzKSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCB0aGlzLmJ1ZmZlci5zdWJhcnJheSh0aGlzLnN5bmNQb2ludCArIDMpKTtcbiAgICB9XG4gICAgdGhpcy5idWZmZXIgPSBudWxsO1xuICAgIHRoaXMuaW5kZXggPSA2O1xuICAgIHRoaXMuc3luY1BvaW50ID0gMTtcbiAgfVxufVxuLyoqXG4gKiBBY2NlcHRzIGlucHV0IGZyb20gYSBFbGVtZW50YXJ5U3RyZWFtIGFuZCBwcm9kdWNlcyBILjI2NCBOQUwgdW5pdCBkYXRhXG4gKiBldmVudHMuXG4gKi9cbmNsYXNzIEgyNjRTdHJlYW0gZXh0ZW5kcyBTdHJlYW0ge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtID0gbmV3IE5hbEJ5dGVTdHJlYW0oKTtcbiAgICB0aGlzLm5hbEJ5dGVTdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIGV2ZW50ID0ge1xuICAgICAgdHJhY2tJZDogdGhpcy50cmFja0lkLFxuICAgICAgcHRzOiB0aGlzLmN1cnJlbnRQdHMsXG4gICAgICBkdHM6IHRoaXMuY3VycmVudER0cyxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9O1xuICAgIHN3aXRjaCAoZGF0YVswXSAmIDB4MWYpIHtcbiAgICBjYXNlIDB4MDU6XG4gICAgICBldmVudC5uYWxVbml0VHlwZSA9ICdJRFInO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAweDA3OlxuICAgICAgZXZlbnQubmFsVW5pdFR5cGUgPSAnU1BTJztcbiAgICAgIHZhciBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYihkYXRhLnN1YmFycmF5KDEpKTtcbiAgICAgIGV2ZW50LmNvbmZpZyA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFNlcXVlbmNlUGFyYW1ldGVyU2V0KCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDB4MDg6XG4gICAgICBldmVudC5uYWxVbml0VHlwZSA9ICdQUFMnO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAweDA5OlxuICAgICAgZXZlbnQubmFsVW5pdFR5cGUgPSAnQVVEJztcbiAgICAgIGJyZWFrO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCBldmVudCk7XG4gIH0uYmluZCh0aGlzKSk7XG4gIH1cblxuICBwdXNoKHBhY2tldCkge1xuICAgIGlmIChwYWNrZXQudHlwZSAhPT0gJ3ZpZGVvJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnRyYWNrSWQgPSBwYWNrZXQudHJhY2tJZDtcbiAgICB0aGlzLmN1cnJlbnRQdHMgPSBwYWNrZXQucHRzO1xuICAgIHRoaXMuY3VycmVudER0cyA9IHBhY2tldC5kdHM7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtLnB1c2gocGFja2V0KTtcbiAgfVxuXG4gIGVuZCgpIHtcbiAgICB0aGlzLm5hbEJ5dGVTdHJlYW0uZW5kKCk7XG4gIH1cblxufVxuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBzaW5nbGUtdHJhY2ssIElTTyBCTUZGIG1lZGlhIHNlZ21lbnQgZnJvbSBIMjY0IGRhdGFcbiAqIGV2ZW50cy4gVGhlIG91dHB1dCBvZiB0aGlzIHN0cmVhbSBjYW4gYmUgZmVkIHRvIGEgU291cmNlQnVmZmVyXG4gKiBjb25maWd1cmVkIHdpdGggYSBzdWl0YWJsZSBpbml0aWFsaXphdGlvbiBzZWdtZW50LlxuICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IHRyYWNrIG1ldGFkYXRhIGNvbmZpZ3VyYXRpb25cbiAqL1xuY2xhc3MgVmlkZW9TZWdtZW50U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3Rvcih0cmFjaykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zZXF1ZW5jZU51bWJlciA9IDA7XG4gICAgdGhpcy5uYWxVbml0cyA9IFtdO1xuICAgIHRoaXMubmFsVW5pdHNMZW5ndGggPSAwO1xuICAgIHRoaXMudHJhY2sgPSB0cmFjaztcbiAgfVxuXG4gIHB1c2goZGF0YSkge1xuICAgIC8vIGJ1ZmZlciB2aWRlbyB1bnRpbCBlbmQoKSBpcyBjYWxsZWRcbiAgICB0aGlzLm5hbFVuaXRzLnB1c2goZGF0YSk7XG4gICAgdGhpcy5uYWxVbml0c0xlbmd0aCArPSBkYXRhLmRhdGEuYnl0ZUxlbmd0aDtcbiAgfVxuXG4gIGVuZCgpIHtcbiAgICB2YXIgc3RhcnRVbml0LCBjdXJyZW50TmFsLCBtb29mLCBtZGF0LCBib3hlcywgaSwgZGF0YSwgdmlldywgc2FtcGxlLCBzdGFydGR0cztcblxuICAgIC8vIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXRcbiAgICAvLyBmaXJzdCwgd2UgaGF2ZSB0byBidWlsZCB0aGUgaW5kZXggZnJvbSBieXRlIGxvY2F0aW9ucyB0b1xuICAgIC8vIHNhbXBsZXMgKHRoYXQgaXMsIGZyYW1lcykgaW4gdGhlIHZpZGVvIGRhdGFcbiAgICBkYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5uYWxVbml0c0xlbmd0aCArICg0ICogdGhpcy5uYWxVbml0cy5sZW5ndGgpKTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGRhdGEuYnVmZmVyKTtcbiAgICB0aGlzLnRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICBzYW1wbGUgPSB7XG4gICAgICBzaXplOiAwLFxuICAgICAgZmxhZ3M6IHtcbiAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgaXNOb25TeW5jU2FtcGxlIDogMSxcbiAgICAgICAgZGVncmFkYXRpb25Qcmlvcml0eTogMFxuICAgICAgfVxuICAgIH07XG4gICAgaSA9IDA7XG4gICAgc3RhcnRkdHMgPSB0aGlzLm5hbFVuaXRzWzBdLmR0cztcbiAgICBpZih0aGlzLmluaXREdHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5pbml0RHRzID0gc3RhcnRkdHM7XG4gICAgfVxuICAgIHdoaWxlICh0aGlzLm5hbFVuaXRzLmxlbmd0aCkge1xuICAgICAgY3VycmVudE5hbCA9IHRoaXMubmFsVW5pdHNbMF07XG4gICAgICAvLyBmbHVzaCB0aGUgc2FtcGxlIHdlJ3ZlIGJlZW4gYnVpbGRpbmcgd2hlbiBhIG5ldyBzYW1wbGUgaXMgc3RhcnRlZFxuICAgICAgaWYgKGN1cnJlbnROYWwubmFsVW5pdFR5cGUgPT09ICdBVUQnKSB7XG4gICAgICAgIGlmIChzdGFydFVuaXQpIHtcbiAgICAgICAgICAvLyBjb252ZXJ0IHRoZSBkdXJhdGlvbiB0byA5MGtIWiB0aW1lc2NhbGUgdG8gbWF0Y2ggdGhlXG4gICAgICAgICAgLy8gdGltZXNjYWxlcyBzcGVjaWZpZWQgaW4gdGhlIGluaXQgc2VnbWVudFxuICAgICAgICAgIHNhbXBsZS5kdXJhdGlvbiA9IChjdXJyZW50TmFsLmR0cyAtIHN0YXJ0VW5pdC5kdHMpICogOTA7XG4gICAgICAgICAgdGhpcy50cmFjay5zYW1wbGVzLnB1c2goc2FtcGxlKTtcbiAgICAgICAgfVxuICAgICAgICBzYW1wbGUgPSB7XG4gICAgICAgICAgc2l6ZTogMCxcbiAgICAgICAgICBmbGFnczoge1xuICAgICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICAgIGlzTm9uU3luY1NhbXBsZSA6IDEsXG4gICAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiBjdXJyZW50TmFsLnB0cyAtIGN1cnJlbnROYWwuZHRzXG4gICAgICAgIH07XG4gICAgICAgIHN0YXJ0VW5pdCA9IGN1cnJlbnROYWw7XG4gICAgICB9XG4gICAgICBpZiAoY3VycmVudE5hbC5uYWxVbml0VHlwZSA9PT0gJ0lEUicpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIHNhbXBsZS5mbGFncy5kZXBlbmRzT24gPSAyO1xuICAgICAgICBzYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlID0gMDtcbiAgICAgIH1cbiAgICAgIHNhbXBsZS5zaXplICs9IDQ7IC8vIHNwYWNlIGZvciB0aGUgTkFMIGxlbmd0aFxuICAgICAgc2FtcGxlLnNpemUgKz0gY3VycmVudE5hbC5kYXRhLmJ5dGVMZW5ndGg7XG5cbiAgICAgIHZpZXcuc2V0VWludDMyKGksIGN1cnJlbnROYWwuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIGkgKz0gNDtcbiAgICAgIGRhdGEuc2V0KGN1cnJlbnROYWwuZGF0YSwgaSk7XG4gICAgICBpICs9IGN1cnJlbnROYWwuZGF0YS5ieXRlTGVuZ3RoO1xuXG4gICAgICB0aGlzLm5hbFVuaXRzLnNoaWZ0KCk7XG4gICAgfVxuICAgIC8vIHJlY29yZCB0aGUgbGFzdCBzYW1wbGVcbiAgICBpZiAodGhpcy50cmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgc2FtcGxlLmR1cmF0aW9uID0gdGhpcy50cmFjay5zYW1wbGVzW3RoaXMudHJhY2suc2FtcGxlcy5sZW5ndGggLSAxXS5kdXJhdGlvbjtcbiAgICB9XG4gICAgdGhpcy50cmFjay5zYW1wbGVzLnB1c2goc2FtcGxlKTtcbiAgICB0aGlzLm5hbFVuaXRzTGVuZ3RoID0gMDtcbiAgICBtZGF0ID0gTVA0Lm1kYXQoZGF0YSk7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRoaXMuc2VxdWVuY2VOdW1iZXIsKHN0YXJ0ZHRzIC0gdGhpcy5pbml0RHRzKSo5MCx0aGlzLnRyYWNrKTtcbiAgICAvLyBpdCB3b3VsZCBiZSBncmVhdCB0byBhbGxvY2F0ZSB0aGlzIGFycmF5IHVwIGZyb250IGluc3RlYWQgb2ZcbiAgICAvLyB0aHJvd2luZyBhd2F5IGh1bmRyZWRzIG9mIG1lZGlhIHNlZ21lbnQgZnJhZ21lbnRzXG4gICAgYm94ZXMgPSBuZXcgVWludDhBcnJheShtb29mLmJ5dGVMZW5ndGggKyBtZGF0LmJ5dGVMZW5ndGgpO1xuXG4gICAgLy8gYnVtcCB0aGUgc2VxdWVuY2UgbnVtYmVyIGZvciBuZXh0IHRpbWVcbiAgICB0aGlzLnNlcXVlbmNlTnVtYmVyKys7XG5cbiAgICBib3hlcy5zZXQobW9vZik7XG4gICAgYm94ZXMuc2V0KG1kYXQsIG1vb2YuYnl0ZUxlbmd0aCk7XG5cbiAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCBib3hlcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgc2luZ2xlLXRyYWNrLCBJU08gQk1GRiBtZWRpYSBzZWdtZW50IGZyb20gQUFDIGRhdGFcbiAqIGV2ZW50cy4gVGhlIG91dHB1dCBvZiB0aGlzIHN0cmVhbSBjYW4gYmUgZmVkIHRvIGEgU291cmNlQnVmZmVyXG4gKiBjb25maWd1cmVkIHdpdGggYSBzdWl0YWJsZSBpbml0aWFsaXphdGlvbiBzZWdtZW50LlxuICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IHRyYWNrIG1ldGFkYXRhIGNvbmZpZ3VyYXRpb25cbiAqL1xuY2xhc3MgQXVkaW9TZWdtZW50U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3Rvcih0cmFjaykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zZXF1ZW5jZU51bWJlciA9IDA7XG4gICAgdGhpcy5hYWNVbml0cyA9IFtdO1xuICAgIHRoaXMuYWFjVW5pdHNMZW5ndGggPSAwO1xuICAgIHRoaXMudHJhY2sgPSB0cmFjaztcbiAgfVxuXG4gIHB1c2goZGF0YSkge1xuICAgIC8vcmVtb3ZlIEFEVFMgaGVhZGVyXG4gICAgZGF0YS5kYXRhID0gZGF0YS5kYXRhLnN1YmFycmF5KDcpO1xuICAgIC8vIGJ1ZmZlciBhdWRpbyB1bnRpbCBlbmQoKSBpcyBjYWxsZWRcbiAgICB0aGlzLmFhY1VuaXRzLnB1c2goZGF0YSk7XG4gICAgdGhpcy5hYWNVbml0c0xlbmd0aCArPSBkYXRhLmRhdGEuYnl0ZUxlbmd0aDtcbiAgfVxuXG4gIGVuZCgpIHtcbiAgICB2YXIgZGF0YSwgdmlldywgaSwgY3VycmVudFVuaXQsIHN0YXJ0VW5pdER0cywgbGFzdFVuaXQsIG1kYXQsIG1vb2YsIGJveGVzO1xuICAgIC8vIC8vIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXRcbiAgICAvLyAvLyBmaXJzdCwgd2UgaGF2ZSB0byBidWlsZCB0aGUgaW5kZXggZnJvbSBieXRlIGxvY2F0aW9ucyB0b1xuICAgIC8vIC8vIHNhbXBsZXMgKHRoYXQgaXMsIGZyYW1lcykgaW4gdGhlIGF1ZGlvIGRhdGFcbiAgICBkYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5hYWNVbml0c0xlbmd0aCk7XG4gICAgdmlldyA9IG5ldyBEYXRhVmlldyhkYXRhLmJ1ZmZlcik7XG4gICAgdGhpcy50cmFjay5zYW1wbGVzID0gW107XG4gICAgdmFyIHNhbXBsZSA9IHtcbiAgICAgIHNpemU6IHRoaXMuYWFjVW5pdHNbMF0uZGF0YS5ieXRlTGVuZ3RoLFxuICAgICAgZmxhZ3M6IHtcbiAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgZGVncmFkYXRpb25Qcmlvcml0eTogMFxuICAgICAgfSxcbiAgICAgIGNvbXBvc2l0aW9uVGltZU9mZnNldDogMFxuICAgIH07XG4gICAgaSA9IDA7XG4gICAgc3RhcnRVbml0RHRzID0gdGhpcy5hYWNVbml0c1swXS5kdHM7XG4gICAgaWYodGhpcy5pbml0RHRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuaW5pdER0cyA9IHN0YXJ0VW5pdER0cztcbiAgICB9XG4gICAgbGFzdFVuaXQgPSBudWxsO1xuICAgIHdoaWxlICh0aGlzLmFhY1VuaXRzLmxlbmd0aCkge1xuICAgICAgY3VycmVudFVuaXQgPSB0aGlzLmFhY1VuaXRzWzBdO1xuICAgICAgaWYobGFzdFVuaXQgIT0gbnVsbCkge1xuICAgICAgICAvL2ZsdXNoIHByZXZpb3VzIHNhbXBsZSwgdXBkYXRlIGl0cyBkdXJhdGlvbiBiZWZvcmVoYW5kXG4gICAgICAgICAgc2FtcGxlLmR1cmF0aW9uID0gKGN1cnJlbnRVbml0LmR0cyAtIGxhc3RVbml0LmR0cykgKiA5MDtcbiAgICAgICAgICB0aGlzLnRyYWNrLnNhbXBsZXMucHVzaChzYW1wbGUpO1xuICAgICAgICAgIHNhbXBsZSA9IHtcbiAgICAgICAgICAgIHNpemU6IGN1cnJlbnRVbml0LmRhdGEuYnl0ZUxlbmd0aCxcbiAgICAgICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDBcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21wb3NpdGlvblRpbWVPZmZzZXQ6IDBcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIC8vdmlldy5zZXRVaW50MzIoaSwgY3VycmVudFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgLy9pICs9IDQ7XG4gICAgICAgIGRhdGEuc2V0KGN1cnJlbnRVbml0LmRhdGEsIGkpO1xuICAgICAgICBpICs9IGN1cnJlbnRVbml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgdGhpcy5hYWNVbml0cy5zaGlmdCgpO1xuICAgICAgICBsYXN0VW5pdCA9IGN1cnJlbnRVbml0O1xuICAgIH1cbiAgICAvLyByZWNvcmQgdGhlIGxhc3Qgc2FtcGxlXG4gICAgaWYgKHRoaXMudHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHNhbXBsZS5kdXJhdGlvbiA9IHRoaXMudHJhY2suc2FtcGxlc1t0aGlzLnRyYWNrLnNhbXBsZXMubGVuZ3RoIC0gMV0uZHVyYXRpb247XG4gICAgICB0aGlzLnRyYWNrLnNhbXBsZXMucHVzaChzYW1wbGUpO1xuICAgIH1cbiAgICB0aGlzLmFhY1VuaXRzTGVuZ3RoID0gMDtcbiAgICBtZGF0ID0gTVA0Lm1kYXQoZGF0YSk7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRoaXMuc2VxdWVuY2VOdW1iZXIsKHN0YXJ0VW5pdER0cyAtIHRoaXMuaW5pdER0cykqOTAsdGhpcy50cmFjayk7XG4gICAgLy8gaXQgd291bGQgYmUgZ3JlYXQgdG8gYWxsb2NhdGUgdGhpcyBhcnJheSB1cCBmcm9udCBpbnN0ZWFkIG9mXG4gICAgLy8gdGhyb3dpbmcgYXdheSBodW5kcmVkcyBvZiBtZWRpYSBzZWdtZW50IGZyYWdtZW50c1xuICAgIGJveGVzID0gbmV3IFVpbnQ4QXJyYXkobW9vZi5ieXRlTGVuZ3RoICsgbWRhdC5ieXRlTGVuZ3RoKTtcblxuICAgIC8vIGJ1bXAgdGhlIHNlcXVlbmNlIG51bWJlciBmb3IgbmV4dCB0aW1lXG4gICAgdGhpcy5zZXF1ZW5jZU51bWJlcisrO1xuICAgIGJveGVzLnNldChtb29mKTtcbiAgICBib3hlcy5zZXQobWRhdCwgbW9vZi5ieXRlTGVuZ3RoKTtcblxuICAgIHRoaXMudHJpZ2dlcignZGF0YScsIGJveGVzKTtcbiAgfVxufVxuXG4vKipcbiAqIEEgU3RyZWFtIHRoYXQgZXhwZWN0cyBNUDJUIGJpbmFyeSBkYXRhIGFzIGlucHV0IGFuZCBwcm9kdWNlc1xuICogY29ycmVzcG9uZGluZyBtZWRpYSBzZWdtZW50cywgc3VpdGFibGUgZm9yIHVzZSB3aXRoIE1lZGlhIFNvdXJjZVxuICogRXh0ZW5zaW9uIChNU0UpIGltcGxlbWVudGF0aW9ucyB0aGF0IHN1cHBvcnQgdGhlIElTTyBCTUZGIGJ5dGVcbiAqIHN0cmVhbSBmb3JtYXQsIGxpa2UgQ2hyb21lLlxuICogQHNlZSB0ZXN0L211eGVyL21zZS1kZW1vLmh0bWwgZm9yIHNhbXBsZSB1c2FnZSBvZiBhIFRyYW5zbXV4ZXIgd2l0aFxuICogTVNFXG4gKi9cblxuXG52YXIgcGFja2V0U3RyZWFtLHBhcnNlU3RyZWFtLCBlbGVtZW50YXJ5U3RyZWFtLCBhYWNTdHJlYW0sIGgyNjRTdHJlYW0sXG4gICAgYXVkaW9TZWdtZW50U3RyZWFtLCB2aWRlb1NlZ21lbnRTdHJlYW0sXG4gICAgY29uZmlnQXVkaW8sIGNvbmZpZ1ZpZGVvLFxuICAgIHRyYWNrVmlkZW8sIHRyYWNrQXVkaW8sX2R1cmF0aW9uLFxuICAgIHBwcztcblxuY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICAvLyBzZXQgdXAgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgICBwYWNrZXRTdHJlYW0gPSBuZXcgVHJhbnNwb3J0UGFja2V0U3RyZWFtKCk7XG4gICAgcGFyc2VTdHJlYW0gPSBuZXcgVHJhbnNwb3J0UGFyc2VTdHJlYW0oKTtcbiAgICBlbGVtZW50YXJ5U3RyZWFtID0gbmV3IEVsZW1lbnRhcnlTdHJlYW0oKTtcbiAgICBhYWNTdHJlYW0gPSBuZXcgQWFjU3RyZWFtKCk7XG4gICAgaDI2NFN0cmVhbSA9IG5ldyBIMjY0U3RyZWFtKCk7XG5cbiAgICBwYWNrZXRTdHJlYW0ucGlwZShwYXJzZVN0cmVhbSk7XG4gICAgcGFyc2VTdHJlYW0ucGlwZShlbGVtZW50YXJ5U3RyZWFtKTtcbiAgICBlbGVtZW50YXJ5U3RyZWFtLnBpcGUoYWFjU3RyZWFtKTtcbiAgICBlbGVtZW50YXJ5U3RyZWFtLnBpcGUoaDI2NFN0cmVhbSk7XG5cbiAgICAvLyBoYW5kbGUgaW5jb21pbmcgZGF0YSBldmVudHNcbiAgICBhYWNTdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBpZighY29uZmlnQXVkaW8pIHtcbiAgICAgICAgdHJhY2tBdWRpby5jb25maWcgPSBjb25maWdBdWRpbyA9IGRhdGEuY29uZmlnO1xuICAgICAgICB0cmFja0F1ZGlvLmF1ZGlvc2FtcGxlcmF0ZSA9IGRhdGEuYXVkaW9zYW1wbGVyYXRlO1xuICAgICAgICB0cmFja0F1ZGlvLmR1cmF0aW9uID0gOTAwMDAqX2R1cmF0aW9uO1xuICAgICAgICBpZiAoY29uZmlnVmlkZW8pIHtcbiAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR01FTlRfUEFSU0VELHtcbiAgICAgICAgICAgIGRhdGE6IE1QNC5pbml0U2VnbWVudChbdHJhY2tWaWRlbyx0cmFja0F1ZGlvXSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaDI2NFN0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIC8vIHJlY29yZCB0aGUgdHJhY2sgY29uZmlnXG4gICAgICBpZiAoZGF0YS5uYWxVbml0VHlwZSA9PT0gJ1NQUycgJiZcbiAgICAgICAgIWNvbmZpZ1ZpZGVvKSB7XG4gICAgICAgIGNvbmZpZ1ZpZGVvID0gZGF0YS5jb25maWc7XG5cbiAgICAgIHRyYWNrVmlkZW8ud2lkdGggPSBjb25maWdWaWRlby53aWR0aDtcbiAgICAgIHRyYWNrVmlkZW8uaGVpZ2h0ID0gY29uZmlnVmlkZW8uaGVpZ2h0O1xuICAgICAgdHJhY2tWaWRlby5zcHMgPSBbZGF0YS5kYXRhXTtcbiAgICAgIHRyYWNrVmlkZW8ucHJvZmlsZUlkYyA9IGNvbmZpZ1ZpZGVvLnByb2ZpbGVJZGM7XG4gICAgICB0cmFja1ZpZGVvLmxldmVsSWRjID0gY29uZmlnVmlkZW8ubGV2ZWxJZGM7XG4gICAgICB0cmFja1ZpZGVvLnByb2ZpbGVDb21wYXRpYmlsaXR5ID0gY29uZmlnVmlkZW8ucHJvZmlsZUNvbXBhdGliaWxpdHk7XG4gICAgICB0cmFja1ZpZGVvLmR1cmF0aW9uID0gOTAwMDAqX2R1cmF0aW9uO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlIGFuIGluaXQgc2VnbWVudCBvbmNlIGFsbCB0aGUgbWV0YWRhdGEgaXMgYXZhaWxhYmxlXG4gICAgICAgIGlmIChwcHMpIHtcbiAgICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR01FTlRfUEFSU0VELHtcbiAgICAgICAgICAgIGRhdGE6IE1QNC5pbml0U2VnbWVudChbdHJhY2tWaWRlbyx0cmFja0F1ZGlvXSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGRhdGEubmFsVW5pdFR5cGUgPT09ICdQUFMnICYmXG4gICAgICAgICFwcHMpIHtcbiAgICAgICAgICBwcHMgPSBkYXRhLmRhdGE7XG4gICAgICAgICAgdHJhY2tWaWRlby5wcHMgPSBbZGF0YS5kYXRhXTtcblxuICAgICAgICAgIGlmIChjb25maWdWaWRlbyAmJiBjb25maWdBdWRpbykge1xuICAgICAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHTUVOVF9QQVJTRUQse1xuICAgICAgICAgICAgICBkYXRhOiBNUDQuaW5pdFNlZ21lbnQoW3RyYWNrVmlkZW8sdHJhY2tBdWRpb10pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIC8vIGhvb2sgdXAgdGhlIHZpZGVvIHNlZ21lbnQgc3RyZWFtIG9uY2UgdHJhY2sgbWV0YWRhdGEgaXMgZGVsaXZlcmVkXG4gICAgZWxlbWVudGFyeVN0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBpLCB0cmlnZ2VyRGF0YSA9IGZ1bmN0aW9uKHNlZ21lbnQpIHtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHTUVOVF9QQVJTRUQse1xuICAgICAgICAgIGRhdGE6IHNlZ21lbnRcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaWYgKGRhdGEudHlwZSA9PT0gJ21ldGFkYXRhJykge1xuICAgICAgICBpID0gZGF0YS50cmFja3MubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgaWYgKGRhdGEudHJhY2tzW2ldLnR5cGUgPT09ICd2aWRlbycpIHtcbiAgICAgICAgICAgIHRyYWNrVmlkZW8gPSBkYXRhLnRyYWNrc1tpXTtcbiAgICAgICAgICAgIGlmICghdmlkZW9TZWdtZW50U3RyZWFtKSB7XG4gICAgICAgICAgICAgIHZpZGVvU2VnbWVudFN0cmVhbSA9IG5ldyBWaWRlb1NlZ21lbnRTdHJlYW0odHJhY2tWaWRlbyk7XG4gICAgICAgICAgICAgIGgyNjRTdHJlYW0ucGlwZSh2aWRlb1NlZ21lbnRTdHJlYW0pO1xuICAgICAgICAgICAgICB2aWRlb1NlZ21lbnRTdHJlYW0ub24oJ2RhdGEnLCB0cmlnZ2VyRGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChkYXRhLnRyYWNrc1tpXS50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICAgICAgICAgIHRyYWNrQXVkaW8gPSBkYXRhLnRyYWNrc1tpXTtcbiAgICAgICAgICAgICAgaWYgKCFhdWRpb1NlZ21lbnRTdHJlYW0pIHtcbiAgICAgICAgICAgICAgICBhdWRpb1NlZ21lbnRTdHJlYW0gPSBuZXcgQXVkaW9TZWdtZW50U3RyZWFtKHRyYWNrQXVkaW8pO1xuICAgICAgICAgICAgICAgIGFhY1N0cmVhbS5waXBlKGF1ZGlvU2VnbWVudFN0cmVhbSk7XG4gICAgICAgICAgICAgICAgYXVkaW9TZWdtZW50U3RyZWFtLm9uKCdkYXRhJywgdHJpZ2dlckRhdGEpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBzZXQgZHVyYXRpb24oZHVyYXRpb24pIHtcbiAgICBfZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgfVxuXG4gIGdldCBkdXJhdGlvbigpIHtcbiAgICByZXR1cm4gX2R1cmF0aW9uO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEpIHtcbiAgICBwYWNrZXRTdHJlYW0ucHVzaChkYXRhKTtcbiAgfVxuICAvLyBmbHVzaCBhbnkgYnVmZmVyZWQgZGF0YVxuICBlbmQoKSB7XG4gICAgZWxlbWVudGFyeVN0cmVhbS5lbmQoKTtcbiAgICBoMjY0U3RyZWFtLmVuZCgpO1xuICAgIHZpZGVvU2VnbWVudFN0cmVhbS5lbmQoKTtcbiAgICBhdWRpb1NlZ21lbnRTdHJlYW0uZW5kKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGF1ZGlvU2VnbWVudFN0cmVhbSA9IHZpZGVvU2VnbWVudFN0cmVhbSA9IG51bGw7XG4gICAgY29uZmlnQXVkaW8gPSBjb25maWdWaWRlbyA9IHRyYWNrVmlkZW8gPSB0cmFja0F1ZGlvID0gcHBzID0gbnVsbDtcbiAgICBfZHVyYXRpb24gPSAwO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcbiIsImV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFtZXdvcmsgcmVhZHkgZXZlbnQsIHRyaWdnZXJlZCB3aGVuIHJlYWR5IHRvIHNldCBEYXRhU291cmNlXG4gIEZSQU1FV09SS19SRUFEWSA6ICdobHNGcmFtZXdvcmtSZWFkeScsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZGluZyBldmVudCwgdHJpZ2dlcmVkIGFmdGVyIGEgY2FsbCB0byBobHMuYXR0YWNoU291cmNlKHVybClcbiAgTUFOSUZFU1RfTE9BRElORyA6ICdobHNNYW5pZmVzdExvYWRpbmcnLFxuICAvL0lkZW50aWZpZXIgZm9yIGEgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCB3aGVuIHRoaXMgZXZlbnQgaXMgcmVjZWl2ZWQsIG1haW4gbWFuaWZlc3QgYW5kIHN0YXJ0IGxldmVsIGhhcyBiZWVuIHJldHJpZXZlZFxuICBNQU5JRkVTVF9MT0FERUQgIDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBsb2FkaW5nIGV2ZW50XG4gIExFVkVMX0xPQURJTkcgICAgOiAnaGxzTGV2ZWxMb2FkaW5nJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBsb2FkZWQgZXZlbnRcbiAgTEVWRUxfTE9BREVEIDogICdobHNMZXZlbExvYWRlZCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbGV2ZWwgc3dpdGNoIGV2ZW50XG4gIExFVkVMX1NXSVRDSCA6ICAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxldmVsIEVORExJU1QgZXZlbnRcbiAgTEVWRUxfRU5ETElTVCA6ICAnaGxzTGV2ZWxFbmRMaXN0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBsb2FkaW5nIGV2ZW50XG4gIEZSQUdNRU5UX0xPQURJTkcgOiAgJ2hsc0ZyYWdtZW50TG9hZGluZycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgbG9hZGVkIGV2ZW50XG4gIEZSQUdNRU5UX0xPQURFRCA6ICAnaGxzRnJhZ21lbnRMb2FkZWQnLFxuICAvLyBJZGVudGlmaWVyIHdoZW4gbGFzdCBmcmFnbWVudCBvZiBwbGF5bGlzdCBoYXMgYmVlbiBsb2FkZWRcbiAgTEFTVF9GUkFHTUVOVF9MT0FERUQgOiAgJ2hsc0xhc3RGcmFnbWVudExvYWRlZCcsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgZnJhZ21lbnQgcGFyc2VkIGV2ZW50XG4gIEZSQUdNRU5UX1BBUlNFRCA6ICAnaGxzRnJhZ21lbnRQYXJzZWQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGxvYWQgZXJyb3IgZXZlbnRcbiAgTE9BRF9FUlJPUiA6ICAnaGxzTG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3JcbiAgTEVWRUxfRVJST1IgOiAgJ2hsc0xldmVsRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIHBsYXliYWNrIG1lZGlhIHRpbWUgY2hhbmdlIGV2ZW50XG4gIE1FRElBX1RJTUUgOiAgJ2hsc01lZGlhVGltZScsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgcGxheWJhY2sgc3RhdGUgc3dpdGNoIGV2ZW50XG4gIFBMQVlCQUNLX1NUQVRFIDogICdobHNQbGF5YmFja1N0YXRlJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBzZWVrIHN0YXRlIHN3aXRjaCBldmVudFxuICBTRUVLX1NUQVRFIDogICdobHNTZWVrU3RhdGUnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIHBsYXliYWNrIGNvbXBsZXRlIGV2ZW50XG4gIFBMQVlCQUNLX0NPTVBMRVRFIDogICdobHNQbGF5QmFja0NvbXBsZXRlJ1xufTtcbiIsIi8qKlxuICogSExTIGVuZ2luZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi9vYnNlcnZlcic7XG5pbXBvcnQgUGxheWxpc3RMb2FkZXIgICAgICAgZnJvbSAnLi9sb2FkZXIvcGxheWxpc3QtbG9hZGVyJztcbmltcG9ydCBCdWZmZXJDb250cm9sbGVyICAgICBmcm9tICcuL2NvbnRyb2xsZXIvYnVmZmVyLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsZW5hYmxlTG9nc30gIGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbi8vaW1wb3J0IE1QNEluc3BlY3QgICAgICAgICBmcm9tICcvcmVtdXgvbXA0LWluc3BlY3Rvcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZCgndmlkZW8vbXA0OyBjb2RlY3M9XCJhdmMxLjQyRTAxRSxtcDRhLjQwLjJcIicpKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHZpZGVvKSB7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcigpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlciA9IG5ldyBCdWZmZXJDb250cm9sbGVyKHZpZGVvKTtcbiAgICB0aGlzLkV2ZW50cyA9IEV2ZW50O1xuICAgIHRoaXMuZGVidWcgPSBlbmFibGVMb2dzO1xuICAgIHRoaXMubG9nRXZ0ID0gdGhpcy5sb2dFdnQ7XG4gICAgLy9NZWRpYSBTb3VyY2UgbGlzdGVuZXJzXG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25NZWRpYVNvdXJjZU9wZW4uYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNlID0gdGhpcy5vbk1lZGlhU291cmNlRW5kZWQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9ubXNjID0gdGhpcy5vbk1lZGlhU291cmNlQ2xvc2UuYmluZCh0aGlzKTtcbiAgICAvLyBpbnRlcm5hbCBsaXN0ZW5lcnNcbiAgICB0aGlzLm9ubWwgPSB0aGlzLm9uTWFuaWZlc3RMb2FkZWQuYmluZCh0aGlzKTtcbiAgICAvLyBvYnNlcnZlciBzZXR1cFxuICAgIHRoaXMub24gPSBvYnNlcnZlci5vbi5iaW5kKG9ic2VydmVyKTtcbiAgICB0aGlzLm9mZiA9IG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMudmlkZW8gPSB2aWRlbztcbiAgICB0aGlzLmF0dGFjaFZpZXcodmlkZW8pO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmRldGFjaFNvdXJjZSgpO1xuICAgIHRoaXMuZGV0YWNoVmlldygpO1xuICB9XG5cbiAgYXR0YWNoVmlldyh2aWRlbykge1xuICAgIC8vIHNldHVwIHRoZSBtZWRpYSBzb3VyY2VcbiAgICB2YXIgbXMgPSB0aGlzLm1lZGlhU291cmNlID0gbmV3IE1lZGlhU291cmNlKCk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICBtcy5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VlbmRlZCcsIHRoaXMub25tc2UpO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgLy8gbGluayB2aWRlbyBhbmQgbWVkaWEgU291cmNlXG4gICAgdmlkZW8uc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChtcyk7XG4gICAgLy8gbGlzdGVuIHRvIGFsbCB2aWRlbyBldmVudHNcbiAgICB2YXIgbGlzdGVuZXIgPSBmdW5jdGlvbihldnQpIHsgdGhpcy5sb2dFdnQoZXZ0KTsgfS5iaW5kKHRoaXMpO1xuICAgIHRoaXMudmlkZW9MaXN0ZW5lckJpbmQgPSBsaXN0ZW5lcjtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2Fkc3RhcnQnLCAgICAgICBsaXN0ZW5lcik7XG4gICAgLy92aWRlby5hZGRFdmVudExpc3RlbmVyKCdwcm9ncmVzcycsICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc3VzcGVuZCcsICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgICAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsICAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZW1wdGllZCcsICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3N0YWxsZWQnLCAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkZGF0YScsICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2NhbnBsYXknLCAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdjYW5wbGF5dGhyb3VnaCcsICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigncGxheWluZycsICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3dhaXRpbmcnLCAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVraW5nJywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2R1cmF0aW9uY2hhbmdlJywgIGxpc3RlbmVyKTtcbiAgICAvL3ZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdwbGF5JywgICAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigncGF1c2UnLCAgICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3JhdGVjaGFuZ2UnLCAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigndm9sdW1lY2hhbmdlJywgICAgbGlzdGVuZXIpO1xuICB9XG5cbiAgZGV0YWNoVmlldygpIHtcbiAgICB2YXIgdmlkZW8gPSB0aGlzLnZpZGVvO1xuICAgIHZhciBsaXN0ZW5lciA9IHRoaXMudmlkZW9MaXN0ZW5lckJpbmQ7XG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICBpZihtcykge1xuICAgICAgdmFyIHNiID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgICBpZihzYikge1xuICAgICAgICAvL2RldGFjaCBzb3VyY2VidWZmZXIgZnJvbSBNZWRpYSBTb3VyY2VcbiAgICAgICAgbXMucmVtb3ZlU291cmNlQnVmZmVyKHNiKTtcbiAgICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgICAgfVxuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsICB0aGlzLm9ubXNvKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgICBtcy5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIHRoaXMub25tc2MpO1xuICAgICAgLy8gdW5saW5rIE1lZGlhU291cmNlIGZyb20gdmlkZW8gdGFnXG4gICAgICB2aWRlby5zcmMgPSAnJztcbiAgICAgIHRoaXMubWVkaWFTb3VyY2UgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLnZpZGVvID0gbnVsbDtcbiAgICAvLyByZW1vdmUgYWxsIHZpZGVvIGxpc3RlbmVyc1xuICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRzdGFydCcsICAgICAgIGxpc3RlbmVyKTtcbiAgICAvL3ZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzdXNwZW5kJywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAgICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgICAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdlbXB0aWVkJywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignc3RhbGxlZCcsICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRkYXRhJywgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2FucGxheScsICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NhbnBsYXl0aHJvdWdoJywgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdwbGF5aW5nJywgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2FpdGluZycsICAgICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NlZWtpbmcnLCAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLCAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHVyYXRpb25jaGFuZ2UnLCAgbGlzdGVuZXIpO1xuICAgIC8vdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BsYXknLCAgICAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCdwYXVzZScsICAgICAgICAgICBsaXN0ZW5lcik7XG4gICAgdmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcigncmF0ZWNoYW5nZScsICAgICAgbGlzdGVuZXIpO1xuICAgIHZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsICAgICAgICAgIGxpc3RlbmVyKTtcbiAgICB2aWRlby5yZW1vdmVFdmVudExpc3RlbmVyKCd2b2x1bWVjaGFuZ2UnLCAgICBsaXN0ZW5lcik7XG4gIH1cblxuICBhdHRhY2hTb3VyY2UodXJsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgbG9nZ2VyLmxvZygnYXR0YWNoU291cmNlOicrdXJsKTtcbiAgICAvLyBjcmVhdGUgc291cmNlIEJ1ZmZlciBhbmQgbGluayB0aGVtIHRvIE1lZGlhU291cmNlXG4gICAgdGhpcy5zb3VyY2VCdWZmZXIgPSB0aGlzLm1lZGlhU291cmNlLmFkZFNvdXJjZUJ1ZmZlcigndmlkZW8vbXA0O2NvZGVjcz1hdmMxLjRkNDAwZCxtcDRhLjQwLjUnKTtcbiAgICAvLyBpbnRlcm5hbCBsaXN0ZW5lciBzZXR1cFxuICAgIG9ic2VydmVyLm9uKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwgdGhpcy5vbm1sKTtcbiAgICAvLyB3aGVuIGF0dGFjaGluZyB0byBhIHNvdXJjZSBVUkwsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkXG4gICAgdGhpcy5wbGF5bGlzdExvYWRlci5sb2FkKHVybCk7XG4gIH1cblxuICBkZXRhY2hTb3VyY2UoKSB7XG4gICAgdGhpcy51cmwgPSBudWxsO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuYnVmZmVyQ29udHJvbGxlci5kZXN0cm95KCk7XG4gICAgLy8gaW50ZXJuYWwgbGlzdGVuZXIgc2V0dXBcbiAgICBvYnNlcnZlci5yZW1vdmVMaXN0ZW5lcihFdmVudC5NQU5JRkVTVF9MT0FERUQsIHRoaXMub25tbCk7XG4gIH1cblxuICBvbk1hbmlmZXN0TG9hZGVkKGV2ZW50LGRhdGEpIHtcbiAgICB0aGlzLmxldmVscyA9IGRhdGEubGV2ZWxzO1xuICAgIHZhciBzdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgbG9nZ2VyLmxvZygnbWFuaWZlc3QgbG9hZGVkLFJUVChtcykvbG9hZChtcyk6JyArIChzdGF0cy50Zmlyc3QgLSBzdGF0cy50cmVxdWVzdCkrICcvJyArIChzdGF0cy50ZW5kIC0gc3RhdHMudHJlcXVlc3QpKTtcbiAgICBpZih0aGlzLmxldmVscy5sZW5ndGggPiAxKSB7XG4gICAgICAvLyBzZXQgbGV2ZWwsIGl0IHdpbGwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRpbmcgcmVxdWVzdFxuICAgICAgdGhpcy5wbGF5bGlzdExvYWRlci5sZXZlbCA9IHRoaXMubGV2ZWxzLmxlbmd0aC0xO1xuICAgIH1cbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuc3RhcnQodGhpcy5sZXZlbHMsIHRoaXMuc291cmNlQnVmZmVyKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VPcGVuKCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBTUVXT1JLX1JFQURZKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VDbG9zZSgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgY2xvc2VkJyk7XG4gIH1cblxuICBvbk1lZGlhU291cmNlRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgc291cmNlIGVuZGVkJyk7XG4gIH1cblxuICBsb2dFdnQoZXZ0KSB7XG4gICAgdmFyIGRhdGEgPSAnJztcbiAgICBzd2l0Y2goZXZ0LnR5cGUpIHtcbiAgICAgIGNhc2UgJ2R1cmF0aW9uY2hhbmdlJzpcbiAgICAgICAgZGF0YSA9IGV2ZW50LnRhcmdldC5kdXJhdGlvbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdyZXNpemUnOlxuICAgICAgICBkYXRhID0gJ3ZpZGVvV2lkdGg6JyArIGV2dC50YXJnZXQudmlkZW9XaWR0aCArICcvdmlkZW9IZWlnaHQ6JyArIGV2dC50YXJnZXQudmlkZW9IZWlnaHQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbG9hZGVkbWV0YWRhdGEnOlxuICAgICAgICBkYXRhID0gJ2R1cmF0aW9uOicgKyBldnQudGFyZ2V0LmR1cmF0aW9uICsgJy92aWRlb1dpZHRoOicgKyBldnQudGFyZ2V0LnZpZGVvV2lkdGggKyAnL3ZpZGVvSGVpZ2h0OicgKyBldnQudGFyZ2V0LnZpZGVvSGVpZ2h0O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2xvYWRlZGRhdGEnOlxuICAgICAgY2FzZSAnY2FucGxheSc6XG4gICAgICBjYXNlICdjYW5wbGF5dGhyb3VnaCc6XG4gICAgICBjYXNlICd0aW1ldXBkYXRlJzpcbiAgICAgIGNhc2UgJ3NlZWtpbmcnOlxuICAgICAgY2FzZSAnc2Vla2VkJzpcbiAgICAgIGNhc2UgJ3BhdXNlJzpcbiAgICAgIGNhc2UgJ3BsYXknOlxuICAgICAgY2FzZSAnc3RhbGxlZCc6XG4gICAgICAgIGRhdGEgPSAnY3VycmVudFRpbWU6JyArIGV2dC50YXJnZXQuY3VycmVudFRpbWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gY2FzZSAncHJvZ3Jlc3MnOlxuICAgICAgLy8gICBkYXRhID0gJ2N1cnJlbnRUaW1lOicgKyBldnQudGFyZ2V0LmN1cnJlbnRUaW1lICsgJyxidWZmZXJSYW5nZTpbJyArIHRoaXMudmlkZW8uYnVmZmVyZWQuc3RhcnQoMCkgKyAnLCcgKyB0aGlzLnZpZGVvLmJ1ZmZlcmVkLmVuZCgwKSArICddJztcbiAgICAgIC8vICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGxvZ2dlci5sb2coZXZ0LnR5cGUgKyAnOicgKyBkYXRhKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBIbHM7XG4iLCIvKlxuICogZnJhZ21lbnQgbG9hZGVyXG4gKlxuICovXG5cbmltcG9ydCBFdmVudCAgICAgICAgICAgICAgICBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IG9ic2VydmVyICAgICAgICAgICAgIGZyb20gJy4uL29ic2VydmVyJztcbmltcG9ydCB7bG9nZ2VyfSAgICAgICAgICAgICBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG4gY2xhc3MgRnJhZ21lbnRMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZih0aGlzLnhociAmJnRoaXMueGhyLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHRoaXMueGhyLmFib3J0KCk7XG4gICAgICB0aGlzLnhociA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgbG9hZCh1cmwpIHtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLnRyZXF1ZXN0ID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnRmaXJzdCA9IG51bGw7XG4gICAgdmFyIHhociA9IHRoaXMueGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9ubG9hZD0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwgLCB0cnVlKTtcbiAgICB4aHIuc2VuZCgpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR01FTlRfTE9BRElORywgeyB1cmw6IHRoaXMudXJsfSk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR01FTlRfTE9BREVELFxuICAgICAgICAgICAgICAgICAgICB7IHBheWxvYWQgOiBldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlLFxuICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHRoaXMudXJsICxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHt0cmVxdWVzdCA6IHRoaXMudHJlcXVlc3QsIHRmaXJzdCA6IHRoaXMudGZpcnN0LCB0ZW5kIDogRGF0ZS5ub3coKSwgbGVuZ3RoIDpldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlLmJ5dGVMZW5ndGggfX0pO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmxvZygnZXJyb3IgbG9hZGluZyAnICsgdGhpcy51cmwpO1xuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTE9BRF9FUlJPUiwgeyB1cmwgOiB0aGlzLnVybCwgZXZlbnQ6ZXZlbnR9KTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcygpIHtcbiAgICBpZih0aGlzLnRmaXJzdCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy50Zmlyc3QgPSBEYXRlLm5vdygpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBGcmFnbWVudExvYWRlcjtcbiIsIi8qXG4gKiBwbGF5bGlzdCBsb2FkZXJcbiAqXG4gKi9cblxuaW1wb3J0IEV2ZW50ICAgICAgICAgICAgICAgIGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgb2JzZXJ2ZXIgICAgICAgICAgICAgZnJvbSAnLi4vb2JzZXJ2ZXInO1xuaW1wb3J0IHtsb2dnZXJ9ICAgICAgICAgICAgIGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbiBjbGFzcyBQbGF5bGlzdExvYWRlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5sZXZlbHMgPSBbXTtcbiAgICB0aGlzLl9sZXZlbCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYodGhpcy54aHIgJiZ0aGlzLnhoci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnhoci5hYm9ydCgpO1xuICAgICAgdGhpcy54aHIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmxldmVscyA9IFtdO1xuICAgIHRoaXMuX2xldmVsID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgbG9hZCh1cmwpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsIHsgdXJsOiB0aGlzLnVybH0pO1xuICAgIHRoaXMuX2xvYWQodXJsKTtcbiAgfVxuXG4gIF9sb2FkKHVybCkge1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIHRoaXMuc3RhdHMgPSB7IHRyZXF1ZXN0IDogRGF0ZS5ub3coKX07XG4gICAgdmFyIHhociA9IHRoaXMueGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgeGhyLm9ubG9hZD0gIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKTtcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyk7XG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSB0aGlzLmxvYWRwcm9ncmVzcy5iaW5kKHRoaXMpO1xuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBnZXQgbGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVsO1xuICB9XG5cbiAgc2V0IGxldmVsKG5ld0xldmVsKSB7XG4gICAgaWYodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsKSB7XG4gICAgICAvLyBjaGVjayBpZiBsZXZlbCBpZHggaXMgdmFsaWRcbiAgICAgIGlmKG5ld0xldmVsID49IDAgJiYgbmV3TGV2ZWwgPCB0aGlzLmxldmVscy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5fbGV2ZWwgPSBuZXdMZXZlbDtcbiAgICAgICAgIC8vIGNoZWNrIGlmIHdlIG5lZWQgdG8gbG9hZCBwbGF5bGlzdCBmb3IgdGhpcyBuZXcgbGV2ZWxcbiAgICAgICAgaWYodGhpcy5sZXZlbHNbbmV3TGV2ZWxdLmZyYWdtZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gbGV2ZWwgbm90IHJldHJpZXZlZCB5ZXQsIHdlIG5lZWQgdG8gbG9hZCBpdFxuICAgICAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BRElORywgeyBsZXZlbCA6IG5ld0xldmVsfSk7XG4gICAgICAgICAgdGhpcy5fbG9hZCh0aGlzLmxldmVsc1tuZXdMZXZlbF0udXJsKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaW52YWxpZCBsZXZlbCBpZCBnaXZlbiwgdHJpZ2dlciBlcnJvclxuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0VSUk9SLCB7IGxldmVsIDogbmV3TGV2ZWwsIGV2ZW50OiAnaW52YWxpZCBsZXZlbCBpZHgnfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmVzb2x2ZSh1cmwsIGJhc2VVcmwpIHtcbiAgICB2YXIgZG9jICAgICAgPSBkb2N1bWVudCxcbiAgICAgICAgb2xkQmFzZSA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYmFzZScpWzBdLFxuICAgICAgICBvbGRIcmVmID0gb2xkQmFzZSAmJiBvbGRCYXNlLmhyZWYsXG4gICAgICAgIGRvY0hlYWQgPSBkb2MuaGVhZCB8fCBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXSxcbiAgICAgICAgb3VyQmFzZSA9IG9sZEJhc2UgfHwgZG9jSGVhZC5hcHBlbmRDaGlsZChkb2MuY3JlYXRlRWxlbWVudCgnYmFzZScpKSxcbiAgICAgICAgcmVzb2x2ZXIgPSBkb2MuY3JlYXRlRWxlbWVudCgnYScpLFxuICAgICAgICByZXNvbHZlZFVybDtcblxuICAgIG91ckJhc2UuaHJlZiA9IGJhc2VVcmw7XG4gICAgcmVzb2x2ZXIuaHJlZiA9IHVybDtcbiAgICByZXNvbHZlZFVybCAgPSByZXNvbHZlci5ocmVmOyAvLyBicm93c2VyIG1hZ2ljIGF0IHdvcmsgaGVyZVxuXG4gICAgaWYgKG9sZEJhc2UpIHtvbGRCYXNlLmhyZWYgPSBvbGRIcmVmO31cbiAgICBlbHNlIHtkb2NIZWFkLnJlbW92ZUNoaWxkKG91ckJhc2UpO31cbiAgICByZXR1cm4gcmVzb2x2ZWRVcmw7XG4gIH1cblxuXG5cbiAgcGFyc2VNYW5pZmVzdChzdHJpbmcsIHVybCkge1xuICAgIGlmKHN0cmluZy5pbmRleE9mKCcjRVhUTTNVJykgPT09IDApIHtcbiAgICAgIGlmIChzdHJpbmcuaW5kZXhPZignI0VYVElORjonKSA+IDApIHtcbiAgICAgICAgLy8gMSBsZXZlbCBwbGF5bGlzdCwgY3JlYXRlIHVuaXF1ZSBsZXZlbCBhbmQgcGFyc2UgcGxheWxpc3RcbiAgICAgICAgdGhpcy5fbGV2ZWwgPSAwO1xuICAgICAgICB0aGlzLmxldmVscy5sZW5ndGggPSAxO1xuICAgICAgICB0aGlzLmxldmVsc1swXSA9IHt9O1xuICAgICAgICB0aGlzLnBhcnNlTGV2ZWxQbGF5bGlzdChzdHJpbmcsdXJsLDApO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWxzIDogdGhpcy5sZXZlbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHVybCA6IHVybCAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzIDogdGhpcy5zdGF0c30pO1xuICAgICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURFRCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWwgOiB0aGlzLl9sZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsIDogdXJsICxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHMgOiB0aGlzLnN0YXRzfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICB0aGlzLmxldmVscyA9IHRoaXMucGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsdXJsKTtcbiAgICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5NQU5JRkVTVF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGxldmVscyA6IHRoaXMubGV2ZWxzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgOiB1cmwgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHRoaXMuc3RhdHN9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MT0FEX0VSUk9SLCB7IHVybCA6IHVybCwgZXZlbnQ6ICdub3QgYW4gSExTIHBsYXlsaXN0J30pO1xuICAgIH1cbiAgfVxuXG4gIHBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLGJhc2V1cmwpIHtcbiAgICB2YXIgbGV2ZWxzID0gW107XG4gICAgdmFyIGxldmVsID0gIHt9O1xuICAgIHZhciByZXN1bHQ7XG4gICAgdmFyIHJlID0gLyNFWFQtWC1TVFJFQU0tSU5GOlteXFxuXFxyXSooQkFORFdJRFRIKT0oXFxkKykqW15cXG5cXHJdKFJFU09MVVRJT04pPShcXGQrKXgoXFxkKylbXlxcclxcbl0qW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUoKHJlc3VsdCA9IHJlLmV4ZWMoc3RyaW5nKSkgIT0gbnVsbCl7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obil7IHJldHVybiAobiAhPT0gdW5kZWZpbmVkKTt9KTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHQucG9wKCksYmFzZXVybCk7XG4gICAgICB3aGlsZShyZXN1bHQubGVuZ3RoID4gMCkge1xuICAgICAgICBzd2l0Y2gocmVzdWx0LnNoaWZ0KCkpIHtcbiAgICAgICAgICBjYXNlICdSRVNPTFVUSU9OJzpcbiAgICAgICAgICAgIGxldmVsLndpZHRoID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXZlbC5oZWlnaHQgPSByZXN1bHQuc2hpZnQoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0JBTkRXSURUSCc6XG4gICAgICAgICAgICBsZXZlbC5iaXRyYXRlID0gcmVzdWx0LnNoaWZ0KCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldmVscy5wdXNoKGxldmVsKTtcbiAgICAgIGxldmVsID0ge307XG4gICAgfVxuICAgIHJldHVybiBsZXZlbHM7XG4gIH1cblxuICBwYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCBiYXNldXJsLCBpZHgpIHtcbiAgICB2YXIgY3VycmVudFNOLHRvdGFsZHVyYXRpb24gPSAwO1xuICAgIHZhciBvYmogPSB0aGlzLmxldmVsc1tpZHhdO1xuICAgIG9iai51cmwgPSBiYXNldXJsO1xuICAgIG9iai5mcmFnbWVudHMgPSBbXTtcbiAgICBvYmouZW5kTGlzdCA9IGZhbHNlO1xuXG4gICAgdmFyIHJlc3VsdDtcbiAgICB2YXIgcmUgPSAvKD86I0VYVC1YLShNRURJQS1TRVFVRU5DRSk6KFxcZCspKXwoPzojRVhULVgtKFRBUkdFVERVUkFUSU9OKTooXFxkKykpfCg/OiNFWFQoSU5GKTooXFxkKylbXlxcclxcbl0qW1xcclxcbl0rKFteXFxyXFxuXSspfCg/OiNFWFQtWC0oRU5ETElTVCkpKS9nO1xuICAgIHdoaWxlKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9PSBudWxsKXtcbiAgICAgIHJlc3VsdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihmdW5jdGlvbihuKXsgcmV0dXJuIChuICE9PSB1bmRlZmluZWQpO30pO1xuICAgICAgc3dpdGNoKHJlc3VsdFswXSkge1xuICAgICAgICBjYXNlICdNRURJQS1TRVFVRU5DRSc6XG4gICAgICAgICAgY3VycmVudFNOID0gb2JqLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgb2JqLnRhcmdldGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFTkRMSVNUJzpcbiAgICAgICAgICBvYmouZW5kTGlzdCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0lORic6XG4gICAgICAgICAgdmFyIGR1cmF0aW9uID0gcGFyc2VGbG9hdChyZXN1bHRbMV0pO1xuICAgICAgICAgIG9iai5mcmFnbWVudHMucHVzaCh7dXJsIDogdGhpcy5yZXNvbHZlKHJlc3VsdFsyXSxiYXNldXJsKSwgZHVyYXRpb24gOiBkdXJhdGlvbiwgc3RhcnQgOiB0b3RhbGR1cmF0aW9uLCBzbiA6IGN1cnJlbnRTTisrfSk7XG4gICAgICAgICAgdG90YWxkdXJhdGlvbis9ZHVyYXRpb247XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGxvZ2dlci5sb2coJ2ZvdW5kICcgKyBvYmouZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgb2JqLnRvdGFsZHVyYXRpb24gPSB0b3RhbGR1cmF0aW9uO1xuICAgIG9iai5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gIH1cblxuICBsb2Fkc3VjY2VzcygpIHtcbiAgICB0aGlzLnN0YXRzLnRlbmQgPSBEYXRlLm5vdygpO1xuICAgIGlmKHRoaXMubGV2ZWxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5wYXJzZU1hbmlmZXN0KGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VUZXh0LCB0aGlzLnVybCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGFyc2VMZXZlbFBsYXlsaXN0KGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2VUZXh0LCB0aGlzLnVybCwgdGhpcy5fbGV2ZWwpO1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICAgICAgICAgICAgICAgICAgIHsgbGV2ZWwgOiB0aGlzLl9sZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsIDogdGhpcy51cmwgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cyA6IHRoaXMuc3RhdHN9KTtcbiAgICB9XG4gIH1cblxuICBsb2FkZXJyb3IoZXZlbnQpIHtcbiAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkxPQURfRVJST1IsIHsgdXJsIDogdGhpcy51cmwsIGV2ZW50OiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuICAgIGlmKHRoaXMuc3RhdHMudGZpcnN0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gRGF0ZS5ub3coKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCJpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbmxldCBvYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcblxub2JzZXJ2ZXIudHJpZ2dlciA9IGZ1bmN0aW9uIHRyaWdnZXIgKGV2ZW50LCAuLi5kYXRhKSB7XG4gIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IG9ic2VydmVyO1xuIiwiLyoqXG4gKiBnZW5lcmF0ZSBNUDQgQm94XG4gKi9cblxuY2xhc3MgTVA0IHtcbiAgc3RhdGljIGluaXQoKSB7XG4gICAgTVA0LnR5cGVzID0ge1xuICAgICAgYXZjMTogW10sIC8vIGNvZGluZ25hbWVcbiAgICAgIGF2Y0M6IFtdLFxuICAgICAgYnRydDogW10sXG4gICAgICBkaW5mOiBbXSxcbiAgICAgIGRyZWY6IFtdLFxuICAgICAgZXNkczogW10sXG4gICAgICBmdHlwOiBbXSxcbiAgICAgIGhkbHI6IFtdLFxuICAgICAgbWRhdDogW10sXG4gICAgICBtZGhkOiBbXSxcbiAgICAgIG1kaWE6IFtdLFxuICAgICAgbWZoZDogW10sXG4gICAgICBtaW5mOiBbXSxcbiAgICAgIG1vb2Y6IFtdLFxuICAgICAgbW9vdjogW10sXG4gICAgICBtcDRhOiBbXSxcbiAgICAgIG12ZXg6IFtdLFxuICAgICAgbXZoZDogW10sXG4gICAgICBzZHRwOiBbXSxcbiAgICAgIHN0Ymw6IFtdLFxuICAgICAgc3RjbzogW10sXG4gICAgICBzdHNjOiBbXSxcbiAgICAgIHN0c2Q6IFtdLFxuICAgICAgc3RzejogW10sXG4gICAgICBzdHRzOiBbXSxcbiAgICAgIHRmZHQ6IFtdLFxuICAgICAgdGZoZDogW10sXG4gICAgICB0cmFmOiBbXSxcbiAgICAgIHRyYWs6IFtdLFxuICAgICAgdHJ1bjogW10sXG4gICAgICB0cmV4OiBbXSxcbiAgICAgIHRraGQ6IFtdLFxuICAgICAgdm1oZDogW11cbiAgICB9O1xuXG4gICAgdmFyIGk7XG4gICAgZm9yIChpIGluIE1QNC50eXBlcykge1xuICAgICAgaWYgKE1QNC50eXBlcy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICBNUDQudHlwZXNbaV0gPSBbXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMiksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICAgIF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgTVA0Lk1BSk9SX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgJ2knLmNoYXJDb2RlQXQoMCksXG4gICAgICAncycuY2hhckNvZGVBdCgwKSxcbiAgICAgICdvJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ20nLmNoYXJDb2RlQXQoMClcbiAgICBdKTtcbiAgICBNUDQuQVZDMV9CUkFORCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICAgJ3YnLmNoYXJDb2RlQXQoMCksXG4gICAgICAnYycuY2hhckNvZGVBdCgwKSxcbiAgICAgICcxJy5jaGFyQ29kZUF0KDApXG4gICAgXSk7XG4gICAgTVA0Lk1JTk9SX1ZFUlNJT04gPSBuZXcgVWludDhBcnJheShbMCwgMCwgMCwgMV0pO1xuICAgIE1QNC5WSURFT19IRExSID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIC8vIGhhbmRsZXJfdHlwZTogJ3ZpZGUnXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg0OCwgMHg2MSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NmMsIDB4NjUsIDB4NzIsIDB4MDAgLy8gbmFtZTogJ1ZpZGVvSGFuZGxlcidcbiAgICBdKTtcbiAgICBNUDQuQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG4gICAgTVA0LkhETFJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOk1QNC5WSURFT19IRExSLFxuICAgICAgJ2F1ZGlvJzpNUDQuQVVESU9fSERMUlxuICAgIH07XG4gICAgTVA0LkRSRUYgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBlbnRyeV9jb3VudFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgICAgMHg3NSwgMHg3MiwgMHg2YywgMHgyMCwgLy8gJ3VybCcgdHlwZVxuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gICAgXSk7XG4gICAgTVA0LlNUQ08gPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCAvLyBlbnRyeV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFNDID0gTVA0LlNUQ087XG4gICAgTVA0LlNUU1ogPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9jb3VudFxuICAgIF0pO1xuICAgIE1QNC5TVFRTID0gTVA0LlNUQ087XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICBNUDQuTUVESUFIRUFERVJfVFlQRVMgPSB7XG4gICAgICAndmlkZW8nOiBNUDQuVk1IRCxcbiAgICAgICdhdWRpbyc6IE1QNC5TTUhEXG4gICAgfTtcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuTUlOT1JfVkVSU0lPTiwgTVA0Lk1BSk9SX0JSQU5ELCBNUDQuQVZDMV9CUkFORCk7XG4gICAgTVA0LkRJTkYgPSBNUDQuYm94KE1QNC50eXBlcy5kaW5mLCBNUDQuYm94KE1QNC50eXBlcy5kcmVmLCBNUDQuRFJFRikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSAwLFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICByZXN1bHQsXG4gICAgdmlldztcblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgdG90YWwgc2l6ZSB3ZSBuZWVkIHRvIGFsbG9jYXRlXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gICAgfVxuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHNpemUgKyA4KTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KHJlc3VsdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIHJlc3VsdC5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuXG4gICAgLy8gY29weSB0aGUgcGF5bG9hZCBpbnRvIHRoZSByZXN1bHRcbiAgICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IHBheWxvYWQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKGR1cmF0aW9uKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAxLCAweDVmLCAweDkwLCAvLyB0aW1lc2NhbGUsIDkwLDAwMCBcInRpY2tzXCIgcGVyIHNlY29uZFxuXG4gICAgICAoZHVyYXRpb24gJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgIChkdXJhdGlvbiAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgIChkdXJhdGlvbiAmIDB4RkYwMCkgPj4gOCxcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4NTUsIDB4YzQsIC8vICd1bmQnIGxhbmd1YWdlICh1bmRldGVybWluZWQpXG4gICAgICAweDAwLCAweDAwXG4gICAgXSkpO1xuICB9XG5cbiAgc3RhdGljIG1kaWEodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWRpYSwgTVA0Lm1kaGQodHJhY2suZHVyYXRpb24pLCBNUDQuaGRscih0cmFjay50eXBlKSwgTVA0Lm1pbmYodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyBtZmhkKHNlcXVlbmNlTnVtYmVyKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1maGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgKHNlcXVlbmNlTnVtYmVyICYgMHhGRjAwMDAwMCkgPj4gMjQsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgJiAweEZGMDApID4+IDgsXG4gICAgICBzZXF1ZW5jZU51bWJlciAmIDB4RkYsIC8vIHNlcXVlbmNlX251bWJlclxuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyBtaW5mKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5NRURJQUhFQURFUl9UWVBFU1t0cmFjay50eXBlXSksIE1QNC5ESU5GLCBNUDQuc3RibCh0cmFjaykpO1xuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsXG4gICAgICAgICAgICAgICAgICAgTVA0Lm1maGQoc24pLFxuICAgICAgICAgICAgICAgICAgIE1QNC50cmFmKHRyYWNrLGJhc2VNZWRpYURlY29kZVRpbWUpKTtcbiAgfVxuLyoqXG4gKiBAcGFyYW0gdHJhY2tzLi4uIChvcHRpb25hbCkge2FycmF5fSB0aGUgdHJhY2tzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG1vdmllXG4gKi9cbiAgc3RhdGljIG1vb3YodHJhY2tzKSB7XG4gICAgdmFyXG4gICAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICAgIGJveGVzID0gW107XG5cbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBib3hlc1tpXSA9IE1QNC50cmFrKHRyYWNrc1tpXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tb292LCBNUDQubXZoZCh0cmFja3NbMF0uZHVyYXRpb24pXS5jb25jYXQoYm94ZXMpLmNvbmNhdChNUDQubXZleCh0cmFja3MpKSk7XG4gIH1cblxuICBzdGF0aWMgbXZleCh0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyZXgodHJhY2tzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3guYXBwbHkobnVsbCwgW01QNC50eXBlcy5tdmV4XS5jb25jYXQoYm94ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmhkKGR1cmF0aW9uKSB7XG4gICAgdmFyXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgICAgMHgwMCwgMHgwMSwgMHg1ZiwgMHg5MCwgLy8gdGltZXNjYWxlLCA5MCwwMDAgXCJ0aWNrc1wiIHBlciBzZWNvbmRcbiAgICAgICAgKGR1cmF0aW9uICYgMHhGRjAwMDAwMCkgPj4gMjQsXG4gICAgICAgIChkdXJhdGlvbiAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgICAgKGR1cmF0aW9uICYgMHhGRjAwKSA+PiA4LFxuICAgICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAgIDB4MDEsIDB4MDAsIC8vIDEuMCB2b2x1bWVcbiAgICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgICAweGZmLCAweGZmLCAweGZmLCAweGZmIC8vIG5leHRfdHJhY2tfSURcbiAgICAgIF0pO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tdmhkLCBieXRlcyk7XG4gIH1cblxuICBzdGF0aWMgc2R0cCh0cmFjaykge1xuICAgIHZhclxuICAgICAgc2FtcGxlcyA9IHRyYWNrLnNhbXBsZXMgfHwgW10sXG4gICAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgICBzYW1wbGUsXG4gICAgICBpO1xuXG4gICAgLy8gbGVhdmUgdGhlIGZ1bGwgYm94IGhlYWRlciAoNCBieXRlcykgYWxsIHplcm9cblxuICAgIC8vIHdyaXRlIHRoZSBzYW1wbGUgdGFibGVcbiAgICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICAgIGJ5dGVzW2kgKyA0XSA9IChzYW1wbGUuZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKHNhbXBsZS5mbGFncy5pc0RlcGVuZGVkT24gPDwgMikgfFxuICAgICAgICAoc2FtcGxlLmZsYWdzLmhhc1JlZHVuZGFuY3kpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zZHRwLFxuICAgICAgICAgICAgICAgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCxcbiAgICAgICAgICAgICAgIE1QNC5zdHNkKHRyYWNrKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0dHMsIE1QNC5TVFRTKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0c3osIE1QNC5TVFNaKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnN0Y28sIE1QNC5TVENPKSk7XG4gIH1cblxuICBzdGF0aWMgYXZjMSh0cmFjaykge1xuICAgIHZhciBzcHMgPSBbXSwgcHBzID0gW10sIGk7XG4gICAgLy8gYXNzZW1ibGUgdGhlIFNQU3NcbiAgICBmb3IgKGkgPSAwOyBpIDwgdHJhY2suc3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBzcHMucHVzaCgodHJhY2suc3BzW2ldLmJ5dGVMZW5ndGggJiAweEZGMDApID4+PiA4KTtcbiAgICAgIHNwcy5wdXNoKCh0cmFjay5zcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTsgLy8gc2VxdWVuY2VQYXJhbWV0ZXJTZXRMZW5ndGhcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodHJhY2suc3BzW2ldKSk7IC8vIFNQU1xuICAgIH1cblxuICAgIC8vIGFzc2VtYmxlIHRoZSBQUFNzXG4gICAgZm9yIChpID0gMDsgaSA8IHRyYWNrLnBwcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHBzLnB1c2goKHRyYWNrLnBwc1tpXS5ieXRlTGVuZ3RoICYgMHhGRjAwKSA+Pj4gOCk7XG4gICAgICBwcHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7XG4gICAgICBwcHMgPSBwcHMuY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRyYWNrLnBwc1tpXSkpO1xuICAgIH1cblxuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh0cmFjay53aWR0aCAmIDB4ZmYwMCkgPj4gOCxcbiAgICAgICAgdHJhY2sud2lkdGggJiAweGZmLCAvLyB3aWR0aFxuICAgICAgICAodHJhY2suaGVpZ2h0ICYgMHhmZjAwKSA+PiA4LFxuICAgICAgICB0cmFjay5oZWlnaHQgJiAweGZmLCAvLyBoZWlnaHRcbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gaG9yaXpyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGZyYW1lX2NvdW50XG4gICAgICAgIDB4MTMsXG4gICAgICAgIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAgIDB4NmYsIDB4NmEsIDB4NzMsIDB4MmQsXG4gICAgICAgIDB4NjMsIDB4NmYsIDB4NmUsIDB4NzQsXG4gICAgICAgIDB4NzIsIDB4NjksIDB4NjIsIDB4MmQsXG4gICAgICAgIDB4NjgsIDB4NmMsIDB4NzMsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNvbXByZXNzb3JuYW1lXG4gICAgICAgIDB4MDAsIDB4MTgsIC8vIGRlcHRoID0gMjRcbiAgICAgICAgMHgxMSwgMHgxMV0pLCAvLyBwcmVfZGVmaW5lZCA9IC0xXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgLy8gY29uZmlndXJhdGlvblZlcnNpb25cbiAgICAgICAgICAgIHRyYWNrLnByb2ZpbGVJZGMsIC8vIEFWQ1Byb2ZpbGVJbmRpY2F0aW9uXG4gICAgICAgICAgICB0cmFjay5wcm9maWxlQ29tcGF0aWJpbGl0eSwgLy8gcHJvZmlsZV9jb21wYXRpYmlsaXR5XG4gICAgICAgICAgICB0cmFjay5sZXZlbElkYywgLy8gQVZDTGV2ZWxJbmRpY2F0aW9uXG4gICAgICAgICAgICAweGZmIC8vIGxlbmd0aFNpemVNaW51c09uZSwgaGFyZC1jb2RlZCB0byA0IGJ5dGVzXG4gICAgICAgICAgXS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2suc3BzLmxlbmd0aCAvLyBudW1PZlNlcXVlbmNlUGFyYW1ldGVyU2V0c1xuICAgICAgICAgIF0pLmNvbmNhdChzcHMpLmNvbmNhdChbXG4gICAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgICBdKS5jb25jYXQocHBzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTksIC8vIGxlbmd0aFxuICAgICAgMHgwMCwgMHgwMSwgLy9lc19pZFxuICAgICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAgIDB4MDQsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgICAgMHgxMSwgLy8gbGVuZ3RoXG4gICAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAgIDB4MTUsIC8vIHN0cmVhbV90eXBlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBidWZmZXJfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gYXZnQml0cmF0ZVxuXG4gICAgICAweDA1LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MDIsIC8vIGxlbmd0aFxuICAgICAgdHJhY2suY29uZmlnWzBdLHRyYWNrLmNvbmZpZ1sxXVxuICAgIF0pO1xuICB9XG5cbiAgc3RhdGljIG1wNGEodHJhY2spIHtcbiAgICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMiwgLy8gY2hhbm5lbGNvdW50OjIgY2hhbm5lbHNcbiAgICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWQyXG4gICAgICAgICh0cmFjay5hdWRpb3NhbXBsZXJhdGUgJiAweGZmMDApID4+IDgsXG4gICAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAmIDB4ZmYsIC8vXG4gICAgICAgIDB4MDAsIDB4MDBdKSxcbiAgICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQubXA0YSh0cmFjaykpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QgLCBNUDQuYXZjMSh0cmFjaykpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyB0a2hkKHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwNywgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodHJhY2suaWQgJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgICh0cmFjay5pZCAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgICh0cmFjay5pZCAmIDB4RkYwMCkgPj4gOCxcbiAgICAgIHRyYWNrLmlkICYgMHhGRiwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAodHJhY2suZHVyYXRpb24gJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgICh0cmFjay5kdXJhdGlvbiAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgICh0cmFjay5kdXJhdGlvbiAmIDB4RkYwMCkgPj4gOCxcbiAgICAgIHRyYWNrLmR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbGF5ZXJcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGFsdGVybmF0ZV9ncm91cFxuICAgICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgICAgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHg0MCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gdHJhbnNmb3JtYXRpb246IHVuaXR5IG1hdHJpeFxuICAgICAgKHRyYWNrLndpZHRoICYgMHhGRjAwKSA+PiA4LFxuICAgICAgdHJhY2sud2lkdGggJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCwgLy8gd2lkdGhcbiAgICAgICh0cmFjay5oZWlnaHQgJiAweEZGMDApID4+IDgsXG4gICAgICB0cmFjay5oZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYwMDAwMDApID4+IDI0LFxuICAgICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYwMCkgPj4gOCxcbiAgICAgICAgICAgICAgICAgKHRyYWNrLmlkICYgMHhGRikgLy8gdHJhY2tfSURcbiAgICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmZHQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRjAwMDAwMCkgPj4gMjQsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRjAwMDApID4+IDE2LFxuICAgICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYwMCkgPj4gOCxcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLFxuICAgICAgICAgICAgICAgTVA0LnRraGQodHJhY2spLFxuICAgICAgICAgICAgICAgTVA0Lm1kaWEodHJhY2spKTtcbiAgfVxuXG4gIHN0YXRpYyB0cmV4KHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRyZXgsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICh0cmFjay5pZCAmIDB4RkYwMDAwMDApID4+IDI0LFxuICAgICAgKHRyYWNrLmlkICYgMHhGRjAwMDApID4+IDE2LFxuICAgICAgKHRyYWNrLmlkICYgMHhGRjAwKSA+PiA4LFxuICAgICAgKHRyYWNrLmlkICYgMHhGRiksIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAxLCAvLyBkZWZhdWx0X3NhbXBsZV9kZXNjcmlwdGlvbl9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGRlZmF1bHRfc2FtcGxlX3NpemVcbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDEgLy8gZGVmYXVsdF9zYW1wbGVfZmxhZ3NcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJ1bih0cmFjaywgb2Zmc2V0KSB7XG4gICAgdmFyIGJ5dGVzLCBzYW1wbGVzLCBzYW1wbGUsIGk7XG5cbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgICBvZmZzZXQgKz0gOCArIDEyICsgKDE2ICogc2FtcGxlcy5sZW5ndGgpO1xuXG4gICAgYnl0ZXMgPSBbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MGYsIDB4MDEsIC8vIGZsYWdzXG4gICAgICAoc2FtcGxlcy5sZW5ndGggJiAweEZGMDAwMDAwKSA+Pj4gMjQsXG4gICAgICAoc2FtcGxlcy5sZW5ndGggJiAweEZGMDAwMCkgPj4+IDE2LFxuICAgICAgKHNhbXBsZXMubGVuZ3RoICYgMHhGRjAwKSA+Pj4gOCxcbiAgICAgIHNhbXBsZXMubGVuZ3RoICYgMHhGRiwgLy8gc2FtcGxlX2NvdW50XG4gICAgICAob2Zmc2V0ICYgMHhGRjAwMDAwMCkgPj4+IDI0LFxuICAgICAgKG9mZnNldCAmIDB4RkYwMDAwKSA+Pj4gMTYsXG4gICAgICAob2Zmc2V0ICYgMHhGRjAwKSA+Pj4gOCxcbiAgICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgICBdO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgICBieXRlcyA9IGJ5dGVzLmNvbmNhdChbXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gJiAweEZGMDAwMDAwKSA+Pj4gMjQsXG4gICAgICAgIChzYW1wbGUuZHVyYXRpb24gJiAweEZGMDAwMCkgPj4+IDE2LFxuICAgICAgICAoc2FtcGxlLmR1cmF0aW9uICYgMHhGRjAwKSA+Pj4gOCxcbiAgICAgICAgc2FtcGxlLmR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzYW1wbGUuc2l6ZSAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAgICAgKHNhbXBsZS5zaXplICYgMHhGRjAwMDApID4+PiAxNixcbiAgICAgICAgKHNhbXBsZS5zaXplICYgMHhGRjAwKSA+Pj4gOCxcbiAgICAgICAgc2FtcGxlLnNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgICAoc2FtcGxlLmZsYWdzLmlzTGVhZGluZyA8PCAyKSB8IHNhbXBsZS5mbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChzYW1wbGUuZmxhZ3MuaXNEZXBlbmRlZE9uIDw8IDYpIHxcbiAgICAgICAgICAoc2FtcGxlLmZsYWdzLmhhc1JlZHVuZGFuY3kgPDwgNCkgfFxuICAgICAgICAgIChzYW1wbGUuZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBzYW1wbGUuZmxhZ3MuaXNOb25TeW5jU2FtcGxlLFxuICAgICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkYXRpb25Qcmlvcml0eSAmIDB4RjAgPDwgOCxcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlZ3JhZGF0aW9uUHJpb3JpdHkgJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGMDAwMDAwKSA+Pj4gMjQsXG4gICAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ICYgMHhGRjAwMDApID4+PiAxNixcbiAgICAgICAgKHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGMDApID4+PiA4LFxuICAgICAgICBzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ICYgMHhGRiAvLyBzYW1wbGVfY29tcG9zaXRpb25fdGltZV9vZmZzZXRcbiAgICAgIF0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJ1biwgbmV3IFVpbnQ4QXJyYXkoYnl0ZXMpKTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcblxuICAgIGlmKCFNUDQudHlwZXMpIHtcbiAgICAgIE1QNC5pbml0KCk7XG4gICAgfVxuICAgIHZhclxuICAgICAgbW92aWUgPSBNUDQubW9vdih0cmFja3MpLFxuICAgICAgcmVzdWx0O1xuXG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoTVA0LkZUWVAuYnl0ZUxlbmd0aCArIG1vdmllLmJ5dGVMZW5ndGgpO1xuICAgIHJlc3VsdC5zZXQoTVA0LkZUWVApO1xuICAgIHJlc3VsdC5zZXQobW92aWUsIE1QNC5GVFlQLmJ5dGVMZW5ndGgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuXG5cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpe31cbmxldCBmYWtlTG9nZ2VyID0ge1xuICBsb2c6IG5vb3AsXG4gIHdhcm46IG5vb3AsXG4gIGluZm86IG5vb3AsXG4gIGVycm9yOiBub29wXG59O1xubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuZXhwb3J0IHZhciBlbmFibGVMb2dzID0gZnVuY3Rpb24oZGVidWcpIHtcbiAgaWYgKGRlYnVnID09PSB0cnVlIHx8IHR5cGVvZiBkZWJ1ZyAgICAgICA9PT0gJ29iamVjdCcpIHtcbiAgICBleHBvcnRlZExvZ2dlci5sb2cgICA9IGRlYnVnLmxvZyAgID8gZGVidWcubG9nLmJpbmQoZGVidWcpICAgOiBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gZGVidWcuaW5mbyAgPyBkZWJ1Zy5pbmZvLmJpbmQoZGVidWcpICA6IGNvbnNvbGUuaW5mby5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gZGVidWcuZXJyb3IgPyBkZWJ1Zy5lcnJvci5iaW5kKGRlYnVnKSA6IGNvbnNvbGUuZXJyb3IuYmluZChjb25zb2xlKTtcbiAgICBleHBvcnRlZExvZ2dlci53YXJuICA9IGRlYnVnLndhcm4gID8gZGVidWcud2Fybi5iaW5kKGRlYnVnKSAgOiBjb25zb2xlLndhcm4uYmluZChjb25zb2xlKTtcblxuICAgIC8vIFNvbWUgYnJvd3NlcnMgZG9uJ3QgYWxsb3cgdG8gdXNlIGJpbmQgb24gY29uc29sZSBvYmplY3QgYW55d2F5XG4gICAgLy8gZmFsbGJhY2sgdG8gZGVmYXVsdCBpZiBuZWVkZWRcbiAgICB0cnkge1xuICAgICBleHBvcnRlZExvZ2dlci5sb2coKTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmluZm8gID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLmVycm9yID0gbm9vcDtcbiAgICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gbm9vcDtcbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICB9XG59O1xuZXhwb3J0IHZhciBsb2dnZXIgPSBleHBvcnRlZExvZ2dlcjtcbiIsIi8qKlxuICogQSBsaWdodHdlaWdodCByZWFkYWJsZSBzdHJlYW0gaW1wbGVtZW50aW9uIHRoYXQgaGFuZGxlcyBldmVudCBkaXNwYXRjaGluZy5cbiAqIE9iamVjdHMgdGhhdCBpbmhlcml0IGZyb20gc3RyZWFtcyBzaG91bGQgY2FsbCBpbml0IGluIHRoZWlyIGNvbnN0cnVjdG9ycy5cbiAqL1xuXG4gJ3VzZSBzdHJpY3QnO1xuXG4gY2xhc3MgU3RyZWFtICB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIGZvciBhIHNwZWNpZmllZCBldmVudCB0eXBlLlxuICAgKiBAcGFyYW0gdHlwZSB7c3RyaW5nfSB0aGUgZXZlbnQgbmFtZVxuICAgKiBAcGFyYW0gbGlzdGVuZXIge2Z1bmN0aW9ufSB0aGUgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCB3aGVuIGFuIGV2ZW50IG9mXG4gICAqIHRoZSBzcGVjaWZpZWQgdHlwZSBvY2N1cnNcbiAgICovXG4gICBvbih0eXBlLCBsaXN0ZW5lcikge1xuICAgIGlmICghdGhpcy5saXN0ZW5lcnNbdHlwZV0pIHtcbiAgICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdID0gW107XG4gICAgfVxuICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICB9XG4gIC8qKlxuICAgKiBSZW1vdmUgYSBsaXN0ZW5lciBmb3IgYSBzcGVjaWZpZWQgZXZlbnQgdHlwZS5cbiAgICogQHBhcmFtIHR5cGUge3N0cmluZ30gdGhlIGV2ZW50IG5hbWVcbiAgICogQHBhcmFtIGxpc3RlbmVyIHtmdW5jdGlvbn0gYSBmdW5jdGlvbiBwcmV2aW91c2x5IHJlZ2lzdGVyZWQgZm9yIHRoaXNcbiAgICogdHlwZSBvZiBldmVudCB0aHJvdWdoIGBvbmBcbiAgICovXG4gICBvZmYodHlwZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgaW5kZXg7XG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpbmRleCA9IHRoaXMubGlzdGVuZXJzW3R5cGVdLmluZGV4T2YobGlzdGVuZXIpO1xuICAgIHRoaXMubGlzdGVuZXJzW3R5cGVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgcmV0dXJuIGluZGV4ID4gLTE7XG4gIH1cbiAgLyoqXG4gICAqIFRyaWdnZXIgYW4gZXZlbnQgb2YgdGhlIHNwZWNpZmllZCB0eXBlIG9uIHRoaXMgc3RyZWFtLiBBbnkgYWRkaXRpb25hbFxuICAgKiBhcmd1bWVudHMgdG8gdGhpcyBmdW5jdGlvbiBhcmUgcGFzc2VkIGFzIHBhcmFtZXRlcnMgdG8gZXZlbnQgbGlzdGVuZXJzLlxuICAgKiBAcGFyYW0gdHlwZSB7c3RyaW5nfSB0aGUgZXZlbnQgbmFtZVxuICAgKi9cbiAgIHRyaWdnZXIodHlwZSkge1xuICAgIHZhciBjYWxsYmFja3MsIGksIGxlbmd0aCwgYXJncztcbiAgICBjYWxsYmFja3MgPSB0aGlzLmxpc3RlbmVyc1t0eXBlXTtcbiAgICBpZiAoIWNhbGxiYWNrcykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBTbGljaW5nIHRoZSBhcmd1bWVudHMgb24gZXZlcnkgaW52b2NhdGlvbiBvZiB0aGlzIG1ldGhvZFxuICAgIC8vIGNhbiBhZGQgYSBzaWduaWZpY2FudCBhbW91bnQgb2Ygb3ZlcmhlYWQuIEF2b2lkIHRoZVxuICAgIC8vIGludGVybWVkaWF0ZSBvYmplY3QgY3JlYXRpb24gZm9yIHRoZSBjb21tb24gY2FzZSBvZiBhXG4gICAgLy8gc2luZ2xlIGNhbGxiYWNrIGFyZ3VtZW50XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGxlbmd0aCA9IGNhbGxiYWNrcy5sZW5ndGg7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY2FsbGJhY2tzW2ldLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICBsZW5ndGggPSBjYWxsYmFja3MubGVuZ3RoO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIERlc3Ryb3lzIHRoZSBzdHJlYW0gYW5kIGNsZWFucyB1cC5cbiAgICovXG4gICBkaXNwb3NlKCkge1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gIH1cblxuXG4gIC8qKlxuICAgKiBGb3J3YXJkcyBhbGwgYGRhdGFgIGV2ZW50cyBvbiB0aGlzIHN0cmVhbSB0byB0aGUgZGVzdGluYXRpb24gc3RyZWFtLiBUaGVcbiAgICogZGVzdGluYXRpb24gc3RyZWFtIHNob3VsZCBwcm92aWRlIGEgbWV0aG9kIGBwdXNoYCB0byByZWNlaXZlIHRoZSBkYXRhXG4gICAqIGV2ZW50cyBhcyB0aGV5IGFycml2ZS5cbiAgICogQHBhcmFtIGRlc3RpbmF0aW9uIHtzdHJlYW19IHRoZSBzdHJlYW0gdGhhdCB3aWxsIHJlY2VpdmUgYWxsIGBkYXRhYCBldmVudHNcbiAgICogQHNlZSBodHRwOi8vbm9kZWpzLm9yZy9hcGkvc3RyZWFtLmh0bWwjc3RyZWFtX3JlYWRhYmxlX3BpcGVfZGVzdGluYXRpb25fb3B0aW9uc1xuICAgKi9cbiAgIHBpcGUoZGVzdGluYXRpb24pIHtcbiAgICB0aGlzLm9uKCdkYXRhJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgZGVzdGluYXRpb24ucHVzaChkYXRhKTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG5cbiJdfQ==
