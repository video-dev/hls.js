/* eslint camelcase: 0, no-console: 0 */

import { pack } from 'jsonpack';
import 'promise-polyfill/src/polyfill';
import testStreams from '../tests/test-streams';
import { sortObject, copyTextToClipboard } from './demo-utils';
import { TimelineChart } from './chart/timeline-chart';
import type Hls from '../src/hls';
import type {
  BufferAppendingData,
  ErrorDetails,
  Events,
  HlsAssetPlayer,
  HlsConfig,
  HlsListeners,
  InterstitialEvent,
  SourceBufferName,
} from '../src/hls';
import { registerInterstitialTimelineCanvas } from './interstitials-timeline-canvas';

declare const __CLOUDFLARE_PAGES__: { branch: string } | undefined;
declare const $: any;

declare global {
  interface Window {
    Hls: any;
    hls: Hls;
    activeVideo?: HTMLVideoElement;
    events: {
      url: string;
      t0: number;
      load: any[];
      buffer: any[];
      video: any[];
      level: any[];
      bitrate: any[];
      videoBufferStarvation: any[];
    };
    windowSliding?: boolean;
    recoverDecodingErrorDate: number | null;
    recoverSwapAudioCodecDate: number | null;
    fmp4Data: {
      audio: Uint8Array[];
      video: Uint8Array[];
    };
    fmp4DataInfo: {
      audio: (BufferAppendingData & { appendIndex?: number })[];
      video: (BufferAppendingData & { appendIndex?: number })[];
      index: number;
    };
    onClickBufferedRange: (event: Event) => void;
    updateLevelInfo: () => void;
    onDemoConfigChanged: () => void;
    createfMP4: (type: SourceBufferName) => void;
    goToMetricsPermaLink: () => void;
    toggleTab: (btn: HTMLButtonElement, dontHideOpenTabs?: boolean) => void;
    toggleTabClick: (btn: HTMLButtonElement) => void;
    applyConfigEditorValue: () => void;
    refreshCanvas: () => void;
    copyMetricsToClipBoard: () => void;
    goToMetrics: () => void;
    hideMetrics: () => void;
    showMetrics: () => void;
  }
}

const CLOUDFLARE_PAGES = __CLOUDFLARE_PAGES__; // replaced in build

const STORAGE_KEYS = {
  Editor_Persistence: 'hlsjs:config-editor-persist',
  Hls_Config: 'hlsjs:config',
  volume: 'hlsjs:volume',
  demo_tabs: 'hlsjs:demo-tabs',
};

// Object.entries(require('../tests/test-streams')).reduce(
//   (acc, [key, value]) => {
//     // Filter test streams
//     // if (value.audioTrackOptions) {
//     // if (value.subtitleTrackOptions) {
//     // if (value.ok) {
//       acc[key] = value;
//     // }
//     return acc;
//   },
//   {}
// );
const defaultTestStreamUrl = testStreams[Object.keys(testStreams)[0]].url;
const sourceURL = decodeURIComponent(getURLParam('src', defaultTestStreamUrl));

let demoConfig = getURLParam('demoConfig', null);
if (demoConfig) {
  demoConfig = JSON.parse(atob(demoConfig));
} else {
  demoConfig = {};
}

const hlsjsDefaults: Partial<HlsConfig> = {
  debug: true,
  enableWorker: true,
  lowLatencyMode: true,
  backBufferLength: 60 * 1.5,
};

const HlsEvents = self.Hls.Events as typeof Events;
const HlsErrorDetails = self.Hls.ErrorDetails as typeof ErrorDetails;

let enableStreaming = getDemoConfigPropOrDefault('enableStreaming', true);
let attachMediaOnStart = getDemoConfigPropOrDefault('attachMediaOnStart', true);
let autoRecoverError = getDemoConfigPropOrDefault('autoRecoverError', true);
let levelCapping = getDemoConfigPropOrDefault('levelCapping', -1);
let limitMetrics = getDemoConfigPropOrDefault('limitMetrics', -1);
let dumpfMP4 = getDemoConfigPropOrDefault('dumpfMP4', false);
let stopOnStall = getDemoConfigPropOrDefault('stopOnStall', false);
let videoHeight = getDemoConfigPropOrDefault(
  'videoHeight',
  $('.video-container').height() + 'px'
);
let interstitialElements = getDemoConfigPropOrDefault(
  'interstitialElements',
  'single'
);

let bufferingIdx = -1;
let selectedTestStream: { config?: Partial<HlsConfig>; url: string } | null =
  null;

const video = document.querySelector('#video') as HTMLVideoElement;
let interstitialVideos: HTMLVideoElement[] = [
  document.querySelector('#interstitial-b') as HTMLVideoElement,
  document.querySelector('#interstitial-a') as HTMLVideoElement,
].filter((el) => el !== null);
if (interstitialElements !== 'multiple') {
  interstitialVideos.forEach((el) => el.remove());
  interstitialVideos = [];
}

const bufferedCanvas = document.querySelector(
  '#bufferedCanvas'
) as HTMLCanvasElement;
const startTime = Date.now();

let activeVideo = (self.activeVideo = video);
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
let fmp4DataInfo;
let configPersistenceEnabled = false;
let configEditor: AceAjax.Editor | null = null;
let chart: TimelineChart;
let resizeAsyncCallbackId = -1;
let bufferAsyncCallbackId = -1;
let interstitialVideoZIndex = 1;
let liveAdvanceInterval = -1;
let interstitialsUpdated;

const requestAnimationFrame = self.requestAnimationFrame || self.setTimeout;
const cancelAnimationFrame = self.cancelAnimationFrame || self.clearTimeout;
const resizeHandlers: Function[] = [];
const resize = () => {
  cancelAnimationFrame(resizeAsyncCallbackId);
  resizeAsyncCallbackId = requestAnimationFrame(() => {
    resizeHandlers.forEach((handler) => {
      handler();
    });
  });
};
const updateBufferedCanvas = () => {
  cancelAnimationFrame(bufferAsyncCallbackId);
  bufferAsyncCallbackId = requestAnimationFrame(checkBuffer);
};

self.onresize = resize;
if (self.screen?.orientation) {
  self.screen.orientation.onchange = resize;
}

function updateMediaElementBounds(video, bounds) {
  $('#currentSize').html(
    `${Math.round(bounds.width * 10) / 10} x ${
      Math.round(bounds.height * 10) / 10
    }`
  );
  $(bufferedCanvas).width(Math.round(bounds.width));
  $(document.querySelector('#primaryCanvas')).width(Math.round(bounds.width));
  $(document.querySelector('#playoutCanvas')).width(Math.round(bounds.width));
  $(document.querySelector('#integratedCanvas')).width(
    Math.round(bounds.width)
  );
  if (video.videoWidth && video.videoHeight) {
    $('#currentResolution').html(`${video.videoWidth} x ${video.videoHeight}`);
  }
}

