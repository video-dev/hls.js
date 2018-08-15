(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["HlsDemo"] = factory();
	else
		root["HlsDemo"] = factory();
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
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
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
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony import */ var __WEBPACK_IMPORTED_MODULE_0__demo_utils__ = __webpack_require__(1);
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };



var testStreams = __webpack_require__(2);
var defaultTestStreamUrl = testStreams['bbb'].url;
var sourceURL = decodeURIComponent(getURLParam('src', defaultTestStreamUrl));

var demoConfig = getURLParam('demoConfig', null);
if (demoConfig) {
  demoConfig = JSON.parse(atob(demoConfig));
} else {
  demoConfig = {};
}

var enableStreaming = getDemoConfigPropOrDefault('enableStreaming', true);
var autoRecoverError = getDemoConfigPropOrDefault('autoRecoverError', true);
var enableWorker = getDemoConfigPropOrDefault('enableWorker', true);
var levelCapping = getDemoConfigPropOrDefault('levelCapping', -1);
var limitMetrics = getDemoConfigPropOrDefault('limitMetrics', -1);
var defaultAudioCodec = getDemoConfigPropOrDefault('defaultAudioCodec', undefined);
var widevineLicenseUrl = getDemoConfigPropOrDefault('widevineLicenseURL', undefined);
var dumpfMP4 = getDemoConfigPropOrDefault('dumpfMP4', false);

var bufferingIdx = -1;
var selectedTestStream = null;
var video = $('#video')[0];
var startTime = Date.now();

var lastSeekingIdx = void 0;
var lastStartPosition = void 0;
var lastDuration = void 0;
var lastAudioTrackSwitchingIdx = void 0;
var hls = void 0;
var url = void 0;
var events = void 0;
var stats = void 0;
var tracks = void 0;
var fmp4Data = void 0;

$(document).ready(function () {
  Object.keys(testStreams).forEach(function (key) {
    var stream = testStreams[key];
    var option = new Option(stream.description, key);
    $('#streamSelect').append(option);
  });

  $('#streamSelect').change(function () {
    selectedTestStream = testStreams[$('#streamSelect').val()];
    var streamUrl = selectedTestStream.url;
    $('#streamURL').val(streamUrl);
    loadSelectedStream();
  });

  $('#streamURL').change(function () {
    selectedTestStream = null;
    loadSelectedStream();
  });

  $('#videoSize').change(function () {
    $('#video').width($('#videoSize').val());
    $('#bufferedCanvas').width($('#videoSize').val());
  });

  $('#enableStreaming').click(function () {
    enableStreaming = this.checked;
    loadSelectedStream();
  });

  $('#autoRecoverError').click(function () {
    autoRecoverError = this.checked;
    onDemoConfigChanged();
  });

  $('#enableWorker').click(function () {
    enableWorker = this.checked;
    onDemoConfigChanged();
  });

  $('#dumpfMP4').click(function () {
    dumpfMP4 = this.checked;
    onDemoConfigChanged();
  });

  $('#limitMetrics').change(function () {
    limitMetrics = this.value;
    onDemoConfigChanged();
  });

  $('#levelCapping').change(function () {
    levelCapping = this.value;
    onDemoConfigChanged();
  });

  $('#defaultAudioCodec').change(function () {
    defaultAudioCodec = this.value;
    onDemoConfigChanged();
  });

  $('#limitMetrics').val(limitMetrics);
  $('#enableStreaming').prop('checked', enableStreaming);
  $('#autoRecoverError').prop('checked', autoRecoverError);
  $('#enableWorker').prop('checked', enableWorker);
  $('#dumpfMP4').prop('checked', dumpfMP4);
  $('#levelCapping').val(levelCapping);
  $('#defaultAudioCodec').val(defaultAudioCodec || 'undefined');

  $('h2').append('&nbsp;<a target=_blank href=https://github.com/video-dev/hls.js/releases/tag/v' + Hls.version + '>v' + Hls.version + '</a>');
  $('#currentVersion').html('Hls version:' + Hls.version);

  $('#streamURL').val(sourceURL);

  video.volume = 0.05;

  hideAllTabs();

  $('#metricsButtonWindow').toggle(windowSliding);
  $('#metricsButtonFixed').toggle(!windowSliding);

  loadSelectedStream();
});

function setupGlobals() {
  window.events = events = {
    url: url,
    t0: performance.now(),
    load: [],
    buffer: [],
    video: [],
    level: [],
    bitrate: []
  };

  // actual values, only on window
  window.recoverDecodingErrorDate = null;
  window.recoverSwapAudioCodecDate = null;

  window.fmp4Data = fmp4Data = {
    'audio': [],
    'video': []
  };

  window.onClickBufferedRange = onClickBufferedRange;

  window.updateLevelInfo = updateLevelInfo;
  window.onDemoConfigChanged = onDemoConfigChanged;
  window.createfMP4 = createfMP4;
  window.goToMetricsPermaLink = goToMetricsPermaLink;
  window.toggleTab = toggleTab;
  window.onDemoConfigChanged = onDemoConfigChanged;
}

function trimArray(target, limit) {
  if (limit < 0) {
    return;
  }

  while (target.length > limit) {
    target.shift();
  }
}

function trimEventHistory() {
  var x = limitMetrics;

  if (x < 0) {
    return;
  }

  trimArray(events.load, x);
  trimArray(events.buffer, x);
  trimArray(events.video, x);
  trimArray(events.level, x);
  trimArray(events.bitrate, x);
}

