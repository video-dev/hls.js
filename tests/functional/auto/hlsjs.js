var assert = require("assert");
var webdriver = require("selenium-webdriver");
// requiring this automatically adds the chromedriver binary to the PATH
var chromedriver = require("chromedriver");
var HttpServer = require("http-server");

var onTravis = !!process.env.TRAVIS
var STREAM = onTravis ? JSON.parse(process.env.TEST_STREAM) : { url : 'http://www.streambox.fr/playlists/test_001/stream.m3u8', description : 'ARTE China,ABR', live : false , abr : true};
if (!STREAM) {
  throw new Error("No stream.");
}

HttpServer.createServer({
  showDir: false,
  autoIndex: false,
  root: './',
}).listen(8000, '127.0.0.1');

describe("testing hls.js playback in the browser with \""+STREAM.description+"\"", function() {
  beforeEach(function() {
    if (onTravis) {
      this.browser = new webdriver.Builder()
      .usingServer('http://'+ process.env.SAUCE_USERNAME+':'+process.env.SAUCE_ACCESS_KEY+'@ondemand.saucelabs.com:80/wd/hub')
      .withCapabilities({
        'tunnel-identifier': process.env.TRAVIS_JOB_NUMBER,
        build: process.env.TRAVIS_BUILD_NUMBER,
        username: process.env.SAUCE_USERNAME,
        accessKey: process.env.SAUCE_ACCESS_KEY,
        browserName : 'chrome',
        platform : 'Windows 10',
        version : '53.0'
      }).build();
    } else {
      this.browser = new webdriver.Builder()
      .withCapabilities({
        browserName : 'chrome'
      }).build();
    }
    this.browser.manage().timeouts().setScriptTimeout(40000);
    return this.browser.get("http://localhost:8000/tests/functional/auto/hlsjs.html");
  });

  afterEach(function() {
    return this.browser.quit();
  });

  it("should receive video loadeddata event", function() {
    var url = STREAM.url;
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

  if (STREAM.abr) {
    it("should 'smooth switch' to highest level and still play(readyState === 4) after 12s", function() {
      var url = STREAM.url;
      return this.browser.executeAsyncScript(function(url) {
        var callback = arguments[arguments.length - 1];
        startStream(url, callback);
        video.onloadeddata = function() {
          switchToHighestLevel('next');
        };
        window.setTimeout(function() { callback(video.readyState);},12000);
      }, url).then(function(result) {
        assert.strictEqual(result, 4);
      });
    });
  }

  if (STREAM.live) {
    it("should seek near the end and receive video seeked event", function() {
      var url = STREAM.url;
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
    it("should seek near the end and receive video ended event", function() {
      var url = STREAM.url;
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