const playerResize = () => {
  const XO = self.IntersectionObserver;
  if (typeof XO !== 'undefined') {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const bounds = entry.boundingClientRect;
        updateMediaElementBounds(entry.target, bounds);
      }
      observer.disconnect();
    });
    observer.observe(activeVideo);
  } else {
    const bounds = activeVideo.getBoundingClientRect();
    updateMediaElementBounds(activeVideo, bounds);
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
      selectedTestStream = stream;
      document.title = `hls.js: ${(selectedTestStream as any).description || 'demo'}`;
      (
        document.querySelector('#streamSelect') as HTMLSelectElement
      ).selectedIndex = index + 1;
    }
  });

  if (videoHeight) {
    $('.video-container').height(videoHeight);
    $('#videoHeight option').each(function (i, option) {
      if (option.value === videoHeight) {
        (
          document.querySelector('#videoHeight') as HTMLSelectElement
        ).selectedIndex = i;
        resize();
        return false;
      }
    });
  }

  if (interstitialElements) {
    $('#interstitialElements option').each(function (i, option) {
      if (option.value === interstitialElements) {
        (
          document.querySelector('#interstitialElements') as HTMLSelectElement
        ).selectedIndex = i;
        return false;
      }
    });
  }

  $('#streamSelect').change(function () {
    const key = $('#streamSelect').val() || Object.keys(testStreams)[0];
    selectedTestStream = testStreams[key];
    if (selectedTestStream) {
      const streamUrl = selectedTestStream.url;
      document.title = `hls.js: ${(selectedTestStream as any).description || 'demo'}`;
      $('#streamURL').val(streamUrl);
      loadSelectedStream();
    }
  });

  $('#streamURL').change(function () {
    selectedTestStream = null;
    loadSelectedStream();
  });

  $('#videoHeight').change(function () {
    videoHeight = $('#videoHeight').val();
    $('.video-container').height(videoHeight);
    checkBuffer();
    resize();
    onDemoConfigChanged();
  });

  $('#interstitialElements').change(function () {
    interstitialElements = $('#interstitialElements').val();
    onDemoConfigChanged();
  });

  $('#attachMediaOnStart').click(function () {
    attachMediaOnStart = this.checked;
    loadSelectedStream();
  });

  $('#enableStreaming').click(function () {
    enableStreaming = this.checked;
    loadSelectedStream();
  });

  $('#attachMediaOnStart').click(function () {
    attachMediaOnStart = this.checked;
    onDemoConfigChanged();
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
  $('#attachMediaOnStart').prop('checked', attachMediaOnStart);
  $('#autoRecoverError').prop('checked', autoRecoverError);
  $('#stopOnStall').prop('checked', stopOnStall);
  $('#dumpfMP4').prop('checked', dumpfMP4);
  $('#levelCapping').val(levelCapping);

  // If cloudflare pages build link to branch
  // If not a stable tag link to npm
  // otherwise link to github tag
  function getVersionLink(version) {
    const noneStable = version.includes('-');
    if (CLOUDFLARE_PAGES) {
      return `https://github.com/video-dev/hls.js/tree/${encodeURIComponent(
        CLOUDFLARE_PAGES.branch
      )}`;
    } else if (noneStable) {
      return `https://www.npmjs.com/package/hls.js/v/${encodeURIComponent(
        version
      )}`;
    } else {
      return `https://github.com/video-dev/hls.js/releases/tag/v${encodeURIComponent(
        version
      )}`;
    }
  }

  const version = self.Hls.version;
  if (version) {
    const $a = $('<a />')
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .attr('href', getVersionLink(version))
      .text('v' + version);
    $('.title').append(' ').append($a);
  }

  $('#streamURL').val(sourceURL);

  const volumeJSON = localStorage.getItem(STORAGE_KEYS.volume);
  const volumeSettings = volumeJSON
    ? JSON.parse(volumeJSON)
    : {
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
  $(self).on('popstate', function () {
    self.location.reload();
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
    videoBufferStarvation: [],
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
  self.fmp4DataInfo = fmp4DataInfo = {
    audio: [],
    video: [],
    index: 0,
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
  trimArray(events.videoBufferStarvation, x);
}

function routeRelativeTestContentToImgDry(url: string) {
  const localTestRegEx = /^\/adaptive/;
  if (localTestRegEx.test(url) && location.host === 'imgdry.apple.com') {
    try {
      const resolved = new URL(
        url.replace(localTestRegEx, '.'),
        'https://imgdry.apple.com/users/rwalch/streams/hls/'
      );
      return resolved.href;
    } catch (error2) {
      /* no-op */
    }
  }
  return url;
}

function loadSelectedStream(options?) {
  $('#statusOut,#errorOut').empty();

  if (!self.Hls.isSupported()) {
    handleUnsupported();
    return;
  }

  url = $('#streamURL').val();
  interstitialsUpdated = null;

  // Check if the URL is valid to avoid XSS issue.
  if (url) {
    // Internal demo workaround for local/hosted content
    url = routeRelativeTestContentToImgDry(url);

    try {
      // Test relative URLS
      new URL(url, location.href);
    } catch (error) {
      $('#streamURL').val('');
      alert(`Invalid URL "${url}"`);
      return false;
    }
  }

  setupGlobals();
  hideCanvas();

  if (hls) {
    hls.destroy();
    clearInterval(liveAdvanceInterval);
    cancelAnimationFrame(bufferAsyncCallbackId);
    // @ts-ignore
    self.hls = hls = null;
  }

  if (!enableStreaming) {
    logStatus('Streaming disabled');
    return;
  }

  // const expiredTracks = [].filter.call(
  //   video.textTracks,
  //   (track) => track.kind !== 'metadata'
  // );
  // if (expiredTracks.length) {
  //   const kinds = expiredTracks
  //     .map((track) => track.kind)
  //     .filter((kind, index, self) => self.indexOf(kind) === index);
  //   logStatus(
  //     `Replacing video element to remove ${kinds.join(' and ')} text tracks`
  //   );
  //   const videoWithExpiredTextTracks = video;
  //   video = videoWithExpiredTextTracks.cloneNode(false);
  //   video.removeAttribute('src');
  //   video.volume = videoWithExpiredTextTracks.volume;
  //   video.muted = videoWithExpiredTextTracks.muted;
  //   videoWithExpiredTextTracks.parentNode.insertBefore(
  //     video,
  //     videoWithExpiredTextTracks
  //   );
  //   videoWithExpiredTextTracks.parentNode.removeChild(
  //     videoWithExpiredTextTracks
  //   );
  //   videoWithExpiredTextTracks.onprogress =
  //     videoWithExpiredTextTracks.ondurationchange = null;
  // }
  addVideoEventListeners(video);
  interstitialVideos = [
    document.querySelector('#interstitial-b') as HTMLVideoElement,
    document.querySelector('#interstitial-a') as HTMLVideoElement,
  ].filter((el) => el !== null);
  if (interstitialVideos.length) {
    interstitialVideos.forEach((media) => removeVideoEventListeners(media));
    let spread = false;
    $('.video-container').click((e) => {
      if (
        e.target !== e.currentTarget ||
        $('#video:hover,#interstitial-a:hover,#interstitial-b:hover').length
      ) {
        return;
      }
      if ((spread = !spread)) {
        $('#video').css({ background: 'black' });
        $('#interstitial-a').css({
          top: 0,
          left: '50%',
          height: '50%',
          background: 'red',
        });
        $('#interstitial-b').css({
          top: '50%',
          left: '50%',
          height: '50%',
          background: 'blue',
        });
      } else {
        $('#video').css({ background: 'none' });
        $('#interstitial-a').css({
          top: 0,
          left: 0,
          height: '100%',
          background: 'none',
        });
        $('#interstitial-b').css({
          top: 0,
          left: 0,
          height: '100%',
          background: 'none',
        });
      }
    });
  }

  logStatus('Loading ' + url);

  if (
    video.canPlayType('application/x-mpegURL') === 'maybe' &&
    getURLParam('native', false)
  ) {
    addChartEventListeners(null);
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.load();
    return;
  }

  // Extending both a demo-specific config and the user config which can override all
  const hlsConfig = Object.assign(
    {},
    hlsjsDefaults,
    getEditorValue({ parse: true })
  );

  if (selectedTestStream?.config && !options?.useCurrentConfig) {
    console.info(
      '[loadSelectedStream] extending hls config with stream-specific config: ',
      selectedTestStream.config
    );
    Object.assign(hlsConfig, selectedTestStream.config);
    updateConfigEditorValue(hlsConfig);
  }

  onDemoConfigChanged(true);
  // console.log('Using Hls.js config:', hlsConfig);

  let player = self.hls;
  if (!player) {
    player = new self.Hls(hlsConfig);
  } else {
    // No one should do this. If the config changes, create a new instance.
    Object.assign(player.config, hlsConfig);
  }
  self.hls = hls = player;

  registerInterstitialTimelineCanvas(
    document.querySelector('#primaryCanvas') as HTMLCanvasElement,
    hls,
    'primary'
  );
  registerInterstitialTimelineCanvas(
    document.querySelector('#playoutCanvas') as HTMLCanvasElement,
    hls,
    'playout'
  );
  registerInterstitialTimelineCanvas(
    document.querySelector('#integratedCanvas') as HTMLCanvasElement,
    hls,
    'integrated'
  );

  logStatus(`Loading manifest and attaching video element... "${url}"`);

  addChartEventListeners(hls);

  hls.on(HlsEvents.MANIFEST_LOADING, function () {
    updateLevelInfo();
    updateAudioTrackInfo();
    updateSubtitleTrackInfo();
  });
  if (hls.autoLevelCapping !== levelCapping) {
    hls.autoLevelCapping = levelCapping;
  }
  hls.loadSource(url);

  if (attachMediaOnStart) {
    hls.attachMedia(video);
  }

  hls.on(HlsEvents.MEDIA_ATTACHED, function () {
    bufferingIdx = -1;
    events.video.push({
      time: self.performance.now() - events.t0,
      type: 'Media attached',
    });
    trimEventHistory();
  });

  hls.on(HlsEvents.MEDIA_DETACHED, function () {
    clearInterval(liveAdvanceInterval);
    cancelAnimationFrame(bufferAsyncCallbackId);
    bufferingIdx = -1;
    tracks = [];
    events.video.push({
      time: self.performance.now() - events.t0,
      type: 'Media detached',
    });
    trimEventHistory();
  });

  const interstitialSegmentInfo = (seg): string => {
    if (!seg) {
      return `[undefined]`;
    }
    return (
      `${
        seg.event
          ? `I${seg.event.cue.pre ? '<pre>' : ''}"${seg.event.identifier}"`
          : 'P'
      }` + `[${seg.start.toFixed(3)}-${seg.end.toFixed(3)}]`
    );
  };

  hls.on(HlsEvents.INTERSTITIALS_UPDATED, function (eventName, data) {
    logStatus(
      `INTERSTITIALS_UPDATED Schedule: [${data.schedule.map(interstitialSegmentInfo)}]`
    );
    interstitialsUpdated = data;
    updateBufferedCanvas();
  });

  hls.on(
    HlsEvents.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
    function (eventName, data) {
      const { schedule, bufferingIndex, playingIndex, timelineMode } = data;
      const playing = schedule[playingIndex];
      const buffering = schedule[bufferingIndex];

      logStatus(
        `INTERSTITIALS_BUFFERED_TO_BOUNDARY: playing: ${playingIndex} ${interstitialSegmentInfo(playing)} -> buffering: ${bufferingIndex} ${interstitialSegmentInfo(buffering)} mode: ${timelineMode}`
      );
      interstitialsUpdated = data;
      updateBufferedCanvas();
    }
  );

  interstitialVideos.forEach((media) => {
    media.volume = video.volume;
    media.muted = video.muted;
    media.controls = false;
  });

  const attachInterstitialVideoToPlayer = (assetPlayer) => {
    if (!assetPlayer.media) {
      const availableMedia = interstitialVideos.pop();
      if (availableMedia) {
        assetPlayer.attachMedia(availableMedia);
      }
    }
  };

  const moveVideoToFrontonAttached = (
    assetPlayer: HlsAssetPlayer | Hls,
    interstitial?: InterstitialEvent
  ) => {
    const attached = () => {
      assetPlayer.off(HlsEvents.MEDIA_ATTACHED, attached);
      // activeVideo.controls = false; /////////////////
      if (interstitialElements === 'multiple' && assetPlayer.media) {
        removeVideoEventListeners(activeVideo);
        activeVideo = assetPlayer.media as HTMLVideoElement;
        addVideoEventListeners(activeVideo);
        activeVideo.playbackRate = 1;
        activeVideo.play();
      }
      if (!assetPlayer.media) {
        return;
      }
      activeVideo.style.zIndex = '' + interstitialVideoZIndex++;
      activeVideo = assetPlayer.media as HTMLVideoElement;

      const playbackStarting = () => {
        assetPlayer.off(HlsEvents.FRAG_CHANGED, playbackStarting);
        // DEMO skip restrictions by hiding controls
        if (assetPlayer.media) {
          assetPlayer.media.controls = interstitial
            ? !interstitial.restrictions.skip
            : true;
        }
      };
      if (
        ((assetPlayer as HlsAssetPlayer).hls || assetPlayer).currentLevel ===
          -1 &&
        !interstitial?.cue.pre
      ) {
        assetPlayer.on(HlsEvents.FRAG_CHANGED, playbackStarting);
      } else {
        playbackStarting();
      }
    };
    if (!assetPlayer.media) {
      assetPlayer.on(HlsEvents.MEDIA_ATTACHED, attached);
    } else {
      attached();
    }
  };
  moveVideoToFrontonAttached(hls);

  hls.on(
    HlsEvents.INTERSTITIAL_ASSET_PLAYER_CREATED,
    function (eventName, data) {
      logStatus(
        `INTERSTITIAL_ASSET_PLAYER_CREATED "${data.event.identifier}" ${data.assetListIndex}`
      );
      if (interstitialElements === 'multiple' && interstitialVideos.length) {
        attachInterstitialVideoToPlayer(data.player);
      }
      trimEventHistory();
    }
  );
  hls.on(HlsEvents.INTERSTITIAL_STARTED, function (eventName, data) {
    logStatus(`INTERSTITIAL_STARTED "${data.event.identifier}"`);
    if (interstitialElements === 'multiple') {
      video.playbackRate = 0;
      // Primary Live playback at the edge needs to keep up without playing sound
      if (hls.latestLevelDetails?.live) {
        const primaryOutTime = Math.max(hls.startPosition, video.currentTime);
        const primaryOutStart = Date.now();
        clearInterval(liveAdvanceInterval);
        liveAdvanceInterval = self.setInterval(() => {
          const timeSinceOut = (Date.now() - primaryOutStart) / 1000;
          video.currentTime = primaryOutTime + timeSinceOut;
        }, 1000 / 10);
      }
    }
    trimEventHistory();
  });
  hls.on(HlsEvents.INTERSTITIAL_ASSET_STARTED, function (eventName, data) {
    logStatus(
      `INTERSTITIAL_ASSET_STARTED "${data.event.identifier}" ${
        data.assetListIndex + 1
      }/${data.event.assetList.length}`
    );
    if (interstitialElements === 'multiple') {
      hls.media.controls = false;
      attachInterstitialVideoToPlayer(data.player);
      moveVideoToFrontonAttached(data.player, data.event);
    }
    trimEventHistory();
    if (data.player) {
      // if (interstitialElements === 'single') {
      //   addChartEventListeners(null);
      // }
      addChartEventListeners(data.player.hls);
    }
  });
  hls.on(HlsEvents.INTERSTITIAL_ASSET_ENDED, function (eventName, data) {
    logStatus(
      `INTERSTITIAL_ASSET_ENDED "${data.event.identifier}" ${
        data.assetListIndex + 1
      }/${data.event.assetList.length}`
    );
    const media = data.player.media;
    if (interstitialElements !== 'extended' && media && media !== video) {
      data.player.detachMedia();
      media.controls = false;
      interstitialVideos.unshift(media);
      if (interstitialElements === 'multiple') {
        // See if there are more assets to attach to
        // const assetList = data.event.assetList;
        // for (let i = data.assetListIndex + 1; i < assetList.length; i++) {
        //   if (interstitialVideos.length & assetList[i].player) {
        //     attachInterstitialVideoToPlayer(assetList[i].player);
        //   }
        //   break;
        // }
      }
    }
    trimEventHistory();
  });

  hls.on(HlsEvents.INTERSTITIAL_ASSET_ERROR, function (eventName, data) {
    logStatus(
      `INTERSTITIAL_ASSET_ERROR "${data.event.identifier}" > "${data.asset.identifier}"`
    );
  });

  hls.on(HlsEvents.INTERSTITIAL_ENDED, function (eventName, data) {
    logStatus(`INTERSTITIAL_ENDED "${data.event.identifier}"`);
    clearInterval(liveAdvanceInterval);
    moveVideoToFrontonAttached(player);
    trimEventHistory();
    if (interstitialElements === 'multiple') {
      addChartEventListeners(null);
      addChartEventListeners(hls);
    }
  });

  hls.on(HlsEvents.INTERSTITIALS_PRIMARY_RESUMED, function (eventName, data) {
    const item = data.schedule[data.scheduleIndex];
    logStatus(
      `INTERSTITIALS_PRIMARY_RESUMED index: ${data.scheduleIndex} timeline: ${item.start.toFixed(2)}-${item.end.toFixed(2)} ${item.nextEvent ? 'next event: ' + item.nextEvent : ''}`
    );
    // updateCurrentSourceBuffers(hls);
  });

  hls.on(HlsEvents.DESTROYING, function () {
    clearInterval(liveAdvanceInterval);
    cancelAnimationFrame(bufferAsyncCallbackId);
  });
  hls.on(HlsEvents.BUFFER_RESET, function () {
    clearInterval(liveAdvanceInterval);
    cancelAnimationFrame(bufferAsyncCallbackId);
  });

  hls.on(HlsEvents.FRAG_PARSING_INIT_SEGMENT, function (eventName, data) {
    showCanvas();
    events.video.push({
      time: self.performance.now() - events.t0,
      type: data.id + ' init segment',
    });
    trimEventHistory();
  });

  hls.on(HlsEvents.FRAG_PARSING_METADATA, function (eventName, data) {
    // console.log("Id3 samples ", data.samples);
  });

  hls.on(HlsEvents.LEVEL_SWITCHING, function (eventName, data) {
    events.level.push({
      time: self.performance.now() - events.t0,
      id: data.level,
      bitrate: Math.round(hls.levels[data.level].bitrate / 1000),
    });
    trimEventHistory();
    updateLevelInfo();
  });

  hls.on(HlsEvents.BUFFER_APPENDED, function (eventName, data) {
    events.videoBufferStarvation.push(data.videoBufferStarvation);
    updateBufferedCanvas();
  });

  hls.on(HlsEvents.MANIFEST_PARSED, function (eventName, data) {
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
    logStatus(
      `${hls.levels.length} quality levels found. ${hls.allAudioTracks.length} audio, ${hls.allSubtitleTracks.length} subtitle renditions.`
    );
    stats = {
      levelNb: data.levels.length,
      levelParsed: 0,
    };
    trimEventHistory();
    updateLevelInfo();
    self.refreshCanvas();
  });

  hls.on(HlsEvents.SUBTITLE_TRACKS_UPDATED, function (eventName, data) {
    logStatus(
      `${hls.subtitleTracks.length} subtitle track options found (${hls.allSubtitleTracks.length} total renditions)`
    );
  });

  hls.on(HlsEvents.AUDIO_TRACKS_UPDATED, function (eventName, data) {
    logStatus(
      `${hls.audioTracks.length} audio track options found (${hls.allAudioTracks.length} total renditions)`
    );
    updateAudioTrackInfo();
  });

  hls.on(HlsEvents.AUDIO_TRACK_SWITCHING, function (eventName, data) {
    logStatus(
      `Audio track switching: ${data.id} "${data.name}" lang:${data.lang} group:${data.groupId}`
    );
    updateAudioTrackInfo();
    events.video.push({
      time: self.performance.now() - events.t0,
      type: 'audio switching',
      name: '@' + data.id,
    });
    trimEventHistory();
    lastAudioTrackSwitchingIdx = events.video.length - 1;
  });

  hls.on(HlsEvents.AUDIO_TRACK_SWITCHED, function (eventName, data) {
    logStatus(
      `Audio track switched: ${data.id} "${data.name}" lang:${data.lang} group:${data.groupId}`
    );
    console.log(data);
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

  hls.on(HlsEvents.SUBTITLE_TRACKS_UPDATED, function (eventName, data) {
    logStatus('No of subtitle tracks found: ' + data.subtitleTracks.length);
    updateSubtitleTrackInfo();
  });

  hls.on(HlsEvents.SUBTITLE_TRACK_SWITCH, function (eventName, data) {
    logStatus(
      `Subtitle track switched: ${data.id} "${data.name}" lang:${data.lang} group:${data.groupId}`
    );
    updateSubtitleTrackInfo();
  });

  hls.on(HlsEvents.LEVEL_LOADED, function (eventName, data) {
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

  hls.on(HlsEvents.AUDIO_TRACK_LOADED, function (eventName, data) {
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

  hls.on(HlsEvents.FRAG_BUFFERED, function (eventName, data) {
    const stats = data.part?.stats?.loaded ? data.part.stats : data.frag.stats;
    if (data.stats.aborted) {
      console.assert('Aborted request being buffered.', data);
      return;
    }

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
      ), // bandwidth of this fragment
      ewma: Math.round(hls.bandwidthEstimate / 1000), // estimated bandwidth
      size: data.stats.total,
    };
    events.load.push(event);
    events.bitrate.push({
      time: self.performance.now() - events.t0,
      bitrate: event.bw,
      ewma: event.ewma,
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

  hls.on(HlsEvents.LEVEL_SWITCHED, function (eventName, data) {
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

  hls.on(HlsEvents.FRAG_CHANGED, function (eventName, data) {
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

  hls.on(HlsEvents.FRAG_LOAD_EMERGENCY_ABORTED, function (eventName, data) {
    if (stats) {
      if (stats.fragLoadEmergencyAborted === undefined) {
        stats.fragLoadEmergencyAborted = 1;
      } else {
        stats.fragLoadEmergencyAborted++;
      }
    }
  });

  hls.on(HlsEvents.FRAG_DECRYPTED, function (eventName, data) {
    if (!stats.fragDecrypted) {
      stats.fragDecrypted = 0;
      this.totalDecryptTime = 0;
      stats.fragAvgDecryptTime = 0;
    }
    stats.fragDecrypted++;
    this.totalDecryptTime += data.stats.tdecrypt - data.stats.tstart;
    stats.fragAvgDecryptTime = this.totalDecryptTime / stats.fragDecrypted;
  });

  hls.on(HlsEvents.ERROR, function (eventName, data) {
    console.warn('Error event:', data);
    switch (data.details) {
      case HlsErrorDetails.MANIFEST_LOAD_ERROR:
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
      case HlsErrorDetails.MANIFEST_LOAD_TIMEOUT:
        logError('Timeout while loading manifest');
        break;
      case HlsErrorDetails.MANIFEST_PARSING_ERROR:
        logError('Error while parsing manifest:' + data.reason);
        break;
      case HlsErrorDetails.LEVEL_EMPTY_ERROR:
        logError(
          'Loaded level contains no fragments ' + data.level + ' ' + data.url
        );
        // handleLevelError demonstrates how to remove a level that errors followed by a downswitch
        handleLevelError(data);
        break;
      case HlsErrorDetails.LEVEL_LOAD_ERROR:
        logError(
          'Error while loading level playlist ' +
            data.context.level +
            ' ' +
            data.url
        );
        // handleLevelError demonstrates how to remove a level that errors followed by a downswitch
        handleLevelError(data);
        break;
      case HlsErrorDetails.LEVEL_LOAD_TIMEOUT:
        logError(
          'Timeout while loading level playlist ' +
            data.context.level +
            ' ' +
            data.url
        );
        // handleLevelError demonstrates how to remove a level that errors followed by a downswitch
        handleLevelError(data);
        break;
      case HlsErrorDetails.LEVEL_SWITCH_ERROR:
        logError('Error while trying to switch to level ' + data.level);
        break;
      case HlsErrorDetails.FRAG_LOAD_ERROR:
        logError('Error while loading fragment ' + data.frag.url);
        break;
      case HlsErrorDetails.FRAG_LOAD_TIMEOUT:
        logError('Timeout while loading fragment ' + data.frag.url);
        break;
      case HlsErrorDetails.FRAG_DECRYPT_ERROR:
        logError('Decrypting error:' + data.reason);
        break;
      case HlsErrorDetails.FRAG_PARSING_ERROR:
        logError('Parsing error:' + data.reason);
        break;
      case HlsErrorDetails.KEY_LOAD_ERROR:
        logError('Error while loading key ' + data.frag.decryptdata?.uri);
        break;
      case HlsErrorDetails.KEY_LOAD_TIMEOUT:
        logError('Timeout while loading key ' + data.frag.decryptdata?.uri);
        break;
      case HlsErrorDetails.BUFFER_APPEND_ERROR:
        logError(
          `Buffer append error: (${data.error.code}) "${data.error.name}" ${data.error}`
        );
        break;
      case HlsErrorDetails.BUFFER_ADD_CODEC_ERROR:
        logError(
          'Buffer add codec error for ' +
            data.mimeType +
            ':' +
            data.error.message
        );
        break;
      case HlsErrorDetails.BUFFER_APPENDING_ERROR:
        logError('Buffer appending error');
        break;
      case HlsErrorDetails.BUFFER_STALLED_ERROR:
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
      clearInterval(liveAdvanceInterval);
      console.error(`Fatal error : ${data.details}`, data.err);
      switch (data.type) {
        case self.Hls.ErrorTypes.MEDIA_ERROR:
          logError(`A media error occurred: ${data.details}`);
          handleMediaError();
          break;
        case self.Hls.ErrorTypes.NETWORK_ERROR:
          logError(`A network error occurred: ${data.details}`);
          break;
        default:
          logError(`An unrecoverable error occurred: ${data.details}`);
          // hls.destroy();
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

  hls.on(HlsEvents.BUFFER_CREATED, function (eventName, data) {
    tracks = data.tracks;
  });

  hls.on(
    HlsEvents.BUFFER_APPENDING,
    function (eventName, data: BufferAppendingData) {
      if (dumpfMP4) {
        fmp4Data[data.type].push(data.data);
        fmp4DataInfo[data.type].push(data);
        (data as BufferAppendingData & { appendIndex?: number }).appendIndex =
          fmp4DataInfo.index;
        fmp4DataInfo.index++;
      }
    }
  );

  hls.on(HlsEvents.FPS_DROP, function (eventName, data) {
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

function removeVideoEventListeners(video) {
  video.removeEventListener('resize', handleVideoEvent);
  video.removeEventListener('seeking', handleVideoEvent);
  video.removeEventListener('seeked', handleVideoEvent);
  video.removeEventListener('pause', handleVideoEvent);
  video.removeEventListener('play', handleVideoEvent);
  video.removeEventListener('canplay', handleVideoEvent);
  video.removeEventListener('waiting', handleVideoEvent);
  video.removeEventListener('canplaythrough', handleVideoEvent);
  video.removeEventListener('ended', handleVideoEvent);
  video.removeEventListener('playing', handleVideoEvent);
  video.removeEventListener('error', handleVideoEvent);
  video.removeEventListener('loadedmetadata', handleVideoEvent);
  video.removeEventListener('loadeddata', handleVideoEvent);
  video.removeEventListener('durationchange', handleVideoEvent);
  video.removeEventListener('volumechange', handleVolumeEvent);
  video.removeEventListener('emptied', handleVideoEvent);
  video.removeEventListener('loadstart', handleVideoEvent);
  video.removeEventListener('progress', updateBufferedCanvas);
  video.removeEventListener('timeupdate', updateBufferedCanvas);
}

function addVideoEventListeners(video) {
  removeVideoEventListeners(video);
  video.addEventListener('resize', handleVideoEvent);
  video.addEventListener('seeking', handleVideoEvent);
  video.addEventListener('seeked', handleVideoEvent);
  video.addEventListener('pause', handleVideoEvent);
  video.addEventListener('play', handleVideoEvent);
  video.addEventListener('canplay', handleVideoEvent);
  video.addEventListener('waiting', handleVideoEvent);
  video.addEventListener('canplaythrough', handleVideoEvent);
  video.addEventListener('ended', handleVideoEvent);
  video.addEventListener('playing', handleVideoEvent);
  video.addEventListener('error', handleVideoEvent);
  video.addEventListener('loadedmetadata', handleVideoEvent);
  video.addEventListener('loadeddata', handleVideoEvent);
  video.addEventListener('durationchange', handleVideoEvent);
  video.addEventListener('volumechange', handleVolumeEvent);
  video.addEventListener('emptied', handleVideoEvent);
  video.addEventListener('loadstart', handleVideoEvent);
  video.addEventListener('progress', updateBufferedCanvas);
  video.addEventListener('timeupdate', updateBufferedCanvas);
}

function handleUnsupported() {
  logStatus(
    'Your Browser does not support MediaSourceExtension / MP4 mediasource'
  );
}

function handleVideoEvent(evt) {
  let data = '';
  if (hls?.debug) {
    console.log(`#${evt.target.id} video event: "${evt.type}"`);
  }
  switch (evt.type) {
    case 'durationchange':
      updateBufferedCanvas();
      if (evt.target.duration - lastDuration <= 0.5) {
        // some browsers report several duration change events with almost the same value ... avoid spamming video events
        return;
      }
      lastDuration = evt.target.duration;
      data = Number.isFinite(evt.target.duration)
        ? Math.round(evt.target.duration * 1000)
        : evt.target.duration;
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
    // falls through
    case 'pause':
    case 'waiting':
    case 'stalled':
    case 'error':
      updateBufferedCanvas();
      clearInterval(liveAdvanceInterval);
      data = '' + Math.round(evt.target.currentTime * 1000);
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

  if (
    evt.type === 'seeked' &&
    lastSeekingIdx !== undefined &&
    events.video[lastSeekingIdx]
  ) {
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
  if (!autoRecoverError) {
    return;
  }
  const levelObj = data.context || data;
  hls.removeLevel(levelObj.level);
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
  } else {
    // hls.destroy();
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
  const ctx = bufferedCanvas.getContext('2d');
  const r = activeVideo.buffered;
  const seekableEnd = getSeekableEnd();
  let bufferingDuration;
  if (r && ctx) {
    ctx.fillStyle = 'black';
    if (
      !bufferedCanvas.width ||
      bufferedCanvas.width !== activeVideo.clientWidth
    ) {
      bufferedCanvas.width = activeVideo.clientWidth;
    }
    ctx.fillRect(0, 0, bufferedCanvas.width, bufferedCanvas.height);
    const pos = activeVideo.currentTime;
    let bufferLen = 0;
    ctx.fillStyle = 'gray';
    for (let i = 0; i < r.length; i++) {
      const start = (r.start(i) / seekableEnd) * bufferedCanvas.width;
      const end = (r.end(i) / seekableEnd) * bufferedCanvas.width;
      ctx.fillRect(start, 2, Math.max(2, end - start), 11);
      if (pos >= r.start(i) && pos < r.end(i)) {
        // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
        bufferLen = r.end(i) - pos;
      }
    }
    // check if we are in buffering / or playback ended state
    if (
      bufferLen <= 0.1 &&
      activeVideo.paused === false &&
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
      let log = `Duration: ${
        activeVideo.duration
      }\nBuffered: ${timeRangesToString(
        activeVideo.buffered
      )}\nSeekable: ${timeRangesToString(
        activeVideo.seekable
      )}\nPlayed: ${timeRangesToString(activeVideo.played)}\n`;
      if (hls.media) {
        for (const type in tracks) {
          let buffered;
          try {
            buffered = tracks[type].buffer.buffered;
          } catch (e) {
            /* noop */
          }
          if (buffered) {
            log += `Buffer for ${type} contains:${timeRangesToString(
              buffered
            )}\n`;
          }
        }
        const videoPlaybackQuality = activeVideo.getVideoPlaybackQuality;
        if (
          videoPlaybackQuality &&
          typeof videoPlaybackQuality === typeof Function
        ) {
          log += `Max video buffer starvation ${Math.max.apply(
            null,
            events.videoBufferStarvation || [0]
          )}\n`;
          log += `Video buffer starvation count ${
            events.videoBufferStarvation.filter((n) => n > 0).length
          }\n`;
          log += `Dropped frames: ${
            activeVideo.getVideoPlaybackQuality().droppedVideoFrames
          }\n`;
          log += `Corrupted frames: ${
            activeVideo.getVideoPlaybackQuality().corruptedVideoFrames
          }\n`;
        } else if ((activeVideo as any).webkitDroppedFrameCount) {
          log += `Dropped frames: ${(activeVideo as any).webkitDroppedFrameCount}\n`;
        }
      }
      log += `TTFB Estimate: ${hls.ttfbEstimate.toFixed(3)}\n`;
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
    const x = (activeVideo.currentTime / seekableEnd) * bufferedCanvas.width;
    ctx.fillRect(x, 0, 2, 15);

    // Only render Interstitials on the timeline when primary media is presented or mixed
    if (
      interstitialsUpdated &&
      ((interstitialElements === 'multiple' && activeVideo === video) ||
        hls.media)
    ) {
      ctx.fillStyle = 'yellow';
      for (let i = 0; i < interstitialsUpdated.events.length; i++) {
        const interstitial = interstitialsUpdated.events[i];
        const start =
          (interstitial.startTime / seekableEnd) * bufferedCanvas.width;
        const end =
          (interstitial.startTime / seekableEnd) * bufferedCanvas.width;
        ctx.fillRect(start, 0, Math.max(1, end - start), 7);
      }
    }
  } else if (ctx !== null && ctx.fillStyle !== 'black') {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, bufferedCanvas.width, bufferedCanvas.height);
  }
}

function showCanvas() {
  self.showMetrics();
  $('#bufferedOut').show();
}

function hideCanvas() {
  self.hideMetrics();
  $('#bufferedOut').hide();
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
  url = url.slice(0, url.lastIndexOf('/') + 1) + 'metrics.html';
  self.open(url, '_blank');
};

function goToMetricsPermaLink() {
  let url = document.URL;
  const b64 = getMetrics();
  url = url.slice(0, url.lastIndexOf('/') + 1) + 'metrics.html#data=' + b64;
  self.open(url, '_blank');
}

function onClickBufferedRange(event) {
  const target =
    ((event.clientX - bufferedCanvas.offsetLeft) / bufferedCanvas.width) *
    getSeekableEnd();
  activeVideo.currentTime = target;
}

function getSeekableEnd() {
  if (isFinite(activeVideo.duration)) {
    return activeVideo.duration;
  }
  if (activeVideo.seekable.length) {
    return activeVideo.seekable.end(activeVideo.seekable.length - 1);
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
    track
      ? track.name +
          ' / ' +
          track.lang +
          ' / ' +
          (track.attrs['ASSOC-LANGUAGE'] || '') +
          ' / ' +
          (track.characteristics || '')
      : 'None selected'
  );
  $('#audioTrackControl').html(html1);
}

function updateSubtitleTrackInfo() {
  const buttonTemplate = '<button type="button" class="btn btn-sm ';
  const buttonEnabled = 'btn-primary" ';
  const buttonDisabled = 'btn-success" ';
  const subtitleTrackId = hls.subtitleTrack;
  const len = hls.subtitleTracks.length;
  const track = hls.subtitleTracks[subtitleTrackId];

  let html1 =
    buttonTemplate +
    (subtitleTrackId === -1 ? buttonEnabled : buttonDisabled) +
    'onclick="hls.subtitleTrack=-1">None</button>';
  for (let i = 0; i < len; i++) {
    html1 += buttonTemplate;
    if (subtitleTrackId === i) {
      html1 += buttonEnabled;
    } else {
      html1 += buttonDisabled;
    }

    html1 +=
      'onclick="hls.subtitleTrack=' +
      i +
      '">' +
      hls.subtitleTracks[i].name +
      '</button>';
  }

  $('#subtitleTrackLabel').text(
    track
      ? track.name +
          ' / ' +
          track.lang +
          ' / ' +
          (track.attrs['ASSOC-LANGUAGE'] || '') +
          ' / ' +
          (track.characteristics || '')
      : 'None selected'
  );
  $('#subtitleTrackControl').html(html1);
}

function codecs2label(levelCodecs) {
  if (levelCodecs) {
    return levelCodecs
      .replace(/([ah]vc.)[^,;]+/, '$1')
      .replace(/mp4a\.40\.\d+/, 'mp4a');
  }
  return '';
}

function level2label(level, i, manifestCodecs) {
  const levelCodecs = codecs2label(level.attrs.CODECS);
  const levelNameInfo = level.name ? `"${level.name}": ` : '';
  let codecInfo =
    levelCodecs && manifestCodecs.length > 1 ? ` / ${levelCodecs}` : '';
  if (level.attrs['HDCP-LEVEL']) {
    codecInfo += ` / ${level.attrs['HDCP-LEVEL']}`;
  }
  if (level.attrs['PATHWAY-ID']) {
    codecInfo += ` / "${level.attrs['PATHWAY-ID']}"`;
  }
  if (level.attrs['VIDEO-RANGE']) {
    codecInfo += ` / ${level.attrs['VIDEO-RANGE']}`;
  }
  if (level.audioGroupId) {
    codecInfo += ` [${level.audioGroupId}]`;
  }
  if (level.height) {
    if (level.frameRate) {
      return `${i} (${levelNameInfo}${level.height}p / ${
        level.frameRate
      }fps / ${Math.round(level.bitrate / 1024)}kb${codecInfo})`;
    }
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

function onDemoConfigChanged(firstLoad?) {
  demoConfig = {
    enableStreaming,
    attachMediaOnStart,
    autoRecoverError,
    stopOnStall,
    dumpfMP4,
    levelCapping,
    limitMetrics,
    videoHeight,
    interstitialElements,
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
  if (self.location.href !== permalinkURL) {
    // if (firstLoad) {
    //   self.history.replaceState(null, '', permalinkURL);
    // }
    self.history.pushState(null, '', permalinkURL);
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

function getEditorValue(options?) {
  const value = configEditor?.session.getValue();

  options = Object.assign({ parse: false }, options || {});
  if (value && options.parse) {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.warn('[getEditorValue] could not parse editor value', e);
      return {};
    }
  }

  return value || '{}';
}

function getPersistedHlsConfig() {
  const value = localStorage.getItem(STORAGE_KEYS.Hls_Config);
  if (value === null) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn('[getPersistedHlsConfig] could not hls config json', e);
  }

  return {};
}

function persistEditorValue() {
  localStorage.setItem(STORAGE_KEYS.Hls_Config, getEditorValue());
}

function setupConfigEditor() {
  configEditor = self.ace.edit('config-editor');
  configEditor.setTheme('ace/theme/github');
  configEditor.session.setMode('ace/mode/json');

  const contents = Object.assign({}, hlsjsDefaults);
  const persistence = localStorage.getItem(STORAGE_KEYS.Editor_Persistence);
  const shouldRestorePersisted = persistence
    ? JSON.parse(persistence) === true
    : false;

  if (shouldRestorePersisted) {
    Object.assign(contents, getPersistedHlsConfig());
  }

  const elPersistence = document.querySelector(
    '#config-persistence'
  ) as HTMLInputElement;
  elPersistence.addEventListener('change', onConfigPersistenceChanged);
  elPersistence.checked = shouldRestorePersisted;
  configPersistenceEnabled = shouldRestorePersisted;

  updateConfigEditorValue(contents);
}

function setupTimelineChart() {
  const canvas = document.querySelector('#timeline-chart') as HTMLCanvasElement;
  const canvasCurrentTime = document.querySelector(
    '#timeline-chart-current-time'
  ) as HTMLCanvasElement;
  const chart = new TimelineChart(canvas, canvasCurrentTime, {
    responsive: false,
  });

  resizeHandlers.push(() => {
    chart.resize();
  });

  chart.resize();

  return chart;
}

type ChartListener = {
  hls: Hls | HlsAssetPlayer;
  event: keyof HlsListeners;
  callback: HlsListeners[keyof HlsListeners];
};
const chartEventListeners: ChartListener[] = [];
function addChartListener<E extends keyof HlsListeners>(
  hls: Hls | HlsAssetPlayer,
  event: E,
  callback: HlsListeners[E]
) {
  chartEventListeners.push({ hls, event, callback });
  hls.on(event, callback, chart);
}

// function updateCurrentSourceBuffers(hls) {
//   if (
//     hls.media &&
//     hls.bufferController &&
//     Object.keys(hls.bufferController.tracks).length &&
//     !Object.keys(hls.bufferController.tracks).some(
//       (type) => !hls.bufferController.tracks[type].buffer
//     )
//   ) {
//     chart.updateSourceBuffers(hls.bufferController.tracks, hls.media);
//   }
// }

function addChartEventListeners(hls: Hls | null) {
  for (let i = chartEventListeners.length; i--; ) {
    if (chartEventListeners[i].hls === hls) {
      const celSet = chartEventListeners[i];
      celSet.hls.off(celSet.event, celSet.callback, chart);
      chartEventListeners.splice(i, 1);
    }
  }
  const updateLevelOrTrack = (eventName, data) => {
    chart.updateLevelOrTrack(data.details, hls?.media?.duration);
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
  if (!hls) {
    chart.reset();
    chart.updateSourceBuffers({}, video);
    // video.oncanplay = () => {
    //   video.play();
    // };
    return;
  }
  // updateCurrentSourceBuffers(hls);
  addChartListener(hls, HlsEvents.MANIFEST_LOADING, () => {
    chart.reset();
  });
  addChartListener(hls, HlsEvents.MANIFEST_PARSED, (eventName, data) => {
    const { levels } = data;
    chart.removeType('level');
    chart.removeType('audioTrack');
    chart.removeType('subtitleTrack');
    chart.updateLevels(levels);
  });
  addChartListener(hls, HlsEvents.BUFFER_CREATED, (eventName, { tracks }) => {
    if (hls.media) {
      chart.updateSourceBuffers(tracks, hls.media);
    }
  });
  addChartListener(hls, HlsEvents.BUFFER_RESET, () => {
    chart.removeSourceBuffers();
  });
  addChartListener(hls, HlsEvents.LEVELS_UPDATED, (eventName, { levels }) => {
    chart.removeType('level');
    chart.updateLevels(levels);
  });
  addChartListener(hls, HlsEvents.LEVEL_SWITCHED, (eventName, { level }) => {
    chart.removeType('level');
    chart.updateLevels(hls.levels, level);
  });
  addChartListener(hls, HlsEvents.LEVEL_LOADING, () => {
    // TODO: mutate level datasets
    // Update loadLevel
    chart.removeType('level');
    chart.updateLevels(hls.levels);
  });
  addChartListener(hls, HlsEvents.LEVEL_UPDATED, (eventName, { details }) => {
    chart.updateLevelOrTrack(details, hls.media?.duration);
    // chart.updateDateRanges(details);
  });
  addChartListener(hls, HlsEvents.INTERSTITIALS_UPDATED, (eventName, data) => {
    chart.updateInterstitials(hls.interstitialsManager);
  });
  addChartListener(
    hls,
    HlsEvents.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
    (eventName, data) => {
      chart.updateInterstitials(hls.interstitialsManager);
    }
  );
  if (hls.config.interstitialsController) {
    addChartListener(hls, HlsEvents.INTERSTITIAL_STARTED, (eventName, data) => {
      chart.updateInterstitials(hls.interstitialsManager);
    });
    addChartListener(
      hls,
      HlsEvents.INTERSTITIAL_ASSET_STARTED,
      (eventName, data) => {
        chart.updateInterstitials(hls.interstitialsManager);
      }
    );
    addChartListener(
      hls,
      HlsEvents.INTERSTITIAL_ASSET_ENDED,
      (eventName, data) => {
        chart.updateInterstitials(hls.interstitialsManager);
      }
    );
    addChartListener(hls, HlsEvents.INTERSTITIAL_ENDED, (eventName, data) => {
      chart.updateInterstitials(hls.interstitialsManager);
    });
    addChartListener(
      hls,
      HlsEvents.INTERSTITIALS_PRIMARY_RESUMED,
      (eventName, data) => {
        chart.updateInterstitials(hls.interstitialsManager);
      }
    );
    hls.on(HlsEvents.MEDIA_ATTACHED, () => {
      chart.updateInterstitials(hls.interstitialsManager);
    });
    hls.on(HlsEvents.MEDIA_DETACHED, () => {
      chart.updateInterstitials(hls.interstitialsManager);
    });
    // hls.on(HlsEvents.FRAG_CHANGED, () => {
    //   chart.updateInterstitials(hls.interstitialsManager);
    // });
    // hls.on(HlsEvents.ERROR, () => {
    //   chart.updateInterstitials(hls.interstitialsManager);
    // });
  }
  addChartListener(
    hls,
    HlsEvents.AUDIO_TRACKS_UPDATED,
    (eventName, { audioTracks }) => {
      chart.removeType('audioTrack');
      chart.updateAudioTracks(audioTracks);
    }
  );
  addChartListener(
    hls,
    HlsEvents.SUBTITLE_TRACKS_UPDATED,
    (eventName, { subtitleTracks }) => {
      chart.removeType('subtitleTrack');
      chart.updateSubtitleTracks(subtitleTracks);
    }
  );
  addChartListener(hls, HlsEvents.AUDIO_TRACK_SWITCHED, (eventName) => {
    // TODO: mutate level datasets
    chart.removeType('audioTrack');
    chart.updateAudioTracks(hls.audioTracks);
  });
  addChartListener(hls, HlsEvents.SUBTITLE_TRACK_SWITCH, (eventName) => {
    // TODO: mutate level datasets
    chart.removeType('subtitleTrack');
    chart.updateSubtitleTracks(hls.subtitleTracks);
  });
  addChartListener(hls, HlsEvents.AUDIO_TRACK_LOADED, updateLevelOrTrack);
  addChartListener(hls, HlsEvents.SUBTITLE_TRACK_LOADED, updateLevelOrTrack);
  addChartListener(hls, HlsEvents.LEVEL_PTS_UPDATED, updateLevelOrTrack);
  addChartListener(hls, HlsEvents.FRAG_LOADED, updateFragment);
  addChartListener(hls, HlsEvents.FRAG_PARSED, updateFragment);
  addChartListener(hls, HlsEvents.FRAG_CHANGED, updateFragment);
  addChartListener(hls, HlsEvents.BUFFER_APPENDING, updateChart);
  addChartListener(hls, HlsEvents.BUFFER_APPENDED, updateChart);
  addChartListener(hls, HlsEvents.BUFFER_FLUSHED, updateChart);
  const levels = hls.levels;
  if (levels) {
    chart.updateLevels(levels);
    const details = levels[hls.currentLevel]?.details;
    if (details) {
      chart.updateLevelOrTrack(details, hls.media?.duration);
    }
    if (hls.audioTracks) {
      chart.updateAudioTracks(hls.audioTracks);
    }
    if (hls.subtitleTracks) {
      chart.updateSubtitleTracks(hls.subtitleTracks);
    }
  }
}

function updateConfigEditorValue(obj) {
  if (!configEditor) {
    return;
  }
  const json = JSON.stringify(obj, null, 2);
  configEditor.session.setValue(json);
}

function applyConfigEditorValue() {
  onDemoConfigChanged();
  loadSelectedStream({ useCurrentConfig: true });
}

const saveIndexes = {
  audio: 0,
  video: 0,
};

function createfMP4(type: SourceBufferName) {
  const index = saveIndexes[type];
  const data = fmp4Data[type][index];
  if (data) {
    saveIndexes[type]++;
    const info = fmp4DataInfo[type][index];
    const blob = new Blob([data], {
      type: 'application/octet-stream',
    });
    const filename = type + '-' + info.appendIndex + '.mp4';
    const ok = (self as any).saveAs(blob, filename);
    console.log(filename, ok);
    // $('body').append('<a download="hlsjs-' + filename + '" href="' + self.URL.createObjectURL(blob) + '">Download ' + filename + ' track</a><br>');
  } else if (!dumpfMP4) {
    console.error(
      'Check "Dump transmuxed fMP4 data" first to make appended media available for saving.'
    );
  }
}

function hideAllTabs() {
  $('.demo-tab-btn').css('background-color', '');
  $('.demo-tab').hide();
}

function toggleTabClick(btn: HTMLButtonElement) {
  toggleTab(btn);
  const tabIndexes = $('.demo-tab-btn')
    .toArray()
    .map((el, i) => ($('#' + $(el).data('tab')).is(':visible') ? i : null))
    .filter((i) => i !== null);
  localStorage.setItem(STORAGE_KEYS.demo_tabs, tabIndexes.join(','));
}

function toggleTab(btn: HTMLButtonElement, dontHideOpenTabs?: boolean) {
  const tabElId = $(btn).data('tab');
  // eslint-disable-next-line no-restricted-globals
  const modifierPressed =
    self.event &&
    ((self.event as KeyboardEvent).metaKey ||
      (self.event as KeyboardEvent).shiftKey);
  if (!dontHideOpenTabs && !modifierPressed) {
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
  if ($('#timelineTab').is(':visible')) {
    chart.show();
    chart.resize(
      (chart as any).chart.data ? (chart as any).chart.data.datasets : null
    );
  } else {
    chart.hide();
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
  console.log(message);
}

function logError(message) {
  appendLog('errorOut', message);
}