function loadSelectedStream() {

  if (!Hls.isSupported()) {
    handleUnsupported();
    return;
  }

  url = $('#streamURL').val();

  setupGlobals();
  hideCanvas();

  if (hls) {
    hls.destroy();
    if (hls.bufferTimer) {
      clearInterval(hls.bufferTimer);
      hls.bufferTimer = undefined;
    }
    hls = null;
  }

  if (!enableStreaming) {
    logStatus('Streaming disabled');
    return;
  }

  logStatus('Loading ' + url);

  if (widevineLicenseUrl) {
    widevineLicenseUrl = unescape(widevineLicenseUrl);
  }

  var hlsConfig = {
    debug: true,
    enableWorker: enableWorker,
    defaultAudioCodec: defaultAudioCodec,
    widevineLicenseUrl: widevineLicenseUrl
  };

  if (selectedTestStream && selectedTestStream.config) {
    _extends(hlsConfig, selectedTestStream.config);
  }

  if (hlsConfig.widevineLicenseUrl) {
    $('#widevineLicenseUrl').val(hlsConfig.widevineLicenseUrl);
  }

  widevineLicenseUrl = hlsConfig.widevineLicenseUrl = $('#widevineLicenseUrl').val();

  if (hlsConfig.widevineLicenseUrl) {
    hlsConfig.emeEnabled = true;
  }

  onDemoConfigChanged();
  console.log('Using Hls.js config:', hlsConfig);

  window.hls = hls = new Hls(hlsConfig);

  logStatus('Loading manifest and attaching video element...');

  hls.loadSource(url);
  hls.autoLevelCapping = levelCapping;
  hls.attachMedia(video);

  hls.on(Hls.Events.MEDIA_ATTACHED, function () {
    logStatus('Media element attached');
    bufferingIdx = -1;
    events.video.push({
      time: performance.now() - events.t0,
      type: 'Media attached'
    });
    trimEventHistory();
  });

  hls.on(Hls.Events.MEDIA_DETACHED, function () {
    logStatus('Media element detached');
    bufferingIdx = -1;
    tracks = [];
    events.video.push({
      time: performance.now() - events.t0,
      type: 'Media detached'
    });
    trimEventHistory();
  });

  hls.on(Hls.Events.FRAG_PARSING_INIT_SEGMENT, function (event, data) {
    showCanvas();
    var event = {
      time: performance.now() - events.t0,
      type: data.id + ' init segment'
    };
    events.video.push(event);
    trimEventHistory();
  });

  hls.on(Hls.Events.FRAG_PARSING_METADATA, function (event, data) {
    //console.log("Id3 samples ", data.samples);
  });

  hls.on(Hls.Events.LEVEL_SWITCHING, function (event, data) {
    events.level.push({
      time: performance.now() - events.t0,
      id: data.level,
      bitrate: Math.round(hls.levels[data.level].bitrate / 1000)
    });
    trimEventHistory();
    updateLevelInfo();
  });

  hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
    var event = {
      type: 'manifest',
      name: '',
      start: 0,
      end: data.levels.length,
      time: data.stats.trequest - events.t0,
      latency: data.stats.tfirst - data.stats.trequest,
      load: data.stats.tload - data.stats.tfirst,
      duration: data.stats.tload - data.stats.tfirst
    };
    events.load.push(event);
    trimEventHistory();
    refreshCanvas();
  });

  hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
    logStatus('No of quality levels found: ' + hls.levels.length);
    logStatus('Manifest successfully loaded');
    stats = {
      levelNb: data.levels.length,
      levelParsed: 0
    };
    trimEventHistory();
    updateLevelInfo();
  });

  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function (event, data) {
    logStatus('No of audio tracks found: ' + data.audioTracks.length);
    updateAudioTrackInfo();
  });

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, function (event, data) {
    logStatus('Audio track switching...');
    updateAudioTrackInfo();
    var event = {
      time: performance.now() - events.t0,
      type: 'audio switching',
      name: '@' + data.id
    };
    events.video.push(event);
    trimEventHistory();
    lastAudioTrackSwitchingIdx = events.video.length - 1;
  });

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, function (event, data) {
    logStatus('Audio track switched');
    updateAudioTrackInfo();
    var event = {
      time: performance.now() - events.t0,
      type: 'audio switched',
      name: '@' + data.id
    };
    if (lastAudioTrackSwitchingIdx !== undefined) {
      events.video[lastAudioTrackSwitchingIdx].duration = event.time - events.video[lastAudioTrackSwitchingIdx].time;
      lastAudioTrackSwitchingIdx = undefined;
    }
    events.video.push(event);
    trimEventHistory();
  });

  hls.on(Hls.Events.LEVEL_LOADED, function (event, data) {
    events.isLive = data.details.live;
    var event = {
      type: 'level',
      id: data.level,
      start: data.details.startSN,
      end: data.details.endSN,
      time: data.stats.trequest - events.t0,
      latency: data.stats.tfirst - data.stats.trequest,
      load: data.stats.tload - data.stats.tfirst,
      parsing: data.stats.tparsed - data.stats.tload,
      duration: data.stats.tload - data.stats.tfirst
    };
    var parsingDuration = data.stats.tparsed - data.stats.tload;
    if (stats.levelParsed) {
      this.sumLevelParsingMs += parsingDuration;
    } else {
      this.sumLevelParsingMs = parsingDuration;
    }

    stats.levelParsed++;
    stats.levelParsingUs = Math.round(1000 * this.sumLevelParsingMs / stats.levelParsed);

    //console.log('parsing level duration :' + stats.levelParsingUs + 'us,count:' + stats.levelParsed);

    events.load.push(event);
    trimEventHistory();
    refreshCanvas();
  });

  hls.on(Hls.Events.AUDIO_TRACK_LOADED, function (event, data) {
    events.isLive = data.details.live;
    var event = {
      type: 'audio track',
      id: data.id,
      start: data.details.startSN,
      end: data.details.endSN,
      time: data.stats.trequest - events.t0,
      latency: data.stats.tfirst - data.stats.trequest,
      load: data.stats.tload - data.stats.tfirst,
      parsing: data.stats.tparsed - data.stats.tload,
      duration: data.stats.tload - data.stats.tfirst
    };
    events.load.push(event);
    trimEventHistory();
    refreshCanvas();
  });

  hls.on(Hls.Events.FRAG_BUFFERED, function (event, data) {
    var event = {
      type: data.frag.type + ' fragment',
      id: data.frag.level,
      id2: data.frag.sn,
      time: data.stats.trequest - events.t0,
      latency: data.stats.tfirst - data.stats.trequest,
      load: data.stats.tload - data.stats.tfirst,
      parsing: data.stats.tparsed - data.stats.tload,
      buffer: data.stats.tbuffered - data.stats.tparsed,
      duration: data.stats.tbuffered - data.stats.tfirst,
      bw: Math.round(8 * data.stats.total / (data.stats.tbuffered - data.stats.trequest)),
      size: data.stats.total
    };
    events.load.push(event);
    events.bitrate.push({
      time: performance.now() - events.t0,
      bitrate: event.bw,
      duration: data.frag.duration,
      level: event.id
    });
    if (hls.bufferTimer === undefined) {
      events.buffer.push({
        time: 0,
        buffer: 0,
        pos: 0
      });
      hls.bufferTimer = window.setInterval(checkBuffer, 100);
    }
    trimEventHistory();
    refreshCanvas();
    updateLevelInfo();

    var latency = data.stats.tfirst - data.stats.trequest,
        parsing = data.stats.tparsed - data.stats.tload,
        process = data.stats.tbuffered - data.stats.trequest,
        bitrate = Math.round(8 * data.stats.length / (data.stats.tbuffered - data.stats.tfirst));
    if (stats.fragBuffered) {
      stats.fragMinLatency = Math.min(stats.fragMinLatency, latency);
      stats.fragMaxLatency = Math.max(stats.fragMaxLatency, latency);
      stats.fragMinProcess = Math.min(stats.fragMinProcess, process);
      stats.fragMaxProcess = Math.max(stats.fragMaxProcess, process);
      stats.fragMinKbps = Math.min(stats.fragMinKbps, bitrate);
      stats.fragMaxKbps = Math.max(stats.fragMaxKbps, bitrate);
      stats.autoLevelCappingMin = Math.min(stats.autoLevelCappingMin, hls.autoLevelCapping);
      stats.autoLevelCappingMax = Math.max(stats.autoLevelCappingMax, hls.autoLevelCapping);
      stats.fragBuffered++;
    } else {
      stats.fragMinLatency = stats.fragMaxLatency = latency;
      stats.fragMinProcess = stats.fragMaxProcess = process;
      stats.fragMinKbps = stats.fragMaxKbps = bitrate;
      stats.fragBuffered = 1;
      stats.fragBufferedBytes = 0;
      stats.autoLevelCappingMin = stats.autoLevelCappingMax = hls.autoLevelCapping;
      this.sumLatency = 0;
      this.sumKbps = 0;
      this.sumProcess = 0;
      this.sumParsing = 0;
    }
    stats.fraglastLatency = latency;
    this.sumLatency += latency;
    stats.fragAvgLatency = Math.round(this.sumLatency / stats.fragBuffered);
    stats.fragLastProcess = process;
    this.sumProcess += process;
    this.sumParsing += parsing;
    stats.fragAvgProcess = Math.round(this.sumProcess / stats.fragBuffered);
    stats.fragLastKbps = bitrate;
    this.sumKbps += bitrate;
    stats.fragAvgKbps = Math.round(this.sumKbps / stats.fragBuffered);
    stats.fragBufferedBytes += data.stats.total;
    stats.fragparsingKbps = Math.round(8 * stats.fragBufferedBytes / this.sumParsing);
    stats.fragparsingMs = Math.round(this.sumParsing);
    stats.autoLevelCappingLast = hls.autoLevelCapping;
  });

  hls.on(Hls.Events.LEVEL_SWITCHED, function (event, data) {
    var event = {
      time: performance.now() - events.t0,
      type: 'level switched',
      name: data.level
    };
    events.video.push(event);
    trimEventHistory();
    refreshCanvas();
    updateLevelInfo();
  });

  hls.on(Hls.Events.FRAG_CHANGED, function (event, data) {
    var event = {
      time: performance.now() - events.t0,
      type: 'frag changed',
      name: data.frag.sn + ' @ ' + data.frag.level
    };
    events.video.push(event);
    trimEventHistory();
    refreshCanvas();
    updateLevelInfo();
    stats.tagList = data.frag.tagList;

    var level = data.frag.level,
        autoLevel = data.frag.autoLevel;
    if (stats.levelStart === undefined) {
      stats.levelStart = level;
    }

    if (autoLevel) {
      if (stats.fragChangedAuto) {
        stats.autoLevelMin = Math.min(stats.autoLevelMin, level);
        stats.autoLevelMax = Math.max(stats.autoLevelMax, level);
        stats.fragChangedAuto++;
        if (this.levelLastAuto && level !== stats.autoLevelLast) {
          stats.autoLevelSwitch++;
        }
      } else {
        stats.autoLevelMin = stats.autoLevelMax = level;
        stats.autoLevelSwitch = 0;
        stats.fragChangedAuto = 1;
        this.sumAutoLevel = 0;
      }
      this.sumAutoLevel += level;
      stats.autoLevelAvg = Math.round(1000 * this.sumAutoLevel / stats.fragChangedAuto) / 1000;
      stats.autoLevelLast = level;
    } else {
      if (stats.fragChangedManual) {
        stats.manualLevelMin = Math.min(stats.manualLevelMin, level);
        stats.manualLevelMax = Math.max(stats.manualLevelMax, level);
        stats.fragChangedManual++;
        if (!this.levelLastAuto && level !== stats.manualLevelLast) {
          stats.manualLevelSwitch++;
        }
      } else {
        stats.manualLevelMin = stats.manualLevelMax = level;
        stats.manualLevelSwitch = 0;
        stats.fragChangedManual = 1;
      }
      stats.manualLevelLast = level;
    }
    this.levelLastAuto = autoLevel;
  });

  hls.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, function (event, data) {
    if (stats) {
      if (stats.fragLoadEmergencyAborted === undefined) {
        stats.fragLoadEmergencyAborted = 1;
      } else {
        stats.fragLoadEmergencyAborted++;
      }
    }
  });

  hls.on(Hls.Events.FRAG_DECRYPTED, function (event, data) {
    if (!stats.fragDecrypted) {
      stats.fragDecrypted = 0;
      this.totalDecryptTime = 0;
      stats.fragAvgDecryptTime = 0;
    }
    stats.fragDecrypted++;
    this.totalDecryptTime += data.stats.tdecrypt - data.stats.tstart;
    stats.fragAvgDecryptTime = this.totalDecryptTime / stats.fragDecrypted;
  });

  hls.on(Hls.Events.ERROR, function (event, data) {
    console.warn('Error event:', data);
    switch (data.details) {
      case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
        try {
          $('#errorOut').html('Cannot load <a href="' + data.context.url + '">' + url + '</a><br>HTTP response code:' + data.response.code + ' <br>' + data.response.text);
          if (data.response.code === 0) {
            $('#errorOut').append('This might be a CORS issue, consider installing <a href="https://chrome.google.com/webstore/detail/allow-control-allow-origi/nlfbmbojpeacfghkpbjhddihlkkiljbi">Allow-Control-Allow-Origin</a> Chrome Extension');
          }
        } catch (err) {
          $('#errorOut').html('Cannot load <a href="' + data.context.url + '">' + url + '</a><br>Response body: ' + data.response.text);
        }
        break;
      case Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
        logError('Timeout while loading manifest');
        break;
      case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
        logError('Error while parsing manifest:' + data.reason);
        break;
      case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
        logError('Error while loading level playlist');
        break;
      case Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT:
        logError('Timeout while loading level playlist');
        break;
      case Hls.ErrorDetails.LEVEL_SWITCH_ERROR:
        logError('Error while trying to switch to level ' + data.level);
        break;
      case Hls.ErrorDetails.FRAG_LOAD_ERROR:
        logError('Error while loading fragment ' + data.frag.url);
        break;
      case Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:
        logError('Timeout while loading fragment ' + data.frag.url);
        break;
      case Hls.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        logError('Fragment-loop loading error');
        break;
      case Hls.ErrorDetails.FRAG_DECRYPT_ERROR:
        logError('Decrypting error:' + data.reason);
        break;
      case Hls.ErrorDetails.FRAG_PARSING_ERROR:
        logError('Parsing error:' + data.reason);
        break;
      case Hls.ErrorDetails.KEY_LOAD_ERROR:
        logError('Error while loading key ' + data.frag.decryptdata.uri);
        break;
      case Hls.ErrorDetails.KEY_LOAD_TIMEOUT:
        logError('Timeout while loading key ' + data.frag.decryptdata.uri);
        break;
      case Hls.ErrorDetails.BUFFER_APPEND_ERROR:
        logError('Buffer append error');
        break;
      case Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR:
        logError('Buffer add codec error for ' + data.mimeType + ':' + data.err.message);
        break;
      case Hls.ErrorDetails.BUFFER_APPENDING_ERROR:
        logError('Buffer appending error');
        break;
      case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
        logError('Buffer stalled error');
        break;
      default:
        break;
    }
    if (data.fatal) {
      console.error('Fatal error :' + data.details);
      switch (data.type) {
        case Hls.ErrorTypes.MEDIA_ERROR:
          handleMediaError();
          break;
        case Hls.ErrorTypes.NETWORK_ERROR:
          logError('A network error occured');
          break;
        default:
          logError('An unrecoverable error occured');
          hls.destroy();
          break;
      }
    }
    if (!stats) {
      stats = {};
    }
    // track all errors independently
    if (stats[data.details] === undefined) {
      stats[data.details] = 1;
    } else {
      stats[data.details] += 1;
    }

    // track fatal error
    if (data.fatal) {
      if (stats.fatalError === undefined) {
        stats.fatalError = 1;
      } else {
        stats.fatalError += 1;
      }
    }
    $('#statisticsOut').text(JSON.stringify(Object(__WEBPACK_IMPORTED_MODULE_0__demo_utils__["b" /* sortObject */])(stats), null, '\t'));
  });

  hls.on(Hls.Events.BUFFER_CREATED, function (event, data) {
    tracks = data.tracks;
  });

  hls.on(Hls.Events.BUFFER_APPENDING, function (event, data) {
    if (dumpfMP4) {
      fmp4Data[data.type].push(data.data);
    }
  });

  hls.on(Hls.Events.FPS_DROP, function (event, data) {
    var evt = {
      time: performance.now() - events.t0,
      type: 'frame drop',
      name: data.currentDropped + '/' + data.currentDecoded
    };
    events.video.push(evt);
    trimEventHistory();
    if (stats) {
      if (stats.fpsDropEvent === undefined) {
        stats.fpsDropEvent = 1;
      } else {
        stats.fpsDropEvent++;
      }

      stats.fpsTotalDroppedFrames = data.totalDroppedFrames;
    }
  });

  video.addEventListener('resize', handleVideoEvent);
  video.addEventListener('seeking', handleVideoEvent);
  video.addEventListener('seeked', handleVideoEvent);
  video.addEventListener('pause', handleVideoEvent);
  video.addEventListener('play', handleVideoEvent);
  video.addEventListener('canplay', handleVideoEvent);
  video.addEventListener('canplaythrough', handleVideoEvent);
  video.addEventListener('ended', handleVideoEvent);
  video.addEventListener('playing', handleVideoEvent);
  video.addEventListener('error', handleVideoEvent);
  video.addEventListener('loadedmetadata', handleVideoEvent);
  video.addEventListener('loadeddata', handleVideoEvent);
  video.addEventListener('durationchange', handleVideoEvent);
}

