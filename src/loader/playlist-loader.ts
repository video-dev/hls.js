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
import { parseSegmentIndex } from '../utils/mp4-tools';
import M3U8Parser from './m3u8-parser';
import { getProgramDateTimeAtEndOfLastEncodedFragment } from '../controller/level-helper';
import { LevelParsed } from '../types/level';
import { Loader, LoaderContext, LoaderResponse, LoaderStats } from '../types/loader';
import { ManifestLoadingData, LevelLoadingData, TrackLoadingData } from '../types/events';
import LevelDetails from './level-details';
import Fragment from './fragment';

const { performance } = window;

/**
 * `type` property values for this loaders' context object
 * @enum
 *
 */
enum ContextType {
  MANIFEST = 'manifest',
  LEVEL = 'level',
  AUDIO_TRACK = 'audioTrack',
  SUBTITLE_TRACK = 'subtitleTrack'
}

/**
 * @enum {string}
 */
// TODO: Need to type fragment-tracker, stream-controller
const LevelType = {
  MAIN: 'main',
  AUDIO: 'audio',
  SUBTITLE: 'subtitle'
};

interface ManifestLoaderContext extends LoaderContext {
  id: number | null,
  isSidxRequest?: boolean,
  level: number | null,
  levelDetails?: LevelDetails,
  loader?: Loader<LoaderContext>
  type: ContextType
}

/**
 * @param {ContextType} type
 * @returns {boolean}
 */
function canHaveQualityLevels (type: ContextType): boolean {
  return (type !== ContextType.AUDIO_TRACK &&
    type !== ContextType.SUBTITLE_TRACK);
}

/**
 * Map context.type to LevelType
 * @param {{type: ContextType}} context
 * @returns {LevelType}
 */
