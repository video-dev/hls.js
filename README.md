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

prepackaged distribution is available in the [dist] (dist) folder:

 - [hls.js] (dist/hls.js)
 - [hls.min.js] (dist/hls.min.js)

## compatibility
 hls.js is compatible with browsers supporting MSE with 'video/MP4' inputs.
as of today, it is supported on:

 * Chrome for Android 34+
 * Chrome for Desktop 34+
 * Firefox for Desktop 38+
 * IE11+ for Windows 8.1
 * Safari for Mac 8+ (still buggy)

## Features

  - VoD & Live playlists
    - Sliding window (aka DVR) support on Live playlists
  - Adaptive streaming
    - Manual & Auto switching
    	- instant switching (immediate quality switch at current video position)
    	- smooth switching (quality switch for next loaded fragment)
    	- bandwidth conservative switching (quality switch change for next loaded fragment, without flushing the buffer) 
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

```js
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

## Video Control

video is controlled through HTML ```<video>``` element.

HTMLVideoElement control and events could be used seamlessly.


## Configuration Parameters

configuration parameters could be provided to hls.js upon instantiation of Hls Object.

```js

   var config = {
      debug : false,
      maxBufferLength : 30,
      maxBufferSize : 60*1000*1000,
      enableWorker : true,
      fragLoadingTimeOut : 20000,
      fragLoadingMaxRetry : 6,
      fragLoadingRetryDelay : 500,
      manifestLoadingTimeOut : 10000,
      manifestLoadingMaxRetry : 6,
      manifestLoadingRetryDelay : 500,
      loader : customLoader
    };


var hls = new Hls(config);
```

#### debug
(default false)

turn on debug logs on JS console 
#### maxBufferLength
(default 30s)

maximum buffer Length in seconds. if buffer length is/become less than this value, a new fragment will be loaded.
#### maxBufferSize
(default 60 MB)

maximum buffer size in bytes. if buffer size upfront is bigger than this value, no fragment will be loaded.
#### enableWorker
(default true)

enable webworker (if available on browser) for TS demuxing/MP4 remuxing, to improve performance and avoid lag/frame drops.
#### fragLoadingTimeOut/manifestLoadingTimeOut
(default 60000ms for fragment/10000ms for manifest)

URL Loader timeout.
A timeout callback will be triggered if loading duration exceeds this timeout.
no further action will be done : the load operation will not be cancelled/aborted.
It is up to the application to catch this event and treat it as needed.
#### fragLoadingMaxRetry/manifestLoadingMaxRetry
(default 3)

max nb of load retry
#### fragLoadingRetryDelay/manifestLoadingRetryDelay
(default 500ms)

initial delay between XmlHttpRequest error and first load retry (in ms)
any I/O error will trigger retries every 500ms,1s,2s,4s,8s, ... capped to 64s (exponential backoff)

#### loader
(default : standard XmlHttpRequest based URL loader)

override standard URL loader by a custom one.
could be useful for P2P or stubbing (testing).

```js
var customLoader = function() {

  /* calling load() will start retrieving content at given URL (HTTP GET)
  params : 
  url : URL to load
  responseType : xhr response Type (arraybuffer or default response Type for playlist)
  onSuccess : callback triggered upon successful loading of URL.
              it should return xhr event and load stats object {trequest,tfirst,tload}
  onError :   callback triggered if any I/O error is met while loading fragment
  onTimeOut : callback triggered if loading is still not finished after a certain duration
  timeout : timeout after which onTimeOut callback will be triggered(if loading is still not finished after that delay)
  maxRetry : max nb of load retry
  retryDelay : delay between an I/O error and following connection retry (ms). this to avoid spamming the server.
  */
  this.load = function(url,responseType,onSuccess,onError,timeout,maxRetry,retryDelay) {}
  
  /* abort any loading in progress */
  this.abort = function() {}
  /* destroy loading context */
  this.destroy = function() {}
  }
```

## Quality switch Control

hls.js handles quality switch automatically.
it is also possible to manually control quality swith using below API:


#### hls.levels
return array of available quality levels

#### hls.currentLevel
get : return current playback quality level
set : trigger an immediate quality level switch to new quality level. this will pause the video if it was playing, flush the whole buffer, and fetch fragment matching with current position and requested quality level. then resume the video if needed once fetched fragment will have been buffered.
set to -1 for automatic level selection

#### hls.nextLevel
get : return next playback quality level (playback quality level for next buffered fragment). return -1 if next fragment not buffered yet
set : trigger a quality level switch for next fragment. this could eventually flush already buffered next fragment
set to -1 for automatic level selection

#### hls.loadLevel
get : return last loaded fragment quality level.
set : set quality level for next loaded fragment
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

#### hls.stats
get : return playback session stats

```js
{ 
  tech : 'hls.js v1.xxxx',
  duration : video duration from manifest (in ms)
  playing : duration during which video element was in playing state (in ms) (if the first 10s of the video are rendered twice then playback is stopped, playing is 20s)
  paused : duration during which video element was in paused state (in ms) 
  played : duration of rendered content time range (in ms) (if the first 10s of the video are rendered twice, played is 10s)
  loading : initial delay between hls.load and loadeddata event (in ms),
  seeking : buffering delay introduced by seek requests  sum(Tseeked - Tseeking) (in ms)
  buffering : spurious buffering delay (not related to init or seek actions) (in ms)
  buffer : duration of buffered content upfront of play position
  bufferTotal : total buffer duration (including all buffer timeranges, and back buffer)
  seek : number of seek performed by user (other than initial seek at playback start)
  levelStart : start quality level
  levelMin : min quality level experienced by End User
  levelMax : max quality level experienced by End User
  levelAvg : avg quality level experienced by End User
  levelTotal : total nb of quality level referenced in Manifest
  levelSwitch : nb of quality level switch
  fragMinBitrate : min fragment load bitrate
  fragMaxBitrate : max fragment load bitrate
  fragAvgBitrate : avg fragment load bitrate
  fragMinLatency : min fragment load latency
  fragMaxLatency : max fragment load latency
  fragAvgLatency : avg fragment load latency
}
```

## Runtime Events

hls.js fires a bunch of events, that could be registered as below:


```js
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
	  -  data: { moof : moof MP4 box, mdat : mdat MP4 box, startPTS : PTS of first sample, endPTS : PTS of last sample, startDTS : DTS of first sample, endDTS : DTS of last sample, type : stream type (audio or video), nb : number of samples}
  - `hls.events.FRAG_PARSED`  - fired when fragment parsing is completed
	  -  data: undefined
  - `hls.events.FRAG_BUFFERED`  - fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer
    -  data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  - `hls.events.FRAG_CHANGED`  - fired when fragment matching with current video position is changing
    -  data: { frag : fragment object }
  - `hls.events.FRAG_LOAD_ERROR` - Identifier for fragment load error
	  -  data: { url : faulty URL, response : XHR response}
  - `hls.events.FRAG_LOAD_TIMEOUT` - Identifier for fragment load timeout
	  -  data: { url : faulty URL,{ trequest, tfirst,loaded } }
  - `hls.events.LEVEL_LOAD_ERROR` - Identifier for playlist load error
    -  data: { url : faulty URL, response : XHR response}
  - `hls.events.LEVEL_LOAD_TIMEOUT` - Identifier for playlist load timeout
    -  data: { url : faulty URL,{ trequest, tfirst,loaded } }    
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

```js
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

```js
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

```js
{
  duration: 10,
  level : 3,
  sn: 35,
  start : 30,
  url: 'http://fragURL.com'
}
```
