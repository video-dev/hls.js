/*
 * This document has been adapted from https://ott.dolby.com/codec_test/index.html
 * It has been modified to use HLS assets as input for the list of audio and video configurations that are tested.
 * The HLS assets are loaded by HLS.js to determine the available configurations.
 *
 */

function canPlayType(mime) {
  const video = document.createElement('video');
  const canPlayType_result = video.canPlayType(mime);
  return canPlayType_result;
}

function isTypeSupported(mime) {
  const msource = {
    result: '',
    color: '',
  };
  try {
    const MediaSourceClass = self.ManagedMediaSource || MediaSource;
    msource.result = MediaSourceClass.isTypeSupported(mime);
    msource.color = msource.result ? 'ok' : 'fail';
  } catch (e) {
    msource.result = 'n/a';
    msource.color = 'unavailable';
  }
  return msource;
}

async function mediaCapsDecodingInfo(
  mime,
  type,
  spatialRendering,
  variantOrTrack
) {
  let mediaConfig;
  if (type === 'audio') {
    if (spatialRendering) {
      mediaConfig = {
        type: 'media-source',
        audio: {
          contentType: mime,
          spatialRendering: true,
        },
      };
    } else {
      mediaConfig = {
        type: 'media-source',
        audio: {
          contentType: mime,
        },
      };
    }
    if (variantOrTrack?.attrs.CHANNELS) {
      mediaConfig.audio.channels = variantOrTrack.attrs.CHANNELS.split('/')[0];
    }
  } else if (type === 'video') {
    mediaConfig = {
      type: 'media-source',
      video: {
        contentType: mime,
        width: 1280,
        height: 720,
        bitrate: 1000,
        framerate: 24,
      },
    };
    if (variantOrTrack) {
      if (variantOrTrack.attrs.RESOLUTION) {
        mediaConfig.video.width = parseInt(variantOrTrack.width);
        mediaConfig.video.height = parseInt(variantOrTrack.height);
      }
      if (variantOrTrack.attrs['FRAME-RATE']) {
        mediaConfig.video.framerate = parseFloat(
          variantOrTrack.frameRate || variantOrTrack.attrs['FRAME-RATE']
        );
      }
      const videoRange = variantOrTrack.attrs['VIDEO-RANGE'];
      if (videoRange && videoRange !== 'SDR') {
        mediaConfig.video.transferFunction = videoRange.toLowerCase();
        // These should be optional, and specifying the wrong HDR metadata type could result in failure
        // mediaConfig.video.colorGamut = 'rec2020'; // "srgb", "p3", "rec2020"
        // HDR10 = 'smpteSt2086',
        // DoVi = 'smpteSt2094-10',
        // HDR10Plus = 'smpteSt2094-40',
        if (videoRange === 'PQ') {
          if (variantOrTrack.videoCodec.startsWith('dv')) {
            mediaConfig.video.hdrMetadataType = 'smpteSt2094-10';
          } else {
            // Just check for HDR10 metadata support since HDR10Plus is backwards compatible
            mediaConfig.video.hdrMetadataType = 'smpteSt2086';
          }
        }
      }
      mediaConfig.video.bitrate = parseInt(
        variantOrTrack.averageBitrate || variantOrTrack.bitrate
      );
    }
  }

  return await mediaCapsDecodingInfoForConfig(mediaConfig);
}

async function mediaCapsDecodingInfoForConfig(mediaConfig) {
  const mediacap = {
    results: null,
    color: '',
    message: '',
  };

  if ('mediaCapabilities' in navigator) {
    const results = (mediacap.results =
      await navigator.mediaCapabilities.decodingInfo(mediaConfig));
    mediacap.color = results.supported ? 'ok' : 'fail';
    mediacap.message = (results.supported ? '' : 'not ') + 'supported';
    if (results.supported && results.smooth === false) {
      mediacap.message += ', not smooth';
    }
    if (results.supported && results.powerEfficient === false) {
      mediacap.message += ', not power efficient';
    }
  } else {
    mediacap.message = 'n/a';
    mediacap.color = 'unavailable';
  }
  mediacap.config = mediaConfig;

  return mediacap;
}

