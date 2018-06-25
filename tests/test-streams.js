/**
 * Create test stream
 * @param {string} url
 * @param {string} description
 * @param {boolean} [live]
 * @param {boolean} [abr]
 * @param {string[]} [blacklist_ua]
 * @returns {{url: string, description: string, live: boolean, abr: boolean, blacklist_ua: string[]}}
 */
function createTestStream (url, description, live = false, abr = true, blacklist_ua = []) {
  return {
    url,
    description,
    live,
    abr,
    blacklist_ua
  };
}

/**
 * @param {Object} target
 * @param {Object} [config]
 * @returns {{url: string, description: string, live: boolean, abr: boolean, blacklist_ua: string[]}}
 */
function createTestStreamWithConfig (target, config) {
  if (typeof target !== 'object') {
    throw new Error('target should be object');
  }

  const testStream = createTestStream(target.url, target.description, target.live, target.abr, target.blacklist_ua);

  testStream.config = config;

  return testStream;
}

module.exports = {
  bbb: createTestStreamWithConfig({
    url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8',
    description: 'Big Buck Bunny - adaptive qualities'
  },
  {
    // try to workaround test failing because of slow seek on Chrome/Win10
    nudgeMaxRetry: 5
  }
  ),
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
    'url': 'http://cdn3.screen9.com/media/c/W/cW87csHkxsgu5TV1qs78aA_auto_hls.m3u8?auth=qlUjeCtbVdtkDfZYrtveTIVUXX1yuSqgF8wfWabzKpX72r-d5upW88-FHuyRRdnZA_1PKRTGAtTt_6Z-aj22kw',
    'description': 'hls.js/issues/649',
    'live': false,
    'abr': false
  },
  closedCaptions: {
    'url': 'http://playertest.longtailvideo.com/adaptive/captions/playlist.m3u8',
    'description': 'CNN special report, with CC',
    'live': false,
    'abr': false,
    'blacklist_ua': ['safari']
  },
  oceansAES: {
    'url': 'http://playertest.longtailvideo.com/adaptive/oceans_aes/oceans_aes.m3u8',
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
  },
  {
    widevineLicenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
    emeEnabled: true
  }
  ),
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
