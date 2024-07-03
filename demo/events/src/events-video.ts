const videoEvents = [
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
const videoTags: HTMLVideoElement[] = [];
const eventListeners: Record<string, EventListener>[] = [];
const docCreateElement = document.createElement;
const MutationObserver = window.MutationObserver; // || window.WebKitMutationObserver || window.MozMutationObserver;

document.createElement = function () {
  const element = docCreateElement.apply(document, arguments);
  if (arguments[0] === 'video') {
    videoTags.push(element);
  }
  return element;
};

export function attachListenersToVideoElements(genericEventHandler) {
  videoTags.forEach((video, i) => {
    const tagListeners = eventListeners[i] || (eventListeners[i] = {});

    // MutationObserver is not available in some environments (Webkit)
    if (MutationObserver) {
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          const attributeName = mutation.attributeName;
          if (attributeName === null) {
            return;
          }
          genericEventHandler(
            video[attributeName],
            `video[${i}].${attributeName}`,
            'video'
          );
        });
      });
      observer.observe(video, {
        attributes: true,
      });
    }

    const load = video.load;
    const pause = video.pause;
    const play = video.play;
    video.load = function () {
      const result = load.call(this);
      genericEventHandler(result, `video[${i}].load()`, 'video');
      return result;
    };
    video.pause = function () {
      const result = pause.call(this);
      genericEventHandler(result, `video[${i}].pause()`, 'video');
      return result;
    };
    video.play = function () {
      const result = play.call(this);
      genericEventHandler(result, `video[${i}].play()`, 'video');
      return result;
    };

    videoEvents.forEach((eventName) => {
      const eventHandler = function (event) {
        genericEventHandler(
          {
            event,
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
          `video[${i}]>${event.type}`,
          'video'
        );
      };
      tagListeners[eventName] = eventHandler;
      video.addEventListener(eventName, eventHandler);
    });
  });
}

export function resetVideoElements() {
  eventListeners.forEach((tagListeners, i) => {
    const video = videoTags[i];
    Object.keys(tagListeners).forEach((eventName) => {
      video.removeEventListener(eventName, tagListeners[eventName]);
    });
  });
  videoTags.length = 0;
  eventListeners.length = 0;
}
