// Live playlist reload fixtures for the digest test in
// m3u8-parser-reuse-digest.ts.
//
// Everything here is derived from the sequence number and the reload index,
// so the output is identical on every host and in every browser. This is a
// port of benchmarks/fixtures/generate-playlist-reloads.mjs from the bench
// branch (bench/8001), which writes the same bytes to disk for bperf to
// serve, and `buildFixtureText` returns those files verbatim so the two can
// be diffed directly. Keep them in step: the digests the test checks were
// recorded by running master over these exact bytes.
//
// A fixture is one initial playlist followed by consecutive reloads,
// separated by a line containing only `#bperf:reload`.

export const RELOAD_SEPARATOR = '#bperf:reload';

// 2026-08-23T12:00:00.000Z
const EPOCH_MS = Date.UTC(2026, 7, 23, 12, 0, 0, 0);

function pdt(ms: number): string {
  return new Date(ms).toISOString();
}

// A fixed 68-byte splice_insert so the SCTE35 attributes are a realistic
// length for AttrList to scan. The break number is mixed into the event id.
function scte35(breakIndex: number, isOut: boolean): string {
  const eventId = (0x4800008f + breakIndex).toString(16).padStart(8, '0');
  const command = isOut ? '80' : '00';
  return (
    '0xFC302500000000000000FFF01405' +
    eventId +
    '7FEFFE' +
    command +
    '00000000000000000000' +
    'E4612424'
  );
}

interface DvrVariant {
  pdtOffsetMs: (sn: number) => number;
  uriSuffix: (sn: number) => string;
}

/**
 * DVR-style live playlist: 6.006s fMP4 segments, PDT on every segment,
 * a 60s ad break every 100 segments signalled by SCTE-35 dateranges with
 * a discontinuity (and a fresh init segment) at both ends.
 */
function dvrPlaylist(
  startSN: number,
  windowSize: number,
  variant?: DvrVariant,
): string {
  const SEGMENT_MS = 6006;
  const BREAK_EVERY = 100;
  const BREAK_LENGTH = 10;
  const cc = (sn: number) =>
    2 * Math.floor(sn / BREAK_EVERY) +
    (sn % BREAK_EVERY >= BREAK_LENGTH ? 1 : 0);
  const endSN = startSN + windowSize - 1;
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:6',
    '#EXT-X-TARGETDURATION:7',
    `#EXT-X-MEDIA-SEQUENCE:${startSN}`,
    `#EXT-X-DISCONTINUITY-SEQUENCE:${cc(startSN)}`,
    '#EXT-X-INDEPENDENT-SEGMENTS',
    `#EXT-X-MAP:URI="init_${cc(startSN)}.mp4"`,
  ];
  for (let sn = startSN; sn <= endSN; sn++) {
    const inBreak = sn % BREAK_EVERY;
    const breakIndex = Math.floor(sn / BREAK_EVERY);
    if (inBreak === 0 || inBreak === BREAK_LENGTH) {
      const isOut = inBreak === 0;
      const startDate = pdt(EPOCH_MS + (sn - inBreak) * SEGMENT_MS);
      lines.push(
        isOut
          ? `#EXT-X-DATERANGE:ID="splice-${breakIndex}",START-DATE="${startDate}",PLANNED-DURATION=60.060,SCTE35-OUT=${scte35(breakIndex, true)}`
          : `#EXT-X-DATERANGE:ID="splice-${breakIndex}",START-DATE="${startDate}",DURATION=60.060,SCTE35-IN=${scte35(breakIndex, false)}`,
      );
      if (sn > startSN) {
        lines.push('#EXT-X-DISCONTINUITY');
        lines.push(`#EXT-X-MAP:URI="init_${cc(sn)}.mp4"`);
      }
    }
    const offsetMs = variant ? variant.pdtOffsetMs(sn) : 0;
    lines.push(
      `#EXT-X-PROGRAM-DATE-TIME:${pdt(EPOCH_MS + sn * SEGMENT_MS + offsetMs)}`,
    );
    lines.push('#EXTINF:6.006,');
    lines.push(`seg_${sn}.m4s${variant ? variant.uriSuffix(sn) : ''}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * LL-HLS playlist: 4s fMP4 segments split into four 1s byterange parts, PDT
 * on every segment, parts advertised for the last three complete segments
 * plus the in-progress one. `reload` counts published parts since the
 * initial state: every fourth reload completes a segment.
 */
function llhlsPlaylist(
  baseSN: number,
  windowSize: number,
  reload: number,
): { text: string; url: string } {
  const SEGMENT_MS = 4000;
  const PARTS = 4;
  const lastSN = baseSN + Math.floor(reload / PARTS);
  const hintSN = lastSN + 1;
  const hintParts = reload % PARTS;
  const startSN = lastSN - windowSize + 1;
  const partSize = (sn: number, index: number) =>
    40000 + 1000 * ((sn + index) % 7);
  const partLines = (sn: number, count: number) => {
    const out: string[] = [];
    let offset = 0;
    for (let i = 0; i < count; i++) {
      const size = partSize(sn, i);
      out.push(
        `#EXT-X-PART:DURATION=1.00000${i === 0 ? ',INDEPENDENT=YES' : ''},URI="seg_${sn}.m4s",BYTERANGE="${size}@${offset}"`,
      );
      offset += size;
    }
    return out;
  };
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:9',
    '#EXT-X-TARGETDURATION:4',
    '#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=3.0,CAN-SKIP-UNTIL=24.0',
    '#EXT-X-PART-INF:PART-TARGET=1.0',
    `#EXT-X-MEDIA-SEQUENCE:${startSN}`,
    '#EXT-X-INDEPENDENT-SEGMENTS',
    '#EXT-X-MAP:URI="init.mp4"',
  ];
  for (let sn = startSN; sn <= lastSN; sn++) {
    lines.push(`#EXT-X-PROGRAM-DATE-TIME:${pdt(EPOCH_MS + sn * SEGMENT_MS)}`);
    if (sn > lastSN - 3) {
      lines.push(...partLines(sn, PARTS));
    }
    lines.push('#EXTINF:4.00000,');
    lines.push(`seg_${sn}.m4s`);
  }
  lines.push(`#EXT-X-PROGRAM-DATE-TIME:${pdt(EPOCH_MS + hintSN * SEGMENT_MS)}`);
  lines.push(...partLines(hintSN, hintParts));
  let hintOffset = 0;
  for (let i = 0; i < hintParts; i++) {
    hintOffset += partSize(hintSN, i);
  }
  lines.push(
    `#EXT-X-PRELOAD-HINT:TYPE=PART,URI="seg_${hintSN}.m4s",BYTERANGE-START=${hintOffset}`,
  );
  const reportSN = hintParts > 0 ? hintSN : lastSN;
  const reportPart = hintParts > 0 ? hintParts - 1 : PARTS - 1;
  lines.push(
    `#EXT-X-RENDITION-REPORT:URI="../v0/playlist.m3u8",LAST-MSN=${reportSN},LAST-PART=${reportPart}`,
  );
  lines.push(
    `#EXT-X-RENDITION-REPORT:URI="../v2/playlist.m3u8",LAST-MSN=${reportSN},LAST-PART=${reportPart}`,
  );
  return {
    text: lines.join('\n') + '\n',
    // hls.js reloads LL-HLS playlists with delivery directives for the part
    // it is waiting on, which is what the parser receives as the base URL.
    url: `https://example.com/live/v1/playlist.m3u8?_HLS_msn=${hintSN}&_HLS_part=${hintParts}`,
  };
}

