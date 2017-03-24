import {logger} from '../utils/logger';

const shouldAlignOnDiscontinuities = function (lastFrag, lastLevel, details) {
  let shouldAlign = false;
  if (lastLevel && lastLevel.details && details) {
    if (details.endCC > details.startCC || (lastFrag && lastFrag.cc < details.startCC)) {
      shouldAlign = true;
    }
  }
  return shouldAlign;
};

// Find the first frag in the previous level which matches the CC of the first frag of the new level
const findDiscontinuousReferenceFrag = function (prevDetails, curDetails) {
  const prevFrags = prevDetails.fragments;
  const curFrags = curDetails.fragments;

  if (!curFrags.length || !prevFrags.length) {
    logger.log('No fragments to align');
    return;
  }

  const prevStartFrag = prevFrags.find(frag => {
    return frag.cc === curFrags[0].cc;
  });

  if (!prevStartFrag || (prevStartFrag && !prevStartFrag.startPTS)) {
    logger.log('No frag in previous level to align on');
    return;
  }

  return prevStartFrag;
};

const adjustPtsByReferenceFrag = function(referenceFrag, details) {
  if (!referenceFrag) {
    return;
  }

  details.fragments.forEach((frag, index) => {
    if (frag) {
      frag.duration = referenceFrag.duration;
      frag.end = frag.endPTS = referenceFrag.endPTS + (frag.duration * index);
      frag.start = frag.startPTS = referenceFrag.startPTS + frag.start;
    }
  });
  details.PTSKnown = true;
};


// If a change in CC is detected, the PTS can no longer be relied upon
// Attempt to align the level by using the last level - find the last frag matching the current CC and use it's PTS
// as a reference
export default function alignDiscontinuities(lastFrag, lastLevel, details) {
  if (shouldAlignOnDiscontinuities(lastFrag, lastLevel, details)) {
    logger.log('Adjusting PTS using last level due to CC increase within current level');
    const referenceFrag = findDiscontinuousReferenceFrag(lastLevel.details, details);
    adjustPtsByReferenceFrag(referenceFrag, details);
  }
}
