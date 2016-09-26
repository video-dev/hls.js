[![Build Status](https://travis-ci.org/dailymotion/hls.js.svg?branch=master)](https://travis-ci.org/dailymotion/hls.js)
[![npm][npm-image]][npm-url]

Join the discussion: [![Slack Status](https://hlsjs.herokuapp.com/badge.svg)](https://hlsjs.herokuapp.com/)

# hls.js
hls.js is a JavaScript library which implements an [HTTP Live Streaming] client.
It relies on [HTML5 video][] and [MediaSource Extensions][] for playback.

It works by transmuxing MPEG-2 Transport Stream into ISO BMFF (MP4) fragments.
This transmuxing could be performed asynchronously using [Web Worker] if available in the browser.

hls.js does not need any player, it works directly on top of a standard HTML```<video>```element.

hls.js is written in [ECMAScript6], and transpiled in ECMAScript5 using [Babel].

[HTML5 video]: http://www.html5rocks.com/en/tutorials/video/basics/
[MediaSource Extensions]: http://w3c.github.io/media-source/
[HTTP Live Streaming]: http://en.wikipedia.org/wiki/HTTP_Live_Streaming
[Web Worker]: http://caniuse.com/#search=worker
[ECMAScript6]: https://github.com/ericdouglas/ES6-Learning#articles--tutorials
[Babel]: https://babeljs.io

## Demo

Public demo : [http://dailymotion.github.io/hls.js/demo](http://dailymotion.github.io/hls.js/demo)

Private demo accessible from Dailymotion network: [http://gdupontavice.dev.dailymotion.com/hls.js/demo/index.html](http://gdupontavice.dev.dailymotion.com/hls.js/demo/index.html)


## Player Integration

hls.js is (being) integrated in the following players:

 - [Clappr] (https://github.com/clappr/clappr), integrated since [0.2.14](https://github.com/clappr/clappr/releases)
 - [Flowplayer] (https://www.flowplayer.org)  through [flowplayer-hlsjs] (https://github.com/flowplayer/flowplayer-hlsjs)
 - [Videojs] (http://videojs.com) through [Videojs-hlsjs] (https://github.com/benjipott/videojs-hlsjs)
 - [Videojs] (http://videojs.com) through [videojs-hls.js] (https://github.com/streamroot/videojs-hls.js). hls.js is integrated as a SourceHandler -- new feature in Video.js 5.
 - [Videojs] (http://videojs.com) through [videojs-contrib-hls.js](https://github.com/Peer5/videojs-contrib-hls.js). Production ready plug-in with full fallback compatibility built-in.

 It might also be integrated in the following players if you push for it !

 - [MediaElement.js] (http://mediaelementjs.com/)  through [#1609
] (https://github.com/johndyer/mediaelement/issues/1609)

## Chrome integration

 - [native-hls] (https://chrome.google.com/webstore/detail/native-hls-playback/emnphkkblegpebimobpbekeedfgemhof), plays hls from address bar and m3u8 links 

## Firefox integration

 - [firefox-hls] (https://github.com/mangui/firefox-hls), plays hls from address bar and m3u8 links (alpha stage)

## Dependencies

No external JS libs are needed.
Prepackaged build is included in the [dist] (dist) folder:

 - [hls.js] (dist/hls.js)
 - [hls.min.js] (dist/hls.min.js)

If you want to bundle the application yourself, use node

```
npm install hls.js
```

## Installation

Either directly include dist/hls.js or dist/hls.min.js

Or type

```sh
npm install --save hls.js
```

## Compatibility
hls.js is compatible with browsers supporting MSE with 'video/MP4' inputs.
As of today, it is supported on:

 * Chrome for Android 34+
 * Chrome for Desktop 34+
 * Firefox for Android 41+
 * Firefox for Desktop 42+
 * IE11+ for Windows 8.1
 * Safari for Mac 8+ (beta)

## CORS

All HLS resources must be delivered with [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS) permitting `GET` requests.

## Features

  - VoD & Live playlists
    - DVR support on Live playlists
  - MPEG-2 TS container
  - AAC container (audio only streams)
  - Adaptive streaming
    - Manual & Auto Quality Switching
      - 3 Quality Switching modes are available (controllable through API means)
      	- Instant switching (immediate quality switch at current video position)
      	- Smooth switching (quality switch for next loaded fragment)
      	- Bandwidth conservative switching (quality switch change for next loaded fragment, without flushing the buffer)
      - In Auto-Quality mode, emergency switch down in case bandwidth is suddenly dropping to minimize buffering.        
  - Accurate Seeking on VoD & Live (not limited to fragment or keyframe boundary)
  - Ability to seek in buffer and back buffer without redownloading segments
  - Built-in Analytics
    - Every internal events could be monitored (Network Events,Video Events)
    - Playback session metrics are also exposed
  - Resilience to errors
    - Retry mechanism embedded in the library
    - Recovery actions could be triggered fix fatal media or network errors
  - [Redundant/Failover Playlists](https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/StreamingMediaGuide/UsingHTTPLiveStreaming/UsingHTTPLiveStreaming.html#//apple_ref/doc/uid/TP40008332-CH102-SW22)
  - Timed Metadata for HTTP Live Streaming (in ID3 format, carried in MPEG-2 TS)
  - AES-128 decryption (AES-128 mode)
  - CEA-708 captions
  - Alternate Audio Track Rendition (Master Playlist with alternative Audio) for VoD playlists  

## Not Supported (Yet)

  - MP3 / WebVTT container
  - Alternate Audio Track Rendition for live playlists

### Supported M3U8 tags

  - `#EXTM3U`
  - `#EXTINF`
  - `#EXT-X-STREAM-INF` (adaptive streaming)
  - `#EXT-X-ENDLIST` (Live playlist)
  - `#EXT-X-MEDIA-SEQUENCE`
  - `#EXT-X-TARGETDURATION`
  - `#EXT-X-DISCONTINUITY`
  - `#EXT-X-BYTERANGE`
  - `#EXT-X-KEY` (https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4)
  - `#EXT-X-PROGRAM-DATE-TIME` (https://tools.ietf.org/html/draft-pantos-http-live-streaming-18#section-4.3.2.6)
  - `EXT-X-START:TIME-OFFSET=x` (https://tools.ietf.org/html/draft-pantos-http-live-streaming-18#section-4.3.5.2)

## Getting Started

```js
<script src="https://cdn.jsdelivr.net/hls.js/latest/hls.min.js"></script>
<video id="video"></video>
<script>
  if(Hls.isSupported()) {
    var video = document.getElementById('video');
    var hls = new Hls();
    hls.loadSource('http://www.streambox.fr/playlists/test_001/stream.m3u8');
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,function() {
      video.play();
  });
 }
</script>
```

## Video Control

Video is controlled through HTML ```<video>``` element.

HTMLVideoElement control and events could be used seamlessly.


## API and Configuration Parameters

hls.js can be configured and controlled easily, click [here](API.md) for details.


## License

  hls.js is released under [Apache 2.0 License](LICENSE)

## Contributing

Pull requests are welcome. Here is a quick guide on how to start.

 - First, checkout the repository and install required dependencies
```sh
git clone https://github.com/dailymotion/hls.js.git
# setup dev environement
cd hls.js
npm install
# build dist/hls.js, watch file change for rebuild and launch demo page
npm run dev
# lint
npm run lint
```
 - Use [EditorConfig](http://editorconfig.org/) or at least stay consistent to the file formats defined in the `.editorconfig` file.
 - Develop in a topic branch, not master
 - Don't commit the updated `dist/hls.js` file in your PR. We'll take care of generating an updated build right before releasing a new tagged version.

## Design

Click [here](design.md) for details.

[npm-image]: https://img.shields.io/npm/v/hls.js.svg?style=flat
[npm-url]: https://npmjs.org/package/hls.js
