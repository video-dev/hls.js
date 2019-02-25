/**
 * PlaylistLoader - delegate for media manifest/playlist loading tasks. Takes care of parsing media to internal data-models.
 *
 * Once loaded, dispatches events with parsed data-models of manifest/levels/audio/subtitle tracks.
 *
 * Uses loader(s) set in config to do actual internal loading of resource tasks.
 *
 * @module
 *
 */

import Event from '../events';
import EventHandler from '../event-handler';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import { Loader, PlaylistContextType, PlaylistLoaderContext, PlaylistLevelType, LoaderCallbacks, LoaderResponse, LoaderStats, LoaderConfiguration } from '../types/loader';
import MP4Demuxer from '../demux/mp4demuxer';
import M3U8Parser from './m3u8-parser';

const { performance } = window;

/**
 * @constructor
 */
class PlaylistLoader extends EventHandler {
  private loaders: Partial<Record<PlaylistContextType, Loader<PlaylistLoaderContext>>> = {};

  /**
   * @constructs
   * @param {Hls} hls
   */
  constructor (hls) {
    super(hls,
      Event.MANIFEST_LOADING,
      Event.LEVEL_LOADING,
      Event.AUDIO_TRACK_LOADING,
      Event.SUBTITLE_TRACK_LOADING);
  }

  /**
   * @param {PlaylistContextType} type
   * @returns {boolean}
   */
  static canHaveQualityLevels (type: PlaylistContextType): boolean {
    return (type !== PlaylistContextType.AUDIO_TRACK &&
      type !== PlaylistContextType.SUBTITLE_TRACK);
  }

  /**
   * Map context.type to LevelType
   * @param {PlaylistLoaderContext} context
   * @returns {LevelType}
   */
  static mapContextToLevelType (context: PlaylistLoaderContext): PlaylistLevelType {
    const { type } = context;

    switch (type) {
    case PlaylistContextType.AUDIO_TRACK:
      return PlaylistLevelType.AUDIO;
    case PlaylistContextType.SUBTITLE_TRACK:
      return PlaylistLevelType.SUBTITLE;
    default:
      return PlaylistLevelType.MAIN;
    }
  }

  static getResponseUrl (response: LoaderResponse, context: PlaylistLoaderContext): string {
    let url = response.url;
    // responseURL not supported on some browsers (it is used to detect URL redirection)
    // data-uri mode also not supported (but no need to detect redirection)
    if (url === undefined || url.indexOf('data:') === 0) {
      // fallback to initial URL
      url = context.url;
    }
    return url;
  }

  /**
   * Returns defaults or configured loader-type overloads (pLoader and loader config params)
   * Default loader is XHRLoader (see utils)
   * @param {PlaylistLoaderContext} context
   * @returns {Loader} or other compatible configured overload
   */
  createInternalLoader (context: PlaylistLoaderContext): Loader<PlaylistLoaderContext> {
    const config = this.hls.config;
    const PLoader = config.pLoader;
    const Loader = config.loader;
    // TODO(typescript-config): Verify once config is typed that InternalLoader always returns a Loader
    const InternalLoader = PLoader || Loader;

    const loader = new InternalLoader(config);

    // TODO - Do we really need to assign the instance or if the dep has been lost
    context.loader = loader;
    this.loaders[context.type] = loader;

    return loader;
  }

  getInternalLoader (context: PlaylistLoaderContext): Loader<PlaylistLoaderContext> | undefined {
    return this.loaders[context.type];
  }

  resetInternalLoader (contextType: PlaylistContextType) {
    if (this.loaders[contextType]) {
      delete this.loaders[contextType];
    }
  }

  /**
   * Call `destroy` on all internal loader instances mapped (one per context type)
   */
  destroyInternalLoaders () {
    for (let contextType in this.loaders) {
      let loader = this.loaders[contextType];
      if (loader) {
        loader.destroy();
      }

      this.resetInternalLoader(contextType as PlaylistContextType);
    }
  }

  destroy () {
    this.destroyInternalLoaders();

    super.destroy();
  }

