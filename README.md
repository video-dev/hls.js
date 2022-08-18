[![npm](https://img.shields.io/npm/v/hls.js.svg?style=flat)](https://npmjs.org/package/hls.js)
[![npm](https://img.shields.io/npm/v/hls.js/canary.svg?style=flat)](https://www.npmjs.com/package/hls.js/v/canary)
[![](https://data.jsdelivr.com/v1/package/npm/hls.js/badge?style=rounded)](https://www.jsdelivr.com/package/npm/hls.js)
[![Sauce Test Status](https://saucelabs.com/buildstatus/robwalch)](https://app.saucelabs.com/u/robwalch)

[comment]: <> ([![Sauce Test Status]&#40;https://saucelabs.com/browser-matrix/robwalch.svg&#41;]&#40;https://saucelabs.com/u/robwalch&#41;)

# ![HLS.js](./docs/logo.svg)

HLS.js is a JavaScript library that implements an [HTTP Live Streaming] client.
It relies on [HTML5 video][] and [MediaSource Extensions][] for playback.

It works by transmuxing MPEG-2 Transport Stream and AAC/MP3 streams into ISO BMFF (MP4) fragments.
Transmuxing is performed asynchronously using a [Web Worker] when available in the browser.
HLS.js also supports HLS + fmp4, as announced during [WWDC2016](https://developer.apple.com/videos/play/wwdc2016/504/).

HLS.js works directly on top of a standard HTML`<video>` element.

HLS.js is written in [ECMAScript6] (`*.js`) and [TypeScript] (`*.ts`) (strongly typed superset of ES6), and transpiled in ECMAScript5 using [Babel](https://babeljs.io/) and the [TypeScript compiler].

[Webpack] is used to build the distro bundle and serve the local development environment.

[html5 video]: https://www.html5rocks.com/en/tutorials/video/basics/
[mediasource extensions]: https://w3c.github.io/media-source/
[http live streaming]: https://en.wikipedia.org/wiki/HTTP_Live_Streaming
[web worker]: https://caniuse.com/#search=worker
[ecmascript6]: https://github.com/ericdouglas/ES6-Learning#articles--tutorials
[typescript]: https://www.typescriptlang.org/
[typescript compiler]: https://www.typescriptlang.org/docs/handbook/compiler-options.html
[webpack]: https://webpack.js.org/

## Features

- VOD & Live playlists
  - DVR support on Live playlists
- Fragmented MP4 container
- MPEG-2 TS container
  - ITU-T Rec. H.264 and ISO/IEC 14496-10 Elementary Stream
  - ISO/IEC 13818-7 ADTS AAC Elementary Stream
  - ISO/IEC 11172-3 / ISO/IEC 13818-3 (MPEG-1/2 Audio Layer III) Elementary Stream
  - Packetized metadata (ID3v2.3.0) Elementary Stream
- AAC container (audio only streams)
- MPEG Audio container (MPEG-1/2 Audio Layer III audio only streams)
- Timed Metadata for HTTP Live Streaming (ID3 format carried in MPEG-2 TS, Emsg in CMAF/Fragmented MP4, and DATERANGE playlist tags)
- AES-128 decryption
- SAMPLE-AES decryption (only supported if using MPEG-2 TS container)
- Encrypted media extensions (EME) support for DRM (digital rights management)
  - Widevine CDM (only tested with [shaka-packager](https://github.com/google/shaka-packager) test-stream on [the demo page](https://hls-js.netlify.app/demo/?src=https%3A%2F%2Fstorage.googleapis.com%2Fshaka-demo-assets%2Fangel-one-widevine-hls%2Fhls.m3u8&demoConfig=eyJlbmFibGVTdHJlYW1pbmciOnRydWUsImF1dG9SZWNvdmVyRXJyb3IiOnRydWUsInN0b3BPblN0YWxsIjpmYWxzZSwiZHVtcGZNUDQiOmZhbHNlLCJsZXZlbENhcHBpbmciOi0xLCJsaW1pdE1ldHJpY3MiOi0xfQ==))
- CEA-608/708 captions
- WebVTT subtitles
- Alternate Audio Track Rendition (Master Playlist with Alternative Audio) for VoD and Live playlists
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
  - All internal events can be monitored (Network Events, Video Events)
  - Playback session metrics are also exposed
- Resilience to errors
  - Retry mechanism embedded in the library
  - Recovery actions can be triggered fix fatal media or network errors
- [Redundant/Failover Playlists](https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/StreamingMediaGuide/UsingHTTPLiveStreaming/UsingHTTPLiveStreaming.html#//apple_ref/doc/uid/TP40008332-CH102-SW22)

### Supported M3U8 tags

For details on the HLS format and these tags' meanings, see https://tools.ietf.org/html/draft-pantos-hls-rfc8216bis-08

#### Manifest tags

- `#EXT-X-STREAM-INF:<attribute-list>`
  `<URI>`
- `#EXT-X-MEDIA:<attribute-list>`
- `#EXT-X-SESSION-DATA:<attribute-list>`

The following properties are added to their respective variants' attribute list but are not implemented in their selection and playback.

- `VIDEO-RANGE` and `HDCP-LEVEL` (See [#2489](https://github.com/video-dev/hls.js/issues/2489))

#### Playlist tags

- `#EXTM3U`
- `#EXT-X-VERSION=<n>`
- `#EXTINF:<duration>,[<title>]`
- `#EXT-X-ENDLIST`
- `#EXT-X-MEDIA-SEQUENCE=<n>`
- `#EXT-X-TARGETDURATION=<n>`
- `#EXT-X-DISCONTINUITY`
- `#EXT-X-DISCONTINUITY-SEQUENCE=<n>`
- `#EXT-X-BYTERANGE=<n>[@<o>]`
- `#EXT-X-MAP:<attribute-list>`
- `#EXT-X-KEY:<attribute-list>` (`METHOD=SAMPLE-AES` is only supports with MPEG-2 TS segments)
- `#EXT-X-PROGRAM-DATE-TIME:<attribute-list>`
- `#EXT-X-START:TIME-OFFSET=<n>`
- `#EXT-X-SERVER-CONTROL:<attribute-list>`
- `#EXT-X-PART-INF:PART-TARGET=<n>`
- `#EXT-X-PART:<attribute-list>`
- `#EXT-X-PRELOAD-HINT:<attribute-list>`
- `#EXT-X-SKIP:<attribute-list>`
- `#EXT-X-RENDITION-REPORT:<attribute-list>`
- `#EXT-X-DATERANGE:<attribute-list>`

The following tags are added to their respective fragment's attribute list but are not implemented in streaming and playback.

- `#EXT-X-BITRATE` (Not used in ABR controller)
- `#EXT-X-GAP` (Not implemented. See [#2940](https://github.com/video-dev/hls.js/issues/2940))

### Not Supported

For a complete list of issues, see ["Top priorities" in the Release Planning and Backlog project tab](https://github.com/video-dev/hls.js/projects/6). Codec support is dependent on the runtime environment (for example, not all browsers on the same OS support HEVC).

- FairPlay and PlayReady DRM ( See [#3779](https://github.com/video-dev/hls.js/issues/2360) and [issues labeled DRM](https://github.com/video-dev/hls.js/issues?q=is%3Aissue+is%3Aopen+label%3ADRM))
- Advanced variant selection based on runtime media capabilities (See issues labeled [`media-capabilities`](https://github.com/video-dev/hls.js/labels/media-capabilities))
- HLS Content Steering
- HLS Interstitials
- `#EXT-X-DEFINE` variable substitution
- `#EXT-X-GAP` filling [#2940](https://github.com/video-dev/hls.js/issues/2940)
- `#EXT-X-I-FRAME-STREAM-INF` I-frame Media Playlist files
- `SAMPLE-AES` with fmp4, aac, mp3, vtt... segments (MPEG-2 TS only)

### Server-side-rendering (SSR) and `require` from a Node.js runtime

You can safely require this library in Node and **absolutely nothing will happen**. A dummy object is exported so that requiring the library does not throw an error. HLS.js is not instantiable in Node.js. See [#1841](https://github.com/video-dev/hls.js/pull/1841) for more details.

## Getting started with development

First, checkout the repository and install the required dependencies

```sh
git clone https://github.com/video-dev/hls.js.git
cd hls.js
# After cloning or pulling from the repository, make sure all dependencies are up-to-date
npm install ci
# Run dev-server for demo page (recompiles on file-watch, but doesn't write to actual dist fs artifacts)
npm run dev
# After making changes run the sanity-check task to verify all checks before committing changes
npm run sanity-check
```

The dev server will host files on port 8000. Once started, the demo can be found running at http://localhost:8000/demo/.

Before submitting a PR, please see our [contribution guidelines](CONTRIBUTING.md).
Join the discussion on Slack via [video-dev.org](https://video-dev.org) in #hlsjs for updates and questions about development.

### Build tasks

Build all flavors (suitable for prod-mode/CI):

```
npm install ci
npm run build
```

Only debug-mode artifacts:

```
npm run build:debug
```

Build and watch (customized dev setups where you'll want to host through another server than webpacks' - for example in a sub-module/project)

```
npm run build:watch
```

Only specific flavor (known configs are: debug, dist, light, light-dist, demo):

```
npm run build -- --env dist # replace "dist" by other configuration name, see above ^
```

Note: The "demo" config is always built.

**NOTE:** `hls.light.*.js` dist files do not include EME, subtitles, CMCD, or alternate-audio support. In addition,
the following types are not available in the light build:

- `AudioStreamController`
- `AudioTrackController`
- `CuesInterface`
- `EMEController`
- `SubtitleStreamController`
- `SubtitleTrackController`
- `TimelineController`
- `CmcdController`

### Linter (ESlint)

Run linter:

```
npm run lint
```

Run linter with auto-fix mode:

```
npm run lint:fix
```

Run linter with errors only (no warnings)

```
npm run lint:quiet
```

### Formatting Code

Run prettier to format code

```
npm run prettier
```

### Type Check

Run type-check to verify TypeScript types

```
npm run type-check
```

### Automated tests (Mocha/Karma)

Run all tests at once:

```
npm test
```

Run unit tests:

```
npm run test:unit
```

Run unit tests in watch mode:

```
npm run test:unit:watch
```

Run functional (integration) tests:

```
npm run test:func
```

## Design

An overview of this project's design, it's modules, events, and error handling can be found [here](/docs/design.md).

## API docs and usage guide

- [API and usage docs, with code examples](./docs/API.md)
- [Auto-Generated API Docs (Latest Release)](https://hls-js.netlify.com/api-docs)
- [Auto-Generated API Docs (Development Branch)](https://hls-js-dev.netlify.com/api-docs)

_Note you can access the docs for a particular version using "[https://github.com/video-dev/hls.js/tree/deployments](https://github.com/video-dev/hls.js/tree/deployments)"_

## Demo

### Latest Release

[https://hls-js.netlify.com/demo](https://hls-js.netlify.com/demo)

### Master

[https://hls-js-dev.netlify.com/demo](https://hls-js-dev.netlify.com/demo)

### Specific Version

Find the commit on [https://github.com/video-dev/hls.js/tree/deployments](https://github.com/video-dev/hls.js/tree/deployments).

[![](https://www.netlify.com/img/global/badges/netlify-color-accent.svg)](https://www.netlify.com)

[![](https://opensource.saucelabs.com/images/opensauce/powered-by-saucelabs-badge-gray.png?sanitize=true)](https://saucelabs.com)

## Compatibility

HLS.js is only compatible with browsers supporting MediaSource extensions (MSE) API with 'video/MP4' mime-type inputs.

HLS.js is supported on:

- Chrome 39+ for Android
- Chrome 39+ for Desktop
- Firefox 41+ for Android
- Firefox 42+ for Desktop
- Edge for Windows 10+
- Safari 8+ for MacOS 10.10+
- Safari for ipadOS 13+

A [Promise polyfill](https://github.com/taylorhakes/promise-polyfill) is required in browsers missing native promise support.

**Please note:** iOS Safari on iPhone does not support the MediaSource API. This includes all browsers on iOS as well as apps using UIWebView and WKWebView.

Safari browsers (iOS, iPadOS, and macOS) have built-in HLS support through the plain video "tag" source URL. See the example below (Using HLS.js) to run appropriate feature detection and choose between using HLS.js or natively built-in HLS support.

When a platform has neither MediaSource nor native HLS support, the browser cannot play HLS.

_Keep in mind that if the intention is to support HLS on multiple platforms, beyond those compatible with HLS.js, the HLS streams need to strictly follow the specifications of RFC8216, especially if apps, smart TVs, and set-top boxes are to be supported._

Find a support matrix of the MediaSource API here: https://developer.mozilla.org/en-US/docs/Web/API/MediaSource

## Using HLS.js

### Installation

Prepackaged builds are included [with each release](https://github.com/video-dev/hls.js/releases). Or install the hls.js as a dependency
of your project:

```sh
npm install --save hls.js
```

A canary channel is also available if you prefer to work off the development branch (master):

```
npm install hls.js@canary
```

### Embedding HLS.js

Directly include dist/hls.js or dist/hls.min.js in a script tag on the page. This setup prioritizes HLS.js MSE playback over
native browser support for HLS playback in HTMLMediaElements:

```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<!-- Or if you want the latest version from the main branch -->
<!-- <script src="https://cdn.jsdelivr.net/npm/hls.js@canary"></script> -->
<video id="video"></video>
<script>
  var video = document.getElementById('video');
  var videoSrc = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  if (Hls.isSupported()) {
    var hls = new Hls();
    hls.loadSource(videoSrc);
    hls.attachMedia(video);
  }
  // HLS.js is not supported on platforms that do not have Media Source
  // Extensions (MSE) enabled.
  //
  // When the browser has built-in HLS support (check using `canPlayType`),
  // we can provide an HLS manifest (i.e. .m3u8 URL) directly to the video
  // element through the `src` property. This is using the built-in support
  // of the plain video element, without using HLS.js.
  //
  // Note: it would be more normal to wait on the 'canplay' event below however
  // on Safari (where you are most likely to find built-in HLS support) the
  // video.src URL must be on the user-driven white-list before a 'canplay'
  // event will be emitted; the last video event that can be reliably
  // listened-for when the URL is not on the white-list is 'loadedmetadata'.
  else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = videoSrc;
  }
</script>
```

#### Alternative setup

To check for native browser support first and then fallback to HLS.js, swap these conditionals. See [this comment](https://github.com/video-dev/hls.js/pull/2954#issuecomment-670021358) to understand some of the tradeoffs.

```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<!-- Or if you want the latest version from the main branch -->
<!-- <script src="https://cdn.jsdelivr.net/npm/hls.js@canary"></script> -->
<video id="video"></video>
<script>
  var video = document.getElementById('video');
  var videoSrc = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  //
  // First check for native browser HLS support
  //
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = videoSrc;
    //
    // If no native HLS support, check if HLS.js is supported
    //
  } else if (Hls.isSupported()) {
    var hls = new Hls();
    hls.loadSource(videoSrc);
    hls.attachMedia(video);
  }
</script>
```

For more embed and API examples see [docs/API.md](./docs/API.md).

## CORS

All HLS resources must be delivered with [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS) permitting `GET` requests.

## Video Control

Video is controlled through HTML `<video>` element `HTMLVideoElement` methods, events and optional UI controls (`<video controls>`).

## Player Integration

The following players integrate HLS.js for HLS playback:

- [JW Player](https://www.jwplayer.com)
- [Akamai Adaptive Media Player (AMP)](https://www.akamai.com/us/en/solutions/products/media-delivery/adaptive-media-player.jsp)
- [BridTV Player](https://www.brid.tv)
- [Clappr](https://github.com/clappr/clappr)
- [Flowplayer](https://www.flowplayer.org) through [flowplayer-hlsjs](https://github.com/flowplayer/flowplayer-hlsjs)
- [MediaElement.js](https://www.mediaelementjs.com)
- [Videojs](https://videojs.com) through [Videojs-hlsjs](https://github.com/benjipott/videojs-hlsjs)
- [Videojs](https://videojs.com) through [videojs-hls.js](https://github.com/streamroot/videojs-hls.js). hls.js is integrated as a SourceHandler -- new feature in Video.js 5.
- [Videojs](https://videojs.com) through [videojs-contrib-hls.js](https://github.com/Peer5/videojs-contrib-hls.js). Production ready plug-in with full fallback compatibility built-in.
- [Fluid Player](https://www.fluidplayer.com)
- [OpenPlayerJS](https://www.openplayerjs.com), as part of the [OpenPlayer project](https://github.com/openplayerjs)
- [CDNBye](https://github.com/cdnbye/hlsjs-p2p-engine), a p2p engine for hls.js powered by WebRTC Datachannel.

### They use HLS.js in production!

|                                                                                                                                                              |                                                                                                                                                                         |                                                                                                                                                                |                                                                                                                                                                                                                                         |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|                 [<img src="https://i.cdn.turner.com/adultswim/big/img/global/adultswim.jpg" width="120">](https://www.adultswim.com/streams)                 |                              [<img src="https://avatars3.githubusercontent.com/u/5497190?s=200&v=4" width="120">](https://www.akamai.com)                               |       [<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Canal%2B.svg/2000px-Canal%2B.svg.png" width="120">](https://www.canalplus.fr)       |                                                                 [<img src="https://avatars2.githubusercontent.com/u/115313" width="120">](https://www.dailymotion.com)                                                                  |
|     [<img src="https://user-images.githubusercontent.com/4006693/44003595-baff193c-9e8f-11e8-9848-7bb91563499f.png" width="120">](https://freshlive.tv)      |                                    [<img src="https://flowplayer.org/media/img/logo-blue.png" width="120">](https://flowplayer.com)                                     |                        [<img src="https://avatars1.githubusercontent.com/u/12554082?s=240" width="120">](https://www.foxsports.com.au)                         |                                          [<img src="https://cloud.githubusercontent.com/assets/244265/12556435/dfaceb48-c353-11e5-971b-2c4429725469.png" width="120">](https://www.globo.com)                                           |
|                          [<img src="https://images.gunosy.com/logo/gunosy_icon_company_logo.png" width="120">](https://gunosy.com)                           |      [<img src="https://user-images.githubusercontent.com/1480052/35802840-f8e85b8a-0a71-11e8-8eb2-eee323e3f159.png" width="120">](https://www.gl-systemhaus.de/)       |       [<img src="https://cloud.githubusercontent.com/assets/6525783/20801836/700490de-b7ea-11e6-82bd-e249f91c7bae.jpg" width="120">](https://nettrek.de)       |                                         [<img src="https://cloud.githubusercontent.com/assets/244265/12556385/999aa884-c353-11e5-9102-79df54384498.png" width="120">](https://www.nytimes.com/)                                         |
|    [<img src="https://cloud.githubusercontent.com/assets/1798553/20356424/ba158574-ac24-11e6-95e1-1ae591b11a0a.png" width="120">](https://www.peer5.com/)    |         [<img src="https://cloud.githubusercontent.com/assets/4909096/20925062/e26e6fc8-bbb4-11e6-99a5-d4762274a342.png" width="120">](https://www.qbrick.com)          |          [<img src="https://www.radiantmediaplayer.com/images/radiantmediaplayer-new-logo-640.jpg" width="120">](https://www.radiantmediaplayer.com/)          |                                                             [<img src="https://www.rts.ch/hummingbird-static/images/logos/logo_marts.svg" width="120">](https://www.rts.ch)                                                             |
| [<img src="https://cloud.githubusercontent.com/assets/12702747/19316434/0a3601de-9067-11e6-85e2-936b1cb099a0.png" width="120">](https://www.snapstream.com/) |                    [<img src="https://pamediagroup.com/wp-content/uploads/2019/05/StreamAMG-Logo-RGB.png" width="120">](https://www.streamamg.com/)                     |            [<img src="https://streamsharkio.sa.metacdn.com/wp-content/uploads/2015/10/streamshark-dark.svg" width="120">](https://streamshark.io/)             | [<img src="https://camo.githubusercontent.com/9580f10e9bfa8aa7fba52c5cb447bee0757e33da/68747470733a2f2f7777772e7461626c6f74762e636f6d2f7374617469632f696d616765732f7461626c6f5f6c6f676f2e706e67" width="120">](https://my.tablotv.com/) |
|  [<img src="https://user-images.githubusercontent.com/2803310/34083705-349c8fd0-e375-11e7-92a6-5c38509f4936.png" width="120">](https://www.streamroot.io/)   |             [<img src="https://vignette1.wikia.nocookie.net/tedtalks/images/c/c0/TED_logo.png/revision/20150915192527" width="120">](https://www.ted.com/)              |              [<img src="https://www.seeklogo.net/wp-content/uploads/2014/12/twitter-logo-vector-download.jpg" width="120">](https://twitter.com/)              |                                                                 [<img src="https://player.clevercast.com/img/clevercast.png" width="120">](https://www.clevercast.com)                                                                  |
|                        [<img src="https://player.mtvnservices.com/edge/hosted/Viacom_logo.svg" width="120">](https://www.viacom.com/)                        |             [<img src="https://user-images.githubusercontent.com/1181974/29248959-efabc440-802d-11e7-8050-7c1f4ca6c607.png" width="120">](https://vk.com/)              |                         [<img src="https://avatars0.githubusercontent.com/u/5090060?s=200&v=4" width="120">](https://www.jwplayer.com)                         |                                                   [<img src="https://staticftv-a.akamaihd.net/arches/francetv/default/img/og-image.jpg?20161007" width="120">](https://www.france.tv)                                                   |
|                          [<img src="https://showmax.akamaized.net/e/logo/showmax_black.png" width="120">](https://tech.showmax.com)                          | [<img src="https://static3.1tv.ru/assets/web/logo-ac67852f1625b338f9d1fb96be089d03557d50bfc5790d5f48dc56799f59dec6.svg" width="120" height="120">](https://www.1tv.ru/) |       [<img src="https://user-images.githubusercontent.com/1480052/40482633-c013ebce-5f55-11e8-96d5-b776415de0ce.png" width="120">](https://www.zdf.de)        |                                              [<img src="https://github.com/cdnbye/hlsjs-p2p-engine/blob/master/figs/cdnbye.png" width="120">](https://github.com/cdnbye/hlsjs-p2p-engine)                                               |
|                                                            [cdn77](https://streaming.cdn77.com/)                                                             |                                  [<img src="https://avatars0.githubusercontent.com/u/7442371?s=200&v=4" width="120">](https://r7.com/)                                  | [<img src="https://raw.githubusercontent.com/Novage/p2p-media-loader/gh-pages/images/p2pml-logo.png" width="120">](https://github.com/Novage/p2p-media-loader) |                                                              [<img src="https://avatars3.githubusercontent.com/u/45617200?s=400" width="120">](https://kayosports.com.au)                                                               |
|    [<img src="https://avatars1.githubusercontent.com/u/5279615?s=400&u=9771a216836c613f1edf4afe71cfc69d4c5657ed&v=4" width="120">](https://flosports.tv)     |                  [<img src="https://www.logolynx.com/images/logolynx/c6/c67a2cb3ad33a82b5518f8ad8f124703.png" width="120">](https://global.axon.com/)                   |                              [<img src="https://cms-static.brid.tv/img/brid-logo-120x120.jpg" width="120">](https://www.brid.tv/)                              |                                                                                                                                                                                                                                         |

## Chrome/Firefox integration

made by [gramk](https://github.com/gramk/chrome-hls), plays hls from address bar and m3u8 links

- Chrome [native-hls](https://chrome.google.com/webstore/detail/native-hls-playback/emnphkkblegpebimobpbekeedfgemhof)
- Firefox [native-hls](https://addons.mozilla.org/en-US/firefox/addon/native_hls_playback/)

## License

HLS.js is released under [Apache 2.0 License](LICENSE)
