import { logger } from './logger';

export function sendAddTrackEvent (track, videoEl) {
  let event = null;
  try {
    event = new window.Event('addtrack');
  } catch (err) {
    // for IE11
    event = document.createEvent('Event');
    event.initEvent('addtrack', false, false);
  }
  event.track = track;
  videoEl.dispatchEvent(event);
}

function canManageCues (track) {
  return track && track.cues;
}

export function clearCurrentCues (track) {
  if (canManageCues(track)) {
    while (track.cues.length > 0) {
      track.removeCue(track.cues[0]);
    }
  }
}

/**
 * Removes cues past the given playback time (Cue's end time is less
 * than time value) from a given track.
 *
 * @param {TextTrack} track         Text track to remove cues from.
 * @param {Number}    playheadTime  Playhead time anchor for past cue decision.
 */
export function clearPastCues (track, playheadTime) {
  if (canManageCues(track) && playheadTime > 0) {
    try {
      while (track.cues.length > 0 && track.cues[0].endTime < playheadTime) {
        track.removeCue(track.cues[0]);
      }
    } catch (error) {
      logger.warn('failed to remove cues', error);
    }
  }
}
