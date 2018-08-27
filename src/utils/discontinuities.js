import BinarySearch from './binary-search';
import { logger } from '../utils/logger';

export function findFirstFragWithCC (fragments, cc) {
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

export function findFragWithCC (fragments, CC) {
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

export function shouldAlignOnDiscontinuities (lastFrag, lastLevel, details) {
  let shouldAlign = false;
  if (lastLevel && lastLevel.details && details) {
    if (details.endCC > details.startCC || (lastFrag && lastFrag.cc < details.startCC)) {
      shouldAlign = true;
    }
  }
  return shouldAlign;
}

// Find the first frag in the previous level which matches the CC of the first frag of the new level
export function findDiscontinuousReferenceFrag (prevDetails, curDetails) {
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

export function adjustPts (sliding, details) {
  details.fragments.forEach((frag) => {
    if (frag) {
      let start = frag.start + sliding;
      frag.start = frag.startPTS = start;
      frag.endPTS = start + frag.duration;
    }
  });
  details.PTSKnown = true;
}

/**
 * Using the parameters of the last level, this function computes PTS' of the new fragments so that they form a
 * contiguous stream with the last fragments.
 * The PTS of a fragment lets Hls.js know where it fits into a stream - by knowing every PTS, we know which fragment to
 * download at any given time. PTS is normally computed when the fragment is demuxed, so taking this step saves us time
 * and an extra download.
 * @param lastFrag
 * @param lastLevel
 * @param details
 */
export function alignStream (lastFrag, lastLevel, details) {
  alignDiscontinuities(lastFrag, details, lastLevel);
  if (!details.PTSKnown && lastLevel) {
    // If the PTS wasn't figured out via discontinuity sequence that means there was no CC increase within the level.
    // Aligning via Program Date Time should therefore be reliable, since PDT should be the same within the same
    // discontinuity sequence.
    alignPDT(details, lastLevel.details);
  }
}

/**
 * Computes the PTS if a new level's fragments using the PTS of a fragment in the last level which shares the same
 * discontinuity sequence.
 * @param lastLevel - The details of the last loaded level
 * @param details - The details of the new level
 */
export function alignDiscontinuities (lastFrag, details, lastLevel) {
  if (shouldAlignOnDiscontinuities(lastFrag, lastLevel, details)) {
    const referenceFrag = findDiscontinuousReferenceFrag(lastLevel.details, details);
    if (referenceFrag) {
      logger.log('Adjusting PTS using last level due to CC increase within current level');
      adjustPts(referenceFrag.start, details);
    }
  }
}

/**
 * Computes the PTS of a new level's fragments using the difference in Program Date Time from the last level.
 * @param details - The details of the new level
 * @param lastDetails - The details of the last loaded level
 */
export function alignPDT (details, lastDetails) {
  if (lastDetails && lastDetails.fragments.length) {
    if (!details.hasProgramDateTime || !lastDetails.hasProgramDateTime) {
      return;
    }
    // if last level sliding is 1000 and its first frag PROGRAM-DATE-TIME is 2017-08-20 1:10:00 AM
    // and if new details first frag PROGRAM DATE-TIME is 2017-08-20 1:10:08 AM
    // then we can deduce that playlist B sliding is 1000+8 = 1008s
    let lastPDT = lastDetails.fragments[0].programDateTime;
    let newPDT = details.fragments[0].programDateTime;
    // date diff is in ms. frag.start is in seconds
    let sliding = (newPDT - lastPDT) / 1000 + lastDetails.fragments[0].start;
    if (Number.isFinite(sliding)) {
      logger.log(`adjusting PTS using programDateTime delta, sliding:${sliding.toFixed(3)}`);
      adjustPts(sliding, details);
    }
  }
}