// 30 minute DVR window, one segment appended per reload. Start at a
// sequence number where the head crosses a discontinuity on the third
// reload and a new ad break enters at the tail on the fourth.
const DVR_START = 12097;
const DVR_WINDOW = 300;
const DVR_RELOADS = 10;

// Spec-legal deviations from the clean DVR stream, one fixture each. Same
// window and reload count as live-dvr so the numbers compare directly.
//
// - pdt-jitter: the packager re-stamps every segment's PROGRAM-DATE-TIME on
//   every reload, drifting within +/-5 ms (rfc8216bis 6.2.1 allows sub-second
//   differences between reloads).
// - token-rotate: every segment URI carries a signed token that changes on
//   every reload (the query string is the only difference).
// - pdt-shift: one mid-window segment's PROGRAM-DATE-TIME moves by 3 ms from
//   the fifth reload onward and stays there.
const adverse: Record<string, (reload: number) => DvrVariant> = {
  'pdt-jitter': (reload) => ({
    pdtOffsetMs: (sn) => ((sn * 31 + reload * 17) % 11) - 5,
    uriSuffix: () => '',
  }),
  'token-rotate': (reload) => ({
    pdtOffsetMs: () => 0,
    uriSuffix: () => `?token=t${(reload * 7919) % 10007}`,
  }),
  'pdt-shift': (reload) => ({
    pdtOffsetMs: (sn) => (reload >= 5 && sn === DVR_START + 150 ? 3 : 0),
    uriSuffix: () => '',
  }),
};

// 8 minute LL-HLS window, one part published per reload across two full
// segment completions.
const LL_BASE = 5310;
const LL_WINDOW = 120;
const LL_RELOADS = 8;

export type FixtureName =
  | 'live-dvr'
  | 'live-dvr-pdt-jitter'
  | 'live-dvr-token-rotate'
  | 'live-dvr-pdt-shift'
  | 'll-hls';

export const FIXTURE_NAMES: FixtureName[] = [
  'live-dvr',
  'live-dvr-pdt-jitter',
  'live-dvr-token-rotate',
  'live-dvr-pdt-shift',
  'll-hls',
];

/**
 * The exact bytes of one fixture file, so this and the generator on the
 * bench branch can be compared directly. Callers split it back into reloads
 * with `splitReloads`.
 */
export function buildFixtureText(name: FixtureName): string {
  if (name === 'll-hls') {
    const ll: string[] = [];
    for (let r = 0; r <= LL_RELOADS; r++) {
      const { text, url } = llhlsPlaylist(LL_BASE, LL_WINDOW, r);
      ll.push(`#bperf:url ${url}\n${text}`);
    }
    return ll.join(`${RELOAD_SEPARATOR}\n`);
  }
  const variantFor =
    name === 'live-dvr' ? null : adverse[name.slice('live-dvr-'.length)];
  const reloads: string[] = [];
  for (let r = 0; r <= DVR_RELOADS; r++) {
    reloads.push(
      dvrPlaylist(
        DVR_START + r,
        DVR_WINDOW,
        variantFor ? variantFor(r) : undefined,
      ),
    );
  }
  return reloads.join(`${RELOAD_SEPARATOR}\n`);
}