async function addMimeChecks(table, mime, desc, type, variantOrTrack) {
  const mediacap = await mediaCapsDecodingInfo(
    mime,
    type,
    false,
    variantOrTrack
  );
  const canPlayMimeType = canPlayType(mime);
  const mimeTypeSupported = isTypeSupported(mime);
  const tr = appendNewEl(table, 'tr');
  const mediaCapsConfig = JSON.stringify(mediacap.config, null, 2);
  tr.setAttribute('title', mediaCapsConfig);
  tr.onclick = () => {
    document.getElementById('custom-config').value = mediaCapsConfig;
    document.getElementById('custom-result').textContent = '';
  };
  if (variantOrTrack) {
    const mediaContainer = appendNewEl(tr, 'td', {
      className: 'media-container',
    });
    if (!desc.startsWith('SUPPLEMENTAL-CODECS')) {
      const url = variantOrTrack.uri || variantOrTrack.url;
      const media = appendNewEl(mediaContainer, type, { className: 'media' });
      media.controls = true;
      media.muted = false;
      media.crossOrigin = 'anonymous';
      media.playsInline = true;
      media.disableRemotePlayback = true;
      // Native embed in Safari only
      const hasSafariAirplayAvailability =
        !!self.WebKitPlaybackTargetAvailabilityEvent;
      const setupInHlsJs = () => {
        const assetPlayerId = url
          .split('/')
          .splice(-2)
          .join('_')
          .replace(/\.m3u8.*$/, '');
        const hlsPreview = new self.Hls({
          assetPlayerId,
          debug: {
            log: (a, b) => {
              if (/creating sourceBuffer|eme/.test(a + b)) {
                console.log(assetPlayerId, a, b);
              }
            },
            info: () => null,
          },
          enableWorker: false,
          maxMaxBufferLength: 1,
          emeEnabled: true,
          drmSystems,
          licenseXhrSetup,
          licenseResponseCallback,
        });
        media.hls = hlsPreview;
        hlsPreview.on(self.Hls.Events.ERROR, (name, data) => {
          if (data.fatal) {
            self.setTimeout(() => {
              if (media.hls) {
                media.hls.destroy();
                media.hls = null;
                mediaContainer.className = 'fail';
                appendNewEl(
                  mediaContainer,
                  'p',
                  { className: 'error' },
                  data.error.message
                );
              }
            }, 0);
          }
        });
        hlsPreview.loadSource(url);
        hlsPreview.attachMedia(media);
      };
      if (
        canPlayType('application/vnd.apple.mpegurl') &&
        hasSafariAirplayAvailability
      ) {
        media.onerror = (error) => {
          appendNewEl(
            mediaContainer,
            'p',
            { className: 'error' },
            error.message
          );
          media.onerror = null;
        };
        media.onencrypted = () => {
          setupInHlsJs();
          appendNewEl(
            mediaContainer,
            'p',
            { className: 'maybe' },
            'media is encrypted: using hls.js/mortimer'
          );
          media.onencrypted = null;
        };
        media.src = url;
      } else {
        setupInHlsJs();
      }
    }
  }
  appendNewEl(tr, 'td', { id: mime }, desc);
  appendNewEl(tr, 'td', null, mime);
  if (variantOrTrack) {
    if (type === 'audio') {
      appendNewEl(tr, 'td', null, variantOrTrack.attrs.CHANNELS);
    } else {
      appendNewEl(tr, 'td', null, variantOrTrack.attrs.RESOLUTION);
    }
  }
  appendNewEl(
    tr,
    'td',
    {
      className:
        canPlayMimeType === ''
          ? 'fail'
          : canPlayMimeType === 'maybe'
            ? 'maybe'
            : 'ok',
    },
    canPlayMimeType.length > 0 ? canPlayMimeType : 'no'
  );
  appendNewEl(
    tr,
    'td',
    { className: mimeTypeSupported.color },
    '' + mimeTypeSupported.result
  );
  appendNewEl(tr, 'td', { className: mediacap.color }, mediacap.message);
  if (type === 'audio') {
    const mediacap = await mediaCapsDecodingInfo(
      mime,
      type,
      true,
      variantOrTrack
    );
    appendNewEl(tr, 'td', { className: mediacap.color }, mediacap.message);
  }
}

function appendNewEl(parent, name, attributes, textContent = '') {
  const el = document.createElement(name);
  if (attributes) {
    Object.keys(attributes).forEach((attr) => {
      el[attr] = attributes[attr];
    });
  }
  if (textContent) {
    el.textContent = textContent;
  }
  parent.appendChild(el);
  return el;
}

function emptyEl(parent) {
  while (parent.childElementCount) {
    parent.removeChild(parent.children[parent.childElementCount - 1]);
  }
}

