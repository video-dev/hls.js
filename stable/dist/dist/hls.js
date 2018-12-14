typeof window !== "undefined" &&
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Hls"] = factory();
	else
		root["Hls"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/dist/";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/hls.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/eventemitter3/index.js":
/*!*********************************************!*\
  !*** ./node_modules/eventemitter3/index.js ***!
  \*********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var has = Object.prototype.hasOwnProperty
  , prefix = '~';

/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */
function Events() {}

//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
  Events.prototype = Object.create(null);

  //
  // This hack is needed because the `__proto__` property is still inherited in
  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
  //
  if (!new Events().__proto__) prefix = false;
}

/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */
function addListener(emitter, event, fn, context, once) {
  if (typeof fn !== 'function') {
    throw new TypeError('The listener must be a function');
  }

  var listener = new EE(fn, context || emitter, once)
    , evt = prefix ? prefix + event : event;

  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
  else emitter._events[evt] = [emitter._events[evt], listener];

  return emitter;
}

/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */
function clearEvent(emitter, evt) {
  if (--emitter._eventsCount === 0) emitter._events = new Events();
  else delete emitter._events[evt];
}

/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */
function EventEmitter() {
  this._events = new Events();
  this._eventsCount = 0;
}

/**
 * Return an array listing the events for which the emitter has registered
 * listeners.
 *
 * @returns {Array}
 * @public
 */
EventEmitter.prototype.eventNames = function eventNames() {
  var names = []
    , events
    , name;

  if (this._eventsCount === 0) return names;

  for (name in (events = this._events)) {
    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
  }

  if (Object.getOwnPropertySymbols) {
    return names.concat(Object.getOwnPropertySymbols(events));
  }

  return names;
};

/**
 * Return the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Array} The registered listeners.
 * @public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  var evt = prefix ? prefix + event : event
    , handlers = this._events[evt];

  if (!handlers) return [];
  if (handlers.fn) return [handlers.fn];

  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
    ee[i] = handlers[i].fn;
  }

  return ee;
};

/**
 * Return the number of listeners listening to a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Number} The number of listeners.
 * @public
 */
EventEmitter.prototype.listenerCount = function listenerCount(event) {
  var evt = prefix ? prefix + event : event
    , listeners = this._events[evt];

  if (!listeners) return 0;
  if (listeners.fn) return 1;
  return listeners.length;
};

/**
 * Calls each of the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Boolean} `true` if the event had listeners, else `false`.
 * @public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return false;

  var listeners = this._events[evt]
    , len = arguments.length
    , args
    , i;

  if (listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Add a listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  return addListener(this, event, fn, context, false);
};

/**
 * Add a one-time listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  return addListener(this, event, fn, context, true);
};

/**
 * Remove the listeners of a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn Only remove the listeners that match this function.
 * @param {*} context Only remove the listeners that have this context.
 * @param {Boolean} once Only remove one-time listeners.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return this;
  if (!fn) {
    clearEvent(this, evt);
    return this;
  }

  var listeners = this._events[evt];

  if (listeners.fn) {
    if (
      listeners.fn === fn &&
      (!once || listeners.once) &&
      (!context || listeners.context === context)
    ) {
      clearEvent(this, evt);
    }
  } else {
    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
      if (
        listeners[i].fn !== fn ||
        (once && !listeners[i].once) ||
        (context && listeners[i].context !== context)
      ) {
        events.push(listeners[i]);
      }
    }

    //
    // Reset the array, or remove it completely if we have no more listeners.
    //
    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
    else clearEvent(this, evt);
  }

  return this;
};

/**
 * Remove all listeners, or those of the specified event.
 *
 * @param {(String|Symbol)} [event] The event name.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  var evt;

  if (event) {
    evt = prefix ? prefix + event : event;
    if (this._events[evt]) clearEvent(this, evt);
  } else {
    this._events = new Events();
    this._eventsCount = 0;
  }

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;

//
// Allow `EventEmitter` to be imported as module namespace.
//
EventEmitter.EventEmitter = EventEmitter;

//
// Expose the module.
//
if (true) {
  module.exports = EventEmitter;
}


/***/ }),

/***/ "./node_modules/node-libs-browser/node_modules/events/events.js":
/*!**********************************************************************!*\
  !*** ./node_modules/node-libs-browser/node_modules/events/events.js ***!
  \**********************************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports) {

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
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
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
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
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
  } else if (listeners) {
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

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
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


/***/ }),

/***/ "./node_modules/url-toolkit/src/url-toolkit.js":
/*!*****************************************************!*\
  !*** ./node_modules/url-toolkit/src/url-toolkit.js ***!
  \*****************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

// see https://tools.ietf.org/html/rfc1808

/* jshint ignore:start */
(function(root) { 
/* jshint ignore:end */

  var URL_REGEX = /^((?:[a-zA-Z0-9+\-.]+:)?)(\/\/[^\/?#]*)?((?:[^\/\?#]*\/)*.*?)??(;.*?)?(\?.*?)?(#.*?)?$/;
  var FIRST_SEGMENT_REGEX = /^([^\/?#]*)(.*)$/;
  var SLASH_DOT_REGEX = /(?:\/|^)\.(?=\/)/g;
  var SLASH_DOT_DOT_REGEX = /(?:\/|^)\.\.\/(?!\.\.\/).*?(?=\/)/g;

  var URLToolkit = { // jshint ignore:line
    // If opts.alwaysNormalize is true then the path will always be normalized even when it starts with / or //
    // E.g
    // With opts.alwaysNormalize = false (default, spec compliant)
    // http://a.com/b/cd + /e/f/../g => http://a.com/e/f/../g
    // With opts.alwaysNormalize = true (not spec compliant)
    // http://a.com/b/cd + /e/f/../g => http://a.com/e/g
    buildAbsoluteURL: function(baseURL, relativeURL, opts) {
      opts = opts || {};
      // remove any remaining space and CRLF
      baseURL = baseURL.trim();
      relativeURL = relativeURL.trim();
      if (!relativeURL) {
        // 2a) If the embedded URL is entirely empty, it inherits the
        // entire base URL (i.e., is set equal to the base URL)
        // and we are done.
        if (!opts.alwaysNormalize) {
          return baseURL;
        }
        var basePartsForNormalise = URLToolkit.parseURL(baseURL);
        if (!basePartsForNormalise) {
          throw new Error('Error trying to parse base URL.');
        }
        basePartsForNormalise.path = URLToolkit.normalizePath(basePartsForNormalise.path);
        return URLToolkit.buildURLFromParts(basePartsForNormalise);
      }
      var relativeParts = URLToolkit.parseURL(relativeURL);
      if (!relativeParts) {
        throw new Error('Error trying to parse relative URL.');
      }
      if (relativeParts.scheme) {
        // 2b) If the embedded URL starts with a scheme name, it is
        // interpreted as an absolute URL and we are done.
        if (!opts.alwaysNormalize) {
          return relativeURL;
        }
        relativeParts.path = URLToolkit.normalizePath(relativeParts.path);
        return URLToolkit.buildURLFromParts(relativeParts);
      }
      var baseParts = URLToolkit.parseURL(baseURL);
      if (!baseParts) {
        throw new Error('Error trying to parse base URL.');
      }
      if (!baseParts.netLoc && baseParts.path && baseParts.path[0] !== '/') {
        // If netLoc missing and path doesn't start with '/', assume everthing before the first '/' is the netLoc
        // This causes 'example.com/a' to be handled as '//example.com/a' instead of '/example.com/a'
        var pathParts = FIRST_SEGMENT_REGEX.exec(baseParts.path);
        baseParts.netLoc = pathParts[1];
        baseParts.path = pathParts[2];
      }
      if (baseParts.netLoc && !baseParts.path) {
        baseParts.path = '/';
      }
      var builtParts = {
        // 2c) Otherwise, the embedded URL inherits the scheme of
        // the base URL.
        scheme: baseParts.scheme,
        netLoc: relativeParts.netLoc,
        path: null,
        params: relativeParts.params,
        query: relativeParts.query,
        fragment: relativeParts.fragment
      };
      if (!relativeParts.netLoc) {
        // 3) If the embedded URL's <net_loc> is non-empty, we skip to
        // Step 7.  Otherwise, the embedded URL inherits the <net_loc>
        // (if any) of the base URL.
        builtParts.netLoc = baseParts.netLoc;
        // 4) If the embedded URL path is preceded by a slash "/", the
        // path is not relative and we skip to Step 7.
        if (relativeParts.path[0] !== '/') {
          if (!relativeParts.path) {
            // 5) If the embedded URL path is empty (and not preceded by a
            // slash), then the embedded URL inherits the base URL path
            builtParts.path = baseParts.path;
            // 5a) if the embedded URL's <params> is non-empty, we skip to
            // step 7; otherwise, it inherits the <params> of the base
            // URL (if any) and
            if (!relativeParts.params) {
              builtParts.params = baseParts.params;
              // 5b) if the embedded URL's <query> is non-empty, we skip to
              // step 7; otherwise, it inherits the <query> of the base
              // URL (if any) and we skip to step 7.
              if (!relativeParts.query) {
                builtParts.query = baseParts.query;
              }
            }
          } else {
            // 6) The last segment of the base URL's path (anything
            // following the rightmost slash "/", or the entire path if no
            // slash is present) is removed and the embedded URL's path is
            // appended in its place.
            var baseURLPath = baseParts.path;
            var newPath = baseURLPath.substring(0, baseURLPath.lastIndexOf('/') + 1) + relativeParts.path;
            builtParts.path = URLToolkit.normalizePath(newPath);
          }
        }
      }
      if (builtParts.path === null) {
        builtParts.path = opts.alwaysNormalize ? URLToolkit.normalizePath(relativeParts.path) : relativeParts.path;
      }
      return URLToolkit.buildURLFromParts(builtParts);
    },
    parseURL: function(url) {
      var parts = URL_REGEX.exec(url);
      if (!parts) {
        return null;
      }
      return {
        scheme: parts[1] || '',
        netLoc: parts[2] || '',
        path: parts[3] || '',
        params: parts[4] || '',
        query: parts[5] || '',
        fragment: parts[6] || ''
      };
    },
    normalizePath: function(path) {
      // The following operations are
      // then applied, in order, to the new path:
      // 6a) All occurrences of "./", where "." is a complete path
      // segment, are removed.
      // 6b) If the path ends with "." as a complete path segment,
      // that "." is removed.
      path = path.split('').reverse().join('').replace(SLASH_DOT_REGEX, '');
      // 6c) All occurrences of "<segment>/../", where <segment> is a
      // complete path segment not equal to "..", are removed.
      // Removal of these path segments is performed iteratively,
      // removing the leftmost matching pattern on each iteration,
      // until no matching pattern remains.
      // 6d) If the path ends with "<segment>/..", where <segment> is a
      // complete path segment not equal to "..", that
      // "<segment>/.." is removed.
      while (path.length !== (path = path.replace(SLASH_DOT_DOT_REGEX, '')).length) {} // jshint ignore:line
      return path.split('').reverse().join('');
    },
    buildURLFromParts: function(parts) {
      return parts.scheme + parts.netLoc + parts.path + parts.params + parts.query + parts.fragment;
    }
  };

/* jshint ignore:start */
  if(true)
    module.exports = URLToolkit;
  else {}
})(this);
/* jshint ignore:end */


/***/ }),

/***/ "./node_modules/webworkify-webpack/index.js":
/*!**************************************************!*\
  !*** ./node_modules/webworkify-webpack/index.js ***!
  \**************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

function webpackBootstrapFunc (modules) {
/******/  // The module cache
/******/  var installedModules = {};

/******/  // The require function
/******/  function __webpack_require__(moduleId) {

/******/    // Check if module is in cache
/******/    if(installedModules[moduleId])
/******/      return installedModules[moduleId].exports;

/******/    // Create a new module (and put it into the cache)
/******/    var module = installedModules[moduleId] = {
/******/      i: moduleId,
/******/      l: false,
/******/      exports: {}
/******/    };

/******/    // Execute the module function
/******/    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/    // Flag the module as loaded
/******/    module.l = true;

/******/    // Return the exports of the module
/******/    return module.exports;
/******/  }

/******/  // expose the modules object (__webpack_modules__)
/******/  __webpack_require__.m = modules;

/******/  // expose the module cache
/******/  __webpack_require__.c = installedModules;

/******/  // identity function for calling harmony imports with the correct context
/******/  __webpack_require__.i = function(value) { return value; };

/******/  // define getter function for harmony exports
/******/  __webpack_require__.d = function(exports, name, getter) {
/******/    if(!__webpack_require__.o(exports, name)) {
/******/      Object.defineProperty(exports, name, {
/******/        configurable: false,
/******/        enumerable: true,
/******/        get: getter
/******/      });
/******/    }
/******/  };

/******/  // define __esModule on exports
/******/  __webpack_require__.r = function(exports) {
/******/    Object.defineProperty(exports, '__esModule', { value: true });
/******/  };

/******/  // getDefaultExport function for compatibility with non-harmony modules
/******/  __webpack_require__.n = function(module) {
/******/    var getter = module && module.__esModule ?
/******/      function getDefault() { return module['default']; } :
/******/      function getModuleExports() { return module; };
/******/    __webpack_require__.d(getter, 'a', getter);
/******/    return getter;
/******/  };

/******/  // Object.prototype.hasOwnProperty.call
/******/  __webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };

/******/  // __webpack_public_path__
/******/  __webpack_require__.p = "/";

/******/  // on error function for async loading
/******/  __webpack_require__.oe = function(err) { console.error(err); throw err; };

  var f = __webpack_require__(__webpack_require__.s = ENTRY_MODULE)
  return f.default || f // try to call default if defined to also support babel esmodule exports
}

var moduleNameReqExp = '[\\.|\\-|\\+|\\w|\/|@]+'
var dependencyRegExp = '\\((\/\\*.*?\\*\/)?\s?.*?(' + moduleNameReqExp + ').*?\\)' // additional chars when output.pathinfo is true

// http://stackoverflow.com/a/2593661/130442
function quoteRegExp (str) {
  return (str + '').replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&')
}

function isNumeric(n) {
  return !isNaN(1 * n); // 1 * n converts integers, integers as string ("123"), 1e3 and "1e3" to integers and strings to NaN
}

function getModuleDependencies (sources, module, queueName) {
  var retval = {}
  retval[queueName] = []

  var fnString = module.toString()
  var wrapperSignature = fnString.match(/^function\s?\(\w+,\s*\w+,\s*(\w+)\)/)
  if (!wrapperSignature) return retval
  var webpackRequireName = wrapperSignature[1]

  // main bundle deps
  var re = new RegExp('(\\\\n|\\W)' + quoteRegExp(webpackRequireName) + dependencyRegExp, 'g')
  var match
  while ((match = re.exec(fnString))) {
    if (match[3] === 'dll-reference') continue
    retval[queueName].push(match[3])
  }

  // dll deps
  re = new RegExp('\\(' + quoteRegExp(webpackRequireName) + '\\("(dll-reference\\s(' + moduleNameReqExp + '))"\\)\\)' + dependencyRegExp, 'g')
  while ((match = re.exec(fnString))) {
    if (!sources[match[2]]) {
      retval[queueName].push(match[1])
      sources[match[2]] = __webpack_require__(match[1]).m
    }
    retval[match[2]] = retval[match[2]] || []
    retval[match[2]].push(match[4])
  }

  // convert 1e3 back to 1000 - this can be important after uglify-js converted 1000 to 1e3
  var keys = Object.keys(retval);
  for (var i = 0; i < keys.length; i++) {
    for (var j = 0; j < retval[keys[i]].length; j++) {
      if (isNumeric(retval[keys[i]][j])) {
        retval[keys[i]][j] = 1 * retval[keys[i]][j];
      }
    }
  }

  return retval
}

function hasValuesInQueues (queues) {
  var keys = Object.keys(queues)
  return keys.reduce(function (hasValues, key) {
    return hasValues || queues[key].length > 0
  }, false)
}

function getRequiredModules (sources, moduleId) {
  var modulesQueue = {
    main: [moduleId]
  }
  var requiredModules = {
    main: []
  }
  var seenModules = {
    main: {}
  }

  while (hasValuesInQueues(modulesQueue)) {
    var queues = Object.keys(modulesQueue)
    for (var i = 0; i < queues.length; i++) {
      var queueName = queues[i]
      var queue = modulesQueue[queueName]
      var moduleToCheck = queue.pop()
      seenModules[queueName] = seenModules[queueName] || {}
      if (seenModules[queueName][moduleToCheck] || !sources[queueName][moduleToCheck]) continue
      seenModules[queueName][moduleToCheck] = true
      requiredModules[queueName] = requiredModules[queueName] || []
      requiredModules[queueName].push(moduleToCheck)
      var newModules = getModuleDependencies(sources, sources[queueName][moduleToCheck], queueName)
      var newModulesKeys = Object.keys(newModules)
      for (var j = 0; j < newModulesKeys.length; j++) {
        modulesQueue[newModulesKeys[j]] = modulesQueue[newModulesKeys[j]] || []
        modulesQueue[newModulesKeys[j]] = modulesQueue[newModulesKeys[j]].concat(newModules[newModulesKeys[j]])
      }
    }
  }

  return requiredModules
}

module.exports = function (moduleId, options) {
  options = options || {}
  var sources = {
    main: __webpack_require__.m
  }

  var requiredModules = options.all ? { main: Object.keys(sources.main) } : getRequiredModules(sources, moduleId)

  var src = ''

  Object.keys(requiredModules).filter(function (m) { return m !== 'main' }).forEach(function (module) {
    var entryModule = 0
    while (requiredModules[module][entryModule]) {
      entryModule++
    }
    requiredModules[module].push(entryModule)
    sources[module][entryModule] = '(function(module, exports, __webpack_require__) { module.exports = __webpack_require__; })'
    src = src + 'var ' + module + ' = (' + webpackBootstrapFunc.toString().replace('ENTRY_MODULE', JSON.stringify(entryModule)) + ')({' + requiredModules[module].map(function (id) { return '' + JSON.stringify(id) + ': ' + sources[module][id].toString() }).join(',') + '});\n'
  })

  src = src + 'new ((' + webpackBootstrapFunc.toString().replace('ENTRY_MODULE', JSON.stringify(moduleId)) + ')({' + requiredModules.main.map(function (id) { return '' + JSON.stringify(id) + ': ' + sources.main[id].toString() }).join(',') + '}))(self);'

  var blob = new window.Blob([src], { type: 'text/javascript' })
  if (options.bare) { return blob }

  var URL = window.URL || window.webkitURL || window.mozURL || window.msURL

  var workerUrl = URL.createObjectURL(blob)
  var worker = new window.Worker(workerUrl)
  worker.objectURL = workerUrl

  return worker
}


/***/ }),

/***/ "./src/config.js":
/*!***********************!*\
  !*** ./src/config.js ***!
  \***********************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * HLS config
 */
Object.defineProperty(exports, "__esModule", { value: true });
var abr_controller_1 = __webpack_require__(/*! ./controller/abr-controller */ "./src/controller/abr-controller.js");
var buffer_controller_1 = __webpack_require__(/*! ./controller/buffer-controller */ "./src/controller/buffer-controller.js");
var cap_level_controller_1 = __webpack_require__(/*! ./controller/cap-level-controller */ "./src/controller/cap-level-controller.js");
var fps_controller_1 = __webpack_require__(/*! ./controller/fps-controller */ "./src/controller/fps-controller.js");
var xhr_loader_1 = __webpack_require__(/*! ./utils/xhr-loader */ "./src/utils/xhr-loader.js");
// import FetchLoader from './utils/fetch-loader';
var audio_track_controller_1 = __webpack_require__(/*! ./controller/audio-track-controller */ "./src/controller/audio-track-controller.js");
var audio_stream_controller_1 = __webpack_require__(/*! ./controller/audio-stream-controller */ "./src/controller/audio-stream-controller.js");
var Cues = __webpack_require__(/*! ./utils/cues */ "./src/utils/cues.js");
var timeline_controller_1 = __webpack_require__(/*! ./controller/timeline-controller */ "./src/controller/timeline-controller.js");
var subtitle_track_controller_1 = __webpack_require__(/*! ./controller/subtitle-track-controller */ "./src/controller/subtitle-track-controller.js");
var subtitle_stream_controller_1 = __webpack_require__(/*! ./controller/subtitle-stream-controller */ "./src/controller/subtitle-stream-controller.js");
var eme_controller_1 = __webpack_require__(/*! ./controller/eme-controller */ "./src/controller/eme-controller.js");
var mediakeys_helper_1 = __webpack_require__(/*! ./utils/mediakeys-helper */ "./src/utils/mediakeys-helper.js");
exports.hlsDefaultConfig = {
    autoStartLoad: true,
    startPosition: -1,
    defaultAudioCodec: undefined,
    debug: false,
    capLevelOnFPSDrop: false,
    capLevelToPlayerSize: false,
    initialLiveManifestSize: 1,
    maxBufferLength: 30,
    maxBufferSize: 60 * 1000 * 1000,
    maxBufferHole: 0.5,
    lowBufferWatchdogPeriod: 0.5,
    highBufferWatchdogPeriod: 3,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 3,
    maxFragLookUpTolerance: 0.25,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: Infinity,
    liveSyncDuration: undefined,
    liveMaxLatencyDuration: undefined,
    liveDurationInfinity: false,
    liveBackBufferLength: Infinity,
    maxMaxBufferLength: 600,
    enableWorker: true,
    enableSoftwareAES: true,
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 1,
    manifestLoadingRetryDelay: 1000,
    manifestLoadingMaxRetryTimeout: 64000,
    startLevel: undefined,
    levelLoadingTimeOut: 10000,
    levelLoadingMaxRetry: 4,
    levelLoadingRetryDelay: 1000,
    levelLoadingMaxRetryTimeout: 64000,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
    fragLoadingMaxRetryTimeout: 64000,
    startFragPrefetch: false,
    fpsDroppedMonitoringPeriod: 5000,
    fpsDroppedMonitoringThreshold: 0.2,
    appendErrorMaxRetry: 3,
    loader: xhr_loader_1.default,
    // loader: FetchLoader,
    fLoader: undefined,
    pLoader: undefined,
    xhrSetup: undefined,
    licenseXhrSetup: undefined,
    // fetchSetup: undefined,
    abrController: abr_controller_1.default,
    bufferController: buffer_controller_1.default,
    capLevelController: cap_level_controller_1.default,
    fpsController: fps_controller_1.default,
    stretchShortVideoTrack: false,
    maxAudioFramesDrift: 1,
    forceKeyFrameOnDiscontinuity: true,
    abrEwmaFastLive: 3,
    abrEwmaSlowLive: 9,
    abrEwmaFastVoD: 3,
    abrEwmaSlowVoD: 9,
    abrEwmaDefaultEstimate: 5e5,
    abrBandWidthFactor: 0.95,
    abrBandWidthUpFactor: 0.7,
    abrMaxWithRealBitrate: false,
    maxStarvationDelay: 4,
    maxLoadingDelay: 4,
    minAutoBitrate: 0,
    emeEnabled: false,
    widevineLicenseUrl: undefined,
    requestMediaKeySystemAccessFunc: mediakeys_helper_1.requestMediaKeySystemAccess // used by eme-controller
};
if (true) {
    exports.hlsDefaultConfig.subtitleStreamController = subtitle_stream_controller_1.SubtitleStreamController;
    exports.hlsDefaultConfig.subtitleTrackController = subtitle_track_controller_1.default;
    exports.hlsDefaultConfig.timelineController = timeline_controller_1.default;
    exports.hlsDefaultConfig.cueHandler = Cues; // used by timeline-controller
    exports.hlsDefaultConfig.enableCEA708Captions = true; // used by timeline-controller
    exports.hlsDefaultConfig.enableWebVTT = true; // used by timeline-controller
    exports.hlsDefaultConfig.captionsTextTrack1Label = 'English'; // used by timeline-controller
    exports.hlsDefaultConfig.captionsTextTrack1LanguageCode = 'en'; // used by timeline-controller
    exports.hlsDefaultConfig.captionsTextTrack2Label = 'Spanish'; // used by timeline-controller
    exports.hlsDefaultConfig.captionsTextTrack2LanguageCode = 'es'; // used by timeline-controller
}
if (true) {
    exports.hlsDefaultConfig.audioStreamController = audio_stream_controller_1.default;
    exports.hlsDefaultConfig.audioTrackController = audio_track_controller_1.default;
}
if (true) {
    exports.hlsDefaultConfig.emeController = eme_controller_1.default;
}


/***/ }),

/***/ "./src/controller/abr-controller.js":
/*!******************************************!*\
  !*** ./src/controller/abr-controller.js ***!
  \******************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/*
 * simple ABR Controller
 *  - compute next level based on last fragment bw heuristics
 *  - implement an abandon rules triggered if we have less than 2 frag buffered and if computed bw shows that we risk buffer stalling
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var buffer_helper_1 = __webpack_require__(/*! ../utils/buffer-helper */ "./src/utils/buffer-helper.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var ewma_bandwidth_estimator_1 = __webpack_require__(/*! ../utils/ewma-bandwidth-estimator */ "./src/utils/ewma-bandwidth-estimator.js");
var performance = window.performance;
var AbrController = /** @class */ (function (_super) {
    __extends(AbrController, _super);
    function AbrController(hls) {
        var _this = _super.call(this, hls, events_1.default.FRAG_LOADING, events_1.default.FRAG_LOADED, events_1.default.FRAG_BUFFERED, events_1.default.ERROR) || this;
        _this.lastLoadedFragLevel = 0;
        _this._nextAutoLevel = -1;
        _this.hls = hls;
        _this.timer = null;
        _this._bwEstimator = null;
        _this.onCheck = _this._abandonRulesCheck.bind(_this);
        return _this;
    }
    AbrController.prototype.destroy = function () {
        this.clearTimer();
        event_handler_1.default.prototype.destroy.call(this);
    };
    AbrController.prototype.onFragLoading = function (data) {
        var frag = data.frag;
        if (frag.type === 'main') {
            if (!this.timer) {
                this.fragCurrent = frag;
                this.timer = setInterval(this.onCheck, 100);
            }
            // lazy init of BwEstimator, rationale is that we use different params for Live/VoD
            // so we need to wait for stream manifest / playlist type to instantiate it.
            if (!this._bwEstimator) {
                var hls_1 = this.hls;
                var config = hls_1.config;
                var level = frag.level;
                var isLive = hls_1.levels[level].details.live;
                var ewmaFast = void 0, ewmaSlow = void 0;
                if (isLive) {
                    ewmaFast = config.abrEwmaFastLive;
                    ewmaSlow = config.abrEwmaSlowLive;
                }
                else {
                    ewmaFast = config.abrEwmaFastVoD;
                    ewmaSlow = config.abrEwmaSlowVoD;
                }
                this._bwEstimator = new ewma_bandwidth_estimator_1.default(hls_1, ewmaSlow, ewmaFast, config.abrEwmaDefaultEstimate);
            }
        }
    };
    AbrController.prototype._abandonRulesCheck = function () {
        /*
          monitor fragment retrieval time...
          we compute expected time of arrival of the complete fragment.
          we compare it to expected time of buffer starvation
        */
        var hls = this.hls;
        var video = hls.media;
        var frag = this.fragCurrent;
        if (!frag) {
            return;
        }
        var loader = frag.loader;
        var minAutoLevel = hls.minAutoLevel;
        // if loader has been destroyed or loading has been aborted, stop timer and return
        if (!loader || (loader.stats && loader.stats.aborted)) {
            logger_1.logger.warn('frag loader destroy or aborted, disarm abandonRules');
            this.clearTimer();
            // reset forced auto level value so that next level will be selected
            this._nextAutoLevel = -1;
            return;
        }
        var stats = loader.stats;
        /* only monitor frag retrieval time if
        (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
        if (video && stats && ((!video.paused && (video.playbackRate !== 0)) || !video.readyState) && frag.autoLevel && frag.level) {
            var requestDelay = performance.now() - stats.trequest, playbackRate = Math.abs(video.playbackRate);
            // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
            if (requestDelay > (500 * frag.duration / playbackRate)) {
                var levels = hls.levels, loadRate = Math.max(1, stats.bw ? stats.bw / 8 : stats.loaded * 1000 / requestDelay), // byte/s; at least 1 byte/s to avoid division by zero
                // compute expected fragment length using frag duration and level bitrate. also ensure that expected len is gte than already loaded size
                level = levels[frag.level], levelBitrate = level.realBitrate ? Math.max(level.realBitrate, level.bitrate) : level.bitrate, expectedLen = stats.total ? stats.total : Math.max(stats.loaded, Math.round(frag.duration * levelBitrate / 8)), pos = video.currentTime, fragLoadedDelay = (expectedLen - stats.loaded) / loadRate, bufferStarvationDelay = (buffer_helper_1.BufferHelper.bufferInfo(video, pos, hls.config.maxBufferHole).end - pos) / playbackRate;
                // consider emergency switch down only if we have less than 2 frag buffered AND
                // time to finish loading current fragment is bigger than buffer starvation delay
                // ie if we risk buffer starvation if bw does not increase quickly
                if ((bufferStarvationDelay < (2 * frag.duration / playbackRate)) && (fragLoadedDelay > bufferStarvationDelay)) {
                    var fragLevelNextLoadedDelay = void 0, nextLoadLevel = void 0;
                    // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
                    // we start from current level - 1 and we step down , until we find a matching level
                    for (nextLoadLevel = frag.level - 1; nextLoadLevel > minAutoLevel; nextLoadLevel--) {
                        // compute time to load next fragment at lower level
                        // 0.8 : consider only 80% of current bw to be conservative
                        // 8 = bits per byte (bps/Bps)
                        var levelNextBitrate = levels[nextLoadLevel].realBitrate ? Math.max(levels[nextLoadLevel].realBitrate, levels[nextLoadLevel].bitrate) : levels[nextLoadLevel].bitrate;
                        fragLevelNextLoadedDelay = frag.duration * levelNextBitrate / (8 * 0.8 * loadRate);
                        if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
                            // we found a lower level that be rebuffering free with current estimated bw !
                            break;
                        }
                    }
                    // only emergency switch down if it takes less time to load new fragment at lowest level instead
                    // of finishing loading current one ...
                    if (fragLevelNextLoadedDelay < fragLoadedDelay) {
                        logger_1.logger.warn("loading too slow, abort fragment loading and switch to level " + nextLoadLevel + ":fragLoadedDelay[" + nextLoadLevel + "]<fragLoadedDelay[" + (frag.level - 1) + "];bufferStarvationDelay:" + fragLevelNextLoadedDelay.toFixed(1) + "<" + fragLoadedDelay.toFixed(1) + ":" + bufferStarvationDelay.toFixed(1));
                        // force next load level in auto mode
                        hls.nextLoadLevel = nextLoadLevel;
                        // update bw estimate for this fragment before cancelling load (this will help reducing the bw)
                        this._bwEstimator.sample(requestDelay, stats.loaded);
                        // abort fragment loading
                        loader.abort();
                        // stop abandon rules timer
                        this.clearTimer();
                        hls.trigger(events_1.default.FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag, stats: stats });
                    }
                }
            }
        }
    };
    AbrController.prototype.onFragLoaded = function (data) {
        var frag = data.frag;
        if (frag.type === 'main' && Number.isFinite(frag.sn)) {
            // stop monitoring bw once frag loaded
            this.clearTimer();
            // store level id after successful fragment load
            this.lastLoadedFragLevel = frag.level;
            // reset forced auto level value so that next level will be selected
            this._nextAutoLevel = -1;
            // compute level average bitrate
            if (this.hls.config.abrMaxWithRealBitrate) {
                var level = this.hls.levels[frag.level];
                var loadedBytes = (level.loaded ? level.loaded.bytes : 0) + data.stats.loaded;
                var loadedDuration = (level.loaded ? level.loaded.duration : 0) + data.frag.duration;
                level.loaded = { bytes: loadedBytes, duration: loadedDuration };
                level.realBitrate = Math.round(8 * loadedBytes / loadedDuration);
            }
            // if fragment has been loaded to perform a bitrate test,
            if (data.frag.bitrateTest) {
                var stats = data.stats;
                stats.tparsed = stats.tbuffered = stats.tload;
                this.onFragBuffered(data);
            }
        }
    };
    AbrController.prototype.onFragBuffered = function (data) {
        var stats = data.stats;
        var frag = data.frag;
        // only update stats on first frag buffering
        // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
        // and leading to wrong bw estimation
        // on bitrate test, also only update stats once (if tload = tbuffered == on FRAG_LOADED)
        if (stats.aborted !== true && frag.type === 'main' && Number.isFinite(frag.sn) && ((!frag.bitrateTest || stats.tload === stats.tbuffered))) {
            // use tparsed-trequest instead of tbuffered-trequest to compute fragLoadingProcessing; rationale is that  buffer appending only happens once media is attached
            // in case we use config.startFragPrefetch while media is not attached yet, fragment might be parsed while media not attached yet, but it will only be buffered on media attached
            // as a consequence it could happen really late in the process. meaning that appending duration might appears huge ... leading to underestimated throughput estimation
            var fragLoadingProcessingMs = stats.tparsed - stats.trequest;
            logger_1.logger.log("latency/loading/parsing/append/kbps:" + Math.round(stats.tfirst - stats.trequest) + "/" + Math.round(stats.tload - stats.tfirst) + "/" + Math.round(stats.tparsed - stats.tload) + "/" + Math.round(stats.tbuffered - stats.tparsed) + "/" + Math.round(8 * stats.loaded / (stats.tbuffered - stats.trequest)));
            this._bwEstimator.sample(fragLoadingProcessingMs, stats.loaded);
            stats.bwEstimate = this._bwEstimator.getEstimate();
            // if fragment has been loaded to perform a bitrate test, (hls.startLevel = -1), store bitrate test delay duration
            if (frag.bitrateTest) {
                this.bitrateTestDelay = fragLoadingProcessingMs / 1000;
            }
            else {
                this.bitrateTestDelay = 0;
            }
        }
    };
    AbrController.prototype.onError = function (data) {
        // stop timer in case of frag loading error
        switch (data.details) {
            case errors_1.ErrorDetails.FRAG_LOAD_ERROR:
            case errors_1.ErrorDetails.FRAG_LOAD_TIMEOUT:
                this.clearTimer();
                break;
            default:
                break;
        }
    };
    AbrController.prototype.clearTimer = function () {
        clearInterval(this.timer);
        this.timer = null;
    };
    Object.defineProperty(AbrController.prototype, "nextAutoLevel", {
        // return next auto level
        get: function () {
            var forcedAutoLevel = this._nextAutoLevel;
            var bwEstimator = this._bwEstimator;
            // in case next auto level has been forced, and bw not available or not reliable, return forced value
            if (forcedAutoLevel !== -1 && (!bwEstimator || !bwEstimator.canEstimate())) {
                return forcedAutoLevel;
            }
            // compute next level using ABR logic
            var nextABRAutoLevel = this._nextABRAutoLevel;
            // if forced auto level has been defined, use it to cap ABR computed quality level
            if (forcedAutoLevel !== -1) {
                nextABRAutoLevel = Math.min(forcedAutoLevel, nextABRAutoLevel);
            }
            return nextABRAutoLevel;
        },
        set: function (nextLevel) {
            this._nextAutoLevel = nextLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AbrController.prototype, "_nextABRAutoLevel", {
        get: function () {
            var hls = this.hls, maxAutoLevel = hls.maxAutoLevel, levels = hls.levels, config = hls.config, minAutoLevel = hls.minAutoLevel;
            var video = hls.media, currentLevel = this.lastLoadedFragLevel, currentFragDuration = this.fragCurrent ? this.fragCurrent.duration : 0, pos = (video ? video.currentTime : 0), 
            // playbackRate is the absolute value of the playback rate; if video.playbackRate is 0, we use 1 to load as
            // if we're playing back at the normal rate.
            playbackRate = ((video && (video.playbackRate !== 0)) ? Math.abs(video.playbackRate) : 1.0), avgbw = this._bwEstimator ? this._bwEstimator.getEstimate() : config.abrEwmaDefaultEstimate, 
            // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
            bufferStarvationDelay = (buffer_helper_1.BufferHelper.bufferInfo(video, pos, config.maxBufferHole).end - pos) / playbackRate;
            // First, look to see if we can find a level matching with our avg bandwidth AND that could also guarantee no rebuffering at all
            var bestLevel = this._findBestLevel(currentLevel, currentFragDuration, avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay, config.abrBandWidthFactor, config.abrBandWidthUpFactor, levels);
            if (bestLevel >= 0) {
                return bestLevel;
            }
            else {
                logger_1.logger.trace('rebuffering expected to happen, lets try to find a quality level minimizing the rebuffering');
                // not possible to get rid of rebuffering ... let's try to find level that will guarantee less than maxStarvationDelay of rebuffering
                // if no matching level found, logic will return 0
                var maxStarvationDelay = currentFragDuration ? Math.min(currentFragDuration, config.maxStarvationDelay) : config.maxStarvationDelay, bwFactor = config.abrBandWidthFactor, bwUpFactor = config.abrBandWidthUpFactor;
                if (bufferStarvationDelay === 0) {
                    // in case buffer is empty, let's check if previous fragment was loaded to perform a bitrate test
                    var bitrateTestDelay = this.bitrateTestDelay;
                    if (bitrateTestDelay) {
                        // if it is the case, then we need to adjust our max starvation delay using maxLoadingDelay config value
                        // max video loading delay used in  automatic start level selection :
                        // in that mode ABR controller will ensure that video loading time (ie the time to fetch the first fragment at lowest quality level +
                        // the time to fetch the fragment at the appropriate quality level is less than ```maxLoadingDelay``` )
                        // cap maxLoadingDelay and ensure it is not bigger 'than bitrate test' frag duration
                        var maxLoadingDelay = currentFragDuration ? Math.min(currentFragDuration, config.maxLoadingDelay) : config.maxLoadingDelay;
                        maxStarvationDelay = maxLoadingDelay - bitrateTestDelay;
                        logger_1.logger.trace("bitrate test took " + Math.round(1000 * bitrateTestDelay) + "ms, set first fragment max fetchDuration to " + Math.round(1000 * maxStarvationDelay) + " ms");
                        // don't use conservative factor on bitrate test
                        bwFactor = bwUpFactor = 1;
                    }
                }
                bestLevel = this._findBestLevel(currentLevel, currentFragDuration, avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay + maxStarvationDelay, bwFactor, bwUpFactor, levels);
                return Math.max(bestLevel, 0);
            }
        },
        enumerable: true,
        configurable: true
    });
    AbrController.prototype._findBestLevel = function (currentLevel, currentFragDuration, currentBw, minAutoLevel, maxAutoLevel, maxFetchDuration, bwFactor, bwUpFactor, levels) {
        for (var i = maxAutoLevel; i >= minAutoLevel; i--) {
            var levelInfo = levels[i];
            if (!levelInfo) {
                continue;
            }
            var levelDetails = levelInfo.details, avgDuration = levelDetails ? levelDetails.totalduration / levelDetails.fragments.length : currentFragDuration, live = levelDetails ? levelDetails.live : false, adjustedbw = void 0;
            // follow algorithm captured from stagefright :
            // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
            // Pick the highest bandwidth stream below or equal to estimated bandwidth.
            // consider only 80% of the available bandwidth, but if we are switching up,
            // be even more conservative (70%) to avoid overestimating and immediately
            // switching back.
            if (i <= currentLevel) {
                adjustedbw = bwFactor * currentBw;
            }
            else {
                adjustedbw = bwUpFactor * currentBw;
            }
            var bitrate = levels[i].realBitrate ? Math.max(levels[i].realBitrate, levels[i].bitrate) : levels[i].bitrate, fetchDuration = bitrate * avgDuration / adjustedbw;
            logger_1.logger.trace("level/adjustedbw/bitrate/avgDuration/maxFetchDuration/fetchDuration: " + i + "/" + Math.round(adjustedbw) + "/" + bitrate + "/" + avgDuration + "/" + maxFetchDuration + "/" + fetchDuration);
            // if adjusted bw is greater than level bitrate AND
            if (adjustedbw > bitrate &&
                // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
                // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
                // special case to support startLevel = -1 (bitrateTest) on live streams : in that case we should not exit loop so that _findBestLevel will return -1
                (!fetchDuration || (live && !this.bitrateTestDelay) || fetchDuration < maxFetchDuration)) {
                // as we are looping from highest to lowest, this will return the best achievable quality level
                return i;
            }
        }
        // not enough time budget even with quality level 0 ... rebuffering might happen
        return -1;
    };
    return AbrController;
}(event_handler_1.default));
exports.default = AbrController;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/audio-stream-controller.js":
/*!***************************************************!*\
  !*** ./src/controller/audio-stream-controller.js ***!
  \***************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/*
 * Audio Stream Controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var binary_search_1 = __webpack_require__(/*! ../utils/binary-search */ "./src/utils/binary-search.js");
var buffer_helper_1 = __webpack_require__(/*! ../utils/buffer-helper */ "./src/utils/buffer-helper.js");
var demuxer_1 = __webpack_require__(/*! ../demux/demuxer */ "./src/demux/demuxer.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var LevelHelper = __webpack_require__(/*! ./level-helper */ "./src/controller/level-helper.js");
var time_ranges_1 = __webpack_require__(/*! ../utils/time-ranges */ "./src/utils/time-ranges.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var discontinuities_1 = __webpack_require__(/*! ../utils/discontinuities */ "./src/utils/discontinuities.js");
var fragment_tracker_1 = __webpack_require__(/*! ./fragment-tracker */ "./src/controller/fragment-tracker.js");
var fragment_1 = __webpack_require__(/*! ../loader/fragment */ "./src/loader/fragment.js");
var base_stream_controller_1 = __webpack_require__(/*! ./base-stream-controller */ "./src/controller/base-stream-controller.js");
var performance = window.performance;
var TICK_INTERVAL = 100; // how often to tick in ms
var AudioStreamController = /** @class */ (function (_super) {
    __extends(AudioStreamController, _super);
    function AudioStreamController(hls, fragmentTracker) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHED, events_1.default.MEDIA_DETACHING, events_1.default.AUDIO_TRACKS_UPDATED, events_1.default.AUDIO_TRACK_SWITCHING, events_1.default.AUDIO_TRACK_LOADED, events_1.default.KEY_LOADED, events_1.default.FRAG_LOADED, events_1.default.FRAG_PARSING_INIT_SEGMENT, events_1.default.FRAG_PARSING_DATA, events_1.default.FRAG_PARSED, events_1.default.ERROR, events_1.default.BUFFER_RESET, events_1.default.BUFFER_CREATED, events_1.default.BUFFER_APPENDED, events_1.default.BUFFER_FLUSHED, events_1.default.INIT_PTS_FOUND) || this;
        _this.fragmentTracker = fragmentTracker;
        _this.config = hls.config;
        _this.audioCodecSwap = false;
        _this._state = base_stream_controller_1.State.STOPPED;
        _this.initPTS = [];
        _this.waitingFragment = null;
        _this.videoTrackCC = null;
        return _this;
    }
    AudioStreamController.prototype.onHandlerDestroying = function () {
        this.stopLoad();
        _super.prototype.onHandlerDestroying.call(this);
    };
    AudioStreamController.prototype.onHandlerDestroyed = function () {
        this.state = base_stream_controller_1.State.STOPPED;
        this.fragmentTracker = null;
        _super.prototype.onHandlerDestroyed.call(this);
    };
    // Signal that video PTS was found
    AudioStreamController.prototype.onInitPtsFound = function (data) {
        var demuxerId = data.id, cc = data.frag.cc, initPTS = data.initPTS;
        if (demuxerId === 'main') {
            // Always update the new INIT PTS
            // Can change due level switch
            this.initPTS[cc] = initPTS;
            this.videoTrackCC = cc;
            logger_1.logger.log("InitPTS for cc: " + cc + " found from video track: " + initPTS);
            // If we are waiting we need to demux/remux the waiting frag
            // With the new initPTS
            if (this.state === base_stream_controller_1.State.WAITING_INIT_PTS) {
                this.tick();
            }
        }
    };
    AudioStreamController.prototype.startLoad = function (startPosition) {
        if (this.tracks) {
            var lastCurrentTime = this.lastCurrentTime;
            this.stopLoad();
            this.setInterval(TICK_INTERVAL);
            this.fragLoadError = 0;
            if (lastCurrentTime > 0 && startPosition === -1) {
                logger_1.logger.log("audio:override startPosition with lastCurrentTime @" + lastCurrentTime.toFixed(3));
                this.state = base_stream_controller_1.State.IDLE;
            }
            else {
                this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
                this.state = base_stream_controller_1.State.STARTING;
            }
            this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
            this.tick();
        }
        else {
            this.startPosition = startPosition;
            this.state = base_stream_controller_1.State.STOPPED;
        }
    };
    AudioStreamController.prototype.stopLoad = function () {
        var frag = this.fragCurrent;
        if (frag) {
            if (frag.loader) {
                frag.loader.abort();
            }
            this.fragmentTracker.removeFragment(frag);
            this.fragCurrent = null;
        }
        this.fragPrevious = null;
        if (this.demuxer) {
            this.demuxer.destroy();
            this.demuxer = null;
        }
        this.state = base_stream_controller_1.State.STOPPED;
    };
    Object.defineProperty(AudioStreamController.prototype, "state", {
        get: function () {
            return this._state;
        },
        set: function (nextState) {
            if (this.state !== nextState) {
                var previousState = this.state;
                this._state = nextState;
                logger_1.logger.log("audio stream:" + previousState + "->" + nextState);
            }
        },
        enumerable: true,
        configurable: true
    });
    AudioStreamController.prototype.doTick = function () {
        var pos, track, trackDetails, hls = this.hls, config = hls.config;
        // logger.log('audioStream:' + this.state);
        switch (this.state) {
            case base_stream_controller_1.State.ERROR:
            // don't do anything in error state to avoid breaking further ...
            case base_stream_controller_1.State.PAUSED:
            // don't do anything in paused state either ...
            case base_stream_controller_1.State.BUFFER_FLUSHING:
                break;
            case base_stream_controller_1.State.STARTING:
                this.state = base_stream_controller_1.State.WAITING_TRACK;
                this.loadedmetadata = false;
                break;
            case base_stream_controller_1.State.IDLE:
                var tracks = this.tracks;
                // audio tracks not received => exit loop
                if (!tracks) {
                    break;
                }
                // if video not attached AND
                // start fragment already requested OR start frag prefetch disable
                // exit loop
                // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
                if (!this.media &&
                    (this.startFragRequested || !config.startFragPrefetch)) {
                    break;
                }
                // determine next candidate fragment to be loaded, based on current position and
                //  end of buffer position
                // if we have not yet loaded any fragment, start loading from start position
                if (this.loadedmetadata) {
                    pos = this.media.currentTime;
                }
                else {
                    pos = this.nextLoadPosition;
                    if (pos === undefined) {
                        break;
                    }
                }
                var media = this.mediaBuffer ? this.mediaBuffer : this.media, videoBuffer = this.videoBuffer ? this.videoBuffer : this.media, bufferInfo = buffer_helper_1.BufferHelper.bufferInfo(media, pos, config.maxBufferHole), mainBufferInfo = buffer_helper_1.BufferHelper.bufferInfo(videoBuffer, pos, config.maxBufferHole), bufferLen = bufferInfo.len, bufferEnd_1 = bufferInfo.end, fragPrevious = this.fragPrevious, 
                // ensure we buffer at least config.maxBufferLength (default 30s) or config.maxMaxBufferLength (default: 600s)
                // whichever is smaller.
                // once we reach that threshold, don't buffer more than video (mainBufferInfo.len)
                maxConfigBuffer = Math.min(config.maxBufferLength, config.maxMaxBufferLength), maxBufLen = Math.max(maxConfigBuffer, mainBufferInfo.len), audioSwitch = this.audioSwitch, trackId = this.trackId;
                // if buffer length is less than maxBufLen try to load a new fragment
                if ((bufferLen < maxBufLen || audioSwitch) && trackId < tracks.length) {
                    trackDetails = tracks[trackId].details;
                    // if track info not retrieved yet, switch state and wait for track retrieval
                    if (typeof trackDetails === 'undefined') {
                        this.state = base_stream_controller_1.State.WAITING_TRACK;
                        break;
                    }
                    if (!audioSwitch && this._streamEnded(bufferInfo, trackDetails)) {
                        this.hls.trigger(events_1.default.BUFFER_EOS, { type: 'audio' });
                        this.state = base_stream_controller_1.State.ENDED;
                        return;
                    }
                    // find fragment index, contiguous with end of buffer position
                    var fragments = trackDetails.fragments, fragLen = fragments.length, start = fragments[0].start, end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration, frag = void 0;
                    // When switching audio track, reload audio as close as possible to currentTime
                    if (audioSwitch) {
                        if (trackDetails.live && !trackDetails.PTSKnown) {
                            logger_1.logger.log('switching audiotrack, live stream, unknown PTS,load first fragment');
                            bufferEnd_1 = 0;
                        }
                        else {
                            bufferEnd_1 = pos;
                            // if currentTime (pos) is less than alt audio playlist start time, it means that alt audio is ahead of currentTime
                            if (trackDetails.PTSKnown && pos < start) {
                                // if everything is buffered from pos to start or if audio buffer upfront, let's seek to start
                                if (bufferInfo.end > start || bufferInfo.nextStart) {
                                    logger_1.logger.log('alt audio track ahead of main track, seek to start of alt audio track');
                                    this.media.currentTime = start + 0.05;
                                }
                                else {
                                    return;
                                }
                            }
                        }
                    }
                    if (trackDetails.initSegment && !trackDetails.initSegment.data) {
                        frag = trackDetails.initSegment;
                    } // eslint-disable-line brace-style
                    // if bufferEnd before start of playlist, load first fragment
                    else if (bufferEnd_1 <= start) {
                        frag = fragments[0];
                        if (this.videoTrackCC !== null && frag.cc !== this.videoTrackCC) {
                            // Ensure we find a fragment which matches the continuity of the video track
                            frag = discontinuities_1.findFragWithCC(fragments, this.videoTrackCC);
                        }
                        if (trackDetails.live && frag.loadIdx && frag.loadIdx === this.fragLoadIdx) {
                            // we just loaded this first fragment, and we are still lagging behind the start of the live playlist
                            // let's force seek to start
                            var nextBuffered = bufferInfo.nextStart ? bufferInfo.nextStart : start;
                            logger_1.logger.log("no alt audio available @currentTime:" + this.media.currentTime + ", seeking @" + (nextBuffered + 0.05));
                            this.media.currentTime = nextBuffered + 0.05;
                            return;
                        }
                    }
                    else {
                        var foundFrag = void 0;
                        var maxFragLookUpTolerance_1 = config.maxFragLookUpTolerance;
                        var fragNext = fragPrevious ? fragments[fragPrevious.sn - fragments[0].sn + 1] : undefined;
                        var fragmentWithinToleranceTest = function (candidate) {
                            // offset should be within fragment boundary - config.maxFragLookUpTolerance
                            // this is to cope with situations like
                            // bufferEnd = 9.991
                            // frag[Ø] : [0,10]
                            // frag[1] : [10,20]
                            // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
                            //              frag start               frag start+duration
                            //                  |-----------------------------|
                            //              <--->                         <--->
                            //  ...--------><-----------------------------><---------....
                            // previous frag         matching fragment         next frag
                            //  return -1             return 0                 return 1
                            // logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
                            // Set the lookup tolerance to be small enough to detect the current segment - ensures we don't skip over very small segments
                            var candidateLookupTolerance = Math.min(maxFragLookUpTolerance_1, candidate.duration);
                            if ((candidate.start + candidate.duration - candidateLookupTolerance) <= bufferEnd_1) {
                                return 1;
                            }
                            else if (candidate.start - candidateLookupTolerance > bufferEnd_1 && candidate.start) {
                                // if maxFragLookUpTolerance will have negative value then don't return -1 for first element
                                return -1;
                            }
                            return 0;
                        };
                        if (bufferEnd_1 < end) {
                            if (bufferEnd_1 > end - maxFragLookUpTolerance_1) {
                                maxFragLookUpTolerance_1 = 0;
                            }
                            // Prefer the next fragment if it's within tolerance
                            if (fragNext && !fragmentWithinToleranceTest(fragNext)) {
                                foundFrag = fragNext;
                            }
                            else {
                                foundFrag = binary_search_1.default.search(fragments, fragmentWithinToleranceTest);
                            }
                        }
                        else {
                            // reach end of playlist
                            foundFrag = fragments[fragLen - 1];
                        }
                        if (foundFrag) {
                            frag = foundFrag;
                            start = foundFrag.start;
                            // logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
                            if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
                                if (frag.sn < trackDetails.endSN) {
                                    frag = fragments[frag.sn + 1 - trackDetails.startSN];
                                    logger_1.logger.log("SN just loaded, load next one: " + frag.sn);
                                }
                                else {
                                    frag = null;
                                }
                            }
                        }
                    }
                    if (frag) {
                        // logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
                        if (frag.encrypted) {
                            logger_1.logger.log("Loading key for " + frag.sn + " of [" + trackDetails.startSN + " ," + trackDetails.endSN + "],track " + trackId);
                            this.state = base_stream_controller_1.State.KEY_LOADING;
                            hls.trigger(events_1.default.KEY_LOADING, { frag: frag });
                        }
                        else {
                            logger_1.logger.log("Loading " + frag.sn + ", cc: " + frag.cc + " of [" + trackDetails.startSN + " ," + trackDetails.endSN + "],track " + trackId + ", currentTime:" + pos + ",bufferEnd:" + bufferEnd_1.toFixed(3));
                            // only load if fragment is not loaded or if in audio switch
                            // we force a frag loading in audio switch as fragment tracker might not have evicted previous frags in case of quick audio switch
                            this.fragCurrent = frag;
                            if (audioSwitch || this.fragmentTracker.getState(frag) === fragment_tracker_1.FragmentState.NOT_LOADED) {
                                this.startFragRequested = true;
                                if (Number.isFinite(frag.sn)) {
                                    this.nextLoadPosition = frag.start + frag.duration;
                                }
                                hls.trigger(events_1.default.FRAG_LOADING, { frag: frag });
                                this.state = base_stream_controller_1.State.FRAG_LOADING;
                            }
                        }
                    }
                }
                break;
            case base_stream_controller_1.State.WAITING_TRACK:
                track = this.tracks[this.trackId];
                // check if playlist is already loaded
                if (track && track.details) {
                    this.state = base_stream_controller_1.State.IDLE;
                }
                break;
            case base_stream_controller_1.State.FRAG_LOADING_WAITING_RETRY:
                var now = performance.now();
                var retryDate = this.retryDate;
                media = this.media;
                var isSeeking = media && media.seeking;
                // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
                if (!retryDate || (now >= retryDate) || isSeeking) {
                    logger_1.logger.log('audioStreamController: retryDate reached, switch back to IDLE state');
                    this.state = base_stream_controller_1.State.IDLE;
                }
                break;
            case base_stream_controller_1.State.WAITING_INIT_PTS:
                var videoTrackCC = this.videoTrackCC;
                if (this.initPTS[videoTrackCC] === undefined) {
                    break;
                }
                // Ensure we don't get stuck in the WAITING_INIT_PTS state if the waiting frag CC doesn't match any initPTS
                var waitingFrag = this.waitingFragment;
                if (waitingFrag) {
                    var waitingFragCC = waitingFrag.frag.cc;
                    if (videoTrackCC !== waitingFragCC) {
                        track = this.tracks[this.trackId];
                        if (track.details && track.details.live) {
                            logger_1.logger.warn("Waiting fragment CC (" + waitingFragCC + ") does not match video track CC (" + videoTrackCC + ")");
                            this.waitingFragment = null;
                            this.state = base_stream_controller_1.State.IDLE;
                        }
                    }
                    else {
                        this.state = base_stream_controller_1.State.FRAG_LOADING;
                        this.onFragLoaded(this.waitingFragment);
                        this.waitingFragment = null;
                    }
                }
                else {
                    this.state = base_stream_controller_1.State.IDLE;
                }
                break;
            case base_stream_controller_1.State.STOPPED:
            case base_stream_controller_1.State.FRAG_LOADING:
            case base_stream_controller_1.State.PARSING:
            case base_stream_controller_1.State.PARSED:
            case base_stream_controller_1.State.ENDED:
                break;
            default:
                break;
        }
    };
    AudioStreamController.prototype.onMediaAttached = function (data) {
        var media = this.media = this.mediaBuffer = data.media;
        this.onvseeking = this.onMediaSeeking.bind(this);
        this.onvended = this.onMediaEnded.bind(this);
        media.addEventListener('seeking', this.onvseeking);
        media.addEventListener('ended', this.onvended);
        var config = this.config;
        if (this.tracks && config.autoStartLoad) {
            this.startLoad(config.startPosition);
        }
    };
    AudioStreamController.prototype.onMediaDetaching = function () {
        var media = this.media;
        if (media && media.ended) {
            logger_1.logger.log('MSE detaching and video ended, reset startPosition');
            this.startPosition = this.lastCurrentTime = 0;
        }
        // remove video listeners
        if (media) {
            media.removeEventListener('seeking', this.onvseeking);
            media.removeEventListener('ended', this.onvended);
            this.onvseeking = this.onvseeked = this.onvended = null;
        }
        this.media = this.mediaBuffer = this.videoBuffer = null;
        this.loadedmetadata = false;
        this.stopLoad();
    };
    AudioStreamController.prototype.onAudioTracksUpdated = function (data) {
        logger_1.logger.log('audio tracks updated');
        this.tracks = data.audioTracks;
    };
    AudioStreamController.prototype.onAudioTrackSwitching = function (data) {
        // if any URL found on new audio track, it is an alternate audio track
        var altAudio = !!data.url;
        this.trackId = data.id;
        this.fragCurrent = null;
        this.state = base_stream_controller_1.State.PAUSED;
        this.waitingFragment = null;
        // destroy useless demuxer when switching audio to main
        if (!altAudio) {
            if (this.demuxer) {
                this.demuxer.destroy();
                this.demuxer = null;
            }
        }
        else {
            // switching to audio track, start timer if not already started
            this.setInterval(TICK_INTERVAL);
        }
        // should we switch tracks ?
        if (altAudio) {
            this.audioSwitch = true;
            // main audio track are handled by stream-controller, just do something if switching to alt audio track
            this.state = base_stream_controller_1.State.IDLE;
        }
        this.tick();
    };
    AudioStreamController.prototype.onAudioTrackLoaded = function (data) {
        var newDetails = data.details, trackId = data.id, track = this.tracks[trackId], duration = newDetails.totalduration, sliding = 0;
        logger_1.logger.log("track " + trackId + " loaded [" + newDetails.startSN + "," + newDetails.endSN + "],duration:" + duration);
        if (newDetails.live) {
            var curDetails = track.details;
            if (curDetails && newDetails.fragments.length > 0) {
                // we already have details for that level, merge them
                LevelHelper.mergeDetails(curDetails, newDetails);
                sliding = newDetails.fragments[0].start;
                // TODO
                // this.liveSyncPosition = this.computeLivePosition(sliding, curDetails);
                if (newDetails.PTSKnown) {
                    logger_1.logger.log("live audio playlist sliding:" + sliding.toFixed(3));
                }
                else {
                    logger_1.logger.log('live audio playlist - outdated PTS, unknown sliding');
                }
            }
            else {
                newDetails.PTSKnown = false;
                logger_1.logger.log('live audio playlist - first load, unknown sliding');
            }
        }
        else {
            newDetails.PTSKnown = false;
        }
        track.details = newDetails;
        // compute start position
        if (!this.startFragRequested) {
            // compute start position if set to -1. use it straight away if value is defined
            if (this.startPosition === -1) {
                // first, check if start time offset has been set in playlist, if yes, use this value
                var startTimeOffset = newDetails.startTimeOffset;
                if (Number.isFinite(startTimeOffset)) {
                    logger_1.logger.log("start time offset found in playlist, adjust startPosition to " + startTimeOffset);
                    this.startPosition = startTimeOffset;
                }
                else {
                    this.startPosition = 0;
                }
            }
            this.nextLoadPosition = this.startPosition;
        }
        // only switch batck to IDLE state if we were waiting for track to start downloading a new fragment
        if (this.state === base_stream_controller_1.State.WAITING_TRACK) {
            this.state = base_stream_controller_1.State.IDLE;
        }
        // trigger handler right now
        this.tick();
    };
    AudioStreamController.prototype.onKeyLoaded = function () {
        if (this.state === base_stream_controller_1.State.KEY_LOADING) {
            this.state = base_stream_controller_1.State.IDLE;
            this.tick();
        }
    };
    AudioStreamController.prototype.onFragLoaded = function (data) {
        var fragCurrent = this.fragCurrent, fragLoaded = data.frag;
        if (this.state === base_stream_controller_1.State.FRAG_LOADING &&
            fragCurrent &&
            fragLoaded.type === 'audio' &&
            fragLoaded.level === fragCurrent.level &&
            fragLoaded.sn === fragCurrent.sn) {
            var track = this.tracks[this.trackId], details = track.details, duration = details.totalduration, trackId = fragCurrent.level, sn = fragCurrent.sn, cc = fragCurrent.cc, audioCodec = this.config.defaultAudioCodec || track.audioCodec || 'mp4a.40.2', stats = this.stats = data.stats;
            if (sn === 'initSegment') {
                this.state = base_stream_controller_1.State.IDLE;
                stats.tparsed = stats.tbuffered = performance.now();
                details.initSegment.data = data.payload;
                this.hls.trigger(events_1.default.FRAG_BUFFERED, { stats: stats, frag: fragCurrent, id: 'audio' });
                this.tick();
            }
            else {
                this.state = base_stream_controller_1.State.PARSING;
                // transmux the MPEG-TS data to ISO-BMFF segments
                this.appended = false;
                if (!this.demuxer) {
                    this.demuxer = new demuxer_1.default(this.hls, 'audio');
                }
                // Check if we have video initPTS
                // If not we need to wait for it
                var initPTS = this.initPTS[cc];
                var initSegmentData = details.initSegment ? details.initSegment.data : [];
                if (details.initSegment || initPTS !== undefined) {
                    this.pendingBuffering = true;
                    logger_1.logger.log("Demuxing " + sn + " of [" + details.startSN + " ," + details.endSN + "],track " + trackId);
                    // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
                    var accurateTimeOffset = false; // details.PTSKnown || !details.live;
                    this.demuxer.push(data.payload, initSegmentData, audioCodec, null, fragCurrent, duration, accurateTimeOffset, initPTS);
                }
                else {
                    logger_1.logger.log("unknown video PTS for continuity counter " + cc + ", waiting for video PTS before demuxing audio frag " + sn + " of [" + details.startSN + " ," + details.endSN + "],track " + trackId);
                    this.waitingFragment = data;
                    this.state = base_stream_controller_1.State.WAITING_INIT_PTS;
                }
            }
        }
        this.fragLoadError = 0;
    };
    AudioStreamController.prototype.onFragParsingInitSegment = function (data) {
        var fragCurrent = this.fragCurrent;
        var fragNew = data.frag;
        if (fragCurrent &&
            data.id === 'audio' &&
            fragNew.sn === fragCurrent.sn &&
            fragNew.level === fragCurrent.level &&
            this.state === base_stream_controller_1.State.PARSING) {
            var tracks = data.tracks, track = void 0;
            // delete any video track found on audio demuxer
            if (tracks.video) {
                delete tracks.video;
            }
            // include levelCodec in audio and video tracks
            track = tracks.audio;
            if (track) {
                track.levelCodec = track.codec;
                track.id = data.id;
                this.hls.trigger(events_1.default.BUFFER_CODECS, tracks);
                logger_1.logger.log("audio track:audio,container:" + track.container + ",codecs[level/parsed]=[" + track.levelCodec + "/" + track.codec + "]");
                var initSegment = track.initSegment;
                if (initSegment) {
                    var appendObj = { type: 'audio', data: initSegment, parent: 'audio', content: 'initSegment' };
                    if (this.audioSwitch) {
                        this.pendingData = [appendObj];
                    }
                    else {
                        this.appended = true;
                        // arm pending Buffering flag before appending a segment
                        this.pendingBuffering = true;
                        this.hls.trigger(events_1.default.BUFFER_APPENDING, appendObj);
                    }
                }
                // trigger handler right now
                this.tick();
            }
        }
    };
    AudioStreamController.prototype.onFragParsingData = function (data) {
        var _this = this;
        var fragCurrent = this.fragCurrent;
        var fragNew = data.frag;
        if (fragCurrent &&
            data.id === 'audio' &&
            data.type === 'audio' &&
            fragNew.sn === fragCurrent.sn &&
            fragNew.level === fragCurrent.level &&
            this.state === base_stream_controller_1.State.PARSING) {
            var trackId = this.trackId, track = this.tracks[trackId], hls_1 = this.hls;
            if (!Number.isFinite(data.endPTS)) {
                data.endPTS = data.startPTS + fragCurrent.duration;
                data.endDTS = data.startDTS + fragCurrent.duration;
            }
            fragCurrent.addElementaryStream(fragment_1.default.ElementaryStreamTypes.AUDIO);
            logger_1.logger.log("parsed " + data.type + ",PTS:[" + data.startPTS.toFixed(3) + "," + data.endPTS.toFixed(3) + "],DTS:[" + data.startDTS.toFixed(3) + "/" + data.endDTS.toFixed(3) + "],nb:" + data.nb);
            LevelHelper.updateFragPTSDTS(track.details, fragCurrent, data.startPTS, data.endPTS);
            var audioSwitch = this.audioSwitch, media = this.media, appendOnBufferFlush = false;
            // Only flush audio from old audio tracks when PTS is known on new audio track
            if (audioSwitch && media) {
                if (media.readyState) {
                    var currentTime = media.currentTime;
                    logger_1.logger.log('switching audio track : currentTime:' + currentTime);
                    if (currentTime >= data.startPTS) {
                        logger_1.logger.log('switching audio track : flushing all audio');
                        this.state = base_stream_controller_1.State.BUFFER_FLUSHING;
                        hls_1.trigger(events_1.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
                        appendOnBufferFlush = true;
                        // Lets announce that the initial audio track switch flush occur
                        this.audioSwitch = false;
                        hls_1.trigger(events_1.default.AUDIO_TRACK_SWITCHED, { id: trackId });
                    }
                }
                else {
                    // Lets announce that the initial audio track switch flush occur
                    this.audioSwitch = false;
                    hls_1.trigger(events_1.default.AUDIO_TRACK_SWITCHED, { id: trackId });
                }
            }
            var pendingData_1 = this.pendingData;
            if (!pendingData_1) {
                logger_1.logger.warn('Apparently attempt to enqueue media payload without codec initialization data upfront');
                hls_1.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: null, fatal: true });
                return;
            }
            if (!this.audioSwitch) {
                [data.data1, data.data2].forEach(function (buffer) {
                    if (buffer && buffer.length) {
                        pendingData_1.push({ type: data.type, data: buffer, parent: 'audio', content: 'data' });
                    }
                });
                if (!appendOnBufferFlush && pendingData_1.length) {
                    pendingData_1.forEach(function (appendObj) {
                        // only append in PARSING state (rationale is that an appending error could happen synchronously on first segment appending)
                        // in that case it is useless to append following segments
                        if (_this.state === base_stream_controller_1.State.PARSING) {
                            // arm pending Buffering flag before appending a segment
                            _this.pendingBuffering = true;
                            _this.hls.trigger(events_1.default.BUFFER_APPENDING, appendObj);
                        }
                    });
                    this.pendingData = [];
                    this.appended = true;
                }
            }
            // trigger handler right now
            this.tick();
        }
    };
    AudioStreamController.prototype.onFragParsed = function (data) {
        var fragCurrent = this.fragCurrent;
        var fragNew = data.frag;
        if (fragCurrent &&
            data.id === 'audio' &&
            fragNew.sn === fragCurrent.sn &&
            fragNew.level === fragCurrent.level &&
            this.state === base_stream_controller_1.State.PARSING) {
            this.stats.tparsed = performance.now();
            this.state = base_stream_controller_1.State.PARSED;
            this._checkAppendedParsed();
        }
    };
    AudioStreamController.prototype.onBufferReset = function () {
        // reset reference to sourcebuffers
        this.mediaBuffer = this.videoBuffer = null;
        this.loadedmetadata = false;
    };
    AudioStreamController.prototype.onBufferCreated = function (data) {
        var audioTrack = data.tracks.audio;
        if (audioTrack) {
            this.mediaBuffer = audioTrack.buffer;
            this.loadedmetadata = true;
        }
        if (data.tracks.video) {
            this.videoBuffer = data.tracks.video.buffer;
        }
    };
    AudioStreamController.prototype.onBufferAppended = function (data) {
        if (data.parent === 'audio') {
            var state = this.state;
            if (state === base_stream_controller_1.State.PARSING || state === base_stream_controller_1.State.PARSED) {
                // check if all buffers have been appended
                this.pendingBuffering = (data.pending > 0);
                this._checkAppendedParsed();
            }
        }
    };
    AudioStreamController.prototype._checkAppendedParsed = function () {
        // trigger handler right now
        if (this.state === base_stream_controller_1.State.PARSED && (!this.appended || !this.pendingBuffering)) {
            var frag = this.fragCurrent, stats = this.stats, hls_2 = this.hls;
            if (frag) {
                this.fragPrevious = frag;
                stats.tbuffered = performance.now();
                hls_2.trigger(events_1.default.FRAG_BUFFERED, { stats: stats, frag: frag, id: 'audio' });
                var media = this.mediaBuffer ? this.mediaBuffer : this.media;
                logger_1.logger.log("audio buffered : " + time_ranges_1.default.toString(media.buffered));
                if (this.audioSwitch && this.appended) {
                    this.audioSwitch = false;
                    hls_2.trigger(events_1.default.AUDIO_TRACK_SWITCHED, { id: this.trackId });
                }
                this.state = base_stream_controller_1.State.IDLE;
            }
            this.tick();
        }
    };
    AudioStreamController.prototype.onError = function (data) {
        var frag = data.frag;
        // don't handle frag error not related to audio fragment
        if (frag && frag.type !== 'audio') {
            return;
        }
        switch (data.details) {
            case errors_1.ErrorDetails.FRAG_LOAD_ERROR:
            case errors_1.ErrorDetails.FRAG_LOAD_TIMEOUT:
                var frag_1 = data.frag;
                // don't handle frag error not related to audio fragment
                if (frag_1 && frag_1.type !== 'audio') {
                    break;
                }
                if (!data.fatal) {
                    var loadError = this.fragLoadError;
                    if (loadError) {
                        loadError++;
                    }
                    else {
                        loadError = 1;
                    }
                    var config = this.config;
                    if (loadError <= config.fragLoadingMaxRetry) {
                        this.fragLoadError = loadError;
                        // exponential backoff capped to config.fragLoadingMaxRetryTimeout
                        var delay = Math.min(Math.pow(2, loadError - 1) * config.fragLoadingRetryDelay, config.fragLoadingMaxRetryTimeout);
                        logger_1.logger.warn("AudioStreamController: frag loading failed, retry in " + delay + " ms");
                        this.retryDate = performance.now() + delay;
                        // retry loading state
                        this.state = base_stream_controller_1.State.FRAG_LOADING_WAITING_RETRY;
                    }
                    else {
                        logger_1.logger.error("AudioStreamController: " + data.details + " reaches max retry, redispatch as fatal ...");
                        // switch error to fatal
                        data.fatal = true;
                        this.state = base_stream_controller_1.State.ERROR;
                    }
                }
                break;
            case errors_1.ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
            case errors_1.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
            case errors_1.ErrorDetails.KEY_LOAD_ERROR:
            case errors_1.ErrorDetails.KEY_LOAD_TIMEOUT:
                //  when in ERROR state, don't switch back to IDLE state in case a non-fatal error is received
                if (this.state !== base_stream_controller_1.State.ERROR) {
                    // if fatal error, stop processing, otherwise move to IDLE to retry loading
                    this.state = data.fatal ? base_stream_controller_1.State.ERROR : base_stream_controller_1.State.IDLE;
                    logger_1.logger.warn("AudioStreamController: " + data.details + " while loading frag, now switching to " + this.state + " state ...");
                }
                break;
            case errors_1.ErrorDetails.BUFFER_FULL_ERROR:
                // if in appending state
                if (data.parent === 'audio' && (this.state === base_stream_controller_1.State.PARSING || this.state === base_stream_controller_1.State.PARSED)) {
                    var media = this.mediaBuffer, currentTime = this.media.currentTime, mediaBuffered = media && buffer_helper_1.BufferHelper.isBuffered(media, currentTime) && buffer_helper_1.BufferHelper.isBuffered(media, currentTime + 0.5);
                    // reduce max buf len if current position is buffered
                    if (mediaBuffered) {
                        var config = this.config;
                        if (config.maxMaxBufferLength >= config.maxBufferLength) {
                            // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
                            config.maxMaxBufferLength /= 2;
                            logger_1.logger.warn("AudioStreamController: reduce max buffer length to " + config.maxMaxBufferLength + "s");
                        }
                        this.state = base_stream_controller_1.State.IDLE;
                    }
                    else {
                        // current position is not buffered, but browser is still complaining about buffer full error
                        // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
                        // in that case flush the whole audio buffer to recover
                        logger_1.logger.warn('AudioStreamController: buffer full error also media.currentTime is not buffered, flush audio buffer');
                        this.fragCurrent = null;
                        // flush everything
                        this.state = base_stream_controller_1.State.BUFFER_FLUSHING;
                        this.hls.trigger(events_1.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
                    }
                }
                break;
            default:
                break;
        }
    };
    AudioStreamController.prototype.onBufferFlushed = function () {
        var _this = this;
        var pendingData = this.pendingData;
        if (pendingData && pendingData.length) {
            logger_1.logger.log('AudioStreamController: appending pending audio data after buffer flushed');
            pendingData.forEach(function (appendObj) {
                _this.hls.trigger(events_1.default.BUFFER_APPENDING, appendObj);
            });
            this.appended = true;
            this.pendingData = [];
            this.state = base_stream_controller_1.State.PARSED;
        }
        else {
            // move to IDLE once flush complete. this should trigger new fragment loading
            this.state = base_stream_controller_1.State.IDLE;
            // reset reference to frag
            this.fragPrevious = null;
            this.tick();
        }
    };
    return AudioStreamController;
}(base_stream_controller_1.default));
exports.default = AudioStreamController;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/audio-track-controller.js":
/*!**************************************************!*\
  !*** ./src/controller/audio-track-controller.js ***!
  \**************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var task_loop_1 = __webpack_require__(/*! ../task-loop */ "./src/task-loop.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
/**
 * @class AudioTrackController
 * @implements {EventHandler}
 *
 * Handles main manifest and audio-track metadata loaded,
 * owns and exposes the selectable audio-tracks data-models.
 *
 * Exposes internal interface to select available audio-tracks.
 *
 * Handles errors on loading audio-track playlists. Manages fallback mechanism
 * with redundants tracks (group-IDs).
 *
 * Handles level-loading and group-ID switches for video (fallback on video levels),
 * and eventually adapts the audio-track group-ID to match.
 *
 * @fires AUDIO_TRACK_LOADING
 * @fires AUDIO_TRACK_SWITCHING
 * @fires AUDIO_TRACKS_UPDATED
 * @fires ERROR
 *
 */
var AudioTrackController = /** @class */ (function (_super) {
    __extends(AudioTrackController, _super);
    function AudioTrackController(hls) {
        var _this = _super.call(this, hls, events_1.default.MANIFEST_LOADING, events_1.default.MANIFEST_PARSED, events_1.default.AUDIO_TRACK_LOADED, events_1.default.AUDIO_TRACK_SWITCHED, events_1.default.LEVEL_LOADED, events_1.default.ERROR) || this;
        /**
         * @private
         * Currently selected index in `tracks`
         * @member {number} trackId
         */
        _this._trackId = -1;
        /**
         * @private
         * If should select tracks according to default track attribute
         * @member {boolean} _selectDefaultTrack
         */
        _this._selectDefaultTrack = true;
        /**
         * @public
         * All tracks available
         * @member {AudioTrack[]}
         */
        _this.tracks = [];
        /**
         * @public
         * List of blacklisted audio track IDs (that have caused failure)
         * @member {number[]}
         */
        _this.trackIdBlacklist = Object.create(null);
        /**
         * @public
         * The currently running group ID for audio
         * (we grab this on manifest-parsed and new level-loaded)
         * @member {string}
         */
        _this.audioGroupId = null;
        return _this;
    }
    /**
     * Reset audio tracks on new manifest loading.
     */
    AudioTrackController.prototype.onManifestLoading = function () {
        this.tracks = [];
        this._trackId = -1;
        this._selectDefaultTrack = true;
    };
    /**
     * Store tracks data from manifest parsed data.
     *
     * Trigger AUDIO_TRACKS_UPDATED event.
     *
     * @param {*} data
     */
    AudioTrackController.prototype.onManifestParsed = function (data) {
        var tracks = this.tracks = data.audioTracks || [];
        this.hls.trigger(events_1.default.AUDIO_TRACKS_UPDATED, { audioTracks: tracks });
    };
    /**
     * Store track details of loaded track in our data-model.
     *
     * Set-up metadata update interval task for live-mode streams.
     *
     * @param {} data
     */
    AudioTrackController.prototype.onAudioTrackLoaded = function (data) {
        if (data.id >= this.tracks.length) {
            logger_1.logger.warn('Invalid audio track id:', data.id);
            return;
        }
        logger_1.logger.log("audioTrack " + data.id + " loaded");
        this.tracks[data.id].details = data.details;
        // check if current playlist is a live playlist
        // and if we have already our reload interval setup
        if (data.details.live && !this.hasInterval()) {
            // if live playlist we will have to reload it periodically
            // set reload period to playlist target duration
            var updatePeriodMs = data.details.targetduration * 1000;
            this.setInterval(updatePeriodMs);
        }
        if (!data.details.live && this.hasInterval()) {
            // playlist is not live and timer is scheduled: cancel it
            this.clearInterval();
        }
    };
    /**
     * Update the internal group ID to any audio-track we may have set manually
     * or because of a failure-handling fallback.
     *
     * Quality-levels should update to that group ID in this case.
     *
     * @param {*} data
     */
    AudioTrackController.prototype.onAudioTrackSwitched = function (data) {
        var audioGroupId = this.tracks[data.id].groupId;
        if (audioGroupId && (this.audioGroupId !== audioGroupId)) {
            this.audioGroupId = audioGroupId;
        }
    };
    /**
     * When a level gets loaded, if it has redundant audioGroupIds (in the same ordinality as it's redundant URLs)
     * we are setting our audio-group ID internally to the one set, if it is different from the group ID currently set.
     *
     * If group-ID got update, we re-select the appropriate audio-track with this group-ID matching the currently
     * selected one (based on NAME property).
     *
     * @param {*} data
     */
    AudioTrackController.prototype.onLevelLoaded = function (data) {
        // FIXME: crashes because currentLevel is undefined
        // const levelInfo = this.hls.levels[this.hls.currentLevel];
        var levelInfo = this.hls.levels[data.level];
        if (!levelInfo.audioGroupIds) {
            return;
        }
        var audioGroupId = levelInfo.audioGroupIds[levelInfo.urlId];
        if (this.audioGroupId !== audioGroupId) {
            this.audioGroupId = audioGroupId;
            this._selectInitialAudioTrack();
        }
    };
    /**
     * Handle network errors loading audio track manifests
     * and also pausing on any netwok errors.
     *
     * @param {ErrorEventData} data
     */
    AudioTrackController.prototype.onError = function (data) {
        // Only handle network errors
        if (data.type !== errors_1.ErrorTypes.NETWORK_ERROR) {
            return;
        }
        // If fatal network error, cancel update task
        if (data.fatal) {
            this.clearInterval();
        }
        // If not an audio-track loading error don't handle further
        if (data.details !== errors_1.ErrorDetails.AUDIO_TRACK_LOAD_ERROR) {
            return;
        }
        logger_1.logger.warn('Network failure on audio-track id:', data.context.id);
        this._handleLoadError();
    };
    Object.defineProperty(AudioTrackController.prototype, "audioTracks", {
        /**
         * @type {AudioTrack[]} Audio-track list we own
         */
        get: function () {
            return this.tracks;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AudioTrackController.prototype, "audioTrack", {
        /**
         * @type {number} Index into audio-tracks list of currently selected track.
         */
        get: function () {
            return this._trackId;
        },
        /**
         * Select current track by index
         */
        set: function (newId) {
            this._setAudioTrack(newId);
            // If audio track is selected from API then don't choose from the manifest default track
            this._selectDefaultTrack = false;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @private
     * @param {number} newId
     */
    AudioTrackController.prototype._setAudioTrack = function (newId) {
        // noop on same audio track id as already set
        if (this._trackId === newId && this.tracks[this._trackId].details) {
            logger_1.logger.debug('Same id as current audio-track passed, and track details available -> no-op');
            return;
        }
        // check if level idx is valid
        if (newId < 0 || newId >= this.tracks.length) {
            logger_1.logger.warn('Invalid id passed to audio-track controller');
            return;
        }
        var audioTrack = this.tracks[newId];
        logger_1.logger.log("Now switching to audio-track index " + newId);
        // stopping live reloading timer if any
        this.clearInterval();
        this._trackId = newId;
        var url = audioTrack.url, type = audioTrack.type, id = audioTrack.id;
        this.hls.trigger(events_1.default.AUDIO_TRACK_SWITCHING, { id: id, type: type, url: url });
        this._loadTrackDetailsIfNeeded(audioTrack);
    };
    /**
     * @override
     */
    AudioTrackController.prototype.doTick = function () {
        this._updateTrack(this._trackId);
    };
    /**
     * Select initial track
     * @private
     */
    AudioTrackController.prototype._selectInitialAudioTrack = function () {
        var _this = this;
        var tracks = this.tracks;
        if (!tracks.length) {
            return;
        }
        var currentAudioTrack = this.tracks[this._trackId];
        var name = null;
        if (currentAudioTrack) {
            name = currentAudioTrack.name;
        }
        // Pre-select default tracks if there are any
        if (this._selectDefaultTrack) {
            var defaultTracks = tracks.filter(function (track) { return track.default; });
            if (defaultTracks.length) {
                tracks = defaultTracks;
            }
            else {
                logger_1.logger.warn('No default audio tracks defined');
            }
        }
        var trackFound = false;
        var traverseTracks = function () {
            // Select track with right group ID
            tracks.forEach(function (track) {
                if (trackFound) {
                    return;
                }
                // We need to match the (pre-)selected group ID
                // and the NAME of the current track.
                if ((!_this.audioGroupId || track.groupId === _this.audioGroupId) &&
                    (!name || name === track.name)) {
                    // If there was a previous track try to stay with the same `NAME`.
                    // It should be unique across tracks of same group, and consistent through redundant track groups.
                    _this._setAudioTrack(track.id);
                    trackFound = true;
                }
            });
        };
        traverseTracks();
        if (!trackFound) {
            name = null;
            traverseTracks();
        }
        if (!trackFound) {
            logger_1.logger.error("No track found for running audio group-ID: " + this.audioGroupId);
            this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.MEDIA_ERROR,
                details: errors_1.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
                fatal: true
            });
        }
    };
    /**
     * @private
     * @param {AudioTrack} audioTrack
     * @returns {boolean}
     */
    AudioTrackController.prototype._needsTrackLoading = function (audioTrack) {
        var details = audioTrack.details, url = audioTrack.url;
        if (!details || details.live) {
            // check if we face an audio track embedded in main playlist (audio track without URI attribute)
            return !!url;
        }
        return false;
    };
    /**
     * @private
     * @param {AudioTrack} audioTrack
     */
    AudioTrackController.prototype._loadTrackDetailsIfNeeded = function (audioTrack) {
        if (this._needsTrackLoading(audioTrack)) {
            var url = audioTrack.url, id = audioTrack.id;
            // track not retrieved yet, or live playlist we need to (re)load it
            logger_1.logger.log("loading audio-track playlist for id: " + id);
            this.hls.trigger(events_1.default.AUDIO_TRACK_LOADING, { url: url, id: id });
        }
    };
    /**
     * @private
     * @param {number} newId
     */
    AudioTrackController.prototype._updateTrack = function (newId) {
        // check if level idx is valid
        if (newId < 0 || newId >= this.tracks.length) {
            return;
        }
        // stopping live reloading timer if any
        this.clearInterval();
        this._trackId = newId;
        logger_1.logger.log("trying to update audio-track " + newId);
        var audioTrack = this.tracks[newId];
        this._loadTrackDetailsIfNeeded(audioTrack);
    };
    /**
     * @private
     */
    AudioTrackController.prototype._handleLoadError = function () {
        // First, let's black list current track id
        this.trackIdBlacklist[this._trackId] = true;
        // Let's try to fall back on a functional audio-track with the same group ID
        var previousId = this._trackId;
        var _a = this.tracks[previousId], name = _a.name, language = _a.language, groupId = _a.groupId;
        logger_1.logger.warn("Loading failed on audio track id: " + previousId + ", group-id: " + groupId + ", name/language: \"" + name + "\" / \"" + language + "\"");
        // Find a non-blacklisted track ID with the same NAME
        // At least a track that is not blacklisted, thus on another group-ID.
        var newId = previousId;
        for (var i = 0; i < this.tracks.length; i++) {
            if (this.trackIdBlacklist[i]) {
                continue;
            }
            var newTrack = this.tracks[i];
            if (newTrack.name === name) {
                newId = i;
                break;
            }
        }
        if (newId === previousId) {
            logger_1.logger.warn("No fallback audio-track found for name/language: \"" + name + "\" / \"" + language + "\"");
            return;
        }
        logger_1.logger.log('Attempting audio-track fallback id:', newId, 'group-id:', this.tracks[newId].groupId);
        this._setAudioTrack(newId);
    };
    return AudioTrackController;
}(task_loop_1.default));
exports.default = AudioTrackController;


/***/ }),

/***/ "./src/controller/base-stream-controller.js":
/*!**************************************************!*\
  !*** ./src/controller/base-stream-controller.js ***!
  \**************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var task_loop_1 = __webpack_require__(/*! ../task-loop */ "./src/task-loop.js");
var fragment_tracker_1 = __webpack_require__(/*! ./fragment-tracker */ "./src/controller/fragment-tracker.js");
var buffer_helper_1 = __webpack_require__(/*! ../utils/buffer-helper */ "./src/utils/buffer-helper.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
exports.State = {
    STOPPED: 'STOPPED',
    STARTING: 'STARTING',
    IDLE: 'IDLE',
    PAUSED: 'PAUSED',
    KEY_LOADING: 'KEY_LOADING',
    FRAG_LOADING: 'FRAG_LOADING',
    FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
    WAITING_TRACK: 'WAITING_TRACK',
    PARSING: 'PARSING',
    PARSED: 'PARSED',
    BUFFER_FLUSHING: 'BUFFER_FLUSHING',
    ENDED: 'ENDED',
    ERROR: 'ERROR',
    WAITING_INIT_PTS: 'WAITING_INIT_PTS',
    WAITING_LEVEL: 'WAITING_LEVEL'
};
var BaseStreamController = /** @class */ (function (_super) {
    __extends(BaseStreamController, _super);
    function BaseStreamController() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BaseStreamController.prototype.doTick = function () { };
    BaseStreamController.prototype._streamEnded = function (bufferInfo, levelDetails) {
        var _a = this, fragCurrent = _a.fragCurrent, fragmentTracker = _a.fragmentTracker;
        // we just got done loading the final fragment and there is no other buffered range after ...
        // rationale is that in case there are any buffered ranges after, it means that there are unbuffered portion in between
        // so we should not switch to ENDED in that case, to be able to buffer them
        // dont switch to ENDED if we need to backtrack last fragment
        if (!levelDetails.live && fragCurrent && !fragCurrent.backtracked && fragCurrent.sn === levelDetails.endSN && !bufferInfo.nextStart) {
            var fragState = fragmentTracker.getState(fragCurrent);
            return fragState === fragment_tracker_1.FragmentState.PARTIAL || fragState === fragment_tracker_1.FragmentState.OK;
        }
        return false;
    };
    BaseStreamController.prototype.onMediaSeeking = function () {
        var _a = this, config = _a.config, media = _a.media, mediaBuffer = _a.mediaBuffer, state = _a.state;
        var currentTime = media ? media.currentTime : null;
        var bufferInfo = buffer_helper_1.BufferHelper.bufferInfo(mediaBuffer || media, currentTime, this.config.maxBufferHole);
        if (Number.isFinite(currentTime)) {
            logger_1.logger.log("media seeking to " + currentTime.toFixed(3));
        }
        if (state === exports.State.FRAG_LOADING) {
            var fragCurrent = this.fragCurrent;
            // check if we are seeking to a unbuffered area AND if frag loading is in progress
            if (bufferInfo.len === 0 && fragCurrent) {
                var tolerance = config.maxFragLookUpTolerance;
                var fragStartOffset = fragCurrent.start - tolerance;
                var fragEndOffset = fragCurrent.start + fragCurrent.duration + tolerance;
                // check if we seek position will be out of currently loaded frag range : if out cancel frag load, if in, don't do anything
                if (currentTime < fragStartOffset || currentTime > fragEndOffset) {
                    if (fragCurrent.loader) {
                        logger_1.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
                        fragCurrent.loader.abort();
                    }
                    this.fragCurrent = null;
                    this.fragPrevious = null;
                    // switch to IDLE state to load new fragment
                    this.state = exports.State.IDLE;
                }
                else {
                    logger_1.logger.log('seeking outside of buffer but within currently loaded fragment range');
                }
            }
        }
        else if (state === exports.State.ENDED) {
            // if seeking to unbuffered area, clean up fragPrevious
            if (bufferInfo.len === 0) {
                this.fragPrevious = null;
                this.fragCurrent = null;
            }
            // switch to IDLE state to check for potential new fragment
            this.state = exports.State.IDLE;
        }
        if (media) {
            this.lastCurrentTime = currentTime;
        }
        // in case seeking occurs although no media buffered, adjust startPosition and nextLoadPosition to seek target
        if (!this.loadedmetadata) {
            this.nextLoadPosition = this.startPosition = currentTime;
        }
        // tick to speed up processing
        this.tick();
    };
    BaseStreamController.prototype.onMediaEnded = function () {
        // reset startPosition and lastCurrentTime to restart playback @ stream beginning
        this.startPosition = this.lastCurrentTime = 0;
    };
    return BaseStreamController;
}(task_loop_1.default));
exports.default = BaseStreamController;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/buffer-controller.js":
/*!*********************************************!*\
  !*** ./src/controller/buffer-controller.js ***!
  \*********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/*
 * Buffer Controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var mediasource_helper_1 = __webpack_require__(/*! ../utils/mediasource-helper */ "./src/utils/mediasource-helper.js");
var MediaSource = mediasource_helper_1.getMediaSource();
var BufferController = /** @class */ (function (_super) {
    __extends(BufferController, _super);
    function BufferController(hls) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHING, events_1.default.MEDIA_DETACHING, events_1.default.MANIFEST_PARSED, events_1.default.BUFFER_RESET, events_1.default.BUFFER_APPENDING, events_1.default.BUFFER_CODECS, events_1.default.BUFFER_EOS, events_1.default.BUFFER_FLUSHING, events_1.default.LEVEL_PTS_UPDATED, events_1.default.LEVEL_UPDATED) || this;
        // the value that we have set mediasource.duration to
        // (the actual duration may be tweaked slighly by the browser)
        _this._msDuration = null;
        // the value that we want to set mediaSource.duration to
        _this._levelDuration = null;
        // the target duration of the current media playlist
        _this._levelTargetDuration = 10;
        // current stream state: true - for live broadcast, false - for VoD content
        _this._live = null;
        // cache the self generated object url to detect hijack of video tag
        _this._objectUrl = null;
        // The number of BUFFER_CODEC events received before any sourceBuffers are created
        _this.bufferCodecEventsExpected = 0;
        // Source Buffer listeners
        _this.onsbue = _this.onSBUpdateEnd.bind(_this);
        _this.onsbe = _this.onSBUpdateError.bind(_this);
        _this.pendingTracks = {};
        _this.tracks = {};
        return _this;
    }
    BufferController.prototype.destroy = function () {
        event_handler_1.default.prototype.destroy.call(this);
    };
    BufferController.prototype.onLevelPtsUpdated = function (data) {
        var type = data.type;
        var audioTrack = this.tracks.audio;
        // Adjusting `SourceBuffer.timestampOffset` (desired point in the timeline where the next frames should be appended)
        // in Chrome browser when we detect MPEG audio container and time delta between level PTS and `SourceBuffer.timestampOffset`
        // is greater than 100ms (this is enough to handle seek for VOD or level change for LIVE videos). At the time of change we issue
        // `SourceBuffer.abort()` and adjusting `SourceBuffer.timestampOffset` if `SourceBuffer.updating` is false or awaiting `updateend`
        // event if SB is in updating state.
        // More info here: https://github.com/video-dev/hls.js/issues/332#issuecomment-257986486
        if (type === 'audio' && audioTrack && audioTrack.container === 'audio/mpeg') { // Chrome audio mp3 track
            var audioBuffer = this.sourceBuffer.audio;
            var delta = Math.abs(audioBuffer.timestampOffset - data.start);
            // adjust timestamp offset if time delta is greater than 100ms
            if (delta > 0.1) {
                var updating = audioBuffer.updating;
                try {
                    audioBuffer.abort();
                }
                catch (err) {
                    logger_1.logger.warn('can not abort audio buffer: ' + err);
                }
                if (!updating) {
                    logger_1.logger.warn('change mpeg audio timestamp offset from ' + audioBuffer.timestampOffset + ' to ' + data.start);
                    audioBuffer.timestampOffset = data.start;
                }
                else {
                    this.audioTimestampOffset = data.start;
                }
            }
        }
    };
    BufferController.prototype.onManifestParsed = function (data) {
        // in case of alt audio 2 BUFFER_CODECS events will be triggered, one per stream controller
        // sourcebuffers will be created all at once when the expected nb of tracks will be reached
        // in case alt audio is not used, only one BUFFER_CODEC event will be fired from main stream controller
        // it will contain the expected nb of source buffers, no need to compute it
        this.bufferCodecEventsExpected = data.altAudio ? 2 : 1;
        logger_1.logger.log(this.bufferCodecEventsExpected + " bufferCodec event(s) expected");
    };
    BufferController.prototype.onMediaAttaching = function (data) {
        var media = this.media = data.media;
        if (media) {
            // setup the media source
            var ms = this.mediaSource = new MediaSource();
            // Media Source listeners
            this.onmso = this.onMediaSourceOpen.bind(this);
            this.onmse = this.onMediaSourceEnded.bind(this);
            this.onmsc = this.onMediaSourceClose.bind(this);
            ms.addEventListener('sourceopen', this.onmso);
            ms.addEventListener('sourceended', this.onmse);
            ms.addEventListener('sourceclose', this.onmsc);
            // link video and media Source
            media.src = window.URL.createObjectURL(ms);
            // cache the locally generated object url
            this._objectUrl = media.src;
        }
    };
    BufferController.prototype.onMediaDetaching = function () {
        logger_1.logger.log('media source detaching');
        var ms = this.mediaSource;
        if (ms) {
            if (ms.readyState === 'open') {
                try {
                    // endOfStream could trigger exception if any sourcebuffer is in updating state
                    // we don't really care about checking sourcebuffer state here,
                    // as we are anyway detaching the MediaSource
                    // let's just avoid this exception to propagate
                    ms.endOfStream();
                }
                catch (err) {
                    logger_1.logger.warn("onMediaDetaching:" + err.message + " while calling endOfStream");
                }
            }
            ms.removeEventListener('sourceopen', this.onmso);
            ms.removeEventListener('sourceended', this.onmse);
            ms.removeEventListener('sourceclose', this.onmsc);
            // Detach properly the MediaSource from the HTMLMediaElement as
            // suggested in https://github.com/w3c/media-source/issues/53.
            if (this.media) {
                window.URL.revokeObjectURL(this._objectUrl);
                // clean up video tag src only if it's our own url. some external libraries might
                // hijack the video tag and change its 'src' without destroying the Hls instance first
                if (this.media.src === this._objectUrl) {
                    this.media.removeAttribute('src');
                    this.media.load();
                }
                else {
                    logger_1.logger.warn('media.src was changed by a third party - skip cleanup');
                }
            }
            this.mediaSource = null;
            this.media = null;
            this._objectUrl = null;
            this.pendingTracks = {};
            this.tracks = {};
            this.sourceBuffer = {};
            this.flushRange = [];
            this.segments = [];
            this.appended = 0;
        }
        this.onmso = this.onmse = this.onmsc = null;
        this.hls.trigger(events_1.default.MEDIA_DETACHED);
    };
    BufferController.prototype.onMediaSourceOpen = function () {
        logger_1.logger.log('media source opened');
        this.hls.trigger(events_1.default.MEDIA_ATTACHED, { media: this.media });
        var mediaSource = this.mediaSource;
        if (mediaSource) {
            // once received, don't listen anymore to sourceopen event
            mediaSource.removeEventListener('sourceopen', this.onmso);
        }
        this.checkPendingTracks();
    };
    BufferController.prototype.checkPendingTracks = function () {
        var _a = this, bufferCodecEventsExpected = _a.bufferCodecEventsExpected, pendingTracks = _a.pendingTracks;
        // Check if we've received all of the expected bufferCodec events. When none remain, create all the sourceBuffers at once.
        // This is important because the MSE spec allows implementations to throw QuotaExceededErrors if creating new sourceBuffers after
        // data has been appended to existing ones.
        // 2 tracks is the max (one for audio, one for video). If we've reach this max go ahead and create the buffers.
        var pendingTracksCount = Object.keys(pendingTracks).length;
        if ((pendingTracksCount && !bufferCodecEventsExpected) || pendingTracksCount === 2) {
            // ok, let's create them now !
            this.createSourceBuffers(pendingTracks);
            this.pendingTracks = {};
            // append any pending segments now !
            this.doAppending();
        }
    };
    BufferController.prototype.onMediaSourceClose = function () {
        logger_1.logger.log('media source closed');
    };
    BufferController.prototype.onMediaSourceEnded = function () {
        logger_1.logger.log('media source ended');
    };
    BufferController.prototype.onSBUpdateEnd = function () {
        // update timestampOffset
        if (this.audioTimestampOffset) {
            var audioBuffer = this.sourceBuffer.audio;
            logger_1.logger.warn("change mpeg audio timestamp offset from " + audioBuffer.timestampOffset + " to " + this.audioTimestampOffset);
            audioBuffer.timestampOffset = this.audioTimestampOffset;
            delete this.audioTimestampOffset;
        }
        if (this._needsFlush) {
            this.doFlush();
        }
        if (this._needsEos) {
            this.checkEos();
        }
        this.appending = false;
        var parent = this.parent;
        // count nb of pending segments waiting for appending on this sourcebuffer
        var pending = this.segments.reduce(function (counter, segment) { return (segment.parent === parent) ? counter + 1 : counter; }, 0);
        // this.sourceBuffer is better to use than media.buffered as it is closer to the PTS data from the fragments
        var timeRanges = {};
        var sourceBuffer = this.sourceBuffer;
        for (var streamType in sourceBuffer) {
            timeRanges[streamType] = sourceBuffer[streamType].buffered;
        }
        this.hls.trigger(events_1.default.BUFFER_APPENDED, { parent: parent, pending: pending, timeRanges: timeRanges });
        // don't append in flushing mode
        if (!this._needsFlush) {
            this.doAppending();
        }
        this.updateMediaElementDuration();
        // appending goes first
        if (pending === 0) {
            this.flushLiveBackBuffer();
        }
    };
    BufferController.prototype.onSBUpdateError = function (event) {
        logger_1.logger.error('sourceBuffer error:', event);
        // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
        // this error might not always be fatal (it is fatal if decode error is set, in that case
        // it will be followed by a mediaElement error ...)
        this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false });
        // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
    };
    BufferController.prototype.onBufferReset = function () {
        var sourceBuffer = this.sourceBuffer;
        for (var type in sourceBuffer) {
            var sb = sourceBuffer[type];
            try {
                this.mediaSource.removeSourceBuffer(sb);
                sb.removeEventListener('updateend', this.onsbue);
                sb.removeEventListener('error', this.onsbe);
            }
            catch (err) {
            }
        }
        this.sourceBuffer = {};
        this.flushRange = [];
        this.segments = [];
        this.appended = 0;
    };
    BufferController.prototype.onBufferCodecs = function (tracks) {
        var _this = this;
        // if source buffer(s) not created yet, appended buffer tracks in this.pendingTracks
        // if sourcebuffers already created, do nothing ...
        if (Object.keys(this.sourceBuffer).length) {
            return;
        }
        Object.keys(tracks).forEach(function (trackName) {
            _this.pendingTracks[trackName] = tracks[trackName];
        });
        var mediaSource = this.mediaSource;
        this.bufferCodecEventsExpected = Math.max(this.bufferCodecEventsExpected - 1, 0);
        if (mediaSource && mediaSource.readyState === 'open') {
            this.checkPendingTracks();
        }
    };
    BufferController.prototype.createSourceBuffers = function (tracks) {
        var sourceBuffer = this.sourceBuffer, mediaSource = this.mediaSource;
        for (var trackName in tracks) {
            if (!sourceBuffer[trackName]) {
                var track = tracks[trackName];
                // use levelCodec as first priority
                var codec = track.levelCodec || track.codec;
                var mimeType = track.container + ";codecs=" + codec;
                logger_1.logger.log("creating sourceBuffer(" + mimeType + ")");
                try {
                    var sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
                    sb.addEventListener('updateend', this.onsbue);
                    sb.addEventListener('error', this.onsbe);
                    this.tracks[trackName] = { codec: codec, container: track.container };
                    track.buffer = sb;
                }
                catch (err) {
                    logger_1.logger.error("error while trying to add sourceBuffer:" + err.message);
                    this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.BUFFER_ADD_CODEC_ERROR, fatal: false, err: err, mimeType: mimeType });
                }
            }
        }
        this.hls.trigger(events_1.default.BUFFER_CREATED, { tracks: tracks });
    };
    BufferController.prototype.onBufferAppending = function (data) {
        if (!this._needsFlush) {
            if (!this.segments) {
                this.segments = [data];
            }
            else {
                this.segments.push(data);
            }
            this.doAppending();
        }
    };
    BufferController.prototype.onBufferAppendFail = function (data) {
        logger_1.logger.error('sourceBuffer error:', data.event);
        // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
        // this error might not always be fatal (it is fatal if decode error is set, in that case
        // it will be followed by a mediaElement error ...)
        this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false });
    };
    // on BUFFER_EOS mark matching sourcebuffer(s) as ended and trigger checkEos()
    BufferController.prototype.onBufferEos = function (data) {
        var sb = this.sourceBuffer;
        var dataType = data.type;
        for (var type in sb) {
            if (!dataType || type === dataType) {
                if (!sb[type].ended) {
                    sb[type].ended = true;
                    logger_1.logger.log(type + " sourceBuffer now EOS");
                }
            }
        }
        this.checkEos();
    };
    // if all source buffers are marked as ended, signal endOfStream() to MediaSource.
    BufferController.prototype.checkEos = function () {
        var sb = this.sourceBuffer, mediaSource = this.mediaSource;
        if (!mediaSource || mediaSource.readyState !== 'open') {
            this._needsEos = false;
            return;
        }
        for (var type in sb) {
            var sbobj = sb[type];
            if (!sbobj.ended) {
                return;
            }
            if (sbobj.updating) {
                this._needsEos = true;
                return;
            }
        }
        logger_1.logger.log('all media data are available, signal endOfStream() to MediaSource and stop loading fragment');
        // Notify the media element that it now has all of the media data
        try {
            mediaSource.endOfStream();
        }
        catch (e) {
            logger_1.logger.warn('exception while calling mediaSource.endOfStream()');
        }
        this._needsEos = false;
    };
    BufferController.prototype.onBufferFlushing = function (data) {
        this.flushRange.push({ start: data.startOffset, end: data.endOffset, type: data.type });
        // attempt flush immediately
        this.flushBufferCounter = 0;
        this.doFlush();
    };
    BufferController.prototype.flushLiveBackBuffer = function () {
        // clear back buffer for live only
        if (!this._live) {
            return;
        }
        var liveBackBufferLength = this.hls.config.liveBackBufferLength;
        if (!isFinite(liveBackBufferLength) || liveBackBufferLength < 0) {
            return;
        }
        var currentTime = this.media.currentTime;
        var sourceBuffer = this.sourceBuffer;
        var bufferTypes = Object.keys(sourceBuffer);
        var targetBackBufferPosition = currentTime - Math.max(liveBackBufferLength, this._levelTargetDuration);
        for (var index = bufferTypes.length - 1; index >= 0; index--) {
            var bufferType = bufferTypes[index], buffered = sourceBuffer[bufferType].buffered;
            // when target buffer start exceeds actual buffer start
            if (buffered.length > 0 && targetBackBufferPosition > buffered.start(0)) {
                // remove buffer up until current time minus minimum back buffer length (removing buffer too close to current
                // time will lead to playback freezing)
                // credits for level target duration - https://github.com/videojs/http-streaming/blob/3132933b6aa99ddefab29c10447624efd6fd6e52/src/segment-loader.js#L91
                this.removeBufferRange(bufferType, sourceBuffer[bufferType], 0, targetBackBufferPosition);
            }
        }
    };
    BufferController.prototype.onLevelUpdated = function (_a) {
        var details = _a.details;
        if (details.fragments.length > 0) {
            this._levelDuration = details.totalduration + details.fragments[0].start;
            this._levelTargetDuration = details.averagetargetduration || details.targetduration || 10;
            this._live = details.live;
            this.updateMediaElementDuration();
        }
    };
    /**
     * Update Media Source duration to current level duration or override to Infinity if configuration parameter
     * 'liveDurationInfinity` is set to `true`
     * More details: https://github.com/video-dev/hls.js/issues/355
     */
    BufferController.prototype.updateMediaElementDuration = function () {
        var config = this.hls.config;
        var duration;
        if (this._levelDuration === null ||
            !this.media ||
            !this.mediaSource ||
            !this.sourceBuffer ||
            this.media.readyState === 0 ||
            this.mediaSource.readyState !== 'open') {
            return;
        }
        for (var type in this.sourceBuffer) {
            if (this.sourceBuffer[type].updating === true) {
                // can't set duration whilst a buffer is updating
                return;
            }
        }
        duration = this.media.duration;
        // initialise to the value that the media source is reporting
        if (this._msDuration === null) {
            this._msDuration = this.mediaSource.duration;
        }
        if (this._live === true && config.liveDurationInfinity === true) {
            // Override duration to Infinity
            logger_1.logger.log('Media Source duration is set to Infinity');
            this._msDuration = this.mediaSource.duration = Infinity;
        }
        else if ((this._levelDuration > this._msDuration && this._levelDuration > duration) || !Number.isFinite(duration)) {
            // levelDuration was the last value we set.
            // not using mediaSource.duration as the browser may tweak this value
            // only update Media Source duration if its value increase, this is to avoid
            // flushing already buffered portion when switching between quality level
            logger_1.logger.log("Updating Media Source duration to " + this._levelDuration.toFixed(3));
            this._msDuration = this.mediaSource.duration = this._levelDuration;
        }
    };
    BufferController.prototype.doFlush = function () {
        // loop through all buffer ranges to flush
        while (this.flushRange.length) {
            var range = this.flushRange[0];
            // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
            if (this.flushBuffer(range.start, range.end, range.type)) {
                // range flushed, remove from flush array
                this.flushRange.shift();
                this.flushBufferCounter = 0;
            }
            else {
                this._needsFlush = true;
                // avoid looping, wait for SB update end to retrigger a flush
                return;
            }
        }
        if (this.flushRange.length === 0) {
            // everything flushed
            this._needsFlush = false;
            // let's recompute this.appended, which is used to avoid flush looping
            var appended = 0;
            var sourceBuffer = this.sourceBuffer;
            try {
                for (var type in sourceBuffer) {
                    appended += sourceBuffer[type].buffered.length;
                }
            }
            catch (error) {
                // error could be thrown while accessing buffered, in case sourcebuffer has already been removed from MediaSource
                // this is harmess at this stage, catch this to avoid reporting an internal exception
                logger_1.logger.error('error while accessing sourceBuffer.buffered');
            }
            this.appended = appended;
            this.hls.trigger(events_1.default.BUFFER_FLUSHED);
        }
    };
    BufferController.prototype.doAppending = function () {
        var _a = this, hls = _a.hls, segments = _a.segments, sourceBuffer = _a.sourceBuffer;
        if (Object.keys(sourceBuffer).length) {
            if (this.media.error) {
                this.segments = [];
                logger_1.logger.error('trying to append although a media error occured, flush segment and abort');
                return;
            }
            if (this.appending) {
                // logger.log(`sb appending in progress`);
                return;
            }
            if (segments && segments.length) {
                var segment = segments.shift();
                try {
                    var type = segment.type, sb = sourceBuffer[type];
                    if (sb) {
                        if (!sb.updating) {
                            // reset sourceBuffer ended flag before appending segment
                            sb.ended = false;
                            // logger.log(`appending ${segment.content} ${type} SB, size:${segment.data.length}, ${segment.parent}`);
                            this.parent = segment.parent;
                            sb.appendBuffer(segment.data);
                            this.appendError = 0;
                            this.appended++;
                            this.appending = true;
                        }
                        else {
                            segments.unshift(segment);
                        }
                    }
                    else {
                        // in case we don't have any source buffer matching with this segment type,
                        // it means that Mediasource fails to create sourcebuffer
                        // discard this segment, and trigger update end
                        this.onSBUpdateEnd();
                    }
                }
                catch (err) {
                    // in case any error occured while appending, put back segment in segments table
                    logger_1.logger.error("error while trying to append buffer:" + err.message);
                    segments.unshift(segment);
                    var event_1 = { type: errors_1.ErrorTypes.MEDIA_ERROR, parent: segment.parent };
                    if (err.code !== 22) {
                        if (this.appendError) {
                            this.appendError++;
                        }
                        else {
                            this.appendError = 1;
                        }
                        event_1.details = errors_1.ErrorDetails.BUFFER_APPEND_ERROR;
                        /* with UHD content, we could get loop of quota exceeded error until
                          browser is able to evict some data from sourcebuffer. retrying help recovering this
                        */
                        if (this.appendError > hls.config.appendErrorMaxRetry) {
                            logger_1.logger.log("fail " + hls.config.appendErrorMaxRetry + " times to append segment in sourceBuffer");
                            this.segments = [];
                            event_1.fatal = true;
                            hls.trigger(events_1.default.ERROR, event_1);
                        }
                        else {
                            event_1.fatal = false;
                            hls.trigger(events_1.default.ERROR, event_1);
                        }
                    }
                    else {
                        // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
                        // let's stop appending any segments, and report BUFFER_FULL_ERROR error
                        this.segments = [];
                        event_1.details = errors_1.ErrorDetails.BUFFER_FULL_ERROR;
                        event_1.fatal = false;
                        hls.trigger(events_1.default.ERROR, event_1);
                    }
                }
            }
        }
    };
    /*
      flush specified buffered range,
      return true once range has been flushed.
      as sourceBuffer.remove() is asynchronous, flushBuffer will be retriggered on sourceBuffer update end
    */
    BufferController.prototype.flushBuffer = function (startOffset, endOffset, typeIn) {
        var sb;
        var sourceBuffer = this.sourceBuffer;
        if (Object.keys(sourceBuffer).length) {
            logger_1.logger.log("flushBuffer,pos/start/end: " + this.media.currentTime.toFixed(3) + "/" + startOffset + "/" + endOffset);
            // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
            if (this.flushBufferCounter < this.appended) {
                for (var type in sourceBuffer) {
                    // check if sourcebuffer type is defined (typeIn): if yes, let's only flush this one
                    // if no, let's flush all sourcebuffers
                    if (typeIn && type !== typeIn) {
                        continue;
                    }
                    sb = sourceBuffer[type];
                    // we are going to flush buffer, mark source buffer as 'not ended'
                    sb.ended = false;
                    if (!sb.updating) {
                        if (this.removeBufferRange(type, sb, startOffset, endOffset)) {
                            this.flushBufferCounter++;
                            return false;
                        }
                    }
                    else {
                        logger_1.logger.warn('cannot flush, sb updating in progress');
                        return false;
                    }
                }
            }
            else {
                logger_1.logger.warn('abort flushing too many retries');
            }
            logger_1.logger.log('buffer flushed');
        }
        // everything flushed !
        return true;
    };
    /**
     * Removes first buffered range from provided source buffer that lies within given start and end offsets.
     *
     * @param type Type of the source buffer, logging purposes only.
     * @param sb Target SourceBuffer instance.
     * @param startOffset
     * @param endOffset
     *
     * @returns {boolean} True when source buffer remove requested.
     */
    BufferController.prototype.removeBufferRange = function (type, sb, startOffset, endOffset) {
        try {
            for (var i = 0; i < sb.buffered.length; i++) {
                var bufStart = sb.buffered.start(i);
                var bufEnd = sb.buffered.end(i);
                var removeStart = Math.max(bufStart, startOffset);
                var removeEnd = Math.min(bufEnd, endOffset);
                /* sometimes sourcebuffer.remove() does not flush
                  the exact expected time range.
                  to avoid rounding issues/infinite loop,
                  only flush buffer range of length greater than 500ms.
                */
                if (Math.min(removeEnd, bufEnd) - removeStart > 0.5) {
                    logger_1.logger.log("sb remove " + type + " [" + removeStart + "," + removeEnd + "], of [" + bufStart + "," + bufEnd + "], pos:" + this.media.currentTime);
                    sb.remove(removeStart, removeEnd);
                    return true;
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('removeBufferRange failed', error);
        }
        return false;
    };
    return BufferController;
}(event_handler_1.default));
exports.default = BufferController;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/cap-level-controller.js":
/*!************************************************!*\
  !*** ./src/controller/cap-level-controller.js ***!
  \************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/*
 * cap stream level to media size dimension controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var CapLevelController = /** @class */ (function (_super) {
    __extends(CapLevelController, _super);
    function CapLevelController(hls) {
        var _this = _super.call(this, hls, events_1.default.FPS_DROP_LEVEL_CAPPING, events_1.default.MEDIA_ATTACHING, events_1.default.MANIFEST_PARSED, events_1.default.BUFFER_CODECS, events_1.default.MEDIA_DETACHING) || this;
        _this.autoLevelCapping = Number.POSITIVE_INFINITY;
        _this.firstLevel = null;
        _this.levels = [];
        _this.media = null;
        _this.restrictedLevels = [];
        _this.timer = null;
        return _this;
    }
    CapLevelController.prototype.destroy = function () {
        if (this.hls.config.capLevelToPlayerSize) {
            this.media = null;
            this._stopCapping();
        }
    };
    CapLevelController.prototype.onFpsDropLevelCapping = function (data) {
        // Don't add a restricted level more than once
        if (CapLevelController.isLevelAllowed(data.droppedLevel, this.restrictedLevels)) {
            this.restrictedLevels.push(data.droppedLevel);
        }
    };
    CapLevelController.prototype.onMediaAttaching = function (data) {
        this.media = data.media instanceof window.HTMLVideoElement ? data.media : null;
    };
    CapLevelController.prototype.onManifestParsed = function (data) {
        var hls = this.hls;
        this.restrictedLevels = [];
        this.levels = data.levels;
        this.firstLevel = data.firstLevel;
        if (hls.config.capLevelToPlayerSize && data.video) {
            // Start capping immediately if the manifest has signaled video codecs
            this._startCapping();
        }
    };
    // Only activate capping when playing a video stream; otherwise, multi-bitrate audio-only streams will be restricted
    // to the first level
    CapLevelController.prototype.onBufferCodecs = function (data) {
        var hls = this.hls;
        if (hls.config.capLevelToPlayerSize && data.video) {
            // If the manifest did not signal a video codec capping has been deferred until we're certain video is present
            this._startCapping();
        }
    };
    CapLevelController.prototype.onLevelsUpdated = function (data) {
        this.levels = data.levels;
    };
    CapLevelController.prototype.onMediaDetaching = function () {
        this._stopCapping();
    };
    CapLevelController.prototype.detectPlayerSize = function () {
        if (this.media) {
            var levelsLength = this.levels ? this.levels.length : 0;
            if (levelsLength) {
                var hls_1 = this.hls;
                hls_1.autoLevelCapping = this.getMaxLevel(levelsLength - 1);
                if (hls_1.autoLevelCapping > this.autoLevelCapping) {
                    // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
                    // usually happen when the user go to the fullscreen mode.
                    hls_1.streamController.nextLevelSwitch();
                }
                this.autoLevelCapping = hls_1.autoLevelCapping;
            }
        }
    };
    /*
    * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
    */
    CapLevelController.prototype.getMaxLevel = function (capLevelIndex) {
        var _this = this;
        if (!this.levels) {
            return -1;
        }
        var validLevels = this.levels.filter(function (level, index) {
            return CapLevelController.isLevelAllowed(index, _this.restrictedLevels) && index <= capLevelIndex;
        });
        return CapLevelController.getMaxLevelByMediaSize(validLevels, this.mediaWidth, this.mediaHeight);
    };
    CapLevelController.prototype._startCapping = function () {
        if (this.timer) {
            // Don't reset capping if started twice; this can happen if the manifest signals a video codec
            return;
        }
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        this.hls.firstLevel = this.getMaxLevel(this.firstLevel);
        clearInterval(this.timer);
        this.timer = setInterval(this.detectPlayerSize.bind(this), 1000);
        this.detectPlayerSize();
    };
    CapLevelController.prototype._stopCapping = function () {
        this.restrictedLevels = [];
        this.firstLevel = null;
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        if (this.timer) {
            this.timer = clearInterval(this.timer);
            this.timer = null;
        }
    };
    Object.defineProperty(CapLevelController.prototype, "mediaWidth", {
        get: function () {
            var width;
            var media = this.media;
            if (media) {
                width = media.width || media.clientWidth || media.offsetWidth;
                width *= CapLevelController.contentScaleFactor;
            }
            return width;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CapLevelController.prototype, "mediaHeight", {
        get: function () {
            var height;
            var media = this.media;
            if (media) {
                height = media.height || media.clientHeight || media.offsetHeight;
                height *= CapLevelController.contentScaleFactor;
            }
            return height;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CapLevelController, "contentScaleFactor", {
        get: function () {
            var pixelRatio = 1;
            try {
                pixelRatio = window.devicePixelRatio;
            }
            catch (e) { }
            return pixelRatio;
        },
        enumerable: true,
        configurable: true
    });
    CapLevelController.isLevelAllowed = function (level, restrictedLevels) {
        if (restrictedLevels === void 0) { restrictedLevels = []; }
        return restrictedLevels.indexOf(level) === -1;
    };
    CapLevelController.getMaxLevelByMediaSize = function (levels, width, height) {
        if (!levels || (levels && !levels.length)) {
            return -1;
        }
        // Levels can have the same dimensions but differing bandwidths - since levels are ordered, we can look to the next
        // to determine whether we've chosen the greatest bandwidth for the media's dimensions
        var atGreatestBandiwdth = function (curLevel, nextLevel) {
            if (!nextLevel) {
                return true;
            }
            return curLevel.width !== nextLevel.width || curLevel.height !== nextLevel.height;
        };
        // If we run through the loop without breaking, the media's dimensions are greater than every level, so default to
        // the max level
        var maxLevelIndex = levels.length - 1;
        for (var i = 0; i < levels.length; i += 1) {
            var level = levels[i];
            if ((level.width >= width || level.height >= height) && atGreatestBandiwdth(level, levels[i + 1])) {
                maxLevelIndex = i;
                break;
            }
        }
        return maxLevelIndex;
    };
    return CapLevelController;
}(event_handler_1.default));
exports.default = CapLevelController;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/eme-controller.js":
/*!******************************************!*\
  !*** ./src/controller/eme-controller.js ***!
  \******************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @author Stephan Hesse <disparat@gmail.com> | <tchakabam@gmail.com>
 *
 * DRM support for Hls.js
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var XMLHttpRequest = window.XMLHttpRequest;
var MAX_LICENSE_REQUEST_FAILURES = 3;
/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMediaKeySystemAccess
 */
var KeySystems = {
    WIDEVINE: 'com.widevine.alpha',
    PLAYREADY: 'com.microsoft.playready'
};
/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @param {object} drmSystemOptions Optional parameters/requirements for the key-system
 * @returns {Array<MediaSystemConfiguration>} An array of supported configurations
 */
var createWidevineMediaKeySystemConfigurations = function (audioCodecs, videoCodecs, drmSystemOptions) {
    var baseConfig = {
        // initDataTypes: ['keyids', 'mp4'],
        // label: "",
        // persistentState: "not-allowed", // or "required" ?
        // distinctiveIdentifier: "not-allowed", // or "required" ?
        // sessionTypes: ['temporary'],
        videoCapabilities: [
        // { contentType: 'video/mp4; codecs="avc1.42E01E"' }
        ]
    };
    videoCodecs.forEach(function (codec) {
        baseConfig.videoCapabilities.push({
            contentType: "video/mp4; codecs=\"" + codec + "\""
        });
    });
    return [
        baseConfig
    ];
};
/**
 * The idea here is to handle key-system (and their respective platforms) specific configuration differences
 * in order to work with the local requestMediaKeySystemAccess method.
 *
 * We can also rule-out platform-related key-system support at this point by throwing an error or returning null.
 *
 * @param {string} keySystem Identifier for the key-system, see `KeySystems` enum
 * @param {Array<string>} audioCodecs List of required audio codecs to support
 * @param {Array<string>} videoCodecs List of required video codecs to support
 * @returns {Array<MediaSystemConfiguration> | null} A non-empty Array of MediaKeySystemConfiguration objects or `null`
 */
var getSupportedMediaKeySystemConfigurations = function (keySystem, audioCodecs, videoCodecs) {
    switch (keySystem) {
        case KeySystems.WIDEVINE:
            return createWidevineMediaKeySystemConfigurations(audioCodecs, videoCodecs);
        default:
            throw Error('Unknown key-system: ' + keySystem);
    }
};
/**
 * Controller to deal with encrypted media extensions (EME)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Encrypted_Media_Extensions_API
 *
 * @class
 * @constructor
 */
var EMEController = /** @class */ (function (_super) {
    __extends(EMEController, _super);
    /**
       * @constructs
       * @param {Hls} hls Our Hls.js instance
       */
    function EMEController(hls) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHED, events_1.default.MANIFEST_PARSED) || this;
        _this._widevineLicenseUrl = hls.config.widevineLicenseUrl;
        _this._licenseXhrSetup = hls.config.licenseXhrSetup;
        _this._emeEnabled = hls.config.emeEnabled;
        _this._requestMediaKeySystemAccess = hls.config.requestMediaKeySystemAccessFunc;
        _this._mediaKeysList = [];
        _this._media = null;
        _this._hasSetMediaKeys = false;
        _this._isMediaEncrypted = false;
        _this._requestLicenseFailureCount = 0;
        return _this;
    }
    /**
       *
       * @param {string} keySystem Identifier for the key-system, see `KeySystems` enum
       * @returns {string} License server URL for key-system (if any configured, otherwise causes error)
       */
    EMEController.prototype.getLicenseServerUrl = function (keySystem) {
        var url;
        switch (keySystem) {
            case KeySystems.WIDEVINE:
                url = this._widevineLicenseUrl;
                break;
            default:
                url = null;
                break;
        }
        if (!url) {
            logger_1.logger.error("No license server URL configured for key-system \"" + keySystem + "\"");
            this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                details: errors_1.ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
                fatal: true
            });
        }
        return url;
    };
    /**
       * Requests access object and adds it to our list upon success
       * @private
       * @param {string} keySystem System ID (see `KeySystems`)
       * @param {Array<string>} audioCodecs List of required audio codecs to support
       * @param {Array<string>} videoCodecs List of required video codecs to support
       */
    EMEController.prototype._attemptKeySystemAccess = function (keySystem, audioCodecs, videoCodecs) {
        // TODO: add other DRM "options"
        var _this = this;
        var mediaKeySystemConfigs = getSupportedMediaKeySystemConfigurations(keySystem, audioCodecs, videoCodecs);
        if (!mediaKeySystemConfigs) {
            logger_1.logger.warn('Can not create config for key-system (maybe because platform is not supported):', keySystem);
            return;
        }
        logger_1.logger.log('Requesting encrypted media key-system access');
        // expecting interface like window.navigator.requestMediaKeySystemAccess
        this.requestMediaKeySystemAccess(keySystem, mediaKeySystemConfigs)
            .then(function (mediaKeySystemAccess) {
            _this._onMediaKeySystemAccessObtained(keySystem, mediaKeySystemAccess);
        })
            .catch(function (err) {
            logger_1.logger.error("Failed to obtain key-system \"" + keySystem + "\" access:", err);
        });
    };
    Object.defineProperty(EMEController.prototype, "requestMediaKeySystemAccess", {
        get: function () {
            if (!this._requestMediaKeySystemAccess) {
                throw new Error('No requestMediaKeySystemAccess function configured');
            }
            return this._requestMediaKeySystemAccess;
        },
        enumerable: true,
        configurable: true
    });
    /**
       * Handles obtaining access to a key-system
       *
       * @param {string} keySystem
       * @param {MediaKeySystemAccess} mediaKeySystemAccess https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemAccess
       */
    EMEController.prototype._onMediaKeySystemAccessObtained = function (keySystem, mediaKeySystemAccess) {
        var _this = this;
        logger_1.logger.log("Access for key-system \"" + keySystem + "\" obtained");
        var mediaKeysListItem = {
            mediaKeys: null,
            mediaKeysSession: null,
            mediaKeysSessionInitialized: false,
            mediaKeySystemAccess: mediaKeySystemAccess,
            mediaKeySystemDomain: keySystem
        };
        this._mediaKeysList.push(mediaKeysListItem);
        mediaKeySystemAccess.createMediaKeys()
            .then(function (mediaKeys) {
            mediaKeysListItem.mediaKeys = mediaKeys;
            logger_1.logger.log("Media-keys created for key-system \"" + keySystem + "\"");
            _this._onMediaKeysCreated();
        })
            .catch(function (err) {
            logger_1.logger.error('Failed to create media-keys:', err);
        });
    };
    /**
       * Handles key-creation (represents access to CDM). We are going to create key-sessions upon this
       * for all existing keys where no session exists yet.
       */
    EMEController.prototype._onMediaKeysCreated = function () {
        var _this = this;
        // check for all key-list items if a session exists, otherwise, create one
        this._mediaKeysList.forEach(function (mediaKeysListItem) {
            if (!mediaKeysListItem.mediaKeysSession) {
                mediaKeysListItem.mediaKeysSession = mediaKeysListItem.mediaKeys.createSession();
                _this._onNewMediaKeySession(mediaKeysListItem.mediaKeysSession);
            }
        });
    };
    /**
       *
       * @param {*} keySession
       */
    EMEController.prototype._onNewMediaKeySession = function (keySession) {
        var _this = this;
        logger_1.logger.log("New key-system session " + keySession.sessionId);
        keySession.addEventListener('message', function (event) {
            _this._onKeySessionMessage(keySession, event.message);
        }, false);
    };
    EMEController.prototype._onKeySessionMessage = function (keySession, message) {
        logger_1.logger.log('Got EME message event, creating license request');
        this._requestLicense(message, function (data) {
            logger_1.logger.log('Received license data, updating key-session');
            keySession.update(data);
        });
    };
    EMEController.prototype._onMediaEncrypted = function (initDataType, initData) {
        logger_1.logger.log("Media is encrypted using \"" + initDataType + "\" init data type");
        this._isMediaEncrypted = true;
        this._mediaEncryptionInitDataType = initDataType;
        this._mediaEncryptionInitData = initData;
        this._attemptSetMediaKeys();
        this._generateRequestWithPreferredKeySession();
    };
    EMEController.prototype._attemptSetMediaKeys = function () {
        if (!this._hasSetMediaKeys) {
            // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
            var keysListItem = this._mediaKeysList[0];
            if (!keysListItem || !keysListItem.mediaKeys) {
                logger_1.logger.error('Fatal: Media is encrypted but no CDM access or no keys have been obtained yet');
                this.hls.trigger(events_1.default.ERROR, {
                    type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                    details: errors_1.ErrorDetails.KEY_SYSTEM_NO_KEYS,
                    fatal: true
                });
                return;
            }
            logger_1.logger.log('Setting keys for encrypted media');
            this._media.setMediaKeys(keysListItem.mediaKeys);
            this._hasSetMediaKeys = true;
        }
    };
    EMEController.prototype._generateRequestWithPreferredKeySession = function () {
        var _this = this;
        // FIXME: see if we can/want/need-to really to deal with several potential key-sessions?
        var keysListItem = this._mediaKeysList[0];
        if (!keysListItem) {
            logger_1.logger.error('Fatal: Media is encrypted but not any key-system access has been obtained yet');
            this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                details: errors_1.ErrorDetails.KEY_SYSTEM_NO_ACCESS,
                fatal: true
            });
            return;
        }
        if (keysListItem.mediaKeysSessionInitialized) {
            logger_1.logger.warn('Key-Session already initialized but requested again');
            return;
        }
        var keySession = keysListItem.mediaKeysSession;
        if (!keySession) {
            logger_1.logger.error('Fatal: Media is encrypted but no key-session existing');
            this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                details: errors_1.ErrorDetails.KEY_SYSTEM_NO_SESSION,
                fatal: true
            });
        }
        var initDataType = this._mediaEncryptionInitDataType;
        var initData = this._mediaEncryptionInitData;
        logger_1.logger.log("Generating key-session request for \"" + initDataType + "\" init data type");
        keysListItem.mediaKeysSessionInitialized = true;
        keySession.generateRequest(initDataType, initData)
            .then(function () {
            logger_1.logger.debug('Key-session generation succeeded');
        })
            .catch(function (err) {
            logger_1.logger.error('Error generating key-session request:', err);
            _this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                details: errors_1.ErrorDetails.KEY_SYSTEM_NO_SESSION,
                fatal: false
            });
        });
    };
    /**
       * @param {string} url License server URL
       * @param {ArrayBuffer} keyMessage Message data issued by key-system
       * @param {function} callback Called when XHR has succeeded
       * @returns {XMLHttpRequest} Unsent (but opened state) XHR object
       */
    EMEController.prototype._createLicenseXhr = function (url, keyMessage, callback) {
        var xhr = new XMLHttpRequest();
        var licenseXhrSetup = this._licenseXhrSetup;
        try {
            if (licenseXhrSetup) {
                try {
                    licenseXhrSetup(xhr, url);
                }
                catch (e) {
                    // let's try to open before running setup
                    xhr.open('POST', url, true);
                    licenseXhrSetup(xhr, url);
                }
            }
            // if licenseXhrSetup did not yet call open, let's do it now
            if (!xhr.readyState) {
                xhr.open('POST', url, true);
            }
        }
        catch (e) {
            // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
            logger_1.logger.error('Error setting up key-system license XHR', e);
            this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                details: errors_1.ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
                fatal: true
            });
            return;
        }
        xhr.responseType = 'arraybuffer';
        xhr.onreadystatechange =
            this._onLicenseRequestReadyStageChange.bind(this, xhr, url, keyMessage, callback);
        return xhr;
    };
    /**
       * @param {XMLHttpRequest} xhr
       * @param {string} url License server URL
       * @param {ArrayBuffer} keyMessage Message data issued by key-system
       * @param {function} callback Called when XHR has succeeded
       *
       */
    EMEController.prototype._onLicenseRequestReadyStageChange = function (xhr, url, keyMessage, callback) {
        switch (xhr.readyState) {
            case 4:
                if (xhr.status === 200) {
                    this._requestLicenseFailureCount = 0;
                    logger_1.logger.log('License request succeeded');
                    callback(xhr.response);
                }
                else {
                    logger_1.logger.error("License Request XHR failed (" + url + "). Status: " + xhr.status + " (" + xhr.statusText + ")");
                    this._requestLicenseFailureCount++;
                    if (this._requestLicenseFailureCount <= MAX_LICENSE_REQUEST_FAILURES) {
                        var attemptsLeft = MAX_LICENSE_REQUEST_FAILURES - this._requestLicenseFailureCount + 1;
                        logger_1.logger.warn("Retrying license request, " + attemptsLeft + " attempts left");
                        this._requestLicense(keyMessage, callback);
                        return;
                    }
                    this.hls.trigger(events_1.default.ERROR, {
                        type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                        details: errors_1.ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED,
                        fatal: true
                    });
                }
                break;
        }
    };
    /**
       * @param {object} keysListItem
       * @param {ArrayBuffer} keyMessage
       * @returns {ArrayBuffer} Challenge data posted to license server
       */
    EMEController.prototype._generateLicenseRequestChallenge = function (keysListItem, keyMessage) {
        var challenge;
        if (keysListItem.mediaKeySystemDomain === KeySystems.PLAYREADY) {
            logger_1.logger.error('PlayReady is not supported (yet)');
            // from https://github.com/MicrosoftEdge/Demos/blob/master/eme/scripts/demo.js
            /*
              if (this.licenseType !== this.LICENSE_TYPE_WIDEVINE) {
                  // For PlayReady CDMs, we need to dig the Challenge out of the XML.
                  var keyMessageXml = new DOMParser().parseFromString(String.fromCharCode.apply(null, new Uint16Array(keyMessage)), 'application/xml');
                  if (keyMessageXml.getElementsByTagName('Challenge')[0]) {
                      challenge = atob(keyMessageXml.getElementsByTagName('Challenge')[0].childNodes[0].nodeValue);
                  } else {
                      throw 'Cannot find <Challenge> in key message';
                  }
                  var headerNames = keyMessageXml.getElementsByTagName('name');
                  var headerValues = keyMessageXml.getElementsByTagName('value');
                  if (headerNames.length !== headerValues.length) {
                      throw 'Mismatched header <name>/<value> pair in key message';
                  }
                  for (var i = 0; i < headerNames.length; i++) {
                      xhr.setRequestHeader(headerNames[i].childNodes[0].nodeValue, headerValues[i].childNodes[0].nodeValue);
                  }
              }
              */
        }
        else if (keysListItem.mediaKeySystemDomain === KeySystems.WIDEVINE) {
            // For Widevine CDMs, the challenge is the keyMessage.
            challenge = keyMessage;
        }
        else {
            logger_1.logger.error('Unsupported key-system:', keysListItem.mediaKeySystemDomain);
        }
        return challenge;
    };
    EMEController.prototype._requestLicense = function (keyMessage, callback) {
        logger_1.logger.log('Requesting content license for key-system');
        var keysListItem = this._mediaKeysList[0];
        if (!keysListItem) {
            logger_1.logger.error('Fatal error: Media is encrypted but no key-system access has been obtained yet');
            this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.KEY_SYSTEM_ERROR,
                details: errors_1.ErrorDetails.KEY_SYSTEM_NO_ACCESS,
                fatal: true
            });
            return;
        }
        var url = this.getLicenseServerUrl(keysListItem.mediaKeySystemDomain);
        var xhr = this._createLicenseXhr(url, keyMessage, callback);
        logger_1.logger.log("Sending license request to URL: " + url);
        xhr.send(this._generateLicenseRequestChallenge(keysListItem, keyMessage));
    };
    EMEController.prototype.onMediaAttached = function (data) {
        var _this = this;
        if (!this._emeEnabled) {
            return;
        }
        var media = data.media;
        // keep reference of media
        this._media = media;
        // FIXME: also handle detaching media !
        media.addEventListener('encrypted', function (e) {
            _this._onMediaEncrypted(e.initDataType, e.initData);
        });
    };
    EMEController.prototype.onManifestParsed = function (data) {
        if (!this._emeEnabled) {
            return;
        }
        var audioCodecs = data.levels.map(function (level) { return level.audioCodec; });
        var videoCodecs = data.levels.map(function (level) { return level.videoCodec; });
        this._attemptKeySystemAccess(KeySystems.WIDEVINE, audioCodecs, videoCodecs);
    };
    return EMEController;
}(event_handler_1.default));
exports.default = EMEController;


/***/ }),

/***/ "./src/controller/fps-controller.js":
/*!******************************************!*\
  !*** ./src/controller/fps-controller.js ***!
  \******************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * FPS Controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var performance = window.performance;
var FPSController = /** @class */ (function (_super) {
    __extends(FPSController, _super);
    function FPSController(hls) {
        return _super.call(this, hls, events_1.default.MEDIA_ATTACHING) || this;
    }
    FPSController.prototype.destroy = function () {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.isVideoPlaybackQualityAvailable = false;
    };
    FPSController.prototype.onMediaAttaching = function (data) {
        var config = this.hls.config;
        if (config.capLevelOnFPSDrop) {
            var video_1 = this.video = data.media instanceof window.HTMLVideoElement ? data.media : null;
            if (typeof video_1.getVideoPlaybackQuality === 'function') {
                this.isVideoPlaybackQualityAvailable = true;
            }
            clearInterval(this.timer);
            this.timer = setInterval(this.checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
        }
    };
    FPSController.prototype.checkFPS = function (video, decodedFrames, droppedFrames) {
        var currentTime = performance.now();
        if (decodedFrames) {
            if (this.lastTime) {
                var currentPeriod = currentTime - this.lastTime, currentDropped = droppedFrames - this.lastDroppedFrames, currentDecoded = decodedFrames - this.lastDecodedFrames, droppedFPS = 1000 * currentDropped / currentPeriod, hls_1 = this.hls;
                hls_1.trigger(events_1.default.FPS_DROP, { currentDropped: currentDropped, currentDecoded: currentDecoded, totalDroppedFrames: droppedFrames });
                if (droppedFPS > 0) {
                    // logger.log('checkFPS : droppedFPS/decodedFPS:' + droppedFPS/(1000 * currentDecoded / currentPeriod));
                    if (currentDropped > hls_1.config.fpsDroppedMonitoringThreshold * currentDecoded) {
                        var currentLevel = hls_1.currentLevel;
                        logger_1.logger.warn('drop FPS ratio greater than max allowed value for currentLevel: ' + currentLevel);
                        if (currentLevel > 0 && (hls_1.autoLevelCapping === -1 || hls_1.autoLevelCapping >= currentLevel)) {
                            currentLevel = currentLevel - 1;
                            hls_1.trigger(events_1.default.FPS_DROP_LEVEL_CAPPING, { level: currentLevel, droppedLevel: hls_1.currentLevel });
                            hls_1.autoLevelCapping = currentLevel;
                            hls_1.streamController.nextLevelSwitch();
                        }
                    }
                }
            }
            this.lastTime = currentTime;
            this.lastDroppedFrames = droppedFrames;
            this.lastDecodedFrames = decodedFrames;
        }
    };
    FPSController.prototype.checkFPSInterval = function () {
        var video = this.video;
        if (video) {
            if (this.isVideoPlaybackQualityAvailable) {
                var videoPlaybackQuality = video.getVideoPlaybackQuality();
                this.checkFPS(video, videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
            }
            else {
                this.checkFPS(video, video.webkitDecodedFrameCount, video.webkitDroppedFrameCount);
            }
        }
    };
    return FPSController;
}(event_handler_1.default));
exports.default = FPSController;


/***/ }),

/***/ "./src/controller/fragment-finders.js":
/*!********************************************!*\
  !*** ./src/controller/fragment-finders.js ***!
  \********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var binary_search_1 = __webpack_require__(/*! ../utils/binary-search */ "./src/utils/binary-search.js");
/**
 * Returns first fragment whose endPdt value exceeds the given PDT.
 * @param {Array<Fragment>} fragments - The array of candidate fragments
 * @param {number|null} [PDTValue = null] - The PDT value which must be exceeded
 * @param {number} [maxFragLookUpTolerance = 0] - The amount of time that a fragment's start/end can be within in order to be considered contiguous
 * @returns {*|null} fragment - The best matching fragment
 */
function findFragmentByPDT(fragments, PDTValue, maxFragLookUpTolerance) {
    if (!Array.isArray(fragments) || !fragments.length || !Number.isFinite(PDTValue)) {
        return null;
    }
    // if less than start
    if (PDTValue < fragments[0].programDateTime) {
        return null;
    }
    if (PDTValue >= fragments[fragments.length - 1].endProgramDateTime) {
        return null;
    }
    maxFragLookUpTolerance = maxFragLookUpTolerance || 0;
    for (var seg = 0; seg < fragments.length; ++seg) {
        var frag = fragments[seg];
        if (pdtWithinToleranceTest(PDTValue, maxFragLookUpTolerance, frag)) {
            return frag;
        }
    }
    return null;
}
exports.findFragmentByPDT = findFragmentByPDT;
/**
 * Finds a fragment based on the SN of the previous fragment; or based on the needs of the current buffer.
 * This method compensates for small buffer gaps by applying a tolerance to the start of any candidate fragment, thus
 * breaking any traps which would cause the same fragment to be continuously selected within a small range.
 * @param {*} fragPrevious - The last frag successfully appended
 * @param {Array<Fragment>} fragments - The array of candidate fragments
 * @param {number} [bufferEnd = 0] - The end of the contiguous buffered range the playhead is currently within
 * @param {number} maxFragLookUpTolerance - The amount of time that a fragment's start/end can be within in order to be considered contiguous
 * @returns {*} foundFrag - The best matching fragment
 */
function findFragmentByPTS(fragPrevious, fragments, bufferEnd, maxFragLookUpTolerance) {
    if (bufferEnd === void 0) { bufferEnd = 0; }
    if (maxFragLookUpTolerance === void 0) { maxFragLookUpTolerance = 0; }
    var fragNext = fragPrevious ? fragments[fragPrevious.sn - fragments[0].sn + 1] : null;
    // Prefer the next fragment if it's within tolerance
    if (fragNext && !fragmentWithinToleranceTest(bufferEnd, maxFragLookUpTolerance, fragNext)) {
        return fragNext;
    }
    return binary_search_1.default.search(fragments, fragmentWithinToleranceTest.bind(null, bufferEnd, maxFragLookUpTolerance));
}
exports.findFragmentByPTS = findFragmentByPTS;
/**
 * The test function used by the findFragmentBySn's BinarySearch to look for the best match to the current buffer conditions.
 * @param {*} candidate - The fragment to test
 * @param {number} [bufferEnd = 0] - The end of the current buffered range the playhead is currently within
 * @param {number} [maxFragLookUpTolerance = 0] - The amount of time that a fragment's start can be within in order to be considered contiguous
 * @returns {number} - 0 if it matches, 1 if too low, -1 if too high
 */
function fragmentWithinToleranceTest(bufferEnd, maxFragLookUpTolerance, candidate) {
    if (bufferEnd === void 0) { bufferEnd = 0; }
    if (maxFragLookUpTolerance === void 0) { maxFragLookUpTolerance = 0; }
    // offset should be within fragment boundary - config.maxFragLookUpTolerance
    // this is to cope with situations like
    // bufferEnd = 9.991
    // frag[Ø] : [0,10]
    // frag[1] : [10,20]
    // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
    //              frag start               frag start+duration
    //                  |-----------------------------|
    //              <--->                         <--->
    //  ...--------><-----------------------------><---------....
    // previous frag         matching fragment         next frag
    //  return -1             return 0                 return 1
    // logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
    // Set the lookup tolerance to be small enough to detect the current segment - ensures we don't skip over very small segments
    var candidateLookupTolerance = Math.min(maxFragLookUpTolerance, candidate.duration + (candidate.deltaPTS ? candidate.deltaPTS : 0));
    if (candidate.start + candidate.duration - candidateLookupTolerance <= bufferEnd) {
        return 1;
    }
    else if (candidate.start - candidateLookupTolerance > bufferEnd && candidate.start) {
        // if maxFragLookUpTolerance will have negative value then don't return -1 for first element
        return -1;
    }
    return 0;
}
exports.fragmentWithinToleranceTest = fragmentWithinToleranceTest;
/**
 * The test function used by the findFragmentByPdt's BinarySearch to look for the best match to the current buffer conditions.
 * This function tests the candidate's program date time values, as represented in Unix time
 * @param {*} candidate - The fragment to test
 * @param {number} [pdtBufferEnd = 0] - The Unix time representing the end of the current buffered range
 * @param {number} [maxFragLookUpTolerance = 0] - The amount of time that a fragment's start can be within in order to be considered contiguous
 * @returns {boolean} True if contiguous, false otherwise
 */
function pdtWithinToleranceTest(pdtBufferEnd, maxFragLookUpTolerance, candidate) {
    var candidateLookupTolerance = Math.min(maxFragLookUpTolerance, candidate.duration + (candidate.deltaPTS ? candidate.deltaPTS : 0)) * 1000;
    return candidate.endProgramDateTime - candidateLookupTolerance > pdtBufferEnd;
}
exports.pdtWithinToleranceTest = pdtWithinToleranceTest;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/fragment-tracker.js":
/*!********************************************!*\
  !*** ./src/controller/fragment-tracker.js ***!
  \********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
exports.FragmentState = {
    NOT_LOADED: 'NOT_LOADED',
    APPENDING: 'APPENDING',
    PARTIAL: 'PARTIAL',
    OK: 'OK'
};
var FragmentTracker = /** @class */ (function (_super) {
    __extends(FragmentTracker, _super);
    function FragmentTracker(hls) {
        var _this = _super.call(this, hls, events_1.default.BUFFER_APPENDED, events_1.default.FRAG_BUFFERED, events_1.default.FRAG_LOADED) || this;
        _this.bufferPadding = 0.2;
        _this.fragments = Object.create(null);
        _this.timeRanges = Object.create(null);
        _this.config = hls.config;
        return _this;
    }
    FragmentTracker.prototype.destroy = function () {
        this.fragments = null;
        this.timeRanges = null;
        this.config = null;
        event_handler_1.default.prototype.destroy.call(this);
        _super.prototype.destroy.call(this);
    };
    /**
     * Return a Fragment that match the position and levelType.
     * If not found any Fragment, return null
     * @param {number} position
     * @param {LevelType} levelType
     * @returns {Fragment|null}
     */
    FragmentTracker.prototype.getBufferedFrag = function (position, levelType) {
        var fragments = this.fragments;
        var bufferedFrags = Object.keys(fragments).filter(function (key) {
            var fragmentEntity = fragments[key];
            if (fragmentEntity.body.type !== levelType) {
                return false;
            }
            if (!fragmentEntity.buffered) {
                return false;
            }
            var frag = fragmentEntity.body;
            return frag.startPTS <= position && position <= frag.endPTS;
        });
        if (bufferedFrags.length === 0) {
            return null;
        }
        else {
            // https://github.com/video-dev/hls.js/pull/1545#discussion_r166229566
            var bufferedFragKey = bufferedFrags.pop();
            return fragments[bufferedFragKey].body;
        }
    };
    /**
     * Partial fragments effected by coded frame eviction will be removed
     * The browser will unload parts of the buffer to free up memory for new buffer data
     * Fragments will need to be reloaded when the buffer is freed up, removing partial fragments will allow them to reload(since there might be parts that are still playable)
     * @param {String} elementaryStream The elementaryStream of media this is (eg. video/audio)
     * @param {TimeRanges} timeRange TimeRange object from a sourceBuffer
     */
    FragmentTracker.prototype.detectEvictedFragments = function (elementaryStream, timeRange) {
        var _this = this;
        var fragmentTimes, time;
        // Check if any flagged fragments have been unloaded
        Object.keys(this.fragments).forEach(function (key) {
            var fragmentEntity = _this.fragments[key];
            if (fragmentEntity.buffered === true) {
                var esData = fragmentEntity.range[elementaryStream];
                if (esData) {
                    fragmentTimes = esData.time;
                    for (var i = 0; i < fragmentTimes.length; i++) {
                        time = fragmentTimes[i];
                        if (_this.isTimeBuffered(time.startPTS, time.endPTS, timeRange) === false) {
                            // Unregister partial fragment as it needs to load again to be reused
                            _this.removeFragment(fragmentEntity.body);
                            break;
                        }
                    }
                }
            }
        });
    };
    /**
     * Checks if the fragment passed in is loaded in the buffer properly
     * Partially loaded fragments will be registered as a partial fragment
     * @param {Object} fragment Check the fragment against all sourceBuffers loaded
     */
    FragmentTracker.prototype.detectPartialFragments = function (fragment) {
        var _this = this;
        var fragKey = this.getFragmentKey(fragment);
        var fragmentEntity = this.fragments[fragKey];
        if (fragmentEntity) {
            fragmentEntity.buffered = true;
            Object.keys(this.timeRanges).forEach(function (elementaryStream) {
                if (fragment.hasElementaryStream(elementaryStream)) {
                    var timeRange = _this.timeRanges[elementaryStream];
                    // Check for malformed fragments
                    // Gaps need to be calculated for each elementaryStream
                    fragmentEntity.range[elementaryStream] = _this.getBufferedTimes(fragment.startPTS, fragment.endPTS, timeRange);
                }
            });
        }
    };
    FragmentTracker.prototype.getBufferedTimes = function (startPTS, endPTS, timeRange) {
        var fragmentTimes = [];
        var startTime, endTime;
        var fragmentPartial = false;
        for (var i = 0; i < timeRange.length; i++) {
            startTime = timeRange.start(i) - this.bufferPadding;
            endTime = timeRange.end(i) + this.bufferPadding;
            if (startPTS >= startTime && endPTS <= endTime) {
                // Fragment is entirely contained in buffer
                // No need to check the other timeRange times since it's completely playable
                fragmentTimes.push({
                    startPTS: Math.max(startPTS, timeRange.start(i)),
                    endPTS: Math.min(endPTS, timeRange.end(i))
                });
                break;
            }
            else if (startPTS < endTime && endPTS > startTime) {
                // Check for intersection with buffer
                // Get playable sections of the fragment
                fragmentTimes.push({
                    startPTS: Math.max(startPTS, timeRange.start(i)),
                    endPTS: Math.min(endPTS, timeRange.end(i))
                });
                fragmentPartial = true;
            }
            else if (endPTS <= startTime) {
                // No need to check the rest of the timeRange as it is in order
                break;
            }
        }
        return {
            time: fragmentTimes,
            partial: fragmentPartial
        };
    };
    FragmentTracker.prototype.getFragmentKey = function (fragment) {
        return fragment.type + "_" + fragment.level + "_" + fragment.urlId + "_" + fragment.sn;
    };
    /**
     * Gets the partial fragment for a certain time
     * @param {Number} time
     * @returns {Object} fragment Returns a partial fragment at a time or null if there is no partial fragment
     */
    FragmentTracker.prototype.getPartialFragment = function (time) {
        var _this = this;
        var timePadding, startTime, endTime;
        var bestFragment = null;
        var bestOverlap = 0;
        Object.keys(this.fragments).forEach(function (key) {
            var fragmentEntity = _this.fragments[key];
            if (_this.isPartial(fragmentEntity)) {
                startTime = fragmentEntity.body.startPTS - _this.bufferPadding;
                endTime = fragmentEntity.body.endPTS + _this.bufferPadding;
                if (time >= startTime && time <= endTime) {
                    // Use the fragment that has the most padding from start and end time
                    timePadding = Math.min(time - startTime, endTime - time);
                    if (bestOverlap <= timePadding) {
                        bestFragment = fragmentEntity.body;
                        bestOverlap = timePadding;
                    }
                }
            }
        });
        return bestFragment;
    };
    /**
     * @param {Object} fragment The fragment to check
     * @returns {String} Returns the fragment state when a fragment never loaded or if it partially loaded
     */
    FragmentTracker.prototype.getState = function (fragment) {
        var fragKey = this.getFragmentKey(fragment);
        var fragmentEntity = this.fragments[fragKey];
        var state = exports.FragmentState.NOT_LOADED;
        if (fragmentEntity !== undefined) {
            if (!fragmentEntity.buffered) {
                state = exports.FragmentState.APPENDING;
            }
            else if (this.isPartial(fragmentEntity) === true) {
                state = exports.FragmentState.PARTIAL;
            }
            else {
                state = exports.FragmentState.OK;
            }
        }
        return state;
    };
    FragmentTracker.prototype.isPartial = function (fragmentEntity) {
        return fragmentEntity.buffered === true &&
            ((fragmentEntity.range.video !== undefined && fragmentEntity.range.video.partial === true) ||
                (fragmentEntity.range.audio !== undefined && fragmentEntity.range.audio.partial === true));
    };
    FragmentTracker.prototype.isTimeBuffered = function (startPTS, endPTS, timeRange) {
        var startTime, endTime;
        for (var i = 0; i < timeRange.length; i++) {
            startTime = timeRange.start(i) - this.bufferPadding;
            endTime = timeRange.end(i) + this.bufferPadding;
            if (startPTS >= startTime && endPTS <= endTime) {
                return true;
            }
            if (endPTS <= startTime) {
                // No need to check the rest of the timeRange as it is in order
                return false;
            }
        }
        return false;
    };
    /**
     * Fires when a fragment loading is completed
     */
    FragmentTracker.prototype.onFragLoaded = function (e) {
        var fragment = e.frag;
        // don't track initsegment (for which sn is not a number)
        // don't track frags used for bitrateTest, they're irrelevant.
        if (Number.isFinite(fragment.sn) && !fragment.bitrateTest) {
            this.fragments[this.getFragmentKey(fragment)] = {
                body: fragment,
                range: Object.create(null),
                buffered: false
            };
        }
    };
    /**
     * Fires when the buffer is updated
     */
    FragmentTracker.prototype.onBufferAppended = function (e) {
        var _this = this;
        // Store the latest timeRanges loaded in the buffer
        this.timeRanges = e.timeRanges;
        Object.keys(this.timeRanges).forEach(function (elementaryStream) {
            var timeRange = _this.timeRanges[elementaryStream];
            _this.detectEvictedFragments(elementaryStream, timeRange);
        });
    };
    /**
     * Fires after a fragment has been loaded into the source buffer
     */
    FragmentTracker.prototype.onFragBuffered = function (e) {
        this.detectPartialFragments(e.frag);
    };
    /**
     * Return true if fragment tracker has the fragment.
     * @param {Object} fragment
     * @returns {boolean}
     */
    FragmentTracker.prototype.hasFragment = function (fragment) {
        var fragKey = this.getFragmentKey(fragment);
        return this.fragments[fragKey] !== undefined;
    };
    /**
     * Remove a fragment from fragment tracker until it is loaded again
     * @param {Object} fragment The fragment to remove
     */
    FragmentTracker.prototype.removeFragment = function (fragment) {
        var fragKey = this.getFragmentKey(fragment);
        delete this.fragments[fragKey];
    };
    /**
     * Remove all fragments from fragment tracker.
     */
    FragmentTracker.prototype.removeAllFragments = function () {
        this.fragments = Object.create(null);
    };
    return FragmentTracker;
}(event_handler_1.default));
exports.FragmentTracker = FragmentTracker;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/gap-controller.js":
/*!******************************************!*\
  !*** ./src/controller/gap-controller.js ***!
  \******************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var buffer_helper_1 = __webpack_require__(/*! ../utils/buffer-helper */ "./src/utils/buffer-helper.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var stallDebounceInterval = 1000;
var jumpThreshold = 0.5; // tolerance needed as some browsers stalls playback before reaching buffered range end
var GapController = /** @class */ (function () {
    function GapController(config, media, fragmentTracker, hls) {
        this.config = config;
        this.media = media;
        this.fragmentTracker = fragmentTracker;
        this.hls = hls;
        this.stallReported = false;
    }
    /**
     * Checks if the playhead is stuck within a gap, and if so, attempts to free it.
     * A gap is an unbuffered range between two buffered ranges (or the start and the first buffered range).
     * @param lastCurrentTime
     * @param buffered
     */
    GapController.prototype.poll = function (lastCurrentTime, buffered) {
        var _a = this, config = _a.config, media = _a.media;
        var currentTime = media.currentTime;
        var tnow = window.performance.now();
        if (currentTime !== lastCurrentTime) {
            // The playhead is now moving, but was previously stalled
            if (this.stallReported) {
                logger_1.logger.warn("playback not stuck anymore @" + currentTime + ", after " + Math.round(tnow - this.stalled) + "ms");
                this.stallReported = false;
            }
            this.stalled = null;
            this.nudgeRetry = 0;
            return;
        }
        if (media.ended || !media.buffered.length || media.readyState > 2) {
            return;
        }
        if (media.seeking && buffer_helper_1.BufferHelper.isBuffered(media, currentTime)) {
            return;
        }
        // The playhead isn't moving but it should be
        // Allow some slack time to for small stalls to resolve themselves
        var stalledDuration = tnow - this.stalled;
        var bufferInfo = buffer_helper_1.BufferHelper.bufferInfo(media, currentTime, config.maxBufferHole);
        if (!this.stalled) {
            this.stalled = tnow;
            return;
        }
        else if (stalledDuration >= stallDebounceInterval) {
            // Report stalling after trying to fix
            this._reportStall(bufferInfo.len);
        }
        this._tryFixBufferStall(bufferInfo, stalledDuration);
    };
    /**
     * Detects and attempts to fix known buffer stalling issues.
     * @param bufferInfo - The properties of the current buffer.
     * @param stalledDuration - The amount of time Hls.js has been stalling for.
     * @private
     */
    GapController.prototype._tryFixBufferStall = function (bufferInfo, stalledDuration) {
        var _a = this, config = _a.config, fragmentTracker = _a.fragmentTracker, media = _a.media;
        var currentTime = media.currentTime;
        var partial = fragmentTracker.getPartialFragment(currentTime);
        if (partial) {
            // Try to skip over the buffer hole caused by a partial fragment
            // This method isn't limited by the size of the gap between buffered ranges
            this._trySkipBufferHole(partial);
        }
        if (bufferInfo.len > jumpThreshold && stalledDuration > config.highBufferWatchdogPeriod * 1000) {
            // Try to nudge currentTime over a buffer hole if we've been stalling for the configured amount of seconds
            // We only try to jump the hole if it's under the configured size
            // Reset stalled so to rearm watchdog timer
            this.stalled = null;
            this._tryNudgeBuffer();
        }
    };
    /**
     * Triggers a BUFFER_STALLED_ERROR event, but only once per stall period.
     * @param bufferLen - The playhead distance from the end of the current buffer segment.
     * @private
     */
    GapController.prototype._reportStall = function (bufferLen) {
        var _a = this, hls = _a.hls, media = _a.media, stallReported = _a.stallReported;
        if (!stallReported) {
            // Report stalled error once
            this.stallReported = true;
            logger_1.logger.warn("Playback stalling at @" + media.currentTime + " due to low buffer");
            hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.MEDIA_ERROR,
                details: errors_1.ErrorDetails.BUFFER_STALLED_ERROR,
                fatal: false,
                buffer: bufferLen
            });
        }
    };
    /**
     * Attempts to fix buffer stalls by jumping over known gaps caused by partial fragments
     * @param partial - The partial fragment found at the current time (where playback is stalling).
     * @private
     */
    GapController.prototype._trySkipBufferHole = function (partial) {
        var _a = this, hls = _a.hls, media = _a.media;
        var currentTime = media.currentTime;
        var lastEndTime = 0;
        // Check if currentTime is between unbuffered regions of partial fragments
        for (var i = 0; i < media.buffered.length; i++) {
            var startTime = media.buffered.start(i);
            if (currentTime >= lastEndTime && currentTime < startTime) {
                media.currentTime = Math.max(startTime, media.currentTime + 0.1);
                logger_1.logger.warn("skipping hole, adjusting currentTime from " + currentTime + " to " + media.currentTime);
                this.stalled = null;
                hls.trigger(events_1.default.ERROR, {
                    type: errors_1.ErrorTypes.MEDIA_ERROR,
                    details: errors_1.ErrorDetails.BUFFER_SEEK_OVER_HOLE,
                    fatal: false,
                    reason: "fragment loaded with buffer holes, seeking from " + currentTime + " to " + media.currentTime,
                    frag: partial
                });
                return;
            }
            lastEndTime = media.buffered.end(i);
        }
    };
    /**
     * Attempts to fix buffer stalls by advancing the mediaElement's current time by a small amount.
     * @private
     */
    GapController.prototype._tryNudgeBuffer = function () {
        var _a = this, config = _a.config, hls = _a.hls, media = _a.media;
        var currentTime = media.currentTime;
        var nudgeRetry = (this.nudgeRetry || 0) + 1;
        this.nudgeRetry = nudgeRetry;
        if (nudgeRetry < config.nudgeMaxRetry) {
            var targetTime = currentTime + nudgeRetry * config.nudgeOffset;
            logger_1.logger.log("adjust currentTime from " + currentTime + " to " + targetTime);
            // playback stalled in buffered area ... let's nudge currentTime to try to overcome this
            media.currentTime = targetTime;
            hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.MEDIA_ERROR,
                details: errors_1.ErrorDetails.BUFFER_NUDGE_ON_STALL,
                fatal: false
            });
        }
        else {
            logger_1.logger.error("still stuck in high buffer @" + currentTime + " after " + config.nudgeMaxRetry + ", raise fatal error");
            hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.MEDIA_ERROR,
                details: errors_1.ErrorDetails.BUFFER_STALLED_ERROR,
                fatal: true
            });
        }
    };
    return GapController;
}());
exports.default = GapController;


/***/ }),

/***/ "./src/controller/id3-track-controller.js":
/*!************************************************!*\
  !*** ./src/controller/id3-track-controller.js ***!
  \************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * id3 metadata track controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var id3_1 = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.js");
var texttrack_utils_1 = __webpack_require__(/*! ../utils/texttrack-utils */ "./src/utils/texttrack-utils.js");
var ID3TrackController = /** @class */ (function (_super) {
    __extends(ID3TrackController, _super);
    function ID3TrackController(hls) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHED, events_1.default.MEDIA_DETACHING, events_1.default.FRAG_PARSING_METADATA) || this;
        _this.id3Track = undefined;
        _this.media = undefined;
        return _this;
    }
    ID3TrackController.prototype.destroy = function () {
        event_handler_1.default.prototype.destroy.call(this);
    };
    // Add ID3 metatadata text track.
    ID3TrackController.prototype.onMediaAttached = function (data) {
        this.media = data.media;
        if (!this.media) {
        }
    };
    ID3TrackController.prototype.onMediaDetaching = function () {
        texttrack_utils_1.clearCurrentCues(this.id3Track);
        this.id3Track = undefined;
        this.media = undefined;
    };
    ID3TrackController.prototype.getID3Track = function (textTracks) {
        for (var i = 0; i < textTracks.length; i++) {
            var textTrack = textTracks[i];
            if (textTrack.kind === 'metadata' && textTrack.label === 'id3') {
                // send 'addtrack' when reusing the textTrack for metadata,
                // same as what we do for captions
                texttrack_utils_1.sendAddTrackEvent(textTrack, this.media);
                return textTrack;
            }
        }
        return this.media.addTextTrack('metadata', 'id3');
    };
    ID3TrackController.prototype.onFragParsingMetadata = function (data) {
        var fragment = data.frag;
        var samples = data.samples;
        // create track dynamically
        if (!this.id3Track) {
            this.id3Track = this.getID3Track(this.media.textTracks);
            this.id3Track.mode = 'hidden';
        }
        // Attempt to recreate Safari functionality by creating
        // WebKitDataCue objects when available and store the decoded
        // ID3 data in the value property of the cue
        var Cue = window.WebKitDataCue || window.VTTCue || window.TextTrackCue;
        for (var i = 0; i < samples.length; i++) {
            var frames_1 = id3_1.default.getID3Frames(samples[i].data);
            if (frames_1) {
                var startTime = samples[i].pts;
                var endTime = i < samples.length - 1 ? samples[i + 1].pts : fragment.endPTS;
                // Give a slight bump to the endTime if it's equal to startTime to avoid a SyntaxError in IE
                if (startTime === endTime) {
                    endTime += 0.0001;
                }
                for (var j = 0; j < frames_1.length; j++) {
                    var frame = frames_1[j];
                    // Safari doesn't put the timestamp frame in the TextTrack
                    if (!id3_1.default.isTimeStampFrame(frame)) {
                        var cue = new Cue(startTime, endTime, '');
                        cue.value = frame;
                        this.id3Track.addCue(cue);
                    }
                }
            }
        }
    };
    return ID3TrackController;
}(event_handler_1.default));
exports.default = ID3TrackController;


/***/ }),

/***/ "./src/controller/level-controller.js":
/*!********************************************!*\
  !*** ./src/controller/level-controller.js ***!
  \********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * Level Controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var codecs_1 = __webpack_require__(/*! ../utils/codecs */ "./src/utils/codecs.js");
var level_helper_1 = __webpack_require__(/*! ./level-helper */ "./src/controller/level-helper.js");
var performance = window.performance;
var chromeOrFirefox;
var LevelController = /** @class */ (function (_super) {
    __extends(LevelController, _super);
    function LevelController(hls) {
        var _this = _super.call(this, hls, events_1.default.MANIFEST_LOADED, events_1.default.LEVEL_LOADED, events_1.default.AUDIO_TRACK_SWITCHED, events_1.default.FRAG_LOADED, events_1.default.ERROR) || this;
        _this.canload = false;
        _this.currentLevelIndex = null;
        _this.manualLevelIndex = -1;
        _this.timer = null;
        chromeOrFirefox = /chrome|firefox/.test(navigator.userAgent.toLowerCase());
        return _this;
    }
    LevelController.prototype.onHandlerDestroying = function () {
        this.clearTimer();
        this.manualLevelIndex = -1;
    };
    LevelController.prototype.clearTimer = function () {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    };
    LevelController.prototype.startLoad = function () {
        var levels = this._levels;
        this.canload = true;
        this.levelRetryCount = 0;
        // clean up live level details to force reload them, and reset load errors
        if (levels) {
            levels.forEach(function (level) {
                level.loadError = 0;
                var levelDetails = level.details;
                if (levelDetails && levelDetails.live) {
                    level.details = undefined;
                }
            });
        }
        // speed up live playlist refresh if timer exists
        if (this.timer !== null) {
            this.loadLevel();
        }
    };
    LevelController.prototype.stopLoad = function () {
        this.canload = false;
    };
    LevelController.prototype.onManifestLoaded = function (data) {
        var levels = [];
        var audioTracks = [];
        var bitrateStart;
        var levelSet = {};
        var levelFromSet = null;
        var videoCodecFound = false;
        var audioCodecFound = false;
        // regroup redundant levels together
        data.levels.forEach(function (level) {
            var attributes = level.attrs;
            level.loadError = 0;
            level.fragmentError = false;
            videoCodecFound = videoCodecFound || !!level.videoCodec;
            audioCodecFound = audioCodecFound || !!level.audioCodec;
            // erase audio codec info if browser does not support mp4a.40.34.
            // demuxer will autodetect codec and fallback to mpeg/audio
            if (chromeOrFirefox && level.audioCodec && level.audioCodec.indexOf('mp4a.40.34') !== -1) {
                level.audioCodec = undefined;
            }
            levelFromSet = levelSet[level.bitrate]; // FIXME: we would also have to match the resolution here
            if (!levelFromSet) {
                level.url = [level.url];
                level.urlId = 0;
                levelSet[level.bitrate] = level;
                levels.push(level);
            }
            else {
                levelFromSet.url.push(level.url);
            }
            if (attributes) {
                if (attributes.AUDIO) {
                    audioCodecFound = true;
                    level_helper_1.addGroupId(levelFromSet || level, 'audio', attributes.AUDIO);
                }
                if (attributes.SUBTITLES) {
                    level_helper_1.addGroupId(levelFromSet || level, 'text', attributes.SUBTITLES);
                }
            }
        });
        // remove audio-only level if we also have levels with audio+video codecs signalled
        if (videoCodecFound && audioCodecFound) {
            levels = levels.filter(function (_a) {
                var videoCodec = _a.videoCodec;
                return !!videoCodec;
            });
        }
        // only keep levels with supported audio/video codecs
        levels = levels.filter(function (_a) {
            var audioCodec = _a.audioCodec, videoCodec = _a.videoCodec;
            return (!audioCodec || codecs_1.isCodecSupportedInMp4(audioCodec)) && (!videoCodec || codecs_1.isCodecSupportedInMp4(videoCodec));
        });
        if (data.audioTracks) {
            audioTracks = data.audioTracks.filter(function (track) { return !track.audioCodec || codecs_1.isCodecSupportedInMp4(track.audioCodec, 'audio'); });
            // Reassign id's after filtering since they're used as array indices
            audioTracks.forEach(function (track, index) {
                track.id = index;
            });
        }
        if (levels.length > 0) {
            // start bitrate is the first bitrate of the manifest
            bitrateStart = levels[0].bitrate;
            // sort level on bitrate
            levels.sort(function (a, b) { return a.bitrate - b.bitrate; });
            this._levels = levels;
            // find index of first level in sorted levels
            for (var i = 0; i < levels.length; i++) {
                if (levels[i].bitrate === bitrateStart) {
                    this._firstLevel = i;
                    logger_1.logger.log("manifest loaded," + levels.length + " level(s) found, first bitrate:" + bitrateStart);
                    break;
                }
            }
            // Audio is only alternate if manifest include a URI along with the audio group tag
            this.hls.trigger(events_1.default.MANIFEST_PARSED, {
                levels: levels,
                audioTracks: audioTracks,
                firstLevel: this._firstLevel,
                stats: data.stats,
                audio: audioCodecFound,
                video: videoCodecFound,
                altAudio: audioTracks.some(function (t) { return !!t.url; })
            });
        }
        else {
            this.hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.MEDIA_ERROR,
                details: errors_1.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
                fatal: true,
                url: this.hls.url,
                reason: 'no level with compatible codecs found in manifest'
            });
        }
    };
    Object.defineProperty(LevelController.prototype, "levels", {
        get: function () {
            return this._levels;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LevelController.prototype, "level", {
        get: function () {
            return this.currentLevelIndex;
        },
        set: function (newLevel) {
            var levels = this._levels;
            if (levels) {
                newLevel = Math.min(newLevel, levels.length - 1);
                if (this.currentLevelIndex !== newLevel || !levels[newLevel].details) {
                    this.setLevelInternal(newLevel);
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    LevelController.prototype.setLevelInternal = function (newLevel) {
        var levels = this._levels;
        var hls = this.hls;
        // check if level idx is valid
        if (newLevel >= 0 && newLevel < levels.length) {
            // stopping live reloading timer if any
            this.clearTimer();
            if (this.currentLevelIndex !== newLevel) {
                logger_1.logger.log("switching to level " + newLevel);
                this.currentLevelIndex = newLevel;
                var levelProperties = levels[newLevel];
                levelProperties.level = newLevel;
                hls.trigger(events_1.default.LEVEL_SWITCHING, levelProperties);
            }
            var level = levels[newLevel];
            var levelDetails = level.details;
            // check if we need to load playlist for this level
            if (!levelDetails || levelDetails.live) {
                // level not retrieved yet, or live playlist we need to (re)load it
                var urlId = level.urlId;
                hls.trigger(events_1.default.LEVEL_LOADING, { url: level.url[urlId], level: newLevel, id: urlId });
            }
        }
        else {
            // invalid level id given, trigger error
            hls.trigger(events_1.default.ERROR, {
                type: errors_1.ErrorTypes.OTHER_ERROR,
                details: errors_1.ErrorDetails.LEVEL_SWITCH_ERROR,
                level: newLevel,
                fatal: false,
                reason: 'invalid level idx'
            });
        }
    };
    Object.defineProperty(LevelController.prototype, "manualLevel", {
        get: function () {
            return this.manualLevelIndex;
        },
        set: function (newLevel) {
            this.manualLevelIndex = newLevel;
            if (this._startLevel === undefined) {
                this._startLevel = newLevel;
            }
            if (newLevel !== -1) {
                this.level = newLevel;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LevelController.prototype, "firstLevel", {
        get: function () {
            return this._firstLevel;
        },
        set: function (newLevel) {
            this._firstLevel = newLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(LevelController.prototype, "startLevel", {
        get: function () {
            // hls.startLevel takes precedence over config.startLevel
            // if none of these values are defined, fallback on this._firstLevel (first quality level appearing in variant manifest)
            if (this._startLevel === undefined) {
                var configStartLevel = this.hls.config.startLevel;
                if (configStartLevel !== undefined) {
                    return configStartLevel;
                }
                else {
                    return this._firstLevel;
                }
            }
            else {
                return this._startLevel;
            }
        },
        set: function (newLevel) {
            this._startLevel = newLevel;
        },
        enumerable: true,
        configurable: true
    });
    LevelController.prototype.onError = function (data) {
        if (data.fatal) {
            if (data.type === errors_1.ErrorTypes.NETWORK_ERROR) {
                this.clearTimer();
            }
            return;
        }
        var levelError = false, fragmentError = false;
        var levelIndex;
        // try to recover not fatal errors
        switch (data.details) {
            case errors_1.ErrorDetails.FRAG_LOAD_ERROR:
            case errors_1.ErrorDetails.FRAG_LOAD_TIMEOUT:
            case errors_1.ErrorDetails.KEY_LOAD_ERROR:
            case errors_1.ErrorDetails.KEY_LOAD_TIMEOUT:
                levelIndex = data.frag.level;
                fragmentError = true;
                break;
            case errors_1.ErrorDetails.LEVEL_LOAD_ERROR:
            case errors_1.ErrorDetails.LEVEL_LOAD_TIMEOUT:
                levelIndex = data.context.level;
                levelError = true;
                break;
            case errors_1.ErrorDetails.REMUX_ALLOC_ERROR:
                levelIndex = data.level;
                levelError = true;
                break;
        }
        if (levelIndex !== undefined) {
            this.recoverLevel(data, levelIndex, levelError, fragmentError);
        }
    };
    /**
     * Switch to a redundant stream if any available.
     * If redundant stream is not available, emergency switch down if ABR mode is enabled.
     *
     * @param {Object} errorEvent
     * @param {Number} levelIndex current level index
     * @param {Boolean} levelError
     * @param {Boolean} fragmentError
     */
    // FIXME Find a better abstraction where fragment/level retry management is well decoupled
    LevelController.prototype.recoverLevel = function (errorEvent, levelIndex, levelError, fragmentError) {
        var _this = this;
        var config = this.hls.config;
        var errorDetails = errorEvent.details;
        var level = this._levels[levelIndex];
        var redundantLevels, delay, nextLevel;
        level.loadError++;
        level.fragmentError = fragmentError;
        if (levelError) {
            if ((this.levelRetryCount + 1) <= config.levelLoadingMaxRetry) {
                // exponential backoff capped to max retry timeout
                delay = Math.min(Math.pow(2, this.levelRetryCount) * config.levelLoadingRetryDelay, config.levelLoadingMaxRetryTimeout);
                // Schedule level reload
                this.timer = setTimeout(function () { return _this.loadLevel(); }, delay);
                // boolean used to inform stream controller not to switch back to IDLE on non fatal error
                errorEvent.levelRetry = true;
                this.levelRetryCount++;
                logger_1.logger.warn("level controller, " + errorDetails + ", retry in " + delay + " ms, current retry count is " + this.levelRetryCount);
            }
            else {
                logger_1.logger.error("level controller, cannot recover from " + errorDetails + " error");
                this.currentLevelIndex = null;
                // stopping live reloading timer if any
                this.clearTimer();
                // switch error to fatal
                errorEvent.fatal = true;
                return;
            }
        }
        // Try any redundant streams if available for both errors: level and fragment
        // If level.loadError reaches redundantLevels it means that we tried them all, no hope  => let's switch down
        if (levelError || fragmentError) {
            redundantLevels = level.url.length;
            if (redundantLevels > 1 && level.loadError < redundantLevels) {
                level.urlId = (level.urlId + 1) % redundantLevels;
                level.details = undefined;
                logger_1.logger.warn("level controller, " + errorDetails + " for level " + levelIndex + ": switching to redundant URL-id " + level.urlId);
                // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
                // console.log('New video quality level audio group id:', level.attrs.AUDIO);
            }
            else {
                // Search for available level
                if (this.manualLevelIndex === -1) {
                    // When lowest level has been reached, let's start hunt from the top
                    nextLevel = (levelIndex === 0) ? this._levels.length - 1 : levelIndex - 1;
                    logger_1.logger.warn("level controller, " + errorDetails + ": switch to " + nextLevel);
                    this.hls.nextAutoLevel = this.currentLevelIndex = nextLevel;
                }
                else if (fragmentError) {
                    // Allow fragment retry as long as configuration allows.
                    // reset this._level so that another call to set level() will trigger again a frag load
                    logger_1.logger.warn("level controller, " + errorDetails + ": reload a fragment");
                    this.currentLevelIndex = null;
                }
            }
        }
    };
    // reset errors on the successful load of a fragment
    LevelController.prototype.onFragLoaded = function (_a) {
        var frag = _a.frag;
        if (frag !== undefined && frag.type === 'main') {
            var level = this._levels[frag.level];
            if (level !== undefined) {
                level.fragmentError = false;
                level.loadError = 0;
                this.levelRetryCount = 0;
            }
        }
    };
    LevelController.prototype.onLevelLoaded = function (data) {
        var _this = this;
        var levelId = data.level;
        // only process level loaded events matching with expected level
        if (levelId !== this.currentLevelIndex) {
            return;
        }
        var curLevel = this._levels[levelId];
        // reset level load error counter on successful level loaded only if there is no issues with fragments
        if (!curLevel.fragmentError) {
            curLevel.loadError = 0;
            this.levelRetryCount = 0;
        }
        var newDetails = data.details;
        // if current playlist is a live playlist, arm a timer to reload it
        if (newDetails.live) {
            var targetdurationMs = 1000 * (newDetails.averagetargetduration ? newDetails.averagetargetduration : newDetails.targetduration);
            var reloadInterval = targetdurationMs, curDetails = curLevel.details;
            if (curDetails && newDetails.endSN === curDetails.endSN) {
                // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
                // changed then it MUST wait for a period of one-half the target
                // duration before retrying.
                reloadInterval /= 2;
                logger_1.logger.log('same live playlist, reload twice faster');
            }
            // decrement reloadInterval with level loading delay
            reloadInterval -= performance.now() - data.stats.trequest;
            // in any case, don't reload more than half of target duration
            reloadInterval = Math.max(targetdurationMs / 2, Math.round(reloadInterval));
            logger_1.logger.log("live playlist, reload in " + Math.round(reloadInterval) + " ms");
            this.timer = setTimeout(function () { return _this.loadLevel(); }, reloadInterval);
        }
        else {
            this.clearTimer();
        }
    };
    LevelController.prototype.onAudioTrackSwitched = function (data) {
        var audioGroupId = this.hls.audioTracks[data.id].groupId;
        var currentLevel = this.hls.levels[this.currentLevelIndex];
        if (!currentLevel) {
            return;
        }
        if (currentLevel.audioGroupIds) {
            var urlId = currentLevel.audioGroupIds.findIndex(function (groupId) { return groupId === audioGroupId; });
            if (urlId !== currentLevel.urlId) {
                currentLevel.urlId = urlId;
                this.startLoad();
            }
        }
    };
    LevelController.prototype.loadLevel = function () {
        logger_1.logger.debug('call to loadLevel');
        if (this.currentLevelIndex !== null && this.canload) {
            var levelObject = this._levels[this.currentLevelIndex];
            if (typeof levelObject === 'object' &&
                levelObject.url.length > 0) {
                var level = this.currentLevelIndex;
                var id = levelObject.urlId;
                var url = levelObject.url[id];
                logger_1.logger.log("Attempt loading level index " + level + " with URL-id " + id);
                // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
                // console.log('New video quality level audio group id:', levelObject.attrs.AUDIO, level);
                this.hls.trigger(events_1.default.LEVEL_LOADING, { url: url, level: level, id: id });
            }
        }
    };
    Object.defineProperty(LevelController.prototype, "nextLoadLevel", {
        get: function () {
            if (this.manualLevelIndex !== -1) {
                return this.manualLevelIndex;
            }
            else {
                return this.hls.nextAutoLevel;
            }
        },
        set: function (nextLevel) {
            this.level = nextLevel;
            if (this.manualLevelIndex === -1) {
                this.hls.nextAutoLevel = nextLevel;
            }
        },
        enumerable: true,
        configurable: true
    });
    return LevelController;
}(event_handler_1.default));
exports.default = LevelController;


/***/ }),

/***/ "./src/controller/level-helper.js":
/*!****************************************!*\
  !*** ./src/controller/level-helper.js ***!
  \****************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/**
 * @module LevelHelper
 *
 * Providing methods dealing with playlist sliding and drift
 *
 * TODO: Create an actual `Level` class/model that deals with all this logic in an object-oriented-manner.
 *
 * */
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
function addGroupId(level, type, id) {
    switch (type) {
        case 'audio':
            if (!level.audioGroupIds) {
                level.audioGroupIds = [];
            }
            level.audioGroupIds.push(id);
            break;
        case 'text':
            if (!level.textGroupIds) {
                level.textGroupIds = [];
            }
            level.textGroupIds.push(id);
            break;
    }
}
exports.addGroupId = addGroupId;
function updatePTS(fragments, fromIdx, toIdx) {
    var fragFrom = fragments[fromIdx], fragTo = fragments[toIdx], fragToPTS = fragTo.startPTS;
    // if we know startPTS[toIdx]
    if (Number.isFinite(fragToPTS)) {
        // update fragment duration.
        // it helps to fix drifts between playlist reported duration and fragment real duration
        if (toIdx > fromIdx) {
            fragFrom.duration = fragToPTS - fragFrom.start;
            if (fragFrom.duration < 0) {
                logger_1.logger.warn("negative duration computed for frag " + fragFrom.sn + ",level " + fragFrom.level + ", there should be some duration drift between playlist and fragment!");
            }
        }
        else {
            fragTo.duration = fragFrom.start - fragToPTS;
            if (fragTo.duration < 0) {
                logger_1.logger.warn("negative duration computed for frag " + fragTo.sn + ",level " + fragTo.level + ", there should be some duration drift between playlist and fragment!");
            }
        }
    }
    else {
        // we dont know startPTS[toIdx]
        if (toIdx > fromIdx) {
            fragTo.start = fragFrom.start + fragFrom.duration;
        }
        else {
            fragTo.start = Math.max(fragFrom.start - fragTo.duration, 0);
        }
    }
}
exports.updatePTS = updatePTS;
function updateFragPTSDTS(details, frag, startPTS, endPTS, startDTS, endDTS) {
    // update frag PTS/DTS
    var maxStartPTS = startPTS;
    if (Number.isFinite(frag.startPTS)) {
        // delta PTS between audio and video
        var deltaPTS = Math.abs(frag.startPTS - startPTS);
        if (!Number.isFinite(frag.deltaPTS)) {
            frag.deltaPTS = deltaPTS;
        }
        else {
            frag.deltaPTS = Math.max(deltaPTS, frag.deltaPTS);
        }
        maxStartPTS = Math.max(startPTS, frag.startPTS);
        startPTS = Math.min(startPTS, frag.startPTS);
        endPTS = Math.max(endPTS, frag.endPTS);
        startDTS = Math.min(startDTS, frag.startDTS);
        endDTS = Math.max(endDTS, frag.endDTS);
    }
    var drift = startPTS - frag.start;
    frag.start = frag.startPTS = startPTS;
    frag.maxStartPTS = maxStartPTS;
    frag.endPTS = endPTS;
    frag.startDTS = startDTS;
    frag.endDTS = endDTS;
    frag.duration = endPTS - startPTS;
    var sn = frag.sn;
    // exit if sn out of range
    if (!details || sn < details.startSN || sn > details.endSN) {
        return 0;
    }
    var fragIdx, fragments, i;
    fragIdx = sn - details.startSN;
    fragments = details.fragments;
    // update frag reference in fragments array
    // rationale is that fragments array might not contain this frag object.
    // this will happen if playlist has been refreshed between frag loading and call to updateFragPTSDTS()
    // if we don't update frag, we won't be able to propagate PTS info on the playlist
    // resulting in invalid sliding computation
    fragments[fragIdx] = frag;
    // adjust fragment PTS/duration from seqnum-1 to frag 0
    for (i = fragIdx; i > 0; i--) {
        updatePTS(fragments, i, i - 1);
    }
    // adjust fragment PTS/duration from seqnum to last frag
    for (i = fragIdx; i < fragments.length - 1; i++) {
        updatePTS(fragments, i, i + 1);
    }
    details.PTSKnown = true;
    return drift;
}
exports.updateFragPTSDTS = updateFragPTSDTS;
function mergeDetails(oldDetails, newDetails) {
    var start = Math.max(oldDetails.startSN, newDetails.startSN) - newDetails.startSN, end = Math.min(oldDetails.endSN, newDetails.endSN) - newDetails.startSN, delta = newDetails.startSN - oldDetails.startSN, oldfragments = oldDetails.fragments, newfragments = newDetails.fragments, ccOffset = 0, PTSFrag;
    // potentially retrieve cached initsegment
    if (newDetails.initSegment && oldDetails.initSegment) {
        newDetails.initSegment = oldDetails.initSegment;
    }
    // check if old/new playlists have fragments in common
    if (end < start) {
        newDetails.PTSKnown = false;
        return;
    }
    // loop through overlapping SN and update startPTS , cc, and duration if any found
    for (var i = start; i <= end; i++) {
        var oldFrag = oldfragments[delta + i], newFrag = newfragments[i];
        if (newFrag && oldFrag) {
            ccOffset = oldFrag.cc - newFrag.cc;
            if (Number.isFinite(oldFrag.startPTS)) {
                newFrag.start = newFrag.startPTS = oldFrag.startPTS;
                newFrag.endPTS = oldFrag.endPTS;
                newFrag.duration = oldFrag.duration;
                newFrag.backtracked = oldFrag.backtracked;
                newFrag.dropped = oldFrag.dropped;
                PTSFrag = newFrag;
            }
        }
    }
    if (ccOffset) {
        logger_1.logger.log('discontinuity sliding from playlist, take drift into account');
        for (i = 0; i < newfragments.length; i++) {
            newfragments[i].cc += ccOffset;
        }
    }
    // if at least one fragment contains PTS info, recompute PTS information for all fragments
    if (PTSFrag) {
        updateFragPTSDTS(newDetails, PTSFrag, PTSFrag.startPTS, PTSFrag.endPTS, PTSFrag.startDTS, PTSFrag.endDTS);
    }
    else {
        // ensure that delta is within oldfragments range
        // also adjust sliding in case delta is 0 (we could have old=[50-60] and new=old=[50-61])
        // in that case we also need to adjust start offset of all fragments
        if (delta >= 0 && delta < oldfragments.length) {
            // adjust start by sliding offset
            var sliding = oldfragments[delta].start;
            for (i = 0; i < newfragments.length; i++) {
                newfragments[i].start += sliding;
            }
        }
    }
    // if we are here, it means we have fragments overlapping between
    // old and new level. reliable PTS info is thus relying on old level
    newDetails.PTSKnown = oldDetails.PTSKnown;
}
exports.mergeDetails = mergeDetails;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/stream-controller.js":
/*!*********************************************!*\
  !*** ./src/controller/stream-controller.js ***!
  \*********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/*
 * Stream Controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var binary_search_1 = __webpack_require__(/*! ../utils/binary-search */ "./src/utils/binary-search.js");
var buffer_helper_1 = __webpack_require__(/*! ../utils/buffer-helper */ "./src/utils/buffer-helper.js");
var demuxer_1 = __webpack_require__(/*! ../demux/demuxer */ "./src/demux/demuxer.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var fragment_tracker_1 = __webpack_require__(/*! ./fragment-tracker */ "./src/controller/fragment-tracker.js");
var fragment_1 = __webpack_require__(/*! ../loader/fragment */ "./src/loader/fragment.js");
var playlist_loader_1 = __webpack_require__(/*! ../loader/playlist-loader */ "./src/loader/playlist-loader.js");
var LevelHelper = __webpack_require__(/*! ./level-helper */ "./src/controller/level-helper.js");
var time_ranges_1 = __webpack_require__(/*! ../utils/time-ranges */ "./src/utils/time-ranges.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var discontinuities_1 = __webpack_require__(/*! ../utils/discontinuities */ "./src/utils/discontinuities.js");
var fragment_finders_1 = __webpack_require__(/*! ./fragment-finders */ "./src/controller/fragment-finders.js");
var gap_controller_1 = __webpack_require__(/*! ./gap-controller */ "./src/controller/gap-controller.js");
var base_stream_controller_1 = __webpack_require__(/*! ./base-stream-controller */ "./src/controller/base-stream-controller.js");
var TICK_INTERVAL = 100; // how often to tick in ms
var StreamController = /** @class */ (function (_super) {
    __extends(StreamController, _super);
    function StreamController(hls, fragmentTracker) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHED, events_1.default.MEDIA_DETACHING, events_1.default.MANIFEST_LOADING, events_1.default.MANIFEST_PARSED, events_1.default.LEVEL_LOADED, events_1.default.KEY_LOADED, events_1.default.FRAG_LOADED, events_1.default.FRAG_LOAD_EMERGENCY_ABORTED, events_1.default.FRAG_PARSING_INIT_SEGMENT, events_1.default.FRAG_PARSING_DATA, events_1.default.FRAG_PARSED, events_1.default.ERROR, events_1.default.AUDIO_TRACK_SWITCHING, events_1.default.AUDIO_TRACK_SWITCHED, events_1.default.BUFFER_CREATED, events_1.default.BUFFER_APPENDED, events_1.default.BUFFER_FLUSHED) || this;
        _this.fragmentTracker = fragmentTracker;
        _this.config = hls.config;
        _this.audioCodecSwap = false;
        _this._state = base_stream_controller_1.State.STOPPED;
        _this.stallReported = false;
        _this.gapController = null;
        return _this;
    }
    StreamController.prototype.onHandlerDestroying = function () {
        this.stopLoad();
        _super.prototype.onHandlerDestroying.call(this);
    };
    StreamController.prototype.onHandlerDestroyed = function () {
        this.state = base_stream_controller_1.State.STOPPED;
        this.fragmentTracker = null;
        _super.prototype.onHandlerDestroyed.call(this);
    };
    StreamController.prototype.startLoad = function (startPosition) {
        if (this.levels) {
            var lastCurrentTime = this.lastCurrentTime, hls_1 = this.hls;
            this.stopLoad();
            this.setInterval(TICK_INTERVAL);
            this.level = -1;
            this.fragLoadError = 0;
            if (!this.startFragRequested) {
                // determine load level
                var startLevel = hls_1.startLevel;
                if (startLevel === -1) {
                    // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
                    startLevel = 0;
                    this.bitrateTest = true;
                }
                // set new level to playlist loader : this will trigger start level load
                // hls.nextLoadLevel remains until it is set to a new value or until a new frag is successfully loaded
                this.level = hls_1.nextLoadLevel = startLevel;
                this.loadedmetadata = false;
            }
            // if startPosition undefined but lastCurrentTime set, set startPosition to last currentTime
            if (lastCurrentTime > 0 && startPosition === -1) {
                logger_1.logger.log("override startPosition with lastCurrentTime @" + lastCurrentTime.toFixed(3));
                startPosition = lastCurrentTime;
            }
            this.state = base_stream_controller_1.State.IDLE;
            this.nextLoadPosition = this.startPosition = this.lastCurrentTime = startPosition;
            this.tick();
        }
        else {
            this.forceStartLoad = true;
            this.state = base_stream_controller_1.State.STOPPED;
        }
    };
    StreamController.prototype.stopLoad = function () {
        var frag = this.fragCurrent;
        if (frag) {
            if (frag.loader) {
                frag.loader.abort();
            }
            this.fragmentTracker.removeFragment(frag);
            this.fragCurrent = null;
        }
        this.fragPrevious = null;
        if (this.demuxer) {
            this.demuxer.destroy();
            this.demuxer = null;
        }
        this.clearInterval();
        this.state = base_stream_controller_1.State.STOPPED;
        this.forceStartLoad = false;
    };
    StreamController.prototype.doTick = function () {
        switch (this.state) {
            case base_stream_controller_1.State.BUFFER_FLUSHING:
                // in buffer flushing state, reset fragLoadError counter
                this.fragLoadError = 0;
                break;
            case base_stream_controller_1.State.IDLE:
                this._doTickIdle();
                break;
            case base_stream_controller_1.State.WAITING_LEVEL:
                var level = this.levels[this.level];
                // check if playlist is already loaded
                if (level && level.details) {
                    this.state = base_stream_controller_1.State.IDLE;
                }
                break;
            case base_stream_controller_1.State.FRAG_LOADING_WAITING_RETRY:
                var now = window.performance.now();
                var retryDate = this.retryDate;
                // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
                if (!retryDate || (now >= retryDate) || (this.media && this.media.seeking)) {
                    logger_1.logger.log('mediaController: retryDate reached, switch back to IDLE state');
                    this.state = base_stream_controller_1.State.IDLE;
                }
                break;
            case base_stream_controller_1.State.ERROR:
            case base_stream_controller_1.State.STOPPED:
            case base_stream_controller_1.State.FRAG_LOADING:
            case base_stream_controller_1.State.PARSING:
            case base_stream_controller_1.State.PARSED:
            case base_stream_controller_1.State.ENDED:
                break;
            default:
                break;
        }
        // check buffer
        this._checkBuffer();
        // check/update current fragment
        this._checkFragmentChanged();
    };
    // Ironically the "idle" state is the on we do the most logic in it seems ....
    // NOTE: Maybe we could rather schedule a check for buffer length after half of the currently
    //       played segment, or on pause/play/seek instead of naively checking every 100ms?
    StreamController.prototype._doTickIdle = function () {
        var hls = this.hls, config = hls.config, media = this.media;
        // if start level not parsed yet OR
        // if video not attached AND start fragment already requested OR start frag prefetch disable
        // exit loop, as we either need more info (level not parsed) or we need media to be attached to load new fragment
        if (this.levelLastLoaded === undefined || (!media && (this.startFragRequested || !config.startFragPrefetch))) {
            return;
        }
        // if we have not yet loaded any fragment, start loading from start position
        var pos;
        if (this.loadedmetadata) {
            pos = media.currentTime;
        }
        else {
            pos = this.nextLoadPosition;
        }
        // determine next load level
        var level = hls.nextLoadLevel, levelInfo = this.levels[level];
        if (!levelInfo) {
            return;
        }
        var levelBitrate = levelInfo.bitrate, maxBufLen;
        // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
        if (levelBitrate) {
            maxBufLen = Math.max(8 * config.maxBufferSize / levelBitrate, config.maxBufferLength);
        }
        else {
            maxBufLen = config.maxBufferLength;
        }
        maxBufLen = Math.min(maxBufLen, config.maxMaxBufferLength);
        // determine next candidate fragment to be loaded, based on current position and end of buffer position
        // ensure up to `config.maxMaxBufferLength` of buffer upfront
        var bufferInfo = buffer_helper_1.BufferHelper.bufferInfo(this.mediaBuffer ? this.mediaBuffer : media, pos, config.maxBufferHole), bufferLen = bufferInfo.len;
        // Stay idle if we are still with buffer margins
        if (bufferLen >= maxBufLen) {
            return;
        }
        // if buffer length is less than maxBufLen try to load a new fragment ...
        logger_1.logger.trace("buffer length of " + bufferLen.toFixed(3) + " is below max of " + maxBufLen.toFixed(3) + ". checking for more payload ...");
        // set next load level : this will trigger a playlist load if needed
        this.level = hls.nextLoadLevel = level;
        var levelDetails = levelInfo.details;
        // if level info not retrieved yet, switch state and wait for level retrieval
        // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
        // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
        if (!levelDetails || (levelDetails.live && this.levelLastLoaded !== level)) {
            this.state = base_stream_controller_1.State.WAITING_LEVEL;
            return;
        }
        if (this._streamEnded(bufferInfo, levelDetails)) {
            var data = {};
            if (this.altAudio) {
                data.type = 'video';
            }
            this.hls.trigger(events_1.default.BUFFER_EOS, data);
            this.state = base_stream_controller_1.State.ENDED;
            return;
        }
        // if we have the levelDetails for the selected variant, lets continue enrichen our stream (load keys/fragments or trigger EOS, etc..)
        this._fetchPayloadOrEos(pos, bufferInfo, levelDetails);
    };
    StreamController.prototype._fetchPayloadOrEos = function (pos, bufferInfo, levelDetails) {
        var fragPrevious = this.fragPrevious, level = this.level, fragments = levelDetails.fragments, fragLen = fragments.length;
        // empty playlist
        if (fragLen === 0) {
            return;
        }
        // find fragment index, contiguous with end of buffer position
        var start = fragments[0].start, end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration, bufferEnd = bufferInfo.end, frag;
        if (levelDetails.initSegment && !levelDetails.initSegment.data) {
            frag = levelDetails.initSegment;
        }
        else {
            // in case of live playlist we need to ensure that requested position is not located before playlist start
            if (levelDetails.live) {
                var initialLiveManifestSize = this.config.initialLiveManifestSize;
                if (fragLen < initialLiveManifestSize) {
                    logger_1.logger.warn("Can not start playback of a level, reason: not enough fragments " + fragLen + " < " + initialLiveManifestSize);
                    return;
                }
                frag = this._ensureFragmentAtLivePoint(levelDetails, bufferEnd, start, end, fragPrevious, fragments, fragLen);
                // if it explicitely returns null don't load any fragment and exit function now
                if (frag === null) {
                    return;
                }
            }
            else {
                // VoD playlist: if bufferEnd before start of playlist, load first fragment
                if (bufferEnd < start) {
                    frag = fragments[0];
                }
            }
        }
        if (!frag) {
            frag = this._findFragment(start, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails);
        }
        if (frag) {
            if (frag.encrypted) {
                logger_1.logger.log("Loading key for " + frag.sn + " of [" + levelDetails.startSN + " ," + levelDetails.endSN + "],level " + level);
                this._loadKey(frag);
            }
            else {
                logger_1.logger.log("Loading " + frag.sn + " of [" + levelDetails.startSN + " ," + levelDetails.endSN + "],level " + level + ", currentTime:" + pos.toFixed(3) + ",bufferEnd:" + bufferEnd.toFixed(3));
                this._loadFragment(frag);
            }
        }
    };
    StreamController.prototype._ensureFragmentAtLivePoint = function (levelDetails, bufferEnd, start, end, fragPrevious, fragments, fragLen) {
        var config = this.hls.config, media = this.media;
        var frag;
        // check if requested position is within seekable boundaries :
        // logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.media.seeking}`);
        var maxLatency = config.liveMaxLatencyDuration !== undefined ? config.liveMaxLatencyDuration : config.liveMaxLatencyDurationCount * levelDetails.targetduration;
        if (bufferEnd < Math.max(start - config.maxFragLookUpTolerance, end - maxLatency)) {
            var liveSyncPosition = this.liveSyncPosition = this.computeLivePosition(start, levelDetails);
            logger_1.logger.log("buffer end: " + bufferEnd.toFixed(3) + " is located too far from the end of live sliding playlist, reset currentTime to : " + liveSyncPosition.toFixed(3));
            bufferEnd = liveSyncPosition;
            if (media && media.readyState && media.duration > liveSyncPosition) {
                media.currentTime = liveSyncPosition;
            }
            this.nextLoadPosition = liveSyncPosition;
        }
        // if end of buffer greater than live edge, don't load any fragment
        // this could happen if live playlist intermittently slides in the past.
        // level 1 loaded [182580161,182580167]
        // level 1 loaded [182580162,182580169]
        // Loading 182580168 of [182580162 ,182580169],level 1 ..
        // Loading 182580169 of [182580162 ,182580169],level 1 ..
        // level 1 loaded [182580162,182580168] <============= here we should have bufferEnd > end. in that case break to avoid reloading 182580168
        // level 1 loaded [182580164,182580171]
        //
        // don't return null in case media not loaded yet (readystate === 0)
        if (levelDetails.PTSKnown && bufferEnd > end && media && media.readyState) {
            return null;
        }
        if (this.startFragRequested && !levelDetails.PTSKnown) {
            /* we are switching level on live playlist, but we don't have any PTS info for that quality level ...
               try to load frag matching with next SN.
               even if SN are not synchronized between playlists, loading this frag will help us
               compute playlist sliding and find the right one after in case it was not the right consecutive one */
            if (fragPrevious) {
                if (levelDetails.hasProgramDateTime) {
                    // Relies on PDT in order to switch bitrates (Support EXT-X-DISCONTINUITY without EXT-X-DISCONTINUITY-SEQUENCE)
                    logger_1.logger.log("live playlist, switching playlist, load frag with same PDT: " + fragPrevious.programDateTime);
                    frag = fragment_finders_1.findFragmentByPDT(fragments, fragPrevious.endProgramDateTime, config.maxFragLookUpTolerance);
                }
                else {
                    // Uses buffer and sequence number to calculate switch segment (required if using EXT-X-DISCONTINUITY-SEQUENCE)
                    var targetSN = fragPrevious.sn + 1;
                    if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
                        var fragNext = fragments[targetSN - levelDetails.startSN];
                        if (fragPrevious.cc === fragNext.cc) {
                            frag = fragNext;
                            logger_1.logger.log("live playlist, switching playlist, load frag with next SN: " + frag.sn);
                        }
                    }
                    // next frag SN not available (or not with same continuity counter)
                    // look for a frag sharing the same CC
                    if (!frag) {
                        frag = binary_search_1.default.search(fragments, function (frag) {
                            return fragPrevious.cc - frag.cc;
                        });
                        if (frag) {
                            logger_1.logger.log("live playlist, switching playlist, load frag with same CC: " + frag.sn);
                        }
                    }
                }
            }
            if (!frag) {
                /* we have no idea about which fragment should be loaded.
                   so let's load mid fragment. it will help computing playlist sliding and find the right one
                */
                frag = fragments[Math.min(fragLen - 1, Math.round(fragLen / 2))];
                logger_1.logger.log("live playlist, switching playlist, unknown, load middle frag : " + frag.sn);
            }
        }
        return frag;
    };
    StreamController.prototype._findFragment = function (start, fragPrevious, fragLen, fragments, bufferEnd, end, levelDetails) {
        var config = this.hls.config;
        var frag;
        if (bufferEnd < end) {
            var lookupTolerance = (bufferEnd > end - config.maxFragLookUpTolerance) ? 0 : config.maxFragLookUpTolerance;
            // Remove the tolerance if it would put the bufferEnd past the actual end of stream
            // Uses buffer and sequence number to calculate switch segment (required if using EXT-X-DISCONTINUITY-SEQUENCE)
            frag = fragment_finders_1.findFragmentByPTS(fragPrevious, fragments, bufferEnd, lookupTolerance);
        }
        else {
            // reach end of playlist
            frag = fragments[fragLen - 1];
        }
        if (frag) {
            var curSNIdx = frag.sn - levelDetails.startSN;
            var sameLevel = fragPrevious && frag.level === fragPrevious.level;
            var prevFrag = fragments[curSNIdx - 1];
            var nextFrag = fragments[curSNIdx + 1];
            // logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
            if (fragPrevious && frag.sn === fragPrevious.sn) {
                if (sameLevel && !frag.backtracked) {
                    if (frag.sn < levelDetails.endSN) {
                        var deltaPTS = fragPrevious.deltaPTS;
                        // if there is a significant delta between audio and video, larger than max allowed hole,
                        // and if previous remuxed fragment did not start with a keyframe. (fragPrevious.dropped)
                        // let's try to load previous fragment again to get last keyframe
                        // then we will reload again current fragment (that way we should be able to fill the buffer hole ...)
                        if (deltaPTS && deltaPTS > config.maxBufferHole && fragPrevious.dropped && curSNIdx) {
                            frag = prevFrag;
                            logger_1.logger.warn('SN just loaded, with large PTS gap between audio and video, maybe frag is not starting with a keyframe ? load previous one to try to overcome this');
                        }
                        else {
                            frag = nextFrag;
                            logger_1.logger.log("SN just loaded, load next one: " + frag.sn, frag);
                        }
                    }
                    else {
                        frag = null;
                    }
                }
                else if (frag.backtracked) {
                    // Only backtrack a max of 1 consecutive fragment to prevent sliding back too far when little or no frags start with keyframes
                    if (nextFrag && nextFrag.backtracked) {
                        logger_1.logger.warn("Already backtracked from fragment " + nextFrag.sn + ", will not backtrack to fragment " + frag.sn + ". Loading fragment " + nextFrag.sn);
                        frag = nextFrag;
                    }
                    else {
                        // If a fragment has dropped frames and it's in a same level/sequence, load the previous fragment to try and find the keyframe
                        // Reset the dropped count now since it won't be reset until we parse the fragment again, which prevents infinite backtracking on the same segment
                        logger_1.logger.warn('Loaded fragment with dropped frames, backtracking 1 segment to find a keyframe');
                        frag.dropped = 0;
                        if (prevFrag) {
                            frag = prevFrag;
                            frag.backtracked = true;
                        }
                        else if (curSNIdx) {
                            // can't backtrack on very first fragment
                            frag = null;
                        }
                    }
                }
            }
        }
        return frag;
    };
    StreamController.prototype._loadKey = function (frag) {
        this.state = base_stream_controller_1.State.KEY_LOADING;
        this.hls.trigger(events_1.default.KEY_LOADING, { frag: frag });
    };
    StreamController.prototype._loadFragment = function (frag) {
        // Check if fragment is not loaded
        var fragState = this.fragmentTracker.getState(frag);
        this.fragCurrent = frag;
        this.startFragRequested = true;
        // Don't update nextLoadPosition for fragments which are not buffered
        if (Number.isFinite(frag.sn) && !frag.bitrateTest) {
            this.nextLoadPosition = frag.start + frag.duration;
        }
        // Allow backtracked fragments to load
        if (frag.backtracked || fragState === fragment_tracker_1.FragmentState.NOT_LOADED || fragState === fragment_tracker_1.FragmentState.PARTIAL) {
            frag.autoLevel = this.hls.autoLevelEnabled;
            frag.bitrateTest = this.bitrateTest;
            this.hls.trigger(events_1.default.FRAG_LOADING, { frag: frag });
            // lazy demuxer init, as this could take some time ... do it during frag loading
            if (!this.demuxer) {
                this.demuxer = new demuxer_1.default(this.hls, 'main');
            }
            this.state = base_stream_controller_1.State.FRAG_LOADING;
        }
        else if (fragState === fragment_tracker_1.FragmentState.APPENDING) {
            // Lower the buffer size and try again
            if (this._reduceMaxBufferLength(frag.duration)) {
                this.fragmentTracker.removeFragment(frag);
            }
        }
    };
    Object.defineProperty(StreamController.prototype, "state", {
        get: function () {
            return this._state;
        },
        set: function (nextState) {
            if (this.state !== nextState) {
                var previousState = this.state;
                this._state = nextState;
                logger_1.logger.log("main stream:" + previousState + "->" + nextState);
                this.hls.trigger(events_1.default.STREAM_STATE_TRANSITION, { previousState: previousState, nextState: nextState });
            }
        },
        enumerable: true,
        configurable: true
    });
    StreamController.prototype.getBufferedFrag = function (position) {
        return this.fragmentTracker.getBufferedFrag(position, playlist_loader_1.default.LevelType.MAIN);
    };
    Object.defineProperty(StreamController.prototype, "currentLevel", {
        get: function () {
            var media = this.media;
            if (media) {
                var frag = this.getBufferedFrag(media.currentTime);
                if (frag) {
                    return frag.level;
                }
            }
            return -1;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(StreamController.prototype, "nextBufferedFrag", {
        get: function () {
            var media = this.media;
            if (media) {
                // first get end range of current fragment
                return this.followingBufferedFrag(this.getBufferedFrag(media.currentTime));
            }
            else {
                return null;
            }
        },
        enumerable: true,
        configurable: true
    });
    StreamController.prototype.followingBufferedFrag = function (frag) {
        if (frag) {
            // try to get range of next fragment (500ms after this range)
            return this.getBufferedFrag(frag.endPTS + 0.5);
        }
        return null;
    };
    Object.defineProperty(StreamController.prototype, "nextLevel", {
        get: function () {
            var frag = this.nextBufferedFrag;
            if (frag) {
                return frag.level;
            }
            else {
                return -1;
            }
        },
        enumerable: true,
        configurable: true
    });
    StreamController.prototype._checkFragmentChanged = function () {
        var fragPlayingCurrent, currentTime, video = this.media;
        if (video && video.readyState && video.seeking === false) {
            currentTime = video.currentTime;
            /* if video element is in seeked state, currentTime can only increase.
              (assuming that playback rate is positive ...)
              As sometimes currentTime jumps back to zero after a
              media decode error, check this, to avoid seeking back to
              wrong position after a media decode error
            */
            if (currentTime > this.lastCurrentTime) {
                this.lastCurrentTime = currentTime;
            }
            if (buffer_helper_1.BufferHelper.isBuffered(video, currentTime)) {
                fragPlayingCurrent = this.getBufferedFrag(currentTime);
            }
            else if (buffer_helper_1.BufferHelper.isBuffered(video, currentTime + 0.1)) {
                /* ensure that FRAG_CHANGED event is triggered at startup,
                  when first video frame is displayed and playback is paused.
                  add a tolerance of 100ms, in case current position is not buffered,
                  check if current pos+100ms is buffered and use that buffer range
                  for FRAG_CHANGED event reporting */
                fragPlayingCurrent = this.getBufferedFrag(currentTime + 0.1);
            }
            if (fragPlayingCurrent) {
                var fragPlaying = fragPlayingCurrent;
                if (fragPlaying !== this.fragPlaying) {
                    this.hls.trigger(events_1.default.FRAG_CHANGED, { frag: fragPlaying });
                    var fragPlayingLevel = fragPlaying.level;
                    if (!this.fragPlaying || this.fragPlaying.level !== fragPlayingLevel) {
                        this.hls.trigger(events_1.default.LEVEL_SWITCHED, { level: fragPlayingLevel });
                    }
                    this.fragPlaying = fragPlaying;
                }
            }
        }
    };
    /*
      on immediate level switch :
       - pause playback if playing
       - cancel any pending load request
       - and trigger a buffer flush
    */
    StreamController.prototype.immediateLevelSwitch = function () {
        logger_1.logger.log('immediateLevelSwitch');
        if (!this.immediateSwitch) {
            this.immediateSwitch = true;
            var media = this.media, previouslyPaused = void 0;
            if (media) {
                previouslyPaused = media.paused;
                media.pause();
            }
            else {
                // don't restart playback after instant level switch in case media not attached
                previouslyPaused = true;
            }
            this.previouslyPaused = previouslyPaused;
        }
        var fragCurrent = this.fragCurrent;
        if (fragCurrent && fragCurrent.loader) {
            fragCurrent.loader.abort();
        }
        this.fragCurrent = null;
        // flush everything
        this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
    };
    /**
     * on immediate level switch end, after new fragment has been buffered:
     * - nudge video decoder by slightly adjusting video currentTime (if currentTime buffered)
     * - resume the playback if needed
     */
    StreamController.prototype.immediateLevelSwitchEnd = function () {
        var media = this.media;
        if (media && media.buffered.length) {
            this.immediateSwitch = false;
            if (buffer_helper_1.BufferHelper.isBuffered(media, media.currentTime)) {
                // only nudge if currentTime is buffered
                media.currentTime -= 0.0001;
            }
            if (!this.previouslyPaused) {
                media.play();
            }
        }
    };
    /**
     * try to switch ASAP without breaking video playback:
     * in order to ensure smooth but quick level switching,
     * we need to find the next flushable buffer range
     * we should take into account new segment fetch time
     */
    StreamController.prototype.nextLevelSwitch = function () {
        var media = this.media;
        // ensure that media is defined and that metadata are available (to retrieve currentTime)
        if (media && media.readyState) {
            var fetchdelay = void 0, fragPlayingCurrent = void 0, nextBufferedFrag = void 0;
            fragPlayingCurrent = this.getBufferedFrag(media.currentTime);
            if (fragPlayingCurrent && fragPlayingCurrent.startPTS > 1) {
                // flush buffer preceding current fragment (flush until current fragment start offset)
                // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
                this.flushMainBuffer(0, fragPlayingCurrent.startPTS - 1);
            }
            if (!media.paused) {
                // add a safety delay of 1s
                var nextLevelId = this.hls.nextLoadLevel, nextLevel = this.levels[nextLevelId], fragLastKbps = this.fragLastKbps;
                if (fragLastKbps && this.fragCurrent) {
                    fetchdelay = this.fragCurrent.duration * nextLevel.bitrate / (1000 * fragLastKbps) + 1;
                }
                else {
                    fetchdelay = 0;
                }
            }
            else {
                fetchdelay = 0;
            }
            // logger.log('fetchdelay:'+fetchdelay);
            // find buffer range that will be reached once new fragment will be fetched
            nextBufferedFrag = this.getBufferedFrag(media.currentTime + fetchdelay);
            if (nextBufferedFrag) {
                // we can flush buffer range following this one without stalling playback
                nextBufferedFrag = this.followingBufferedFrag(nextBufferedFrag);
                if (nextBufferedFrag) {
                    // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
                    var fragCurrent = this.fragCurrent;
                    if (fragCurrent && fragCurrent.loader) {
                        fragCurrent.loader.abort();
                    }
                    this.fragCurrent = null;
                    // start flush position is the start PTS of next buffered frag.
                    // we use frag.naxStartPTS which is max(audio startPTS, video startPTS).
                    // in case there is a small PTS Delta between audio and video, using maxStartPTS avoids flushing last samples from current fragment
                    this.flushMainBuffer(nextBufferedFrag.maxStartPTS, Number.POSITIVE_INFINITY);
                }
            }
        }
    };
    StreamController.prototype.flushMainBuffer = function (startOffset, endOffset) {
        this.state = base_stream_controller_1.State.BUFFER_FLUSHING;
        var flushScope = { startOffset: startOffset, endOffset: endOffset };
        // if alternate audio tracks are used, only flush video, otherwise flush everything
        if (this.altAudio) {
            flushScope.type = 'video';
        }
        this.hls.trigger(events_1.default.BUFFER_FLUSHING, flushScope);
    };
    StreamController.prototype.onMediaAttached = function (data) {
        var media = this.media = this.mediaBuffer = data.media;
        this.onvseeking = this.onMediaSeeking.bind(this);
        this.onvseeked = this.onMediaSeeked.bind(this);
        this.onvended = this.onMediaEnded.bind(this);
        media.addEventListener('seeking', this.onvseeking);
        media.addEventListener('seeked', this.onvseeked);
        media.addEventListener('ended', this.onvended);
        var config = this.config;
        if (this.levels && config.autoStartLoad) {
            this.hls.startLoad(config.startPosition);
        }
        this.gapController = new gap_controller_1.default(config, media, this.fragmentTracker, this.hls);
    };
    StreamController.prototype.onMediaDetaching = function () {
        var media = this.media;
        if (media && media.ended) {
            logger_1.logger.log('MSE detaching and video ended, reset startPosition');
            this.startPosition = this.lastCurrentTime = 0;
        }
        // reset fragment backtracked flag
        var levels = this.levels;
        if (levels) {
            levels.forEach(function (level) {
                if (level.details) {
                    level.details.fragments.forEach(function (fragment) {
                        fragment.backtracked = undefined;
                    });
                }
            });
        }
        // remove video listeners
        if (media) {
            media.removeEventListener('seeking', this.onvseeking);
            media.removeEventListener('seeked', this.onvseeked);
            media.removeEventListener('ended', this.onvended);
            this.onvseeking = this.onvseeked = this.onvended = null;
        }
        this.media = this.mediaBuffer = null;
        this.loadedmetadata = false;
        this.stopLoad();
    };
    StreamController.prototype.onMediaSeeked = function () {
        var media = this.media, currentTime = media ? media.currentTime : undefined;
        if (Number.isFinite(currentTime)) {
            logger_1.logger.log("media seeked to " + currentTime.toFixed(3));
        }
        // tick to speed up FRAGMENT_PLAYING triggering
        this.tick();
    };
    StreamController.prototype.onManifestLoading = function () {
        // reset buffer on manifest loading
        logger_1.logger.log('trigger BUFFER_RESET');
        this.hls.trigger(events_1.default.BUFFER_RESET);
        this.fragmentTracker.removeAllFragments();
        this.stalled = false;
        this.startPosition = this.lastCurrentTime = 0;
    };
    StreamController.prototype.onManifestParsed = function (data) {
        var aac = false, heaac = false, codec;
        data.levels.forEach(function (level) {
            // detect if we have different kind of audio codecs used amongst playlists
            codec = level.audioCodec;
            if (codec) {
                if (codec.indexOf('mp4a.40.2') !== -1) {
                    aac = true;
                }
                if (codec.indexOf('mp4a.40.5') !== -1) {
                    heaac = true;
                }
            }
        });
        this.audioCodecSwitch = (aac && heaac);
        if (this.audioCodecSwitch) {
            logger_1.logger.log('both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC');
        }
        this.levels = data.levels;
        this.startFragRequested = false;
        var config = this.config;
        if (config.autoStartLoad || this.forceStartLoad) {
            this.hls.startLoad(config.startPosition);
        }
    };
    StreamController.prototype.onLevelLoaded = function (data) {
        var newDetails = data.details;
        var newLevelId = data.level;
        var lastLevel = this.levels[this.levelLastLoaded];
        var curLevel = this.levels[newLevelId];
        var duration = newDetails.totalduration;
        var sliding = 0;
        logger_1.logger.log("level " + newLevelId + " loaded [" + newDetails.startSN + "," + newDetails.endSN + "],duration:" + duration);
        if (newDetails.live) {
            var curDetails = curLevel.details;
            if (curDetails && newDetails.fragments.length > 0) {
                // we already have details for that level, merge them
                LevelHelper.mergeDetails(curDetails, newDetails);
                sliding = newDetails.fragments[0].start;
                this.liveSyncPosition = this.computeLivePosition(sliding, curDetails);
                if (newDetails.PTSKnown && Number.isFinite(sliding)) {
                    logger_1.logger.log("live playlist sliding:" + sliding.toFixed(3));
                }
                else {
                    logger_1.logger.log('live playlist - outdated PTS, unknown sliding');
                    discontinuities_1.alignStream(this.fragPrevious, lastLevel, newDetails);
                }
            }
            else {
                logger_1.logger.log('live playlist - first load, unknown sliding');
                newDetails.PTSKnown = false;
                discontinuities_1.alignStream(this.fragPrevious, lastLevel, newDetails);
            }
        }
        else {
            newDetails.PTSKnown = false;
        }
        // override level info
        curLevel.details = newDetails;
        this.levelLastLoaded = newLevelId;
        this.hls.trigger(events_1.default.LEVEL_UPDATED, { details: newDetails, level: newLevelId });
        if (this.startFragRequested === false) {
            // compute start position if set to -1. use it straight away if value is defined
            if (this.startPosition === -1 || this.lastCurrentTime === -1) {
                // first, check if start time offset has been set in playlist, if yes, use this value
                var startTimeOffset = newDetails.startTimeOffset;
                if (Number.isFinite(startTimeOffset)) {
                    if (startTimeOffset < 0) {
                        logger_1.logger.log("negative start time offset " + startTimeOffset + ", count from end of last fragment");
                        startTimeOffset = sliding + duration + startTimeOffset;
                    }
                    logger_1.logger.log("start time offset found in playlist, adjust startPosition to " + startTimeOffset);
                    this.startPosition = startTimeOffset;
                }
                else {
                    // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
                    if (newDetails.live) {
                        this.startPosition = this.computeLivePosition(sliding, newDetails);
                        logger_1.logger.log("configure startPosition to " + this.startPosition);
                    }
                    else {
                        this.startPosition = 0;
                    }
                }
                this.lastCurrentTime = this.startPosition;
            }
            this.nextLoadPosition = this.startPosition;
        }
        // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
        if (this.state === base_stream_controller_1.State.WAITING_LEVEL) {
            this.state = base_stream_controller_1.State.IDLE;
        }
        // trigger handler right now
        this.tick();
    };
    StreamController.prototype.onKeyLoaded = function () {
        if (this.state === base_stream_controller_1.State.KEY_LOADING) {
            this.state = base_stream_controller_1.State.IDLE;
            this.tick();
        }
    };
    StreamController.prototype.onFragLoaded = function (data) {
        var _a = this, fragCurrent = _a.fragCurrent, hls = _a.hls, levels = _a.levels, media = _a.media;
        var fragLoaded = data.frag;
        if (this.state === base_stream_controller_1.State.FRAG_LOADING &&
            fragCurrent &&
            fragLoaded.type === 'main' &&
            fragLoaded.level === fragCurrent.level &&
            fragLoaded.sn === fragCurrent.sn) {
            var stats = data.stats;
            var currentLevel = levels[fragCurrent.level];
            var details = currentLevel.details;
            // reset frag bitrate test in any case after frag loaded event
            // if this frag was loaded to perform a bitrate test AND if hls.nextLoadLevel is greater than 0
            // then this means that we should be able to load a fragment at a higher quality level
            this.bitrateTest = false;
            this.stats = stats;
            logger_1.logger.log("Loaded " + fragCurrent.sn + " of [" + details.startSN + " ," + details.endSN + "],level " + fragCurrent.level);
            if (fragLoaded.bitrateTest && hls.nextLoadLevel) {
                // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
                this.state = base_stream_controller_1.State.IDLE;
                this.startFragRequested = false;
                stats.tparsed = stats.tbuffered = window.performance.now();
                hls.trigger(events_1.default.FRAG_BUFFERED, { stats: stats, frag: fragCurrent, id: 'main' });
                this.tick();
            }
            else if (fragLoaded.sn === 'initSegment') {
                this.state = base_stream_controller_1.State.IDLE;
                stats.tparsed = stats.tbuffered = window.performance.now();
                details.initSegment.data = data.payload;
                hls.trigger(events_1.default.FRAG_BUFFERED, { stats: stats, frag: fragCurrent, id: 'main' });
                this.tick();
            }
            else {
                logger_1.logger.log("Parsing " + fragCurrent.sn + " of [" + details.startSN + " ," + details.endSN + "],level " + fragCurrent.level + ", cc " + fragCurrent.cc);
                this.state = base_stream_controller_1.State.PARSING;
                this.pendingBuffering = true;
                this.appended = false;
                // Bitrate test frags are not usually buffered so the fragment tracker ignores them. If Hls.js decides to buffer
                // it (and therefore ends up at this line), then the fragment tracker needs to be manually informed.
                if (fragLoaded.bitrateTest) {
                    fragLoaded.bitrateTest = false;
                    this.fragmentTracker.onFragLoaded({
                        frag: fragLoaded
                    });
                }
                // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live) and if media is not seeking (this is to overcome potential timestamp drifts between playlists and fragments)
                var accurateTimeOffset = !(media && media.seeking) && (details.PTSKnown || !details.live);
                var initSegmentData = details.initSegment ? details.initSegment.data : [];
                var audioCodec = this._getAudioCodec(currentLevel);
                // transmux the MPEG-TS data to ISO-BMFF segments
                var demuxer = this.demuxer = this.demuxer || new demuxer_1.default(this.hls, 'main');
                demuxer.push(data.payload, initSegmentData, audioCodec, currentLevel.videoCodec, fragCurrent, details.totalduration, accurateTimeOffset);
            }
        }
        this.fragLoadError = 0;
    };
    StreamController.prototype.onFragParsingInitSegment = function (data) {
        var fragCurrent = this.fragCurrent;
        var fragNew = data.frag;
        if (fragCurrent &&
            data.id === 'main' &&
            fragNew.sn === fragCurrent.sn &&
            fragNew.level === fragCurrent.level &&
            this.state === base_stream_controller_1.State.PARSING) {
            var tracks = data.tracks, trackName = void 0, track = void 0;
            // if audio track is expected to come from audio stream controller, discard any coming from main
            if (tracks.audio && this.altAudio) {
                delete tracks.audio;
            }
            // include levelCodec in audio and video tracks
            track = tracks.audio;
            if (track) {
                var audioCodec = this.levels[this.level].audioCodec, ua = navigator.userAgent.toLowerCase();
                if (audioCodec && this.audioCodecSwap) {
                    logger_1.logger.log('swapping playlist audio codec');
                    if (audioCodec.indexOf('mp4a.40.5') !== -1) {
                        audioCodec = 'mp4a.40.2';
                    }
                    else {
                        audioCodec = 'mp4a.40.5';
                    }
                }
                // in case AAC and HE-AAC audio codecs are signalled in manifest
                // force HE-AAC , as it seems that most browsers prefers that way,
                // except for mono streams OR on FF
                // these conditions might need to be reviewed ...
                if (this.audioCodecSwitch) {
                    // don't force HE-AAC if mono stream
                    if (track.metadata.channelCount !== 1 &&
                        // don't force HE-AAC if firefox
                        ua.indexOf('firefox') === -1) {
                        audioCodec = 'mp4a.40.5';
                    }
                }
                // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
                if (ua.indexOf('android') !== -1 && track.container !== 'audio/mpeg') { // Exclude mpeg audio
                    audioCodec = 'mp4a.40.2';
                    logger_1.logger.log("Android: force audio codec to " + audioCodec);
                }
                track.levelCodec = audioCodec;
                track.id = data.id;
            }
            track = tracks.video;
            if (track) {
                track.levelCodec = this.levels[this.level].videoCodec;
                track.id = data.id;
            }
            this.hls.trigger(events_1.default.BUFFER_CODECS, tracks);
            // loop through tracks that are going to be provided to bufferController
            for (trackName in tracks) {
                track = tracks[trackName];
                logger_1.logger.log("main track:" + trackName + ",container:" + track.container + ",codecs[level/parsed]=[" + track.levelCodec + "/" + track.codec + "]");
                var initSegment = track.initSegment;
                if (initSegment) {
                    this.appended = true;
                    // arm pending Buffering flag before appending a segment
                    this.pendingBuffering = true;
                    this.hls.trigger(events_1.default.BUFFER_APPENDING, { type: trackName, data: initSegment, parent: 'main', content: 'initSegment' });
                }
            }
            // trigger handler right now
            this.tick();
        }
    };
    StreamController.prototype.onFragParsingData = function (data) {
        var _this = this;
        var fragCurrent = this.fragCurrent;
        var fragNew = data.frag;
        if (fragCurrent &&
            data.id === 'main' &&
            fragNew.sn === fragCurrent.sn &&
            fragNew.level === fragCurrent.level &&
            !(data.type === 'audio' && this.altAudio) && // filter out main audio if audio track is loaded through audio stream controller
            this.state === base_stream_controller_1.State.PARSING) {
            var level = this.levels[this.level], frag = fragCurrent;
            if (!Number.isFinite(data.endPTS)) {
                data.endPTS = data.startPTS + fragCurrent.duration;
                data.endDTS = data.startDTS + fragCurrent.duration;
            }
            if (data.hasAudio === true) {
                frag.addElementaryStream(fragment_1.default.ElementaryStreamTypes.AUDIO);
            }
            if (data.hasVideo === true) {
                frag.addElementaryStream(fragment_1.default.ElementaryStreamTypes.VIDEO);
            }
            logger_1.logger.log("Parsed " + data.type + ",PTS:[" + data.startPTS.toFixed(3) + "," + data.endPTS.toFixed(3) + "],DTS:[" + data.startDTS.toFixed(3) + "/" + data.endDTS.toFixed(3) + "],nb:" + data.nb + ",dropped:" + (data.dropped || 0));
            // Detect gaps in a fragment  and try to fix it by finding a keyframe in the previous fragment (see _findFragments)
            if (data.type === 'video') {
                frag.dropped = data.dropped;
                if (frag.dropped) {
                    if (!frag.backtracked) {
                        var levelDetails = level.details;
                        if (levelDetails && frag.sn === levelDetails.startSN) {
                            logger_1.logger.warn('missing video frame(s) on first frag, appending with gap', frag.sn);
                        }
                        else {
                            logger_1.logger.warn('missing video frame(s), backtracking fragment', frag.sn);
                            // Return back to the IDLE state without appending to buffer
                            // Causes findFragments to backtrack a segment and find the keyframe
                            // Audio fragments arriving before video sets the nextLoadPosition, causing _findFragments to skip the backtracked fragment
                            this.fragmentTracker.removeFragment(frag);
                            frag.backtracked = true;
                            this.nextLoadPosition = data.startPTS;
                            this.state = base_stream_controller_1.State.IDLE;
                            this.fragPrevious = frag;
                            this.tick();
                            return;
                        }
                    }
                    else {
                        logger_1.logger.warn('Already backtracked on this fragment, appending with the gap', frag.sn);
                    }
                }
                else {
                    // Only reset the backtracked flag if we've loaded the frag without any dropped frames
                    frag.backtracked = false;
                }
            }
            var drift = LevelHelper.updateFragPTSDTS(level.details, frag, data.startPTS, data.endPTS, data.startDTS, data.endDTS), hls_2 = this.hls;
            hls_2.trigger(events_1.default.LEVEL_PTS_UPDATED, { details: level.details, level: this.level, drift: drift, type: data.type, start: data.startPTS, end: data.endPTS });
            // has remuxer dropped video frames located before first keyframe ?
            [data.data1, data.data2].forEach(function (buffer) {
                // only append in PARSING state (rationale is that an appending error could happen synchronously on first segment appending)
                // in that case it is useless to append following segments
                if (buffer && buffer.length && _this.state === base_stream_controller_1.State.PARSING) {
                    _this.appended = true;
                    // arm pending Buffering flag before appending a segment
                    _this.pendingBuffering = true;
                    hls_2.trigger(events_1.default.BUFFER_APPENDING, { type: data.type, data: buffer, parent: 'main', content: 'data' });
                }
            });
            // trigger handler right now
            this.tick();
        }
    };
    StreamController.prototype.onFragParsed = function (data) {
        var fragCurrent = this.fragCurrent;
        var fragNew = data.frag;
        if (fragCurrent &&
            data.id === 'main' &&
            fragNew.sn === fragCurrent.sn &&
            fragNew.level === fragCurrent.level &&
            this.state === base_stream_controller_1.State.PARSING) {
            this.stats.tparsed = window.performance.now();
            this.state = base_stream_controller_1.State.PARSED;
            this._checkAppendedParsed();
        }
    };
    StreamController.prototype.onAudioTrackSwitching = function (data) {
        // if any URL found on new audio track, it is an alternate audio track
        var altAudio = !!data.url, trackId = data.id;
        // if we switch on main audio, ensure that main fragment scheduling is synced with media.buffered
        // don't do anything if we switch to alt audio: audio stream controller is handling it.
        // we will just have to change buffer scheduling on audioTrackSwitched
        if (!altAudio) {
            if (this.mediaBuffer !== this.media) {
                logger_1.logger.log('switching on main audio, use media.buffered to schedule main fragment loading');
                this.mediaBuffer = this.media;
                var fragCurrent = this.fragCurrent;
                // we need to refill audio buffer from main: cancel any frag loading to speed up audio switch
                if (fragCurrent.loader) {
                    logger_1.logger.log('switching to main audio track, cancel main fragment load');
                    fragCurrent.loader.abort();
                }
                this.fragCurrent = null;
                this.fragPrevious = null;
                // destroy demuxer to force init segment generation (following audio switch)
                if (this.demuxer) {
                    this.demuxer.destroy();
                    this.demuxer = null;
                }
                // switch to IDLE state to load new fragment
                this.state = base_stream_controller_1.State.IDLE;
            }
            var hls_3 = this.hls;
            // switching to main audio, flush all audio and trigger track switched
            hls_3.trigger(events_1.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY, type: 'audio' });
            hls_3.trigger(events_1.default.AUDIO_TRACK_SWITCHED, { id: trackId });
            this.altAudio = false;
        }
    };
    StreamController.prototype.onAudioTrackSwitched = function (data) {
        var trackId = data.id, altAudio = !!this.hls.audioTracks[trackId].url;
        if (altAudio) {
            var videoBuffer = this.videoBuffer;
            // if we switched on alternate audio, ensure that main fragment scheduling is synced with video sourcebuffer buffered
            if (videoBuffer && this.mediaBuffer !== videoBuffer) {
                logger_1.logger.log('switching on alternate audio, use video.buffered to schedule main fragment loading');
                this.mediaBuffer = videoBuffer;
            }
        }
        this.altAudio = altAudio;
        this.tick();
    };
    StreamController.prototype.onBufferCreated = function (data) {
        var tracks = data.tracks, mediaTrack, name, alternate = false;
        for (var type in tracks) {
            var track = tracks[type];
            if (track.id === 'main') {
                name = type;
                mediaTrack = track;
                // keep video source buffer reference
                if (type === 'video') {
                    this.videoBuffer = tracks[type].buffer;
                }
            }
            else {
                alternate = true;
            }
        }
        if (alternate && mediaTrack) {
            logger_1.logger.log("alternate track found, use " + name + ".buffered to schedule main fragment loading");
            this.mediaBuffer = mediaTrack.buffer;
        }
        else {
            this.mediaBuffer = this.media;
        }
    };
    StreamController.prototype.onBufferAppended = function (data) {
        if (data.parent === 'main') {
            var state = this.state;
            if (state === base_stream_controller_1.State.PARSING || state === base_stream_controller_1.State.PARSED) {
                // check if all buffers have been appended
                this.pendingBuffering = (data.pending > 0);
                this._checkAppendedParsed();
            }
        }
    };
    StreamController.prototype._checkAppendedParsed = function () {
        // trigger handler right now
        if (this.state === base_stream_controller_1.State.PARSED && (!this.appended || !this.pendingBuffering)) {
            var frag = this.fragCurrent;
            if (frag) {
                var media = this.mediaBuffer ? this.mediaBuffer : this.media;
                logger_1.logger.log("main buffered : " + time_ranges_1.default.toString(media.buffered));
                this.fragPrevious = frag;
                var stats = this.stats;
                stats.tbuffered = window.performance.now();
                // we should get rid of this.fragLastKbps
                this.fragLastKbps = Math.round(8 * stats.total / (stats.tbuffered - stats.tfirst));
                this.hls.trigger(events_1.default.FRAG_BUFFERED, { stats: stats, frag: frag, id: 'main' });
                this.state = base_stream_controller_1.State.IDLE;
            }
            this.tick();
        }
    };
    StreamController.prototype.onError = function (data) {
        var frag = data.frag || this.fragCurrent;
        // don't handle frag error not related to main fragment
        if (frag && frag.type !== 'main') {
            return;
        }
        // 0.5 : tolerance needed as some browsers stalls playback before reaching buffered end
        var mediaBuffered = !!this.media && buffer_helper_1.BufferHelper.isBuffered(this.media, this.media.currentTime) && buffer_helper_1.BufferHelper.isBuffered(this.media, this.media.currentTime + 0.5);
        switch (data.details) {
            case errors_1.ErrorDetails.FRAG_LOAD_ERROR:
            case errors_1.ErrorDetails.FRAG_LOAD_TIMEOUT:
            case errors_1.ErrorDetails.KEY_LOAD_ERROR:
            case errors_1.ErrorDetails.KEY_LOAD_TIMEOUT:
                if (!data.fatal) {
                    // keep retrying until the limit will be reached
                    if ((this.fragLoadError + 1) <= this.config.fragLoadingMaxRetry) {
                        // exponential backoff capped to config.fragLoadingMaxRetryTimeout
                        var delay = Math.min(Math.pow(2, this.fragLoadError) * this.config.fragLoadingRetryDelay, this.config.fragLoadingMaxRetryTimeout);
                        logger_1.logger.warn("mediaController: frag loading failed, retry in " + delay + " ms");
                        this.retryDate = window.performance.now() + delay;
                        // retry loading state
                        // if loadedmetadata is not set, it means that we are emergency switch down on first frag
                        // in that case, reset startFragRequested flag
                        if (!this.loadedmetadata) {
                            this.startFragRequested = false;
                            this.nextLoadPosition = this.startPosition;
                        }
                        this.fragLoadError++;
                        this.state = base_stream_controller_1.State.FRAG_LOADING_WAITING_RETRY;
                    }
                    else {
                        logger_1.logger.error("mediaController: " + data.details + " reaches max retry, redispatch as fatal ...");
                        // switch error to fatal
                        data.fatal = true;
                        this.state = base_stream_controller_1.State.ERROR;
                    }
                }
                break;
            case errors_1.ErrorDetails.LEVEL_LOAD_ERROR:
            case errors_1.ErrorDetails.LEVEL_LOAD_TIMEOUT:
                if (this.state !== base_stream_controller_1.State.ERROR) {
                    if (data.fatal) {
                        // if fatal error, stop processing
                        this.state = base_stream_controller_1.State.ERROR;
                        logger_1.logger.warn("streamController: " + data.details + ",switch to " + this.state + " state ...");
                    }
                    else {
                        // in case of non fatal error while loading level, if level controller is not retrying to load level , switch back to IDLE
                        if (!data.levelRetry && this.state === base_stream_controller_1.State.WAITING_LEVEL) {
                            this.state = base_stream_controller_1.State.IDLE;
                        }
                    }
                }
                break;
            case errors_1.ErrorDetails.BUFFER_FULL_ERROR:
                // if in appending state
                if (data.parent === 'main' && (this.state === base_stream_controller_1.State.PARSING || this.state === base_stream_controller_1.State.PARSED)) {
                    // reduce max buf len if current position is buffered
                    if (mediaBuffered) {
                        this._reduceMaxBufferLength(this.config.maxBufferLength);
                        this.state = base_stream_controller_1.State.IDLE;
                    }
                    else {
                        // current position is not buffered, but browser is still complaining about buffer full error
                        // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
                        // in that case flush the whole buffer to recover
                        logger_1.logger.warn('buffer full error also media.currentTime is not buffered, flush everything');
                        this.fragCurrent = null;
                        // flush everything
                        this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
                    }
                }
                break;
            default:
                break;
        }
    };
    StreamController.prototype._reduceMaxBufferLength = function (minLength) {
        var config = this.config;
        if (config.maxMaxBufferLength >= minLength) {
            // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
            config.maxMaxBufferLength /= 2;
            logger_1.logger.warn("main:reduce max buffer length to " + config.maxMaxBufferLength + "s");
            return true;
        }
        return false;
    };
    /**
     * Checks the health of the buffer and attempts to resolve playback stalls.
     * @private
     */
    StreamController.prototype._checkBuffer = function () {
        var media = this.media;
        if (!media || media.readyState === 0) {
            // Exit early if we don't have media or if the media hasn't bufferd anything yet (readyState 0)
            return;
        }
        var mediaBuffer = this.mediaBuffer ? this.mediaBuffer : media;
        var buffered = mediaBuffer.buffered;
        if (!this.loadedmetadata && buffered.length) {
            this.loadedmetadata = true;
            this._seekToStartPos();
        }
        else if (this.immediateSwitch) {
            this.immediateLevelSwitchEnd();
        }
        else {
            this.gapController.poll(this.lastCurrentTime, buffered);
        }
    };
    StreamController.prototype.onFragLoadEmergencyAborted = function () {
        this.state = base_stream_controller_1.State.IDLE;
        // if loadedmetadata is not set, it means that we are emergency switch down on first frag
        // in that case, reset startFragRequested flag
        if (!this.loadedmetadata) {
            this.startFragRequested = false;
            this.nextLoadPosition = this.startPosition;
        }
        this.tick();
    };
    StreamController.prototype.onBufferFlushed = function () {
        /* after successful buffer flushing, filter flushed fragments from bufferedFrags
          use mediaBuffered instead of media (so that we will check against video.buffered ranges in case of alt audio track)
        */
        var media = this.mediaBuffer ? this.mediaBuffer : this.media;
        if (media) {
            // filter fragments potentially evicted from buffer. this is to avoid memleak on live streams
            this.fragmentTracker.detectEvictedFragments(fragment_1.default.ElementaryStreamTypes.VIDEO, media.buffered);
        }
        // move to IDLE once flush complete. this should trigger new fragment loading
        this.state = base_stream_controller_1.State.IDLE;
        // reset reference to frag
        this.fragPrevious = null;
    };
    StreamController.prototype.swapAudioCodec = function () {
        this.audioCodecSwap = !this.audioCodecSwap;
    };
    StreamController.prototype.computeLivePosition = function (sliding, levelDetails) {
        var targetLatency = this.config.liveSyncDuration !== undefined ? this.config.liveSyncDuration : this.config.liveSyncDurationCount * levelDetails.targetduration;
        return sliding + Math.max(0, levelDetails.totalduration - targetLatency);
    };
    /**
     * Seeks to the set startPosition if not equal to the mediaElement's current time.
     * @private
     */
    StreamController.prototype._seekToStartPos = function () {
        var media = this.media;
        var currentTime = media.currentTime;
        // only adjust currentTime if different from startPosition or if startPosition not buffered
        // at that stage, there should be only one buffered range, as we reach that code after first fragment has been buffered
        var startPosition = media.seeking ? currentTime : this.startPosition;
        // if currentTime not matching with expected startPosition or startPosition not buffered but close to first buffered
        if (currentTime !== startPosition) {
            // if startPosition not buffered, let's seek to buffered.start(0)
            logger_1.logger.log("target start position not buffered, seek to buffered.start(0) " + startPosition + " from current time " + currentTime + " ");
            media.currentTime = startPosition;
        }
    };
    StreamController.prototype._getAudioCodec = function (currentLevel) {
        var audioCodec = this.config.defaultAudioCodec || currentLevel.audioCodec;
        if (this.audioCodecSwap) {
            logger_1.logger.log('swapping playlist audio codec');
            if (audioCodec) {
                if (audioCodec.indexOf('mp4a.40.5') !== -1) {
                    audioCodec = 'mp4a.40.2';
                }
                else {
                    audioCodec = 'mp4a.40.5';
                }
            }
        }
        return audioCodec;
    };
    Object.defineProperty(StreamController.prototype, "liveSyncPosition", {
        get: function () {
            return this._liveSyncPosition;
        },
        set: function (value) {
            this._liveSyncPosition = value;
        },
        enumerable: true,
        configurable: true
    });
    return StreamController;
}(base_stream_controller_1.default));
exports.default = StreamController;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/controller/subtitle-stream-controller.js":
/*!******************************************************!*\
  !*** ./src/controller/subtitle-stream-controller.js ***!
  \******************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @class SubtitleStreamController
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var decrypter_1 = __webpack_require__(/*! ../crypt/decrypter */ "./src/crypt/decrypter.js");
var task_loop_1 = __webpack_require__(/*! ../task-loop */ "./src/task-loop.js");
var buffer_helper_1 = __webpack_require__(/*! ../utils/buffer-helper */ "./src/utils/buffer-helper.js");
var fragment_finders_1 = __webpack_require__(/*! ./fragment-finders */ "./src/controller/fragment-finders.js");
var fragment_tracker_1 = __webpack_require__(/*! ./fragment-tracker */ "./src/controller/fragment-tracker.js");
var performance = window.performance;
exports.SubtitleStreamControllerState = {
    STOPPED: 'STOPPED',
    IDLE: 'IDLE',
    KEY_LOADING: 'KEY_LOADING',
    FRAG_LOADING: 'FRAG_LOADING'
};
var State = exports.SubtitleStreamControllerState;
var TICK_INTERVAL = 500; // how often to tick in ms
var SubtitleStreamController = /** @class */ (function (_super) {
    __extends(SubtitleStreamController, _super);
    function SubtitleStreamController(hls, fragmentTracker) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHED, events_1.default.MEDIA_DETACHING, events_1.default.ERROR, events_1.default.KEY_LOADED, events_1.default.FRAG_LOADED, events_1.default.SUBTITLE_TRACKS_UPDATED, events_1.default.SUBTITLE_TRACK_SWITCH, events_1.default.SUBTITLE_TRACK_LOADED, events_1.default.SUBTITLE_FRAG_PROCESSED) || this;
        _this.fragmentTracker = fragmentTracker;
        _this.config = hls.config;
        _this.state = State.STOPPED;
        _this.tracks = [];
        _this.tracksBuffered = [];
        _this.currentTrackId = -1;
        _this.decrypter = new decrypter_1.default(hls, hls.config);
        return _this;
    }
    SubtitleStreamController.prototype.onHandlerDestroyed = function () {
        this.fragmentTracker = null;
        this.state = State.STOPPED;
        _super.prototype.onHandlerDestroyed.call(this);
    };
    SubtitleStreamController.prototype.onSubtitleFragProcessed = function (data) {
        this.state = State.IDLE;
        if (!data.success) {
            return;
        }
        var buffered = this.tracksBuffered[this.currentTrackId];
        var frag = data.frag;
        this.fragPrevious = frag;
        if (!buffered) {
            return;
        }
        // Create/update a buffered array matching the interface used by BufferHelper.bufferedInfo
        // so we can re-use the logic used to detect how much have been buffered
        // FIXME: put this in a utility function or proper object for time-ranges manipulation?
        var timeRange;
        for (var i = 0; i < buffered.length; i++) {
            if (frag.start >= buffered[i].start && frag.start <= buffered[i].end) {
                timeRange = buffered[i];
                break;
            }
        }
        if (timeRange) {
            timeRange.end = frag.start + frag.duration;
        }
        else {
            buffered.push({
                start: frag.start,
                end: frag.start + frag.duration
            });
        }
    };
    SubtitleStreamController.prototype.onMediaAttached = function (data) {
        this.media = data.media;
        this.state = State.IDLE;
    };
    SubtitleStreamController.prototype.onMediaDetaching = function () {
        this.media = null;
        this.state = State.STOPPED;
    };
    // If something goes wrong, procede to next frag, if we were processing one.
    SubtitleStreamController.prototype.onError = function (data) {
        var frag = data.frag;
        // don't handle error not related to subtitle fragment
        if (!frag || frag.type !== 'subtitle') {
            return;
        }
        this.state = State.IDLE;
    };
    // Got all new subtitle tracks.
    SubtitleStreamController.prototype.onSubtitleTracksUpdated = function (data) {
        var _this = this;
        logger_1.logger.log('subtitle tracks updated');
        this.tracksBuffered = [];
        this.tracks = data.subtitleTracks;
        this.tracks.forEach(function (track) {
            _this.tracksBuffered[track.id] = [];
        });
    };
    SubtitleStreamController.prototype.onSubtitleTrackSwitch = function (data) {
        this.currentTrackId = data.id;
        if (!this.tracks || this.currentTrackId === -1) {
            this.clearInterval();
            return;
        }
        // Check if track has the necessary details to load fragments
        var currentTrack = this.tracks[this.currentTrackId];
        if (currentTrack && currentTrack.details) {
            this.setInterval(TICK_INTERVAL);
        }
    };
    // Got a new set of subtitle fragments.
    SubtitleStreamController.prototype.onSubtitleTrackLoaded = function (data) {
        var id = data.id, details = data.details;
        if (!this.tracks) {
            logger_1.logger.warn('Can not update subtitle details, no tracks found');
            return;
        }
        if (this.tracks[id]) {
            logger_1.logger.log('Updating subtitle track details');
            this.tracks[id].details = details;
        }
        this.setInterval(TICK_INTERVAL);
    };
    SubtitleStreamController.prototype.onKeyLoaded = function () {
        if (this.state === State.KEY_LOADING) {
            this.state = State.IDLE;
        }
    };
    SubtitleStreamController.prototype.onFragLoaded = function (data) {
        var fragCurrent = this.fragCurrent;
        var decryptData = data.frag.decryptdata;
        var fragLoaded = data.frag;
        var hls = this.hls;
        if (this.state === State.FRAG_LOADING &&
            fragCurrent &&
            data.frag.type === 'subtitle' &&
            fragCurrent.sn === data.frag.sn) {
            // check to see if the payload needs to be decrypted
            if (data.payload.byteLength > 0 && (decryptData && decryptData.key && decryptData.method === 'AES-128')) {
                var startTime_1 = performance.now();
                // decrypt the subtitles
                this.decrypter.decrypt(data.payload, decryptData.key.buffer, decryptData.iv.buffer, function (decryptedData) {
                    var endTime = performance.now();
                    hls.trigger(events_1.default.FRAG_DECRYPTED, { frag: fragLoaded, payload: decryptedData, stats: { tstart: startTime_1, tdecrypt: endTime } });
                });
            }
        }
    };
    SubtitleStreamController.prototype.doTick = function () {
        if (!this.media) {
            this.state = State.IDLE;
            return;
        }
        switch (this.state) {
            case State.IDLE:
                var tracks = this.tracks;
                var trackId = this.currentTrackId;
                if (!tracks || !tracks[trackId] || !tracks[trackId].details) {
                    break;
                }
                var trackDetails = tracks[trackId].details;
                var config = this.config;
                var maxBufferHole = config.maxBufferHole;
                var maxConfigBuffer = Math.min(config.maxBufferLength, config.maxMaxBufferLength);
                var maxFragLookUpTolerance = config.maxFragLookUpTolerance;
                var bufferedInfo = buffer_helper_1.BufferHelper.bufferedInfo(this._getBuffered(), this.media.currentTime, maxBufferHole);
                var bufferEnd = bufferedInfo.end;
                var bufferLen = bufferedInfo.len;
                var fragments = trackDetails.fragments;
                var fragLen = fragments.length;
                var end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration;
                var foundFrag = void 0;
                if (bufferLen < maxConfigBuffer && bufferEnd < end) {
                    foundFrag = fragment_finders_1.findFragmentByPTS(this.fragPrevious, fragments, bufferEnd, maxFragLookUpTolerance);
                }
                else if (trackDetails.hasProgramDateTime && this.fragPrevious) {
                    foundFrag = fragment_finders_1.findFragmentByPDT(fragments, this.fragPrevious.endProgramDateTime, maxFragLookUpTolerance);
                }
                if (foundFrag && foundFrag.encrypted) {
                    logger_1.logger.log("Loading key for " + foundFrag.sn);
                    this.state = State.KEY_LOADING;
                    this.hls.trigger(events_1.default.KEY_LOADING, { frag: foundFrag });
                }
                else if (foundFrag && this.fragmentTracker.getState(foundFrag) === fragment_tracker_1.FragmentState.NOT_LOADED) {
                    // only load if fragment is not loaded
                    foundFrag.trackId = trackId; // Frags don't know their subtitle track ID, so let's just add that...
                    this.fragCurrent = foundFrag;
                    this.state = State.FRAG_LOADING;
                    this.hls.trigger(events_1.default.FRAG_LOADING, { frag: foundFrag });
                }
        }
    };
    SubtitleStreamController.prototype._getBuffered = function () {
        return this.tracksBuffered[this.currentTrackId].buffered || [];
    };
    return SubtitleStreamController;
}(task_loop_1.default));
exports.SubtitleStreamController = SubtitleStreamController;


/***/ }),

/***/ "./src/controller/subtitle-track-controller.js":
/*!*****************************************************!*\
  !*** ./src/controller/subtitle-track-controller.js ***!
  \*****************************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * subtitle track controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
function filterSubtitleTracks(textTrackList) {
    var tracks = [];
    for (var i = 0; i < textTrackList.length; i++) {
        if (textTrackList[i].kind === 'subtitles') {
            tracks.push(textTrackList[i]);
        }
    }
    return tracks;
}
var SubtitleTrackController = /** @class */ (function (_super) {
    __extends(SubtitleTrackController, _super);
    function SubtitleTrackController(hls) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHED, events_1.default.MEDIA_DETACHING, events_1.default.MANIFEST_LOADING, events_1.default.MANIFEST_LOADED, events_1.default.SUBTITLE_TRACK_LOADED) || this;
        _this.tracks = [];
        _this.trackId = -1;
        _this.media = null;
        /**
         * @member {boolean} subtitleDisplay Enable/disable subtitle display rendering
         */
        _this.subtitleDisplay = true;
        return _this;
    }
    SubtitleTrackController.prototype._onTextTracksChanged = function () {
        // Media is undefined when switching streams via loadSource()
        if (!this.media) {
            return;
        }
        var trackId = -1;
        var tracks = filterSubtitleTracks(this.media.textTracks);
        for (var id = 0; id < tracks.length; id++) {
            if (tracks[id].mode === 'hidden') {
                // Do not break in case there is a following track with showing.
                trackId = id;
            }
            else if (tracks[id].mode === 'showing') {
                trackId = id;
                break;
            }
        }
        // Setting current subtitleTrack will invoke code.
        this.subtitleTrack = trackId;
    };
    SubtitleTrackController.prototype.destroy = function () {
        event_handler_1.default.prototype.destroy.call(this);
    };
    // Listen for subtitle track change, then extract the current track ID.
    SubtitleTrackController.prototype.onMediaAttached = function (data) {
        var _this = this;
        this.media = data.media;
        if (!this.media) {
            return;
        }
        if (this.queuedDefaultTrack) {
            this.subtitleTrack = this.queuedDefaultTrack;
            delete this.queuedDefaultTrack;
        }
        this.trackChangeListener = this._onTextTracksChanged.bind(this);
        this.useTextTrackPolling = !(this.media.textTracks && 'onchange' in this.media.textTracks);
        if (this.useTextTrackPolling) {
            this.subtitlePollingInterval = setInterval(function () {
                _this.trackChangeListener();
            }, 500);
        }
        else {
            this.media.textTracks.addEventListener('change', this.trackChangeListener);
        }
    };
    SubtitleTrackController.prototype.onMediaDetaching = function () {
        if (!this.media) {
            return;
        }
        if (this.useTextTrackPolling) {
            clearInterval(this.subtitlePollingInterval);
        }
        else {
            this.media.textTracks.removeEventListener('change', this.trackChangeListener);
        }
        this.media = null;
    };
    // Reset subtitle tracks on manifest loading
    SubtitleTrackController.prototype.onManifestLoading = function () {
        this.tracks = [];
        this.trackId = -1;
    };
    // Fired whenever a new manifest is loaded.
    SubtitleTrackController.prototype.onManifestLoaded = function (data) {
        var _this = this;
        var tracks = data.subtitles || [];
        this.tracks = tracks;
        this.trackId = -1;
        this.hls.trigger(events_1.default.SUBTITLE_TRACKS_UPDATED, { subtitleTracks: tracks });
        // loop through available subtitle tracks and autoselect default if needed
        // TODO: improve selection logic to handle forced, etc
        tracks.forEach(function (track) {
            if (track.default) {
                // setting this.subtitleTrack will trigger internal logic
                // if media has not been attached yet, it will fail
                // we keep a reference to the default track id
                // and we'll set subtitleTrack when onMediaAttached is triggered
                if (_this.media) {
                    _this.subtitleTrack = track.id;
                }
                else {
                    _this.queuedDefaultTrack = track.id;
                }
            }
        });
    };
    // Trigger subtitle track playlist reload.
    SubtitleTrackController.prototype.onTick = function () {
        var trackId = this.trackId;
        var subtitleTrack = this.tracks[trackId];
        if (!subtitleTrack) {
            return;
        }
        var details = subtitleTrack.details;
        // check if we need to load playlist for this subtitle Track
        if (!details || details.live) {
            // track not retrieved yet, or live playlist we need to (re)load it
            logger_1.logger.log("(re)loading playlist for subtitle track " + trackId);
            this.hls.trigger(events_1.default.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: trackId });
        }
    };
    SubtitleTrackController.prototype.onSubtitleTrackLoaded = function (data) {
        var _this = this;
        if (data.id < this.tracks.length) {
            logger_1.logger.log("subtitle track " + data.id + " loaded");
            this.tracks[data.id].details = data.details;
            // check if current playlist is a live playlist
            if (data.details.live && !this.timer) {
                // if live playlist we will have to reload it periodically
                // set reload period to playlist target duration
                this.timer = setInterval(function () {
                    _this.onTick();
                }, 1000 * data.details.targetduration, this);
            }
            if (!data.details.live && this.timer) {
                // playlist is not live and timer is armed : stopping it
                this._stopTimer();
            }
        }
    };
    Object.defineProperty(SubtitleTrackController.prototype, "subtitleTracks", {
        /** get alternate subtitle tracks list from playlist **/
        get: function () {
            return this.tracks;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SubtitleTrackController.prototype, "subtitleTrack", {
        /** get index of the selected subtitle track (index in subtitle track lists) **/
        get: function () {
            return this.trackId;
        },
        /** select a subtitle track, based on its index in subtitle track lists**/
        set: function (subtitleTrackId) {
            if (this.trackId !== subtitleTrackId) {
                this._toggleTrackModes(subtitleTrackId);
                this.setSubtitleTrackInternal(subtitleTrackId);
            }
        },
        enumerable: true,
        configurable: true
    });
    /**
     * This method is responsible for validating the subtitle index and periodically reloading if live.
     * Dispatches the SUBTITLE_TRACK_SWITCH event, which instructs the subtitle-stream-controller to load the selected track.
     * @param newId - The id of the subtitle track to activate.
     */
    SubtitleTrackController.prototype.setSubtitleTrackInternal = function (newId) {
        var _a = this, hls = _a.hls, tracks = _a.tracks;
        if (typeof newId !== 'number' || newId < -1 || newId >= tracks.length) {
            return;
        }
        this._stopTimer();
        this.trackId = newId;
        logger_1.logger.log("switching to subtitle track " + newId);
        hls.trigger(events_1.default.SUBTITLE_TRACK_SWITCH, { id: newId });
        if (newId === -1) {
            return;
        }
        // check if we need to load playlist for this subtitle Track
        var subtitleTrack = tracks[newId];
        var details = subtitleTrack.details;
        if (!details || details.live) {
            // track not retrieved yet, or live playlist we need to (re)load it
            logger_1.logger.log("(re)loading playlist for subtitle track " + newId);
            hls.trigger(events_1.default.SUBTITLE_TRACK_LOADING, { url: subtitleTrack.url, id: newId });
        }
    };
    SubtitleTrackController.prototype._stopTimer = function () {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    };
    /**
     * Disables the old subtitleTrack and sets current mode on the next subtitleTrack.
     * This operates on the DOM textTracks.
     * A value of -1 will disable all subtitle tracks.
     * @param newId - The id of the next track to enable
     * @private
     */
    SubtitleTrackController.prototype._toggleTrackModes = function (newId) {
        var _a = this, media = _a.media, subtitleDisplay = _a.subtitleDisplay, trackId = _a.trackId;
        if (!media) {
            return;
        }
        var textTracks = filterSubtitleTracks(media.textTracks);
        if (newId === -1) {
            [].slice.call(textTracks).forEach(function (track) {
                track.mode = 'disabled';
            });
        }
        else {
            var oldTrack = textTracks[trackId];
            if (oldTrack) {
                oldTrack.mode = 'disabled';
            }
        }
        var nextTrack = textTracks[newId];
        if (nextTrack) {
            nextTrack.mode = subtitleDisplay ? 'showing' : 'hidden';
        }
    };
    return SubtitleTrackController;
}(event_handler_1.default));
exports.default = SubtitleTrackController;


/***/ }),

/***/ "./src/controller/timeline-controller.js":
/*!***********************************************!*\
  !*** ./src/controller/timeline-controller.js ***!
  \***********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/*
 * Timeline Controller
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var cea_608_parser_1 = __webpack_require__(/*! ../utils/cea-608-parser */ "./src/utils/cea-608-parser.js");
var output_filter_1 = __webpack_require__(/*! ../utils/output-filter */ "./src/utils/output-filter.js");
var webvtt_parser_1 = __webpack_require__(/*! ../utils/webvtt-parser */ "./src/utils/webvtt-parser.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var texttrack_utils_1 = __webpack_require__(/*! ../utils/texttrack-utils */ "./src/utils/texttrack-utils.js");
function canReuseVttTextTrack(inUseTrack, manifestTrack) {
    return inUseTrack && inUseTrack.label === manifestTrack.name && !(inUseTrack.textTrack1 || inUseTrack.textTrack2);
}
function intersection(x1, x2, y1, y2) {
    return Math.min(x2, y2) - Math.max(x1, y1);
}
var TimelineController = /** @class */ (function (_super) {
    __extends(TimelineController, _super);
    function TimelineController(hls) {
        var _this = _super.call(this, hls, events_1.default.MEDIA_ATTACHING, events_1.default.MEDIA_DETACHING, events_1.default.FRAG_PARSING_USERDATA, events_1.default.FRAG_DECRYPTED, events_1.default.MANIFEST_LOADING, events_1.default.MANIFEST_LOADED, events_1.default.FRAG_LOADED, events_1.default.LEVEL_SWITCHING, events_1.default.INIT_PTS_FOUND) || this;
        _this.hls = hls;
        _this.config = hls.config;
        _this.enabled = true;
        _this.Cues = hls.config.cueHandler;
        _this.textTracks = [];
        _this.tracks = [];
        _this.unparsedVttFrags = [];
        _this.initPTS = [];
        _this.cueRanges = [];
        _this.captionsTracks = {};
        _this.captionsProperties = {
            textTrack1: {
                label: _this.config.captionsTextTrack1Label,
                languageCode: _this.config.captionsTextTrack1LanguageCode
            },
            textTrack2: {
                label: _this.config.captionsTextTrack2Label,
                languageCode: _this.config.captionsTextTrack2LanguageCode
            }
        };
        if (_this.config.enableCEA708Captions) {
            var channel1 = new output_filter_1.default(_this, 'textTrack1');
            var channel2 = new output_filter_1.default(_this, 'textTrack2');
            _this.cea608Parser = new cea_608_parser_1.default(0, channel1, channel2);
        }
        return _this;
    }
    TimelineController.prototype.addCues = function (trackName, startTime, endTime, screen) {
        // skip cues which overlap more than 50% with previously parsed time ranges
        var ranges = this.cueRanges;
        var merged = false;
        for (var i = ranges.length; i--;) {
            var cueRange = ranges[i];
            var overlap = intersection(cueRange[0], cueRange[1], startTime, endTime);
            if (overlap >= 0) {
                cueRange[0] = Math.min(cueRange[0], startTime);
                cueRange[1] = Math.max(cueRange[1], endTime);
                merged = true;
                if ((overlap / (endTime - startTime)) > 0.5) {
                    return;
                }
            }
        }
        if (!merged) {
            ranges.push([startTime, endTime]);
        }
        this.Cues.newCue(this.captionsTracks[trackName], startTime, endTime, screen);
    };
    // Triggered when an initial PTS is found; used for synchronisation of WebVTT.
    TimelineController.prototype.onInitPtsFound = function (data) {
        var _this = this;
        if (data.id === 'main') {
            this.initPTS[data.frag.cc] = data.initPTS;
        }
        // Due to asynchronous processing, initial PTS may arrive later than the first VTT fragments are loaded.
        // Parse any unparsed fragments upon receiving the initial PTS.
        if (this.unparsedVttFrags.length) {
            var unparsedVttFrags = this.unparsedVttFrags;
            this.unparsedVttFrags = [];
            unparsedVttFrags.forEach(function (frag) {
                _this.onFragLoaded(frag);
            });
        }
    };
    TimelineController.prototype.getExistingTrack = function (trackName) {
        var media = this.media;
        if (media) {
            for (var i = 0; i < media.textTracks.length; i++) {
                var textTrack = media.textTracks[i];
                if (textTrack[trackName]) {
                    return textTrack;
                }
            }
        }
        return null;
    };
    TimelineController.prototype.createCaptionsTrack = function (trackName) {
        var _a = this.captionsProperties[trackName], label = _a.label, languageCode = _a.languageCode;
        var captionsTracks = this.captionsTracks;
        if (!captionsTracks[trackName]) {
            // Enable reuse of existing text track.
            var existingTrack = this.getExistingTrack(trackName);
            if (!existingTrack) {
                var textTrack = this.createTextTrack('captions', label, languageCode);
                if (textTrack) {
                    // Set a special property on the track so we know it's managed by Hls.js
                    textTrack[trackName] = true;
                    captionsTracks[trackName] = textTrack;
                }
            }
            else {
                captionsTracks[trackName] = existingTrack;
                texttrack_utils_1.clearCurrentCues(captionsTracks[trackName]);
                texttrack_utils_1.sendAddTrackEvent(captionsTracks[trackName], this.media);
            }
        }
    };
    TimelineController.prototype.createTextTrack = function (kind, label, lang) {
        var media = this.media;
        if (media) {
            return media.addTextTrack(kind, label, lang);
        }
    };
    TimelineController.prototype.destroy = function () {
        event_handler_1.default.prototype.destroy.call(this);
    };
    TimelineController.prototype.onMediaAttaching = function (data) {
        this.media = data.media;
        this._cleanTracks();
    };
    TimelineController.prototype.onMediaDetaching = function () {
        var captionsTracks = this.captionsTracks;
        Object.keys(captionsTracks).forEach(function (trackName) {
            texttrack_utils_1.clearCurrentCues(captionsTracks[trackName]);
            delete captionsTracks[trackName];
        });
    };
    TimelineController.prototype.onManifestLoading = function () {
        this.lastSn = -1; // Detect discontiguity in fragment parsing
        this.prevCC = -1;
        this.vttCCs = { ccOffset: 0, presentationOffset: 0 }; // Detect discontinuity in subtitle manifests
        this._cleanTracks();
    };
    TimelineController.prototype._cleanTracks = function () {
        // clear outdated subtitles
        var media = this.media;
        if (media) {
            var textTracks = media.textTracks;
            if (textTracks) {
                for (var i = 0; i < textTracks.length; i++) {
                    texttrack_utils_1.clearCurrentCues(textTracks[i]);
                }
            }
        }
    };
    TimelineController.prototype.onManifestLoaded = function (data) {
        var _this = this;
        this.textTracks = [];
        this.unparsedVttFrags = this.unparsedVttFrags || [];
        this.initPTS = [];
        this.cueRanges = [];
        if (this.config.enableWebVTT) {
            this.tracks = data.subtitles || [];
            var inUseTracks_1 = this.media ? this.media.textTracks : [];
            this.tracks.forEach(function (track, index) {
                var textTrack;
                if (index < inUseTracks_1.length) {
                    var inUseTrack = [].slice.call(inUseTracks_1).find(function (inUseTrack) { return canReuseVttTextTrack(inUseTrack, track); });
                    // Reuse tracks with the same label, but do not reuse 608/708 tracks
                    if (inUseTrack) {
                        textTrack = inUseTrack;
                    }
                }
                if (!textTrack) {
                    textTrack = _this.createTextTrack('subtitles', track.name, track.lang);
                }
                if (track.default) {
                    textTrack.mode = _this.hls.subtitleDisplay ? 'showing' : 'hidden';
                }
                else {
                    textTrack.mode = 'disabled';
                }
                _this.textTracks.push(textTrack);
            });
        }
    };
    TimelineController.prototype.onLevelSwitching = function () {
        this.enabled = this.hls.currentLevel.closedCaptions !== 'NONE';
    };
    TimelineController.prototype.onFragLoaded = function (data) {
        var frag = data.frag, payload = data.payload;
        if (frag.type === 'main') {
            var sn = frag.sn;
            // if this frag isn't contiguous, clear the parser so cues with bad start/end times aren't added to the textTrack
            if (sn !== this.lastSn + 1) {
                var cea608Parser = this.cea608Parser;
                if (cea608Parser) {
                    cea608Parser.reset();
                }
            }
            this.lastSn = sn;
        } // eslint-disable-line brace-style
        // If fragment is subtitle type, parse as WebVTT.
        else if (frag.type === 'subtitle') {
            if (payload.byteLength) {
                // We need an initial synchronisation PTS. Store fragments as long as none has arrived.
                if (!Number.isFinite(this.initPTS[frag.cc])) {
                    this.unparsedVttFrags.push(data);
                    if (this.initPTS.length) {
                        // finish unsuccessfully, otherwise the subtitle-stream-controller could be blocked from loading new frags.
                        this.hls.trigger(events_1.default.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
                    }
                    return;
                }
                var decryptData = frag.decryptdata;
                // If the subtitles are not encrypted, parse VTTs now. Otherwise, we need to wait.
                if ((decryptData == null) || (decryptData.key == null) || (decryptData.method !== 'AES-128')) {
                    this._parseVTTs(frag, payload);
                }
            }
            else {
                // In case there is no payload, finish unsuccessfully.
                this.hls.trigger(events_1.default.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
            }
        }
    };
    TimelineController.prototype._parseVTTs = function (frag, payload) {
        var vttCCs = this.vttCCs;
        if (!vttCCs[frag.cc]) {
            vttCCs[frag.cc] = { start: frag.start, prevCC: this.prevCC, new: true };
            this.prevCC = frag.cc;
        }
        var textTracks = this.textTracks, hls = this.hls;
        // Parse the WebVTT file contents.
        webvtt_parser_1.default.parse(payload, this.initPTS[frag.cc], vttCCs, frag.cc, function (cues) {
            var currentTrack = textTracks[frag.trackId];
            // WebVTTParser.parse is an async method and if the currently selected text track mode is set to "disabled"
            // before parsing is done then don't try to access currentTrack.cues.getCueById as cues will be null
            // and trying to access getCueById method of cues will throw an exception
            if (currentTrack.mode === 'disabled') {
                hls.trigger(events_1.default.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
                return;
            }
            // Add cues and trigger event with success true.
            cues.forEach(function (cue) {
                // Sometimes there are cue overlaps on segmented vtts so the same
                // cue can appear more than once in different vtt files.
                // This avoid showing duplicated cues with same timecode and text.
                if (!currentTrack.cues.getCueById(cue.id)) {
                    try {
                        currentTrack.addCue(cue);
                    }
                    catch (err) {
                        var textTrackCue = new window.TextTrackCue(cue.startTime, cue.endTime, cue.text);
                        textTrackCue.id = cue.id;
                        currentTrack.addCue(textTrackCue);
                    }
                }
            });
            hls.trigger(events_1.default.SUBTITLE_FRAG_PROCESSED, { success: true, frag: frag });
        }, function (e) {
            // Something went wrong while parsing. Trigger event with success false.
            logger_1.logger.log("Failed to parse VTT cue: " + e);
            hls.trigger(events_1.default.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
        });
    };
    TimelineController.prototype.onFragDecrypted = function (data) {
        var decryptedData = data.payload, frag = data.frag;
        if (frag.type === 'subtitle') {
            if (!Number.isFinite(this.initPTS[frag.cc])) {
                this.unparsedVttFrags.push(data);
                return;
            }
            this._parseVTTs(frag, decryptedData);
        }
    };
    TimelineController.prototype.onFragParsingUserdata = function (data) {
        // push all of the CEA-708 messages into the interpreter
        // immediately. It will create the proper timestamps based on our PTS value
        if (this.enabled && this.config.enableCEA708Captions) {
            for (var i = 0; i < data.samples.length; i++) {
                var ccdatas = this.extractCea608Data(data.samples[i].bytes);
                this.cea608Parser.addData(data.samples[i].pts, ccdatas);
            }
        }
    };
    TimelineController.prototype.extractCea608Data = function (byteArray) {
        var count = byteArray[0] & 31;
        var position = 2;
        var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;
        var actualCCBytes = [];
        for (var j = 0; j < count; j++) {
            tmpByte = byteArray[position++];
            ccbyte1 = 0x7F & byteArray[position++];
            ccbyte2 = 0x7F & byteArray[position++];
            ccValid = (4 & tmpByte) !== 0;
            ccType = 3 & tmpByte;
            if (ccbyte1 === 0 && ccbyte2 === 0) {
                continue;
            }
            if (ccValid) {
                if (ccType === 0) { // || ccType === 1
                    actualCCBytes.push(ccbyte1);
                    actualCCBytes.push(ccbyte2);
                }
            }
        }
        return actualCCBytes;
    };
    return TimelineController;
}(event_handler_1.default));
exports.default = TimelineController;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/crypt/aes-crypto.js":
/*!*********************************!*\
  !*** ./src/crypt/aes-crypto.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var AESCrypto = /** @class */ (function () {
    function AESCrypto(subtle, iv) {
        this.subtle = subtle;
        this.aesIV = iv;
    }
    AESCrypto.prototype.decrypt = function (data, key) {
        return this.subtle.decrypt({ name: 'AES-CBC', iv: this.aesIV }, key, data);
    };
    return AESCrypto;
}());
exports.default = AESCrypto;


/***/ }),

/***/ "./src/crypt/aes-decryptor.js":
/*!************************************!*\
  !*** ./src/crypt/aes-decryptor.js ***!
  \************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
// PKCS7
function removePadding(buffer) {
    var outputBytes = buffer.byteLength;
    var paddingBytes = outputBytes && (new DataView(buffer)).getUint8(outputBytes - 1);
    if (paddingBytes) {
        return buffer.slice(0, outputBytes - paddingBytes);
    }
    else {
        return buffer;
    }
}
exports.removePadding = removePadding;
var AESDecryptor = /** @class */ (function () {
    function AESDecryptor() {
        // Static after running initTable
        this.rcon = [0x0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
        this.subMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
        this.invSubMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
        this.sBox = new Uint32Array(256);
        this.invSBox = new Uint32Array(256);
        // Changes during runtime
        this.key = new Uint32Array(0);
        this.initTable();
    }
    // Using view.getUint32() also swaps the byte order.
    AESDecryptor.prototype.uint8ArrayToUint32Array_ = function (arrayBuffer) {
        var view = new DataView(arrayBuffer);
        var newArray = new Uint32Array(4);
        for (var i = 0; i < 4; i++) {
            newArray[i] = view.getUint32(i * 4);
        }
        return newArray;
    };
    AESDecryptor.prototype.initTable = function () {
        var sBox = this.sBox;
        var invSBox = this.invSBox;
        var subMix = this.subMix;
        var subMix0 = subMix[0];
        var subMix1 = subMix[1];
        var subMix2 = subMix[2];
        var subMix3 = subMix[3];
        var invSubMix = this.invSubMix;
        var invSubMix0 = invSubMix[0];
        var invSubMix1 = invSubMix[1];
        var invSubMix2 = invSubMix[2];
        var invSubMix3 = invSubMix[3];
        var d = new Uint32Array(256);
        var x = 0;
        var xi = 0;
        var i = 0;
        for (i = 0; i < 256; i++) {
            if (i < 128) {
                d[i] = i << 1;
            }
            else {
                d[i] = (i << 1) ^ 0x11b;
            }
        }
        for (i = 0; i < 256; i++) {
            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
            sBox[x] = sx;
            invSBox[sx] = x;
            // Compute multiplication
            var x2 = d[x];
            var x4 = d[x2];
            var x8 = d[x4];
            // Compute sub/invSub bytes, mix columns tables
            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
            subMix0[x] = (t << 24) | (t >>> 8);
            subMix1[x] = (t << 16) | (t >>> 16);
            subMix2[x] = (t << 8) | (t >>> 24);
            subMix3[x] = t;
            // Compute inv sub bytes, inv mix columns tables
            t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
            invSubMix0[sx] = (t << 24) | (t >>> 8);
            invSubMix1[sx] = (t << 16) | (t >>> 16);
            invSubMix2[sx] = (t << 8) | (t >>> 24);
            invSubMix3[sx] = t;
            // Compute next counter
            if (!x) {
                x = xi = 1;
            }
            else {
                x = x2 ^ d[d[d[x8 ^ x2]]];
                xi ^= d[d[xi]];
            }
        }
    };
    AESDecryptor.prototype.expandKey = function (keyBuffer) {
        // convert keyBuffer to Uint32Array
        var key = this.uint8ArrayToUint32Array_(keyBuffer);
        var sameKey = true;
        var offset = 0;
        while (offset < key.length && sameKey) {
            sameKey = (key[offset] === this.key[offset]);
            offset++;
        }
        if (sameKey) {
            return;
        }
        this.key = key;
        var keySize = this.keySize = key.length;
        if (keySize !== 4 && keySize !== 6 && keySize !== 8) {
            throw new Error('Invalid aes key size=' + keySize);
        }
        var ksRows = this.ksRows = (keySize + 6 + 1) * 4;
        var ksRow;
        var invKsRow;
        var keySchedule = this.keySchedule = new Uint32Array(ksRows);
        var invKeySchedule = this.invKeySchedule = new Uint32Array(ksRows);
        var sbox = this.sBox;
        var rcon = this.rcon;
        var invSubMix = this.invSubMix;
        var invSubMix0 = invSubMix[0];
        var invSubMix1 = invSubMix[1];
        var invSubMix2 = invSubMix[2];
        var invSubMix3 = invSubMix[3];
        var prev;
        var t;
        for (ksRow = 0; ksRow < ksRows; ksRow++) {
            if (ksRow < keySize) {
                prev = keySchedule[ksRow] = key[ksRow];
                continue;
            }
            t = prev;
            if (ksRow % keySize === 0) {
                // Rot word
                t = (t << 8) | (t >>> 24);
                // Sub word
                t = (sbox[t >>> 24] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff];
                // Mix Rcon
                t ^= rcon[(ksRow / keySize) | 0] << 24;
            }
            else if (keySize > 6 && ksRow % keySize === 4) {
                // Sub word
                t = (sbox[t >>> 24] << 24) | (sbox[(t >>> 16) & 0xff] << 16) | (sbox[(t >>> 8) & 0xff] << 8) | sbox[t & 0xff];
            }
            keySchedule[ksRow] = prev = (keySchedule[ksRow - keySize] ^ t) >>> 0;
        }
        for (invKsRow = 0; invKsRow < ksRows; invKsRow++) {
            ksRow = ksRows - invKsRow;
            if (invKsRow & 3) {
                t = keySchedule[ksRow];
            }
            else {
                t = keySchedule[ksRow - 4];
            }
            if (invKsRow < 4 || ksRow <= 4) {
                invKeySchedule[invKsRow] = t;
            }
            else {
                invKeySchedule[invKsRow] = invSubMix0[sbox[t >>> 24]] ^ invSubMix1[sbox[(t >>> 16) & 0xff]] ^ invSubMix2[sbox[(t >>> 8) & 0xff]] ^ invSubMix3[sbox[t & 0xff]];
            }
            invKeySchedule[invKsRow] = invKeySchedule[invKsRow] >>> 0;
        }
    };
    // Adding this as a method greatly improves performance.
    AESDecryptor.prototype.networkToHostOrderSwap = function (word) {
        return (word << 24) | ((word & 0xff00) << 8) | ((word & 0xff0000) >> 8) | (word >>> 24);
    };
    AESDecryptor.prototype.decrypt = function (inputArrayBuffer, offset, aesIV, removePKCS7Padding) {
        var nRounds = this.keySize + 6;
        var invKeySchedule = this.invKeySchedule;
        var invSBOX = this.invSBox;
        var invSubMix = this.invSubMix;
        var invSubMix0 = invSubMix[0];
        var invSubMix1 = invSubMix[1];
        var invSubMix2 = invSubMix[2];
        var invSubMix3 = invSubMix[3];
        var initVector = this.uint8ArrayToUint32Array_(aesIV);
        var initVector0 = initVector[0];
        var initVector1 = initVector[1];
        var initVector2 = initVector[2];
        var initVector3 = initVector[3];
        var inputInt32 = new Int32Array(inputArrayBuffer);
        var outputInt32 = new Int32Array(inputInt32.length);
        var t0, t1, t2, t3;
        var s0, s1, s2, s3;
        var inputWords0, inputWords1, inputWords2, inputWords3;
        var ksRow, i;
        var swapWord = this.networkToHostOrderSwap;
        while (offset < inputInt32.length) {
            inputWords0 = swapWord(inputInt32[offset]);
            inputWords1 = swapWord(inputInt32[offset + 1]);
            inputWords2 = swapWord(inputInt32[offset + 2]);
            inputWords3 = swapWord(inputInt32[offset + 3]);
            s0 = inputWords0 ^ invKeySchedule[0];
            s1 = inputWords3 ^ invKeySchedule[1];
            s2 = inputWords2 ^ invKeySchedule[2];
            s3 = inputWords1 ^ invKeySchedule[3];
            ksRow = 4;
            // Iterate through the rounds of decryption
            for (i = 1; i < nRounds; i++) {
                t0 = invSubMix0[s0 >>> 24] ^ invSubMix1[(s1 >> 16) & 0xff] ^ invSubMix2[(s2 >> 8) & 0xff] ^ invSubMix3[s3 & 0xff] ^ invKeySchedule[ksRow];
                t1 = invSubMix0[s1 >>> 24] ^ invSubMix1[(s2 >> 16) & 0xff] ^ invSubMix2[(s3 >> 8) & 0xff] ^ invSubMix3[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
                t2 = invSubMix0[s2 >>> 24] ^ invSubMix1[(s3 >> 16) & 0xff] ^ invSubMix2[(s0 >> 8) & 0xff] ^ invSubMix3[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
                t3 = invSubMix0[s3 >>> 24] ^ invSubMix1[(s0 >> 16) & 0xff] ^ invSubMix2[(s1 >> 8) & 0xff] ^ invSubMix3[s2 & 0xff] ^ invKeySchedule[ksRow + 3];
                // Update state
                s0 = t0;
                s1 = t1;
                s2 = t2;
                s3 = t3;
                ksRow = ksRow + 4;
            }
            // Shift rows, sub bytes, add round key
            t0 = ((invSBOX[s0 >>> 24] << 24) ^ (invSBOX[(s1 >> 16) & 0xff] << 16) ^ (invSBOX[(s2 >> 8) & 0xff] << 8) ^ invSBOX[s3 & 0xff]) ^ invKeySchedule[ksRow];
            t1 = ((invSBOX[s1 >>> 24] << 24) ^ (invSBOX[(s2 >> 16) & 0xff] << 16) ^ (invSBOX[(s3 >> 8) & 0xff] << 8) ^ invSBOX[s0 & 0xff]) ^ invKeySchedule[ksRow + 1];
            t2 = ((invSBOX[s2 >>> 24] << 24) ^ (invSBOX[(s3 >> 16) & 0xff] << 16) ^ (invSBOX[(s0 >> 8) & 0xff] << 8) ^ invSBOX[s1 & 0xff]) ^ invKeySchedule[ksRow + 2];
            t3 = ((invSBOX[s3 >>> 24] << 24) ^ (invSBOX[(s0 >> 16) & 0xff] << 16) ^ (invSBOX[(s1 >> 8) & 0xff] << 8) ^ invSBOX[s2 & 0xff]) ^ invKeySchedule[ksRow + 3];
            ksRow = ksRow + 3;
            // Write
            outputInt32[offset] = swapWord(t0 ^ initVector0);
            outputInt32[offset + 1] = swapWord(t3 ^ initVector1);
            outputInt32[offset + 2] = swapWord(t2 ^ initVector2);
            outputInt32[offset + 3] = swapWord(t1 ^ initVector3);
            // reset initVector to last 4 unsigned int
            initVector0 = inputWords0;
            initVector1 = inputWords1;
            initVector2 = inputWords2;
            initVector3 = inputWords3;
            offset = offset + 4;
        }
        return removePKCS7Padding ? removePadding(outputInt32.buffer) : outputInt32.buffer;
    };
    AESDecryptor.prototype.destroy = function () {
        this.key = undefined;
        this.keySize = undefined;
        this.ksRows = undefined;
        this.sBox = undefined;
        this.invSBox = undefined;
        this.subMix = undefined;
        this.invSubMix = undefined;
        this.keySchedule = undefined;
        this.invKeySchedule = undefined;
        this.rcon = undefined;
    };
    return AESDecryptor;
}());
exports.default = AESDecryptor;


/***/ }),

/***/ "./src/crypt/decrypter.js":
/*!********************************!*\
  !*** ./src/crypt/decrypter.js ***!
  \********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var aes_crypto_1 = __webpack_require__(/*! ./aes-crypto */ "./src/crypt/aes-crypto.js");
var fast_aes_key_1 = __webpack_require__(/*! ./fast-aes-key */ "./src/crypt/fast-aes-key.js");
var aes_decryptor_1 = __webpack_require__(/*! ./aes-decryptor */ "./src/crypt/aes-decryptor.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var get_self_scope_1 = __webpack_require__(/*! ../utils/get-self-scope */ "./src/utils/get-self-scope.js");
// see https://stackoverflow.com/a/11237259/589493
var global = get_self_scope_1.getSelfScope(); // safeguard for code that might run both on worker and main thread
var Decrypter = /** @class */ (function () {
    function Decrypter(observer, config, _a) {
        var _b = (_a === void 0 ? {} : _a).removePKCS7Padding, removePKCS7Padding = _b === void 0 ? true : _b;
        this.logEnabled = true;
        this.observer = observer;
        this.config = config;
        this.removePKCS7Padding = removePKCS7Padding;
        // built in decryptor expects PKCS7 padding
        if (removePKCS7Padding) {
            try {
                var browserCrypto = global.crypto;
                if (browserCrypto) {
                    this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
                }
            }
            catch (e) { }
        }
        this.disableWebCrypto = !this.subtle;
    }
    Decrypter.prototype.isSync = function () {
        return (this.disableWebCrypto && this.config.enableSoftwareAES);
    };
    Decrypter.prototype.decrypt = function (data, key, iv, callback) {
        var _this = this;
        if (this.disableWebCrypto && this.config.enableSoftwareAES) {
            if (this.logEnabled) {
                logger_1.logger.log('JS AES decrypt');
                this.logEnabled = false;
            }
            var decryptor = this.decryptor;
            if (!decryptor) {
                this.decryptor = decryptor = new aes_decryptor_1.default();
            }
            decryptor.expandKey(key);
            callback(decryptor.decrypt(data, 0, iv, this.removePKCS7Padding));
        }
        else {
            if (this.logEnabled) {
                logger_1.logger.log('WebCrypto AES decrypt');
                this.logEnabled = false;
            }
            var subtle_1 = this.subtle;
            if (this.key !== key) {
                this.key = key;
                this.fastAesKey = new fast_aes_key_1.default(subtle_1, key);
            }
            this.fastAesKey.expandKey()
                .then(function (aesKey) {
                // decrypt using web crypto
                var crypto = new aes_crypto_1.default(subtle_1, iv);
                crypto.decrypt(data, aesKey)
                    .catch(function (err) {
                    _this.onWebCryptoError(err, data, key, iv, callback);
                })
                    .then(function (result) {
                    callback(result);
                });
            })
                .catch(function (err) {
                _this.onWebCryptoError(err, data, key, iv, callback);
            });
        }
    };
    Decrypter.prototype.onWebCryptoError = function (err, data, key, iv, callback) {
        if (this.config.enableSoftwareAES) {
            logger_1.logger.log('WebCrypto Error, disable WebCrypto API');
            this.disableWebCrypto = true;
            this.logEnabled = true;
            this.decrypt(data, key, iv, callback);
        }
        else {
            logger_1.logger.error("decrypting error : " + err.message);
            this.observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.FRAG_DECRYPT_ERROR, fatal: true, reason: err.message });
        }
    };
    Decrypter.prototype.destroy = function () {
        var decryptor = this.decryptor;
        if (decryptor) {
            decryptor.destroy();
            this.decryptor = undefined;
        }
    };
    return Decrypter;
}());
exports.default = Decrypter;


/***/ }),

/***/ "./src/crypt/fast-aes-key.js":
/*!***********************************!*\
  !*** ./src/crypt/fast-aes-key.js ***!
  \***********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var FastAESKey = /** @class */ (function () {
    function FastAESKey(subtle, key) {
        this.subtle = subtle;
        this.key = key;
    }
    FastAESKey.prototype.expandKey = function () {
        return this.subtle.importKey('raw', this.key, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
    };
    return FastAESKey;
}());
exports.default = FastAESKey;


/***/ }),

/***/ "./src/demux/aacdemuxer.js":
/*!*********************************!*\
  !*** ./src/demux/aacdemuxer.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * AAC demuxer
 */
var ADTS = __webpack_require__(/*! ./adts */ "./src/demux/adts.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var id3_1 = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.js");
var AACDemuxer = /** @class */ (function () {
    function AACDemuxer(observer, remuxer, config) {
        this.observer = observer;
        this.config = config;
        this.remuxer = remuxer;
    }
    AACDemuxer.prototype.resetInitSegment = function (initSegment, audioCodec, videoCodec, duration) {
        this._audioTrack = { container: 'audio/adts', type: 'audio', id: 0, sequenceNumber: 0, isAAC: true, samples: [], len: 0, manifestCodec: audioCodec, duration: duration, inputTimeScale: 90000 };
    };
    AACDemuxer.prototype.resetTimeStamp = function () {
    };
    AACDemuxer.probe = function (data) {
        if (!data) {
            return false;
        }
        // Check for the ADTS sync word
        // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
        // Layer bits (position 14 and 15) in header should be always 0 for ADTS
        // More info https://wiki.multimedia.cx/index.php?title=ADTS
        var id3Data = id3_1.default.getID3Data(data, 0) || [];
        var offset = id3Data.length;
        for (var length_1 = data.length; offset < length_1; offset++) {
            if (ADTS.probe(data, offset)) {
                logger_1.logger.log('ADTS sync word found !');
                return true;
            }
        }
        return false;
    };
    // feed incoming data to the front of the parsing pipeline
    AACDemuxer.prototype.append = function (data, timeOffset, contiguous, accurateTimeOffset) {
        var track = this._audioTrack;
        var id3Data = id3_1.default.getID3Data(data, 0) || [];
        var timestamp = id3_1.default.getTimeStamp(id3Data);
        var pts = Number.isFinite(timestamp) ? timestamp * 90 : timeOffset * 90000;
        var frameIndex = 0;
        var stamp = pts;
        var length = data.length;
        var offset = id3Data.length;
        var id3Samples = [{ pts: stamp, dts: stamp, data: id3Data }];
        while (offset < length - 1) {
            if (ADTS.isHeader(data, offset) && (offset + 5) < length) {
                ADTS.initTrackConfig(track, this.observer, data, offset, track.manifestCodec);
                var frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
                if (frame) {
                    offset += frame.length;
                    stamp = frame.sample.pts;
                    frameIndex++;
                }
                else {
                    logger_1.logger.log('Unable to parse AAC frame');
                    break;
                }
            }
            else if (id3_1.default.isHeader(data, offset)) {
                id3Data = id3_1.default.getID3Data(data, offset);
                id3Samples.push({ pts: stamp, dts: stamp, data: id3Data });
                offset += id3Data.length;
            }
            else {
                // nothing found, keep looking
                offset++;
            }
        }
        this.remuxer.remux(track, { samples: [] }, { samples: id3Samples, inputTimeScale: 90000 }, { samples: [] }, timeOffset, contiguous, accurateTimeOffset);
    };
    AACDemuxer.prototype.destroy = function () {
    };
    return AACDemuxer;
}());
exports.default = AACDemuxer;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/demux/adts.js":
/*!***************************!*\
  !*** ./src/demux/adts.js ***!
  \***************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 *  ADTS parser helper
 */
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
function getAudioConfig(observer, data, offset, audioCodec) {
    var adtsObjectType, // :int
    adtsSampleingIndex, // :int
    adtsExtensionSampleingIndex, // :int
    adtsChanelConfig, // :int
    config, userAgent = navigator.userAgent.toLowerCase(), manifestCodec = audioCodec, adtsSampleingRates = [
        96000, 88200,
        64000, 48000,
        44100, 32000,
        24000, 22050,
        16000, 12000,
        11025, 8000,
        7350
    ];
    // byte 2
    adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
    adtsSampleingIndex = ((data[offset + 2] & 0x3C) >>> 2);
    if (adtsSampleingIndex > adtsSampleingRates.length - 1) {
        observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: "invalid ADTS sampling index:" + adtsSampleingIndex });
        return;
    }
    adtsChanelConfig = ((data[offset + 2] & 0x01) << 2);
    // byte 3
    adtsChanelConfig |= ((data[offset + 3] & 0xC0) >>> 6);
    logger_1.logger.log("manifest codec:" + audioCodec + ",ADTS data:type:" + adtsObjectType + ",sampleingIndex:" + adtsSampleingIndex + "[" + adtsSampleingRates[adtsSampleingIndex] + "Hz],channelConfig:" + adtsChanelConfig);
    // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
    if (/firefox/i.test(userAgent)) {
        if (adtsSampleingIndex >= 6) {
            adtsObjectType = 5;
            config = new Array(4);
            // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
            // there is a factor 2 between frame sample rate and output sample rate
            // multiply frequency by 2 (see table below, equivalent to substract 3)
            adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
        }
        else {
            adtsObjectType = 2;
            config = new Array(2);
            adtsExtensionSampleingIndex = adtsSampleingIndex;
        }
        // Android : always use AAC
    }
    else if (userAgent.indexOf('android') !== -1) {
        adtsObjectType = 2;
        config = new Array(2);
        adtsExtensionSampleingIndex = adtsSampleingIndex;
    }
    else {
        /*  for other browsers (Chrome/Vivaldi/Opera ...)
            always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
        */
        adtsObjectType = 5;
        config = new Array(4);
        // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
        if ((audioCodec && ((audioCodec.indexOf('mp4a.40.29') !== -1) ||
            (audioCodec.indexOf('mp4a.40.5') !== -1))) ||
            (!audioCodec && adtsSampleingIndex >= 6)) {
            // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
            // there is a factor 2 between frame sample rate and output sample rate
            // multiply frequency by 2 (see table below, equivalent to substract 3)
            adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
        }
        else {
            // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
            // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
            if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && ((adtsSampleingIndex >= 6 && adtsChanelConfig === 1) ||
                /vivaldi/i.test(userAgent)) ||
                (!audioCodec && adtsChanelConfig === 1)) {
                adtsObjectType = 2;
                config = new Array(2);
            }
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
    config[0] |= (adtsSampleingIndex & 0x0E) >> 1;
    config[1] |= (adtsSampleingIndex & 0x01) << 7;
    // channelConfiguration
    config[1] |= adtsChanelConfig << 3;
    if (adtsObjectType === 5) {
        // adtsExtensionSampleingIndex
        config[1] |= (adtsExtensionSampleingIndex & 0x0E) >> 1;
        config[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
        // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
        //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
        config[2] |= 2 << 2;
        config[3] = 0;
    }
    return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: ('mp4a.40.' + adtsObjectType), manifestCodec: manifestCodec };
}
exports.getAudioConfig = getAudioConfig;
function isHeaderPattern(data, offset) {
    return data[offset] === 0xff && (data[offset + 1] & 0xf6) === 0xf0;
}
exports.isHeaderPattern = isHeaderPattern;
function getHeaderLength(data, offset) {
    return (data[offset + 1] & 0x01 ? 7 : 9);
}
exports.getHeaderLength = getHeaderLength;
function getFullFrameLength(data, offset) {
    return ((data[offset + 3] & 0x03) << 11) |
        (data[offset + 4] << 3) |
        ((data[offset + 5] & 0xE0) >>> 5);
}
exports.getFullFrameLength = getFullFrameLength;
function isHeader(data, offset) {
    // Look for ADTS header | 1111 1111 | 1111 X00X | where X can be either 0 or 1
    // Layer bits (position 14 and 15) in header should be always 0 for ADTS
    // More info https://wiki.multimedia.cx/index.php?title=ADTS
    if (offset + 1 < data.length && isHeaderPattern(data, offset)) {
        return true;
    }
    return false;
}
exports.isHeader = isHeader;
function probe(data, offset) {
    // same as isHeader but we also check that ADTS frame follows last ADTS frame
    // or end of data is reached
    if (offset + 1 < data.length && isHeaderPattern(data, offset)) {
        // ADTS header Length
        var headerLength = getHeaderLength(data, offset);
        // ADTS frame Length
        var frameLength = headerLength;
        if (offset + 5 < data.length) {
            frameLength = getFullFrameLength(data, offset);
        }
        var newOffset = offset + frameLength;
        if (newOffset === data.length || (newOffset + 1 < data.length && isHeaderPattern(data, newOffset))) {
            return true;
        }
    }
    return false;
}
exports.probe = probe;
function initTrackConfig(track, observer, data, offset, audioCodec) {
    if (!track.samplerate) {
        var config = getAudioConfig(observer, data, offset, audioCodec);
        track.config = config.config;
        track.samplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.manifestCodec = config.manifestCodec;
        logger_1.logger.log("parsed codec:" + track.codec + ",rate:" + config.samplerate + ",nb channel:" + config.channelCount);
    }
}
exports.initTrackConfig = initTrackConfig;
function getFrameDuration(samplerate) {
    return 1024 * 90000 / samplerate;
}
exports.getFrameDuration = getFrameDuration;
function parseFrameHeader(data, offset, pts, frameIndex, frameDuration) {
    var headerLength, frameLength, stamp;
    var length = data.length;
    // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
    headerLength = getHeaderLength(data, offset);
    // retrieve frame size
    frameLength = getFullFrameLength(data, offset);
    frameLength -= headerLength;
    if ((frameLength > 0) && ((offset + headerLength + frameLength) <= length)) {
        stamp = pts + frameIndex * frameDuration;
        // logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
        return { headerLength: headerLength, frameLength: frameLength, stamp: stamp };
    }
    return undefined;
}
exports.parseFrameHeader = parseFrameHeader;
function appendFrame(track, data, offset, pts, frameIndex) {
    var frameDuration = getFrameDuration(track.samplerate);
    var header = parseFrameHeader(data, offset, pts, frameIndex, frameDuration);
    if (header) {
        var stamp = header.stamp;
        var headerLength = header.headerLength;
        var frameLength = header.frameLength;
        // logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
        var aacSample = {
            unit: data.subarray(offset + headerLength, offset + headerLength + frameLength),
            pts: stamp,
            dts: stamp
        };
        track.samples.push(aacSample);
        track.len += frameLength;
        return { sample: aacSample, length: frameLength + headerLength };
    }
    return undefined;
}
exports.appendFrame = appendFrame;


/***/ }),

/***/ "./src/demux/demuxer-inline.js":
/*!*************************************!*\
  !*** ./src/demux/demuxer-inline.js ***!
  \*************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 *
 * inline demuxer: probe fragments and instantiate
 * appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var decrypter_1 = __webpack_require__(/*! ../crypt/decrypter */ "./src/crypt/decrypter.js");
var aacdemuxer_1 = __webpack_require__(/*! ../demux/aacdemuxer */ "./src/demux/aacdemuxer.js");
var mp4demuxer_1 = __webpack_require__(/*! ../demux/mp4demuxer */ "./src/demux/mp4demuxer.js");
var tsdemuxer_1 = __webpack_require__(/*! ../demux/tsdemuxer */ "./src/demux/tsdemuxer.js");
var mp3demuxer_1 = __webpack_require__(/*! ../demux/mp3demuxer */ "./src/demux/mp3demuxer.js");
var mp4_remuxer_1 = __webpack_require__(/*! ../remux/mp4-remuxer */ "./src/remux/mp4-remuxer.js");
var passthrough_remuxer_1 = __webpack_require__(/*! ../remux/passthrough-remuxer */ "./src/remux/passthrough-remuxer.js");
var get_self_scope_1 = __webpack_require__(/*! ../utils/get-self-scope */ "./src/utils/get-self-scope.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
// see https://stackoverflow.com/a/11237259/589493
var global = get_self_scope_1.getSelfScope(); // safeguard for code that might run both on worker and main thread
var now;
// performance.now() not available on WebWorker, at least on Safari Desktop
try {
    now = global.performance.now.bind(global.performance);
}
catch (err) {
    logger_1.logger.debug('Unable to use Performance API on this environment');
    now = global.Date.now;
}
var DemuxerInline = /** @class */ (function () {
    function DemuxerInline(observer, typeSupported, config, vendor) {
        this.observer = observer;
        this.typeSupported = typeSupported;
        this.config = config;
        this.vendor = vendor;
    }
    DemuxerInline.prototype.destroy = function () {
        var demuxer = this.demuxer;
        if (demuxer) {
            demuxer.destroy();
        }
    };
    DemuxerInline.prototype.push = function (data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS) {
        var _this = this;
        if ((data.byteLength > 0) && (decryptdata != null) && (decryptdata.key != null) && (decryptdata.method === 'AES-128')) {
            var decrypter = this.decrypter;
            if (decrypter == null) {
                decrypter = this.decrypter = new decrypter_1.default(this.observer, this.config);
            }
            var startTime_1 = now();
            decrypter.decrypt(data, decryptdata.key.buffer, decryptdata.iv.buffer, function (decryptedData) {
                var endTime = now();
                _this.observer.trigger(events_1.default.FRAG_DECRYPTED, { stats: { tstart: startTime_1, tdecrypt: endTime } });
                _this.pushDecrypted(new Uint8Array(decryptedData), decryptdata, new Uint8Array(initSegment), audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
            });
        }
        else {
            this.pushDecrypted(new Uint8Array(data), decryptdata, new Uint8Array(initSegment), audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
        }
    };
    DemuxerInline.prototype.pushDecrypted = function (data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS) {
        var demuxer = this.demuxer;
        if (!demuxer ||
            // in case of continuity change, or track switch
            // we might switch from content type (AAC container to TS container, or TS to fmp4 for example)
            // so let's check that current demuxer is still valid
            ((discontinuity || trackSwitch) && !this.probe(data))) {
            var observer = this.observer;
            var typeSupported = this.typeSupported;
            var config = this.config;
            // probing order is TS/AAC/MP3/MP4
            var muxConfig = [
                { demux: tsdemuxer_1.default, remux: mp4_remuxer_1.default },
                { demux: mp4demuxer_1.default, remux: passthrough_remuxer_1.default },
                { demux: aacdemuxer_1.default, remux: mp4_remuxer_1.default },
                { demux: mp3demuxer_1.default, remux: mp4_remuxer_1.default }
            ];
            // probe for content type
            for (var i = 0, len = muxConfig.length; i < len; i++) {
                var mux = muxConfig[i];
                var probe = mux.demux.probe;
                if (probe(data)) {
                    var remuxer_1 = this.remuxer = new mux.remux(observer, config, typeSupported, this.vendor);
                    demuxer = new mux.demux(observer, remuxer_1, config, typeSupported);
                    this.probe = probe;
                    break;
                }
            }
            if (!demuxer) {
                observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
                return;
            }
            this.demuxer = demuxer;
        }
        var remuxer = this.remuxer;
        if (discontinuity || trackSwitch) {
            demuxer.resetInitSegment(initSegment, audioCodec, videoCodec, duration);
            remuxer.resetInitSegment();
        }
        if (discontinuity) {
            demuxer.resetTimeStamp(defaultInitPTS);
            remuxer.resetTimeStamp(defaultInitPTS);
        }
        if (typeof demuxer.setDecryptData === 'function') {
            demuxer.setDecryptData(decryptdata);
        }
        demuxer.append(data, timeOffset, contiguous, accurateTimeOffset);
    };
    return DemuxerInline;
}());
exports.default = DemuxerInline;


/***/ }),

/***/ "./src/demux/demuxer-worker.js":
/*!*************************************!*\
  !*** ./src/demux/demuxer-worker.js ***!
  \*************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/* demuxer web worker.
 *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
 *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var demuxer_inline_1 = __webpack_require__(/*! ../demux/demuxer-inline */ "./src/demux/demuxer-inline.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var events_2 = __webpack_require__(/*! events */ "./node_modules/node-libs-browser/node_modules/events/events.js");
var DemuxerWorker = function (self) {
    // observer setup
    var observer = new events_2.EventEmitter();
    observer.trigger = function trigger(event) {
        var data = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            data[_i - 1] = arguments[_i];
        }
        observer.emit.apply(observer, [event, event].concat(data));
    };
    observer.off = function off(event) {
        var data = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            data[_i - 1] = arguments[_i];
        }
        observer.removeListener.apply(observer, [event].concat(data));
    };
    var forwardMessage = function (ev, data) {
        self.postMessage({ event: ev, data: data });
    };
    self.addEventListener('message', function (ev) {
        var data = ev.data;
        // console.log('demuxer cmd:' + data.cmd);
        switch (data.cmd) {
            case 'init':
                var config = JSON.parse(data.config);
                self.demuxer = new demuxer_inline_1.default(observer, data.typeSupported, config, data.vendor);
                logger_1.enableLogs(config.debug);
                // signal end of worker init
                forwardMessage('init', null);
                break;
            case 'demux':
                self.demuxer.push(data.data, data.decryptdata, data.initSegment, data.audioCodec, data.videoCodec, data.timeOffset, data.discontinuity, data.trackSwitch, data.contiguous, data.duration, data.accurateTimeOffset, data.defaultInitPTS);
                break;
            default:
                break;
        }
    });
    // forward events to main thread
    observer.on(events_1.default.FRAG_DECRYPTED, forwardMessage);
    observer.on(events_1.default.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
    observer.on(events_1.default.FRAG_PARSED, forwardMessage);
    observer.on(events_1.default.ERROR, forwardMessage);
    observer.on(events_1.default.FRAG_PARSING_METADATA, forwardMessage);
    observer.on(events_1.default.FRAG_PARSING_USERDATA, forwardMessage);
    observer.on(events_1.default.INIT_PTS_FOUND, forwardMessage);
    // special case for FRAG_PARSING_DATA: pass data1/data2 as transferable object (no copy)
    observer.on(events_1.default.FRAG_PARSING_DATA, function (ev, data) {
        var transferable = [];
        var message = { event: ev, data: data };
        if (data.data1) {
            message.data1 = data.data1.buffer;
            transferable.push(data.data1.buffer);
            delete data.data1;
        }
        if (data.data2) {
            message.data2 = data.data2.buffer;
            transferable.push(data.data2.buffer);
            delete data.data2;
        }
        self.postMessage(message, transferable);
    });
};
exports.default = DemuxerWorker;


/***/ }),

/***/ "./src/demux/demuxer.js":
/*!******************************!*\
  !*** ./src/demux/demuxer.js ***!
  \******************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var work = __webpack_require__(/*! webworkify-webpack */ "./node_modules/webworkify-webpack/index.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var demuxer_inline_1 = __webpack_require__(/*! ../demux/demuxer-inline */ "./src/demux/demuxer-inline.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var mediasource_helper_1 = __webpack_require__(/*! ../utils/mediasource-helper */ "./src/utils/mediasource-helper.js");
var get_self_scope_1 = __webpack_require__(/*! ../utils/get-self-scope */ "./src/utils/get-self-scope.js");
var observer_1 = __webpack_require__(/*! ../observer */ "./src/observer.js");
// see https://stackoverflow.com/a/11237259/589493
var global = get_self_scope_1.getSelfScope(); // safeguard for code that might run both on worker and main thread
var MediaSource = mediasource_helper_1.getMediaSource();
var Demuxer = /** @class */ (function () {
    function Demuxer(hls, id) {
        var _this = this;
        this.hls = hls;
        this.id = id;
        var observer = this.observer = new observer_1.Observer();
        var config = hls.config;
        var forwardMessage = function (ev, data) {
            data = data || {};
            data.frag = _this.frag;
            data.id = _this.id;
            hls.trigger(ev, data);
        };
        // forward events to main thread
        observer.on(events_1.default.FRAG_DECRYPTED, forwardMessage);
        observer.on(events_1.default.FRAG_PARSING_INIT_SEGMENT, forwardMessage);
        observer.on(events_1.default.FRAG_PARSING_DATA, forwardMessage);
        observer.on(events_1.default.FRAG_PARSED, forwardMessage);
        observer.on(events_1.default.ERROR, forwardMessage);
        observer.on(events_1.default.FRAG_PARSING_METADATA, forwardMessage);
        observer.on(events_1.default.FRAG_PARSING_USERDATA, forwardMessage);
        observer.on(events_1.default.INIT_PTS_FOUND, forwardMessage);
        var typeSupported = {
            mp4: MediaSource.isTypeSupported('video/mp4'),
            mpeg: MediaSource.isTypeSupported('audio/mpeg'),
            mp3: MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
        };
        // navigator.vendor is not always available in Web Worker
        // refer to https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/navigator
        var vendor = navigator.vendor;
        if (config.enableWorker && (typeof (Worker) !== 'undefined')) {
            logger_1.logger.log('demuxing in webworker');
            var w = void 0;
            try {
                w = this.w = work(/*require.resolve*/(/*! ../demux/demuxer-worker.js */ "./src/demux/demuxer-worker.js"));
                this.onwmsg = this.onWorkerMessage.bind(this);
                w.addEventListener('message', this.onwmsg);
                w.onerror = function (event) {
                    hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.OTHER_ERROR, details: errors_1.ErrorDetails.INTERNAL_EXCEPTION, fatal: true, event: 'demuxerWorker', err: { message: event.message + ' (' + event.filename + ':' + event.lineno + ')' } });
                };
                w.postMessage({ cmd: 'init', typeSupported: typeSupported, vendor: vendor, id: id, config: JSON.stringify(config) });
            }
            catch (err) {
                logger_1.logger.warn('Error in worker:', err);
                logger_1.logger.error('Error while initializing DemuxerWorker, fallback on DemuxerInline');
                if (w) {
                    // revoke the Object URL that was used to create demuxer worker, so as not to leak it
                    global.URL.revokeObjectURL(w.objectURL);
                }
                this.demuxer = new demuxer_inline_1.default(observer, typeSupported, config, vendor);
                this.w = undefined;
            }
        }
        else {
            this.demuxer = new demuxer_inline_1.default(observer, typeSupported, config, vendor);
        }
    }
    Demuxer.prototype.destroy = function () {
        var w = this.w;
        if (w) {
            w.removeEventListener('message', this.onwmsg);
            w.terminate();
            this.w = null;
        }
        else {
            var demuxer = this.demuxer;
            if (demuxer) {
                demuxer.destroy();
                this.demuxer = null;
            }
        }
        var observer = this.observer;
        if (observer) {
            observer.removeAllListeners();
            this.observer = null;
        }
    };
    Demuxer.prototype.push = function (data, initSegment, audioCodec, videoCodec, frag, duration, accurateTimeOffset, defaultInitPTS) {
        var w = this.w;
        var timeOffset = Number.isFinite(frag.startPTS) ? frag.startPTS : frag.start;
        var decryptdata = frag.decryptdata;
        var lastFrag = this.frag;
        var discontinuity = !(lastFrag && (frag.cc === lastFrag.cc));
        var trackSwitch = !(lastFrag && (frag.level === lastFrag.level));
        var nextSN = lastFrag && (frag.sn === (lastFrag.sn + 1));
        var contiguous = !trackSwitch && nextSN;
        if (discontinuity) {
            logger_1.logger.log(this.id + ":discontinuity detected");
        }
        if (trackSwitch) {
            logger_1.logger.log(this.id + ":switch detected");
        }
        this.frag = frag;
        if (w) {
            // post fragment payload as transferable objects for ArrayBuffer (no copy)
            w.postMessage({ cmd: 'demux', data: data, decryptdata: decryptdata, initSegment: initSegment, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, discontinuity: discontinuity, trackSwitch: trackSwitch, contiguous: contiguous, duration: duration, accurateTimeOffset: accurateTimeOffset, defaultInitPTS: defaultInitPTS }, data instanceof ArrayBuffer ? [data] : []);
        }
        else {
            var demuxer = this.demuxer;
            if (demuxer) {
                demuxer.push(data, decryptdata, initSegment, audioCodec, videoCodec, timeOffset, discontinuity, trackSwitch, contiguous, duration, accurateTimeOffset, defaultInitPTS);
            }
        }
    };
    Demuxer.prototype.onWorkerMessage = function (ev) {
        var data = ev.data, hls = this.hls;
        switch (data.event) {
            case 'init':
                // revoke the Object URL that was used to create demuxer worker, so as not to leak it
                global.URL.revokeObjectURL(this.w.objectURL);
                break;
            // special case for FRAG_PARSING_DATA: data1 and data2 are transferable objects
            case events_1.default.FRAG_PARSING_DATA:
                data.data.data1 = new Uint8Array(data.data1);
                if (data.data2) {
                    data.data.data2 = new Uint8Array(data.data2);
                }
            /* falls through */
            default:
                data.data = data.data || {};
                data.data.frag = this.frag;
                data.data.id = this.id;
                hls.trigger(data.event, data.data);
                break;
        }
    };
    return Demuxer;
}());
exports.default = Demuxer;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/demux/exp-golomb.js":
/*!*********************************!*\
  !*** ./src/demux/exp-golomb.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
*/
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var ExpGolomb = /** @class */ (function () {
    function ExpGolomb(data) {
        this.data = data;
        // the number of bytes left to examine in this.data
        this.bytesAvailable = data.byteLength;
        // the current word being examined
        this.word = 0; // :uint
        // the number of bits left to examine in the current word
        this.bitsAvailable = 0; // :uint
    }
    // ():void
    ExpGolomb.prototype.loadWord = function () {
        var data = this.data, bytesAvailable = this.bytesAvailable, position = data.byteLength - bytesAvailable, workingBytes = new Uint8Array(4), availableBytes = Math.min(4, bytesAvailable);
        if (availableBytes === 0) {
            throw new Error('no bytes available');
        }
        workingBytes.set(data.subarray(position, position + availableBytes));
        this.word = new DataView(workingBytes.buffer).getUint32(0);
        // track the amount of this.data that has been processed
        this.bitsAvailable = availableBytes * 8;
        this.bytesAvailable -= availableBytes;
    };
    // (count:int):void
    ExpGolomb.prototype.skipBits = function (count) {
        var skipBytes; // :int
        if (this.bitsAvailable > count) {
            this.word <<= count;
            this.bitsAvailable -= count;
        }
        else {
            count -= this.bitsAvailable;
            skipBytes = count >> 3;
            count -= (skipBytes >> 3);
            this.bytesAvailable -= skipBytes;
            this.loadWord();
            this.word <<= count;
            this.bitsAvailable -= count;
        }
    };
    // (size:int):uint
    ExpGolomb.prototype.readBits = function (size) {
        var bits = Math.min(this.bitsAvailable, size), // :uint
        valu = this.word >>> (32 - bits); // :uint
        if (size > 32) {
            logger_1.logger.error('Cannot read more than 32 bits at a time');
        }
        this.bitsAvailable -= bits;
        if (this.bitsAvailable > 0) {
            this.word <<= bits;
        }
        else if (this.bytesAvailable > 0) {
            this.loadWord();
        }
        bits = size - bits;
        if (bits > 0 && this.bitsAvailable) {
            return valu << bits | this.readBits(bits);
        }
        else {
            return valu;
        }
    };
    // ():uint
    ExpGolomb.prototype.skipLZ = function () {
        var leadingZeroCount; // :uint
        for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
            if ((this.word & (0x80000000 >>> leadingZeroCount)) !== 0) {
                // the first bit of working word is 1
                this.word <<= leadingZeroCount;
                this.bitsAvailable -= leadingZeroCount;
                return leadingZeroCount;
            }
        }
        // we exhausted word and still have not found a 1
        this.loadWord();
        return leadingZeroCount + this.skipLZ();
    };
    // ():void
    ExpGolomb.prototype.skipUEG = function () {
        this.skipBits(1 + this.skipLZ());
    };
    // ():void
    ExpGolomb.prototype.skipEG = function () {
        this.skipBits(1 + this.skipLZ());
    };
    // ():uint
    ExpGolomb.prototype.readUEG = function () {
        var clz = this.skipLZ(); // :uint
        return this.readBits(clz + 1) - 1;
    };
    // ():int
    ExpGolomb.prototype.readEG = function () {
        var valu = this.readUEG(); // :int
        if (0x01 & valu) {
            // the number is odd if the low order bit is set
            return (1 + valu) >>> 1; // add 1 to make it even, and divide by 2
        }
        else {
            return -1 * (valu >>> 1); // divide by two then make it negative
        }
    };
    // Some convenience functions
    // :Boolean
    ExpGolomb.prototype.readBoolean = function () {
        return this.readBits(1) === 1;
    };
    // ():int
    ExpGolomb.prototype.readUByte = function () {
        return this.readBits(8);
    };
    // ():int
    ExpGolomb.prototype.readUShort = function () {
        return this.readBits(16);
    };
    // ():int
    ExpGolomb.prototype.readUInt = function () {
        return this.readBits(32);
    };
    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */
    ExpGolomb.prototype.skipScalingList = function (count) {
        var lastScale = 8, nextScale = 8, j, deltaScale;
        for (j = 0; j < count; j++) {
            if (nextScale !== 0) {
                deltaScale = this.readEG();
                nextScale = (lastScale + deltaScale + 256) % 256;
            }
            lastScale = (nextScale === 0) ? lastScale : nextScale;
        }
    };
    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */
    ExpGolomb.prototype.readSPS = function () {
        var frameCropLeftOffset = 0, frameCropRightOffset = 0, frameCropTopOffset = 0, frameCropBottomOffset = 0, profileIdc, profileCompat, levelIdc, numRefFramesInPicOrderCntCycle, picWidthInMbsMinus1, picHeightInMapUnitsMinus1, frameMbsOnlyFlag, scalingListCount, i, readUByte = this.readUByte.bind(this), readBits = this.readBits.bind(this), readUEG = this.readUEG.bind(this), readBoolean = this.readBoolean.bind(this), skipBits = this.skipBits.bind(this), skipEG = this.skipEG.bind(this), skipUEG = this.skipUEG.bind(this), skipScalingList = this.skipScalingList.bind(this);
        readUByte();
        profileIdc = readUByte(); // profile_idc
        profileCompat = readBits(5); // constraint_set[0-4]_flag, u(5)
        skipBits(3); // reserved_zero_3bits u(3),
        levelIdc = readUByte(); // level_idc u(8)
        skipUEG(); // seq_parameter_set_id
        // some profiles have more optional data we don't need
        if (profileIdc === 100 ||
            profileIdc === 110 ||
            profileIdc === 122 ||
            profileIdc === 244 ||
            profileIdc === 44 ||
            profileIdc === 83 ||
            profileIdc === 86 ||
            profileIdc === 118 ||
            profileIdc === 128) {
            var chromaFormatIdc = readUEG();
            if (chromaFormatIdc === 3) {
                skipBits(1);
            } // separate_colour_plane_flag
            skipUEG(); // bit_depth_luma_minus8
            skipUEG(); // bit_depth_chroma_minus8
            skipBits(1); // qpprime_y_zero_transform_bypass_flag
            if (readBoolean()) { // seq_scaling_matrix_present_flag
                scalingListCount = (chromaFormatIdc !== 3) ? 8 : 12;
                for (i = 0; i < scalingListCount; i++) {
                    if (readBoolean()) { // seq_scaling_list_present_flag[ i ]
                        if (i < 6) {
                            skipScalingList(16);
                        }
                        else {
                            skipScalingList(64);
                        }
                    }
                }
            }
        }
        skipUEG(); // log2_max_frame_num_minus4
        var picOrderCntType = readUEG();
        if (picOrderCntType === 0) {
            readUEG(); // log2_max_pic_order_cnt_lsb_minus4
        }
        else if (picOrderCntType === 1) {
            skipBits(1); // delta_pic_order_always_zero_flag
            skipEG(); // offset_for_non_ref_pic
            skipEG(); // offset_for_top_to_bottom_field
            numRefFramesInPicOrderCntCycle = readUEG();
            for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
                skipEG();
            } // offset_for_ref_frame[ i ]
        }
        skipUEG(); // max_num_ref_frames
        skipBits(1); // gaps_in_frame_num_value_allowed_flag
        picWidthInMbsMinus1 = readUEG();
        picHeightInMapUnitsMinus1 = readUEG();
        frameMbsOnlyFlag = readBits(1);
        if (frameMbsOnlyFlag === 0) {
            skipBits(1);
        } // mb_adaptive_frame_field_flag
        skipBits(1); // direct_8x8_inference_flag
        if (readBoolean()) { // frame_cropping_flag
            frameCropLeftOffset = readUEG();
            frameCropRightOffset = readUEG();
            frameCropTopOffset = readUEG();
            frameCropBottomOffset = readUEG();
        }
        var pixelRatio = [1, 1];
        if (readBoolean()) {
            // vui_parameters_present_flag
            if (readBoolean()) {
                // aspect_ratio_info_present_flag
                var aspectRatioIdc = readUByte();
                switch (aspectRatioIdc) {
                    case 1:
                        pixelRatio = [1, 1];
                        break;
                    case 2:
                        pixelRatio = [12, 11];
                        break;
                    case 3:
                        pixelRatio = [10, 11];
                        break;
                    case 4:
                        pixelRatio = [16, 11];
                        break;
                    case 5:
                        pixelRatio = [40, 33];
                        break;
                    case 6:
                        pixelRatio = [24, 11];
                        break;
                    case 7:
                        pixelRatio = [20, 11];
                        break;
                    case 8:
                        pixelRatio = [32, 11];
                        break;
                    case 9:
                        pixelRatio = [80, 33];
                        break;
                    case 10:
                        pixelRatio = [18, 11];
                        break;
                    case 11:
                        pixelRatio = [15, 11];
                        break;
                    case 12:
                        pixelRatio = [64, 33];
                        break;
                    case 13:
                        pixelRatio = [160, 99];
                        break;
                    case 14:
                        pixelRatio = [4, 3];
                        break;
                    case 15:
                        pixelRatio = [3, 2];
                        break;
                    case 16:
                        pixelRatio = [2, 1];
                        break;
                    case 255: {
                        pixelRatio = [readUByte() << 8 | readUByte(), readUByte() << 8 | readUByte()];
                        break;
                    }
                }
            }
        }
        return {
            width: Math.ceil((((picWidthInMbsMinus1 + 1) * 16) - frameCropLeftOffset * 2 - frameCropRightOffset * 2)),
            height: ((2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16) - ((frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset)),
            pixelRatio: pixelRatio
        };
    };
    ExpGolomb.prototype.readSliceType = function () {
        // skip NALu type
        this.readUByte();
        // discard first_mb_in_slice
        this.readUEG();
        // return slice_type
        return this.readUEG();
    };
    return ExpGolomb;
}());
exports.default = ExpGolomb;


/***/ }),

/***/ "./src/demux/id3.js":
/*!**************************!*\
  !*** ./src/demux/id3.js ***!
  \**************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 * ID3 parser
 */
var ID3 = /** @class */ (function () {
    function ID3() {
    }
    /**
     * Returns true if an ID3 header can be found at offset in data
     * @param {Uint8Array} data - The data to search in
     * @param {number} offset - The offset at which to start searching
     * @return {boolean} - True if an ID3 header is found
     */
    ID3.isHeader = function (data, offset) {
        /*
        * http://id3.org/id3v2.3.0
        * [0]     = 'I'
        * [1]     = 'D'
        * [2]     = '3'
        * [3,4]   = {Version}
        * [5]     = {Flags}
        * [6-9]   = {ID3 Size}
        *
        * An ID3v2 tag can be detected with the following pattern:
        *  $49 44 33 yy yy xx zz zz zz zz
        * Where yy is less than $FF, xx is the 'flags' byte and zz is less than $80
        */
        if (offset + 10 <= data.length) {
            // look for 'ID3' identifier
            if (data[offset] === 0x49 && data[offset + 1] === 0x44 && data[offset + 2] === 0x33) {
                // check version is within range
                if (data[offset + 3] < 0xFF && data[offset + 4] < 0xFF) {
                    // check size is within range
                    if (data[offset + 6] < 0x80 && data[offset + 7] < 0x80 && data[offset + 8] < 0x80 && data[offset + 9] < 0x80) {
                        return true;
                    }
                }
            }
        }
        return false;
    };
    /**
     * Returns true if an ID3 footer can be found at offset in data
     * @param {Uint8Array} data - The data to search in
     * @param {number} offset - The offset at which to start searching
     * @return {boolean} - True if an ID3 footer is found
     */
    ID3.isFooter = function (data, offset) {
        /*
        * The footer is a copy of the header, but with a different identifier
        */
        if (offset + 10 <= data.length) {
            // look for '3DI' identifier
            if (data[offset] === 0x33 && data[offset + 1] === 0x44 && data[offset + 2] === 0x49) {
                // check version is within range
                if (data[offset + 3] < 0xFF && data[offset + 4] < 0xFF) {
                    // check size is within range
                    if (data[offset + 6] < 0x80 && data[offset + 7] < 0x80 && data[offset + 8] < 0x80 && data[offset + 9] < 0x80) {
                        return true;
                    }
                }
            }
        }
        return false;
    };
    /**
     * Returns any adjacent ID3 tags found in data starting at offset, as one block of data
     * @param {Uint8Array} data - The data to search in
     * @param {number} offset - The offset at which to start searching
     * @return {Uint8Array} - The block of data containing any ID3 tags found
     */
    ID3.getID3Data = function (data, offset) {
        var front = offset;
        var length = 0;
        while (ID3.isHeader(data, offset)) {
            // ID3 header is 10 bytes
            length += 10;
            var size = ID3._readSize(data, offset + 6);
            length += size;
            if (ID3.isFooter(data, offset + 10)) {
                // ID3 footer is 10 bytes
                length += 10;
            }
            offset += length;
        }
        if (length > 0) {
            return data.subarray(front, front + length);
        }
        return undefined;
    };
    ID3._readSize = function (data, offset) {
        var size = 0;
        size = ((data[offset] & 0x7f) << 21);
        size |= ((data[offset + 1] & 0x7f) << 14);
        size |= ((data[offset + 2] & 0x7f) << 7);
        size |= (data[offset + 3] & 0x7f);
        return size;
    };
    /**
     * Searches for the Elementary Stream timestamp found in the ID3 data chunk
     * @param {Uint8Array} data - Block of data containing one or more ID3 tags
     * @return {number} - The timestamp
     */
    ID3.getTimeStamp = function (data) {
        var frames = ID3.getID3Frames(data);
        for (var i = 0; i < frames.length; i++) {
            var frame = frames[i];
            if (ID3.isTimeStampFrame(frame)) {
                return ID3._readTimeStamp(frame);
            }
        }
        return undefined;
    };
    /**
     * Returns true if the ID3 frame is an Elementary Stream timestamp frame
     * @param {ID3 frame} frame
     */
    ID3.isTimeStampFrame = function (frame) {
        return (frame && frame.key === 'PRIV' && frame.info === 'com.apple.streaming.transportStreamTimestamp');
    };
    ID3._getFrameData = function (data) {
        /*
        Frame ID       $xx xx xx xx (four characters)
        Size           $xx xx xx xx
        Flags          $xx xx
        */
        var type = String.fromCharCode(data[0], data[1], data[2], data[3]);
        var size = ID3._readSize(data, 4);
        // skip frame id, size, and flags
        var offset = 10;
        return { type: type, size: size, data: data.subarray(offset, offset + size) };
    };
    /**
     * Returns an array of ID3 frames found in all the ID3 tags in the id3Data
     * @param {Uint8Array} id3Data - The ID3 data containing one or more ID3 tags
     * @return {ID3 frame[]} - Array of ID3 frame objects
     */
    ID3.getID3Frames = function (id3Data) {
        var offset = 0;
        var frames = [];
        while (ID3.isHeader(id3Data, offset)) {
            var size = ID3._readSize(id3Data, offset + 6);
            // skip past ID3 header
            offset += 10;
            var end = offset + size;
            // loop through frames in the ID3 tag
            while (offset + 8 < end) {
                var frameData = ID3._getFrameData(id3Data.subarray(offset));
                var frame = ID3._decodeFrame(frameData);
                if (frame) {
                    frames.push(frame);
                }
                // skip frame header and frame data
                offset += frameData.size + 10;
            }
            if (ID3.isFooter(id3Data, offset)) {
                offset += 10;
            }
        }
        return frames;
    };
    ID3._decodeFrame = function (frame) {
        if (frame.type === 'PRIV') {
            return ID3._decodePrivFrame(frame);
        }
        else if (frame.type[0] === 'T') {
            return ID3._decodeTextFrame(frame);
        }
        else if (frame.type[0] === 'W') {
            return ID3._decodeURLFrame(frame);
        }
        return undefined;
    };
    ID3._readTimeStamp = function (timeStampFrame) {
        if (timeStampFrame.data.byteLength === 8) {
            var data = new Uint8Array(timeStampFrame.data);
            // timestamp is 33 bit expressed as a big-endian eight-octet number,
            // with the upper 31 bits set to zero.
            var pts33Bit = data[3] & 0x1;
            var timestamp = (data[4] << 23) +
                (data[5] << 15) +
                (data[6] << 7) +
                data[7];
            timestamp /= 45;
            if (pts33Bit) {
                timestamp += 47721858.84;
            } // 2^32 / 90
            return Math.round(timestamp);
        }
        return undefined;
    };
    ID3._decodePrivFrame = function (frame) {
        /*
        Format: <text string>\0<binary data>
        */
        if (frame.size < 2) {
            return undefined;
        }
        var owner = ID3._utf8ArrayToStr(frame.data, true);
        var privateData = new Uint8Array(frame.data.subarray(owner.length + 1));
        return { key: frame.type, info: owner, data: privateData.buffer };
    };
    ID3._decodeTextFrame = function (frame) {
        if (frame.size < 2) {
            return undefined;
        }
        if (frame.type === 'TXXX') {
            /*
            Format:
            [0]   = {Text Encoding}
            [1-?] = {Description}\0{Value}
            */
            var index = 1;
            var description = ID3._utf8ArrayToStr(frame.data.subarray(index));
            index += description.length + 1;
            var value = ID3._utf8ArrayToStr(frame.data.subarray(index));
            return { key: frame.type, info: description, data: value };
        }
        else {
            /*
            Format:
            [0]   = {Text Encoding}
            [1-?] = {Value}
            */
            var text = ID3._utf8ArrayToStr(frame.data.subarray(1));
            return { key: frame.type, data: text };
        }
    };
    ID3._decodeURLFrame = function (frame) {
        if (frame.type === 'WXXX') {
            /*
            Format:
            [0]   = {Text Encoding}
            [1-?] = {Description}\0{URL}
            */
            if (frame.size < 2) {
                return undefined;
            }
            var index = 1;
            var description = ID3._utf8ArrayToStr(frame.data.subarray(index));
            index += description.length + 1;
            var value = ID3._utf8ArrayToStr(frame.data.subarray(index));
            return { key: frame.type, info: description, data: value };
        }
        else {
            /*
            Format:
            [0-?] = {URL}
            */
            var url = ID3._utf8ArrayToStr(frame.data);
            return { key: frame.type, data: url };
        }
    };
    // http://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript/22373197
    // http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
    /* utf.js - UTF-8 <=> UTF-16 convertion
     *
     * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
     * Version: 1.0
     * LastModified: Dec 25 1999
     * This library is free.  You can redistribute it and/or modify it.
     */
    ID3._utf8ArrayToStr = function (array, exitOnNull) {
        if (exitOnNull === void 0) { exitOnNull = false; }
        var len = array.length;
        var c;
        var char2;
        var char3;
        var out = '';
        var i = 0;
        while (i < len) {
            c = array[i++];
            if (c === 0x00 && exitOnNull) {
                return out;
            }
            else if (c === 0x00 || c === 0x03) {
                // If the character is 3 (END_OF_TEXT) or 0 (NULL) then skip it
                continue;
            }
            switch (c >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    // 0xxxxxxx
                    out += String.fromCharCode(c);
                    break;
                case 12:
                case 13:
                    // 110x xxxx   10xx xxxx
                    char2 = array[i++];
                    out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                    break;
                case 14:
                    // 1110 xxxx  10xx xxxx  10xx xxxx
                    char2 = array[i++];
                    char3 = array[i++];
                    out += String.fromCharCode(((c & 0x0F) << 12) |
                        ((char2 & 0x3F) << 6) |
                        ((char3 & 0x3F) << 0));
                    break;
                default:
            }
        }
        return out;
    };
    return ID3;
}());
var utf8ArrayToStr = ID3._utf8ArrayToStr;
exports.utf8ArrayToStr = utf8ArrayToStr;
exports.default = ID3;


/***/ }),

/***/ "./src/demux/mp3demuxer.js":
/*!*********************************!*\
  !*** ./src/demux/mp3demuxer.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 * MP3 demuxer
 */
var id3_1 = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var mpegaudio_1 = __webpack_require__(/*! ./mpegaudio */ "./src/demux/mpegaudio.js");
var MP3Demuxer = /** @class */ (function () {
    function MP3Demuxer(observer, remuxer, config) {
        this.observer = observer;
        this.config = config;
        this.remuxer = remuxer;
    }
    MP3Demuxer.prototype.resetInitSegment = function (initSegment, audioCodec, videoCodec, duration) {
        this._audioTrack = { container: 'audio/mpeg', type: 'audio', id: -1, sequenceNumber: 0, isAAC: false, samples: [], len: 0, manifestCodec: audioCodec, duration: duration, inputTimeScale: 90000 };
    };
    MP3Demuxer.prototype.resetTimeStamp = function () {
    };
    MP3Demuxer.probe = function (data) {
        // check if data contains ID3 timestamp and MPEG sync word
        var offset, length;
        var id3Data = id3_1.default.getID3Data(data, 0);
        if (id3Data && id3_1.default.getTimeStamp(id3Data) !== undefined) {
            // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
            // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
            // More info http://www.mp3-tech.org/programmer/frame_header.html
            for (offset = id3Data.length, length = Math.min(data.length - 1, offset + 100); offset < length; offset++) {
                if (mpegaudio_1.default.probe(data, offset)) {
                    logger_1.logger.log('MPEG Audio sync word found !');
                    return true;
                }
            }
        }
        return false;
    };
    // feed incoming data to the front of the parsing pipeline
    MP3Demuxer.prototype.append = function (data, timeOffset, contiguous, accurateTimeOffset) {
        var id3Data = id3_1.default.getID3Data(data, 0);
        var timestamp = id3_1.default.getTimeStamp(id3Data);
        var pts = timestamp ? 90 * timestamp : timeOffset * 90000;
        var offset = id3Data.length;
        var length = data.length;
        var frameIndex = 0, stamp = 0;
        var track = this._audioTrack;
        var id3Samples = [{ pts: pts, dts: pts, data: id3Data }];
        while (offset < length) {
            if (mpegaudio_1.default.isHeader(data, offset)) {
                var frame = mpegaudio_1.default.appendFrame(track, data, offset, pts, frameIndex);
                if (frame) {
                    offset += frame.length;
                    stamp = frame.sample.pts;
                    frameIndex++;
                }
                else {
                    // logger.log('Unable to parse Mpeg audio frame');
                    break;
                }
            }
            else if (id3_1.default.isHeader(data, offset)) {
                id3Data = id3_1.default.getID3Data(data, offset);
                id3Samples.push({ pts: stamp, dts: stamp, data: id3Data });
                offset += id3Data.length;
            }
            else {
                // nothing found, keep looking
                offset++;
            }
        }
        this.remuxer.remux(track, { samples: [] }, { samples: id3Samples, inputTimeScale: 90000 }, { samples: [] }, timeOffset, contiguous, accurateTimeOffset);
    };
    MP3Demuxer.prototype.destroy = function () {
    };
    return MP3Demuxer;
}());
exports.default = MP3Demuxer;


/***/ }),

/***/ "./src/demux/mp4demuxer.js":
/*!*********************************!*\
  !*** ./src/demux/mp4demuxer.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 * MP4 demuxer
 */
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var UINT32_MAX = Math.pow(2, 32) - 1;
var MP4Demuxer = /** @class */ (function () {
    function MP4Demuxer(observer, remuxer) {
        this.observer = observer;
        this.remuxer = remuxer;
    }
    MP4Demuxer.prototype.resetTimeStamp = function (initPTS) {
        this.initPTS = initPTS;
    };
    MP4Demuxer.prototype.resetInitSegment = function (initSegment, audioCodec, videoCodec, duration) {
        // jshint unused:false
        if (initSegment && initSegment.byteLength) {
            var initData = this.initData = MP4Demuxer.parseInitSegment(initSegment);
            // default audio codec if nothing specified
            // TODO : extract that from initsegment
            if (audioCodec == null) {
                audioCodec = 'mp4a.40.5';
            }
            if (videoCodec == null) {
                videoCodec = 'avc1.42e01e';
            }
            var tracks = {};
            if (initData.audio && initData.video) {
                tracks.audiovideo = { container: 'video/mp4', codec: audioCodec + ',' + videoCodec, initSegment: duration ? initSegment : null };
            }
            else {
                if (initData.audio) {
                    tracks.audio = { container: 'audio/mp4', codec: audioCodec, initSegment: duration ? initSegment : null };
                }
                if (initData.video) {
                    tracks.video = { container: 'video/mp4', codec: videoCodec, initSegment: duration ? initSegment : null };
                }
            }
            this.observer.trigger(events_1.default.FRAG_PARSING_INIT_SEGMENT, { tracks: tracks });
        }
        else {
            if (audioCodec) {
                this.audioCodec = audioCodec;
            }
            if (videoCodec) {
                this.videoCodec = videoCodec;
            }
        }
    };
    MP4Demuxer.probe = function (data) {
        // ensure we find a moof box in the first 16 kB
        return MP4Demuxer.findBox({ data: data, start: 0, end: Math.min(data.length, 16384) }, ['moof']).length > 0;
    };
    MP4Demuxer.bin2str = function (buffer) {
        return String.fromCharCode.apply(null, buffer);
    };
    MP4Demuxer.readUint16 = function (buffer, offset) {
        if (buffer.data) {
            offset += buffer.start;
            buffer = buffer.data;
        }
        var val = buffer[offset] << 8 |
            buffer[offset + 1];
        return val < 0 ? 65536 + val : val;
    };
    MP4Demuxer.readUint32 = function (buffer, offset) {
        if (buffer.data) {
            offset += buffer.start;
            buffer = buffer.data;
        }
        var val = buffer[offset] << 24 |
            buffer[offset + 1] << 16 |
            buffer[offset + 2] << 8 |
            buffer[offset + 3];
        return val < 0 ? 4294967296 + val : val;
    };
    MP4Demuxer.writeUint32 = function (buffer, offset, value) {
        if (buffer.data) {
            offset += buffer.start;
            buffer = buffer.data;
        }
        buffer[offset] = value >> 24;
        buffer[offset + 1] = (value >> 16) & 0xff;
        buffer[offset + 2] = (value >> 8) & 0xff;
        buffer[offset + 3] = value & 0xff;
    };
    // Find the data for a box specified by its path
    MP4Demuxer.findBox = function (data, path) {
        var results = [], i, size, type, end, subresults, start, endbox;
        if (data.data) {
            start = data.start;
            end = data.end;
            data = data.data;
        }
        else {
            start = 0;
            end = data.byteLength;
        }
        if (!path.length) {
            // short-circuit the search for empty paths
            return null;
        }
        for (i = start; i < end;) {
            size = MP4Demuxer.readUint32(data, i);
            type = MP4Demuxer.bin2str(data.subarray(i + 4, i + 8));
            endbox = size > 1 ? i + size : end;
            if (type === path[0]) {
                if (path.length === 1) {
                    // this is the end of the path and we've found the box we were
                    // looking for
                    results.push({ data: data, start: i + 8, end: endbox });
                }
                else {
                    // recursively search for the next box along the path
                    subresults = MP4Demuxer.findBox({ data: data, start: i + 8, end: endbox }, path.slice(1));
                    if (subresults.length) {
                        results = results.concat(subresults);
                    }
                }
            }
            i = endbox;
        }
        // we've finished searching all of data
        return results;
    };
    MP4Demuxer.parseSegmentIndex = function (initSegment) {
        var moov = MP4Demuxer.findBox(initSegment, ['moov'])[0];
        var moovEndOffset = moov ? moov.end : null; // we need this in case we need to chop of garbage of the end of current data
        var index = 0;
        var sidx = MP4Demuxer.findBox(initSegment, ['sidx']);
        var references;
        if (!sidx || !sidx[0]) {
            return null;
        }
        references = [];
        sidx = sidx[0];
        var version = sidx.data[0];
        // set initial offset, we skip the reference ID (not needed)
        index = version === 0 ? 8 : 16;
        var timescale = MP4Demuxer.readUint32(sidx, index);
        index += 4;
        // TODO: parse earliestPresentationTime and firstOffset
        // usually zero in our case
        var earliestPresentationTime = 0;
        var firstOffset = 0;
        if (version === 0) {
            index += 8;
        }
        else {
            index += 16;
        }
        // skip reserved
        index += 2;
        var startByte = sidx.end + firstOffset;
        var referencesCount = MP4Demuxer.readUint16(sidx, index);
        index += 2;
        for (var i = 0; i < referencesCount; i++) {
            var referenceIndex = index;
            var referenceInfo = MP4Demuxer.readUint32(sidx, referenceIndex);
            referenceIndex += 4;
            var referenceSize = referenceInfo & 0x7FFFFFFF;
            var referenceType = (referenceInfo & 0x80000000) >>> 31;
            if (referenceType === 1) {
                console.warn('SIDX has hierarchical references (not supported)');
                return;
            }
            var subsegmentDuration = MP4Demuxer.readUint32(sidx, referenceIndex);
            referenceIndex += 4;
            references.push({
                referenceSize: referenceSize,
                subsegmentDuration: subsegmentDuration,
                info: {
                    duration: subsegmentDuration / timescale,
                    start: startByte,
                    end: startByte + referenceSize - 1
                }
            });
            startByte += referenceSize;
            // Skipping 1 bit for |startsWithSap|, 3 bits for |sapType|, and 28 bits
            // for |sapDelta|.
            referenceIndex += 4;
            // skip to next ref
            index = referenceIndex;
        }
        return {
            earliestPresentationTime: earliestPresentationTime,
            timescale: timescale,
            version: version,
            referencesCount: referencesCount,
            references: references,
            moovEndOffset: moovEndOffset
        };
    };
    /**
     * Parses an MP4 initialization segment and extracts stream type and
     * timescale values for any declared tracks. Timescale values indicate the
     * number of clock ticks per second to assume for time-based values
     * elsewhere in the MP4.
     *
     * To determine the start time of an MP4, you need two pieces of
     * information: the timescale unit and the earliest base media decode
     * time. Multiple timescales can be specified within an MP4 but the
     * base media decode time is always expressed in the timescale from
     * the media header box for the track:
     * ```
     * moov > trak > mdia > mdhd.timescale
     * moov > trak > mdia > hdlr
     * ```
     * @param init {Uint8Array} the bytes of the init segment
     * @return {object} a hash of track type to timescale values or null if
     * the init segment is malformed.
     */
    MP4Demuxer.parseInitSegment = function (initSegment) {
        var result = [];
        var traks = MP4Demuxer.findBox(initSegment, ['moov', 'trak']);
        traks.forEach(function (trak) {
            var tkhd = MP4Demuxer.findBox(trak, ['tkhd'])[0];
            if (tkhd) {
                var version = tkhd.data[tkhd.start];
                var index = version === 0 ? 12 : 20;
                var trackId = MP4Demuxer.readUint32(tkhd, index);
                var mdhd = MP4Demuxer.findBox(trak, ['mdia', 'mdhd'])[0];
                if (mdhd) {
                    version = mdhd.data[mdhd.start];
                    index = version === 0 ? 12 : 20;
                    var timescale = MP4Demuxer.readUint32(mdhd, index);
                    var hdlr = MP4Demuxer.findBox(trak, ['mdia', 'hdlr'])[0];
                    if (hdlr) {
                        var hdlrType = MP4Demuxer.bin2str(hdlr.data.subarray(hdlr.start + 8, hdlr.start + 12));
                        var type = { 'soun': 'audio', 'vide': 'video' }[hdlrType];
                        if (type) {
                            // extract codec info. TODO : parse codec details to be able to build MIME type
                            var codecBox = MP4Demuxer.findBox(trak, ['mdia', 'minf', 'stbl', 'stsd']);
                            if (codecBox.length) {
                                codecBox = codecBox[0];
                                var codecType = MP4Demuxer.bin2str(codecBox.data.subarray(codecBox.start + 12, codecBox.start + 16));
                                logger_1.logger.log("MP4Demuxer:" + type + ":" + codecType + " found");
                            }
                            result[trackId] = { timescale: timescale, type: type };
                            result[type] = { timescale: timescale, id: trackId };
                        }
                    }
                }
            }
        });
        return result;
    };
    /**
   * Determine the base media decode start time, in seconds, for an MP4
   * fragment. If multiple fragments are specified, the earliest time is
   * returned.
   *
   * The base media decode time can be parsed from track fragment
   * metadata:
   * ```
   * moof > traf > tfdt.baseMediaDecodeTime
   * ```
   * It requires the timescale value from the mdhd to interpret.
   *
   * @param timescale {object} a hash of track ids to timescale values.
   * @return {number} the earliest base media decode start time for the
   * fragment, in seconds
   */
    MP4Demuxer.getStartDTS = function (initData, fragment) {
        var trafs, baseTimes, result;
        // we need info from two childrend of each track fragment box
        trafs = MP4Demuxer.findBox(fragment, ['moof', 'traf']);
        // determine the start times for each track
        baseTimes = [].concat.apply([], trafs.map(function (traf) {
            return MP4Demuxer.findBox(traf, ['tfhd']).map(function (tfhd) {
                var id, scale, baseTime;
                // get the track id from the tfhd
                id = MP4Demuxer.readUint32(tfhd, 4);
                // assume a 90kHz clock if no timescale was specified
                scale = initData[id].timescale || 90e3;
                // get the base media decode time from the tfdt
                baseTime = MP4Demuxer.findBox(traf, ['tfdt']).map(function (tfdt) {
                    var version, result;
                    version = tfdt.data[tfdt.start];
                    result = MP4Demuxer.readUint32(tfdt, 4);
                    if (version === 1) {
                        result *= Math.pow(2, 32);
                        result += MP4Demuxer.readUint32(tfdt, 8);
                    }
                    return result;
                })[0];
                // convert base time to seconds
                return baseTime / scale;
            });
        }));
        // return the minimum
        result = Math.min.apply(null, baseTimes);
        return isFinite(result) ? result : 0;
    };
    MP4Demuxer.offsetStartDTS = function (initData, fragment, timeOffset) {
        MP4Demuxer.findBox(fragment, ['moof', 'traf']).map(function (traf) {
            return MP4Demuxer.findBox(traf, ['tfhd']).map(function (tfhd) {
                // get the track id from the tfhd
                var id = MP4Demuxer.readUint32(tfhd, 4);
                // assume a 90kHz clock if no timescale was specified
                var timescale = initData[id].timescale || 90e3;
                // get the base media decode time from the tfdt
                MP4Demuxer.findBox(traf, ['tfdt']).map(function (tfdt) {
                    var version = tfdt.data[tfdt.start];
                    var baseMediaDecodeTime = MP4Demuxer.readUint32(tfdt, 4);
                    if (version === 0) {
                        MP4Demuxer.writeUint32(tfdt, 4, baseMediaDecodeTime - timeOffset * timescale);
                    }
                    else {
                        baseMediaDecodeTime *= Math.pow(2, 32);
                        baseMediaDecodeTime += MP4Demuxer.readUint32(tfdt, 8);
                        baseMediaDecodeTime -= timeOffset * timescale;
                        baseMediaDecodeTime = Math.max(baseMediaDecodeTime, 0);
                        var upper = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1));
                        var lower = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
                        MP4Demuxer.writeUint32(tfdt, 4, upper);
                        MP4Demuxer.writeUint32(tfdt, 8, lower);
                    }
                });
            });
        });
    };
    // feed incoming data to the front of the parsing pipeline
    MP4Demuxer.prototype.append = function (data, timeOffset, contiguous, accurateTimeOffset) {
        var initData = this.initData;
        if (!initData) {
            this.resetInitSegment(data, this.audioCodec, this.videoCodec, false);
            initData = this.initData;
        }
        var startDTS, initPTS = this.initPTS;
        if (initPTS === undefined) {
            var startDTS_1 = MP4Demuxer.getStartDTS(initData, data);
            this.initPTS = initPTS = startDTS_1 - timeOffset;
            this.observer.trigger(events_1.default.INIT_PTS_FOUND, { initPTS: initPTS });
        }
        MP4Demuxer.offsetStartDTS(initData, data, initPTS);
        startDTS = MP4Demuxer.getStartDTS(initData, data);
        this.remuxer.remux(initData.audio, initData.video, null, null, startDTS, contiguous, accurateTimeOffset, data);
    };
    MP4Demuxer.prototype.destroy = function () { };
    return MP4Demuxer;
}());
exports.default = MP4Demuxer;


/***/ }),

/***/ "./src/demux/mpegaudio.js":
/*!********************************!*\
  !*** ./src/demux/mpegaudio.js ***!
  \********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 *  MPEG parser helper
 */
Object.defineProperty(exports, "__esModule", { value: true });
var MpegAudio = {
    BitratesMap: [
        32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448,
        32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384,
        32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
        32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256,
        8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160
    ],
    SamplingRateMap: [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000],
    SamplesCoefficients: [
        // MPEG 2.5
        [
            0,
            72,
            144,
            12 // Layer1
        ],
        // Reserved
        [
            0,
            0,
            0,
            0 // Layer1
        ],
        // MPEG 2
        [
            0,
            72,
            144,
            12 // Layer1
        ],
        // MPEG 1
        [
            0,
            144,
            144,
            12 // Layer1
        ]
    ],
    BytesInSlot: [
        0,
        1,
        1,
        4 // Layer1
    ],
    appendFrame: function (track, data, offset, pts, frameIndex) {
        // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
        if (offset + 24 > data.length) {
            return undefined;
        }
        var header = this.parseHeader(data, offset);
        if (header && offset + header.frameLength <= data.length) {
            var frameDuration = header.samplesPerFrame * 90000 / header.sampleRate;
            var stamp = pts + frameIndex * frameDuration;
            var sample = { unit: data.subarray(offset, offset + header.frameLength), pts: stamp, dts: stamp };
            track.config = [];
            track.channelCount = header.channelCount;
            track.samplerate = header.sampleRate;
            track.samples.push(sample);
            track.len += header.frameLength;
            return { sample: sample, length: header.frameLength };
        }
        return undefined;
    },
    parseHeader: function (data, offset) {
        var headerB = (data[offset + 1] >> 3) & 3;
        var headerC = (data[offset + 1] >> 1) & 3;
        var headerE = (data[offset + 2] >> 4) & 15;
        var headerF = (data[offset + 2] >> 2) & 3;
        var headerG = (data[offset + 2] >> 1) & 1;
        if (headerB !== 1 && headerE !== 0 && headerE !== 15 && headerF !== 3) {
            var columnInBitrates = headerB === 3 ? (3 - headerC) : (headerC === 3 ? 3 : 4);
            var bitRate = MpegAudio.BitratesMap[columnInBitrates * 14 + headerE - 1] * 1000;
            var columnInSampleRates = headerB === 3 ? 0 : headerB === 2 ? 1 : 2;
            var sampleRate = MpegAudio.SamplingRateMap[columnInSampleRates * 3 + headerF];
            var channelCount = data[offset + 3] >> 6 === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
            var sampleCoefficient = MpegAudio.SamplesCoefficients[headerB][headerC];
            var bytesInSlot = MpegAudio.BytesInSlot[headerC];
            var samplesPerFrame = sampleCoefficient * 8 * bytesInSlot;
            var frameLength = parseInt(sampleCoefficient * bitRate / sampleRate + headerG, 10) * bytesInSlot;
            return { sampleRate: sampleRate, channelCount: channelCount, frameLength: frameLength, samplesPerFrame: samplesPerFrame };
        }
        return undefined;
    },
    isHeaderPattern: function (data, offset) {
        return data[offset] === 0xff && (data[offset + 1] & 0xe0) === 0xe0 && (data[offset + 1] & 0x06) !== 0x00;
    },
    isHeader: function (data, offset) {
        // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
        // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
        // More info http://www.mp3-tech.org/programmer/frame_header.html
        if (offset + 1 < data.length && this.isHeaderPattern(data, offset)) {
            return true;
        }
        return false;
    },
    probe: function (data, offset) {
        // same as isHeader but we also check that MPEG frame follows last MPEG frame
        // or end of data is reached
        if (offset + 1 < data.length && this.isHeaderPattern(data, offset)) {
            // MPEG header Length
            var headerLength = 4;
            // MPEG frame Length
            var header = this.parseHeader(data, offset);
            var frameLength = headerLength;
            if (header && header.frameLength) {
                frameLength = header.frameLength;
            }
            var newOffset = offset + frameLength;
            if (newOffset === data.length || (newOffset + 1 < data.length && this.isHeaderPattern(data, newOffset))) {
                return true;
            }
        }
        return false;
    }
};
exports.default = MpegAudio;


/***/ }),

/***/ "./src/demux/sample-aes.js":
/*!*********************************!*\
  !*** ./src/demux/sample-aes.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * SAMPLE-AES decrypter
*/
Object.defineProperty(exports, "__esModule", { value: true });
var decrypter_1 = __webpack_require__(/*! ../crypt/decrypter */ "./src/crypt/decrypter.js");
var SampleAesDecrypter = /** @class */ (function () {
    function SampleAesDecrypter(observer, config, decryptdata, discardEPB) {
        this.decryptdata = decryptdata;
        this.discardEPB = discardEPB;
        this.decrypter = new decrypter_1.default(observer, config, { removePKCS7Padding: false });
    }
    SampleAesDecrypter.prototype.decryptBuffer = function (encryptedData, callback) {
        this.decrypter.decrypt(encryptedData, this.decryptdata.key.buffer, this.decryptdata.iv.buffer, callback);
    };
    // AAC - encrypt all full 16 bytes blocks starting from offset 16
    SampleAesDecrypter.prototype.decryptAacSample = function (samples, sampleIndex, callback, sync) {
        var curUnit = samples[sampleIndex].unit;
        var encryptedData = curUnit.subarray(16, curUnit.length - curUnit.length % 16);
        var encryptedBuffer = encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.length);
        var localthis = this;
        this.decryptBuffer(encryptedBuffer, function (decryptedData) {
            decryptedData = new Uint8Array(decryptedData);
            curUnit.set(decryptedData, 16);
            if (!sync) {
                localthis.decryptAacSamples(samples, sampleIndex + 1, callback);
            }
        });
    };
    SampleAesDecrypter.prototype.decryptAacSamples = function (samples, sampleIndex, callback) {
        for (;; sampleIndex++) {
            if (sampleIndex >= samples.length) {
                callback();
                return;
            }
            if (samples[sampleIndex].unit.length < 32) {
                continue;
            }
            var sync = this.decrypter.isSync();
            this.decryptAacSample(samples, sampleIndex, callback, sync);
            if (!sync) {
                return;
            }
        }
    };
    // AVC - encrypt one 16 bytes block out of ten, starting from offset 32
    SampleAesDecrypter.prototype.getAvcEncryptedData = function (decodedData) {
        var encryptedDataLen = Math.floor((decodedData.length - 48) / 160) * 16 + 16;
        var encryptedData = new Int8Array(encryptedDataLen);
        var outputPos = 0;
        for (var inputPos = 32; inputPos <= decodedData.length - 16; inputPos += 160, outputPos += 16) {
            encryptedData.set(decodedData.subarray(inputPos, inputPos + 16), outputPos);
        }
        return encryptedData;
    };
    SampleAesDecrypter.prototype.getAvcDecryptedUnit = function (decodedData, decryptedData) {
        decryptedData = new Uint8Array(decryptedData);
        var inputPos = 0;
        for (var outputPos = 32; outputPos <= decodedData.length - 16; outputPos += 160, inputPos += 16) {
            decodedData.set(decryptedData.subarray(inputPos, inputPos + 16), outputPos);
        }
        return decodedData;
    };
    SampleAesDecrypter.prototype.decryptAvcSample = function (samples, sampleIndex, unitIndex, callback, curUnit, sync) {
        var decodedData = this.discardEPB(curUnit.data);
        var encryptedData = this.getAvcEncryptedData(decodedData);
        var localthis = this;
        this.decryptBuffer(encryptedData.buffer, function (decryptedData) {
            curUnit.data = localthis.getAvcDecryptedUnit(decodedData, decryptedData);
            if (!sync) {
                localthis.decryptAvcSamples(samples, sampleIndex, unitIndex + 1, callback);
            }
        });
    };
    SampleAesDecrypter.prototype.decryptAvcSamples = function (samples, sampleIndex, unitIndex, callback) {
        for (;; sampleIndex++, unitIndex = 0) {
            if (sampleIndex >= samples.length) {
                callback();
                return;
            }
            var curUnits = samples[sampleIndex].units;
            for (;; unitIndex++) {
                if (unitIndex >= curUnits.length) {
                    break;
                }
                var curUnit = curUnits[unitIndex];
                if (curUnit.length <= 48 || (curUnit.type !== 1 && curUnit.type !== 5)) {
                    continue;
                }
                var sync = this.decrypter.isSync();
                this.decryptAvcSample(samples, sampleIndex, unitIndex, callback, curUnit, sync);
                if (!sync) {
                    return;
                }
            }
        }
    };
    return SampleAesDecrypter;
}());
exports.default = SampleAesDecrypter;


/***/ }),

/***/ "./src/demux/tsdemuxer.js":
/*!********************************!*\
  !*** ./src/demux/tsdemuxer.js ***!
  \********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * highly optimized TS demuxer:
 * parse PAT, PMT
 * extract PES packet from audio and video PIDs
 * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
 * trigger the remuxer upon parsing completion
 * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
 * it also controls the remuxing process :
 * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
*/
Object.defineProperty(exports, "__esModule", { value: true });
var ADTS = __webpack_require__(/*! ./adts */ "./src/demux/adts.js");
var mpegaudio_1 = __webpack_require__(/*! ./mpegaudio */ "./src/demux/mpegaudio.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var exp_golomb_1 = __webpack_require__(/*! ./exp-golomb */ "./src/demux/exp-golomb.js");
var sample_aes_1 = __webpack_require__(/*! ./sample-aes */ "./src/demux/sample-aes.js");
// import Hex from '../utils/hex';
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
// We are using fixed track IDs for driving the MP4 remuxer
// instead of following the TS PIDs.
// There is no reason not to do this and some browsers/SourceBuffer-demuxers
// may not like if there are TrackID "switches"
// See https://github.com/video-dev/hls.js/issues/1331
// Here we are mapping our internal track types to constant MP4 track IDs
// With MSE currently one can only have one track of each, and we are muxing
// whatever video/audio rendition in them.
var RemuxerTrackIdConfig = {
    video: 1,
    audio: 2,
    id3: 3,
    text: 4
};
var TSDemuxer = /** @class */ (function () {
    function TSDemuxer(observer, remuxer, config, typeSupported) {
        this.observer = observer;
        this.config = config;
        this.typeSupported = typeSupported;
        this.remuxer = remuxer;
        this.sampleAes = null;
    }
    TSDemuxer.prototype.setDecryptData = function (decryptdata) {
        if ((decryptdata != null) && (decryptdata.key != null) && (decryptdata.method === 'SAMPLE-AES')) {
            this.sampleAes = new sample_aes_1.default(this.observer, this.config, decryptdata, this.discardEPB);
        }
        else {
            this.sampleAes = null;
        }
    };
    TSDemuxer.probe = function (data) {
        var syncOffset = TSDemuxer._syncOffset(data);
        if (syncOffset < 0) {
            return false;
        }
        else {
            if (syncOffset) {
                logger_1.logger.warn("MPEG2-TS detected but first sync word found @ offset " + syncOffset + ", junk ahead ?");
            }
            return true;
        }
    };
    TSDemuxer._syncOffset = function (data) {
        // scan 1000 first bytes
        var scanwindow = Math.min(1000, data.length - 3 * 188);
        var i = 0;
        while (i < scanwindow) {
            // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
            if (data[i] === 0x47 && data[i + 188] === 0x47 && data[i + 2 * 188] === 0x47) {
                return i;
            }
            else {
                i++;
            }
        }
        return -1;
    };
    /**
     * Creates a track model internal to demuxer used to drive remuxing input
     *
     * @param {string} type 'audio' | 'video' | 'id3' | 'text'
     * @param {number} duration
     * @return {object} TSDemuxer's internal track model
     */
    TSDemuxer.createTrack = function (type, duration) {
        return {
            container: type === 'video' || type === 'audio' ? 'video/mp2t' : undefined,
            type: type,
            id: RemuxerTrackIdConfig[type],
            pid: -1,
            inputTimeScale: 90000,
            sequenceNumber: 0,
            samples: [],
            len: 0,
            dropped: type === 'video' ? 0 : undefined,
            isAAC: type === 'audio' ? true : undefined,
            duration: type === 'audio' ? duration : undefined
        };
    };
    /**
     * Initializes a new init segment on the demuxer/remuxer interface. Needed for discontinuities/track-switches (or at stream start)
     * Resets all internal track instances of the demuxer.
     *
     * @override Implements generic demuxing/remuxing interface (see DemuxerInline)
     * @param {object} initSegment
     * @param {string} audioCodec
     * @param {string} videoCodec
     * @param {number} duration (in TS timescale = 90kHz)
     */
    TSDemuxer.prototype.resetInitSegment = function (initSegment, audioCodec, videoCodec, duration) {
        this.pmtParsed = false;
        this._pmtId = -1;
        this._avcTrack = TSDemuxer.createTrack('video', duration);
        this._audioTrack = TSDemuxer.createTrack('audio', duration);
        this._id3Track = TSDemuxer.createTrack('id3', duration);
        this._txtTrack = TSDemuxer.createTrack('text', duration);
        // flush any partial content
        this.aacOverFlow = null;
        this.aacLastPTS = null;
        this.avcSample = null;
        this.audioCodec = audioCodec;
        this.videoCodec = videoCodec;
        this._duration = duration;
    };
    /**
     *
     * @override
     */
    TSDemuxer.prototype.resetTimeStamp = function () { };
    // feed incoming data to the front of the parsing pipeline
    TSDemuxer.prototype.append = function (data, timeOffset, contiguous, accurateTimeOffset) {
        var start, len = data.length, stt, pid, atf, offset, pes, unknownPIDs = false;
        this.contiguous = contiguous;
        var pmtParsed = this.pmtParsed, avcTrack = this._avcTrack, audioTrack = this._audioTrack, id3Track = this._id3Track, avcId = avcTrack.pid, audioId = audioTrack.pid, id3Id = id3Track.pid, pmtId = this._pmtId, avcData = avcTrack.pesData, audioData = audioTrack.pesData, id3Data = id3Track.pesData, parsePAT = this._parsePAT, parsePMT = this._parsePMT, parsePES = this._parsePES, parseAVCPES = this._parseAVCPES.bind(this), parseAACPES = this._parseAACPES.bind(this), parseMPEGPES = this._parseMPEGPES.bind(this), parseID3PES = this._parseID3PES.bind(this);
        var syncOffset = TSDemuxer._syncOffset(data);
        // don't parse last TS packet if incomplete
        len -= (len + syncOffset) % 188;
        // loop through TS packets
        for (start = syncOffset; start < len; start += 188) {
            if (data[start] === 0x47) {
                stt = !!(data[start + 1] & 0x40);
                // pid is a 13-bit field starting at the last bit of TS[1]
                pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
                atf = (data[start + 3] & 0x30) >> 4;
                // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
                if (atf > 1) {
                    offset = start + 5 + data[start + 4];
                    // continue if there is only adaptation field
                    if (offset === (start + 188)) {
                        continue;
                    }
                }
                else {
                    offset = start + 4;
                }
                switch (pid) {
                    case avcId:
                        if (stt) {
                            if (avcData && (pes = parsePES(avcData)) && pes.pts !== undefined) {
                                parseAVCPES(pes, false);
                            }
                            avcData = { data: [], size: 0 };
                        }
                        if (avcData) {
                            avcData.data.push(data.subarray(offset, start + 188));
                            avcData.size += start + 188 - offset;
                        }
                        break;
                    case audioId:
                        if (stt) {
                            if (audioData && (pes = parsePES(audioData)) && pes.pts !== undefined) {
                                if (audioTrack.isAAC) {
                                    parseAACPES(pes);
                                }
                                else {
                                    parseMPEGPES(pes);
                                }
                            }
                            audioData = { data: [], size: 0 };
                        }
                        if (audioData) {
                            audioData.data.push(data.subarray(offset, start + 188));
                            audioData.size += start + 188 - offset;
                        }
                        break;
                    case id3Id:
                        if (stt) {
                            if (id3Data && (pes = parsePES(id3Data)) && pes.pts !== undefined) {
                                parseID3PES(pes);
                            }
                            id3Data = { data: [], size: 0 };
                        }
                        if (id3Data) {
                            id3Data.data.push(data.subarray(offset, start + 188));
                            id3Data.size += start + 188 - offset;
                        }
                        break;
                    case 0:
                        if (stt) {
                            offset += data[offset] + 1;
                        }
                        pmtId = this._pmtId = parsePAT(data, offset);
                        break;
                    case pmtId:
                        if (stt) {
                            offset += data[offset] + 1;
                        }
                        var parsedPIDs = parsePMT(data, offset, this.typeSupported.mpeg === true || this.typeSupported.mp3 === true, this.sampleAes != null);
                        // only update track id if track PID found while parsing PMT
                        // this is to avoid resetting the PID to -1 in case
                        // track PID transiently disappears from the stream
                        // this could happen in case of transient missing audio samples for example
                        // NOTE this is only the PID of the track as found in TS,
                        // but we are not using this for MP4 track IDs.
                        avcId = parsedPIDs.avc;
                        if (avcId > 0) {
                            avcTrack.pid = avcId;
                        }
                        audioId = parsedPIDs.audio;
                        if (audioId > 0) {
                            audioTrack.pid = audioId;
                            audioTrack.isAAC = parsedPIDs.isAAC;
                        }
                        id3Id = parsedPIDs.id3;
                        if (id3Id > 0) {
                            id3Track.pid = id3Id;
                        }
                        if (unknownPIDs && !pmtParsed) {
                            logger_1.logger.log('reparse from beginning');
                            unknownPIDs = false;
                            // we set it to -188, the += 188 in the for loop will reset start to 0
                            start = syncOffset - 188;
                        }
                        pmtParsed = this.pmtParsed = true;
                        break;
                    case 17:
                    case 0x1fff:
                        break;
                    default:
                        unknownPIDs = true;
                        break;
                }
            }
            else {
                this.observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47' });
            }
        }
        // try to parse last PES packets
        if (avcData && (pes = parsePES(avcData)) && pes.pts !== undefined) {
            parseAVCPES(pes, true);
            avcTrack.pesData = null;
        }
        else {
            // either avcData null or PES truncated, keep it for next frag parsing
            avcTrack.pesData = avcData;
        }
        if (audioData && (pes = parsePES(audioData)) && pes.pts !== undefined) {
            if (audioTrack.isAAC) {
                parseAACPES(pes);
            }
            else {
                parseMPEGPES(pes);
            }
            audioTrack.pesData = null;
        }
        else {
            if (audioData && audioData.size) {
                logger_1.logger.log('last AAC PES packet truncated,might overlap between fragments');
            }
            // either audioData null or PES truncated, keep it for next frag parsing
            audioTrack.pesData = audioData;
        }
        if (id3Data && (pes = parsePES(id3Data)) && pes.pts !== undefined) {
            parseID3PES(pes);
            id3Track.pesData = null;
        }
        else {
            // either id3Data null or PES truncated, keep it for next frag parsing
            id3Track.pesData = id3Data;
        }
        if (this.sampleAes == null) {
            this.remuxer.remux(audioTrack, avcTrack, id3Track, this._txtTrack, timeOffset, contiguous, accurateTimeOffset);
        }
        else {
            this.decryptAndRemux(audioTrack, avcTrack, id3Track, this._txtTrack, timeOffset, contiguous, accurateTimeOffset);
        }
    };
    TSDemuxer.prototype.decryptAndRemux = function (audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset) {
        if (audioTrack.samples && audioTrack.isAAC) {
            var localthis_1 = this;
            this.sampleAes.decryptAacSamples(audioTrack.samples, 0, function () {
                localthis_1.decryptAndRemuxAvc(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
            });
        }
        else {
            this.decryptAndRemuxAvc(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
        }
    };
    TSDemuxer.prototype.decryptAndRemuxAvc = function (audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset) {
        if (videoTrack.samples) {
            var localthis_2 = this;
            this.sampleAes.decryptAvcSamples(videoTrack.samples, 0, 0, function () {
                localthis_2.remuxer.remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
            });
        }
        else {
            this.remuxer.remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset);
        }
    };
    TSDemuxer.prototype.destroy = function () {
        this._initPTS = this._initDTS = undefined;
        this._duration = 0;
    };
    TSDemuxer.prototype._parsePAT = function (data, offset) {
        // skip the PSI header and parse the first PMT entry
        return (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
        // logger.log('PMT PID:'  + this._pmtId);
    };
    TSDemuxer.prototype._parsePMT = function (data, offset, mpegSupported, isSampleAes) {
        var sectionLength, tableEnd, programInfoLength, pid, result = { audio: -1, avc: -1, id3: -1, isAAC: true };
        sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
        tableEnd = offset + 3 + sectionLength - 4;
        // to determine where the table is, we have to figure out how
        // long the program info descriptors are
        programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
        // advance the offset to the first entry in the mapping table
        offset += 12 + programInfoLength;
        while (offset < tableEnd) {
            pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
            switch (data[offset]) {
                case 0xcf: // SAMPLE-AES AAC
                    if (!isSampleAes) {
                        logger_1.logger.log('unkown stream type:' + data[offset]);
                        break;
                    }
                /* falls through */
                // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
                case 0x0f:
                    // logger.log('AAC PID:'  + pid);
                    if (result.audio === -1) {
                        result.audio = pid;
                    }
                    break;
                // Packetized metadata (ID3)
                case 0x15:
                    // logger.log('ID3 PID:'  + pid);
                    if (result.id3 === -1) {
                        result.id3 = pid;
                    }
                    break;
                case 0xdb: // SAMPLE-AES AVC
                    if (!isSampleAes) {
                        logger_1.logger.log('unkown stream type:' + data[offset]);
                        break;
                    }
                /* falls through */
                // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
                case 0x1b:
                    // logger.log('AVC PID:'  + pid);
                    if (result.avc === -1) {
                        result.avc = pid;
                    }
                    break;
                // ISO/IEC 11172-3 (MPEG-1 audio)
                // or ISO/IEC 13818-3 (MPEG-2 halved sample rate audio)
                case 0x03:
                case 0x04:
                    // logger.log('MPEG PID:'  + pid);
                    if (!mpegSupported) {
                        logger_1.logger.log('MPEG audio found, not supported in this browser for now');
                    }
                    else if (result.audio === -1) {
                        result.audio = pid;
                        result.isAAC = false;
                    }
                    break;
                case 0x24:
                    logger_1.logger.warn('HEVC stream type found, not supported for now');
                    break;
                default:
                    logger_1.logger.log('unkown stream type:' + data[offset]);
                    break;
            }
            // move to the next table entry
            // skip past the elementary stream descriptors, if present
            offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
        }
        return result;
    };
    TSDemuxer.prototype._parsePES = function (stream) {
        var i = 0, frag, pesFlags, pesPrefix, pesLen, pesHdrLen, pesData, pesPts, pesDts, payloadStartOffset, data = stream.data;
        // safety check
        if (!stream || stream.size === 0) {
            return null;
        }
        // we might need up to 19 bytes to read PES header
        // if first chunk of data is less than 19 bytes, let's merge it with following ones until we get 19 bytes
        // usually only one merge is needed (and this is rare ...)
        while (data[0].length < 19 && data.length > 1) {
            var newData = new Uint8Array(data[0].length + data[1].length);
            newData.set(data[0]);
            newData.set(data[1], data[0].length);
            data[0] = newData;
            data.splice(1, 1);
        }
        // retrieve PTS/DTS from first fragment
        frag = data[0];
        pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
        if (pesPrefix === 1) {
            pesLen = (frag[4] << 8) + frag[5];
            // if PES parsed length is not zero and greater than total received length, stop parsing. PES might be truncated
            // minus 6 : PES header size
            if (pesLen && pesLen > stream.size - 6) {
                return null;
            }
            pesFlags = frag[7];
            if (pesFlags & 0xC0) {
                /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
                    as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
                    as Bitwise operators treat their operands as a sequence of 32 bits */
                pesPts = (frag[9] & 0x0E) * 536870912 + // 1 << 29
                    (frag[10] & 0xFF) * 4194304 + // 1 << 22
                    (frag[11] & 0xFE) * 16384 + // 1 << 14
                    (frag[12] & 0xFF) * 128 + // 1 << 7
                    (frag[13] & 0xFE) / 2;
                // check if greater than 2^32 -1
                if (pesPts > 4294967295) {
                    // decrement 2^33
                    pesPts -= 8589934592;
                }
                if (pesFlags & 0x40) {
                    pesDts = (frag[14] & 0x0E) * 536870912 + // 1 << 29
                        (frag[15] & 0xFF) * 4194304 + // 1 << 22
                        (frag[16] & 0xFE) * 16384 + // 1 << 14
                        (frag[17] & 0xFF) * 128 + // 1 << 7
                        (frag[18] & 0xFE) / 2;
                    // check if greater than 2^32 -1
                    if (pesDts > 4294967295) {
                        // decrement 2^33
                        pesDts -= 8589934592;
                    }
                    if (pesPts - pesDts > 60 * 90000) {
                        logger_1.logger.warn(Math.round((pesPts - pesDts) / 90000) + "s delta between PTS and DTS, align them");
                        pesPts = pesDts;
                    }
                }
                else {
                    pesDts = pesPts;
                }
            }
            pesHdrLen = frag[8];
            // 9 bytes : 6 bytes for PES header + 3 bytes for PES extension
            payloadStartOffset = pesHdrLen + 9;
            stream.size -= payloadStartOffset;
            // reassemble PES packet
            pesData = new Uint8Array(stream.size);
            for (var j = 0, dataLen = data.length; j < dataLen; j++) {
                frag = data[j];
                var len = frag.byteLength;
                if (payloadStartOffset) {
                    if (payloadStartOffset > len) {
                        // trim full frag if PES header bigger than frag
                        payloadStartOffset -= len;
                        continue;
                    }
                    else {
                        // trim partial frag if PES header smaller than frag
                        frag = frag.subarray(payloadStartOffset);
                        len -= payloadStartOffset;
                        payloadStartOffset = 0;
                    }
                }
                pesData.set(frag, i);
                i += len;
            }
            if (pesLen) {
                // payload size : remove PES header + PES extension
                pesLen -= pesHdrLen + 3;
            }
            return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
        }
        else {
            return null;
        }
    };
    TSDemuxer.prototype.pushAccesUnit = function (avcSample, avcTrack) {
        if (avcSample.units.length && avcSample.frame) {
            var samples = avcTrack.samples;
            var nbSamples = samples.length;
            // only push AVC sample if starting with a keyframe is not mandatory OR
            //    if keyframe already found in this fragment OR
            //       keyframe found in last fragment (track.sps) AND
            //          samples already appended (we already found a keyframe in this fragment) OR fragment is contiguous
            if (!this.config.forceKeyFrameOnDiscontinuity ||
                avcSample.key === true ||
                (avcTrack.sps && (nbSamples || this.contiguous))) {
                avcSample.id = nbSamples;
                samples.push(avcSample);
            }
            else {
                // dropped samples, track it
                avcTrack.dropped++;
            }
        }
        if (avcSample.debug.length) {
            logger_1.logger.log(avcSample.pts + '/' + avcSample.dts + ':' + avcSample.debug);
        }
    };
    TSDemuxer.prototype._parseAVCPES = function (pes, last) {
        var _this = this;
        // logger.log('parse new PES');
        var track = this._avcTrack, units = this._parseAVCNALu(pes.data), debug = false, expGolombDecoder, avcSample = this.avcSample, push, spsfound = false, i, pushAccesUnit = this.pushAccesUnit.bind(this), createAVCSample = function (key, pts, dts, debug) {
            return { key: key, pts: pts, dts: dts, units: [], debug: debug };
        };
        // free pes.data to save up some memory
        pes.data = null;
        // if new NAL units found and last sample still there, let's push ...
        // this helps parsing streams with missing AUD (only do this if AUD never found)
        if (avcSample && units.length && !track.audFound) {
            pushAccesUnit(avcSample, track);
            avcSample = this.avcSample = createAVCSample(false, pes.pts, pes.dts, '');
        }
        units.forEach(function (unit) {
            switch (unit.type) {
                // NDR
                case 1:
                    push = true;
                    if (!avcSample) {
                        avcSample = _this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
                    }
                    if (debug) {
                        avcSample.debug += 'NDR ';
                    }
                    avcSample.frame = true;
                    var data = unit.data;
                    // only check slice type to detect KF in case SPS found in same packet (any keyframe is preceded by SPS ...)
                    if (spsfound && data.length > 4) {
                        // retrieve slice type by parsing beginning of NAL unit (follow H264 spec, slice_header definition) to detect keyframe embedded in NDR
                        var sliceType = new exp_golomb_1.default(data).readSliceType();
                        // 2 : I slice, 4 : SI slice, 7 : I slice, 9: SI slice
                        // SI slice : A slice that is coded using intra prediction only and using quantisation of the prediction samples.
                        // An SI slice can be coded such that its decoded samples can be constructed identically to an SP slice.
                        // I slice: A slice that is not an SI slice that is decoded using intra prediction only.
                        // if (sliceType === 2 || sliceType === 7) {
                        if (sliceType === 2 || sliceType === 4 || sliceType === 7 || sliceType === 9) {
                            avcSample.key = true;
                        }
                    }
                    break;
                // IDR
                case 5:
                    push = true;
                    // handle PES not starting with AUD
                    if (!avcSample) {
                        avcSample = _this.avcSample = createAVCSample(true, pes.pts, pes.dts, '');
                    }
                    if (debug) {
                        avcSample.debug += 'IDR ';
                    }
                    avcSample.key = true;
                    avcSample.frame = true;
                    break;
                // SEI
                case 6:
                    push = true;
                    if (debug && avcSample) {
                        avcSample.debug += 'SEI ';
                    }
                    expGolombDecoder = new exp_golomb_1.default(_this.discardEPB(unit.data));
                    // skip frameType
                    expGolombDecoder.readUByte();
                    var payloadType = 0;
                    var payloadSize = 0;
                    var endOfCaptions = false;
                    var b = 0;
                    while (!endOfCaptions && expGolombDecoder.bytesAvailable > 1) {
                        payloadType = 0;
                        do {
                            b = expGolombDecoder.readUByte();
                            payloadType += b;
                        } while (b === 0xFF);
                        // Parse payload size.
                        payloadSize = 0;
                        do {
                            b = expGolombDecoder.readUByte();
                            payloadSize += b;
                        } while (b === 0xFF);
                        // TODO: there can be more than one payload in an SEI packet...
                        // TODO: need to read type and size in a while loop to get them all
                        if (payloadType === 4 && expGolombDecoder.bytesAvailable !== 0) {
                            endOfCaptions = true;
                            var countryCode = expGolombDecoder.readUByte();
                            if (countryCode === 181) {
                                var providerCode = expGolombDecoder.readUShort();
                                if (providerCode === 49) {
                                    var userStructure = expGolombDecoder.readUInt();
                                    if (userStructure === 0x47413934) {
                                        var userDataType = expGolombDecoder.readUByte();
                                        // Raw CEA-608 bytes wrapped in CEA-708 packet
                                        if (userDataType === 3) {
                                            var firstByte = expGolombDecoder.readUByte();
                                            var secondByte = expGolombDecoder.readUByte();
                                            var totalCCs = 31 & firstByte;
                                            var byteArray = [firstByte, secondByte];
                                            for (i = 0; i < totalCCs; i++) {
                                                // 3 bytes per CC
                                                byteArray.push(expGolombDecoder.readUByte());
                                                byteArray.push(expGolombDecoder.readUByte());
                                                byteArray.push(expGolombDecoder.readUByte());
                                            }
                                            _this._insertSampleInOrder(_this._txtTrack.samples, { type: 3, pts: pes.pts, bytes: byteArray });
                                        }
                                    }
                                }
                            }
                        }
                        else if (payloadSize < expGolombDecoder.bytesAvailable) {
                            for (i = 0; i < payloadSize; i++) {
                                expGolombDecoder.readUByte();
                            }
                        }
                    }
                    break;
                // SPS
                case 7:
                    push = true;
                    spsfound = true;
                    if (debug && avcSample) {
                        avcSample.debug += 'SPS ';
                    }
                    if (!track.sps) {
                        expGolombDecoder = new exp_golomb_1.default(unit.data);
                        var config = expGolombDecoder.readSPS();
                        track.width = config.width;
                        track.height = config.height;
                        track.pixelRatio = config.pixelRatio;
                        track.sps = [unit.data];
                        track.duration = _this._duration;
                        var codecarray = unit.data.subarray(1, 4);
                        var codecstring = 'avc1.';
                        for (i = 0; i < 3; i++) {
                            var h = codecarray[i].toString(16);
                            if (h.length < 2) {
                                h = '0' + h;
                            }
                            codecstring += h;
                        }
                        track.codec = codecstring;
                    }
                    break;
                // PPS
                case 8:
                    push = true;
                    if (debug && avcSample) {
                        avcSample.debug += 'PPS ';
                    }
                    if (!track.pps) {
                        track.pps = [unit.data];
                    }
                    break;
                // AUD
                case 9:
                    push = false;
                    track.audFound = true;
                    if (avcSample) {
                        pushAccesUnit(avcSample, track);
                    }
                    avcSample = _this.avcSample = createAVCSample(false, pes.pts, pes.dts, debug ? 'AUD ' : '');
                    break;
                // Filler Data
                case 12:
                    push = false;
                    break;
                default:
                    push = false;
                    if (avcSample) {
                        avcSample.debug += 'unknown NAL ' + unit.type + ' ';
                    }
                    break;
            }
            if (avcSample && push) {
                var units_1 = avcSample.units;
                units_1.push(unit);
            }
        });
        // if last PES packet, push samples
        if (last && avcSample) {
            pushAccesUnit(avcSample, track);
            this.avcSample = null;
        }
    };
    TSDemuxer.prototype._insertSampleInOrder = function (arr, data) {
        var len = arr.length;
        if (len > 0) {
            if (data.pts >= arr[len - 1].pts) {
                arr.push(data);
            }
            else {
                for (var pos = len - 1; pos >= 0; pos--) {
                    if (data.pts < arr[pos].pts) {
                        arr.splice(pos, 0, data);
                        break;
                    }
                }
            }
        }
        else {
            arr.push(data);
        }
    };
    TSDemuxer.prototype._getLastNalUnit = function () {
        var avcSample = this.avcSample, lastUnit;
        // try to fallback to previous sample if current one is empty
        if (!avcSample || avcSample.units.length === 0) {
            var track = this._avcTrack, samples = track.samples;
            avcSample = samples[samples.length - 1];
        }
        if (avcSample) {
            var units = avcSample.units;
            lastUnit = units[units.length - 1];
        }
        return lastUnit;
    };
    TSDemuxer.prototype._parseAVCNALu = function (array) {
        var i = 0, len = array.byteLength, value, overflow, track = this._avcTrack, state = track.naluState || 0, lastState = state;
        var units = [], unit, unitType, lastUnitStart = -1, lastUnitType;
        // logger.log('PES:' + Hex.hexDump(array));
        if (state === -1) {
            // special use case where we found 3 or 4-byte start codes exactly at the end of previous PES packet
            lastUnitStart = 0;
            // NALu type is value read from offset 0
            lastUnitType = array[0] & 0x1f;
            state = 0;
            i = 1;
        }
        while (i < len) {
            value = array[i++];
            // optimization. state 0 and 1 are the predominant case. let's handle them outside of the switch/case
            if (!state) {
                state = value ? 0 : 1;
                continue;
            }
            if (state === 1) {
                state = value ? 0 : 2;
                continue;
            }
            // here we have state either equal to 2 or 3
            if (!value) {
                state = 3;
            }
            else if (value === 1) {
                if (lastUnitStart >= 0) {
                    unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
                    // logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                    units.push(unit);
                }
                else {
                    // lastUnitStart is undefined => this is the first start code found in this PES packet
                    // first check if start code delimiter is overlapping between 2 PES packets,
                    // ie it started in last packet (lastState not zero)
                    // and ended at the beginning of this PES packet (i <= 4 - lastState)
                    var lastUnit = this._getLastNalUnit();
                    if (lastUnit) {
                        if (lastState && (i <= 4 - lastState)) {
                            // start delimiter overlapping between PES packets
                            // strip start delimiter bytes from the end of last NAL unit
                            // check if lastUnit had a state different from zero
                            if (lastUnit.state) {
                                // strip last bytes
                                lastUnit.data = lastUnit.data.subarray(0, lastUnit.data.byteLength - lastState);
                            }
                        }
                        // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                        overflow = i - state - 1;
                        if (overflow > 0) {
                            // logger.log('first NALU found with overflow:' + overflow);
                            var tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                            tmp.set(lastUnit.data, 0);
                            tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                            lastUnit.data = tmp;
                        }
                    }
                }
                // check if we can read unit type
                if (i < len) {
                    unitType = array[i] & 0x1f;
                    // logger.log('find NALU @ offset:' + i + ',type:' + unitType);
                    lastUnitStart = i;
                    lastUnitType = unitType;
                    state = 0;
                }
                else {
                    // not enough byte to read unit type. let's read it on next PES parsing
                    state = -1;
                }
            }
            else {
                state = 0;
            }
        }
        if (lastUnitStart >= 0 && state >= 0) {
            unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType, state: state };
            units.push(unit);
            // logger.log('pushing NALU, type/size/state:' + unit.type + '/' + unit.data.byteLength + '/' + state);
        }
        // no NALu found
        if (units.length === 0) {
            // append pes.data to previous NAL unit
            var lastUnit = this._getLastNalUnit();
            if (lastUnit) {
                var tmp = new Uint8Array(lastUnit.data.byteLength + array.byteLength);
                tmp.set(lastUnit.data, 0);
                tmp.set(array, lastUnit.data.byteLength);
                lastUnit.data = tmp;
            }
        }
        track.naluState = state;
        return units;
    };
    /**
     * remove Emulation Prevention bytes from a RBSP
     */
    TSDemuxer.prototype.discardEPB = function (data) {
        var length = data.byteLength, EPBPositions = [], i = 1, newLength, newData;
        // Find all `Emulation Prevention Bytes`
        while (i < length - 2) {
            if (data[i] === 0 &&
                data[i + 1] === 0 &&
                data[i + 2] === 0x03) {
                EPBPositions.push(i + 2);
                i += 2;
            }
            else {
                i++;
            }
        }
        // If no Emulation Prevention Bytes were found just return the original
        // array
        if (EPBPositions.length === 0) {
            return data;
        }
        // Create a new array to hold the NAL unit data
        newLength = length - EPBPositions.length;
        newData = new Uint8Array(newLength);
        var sourceIndex = 0;
        for (i = 0; i < newLength; sourceIndex++, i++) {
            if (sourceIndex === EPBPositions[0]) {
                // Skip this byte
                sourceIndex++;
                // Remove this position index
                EPBPositions.shift();
            }
            newData[i] = data[sourceIndex];
        }
        return newData;
    };
    TSDemuxer.prototype._parseAACPES = function (pes) {
        var track = this._audioTrack, data = pes.data, pts = pes.pts, startOffset = 0, aacOverFlow = this.aacOverFlow, aacLastPTS = this.aacLastPTS, frameDuration, frameIndex, offset, stamp, len;
        if (aacOverFlow) {
            var tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
            tmp.set(aacOverFlow, 0);
            tmp.set(data, aacOverFlow.byteLength);
            // logger.log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
            data = tmp;
        }
        // look for ADTS header (0xFFFx)
        for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
            if (ADTS.isHeader(data, offset)) {
                break;
            }
        }
        // if ADTS header does not start straight from the beginning of the PES payload, raise an error
        if (offset) {
            var reason = void 0, fatal = void 0;
            if (offset < len - 1) {
                reason = "AAC PES did not start with ADTS header,offset:" + offset;
                fatal = false;
            }
            else {
                reason = 'no ADTS header found in AAC PES';
                fatal = true;
            }
            logger_1.logger.warn("parsing error:" + reason);
            this.observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason });
            if (fatal) {
                return;
            }
        }
        ADTS.initTrackConfig(track, this.observer, data, offset, this.audioCodec);
        frameIndex = 0;
        frameDuration = ADTS.getFrameDuration(track.samplerate);
        // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
        // first sample PTS should be equal to last sample PTS + frameDuration
        if (aacOverFlow && aacLastPTS) {
            var newPTS = aacLastPTS + frameDuration;
            if (Math.abs(newPTS - pts) > 1) {
                logger_1.logger.log("AAC: align PTS for overlapping frames by " + Math.round((newPTS - pts) / 90));
                pts = newPTS;
            }
        }
        // scan for aac samples
        while (offset < len) {
            if (ADTS.isHeader(data, offset) && (offset + 5) < len) {
                var frame = ADTS.appendFrame(track, data, offset, pts, frameIndex);
                if (frame) {
                    // logger.log(`${Math.round(frame.sample.pts)} : AAC`);
                    offset += frame.length;
                    stamp = frame.sample.pts;
                    frameIndex++;
                }
                else {
                    // logger.log('Unable to parse AAC frame');
                    break;
                }
            }
            else {
                // nothing found, keep looking
                offset++;
            }
        }
        if (offset < len) {
            aacOverFlow = data.subarray(offset, len);
            // logger.log(`AAC: overflow detected:${len-offset}`);
        }
        else {
            aacOverFlow = null;
        }
        this.aacOverFlow = aacOverFlow;
        this.aacLastPTS = stamp;
    };
    TSDemuxer.prototype._parseMPEGPES = function (pes) {
        var data = pes.data;
        var length = data.length;
        var frameIndex = 0;
        var offset = 0;
        var pts = pes.pts;
        while (offset < length) {
            if (mpegaudio_1.default.isHeader(data, offset)) {
                var frame = mpegaudio_1.default.appendFrame(this._audioTrack, data, offset, pts, frameIndex);
                if (frame) {
                    offset += frame.length;
                    frameIndex++;
                }
                else {
                    // logger.log('Unable to parse Mpeg audio frame');
                    break;
                }
            }
            else {
                // nothing found, keep looking
                offset++;
            }
        }
    };
    TSDemuxer.prototype._parseID3PES = function (pes) {
        this._id3Track.samples.push(pes);
    };
    return TSDemuxer;
}());
exports.default = TSDemuxer;


/***/ }),

/***/ "./src/errors.js":
/*!***********************!*\
  !*** ./src/errors.js ***!
  \***********************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorTypes = {
    // Identifier for a network error (loading error / timeout ...)
    NETWORK_ERROR: 'networkError',
    // Identifier for a media Error (video/parsing/mediasource error)
    MEDIA_ERROR: 'mediaError',
    // EME (encrypted media extensions) errors
    KEY_SYSTEM_ERROR: 'keySystemError',
    // Identifier for a mux Error (demuxing/remuxing)
    MUX_ERROR: 'muxError',
    // Identifier for all other errors
    OTHER_ERROR: 'otherError'
};
/**
 * @enum {ErrorDetails}
 * @typedef {string} ErrorDetail
 */
exports.ErrorDetails = {
    KEY_SYSTEM_NO_KEYS: 'keySystemNoKeys',
    KEY_SYSTEM_NO_ACCESS: 'keySystemNoAccess',
    KEY_SYSTEM_NO_SESSION: 'keySystemNoSession',
    KEY_SYSTEM_LICENSE_REQUEST_FAILED: 'keySystemLicenseRequestFailed',
    // Identifier for a manifest load error - data: { url : faulty URL, response : { code: error code, text: error text }}
    MANIFEST_LOAD_ERROR: 'manifestLoadError',
    // Identifier for a manifest load timeout - data: { url : faulty URL, response : { code: error code, text: error text }}
    MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeOut',
    // Identifier for a manifest parsing error - data: { url : faulty URL, reason : error reason}
    MANIFEST_PARSING_ERROR: 'manifestParsingError',
    // Identifier for a manifest with only incompatible codecs error - data: { url : faulty URL, reason : error reason}
    MANIFEST_INCOMPATIBLE_CODECS_ERROR: 'manifestIncompatibleCodecsError',
    // Identifier for a level load error - data: { url : faulty URL, response : { code: error code, text: error text }}
    LEVEL_LOAD_ERROR: 'levelLoadError',
    // Identifier for a level load timeout - data: { url : faulty URL, response : { code: error code, text: error text }}
    LEVEL_LOAD_TIMEOUT: 'levelLoadTimeOut',
    // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
    LEVEL_SWITCH_ERROR: 'levelSwitchError',
    // Identifier for an audio track load error - data: { url : faulty URL, response : { code: error code, text: error text }}
    AUDIO_TRACK_LOAD_ERROR: 'audioTrackLoadError',
    // Identifier for an audio track load timeout - data: { url : faulty URL, response : { code: error code, text: error text }}
    AUDIO_TRACK_LOAD_TIMEOUT: 'audioTrackLoadTimeOut',
    // Identifier for fragment load error - data: { frag : fragment object, response : { code: error code, text: error text }}
    FRAG_LOAD_ERROR: 'fragLoadError',
    // Identifier for fragment load timeout error - data: { frag : fragment object}
    FRAG_LOAD_TIMEOUT: 'fragLoadTimeOut',
    // Identifier for a fragment decryption error event - data: {id : demuxer Id,frag: fragment object, reason : parsing error description }
    FRAG_DECRYPT_ERROR: 'fragDecryptError',
    // Identifier for a fragment parsing error event - data: { id : demuxer Id, reason : parsing error description }
    // will be renamed DEMUX_PARSING_ERROR and switched to MUX_ERROR in the next major release
    FRAG_PARSING_ERROR: 'fragParsingError',
    // Identifier for a remux alloc error event - data: { id : demuxer Id, frag : fragment object, bytes : nb of bytes on which allocation failed , reason : error text }
    REMUX_ALLOC_ERROR: 'remuxAllocError',
    // Identifier for decrypt key load error - data: { frag : fragment object, response : { code: error code, text: error text }}
    KEY_LOAD_ERROR: 'keyLoadError',
    // Identifier for decrypt key load timeout error - data: { frag : fragment object}
    KEY_LOAD_TIMEOUT: 'keyLoadTimeOut',
    // Triggered when an exception occurs while adding a sourceBuffer to MediaSource - data : {  err : exception , mimeType : mimeType }
    BUFFER_ADD_CODEC_ERROR: 'bufferAddCodecError',
    // Identifier for a buffer append error - data: append error description
    BUFFER_APPEND_ERROR: 'bufferAppendError',
    // Identifier for a buffer appending error event - data: appending error description
    BUFFER_APPENDING_ERROR: 'bufferAppendingError',
    // Identifier for a buffer stalled error event
    BUFFER_STALLED_ERROR: 'bufferStalledError',
    // Identifier for a buffer full event
    BUFFER_FULL_ERROR: 'bufferFullError',
    // Identifier for a buffer seek over hole event
    BUFFER_SEEK_OVER_HOLE: 'bufferSeekOverHole',
    // Identifier for a buffer nudge on stall (playback is stuck although currentTime is in a buffered area)
    BUFFER_NUDGE_ON_STALL: 'bufferNudgeOnStall',
    // Identifier for an internal exception happening inside hls.js while handling an event
    INTERNAL_EXCEPTION: 'internalException'
};


/***/ }),

/***/ "./src/event-handler.js":
/*!******************************!*\
  !*** ./src/event-handler.js ***!
  \******************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
*
* All objects in the event handling chain should inherit from this class
*
*/
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = __webpack_require__(/*! ./utils/logger */ "./src/utils/logger.js");
var errors_1 = __webpack_require__(/*! ./errors */ "./src/errors.js");
var events_1 = __webpack_require__(/*! ./events */ "./src/events.js");
var FORBIDDEN_EVENT_NAMES = {
    'hlsEventGeneric': true,
    'hlsHandlerDestroying': true,
    'hlsHandlerDestroyed': true
};
var EventHandler = /** @class */ (function () {
    function EventHandler(hls) {
        var events = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            events[_i - 1] = arguments[_i];
        }
        this.hls = hls;
        this.onEvent = this.onEvent.bind(this);
        this.handledEvents = events;
        this.useGenericHandler = true;
        this.registerListeners();
    }
    EventHandler.prototype.destroy = function () {
        this.onHandlerDestroying();
        this.unregisterListeners();
        this.onHandlerDestroyed();
    };
    EventHandler.prototype.onHandlerDestroying = function () { };
    EventHandler.prototype.onHandlerDestroyed = function () { };
    EventHandler.prototype.isEventHandler = function () {
        return typeof this.handledEvents === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
    };
    EventHandler.prototype.registerListeners = function () {
        if (this.isEventHandler()) {
            this.handledEvents.forEach(function (event) {
                if (FORBIDDEN_EVENT_NAMES[event]) {
                    throw new Error('Forbidden event-name: ' + event);
                }
                this.hls.on(event, this.onEvent);
            }, this);
        }
    };
    EventHandler.prototype.unregisterListeners = function () {
        if (this.isEventHandler()) {
            this.handledEvents.forEach(function (event) {
                this.hls.off(event, this.onEvent);
            }, this);
        }
    };
    /**
     * arguments: event (string), data (any)
     */
    EventHandler.prototype.onEvent = function (event, data) {
        this.onEventGeneric(event, data);
    };
    EventHandler.prototype.onEventGeneric = function (event, data) {
        var eventToFunction = function (event, data) {
            var funcName = 'on' + event.replace('hls', '');
            if (typeof this[funcName] !== 'function') {
                throw new Error("Event " + event + " has no generic handler in this " + this.constructor.name + " class (tried " + funcName + ")");
            }
            return this[funcName].bind(this, data);
        };
        try {
            eventToFunction.call(this, event, data).call();
        }
        catch (err) {
            logger_1.logger.error("An internal error happened while handling event " + event + ". Error message: \"" + err.message + "\". Here is a stacktrace:", err);
            this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.OTHER_ERROR, details: errors_1.ErrorDetails.INTERNAL_EXCEPTION, fatal: false, event: event, err: err });
        }
    };
    return EventHandler;
}());
exports.default = EventHandler;


/***/ }),

/***/ "./src/events.js":
/*!***********************!*\
  !*** ./src/events.js ***!
  \***********************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @readonly
 * @enum {string}
 */
var HlsEvents = {
    // fired before MediaSource is attaching to media element - data: { media }
    MEDIA_ATTACHING: 'hlsMediaAttaching',
    // fired when MediaSource has been succesfully attached to media element - data: { }
    MEDIA_ATTACHED: 'hlsMediaAttached',
    // fired before detaching MediaSource from media element - data: { }
    MEDIA_DETACHING: 'hlsMediaDetaching',
    // fired when MediaSource has been detached from media element - data: { }
    MEDIA_DETACHED: 'hlsMediaDetached',
    // fired when we buffer is going to be reset - data: { }
    BUFFER_RESET: 'hlsBufferReset',
    // fired when we know about the codecs that we need buffers for to push into - data: {tracks : { container, codec, levelCodec, initSegment, metadata }}
    BUFFER_CODECS: 'hlsBufferCodecs',
    // fired when sourcebuffers have been created - data: { tracks : tracks }
    BUFFER_CREATED: 'hlsBufferCreated',
    // fired when we append a segment to the buffer - data: { segment: segment object }
    BUFFER_APPENDING: 'hlsBufferAppending',
    // fired when we are done with appending a media segment to the buffer - data : { parent : segment parent that triggered BUFFER_APPENDING, pending : nb of segments waiting for appending for this segment parent}
    BUFFER_APPENDED: 'hlsBufferAppended',
    // fired when the stream is finished and we want to notify the media buffer that there will be no more data - data: { }
    BUFFER_EOS: 'hlsBufferEos',
    // fired when the media buffer should be flushed - data { startOffset, endOffset }
    BUFFER_FLUSHING: 'hlsBufferFlushing',
    // fired when the media buffer has been flushed - data: { }
    BUFFER_FLUSHED: 'hlsBufferFlushed',
    // fired to signal that a manifest loading starts - data: { url : manifestURL}
    MANIFEST_LOADING: 'hlsManifestLoading',
    // fired after manifest has been loaded - data: { levels : [available quality levels], audioTracks : [ available audio tracks], url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
    MANIFEST_LOADED: 'hlsManifestLoaded',
    // fired after manifest has been parsed - data: { levels : [available quality levels], firstLevel : index of first quality level appearing in Manifest}
    MANIFEST_PARSED: 'hlsManifestParsed',
    // fired when a level switch is requested - data: { level : id of new level }
    LEVEL_SWITCHING: 'hlsLevelSwitching',
    // fired when a level switch is effective - data: { level : id of new level }
    LEVEL_SWITCHED: 'hlsLevelSwitched',
    // fired when a level playlist loading starts - data: { url : level URL, level : id of level being loaded}
    LEVEL_LOADING: 'hlsLevelLoading',
    // fired when a level playlist loading finishes - data: { details : levelDetails object, level : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
    LEVEL_LOADED: 'hlsLevelLoaded',
    // fired when a level's details have been updated based on previous details, after it has been loaded - data: { details : levelDetails object, level : id of updated level }
    LEVEL_UPDATED: 'hlsLevelUpdated',
    // fired when a level's PTS information has been updated after parsing a fragment - data: { details : levelDetails object, level : id of updated level, drift: PTS drift observed when parsing last fragment }
    LEVEL_PTS_UPDATED: 'hlsLevelPtsUpdated',
    // fired to notify that audio track lists has been updated - data: { audioTracks : audioTracks }
    AUDIO_TRACKS_UPDATED: 'hlsAudioTracksUpdated',
    // fired when an audio track switching is requested - data: { id : audio track id }
    AUDIO_TRACK_SWITCHING: 'hlsAudioTrackSwitching',
    // fired when an audio track switch actually occurs - data: { id : audio track id }
    AUDIO_TRACK_SWITCHED: 'hlsAudioTrackSwitched',
    // fired when an audio track loading starts - data: { url : audio track URL, id : audio track id }
    AUDIO_TRACK_LOADING: 'hlsAudioTrackLoading',
    // fired when an audio track loading finishes - data: { details : levelDetails object, id : audio track id, stats : { trequest, tfirst, tload, mtime } }
    AUDIO_TRACK_LOADED: 'hlsAudioTrackLoaded',
    // fired to notify that subtitle track lists has been updated - data: { subtitleTracks : subtitleTracks }
    SUBTITLE_TRACKS_UPDATED: 'hlsSubtitleTracksUpdated',
    // fired when an subtitle track switch occurs - data: { id : subtitle track id }
    SUBTITLE_TRACK_SWITCH: 'hlsSubtitleTrackSwitch',
    // fired when a subtitle track loading starts - data: { url : subtitle track URL, id : subtitle track id }
    SUBTITLE_TRACK_LOADING: 'hlsSubtitleTrackLoading',
    // fired when a subtitle track loading finishes - data: { details : levelDetails object, id : subtitle track id, stats : { trequest, tfirst, tload, mtime } }
    SUBTITLE_TRACK_LOADED: 'hlsSubtitleTrackLoaded',
    // fired when a subtitle fragment has been processed - data: { success : boolean, frag : the processed frag }
    SUBTITLE_FRAG_PROCESSED: 'hlsSubtitleFragProcessed',
    // fired when the first timestamp is found - data: { id : demuxer id, initPTS: initPTS, frag : fragment object }
    INIT_PTS_FOUND: 'hlsInitPtsFound',
    // fired when a fragment loading starts - data: { frag : fragment object }
    FRAG_LOADING: 'hlsFragLoading',
    // fired when a fragment loading is progressing - data: { frag : fragment object, { trequest, tfirst, loaded } }
    FRAG_LOAD_PROGRESS: 'hlsFragLoadProgress',
    // Identifier for fragment load aborting for emergency switch down - data: { frag : fragment object }
    FRAG_LOAD_EMERGENCY_ABORTED: 'hlsFragLoadEmergencyAborted',
    // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length } }
    FRAG_LOADED: 'hlsFragLoaded',
    // fired when a fragment has finished decrypting - data: { id : demuxer id, frag: fragment object, payload : fragment payload, stats : { tstart, tdecrypt } }
    FRAG_DECRYPTED: 'hlsFragDecrypted',
    // fired when Init Segment has been extracted from fragment - data: { id : demuxer id, frag: fragment object, moov : moov MP4 box, codecs : codecs found while parsing fragment }
    FRAG_PARSING_INIT_SEGMENT: 'hlsFragParsingInitSegment',
    // fired when parsing sei text is completed - data: { id : demuxer id, frag: fragment object, samples : [ sei samples pes ] }
    FRAG_PARSING_USERDATA: 'hlsFragParsingUserdata',
    // fired when parsing id3 is completed - data: { id : demuxer id, frag: fragment object, samples : [ id3 samples pes ] }
    FRAG_PARSING_METADATA: 'hlsFragParsingMetadata',
    // fired when data have been extracted from fragment - data: { id : demuxer id, frag: fragment object, data1 : moof MP4 box or TS fragments, data2 : mdat MP4 box or null}
    FRAG_PARSING_DATA: 'hlsFragParsingData',
    // fired when fragment parsing is completed - data: { id : demuxer id, frag: fragment object }
    FRAG_PARSED: 'hlsFragParsed',
    // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { id : demuxer id, frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length, bwEstimate } }
    FRAG_BUFFERED: 'hlsFragBuffered',
    // fired when fragment matching with current media position is changing - data : { id : demuxer id, frag : fragment object }
    FRAG_CHANGED: 'hlsFragChanged',
    // Identifier for a FPS drop event - data: { curentDropped, currentDecoded, totalDroppedFrames }
    FPS_DROP: 'hlsFpsDrop',
    // triggered when FPS drop triggers auto level capping - data: { level, droppedlevel }
    FPS_DROP_LEVEL_CAPPING: 'hlsFpsDropLevelCapping',
    // Identifier for an error event - data: { type : error type, details : error details, fatal : if true, hls.js cannot/will not try to recover, if false, hls.js will try to recover,other error specific data }
    ERROR: 'hlsError',
    // fired when hls.js instance starts destroying. Different from MEDIA_DETACHED as one could want to detach and reattach a media to the instance of hls.js to handle mid-rolls for example - data: { }
    DESTROYING: 'hlsDestroying',
    // fired when a decrypt key loading starts - data: { frag : fragment object }
    KEY_LOADING: 'hlsKeyLoading',
    // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length } }
    KEY_LOADED: 'hlsKeyLoaded',
    // fired upon stream controller state transitions - data: { previousState, nextState }
    STREAM_STATE_TRANSITION: 'hlsStreamStateTransition'
};
exports.default = HlsEvents;


/***/ }),

/***/ "./src/hls.js":
/*!********************!*\
  !*** ./src/hls.js ***!
  \********************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var URLToolkit = __webpack_require__(/*! url-toolkit */ "./node_modules/url-toolkit/src/url-toolkit.js");
var errors_1 = __webpack_require__(/*! ./errors */ "./src/errors.js");
var playlist_loader_1 = __webpack_require__(/*! ./loader/playlist-loader */ "./src/loader/playlist-loader.js");
var fragment_loader_1 = __webpack_require__(/*! ./loader/fragment-loader */ "./src/loader/fragment-loader.js");
var key_loader_1 = __webpack_require__(/*! ./loader/key-loader */ "./src/loader/key-loader.js");
var fragment_tracker_1 = __webpack_require__(/*! ./controller/fragment-tracker */ "./src/controller/fragment-tracker.js");
var stream_controller_1 = __webpack_require__(/*! ./controller/stream-controller */ "./src/controller/stream-controller.js");
var level_controller_1 = __webpack_require__(/*! ./controller/level-controller */ "./src/controller/level-controller.js");
var id3_track_controller_1 = __webpack_require__(/*! ./controller/id3-track-controller */ "./src/controller/id3-track-controller.js");
var is_supported_1 = __webpack_require__(/*! ./is-supported */ "./src/is-supported.js");
var logger_1 = __webpack_require__(/*! ./utils/logger */ "./src/utils/logger.js");
var config_1 = __webpack_require__(/*! ./config */ "./src/config.js");
var events_1 = __webpack_require__(/*! ./events */ "./src/events.js");
var observer_1 = __webpack_require__(/*! ./observer */ "./src/observer.js");
/**
 * @module Hls
 * @class
 * @constructor
 */
var Hls = /** @class */ (function (_super) {
    __extends(Hls, _super);
    /**
     * Creates an instance of an HLS client that can attach to exactly one `HTMLMediaElement`.
     *
     * @constructs Hls
     * @param {HlsConfig} config
     */
    function Hls(config) {
        if (config === void 0) { config = {}; }
        var _this = _super.call(this) || this;
        var defaultConfig = Hls.DefaultConfig;
        if ((config.liveSyncDurationCount || config.liveMaxLatencyDurationCount) && (config.liveSyncDuration || config.liveMaxLatencyDuration)) {
            throw new Error('Illegal hls.js config: don\'t mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration');
        }
        for (var prop in defaultConfig) {
            if (prop in config)
                continue;
            config[prop] = defaultConfig[prop];
        }
        if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
            throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be gt "liveSyncDurationCount"');
        }
        if (config.liveMaxLatencyDuration !== undefined && (config.liveMaxLatencyDuration <= config.liveSyncDuration || config.liveSyncDuration === undefined)) {
            throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be gt "liveSyncDuration"');
        }
        logger_1.enableLogs(config.debug);
        _this.config = config;
        _this._autoLevelCapping = -1;
        // core controllers and network loaders
        /**
         * @member {AbrController} abrController
         */
        var abrController = _this.abrController = new config.abrController(_this);
        var bufferController = new config.bufferController(_this);
        var capLevelController = new config.capLevelController(_this);
        var fpsController = new config.fpsController(_this);
        var playListLoader = new playlist_loader_1.default(_this);
        var fragmentLoader = new fragment_loader_1.default(_this);
        var keyLoader = new key_loader_1.default(_this);
        var id3TrackController = new id3_track_controller_1.default(_this);
        // network controllers
        /**
         * @member {LevelController} levelController
         */
        var levelController = _this.levelController = new level_controller_1.default(_this);
        // FIXME: FragmentTracker must be defined before StreamController because the order of event handling is important
        var fragmentTracker = new fragment_tracker_1.FragmentTracker(_this);
        /**
         * @member {StreamController} streamController
         */
        var streamController = _this.streamController = new stream_controller_1.default(_this, fragmentTracker);
        var networkControllers = [levelController, streamController];
        // optional audio stream controller
        /**
         * @var {ICoreComponent | Controller}
         */
        var Controller = config.audioStreamController;
        if (Controller) {
            networkControllers.push(new Controller(_this, fragmentTracker));
        }
        /**
         * @member {INetworkController[]} networkControllers
         */
        _this.networkControllers = networkControllers;
        /**
         * @var {ICoreComponent[]}
         */
        var coreComponents = [
            playListLoader,
            fragmentLoader,
            keyLoader,
            abrController,
            bufferController,
            capLevelController,
            fpsController,
            id3TrackController,
            fragmentTracker
        ];
        // optional audio track and subtitle controller
        Controller = config.audioTrackController;
        if (Controller) {
            var audioTrackController = new Controller(_this);
            /**
             * @member {AudioTrackController} audioTrackController
             */
            _this.audioTrackController = audioTrackController;
            coreComponents.push(audioTrackController);
        }
        Controller = config.subtitleTrackController;
        if (Controller) {
            var subtitleTrackController = new Controller(_this);
            /**
             * @member {SubtitleTrackController} subtitleTrackController
             */
            _this.subtitleTrackController = subtitleTrackController;
            coreComponents.push(subtitleTrackController);
        }
        Controller = config.emeController;
        if (Controller) {
            var emeController = new Controller(_this);
            /**
             * @member {EMEController} emeController
             */
            _this.emeController = emeController;
            coreComponents.push(emeController);
        }
        // optional subtitle controllers
        Controller = config.subtitleStreamController;
        if (Controller) {
            coreComponents.push(new Controller(_this, fragmentTracker));
        }
        Controller = config.timelineController;
        if (Controller) {
            coreComponents.push(new Controller(_this));
        }
        /**
         * @member {ICoreComponent[]}
         */
        _this.coreComponents = coreComponents;
        return _this;
    }
    Object.defineProperty(Hls, "version", {
        /**
         * @type {string}
         */
        get: function () {
            return "0.12.1-23a07d9";
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @type {boolean}
     */
    Hls.isSupported = function () {
        return is_supported_1.isSupported();
    };
    Object.defineProperty(Hls, "Events", {
        /**
         * @type {HlsEvents}
         */
        get: function () {
            return events_1.default;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls, "ErrorTypes", {
        /**
         * @type {HlsErrorTypes}
         */
        get: function () {
            return errors_1.ErrorTypes;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls, "ErrorDetails", {
        /**
         * @type {HlsErrorDetails}
         */
        get: function () {
            return errors_1.ErrorDetails;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls, "DefaultConfig", {
        /**
         * @type {HlsConfig}
         */
        get: function () {
            if (!Hls.defaultConfig) {
                return config_1.hlsDefaultConfig;
            }
            return Hls.defaultConfig;
        },
        /**
         * @type {HlsConfig}
         */
        set: function (defaultConfig) {
            Hls.defaultConfig = defaultConfig;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Dispose of the instance
     */
    Hls.prototype.destroy = function () {
        logger_1.logger.log('destroy');
        this.trigger(events_1.default.DESTROYING);
        this.detachMedia();
        this.coreComponents.concat(this.networkControllers).forEach(function (component) {
            component.destroy();
        });
        this.url = null;
        this.removeAllListeners();
        this._autoLevelCapping = -1;
    };
    /**
     * Attach a media element
     * @param {HTMLMediaElement} media
     */
    Hls.prototype.attachMedia = function (media) {
        logger_1.logger.log('attachMedia');
        this.media = media;
        this.trigger(events_1.default.MEDIA_ATTACHING, { media: media });
    };
    /**
     * Detach from the media
     */
    Hls.prototype.detachMedia = function () {
        logger_1.logger.log('detachMedia');
        this.trigger(events_1.default.MEDIA_DETACHING);
        this.media = null;
    };
    /**
     * Set the source URL. Can be relative or absolute.
     * @param {string} url
     */
    Hls.prototype.loadSource = function (url) {
        url = URLToolkit.buildAbsoluteURL(window.location.href, url, { alwaysNormalize: true });
        logger_1.logger.log("loadSource:" + url);
        this.url = url;
        // when attaching to a source URL, trigger a playlist load
        this.trigger(events_1.default.MANIFEST_LOADING, { url: url });
    };
    /**
     * Start loading data from the stream source.
     * Depending on default config, client starts loading automatically when a source is set.
     *
     * @param {number} startPosition Set the start position to stream from
     * @default -1 None (from earliest point)
     */
    Hls.prototype.startLoad = function (startPosition) {
        if (startPosition === void 0) { startPosition = -1; }
        logger_1.logger.log("startLoad(" + startPosition + ")");
        this.networkControllers.forEach(function (controller) {
            controller.startLoad(startPosition);
        });
    };
    /**
     * Stop loading of any stream data.
     */
    Hls.prototype.stopLoad = function () {
        logger_1.logger.log('stopLoad');
        this.networkControllers.forEach(function (controller) {
            controller.stopLoad();
        });
    };
    /**
     * Swap through possible audio codecs in the stream (for example to switch from stereo to 5.1)
     */
    Hls.prototype.swapAudioCodec = function () {
        logger_1.logger.log('swapAudioCodec');
        this.streamController.swapAudioCodec();
    };
    /**
     * When the media-element fails, this allows to detach and then re-attach it
     * as one call (convenience method).
     *
     * Automatic recovery of media-errors by this process is configurable.
     */
    Hls.prototype.recoverMediaError = function () {
        logger_1.logger.log('recoverMediaError');
        var media = this.media;
        this.detachMedia();
        this.attachMedia(media);
    };
    Object.defineProperty(Hls.prototype, "levels", {
        /**
         * @type {QualityLevel[]}
         */
        get: function () {
            return this.levelController.levels;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "currentLevel", {
        /**
         * Index of quality level currently played
         * @type {number}
         */
        get: function () {
            return this.streamController.currentLevel;
        },
        /**
         * Set quality level index immediately .
         * This will flush the current buffer to replace the quality asap.
         * That means playback will interrupt at least shortly to re-buffer and re-sync eventually.
         * @type {number} -1 for automatic level selection
         */
        set: function (newLevel) {
            logger_1.logger.log("set currentLevel:" + newLevel);
            this.loadLevel = newLevel;
            this.streamController.immediateLevelSwitch();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "nextLevel", {
        /**
         * Index of next quality level loaded as scheduled by stream controller.
         * @type {number}
         */
        get: function () {
            return this.streamController.nextLevel;
        },
        /**
         * Set quality level index for next loaded data.
         * This will switch the video quality asap, without interrupting playback.
         * May abort current loading of data, and flush parts of buffer (outside currently played fragment region).
         * @type {number} -1 for automatic level selection
         */
        set: function (newLevel) {
            logger_1.logger.log("set nextLevel:" + newLevel);
            this.levelController.manualLevel = newLevel;
            this.streamController.nextLevelSwitch();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "loadLevel", {
        /**
         * Return the quality level of the currently or last (of none is loaded currently) segment
         * @type {number}
         */
        get: function () {
            return this.levelController.level;
        },
        /**
         * Set quality level index for next loaded data in a conservative way.
         * This will switch the quality without flushing, but interrupt current loading.
         * Thus the moment when the quality switch will appear in effect will only be after the already existing buffer.
         * @type {number} newLevel -1 for automatic level selection
         */
        set: function (newLevel) {
            logger_1.logger.log("set loadLevel:" + newLevel);
            this.levelController.manualLevel = newLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "nextLoadLevel", {
        /**
         * get next quality level loaded
         * @type {number}
         */
        get: function () {
            return this.levelController.nextLoadLevel;
        },
        /**
         * Set quality level of next loaded segment in a fully "non-destructive" way.
         * Same as `loadLevel` but will wait for next switch (until current loading is done).
         * @type {number} level
         */
        set: function (level) {
            this.levelController.nextLoadLevel = level;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "firstLevel", {
        /**
         * Return "first level": like a default level, if not set,
         * falls back to index of first level referenced in manifest
         * @type {number}
         */
        get: function () {
            return Math.max(this.levelController.firstLevel, this.minAutoLevel);
        },
        /**
         * Sets "first-level", see getter.
         * @type {number}
         */
        set: function (newLevel) {
            logger_1.logger.log("set firstLevel:" + newLevel);
            this.levelController.firstLevel = newLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "startLevel", {
        /**
         * Return start level (level of first fragment that will be played back)
         * if not overrided by user, first level appearing in manifest will be used as start level
         * if -1 : automatic start level selection, playback will start from level matching download bandwidth
         * (determined from download of first segment)
         * @type {number}
         */
        get: function () {
            return this.levelController.startLevel;
        },
        /**
         * set  start level (level of first fragment that will be played back)
         * if not overrided by user, first level appearing in manifest will be used as start level
         * if -1 : automatic start level selection, playback will start from level matching download bandwidth
         * (determined from download of first segment)
         * @type {number} newLevel
         */
        set: function (newLevel) {
            logger_1.logger.log("set startLevel:" + newLevel);
            var hls = this;
            // if not in automatic start level detection, ensure startLevel is greater than minAutoLevel
            if (newLevel !== -1) {
                newLevel = Math.max(newLevel, hls.minAutoLevel);
            }
            hls.levelController.startLevel = newLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "autoLevelCapping", {
        /**
         * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
         * @type {number}
         */
        get: function () {
            return this._autoLevelCapping;
        },
        /**
         * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
         * @type {number}
         */
        set: function (newLevel) {
            logger_1.logger.log("set autoLevelCapping:" + newLevel);
            this._autoLevelCapping = newLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "autoLevelEnabled", {
        /**
         * True when automatic level selection enabled
         * @type {boolean}
         */
        get: function () {
            return (this.levelController.manualLevel === -1);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "manualLevel", {
        /**
         * Level set manually (if any)
         * @type {number}
         */
        get: function () {
            return this.levelController.manualLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "minAutoLevel", {
        /**
         * min level selectable in auto mode according to config.minAutoBitrate
         * @type {number}
         */
        get: function () {
            var hls = this, levels = hls.levels, minAutoBitrate = hls.config.minAutoBitrate, len = levels ? levels.length : 0;
            for (var i = 0; i < len; i++) {
                var levelNextBitrate = levels[i].realBitrate ? Math.max(levels[i].realBitrate, levels[i].bitrate) : levels[i].bitrate;
                if (levelNextBitrate > minAutoBitrate) {
                    return i;
                }
            }
            return 0;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "maxAutoLevel", {
        /**
         * max level selectable in auto mode according to autoLevelCapping
         * @type {number}
         */
        get: function () {
            var hls = this;
            var levels = hls.levels;
            var autoLevelCapping = hls.autoLevelCapping;
            var maxAutoLevel;
            if (autoLevelCapping === -1 && levels && levels.length) {
                maxAutoLevel = levels.length - 1;
            }
            else {
                maxAutoLevel = autoLevelCapping;
            }
            return maxAutoLevel;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "nextAutoLevel", {
        /**
         * next automatically selected quality level
         * @type {number}
         */
        get: function () {
            var hls = this;
            // ensure next auto level is between  min and max auto level
            return Math.min(Math.max(hls.abrController.nextAutoLevel, hls.minAutoLevel), hls.maxAutoLevel);
        },
        /**
         * this setter is used to force next auto level.
         * this is useful to force a switch down in auto mode:
         * in case of load error on level N, hls.js can set nextAutoLevel to N-1 for example)
         * forced value is valid for one fragment. upon succesful frag loading at forced level,
         * this value will be resetted to -1 by ABR controller.
         * @type {number}
         */
        set: function (nextLevel) {
            var hls = this;
            hls.abrController.nextAutoLevel = Math.max(hls.minAutoLevel, nextLevel);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "audioTracks", {
        /**
         * @type {AudioTrack[]}
         */
        get: function () {
            var audioTrackController = this.audioTrackController;
            return audioTrackController ? audioTrackController.audioTracks : [];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "audioTrack", {
        /**
         * index of the selected audio track (index in audio track lists)
         * @type {number}
         */
        get: function () {
            var audioTrackController = this.audioTrackController;
            return audioTrackController ? audioTrackController.audioTrack : -1;
        },
        /**
         * selects an audio track, based on its index in audio track lists
         * @type {number}
         */
        set: function (audioTrackId) {
            var audioTrackController = this.audioTrackController;
            if (audioTrackController) {
                audioTrackController.audioTrack = audioTrackId;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "liveSyncPosition", {
        /**
         * @type {Seconds}
         */
        get: function () {
            return this.streamController.liveSyncPosition;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "subtitleTracks", {
        /**
         * get alternate subtitle tracks list from playlist
         * @type {SubtitleTrack[]}
         */
        get: function () {
            var subtitleTrackController = this.subtitleTrackController;
            return subtitleTrackController ? subtitleTrackController.subtitleTracks : [];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "subtitleTrack", {
        /**
         * index of the selected subtitle track (index in subtitle track lists)
         * @type {number}
         */
        get: function () {
            var subtitleTrackController = this.subtitleTrackController;
            return subtitleTrackController ? subtitleTrackController.subtitleTrack : -1;
        },
        /**
         * select an subtitle track, based on its index in subtitle track lists
         * @type{number}
         */
        set: function (subtitleTrackId) {
            var subtitleTrackController = this.subtitleTrackController;
            if (subtitleTrackController) {
                subtitleTrackController.subtitleTrack = subtitleTrackId;
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Hls.prototype, "subtitleDisplay", {
        /**
         * @type {boolean}
         */
        get: function () {
            var subtitleTrackController = this.subtitleTrackController;
            return subtitleTrackController ? subtitleTrackController.subtitleDisplay : false;
        },
        /**
         * Enable/disable subtitle display rendering
         * @type {boolean}
         */
        set: function (value) {
            var subtitleTrackController = this.subtitleTrackController;
            if (subtitleTrackController) {
                subtitleTrackController.subtitleDisplay = value;
            }
        },
        enumerable: true,
        configurable: true
    });
    return Hls;
}(observer_1.Observer));
exports.default = Hls;


/***/ }),

/***/ "./src/is-supported.js":
/*!*****************************!*\
  !*** ./src/is-supported.js ***!
  \*****************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var mediasource_helper_1 = __webpack_require__(/*! ./utils/mediasource-helper */ "./src/utils/mediasource-helper.js");
function isSupported() {
    var mediaSource = mediasource_helper_1.getMediaSource();
    var sourceBuffer = window.SourceBuffer || window.WebKitSourceBuffer;
    var isTypeSupported = mediaSource &&
        typeof mediaSource.isTypeSupported === 'function' &&
        mediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
    // if SourceBuffer is exposed ensure its API is valid
    // safari and old version of Chrome doe not expose SourceBuffer globally so checking SourceBuffer.prototype is impossible
    var sourceBufferValidAPI = !sourceBuffer ||
        (sourceBuffer.prototype &&
            typeof sourceBuffer.prototype.appendBuffer === 'function' &&
            typeof sourceBuffer.prototype.remove === 'function');
    return !!isTypeSupported && !!sourceBufferValidAPI;
}
exports.isSupported = isSupported;


/***/ }),

/***/ "./src/loader/fragment-loader.js":
/*!***************************************!*\
  !*** ./src/loader/fragment-loader.js ***!
  \***************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/*
 * Fragment Loader
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var FragmentLoader = /** @class */ (function (_super) {
    __extends(FragmentLoader, _super);
    function FragmentLoader(hls) {
        var _this = _super.call(this, hls, events_1.default.FRAG_LOADING) || this;
        _this.loaders = {};
        return _this;
    }
    FragmentLoader.prototype.destroy = function () {
        var loaders = this.loaders;
        for (var loaderName in loaders) {
            var loader = loaders[loaderName];
            if (loader) {
                loader.destroy();
            }
        }
        this.loaders = {};
        _super.prototype.destroy.call(this);
    };
    FragmentLoader.prototype.onFragLoading = function (data) {
        var frag = data.frag, type = frag.type, loaders = this.loaders, config = this.hls.config, FragmentILoader = config.fLoader, DefaultILoader = config.loader;
        // reset fragment state
        frag.loaded = 0;
        var loader = loaders[type];
        if (loader) {
            logger_1.logger.warn("abort previous fragment loader for type: " + type);
            loader.abort();
        }
        loader = loaders[type] = frag.loader =
            config.fLoader ? new FragmentILoader(config) : new DefaultILoader(config);
        var loaderContext, loaderConfig, loaderCallbacks;
        loaderContext = { url: frag.url, frag: frag, responseType: 'arraybuffer', progressData: false };
        var start = frag.byteRangeStartOffset, end = frag.byteRangeEndOffset;
        if (Number.isFinite(start) && Number.isFinite(end)) {
            loaderContext.rangeStart = start;
            loaderContext.rangeEnd = end;
        }
        loaderConfig = {
            timeout: config.fragLoadingTimeOut,
            maxRetry: 0,
            retryDelay: 0,
            maxRetryDelay: config.fragLoadingMaxRetryTimeout
        };
        loaderCallbacks = {
            onSuccess: this.loadsuccess.bind(this),
            onError: this.loaderror.bind(this),
            onTimeout: this.loadtimeout.bind(this),
            onProgress: this.loadprogress.bind(this)
        };
        loader.load(loaderContext, loaderConfig, loaderCallbacks);
    };
    FragmentLoader.prototype.loadsuccess = function (response, stats, context, networkDetails) {
        if (networkDetails === void 0) { networkDetails = null; }
        var payload = response.data, frag = context.frag;
        // detach fragment loader on load success
        frag.loader = undefined;
        this.loaders[frag.type] = undefined;
        this.hls.trigger(events_1.default.FRAG_LOADED, { payload: payload, frag: frag, stats: stats, networkDetails: networkDetails });
    };
    FragmentLoader.prototype.loaderror = function (response, context, networkDetails) {
        if (networkDetails === void 0) { networkDetails = null; }
        var frag = context.frag;
        var loader = frag.loader;
        if (loader) {
            loader.abort();
        }
        this.loaders[frag.type] = undefined;
        this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.NETWORK_ERROR, details: errors_1.ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: context.frag, response: response, networkDetails: networkDetails });
    };
    FragmentLoader.prototype.loadtimeout = function (stats, context, networkDetails) {
        if (networkDetails === void 0) { networkDetails = null; }
        var frag = context.frag;
        var loader = frag.loader;
        if (loader) {
            loader.abort();
        }
        this.loaders[frag.type] = undefined;
        this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.NETWORK_ERROR, details: errors_1.ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: context.frag, networkDetails: networkDetails });
    };
    // data will be used for progressive parsing
    FragmentLoader.prototype.loadprogress = function (stats, context, data, networkDetails) {
        if (networkDetails === void 0) { networkDetails = null; }
        var frag = context.frag;
        frag.loaded = stats.loaded;
        this.hls.trigger(events_1.default.FRAG_LOAD_PROGRESS, { frag: frag, stats: stats, networkDetails: networkDetails });
    };
    return FragmentLoader;
}(event_handler_1.default));
exports.default = FragmentLoader;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/loader/fragment.js":
/*!********************************!*\
  !*** ./src/loader/fragment.js ***!
  \********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var URLToolkit = __webpack_require__(/*! url-toolkit */ "./node_modules/url-toolkit/src/url-toolkit.js");
var level_key_1 = __webpack_require__(/*! ./level-key */ "./src/loader/level-key.js");
var Fragment = /** @class */ (function () {
    function Fragment() {
        var _a;
        this._url = null;
        this._byteRange = null;
        this._decryptdata = null;
        this.tagList = [];
        this.programDateTime = null;
        this.rawProgramDateTime = null;
        // Holds the types of data this fragment supports
        this._elementaryStreams = (_a = {},
            _a[Fragment.ElementaryStreamTypes.AUDIO] = false,
            _a[Fragment.ElementaryStreamTypes.VIDEO] = false,
            _a);
    }
    Object.defineProperty(Fragment, "ElementaryStreamTypes", {
        /**
         * `type` property for this._elementaryStreams
         *
         * @enum
         */
        get: function () {
            return {
                AUDIO: 'audio',
                VIDEO: 'video'
            };
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Fragment.prototype, "url", {
        get: function () {
            if (!this._url && this.relurl) {
                this._url = URLToolkit.buildAbsoluteURL(this.baseurl, this.relurl, { alwaysNormalize: true });
            }
            return this._url;
        },
        set: function (value) {
            this._url = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Fragment.prototype, "byteRange", {
        get: function () {
            if (!this._byteRange && !this.rawByteRange) {
                return [];
            }
            if (this._byteRange) {
                return this._byteRange;
            }
            var byteRange = [];
            if (this.rawByteRange) {
                var params = this.rawByteRange.split('@', 2);
                if (params.length === 1) {
                    var lastByteRangeEndOffset = this.lastByteRangeEndOffset;
                    byteRange[0] = lastByteRangeEndOffset || 0;
                }
                else {
                    byteRange[0] = parseInt(params[1]);
                }
                byteRange[1] = parseInt(params[0]) + byteRange[0];
                this._byteRange = byteRange;
            }
            return byteRange;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Fragment.prototype, "byteRangeStartOffset", {
        /**
         * @type {number}
         */
        get: function () {
            return this.byteRange[0];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Fragment.prototype, "byteRangeEndOffset", {
        get: function () {
            return this.byteRange[1];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Fragment.prototype, "decryptdata", {
        get: function () {
            if (!this._decryptdata) {
                this._decryptdata = this.fragmentDecryptdataFromLevelkey(this.levelkey, this.sn);
            }
            return this._decryptdata;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Fragment.prototype, "endProgramDateTime", {
        get: function () {
            if (!Number.isFinite(this.programDateTime)) {
                return null;
            }
            var duration = !Number.isFinite(this.duration) ? 0 : this.duration;
            return this.programDateTime + (duration * 1000);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Fragment.prototype, "encrypted", {
        get: function () {
            return !!((this.decryptdata && this.decryptdata.uri !== null) && (this.decryptdata.key === null));
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {ElementaryStreamType} type
     */
    Fragment.prototype.addElementaryStream = function (type) {
        this._elementaryStreams[type] = true;
    };
    /**
     * @param {ElementaryStreamType} type
     */
    Fragment.prototype.hasElementaryStream = function (type) {
        return this._elementaryStreams[type] === true;
    };
    /**
     * Utility method for parseLevelPlaylist to create an initialization vector for a given segment
     * @returns {Uint8Array}
     */
    Fragment.prototype.createInitializationVector = function (segmentNumber) {
        var uint8View = new Uint8Array(16);
        for (var i = 12; i < 16; i++) {
            uint8View[i] = (segmentNumber >> 8 * (15 - i)) & 0xff;
        }
        return uint8View;
    };
    /**
     * Utility method for parseLevelPlaylist to get a fragment's decryption data from the currently parsed encryption key data
     * @param levelkey - a playlist's encryption info
     * @param segmentNumber - the fragment's segment number
     * @returns {*} - an object to be applied as a fragment's decryptdata
     */
    Fragment.prototype.fragmentDecryptdataFromLevelkey = function (levelkey, segmentNumber) {
        var decryptdata = levelkey;
        if (levelkey && levelkey.method && levelkey.uri && !levelkey.iv) {
            decryptdata = new level_key_1.default();
            decryptdata.method = levelkey.method;
            decryptdata.baseuri = levelkey.baseuri;
            decryptdata.reluri = levelkey.reluri;
            decryptdata.iv = this.createInitializationVector(segmentNumber);
        }
        return decryptdata;
    };
    return Fragment;
}());
exports.default = Fragment;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/loader/key-loader.js":
/*!**********************************!*\
  !*** ./src/loader/key-loader.js ***!
  \**********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * Decrypt key Loader
*/
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var KeyLoader = /** @class */ (function (_super) {
    __extends(KeyLoader, _super);
    function KeyLoader(hls) {
        var _this = _super.call(this, hls, events_1.default.KEY_LOADING) || this;
        _this.loaders = {};
        _this.decryptkey = null;
        _this.decrypturl = null;
        return _this;
    }
    KeyLoader.prototype.destroy = function () {
        for (var loaderName in this.loaders) {
            var loader = this.loaders[loaderName];
            if (loader) {
                loader.destroy();
            }
        }
        this.loaders = {};
        event_handler_1.default.prototype.destroy.call(this);
    };
    KeyLoader.prototype.onKeyLoading = function (data) {
        var frag = data.frag, type = frag.type, loader = this.loaders[type], decryptdata = frag.decryptdata, uri = decryptdata.uri;
        // if uri is different from previous one or if decrypt key not retrieved yet
        if (uri !== this.decrypturl || this.decryptkey === null) {
            var config = this.hls.config;
            if (loader) {
                logger_1.logger.warn("abort previous key loader for type:" + type);
                loader.abort();
            }
            frag.loader = this.loaders[type] = new config.loader(config);
            this.decrypturl = uri;
            this.decryptkey = null;
            var loaderContext = void 0, loaderConfig = void 0, loaderCallbacks = void 0;
            loaderContext = { url: uri, frag: frag, responseType: 'arraybuffer' };
            // maxRetry is 0 so that instead of retrying the same key on the same variant multiple times,
            // key-loader will trigger an error and rely on stream-controller to handle retry logic.
            // this will also align retry logic with fragment-loader
            loaderConfig = { timeout: config.fragLoadingTimeOut, maxRetry: 0, retryDelay: config.fragLoadingRetryDelay, maxRetryDelay: config.fragLoadingMaxRetryTimeout };
            loaderCallbacks = { onSuccess: this.loadsuccess.bind(this), onError: this.loaderror.bind(this), onTimeout: this.loadtimeout.bind(this) };
            frag.loader.load(loaderContext, loaderConfig, loaderCallbacks);
        }
        else if (this.decryptkey) {
            // we already loaded this key, return it
            decryptdata.key = this.decryptkey;
            this.hls.trigger(events_1.default.KEY_LOADED, { frag: frag });
        }
    };
    KeyLoader.prototype.loadsuccess = function (response, stats, context) {
        var frag = context.frag;
        this.decryptkey = frag.decryptdata.key = new Uint8Array(response.data);
        // detach fragment loader on load success
        frag.loader = undefined;
        this.loaders[frag.type] = undefined;
        this.hls.trigger(events_1.default.KEY_LOADED, { frag: frag });
    };
    KeyLoader.prototype.loaderror = function (response, context) {
        var frag = context.frag, loader = frag.loader;
        if (loader) {
            loader.abort();
        }
        this.loaders[context.type] = undefined;
        this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.NETWORK_ERROR, details: errors_1.ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: frag, response: response });
    };
    KeyLoader.prototype.loadtimeout = function (stats, context) {
        var frag = context.frag, loader = frag.loader;
        if (loader) {
            loader.abort();
        }
        this.loaders[context.type] = undefined;
        this.hls.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.NETWORK_ERROR, details: errors_1.ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: frag });
    };
    return KeyLoader;
}(event_handler_1.default));
exports.default = KeyLoader;


/***/ }),

/***/ "./src/loader/level-key.js":
/*!*********************************!*\
  !*** ./src/loader/level-key.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var URLToolkit = __webpack_require__(/*! url-toolkit */ "./node_modules/url-toolkit/src/url-toolkit.js");
var LevelKey = /** @class */ (function () {
    function LevelKey() {
        this.method = null;
        this.key = null;
        this.iv = null;
        this._uri = null;
    }
    Object.defineProperty(LevelKey.prototype, "uri", {
        get: function () {
            if (!this._uri && this.reluri) {
                this._uri = URLToolkit.buildAbsoluteURL(this.baseuri, this.reluri, { alwaysNormalize: true });
            }
            return this._uri;
        },
        enumerable: true,
        configurable: true
    });
    return LevelKey;
}());
exports.default = LevelKey;


/***/ }),

/***/ "./src/loader/level.js":
/*!*****************************!*\
  !*** ./src/loader/level.js ***!
  \*****************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var Level = /** @class */ (function () {
    function Level(baseUrl) {
        // Please keep properties in alphabetical order
        this.endCC = 0;
        this.endSN = 0;
        this.fragments = [];
        this.initSegment = null;
        this.live = true;
        this.needSidxRanges = false;
        this.startCC = 0;
        this.startSN = 0;
        this.startTimeOffset = null;
        this.targetduration = 0;
        this.totalduration = 0;
        this.type = null;
        this.url = baseUrl;
        this.version = null;
    }
    Object.defineProperty(Level.prototype, "hasProgramDateTime", {
        get: function () {
            return !!(this.fragments[0] && Number.isFinite(this.fragments[0].programDateTime));
        },
        enumerable: true,
        configurable: true
    });
    return Level;
}());
exports.default = Level;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/loader/m3u8-parser.js":
/*!***********************************!*\
  !*** ./src/loader/m3u8-parser.js ***!
  \***********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var URLToolkit = __webpack_require__(/*! url-toolkit */ "./node_modules/url-toolkit/src/url-toolkit.js");
var fragment_1 = __webpack_require__(/*! ./fragment */ "./src/loader/fragment.js");
var level_1 = __webpack_require__(/*! ./level */ "./src/loader/level.js");
var level_key_1 = __webpack_require__(/*! ./level-key */ "./src/loader/level-key.js");
var attr_list_1 = __webpack_require__(/*! ../utils/attr-list */ "./src/utils/attr-list.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var codecs_1 = __webpack_require__(/*! ../utils/codecs */ "./src/utils/codecs.js");
/**
 * M3U8 parser
 * @module
 */
// https://regex101.com is your friend
var MASTER_PLAYLIST_REGEX = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
var MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;
var LEVEL_PLAYLIST_REGEX_FAST = new RegExp([
    /#EXTINF:\s*(\d*(?:\.\d+)?)(?:,(.*)\s+)?/.source,
    /|(?!#)([\S+ ?]+)/.source,
    /|#EXT-X-BYTERANGE:*(.+)/.source,
    /|#EXT-X-PROGRAM-DATE-TIME:(.+)/.source,
    /|#.*/.source // All other non-segment oriented tags will match with all groups empty
].join(''), 'g');
var LEVEL_PLAYLIST_REGEX_SLOW = /(?:(?:#(EXTM3U))|(?:#EXT-X-(PLAYLIST-TYPE):(.+))|(?:#EXT-X-(MEDIA-SEQUENCE): *(\d+))|(?:#EXT-X-(TARGETDURATION): *(\d+))|(?:#EXT-X-(KEY):(.+))|(?:#EXT-X-(START):(.+))|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DISCONTINUITY-SEQ)UENCE:(\d+))|(?:#EXT-X-(DIS)CONTINUITY))|(?:#EXT-X-(VERSION):(\d+))|(?:#EXT-X-(MAP):(.+))|(?:(#)([^:]*):(.*))|(?:(#)(.*))(?:.*)\r?\n?/;
var MP4_REGEX_SUFFIX = /\.(mp4|m4s|m4v|m4a)$/i;
var M3U8Parser = /** @class */ (function () {
    function M3U8Parser() {
    }
    M3U8Parser.findGroup = function (groups, mediaGroupId) {
        if (!groups) {
            return null;
        }
        var matchingGroup = null;
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            if (group.id === mediaGroupId) {
                matchingGroup = group;
            }
        }
        return matchingGroup;
    };
    M3U8Parser.convertAVC1ToAVCOTI = function (codec) {
        var result, avcdata = codec.split('.');
        if (avcdata.length > 2) {
            result = avcdata.shift() + '.';
            result += parseInt(avcdata.shift()).toString(16);
            result += ('000' + parseInt(avcdata.shift()).toString(16)).substr(-4);
        }
        else {
            result = codec;
        }
        return result;
    };
    M3U8Parser.resolve = function (url, baseUrl) {
        return URLToolkit.buildAbsoluteURL(baseUrl, url, { alwaysNormalize: true });
    };
    M3U8Parser.parseMasterPlaylist = function (string, baseurl) {
        var levels = [], result;
        MASTER_PLAYLIST_REGEX.lastIndex = 0;
        function setCodecs(codecs, level) {
            ['video', 'audio'].forEach(function (type) {
                var filtered = codecs.filter(function (codec) { return codecs_1.isCodecType(codec, type); });
                if (filtered.length) {
                    var preferred = filtered.filter(function (codec) {
                        return codec.lastIndexOf('avc1', 0) === 0 || codec.lastIndexOf('mp4a', 0) === 0;
                    });
                    level[type + "Codec"] = preferred.length > 0 ? preferred[0] : filtered[0];
                    // remove from list
                    codecs = codecs.filter(function (codec) { return filtered.indexOf(codec) === -1; });
                }
            });
            level.unknownCodecs = codecs;
        }
        while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
            var level = {};
            var attrs = level.attrs = new attr_list_1.default(result[1]);
            level.url = M3U8Parser.resolve(result[2], baseurl);
            var resolution = attrs.decimalResolution('RESOLUTION');
            if (resolution) {
                level.width = resolution.width;
                level.height = resolution.height;
            }
            level.bitrate = attrs.decimalInteger('AVERAGE-BANDWIDTH') || attrs.decimalInteger('BANDWIDTH');
            level.name = attrs.NAME;
            setCodecs([].concat((attrs.CODECS || '').split(/[ ,]+/)), level);
            if (level.videoCodec && level.videoCodec.indexOf('avc1') !== -1) {
                level.videoCodec = M3U8Parser.convertAVC1ToAVCOTI(level.videoCodec);
            }
            levels.push(level);
        }
        return levels;
    };
    M3U8Parser.parseMasterPlaylistMedia = function (string, baseurl, type, audioGroups) {
        if (audioGroups === void 0) { audioGroups = []; }
        var result;
        var medias = [];
        var id = 0;
        MASTER_PLAYLIST_MEDIA_REGEX.lastIndex = 0;
        while ((result = MASTER_PLAYLIST_MEDIA_REGEX.exec(string)) !== null) {
            var media = {};
            var attrs = new attr_list_1.default(result[1]);
            if (attrs.TYPE === type) {
                media.groupId = attrs['GROUP-ID'];
                media.name = attrs.NAME;
                media.type = type;
                media.default = (attrs.DEFAULT === 'YES');
                media.autoselect = (attrs.AUTOSELECT === 'YES');
                media.forced = (attrs.FORCED === 'YES');
                if (attrs.URI) {
                    media.url = M3U8Parser.resolve(attrs.URI, baseurl);
                }
                media.lang = attrs.LANGUAGE;
                if (!media.name) {
                    media.name = media.lang;
                }
                if (audioGroups.length) {
                    var groupCodec = M3U8Parser.findGroup(audioGroups, media.groupId);
                    media.audioCodec = groupCodec ? groupCodec.codec : audioGroups[0].codec;
                }
                media.id = id++;
                medias.push(media);
            }
        }
        return medias;
    };
    M3U8Parser.parseLevelPlaylist = function (string, baseurl, id, type, levelUrlId) {
        var currentSN = 0;
        var totalduration = 0;
        var level = new level_1.default(baseurl);
        var levelkey = new level_key_1.default();
        var cc = 0;
        var prevFrag = null;
        var frag = new fragment_1.default();
        var result;
        var i;
        var firstPdtIndex = null;
        LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;
        while ((result = LEVEL_PLAYLIST_REGEX_FAST.exec(string)) !== null) {
            var duration = result[1];
            if (duration) { // INF
                frag.duration = parseFloat(duration);
                // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
                var title = (' ' + result[2]).slice(1);
                frag.title = title || null;
                frag.tagList.push(title ? ['INF', duration, title] : ['INF', duration]);
            }
            else if (result[3]) { // url
                if (Number.isFinite(frag.duration)) {
                    var sn = currentSN++;
                    frag.type = type;
                    frag.start = totalduration;
                    frag.levelkey = levelkey;
                    frag.sn = sn;
                    frag.level = id;
                    frag.cc = cc;
                    frag.urlId = levelUrlId;
                    frag.baseurl = baseurl;
                    // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
                    frag.relurl = (' ' + result[3]).slice(1);
                    assignProgramDateTime(frag, prevFrag);
                    level.fragments.push(frag);
                    prevFrag = frag;
                    totalduration += frag.duration;
                    frag = new fragment_1.default();
                }
            }
            else if (result[4]) { // X-BYTERANGE
                frag.rawByteRange = (' ' + result[4]).slice(1);
                if (prevFrag) {
                    var lastByteRangeEndOffset = prevFrag.byteRangeEndOffset;
                    if (lastByteRangeEndOffset) {
                        frag.lastByteRangeEndOffset = lastByteRangeEndOffset;
                    }
                }
            }
            else if (result[5]) { // PROGRAM-DATE-TIME
                // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
                frag.rawProgramDateTime = (' ' + result[5]).slice(1);
                frag.tagList.push(['PROGRAM-DATE-TIME', frag.rawProgramDateTime]);
                if (firstPdtIndex === null) {
                    firstPdtIndex = level.fragments.length;
                }
            }
            else {
                result = result[0].match(LEVEL_PLAYLIST_REGEX_SLOW);
                for (i = 1; i < result.length; i++) {
                    if (result[i] !== undefined) {
                        break;
                    }
                }
                // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
                var value1 = (' ' + result[i + 1]).slice(1);
                var value2 = (' ' + result[i + 2]).slice(1);
                switch (result[i]) {
                    case '#':
                        frag.tagList.push(value2 ? [value1, value2] : [value1]);
                        break;
                    case 'PLAYLIST-TYPE':
                        level.type = value1.toUpperCase();
                        break;
                    case 'MEDIA-SEQUENCE':
                        currentSN = level.startSN = parseInt(value1);
                        break;
                    case 'TARGETDURATION':
                        level.targetduration = parseFloat(value1);
                        break;
                    case 'VERSION':
                        level.version = parseInt(value1);
                        break;
                    case 'EXTM3U':
                        break;
                    case 'ENDLIST':
                        level.live = false;
                        break;
                    case 'DIS':
                        cc++;
                        frag.tagList.push(['DIS']);
                        break;
                    case 'DISCONTINUITY-SEQ':
                        cc = parseInt(value1);
                        break;
                    case 'KEY':
                        // https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4
                        var decryptparams = value1;
                        var keyAttrs = new attr_list_1.default(decryptparams);
                        var decryptmethod = keyAttrs.enumeratedString('METHOD'), decrypturi = keyAttrs.URI, decryptiv = keyAttrs.hexadecimalInteger('IV');
                        if (decryptmethod) {
                            levelkey = new level_key_1.default();
                            if ((decrypturi) && (['AES-128', 'SAMPLE-AES', 'SAMPLE-AES-CENC'].indexOf(decryptmethod) >= 0)) {
                                levelkey.method = decryptmethod;
                                // URI to get the key
                                levelkey.baseuri = baseurl;
                                levelkey.reluri = decrypturi;
                                levelkey.key = null;
                                // Initialization Vector (IV)
                                levelkey.iv = decryptiv;
                            }
                        }
                        break;
                    case 'START':
                        var startParams = value1;
                        var startAttrs = new attr_list_1.default(startParams);
                        var startTimeOffset = startAttrs.decimalFloatingPoint('TIME-OFFSET');
                        // TIME-OFFSET can be 0
                        if (Number.isFinite(startTimeOffset)) {
                            level.startTimeOffset = startTimeOffset;
                        }
                        break;
                    case 'MAP':
                        var mapAttrs = new attr_list_1.default(value1);
                        frag.relurl = mapAttrs.URI;
                        frag.rawByteRange = mapAttrs.BYTERANGE;
                        frag.baseurl = baseurl;
                        frag.level = id;
                        frag.type = type;
                        frag.sn = 'initSegment';
                        level.initSegment = frag;
                        frag = new fragment_1.default();
                        frag.rawProgramDateTime = level.initSegment.rawProgramDateTime;
                        break;
                    default:
                        logger_1.logger.warn("line parsed but not handled: " + result);
                        break;
                }
            }
        }
        frag = prevFrag;
        // logger.log('found ' + level.fragments.length + ' fragments');
        if (frag && !frag.relurl) {
            level.fragments.pop();
            totalduration -= frag.duration;
        }
        level.totalduration = totalduration;
        level.averagetargetduration = totalduration / level.fragments.length;
        level.endSN = currentSN - 1;
        level.startCC = level.fragments[0] ? level.fragments[0].cc : 0;
        level.endCC = cc;
        if (!level.initSegment && level.fragments.length) {
            // this is a bit lurky but HLS really has no other way to tell us
            // if the fragments are TS or MP4, except if we download them :/
            // but this is to be able to handle SIDX.
            if (level.fragments.every(function (frag) { return MP4_REGEX_SUFFIX.test(frag.relurl); })) {
                logger_1.logger.warn('MP4 fragments found but no init segment (probably no MAP, incomplete M3U8), trying to fetch SIDX');
                frag = new fragment_1.default();
                frag.relurl = level.fragments[0].relurl;
                frag.baseurl = baseurl;
                frag.level = id;
                frag.type = type;
                frag.sn = 'initSegment';
                level.initSegment = frag;
                level.needSidxRanges = true;
            }
        }
        /**
         * Backfill any missing PDT values
           "If the first EXT-X-PROGRAM-DATE-TIME tag in a Playlist appears after
           one or more Media Segment URIs, the client SHOULD extrapolate
           backward from that tag (using EXTINF durations and/or media
           timestamps) to associate dates with those segments."
         * We have already extrapolated forward, but all fragments up to the first instance of PDT do not have their PDTs
         * computed.
         */
        if (firstPdtIndex) {
            backfillProgramDateTimes(level.fragments, firstPdtIndex);
        }
        return level;
    };
    return M3U8Parser;
}());
exports.default = M3U8Parser;
function backfillProgramDateTimes(fragments, startIndex) {
    var fragPrev = fragments[startIndex];
    for (var i = startIndex - 1; i >= 0; i--) {
        var frag = fragments[i];
        frag.programDateTime = fragPrev.programDateTime - (frag.duration * 1000);
        fragPrev = frag;
    }
}
function assignProgramDateTime(frag, prevFrag) {
    if (frag.rawProgramDateTime) {
        frag.programDateTime = Date.parse(frag.rawProgramDateTime);
    }
    else if (prevFrag && prevFrag.programDateTime) {
        frag.programDateTime = prevFrag.endProgramDateTime;
    }
    if (!Number.isFinite(frag.programDateTime)) {
        frag.programDateTime = null;
        frag.rawProgramDateTime = null;
    }
}

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/loader/playlist-loader.js":
/*!***************************************!*\
  !*** ./src/loader/playlist-loader.js ***!
  \***************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
/**
 * PlaylistLoader - delegate for media manifest/playlist loading tasks. Takes care of parsing media to internal data-models.
 *
 * Once loaded, dispatches events with parsed data-models of manifest/levels/audio/subtitle tracks.
 *
 * Uses loader(s) set in config to do actual internal loading of resource tasks.
 *
 * @module
 *
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var event_handler_1 = __webpack_require__(/*! ../event-handler */ "./src/event-handler.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var mp4demuxer_1 = __webpack_require__(/*! ../demux/mp4demuxer */ "./src/demux/mp4demuxer.js");
var m3u8_parser_1 = __webpack_require__(/*! ./m3u8-parser */ "./src/loader/m3u8-parser.js");
var performance = window.performance;
/**
 * `type` property values for this loaders' context object
 * @enum
 *
 */
var ContextType = {
    MANIFEST: 'manifest',
    LEVEL: 'level',
    AUDIO_TRACK: 'audioTrack',
    SUBTITLE_TRACK: 'subtitleTrack'
};
/**
 * @enum {string}
 */
var LevelType = {
    MAIN: 'main',
    AUDIO: 'audio',
    SUBTITLE: 'subtitle'
};
/**
 * @constructor
 */
var PlaylistLoader = /** @class */ (function (_super) {
    __extends(PlaylistLoader, _super);
    /**
     * @constructs
     * @param {Hls} hls
     */
    function PlaylistLoader(hls) {
        var _this = _super.call(this, hls, events_1.default.MANIFEST_LOADING, events_1.default.LEVEL_LOADING, events_1.default.AUDIO_TRACK_LOADING, events_1.default.SUBTITLE_TRACK_LOADING) || this;
        _this.loaders = {};
        return _this;
    }
    Object.defineProperty(PlaylistLoader, "ContextType", {
        get: function () {
            return ContextType;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(PlaylistLoader, "LevelType", {
        get: function () {
            return LevelType;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * @param {ContextType} type
     * @returns {boolean}
     */
    PlaylistLoader.canHaveQualityLevels = function (type) {
        return (type !== ContextType.AUDIO_TRACK &&
            type !== ContextType.SUBTITLE_TRACK);
    };
    /**
     * Map context.type to LevelType
     * @param {{type: ContextType}} context
     * @returns {LevelType}
     */
    PlaylistLoader.mapContextToLevelType = function (context) {
        var type = context.type;
        switch (type) {
            case ContextType.AUDIO_TRACK:
                return LevelType.AUDIO;
            case ContextType.SUBTITLE_TRACK:
                return LevelType.SUBTITLE;
            default:
                return LevelType.MAIN;
        }
    };
    PlaylistLoader.getResponseUrl = function (response, context) {
        var url = response.url;
        // responseURL not supported on some browsers (it is used to detect URL redirection)
        // data-uri mode also not supported (but no need to detect redirection)
        if (url === undefined || url.indexOf('data:') === 0) {
            // fallback to initial URL
            url = context.url;
        }
        return url;
    };
    /**
     * Returns defaults or configured loader-type overloads (pLoader and loader config params)
     * Default loader is XHRLoader (see utils)
     * @param {object} context
     * @returns {XHRLoader} or other compatible configured overload
     */
    PlaylistLoader.prototype.createInternalLoader = function (context) {
        var config = this.hls.config;
        var PLoader = config.pLoader;
        var Loader = config.loader;
        var InternalLoader = PLoader || Loader;
        var loader = new InternalLoader(config);
        context.loader = loader;
        this.loaders[context.type] = loader;
        return loader;
    };
    PlaylistLoader.prototype.getInternalLoader = function (context) {
        return this.loaders[context.type];
    };
    PlaylistLoader.prototype.resetInternalLoader = function (contextType) {
        if (this.loaders[contextType]) {
            delete this.loaders[contextType];
        }
    };
    /**
     * Call `destroy` on all internal loader instances mapped (one per context type)
     */
    PlaylistLoader.prototype.destroyInternalLoaders = function () {
        for (var contextType in this.loaders) {
            var loader = this.loaders[contextType];
            if (loader) {
                loader.destroy();
            }
            this.resetInternalLoader(contextType);
        }
    };
    PlaylistLoader.prototype.destroy = function () {
        this.destroyInternalLoaders();
        _super.prototype.destroy.call(this);
    };
    PlaylistLoader.prototype.onManifestLoading = function (data) {
        this.load(data.url, { type: ContextType.MANIFEST, level: 0, id: null });
    };
    PlaylistLoader.prototype.onLevelLoading = function (data) {
        this.load(data.url, { type: ContextType.LEVEL, level: data.level, id: data.id });
    };
    PlaylistLoader.prototype.onAudioTrackLoading = function (data) {
        this.load(data.url, { type: ContextType.AUDIO_TRACK, level: null, id: data.id });
    };
    PlaylistLoader.prototype.onSubtitleTrackLoading = function (data) {
        this.load(data.url, { type: ContextType.SUBTITLE_TRACK, level: null, id: data.id });
    };
    PlaylistLoader.prototype.load = function (url, context) {
        var config = this.hls.config;
        logger_1.logger.debug("Loading playlist of type " + context.type + ", level: " + context.level + ", id: " + context.id);
        // Check if a loader for this context already exists
        var loader = this.getInternalLoader(context);
        if (loader) {
            var loaderContext = loader.context;
            if (loaderContext && loaderContext.url === url) { // same URL can't overlap
                logger_1.logger.trace('playlist request ongoing');
                return false;
            }
            else {
                logger_1.logger.warn("aborting previous loader for type: " + context.type);
                loader.abort();
            }
        }
        var maxRetry, timeout, retryDelay, maxRetryDelay;
        // apply different configs for retries depending on
        // context (manifest, level, audio/subs playlist)
        switch (context.type) {
            case ContextType.MANIFEST:
                maxRetry = config.manifestLoadingMaxRetry;
                timeout = config.manifestLoadingTimeOut;
                retryDelay = config.manifestLoadingRetryDelay;
                maxRetryDelay = config.manifestLoadingMaxRetryTimeout;
                break;
            case ContextType.LEVEL:
                // Disable internal loader retry logic, since we are managing retries in Level Controller
                maxRetry = 0;
                timeout = config.levelLoadingTimeOut;
                // TODO Introduce retry settings for audio-track and subtitle-track, it should not use level retry config
                break;
            default:
                maxRetry = config.levelLoadingMaxRetry;
                timeout = config.levelLoadingTimeOut;
                retryDelay = config.levelLoadingRetryDelay;
                maxRetryDelay = config.levelLoadingMaxRetryTimeout;
                break;
        }
        loader = this.createInternalLoader(context);
        context.url = url;
        context.responseType = context.responseType || ''; // FIXME: (should not be necessary to do this)
        var loaderConfig = {
            timeout: timeout,
            maxRetry: maxRetry,
            retryDelay: retryDelay,
            maxRetryDelay: maxRetryDelay
        };
        var loaderCallbacks = {
            onSuccess: this.loadsuccess.bind(this),
            onError: this.loaderror.bind(this),
            onTimeout: this.loadtimeout.bind(this)
        };
        logger_1.logger.debug("Calling internal loader delegate for URL: " + url);
        loader.load(context, loaderConfig, loaderCallbacks);
        return true;
    };
    PlaylistLoader.prototype.loadsuccess = function (response, stats, context, networkDetails) {
        if (networkDetails === void 0) { networkDetails = null; }
        if (context.isSidxRequest) {
            this._handleSidxRequest(response, context);
            this._handlePlaylistLoaded(response, stats, context, networkDetails);
            return;
        }
        this.resetInternalLoader(context.type);
        var string = response.data;
        stats.tload = performance.now();
        // stats.mtime = new Date(target.getResponseHeader('Last-Modified'));
        // Validate if it is an M3U8 at all
        if (string.indexOf('#EXTM3U') !== 0) {
            this._handleManifestParsingError(response, context, 'no EXTM3U delimiter', networkDetails);
            return;
        }
        // Check if chunk-list or master. handle empty chunk list case (first EXTINF not signaled, but TARGETDURATION present)
        if (string.indexOf('#EXTINF:') > 0 || string.indexOf('#EXT-X-TARGETDURATION:') > 0) {
            this._handleTrackOrLevelPlaylist(response, stats, context, networkDetails);
        }
        else {
            this._handleMasterPlaylist(response, stats, context, networkDetails);
        }
    };
    PlaylistLoader.prototype.loaderror = function (response, context, networkDetails) {
        if (networkDetails === void 0) { networkDetails = null; }
        this._handleNetworkError(context, networkDetails, false, response);
    };
    PlaylistLoader.prototype.loadtimeout = function (stats, context, networkDetails) {
        if (networkDetails === void 0) { networkDetails = null; }
        this._handleNetworkError(context, networkDetails, true);
    };
    PlaylistLoader.prototype._handleMasterPlaylist = function (response, stats, context, networkDetails) {
        var hls = this.hls;
        var string = response.data;
        var url = PlaylistLoader.getResponseUrl(response, context);
        var levels = m3u8_parser_1.default.parseMasterPlaylist(string, url);
        if (!levels.length) {
            this._handleManifestParsingError(response, context, 'no level found in manifest', networkDetails);
            return;
        }
        // multi level playlist, parse level info
        var audioGroups = levels.map(function (level) { return ({
            id: level.attrs.AUDIO,
            codec: level.audioCodec
        }); });
        var audioTracks = m3u8_parser_1.default.parseMasterPlaylistMedia(string, url, 'AUDIO', audioGroups);
        var subtitles = m3u8_parser_1.default.parseMasterPlaylistMedia(string, url, 'SUBTITLES');
        if (audioTracks.length) {
            // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
            var embeddedAudioFound_1 = false;
            audioTracks.forEach(function (audioTrack) {
                if (!audioTrack.url) {
                    embeddedAudioFound_1 = true;
                }
            });
            // if no embedded audio track defined, but audio codec signaled in quality level,
            // we need to signal this main audio track this could happen with playlists with
            // alt audio rendition in which quality levels (main)
            // contains both audio+video. but with mixed audio track not signaled
            if (embeddedAudioFound_1 === false && levels[0].audioCodec && !levels[0].attrs.AUDIO) {
                logger_1.logger.log('audio codec signaled in quality level, but no embedded audio track signaled, create one');
                audioTracks.unshift({
                    type: 'main',
                    name: 'main'
                });
            }
        }
        hls.trigger(events_1.default.MANIFEST_LOADED, {
            levels: levels,
            audioTracks: audioTracks,
            subtitles: subtitles,
            url: url,
            stats: stats,
            networkDetails: networkDetails
        });
    };
    PlaylistLoader.prototype._handleTrackOrLevelPlaylist = function (response, stats, context, networkDetails) {
        var hls = this.hls;
        var id = context.id, level = context.level, type = context.type;
        var url = PlaylistLoader.getResponseUrl(response, context);
        var levelUrlId = Number.isFinite(id) ? id : 0;
        var levelId = Number.isFinite(level) ? level : levelUrlId;
        var levelType = PlaylistLoader.mapContextToLevelType(context);
        var levelDetails = m3u8_parser_1.default.parseLevelPlaylist(response.data, url, levelId, levelType, levelUrlId);
        // set stats on level structure
        levelDetails.tload = stats.tload;
        // We have done our first request (Manifest-type) and receive
        // not a master playlist but a chunk-list (track/level)
        // We fire the manifest-loaded event anyway with the parsed level-details
        // by creating a single-level structure for it.
        if (type === ContextType.MANIFEST) {
            var singleLevel = {
                url: url,
                details: levelDetails
            };
            hls.trigger(events_1.default.MANIFEST_LOADED, {
                levels: [singleLevel],
                audioTracks: [],
                url: url,
                stats: stats,
                networkDetails: networkDetails
            });
        }
        // save parsing time
        stats.tparsed = performance.now();
        // in case we need SIDX ranges
        // return early after calling load for
        // the SIDX box.
        if (levelDetails.needSidxRanges) {
            var sidxUrl = levelDetails.initSegment.url;
            this.load(sidxUrl, {
                isSidxRequest: true,
                type: type,
                level: level,
                levelDetails: levelDetails,
                id: id,
                rangeStart: 0,
                rangeEnd: 2048,
                responseType: 'arraybuffer'
            });
            return;
        }
        // extend the context with the new levelDetails property
        context.levelDetails = levelDetails;
        this._handlePlaylistLoaded(response, stats, context, networkDetails);
    };
    PlaylistLoader.prototype._handleSidxRequest = function (response, context) {
        var sidxInfo = mp4demuxer_1.default.parseSegmentIndex(new Uint8Array(response.data));
        // if provided fragment does not contain sidx, early return
        if (!sidxInfo) {
            return;
        }
        var sidxReferences = sidxInfo.references;
        var levelDetails = context.levelDetails;
        sidxReferences.forEach(function (segmentRef, index) {
            var segRefInfo = segmentRef.info;
            var frag = levelDetails.fragments[index];
            if (frag.byteRange.length === 0) {
                frag.rawByteRange = String(1 + segRefInfo.end - segRefInfo.start) + '@' + String(segRefInfo.start);
            }
        });
        levelDetails.initSegment.rawByteRange = String(sidxInfo.moovEndOffset) + '@0';
    };
    PlaylistLoader.prototype._handleManifestParsingError = function (response, context, reason, networkDetails) {
        this.hls.trigger(events_1.default.ERROR, {
            type: errors_1.ErrorTypes.NETWORK_ERROR,
            details: errors_1.ErrorDetails.MANIFEST_PARSING_ERROR,
            fatal: true,
            url: response.url,
            reason: reason,
            networkDetails: networkDetails
        });
    };
    PlaylistLoader.prototype._handleNetworkError = function (context, networkDetails, timeout, response) {
        if (timeout === void 0) { timeout = false; }
        if (response === void 0) { response = null; }
        logger_1.logger.info("A network error occured while loading a " + context.type + "-type playlist");
        var details;
        var fatal;
        var loader = this.getInternalLoader(context);
        switch (context.type) {
            case ContextType.MANIFEST:
                details = (timeout ? errors_1.ErrorDetails.MANIFEST_LOAD_TIMEOUT : errors_1.ErrorDetails.MANIFEST_LOAD_ERROR);
                fatal = true;
                break;
            case ContextType.LEVEL:
                details = (timeout ? errors_1.ErrorDetails.LEVEL_LOAD_TIMEOUT : errors_1.ErrorDetails.LEVEL_LOAD_ERROR);
                fatal = false;
                break;
            case ContextType.AUDIO_TRACK:
                details = (timeout ? errors_1.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT : errors_1.ErrorDetails.AUDIO_TRACK_LOAD_ERROR);
                fatal = false;
                break;
            default:
                // details = ...?
                fatal = false;
        }
        if (loader) {
            loader.abort();
            this.resetInternalLoader(context.type);
        }
        var errorData = {
            type: errors_1.ErrorTypes.NETWORK_ERROR,
            details: details,
            fatal: fatal,
            url: loader.url,
            loader: loader,
            context: context,
            networkDetails: networkDetails
        };
        if (response) {
            errorData.response = response;
        }
        this.hls.trigger(events_1.default.ERROR, errorData);
    };
    PlaylistLoader.prototype._handlePlaylistLoaded = function (response, stats, context, networkDetails) {
        var type = context.type, level = context.level, id = context.id, levelDetails = context.levelDetails;
        if (!levelDetails.targetduration) {
            this._handleManifestParsingError(response, context, 'invalid target duration', networkDetails);
            return;
        }
        var canHaveLevels = PlaylistLoader.canHaveQualityLevels(context.type);
        if (canHaveLevels) {
            this.hls.trigger(events_1.default.LEVEL_LOADED, {
                details: levelDetails,
                level: level || 0,
                id: id || 0,
                stats: stats,
                networkDetails: networkDetails
            });
        }
        else {
            switch (type) {
                case ContextType.AUDIO_TRACK:
                    this.hls.trigger(events_1.default.AUDIO_TRACK_LOADED, {
                        details: levelDetails,
                        id: id,
                        stats: stats,
                        networkDetails: networkDetails
                    });
                    break;
                case ContextType.SUBTITLE_TRACK:
                    this.hls.trigger(events_1.default.SUBTITLE_TRACK_LOADED, {
                        details: levelDetails,
                        id: id,
                        stats: stats,
                        networkDetails: networkDetails
                    });
                    break;
            }
        }
    };
    return PlaylistLoader;
}(event_handler_1.default));
exports.default = PlaylistLoader;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/observer.js":
/*!*************************!*\
  !*** ./src/observer.js ***!
  \*************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var eventemitter3_1 = __webpack_require__(/*! eventemitter3 */ "./node_modules/eventemitter3/index.js");
/**
 * @class
 *
 * Simple adapter sub-class of Nodejs-like EventEmitter.
 *
 * We simply want to pass along the event-name itself
 * in every call to a handler, which is the purpose of our `trigger` method
 * extending the standard API.
 *
 */
var Observer = /** @class */ (function (_super) {
    __extends(Observer, _super);
    function Observer() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     *
     * @param {string} event
     * @param {any} data
     */
    Observer.prototype.trigger = function (event) {
        var data = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            data[_i - 1] = arguments[_i];
        }
        this.emit.apply(this, [event, event].concat(data));
    };
    return Observer;
}(eventemitter3_1.EventEmitter));
exports.Observer = Observer;


/***/ }),

/***/ "./src/polyfills/number.js":
/*!*********************************!*\
  !*** ./src/polyfills/number.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var get_self_scope_1 = __webpack_require__(/*! ../utils/get-self-scope */ "./src/utils/get-self-scope.js");
var self = get_self_scope_1.getSelfScope();
var Number = self.Number;
exports.Number = Number;
// TODO: get rid of global polyfills and replace them with wrappers ("ponyfills")
Number.isFinite = Number.isFinite || function (value) {
    return typeof value === 'number' && isFinite(value);
};


/***/ }),

/***/ "./src/remux/aac-helper.js":
/*!*********************************!*\
  !*** ./src/remux/aac-helper.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 *  AAC helper
 */
Object.defineProperty(exports, "__esModule", { value: true });
var AAC = /** @class */ (function () {
    function AAC() {
    }
    AAC.getSilentFrame = function (codec, channelCount) {
        switch (codec) {
            case 'mp4a.40.2':
                if (channelCount === 1) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
                }
                else if (channelCount === 2) {
                    return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
                }
                else if (channelCount === 3) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
                }
                else if (channelCount === 4) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
                }
                else if (channelCount === 5) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
                }
                else if (channelCount === 6) {
                    return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
                }
                break;
            // handle HE-AAC below (mp4a.40.5 / mp4a.40.29)
            default:
                if (channelCount === 1) {
                    // ffmpeg -y -f lavfi -i "aevalsrc=0:d=0.05" -c:a libfdk_aac -profile:a aac_he -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x4e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x1c, 0x6, 0xf1, 0xc1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                }
                else if (channelCount === 2) {
                    // ffmpeg -y -f lavfi -i "aevalsrc=0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                }
                else if (channelCount === 3) {
                    // ffmpeg -y -f lavfi -i "aevalsrc=0|0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
                    return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
                }
                break;
        }
        return null;
    };
    return AAC;
}());
exports.default = AAC;


/***/ }),

/***/ "./src/remux/mp4-generator.js":
/*!************************************!*\
  !*** ./src/remux/mp4-generator.js ***!
  \************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * Generate MP4 Box
*/
Object.defineProperty(exports, "__esModule", { value: true });
var UINT32_MAX = Math.pow(2, 32) - 1;
var MP4 = /** @class */ (function () {
    function MP4() {
    }
    MP4.init = function () {
        MP4.types = {
            avc1: [],
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
            '.mp3': [],
            mvex: [],
            mvhd: [],
            pasp: [],
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
                MP4.types[i] = [
                    i.charCodeAt(0),
                    i.charCodeAt(1),
                    i.charCodeAt(2),
                    i.charCodeAt(3)
                ];
            }
        }
        var videoHdlr = new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x76, 0x69, 0x64, 0x65,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x56, 0x69, 0x64, 0x65,
            0x6f, 0x48, 0x61, 0x6e,
            0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
        ]);
        var audioHdlr = new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x73, 0x6f, 0x75, 0x6e,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x53, 0x6f, 0x75, 0x6e,
            0x64, 0x48, 0x61, 0x6e,
            0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
        ]);
        MP4.HDLR_TYPES = {
            'video': videoHdlr,
            'audio': audioHdlr
        };
        var dref = new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x01,
            0x00, 0x00, 0x00, 0x0c,
            0x75, 0x72, 0x6c, 0x20,
            0x00,
            0x00, 0x00, 0x01 // entry_flags
        ]);
        var stco = new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00 // entry_count
        ]);
        MP4.STTS = MP4.STSC = MP4.STCO = stco;
        MP4.STSZ = new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00 // sample_count
        ]);
        MP4.VMHD = new Uint8Array([
            0x00,
            0x00, 0x00, 0x01,
            0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00 // opcolor
        ]);
        MP4.SMHD = new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00 // reserved
        ]);
        MP4.STSD = new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x01
        ]); // entry_count
        var majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
        var avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
        var minorVersion = new Uint8Array([0, 0, 0, 1]);
        MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
        MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
    };
    MP4.box = function (type) {
        var payload = Array.prototype.slice.call(arguments, 1), size = 8, i = payload.length, len = i, result;
        // calculate the total size we need to allocate
        while (i--) {
            size += payload[i].byteLength;
        }
        result = new Uint8Array(size);
        result[0] = (size >> 24) & 0xff;
        result[1] = (size >> 16) & 0xff;
        result[2] = (size >> 8) & 0xff;
        result[3] = size & 0xff;
        result.set(type, 4);
        // copy the payload into the result
        for (i = 0, size = 8; i < len; i++) {
            // copy payload[i] array @ offset size
            result.set(payload[i], size);
            size += payload[i].byteLength;
        }
        return result;
    };
    MP4.hdlr = function (type) {
        return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
    };
    MP4.mdat = function (data) {
        return MP4.box(MP4.types.mdat, data);
    };
    MP4.mdhd = function (timescale, duration) {
        duration *= timescale;
        var upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
        var lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
        return MP4.box(MP4.types.mdhd, new Uint8Array([
            0x01,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
            (timescale >> 24) & 0xFF,
            (timescale >> 16) & 0xFF,
            (timescale >> 8) & 0xFF,
            timescale & 0xFF,
            (upperWordDuration >> 24),
            (upperWordDuration >> 16) & 0xFF,
            (upperWordDuration >> 8) & 0xFF,
            upperWordDuration & 0xFF,
            (lowerWordDuration >> 24),
            (lowerWordDuration >> 16) & 0xFF,
            (lowerWordDuration >> 8) & 0xFF,
            lowerWordDuration & 0xFF,
            0x55, 0xc4,
            0x00, 0x00
        ]));
    };
    MP4.mdia = function (track) {
        return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    };
    MP4.mfhd = function (sequenceNumber) {
        return MP4.box(MP4.types.mfhd, new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            (sequenceNumber >> 24),
            (sequenceNumber >> 16) & 0xFF,
            (sequenceNumber >> 8) & 0xFF,
            sequenceNumber & 0xFF // sequence_number
        ]));
    };
    MP4.minf = function (track) {
        if (track.type === 'audio') {
            return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
        }
        else {
            return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
        }
    };
    MP4.moof = function (sn, baseMediaDecodeTime, track) {
        return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
    };
    /**
   * @param tracks... (optional) {array} the tracks associated with this movie
   */
    MP4.moov = function (tracks) {
        var i = tracks.length, boxes = [];
        while (i--) {
            boxes[i] = MP4.trak(tracks[i]);
        }
        return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
    };
    MP4.mvex = function (tracks) {
        var i = tracks.length, boxes = [];
        while (i--) {
            boxes[i] = MP4.trex(tracks[i]);
        }
        return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
    };
    MP4.mvhd = function (timescale, duration) {
        duration *= timescale;
        var upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
        var lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
        var bytes = new Uint8Array([
            0x01,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
            (timescale >> 24) & 0xFF,
            (timescale >> 16) & 0xFF,
            (timescale >> 8) & 0xFF,
            timescale & 0xFF,
            (upperWordDuration >> 24),
            (upperWordDuration >> 16) & 0xFF,
            (upperWordDuration >> 8) & 0xFF,
            upperWordDuration & 0xFF,
            (lowerWordDuration >> 24),
            (lowerWordDuration >> 16) & 0xFF,
            (lowerWordDuration >> 8) & 0xFF,
            lowerWordDuration & 0xFF,
            0x00, 0x01, 0x00, 0x00,
            0x01, 0x00,
            0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0xff, 0xff, 0xff, 0xff // next_track_ID
        ]);
        return MP4.box(MP4.types.mvhd, bytes);
    };
    MP4.sdtp = function (track) {
        var samples = track.samples || [], bytes = new Uint8Array(4 + samples.length), flags, i;
        // leave the full box header (4 bytes) all zero
        // write the sample table
        for (i = 0; i < samples.length; i++) {
            flags = samples[i].flags;
            bytes[i + 4] = (flags.dependsOn << 4) |
                (flags.isDependedOn << 2) |
                (flags.hasRedundancy);
        }
        return MP4.box(MP4.types.sdtp, bytes);
    };
    MP4.stbl = function (track) {
        return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
    };
    MP4.avc1 = function (track) {
        var sps = [], pps = [], i, data, len;
        // assemble the SPSs
        for (i = 0; i < track.sps.length; i++) {
            data = track.sps[i];
            len = data.byteLength;
            sps.push((len >>> 8) & 0xFF);
            sps.push((len & 0xFF));
            // SPS
            sps = sps.concat(Array.prototype.slice.call(data));
        }
        // assemble the PPSs
        for (i = 0; i < track.pps.length; i++) {
            data = track.pps[i];
            len = data.byteLength;
            pps.push((len >>> 8) & 0xFF);
            pps.push((len & 0xFF));
            pps = pps.concat(Array.prototype.slice.call(data));
        }
        var avcc = MP4.box(MP4.types.avcC, new Uint8Array([
            0x01,
            sps[3],
            sps[4],
            sps[5],
            0xfc | 3,
            0xE0 | track.sps.length // 3bit reserved (111) + numOfSequenceParameterSets
        ].concat(sps).concat([
            track.pps.length // numOfPictureParameterSets
        ]).concat(pps))), // "PPS"
        width = track.width, height = track.height, hSpacing = track.pixelRatio[0], vSpacing = track.pixelRatio[1];
        return MP4.box(MP4.types.avc1, new Uint8Array([
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00,
            0x00, 0x01,
            0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            (width >> 8) & 0xFF,
            width & 0xff,
            (height >> 8) & 0xFF,
            height & 0xff,
            0x00, 0x48, 0x00, 0x00,
            0x00, 0x48, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01,
            0x12,
            0x64, 0x61, 0x69, 0x6C,
            0x79, 0x6D, 0x6F, 0x74,
            0x69, 0x6F, 0x6E, 0x2F,
            0x68, 0x6C, 0x73, 0x2E,
            0x6A, 0x73, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00,
            0x00, 0x18,
            0x11, 0x11
        ]), // pre_defined = -1
        avcc, MP4.box(MP4.types.btrt, new Uint8Array([
            0x00, 0x1c, 0x9c, 0x80,
            0x00, 0x2d, 0xc6, 0xc0,
            0x00, 0x2d, 0xc6, 0xc0
        ])), // avgBitrate
        MP4.box(MP4.types.pasp, new Uint8Array([
            (hSpacing >> 24),
            (hSpacing >> 16) & 0xFF,
            (hSpacing >> 8) & 0xFF,
            hSpacing & 0xFF,
            (vSpacing >> 24),
            (vSpacing >> 16) & 0xFF,
            (vSpacing >> 8) & 0xFF,
            vSpacing & 0xFF
        ])));
    };
    MP4.esds = function (track) {
        var configlen = track.config.length;
        return new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            0x03,
            0x17 + configlen,
            0x00, 0x01,
            0x00,
            0x04,
            0x0f + configlen,
            0x40,
            0x15,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x05 // descriptor_type
        ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
    };
    MP4.mp4a = function (track) {
        var samplerate = track.samplerate;
        return MP4.box(MP4.types.mp4a, new Uint8Array([
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00,
            0x00, 0x01,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, track.channelCount,
            0x00, 0x10,
            0x00, 0x00, 0x00, 0x00,
            (samplerate >> 8) & 0xFF,
            samplerate & 0xff,
            0x00, 0x00
        ]), MP4.box(MP4.types.esds, MP4.esds(track)));
    };
    MP4.mp3 = function (track) {
        var samplerate = track.samplerate;
        return MP4.box(MP4.types['.mp3'], new Uint8Array([
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00,
            0x00, 0x01,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, track.channelCount,
            0x00, 0x10,
            0x00, 0x00, 0x00, 0x00,
            (samplerate >> 8) & 0xFF,
            samplerate & 0xff,
            0x00, 0x00
        ]));
    };
    MP4.stsd = function (track) {
        if (track.type === 'audio') {
            if (!track.isAAC && track.codec === 'mp3') {
                return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp3(track));
            }
            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
        }
        else {
            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
        }
    };
    MP4.tkhd = function (track) {
        var id = track.id, duration = track.duration * track.timescale, width = track.width, height = track.height, upperWordDuration = Math.floor(duration / (UINT32_MAX + 1)), lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
        return MP4.box(MP4.types.tkhd, new Uint8Array([
            0x01,
            0x00, 0x00, 0x07,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
            (id >> 24) & 0xFF,
            (id >> 16) & 0xFF,
            (id >> 8) & 0xFF,
            id & 0xFF,
            0x00, 0x00, 0x00, 0x00,
            (upperWordDuration >> 24),
            (upperWordDuration >> 16) & 0xFF,
            (upperWordDuration >> 8) & 0xFF,
            upperWordDuration & 0xFF,
            (lowerWordDuration >> 24),
            (lowerWordDuration >> 16) & 0xFF,
            (lowerWordDuration >> 8) & 0xFF,
            lowerWordDuration & 0xFF,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00,
            0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00,
            (width >> 8) & 0xFF,
            width & 0xFF,
            0x00, 0x00,
            (height >> 8) & 0xFF,
            height & 0xFF,
            0x00, 0x00 // height
        ]));
    };
    MP4.traf = function (track, baseMediaDecodeTime) {
        var sampleDependencyTable = MP4.sdtp(track), id = track.id, upperWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1)), lowerWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
        return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            (id >> 24),
            (id >> 16) & 0XFF,
            (id >> 8) & 0XFF,
            (id & 0xFF) // track_ID
        ])), MP4.box(MP4.types.tfdt, new Uint8Array([
            0x01,
            0x00, 0x00, 0x00,
            (upperWordBaseMediaDecodeTime >> 24),
            (upperWordBaseMediaDecodeTime >> 16) & 0XFF,
            (upperWordBaseMediaDecodeTime >> 8) & 0XFF,
            (upperWordBaseMediaDecodeTime & 0xFF),
            (lowerWordBaseMediaDecodeTime >> 24),
            (lowerWordBaseMediaDecodeTime >> 16) & 0XFF,
            (lowerWordBaseMediaDecodeTime >> 8) & 0XFF,
            (lowerWordBaseMediaDecodeTime & 0xFF)
        ])), MP4.trun(track, sampleDependencyTable.length +
            16 + // tfhd
            20 + // tfdt
            8 + // traf header
            16 + // mfhd
            8 + // moof header
            8), // mdat header
        sampleDependencyTable);
    };
    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */
    MP4.trak = function (track) {
        track.duration = track.duration || 0xffffffff;
        return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    };
    MP4.trex = function (track) {
        var id = track.id;
        return MP4.box(MP4.types.trex, new Uint8Array([
            0x00,
            0x00, 0x00, 0x00,
            (id >> 24),
            (id >> 16) & 0XFF,
            (id >> 8) & 0XFF,
            (id & 0xFF),
            0x00, 0x00, 0x00, 0x01,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x01 // default_sample_flags
        ]));
    };
    MP4.trun = function (track, offset) {
        var samples = track.samples || [], len = samples.length, arraylen = 12 + (16 * len), array = new Uint8Array(arraylen), i, sample, duration, size, flags, cts;
        offset += 8 + arraylen;
        array.set([
            0x00,
            0x00, 0x0f, 0x01,
            (len >>> 24) & 0xFF,
            (len >>> 16) & 0xFF,
            (len >>> 8) & 0xFF,
            len & 0xFF,
            (offset >>> 24) & 0xFF,
            (offset >>> 16) & 0xFF,
            (offset >>> 8) & 0xFF,
            offset & 0xFF // data_offset
        ], 0);
        for (i = 0; i < len; i++) {
            sample = samples[i];
            duration = sample.duration;
            size = sample.size;
            flags = sample.flags;
            cts = sample.cts;
            array.set([
                (duration >>> 24) & 0xFF,
                (duration >>> 16) & 0xFF,
                (duration >>> 8) & 0xFF,
                duration & 0xFF,
                (size >>> 24) & 0xFF,
                (size >>> 16) & 0xFF,
                (size >>> 8) & 0xFF,
                size & 0xFF,
                (flags.isLeading << 2) | flags.dependsOn,
                (flags.isDependedOn << 6) |
                    (flags.hasRedundancy << 4) |
                    (flags.paddingValue << 1) |
                    flags.isNonSync,
                flags.degradPrio & 0xF0 << 8,
                flags.degradPrio & 0x0F,
                (cts >>> 24) & 0xFF,
                (cts >>> 16) & 0xFF,
                (cts >>> 8) & 0xFF,
                cts & 0xFF // sample_composition_time_offset
            ], 12 + 16 * i);
        }
        return MP4.box(MP4.types.trun, array);
    };
    MP4.initSegment = function (tracks) {
        if (!MP4.types) {
            MP4.init();
        }
        var movie = MP4.moov(tracks), result;
        result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
        result.set(MP4.FTYP);
        result.set(movie, MP4.FTYP.byteLength);
        return result;
    };
    return MP4;
}());
exports.default = MP4;


/***/ }),

/***/ "./src/remux/mp4-remuxer.js":
/*!**********************************!*\
  !*** ./src/remux/mp4-remuxer.js ***!
  \**********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * fMP4 remuxer
*/
Object.defineProperty(exports, "__esModule", { value: true });
var aac_helper_1 = __webpack_require__(/*! ./aac-helper */ "./src/remux/aac-helper.js");
var mp4_generator_1 = __webpack_require__(/*! ./mp4-generator */ "./src/remux/mp4-generator.js");
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var errors_1 = __webpack_require__(/*! ../errors */ "./src/errors.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
// 10 seconds
var MAX_SILENT_FRAME_DURATION = 10 * 1000;
var MP4Remuxer = /** @class */ (function () {
    function MP4Remuxer(observer, config, typeSupported, vendor) {
        this.observer = observer;
        this.config = config;
        this.typeSupported = typeSupported;
        var userAgent = navigator.userAgent;
        this.isSafari = vendor && vendor.indexOf('Apple') > -1 && userAgent && !userAgent.match('CriOS');
        this.ISGenerated = false;
    }
    MP4Remuxer.prototype.destroy = function () {
    };
    MP4Remuxer.prototype.resetTimeStamp = function (defaultTimeStamp) {
        this._initPTS = this._initDTS = defaultTimeStamp;
    };
    MP4Remuxer.prototype.resetInitSegment = function () {
        this.ISGenerated = false;
    };
    MP4Remuxer.prototype.remux = function (audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset) {
        // generate Init Segment if needed
        if (!this.ISGenerated) {
            this.generateIS(audioTrack, videoTrack, timeOffset);
        }
        if (this.ISGenerated) {
            var nbAudioSamples = audioTrack.samples.length;
            var nbVideoSamples = videoTrack.samples.length;
            var audioTimeOffset = timeOffset;
            var videoTimeOffset = timeOffset;
            if (nbAudioSamples && nbVideoSamples) {
                // timeOffset is expected to be the offset of the first timestamp of this fragment (first DTS)
                // if first audio DTS is not aligned with first video DTS then we need to take that into account
                // when providing timeOffset to remuxAudio / remuxVideo. if we don't do that, there might be a permanent / small
                // drift between audio and video streams
                var audiovideoDeltaDts = (audioTrack.samples[0].pts - videoTrack.samples[0].pts) / videoTrack.inputTimeScale;
                audioTimeOffset += Math.max(0, audiovideoDeltaDts);
                videoTimeOffset += Math.max(0, -audiovideoDeltaDts);
            }
            // Purposefully remuxing audio before video, so that remuxVideo can use nextAudioPts, which is
            // calculated in remuxAudio.
            // logger.log('nb AAC samples:' + audioTrack.samples.length);
            if (nbAudioSamples) {
                // if initSegment was generated without video samples, regenerate it again
                if (!audioTrack.timescale) {
                    logger_1.logger.warn('regenerate InitSegment as audio detected');
                    this.generateIS(audioTrack, videoTrack, timeOffset);
                }
                var audioData = this.remuxAudio(audioTrack, audioTimeOffset, contiguous, accurateTimeOffset);
                // logger.log('nb AVC samples:' + videoTrack.samples.length);
                if (nbVideoSamples) {
                    var audioTrackLength = void 0;
                    if (audioData) {
                        audioTrackLength = audioData.endPTS - audioData.startPTS;
                    }
                    // if initSegment was generated without video samples, regenerate it again
                    if (!videoTrack.timescale) {
                        logger_1.logger.warn('regenerate InitSegment as video detected');
                        this.generateIS(audioTrack, videoTrack, timeOffset);
                    }
                    this.remuxVideo(videoTrack, videoTimeOffset, contiguous, audioTrackLength, accurateTimeOffset);
                }
            }
            else {
                // logger.log('nb AVC samples:' + videoTrack.samples.length);
                if (nbVideoSamples) {
                    var videoData = this.remuxVideo(videoTrack, videoTimeOffset, contiguous, 0, accurateTimeOffset);
                    if (videoData && audioTrack.codec) {
                        this.remuxEmptyAudio(audioTrack, audioTimeOffset, contiguous, videoData);
                    }
                }
            }
        }
        // logger.log('nb ID3 samples:' + audioTrack.samples.length);
        if (id3Track.samples.length) {
            this.remuxID3(id3Track, timeOffset);
        }
        // logger.log('nb ID3 samples:' + audioTrack.samples.length);
        if (textTrack.samples.length) {
            this.remuxText(textTrack, timeOffset);
        }
        // notify end of parsing
        this.observer.trigger(events_1.default.FRAG_PARSED);
    };
    MP4Remuxer.prototype.generateIS = function (audioTrack, videoTrack, timeOffset) {
        var observer = this.observer, audioSamples = audioTrack.samples, videoSamples = videoTrack.samples, typeSupported = this.typeSupported, container = 'audio/mp4', tracks = {}, data = { tracks: tracks }, computePTSDTS = (this._initPTS === undefined), initPTS, initDTS;
        if (computePTSDTS) {
            initPTS = initDTS = Infinity;
        }
        if (audioTrack.config && audioSamples.length) {
            // let's use audio sampling rate as MP4 time scale.
            // rationale is that there is a integer nb of audio frames per audio sample (1024 for AAC)
            // using audio sampling rate here helps having an integer MP4 frame duration
            // this avoids potential rounding issue and AV sync issue
            audioTrack.timescale = audioTrack.samplerate;
            logger_1.logger.log("audio sampling rate : " + audioTrack.samplerate);
            if (!audioTrack.isAAC) {
                if (typeSupported.mpeg) { // Chrome and Safari
                    container = 'audio/mpeg';
                    audioTrack.codec = '';
                }
                else if (typeSupported.mp3) { // Firefox
                    audioTrack.codec = 'mp3';
                }
            }
            tracks.audio = {
                container: container,
                codec: audioTrack.codec,
                initSegment: !audioTrack.isAAC && typeSupported.mpeg ? new Uint8Array() : mp4_generator_1.default.initSegment([audioTrack]),
                metadata: {
                    channelCount: audioTrack.channelCount
                }
            };
            if (computePTSDTS) {
                // remember first PTS of this demuxing context. for audio, PTS = DTS
                initPTS = initDTS = audioSamples[0].pts - audioTrack.inputTimeScale * timeOffset;
            }
        }
        if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
            // let's use input time scale as MP4 video timescale
            // we use input time scale straight away to avoid rounding issues on frame duration / cts computation
            var inputTimeScale = videoTrack.inputTimeScale;
            videoTrack.timescale = inputTimeScale;
            tracks.video = {
                container: 'video/mp4',
                codec: videoTrack.codec,
                initSegment: mp4_generator_1.default.initSegment([videoTrack]),
                metadata: {
                    width: videoTrack.width,
                    height: videoTrack.height
                }
            };
            if (computePTSDTS) {
                initPTS = Math.min(initPTS, videoSamples[0].pts - inputTimeScale * timeOffset);
                initDTS = Math.min(initDTS, videoSamples[0].dts - inputTimeScale * timeOffset);
                this.observer.trigger(events_1.default.INIT_PTS_FOUND, { initPTS: initPTS });
            }
        }
        if (Object.keys(tracks).length) {
            observer.trigger(events_1.default.FRAG_PARSING_INIT_SEGMENT, data);
            this.ISGenerated = true;
            if (computePTSDTS) {
                this._initPTS = initPTS;
                this._initDTS = initDTS;
            }
        }
        else {
            observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MEDIA_ERROR, details: errors_1.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found' });
        }
    };
    MP4Remuxer.prototype.remuxVideo = function (track, timeOffset, contiguous, audioTrackLength, accurateTimeOffset) {
        var offset = 8;
        var mp4SampleDuration;
        var mdat;
        var moof;
        var firstPTS;
        var firstDTS;
        var lastPTS;
        var lastDTS;
        var timeScale = track.timescale;
        var inputSamples = track.samples;
        var outputSamples = [];
        var nbSamples = inputSamples.length;
        var ptsNormalize = this._PTSNormalize;
        var initPTS = this._initPTS;
        // if parsed fragment is contiguous with last one, let's use last DTS value as reference
        var nextAvcDts = this.nextAvcDts;
        var isSafari = this.isSafari;
        if (nbSamples === 0) {
            return;
        }
        // Safari does not like overlapping DTS on consecutive fragments. let's use nextAvcDts to overcome this if fragments are consecutive
        if (isSafari) {
            // also consider consecutive fragments as being contiguous (even if a level switch occurs),
            // for sake of clarity:
            // consecutive fragments are frags with
            //  - less than 100ms gaps between new time offset (if accurate) and next expected PTS OR
            //  - less than 200 ms PTS gaps (timeScale/5)
            contiguous |= (inputSamples.length && nextAvcDts &&
                ((accurateTimeOffset && Math.abs(timeOffset - nextAvcDts / timeScale) < 0.1) ||
                    Math.abs((inputSamples[0].pts - nextAvcDts - initPTS)) < timeScale / 5));
        }
        if (!contiguous) {
            // if not contiguous, let's use target timeOffset
            nextAvcDts = timeOffset * timeScale;
        }
        // PTS is coded on 33bits, and can loop from -2^32 to 2^32
        // ptsNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
        inputSamples.forEach(function (sample) {
            sample.pts = ptsNormalize(sample.pts - initPTS, nextAvcDts);
            sample.dts = ptsNormalize(sample.dts - initPTS, nextAvcDts);
        });
        // sort video samples by DTS then PTS then demux id order
        inputSamples.sort(function (a, b) {
            var deltadts = a.dts - b.dts;
            var deltapts = a.pts - b.pts;
            return deltadts || (deltapts || (a.id - b.id));
        });
        // handle broken streams with PTS < DTS, tolerance up 200ms (18000 in 90kHz timescale)
        var PTSDTSshift = inputSamples.reduce(function (prev, curr) { return Math.max(Math.min(prev, curr.pts - curr.dts), -18000); }, 0);
        if (PTSDTSshift < 0) {
            logger_1.logger.warn("PTS < DTS detected in video samples, shifting DTS by " + Math.round(PTSDTSshift / 90) + " ms to overcome this issue");
            for (var i = 0; i < inputSamples.length; i++) {
                inputSamples[i].dts += PTSDTSshift;
            }
        }
        // compute first DTS and last DTS, normalize them against reference value
        var sample = inputSamples[0];
        firstDTS = Math.max(sample.dts, 0);
        firstPTS = Math.max(sample.pts, 0);
        // check timestamp continuity accross consecutive fragments (this is to remove inter-fragment gap/hole)
        var delta = Math.round((firstDTS - nextAvcDts) / 90);
        // if fragment are contiguous, detect hole/overlapping between fragments
        if (contiguous) {
            if (delta) {
                if (delta > 1) {
                    logger_1.logger.log("AVC:" + delta + " ms hole between fragments detected,filling it");
                }
                else if (delta < -1) {
                    logger_1.logger.log("AVC:" + (-delta) + " ms overlapping between fragments detected");
                }
                // remove hole/gap : set DTS to next expected DTS
                firstDTS = nextAvcDts;
                inputSamples[0].dts = firstDTS;
                // offset PTS as well, ensure that PTS is smaller or equal than new DTS
                firstPTS = Math.max(firstPTS - delta, nextAvcDts);
                inputSamples[0].pts = firstPTS;
                logger_1.logger.log("Video/PTS/DTS adjusted: " + Math.round(firstPTS / 90) + "/" + Math.round(firstDTS / 90) + ",delta:" + delta + " ms");
            }
        }
        // compute lastPTS/lastDTS
        sample = inputSamples[inputSamples.length - 1];
        lastDTS = Math.max(sample.dts, 0);
        lastPTS = Math.max(sample.pts, 0, lastDTS);
        // on Safari let's signal the same sample duration for all samples
        // sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
        // set this constant duration as being the avg delta between consecutive DTS.
        if (isSafari) {
            mp4SampleDuration = Math.round((lastDTS - firstDTS) / (inputSamples.length - 1));
        }
        var nbNalu = 0, naluLen = 0;
        for (var i = 0; i < nbSamples; i++) {
            // compute total/avc sample length and nb of NAL units
            var sample_1 = inputSamples[i], units = sample_1.units, nbUnits = units.length, sampleLen = 0;
            for (var j = 0; j < nbUnits; j++) {
                sampleLen += units[j].data.length;
            }
            naluLen += sampleLen;
            nbNalu += nbUnits;
            sample_1.length = sampleLen;
            // normalize PTS/DTS
            if (isSafari) {
                // sample DTS is computed using a constant decoding offset (mp4SampleDuration) between samples
                sample_1.dts = firstDTS + i * mp4SampleDuration;
            }
            else {
                // ensure sample monotonic DTS
                sample_1.dts = Math.max(sample_1.dts, firstDTS);
            }
            // ensure that computed value is greater or equal than sample DTS
            sample_1.pts = Math.max(sample_1.pts, sample_1.dts);
        }
        /* concatenate the video data and construct the mdat in place
          (need 8 more bytes to fill length and mpdat type) */
        var mdatSize = naluLen + (4 * nbNalu) + 8;
        try {
            mdat = new Uint8Array(mdatSize);
        }
        catch (err) {
            this.observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MUX_ERROR, details: errors_1.ErrorDetails.REMUX_ALLOC_ERROR, fatal: false, bytes: mdatSize, reason: "fail allocating video mdat " + mdatSize });
            return;
        }
        var view = new DataView(mdat.buffer);
        view.setUint32(0, mdatSize);
        mdat.set(mp4_generator_1.default.types.mdat, 4);
        for (var i = 0; i < nbSamples; i++) {
            var avcSample = inputSamples[i], avcSampleUnits = avcSample.units, mp4SampleLength = 0, compositionTimeOffset = void 0;
            // convert NALU bitstream to MP4 format (prepend NALU with size field)
            for (var j = 0, nbUnits = avcSampleUnits.length; j < nbUnits; j++) {
                var unit = avcSampleUnits[j], unitData = unit.data, unitDataLen = unit.data.byteLength;
                view.setUint32(offset, unitDataLen);
                offset += 4;
                mdat.set(unitData, offset);
                offset += unitDataLen;
                mp4SampleLength += 4 + unitDataLen;
            }
            if (!isSafari) {
                // expected sample duration is the Decoding Timestamp diff of consecutive samples
                if (i < nbSamples - 1) {
                    mp4SampleDuration = inputSamples[i + 1].dts - avcSample.dts;
                }
                else {
                    var config = this.config, lastFrameDuration = avcSample.dts - inputSamples[i > 0 ? i - 1 : i].dts;
                    if (config.stretchShortVideoTrack) {
                        // In some cases, a segment's audio track duration may exceed the video track duration.
                        // Since we've already remuxed audio, and we know how long the audio track is, we look to
                        // see if the delta to the next segment is longer than maxBufferHole.
                        // If so, playback would potentially get stuck, so we artificially inflate
                        // the duration of the last frame to minimize any potential gap between segments.
                        var maxBufferHole = config.maxBufferHole, gapTolerance = Math.floor(maxBufferHole * timeScale), deltaToFrameEnd = (audioTrackLength ? firstPTS + audioTrackLength * timeScale : this.nextAudioPts) - avcSample.pts;
                        if (deltaToFrameEnd > gapTolerance) {
                            // We subtract lastFrameDuration from deltaToFrameEnd to try to prevent any video
                            // frame overlap. maxBufferHole should be >> lastFrameDuration anyway.
                            mp4SampleDuration = deltaToFrameEnd - lastFrameDuration;
                            if (mp4SampleDuration < 0) {
                                mp4SampleDuration = lastFrameDuration;
                            }
                            logger_1.logger.log("It is approximately " + deltaToFrameEnd / 90 + " ms to the next segment; using duration " + mp4SampleDuration / 90 + " ms for the last video frame.");
                        }
                        else {
                            mp4SampleDuration = lastFrameDuration;
                        }
                    }
                    else {
                        mp4SampleDuration = lastFrameDuration;
                    }
                }
                compositionTimeOffset = Math.round(avcSample.pts - avcSample.dts);
            }
            else {
                compositionTimeOffset = Math.max(0, mp4SampleDuration * Math.round((avcSample.pts - avcSample.dts) / mp4SampleDuration));
            }
            // console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
            outputSamples.push({
                size: mp4SampleLength,
                // constant duration
                duration: mp4SampleDuration,
                cts: compositionTimeOffset,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: avcSample.key ? 2 : 1,
                    isNonSync: avcSample.key ? 0 : 1
                }
            });
        }
        // next AVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
        this.nextAvcDts = lastDTS + mp4SampleDuration;
        var dropped = track.dropped;
        track.len = 0;
        track.nbNalu = 0;
        track.dropped = 0;
        if (outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
            var flags = outputSamples[0].flags;
            // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
            // https://code.google.com/p/chromium/issues/detail?id=229412
            flags.dependsOn = 2;
            flags.isNonSync = 0;
        }
        track.samples = outputSamples;
        moof = mp4_generator_1.default.moof(track.sequenceNumber++, firstDTS, track);
        track.samples = [];
        var data = {
            data1: moof,
            data2: mdat,
            startPTS: firstPTS / timeScale,
            endPTS: (lastPTS + mp4SampleDuration) / timeScale,
            startDTS: firstDTS / timeScale,
            endDTS: this.nextAvcDts / timeScale,
            type: 'video',
            hasAudio: false,
            hasVideo: true,
            nb: outputSamples.length,
            dropped: dropped
        };
        this.observer.trigger(events_1.default.FRAG_PARSING_DATA, data);
        return data;
    };
    MP4Remuxer.prototype.remuxAudio = function (track, timeOffset, contiguous, accurateTimeOffset) {
        var inputTimeScale = track.inputTimeScale;
        var mp4timeScale = track.timescale;
        var scaleFactor = inputTimeScale / mp4timeScale;
        var mp4SampleDuration = track.isAAC ? 1024 : 1152;
        var inputSampleDuration = mp4SampleDuration * scaleFactor;
        var ptsNormalize = this._PTSNormalize;
        var initPTS = this._initPTS;
        var rawMPEG = !track.isAAC && this.typeSupported.mpeg;
        var offset, mp4Sample, fillFrame, mdat, moof, firstPTS, lastPTS, inputSamples = track.samples, outputSamples = [], nextAudioPts = this.nextAudioPts;
        // for audio samples, also consider consecutive fragments as being contiguous (even if a level switch occurs),
        // for sake of clarity:
        // consecutive fragments are frags with
        //  - less than 100ms gaps between new time offset (if accurate) and next expected PTS OR
        //  - less than 20 audio frames distance
        // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
        // this helps ensuring audio continuity
        // and this also avoids audio glitches/cut when switching quality, or reporting wrong duration on first audio frame
        contiguous |= (inputSamples.length && nextAudioPts &&
            ((accurateTimeOffset && Math.abs(timeOffset - nextAudioPts / inputTimeScale) < 0.1) ||
                Math.abs((inputSamples[0].pts - nextAudioPts - initPTS)) < 20 * inputSampleDuration));
        // compute normalized PTS
        inputSamples.forEach(function (sample) {
            sample.pts = sample.dts = ptsNormalize(sample.pts - initPTS, timeOffset * inputTimeScale);
        });
        // filter out sample with negative PTS that are not playable anyway
        // if we don't remove these negative samples, they will shift all audio samples forward.
        // leading to audio overlap between current / next fragment
        inputSamples = inputSamples.filter(function (sample) {
            return sample.pts >= 0;
        });
        // in case all samples have negative PTS, and have been filtered out, return now
        if (inputSamples.length === 0) {
            return;
        }
        if (!contiguous) {
            if (!accurateTimeOffset) {
                // if frag are mot contiguous and if we cant trust time offset, let's use first sample PTS as next audio PTS
                nextAudioPts = inputSamples[0].pts;
            }
            else {
                // if timeOffset is accurate, let's use it as predicted next audio PTS
                nextAudioPts = timeOffset * inputTimeScale;
            }
        }
        // If the audio track is missing samples, the frames seem to get "left-shifted" within the
        // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
        // In an effort to prevent this from happening, we inject frames here where there are gaps.
        // When possible, we inject a silent frame; when that's not possible, we duplicate the last
        // frame.
        if (track.isAAC) {
            var maxAudioFramesDrift = this.config.maxAudioFramesDrift;
            for (var i = 0, nextPts = nextAudioPts; i < inputSamples.length;) {
                // First, let's see how far off this frame is from where we expect it to be
                var sample = inputSamples[i], delta;
                var pts = sample.pts;
                delta = pts - nextPts;
                var duration = Math.abs(1000 * delta / inputTimeScale);
                // If we're overlapping by more than a duration, drop this sample
                if (delta <= -maxAudioFramesDrift * inputSampleDuration) {
                    logger_1.logger.warn("Dropping 1 audio frame @ " + (nextPts / inputTimeScale).toFixed(3) + "s due to " + Math.round(duration) + " ms overlap.");
                    inputSamples.splice(i, 1);
                    track.len -= sample.unit.length;
                    // Don't touch nextPtsNorm or i
                } // eslint-disable-line brace-style
                // Insert missing frames if:
                // 1: We're more than maxAudioFramesDrift frame away
                // 2: Not more than MAX_SILENT_FRAME_DURATION away
                // 3: currentTime (aka nextPtsNorm) is not 0
                else if (delta >= maxAudioFramesDrift * inputSampleDuration && duration < MAX_SILENT_FRAME_DURATION && nextPts) {
                    var missing = Math.round(delta / inputSampleDuration);
                    logger_1.logger.warn("Injecting " + missing + " audio frame @ " + (nextPts / inputTimeScale).toFixed(3) + "s due to " + Math.round(1000 * delta / inputTimeScale) + " ms gap.");
                    for (var j = 0; j < missing; j++) {
                        var newStamp = Math.max(nextPts, 0);
                        fillFrame = aac_helper_1.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
                        if (!fillFrame) {
                            logger_1.logger.log('Unable to get silent frame for given audio codec; duplicating last frame instead.');
                            fillFrame = sample.unit.subarray();
                        }
                        inputSamples.splice(i, 0, { unit: fillFrame, pts: newStamp, dts: newStamp });
                        track.len += fillFrame.length;
                        nextPts += inputSampleDuration;
                        i++;
                    }
                    // Adjust sample to next expected pts
                    sample.pts = sample.dts = nextPts;
                    nextPts += inputSampleDuration;
                    i++;
                }
                else {
                    // Otherwise, just adjust pts
                    if (Math.abs(delta) > (0.1 * inputSampleDuration)) {
                        // logger.log(`Invalid frame delta ${Math.round(delta + inputSampleDuration)} at PTS ${Math.round(pts / 90)} (should be ${Math.round(inputSampleDuration)}).`);
                    }
                    sample.pts = sample.dts = nextPts;
                    nextPts += inputSampleDuration;
                    i++;
                }
            }
        }
        for (var j = 0, nbSamples_1 = inputSamples.length; j < nbSamples_1; j++) {
            var audioSample = inputSamples[j];
            var unit = audioSample.unit;
            var pts = audioSample.pts;
            // logger.log(`Audio/PTS:${Math.round(pts/90)}`);
            // if not first sample
            if (lastPTS !== undefined) {
                mp4Sample.duration = Math.round((pts - lastPTS) / scaleFactor);
            }
            else {
                var delta_1 = Math.round(1000 * (pts - nextAudioPts) / inputTimeScale), numMissingFrames = 0;
                // if fragment are contiguous, detect hole/overlapping between fragments
                // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
                if (contiguous && track.isAAC) {
                    // log delta
                    if (delta_1) {
                        if (delta_1 > 0 && delta_1 < MAX_SILENT_FRAME_DURATION) {
                            numMissingFrames = Math.round((pts - nextAudioPts) / inputSampleDuration);
                            logger_1.logger.log(delta_1 + " ms hole between AAC samples detected,filling it");
                            if (numMissingFrames > 0) {
                                fillFrame = aac_helper_1.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
                                if (!fillFrame) {
                                    fillFrame = unit.subarray();
                                }
                                track.len += numMissingFrames * fillFrame.length;
                            }
                            // if we have frame overlap, overlapping for more than half a frame duraion
                        }
                        else if (delta_1 < -12) {
                            // drop overlapping audio frames... browser will deal with it
                            logger_1.logger.log("drop overlapping AAC sample, expected/parsed/delta:" + (nextAudioPts / inputTimeScale).toFixed(3) + "s/" + (pts / inputTimeScale).toFixed(3) + "s/" + (-delta_1) + "ms");
                            track.len -= unit.byteLength;
                            continue;
                        }
                        // set PTS/DTS to expected PTS/DTS
                        pts = nextAudioPts;
                    }
                }
                // remember first PTS of our audioSamples
                firstPTS = pts;
                if (track.len > 0) {
                    /* concatenate the audio data and construct the mdat in place
                      (need 8 more bytes to fill length and mdat type) */
                    var mdatSize = rawMPEG ? track.len : track.len + 8;
                    offset = rawMPEG ? 0 : 8;
                    try {
                        mdat = new Uint8Array(mdatSize);
                    }
                    catch (err) {
                        this.observer.trigger(events_1.default.ERROR, { type: errors_1.ErrorTypes.MUX_ERROR, details: errors_1.ErrorDetails.REMUX_ALLOC_ERROR, fatal: false, bytes: mdatSize, reason: "fail allocating audio mdat " + mdatSize });
                        return;
                    }
                    if (!rawMPEG) {
                        var view = new DataView(mdat.buffer);
                        view.setUint32(0, mdatSize);
                        mdat.set(mp4_generator_1.default.types.mdat, 4);
                    }
                }
                else {
                    // no audio samples
                    return;
                }
                for (var i = 0; i < numMissingFrames; i++) {
                    fillFrame = aac_helper_1.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
                    if (!fillFrame) {
                        logger_1.logger.log('Unable to get silent frame for given audio codec; duplicating this frame instead.');
                        fillFrame = unit.subarray();
                    }
                    mdat.set(fillFrame, offset);
                    offset += fillFrame.byteLength;
                    mp4Sample = {
                        size: fillFrame.byteLength,
                        cts: 0,
                        duration: 1024,
                        flags: {
                            isLeading: 0,
                            isDependedOn: 0,
                            hasRedundancy: 0,
                            degradPrio: 0,
                            dependsOn: 1
                        }
                    };
                    outputSamples.push(mp4Sample);
                }
            }
            mdat.set(unit, offset);
            var unitLen = unit.byteLength;
            offset += unitLen;
            // console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${audioSample.pts}/${audioSample.dts}/${initDTS}/${ptsnorm}/${dtsnorm}/${(audioSample.pts/4294967296).toFixed(3)}');
            mp4Sample = {
                size: unitLen,
                cts: 0,
                duration: 0,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: 1
                }
            };
            outputSamples.push(mp4Sample);
            lastPTS = pts;
        }
        var lastSampleDuration = 0;
        var nbSamples = outputSamples.length;
        // set last sample duration as being identical to previous sample
        if (nbSamples >= 2) {
            lastSampleDuration = outputSamples[nbSamples - 2].duration;
            mp4Sample.duration = lastSampleDuration;
        }
        if (nbSamples) {
            // next audio sample PTS should be equal to last sample PTS + duration
            this.nextAudioPts = nextAudioPts = lastPTS + scaleFactor * lastSampleDuration;
            // logger.log('Audio/PTS/PTSend:' + audioSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
            track.len = 0;
            track.samples = outputSamples;
            if (rawMPEG) {
                moof = new Uint8Array();
            }
            else {
                moof = mp4_generator_1.default.moof(track.sequenceNumber++, firstPTS / scaleFactor, track);
            }
            track.samples = [];
            var start = firstPTS / inputTimeScale;
            var end = nextAudioPts / inputTimeScale;
            var audioData = {
                data1: moof,
                data2: mdat,
                startPTS: start,
                endPTS: end,
                startDTS: start,
                endDTS: end,
                type: 'audio',
                hasAudio: true,
                hasVideo: false,
                nb: nbSamples
            };
            this.observer.trigger(events_1.default.FRAG_PARSING_DATA, audioData);
            return audioData;
        }
        return null;
    };
    MP4Remuxer.prototype.remuxEmptyAudio = function (track, timeOffset, contiguous, videoData) {
        var inputTimeScale = track.inputTimeScale, mp4timeScale = track.samplerate ? track.samplerate : inputTimeScale, scaleFactor = inputTimeScale / mp4timeScale, nextAudioPts = this.nextAudioPts, 
        // sync with video's timestamp
        startDTS = (nextAudioPts !== undefined ? nextAudioPts : videoData.startDTS * inputTimeScale) + this._initDTS, endDTS = videoData.endDTS * inputTimeScale + this._initDTS, 
        // one sample's duration value
        sampleDuration = 1024, frameDuration = scaleFactor * sampleDuration, 
        // samples count of this segment's duration
        nbSamples = Math.ceil((endDTS - startDTS) / frameDuration), 
        // silent frame
        silentFrame = aac_helper_1.default.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
        logger_1.logger.warn('remux empty Audio');
        // Can't remux if we can't generate a silent frame...
        if (!silentFrame) {
            logger_1.logger.trace('Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec!');
            return;
        }
        var samples = [];
        for (var i = 0; i < nbSamples; i++) {
            var stamp = startDTS + i * frameDuration;
            samples.push({ unit: silentFrame, pts: stamp, dts: stamp });
            track.len += silentFrame.length;
        }
        track.samples = samples;
        this.remuxAudio(track, timeOffset, contiguous);
    };
    MP4Remuxer.prototype.remuxID3 = function (track) {
        var length = track.samples.length, sample;
        var inputTimeScale = track.inputTimeScale;
        var initPTS = this._initPTS;
        var initDTS = this._initDTS;
        // consume samples
        if (length) {
            for (var index = 0; index < length; index++) {
                sample = track.samples[index];
                // setting id3 pts, dts to relative time
                // using this._initPTS and this._initDTS to calculate relative time
                sample.pts = ((sample.pts - initPTS) / inputTimeScale);
                sample.dts = ((sample.dts - initDTS) / inputTimeScale);
            }
            this.observer.trigger(events_1.default.FRAG_PARSING_METADATA, {
                samples: track.samples
            });
        }
        track.samples = [];
    };
    MP4Remuxer.prototype.remuxText = function (track) {
        track.samples.sort(function (a, b) {
            return (a.pts - b.pts);
        });
        var length = track.samples.length, sample;
        var inputTimeScale = track.inputTimeScale;
        var initPTS = this._initPTS;
        // consume samples
        if (length) {
            for (var index = 0; index < length; index++) {
                sample = track.samples[index];
                // setting text pts, dts to relative time
                // using this._initPTS and this._initDTS to calculate relative time
                sample.pts = ((sample.pts - initPTS) / inputTimeScale);
            }
            this.observer.trigger(events_1.default.FRAG_PARSING_USERDATA, {
                samples: track.samples
            });
        }
        track.samples = [];
    };
    MP4Remuxer.prototype._PTSNormalize = function (value, reference) {
        var offset;
        if (reference === undefined) {
            return value;
        }
        if (reference < value) {
            // - 2^33
            offset = -8589934592;
        }
        else {
            // + 2^33
            offset = 8589934592;
        }
        /* PTS is 33bit (from 0 to 2^33 -1)
          if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
          PTS looping occured. fill the gap */
        while (Math.abs(value - reference) > 4294967296) {
            value += offset;
        }
        return value;
    };
    return MP4Remuxer;
}());
exports.default = MP4Remuxer;


/***/ }),

/***/ "./src/remux/passthrough-remuxer.js":
/*!******************************************!*\
  !*** ./src/remux/passthrough-remuxer.js ***!
  \******************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 * passthrough remuxer
*/
var events_1 = __webpack_require__(/*! ../events */ "./src/events.js");
var PassThroughRemuxer = /** @class */ (function () {
    function PassThroughRemuxer(observer) {
        this.observer = observer;
    }
    PassThroughRemuxer.prototype.destroy = function () {
    };
    PassThroughRemuxer.prototype.resetTimeStamp = function () {
    };
    PassThroughRemuxer.prototype.resetInitSegment = function () {
    };
    PassThroughRemuxer.prototype.remux = function (audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset, rawData) {
        var observer = this.observer;
        var streamType = '';
        if (audioTrack) {
            streamType += 'audio';
        }
        if (videoTrack) {
            streamType += 'video';
        }
        observer.trigger(events_1.default.FRAG_PARSING_DATA, {
            data1: rawData,
            startPTS: timeOffset,
            startDTS: timeOffset,
            type: streamType,
            hasAudio: !!audioTrack,
            hasVideo: !!videoTrack,
            nb: 1,
            dropped: 0
        });
        // notify end of parsing
        observer.trigger(events_1.default.FRAG_PARSED);
    };
    return PassThroughRemuxer;
}());
exports.default = PassThroughRemuxer;


/***/ }),

/***/ "./src/task-loop.js":
/*!**************************!*\
  !*** ./src/task-loop.js ***!
  \**************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var event_handler_1 = __webpack_require__(/*! ./event-handler */ "./src/event-handler.js");
/**
 * Sub-class specialization of EventHandler base class.
 *
 * TaskLoop allows to schedule a task function being called (optionnaly repeatedly) on the main loop,
 * scheduled asynchroneously, avoiding recursive calls in the same tick.
 *
 * The task itself is implemented in `doTick`. It can be requested and called for single execution
 * using the `tick` method.
 *
 * It will be assured that the task execution method (`tick`) only gets called once per main loop "tick",
 * no matter how often it gets requested for execution. Execution in further ticks will be scheduled accordingly.
 *
 * If further execution requests have already been scheduled on the next tick, it can be checked with `hasNextTick`,
 * and cancelled with `clearNextTick`.
 *
 * The task can be scheduled as an interval repeatedly with a period as parameter (see `setInterval`, `clearInterval`).
 *
 * Sub-classes need to implement the `doTick` method which will effectively have the task execution routine.
 *
 * Further explanations:
 *
 * The baseclass has a `tick` method that will schedule the doTick call. It may be called synchroneously
 * only for a stack-depth of one. On re-entrant calls, sub-sequent calls are scheduled for next main loop ticks.
 *
 * When the task execution (`tick` method) is called in re-entrant way this is detected and
 * we are limiting the task execution per call stack to exactly one, but scheduling/post-poning further
 * task processing on the next main loop iteration (also known as "next tick" in the Node/JS runtime lingo).
 */
var TaskLoop = /** @class */ (function (_super) {
    __extends(TaskLoop, _super);
    function TaskLoop(hls) {
        var events = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            events[_i - 1] = arguments[_i];
        }
        var _this = _super.apply(this, [hls].concat(events)) || this;
        _this._tickInterval = null;
        _this._tickTimer = null;
        _this._tickCallCount = 0;
        _this._boundTick = _this.tick.bind(_this);
        return _this;
    }
    /**
     * @override
     */
    TaskLoop.prototype.onHandlerDestroying = function () {
        // clear all timers before unregistering from event bus
        this.clearNextTick();
        this.clearInterval();
    };
    /**
     * @returns {boolean}
     */
    TaskLoop.prototype.hasInterval = function () {
        return !!this._tickInterval;
    };
    /**
     * @returns {boolean}
     */
    TaskLoop.prototype.hasNextTick = function () {
        return !!this._tickTimer;
    };
    /**
     * @param {number} millis Interval time (ms)
     * @returns {boolean} True when interval has been scheduled, false when already scheduled (no effect)
     */
    TaskLoop.prototype.setInterval = function (millis) {
        if (!this._tickInterval) {
            this._tickInterval = setInterval(this._boundTick, millis);
            return true;
        }
        return false;
    };
    /**
     * @returns {boolean} True when interval was cleared, false when none was set (no effect)
     */
    TaskLoop.prototype.clearInterval = function () {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
            return true;
        }
        return false;
    };
    /**
     * @returns {boolean} True when timeout was cleared, false when none was set (no effect)
     */
    TaskLoop.prototype.clearNextTick = function () {
        if (this._tickTimer) {
            clearTimeout(this._tickTimer);
            this._tickTimer = null;
            return true;
        }
        return false;
    };
    /**
     * Will call the subclass doTick implementation in this main loop tick
     * or in the next one (via setTimeout(,0)) in case it has already been called
     * in this tick (in case this is a re-entrant call).
     */
    TaskLoop.prototype.tick = function () {
        this._tickCallCount++;
        if (this._tickCallCount === 1) {
            this.doTick();
            // re-entrant call to tick from previous doTick call stack
            // -> schedule a call on the next main loop iteration to process this task processing request
            if (this._tickCallCount > 1) {
                // make sure only one timer exists at any time at max
                this.clearNextTick();
                this._tickTimer = setTimeout(this._boundTick, 0);
            }
            this._tickCallCount = 0;
        }
    };
    /**
     * For subclass to implement task logic
     * @abstract
     */
    TaskLoop.prototype.doTick = function () { };
    return TaskLoop;
}(event_handler_1.default));
exports.default = TaskLoop;


/***/ }),

/***/ "./src/utils/attr-list.js":
/*!********************************!*\
  !*** ./src/utils/attr-list.js ***!
  \********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var DECIMAL_RESOLUTION_REGEX = /^(\d+)x(\d+)$/; // eslint-disable-line no-useless-escape
var ATTR_LIST_REGEX = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g; // eslint-disable-line no-useless-escape
// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js
var AttrList = /** @class */ (function () {
    function AttrList(attrs) {
        if (typeof attrs === 'string') {
            attrs = AttrList.parseAttrList(attrs);
        }
        for (var attr in attrs) {
            if (attrs.hasOwnProperty(attr)) {
                this[attr] = attrs[attr];
            }
        }
    }
    AttrList.prototype.decimalInteger = function (attrName) {
        var intValue = parseInt(this[attrName], 10);
        if (intValue > Number.MAX_SAFE_INTEGER) {
            return Infinity;
        }
        return intValue;
    };
    AttrList.prototype.hexadecimalInteger = function (attrName) {
        if (this[attrName]) {
            var stringValue = (this[attrName] || '0x').slice(2);
            stringValue = ((stringValue.length & 1) ? '0' : '') + stringValue;
            var value = new Uint8Array(stringValue.length / 2);
            for (var i = 0; i < stringValue.length / 2; i++) {
                value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
            }
            return value;
        }
        else {
            return null;
        }
    };
    AttrList.prototype.hexadecimalIntegerAsNumber = function (attrName) {
        var intValue = parseInt(this[attrName], 16);
        if (intValue > Number.MAX_SAFE_INTEGER) {
            return Infinity;
        }
        return intValue;
    };
    AttrList.prototype.decimalFloatingPoint = function (attrName) {
        return parseFloat(this[attrName]);
    };
    AttrList.prototype.enumeratedString = function (attrName) {
        return this[attrName];
    };
    AttrList.prototype.decimalResolution = function (attrName) {
        var res = DECIMAL_RESOLUTION_REGEX.exec(this[attrName]);
        if (res === null) {
            return undefined;
        }
        return {
            width: parseInt(res[1], 10),
            height: parseInt(res[2], 10)
        };
    };
    AttrList.parseAttrList = function (input) {
        var match, attrs = {};
        ATTR_LIST_REGEX.lastIndex = 0;
        while ((match = ATTR_LIST_REGEX.exec(input)) !== null) {
            var value = match[2], quote = '"';
            if (value.indexOf(quote) === 0 &&
                value.lastIndexOf(quote) === (value.length - 1)) {
                value = value.slice(1, -1);
            }
            attrs[match[1]] = value;
        }
        return attrs;
    };
    return AttrList;
}());
exports.default = AttrList;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/utils/binary-search.js":
/*!************************************!*\
  !*** ./src/utils/binary-search.js ***!
  \************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var BinarySearch = {
    /**
       * Searches for an item in an array which matches a certain condition.
       * This requires the condition to only match one item in the array,
       * and for the array to be ordered.
       *
       * @param {Array} list The array to search.
       * @param {Function} comparisonFunction
       *      Called and provided a candidate item as the first argument.
       *      Should return:
       *          > -1 if the item should be located at a lower index than the provided item.
       *          > 1 if the item should be located at a higher index than the provided item.
       *          > 0 if the item is the item you're looking for.
       *
       * @return {*} The object if it is found or null otherwise.
       */
    search: function (list, comparisonFunction) {
        var minIndex = 0;
        var maxIndex = list.length - 1;
        var currentIndex = null;
        var currentElement = null;
        while (minIndex <= maxIndex) {
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            currentElement = list[currentIndex];
            var comparisonResult = comparisonFunction(currentElement);
            if (comparisonResult > 0) {
                minIndex = currentIndex + 1;
            }
            else if (comparisonResult < 0) {
                maxIndex = currentIndex - 1;
            }
            else {
                return currentElement;
            }
        }
        return null;
    }
};
exports.default = BinarySearch;


/***/ }),

/***/ "./src/utils/buffer-helper.js":
/*!************************************!*\
  !*** ./src/utils/buffer-helper.js ***!
  \************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @module BufferHelper
 *
 * Providing methods dealing with buffer length retrieval for example.
 *
 * In general, a helper around HTML5 MediaElement TimeRanges gathered from `buffered` property.
 *
 * Also @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/buffered
*/
Object.defineProperty(exports, "__esModule", { value: true });
var BufferHelper = /** @class */ (function () {
    function BufferHelper() {
    }
    /**
     * Return true if `media`'s buffered include `position`
     * @param {HTMLMediaElement|SourceBuffer} media
     * @param {number} position
     * @returns {boolean}
     */
    BufferHelper.isBuffered = function (media, position) {
        try {
            if (media) {
                var buffered = media.buffered;
                for (var i = 0; i < buffered.length; i++) {
                    if (position >= buffered.start(i) && position <= buffered.end(i)) {
                        return true;
                    }
                }
            }
        }
        catch (error) {
            // this is to catch
            // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer':
            // This SourceBuffer has been removed from the parent media source
        }
        return false;
    };
    BufferHelper.bufferInfo = function (media, pos, maxHoleDuration) {
        try {
            if (media) {
                var vbuffered = media.buffered, buffered = [], i = void 0;
                for (i = 0; i < vbuffered.length; i++) {
                    buffered.push({ start: vbuffered.start(i), end: vbuffered.end(i) });
                }
                return this.bufferedInfo(buffered, pos, maxHoleDuration);
            }
        }
        catch (error) {
            // this is to catch
            // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer':
            // This SourceBuffer has been removed from the parent media source
        }
        return { len: 0, start: pos, end: pos, nextStart: undefined };
    };
    BufferHelper.bufferedInfo = function (buffered, pos, maxHoleDuration) {
        var buffered2 = [], 
        // bufferStart and bufferEnd are buffer boundaries around current video position
        bufferLen, bufferStart, bufferEnd, bufferStartNext, i;
        // sort on buffer.start/smaller end (IE does not always return sorted buffered range)
        buffered.sort(function (a, b) {
            var diff = a.start - b.start;
            if (diff) {
                return diff;
            }
            else {
                return b.end - a.end;
            }
        });
        // there might be some small holes between buffer time range
        // consider that holes smaller than maxHoleDuration are irrelevant and build another
        // buffer time range representations that discards those holes
        for (i = 0; i < buffered.length; i++) {
            var buf2len = buffered2.length;
            if (buf2len) {
                var buf2end = buffered2[buf2len - 1].end;
                // if small hole (value between 0 or maxHoleDuration ) or overlapping (negative)
                if ((buffered[i].start - buf2end) < maxHoleDuration) {
                    // merge overlapping time ranges
                    // update lastRange.end only if smaller than item.end
                    // e.g.  [ 1, 15] with  [ 2,8] => [ 1,15] (no need to modify lastRange.end)
                    // whereas [ 1, 8] with  [ 2,15] => [ 1,15] ( lastRange should switch from [1,8] to [1,15])
                    if (buffered[i].end > buf2end) {
                        buffered2[buf2len - 1].end = buffered[i].end;
                    }
                }
                else {
                    // big hole
                    buffered2.push(buffered[i]);
                }
            }
            else {
                // first value
                buffered2.push(buffered[i]);
            }
        }
        for (i = 0, bufferLen = 0, bufferStart = bufferEnd = pos; i < buffered2.length; i++) {
            var start = buffered2[i].start, end = buffered2[i].end;
            // logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
            if ((pos + maxHoleDuration) >= start && pos < end) {
                // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
                bufferStart = start;
                bufferEnd = end;
                bufferLen = bufferEnd - pos;
            }
            else if ((pos + maxHoleDuration) < start) {
                bufferStartNext = start;
                break;
            }
        }
        return { len: bufferLen, start: bufferStart, end: bufferEnd, nextStart: bufferStartNext };
    };
    return BufferHelper;
}());
exports.BufferHelper = BufferHelper;


/***/ }),

/***/ "./src/utils/cea-608-parser.js":
/*!*************************************!*\
  !*** ./src/utils/cea-608-parser.js ***!
  \*************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 *
 * This code was ported from the dash.js project at:
 *   https://github.com/Dash-Industry-Forum/dash.js/blob/development/externals/cea608-parser.js
 *   https://github.com/Dash-Industry-Forum/dash.js/commit/8269b26a761e0853bb21d78780ed945144ecdd4d#diff-71bc295a2d6b6b7093a1d3290d53a4b2
 *
 * The original copyright appears below:
 *
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2015-2016, DASH Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  1. Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  2. Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */
/**
     *  Exceptions from regular ASCII. CodePoints are mapped to UTF-16 codes
     */
Object.defineProperty(exports, "__esModule", { value: true });
var specialCea608CharsCodes = {
    0x2a: 0xe1,
    0x5c: 0xe9,
    0x5e: 0xed,
    0x5f: 0xf3,
    0x60: 0xfa,
    0x7b: 0xe7,
    0x7c: 0xf7,
    0x7d: 0xd1,
    0x7e: 0xf1,
    0x7f: 0x2588,
    // THIS BLOCK INCLUDES THE 16 EXTENDED (TWO-BYTE) LINE 21 CHARACTERS
    // THAT COME FROM HI BYTE=0x11 AND LOW BETWEEN 0x30 AND 0x3F
    // THIS MEANS THAT \x50 MUST BE ADDED TO THE VALUES
    0x80: 0xae,
    0x81: 0xb0,
    0x82: 0xbd,
    0x83: 0xbf,
    0x84: 0x2122,
    0x85: 0xa2,
    0x86: 0xa3,
    0x87: 0x266a,
    0x88: 0xe0,
    0x89: 0x20,
    0x8a: 0xe8,
    0x8b: 0xe2,
    0x8c: 0xea,
    0x8d: 0xee,
    0x8e: 0xf4,
    0x8f: 0xfb,
    // THIS BLOCK INCLUDES THE 32 EXTENDED (TWO-BYTE) LINE 21 CHARACTERS
    // THAT COME FROM HI BYTE=0x12 AND LOW BETWEEN 0x20 AND 0x3F
    0x90: 0xc1,
    0x91: 0xc9,
    0x92: 0xd3,
    0x93: 0xda,
    0x94: 0xdc,
    0x95: 0xfc,
    0x96: 0x2018,
    0x97: 0xa1,
    0x98: 0x2a,
    0x99: 0x2019,
    0x9a: 0x2501,
    0x9b: 0xa9,
    0x9c: 0x2120,
    0x9d: 0x2022,
    0x9e: 0x201c,
    0x9f: 0x201d,
    0xa0: 0xc0,
    0xa1: 0xc2,
    0xa2: 0xc7,
    0xa3: 0xc8,
    0xa4: 0xca,
    0xa5: 0xcb,
    0xa6: 0xeb,
    0xa7: 0xce,
    0xa8: 0xcf,
    0xa9: 0xef,
    0xaa: 0xd4,
    0xab: 0xd9,
    0xac: 0xf9,
    0xad: 0xdb,
    0xae: 0xab,
    0xaf: 0xbb,
    // THIS BLOCK INCLUDES THE 32 EXTENDED (TWO-BYTE) LINE 21 CHARACTERS
    // THAT COME FROM HI BYTE=0x13 AND LOW BETWEEN 0x20 AND 0x3F
    0xb0: 0xc3,
    0xb1: 0xe3,
    0xb2: 0xcd,
    0xb3: 0xcc,
    0xb4: 0xec,
    0xb5: 0xd2,
    0xb6: 0xf2,
    0xb7: 0xd5,
    0xb8: 0xf5,
    0xb9: 0x7b,
    0xba: 0x7d,
    0xbb: 0x5c,
    0xbc: 0x5e,
    0xbd: 0x5f,
    0xbe: 0x7c,
    0xbf: 0x223c,
    0xc0: 0xc4,
    0xc1: 0xe4,
    0xc2: 0xd6,
    0xc3: 0xf6,
    0xc4: 0xdf,
    0xc5: 0xa5,
    0xc6: 0xa4,
    0xc7: 0x2503,
    0xc8: 0xc5,
    0xc9: 0xe5,
    0xca: 0xd8,
    0xcb: 0xf8,
    0xcc: 0x250f,
    0xcd: 0x2513,
    0xce: 0x2517,
    0xcf: 0x251b // Box drawings heavy up and left
};
/**
 * Utils
 */
var getCharForByte = function (byte) {
    var charCode = byte;
    if (specialCea608CharsCodes.hasOwnProperty(byte)) {
        charCode = specialCea608CharsCodes[byte];
    }
    return String.fromCharCode(charCode);
};
var NR_ROWS = 15, NR_COLS = 100;
// Tables to look up row from PAC data
var rowsLowCh1 = { 0x11: 1, 0x12: 3, 0x15: 5, 0x16: 7, 0x17: 9, 0x10: 11, 0x13: 12, 0x14: 14 };
var rowsHighCh1 = { 0x11: 2, 0x12: 4, 0x15: 6, 0x16: 8, 0x17: 10, 0x13: 13, 0x14: 15 };
var rowsLowCh2 = { 0x19: 1, 0x1A: 3, 0x1D: 5, 0x1E: 7, 0x1F: 9, 0x18: 11, 0x1B: 12, 0x1C: 14 };
var rowsHighCh2 = { 0x19: 2, 0x1A: 4, 0x1D: 6, 0x1E: 8, 0x1F: 10, 0x1B: 13, 0x1C: 15 };
var backgroundColors = ['white', 'green', 'blue', 'cyan', 'red', 'yellow', 'magenta', 'black', 'transparent'];
/**
 * Simple logger class to be able to write with time-stamps and filter on level.
 */
var logger = {
    verboseFilter: { 'DATA': 3, 'DEBUG': 3, 'INFO': 2, 'WARNING': 2, 'TEXT': 1, 'ERROR': 0 },
    time: null,
    verboseLevel: 0,
    setTime: function (newTime) {
        this.time = newTime;
    },
    log: function (severity, msg) {
        var minLevel = this.verboseFilter[severity];
        if (this.verboseLevel >= minLevel) {
            // console.log(this.time + ' [' + severity + '] ' + msg);
        }
    }
};
var numArrayToHexArray = function (numArray) {
    var hexArray = [];
    for (var j = 0; j < numArray.length; j++) {
        hexArray.push(numArray[j].toString(16));
    }
    return hexArray;
};
var PenState = /** @class */ (function () {
    function PenState(foreground, underline, italics, background, flash) {
        this.foreground = foreground || 'white';
        this.underline = underline || false;
        this.italics = italics || false;
        this.background = background || 'black';
        this.flash = flash || false;
    }
    PenState.prototype.reset = function () {
        this.foreground = 'white';
        this.underline = false;
        this.italics = false;
        this.background = 'black';
        this.flash = false;
    };
    PenState.prototype.setStyles = function (styles) {
        var attribs = ['foreground', 'underline', 'italics', 'background', 'flash'];
        for (var i = 0; i < attribs.length; i++) {
            var style = attribs[i];
            if (styles.hasOwnProperty(style)) {
                this[style] = styles[style];
            }
        }
    };
    PenState.prototype.isDefault = function () {
        return (this.foreground === 'white' && !this.underline && !this.italics &&
            this.background === 'black' && !this.flash);
    };
    PenState.prototype.equals = function (other) {
        return ((this.foreground === other.foreground) &&
            (this.underline === other.underline) &&
            (this.italics === other.italics) &&
            (this.background === other.background) &&
            (this.flash === other.flash));
    };
    PenState.prototype.copy = function (newPenState) {
        this.foreground = newPenState.foreground;
        this.underline = newPenState.underline;
        this.italics = newPenState.italics;
        this.background = newPenState.background;
        this.flash = newPenState.flash;
    };
    PenState.prototype.toString = function () {
        return ('color=' + this.foreground + ', underline=' + this.underline + ', italics=' + this.italics +
            ', background=' + this.background + ', flash=' + this.flash);
    };
    return PenState;
}());
/**
 * Unicode character with styling and background.
 * @constructor
 */
var StyledUnicodeChar = /** @class */ (function () {
    function StyledUnicodeChar(uchar, foreground, underline, italics, background, flash) {
        this.uchar = uchar || ' '; // unicode character
        this.penState = new PenState(foreground, underline, italics, background, flash);
    }
    StyledUnicodeChar.prototype.reset = function () {
        this.uchar = ' ';
        this.penState.reset();
    };
    StyledUnicodeChar.prototype.setChar = function (uchar, newPenState) {
        this.uchar = uchar;
        this.penState.copy(newPenState);
    };
    StyledUnicodeChar.prototype.setPenState = function (newPenState) {
        this.penState.copy(newPenState);
    };
    StyledUnicodeChar.prototype.equals = function (other) {
        return this.uchar === other.uchar && this.penState.equals(other.penState);
    };
    StyledUnicodeChar.prototype.copy = function (newChar) {
        this.uchar = newChar.uchar;
        this.penState.copy(newChar.penState);
    };
    StyledUnicodeChar.prototype.isEmpty = function () {
        return this.uchar === ' ' && this.penState.isDefault();
    };
    return StyledUnicodeChar;
}());
/**
 * CEA-608 row consisting of NR_COLS instances of StyledUnicodeChar.
 * @constructor
 */
var Row = /** @class */ (function () {
    function Row() {
        this.chars = [];
        for (var i = 0; i < NR_COLS; i++) {
            this.chars.push(new StyledUnicodeChar());
        }
        this.pos = 0;
        this.currPenState = new PenState();
    }
    Row.prototype.equals = function (other) {
        var equal = true;
        for (var i = 0; i < NR_COLS; i++) {
            if (!this.chars[i].equals(other.chars[i])) {
                equal = false;
                break;
            }
        }
        return equal;
    };
    Row.prototype.copy = function (other) {
        for (var i = 0; i < NR_COLS; i++) {
            this.chars[i].copy(other.chars[i]);
        }
    };
    Row.prototype.isEmpty = function () {
        var empty = true;
        for (var i = 0; i < NR_COLS; i++) {
            if (!this.chars[i].isEmpty()) {
                empty = false;
                break;
            }
        }
        return empty;
    };
    /**
       *  Set the cursor to a valid column.
       */
    Row.prototype.setCursor = function (absPos) {
        if (this.pos !== absPos) {
            this.pos = absPos;
        }
        if (this.pos < 0) {
            logger.log('ERROR', 'Negative cursor position ' + this.pos);
            this.pos = 0;
        }
        else if (this.pos > NR_COLS) {
            logger.log('ERROR', 'Too large cursor position ' + this.pos);
            this.pos = NR_COLS;
        }
    };
    /**
       * Move the cursor relative to current position.
       */
    Row.prototype.moveCursor = function (relPos) {
        var newPos = this.pos + relPos;
        if (relPos > 1) {
            for (var i = this.pos + 1; i < newPos + 1; i++) {
                this.chars[i].setPenState(this.currPenState);
            }
        }
        this.setCursor(newPos);
    };
    /**
       * Backspace, move one step back and clear character.
       */
    Row.prototype.backSpace = function () {
        this.moveCursor(-1);
        this.chars[this.pos].setChar(' ', this.currPenState);
    };
    Row.prototype.insertChar = function (byte) {
        if (byte >= 0x90) { // Extended char
            this.backSpace();
        }
        var char = getCharForByte(byte);
        if (this.pos >= NR_COLS) {
            logger.log('ERROR', 'Cannot insert ' + byte.toString(16) +
                ' (' + char + ') at position ' + this.pos + '. Skipping it!');
            return;
        }
        this.chars[this.pos].setChar(char, this.currPenState);
        this.moveCursor(1);
    };
    Row.prototype.clearFromPos = function (startPos) {
        var i;
        for (i = startPos; i < NR_COLS; i++) {
            this.chars[i].reset();
        }
    };
    Row.prototype.clear = function () {
        this.clearFromPos(0);
        this.pos = 0;
        this.currPenState.reset();
    };
    Row.prototype.clearToEndOfRow = function () {
        this.clearFromPos(this.pos);
    };
    Row.prototype.getTextString = function () {
        var chars = [];
        var empty = true;
        for (var i = 0; i < NR_COLS; i++) {
            var char = this.chars[i].uchar;
            if (char !== ' ') {
                empty = false;
            }
            chars.push(char);
        }
        if (empty) {
            return '';
        }
        else {
            return chars.join('');
        }
    };
    Row.prototype.setPenStyles = function (styles) {
        this.currPenState.setStyles(styles);
        var currChar = this.chars[this.pos];
        currChar.setPenState(this.currPenState);
    };
    return Row;
}());
/**
 * Keep a CEA-608 screen of 32x15 styled characters
 * @constructor
*/
var CaptionScreen = /** @class */ (function () {
    function CaptionScreen() {
        this.rows = [];
        for (var i = 0; i < NR_ROWS; i++) {
            this.rows.push(new Row());
        } // Note that we use zero-based numbering (0-14)
        this.currRow = NR_ROWS - 1;
        this.nrRollUpRows = null;
        this.reset();
    }
    CaptionScreen.prototype.reset = function () {
        for (var i = 0; i < NR_ROWS; i++) {
            this.rows[i].clear();
        }
        this.currRow = NR_ROWS - 1;
    };
    CaptionScreen.prototype.equals = function (other) {
        var equal = true;
        for (var i = 0; i < NR_ROWS; i++) {
            if (!this.rows[i].equals(other.rows[i])) {
                equal = false;
                break;
            }
        }
        return equal;
    };
    CaptionScreen.prototype.copy = function (other) {
        for (var i = 0; i < NR_ROWS; i++) {
            this.rows[i].copy(other.rows[i]);
        }
    };
    CaptionScreen.prototype.isEmpty = function () {
        var empty = true;
        for (var i = 0; i < NR_ROWS; i++) {
            if (!this.rows[i].isEmpty()) {
                empty = false;
                break;
            }
        }
        return empty;
    };
    CaptionScreen.prototype.backSpace = function () {
        var row = this.rows[this.currRow];
        row.backSpace();
    };
    CaptionScreen.prototype.clearToEndOfRow = function () {
        var row = this.rows[this.currRow];
        row.clearToEndOfRow();
    };
    /**
       * Insert a character (without styling) in the current row.
       */
    CaptionScreen.prototype.insertChar = function (char) {
        var row = this.rows[this.currRow];
        row.insertChar(char);
    };
    CaptionScreen.prototype.setPen = function (styles) {
        var row = this.rows[this.currRow];
        row.setPenStyles(styles);
    };
    CaptionScreen.prototype.moveCursor = function (relPos) {
        var row = this.rows[this.currRow];
        row.moveCursor(relPos);
    };
    CaptionScreen.prototype.setCursor = function (absPos) {
        logger.log('INFO', 'setCursor: ' + absPos);
        var row = this.rows[this.currRow];
        row.setCursor(absPos);
    };
    CaptionScreen.prototype.setPAC = function (pacData) {
        logger.log('INFO', 'pacData = ' + JSON.stringify(pacData));
        var newRow = pacData.row - 1;
        if (this.nrRollUpRows && newRow < this.nrRollUpRows - 1) {
            newRow = this.nrRollUpRows - 1;
        }
        // Make sure this only affects Roll-up Captions by checking this.nrRollUpRows
        if (this.nrRollUpRows && this.currRow !== newRow) {
            // clear all rows first
            for (var i = 0; i < NR_ROWS; i++) {
                this.rows[i].clear();
            }
            // Copy this.nrRollUpRows rows from lastOutputScreen and place it in the newRow location
            // topRowIndex - the start of rows to copy (inclusive index)
            var topRowIndex = this.currRow + 1 - (this.nrRollUpRows);
            // We only copy if the last position was already shown.
            // We use the cueStartTime value to check this.
            var lastOutputScreen = this.lastOutputScreen;
            if (lastOutputScreen) {
                var prevLineTime = lastOutputScreen.rows[topRowIndex].cueStartTime;
                if (prevLineTime && prevLineTime < logger.time) {
                    for (var i = 0; i < this.nrRollUpRows; i++) {
                        this.rows[newRow - this.nrRollUpRows + i + 1].copy(lastOutputScreen.rows[topRowIndex + i]);
                    }
                }
            }
        }
        this.currRow = newRow;
        var row = this.rows[this.currRow];
        if (pacData.indent !== null) {
            var indent = pacData.indent;
            var prevPos = Math.max(indent - 1, 0);
            row.setCursor(pacData.indent);
            pacData.color = row.chars[prevPos].penState.foreground;
        }
        var styles = { foreground: pacData.color, underline: pacData.underline, italics: pacData.italics, background: 'black', flash: false };
        this.setPen(styles);
    };
    /**
       * Set background/extra foreground, but first do back_space, and then insert space (backwards compatibility).
       */
    CaptionScreen.prototype.setBkgData = function (bkgData) {
        logger.log('INFO', 'bkgData = ' + JSON.stringify(bkgData));
        this.backSpace();
        this.setPen(bkgData);
        this.insertChar(0x20); // Space
    };
    CaptionScreen.prototype.setRollUpRows = function (nrRows) {
        this.nrRollUpRows = nrRows;
    };
    CaptionScreen.prototype.rollUp = function () {
        if (this.nrRollUpRows === null) {
            logger.log('DEBUG', 'roll_up but nrRollUpRows not set yet');
            return; // Not properly setup
        }
        logger.log('TEXT', this.getDisplayText());
        var topRowIndex = this.currRow + 1 - this.nrRollUpRows;
        var topRow = this.rows.splice(topRowIndex, 1)[0];
        topRow.clear();
        this.rows.splice(this.currRow, 0, topRow);
        logger.log('INFO', 'Rolling up');
        // logger.log('TEXT', this.get_display_text())
    };
    /**
      * Get all non-empty rows with as unicode text.
      */
    CaptionScreen.prototype.getDisplayText = function (asOneRow) {
        asOneRow = asOneRow || false;
        var displayText = [];
        var text = '';
        var rowNr = -1;
        for (var i = 0; i < NR_ROWS; i++) {
            var rowText = this.rows[i].getTextString();
            if (rowText) {
                rowNr = i + 1;
                if (asOneRow) {
                    displayText.push('Row ' + rowNr + ': \'' + rowText + '\'');
                }
                else {
                    displayText.push(rowText.trim());
                }
            }
        }
        if (displayText.length > 0) {
            if (asOneRow) {
                text = '[' + displayText.join(' | ') + ']';
            }
            else {
                text = displayText.join('\n');
            }
        }
        return text;
    };
    CaptionScreen.prototype.getTextAndFormat = function () {
        return this.rows;
    };
    return CaptionScreen;
}());
// var modes = ['MODE_ROLL-UP', 'MODE_POP-ON', 'MODE_PAINT-ON', 'MODE_TEXT'];
var Cea608Channel = /** @class */ (function () {
    function Cea608Channel(channelNumber, outputFilter) {
        this.chNr = channelNumber;
        this.outputFilter = outputFilter;
        this.mode = null;
        this.verbose = 0;
        this.displayedMemory = new CaptionScreen();
        this.nonDisplayedMemory = new CaptionScreen();
        this.lastOutputScreen = new CaptionScreen();
        this.currRollUpRow = this.displayedMemory.rows[NR_ROWS - 1];
        this.writeScreen = this.displayedMemory;
        this.mode = null;
        this.cueStartTime = null; // Keeps track of where a cue started.
    }
    Cea608Channel.prototype.reset = function () {
        this.mode = null;
        this.displayedMemory.reset();
        this.nonDisplayedMemory.reset();
        this.lastOutputScreen.reset();
        this.currRollUpRow = this.displayedMemory.rows[NR_ROWS - 1];
        this.writeScreen = this.displayedMemory;
        this.mode = null;
        this.cueStartTime = null;
        this.lastCueEndTime = null;
    };
    Cea608Channel.prototype.getHandler = function () {
        return this.outputFilter;
    };
    Cea608Channel.prototype.setHandler = function (newHandler) {
        this.outputFilter = newHandler;
    };
    Cea608Channel.prototype.setPAC = function (pacData) {
        this.writeScreen.setPAC(pacData);
    };
    Cea608Channel.prototype.setBkgData = function (bkgData) {
        this.writeScreen.setBkgData(bkgData);
    };
    Cea608Channel.prototype.setMode = function (newMode) {
        if (newMode === this.mode) {
            return;
        }
        this.mode = newMode;
        logger.log('INFO', 'MODE=' + newMode);
        if (this.mode === 'MODE_POP-ON') {
            this.writeScreen = this.nonDisplayedMemory;
        }
        else {
            this.writeScreen = this.displayedMemory;
            this.writeScreen.reset();
        }
        if (this.mode !== 'MODE_ROLL-UP') {
            this.displayedMemory.nrRollUpRows = null;
            this.nonDisplayedMemory.nrRollUpRows = null;
        }
        this.mode = newMode;
    };
    Cea608Channel.prototype.insertChars = function (chars) {
        for (var i = 0; i < chars.length; i++) {
            this.writeScreen.insertChar(chars[i]);
        }
        var screen = this.writeScreen === this.displayedMemory ? 'DISP' : 'NON_DISP';
        logger.log('INFO', screen + ': ' + this.writeScreen.getDisplayText(true));
        if (this.mode === 'MODE_PAINT-ON' || this.mode === 'MODE_ROLL-UP') {
            logger.log('TEXT', 'DISPLAYED: ' + this.displayedMemory.getDisplayText(true));
            this.outputDataUpdate();
        }
    };
    Cea608Channel.prototype.ccRCL = function () {
        logger.log('INFO', 'RCL - Resume Caption Loading');
        this.setMode('MODE_POP-ON');
    };
    Cea608Channel.prototype.ccBS = function () {
        logger.log('INFO', 'BS - BackSpace');
        if (this.mode === 'MODE_TEXT') {
            return;
        }
        this.writeScreen.backSpace();
        if (this.writeScreen === this.displayedMemory) {
            this.outputDataUpdate();
        }
    };
    Cea608Channel.prototype.ccAOF = function () {
    };
    Cea608Channel.prototype.ccAON = function () {
    };
    Cea608Channel.prototype.ccDER = function () {
        logger.log('INFO', 'DER- Delete to End of Row');
        this.writeScreen.clearToEndOfRow();
        this.outputDataUpdate();
    };
    Cea608Channel.prototype.ccRU = function (nrRows) {
        logger.log('INFO', 'RU(' + nrRows + ') - Roll Up');
        this.writeScreen = this.displayedMemory;
        this.setMode('MODE_ROLL-UP');
        this.writeScreen.setRollUpRows(nrRows);
    };
    Cea608Channel.prototype.ccFON = function () {
        logger.log('INFO', 'FON - Flash On');
        this.writeScreen.setPen({ flash: true });
    };
    Cea608Channel.prototype.ccRDC = function () {
        logger.log('INFO', 'RDC - Resume Direct Captioning');
        this.setMode('MODE_PAINT-ON');
    };
    Cea608Channel.prototype.ccTR = function () {
        logger.log('INFO', 'TR');
        this.setMode('MODE_TEXT');
    };
    Cea608Channel.prototype.ccRTD = function () {
        logger.log('INFO', 'RTD');
        this.setMode('MODE_TEXT');
    };
    Cea608Channel.prototype.ccEDM = function () {
        logger.log('INFO', 'EDM - Erase Displayed Memory');
        this.displayedMemory.reset();
        this.outputDataUpdate(true);
    };
    Cea608Channel.prototype.ccCR = function () {
        logger.log('CR - Carriage Return');
        this.writeScreen.rollUp();
        this.outputDataUpdate(true);
    };
    Cea608Channel.prototype.ccENM = function () {
        logger.log('INFO', 'ENM - Erase Non-displayed Memory');
        this.nonDisplayedMemory.reset();
    };
    Cea608Channel.prototype.ccEOC = function () {
        logger.log('INFO', 'EOC - End Of Caption');
        if (this.mode === 'MODE_POP-ON') {
            var tmp = this.displayedMemory;
            this.displayedMemory = this.nonDisplayedMemory;
            this.nonDisplayedMemory = tmp;
            this.writeScreen = this.nonDisplayedMemory;
            logger.log('TEXT', 'DISP: ' + this.displayedMemory.getDisplayText());
        }
        this.outputDataUpdate(true);
    };
    Cea608Channel.prototype.ccTO = function (nrCols) {
        logger.log('INFO', 'TO(' + nrCols + ') - Tab Offset');
        this.writeScreen.moveCursor(nrCols);
    };
    Cea608Channel.prototype.ccMIDROW = function (secondByte) {
        var styles = { flash: false };
        styles.underline = secondByte % 2 === 1;
        styles.italics = secondByte >= 0x2e;
        if (!styles.italics) {
            var colorIndex = Math.floor(secondByte / 2) - 0x10;
            var colors = ['white', 'green', 'blue', 'cyan', 'red', 'yellow', 'magenta'];
            styles.foreground = colors[colorIndex];
        }
        else {
            styles.foreground = 'white';
        }
        logger.log('INFO', 'MIDROW: ' + JSON.stringify(styles));
        this.writeScreen.setPen(styles);
    };
    Cea608Channel.prototype.outputDataUpdate = function (dispatch) {
        if (dispatch === void 0) { dispatch = false; }
        var t = logger.time;
        if (t === null) {
            return;
        }
        if (this.outputFilter) {
            if (this.cueStartTime === null && !this.displayedMemory.isEmpty()) { // Start of a new cue
                this.cueStartTime = t;
            }
            else {
                if (!this.displayedMemory.equals(this.lastOutputScreen)) {
                    if (this.outputFilter.newCue) {
                        this.outputFilter.newCue(this.cueStartTime, t, this.lastOutputScreen);
                        if (dispatch === true && this.outputFilter.dispatchCue) {
                            this.outputFilter.dispatchCue();
                        }
                    }
                    this.cueStartTime = this.displayedMemory.isEmpty() ? null : t;
                }
            }
            this.lastOutputScreen.copy(this.displayedMemory);
        }
    };
    Cea608Channel.prototype.cueSplitAtTime = function (t) {
        if (this.outputFilter) {
            if (!this.displayedMemory.isEmpty()) {
                if (this.outputFilter.newCue) {
                    this.outputFilter.newCue(this.cueStartTime, t, this.displayedMemory);
                }
                this.cueStartTime = t;
            }
        }
    };
    return Cea608Channel;
}());
var Cea608Parser = /** @class */ (function () {
    function Cea608Parser(field, out1, out2) {
        this.field = field || 1;
        this.outputs = [out1, out2];
        this.channels = [new Cea608Channel(1, out1), new Cea608Channel(2, out2)];
        this.currChNr = -1; // Will be 1 or 2
        this.lastCmdA = null; // First byte of last command
        this.lastCmdB = null; // Second byte of last command
        this.bufferedData = [];
        this.startTime = null;
        this.lastTime = null;
        this.dataCounters = { 'padding': 0, 'char': 0, 'cmd': 0, 'other': 0 };
    }
    Cea608Parser.prototype.getHandler = function (index) {
        return this.channels[index].getHandler();
    };
    Cea608Parser.prototype.setHandler = function (index, newHandler) {
        this.channels[index].setHandler(newHandler);
    };
    /**
       * Add data for time t in forms of list of bytes (unsigned ints). The bytes are treated as pairs.
       */
    Cea608Parser.prototype.addData = function (t, byteList) {
        var cmdFound, a, b, charsFound = false;
        this.lastTime = t;
        logger.setTime(t);
        for (var i = 0; i < byteList.length; i += 2) {
            a = byteList[i] & 0x7f;
            b = byteList[i + 1] & 0x7f;
            if (a === 0 && b === 0) {
                this.dataCounters.padding += 2;
                continue;
            }
            else {
                logger.log('DATA', '[' + numArrayToHexArray([byteList[i], byteList[i + 1]]) + '] -> (' + numArrayToHexArray([a, b]) + ')');
            }
            cmdFound = this.parseCmd(a, b);
            if (!cmdFound) {
                cmdFound = this.parseMidrow(a, b);
            }
            if (!cmdFound) {
                cmdFound = this.parsePAC(a, b);
            }
            if (!cmdFound) {
                cmdFound = this.parseBackgroundAttributes(a, b);
            }
            if (!cmdFound) {
                charsFound = this.parseChars(a, b);
                if (charsFound) {
                    if (this.currChNr && this.currChNr >= 0) {
                        var channel = this.channels[this.currChNr - 1];
                        channel.insertChars(charsFound);
                    }
                    else {
                        logger.log('WARNING', 'No channel found yet. TEXT-MODE?');
                    }
                }
            }
            if (cmdFound) {
                this.dataCounters.cmd += 2;
            }
            else if (charsFound) {
                this.dataCounters.char += 2;
            }
            else {
                this.dataCounters.other += 2;
                logger.log('WARNING', 'Couldn\'t parse cleaned data ' + numArrayToHexArray([a, b]) +
                    ' orig: ' + numArrayToHexArray([byteList[i], byteList[i + 1]]));
            }
        }
    };
    /**
       * Parse Command.
       * @returns {Boolean} Tells if a command was found
       */
    Cea608Parser.prototype.parseCmd = function (a, b) {
        var chNr = null;
        var cond1 = (a === 0x14 || a === 0x1C) && (b >= 0x20 && b <= 0x2F);
        var cond2 = (a === 0x17 || a === 0x1F) && (b >= 0x21 && b <= 0x23);
        if (!(cond1 || cond2)) {
            return false;
        }
        if (a === this.lastCmdA && b === this.lastCmdB) {
            this.lastCmdA = null;
            this.lastCmdB = null; // Repeated commands are dropped (once)
            logger.log('DEBUG', 'Repeated command (' + numArrayToHexArray([a, b]) + ') is dropped');
            return true;
        }
        if (a === 0x14 || a === 0x17) {
            chNr = 1;
        }
        else {
            chNr = 2;
        } // (a === 0x1C || a=== 0x1f)
        var channel = this.channels[chNr - 1];
        if (a === 0x14 || a === 0x1C) {
            if (b === 0x20) {
                channel.ccRCL();
            }
            else if (b === 0x21) {
                channel.ccBS();
            }
            else if (b === 0x22) {
                channel.ccAOF();
            }
            else if (b === 0x23) {
                channel.ccAON();
            }
            else if (b === 0x24) {
                channel.ccDER();
            }
            else if (b === 0x25) {
                channel.ccRU(2);
            }
            else if (b === 0x26) {
                channel.ccRU(3);
            }
            else if (b === 0x27) {
                channel.ccRU(4);
            }
            else if (b === 0x28) {
                channel.ccFON();
            }
            else if (b === 0x29) {
                channel.ccRDC();
            }
            else if (b === 0x2A) {
                channel.ccTR();
            }
            else if (b === 0x2B) {
                channel.ccRTD();
            }
            else if (b === 0x2C) {
                channel.ccEDM();
            }
            else if (b === 0x2D) {
                channel.ccCR();
            }
            else if (b === 0x2E) {
                channel.ccENM();
            }
            else if (b === 0x2F) {
                channel.ccEOC();
            }
        }
        else { // a == 0x17 || a == 0x1F
            channel.ccTO(b - 0x20);
        }
        this.lastCmdA = a;
        this.lastCmdB = b;
        this.currChNr = chNr;
        return true;
    };
    /**
       * Parse midrow styling command
       * @returns {Boolean}
       */
    Cea608Parser.prototype.parseMidrow = function (a, b) {
        var chNr = null;
        if (((a === 0x11) || (a === 0x19)) && b >= 0x20 && b <= 0x2f) {
            if (a === 0x11) {
                chNr = 1;
            }
            else {
                chNr = 2;
            }
            if (chNr !== this.currChNr) {
                logger.log('ERROR', 'Mismatch channel in midrow parsing');
                return false;
            }
            var channel = this.channels[chNr - 1];
            channel.ccMIDROW(b);
            logger.log('DEBUG', 'MIDROW (' + numArrayToHexArray([a, b]) + ')');
            return true;
        }
        return false;
    };
    /**
       * Parse Preable Access Codes (Table 53).
       * @returns {Boolean} Tells if PAC found
       */
    Cea608Parser.prototype.parsePAC = function (a, b) {
        var chNr = null;
        var row = null;
        var case1 = ((a >= 0x11 && a <= 0x17) || (a >= 0x19 && a <= 0x1F)) && (b >= 0x40 && b <= 0x7F);
        var case2 = (a === 0x10 || a === 0x18) && (b >= 0x40 && b <= 0x5F);
        if (!(case1 || case2)) {
            return false;
        }
        if (a === this.lastCmdA && b === this.lastCmdB) {
            this.lastCmdA = null;
            this.lastCmdB = null;
            return true; // Repeated commands are dropped (once)
        }
        chNr = (a <= 0x17) ? 1 : 2;
        if (b >= 0x40 && b <= 0x5F) {
            row = (chNr === 1) ? rowsLowCh1[a] : rowsLowCh2[a];
        }
        else { // 0x60 <= b <= 0x7F
            row = (chNr === 1) ? rowsHighCh1[a] : rowsHighCh2[a];
        }
        var pacData = this.interpretPAC(row, b);
        var channel = this.channels[chNr - 1];
        channel.setPAC(pacData);
        this.lastCmdA = a;
        this.lastCmdB = b;
        this.currChNr = chNr;
        return true;
    };
    /**
       * Interpret the second byte of the pac, and return the information.
       * @returns {Object} pacData with style parameters.
       */
    Cea608Parser.prototype.interpretPAC = function (row, byte) {
        var pacIndex = byte;
        var pacData = { color: null, italics: false, indent: null, underline: false, row: row };
        if (byte > 0x5F) {
            pacIndex = byte - 0x60;
        }
        else {
            pacIndex = byte - 0x40;
        }
        pacData.underline = (pacIndex & 1) === 1;
        if (pacIndex <= 0xd) {
            pacData.color = ['white', 'green', 'blue', 'cyan', 'red', 'yellow', 'magenta', 'white'][Math.floor(pacIndex / 2)];
        }
        else if (pacIndex <= 0xf) {
            pacData.italics = true;
            pacData.color = 'white';
        }
        else {
            pacData.indent = (Math.floor((pacIndex - 0x10) / 2)) * 4;
        }
        return pacData; // Note that row has zero offset. The spec uses 1.
    };
    /**
       * Parse characters.
       * @returns An array with 1 to 2 codes corresponding to chars, if found. null otherwise.
       */
    Cea608Parser.prototype.parseChars = function (a, b) {
        var channelNr = null, charCodes = null, charCode1 = null;
        if (a >= 0x19) {
            channelNr = 2;
            charCode1 = a - 8;
        }
        else {
            channelNr = 1;
            charCode1 = a;
        }
        if (charCode1 >= 0x11 && charCode1 <= 0x13) {
            // Special character
            var oneCode = b;
            if (charCode1 === 0x11) {
                oneCode = b + 0x50;
            }
            else if (charCode1 === 0x12) {
                oneCode = b + 0x70;
            }
            else {
                oneCode = b + 0x90;
            }
            logger.log('INFO', 'Special char \'' + getCharForByte(oneCode) + '\' in channel ' + channelNr);
            charCodes = [oneCode];
        }
        else if (a >= 0x20 && a <= 0x7f) {
            charCodes = (b === 0) ? [a] : [a, b];
        }
        if (charCodes) {
            var hexCodes = numArrayToHexArray(charCodes);
            logger.log('DEBUG', 'Char codes =  ' + hexCodes.join(','));
            this.lastCmdA = null;
            this.lastCmdB = null;
        }
        return charCodes;
    };
    /**
      * Parse extended background attributes as well as new foreground color black.
      * @returns{Boolean} Tells if background attributes are found
      */
    Cea608Parser.prototype.parseBackgroundAttributes = function (a, b) {
        var bkgData, index, chNr, channel;
        var case1 = (a === 0x10 || a === 0x18) && (b >= 0x20 && b <= 0x2f);
        var case2 = (a === 0x17 || a === 0x1f) && (b >= 0x2d && b <= 0x2f);
        if (!(case1 || case2)) {
            return false;
        }
        bkgData = {};
        if (a === 0x10 || a === 0x18) {
            index = Math.floor((b - 0x20) / 2);
            bkgData.background = backgroundColors[index];
            if (b % 2 === 1) {
                bkgData.background = bkgData.background + '_semi';
            }
        }
        else if (b === 0x2d) {
            bkgData.background = 'transparent';
        }
        else {
            bkgData.foreground = 'black';
            if (b === 0x2f) {
                bkgData.underline = true;
            }
        }
        chNr = (a < 0x18) ? 1 : 2;
        channel = this.channels[chNr - 1];
        channel.setBkgData(bkgData);
        this.lastCmdA = null;
        this.lastCmdB = null;
        return true;
    };
    /**
       * Reset state of parser and its channels.
       */
    Cea608Parser.prototype.reset = function () {
        for (var i = 0; i < this.channels.length; i++) {
            if (this.channels[i]) {
                this.channels[i].reset();
            }
        }
        this.lastCmdA = null;
        this.lastCmdB = null;
    };
    /**
       * Trigger the generation of a cue, and the start of a new one if displayScreens are not empty.
       */
    Cea608Parser.prototype.cueSplitAtTime = function (t) {
        for (var i = 0; i < this.channels.length; i++) {
            if (this.channels[i]) {
                this.channels[i].cueSplitAtTime(t);
            }
        }
    };
    return Cea608Parser;
}());
exports.default = Cea608Parser;


/***/ }),

/***/ "./src/utils/codecs.js":
/*!*****************************!*\
  !*** ./src/utils/codecs.js ***!
  \*****************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
// from http://mp4ra.org/codecs.html
var sampleEntryCodesISO = {
    audio: {
        'a3ds': true,
        'ac-3': true,
        'ac-4': true,
        'alac': true,
        'alaw': true,
        'dra1': true,
        'dts+': true,
        'dts-': true,
        'dtsc': true,
        'dtse': true,
        'dtsh': true,
        'ec-3': true,
        'enca': true,
        'g719': true,
        'g726': true,
        'm4ae': true,
        'mha1': true,
        'mha2': true,
        'mhm1': true,
        'mhm2': true,
        'mlpa': true,
        'mp4a': true,
        'raw ': true,
        'Opus': true,
        'samr': true,
        'sawb': true,
        'sawp': true,
        'sevc': true,
        'sqcp': true,
        'ssmv': true,
        'twos': true,
        'ulaw': true
    },
    video: {
        'avc1': true,
        'avc2': true,
        'avc3': true,
        'avc4': true,
        'avcp': true,
        'drac': true,
        'dvav': true,
        'dvhe': true,
        'encv': true,
        'hev1': true,
        'hvc1': true,
        'mjp2': true,
        'mp4v': true,
        'mvc1': true,
        'mvc2': true,
        'mvc3': true,
        'mvc4': true,
        'resv': true,
        'rv60': true,
        's263': true,
        'svc1': true,
        'svc2': true,
        'vc-1': true,
        'vp08': true,
        'vp09': true
    }
};
function isCodecType(codec, type) {
    var typeCodes = sampleEntryCodesISO[type];
    return !!typeCodes && typeCodes[codec.slice(0, 4)] === true;
}
exports.isCodecType = isCodecType;
function isCodecSupportedInMp4(codec, type) {
    return window.MediaSource.isTypeSupported((type || 'video') + "/mp4;codecs=\"" + codec + "\"");
}
exports.isCodecSupportedInMp4 = isCodecSupportedInMp4;


/***/ }),

/***/ "./src/utils/cues.js":
/*!***************************!*\
  !*** ./src/utils/cues.js ***!
  \***************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var vttparser_1 = __webpack_require__(/*! ./vttparser */ "./src/utils/vttparser.js");
function newCue(track, startTime, endTime, captionScreen) {
    var row;
    var cue;
    var indenting;
    var indent;
    var text;
    var VTTCue = window.VTTCue || window.TextTrackCue;
    for (var r = 0; r < captionScreen.rows.length; r++) {
        row = captionScreen.rows[r];
        indenting = true;
        indent = 0;
        text = '';
        if (!row.isEmpty()) {
            for (var c = 0; c < row.chars.length; c++) {
                if (row.chars[c].uchar.match(/\s/) && indenting) {
                    indent++;
                }
                else {
                    text += row.chars[c].uchar;
                    indenting = false;
                }
            }
            // To be used for cleaning-up orphaned roll-up captions
            row.cueStartTime = startTime;
            // Give a slight bump to the endTime if it's equal to startTime to avoid a SyntaxError in IE
            if (startTime === endTime) {
                endTime += 0.0001;
            }
            cue = new VTTCue(startTime, endTime, vttparser_1.fixLineBreaks(text.trim()));
            if (indent >= 16) {
                indent--;
            }
            else {
                indent++;
            }
            // VTTCue.line get's flakey when using controls, so let's now include line 13&14
            // also, drop line 1 since it's to close to the top
            if (navigator.userAgent.match(/Firefox\//)) {
                cue.line = r + 1;
            }
            else {
                cue.line = (r > 7 ? r - 2 : r + 1);
            }
            cue.align = 'left';
            // Clamp the position between 0 and 100 - if out of these bounds, Firefox throws an exception and captions break
            cue.position = Math.max(0, Math.min(100, 100 * (indent / 32) + (navigator.userAgent.match(/Firefox\//) ? 50 : 0)));
            track.addCue(cue);
        }
    }
}
exports.newCue = newCue;


/***/ }),

/***/ "./src/utils/discontinuities.js":
/*!**************************************!*\
  !*** ./src/utils/discontinuities.js ***!
  \**************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var binary_search_1 = __webpack_require__(/*! ./binary-search */ "./src/utils/binary-search.js");
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
function findFirstFragWithCC(fragments, cc) {
    var firstFrag = null;
    for (var i = 0; i < fragments.length; i += 1) {
        var currentFrag = fragments[i];
        if (currentFrag && currentFrag.cc === cc) {
            firstFrag = currentFrag;
            break;
        }
    }
    return firstFrag;
}
exports.findFirstFragWithCC = findFirstFragWithCC;
function findFragWithCC(fragments, CC) {
    return binary_search_1.default.search(fragments, function (candidate) {
        if (candidate.cc < CC) {
            return 1;
        }
        else if (candidate.cc > CC) {
            return -1;
        }
        else {
            return 0;
        }
    });
}
exports.findFragWithCC = findFragWithCC;
function shouldAlignOnDiscontinuities(lastFrag, lastLevel, details) {
    var shouldAlign = false;
    if (lastLevel && lastLevel.details && details) {
        if (details.endCC > details.startCC || (lastFrag && lastFrag.cc < details.startCC)) {
            shouldAlign = true;
        }
    }
    return shouldAlign;
}
exports.shouldAlignOnDiscontinuities = shouldAlignOnDiscontinuities;
// Find the first frag in the previous level which matches the CC of the first frag of the new level
function findDiscontinuousReferenceFrag(prevDetails, curDetails) {
    var prevFrags = prevDetails.fragments;
    var curFrags = curDetails.fragments;
    if (!curFrags.length || !prevFrags.length) {
        logger_1.logger.log('No fragments to align');
        return;
    }
    var prevStartFrag = findFirstFragWithCC(prevFrags, curFrags[0].cc);
    if (!prevStartFrag || (prevStartFrag && !prevStartFrag.startPTS)) {
        logger_1.logger.log('No frag in previous level to align on');
        return;
    }
    return prevStartFrag;
}
exports.findDiscontinuousReferenceFrag = findDiscontinuousReferenceFrag;
function adjustPts(sliding, details) {
    details.fragments.forEach(function (frag) {
        if (frag) {
            var start = frag.start + sliding;
            frag.start = frag.startPTS = start;
            frag.endPTS = start + frag.duration;
        }
    });
    details.PTSKnown = true;
}
exports.adjustPts = adjustPts;
/**
 * Using the parameters of the last level, this function computes PTS' of the new fragments so that they form a
 * contiguous stream with the last fragments.
 * The PTS of a fragment lets Hls.js know where it fits into a stream - by knowing every PTS, we know which fragment to
 * download at any given time. PTS is normally computed when the fragment is demuxed, so taking this step saves us time
 * and an extra download.
 * @param lastFrag
 * @param lastLevel
 * @param details
 */
function alignStream(lastFrag, lastLevel, details) {
    alignDiscontinuities(lastFrag, details, lastLevel);
    if (!details.PTSKnown && lastLevel) {
        // If the PTS wasn't figured out via discontinuity sequence that means there was no CC increase within the level.
        // Aligning via Program Date Time should therefore be reliable, since PDT should be the same within the same
        // discontinuity sequence.
        alignPDT(details, lastLevel.details);
    }
}
exports.alignStream = alignStream;
/**
 * Computes the PTS if a new level's fragments using the PTS of a fragment in the last level which shares the same
 * discontinuity sequence.
 * @param lastLevel - The details of the last loaded level
 * @param details - The details of the new level
 */
function alignDiscontinuities(lastFrag, details, lastLevel) {
    if (shouldAlignOnDiscontinuities(lastFrag, lastLevel, details)) {
        var referenceFrag = findDiscontinuousReferenceFrag(lastLevel.details, details);
        if (referenceFrag) {
            logger_1.logger.log('Adjusting PTS using last level due to CC increase within current level');
            adjustPts(referenceFrag.start, details);
        }
    }
}
exports.alignDiscontinuities = alignDiscontinuities;
/**
 * Computes the PTS of a new level's fragments using the difference in Program Date Time from the last level.
 * @param details - The details of the new level
 * @param lastDetails - The details of the last loaded level
 */
function alignPDT(details, lastDetails) {
    if (lastDetails && lastDetails.fragments.length) {
        if (!details.hasProgramDateTime || !lastDetails.hasProgramDateTime) {
            return;
        }
        // if last level sliding is 1000 and its first frag PROGRAM-DATE-TIME is 2017-08-20 1:10:00 AM
        // and if new details first frag PROGRAM DATE-TIME is 2017-08-20 1:10:08 AM
        // then we can deduce that playlist B sliding is 1000+8 = 1008s
        var lastPDT = lastDetails.fragments[0].programDateTime;
        var newPDT = details.fragments[0].programDateTime;
        // date diff is in ms. frag.start is in seconds
        var sliding = (newPDT - lastPDT) / 1000 + lastDetails.fragments[0].start;
        if (Number.isFinite(sliding)) {
            logger_1.logger.log("adjusting PTS using programDateTime delta, sliding:" + sliding.toFixed(3));
            adjustPts(sliding, details);
        }
    }
}
exports.alignPDT = alignPDT;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/utils/ewma-bandwidth-estimator.js":
/*!***********************************************!*\
  !*** ./src/utils/ewma-bandwidth-estimator.js ***!
  \***********************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * EWMA Bandwidth Estimator
 *  - heavily inspired from shaka-player
 * Tracks bandwidth samples and estimates available bandwidth.
 * Based on the minimum of two exponentially-weighted moving averages with
 * different half-lives.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var ewma_1 = __webpack_require__(/*! ../utils/ewma */ "./src/utils/ewma.js");
var EwmaBandWidthEstimator = /** @class */ (function () {
    function EwmaBandWidthEstimator(hls, slow, fast, defaultEstimate) {
        this.hls = hls;
        this.defaultEstimate_ = defaultEstimate;
        this.minWeight_ = 0.001;
        this.minDelayMs_ = 50;
        this.slow_ = new ewma_1.default(slow);
        this.fast_ = new ewma_1.default(fast);
    }
    EwmaBandWidthEstimator.prototype.sample = function (durationMs, numBytes) {
        durationMs = Math.max(durationMs, this.minDelayMs_);
        var bandwidth = 8000 * numBytes / durationMs, 
        // console.log('instant bw:'+ Math.round(bandwidth));
        // we weight sample using loading duration....
        weight = durationMs / 1000;
        this.fast_.sample(weight, bandwidth);
        this.slow_.sample(weight, bandwidth);
    };
    EwmaBandWidthEstimator.prototype.canEstimate = function () {
        var fast = this.fast_;
        return (fast && fast.getTotalWeight() >= this.minWeight_);
    };
    EwmaBandWidthEstimator.prototype.getEstimate = function () {
        if (this.canEstimate()) {
            // console.log('slow estimate:'+ Math.round(this.slow_.getEstimate()));
            // console.log('fast estimate:'+ Math.round(this.fast_.getEstimate()));
            // Take the minimum of these two estimates.  This should have the effect of
            // adapting down quickly, but up more slowly.
            return Math.min(this.fast_.getEstimate(), this.slow_.getEstimate());
        }
        else {
            return this.defaultEstimate_;
        }
    };
    EwmaBandWidthEstimator.prototype.destroy = function () {
    };
    return EwmaBandWidthEstimator;
}());
exports.default = EwmaBandWidthEstimator;


/***/ }),

/***/ "./src/utils/ewma.js":
/*!***************************!*\
  !*** ./src/utils/ewma.js ***!
  \***************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * compute an Exponential Weighted moving average
 * - https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average
 *  - heavily inspired from shaka-player
 */
Object.defineProperty(exports, "__esModule", { value: true });
var EWMA = /** @class */ (function () {
    //  About half of the estimated value will be from the last |halfLife| samples by weight.
    function EWMA(halfLife) {
        // Larger values of alpha expire historical data more slowly.
        this.alpha_ = halfLife ? Math.exp(Math.log(0.5) / halfLife) : 0;
        this.estimate_ = 0;
        this.totalWeight_ = 0;
    }
    EWMA.prototype.sample = function (weight, value) {
        var adjAlpha = Math.pow(this.alpha_, weight);
        this.estimate_ = value * (1 - adjAlpha) + adjAlpha * this.estimate_;
        this.totalWeight_ += weight;
    };
    EWMA.prototype.getTotalWeight = function () {
        return this.totalWeight_;
    };
    EWMA.prototype.getEstimate = function () {
        if (this.alpha_) {
            var zeroFactor = 1 - Math.pow(this.alpha_, this.totalWeight_);
            return this.estimate_ / zeroFactor;
        }
        else {
            return this.estimate_;
        }
    };
    return EWMA;
}());
exports.default = EWMA;


/***/ }),

/***/ "./src/utils/get-self-scope.js":
/*!*************************************!*\
  !*** ./src/utils/get-self-scope.js ***!
  \*************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
function getSelfScope() {
    // see https://stackoverflow.com/a/11237259/589493
    if (typeof window === 'undefined') {
        /* eslint-disable-next-line no-undef */
        return self;
    }
    else {
        return window;
    }
}
exports.getSelfScope = getSelfScope;


/***/ }),

/***/ "./src/utils/logger.js":
/*!*****************************!*\
  !*** ./src/utils/logger.js ***!
  \*****************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var get_self_scope_1 = __webpack_require__(/*! ./get-self-scope */ "./src/utils/get-self-scope.js");
function noop() { }
var fakeLogger = {
    trace: noop,
    debug: noop,
    log: noop,
    warn: noop,
    info: noop,
    error: noop
};
var exportedLogger = fakeLogger;
// let lastCallTime;
// function formatMsgWithTimeInfo(type, msg) {
//   const now = Date.now();
//   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
//   lastCallTime = now;
//   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
//   return msg;
// }
function formatMsg(type, msg) {
    msg = '[' + type + '] > ' + msg;
    return msg;
}
var global = get_self_scope_1.getSelfScope();
function consolePrintFn(type) {
    var func = global.console[type];
    if (func) {
        return function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (args[0]) {
                args[0] = formatMsg(type, args[0]);
            }
            func.apply(global.console, args);
        };
    }
    return noop;
}
function exportLoggerFunctions(debugConfig) {
    var functions = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        functions[_i - 1] = arguments[_i];
    }
    functions.forEach(function (type) {
        exportedLogger[type] = debugConfig[type] ? debugConfig[type].bind(debugConfig) : consolePrintFn(type);
    });
}
exports.enableLogs = function (debugConfig) {
    if (debugConfig === true || typeof debugConfig === 'object') {
        exportLoggerFunctions(debugConfig, 
        // Remove out from list here to hard-disable a log-level
        // 'trace',
        'debug', 'log', 'info', 'warn', 'error');
        // Some browsers don't allow to use bind on console object anyway
        // fallback to default if needed
        try {
            exportedLogger.log();
        }
        catch (e) {
            exportedLogger = fakeLogger;
        }
    }
    else {
        exportedLogger = fakeLogger;
    }
};
exports.logger = exportedLogger;


/***/ }),

/***/ "./src/utils/mediakeys-helper.js":
/*!***************************************!*\
  !*** ./src/utils/mediakeys-helper.js ***!
  \***************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var requestMediaKeySystemAccess = (function () {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.requestMediaKeySystemAccess) {
        return window.navigator.requestMediaKeySystemAccess.bind(window.navigator);
    }
    else {
        return null;
    }
})();
exports.requestMediaKeySystemAccess = requestMediaKeySystemAccess;


/***/ }),

/***/ "./src/utils/mediasource-helper.js":
/*!*****************************************!*\
  !*** ./src/utils/mediasource-helper.js ***!
  \*****************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * MediaSource helper
 */
Object.defineProperty(exports, "__esModule", { value: true });
function getMediaSource() {
    if (typeof window !== 'undefined') {
        return window.MediaSource || window.WebKitMediaSource;
    }
}
exports.getMediaSource = getMediaSource;


/***/ }),

/***/ "./src/utils/output-filter.js":
/*!************************************!*\
  !*** ./src/utils/output-filter.js ***!
  \************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var OutputFilter = /** @class */ (function () {
    function OutputFilter(timelineController, trackName) {
        this.timelineController = timelineController;
        this.trackName = trackName;
        this.startTime = null;
        this.endTime = null;
        this.screen = null;
    }
    OutputFilter.prototype.dispatchCue = function () {
        if (this.startTime === null) {
            return;
        }
        this.timelineController.addCues(this.trackName, this.startTime, this.endTime, this.screen);
        this.startTime = null;
    };
    OutputFilter.prototype.newCue = function (startTime, endTime, screen) {
        if (this.startTime === null || this.startTime > startTime) {
            this.startTime = startTime;
        }
        this.endTime = endTime;
        this.screen = screen;
        this.timelineController.createCaptionsTrack(this.trackName);
    };
    return OutputFilter;
}());
exports.default = OutputFilter;


/***/ }),

/***/ "./src/utils/texttrack-utils.js":
/*!**************************************!*\
  !*** ./src/utils/texttrack-utils.js ***!
  \**************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
function sendAddTrackEvent(track, videoEl) {
    var event = null;
    try {
        event = new window.Event('addtrack');
    }
    catch (err) {
        // for IE11
        event = document.createEvent('Event');
        event.initEvent('addtrack', false, false);
    }
    event.track = track;
    videoEl.dispatchEvent(event);
}
exports.sendAddTrackEvent = sendAddTrackEvent;
function clearCurrentCues(track) {
    if (track && track.cues) {
        while (track.cues.length > 0) {
            track.removeCue(track.cues[0]);
        }
    }
}
exports.clearCurrentCues = clearCurrentCues;


/***/ }),

/***/ "./src/utils/time-ranges.js":
/*!**********************************!*\
  !*** ./src/utils/time-ranges.js ***!
  \**********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 *  TimeRanges to string helper
 */
Object.defineProperty(exports, "__esModule", { value: true });
var TimeRanges = {
    toString: function (r) {
        var log = '', len = r.length;
        for (var i = 0; i < len; i++) {
            log += '[' + r.start(i).toFixed(3) + ',' + r.end(i).toFixed(3) + ']';
        }
        return log;
    }
};
exports.default = TimeRanges;


/***/ }),

/***/ "./src/utils/vttcue.js":
/*!*****************************!*\
  !*** ./src/utils/vttcue.js ***!
  \*****************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * Copyright 2013 vtt.js Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (function () {
    if (typeof window !== 'undefined' && window.VTTCue) {
        return window.VTTCue;
    }
    var autoKeyword = 'auto';
    var directionSetting = {
        '': true,
        lr: true,
        rl: true
    };
    var alignSetting = {
        start: true,
        middle: true,
        end: true,
        left: true,
        right: true
    };
    function findDirectionSetting(value) {
        if (typeof value !== 'string') {
            return false;
        }
        var dir = directionSetting[value.toLowerCase()];
        return dir ? value.toLowerCase() : false;
    }
    function findAlignSetting(value) {
        if (typeof value !== 'string') {
            return false;
        }
        var align = alignSetting[value.toLowerCase()];
        return align ? value.toLowerCase() : false;
    }
    function extend(obj) {
        var i = 1;
        for (; i < arguments.length; i++) {
            var cobj = arguments[i];
            for (var p in cobj) {
                obj[p] = cobj[p];
            }
        }
        return obj;
    }
    function VTTCue(startTime, endTime, text) {
        var cue = this;
        var isIE8 = (function () {
            if (typeof navigator === 'undefined') {
                return;
            }
            return (/MSIE\s8\.0/).test(navigator.userAgent);
        })();
        var baseObj = {};
        if (isIE8) {
            cue = document.createElement('custom');
        }
        else {
            baseObj.enumerable = true;
        }
        /**
         * Shim implementation specific properties. These properties are not in
         * the spec.
         */
        // Lets us know when the VTTCue's data has changed in such a way that we need
        // to recompute its display state. This lets us compute its display state
        // lazily.
        cue.hasBeenReset = false;
        /**
         * VTTCue and TextTrackCue properties
         * http://dev.w3.org/html5/webvtt/#vttcue-interface
         */
        var _id = '';
        var _pauseOnExit = false;
        var _startTime = startTime;
        var _endTime = endTime;
        var _text = text;
        var _region = null;
        var _vertical = '';
        var _snapToLines = true;
        var _line = 'auto';
        var _lineAlign = 'start';
        var _position = 50;
        var _positionAlign = 'middle';
        var _size = 50;
        var _align = 'middle';
        Object.defineProperty(cue, 'id', extend({}, baseObj, {
            get: function () {
                return _id;
            },
            set: function (value) {
                _id = '' + value;
            }
        }));
        Object.defineProperty(cue, 'pauseOnExit', extend({}, baseObj, {
            get: function () {
                return _pauseOnExit;
            },
            set: function (value) {
                _pauseOnExit = !!value;
            }
        }));
        Object.defineProperty(cue, 'startTime', extend({}, baseObj, {
            get: function () {
                return _startTime;
            },
            set: function (value) {
                if (typeof value !== 'number') {
                    throw new TypeError('Start time must be set to a number.');
                }
                _startTime = value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'endTime', extend({}, baseObj, {
            get: function () {
                return _endTime;
            },
            set: function (value) {
                if (typeof value !== 'number') {
                    throw new TypeError('End time must be set to a number.');
                }
                _endTime = value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'text', extend({}, baseObj, {
            get: function () {
                return _text;
            },
            set: function (value) {
                _text = '' + value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'region', extend({}, baseObj, {
            get: function () {
                return _region;
            },
            set: function (value) {
                _region = value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'vertical', extend({}, baseObj, {
            get: function () {
                return _vertical;
            },
            set: function (value) {
                var setting = findDirectionSetting(value);
                // Have to check for false because the setting an be an empty string.
                if (setting === false) {
                    throw new SyntaxError('An invalid or illegal string was specified.');
                }
                _vertical = setting;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'snapToLines', extend({}, baseObj, {
            get: function () {
                return _snapToLines;
            },
            set: function (value) {
                _snapToLines = !!value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'line', extend({}, baseObj, {
            get: function () {
                return _line;
            },
            set: function (value) {
                if (typeof value !== 'number' && value !== autoKeyword) {
                    throw new SyntaxError('An invalid number or illegal string was specified.');
                }
                _line = value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'lineAlign', extend({}, baseObj, {
            get: function () {
                return _lineAlign;
            },
            set: function (value) {
                var setting = findAlignSetting(value);
                if (!setting) {
                    throw new SyntaxError('An invalid or illegal string was specified.');
                }
                _lineAlign = setting;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'position', extend({}, baseObj, {
            get: function () {
                return _position;
            },
            set: function (value) {
                if (value < 0 || value > 100) {
                    throw new Error('Position must be between 0 and 100.');
                }
                _position = value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'positionAlign', extend({}, baseObj, {
            get: function () {
                return _positionAlign;
            },
            set: function (value) {
                var setting = findAlignSetting(value);
                if (!setting) {
                    throw new SyntaxError('An invalid or illegal string was specified.');
                }
                _positionAlign = setting;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'size', extend({}, baseObj, {
            get: function () {
                return _size;
            },
            set: function (value) {
                if (value < 0 || value > 100) {
                    throw new Error('Size must be between 0 and 100.');
                }
                _size = value;
                this.hasBeenReset = true;
            }
        }));
        Object.defineProperty(cue, 'align', extend({}, baseObj, {
            get: function () {
                return _align;
            },
            set: function (value) {
                var setting = findAlignSetting(value);
                if (!setting) {
                    throw new SyntaxError('An invalid or illegal string was specified.');
                }
                _align = setting;
                this.hasBeenReset = true;
            }
        }));
        /**
         * Other <track> spec defined properties
         */
        // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-video-element.html#text-track-cue-display-state
        cue.displayState = undefined;
        if (isIE8) {
            return cue;
        }
    }
    /**
     * VTTCue methods
     */
    VTTCue.prototype.getCueAsHTML = function () {
        // Assume WebVTT.convertCueToDOMTree is on the global.
        var WebVTT = window.WebVTT;
        return WebVTT.convertCueToDOMTree(window, this.text);
    };
    return VTTCue;
})();


/***/ }),

/***/ "./src/utils/vttparser.js":
/*!********************************!*\
  !*** ./src/utils/vttparser.js ***!
  \********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*
 * Source: https://github.com/mozilla/vtt.js/blob/master/dist/vtt.js#L1716
 */
Object.defineProperty(exports, "__esModule", { value: true });
var vttcue_1 = __webpack_require__(/*! ./vttcue */ "./src/utils/vttcue.js");
var StringDecoder = function StringDecoder() {
    return {
        decode: function (data) {
            if (!data) {
                return '';
            }
            if (typeof data !== 'string') {
                throw new Error('Error - expected string data.');
            }
            return decodeURIComponent(encodeURIComponent(data));
        }
    };
};
function VTTParser() {
    this.window = window;
    this.state = 'INITIAL';
    this.buffer = '';
    this.decoder = new StringDecoder();
    this.regionList = [];
}
// Try to parse input as a time stamp.
function parseTimeStamp(input) {
    function computeSeconds(h, m, s, f) {
        return (h | 0) * 3600 + (m | 0) * 60 + (s | 0) + (f | 0) / 1000;
    }
    var m = input.match(/^(\d+):(\d{2})(:\d{2})?\.(\d{3})/);
    if (!m) {
        return null;
    }
    if (m[3]) {
        // Timestamp takes the form of [hours]:[minutes]:[seconds].[milliseconds]
        return computeSeconds(m[1], m[2], m[3].replace(':', ''), m[4]);
    }
    else if (m[1] > 59) {
        // Timestamp takes the form of [hours]:[minutes].[milliseconds]
        // First position is hours as it's over 59.
        return computeSeconds(m[1], m[2], 0, m[4]);
    }
    else {
        // Timestamp takes the form of [minutes]:[seconds].[milliseconds]
        return computeSeconds(0, m[1], m[2], m[4]);
    }
}
// A settings object holds key/value pairs and will ignore anything but the first
// assignment to a specific key.
function Settings() {
    this.values = Object.create(null);
}
Settings.prototype = {
    // Only accept the first assignment to any key.
    set: function (k, v) {
        if (!this.get(k) && v !== '') {
            this.values[k] = v;
        }
    },
    // Return the value for a key, or a default value.
    // If 'defaultKey' is passed then 'dflt' is assumed to be an object with
    // a number of possible default values as properties where 'defaultKey' is
    // the key of the property that will be chosen; otherwise it's assumed to be
    // a single value.
    get: function (k, dflt, defaultKey) {
        if (defaultKey) {
            return this.has(k) ? this.values[k] : dflt[defaultKey];
        }
        return this.has(k) ? this.values[k] : dflt;
    },
    // Check whether we have a value for a key.
    has: function (k) {
        return k in this.values;
    },
    // Accept a setting if its one of the given alternatives.
    alt: function (k, v, a) {
        for (var n = 0; n < a.length; ++n) {
            if (v === a[n]) {
                this.set(k, v);
                break;
            }
        }
    },
    // Accept a setting if its a valid (signed) integer.
    integer: function (k, v) {
        if (/^-?\d+$/.test(v)) { // integer
            this.set(k, parseInt(v, 10));
        }
    },
    // Accept a setting if its a valid percentage.
    percent: function (k, v) {
        var m;
        if ((m = v.match(/^([\d]{1,3})(\.[\d]*)?%$/))) {
            v = parseFloat(v);
            if (v >= 0 && v <= 100) {
                this.set(k, v);
                return true;
            }
        }
        return false;
    }
};
// Helper function to parse input into groups separated by 'groupDelim', and
// interprete each group as a key/value pair separated by 'keyValueDelim'.
function parseOptions(input, callback, keyValueDelim, groupDelim) {
    var groups = groupDelim ? input.split(groupDelim) : [input];
    for (var i in groups) {
        if (typeof groups[i] !== 'string') {
            continue;
        }
        var kv = groups[i].split(keyValueDelim);
        if (kv.length !== 2) {
            continue;
        }
        var k = kv[0];
        var v = kv[1];
        callback(k, v);
    }
}
var defaults = new vttcue_1.default(0, 0, 0);
// 'middle' was changed to 'center' in the spec: https://github.com/w3c/webvtt/pull/244
//  Safari doesn't yet support this change, but FF and Chrome do.
var center = defaults.align === 'middle' ? 'middle' : 'center';
function parseCue(input, cue, regionList) {
    // Remember the original input if we need to throw an error.
    var oInput = input;
    // 4.1 WebVTT timestamp
    function consumeTimeStamp() {
        var ts = parseTimeStamp(input);
        if (ts === null) {
            throw new Error('Malformed timestamp: ' + oInput);
        }
        // Remove time stamp from input.
        input = input.replace(/^[^\sa-zA-Z-]+/, '');
        return ts;
    }
    // 4.4.2 WebVTT cue settings
    function consumeCueSettings(input, cue) {
        var settings = new Settings();
        parseOptions(input, function (k, v) {
            switch (k) {
                case 'region':
                    // Find the last region we parsed with the same region id.
                    for (var i = regionList.length - 1; i >= 0; i--) {
                        if (regionList[i].id === v) {
                            settings.set(k, regionList[i].region);
                            break;
                        }
                    }
                    break;
                case 'vertical':
                    settings.alt(k, v, ['rl', 'lr']);
                    break;
                case 'line':
                    var vals = v.split(','), vals0 = vals[0];
                    settings.integer(k, vals0);
                    if (settings.percent(k, vals0)) {
                        settings.set('snapToLines', false);
                    }
                    settings.alt(k, vals0, ['auto']);
                    if (vals.length === 2) {
                        settings.alt('lineAlign', vals[1], ['start', center, 'end']);
                    }
                    break;
                case 'position':
                    vals = v.split(',');
                    settings.percent(k, vals[0]);
                    if (vals.length === 2) {
                        settings.alt('positionAlign', vals[1], ['start', center, 'end', 'line-left', 'line-right', 'auto']);
                    }
                    break;
                case 'size':
                    settings.percent(k, v);
                    break;
                case 'align':
                    settings.alt(k, v, ['start', center, 'end', 'left', 'right']);
                    break;
            }
        }, /:/, /\s/);
        // Apply default values for any missing fields.
        cue.region = settings.get('region', null);
        cue.vertical = settings.get('vertical', '');
        var line = settings.get('line', 'auto');
        if (line === 'auto' && defaults.line === -1) {
            // set numeric line number for Safari
            line = -1;
        }
        cue.line = line;
        cue.lineAlign = settings.get('lineAlign', 'start');
        cue.snapToLines = settings.get('snapToLines', true);
        cue.size = settings.get('size', 100);
        cue.align = settings.get('align', center);
        var position = settings.get('position', 'auto');
        if (position === 'auto' && defaults.position === 50) {
            // set numeric position for Safari
            position = cue.align === 'start' || cue.align === 'left' ? 0 : cue.align === 'end' || cue.align === 'right' ? 100 : 50;
        }
        cue.position = position;
    }
    function skipWhitespace() {
        input = input.replace(/^\s+/, '');
    }
    // 4.1 WebVTT cue timings.
    skipWhitespace();
    cue.startTime = consumeTimeStamp(); // (1) collect cue start time
    skipWhitespace();
    if (input.substr(0, 3) !== '-->') { // (3) next characters must match '-->'
        throw new Error('Malformed time stamp (time stamps must be separated by \'-->\'): ' +
            oInput);
    }
    input = input.substr(3);
    skipWhitespace();
    cue.endTime = consumeTimeStamp(); // (5) collect cue end time
    // 4.1 WebVTT cue settings list.
    skipWhitespace();
    consumeCueSettings(input, cue);
}
function fixLineBreaks(input) {
    return input.replace(/<br(?: \/)?>/gi, '\n');
}
exports.fixLineBreaks = fixLineBreaks;
VTTParser.prototype = {
    parse: function (data) {
        var self = this;
        // If there is no data then we won't decode it, but will just try to parse
        // whatever is in buffer already. This may occur in circumstances, for
        // example when flush() is called.
        if (data) {
            // Try to decode the data that we received.
            self.buffer += self.decoder.decode(data, { stream: true });
        }
        function collectNextLine() {
            var buffer = self.buffer;
            var pos = 0;
            buffer = fixLineBreaks(buffer);
            while (pos < buffer.length && buffer[pos] !== '\r' && buffer[pos] !== '\n') {
                ++pos;
            }
            var line = buffer.substr(0, pos);
            // Advance the buffer early in case we fail below.
            if (buffer[pos] === '\r') {
                ++pos;
            }
            if (buffer[pos] === '\n') {
                ++pos;
            }
            self.buffer = buffer.substr(pos);
            return line;
        }
        // 3.2 WebVTT metadata header syntax
        function parseHeader(input) {
            parseOptions(input, function (k, v) {
                switch (k) {
                    case 'Region':
                        // 3.3 WebVTT region metadata header syntax
                        // console.log('parse region', v);
                        // parseRegion(v);
                        break;
                }
            }, /:/);
        }
        // 5.1 WebVTT file parsing.
        try {
            var line = void 0;
            if (self.state === 'INITIAL') {
                // We can't start parsing until we have the first line.
                if (!/\r\n|\n/.test(self.buffer)) {
                    return this;
                }
                line = collectNextLine();
                // strip of UTF-8 BOM if any
                // https://en.wikipedia.org/wiki/Byte_order_mark#UTF-8
                var m = line.match(/^(ï»¿)?WEBVTT([ \t].*)?$/);
                if (!m || !m[0]) {
                    throw new Error('Malformed WebVTT signature.');
                }
                self.state = 'HEADER';
            }
            var alreadyCollectedLine = false;
            while (self.buffer) {
                // We can't parse a line until we have the full line.
                if (!/\r\n|\n/.test(self.buffer)) {
                    return this;
                }
                if (!alreadyCollectedLine) {
                    line = collectNextLine();
                }
                else {
                    alreadyCollectedLine = false;
                }
                switch (self.state) {
                    case 'HEADER':
                        // 13-18 - Allow a header (metadata) under the WEBVTT line.
                        if (/:/.test(line)) {
                            parseHeader(line);
                        }
                        else if (!line) {
                            // An empty line terminates the header and starts the body (cues).
                            self.state = 'ID';
                        }
                        continue;
                    case 'NOTE':
                        // Ignore NOTE blocks.
                        if (!line) {
                            self.state = 'ID';
                        }
                        continue;
                    case 'ID':
                        // Check for the start of NOTE blocks.
                        if (/^NOTE($|[ \t])/.test(line)) {
                            self.state = 'NOTE';
                            break;
                        }
                        // 19-29 - Allow any number of line terminators, then initialize new cue values.
                        if (!line) {
                            continue;
                        }
                        self.cue = new vttcue_1.default(0, 0, '');
                        self.state = 'CUE';
                        // 30-39 - Check if self line contains an optional identifier or timing data.
                        if (line.indexOf('-->') === -1) {
                            self.cue.id = line;
                            continue;
                        }
                    // Process line as start of a cue.
                    /* falls through */
                    case 'CUE':
                        // 40 - Collect cue timings and settings.
                        try {
                            parseCue(line, self.cue, self.regionList);
                        }
                        catch (e) {
                            // In case of an error ignore rest of the cue.
                            self.cue = null;
                            self.state = 'BADCUE';
                            continue;
                        }
                        self.state = 'CUETEXT';
                        continue;
                    case 'CUETEXT':
                        var hasSubstring = line.indexOf('-->') !== -1;
                        // 34 - If we have an empty line then report the cue.
                        // 35 - If we have the special substring '-->' then report the cue,
                        // but do not collect the line as we need to process the current
                        // one as a new cue.
                        if (!line || hasSubstring && (alreadyCollectedLine = true)) {
                            // We are done parsing self cue.
                            if (self.oncue) {
                                self.oncue(self.cue);
                            }
                            self.cue = null;
                            self.state = 'ID';
                            continue;
                        }
                        if (self.cue.text) {
                            self.cue.text += '\n';
                        }
                        self.cue.text += line;
                        continue;
                    case 'BADCUE': // BADCUE
                        // 54-62 - Collect and discard the remaining cue.
                        if (!line) {
                            self.state = 'ID';
                        }
                        continue;
                }
            }
        }
        catch (e) {
            // If we are currently parsing a cue, report what we have.
            if (self.state === 'CUETEXT' && self.cue && self.oncue) {
                self.oncue(self.cue);
            }
            self.cue = null;
            // Enter BADWEBVTT state if header was not parsed correctly otherwise
            // another exception occurred so enter BADCUE state.
            self.state = self.state === 'INITIAL' ? 'BADWEBVTT' : 'BADCUE';
        }
        return this;
    },
    flush: function () {
        var self = this;
        try {
            // Finish decoding the stream.
            self.buffer += self.decoder.decode();
            // Synthesize the end of the current cue or region.
            if (self.cue || self.state === 'HEADER') {
                self.buffer += '\n\n';
                self.parse();
            }
            // If we've flushed, parsed, and we're still on the INITIAL state then
            // that means we don't have enough of the stream to parse the first
            // line.
            if (self.state === 'INITIAL') {
                throw new Error('Malformed WebVTT signature.');
            }
        }
        catch (e) {
            throw e;
        }
        if (self.onflush) {
            self.onflush();
        }
        return this;
    }
};
exports.default = VTTParser;


/***/ }),

/***/ "./src/utils/webvtt-parser.js":
/*!************************************!*\
  !*** ./src/utils/webvtt-parser.js ***!
  \************************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(Number) {
Object.defineProperty(exports, "__esModule", { value: true });
var vttparser_1 = __webpack_require__(/*! ./vttparser */ "./src/utils/vttparser.js");
var id3_1 = __webpack_require__(/*! ../demux/id3 */ "./src/demux/id3.js");
// String.prototype.startsWith is not supported in IE11
var startsWith = function (inputString, searchString, position) {
    return inputString.substr(position || 0, searchString.length) === searchString;
};
var cueString2millis = function (timeString) {
    var ts = parseInt(timeString.substr(-3));
    var secs = parseInt(timeString.substr(-6, 2));
    var mins = parseInt(timeString.substr(-9, 2));
    var hours = timeString.length > 9 ? parseInt(timeString.substr(0, timeString.indexOf(':'))) : 0;
    if (!Number.isFinite(ts) || !Number.isFinite(secs) || !Number.isFinite(mins) || !Number.isFinite(hours)) {
        return -1;
    }
    ts += 1000 * secs;
    ts += 60 * 1000 * mins;
    ts += 60 * 60 * 1000 * hours;
    return ts;
};
// From https://github.com/darkskyapp/string-hash
var hash = function (text) {
    var hash = 5381;
    var i = text.length;
    while (i) {
        hash = (hash * 33) ^ text.charCodeAt(--i);
    }
    return (hash >>> 0).toString();
};
var calculateOffset = function (vttCCs, cc, presentationTime) {
    var currCC = vttCCs[cc];
    var prevCC = vttCCs[currCC.prevCC];
    // This is the first discontinuity or cues have been processed since the last discontinuity
    // Offset = current discontinuity time
    if (!prevCC || (!prevCC.new && currCC.new)) {
        vttCCs.ccOffset = vttCCs.presentationOffset = currCC.start;
        currCC.new = false;
        return;
    }
    // There have been discontinuities since cues were last parsed.
    // Offset = time elapsed
    while (prevCC && prevCC.new) {
        vttCCs.ccOffset += currCC.start - prevCC.start;
        currCC.new = false;
        currCC = prevCC;
        prevCC = vttCCs[currCC.prevCC];
    }
    vttCCs.presentationOffset = presentationTime;
};
var WebVTTParser = {
    parse: function (vttByteArray, syncPTS, vttCCs, cc, callBack, errorCallBack) {
        // Convert byteArray into string, replacing any somewhat exotic linefeeds with "\n", then split on that character.
        var re = /\r\n|\n\r|\n|\r/g;
        // Uint8Array.prototype.reduce is not implemented in IE11
        var vttLines = id3_1.utf8ArrayToStr(new Uint8Array(vttByteArray)).trim().replace(re, '\n').split('\n');
        var cueTime = '00:00.000';
        var mpegTs = 0;
        var localTime = 0;
        var presentationTime = 0;
        var cues = [];
        var parsingError;
        var inHeader = true;
        // let VTTCue = VTTCue || window.TextTrackCue;
        // Create parser object using VTTCue with TextTrackCue fallback on certain browsers.
        var parser = new vttparser_1.default();
        parser.oncue = function (cue) {
            // Adjust cue timing; clamp cues to start no earlier than - and drop cues that don't end after - 0 on timeline.
            var currCC = vttCCs[cc];
            var cueOffset = vttCCs.ccOffset;
            // Update offsets for new discontinuities
            if (currCC && currCC.new) {
                if (localTime !== undefined) {
                    // When local time is provided, offset = discontinuity start time - local time
                    cueOffset = vttCCs.ccOffset = currCC.start;
                }
                else {
                    calculateOffset(vttCCs, cc, presentationTime);
                }
            }
            if (presentationTime) {
                // If we have MPEGTS, offset = presentation time + discontinuity offset
                cueOffset = presentationTime - vttCCs.presentationOffset;
            }
            cue.startTime += cueOffset - localTime;
            cue.endTime += cueOffset - localTime;
            // Create a unique hash id for a cue based on start/end times and text.
            // This helps timeline-controller to avoid showing repeated captions.
            cue.id = hash(cue.startTime.toString()) + hash(cue.endTime.toString()) + hash(cue.text);
            // Fix encoding of special characters. TODO: Test with all sorts of weird characters.
            cue.text = decodeURIComponent(encodeURIComponent(cue.text));
            if (cue.endTime > 0) {
                cues.push(cue);
            }
        };
        parser.onparsingerror = function (e) {
            parsingError = e;
        };
        parser.onflush = function () {
            if (parsingError && errorCallBack) {
                errorCallBack(parsingError);
                return;
            }
            callBack(cues);
        };
        // Go through contents line by line.
        vttLines.forEach(function (line) {
            if (inHeader) {
                // Look for X-TIMESTAMP-MAP in header.
                if (startsWith(line, 'X-TIMESTAMP-MAP=')) {
                    // Once found, no more are allowed anyway, so stop searching.
                    inHeader = false;
                    // Extract LOCAL and MPEGTS.
                    line.substr(16).split(',').forEach(function (timestamp) {
                        if (startsWith(timestamp, 'LOCAL:')) {
                            cueTime = timestamp.substr(6);
                        }
                        else if (startsWith(timestamp, 'MPEGTS:')) {
                            mpegTs = parseInt(timestamp.substr(7));
                        }
                    });
                    try {
                        // Calculate subtitle offset in milliseconds.
                        syncPTS = syncPTS < 0 ? syncPTS + 8589934592 : syncPTS;
                        // Adjust MPEGTS by sync PTS.
                        mpegTs -= syncPTS;
                        // Convert cue time to seconds
                        localTime = cueString2millis(cueTime) / 1000;
                        // Convert MPEGTS to seconds from 90kHz.
                        presentationTime = mpegTs / 90000;
                        if (localTime === -1) {
                            parsingError = new Error("Malformed X-TIMESTAMP-MAP: " + line);
                        }
                    }
                    catch (e) {
                        parsingError = new Error("Malformed X-TIMESTAMP-MAP: " + line);
                    }
                    // Return without parsing X-TIMESTAMP-MAP line.
                    return;
                }
                else if (line === '') {
                    inHeader = false;
                }
            }
            // Parse line by default.
            parser.parse(line + '\n');
        });
        parser.flush();
    }
};
exports.default = WebVTTParser;

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./src/polyfills/number */ "./src/polyfills/number.js")["Number"]))

/***/ }),

/***/ "./src/utils/xhr-loader.js":
/*!*********************************!*\
  !*** ./src/utils/xhr-loader.js ***!
  \*********************************/
/*! no static exports found */
/*! ModuleConcatenation bailout: Module is not an ECMAScript module */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * XHR based logger
*/
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = __webpack_require__(/*! ../utils/logger */ "./src/utils/logger.js");
var performance = window.performance, XMLHttpRequest = window.XMLHttpRequest;
var XhrLoader = /** @class */ (function () {
    function XhrLoader(config) {
        if (config && config.xhrSetup) {
            this.xhrSetup = config.xhrSetup;
        }
    }
    XhrLoader.prototype.destroy = function () {
        this.abort();
        this.loader = null;
    };
    XhrLoader.prototype.abort = function () {
        var loader = this.loader;
        if (loader && loader.readyState !== 4) {
            this.stats.aborted = true;
            loader.abort();
        }
        window.clearTimeout(this.requestTimeout);
        this.requestTimeout = null;
        window.clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
    };
    XhrLoader.prototype.load = function (context, config, callbacks) {
        this.context = context;
        this.config = config;
        this.callbacks = callbacks;
        this.stats = { trequest: performance.now(), retry: 0 };
        this.retryDelay = config.retryDelay;
        this.loadInternal();
    };
    XhrLoader.prototype.loadInternal = function () {
        var xhr, context = this.context;
        xhr = this.loader = new XMLHttpRequest();
        var stats = this.stats;
        stats.tfirst = 0;
        stats.loaded = 0;
        var xhrSetup = this.xhrSetup;
        try {
            if (xhrSetup) {
                try {
                    xhrSetup(xhr, context.url);
                }
                catch (e) {
                    // fix xhrSetup: (xhr, url) => {xhr.setRequestHeader("Content-Language", "test");}
                    // not working, as xhr.setRequestHeader expects xhr.readyState === OPEN
                    xhr.open('GET', context.url, true);
                    xhrSetup(xhr, context.url);
                }
            }
            if (!xhr.readyState) {
                xhr.open('GET', context.url, true);
            }
        }
        catch (e) {
            // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
            this.callbacks.onError({ code: xhr.status, text: e.message }, context, xhr);
            return;
        }
        if (context.rangeEnd) {
            xhr.setRequestHeader('Range', 'bytes=' + context.rangeStart + '-' + (context.rangeEnd - 1));
        }
        xhr.onreadystatechange = this.readystatechange.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.responseType = context.responseType;
        // setup timeout before we perform request
        this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), this.config.timeout);
        xhr.send();
    };
    XhrLoader.prototype.readystatechange = function (event) {
        var xhr = event.currentTarget, readyState = xhr.readyState, stats = this.stats, context = this.context, config = this.config;
        // don't proceed if xhr has been aborted
        if (stats.aborted) {
            return;
        }
        // >= HEADERS_RECEIVED
        if (readyState >= 2) {
            // clear xhr timeout and rearm it if readyState less than 4
            window.clearTimeout(this.requestTimeout);
            if (stats.tfirst === 0) {
                stats.tfirst = Math.max(performance.now(), stats.trequest);
            }
            if (readyState === 4) {
                var status_1 = xhr.status;
                // http status between 200 to 299 are all successful
                if (status_1 >= 200 && status_1 < 300) {
                    stats.tload = Math.max(stats.tfirst, performance.now());
                    var data = void 0, len = void 0;
                    if (context.responseType === 'arraybuffer') {
                        data = xhr.response;
                        len = data.byteLength;
                    }
                    else {
                        data = xhr.responseText;
                        len = data.length;
                    }
                    stats.loaded = stats.total = len;
                    var response = { url: xhr.responseURL, data: data };
                    this.callbacks.onSuccess(response, stats, context, xhr);
                }
                else {
                    // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
                    if (stats.retry >= config.maxRetry || (status_1 >= 400 && status_1 < 499)) {
                        logger_1.logger.error(status_1 + " while loading " + context.url);
                        this.callbacks.onError({ code: status_1, text: xhr.statusText }, context, xhr);
                    }
                    else {
                        // retry
                        logger_1.logger.warn(status_1 + " while loading " + context.url + ", retrying in " + this.retryDelay + "...");
                        // aborts and resets internal state
                        this.destroy();
                        // schedule retry
                        this.retryTimeout = window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
                        // set exponential backoff
                        this.retryDelay = Math.min(2 * this.retryDelay, config.maxRetryDelay);
                        stats.retry++;
                    }
                }
            }
            else {
                // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
                this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), config.timeout);
            }
        }
    };
    XhrLoader.prototype.loadtimeout = function () {
        logger_1.logger.warn("timeout while loading " + this.context.url);
        this.callbacks.onTimeout(this.stats, this.context, null);
    };
    XhrLoader.prototype.loadprogress = function (event) {
        var xhr = event.currentTarget, stats = this.stats;
        stats.loaded = event.loaded;
        if (event.lengthComputable) {
            stats.total = event.total;
        }
        var onProgress = this.callbacks.onProgress;
        if (onProgress) {
            // third arg is to provide on progress data
            onProgress(stats, this.context, null, xhr);
        }
    };
    return XhrLoader;
}());
exports.default = XhrLoader;


/***/ })

/******/ })["default"];
});
//# sourceMappingURL=hls.js.map