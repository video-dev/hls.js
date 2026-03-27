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
  let temporalMatch: string | null = null;
  const regex = /(?:^|&)t=([^&]*)/g;
  let match;
  while ((match = regex.exec(fragment)) !== null) {
    temporalMatch = match[1];
  }
  if (!temporalMatch) {
    return { temporalFragment: undefined };
  }
  // Remove 'npt:' prefix if present
  // #t=npt:10,20 -> 10,20
  const cleanValue = temporalMatch.startsWith('npt:')
    ? temporalMatch.substring(4)
    : temporalMatch;
  // Parse start and end times from the value (e.g., "10" or "10,20" or ",20")
  const parts = cleanValue.split(',');
  const temporalFragment: TemporalFragment = {};
  if (parts.length === 1) {
    // t=10 (start only)
    const startTime = parts[0].trim();
    if (startTime) {
      const startTimeValue = parseNptTime(startTime);
      if (startTimeValue === undefined) {
        return { temporalFragment: undefined };
      }
      if (startTimeValue >= 0) {
        temporalFragment.start = startTimeValue;
      }
    }
  } else if (parts.length === 2) {
    // t=10,20 or t=,20 or t=10,
    const startTime = parts[0].trim();
    const endTime = parts[1].trim();

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
  } else {
    return { temporalFragment: undefined };
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
 *   - Seconds: "10" or "10.5"
 *   - MM:SS: "02:30" or "02:30.5"
 *   - HH:MM:SS: "1:02:30" or "1:02:30.5"
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
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    // MM:SS format: "02:30" or "02:30.5"
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    if (
      isNaN(minutes) ||
      isNaN(seconds) ||
      minutes < 0 ||
      minutes >= 60 ||
      seconds < 0 ||
      seconds >= 60
    ) {
      return undefined;
    }
    return minutes * 60 + seconds;
  }
  if (parts.length === 3) {
    // HH:MM:SS format: "1:02:30" or "1:02:30.5"
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      isNaN(seconds) ||
      hours < 0 ||
      minutes < 0 ||
      seconds < 0 ||
      minutes >= 60 ||
      seconds >= 60
    ) {
      return undefined;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }
  return undefined;
}
