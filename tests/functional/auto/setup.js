/* eslint-disable no-console */

const sauceConnectLauncher = require('sauce-connect-launcher');
const webdriver = require('selenium-webdriver');
const By = webdriver.By;
const until = webdriver.until;
// requiring this automatically adds the chromedriver binary to the PATH
require('chromedriver');
const HttpServer = require('http-server');
const streams = require('../../test-streams');
const useSauce = !!process.env.SAUCE || !!process.env.SAUCE_TUNNEL_ID;
const HlsjsLightBuild = !!process.env.HLSJS_LIGHT;
const chai = require('chai');
const expect = chai.expect;

const UA = process.env.UA || 'chrome';
const UA_VERSION = process.env.UA_VERSION || 'latest';
const HLSJS_TEST_BASE = process.env.HLSJS_TEST_BASE;
const DEBUG = process.env.DEBUG
  ? process.env.DEBUG !== 'false' && process.env.DEBUG !== '0'
  : undefined;

const browserConfig = {
  version: UA_VERSION,
  name: UA,
};

/**
 * @type {webdriver.ThenableWebDriver}
 */
let browser;
const printDebugLogs = false;

// Setup browser config data from env vars
if (useSauce) {
  const UA = process.env.UA;
  if (!UA) {
    throw new Error('No test browser name.');
  }

  const OS = process.env.OS;
  if (!OS) {
    throw new Error('No test browser platform.');
  }

  if (!process.env.SAUCE_ACCESS_KEY || !process.env.SAUCE_USERNAME) {
    throw new Error('Missing sauce auth.');
  }

  browserConfig.name = UA;
  browserConfig.platform = OS;
}

let browserDescription = browserConfig.name;

if (browserConfig.version && browserConfig.version !== 'latest') {
  browserDescription += ` ${browserConfig.version}`;
}

if (browserConfig.platform) {
  browserDescription += `, ${browserConfig.platform}`;
}

// Launch static server
if (useSauce || !HLSJS_TEST_BASE) {
  HttpServer.createServer({
    showDir: false,
    autoIndex: false,
    root: './',
  }).listen(8000, useSauce ? '0.0.0.0' : '127.0.0.1');
}

const wait = (ms) => new Promise((resolve) => global.setTimeout(resolve, ms));
const stringifyResult = (result) =>
  JSON.stringify(
    result,
    Object.keys(result).filter((k) => k !== 'logs'),
    2
  );
async function retry(attempt, numAttempts = 5, interval = 2000) {
  try {
    return await attempt();
  } catch (e) {
    if (--numAttempts === 0) {
      // reject with the last error
      throw e;
    }
    await wait(interval);
    return retry(attempt, numAttempts, interval);
  }
}

async function testLoadedData(url, config) {
  const result = await browser.executeAsyncScript(
    function (url, config) {
      const callback = arguments[arguments.length - 1];
      self.startStream(url, config, callback);
      const video = self.video;
      video.onloadeddata = function () {
        callback({ code: 'loadeddata', logs: self.logString });
      };
    },
    url,
    config
  );
  expect(result, stringifyResult(result))
    .to.have.property('code')
    .which.equals('loadeddata');
}

async function testIdleBufferLength(url, config) {
  const result = await browser.executeAsyncScript(
    function (url, config) {
      const callback = arguments[arguments.length - 1];
      const autoplay = false;
      self.startStream(url, config, callback, autoplay);
      const video = self.video;
      const maxBufferLength = self.hls.config.maxBufferLength;
      if (self.ManagedMediaSource) {
        config.avBufferOffset = Math.max(config.avBufferOffset || 0, 3);
      }
      video.onprogress = function () {
        const buffered = video.buffered;
        if (buffered.length) {
          const bufferEnd = buffered.end(buffered.length - 1);
          const duration = video.duration;
          const durationOffsetTolerance = config.avBufferOffset || 1;
          const requiredBuffer = Math.min(
            maxBufferLength,
            duration - durationOffsetTolerance
          );
          console.log(
            '[test] > progress: ' +
              bufferEnd.toFixed(3) +
              '/' +
              requiredBuffer.toFixed(3) +
              ' buffered.length: ' +
              buffered.length +
              ' allowed duration offset: ' +
              durationOffsetTolerance +
              ' duration: ' +
              duration.toFixed(3)
          );
          if (bufferEnd >= requiredBuffer) {
            video.onprogress = null;
            console.log('[test] > passed (exec callback)');
            callback({ code: 'loadeddata', logs: self.logString });
          }
        }
      };
    },
    url,
    config
  );
  expect(result, stringifyResult(result))
    .to.have.property('code')
    .which.equals('loadeddata');
}

