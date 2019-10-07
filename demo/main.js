import {sortObject, copyTextToClipboard} from './demo-utils'

const STORAGE_KEYS = {
  Editor_Persistence: 'hlsjs:config-editor-persist',
  Hls_Config        : 'hlsjs:config'
};

const testStreams = require('../tests/test-streams');
const defaultTestStreamUrl = testStreams['bbb'].url;
const sourceURL = decodeURIComponent(getURLParam('src', defaultTestStreamUrl))

let demoConfig = getURLParam('demoConfig', null)
if (demoConfig) {
  demoConfig = JSON.parse(atob(demoConfig))
} else {
  demoConfig = {}
}

const hlsjsDefaults = {
  debug: true,
  enableWorker: true
};

let enableStreaming = getDemoConfigPropOrDefault('enableStreaming', true);
let autoRecoverError = getDemoConfigPropOrDefault('autoRecoverError', true);
let levelCapping = getDemoConfigPropOrDefault('levelCapping', -1);
let limitMetrics = getDemoConfigPropOrDefault('limitMetrics', -1);
let dumpfMP4 = getDemoConfigPropOrDefault('dumpfMP4', false);

let bufferingIdx = -1;
let selectedTestStream = null;
let video = $('#video')[0];
let startTime = Date.now()

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

$(document).ready(function() {
  setupConfigEditor();

  Object.keys(testStreams).forEach((key) => {
    const stream = testStreams[key];
    const option = new Option(stream.description, key);
    $('#streamSelect').append(option);
  })

  $('#streamSelect').change(function() {
    selectedTestStream = testStreams[$('#streamSelect').val()];
    const streamUrl = selectedTestStream.url;
    $('#streamURL').val(streamUrl);
    loadSelectedStream();
  });

  $('#streamURL').change(function() {
    selectedTestStream = null;
    loadSelectedStream();
  });

  $('#videoSize').change(function() {
    $('#video').width($('#videoSize').val());
    $('#bufferedCanvas').width($('#videoSize').val());
  });

  $('#enableStreaming').click(function() {
    enableStreaming = this.checked;
    loadSelectedStream();
  });

  $('#autoRecoverError').click(function() {
    autoRecoverError = this.checked;
    onDemoConfigChanged();
  });

  $('#dumpfMP4').click(function() {
    dumpfMP4 = this.checked;
    onDemoConfigChanged();
  });

  $('#limitMetrics').change(function() {
    limitMetrics = this.value;
    onDemoConfigChanged();
  })

  $('#levelCapping').change(function() {
    levelCapping = this.value;
    onDemoConfigChanged();
  });

  $('#limitMetrics').val(limitMetrics);
  $('#enableStreaming').prop('checked', enableStreaming );
  $('#autoRecoverError').prop('checked', autoRecoverError );
  $('#dumpfMP4').prop('checked', dumpfMP4 );
  $('#levelCapping').val(levelCapping);

  $('h2').append('&nbsp;<a target=_blank href=https://github.com/video-dev/hls.js/releases/tag/v' + Hls.version + '>v' + Hls.version + '</a>');
  $('#currentVersion').html('Hls version:' + Hls.version);

  $('#streamURL').val(sourceURL)

  video.volume = 0.05;

  hideAllTabs();

  $('#metricsButtonWindow').toggle(windowSliding);
  $('#metricsButtonFixed').toggle(!windowSliding);

  loadSelectedStream();

});

