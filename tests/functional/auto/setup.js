const assert = require('assert');
const webdriver = require('selenium-webdriver');
// requiring this automatically adds the chromedriver binary to the PATH
const chromedriver = require('chromedriver');
const HttpServer = require('http-server');
const streams = require('../../test-streams');

const browserConfig = { version: 'latest' };
const onTravis = !!process.env.TRAVIS;

let browserDescription;

let stream;

// Setup browser config data from env vars
(function () {
  if (onTravis) {
    let UA_VERSION = process.env.UA_VERSION;
    if (UA_VERSION) {
      browserConfig.version = UA_VERSION;
    }

    let UA = process.env.UA;
    if (!UA) {
      throw new Error('No test browser name.');
    }

    let OS = process.env.OS;
    if (!OS) {
      throw new Error('No test browser platform.');
    }

    browserConfig.name = UA;
    browserConfig.platform = OS;
  } else {
    browserConfig.name = 'chrome';
  }

  browserDescription = browserConfig.name;

  if (browserConfig.version) {
    browserDescription += ' (' + browserConfig.version + ')';
  }

  if (browserConfig.platform) {
    browserDescription += ', ' + browserConfig.platform;
  }
})();

// Launch static server
(function () {
  HttpServer.createServer({
    showDir: false,
    autoIndex: false,
    root: './'
  }).listen(8000, '127.0.0.1');
}());

function retry (cb, numAttempts, interval) {
  const DEFAULT_NUM_ATTEMPTS = 20;
  const DEFAULT_INTERVAL_MS = 3000;

  numAttempts = numAttempts || DEFAULT_NUM_ATTEMPTS;
  interval = interval || DEFAULT_INTERVAL_MS;
  return new Promise(function (resolve, reject) {
    let attempts = 0;
    attempt();

    function attempt () {
      cb().then(function (res) {
        resolve(res);
      }).catch(function (e) {
        if (++attempts >= numAttempts) {
          // reject with the last error
          reject(e);
        } else {
          setTimeout(attempt, interval);
        }
      });
    }
  });
}