function handleUnsupported() {
  if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1) {
    logStatus('You are using Firefox, it looks like MediaSource is not enabled,<br>please ensure the following keys are set appropriately in <b>about:config</b><br>media.mediasource.enabled=true<br>media.mediasource.mp4.enabled=true<br><b>media.mediasource.whitelist=false</b>');
  } else {
    logStatus('Your Browser does not support MediaSourceExtension / MP4 mediasource');
  }
}

function handleVideoEvent(evt) {
  var data = '';
  switch (evt.type) {
    case 'durationchange':
      if (evt.target.duration - lastDuration <= 0.5) {
        // some browsers report several duration change events with almost the same value ... avoid spamming video events
        return;
      }
      lastDuration = evt.target.duration;
      data = Math.round(evt.target.duration * 1000);
      break;
    case 'resize':
      data = evt.target.videoWidth + '/' + evt.target.videoHeight;
      break;
    case 'loadedmetadata':
    case 'loadeddata':
    case 'canplay':
    case 'canplaythrough':
    case 'ended':
    case 'seeking':
    case 'seeked':
    case 'play':
    case 'playing':
      lastStartPosition = evt.target.currentTime;
    case 'pause':
    case 'waiting':
    case 'stalled':
    case 'error':
      data = Math.round(evt.target.currentTime * 1000);
      if (evt.type === 'error') {
        var errorTxt = void 0,
            mediaError = evt.currentTarget.error;
        switch (mediaError.code) {
          case mediaError.MEDIA_ERR_ABORTED:
            errorTxt = 'You aborted the video playback';
            break;
          case mediaError.MEDIA_ERR_DECODE:
            errorTxt = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support';
            handleMediaError();
            break;
          case mediaError.MEDIA_ERR_NETWORK:
            errorTxt = 'A network error caused the video download to fail part-way';
            break;
          case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorTxt = 'The video could not be loaded, either because the server or network failed or because the format is not supported';
            break;
        }

        if (mediaError.message) {
          errorTxt += ' - ' + mediaError.message;
        }

        logStatus(errorTxt);
        console.error(errorTxt);
      }
      break;
    default:
      break;
  }

  var event = {
    time: performance.now() - events.t0,
    type: evt.type,
    name: data
  };

  events.video.push(event);
  if (evt.type === 'seeking') {
    lastSeekingIdx = events.video.length - 1;
  }

  if (evt.type === 'seeked') {
    events.video[lastSeekingIdx].duration = event.time - events.video[lastSeekingIdx].time;
  }

  trimEventHistory();
}