function createTableHeader(div, type, options) {
  const t = appendNewEl(div, 'table');
  const tr = appendNewEl(t, 'tr');
  if (options) {
    appendNewEl(tr, 'th', null, 'Media Element');
  }
  appendNewEl(tr, 'th', null, 'Codec');
  appendNewEl(tr, 'th', { className: 'mime' }, 'MIME');
  if (options) {
    if (type === 'audio') {
      appendNewEl(tr, 'th', null, 'CHANNELS');
    } else {
      appendNewEl(tr, 'th', null, 'RESOLUTION');
    }
  }
  appendNewEl(tr, 'th', null, 'canPlayType');
  appendNewEl(
    tr,
    'th',
    null,
    (self.ManagedMediaSource ? 'MMS' : '') + 'isTypeSupported'
  );
  if (type === 'audio') {
    appendNewEl(tr, 'th', null, 'mediaCapabilities no spatialRendering');
    appendNewEl(tr, 'th', null, 'mediaCapabilities with SpatialRendering');
  } else {
    appendNewEl(tr, 'th', null, 'mediaCapabilities');
  }
  return t;
}

function addParagraph(div, id, msg) {
  appendNewEl(div, 'h3', { id }, msg);
}

function addUA() {
  const p = document.createElement('p');
  p.innerHTML = navigator.userAgent;
  document.getElementById('ua').appendChild(p);
}

const AUDIO_CODECS = [
  { codec: 'ac-3', description: 'Dolby AC-3', type: 'audio' },
  { codec: 'ec-3', description: 'Dolby EC-3', type: 'audio' },
  { codec: 'ac-4', description: 'Dolby AC-4', type: 'audio' },
  { codec: 'mp4a.40.1', description: 'AAC main', type: 'audio' },
  { codec: 'mp4a.40.2', description: 'AAC-LC', type: 'audio' },
  { codec: 'mp4a.40.5', description: 'HE-AAC', type: 'audio' },
  { codec: 'mp4a.40.29', description: 'HE-AACv2', type: 'audio' },
  { codec: 'mp4a.40.42', description: 'xHE-AAC', type: 'audio' },
  {
    codec: 'mhm1.0x<0B || 0C || 0D || 0E>',
    description: 'MPEG-H LC',
    type: 'audio',
  },
  {
    codec: 'mhm1.0x<10 || 11 || 12 || 13>',
    description: 'MPEG-H Baseline',
    type: 'audio',
  },
];

const VIDEO_CODECS = [
  {
    container: 'mp4',
    codec: 'avc1.640028',
    description: 'AVC/H264',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dvh1.04.07',
    description: 'Dolby Vision Profile 4',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dvhe.04.07',
    description: 'Dolby Vision Profile 4',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dvh1.05.07',
    description: 'Dolby Vision Profile 5',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dvhe.05.07',
    description: 'Dolby Vision Profile 5',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dvh1.08.07',
    description: 'Dolby Vision Profile 8',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dvhe.08.07',
    description: 'Dolby Vision Profile 8',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dvav.09.05',
    description: 'Dolby Vision Profile 9',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'dva1.09.05',
    description: 'Dolby Vision Profile 9',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'hev1.1.6.L93.B0',
    description: 'HEVC/H265',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'hvc1.1.6.L93.B0',
    description: 'HEVC/H265',
    type: 'video',
  },
  {
    container: 'mp4',
    codec: 'av01.0.01M.08',
    description: 'AOM Video Codec (AV1)',
    type: 'video',
  },
  { container: 'webm', codec: 'vp8', description: 'VP8 video', type: 'video' },
  {
    container: 'webm',
    codec: 'vp09.00.10.08',
    description: 'VP9 video',
    type: 'video',
  },
];