describe('testing hls.js playback in the browser on "' + browserDescription + '"', function () {
  beforeEach(function () {
    if (!stream) {
      throw new Error('Stream not defined');
    }

    let capabilities = {
      name: '"' + stream.description + '" on "' + browserDescription + '"',
      browserName: browserConfig.name,
      platform: browserConfig.platform,
      version: browserConfig.version,
      commandTimeout: 90
    };
    if (browserConfig.name === 'chrome') {
      capabilities.chromeOptions = {
        args: ['--autoplay-policy=no-user-gesture-required', '--disable-web-security']
      };
    }
    if (onTravis) {
      capabilities['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
      capabilities.build = 'HLSJS-' + process.env.TRAVIS_BUILD_NUMBER;
      capabilities.username = process.env.SAUCE_USERNAME;
      capabilities.accessKey = process.env.SAUCE_ACCESS_KEY;
      capabilities.avoidProxy = true;
      this.browser = new webdriver.Builder().usingServer('http://' + process.env.SAUCE_USERNAME + ':' + process.env.SAUCE_ACCESS_KEY + '@ondemand.saucelabs.com:80/wd/hub');
    } else {
      this.browser = new webdriver.Builder();
    }
    this.browser = this.browser.withCapabilities(capabilities).build();
    this.browser.manage().setTimeouts({ script: 75000 }).catch(function (err) {
      console.log('setTimeouts: ' + err);
    });
    console.log('Retrieving web driver session...');
    return this.browser.getSession().then(function (session) {
      console.log('Web driver session id: ' + session.getId());
      if (onTravis) {
        console.log('Job URL: https://saucelabs.com/jobs/' + session.getId());
      }

      return retry(function () {
        console.log('Loading test page...');
        return this.browser.get('http://127.0.0.1:8000/tests/functional/auto/index.html').then(function () {
          // ensure that the page has loaded and we haven't got an error page
          return this.browser.findElement(webdriver.By.css('body#hlsjs-functional-tests')).catch(function (e) {
            console.log('DOM not found');
            this.browser.getPageSource().then(function (source) {
              console.log(source);
              return Promise.reject(e);
            });
          }.bind(this));
        }.bind(this));
      }.bind(this)).then(function () {
        console.log('Test page loaded.');
      });
    }.bind(this), function (err) {
      console.log('error while Retrieving browser session:' + err);
    });
  });

  afterEach(function () {
    let browser = this.browser;
    return browser.executeScript('return logString').then(function (returnValue) {
      console.log('travis_fold:start:debug_logs');
      console.log('logs');
      console.log(returnValue);
      console.log('travis_fold:end:debug_logs');
      console.log('Quitting browser...');
      return browser.quit().then(function () {
        console.log('Browser quit.');
      });
    });
  });

  const testLoadedData = function (url, config) {
    return function () {
      return this.browser.executeAsyncScript(function (url, config) {
        let callback = arguments[arguments.length - 1];
        window.startStream(url, config, callback);
        const video = window.video;
        video.onloadeddata = function () {
          callback({ code: 'loadeddata', logs: window.logString });
        };
      }, url, config).then(function (result) {
        assert.strictEqual(result.code, 'loadeddata');
      });
    };
  };

  const testSmoothSwitch = function (url, config) {
    return function () {
      return this.browser.executeAsyncScript(function (url, config) {
        let callback = arguments[arguments.length - 1];
        window.startStream(url, config, callback);
        const video = window.video;
        video.onloadeddata = function () {
          window.switchToHighestLevel('next');
        };
        window.hls.on(window.Hls.Events.LEVEL_SWITCHED, function (event, data) {
          let currentTime = video.currentTime;
          if (data.level === window.hls.levels.length - 1) {
            console.log('[log] > switched on level:' + data.level);
            window.setTimeout(function () {
              let newCurrentTime = video.currentTime;
              console.log('[log] > currentTime delta :' + (newCurrentTime - currentTime));
              callback({ code: newCurrentTime > currentTime, logs: window.logString });
            }, 2000);
          }
        });
      }, url, config).then(function (result) {
        assert.strictEqual(result.code, true);
      });
    };
  };

  const testSeekOnLive = function (url, config) {
    return function () {
      return this.browser.executeAsyncScript(function (url, config) {
        let callback = arguments[arguments.length - 1];
        window.startStream(url, config, callback);
        const video = window.video;
        video.onloadeddata = function () {
          window.setTimeout(function () {
            video.currentTime = video.duration - 5;
          }, 5000);
        };
        video.onseeked = function () {
          callback({ code: 'seeked', logs: window.logString });
        };
      }, url, config).then(function (result) {
        assert.strictEqual(result.code, 'seeked');
      });
    };
  };

  const testSeekOnVOD = function (url, config) {
    return function () {
      return this.browser.executeAsyncScript(function (url, config) {
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
      }, url, config).then(function (result) {
        assert.strictEqual(result.code, 'ended');
      });
    };
  };

  const testSeekEndVOD = function (url, config) {
    return function () {
      return this.browser.executeAsyncScript(function (url, config) {
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
      }, url, config).then(function (result) {
        assert.strictEqual(result.code, 'ended');
      });
    };
  };

  const testIsPlayingVOD = function (url, config) {
    return function () {
      return this.browser.executeAsyncScript(function (url, config) {
        let callback = arguments[arguments.length - 1];
        window.startStream(url, config, callback);
        const video = window.video;
        video.onloadeddata = function () {
          let expectedPlaying = !(video.paused || // not playing when video is paused
            video.ended || // not playing when video is ended
            video.buffered.length === 0); // not playing if nothing buffered
          let currentTime = video.currentTime;
          if (expectedPlaying) {
            window.setTimeout(function () {
              console.log('video expected playing. [last currentTime/new currentTime]=[' + currentTime + '/' + video.currentTime + ']');
              callback({ playing: currentTime !== video.currentTime });
            }, 5000);
          } else {
            console.log('video not playing. [paused/ended/buffered.length]=[' + video.paused + '/' + video.ended + '/' + video.buffered.length + ']');
            callback({ playing: false });
          }
        };
      }, url, config).then(function (result) {
        assert.strictEqual(result.playing, true);
      });
    };
  };

  for (let name in streams) {
    stream = streams[name];
    let url = stream.url;
    let config = stream.config || {};
    if (!stream.blacklist_ua || stream.blacklist_ua.indexOf(browserConfig.name) === -1) {
      it('should receive video loadeddata event for ' + stream.description, testLoadedData(url, config));
      if (stream.abr) {
        it('should "smooth switch" to highest level and still play(readyState === 4) after 12s for ' + stream.description, testSmoothSwitch(url, config));
      }

      if (stream.live) {
        it('should seek near the end and receive video seeked event for ' + stream.description, testSeekOnLive(url, config));
      } else {
        it('should play ' + stream.description, testIsPlayingVOD(url, config));
        it('should seek 5s from end and receive video ended event for ' + stream.description, testSeekOnVOD(url, config));
        // it('should seek on end and receive video ended event for ' + stream.description, testSeekEndVOD(url));
      }
    }
  }
});
