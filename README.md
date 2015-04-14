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
    var hls = new Hls();
    hls.loadSource('http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8');    
    hls.attachVideo(video);

    hls.on(hls.Events.MANIFEST_PARSED,function() {
      ...
  });

    hls.on(hls.Events.MSE_ATTACHED,function() {
      ...
  });


 }
</script>
```

## compatibility
 hls.js is compatible with browsers supporting MSE with 'video/MP4' inputs.
as of today, it is supported on:

 * Chrome for Desktop 34+
 * Safari for Mac 8+
 * IE for Windows 11+
 * Chrome for Android 34+
 * IE for Winphone 8.1+


## Video Control

video is controlled through HTML ```<video>``` element.

HTMLVideoElement control and events could be used seamlessly.


## Quality switch Control

hls.js handles quality switch automatically.
it is also possible to manually control quality swith using below API:


#### hls.levels
return array of available quality levels

#### hls.level
get/set : index of quality level of last loaded fragment.

set to -1 for automatic level selection

#### hls.firstLevel

get :  first level index (index of first level appearing in Manifest. it is usually defined as start level hint for player)

#### hls.startLevel

get/set :  start level index (level of first fragment that will be played back)

  - if not overrided by user : first level appearing in manifest will be used as start level.
  -  if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)

default value is firstLevel

#### hls.autoLevelEnabled

tell whether auto level selection is enabled or not

#### hls.autoLevelCapping
get/set : capping/max level value that could be used by automatic level selection algorithm

default value is -1 (no level capping)

## Runtime Events

hls.js fires a bunch of events, that could be registered as below:


```html
hls.on(hls.Events.LEVEL_LOADED,function(event,data) {
	var level_duration = data.details.totalduration;
});
```
full list of Events available below :

  - `hls.events.MSE_ATTACHED`  - fired when MediaSource has been succesfully attached to video element.
  	-  data: { mediaSource }
  - `hls.events.MANIFEST_LOADED`  - fired after manifest has been loaded
  	-  data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  - `hls.events.MANIFEST_PARSED`  - fired after manifest has been parsed
  	-  data: { levels : [available quality levels] , startLevel : playback start level, audiocodecswitch: true if different audio codecs used}
  - `hls.events.LEVEL_LOADING`  - fired when a level playlist loading starts
  	-  data: { levelId : id of level being loaded}
  - `hls.events.LEVEL_LOADED`  - fired when a level playlist loading finishes
  	-  data: { details : levelDetails object, levelId : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  - `hls.events.LEVEL_SWITCH`  - fired when a level switch is requested
  	-  data: { levelId : id of new level }
  - `hls.events.FRAG_LOADING`  - fired when a fragment loading starts
  	-  data: { frag : fragment object}
  - `hls.events.FRAG_LOADED`  - fired when a fragment loading is completed
	  -  data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  - `hls.events.FRAG_PARSING_INIT_SEGMENT` - fired when Init Segment has been extracted from fragment
    -  data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}    
  - `hls.events.FRAG_PARSING_DATA`  - fired when moof/mdat have been extracted from fragment
	  -  data: { moof : moof MP4 box, mdat : mdat MP4 box}
  - `hls.events.FRAG_PARSED`  - fired when fragment parsing is completed
	  -  data: undefined
  - `hls.events.FRAG_BUFFERED`  - fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer
    -  data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  - `hls.events.LOAD_ERROR` - Identifier for fragment/playlist load error
	  -  data: { url : faulty URL, response : XHR response}
  - `hls.events.LEVEL_ERROR` - Identifier for a level switch error
	  -  data: { level : faulty level Id, event : error description}
  - `hls.events.VIDEO_ERROR` - Identifier for a video error
	  -  data: undefined
  - `hls.events.PARSING_ERROR` - Identifier for a fragment parsing error
	  -  data: parsing error description

## Objects
### Level

a level object represents a given quality level.
it contains quality level related info, retrieved from manifest, such as

* level bitrate
* used codecs
* video width/height
* level name
* level URL

see sample Level object below:

```
{
  url: 'http://levelURL.com'
  bitrate: 246440,
  name: "240",
  codecs: "mp4a.40.5,avc1.42000d",
  width: 320,
  height: 136,
}
```

### Level details

level detailed infos contains level details retrieved after level playlist parsing, they are specified below :

* start sequence number
* end sequence number
* level total duration
* level fragment target duration
* array of fragments info
* is this level a live playlist or not ?

see sample object below, available after corresponding LEVEL_LOADED event has been fired:

```
{
	startSN: 0,
	endSN: 50,
	totalduration: 510,
	targetduration: 10,	  
	fragments: Array[51],
	live: false
}
```

### Fragment
the Fragment object contains fragment related info, such as

* fragment URL
* fragment duration
* fragment sequence number
* fragment start offset
* level Id

see sample object below:

```
{
  duration: 10,
  level : 3,
  sn: 35,
  start : 30,
  url: 'http://fragURL.com'
}
```