function createTableFromHlsOptions(audioOptions, videoOptions) {
  const results = document.getElementById('results');
  emptyEl(results);

  if (audioOptions.length) {
    addParagraph(results, 'audio_codecs', 'Audio');
    const audioTable = createTableHeader(results, 'audio', audioOptions);
    audioOptions.forEach((track) => {
      const codec = track.audioCodec;
      const audioCodecInfo = AUDIO_CODECS.find((c) => c.codec === codec);
      addMimeChecks(
        audioTable,
        `audio/mp4; codecs=${codec}`,
        `${audioCodecInfo?.description}`,
        'audio',
        track
      );
    });
  }

  if (videoOptions.length) {
    addParagraph(results, 'video_codecs', 'Video');
    const videoTable = createTableHeader(results, 'video', videoOptions);
    videoOptions.forEach((variant) => {
      const codec = fillInMissingAV01Params(variant.videoCodec);
      const videoCodecInfo =
        VIDEO_CODECS.find((c) => c.codec === codec) ||
        VIDEO_CODECS.find((c) =>
          codec.startsWith(c.codec.split('.').slice(0, 2).join('.'))
        ) ||
        VIDEO_CODECS.find((c) => codec.startsWith(c.codec.split('.')[0]));
      const videoRange = variant.attrs['VIDEO-RANGE'];
      addMimeChecks(
        videoTable,
        `video/mp4;codecs=${codec}`,
        `${videoCodecInfo?.description}${
          videoRange && videoRange !== 'SDR' ? ' [' + videoRange + ']' : ''
        } @${(variant.bitrate / 1e6).toFixed(1).replace(/\.0$/, '')}Mbps`,
        'video',
        variant
      );
      if (variant.attrs['SUPPLEMENTAL-CODECS']) {
        const supplementalCodec =
          variant.attrs['SUPPLEMENTAL-CODECS'].split('/')[0];
        addMimeChecks(
          videoTable,
          `video/mp4;codecs=${supplementalCodec}`,
          `SUPPLEMENTAL-CODECS: ${variant.attrs['SUPPLEMENTAL-CODECS']}`,
          'video',
          variant
        );
      }
    });
  }

  addParagraph(
    results,
    'custom_codecs',
    'Custom MediaCapabilities Decoding Configuration'
  );
  const customInput = appendNewEl(results, 'textarea', {
    id: 'custom-config',
    name: 'custom-config',
    rows: 5,
    value: '{}',
  });
  const customButton = appendNewEl(results, 'input', {
    id: 'custom-config-submit',
    type: 'submit',
    value: 'Check Custom Config',
  });
  const customResult = appendNewEl(results, 'div', {
    id: 'custom-result',
  });

  customButton.onclick = async function () {
    customResult.textContent = '';
    const config = JSON.parse(customInput.value);
    console.log(
      `navigator.mediaCapabilities.decodingInfo(${JSON.stringify(
        config,
        null,
        2
      ).replace(/^(\s*)"([^"]+)":/gm, '$1$2:')}).then((r) => console.log(r));`
    );
    const mediacap = await mediaCapsDecodingInfoForConfig(config);
    customResult.className = mediacap.color;
    customResult.textContent = mediacap.message;
    console.log(mediacap.results);
  };
}

self.onload = async function () {
  addUA();
  // The original Dolby test page iterated through AUDIO_CODECS and VIDEO_CODECS constants:
  //
  //     const results = document.getElementById('results');
  //     let table, i;
  //     addParagraph(results, 'audio_codecs', 'Audio');
  //     table = createTableHeader(results, 'audio');
  //     for (i in AUDIO_CODECS) {
  //         const codec = AUDIO_CODECS[i].codec;
  //         addMimeChecks(table, `audio/mp4; codecs="${codec}"`, AUDIO_CODECS[i].description, AUDIO_CODECS[i].type);
  //     };

  //     addParagraph(results, 'video_codecs', 'Video');
  //     table = createTableHeader(results, 'video');
  //     for (i in VIDEO_CODECS) {
  //         const codec = VIDEO_CODECS[i].codec;
  //         addMimeChecks(table, `video/${VIDEO_CODECS[i].container} ; codecs="${codec}"`, VIDEO_CODECS[i].description, VIDEO_CODECS[i].type);
  //     }
  const textInput = document.getElementById('hls-assets');

  document.getElementById('hls-assets-submit').onclick = () => {
    self.history.pushState(null, '', location.origin + location.pathname);
    loadHlsAssets();
  };

  document.getElementById('hls-assets-reset').onclick = () => {
    localStorage.removeItem('hls-codec-test-asset-list');
    self.history.pushState(null, '', location.origin + location.pathname);
    textInput.value = '';
    loadHlsAssets();
  };

  const hlsAssets = localStorage.getItem('hls-codec-test-asset-list');
  if (hlsAssets) {
    textInput.value = hlsAssets;
  }

  loadHlsAssets();
};

