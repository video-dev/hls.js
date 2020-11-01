// eslint-disable-next-line import/no-duplicates
import type Fragment from '../loader/fragment';
// eslint-disable-next-line import/no-duplicates
import type { Part } from '../loader/fragment';
import type LevelDetails from '../loader/level-details';
import type { HlsUrlParameters, Level, LevelParsed } from './level';
import type { MediaPlaylist, MediaPlaylistType } from './media-playlist';
import type { Loader, LoaderContext, LoaderResponse, LoaderStats, PlaylistLevelType, PlaylistLoaderContext } from './loader';
import type { Track, TrackSet } from './track';
import type { SourceBufferName } from './buffer';
import type { ChunkMetadata } from './transmuxer';
import type LoadStats from '../loader/load-stats';
import type { ErrorDetails, ErrorTypes } from '../errors';
import type { MetadataSample, UserdataSample } from './demuxer';
import type AttrList from '../utils/attr-list';
import type { HlsListeners } from '../events';

export interface MediaAttachingData {
  media: HTMLMediaElement
}

export interface MediaAttachedData {
  media: HTMLMediaElement;
}

export interface BufferCodecsData {
  video?: Track
  audio?: Track
}

export interface BufferCreatedData {
  tracks: TrackSet
}

export interface BufferAppendingData {
  type: SourceBufferName;
  data: Uint8Array;
  frag: Fragment;
  part: Part | null;
  chunkMeta: ChunkMetadata
}

export interface BufferAppendedData {
  chunkMeta: ChunkMetadata
  frag: Fragment
  parent: PlaylistLevelType
  timeRanges: {
    audio?: TimeRanges
    video?: TimeRanges
    audiovideo?: TimeRanges
  }
}

export interface BufferEOSData {
  type: SourceBufferName
}

export interface BufferFlushingData {
  startOffset: number
  endOffset: number
  type: SourceBufferName
}

export interface BufferFlushedData {
  type: SourceBufferName
}

export interface ManifestLoadingData {
  url: string
}

export interface ManifestLoadedData {
  audioTracks: MediaPlaylist[]
  captions?: MediaPlaylist[]
  levels: LevelParsed[]
  networkDetails: any
  sessionData: Record<string, AttrList> | null
  stats: LoaderStats
  subtitles?: MediaPlaylist[]
  url: string
}

export interface ManifestParsedData {
  levels: Level[]
  audioTracks: MediaPlaylist[]
  subtitleTracks: MediaPlaylist[]
  firstLevel: number
  stats: LoaderStats
  audio: boolean
  video: boolean
  altAudio: boolean
}

export interface LevelSwitchingData extends Level {
  level: number;
}

export interface LevelSwitchedData {
  level: number
}

export interface TrackLoadingData {
  id: number
  url: string
  deliveryDirectives: HlsUrlParameters | null
}

export interface LevelLoadingData extends TrackLoadingData {
  level: number
}

export interface TrackLoadedData {
  details: LevelDetails
  id: number
  networkDetails: any
  stats: LoaderStats
  deliveryDirectives: HlsUrlParameters | null
}

export interface LevelLoadedData extends TrackLoadedData {
  level: number
}

export interface LevelUpdatedData {
  details: LevelDetails
  level: number
}

export interface LevelPTSUpdatedData {
  details: LevelDetails,
  level: Level,
  drift: number,
  type: string,
  start: number,
  end: number
}

export interface AudioTrackSwitchingData {
  url: string
  type: MediaPlaylistType | 'main'
  id: number
}

export interface AudioTrackSwitchedData {
  id: number
}

export interface AudioTrackLoadedData extends TrackLoadedData {}

export interface AudioTracksUpdatedData {
  audioTracks: MediaPlaylist[]
}

export interface SubtitleTracksUpdatedData {
  subtitleTracks: MediaPlaylist[]
}

export interface SubtitleTrackSwitchData {
  url?: string
  type?: MediaPlaylistType | 'main'
  id: number
}

export interface SubtitleTrackLoadedData extends TrackLoadedData {}

export interface TrackSwitchedData {
  id: number
}

export interface SubtitleFragProcessed {
  success: boolean,
  frag: Fragment
}

export interface FragChangedData {
  frag: Fragment;
}

export interface FPSDropData {
  currentDropped: number
  currentDecoded: number
  totalDroppedFrames: number
}

export interface FPSDropLevelCappingData {
  droppedLevel: number
  level: number
}

export interface ErrorData {
  type: ErrorTypes
  details: ErrorDetails
  fatal: boolean
  buffer?: number
  bytes?: number
  context?: PlaylistLoaderContext
  error?: Error
  event?: keyof HlsListeners | 'demuxerWorker'
  frag?: Fragment
  level?: number | undefined
  levelRetry?: boolean
  loader?: Loader<LoaderContext>
  networkDetails?: any
  mimeType?: string
  reason?: string
  response?: LoaderResponse
  url?: string
  parent?: PlaylistLevelType
  err?: { // comes from transmuxer interface
    message: string;
  }
}

export interface SubtitleFragProcessedData {
  success: boolean
  frag: Fragment
  error?: Error
}

export interface CuesParsedData {
  type: 'captions' | 'subtitles',
  cues: any,
  track: string
}

interface NonNativeTextTrack {
  _id?: string
  label: any
  kind: string
  default: boolean
  closedCaptions?: MediaPlaylist
  subtitleTrack?: MediaPlaylist
}

export interface NonNativeTextTracksData {
  tracks: Array<NonNativeTextTrack>
}

export interface InitPTSFoundData {
  id: string
  frag: Fragment
  initPTS: number
  timescale: number
}

export interface FragLoadingData {
  frag: Fragment,
  part?: Part,
  targetBufferTime: number | null
}

export interface FragLoadEmergencyAbortedData {
  frag: Fragment
  stats: LoaderStats
}

export interface FragLoadedData {
  frag: Fragment
  part: Part | null
  payload: ArrayBuffer
  networkDetails: unknown
}

export interface FragLoadedEndData {
  frag: Fragment
  partsLoaded?: FragLoadedData[]
}

export interface FragDecryptedData {
  frag: Fragment
  payload: ArrayBuffer
  stats: {
    tstart: number
    tdecrypt: number
  }
}

export interface FragParsingInitSegmentData {

}

export interface FragParsingUserdataData {
  id: string,
  frag: Fragment,
  samples: UserdataSample[]
}

export interface FragParsingMetadataData {
  id: string,
  frag: Fragment,
  samples: MetadataSample[]
}

export interface FragParsedData {
  frag: Fragment,
  part: Part | null
}

export interface FragBufferedData {
  stats: LoadStats
  frag: Fragment,
  part: Part | null
  id: string
}

export interface LevelsUpdatedData {
  levels: Array<Level>
}

export interface KeyLoadingData {
  frag: Fragment
}

export interface KeyLoadedData {
  frag: Fragment
}

export interface LiveBackBufferData {
  bufferEnd: number
}
