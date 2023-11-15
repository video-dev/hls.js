// eslint-disable-next-line import/no-duplicates
import type { Fragment } from '../loader/fragment';
// eslint-disable-next-line import/no-duplicates
import type { Part } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type {
  HdcpLevel,
  HlsUrlParameters,
  Level,
  LevelAttributes,
  LevelParsed,
  VariableMap,
} from './level';
import type { MediaPlaylist, MediaPlaylistType } from './media-playlist';
import type {
  Loader,
  LoaderContext,
  LoaderResponse,
  LoaderStats,
  PlaylistLevelType,
  PlaylistLoaderContext,
} from './loader';
import type { Track, TrackSet } from './track';
import type { SourceBufferName } from './buffer';
import type { ChunkMetadata } from './transmuxer';
import type { LoadStats } from '../loader/load-stats';
import type { ErrorDetails, ErrorTypes } from '../errors';
import type { MetadataSample, UserdataSample } from './demuxer';
import type { AttrList } from '../utils/attr-list';
import type { HlsListeners } from '../events';
import type { KeyLoaderInfo } from '../loader/key-loader';
import type { LevelKey } from '../loader/level-key';
import type { IErrorAction } from '../controller/error-controller';
import type { SteeringManifest } from '../controller/content-steering-controller';

export interface MediaAttachingData {
  media: HTMLMediaElement;
}

export interface MediaAttachedData {
  media: HTMLMediaElement;
  mediaSource?: MediaSource;
}

export interface BufferCodecsData {
  video?: Track;
  audio?: Track;
}

export interface BufferCreatedData {
  tracks: TrackSet;
}

export interface BufferAppendingData {
  type: SourceBufferName;
  frag: Fragment;
  part: Part | null;
  chunkMeta: ChunkMetadata;
  parent: PlaylistLevelType;
  data: Uint8Array;
}

export interface BufferAppendedData {
  type: SourceBufferName;
  frag: Fragment;
  part: Part | null;
  chunkMeta: ChunkMetadata;
  parent: PlaylistLevelType;
  timeRanges: Partial<Record<SourceBufferName, TimeRanges>>;
}

export interface BufferEOSData {
  type?: SourceBufferName;
}

export interface BufferFlushingData {
  startOffset: number;
  endOffset: number;
  endOffsetSubtitles?: number;
  type: SourceBufferName | null;
}

export interface BufferFlushedData {
  type: SourceBufferName;
}

export interface ManifestLoadingData {
  url: string;
}

export type ContentSteeringOptions = {
  uri: string;
  pathwayId: string;
};

export interface ManifestLoadedData {
  audioTracks: MediaPlaylist[];
  captions?: MediaPlaylist[];
  contentSteering: ContentSteeringOptions | null;
  levels: LevelParsed[];
  networkDetails: any;
  sessionData: Record<string, AttrList> | null;
  sessionKeys: LevelKey[] | null;
  startTimeOffset: number | null;
  stats: LoaderStats;
  subtitles?: MediaPlaylist[];
  url: string;
  variableList: VariableMap | null;
}

export interface ManifestParsedData {
  levels: Level[];
  audioTracks: MediaPlaylist[];
  subtitleTracks: MediaPlaylist[];
  sessionData: Record<string, AttrList> | null;
  sessionKeys: LevelKey[] | null;
  firstLevel: number;
  stats: LoaderStats;
  audio: boolean;
  video: boolean;
  altAudio: boolean;
}

export interface LevelSwitchingData {
  level: number;
  attrs: LevelAttributes;
  details: LevelDetails | undefined;
  bitrate: number;
  averageBitrate: number;
  maxBitrate: number;
  realBitrate: number;
  width: number;
  height: number;
  codecSet: string;
  audioCodec: string | undefined;
  videoCodec: string | undefined;
  audioGroups: (string | undefined)[] | undefined;
  subtitleGroups: (string | undefined)[] | undefined;
  loaded: { bytes: number; duration: number } | undefined;
  loadError: number;
  fragmentError: number;
  name: string | undefined;
  id: number;
  uri: string;
  // Deprecated (retained for backwards compatibility)
  url: string[];
  urlId: 0;
  audioGroupIds: (string | undefined)[] | undefined;
  textGroupIds: (string | undefined)[] | undefined;
}

export interface LevelSwitchedData {
  level: number;
}

export interface TrackLoadingData {
  id: number;
  groupId: string;
  url: string;
  deliveryDirectives: HlsUrlParameters | null;
}

export interface LevelLoadingData {
  id: number;
  level: number;
  pathwayId: string | undefined;
  url: string;
  deliveryDirectives: HlsUrlParameters | null;
}

export interface TrackLoadedData {
  details: LevelDetails;
  id: number;
  groupId: string;
  networkDetails: any;
  stats: LoaderStats;
  deliveryDirectives: HlsUrlParameters | null;
}

export interface LevelLoadedData {
  details: LevelDetails;
  id: number;
  level: number;
  networkDetails: any;
  stats: LoaderStats;
  deliveryDirectives: HlsUrlParameters | null;
}

