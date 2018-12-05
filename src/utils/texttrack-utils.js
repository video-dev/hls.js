
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

export function sendRemoveTrackEvent (track, videoEl) {
  // As of 05/2018 there is no working browser removetrack event
  // Disabling the track doesn't remove it but does signify it isn't in use
  track.mode = 'disabled';
}

export function clearCurrentCues (track) {
  if (track && track.cues) {
    while (track.cues.length > 0) {
      track.removeCue(track.cues[0]);
    }
  }
}
