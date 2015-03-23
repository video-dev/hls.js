
  var eventLeftMargin = 180;
  var eventRightMargin = 0;

  function canvasLoadEventUpdate(canvas, minTime, maxTime, events) {
    var ctx = canvas.getContext('2d');
    for (var i =0, y_offset = 20; i < events.length; i++) {
      var event = events[i], start = event.time, end = event.time + event.duration + event.latency;
      if((start >= minTime && start <= maxTime)) {
        y_offset+=20;
      }
    }
    canvas.height = y_offset;

    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0,0,eventLeftMargin, canvas.height);
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.globalAlpha = 1;

    //draw legend
    var x_offset = 5;
    ctx.font = "12px Arial";

    legend = "load event";
    ctx.fillStyle = "black";
    ctx.fillText(legend,x_offset,15);
    x_offset = eventLeftMargin+5;


    legend = 'start - end';
    ctx.fillStyle = "black";
    ctx.fillText(legend,x_offset,15);
    x_offset += ctx.measureText(legend).width+5;

    legend = '[latency';
    ctx.fillStyle = "orange";
    ctx.fillText(legend,x_offset,15);
    x_offset += ctx.measureText(legend).width+5;

    legend = 'loading';
    ctx.fillStyle = "green";
    ctx.fillText(legend,x_offset,15);
    x_offset += ctx.measureText(legend).width+5;

    legend = 'parsing';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,15);
    x_offset += ctx.measureText(legend).width+5;

    legend = 'appending]';
    ctx.fillStyle = "red";
    ctx.fillText(legend,x_offset,15);
    x_offset += ctx.measureText(legend).width+5;

    for (i =0, y_offset = 20; i < events.length; i++) {
      var event = events[i], start = event.time, end = event.time + event.duration + event.latency;
      if((start >= minTime && start <= maxTime)) {
        canvasDrawLoadEvent(ctx,y_offset,event,minTime,maxTime);
        y_offset+=20;
      }
    }
  }

  function canvasVideoEventUpdate(canvas, minTime, maxTime, events) {
    var ctx = canvas.getContext('2d');
    for (var i =0, y_offset = 20; i < events.length; i++) {
      var event = events[i], start = event.time, end = event.time;
      if((start >= minTime && start <= maxTime)) {
        y_offset+=20;
      }
    }
    canvas.height = y_offset;
    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0,0,eventLeftMargin, canvas.height);
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.globalAlpha = 1;

    //draw legend
    var x_offset = 5;
    ctx.font = "12px Arial";

    legend = 'video event';
    ctx.fillStyle = "black";
    ctx.fillText(legend,x_offset,15);

    x_offset = eventLeftMargin+5;
    legend = 'time';
    ctx.fillStyle = "black";
    ctx.fillText(legend,x_offset,15);

    x_offset += ctx.measureText(legend).width+5;
    legend = '[seek duration]';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,15);

    for (i =0, y_offset = 20; i < events.length; i++) {
      var event = events[i], start = event.time, end = event.time;
      if((start >= minTime && start <= maxTime)) {
        canvasDrawVideoEvent(ctx,y_offset,event,minTime,maxTime);
        y_offset+=20;
      }
    }
  }

  function canvasBufferWindowUpdate(canvas, minTime, maxTime, events) {
    var ctx = canvas.getContext('2d'),
    minTimeBuffer,
    bufferChartStart = eventLeftMargin,
    bufferChartWidth = ctx.canvas.width-eventLeftMargin-eventRightMargin;
    ctx.clearRect (0,0,canvas.width, canvas.height);

    if(events.length === 0) {
      return;
    }

    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0,0,eventLeftMargin, canvas.height);
    ctx.globalAlpha = 1;

    //draw legend
    var x_offset = 5;
    var y_offset = 0;
    ctx.font = "15px Arial";

    var maxBuffer = 0, firstEventIdx = -1, event;
    for (var i =0 ; i < events.length; i++) {
      event = events[i];
      var buffer = event.buffer;
      maxBuffer = Math.max(maxBuffer, buffer);
      if(firstEventIdx === -1 && event.time >= minTime) {
        firstEventIdx = Math.max(0,i-1);
      }
    }
    // convert to seconds
    maxBuffer;
    // compute buffer length as pos minTime using linear approximation
    if((firstEventIdx+1) < events.length) {
      minTimeBuffer = events[firstEventIdx].buffer + (minTime-events[firstEventIdx].time)*(events[firstEventIdx+1].buffer-events[firstEventIdx].buffer)/(events[firstEventIdx+1].time-events[firstEventIdx].time);
    } else {
      minTimeBuffer = 0;
    }

    maxBuffer+=10000;

    y_offset += 15;
    legend = 'buffer window';
    ctx.fillStyle = "black";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = '[' + minTime + ',' + maxTime + ']';
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'nb samples:' + events.length;
    ctx.fillText(legend,x_offset,y_offset);

    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(bufferChartStart, ctx.canvas.height);
    ctx.lineTo(bufferChartStart, ctx.canvas.height*(1 - minTimeBuffer/maxBuffer));
    for (var i =firstEventIdx+1 ; i < events.length; i++) {
      x_offset = bufferChartStart + (bufferChartWidth*(events[i].time-minTime))/(maxTime-minTime);
      y_offset = ctx.canvas.height*(1 - events[i].buffer/maxBuffer);
      ctx.lineTo(x_offset,y_offset);
    }
    ctx.lineTo(x_offset, canvas.height);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.globalAlpha = 1;
  }


  function canvasPositionWindowUpdate(canvas, minTime, maxTime, events) {
    var ctx = canvas.getContext('2d'),
    minTimeBuffer,
    bufferChartStart = eventLeftMargin,
    bufferChartWidth = ctx.canvas.width-eventLeftMargin-eventRightMargin;
    ctx.clearRect (0,0,canvas.width, canvas.height);

    if(events.length === 0) {
      return;
    }

    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0,0,eventLeftMargin, canvas.height);
    ctx.globalAlpha = 1;

    //draw legend
    var x_offset = 5;
    var y_offset = 0;
    ctx.font = "15px Arial";

    var maxPos = 0, firstEventIdx = -1, event;
    for (var i =0 ; i < events.length; i++) {
      event = events[i];
      var pos = event.pos;
      maxPos = Math.max(maxPos, pos);
      if(firstEventIdx === -1 && event.time >= minTime) {
        firstEventIdx = Math.max(0,i-1);
      }
    }
    // compute Position(minTime) using linear approximation
    if((firstEventIdx+1) < events.length) {
      minTimePos = events[firstEventIdx].pos + (minTime-events[firstEventIdx].time)*(events[firstEventIdx+1].pos-events[firstEventIdx].pos)/(events[firstEventIdx+1].time-events[firstEventIdx].time);
    } else {
      minTimePos = 0;
    }

    maxPos+=10000;

    y_offset += 15;
    legend = 'position window';
    ctx.fillStyle = "black";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = '[' + minTime + ',' + maxTime + ']';
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'nb samples:' + events.length;
    ctx.fillText(legend,x_offset,y_offset);

    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(bufferChartStart, ctx.canvas.height);
    ctx.lineTo(bufferChartStart, ctx.canvas.height*(1 - minTimeBuffer/maxPos));
    for (var i =firstEventIdx+1 ; i < events.length; i++) {
      x_offset = bufferChartStart + (bufferChartWidth*(events[i].time-minTime))/(maxTime-minTime);
      y_offset = ctx.canvas.height*(1 - events[i].pos/maxPos);
      ctx.lineTo(x_offset,y_offset);
    }
    ctx.lineTo(x_offset, canvas.height);
    ctx.fill();

    ctx.fillStyle = "white";
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.globalAlpha = 1;
  }


  function canvasBufferTimeRangeUpdate(canvas, minTime, maxTime, windowMinTime, windowMaxTime, events) {
    var ctx = canvas.getContext('2d'),
    bufferChartStart = eventLeftMargin,
    bufferChartWidth = ctx.canvas.width-eventLeftMargin-eventRightMargin;
    x_offset = 0,y_offset = 0;
    ctx.clearRect (0,0,canvas.width, canvas.height);

    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0,0,eventLeftMargin, canvas.height);
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.globalAlpha = 1;

    x_offset = 5;
    y_offset = 15;
    legend = 'buffer';
    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    ctx.fillText(legend,x_offset,y_offset);

    if(events.length === 0) {
      return;
    }

    var maxBuffer = 0;
    for (var i =0 ; i < events.length; i++) {
      var buffer = events[i].buffer;
      maxBuffer = Math.max(maxBuffer, buffer);
    }

    y_offset+=15;
    legend = 'max:' + (maxBuffer/1000).toFixed(2);
    ctx.fillText(legend,x_offset,y_offset);

    y_offset+=15;
    legend = 'cur:' + (events[events.length-1].buffer/1000).toFixed(2);
    ctx.fillText(legend,x_offset,y_offset);
    maxBuffer+=10000;

    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(bufferChartStart, ctx.canvas.height);
    for (var i =0 ; i < events.length; i++) {
      x_offset = bufferChartStart + (bufferChartWidth*(events[i].time-minTime))/(maxTime-minTime);
      y_offset = ctx.canvas.height*(1 - events[i].buffer/maxBuffer);
      ctx.lineTo(x_offset,y_offset);
    }
    ctx.lineTo(x_offset, canvas.height);
    ctx.fill();

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "grey";
    var x_start = bufferChartStart;
    var x_w = bufferChartWidth*(windowMinTime-minTime)/(maxTime-minTime);
    ctx.fillRect(x_start,0,x_w, canvas.height);
    var x_start = bufferChartStart+bufferChartWidth*(windowMaxTime-minTime)/(maxTime-minTime);
    var x_w = canvas.width-x_start-eventRightMargin;
    ctx.fillRect(x_start,0,x_w, canvas.height);
    ctx.globalAlpha = 1;
  }

  function canvasPositionTimeRangeUpdate(canvas, minTime, maxTime, windowMinTime, windowMaxTime, events) {
    var ctx = canvas.getContext('2d'),
    posChartStart = eventLeftMargin,
    posChartWidth = ctx.canvas.width-eventLeftMargin-eventRightMargin;
    x_offset = 0,y_offset = 0;
    ctx.clearRect (0,0,canvas.width, canvas.height);

    ctx.fillStyle = "green";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0,0,eventLeftMargin, canvas.height);
    ctx.fillRect(canvas.width-eventRightMargin,0,eventRightMargin, canvas.height);
    ctx.globalAlpha = 1;

    x_offset = 5;
    y_offset = 15;
    legend = 'position';
    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    ctx.fillText(legend,x_offset,y_offset);

    if(events.length === 0) {
      return;
    }

    var maxPos = 0;
    for (var i =0 ; i < events.length; i++) {
      var pos = events[i].pos;
      maxPos = Math.max(maxPos, pos);
    }

    y_offset+=15;
    legend = 'max:' + (maxPos/1000).toFixed(2);
    ctx.fillText(legend,x_offset,y_offset);

    y_offset+=15;
    legend = 'cur:' + (events[events.length-1].pos/1000).toFixed(2);
    ctx.fillText(legend,x_offset,y_offset);

    maxPos+=10000;

    ctx.fillStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(posChartStart, ctx.canvas.height);
    for (var i =0 ; i < events.length; i++) {
      x_offset = posChartStart + (posChartWidth*(events[i].time-minTime))/(maxTime-minTime);
      y_offset = ctx.canvas.height*(1 - events[i].pos/maxPos);
      ctx.lineTo(x_offset,y_offset);
    }
    ctx.lineTo(x_offset, canvas.height);
    ctx.fill();

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "grey";
    var x_start = posChartStart;
    var x_w = posChartWidth*(windowMinTime-minTime)/(maxTime-minTime);
    ctx.fillRect(x_start,0,x_w, canvas.height);


    var x_start = posChartStart+posChartWidth*(windowMaxTime-minTime)/(maxTime-minTime); ;
    var x_w = canvas.width-x_start-eventRightMargin;
    ctx.fillRect(x_start,0,x_w, canvas.height);
    ctx.globalAlpha = 1;
  }


  function canvasDrawLoadEvent(ctx,yoffset,event,minTime,maxTime) {
    var legend,offset,x_start,x_w,
    networkChartStart = eventLeftMargin,
    networkChartWidth = ctx.canvas.width-eventLeftMargin-eventRightMargin,
    tend = event.time + event.duration + event.latency;

   //draw start
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    legend = event.time;
    offset = ctx.measureText(legend).width+5;
    x_start = networkChartStart-offset+networkChartWidth*(event.time-minTime)/(maxTime-minTime);
    ctx.fillText(legend,x_start,yoffset+12);

    //draw latency rectangle
    ctx.fillStyle = "orange";
    x_start = networkChartStart + networkChartWidth*(event.time-minTime)/(maxTime-minTime);
    x_w = networkChartWidth*event.latency/(maxTime-minTime);
    ctx.fillRect(x_start,yoffset,x_w, 15);
    //draw download rectangle
    ctx.fillStyle = "green";
    x_start = networkChartStart + networkChartWidth*(event.time+event.latency-minTime)/(maxTime-minTime);
    x_w = networkChartWidth*event.load/(maxTime-minTime);
    ctx.fillRect(x_start,yoffset,x_w, 15);

    if(event.demux) {
      //draw demux rectangle
      ctx.fillStyle = "blue";
      x_start = networkChartStart + networkChartWidth*(event.time+event.latency+event.load-minTime)/(maxTime-minTime);
      x_w = networkChartWidth*event.demux/(maxTime-minTime);
      ctx.fillRect(x_start,yoffset,x_w, 15);

      //draw buffering rectangle
      ctx.fillStyle = "red";
      x_start = networkChartStart + networkChartWidth*(event.time+event.latency+event.load+event.demux-minTime)/(maxTime-minTime);
      x_w = networkChartWidth*event.buffer/(maxTime-minTime);
      ctx.fillRect(x_start,yoffset,x_w, 15);
    }

   //draw end time
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    legend = tend;
    x_start += x_w + 5;
    ctx.fillText(legend,x_start,yoffset+12);
    x_start += ctx.measureText(legend).width+5;

    legend = "[" + event.latency;
    ctx.fillStyle = "orange";
    ctx.fillText(legend,x_start,yoffset+12);
    x_start += ctx.measureText(legend).width+5;

    legend = event.load;
    if(!event.demux) legend += "]";
    ctx.fillStyle = "green";
    ctx.fillText(legend,x_start,yoffset+12);
    x_start += ctx.measureText(legend).width+5;

    if(event.demux) {
      legend = event.demux;
      ctx.fillStyle = "blue";
      ctx.fillText(legend,x_start,yoffset+12);
      x_start += ctx.measureText(legend).width+5;

      legend = event.buffer + "]";
      ctx.fillStyle = "red";
      ctx.fillText(legend,x_start,yoffset+12);
      x_start += ctx.measureText(legend).width+5;
    }
    // draw event name
    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    ctx.fillText(event.type + ' ' + event.name,5,yoffset+15);
  }

  function canvasDrawVideoEvent(ctx,yoffset,event,minTime,maxTime) {
    var legend,offset,x_start,x_w,
    networkChartStart = eventLeftMargin,
    networkChartWidth = ctx.canvas.width-eventLeftMargin-eventRightMargin,
    tend = event.time;

    // draw event name
    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    ctx.fillText(event.type + event.name,5,yoffset+15);

    //draw event rectangle
    x_start = networkChartStart + networkChartWidth*(event.time-minTime)/(maxTime-minTime);
    x_w = 1;
    ctx.fillRect(x_start,yoffset,x_w, 15);

   //draw end time
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    legend = tend;
    x_start += x_w + 5;
    ctx.fillText(legend,x_start,yoffset+12);
    x_start += ctx.measureText(legend).width+5;

    if(event.duration) {
      legend = "[" + event.duration + "]";
      ctx.fillStyle = "blue";
      ctx.fillText(legend,x_start,yoffset+12);
    }
  }
