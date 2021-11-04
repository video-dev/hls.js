import type { Fragment } from '../loader/fragment';
import type { Part } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type { HlsUrlParameters } from './level';

export interface LoaderContext {
  // target URL
  url: string;
  // loader response type (arraybuffer or default response type for playlist)
  responseType: string;
  // headers
  headers?: Record<string, string>;
  // start byte range offset
  rangeStart?: number;
  // end byte range offset
  rangeEnd?: number;
  // true if onProgress should report partial chunk of loaded content
  progressData?: boolean;
}

export interface FragmentLoaderContext extends LoaderContext {
  frag: Fragment;
  part: Part | null;
}

export interface LoaderConfiguration {
  // Max number of load retries
  maxRetry: number;
  // Timeout after which `onTimeOut` callback will be triggered
  // (if loading is still not finished after that delay)
  timeout: number;
  // Delay between an I/O error and following connection retry (ms).
  // This to avoid spamming the server
  retryDelay: number;
  // max connection retry delay (ms)
  maxRetryDelay: number;
  // When streaming progressively, this is the minimum chunk size required to emit a PROGRESS event
  highWaterMark: number;
}

export interface LoaderResponse {
  url: string;
  data: string | ArrayBuffer;
}

export interface LoaderStats {
  aborted: boolean;
  loaded: number;
  retry: number;
  total: number;
  chunkCount: number;
  bwEstimate: number;
  loading: HlsProgressivePerformanceTiming;
  parsing: HlsPerformanceTiming;
  buffering: HlsProgressivePerformanceTiming;
}

export interface HlsPerformanceTiming {
  start: number;
  end: number;
}

export interface HlsChunkPerformanceTiming extends HlsPerformanceTiming {
  executeStart: number;
  executeEnd: number;
}

export interface HlsProgressivePerformanceTiming extends HlsPerformanceTiming {
  first: number;
}

export type LoaderOnSuccess<T extends LoaderContext> = (
  response: LoaderResponse,
  stats: LoaderStats,
  context: T,
  networkDetails: any
) => void;

export type LoaderOnProgress<T extends LoaderContext> = (
  stats: LoaderStats,
  context: T,
  data: string | ArrayBuffer,
  networkDetails: any
) => void;

export type LoaderOnError<T extends LoaderContext> = (
  error: {
    // error status code
    code: number;
    // error description
    text: string;
  },
  context: T,
  networkDetails: any
) => void;

export type LoaderOnTimeout<T extends LoaderContext> = (
  stats: LoaderStats,
  context: T,
  networkDetails: any
) => void;

export type LoaderOnAbort<T extends LoaderContext> = (
  stats: LoaderStats,
  context: T,
  networkDetails: any
) => void;

export interface LoaderCallbacks<T extends LoaderContext> {
  onSuccess: LoaderOnSuccess<T>;
  onError: LoaderOnError<T>;
  onTimeout: LoaderOnTimeout<T>;
  onAbort?: LoaderOnAbort<T>;
  onProgress?: LoaderOnProgress<T>;
}

export interface Loader<T extends LoaderContext> {
  destroy(): void;
  abort(): void;
  load(
    context: LoaderContext,
    config: LoaderConfiguration,
    callbacks: LoaderCallbacks<T>
  ): void;
  /**
   * `getCacheAge()` is called by hls.js to get the duration that a given object
   * has been sitting in a cache proxy when playing live.  If implemented,
   * this should return a value in seconds.
   *
   * For HTTP based loaders, this should return the contents of the "age" header.
   *
   * @returns time object being lodaded
   */
  getCacheAge?: () => number | null;
  context: T;
  stats: LoaderStats;
}

export enum PlaylistContextType {
  MANIFEST = 'manifest',
  LEVEL = 'level',
  AUDIO_TRACK = 'audioTrack',
  SUBTITLE_TRACK = 'subtitleTrack',
}

export enum PlaylistLevelType {
  MAIN = 'main',
  AUDIO = 'audio',
  SUBTITLE = 'subtitle',
}

export interface PlaylistLoaderContext extends LoaderContext {
  loader?: Loader<PlaylistLoaderContext>;

  type: PlaylistContextType;
  // the level index to load
  level: number | null;
  // level or track id from LevelLoadingData / TrackLoadingData
  id: number | null;
  // track group id
  groupId: string | null;
  // defines if the loader is handling a sidx request for the playlist
  isSidxRequest?: boolean;
  // internal representation of a parsed m3u8 level playlist
  levelDetails?: LevelDetails;
  // Blocking playlist request delivery directives (or null id none were added to playlist url
  deliveryDirectives: HlsUrlParameters | null;
}
