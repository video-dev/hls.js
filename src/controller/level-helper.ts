/**
 * Provides methods dealing with playlist sliding and drift
 */

import { logger } from '../utils/logger';
import { Fragment, Part } from '../loader/fragment';
import { LevelDetails } from '../loader/level-details';
import type { Level } from '../types/level';
import { DateRange } from '../loader/date-range';

type FragmentIntersection = (oldFrag: Fragment, newFrag: Fragment) => void;
type PartIntersection = (oldPart: Part, newPart: Part) => void;

export function updatePTS(
  fragments: Fragment[],
  fromIdx: number,
  toIdx: number
): void {
  const fragFrom = fragments[fromIdx];
  const fragTo = fragments[toIdx];
  updateFromToPTS(fragFrom, fragTo);
}

function updateFromToPTS(fragFrom: Fragment, fragTo: Fragment) {
  const fragToPTS = fragTo.startPTS as number;
  // if we know startPTS[toIdx]
  if (Number.isFinite(fragToPTS)) {
    // update fragment duration.
    // it helps to fix drifts between playlist reported duration and fragment real duration
    let duration: number = 0;
    let frag: Fragment;
    if (fragTo.sn > fragFrom.sn) {
      duration = fragToPTS - fragFrom.start;
      frag = fragFrom;
    } else {
      duration = fragFrom.start - fragToPTS;
      frag = fragTo;
    }
    if (frag.duration !== duration) {
      frag.duration = duration;
    }
    // we dont know startPTS[toIdx]
  } else if (fragTo.sn > fragFrom.sn) {
    const contiguous = fragFrom.cc === fragTo.cc;
    // TODO: With part-loading end/durations we need to confirm the whole fragment is loaded before using (or setting) minEndPTS
    if (contiguous && fragFrom.minEndPTS) {
      fragTo.start = fragFrom.start + (fragFrom.minEndPTS - fragFrom.start);
    } else {
      fragTo.start = fragFrom.start + fragFrom.duration;
    }
  } else {
    fragTo.start = Math.max(fragFrom.start - fragTo.duration, 0);
  }
}

export function updateFragPTSDTS(
  details: LevelDetails | undefined,
  frag: Fragment,
  startPTS: number,
  endPTS: number,
  startDTS: number,
  endDTS: number
): number {
  const parsedMediaDuration = endPTS - startPTS;
  if (parsedMediaDuration <= 0) {
    logger.warn('Fragment should have a positive duration', frag);
    endPTS = startPTS + frag.duration;
    endDTS = startDTS + frag.duration;
  }
  let maxStartPTS = startPTS;
  let minEndPTS = endPTS;
  const fragStartPts = frag.startPTS as number;
  const fragEndPts = frag.endPTS as number;
  if (Number.isFinite(fragStartPts)) {
    // delta PTS between audio and video
    const deltaPTS = Math.abs(fragStartPts - startPTS);
    if (!Number.isFinite(frag.deltaPTS as number)) {
      frag.deltaPTS = deltaPTS;
    } else {
      frag.deltaPTS = Math.max(deltaPTS, frag.deltaPTS as number);
    }

    maxStartPTS = Math.max(startPTS, fragStartPts);
    startPTS = Math.min(startPTS, fragStartPts);
    startDTS = Math.min(startDTS, frag.startDTS);

    minEndPTS = Math.min(endPTS, fragEndPts);
    endPTS = Math.max(endPTS, fragEndPts);
    endDTS = Math.max(endDTS, frag.endDTS);
  }

  const drift = startPTS - frag.start;
  if (frag.start !== 0) {
    frag.start = startPTS;
  }
  frag.duration = endPTS - frag.start;
  frag.startPTS = startPTS;
  frag.maxStartPTS = maxStartPTS;
  frag.startDTS = startDTS;
  frag.endPTS = endPTS;
  frag.minEndPTS = minEndPTS;
  frag.endDTS = endDTS;

  const sn = frag.sn as number; // 'initSegment'
  // exit if sn out of range
  if (!details || sn < details.startSN || sn > details.endSN) {
    return 0;
  }
  let i;
  const fragIdx = sn - details.startSN;
  const fragments = details.fragments;
  // update frag reference in fragments array
  // rationale is that fragments array might not contain this frag object.
  // this will happen if playlist has been refreshed between frag loading and call to updateFragPTSDTS()
  // if we don't update frag, we won't be able to propagate PTS info on the playlist
  // resulting in invalid sliding computation
  fragments[fragIdx] = frag;
  // adjust fragment PTS/duration from seqnum-1 to frag 0
  for (i = fragIdx; i > 0; i--) {
    updateFromToPTS(fragments[i], fragments[i - 1]);
  }

  // adjust fragment PTS/duration from seqnum to last frag
  for (i = fragIdx; i < fragments.length - 1; i++) {
    updateFromToPTS(fragments[i], fragments[i + 1]);
  }
  if (details.fragmentHint) {
    updateFromToPTS(fragments[fragments.length - 1], details.fragmentHint);
  }

  details.PTSKnown = details.alignedSliding = true;
  return drift;
}

