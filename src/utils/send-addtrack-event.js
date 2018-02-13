
export default function sendAddTrackEvent(track, videoEl) {
  var event = null;
  try {
    event = new window.Event('addtrack');
  } catch(err) {
    //for IE11
    event = document.createEvent('Event');
    event.initEvent('addtrack', false, false);
  }
  event.track = track;
  videoEl.dispatchEvent(event);
}
