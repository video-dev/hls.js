import { Events } from '../events';
import { Level } from '../types/level';
import { AttrList } from '../utils/attr-list';
import { addGroupId } from './level-controller';
import { ErrorActionFlags, NetworkErrorAction } from './error-controller';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import type { NetworkComponentAPI } from '../types/component-api';
import type {
  ErrorData,
  ManifestLoadedData,
  ManifestParsedData,
} from '../types/events';
import type { RetryConfig } from '../config';
import type {
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
} from '../types/loader';
import type { LevelParsed } from '../types/level';
import type { MediaAttributes, MediaPlaylist } from '../types/media-playlist';

export type SteeringManifest = {
  VERSION: 1;
  TTL: number;
  'RELOAD-URI'?: string;
  'PATHWAY-PRIORITY': string[];
  'PATHWAY-CLONES'?: PathwayClone[];
};

type PathwayClone = {
  'BASE-ID': string;
  ID: string;
  'URI-REPLACEMENT': UriReplacement;
};

type UriReplacement = {
  HOST?: string;
  PARAMS?: { [queryParameter: string]: string };
  'PER-VARIANT-URIS'?: { [stableVariantId: string]: string };
  'PER-RENDITION-URIS'?: { [stableRenditionId: string]: string };
};

const PATHWAY_PENALTY_DURATION_MS = 300000;

export default class ContentSteeringController implements NetworkComponentAPI {
  private readonly hls: Hls;
  private log: (msg: any) => void;
  private loader: Loader<LoaderContext> | null = null;
  private uri: string | null = null;
  private pathwayId: string = '.';
  private pathwayPriority: string[] | null = null;
  private timeToLoad: number = 300;
  private reloadTimer: number = -1;
  private updated: number = 0;
  private started: boolean = false;
  private enabled: boolean = true;
  private levels: Level[] | null = null;
  private audioTracks: MediaPlaylist[] | null = null;
  private subtitleTracks: MediaPlaylist[] | null = null;
  private penalizedPathways: { [pathwayId: string]: number } = {};

  constructor(hls: Hls) {
    this.hls = hls;
    this.log = logger.log.bind(logger, `[content-steering]:`);
    this.registerListeners();
  }