function handleMediaError() {
  if (autoRecoverError) {
    var now = performance.now();
    if (!recoverDecodingErrorDate || now - recoverDecodingErrorDate > 3000) {
      recoverDecodingErrorDate = performance.now();
      $('#statusOut').append(', trying to recover media error.');
      hls.recoverMediaError();
    } else {
      if (!recoverSwapAudioCodecDate || now - recoverSwapAudioCodecDate > 3000) {
        recoverSwapAudioCodecDate = performance.now();
        $('#statusOut').append(', trying to swap audio codec and recover media error.');
        hls.swapAudioCodec();
        hls.recoverMediaError();
      } else {
        $('#statusOut').append(', cannot recover. Last media error recovery failed.');
      }
    }
  }
}

function timeRangesToString(r) {
  var log = '';
  for (var i = 0; i < r.length; i++) {
    log += '[' + r.start(i) + ', ' + r.end(i) + ']';
    log += ' ';
  }
  return log;
}

function checkBuffer() {
  var v = $('#video')[0];
  var canvas = $('#bufferedCanvas')[0];
  var ctx = canvas.getContext('2d');
  var r = v.buffered;
  var bufferingDuration = void 0;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'gray';
  if (r) {
    if (!canvas.width || canvas.width !== v.clientWidth) {
      canvas.width = v.clientWidth;
    }

    var pos = v.currentTime,
        bufferLen;
    for (var i = 0, bufferLen = 0; i < r.length; i++) {
      var start = r.start(i) / v.duration * canvas.width;
      var end = r.end(i) / v.duration * canvas.width;
      ctx.fillRect(start, 3, Math.max(2, end - start), 10);
      if (pos >= r.start(i) && pos < r.end(i)) {
        // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
        bufferLen = r.end(i) - pos;
      }
    }
    // check if we are in buffering / or playback ended state
    if (bufferLen <= 0.1 && v.paused === false && pos - lastStartPosition > 0.5) {
      // don't create buffering event if we are at the end of the playlist, don't report ended for live playlist
      if (lastDuration - pos <= 0.5 && events.isLive === false) {} else {
        // we are not at the end of the playlist ... real buffering
        if (bufferingIdx !== -1) {
          bufferingDuration = performance.now() - events.t0 - events.video[bufferingIdx].time;
          events.video[bufferingIdx].duration = bufferingDuration;
          events.video[bufferingIdx].name = bufferingDuration;
        } else {
          events.video.push({
            type: 'buffering',
            time: performance.now() - events.t0
          });
          trimEventHistory();
          // we are in buffering state
          bufferingIdx = events.video.length - 1;
        }
      }
    }

    if (bufferLen > 0.1 && bufferingIdx != -1) {
      bufferingDuration = performance.now() - events.t0 - events.video[bufferingIdx].time;
      events.video[bufferingIdx].duration = bufferingDuration;
      events.video[bufferingIdx].name = bufferingDuration;
      // we are out of buffering state
      bufferingIdx = -1;
    }

    // update buffer/position for current Time
    var event = {
      time: performance.now() - events.t0,
      buffer: Math.round(bufferLen * 1000),
      pos: Math.round(pos * 1000)
    };
    var bufEvents = events.buffer,
        bufEventLen = bufEvents.length;
    if (bufEventLen > 1) {
      var event0 = bufEvents[bufEventLen - 2],
          event1 = bufEvents[bufEventLen - 1];
      var slopeBuf0 = (event0.buffer - event1.buffer) / (event0.time - event1.time);
      var slopeBuf1 = (event1.buffer - event.buffer) / (event1.time - event.time);

      var slopePos0 = (event0.pos - event1.pos) / (event0.time - event1.time);
      var slopePos1 = (event1.pos - event.pos) / (event1.time - event.time);
      // compute slopes. if less than 30% difference, remove event1
      if ((slopeBuf0 === slopeBuf1 || Math.abs(slopeBuf0 / slopeBuf1 - 1) <= 0.3) && (slopePos0 === slopePos1 || Math.abs(slopePos0 / slopePos1 - 1) <= 0.3)) {
        bufEvents.pop();
      }
    }
    events.buffer.push(event);
    trimEventHistory();
    refreshCanvas();

    var log = 'Duration: ' + v.duration + '\n' + 'Buffered: ' + timeRangesToString(v.buffered) + '\n' + 'Seekable: ' + timeRangesToString(v.seekable) + '\n' + 'Played: ' + timeRangesToString(v.played) + '\n';

    if (hls.media) {
      for (var type in tracks) {
        log += 'Buffer for ' + type + ' contains: ' + timeRangesToString(tracks[type].buffer.buffered) + '\n';
      }

      var videoPlaybackQuality = v.getVideoPlaybackQuality;
      if (videoPlaybackQuality && (typeof videoPlaybackQuality === 'undefined' ? 'undefined' : _typeof(videoPlaybackQuality)) === (typeof Function === 'undefined' ? 'undefined' : _typeof(Function))) {
        log += 'Dropped frames: ' + v.getVideoPlaybackQuality().droppedVideoFrames + '\n';
        log += 'Corrupted frames:' + v.getVideoPlaybackQuality().corruptedVideoFrames + '\n';
      } else if (v.webkitDroppedFrameCount) {
        log += 'Dropped frames:' + v.webkitDroppedFrameCount + '\n';
      }
    }
    $('#bufferedOut').text(log);

    $('#statisticsOut').text(JSON.stringify(Object(__WEBPACK_IMPORTED_MODULE_0__demo_utils__["b" /* sortObject */])(stats), null, '\t'));

    ctx.fillStyle = 'blue';

    var x = v.currentTime / v.duration * canvas.width;
    ctx.fillRect(x, 0, 2, 15);
  }
}

