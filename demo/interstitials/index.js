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
}

function registerPlayer(container, video, hls) {
  let shouldPlay = true;
  const displayTime = 'playout';
  const timeCurrent = document.querySelector('#current-time');
  const timeDuration = document.querySelector('#duration');

  registerInterstitialTimelineCanvas(
    document.querySelector('#timeline-canvas'),
    hls,
    displayTime
  );

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
  }

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
    timeCurrent.textContent = hhmmss(hls.interstitialsManager[displayTime].currentTime).replace(/^00?:?/, '');
    timeDuration.textContent = ' / ' + hhmmss(hls.interstitialsManager[displayTime].duration).replace(/^00?:?/, '');
  };
  video.ontimeupdate = (e) =>{
    const playingItem = hls.interstitialsManager.playingItem;
    if (playingItem?.event) {
      const timeRemaining = Math.ceil(playingItem.playout.end - hls.interstitialsManager.playout.currentTime);
      timeDuration.textContent = '';
      timeCurrent.textContent = `${timeRemaining} seconds remaining`;
    } else {
      displayTimeAndDuration();
    }
  };
  video.ondurationchange = (e) =>{
    if (hls.interstitialsManager.playingItem?.event) {
      timeDuration.textContent = '';
    } else {
      displayTimeAndDuration();
    }
  };
}

function hhmmss(seconds) {
  const date = new Date();
  const tzOffset = (new Date(0)).getTimezoneOffset() * 60000;
  date.setTime(tzOffset + seconds * 1000);
  return date.toLocaleTimeString('eo', { hour12: false });
}

function registerInterstitialTimelineCanvas(
  canvas,
  hls,
  timelineType
) {
  const runningInstance = canvas.instance;
  if (runningInstance) {
    runningInstance.destroy();
  }
  canvas.instance = new InterstitialTimelineCanvas(canvas, hls, timelineType);
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
    ctx.fillStyle = 'black';
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
      ctx.fillStyle = 'gray';
      ctx.fillRect(xCurrentTime, 2, xBufferedEnd - xCurrentTime, height - 4);
    }
    // current time
    ctx.fillStyle = 'rgb(16,128,255)';
    ctx.fillRect(xCurrentTime - 0.5, 0, 2, height);
  }
}

function getSearchParam(key) {
  const { searchParams } = new URL(location.href);
  const value = searchParams.get(key);
  return value ? decodeURIComponent(value) : null;
}

onPageLoad(
  getSearchParam('src') ||
    'https://f681a00ecbc6473898b8abe50fbaa3d7.mediatailor.us-west-2.amazonaws.com/v1/master/7fcb48ee1bc8d9517179f0aebae65226d3184e01/VodDemo/hls/bbb1min_two_ads_middle/bbb1min.m3u8?aws.insertionMode=GUIDED'
);
