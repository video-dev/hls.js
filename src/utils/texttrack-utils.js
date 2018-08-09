
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
  if (track) {
    let trackMode = track.mode;

    // When track.mode is disabled, track.cues will be null.
    // To guarantee the removal of cues, we need to temporarily
    // change the mode to hidden
    if (trackMode === 'disabled')
      track.mode = 'hidden';

    while (track.cues && track.cues.length > 0) {
      track.removeCue(track.cues[0]);
    }
  }
}