function showCanvas() {
  showMetrics();
  $('#bufferedOut').show();
  $('#bufferedCanvas').show();
}

function hideCanvas() {
  hideMetrics();
  $('#bufferedOut').hide();
  $('#bufferedCanvas').hide();
}

function getMetrics() {
  var json = JSON.stringify(events);
  var jsonpacked = jsonpack.pack(json);
  // console.log('packing JSON from ' + json.length + ' to ' + jsonpacked.length + ' bytes');
  return btoa(jsonpacked);
}

function copyMetricsToClipBoard() {
  Object(__WEBPACK_IMPORTED_MODULE_0__demo_utils__["a" /* copyTextToClipboard */])(getMetrics());
}

function goToMetrics() {
  var url = document.URL;
  url = url.substr(0, url.lastIndexOf('/') + 1) + 'metrics.html';
  // console.log(url);
  window.open(url, '_blank');
}

function goToMetricsPermaLink() {
  var url = document.URL;
  var b64 = getMetrics();
  url = url.substr(0, url.lastIndexOf('/') + 1) + 'metrics.html#data=' + b64;
  // console.log(url);
  window.open(url, '_blank');
}

function minsecs(ts) {
  var m = Math.floor(Math.floor(ts % 3600) / 60);
  var s = Math.floor(ts % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function onClickBufferedRange(event) {
  var canvas = $('#bufferedCanvas')[0];
  var v = $('#video')[0];
  var target = (event.clientX - canvas.offsetLeft) / canvas.width * v.duration;
  v.currentTime = target;
}

function updateLevelInfo() {

  if (!hls.levels) {
    return;
  }

  var button_template = '<button type="button" class="btn btn-sm ';
  var button_enabled = 'btn-primary" ';
  var button_disabled = 'btn-success" ';

  var html1 = button_template;
  if (hls.autoLevelEnabled) {
    html1 += button_enabled;
  } else {
    html1 += button_disabled;
  }

  html1 += 'onclick="hls.currentLevel=-1">auto</button>';

  var html2 = button_template;
  if (hls.autoLevelEnabled) {
    html2 += button_enabled;
  } else {
    html2 += button_disabled;
  }

  html2 += 'onclick="hls.loadLevel=-1">auto</button>';

  var html3 = button_template;
  if (hls.autoLevelCapping === -1) {
    html3 += button_enabled;
  } else {
    html3 += button_disabled;
  }

  html3 += 'onclick="levelCapping=hls.autoLevelCapping=-1;updateLevelInfo();onDemoConfigChanged();">auto</button>';

  var html4 = button_template;
  if (hls.autoLevelEnabled) {
    html4 += button_enabled;
  } else {
    html4 += button_disabled;
  }

  html4 += 'onclick="hls.nextLevel=-1">auto</button>';

  for (var i = 0; i < hls.levels.length; i++) {
    html1 += button_template;
    if (hls.currentLevel === i) {
      html1 += button_enabled;
    } else {
      html1 += button_disabled;
    }

    var levelName = i;
    var label = level2label(i);
    if (label) {
      levelName += ' (' + level2label(i) + 'p)';
    }

    html1 += 'onclick="hls.currentLevel=' + i + '">' + levelName + '</button>';

    html2 += button_template;
    if (hls.loadLevel === i) {
      html2 += button_enabled;
    } else {
      html2 += button_disabled;
    }

    html2 += 'onclick="hls.loadLevel=' + i + '">' + levelName + '</button>';

    html3 += button_template;
    if (hls.autoLevelCapping === i) {
      html3 += button_enabled;
    } else {
      html3 += button_disabled;
    }

    html3 += 'onclick="levelCapping=hls.autoLevelCapping=' + i + ';updateLevelInfo();onDemoConfigChanged();">' + levelName + '</button>';

    html4 += button_template;
    if (hls.nextLevel === i) {
      html4 += button_enabled;
    } else {
      html4 += button_disabled;
    }

    html4 += 'onclick="hls.nextLevel=' + i + '">' + levelName + '</button>';
  }

  var v = $('#video')[0];

  if (v.videoWidth && v.videoHeight) {
    $('#currentResolution').html(v.videoWidth + ' x ' + v.videoHeight);
  }

  if ($('#currentLevelControl').html() != html1) {
    $('#currentLevelControl').html(html1);
  }

  if ($('#loadLevelControl').html() != html2) {
    $('#loadLevelControl').html(html2);
  }

  if ($('#levelCappingControl').html() != html3) {
    $('#levelCappingControl').html(html3);
  }

  if ($('#nextLevelControl').html() != html4) {
    $('#nextLevelControl').html(html4);
  }
}

function updateAudioTrackInfo() {
  var button_template = '<button type="button" class="btn btn-sm ';
  var button_enabled = 'btn-primary" ';
  var button_disabled = 'btn-success" ';
  var html1 = '';
  var audioTrackId = hls.audioTrack,
      len = hls.audioTracks.length;

  for (var i = 0; i < len; i++) {
    html1 += button_template;
    if (audioTrackId === i) {
      html1 += button_enabled;
    } else {
      html1 += button_disabled;
    }

    html1 += 'onclick="hls.audioTrack=' + i + '">' + hls.audioTracks[i].name + '</button>';
  }
  $('#audioTrackControl').html(html1);
}

function level2label(index) {
  if (hls && hls.levels.length - 1 >= index) {
    var level = hls.levels[index];
    if (level.name) {
      return level.name;
    } else {
      if (level.height) {
        return level.height + 'p / ' + Math.round(level.bitrate / 1024) + 'kb';
      } else {
        if (level.bitrate) {
          return Math.round(level.bitrate / 1024) + 'kb';
        } else {
          return null;
        }
      }
    }
  }
}

function getDemoConfigPropOrDefault(propName, defaultVal) {
  return typeof demoConfig[propName] !== 'undefined' ? demoConfig[propName] : defaultVal;
}

function getURLParam(sParam, defaultValue) {
  var sPageURL = window.location.search.substring(1);
  var sURLVariables = sPageURL.split('&');
  for (var i = 0; i < sURLVariables.length; i++) {
    var sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] == sParam) {
      return 'undefined' == sParameterName[1] ? undefined : 'false' == sParameterName[1] ? false : sParameterName[1];
    }
  }
  return defaultValue;
}

