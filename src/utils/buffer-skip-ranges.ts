import { BufferHelper } from './buffer-helper';
import type { HlsConfig } from '../hls';
import type { Bufferable, BufferInfo, BufferTimeRange } from './buffer-helper';
import type { MediaFragment } from '../loader/fragment';

const BOUNDARY_TOLERANCE = 0.001;
const FRAGMENT_BOUNDARY_TOLERANCE = 0.1;

export function skipRangeTolerance(config?: HlsConfig): number {
  return Math.max(
    config?.bufferSkipRangeTolerance ?? 0,
    FRAGMENT_BOUNDARY_TOLERANCE,
  );
}

export function normalizeSkipRanges(
  ranges: BufferTimeRange[] | null | undefined,
): BufferTimeRange[] {
  if (!ranges?.length) {
    return [];
  }
  const valid = ranges
    .filter(
      (range) =>
        !!range &&
        Number.isFinite(range.start) &&
        Number.isFinite(range.end) &&
        range.end > range.start &&
        range.end > 0,
    )
    .map((range) => ({ start: Math.max(0, range.start), end: range.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: BufferTimeRange[] = [];
  for (let i = 0; i < valid.length; i++) {
    const range = valid[i];
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push(range);
    }
  }
  return merged;
}

export function skipRangeAt(
  ranges: BufferTimeRange[],
  pos: number,
  tolerance: number = 0,
): BufferTimeRange | null {
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range.start - tolerance > pos) {
      break;
    }
    if (pos < range.end + tolerance) {
      return range;
    }
  }
  return null;
}

export function skippedFragmentRanges(
  ranges: BufferTimeRange[],
  fragments: MediaFragment[] | undefined,
  tolerance: number = FRAGMENT_BOUNDARY_TOLERANCE,
): BufferTimeRange[] {
  if (!ranges.length || !fragments?.length) {
    return [];
  }
  const snapped: BufferTimeRange[] = [];
  let scanFrom = 0;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    while (
      scanFrom < fragments.length &&
      fragments[scanFrom].end <= range.start - tolerance
    ) {
      scanFrom++;
    }
    let first: MediaFragment | undefined;
    let last: MediaFragment | undefined;
    for (let j = scanFrom; j < fragments.length; j++) {
      const frag = fragments[j];
      if (frag.start >= range.end) {
        // Fragments are ordered; nothing further can overlap the range
        break;
      }
      if (fragmentIsSkipped([range], frag.start, frag.end, tolerance)) {
        first ||= frag;
        last = frag;
      } else if (last) {
        break;
      }
    }
    if (first && last && last.end - first.start > BOUNDARY_TOLERANCE) {
      snapped.push({ start: first.start, end: last.end });
    }
  }
  return snapped;
}

/**
 * Where the playhead should land when it is moved over `skipRange`
 */
export function skipRangeResumeTime(
  skipRange: BufferTimeRange,
  bufferable: Bufferable | null,
  tolerance: number = FRAGMENT_BOUNDARY_TOLERANCE,
): number {
  const buffered = BufferHelper.bufferedRanges(bufferable);
  const declaredEnd = skipRange.end;
  let nextStart: number | undefined;
  for (let i = 0; i < buffered.length; i++) {
    const range = buffered[i];
    if (declaredEnd >= range.start && declaredEnd < range.end) {
      return declaredEnd;
    }
    if (range.start > declaredEnd && nextStart === undefined) {
      nextStart = range.start;
    }
  }
  return nextStart !== undefined && nextStart - declaredEnd <= tolerance
    ? nextStart
    : declaredEnd;
}

/**
 * Join buffered ranges that are separated only by a declared skip range, so that forward buffer
 * measurement continues across the intentional hole instead of terminating at it.
 *
 * A hole is only joined when it is contained in a single skip range (within `tolerance`). Real
 * holes — a failed append, an EXT-X-GAP, a range the player has yet to reach — are left alone so
 * the stall and gap logic still sees them.
 */
