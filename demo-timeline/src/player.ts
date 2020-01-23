import { updatePlayer } from './timeline-chart';

const Hls = self.Hls;

let hls = null;
let config = null;
let url = null;
let width = null;

export function updateConfig (hlsjsConfig) {
  config = hlsjsConfig;
  loadSelectedStream();
}

export function updateStreamUrl (streamUrl) {
  url = streamUrl;
  loadSelectedStream();
}

export function updateVideoWidth (cssWidth) {
  width = cssWidth;
  updateStreamPermalink();
}

function loadSelectedStream () {
  if (!config || !url) {
    return;
  }

  if (!Hls.isSupported()) {
    console.error('This browser is not supported by Hls.js');
    return;
  }

  if (hls) {
    hls.destroy();
    hls = null;
  }

  updateStreamPermalink();

  const video = document.querySelector('#video') as HTMLMediaElement;

  console.log('Using Hls.js config:', config);
  // Copy the config so that it's not mutated by Hls.js
  const configCopy = Object.assign({}, config);
  self.hls = hls = new Hls(configCopy);

  updatePlayer(hls);

  console.log(`Loading ${url}`);
  hls.loadSource(url);
  hls.attachMedia(video);
}

function updateStreamPermalink () {
  const streamInput = document.querySelector('#streamURL') as HTMLInputElement;
  const streamPermalink = document.querySelector('#StreamPermalink') as HTMLElement;
  const serializedConfig = btoa(JSON.stringify(config));
  const baseURL = location.origin + location.pathname;
  const streamURL = streamInput.value;
  let permalinkURL = `${baseURL}?src=${encodeURIComponent(streamURL)}`;
  if (width) {
    permalinkURL += `&width=${encodeURIComponent(width)}`;
  }
  permalinkURL += `&config=${serializedConfig}`;
  streamPermalink.innerHTML = `<a href="${permalinkURL}">${permalinkURL}</a>`;
}
