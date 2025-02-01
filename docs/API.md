# HLS.js v1 API

See [API Reference](https://hlsjs-dev.video-dev.org/api-docs/) for a complete list of interfaces available in the "hls.js" package.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Getting started](#getting-started)
  - [First step: setup and support](#first-step-setup-and-support)
  - [Second step: instantiate Hls object and bind it to `<video>` element](#second-step-instantiate-hls-object-and-bind-it-to-video-element)
  - [Third step: load a manifest](#third-step-load-a-manifest)
  - [Fourth step: control through `<video>` element](#fourth-step-control-through-video-element)
  - [Fifth step: error handling](#fifth-step-error-handling)
    - [Fatal Error Recovery](#fatal-error-recovery)
      - [`hls.recoverMediaError()`](#hlsrecovermediaerror)
        - [Error recovery sample code](#error-recovery-sample-code)
      - [`hls.swapAudioCodec()`](#hlsswapaudiocodec)
  - [Final step: destroying, switching between streams](#final-step-destroying-switching-between-streams)
- [Fine Tuning](#fine-tuning)
  - [`Hls.DefaultConfig get/set`](#hlsdefaultconfig-getset)
  - [`capLevelToPlayerSize`](#capleveltoplayersize)
  - [`capLevelOnFPSDrop`](#caplevelonfpsdrop)
  - [`ignoreDevicePixelRatio`](#ignoredevicepixelratio)
  - [`maxDevicePixelRatio`](#maxdevicepixelratio)
  - [`debug`](#debug)
  - [`autoStartLoad`](#autostartload)
  - [`startPosition`](#startposition)
  - [`defaultAudioCodec`](#defaultaudiocodec)
  - [`initialLiveManifestSize`](#initiallivemanifestsize)
  - [`maxBufferLength`](#maxbufferlength)
  - [`backBufferLength`](#backbufferlength)
  - [`frontBufferFlushThreshold`](#frontbufferflushthreshold)
  - [`maxBufferSize`](#maxbuffersize)
  - [`maxBufferHole`](#maxbufferhole)
  - [`maxStarvationDelay`](#maxstarvationdelay)
  - [`maxLoadingDelay`](#maxloadingdelay)
  - [`lowBufferWatchdogPeriod` (deprecated)](#lowbufferwatchdogperiod-deprecated)
  - [`detectStallWithCurrentTimeMs`](#detectstallwithcurrenttimems)
  - [`highBufferWatchdogPeriod`](#highbufferwatchdogperiod)
  - [`nudgeOffset`](#nudgeoffset)
  - [`nudgeMaxRetry`](#nudgemaxretry)
  - [`nudgeOnVideoHole`](#nudgeonvideohole)
  - [`maxFragLookUpTolerance`](#maxfraglookuptolerance)
  - [`maxMaxBufferLength`](#maxmaxbufferlength)
  - [`liveSyncDurationCount`](#livesyncdurationcount)
  - [`liveSyncOnStallIncrease`](#livesynconstallincrease)
  - [`liveMaxLatencyDurationCount`](#livemaxlatencydurationcount)
  - [`liveSyncDuration`](#livesyncduration)
  - [`liveMaxLatencyDuration`](#livemaxlatencyduration)
  - [`maxLiveSyncPlaybackRate`](#maxlivesyncplaybackrate)
  - [`liveDurationInfinity`](#livedurationinfinity)
  - [`liveBackBufferLength` (deprecated)](#livebackbufferlength-deprecated)
  - [`preferManagedMediaSource`](#prefermanagedmediasource)
  - [`enableWorker`](#enableworker)
  - [`workerPath`](#workerpath)
  - [`enableSoftwareAES`](#enablesoftwareaes)
  - [`startLevel`](#startlevel)
  - [`fragLoadingTimeOut` / `manifestLoadingTimeOut` / `levelLoadingTimeOut` (deprecated)](#fragloadingtimeout--manifestloadingtimeout--levelloadingtimeout-deprecated)
  - [`fragLoadingMaxRetry` / `manifestLoadingMaxRetry` / `levelLoadingMaxRetry` (deprecated)](#fragloadingmaxretry--manifestloadingmaxretry--levelloadingmaxretry-deprecated)
  - [`fragLoadingMaxRetryTimeout` / `manifestLoadingMaxRetryTimeout` / `levelLoadingMaxRetryTimeout` (deprecated)](#fragloadingmaxretrytimeout--manifestloadingmaxretrytimeout--levelloadingmaxretrytimeout-deprecated)
  - [`fragLoadingRetryDelay` / `manifestLoadingRetryDelay` / `levelLoadingRetryDelay` (deprecated)](#fragloadingretrydelay--manifestloadingretrydelay--levelloadingretrydelay-deprecated)
  - [`fragLoadPolicy` / `keyLoadPolicy` / `certLoadPolicy` / `playlistLoadPolicy` / `manifestLoadPolicy` / `steeringManifestLoadPolicy` / `interstitialAssetListLoadPolicy`](#fragloadpolicy--keyloadpolicy--certloadpolicy--playlistloadpolicy--manifestloadpolicy--steeringmanifestloadpolicy--interstitialassetlistloadpolicy)
    - [`LoaderConfig`](#loaderconfig)
      - [`maxTimeToFirstByteMs: number`](#maxtimetofirstbytems-number)
      - [`maxLoadTimeMs: number`](#maxloadtimems-number)
      - [`timeoutRetry: RetryConfig | null`](#timeoutretry-retryconfig--null)
      - [`errorRetry: RetryConfig | null`](#errorretry-retryconfig--null)
    - [`RetryConfig`](#retryconfig)
      - [`maxNumRetry: number`](#maxnumretry-number)
      - [`retryDelayMs: number`](#retrydelayms-number)
      - [`maxRetryDelayMs: number`](#maxretrydelayms-number)
      - [`backoff?: 'exponential' | 'linear'`](#backoff-exponential--linear)
      - [`shouldRetry`](#shouldretry)
  - [`startFragPrefetch`](#startfragprefetch)
  - [`testBandwidth`](#testbandwidth)
  - [`progressive`](#progressive)
  - [`lowLatencyMode`](#lowlatencymode)
  - [`fpsDroppedMonitoringPeriod`](#fpsdroppedmonitoringperiod)
  - [`fpsDroppedMonitoringThreshold`](#fpsdroppedmonitoringthreshold)
  - [`appendErrorMaxRetry`](#appenderrormaxretry)
  - [`loader`](#loader)
  - [`fLoader`](#floader)
  - [`pLoader`](#ploader)
  - [`xhrSetup`](#xhrsetup)
  - [`fetchSetup`](#fetchsetup)
  - [`videoPreference`](#videopreference)
  - [`audioPreference`](#audiopreference)
  - [`subtitlePreference`](#subtitlepreference)
  - [`abrController`](#abrcontroller)
  - [`bufferController`](#buffercontroller)
  - [`capLevelController`](#caplevelcontroller)
  - [`fpsController`](#fpscontroller)
  - [`timelineController`](#timelinecontroller)
  - [`enableDateRangeMetadataCues`](#enabledaterangemetadatacues)
  - [`enableEmsgMetadataCues`](#enableemsgmetadatacues)
  - [`enableEmsgKLVMetadata`](#enableemsgklvmetadata)
  - [`enableID3MetadataCues`](#enableid3metadatacues)
  - [`enableWebVTT`](#enablewebvtt)
  - [`enableIMSC1`](#enableimsc1)
  - [`enableCEA708Captions`](#enablecea708captions)
  - [`captionsTextTrack1Label`](#captionstexttrack1label)
  - [`captionsTextTrack1LanguageCode`](#captionstexttrack1languagecode)
  - [`captionsTextTrack2Label`](#captionstexttrack2label)
  - [`captionsTextTrack2LanguageCode`](#captionstexttrack2languagecode)
  - [`captionsTextTrack3Label`](#captionstexttrack3label)
  - [`captionsTextTrack3LanguageCode`](#captionstexttrack3languagecode)
  - [`captionsTextTrack4Label`](#captionstexttrack4label)
  - [`captionsTextTrack4LanguageCode`](#captionstexttrack4languagecode)
  - [`renderTextTracksNatively`](#rendertexttracksnatively)
  - [`stretchShortVideoTrack`](#stretchshortvideotrack)
  - [`maxAudioFramesDrift`](#maxaudioframesdrift)
  - [`forceKeyFrameOnDiscontinuity`](#forcekeyframeondiscontinuity)
  - [`abrEwmaFastLive`](#abrewmafastlive)
  - [`abrEwmaSlowLive`](#abrewmaslowlive)
  - [`abrEwmaFastVoD`](#abrewmafastvod)
  - [`abrEwmaSlowVoD`](#abrewmaslowvod)
  - [`abrEwmaDefaultEstimate`](#abrewmadefaultestimate)
  - [`abrEwmaDefaultEstimateMax`](#abrewmadefaultestimatemax)
  - [`abrBandWidthFactor`](#abrbandwidthfactor)
  - [`abrBandWidthUpFactor`](#abrbandwidthupfactor)
  - [`abrMaxWithRealBitrate`](#abrmaxwithrealbitrate)
  - [`minAutoBitrate`](#minautobitrate)
  - [`emeEnabled`](#emeenabled)
  - [`widevineLicenseUrl` (deprecated)](#widevinelicenseurl-deprecated)
  - [`licenseXhrSetup`](#licensexhrsetup)
  - [`licenseResponseCallback`](#licenseresponsecallback)
  - [`drmSystems`](#drmsystems)
  - [`drmSystems[KEY-SYSTEM].generateRequest](#drmsystemskey-systemgeneraterequest)
  - [`drmSystemOptions`](#drmsystemoptions)
  - [`requestMediaKeySystemAccessFunc`](#requestmediakeysystemaccessfunc)
  - [`cmcd`](#cmcd)
  - [`enableInterstitialPlayback`](#enableinterstitialplayback)
  - [`interstitialAppendInPlace`](#interstitialappendinplace)
  - [`interstitialLiveLookAhead`](#interstitiallivelookahead)
- [Video Binding/Unbinding API](#video-bindingunbinding-api)
  - [`hls.attachMedia(HTMLMediaElement | MediaAttachingData)`](#hlsattachmediahtmlmediaelement--mediaattachingdata)
  - [`hls.detachMedia()`](#hlsdetachmedia)
  - [`hls.transferMedia(): MediaAttachingData`](#hlstransfermedia-mediaattachingdata)
    - [`hls.media`](#hlsmedia)
- [Quality switch Control API](#quality-switch-control-api)
  - [`hls.levels`](#hlslevels)
  - [`hls.currentLevel`](#hlscurrentlevel)
  - [`hls.nextLevel`](#hlsnextlevel)
  - [`hls.loadLevel`](#hlsloadlevel)
  - [`hls.nextLoadLevel`](#hlsnextloadlevel)
  - [`hls.firstLevel`](#hlsfirstlevel)
  - [`hls.firstAutoLevel`](#hlsfirstautolevel)
  - [`hls.startLevel`](#hlsstartlevel)
  - [`hls.autoLevelEnabled`](#hlsautolevelenabled)
  - [`hls.autoLevelCapping`](#hlsautolevelcapping)
  - [`hls.maxHdcpLevel`](#hlsmaxhdcplevel)
  - [`hls.capLevelToPlayerSize`](#hlscapleveltoplayersize)
  - [`hls.bandwidthEstimate`](#hlsbandwidthestimate)
  - [`hls.removeLevel(levelIndex)`](#hlsremovelevellevelindex)
- [Version Control](#version-control)
  - [`Hls.version`](#hlsversion)
- [Network Loading Control API](#network-loading-control-api)
  - [`hls.startLoad(startPosition=-1,skipSeekToStartPosition=false)`](#hlsstartloadstartposition-1skipseektostartpositionfalse)
  - [`hls.stopLoad()`](#hlsstopload)
  - [`hls.startPosition`](#hlsstartposition)
  - [`hls.pauseBuffering()`](#hlspausebuffering)
  - [`hls.resumeBuffering()`](#hlsresumebuffering)
  - [`hls.bufferingEnabled`](#hlsbufferingenabled)
  - [`hls.bufferedToEnd`](#hlsbufferedtoend)
  - [`hls.inFlightFragments`](#hlsinflightfragments)
  - [`hls.url`](#hlsurl)
- [Audio Tracks Control API](#audio-tracks-control-api)
  - [`hls.setAudioOption(audioOption)`](#hlssetaudiooptionaudiooption)
  - [`hls.allAudioTracks`](#hlsallaudiotracks)
  - [`hls.audioTracks`](#hlsaudiotracks)
  - [`hls.audioTrack`](#hlsaudiotrack)
- [Subtitle Tracks Control API](#subtitle-tracks-control-api)
  - [`hls.setSubtitleOption(subtitleOption)`](#hlssetsubtitleoptionsubtitleoption)
  - [`hls.allSubtitleTracks`](#hlsallsubtitletracks)
  - [`hls.subtitleTracks`](#hlssubtitletracks)
  - [`hls.subtitleTrack`](#hlssubtitletrack)
  - [`hls.subtitleDisplay`](#hlssubtitledisplay)
- [Live stream API](#live-stream-api)
  - [`hls.liveSyncPosition`](#hlslivesyncposition)
  - [`hls.latency`](#hlslatency)
  - [`hls.maxLatency`](#hlsmaxlatency)
  - [`hls.targetLatency`](#hlstargetlatency)
  - [`hls.drift`](#hlsdrift)
  - [`hls.playingDate`](#hlsplayingdate)
- [Interstitials](#interstitials)
  - [Interstitials configuration options](#interstitials-configuration-options)
  - [Interstitials Manager](#interstitials-manager)
    - [`hls.interstitialsManager`](#hlsinterstitialsmanager)
  - [Interstitial Events](#interstitial-events)
  - [Interstitial Objects and Classes](#interstitial-objects-and-classes)
- [Additional data](#additional-data)
  - [`hls.latestLevelDetails`](#hlslatestleveldetails)
  - [`hls.sessionId`](#hlssessionid)
- [Runtime Events](#runtime-events)
- [Creating a Custom Loader](#creating-a-custom-loader)
- [Errors](#errors)
  - [Network Errors](#network-errors)
  - [Media Errors](#media-errors)
  - [Mux Errors](#mux-errors)
  - [EME Key System Errors](#eme-key-system-errors)
  - [Other Errors](#other-errors)
- [Objects](#objects)
  - [Level](#level)
  - [LevelDetails](#leveldetails)
  - [Fragment](#fragment)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Getting started

### First step: setup and support

First include `https://cdn.jsdelivr.net/npm/hls.js@1` (or `/hls.js` for unminified) in your web page.

```html
<script src="//cdn.jsdelivr.net/npm/hls.js@1"></script>
```

Invoke the following static method: `Hls.isSupported()` to check whether your browser supports [MediaSource Extensions](http://w3c.github.io/media-source/) with any baseline codecs.

```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>
<script>
  if (Hls.isSupported()) {
    console.log('Hello HLS.js!');
  }
</script>
```

If you want to test for MSE support without testing for baseline codecs, use `isMSESupported`:

```js
if (
  Hls.isMSESupported() &&
  Hls.getMediaSource().isTypeSupported('video/mp4;codecs="av01.0.01M.08"')
) {
  console.log('Hello AV1 playback! AVC who?');
}
```

### Second step: instantiate Hls object and bind it to `<video>` element

Let's

- create a `<video>` element
- create a new HLS object
- bind video element to this HLS object

```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>

<video id="video"></video>
<script>
  if (Hls.isSupported()) {
    var video = document.getElementById('video');

    // If you are using the ESM version of the library (hls.mjs), you
    // should specify the "workerPath" config option here if you want
    // web workers to be used. Note that bundlers (such as webpack)
    // will likely use the ESM version by default.
    var hls = new Hls();

    // bind them together
    hls.attachMedia(video);
    // MEDIA_ATTACHED event is fired by hls object once MediaSource is ready
    hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      console.log('video and hls.js are now bound together !');
    });
  }
</script>
```

### Third step: load a manifest

You need to provide manifest URL as below:

```html
<script src="https://cdn.jsdelivr.net/npm/hls.js@1"></script>

<video id="video"></video>
<script>
  if (Hls.isSupported()) {
    var video = document.getElementById('video');
    var hls = new Hls();
    hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      console.log('video and hls.js are now bound together !');
    });
    hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
      console.log(
        'manifest loaded, found ' + data.levels.length + ' quality level',
      );
    });
    hls.loadSource('http://my.streamURL.com/playlist.m3u8');
    // bind them together
    hls.attachMedia(video);
  }
</script>
```

### Fourth step: control through `<video>` element

Video is controlled through HTML `<video>` element.

HTMLVideoElement control and events could be used seamlessly.

```js
video.play();
```

### Fifth step: error handling

All errors are signalled through a unique single event.

Each error is categorized by an error type, error details, and whether or not is is `fatal`:

- Error Types:
  - `Hls.ErrorTypes.NETWORK_ERROR` for network related errors
  - `Hls.ErrorTypes.MEDIA_ERROR` for media/video related errors
  - `Hls.ErrorTypes.KEY_SYSTEM_ERROR` for EME related errors
  - `Hls.ErrorTypes.MUX_ERROR` for demuxing/remuxing related errors
  - `Hls.ErrorTypes.OTHER_ERROR` for all other errors
- Error Details:
  - refer to [Errors details](#Errors)
- Error is `fatal`:
  - `false` if error is not fatal, HLS.js will try to recover.
  - `true` if error is fatal, all attempts to recover have been performed. See [LoadPolicies](#fragloadpolicy--keyloadpolicy--certloadpolicy--playlistloadpolicy--manifestloadpolicy--steeringmanifestloadpolicy--interstitialAssetListLoadPolicy) details on how to configure retries.

Full details are described [below](#Errors)

See sample code below to listen to errors:

```js
hls.on(Hls.Events.ERROR, function (event, data) {
  var errorType = data.type;
  var errorDetails = data.details;
  var errorFatal = data.fatal;

  switch (data.details) {
    case Hls.ErrorDetails.FRAG_LOAD_ERROR:
      // ....
      break;
    default:
      break;
  }
});
```

#### Fatal Error Recovery

HLS.js provides several methods for attempting playback recover in the event of a decoding error in the HTMLMediaElement:

##### `hls.recoverMediaError()`

Resets the MediaSource and restarts streaming from the last known playhead position.

###### Error recovery sample code

```js
hls.on(Hls.Events.ERROR, function (event, data) {
  if (data.fatal) {
    switch (data.type) {
      case Hls.ErrorTypes.MEDIA_ERROR:
        console.log('fatal media error encountered, try to recover');
        hls.recoverMediaError();
        break;
      case Hls.ErrorTypes.NETWORK_ERROR:
        console.error('fatal network error encountered', data);
        // All retries and media options have been exhausted.
        // Immediately trying to restart loading could cause loop loading.
        // Consider modifying loading policies to best fit your asset and network
        // conditions (manifestLoadPolicy, playlistLoadPolicy, fragLoadPolicy).
        break;
      default:
        // cannot recover
        hls.destroy();
        break;
    }
  }
});
```

##### `hls.swapAudioCodec()`

`hls.swapAudioCodec()` can be used in the place of `hls.recoverMediaError()` when dealing with user agents that have issues handling HE-AAC and AAC audio (mp4a.40.5 and mp4a.40.2) codecs and media.

This should no longer be required and is not recommended. If you find a case where it is, please [file a bug](https://github.com/video-dev/hls.js/issues/new?template=bug.yaml) with steps to reproduce.

### Final step: destroying, switching between streams

`hls.destroy()` should be called to free used resources and destroy hls context.

## Fine Tuning

Configuration parameters could be provided to HLS.js upon instantiation of `Hls` object.

```js
var config = {
  autoStartLoad: true,
  startPosition: -1,
  debug: false,
  capLevelOnFPSDrop: false,
  capLevelToPlayerSize: false,
  defaultAudioCodec: undefined,
  initialLiveManifestSize: 1,
  maxBufferLength: 30,
  maxMaxBufferLength: 600,
  backBufferLength: Infinity,
  frontBufferFlushThreshold: Infinity,
  maxBufferSize: 60 * 1000 * 1000,
  maxBufferHole: 0.1,
  highBufferWatchdogPeriod: 2,
  nudgeOffset: 0.1,
  nudgeMaxRetry: 3,
  maxFragLookUpTolerance: 0.25,
  liveSyncDurationCount: 3,
  liveSyncOnStallIncrease: 1,
  liveMaxLatencyDurationCount: Infinity,
  liveDurationInfinity: false,
  preferManagedMediaSource: false,
  enableWorker: true,
  enableSoftwareAES: true,
  fragLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 9000,
      maxLoadTimeMs: 100000,
      timeoutRetry: {
        maxNumRetry: 2,
        retryDelayMs: 0,
        maxRetryDelayMs: 0,
      },
      errorRetry: {
        maxNumRetry: 5,
        retryDelayMs: 3000,
        maxRetryDelayMs: 15000,
        backoff: 'linear',
      },
    },
  },
  startLevel: undefined,
  audioPreference: {
    characteristics: 'public.accessibility.describes-video',
  },
  subtitlePreference: {
    lang: 'en-US',
  },
  startFragPrefetch: false,
  testBandwidth: true,
  progressive: false,
  lowLatencyMode: true,
  fpsDroppedMonitoringPeriod: 5000,
  fpsDroppedMonitoringThreshold: 0.2,
  appendErrorMaxRetry: 3,
  loader: customLoader,
  fLoader: customFragmentLoader,
  pLoader: customPlaylistLoader,
  xhrSetup: XMLHttpRequestSetupCallback,
  fetchSetup: FetchSetupCallback,
  abrController: AbrController,
  bufferController: BufferController,
  capLevelController: CapLevelController,
  fpsController: FPSController,
  timelineController: TimelineController,
  enableDateRangeMetadataCues: true,
  enableMetadataCues: true,
  enableID3MetadataCues: true,
  enableWebVTT: true,
  enableIMSC1: true,
  enableCEA708Captions: true,
  stretchShortVideoTrack: false,
  maxAudioFramesDrift: 1,
  forceKeyFrameOnDiscontinuity: true,
  abrEwmaFastLive: 3.0,
  abrEwmaSlowLive: 9.0,
  abrEwmaFastVoD: 3.0,
  abrEwmaSlowVoD: 9.0,
  abrEwmaDefaultEstimate: 500000,
  abrEwmaDefaultEstimateMax: 5000000,
  abrBandWidthFactor: 0.95,
  abrBandWidthUpFactor: 0.7,
  abrMaxWithRealBitrate: false,
  maxStarvationDelay: 4,
  maxLoadingDelay: 4,
  minAutoBitrate: 0,
  emeEnabled: false,
  licenseXhrSetup: undefined,
  drmSystems: {},
  drmSystemOptions: {},
  requestMediaKeySystemAccessFunc: requestMediaKeySystemAccess,
  cmcd: {
    sessionId: uuid(),
    contentId: hash(contentURL),
    useHeaders: false,
  },
};

var hls = new Hls(config);
```

### `Hls.DefaultConfig get/set`

This getter/setter allows retrieval and override of the Hls default configuration.
This configuration will be applied by default to all instances.

### `capLevelToPlayerSize`

(default: `false`)

- if set to true, the adaptive algorithm with limit levels usable in auto-quality by the HTML video element dimensions (width and height).
  If dimensions between multiple levels are equal, the cap is chosen as the level with the greatest bandwidth.
  In some devices, the video element dimensions will be multiplied by the device pixel ratio.
  Use `ignoreDevicePixelRatio` for a strict level limitation based on the size of the video element.
- if set to false, levels will not be limited. All available levels could be used in auto-quality mode taking only bandwidth into consideration.

### `capLevelOnFPSDrop`

(default: `false`)

- when set to true, if the number of dropped frames over the period `config.fpsDroppedMonitoringPeriod` exceeds the ratio set by `config.fpsDroppedMonitoringThreshold`,
  then the quality level is dropped and capped at this lower level.
- when set to false, levels will not be limited. All available levels could be used in auto-quality mode taking only bandwidth into consideration.

### `ignoreDevicePixelRatio`

(default: `false`)

- when set to true, calculations related to player size will ignore browser `devicePixelRatio`.
- when set to false, calculations related to player size will respect browser `devicePixelRatio`.

### `maxDevicePixelRatio`

(default: `Number.POSITIVE_INFINITY`)

- when set, calculations related to player size will limit the browser's `devicePixelRatio` to this specified value.

### `debug`

(default: `false`)

Setting `config.debug = true;` will turn on debug logs on JS console.

A logger object could also be provided for custom logging: `config.debug = customLogger;`.

### `autoStartLoad`

(default: `true`)

- if set to true, start level playlist and first fragments will be loaded automatically, after triggering of `Hls.Events.MANIFEST_PARSED` event
- if set to false, an explicit API call (`hls.startLoad(startPosition=-1)`) will be needed to start quality level/fragment loading.

### `startPosition`

(default -1)

- if set to -1, playback will start from initialTime=0 for VoD and according to `liveSyncDuration/liveSyncDurationCount` config params for Live
- Otherwise, playback will start from predefined value. (unless stated otherwise in `autoStartLoad=false` mode : in that case startPosition can be overridden using `hls.startLoad(startPosition)`).

### `defaultAudioCodec`

(default: `undefined`)

Use this to override the multi-variant playlist audio codec, or provide one if loading only a media playlist.

HLS.js parses track codecs from mp4 stsd or ADTS object type in the case of AAC in MPEG-TS. If there is an error using the value it finds in the segments, it will fallback to codec found in the multi-variant playlist or `defaultAudioCodec`.

This should no longer be required and is not recommended. If you find a case where it is, please [file a bug](https://github.com/video-dev/hls.js/issues/new?template=bug.yaml) with steps to reproduce.

### `initialLiveManifestSize`

(default 1)

number of segments needed to start a playback of Live stream. Buffering will begin after N chunks are available in the current playlist. If you want playback to begin `liveSyncDurationCount` chunks from the live edge at the beginning of a stream, set `initialLiveManifestSize` to `liveSyncDurationCount` or higher.

### `maxBufferLength`

(default: `30` seconds)

Maximum buffer length in seconds. If buffer length is/become less than this value, a new fragment will be loaded.
This is the guaranteed buffer length HLS.js will try to reach, regardless of maxBufferSize.

### `backBufferLength`

(default: `Infinity`)

The maximum duration of buffered media to keep once it has been played, in seconds. Any video buffered past this duration will be evicted. `Infinity` means no restriction on back buffer length; `0` keeps the minimum amount. The minimum amount is equal to the target duration of a segment to ensure that current playback is not interrupted. Keep in mind, the browser can and does evict media from the buffer on its own, so with the `Infinity` setting, HLS.js will let the browser do what it needs to do. (Ref: the MSE spec under [coded frame eviction](https://www.w3.org/TR/media-source-2/#sourcebuffer-coded-frame-eviction)).

### `frontBufferFlushThreshold`

(default: `Infinity`)

The maximum duration of buffered media, in seconds, from the play position to keep before evicting non-contiguous forward ranges. A value of `Infinity` means no active eviction will take place; This value will always be at least the `maxBufferLength`.

### `maxBufferSize`

(default: 60 MB)

'Minimum' maximum buffer size in bytes. If buffer size upfront is bigger than this value, no fragment will be loaded.

### `maxBufferHole`

(default: `0.1` seconds)

'Maximum' inter-fragment buffer hole tolerance that HLS.js can cope with when searching for the next fragment to load.
When switching between quality level, fragments might not be perfectly aligned.
This could result in small overlapping or hole in media buffer. This tolerance factor helps cope with this.

### `maxStarvationDelay`

(default 4s)

ABR algorithm will always try to choose a quality level that should avoid rebuffering.
In case no quality level with this criteria can be found (lets say for example that buffer length is 1s,
but fetching a fragment at lowest quality is predicted to take around 2s ... ie we can forecast around 1s of rebuffering ...)
then ABR algorithm will try to find a level that should guarantee less than `maxStarvationDelay` of buffering.

### `maxLoadingDelay`

(default 4s)

max video loading delay used in automatic start level selection : in that mode ABR controller will ensure that video loading time
(ie the time to fetch the first fragment at lowest quality level + the time to fetch the fragment at the appropriate quality level is less than `maxLoadingDelay` )

### `lowBufferWatchdogPeriod` (deprecated)

`lowBufferWatchdogPeriod` has been deprecated. Use `highBufferWatchdogPeriod` instead.

### `detectStallWithCurrentTimeMs`

(default: `1250` milliseconds)

The amount of time that playback can progress without `currentTime` advancing before HLS.js will report a stall. Note that stalls are detected immediately when the attached HTMLMediaElement dispatched the "waiting" event outside of startup and seeking. `detectStallWithCurrentTimeMs` is used when "waiting" is not dispatched and `currentTime` fails to advance without a reasonable interval.

### `highBufferWatchdogPeriod`

(default 3s)

if media element is expected to play and if currentTime has not moved for more than `highBufferWatchdogPeriod` and if there are more than `maxBufferHole` seconds buffered upfront, HLS.js will jump buffer gaps, or try to nudge playhead to recover playback

### `nudgeOffset`

(default: `0.1` seconds)

In case playback continues to stall after first playhead nudging, currentTime will be nudged evenmore following nudgeOffset to try to restore playback.
`media.currentTime += <number of nudge retries> * nudgeOffset`

### `nudgeMaxRetry`

(default: `3`)

Max number of playhead (`currentTime`) nudges before HLS.js raise a fatal BUFFER_STALLED_ERROR

### `nudgeOnVideoHole`

(default: `true`)

Whether or not HLS.js should perform a seek nudge to flush the rendering pipeline upon traversing a gap or hole in video SourceBuffer buffered time ranges. This is only performed when audio is buffered at the point where the hole is detected. For more information see `nudgeOnVideoHole` in gap-controller and issues https://issues.chromium.org/issues/40280613#comment10 and https://github.com/video-dev/hls.js/issues/5631.

### `maxFragLookUpTolerance`

(default 0.25s)

This tolerance factor is used during fragment lookup.
Instead of checking whether buffered.end is located within [start, end] range, frag lookup will be done by checking within [start-maxFragLookUpTolerance, end-maxFragLookUpTolerance] range.

This tolerance factor is used to cope with situations like:

```
buffered.end = 9.991
frag[0] : [0,10]
frag[1] : [10,20]
```

`buffered.end` is within `frag[0]` range, but as we are close to `frag[1]`, `frag[1]` should be choosen instead

If `maxFragLookUpTolerance = 0.2`, this lookup will be adjusted to

```
frag[0] : [-0.2,9.8]
frag[1] : [9.8,19.8]
```

This time, `buffered.end` is within `frag[1]` range, and `frag[1]` will be the next fragment to be loaded, as expected.

### `maxMaxBufferLength`

(default 600s)

Maximum buffer length in seconds. HLS.js will never exceed this value, even if `maxBufferSize` is not reached yet.

HLS.js tries to buffer up to a maximum number of bytes (60 MB by default) rather than to buffer up to a maximum nb of seconds.
this is to mimic the browser behaviour (the buffer eviction algorithm is starting after the browser detects that video buffer size reaches a limit in bytes)

`maxBufferLength` is the minimum guaranteed buffer length that HLS.js will try to achieve, even if that value exceeds the amount of bytes 60 MB of memory.
`maxMaxBufferLength` acts as a capping value, as if bitrate is really low, you could need more than one hour of buffer to fill 60 MB.

### `liveSyncDurationCount`

(default: `3`)

edge of live delay, expressed in multiple of `EXT-X-TARGETDURATION`.
if set to 3, playback will start from fragment N-3, N being the last fragment of the live playlist.
decreasing this value is likely to cause playback stalls.

### `liveSyncOnStallIncrease`

(default: `1`)

increment to the calculated `hls.targetLatency` on each playback stall, expressed in seconds.
When `liveSyncDuration` is specified in config,
`hls.targetLatency` is calculated as `liveSyncDuration` plus `liveSyncOnStallIncrease` multiplied by number of stalls.
Otherwise `hls.targetLatency` is calculated as `liveSyncDurationCount` multiplied by `EXT-X-TARGETDURATION`
plus `liveSyncOnStallIncrease` multiplied by number of stalls.
Decreasing this value will mean that each stall will have less affect on `hls.targetLatency`.

### `liveMaxLatencyDurationCount`

(default: `Infinity`)

maximum delay allowed from edge of live, expressed in multiple of `EXT-X-TARGETDURATION`.
if set to 10, the player will seek back to `liveSyncDurationCount` whenever the next fragment to be loaded is older than N-10, N being the last fragment of the live playlist.
If set, this value must be stricly superior to `liveSyncDurationCount`
a value too close from `liveSyncDurationCount` is likely to cause playback stalls.

### `liveSyncDuration`

(default: `undefined`)

Alternative parameter to `liveSyncDurationCount`, expressed in seconds vs number of segments.
If defined in the configuration object, `liveSyncDuration` will take precedence over the default `liveSyncDurationCount`.
You can't define this parameter and either `liveSyncDurationCount` or `liveMaxLatencyDurationCount` in your configuration object at the same time.
A value too low (inferior to ~3 segment durations) is likely to cause playback stalls.

### `liveMaxLatencyDuration`

(default: `undefined`)

Alternative parameter to `liveMaxLatencyDurationCount`, expressed in seconds vs number of segments.
If defined in the configuration object, `liveMaxLatencyDuration` will take precedence over the default `liveMaxLatencyDurationCount`.
If set, this value must be stricly superior to `liveSyncDuration` which must be defined as well.
You can't define this parameter and either `liveSyncDurationCount` or `liveMaxLatencyDurationCount` in your configuration object at the same time.
A value too close from `liveSyncDuration` is likely to cause playback stalls.

### `maxLiveSyncPlaybackRate`

(default: `1` min: `1` max: `2`)

When set to a value greater than `1`, the latency-controller will adjust `video.playbackRate` up to `maxLiveSyncPlaybackRate` to catch up to target latency in a live stream. `hls.targetLatency` is based on `liveSyncDuration|Count` or manifest PART-|HOLD-BACK.

The default value is `1`, which disables playback rate adjustment. Set `maxLiveSyncPlaybackRate` to a value greater than `1` to enable playback rate adjustment at the live edge.

### `liveDurationInfinity`

(default: `false`)

Override current Media Source duration to `Infinity` for a live broadcast.
Useful, if you are building a player which relies on native UI capabilities in modern browsers.
If you want to have a native Live UI in environments like iOS Safari, Safari, Android Google Chrome, etc. set this value to `true`.

### `liveBackBufferLength` (deprecated)

`liveBackBufferLength` has been deprecated. Use `backBufferLength` instead.

### `preferManagedMediaSource`

(default `true`)

HLS.js uses the Managed Media Source API (`ManagedMediaSource` global) instead of the `MediaSource` global by default when present. Setting this to `false` will only use `ManagedMediaSource` when `MediaSource` is undefined.

### `enableWorker`

(default: `true`)

Enable WebWorker (if available on browser) for TS demuxing/MP4 remuxing, to improve performance and avoid lag/frame drops.

### `workerPath`

(default: `null`)

Provide a path to hls.worker.js as an alternative to injecting the worker based on the iife library wrapper function. When `workerPath` is defined as a string, the transmuxer interface will initialize a WebWorker using the resolved `workerPath` URL.

When using the ESM version of the library (hls.mjs), this option is required in order for web workers to be used.

### `enableSoftwareAES`

(default: `true`)

Enable to use JavaScript version AES decryption for fallback of WebCrypto API.

### `startLevel`

(default: `undefined`)

When set, use this level as the default `hls.startLevel`. Keep in mind that the `startLevel` set with the API takes precedence over config.startLevel configuration parameter. `startLevel` should be set to value between 0 and the maximum index of `hls.levels`.

### `fragLoadingTimeOut` / `manifestLoadingTimeOut` / `levelLoadingTimeOut` (deprecated)

(default: 20000ms for fragment / 10000ms for level and manifest)

x-LoadingTimeOut settings have been deprecated. Use one of the LoadPolicy settings instead.

### `fragLoadingMaxRetry` / `manifestLoadingMaxRetry` / `levelLoadingMaxRetry` (deprecated)

(default: `6` / `1` / `4`)

x-LoadingMaxRetry settings have been deprecated. Use one of the LoadPolicy settings instead.

### `fragLoadingMaxRetryTimeout` / `manifestLoadingMaxRetryTimeout` / `levelLoadingMaxRetryTimeout` (deprecated)

(default: `64000` ms)

x-LoadingMaxRetryTimeout settings have been deprecated. Use one of the LoadPolicy settings instead.

Maximum frag/manifest/key retry timeout (in milliseconds).
This value is used as capping value for exponential grow of `loading retry delays`, i.e. the retry delay can not be bigger than this value, but overall time will be based on the overall number of retries.

### `fragLoadingRetryDelay` / `manifestLoadingRetryDelay` / `levelLoadingRetryDelay` (deprecated)

(default: `1000` ms)

x-LoadingRetryDelay settings have been deprecated. Use one of the LoadPolicy settings instead.

Initial delay between `XMLHttpRequest` error and first load retry (in ms).
Any I/O error will trigger retries every 500ms,1s,2s,4s,8s, ... capped to `fragLoadingMaxRetryTimeout` / `manifestLoadingMaxRetryTimeout` / `levelLoadingMaxRetryTimeout` value (exponential backoff).

### `fragLoadPolicy` / `keyLoadPolicy` / `certLoadPolicy` / `playlistLoadPolicy` / `manifestLoadPolicy` / `steeringManifestLoadPolicy` / `interstitialAssetListLoadPolicy`

LoadPolicies specify the default settings for request timeouts and the timing and number of retries after a request error or timeout for a particular type of asset.

- `manifestLoadPolicy`: The `LoadPolicy` for Multivariant Playlist requests
- `playlistLoadPolicy`: The `LoadPolicy` for Media Playlist requests
- `fragLoadPolicy`: The `LoadPolicy` for Segment and Part\* requests
- `keyLoadPolicy`: The `LoadPolicy` for Key requests
- `certLoadPolicy`: The `LoadPolicy` for License Server certificate requests
- `steeringManifestLoadPolicy`: The `LoadPolicy` for Content Steering manifest requests
- `interstitialAssetListLoadPolicy`: The `LoadPolicy` Interstitial asset list requests

\*Some timeout settings are adjusted for Low-Latency Part requests based on Part duration or target.

Each `LoadPolicy` contains a set of contexts. The `default` property is the only context supported at this time. It contains the `LoaderConfig` for that asset type. Future releases may include support for other policy contexts besides `default`.

HLS.js config defines the following default policies. Each can be overridden on player instantiation in the user configuration:

```js
manifestLoadPolicy: {
  default: {
    maxTimeToFirstByteMs: Infinity,
    maxLoadTimeMs: 20000,
    timeoutRetry: {
      maxNumRetry: 2,
      retryDelayMs: 0,
      maxRetryDelayMs: 0,
    },
    errorRetry: {
      maxNumRetry: 1,
      retryDelayMs: 1000,
      maxRetryDelayMs: 8000,
    },
  },
},
playlistLoadPolicy: {
  default: {
    maxTimeToFirstByteMs: 10000,
    maxLoadTimeMs: 20000,
    timeoutRetry: {
      maxNumRetry: 2,
      retryDelayMs: 0,
      maxRetryDelayMs: 0,
    },
    errorRetry: {
      maxNumRetry: 2,
      retryDelayMs: 1000,
      maxRetryDelayMs: 8000,
    },
  },
},
fragLoadPolicy: {
  default: {
    maxTimeToFirstByteMs: 10000,
    maxLoadTimeMs: 120000,
    timeoutRetry: {
      maxNumRetry: 4,
      retryDelayMs: 0,
      maxRetryDelayMs: 0,
    },
    errorRetry: {
      maxNumRetry: 6,
      retryDelayMs: 1000,
      maxRetryDelayMs: 8000,
    },
  },
},
keyLoadPolicy: {
  default: {
    maxTimeToFirstByteMs: 8000,
    maxLoadTimeMs: 20000,
    timeoutRetry: {
      maxNumRetry: 1,
      retryDelayMs: 1000,
      maxRetryDelayMs: 20000,
      backoff: 'linear',
    },
    errorRetry: {
      maxNumRetry: 8,
      retryDelayMs: 1000,
      maxRetryDelayMs: 20000,
      backoff: 'linear',
    },
  },
},
certLoadPolicy: {
  default: {
    maxTimeToFirstByteMs: 8000,
    maxLoadTimeMs: 20000,
    timeoutRetry: null,
    errorRetry: null,
  },
},
steeringManifestLoadPolicy: {
  default: {
    maxTimeToFirstByteMs: 10000,
    maxLoadTimeMs: 20000,
    timeoutRetry: {
      maxNumRetry: 2,
      retryDelayMs: 0,
      maxRetryDelayMs: 0,
    },
    errorRetry: {
      maxNumRetry: 1,
      retryDelayMs: 1000,
      maxRetryDelayMs: 8000,
    },
  },
},
interstitialAssetListLoadPolicy: {
  default: {
    maxTimeToFirstByteMs: 10000,
    maxLoadTimeMs: 20000,
    timeoutRetry: {
      maxNumRetry: 0,
      retryDelayMs: 0,
      maxRetryDelayMs: 0,
    },
    errorRetry: {
      maxNumRetry: 0,
      retryDelayMs: 1000,
      maxRetryDelayMs: 8000,
    },
  },
}
```

#### `LoaderConfig`

Each `LoaderConfig` has the following properties:

##### `maxTimeToFirstByteMs: number`

Maximum time-to-first-byte in milliseconds. If no bytes or readyState change happens in this time, a network timeout error will be triggered for the asset.

Non-finite values and 0 will be ignored, resulting in only a single `maxLoadTimeMs` timeout timer for the entire request.

##### `maxLoadTimeMs: number`

Maximum time to load the asset in milliseconds. If the request is not completed in time, a network timeout error will be triggered for the asset.

##### `timeoutRetry: RetryConfig | null`

Retry rules for timeout errors. Specifying null results in no retries after a timeout error for the asset type.

##### `errorRetry: RetryConfig | null`

Retry rules for network I/O errors. Specifying null results in no retries after a timeout error for the asset type.

#### `RetryConfig`

Each `RetryConfig` has the following properties:

##### `maxNumRetry: number`

Maximum number of retries. After an error, the request will be retried this many times before other recovery
measures are taken. For example, after having retried a segment or playlist request this number of times\*, if it continues to error, the player will try switching to another level or fall back to another Pathway to recover playback.

When no valid recovery options are available, the error will escalate to fatal, and the player will stop loading all media and asset types.

\*Requests resulting in a stall may trigger a level switch before all retries are performed.

##### `retryDelayMs: number`

The time to wait before performing a retry in milliseconds. Delays are added to prevent the player from overloading
servers having trouble responding to requests.

Retry delay = 2^retryCount _ retryDelayMs (exponential) or retryCount _ retryDelayMs (linear)

##### `maxRetryDelayMs: number`

Maximum delay between retries in milliseconds. With each retry, the delay is increased up to `maxRetryDelayMs`.

##### `backoff?: 'exponential' | 'linear'`

Used to determine retry backoff duration: Retry delay = 2^retryCount \* retryDelayMs (exponential).

##### `shouldRetry`

(default: internal shouldRetry function, type: `(retryConfig: RetryConfig | null | undefined, retryCount: number, isTimeout: boolean, httpStatus: number | undefined,retry: boolean) => boolean`)

Override default shouldRetry check

### `startFragPrefetch`

(default: `false`)

Start prefetching start fragment although media not attached yet.

### `testBandwidth`

(default: `true`)

You must also set `startLevel = -1` for this to have any impact. Otherwise, HLS.js will load the first level in the manifest and start playback from there. If you do set `startLevel = -1`, a fragment of the lowest level will be downloaded to establish a bandwidth estimate before selecting the first auto-level.
Disable this test if you'd like to provide your own estimate or use the default `abrEwmaDefaultEstimate`.

### `progressive`

(default: `false`)

Enable streaming segment data with fetch loader (experimental).

### `lowLatencyMode`

(default: `true`)

Enable Low-Latency HLS part playlist and segment loading, and start live streams at playlist PART-HOLD-BACK rather than HOLD-BACK.

### `fpsDroppedMonitoringPeriod`

(default: 5000)

The period used by the default `fpsController` to observe `fpsDroppedMonitoringThreshold`.

### `fpsDroppedMonitoringThreshold`

(default: 0.2)

The ratio of frames dropped to frames elapsed within `fpsDroppedMonitoringPeriod` needed for the default `fpsController` to emit an `FPS_DROP` event.

### `appendErrorMaxRetry`

(default: `3`)

Max number of `sourceBuffer.appendBuffer()` retry upon error.
Such error could happen in loop with UHD streams, when internal buffer is full. (Quota Exceeding Error will be triggered). In that case we need to wait for the browser to evict some data before being able to append buffer correctly.

### `loader`

(default: standard `XMLHttpRequest`-based URL loader)

Override standard URL loader by a custom one. Use composition and wrap internal implementation which could be exported by `Hls.DefaultConfig.loader`.
Could be useful for P2P or stubbing (testing).

Use this, if you want to overwrite both the fragment and the playlist loader.

Note: If `fLoader` or `pLoader` are used, they overwrite `loader`!

```js
var customLoader = function () {
  /**
     * Calling load() will start retrieving content located at given URL (HTTP GET).
     *
     * @param {object} context - loader context
     * @param {string} context.url - target URL
     * @param {string} context.responseType - loader response type (arraybuffer or default response type for playlist)
     * @param {number} [context.rangeStart] - start byte range offset
     * @param {number} [context.rangeEnd] - end byte range offset
     * @param {Boolean} [context.progressData] - true if onProgress should report partial chunk of loaded content
     * @param {object} config - loader config params
     * @param {number} config.maxRetry - Max number of load retries
     * @param {number} config.timeout - Timeout after which `onTimeOut` callback will be triggered (if loading is still not finished after that delay)
     * @param {number} config.retryDelay - Delay between an I/O error and following connection retry (ms). This to avoid spamming the server
     * @param {number} config.maxRetryDelay - max connection retry delay (ms)
     * @param {object} callbacks - loader callbacks
     * @param {onSuccessCallback} callbacks.onSuccess - Callback triggered upon successful loading of URL.
     * @param {onProgressCallback} callbacks.onProgress - Callback triggered while loading is in progress.
     * @param {onErrorCallback} callbacks.onError - Callback triggered if any I/O error is met while loading fragment.
     * @param {onTimeoutCallback} callbacks.onTimeout - Callback triggered if loading is still not finished after a certain duration.

      @callback onSuccessCallback
      @param response {object} - response data
      @param response.url {string} - response URL (which might have been redirected)
      @param response.data {string/arraybuffer/sharedarraybuffer} - response data (reponse type should be as per context.responseType)
      @param stats {LoadStats} - loading stats
      @param stats.aborted {boolean} - must be set to true once the request has been aborted
      @param stats.loaded {number} - nb of loaded bytes
      @param stats.total {number} - total nb of bytes
      @param stats.retry {number} - number of retries performed
      @param stats.chunkCount {number} - number of chunk progress events
      @param stats.bwEstimate {number} - download bandwidth in bits/s
      @param stats.loading { start: 0, first: 0, end: 0 }
      @param stats.parsing { start: 0, end: 0 }
      @param stats.buffering { start: 0, first: 0, end: 0 }
      @param context {object} - loader context
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onProgressCallback
      @param stats {LoadStats} - loading stats
      @param context {object} - loader context
      @param data {string/arraybuffer/sharedarraybuffer} - onProgress data (should be defined only if context.progressData === true)
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onErrorCallback
      @param error {object} - error data
      @param error.code {number} - error status code
      @param error.text {string} - error description
      @param context {object} - loader context
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onTimeoutCallback
      @param stats {LoadStats} - loading stats
      @param context {object} - loader context

   */
  this.load = function (context, config, callbacks) {};

  /** Abort any loading in progress. */
  this.abort = function () {};

  /** Destroy loading context. */
  this.destroy = function () {};
};
```

### `fLoader`

(default: `undefined`)

This enables the manipulation of the fragment loader.
Note: This will overwrite the default `loader`, as well as your own loader function (see above).

```js
var customFragmentLoader = function () {
  // See `loader` for details.
};
```

### `pLoader`

(default: `undefined`)

This enables the manipulation of the playlist loader.
Note: This will overwrite the default `loader`, as well as your own loader function (see above).

```js
var customPlaylistLoader = function () {
  // See `loader` for details.
};
```

if you want to just make slight adjustments to existing loader implementation, you can also eventually override it, see an example below :

```js
// special playlist post processing function
function process(playlist) {
  return playlist;
}

class pLoader extends Hls.DefaultConfig.loader {
  constructor(config) {
    super(config);
    var load = this.load.bind(this);
    this.load = function (context, config, callbacks) {
      if (context.type == 'manifest') {
        var onSuccess = callbacks.onSuccess;
        callbacks.onSuccess = function (response, stats, context) {
          response.data = process(response.data);
          onSuccess(response, stats, context);
        };
      }
      load(context, config, callbacks);
    };
  }
}

var hls = new Hls({
  pLoader: pLoader,
});
```

### `xhrSetup`

(default: `undefined`)

`XMLHttpRequest` customization callback for default XHR based loader.

`xhrSetup` should be a function with two arguments `(xhr: XMLHttpRequest, url: string)`.
If `xhrSetup` is specified, the default loader will invoke it before calling `xhr.send()`.
This allows users to easily modify the `XMLHttpRequest` instance before sending a request.
Optionally, a Promise can be returned to wait before the request is sent.

Note that `xhr.open()` should be called in `xhrSetup` if the callback modifies the `XMLHttpRequest`
instance in ways that require it to be opened first. If `xhrSetup` throws,
the error will be caught, and `xhrSetup` will be called a second time after opening a GET
request.

```js
var config = {
  xhrSetup: function (xhr, url) {
    xhr.withCredentials = true; // do send cookies
  },
};
```

### `fetchSetup`

(default: `undefined`)

`Fetch` customization callback for Fetch based loader.

Parameter should be a function with two arguments (`context` and `Request Init Params`).
If `fetchSetup` is specified and Fetch loader is used, `fetchSetup` will be triggered to instantiate [Request](https://developer.mozilla.org/fr/docs/Web/API/Request) Object.
This allows user to easily tweak Fetch loader. See example below.

```js
var config = {
  fetchSetup: function (context, initParams) {
    // Always send cookies, even for cross-origin calls.
    initParams.credentials = 'include';
    return new Request(context.url, initParams);
  },
};
```

### `videoPreference`

(default `undefined`)

These settings determine whether HDR video should be selected before SDR video. Which VIDEO-RANGE values are allowed, and in what order of priority can also be specified.

Format `{ preferHDR: boolean, allowedVideoRanges: ('SDR' | 'PQ' | 'HLG')[], videoCodec: string }`

- Allow all video ranges if `allowedVideoRanges` is unspecified.
- If `preferHDR` is defined, use the value to filter `allowedVideoRanges`.
- Else check window for HDR support and set `preferHDR` to the result.

When `preferHDR` is set, skip checking if the window supports HDR and instead use the value provided to determine level selection preference via dynamic range. A value of `preferHDR === true` will attempt to use HDR levels before selecting from SDR levels.

`allowedVideoRanges` can restrict playback to a limited set of VIDEO-RANGE transfer functions and set their priority for selection. For example, to ignore all HDR variants, set `allowedVideoRanges` to `['SDR']`. Or, to ignore all HLG variants, set `allowedVideoRanges` to `['SDR', 'PQ']`. To prioritize PQ variants over HLG, set `allowedVideoRanges` to `['SDR', 'HLG', 'PQ']`.

`videoCodec` limits initial selection to a particular code provided a baseline vairant (1080p 30fps or lower in `allowedVideoRanges`) is found.

### `audioPreference`

(default: `undefined`)

Set a preference used to find and select the best matching audio track on start. The selection can influence starting level selection based on the audio group(s) available to match the preference. `audioPreference` accepts a value of an audio track object (MediaPlaylist), AudioSelectionOption (track fields to match), or undefined. If not set or set to a value of `undefined`, HLS.js will auto select a default track on start.

### `subtitlePreference`

(default: `undefined`)

Set a preference used to find and select the best matching subtitle track on start. `subtitlePreference` accepts a value of a subtitle track object (MediaPlaylist), SubtitleSelectionOption (track fields to match), or undefined. If not set or set to a value of `undefined`, HLS.js will not enable subtitles unless there is a default or forced option.

### `abrController`

(default: internal ABR controller)

Customized Adaptive Bitrate Streaming Controller.

Parameter should be a class providing a getter/setter and a `destroy()` method:

- get/set `nextAutoLevel`: return next auto-quality level/force next auto-quality level that should be returned (currently used for emergency switch down)
- `destroy()`: should clean-up all used resources

For `hls.bandwidthEstimate()` to return an estimate from your custom controller, it will also need to satisfy `abrController.bwEstimator.getEstimate()`.

### `bufferController`

(default: internal buffer controller)

Customized buffer controller.

A class in charge of managing SourceBuffers.

### `capLevelController`

(default: internal cap level controller)

Customized level capping controller.

A class in charge of setting `hls.autoLevelCapping` to limit ABR level selection based on player size.
Enable the default cap level controller by setting `capLevelToPlayerSize` to `true`.

### `fpsController`

(default: internal fps controller)

Customized fps controller.

A class in charge of monitoring frame rate, that emits `FPS_DROP` events when frames dropped exceeds configured threshold.
Enable the default fps controller by setting `capLevelOnFPSDrop` to `true`.

### `timelineController`

(default: internal track timeline controller)

Customized text track synchronization controller.

Parameter should be a class with a `destroy()` method:

- `destroy()` : should clean-up all used resources

### `enableDateRangeMetadataCues`

(default: `true`)

whether or not to add, update, and remove cues from the metadata TextTrack for EXT-X-DATERANGE playlist tags

parameter should be a boolean

### `enableEmsgMetadataCues`

(default: `true`)

whether or not to add, update, and remove cues from the metadata TextTrack for ID3 Timed Metadata found in CMAF Event Message (emsg) boxes

parameter should be a boolean

### `enableEmsgKLVMetadata`

(default: `false`)

whether or not to extract KLV Timed Metadata found in CMAF Event Message (emsg) boxes and deliver via `FRAG_PARSING_METADATA`

parameter should be a boolean

### `enableID3MetadataCues`

(default: `true`)

whether or not to add, update, and remove cues from the metadata TextTrack for ID3 Timed Metadata found in audio and MPEG-TS containers

parameter should be a boolean

### `enableWebVTT`

(default: `true`)

whether or not to enable WebVTT captions on HLS

parameter should be a boolean

### `enableIMSC1`

(default: `true`)

whether or not to enable IMSC1 captions on HLS

parameter should be a boolean

### `enableCEA708Captions`

(default: `true`)

whether or not to enable CEA-708 captions

parameter should be a boolean

### `captionsTextTrack1Label`

(default: `English`)

Label for the text track generated for CEA-708 captions track 1. This is how it will appear in the browser's native menu for subtitles and captions.

parameter should be a string

### `captionsTextTrack1LanguageCode`

(default: `en`)

RFC 3066 language code for the text track generated for CEA-708 captions track 1.

parameter should be a string

### `captionsTextTrack2Label`

(default: `Spanish`)

Label for the text track generated for CEA-708 captions track 2. This is how it will appear in the browser's native menu for subtitles and captions.

parameter should be a string

### `captionsTextTrack2LanguageCode`

(default: `es`)

RFC 3066 language code for the text track generated for CEA-708 captions track 2.

parameter should be a string

### `captionsTextTrack3Label`

(default: `Unknown CC`)

Label for the text track generated for CEA-708 captions track 3. This is how it will appear in the browser's native menu for subtitles and captions.

parameter should be a string

### `captionsTextTrack3LanguageCode`

(default: ``)

RFC 3066 language code for the text track generated for CEA-708 captions track 3.

parameter should be a string

### `captionsTextTrack4Label`

(default: `Unknown CC`)

Label for the text track generated for CEA-708 captions track 4. This is how it will appear in the browser's native menu for subtitles and captions.

parameter should be a string

### `captionsTextTrack4LanguageCode`

(default: ``)

RFC 3066 language code for the text track generated for CEA-708 captions track 4.

parameter should be a string

### `renderTextTracksNatively`

(default: `true`)

Whether or not render captions natively using the HTMLMediaElement's TextTracks. Disable native captions rendering
when you want to handle rending of track and track cues using `Hls.Events.NON_NATIVE_TEXT_TRACKS_FOUND` and `Hls.Events.CUES_PARSED` events.

parameter should be a boolean

### `stretchShortVideoTrack`

(default: `false`)

If a segment's video track is shorter than its audio track by > `maxBufferHole`, extend the final video frame's duration to match the audio track's duration.
This helps playback continue in certain cases that might otherwise get stuck.

parameter should be a boolean

### `maxAudioFramesDrift`

(default: `1`)

Browsers are really strict about audio frames timings.
They usually play audio frames one after the other, regardless of the timestamps advertised in the fmp4.
If audio timestamps are not consistent (consecutive audio frames too close or too far from each other), audio will easily drift.
HLS.js is restamping audio frames so that the distance between consecutive audio frame remains constant.
if the distance is larger than the max allowed drift, HLS.js will either:

1. drop the next audio frame if distance is too small (if next audio frame timestamp is smaller than expected time stamp - max allowed drift)
2. (AAC only) insert silent frames if distance is too big (next audio frame timestamp is bigger than expected timestamp + max allowed drift)

parameter should be an integer representing the max number of audio frames allowed to drift.
keep in mind that one audio frame is 1024 audio samples (if using AAC), at 44.1 kHz, it gives 1024/44100 = 23ms

### `forceKeyFrameOnDiscontinuity`

(default: `true`)

Whether or not to force having a key frame in the first AVC sample after a discontinuity.
If set to true, after a discontinuity, the AVC samples without any key frame will be dropped until finding one that contains a key frame.
If set to false, all AVC samples will be kept, which can help avoid holes in the stream.
Setting this parameter to false can also generate decoding weirdness when switching level or seeking.

parameter should be a boolean

### `abrEwmaFastLive`

(default: `3.0`)

Fast bitrate Exponential moving average half-life, used to compute average bitrate for Live streams.
Half of the estimate is based on the last abrEwmaFastLive seconds of sample history.
Each of the sample is weighted by the fragment loading duration.

parameter should be a float greater than 0

### `abrEwmaSlowLive`

(default: `9.0`)

Slow bitrate Exponential moving average half-life, used to compute average bitrate for Live streams.
Half of the estimate is based on the last abrEwmaSlowLive seconds of sample history.
Each of the sample is weighted by the fragment loading duration.

parameter should be a float greater than [abrEwmaFastLive](#abrewmafastlive)

### `abrEwmaFastVoD`

(default: `3.0`)

Fast bitrate Exponential moving average half-life, used to compute average bitrate for VoD streams.
Half of the estimate is based on the last abrEwmaFastVoD seconds of sample history.
Each of the sample is weighted by the fragment loading duration.

parameter should be a float greater than 0

### `abrEwmaSlowVoD`

(default: `9.0`)

Slow bitrate Exponential moving average half-life, used to compute average bitrate for VoD streams.
Half of the estimate is based on the last abrEwmaSlowVoD seconds of sample history.
Each of the sample is weighted by the fragment loading duration.

parameter should be a float greater than [abrEwmaFastVoD](#abrewmafastvod)

### `abrEwmaDefaultEstimate`

(default: `500000`)

Default bandwidth estimate in bits/s prior to collecting fragment bandwidth samples.

### `abrEwmaDefaultEstimateMax`

(default: `5000000`)

Limits value of updated bandwidth estimate taken from first variant found in multivariant playlist on start.

### `abrBandWidthFactor`

(default: `0.95`)

Scale factor to be applied against measured bandwidth average, to determine whether we can stay on current or lower quality level.
If `abrBandWidthFactor * bandwidth average > level.bitrate` then ABR can switch to that level providing that it is equal or less than current level.

### `abrBandWidthUpFactor`

(default: `0.7`)

Scale factor to be applied against measured bandwidth average, to determine whether we can switch up to a higher quality level.
If `abrBandWidthUpFactor * bandwidth average > level.bitrate` then ABR can switch up to that quality level.

### `abrMaxWithRealBitrate`

(default: `false`)

max bitrate used in ABR by avg measured bitrate
i.e. if bitrate signaled in variant manifest for a given level is 2Mb/s but average bitrate measured on this level is 2.5Mb/s,
then if config value is set to `true`, ABR will use 2.5 Mb/s for this quality level.

### `minAutoBitrate`

(default: `0`)

Return the capping/min bandwidth value that could be used by automatic level selection algorithm.
Useful when browser or tab of the browser is not in the focus and bandwidth drops

### `emeEnabled`

(default: `false`)

Set to `true` to enable DRM key system access and license retrieval.

### `widevineLicenseUrl` (deprecated)

(default: `undefined`)

`widevineLicenseUrl` has been deprecated. Use `drmSystems['com.widevine.alpha'].licenseUrl` instead.

### `licenseXhrSetup`

(default: `undefined`, type `(xhr: XMLHttpRequest, url: string, keyContext: MediaKeySessionContext, licenseChallenge: Uint8Array) => void | Uint8Array | Promise<Uint8Array | void>`)

A pre-processor function for modifying license requests. The license request URL, request headers, and payload can all be modified prior to sending the license request, based on operating conditions, the current key-session, and key-system.

```js
var config = {
  licenseXhrSetup: function (xhr, url, keyContext, licenseChallenge) {
    let payload = licenseChallenge;

    // Send cookies with request
    xhr.withCredentials = true;

    // Call open to change the method (default is POST), modify the url, or set request headers
    xhr.open('POST', url, true);

    // call xhr.setRequestHeader after xhr.open otherwise licenseXhrSetup will throw and be called a second time after HLS.js call xhr.open
    if (keyContext.keySystem === 'com.apple.fps') {
      xhr.setRequestHeader('Content-Type', 'application/json');
      payload = JSON.stringify({
        keyData: base64Encode(keyContext.decryptdata?.keyId),
        licenseChallenge: base64Encode(licenseChallenge),
      });
    } else {
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    }

    // Return the desired payload or a Promise<Uint8Array>.
    // Not returning a value, or returning `undefined` or` Promise<void>` will result in the `licenseChallenge` being used.
    return fetchDRMToken(this.authData).then((result) => {
      xhr.setRequestHeader('token', token);
      return payload;
    });
  },
};
```

### `licenseResponseCallback`

(default: `undefined`, type `(xhr: XMLHttpRequest, url: string, keyContext: MediaKeySessionContext) => data: ArrayBuffer`)

A post-processor function for modifying the license response before passing it to the key-session (`MediaKeySession.update`).

```js
var config = {
  licenseResponseCallback: function (xhr, url, keyContext) {
      const keySystem = keyContext.keySystem;
      const response = xhr.response;
      if (keyContext.keySystem === 'com.apple.fps') {
        try {
          const responseObject = JSON.parse(
            new TextDecoder().decode(response).trim();
          );
          const keyResponse = responseObject['fairplay-streaming-response']['streaming-keys'][0];
          return base64Decode(keyResponse.ckc);
        } catch (error) {
          console.error(error);
        }
      }
      return response;
  }
```

### `drmSystems`

(default: `{}`)

Define license settings for given key-systems according to your own DRM provider. Ex:

```js
drmSystems: {
  'com.apple.fps': {
    licenseUrl: 'https://your-fps-license-server/path',
    serverCertificateUrl: 'https://your-fps-license-server/certificate/path',
  },
  'com.widevine.alpha': {
    licenseUrl: 'https://your-widevine-license-server/path'
  }
}
```

Supported key-systems include 'com.apple.fps', 'com.microsoft.playready', 'com.widevine.alpha', and 'org.w3.clearkey'. Mapping to other values in key-system access requests can be done by customizing [`requestMediaKeySystemAccessFunc`](#requestMediaKeySystemAccessFunc).

When loading content with DRM Keys, the player will only request access
to key-systems for the Session Keys or Playlist Keys for which there are
also key-systems defined in `drmSystems`.

### `drmSystems[KEY-SYSTEM].generateRequest

(default: `undefined`, type `(initDataType: string, initData: ArrayBuffer | null, keyContext: MediaKeySessionContext) => { initDataType: string; initData: ArrayBuffer | null } | undefined`)

Used to map initData or generate initData for playlist keys before
MediaKeySession `generateRequest` is called.

### `drmSystemOptions`

(default: `{}`)

Define optional [`MediaKeySystemConfiguration`](https://developer.mozilla.org/en-US/docs/Web/API/MediaKeySystemConfiguration) arguments to be passed to `requestMediaKeySystemAccess`. Ex:

```js
{
  audioRobustness: 'SW_SECURE_CRYPTO',
  videoRobustness: 'SW_SECURE_CRYPTO',
  audioEncryptionScheme: null,
  videoEncryptionScheme: null,
  persistentState: 'not-allowed';
  distinctiveIdentifier: 'not-allowed';
  sessionTypes: ['temporary'];
  sessionType: 'temporary';
}
```

With the default argument, `''` will be specified for each option (_i.e. no specific robustness required_).

### `requestMediaKeySystemAccessFunc`

(default: A function that returns the result of `window.navigator.requestMediaKeySystemAccess.bind(window.navigator)` or `null`)

Allows for the customization of `window.navigator.requestMediaKeySystemAccess`. This can be used to map key-system access request to from a supported value to a custom one:

```js
var hls new Hls({
  requestMediaKeySystemAccessFunc: (keySystem, supportedConfigurations) => {
    if (keySystem === 'com.microsoft.playready') {
      keySystem = 'com.microsoft.playready.recommendation';
    }
    return navigator.requestMediaKeySystemAccess(keySystem, supportedConfigurations);
  }
});
```

### `cmcd`

When the `cmcd` object is defined, [Common Media Client Data (CMCD)](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf)
data will be passed on all media requests (manifests, playlists, a/v segments, timed text). It's configuration values are:

- `sessionId`: The CMCD session id. One will be automatically generated if none is provided.
- `contentId`: The CMCD content id.
- `useHeaders`: Send CMCD data in request headers instead of as query args. Defaults to `false`.
- `includeKeys`: An optional array of CMCD keys. When present, only these CMCD fields will be included with each each request.

### `enableInterstitialPlayback`

(default: `true`)

Interstitial playback can be disabled without disabling parsing or schedule update and buffered-to events by setting this to `false` allowing for custom playout and ad managers to use Interstitials data.

### `interstitialAppendInPlace`

(default: `true`)

Use this option to turn off the appending of interstitials "in place" by setting it to `false`.

"In place" appending is performed on a single timeline, with the same SourceBuffers and MediaSource as the primary media. The default value is `true`, allowing HLS.js to decide which mode is used based on each interstitial event's scheduled start and resumption and how it aligns with primary playlist media.

Even when `true`, HLS.js may reset the MediaSource and timeline for interstitial playback as necessary. The `InterstitialEvent` instance's `appendInPlace` property indicates the mode used to append assets of the interstitial. Once the first `INTERSTITIAL_ASSET_PLAYER_CREATED` event has triggered for the interstitial, the value of `appendInPlace` will remain fixed.

### `interstitialLiveLookAhead`

(default: `10`)

The time (in seconds) ahead of the end of a live playlist to request scheduled Interstitials when playing at the live edge.

The default value is `10`, meaning that HLS.js will begin requesting interstitial ASSET-LIST and ASSET-URIs whose START-DATE is within 10 seconds of the program-date-time at the end of the primary variant playlist while the forward buffer is within a target duration of the same range.

## Video Binding/Unbinding API

### `hls.attachMedia(HTMLMediaElement | MediaAttachingData)`

Calling this method will:

- bind videoElement and hls instance,
- create MediaSource and set it as video source
- once MediaSource object is successfully created, MEDIA_ATTACHED event will be fired.

### `hls.detachMedia()`

Calling this method will:

- unbind VideoElement from hls instance,
- signal the end of the stream on MediaSource
- reset video source (`video.src = ''`)

### `hls.transferMedia(): MediaAttachingData`

Detaches and returns MediaSource and SourceBuffers non-destructively in a format that can be passed to `hls.attachMedia(MediaAttachingData)`. This is used by Interstitial asset players that append the same SourceBuffer as the primary player.

#### `hls.media`

- get: Return the bound videoElement from the hls instance

## Quality switch Control API

By default, hls.js handles quality switch automatically, using heuristics based on fragment loading bitrate and quality level bandwidth exposed in the variant manifest.
It is also possible to manually control quality switch using below API.

### `hls.levels`

- get: Return array of available quality levels.

### `hls.currentLevel`

- get: Return current playback quality level.
- set: Trigger an immediate quality level switch to new quality level. This will abort the current fragment request if any, flush the whole buffer, and fetch fragment matching with current position and requested quality level.

Set to `-1` for automatic level selection.

### `hls.nextLevel`

- get: Return next playback quality level (playback quality level for next buffered fragment). Return `-1` if next fragment not buffered yet.
- set: Trigger a quality level switch for next fragment. This could eventually flush already buffered next fragment.

Set to `-1` for automatic level selection.

### `hls.loadLevel`

- get: return last loaded fragment quality level.
- set: set quality level for next loaded fragment.

Set to `-1` for automatic level selection.

### `hls.nextLoadLevel`

- get: Return quality level that will be used to load next fragment.
- set: Force quality level for next loaded fragment. Quality level will be forced only for that fragment.
  After a fragment at this quality level has been loaded, `hls.loadLevel` will prevail.

### `hls.firstLevel`

- get: First level index (index of the first Variant appearing in the Multivariant Playlist).

### `hls.firstAutoLevel`

- get: Return quality level that will be used to load the first fragment when not overridden by `startLevel`.

### `hls.startLevel`

- get/set: Start level index (level of first fragment that will be played back).
  - if not overridden by user: first level appearing in manifest will be used as start level.
  - if -1: automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment).

Default value is `hls.firstLevel`.

### `hls.autoLevelEnabled`

- get: Tell whether auto level selection is enabled or not.

### `hls.autoLevelCapping`

- get/set: Capping/max level value that could be used by ABR Controller.

Default value is `-1` (no level capping).

### `hls.maxHdcpLevel`

- get/set: The maximum HDCP-LEVEL allowed to be selected by auto level selection. Must be a valid HDCP-LEVEL value ('NONE', 'TYPE-0', 'TYPE-1', 'TYPE-2'), or null (default). `hls.maxHdcpLevel` is automatically set to the next lowest value when a `KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED` error occurs. To prevent manual selection of levels with specific HDCP-LEVEL attribute values, use `hls.removeLevel()` on `MANIFEST_LOADED` or on error.

Default value is null (no level capping based on HDCP-LEVEL)

### `hls.capLevelToPlayerSize`

- get: Enables or disables level capping. If disabled after previously enabled, `nextLevelSwitch` will be immediately called.
- set: Whether level capping is enabled.

Default value is set via [`capLevelToPlayerSize`](#capleveltoplayersize) in config.

### `hls.bandwidthEstimate`

get: Returns the current bandwidth estimate in bits/s, if available. Otherwise, `NaN` is returned.

set: Reset `EwmaBandWidthEstimator` using the value set as the new default estimate. This will update the value of `config.abrEwmaDefaultEstimate`.

### `hls.removeLevel(levelIndex)`

Remove a level from the list of loaded levels.
This can be used to remove a rendition or playlist url that errors frequently from the list of levels that a user or HLS.js can choose from.

Modifying the levels this way will result in a `Hls.Events.LEVELS_UPDATED` event being triggered.

## Version Control

### `Hls.version`

Static getter: return the hls.js@version string (dist build version or src **VERSION** build const).

## Network Loading Control API

By default, HLS.js will automatically start loading quality level playlists, and fragments after `Hls.Events.MANIFEST_PARSED` event has been triggered.

However, if `config.autoStartLoad` is set to `false`, then `hls.startLoad()` needs to be called to manually start playlist and fragments loading.

### `hls.startLoad(startPosition=-1,skipSeekToStartPosition=false)`

Start/restart playlist/fragment loading. This is only effective if MANIFEST_PARSED event has been triggered.

startPosition is the initial position in the playlist.
If startPosition is not set to -1, it allows to override default startPosition to the one you want (it will bypass hls.config.liveSync\* config params for Live for example, so that user can start playback from whatever position).

Once media is appended HLS.js will seek to the start position. Passing in a `skipSeekToStartPosition` of `true` allows loading to begin at the start position without seeking on append. This is used when multiple players contribute to buffering media to the same source for Interstitials that overlap primary content.

### `hls.stopLoad()`

stop playlist/fragment loading. could be resumed later on by calling `hls.startLoad()`

### `hls.startPosition`

get : Returns the resolved `startPosition` target (number) used for loading before media is buffered, and where playback will begin once media is buffered.

### `hls.pauseBuffering()`

Pauses fragment buffering (used internally with ManagedMediaSource streaming events).

### `hls.resumeBuffering()`

Resumes fragment buffering (used internally with ManagedMediaSource streaming events).

### `hls.bufferingEnabled`

get : Returns a boolean indicating whether fragment loading has been toggled with `pauseBuffering()` and `resumeBuffering()`.

### `hls.bufferedToEnd`

get : Returns a boolean indicating if EOS has been appended (media is buffered from currentTime to end of stream).

### `hls.inFlightFragments`

get: Returns an object with each streaming controller's state and in-flight fragment (or null).

Example:

```js
{
  main: {
    frag: <Fragment Object>,
    state: "FRAG_LOADING"
  },
  audio: {
    frag: <Fragment Object>,
    state: "PARSED"
  },
  subtitle: {
    frag: null,
    state: "IDLE"
  }
}
```

### `hls.url`

get : string of current HLS asset passed to `hls.loadSource()`, otherwise null

## Audio Tracks Control API

### `hls.setAudioOption(audioOption)`

Find and select the best matching audio track, making a level switch when a Group change is necessary. Updates `hls.config.audioPreference`. Returns the selected track or null when no matching track is found.

### `hls.allAudioTracks`

get : array of all supported audio tracks found in the Multivariant Playlist

### `hls.audioTracks`

get : array of supported audio tracks in the active audio group ID

### `hls.audioTrack`

get/set : index of selected audio track in `hls.audioTracks`

## Subtitle Tracks Control API

### `hls.setSubtitleOption(subtitleOption)`

Find and select the best matching subtitle track, making a level switch when a Group change is necessary. Updates `hls.config.subtitlePreference`. Returns the selected track or null when no matching track is found.

### `hls.allSubtitleTracks`

get : array of all subtitle tracks found in the Multivariant Playlist

### `hls.subtitleTracks`

get : array of subtitle tracks in the active subtitle group ID

### `hls.subtitleTrack`

get/set : index of selected subtitle track in `hls.subtitleTracks`. Returns -1 if no track is visible. Set to -1 to disable all subtitle tracks.

### `hls.subtitleDisplay`

(default: `true`)

get/set : if set to true the active subtitle track mode will be set to `showing` and the browser will display the active subtitles. If set to false, the mode will be set to `hidden`.

## Live stream API

### `hls.liveSyncPosition`

get : position of live sync point (ie edge of live position minus safety delay defined by `hls.config.liveSyncDuration`).
If playback stalls outside the sliding window, or latency exceeds `liveMaxLatencyDuration`, HLS.js will seek ahead to
`liveSyncPosition` to get back in sync with the stream stream.

### `hls.latency`

get : estimated position (in seconds) of live edge (ie edge of live playlist plus time sync playlist advanced)
returns 0 before first playlist is loaded

### `hls.maxLatency`

get : maximum distance from the edge before the player seeks forward to `hls.liveSyncPosition`
configured using `liveMaxLatencyDurationCount` (multiple of target duration) or `liveMaxLatencyDuration`
returns 0 before first playlist is loaded

### `hls.targetLatency`

get/set : target distance from the edge as calculated by the latency controller

When `liveSyncDuration` is specified in config,
`targetLatency` is calculated as `liveSyncDuration` plus `liveSyncOnStallIncrease` multiplied by number of stalls.
Otherwise `targetLatency` is calculated as `liveSyncDurationCount` multiplied by `EXT-X-TARGETDURATION`
plus `liveSyncOnStallIncrease` multiplied by number of stalls.

Setting `targetLatency` resets number of stalls to `0` and sets `liveSyncDuration` to the new value.
Note: if the initial config specified `liveSyncDurationCount` rather than `liveSyncDuration`,
setting `targetLatency` will assign a new value to `liveSyncDuration`. This value will be used to calculate
`targetLatency` from now on and `liveSyncDurationCount` will be ignored.

### `hls.drift`

get : the rate at which the edge of the current live playlist is advancing or 1 if there is none

### `hls.playingDate`

get: the datetime value relative to media.currentTime for the active level Program Date Time if present

## Interstitials

HLS.js supports playback of X-ASSET-URI and X-ASSET-LIST m3u8 playlists scheduled with Interstitial EXT-X-DATERANGE tags. The `InterstitialsManager` provides playback state with seek and skip control. There are a variety of events to notify applications of Interstitials schedule changes and playback state. Here is an overview of how they work.

### Interstitials configuration options

- `interstitialsController` Set to `null` to disable interstitial parsing, events, and playback.
- [`enableInterstitialPlayback`](#enableinterstitialplayback) Set to `false` to disable interstitial playback, without disabling parsing and events.
- [`interstitialAppendInPlace`](#interstitialappendinplace) Set to `false` to disable appending "in place".
- [`interstitialLiveLookAhead`](#interstitiallivelookahead) Adjust how far in advance to load interstitials during live playback.

### Interstitials Manager

#### `hls.interstitialsManager`

- get: Returns the `InterstitialsManager` (or `null`) with information about the current program.

The data includes the list of Interstitial events with their asset lists, the schedule of event and primary segment items, information about which items and assets are buffering and playing, the player instance currently buffering media, and the queue of players responsible for the streaming of assets.

Use `skip()` to skip the current interstitial. Use `primary`, `playout`, and `integrated` to get `currentTime`, `duration` and to seek along the respective timeline.

```ts
interface InterstitialsManager {
  events: InterstitialEvent[]; // An array of Interstitials (events) parsed from the latest media playlist update
  schedule: InterstitialScheduleItem[]; // An array of primary and event items with start and end times representing the scheduled program
  playerQueue: HlsAssetPlayer[]; // And array of child Hls instances created to preload and stream Interstitial asset content
  bufferingPlayer: HlsAssetPlayer | null; // The child Hls instance assigned to streaming media at the edge of the forward buffer
  bufferingAsset: InterstitialAssetItem | null; // The Interstitial asset currently being streamed
  bufferingItem: InterstitialScheduleItem | null; // The primary item or event item currently being streamed
  bufferingIndex: number; // The index of `bufferingItem` in the `schedule` array
  playingAsset: InterstitialAssetItem | null; // The Interstitial asset currently being streamed
  playingItem: InterstitialScheduleItem | null; // The primary item or event item currently being played
  playingIndex: number; // The index of `playingItem` in the `schedule` array
  waitingIndex: number; // The index of the item whose asset list is being loaded in the `schedule` array
  primary: PlayheadTimes; // playhead mapping and seekTo method based on the primary content
  playout: PlayheadTimes; // playhead mapping and seekTo method based on playout of all items in the `schedule` array
  integrated: PlayheadTimes; // playhead mapping and seekTo method that applies the X-TIMELINE-OCCUPIES attribute to each event item
  skip: () => void; // A method for skipping the currently playing event item, provided it is not jump restricted
}

type PlayheadTimes = {
  bufferedEnd: number; // The buffer end time relative to the playhead in the scheduled program
  currentTime: number; // The current playhead time in the scheduled program
  duration: number; // The time at the end of the scheduled program
  seekableStart: number; // The earliest available time where media is available (maps to the start of the first segment in primary media playlists)
  seekTo: (time: number) => void; // A method for seeking to the designated time the scheduled program
};
```

### Interstitial Events

`INTERSTITIALS_UPDATED` is fired following playlist parsing with Interstitial EXT-X-DATERANGE tags and any changes to interstitial asset duration or scheduling. It includes the list of interstitial events, the scheduled playback segments, the durations for the schedule for any chosen timeline, and any removed Interstitial EXT-X-DATERANGE since the last update (Live only).

```ts
interface InterstitialsUpdatedData {
  events: InterstitialEvent[];
  schedule: InterstitialScheduleItem[];
  durations: InterstitialScheduleDurations;
  removedIds: string[];
}
```

Interstitials are loaded when the buffer reaches the scheduled date of an event. This will be signalled by `INTERSTITIALS_BUFFERED_TO_BOUNDARY`.

```ts
interface InterstitialsBufferedToBoundaryData {
  events: InterstitialEvent[];
  schedule: InterstitialScheduleItem[];
  bufferingIndex: number;
  playingIndex: number;
}
```

If the Interstitial EXT-X-DATERANGE has an X-ASSET-LIST, `ASSET_LIST_LOADING` and `ASSET_LIST_LOADED` will fire (or non-fatal `ERROR` with `ErrorDetails.ASSET_LIST_(LOAD_(ERROR|TIMEOUT)|PARSING_ERROR)`).

Once the asset list/uri are known, player instances will be created to preload the assets signalled by `INTERSTITIAL_ASSET_PLAYER_CREATED`. At this point the asset player is configured and requesting the HLS playlists. HLS.js will transfer the media element to this player when it is its turn to buffer or play media unless another one is attached at this time.

```ts
interface InterstitialAssetPlayerCreatedData {
  asset: InterstitialAssetItem;
  assetListIndex: number;
  assetListResponse?: AssetListJSON;
  event: InterstitialEvent;
  player: HlsAssetPlayer;
}
```

The `InterstitialEvent: appendInPlace` property indicates the mode used to append assets of the interstitial.

HLS.js determines if an interstitial will be appended "in place" on a single timeline, with the same SourceBuffers and MediaSource as the primary player, or if it will reset the MediaSource and duration for each asset. Attaching additional media elements to asset players results in their reset ahead of playback. When the media element is shared (by default), the mode is determined based on each interstitial event's scheduled start and resumption and how it aligns with primary playlist media.

`INTERSTITIAL_STARTED` and `INTERSTITIAL_ENDED` mark entering and exiting of a scheduled interstitial event item. These events fire whenever playing or seeking into or out-of an Interstitial DATERANGE.

`INTERSTITIAL_ASSET_STARTED` and `INTERSTITIAL_ASSET_ENDED` mark the entrance and exit of an asset in an interstitial.

```ts
interface InterstitialAssetStartedData {
  asset: InterstitialAssetItem;
  assetListIndex: number;
  event: InterstitialEvent;
  schedule: InterstitialScheduleItem[];
  scheduleIndex: number;
  player: HlsAssetPlayer;
}

interface InterstitialAssetEndedData {
  asset: InterstitialAssetItem;
  assetListIndex: number;
  event: InterstitialEvent;
  schedule: InterstitialScheduleItem[];
  scheduleIndex: number;
  player: HlsAssetPlayer;
}
```

Adaptaion control and streaming status should be performed on asset players while assets are active. Use [`hls.interstitialsManager`](#hlsinterstitialsmanager) for integrated playback status, seeking, and skipping interstitials.

`INTERSTITIALS_PRIMARY_RESUMED` is fired when playback enters a primary schedule item from an interstitial or the start of playback.

`INTERSTITIAL_ASSET_ERROR` is fired when an error results in an asset not playing or finishing early. Playback is expected to fallback to primary. This should be accompanied by a schedule update an an `error` property present on the `InterstitialAssetItem` and the `InterstitialEvent` when all its assets failed.

```ts
type InterstitialAssetErrorData = {
  asset: InterstitialAssetItem | null;
  assetListIndex: number;
  event: InterstitialEvent | null;
  schedule: InterstitialScheduleItem[] | null;
  scheduleIndex: number;
  player: HlsAssetPlayer | null;
} & ErrorData;
```

### Interstitial Objects and Classes

- `InterstitialEvent` A class representing a parsed Interstitial event.

- `InterstitialScheduleItem` An item or segment of the program schedule. This can be an `InterstitialScheduleEventItem` or an `InterstitialSchedulePrimaryItem`.

- `InterstitialAssetItem` A parsed and scheduled asset in an `InterstitialEvent`'s `assetList`.

- `HlsAssetPlayer` A class for wrapping an instance of `Hls` used to stream Interstitial assets.

## Additional data

### `hls.latestLevelDetails`

- get: Returns the LevelDetails of the most up-to-date HLS variant playlist data.

### `hls.sessionId`

get: Returns the session UUID assigned to the Hls instance. Used as the default CMCD session ID.

## Runtime Events

hls.js fires a bunch of events, that could be registered and unregistered as below:

```js
function onLevelLoaded(event, data) {
  var level_duration = data.details.totalduration;
}
// subscribe event
hls.on(Hls.Events.LEVEL_LOADED, onLevelLoaded);
// unsubscribe event
hls.off(Hls.Events.LEVEL_LOADED, onLevelLoaded);
// subscribe for a single event call only
hls.once(Hls.Events.LEVEL_LOADED, onLevelLoaded);
```

Full list of Events is available below:

- `Hls.Events.MEDIA_ATTACHING` - fired before MediaSource is attaching to media element
  - data: { media }
- `Hls.Events.MEDIA_ATTACHED` - fired when MediaSource has been successfully attached to media element
  - data: { media }
- `Hls.Events.MEDIA_DETACHING` - fired before detaching MediaSource from media element
  - data: { }
- `Hls.Events.MEDIA_DETACHED` - fired when MediaSource has been detached from media element
  - data: { }
- `Hls.Events.BUFFER_RESET` - fired when we buffer is going to be reset
  - data: { }
- `Hls.Events.BUFFER_CODECS` - fired when we know about the codecs that we need buffers for to push into
  - data: { audio? : `[Track]`, video? : `[Track]` }
- `Hls.Events.BUFFER_CREATED` - fired when sourcebuffers have been created
  - data: { tracks : { audio? : `[Track]`, video? : `[Track]`, audiovideo?: `[Track]` } }
    interface Track { id: 'audio' | 'main', buffer?: SourceBuffer, container: string, codec?: string, initSegment?: Uint8Array, levelCodec?: string, metadata?: any }
- `Hls.Events.BUFFER_APPENDING` - fired when we append a segment to the buffer
- data: { parent, type, frag, part, chunkMeta, data }
- `Hls.Events.BUFFER_APPENDED` - fired when we are done with appending a media segment to the buffer
  - data: { parent : playlist type triggered `BUFFER_APPENDING`, type, frag, part, chunkMeta, timeRanges : { video?: TimeRange, audio?: TimeRange, audiovideo?: TimeRange } }
- `Hls.Events.BUFFER_EOS` - fired when the stream is finished and we want to notify the media buffer that there will be no more data
  - data: { type: SourceBufferName }
- `Hls.Events.BUFFER_FLUSHING` - fired when the media buffer should be flushed
  - data: { startOffset, endOffset, type: SourceBufferName }
- `Hls.Events.BUFFER_FLUSHED` - fired when the media buffer has been flushed
  - data: { type: SourceBufferName }
- `Hls.Events.BACK_BUFFER_REACHED` - fired when the back buffer is reached as defined by the [backBufferLength](#backbufferlength) config option
  - data: { bufferEnd: number }
- `Hls.Events.MANIFEST_LOADING` - fired to signal that a manifest loading starts
  - data: { url : manifestURL }
- `Hls.Events.MANIFEST_LOADED` - fired after manifest has been loaded
  - data: { levels : [available quality levels], audioTracks : [available audio tracks], captions? [available closed-captions media], subtitles?: [available subtitle tracks], url : manifestURL, stats : [LoaderStats], sessionData: [parsed #EXT-X-SESSION-DATA], networkDetails: [Loader specific object for debugging (XMLHttpRequest or fetch Response)]}
- `Hls.Events.MANIFEST_PARSED` - fired after manifest has been parsed
  - data: { levels : [ available quality levels ], firstLevel : index of first quality level appearing in Manifest, audioTracks, subtitleTracks, stats, audio: boolean, video: boolean, altAudio: boolean }
- `Hls.Events.STEERING_MANIFEST_LOADED` - fired when the Content Steering Manifest is loaded
  - data: { `url`: steering manifest URL, `steeringManifest`: SteeringManifest object } }
- `Hls.Events.LEVEL_SWITCHING` - fired when a level switch is requested
  - data: { `level` and Level object properties (please see [below](#level) for more information) }
- `Hls.Events.LEVEL_SWITCHED` - fired when a level switch is effective
  - data: { level : id of new level }
- `Hls.Events.LEVEL_LOADING` - fired when a level playlist is requested (unless it is the only media playlist loaded via `hls.loadSource()`)
  - data: { url : level URL, level : id of level being loaded, deliveryDirectives: LL-HLS delivery directives or `null` when blocking reload is not supported }
- `Hls.Events.LEVEL_LOADED` - fired when a level playlist loading finishes
  - data: { details : [LevelDetails](#leveldetails), level : id of loaded level, stats : [LoadStats] }
- `Hls.Events.LEVEL_UPDATED` - fired when a level's details have been updated based on previous details, after it has been loaded
  - data: { details : [LevelDetails](#leveldetails), level : id of updated level }
- `Hls.Events.LEVEL_PTS_UPDATED` - fired when a level's PTS information has been updated after parsing a fragment
  - data: { details : [LevelDetails](#leveldetails), level : id of updated level, drift: PTS drift observed when parsing last fragment, type, start, end }
- `Hls.Events.LEVELS_UPDATED` - fired when a level is removed after calling `removeLevel()`
  - data: { levels : [ available quality levels ] }
- `Hls.Events.AUDIO_TRACKS_UPDATED` - fired to notify that audio track lists has been updated
  - data: { audioTracks : audioTracks }
- `Hls.Events.AUDIO_TRACK_SWITCHING` - fired when an audio track switching is requested
  - data: { id : audio track id, type : playlist type ('AUDIO' | 'main'), url : audio track URL }
- `Hls.Events.AUDIO_TRACK_SWITCHED` - fired when an audio track switch actually occurs
  - data: { id : audio track id }
- `Hls.Events.AUDIO_TRACK_LOADING` - fired when an audio track loading starts
  - data: { url : audio track URL, id : audio track id }
- `Hls.Events.AUDIO_TRACK_LOADED` - fired when an audio track loading finishes
  - data: { details : [LevelDetails](#leveldetails), id : audio track id, stats : [LoadStats] }
- `Hls.Events.SUBTITLE_TRACKS_UPDATED` - fired to notify that subtitle track lists has been updated
  - data: { subtitleTracks : subtitleTracks }
- `Hls.Events.SUBTITLE_TRACK_SWITCH` - fired when a subtitle track switch occurs
  - data: { id : subtitle track id, type? : playlist type ('SUBTITLES' | 'CLOSED-CAPTIONS'), url? : subtitle track URL }
- `Hls.Events.SUBTITLE_TRACK_LOADING` - fired when a subtitle track loading starts
  - data: { url : audio track URL, id : audio track id }
- `Hls.Events.SUBTITLE_TRACK_LOADED` - fired when a subtitle track loading finishes
  - data: { details : [LevelDetails](#leveldetails), id : subtitle track id, stats : [LoadStats] }
- `Hls.Events.SUBTITLE_FRAG_PROCESSED` - fired when a subtitle fragment has been processed
  - data: { success : boolean, frag : [the processed fragment object], error?: [error parsing subtitles if any] }
- `Hls.Events.INIT_PTS_FOUND` - fired when the first timestamp is found
  - data: { d : demuxer id, initPTS: initPTS, timescale: timescale, frag : fragment object }
- `Hls.Events.FRAG_LOADING` - fired when a fragment loading starts
  - data: { frag : fragment object, targetBufferTime: number | null [The unbuffered time that we expect to buffer with this fragment] }
- `Hls.Events.FRAG_LOAD_PROGRESS` - [deprecated]
- `Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED` - Identifier for fragment load aborting for emergency switch down
  - data: { frag : fragment object }
- `Hls.Events.FRAG_LOADED` - fired when a fragment loading is completed
  - data: { frag : fragment object, payload : fragment payload, stats : [LoadStats]}
- `Hls.Events.FRAG_DECRYPTED` - fired when a fragment decryption is completed
  - data: { id : demuxer id, frag : fragment object, payload : fragment payload, stats : { tstart, tdecrypt}}
- `Hls.Events.FRAG_PARSING_INIT_SEGMENT` - fired when Init Segment has been extracted from fragment
  - data: { id: demuxer id, frag : fragment object, moov : moov MP4 box, codecs : codecs found while parsing fragment }
- `Hls.Events.FRAG_PARSING_USERDATA` - fired when parsing sei text is completed
  - data: { id : demuxer id, frag: fragment object, samples : [ sei samples pes ], details: [LevelDetails](#leveldetails) }
- `Hls.Events.FRAG_PARSING_METADATA` - fired when parsing metadata is completed (ID3 / CMAF KLV)
  - data: { id: demuxer id, frag : fragment object, samples : [ type field aligns with values from `Hls.MetadataSchema` enum. pes - pts and dts timestamp are relative, values are in seconds], details: [LevelDetails](#leveldetails) }
- `Hls.Events.FRAG_PARSING_DATA` - [deprecated]
- `Hls.Events.FRAG_PARSED` - fired when fragment parsing is completed
  - data: { frag : fragment object, partIndex }
- `Hls.Events.FRAG_BUFFERED` - fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer
  - data: { id: demuxer id, frag : fragment object, stats : [LoadStats] }
- `Hls.Events.FRAG_CHANGED` - fired when fragment matching with current video position is changing
  - data: { id : demuxer id, frag : fragment object }
- `Hls.Events.FPS_DROP` - triggered when FPS drop in last monitoring period is higher than given threshold
  - data: { curentDropped : nb of dropped frames in last monitoring period, currentDecoded : nb of decoded frames in last monitoring period, totalDroppedFrames : total dropped frames on this video element }
- `Hls.Events.FPS_DROP_LEVEL_CAPPING` - triggered when FPS drop triggers auto level capping
  - data: { level: suggested new auto level capping by fps controller, droppedLevel : level has too many dropped frames and will be restricted }
- `Hls.Events.ERROR` - Identifier for an error event
  - data: { type : error type, details : error details, fatal : is error fatal or not, other error specific data }
- `Hls.Events.DESTROYING` - fired when hls.js instance starts destroying. Different from `MEDIA_DETACHED` as one could want to detach and reattach a video to the instance of hls.js to handle mid-rolls for example
  - data: { }
- `Hls.Events.KEY_LOADING` - fired when a decryption key loading starts
  - data: { frag : fragment object }
- `Hls.Events.KEY_LOADED` - fired when a decryption key loading is completed
  - data: { frag : fragment object }
- `Hls.Events.STREAM_STATE_TRANSITION` - [deprecated]
- `Hls.Events.NON_NATIVE_TEXT_TRACKS_FOUND` - When `renderTextTracksNatively` is `false`, this event will fire when a new captions or subtitle track is found, in the place of adding a TextTrack to the video element.
  - data: { tracks: Array<{ label, kind, default, subtitleTrack }> }
- `Hls.Events.CUES_PARSED` - When `renderTextTracksNatively` is `false`, this event will fire when new captions or subtitle cues are parsed.
  - data: { type, cues, track } }

## Creating a Custom Loader

You can use the internal loader definition for your own implementation via the static getter `Hls.DefaultConfig.loader`.

Example:

```js
let myHls = new Hls({
  pLoader: function (config) {
    let loader = new Hls.DefaultConfig.loader(config);

    Object.defineProperties(this, {
      stats: {
        get: () => loader.stats,
      },
      context: {
        get: () => loader.context,
      },
    });

    this.abort = () => loader.abort();
    this.destroy = () => loader.destroy();
    this.load = (context, config, callbacks) => {
      let { type, url } = context;

      if (type === 'manifest') {
        console.log(`Manifest ${url} will be loaded.`);
      }

      loader.load(context, config, callbacks);
    };
  },
});
```

Alternatively, environments that support ES6 classes can extends the loader directly:

```js
import Hls from 'hls.js';

let myHls = new Hls({
  pLoader: class CustomLoader extends Hls.DefaultConfig.loader {
    load(context, config, callbacks) {
      let { type, url } = context;

      // Custom behavior

      super.load(context, config, callbacks);
    }
  },
});
```

## Errors

Full list of errors is described below:

### Network Errors

- `Hls.ErrorDetails.MANIFEST_LOAD_ERROR` - raised when manifest loading fails because of a network error
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.MANIFEST_LOAD_ERROR`, fatal : `true`, url : manifest URL, response : { code: error code, text: error text }, loader : URL loader }
- `Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT` - raised when manifest loading fails because of a timeout
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT`, fatal : `true`, url : manifest URL, loader : URL loader }
- `Hls.ErrorDetails.MANIFEST_PARSING_ERROR` - raised when manifest parsing failed to find proper content
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.MANIFEST_PARSING_ERROR`, fatal : `true`, url : manifest URL, reason : parsing error reason }
- `Hls.ErrorDetails.LEVEL_EMPTY_ERROR` - raised when loaded level contains no fragments (applies to levels and audio and subtitle tracks)
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.LEVEL_EMPTY_ERROR`, url: playlist URL, reason: error reason, level: index of the bad level or undefined, parent: PlaylistLevelType }
- `Hls.ErrorDetails.LEVEL_LOAD_ERROR` - raised when level loading fails because of a network error
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.LEVEL_LOAD_ERROR`, fatal : `true`, url : level URL, response : { code: error code, text: error text }, loader : URL loader }
- `Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT` - raised when level loading fails because of a timeout
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT`, fatal : `false`, url : level URL, loader : URL loader }
- `Hls.ErrorDetails.LEVEL_PARSING_ERROR` - raised when playlist parsing failed or found invalid content (applies to levels and audio and subtitle tracks)
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.LEVEL_PARSING_ERROR`, fatal : `false`, url : level URL, error: Error, parent: PlaylistLevelType }
- `Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR` - raised when audio playlist loading fails because of a network error
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR`, fatal : `false`, url : audio URL, response : { code: error code, text: error text }, loader : URL loader }
- `Hls.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT` - raised when audio playlist loading fails because of a timeout
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT`, fatal : `false`, url : audio URL, loader : URL loader }
- `Hls.ErrorDetails.SUBTITLE_LOAD_ERROR` - raised when subtitle playlist loading fails because of a network error
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.SUBTITLE_LOAD_ERROR`, fatal : `false`, url, response : { code: error code, text: error text }, loader : URL loader }
- `Hls.ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT` - raised when subtitle playlist loading fails because of a timeout
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT`, fatal : `false`, url, loader : URL loader }
- `Hls.ErrorDetails.FRAG_LOAD_ERROR` - raised when fragment loading fails because of a network error
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.FRAG_LOAD_ERROR`, fatal : `true` or `false`, frag : fragment object, response : { code: error code, text: error text } }
- `Hls.ErrorDetails.FRAG_LOAD_TIMEOUT` - raised when fragment loading fails because of a timeout
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.FRAG_LOAD_TIMEOUT`, fatal : `true` or `false`, frag : fragment object }
- `Hls.ErrorDetails.KEY_LOAD_ERROR` - raised when decrypt key loading fails because of a network error
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.KEY_LOAD_ERROR`, fatal : `false`, frag : fragment object, response : { code: error code, text: error text } }
- `Hls.ErrorDetails.KEY_LOAD_TIMEOUT` - raised when decrypt key loading fails because of a timeout
  - data: { type : `NETWORK_ERROR`, details : `Hls.ErrorDetails.KEY_LOAD_TIMEOUT`, fatal : `true`, frag : fragment object }

### Media Errors

- `Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR` - raised when manifest only contains quality level with codecs incompatible with MediaSource Engine.
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR`, fatal : `true`, url : manifest URL }
- `Hls.ErrorDetails.FRAG_DECRYPT_ERROR` - raised when fragment decryption fails
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.FRAG_DECRYPT_ERROR`, fatal : `true`, reason : failure reason }
- `Hls.ErrorDetails.FRAG_PARSING_ERROR` - raised when fragment parsing fails
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.FRAG_PARSING_ERROR`, fatal : `true` or `false`, reason : failure reason }
- `Hls.ErrorDetails.FRAG_GAP` - raised when segment loading is skipped because a fragment with a GAP tag or part with GAP=YES attribute was encountered
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.FRAG_GAP`, fatal : `false`, frag : fragment object, part? : part object (if any) }
- `Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR` - raised when MediaSource fails to add new sourceBuffer
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR`, fatal : `false`, error : error raised by MediaSource, mimeType: mimeType on which the failure happened }
- `Hls.ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR` - raised when no MediaSource(s) could be created based on track codec(s)
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR`, fatal : `true`, reason : failure reason }
- `Hls.ErrorDetails.BUFFER_APPEND_ERROR` - raised when exception is raised while calling buffer append
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_APPEND_ERROR`, fatal : `true` or `false`, parent : parent stream controller }
- `Hls.ErrorDetails.BUFFER_APPENDING_ERROR` - raised when exception is raised during buffer appending
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_APPENDING_ERROR`, fatal : `false` }
- `Hls.ErrorDetails.BUFFER_STALLED_ERROR` - raised when playback is stuck because buffer is running out of data
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_STALLED_ERROR`, fatal : `true` or `false`, buffer : buffer length (optional) }
- `Hls.ErrorDetails.BUFFER_FULL_ERROR` - raised when no data can be appended anymore in media buffer because it is full. this error is recovered by reducing the max buffer length.
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_FULL_ERROR`, fatal : `false` }
- `Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE` - raised after hls.js seeks over a buffer hole to unstuck the playback,
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE`, fatal : `false`, hole : hole duration }
- `Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL` - raised when playback is stuck although currentTime is in a buffered area
  - data: { type : `MEDIA_ERROR`, details : `Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL`, fatal : `true`|`false` }
  - Not fatal for the first few nudges, but if we reach `config.nudgeMaxRetry` attempts and the player is still stalled, then `BUFFER_NUDGE_ON_STALL` is fatal

### Mux Errors

- `Hls.ErrorDetails.REMUX_ALLOC_ERROR` - raised when memory allocation fails during remuxing
  - data: { type : `MUX_ERROR`, details : `Hls.ErrorDetails.REMUX_ALLOC_ERROR`, fatal : `false`, bytes : mdat size, reason : failure reason }

### EME Key System Errors

- `Hls.ErrorDetails.KEY_SYSTEM_NO_KEYS` - EME catch-all error
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_NO_KEYS`, fatal : `true`, error: Error }
- `Hls.ErrorDetails.KEY_SYSTEM_NO_ACCESS` - EME MediaKeyFunc `requestMediaKeySystemAccess(keySystem, supportedConfigurations)` failed to access key-system
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_NO_ACCESS`, fatal : `true`, error: Error }
- `Hls.ErrorDetails.KEY_SYSTEM_NO_SESSION` - MediaKeySession `generateRequest(initDataType, initData)` failed
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_NO_SESSION`, fatal : `false`, error: Error }
- `Hls.ErrorDetails.KEY_SYSTEM_NO_CONFIGURED_LICENSE` - Player configuration is missing `drmSystems` key-system license options
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_NO_CONFIGURED_LICENSE`, fatal : `false` }
- `Hls.ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED` - Key-system license request failed (fails on first status 4xx, or after 3 tries (EMEController MAX_LICENSE_REQUEST_FAILURES))
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_LICENSE_REQUEST_FAILED`, fatal : `true`, networkDetails: XMLHttpRequest }
- `Hls.ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED` - Key-system certificate request failed
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED`, fatal : `true`, networkDetails: XMLHttpRequest }
- `Hls.ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED` - `MediaKeys.setServerCertificate(certificateData)` failed
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED`, fatal : `true`, error: Error }
- `Hls.ErrorDetails.KEY_SYSTEM_SESSION_UPDATE_FAILED` - MediaKeySession `update(licenseResponse|acknowledged)` failed
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_SESSION_UPDATE_FAILED`, fatal : `true`, error: Error }
- `Hls.ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED` - HDCP level output restricted for key-session
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED`, fatal : `false` }
- `Hls.ErrorDetails.KEY_SYSTEM_STATUS_INTERNAL_ERROR` - key-session status changed to "internal-error"
  - data: { type : `KEY_SYSTEM_ERROR`, details : `Hls.ErrorDetails.KEY_SYSTEM_STATUS_INTERNAL_ERROR`, fatal : `true` }

### Other Errors

- `Hls.ErrorDetails.LEVEL_SWITCH_ERROR` - raised when level switching fails
  - data: { type : `OTHER_ERROR`, details : `Hls.ErrorDetails.LEVEL_SWITCH_ERROR`, fatal : `false`, level : failed level index, reason : failure reason }
- `Hls.ErrorDetails.INTERNAL_EXCEPTION` - raised when an exception occurs in an internal hls.js event handler
  - data: { type : `OTHER_ERROR`, details : `Hls.ErrorDetails.INTERNAL_EXCEPTION`, fatal : `true` or `false`, event : event object or string, err : { message : error message } }
- `Hls.ErrorDetails.UNKNOWN` - Uncategorized error

## Objects

### Level

A `Level` object represents a given quality level.
It contains quality level related info, retrieved from manifest, such as:

- level bitrate
- used codecs
- video width/height
- level name
- level URL

See sample `Level` object below:

```js
{
  audioCodec: "mp4a.40.2"
  audioGroupIds: <string[]> | undefined,
  bitrate: 3000000,
  codecSet: "avc1,mp4a",
  details: <LevelDetails> | undefined
  fragmentError: 0,
  frameRate: 30,
  height: 720,
  loadError: 0
  name: "720p",
  realBitrate: 0,
  supportedPromise: undefined,
  supportedResult: {supported: true, configurations: <MediaDecodingConfiguration[]>, decodingInfoResults: <MediaCapabilitiesDecodingInfo[]>}
  textGroupIds: <string[]> | undefined,
  unknownCodecs: [],
  url: [ "http://levelURL.com", "http://levelURLfailover.com" ],
  videoCodec: "avc1.66.30",
  width: 1280,
  attrs: <AttrList>,
  audioGroupId: undefined,
  averageBitrate: 2962000,
  codecs: "avc1.66.30,mp4a.40.2",
  maxBitrate: 3000000,
  pathwayId: ".",
  score: 0,
  textGroupId: "subs",
  uri: "http://levelURL.com",
  urlId: 0,
  videoRange: "SDR"
}
```

- `url` is an array that might contains several items if failover/redundant streams are found in the manifest.

### LevelDetails

A `LevelDetails` object contains level details retrieved after level playlist parsing, they are specified below:

- protocol version
- playlist type
- start sequence number
- end sequence number
- level total duration
- level fragment target duration
- array of fragments info
- is this level a live playlist or not?

See sample object below, available after corresponding `LEVEL_LOADED` event has been fired:

```js
{
  version: 3,
  type: 'VOD', // null if EXT-X-PLAYLIST-TYPE not present
  startSN: 0,
  endSN: 50,
  totalduration: 510,
  targetduration: 10,
  fragments: Array(51),
  live: false
}
```

### Fragment

The `Fragment` object contains fragment related info, such as:

- fragment URL
- fragment duration
- fragment sequence number
- fragment start offset
- level identifier

See sample object below:

```js
{
  duration: 10,
  level: 3,
  cc: 0
  sn: 35,
  start: 30,
  url: 'http://fragURL.com'
}
```
