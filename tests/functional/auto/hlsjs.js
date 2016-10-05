var assert = require("assert");
var webdriver = require("selenium-webdriver");
// requiring this automatically adds the chromedriver binary to the PATH
var chromedriver = require("chromedriver");
var HttpServer = require("http-server");

var STREAM_URL = 'http://www.streambox.fr/playlists/test_001/stream.m3u8';

HttpServer.createServer({
  showDir: false,
  autoIndex: false,
  root: './',
}).listen(8000, '127.0.0.1');

describe("testing hls.js playback in the browser", function() {
  beforeEach(function() {
    if (process.env.SAUCE_USERNAME != undefined) {
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
    this.browser.manage().timeouts().setScriptTimeout(20000);
    return this.browser.get("http://localhost:8000/tests/functional/auto/hlsjs.html");
  });

  afterEach(function() {
    return this.browser.quit();
  });

  it("should receive video loadeddata event", function() {
    return this.browser.executeAsyncScript(function(STREAM_URL) {
      var callback = arguments[arguments.length - 1];
      startStream(STREAM_URL, callback);
      video.onloadeddata = function() {
        callback('loadeddata');
      };
    }, STREAM_URL).then(function(result) {
      assert.strictEqual(result, 'loadeddata');
    });
  });

  it("should seek and receive video ended event", function() {
    return this.browser.executeAsyncScript(function(STREAM_URL) {
      var callback = arguments[arguments.length - 1];
      startStream(STREAM_URL, callback);
      video.onloadeddata = function() {
        video.currentTime = video.duration - 5;
      };
      video.onended = function() {
        callback('ended');
      };
    }, STREAM_URL).then(function(result) {
      assert.strictEqual(result, 'ended');
    });
  });

});
