var assert = require("assert");
var URL = require("../../../src/utils/url");

describe('utils', function() {
  describe('url helper', function() {
    it('works with a selection of valid urls', function() {
      var fn = URL.buildAbsoluteURL;
      var e = assert.strictEqual;

      e(fn("http://a.com/b/cd/e.m3u8", "https://example.com/z.ts"), "https://example.com/z.ts");
      e(fn("http://a.com/b/cd/e.m3u8", "g:h"), "g:h");
      e(fn("http://a.com/b/cd/e.m3u8", "https://example.com:8080/z.ts"), "https://example.com:8080/z.ts");

      e(fn("http://a.com/b/cd/e.m3u8", "z.ts"), "http://a.com/b/cd/z.ts");
      e(fn("http://a.com:8080/b/cd/e.m3u8", "z.ts"), "http://a.com:8080/b/cd/z.ts");
      e(fn("http://a.com/b/cd/", "z.ts"), "http://a.com/b/cd/z.ts");
      e(fn("http://a.com/b/cd", "z.ts"), "http://a.com/b/z.ts");
      e(fn("http://a.com/b/cd?test=1", "z.ts"), "http://a.com/b/z.ts");
      e(fn("http://a.com/b/cd#something", "z.ts"), "http://a.com/b/z.ts");
      e(fn("http://a.com/b/cd?test=1#something", "z.ts"), "http://a.com/b/z.ts");
      e(fn("http://a.com/b/cd?test=1#something", "z.ts?abc=1"), "http://a.com/b/z.ts?abc=1");
      e(fn("http://a.com/b/cd?test=1#something", "z.ts#test"), "http://a.com/b/z.ts#test");
      e(fn("http://a.com/b/cd?test=1#something", "z.ts?abc=1#test"), "http://a.com/b/z.ts?abc=1#test");
      e(fn("http://a.com/b/cd?test=1#something", ";x"), "http://a.com/b/;x");
      e(fn("http://a.com/b/cd?test=1#something", "g;x"), "http://a.com/b/g;x");
      e(fn("http://a_b.com/b/cd?test=1#something", "g;x"), "http://a_b.com/b/g;x");
      e(fn("http://a-b.com/b/cd?test=1#something", "g;x"), "http://a-b.com/b/g;x");
      e(fn("http://a.b.com/b/cd?test=1#something", "g;x"), "http://a.b.com/b/g;x");
      e(fn("http://a~b.com/b/cd?test=1#something", "g;x"), "http://a~b.com/b/g;x");

      e(fn("http://a.com/b/cd/e.m3u8?test=1#something", "subdir/z.ts?abc=1#test"), "http://a.com/b/cd/subdir/z.ts?abc=1#test");
      e(fn("http://a.com/b/cd/e.m3u8?test=1#something", "/subdir/z.ts?abc=1#test"), "http://a.com/subdir/z.ts?abc=1#test");
      e(fn("http://a.com/b/cd/e.m3u8?test=1#something", "//example.com/z.ts?abc=1#test"), "http://example.com/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "//example.com/z.ts?abc=1#test"), "https://example.com/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "./z.ts?abc=1#test"), "https://a.com/b/cd/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "../z.ts?abc=1#test"), "https://a.com/b/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "./../z.ts?abc=1#test"), "https://a.com/b/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "././z.ts?abc=1#test"), "https://a.com/b/cd/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e/f.m3u8?test=1#something", "../../z.ts?abc=1#test"), "https://a.com/b/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "../../z.ts?abc=1#test"), "https://a.com/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "../../z.ts?abc=1&something=blah/./../test#test"), "https://a.com/z.ts?abc=1&something=blah/./../test#test");
      e(fn("https://a.com/b/cd/e/f.m3u8?test=1#something", "./../../z.ts?abc=1#test"), "https://a.com/b/z.ts?abc=1#test");

      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "subdir/pointless/../z.ts?abc=1#test"), "https://a.com/b/cd/subdir/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "/subdir/pointless/../z.ts?abc=1#test"), "https://a.com/subdir/z.ts?abc=1#test");
      e(fn("https://a.com/b/cd/e.m3u8?test=1#something", "//example.com/subdir/pointless/../z.ts?abc=1#test"), "https://example.com/subdir/z.ts?abc=1#test");

      e(fn("https://a-b.something.com/b/cd/e.m3u8?test=1#something", "//example.com/subdir/pointless/../z.ts?abc=1#test"), "https://example.com/subdir/z.ts?abc=1#test");

    });
  });
});
