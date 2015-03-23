  function showMetrics()  {
    var width = window.innerWidth-30;
      document.getElementById('videoEvent_c').width =
      document.getElementById('loadEvent_c').width =
      document.getElementById('bufferWindow_c').width =
      document.getElementById('positionWindow_c').width =
      document.getElementById('bufferTimerange_c').width =
      document.getElementById('positionTimerange_c').width =  width;
      document.getElementById('bufferWindow_c').style.display=
      document.getElementById('positionWindow_c').style.display=
      document.getElementById('bufferTimerange_c').style.display=
      document.getElementById('positionTimerange_c').style.display =
      document.getElementById('videoEvent_c').style.display =
      document.getElementById('loadEvent_c').style.display= "block";
  }


  function hideMetrics()  {
      document.getElementById('bufferWindow_c').style.display=
      document.getElementById('positionWindow_c').style.display=
      document.getElementById('bufferTimerange_c').style.display=
      document.getElementById('positionTimerange_c').style.display =
      document.getElementById('videoEvent_c').style.display =
      document.getElementById('loadEvent_c').style.display= "none";
  }

  function timeRangeSetSliding(duration) {
    windowDuration = duration;
    windowSliding = true;
    refreshCanvas();
  }

var timeRangeMouseDown=false;
 function timeRangeCanvasonMouseDown(evt) {
    var canvas = evt.currentTarget,
        bRect = canvas.getBoundingClientRect(),
        mouseX = Math.round((evt.clientX - bRect.left)*(canvas.width/bRect.width));
    windowStart = Math.max(0,Math.round((mouseX-eventLeftMargin) * getWindowTimeRange().now / (canvas.width-eventLeftMargin)));
    windowEnd = windowStart+500;
    timeRangeMouseDown = true;
    windowSliding = false;
    //console.log('windowStart/windowEnd:' + '/' + windowStart + '/' + windowEnd);
    document.getElementById('windowStart').value=windowStart;
    document.getElementById('windowEnd').value=windowEnd;
    refreshCanvas();
 }

 function timeRangeCanvasonMouseMove(evt) {
    if(timeRangeMouseDown) {
      var canvas = evt.currentTarget,
          bRect = canvas.getBoundingClientRect(),
          mouseX = Math.round((evt.clientX - bRect.left)*(canvas.width/bRect.width)),
          pos = Math.max(0,Math.round((mouseX-eventLeftMargin) * getWindowTimeRange().now / (canvas.width-eventLeftMargin)));
      if(pos < windowStart) {
        windowStart = pos;
      } else {
        windowEnd = pos;
      }
      if(windowStart === windowEnd) {
        // to avoid division by zero ...
        windowEnd +=50;
      }
      //console.log('windowStart/windowEnd:' + '/' + windowStart + '/' + windowEnd);
      document.getElementById('windowStart').value=windowStart;
      document.getElementById('windowEnd').value=windowEnd;
      refreshCanvas();
    }
 }

 function timeRangeCanvasonMouseUp(evt) {
  timeRangeMouseDown = false;
 }

 function timeRangeCanvasonMouseOut(evt) {
  timeRangeMouseDown = false;
 }

var windowDuration=20000,windowSliding=true,windowStart=0,windowEnd=10000;
document.getElementById('windowStart').value=windowStart;document.getElementById('windowEnd').value=windowEnd;
  function refreshCanvas()  {
    try {
      var windowTime = getWindowTimeRange();
      canvasBufferTimeRangeUpdate(document.getElementById('bufferTimerange_c'), 0, windowTime.now, windowTime.min,windowTime.max, events.buffer);
      canvasPositionTimeRangeUpdate(document.getElementById('positionTimerange_c'), 0, windowTime.now, windowTime.min,windowTime.max, events.buffer);
      canvasBufferWindowUpdate(document.getElementById('bufferWindow_c'), windowTime.min,windowTime.max, events.buffer);
      canvasPositionWindowUpdate(document.getElementById('positionWindow_c'), windowTime.min,windowTime.max, events.buffer);
      canvasVideoEventUpdate(document.getElementById('videoEvent_c'), windowTime.min,windowTime.max, events.video);
      canvasLoadEventUpdate(document.getElementById('loadEvent_c'), windowTime.min,windowTime.max, events.load);
    } catch(err) {
      console.log("refreshCanvas error:" +err.message);
    }
  }

  function getWindowTimeRange() {
      var tnow,minTime,maxTime;
      if(events.buffer.length) {
        tnow = events.buffer[events.buffer.length-1].time;
      } else {
        tnow = 0;
      }
      if(windowSliding) {
        // let's show the last 60s from current time
        if(windowDuration) {
          minTime = Math.max(0, tnow-windowDuration),
          maxTime = Math.min(minTime + windowDuration, tnow);
        } else {
          minTime = 0;
          maxTime = tnow;
        }
      } else {
        minTime = windowStart;
        maxTime = windowEnd;
      }
      return { min : minTime, max: maxTime, now : tnow}
  }

function timeRangeZoomIn() {
  if(windowSliding) {
    windowDuration/=2;
  } else {
    var duration = windowEnd-windowStart;
    windowStart+=duration/4;
    windowEnd-=duration/4;
    if(windowStart === windowEnd) {
      windowEnd+=50;
    }
  }
  document.getElementById('windowStart').value=windowStart;
  document.getElementById('windowEnd').value=windowEnd;
  refreshCanvas();
}

function timeRangeZoomOut() {
  if(windowSliding) {
    windowDuration*=2;
  }  else {
    var duration = windowEnd-windowStart;
    windowStart-=duration/2;
    windowEnd+=duration/2;
    windowStart=Math.max(0,windowStart);
    windowEnd=Math.min(events.buffer[events.buffer.length-1].time,windowEnd);
  }
  document.getElementById('windowStart').value=windowStart;
  document.getElementById('windowEnd').value=windowEnd;
  refreshCanvas();
}

function timeRangeSlideLeft() {
  var duration = windowEnd-windowStart;
  windowStart-=duration/4;
  windowEnd-=duration/4;
  windowStart=Math.max(0,windowStart);
  windowEnd=Math.min(events.buffer[events.buffer.length-1].time,windowEnd);
  document.getElementById('windowStart').value=windowStart;
  document.getElementById('windowEnd').value=windowEnd;
  refreshCanvas();
}

function timeRangeSlideRight() {
  var duration = windowEnd-windowStart;
  windowStart+=duration/4;
  windowEnd+=duration/4;
  windowStart=Math.max(0,windowStart);
  windowEnd=Math.min(events.buffer[events.buffer.length-1].time,windowEnd);
  document.getElementById('windowStart').value=windowStart;
  document.getElementById('windowEnd').value=windowEnd;
  refreshCanvas();
}