export interface LevelUpdatedData {
  details: LevelDetails;
  level: number;
}

export interface LevelPTSUpdatedData {
  details: LevelDetails;
  level: Level;
  drift: number;
  type: string;
  frag: Fragment;
  start: number;
  end: number;
}

export interface AudioTrackSwitchingData extends MediaPlaylist {}

export interface AudioTrackSwitchedData extends MediaPlaylist {}

export interface AudioTrackLoadedData extends TrackLoadedData {}

export interface AudioTracksUpdatedData {
  audioTracks: MediaPlaylist[];
}

export interface SubtitleTracksUpdatedData {
  subtitleTracks: MediaPlaylist[];
}

export interface SubtitleTrackSwitchData {
  id: number;
  name?: string;
  groupId?: string;
  type?: MediaPlaylistType | 'main';
  url?: string;
}

export interface SubtitleTrackLoadedData extends TrackLoadedData {}

export interface TrackSwitchedData {
  id: number;
}

export interface SubtitleFragProcessed {
  success: boolean;
  frag: Fragment;
}

export interface FragChangedData {
  frag: Fragment;
}

export interface FPSDropData {
  currentDropped: number;
  currentDecoded: number;
  totalDroppedFrames: number;
}

export interface FPSDropLevelCappingData {
  droppedLevel: number;
  level: number;
}

export interface MaxAutoLevelUpdatedData {
  autoLevelCapping: number;
  levels: Level[] | null;
  maxAutoLevel: number;
  minAutoLevel: number;
  maxHdcpLevel: HdcpLevel;
}

export interface ErrorData {
  type: ErrorTypes;
  details: ErrorDetails;
  error: Error;
  fatal: boolean;
  errorAction?: IErrorAction;
  buffer?: number;
  bytes?: number;
  chunkMeta?: ChunkMetadata;
  context?: PlaylistLoaderContext;
  event?: keyof HlsListeners | 'demuxerWorker';
  frag?: Fragment;
  part?: Part | null;
  level?: number | undefined;
  levelRetry?: boolean;
  loader?: Loader<LoaderContext>;
  networkDetails?: any;
  stats?: LoaderStats;
  mimeType?: string;
  reason?: string;
  response?: LoaderResponse;
  url?: string;
  parent?: PlaylistLevelType;
  sourceBufferName?: SourceBufferName;
  /**
   * @deprecated Use ErrorData.error
   */
  err?: {
    // comes from transmuxer interface
    message: string;
  };
}

export interface SubtitleFragProcessedData {
  success: boolean;
  frag: Fragment;
  error?: Error;
}

export interface CuesParsedData {
  type: 'captions' | 'subtitles';
  cues: any;
  track: string;
}

export interface NonNativeTextTrack {
  _id?: string;
  label: any;
  kind: string;
  default: boolean;
  closedCaptions?: MediaPlaylist;
  subtitleTrack?: MediaPlaylist;
}

export interface NonNativeTextTracksData {
  tracks: Array<NonNativeTextTrack>;
}

export interface InitPTSFoundData {
  id: string;
  frag: Fragment;
  initPTS: number;
  timescale: number;
}

export interface FragLoadingData {
  frag: Fragment;
  part?: Part;
  targetBufferTime: number | null;
}

export interface FragLoadEmergencyAbortedData {
  frag: Fragment;
  part: Part | null;
  stats: LoaderStats;
}

export interface FragLoadedData {
  frag: Fragment;
  part: Part | null;
  payload: ArrayBuffer;
  networkDetails: unknown;
}

export interface PartsLoadedData {
  frag: Fragment;
  part: Part | null;
  partsLoaded?: FragLoadedData[];
}

export interface FragDecryptedData {
  frag: Fragment;
  payload: ArrayBuffer;
  stats: {
    tstart: number;
    tdecrypt: number;
  };
}

export interface FragParsingInitSegmentData {}

export interface FragParsingUserdataData {
  id: string;
  frag: Fragment;
  details: LevelDetails;
  samples: UserdataSample[];
}

export interface FragParsingMetadataData {
  id: string;
  frag: Fragment;
  details: LevelDetails;
  samples: MetadataSample[];
}

export interface FragParsedData {
  frag: Fragment;
  part: Part | null;
}

export interface FragBufferedData {
  stats: LoadStats;
  frag: Fragment;
  part: Part | null;
  id: string;
}

export interface LevelsUpdatedData {
  levels: Array<Level>;
}

export interface KeyLoadingData {
  frag: Fragment;
}

export interface KeyLoadedData {
  frag: Fragment;
  keyInfo: KeyLoaderInfo;
}

export interface BackBufferData {
  bufferEnd: number;
}

/**
 * @deprecated Use BackBufferData
 */
export interface LiveBackBufferData extends BackBufferData {}

export interface SteeringManifestLoadedData {
  steeringManifest: SteeringManifest;
  url: string;
}
