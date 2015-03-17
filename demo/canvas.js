
  function canvasPushEvent(canvas,event) {
    if(canvas.canvasEvents === undefined) {
      canvas.canvasEvents = [];
    }
    canvas.canvasEvents.push(event);
    canvas.canvasMaxTime = event.time + event.latency + event.duration;
  }

  function canvasFlushEvents(canvas) {
    canvas.canvasEvents = [];
  }

  function canvasUpdate(canvas) {
    var ctx = canvas.getContext('2d');
    canvas.height = 20*(canvas.canvasEvents.length+1);

    //draw legend
    var legend = 'start time / latency / load duration / end time';
    ctx.fillStyle = "green";
    ctx.font = "12px Arial";
    ctx.fillText(legend,5,15);

    for (var i =0 ; i < canvas.canvasEvents.length; i++) {
      canvasDrawEvent(ctx,20*(i+1),canvas.canvasEvents[i]);
    }
  }

  var eventNameWidth = 150;
  var eventLegendWidth = 100;

  function canvasDrawEvent(ctx,yoffset,event) {
    // draw event name
    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    ctx.fillText(event.name,5,yoffset+15);

    var networkChartStart = eventNameWidth+eventLegendWidth;
    var networkChartWidth = ctx.canvas.width-eventNameWidth-eventLegendWidth;

    //draw latency rectangle
    ctx.fillStyle = "green";
    var x_start = networkChartStart + networkChartWidth*event.time/ctx.canvas.canvasMaxTime;
    var x_w = networkChartWidth*event.latency/ctx.canvas.canvasMaxTime;
    ctx.fillRect(x_start,yoffset,x_w, 15);
    //draw download rectangle
    ctx.fillStyle = "blue";
    x_start = networkChartStart + networkChartWidth*(event.time+event.latency)/ctx.canvas.canvasMaxTime;
    x_w = networkChartWidth*event.duration/ctx.canvas.canvasMaxTime;
    ctx.fillRect(x_start,yoffset,x_w, 15);

    //draw legend
    var legend = event.legend;
    if (legend === undefined) {
      var tend = event.time + event.latency + event.duration;
      legend = event.time + '/' + event.latency + '/' + event.duration + '/' + tend;
    }
    ctx.fillStyle = "green";
    ctx.font = "12px Arial";
    x_start = eventNameWidth; //*(event.time+event.latency+event.duration)/ctx.canvas.canvasMaxTime;
    ctx.fillText(legend,x_start+5,yoffset+15);
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
