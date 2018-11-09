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

import MP4Demuxer from '../demux/mp4demuxer';
import M3U8Parser from './m3u8-parser';

const { performance } = window;

/**
 * `type` property values for this loaders' context object
 * @enum
 *
 */
const ContextType = {
  MANIFEST: 'manifest',
  LEVEL: 'level',
  AUDIO_TRACK: 'audioTrack',
  SUBTITLE_TRACK: 'subtitleTrack'
};

/**
 * @enum {string}
 */
const LevelType = {
  MAIN: 'main',
  AUDIO: 'audio',
  SUBTITLE: 'subtitle'
};

/**
 * @constructor
 */
class PlaylistLoader extends EventHandler {
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

    this.loaders = {};
  }

  static get ContextType () {
    return ContextType;
  }

  static get LevelType () {
    return LevelType;
  }

  /**
   * @param {ContextType} type
   * @returns {boolean}
   */
  static canHaveQualityLevels (type) {
    return (type !== ContextType.AUDIO_TRACK &&
      type !== ContextType.SUBTITLE_TRACK);
  }

  /**
   * Map context.type to LevelType
   * @param {{type: ContextType}} context
   * @returns {LevelType}
   */
  static mapContextToLevelType (context) {
    const { type } = context;

    switch (type) {
    case ContextType.AUDIO_TRACK:
      return LevelType.AUDIO;
    case ContextType.SUBTITLE_TRACK:
      return LevelType.SUBTITLE;
    default:
      return LevelType.MAIN;
    }
  }

  static getResponseUrl (response, context) {
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
   * @param {object} context
   * @returns {XHRLoader} or other compatible configured overload
   */
  createInternalLoader (context) {
    const config = this.hls.config;
    const PLoader = config.pLoader;
    const Loader = config.loader;
    const InternalLoader = PLoader || Loader;

    const loader = new InternalLoader(config);

    context.loader = loader;
    this.loaders[context.type] = loader;

    return loader;
  }

  getInternalLoader (context) {
    return this.loaders[context.type];
  }

  resetInternalLoader (contextType) {
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

      this.resetInternalLoader(contextType);
    }
  }

  destroy () {
    this.destroyInternalLoaders();

    super.destroy();
  }

  onManifestLoading (data) {
    this.load(data.url, { type: ContextType.MANIFEST, level: 0, id: null });
  }

  onLevelLoading (data) {
    this.load(data.url, { type: ContextType.LEVEL, level: data.level, id: data.id });
  }

  onAudioTrackLoading (data) {
    this.load(data.url, { type: ContextType.AUDIO_TRACK, level: null, id: data.id });
  }

  onSubtitleTrackLoading (data) {
    this.load(data.url, { type: ContextType.SUBTITLE_TRACK, level: null, id: data.id });
  }

  load (url, context) {
    const config = this.hls.config;

    logger.debug(`Loading playlist of type ${context.type}, level: ${context.level}, id: ${context.id}`);

    // Check if a loader for this context already exists
    let loader = this.getInternalLoader(context);
    if (loader) {
      const loaderContext = loader.context;
      if (loaderContext && loaderContext.url === url) { // same URL can't overlap
        logger.trace('playlist request ongoing');
        return false;
      } else {
        logger.warn(`aborting previous loader for type: ${context.type}`);
        loader.abort();
      }
    }

    let maxRetry,
      timeout,
      retryDelay,
      maxRetryDelay;

    // apply different configs for retries depending on
    // context (manifest, level, audio/subs playlist)
    switch (context.type) {
    case ContextType.MANIFEST:
      maxRetry = config.manifestLoadingMaxRetry;
      timeout = config.manifestLoadingTimeOut;
      retryDelay = config.manifestLoadingRetryDelay;
      maxRetryDelay = config.manifestLoadingMaxRetryTimeout;
      break;
    case ContextType.LEVEL:
      // Disable internal loader retry logic, since we are managing retries in Level Controller
      maxRetry = 0;
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

    context.url = url;
    context.responseType = context.responseType || ''; // FIXME: (should not be necessary to do this)

    const loaderConfig = {
      timeout,
      maxRetry,
      retryDelay,
      maxRetryDelay
    };

    const loaderCallbacks = {
      onSuccess: this.loadsuccess.bind(this),
      onError: this.loaderror.bind(this),
      onTimeout: this.loadtimeout.bind(this)
    };

    logger.debug(`Calling internal loader delegate for URL: ${url}`);

    loader.load(context, loaderConfig, loaderCallbacks);

    return true;
  }

  loadsuccess (response, stats, context, networkDetails = null) {
    if (context.isSidxRequest) {
      this._handleSidxRequest(response, context);
      this._handlePlaylistLoaded(response, stats, context, networkDetails);
      return;
    }

    this.resetInternalLoader(context.type);

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

  loaderror (response, context, networkDetails = null) {
    this._handleNetworkError(context, networkDetails, false, response);
  }

  loadtimeout (stats, context, networkDetails = null) {
    this._handleNetworkError(context, networkDetails, true);
  }

  _handleMasterPlaylist (response, stats, context, networkDetails) {
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

  _handleTrackOrLevelPlaylist (response, stats, context, networkDetails) {
    const hls = this.hls;

    const { id, level, type } = context;

    const url = PlaylistLoader.getResponseUrl(response, context);

    const levelUrlId = Number.isFinite(id) ? id : 0;
    const levelId = Number.isFinite(level) ? level : levelUrlId;
    const levelType = PlaylistLoader.mapContextToLevelType(context);

    const levelDetails = M3U8Parser.parseLevelPlaylist(response.data, url, levelId, levelType, levelUrlId);

    // set stats on level structure
    levelDetails.tload = stats.tload;

    // We have done our first request (Manifest-type) and receive
    // not a master playlist but a chunk-list (track/level)
    // We fire the manifest-loaded event anyway with the parsed level-details
    // by creating a single-level structure for it.
    if (type === ContextType.MANIFEST) {
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
      this.load(sidxUrl, {
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

  _handleSidxRequest (response, context) {
    const sidxInfo = MP4Demuxer.parseSegmentIndex(new Uint8Array(response.data));
    // if provided fragment does not contain sidx, early return
    if (!sidxInfo) {
      return;
    }
    const sidxReferences = sidxInfo.references;
    const levelDetails = context.levelDetails;
    sidxReferences.forEach((segmentRef, index) => {
      const segRefInfo = segmentRef.info;
      const frag = levelDetails.fragments[index];

      if (frag.byteRange.length === 0) {
        frag.rawByteRange = String(1 + segRefInfo.end - segRefInfo.start) + '@' + String(segRefInfo.start);
      }
    });
    levelDetails.initSegment.rawByteRange = String(sidxInfo.moovEndOffset) + '@0';
  }

  _handleManifestParsingError (response, context, reason, networkDetails) {
    this.hls.trigger(Event.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_PARSING_ERROR,
      fatal: true,
      url: response.url,
      reason,
      networkDetails
    });
  }

  _handleNetworkError (context, networkDetails, timeout = false, response = null) {
    logger.info(`A network error occured while loading a ${context.type}-type playlist`);

    let details;
    let fatal;

    const loader = this.getInternalLoader(context);

    switch (context.type) {
    case ContextType.MANIFEST:
      details = (timeout ? ErrorDetails.MANIFEST_LOAD_TIMEOUT : ErrorDetails.MANIFEST_LOAD_ERROR);
      fatal = true;
      break;
    case ContextType.LEVEL:
      details = (timeout ? ErrorDetails.LEVEL_LOAD_TIMEOUT : ErrorDetails.LEVEL_LOAD_ERROR);
      fatal = false;
      break;
    case ContextType.AUDIO_TRACK:
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

    let errorData = {
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal,
      url: loader.url,
      loader,
      context,
      networkDetails
    };

    if (response) {
      errorData.response = response;
    }

    this.hls.trigger(Event.ERROR, errorData);
  }

  _handlePlaylistLoaded (response, stats, context, networkDetails) {
    const { type, level, id, levelDetails } = context;

    if (!levelDetails.targetduration) {
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
      case ContextType.AUDIO_TRACK:
        this.hls.trigger(Event.AUDIO_TRACK_LOADED, {
          details: levelDetails,
          id,
          stats,
          networkDetails
        });
        break;
      case ContextType.SUBTITLE_TRACK:
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
