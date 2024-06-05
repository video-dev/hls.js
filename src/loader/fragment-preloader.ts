import FragmentLoader from './fragment-loader';
import { Fragment, Part } from './fragment';

import {
  FragLoadedData,
  LevelLoadedData,
  PartsLoadedData,
  TrackLoadedData,
} from '../types/events';
import { HlsConfig } from '../hls';
import { logger } from '../utils/logger';

export const enum FragRequestState {
  IDLE,
  LOADING,
}

type FragPreloadRequest = {
  frag: Fragment;
  part: Part | undefined;
  loadPromise: Promise<FragLoadedData>;
};

type FragPreloaderStorage = {
  request: FragPreloadRequest | undefined;
  state: FragRequestState;
};

export default class FragmentPreloader extends FragmentLoader {
  private storage: FragPreloaderStorage = {
    request: undefined,
    state: FragRequestState.IDLE,
  };
  protected log: (msg: any) => void;

  constructor(config: HlsConfig, logPrefix: string) {
    super(config);
    this.log = logger.log.bind(logger, `${logPrefix}>preloader:`);
  }

  private getStateString() {
    switch (this.storage.state) {
      case FragRequestState.IDLE:
        return 'IDLE   ';
      case FragRequestState.LOADING:
        return 'LOADING';
    }
  }

  public has(frag: Fragment, part: Part | undefined): boolean {
    const { request } = this.storage;
    return (
      request !== undefined &&
      request.frag.sn === frag.sn &&
      request.part?.index === part?.index
    );
  }

  public get loading(): boolean {
    const { request, state } = this.storage;
    return request !== undefined && state !== FragRequestState.IDLE;
  }

  public cache(frag: Fragment, part: Part | undefined): void {
    if (this.has(frag, part)) {
      return;
    } else {
      this.abort();
    }

    this.log(
      `[${this.getStateString()}] create request for [${frag.type}] ${
        frag.sn
      }:${part?.index}`,
    );

    const loadPromise =
      part !== undefined
        ? this.loadPart(frag, part, noop)
        : this.load(frag, noop);

    const request = {
      frag,
      part,
      loadPromise,
    };

    this.storage = {
      request: request,
      state: FragRequestState.LOADING,
    };
  }

  public getCachedRequest(
    frag: Fragment,
    part: Part | undefined,
  ): Promise<FragLoadedData | PartsLoadedData> | undefined {
    const request = this.storage.request;

    if (!request) {
      return undefined;
    }

    const cacheHit = this.has(frag, part);

    this.log(
      `[${this.getStateString()}] check cache for [${frag.type}] ${
        frag.sn
      }:${part?.index ?? ''} / have: ${request.frag.sn}:${request.part?.index ?? ''} hit=${cacheHit}`,
    );
    if (cacheHit) {
      return request.loadPromise.then((data) => {
        mergeFragData(frag, part, data);
        this.reset();
        return data;
      });
    } else if (this.loading) {
      const { frag: preloadFrag, part: preloadPart } = request;
      const haveOldSn = preloadFrag.sn < frag.sn;
      const haveOldPart =
        preloadPart !== undefined &&
        part !== undefined &&
        !haveOldSn &&
        preloadPart.index < part.index;

      if (haveOldSn || haveOldPart) {
        this.reset();
      }
    }

    return undefined;
  }

  public revalidate(data: LevelLoadedData | TrackLoadedData) {
    const partList = data.details.partList ?? [];
    if (partList.length === 0) {
      this.abort();
      return;
    }
  }

  public get state() {
    return this.storage.state;
  }

  public get frag() {
    if (this.storage.request) {
      return this.storage.request.frag;
    }
    return undefined;
  }

  public reset() {
    this.storage = {
      request: undefined,
      state: FragRequestState.IDLE,
    };
  }

  abort(): void {
    super.abort();
    this.reset();
  }

  destroy(): void {
    this.reset();
    super.destroy();
  }
}

function noop() {}

function mergeFragData(
  frag: Fragment,
  part: Part | undefined,
  data: FragLoadedData,
) {
  const loadedFrag = data.frag;
  const loadedPart = data.part;

  frag.isPreload = true;
  if (frag.stats.loaded === 0) {
    frag.stats = loadedFrag.stats;
  } else {
    const fragStats = frag.stats;
    const loadStats = loadedFrag.stats;
    fragStats.loading.end = loadStats.loading.end;
  }

  if (part && loadedPart) {
    part.isPreload = true;
    part.stats = loadedPart.stats;
  }
}