export function mergeDetails(
  oldDetails: LevelDetails,
  newDetails: LevelDetails
): void {
  // Track the last initSegment processed. Initialize it to the last one on the timeline.
  let currentInitSegment: Fragment | null = null;
  const oldFragments = oldDetails.fragments;
  for (let i = oldFragments.length - 1; i >= 0; i--) {
    const oldInit = oldFragments[i].initSegment;
    if (oldInit) {
      currentInitSegment = oldInit;
      break;
    }
  }

  if (oldDetails.fragmentHint) {
    // prevent PTS and duration from being adjusted on the next hint
    delete oldDetails.fragmentHint.endPTS;
  }
  // check if old/new playlists have fragments in common
  // loop through overlapping SN and update startPTS , cc, and duration if any found
  let ccOffset = 0;
  let PTSFrag;
  mapFragmentIntersection(
    oldDetails,
    newDetails,
    (oldFrag: Fragment, newFrag: Fragment) => {
      if (oldFrag.relurl) {
        // Do not compare CC if the old fragment has no url. This is a level.fragmentHint used by LL-HLS parts.
        // It maybe be off by 1 if it was created before any parts or discontinuity tags were appended to the end
        // of the playlist.
        ccOffset = oldFrag.cc - newFrag.cc;
      }
      if (
        Number.isFinite(oldFrag.startPTS) &&
        Number.isFinite(oldFrag.endPTS)
      ) {
        newFrag.start = newFrag.startPTS = oldFrag.startPTS as number;
        newFrag.startDTS = oldFrag.startDTS;
        newFrag.maxStartPTS = oldFrag.maxStartPTS;

        newFrag.endPTS = oldFrag.endPTS;
        newFrag.endDTS = oldFrag.endDTS;
        newFrag.minEndPTS = oldFrag.minEndPTS;
        newFrag.duration =
          (oldFrag.endPTS as number) - (oldFrag.startPTS as number);

        if (newFrag.duration) {
          PTSFrag = newFrag;
        }

        // PTS is known when any segment has startPTS and endPTS
        newDetails.PTSKnown = newDetails.alignedSliding = true;
      }
      newFrag.elementaryStreams = oldFrag.elementaryStreams;
      newFrag.loader = oldFrag.loader;
      newFrag.stats = oldFrag.stats;
      newFrag.urlId = oldFrag.urlId;
      if (oldFrag.initSegment) {
        newFrag.initSegment = oldFrag.initSegment;
        currentInitSegment = oldFrag.initSegment;
      }
    }
  );

  if (currentInitSegment) {
    const fragmentsToCheck = newDetails.fragmentHint
      ? newDetails.fragments.concat(newDetails.fragmentHint)
      : newDetails.fragments;
    fragmentsToCheck.forEach((frag) => {
      if (
        !frag.initSegment ||
        frag.initSegment.relurl === currentInitSegment?.relurl
      ) {
        frag.initSegment = currentInitSegment;
      }
    });
  }

  if (newDetails.skippedSegments) {
    newDetails.deltaUpdateFailed = newDetails.fragments.some((frag) => !frag);
    if (newDetails.deltaUpdateFailed) {
      logger.warn(
        '[level-helper] Previous playlist missing segments skipped in delta playlist'
      );
      for (let i = newDetails.skippedSegments; i--; ) {
        newDetails.fragments.shift();
      }
      newDetails.startSN = newDetails.fragments[0].sn as number;
      newDetails.startCC = newDetails.fragments[0].cc;
    } else if (newDetails.canSkipDateRanges) {
      newDetails.dateRanges = mergeDateRanges(
        oldDetails.dateRanges,
        newDetails.dateRanges,
        newDetails.recentlyRemovedDateranges
      );
    }
  }

  const newFragments = newDetails.fragments;
  if (ccOffset) {
    logger.warn('discontinuity sliding from playlist, take drift into account');
    for (let i = 0; i < newFragments.length; i++) {
      newFragments[i].cc += ccOffset;
    }
  }
  if (newDetails.skippedSegments) {
    newDetails.startCC = newDetails.fragments[0].cc;
  }

  // Merge parts
  mapPartIntersection(
    oldDetails.partList,
    newDetails.partList,
    (oldPart: Part, newPart: Part) => {
      newPart.elementaryStreams = oldPart.elementaryStreams;
      newPart.stats = oldPart.stats;
    }
  );

  // if at least one fragment contains PTS info, recompute PTS information for all fragments
  if (PTSFrag) {
    updateFragPTSDTS(
      newDetails,
      PTSFrag,
      PTSFrag.startPTS,
      PTSFrag.endPTS,
      PTSFrag.startDTS,
      PTSFrag.endDTS
    );
  } else {
    // ensure that delta is within oldFragments range
    // also adjust sliding in case delta is 0 (we could have old=[50-60] and new=old=[50-61])
    // in that case we also need to adjust start offset of all fragments
    adjustSliding(oldDetails, newDetails);
  }

  if (newFragments.length) {
    newDetails.totalduration = newDetails.edge - newFragments[0].start;
  }

  newDetails.driftStartTime = oldDetails.driftStartTime;
  newDetails.driftStart = oldDetails.driftStart;
  const advancedDateTime = newDetails.advancedDateTime;
  if (newDetails.advanced && advancedDateTime) {
    const edge = newDetails.edge;
    if (!newDetails.driftStart) {
      newDetails.driftStartTime = advancedDateTime;
      newDetails.driftStart = edge;
    }
    newDetails.driftEndTime = advancedDateTime;
    newDetails.driftEnd = edge;
  } else {
    newDetails.driftEndTime = oldDetails.driftEndTime;
    newDetails.driftEnd = oldDetails.driftEnd;
    newDetails.advancedDateTime = oldDetails.advancedDateTime;
  }
}

