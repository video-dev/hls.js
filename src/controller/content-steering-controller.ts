import { Events } from '../events';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import type { NetworkComponentAPI } from '../types/component-api';
import type { ManifestLoadedData, ManifestParsedData } from '../types/events';
import type {
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
} from '../types/loader';
import type { Level } from '../types/level';

type SteeringManifest = {
  VERSION: 1;
  TTL: number;
  'RELOAD-URI'?: string;
  'PATHWAY-PRIORITY': string[];
  'PATHWAY-CLONES'?: PathwayClone[];
};

type PathwayClone = {
  'BASE-ID': string;
  ID: string;
  'URI-REPLACEMENT': {
    HOST?: string;
    PARAMS?: { [queryParameter: string]: string };
    'PER-VARIANT-URIS'?: { [stableVariantId: string]: string };
    'PER-RENDITION-URIS'?: { [stableRenditionId: string]: string };
  };
};

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
  private enabled: boolean = true;
  private levels: Level[] | null = null;

  constructor(hls: Hls) {
    this.hls = hls;
    this.log = logger.log.bind(logger, `[content-steering]:`);
    this.registerListeners();
  }

  private registerListeners() {
    const hls = this.hls;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
  }

  private unregisterListeners() {
    const hls = this.hls;
    if (!hls) {
      return;
    }
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
  }

  startLoad(): void {
    self.clearTimeout(this.reloadTimer);
    if (this.enabled && this.uri) {
      if (this.updated) {
        const ttl = Math.max(
          this.timeToLoad * 1000 - (Date.now() - this.updated),
          0
        );
        this.scheduleRefresh(this.uri, ttl);
      } else {
        this.loadSteeringManifest(this.uri);
      }
    }
  }

  stopLoad(): void {
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
    this.hls = this.config = this.levels = null;
  }

  removeLevel(levelToRemove: Level) {
    const levels = this.levels;
    if (levels) {
      this.levels = levels.filter((level) => level === levelToRemove);
    }
  }

  private onManifestLoading() {
    this.stopLoad();
    this.enabled = true;
    this.timeToLoad = 300;
    this.updated = 0;
    this.uri = null;
    this.pathwayId = '.';
    this.levels = null;
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
    this.startLoad();
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
    for (let i = 0; i < pathwayPriority.length; i++) {
      const pathwayId = pathwayPriority[i];
      if (pathwayId === this.pathwayId) {
        return;
      }
      levels = this.getLevelsForPathway(pathwayId);
      if (levels.length > 0) {
        this.log(`Setting Pathway to "${pathwayId}"`);
        this.pathwayId = pathwayId;
        this.hls.trigger(Events.LEVELS_UPDATED, { levels });
        break;
      }
    }
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

    const loaderConfig: LoaderConfiguration = {
      timeout: config.levelLoadingTimeOut,
      maxRetry: 0,
      retryDelay: config.levelLoadingRetryDelay,
      maxRetryDelay: config.levelLoadingMaxRetryTimeout,
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
        this.updated = Date.now();
        this.timeToLoad = steeringData.TTL;
        const reloadUri = steeringData['RELOAD-URI'];
        if (reloadUri) {
          try {
            this.uri = new URL(reloadUri, url).href;
          } catch (error) {
            this.enabled = false;
            this.log(
              `Failed to parse Steering Manifest RELOAD-URI: ${reloadUri}`
            );
            return;
          }
        }

        this.scheduleRefresh(this.uri || context.url);

        const pathwayClones = steeringData['PATHWAY-CLONES'];
        if (pathwayClones) {
        }

        const pathwayPriority = steeringData['PATHWAY-PRIORITY'];
        if (pathwayPriority) {
          this.updatePathwayPriority(pathwayPriority);
        }
      },

      onError: (
        error: { code: number; text: string },
        context: LoaderContext,
        networkDetails: any
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
