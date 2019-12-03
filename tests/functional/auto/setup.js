/* eslint-disable no-console */

const webdriver = require('selenium-webdriver');
const By = webdriver.By;
const until = webdriver.until;
// requiring this automatically adds the chromedriver binary to the PATH
// eslint-disable-next-line
const chromedriver = require('chromedriver');
const HttpServer = require('http-server');
const streams = require('../../test-streams');
const onTravis = !!process.env.TRAVIS;
const chai = require('chai');
const expect = chai.expect;

const browserConfig = {
  version: 'latest',
  name: 'chrome'
};

/**
 * @type {webdriver.ThenableWebDriver}
 */
let browser;
let stream;
// Setup browser config data from env vars
if (onTravis) {
  let UA = process.env.UA;
  if (!UA) {
    throw new Error('No test browser name.');
  }

  let OS = process.env.OS;
  if (!OS) {
    throw new Error('No test browser platform.');
  }

  let UA_VERSION = process.env.UA_VERSION;
  if (UA_VERSION) {
    browserConfig.version = UA_VERSION;
  }

  browserConfig.name = UA;
  browserConfig.platform = OS;
}

let browserDescription = browserConfig.name;

if (browserConfig.version) {
  browserDescription += ` (${browserConfig.version})`;
}

if (browserConfig.platform) {
  browserDescription += `, ${browserConfig.platform}`;
}

let hostname = onTravis ? 'localhost' : '127.0.0.1';

// Launch static server
HttpServer.createServer({
  showDir: false,
  autoIndex: false,
  root: './'
}).listen(8000, hostname);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function retry (attempt, numAttempts = 5, interval = 2000) {
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

async function testLoadedData (url, config) {
  const result = await browser.executeAsyncScript(
    (url, config) => {
      let callback = arguments[arguments.length - 1];
      window.startStream(url, config, callback);
      const video = window.video;
      video.onloadeddata = function () {
        callback({ code: 'loadeddata', logs: window.logString });
      };
    },
    url,
    config
  );
  expect(result, JSON.stringify(result, null, 2)).to.have.property('code').which.equals('loadeddata');
}

async function testSmoothSwitch (url, config) {
  const result = await browser.executeAsyncScript(
    (url, config) => {
      let callback = arguments[arguments.length - 1];
      window.startStream(url, config, callback);
      const video = window.video;
      video.onloadeddata = () => {
        window.switchToHighestLevel('next');
      };
      window.hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
        let currentTime = video.currentTime;
        if (data.level === window.hls.levels.length - 1) {
          console.log(`[log] > switched on level: ${data.level}`);
          window.setTimeout(() => {
            let newCurrentTime = video.currentTime;
            console.log(
              `[log] > currentTime delta : ${newCurrentTime - currentTime}`
            );
            callback({
              code: newCurrentTime > currentTime,
              logs: window.logString
            });
          }, 2000);
        }
      });
    },
    url,
    config
  );
  expect(result, JSON.stringify(result, null, 2)).to.have.property('code').which.equals(true);
}

async function testSeekOnLive (url, config) {
  const result = await browser.executeAsyncScript(
    (url, config) => {
      let callback = arguments[arguments.length - 1];
      window.startStream(url, config, callback);
      const video = window.video;
      video.onloadeddata = () => {
        window.setTimeout(() => {
          video.currentTime = video.duration - 5;
        }, 5000);
      };
      video.onseeked = () => {
        callback({ code: 'seeked', logs: window.logString });
      };
    },
    url,
    config
  );
  expect(result, JSON.stringify(result, null, 2)).to.have.property('code').which.equals('seeked');
}

async function testSeekOnVOD (url, config) {
  const result = await browser.executeAsyncScript(
    (url, config) => {
      let callback = arguments[arguments.length - 1];
      window.startStream(url, config, callback);
      const video = window.video;
      video.onloadeddata = function () {
        window.setTimeout(function () {
          video.currentTime = video.duration - 5;
        }, 5000);
      };
      video.onended = function () {
        callback({ code: 'ended', logs: window.logString });
      };
    },
    url,
    config
  );
  expect(result, JSON.stringify(result, null, 2)).to.have.property('code').which.equals('ended');
}

async function testSeekEndVOD (url, config) {
  const result = await browser.executeAsyncScript(
    (url, config) => {
      let callback = arguments[arguments.length - 1];
      window.startStream(url, config, callback);
      const video = window.video;
      video.onloadeddata = function () {
        window.setTimeout(function () {
          video.currentTime = video.duration;
        }, 5000);
      };
      video.onended = function () {
        callback({ code: 'ended', logs: window.logString });
      };
    },
    url,
    config
  );
  expect(result, JSON.stringify(result, null, 2)).to.have.property('code').which.equals('ended');
}

