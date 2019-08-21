import Fragment from '../loader/fragment';
import LevelDetails from '../loader/level-details';
import { Level, LevelParsed, PlaylistMedia } from './level';
import { LoaderStats } from './loader';
import { Track } from './track';

export interface ManifestLoadingData {
  url: string
}

export interface ManifestLoadedData {
  audioTracks: PlaylistMedia[]
  captions?: PlaylistMedia[]
  levels: LevelParsed[]
  networkDetails: any,
  stats: LoaderStats
  subtitles?: PlaylistMedia[]
  url: string
}

export interface ManifestParsedData {
  levels: Level[]
  audioTracks: PlaylistMedia[]
  firstLevel: number
  stats: LoaderStats
  audio: boolean
  video: boolean
  altAudio: boolean
}

export interface TrackLoadingData {
  id: number
  url: string
}

export interface LevelLoadingData extends TrackLoadingData {
  level: number
}

export interface TrackLoadedData {
  details: LevelDetails
  id: number
  networkDetails: any
  stats: LoaderStats
}

export interface LevelLoadedData extends TrackLoadedData {
  level: number
}

export interface AudioTrackSwitchedData {
  id: number
}

export interface FragLoadedData {
  frag: Fragment
  networkDetails: any
  payload: ArrayBuffer
  stats: LoaderStats
}

export interface MediaAttachedData {
  media: HTMLVideoElement;
}

export interface ErrorData {
  type: string // TODO: string enum of ErrorTypes values
  details: string // TODO: string enum of ErrorDetails values
  fatal: boolean
  buffer?: number
  bytes?: number
  context?: any
  error?: Error
  event?: any
  frag?: Fragment
  level?: number
  levelRetry?: boolean
  networkDetails?: any
  reason?: string
  response?: any
  url?: string
}

export interface MediaAttachingData {
  media: HTMLVideoElement
}

export interface BufferCodecsData {
  video: Track
}

export interface FPSDropLevelCappingData {
  droppedLevel: number
}

export interface LevelsUpdatedData {
  levels: Array<Level>
}
