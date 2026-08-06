import { expect } from 'chai';
import { Hls } from '../../../src/exports-named';
import { BufferHelper } from '../../../src/utils/buffer-helper';
import {
  calculateSkippedDuration,
  calculateTargetBackBufferPosition,
  fragmentIsSkipped,
  joinAcrossSkipRanges,
  joinedBufferInfo,
  normalizeSkipRanges,
  skipAwareBufferInfo,
  skippedFragmentRanges,
  skipRangeAt,
  skipRangeResumeTime,
  skipRangesAreEqual,
} from '../../../src/utils/buffer-skip-ranges';
import type { MediaFragment } from '../../../src/loader/fragment';
import type {
  Bufferable,
  BufferTimeRange,
} from '../../../src/utils/buffer-helper';

// A media element or SourceBuffer buffering `ranges`.
function mockBufferable(ranges: BufferTimeRange[]): Bufferable {
  const buffered: TimeRanges = {
    length: ranges.length,
    start: (i: number) => ranges[i].start,
    end: (i: number) => ranges[i].end,
  };
  return { buffered };
}

// Segments of `duration` seconds starting at `start`, mirroring the shape getNextFragment sees.
function mockFragments(
  start: number,
  duration: number,
  count: number,
): MediaFragment[] {
  return Array.from({ length: count }, (_, i) => {
    const fragStart = start + i * duration;
    const frag: MediaFragment = {
      sn: i,
      start: fragStart,
      duration,
      end: fragStart + duration,
    } as unknown as MediaFragment;
    return frag;
  });
}

