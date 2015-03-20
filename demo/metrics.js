  function showMetrics()  {
      document.getElementById('event_c').width = window.innerWidth-30;
      document.getElementById('buffertime_c').width = window.innerWidth-30;
      document.getElementById('timerange_c').width = window.innerWidth-30;
      document.getElementById('buffertime_c').style.display="block";
      document.getElementById('timerange_c').style.display="block";
      document.getElementById('event_c').style.display="block";
  }

  function hideMetrics()  {
      document.getElementById('buffertime_c').style.display="none";
      document.getElementById('timerange_c').style.display="none";
      document.getElementById('event_c').style.display="none";
  }

  function timeRangeSetSliding(duration) {
    windowDuration = duration;
    windowSliding = true;
    refreshCanvas();
  }


var timeRangeMouseDown=false;
 function timeRangeCanvasonMouseDown(evt) {
    var canvas = document.getElementById('timerange_c'),
        bRect = canvas.getBoundingClientRect(),
        mouseX = Math.round((evt.clientX - bRect.left)*(canvas.width/bRect.width));
    windowStart = Math.round(mouseX * getWindowTimeRange().now / canvas.width);
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
      var canvas = document.getElementById('timerange_c'),
          bRect = canvas.getBoundingClientRect(),
          mouseX = Math.round((evt.clientX - bRect.left)*(canvas.width/bRect.width)),
          pos = Math.round(mouseX * getWindowTimeRange().now / canvas.width);
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
      canvasLoadUpdate(document.getElementById('event_c'), windowTime.min,windowTime.max, events.load);
      canvasBufferUpdate(document.getElementById('buffertime_c'), windowTime.min,windowTime.max, events.buffer);
      canvasTimeRangeUpdate(document.getElementById('timerange_c'), 0, windowTime.now, windowTime.min,windowTime.max, events.buffer);
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
