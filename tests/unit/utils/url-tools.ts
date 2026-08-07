import { expect } from 'chai';
import { setQueryParam } from '../../../src/utils/url-tools';

describe('url-tools', function () {
  describe('setQueryParam', function () {
    it('appends a parameter to a URL without a query string', function () {
      const url = new URL('https://example.com/media.m3u8');
      setQueryParam(url, '_HLS_skip', 'YES');
      expect(url.href).to.equal('https://example.com/media.m3u8?_HLS_skip=YES');
    });

    it('appends a parameter after an existing query string', function () {
      const url = new URL('https://example.com/media.m3u8?foo=1&bar=2');
      setQueryParam(url, '_HLS_msn', '100');
      expect(url.href).to.equal(
        'https://example.com/media.m3u8?foo=1&bar=2&_HLS_msn=100',
      );
    });

    it('leaves reserved characters in existing parameters untouched', function () {
      // Signed CDN URLs carry `~`, `=` and `/` verbatim inside a query
      // parameter and validate the result byte-for-byte, so re-encoding them
      // as %7E, %3D and %2F invalidates the signature.
      const token = 'st=1600000000~exp=1600003600~acl=/live/*~hmac=abc123';
      const url = new URL(`https://example.com/media.m3u8?token=${token}`);
      setQueryParam(url, '_HLS_part', '2');
      expect(url.href).to.equal(
        `https://example.com/media.m3u8?token=${token}&_HLS_part=2`,
      );
    });

    it('replaces an existing parameter in place rather than duplicating it', function () {
      const url = new URL(
        'https://example.com/media.m3u8?foo=1&_HLS_skip=YES&bar=2',
      );
      setQueryParam(url, '_HLS_skip', 'v2');
      expect(url.href).to.equal(
        'https://example.com/media.m3u8?foo=1&_HLS_skip=v2&bar=2',
      );
    });

    it('replaces an existing parameter that has no value', function () {
      const url = new URL('https://example.com/media.m3u8?foo&bar=2');
      setQueryParam(url, 'foo', '1');
      expect(url.href).to.equal('https://example.com/media.m3u8?foo=1&bar=2');
    });

    it('removes duplicates of the key, keeping the first position', function () {
      const url = new URL('https://example.com/media.m3u8?a=1&b=2&a=3');
      setQueryParam(url, 'a', '9');
      expect(url.href).to.equal('https://example.com/media.m3u8?a=9&b=2');
    });

    it('does not replace a parameter whose key only shares a prefix', function () {
      const url = new URL('https://example.com/media.m3u8?_HLS_msn2=5');
      setQueryParam(url, '_HLS_msn', '100');
      expect(url.href).to.equal(
        'https://example.com/media.m3u8?_HLS_msn2=5&_HLS_msn=100',
      );
    });

    it('component-encodes the inserted key and value', function () {
      const url = new URL('https://example.com/media.m3u8?foo=1');
      setQueryParam(url, 'redirect uri', 'https://example.com/?a=1&b=2');
      expect(url.href).to.equal(
        'https://example.com/media.m3u8?foo=1&redirect%20uri=https%3A%2F%2Fexample.com%2F%3Fa%3D1%26b%3D2',
      );
    });
  });
});