function mergeDateRanges(
  oldDateRanges: Record<string, DateRange>,
  deltaDateRanges: Record<string, DateRange>,
  recentlyRemovedDateranges: string[] | undefined
): Record<string, DateRange> {
  const dateRanges = Object.assign({}, oldDateRanges);
  if (recentlyRemovedDateranges) {
    recentlyRemovedDateranges.forEach((id) => {
      delete dateRanges[id];
    });
  }
  Object.keys(deltaDateRanges).forEach((id) => {
    const dateRange = new DateRange(deltaDateRanges[id].attr, dateRanges[id]);
    if (dateRange.isValid) {
      dateRanges[id] = dateRange;
    } else {
      logger.warn(
        `Ignoring invalid Playlist Delta Update DATERANGE tag: "${JSON.stringify(
          deltaDateRanges[id].attr
        )}"`
      );
    }
  });
  return dateRanges;
}

export function mapPartIntersection(
  oldParts: Part[] | null,
  newParts: Part[] | null,
  intersectionFn: PartIntersection
) {
  if (oldParts && newParts) {
    let delta = 0;
    for (let i = 0, len = oldParts.length; i <= len; i++) {
      const oldPart = oldParts[i];
      const newPart = newParts[i + delta];
      if (
        oldPart &&
        newPart &&
        oldPart.index === newPart.index &&
        oldPart.fragment.sn === newPart.fragment.sn
      ) {
        intersectionFn(oldPart, newPart);
      } else {
        delta--;
      }
    }
  }
}

