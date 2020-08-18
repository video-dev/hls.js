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
  bbb: {
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    description: 'Big Buck Bunny - adaptive qualities',
    abr: true
  },
  fdr: {
    url: 'https://cdn.jwplayer.com/manifests/pZxWPRg4.m3u8',
    description: 'FDR - CDN packaged, 4s segments, 180p - 1080p',
    abr: true
  },
  bigBuckBunny480p: {
    url: 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8',
    description: 'Big Buck Bunny - 480p only',
    abr: false,
    blacklist_ua: ['internet explorer']
  },
  arte: {
    url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    description: 'ARTE China,ABR',
    abr: true
  },
  deltatreDAI: {
    url: 'https://test-streams.mux.dev/dai-discontinuity-deltatre/manifest.m3u8',
    description: 'Ad-insertion in event stream',
    abr: false,
    blacklist_ua: ['internet explorer']
  },
  issue666: {
    url: 'https://playertest.longtailvideo.com/adaptive/issue666/playlists/cisq0gim60007xzvi505emlxx.m3u8',
    description: 'Surveillance footage - https://github.com/video-dev/hls.js/issues/666',
    abr: false,
    blacklist_ua: ['internet explorer']
  },
  closedCaptions: {
    url: 'https://playertest.longtailvideo.com/adaptive/captions/playlist.m3u8',
    description: 'CNN special report, with CC',
    abr: false
  },
  customIvBadDts: {
    url: 'https://playertest.longtailvideo.com/adaptive/customIV/prog_index.m3u8',
    description: 'Custom IV with bad PTS DTS',
    abr: false
  },
  oceansAES: {
    url: 'https://playertest.longtailvideo.com/adaptive/oceans_aes/oceans_aes.m3u8',
    description: 'AES encrypted,ABR',
    abr: true
  },
  /*
  bbbAES: {
    url: 'https://test-streams.mux.dev/bbbAES/playlists/sample_aes/index.m3u8',
    description: 'SAMPLE-AES encrypted',
    live: false,
    abr: false
  },
  */
  mp3Audio: {
    url: 'https://playertest.longtailvideo.com/adaptive/vod-with-mp3/manifest.m3u8',
    description: 'MP3 VOD demo',
    abr: false
  },
  mpegAudioOnly: {
    url: 'https://pl.streamingvideoprovider.com/mp3-playlist/playlist.m3u8',
    description: 'MPEG Audio Only demo',
    abr: false,
    blacklist_ua: ['internet explorer', 'MicrosoftEdge', 'firefox']
  },
  fmp4: {
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
    description: 'HLS fMP4 Angel-One multiple audio-tracks',
    abr: true,
    blacklist_ua: ['internet explorer']
  },
  fmp4Bitmovin: {
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s-fmp4/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    description: 'HLS fMP4 by Bitmovin',
    abr: true,
    blacklist_ua: ['internet explorer']
  },
  offset_pts: {
    url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    description: 'DK Turntable, PTS shifted by 2.3s',
    abr: true
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
    abr: true,
    blacklist_ua: ['firefox', 'safari', 'internet explorer']
  }, {
    widevineLicenseUrl: 'http://cwip-shaka-proxy.appspot.com/no_auth',
    emeEnabled: true
  }),
  audioOnlyMultipleLevels: {
    url: 'https://s3.amazonaws.com/qa.jwplayer.com/~alex/121628/new_master.m3u8',
    description: 'Multiple non-alternate audio levels',
    abr: true
  },
  pdtDuplicate: {
    url: 'https://playertest.longtailvideo.com/adaptive/artbeats/manifest.m3u8',
    description: 'Stream with duplicate sequential PDT values',
    abr: false
  },
  pdtLargeGap: {
    url: 'https://playertest.longtailvideo.com/adaptive/boxee/playlist.m3u8',
    description: 'PDTs with large gaps following discontinuities',
    abr: false
  },
  pdtBadValues: {
    url: 'https://playertest.longtailvideo.com/adaptive/progdatime/playlist2.m3u8',
    description: 'PDTs with bad values',
    abr: false
  },
  pdtOneValue: {
    url: 'https://playertest.longtailvideo.com/adaptive/aviion/manifest.m3u8',
    description: 'One PDT, no discontinuities',
    abr: false
  },
  noTrackIntersection: createTestStreamWithConfig({
    url: 'https://s3.amazonaws.com/qa.jwplayer.com/~alex/123633/new_master.m3u8',
    description: 'Audio/video track PTS values do not intersect; 10 second start gap',
    abr: false
  }, {
    avBufferOffset: 10.5
  }),
  // altAudioNoVideoCodecSignaled: {
  //   url: 'https://d35u71x3nb8v2y.cloudfront.net/4b711b97-513c-4d36-ad29-298ab23a2e5e/3cbf1114-b2f4-4320-afb3-f0f7eeeb8630/playlist.m3u8',
  //   description: 'Alternate audio track, but no video codec is signaled in the master manifest'
  // },
  altAudioAndTracks: {
    url: 'https://wowzaec2demo.streamlock.net/vod-multitrack/_definst_/smil:ElephantsDream/elephantsdream2.smil/playlist.m3u',
    description: 'Alternate audio tracks, and multiple VTT tracks',
    abr: true
  },
  altAudioAudioOnly: createTestStreamWithConfig({
    url: 'https://playertest.longtailvideo.com/adaptive/alt-audio-no-video/sintel/playlist.m3u8',
    description: 'Audio only with alternate audio track (Sintel)',
    abr: false
  }, {
    // the playlist segment durations are longer than the media. So much so, that when seeking near the end,
    // the timeline shifts roughly 10 seconds seconds back, and as a result buffering skips several segments
    // to adjust for the currentTime now being places at the very end of the stream.
    allowedBufferedRangesInSeekTest: 3
  }),
  altAudioMultiAudioOnly: {
    url: 'https://playertest.longtailvideo.com/adaptive/alt-audio-no-video/angel-one.m3u8',
    description: 'Audio only with multiple alternate audio tracks (Angel One)',
    abr: false
  },
  muxedFmp4: {
    url: 'https://s3.amazonaws.com/qa.jwplayer.com/hlsjs/muxed-fmp4/hls.m3u8',
    description: 'Muxed av fmp4 - appended to "audiovideo" SourceBuffer',
    abr: false
  },
  altAudioWithPdtAndStartGap: {
    url: 'https://playertest.longtailvideo.com/adaptive/hls-test-streams/test-audio-pdt/playlist.m3u8',
    description: 'PDT before each segment, 1.59s start gap',
    // Disable smooth switch on this stream. Test is flakey because of what looks like (auto)play issue. To be expected with this large a gap (for now).
    // abr: true,
    startSeek: true
  }
};