async function loadHlsAssets() {
  const textInput = document.getElementById('hls-assets');
  let hlsAssets = textInput.value;
  let fromURL = false;
  if (!hlsAssets || !hlsAssets.trim()) {
    localStorage.removeItem('hls-codec-test-asset-list');
    hlsAssets = `https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/main.m3u8
    https://cali.apple.com/MoreMedia/amt2/dolby_v8.1/PLT_dvh08/main.m3u8
    https://cali.apple.com/MoreMedia/amt2/AV1/av1_ffmpeg_converted/main_av1_and_hevc_SDR10bit_HDR10_30fps_clear.m3u8
    https://imgdry.apple.com/users/rwalch/streams/hls/DolbyVision84/index.m3u8`;
  }

  const params = new self.URL(location.href).searchParams;
  if (params.has('adv')) {
    hlsAssets = `https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/main.m3u8`;
    fromURL = true;
  } else if (params.has('dv')) {
    hlsAssets = `/adaptive/DolbyVision81/index.m3u8
/adaptive/DolbyVision84/index.m3u8`;
    fromURL = true;
  } else if (params.has('src')) {
    hlsAssets = params.get('src');
    fromURL = true;
  }

  const hlsAssetList = hlsAssets
    .split(/[\s,]+/)
    .filter((s) => !!s)
    .map((s) => s.trim());
  const hlsAssetsToSave = hlsAssetList.join('\r\n');
  textInput.value = hlsAssetsToSave;

  const resultsParent = document.getElementById('results');
  emptyEl(resultsParent);
  appendNewEl(resultsParent, 'p', null, 'Loading HLS asset list...');

  return Promise.all(
    hlsAssetList.map((hlsAsset) => {
      return loadAndParseHLS(hlsAsset);
    })
  )
    .then((results) => {
      const { audioTracks, levels, sessionKeys } = results.reduce(
        (reduced, result) => {
          reduced.audioTracks = reduced.audioTracks.concat(result.audioTracks);
          reduced.levels = reduced.levels.concat(result.levels);

          const hls = result.hls;
          if (hls) {
            result.levels.forEach((level) => {
              hls.getMediaDecodingInfo(level).then((result) => {
                console.log(level.attrs.CODECS, result, sessionKeys);
              });
            });
          }
          return reduced;
        },
        { audioTracks: [], levels: [] }
      );

      if (audioTracks.length === 0 && levels.length === 0) {
        appendNewEl(
          resultsParent,
          'p',
          { className: 'error' },
          'Error: Did not find any HLS Variants with video or audio Media Options in provided asset list.'
        );
        return;
      }

      if (!fromURL) {
        localStorage.setItem('hls-codec-test-asset-list', hlsAssetsToSave);
      }

      const audioOptions = Object.values(
        audioTracks
          .sort((a, b) => {
            return a.audioCodec - b.audioCodec;
          })
          .reduce((result, track) => {
            const audioKey = `${track.audioCodec}_${track.attrs.CHANNELS}`;
            const picked = result[audioKey];
            if (!picked) {
              result[audioKey] = track;
            }
            return result;
          }, {})
      );

      const videoOptions = Object.values(
        levels
          .filter((a) => !!a.videoCodec)
          .sort((a, b) => {
            // sort on height before bitrate for cap-level-controller
            if ((a.height || 0) !== (b.height || 0)) {
              return (a.height || 0) - (b.height || 0);
            }
            if ((a.frameRate || 0) !== (b.frameRate || 0)) {
              return (a.frameRate || 0) - (b.frameRate || 0);
            }
            if (a.videoCodec !== b.videoCodec) {
              return a.videoCodec - b.videoCodec;
            }
            if (a.bitrate !== b.bitrate) {
              return a.bitrate - b.bitrate;
            }
            return 0;
          })
          .reduce((result, variant) => {
            const videoKey = `${variant.videoCodec}_${variant.attrs['SUPPLEMENTAL-CODECS']}_${variant.attrs['VIDEO-RANGE']}`;
            const picked = result[videoKey];
            if (!picked || variant.bitrate < picked.bitrate) {
              result[videoKey] = variant;
            }
            return result;
          }, {})
      );

      createTableFromHlsOptions(audioOptions, videoOptions);
    })
    .catch((error) => {
      let errorMessage = `Error: Unable to load all HLS assets: ${error.message}`;
      if (error.data?.url) {
        errorMessage += ` ("${error.data.url}")`;
      }
      appendNewEl(resultsParent, 'p', { className: 'error' }, errorMessage);
    });
}

async function loadAndParseHLS(url) {
  return new Promise((resolve, reject) => {
    const assetPlayerId = url
      .split('/')
      .splice(-2)
      .join('_')
      .replace(/\.m3u8.*$/, '');
    const hls = new self.Hls({
      assetPlayerId,
      debug: {
        log: (a, b) => {
          if (/eme/.test(a + b)) {
            console.log(assetPlayerId, a, b);
          }
        },
        info: () => null,
      },
      enableWorker: false,
      emeEnabled: true,
      drmSystems,
      licenseXhrSetup,
      licenseResponseCallback,
    });
    hls.on(self.Hls.Events.ERROR, (name, data) => {
      const error = data.error;
      data.error = null;
      error.data = data;
      reject(error);
    });
    hls.on(self.Hls.Events.MANIFEST_PARSED, (name, data) => {
      const { audioTracks, levels, sessionKeys } = data;
      resolve({ audioTracks, levels, sessionKeys, hls });
    });

    hls.loadSource(url);
  });
}

