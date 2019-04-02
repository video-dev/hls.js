
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
  if (track && track.cues) {
    while (track.cues.length > 0) {
      track.removeCue(track.cues[0]);
    }
  }
}
