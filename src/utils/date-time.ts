import { logger } from './logger';

// 'Z' or a UTC offset (+05:00, -0500, +05) at the end of a date-time string
const ZONE_DESIGNATOR = /(?:[Zz]|[+-]\d{2}(?::?\d{2})?)$/;

let warnedZoneless = false;

// ISO 8601 date-times without a time zone represent local time, and
// `Date.parse` follows that. HLS supersedes it: clients SHOULD treat a
// date-time without a time zone as UTC (rfc8216bis-17 Section 4.4.4.6),
// matching Apple's clients. Playlists SHOULD indicate a time zone, so the
// first zone-less value parsed logs a warning.
export function parseDateTime(value: string): number {
  if (/[Tt]/.test(value) && !ZONE_DESIGNATOR.test(value)) {
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
