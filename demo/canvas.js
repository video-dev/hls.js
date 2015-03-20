
  var eventNameWidth = 150;
  var eventLegendWidth = 120;

  function canvasLoadUpdate(canvas, minTime, maxTime, events) {
    var ctx = canvas.getContext('2d');
    for (var i =0, y_offset = 20; i < events.length; i++) {
      var event = events[i], start = event.time, end = event.time + event.duration + event.latency;
      if((start <= minTime && end >= maxTime) ||
         (start >= minTime && end <= maxTime) ||
         (start <= minTime && end >= maxTime)) {
        y_offset+=20;
      }
    }
    canvas.height = y_offset;

    //draw legend
    var x_offset = 50;
    ctx.font = "12px Arial";

    legend = 'latency';
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

    legend = 'appending';
    ctx.fillStyle = "red";
    ctx.fillText(legend,x_offset,15);
    x_offset += ctx.measureText(legend).width+5;

    for (i =0, y_offset = 20; i < events.length; i++) {
      var event = events[i], start = event.time, end = event.time + event.duration + event.latency;
      if((start <= minTime && end >= maxTime) ||
         (start >= minTime && end <= maxTime) ||
         (start <= minTime && end >= maxTime)) {
        canvasLoadDrawEvent(ctx,y_offset,event,minTime,maxTime);
        y_offset+=20;
      }
    }
  }

  function canvasBufferUpdate(canvas, minTime, maxTime, events) {
    var ctx = canvas.getContext('2d'),
    bufferChartStart = eventNameWidth+eventLegendWidth,
    bufferChartWidth = ctx.canvas.width-eventNameWidth-eventLegendWidth-40;
    ctx.clearRect (0,0,canvas.width, canvas.height);

    if(events.length === 0) {
      return;
    }

    //draw legend
    var x_offset = 5;
    var y_offset = 0;
    ctx.font = "15px Arial";

    var maxBuffer = 0;
    for (var i =0 ; i < events.length; i++) {
      var buffer = events[i].buffer;
      maxBuffer = Math.max(maxBuffer, buffer);
    }
    maxBuffer+=10;

    y_offset += 15;
    legend = 'playable after:' + events[0].time + ' ms';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'current buffer:' + events[events.length-1].buffer.toFixed(2);
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'max buffer:' + maxBuffer.toFixed(2) + ' s';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'window start time:' + (minTime/1000).toFixed(1) + ' s';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'window end time:' + (maxTime/1000).toFixed(1) + ' s';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'current time:' + (events[events.length-1].time/1000).toFixed(1) + ' s';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    ctx.beginPath();
    ctx.moveTo(bufferChartStart, ctx.canvas.height);
    for (var i =0 ; i < events.length; i++) {
      x_offset = bufferChartStart + (bufferChartWidth*(events[i].time-minTime))/(maxTime-minTime);
      y_offset = ctx.canvas.height*(1 - events[i].buffer/maxBuffer);
      if(x_offset >= bufferChartStart && x_offset <= (bufferChartStart+bufferChartWidth)) {
        ctx.lineTo(x_offset,y_offset);
      }
    }
    ctx.lineTo(x_offset, canvas.height);
    ctx.fill();
  }

  function canvasTimeRangeUpdate(canvas, minTime, maxTime, windowMinTime, windowMaxTime, events) {
    var ctx = canvas.getContext('2d'),
    bufferChartStart = 0,
    bufferChartWidth = ctx.canvas.width;
    x_offset = 0,y_offset = 0;
    ctx.clearRect (0,0,canvas.width, canvas.height);

    if(events.length === 0) {
      return;
    }

    var maxBuffer = 0;
    for (var i =0 ; i < events.length; i++) {
      var buffer = events[i].buffer;
      maxBuffer = Math.max(maxBuffer, buffer);
    }
    maxBuffer+=10;

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

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "grey";
    var x_start = bufferChartStart;
    var x_w = bufferChartWidth*(windowMinTime-minTime)/(maxTime-minTime);
    ctx.fillRect(x_start,0,x_w, canvas.height);


    var x_start = bufferChartStart+bufferChartWidth*(windowMaxTime-minTime)/(maxTime-minTime); ;
    var x_w = bufferChartWidth-x_start;
    ctx.fillRect(x_start,0,x_w, canvas.height);
  }

  function canvasLoadDrawEvent(ctx,yoffset,event,minTime,maxTime) {
    var legend,offset,x_start,x_w,
    networkChartStart = eventNameWidth+eventLegendWidth,
    networkChartWidth = ctx.canvas.width-eventNameWidth-eventLegendWidth-40,
    tend = event.time + event.duration + event.latency;

    // draw event name
    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    ctx.fillText(event.name,5,yoffset+15);

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

    //draw legend
    var offset = eventNameWidth;
    ctx.font = "12px Arial";

    legend = event.latency;
    ctx.fillStyle = "orange";
    ctx.fillText(legend,offset,yoffset+12);
    offset += ctx.measureText(legend).width+5;

    legend = event.load;
    ctx.fillStyle = "green";
    ctx.fillText(legend,offset,yoffset+12);
    offset += ctx.measureText(legend).width+5;

    if(event.demux) {
      legend = event.demux;
      ctx.fillStyle = "blue";
      ctx.fillText(legend,offset,yoffset+12);
      offset += ctx.measureText(legend).width+5;

      legend = event.buffer;
      ctx.fillStyle = "red";
      ctx.fillText(legend,offset,yoffset+12);
      offset += ctx.measureText(legend).width+5;
    }
  }

