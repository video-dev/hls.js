/* global Hls */

function onPageLoad(sourceURL) {
  if (!Hls.isSupported()) {
    // HLS.js not supported
    return;
  }

  const video = document.querySelector('#video');

  const hls = (self.hls = new Hls({
    debug: true,
    enableWorker: false,
  }));
  hls.loadSource(sourceURL);
  hls.attachMedia(video);

  registerPlayer(document.querySelector('#player'), video, hls);
  registerManagerPrintOut(hls);
}

// Player controls with ad transitions
function registerPlayer(container, video, hls) {
  let shouldPlay = true;

  const timeCurrent = document.querySelector('#current-time');
  const timeDuration = document.querySelector('#duration');
  const selectBox = document.querySelector('#timeline-display');
  let displayTime = selectBox.value; // 'playout' || 'integrated;

  const timeline = registerInterstitialTimelineCanvas(
    document.querySelector('#timeline-canvas'),
    hls,
    displayTime
  );

  registerControlsToggle(container, video);

  selectBox.onchange = () => {
    displayTime = selectBox.value;
    displayTimeAndDuration();
    timeline.timelineDisplay = displayTime;
  };

  // Skip button toggle and click
  hls.on(Hls.Events.INTERSTITIAL_STARTED, () => {
    timeCurrent.textContent = timeDuration.textContent = '';
    container.classList.replace('primary', 'interstitials');
  });
  hls.on(Hls.Events.INTERSTITIAL_ENDED, () => {
    timeCurrent.textContent = timeDuration.textContent = '';
    container.classList.replace('interstitials', 'primary');
  });
  document.querySelector('#skip').onclick = (e) => {
    shouldPlay = true;
    hls.interstitialsManager.skip();
  };

  // Play/Pause button and autoplay
  const playAttempt = () => {
    shouldPlay = true;
    video.play().catch((e) => {
      container.classList.replace('playing', 'paused');
      shouldPlay = false;
    });
  };
  document.querySelector('#play-pause').onclick = (e) => {
    if (video.paused) {
      playAttempt();
    } else {
      video.pause();
      shouldPlay = false;
    }
  };
  video.onplaying = (e) => {
    container.classList.replace('paused', 'playing');
  };
  video.onpause = (e) => {
    container.classList.replace('playing', 'paused');
  };
  // "autoplay"
  video.oncanplaythrough = () => {
    if (shouldPlay) {
      playAttempt();
    }
  };

  // Mute/Unmute button
  document.querySelector('#mute-unmute').onclick = (e) => {
    video.muted = !video.muted;
    if (!video.muted) {
      video.volume = 1;
    }
  };
  video.onvolumechange = (e) => {
    if (video.muted || video.volume === 0) {
      container.classList.replace('unmuted', 'muted');
    } else {
      container.classList.replace('muted', 'unmuted');
    }
  };

  // Time display
  const displayTimeAndDuration = () => {
    const playingItem = hls.interstitialsManager.playingItem;
    if (playingItem?.event) {
      const timeRemaining = Math.ceil(
        playingItem.playout.end - hls.interstitialsManager.playout.currentTime
      );
      timeDuration.textContent = '';
      timeCurrent.textContent = `${timeRemaining} seconds remaining`;
    } else {
      timeCurrent.textContent = hhmmss(
        hls.interstitialsManager[displayTime].currentTime
      ).replace(/^00?:?/, '');
      timeDuration.textContent =
        ' / ' +
        hhmmss(hls.interstitialsManager[displayTime].duration).replace(
          /^00?:?/,
          ''
        );
    }
  };
  video.ontimeupdate = displayTimeAndDuration;
  video.ondurationchange = displayTimeAndDuration;
}

function hhmmss(seconds) {
  const date = new Date();
  const tzOffset = new Date(0).getTimezoneOffset() * 60000;
  date.setTime(tzOffset + seconds * 1000);
  return date.toLocaleTimeString('eo', { hour12: false });
}