async function testSmoothSwitch(url, config) {
  const result = await browser.executeAsyncScript(
    function (url, config) {
      const callback = arguments[arguments.length - 1];
      const startConfig = self.objectAssign(config, { startLevel: 0 });
      self.startStream(url, startConfig, callback);
      self.hls.manualLevel = 0;
      const video = self.video;
      let playedInterval = -1;
      self.hls.once(self.Hls.Events.FRAG_CHANGED, function (eventName, data) {
        console.log(
          '[test] > ' +
            eventName +
            ' frag.level: ' +
            data.frag.level +
            ' @' +
            video.currentTime
        );
        const highestLevel = self.hls.levels.length - 1;
        const level = self.hls.levels[data.frag.level];
        const fragmentCount = level.details.fragments.length;
        if (highestLevel === 0 || fragmentCount === 1) {
          self.clearInterval(playedInterval);
          callback({
            highestLevel: highestLevel,
            currentTimeDelta: 1, // pass the test by assigning currentTimeDelta > 0
            message:
              highestLevel === 0 ? 'No adaptive variants' : 'Only one segment',
            logs: self.logString,
          });
          return;
        }
        self.switchToHighestLevel('next');
      });
      self.hls.on(self.Hls.Events.LEVEL_SWITCHED, function (eventName, data) {
        console.log('[test] > ' + eventName + ' data.level: ' + data.level);
        const currentTime = video.currentTime;
        const highestLevel = self.hls.levels.length - 1;
        if (data.level === highestLevel) {
          self.clearInterval(playedInterval);
          playedInterval = self.setInterval(function () {
            const newCurrentTime = video.currentTime;
            const currentTimeDelta = newCurrentTime - currentTime;
            console.log('[test] > currentTime delta: ' + currentTimeDelta);
            if (currentTimeDelta > 0) {
              const paused = video.paused;
              self.clearInterval(playedInterval);
              callback({
                highestLevel: highestLevel,
                currentTimeDelta: currentTimeDelta,
                paused: paused,
                logs: self.logString,
              });
            }
          }, 2000);
        }
      });
    },
    url,
    config
  );
  expect(result, stringifyResult(result))
    .to.have.property('currentTimeDelta')
    .which.is.gt(0);
}

async function testSeekOnLive(url, config) {
  const result = await browser.executeAsyncScript(
    function (url, config) {
      const callback = arguments[arguments.length - 1];
      self.startStream(url, config, callback);
      const video = self.video;
      video.onloadeddata = function () {
        self.setTimeout(function () {
          video.currentTime = video.seekable.end(0) - 5;
        }, 5000);
      };
      video.onseeked = function () {
        callback({ code: 'seeked', logs: self.logString });
      };
    },
    url,
    config
  );
  expect(result, stringifyResult(result))
    .to.have.property('code')
    .which.equals('seeked');
}

