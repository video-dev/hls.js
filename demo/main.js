/* global $, Hls, __NETLIFY__ */
/* eslint camelcase: 0 */

import { pack } from 'jsonpack';
import 'promise-polyfill/src/polyfill';
import { sortObject, copyTextToClipboard } from './demo-utils';
import { TimelineChart } from './chart/timeline-chart';

const NETLIFY = __NETLIFY__; // replaced in build

const STORAGE_KEYS = {
  Editor_Persistence: 'hlsjs:config-editor-persist',
  Hls_Config: 'hlsjs:config',
  volume: 'hlsjs:volume',
  demo_tabs: 'hlsjs:demo-tabs',
};

const testStreams = require('../tests/test-streams');
const defaultTestStreamUrl = testStreams[Object.keys(testStreams)[0]].url;
const sourceURL = decodeURIComponent(getURLParam('src', defaultTestStreamUrl));

let demoConfig = getURLParam('demoConfig', null);
if (demoConfig) {
  demoConfig = JSON.parse(atob(demoConfig));
} else {
  demoConfig = {};
}

const hlsjsDefaults = {
  debug: true,
  enableWorker: true,
  lowLatencyMode: true,
  backBufferLength: 60 * 1.5,
};

let enableStreaming = getDemoConfigPropOrDefault('enableStreaming', true);
let autoRecoverError = getDemoConfigPropOrDefault('autoRecoverError', true);
let levelCapping = getDemoConfigPropOrDefault('levelCapping', -1);
let limitMetrics = getDemoConfigPropOrDefault('limitMetrics', -1);
let dumpfMP4 = getDemoConfigPropOrDefault('dumpfMP4', false);
let stopOnStall = getDemoConfigPropOrDefault('stopOnStall', false);

let bufferingIdx = -1;
let selectedTestStream = null;

let video = document.querySelector('#video');
const startTime = Date.now();

let lastSeekingIdx;
let lastStartPosition;
let lastDuration;
let lastAudioTrackSwitchingIdx;
let hls;
let url;
let events;
let stats;
let tracks;
let fmp4Data;
let configPersistenceEnabled = false;
let configEditor = null;
let chart;
let resizeAsyncCallbackId = -1;

const requestAnimationFrame = self.requestAnimationFrame || self.setTimeout;
const cancelAnimationFrame = self.cancelAnimationFrame || self.clearTimeout;
const resizeHandlers = [];
const resize = () => {
  cancelAnimationFrame(resizeAsyncCallbackId);
  resizeAsyncCallbackId = requestAnimationFrame(() => {
    resizeHandlers.forEach((handler) => {
      handler();
    });
  });
};

self.onresize = resize;
if (self.screen && self.screen.orientation) {
  self.screen.orientation.onchange = resize;
}

const playerResize = () => {
  const bounds = video.getBoundingClientRect();
  $('#currentSize').html(
    `${Math.round(bounds.width * 10) / 10} x ${
      Math.round(bounds.height * 10) / 10
    }`
  );
  if (video.videoWidth && video.videoHeight) {
    $('#currentResolution').html(`${video.videoWidth} x ${video.videoHeight}`);
  }
};
resizeHandlers.push(playerResize);

$(document).ready(function () {
  setupConfigEditor();

  chart = setupTimelineChart();

  Object.keys(testStreams).forEach((key, index) => {
    const stream = testStreams[key];
    const option = new Option(stream.description, key);
    $('#streamSelect').append(option);
    if (stream.url === sourceURL) {
      document.querySelector('#streamSelect').selectedIndex = index + 1;
    }
  });

  const videoWidth = video.style.width;
  if (videoWidth) {
    $('#videoSize option').each(function (i, option) {
      if (option.value === videoWidth) {
        document.querySelector('#videoSize').selectedIndex = i;
        $('#bufferedCanvas').width(videoWidth);
        resize();
        return false;
      }
    });
  }

  $('#streamSelect').change(function () {
    const key = $('#streamSelect').val() || Object.keys(testStreams)[0];
    selectedTestStream = testStreams[key];
    const streamUrl = selectedTestStream.url;
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
    checkBuffer();
    resize();
  });

  $('#enableStreaming').click(function () {
    enableStreaming = this.checked;
    loadSelectedStream();
  });

  $('#autoRecoverError').click(function () {
    autoRecoverError = this.checked;
    onDemoConfigChanged();
  });

  $('#stopOnStall').click(function () {
    stopOnStall = this.checked;
    onDemoConfigChanged();
  });

  $('#dumpfMP4').click(function () {
    dumpfMP4 = this.checked;
    $('.btn-dump').toggle(dumpfMP4);
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

  $('#limitMetrics').val(limitMetrics);
  $('#enableStreaming').prop('checked', enableStreaming);
  $('#autoRecoverError').prop('checked', autoRecoverError);
  $('#stopOnStall').prop('checked', stopOnStall);
  $('#dumpfMP4').prop('checked', dumpfMP4);
  $('#levelCapping').val(levelCapping);

  // link to version on npm if canary
  // github branch for a branch version
  // github tag for a normal tag
  // github PR for a pr
  function getVersionLink(version) {
    const alphaRegex = /[-.]0\.alpha\./;
    if (alphaRegex.test(version)) {
      return `https://www.npmjs.com/package/hls.js/v/${encodeURIComponent(
        version
      )}`;
    } else if (NETLIFY.reviewID) {
      return `https://github.com/video-dev/hls.js/pull/${NETLIFY.reviewID}`;
    } else if (NETLIFY.branch) {
      return `https://github.com/video-dev/hls.js/tree/${encodeURIComponent(
        NETLIFY.branch
      )}`;
    }
    return `https://github.com/video-dev/hls.js/releases/tag/v${encodeURIComponent(
      version
    )}`;
  }

  const version = Hls.version;
  if (version) {
    const $a = $('<a />')
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .attr('href', getVersionLink(version))
      .text('v' + version);
    $('.title').append(' ').append($a);
  }

  $('#streamURL').val(sourceURL);

  const volumeSettings = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.volume)
  ) || {
    volume: 0.05,
    muted: false,
  };
  video.volume = volumeSettings.volume;
  video.muted = volumeSettings.muted;

  $('.btn-dump').toggle(dumpfMP4);
  $('#toggleButtons').show();

  $('#metricsButtonWindow').toggle(self.windowSliding);
  $('#metricsButtonFixed').toggle(!self.windowSliding);

  loadSelectedStream();

  let tabIndexesCSV = localStorage.getItem(STORAGE_KEYS.demo_tabs);
  if (tabIndexesCSV === null) {
    tabIndexesCSV = '0,1,2';
  }
  if (tabIndexesCSV) {
    tabIndexesCSV.split(',').forEach((indexString) => {
      toggleTab($('.demo-tab-btn')[parseInt(indexString) || 0], true);
    });
  }
  $(window).on('popstate', function () {
    window.location.reload();
  });
});

