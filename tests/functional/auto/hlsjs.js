var assert = require('assert');
var webdriver = require('selenium-webdriver');
// requiring this automatically adds the chromedriver binary to the PATH
var chromedriver = require('chromedriver');
var HttpServer = require('http-server');
var streams = require('../streams.json');

var onTravis = !!process.env.TRAVIS;
var STREAM_ID = onTravis ? process.env.TEST_STREAM_ID : 'arte';
if (!STREAM_ID) {
  throw new Error('No stream ID.');
}
var stream = streams[STREAM_ID];
if (!stream) {
  throw new Error('Could not find stream "'+stream_ID+'"');
}
var BROWSER_CONFIG = onTravis ? {name : 'chrome', version : '53.0', platform : 'Windows 10'} : { name : 'chrome' };

var browserDescription = BROWSER_CONFIG.name;
if (BROWSER_CONFIG.version) {
  browserDescription += ' ('+BROWSER_CONFIG.version+')';
}
if (BROWSER_CONFIG.platform) {
  browserDescription += ', '+BROWSER_CONFIG.platform;
}

HttpServer.createServer({
  showDir: false,
  autoIndex: false,
  root: './',
}).listen(8000, '127.0.0.1');

describe('testing hls.js playback in the browser with "'+stream.description+'" on "'+browserDescription+'"', function() {
  beforeEach(function() {
    var capabilities = {
      browserName : BROWSER_CONFIG.name,
      platform : BROWSER_CONFIG.platform,
      version: BROWSER_CONFIG.version
    };
    if (onTravis) {
      capabilities['tunnel-identifier'] = process.env.TRAVIS_JOB_NUMBER;
      capabilities.build = process.env.TRAVIS_BUILD_NUMBER;
      capabilities.username = process.env.SAUCE_USERNAME;
      capabilities.accessKey = process.env.SAUCE_ACCESS_KEY;
      this.browser = new webdriver.Builder().usingServer('http://'+ process.env.SAUCE_USERNAME+':'+process.env.SAUCE_ACCESS_KEY+'@ondemand.saucelabs.com:80/wd/hub');
    }
    else {
      this.browser = new webdriver.Builder();
    }
    this.browser = this.browser.withCapabilities(capabilities).build();
    this.browser.manage().timeouts().setScriptTimeout(40000);
    return this.browser.get('http://localhost:8000/tests/functional/auto/hlsjs.html');
  });

  afterEach(function() {
    return this.browser.quit();
  });

  it('should receive video loadeddata event', function() {
    var url = stream.url;
    return this.browser.executeAsyncScript(function(url) {
      var callback = arguments[arguments.length - 1];
      startStream(url, callback);
      video.onloadeddata = function() {
        callback('loadeddata');
      };
    }, url).then(function(result) {
      assert.strictEqual(result, 'loadeddata');
    });
  });

  if (stream.abr) {
    it('should "smooth switch" to highest level and still play(readyState === 4) after 12s', function() {
      var url = stream.url;
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          switchToHighestLevel('next');
        };
        window.setTimeout(function() { callback(video.readyState);}, 12000);
      }, url).then(function(result) {
        assert.strictEqual(result, 4);
      });
    });
  }

  if (stream.live) {
    it('should seek near the end and receive video seeked event', function() {
      var url = stream.url;
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          window.setTimeout(function() { video.currentTime = video.duration - 5;}, 5000);
        };
        video.onseeked = function() {
          callback('seeked');
        };
      }, url).then(function(result) {
        assert.strictEqual(result, 'seeked');
      });
    });
  } else {
    it('should seek near the end and receive video ended event', function() {
      var url = stream.url;
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          video.currentTime = video.duration - 5;
        };
        video.onended = function() {
          callback('ended');
        };
      }, url).then(function(result) {
        assert.strictEqual(result, 'ended');
      });
    });
  }
});
