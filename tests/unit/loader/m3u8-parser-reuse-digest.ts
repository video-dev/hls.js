import { expect } from 'chai';
import {
  buildFixtureText,
  RELOAD_SEPARATOR,
} from './m3u8-parser-reuse-fixtures';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import {
  mergeDetails,
  updateFragPTSDTS,
} from '../../../src/utils/level-helper';
import { logger } from '../../../src/utils/logger';
import type { FixtureName } from './m3u8-parser-reuse-fixtures';
import type { LevelDetails } from '../../../src/loader/level-details';

// Master-equivalence check for the live reload path (#8001).
//
// Each case replays a chain of live playlist reloads the way the loader
// does -- parseLevelPlaylist with the previous details, reloaded(), then
// mergeDetails -- and summarizes the final LevelDetails into one string.
// The expected strings were RECORDED FROM MASTER at afe5b8bf1, by running
// the benchmark on the bench/8001 branch (benchmarks/playlist-reload.bench.ts
// and benchmarks/playlist-reload-adverse.bench.ts, which use this same
// digest and these same fixtures) against an unmodified master tree.
//
// That makes this the one test in the suite that would catch the reuse work
// drifting from what master produced. The differential property test in
// m3u8-parser-reuse-property.ts runs the new parser on both sides of its
// comparison, so it cannot see a change that is consistent across both.
//
// If a digest here changes, the parse now produces different values than
// master did for the same bytes. Do not re-record it. Work out which field
// moved (the digest is positional; the field order is the array below) and
// why, and either fix the parse or disclose the behaviour change.

const URL = 'https://example.com/live/v1/playlist.m3u8';
const URL_PREFIX = '#bperf:url ';
// Stand-in for Date.now() in playlistLoaded(); advanced by the reload cadence.
const CLOCK_START = 1787486400000;

interface Reload {
  text: string;
  url: string;
}

function splitReloads(fixture: string): Reload[] {
  return fixture.split(`\n${RELOAD_SEPARATOR}\n`).map((chunk) => {
    if (chunk.startsWith(URL_PREFIX)) {
      const newline = chunk.indexOf('\n');
      return {
        url: chunk.slice(URL_PREFIX.length, newline),
        text: chunk.slice(newline + 1),
      };
    }
    return { url: URL, text: chunk };
  });
}

function parse(reload: Reload, previous: LevelDetails | null): LevelDetails {
  return M3U8Parser.parseLevelPlaylist(
    reload.text,
    reload.url,
    0,
    PlaylistLevelType.MAIN,
    0,
    null,
    previous,
  );
}

// Parse the initial playlist once and mark the last few segments as loaded,
// the way a player at the live edge has, so reloads take the
// updateFragPTSDTS path rather than adjustSliding.
function setupWorkload(name: FixtureName, loadedCount: number) {
  const reloads = splitReloads(buildFixtureText(name));
  const initial = parse(reloads[0], null);
  if (initial.playlistParsingError) {
    throw initial.playlistParsingError;
  }
  const fragments = initial.fragments;
  for (let i = fragments.length - loadedCount; i < fragments.length; i++) {
    const frag = fragments[i];
    const start = frag.start;
    const end = start + frag.duration;
    updateFragPTSDTS(initial, frag, start, end, start, end, false, logger);
  }
  return { initial, reloads: reloads.slice(1) };
}

function reloadAll(name: FixtureName, cadenceMs: number): string {
  const { initial, reloads } = setupWorkload(name, 3);
  let previous = initial;
  for (let i = 0; i < reloads.length; i++) {
    const details = parse(reloads[i], previous);
    details.advancedDateTime = CLOCK_START + (i + 1) * cadenceMs;
    details.reloaded(previous);
    mergeDetails(previous, details, logger);
    if (details.playlistParsingError) {
      throw details.playlistParsingError;
    }
    previous = details;
  }
  return digest(previous);
}

