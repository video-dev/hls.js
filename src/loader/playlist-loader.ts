/**
 * PlaylistLoader - delegate for media manifest/playlist loading tasks. Takes care of parsing media to internal data-models.
 *
 * Once loaded, dispatches events with parsed data-models of manifest/levels/audio/subtitle tracks.
 *
 * Uses loader(s) set in config to do actual internal loading of resource tasks.
 */

import { Events } from '../events';
import { ErrorDetails, ErrorTypes } from '../errors';
import M3U8Parser from './m3u8-parser';
import type { LevelParsed, VariableMap } from '../types/level';
import type {
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
  PlaylistLoaderContext,
} from '../types/loader';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import { LevelDetails } from './level-details';
import { AttrList } from '../utils/attr-list';
import type Hls from '../hls';
import type {
  ErrorData,
  LevelLoadingData,
  ManifestLoadingData,
  TrackLoadingData,
} from '../types/events';
import type { NetworkComponentAPI } from '../types/component-api';
import type { MediaAttributes } from '../types/media-playlist';
import type { LoaderConfig, RetryConfig } from '../config';

function mapContextToLevelType(
  context: PlaylistLoaderContext,
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
  context: PlaylistLoaderContext,
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

class PlaylistLoader implements NetworkComponentAPI {
  private readonly hls: Hls;
  private readonly loaders: {
    [key: string]: Loader<LoaderContext>;
  } = Object.create(null);
  private variableList: VariableMap | null = null;

  constructor(hls: Hls) {
    this.hls = hls;
    this.registerListeners();
  }

  public startLoad(startPosition: number): void {}

  public stopLoad(): void {
    this.destroyInternalLoaders();
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
    context: PlaylistLoaderContext,
  ): Loader<LoaderContext> {
    const config = this.hls.config;
    const PLoader = config.pLoader;
    const Loader = config.loader;
    const InternalLoader = PLoader || Loader;
    const loader = new InternalLoader(config) as Loader<PlaylistLoaderContext>;

    this.loaders[context.type] = loader;
    return loader;
  }

  private getInternalLoader(
    context: PlaylistLoaderContext,
  ): Loader<LoaderContext> | undefined {
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
    this.variableList = null;
    this.unregisterListeners();
    this.destroyInternalLoaders();
  }

  private onManifestLoading(
    event: Events.MANIFEST_LOADING,
    data: ManifestLoadingData,
  ) {
    const { url } = data;
    this.variableList = null;
    this.load({
      id: null,
      level: 0,
      responseType: 'text',
      type: PlaylistContextType.MANIFEST,
      url,
      deliveryDirectives: null,
    });
  }

  private onLevelLoading(event: Events.LEVEL_LOADING, data: LevelLoadingData) {
    const { id, level, pathwayId, url, deliveryDirectives } = data;
    this.load({
      id,
      level,
      pathwayId,
      responseType: 'text',
      type: PlaylistContextType.LEVEL,
      url,
      deliveryDirectives,
    });
  }

  private onAudioTrackLoading(
    event: Events.AUDIO_TRACK_LOADING,
    data: TrackLoadingData,
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
    data: TrackLoadingData,
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
      const loaderContext = loader.context as PlaylistLoaderContext;
      if (
        loaderContext &&
        loaderContext.url === context.url &&
        loaderContext.level === context.level
      ) {
        // same URL can't overlap
        this.hls.logger.trace('[playlist-loader]: playlist request ongoing');
        return;
      }
      this.hls.logger.log(
        `[playlist-loader]: aborting previous loader for type: ${context.type}`,
      );
      loader.abort();
    }

    // apply different configs for retries depending on
    // context (manifest, level, audio/subs playlist)
    let loadPolicy: LoaderConfig;
    if (context.type === PlaylistContextType.MANIFEST) {
      loadPolicy = config.manifestLoadPolicy.default;
    } else {
      loadPolicy = Object.assign({}, config.playlistLoadPolicy.default, {
        timeoutRetry: null,
        errorRetry: null,
      });
    }
    loader = this.createInternalLoader(context);

    // Override level/track timeout for LL-HLS requests
    // (the default of 10000ms is counter productive to blocking playlist reload requests)
    if (Number.isFinite(context.deliveryDirectives?.part)) {
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
          const maxLowLatencyPlaylistRefresh =
            Math.max(partTarget * 3, targetDuration * 0.8) * 1000;
          loadPolicy = Object.assign({}, loadPolicy, {
            maxTimeToFirstByteMs: Math.min(
              maxLowLatencyPlaylistRefresh,
              loadPolicy.maxTimeToFirstByteMs,
            ),
            maxLoadTimeMs: Math.min(
              maxLowLatencyPlaylistRefresh,
              loadPolicy.maxTimeToFirstByteMs,
            ),
          });
        }
      }
    }

    const legacyRetryCompatibility: RetryConfig | Record<string, void> =
      loadPolicy.errorRetry || loadPolicy.timeoutRetry || {};
    const loaderConfig: LoaderConfiguration = {
      loadPolicy,
      timeout: loadPolicy.maxLoadTimeMs,
      maxRetry: legacyRetryCompatibility.maxNumRetry || 0,
      retryDelay: legacyRetryCompatibility.retryDelayMs || 0,
      maxRetryDelay: legacyRetryCompatibility.maxRetryDelayMs || 0,
    };

    const loaderCallbacks: LoaderCallbacks<PlaylistLoaderContext> = {
      onSuccess: (response, stats, context, networkDetails) => {
        const loader = this.getInternalLoader(context) as
          | Loader<PlaylistLoaderContext>
          | undefined;
        this.resetInternalLoader(context.type);

        const string = response.data as string;

        // Validate if it is an M3U8 at all
        if (string.indexOf('#EXTM3U') !== 0) {
          this.handleManifestParsingError(
            response,
            context,
            new Error('no EXTM3U delimiter'),
            networkDetails || null,
            stats,
          );
          return;
        }

        stats.parsing.start = performance.now();
        if (M3U8Parser.isMediaPlaylist(string)) {
          this.handleTrackOrLevelPlaylist(
            response,
            stats,
            context,
            networkDetails || null,
            loader,
          );
        } else {
          this.handleMasterPlaylist(response, stats, context, networkDetails);
        }
      },
      onError: (response, context, networkDetails, stats) => {
        this.handleNetworkError(
          context,
          networkDetails,
          false,
          response,
          stats,
        );
      },
      onTimeout: (stats, context, networkDetails) => {
        this.handleNetworkError(
          context,
          networkDetails,
          true,
          undefined,
          stats,
        );
      },
    };

    // logger.debug(`[playlist-loader]: Calling internal loader delegate for URL: ${context.url}`);

    loader.load(context, loaderConfig, loaderCallbacks);
  }

  private handleMasterPlaylist(
    response: LoaderResponse,
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any,
  ): void {
    const hls = this.hls;
    const string = response.data as string;

    const url = getResponseUrl(response, context);

    const parsedResult = M3U8Parser.parseMasterPlaylist(string, url);

    if (parsedResult.playlistParsingError) {
      this.handleManifestParsingError(
        response,
        context,
        parsedResult.playlistParsingError,
        networkDetails,
        stats,
      );
      return;
    }

    const {
      contentSteering,
      levels,
      sessionData,
      sessionKeys,
      startTimeOffset,
      variableList,
    } = parsedResult;

    this.variableList = variableList;

    const {
      AUDIO: audioTracks = [],
      SUBTITLES: subtitles,
      'CLOSED-CAPTIONS': captions,
    } = M3U8Parser.parseMasterPlaylistMedia(string, url, parsedResult);

    if (audioTracks.length) {
      // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
      const embeddedAudioFound: boolean = audioTracks.some(
        (audioTrack) => !audioTrack.url,
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
        this.hls.logger.log(
          '[playlist-loader]: audio codec signaled in quality level, but no embedded audio track signaled, create one',
        );
        audioTracks.unshift({
          type: 'main',
          name: 'main',
          groupId: 'main',
          default: false,
          autoselect: false,
          forced: false,
          id: -1,
          attrs: new AttrList({}) as MediaAttributes,
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
      contentSteering,
      url,
      stats,
      networkDetails,
      sessionData,
      sessionKeys,
      startTimeOffset,
      variableList,
    });
  }

  private handleTrackOrLevelPlaylist(
    response: LoaderResponse,
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any,
    loader: Loader<PlaylistLoaderContext> | undefined,
  ): void {
    const hls = this.hls;
    const { id, level, type } = context;

    const url = getResponseUrl(response, context);
    const levelId = Number.isFinite(level as number)
      ? (level as number)
      : Number.isFinite(id as number)
        ? (id as number)
        : 0;
    const levelType = mapContextToLevelType(context);
    const levelDetails: LevelDetails = M3U8Parser.parseLevelPlaylist(
      response.data as string,
      url,
      levelId,
      levelType,
      0,
      this.variableList,
    );

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
        sessionKeys: null,
        contentSteering: null,
        startTimeOffset: null,
        variableList: null,
      });
    }

    // save parsing time
    stats.parsing.end = performance.now();

    // extend the context with the new levelDetails property
    context.levelDetails = levelDetails;

    this.handlePlaylistLoaded(
      levelDetails,
      response,
      stats,
      context,
      networkDetails,
      loader,
    );
  }

  private handleManifestParsingError(
    response: LoaderResponse,
    context: PlaylistLoaderContext,
    error: Error,
    networkDetails: any,
    stats: LoaderStats,
  ): void {
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_PARSING_ERROR,
      fatal: context.type === PlaylistContextType.MANIFEST,
      url: response.url,
      err: error,
      error,
      reason: error.message,
      response,
      context,
      networkDetails,
      stats,
    });
  }

  private handleNetworkError(
    context: PlaylistLoaderContext,
    networkDetails: any,
    timeout = false,
    response: { code: number; text: string } | undefined,
    stats: LoaderStats,
  ): void {
    let message = `A network ${
      timeout
        ? 'timeout'
        : 'error' + (response ? ' (status ' + response.code + ')' : '')
    } occurred while loading ${context.type}`;
    if (context.type === PlaylistContextType.LEVEL) {
      message += `: ${context.level} id: ${context.id}`;
    } else if (
      context.type === PlaylistContextType.AUDIO_TRACK ||
      context.type === PlaylistContextType.SUBTITLE_TRACK
    ) {
      message += ` id: ${context.id} group-id: "${context.groupId}"`;
    }
    const error = new Error(message);
    this.hls.logger.warn(`[playlist-loader]: ${message}`);
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
      error,
      networkDetails,
      stats,
    };

    if (response) {
      const url = networkDetails?.url || context.url;
      errorData.response = { url, data: undefined as any, ...response };
    }

    this.hls.trigger(Events.ERROR, errorData);
  }

  private handlePlaylistLoaded(
    levelDetails: LevelDetails,
    response: LoaderResponse,
    stats: LoaderStats,
    context: PlaylistLoaderContext,
    networkDetails: any,
    loader: Loader<PlaylistLoaderContext> | undefined,
  ): void {
    const hls = this.hls;
    const { type, level, id, groupId, deliveryDirectives } = context;
    const url = getResponseUrl(response, context);
    const parent = mapContextToLevelType(context);
    const levelIndex =
      typeof context.level === 'number' && parent === PlaylistLevelType.MAIN
        ? (level as number)
        : undefined;
    if (!levelDetails.fragments.length) {
      const error = new Error('No Segments found in Playlist');
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.LEVEL_EMPTY_ERROR,
        fatal: false,
        url,
        error,
        reason: error.message,
        response,
        context,
        level: levelIndex,
        parent,
        networkDetails,
        stats,
      });
      return;
    }
    if (!levelDetails.targetduration) {
      levelDetails.playlistParsingError = new Error('Missing Target Duration');
    }
    const error = levelDetails.playlistParsingError;
    if (error) {
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.LEVEL_PARSING_ERROR,
        fatal: false,
        url,
        error,
        reason: error.message,
        response,
        context,
        level: levelIndex,
        parent,
        networkDetails,
        stats,
      });
      return;
    }

    if (levelDetails.live && loader) {
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
        hls.trigger(Events.LEVEL_LOADED, {
          details: levelDetails,
          level: levelIndex || 0,
          id: id || 0,
          stats,
          networkDetails,
          deliveryDirectives,
        });
        break;
      case PlaylistContextType.AUDIO_TRACK:
        hls.trigger(Events.AUDIO_TRACK_LOADED, {
          details: levelDetails,
          id: id || 0,
          groupId: groupId || '',
          stats,
          networkDetails,
          deliveryDirectives,
        });
        break;
      case PlaylistContextType.SUBTITLE_TRACK:
        hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
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
