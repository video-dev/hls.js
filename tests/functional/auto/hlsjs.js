var assert = require("assert");
var webdriver = require("selenium-webdriver");
// requiring this automatically adds the chromedriver binary to the PATH
var chromedriver = require("chromedriver");
var HttpServer = require("http-server");

HttpServer.createServer({
  showDir: false,
  autoIndex: false,
  root: './',
}).listen(8000, '0.0.0.0');

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

  it("should receive video loadeddata event", function(done) {
    this.browser.executeAsyncScript(function() {
      var callback = arguments[arguments.length - 1];
      testLoadedData(callback);
    }).then(function(result) {
      assert.strictEqual(result,'loadeddata');
      done();
    });
  });

  it("should seek and receive video ended event", function(done) {
    this.browser.executeAsyncScript(function() {
      var callback = arguments[arguments.length - 1];
      testEnded(callback);
    }).then(function(result) {
      assert.strictEqual(result,'ended');
      done();
    });
  });

});