async function testSeekOnVOD(url, config) {
  const result = await browser.executeAsyncScript(
    function (url, config) {
      const callback = arguments[arguments.length - 1];
      const startDateTime = +new Date();
      self.startStream(url, config, callback);

      let tracks;
      self.hls.on(self.Hls.Events.BUFFER_CREATED, function (eventName, data) {
        tracks = data.tracks;
      });
      const endOfStreamEvents = [];
      self.hls.on(self.Hls.Events.BUFFER_EOS, function (eventName, data) {
        endOfStreamEvents.push(data.type || 'main');
      });

      const video = self.video;
      video.ondurationchange = function () {
        console.log(
          '[test] > video  "durationchange": ' +
            video.duration +
            ', currentTime: ' +
            video.currentTime
        );
      };
      video.onloadeddata = function () {
        console.log('[test] > video  "loadeddata"');
        self.setTimeout(function () {
          const duration = video.duration;
          if (!isFinite(duration)) {
            video.onprogress = null;
            callback({
              code: 'non-finite-duration',
              duration: duration,
              logs: self.logString,
            });
          }
          // After seeking timeout if paused after 5 seconds
          let seekingTimeout = -1;
          video.onseeked = function () {
            console.log('[test] > video  "onseeked"');
            self.clearTimeout(seekingTimeout);
            self.setTimeout(function () {
              const currentTime = video.currentTime;
              const paused = video.paused;
              if (video.currentTime === 0 || paused) {
                console.log(
                  '[test] > FAIL ' +
                    (paused ? 'paused' : 'currentTime = ' + video.currentTime)
                );
                video.onprogress = null;
                callback({
                  code: 'paused',
                  currentTime: currentTime,
                  duration: duration,
                  paused: paused,
                  logs: self.logString,
                });
              }
            }, 5000);
          };
          const seekToTime = video.seekable.end(0) - 3;
          console.log(
            '[test] > Set video.currentTime from ' +
              video.currentTime +
              ' to ' +
              seekToTime
          );
          video.currentTime = seekToTime;
          // Test will timeout a little early to gather failure criteria in callback
          const testRunTimeRemaining = 99000 - (new Date() - startDateTime);
          const testTimeoutMs = Math.max(testRunTimeRemaining - 10000, 5000);
          seekingTimeout = self.setTimeout(function () {
            video.onprogress = null;
            const currentTime = video.currentTime;
            const duration = video.duration;
            const paused = video.paused;
            const seeking = video.seeking;

            const buffers = Object.keys(tracks).map(function (type) {
              const sourceBuffer = tracks[type].buffer;
              const timeRangeTuples = [];
              const buffered = sourceBuffer.buffered;
              for (let i = 0; i < buffered.length; i++) {
                timeRangeTuples.push(
                  `${buffered.start(i).toFixed(2)}-${buffered
                    .end(i)
                    .toFixed(2)}`
                );
              }
              return `${type}: [${timeRangeTuples.join(', ')}]`;
            });

            console.log(
              '[test] > FAIL: Timed out while ' +
                (seeking ? 'seeking' : paused ? 'paused' : '???') +
                ' @' +
                video.currentTime
            );

            callback({
              code: 'timeout-waiting-for-ended-event',
              currentTime: currentTime,
              duration: duration,
              buffers: buffers,
              endOfStreamEvents: endOfStreamEvents,
              paused: paused,
              seeking: seeking,
              logs: self.logString,
            });
          }, testTimeoutMs);
        }, 3000);
      };
      // Fail test early if more than 2 buffered ranges are found (with configured exceptions)
      const allowedBufferedRanges = config.allowedBufferedRangesInSeekTest || 2;
      video.onprogress = function () {
        if (video.buffered.length > allowedBufferedRanges) {
          video.onprogress = null;
          const duration = video.duration;
          callback({
            code: 'buffer-gaps',
            bufferedRanges: video.buffered.length,
            duration: duration,
            logs: self.logString,
          });
        }
      };
      self.hls.on(self.Hls.Events.MEDIA_ENDED, function (eventName, data) {
        video.onprogress = null;
        console.log(
          '[test] > video  "ended"' + data.stalled ? ' (stalled near end)' : ''
        );
        callback({
          code: 'ended',
          stalled: data.stalled,
          logs: self.logString,
        });
      });

      video.oncanplaythrough = video.onwaiting = function (e) {
        console.log(
          '[test] > video  "' + e.type + '", currentTime: ' + video.currentTime
        );
      };
    },
    url,
    config
  );
  expect(result, stringifyResult(result))
    .to.have.property('code')
    .which.equals('ended');
}