function fillInMissingAV01Params(videoCodec) {
  // Used to fill in incomplete AV1 playlist CODECS strings for mediaCapabilities.decodingInfo queries
  if (videoCodec.startsWith('av01.')) {
    const av1params = videoCodec.split('.');
    const placeholders = ['0', '111', '01', '01', '01', '0'];
    for (let i = av1params.length; i > 4 && i < 10; i++) {
      av1params[i] = placeholders[i - 4];
    }
    return av1params.join('.');
  }
  return videoCodec;
}

const drmSystems = {
  'com.apple.fps': {
    licenseUrl: 'https://mortimer.apple.com/drm/fppas/Q1.0.0/m',
    serverCertificateUrl:
      'https://mortimer.apple.com/Mortimer/pastis_aks_partner_16byte_cert.der',
    generateRequest(initDataType, initData, context) {
      const mp4Box = (type, ...payload) => {
        const len = payload.length;
        let size = 8;
        let i = len;
        while (i--) {
          size += payload[i].byteLength;
        }
        const result = new Uint8Array(size);
        result[0] = (size >> 24) & 0xff;
        result[1] = (size >> 16) & 0xff;
        result[2] = (size >> 8) & 0xff;
        result[3] = size & 0xff;
        result.set(type, 4);
        for (i = 0, size = 8; i < len; i++) {
          result.set(payload[i], size);
          size += payload[i].byteLength;
        }
        return result;
      };
      const mp4pssh = (systemId, keyids, data) => {
        if (systemId.byteLength !== 16) {
          throw new RangeError('Invalid system id');
        }
        let version;
        let kids;
        if (keyids) {
          version = 1;
          kids = new Uint8Array(keyids.length * 16);
          for (let ix = 0; ix < keyids.length; ix++) {
            const k = keyids[ix]; // uint8array
            if (k.byteLength !== 16) {
              throw new RangeError('Invalid key');
            }
            kids.set(k, ix * 16);
          }
        } else {
          version = 0;
          kids = new Uint8Array();
        }
        let kidCount;
        if (version > 0) {
          kidCount = new Uint8Array(4);
          if (keyids.length > 0) {
            new DataView(kidCount.buffer).setUint32(0, keyids.length, false);
          }
        } else {
          kidCount = new Uint8Array();
        }
        const dataSize = new Uint8Array(4);
        if (data && data.byteLength > 0) {
          new DataView(dataSize.buffer).setUint32(0, data.byteLength, false);
        }
        return mp4Box(
          [112, 115, 115, 104],
          new Uint8Array([
            version,
            0x00,
            0x00,
            0x00, // Flags
          ]),
          systemId, // 16 bytes
          kidCount,
          kids,
          dataSize,
          data || new Uint8Array()
        );
      };
      const strToUtf8array = (str) =>
        Uint8Array.from(unescape(encodeURIComponent(str)), (c) =>
          c.charCodeAt(0)
        );
      const writeUint32 = (buffer, offset, value) => {
        buffer[offset] = value >> 24;
        buffer[offset + 1] = (value >> 16) & 0xff;
        buffer[offset + 2] = (value >> 8) & 0xff;
        buffer[offset + 3] = value & 0xff;
      };
      const CENC = 0x63656e63;
      const CBCS = 0x63626373;
      const scheme = context.decryptdata.method === 'ISO-23001-7' ? CENC : CBCS;
      const FpsBoxTypes = {
        fpsd: strToUtf8array('fpsd'), // Parent box containing all info
        fpsi: strToUtf8array('fpsi'), // Common info
        fpsk: strToUtf8array('fpsk'), // key request
        fkri: strToUtf8array('fkri'), // key request info
        fkvl: strToUtf8array('fkvl'), // version list
      };
      const makeFpsKeySystemInfoBox = (val) => {
        const schemeArray = new Uint8Array(4);
        writeUint32(schemeArray, 0, val);
        return mp4Box(
          FpsBoxTypes.fpsi,
          new Uint8Array([0, 0, 0, 0]),
          schemeArray
        );
      };
      const makeFpsKeyRequestBox = (keyId, versionList) => {
        const args = [
          FpsBoxTypes.fpsk,
          mp4Box(
            FpsBoxTypes.fkri,
            new Uint8Array([0x00, 0x00, 0x00, 0x00]),
            keyId
          ),
        ];
        if (versionList.length) {
          // List of integers
          const versionListBuffer = new Uint8Array(4 * versionList.length);
          let pos = 0;
          for (const version of versionList) {
            writeUint32(versionListBuffer, pos, version);
            pos += 4;
          }
          args.push(mp4Box(FpsBoxTypes.fkvl, versionListBuffer));
        }

        const fpsk = mp4Box.apply(null, args);
        return fpsk;
      };
      const kFairPlayStreamingKeySystemUUID = new Uint8Array([
        0x94, 0xce, 0x86, 0xfb, 0x07, 0xff, 0x4f, 0x43, 0xad, 0xb8, 0x93, 0xd2,
        0xfa, 0x96, 0x8c, 0xa2,
      ]);
      const data = mp4Box(
        FpsBoxTypes.fpsd,
        makeFpsKeySystemInfoBox(scheme),
        makeFpsKeyRequestBox(
          context.decryptdata.keyId,
          context.decryptdata.keyFormatVersions
        )
      );
      const pssh = mp4pssh(kFairPlayStreamingKeySystemUUID, null, data);

      return { initDataType: 'cenc', initData: pssh };
    },
  },
  'com.widevine.alpha': {
    licenseUrl:
      'https://valley.stage.ott.irdeto.com/licenseServer/widevine/v1/license',
    serverCertificateUrl:
      'https://play.itunes.apple.com/WebObjects/MZPlay.woa/wa/widevineCert',
  },
  'com.microsoft.playready': {
    licenseUrl:
      'https://valley.stage.ott.irdeto.com/licenseServer/playready/v1/license',
  },
};

