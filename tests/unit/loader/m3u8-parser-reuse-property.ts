import { expect } from 'chai';
import { ElementaryStreamTypes } from '../../../src/loader/fragment';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import {
  mergeDetails,
  updateFragPTSDTS,
} from '../../../src/utils/level-helper';
import { logger } from '../../../src/utils/logger';
import type { Fragment } from '../../../src/loader/fragment';
import type { LevelDetails } from '../../../src/loader/level-details';

// Differential property test for fragment reuse on live reloads (#8001).
//
// For a random live stream and reload sequence, parsing each reload through
// parseLevelPlaylist with the previous details and merging must
// produce the same values as parsing it fresh through the public static and
// merging, after the same simulated player activity on both. A reload the
// loader would drop must leave the previous graph byte-identical once
// reverted. Everything the generator varies is listed in `World`.

const SEEDS = 160;
const RELOADS = 7;
const URL = 'https://example.com/live/v1/playlist.m3u8';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T>(rng: Rng, items: T[]): T =>
  items[Math.floor(rng() * items.length)];
const chance = (rng: Rng, p: number) => rng() < p;

interface World {
  count: number;
  duration: number;
  pdt: 'all' | 'none' | 'first';
  key: 'none' | 'aes' | 'sample-aes';
  map: 'none' | 'header' | 'per-break';
  llhls: boolean;
  canSkip: boolean;
  discos: Set<number>;
  dateRanges: Map<number, string>;
  gaps: Set<number>;
  bitrates: Map<number, number>;
  custom: Set<number>;
  titles: Map<number, string>;
  // Reload index at which each variation starts (or -1 for never).
  tokenRotateAt: number;
  keyRotateAt: number;
  jitterAt: number;
  titleChangeAt: number;
  titleChangeSn: number;
  dateRangeChangeAt: number;
  discoRemoveAt: number;
  discoInsertAt: number;
  discoInsertSn: number;
  renameAt: number;
  renameSn: number;
  deltaAt: number;
  parseErrorAt: number;
  directives: boolean;
  bareInf: boolean;
}

function makeWorld(rng: Rng): World {
  const count = 8 + Math.floor(rng() * 10);
  const total = count + RELOADS + 4;
  const discos = new Set<number>();
  const dateRanges = new Map<number, string>();
  const gaps = new Set<number>();
  const bitrates = new Map<number, number>();
  const custom = new Set<number>();
  const titles = new Map<number, string>();
  for (let sn = 1; sn < total; sn++) {
    if (chance(rng, 0.12)) discos.add(sn);
    if (chance(rng, 0.1)) {
      const id = chance(rng, 0.5) ? `ad-${sn}` : 'ad-shared';
      dateRanges.set(
        sn,
        `ID="${id}",START-DATE="2023-11-14T22:${String(10 + (sn % 50)).padStart(2, '0')}:00.000Z"${chance(rng, 0.5) ? ',DURATION=6.0' : ''}`,
      );
    }
    if (chance(rng, 0.05)) gaps.add(sn);
    if (chance(rng, 0.08)) bitrates.set(sn, 1000 + Math.floor(rng() * 4000));
    if (chance(rng, 0.08)) custom.add(sn);
    if (chance(rng, 0.15)) titles.set(sn, `title-${sn}`);
  }
  const at = (p: number) =>
    chance(rng, p) ? 1 + Math.floor(rng() * RELOADS) : -1;
  const llhls = chance(rng, 0.3);
  return {
    count,
    duration: pick(rng, [6, 6.006, 4]),
    pdt: pick(rng, ['all', 'all', 'none', 'first']),
    key: pick(rng, ['none', 'none', 'aes', 'sample-aes']),
    map: pick(rng, ['none', 'header', 'per-break']),
    llhls,
    canSkip: !llhls && chance(rng, 0.5),
    discos,
    dateRanges,
    gaps,
    bitrates,
    custom,
    titles,
    tokenRotateAt: at(0.15),
    keyRotateAt: at(0.15),
    jitterAt: at(0.15),
    titleChangeAt: at(0.2),
    titleChangeSn: Math.floor(rng() * total),
    dateRangeChangeAt: at(0.15),
    discoRemoveAt: at(0.15),
    discoInsertAt: at(0.15),
    discoInsertSn: Math.floor(rng() * total),
    renameAt: at(0.1),
    renameSn: Math.floor(rng() * total),
    deltaAt: at(0.3),
    parseErrorAt: at(0.2),
    directives: chance(rng, 0.5),
    // EXTINF lines without a comma (master keeps a literal 'undefined' title).
    bareInf: chance(rng, 0.15),
  };
}

