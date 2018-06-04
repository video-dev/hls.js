import BinarySearch from '../utils/binary-search';

/**
 * Calculates the PDT of the next load position.
 * bufferEnd in this function is usually the position of the playhead.
 * @param {number} [start = 0] - The PTS of the first fragment within the level
 * @param {number} [bufferEnd = 0] - The end of the contiguous buffered range the playhead is currently within
 * @param {*} levelDetails - An object containing the parsed and computed properties of the currently playing level
 * @returns {number} nextPdt - The computed PDT
 */
export function calculateNextPDT (start = 0, bufferEnd = 0, levelDetails) {
  let pdt = 0;
  if (levelDetails.programDateTime) {
    const parsedDateInt = Date.parse(levelDetails.programDateTime);
    if (!isNaN(parsedDateInt)) {
      pdt = (bufferEnd * 1000) + parsedDateInt - (1000 * start);
    }
  }
  return pdt;
}

/**
 * Finds the first fragment whose endPDT value exceeds the given PDT.
 * @param {Array<Fragment>} fragments - The array of candidate fragments
 * @param {number|null} [PDTValue = null] - The PDT value which must be exceeded
 * @returns {*|null} fragment - The best matching fragment
 */
export function findFragmentByPDT (fragments, PDTValue = null) {
  if (!Array.isArray(fragments) || !fragments.length || PDTValue === null) {
    return null;
  }

  // if less than start
  let firstSegment = fragments[0];

  if (PDTValue < firstSegment.pdt) {
    return null;
  }

  let lastSegment = fragments[fragments.length - 1];

  if (PDTValue >= lastSegment.endPdt) {
    return null;
  }

  for (let seg = 0; seg < fragments.length; ++seg) {
    let frag = fragments[seg];
    if (PDTValue < frag.endPdt) {
      return frag;
    }
  }
  return null;
}

/**
 * Finds a fragment based on the SN of the previous fragment; or based on the needs of the current buffer.
 * This method compensates for small buffer gaps by applying a tolerance to the start of any candidate fragment, thus
 * breaking any traps which would cause the same fragment to be continuously selected within a small range.
 * @param {*} fragPrevious - The last frag successfully appended
 * @param {Array<Fragment>} fragments - The array of candidate fragments
 * @param {number} [bufferEnd = 0] - The end of the contiguous buffered range the playhead is currently within
 * @param {number} [end = 0] - The computed end time of the stream
 * @param {number} maxFragLookUpTolerance - The amount of time that a fragment's start can be within in order to be considered contiguous
 * @returns {*} foundFrag - The best matching fragment
 */
export function findFragmentBySN (fragPrevious, fragments, bufferEnd = 0, end = 0, maxFragLookUpTolerance = 0) {
  let foundFrag;
  const fragNext = fragPrevious ? fragments[fragPrevious.sn - fragments[0].sn + 1] : null;
  if (bufferEnd < end) {
    if (bufferEnd > end - maxFragLookUpTolerance) {
      maxFragLookUpTolerance = 0;
    }

    // Prefer the next fragment if it's within tolerance
    if (fragNext && !fragmentWithinToleranceTest(bufferEnd, maxFragLookUpTolerance, fragNext)) {
      foundFrag = fragNext;
    } else {
      foundFrag = BinarySearch.search(fragments, fragmentWithinToleranceTest.bind(null, bufferEnd, maxFragLookUpTolerance));
    }
  }
  return foundFrag;
}

/**
 * The test function used by the findFragmentBySn's BinarySearch to look for the best match to the current buffer conditions.
 * @param {*} candidate - The fragment to test
 * @param {number} [bufferEnd = 0] - The end of the current buffered range the playhead is currently within
 * @param {number} [maxFragLookUpTolerance = 0] - The amount of time that a fragment's start can be within in order to be considered contiguous
 * @returns {number} - 0 if it matches, 1 if too low, -1 if too high
 */
export function fragmentWithinToleranceTest (bufferEnd = 0, maxFragLookUpTolerance = 0, candidate) {
  // offset should be within fragment boundary - config.maxFragLookUpTolerance
  // this is to cope with situations like
  // bufferEnd = 9.991
  // frag[Ø] : [0,10]
  // frag[1] : [10,20]
  // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
  //              frag start               frag start+duration
  //                  |-----------------------------|
  //              <--->                         <--->
  //  ...--------><-----------------------------><---------....
  // previous frag         matching fragment         next frag
  //  return -1             return 0                 return 1
  // logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
  // Set the lookup tolerance to be small enough to detect the current segment - ensures we don't skip over very small segments
  let candidateLookupTolerance = Math.min(maxFragLookUpTolerance, candidate.duration + (candidate.deltaPTS ? candidate.deltaPTS : 0));
  if (candidate.start + candidate.duration - candidateLookupTolerance <= bufferEnd) {
    return 1;
  } else if (candidate.start - candidateLookupTolerance > bufferEnd && candidate.start) {
    // if maxFragLookUpTolerance will have negative value then don't return -1 for first element
    return -1;
  }

  return 0;
}
