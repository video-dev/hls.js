##design principle

design idea is pretty simple :

   - main functionalities are splitted into several subsystems
   - each subsystem heavily relies on events for internal/external communications.

##code structure

  - [src/hls.js](src/hls.js)
    - definition of Hls Class. instantiate all subcomponents, upon instantiation of an Hls object.
  - [src/events.js](src/events.js)
    - definition of Hls.Events
  - [src/errors.js](src/errors.js)
    - definition of Hls.ErrorTypes and Hls.ErrorDetails
  - [src/stats.js](src/stats.js)
    - subsystem monitoring events, and aggregating them into an object, that could be retrieved through hls.stats getter
  - [src/observer.js](src/observer.js)
    -  abstracts [events.EventEmitter()](https://nodejs.org/api/events.html#events_class_events_eventemitter) class, used for event dispatching.

  - [src/controller/buffer-controller.js](src/controller/buffer-controller.js)
    - in charge of:
      - ensuring that buffer is filled as per defined quality selection logic. 
      - monitoring current playback quality level
    - if buffer is not filled up appropriately (i.e. as per defined maximum buffer size, or as per defined quality level), buffer controller will trigger the following actions:
        - retrieve "not buffered" media position greater then current playback position
        - retrieve URL of fragment matching with this media position, and appropriate quality level
        - trigger fragment loading
        - monitor fragment loading speed:
         - "expected time of fragment load completion" is computed using "fragment loading instant bandwidth".
         - this time is compared to the "expected time of buffer starvation".
         - if we have less than 2 fragments buffered and if "expected time of fragment load completion" is bigger than "expected time of buffer starvation" and also bigger than duration needed to load fragment at level 0 (lowest quality level), current fragment loading is aborted, and an emergency switch down is triggered.
        - trigger fragment parsing (TS demuxing and remuxing in MP4 boxes) upon loading completion
        - trigger MP4 boxes appending in [SourceBuffer](http://www.w3.org/TR/media-source/#sourcebuffer) upon fragment parsing completion.

      buffer controller actions are scheduled by a tick timer (invoked every 100ms) and actions are controlled by a state machine.

  - [src/controller/fps-controller.js](src/controller/fps-controller.js)
    - in charge of monitoring frame rate, and fire FPS_DROP event in case FPS drop exceeds configured threshold.
  - [src/controller/level-controller.js](src/controller/level-controller.js)
    - in charge of scheduling playlist (re)loading, monitoring fragment loading bitrate, and determining auto quality level.
    - a timer is armed to periodically refresh active live playlist.
    - auto quality switch algorithm is pretty naive and simple ATM and similar to the one that could be found in google [StageFright](https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp)

  - [src/demux/demuxer.js](src/demux/demuxer.js)
    - demuxer abstraction interface, that will either use a [Worker](https://en.wikipedia.org/wiki/Web_worker) to demux or demux inline depending on config/browser capabilities.
    - if Worker are disabled. demuxing will be performed in the main thread.
    - if Worker are available/enabled,
      - demuxer will instantiate a Worker
      - post/listen to Worker message, 
      - and redispatch events as expected by hls.js.
    - TS fragments are sent as [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
  - [src/demux/exp-golomb.js](src/demux/exp-golomb.js)
    - utility class to extract Exponential-Golomb coded data. needed by TS demuxer for SPS parsing.
  - [src/demux/tsdemuxer.js](src/demux/tsdemuxer.js)
    - highly optimized TS demuxer, convert TS packet into ISO BMFF (MP4) boxes, notify demuxing completion using events.
     - this demuxer is able to deal with small gaps between fragments and ensure timestamp continuity.
     - it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
  - [src/demux/tsdemuxerworker.js](src/demux/tsdemuxerworker.js)
    - TS demuxer web worker. 
    - listen to worker message, and trigger tsdemuxer upon reception of TS fragments.
    - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
  - [src/loader/fragment-loader.js](src/loader/fragment-loader.js)
    - in charge of loading fragments, use xhr-loader if not overrided by user config
  - [src/loader/playlist-loader.js](src/loader/playlist-loader.js)
   - in charge of loading manifest, and level playlists, use xhr-loader if not overrided by user config.
  - [src/remux/mp4-generator.js](src/remux/mp4-generator.js)
   - in charge of converting AVC/AAC samples in MP4 boxes
     - generate Init Segment (moov)
     - generate samples Box (moof and mdat)

  - [src/utils/hex.js](src/utils/hex.js)
    - Hex dump utils, useful for debug
  - [src/utils/logger.js](src/utils/logger.js)
    - logging utils, useful for debug
  - [src/utils/xhr-loader.js](src/utils/xhr-loader.js)
    - XmlHttpRequest wrapper. it handles standard HTTP GET but also retries and timeout. 
    - retries : if xhr fails, HTTP GET will be retried after a predetermined delay. this delay is increasing following an exponential backoff. after a predetemined max number of retries, an error callback will be triggered.
    - timeout: if load exceeds max allowed duration, a timeout callback will be triggered. it is up to the callback to decides whether the connection should be cancelled or not.
