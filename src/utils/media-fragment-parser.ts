export interface TemporalFragment {
  start?: number;
  end?: number;
}

export interface MediaFragmentParseResult {
  temporalFragment?: TemporalFragment;
}

/**
 * Parse Media Fragment URI (temporal dimension only)
 * Supports W3C Media Fragments URI spec: https://www.w3.org/TR/media-frags/
 *
 * Examples:
 *   #t=10,20       -> start: 10, end: 20
 *   #t=npt:10,20   -> start: 10, end: 20
 *   #t=0:02:00,210 -> start: 120, end: 210
 *   #t=10          -> start: 10
 *   #t=,20         -> end: 20
 */
export function parseMediaFragment(
  sourceUrl: string,
): MediaFragmentParseResult {
  const hashIndex = sourceUrl.indexOf('#');
  if (hashIndex === -1) {
    return { temporalFragment: undefined };
  }
  const fragment = sourceUrl.substring(hashIndex + 1);
  // Parse temporal dimension: t=start,end or t=npt:start,end
  // Matches: t=10 or t=10,20 or t=npt:10,20 or t=,20
  const temporalMatch = fragment.match(
    /(?:^|&)t=(?:npt:)?([^,&]+)?(?:,([^&]+))?(?:&|$)/,
  );
  if (!temporalMatch) {
    return { temporalFragment: undefined };
  }
  const temporalFragment: TemporalFragment = {};
  const startTime = temporalMatch[1]?.trim();
  const endTime = temporalMatch[2]?.trim();
  if (startTime) {
    const startTimeValue = parseNptTime(startTime);
    if (startTimeValue === undefined) {
      return { temporalFragment: undefined };
    }
    if (startTimeValue >= 0) {
      temporalFragment.start = startTimeValue;
    }
  }
  if (endTime) {
    const endTimeValue = parseNptTime(endTime);
    if (endTimeValue === undefined) {
      return { temporalFragment: undefined };
    }
    if (endTimeValue >= 0) {
      temporalFragment.end = endTimeValue;
    }
  }
  if (
    temporalFragment.start !== undefined &&
    temporalFragment.end !== undefined &&
    temporalFragment.start >= temporalFragment.end
  ) {
    return { temporalFragment: undefined };
  }
  if (temporalFragment.start === undefined && temporalFragment.end === 0) {
    return { temporalFragment: undefined };
  }
  if (
    temporalFragment.start === undefined &&
    temporalFragment.end === undefined
  ) {
    return { temporalFragment: undefined };
  }
  return { temporalFragment };
}

/**
 * Parse NPT (Normal Play Time) format
 * Supports:
 *   - npt-sec: "10" or "10.5"
 *   - npt-mmss: "02:30" or "02:30.5"
 *   - npt-hhmmss: "1:02:30" or "1:02:30.5"
 */
function parseNptTime(timeStr: string): number | undefined {
  timeStr = timeStr.trim();
  if (!timeStr) {
    return undefined;
  }
  // Handle npt-sec format: "10" or "10.5"
  if (/^\d+(\.\d+)?$/.test(timeStr)) {
    return parseFloat(timeStr);
  }
  // Handle npt-hhmmss format: "1:02:30.5"
  const hhmmss = timeStr.match(/^(\d+):(\d{2}):(\d{2})(\.\d+)?$/);
  if (hhmmss) {
    const hours = parseInt(hhmmss[1], 10);
    const minutes = parseInt(hhmmss[2], 10);
    const seconds = parseFloat(hhmmss[3] + (hhmmss[4] || ''));
    if (minutes >= 60 || seconds >= 60) {
      return undefined;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }
  // Handle npt-mmss format: "02:30.5"
  const mmss = timeStr.match(/^(\d{2}):(\d{2})(\.\d+)?$/);
  if (mmss) {
    const minutes = parseInt(mmss[1], 10);
    const seconds = parseFloat(mmss[2] + (mmss[3] || ''));
    if (minutes >= 60 || seconds >= 60) {
      return undefined;
    }
    return minutes * 60 + seconds;
  }
  return undefined;
}
