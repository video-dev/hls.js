/**
 * @module LevelHelper
 * Providing methods dealing with playlist sliding and drift
 * */

import { logger } from '../utils/logger';
import Fragment from '../loader/fragment';
import LevelDetails from '../loader/level-details';
import { Level } from '../types/level';
import { LoaderStats } from '../types/loader';

export function addGroupId (level: Level, type: string, id: string): void {
  switch (type) {
  case 'audio':
    if (!level.audioGroupIds) {
      level.audioGroupIds = [];
    }
    level.audioGroupIds.push(id);
    break;
  case 'text':
    if (!level.textGroupIds) {
      level.textGroupIds = [];
    }
    level.textGroupIds.push(id);
    break;
  }
}

export function updatePTS (fragments: Fragment[], fromIdx: number, toIdx: number): void {
  const fragFrom = fragments[fromIdx];
  const fragTo = fragments[toIdx];
  const fragToPTS = fragTo.startPTS as number;
  // if we know startPTS[toIdx]
  if (Number.isFinite(fragToPTS)) {
    // update fragment duration.
    // it helps to fix drifts between playlist reported duration and fragment real duration
    let duration: number = 0;
    let frag: Fragment;
    if (toIdx > fromIdx) {
      duration = fragToPTS - fragFrom.start;
      frag = fragFrom;
    } else {
      duration = fragFrom.start - fragToPTS;
      frag = fragTo;
    }
    // TODO? Drift can go either way, or the playlist could be completely accurate
    // console.assert(duration > 0,
    //   `duration of ${duration} computed for frag ${frag.sn}, level ${frag.level}, there should be some duration drift between playlist and fragment!`);
    if (frag.duration !== duration) {
      frag.duration = duration;
    }
  } else {
    // we dont know startPTS[toIdx]
    if (toIdx > fromIdx) {
      const contiguous = fragFrom.cc === fragTo.cc;
      // TODO: With part-loading end/durations we need to confirm the whole fragment is loaded before using (or setting) minEndPTS
      const duration = ((contiguous && fragFrom.minEndPTS) ? fragFrom.minEndPTS - fragFrom.start : fragFrom.duration);
      fragTo.start = fragFrom.start + duration;
    } else {
      fragTo.start = Math.max(fragFrom.start - fragTo.duration, 0);
    }
  }
}

export function updateFragPTSDTS (details: LevelDetails | undefined, frag: Fragment, startPTS: number, endPTS: number, startDTS: number, endDTS: number, partIndex: number): number {
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
    minEndPTS = Math.min(endPTS, fragEndPts);
    endPTS = Math.max(endPTS, fragEndPts);
    startDTS = Math.min(startDTS, frag.startDTS);
    endDTS = Math.max(endDTS, frag.endDTS);
  }

  const parsedMediaDuration = endPTS - startPTS;
  const drift = startPTS - frag.start;
  frag.appendedPTS = endPTS;
  frag.start = frag.startPTS = startPTS;
  frag.maxStartPTS = maxStartPTS;
  frag.startDTS = startDTS;
  // TODO: When we are loading parts we don't explicitly know if/when all parts have been loaded
  // If we the manifest contains LL-HLS parts, only update end after all parts are loaded.
  if (!details || !details.partTarget || parsedMediaDuration > frag.duration - details.partTarget / 2) {
    frag.endPTS = endPTS;
    frag.minEndPTS = minEndPTS;
    frag.endDTS = endDTS;
    frag.duration = parsedMediaDuration;
  }

  console.assert(frag.duration > 0, 'Fragment should have a positive duration', frag);

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
    updatePTS(fragments, i, i - 1);
  }

  // adjust fragment PTS/duration from seqnum to last frag
  for (i = fragIdx; i < fragments.length - 1; i++) {
    updatePTS(fragments, i, i + 1);
  }

  details.PTSKnown = true;
  return drift;
}

export function mergeDetails (oldDetails: LevelDetails, newDetails: LevelDetails): void {
  // potentially retrieve cached initsegment
  if (newDetails.initSegment && oldDetails.initSegment) {
    newDetails.initSegment = oldDetails.initSegment;
  }

  // check if old/new playlists have fragments in common
  // loop through overlapping SN and update startPTS , cc, and duration if any found
  let ccOffset = 0;
  let PTSFrag;
  mapFragmentIntersection(oldDetails, newDetails, (oldFrag, newFrag) => {
    ccOffset = oldFrag.cc - newFrag.cc;
    if (Number.isFinite(oldFrag.startPTS) && Number.isFinite(oldFrag.endPTS)) {
      newFrag.start = newFrag.startPTS = oldFrag.startPTS;
      newFrag.startDTS = oldFrag.startDTS;
      newFrag.appendedPTS = oldFrag.appendedPTS;
      newFrag.maxStartPTS = oldFrag.maxStartPTS;

      newFrag.endPTS = oldFrag.endPTS;
      newFrag.endDTS = oldFrag.endDTS;
      newFrag.minEndPTS = oldFrag.minEndPTS;
      const duration = Math.max(oldFrag.endPTS - oldFrag.startPTS, oldFrag.duration);
      newFrag.duration = duration;

      newFrag.backtracked = oldFrag.backtracked;
      newFrag.dropped = oldFrag.dropped;
      PTSFrag = newFrag;
    }
    newFrag.stats = oldFrag.stats;
    newFrag.loader = oldFrag.loader;
    newFrag.urlId = oldFrag.urlId;

    // PTS is known when there are overlapping segments
    newDetails.PTSKnown = true;
  });

  if (!newDetails.PTSKnown) {
    return;
  }

  if (ccOffset) {
    logger.log('discontinuity sliding from playlist, take drift into account');
    const newFragments = newDetails.fragments;
    for (let i = 0; i < newFragments.length; i++) {
      newFragments[i].cc += ccOffset;
    }
  }

  // if at least one fragment contains PTS info, recompute PTS information for all fragments
  if (PTSFrag) {
    updateFragPTSDTS(newDetails, PTSFrag, PTSFrag.startPTS, PTSFrag.endPTS, PTSFrag.startDTS, PTSFrag.endDTS, -1);
  } else {
    // ensure that delta is within oldFragments range
    // also adjust sliding in case delta is 0 (we could have old=[50-60] and new=old=[50-61])
    // in that case we also need to adjust start offset of all fragments
    adjustSliding(oldDetails, newDetails);
  }
  // if we are here, it means we have fragments overlapping between
  // old and new level. reliable PTS info is thus relying on old level
  newDetails.PTSKnown = oldDetails.PTSKnown;
}

