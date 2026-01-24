import chai from 'chai';
import Hls from '../../src/hls';

const expect = chai.expect;

describe('Config Validation', function () {
  describe('liveMaxUnchangedPlaylistRefresh', function () {
    it('throws an error for invalid values (0 or negative)', function () {
      expect(() => {
        new Hls({ liveMaxUnchangedPlaylistRefresh: 0 });
      }).to.throw(
        'Illegal hls.js config: "liveMaxUnchangedPlaylistRefresh" must be > 0',
      );

      expect(() => {
        new Hls({ liveMaxUnchangedPlaylistRefresh: -1 });
      }).to.throw(
        'Illegal hls.js config: "liveMaxUnchangedPlaylistRefresh" must be > 0',
      );
    });

    it('accepts valid positive values', function () {
      const hls1 = new Hls({ liveMaxUnchangedPlaylistRefresh: 1 });
      expect(hls1.config.liveMaxUnchangedPlaylistRefresh).to.equal(1);
      hls1.destroy();

      const hls2 = new Hls({ liveMaxUnchangedPlaylistRefresh: 5 });
      expect(hls2.config.liveMaxUnchangedPlaylistRefresh).to.equal(5);
      hls2.destroy();

      const hls3 = new Hls({ liveMaxUnchangedPlaylistRefresh: Infinity });
      expect(hls3.config.liveMaxUnchangedPlaylistRefresh).to.equal(Infinity);
      hls3.destroy();
    });

    it('defaults to Infinity when not specified', function () {
      const hls = new Hls({});
      expect(hls.config.liveMaxUnchangedPlaylistRefresh).to.equal(Infinity);
      hls.destroy();
    });
  });
});
