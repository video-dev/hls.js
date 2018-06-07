export function getSelfScope () {
  let window;
  if (typeof self === 'undefined') {
    // workaround for Node.js bundling apps
    // @see https://github.com/video-dev/hls.js/pull/1642
    window = {}; // a Node app can not expect any DOM features if it doesn't define `self`
    // as common scope for Window and Worker.
  } else {
    // see https://stackoverflow.com/a/11237259/589493
    /* eslint-disable-next-line no-undef */
    window = self; // safeguard for code that might run both on worker and main thread
  }
  return window;
}
