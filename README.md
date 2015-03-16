# hls.js
[MSE](http://w3c.github.io/media-source/)-based [HTTP Live Streaming](http://en.wikipedia.org/wiki/HTTP_Live_Streaming) library.

this lib allows to playback HLS streams on browsers supporting media source extension API.
 
the lib is written in EcmaScript 6, and transpiled using Babel.

MPEG-2 TS transmuxing is offloaded into a Web Worker.

## Demo
working in Chrome (also on mobile device)
[http://gdupontavice.dev.dailymotion.com/hls.js/demo/index.html](http://gdupontavice.dev.dailymotion.com/hls.js/demo/index.html)

## Features

  - VoD & Live playlists
    - Sliding window (aka DVR) support on Live playlists
  - Adaptive streaming
    - Manual & Auto switching
  - Accurate Seeking  on VoD & Live
    - ability to seek in buffer and back buffer without redownloading segments

### Supported M3U8 tags

  - `#EXTM3U`
  - `#EXTINF`
  - `#EXT-X-STREAM-INF` (Multiple bitrate)
  - `#EXT-X-ENDLIST` (VoD / Live playlist)
  - `#EXT-X-MEDIA-SEQUENCE`
  - `#EXT-X-TARGETDURATION`

## Getting Started

```html
<script src="dist/hls.js"></script>

<script>
  if(Hls.isSupported()) {
    var video = document.getElementById('video');
    var hls = new Hls(video);
    hls.on(hls.Events.FRAMEWORK_READY,function() {
      hls.attachSource(manifest);
  });
 }
</script>
```




## Runtime Control

### Video Control

video is controlled through HTML ```<video>``` element.

standard control and events could be used seamlessly.

### Quality switch

hls.js handles quality switch automatically.
it is also possible to manually control quality swith using below API:

#### hls.levels
return an array of available quality levels

```
[
[bitrate: 246440,
codecs: "mp4a.40.5,avc1.42000d",
height: 136,
name: "240",
url: "http://url1.m3u8",
width: 320
],
[
bitrate: 460560,
codecs: "mp4a.40.5,avc1.420015",
height: 216,
name: "380",
url: "http://url2.m3u8",
width: 512],
...
]
```

#### hls.level
getter : Return the quality level of last loaded fragment

setter : set quality level for next loaded fragment, set to -1 for automatic level selection

#### hls.autoLevelEnabled

tell whether auto level selection is enabled or not


## compatibility
 hls.js is compatible with browsers supporting MSE with 'video/MP4' inputs.
as of today, it is supported on:

 * Chrome for Desktop 34+
 * Safari for Mac 8+
 * IE for Windows 11+
 * Chrome for Android 34+
 * IE for Winphone 8.1+
