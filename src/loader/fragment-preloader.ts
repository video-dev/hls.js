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

export const enum FragPreloadRequestState {
  IDLE,
  LOADING,
}

type FragPreloadRequest = {
  frag: Fragment;
  part: Part | null;
  loadPromise: Promise<FragLoadedData>;
};

type FragPreloadRequestInfo = {
  info: FragPreloadRequest | null;
  state: FragPreloadRequestState;
};

export default class FragmentPreloader extends FragmentLoader {
  private storage: FragPreloadRequestInfo = {
    info: null,
    state: FragPreloadRequestState.IDLE,
  };
  protected log: (msg: any) => void;

  constructor(config: HlsConfig, logPrefix: string) {
    super(config);
    this.log = logger.log.bind(logger, `${logPrefix}>preloader:`);
  }

  private getPreloadStateStr() {
    switch (this.storage.state) {
      case FragPreloadRequestState.IDLE:
        return 'IDLE';
      case FragPreloadRequestState.LOADING:
        return 'LOADING';
    }
  }

  public haveMatchingRequest(frag: Fragment, part: Part | null): boolean {
    const request = this.storage.info;
    return (
      request !== null &&
      request.frag.sn === frag.sn &&
      request.part?.index === part?.index
    );
  }

  public preload(frag: Fragment, part: Part | undefined): void {
    // We might have a stale request preloaded
    const { info, state } = this.storage;
    if (info && state !== FragPreloadRequestState.IDLE) {
      return;
    }

    this.log(
      `[${this.getPreloadStateStr()}] create request for [${frag.type}] ${
        frag.sn
      }:${part?.index}`,
    );

    const noop = () => {};
    const loadPromise =
      part !== undefined
        ? this.loadPart(frag, part, noop)
        : this.load(frag, noop);

    const request = {
      frag,
      part: part ?? null,
      loadPromise,
    };

    this.storage = {
      info: request,
      state: FragPreloadRequestState.LOADING,
    };
  }

  public getCachedRequest(
    frag: Fragment,
    part: Part | null,
  ): Promise<FragLoadedData | PartsLoadedData> | null {
    const request = this.storage.info;
    if (request) {
      this.log(
        `[${this.getPreloadStateStr()}] check cache for [${frag.type}] ${
          frag.sn
        }:${part?.index} / preloadInfo=${request?.frag?.sn}/${
          request?.part?.index
        }`,
      );
    }
    if (
      this.storage.state !== FragPreloadRequestState.IDLE &&
      request &&
      this.haveMatchingRequest(frag, part)
    ) {
      // Do we need to merge the preload frag into the frag/part?
      return request.loadPromise.then((data) => {
        mergeFragData(frag, part, data);
        this.reset();
        return data;
      });
    }

    if (request && this.storage.state !== FragPreloadRequestState.IDLE) {
      const { frag: preloadFrag, part: preloadPart } = request;
      const haveOldSn = preloadFrag.sn < frag.sn;
      const haveOldPart =
        preloadPart !== null &&
        part !== null &&
        !haveOldSn &&
        preloadPart.index < part.index;

      if (haveOldSn || haveOldPart) {
        this.reset();
      }
    }

    return null;
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
    if (this.storage.info) {
      return this.storage.info.frag;
    }
    return null;
  }

  public reset() {
    this.storage = {
      info: null,
      state: FragPreloadRequestState.IDLE,
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

function mergeFragData(
  frag: Fragment,
  part: Part | null,
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