  onManifestLoading (data: { url: string; }) {
    this.load({
      url: data.url,
      type: PlaylistContextType.MANIFEST,
      level: 0,
      id: null,
      responseType: 'text'
    });
  }

  onLevelLoading (data: { url: string; level: number | null; id: number | null; }) {
    this.load({
      url: data.url,
      type: PlaylistContextType.LEVEL,
      level: data.level,
      id: data.id,
      responseType: 'text'
    });
  }

  onAudioTrackLoading (data: { url: string; id: number | null; }) {
    this.load({
      url: data.url,
      type: PlaylistContextType.AUDIO_TRACK,
      level: null,
      id: data.id,
      responseType: 'text'
    });
  }

  onSubtitleTrackLoading (data: { url: string; id: number | null; }) {
    this.load({
      url: data.url,
      type: PlaylistContextType.SUBTITLE_TRACK,
      level: null,
      id: data.id,
      responseType: 'text'
    });
  }

  load (context: PlaylistLoaderContext): boolean {
    const config = this.hls.config;

    logger.debug(`Loading playlist of type ${context.type}, level: ${context.level}, id: ${context.id}`);

    // Check if a loader for this context already exists
    let loader = this.getInternalLoader(context);
    if (loader) {
      const loaderContext = loader.context;
      if (loaderContext && loaderContext.url === context.url) { // same URL can't overlap
        logger.trace('playlist request ongoing');
        return false;
      } else {
        logger.warn(`aborting previous loader for type: ${context.type}`);
        loader.abort();
      }
    }

    let maxRetry: number;
    let timeout: number;
    let retryDelay: number;
    let maxRetryDelay: number;

    // apply different configs for retries depending on
    // context (manifest, level, audio/subs playlist)
    switch (context.type) {
    case PlaylistContextType.MANIFEST:
      maxRetry = config.manifestLoadingMaxRetry;
      timeout = config.manifestLoadingTimeOut;
      retryDelay = config.manifestLoadingRetryDelay;
      maxRetryDelay = config.manifestLoadingMaxRetryTimeout;
      break;
    case PlaylistContextType.LEVEL:
      // Disable internal loader retry logic, since we are managing retries in Level Controller
      maxRetry = 0;
      maxRetryDelay = 0;
      retryDelay = 0;
      timeout = config.levelLoadingTimeOut;
      // TODO Introduce retry settings for audio-track and subtitle-track, it should not use level retry config
      break;
    default:
      maxRetry = config.levelLoadingMaxRetry;
      timeout = config.levelLoadingTimeOut;
      retryDelay = config.levelLoadingRetryDelay;
      maxRetryDelay = config.levelLoadingMaxRetryTimeout;
      break;
    }

    loader = this.createInternalLoader(context);

    const loaderConfig: LoaderConfiguration = {
      timeout,
      maxRetry,
      retryDelay,
      maxRetryDelay
    };

    const loaderCallbacks: LoaderCallbacks<PlaylistLoaderContext> = {
      onSuccess: this.loadsuccess.bind(this),
      onError: this.loaderror.bind(this),
      onTimeout: this.loadtimeout.bind(this)
    };

    logger.debug(`Calling internal loader delegate for URL: ${context.url}`);
    loader.load(context, loaderConfig, loaderCallbacks);

    return true;
  }

  loadsuccess (response: LoaderResponse, stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: unknown = null) {
    if (context.isSidxRequest) {
      this._handleSidxRequest(response, context);
      this._handlePlaylistLoaded(response, stats, context, networkDetails);
      return;
    }

    this.resetInternalLoader(context.type);
    if (typeof response.data !== 'string') {
      throw new Error('expected responseType of "text" for PlaylistLoader');
    }

    const string = response.data;

    stats.tload = performance.now();
    // stats.mtime = new Date(target.getResponseHeader('Last-Modified'));

    // Validate if it is an M3U8 at all
    if (string.indexOf('#EXTM3U') !== 0) {
      this._handleManifestParsingError(response, context, 'no EXTM3U delimiter', networkDetails);
      return;
    }

    // Check if chunk-list or master. handle empty chunk list case (first EXTINF not signaled, but TARGETDURATION present)
    if (string.indexOf('#EXTINF:') > 0 || string.indexOf('#EXT-X-TARGETDURATION:') > 0) {
      this._handleTrackOrLevelPlaylist(response, stats, context, networkDetails);
    } else {
      this._handleMasterPlaylist(response, stats, context, networkDetails);
    }
  }

