/******/ (() => {
  // webpackBootstrap
  /******/ 'use strict';
  /******/ var __webpack_modules__ = {
    /***/ './src/config-default.ts':
      /*!*******************************!*\
  !*** ./src/config-default.ts ***!
  \*******************************/
      /***/ (
        __unused_webpack_module,
        __webpack_exports__,
        __webpack_require__
      ) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ defaultConfig: () => /* binding */ defaultConfig,
          /* harmony export */
        });
        var defaultConfig = {
          debug: true,
        };

        /***/
      },

    /***/ './src/config-editor.ts':
      /*!******************************!*\
  !*** ./src/config-editor.ts ***!
  \******************************/
      /***/ (
        __unused_webpack_module,
        __webpack_exports__,
        __webpack_require__
      ) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ getConfig: () => /* binding */ getConfig,
          /* harmony export */ iife: () => /* binding */ iife,
          /* harmony export */
        });
        function getConfig(editor) {
          return new Promise(function (resolve, reject) {
            try {
              var config = eval(
                iife(editor.getValue().replace(/^[\s\w]+=[^{]*/, ''))
              );
              if (Object(config) === config && !Array.isArray(config)) {
                resolve(config);
              } else {
                throw new Error('Config must be an object');
              }
            } catch (error) {
              setTimeout(function () {
                reject(error);
              });
            }
          });
        }
        var iife = function iife(js) {
          return '(function(){\nreturn ' + js.replace(/^\s+/, '') + '}());\n';
        };

        /***/
      },

    /***/ './src/events-providers.ts':
      /*!*********************************!*\
  !*** ./src/events-providers.ts ***!
  \*********************************/
      /***/ (
        __unused_webpack_module,
        __webpack_exports__,
        __webpack_require__
      ) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ hlsJsEvents: () => /* binding */ hlsJsEvents,
          /* harmony export */
        });
        var hlsJsEvents = Object.values(self.Hls.Events);

        /***/
      },

    /***/ './src/events-video.ts':
      /*!*****************************!*\
  !*** ./src/events-video.ts ***!
  \*****************************/
      /***/ (
        __unused_webpack_module,
        __webpack_exports__,
        __webpack_require__
      ) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ attachListenersToVideoElements: () =>
            /* binding */ attachListenersToVideoElements,
          /* harmony export */ resetVideoElements: () =>
            /* binding */ resetVideoElements,
          /* harmony export */
        });
        var videoEvents = [
          'loadstart',
          'progress',
          'suspend',
          'abort',
          'error',
          'emptied',
          'stalled',
          'loadedmetadata',
          'loadeddata',
          'canplay',
          'canplaythrough',
          'playing',
          'waiting',
          'seeking',
          'seeked',
          'ended',
          'durationchange',
          'timeupdate',
          'play',
          'pause',
          'ratechange',
          'resize',
          'volumechange',
        ];
        var videoTags = [];
        var eventListeners = [];
        var docCreateElement = document.createElement;
        var MutationObserver = window.MutationObserver; // || window.WebKitMutationObserver || window.MozMutationObserver;

        document.createElement = function () {
          var element = docCreateElement.apply(document, arguments);
          if (arguments[0] === 'video') {
            videoTags.push(element);
          }
          return element;
        };
        function attachListenersToVideoElements(genericEventHandler) {
          videoTags.forEach(function (video, i) {
            var tagListeners = eventListeners[i] || (eventListeners[i] = {});

            // MutationObserver is not available in some environments (Webkit)
            if (MutationObserver) {
              var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                  var attributeName = mutation.attributeName;
                  if (attributeName === null) {
                    return;
                  }
                  genericEventHandler(
                    video[attributeName],
                    'video[' + i + '].' + attributeName,
                    'video'
                  );
                });
              });
              observer.observe(video, {
                attributes: true,
              });
            }
            var load = video.load;
            var pause = video.pause;
            var play = video.play;
            video.load = function () {
              var result = load.call(this);
              genericEventHandler(result, 'video[' + i + '].load()', 'video');
              return result;
            };
            video.pause = function () {
              var result = pause.call(this);
              genericEventHandler(result, 'video[' + i + '].pause()', 'video');
              return result;
            };
            video.play = function () {
              var result = play.call(this);
              genericEventHandler(result, 'video[' + i + '].play()', 'video');
              return result;
            };
            videoEvents.forEach(function (eventName) {
              var eventHandler = function eventHandler(event) {
                genericEventHandler(
                  {
                    event: event,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    ended: video.ended,
                    muted: video.muted,
                    paused: video.paused,
                    playbackRate: video.playbackRate,
                    readyState: video.readyState,
                    seeking: video.seeking,
                    videoHeight: video.videoHeight,
                    videoWidth: video.videoWidth,
                    volume: video.volume,
                  },
                  'video[' + i + ']>' + event.type,
                  'video'
                );
              };
              tagListeners[eventName] = eventHandler;
              video.addEventListener(eventName, eventHandler);
            });
          });
        }
        function resetVideoElements() {
          eventListeners.forEach(function (tagListeners, i) {
            var video = videoTags[i];
            Object.keys(tagListeners).forEach(function (eventName) {
              video.removeEventListener(eventName, tagListeners[eventName]);
            });
          });
          videoTags.length = 0;
          eventListeners.length = 0;
        }

        /***/
      },

    /***/ './src/local-storage.ts':
      /*!******************************!*\
  !*** ./src/local-storage.ts ***!
  \******************************/
      /***/ (
        __unused_webpack_module,
        __webpack_exports__,
        __webpack_require__
      ) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ NAMESPACE: () => /* binding */ NAMESPACE,
          /* harmony export */ storage: () => /* binding */ storage,
          /* harmony export */
        });
        var localStorage = window.localStorage || {};
        var NAMESPACE = ''; // /\/headless\.html\b/.test(location.pathname) ? 'headless_' : '';

        var storage = Object.create({
          getSetupVersion: function getSetupVersion(version) {
            try {
              return localStorage.getItem(NAMESPACE + 'setup_v' + version);
            } catch (error) {
              return null;
            }
          },
          defineProperty: function defineProperty(property, serialize) {
            var nsProperty = NAMESPACE + property;
            Object.defineProperty(this, property, {
              get: function get() {
                try {
                  if (serialize) {
                    return JSON.parse(
                      localStorage.getItem(nsProperty) || 'null'
                    );
                  }
                  return localStorage.getItem(nsProperty);
                } catch (error) {
                  return null;
                }
              },
              set: function set(value) {
                try {
                  if (serialize) {
                    localStorage.setItem(nsProperty, JSON.stringify(value));
                  } else {
                    localStorage.setItem(nsProperty, value);
                  }
                } catch (error) {
                  /* noop */
                }
              },
            });
          },
        });
        storage.defineProperty('hlsjsEventsConfig');
        storage.defineProperty('eventsFilter');
        storage.defineProperty('setupVersion', true);
        Object.defineProperty(storage, 'setupConfig', {
          get: function get() {
            var version = storage.setupVersion;
            if (!version) {
              return null;
            }
            return storage.getSetupVersion(version);
          },
          set: function set(value) {
            var version = storage.setupVersion || 0;
            if (isNaN(version)) {
              version = 1;
            }
            try {
              localStorage.setItem(NAMESPACE + 'setup_v' + version, value);
              localStorage.setupVersion = version;
              localStorage.removeItem(NAMESPACE + 'setup_v' + (version - 20));
              if (storage.setupUpdated) {
                storage.setupUpdated(version);
              }
            } catch (error) {
              console.error(error);
            }
          },
        });

        /***/
      },

    /***/ './src/stringify.ts':
      /*!**************************!*\
  !*** ./src/stringify.ts ***!
  \**************************/
      /***/ (
        __unused_webpack_module,
        __webpack_exports__,
        __webpack_require__
      ) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ stringify: () => /* binding */ stringify,
          /* harmony export */
        });
        var Uint8Array = window.Uint8Array;
        var TimeRanges = window.TimeRanges;
        function stringify(value, replacer, space) {
          try {
            return truncate(
              JSON.stringify(
                value,
                replacer || stringifyReplacer(value),
                space
              ),
              100000
            );
          } catch (error) {
            return '[' + error + ']';
          }
        }
        function truncate(str, length) {
          return (str == null ? void 0 : str.length) > length
            ? str.substr(0, length) +
                '\n... Event truncated due to length (see console for complete output)'
            : str;
        }
        function stringifyReplacer(parentValue) {
          var references = [];
          var safeResults = [];
          var complexity = 0;
          return function stringifyKeyValue(key, value) {
            if (typeof value === 'object') {
              if (
                value === null ||
                value instanceof Date ||
                value instanceof RegExp
              ) {
                return value;
              }
              if (!!Uint8Array && value instanceof Uint8Array) {
                // Stub values of Arrays with more than 1000 items
                var str = '' + value;
                str =
                  str.length > 40
                    ? str.substr(0, 40) + '...(see console)'
                    : str;
                return 'Uint8Array(' + value.length + ') [' + str + ']';
              }
              if (!!TimeRanges && value instanceof TimeRanges) {
                var ranges = [];
                for (var i = 0; i < value.length; i++) {
                  ranges[i] =
                    'start(' +
                    i +
                    ') = ' +
                    value.start(i) +
                    ' end(' +
                    i +
                    ') = ' +
                    value.end(i);
                }
                return 'TimeRanges(' + value.length + ') [' + ranges + ']';
              }
              if (value === parentValue && complexity > 0) {
                return '<parent object>';
              }
              var referenceIndex = references.indexOf(value);
              if (referenceIndex !== -1) {
                // Duplicate reference found
                var safe = safeResults[referenceIndex];
                if (safe) {
                  return safe;
                }
                try {
                  // Test for circular references
                  JSON.stringify(value);
                } catch (error) {
                  return (safeResults[referenceIndex] =
                    '<' + value + '...(see console)>');
                }
                safeResults[referenceIndex] = value;
              }
              if (complexity++ > 10000) {
                return '<complexity exceeded>';
              }
              references.push(value);
              return value;
            }
            if (typeof value === 'function') {
              return '' + value;
            }
            return value;
          };
        }

        /***/
      },

    /******/
  };
  /************************************************************************/
  /******/ // The module cache
  /******/ var __webpack_module_cache__ = {};
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/ // Check if module is in cache
    /******/ var cachedModule = __webpack_module_cache__[moduleId];
    /******/ if (cachedModule !== undefined) {
      /******/ return cachedModule.exports;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ // no module.id needed
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ __webpack_modules__[moduleId](
      module,
      module.exports,
      __webpack_require__
    );
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
  /******/
  /************************************************************************/
  /******/ /* webpack/runtime/define property getters */
  /******/ (() => {
    /******/ // define getter functions for harmony exports
    /******/ __webpack_require__.d = (exports, definition) => {
      /******/ for (var key in definition) {
        /******/ if (
          __webpack_require__.o(definition, key) &&
          !__webpack_require__.o(exports, key)
        ) {
          /******/ Object.defineProperty(exports, key, {
            enumerable: true,
            get: definition[key],
          });
          /******/
        }
        /******/
      }
      /******/
    };
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/hasOwnProperty shorthand */
  /******/ (() => {
    /******/ __webpack_require__.o = (obj, prop) =>
      Object.prototype.hasOwnProperty.call(obj, prop);
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/make namespace object */
  /******/ (() => {
    /******/ // define __esModule on exports
    /******/ __webpack_require__.r = (exports) => {
      /******/ if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
        /******/ Object.defineProperty(exports, Symbol.toStringTag, {
          value: 'Module',
        });
        /******/
      }
      /******/ Object.defineProperty(exports, '__esModule', { value: true });
      /******/
    };
    /******/
  })();
  /******/
  /************************************************************************/
  var __webpack_exports__ = {};
  // This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
  (() => {
    /*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
    __webpack_require__.r(__webpack_exports__);
    /* harmony import */ var _config_default__WEBPACK_IMPORTED_MODULE_0__ =
      __webpack_require__(/*! ./config-default */ './src/config-default.ts');
    /* harmony import */ var _config_editor__WEBPACK_IMPORTED_MODULE_1__ =
      __webpack_require__(/*! ./config-editor */ './src/config-editor.ts');
    /* harmony import */ var _events_providers__WEBPACK_IMPORTED_MODULE_2__ =
      __webpack_require__(
        /*! ./events-providers */ './src/events-providers.ts'
      );
    /* harmony import */ var _events_video__WEBPACK_IMPORTED_MODULE_3__ =
      __webpack_require__(/*! ./events-video */ './src/events-video.ts');
    /* harmony import */ var _local_storage__WEBPACK_IMPORTED_MODULE_4__ =
      __webpack_require__(/*! ./local-storage */ './src/local-storage.ts');
    /* harmony import */ var _stringify__WEBPACK_IMPORTED_MODULE_5__ =
      __webpack_require__(/*! ./stringify */ './src/stringify.ts');

    var ace = self.ace;
    var history = self.history || {};
    var searchOptions = new self.URL(location.href).searchParams;
    var eventLogGroups = {};
    var eventFlow = 'down';
    var sequenceCount = 0;
    var filterEventElement = function filterEventElement(element) {};
    function getAndSaveConfig(editor) {
      return (0, _config_editor__WEBPACK_IMPORTED_MODULE_1__.getConfig)(
        editor
      ).then(function (config) {
        var configToSave = editor
          .getValue()
          .replace(/("|')\.\.\/\.\.\/\.\.\/bin-/g, '$1../bin-');
        if (
          configToSave &&
          configToSave !==
            _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage
              .hlsjsEventsConfig
        ) {
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.hlsjsEventsConfig =
            configToSave;
        }
        return config;
      });
    }
    function getEventGroup(eventName) {
      var Events = self.Hls.Events;
      //   for (const key in events) {
      //     if (events[key].indexOf(eventName) > -1) {
      //       return key;
      //     }
      //   }
      if (
        _events_providers__WEBPACK_IMPORTED_MODULE_2__.hlsJsEvents.indexOf(
          eventName
        ) > -1
      ) {
        if (
          [
            Events.INTERSTITIAL_STARTED,
            Events.INTERSTITIAL_ASSET_STARTED,
            Events.INTERSTITIAL_ASSET_ENDED,
            Events.INTERSTITIAL_ENDED,
          ].indexOf(eventName) > -1
        ) {
          return 'adBreak'; // 'hlsjs'
        }
        if ([Events.INTERSTITIALS_PRIMARY_RESUMED].indexOf(eventName) > -1) {
          return 'playback'; // 'hlsjs'
        }
        if (
          [
            Events.MEDIA_ATTACHING,
            Events.MEDIA_ATTACHED,
            Events.MEDIA_DETACHING,
            Events.MEDIA_DETACHED,
            Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
            Events.BACK_BUFFER_REACHED,
            Events.FRAG_LOADING,
            Events.FRAG_LOADED,
            Events.FRAG_PARSING_INIT_SEGMENT,
            // Events.FRAG_PARSING_METADATA,
            Events.FRAG_PARSING_USERDATA,
            Events.LEVEL_PTS_UPDATED,
            Events.FRAG_PARSED,
            Events.BUFFER_APPENDING,
            Events.BUFFER_APPENDED,
            Events.FRAG_BUFFERED,
            Events.AUDIO_TRACK_SWITCHED,
            Events.BUFFER_CODECS,
          ].indexOf(eventName) > -1
        ) {
          return 'media'; // 'hlsjs'
        }
        return 'provider'; // 'hlsjs'
      }
      return 'unknown';
    }
    function getPlaybackMode(eventGroup, currentMode) {
      if (eventGroup === 'playback' || eventGroup === 'media') {
        return 'player';
      }
      if (eventGroup === 'adBreak') {
        return 'ads';
      }
      return currentMode;
    }
    function padStart(str, content, length) {
      if (str.length >= length) {
        return content;
      }
      return new Array(1 + length - str.length).join(' ') + content;
    }
    function createEventSequenceElement(inMode) {
      var element = document.createElement('div');
      element.classList.add('sequence', 'mode-' + inMode);
      element.setAttribute('data-sequence', '' + sequenceCount++);
      return element;
    }
    function appendSequenceElement(container, element) {
      var firstSequenceElement = container.querySelector('.sequence');
      if (eventFlow === 'down' || !firstSequenceElement) {
        container.appendChild(element);
      } else {
        container.insertBefore(element, firstSequenceElement);
      }
    }
    function appendData(div, inEvent, group, data) {
      if (!data) {
        return;
      }
      if (
        // group === 'adRequest' ||
        // group === 'adBreak' ||
        // inEvent === 'time' ||
        // inEvent === 'meta' ||
        // inEvent === 'metadataCueParsed' ||
        group === 'provider' //||
        // inEvent === 'hlsBufferAppending' ||
        // inEvent === 'hlsBufferAppended'
      ) {
        var pre = document.createElement('pre');
        pre.classList.add('group-quickPeek');
        var quickPeekProps = [
          'currentTime',
          'metadataType',
          'adBreakId',
          'adPlayId',
          'frag.sn',
        ].reduce(function (obj, prop) {
          if (prop === 'frag.sn' && ('frag' in data || 'parent' in data)) {
            // Uncomment to see if event is from "main" playlist or alt "audio" track
            // obj.parent = data.parent;
            if ('frag' in data) {
              obj.sn = data.frag.sn;
            }
            obj.type = data.type;
          } else if (prop in data) {
            obj[prop] = data[prop];
          }
          return obj;
        }, {});
        if (Object.keys(quickPeekProps).length) {
          pre.textContent = padStart(
            inEvent,
            JSON.stringify(quickPeekProps, null, 0),
            20
          );
          div.appendChild(pre);
        }
      }
    }
    function appendEvent(container, inEvent, inEventGroup, mode, data) {
      var div = document.createElement('div');
      div.classList.add('group-' + inEventGroup, 'event-' + inEvent, 'pre');
      div.textContent = textContentGrouped(inEvent);
      appendData(div, inEvent, inEventGroup, data);
      div.setAttribute(
        'title',
        mode + ' ' + inEventGroup + ' event "' + inEvent + '"'
      );
      div.setAttribute('tabindex', '0');
      var clicked = function clicked(e) {
        if (e && 'keyCode' in e && e.keyCode !== 13) {
          return;
        }
        console.log(inEvent, data);
        if (!data) {
          return;
        }
        var expanded = (div.expanded = !div.expanded);
        div.textContent = expanded
          ? textContentExpanded(inEvent, [data])
          : textContentGrouped(inEvent);
        if (e) {
          e.preventDefault();
        }
        return [data];
      };
      div.onclick = div.onkeyup = clicked;
      filterEventElement(div);
      container.appendChild(div);
      if (inEvent === 'javascriptError') {
        div.setAttribute('title', div.textContent);
        clicked();
      }
      return div;
    }
    function incrementEvent(group, inEvent, inEventGroup, div, data) {
      group[inEvent]++;
      div.textContent = textContentGrouped(inEvent, group);
      appendData(div, div.textContent, inEventGroup, data);
      var logPreviousEvents = div.onclick;
      var clicked = function clicked(e) {
        if (e && 'keyCode' in e && e.keyCode !== 13) {
          return;
        }
        console.log(inEvent, data);
        if (!data || logPreviousEvents === null) {
          return;
        }
        var allData = logPreviousEvents();
        if (!allData) {
          return;
        }
        allData.push(data);
        div.textContent = div.expanded
          ? textContentExpanded(inEvent, allData)
          : textContentGrouped(inEvent, group);
        if (e) {
          e.preventDefault();
        }
        return allData;
      };
      div.onclick = div.onkeyup = clicked;
      if (inEvent === 'javascriptError' && !div.expanded) {
        clicked();
      }
    }
    function textContentGrouped(inEvent, group) {
      if (group) {
        return inEvent + ' (' + group[inEvent] + ')';
      }
      return inEvent;
    }
    function textContentExpanded(inEvent, allData) {
      return (
        inEvent +
        ' (' +
        allData
          .map(function (item, i) {
            return (
              (allData.length > 1 ? '[' + i + '] = ' : '') +
              (0, _stringify__WEBPACK_IMPORTED_MODULE_5__.stringify)(
                item,
                null,
                4
              )
            );
          })
          .join('\n') +
        ')'
      );
    }
    function getPageEventsLoggerListeners() {
      var logContainer = document.querySelector('#event-log');
      var inEventGroup = '';
      var inMode = 'player';
      var inEvent = '';
      var lastEvent = '';
      var lastMode = 'player';
      var lastGroup;
      var genericEventHandler = function genericEventHandler(
        e,
        type,
        eventGroup
      ) {
        inEventGroup = eventGroup;
        inMode = getPlaybackMode(eventGroup, lastMode);
        inEvent = type;
        performance.mark(inMode);
        performance.mark(inEvent);
        if (lastEvent && lastEvent !== inEvent) {
          performance.measure(lastEvent, lastEvent, inEvent);
        }
        var group = eventLogGroups[inMode];
        if (!group || group !== lastGroup) {
          var beforeReadyElement = createEventSequenceElement(inMode);
          appendSequenceElement(logContainer, beforeReadyElement);
          group = eventLogGroups[inMode] = {
            mode: inMode,
            eventGroup: inEventGroup,
            event: inEvent,
            container: logContainer,
            eventElement: beforeReadyElement,
          };
          lastGroup = lastGroup || group;
        }
        if (
          inEventGroup === 'globalUi' ||
          inEventGroup === 'related' ||
          inEventGroup === 'ping'
        ) {
          if (group.lastUiEvent === inEvent && group.preUi) {
            incrementEvent(group, inEvent, inEventGroup, group.preUi, e);
          } else {
            group[inEvent] = 1;
            group.lastUiEvent = inEvent;
            group.preUi = appendEvent(
              group.eventElement,
              inEvent,
              inEventGroup,
              inMode,
              e
            );
          }
          return;
        }
        if (inEventGroup === 'video') {
          if (/>(?:timeupdate|seeking)$/.test(inEvent)) {
            if (group.lastVideoEvent === inEvent && group.preVideo) {
              incrementEvent(group, inEvent, inEventGroup, group.preVideo, e);
            } else {
              var eventElement = createEventSequenceElement(inMode);
              group[inEvent] = 1;
              group.eventElement = eventElement;
              group.lastVideoEvent = inEvent;
              group.preVideo = appendEvent(
                group.eventElement,
                inEvent,
                inEventGroup,
                inMode,
                e
              );
              appendSequenceElement(group.container, eventElement);
            }
            return;
          }
          group.lastVideoEvent = null;
        }
        if (
          lastEvent === inEvent &&
          !/^(?:meta|hlsBufferAppend)/.test(inEvent) &&
          group.pre
        ) {
          incrementEvent(group, inEvent, inEventGroup, group.pre, e);
        } else {
          var _eventElement = createEventSequenceElement(inMode);
          group[inEvent] = 1;
          group.eventElement = _eventElement;
          group.lastEventGroup = inEventGroup;
          group.pre = appendEvent(
            _eventElement,
            inEvent,
            inEventGroup,
            inMode,
            e
          );
          appendSequenceElement(group.container, _eventElement);
        }
        lastEvent = inEvent;
        lastMode = inMode;
        lastGroup = group;
        group.lastUiEvent = null;
      };
      var firstEventHander = function firstEventHander(type, e) {
        genericEventHandler(e, type, getEventGroup(type));
      };
      function errorToJSONPolyfill() {
        if (!('toJSON' in Error.prototype)) {
          Object.defineProperty(Error.prototype, 'toJSON', {
            value: function value() {
              return {
                message: this.message,
              };
            },
            configurable: true,
            writable: true,
          });
        }
      }
      self.addEventListener('error', function (event) {
        errorToJSONPolyfill();
        firstEventHander('javascriptError', {
          type: 'javascriptError',
          error: event.error,
          event: event,
        });
      });
      self.addEventListener('unhandledrejection', function (event) {
        errorToJSONPolyfill();
        firstEventHander('unhandledPromiseRejection', {
          type: 'unhandledPromiseRejection',
          error: event.error || event.reason,
          event: event,
        });
      });
      setupButton(document.querySelector('#clear-events'), function () {
        if (logContainer === null) {
          console.assert(logContainer !== null, 'logContainer is not null');
          return;
        }
        Array.prototype.slice
          .call(logContainer.querySelectorAll('div'))
          .forEach(function (element) {
            while (element.firstChild) {
              element.removeChild(element.firstChild);
            }
          });
      });
      setupButton(document.querySelector('#event-flow-direction'), function () {
        var _document$querySelect;
        eventFlow = eventFlow === 'down' ? 'up' : 'down';
        var dir = eventFlow === 'down' ? -1 : 1;
        var elements = document.querySelectorAll('.sequence');
        var sorted = [].slice.call(elements).sort(function (a, b) {
          return (
            dir *
            (parseInt(b.getAttribute('data-sequence')) -
              parseInt(a.getAttribute('data-sequence')))
          );
        });
        var temp = document.createDocumentFragment();
        sorted.forEach(function (el) {
          return temp.appendChild(el);
        });
        (_document$querySelect = document.querySelector('#event-log')) ==
          null || _document$querySelect.appendChild(temp);
        this.innerHTML = {
          down: '&#x23EC;',
          up: '&#x23EB;',
        }[eventFlow];
      });
      return _events_providers__WEBPACK_IMPORTED_MODULE_2__.hlsJsEvents.reduce(
        function (val, key) {
          val[key] = firstEventHander;
          return val;
        },
        Object.create({
          genericEventHandler: genericEventHandler,
        })
      );
    }
    function runSetup(editor) {
      (0, _config_editor__WEBPACK_IMPORTED_MODULE_1__.getConfig)(editor)
        .then(resize)
        .then(function (config) {
          // Version new setup configs in storage and setup
          var setupConfig = editor.getValue();
          if (
            _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupConfig !==
            setupConfig
          ) {
            _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupConfig =
              setupConfig;
          }
          setup(config);
        })
        ['catch'](function (error) {
          console.warn(
            'Error parsing config. Falling back to default setup.',
            error
          );
          if (self.hls) {
            self.hls.destroy();
          }
        });
    }
    function resize(config) {
      var width = config.width || 640;
      document.body.style.minWidth = /%$/.test(width) ? '' : width + 'px';
      return config;
    }
    function setup(config) {
      var eventLoggerHandlers = getPageEventsLoggerListeners();
      var genericEventHandler = eventLoggerHandlers.genericEventHandler;
      (0, _events_video__WEBPACK_IMPORTED_MODULE_3__.resetVideoElements)();
      genericEventHandler(
        {
          userAgent: self.navigator.userAgent,
        },
        'info:environment',
        getEventGroup('info:environment')
      );
      var hls = new self.Hls(config);
      self.hls = hls;
      _events_providers__WEBPACK_IMPORTED_MODULE_2__.hlsJsEvents.forEach(
        function (eventName) {
          hls.on(eventName, function (type, e) {
            var handler = eventLoggerHandlers[type];
            if (!handler) {
              console.error(
                'Event "' + type + '" not defined in events list.',
                e
              );
              // Run 'firstEventHander' on this event to add it to the log
              var firstEventHander = eventLoggerHandlers.hlsError;
              firstEventHander(type, e);
            } else {
              handler.call(hls, type, e);
            }
          });
        }
      );
      hls.on(
        self.Hls.Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
        function (type, data) {
          var childPlayer = data.player;
          if (childPlayer) {
            var callback = function callback(type, e) {
              genericEventHandler(
                e,
                childPlayer.assetId + '-' + type,
                'adBreak'
              );
            };
            _events_providers__WEBPACK_IMPORTED_MODULE_2__.hlsJsEvents.forEach(
              function (eventName) {
                childPlayer.on(eventName, callback);
              }
            );
            childPlayer.on(self.Hls.Events.DESTROYING, function () {
              _events_providers__WEBPACK_IMPORTED_MODULE_2__.hlsJsEvents.forEach(
                function (eventName) {
                  childPlayer.off(eventName, callback);
                }
              );
            });
          }
        }
      );
      document.querySelector('.group-provider').textContent = 'hlsjs';
      var container = document.getElementById('player');
      var video = document.createElement('video');
      video.controls = true;
      video.style.width = '100%';
      container.appendChild(video);
      (0,
      _events_video__WEBPACK_IMPORTED_MODULE_3__.attachListenersToVideoElements)(
        genericEventHandler
      );
      hls.attachMedia(video);
      hls.loadSource(
        searchOptions.get('src') ||
          '//localhost/adaptive/meridian/index-interstitials.m3u8'
      );
    }
    function getConfigForEditor(configJs) {
      return (
        configJs ||
        JSON.stringify(
          _config_default__WEBPACK_IMPORTED_MODULE_0__.defaultConfig,
          null,
          4
        )
      ).replace(/("|')(\.\.\/)+bin-/g, '$1../../../bin-');
    }
    function setupEditor(savedConfig) {
      var configInput = document.querySelector('#player-config');
      configInput.value = getConfigForEditor(savedConfig);
      var editor = ace.edit(configInput);
      editor.getSession().setMode('ace/mode/javascript');
      editor.setTheme('ace/theme/twilight');
      var options = {
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: false,
        maxLines: 1,
      };
      editor.setOptions(options);
      editor.expand = function () {
        console.assert(
          !!editor.getFontSize,
          'getFontSize does not exist on Editor'
        );
        var lineHeight =
          (editor.getFontSize == null ? void 0 : editor.getFontSize()) + 5;
        var availableHeight =
          (document.documentElement.clientHeight, self.innerHeight || 0) - 100;
        options.maxLines = Math.min(
          Math.max(5, Math.floor(availableHeight / lineHeight)),
          150
        );
        editor.setOptions(options);
        editor.focus();
      };
      editor.contract = function () {
        options.maxLines = 1;
        editor.setOptions(options);
      };
      var focusTimeout;
      var saveTimeout;
      function changeCallback() {
        self.clearTimeout(saveTimeout);
        saveTimeout = self.setTimeout(function () {
          getAndSaveConfig(editor)
            .then(function () {
              // If the change is valid clear any config params in the url and save
              if (history.pushState && searchOptions.get('config')) {
                history.pushState(
                  editor.getValue(),
                  '',
                  '' + location.origin + location.pathname
                );
              }
            })
            ['catch'](function () {
              /* noop */
            });
        }, 500);
      }
      editor.on('focus', function () {
        // Save the config when it's changed (in focus)
        editor.off('change', changeCallback);
        editor.on('change', changeCallback);
        self.clearTimeout(focusTimeout);
        focusTimeout = self.setTimeout(editor.expand);
      });
      editor.on('blur', function () {
        editor.off('change', changeCallback);
        self.clearTimeout(focusTimeout);
        if (editor.pinned) {
          return;
        }
        focusTimeout = self.setTimeout(editor.contract, 250);
      });
      editor.commands.addCommand({
        name: 'Run',
        exec: runSetup,
        bindKey: {
          mac: 'cmd-enter',
          win: 'ctrl-enter',
        },
      });
      // When navigating, setup the player according to the current location.search params or local storage
      self.onpopstate = function () {
        // getPlayerConfig(storage.setupConfig || storage.hlsjsEventsConfig).then(
        //   (configText) => {
        //     editor.setValue(configText);
        //     self.clearTimeout(saveTimeout);
        //     runSetup(editor);
        //   },
        // );
      };
      return editor;
    }
    function setupControls(editor) {
      var controls = document.querySelector('#config-controls');
      controls.onclick = function (event) {
        if (event.target === controls) {
          editor.expand();
        }
      };
      setupSetup(document.querySelector('#setup'), editor);
      setupConfigNav(
        document.querySelector('#setup-prev'),
        document.querySelector('#setup-next'),
        editor
      );
      setupPin(document.querySelector('#pin-config'), editor);
      setupCopy(document.querySelector('#copy-config'), editor);
      setupPermalink(document.querySelector('#permalink-config'), editor);
      setupDownload(document.querySelector('#download-config'), editor);
    }
    function setupSetup(button, editor) {
      button.onclick = function () {
        runSetup(editor);
      };
    }
    function setupConfigNav(buttonPrev, buttonNext, editor) {
      _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupUpdated =
        function (version) {
          buttonPrev.disabled =
            !version ||
            version === 1 ||
            !_local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.getSetupVersion(
              version - 1
            );
          buttonNext.disabled =
            !_local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.getSetupVersion(
              (version || 0) + 1
            );
        };
      var changeSetupVersion = function changeSetupVersion(version) {
        var setupConfig =
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.getSetupVersion(
            version
          );
        if (setupConfig) {
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupVersion =
            version;
        }
        if (_local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupUpdated) {
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupUpdated(
            version
          );
        }
        editor.setValue(setupConfig);
        editor.clearSelection();
        // getConfig(editor).then(setup);
      };
      buttonPrev.onclick = function () {
        changeSetupVersion(
          (_local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupVersion ||
            0) - 1
        );
      };
      buttonNext.onclick = function () {
        changeSetupVersion(
          (_local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupVersion ||
            0) + 1
        );
      };
      _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupUpdated(
        _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.setupVersion
      );
    }
    function setupPin(button, editor) {
      _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.defineProperty(
        'pinConfig',
        true
      );
      var updatePin = function updatePin() {
        button.classList.toggle('disabled', !editor.pinned);
        if (editor.pinned) {
          editor.expand();
        } else {
          editor.contract();
        }
      };
      button.onclick = function () {
        editor.pinned =
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.pinConfig =
            !editor.pinned;
        updatePin();
      };
      editor.pinned =
        !!_local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.pinConfig;
      updatePin();
    }
    function setupDownload(button, editor) {
      button.onclick = function () {
        var config = editor.getValue();
        var nameMatch = config.match(/(\w+)\s*=/);
        button.setAttribute(
          'download',
          (nameMatch ? nameMatch[1] : 'config') + '.js'
        );
        button.setAttribute(
          'href',
          'data:application/xml;charset=utf-8,' +
            (0, _config_editor__WEBPACK_IMPORTED_MODULE_1__.iife)(config)
        );
      };
    }
    function setupCopy(button, editor) {
      button.onclick = function () {
        // copy to clipboard
        var textarea = document.createElement('textarea');
        textarea.value = editor.getValue();
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      };
    }
    function setupPermalink(button, editor) {
      button.onclick = function () {
        var base64Config = encodeURIComponent(
          'data:text/plain;base64,' + btoa(editor.getValue())
        );
        history.pushState(
          null,
          '',
          '' + location.origin + location.pathname + '?config=' + base64Config
        );
      };
    }
    function setupButton(button, callback) {
      button.onclick = callback;
    }
    function updateToggle(element, groupClass, enabled) {
      element.classList.toggle('disabled', !enabled);
      document
        .querySelector('#event-log')
        .classList.toggle(groupClass + '-disabled', !enabled);
    }
    function setupLogFilters() {
      Array.prototype.slice
        .call(document.querySelectorAll('#group-toggles .toggle'))
        .forEach(function (element) {
          var groupClass = element.className.replace(
            /^.*\b(group-\w+)\b.*$/,
            '$1'
          );
          var toggleName = groupClass + '-toggle';
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.defineProperty(
            toggleName
          );
          var enabled =
            _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage[toggleName];
          enabled =
            enabled === null
              ? !element.classList.contains('disabled')
              : JSON.parse(enabled);
          updateToggle(element, groupClass, enabled);
          element.onclick = function () {
            enabled = _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage[
              toggleName
            ] = !enabled;
            updateToggle(element, groupClass, enabled);
          };
        });
      var filterTimeout = -1;
      var inputFilterField = document.querySelector('#input-filter');
      var updateFilter = function updateFilter(derp) {
        var filter = (function (textInput) {
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.eventsFilter =
            textInput;
          inputFilterField.setCustomValidity('');
          var regexParts = /^\/(.+)\/(g?i?m?s?u?y?)$/.exec(textInput);
          if (regexParts) {
            try {
              var regex = new RegExp(regexParts[1], regexParts[2]);
              return function (input) {
                return input !== null && regex.test(input);
              };
            } catch (error) {
              /* Invalid Regular Expression */
              inputFilterField.setCustomValidity('Invalid Regular Expression');
              return function () {
                return true;
              };
            }
          }
          return function (input) {
            return (
              !textInput ||
              input.toLowerCase().indexOf(textInput.toLowerCase()) > -1
            );
          };
        })(inputFilterField.value);
        filterEventElement = function filterEventElement(element) {
          element.classList.toggle(
            'filter-not-matched',
            !filter(element.textContent)
          );
        };
        Array.prototype.slice
          .call(document.querySelectorAll('.sequence > .pre'))
          .forEach(filterEventElement);
      };
      if (_local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.eventsFilter) {
        inputFilterField.value =
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.eventsFilter;
        updateFilter(
          _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.eventsFilter
        );
      }
      inputFilterField.addEventListener('keyup', function () {
        self.clearTimeout(filterTimeout);
        filterTimeout = self.setTimeout(updateFilter);
      });
    }

    // const editorPromise = getPlayerConfig(storage.hlsjsEventsConfig)
    //   .then((configText) => {
    //     return setupEditor(configText);
    //   })
    //   .catch(function (error) {
    //     console.error('Error loading js config', error);
    //     return setupEditor(storage.hlsjsEventsConfig);
    //   });

    var editorPromise = Promise.resolve().then(function () {
      return setupEditor(
        _local_storage__WEBPACK_IMPORTED_MODULE_4__.storage.hlsjsEventsConfig
      );
    });
    editorPromise.then(function (editor) {
      runSetup(editor);
      setupControls(editor);
    });
    setupLogFilters();
  })();

  /******/
})();
//# sourceMappingURL=index.js.map