function onDemoConfigChanged() {
  var url = $('#streamURL').val();

  demoConfig = {
    enableStreaming: enableStreaming,
    autoRecoverError: autoRecoverError,
    enableWorker: enableWorker,
    dumpfMP4: dumpfMP4,
    levelCapping: levelCapping,
    limitMetrics: limitMetrics,
    defaultAudioCodec: defaultAudioCodec,
    widevineLicenseUrl: escape(widevineLicenseUrl)
  };

  var serializedDemoConfig = btoa(JSON.stringify(demoConfig));

  var baseURL = document.URL.split('?')[0];
  var permalinkURL = baseURL + ('?src=' + encodeURIComponent(url) + '&demoConfig=' + serializedDemoConfig);

  $('#StreamPermalink').html('<a href="' + permalinkURL + '">' + permalinkURL + '</a>');
}

function createfMP4(type) {
  if (fmp4Data[type].length) {
    var blob = new Blob([arrayConcat(fmp4Data[type])], {
      type: 'application/octet-stream'
    });
    var filename = type + '-' + new Date().toISOString() + '.mp4';
    saveAs(blob, filename);
    //$('body').append('<a download="hlsjs-' + filename + '" href="' + window.URL.createObjectURL(blob) + '">Download ' + filename + ' track</a><br>');
  }
}