export function mapFragmentIntersection(
  oldDetails: LevelDetails,
  newDetails: LevelDetails,
  intersectionFn: FragmentIntersection
): void {
  const skippedSegments = newDetails.skippedSegments;
  const start =
    Math.max(oldDetails.startSN, newDetails.startSN) - newDetails.startSN;
  const end =
    (oldDetails.fragmentHint ? 1 : 0) +
    (skippedSegments
      ? newDetails.endSN
      : Math.min(oldDetails.endSN, newDetails.endSN)) -
    newDetails.startSN;
  const delta = newDetails.startSN - oldDetails.startSN;
  const newFrags = newDetails.fragmentHint
    ? newDetails.fragments.concat(newDetails.fragmentHint)
    : newDetails.fragments;
  const oldFrags = oldDetails.fragmentHint
    ? oldDetails.fragments.concat(oldDetails.fragmentHint)
    : oldDetails.fragments;

  for (let i = start; i <= end; i++) {
    const oldFrag = oldFrags[delta + i];
    let newFrag = newFrags[i];
    if (skippedSegments && !newFrag && i < skippedSegments) {
      // Fill in skipped segments in delta playlist
      newFrag = newDetails.fragments[i] = oldFrag;
    }
    if (oldFrag && newFrag) {
      intersectionFn(oldFrag, newFrag);
    }
  }
}

export function adjustSliding(
  oldDetails: LevelDetails,
  newDetails: LevelDetails
): void {
  const delta =
    newDetails.startSN + newDetails.skippedSegments - oldDetails.startSN;
  const oldFragments = oldDetails.fragments;
  if (delta < 0 || delta >= oldFragments.length) {
    return;
  }
  addSliding(newDetails, oldFragments[delta].start);
}

export function addSliding(details: LevelDetails, start: number) {
  if (start) {
    const fragments = details.fragments;
    for (let i = details.skippedSegments; i < fragments.length; i++) {
      fragments[i].start += start;
    }
    if (details.fragmentHint) {
      details.fragmentHint.start += start;
    }
  }
}

export function computeReloadInterval(
  newDetails: LevelDetails,
  distanceToLiveEdgeMs: number = Infinity
): number {
  let reloadInterval = 1000 * newDetails.targetduration;

  if (newDetails.updated) {
    // Use last segment duration when shorter than target duration and near live edge
    const fragments = newDetails.fragments;
    const liveEdgeMaxTargetDurations = 4;
    if (
      fragments.length &&
      reloadInterval * liveEdgeMaxTargetDurations > distanceToLiveEdgeMs
    ) {
      const lastSegmentDuration =
        fragments[fragments.length - 1].duration * 1000;
      if (lastSegmentDuration < reloadInterval) {
        reloadInterval = lastSegmentDuration;
      }
    }
  } else {
    // estimate = 'miss half average';
    // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
    // changed then it MUST wait for a period of one-half the target
    // duration before retrying.
    reloadInterval /= 2;
  }

  return Math.round(reloadInterval);
}

export function getFragmentWithSN(
  level: Level,
  sn: number,
  fragCurrent: Fragment | null
): Fragment | null {
  if (!level?.details) {
    return null;
  }
  const levelDetails = level.details;
  let fragment: Fragment | undefined =
    levelDetails.fragments[sn - levelDetails.startSN];
  if (fragment) {
    return fragment;
  }
  fragment = levelDetails.fragmentHint;
  if (fragment && fragment.sn === sn) {
    return fragment;
  }
  if (sn < levelDetails.startSN && fragCurrent && fragCurrent.sn === sn) {
    return fragCurrent;
  }
  return null;
}

export function getPartWith(
  level: Level,
  sn: number,
  partIndex: number
): Part | null {
  if (!level?.details) {
    return null;
  }
  return findPart(level.details?.partList, sn, partIndex);
}

export function findPart(
  partList: Part[] | null | undefined,
  sn: number,
  partIndex: number
): Part | null {
  if (partList) {
    for (let i = partList.length; i--; ) {
      const part = partList[i];
      if (part.index === partIndex && part.fragment.sn === sn) {
        return part;
      }
    }
  }
  return null;
}
