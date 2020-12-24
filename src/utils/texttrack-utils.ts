export function sendAddTrackEvent(track: TextTrack, videoEl: HTMLMediaElement) {
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

export function clearCurrentCues(track: TextTrack) {
  if (track?.cues) {
    // When track.mode is disabled, track.cues will be null.
    // To guarantee the removal of cues, we need to temporarily
    // change the mode to hidden
    if (track.mode === 'disabled') {
      track.mode = 'hidden';
    }
    while (track.cues.length > 0) {
      track.removeCue(track.cues[0]);
    }
  }
}

// Find first cue starting after given time.
// Modified version of binary search O(log(n)).
function getFirstCueIndexAfterTime(
  cues: TextTrackCueList | TextTrackCue[],
  time: number
): number {
  // If first cue starts after time, start there
  if (time < cues[0].startTime) {
    return 0;
  }
  // If the last cue ends before time there is no overlap
  if (time > cues[cues.length - 1].endTime) {
    return -1;
  }

  let left = 0;
  let right = cues.length - 1;

  while (left <= right) {
    const mid = Math.floor((right + left) / 2);

    if (time < cues[mid].startTime) {
      right = mid - 1;
    } else if (time > cues[mid].startTime) {
      left = mid + 1;
    } else {
      // If it's not lower or higher, it must be equal.
      return mid;
    }
  }
  // At this point, left and right have swapped.
  // No direct match was found, left or right element must be the closest. Check which one has the smallest diff.
  return cues[left].startTime - time < time - cues[right].startTime
    ? left
    : right;
}

export function getCuesInRange(
  cues: TextTrackCueList | TextTrackCue[],
  start: number,
  end: number
): TextTrackCue[] {
  const cuesFound: TextTrackCue[] = [];
  const firstCueInRange = getFirstCueIndexAfterTime(cues, start);
  if (firstCueInRange > -1) {
    for (let i = firstCueInRange, len = cues.length; i < len; i++) {
      const cue = cues[i];
      if (cue.startTime >= start && cue.endTime <= end) {
        cuesFound.push(cue);
      } else if (cue.startTime > end) {
        return cuesFound;
      }
    }
  }
  return cuesFound;
}