function setupGlobals() {
  window.events = events = {
    url    : url,
    t0     : performance.now(),
    load   : [],
    buffer : [],
    video  : [],
    level  : [],
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
  window.applyConfigEditorValue = applyConfigEditorValue;
}

function trimArray( target, limit ) {
  if( limit < 0 ) {
    return;
  }

  while(target.length > limit )
  {
    target.shift();
  }
}

function trimEventHistory() {
  const x = limitMetrics;

  if(x < 0) {
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

  url = $('#streamURL').val()

  setupGlobals();
  hideCanvas();

  if(hls) {
    hls.destroy();
    if(hls.bufferTimer) {
      clearInterval(hls.bufferTimer);
      hls.bufferTimer = undefined;
    }
    hls = null;
  }

  if(!enableStreaming) {
    logStatus('Streaming disabled');
    return;
  }

  logStatus('Loading ' + url);


  // Extending both a demo-specific config and the user config which can override all
  const hlsConfig = $.extend({}, hlsjsDefaults, getEditorValue({ parse: true }));

  if (selectedTestStream && selectedTestStream.config) {
    console.info('[loadSelectedStream] extending hls config with stream-specific config: ', selectedTestStream.config);
    $.extend(hlsConfig, selectedTestStream.config);
    updateConfigEditorValue(hlsConfig);
  }

  onDemoConfigChanged();
  console.log('Using Hls.js config:', hlsConfig);

  window.hls = hls = new Hls(hlsConfig);

  logStatus('Loading manifest and attaching video element...');

  hls.loadSource(url);
  hls.autoLevelCapping = levelCapping;
  hls.attachMedia(video);

  hls.on(Hls.Events.MEDIA_ATTACHED, function() {
    logStatus('Media element attached');
    bufferingIdx = -1;
    events.video.push({
      time: performance.now() - events.t0,
      type: 'Media attached'
    });
    trimEventHistory();
  });

  hls.on(Hls.Events.MEDIA_DETACHED, function() {
    logStatus('Media element detached');
    bufferingIdx = -1;
    tracks = [];
    events.video.push({
      time: performance.now() - events.t0,
      type: 'Media detached'
    });
    trimEventHistory();
  });

  hls.on(Hls.Events.FRAG_PARSING_INIT_SEGMENT, function(event, data) {
    showCanvas();
    var event = {
      time: performance.now() - events.t0,
      type: data.id + ' init segment'
    };
    events.video.push(event);
    trimEventHistory();
  });

  hls.on(Hls.Events.FRAG_PARSING_METADATA, function(event, data) {
    //console.log("Id3 samples ", data.samples);
  });

  hls.on(Hls.Events.LEVEL_SWITCHING, function(event, data) {
    events.level.push({
      time   : performance.now() - events.t0,
      id     : data.level,
      bitrate: Math.round(hls.levels[data.level].bitrate/1000)
    });
    trimEventHistory();
    updateLevelInfo();
  });

  hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
    var event = {
      type    : 'manifest',
      name    : '',
      start   : 0,
      end     : data.levels.length,
      time    : data.stats.trequest - events.t0,
      latency : data.stats.tfirst - data.stats.trequest,
      load    : data.stats.tload - data.stats.tfirst,
      duration: data.stats.tload - data.stats.tfirst,
    };
    events.load.push(event);
    trimEventHistory();
    refreshCanvas();
  });

  hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
    logStatus('No of quality levels found: ' + hls.levels.length);
    logStatus('Manifest successfully loaded');
    stats = {
      levelNb    : data.levels.length,
      levelParsed: 0
    };
    trimEventHistory();
    updateLevelInfo();
  });

  hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function(event, data) {
    logStatus('No of audio tracks found: ' + data.audioTracks.length);
    updateAudioTrackInfo();
  });

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, function(event, data) {
    logStatus('Audio track switching...');
    updateAudioTrackInfo();
    var event = {
      time: performance.now() - events.t0,
      type: 'audio switching',
      name: '@' + data.id
    };
    events.video.push(event);
    trimEventHistory();
    lastAudioTrackSwitchingIdx = events.video.length-1;
  });

  hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, function(event, data) {
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

  hls.on(Hls.Events.LEVEL_LOADED, function(event, data) {
    events.isLive = data.details.live;
    var event = {
      type    : 'level',
      id      : data.level,
      start   : data.details.startSN,
      end     : data.details.endSN,
      time    : data.stats.trequest - events.t0,
      latency : data.stats.tfirst - data.stats.trequest,
      load    : data.stats.tload - data.stats.tfirst,
      parsing : data.stats.tparsed - data.stats.tload,
      duration: data.stats.tload - data.stats.tfirst
    };
    const parsingDuration = data.stats.tparsed - data.stats.tload;
    if (stats.levelParsed)
    {this.sumLevelParsingMs += parsingDuration;}
    else
    {this.sumLevelParsingMs = parsingDuration;}

    stats.levelParsed++;
    stats.levelParsingUs = Math.round(1000*this.sumLevelParsingMs / stats.levelParsed);

    //console.log('parsing level duration :' + stats.levelParsingUs + 'us,count:' + stats.levelParsed);

    events.load.push(event);
    trimEventHistory();
    refreshCanvas();
  });

  hls.on(Hls.Events.AUDIO_TRACK_LOADED, function(event, data) {
    events.isLive = data.details.live;
    var event = {
      type    : 'audio track',
      id      : data.id,
      start   : data.details.startSN,
      end     : data.details.endSN,
      time    : data.stats.trequest - events.t0,
      latency : data.stats.tfirst - data.stats.trequest,
      load    : data.stats.tload - data.stats.tfirst,
      parsing : data.stats.tparsed - data.stats.tload,
      duration: data.stats.tload - data.stats.tfirst
    };
    events.load.push(event);
    trimEventHistory();
    refreshCanvas();
  });

  hls.on(Hls.Events.FRAG_BUFFERED, function(event, data) {
    var event = {
      type    : data.frag.type + ' fragment',
      id      : data.frag.level,
      id2     : data.frag.sn,
      time    : data.stats.trequest - events.t0,
      latency : data.stats.tfirst - data.stats.trequest,
      load    : data.stats.tload - data.stats.tfirst,
      parsing : data.stats.tparsed - data.stats.tload,
      buffer  : data.stats.tbuffered - data.stats.tparsed,
      duration: data.stats.tbuffered - data.stats.tfirst,
      bw      : Math.round(8*data.stats.total/(data.stats.tbuffered - data.stats.trequest)),
      size    : data.stats.total
    };
    events.load.push(event);
    events.bitrate.push({
      time    : performance.now() - events.t0,
      bitrate : event.bw,
      duration: data.frag.duration,
      level   : event.id
    });
    if(hls.bufferTimer === undefined) {
      events.buffer.push({
        time  : 0,
        buffer: 0,
        pos   : 0
      });
      hls.bufferTimer = window.setInterval(checkBuffer, 100);
    }
    trimEventHistory();
    refreshCanvas();
    updateLevelInfo();

    let latency = data.stats.tfirst - data.stats.trequest,
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
    stats.fragparsingKbps = Math.round(8*stats.fragBufferedBytes / this.sumParsing);
    stats.fragparsingMs = Math.round(this.sumParsing);
    stats.autoLevelCappingLast = hls.autoLevelCapping;
  });

  hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
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

  hls.on(Hls.Events.FRAG_CHANGED, function(event, data) {
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

    let level = data.frag.level, autoLevel = data.frag.autoLevel;
    if (stats.levelStart === undefined)
    {stats.levelStart = level;}

    if (autoLevel) {
      if (stats.fragChangedAuto) {
        stats.autoLevelMin = Math.min(stats.autoLevelMin, level);
        stats.autoLevelMax = Math.max(stats.autoLevelMax, level);
        stats.fragChangedAuto++;
        if (this.levelLastAuto && level !== stats.autoLevelLast)
        {stats.autoLevelSwitch++;}

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
        if (!this.levelLastAuto && level !== stats.manualLevelLast)
        {stats.manualLevelSwitch++;}

      } else {
        stats.manualLevelMin = stats.manualLevelMax = level;
        stats.manualLevelSwitch = 0;
        stats.fragChangedManual = 1;
      }
      stats.manualLevelLast = level;
    }
    this.levelLastAuto = autoLevel;
  });

  hls.on(Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED, function(event, data) {
    if (stats) {
      if (stats.fragLoadEmergencyAborted === undefined)
      {stats.fragLoadEmergencyAborted = 1;}
      else
      {stats.fragLoadEmergencyAborted++;}

    }
  });

  hls.on(Hls.Events.FRAG_DECRYPTED, function(event, data) {
    if (!stats.fragDecrypted) {
      stats.fragDecrypted = 0;
      this.totalDecryptTime = 0;
      stats.fragAvgDecryptTime = 0;
    }
    stats.fragDecrypted++;
    this.totalDecryptTime += data.stats.tdecrypt - data.stats.tstart;
    stats.fragAvgDecryptTime = this.totalDecryptTime / stats.fragDecrypted;
  });

  hls.on(Hls.Events.ERROR, function(event, data) {
    console.warn('Error event:', data);
    switch(data.details) {
      case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
        try {
          $('#errorOut').html('Cannot load <a href="' + data.context.url + '">' + url + '</a><br>HTTP response code:' + data.response.code + ' <br>' + data.response.text);
          if(data.response.code === 0){
            $('#errorOut').append('This might be a CORS issue, consider installing <a href="https://chrome.google.com/webstore/detail/allow-control-allow-origi/nlfbmbojpeacfghkpbjhddihlkkiljbi">Allow-Control-Allow-Origin</a> Chrome Extension');
          }
        } catch(err) {
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
    if(data.fatal) {
      console.error('Fatal error :' + data.details);
      switch(data.type) {
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
    if(!stats) {
      stats = {};
    }
    // track all errors independently
    if (stats[data.details] === undefined)
    {stats[data.details] = 1;}
    else
    {stats[data.details] += 1;}

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

  hls.on(Hls.Events.BUFFER_CREATED, function(event, data) {
    tracks = data.tracks;
  });

  hls.on(Hls.Events.BUFFER_APPENDING, function(event, data) {
    if (dumpfMP4) {
      fmp4Data[data.type].push(data.data);
    }
  });

  hls.on(Hls.Events.FPS_DROP, function(event, data) {
    let evt = {
      time: performance.now() - events.t0,
      type: 'frame drop',
      name: data.currentDropped + '/' + data.currentDecoded
    };
    events.video.push(evt);
    trimEventHistory();
    if (stats) {
      if (stats.fpsDropEvent === undefined)
      {stats.fpsDropEvent = 1;}
      else
      {stats.fpsDropEvent++;}

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
  if(navigator.userAgent.toLowerCase().indexOf('firefox') !== -1) {
    logStatus('You are using Firefox, it looks like MediaSource is not enabled,<br>please ensure the following keys are set appropriately in <b>about:config</b><br>media.mediasource.enabled=true<br>media.mediasource.mp4.enabled=true<br><b>media.mediasource.whitelist=false</b>');
  } else {
    logStatus('Your Browser does not support MediaSourceExtension / MP4 mediasource');
  }
}

function handleVideoEvent(evt) {
  let data = '';
  switch(evt.type) {
    case 'durationchange':
      if(evt.target.duration - lastDuration <= 0.5) {
        // some browsers report several duration change events with almost the same value ... avoid spamming video events
        return;
      }
      lastDuration = evt.target.duration;
      data = Math.round(evt.target.duration*1000);
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
      data = Math.round(evt.target.currentTime*1000);
      if(evt.type === 'error') {
        let errorTxt, mediaError=evt.currentTarget.error;
        switch(mediaError.code) {
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

  let event = {
    time: performance.now() - events.t0,
    type: evt.type,
    name: data
  };

  events.video.push(event);
  if(evt.type === 'seeking') {
    lastSeekingIdx = events.video.length-1;
  }

  if(evt.type === 'seeked') {
    events.video[lastSeekingIdx].duration = event.time - events.video[lastSeekingIdx].time;
  }

  trimEventHistory();
}

function handleMediaError() {
  if(autoRecoverError) {
    let now = performance.now();
    if(!recoverDecodingErrorDate || (now - recoverDecodingErrorDate) > 3000) {
      recoverDecodingErrorDate = performance.now();
      $('#statusOut').append(', trying to recover media error.');
      hls.recoverMediaError();
    } else {
      if(!recoverSwapAudioCodecDate || (now - recoverSwapAudioCodecDate) > 3000) {
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
  let log = '';
  for (let i=0; i<r.length; i++) {
    log += '[' + r.start(i) + ', ' + r.end(i) + ']';
    log += ' ';
  }
  return log;
}

function checkBuffer() {
  let v = $('#video')[0];
  let canvas = $('#bufferedCanvas')[0];
  let ctx = canvas.getContext('2d');
  let r = v.buffered;
  let bufferingDuration;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'gray';
  if (r) {
    if(!canvas.width || canvas.width !== v.clientWidth)
    {canvas.width = v.clientWidth;}

    var pos = v.currentTime, bufferLen;
    for (var i=0, bufferLen=0; i<r.length; i++) {
      let start = r.start(i)/v.duration * canvas.width;
      let end = r.end(i)/v.duration * canvas.width;
      ctx.fillRect(start, 3, Math.max(2, end-start), 10);
      if(pos >= r.start(i) && pos < r.end(i)) {
        // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
        bufferLen = r.end(i) - pos;
      }
    }
    // check if we are in buffering / or playback ended state
    if(bufferLen <= 0.1 && v.paused === false && (pos-lastStartPosition) > 0.5) {
      // don't create buffering event if we are at the end of the playlist, don't report ended for live playlist
      if(lastDuration -pos <= 0.5  && events.isLive === false) {
      } else {
        // we are not at the end of the playlist ... real buffering
        if(bufferingIdx !== -1) {
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
          bufferingIdx = events.video.length-1;
        }
      }
    }

    if(bufferLen > 0.1 && bufferingIdx !=-1) {
      bufferingDuration = performance.now() - events.t0 - events.video[bufferingIdx].time;
      events.video[bufferingIdx].duration = bufferingDuration;
      events.video[bufferingIdx].name = bufferingDuration;
      // we are out of buffering state
      bufferingIdx = -1;
    }

    // update buffer/position for current Time
    let event = {
      time  : performance.now() - events.t0,
      buffer: Math.round(bufferLen*1000),
      pos   : Math.round(pos*1000)
    };
    let bufEvents = events.buffer, bufEventLen = bufEvents.length;
    if(bufEventLen > 1) {
      let event0 = bufEvents[bufEventLen-2], event1 = bufEvents[bufEventLen-1];
      let slopeBuf0 = (event0.buffer - event1.buffer)/(event0.time-event1.time);
      let slopeBuf1 = (event1.buffer - event.buffer)/(event1.time-event.time);

      let slopePos0 = (event0.pos - event1.pos)/(event0.time-event1.time);
      let slopePos1 = (event1.pos - event.pos)/(event1.time-event.time);
      // compute slopes. if less than 30% difference, remove event1
      if((slopeBuf0 === slopeBuf1 || Math.abs(slopeBuf0/slopeBuf1 -1) <= 0.3) &&
           (slopePos0 === slopePos1 || Math.abs(slopePos0/slopePos1 -1) <= 0.3))
      {bufEvents.pop();}

    }
    events.buffer.push(event);
    trimEventHistory();
    refreshCanvas();

    let log = 'Duration: '
              + v.duration + '\n'
              + 'Buffered: '
              + timeRangesToString(v.buffered) + '\n'
              + 'Seekable: '
              + timeRangesToString(v.seekable) + '\n'
              + 'Played: '
              + timeRangesToString(v.played) + '\n';

    if (hls.media) {
      for(let type in tracks) {
        log += 'Buffer for ' + type + ' contains: ' + timeRangesToString(tracks[type].buffer.buffered) + '\n';
      }

      const videoPlaybackQuality = v.getVideoPlaybackQuality;
      if(videoPlaybackQuality && typeof (videoPlaybackQuality) === typeof (Function)) {
        log += 'Dropped frames: '+ v.getVideoPlaybackQuality().droppedVideoFrames + '\n';
        log += 'Corrupted frames:'+ v.getVideoPlaybackQuality().corruptedVideoFrames + '\n';
      } else if(v.webkitDroppedFrameCount) {
        log+='Dropped frames:'+ v.webkitDroppedFrameCount + '\n';
      }
    }
    $('#bufferedOut').text(log);

    $('#statisticsOut').text(JSON.stringify(sortObject(stats), null, '\t'));

    ctx.fillStyle = 'blue';

    const x = v.currentTime / v.duration * canvas.width;
    ctx.fillRect(x, 0, 2, 15);
  }

}

function showCanvas()  {
  showMetrics();
  $('#bufferedOut').show();
  $('#bufferedCanvas').show();
}

function hideCanvas()  {
  hideMetrics();
  $('#bufferedOut').hide();
  $('#bufferedCanvas').hide();
}

function getMetrics() {
  let json = JSON.stringify(events);
  let jsonpacked = jsonpack.pack(json);
  // console.log('packing JSON from ' + json.length + ' to ' + jsonpacked.length + ' bytes');
  return btoa(jsonpacked);
}

function copyMetricsToClipBoard() {
  copyTextToClipboard(getMetrics());
}

function goToMetrics() {
  let url = document.URL;
  url = url.substr(0, url.lastIndexOf('/')+1) + 'metrics.html';
  window.open(url, '_blank');
}

function goToMetricsPermaLink() {
  let url = document.URL;
  let b64 = getMetrics();
  url = url.substr(0, url.lastIndexOf('/')+1) + 'metrics.html#data=' + b64;
  window.open(url, '_blank');
}

function minsecs(ts) {
  let m = Math.floor(Math.floor(ts % 3600) / 60);
  let s = Math.floor(ts % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function onClickBufferedRange(event) {
  let canvas = $('#bufferedCanvas')[0];
  let v = $('#video')[0];
  let target = (event.clientX - canvas.offsetLeft) / canvas.width * v.duration;
  v.currentTime = target;
}

function updateLevelInfo() {

  if (!hls.levels) {
    return;
  }

  let button_template = '<button type="button" class="btn btn-sm ';
  let button_enabled  = 'btn-primary" ';
  let button_disabled = 'btn-success" ';

  let html1 = button_template;
  if(hls.autoLevelEnabled) {
    html1 += button_enabled;
  } else {
    html1 += button_disabled;
  }

  html1 += 'onclick="hls.currentLevel=-1">auto</button>';

  let html2 = button_template;
  if(hls.autoLevelEnabled) {
    html2 += button_enabled;
  } else {
    html2 += button_disabled;
  }

  html2 += 'onclick="hls.loadLevel=-1">auto</button>';

  let html3 = button_template;
  if(hls.autoLevelCapping === -1) {
    html3 += button_enabled;
  } else {
    html3 += button_disabled;
  }

  html3 += 'onclick="levelCapping=hls.autoLevelCapping=-1;updateLevelInfo();onDemoConfigChanged();">auto</button>';

  let html4 = button_template;
  if(hls.autoLevelEnabled) {
    html4 += button_enabled;
  } else {
    html4 += button_disabled;
  }

  html4 += 'onclick="hls.nextLevel=-1">auto</button>';

  for (let i=0; i < hls.levels.length; i++) {
    html1 += button_template;
    if(hls.currentLevel === i) {
      html1 += button_enabled;
    } else {
      html1 += button_disabled;
    }

    let levelName = i;
    let label = level2label(i);
    if(label) {
      levelName += ' (' + level2label(i) + 'p)';
    }

    html1 += 'onclick="hls.currentLevel=' + i + '">' + levelName + '</button>';

    html2 += button_template;
    if(hls.loadLevel === i) {
      html2 += button_enabled;
    } else {
      html2 += button_disabled;
    }

    html2 += 'onclick="hls.loadLevel=' + i + '">' + levelName + '</button>';

    html3 += button_template;
    if(hls.autoLevelCapping === i) {
      html3 += button_enabled;
    } else {
      html3 += button_disabled;
    }

    html3 += 'onclick="levelCapping=hls.autoLevelCapping=' + i + ';updateLevelInfo();onDemoConfigChanged();">' + levelName + '</button>';

    html4 += button_template;
    if(hls.nextLevel === i) {
      html4 += button_enabled;
    } else {
      html4 += button_disabled;
    }

    html4 += 'onclick="hls.nextLevel=' + i + '">' + levelName + '</button>';
  }

  let v = $('#video')[0];

  if(v.videoWidth && v.videoHeight) {
    $('#currentResolution').html(v.videoWidth + ' x ' + v.videoHeight);
  }

  if($('#currentLevelControl').html() != html1) {
    $('#currentLevelControl').html(html1);
  }

  if($('#loadLevelControl').html() != html2) {
    $('#loadLevelControl').html(html2);
  }

  if($('#levelCappingControl').html() != html3) {
    $('#levelCappingControl').html(html3);
  }

  if($('#nextLevelControl').html() != html4) {
    $('#nextLevelControl').html(html4);
  }
}

function updateAudioTrackInfo() {
  let button_template = '<button type="button" class="btn btn-sm ';
  let button_enabled  = 'btn-primary" ';
  let button_disabled = 'btn-success" ';
  let html1 = '';
  let audioTrackId = hls.audioTrack, len = hls.audioTracks.length;

  for (let i=0; i < len; i++) {
    html1 += button_template;
    if(audioTrackId === i) {
      html1 += button_enabled;
    } else {
      html1 += button_disabled;
    }

    html1 += 'onclick="hls.audioTrack=' + i + '">' + hls.audioTracks[i].name + '</button>';
  }
  $('#audioTrackControl').html(html1);
}

function level2label(index) {
  if(hls && hls.levels.length-1 >= index) {
    let level = hls.levels[index];
    if (level.name) {
      return level.name;
    } else {
      if (level.height) {
        return(level.height + 'p / ' + Math.round(level.bitrate / 1024) + 'kb');
      } else {
        if(level.bitrate) {
          return(Math.round(level.bitrate / 1024) + 'kb');
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
  let sPageURL = window.location.search.substring(1);
  let sURLVariables = sPageURL.split('&');
  for (let i = 0; i < sURLVariables.length; i++) {
    let sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] == sParam)
    {return 'undefined' == sParameterName[1] ? undefined : 'false' == sParameterName[1] ? false : sParameterName[1];}

  }
  return defaultValue;
}

function onDemoConfigChanged() {
  demoConfig = {
    enableStreaming,
    autoRecoverError,
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
  const permalinkURL = `${baseURL}?src=${encodeURIComponent(streamURL)}&demoConfig=${serializedDemoConfig}`;

  $('#StreamPermalink').html(`<a href="${permalinkURL}">${permalinkURL}</a>`);
}

function onConfigPersistenceChanged(event) {
  configPersistenceEnabled = event.target.checked;
  localStorage.setItem(STORAGE_KEYS.Editor_Persistence, JSON.stringify(configPersistenceEnabled));

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
  var value = localStorage.getItem(STORAGE_KEYS.Hls_Config);

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
  configEditor = ace.edit('config-editor');
  configEditor.setTheme('ace/theme/github');
  configEditor.session.setMode('ace/mode/json');

  const contents = hlsjsDefaults;
  const shouldRestorePersisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.Editor_Persistence)) === true;

  if (shouldRestorePersisted) {
    $.extend(contents, getPersistedHlsConfig());
  }

  const elPersistence = document.querySelector('#configPersistence');
  elPersistence.addEventListener('change', onConfigPersistenceChanged);
  elPersistence.checked = shouldRestorePersisted;
  configPersistenceEnabled = shouldRestorePersisted;

  updateConfigEditorValue(contents);
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
    let blob = new Blob([arrayConcat(fmp4Data[type])], {
      type: 'application/octet-stream'
    });
    let filename = type + '-' + new Date().toISOString() + '.mp4';
    saveAs(blob, filename);
    //$('body').append('<a download="hlsjs-' + filename + '" href="' + window.URL.createObjectURL(blob) + '">Download ' + filename + ' track</a><br>');
  }
}

function arrayConcat(inputArray) {
  let totalLength = inputArray.reduce( function(prev, cur) { return prev+cur.length; }, 0);
  let result = new Uint8Array(totalLength);
  let offset = 0;
  inputArray.forEach(function(element) {
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
  const el = $('#' + textElId)
  let logText = el.text()
  if (logText.length) {
    logText += '\n'
  }
  const timestamp = (Date.now() - startTime) / 1000
  const newMessage = timestamp + ' | ' + message
  logText += newMessage
  // update
  el.text(logText)
}

function logStatus(message) {
  appendLog('statusOut', message)
}

function logError(message) {
  appendLog('errorOut', message)
}
