/**
 * Create test stream
 * @param {string} url
 * @param {string} description
 * @param {boolean} [live]
 * @param {boolean} [abr]
 * @param {string[]} [skip_ua]
 * @returns {{url: string, description: string, live: boolean, abr: boolean, skip_ua: string[]}}
 */
function createTestStream(streamInfo) {
  return {
    live: false,
    abr: true,
    skip_ua: [],
    ...streamInfo,
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

  const testStream = createTestStream(target);

  testStream.config = config;

  return testStream;
}

// Apple DRM Test Streams
const appleFPSv3Gatsby = createTestStreamWithConfig(
  {
    url: 'https://cali.apple.com/amt2/gatsby_hevc_8bit/master_gatsby_hevc_8bit_fps_mse.m3u8',
    description: '(Internal) Apple FairPlay (v3) example',
    abr: true,
    skip_ua: ['firefox', 'chrome'],
  },
  {
    emeEnabled: true,
    drmSystems: {
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
                new DataView(kidCount.buffer).setUint32(
                  0,
                  keyids.length,
                  false,
                );
              }
            } else {
              kidCount = new Uint8Array();
            }
            const dataSize = new Uint8Array(4);
            if (data && data.byteLength > 0) {
              new DataView(dataSize.buffer).setUint32(
                0,
                data.byteLength,
                false,
              );
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
              data || new Uint8Array(),
            );
          };
          const strToUtf8array = (str) =>
            Uint8Array.from(unescape(encodeURIComponent(str)), (c) =>
              c.charCodeAt(0),
            );
          const writeUint32 = (buffer, offset, value) => {
            buffer[offset] = value >> 24;
            buffer[offset + 1] = (value >> 16) & 0xff;
            buffer[offset + 2] = (value >> 8) & 0xff;
            buffer[offset + 3] = value & 0xff;
          };
          const CENC = 0x63656e63;
          const CBCS = 0x63626373;
          const scheme =
            context.decryptdata.method === 'ISO-23001-7' ? CENC : CBCS;
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
              schemeArray,
            );
          };
          const makeFpsKeyRequestBox = (keyId, versionList) => {
            const args = [
              FpsBoxTypes.fpsk,
              mp4Box(
                FpsBoxTypes.fkri,
                new Uint8Array([0x00, 0x00, 0x00, 0x00]),
                keyId,
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
            0x94, 0xce, 0x86, 0xfb, 0x07, 0xff, 0x4f, 0x43, 0xad, 0xb8, 0x93,
            0xd2, 0xfa, 0x96, 0x8c, 0xa2,
          ]);
          const data = mp4Box(
            FpsBoxTypes.fpsd,
            makeFpsKeySystemInfoBox(scheme),
            makeFpsKeyRequestBox(
              context.decryptdata.keyId,
              context.decryptdata.keyFormatVersions,
            ),
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
    },
    licenseXhrSetup(xhr, url, keyContext, licenseChallenge) {
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
              console.log(
                `Generateing license challenge with ID ${payload.keyID}`,
              );
              licenseChallenge = base64Decode(payload.payload);
              break;
            }
          }
        } catch (error) {
          console.warn(
            `Failed to extract spc from FPS license-request message. Fallback to message data for key uri: "${keyContext.decryptdata.uri}"`,
          );
        }

        console.log(
          `DEMO page [eme] license setup "${keySystem}" key URI: ${uri}, keyId: ${hexDump(
            keyId || [],
          )}. licenseChallenge (len: ${licenseChallenge.length})`,
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
          'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjFiNmYxZGU1LTkwMDQtNGIyNy04ZDdhLTdkYmIxOWRlN2Y2ZSJ9.eyJqdGkiOiIwOGZkYWZiMC1lM2JkLTQyNjMtOTMxZC1jYTQzMWExOWJjZWYiLCJpc3MiOiJodHRwczovL2l0cy5hcHBsZS5jb20vIiwiYXVkIjpbImlyZGV0by5pZHJtcyJdLCJzdWIiOiJ3ZWJwbGF5ZXIuaXRzLmFwcGxlLmNvbSIsImlhdCI6MTY1MTcwMjUyMSwiZXhwIjoxNjgzMjM4NTIxfQ.G4nUpNPlBXmPXLZi69o9K5SmQYf576W6STP2smbGWkL4A11QG-610eM9N9_t2iSnEJ2n_6iwwvl1yFJiSB385L9QCwvwRlbNtKlcW07bhCmd_MhOl8p-Q0UbKUoILMWIIHjE4fOJ0_BzuQgIcpVRztOiu2Q5DBbK6OIBkDcpqYO2OPapgy2Mst21PdLXU-gt5rfzKkZmNaZ7Z9HLnEw-zrckaxqIuvY-16Dxx2pTJOtASTU-pK_nLIz-xyK2cDnwDxFb3QjYO-RHtyNpchKUV5ij-54nxJRT0Fq-0AB4rG84MKmDIs8S1BK_h_yCT8CHCgwOspf_0owSVCK_-UGhJG6LVJqs2_t6kWqd08WvUvowweM4Ppd8zJ5NSgP6sAGMBtXRpHqIBHGR4CXPOvKBipQ1RMXVDcOOQDC6wUEIWtNW9duKCQYErP3VChh503SmSxxQMY0VAgli-2fKZC_gwljEtBiMjsTLPaFuDrbsRotzE7wVm_xBvmlmnQ1eF6OM4bE0VkOLsILgquay1zq8ZBrUMSAs1PPR222mREDqH8OOMfMhg18FnMf5RFgQzP4edHGH69OoP5Xu1BVmvkimrz4GeEzUcSv7f5vxjMNFtLRpIM5Wy1OGh-jpJjrd4S9-r5E0cfMPiMqVNsVx-BsGy4Qgb5Z0hZR3kUD2OuCa_4Q',
        );
        console.log(
          `DEMO page [eme] license setup "${keySystem}" key URI: ${uri}, keyId: ${hexDump(
            keyId || [],
          )}. licenseChallenge (len: ${licenseChallenge.length})`,
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
    },
    licenseResponseCallback(xhr, url, keyContext) {
      const base64Decode = (base64encodedStr) =>
        Uint8Array.from(atob(base64encodedStr), (c) => c.charCodeAt(0));
      const base64Encode = (input) => btoa(String.fromCharCode(...input));
      const strToUtf8array = (str) =>
        Uint8Array.from(unescape(encodeURIComponent(str)), (c) =>
          c.charCodeAt(0),
        );
      const keySystem = keyContext.keySystem;
      const response = xhr.response;
      console.log(
        `DEMO page [eme] loaded license "${keySystem}" ${url}. ${xhr.responseType} ${response.byteLength}`,
      );
      const parsedResponse = {};
      if (keySystem === 'com.apple.fps') {
        try {
          const responseObject = JSON.parse(
            new TextDecoder().decode(response).trim(),
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
          String.fromCharCode.apply(null, Array.from(new Uint8Array(response))),
        );
        parsedResponse.license = base64Decode(responseObject.license);
        const expirySeconds = 60;
        const renewalDate = new Date(Date.now() + expirySeconds * 1000);
        parsedResponse.renewalDate = renewalDate;
        // TODO: Set renewalDate on keyContext
        console.log('DEMO page [eme] parsed license', parsedResponse);
        return parsedResponse.license.buffer;
      }
    },
  },
);