interface Reload {
  url: string;
  text: string;
}

function playlist(world: World, reload: number): Reload {
  const { count, duration, llhls, discos: baseDiscos } = world;
  // Reload i has i more parts (LL-HLS) or i more segments than the first.
  const partsPerSegment = 4;
  const partClock = llhls ? count * partsPerSegment + reload : 0;
  const complete = llhls
    ? Math.floor(partClock / partsPerSegment)
    : count + reload;
  const hintParts = llhls ? partClock % partsPerSegment : 0;
  const startSN = Math.max(0, complete - count);
  const discos = new Set(baseDiscos);
  if (world.discoRemoveAt !== -1 && reload >= world.discoRemoveAt) {
    const rollable = Array.from(discos).filter((sn) => sn >= startSN);
    if (rollable.length) {
      discos.delete(rollable[0]);
    }
  }
  if (
    world.discoInsertAt !== -1 &&
    reload >= world.discoInsertAt &&
    world.discoInsertSn > startSN
  ) {
    discos.add(world.discoInsertSn);
  }
  let cc = 0;
  discos.forEach((sn) => {
    if (sn <= startSN) cc++;
  });
  const token = (sn: number) =>
    world.tokenRotateAt !== -1 && reload >= world.tokenRotateAt
      ? `?t=r${reload}`
      : '?t=r0';
  const keyToken =
    world.keyRotateAt !== -1 && reload >= world.keyRotateAt ? 'k1' : 'k0';
  const jitter = world.jitterAt !== -1 && reload >= world.jitterAt ? 3 : 0;
  const skip =
    world.canSkip && world.deltaAt !== -1 && reload === world.deltaAt
      ? Math.min(count - 2, 3)
      : 0;
  let out = `#EXTM3U\n#EXT-X-VERSION:9\n#EXT-X-TARGETDURATION:${Math.ceil(duration)}\n`;
  if (llhls) {
    out += `#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=${(duration * 0.75).toFixed(1)}\n#EXT-X-PART-INF:PART-TARGET=${(duration / partsPerSegment).toFixed(3)}\n`;
  } else if (world.canSkip) {
    out += `#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=${duration * 6}\n`;
  }
  out += `#EXT-X-MEDIA-SEQUENCE:${startSN}\n`;
  if (cc > 0) {
    out += `#EXT-X-DISCONTINUITY-SEQUENCE:${cc}\n`;
  }
  if (skip) {
    out += `#EXT-X-SKIP:SKIPPED-SEGMENTS=${skip}\n`;
  }
  if (world.key !== 'none') {
    out +=
      world.key === 'aes'
        ? `#EXT-X-KEY:METHOD=AES-128,URI="key.php?t=${keyToken}",IV=0x00000000000000000000000000000001\n`
        : `#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key.php?t=${keyToken}",KEYFORMAT="identity"\n`;
  }
  if (world.map === 'header') {
    out += '#EXT-X-MAP:URI="init.mp4"\n';
  } else if (world.map === 'per-break') {
    out += `#EXT-X-MAP:URI="init-${cc}.mp4"\n`;
  }
  const segmentLines = (sn: number, index: number) => {
    let lines = '';
    if (discos.has(sn) && index > 0) {
      lines += '#EXT-X-DISCONTINUITY\n';
      cc++;
      if (world.map === 'per-break') {
        lines += `#EXT-X-MAP:URI="init-${cc}.mp4"\n`;
      }
    }
    const range = world.dateRanges.get(sn);
    if (range) {
      const changed =
        world.dateRangeChangeAt !== -1 && reload >= world.dateRangeChangeAt;
      lines += `#EXT-X-DATERANGE:${range}${changed ? ',X-CHANGED="yes"' : ''}\n`;
    }
    if (world.custom.has(sn)) {
      lines += `#EXT-X-CUSTOM-TAG:value-${sn}\n`;
    }
    if (world.gaps.has(sn)) {
      lines += '#EXT-X-GAP\n';
    }
    const bitrate = world.bitrates.get(sn);
    if (bitrate) {
      lines += `#EXT-X-BITRATE:${bitrate}\n`;
    }
    if (world.pdt === 'all' || (world.pdt === 'first' && index === 0)) {
      const date = new Date(
        1700000000000 + sn * duration * 1000 + jitter,
      ).toISOString();
      lines += `#EXT-X-PROGRAM-DATE-TIME:${date}\n`;
    }
    return lines;
  };
  const segmentUri = (sn: number) =>
    world.renameAt !== -1 && reload >= world.renameAt && sn === world.renameSn
      ? `renamed-${sn}.mp4${token(sn)}`
      : `segment-${sn}.mp4${token(sn)}`;
  const title = (sn: number) => {
    const base = world.titles.get(sn) || '';
    return world.titleChangeAt !== -1 &&
      reload >= world.titleChangeAt &&
      sn === world.titleChangeSn
      ? `${base}changed`
      : base;
  };
  const partLines = (sn: number, parts: number) => {
    let lines = '';
    for (let p = 0; p < parts; p++) {
      lines += `#EXT-X-PART:DURATION=${(duration / partsPerSegment).toFixed(5)},URI="part-${sn}-${p}.mp4"${p === 0 ? ',INDEPENDENT=YES' : ''}\n`;
    }
    return lines;
  };
  let index = 0;
  for (let sn = startSN + skip; sn < complete; sn++) {
    out += segmentLines(sn, index);
    if (llhls && sn >= complete - 2) {
      out += partLines(sn, partsPerSegment);
    }
    const segTitle = title(sn);
    out += `#EXTINF:${duration.toFixed(3)}${world.bareInf && !segTitle ? '' : `,${segTitle}`}\n${segmentUri(sn)}\n`;
    index++;
  }
  if (llhls) {
    out += segmentLines(complete, index);
    out += partLines(complete, hintParts);
    out += `#EXT-X-PRELOAD-HINT:TYPE=PART,URI="part-${complete}-${hintParts}.mp4"\n`;
    out += `#EXT-X-RENDITION-REPORT:URI="../v2/playlist.m3u8",LAST-MSN=${complete},LAST-PART=${hintParts}\n`;
  }
  if (world.parseErrorAt !== -1 && reload === world.parseErrorAt) {
    out += `#EXT-X-TARGETDURATION:${Math.ceil(duration)}\n`;
  }
  const url =
    world.directives && reload > 0
      ? `${URL}?_HLS_msn=${complete}${llhls ? `&_HLS_part=${hintParts}` : ''}`
      : URL;
  return { url, text: out };
}