function arrayConcat(inputArray) {
  var totalLength = inputArray.reduce(function (prev, cur) {
    return prev + cur.length;
  }, 0);
  var result = new Uint8Array(totalLength);
  var offset = 0;
  inputArray.forEach(function (element) {
    result.set(element, offset);
    offset += element.length;
  });
  return result;
}

function hideAllTabs() {
  $('#playbackControlTab').hide();
  $('#qualityLevelControlTab').hide();
  $('#audioTrackControlTab').hide();
  $('#metricsDisplayTab').hide();
  $('#statsDisplayTab').hide();
}

function toggleTab(tabElId) {
  hideAllTabs();
  hideMetrics();
  $('#' + tabElId).show();
}

function appendLog(textElId, message) {
  var el = $('#' + textElId);
  var logText = el.text();
  if (logText.length) {
    logText += '\n';
  }
  var timestamp = (Date.now() - startTime) / 1000;
  var newMessage = timestamp + ' | ' + message;
  logText += newMessage;
  // update
  el.text(logText);
}

function logStatus(message) {
  appendLog('statusOut', message);
}

function logError(message) {
  appendLog('errorOut', message);
}

/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (immutable) */ __webpack_exports__["b"] = sortObject;
/* harmony export (immutable) */ __webpack_exports__["a"] = copyTextToClipboard;
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function sortObject(obj) {
  if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object') {
    return obj;
  }
  var temp = {};
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }
  keys.sort();
  for (var index in keys) {
    temp[keys[index]] = sortObject(obj[keys[index]]);
  }
  return temp;
}

function copyTextToClipboard(text) {
  var textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
    console.log('Copying text command was ' + msg);
  } catch (err) {
    console.log('Oops, unable to copy');
  }
  document.body.removeChild(textArea);
}