async function testIsPlayingVOD (url, config) {
  const result = await browser.executeAsyncScript(
    (url, config) => {
      let callback = arguments[arguments.length - 1];
      window.startStream(url, config, callback);
      const video = window.video;
      video.onloadeddata = () => {
        let expectedPlaying = !(
          video.paused || // not playing when video is paused
          video.ended || // not playing when video is ended
          video.buffered.length === 0
        ); // not playing if nothing buffered
        let currentTime = video.currentTime;
        if (expectedPlaying) {
          window.setTimeout(() => {
            console.log(
              `video expected playing. [last currentTime/new currentTime]=[${currentTime}/${video.currentTime}]`
            );
            callback({ playing: currentTime !== video.currentTime });
          }, 5000);
        } else {
          console.log(
            `video not playing. [paused/ended/buffered.length]=[${video.paused}/${video.ended}/${video.buffered.length}]`
          );
          callback({ playing: false });
        }
      };
    },
    url,
    config
  );
  expect(result, JSON.stringify(result, null, 2)).to.have.property('playing').which.is.true;
}

async function testSeekBackToStart (url, config) {
  const result = await browser.executeAsyncScript(
    (url, config) => {
      let callback = arguments[arguments.length - 1];
      window.startStream(url, config, callback);
      const video = window.video;
      video.ontimeupdate = function () {
        if (video.currentTime > 0 && !video.paused) {
          window.setTimeout(function () {
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
  expect(result, JSON.stringify(result, null, 2)).to.have.property('playing').which.is.true;
}

describe(`testing hls.js playback in the browser on "${browserDescription}"`, function () {
  beforeEach(async function () {
    // high timeout because sometimes getSession() takes a while
    this.timeout(100000);
    if (!stream) {
      throw new Error('Stream not defined');
    }

    let capabilities = {
      name: `"${stream.description}" on "${browserDescription}"`,
      browserName: browserConfig.name,
      platform: browserConfig.platform,
      version: browserConfig.version,
      commandTimeout: 90
    };

    if (browserConfig.name === 'chrome') {
      capabilities.chromeOptions = {
        args: [
          '--autoplay-policy=no-user-gesture-required',
          '--disable-web-security'
        ]
      };
    }

    browser = new webdriver.Builder();
    if (onTravis) {
      capabilities['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
      capabilities.build = 'HLSJS-' + process.env.TRAVIS_BUILD_NUMBER;
      capabilities.username = process.env.SAUCE_USERNAME;
      capabilities.accessKey = process.env.SAUCE_ACCESS_KEY;
      capabilities.avoidProxy = true;
      browser = browser.usingServer(`http://${process.env.SAUCE_USERNAME}:${process.env.SAUCE_ACCESS_KEY}@ondemand.saucelabs.com:80/wd/hub`);
    }

    browser = browser.withCapabilities(capabilities).build();
    try {
      await retry(async () => {
        let start = Date.now();
        console.log('Retrieving web driver session...');
        try {
          const [timeouts, session] = await Promise.all([
            browser.manage().setTimeouts({ script: 75000 }),
            browser.getSession()
          ]);
          console.log(`Retrieved session in ${Date.now() - start}ms`);
          if (onTravis) {
            console.log(
              `Job URL: https://saucelabs.com/jobs/${session.getId()}`
            );
          } else {
            console.log(`WebDriver SessionID: ${session.getId()}`);
          }
        } catch (err) {
          throw new Error(`failed setting up session: ${err}`);
        }

        console.log('Loading test page...');
        try {
          await browser.get(
            `http://${hostname}:8000/tests/functional/auto/index.html`
          );
        } catch (e) {
          throw new Error('failed to open test page');
        }
        console.log('Test page loaded.');

        console.log('Locating ID \'hlsjs-functional-tests\'');
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
        console.log('Located the ID, page confirmed loaded');
      });
    } catch (e) {
      throw new Error(`error getting test page loaded: ${e}`);
    }
  });

  afterEach(async function () {
    const logString = await browser.executeScript('return logString');
    console.log('travis_fold:start:debug_logs');
    console.log(logString);
    console.log('travis_fold:end:debug_logs');
    console.log('Quitting browser...');
    await browser.quit();
    console.log('Browser quit.');
  });

  for (let name in streams) {
    stream = streams[name];
    let url = stream.url;
    let config = stream.config || {};
    if (
      !stream.blacklist_ua ||
      stream.blacklist_ua.indexOf(browserConfig.name) === -1
    ) {
      it(
        `should receive video loadeddata event for ${stream.description}`,
        testLoadedData.bind(null, url, config)
      );

      if (stream.startSeek) {
        it(
          `seek back to start and play for ${stream.description}`,
          testSeekBackToStart.bind(null, url, config)
        );
      }

      if (stream.abr) {
        it(
          `should "smooth switch" to highest level and still play(readyState === 4) after 12s for ${stream.description}`,
          testSmoothSwitch.bind(null, url, config)
        );
      }

      if (stream.live) {
        it(
          `should seek near the end and receive video seeked event for ${stream.description}`,
          testSeekOnLive.bind(null, url, config)
        );
      } else {
        it(
          `should play ${stream.description}`,
          testIsPlayingVOD.bind(null, url, config)
        );
        it(
          `should seek 5s from end and receive video ended event for ${stream.description}`,
          testSeekOnVOD.bind(null, url, config)
        );
        // it(`should seek on end and receive video ended event for ${stream.description}`, testSeekEndVOD.bind(null, url));
      }
    }
  }
});