  private registerListeners() {
    const hls = this.hls;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners() {
    const hls = this.hls;
    if (!hls) {
      return;
    }
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  startLoad(): void {
    this.started = true;
    self.clearTimeout(this.reloadTimer);
    if (this.enabled && this.uri) {
      if (this.updated) {
        const ttl = Math.max(
          this.timeToLoad * 1000 - (performance.now() - this.updated),
          0
        );
        this.scheduleRefresh(this.uri, ttl);
      } else {
        this.loadSteeringManifest(this.uri);
      }
    }
  }

  stopLoad(): void {
    this.started = false;
    if (this.loader) {
      this.loader.destroy();
      this.loader = null;
    }
    self.clearTimeout(this.reloadTimer);
  }

  destroy() {
    this.unregisterListeners();
    this.stopLoad();
    // @ts-ignore
    this.hls = null;
    this.levels = this.audioTracks = this.subtitleTracks = null;
  }

  removeLevel(levelToRemove: Level) {
    const levels = this.levels;
    if (levels) {
      this.levels = levels.filter((level) => level !== levelToRemove);
    }
  }

  private onManifestLoading() {
    this.stopLoad();
    this.enabled = true;
    this.timeToLoad = 300;
    this.updated = 0;
    this.uri = null;
    this.pathwayId = '.';
    this.levels = this.audioTracks = this.subtitleTracks = null;
  }

  private onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    data: ManifestLoadedData
  ) {
    const { contentSteering } = data;
    if (contentSteering === null) {
      return;
    }
    this.pathwayId = contentSteering.pathwayId;
    this.uri = contentSteering.uri;
    if (this.started) {
      this.startLoad();
    }
  }

  private onManifestParsed(
    event: Events.MANIFEST_PARSED,
    data: ManifestParsedData
  ) {
    this.audioTracks = data.audioTracks;
    this.subtitleTracks = data.subtitleTracks;
  }

  private onError(event: Events.ERROR, data: ErrorData) {
    const { errorAction } = data;
    if (
      errorAction?.action === NetworkErrorAction.SendAlternateToPenaltyBox &&
      errorAction.flags === ErrorActionFlags.MoveAllAlternatesMatchingHost
    ) {
      let pathwayPriority = this.pathwayPriority;
      const pathwayId = this.pathwayId;
      if (!this.penalizedPathways[pathwayId]) {
        this.penalizedPathways[pathwayId] = performance.now();
      }
      if (!pathwayPriority && this.levels) {
        // If PATHWAY-PRIORITY was not provided, list pathways for error handling
        pathwayPriority = this.levels.reduce((pathways, level) => {
          if (pathways.indexOf(level.pathwayId) === -1) {
            pathways.push(level.pathwayId);
          }
          return pathways;
        }, [] as string[]);
      }
      if (pathwayPriority && pathwayPriority.length > 1) {
        this.updatePathwayPriority(pathwayPriority);
        errorAction.resolved = this.pathwayId !== pathwayId;
      }
    }
  }

  public filterParsedLevels(levels: Level[]): Level[] {
    // Filter levels to only include those that are in the initial pathway
    this.levels = levels;
    let pathwayLevels = this.getLevelsForPathway(this.pathwayId);
    if (pathwayLevels.length === 0) {
      const pathwayId = levels[0].pathwayId;
      this.log(
        `No levels found in Pathway ${this.pathwayId}. Setting initial Pathway to "${pathwayId}"`
      );
      pathwayLevels = this.getLevelsForPathway(pathwayId);
      this.pathwayId = pathwayId;
    }
    if (pathwayLevels.length !== levels.length) {
      this.log(
        `Found ${pathwayLevels.length}/${levels.length} levels in Pathway "${this.pathwayId}"`
      );
      return pathwayLevels;
    }
    return levels;
  }

  private getLevelsForPathway(pathwayId: string): Level[] {
    if (this.levels === null) {
      return [];
    }
    return this.levels.filter((level) => pathwayId === level.pathwayId);
  }

  private updatePathwayPriority(pathwayPriority: string[]) {
    this.pathwayPriority = pathwayPriority;
    let levels: Level[] | undefined;

    // Evaluate if we should remove the pathway from the penalized list
    const penalizedPathways = this.penalizedPathways;
    const now = performance.now();
    Object.keys(penalizedPathways).forEach((pathwayId) => {
      if (now - penalizedPathways[pathwayId] > PATHWAY_PENALTY_DURATION_MS) {
        delete penalizedPathways[pathwayId];
      }
    });
    for (let i = 0; i < pathwayPriority.length; i++) {
      const pathwayId = pathwayPriority[i];
      if (penalizedPathways[pathwayId]) {
        continue;
      }
      if (pathwayId === this.pathwayId) {
        return;
      }
      const selectedIndex = this.hls.nextLoadLevel;
      const selectedLevel: Level = this.hls.levels[selectedIndex];
      levels = this.getLevelsForPathway(pathwayId);
      if (levels.length > 0) {
        this.log(`Setting Pathway to "${pathwayId}"`);
        this.pathwayId = pathwayId;
        this.hls.trigger(Events.LEVELS_UPDATED, { levels });
        // Set LevelController's level to trigger LEVEL_SWITCHING which loads playlist if needed
        const levelAfterChange = this.hls.levels[selectedIndex];
        if (selectedLevel && levelAfterChange && this.levels) {
          if (
            levelAfterChange.attrs['STABLE-VARIANT-ID'] !==
              selectedLevel.attrs['STABLE-VARIANT-ID'] &&
            levelAfterChange.bitrate !== selectedLevel.bitrate
          ) {
            this.log(
              `Unstable Pathways change from bitrate ${selectedLevel.bitrate} to ${levelAfterChange.bitrate}`
            );
          }
          this.hls.nextLoadLevel = selectedIndex;
        }
        break;
      }
    }
  }

  private clonePathways(pathwayClones: PathwayClone[]) {
    const levels = this.levels;
    if (!levels) {
      return;
    }
    const audioGroupCloneMap: Record<string, string> = {};
    const subtitleGroupCloneMap: Record<string, string> = {};
    pathwayClones.forEach((pathwayClone) => {
      const {
        ID: cloneId,
        'BASE-ID': baseId,
        'URI-REPLACEMENT': uriReplacement,
      } = pathwayClone;
      if (levels.some((level) => level.pathwayId === cloneId)) {
        return;
      }
      const clonedVariants = this.getLevelsForPathway(baseId).map(
        (baseLevel) => {
          const levelParsed: LevelParsed = Object.assign({}, baseLevel as any);
          levelParsed.details = undefined;
          levelParsed.url = performUriReplacement(
            baseLevel.uri,
            baseLevel.attrs['STABLE-VARIANT-ID'],
            'PER-VARIANT-URIS',
            uriReplacement
          );
          const attributes = new AttrList(baseLevel.attrs);
          attributes['PATHWAY-ID'] = cloneId;
          const clonedAudioGroupId: string | undefined =
            attributes.AUDIO && `${attributes.AUDIO}_clone_${cloneId}`;
          const clonedSubtitleGroupId: string | undefined =
            attributes.SUBTITLES && `${attributes.SUBTITLES}_clone_${cloneId}`;
          if (clonedAudioGroupId) {
            audioGroupCloneMap[attributes.AUDIO] = clonedAudioGroupId;
            attributes.AUDIO = clonedAudioGroupId;
          }
          if (clonedSubtitleGroupId) {
            subtitleGroupCloneMap[attributes.SUBTITLES] = clonedSubtitleGroupId;
            attributes.SUBTITLES = clonedSubtitleGroupId;
          }
          levelParsed.attrs = attributes;
          const clonedLevel = new Level(levelParsed);
          addGroupId(clonedLevel, 'audio', clonedAudioGroupId);
          addGroupId(clonedLevel, 'text', clonedSubtitleGroupId);
          return clonedLevel;
        }
      );
      levels.push(...clonedVariants);
      cloneRenditionGroups(
        this.audioTracks,
        audioGroupCloneMap,
        uriReplacement,
        cloneId
      );
      cloneRenditionGroups(
        this.subtitleTracks,
        subtitleGroupCloneMap,
        uriReplacement,
        cloneId
      );
    });
  }

  private loadSteeringManifest(uri: string) {
    const config = this.hls.config;
    const Loader = config.loader;
    if (this.loader) {
      this.loader.destroy();
    }
    this.loader = new Loader(config) as Loader<LoaderContext>;

    let url: URL;
    try {
      url = new self.URL(uri);
    } catch (error) {
      this.enabled = false;
      this.log(`Failed to parse Steering Manifest URI: ${uri}`);
      return;
    }
    if (url.protocol !== 'data:') {
      const throughput =
        (this.hls.bandwidthEstimate || config.abrEwmaDefaultEstimate) | 0;
      url.searchParams.set('_HLS_pathway', this.pathwayId);
      url.searchParams.set('_HLS_throughput', '' + throughput);
    }
    const context: LoaderContext = {
      responseType: 'json',
      url: url.href,
    };

    const loadPolicy = config.steeringManifestLoadPolicy.default;
    const legacyRetryCompatibility: RetryConfig | Record<string, void> =
      loadPolicy.errorRetry || loadPolicy.timeoutRetry || {};
    const loaderConfig: LoaderConfiguration = {
      loadPolicy,
      timeout: loadPolicy.maxLoadTimeMs,
      maxRetry: legacyRetryCompatibility.maxNumRetry || 0,
      retryDelay: legacyRetryCompatibility.retryDelayMs || 0,
      maxRetryDelay: legacyRetryCompatibility.maxRetryDelayMs || 0,
    };

    const callbacks: LoaderCallbacks<LoaderContext> = {
      onSuccess: (
        response: LoaderResponse,
        stats: LoaderStats,
        context: LoaderContext,
        networkDetails: any
      ) => {
        this.log(`Loaded steering manifest: "${url}"`);
        const steeringData = response.data as SteeringManifest;
        if (steeringData.VERSION !== 1) {
          this.log(`Steering VERSION ${steeringData.VERSION} not supported!`);
          return;
        }
        this.updated = performance.now();
        this.timeToLoad = steeringData.TTL;
        const {
          'RELOAD-URI': reloadUri,
          'PATHWAY-CLONES': pathwayClones,
          'PATHWAY-PRIORITY': pathwayPriority,
        } = steeringData;
        if (reloadUri) {
          try {
            this.uri = new self.URL(reloadUri, url).href;
          } catch (error) {
            this.enabled = false;
            this.log(
              `Failed to parse Steering Manifest RELOAD-URI: ${reloadUri}`
            );
            return;
          }
        }
        this.scheduleRefresh(this.uri || context.url);
        if (pathwayClones) {
          this.clonePathways(pathwayClones);
        }
        if (pathwayPriority) {
          this.updatePathwayPriority(pathwayPriority);
        }
      },

      onError: (
        error: { code: number; text: string },
        context: LoaderContext,
        networkDetails: any,
        stats: LoaderStats
      ) => {
        this.log(
          `Error loading steering manifest: ${error.code} ${error.text} (${context.url})`
        );
        this.stopLoad();
        if (error.code === 410) {
          this.enabled = false;
          this.log(`Steering manifest ${context.url} no longer available`);
          return;
        }
        let ttl = this.timeToLoad * 1000;
        if (error.code === 429) {
          const loader = this.loader;
          if (typeof loader?.getResponseHeader === 'function') {
            const retryAfter = loader.getResponseHeader('Retry-After');
            if (retryAfter) {
              ttl = parseFloat(retryAfter) * 1000;
            }
          }
          this.log(`Steering manifest ${context.url} rate limited`);
          return;
        }
        this.scheduleRefresh(this.uri || context.url, ttl);
      },

      onTimeout: (
        stats: LoaderStats,
        context: LoaderContext,
        networkDetails: any
      ) => {
        this.log(`Timeout loading steering manifest (${context.url})`);
        this.scheduleRefresh(this.uri || context.url);
      },
    };

    this.log(`Requesting steering manifest: ${url}`);
    this.loader.load(context, loaderConfig, callbacks);
  }

  private scheduleRefresh(uri: string, ttlMs: number = this.timeToLoad * 1000) {
    self.clearTimeout(this.reloadTimer);
    this.reloadTimer = self.setTimeout(() => {
      this.loadSteeringManifest(uri);
    }, ttlMs);
  }
}

function cloneRenditionGroups(
  tracks: MediaPlaylist[] | null,
  groupCloneMap: Record<string, string>,
  uriReplacement: UriReplacement,
  cloneId: string
) {
  if (!tracks) {
    return;
  }
  Object.keys(groupCloneMap).forEach((audioGroupId) => {
    const clonedTracks = tracks
      .filter((track) => track.groupId === audioGroupId)
      .map((track) => {
        const clonedTrack = Object.assign({}, track);
        clonedTrack.details = undefined;
        clonedTrack.attrs = new AttrList(clonedTrack.attrs) as MediaAttributes;
        clonedTrack.url = clonedTrack.attrs.URI = performUriReplacement(
          track.url,
          track.attrs['STABLE-RENDITION-ID'],
          'PER-RENDITION-URIS',
          uriReplacement
        );
        clonedTrack.groupId = clonedTrack.attrs['GROUP-ID'] =
          groupCloneMap[audioGroupId];
        clonedTrack.attrs['PATHWAY-ID'] = cloneId;
        return clonedTrack;
      });
    tracks.push(...clonedTracks);
  });
}

function performUriReplacement(
  uri: string,
  stableId: string | undefined,
  perOptionKey: 'PER-VARIANT-URIS' | 'PER-RENDITION-URIS',
  uriReplacement: UriReplacement
): string {
  const {
    HOST: host,
    PARAMS: params,
    [perOptionKey]: perOptionUris,
  } = uriReplacement;
  let perVariantUri;
  if (stableId) {
    perVariantUri = perOptionUris?.[stableId];
    if (perVariantUri) {
      uri = perVariantUri;
    }
  }
  const url = new self.URL(uri);
  if (host && !perVariantUri) {
    url.host = host;
  }
  if (params) {
    Object.keys(params)
      .sort()
      .forEach((key) => {
        if (key) {
          url.searchParams.set(key, params[key]);
        }
      });
  }
  return url.href;
}