function setupGlobals() {
  self.events = events = {
    url: url,
    t0: self.performance.now(),
    load: [],
    buffer: [],
    video: [],
    level: [],
    bitrate: [],
  };
  lastAudioTrackSwitchingIdx = undefined;
  lastSeekingIdx = undefined;
  bufferingIdx = -1;

  // actual values, only on window
  self.recoverDecodingErrorDate = null;
  self.recoverSwapAudioCodecDate = null;
  self.fmp4Data = fmp4Data = {
    audio: [],
    video: [],
  };
  self.onClickBufferedRange = onClickBufferedRange;
  self.updateLevelInfo = updateLevelInfo;
  self.onDemoConfigChanged = onDemoConfigChanged;
  self.createfMP4 = createfMP4;
  self.goToMetricsPermaLink = goToMetricsPermaLink;
  self.toggleTab = toggleTab;
  self.toggleTabClick = toggleTabClick;
  self.applyConfigEditorValue = applyConfigEditorValue;
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
  const x = limitMetrics;

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
  $('#statusOut,#errorOut').empty();

  if (!Hls.isSupported()) {
    handleUnsupported();
    return;
  }

  url = $('#streamURL').val();

  setupGlobals();
  hideCanvas();

  if (hls) {
    hls.destroy();
    clearInterval(hls.bufferTimer);
    hls = null;
  }

  if (!enableStreaming) {
    logStatus('Streaming disabled');
    return;
  }

  logStatus('Loading ' + url);

  // Extending both a demo-specific config and the user config which can override all
  const hlsConfig = $.extend(
    {},
    hlsjsDefaults,
    getEditorValue({ parse: true })
  );

  if (selectedTestStream && selectedTestStream.config) {
    console.info(
      '[loadSelectedStream] extending hls config with stream-specific config: ',
      selectedTestStream.config
    );
    $.extend(hlsConfig, selectedTestStream.config);
    updateConfigEditorValue(hlsConfig);
  }

  onDemoConfigChanged(true);
  console.log('Using Hls.js config:', hlsConfig);

  self.hls = hls = new Hls(hlsConfig);

  logStatus('Loading manifest and attaching video element...');

  const expiredTracks = [].filter.call(
    video.textTracks,
    (track) => track.kind !== 'metadata'
  );
  if (expiredTracks.length) {
    const kinds = expiredTracks
      .map((track) => track.kind)
      .filter((kind, index, self) => self.indexOf(kind) === index);
    logStatus(
      `Replacing video element to remove ${kinds.join(' and ')} text tracks`
    );
    const videoWithExpiredTextTracks = video;
    video = videoWithExpiredTextTracks.cloneNode(false);
    video.removeAttribute('src');
    video.volume = videoWithExpiredTextTracks.volume;
    video.muted = videoWithExpiredTextTracks.muted;
    videoWithExpiredTextTracks.parentNode.insertBefore(
      video,
      videoWithExpiredTextTracks
    );
    videoWithExpiredTextTracks.parentNode.removeChild(
      videoWithExpiredTextTracks
    );
  }
  addChartEventListeners(hls);
  addVideoEventListeners(video);

  hls.loadSource(url);
  hls.autoLevelCapping = levelCapping;
  hls.attachMedia(video);

  hls.on(Hls.Events.MEDIA_ATTACHED, function () {
    logStatus('Media element attached');
    bufferingIdx = -1;
    events.video.push({
      time: self.performance.now() - events.t0,
      type: 'Media attached',
    });
    trimEventHistory();
  });

  hls.on(Hls.Events.MEDIA_DETACHED, function () {
    logStatus('Media element detached');
    clearInterval(hls.bufferTimer);
    bufferingIdx = -1;
    tracks = [];
    events.video.push({
      time: self.performance.now() - events.t0,
      type: 'Media detached',
    });
    trimEventHistory();
  });

  hls.on(Hls.Events.DESTROYING, function () {
    clearInterval(hls.bufferTimer);
  });
  hls.on(Hls.Events.BUFFER_RESET, function () {
    clearInterval(hls.bufferTimer);
  });

  hls.on(Hls.Events.FRAG_PARSING_INIT_SEGMENT, function (eventName, data) {
    showCanvas();
    events.video.push({
      time: self.performance.now() - events.t0,
      type: data.id + ' init segment',
    });
    trimEventHistory();
  });

  hls.on(Hls.Events.FRAG_PARSING_METADATA, function (eventName, data) {
    // console.log("Id3 samples ", data.samples);
  });

  hls.on(Hls.Events.LEVEL_SWITCHING, function (eventName, data) {
    events.level.push({
      time: self.performance.now() - events.t0,
      id: data.level,
      bitrate: Math.round(hls.levels[data.level].bitrate / 1000),
    });
    trimEventHistory();
    updateLevelInfo();
  });

  hls.on(Hls.Events.MANIFEST_PARSED, function (eventName, data) {
    events.load.push({
      type: 'manifest',
      name: '',
      start: 0,
      end: data.levels.length,
      time: data.stats.loading.start - events.t0,
      latency: data.stats.loading.first - data.stats.loading.start,
      load: data.stats.loading.end - data.stats.loading.first,
      duration: data.stats.loading.end - data.stats.loading.first,
    });
    trimEventHistory();
    self.refreshCanvas();
  });

  hls.on(Hls.Events.MANIFEST_PARSED, function (eventName, data) {
    logStatus(`${hls.levels.length} quality levels found`);
    logStatus('Manifest successfully loaded');
    stats = {
      levelNb: data.levels.length,
      levelParsed: 0,
    };
    trimEventHistory();
    updateLevelInfo();
  });

  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function (eventName, data) {
    logStatus('No of audio tracks found: ' + data.audioTracks.length);
    updateAudioTrackInfo();
  });

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, function (eventName, data) {
    logStatus('Audio track switching...');
    updateAudioTrackInfo();
    events.video.push({
      time: self.performance.now() - events.t0,
      type: 'audio switching',
      name: '@' + data.id,
    });
    trimEventHistory();
    lastAudioTrackSwitchingIdx = events.video.length - 1;
  });

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, function (eventName, data) {
    logStatus('Audio track switched');
    updateAudioTrackInfo();
    const event = {
      time: self.performance.now() - events.t0,
      type: 'audio switched',
      name: '@' + data.id,
    };
    if (lastAudioTrackSwitchingIdx !== undefined) {
      events.video[lastAudioTrackSwitchingIdx].duration =
        event.time - events.video[lastAudioTrackSwitchingIdx].time;
      lastAudioTrackSwitchingIdx = undefined;
    }
    events.video.push(event);
    trimEventHistory();
  });

  hls.on(Hls.Events.LEVEL_LOADED, function (eventName, data) {
    events.isLive = data.details.live;
    const event = {
      type: 'level',
      id: data.level,
      start: data.details.startSN,
      end: data.details.endSN,
      time: data.stats.loading.start - events.t0,
      latency: data.stats.loading.first - data.stats.loading.start,
      load: data.stats.loading.end - data.stats.loading.first,
      parsing: data.stats.parsing.end - data.stats.loading.end,
      duration: data.stats.loading.end - data.stats.loading.first,
    };

    const parsingDuration = data.stats.parsing.end - data.stats.loading.end;
    if (stats.levelParsed) {
      this.sumLevelParsingMs += parsingDuration;
    } else {
      this.sumLevelParsingMs = parsingDuration;
    }

    stats.levelParsed++;
    stats.levelParsingUs = Math.round(
      (1000 * this.sumLevelParsingMs) / stats.levelParsed
    );

    // console.log('parsing level duration :' + stats.levelParsingUs + 'us,count:' + stats.levelParsed);

    events.load.push(event);
    trimEventHistory();
    self.refreshCanvas();
  });

  hls.on(Hls.Events.AUDIO_TRACK_LOADED, function (eventName, data) {
    events.isLive = data.details.live;
    const event = {
      type: 'audio track',
      id: data.id,
      start: data.details.startSN,
      end: data.details.endSN,
      time: data.stats.loading.start - events.t0,
      latency: data.stats.loading.first - data.stats.loading.start,
      load: data.stats.loading.end - data.stats.loading.first,
      parsing: data.stats.parsing.end - data.stats.loading.end,
      duration: data.stats.loading.end - data.stats.loading.first,
    };
    events.load.push(event);
    trimEventHistory();
    self.refreshCanvas();
  });

  hls.on(Hls.Events.FRAG_BUFFERED, function (eventName, data) {
    const event = {
      type: data.frag.type + (data.part ? ' part' : ' fragment'),
      id: data.frag.level,
      id2: data.frag.sn,
      id3: data.part ? data.part.index : undefined,
      time: data.stats.loading.start - events.t0,
      latency: data.stats.loading.first - data.stats.loading.start,
      load: data.stats.loading.end - data.stats.loading.first,
      parsing: data.stats.parsing.end - data.stats.loading.end,
      buffer: data.stats.buffering.end - data.stats.parsing.end,
      duration: data.stats.buffering.end - data.stats.loading.first,
      bw: Math.round(
        (8 * data.stats.total) /
          (data.stats.buffering.end - data.stats.loading.start)
      ),
      size: data.stats.total,
    };
    events.load.push(event);
    events.bitrate.push({
      time: self.performance.now() - events.t0,
      bitrate: event.bw,
      duration: data.frag.duration,
      level: event.id,
    });
    if (events.buffer.length === 0) {
      events.buffer.push({
        time: 0,
        buffer: 0,
        pos: 0,
      });
    }
    clearInterval(hls.bufferTimer);
    hls.bufferTimer = self.setInterval(checkBuffer, 100);
    trimEventHistory();
    self.refreshCanvas();
    updateLevelInfo();

    const latency = data.stats.loading.first - data.stats.loading.start;
    const parsing = data.stats.parsing.end - data.stats.loading.end;
    const process = data.stats.buffering.end - data.stats.loading.start;
    const bitrate = Math.round(
      (8 * data.stats.total) /
        (data.stats.buffering.end - data.stats.loading.first)
    );

    if (stats.fragBuffered) {
      stats.fragMinLatency = Math.min(stats.fragMinLatency, latency);
      stats.fragMaxLatency = Math.max(stats.fragMaxLatency, latency);
      stats.fragMinProcess = Math.min(stats.fragMinProcess, process);
      stats.fragMaxProcess = Math.max(stats.fragMaxProcess, process);
      stats.fragMinKbps = Math.min(stats.fragMinKbps, bitrate);
      stats.fragMaxKbps = Math.max(stats.fragMaxKbps, bitrate);
      stats.autoLevelCappingMin = Math.min(
        stats.autoLevelCappingMin,
        hls.autoLevelCapping
      );
      stats.autoLevelCappingMax = Math.max(
        stats.autoLevelCappingMax,
        hls.autoLevelCapping
      );
      stats.fragBuffered++;
    } else {
      stats.fragMinLatency = stats.fragMaxLatency = latency;
      stats.fragMinProcess = stats.fragMaxProcess = process;
      stats.fragMinKbps = stats.fragMaxKbps = bitrate;
      stats.fragBuffered = 1;
      stats.fragBufferedBytes = 0;
      stats.autoLevelCappingMin = stats.autoLevelCappingMax =
        hls.autoLevelCapping;
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
    stats.fragparsingKbps = Math.round(
      (8 * stats.fragBufferedBytes) / this.sumParsing
    );
    stats.fragparsingMs = Math.round(this.sumParsing);
    stats.autoLevelCappingLast = hls.autoLevelCapping;
  });

  hls.on(Hls.Events.LEVEL_SWITCHED, function (eventName, data) {
    const event = {
      time: self.performance.now() - events.t0,
      type: 'level switched',
      name: data.level,
    };
    events.video.push(event);
    trimEventHistory();
    self.refreshCanvas();
    updateLevelInfo();
  });

  hls.on(Hls.Events.FRAG_CHANGED, function (eventName, data) {
    const event = {
      time: self.performance.now() - events.t0,
      type: 'frag changed',
      name: data.frag.sn + ' @ ' + data.frag.level,
    };
    events.video.push(event);
    trimEventHistory();
    self.refreshCanvas();
    updateLevelInfo();
    stats.tagList = data.frag.tagList;

    const level = data.frag.level;
    const autoLevel = hls.autoLevelEnabled;
    if (stats.levelStart === undefined) {
      stats.levelStart = level;
    }

    stats.fragProgramDateTime = data.frag.programDateTime;
    stats.fragStart = data.frag.start;

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
      stats.autoLevelAvg =
        Math.round((1000 * this.sumAutoLevel) / stats.fragChangedAuto) / 1000;
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

  hls.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, function (eventName, data) {
    if (stats) {
      if (stats.fragLoadEmergencyAborted === undefined) {
        stats.fragLoadEmergencyAborted = 1;
      } else {
        stats.fragLoadEmergencyAborted++;
      }
    }
  });

  hls.on(Hls.Events.FRAG_DECRYPTED, function (eventName, data) {
    if (!stats.fragDecrypted) {
      stats.fragDecrypted = 0;
      this.totalDecryptTime = 0;
      stats.fragAvgDecryptTime = 0;
    }
    stats.fragDecrypted++;
    this.totalDecryptTime += data.stats.tdecrypt - data.stats.tstart;
    stats.fragAvgDecryptTime = this.totalDecryptTime / stats.fragDecrypted;
  });

  hls.on(Hls.Events.ERROR, function (eventName, data) {
    console.warn('Error event:', data);
    switch (data.details) {
      case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
        try {
          $('#errorOut').html(
            'Cannot load <a href="' +
              data.context.url +
              '">' +
              url +
              '</a><br>HTTP response code:' +
              data.response.code +
              ' <br>' +
              data.response.text
          );
          if (data.response.code === 0) {
            $('#errorOut').append(
              'This might be a CORS issue, consider installing <a href="https://chrome.google.com/webstore/detail/allow-control-allow-origi/nlfbmbojpeacfghkpbjhddihlkkiljbi">Allow-Control-Allow-Origin</a> Chrome Extension'
            );
          }
        } catch (err) {
          $('#errorOut').html(
            'Cannot load <a href="' +
              data.context.url +
              '">' +
              url +
              '</a><br>Response body: ' +
              data.response.text
          );
        }
        break;
      case Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
        logError('Timeout while loading manifest');
        break;
      case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
        logError('Error while parsing manifest:' + data.reason);
        break;
      case Hls.ErrorDetails.LEVEL_EMPTY_ERROR:
        logError(
          'Loaded level contains no fragments ' + data.level + ' ' + data.url
        );
        // handleLevelError demonstrates how to remove a level that errors followed by a downswitch
        // handleLevelError(data);
        break;
      case Hls.ErrorDetails.LEVEL_LOAD_ERROR:
        logError(
          'Error while loading level playlist ' +
            data.context.level +
            ' ' +
            data.url
        );
        // handleLevelError demonstrates how to remove a level that errors followed by a downswitch
        // handleLevelError(data);
        break;
      case Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT:
        logError(
          'Timeout while loading level playlist ' +
            data.context.level +
            ' ' +
            data.url
        );
        // handleLevelError demonstrates how to remove a level that errors followed by a downswitch
        // handleLevelError(data);
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
        logError(
          'Buffer add codec error for ' +
            data.mimeType +
            ':' +
            data.error.message
        );
        break;
      case Hls.ErrorDetails.BUFFER_APPENDING_ERROR:
        logError('Buffer appending error');
        break;
      case Hls.ErrorDetails.BUFFER_STALLED_ERROR:
        logError('Buffer stalled error');
        if (stopOnStall) {
          hls.stopLoad();
          video.pause();
        }
        break;
      default:
        break;
    }

    if (data.fatal) {
      console.error(`Fatal error : ${data.details}`);
      switch (data.type) {
        case Hls.ErrorTypes.MEDIA_ERROR:
          logError(`A media error occurred: ${data.details}`);
          handleMediaError();
          break;
        case Hls.ErrorTypes.NETWORK_ERROR:
          logError(`A network error occurred: ${data.details}`);
          break;
        default:
          logError(`An unrecoverable error occurred: ${data.details}`);
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
    $('#statisticsOut').text(JSON.stringify(sortObject(stats), null, '\t'));
  });

  hls.on(Hls.Events.BUFFER_CREATED, function (eventName, data) {
    tracks = data.tracks;
  });

  hls.on(Hls.Events.BUFFER_APPENDING, function (eventName, data) {
    if (dumpfMP4) {
      fmp4Data[data.type].push(data.data);
    }
  });

  hls.on(Hls.Events.FPS_DROP, function (eventName, data) {
    const event = {
      time: self.performance.now() - events.t0,
      type: 'frame drop',
      name: data.currentDropped + '/' + data.currentDecoded,
    };
    events.video.push(event);
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
}

function addVideoEventListeners(video) {
  video.removeEventListener('resize', handleVideoEvent);
  video.removeEventListener('seeking', handleVideoEvent);
  video.removeEventListener('seeked', handleVideoEvent);
  video.removeEventListener('pause', handleVideoEvent);
  video.removeEventListener('play', handleVideoEvent);
  video.removeEventListener('canplay', handleVideoEvent);
  video.removeEventListener('canplaythrough', handleVideoEvent);
  video.removeEventListener('ended', handleVideoEvent);
  video.removeEventListener('playing', handleVideoEvent);
  video.removeEventListener('error', handleVideoEvent);
  video.removeEventListener('loadedmetadata', handleVideoEvent);
  video.removeEventListener('loadeddata', handleVideoEvent);
  video.removeEventListener('durationchange', handleVideoEvent);
  video.removeEventListener('volumechange', handleVolumeEvent);
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
  video.addEventListener('volumechange', handleVolumeEvent);
}

function handleUnsupported() {
  if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1) {
    logStatus(
      'You are using Firefox, it looks like MediaSource is not enabled,<br>please ensure the following keys are set appropriately in <b>about:config</b><br>media.mediasource.enabled=true<br>media.mediasource.mp4.enabled=true<br><b>media.mediasource.whitelist=false</b>'
    );
  } else {
    logStatus(
      'Your Browser does not support MediaSourceExtension / MP4 mediasource'
    );
  }
}

function handleVideoEvent(evt) {
  let data = '';
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
      playerResize();
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
        let errorTxt;
        const mediaError = evt.currentTarget.error;
        switch (mediaError.code) {
          case mediaError.MEDIA_ERR_ABORTED:
            errorTxt = 'You aborted the video playback';
            break;
          case mediaError.MEDIA_ERR_DECODE:
            errorTxt =
              'The video playback was aborted due to a corruption problem or because the video used features your browser did not support';
            handleMediaError();
            break;
          case mediaError.MEDIA_ERR_NETWORK:
            errorTxt =
              'A network error caused the video download to fail part-way';
            break;
          case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorTxt =
              'The video could not be loaded, either because the server or network failed or because the format is not supported';
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

  const event = {
    time: self.performance.now() - events.t0,
    type: evt.type,
    name: data,
  };

  events.video.push(event);
  if (evt.type === 'seeking') {
    lastSeekingIdx = events.video.length - 1;
  }

  if (evt.type === 'seeked') {
    events.video[lastSeekingIdx].duration =
      event.time - events.video[lastSeekingIdx].time;
  }

  trimEventHistory();
}

function handleVolumeEvent() {
  localStorage.setItem(
    STORAGE_KEYS.volume,
    JSON.stringify({
      muted: video.muted,
      volume: video.volume,
    })
  );
}

function handleLevelError(data) {
  var levelObj = data.context || data;
  hls.removeLevel(levelObj.level, levelObj.urlId || 0);
  if (!hls.levels.length) {
    logError('All levels have been removed');
    hls.destroy();
    return;
  }
  // Trigger an immediate downswitch to the first level
  // This is to handle the case where we start at an empty level, where switching to auto causes hlsjs to stall
  hls.currentLevel = 0;
  // Set the quality back to auto so that we return to optimal quality
  hls.currentLevel = -1;
}

function handleMediaError() {
  if (autoRecoverError) {
    const now = self.performance.now();
    if (
      !self.recoverDecodingErrorDate ||
      now - self.recoverDecodingErrorDate > 3000
    ) {
      self.recoverDecodingErrorDate = self.performance.now();
      $('#statusOut').append(', trying to recover media error.');
      hls.recoverMediaError();
    } else {
      if (
        !self.recoverSwapAudioCodecDate ||
        now - self.recoverSwapAudioCodecDate > 3000
      ) {
        self.recoverSwapAudioCodecDate = self.performance.now();
        $('#statusOut').append(
          ', trying to swap audio codec and recover media error.'
        );
        hls.swapAudioCodec();
        hls.recoverMediaError();
      } else {
        $('#statusOut').append(
          ', cannot recover. Last media error recovery failed.'
        );
      }
    }
  }
}

function timeRangesToString(r) {
  let log = '';
  for (let i = 0; i < r.length; i++) {
    log += '[' + r.start(i) + ', ' + r.end(i) + ']';
    log += ' ';
  }
  return log;
}

function checkBuffer() {
  const canvas = document.querySelector('#bufferedCanvas');
  const ctx = canvas.getContext('2d');
  const r = video.buffered;
  const seekableEnd = getSeekableEnd();
  let bufferingDuration;
  if (r) {
    ctx.fillStyle = 'black';
    if (!canvas.width || canvas.width !== video.clientWidth) {
      canvas.width = video.clientWidth;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pos = video.currentTime;
    let bufferLen = 0;
    ctx.fillStyle = 'gray';
    for (let i = 0; i < r.length; i++) {
      const start = (r.start(i) / seekableEnd) * canvas.width;
      const end = (r.end(i) / seekableEnd) * canvas.width;
      ctx.fillRect(start, 2, Math.max(2, end - start), 11);
      if (pos >= r.start(i) && pos < r.end(i)) {
        // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
        bufferLen = r.end(i) - pos;
      }
    }
    // check if we are in buffering / or playback ended state
    if (
      bufferLen <= 0.1 &&
      video.paused === false &&
      pos - lastStartPosition > 0.5
    ) {
      if (lastDuration - pos <= 0.5 && events.isLive === false) {
        // don't create buffering event if we are at the end of the playlist, don't report ended for live playlist
      } else {
        // we are not at the end of the playlist ... real buffering
        if (bufferingIdx !== -1) {
          bufferingDuration =
            self.performance.now() -
            events.t0 -
            events.video[bufferingIdx].time;
          events.video[bufferingIdx].duration = bufferingDuration;
          events.video[bufferingIdx].name = bufferingDuration;
        } else {
          events.video.push({
            type: 'buffering',
            time: self.performance.now() - events.t0,
          });
          trimEventHistory();
          // we are in buffering state
          bufferingIdx = events.video.length - 1;
        }
      }
    }

    if (bufferLen > 0.1 && bufferingIdx !== -1) {
      bufferingDuration =
        self.performance.now() - events.t0 - events.video[bufferingIdx].time;
      events.video[bufferingIdx].duration = bufferingDuration;
      events.video[bufferingIdx].name = bufferingDuration;
      // we are out of buffering state
      bufferingIdx = -1;
    }

    // update buffer/position for current Time
    const event = {
      time: self.performance.now() - events.t0,
      buffer: Math.round(bufferLen * 1000),
      pos: Math.round(pos * 1000),
    };
    const bufEvents = events.buffer;
    const bufEventLen = bufEvents.length;
    if (bufEventLen > 1) {
      const event0 = bufEvents[bufEventLen - 2];
      const event1 = bufEvents[bufEventLen - 1];
      const slopeBuf0 =
        (event0.buffer - event1.buffer) / (event0.time - event1.time);
      const slopeBuf1 =
        (event1.buffer - event.buffer) / (event1.time - event.time);

      const slopePos0 = (event0.pos - event1.pos) / (event0.time - event1.time);
      const slopePos1 = (event1.pos - event.pos) / (event1.time - event.time);
      // compute slopes. if less than 30% difference, remove event1
      if (
        (slopeBuf0 === slopeBuf1 ||
          Math.abs(slopeBuf0 / slopeBuf1 - 1) <= 0.3) &&
        (slopePos0 === slopePos1 || Math.abs(slopePos0 / slopePos1 - 1) <= 0.3)
      ) {
        bufEvents.pop();
      }
    }
    events.buffer.push(event);
    trimEventHistory();
    self.refreshCanvas();

    if ($('#statsDisplayTab').is(':visible')) {
      let log = `Duration: ${video.duration}\nBuffered: ${timeRangesToString(
        video.buffered
      )}\nSeekable: ${timeRangesToString(
        video.seekable
      )}\nPlayed: ${timeRangesToString(video.played)}\n`;
      if (hls.media) {
        for (const type in tracks) {
          log += `Buffer for ${type} contains:${timeRangesToString(
            tracks[type].buffer.buffered
          )}\n`;
        }
        const videoPlaybackQuality = video.getVideoPlaybackQuality;
        if (
          videoPlaybackQuality &&
          typeof videoPlaybackQuality === typeof Function
        ) {
          log += `Dropped frames: ${
            video.getVideoPlaybackQuality().droppedVideoFrames
          }\n`;
          log += `Corrupted frames: ${
            video.getVideoPlaybackQuality().corruptedVideoFrames
          }\n`;
        } else if (video.webkitDroppedFrameCount) {
          log += `Dropped frames: ${video.webkitDroppedFrameCount}\n`;
        }
      }
      log += `Bandwidth Estimate: ${hls.bandwidthEstimate.toFixed(3)}\n`;
      if (events.isLive) {
        log +=
          'Live Stats:\n' +
          `  Max Latency: ${hls.maxLatency}\n` +
          `  Target Latency: ${hls.targetLatency.toFixed(3)}\n` +
          `  Latency: ${hls.latency.toFixed(3)}\n` +
          `  Drift: ${hls.drift.toFixed(3)} (edge advance rate)\n` +
          `  Edge Stall: ${hls.latencyController.edgeStalled.toFixed(
            3
          )} (playlist refresh over target duration/part)\n` +
          `  Playback rate: ${video.playbackRate.toFixed(2)}\n`;
        if (stats.fragProgramDateTime) {
          const currentPDT =
            stats.fragProgramDateTime +
            (video.currentTime - stats.fragStart) * 1000;
          log += `  Program Date Time: ${new Date(currentPDT).toISOString()}`;
          const pdtLatency = (Date.now() - currentPDT) / 1000;
          if (pdtLatency > 0) {
            log += ` (${pdtLatency.toFixed(3)} seconds ago)`;
          }
        }
      }

      $('#bufferedOut').text(log);
      $('#statisticsOut').text(JSON.stringify(sortObject(stats), null, '\t'));
    }

    ctx.fillStyle = 'blue';
    const x = (video.currentTime / seekableEnd) * canvas.width;
    ctx.fillRect(x, 0, 2, 15);
  } else if (ctx.fillStyle !== 'black') {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function showCanvas() {
  self.showMetrics();
  $('#bufferedOut').show();
  $('#bufferedCanvas').show();
}

function hideCanvas() {
  self.hideMetrics();
  $('#bufferedOut').hide();
  $('#bufferedCanvas').hide();
}

function getMetrics() {
  const json = JSON.stringify(events);
  const jsonpacked = pack(json);
  // console.log('packing JSON from ' + json.length + ' to ' + jsonpacked.length + ' bytes');
  return btoa(jsonpacked);
}

self.copyMetricsToClipBoard = function () {
  copyTextToClipboard(getMetrics());
};

self.goToMetrics = function () {
  let url = document.URL;
  url = url.substr(0, url.lastIndexOf('/') + 1) + 'metrics.html';
  self.open(url, '_blank');
};

function goToMetricsPermaLink() {
  let url = document.URL;
  const b64 = getMetrics();
  url = url.substr(0, url.lastIndexOf('/') + 1) + 'metrics.html#data=' + b64;
  self.open(url, '_blank');
}

function onClickBufferedRange(event) {
  const canvas = document.querySelector('#bufferedCanvas');
  const target =
    ((event.clientX - canvas.offsetLeft) / canvas.width) * getSeekableEnd();
  video.currentTime = target;
}

function getSeekableEnd() {
  if (isFinite(video.duration)) {
    return video.duration;
  }
  if (video.seekable.length) {
    return video.seekable.end(video.seekable.length - 1);
  }
  return 0;
}

function getLevelButtonHtml(key, levels, onclickReplace, autoEnabled) {
  const onclickAuto = `${key}=-1`.replace(/^(\w+)=([^=]+)$/, onclickReplace);
  const codecs = levels.reduce((uniqueCodecs, level) => {
    const levelCodecs = codecs2label(level.attrs.CODECS);
    if (levelCodecs && uniqueCodecs.indexOf(levelCodecs) === -1) {
      uniqueCodecs.push(levelCodecs);
    }
    return uniqueCodecs;
  }, []);
  return (
    `<button type="button" class="btn btn-sm ${
      autoEnabled ? 'btn-primary' : 'btn-success'
    }" onclick="${onclickAuto}">auto</button>` +
    levels
      .map((level, i) => {
        const enabled = hls[key] === i;
        const onclick = `${key}=${i}`.replace(/^(\w+)=(\w+)$/, onclickReplace);
        const label = level2label(levels[i], i, codecs);
        return `<button type="button" class="btn btn-sm ${
          enabled ? 'btn-primary' : 'btn-success'
        }" onclick="${onclick}">${label}</button>`;
      })
      .join('')
  );
}

function updateLevelInfo() {
  const levels = hls.levels;
  if (!levels) {
    return;
  }

  const htmlCurrentLevel = getLevelButtonHtml(
    'currentLevel',
    levels,
    'hls.$1=$2',
    hls.autoLevelEnabled
  );
  const htmlNextLevel = getLevelButtonHtml(
    'nextLevel',
    levels,
    'hls.$1=$2',
    hls.autoLevelEnabled
  );
  const htmlLoadLevel = getLevelButtonHtml(
    'loadLevel',
    levels,
    'hls.$1=$2',
    hls.autoLevelEnabled
  );
  const htmlCapLevel = getLevelButtonHtml(
    'autoLevelCapping',
    levels,
    'levelCapping=hls.$1=$2;updateLevelInfo();onDemoConfigChanged();',
    hls.autoLevelCapping === -1
  );

  if ($('#currentLevelControl').html() !== htmlCurrentLevel) {
    $('#currentLevelControl').html(htmlCurrentLevel);
  }

  if ($('#nextLevelControl').html() !== htmlNextLevel) {
    $('#nextLevelControl').html(htmlNextLevel);
  }

  if ($('#loadLevelControl').html() !== htmlLoadLevel) {
    $('#loadLevelControl').html(htmlLoadLevel);
  }

  if ($('#levelCappingControl').html() !== htmlCapLevel) {
    $('#levelCappingControl').html(htmlCapLevel);
  }
}

function updateAudioTrackInfo() {
  const buttonTemplate = '<button type="button" class="btn btn-sm ';
  const buttonEnabled = 'btn-primary" ';
  const buttonDisabled = 'btn-success" ';
  let html1 = '';
  const audioTrackId = hls.audioTrack;
  const len = hls.audioTracks.length;
  const track = hls.audioTracks[audioTrackId];

  for (let i = 0; i < len; i++) {
    html1 += buttonTemplate;
    if (audioTrackId === i) {
      html1 += buttonEnabled;
    } else {
      html1 += buttonDisabled;
    }

    html1 +=
      'onclick="hls.audioTrack=' +
      i +
      '">' +
      hls.audioTracks[i].name +
      '</button>';
  }

  $('#audioTrackLabel').text(
    track ? track.lang || track.name : 'None selected'
  );
  $('#audioTrackControl').html(html1);
}

function codecs2label(levelCodecs) {
  if (levelCodecs) {
    return levelCodecs
      .replace(/([ah]vc.)[^,;]+/, '$1')
      .replace('mp4a.40.2', 'mp4a');
  }
  return '';
}

function level2label(level, i, manifestCodecs) {
  const levelCodecs = codecs2label(level.attrs.CODECS);
  const levelNameInfo = level.name ? `"${level.name}": ` : '';
  const codecInfo =
    levelCodecs && manifestCodecs.length > 1 ? ` / ${levelCodecs}` : '';
  if (level.height) {
    return `${i} (${levelNameInfo}${level.height}p / ${Math.round(
      level.bitrate / 1024
    )}kb${codecInfo})`;
  }
  if (level.bitrate) {
    return `${i} (${levelNameInfo}${Math.round(
      level.bitrate / 1024
    )}kb${codecInfo})`;
  }
  if (codecInfo) {
    return `${i} (${levelNameInfo}${levelCodecs})`;
  }
  if (level.name) {
    return `${i} (${level.name})`;
  }
  return `${i}`;
}

function getDemoConfigPropOrDefault(propName, defaultVal) {
  return typeof demoConfig[propName] !== 'undefined'
    ? demoConfig[propName]
    : defaultVal;
}

function getURLParam(sParam, defaultValue) {
  const sPageURL = self.location.search.substring(1);
  const sURLVariables = sPageURL.split('&');
  for (let i = 0; i < sURLVariables.length; i++) {
    const sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] === sParam) {
      return sParameterName[1] === 'undefined'
        ? undefined
        : sParameterName[1] === 'false'
        ? false
        : sParameterName[1];
    }
  }
  return defaultValue;
}

function onDemoConfigChanged(firstLoad) {
  demoConfig = {
    enableStreaming,
    autoRecoverError,
    stopOnStall,
    dumpfMP4,
    levelCapping,
    limitMetrics,
  };

  if (configPersistenceEnabled) {
    persistEditorValue();
  }

  const serializedDemoConfig = btoa(JSON.stringify(demoConfig));
  const baseURL = document.URL.split('?')[0];
  const streamURL = $('#streamURL').val();
  const permalinkURL = `${baseURL}?src=${encodeURIComponent(
    streamURL
  )}&demoConfig=${serializedDemoConfig}`;

  $('#StreamPermalink').html(`<a href="${permalinkURL}">${permalinkURL}</a>`);
  if (!firstLoad && window.location.href !== permalinkURL) {
    window.history.pushState(null, null, permalinkURL);
  }
}

function onConfigPersistenceChanged(event) {
  configPersistenceEnabled = event.target.checked;
  localStorage.setItem(
    STORAGE_KEYS.Editor_Persistence,
    JSON.stringify(configPersistenceEnabled)
  );

  if (configPersistenceEnabled) {
    persistEditorValue();
  } else {
    localStorage.removeItem(STORAGE_KEYS.Hls_Config);
  }
}

function getEditorValue(options) {
  options = $.extend({ parse: false }, options || {});
  let value = configEditor.session.getValue();

  if (options.parse) {
    try {
      value = JSON.parse(value);
    } catch (e) {
      console.warn('[getEditorValue] could not parse editor value', e);
      value = {};
    }
  }

  return value;
}

function getPersistedHlsConfig() {
  let value = localStorage.getItem(STORAGE_KEYS.Hls_Config);
  if (value === null) {
    return value;
  }

  try {
    value = JSON.parse(value);
  } catch (e) {
    console.warn('[getPersistedHlsConfig] could not hls config json', e);
    value = {};
  }

  return value;
}

function persistEditorValue() {
  localStorage.setItem(STORAGE_KEYS.Hls_Config, getEditorValue());
}

function setupConfigEditor() {
  configEditor = self.ace.edit('config-editor');
  configEditor.setTheme('ace/theme/github');
  configEditor.session.setMode('ace/mode/json');

  const contents = hlsjsDefaults;
  const shouldRestorePersisted =
    JSON.parse(localStorage.getItem(STORAGE_KEYS.Editor_Persistence)) === true;

  if (shouldRestorePersisted) {
    $.extend(contents, getPersistedHlsConfig());
  }

  const elPersistence = document.querySelector('#config-persistence');
  elPersistence.addEventListener('change', onConfigPersistenceChanged);
  elPersistence.checked = shouldRestorePersisted;
  configPersistenceEnabled = shouldRestorePersisted;

  updateConfigEditorValue(contents);
}

function setupTimelineChart() {
  const canvas = document.querySelector('#timeline-chart');
  const chart = new TimelineChart(canvas, {
    responsive: false,
  });

  resizeHandlers.push(() => {
    chart.resize();
  });

  chart.resize();

  return chart;
}

function addChartEventListeners(hls) {
  const updateLevelOrTrack = (eventName, data) => {
    chart.updateLevelOrTrack(data.details);
  };
  const updateFragment = (eventName, data) => {
    if (data.stats) {
      // Convert 0.x stats to partial v1 stats
      const { retry, loaded, total, trequest, tfirst, tload } = data.stats;
      if (trequest && tload) {
        data.frag.stats = {
          loaded,
          retry,
          total,
          loading: {
            start: trequest,
            first: tfirst,
            end: tload,
          },
        };
      }
    }
    chart.updateFragment(data);
  };
  const updateChart = () => {
    chart.update();
  };
  hls.on(
    Hls.Events.MANIFEST_LOADING,
    () => {
      chart.reset();
    },
    chart
  );
  hls.on(
    Hls.Events.MANIFEST_PARSED,
    (eventName, data) => {
      const { levels } = data;
      chart.removeType('level');
      chart.removeType('audioTrack');
      chart.removeType('subtitleTrack');
      chart.updateLevels(levels);
    },
    chart
  );
  hls.on(
    Hls.Events.BUFFER_CREATED,
    (eventName, { tracks }) => {
      chart.updateSourceBuffers(tracks, hls.media);
    },
    chart
  );
  hls.on(
    Hls.Events.BUFFER_RESET,
    () => {
      chart.removeSourceBuffers();
    },
    chart
  );
  hls.on(Hls.Events.LEVELS_UPDATED, (eventName, { levels }) => {
    chart.removeType('level');
    chart.updateLevels(levels);
  });
  hls.on(
    Hls.Events.LEVEL_SWITCHED,
    (eventName, { level }) => {
      chart.removeType('level');
      chart.updateLevels(hls.levels, level);
    },
    chart
  );
  hls.on(
    Hls.Events.LEVEL_LOADING,
    () => {
      // TODO: mutate level datasets
      // Update loadLevel
      chart.removeType('level');
      chart.updateLevels(hls.levels);
    },
    chart
  );
  hls.on(
    Hls.Events.LEVEL_UPDATED,
    (eventName, { details }) => {
      chart.updateLevelOrTrack(details);
    },
    chart
  );

  hls.on(
    Hls.Events.AUDIO_TRACKS_UPDATED,
    (eventName, { audioTracks }) => {
      chart.removeType('audioTrack');
      chart.updateAudioTracks(audioTracks);
    },
    chart
  );
  hls.on(
    Hls.Events.SUBTITLE_TRACKS_UPDATED,
    (eventName, { subtitleTracks }) => {
      chart.removeType('subtitleTrack');
      chart.updateSubtitleTracks(subtitleTracks);
    },
    chart
  );

  hls.on(
    Hls.Events.AUDIO_TRACK_SWITCHED,
    (eventName) => {
      // TODO: mutate level datasets
      chart.removeType('audioTrack');
      chart.updateAudioTracks(hls.audioTracks);
    },
    chart
  );
  hls.on(
    Hls.Events.SUBTITLE_TRACK_SWITCH,
    (eventName) => {
      // TODO: mutate level datasets
      chart.removeType('subtitleTrack');
      chart.updateSubtitleTracks(hls.subtitleTracks);
    },
    chart
  );
  hls.on(Hls.Events.AUDIO_TRACK_LOADED, updateLevelOrTrack, chart);
  hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, updateLevelOrTrack, chart);
  hls.on(Hls.Events.LEVEL_PTS_UPDATED, updateLevelOrTrack, chart);
  hls.on(Hls.Events.FRAG_LOADED, updateFragment, chart);
  hls.on(Hls.Events.FRAG_PARSED, updateFragment, chart);
  hls.on(Hls.Events.FRAG_CHANGED, updateFragment, chart);
  hls.on(Hls.Events.BUFFER_APPENDING, updateChart, chart);
  hls.on(Hls.Events.BUFFER_APPENDED, updateChart, chart);
  hls.on(Hls.Events.BUFFER_FLUSHED, updateChart, chart);
}

function updateConfigEditorValue(obj) {
  const json = JSON.stringify(obj, null, 2);
  configEditor.session.setValue(json);
}

function applyConfigEditorValue() {
  onDemoConfigChanged();
  loadSelectedStream();
}

function createfMP4(type) {
  if (fmp4Data[type].length) {
    const blob = new Blob([arrayConcat(fmp4Data[type])], {
      type: 'application/octet-stream',
    });
    const filename = type + '-' + new Date().toISOString() + '.mp4';
    self.saveAs(blob, filename);
    // $('body').append('<a download="hlsjs-' + filename + '" href="' + self.URL.createObjectURL(blob) + '">Download ' + filename + ' track</a><br>');
  } else if (!dumpfMP4) {
    console.error(
      'Check "Dump transmuxed fMP4 data" first to make appended media available for saving.'
    );
  }
}

function arrayConcat(inputArray) {
  const totalLength = inputArray.reduce(function (prev, cur) {
    return prev + cur.length;
  }, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  inputArray.forEach(function (element) {
    result.set(element, offset);
    offset += element.length;
  });
  return result;
}

function hideAllTabs() {
  $('.demo-tab-btn').css('background-color', '');
  $('.demo-tab').hide();
}

function toggleTabClick(btn) {
  toggleTab(btn);
  const tabIndexes = $('.demo-tab-btn')
    .toArray()
    .map((el, i) => ($('#' + $(el).data('tab')).is(':visible') ? i : null))
    .filter((i) => i !== null);
  localStorage.setItem(STORAGE_KEYS.demo_tabs, tabIndexes.join(','));
}

function toggleTab(btn, dontHideOpenTabs) {
  const tabElId = $(btn).data('tab');
  // eslint-disable-next-line no-restricted-globals
  const modifierPressed =
    dontHideOpenTabs ||
    (self.event && (self.event.metaKey || self.event.shiftKey));
  if (!modifierPressed) {
    hideAllTabs();
  }
  if (modifierPressed) {
    $(`#${tabElId}`).toggle();
  } else {
    $(`#${tabElId}`).show();
  }
  $(btn).css(
    'background-color',
    $(`#${tabElId}`).is(':visible') ? 'orange' : ''
  );
  if (!$('#statsDisplayTab').is(':visible')) {
    self.hideMetrics();
  }
  if (hls) {
    if ($('#timelineTab').is(':visible')) {
      chart.show();
      chart.resize(chart.chart.data ? chart.chart.data.datasets : null);
    } else {
      chart.hide();
    }
  }
}

function appendLog(textElId, message) {
  const el = $('#' + textElId);
  let logText = el.text();
  if (logText.length) {
    logText += '\n';
  }
  const timestamp = (Date.now() - startTime) / 1000;
  const newMessage = timestamp + ' | ' + message;
  logText += newMessage;
  // update
  el.text(logText);
  const element = el[0];
  element.scrollTop = element.scrollHeight - element.clientHeight;
}

function logStatus(message) {
  appendLog('statusOut', message);
}

function logError(message) {
  appendLog('errorOut', message);
}