// Summarize the final details so correctness covers sliding, PTS
// propagation, discontinuity and init segment bookkeeping, date ranges,
// parts and the hint, without depending on object identity. Verbatim from
// the benchmark, which is what recorded the expected values.
function digest(details: LevelDetails): string {
  const fragments = details.fragments;
  let startSum = 0;
  let durationSum = 0;
  let ccSum = 0;
  let pdtSum = 0;
  let tagCount = 0;
  let initSegments = 0;
  const initUrls = new Set<string>();
  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];
    startSum += frag.start;
    durationSum += frag.duration;
    ccSum += frag.cc;
    pdtSum += frag.programDateTime || 0;
    tagCount += frag.tagList.length;
    if (frag.initSegment) {
      initSegments++;
      initUrls.add(frag.initSegment.relurl || '');
    }
  }
  let partStartSum = 0;
  let partBytes = 0;
  const partList = details.partList || [];
  for (let i = 0; i < partList.length; i++) {
    partStartSum += partList[i].start;
    partBytes += partList[i].byteRangeEndOffset || 0;
  }
  let dateRangeStartSum = 0;
  const dateRangeIds = Object.keys(details.dateRanges);
  for (let i = 0; i < dateRangeIds.length; i++) {
    const dateRange = details.dateRanges[dateRangeIds[i]];
    if (dateRange) {
      dateRangeStartSum += dateRange.startTime;
    }
  }
  const hint = details.fragmentHint;
  return [
    fragments.length,
    details.startSN,
    details.endSN,
    details.startCC,
    details.endCC,
    startSum.toFixed(3),
    durationSum.toFixed(3),
    details.totalduration.toFixed(3),
    details.edge.toFixed(3),
    ccSum,
    pdtSum,
    tagCount,
    initSegments,
    initUrls.size,
    partList.length,
    partStartSum.toFixed(3),
    partBytes,
    hint
      ? `${hint.sn}@${hint.start.toFixed(3)}+${hint.duration.toFixed(3)}`
      : '-',
    dateRangeIds.length,
    dateRangeStartSum.toFixed(3),
    details.PTSKnown,
    details.alignedSliding,
    details.advanced,
    details.updated,
    details.misses,
    details.driftEnd.toFixed(3),
  ].join(';');
}

// Recorded from master at afe5b8bf1. See the note at the top of this file
// before changing any of these.
const MASTER_DIGESTS: {
  name: FixtureName;
  cadenceMs: number;
  digest: string;
}[] = [
  {
    // 30 minute DVR window of 6.006s segments, PDT on every segment, SCTE-35
    // dateranges, discontinuities and per-break init segments, advancing one
    // segment per reload.
    name: 'live-dvr',
    cadenceMs: 6006,
    digest:
      '300;12107;12406;242;248;287387.100;1801.800;1801.800;1861.860;73512;536268003761700;600;300;7;0;0.000;0;-;4;3675.672;true;true;true;true;0;1861.860',
  },
  {
    // 8 minute LL-HLS window with byterange parts, a hint fragment, preload
    // hint and rendition reports, advancing one part per reload.
    name: 'll-hls',
    cadenceMs: 1000,
    digest:
      '120;5193;5312;0;0;29520.000;480.000;480.000;488.000;0;214500889200000;240;120;1;12;5778.000;1310000;5313@488.000+0.000;0;0.000;true;true;true;true;0;488.000',
  },
  {
    // The packager re-stamps every PROGRAM-DATE-TIME by a few milliseconds
    // on every reload.
    name: 'live-dvr-pdt-jitter',
    cadenceMs: 6006,
    digest:
      '300;12107;12406;242;248;287387.100;1801.800;1801.800;1861.860;73512;536268003761696;600;300;7;0;0.000;0;-;4;3675.677;true;true;true;true;0;1861.860',
  },
  {
    // Every URI carries a signed token that rotates on every reload.
    name: 'live-dvr-token-rotate',
    cadenceMs: 6006,
    digest:
      '300;12107;12406;242;248;287387.100;1801.800;1801.800;1861.860;73512;536268003761700;600;300;7;0;0.000;0;-;4;3675.672;true;true;true;true;0;1861.860',
  },
  {
    // One mid-window date moves once and stays moved.
    name: 'live-dvr-pdt-shift',
    cadenceMs: 6006,
    digest:
      '300;12107;12406;242;248;287387.100;1801.800;1801.800;1861.860;73512;536268003761703;600;300;7;0;0.000;0;-;4;3675.672;true;true;true;true;0;1861.860',
  },
];

describe('M3U8Parser reload digests recorded from master', function () {
  MASTER_DIGESTS.forEach(({ name, cadenceMs, digest: expected }) => {
    it(`replays the ${name} reload chain to master's values`, function () {
      expect(reloadAll(name, cadenceMs)).to.equal(expected);
    });
  });
});
