export function sendAddTrackEvent (track: TextTrack, videoEl: HTMLMediaElement) {
  let event: Event;
  try {
    event = new Event('addtrack');
  } catch (err) {
    // for IE11
    event = document.createEvent('Event');
    event.initEvent('addtrack', false, false);
  }
  (event as any).track = track;
  videoEl.dispatchEvent(event);
}

export function clearCurrentCues (track: TextTrack) {
  if (track) {
    const trackMode = track.mode;

    // When track.mode is disabled, track.cues will be null.
    // To guarantee the removal of cues, we need to temporarily
    // change the mode to hidden
    if (trackMode === 'disabled') {
      track.mode = 'hidden';
    }

    while (track.cues && track.cues.length > 0) {
      track.removeCue(track.cues[0]);
    }
  }
}
