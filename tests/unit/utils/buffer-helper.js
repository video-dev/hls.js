import { BufferHelper } from '../../../src/utils/buffer-helper';

function createMockBuffer(buffered) {
  return {
    start: (i) => (buffered.length > i ? buffered[i].startPTS : null),
    end: (i) => (buffered.length > i ? buffered[i].endPTS : null),
    length: buffered.length,
  };
}

describe('BufferHelper', function () {
  describe('isBuffered', function () {
    // |////////|________|////////////////|
    // 0       0.5       1                2
    const media = {
      get buffered() {
        return createMockBuffer([
          {
            startPTS: 0,
            endPTS: 0.5,
          },
          {
            startPTS: 1,
            endPTS: 2,
          },
        ]);
      },
    };

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

    it('should return false if media.buffered throws error', function () {
      const invalidMedia = {
        get buffered() {
          throw new Error('InvalidStateError');
        },
      };
      expect(BufferHelper.isBuffered(invalidMedia, 0)).to.be.false;
    });
    it('should return false if media does not exist', function () {
      expect(BufferHelper.isBuffered(null, 0)).to.be.false;
    });
  });

  describe('bufferInfo', function () {
    it('should return found buffer info if some media.buffered includes pos with allowed error', function () {
      // |////////|________|////////////////|
      // 0       0.5       1                2
      const media = {
        get buffered() {
          return createMockBuffer([
            {
              startPTS: 0,
              endPTS: 0.5,
            },
            {
              startPTS: 1,
              endPTS: 2,
            },
          ]);
        },
      };
      const maxHoleDuration = 0;
      expect(BufferHelper.bufferInfo(media, 0, maxHoleDuration)).to.deep.equal({
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1,
      });
    });
    it('should return empty buffer info if media does not exist', function () {
      const invalidMedia = {
        get buffered() {
          throw new Error('InvalidStateError');
        },
      };
      const maxHoleDuration = 0;
      expect(
        BufferHelper.bufferInfo(invalidMedia, 0, maxHoleDuration)
      ).to.deep.equal({
        len: 0,
        start: 0,
        end: 0,
        nextStart: undefined,
      });
    });
    it('should return empty buffer info if media does not exist', function () {
      const maxHoleDuration = 0;
      expect(BufferHelper.bufferInfo(null, 0, maxHoleDuration)).to.deep.equal({
        len: 0,
        start: 0,
        end: 0,
        nextStart: undefined,
      });
    });
  });

  describe('bufferedInfo', function () {
    it('should return found buffer info when maxHoleDuration is 0', function () {
      // |////////|________|////////////////|
      // 0       0.5       1                2
      const buffered = [
        {
          start: 0,
          end: 0.5,
        },
        {
          start: 1,
          end: 2,
        },
      ];
      const maxHoleDuration = 0;
      expect(
        BufferHelper.bufferedInfo(buffered, 0, maxHoleDuration)
      ).to.deep.equal({
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1,
      });
      expect(
        BufferHelper.bufferedInfo(buffered, 0.5, maxHoleDuration)
      ).to.deep.equal({
        len: 0,
        start: 0.5,
        end: 0.5,
        nextStart: 1,
      });
      expect(
        BufferHelper.bufferedInfo(buffered, 1, maxHoleDuration)
      ).to.deep.equal({
        len: 1,
        start: 1,
        end: 2,
        nextStart: undefined,
      });
      expect(
        BufferHelper.bufferedInfo(buffered, 1.5, maxHoleDuration)
      ).to.deep.equal({
        len: 0.5,
        start: 1,
        end: 2,
        nextStart: undefined,
      });
    });
    it('should return found buffer info when maxHoleDuration is 0.5', function () {
      // |////////|________|////////////////|
      // 0       0.5       1                2
      const buffered = [
        {
          start: 0,
          end: 0.5,
        },
        {
          start: 1,
          end: 2,
        },
      ];
      const maxHoleDuration = 0.5;
      expect(
        BufferHelper.bufferedInfo(buffered, 0, maxHoleDuration)
      ).to.deep.equal({
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1,
      });
      // M: maxHoleDuration: 0.5
      // |////////|________|////////////////|
      // 0       0.5 - M - 1                2
      expect(
        BufferHelper.bufferedInfo(buffered, 0.5, maxHoleDuration)
      ).to.deep.equal({
        len: 1.5,
        start: 1,
        end: 2,
        nextStart: undefined,
      });
      expect(
        BufferHelper.bufferedInfo(buffered, 1, maxHoleDuration)
      ).to.deep.equal({
        len: 1,
        start: 1,
        end: 2,
        nextStart: undefined,
      });
      expect(
        BufferHelper.bufferedInfo(buffered, 2, maxHoleDuration)
      ).to.deep.equal({
        len: 0,
        start: 2,
        end: 2,
        nextStart: undefined,
      });
    });
    it('should be able to handle unordered buffered', function () {
      // |////////|________|////////////////|
      // 0       0.5      1.0              2.0
      const buffered = [
        {
          start: 1,
          end: 2,
        },
        {
          start: 0,
          end: 0.5,
        },
      ];
      const maxHoleDuration = 0.5;
      expect(
        BufferHelper.bufferedInfo(buffered, 0, maxHoleDuration)
      ).to.deep.equal({
        len: 0.5,
        start: 0,
        end: 0.5,
        nextStart: 1,
      });
    });
    it('should be able to merge adjacent time ranges with a small hole', function () {
      // |////////|________|////////////////|
      // 0       0.5       1                2
      const buffered = [
        {
          start: 0,
          end: 0.5,
        },
        {
          start: 1,
          end: 2,
        },
      ];
      const maxHoleDuration = 1;
      expect(
        BufferHelper.bufferedInfo(buffered, 0.8, maxHoleDuration)
      ).to.deep.equal({
        len: 1.2,
        start: 0,
        end: 2,
        nextStart: undefined,
      });
    });
    it('should be able to merge overlapping time ranges', function () {
      // |////////|________|
      // |////////|////////|
      // 0       0.5       1
      const buffered = [
        {
          start: 0,
          end: 0.5,
        },
        {
          start: 0,
          end: 1,
        },
      ];
      const maxHoleDuration = 0.5;
      expect(
        BufferHelper.bufferedInfo(buffered, 0.5, maxHoleDuration)
      ).to.deep.equal({
        len: 0.5,
        start: 0,
        end: 1,
        nextStart: undefined,
      });
    });
    it('should return empty buffered if pos is out of range', function () {
      const buffered = [
        {
          start: 0,
          end: 0.5,
        },
        {
          start: 0,
          end: 1,
        },
      ];
      const maxHoleDuration = 0;
      expect(
        BufferHelper.bufferedInfo(buffered, 5, maxHoleDuration)
      ).to.deep.equal({
        len: 0,
        start: 5,
        end: 5,
        nextStart: undefined,
      });
    });
    it('should return empty buffered if buffered is empty', function () {
      const buffered = [];
      const maxHoleDuration = 0;
      expect(
        BufferHelper.bufferedInfo(buffered, 5, maxHoleDuration)
      ).to.deep.equal({
        len: 0,
        start: 5,
        end: 5,
        nextStart: undefined,
      });
    });
  });

  describe('getBuffered', function () {
    it('should return buffered if no error is thrown', function () {
      const media = {
        buffered: {
          length: 10,
          start() {},
          end() {},
        },
      };
      expect(BufferHelper.getBuffered(media)).to.eql(media.buffered);
    });

    it('should return return noop value if error is thrown', function () {
      const media = {
        get buffered() {
          throw new Error();
        },
      };
      expect(BufferHelper.getBuffered(media).length).to.eql(0);
    });
  });
});