  loaderror (response: LoaderResponse, context: PlaylistLoaderContext, networkDetails = null) {
    this._handleNetworkError(context, networkDetails, false, response);
  }

  loadtimeout (stats: LoaderStats, context: PlaylistLoaderContext, networkDetails = null) {
    this._handleNetworkError(context, networkDetails, true);
  }

  // TODO(typescript-config): networkDetails can currently be a XHR or Fetch impl,
  // but with custom loaders it could be generic investigate this further when config is typed
  _handleMasterPlaylist (response: LoaderResponse, stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: unknown) {
    const hls = this.hls;
    const string = response.data;

    const url = PlaylistLoader.getResponseUrl(response, context);

    const levels = M3U8Parser.parseMasterPlaylist(string, url);
    if (!levels.length) {
      this._handleManifestParsingError(response, context, 'no level found in manifest', networkDetails);
      return;
    }

    // multi level playlist, parse level info

    const audioGroups = levels.map(level => ({
      id: level.attrs.AUDIO,
      codec: level.audioCodec
    }));

    let audioTracks = M3U8Parser.parseMasterPlaylistMedia(string, url, 'AUDIO', audioGroups);
    let subtitles = M3U8Parser.parseMasterPlaylistMedia(string, url, 'SUBTITLES');

    if (audioTracks.length) {
      // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
      let embeddedAudioFound = false;
      audioTracks.forEach(audioTrack => {
        if (!audioTrack.url) {
          embeddedAudioFound = true;
        }
      });

      // if no embedded audio track defined, but audio codec signaled in quality level,
      // we need to signal this main audio track this could happen with playlists with
      // alt audio rendition in which quality levels (main)
      // contains both audio+video. but with mixed audio track not signaled
      if (embeddedAudioFound === false && levels[0].audioCodec && !levels[0].attrs.AUDIO) {
        logger.log('audio codec signaled in quality level, but no embedded audio track signaled, create one');
        audioTracks.unshift({
          type: 'main',
          name: 'main'
        });
      }
    }

    hls.trigger(Event.MANIFEST_LOADED, {
      levels,
      audioTracks,
      subtitles,
      url,
      stats,
      networkDetails
    });
  }

  _handleTrackOrLevelPlaylist (response: LoaderResponse, stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: unknown) {
    const hls = this.hls;

    const { id, level, type } = context;

    const url = PlaylistLoader.getResponseUrl(response, context);

    // if the values are null, they will result in the else conditional
    const levelUrlId = Number.isFinite(id as number) ? id : 0;
    const levelId = Number.isFinite(level as number) ? level : levelUrlId;

    const levelType = PlaylistLoader.mapContextToLevelType(context);
    const levelDetails = M3U8Parser.parseLevelPlaylist(response.data, url, levelId, levelType, levelUrlId);

    // set stats on level structure
    // TODO(jstackhouse): why? mixing concerns, is it just treated as value bag?
    (levelDetails as any).tload = stats.tload;

    // We have done our first request (Manifest-type) and receive
    // not a master playlist but a chunk-list (track/level)
    // We fire the manifest-loaded event anyway with the parsed level-details
    // by creating a single-level structure for it.
    if (type === PlaylistContextType.MANIFEST) {
      const singleLevel = {
        url,
        details: levelDetails
      };

      hls.trigger(Event.MANIFEST_LOADED, {
        levels: [singleLevel],
        audioTracks: [],
        url,
        stats,
        networkDetails
      });
    }

    // save parsing time
    stats.tparsed = performance.now();

    // in case we need SIDX ranges
    // return early after calling load for
    // the SIDX box.
    if (levelDetails.needSidxRanges) {
      const sidxUrl = levelDetails.initSegment.url;
      this.load({
        url: sidxUrl,
        isSidxRequest: true,
        type,
        level,
        levelDetails,
        id,
        rangeStart: 0,
        rangeEnd: 2048,
        responseType: 'arraybuffer'
      });
      return;
    }

    // extend the context with the new levelDetails property
    context.levelDetails = levelDetails;

    this._handlePlaylistLoaded(response, stats, context, networkDetails);
  }

