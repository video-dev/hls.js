# hls.js
hls.js is a JavaScript library which implements an [HTTP Live Streaming] client.
It relies on [HTML5 video][] and [MediaSource Extensions][] for playback.

it works by transmuxing MPEG-2 Transport Stream into ISO BMFF (MP4) fragments.
this transmuxing could be performed asynchronously using [Web Worker] if available in the browser.
 
hls.js is written in [ES6], and transpiled in ES5 using [Babel].


[HTML5 video]: http://www.html5rocks.com/en/tutorials/video/basics/
[MediaSource Extensions]: http://w3c.github.io/media-source/
[HTTP Live Streaming]: http://en.wikipedia.org/wiki/HTTP_Live_Streaming
[Web Worker]: http://caniuse.com/#search=worker
[ES6]: https://github.com/ericdouglas/ES6-Learning#articles--tutorials
[Babel]: https://babeljs.io

## Demo
[http://gdupontavice.dev.dailymotion.com/hls.js/demo/index.html](http://gdupontavice.dev.dailymotion.com/hls.js/demo/index.html)

## Dependencies

No external JS libs are needed. 
prepackaged distribution is available in the [dist] (dist) folder:

 - [hls.js] (dist/hls.js)
 - [hls.min.js] (dist/hls.min.js)

## compatibility
 hls.js is compatible with browsers supporting MSE with 'video/MP4' inputs.
as of today, it is supported on:

 * Chrome for Android 34+
 * Chrome for Desktop 34+
 * Firefox for Desktop 38+ (with media.mediasource.enabled=true,media.mediasource.whitelist=false in about:config)
 * IE11+ for Windows 8.1
 * Safari for Mac 8+ (still buggy)

## Features

  - VoD & Live playlists
    - DVR support on Live playlists
  - Adaptive streaming
    - Manual & Auto Quality Switching
      - 3 Quality Switching modes are available (controllable through API means)
      	- instant switching (immediate quality switch at current video position)
      	- smooth switching (quality switch for next loaded fragment)
      	- bandwidth conservative switching (quality switch change for next loaded fragment, without flushing the buffer)
      - in Auto-Quality mode, emergency switch down in case bandwidth is suddenly dropping to minimize buffering.        
  - Accurate Seeking on VoD & Live (not limited to fragment or keyframe boundary)
  - ability to seek in buffer and back buffer without redownloading segments
  - Built-in Analytics
    - every internal events could be monitored (Network Events,Video Events)
    - playback session metrics are also exposed
  - resilience to errors
    - retry mechanism in case of fragment loading failure
    - retry mechanism in case of video decoding errors

### Supported M3U8 tags

  - `#EXTM3U`
  - `#EXTINF`
  - `#EXT-X-STREAM-INF` (adaptive streaming)
  - `#EXT-X-ENDLIST` (Live playlist)
  - `#EXT-X-MEDIA-SEQUENCE`
  - `#EXT-X-TARGETDURATION`
  - `#EXT-X-DISCONTINUITY`

## Getting Started

```js
 
<video id="video"></video>
<script src="dist/hls.js"></script>
<script>
  if(Hls.isSupported()) {
    var video = document.getElementById('video');

    var hls = new Hls();
    hls.loadSource('http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8');
    hls.attachVideo(video);
    hls.on(hls.Events.MANIFEST_PARSED,function() {
      video.play();
  });

 }
</script>
```

## Video Control

video is controlled through HTML ```<video>``` element.

HTMLVideoElement control and events could be used seamlessly.


## API and Configuration Parameters

hls.js can be configured and controlled easily, click [here](API.md) for details.