function mapContextToLevelType (context: ManifestLoaderContext): string {
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

function getResponseUrl (response: LoaderResponse, context: ManifestLoaderContext): string {
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
 * @constructor
 */
class PlaylistLoader extends EventHandler {
  private readonly loaders: { [key: string]: Loader<LoaderContext> };
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

    this.loaders = Object.create(null);
  }

  // TODO: export as enum once fragment-tracker and stream-controller typed
  static get LevelType () {
    return LevelType;
  }

  /**
   * Returns defaults or configured loader-type overloads (pLoader and loader config params)
   */
  private createInternalLoader (context: ManifestLoaderContext): Loader<LoaderContext> {
    const config = this.hls.config;
    const PLoader = config.pLoader;
    const Loader = config.loader;
    const InternalLoader = PLoader || Loader;

    const loader = new InternalLoader(config);

    context.loader = loader;
    this.loaders[context.type] = loader;

    return loader;
  }

  private getInternalLoader (context: ManifestLoaderContext): Loader<LoaderContext> {
    return this.loaders[context.type];
  }

  private resetInternalLoader (contextType): void {
    if (this.loaders[contextType]) {
      delete this.loaders[contextType];
    }
  }

  /**
   * Call `destroy` on all internal loader instances mapped (one per context type)
   */
  private destroyInternalLoaders (): void {
    for (let contextType in this.loaders) {
      let loader = this.loaders[contextType];
      if (loader) {
        loader.destroy();
      }

      this.resetInternalLoader(contextType);
    }
  }

  public destroy (): void {
    this.destroyInternalLoaders();

    super.destroy();
  }

  protected onManifestLoading (data: ManifestLoadingData): void {
    const { url } = data;
    this.load({
      id: null,
      level: 0,
      responseType: 'text',
      type: ContextType.MANIFEST,
      url
    });
  }

  protected onLevelLoading (data: LevelLoadingData): void {
    const { id, level, url } = data;
    this.load({
      id,
      level,
      responseType: 'text',
      type: ContextType.LEVEL,
      url
    });
  }

  protected onAudioTrackLoading (data: TrackLoadingData): void {
    const { id, url } = data;
    this.load({
      id,
      level: null,
      responseType: 'text',
      type: ContextType.AUDIO_TRACK,
      url,
    });
  }

  protected onSubtitleTrackLoading (data: TrackLoadingData): void {
    const { id, url } = data;
    this.load({
      id,
      level: null,
      responseType: 'text',
      type: ContextType.SUBTITLE_TRACK,
      url
    });
  }

  private load (context: ManifestLoaderContext): void {
    const config = this.hls.config;

    logger.debug(`[playlist-loader]: Loading playlist of type ${context.type}, level: ${context.level}, id: ${context.id}`);

    // Check if a loader for this context already exists
    let loader = this.getInternalLoader(context);
    if (loader) {
      const loaderContext = loader.context;
      if (loaderContext && loaderContext.url === context.url) { // same URL can't overlap
        logger.trace('[playlist-loader]: playlist request ongoing');
        return;
      }
      logger.warn(`[playlist-loader]: aborting previous loader for type: ${context.type}`);
      loader.abort();
    }

    let maxRetry;
    let timeout;
    let retryDelay;
    let maxRetryDelay;

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

    logger.debug(`[playlist-loader]: Calling internal loader delegate for URL: ${context.url}`);

    loader.load(context, loaderConfig, loaderCallbacks);
  }

  private loadsuccess (response: LoaderResponse, stats: LoaderStats, context: ManifestLoaderContext, networkDetails: any = null): void {
    if (context.isSidxRequest) {
      this._handleSidxRequest(response, context);
      this._handlePlaylistLoaded(response, stats, context, networkDetails);
      return;
    }

    this.resetInternalLoader(context.type);

    const string = response.data as string;

    // Validate if it is an M3U8 at all
    if (string.indexOf('#EXTM3U') !== 0) {
      this._handleManifestParsingError(response, context, 'no EXTM3U delimiter', networkDetails);
      return;
    }

    stats.parsing.start = performance.now();
    // Check if chunk-list or master. handle empty chunk list case (first EXTINF not signaled, but TARGETDURATION present)
    if (string.indexOf('#EXTINF:') > 0 || string.indexOf('#EXT-X-TARGETDURATION:') > 0) {
      this._handleTrackOrLevelPlaylist(response, stats, context, networkDetails);
    } else {
      this._handleMasterPlaylist(response, stats, context, networkDetails);
    }
  }

  private loaderror (response: LoaderResponse, context: ManifestLoaderContext, networkDetails: any = null): void {
    this._handleNetworkError(context, networkDetails, false, response);
  }

  private loadtimeout (stats: LoaderStats, context: ManifestLoaderContext, networkDetails: any = null): void {
    this._handleNetworkError(context, networkDetails, true, null);
  }

  private _handleMasterPlaylist (response: LoaderResponse, stats: LoaderStats, context: ManifestLoaderContext, networkDetails: any): void {
    const hls = this.hls;
    const string = response.data;

    const url = getResponseUrl(response, context);

    const levels: LevelParsed[] = M3U8Parser.parseMasterPlaylist(string, url);
    if (!levels.length) {
      this._handleManifestParsingError(response, context, 'no level found in manifest', networkDetails);
      return;
    }

    // multi level playlist, parse level info

    const audioGroups = levels.map((level: LevelParsed) => ({
      id: level.attrs.AUDIO,
      codec: level.audioCodec
    }));

    let audioTracks = M3U8Parser.parseMasterPlaylistMedia(string, url, 'AUDIO', audioGroups);
    let subtitles = M3U8Parser.parseMasterPlaylistMedia(string, url, 'SUBTITLES');
    let captions = M3U8Parser.parseMasterPlaylistMedia(string, url, 'CLOSED-CAPTIONS');

    if (audioTracks.length) {
      // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
      const embeddedAudioFound: boolean = audioTracks.some(audioTrack => !audioTrack.url);

      // if no embedded audio track defined, but audio codec signaled in quality level,
      // we need to signal this main audio track this could happen with playlists with
      // alt audio rendition in which quality levels (main)
      // contains both audio+video. but with mixed audio track not signaled
      if (!embeddedAudioFound && levels[0].audioCodec && !levels[0].attrs.AUDIO) {
        logger.log('[playlist-loader]: audio codec signaled in quality level, but no embedded audio track signaled, create one');
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
      captions,
      url,
      stats,
      networkDetails
    });
  }

  private _handleTrackOrLevelPlaylist (response: LoaderResponse, stats: LoaderStats, context: ManifestLoaderContext, networkDetails: any): void {
    const hls = this.hls;

    const { id, level, type, loader } = context;

    const url = getResponseUrl(response, context);

    const levelUrlId = Number.isFinite(id as number) ? id : 0;
    const levelId = Number.isFinite(level as number) ? level : levelUrlId;
    const levelType = mapContextToLevelType(context);

    const levelDetails: LevelDetails = M3U8Parser.parseLevelPlaylist(response.data, url, levelId, levelType, levelUrlId);

    // set stats on level structure
    const toDate = (value) => value ? new Date(value) : null;

    // Last-Modified or PDT after last encoded segment provides an approximation of the last manifest write
    const mtime = toDate((loader as Loader<LoaderContext>).getResponseHeader('Last-Modified'));
    const encoded = toDate(getProgramDateTimeAtEndOfLastEncodedFragment(levelDetails));

    levelDetails.tload = stats.loading.end;
    levelDetails.lastModified = Math.max(+(mtime as Date), +(encoded as Date));

    if (!levelDetails.fragments.length) {
      hls.trigger(Event.ERROR, {
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.LEVEL_EMPTY_ERROR,
        fatal: false,
        url: url,
        reason: 'no fragments found in level',
        level: context.level
      });
      return;
    }

    // We have done our first request (Manifest-type) and receive
    // not a master playlist but a chunk-list (track/level)
    // We fire the manifest-loaded event anyway with the parsed level-details
    // by creating a single-level structure for it.
    if (type === ContextType.MANIFEST) {
      const singleLevel: LevelParsed = {
        attrs: {},
        bitrate: 0,
        details: levelDetails,
        url
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
    stats.parsing.end = performance.now();

    // in case we need SIDX ranges
    // return early after calling load for
    // the SIDX box.
    if (levelDetails.needSidxRanges) {
      const sidxUrl = (levelDetails.initSegment as Fragment).url as string;
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

  private _handleSidxRequest (response: LoaderResponse, context: ManifestLoaderContext): void {
    const sidxInfo = parseSegmentIndex(new Uint8Array(response.data as SharedArrayBuffer));
    // if provided fragment does not contain sidx, early return
    if (!sidxInfo) {
      return;
    }
    const sidxReferences = sidxInfo.references;
    const levelDetails = context.levelDetails as LevelDetails;
    sidxReferences.forEach((segmentRef, index) => {
      const segRefInfo = segmentRef.info;
      const frag = levelDetails.fragments[index];

      if (frag.byteRange.length === 0) {
        frag.setByteRange(String(1 + segRefInfo.end - segRefInfo.start) + '@' + String(segRefInfo.start));
      }
    });
    (levelDetails.initSegment as Fragment).setByteRange(String(sidxInfo.moovEndOffset) + '@0');
  }

  private _handleManifestParsingError (response: LoaderResponse, context, reason, networkDetails): void {
    this.hls.trigger(Event.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_PARSING_ERROR,
      fatal: context.type === ContextType.MANIFEST,
      url: response.url,
      reason,
      response,
      context,
      networkDetails
    });
  }

  private _handleNetworkError (context, networkDetails, timeout = false, response: LoaderResponse | null = null): void {
    logger.info(`[playlist-loader]: A network error occurred while loading a ${context.type}-type playlist`);
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
      this.resetInternalLoader(context.type);
    }

    let errorData = {
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal,
      url: context.url,
      loader,
      response,
      context,
      networkDetails
    };

    if (response) {
      errorData.response = response;
    }

    this.hls.trigger(Event.ERROR, errorData);
  }

  private _handlePlaylistLoaded (response: LoaderResponse, stats: LoaderStats, context, networkDetails): void {
    const { type, level, id, levelDetails } = context;

    if (!levelDetails.targetduration) {
      this._handleManifestParsingError(response, context, 'invalid target duration', networkDetails);
      return;
    }

    const canHaveLevels = canHaveQualityLevels(context.type);
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
