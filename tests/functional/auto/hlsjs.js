var assert = require('assert');
var webdriver = require('selenium-webdriver');
// requiring this automatically adds the chromedriver binary to the PATH
var chromedriver = require('chromedriver');
var HttpServer = require('http-server');
var streams = require('../streams.json');

function retry(cb, numAttempts, interval) {
  numAttempts = numAttempts || 20;
  interval = interval || 3000;
  return new Promise(function(resolve, reject) {
    var attempts = 0;
    attempt();

    function attempt() {
      cb().then(function(res) {
        resolve(res);
      }).catch(function(e) {
        if (++attempts >= numAttempts) {
          // reject with the last error
          reject(e);
        }
        else {
          setTimeout(attempt, interval);
        }
      });
    }
  });
}

var onTravis = !!process.env.TRAVIS;

HttpServer.createServer({
  showDir: false,
  autoIndex: false,
  root: './',
}).listen(8000, '127.0.0.1');


var browserConfig = {version : 'latest'};
if (onTravis) {
  var UA_VERSION = process.env.UA_VERSION;
  if (UA_VERSION) {
    browserConfig.version = UA_VERSION;
  }
  var UA = process.env.UA;
  if (!UA) {
    throw new Error('No test browser name.')
  }
  var OS = process.env.OS;
  if (!OS) {
    throw new Error('No test browser platform.')
  }
  browserConfig.name = UA;
  browserConfig.platform = OS;
}
else {
  browserConfig.name = "chrome";
}
var browserDescription = browserConfig.name;
if (browserConfig.version) {
  browserDescription += ' ('+browserConfig.version+')';
}
if (browserConfig.platform) {
  browserDescription += ', '+browserConfig.platform;
}

describe('testing hls.js playback in the browser on "'+browserDescription+'"', function() {
  beforeEach(function() {
    var capabilities = {
      name: '"'+stream.description+'" on "'+browserDescription+'"',
      browserName: browserConfig.name,
      platform: browserConfig.platform,
      version: browserConfig.version,
      commandTimeout: 90,
    };
    if (onTravis) {
      capabilities['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
      capabilities.build = 'HLSJS-'+process.env.TRAVIS_BUILD_NUMBER;
      capabilities.username = process.env.SAUCE_USERNAME;
      capabilities.accessKey = process.env.SAUCE_ACCESS_KEY;
      this.browser = new webdriver.Builder().usingServer('http://'+process.env.SAUCE_USERNAME+':'+process.env.SAUCE_ACCESS_KEY+'@ondemand.saucelabs.com:80/wd/hub');
    }
    else {
      this.browser = new webdriver.Builder();
    }
    this.browser = this.browser.withCapabilities(capabilities).build();
    this.browser.manage().timeouts().setScriptTimeout(75000);
    console.log("Retrieving web driver session...");
    return this.browser.getSession().then(function(session) {
      console.log("Web driver session id: "+session.getId());
      if (onTravis) {
        console.log("Job URL: https://saucelabs.com/jobs/"+session.getId());
      }
      return retry(function() {
        console.log("Loading test page...");
        return this.browser.get('http://127.0.0.1:8000/tests/functional/auto/hlsjs.html').then(function() {
          // ensure that the page has loaded and we haven't got an error page
          return this.browser.findElement(webdriver.By.css('body#hlsjs-functional-tests')).catch(function(e) {
            console.log("CSS not found");
            this.browser.getPageSource().then(function(source){
              console.log(source);
              return Promise.reject(e);
            });
          }.bind(this));
        }.bind(this));
      }.bind(this)).then(function() {
        console.log("Test page loaded.");
      });
    }.bind(this), function(err) {
      console.log('error while Retrieving browser session:' + err);
    });
  });

  afterEach(function() {
    var browser = this.browser;
    browser.executeScript('return logString').then(function(return_value){
      console.log('travis_fold:start:debug_logs');
      console.log('logs');
      console.log(return_value);
      console.log('travis_fold:end:debug_logs');
      console.log("Quitting browser...");
      return browser.quit().then(function() {
        console.log("Browser quit.");
      });
    });
  });

  const testLoadedData = function(url) {
    return function() {
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          callback({ code : 'loadeddata', logs : logString});
        };
      }, url).then(function(result) {
        assert.strictEqual(result.code, 'loadeddata');
      });
    }
  }

  const testSmoothSwitch = function(url) {
    return function() {
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          switchToHighestLevel('next');
        };
        window.setTimeout(function() {
          callback({ code : video.readyState, logs : logString});
        }, 12000);
      }, url).then(function(result) {
        assert.strictEqual(result.code, 4);
      });
    }
  }

  const testSeekOnLive = function(url) {
    return function() {
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          window.setTimeout(function() { video.currentTime = video.duration - 5;}, 5000);
        };
        video.onseeked = function() {
          callback({ code : 'seeked', logs : logString});
        };
      }, url).then(function(result) {
        assert.strictEqual(result.code, 'seeked');
      });
    }
  }

  const testSeekOnVOD = function(url) {
    return function() {
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          window.setTimeout(function() { video.currentTime = video.duration - 5;}, 5000);
        };
        video.onended = function() {
          callback({ code : 'ended', logs : logString});
        };
      }, url).then(function(result) {
        assert.strictEqual(result.code, 'ended');
      });
    }
  }

  const testSeekEndVOD = function(url) {
    return function() {
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          window.setTimeout(function() { video.currentTime = video.duration;}, 5000);
        };
        video.onended = function() {
          callback({ code : 'ended', logs : logString});
        };
      }, url).then(function(result) {
        assert.strictEqual(result.code, 'ended');
      });
    }
  }

  for (var name in streams) {
    var stream = streams[name];
    var url = stream.url;
    if (!stream.blacklist_ua || stream.blacklist_ua.indexOf(browserConfig.name) === -1) {
      it('should receive video loadeddata event for ' + stream.description, testLoadedData(url));
      if (stream.abr) {
        it('should "smooth switch" to highest level and still play(readyState === 4) after 12s for ' + stream.description, testSmoothSwitch(url));
      }

      if (stream.live) {
        it('should seek near the end and receive video seeked event for ' + stream.description, testSeekOnLive(url));
      } else {
        it('should seek 5s from end and receive video ended event for ' + stream.description, testSeekOnVOD(url));
        //it('should seek on end and receive video ended event for ' + stream.description, testSeekEndVOD(url));
      }
    }
  }
});
