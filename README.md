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

### Level Duration

level duration could be retrieved by listening to ```hls.Events.LEVEL_LOADED```:

```html
hls.on(hls.Events.LEVEL_LOADED,function(event,data) {
	var level_duration = data.level.totalduration;
});
```

video duration can also be retrieved from ```<video>``` element, but only after [init segment](http://w3c.github.io/media-source/#init-segment) has been appended into [SourceBuffer](http://w3c.github.io/media-source/#sourcebuffer).

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
get/set : quality level of last loaded fragment.

set to -1 for automatic level selection

#### hls.startLevel

get/set :  start level (level of first fragment that will be played back)

  - if undefined : first level appearing in manifest will be used as start level.
  -  if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)

default value is undefined (first level appearing in Manifest will be used as start level)

#### hls.autoLevelEnabled

tell whether auto level selection is enabled or not

#### hls.autoLevelCapping
get/set : capping/max level value that could be used by automatic level selection algorithm

default value is -1 (no level capping)

## Runtime Events

hls.js fires a bunch of events, that could be registered as below:


```html
hls.on(hls.Events.LEVEL_LOADED,function(event,data) {
	var level_duration = data.level.totalduration;
});
```
full list of Events available below :

  - `hls.events.FRAMEWORK_READY`  - Identifier for a framework ready event, triggered when ready to set DataSource
  	-  data: { mediaSource }
  - `hls.events.MANIFEST_LOADED`  - Identifier for a manifest loaded event
  	-  data: { levels : [available quality levels] , url : manifestURL}
  - `hls.events.MANIFEST_PARSED`  - Identifier for a manifest parsed event
  	-  data: { levels : [available quality levels] , startLevel : playback start level, audiocodecswitch: true if different audio codecs used}
  - `hls.events.LEVEL_LOADING`  - Identifier for a level loading event
  	-  data: { id : id of level being loaded}
  - `hls.events.LEVEL_LOADED`  - Identifier for a level loaded event
  	-  data: { level : level object , url : level URL}
  - `hls.events.LEVEL_SWITCH`  - Identifier for a level switch event
  	-  data: { id : id of new level }
  - `hls.events.FRAGMENT_LOADING`  - Identifier for a fragment loading event
  	-  data: { url : fragment URL}
  - `hls.events.FRAGMENT_LOADED`  - Identifier for a fragment loaded event
	  -  data: { payload : fragment payload, frag : fragment object}
  - `hls.events.FRAGMENT_PARSING`  - Identifier for a fragment parsing event
	  -  data: { moof : moof MP4 box, mdat : mdat MP4 box}
  - `hls.events.FRAGMENT_PARSED`  - Identifier for a fragment parsed event
	  -  data: undefined
  - `hls.events.INIT_SEGMENT` - Identifier for a Init Segment  event
	  -  data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  - `hls.events.LOAD_ERROR` - Identifier for fragment/playlist load error
	  -  data: { url : faulty URL, response : XHR response}
  - `hls.events.LEVEL_ERROR` - Identifier for a level switch error
	  -  data: { level : faulty level Id, event : error description}
  - `hls.events.VIDEO_ERROR` - Identifier for a video error
	  -  data: undefined
  - `hls.events.PARSING_ERROR` - Identifier for a fragment parsing error
	  -  data: parsing error description


## compatibility
 hls.js is compatible with browsers supporting MSE with 'video/MP4' inputs.
as of today, it is supported on:

 * Chrome for Desktop 34+
 * Safari for Mac 8+
 * IE for Windows 11+
 * Chrome for Android 34+
 * IE for Winphone 8.1+