function licenseXhrSetup(xhr, url, keyContext, licenseChallenge) {
  const base64Decode = (base64encodedStr) =>
    Uint8Array.from(atob(base64encodedStr), (c) => c.charCodeAt(0));
  const base64Encode = (input) => btoa(String.fromCharCode(...input));
  const hexDump = (array) => {
    let str = '';
    for (let i = 0; i < array.length; i++) {
      const h = array[i].toString(16);
      str = (h.length < 2 ? str + '0' : str) + h;
    }
    return str;
  };
  const keySystem = keyContext.keySystem;
  const uri = keyContext.decryptdata?.uri;
  const keyId = keyContext.decryptdata?.keyId;
  if (keySystem === 'com.apple.fps') {
    const messageJson = String.fromCharCode.apply(null, licenseChallenge);
    try {
      const spcArray = JSON.parse(messageJson);
      const keyID = base64Encode(keyContext.decryptdata.keyId);
      // this.log(`License challenge message with key IDs: ${spcArray.map(p => p.keyID).join(', ')}`);
      for (let i = 0; i < spcArray.length; i++) {
        const payload = spcArray[i];
        if (payload.keyID === keyID) {
          console.log(`Generateing license challenge with ID ${payload.keyID}`);
          licenseChallenge = base64Decode(payload.payload);
          break;
        }
      }
    } catch (error) {
      console.warn(
        `Failed to extract spc from FPS license-request message. Fallback to message data for key uri: "${keyContext.decryptdata.uri}"`
      );
    }

    console.log(
      `DEMO page [eme] license setup "${keySystem}" key URI: ${uri}, keyId: ${hexDump(
        keyId || []
      )}. licenseChallenge (len: ${licenseChallenge.length})`
    );
    const payload = {
      'fairplay-streaming-request': {
        version: 1,
        'streaming-keys': [
          {
            id: 1,
            uri: uri,
            spc: base64Encode(licenseChallenge),
          },
        ],
      },
    };
    return JSON.stringify(payload);
  } else {
    xhr.open('POST', url, true);
    xhr.setRequestHeader('content-type', 'application/json');
    // 1 year from May 04, 2022
    xhr.setRequestHeader(
      'Authorization',
      'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjFiNmYxZGU1LTkwMDQtNGIyNy04ZDdhLTdkYmIxOWRlN2Y2ZSJ9.eyJqdGkiOiIwOGZkYWZiMC1lM2JkLTQyNjMtOTMxZC1jYTQzMWExOWJjZWYiLCJpc3MiOiJodHRwczovL2l0cy5hcHBsZS5jb20vIiwiYXVkIjpbImlyZGV0by5pZHJtcyJdLCJzdWIiOiJ3ZWJwbGF5ZXIuaXRzLmFwcGxlLmNvbSIsImlhdCI6MTY1MTcwMjUyMSwiZXhwIjoxNjgzMjM4NTIxfQ.G4nUpNPlBXmPXLZi69o9K5SmQYf576W6STP2smbGWkL4A11QG-610eM9N9_t2iSnEJ2n_6iwwvl1yFJiSB385L9QCwvwRlbNtKlcW07bhCmd_MhOl8p-Q0UbKUoILMWIIHjE4fOJ0_BzuQgIcpVRztOiu2Q5DBbK6OIBkDcpqYO2OPapgy2Mst21PdLXU-gt5rfzKkZmNaZ7Z9HLnEw-zrckaxqIuvY-16Dxx2pTJOtASTU-pK_nLIz-xyK2cDnwDxFb3QjYO-RHtyNpchKUV5ij-54nxJRT0Fq-0AB4rG84MKmDIs8S1BK_h_yCT8CHCgwOspf_0owSVCK_-UGhJG6LVJqs2_t6kWqd08WvUvowweM4Ppd8zJ5NSgP6sAGMBtXRpHqIBHGR4CXPOvKBipQ1RMXVDcOOQDC6wUEIWtNW9duKCQYErP3VChh503SmSxxQMY0VAgli-2fKZC_gwljEtBiMjsTLPaFuDrbsRotzE7wVm_xBvmlmnQ1eF6OM4bE0VkOLsILgquay1zq8ZBrUMSAs1PPR222mREDqH8OOMfMhg18FnMf5RFgQzP4edHGH69OoP5Xu1BVmvkimrz4GeEzUcSv7f5vxjMNFtLRpIM5Wy1OGh-jpJjrd4S9-r5E0cfMPiMqVNsVx-BsGy4Qgb5Z0hZR3kUD2OuCa_4Q'
    );
    console.log(
      `DEMO page [eme] license setup "${keySystem}" key URI: ${uri}, keyId: ${hexDump(
        keyId || []
      )}. licenseChallenge (len: ${licenseChallenge.length})`
    );
    const keyIdToUUID = (byte, i) =>
      (i == 4 || i == 6 || i == 8 || i == 10 ? '-' : '') +
      (byte < 10 ? '0' : '') +
      (byte & 0xff).toString(16);
    // const payload = makeIrdetoPayload(uri, licenseChallenge, keyId);
    const keyIdBase64 = base64Encode(keyId);
    // convert KeyID to UUID format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuid = Array.from(keyId).map(keyIdToUUID).join('');
    const payload = {
      policy: {
        duration: 'PT90S',
        type: 'streaming',
      },
      renewal: {
        duration: 'PT60S',
      },
      tracks: [
        {
          key: {
            id: uuid,
            keyData: keyIdBase64,
            trackType: 'audio', //fetch the lowest profile license
          },
        },
      ],
      protectionProfileId: 'videoStreaming',
      licenseChallenge: base64Encode(licenseChallenge),
    };
    return JSON.stringify(payload);
  }
}

