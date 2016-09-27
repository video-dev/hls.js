var assert = require("assert");
var webdriver = require("selenium-webdriver");

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
        browserName: "chrome"
      }).build();
    } else {
      this.browser = new webdriver.Builder()
      .withCapabilities({
        browserName: "chrome"
      }).build();
    }
    return this.browser.get("http://localhost:8000/tests/functional/auto/hlsjs.html");
  });

  afterEach(function() {
    return this.browser.quit();
  });

  it("should receive loadeddata event", function(done) {
    var video = this.browser.findElement(webdriver.By.id('video'));
    this.browser.wait(function () {
        return this.browser.isElementPresent(webdriver.By.id("loadeddata"));
    }.bind(this), 80000).then(function() { done()});
  });
});