const round = (value: number | undefined | null) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 1e6) / 1e6
    : value;

function snapshotFragment(frag: Fragment | null) {
  if (!frag) {
    return null;
  }
  const streams = frag.hasStreams ? frag.elementaryStreams : null;
  return {
    sn: frag.sn,
    cc: frag.cc,
    level: frag.level,
    start: round(frag.start),
    playlistOffset: round(frag.playlistOffset),
    duration: round(frag.duration),
    relurl: frag.relurl,
    url: frag.url,
    baseurl: frag.baseurl,
    rawProgramDateTime: frag.rawProgramDateTime,
    programDateTime: round(frag.programDateTime),
    title: frag.title,
    gap: !!frag.gap,
    bitrate: frag.bitrate,
    tagList: frag.tagList,
    init: frag.initSegment
      ? {
          relurl: frag.initSegment.relurl,
          url: frag.initSegment.url,
          cc: frag.initSegment.cc,
          byteRange: frag.initSegment.byteRange,
          keys: keysOf(frag.initSegment),
        }
      : null,
    keys: keysOf(frag),
    decryptdata: frag.decryptdata
      ? { uri: frag.decryptdata.uri, method: frag.decryptdata.method }
      : null,
    startPTS: round(frag.startPTS),
    endPTS: round(frag.endPTS),
    startDTS: round(frag.startDTS),
    endDTS: round(frag.endDTS),
    loaded: frag.hasStats ? frag.stats.loaded : null,
    loader: (frag.loader as any)?.id ?? null,
    streams: streams
      ? Object.keys(streams).map((type) => {
          const info = (streams as any)[type];
          return info
            ? [type, round(info.startPTS), round(info.endPTS), info.partial]
            : [type, null];
        })
      : null,
    endList: !!frag.endList,
  };
}

