import { logger } from './logger';

const enum CharCode {
  Plus = 43,
  Dash = 45,
  Colon = 58,
  T = 84,
  Z = 90,
  LowerT = 116,
  LowerZ = 122,
}

// `YYYY-MM-DDTHH:MM` judged by its separators; `Date.parse` validates the
// digits. Anything shorter or shaped differently (date-only values, RFC 2822
// strings) is passed through untouched.
function isIsoDateTime(value: string): boolean {
  const t = value.charCodeAt(10);
  return (
    value.length >= 16 &&
    (t === CharCode.T || t === CharCode.LowerT) &&
    value.charCodeAt(4) === CharCode.Dash &&
    value.charCodeAt(7) === CharCode.Dash &&
    value.charCodeAt(13) === CharCode.Colon
  );
}

function isSign(code: number): boolean {
  return code === CharCode.Plus || code === CharCode.Dash;
}

// A trailing `Z`, or a sign placed for `±HH:MM`, `±HHMM`, or `±HH`. With at
// least 16 characters the earliest position checked is index 10, past the
// date separators.
function hasTimeZone(value: string): boolean {
  const last = value.charCodeAt(value.length - 1);
  return (
    last === CharCode.Z ||
    last === CharCode.LowerZ ||
    isSign(value.charCodeAt(value.length - 6)) ||
    isSign(value.charCodeAt(value.length - 5)) ||
    isSign(value.charCodeAt(value.length - 3))
  );
}

let warnedZoneless = false;

/**
 * Parse an HLS playlist date/time value (`EXT-X-PROGRAM-DATE-TIME`, and the
 * `START-DATE`/`END-DATE` attributes of `EXT-X-DATERANGE`) into a timestamp
 * in milliseconds since the epoch. Returns NaN for values that cannot be
 * parsed. Tolerates non-string values at runtime, matching `Date.parse`
 * coercion.
 *
 * ISO 8601 date-times without a time zone represent local time, and
 * `Date.parse` follows that. HLS supersedes it: clients SHOULD treat a
 * date-time without a time zone as UTC (rfc8216bis-17 Section 4.4.4.6),
 * matching Apple's clients. Playlists SHOULD indicate a time zone, so the
 * first zone-less value parsed logs a warning.
 */
export function parseDateTime(value: string): number {
  if (
    typeof value === 'string' &&
    isIsoDateTime(value) &&
    !hasTimeZone(value)
  ) {
    if (!warnedZoneless) {
      warnedZoneless = true;
      logger.warn(
        `Date/time "${value}" has no time zone. Parsing as UTC (playlists SHOULD indicate a time zone).`,
      );
    }
    return Date.parse(value + 'Z');
  }
  return Date.parse(value);
}
