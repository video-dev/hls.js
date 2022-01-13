/**
 * Create test stream
 * @param {string} url
 * @param {string} description
 * @param {boolean} [live]
 * @param {boolean} [abr]
 * @param {string[]} [skip_ua]
 * @returns {{url: string, description: string, live: boolean, abr: boolean, skip_ua: string[]}}
 */
function createTestStream(
  url,
  description,
  live = false,
  abr = true,
  skip_ua = []
) {
  return {
    url: url,
    description: description,
    live: live,
    abr: abr,
    skip_ua: skip_ua,
  };
}

/**
 * @param {Object} target
 * @param {Object} [config]
 * @returns {{url: string, description: string, live: boolean, abr: boolean, skip_ua: string[]}}
 */
function createTestStreamWithConfig(target, config) {
  if (typeof target !== 'object') {
    throw new Error('target should be object');
  }

  const testStream = createTestStream(
    target.url,
    target.description,
    target.live,
    target.abr,
    target.skip_ua
  );

  testStream.config = config;

  return testStream;
}

module.exports = {
  bbb: {
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    description: 'Big Buck Bunny - adaptive qualities',
    abr: true,
  },
  fdr: {
    url: 'https://cdn.jwplayer.com/manifests/pZxWPRg4.m3u8',
    description: 'FDR - CDN packaged, 4s segments, 180p - 1080p',
    abr: true,
  },
  bigBuckBunny480p: {
    url: 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8',
    description: 'Big Buck Bunny - 480p only',
    abr: false,
    skip_ua: ['internet explorer'],
  },
  arte: {
    url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    description: 'ARTE China,ABR',
    abr: true,
  },
  deltatreDAI: {
    url: 'https://test-streams.mux.dev/dai-discontinuity-deltatre/manifest.m3u8',
    description: 'Ad-insertion in event stream',
    abr: false,
    skip_ua: ['internet explorer'],
  },
  issue666: {
    url: 'https://playertest.longtailvideo.com/adaptive/issue666/playlists/cisq0gim60007xzvi505emlxx.m3u8',
    description:
      'Surveillance footage - https://github.com/video-dev/hls.js/issues/666',
    abr: false,
    skip_ua: ['internet explorer'],
  },
  closedCaptions: {
    url: 'https://playertest.longtailvideo.com/adaptive/captions/playlist.m3u8',
    description: 'CNN special report, with CC',
    abr: false,
  },
  customIvBadDts: {
    url: 'https://playertest.longtailvideo.com/adaptive/customIV/prog_index.m3u8',
    description: 'Custom IV with bad PTS DTS',
    abr: false,
  },
  oceansAES: {
    url: 'https://playertest.longtailvideo.com/adaptive/oceans_aes/oceans_aes.m3u8',
    description: 'AES-128 encrypted, ABR',
    abr: true,
  },
  tracksWithAES: {
    url: 'https://playertest.longtailvideo.com/adaptive/aes-with-tracks/master.m3u8',
    description: 'AES-128 encrypted, TS main with AAC audio track',
    abr: false,
  },
  mp3Audio: {
    url: 'https://playertest.longtailvideo.com/adaptive/vod-with-mp3/manifest.m3u8',
    description: 'MP3 VOD demo',
    abr: false,
  },
  mpegAudioOnly: {
    url: 'https://pl.streamingvideoprovider.com/mp3-playlist/playlist.m3u8',
    description: 'MPEG Audio Only demo',
    abr: false,
    skip_ua: ['internet explorer', 'MicrosoftEdge', 'firefox'],
  },
  fmp4: {
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
    description: 'HLS fMP4 Angel-One multiple audio-tracks',
    abr: true,
    skip_ua: ['internet explorer'],
  },
  fmp4Bitmovin: {
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s-fmp4/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    description: 'HLS fMP4 by Bitmovin',
    abr: true,
    skip_ua: ['internet explorer'],
  },
  fmp4BitmovinHevc: {
    url: 'https://bitmovin-a.akamaihd.net/content/dataset/multi-codec/hevc/stream_fmp4.m3u8',
    description:
      'HLS HEVC fMP4 by Bitmovin (Safari and Edge? only as of 2020-08)',
    abr: true,
    skip_ua: ['internet explorer'],
    skipFunctionalTests: true,
  },
  offset_pts: {
    url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    description: 'DK Turntable, PTS shifted by 2.3s',
    abr: true,
  },
  angelOneShakaWidevine: createTestStreamWithConfig(
    {
      url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine-hls/hls.m3u8',
      description:
        'Shaka-packager Widevine DRM (EME) HLS-fMP4 - Angel One Demo',
      abr: true,
      skip_ua: [
        'firefox',
        'safari',
        'internet explorer',
        { name: 'chrome', version: '69.0' },
      ],
    },
    {
      widevineLicenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
      emeEnabled: true,
    }
  ),
  audioOnlyMultipleLevels: {
    url: 'https://s3.amazonaws.com/qa.jwplayer.com/~alex/121628/new_master.m3u8',
    description: 'Multiple non-alternate audio levels',
    abr: true,
  },
  pdtDuplicate: {
    url: 'https://playertest.longtailvideo.com/adaptive/artbeats/manifest.m3u8',
    description: 'Duplicate sequential PDT values',
    abr: false,
  },
  pdtLargeGap: {
    url: 'https://playertest.longtailvideo.com/adaptive/boxee/playlist.m3u8',
    description: 'PDTs with large gaps following discontinuities',
    abr: false,
  },
  pdtBadValues: {
    url: 'https://playertest.longtailvideo.com/adaptive/progdatime/playlist2.m3u8',
    description: 'PDTs with bad values',
    abr: false,
  },
  pdtOneValue: {
    url: 'https://playertest.longtailvideo.com/adaptive/aviion/manifest.m3u8',
    description: 'One PDT, no discontinuities',
    abr: false,
  },
  noTrackIntersection: createTestStreamWithConfig(
    {
      url: 'https://s3.amazonaws.com/qa.jwplayer.com/~alex/123633/new_master.m3u8',
      description:
        'Audio/video track PTS values do not intersect; 10 second start gap',
      abr: false,
    },
    {
      avBufferOffset: 10.5,
    }
  ),
  altAudioAndTracks: {
    // url: 'https://wowzaec2demo.streamlock.net/vod-multitrack/_definst_/smil:ElephantsDream/elephantsdream2.smil/playlist.m3u',
    url: 'https://playertest.longtailvideo.com/adaptive/elephants_dream_v4/index.m3u8',
    description: 'Alternate audio tracks, and multiple VTT tracks',
    vendor: 'wowza',
    abr: true,
  },
  altAudioAudioOnly: createTestStreamWithConfig(
    {
      url: 'https://playertest.longtailvideo.com/adaptive/alt-audio-no-video/sintel/playlist.m3u8',
      description: 'Audio only with alternate audio track (Sintel)',
      abr: false,
    },
    {
      // the playlist segment durations are longer than the media. So much so, that when seeking near the end,
      // the timeline shifts roughly 10 seconds seconds back, and as a result buffering skips several segments
      // to adjust for the currentTime now being places at the very end of the stream.
      allowedBufferedRangesInSeekTest: 3,
    }
  ),
  altAudioMultiAudioOnly: {
    url: 'https://playertest.longtailvideo.com/adaptive/alt-audio-no-video/angel-one.m3u8',
    description: 'Audio only with multiple alternate audio tracks (Angel One)',
    abr: false,
  },
  muxedFmp4: {
    url: 'https://s3.amazonaws.com/qa.jwplayer.com/hlsjs/muxed-fmp4/hls.m3u8',
    description: 'Muxed av fmp4 - appended to "audiovideo" SourceBuffer',
    abr: false,
  },
  altAudioWithPdtAndStartGap: {
    url: 'https://playertest.longtailvideo.com/adaptive/hls-test-streams/test-audio-pdt/playlist.m3u8',
    description: 'PDT before each segment, 1.59s start gap',
    // Disable smooth switch on this stream. Test is flakey because of what looks like (auto)play issue. To be expected with this large a gap (for now).
    // abr: true,
    startSeek: true,
  },
  AppleAdvancedHevcAvcHls: {
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_adv_example_hevc/master.m3u8',
    description:
      'Advanced stream (HEVC/H.264, AC-3/AAC,  WebVTT, fMP4 segments)',
  },
  MuxLowLatencyHls: {
    url: 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
    description:
      'Low-Latency HLS sample of Big Buck Bunny loop and a timer. Restarts every 12 hours. (fMP4 segments)',
    live: true,
  },
  //   AppleLowLatencyHls: {
  //     url: 'https://ll-hls-test.apple.com/master.m3u8',
  //     description: 'Apple Low-Latency HLS sample (TS segments)',
  //     live: true,
  //   },
  //   AppleLowLatencyCmafHls: {
  //     url: 'https://ll-hls-test.apple.com/cmaf/master.m3u8',
  //     description: 'Apple Low-Latency HLS sample (fMP4 segments)',
  //     live: true,
  //   },
  groupIds: {
    url: 'https://mtoczko.github.io/hls-test-streams/test-group/playlist.m3u8',
    description: 'Group-id: subtitle and audio',
    abr: true,
    skipFunctionalTests: true,
  },
  redundantLevelsWithTrackGroups: {
    url: 'https://playertest.longtailvideo.com/adaptive/elephants_dream_v4/redundant.m3u8',
    description: 'Redundant levels with subtitle and audio track groups',
    abr: true,
    skipFunctionalTests: true,
  },
  startDelimiterOverlappingBetweenPESPackets: {
    url: 'https://hlsjs-test-streams-wistia.s3.amazonaws.com/start-delimiter.m3u8',
    description: `A stream with the start delimiter overlapping between PES packets.
       Related to https://github.com/video-dev/hls.js/issues/3834, where Apple Silicon chips throw decoding errors if
       NAL units are not starting right at the beginning of the PES packet when using hardware accelerated decoding.`,
    abr: false,
  },
};
