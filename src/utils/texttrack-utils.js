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

export function clearCurrentCues (track) {
  if (track && track.cues) {
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
  if (track && track.cues && playheadTime > 0) {
    try {
      while (track.cues.length > 0 && track.cues[0].endTime < playheadTime) {
        track.removeCue(track.cues[0]);
      }
    } catch (error) {
      logger.warn('failed to remove cues', error);
    }
  }
}

const cuesCleanupSchedule = new Map();

/**
 * Schedules past cues cleanup after given throttle amount of seconds, updates
 * playhead time for cleanup if cleanup was previously scheduled.
 *
 * E.g. with throttle = 30
 *
 * t=0, clearPastCuesThrottled with playheadTime = 15
 *
 * t=10, clearPclearPastCuesThrottled with playheadTime = 25
 *
 * t=30, past cues cleanup executed with playheadTime = 25
 *
 *
 * @param {TextTrack} track           Text track for cues cleanup.
 * @param {Number}    playheadTime    Playhead time anchor for past cue decision.
 * @param {Number}    pastCuesLength  Length of the cues "back buffer".
 * @param {Number}    [throttle=30]   Throttle duration in seconds.
 */
export function clearPastCuesThrottled (track, playheadTime, pastCuesLength, throttle = 30) {
  if (isFinite(pastCuesLength) === false) {
    return;
  }

  if ((playheadTime - pastCuesLength) > 0) {
    // don't schedule cleanup if it's already scheduled
    if (!cuesCleanupSchedule.has(track)) {
      const timeoutId = setTimeout(() => {
        clearPastCues(track, cuesCleanupSchedule.get(track).playheadTime - pastCuesLength);
        cuesCleanupSchedule.delete(track);
      }, throttle * 1000);

      cuesCleanupSchedule.set(track, { timeoutId, playheadTime });
    } else { // update playhead time for scheduled cleanup
      cuesCleanupSchedule.get(track).playheadTime = playheadTime;
    }
  }
}
