var assert = require("assert");
var webdriver = require("selenium-webdriver");
// requiring this automatically adds the chromedriver binary to the PATH
var chromedriver = require("chromedriver");
var HttpServer = require("http-server");

var STREAMS = [
  { url : 'http://www.streambox.fr/playlists/test_001/stream.m3u8', description : 'ARTE China,ABR' },
  { url : 'http://www.streambox.fr/playlists/x36xhzz/x36xhzz.m3u8', description : 'big buck bunny,ABR'},
  { url : 'http://www.streambox.fr/playlists/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8', description : 'big buck bunny,480p'},
  { url : 'http://www.streambox.fr/playlists/cisq0gim60007xzvi505emlxx.m3u8', description : 'https://github.com/dailymotion/hls.js/issues/666'}
 ];


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



  STREAMS.forEach(function(stream) {
    it("should receive video loadeddata event for " + stream.description, function() {
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

    it("should seek near the end and receive video ended event for " + stream.description, function() {
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
  });
});