// AWS DRM
const awsCmafDateRangeSpekeDRMAdsMP = createTestStreamWithConfig(
  {
    description:
      'AWS Daterange ad markers I-frame only track SPEKE v2 Encryption (2 keys : audio + video) PlayReady/Widevine/FairPlay (DRMtoday)  No key rotation: MEDIAPACKAGE HLS v6',
    url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/f1520c14712f499d8e35ece48cf2a987/CMAF/index.m3u8',
    abr: true,
    live: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  {
    emeEnabled: true,
    drmSystems: {
      'com.apple.fps': {
        licenseUrl: 'https://lic.staging.drmtoday.com/license-server-fairplay/',
        serverCertificateUrl:
          'https://lic.staging.drmtoday.com/license-server-fairplay/cert/aws-elemental',
      },
      'com.widevine.alpha': {
        // Widevine license acquisition url (JSON response): https://lic.staging.drmtoday.com/license-proxy-widevine/cenc/
        // Widevine license acquisition url (binary response): https://lic.staging.drmtoday.com/license-proxy-widevine/cenc/?specConform=true
        licenseUrl:
          'https://lic.staging.drmtoday.com/license-proxy-widevine/cenc/?specConform=true',
      },
      'com.microsoft.playready': {
        licenseUrl:
          'https://lic.staging.drmtoday.com/license-proxy-headerauth/drmtoday/RightsManager.asmx',
      },
    },
    licenseXhrSetup(xhr, url, keyContext, licenseChallenge) {
      // const sessionId = 'default';
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
      console.log(
        `DEMO page [eme] license setup "${keySystem}" key URI: ${uri}, keyId: ${hexDump(
          keyId || [],
        )}. licenseChallenge (len: ${licenseChallenge.length})`,
      );
      // const payload = {
      //   userId: 'aws-elemental::speke-testing',
      //   sessionId,
      //   merchant: 'aws-elemental',
      // };
      if (keySystem === 'com.apple.fps') {
        // xhr.setRequestHeader('content-type', 'application/json');
        xhr.responseType = 'text';
      }
      xhr.open('POST', url, true);
      xhr.setRequestHeader(
        'x-dt-custom-data',
        'ewogICAgInVzZXJJZCI6ICJhd3MtZWxlbWVudGFsOjpzcGVrZS10ZXN0aW5nIiwKICAgICJzZXNzaW9uSWQiOiAiaGxzanN0ZXN0c2Vzc2lvbiIsCiAgICAibWVyY2hhbnQiOiAiYXdzLWVsZW1lbnRhbCIKfQ==',
      ); // btoa(JSON.stringify(payload)));

      return licenseChallenge;
    },
    licenseResponseCallback(xhr, url, keyContext) {
      const keySystem = keyContext.keySystem;
      const response = xhr.response;
      console.log(
        `DEMO page [eme] loaded license "${keySystem}" ${url}. ${xhr.responseType} ${response.byteLength}`,
      );
      if (keySystem === 'com.apple.fps') {
        const base64Decode = (base64encodedStr) =>
          Uint8Array.from(atob(base64encodedStr), (c) => c.charCodeAt(0));
        const data = base64Decode(xhr.response);
        return data.buffer;
      }
      return response;
    },
  },
);

const streams = {
  audioOnlyLiveInterstitials: {
    description:
      'Live Radio (audio-only) with Interstitials (30s break @2m intervals, aligned with segments)',
    url: 'http://livepoc-ftc-eng-device.streaming.siriusxm.com/v0/breakglass_SoiPMdM5tig/pri-1/AAC_Data/transcode/wmay/daipa/app_mv.m3u8',
    live: true,
  },
  appleInterstitialsASE: {
    description: '(Internal) ASE 2024 Preroll Decouple CoreMedia Sample Stream',
    url: 'https://imgdry.apple.com/users/juliant/ase_airplay/mvp.m3u8',
    abr: false,
    skipFunctionalTests: true,
  },
  appleInterstitialsPrerollDecoupleBackToBackFPSPrimary: Object.assign(
    {},
    appleFPSv3Gatsby,
    {
      description:
        '(Internal) Preroll Decouple with back to back start dates - FPS Content',
      url: 'https://zm5qiypmasc4s6t6e7t7.apple.com:8443/qadrift/_media/_streams/interstitial_ads/ase_timeline_demo/TedLasso101/main_interstitial_discont_trim_backtobackdates.m3u8',
      abr: false,
      skipFunctionalTests: true,
    },
  ),

  appleInterstitialsPrerollDecoupleBackToBackFPSPrimary2: Object.assign(
    {},
    appleFPSv3Gatsby,
    {
      description:
        '(Internal) Back to back ad start dates - ASE case - Discont and Interstitial - FPS Content',
      url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/ase_timeline_demo/TedLasso101/main_interstitial_discont_trim_backtobackdates.m3u8',
      abr: false,
      skipFunctionalTests: true,
    },
  ),
  appleInterstitialsBackToBack1: {
    description:
      '(Internal) Back to back ad start dates - comedian in cars - range, primary - Interstitial only',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/coffecars_clip/main_interstitials_timelinetags_rangeprimary_ase_backtobackdates.m3u8',
  },
  appleInterstitialsBackToBack2: {
    description:
      '(Internal) Back to back ad start dates - Julian Test case - creek - Discont and Interstitial',
    url: 'http://creek.apple.com/juliant/ase_airplay/mvp2.m3u8',
    skipFunctionalTests: true,
  },
  meridian_with_interstitials: {
    description:
      '(Internal) Meridian (clear, AVC, HEVC, HDR10, DoVi) with Interstitials',
    url: 'https://imgdry.apple.com/users/rwalch/streams/hls/meridian/index-interstitials.m3u8',
    audioTrackOptions: 1, // Has 4 audio renditions (aac and he-aac to two bitrates each),
    subtitleTrackOptions: 3,
    skipFunctionalTests: true,
  },
  meridian_pre_post_order: {
    description:
      '(Internal) Pre/Post events are scheduled in tag order, not StartDate order (video-only)',
    url: 'https://imgdry.apple.com/users/rwalch/streams/hls/meridian/avc1_1024x576p59940_718s_2962k/interstitial-pre-post-tag-or-date-order.m3u8',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  meridian_event_overlaps_end: {
    description:
      '(Internal) Interstitial Event overlaps end with resumption past end of primary (video-only)',
    url: 'https://imgdry.apple.com/users/rwalch/streams/hls/meridian/avc1_1024x576p59940_718s_2962k/interstitial-overlaps-end.m3u8',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  appleInterstitialsSnapOutIn: {
    description: '(Internal) Interstitials: DATERANGE - X-SNAP="OUT,IN"',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/bipbop_unmuxed_snap_inout.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 0,
    abr: false,
    skipFunctionalTests: true,
  },
  appleInterstitials04: {
    description: '(Internal) Interstitials: 3 Spread out Ads (midroll)',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/ssl_bipbop_unmuxed_3ads_spreadout.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  appleInterstitialsSubs: {
    description: '(Internal) Interstitials: 3 Spread out Ads with Subtitles',
    url: 'https://imgdry.apple.com/users/jgainfort/interstitials/subs_dubs/prog_index_interstitial.m3u8',
    audioTrackOptions: 0,
    subtitleTrackOptions: 3,
    skipFunctionalTests: true,
  },
  appleInterstitials02: {
    description: '(Internal) Interstitials: Preroll Asset List',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_muxed_fmp4/gear2/prog_index_xassetlist_xcue_pre.m3u8',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  appleInterstitials_511B64E5: {
    description:
      '(Internal) Interstitials: X-RESTRICT=JUMP restricted - preroll and three midrolls 15s, 60s, 120s',
    url: 'https://imgdry.apple.com/users/jgainfort/interstitials/meridian_test/meridian_test.m3u8',
  },
  appleInterstitals_d07de99c: {
    description:
      '(Internal) Interstitials: Unmuxed with Alt audio lang and subtitles for English, French, and Spanish in both the primary and ads (rdar://tsc/25759883)',
    url: 'https://zm5qiypmasc4s6t6e7t7.apple.com:8443/qadrift/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main101_v_unmuxed_cc_alt_audio_subs_ad_cc.m3u8',
  },
  appleInterstitals_8e81a97f: {
    description:
      '(Internal) Interstitials: Live (archived) with Ads and Playout 10s on first ad pod',
    url: 'https://zm5qiypmasc4s6t6e7t7.apple.com:8443/qadrift/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/gear2/prog_index_xassetlist_3ads_playoutlimit20s_live.m3u8',
    live: true,
  },
  appleInterstitals_26103ebb: {
    description:
      '(Internal) Interstitials: Audio Only with audio Ads - Pre Mid Post',
    url: 'https://zm5qiypmasc4s6t6e7t7.apple.com:8443/qadrift/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/bipbop_alt_audio_only_pre_mid_post.m3u8',
  },
  appleInterstitals_06c90fd5: {
    description:
      '(Internal) Interstitials: Client ad with playout limit and resumption offset',
    url: 'https://zm5qiypmasc4s6t6e7t7.apple.com:8443/qadrift/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/bipbop_unmuxed_1ad_playoutlimit_resumeoffset.m3u8',
  },
  appleInterstitals00: {
    description: '(Internal) Interstitials: Two Preroll DateRanges',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/ssl_bipbop_unmuxed_cue_pre_2ads.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  appleInterstitials03: {
    description: '(Internal) Interstitials: 3 Sequential Ads (Midroll)',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/ssl_bipbop_unmuxed_3ads_sequential.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  appleInterstitials09: {
    description: '(Internal) Interstitials: Postroll Asset List',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/bipbop_gears_alt_16x9_unmuxed_fmp4/bipbop_unmuxed_cue_post_3ads_xassetlist.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  appleInterstitials01: {
    description: '(Internal) Interstitials: Asset List (Midroll)',
    url: 'https://imgdry.apple.com/users/jgainfort/interstitials/bipbop_gears_alt_16x9_unmuxed_fmp4/hls-asset-list.m3u8',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  appleInterstitials05: {
    description: '(Internal) Interstitials: Muxed with captions',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main001_a_v_muxed_cc_alt_audio_subs_ad_cc.m3u8',
    audioTrackOptions: 3,
    subtitleTrackOptions: 3,
    skipFunctionalTests: true,
  },
  appleInterstitials06: {
    description: '(Internal) Interstitials: Unmuxed with captions',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main101_v_unmuxed_cc_alt_audio_subs_ad_cc.m3u8',
    audioTrackOptions: 3,
    subtitleTrackOptions: 3,
    skipFunctionalTests: true,
  },
  appleInterstitials07: {
    description: '(Internal) Interstitials: Muxed (captions -> no captions)',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main001a_a_v_muxed_cc_alt_audio_subs_ad_nocc.m3u8',
    audioTrackOptions: 3,
    subtitleTrackOptions: 3,
    skipFunctionalTests: true,
  },
  appleInterstitials08: {
    description: '(Internal) Interstitials: Unmuxed (captions -> no captions)',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main101a_v_unmuxed_cc_alt_audio_subs_ad_nocc.m3u8',
    audioTrackOptions: 3,
    subtitleTrackOptions: 3,
    skipFunctionalTests: true,
  },
  // Level errors
  // appleInterstitials09: {
  //   description: '(Internal) Interstitials: Unmuxed (no captions -> captions)',
  //   url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main102_v_unmuxed_nocc_alt_audio_subs_ad_cc.m3u8',
  //   audioTrackOptions: 3
  // },
  appleInterstitials10: {
    description: '(Internal) Interstitials: Muxed (no spanish -> no french)',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main004_a_v_muxed_cc_alt_audio_subs_no_spanish_ad_no_french.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 2,
    skipFunctionalTests: true,
  },
  appleInterstitials11: {
    description: '(Internal) Interstitials: Unmuxed (no spanish -> no french)',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/interstitial_ads/basic_test/primary/adventureland_8min/main104_v_unmuxed_cc_alt_audio_subs_no_spanish_ad_no_french.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 2,
    skipFunctionalTests: true,
  },
  appleEmily: Object.assign({}, appleFPSv3Gatsby, {
    description:
      '(Internal) Interstitials (FPS): 3 PreRolls (9s ATV+ bumper, 30s Billie Ad, 3s AvailableNow bumper) then FPS Primary (Emily Dickinson Episode), with Ad midrolls (Available Now + Billie ad) at 30s and 1min',
    url: 'https://zm5qiypmasc4s6t6e7t7.apple.com:8443/MoreMedia/matchpoint/perf_streams/emilyd_atvplus/main_all_formats_sessiondata_interstitial_midrolls.m3u8',
    skipFunctionalTests: true,
  }),
  appleDeveloperBecoming: {
    description: '(Internal) Apple HLS Stream Sample "Becoming" v3',
    url: 'https://imgdry.apple.com/users/yplatoshyn/streams/developer_update/01_amt_becoming_clr_ST629local_20230328/main.m3u8',
  },
  appleContentSteeringImgDry: {
    description:
      '(Internal) Content Steering 1.3: has 5 pathways (.,c1,c2,c3,c4) cloned pathways, and loope back over each pathway on steering manifest update',
    url: 'https://imgdry.apple.com/users/rwalch/streams/hls/content-steering/adventureland/master.m3u8',
    // skipFunctionalTests: true,
    audioTrackOptions: 3,
    subtitleTrackOptions: 5,
  },
  appleContentSteering1: {
    description:
      '(Internal) Content Steering 1.2 Multiple Hosts: Has DEFINE "HOST"',
    url: 'https://cali.apple.com/MoreMedia/amt2/lucy_failover_cali/content_steering_v1_2/master_lucy_avc_clear_multiplehosts_1.m3u8',
    skipFunctionalTests: true,
  },
  appleContentSteering2: {
    description:
      '(Internal) Content Steering 1.2: has RELOAD-URI returned once',
    url: 'https://cali.apple.com/MoreMedia/amt2/lucy_failover_cali/content_steering_v1_2/master_lucy_avc_clear_multiplehosts_2.m3u8',
    skipFunctionalTests: true,
  },
  appleContentSteering3: {
    description:
      '(Internal) Content Steering 1.2: has RELOAD-URI in manifest every time (6 TTL = 60, 8 TTL = 100)',
    url: 'https://cali.apple.com/MoreMedia/amt2/lucy_failover_cali/content_steering_v1_2/master_lucy_avc_clear_multiplehosts_6.m3u8',
    skipFunctionalTests: true,
  },
  appleContentSteering4: {
    description:
      '(Internal) Content Steering 1.2: NO DEFINE in MVP, SERVER-URI is data URI (3-4)',
    url: 'https://cali.apple.com/MoreMedia/amt2/lucy_failover_cali/content_steering_v1_2/master_lucy_avc_clear_multiplehosts_3.m3u8',
    skipFunctionalTests: true,
  },
  // appleContentSteering5: {
  //   description: '(Internal) Content Steering 1.2: has required DEFINE “HOST” var',
  //   url: 'https://cali.apple.com/MoreMedia/amt2/lucy_failover_cali/content_steering_v1_2/master_lucy_avc_clear_multiplehosts_5.m3u8',
  // },
  multiDRMBipbop: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) Multi-DRM Bipbop (fmp4 - "playready_eryk")',
    url: 'https://cali.apple.com/apple_hls_js_ssl/content/playready_eryk/master3.m3u8',
    skip_ua: ['firefox', 'chrome'], // Currentlty fails in Chrome
    skipFunctionalTests: true,
  }),
  multiDRM_MP: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) Multi-DRM MP (fmp4 - "emilyd_atvplus")',
    url: 'https://cali.apple.com/MoreMedia/matchpoint/perf_streams/emilyd_atvplus/main_all_formats_sessiondata_discont.m3u8',
    skip_ua: ['firefox', 'chrome'], // Currentlty fails in Chrome
    skipFunctionalTests: true,
  }),
  // multiDRMAudio: Object.assign({}, appleFPSv3Gatsby, {
  //   description: '(Internal) Oasis - audio only - multiKey',
  //   url: 'https://cali.apple.com/shesha/third_attempt_aac/aac_audio_cbcs_merged_without_pssh.m3u8',
  // }),
  // wvFpsToClear: Object.assign({}, appleFPSv3Gatsby, {
  //   description: '(Internal) AVC Widevine/FPS to HEVC Widevine/FPS to AVC Clear',
  //   url: 'https://zm5qiypmasc4s6t6e7t7.apple.com:8443/MoreMedia/matchpoint/perf_streams/valerian/master_valerian_sdr_hdr_fps_discont_avc_fps_preroll.m3u8',
  //   skip_ua: [],
  // }),
  AppleCanalIMSC: {
    description:
      '(Internal) Canal+: Taken with IMSC subs (Safari/EC-3 codec support required, Mixed audio codecs locks playback/requires MediaSource reset)',
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/subtitles_closedcaption/IMSC1_canal/index.m3u8',
    skip_ua: ['firefox', 'chrome'],
    skipFunctionalTests: true,
    audioTrackOptions: 5,
    subtitleTrackOptions: 3,
  },
  AppleDV84: {
    url: '/adaptive/DolbyVision84/index.m3u8',
    // url: 'https://creek.apple.com/markli/DolbyVision84/DV84Test.m3u8',
    description: '(local) Dolby Vision 8.4 SUPPLEMENTAL-CODECS',
    skipFunctionalTests: true, // CORS error
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  AppleDV81: {
    url: 'https://cali.apple.com/MoreMedia/amt2/dolby_v8.1/PLT_dvh08/main.m3u8',
    description: '(Internal) Dolby Vision 8.1 SUPPLEMENTAL-CODECS',
    skipFunctionalTests: true, // CORS error
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  appleAV1andHEVC: {
    description: '(Internal) AV1 and HEVC Variants',
    url: 'https://cali.apple.com/MoreMedia/amt2/AV1/av1_ffmpeg_converted/main_av1_and_hevc_SDR10bit_HDR10_30fps_clear.m3u8',
    skipFunctionalTests: true, // CORS error
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  appleAV1Only: {
    description: '(Internal) AV1 Variants',
    url: 'https://cali.apple.com/MoreMedia/amt2/AV1/av1_ffmpeg_converted/HDR/colorful/main_av1_HDR10_30fps_clear.m3u8',
    skip_ua: ['safari', 'firefox'],
    skipFunctionalTests: true, // CORS error
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  AppleFPSDV81: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) Dolby Vision 8.1 (FPS enc)',
    url: 'https://cali.apple.com/MoreMedia/amt2/dolby_v8.1/disney_tastethenation/main_all.m3u8',
    audioTrackOptions: 2,
  }),
  appleFPSv3Gatsby,
  appleFPSv3GatsbyPostRoll: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) Gatsby post-roll (FPS enc -> enc, fmp4)',
    url: 'https://cali.apple.com/amt2/gatsby_hevc_8bit/master_gatsby_hevc_8bit_fps_discont_at_end.m3u8',
  }),
  appleFPSAmericanMadeHDCPLevels: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) American Made HDCP Levels (avc/hevc,fLaC FPS)',
    url: 'https://cali.apple.com/MoreMedia/matchpoint/perf_streams/american_made/master_am_all_formats_fps_flac_only.m3u8',
    audioTrackOptions: 3,
    subtitleTrackOptions: 6,
  }),
  appleFPSLucyHDCPLevels: Object.assign({}, appleFPSv3Gatsby, {
    description:
      '(Internal) Lucy HDCP Levels, Segment #EXT-X-BITRATE (avc,aac/ac3/ec-3 FPS)',
    url: 'https://cali.apple.com/MoreMedia/amt2/lucy_clip/master_lucy_avc_fps.m3u8',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  }),
  appleFPSBabyDriverSessionKeys: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) Baby Driver Session Key (audio-only FPS)',
    url: 'https://cali.apple.com/MoreMedia/matchpoint/perf_streams/babydriver/master_babydriver_audio_only_fps_persistent_preload.m3u8',
    audioTrackOptions: 0, // audio-only,
    subtitleTrackOptions: 0,
    abr: false, // has multiple AAC bitrate but not multiple AC3/EC3 bitrate options
  }),
  appleFPSValerian: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) Valerian (FPS)',
    url: 'https://cali.apple.com/MoreMedia/matchpoint/perf_streams/valerian/master_valerian_all_formats_fps.m3u8',
    audioTrackOptions: 1,
    subtitleTrackOptions: 3,
  }),
  appleFPSAdventureLand: Object.assign({}, appleFPSv3Gatsby, {
    description: '(Internal) Adventure Land (fmp4 unmuxed mixed keys FPS)',
    url: 'https://cali.apple.com/apple_hls_js_ssl/content/alternate_audio/adventureland/fmp4_unmuxed_fps_mixed_keys/master_fmp4_unmuxed_fps_mixed_keys.m3u8',
    skipFunctionalTests: true,
  }),
  // appleFPSOasisCosineAlbum: Object.assign({}, appleFPSv3Gatsby, {
  //   description: '(Internal) Oasis cosine album Session Keys (audio-only FPS)',
  //   url: 'https://cali.apple.com/MoreMedia/oasis/Oasis_cosine_album/encrypted/497/P2000121212_default.m3u8',
  // }),
  // appleFPSv3ValerianPreRoll: Object.assign({}, appleFPSv3Gatsby, {
  //   description: '(Internal) Valerian PlayReady pre-roll (enc -> enc, fmp4, incompatible)',
  //   url: 'https://cali.apple.com/MoreMedia/matchpoint/perf_streams/valerian/master_valerian_sdr_hdr_fps_plyrdy_wdvn_discont_preroll_avc_wdvn.m3u8'
  // }),
  // appleFPSv3MeridianPreRoll: Object.assign({}, appleFPSv3Gatsby, {
  //   description: '(Internal) Meridian pre-roll (clear -> enc, fmp4, incompatible)',
  //   url: 'https://cali.apple.com/apple_hls_js_ssl/content/perf_streams/meridian_dubcard_discont/master_meridian_30fps_discont_clear_preroll.m3u8'
  // }),
  // appleMusicClearEnc: Object.assign({}, appleFPSv3Gatsby, {
  //   description: '(Internal) Apple Music (clr -> enc, fmp4, compatible)',
  //   url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/encryption/huluplus/apple_music/master_discont_groupft_fmp4.m3u8',
  // }),
  sampleAESmp2ts: {
    url: 'https://cali.apple.com/MoreMedia/vp9/yt_content/encrypted_files/v6/31e1685307acf271_283.m3u8',
    description: '(Internal) SAMPLE-AES “identity” with MPEG-2 TS',
    skipFunctionalTests: true, // CORS error
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  tedTalk3sDiscoAt60sFollowedByVideoError: {
    url: 'https://cali.apple.com/qadrift_ssl/_media/discontinuity/discont_diff_aspect_ratio.m3u8',
    description: `(Internal) TED Talk mp2ts with bad disco/segments. cc 2, sn 34 @72s:
    "The video playback was aborted due to a corruption problem or because the video used features your browser did not support - PIPELINE_ERROR_DECODE: VDA Error 4"`,
    abr: false,
    skipFunctionalTests: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  AppleMeridian: {
    description: '(Internal) Apple: Meridian (clear, AVC, HEVC, HDR10, DoVi)',
    url: 'https://com.apple.com/VOD/meridian_181015/plain/master.m3u8',
    audioTrackOptions: 1, // Has 4 audio renditions (aac and he-aac to two bitrates each),
    subtitleTrackOptions: 0,
    skipFunctionalTests: true, // VPN/CORS error
  },
  meridian_local_with_subs: {
    description:
      '(local) Meridian (clear, AVC, HEVC, HDR10, DoVi) with subtitle tracks',
    url: '/adaptive/meridian/index.m3u8',
    audioTrackOptions: 1, // Has 4 audio renditions (aac and he-aac to two bitrates each),
    subtitleTrackOptions: 3,
  },
  meridian_local_with_assoc_lang_subs: {
    description:
      '(local) Meridian (clear, AVC, HEVC, HDR10, DoVi) with ASSOC-LANGUAGE (autogenerated) subtitle tracks',
    url: '/adaptive/meridian/index-assoc.m3u8',
    audioTrackOptions: 1, // Has 4 audio renditions (aac and he-aac to two bitrates each),
    subtitleTrackOptions: 3,
  },
  appleHvc1HevcIssue: {
    description: '(local) MVP says hvc1.2.4.H150.B0 media says hev1',
    url: '/adaptive/apple-events-hvc1/index-video-only.m3u8',
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  // awsTsMuxedDateRangeAdsMP: {
  //   description:
  //     'AWS Muxed audio track Daterange ad markers I-frame only track In-the-clear: MEDIAPACKAGE HLS v4',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/74781b1e229b49cb8a57fa64f76f9e88/index.m3u8',
  // },
  // awsTsSCTEAdsMT: {
  //   description:
  //     'AWS SCTE-Enhanced ad markers I-frame only track In-the-clear: MEDIAPACKAGE HLS v4',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/b40e7a82f606496ea6dbc9177b58a954/index.m3u8',
  // },
  // awsTsSCTEAdsMP: {
  //   description:
  //     'AWS SCTE-Enhanced ad markers I-frame only track In-the-clear: MEDIATAILOR HLS v4',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/v1/master/e6d234965645b411ad572802b6c9d5a10799c9c1/All_Reference_Streams/b40e7a82f606496ea6dbc9177b58a954/index.m3u8',
  // },
  // awsTsUnmuxedDateRangeAdsMP: {
  //   description:
  //     'AWS Unmuxed audio track Daterange ad markers I-frame only track Thumbnails (1 track) In-the-clear: MEDIAPACKAG HLS v4',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/7ad68b254f0846bfb7908930a0a92ae8/index.m3u8',
  // },
  // awsTsUnmuxedDateRangeAdsMT: {
  //   description:
  //     'AWS Unmuxed audio track Daterange ad markers I-frame only track Thumbnails (1 track) In-the-clear: MEDIATAILOR HLS v4',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/v1/master/e6d234965645b411ad572802b6c9d5a10799c9c1/All_Reference_Streams/7ad68b254f0846bfb7908930a0a92ae8/index.m3u8',
  // },
  // awsTsFpsDateRangeAdsMP: Object.assign({}, awsCmafDateRangeSpekeDRMAdsMP, {
  //   description:
  //     'AWS Muxed audio track Daterange ad markers I-frame only track Thumbnails (1 track) SPEKE v1 Encryption (1 key) FPS (DRMtoday) Key rotation (60s): MEDIAPACKAGE HLS v5',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/bc130622a0a64f78b636cc4214d8e44d/index.m3u8',
  //   skip_ua: ['firefox', 'chrome'],
  // }),
  // awsTsFpsDateRangeAdsMT: Object.assign({}, awsCmafDateRangeSpekeDRMAdsMP, {
  //   description:
  //     'AWS Muxed audio track Daterange ad markers I-frame only track Thumbnails (1 track) SPEKE v1 Encryption (1 key) FPS (DRMtoday) Key rotation (60s): MEDIATAILOR HLS v5',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/v1/master/e6d234965645b411ad572802b6c9d5a10799c9c1/All_Reference_Streams/bc130622a0a64f78b636cc4214d8e44d/index.m3u8',
  //   skip_ua: ['firefox', 'chrome'],
  // }),
  // awsTsMuxedWebVttMP: {
  //   description:
  //     'AWS Muxed audio track No SCTE-35 1 WebVTT subtitle track In-the-clear: MEDIAPACKAGE HLS v3',
  //   url: 'https://dblv4th6qydd9.cloudfront.net/out/v1/a2c26dbfc28c40faa3d55180ddea3501/index.m3u8',
  // },
  // awsCmafDateRangeAdsMP: {
  //   description:
  //     'AWS Daterange ad markers I-frame only track In-the-clear: MEDIAPACKAGE HLS v6',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/62a7ec8a0f3b4f19ad76eac54f2f2dce/cmaf-clear/index.m3u8',
  // },
  // awsCmafDateRangeAdsMT: {
  //   description:
  //     'AWS Daterange ad markers I-frame only track In-the-clear: MEDIATAILOR ',
  //   url: 'https://81558cb7081e4bbaacce15fea2ce4685.mediatailor.us-east-1.amazonaws.com/v1/master/e6d234965645b411ad572802b6c9d5a10799c9c1/All_Reference_Streams_CMAF/62a7ec8a0f3b4f19ad76eac54f2f2dce/cmaf-clear/index.m3u8',
  // },
  awsCmafDateRangeSpekeDRMAdsMP,
  awsCmafDateRangeSpekeDRMAdsMT: Object.assign(
    {},
    awsCmafDateRangeSpekeDRMAdsMP,
    {
      description:
        'AWS Daterange ad markers I-frame only track SPEKE v2 Encryption (2 keys : audio + video) PlayReady/Widevine/FPS (DRMtoday)  No key rotation: MEDIATAILOR HLS v6',
      url: 'https://81558cb7081e4bbaacce15fea2ce4685.mediatailor.us-east-1.amazonaws.com/v1/master/e6d234965645b411ad572802b6c9d5a10799c9c1/All_Reference_Streams_CMAF/f1520c14712f499d8e35ece48cf2a987/CMAF/index.m3u8',
    },
  ),
  // awsCmafThumbsDateRangeAdsMP: {
  //   description:
  //     'AWS Daterange ad markers I-frame only track Thumbnails (1 track) In-the-clear: MEDIAPACKAGE HLS v6',
  //   url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/3b229ecbde714b5998955a95eb57e83a/cmaf-thumbnails/index.m3u8',
  // },
  // awsCmafThumbsDateRangeAdsMT: {
  //   description:
  //     'AWS Daterange ad markers I-frame only track Thumbnails (1 track) In-the-clear: MEDIATAILOR HLS v6',
  //   url: 'https://81558cb7081e4bbaacce15fea2ce4685.mediatailor.us-east-1.amazonaws.com/v1/master/e6d234965645b411ad572802b6c9d5a10799c9c1/All_Reference_Streams_CMAF/3b229ecbde714b5998955a95eb57e83a/cmaf-thumbnails/index.m3u8',
  // },

  ezDrmFairPlayCmaf: createTestStreamWithConfig(
    {
      url: 'https://na-fps.ezdrm.com/demo/ezdrm/master.m3u8',
      description: 'EZ DRM FPS Demo (mp4)',
      abr: false,
      audioTrackOptions: 1,
      subtitleTrackOptions: 0,
      skip_ua: ['firefox', 'chrome'],
    },
    {
      emeEnabled: true,
      drmSystems: {
        'com.apple.fps': {
          licenseUrl:
            'https://fps.ezdrm.com/api/licenses/b99ed9e5-c641-49d1-bfa8-43692b686ddb?p1=1668626422714', // processSpcUrl
          serverCertificateUrl: 'https://fps.ezdrm.com/demo/video/eleisure.cer',
        },
      },
    },
  ),
  // ezDrmFairPlayDemo: createTestStreamWithConfig(
  //   {
  //     url: 'https://fps.ezdrm.com/demo/hls/BigBuckBunny_320x180.m3u8',
  //     description: 'EZ DRM FPS Demo (MPEG-2 TS SAMPLE-AES)',
  //     abr: true,
  //     skip_ua: ['firefox', 'chrome'],
  //   },
  //   {
  //     emeEnabled: true,
  //     drmSystems: {
  //       'com.apple.fps': {
  //         licenseUrl:
  //           'https://fps.ezdrm.com/api/licenses/fd537439-74e2-4aad-8adb-b9f3e6417c59', // processSpcUrl
  //         serverCertificateUrl: 'https://fps.ezdrm.com/demo/video/eleisure.cer',
  //       },
  //     },
  //   }
  // ),
  // ezDrmFairPlayJwp: createTestStreamWithConfig(
  //   {
  //     url: '//fps.ezdrm.com/demo/video/ezdrm.m3u8',
  //     description: 'EZ DRM FPS (old example)',
  //     abr: true,
  //     skip_ua: ['firefox', 'chrome'],
  //   },
  //   {
  //     emeEnabled: true,
  //     drmSystems: {
  //       'com.apple.fps': {
  //         licenseUrl:
  //           'http://fps.ezdrm.com/api/licenses/09cc0377-6dd4-40cb-b09d-b582236e70fe?p1=1661996201697', // processSpcUrl
  //         serverCertificateUrl: 'http://fps.ezdrm.com/demo/video/eleisure.cer',
  //         // licenseResponseType: 'blob',
  //         // licenseRequestHeaders:[ { name:'Content-type', value:'application/octet-stream' } ]
  //       },
  //     },
  //   }
  // ),

  AppleAdvancedDolbyDV8AtmosHls: {
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/main.m3u8',
    description:
      'Advanced stream "Becoming" (HEVC DolbyVision / HDR10+ Video variants / HE-AAC (v1,v2) / Dolby Digital 5.1 / Dolby Atmos, 7.1,)',
    audioTrackOptions: 2,
    subtitleTrackOptions: 13,
  },
  AppleAdvancedHevcAvcHls: {
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_adv_example_hevc/master.m3u8',
    description:
      'Advanced stream (HEVC/H.264, AC-3/AAC,  WebVTT, fMP4 segments)',
    audioTrackOptions: 1,
    subtitleTrackOptions: 1,
  },
  skyInterstitials: {
    description:
      'SKY Interstitials: Live (Get more at https://ireplay.tv/sky/)',
    url: 'https://ireplay.tv/carsandroads/brands.m3u8',
    audioTrackOptions: 2,
    subtitleTrackOptions: 0,
    live: true,
    skipFunctionalTests: true,
  },
  BellCanadaLive: {
    description:
      'Bell Canada Stitched Test rdar://110335691 (Live, unmuxed fmp4, clear, Long window, Discontinuities)',
    url: 'https://ott-manifest-manipulator-s3.d.i.klab.f0ns3.ca/api/simsub/v1/cdn/shls/LIVE$D-HD/index.m3u8?start=2019-01-02T00:00:00Z&end=END&device=OPPE-HLS-UNENC',
    live: true,
    skipFunctionalTests: true, // playlist load times out
  },
  NebulaSample: {
    url: 'https://media-production.nebula.app/unauthenticated/test/4k_60_traffic/all_codecs.m3u8',
    description: 'Nebula 60fps AVC 360p-1440p, HEVC 1080p-4k',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  angelOneShakaWidevineLegacyConfig: createTestStreamWithConfig(
    {
      url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine-hls/hls.m3u8',
      description:
        'Shaka-packager Widevine DRM (EME) HLS-fMP4 - Angel One (Legacy Config)',
      abr: true,
      skip_ua: [
        'firefox',
        'safari',
        { name: 'chrome', version: '75.0' },
        { name: 'chrome', version: '79.0' },
      ],
    },
    {
      widevineLicenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
      emeEnabled: true,
    },
  ),
  multiDRM: createTestStreamWithConfig(
    {
      url: 'https://vod-qa-hdd-01.b-cdn.net/3InDYWsdUyklwEfMCl9j/6d80b715-d8d3-456f-b1bd-3e3a8e8087de/hls.m3u8',
      description:
        'Multi-DRM',
      abr: true,
      skip_ua: [
        'firefox',
        'safari',
        { name: 'chrome', version: '75.0' },
        { name: 'chrome', version: '79.0' },
      ],
    },
    {
      widevineLicenseUrl: 'https://drm-widevine-licensing.axtest.net/AcquireLicense',
      emeEnabled: true,
      licenseXhrSetup: (
        xhr,
        url,
        keyContext,
        licenseChallenge,
      ) => { 
        if (licenseChallenge.length > 10) {
          xhr.open('POST', url, true);
          xhr.setRequestHeader('x-axdrm-message', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2ZXJzaW9uIjoxLCJiZWdpbl9kYXRlIjoiMjAwMC0wMS0wMVQwMDo1MTowNCswMzowMCIsImV4cGlyYXRpb25fZGF0ZSI6IjIwMjUtMTItMzFUMjM6NTk6NDArMDM6MDAiLCJjb21fa2V5X2lkIjoiZGRhYjgyZWMtMDM0YS00OGYxLWI1MmYtYWQ2YjAxNzI1NDBmIiwibWVzc2FnZSI6eyJ0eXBlIjoiZW50aXRsZW1lbnRfbWVzc2FnZSIsInZlcnNpb24iOjIsImxpY2Vuc2UiOnsiZHVyYXRpb24iOjE3MjgwMCwiYWxsb3dfcGVyc2lzdGVuY2UiOnRydWV9LCJjb250ZW50X2tleV91c2FnZV9wb2xpY2llcyI6W3sibmFtZSI6IlBvbGljeSBBIiwiZmFpcnBsYXkiOnsiaGRjcCI6Ik5PTkUifX1dLCJjb250ZW50X2tleXNfc291cmNlIjp7ImlubGluZSI6W3siaWQiOiI2ZDgwYjcxNS1kOGQzLTQ1NmYtYjFiZC0zZTNhOGU4MDg3ZGUiLCJ1c2FnZV9wb2xpY3kiOiJQb2xpY3kgQSJ9XX0sInNlc3Npb24iOnsidXNlcl9pZCI6IkE5UEM4RUEzeHFiRjV4RmZ0RzZaTzM0S0JlMjMifX0sImlhdCI6MTcyNDA4NzAyOH0.yj5MnErR7qzi3ueiFurZ3MN4Duiqi3A35xPNKDXXn2E');
        }
      }
    },
  ),
  angelOneShakaWidevine: createTestStreamWithConfig(
    {
      url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine-hls/hls.m3u8',
      description:
        'Shaka-packager Widevine DRM (EME) HLS-fMP4 - Angel One Demo',
      abr: true,
      audioTrackOptions: 6,
      subtitleTrackOptions: 4,
      skip_ua: [
        'firefox',
        'safari',
        { name: 'chrome', version: '75.0' },
        { name: 'chrome', version: '79.0' },
      ],
    },
    {
      emeEnabled: true,
      drmSystems: {
        'com.widevine.alpha': {
          licenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
        },
      },
    },
  ),
  angelOneShakaWidevine2: createTestStreamWithConfig(
    {
      url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine-hls/hls.m3u8',
      description: 'Shaka-packager Widevine Too',
      abr: true,
      audioTrackOptions: 6,
      subtitleTrackOptions: 4,
      skip_ua: [
        'firefox',
        'safari',
        { name: 'chrome', version: '75.0' },
        { name: 'chrome', version: '79.0' },
      ],
    },
    {
      emeEnabled: true,
      drmSystems: {
        'com.widevine.alpha': {
          licenseUrl: 'https://cwip-shaka-proxy.appspot.com/no_auth',
        },
      },
    },
  ),
  oceansAES: {
    url: 'https://playertest.longtailvideo.com/adaptive/oceans_aes/oceans_aes.m3u8',
    description: 'AES-128 encrypted, ABR',
    abr: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  tracksWithAES: {
    url: 'https://playertest.longtailvideo.com/adaptive/aes-with-tracks/master.m3u8',
    description: 'AES-128 encrypted, TS main with AAC audio track',
    abr: false,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  bbb: {
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    description: 'Big Buck Bunny - adaptive qualities',
    abr: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  fdr: {
    url: 'https://cdn.jwplayer.com/manifests/pZxWPRg4.m3u8',
    description: 'FDR - CDN packaged, 4s segments, 180p - 1080p',
    abr: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  gapAppleFmp4: {
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/EXT-X-GAP/beats_ad/master_fmp4_gap_fileseg3_high_fileseg3_low.m3u8',
    description: '(Internal) fmp4. GAP 18-28',
    skipFunctionalTests: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  gapAppleTs: {
    url: 'https://cali.apple.com/qadrift_ssl/_media/_streams/EXT-X-GAP/beats_ad/master_ts_gap_fileseg6_high.m3u8',
    description: '(Internal) ts. GAP 56-106',
    skipFunctionalTests: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  gapAudioAndVideo: {
    url: 'https://mtoczko.github.io/hls-test-streams/test-gap-audio-video/playlist.m3u8',
    description:
      'gap: video segment 1.ts and 5.ts, audio segment 1.ts and 5.ts',
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  gapVideo: {
    url: 'https://mtoczko.github.io/hls-test-streams/test-gap-video/playlist.m3u8',
    description: 'gap: video segment 1.ts and 5.ts',
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  gapAudio: {
    url: 'https://mtoczko.github.io/hls-test-streams/test-gap-audio/playlist.m3u8',
    description: 'gap: audio segment 1.ts and 5.ts',
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  bigBuckBunny480p: {
    url: 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8',
    description: 'Big Buck Bunny - 480p only',
    abr: false,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  arte: {
    url: 'https://test-streams.mux.dev/test_001/stream.m3u8',
    description: 'ARTE China,ABR',
    abr: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  deltatreDAI: {
    url: 'https://test-streams.mux.dev/dai-discontinuity-deltatre/manifest.m3u8',
    description: 'Ad-insertion in event stream',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  googleDaiDeltaPlaylist: {
    url: 'https://dai.google.com/linear/hls/event/yWaDO8GzQiKuCOcLYGGFUQ/master.m3u8',
    description: 'DAI with EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL',
    live: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  liveHomeShopping: {
    url: 'https://tvsnhlslivetest.akamaized.net/hls/live/2034711/TVSN-MSL4/master.m3u8',
    description: 'Live 10x 10-11 seconds segments (1:48s window)',
    live: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  badVideoMSEerror: {
    description: '(Internal) Bad Video (MSE error)',
    url: 'https://dry.apple.com/users/gireesh/content/bad-video/master.m3u8',
    skipFunctionalTests: true,
  },
  bbcRadio: {
    url: 'http://lstn.lv/bbc.m3u8?station=bbc_radio_one&bitrate=96000',
    description: 'BBC Radio',
    live: true,
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue1209: {
    url: 'https://edge.flowplayer.org/night6.m3u8',
    description: '#1209 AAC',
  },
  issue1560: {
    url: 'https://live-app.radioradicale.it/diretta/live-mobile/playlist.m3u8',
    description: '#1560 AAC',
  },
  issue4304: {
    url: 'https://panoptoscratch.s3.amazonaws.com/dsessions/chromium-issue-1245123/master.m3u8',
    description: '#4304 AAC chromium-issue-1245123',
  },
  heAacv2: {
    url: 'http://cali.apple.com/apple_hls_js/content/audio_only/heaac_v2/silverbells_HEAACv2-44kHz-48kbs_ts_clear/master_ts_heaacv2_clear.m3u8',
    description: 'AAC silverbells_HEAACv2-44kHz-48kbs_ts_clear',
    skipFunctionalTests: true,
  },
  issue666: {
    url: '/adaptive/hls.js/issues/666/cisq0gim60007xzvi505emlxx.m3u8',
    description:
      'Surveillance footage - https://github.com/video-dev/hls.js/issues/666',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue1510: {
    url: '/adaptive/hls.js/issues/1510/caminandes_1_4k.m3u8',
    description: '#1510 Mixed TS and muxed mp4 Variant Playlists',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue2706: {
    url: '/adaptive/hls.js/issues/2706/index.m3u8',
    description: '#2706 Audio-only multi-language playback failure',
    abr: false,
    audioTrackOptions: 6,
    subtitleTrackOptions: 4,
  },
  issue2812: {
    url: '/adaptive/hls.js/issues/2812/index.m3u8',
    description: '#2812 MPEG-TS non-existing PPS 0',
    skipFunctionalTests: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue3179: {
    url: '/adaptive/hls.js/issues/3179/index.m3u8',
    description: '#3179 Framerate change without discontinuity',
    skipFunctionalTests: true, // causes video decode error
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue3180: {
    url: '/adaptive/hls.js/issues/3180/index.m3u8',
    description:
      '#3180 Live Archived missing video textTracks when using capLevelToPlayerSize',
    abr: false,
    live: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue3900: {
    url: 'https://foliovision.com/hls/master.m3u8',
    description:
      '#3900 AES-128 key URI shared between audio and video playlists',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  // issue4387: {
  //   url: '/adaptive/hls.js/issues/4387/***',
  //   description: '#4387 Missing video textTracks when using capLevelToPlayerSize',
  // },
  issue4470: {
    url: '/adaptive/hls.js/issues/4470/index.m3u8',
    description:
      '#4470 TS AVC with overlaps producing gaps in Chrome video SourceBuffer',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    abr: false,
    skipFunctionalTests: true,
  },
  issue4571_a: {
    url: 'https://d2zihajmogu5jn.cloudfront.net/elephantsdream/hls/ed_hd.m3u8',
    description: "#4571-A Subtitle list doesn't match others",
    audioTrackOptions: 2,
    subtitleTrackOptions: 5,
    ok: true,
  },
  issue4571_b: {
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    description: "#45710-B Subtitle list doesn't match others",
    audioTrackOptions: 2,
    subtitleTrackOptions: 4,
    ok: true,
  },
  issue4634: {
    url: '/adaptive/hls.js/issues/4634/index.m3u8',
    description:
      '#4634 audioTrackLoadError with symetric audio options (64kB and 160kB)',
    audioTrackOptions: 1, // 2 renditions
    subtitleTrackOptions: 0,
  },
  issue4783: {
    url: '/adaptive/hls.js/issues/4783/index.m3u8',
    description: '#4783 Last video segment has only one video sample',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue4787: {
    url: '/adaptive/hls.js/issues/4787/index.m3u8',
    description: '#4787 M1 decode error without NAL filler data',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue4817: {
    url: '/adaptive/hls.js/issues/4817/index.m3u8',
    description:
      '#4817 Fragment loading stops or loops after two consecutive segments without content',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  // 4905
  issue4920: {
    url: '/adaptive/hls.js/issues/4920/index.m3u8',
    description: '#4920 Support INSTREAM-ID filtering of 608 cc channels',
    audioTrackOptions: 1,
    subtitleTrackOptions: 3, // 12 renditions
    abr: false,
  },
  // 4943
  issue4958: {
    url: '/adaptive/hls.js/issues/4958/index.m3u8',
    description: '#4958 Containerless AAC, AC3, EC3 audio, with TS video',
    audioTrackOptions: 3,
    subtitleTrackOptions: 3, // 12 renditions
  },
  issue5162: {
    url: '/adaptive/hls.js/issues/5162/index.m3u8',
    description: "#5162 7.1/8-channel AAC audio doesn't work",
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  issue5251: {
    url: '/adaptive/hls.js/issues/5251/index.m3u8',
    description: '#5251 HLS MPEG-TS - PIPELINE_ERROR_DECODE',
    skipFunctionalTests: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue5255: {
    url: '/adaptive/hls.js/issues/5255/wrong.m3u8',
    description: '#5255 Fix segment key sharing acrossed playlists',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue5272: {
    url: '/adaptive/hls.js/issues/5272/index-start.m3u8',
    description: '#5272 bufferFullError at the beginning, video does not start',
    skipFunctionalTests: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  issue5302: {
    url: '/adaptive/hls.js/issues/5302/index.m3u8',
    description:
      '#5302 Incomplete (missing language) audio-groups across variants',
    skipFunctionalTests: true,
    audioTrackOptions: 4, // Four languages split across different groups
    subtitleTrackOptions: 0,
  },
  issue5303: {
    url: '/adaptive/hls.js/issues/5303/index.m3u8',
    description: '#5303 Negative signed "tfdt" decode time values (Cloudflare)',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue5378: {
    url: '/adaptive/hls.js/issues/5378/index-mvp.m3u8',
    description:
      '#5378 Playback fails when audio group has two renditions (aac, ac-3)',
    audioTrackOptions: 1, // two codecs in Safari - one track per variant
    subtitleTrackOptions: 0,
  },
  issue5452: {
    url: '/adaptive/hls.js/issues/5452/cdn.brixcloud.io/record/63f2dabec589af0012210901645082a945f8d300121dd245/llhls.m3u8',
    description:
      '#5452 AV synchronization is broken when audio track timestamps starts before video',
    skipFunctionalTests: true, // 404 segments toward second half
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  issue5477: {
    url: '/adaptive/hls.js/issues/5477/index.m3u8',
    description: '#5477 start PTS overlaps with last DTS',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  issue5481: {
    url: '/adaptive/hls.js/issues/5481/index.m3u8',
    description: '#5481 2.1 channel AAC',
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  issue5501: {
    url: '/adaptive/hls.js/issues/5501/index.m3u8',
    description: '#5501 AAC incorrectly probed as TS',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue5504: {
    url: '/adaptive/hls.js/issues/5504/index.m3u8',
    description: '#5504 emsg ID3 metadata timebase (audio-only)',
    audioTrackOptions: 0, // audio-only
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue5531: {
    url: '/adaptive/hls.js/issues/5531/index.m3u8',
    description: '#5531 Overlapping ID3 and DateRange metadata',
    skipFunctionalTests: true, // 404 segments toward second half
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  issue5629: {
    url: 'https://raw.githubusercontent.com/mattzucker/hls-test-data/main/clean-bunny/bunny_2.m3u8',
    description: '#5629 gaps on start and disco',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  issue5631: {
    url: '/adaptive/hls.js/issues/5631/1/index.m3u8',
    description: '#5631.1 Gap between TS segments on up switch',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    allowedBufferedRangesInSeekTest: 2,
  },
  issue5631_2: {
    url: '/adaptive/hls.js/issues/5631/2/index.m3u8',
    description: '#5631.2 Gap between TS segments on up switch',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    allowedBufferedRangesInSeekTest: 2,
  },
  issue5632: {
    url: '/adaptive/hls.js/issues/5674/index.m3u8',
    description: '#5632 Paramount PlutoTV empty TS segments South Park clip',
    audioTrackOptions: 1,
    subtitleTrackOptions: 1,
  },
  // 5653
  // 5674
  issue5696: {
    // url: 'https://cali.apple.com/qadrift/_media/_streams/error_check/BonJovi-segments_removed/prog_index_missing_segments.m3u8',
    url: '/adaptive/hls.js/issues/5696/index-decode-error.m3u8',
    description: '#5696 Bon Jovi MSE decode error at 45 seconds',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue5709: {
    url: '/adaptive/hls.js/issues/5709/index.m3u8',
    description:
      '#5709 Safari decode error on first fragment. 9000 CTS with 3-4 Sample DTS < start PTS.',
    audioTrackOptions: 1,
    subtitleTrackOptions: 1,
  },
  issue5743: {
    url: '/adaptive/hls.js/issues/5743/index.m3u8',
    description:
      '#5743 Gap at 4s when 60fps variant has 4s segments and lower 30fps variants have 8s segments.',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  issue5759: {
    url: '/adaptive/hls.js/issues/5759/index.m3u8',
    description:
      '#5759 Gap between first and second segment in Chrome due to DTS overlap.',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue5782: {
    url: '/adaptive/hls.js/issues/5782/index.m3u8',
    description: '#5782 MP3 probed as AAC (ADTS sync word found - audio-only)',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    abr: false, // only one segment long
  },
  // issues5802: createTestStreamWithConfig(
  //   {
  //     url: 'https://live-orisa-edge-ak.play.kakao.com/rl23c6y6z7szrapl67g8y21u1/adaptive.m3u8?__token__=exp=1697090935~acl=%2Frl23c6y6z7szrapl67g8y21u1%2F%2A~hmac=927f82206fc2218dc1e4661693f6ebad78118c9cd913e295201c10cefa3311c6&orisa-edge-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtYXhicHMiOjgwMDAsImV4cCI6MTY5NzA5MDkzNX0.v7t28zUm-ksTqQp0kLPkOJH1uoVqiSJcC4tO-KgYz_M&bps=8000',
  //     description: '#5802 Live with multiple alternate audio groups',
  //     skipFunctionalTests: true, // down?
  //     live: true
  //   },
  //   {
  //     xhrSetup: function (xhr, url) {
  //       const params =
  //         '__token__=exp=1697090935~acl=%2Frl23c6y6z7szrapl67g8y21u1%2F%2A~hmac=927f82206fc2218dc1e4661693f6ebad78118c9cd913e295201c10cefa3311c6&orisa-edge-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtYXhicHMiOjgwMDAsImV4cCI6MTY5NzA5MDkzNX0.v7t28zUm-ksTqQp0kLPkOJH1uoVqiSJcC4tO-KgYz_M&bps=8000';
  //       if (url.indexOf(params) === -1) {
  //         const parsed_url = url.split('?');
  //         const url_path = parsed_url.shift();
  //         const url_param = parsed_url.join('?');
  //         url = url_path + '?' + params + (url_param ? '&' + url_param : '');
  //       }
  //       xhr.open('GET', url, true);
  //     },
  //   },
  // ),
  issue5857: {
    url: '/adaptive/hls.js/issues/5857/index.m3u8',
    description: '#5857 "png" TS probed as ADTS AAC',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    abr: false,
  },
  // 5952
  issue5953: {
    url: '/adaptive/hls.js/issues/5953/index.m3u8',
    description: '#5953 CEA-608 "long" captions',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  // 6064
  // 6075
  // 6076 (missing segments)
  // 6147 (missing segments)
  issue6191: {
    url: '/adaptive/hls.js/issues/6191/index.m3u8',
    description: '#6191 Duration is occasionally showing as double',
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
    abr: true,
    skipFunctionalTests: true, // missing from 14" MBP M3
  },
  issue6203_valid: {
    url: '/adaptive/hls.js/issues/6203/valid.m3u8',
    description:
      '#6203 PDT and DateRange (VALID) shifted by segment media duration longer than playlist duration',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    abr: false,
  },
  issue6203_short: {
    url: '/adaptive/hls.js/issues/6203/short.m3u8',
    description:
      '#6203 PDT and DateRange (SHORT) shifted by segment media duration longer than playlist duration',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
    abr: false,
  },
  issue6203: {
    url: '/adaptive/hls.js/issues/6203/index.m3u8',
    description:
      '#6203 PDT and DateRange (INVALID) shifted by segment media duration longer than playlist duration',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
    abr: false,
  },
  // 6218
  issue6294: {
    description:
      '#6294 initial TS segments only have audio (first 40 seconds), followed by audio and video',
    url: '/adaptive/hls.js/issues/6294/index.m3u8',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  issue6337: {
    description: '#6337 Audio Codec listed twice (fixed with #6341)',
    url: '/adaptive/hls.js/issues/6339/index.m3u8',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  issue6339: {
    description:
      '#6339 initial TS segments only have video (first 4 seconds), followed by audio and video',
    url: '/adaptive/hls.js/issues/6339/index.m3u8',
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
    skipFunctionalTests: true,
  },
  // 6377

  issue6392: {
    url: '/adaptive/hls.js/issues/4920/index-6392.m3u8',
    description: '#6392 Duplicate captions',
    audioTrackOptions: 1,
    subtitleTrackOptions: 3, // 12 renditions
    abr: false,
  },

  issue6475: {
    url: '/adaptive/bipbop_16x9/index-gap-subs.m3u8',
    description:
      '#6475 GAP in a subtitle playlist causes switch to lowest quality level',
    audioTrackOptions: 1,
    subtitleTrackOptions: 1,
  },

  issue6510: {
    url: '/adaptive/hls.js/issues/6510/index.m3u8',
    description: '#6510 decode error in Safari MacOS',
    audioTrackOptions: 1,
    skipFunctionalTests: true,
  },

  issue6529: {
    url: '/adaptive/hls.js/issues/6529/index.m3u8',
    description: '#6529 audio QUOTA EXCEEDED ERROR on lowest resolution @9:25',
    audioTrackOptions: 1, // 3 groups/bitrates
    subtitleTrackOptions: 0,
  },

  closedCaptions: {
    url: 'https://playertest.longtailvideo.com/adaptive/captions/playlist.m3u8',
    description: 'CNN special report, with CC',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  closedCaptionsCPC608: {
    url: '/adaptive/cpcweb/index.m3u8',
    description: '(local) CPC Web CEA-608 Closed Captions example',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  customIvBadDts: {
    url: 'https://playertest.longtailvideo.com/adaptive/customIV/prog_index.m3u8',
    description: 'Custom IV with bad PTS DTS',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  mp3Audio: {
    url: 'https://playertest.longtailvideo.com/adaptive/vod-with-mp3/manifest.m3u8',
    description: 'MP3 VOD demo',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  mpegAudioOnly: {
    url: 'https://pl.streamingvideoprovider.com/mp3-playlist/playlist.m3u8',
    description: 'MPEG Audio Only demo',
    abr: false,
    skip_ua: ['MicrosoftEdge', 'firefox'],
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  fmp4: {
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
    description: 'HLS fMP4 Angel-One multiple audio-tracks',
    abr: true,
    audioTrackOptions: 6,
    subtitleTrackOptions: 4,
  },
  fmp4Bitmovin: {
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s-fmp4/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    description: 'HLS fMP4 by Bitmovin',
    abr: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  fmp4BitmovinHevc: {
    url: 'https://bitmovin-a.akamaihd.net/content/dataset/multi-codec/hevc/stream_fmp4.m3u8',
    description:
      'HLS HEVC fMP4 by Bitmovin (Safari and Edge? only as of 2020-08)',
    abr: true,
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  offset_pts: {
    url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    description: 'DK Turntable, PTS shifted by 2.3s',
    abr: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  audioOnlyMultipleLevels: {
    url: 'https://s3.amazonaws.com/qa.jwplayer.com/~alex/121628/new_master.m3u8',
    description: 'Multiple non-alternate audio levels',
    abr: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  pdtDuplicate: {
    url: 'https://playertest.longtailvideo.com/adaptive/artbeats/manifest.m3u8',
    description: 'Duplicate sequential PDT values',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  pdtLargeGap: {
    url: 'https://playertest.longtailvideo.com/adaptive/boxee/playlist.m3u8',
    description: 'PDTs with large gaps following discontinuities',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  pdtBadValues: {
    url: 'https://playertest.longtailvideo.com/adaptive/progdatime/playlist2.m3u8',
    description: 'PDTs with bad values',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  pdtOneValue: {
    url: 'https://playertest.longtailvideo.com/adaptive/aviion/manifest.m3u8',
    description: 'One PDT, no discontinuities',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  noTrackIntersection: createTestStreamWithConfig(
    {
      url: 'https://s3.amazonaws.com/qa.jwplayer.com/~alex/123633/new_master.m3u8',
      description:
        'Audio/video track PTS values do not intersect; 10 second start gap',
      abr: false,
      audioTrackOptions: 0,
      subtitleTrackOptions: 0,
    },
    {
      avBufferOffset: 10.5,
    },
  ),
  altAudioAndTracks: {
    // url: 'https://wowzaec2demo.streamlock.net/vod-multitrack/_definst_/smil:ElephantsDream/elephantsdream2.smil/playlist.m3u',
    url: 'https://playertest.longtailvideo.com/adaptive/elephants_dream_v4/index.m3u8',
    description: 'Alternate audio tracks, and multiple VTT tracks',
    vendor: 'wowza',
    abr: true,
    audioTrackOptions: 3,
    subtitleTrackOptions: 2,
  },
  altAudioAudioOnly: createTestStreamWithConfig(
    {
      url: 'https://playertest.longtailvideo.com/adaptive/alt-audio-no-video/sintel/playlist.m3u8',
      description: 'Audio-only with alternate audio track (Sintel)',
      abr: false,
      audioTrackOptions: 2,
      subtitleTrackOptions: 0,
    },
    {
      // the playlist segment durations are longer than the media. So much so, that when seeking near the end,
      // the timeline shifts roughly 10 seconds seconds back, and as a result buffering skips several segments
      // to adjust for the currentTime now being places at the very end of the stream.
      allowedBufferedRangesInSeekTest: 3,
    },
  ),
  altAudioMultiAudioOnly: {
    url: 'https://playertest.longtailvideo.com/adaptive/alt-audio-no-video/angel-one.m3u8',
    description: 'Audio only with multiple alternate audio tracks (Angel One)',
    abr: false,
    audioTrackOptions: 6,
    subtitleTrackOptions: 4,
  },
  muxedFmp4: {
    url: 'https://s3.amazonaws.com/qa.jwplayer.com/hlsjs/muxed-fmp4/hls.m3u8',
    description: 'Muxed av fmp4 - appended to "audiovideo" SourceBuffer',
    abr: false,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  altAudioWithPdtAndStartGap: {
    url: 'https://playertest.longtailvideo.com/adaptive/hls-test-streams/test-audio-pdt/playlist.m3u8',
    description: 'PDT before each segment, 1.59s start gap',
    // Disable smooth switch on this stream. Test is flakey because of what looks like (auto)play issue. To be expected with this large a gap (for now).
    // abr: true,
    startSeek: true,
    audioTrackOptions: 2,
    subtitleTrackOptions: 0,
  },
  MuxLowLatencyHls: {
    url: 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
    description:
      'Low-Latency HLS sample of Big Buck Bunny loop and a timer. Restarts every 12 hours. (fMP4 segments)',
    live: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  AppleLowLatencyCmafHlsWithCors: {
    url: 'https://ll-hls-test.cdn-apple.com/llhls4/ll-hls-test-04/multi.m3u8',
    description:
      'Apple Low-Latency HLS sample (4x 1s CMAF parts per segment _WITH_CORS_)',
    live: true,
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  ByteRangeAddressedLowLatencyPreloadHints: {
    url: 'https://id3as-ll-hls.akamaized.net/hls/byterange/master.m3u8',
    description:
      'Low-Latency HLS with byte-ranged addressed parts and preload-hints',
    live: true,
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  CloudflareLowLatency: {
    url: 'https://customer-wi9sckcs7uxt7lh4.cloudflarestream.com/abe3c49d5dc715c36d07b9ff73c8df0f/manifest/video.m3u8?protocol=llhls',
    description: 'Low-Latency HLS Cloudflare (4x 0.5s fMP4 parts per segment)',
    live: true,
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  EvenMediaEngineLowLatencyHls: {
    url: 'https://llhls-demo.ovenmediaengine.com/app/stream/llhls.m3u8',
    description:
      'Low-Latency HLS EvenMediaEngine (12x 0.5s fMP4 parts per segment)',
    live: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  FlussonicLowLatencyHls: {
    url: 'https://llhls-demo.flussonic.com/flussonic/index.ll.m3u8',
    description: 'Low-Latency HLS Flussonic (32x 0.2s CMAF parts per segment)',
    live: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  HarmonicLowLatencyHls: {
    url: 'https://cdn-vos-ppp-01.vos360.video/Content/HLS_HLSCLEAR/Live/channel(PPP-LL-2HLS)/index.m3u8',
    description: 'Harmonic Low-Latency HLS (4x 1s fMP4 parts per segment)',
    live: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  NimbleStreamerLowLatencyHls: {
    url: 'https://ll-hls.softvelum.com/sldp/bbloop/playlist.m3u8',
    description:
      'Nimble Streamer Low-Latency HLS (6x 1s fMP4 parts per segment)',
    live: true,
    skipFunctionalTests: true,
    audioTrackOptions: 1,
    subtitleTrackOptions: 0,
  },
  groupIds: {
    url: 'https://mtoczko.github.io/hls-test-streams/test-group/playlist.m3u8',
    description: 'Group-id: subtitle and audio',
    abr: true,
    skipFunctionalTests: true,
    audioTrackOptions: 1, // Track and content changes with each variant ("1080p", "720p", etc...)
    subtitleTrackOptions: 1, // Track and content changes with each variant ("1080p", "720p", etc...)
  },
  redundantLevelsWithTrackGroups: {
    url: 'https://playertest.longtailvideo.com/adaptive/elephants_dream_v4/redundant.m3u8',
    description: 'Redundant levels with subtitle and audio track groups',
    abr: true,
    skipFunctionalTests: true,
    audioTrackOptions: 3,
    subtitleTrackOptions: 2,
  },
  startDelimiterOverlappingBetweenPESPackets: {
    url: 'https://wistia.github.io/hlsjs-test-streams/assets/start-delimiter.m3u8',
    description: `A stream with the start delimiter overlapping between PES packets.
       Related to https://github.com/video-dev/hls.js/issues/3834, where Apple Silicon chips throw decoding errors if
       NAL units are not starting right at the beginning of the PES packet when using hardware accelerated decoding.`,
    abr: false,
    skipFunctionalTests: true,
    audioTrackOptions: 0,
    subtitleTrackOptions: 0,
  },
  aes256: {
    url: 'https://jvaryhlstests.blob.core.windows.net/hlstestdata/playlist_encrypted.m3u8',
    description: 'aes-256 and aes-256-ctr full segment encryption',
    abr: false,
  },
  mpegTsHevcHls: {
    url: 'https://devoldemar.github.io/streams/hls/bipbop/hevc.m3u8',
    description: 'Advanced stream (HEVC Main 10, MPEG-TS segments)',
    skipFunctionalTests: true,
  },
  mpegTsBitmovinHevc: {
    url: 'https://bitmovin-a.akamaihd.net/content/dataset/multi-codec/hevc/v720p_ts.m3u8',
    description:
      'HLS M2TS by Bitmovin (HEVC Main, many NALUs overflowing PESes, video only)',
    abr: false,
    skipFunctionalTests: true,
  },
};

// Object.keys(streams).forEach((key) => {
//   if (/\/\/(?:imgdry|cali)\.apple\.com\//.test(streams[key].url)) {
//     delete streams[key];
//   }
// });

module.exports = streams;
// module.exports = { angelOneShakaWidevine: streams.angelOneShakaWidevine };
