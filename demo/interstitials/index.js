/* global Hls */

(function (sourceURL) {
  if (!Hls.isSupported()) {
    // HLS.js not supported
    return;
  }

  const video = document.getElementById('video');

  const hls = (self.hls = new Hls({
    debug: true,
    enableWorker: false,
  }));
  hls.loadSource(sourceURL);
  hls.attachMedia(video);
})(
  getSearchParam('src') ||
    'https://f681a00ecbc6473898b8abe50fbaa3d7.mediatailor.us-west-2.amazonaws.com/v1/master/7fcb48ee1bc8d9517179f0aebae65226d3184e01/VodDemo/hls/bbb1min_two_ads_middle/bbb1min.m3u8?aws.insertionMode=GUIDED'
);

function getSearchParam(key) {
  const { searchParams } = new URL(location.href);
  const value = searchParams.get(key);
  return value ? decodeURIComponent(value) : null;
}