/***/ }),
/* 2 */
/***/ (function(module, exports) {

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Create test stream
 * @param {string} url
 * @param {string} description
 * @param {boolean} [live]
 * @param {boolean} [abr]
 * @param {string[]} [blacklist_ua]
 * @returns {{url: string, description: string, live: boolean, abr: boolean, blacklist_ua: string[]}}
 */
function createTestStream(url, description) {
  var live = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var abr = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
  var blacklist_ua = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];

  return {
    url: url,
    description: description,
    live: live,
    abr: abr,
    blacklist_ua: blacklist_ua
  };
}

/**
 * @param {Object} target
 * @param {Object} [config]
 * @returns {{url: string, description: string, live: boolean, abr: boolean, blacklist_ua: string[]}}
 */
function createTestStreamWithConfig(target, config) {
  if ((typeof target === 'undefined' ? 'undefined' : _typeof(target)) !== 'object') {
    throw new Error('target should be object');
  }

  var testStream = createTestStream(target.url, target.description, target.live, target.abr, target.blacklist_ua);

  testStream.config = config;

  return testStream;
}

module.exports = {
  bbb: createTestStreamWithConfig({
    url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8',
    description: 'Big Buck Bunny - adaptive qualities'
  }, {
    // try to workaround test failing because of slow seek on Chrome/Win10
    nudgeMaxRetry: 5
  }),
  bigBuckBunny480p: {
    'url': 'https://video-dev.github.io/streams/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8',
    'description': 'Big Buck Bunny - 480p only',
    'live': false,
    'abr': false,
    'blacklist_ua': ['internet explorer']
  },
  arte: {
    'url': 'https://video-dev.github.io/streams/test_001/stream.m3u8',
    'description': 'ARTE China,ABR',
    'live': false,
    'abr': true
  },
  deltatreDAI: {
    'url': 'https://video-dev.github.io/streams/dai-discontinuity-deltatre/manifest.m3u8',
    'description': 'Ad-insertion in event stream',
    'live': false,
    'abr': false,
    'blacklist_ua': ['internet explorer']
  },
  issue666: {
    'url': 'https://video-dev.github.io/streams/issue666/playlists/cisq0gim60007xzvi505emlxx.m3u8',
    'description': 'hls.js/issues/666',
    'live': false,
    'abr': false,
    'blacklist_ua': ['internet explorer']
  },
  issue649: {
    'url': 'https://cdn3.screen9.com/media/c/W/cW87csHkxsgu5TV1qs78aA_auto_hls.m3u8?auth=qlUjeCtbVdtkDfZYrtveTIVUXX1yuSqgF8wfWabzKpX72r-d5upW88-FHuyRRdnZA_1PKRTGAtTt_6Z-aj22kw',
    'description': 'hls.js/issues/649',
    'live': false,
    'abr': false
  },
  closedCaptions: {
    'url': 'https://playertest.longtailvideo.com/adaptive/captions/playlist.m3u8',
    'description': 'CNN special report, with CC',
    'live': false,
    'abr': false,
    'blacklist_ua': ['safari']
  },
  oceansAES: {
    'url': 'https://playertest.longtailvideo.com/adaptive/oceans_aes/oceans_aes.m3u8',
    'description': 'AES encrypted,ABR',
    'live': false,
    'abr': true
  },
  /*
  bbbAES: {
    'url': 'https://video-dev.github.io/streams/bbbAES/playlists/sample_aes/index.m3u8',
    'description': 'SAMPLE-AES encrypted',
    'live': false,
    'abr': false
  },
  */
  mp3Audio: {
    'url': 'https://player.webvideocore.net/CL1olYogIrDWvwqiIKK7eLBkzvO18gwo9ERMzsyXzwt_t-ya8ygf2kQBZww38JJT/8i4vvznv8408.m3u8',
    'description': 'MP3 VOD demo',
    'live': false,
    'abr': false,
    'blacklist_ua': ['safari']
  },
  mpegAudioOnly: {
    'url': 'https://pl.streamingvideoprovider.com/mp3-playlist/playlist.m3u8',
    'description': 'MPEG Audio Only demo',
    'live': false,
    'abr': false,
    'blacklist_ua': ['internet explorer', 'MicrosoftEdge', 'safari', 'firefox']
  },
  fmp4: {
    'url': 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
    'description': 'HLS fMP4 Angel-One multiple audio-tracks',
    'live': false,
    'abr': false,
    'blacklist_ua': ['safari', 'internet explorer']
  },
  fmp4Bitmovin: {
    'url': 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s-fmp4/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    'description': 'HLS fMP4 by Bitmovin',
    'live': false,
    'abr': true,
    'blacklist_ua': ['safari', 'internet explorer']
  },
  offset_pts: {
    'url': 'https://video-dev.github.io/streams/pts_shift/master.m3u8',
    'description': 'DK Turntable, PTS shifted by 2.3s',
    'live': false,
    'abr': false
  },
  /*
  uspHLSAteam: createTestStream(
    'http://demo.unified-streaming.com/video/ateam/ateam.ism/ateam.m3u8?session_id=27199',
    'A-Team movie trailer - HLS by Unified Streaming Platform'
  ),
  */
  angelOneShakaWidevine: createTestStreamWithConfig({
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine-hls/hls.m3u8',
    description: 'Shaka-packager Widevine DRM (EME) HLS-fMP4 - Angel One Demo',
    blacklist_ua: ['firefox', 'safari', 'internet explorer']
  }, {
    widevineLicenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
    emeEnabled: true
  }),
  audioOnlyMultipleLevels: {
    'url': 'https://s3.amazonaws.com/bob.jwplayer.com/~alex/121628/new_master.m3u8',
    'description': 'Multiple non-alternate audio levels',
    'live': false,
    'abr': false
  },
  pdtDuplicate: {
    url: 'https://playertest.longtailvideo.com/adaptive/artbeats/manifest.m3u8',
    description: 'Stream with duplicate sequential PDT values'
  },
  pdtLargeGap: {
    url: 'https://playertest.longtailvideo.com/adaptive/boxee/playlist.m3u8',
    description: 'PDTs with large gaps following discontinuities'
  },
  pdtBadValues: {
    url: 'https://playertest.longtailvideo.com/adaptive/progdatime/playlist2.m3u8',
    description: 'PDTs with bad values'
  },
  pdtOneValue: {
    url: 'https://playertest.longtailvideo.com/adaptive/aviion/manifest.m3u8',
    description: 'One PDT, no discontinuities'
  }
};

/***/ })
/******/ ])["default"];
});
//# sourceMappingURL=hls-demo.js.map