export function mergeSubtitlePlaylists (oldPlaylist: LevelDetails, newPlaylist: LevelDetails, referenceStart = 0): void {
  let lastIndex = -1;
  mapFragmentIntersection(oldPlaylist, newPlaylist, (oldFrag, newFrag, index) => {
    newFrag.start = oldFrag.start;
    lastIndex = index;
  });

  const frags = newPlaylist.fragments;
  if (lastIndex < 0) {
    frags.forEach(frag => {
      frag.start += referenceStart;
    });
    return;
  }

  for (let i = lastIndex + 1; i < frags.length; i++) {
    frags[i].start = (frags[i - 1].start + frags[i - 1].duration);
  }
}

export function mapFragmentIntersection (oldPlaylist: LevelDetails, newPlaylist: LevelDetails, intersectionFn): void {
  const start = Math.max(oldPlaylist.startSN, newPlaylist.startSN) - newPlaylist.startSN;
  const end = Math.min(oldPlaylist.endSN, newPlaylist.endSN) - newPlaylist.startSN;
  const delta = newPlaylist.startSN - oldPlaylist.startSN;

  for (let i = start; i <= end; i++) {
    const oldFrag = oldPlaylist.fragments[delta + i];
    const newFrag = newPlaylist.fragments[i];
    if (!oldFrag || !newFrag) {
      break;
    }
    intersectionFn(oldFrag, newFrag, i);
  }
}

export function adjustSliding (oldPlaylist: LevelDetails, newPlaylist: LevelDetails): void {
  const delta = newPlaylist.startSN - oldPlaylist.startSN;
  const oldFragments = oldPlaylist.fragments;
  const newFragments = newPlaylist.fragments;

  if (delta < 0 || delta > oldFragments.length) {
    return;
  }
  const playlistStartOffset = oldFragments[delta].start;
  for (let i = 0; i < newFragments.length; i++) {
    newFragments[i].start += playlistStartOffset;
  }
}

export function computeReloadInterval (newDetails: LevelDetails, stats: LoaderStats): number {
  const reloadInterval = 1000 * newDetails.levelTargetDuration;
  const reloadIntervalAfterMiss = reloadInterval / 2;
  const timeSinceLastModified = newDetails.lastModified ? +new Date() - newDetails.lastModified : 0;
  const useLastModified = timeSinceLastModified > 0 && timeSinceLastModified < reloadInterval * 3;
  const roundTrip = stats ? stats.loading.end - stats.loading.start : 0;

  let estimatedTimeUntilUpdate = reloadInterval;
  let availabilityDelay = newDetails.availabilityDelay;
  // let estimate = 'average';

  if (newDetails.updated === false) {
    if (useLastModified) {
      // estimate = 'miss round trip';
      // We should have had a hit so try again in the time it takes to get a response,
      // but no less than 1/3 second.
      const minRetry = 333 * newDetails.misses;
      estimatedTimeUntilUpdate = Math.max(Math.min(reloadIntervalAfterMiss, roundTrip * 2), minRetry);
      newDetails.availabilityDelay = (newDetails.availabilityDelay || 0) + estimatedTimeUntilUpdate;
    } else {
      // estimate = 'miss half average';
      // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
      // changed then it MUST wait for a period of one-half the target
      // duration before retrying.
      estimatedTimeUntilUpdate = reloadIntervalAfterMiss;
    }
  } else if (useLastModified) {
    // estimate = 'next modified date';
    // Get the closest we've been to timeSinceLastModified on update
    availabilityDelay = Math.min(availabilityDelay || reloadInterval / 2, timeSinceLastModified);
    newDetails.availabilityDelay = availabilityDelay;
    estimatedTimeUntilUpdate = availabilityDelay + reloadInterval - timeSinceLastModified;
  } else {
    estimatedTimeUntilUpdate = reloadInterval - roundTrip;
  }

  // console.log(`[computeReloadInterval] live reload ${newDetails.updated ? 'REFRESHED' : 'MISSED'}`,
  //   '\n  method', estimate,
  //   '\n  estimated time until update =>', estimatedTimeUntilUpdate,
  //   '\n  average target duration', reloadInterval,
  //   '\n  time since modified', timeSinceLastModified,
  //   '\n  time round trip', roundTrip,
  //   '\n  availability delay', availabilityDelay);

  return Math.round(estimatedTimeUntilUpdate);
}

export function getFragmentWithSN (level: Level, sn: number): Fragment | null {
  if (!level || !level.details) {
    return null;
  }
  const levelDetails = level.details;
  return levelDetails.fragments[sn - levelDetails.startSN];
}