  _handleSidxRequest (response: LoaderResponse, context: PlaylistLoaderContext) {
    if (typeof response.data === 'string') {
      throw new Error('sidx request must be made with responseType of array buffer');
    }

    const sidxInfo = MP4Demuxer.parseSegmentIndex(new Uint8Array(response.data));
    // if provided fragment does not contain sidx, early return
    if (!sidxInfo) {
      return;
    }
    const sidxReferences = sidxInfo.references;
    const levelDetails = context.levelDetails;
    sidxReferences.forEach((segmentRef, index) => {
      const segRefInfo = segmentRef.info;
      if (!levelDetails) {
        return;
      }
      const frag = levelDetails.fragments[index];
      if (frag.byteRange.length === 0) {
        frag.setByteRange(String(1 + segRefInfo.end - segRefInfo.start) + '@' + String(segRefInfo.start));
      }
    });

    if (levelDetails) {
      levelDetails.initSegment.setByteRange(String(sidxInfo.moovEndOffset) + '@0');
    }
  }

  _handleManifestParsingError (response: LoaderResponse, context: PlaylistLoaderContext, reason: string, networkDetails: unknown) {
    this.hls.trigger(Event.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_PARSING_ERROR,
      fatal: true,
      url: response.url,
      reason,
      networkDetails
    });
  }

  _handleNetworkError (context: PlaylistLoaderContext, networkDetails: unknown, timeout: boolean = false, response: LoaderResponse | null = null) {
    logger.info(`A network error occured while loading a ${context.type}-type playlist`);

    let details;
    let fatal;

    const loader = this.getInternalLoader(context);

    switch (context.type) {
    case PlaylistContextType.MANIFEST:
      details = (timeout ? ErrorDetails.MANIFEST_LOAD_TIMEOUT : ErrorDetails.MANIFEST_LOAD_ERROR);
      fatal = true;
      break;
    case PlaylistContextType.LEVEL:
      details = (timeout ? ErrorDetails.LEVEL_LOAD_TIMEOUT : ErrorDetails.LEVEL_LOAD_ERROR);
      fatal = false;
      break;
    case PlaylistContextType.AUDIO_TRACK:
      details = (timeout ? ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT : ErrorDetails.AUDIO_TRACK_LOAD_ERROR);
      fatal = false;
      break;
    default:
      // details = ...?
      fatal = false;
    }

    if (loader) {
      loader.abort();
      this.resetInternalLoader(context.type);
    }

    // TODO(typescript-events): when error events are handled, type this
    let errorData: any = {
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal,
      url: context.url,
      loader,
      context,
      networkDetails
    };

    if (response) {
      errorData.response = response;
    }

    this.hls.trigger(Event.ERROR, errorData);
  }

  _handlePlaylistLoaded (response: LoaderResponse, stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: unknown) {
    const { type, level, id, levelDetails } = context;

    if (!levelDetails || !levelDetails.targetduration) {
      this._handleManifestParsingError(response, context, 'invalid target duration', networkDetails);
      return;
    }

    const canHaveLevels = PlaylistLoader.canHaveQualityLevels(context.type);
    if (canHaveLevels) {
      this.hls.trigger(Event.LEVEL_LOADED, {
        details: levelDetails,
        level: level || 0,
        id: id || 0,
        stats,
        networkDetails
      });
    } else {
      switch (type) {
      case PlaylistContextType.AUDIO_TRACK:
        this.hls.trigger(Event.AUDIO_TRACK_LOADED, {
          details: levelDetails,
          id,
          stats,
          networkDetails
        });
        break;
      case PlaylistContextType.SUBTITLE_TRACK:
        this.hls.trigger(Event.SUBTITLE_TRACK_LOADED, {
          details: levelDetails,
          id,
          stats,
          networkDetails
        });
        break;
      }
    }
  }
}

export default PlaylistLoader;
