/**
 * @module BufferHelper
 *
 * Providing methods dealing with buffer length retrieval for example.
 *
 * In general, a helper around HTML5 MediaElement TimeRanges gathered from `buffered` property.
 *
 * Also @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/buffered
*/

export class BufferHelper {
  /**
   * Return true if `media`'s buffered include `position`
   * @param {HTMLMediaElement|SourceBuffer} media
   * @param {number} position
   * @returns {boolean}
   */
  static isBuffered (media, position) {
    try {
      if (media) {
        let buffered = media.buffered;
        for (let i = 0; i < buffered.length; i++) {
          if (position >= buffered.start(i) && position <= buffered.end(i)) {
            return true;
          }
        }
      }
    } catch (error) {
      // this is to catch
      // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer':
      // This SourceBuffer has been removed from the parent media source
    }
    return false;
  }

  /**
   *
   * @param {HTMLMediaElement|SourceBuffer} media
   * @param {number} playheadPosition
   * @param {number} maxHoleDuration
   * @returns {len: number, start: number, end: number, nextStart: number}
   */
  static mediaBufferInfo (media, playheadPosition, maxHoleDuration) {
    try {
      if (media) {
        let bufferedRanges = media.buffered;
        let bufferedRangeInfos = [];

        for (let i = 0; i < bufferedRanges.length; i++) {
          bufferedRangeInfos.push({ start: bufferedRanges.start(i), end: bufferedRanges.end(i) });
        }

        return BufferHelper.bufferedRangesInfo(bufferedRangeInfos, playheadPosition, maxHoleDuration);
      }
    } catch (error) {
      // this is to catch
      // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer':
      // This SourceBuffer has been removed from the parent media source
    }
    return {
      len: 0,
      start: playheadPosition,
      end: playheadPosition,
      nextStart: null
    };
  }

  // TODO: rename this function to explain what it really does (same for above ^)
  // TODO: why are these two functions needed, they wrap into each other, when is one needed or the other,
  //       why not simply put them inline?
  /**
   *
   * @param {Array<{start: number, end: number}>} ranges
   * @param {number} playheadPosition
   * @param {number} maxHoleDuration
   * @returns {len: number, start: number, end: number, nextStart: number}
   */
  static bufferedRangesInfo (ranges, playheadPosition, maxHoleDuration) {
    const mergedRanges = [];
    // sort on buffer.start/smaller end (IE does not always return sorted buffered range)
    ranges.sort(function (a, b) {
      let diff = a.start - b.start;
      if (diff !== 0) {
        return diff;
      } else {
        return b.end - a.end;
      }
    });
    // there might be some small holes between buffered time-ranges.
    // we consider that holes smaller than maxHoleDuration are irrelevant.
    // we  build a new ranges representation that bridges over these holes.
    for (let i = 0; i < ranges.length; i++) {
      const mergedRangesLen = mergedRanges.length;
      if (mergedRangesLen) {
        const mergedRangesEnd = mergedRanges[mergedRangesLen - 1].end;
        // if small hole (value between 0 or maxHoleDuration ) or overlapping (negative)
        if ((ranges[i].start - mergedRangesEnd) < maxHoleDuration) {
          // merge overlapping time ranges
          // update lastRange.end only if smaller than item.end
          // e.g.  [ 1, 15] with  [ 2,8] => [ 1,15] (no need to modify lastRange.end)
          // whereas [ 1, 8] with  [ 2,15] => [ 1,15] ( lastRange should switch from [1,8] to [1,15])
          if (ranges[i].end > mergedRangesEnd) {
            mergedRanges[mergedRangesLen - 1].end = ranges[i].end;
          }
          // else range end is within previous range end
        // hole is larger than maxHoleDuration
        } else {
          mergedRanges.push(ranges[i]);
        }
      } else {
        // first value
        mergedRanges.push(ranges[i]);
      }
    }

    // Here we determine the last range in which we find the playhead position and
    // output info about it
    let bufferInfoLen = 0;
    let bufferInfoStart = playheadPosition;
    let bufferInfoEnd = playheadPosition;
    let bufferInfoNextStart;
    // we iterate over all the ranges and
    for (let i = 0; i < mergedRanges.length; i++) {
      let start = mergedRanges[i].start;
      let end = mergedRanges[i].end;

      // playhead position is inside this time-range
      // (allowing gaps of size up to `maxHoleDuration` between playhead and range start)
      // store end of buffer position and buffer length
      if ((playheadPosition + maxHoleDuration) >= start && playheadPosition < end) {
        bufferInfoStart = start;
        bufferInfoEnd = end;
        bufferInfoLen = bufferInfoEnd - playheadPosition;
      // playhead position is further away from start of range than max buffer hole
      // we break the loop here and go with any stored values from previous iteration
      // and also store the current range start
      } else if ((playheadPosition + maxHoleDuration) < start) {
        bufferInfoNextStart = start;
        break;
      }
    }
    return {
      len: bufferInfoLen, // distance between position anbd range end
      start: bufferInfoStart, // range start
      end: bufferInfoEnd, // range end
      nextStart: bufferInfoNextStart // start of next range
    };
  }
}
