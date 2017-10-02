import BinarySearch from './binary-search';
import {logger} from '../utils/logger';

export function findFirstFragWithCC(fragments, cc) {
  let firstFrag = null;

  for (let i = 0; i < fragments.length; i += 1) {
    const currentFrag = fragments[i];
    if (currentFrag && currentFrag.cc === cc) {
      firstFrag = currentFrag;
      break;
    }
  }

  return firstFrag;
}

export function findFragWithCC(fragments, CC) {
  return BinarySearch.search(fragments, (candidate) => {
    if (candidate.cc < CC) {
      return 1;
    } else if (candidate.cc > CC) {
      return -1;
    } else {
      return 0;
    }
  });
}

export function shouldAlignOnDiscontinuities(lastFrag, lastLevel, details) {
  let shouldAlign = false;
  if (lastLevel && lastLevel.details && details) {
    if (details.endCC > details.startCC || (lastFrag && lastFrag.cc < details.startCC)) {
      shouldAlign = true;
    }
  }
  return shouldAlign;
}

// Find the first frag in the previous level which matches the CC of the first frag of the new level
export function findDiscontinuousReferenceFrag(prevDetails, curDetails) {
  const prevFrags = prevDetails.fragments;
  const curFrags = curDetails.fragments;

  if (!curFrags.length || !prevFrags.length) {
    logger.log('No fragments to align');
    return;
  }

  const prevStartFrag = findFirstFragWithCC(prevFrags, curFrags[0].cc);

  if (!prevStartFrag || (prevStartFrag && !prevStartFrag.startPTS)) {
    logger.log('No frag in previous level to align on');
    return;
  }

  return prevStartFrag;
}

export function adjustPts(sliding, details) {
  details.fragments.forEach((frag) => {
    if (frag) {
      let start = frag.start + sliding;
      frag.start = frag.startPTS = start;
      frag.endPTS = start + frag.duration;
    }
  });
  details.PTSKnown = true;
}

// If a change in CC is detected, the PTS can no longer be relied upon
// Attempt to align the level by using the last level - find the last frag matching the current CC and use it's PTS
// as a reference
export function alignDiscontinuities(lastFrag, lastLevel, details) {
  if (shouldAlignOnDiscontinuities(lastFrag, lastLevel, details)) {
    const referenceFrag = findDiscontinuousReferenceFrag(lastLevel.details, details);
    if (referenceFrag) {
      logger.log('Adjusting PTS using last level due to CC increase within current level');
      adjustPts(referenceFrag.start, details);
    }
  }
  // try to align using programDateTime attribute (if available)
  if (details.PTSKnown === false && lastLevel && lastLevel.details) {
    // if last level sliding is 1000 and its first frag PROGRAM-DATE-TIME is 2017-08-20 1:10:00 AM
    // and if new details first frag PROGRAM DATE-TIME is 2017-08-20 1:10:08 AM
    // then we can deduce that playlist B sliding is 1000+8 = 1008s
    let lastPDT = lastLevel.details.programDateTime;
    let newPDT = details.programDateTime;
    // date diff is in ms. frag.start is in seconds
    let sliding = (newPDT - lastPDT)/1000 + lastLevel.details.fragments[0].start;
    if (!isNaN(sliding)) {
      logger.log(`adjusting PTS using programDateTime delta, sliding:${sliding.toFixed(3)}`);
      adjustPts(sliding,details);
    }
  }
}