// async function testSeekEndVOD (url, config) {
//   const result = await browser.executeAsyncScript(function (url, config) {
//     const callback = arguments[arguments.length - 1];
//     self.startStream(url, config, callback);
//     const video = self.video;
//     video.onloadeddata = function () {
//       self.setTimeout(function () {
//         video.currentTime = video.duration;
//       }, 5000);
//     };
//     video.onended = function () {
//       callback({ code: 'ended', logs: self.logString });
//     };
//   }, url, config);
//   expect(result, stringifyResult(result)).to.have.property('code').which.equals('ended');
// }

async function testIsPlayingVOD(url, config) {
  const result = await browser.executeAsyncScript(
    function (url, config) {
      const callback = arguments[arguments.length - 1];
      self.startStream(url, config, callback);
      const video = self.video;
      self.hls.once(self.Hls.Events.FRAG_CHANGED, function () {
        const expectedPlaying = !(
          video.paused || // not playing when video is paused
          video.ended || // not playing when video is ended
          video.buffered.length === 0
        ); // not playing if nothing buffered
        const currentTime = video.currentTime;
        if (expectedPlaying) {
          self.setTimeout(function () {
            const playing = currentTime !== video.currentTime;
            console.log(
              '[test] > ' +
                (playing ? '' : 'FAIL: video expected playing. ') +
                'last currentTime/new currentTime=' +
                currentTime +
                '/' +
                video.currentTime
            );
            callback({ playing: playing });
          }, 5000);
        } else {
          console.log(
            '[test] > FAIL: video not playing. paused/ended/buffered.length=' +
              video.paused +
              '/' +
              video.ended +
              '/' +
              video.buffered.length
          );
          callback({ playing: false });
        }
      });
    },
    url,
    config
  );
  expect(result, stringifyResult(result)).to.have.property('playing').which.is
    .true;
}

async function testSeekBackToStart(url, config) {
  const result = await browser.executeAsyncScript(
    function (url, config) {
      const callback = arguments[arguments.length - 1];
      self.startStream(url, config, callback);
      const video = self.video;
      video.ontimeupdate = function () {
        if (video.currentTime > 0 && !video.paused) {
          self.setTimeout(function () {
            video.onseeked = function () {
              delete video.onseeked;
              video.ontimeupdate = function () {
                if (video.currentTime > 0 && !video.paused) {
                  delete video.ontimeupdate;
                  callback({ playing: true });
                }
              };
            };
            video.currentTime = 0;
            delete video.ontime;
          }, 500);
        }
      };
    },
    url,
    config
  );
  expect(result, stringifyResult(result)).to.have.property('playing').which.is
    .true;
}

let sauceConnectProcess;
async function sauceConnect(tunnelIdentifier) {
  return new Promise(function (resolve, reject) {
    console.log(
      `Running sauce-connect-launcher. Tunnel id: ${tunnelIdentifier}`
    );
    sauceConnectLauncher(
      {
        tunnelIdentifier: tunnelIdentifier,
      },
      (err, sauceConnectProcess) => {
        if (err) {
          console.error(err.message);
          reject(err);
          return;
        }
        console.log('Sauce Connect ready');
        resolve(sauceConnectProcess);
      }
    );
  });
}

async function sauceDisconnect() {
  return new Promise(function (resolve) {
    if (!sauceConnectProcess) {
      resolve();
    }
    sauceConnectProcess.close(function () {
      console.log('Closed Sauce Connect process');
      resolve();
    });
  });
}

function getPageURLComponents() {
  return {
    base:
      useSauce || !HLSJS_TEST_BASE ? 'http://localhost:8000' : HLSJS_TEST_BASE,
    path: '/tests/functional/auto/',
    file: `index${HlsjsLightBuild ? '-light' : ''}.html`,
  };
}

