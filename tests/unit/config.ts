import chai from 'chai';
import Hls from '../../src/hls';

const expect = chai.expect;

describe('Config Validation', function () {
  describe('liveMaxUnchangedPlaylistRefresh', function () {
    it('clamps values below 2', function () {
      const hls0 = new Hls({ liveMaxUnchangedPlaylistRefresh: 0 });
      expect(hls0.config.liveMaxUnchangedPlaylistRefresh).to.equal(2);
      hls0.destroy();

      const hls1 = new Hls({ liveMaxUnchangedPlaylistRefresh: 1 });
      expect(hls1.config.liveMaxUnchangedPlaylistRefresh).to.equal(2);
      hls1.destroy();

      const hlsNegative = new Hls({ liveMaxUnchangedPlaylistRefresh: -5 });
      expect(hlsNegative.config.liveMaxUnchangedPlaylistRefresh).to.equal(2);
      hlsNegative.destroy();
    });

    it('accepts valid values >= 2', function () {
      const hls2 = new Hls({ liveMaxUnchangedPlaylistRefresh: 2 });
      expect(hls2.config.liveMaxUnchangedPlaylistRefresh).to.equal(2);
      hls2.destroy();

      const hls5 = new Hls({ liveMaxUnchangedPlaylistRefresh: 5 });
      expect(hls5.config.liveMaxUnchangedPlaylistRefresh).to.equal(5);
      hls5.destroy();
    });

    it('accepts Infinity', function () {
      const hls = new Hls({ liveMaxUnchangedPlaylistRefresh: Infinity });
      expect(hls.config.liveMaxUnchangedPlaylistRefresh).to.equal(Infinity);
      hls.destroy();
    });

    it('defaults to Infinity when not specified', function () {
      const hls = new Hls({});
      expect(hls.config.liveMaxUnchangedPlaylistRefresh).to.equal(Infinity);
      hls.destroy();
    });
  });
});
