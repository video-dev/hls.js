
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
 * @param {Number}    maxEndTime  Time anchor for past cue decision.
 */
export function clearPastCues (track, maxEndTime) {
  if (track && track.cues && maxEndTime > 0) {
    while (track.cues.length > 0 && track.cues[0].endTime < maxEndTime) {
      track.removeCue(track.cues[0]);
    }
  }
}