// Timeline with Interstitials
function registerInterstitialTimelineCanvas(canvas, hls, timelineType) {
  const runningInstance = canvas.instance;
  if (runningInstance) {
    runningInstance.destroy();
  }
  return (canvas.instance = new InterstitialTimelineCanvas(
    canvas,
    hls,
    timelineType
  ));
}

class InterstitialTimelineCanvas {
  canvas;
  hls;
  refreshId = -1;
  timelineType;

  constructor(canvas, hls, timelineType) {
    this.canvas = canvas;
    this.hls = hls;
    this.timelineType = timelineType;
    this.canvas.onclick = this.onClick;
    this.refresh();
  }

  set timelineDisplay(timelineType) {
    this.timelineType = timelineType;
    this.refresh();
  }

  destroy() {
    cancelAnimationFrame(this.refreshId);
    this.canvas = this.hls = null;
  }

  onClick = (event) => {
    const im = this.hls.interstitialsManager;
    if (!im) {
      return;
    }
    const type = this.timelineType;
    const imTimes = im[type];
    const targetTime =
      ((event.clientX - this.canvas.offsetLeft) / this.canvas.width) *
      imTimes.duration;
    imTimes.seekTo(targetTime);
  };

  refresh() {
    cancelAnimationFrame(this.refreshId);
    this.refreshId = requestAnimationFrame(() => this.refresh());
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    let width = canvas.width;
    const height = canvas.height;
    // resize
    const video = this.hls.media;
    if (video) {
      if (!width || width !== video.clientWidth) {
        width = canvas.width = video.clientWidth;
      }
    }

    // redraw background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(150,150,150,0.5)';
    ctx.fillRect(0, 0, width, height);

    const im = this.hls.interstitialsManager;
    if (!im) {
      return;
    }
    const type = this.timelineType;
    const imTimes = im[type];
    const duration = imTimes.duration;
    const currentTime = imTimes.currentTime;
    const bufferedEnd = imTimes.bufferedEnd;
    // Interstitial event and asset boundaries
    const items = im.schedule;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const event = item.event;
      if (event) {
        // Interstitial event range
        const timeRange = type === 'primary' ? item : item[type];
        const xEventStart = (timeRange.start / duration) * width;
        const xEventEnd = (timeRange.end / duration) * width;
        const widthEvent = xEventEnd - xEventStart;
        const restrictions = event.restrictions;
        if (restrictions.jump) {
          ctx.fillStyle = 'red';
        } else if (restrictions.skip) {
          ctx.fillStyle = 'orange';
        } else if (event.supplementsPrimary) {
          ctx.fillStyle = 'green';
        } else {
          ctx.fillStyle = 'yellow';
        }
        ctx.fillRect(xEventStart, 0, Math.max(widthEvent, 1), height);
        // Fill with Asset ranges
        const assets = event.assetList;
        if (widthEvent > assets.length * 2) {
          for (let j = 0; j < assets.length; j++) {
            const asset = event.assetList[j];
            if (asset.duration) {
              const xAssetStart =
                ((timeRange.start + asset.startOffset) / duration) * width;
              const xAssetEnd =
                ((timeRange.start + asset.startOffset + asset.duration) /
                  duration) *
                width;
              const widthAsset = xAssetEnd - xAssetStart;
              ctx.fillStyle = 'rgb(120,120,0)';
              ctx.fillRect(
                xAssetStart + 1,
                1,
                Math.max(widthAsset - 2.5, 1),
                height - 2
              );
            }
          }
        }
      }
    }
    // buffered
    const xCurrentTime = (currentTime / duration) * width;
    const xBufferedEnd = (bufferedEnd / duration) * width;
    if (bufferedEnd > currentTime) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(xCurrentTime, 1, xBufferedEnd - xCurrentTime, height - 2);
    }
    // current time
    ctx.fillStyle = 'rgba(0, 102, 220,0.5)';
    ctx.fillRect(0, 0, xCurrentTime, height);
    ctx.fillStyle = 'rgb(0, 102, 220)';
    ctx.fillRect(xCurrentTime - 0.5, 0, 2, height);
  }
}

