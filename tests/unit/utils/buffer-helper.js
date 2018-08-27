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
      assert.equal(BufferHelper.isBuffered(invalidMedia, 0), false);
    });
    it('should return true if some media.buffered includes the position', function () {
      assert.equal(BufferHelper.isBuffered(media, 0), true);
      assert.equal(BufferHelper.isBuffered(media, 0.1), true);
      assert.equal(BufferHelper.isBuffered(media, 0.5), true);
      assert.equal(BufferHelper.isBuffered(media, 1), true);
      assert.equal(BufferHelper.isBuffered(media, 2), true);
    });
    it('should return false if any media.buffered does not includes the position', function () {
      assert.equal(BufferHelper.isBuffered(media, -0.1), false);
      assert.equal(BufferHelper.isBuffered(media, 0.51), false);
      assert.equal(BufferHelper.isBuffered(media, 0.9), false);
      assert.equal(BufferHelper.isBuffered(media, 2.1), false);
    });
  });
  describe('bufferInfo', () => {
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
      assert.deepEqual(BufferHelper.bufferInfo(media, 0, maxHoleDuration), {
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1
      });
      assert.deepEqual(BufferHelper.bufferInfo(media, 0.5, maxHoleDuration), {
        len: 0,
        start: 0.5,
        end: 0.5,
        nextStart: 1
      });
      assert.deepEqual(BufferHelper.bufferInfo(media, 1, maxHoleDuration), {
        len: 1,
        start: 1,
        end: 2,
        nextStart: undefined
      });
      assert.deepEqual(BufferHelper.bufferInfo(media, 2, maxHoleDuration), {
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
      assert.deepEqual(BufferHelper.bufferInfo(media, 0, maxHoleDuration), {
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1
      });
      // M: maxHoleDuration: 0.5
      // |////////|__________|////////////////|
      // 0     0.5 --- M --- 1               2.0
      assert.deepEqual(BufferHelper.bufferInfo(media, 0.5, maxHoleDuration), {
        len: 1.5,
        start: 1,
        end: 2,
        nextStart: undefined
      });
      assert.deepEqual(BufferHelper.bufferInfo(media, 1, maxHoleDuration), {
        len: 1,
        start: 1,
        end: 2,
        nextStart: undefined
      });
      assert.deepEqual(BufferHelper.bufferInfo(media, 2, maxHoleDuration), {
        len: 0,
        start: 2,
        end: 2,
        nextStart: undefined
      });
    });
  });
});
