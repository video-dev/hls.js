import { expect } from 'chai';
import { HlsSkip, HlsUrlParameters } from '../../../src/types/level';

describe('HlsUrlParameters', function () {
  describe('addDirectives', function () {
    it('appends directives to a URI without a query string', function () {
      const params = new HlsUrlParameters(undefined, undefined, HlsSkip.Yes);
      expect(params.addDirectives('https://example.com/media.m3u8')).to.equal(
        'https://example.com/media.m3u8?_HLS_skip=YES',
      );
    });

    it('appends blocking reload directives', function () {
      const params = new HlsUrlParameters(100, 2);
      expect(params.addDirectives('https://example.com/media.m3u8')).to.equal(
        'https://example.com/media.m3u8?_HLS_msn=100&_HLS_part=2',
      );
    });

    it('appends directives after an existing query string', function () {
      const params = new HlsUrlParameters(undefined, undefined, HlsSkip.v2);
      expect(
        params.addDirectives('https://example.com/media.m3u8?foo=1&bar=2'),
      ).to.equal('https://example.com/media.m3u8?foo=1&bar=2&_HLS_skip=v2');
    });

    it('leaves reserved characters in existing query parameters untouched', function () {
      // Signed CDN URLs carry `~`, `=` and `/` verbatim inside a query
      // parameter and validate the result byte-for-byte, so re-encoding them
      // as %7E, %3D and %2F invalidates the signature.
      const token = 'st=1600000000~exp=1600003600~acl=/live/*~hmac=abc123';
      const params = new HlsUrlParameters(undefined, undefined, HlsSkip.Yes);
      expect(
        params.addDirectives(`https://example.com/media.m3u8?token=${token}`),
      ).to.equal(`https://example.com/media.m3u8?token=${token}&_HLS_skip=YES`);
    });

    it('preserves multiple existing query parameters and their order', function () {
      const token = 'exp=1600003600~acl=%2f*%2f12345*~hmac=abc123';
      const params = new HlsUrlParameters(undefined, undefined, HlsSkip.Yes);
      expect(
        params.addDirectives(
          `https://example.com/media.m3u8?hdntl=${token}&unique_id=9f8e7d`,
        ),
      ).to.equal(
        `https://example.com/media.m3u8?hdntl=${token}&unique_id=9f8e7d&_HLS_skip=YES`,
      );
    });

    it('replaces a directive already present rather than duplicating it', function () {
      const params = new HlsUrlParameters(undefined, undefined, HlsSkip.v2);
      expect(
        params.addDirectives(
          'https://example.com/media.m3u8?foo=1&_HLS_skip=YES',
        ),
      ).to.equal('https://example.com/media.m3u8?foo=1&_HLS_skip=v2');
    });

    it('returns the URI unchanged when no directives are set', function () {
      const token = 'st=1600000000~exp=1600003600~acl=/live/*~hmac=abc123';
      const params = new HlsUrlParameters();
      expect(
        params.addDirectives(`https://example.com/media.m3u8?token=${token}`),
      ).to.equal(`https://example.com/media.m3u8?token=${token}`);
    });

    it('treats HlsSkip.No as no skip directive', function () {
      const params = new HlsUrlParameters(undefined, undefined, HlsSkip.No);
      expect(
        params.addDirectives('https://example.com/media.m3u8?foo=1'),
      ).to.equal('https://example.com/media.m3u8?foo=1');
    });

    it('does not drop a zero-valued msn or part', function () {
      const params = new HlsUrlParameters(0, 0);
      expect(params.addDirectives('https://example.com/media.m3u8')).to.equal(
        'https://example.com/media.m3u8?_HLS_msn=0&_HLS_part=0',
      );
    });

    it('throws on an invalid URI', function () {
      const params = new HlsUrlParameters(undefined, undefined, HlsSkip.Yes);
      expect(() => params.addDirectives('not a url')).to.throw();
    });
  });
});