function keysOf(frag: Fragment) {
  const keys = frag.levelkeys;
  return keys
    ? Object.keys(keys)
        .sort()
        .map((format) => {
          const key = keys[format]!;
          return `${format}:${key.method}:${key.uri}:${key.iv ? Array.from(key.iv).join(',') : ''}`;
        })
    : null;
}

function snapshotDetails(details: LevelDetails) {
  return {
    error: details.playlistParsingError?.message ?? null,
    startSN: details.startSN,
    endSN: details.endSN,
    startCC: details.startCC,
    endCC: details.endCC,
    live: details.live,
    targetduration: details.targetduration,
    totalduration: round(details.totalduration),
    edge: round(details.edge),
    fragmentStart: round(details.fragmentStart),
    PTSKnown: details.PTSKnown,
    alignedSliding: details.alignedSliding,
    hasProgramDateTime: details.hasProgramDateTime,
    skippedSegments: details.skippedSegments,
    deltaUpdateFailed: details.deltaUpdateFailed,
    advanced: details.advanced,
    updated: details.updated,
    misses: details.misses,
    appliedTimelineOffset: details.appliedTimelineOffset,
    fragments: details.fragments.map(snapshotFragment),
    hint: details.fragmentHint ? snapshotFragment(details.fragmentHint) : null,
    parts: details.partList
      ? details.partList.map((part) => ({
          sn: part.fragment.sn,
          index: part.index,
          relurl: part.relurl,
          url: part.url,
          duration: round(part.duration),
          start: round(part.start),
          gap: part.gap,
          // The merge assigns part stats unguarded, so a fresh part always
          // has an (empty) stats object; a reused part allocates it lazily.
          loaded: part.hasStats ? part.stats.loaded : 0,
        }))
      : null,
    dateRanges: Object.keys(details.dateRanges)
      .sort()
      .map((id) => {
        const range = details.dateRanges[id]!;
        return {
          id,
          tagOrder: range.tagOrder,
          startDate: round(range.startDate.getTime()),
          duration: range.duration,
          anchorSn: range.tagAnchor?.sn ?? null,
          changed: range.attr['X-CHANGED'] ?? null,
        };
      }),
    encrypted: details.encryptedFragments.map((frag) => frag.sn),
    recentlyRemovedDateranges: details.recentlyRemovedDateranges ?? null,
  };
}

// What the player does between reloads: load and transmux some fragments,
// applied by position so both graphs see the same activity.
function playerActivity(details: LevelDetails, rng: Rng, seedKey: number) {
  const fragments = details.fragments;
  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];
    if (!frag || Number.isFinite(frag.startPTS)) {
      continue;
    }
    if (!chance(rng, 0.3)) {
      continue;
    }
    const adjust = pick(rng, [0, 0.03, -0.02]);
    const startPTS = frag.start;
    const endPTS = frag.start + frag.duration + adjust;
    frag.stats.loaded = 1000 + (frag.sn as number);
    frag.loader = { id: `${seedKey}-${frag.sn}` } as any;
    frag.setElementaryStreamInfo(
      ElementaryStreamTypes.AUDIOVIDEO,
      startPTS,
      endPTS,
      startPTS,
      endPTS,
    );
    updateFragPTSDTS(
      details,
      frag,
      startPTS,
      endPTS,
      startPTS,
      endPTS,
      false,
      logger,
    );
  }
}

// Reports only the leaf paths that differ, which is what a failure needs.
function diffPaths(a: any, b: any, path: string, out: string[]) {
  if (out.length > 12) {
    return;
  }
  if (a === b) {
    return;
  }
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    return;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach((key) => diffPaths(a[key], b[key], `${path}.${key}`, out));
}

