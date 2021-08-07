# Migrating from hls.js 0.x to 1.x

This guide provides an overview to migrating an application using hls.js from v0.14.x to v1.0.0.

## Dependencies

Promise support is now required. If your app requires support for older browsers that do not include support for Promises,
include your own Promise polyfill.

## Configuration Changes

### Back Buffer Eviction

The new `backBufferLength` setting defaults to 90 seconds, and applies to Live and VOD streams. In version 1.0 and up,
the back buffer on VOD content will be cleared by hls.js rather than leaving it up to the browser by default.

Set `backBufferLength` to `Infinity` and `liveBackBufferLength` to `90` if you would like 1.0 to handle back buffer
eviction for Live and VOD streams as older versions did. While `liveBackBufferLength` can still be used, it has been
marked deprecated and may be removed in an upcoming minor release.

### Low Latency Streams

The new `lowLatencyMode` setting is enabled by default. Set to `false` to disable Low-latency part loading and target
latency playback rate adjustment.

### Chunked Transfer Support (experimental)

The new experimental `progressive` setting is disabled by default. Set it to `true` to stream and append audio and
video data as it streams for each segment before segment load completion. Not recommended for production or small segments
with only a single GoP or less.

## Support for Group-Level Track Switching

- `hls.audioTracks` and `hls.subtitleTracks` as well as `AUDIO_TRACKS_UPDATED` and `SUBTITLE_TRACKS_UPDATED` events only list tracks in the active level's audio/sub GROUP-ID after `LEVEL_LOADING` (this will go unnoticed for streams with no or only one group per track type)
  - The `MANIFEST_PARSED` event still reports all tracks when multiple GROUP-ID values are present. Applications that used that event to get tracks would need to be updated in v1 to switch to the corresponding track update events to select available tracks using the available indexes.
  - Track ids are no longer indexes of the complete list of audio or subtitle tracks. They are now indexes within each group. So six tracks in two groups that had ids 0,1,2,3,4,5 will now have ids 0,1,2,0,1,2. This allows for tracks to be changed by index/id within the range of available tracks as they were before.
- Added `groupId` to audio and subtitle track loading and loaded events

## Playback and Level Changes

- Setting `hls.currentLevel` no longer pauses the media element while clearing the buffer and loading the new level. This can result in a stall error if playback doesn't start within a quarter of a second. Applications implementing manual quality switching with `hls.currentLevel` that do not want a stall reported should either pause or set `video.playbackRate` to `0` until the level switch is complete.

## Event Changes

Event order and content have changed in some places. See **Breaking Changes** below, and please report any issues with breaking changes that impact your integrations

- `FRAG_LOADED` fires after events handled on progress which can include everything up to appending a fragment if workers are disabled (more details below under **Known Issues**)
- `BUFFER_CODECS` data has changed from `{ tracks: { video?, audio? } }` to simply `{ video?, audio? }`
- `BUFFER_APPENDING` data has changed from `{ type, data, parent, content }` to `{ type, data, frag, chunkMeta }`
- `BUFFER_APPENDED` data has changed
- `FRAG_DECRYPT_ERROR` events are now surfaced as a `FRAG_PARSING_ERROR` along with other fragment transmuxing errors
- Added additional error details to help identify the source of certain network error events:
  - `SUBTITLE_LOAD_ERROR`
  - `SUBTITLE_TRACK_LOAD_TIMEOUT`
  - `UNKNOWN`
- Added additional error detail for streams that cannot start because source buffer(s) could not be created after parsing media codecs
  - `BUFFER_INCOMPATIBLE_CODECS_ERROR` will fire instead of `BUFFER_CREATED` with an empty `tracks` list. This media error
    is fatal and not recoverable. If you encounter this error make sure you include the correct CODECS string in
    your manifest, as this is most likely to occur when attempting to play a fragmented mp4 playlist with unknown codecs.

### Fragment Stats

- The `stats` object has changed
  - `trequest`, `tfirst`, `tload` have been replaced by `loading: HlsProgressivePerformanceTiming`
  - `tparsed` has been replaced by `parsing: HlsProgressivePerformanceTiming`
- On the `Fragment` object:
  - `hasElementaryStream` function has been removed
  - `setElementaryStream` and `_elementaryStreams` have been renamed (these are only for internal use)

### LL-HLS Parts in events

- FRAG\_\_\_\_ events are now fired for LL-HLS part events with a `part` property that include the part details.

### TypeScript

v0.x types are not compatible with v1.x. Type definitions are now exported with the build and npm package in
`dist/hls.js.d.ts`. Please use these type definitions if you are having trouble with
[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) `@types/hls.js` and v1.x.
