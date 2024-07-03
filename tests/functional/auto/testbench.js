/* eslint-disable no-var, no-console */

// Browser environment state
var video;
var logString = '';
var hls;

function setupConsoleLogRedirection() {
  var log = document.getElementById('log');
  var inner = log.getElementsByClassName('inner')[0];

  // append log message
  function append(methodName, msg) {
    var a =
      new Date().toISOString().replace('T', ' ').replace('Z', '') + ': ' + msg;
    var text = document.createTextNode(a);
    var line = document.createElement('pre');
    line.className = 'line line-' + methodName;
    line.appendChild(text);
    inner.appendChild(line);

    // The empty log line at the beginning comes from a test in `enableLogs`.
    self.logString = logString += a + '\n';
  }

  // overload global window console methods
  var methods = ['log', 'debug', 'info', 'warn', 'error'];
  methods.forEach(function (methodName) {
    var original = self.console[methodName];
    if (!original) {
      return;
    }

    self.console[methodName] = function () {
      append(
        methodName,
        Array.prototype.slice
          .call(arguments)
          .map(function (arg) {
            try {
              return JSON.stringify(arg);
            } catch (err) {
              return 'Unserializable (reason: ' + err.message + ')';
            }
          })
          .join(' ')
      );

      return original.apply(this, arguments);
    };
  });
}

// Object.assign polyfill
function objectAssign(target) {
  if (target === undefined || target === null) {
    throw new TypeError('Cannot convert first argument to object');
  }

  var to = Object(target);
  for (var i = 1; i < arguments.length; i++) {
    var nextSource = arguments[i];
    if (nextSource === undefined || nextSource === null) {
      continue;
    }

    var keysArray = Object.keys(Object(nextSource));
    for (
      var nextIndex = 0, len = keysArray.length;
      nextIndex < len;
      nextIndex++
    ) {
      var nextKey = keysArray[nextIndex];
      var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
      if (desc && desc.enumerable) {
        to[nextKey] = nextSource[nextKey];
      }
    }
  }
  return to;
}

function startStream(streamUrl, config, callback, autoplay) {
  var Hls = self.Hls;
  if (!Hls) {
    throw new Error('Hls not installed');
  }
  if (!Hls.isSupported()) {
    callback({ code: 'notSupported', logs: logString });
    return;
  }
  if (hls) {
    callback({ code: 'hlsjsAlreadyInitialised', logs: logString });
    return;
  }
  self.video = video = document.getElementById('video');
  if ('drmSystems' in config) {
    var drmConfig;
    var licenseUrl = config.drmSystems['com.apple.fps'].licenseUrl;
    for (var i = drmConfigs.length; i--; ) {
      if (drmConfigs[i].drmSystems['com.apple.fps'].licenseUrl === licenseUrl) {
        drmConfig = drmConfigs[i];
        break;
      }
    }
    if (drmConfig) {
      Object.assign(config, drmConfig);
    }
  }
  try {
    self.hls = hls = new Hls(
      objectAssign({}, config, {
        // debug: true
        debug: {
          debug: function () {},
          log: console.log.bind(console),
          info: console.info.bind(console, '[info]'),
          warn: console.warn.bind(console, '[warn]'),
          error: console.error.bind(console, '[error]'),
        },
      })
    );
    console.log('[test] > userAgent:', navigator.userAgent);
    if (autoplay !== false) {
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        console.log('[test] > Manifest parsed. Calling video.play()');
        var playPromise = video.play();
        if (playPromise) {
          playPromise.catch(function (error) {
            console.log(
              '[test] > video.play() failed with error: ' +
                error.name +
                ' ' +
                error.message
            );
            if (error.name === 'NotAllowedError') {
              console.log('[test] > Attempting to play with video muted');
              video.muted = true;
              return video.play();
            }
          });
        }
      });
    }
    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        console.log('[test] > hlsjs fatal error :' + data.details);
        if (data.details === Hls.ErrorDetails.INTERNAL_EXCEPTION) {
          console.log('[test] > exception in :' + data.event);
          console.log(
            data.error.stack
              ? JSON.stringify(data.error.stack)
              : data.error.message
          );
        }
        callback({ code: data.details, logs: logString });
      }
    });
    video.onerror = function () {
      console.log('[test] > video error, code :' + video.error.code);
      callback({ code: 'video_error_' + video.error.code, logs: logString });
    };
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
  } catch (err) {
    callback({ code: 'exception', logs: logString });
  }
}

function switchToLowestLevel(mode) {
  console.log('[test] > switch to lowest level', mode);
  switch (mode) {
    case 'current':
      hls.currentLevel = 0;
      break;
    case 'next':
      hls.nextLevel = 0;
      break;
    case 'load':
    default:
      hls.loadLevel = 0;
      break;
  }
}

function switchToHighestLevel(mode) {
  var highestLevel = hls.levels.length - 1;
  console.log('[test] > switch to highest level', highestLevel, mode);
  switch (mode) {
    case 'current':
      hls.currentLevel = highestLevel;
      break;
    case 'next':
      hls.nextLevel = highestLevel;
      break;
    case 'load':
    default:
      hls.loadLevel = highestLevel;
      break;
  }
}

self.setupConsoleLogRedirection = setupConsoleLogRedirection;
self.startStream = startStream;
self.switchToHighestLevel = switchToHighestLevel;
self.switchToLowestLevel = switchToLowestLevel;

var drmConfigs = [
  {
    emeEnabled: true,
    drmSystems: {
      'com.apple.fps': {
        licenseUrl: 'https://mortimer.apple.com/drm/fppas/Q1.0.0/m',
        serverCertificateUrl:
          'https://mortimer.apple.com/Mortimer/pastis_aks_partner_16byte_cert.der',
        generateRequest: function (initDataType, initData, context) {
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
                  false
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
                false
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
            0x94, 0xce, 0x86, 0xfb, 0x07, 0xff, 0x4f, 0x43, 0xad, 0xb8, 0x93,
            0xd2, 0xfa, 0x96, 0x8c, 0xa2,
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
    },
    licenseXhrSetup: function (xhr, url, keyContext, licenseChallenge) {
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
                `Generateing license challenge with ID ${payload.keyID}`
              );
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
    },
    licenseResponseCallback: function (xhr, url, keyContext) {
      const base64Decode = (base64encodedStr) =>
        Uint8Array.from(atob(base64encodedStr), (c) => c.charCodeAt(0));
      const base64Encode = (input) => btoa(String.fromCharCode(...input));
      const strToUtf8array = (str) =>
        Uint8Array.from(unescape(encodeURIComponent(str)), (c) =>
          c.charCodeAt(0)
        );
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
    },
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
    licenseXhrSetup: function (xhr, url, keyContext, licenseChallenge) {
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
          keyId || []
        )}. licenseChallenge (len: ${licenseChallenge.length})`
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
        'ewogICAgInVzZXJJZCI6ICJhd3MtZWxlbWVudGFsOjpzcGVrZS10ZXN0aW5nIiwKICAgICJzZXNzaW9uSWQiOiAiaGxzanN0ZXN0c2Vzc2lvbiIsCiAgICAibWVyY2hhbnQiOiAiYXdzLWVsZW1lbnRhbCIKfQ=='
      ); // btoa(JSON.stringify(payload)));

      return licenseChallenge;
    },
    licenseResponseCallback: function (xhr, url, keyContext) {
      const keySystem = keyContext.keySystem;
      const response = xhr.response;
      console.log(
        `DEMO page [eme] loaded license "${keySystem}" ${url}. ${xhr.responseType} ${response.byteLength}`
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
];
