import { HlsPerformanceTiming, HlsProgressivePerformanceTiming, LoaderStats } from '../types/loader';

export default class LoadStats implements LoaderStats {
  aborted: boolean = false;
  loaded: number = 0;
  retry: number = 0;
  total: number = 0;
  chunkCount: number = 0;
  bwEstimate: number = 0;
  loading: HlsProgressivePerformanceTiming = { start: 0, first: 0, end: 0 };
  parsing: HlsPerformanceTiming = { start: 0, end: 0 };
  buffering: HlsProgressivePerformanceTiming = { start: 0, first: 0, end: 0 };
}

export function reset (stats: LoaderStats) {
  stats.loading = { start: 0, first: 0, end: 0 };
  stats.parsing = { start: 0, end: 0 };
  stats.buffering = { start: 0, first: 0, end: 0 };
  stats.loaded = 0;
  stats.aborted = false;
  stats.retry = 0;
  stats.chunkCount = 0;
}
