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
import { ErrorDetails, ErrorTypes } from '../errors';
import { logger } from '../utils/logger';
import { parseSegmentIndex } from '../utils/mp4-tools';
import M3U8Parser from './m3u8-parser';
import type { LevelParsed } from '../types/level';
import type {
  Loader,
  LoaderConfiguration,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
  PlaylistLoaderContext,
} from '../types/loader';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import { LevelDetails } from './level-details';
import type Hls from '../hls';
import { AttrList } from '../utils/attr-list';
import type {
  ErrorData,
  LevelLoadingData,
  ManifestLoadingData,
  TrackLoadingData,
} from '../types/events';

function mapContextToLevelType(
  context: PlaylistLoaderContext
): PlaylistLevelType {
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

function getResponseUrl(
  response: LoaderResponse,
  context: PlaylistLoaderContext
): string {
  let url = response.url;
  // responseURL not supported on some browsers (it is used to detect URL redirection)
  // data-uri mode also not supported (but no need to detect redirection)
  if (url === undefined || url.indexOf('data:') === 0) {
    // fallback to initial URL
    url = context.url;
  }
  return url;
}

class PlaylistLoader {
  private readonly hls: Hls;
  private readonly loaders: {
    [key: string]: Loader<LoaderContext>;
  } = Object.create(null);

  constructor(hls: Hls) {
    this.hls = hls;
    this.registerListeners();
  }

  private registerListeners() {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.AUDIO_TRACK_LOADING, this.onAudioTrackLoading, this);
    hls.on(Events.SUBTITLE_TRACK_LOADING, this.onSubtitleTrackLoading, this);
  }

  private unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.AUDIO_TRACK_LOADING, this.onAudioTrackLoading, this);
    hls.off(Events.SUBTITLE_TRACK_LOADING, this.onSubtitleTrackLoading, this);
  }

  /**
   * Returns defaults or configured loader-type overloads (pLoader and loader config params)
   */
  private createInternalLoader(
    context: PlaylistLoaderContext
  ): Loader<LoaderContext> {
    const config = this.hls.config;
    const PLoader = config.pLoader;
    const Loader = config.loader;
    const InternalLoader = PLoader || Loader;

    const loader = new InternalLoader(config) as Loader<PlaylistLoaderContext>;

    context.loader = loader;
    this.loaders[context.type] = loader;

    return loader;
  }

  private getInternalLoader(
    context: PlaylistLoaderContext
  ): Loader<LoaderContext> {
    return this.loaders[context.type];
  }

  private resetInternalLoader(contextType): void {
    if (this.loaders[contextType]) {
      delete this.loaders[contextType];
    }
  }

  /**
   * Call `destroy` on all internal loader instances mapped (one per context type)
   */
  private destroyInternalLoaders(): void {
    for (const contextType in this.loaders) {
      const loader = this.loaders[contextType];
      if (loader) {
        loader.destroy();
      }

      this.resetInternalLoader(contextType);
    }
  }

  public destroy(): void {
    this.unregisterListeners();
    this.destroyInternalLoaders();
  }

  private onManifestLoading(
    event: Events.MANIFEST_LOADING,
    data: ManifestLoadingData
  ) {
    const { url } = data;
    this.load({
      id: null,
      groupId: null,
      level: 0,
      responseType: 'text',
      type: PlaylistContextType.MANIFEST,
      url,
      deliveryDirectives: null,
    });
  }

  private onLevelLoading(event: Events.LEVEL_LOADING, data: LevelLoadingData) {
    const { id, level, url, deliveryDirectives } = data;
    this.load({
      id,
      groupId: null,
      level,
      responseType: 'text',
      type: PlaylistContextType.LEVEL,
      url,
      deliveryDirectives,
    });
  }

  private onAudioTrackLoading(
    event: Events.AUDIO_TRACK_LOADING,
    data: TrackLoadingData
  ) {
    const { id, groupId, url, deliveryDirectives } = data;
    this.load({
      id,
      groupId,
      level: null,
      responseType: 'text',
      type: PlaylistContextType.AUDIO_TRACK,
      url,
      deliveryDirectives,
    });
  }

  private onSubtitleTrackLoading(
    event: Events.SUBTITLE_TRACK_LOADING,
    data: TrackLoadingData
  ) {
    const { id, groupId, url, deliveryDirectives } = data;
    this.load({
      id,
      groupId,
      level: null,
      responseType: 'text',
      type: PlaylistContextType.SUBTITLE_TRACK,
      url,
      deliveryDirectives,
    });
  }

  private load(context: PlaylistLoaderContext): void {
    const config = this.hls.config;

    // logger.debug(`[playlist-loader]: Loading playlist of type ${context.type}, level: ${context.level}, id: ${context.id}`);

    // Check if a loader for this context already exists
    let loader = this.getInternalLoader(context);
    if (loader) {
      const loaderContext = loader.context;
      if (loaderContext && loaderContext.url === context.url) {
        // same URL can't overlap
        logger.trace('[playlist-loader]: playlist request ongoing');
        return;
      }
      logger.log(
        `[playlist-loader]: aborting previous loader for type: ${context.type}`
      );
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
      case PlaylistContextType.AUDIO_TRACK:
      case PlaylistContextType.SUBTITLE_TRACK:
        // Manage retries in Level/Track Controller
        maxRetry = 0;
        timeout = config.levelLoadingTimeOut;
        break;
      default:
        maxRetry = config.levelLoadingMaxRetry;
        timeout = config.levelLoadingTimeOut;
        retryDelay = config.levelLoadingRetryDelay;
        maxRetryDelay = config.levelLoadingMaxRetryTimeout;
        break;
    }

    loader = this.createInternalLoader(context);

    // Override level/track timeout for LL-HLS requests
    // (the default of 10000ms is counter productive to blocking playlist reload requests)
    if (context.deliveryDirectives?.part) {
      let levelDetails: LevelDetails | undefined;
      if (
        context.type === PlaylistContextType.LEVEL &&
        context.level !== null
      ) {
        levelDetails = this.hls.levels[context.level].details;
      } else if (
        context.type === PlaylistContextType.AUDIO_TRACK &&
        context.id !== null
      ) {
        levelDetails = this.hls.audioTracks[context.id].details;
      } else if (
        context.type === PlaylistContextType.SUBTITLE_TRACK &&
        context.id !== null
      ) {
        levelDetails = this.hls.subtitleTracks[context.id].details;
      }
      if (levelDetails) {
        const partTarget = levelDetails.partTarget;
        const targetDuration = levelDetails.targetduration;
        if (partTarget && targetDuration) {
          timeout = Math.min(
            Math.max(partTarget * 3, targetDuration * 0.8) * 1000,
            timeout
          );
        }
      }
    }

    const loaderConfig: LoaderConfiguration = {
      timeout,
      maxRetry,
      retryDelay,
      maxRetryDelay,
      highWaterMark: 0,
    };

    const loaderCallbacks = {
      onSuccess: this.loadsuccess.bind(this),
      onError: this.loaderror.bind(this),
      onTimeout: this.loadtimeout.bind(this),
    };

    // logger.debug(`[playlist-loader]: Calling internal loader delegate for URL: ${context.url}`);

    loader.load(context, loaderConfig, loaderCallbacks);
  }

  private loadsuccess(
    response: LoaderResponse,
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any = null
  ): void {
    if (context.isSidxRequest) {
      this.handleSidxRequest(response, context);
      this.handlePlaylistLoaded(response, stats, context, networkDetails);
      return;
    }

    this.resetInternalLoader(context.type);

    const string = response.data as string;

    // Validate if it is an M3U8 at all
    if (string.indexOf('#EXTM3U') !== 0) {
      this.handleManifestParsingError(
        response,
        context,
        'no EXTM3U delimiter',
        networkDetails
      );
      return;
    }

    stats.parsing.start = performance.now();
    // Check if chunk-list or master. handle empty chunk list case (first EXTINF not signaled, but TARGETDURATION present)
    if (
      string.indexOf('#EXTINF:') > 0 ||
      string.indexOf('#EXT-X-TARGETDURATION:') > 0
    ) {
      this.handleTrackOrLevelPlaylist(response, stats, context, networkDetails);
    } else {
      this.handleMasterPlaylist(response, stats, context, networkDetails);
    }
  }

  private loaderror(
    response: LoaderResponse,
    context: PlaylistLoaderContext,
    networkDetails: any = null
  ): void {
    this.handleNetworkError(context, networkDetails, false, response);
  }

  private loadtimeout(
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any = null
  ): void {
    this.handleNetworkError(context, networkDetails, true);
  }

  private handleMasterPlaylist(
    response: LoaderResponse,
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any
  ): void {
    const hls = this.hls;
    const string = response.data as string;

    const url = getResponseUrl(response, context);

    const { levels, sessionData } = M3U8Parser.parseMasterPlaylist(string, url);
    if (!levels.length) {
      this.handleManifestParsingError(
        response,
        context,
        'no level found in manifest',
        networkDetails
      );
      return;
    }

    // multi level playlist, parse level info
    const audioGroups = levels.map((level: LevelParsed) => ({
      id: level.attrs.AUDIO,
      audioCodec: level.audioCodec,
    }));

    const subtitleGroups = levels.map((level: LevelParsed) => ({
      id: level.attrs.SUBTITLES,
      textCodec: level.textCodec,
    }));

    const audioTracks = M3U8Parser.parseMasterPlaylistMedia(
      string,
      url,
      'AUDIO',
      audioGroups
    );
    const subtitles = M3U8Parser.parseMasterPlaylistMedia(
      string,
      url,
      'SUBTITLES',
      subtitleGroups
    );
    const captions = M3U8Parser.parseMasterPlaylistMedia(
      string,
      url,
      'CLOSED-CAPTIONS'
    );

    if (audioTracks.length) {
      // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
      const embeddedAudioFound: boolean = audioTracks.some(
        (audioTrack) => !audioTrack.url
      );

      // if no embedded audio track defined, but audio codec signaled in quality level,
      // we need to signal this main audio track this could happen with playlists with
      // alt audio rendition in which quality levels (main)
      // contains both audio+video. but with mixed audio track not signaled
      if (
        !embeddedAudioFound &&
        levels[0].audioCodec &&
        !levels[0].attrs.AUDIO
      ) {
        logger.log(
          '[playlist-loader]: audio codec signaled in quality level, but no embedded audio track signaled, create one'
        );
        audioTracks.unshift({
          type: 'main',
          name: 'main',
          default: false,
          autoselect: false,
          forced: false,
          id: -1,
          attrs: new AttrList({}),
          bitrate: 0,
          url: '',
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
      sessionData,
    });
  }

  private handleTrackOrLevelPlaylist(
    response: LoaderResponse,
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any
  ): void {
    const hls = this.hls;
    const { id, level, type } = context;

    const url = getResponseUrl(response, context);
    const levelUrlId = Number.isFinite(id as number) ? id : 0;
    const levelId = Number.isFinite(level as number) ? level : levelUrlId;
    const levelType = mapContextToLevelType(context);
    const levelDetails: LevelDetails = M3U8Parser.parseLevelPlaylist(
      response.data as string,
      url,
      levelId!,
      levelType,
      levelUrlId!
    );

    if (!levelDetails.fragments.length) {
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.LEVEL_EMPTY_ERROR,
        fatal: false,
        url: url,
        reason: 'no fragments found in level',
        level: typeof context.level === 'number' ? context.level : undefined,
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
        url,
      };

      hls.trigger(Events.MANIFEST_LOADED, {
        levels: [singleLevel],
        audioTracks: [],
        url,
        stats,
        networkDetails,
        sessionData: null,
      });
    }

    // save parsing time
    stats.parsing.end = performance.now();

    // in case we need SIDX ranges
    // return early after calling load for
    // the SIDX box.
    if (levelDetails.needSidxRanges) {
      const sidxUrl = levelDetails.fragments[0].initSegment?.url as string;
      this.load({
        url: sidxUrl,
        isSidxRequest: true,
        type,
        level,
        levelDetails,
        id,
        groupId: null,
        rangeStart: 0,
        rangeEnd: 2048,
        responseType: 'arraybuffer',
        deliveryDirectives: null,
      });
      return;
    }

    // extend the context with the new levelDetails property
    context.levelDetails = levelDetails;

    this.handlePlaylistLoaded(response, stats, context, networkDetails);
  }

  private handleSidxRequest(
    response: LoaderResponse,
    context: PlaylistLoaderContext
  ): void {
    const sidxInfo = parseSegmentIndex(
      new Uint8Array(response.data as ArrayBuffer)
    );
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
        frag.setByteRange(
          String(1 + segRefInfo.end - segRefInfo.start) +
            '@' +
            String(segRefInfo.start)
        );
      }
      if (frag.initSegment) {
        frag.initSegment.setByteRange(String(sidxInfo.moovEndOffset) + '@0');
      }
    });
  }

  private handleManifestParsingError(
    response: LoaderResponse,
    context: PlaylistLoaderContext,
    reason: string,
    networkDetails: any
  ): void {
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_PARSING_ERROR,
      fatal: context.type === PlaylistContextType.MANIFEST,
      url: response.url,
      reason,
      response,
      context,
      networkDetails,
    });
  }

  private handleNetworkError(
    context: PlaylistLoaderContext,
    networkDetails: any,
    timeout = false,
    response?: LoaderResponse
  ): void {
    logger.warn(
      `[playlist-loader]: A network ${
        timeout ? 'timeout' : 'error'
      } occurred while loading ${context.type} level: ${context.level} id: ${
        context.id
      } group-id: "${context.groupId}"`
    );
    let details = ErrorDetails.UNKNOWN;
    let fatal = false;

    const loader = this.getInternalLoader(context);

    switch (context.type) {
      case PlaylistContextType.MANIFEST:
        details = timeout
          ? ErrorDetails.MANIFEST_LOAD_TIMEOUT
          : ErrorDetails.MANIFEST_LOAD_ERROR;
        fatal = true;
        break;
      case PlaylistContextType.LEVEL:
        details = timeout
          ? ErrorDetails.LEVEL_LOAD_TIMEOUT
          : ErrorDetails.LEVEL_LOAD_ERROR;
        fatal = false;
        break;
      case PlaylistContextType.AUDIO_TRACK:
        details = timeout
          ? ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT
          : ErrorDetails.AUDIO_TRACK_LOAD_ERROR;
        fatal = false;
        break;
      case PlaylistContextType.SUBTITLE_TRACK:
        details = timeout
          ? ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT
          : ErrorDetails.SUBTITLE_LOAD_ERROR;
        fatal = false;
        break;
    }

    if (loader) {
      this.resetInternalLoader(context.type);
    }

    const errorData: ErrorData = {
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal,
      url: context.url,
      loader,
      context,
      networkDetails,
    };

    if (response) {
      errorData.response = response;
    }

    this.hls.trigger(Events.ERROR, errorData);
  }

  private handlePlaylistLoaded(
    response: LoaderResponse,
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any
  ): void {
    const {
      type,
      level,
      id,
      groupId,
      loader,
      levelDetails,
      deliveryDirectives,
    } = context;

    if (!levelDetails?.targetduration) {
      this.handleManifestParsingError(
        response,
        context,
        'invalid target duration',
        networkDetails
      );
      return;
    }
    if (!loader) {
      return;
    }

    if (levelDetails.live) {
      if (loader.getCacheAge) {
        levelDetails.ageHeader = loader.getCacheAge() || 0;
      }
      if (!loader.getCacheAge || isNaN(levelDetails.ageHeader)) {
        levelDetails.ageHeader = 0;
      }
    }

    switch (type) {
      case PlaylistContextType.MANIFEST:
      case PlaylistContextType.LEVEL:
        this.hls.trigger(Events.LEVEL_LOADED, {
          details: levelDetails,
          level: level || 0,
          id: id || 0,
          stats,
          networkDetails,
          deliveryDirectives,
        });
        break;
      case PlaylistContextType.AUDIO_TRACK:
        this.hls.trigger(Events.AUDIO_TRACK_LOADED, {
          details: levelDetails,
          id: id || 0,
          groupId: groupId || '',
          stats,
          networkDetails,
          deliveryDirectives,
        });
        break;
      case PlaylistContextType.SUBTITLE_TRACK:
        this.hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
          details: levelDetails,
          id: id || 0,
          groupId: groupId || '',
          stats,
          networkDetails,
          deliveryDirectives,
        });
        break;
    }
  }
}

export default PlaylistLoader;
