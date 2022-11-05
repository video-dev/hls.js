import { logger } from './logger';
import { adjustSliding } from '../controller/level-helper';

import type { Fragment } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type { Level } from '../types/level';
import type { RequiredProperties } from '../types/general';

export function findFirstFragWithCC(fragments: Fragment[], cc: number) {
  let firstFrag: Fragment | null = null;

  for (let i = 0, len = fragments.length; i < len; i++) {
    const currentFrag = fragments[i];
    if (currentFrag && currentFrag.cc === cc) {
      firstFrag = currentFrag;
      break;
    }
  }

  return firstFrag;
}

export function shouldAlignOnDiscontinuities(
  lastFrag: Fragment | null,
  lastLevel: Level,
  details: LevelDetails
): lastLevel is RequiredProperties<Level, 'details'> {
  if (lastLevel.details) {
    if (
      details.endCC > details.startCC ||
      (lastFrag && lastFrag.cc < details.startCC)
    ) {
      return true;
    }
  }
  return false;
}

// Find the first frag in the previous level which matches the CC of the first frag of the new level
export function findDiscontinuousReferenceFrag(
  prevDetails: LevelDetails,
  curDetails: LevelDetails,
  referenceIndex: number = 0
) {
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

function adjustFragmentStart(frag: Fragment, sliding: number) {
  if (frag) {
    const start = frag.start + sliding;
    frag.start = frag.startPTS = start;
    frag.endPTS = start + frag.duration;
  }
}

export function adjustSlidingStart(sliding: number, details: LevelDetails) {
  // Update segments
  const fragments = details.fragments;
  for (let i = 0, len = fragments.length; i < len; i++) {
    adjustFragmentStart(fragments[i], sliding);
  }
  // Update LL-HLS parts at the end of the playlist
  if (details.fragmentHint) {
    adjustFragmentStart(details.fragmentHint, sliding);
  }
  details.alignedSliding = true;
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
export function alignStream(
  lastFrag: Fragment | null,
  lastLevel: Level | null,
  details: LevelDetails
) {
  if (!lastLevel) {
    return;
  }
  alignDiscontinuities(lastFrag, details, lastLevel);
  if (!details.alignedSliding && lastLevel.details) {
    // If the PTS wasn't figured out via discontinuity sequence that means there was no CC increase within the level.
    // Aligning via Program Date Time should therefore be reliable, since PDT should be the same within the same
    // discontinuity sequence.
    alignPDT(details, lastLevel.details);
  }
  if (
    !details.alignedSliding &&
    lastLevel.details &&
    !details.skippedSegments
  ) {
    // Try to align on sn so that we pick a better start fragment.
    // Do not perform this on playlists with delta updates as this is only to align levels on switch
    // and adjustSliding only adjusts fragments after skippedSegments.
    adjustSliding(lastLevel.details, details);
  }
}

/**
 * Computes the PTS if a new level's fragments using the PTS of a fragment in the last level which shares the same
 * discontinuity sequence.
 * @param lastFrag - The last Fragment which shares the same discontinuity sequence
 * @param lastLevel - The details of the last loaded level
 * @param details - The details of the new level
 */
function alignDiscontinuities(
  lastFrag: Fragment | null,
  details: LevelDetails,
  lastLevel: Level
) {
  if (shouldAlignOnDiscontinuities(lastFrag, lastLevel, details)) {
    const referenceFrag = findDiscontinuousReferenceFrag(
      lastLevel.details,
      details
    );
    if (referenceFrag && Number.isFinite(referenceFrag.start)) {
      logger.log(
        `Adjusting PTS using last level due to CC increase within current level ${details.url}`
      );
      adjustSlidingStart(referenceFrag.start, details);
    }
  }
}

/**
 * Computes the PTS of a new level's fragments using the difference in Program Date Time from the last level.
 * @param details - The details of the new level
 * @param lastDetails - The details of the last loaded level
 */
export function alignPDT(details: LevelDetails, lastDetails: LevelDetails) {
  // This check protects the unsafe "!" usage below for null program date time access.
  if (
    !lastDetails.fragments.length ||
    !details.hasProgramDateTime ||
    !lastDetails.hasProgramDateTime
  ) {
    return;
  }
  // if last level sliding is 1000 and its first frag PROGRAM-DATE-TIME is 2017-08-20 1:10:00 AM
  // and if new details first frag PROGRAM DATE-TIME is 2017-08-20 1:10:08 AM
  // then we can deduce that playlist B sliding is 1000+8 = 1008s
  const lastPDT = lastDetails.fragments[0].programDateTime!; // hasProgramDateTime check above makes this safe.
  const newPDT = details.fragments[0].programDateTime!;
  // date diff is in ms. frag.start is in seconds
  const sliding = (newPDT - lastPDT) / 1000 + lastDetails.fragments[0].start;
  if (sliding && Number.isFinite(sliding)) {
    logger.log(
      `Adjusting PTS using programDateTime delta ${
        newPDT - lastPDT
      }ms, sliding:${sliding.toFixed(3)} ${details.url} `
    );
    adjustSlidingStart(sliding, details);
  }
}

/**
 * Ensures appropriate time-alignment between renditions based on PDT. Unlike `alignPDT`, which adjusts
 * the timeline based on the delta between PDTs of the 0th fragment of two playlists/`LevelDetails`,
 * this function assumes the timelines represented in `refDetails` are accurate, including the PDTs,
 * and uses the "wallclock"/PDT timeline as a cross-reference to `details`, adjusting the presentation
 * times/timelines of `details` accordingly.
 * Given the asynchronous nature of fetches and initial loads of live `main` and audio/subtitle tracks,
 * the primary purpose of this function is to ensure the "local timelines" of audio/subtitle tracks
 * are aligned to the main/video timeline, using PDT as the cross-reference/"anchor" that should
 * be consistent across playlists, per the HLS spec.
 * @param details - The details of the rendition you'd like to time-align (e.g. an audio rendition).
 * @param refDetails - The details of the reference rendition with start and PDT times for alignment.
 */
export function alignMediaPlaylistByPDT(
  details: LevelDetails,
  refDetails: LevelDetails
) {
  if (!details.hasProgramDateTime || !refDetails.hasProgramDateTime) {
    return;
  }

  const fragments = details.fragments;
  const refFragments = refDetails.fragments;
  if (!fragments.length || !refFragments.length) {
    return;
  }

  // Calculate a delta to apply to all fragments according to the delta in PDT times and start times
  // of a fragment in the reference details, and a fragment in the target details of the same discontinuity.
  // If a fragment of the same discontinuity was not found use the middle fragment of both.
  const middleFrag = Math.round(refFragments.length / 2) - 1;
  const refFrag = refFragments[middleFrag];
  const frag =
    findFirstFragWithCC(fragments, refFrag.cc) ||
    fragments[Math.round(fragments.length / 2) - 1];

  const refPDT = refFrag.programDateTime;
  const targetPDT = frag.programDateTime;
  if (refPDT === null || targetPDT === null) {
    return;
  }

  const delta = (targetPDT - refPDT) / 1000 - (frag.start - refFrag.start);
  adjustSlidingStart(delta, details);
}