function expectSame(actual: any, expected: any, label: string) {
  const out: string[] = [];
  diffPaths(actual, expected, 'details', out);
  if (out.length && actual.fragments && expected.fragments) {
    const offsets = (d: any) =>
      d.fragments
        .map((f: any) =>
          f ? `${f.sn}@${f.playlistOffset}/${f.start}` : 'null',
        )
        .join(' ');
    out.push(`reuse: ${offsets(actual)}`, `fresh: ${offsets(expected)}`);
  }
  expect(out, `${label} (reuse vs fresh)`).to.deep.equal([]);
}

function parseFresh(reload: Reload): LevelDetails {
  return M3U8Parser.parseLevelPlaylist(
    reload.text,
    reload.url,
    0,
    PlaylistLevelType.MAIN,
    0,
    null,
  );
}

function parseReusing(reload: Reload, previous: LevelDetails): LevelDetails {
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

// Fragments of `details` that are instances carried over from `previous`.
function carriedOver(details: LevelDetails, previous: LevelDetails): number {
  let count = 0;
  for (let i = 0; i < details.fragments.length; i++) {
    const frag = details.fragments[i];
    if (frag && previous.fragments.indexOf(frag) !== -1) {
      count++;
    }
  }
  return count;
}

describe('live reload fragment reuse (differential property)', function () {
  this.timeout(60000);

  it('matches the fresh parse and merge on random live streams', function () {
    let reusedTotal = 0;
    let parsesWithReuse = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const world = makeWorld(mulberry32(seed));
      const first = playlist(world, 0);
      let fresh = parseFresh(first);
      let reused = parseFresh(first);
      expect(fresh.playlistParsingError, `seed ${seed} initial`).to.equal(null);
      playerActivity(fresh, mulberry32(seed * 31), seed);
      playerActivity(reused, mulberry32(seed * 31), seed);
      for (let i = 1; i <= RELOADS; i++) {
        const reload = playlist(world, i);
        const before = snapshotDetails(reused);
        const nextFresh = parseFresh(reload);
        const nextReused = parseReusing(reload, reused);
        const label = `seed ${seed} reload ${i}`;
        if (nextFresh.playlistParsingError) {
          // The loader drops this parse; the previous details stay.
          expect(nextReused.playlistParsingError?.message, label).to.equal(
            nextFresh.playlistParsingError.message,
          );
          // A failed parse must not have touched the previous graph.
          expectSame(snapshotDetails(reused), before, `${label} failed parse`);
          continue;
        }
        expect(nextReused.playlistParsingError, label).to.equal(null);
        nextFresh.reloaded(fresh);
        nextReused.reloaded(reused);
        mergeDetails(fresh, nextFresh, logger);
        mergeDetails(reused, nextReused, logger);
        // Assigned by mergeDetails, which TypeScript cannot see through.
        const rejected = nextFresh.playlistParsingError as Error | null;
        if (rejected) {
          // A rejected merge: master installs details whose fragments past
          // the mismatch never received loaded state, while shared
          // instances keep theirs and are put back by the merge. What
          // follows is error recovery, outside this property.
          expect(nextReused.playlistParsingError?.message, label).to.equal(
            rejected.message,
          );
          expectSame(
            snapshotDetails(reused),
            before,
            `${label} rejected merge`,
          );
          break;
        }
        expectSame(
          snapshotDetails(nextReused),
          snapshotDetails(nextFresh),
          label,
        );
        const carried = carriedOver(nextReused, reused);
        if (carried) {
          parsesWithReuse++;
          reusedTotal += carried;
        }
        // The stream controller installs the new details either way.
        fresh = nextFresh;
        reused = nextReused;
        playerActivity(fresh, mulberry32(seed * 31 + i), seed);
        playerActivity(reused, mulberry32(seed * 31 + i), seed);
      }
    }
    // The generator must actually exercise reuse, not just the fresh path.
    expect(parsesWithReuse).to.be.greaterThan(SEEDS);
    expect(reusedTotal).to.be.greaterThan(SEEDS * 10);
  });
});