describe('buffer-skip-ranges', function () {
  describe('normalizeSkipRanges', function () {
    it('returns an empty array for nullish or empty input', function () {
      expect(normalizeSkipRanges(null)).to.deep.equal([]);
      expect(normalizeSkipRanges(undefined)).to.deep.equal([]);
      expect(normalizeSkipRanges([])).to.deep.equal([]);
    });

    it('sorts ranges by start time', function () {
      expect(
        normalizeSkipRanges([
          { start: 100, end: 110 },
          { start: 10, end: 20 },
        ]),
      ).to.deep.equal([
        { start: 10, end: 20 },
        { start: 100, end: 110 },
      ]);
    });

    it('drops zero-width, inverted and non-finite ranges', function () {
      expect(
        normalizeSkipRanges([
          { start: 10, end: 10 },
          { start: 30, end: 20 },
          { start: NaN, end: 20 },
          // An open-ended range would otherwise reach `media.currentTime = Infinity`
          { start: 60, end: Infinity },
          { start: 70, end: NaN },
          { start: 40, end: 50 },
        ]),
      ).to.deep.equal([{ start: 40, end: 50 }]);
    });

    it('merges overlapping and abutting ranges', function () {
      expect(
        normalizeSkipRanges([
          { start: 10, end: 20 },
          { start: 15, end: 30 },
          { start: 30, end: 40 },
          { start: 60, end: 70 },
        ]),
      ).to.deep.equal([
        { start: 10, end: 40 },
        { start: 60, end: 70 },
      ]);
    });

    it('does not alias the caller-supplied objects', function () {
      const input = [{ start: 10, end: 20 }];
      const normalized = normalizeSkipRanges(input);
      normalized[0].end = 999;
      expect(input[0].end).to.equal(20);
    });
  });

  describe('skipRangeAt', function () {
    const ranges = [
      { start: 100, end: 110 },
      { start: 3560, end: 3600 },
    ];

    it('treats ranges as half-open so the resume position is not skipped', function () {
      expect(skipRangeAt(ranges, 3560)).to.equal(ranges[1]);
      expect(skipRangeAt(ranges, 3599.9)).to.equal(ranges[1]);
      expect(skipRangeAt(ranges, 3600)).to.equal(null);
    });

    it('returns null outside of any range', function () {
      expect(skipRangeAt(ranges, 50)).to.equal(null);
      expect(skipRangeAt(ranges, 200)).to.equal(null);
      expect(skipRangeAt(ranges, 4000)).to.equal(null);
    });

    it('matches a range the position is approaching when given a tolerance', function () {
      expect(skipRangeAt(ranges, 3559.95)).to.equal(null);
      expect(skipRangeAt(ranges, 3559.95, 0.1)).to.equal(ranges[1]);
    });
  });

  describe('skippedFragmentRanges', function () {
    // 6s segments from 3540: [3540,3546] [3546,3552] ... [3594,3600] [3600,3606]
    const fragments = mockFragments(3540, 6, 20);

    it('narrows a range to the fragment boundaries inside it', function () {
      // Range edges land mid-segment: [3556.5,3562.5] and [3598.5,3604.5] straddle them, so both
      // must stay loaded and the skipped span shrinks to what lies wholly between them.
      const misaligned = mockFragments(3556.5, 6, 12);
      expect(
        skippedFragmentRanges([{ start: 3560, end: 3600 }], misaligned),
      ).to.deep.equal([{ start: 3562.5, end: 3598.5 }]);
    });

    it('leaves a segment-aligned range unchanged', function () {
      expect(
        skippedFragmentRanges([{ start: 3558, end: 3600 }], fragments),
      ).to.deep.equal([{ start: 3558, end: 3600 }]);
    });

    it('drops a range shorter than the fragments it lands in', function () {
      expect(
        skippedFragmentRanges([{ start: 3550, end: 3552 }], fragments),
      ).to.deep.equal([]);
    });

    it('returns an empty list when there are no fragments', function () {
      expect(
        skippedFragmentRanges([{ start: 10, end: 20 }], undefined),
      ).to.deep.equal([]);
      expect(skippedFragmentRanges([{ start: 10, end: 20 }], [])).to.deep.equal(
        [],
      );
    });

    it('drops boundary fragments within the configured tolerance', function () {
      // The user-facing case: 6s segments, range 10-15 lands inside two of them. At the default
      // tolerance no whole segment is covered, so nothing is dropped...
      const segments = mockFragments(0, 6, 6);
      expect(
        skippedFragmentRanges([{ start: 10, end: 15 }], segments),
      ).to.deep.equal([]);
      // ...while a 4s tolerance lets [6,12] (4s outside) and [12,18] (3s outside) be dropped
      expect(
        skippedFragmentRanges([{ start: 10, end: 15 }], segments, 4),
      ).to.deep.equal([{ start: 6, end: 18 }]);
      // A fragment carrying no skipped media is never dropped, however large the tolerance
      expect(
        skippedFragmentRanges([{ start: 10, end: 15 }], segments, 100),
      ).to.deep.equal([{ start: 6, end: 18 }]);
    });

    it('absorbs millisecond gaps between adjacent fragment timings', function () {
      // hls.js rewrites fragment timings from demuxed timestamps, so one fragment's end and the
      // next one's start do not match exactly. A range declared from either value must still
      // select the same set of whole fragments.
      const jittery = [
        { start: 110.02, end: 120.02, duration: 10 },
        { start: 120.01, end: 130.01, duration: 10 },
        { start: 130.02, end: 140.02, duration: 10 },
        { start: 140.0, end: 150.0, duration: 10 },
      ] as unknown as MediaFragment[];
      expect(
        skippedFragmentRanges([{ start: 120.02, end: 150 }], jittery),
      ).to.deep.equal([{ start: 120.01, end: 150.0 }]);
      expect(
        skippedFragmentRanges([{ start: 120.01, end: 150 }], jittery),
      ).to.deep.equal([{ start: 120.01, end: 150.0 }]);
    });

    it('snaps each range independently', function () {
      expect(
        skippedFragmentRanges(
          [
            { start: 3549, end: 3567 },
            { start: 3579, end: 3597 },
          ],
          fragments,
        ),
      ).to.deep.equal([
        { start: 3552, end: 3564 },
        { start: 3582, end: 3594 },
      ]);
    });
  });

  describe('joinAcrossSkipRanges', function () {
    it('joins buffered ranges separated only by a skip range', function () {
      expect(
        joinAcrossSkipRanges(
          [
            { start: 3500, end: 3560 },
            { start: 3600, end: 3606 },
          ],
          [{ start: 3560, end: 3600 }],
        ),
      ).to.deep.equal([{ start: 3500, end: 3606 }]);
    });

    it('leaves genuine holes alone', function () {
      const buffered = [
        { start: 3500, end: 3560 },
        { start: 3620, end: 3626 },
      ];
      expect(
        joinAcrossSkipRanges(buffered, [{ start: 3560, end: 3600 }]),
      ).to.deep.equal(buffered);
    });

    it('tolerates buffered edges that fall slightly inside the range', function () {
      expect(
        joinAcrossSkipRanges(
          [
            { start: 3500, end: 3559.95 },
            { start: 3600.05, end: 3606 },
          ],
          [{ start: 3560, end: 3600 }],
          0.1,
        ),
      ).to.deep.equal([{ start: 3500, end: 3606 }]);
    });

    it('returns the input untouched when there is nothing to join', function () {
      const buffered = [{ start: 0, end: 30 }];
      expect(joinAcrossSkipRanges(buffered, [])).to.equal(buffered);
      expect(
        joinAcrossSkipRanges(buffered, [{ start: 3560, end: 3600 }]),
      ).to.equal(buffered);
    });

    it('does not mutate the input array or its ranges', function () {
      const buffered = [
        { start: 3500, end: 3560 },
        { start: 3600, end: 3606 },
      ];
      joinAcrossSkipRanges(buffered, [{ start: 3560, end: 3600 }]);
      expect(buffered).to.deep.equal([
        { start: 3500, end: 3560 },
        { start: 3600, end: 3606 },
      ]);
    });
  });

  describe('calculateSkippedDuration', function () {
    const ranges = [{ start: 3560, end: 3600 }];

    it('is zero when the window does not reach the range', function () {
      expect(calculateSkippedDuration(ranges, 3500, 3550)).to.equal(0);
      expect(calculateSkippedDuration(ranges, 3610, 3700)).to.equal(0);
      expect(calculateSkippedDuration([], 0, 1000)).to.equal(0);
    });

    it('counts the whole range when the window spans it', function () {
      expect(calculateSkippedDuration(ranges, 3535, 3606)).to.equal(40);
    });

    it('counts only the overlapping portion', function () {
      expect(calculateSkippedDuration(ranges, 3580, 3606)).to.equal(20);
      expect(calculateSkippedDuration(ranges, 3535, 3580)).to.equal(20);
    });

    it('sums across multiple ranges', function () {
      expect(
        calculateSkippedDuration(
          [
            { start: 100, end: 110 },
            { start: 200, end: 230 },
          ],
          0,
          1000,
        ),
      ).to.equal(40);
    });
  });

  describe('skipAwareBufferInfo', function () {
    const config = { maxBufferHole: 0.1, bufferSkipRangeTolerance: 0.1 };

    // The case the feature exists for: playhead 3535, ad tail buffered to 3560, resume media
    // buffered from 3600. There are 31s of playable media ahead, not 71s.
    it('reports playable seconds rather than end - pos', function () {
      const info = skipAwareBufferInfo(
        mockBufferable([
          { start: 3500, end: 3560 },
          { start: 3600, end: 3606 },
        ]),
        3535,
        0.1,
        [{ start: 3560, end: 3600 }],
        { ...Hls.DefaultConfig, ...config },
      );

      expect(info.end).to.equal(3606);
      expect(info.nextStart).to.equal(undefined);
      expect(info.end - 3535).to.equal(71);
      expect(info.len).to.equal(31);
    });

    it('keeps the skipped duration in len via joinedBufferInfo', function () {
      const info = joinedBufferInfo(
        mockBufferable([
          { start: 3500, end: 3560 },
          { start: 3600, end: 3606 },
        ]),
        3535,
        0.1,
        [{ start: 3560, end: 3600 }],
        { ...Hls.DefaultConfig, ...config },
      );

      expect(info.end).to.equal(3606);
      expect(info.len).to.equal(71);
    });

    it('still surfaces a genuine hole beyond the skip range', function () {
      const info = skipAwareBufferInfo(
        mockBufferable([
          { start: 3500, end: 3560 },
          { start: 3600, end: 3606 },
          { start: 3620, end: 3630 },
        ]),
        3535,
        0.1,
        [{ start: 3560, end: 3600 }],
        { ...Hls.DefaultConfig, ...config },
      );

      expect(info.end).to.equal(3606);
      expect(info.nextStart).to.equal(3620);
    });

    // A caller passing maxHoleDuration 0 still gets the configured tolerances applied to the join.
    it('joins using the configured tolerances when maxHoleDuration is 0', function () {
      const info = joinedBufferInfo(
        mockBufferable([
          { start: 3500, end: 3559.95 },
          { start: 3600.05, end: 3606 },
        ]),
        3535,
        0,
        [{ start: 3560, end: 3600 }],
        { ...Hls.DefaultConfig, ...config },
      );

      expect(info.end).to.equal(3606);
      expect(info.nextStart).to.equal(undefined);
    });

    // Callers do not branch on whether the application declared any ranges.
    it('matches BufferHelper.bufferInfo when there are no skip ranges', function () {
      const buffered = [
        { start: 3500, end: 3560 },
        { start: 3600, end: 3606 },
      ];
      expect(
        skipAwareBufferInfo(mockBufferable(buffered), 3535, 0.1, [], {
          ...Hls.DefaultConfig,
          ...config,
        }),
      ).to.deep.equal(
        BufferHelper.bufferInfo(mockBufferable(buffered), 3535, 0.1),
      );
    });

    it('returns an empty info for a null or unbuffered bufferable', function () {
      const empty = { len: 0, start: 3535, end: 3535, bufferedIndex: -1 };
      const skipRanges = [{ start: 3560, end: 3600 }];
      expect(
        skipAwareBufferInfo(null, 3535, 0.1, skipRanges, {
          ...Hls.DefaultConfig,
          ...config,
        }),
      ).to.deep.equal(empty);
      expect(
        skipAwareBufferInfo(mockBufferable([]), 3535, 0.1, skipRanges, {
          ...Hls.DefaultConfig,
          ...config,
        }),
      ).to.deep.equal(empty);
    });

    it('leaves len alone when pos is outside the buffer', function () {
      const info = skipAwareBufferInfo(
        mockBufferable([{ start: 3600, end: 3606 }]),
        3535,
        0.1,
        [{ start: 3560, end: 3600 }],
        { ...Hls.DefaultConfig, ...config },
      );

      expect(info.len).to.equal(0);
      expect(info.nextStart).to.equal(3600);
    });
  });

  describe('fragmentIsSkipped', function () {
    const ranges = [{ start: 3564, end: 3598.5 }];

    it('is true only for fragments wholly inside a range', function () {
      expect(fragmentIsSkipped(ranges, 3564, 3570)).to.equal(true);
      expect(fragmentIsSkipped(ranges, 3592.5, 3598.5)).to.equal(true);
    });

    it('is false for fragments straddling either edge', function () {
      expect(fragmentIsSkipped(ranges, 3558, 3564)).to.equal(false);
      expect(fragmentIsSkipped(ranges, 3598.5, 3604.5)).to.equal(false);
      expect(fragmentIsSkipped(ranges, 3560, 3566)).to.equal(false);
    });

    it('is false when there are no ranges', function () {
      expect(fragmentIsSkipped([], 3564, 3570)).to.equal(false);
    });

    it('admits fragments poking out up to the configured tolerance', function () {
      // [3560,3566] pokes 4s out at the start of [3564,3598.5]
      expect(fragmentIsSkipped(ranges, 3560, 3566, 4)).to.equal(true);
      expect(fragmentIsSkipped(ranges, 3560, 3566, 3.5)).to.equal(false);
      // ...but never a fragment carrying no skipped media at all
      expect(fragmentIsSkipped(ranges, 3558, 3564, 100)).to.equal(false);
      expect(fragmentIsSkipped(ranges, 3598.5, 3604.5, 100)).to.equal(false);
    });
  });

  describe('calculateTargetBackBufferPosition', function () {
    // 10s segments throughout, with positions on segment boundaries so that the alignment
    // step is a no-op and the retention arithmetic is what is under test
    const SEG = 10;

    it('is a plain subtraction when nothing is skipped', function () {
      expect(calculateTargetBackBufferPosition(100, SEG, 15)).to.equal(85);
      expect(
        calculateTargetBackBufferPosition(100, SEG, 15, [
          { start: 200, end: 260 },
        ]),
      ).to.equal(85);
    });

    it('steps over a range that would otherwise consume the whole back buffer', function () {
      // 15s of playable media before 180 is 180->180 plus 120->105, since 120-180 is skipped
      expect(
        calculateTargetBackBufferPosition(180, SEG, 15, [
          { start: 120, end: 180 },
        ]),
      ).to.equal(105);
    });

    it('accounts for a range only partly inside the window', function () {
      // 10s of playable media before 190: 190->180 covers it without reaching the range
      expect(
        calculateTargetBackBufferPosition(190, SEG, 10, [
          { start: 120, end: 180 },
        ]),
      ).to.equal(180);
      // 20s needs another 10s from before the range
      expect(
        calculateTargetBackBufferPosition(190, SEG, 20, [
          { start: 120, end: 180 },
        ]),
      ).to.equal(110);
    });

    it('steps over several ranges', function () {
      expect(
        calculateTargetBackBufferPosition(150, SEG, 40, [
          { start: 60, end: 90 },
          { start: 120, end: 150 },
        ]),
      ).to.equal(50);
    });

    it('retains exactly the requested seconds of playable media', function () {
      const ranges = [
        { start: 60, end: 90 },
        { start: 120, end: 150 },
      ];
      const target = calculateTargetBackBufferPosition(150, SEG, 25, ranges);
      expect(
        150 - target - calculateSkippedDuration(ranges, target, 150),
      ).to.equal(25);
    });

    it('flushes nothing when retention is disabled', function () {
      expect(calculateTargetBackBufferPosition(100, SEG, Infinity)).to.equal(
        -Infinity,
      );
      expect(calculateTargetBackBufferPosition(100, SEG, -1)).to.equal(
        -Infinity,
      );
      expect(calculateTargetBackBufferPosition(100, SEG, NaN)).to.equal(
        -Infinity,
      );
    });

    it('never retains less than one segment', function () {
      // backBufferLength 2 < targetDuration 10, so a whole segment is kept
      expect(calculateTargetBackBufferPosition(100, SEG, 2)).to.equal(90);
      expect(calculateTargetBackBufferPosition(100, SEG, 0)).to.equal(90);
    });

    it('aligns the playhead down to a segment boundary first', function () {
      // 106 aligns to 100, so the target is 100 - 15 rather than 106 - 15
      expect(calculateTargetBackBufferPosition(106, SEG, 15)).to.equal(85);
    });
  });

  describe('skipRangeResumeTime', function () {
    it('resumes at the declared end when it is buffered', function () {
      expect(
        skipRangeResumeTime(
          { start: 120, end: 180 },
          mockBufferable([
            { start: 110, end: 120 },
            { start: 170, end: 220 },
          ]),
        ),
      ).to.equal(180);
    });

    it('continues to the next buffered range when the tolerance carved a hole past the end', function () {
      expect(
        skipRangeResumeTime(
          { start: 125, end: 175 },
          mockBufferable([
            { start: 110, end: 120 },
            { start: 180, end: 220 },
          ]),
          5,
        ),
      ).to.equal(180);
    });

    it('does not resume at unrelated buffered media past the end', function () {
      // A stale forward buffer left by a backward seek: the media at the declared end has not
      // loaded yet, but will - resume there, not 25s further on.
      expect(
        skipRangeResumeTime(
          { start: 125, end: 175 },
          mockBufferable([{ start: 200, end: 220 }]),
        ),
      ).to.equal(175);
    });

    it('falls back to the declared end when nothing follows', function () {
      expect(
        skipRangeResumeTime(
          { start: 125, end: 175 },
          mockBufferable([{ start: 110, end: 120 }]),
        ),
      ).to.equal(175);
      expect(skipRangeResumeTime({ start: 125, end: 175 }, null)).to.equal(175);
    });
  });

  describe('skipRangesAreEqual', function () {
    it('compares ranges by value', function () {
      expect(
        skipRangesAreEqual([{ start: 1, end: 2 }], [{ start: 1, end: 2 }]),
      ).to.equal(true);
      expect(
        skipRangesAreEqual([{ start: 1, end: 2 }], [{ start: 1, end: 3 }]),
      ).to.equal(false);
      expect(skipRangesAreEqual([{ start: 1, end: 2 }], [])).to.equal(false);
      expect(skipRangesAreEqual([], [])).to.equal(true);
    });
  });
});