export function joinAcrossSkipRanges(
  buffered: BufferTimeRange[],
  ranges: BufferTimeRange[],
  tolerance: number = 0,
): BufferTimeRange[] {
  if (!ranges.length || buffered.length < 2) {
    return buffered;
  }
  const sorted = buffered
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const joined: BufferTimeRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const range = sorted[i];
    const last = joined[joined.length - 1];
    if (holeIsSkipped(ranges, last.end, range.start, tolerance)) {
      last.end = Math.max(last.end, range.end);
    } else {
      joined.push({ ...range });
    }
  }
  return joined;
}

export function calculateSkippedDuration(
  ranges: BufferTimeRange[],
  from: number,
  to: number,
): number {
  if (!ranges.length || !(to > from)) {
    return 0;
  }
  let skipped = 0;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range.start >= to) {
      break;
    }
    const overlap = Math.min(range.end, to) - Math.max(range.start, from);
    if (overlap > 0) {
      skipped += overlap;
    }
  }
  return skipped;
}

export function joinedBufferInfo(
  bufferable: Bufferable | null,
  pos: number,
  maxHoleDuration: number,
  ranges: BufferTimeRange[],
  config: HlsConfig,
): BufferInfo {
  const buffered = BufferHelper.bufferedRanges(bufferable);
  if (!buffered.length) {
    return { len: 0, start: pos, end: pos, bufferedIndex: -1 };
  }
  const tolerance = Math.max(maxHoleDuration, skipRangeTolerance(config));
  return BufferHelper.bufferedInfo(
    joinAcrossSkipRanges(buffered, ranges, tolerance),
    pos,
    maxHoleDuration,
  );
}

export function skipAwareBufferInfo(
  bufferable: Bufferable | null,
  pos: number,
  maxHoleDuration: number,
  ranges: BufferTimeRange[],
  config: HlsConfig,
): BufferInfo {
  const bufferInfo = joinedBufferInfo(
    bufferable,
    pos,
    maxHoleDuration,
    ranges,
    config,
  );
  if (bufferInfo.len > 0) {
    bufferInfo.len -= calculateSkippedDuration(ranges, pos, bufferInfo.end);
  }
  return bufferInfo;
}

export function calculateTargetBackBufferPosition(
  currentTime: number,
  targetDuration: number,
  backBufferLength: number,
  skipRanges?: BufferTimeRange[],
): number {
  if (!Number.isFinite(backBufferLength) || backBufferLength < 0) {
    return -Infinity;
  }

  return positionPlayableSecondsBefore(
    skipRanges || [],
    Math.floor(currentTime / targetDuration) * targetDuration,
    Math.max(backBufferLength, targetDuration),
  );
}

function positionPlayableSecondsBefore(
  ranges: BufferTimeRange[],
  pos: number,
  playableSeconds: number,
): number {
  let remaining = playableSeconds;
  let cursor = pos;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    if (range.start >= cursor) {
      continue;
    }
    if (range.end >= cursor) {
      cursor = range.start;
      continue;
    }
    const playable = cursor - range.end;
    if (playable >= remaining) {
      return cursor - remaining;
    }
    remaining -= playable;
    cursor = range.start;
  }
  return cursor - remaining;
}

/**
 * True when a fragment lies within a skip range, give or take `tolerance`, and can therefore be
 * left unloaded.
 */
export function fragmentIsSkipped(
  ranges: BufferTimeRange[],
  start: number,
  end: number,
  tol: number = FRAGMENT_BOUNDARY_TOLERANCE,
): boolean {
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range.start - tol > start) {
      break;
    }
    if (
      end > range.start &&
      start < range.end &&
      start >= range.start - tol &&
      end <= range.end + tol
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True when two skip range lists describe the same set of ranges.
 */
export function skipRangesAreEqual(
  a: BufferTimeRange[],
  b: BufferTimeRange[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every(
    (range, i) => range.start === b[i].start && range.end === b[i].end,
  );
}

export function skipRangesToString(ranges: BufferTimeRange[]): string {
  return ranges
    .map((range) => `[${range.start.toFixed(3)}-${range.end.toFixed(3)}]`)
    .join('');
}

function holeIsSkipped(
  ranges: BufferTimeRange[],
  holeStart: number,
  holeEnd: number,
  tolerance: number,
): boolean {
  if (holeEnd <= holeStart) {
    return false;
  }
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range.start - tolerance > holeStart) {
      break;
    }
    if (holeEnd <= range.end + tolerance) {
      return true;
    }
  }
  return false;
}