describe(`Testing hls.js playback in ${browserConfig.name} ${browserConfig.version} ${browserConfig.platform ? browserConfig.platform : ''}`, function () {
  const failedUrls = {};

  before(async function () {
    const labelBranch = process.env.GITHUB_REF || 'unknown';
    const capabilities = {
      name: `hls.js@${labelBranch} on "${browserDescription}"`,
      browserName: browserConfig.name,
      platformName: browserConfig.platform,
      browserVersion: browserConfig.version,
      commandTimeout: 90,
    };

    if (browserConfig.name === 'chrome') {
      capabilities.chromeOptions = {
        args: [
          '--autoplay-policy=no-user-gesture-required',
          '--disable-web-security',
        ],
      };
    }

    if (!useSauce) {
      // Configure webdriver for local testing
      if (browserConfig.name === 'safari') {
        browser = new webdriver.Builder()
          .forBrowser(webdriver.Browser.SAFARI)
          .build();
      } else if (browserConfig.name === 'chrome') {
        browser = new webdriver.Builder()
          .forBrowser(webdriver.Browser.CHROME)
          .setChromeOptions()
          .build();
      } else if (browserConfig.name === 'firefox') {
        browser = new webdriver.Builder()
          .forBrowser(webdriver.Browser.FIREFOX)
          .build();
      } else {
        browser = new webdriver.Builder()
          .withCapabilities(capabilities)
          .build();
      }
    } else {
      if (process.env.SAUCE_TUNNEL_ID) {
        capabilities['sauce:options'] = {
          build: 'HLSJS-' + process.env.SAUCE_TUNNEL_ID,
          ['tunnel-identifier']: process.env.SAUCE_TUNNEL_ID,
        };
      } else {
        capabilities['sauce:options'] = {
          ['tunnel-identifier']: `local-${Date.now()}`,
        };
      }
      if (!process.env.SAUCE_TUNNEL_ID) {
        sauceConnectProcess = await sauceConnect(
          capabilities['tunnel-identifier']
        );
      }
      capabilities['sauce:options'].public = 'public restricted';
      capabilities['sauce:options'].avoidProxy = true;
      capabilities['sauce:options']['record-screenshots'] = false;
      browser = new webdriver.Builder()
        .usingServer(
          `https://${process.env.SAUCE_USERNAME}:${process.env.SAUCE_ACCESS_KEY}@ondemand.us-west-1.saucelabs.com:443/wd/hub`
        )
        .withCapabilities(capabilities)
        .build();
    }

    const start = Date.now();

    try {
      await retry(async function () {
        console.log('Retrieving web driver session...');
        const [, session] = await Promise.all([
          browser.manage().setTimeouts({ script: 75000 }),
          browser.getSession(),
        ]);
        console.log(`Retrieved session in ${Date.now() - start}ms`);
        if (useSauce) {
          console.log(`Job URL: https://saucelabs.com/jobs/${session.getId()}`);
        } else {
          console.log(`WebDriver SessionID: ${session.getId()}`);
        }
      });
    } catch (err) {
      await sauceDisconnect();
      throw new Error(`failed setting up session: ${err}`);
    }
  });

  beforeEach(async function () {
    try {
      await retry(async () => {
        const page = getPageURLComponents();
        const testPageUrl = `${page.base}${page.path}${page.file}`;
        if (printDebugLogs) {
          console.log(`Loading test page: ${testPageUrl}`);
        }
        try {
          await browser.get(testPageUrl);
          await browser.manage().window().setRect(0, 0, 1200, 850);
        } catch (e) {
          throw new Error('failed to open test page');
        }
        if (printDebugLogs) {
          console.log('Test page loaded.');
        }
        try {
          await browser.wait(
            until.elementLocated(By.css('body#hlsjs-functional-tests')),
            5000,
            'Failed to load test page, source of other page below.'
          );
        } catch (e) {
          const source = await browser.getPageSource();
          console.log(source);
          throw e;
        }
        if (printDebugLogs) {
          console.log('Test harness found, page confirmed loaded');
        }
      });
    } catch (e) {
      throw new Error(`error getting test page loaded: ${e}`);
    }
  });

  afterEach(async function () {
    const failed = this.currentTest.isFailed();
    if (printDebugLogs || failed) {
      const json = await browser.executeScript(function () {
        return JSON.stringify({
          url: self.hls ? self.hls.url : 'undefined',
          logs: self.logString || '',
        });
      });
      const data = JSON.parse(json);
      const url = data.url;

      const page = getPageURLComponents();
      console.log(`${page.base}/hls.js/demo/?src=${encodeURIComponent(url)}

============================= LOGS =======================================
${data.logs}
==========================================================================
`);
      failedUrls[url] = url in failedUrls ? failedUrls[url] + 1 : 1;

      if (failed && useSauce) {
        browser.executeScript('sauce:job-result=failed');
      }
    }
  });

  after(async function () {
    if (useSauce && this.currentTest && this.currentTest.parent) {
      const tests = this.currentTest.parent.tests;
      if (tests && tests.length && tests.every((test) => test.isPassed())) {
        browser.executeScript('sauce:job-result=passed');
      }
    }
    console.log('Quitting browser...');
    await browser.quit();
    console.log('Browser quit.');
    if (Object.keys(failedUrls).length > 0) {
      console.log(JSON.stringify(failedUrls, null, 2));
    }
    if (useSauce) {
      await sauceDisconnect();
    }
  });

  const entries = Object.entries(streams);
  if (HlsjsLightBuild) {
    entries.length = 10;
  }

  entries
    // eslint-disable-next-line no-unused-vars
    .filter(([name, stream]) => !stream.skipFunctionalTests)
    // eslint-disable-next-line no-unused-vars
    .forEach(([name, stream], index) => {
      const url = stream.url;
      const config = stream.config || {};
      if (DEBUG !== undefined) {
        config.debug = DEBUG;
      }

      config.preferManagedMediaSource = false;
      if (
        stream.skip_ua &&
        stream.skip_ua.some((browserInfo) => {
          if (typeof browserInfo === 'string') {
            return browserInfo === browserConfig.name;
          }
          return (
            browserInfo.name === browserConfig.name &&
            browserInfo.version === browserConfig.version
          );
        })
      ) {
        return;
      }

      describe(`${index + 1}. [${name}]: ${stream.description} (${stream.url})`, function () {
        it(
          `should receive video loadeddata event`,
          testLoadedData.bind(null, url, config)
        );

        if (stream.startSeek && !HlsjsLightBuild) {
          it(
            `seek back to start and play`,
            testSeekBackToStart.bind(null, url, config)
          );
        }

        if (stream.abr) {
          it(
            `should "smooth switch" to highest level with playback advancing`,
            testSmoothSwitch.bind(null, url, config)
          ).timeout(90000);
        }

        if (stream.live) {
          it(
            `should seek near the end and receive video seeked event`,
            testSeekOnLive.bind(null, url, config)
          ).timeout(99000); // When changing this value, make sure to update `testRunTimeRemaining` calculation.
        } else if (!HlsjsLightBuild) {
          it(
            `should buffer up to maxBufferLength or video.duration`,
            testIdleBufferLength.bind(null, url, config)
          ).timeout(90000);
          it(
            `should play ${stream.description}`,
            testIsPlayingVOD.bind(null, url, config)
          );

          it(
            `should seek 3s from end and receive video ended event with 2 or less buffered ranges`,
            testSeekOnVOD.bind(null, url, config)
          ).timeout(90000);
          // TODO: Seeking to or past VOD duration should result in the video ending
          // it(`should seek on end and receive video ended event`, testSeekEndVOD.bind(null, url));
        }
      });
    });
});
