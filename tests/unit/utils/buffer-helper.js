import { BufferHelper } from '../../../src/utils/buffer-helper';

const assert = require('assert');

function createMockBuffer (buffered) {
  return {
    start: i => (buffered.length > i) ? buffered[i].startPTS : null,
    end: i => (buffered.length > i) ? buffered[i].endPTS : null,
    length: buffered.length
  };
}

describe('BufferHelper', function () {
  describe('isBuffered', function () {
    // |////////|__________|////////////////|
    // 0       0.5         1               2.0
    const media = {
      get buffered () {
        return createMockBuffer([
          {
            startPTS: 0,
            endPTS: 0.5
          },
          {
            startPTS: 1,
            endPTS: 2.0
          }
        ]);
      }
    };

    it('should return true if media.buffered throw error', function () {
      const invalidMedia = {
        get buffered () {
          throw new Error('InvalidStateError');
        }
      };
      expect(BufferHelper.isBuffered(invalidMedia, 0)).to.be.false;
    });
    it('should return true if some media.buffered includes the position', function () {
      expect(BufferHelper.isBuffered(media, 0)).to.be.true;
      expect(BufferHelper.isBuffered(media, 0.1)).to.be.true;
      expect(BufferHelper.isBuffered(media, 0.5)).to.be.true;
      expect(BufferHelper.isBuffered(media, 1)).to.be.true;
      expect(BufferHelper.isBuffered(media, 2)).to.be.true;
    });
    it('should return false if any media.buffered does not includes the position', function () {
      expect(BufferHelper.isBuffered(media, -0.1)).to.be.false;
      expect(BufferHelper.isBuffered(media, 0.51)).to.be.false;
      expect(BufferHelper.isBuffered(media, 0.9)).to.be.false;
      expect(BufferHelper.isBuffered(media, 2.1)).to.be.false;
    });
  });
  describe('bufferInfo', function () {
    it('should return found buffer info when maxHoleDuration is 0', function () {
      // |////////|__________|////////////////|
      // 0       0.5         1               2.0
      const media = {
        get buffered () {
          return createMockBuffer([
            {
              startPTS: 0,
              endPTS: 0.5
            },
            {
              startPTS: 1,
              endPTS: 2.0
            }
          ]);
        }
      };
      const maxHoleDuration = 0;
      expect(BufferHelper.bufferInfo(media, 0, maxHoleDuration)).to.deep.equal({
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1
      });
      expect(BufferHelper.bufferInfo(media, 0.5, maxHoleDuration)).to.deep.equal({
        len: 0,
        start: 0.5,
        end: 0.5,
        nextStart: 1
      });
      expect(BufferHelper.bufferInfo(media, 1, maxHoleDuration)).to.deep.equal({
        len: 1,
        start: 1,
        end: 2,
        nextStart: undefined
      });
      expect(BufferHelper.bufferInfo(media, 2, maxHoleDuration)).to.deep.equal({
        len: 0,
        start: 2,
        end: 2,
        nextStart: undefined
      });
    });
    it('should return found buffer info when maxHoleDuration is 0.5', function () {
      // |////////|__________|////////////////|
      // 0       0.5         1               2.0
      const media = {
        get buffered () {
          return createMockBuffer([
            {
              startPTS: 0,
              endPTS: 0.5
            },
            {
              startPTS: 1,
              endPTS: 2.0
            }
          ]);
        }
      };
      const maxHoleDuration = 0.5;
      expect(BufferHelper.bufferInfo(media, 0, maxHoleDuration)).to.deep.equal({
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1
      });
      // M: maxHoleDuration: 0.5
      // |////////|__________|////////////////|
      // 0     0.5 --- M --- 1               2.0
      expect(BufferHelper.bufferInfo(media, 0.5, maxHoleDuration)).to.deep.equal({
        len: 1.5,
        start: 1,
        end: 2,
        nextStart: undefined
      });
      expect(BufferHelper.bufferInfo(media, 1, maxHoleDuration)).to.deep.equal({
        len: 1,
        start: 1,
        end: 2,
        nextStart: undefined
      });
      expect(BufferHelper.bufferInfo(media, 2, maxHoleDuration)).to.deep.equal({
        len: 0,
        start: 2,
        end: 2,
        nextStart: undefined
      });
    });
  });
});
