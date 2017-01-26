/**
 * Level Helper class, providing methods dealing with playlist sliding and drift
*/

import {logger} from '../utils/logger';

class LevelHelper {

  static mergeDetails(oldDetails,newDetails) {
    var startSn = Math.max(oldDetails.startSN,newDetails.startSN)-newDetails.startSN,
        endSn = Math.min(oldDetails.endSN,newDetails.endSN)-newDetails.startSN,
        delta = newDetails.startSN - oldDetails.startSN,
        oldfragments = oldDetails.fragments,
        newfragments = newDetails.fragments,
        ccOffset =0,
        PTSFrag;

    // check if old/new playlists have fragments in common
    if (endSn < startSn) {
      newDetails.PTSKnown = false;
      return;
    }
    // loop through overlapping SN and update startPTS , cc, and duration if any found
    for(var i = startSn ; i <= endSn ; i++) {
      var oldFrag = oldfragments[delta+i],
          newFrag = newfragments[i];
      if (newFrag && oldFrag) {
        ccOffset = oldFrag.cc - newFrag.cc;
        if (!isNaN(oldFrag.startPTS)) {
          newFrag.start = newFrag.startPTS = oldFrag.startPTS;
          newFrag.endPTS = oldFrag.endPTS;
          newFrag.duration = oldFrag.duration;
          PTSFrag = newFrag;
        }
      }
    }

    if(ccOffset) {
      logger.log(`discontinuity sliding from playlist, take drift into account`);
      for(i = 0 ; i < newfragments.length ; i++) {
        newfragments[i].cc += ccOffset;
      }
    }

    // if at least one fragment contains PTS info, recompute PTS information for all fragments
    if(PTSFrag) {
      LevelHelper.updateFragPTSDTS(newDetails,PTSFrag.sn,PTSFrag.startPTS,PTSFrag.endPTS,PTSFrag.startDTS,PTSFrag.endDTS);
    } else {
      // ensure that delta is within oldfragments range
      // also adjust sliding in case delta is 0 (we could have old=[50-60] and new=old=[50-61])
      // in that case we also need to adjust start offset of all fragments
      if (delta >= 0 && delta < oldfragments.length) {
        // adjust start by sliding offset
        var sliding = oldfragments[delta].start;
        for(i = 0 ; i < newfragments.length ; i++) {
          newfragments[i].start += sliding;
        }
      }
    }
    // if we are here, it means we have fragments overlapping between
    // old and new level. reliable PTS info is thus relying on old level
    newDetails.PTSKnown = oldDetails.PTSKnown;
    return;
  }

  static updateFragPTSDTS(details,sn,startPTS,endPTS,startDTS,endDTS) {
    var fragIdx, fragments, frag, i;
    // exit if sn out of range
    if (!details || sn < details.startSN || sn > details.endSN) {
      return 0;
    }
    fragIdx = sn - details.startSN;
    fragments = details.fragments;
    frag = fragments[fragIdx];
    if(!isNaN(frag.startPTS)) {
      // delta PTS between audio and video
      let deltaPTS = Math.abs(frag.startPTS-startPTS);
      if (isNaN(frag.deltaPTS)) {
        frag.deltaPTS = deltaPTS;
      } else {
        frag.deltaPTS = Math.max(deltaPTS,frag.deltaPTS);
      }
      startPTS = Math.min(startPTS,frag.startPTS);
      endPTS = Math.max(endPTS, frag.endPTS);
      startDTS = Math.min(startDTS,frag.startDTS);
      endDTS = Math.max(endDTS, frag.endDTS);
    }

    var drift = startPTS - frag.start;

    frag.start = frag.startPTS = startPTS;
    frag.endPTS = endPTS;
    frag.startDTS = startDTS;
    frag.endDTS = endDTS;
    frag.duration = endPTS - startPTS;
    // adjust fragment PTS/duration from seqnum-1 to frag 0
    for(i = fragIdx ; i > 0 ; i--) {
      LevelHelper.updatePTS(fragments,i,i-1);
    }

    // adjust fragment PTS/duration from seqnum to last frag
    for(i = fragIdx ; i < fragments.length - 1 ; i++) {
      LevelHelper.updatePTS(fragments,i,i+1);
    }
    details.PTSKnown = true;
    //logger.log(`                                            frag start/end:${startPTS.toFixed(3)}/${endPTS.toFixed(3)}`);

    return drift;
  }

  static updatePTS(fragments,fromIdx, toIdx) {
    var fragFrom = fragments[fromIdx],fragTo = fragments[toIdx], fragToPTS = fragTo.startPTS;
    // if we know startPTS[toIdx]
    if(!isNaN(fragToPTS)) {
      // update fragment duration.
      // it helps to fix drifts between playlist reported duration and fragment real duration
      if (toIdx > fromIdx) {
        fragFrom.duration = fragToPTS-fragFrom.start;
        if(fragFrom.duration < 0) {
          logger.warn(`negative duration computed for frag ${fragFrom.sn},level ${fragFrom.level}, there should be some duration drift between playlist and fragment!`);
        }
      } else {
        fragTo.duration = fragFrom.start - fragToPTS;
        if(fragTo.duration < 0) {
          logger.warn(`negative duration computed for frag ${fragTo.sn},level ${fragTo.level}, there should be some duration drift between playlist and fragment!`);
        }
      }
    } else {
      // we dont know startPTS[toIdx]
      if (toIdx > fromIdx) {
        fragTo.start = fragFrom.start + fragFrom.duration;
      } else {
        fragTo.start = fragFrom.start - fragTo.duration;
      }
    }
  }

  static adjustPtsByReference(referenceFrag, details) {
    if (!details.fragments || !referenceFrag) {
      return;
    }
    details.fragments.forEach(frag => {
      if (frag) {
        console.info(`oldStart ${frag.start}`);
        frag.duration = referenceFrag.duration;
        frag.start = frag.startPTS = referenceFrag.startPTS + frag.start;
        console.info(`newStart ${frag.start}`);
        frag.endPTS = referenceFrag.endPTS + frag.duration;
      }
    });
    details.PTSKnown = true;
  }

  static alignPTSByCC(prevDetails, curDetails) {
    const prevFrags = prevDetails.fragments;
    const curFrags = curDetails.fragments;

    // Find the first frag in the previous level which matches the starting CC
    const startCC = curFrags[0].cc;
    const prevStartFrag = prevFrags.find(frag => {
      return frag.cc === startCC;
    });

    if (!prevStartFrag || (prevStartFrag && !prevStartFrag.startPTS)) {
      console.info('No frag in previous level to align on');
      return;
    }

    LevelHelper.adjustPtsByReference(prevStartFrag, curDetails);
  }
}

export default LevelHelper;
