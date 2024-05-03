import { LoadStats } from '../../src/loader/load-stats';
import type { HlsConfig } from '../../src/config';
import type {
  FragmentLoaderContext,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
} from '../../src/types/loader';

export class MockXhr implements Loader<LoaderContext> {
  context!: LoaderContext;
  stats: LoadStats;
  callbacks: LoaderCallbacks<FragmentLoaderContext> | null = null;
  config: LoaderConfiguration | null = null;

  constructor(confg: HlsConfig) {
    this.stats = new LoadStats();
  }

  load(
    context: LoaderContext,
    config: LoaderConfiguration,
    callbacks: LoaderCallbacks<LoaderContext>,
  ) {
    this.stats.loading.start = self.performance.now();
    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
  }

  abort() {
    if (this.callbacks?.onAbort) {
      this.callbacks.onAbort(this.stats, this.context as any, null);
    }
  }

  destroy(): void {
    this.callbacks = null;
    this.config = null;
  }
}
