
  function canvasPushEvent(canvas,event) {
    if(canvas.canvasEvents === undefined) {
      canvas.canvasEvents = [];
    }
    canvas.canvasEvents.push(event);
  }

  function canvasFlushEvents(canvas) {
    canvas.canvasEvents = [];
  }

  function canvasUpdate(canvas, maxTime) {
    var ctx = canvas.getContext('2d');
    canvas.height = 20*(canvas.canvasEvents.length+1);

    //draw legend
    var offset = 50;
    ctx.font = "12px Arial";

    legend = 'latency';
    ctx.fillStyle = "orange";
    ctx.fillText(legend,offset,15);
    offset += ctx.measureText(legend).width+5;

    legend = 'loading';
    ctx.fillStyle = "green";
    ctx.fillText(legend,offset,15);
    offset += ctx.measureText(legend).width+5;

    legend = 'parsing';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,offset,15);
    offset += ctx.measureText(legend).width+5;

    legend = 'appending';
    ctx.fillStyle = "red";
    ctx.fillText(legend,offset,15);
    offset += ctx.measureText(legend).width+5;

    for (var i =0 ; i < canvas.canvasEvents.length; i++) {
      canvasDrawEvent(ctx,20*(i+1),canvas.canvasEvents[i],maxTime);
    }
  }

  function canvasUpdateBuffer(canvas, maxTime) {
    var ctx = canvas.getContext('2d'),
    bufferChartStart = eventNameWidth+eventLegendWidth,
    bufferChartWidth = ctx.canvas.width-eventNameWidth-eventLegendWidth-40,
    events = canvas.canvasEvents;
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

    y_offset += 15;
    legend = 'playable after:' + events[0].time + ' ms';
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'current buffer:' + events[events.length-1].buffer.toFixed(2);
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'max buffer:' + maxBuffer.toFixed(2);
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);

    y_offset += 15;
    legend = 'nb samples:' + events.length;
    ctx.fillStyle = "blue";
    ctx.fillText(legend,x_offset,y_offset);


    ctx.beginPath();
    ctx.moveTo(bufferChartStart, ctx.canvas.height);
    for (var i =0 ; i < events.length; i++) {
      x_offset = bufferChartStart + bufferChartWidth*events[i].time/maxTime;
      y_offset = ctx.canvas.height*(1 - events[i].buffer/maxBuffer);
      if(i === 0) {
        ctx.lineTo(x_offset,ctx.canvas.height);
      }
      ctx.lineTo(x_offset,y_offset);
    }
    ctx.stroke();
  }

  var eventNameWidth = 150;
  var eventLegendWidth = 120;

  function canvasDrawEvent(ctx,yoffset,event,maxTime) {
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
    x_start = networkChartStart-offset+networkChartWidth*event.time/maxTime;
    ctx.fillText(legend,x_start,yoffset+12);

    //draw latency rectangle
    ctx.fillStyle = "orange";
    x_start = networkChartStart + networkChartWidth*event.time/maxTime;
    x_w = networkChartWidth*event.latency/maxTime;
    ctx.fillRect(x_start,yoffset,x_w, 15);
    //draw download rectangle
    ctx.fillStyle = "green";
    x_start = networkChartStart + networkChartWidth*(event.time+event.latency)/maxTime;
    x_w = networkChartWidth*event.load/maxTime;
    ctx.fillRect(x_start,yoffset,x_w, 15);

    if(event.demux) {
      //draw demux rectangle
      ctx.fillStyle = "blue";
      x_start = networkChartStart + networkChartWidth*(event.time+event.latency+event.load)/maxTime;
      x_w = networkChartWidth*event.demux/maxTime;
      ctx.fillRect(x_start,yoffset,x_w, 15);

      //draw buffering rectangle
      ctx.fillStyle = "red";
      x_start = networkChartStart + networkChartWidth*(event.time+event.latency+event.load+event.demux)/maxTime;
      x_w = networkChartWidth*event.buffer/maxTime;
      ctx.fillRect(x_start,yoffset,x_w, 15);
    }

   //draw end time
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    legend = tend;
    x_start += x_w + 5;
    ctx.fillText(legend,x_start,yoffset+12);

    //draw legend
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

  function canvasDrawLegend(canvas, eventIdx) {
    var ctx = canvas.getContext('2d');
    // draw event name
    ctx.fillStyle = "green";
    ctx.font = "15px Arial";
    var event = canvas.canvasEvents[eventIdx];
    var legend = event.legend;
    if (legend === undefined) {
      legend = event.name + ' :t/rtt/duration(ms):' + event.time + '/' + event.latency + '/' + event.duration;
    }
    ctx.fillText(legend,5,20*(canvas.canvasEvents.length+1));

  }
