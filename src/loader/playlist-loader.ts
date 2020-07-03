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

import { Events } from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import { parseSegmentIndex } from '../utils/mp4-tools';
import M3U8Parser from './m3u8-parser';
import { getProgramDateTimeAtEndOfLastEncodedFragment } from '../controller/level-helper';
import { LevelParsed } from '../types/level';
import {
  Loader,
  LoaderContext,
  LoaderResponse,
  LoaderStats, PlaylistContextType,
  PlaylistLevelType,
  PlaylistLoaderContext
} from '../types/loader';
import { ManifestLoadingData, LevelLoadingData, AudioTrackLoadingData, SubtitleTrackLoadingData } from '../types/events';
import LevelDetails from './level-details';
import Fragment from './fragment';
import Hls from '../hls';
import AttrList from '../utils/attr-list';

const { performance } = self;

/**
 * @param {PlaylistContextType} type
 * @returns {boolean}
 */
function canHaveQualityLevels (type: PlaylistContextType): boolean {
  return (type !== PlaylistContextType.AUDIO_TRACK &&
    type !== PlaylistContextType.SUBTITLE_TRACK);
}

/**
 * Map context.type to LevelType
 * @param {{type: PlaylistContextType}} context
 * @returns {LevelType}
 */
function mapContextToLevelType (context: PlaylistLoaderContext): PlaylistLevelType {
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

function getResponseUrl (response: LoaderResponse, context: PlaylistLoaderContext): string {
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
class PlaylistLoader {
  private readonly hls: Hls;
  private readonly loaders: {
    [key: string]: Loader<LoaderContext>
  } = Object.create(null)

  /**
   * @constructs
   * @param {Hls} hls
   */
  constructor (hls: Hls) {
    this.hls = hls;
    this._registerListeners();
  }

  private _registerListeners () {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.AUDIO_TRACK_LOADING, this.onAudioTrackLoading, this);
    hls.on(Events.SUBTITLE_TRACK_LOADING, this.onSubtitleTrackLoading, this);
  }

  private _unregisterListeners () {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.AUDIO_TRACK_LOADING, this.onAudioTrackLoading, this);
    hls.off(Events.SUBTITLE_TRACK_LOADING, this.onSubtitleTrackLoading, this);
  }

  // TODO: export as enum once fragment-tracker and stream-controller typed
  static get LevelType () {
    return PlaylistLevelType;
  }

  /**
   * Returns defaults or configured loader-type overloads (pLoader and loader config params)
   */
  private createInternalLoader (context: PlaylistLoaderContext): Loader<LoaderContext> {
    const config = this.hls.config;
    const PLoader = config.pLoader;
    const Loader = config.loader;
    const InternalLoader = PLoader || Loader;

    const loader = new InternalLoader(config);

    context.loader = loader;
    this.loaders[context.type] = loader;

    return loader;
  }

  private getInternalLoader (context: PlaylistLoaderContext): Loader<LoaderContext> {
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
    for (const contextType in this.loaders) {
      const loader = this.loaders[contextType];
      if (loader) {
        loader.destroy();
      }

      this.resetInternalLoader(contextType);
    }
  }

  public destroy (): void {
    this._unregisterListeners();
    this.destroyInternalLoaders();
  }

  private onManifestLoading (event: Events.MANIFEST_LOADING, data: ManifestLoadingData) {
    const { url } = data;
    this.load({
      id: null,
      level: 0,
      responseType: 'text',
      type: PlaylistContextType.MANIFEST,
      url
    });
  }

  private onLevelLoading (event: Events.LEVEL_LOADING, data: LevelLoadingData) {
    const { id, level, url } = data;
    this.load({
      id,
      level,
      responseType: 'text',
      type: PlaylistContextType.LEVEL,
      url
    });
  }

  private onAudioTrackLoading (event: Events.AUDIO_TRACK_LOADING, data: AudioTrackLoadingData) {
    const { id, url } = data;
    this.load({
      id,
      level: null,
      responseType: 'text',
      type: PlaylistContextType.AUDIO_TRACK,
      url
    });
  }

  private onSubtitleTrackLoading (event: Events.SUBTITLE_TRACK_LOADING, data: SubtitleTrackLoadingData) {
    const { id, url } = data;
    this.load({
      id,
      level: null,
      responseType: 'text',
      type: PlaylistContextType.SUBTITLE_TRACK,
      url
    });
  }

  private load (context: PlaylistLoaderContext): void {
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
    case PlaylistContextType.MANIFEST:
      maxRetry = config.manifestLoadingMaxRetry;
      timeout = config.manifestLoadingTimeOut;
      retryDelay = config.manifestLoadingRetryDelay;
      maxRetryDelay = config.manifestLoadingMaxRetryTimeout;
      break;
    case PlaylistContextType.LEVEL:
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
      maxRetryDelay,
      highWaterMark: 0
    };

    const loaderCallbacks = {
      onSuccess: this.loadsuccess.bind(this),
      onError: this.loaderror.bind(this),
      onTimeout: this.loadtimeout.bind(this)
    };

    logger.debug(`[playlist-loader]: Calling internal loader delegate for URL: ${context.url}`);

    loader.load(context, loaderConfig, loaderCallbacks);
  }

  private loadsuccess (response: LoaderResponse, stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: any = null): void {
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

  private loaderror (response: LoaderResponse, context: PlaylistLoaderContext, networkDetails: any = null): void {
    this._handleNetworkError(context, networkDetails, false, response);
  }

  private loadtimeout (stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: any = null): void {
    this._handleNetworkError(context, networkDetails, true, null);
  }

  private _handleMasterPlaylist (response: LoaderResponse, stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: any): void {
    const hls = this.hls;
    const string = response.data as string;

    const url = getResponseUrl(response, context);

    const { levels, sessionData } = M3U8Parser.parseMasterPlaylist(string, url);
    if (!levels.length) {
      this._handleManifestParsingError(response, context, 'no level found in manifest', networkDetails);
      return;
    }

    // multi level playlist, parse level info
    const audioGroups = levels.map((level: LevelParsed) => ({
      id: level.attrs.AUDIO,
      audioCodec: level.audioCodec
    }));

    const subtitleGroups = levels.map((level: LevelParsed) => ({
      id: level.attrs.SUBTITLES,
      textCodec: level.textCodec
    }));

    const audioTracks = M3U8Parser.parseMasterPlaylistMedia(string, url, 'AUDIO', audioGroups);
    const subtitles = M3U8Parser.parseMasterPlaylistMedia(string, url, 'SUBTITLES', subtitleGroups);
    const captions = M3U8Parser.parseMasterPlaylistMedia(string, url, 'CLOSED-CAPTIONS');

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
          name: 'main',
          default: false,
          autoselect: false,
          forced: false,
          id: -1,
          attrs: new AttrList({}),
          bitrate: 0,
          url: ''
        });
      }
    }

    hls.trigger(Events.MANIFEST_LOADED, {
      levels,
      audioTracks,
      subtitles,
      captions,
      url,
      stats,
      networkDetails,
      sessionData
    });
  }

  private _handleTrackOrLevelPlaylist (response: LoaderResponse, stats: LoaderStats, context: PlaylistLoaderContext, networkDetails: any): void {
    const hls = this.hls;
    const { id, level, type, loader } = context;
    const url = getResponseUrl(response, context);

    const levelUrlId = Number.isFinite(id as number) ? id : 0;
    const levelId = Number.isFinite(level as number) ? level : levelUrlId;
    const levelType = mapContextToLevelType(context);

    const levelDetails: LevelDetails = M3U8Parser.parseLevelPlaylist(response.data as string, url, levelId!, levelType, levelUrlId!);

    // set stats on level structure
    const toDate = (value) => value ? new Date(value) : null;

    // Last-Modified or PDT after last encoded segment provides an approximation of the last manifest write
    const mtime = toDate((loader as Loader<LoaderContext>).getResponseHeader('Last-Modified'));
    const encoded = toDate(getProgramDateTimeAtEndOfLastEncodedFragment(levelDetails));

    levelDetails.tload = stats.loading.end;
    levelDetails.lastModified = Math.max(+(mtime as Date), +(encoded as Date));

    if (!levelDetails.fragments.length) {
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.LEVEL_EMPTY_ERROR,
        fatal: false,
        url: url,
        reason: 'no fragments found in level',
        level: typeof context.level === 'number' ? context.level : undefined
      });
      return;
    }

    // We have done our first request (Manifest-type) and receive
    // not a master playlist but a chunk-list (track/level)
    // We fire the manifest-loaded event anyway with the parsed level-details
    // by creating a single-level structure for it.
    if (type === PlaylistContextType.MANIFEST) {
      const singleLevel: LevelParsed = {
        attrs: new AttrList({}),
        bitrate: 0,
        details: levelDetails,
        name: '',
        url
      };

      hls.trigger(Events.MANIFEST_LOADED, {
        levels: [singleLevel],
        audioTracks: [],
        url,
        stats,
        networkDetails,
        sessionData: null
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

  private _handleSidxRequest (response: LoaderResponse, context: PlaylistLoaderContext): void {
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
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_PARSING_ERROR,
      fatal: context.type === PlaylistContextType.MANIFEST,
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
      this.resetInternalLoader(context.type);
    }

    const errorData = {
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

    this.hls.trigger(Events.ERROR, errorData);
  }

  private _handlePlaylistLoaded (response: LoaderResponse, stats: LoaderStats, context, networkDetails): void {
    const { type, level, id, levelDetails } = context;

    if (!levelDetails.targetduration) {
      this._handleManifestParsingError(response, context, 'invalid target duration', networkDetails);
      return;
    }

    const canHaveLevels = canHaveQualityLevels(context.type);
    if (canHaveLevels) {
      this.hls.trigger(Events.LEVEL_LOADED, {
        details: levelDetails,
        level: level || 0,
        id: id || 0,
        stats,
        networkDetails
      });
    } else {
      switch (type) {
      case PlaylistContextType.AUDIO_TRACK:
        this.hls.trigger(Events.AUDIO_TRACK_LOADED, {
          details: levelDetails,
          id,
          stats,
          networkDetails
        });
        break;
      case PlaylistContextType.SUBTITLE_TRACK:
        this.hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
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
