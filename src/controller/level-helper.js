/**
 * @module LevelHelper
 *
 * Providing methods dealing with playlist sliding and drift
 *
 * TODO: Create an actual `Level` class/model that deals with all this logic in an object-oriented-manner.
 *
 * */

import { logger } from '../utils/logger';

export function addGroupId (level, type, id) {
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

export function updatePTS (fragments, fromIdx, toIdx) {
  let fragFrom = fragments[fromIdx], fragTo = fragments[toIdx], fragToPTS = fragTo.startPTS;
  // if we know startPTS[toIdx]
  if (Number.isFinite(fragToPTS)) {
    // update fragment duration.
    // it helps to fix drifts between playlist reported duration and fragment real duration
    if (toIdx > fromIdx) {
      fragFrom.duration = fragToPTS - fragFrom.start;
      if (fragFrom.duration < 0) {
        logger.warn(`negative duration computed for frag ${fragFrom.sn},level ${fragFrom.level}, there should be some duration drift between playlist and fragment!`);
      }
    } else {
      fragTo.duration = fragFrom.start - fragToPTS;
      if (fragTo.duration < 0) {
        logger.warn(`negative duration computed for frag ${fragTo.sn},level ${fragTo.level}, there should be some duration drift between playlist and fragment!`);
      }
    }
  } else {
    // we dont know startPTS[toIdx]
    if (toIdx > fromIdx) {
      fragTo.start = fragFrom.start + fragFrom.duration;
    } else {
      fragTo.start = Math.max(fragFrom.start - fragTo.duration, 0);
    }
  }
}

export function updateFragPTSDTS (details, frag, startPTS, endPTS, startDTS, endDTS) {
  // update frag PTS/DTS
  let maxStartPTS = startPTS;
  if (Number.isFinite(frag.startPTS)) {
    // delta PTS between audio and video
    let deltaPTS = Math.abs(frag.startPTS - startPTS);
    if (!Number.isFinite(frag.deltaPTS)) {
      frag.deltaPTS = deltaPTS;
    } else {
      frag.deltaPTS = Math.max(deltaPTS, frag.deltaPTS);
    }

    maxStartPTS = Math.max(startPTS, frag.startPTS);
    startPTS = Math.min(startPTS, frag.startPTS);
    endPTS = Math.max(endPTS, frag.endPTS);
    startDTS = Math.min(startDTS, frag.startDTS);
    endDTS = Math.max(endDTS, frag.endDTS);
  }

  const drift = startPTS - frag.start;
  frag.start = frag.startPTS = startPTS;
  frag.maxStartPTS = maxStartPTS;
  frag.endPTS = endPTS;
  frag.startDTS = startDTS;
  frag.endDTS = endDTS;
  frag.duration = endPTS - startPTS;

  const sn = frag.sn;
  // exit if sn out of range
  if (!details || sn < details.startSN || sn > details.endSN) {
    return 0;
  }

  let fragIdx, fragments, i;
  fragIdx = sn - details.startSN;
  fragments = details.fragments;
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

export function mergeDetails (oldDetails, newDetails) {
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
    if (Number.isFinite(oldFrag.startPTS)) {
      newFrag.start = newFrag.startPTS = oldFrag.startPTS;
      newFrag.endPTS = oldFrag.endPTS;
      newFrag.duration = oldFrag.duration;
      newFrag.backtracked = oldFrag.backtracked;
      newFrag.dropped = oldFrag.dropped;
      PTSFrag = newFrag;
    }
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
    updateFragPTSDTS(newDetails, PTSFrag, PTSFrag.startPTS, PTSFrag.endPTS, PTSFrag.startDTS, PTSFrag.endDTS);
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

export function mergeSubtitlePlaylists (oldPlaylist, newPlaylist, referenceStart = 0) {
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

export function mapFragmentIntersection (oldPlaylist, newPlaylist, intersectionFn) {
  if (!oldPlaylist || !newPlaylist) {
    return;
  }

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

export function adjustSliding (oldPlaylist, newPlaylist) {
  const delta = newPlaylist.startSN - oldPlaylist.startSN;
  const oldFragments = oldPlaylist.fragments;
  const newFragments = newPlaylist.fragments;

  if (delta < 0 || delta > oldFragments.length) {
    return;
  }
  for (let i = 0; i < newFragments.length; i++) {
    newFragments[i].start += oldFragments[delta].start;
  }
}

export function computeReloadInterval (currentPlaylist, newPlaylist, lastRequestTime) {
  let reloadInterval = 1000 * (newPlaylist.averagetargetduration ? newPlaylist.averagetargetduration : newPlaylist.targetduration);
  const minReloadInterval = reloadInterval / 2;
  if (currentPlaylist && newPlaylist.endSN === currentPlaylist.endSN) {
    // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
    // changed then it MUST wait for a period of one-half the target
    // duration before retrying.
    reloadInterval = minReloadInterval;
  }

  if (lastRequestTime) {
    reloadInterval = Math.max(minReloadInterval, reloadInterval - (window.performance.now() - lastRequestTime));
  }
  // in any case, don't reload more than half of target duration
  return Math.round(reloadInterval);
}