function licenseResponseCallback(xhr, url, keyContext) {
  const base64Decode = (base64encodedStr) =>
    Uint8Array.from(atob(base64encodedStr), (c) => c.charCodeAt(0));
  const base64Encode = (input) => btoa(String.fromCharCode(...input));
  const strToUtf8array = (str) =>
    Uint8Array.from(unescape(encodeURIComponent(str)), (c) => c.charCodeAt(0));
  const keySystem = keyContext.keySystem;
  const response = xhr.response;
  console.log(
    `DEMO page [eme] loaded license "${keySystem}" ${url}. ${xhr.responseType} ${response.byteLength}`
  );
  const parsedResponse = {};
  if (keySystem === 'com.apple.fps') {
    try {
      const responseObject = JSON.parse(
        new TextDecoder().decode(response).trim()
      );
      const keyResponse =
        responseObject['fairplay-streaming-response']['streaming-keys'][0];

      parsedResponse.statusCode = keyResponse.status;

      if (keyResponse.status === 0) {
        parsedResponse.ckc = base64Decode(keyResponse.ckc);
        if ('lease-expiry-time' in keyResponse) {
          const expirySeconds = keyResponse['lease-expiry-time'];
          const renewalDate = new Date(Date.now() + expirySeconds * 1000);
          parsedResponse.renewalDate = renewalDate;
        }
      }
    } catch (error) {
      parsedResponse.statusCode = 0;
    }
    // TODO: Set renewalDate on keyContext
    console.log('DEMO page [eme] parsed license', parsedResponse);
    // return parsedResponse.ckc;

    // "Fairplay v3"
    const responseStr = JSON.stringify([
      {
        keyID: base64Encode(keyContext.decryptdata?.keyId),
        payload: base64Encode(new Uint8Array(parsedResponse.ckc)),
      },
    ]);
    console.log(`[eme] processLicense msg=${responseStr}`);
    return strToUtf8array(responseStr).buffer;
  } else {
    const responseObject = JSON.parse(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(response)))
    );
    parsedResponse.license = base64Decode(responseObject.license);
    const expirySeconds = 60;
    const renewalDate = new Date(Date.now() + expirySeconds * 1000);
    parsedResponse.renewalDate = renewalDate;
    // TODO: Set renewalDate on keyContext
    console.log('DEMO page [eme] parsed license', parsedResponse);
    return parsedResponse.license.buffer;
  }
}
