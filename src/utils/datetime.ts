const enum ISOOff {
  YEAR_END = 4,
  MONTH = 5,
  DAY = 8,
  HOUR = 11,
  MINUTE = 14,
  SECOND = 17,
  SUFFIX = 19,
}

// Character codes for trie-based tag dispatch. const enum compiles to inline numbers.
const enum Ch {
  PLUS = 43,
  DASH = 45,
  DOT = 46,
  ZERO = 48,
  NINE = 57,
  COLON = 58,
}

// Branchless ms scaling: digitCount 0→0, 1→100, 2→10, 3→1.
const msScale = [0, 100, 10, 1];

export function parseIntAt(s: string, start: number, end: number): number {
  let result = 0;
  let parsed = false;
  for (let i = start; i < end; i++) {
    const c = s.charCodeAt(i);
    if (c < Ch.ZERO || c > Ch.NINE) {
      break;
    }
    result = result * 10 + (c - Ch.ZERO);
    parsed = true;
  }
  return parsed ? result : NaN;
}

// Parses ISO 8601 date with timezone offset.
// Handles Z (UTC), ±HH:MM, ±HHMM, and no-timezone (treated as UTC per HLS spec).
export function parseISO8601(s: string): number {
  if (!s) {
    return NaN;
  }
  // Compute milliseconds and find timezone position
  const len = s.length;
  let ms = 0;
  let tzPos = ISOOff.SUFFIX;
  if (tzPos < len && s.charCodeAt(tzPos) === Ch.DOT) {
    tzPos++;
    let digitCount = 0;
    while (tzPos < len) {
      const c = s.charCodeAt(tzPos);
      if (c < Ch.ZERO || c > Ch.NINE) {
        break;
      }
      if (digitCount < 3) {
        ms = ms * 10 + (c - Ch.ZERO);
        digitCount++;
      }
      tzPos++;
    }
    ms *= msScale[digitCount];
  }

  const utcMs = Date.UTC(
    parseIntAt(s, 0, ISOOff.YEAR_END),
    parseIntAt(s, ISOOff.MONTH, ISOOff.MONTH + 2) - 1,
    parseIntAt(s, ISOOff.DAY, ISOOff.DAY + 2),
    parseIntAt(s, ISOOff.HOUR, ISOOff.HOUR + 2),
    parseIntAt(s, ISOOff.MINUTE, ISOOff.MINUTE + 2),
    parseIntAt(s, ISOOff.SECOND, ISOOff.SUFFIX),
    ms,
  );

  const tzChar = s.charCodeAt(tzPos) | 0; // Or with 0 so there are only 3 integer jump options
  switch (tzChar) {
    case Ch.PLUS:
    case Ch.DASH: {
      const tzHoursEnd = tzPos + 3;
      const tzHours = parseIntAt(s, tzPos + 1, tzHoursEnd);
      const colonSkip = (s.charCodeAt(tzHoursEnd) | 0) === Ch.COLON;
      const minStart = tzHoursEnd + +colonSkip;
      const tzMinutes = parseIntAt(s, minStart, minStart + 2);
      const offsetMs = (tzHours * 60 + tzMinutes) * 60000;
      // Ch.PLUS(43) => 1, Ch.DASH(45) => -1: subtract positive offset, add negative offset
      return utcMs - (Ch.PLUS + 1 - tzChar) * offsetMs;
    }
    default:
      return utcMs;
  }
}