// Display InterstitialsManager state changes on page
function registerManagerPrintOut(hls) {
  const el = document.querySelector('#interstitials-manager');
  const printout = () => {
    const {
      events,
      schedule,
      playingItem,
      bufferingItem,
      bufferingAsset,
      playingAsset,
      bufferingPlayer,
      playerQueue,
    } = hls.interstitialsManager;
    const assetToObj = ({ identifier, duration }) => ({ identifier, duration });
    const interstitialToObj = ({
      identifier,
      appendInPlace,
      duration,
      timelineStart,
      resumeTime,
      hasPlayed,
      assetList,
      error,
    }) => ({
      identifier,
      appendInPlace,
      duration,
      timelineStart,
      resumeTime,
      hasPlayed,
      assetList: assetList.map(assetToObj),
      error,
    });
    const segmentToObj = ({ playout: { start, end }, event }) => ({
      playout: { start, end },
      event: event ? { identifier: event.identifier } : undefined,
    });
    const assetPlayerToObj = ({
      assetId,
      bufferedEnd,
      currentTime,
      duration,
      remaining,
      timelineOffset,
    }) => ({
      assetId,
      bufferedEnd,
      currentTime,
      duration,
      remaining,
      timelineOffset,
    });
    const serialize = {
      playout: hls.interstitialsManager.playout,
      integrated: hls.interstitialsManager.integrated,
      primary: hls.interstitialsManager.primary,

      events: events.map(interstitialToObj),
      schedule: schedule.map(segmentToObj),

      waitingIndex: hls.interstitialsManager.waitingIndex,

      playingIndex: hls.interstitialsManager.playingIndex,
      playingItem: playingItem ? segmentToObj(playingItem) : playingItem,
      playingAsset: playingAsset ? assetToObj(playingAsset) : playingAsset,

      bufferingIndex: hls.interstitialsManager.bufferingIndex,
      bufferingItem: bufferingItem
        ? segmentToObj(bufferingItem)
        : bufferingItem,
      bufferingAsset: bufferingAsset
        ? assetToObj(bufferingAsset)
        : bufferingAsset,

      bufferingPlayer: bufferingPlayer
        ? assetPlayerToObj(bufferingPlayer)
        : bufferingPlayer,
      playerQueue: playerQueue.map(assetPlayerToObj),

      skip: `function skip() {}`,
    };
    el.textContent = JSON.stringify(serialize, null, 2).replace(
      /^(\s*)"([^"]+)":/gm,
      '$1$2:'
    );
  };
  self.setInterval(printout, 1000);
  hls.on(Hls.Events.INTERSTITIAL_STARTED, () => {
    printout();
  });
  hls.on(Hls.Events.INTERSTITIAL_ENDED, () => {
    printout();
  });
  el.onclick = () => {
    console.log(`hls.interstitialsManager:`, hls.interstitialsManager);
  };
}

// Toggle HTMLVideoElement controls
function registerControlsToggle(container, video) {
  const html5Controls = document.querySelector('#controls-on');
  const html5ControlsOff = document.querySelector('#controls-off');
  html5Controls.onchange = html5ControlsOff.onchange = () => {
    const showHtml5Controls = html5Controls.checked;
    video.controls = showHtml5Controls;
    video.focus();
    showHtml5Controls
      ? container.classList.add('html5-controls')
      : container.classList.remove('html5-controls');
  };
}

// Page load
function getSearchParam(key) {
  const { searchParams } = new URL(location.href);
  const value = searchParams.get(key);
  return value ? decodeURIComponent(value) : null;
}

onPageLoad(
  getSearchParam('src') ||
    'https://f681a00ecbc6473898b8abe50fbaa3d7.mediatailor.us-west-2.amazonaws.com/v1/master/7fcb48ee1bc8d9517179f0aebae65226d3184e01/VodDemo/hls/bbb1min_two_ads_middle/bbb1min.m3u8?aws.insertionMode=GUIDED'
);
