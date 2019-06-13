import { LoaderStats } from './types/loader';

/**
 * @readonly
 * @enum {string}
 */
export enum HlsEvents {
  MEDIA_ATTACHING = 'hlsMediaAttaching',
  MEDIA_ATTACHED = 'hlsMediaAttached',
  MEDIA_DETACHING = 'hlsMediaDetaching',
  MEDIA_DETACHED = 'hlsMediaDetached',
  BUFFER_RESET = 'hlsBufferReset',
  // fired when we know about the codecs that we need buffers for to push into - data: {tracks : { container, codec, levelCodec, initSegment, metadata }}
  BUFFER_CODECS = 'hlsBufferCodecs',
  // fired when sourcebuffers have been created - data: { tracks : tracks }
  BUFFER_CREATED = 'hlsBufferCreated',
  // fired when we append a segment to the buffer - data: { segment: segment object }
  BUFFER_APPENDING = 'hlsBufferAppending',
  // fired when we are done with appending a media segment to the buffer - data : { parent : segment parent that triggered BUFFER_APPENDING, pending : nb of segments waiting for appending for this segment parent}
  BUFFER_APPENDED = 'hlsBufferAppended',
  // fired when the stream is finished and we want to notify the media buffer that there will be no more data - data: { }
  BUFFER_EOS = 'hlsBufferEos',
  // fired when the media buffer should be flushed - data { startOffset, endOffset }
  BUFFER_FLUSHING = 'hlsBufferFlushing',
  // fired when the media buffer has been flushed - data: { }
  BUFFER_FLUSHED = 'hlsBufferFlushed',
  MANIFEST_LOADING = 'hlsManifestLoading',
  MANIFEST_LOADED = 'hlsManifestLoaded',
  // fired after manifest has been parsed - data: { levels : [available quality levels], firstLevel : index of first quality level appearing in Manifest}
  MANIFEST_PARSED = 'hlsManifestParsed',
  // fired when a level switch is requested - data: { level : id of new level }
  LEVEL_SWITCHING = 'hlsLevelSwitching',
  // fired when a level switch is effective - data: { level : id of new level }
  LEVEL_SWITCHED = 'hlsLevelSwitched',
  LEVEL_LOADING = 'hlsLevelLoading',
  LEVEL_LOADED = 'hlsLevelLoaded',
  // fired when a level's details have been updated based on previous details, after it has been loaded - data: { details : levelDetails object, level : id of updated level }
  LEVEL_UPDATED = 'hlsLevelUpdated',
  // fired when a level's PTS information has been updated after parsing a fragment - data: { details : levelDetails object, level : id of updated level, drift: PTS drift observed when parsing last fragment }
  LEVEL_PTS_UPDATED = 'hlsLevelPtsUpdated',
  // fired to notify that audio track lists has been updated - data: { audioTracks : audioTracks }
  AUDIO_TRACKS_UPDATED = 'hlsAudioTracksUpdated',
  // fired when an audio track switching is requested - data: { id : audio track id }
  AUDIO_TRACK_SWITCHING = 'hlsAudioTrackSwitching',
  // fired when an audio track switch actually occurs - data: { id : audio track id }
  AUDIO_TRACK_SWITCHED = 'hlsAudioTrackSwitched',
  AUDIO_TRACK_LOADING = 'hlsAudioTrackLoading',
  AUDIO_TRACK_LOADED = 'hlsAudioTrackLoaded',
  // fired to notify that subtitle track lists has been updated - data: { subtitleTracks : subtitleTracks }
  SUBTITLE_TRACKS_UPDATED = 'hlsSubtitleTracksUpdated',
  // fired when an subtitle track switch occurs - data: { id : subtitle track id }
  SUBTITLE_TRACK_SWITCH = 'hlsSubtitleTrackSwitch',
  SUBTITLE_TRACK_LOADING = 'hlsSubtitleTrackLoading',
  SUBTITLE_TRACK_LOADED = 'hlsSubtitleTrackLoaded',
  // fired when a subtitle fragment has been processed - data: { success : boolean, frag : the processed frag }
  SUBTITLE_FRAG_PROCESSED = 'hlsSubtitleFragProcessed',
  // fired when the first timestamp is found - data: { id : demuxer id, initPTS: initPTS, frag : fragment object }
  INIT_PTS_FOUND = 'hlsInitPtsFound',
  // fired when a fragment loading starts - data: { frag : fragment object }
  FRAG_LOADING = 'hlsFragLoading',
  // fired when a fragment loading is progressing - data: { frag : fragment object, { trequest, tfirst, loaded } }
  FRAG_LOAD_PROGRESS = 'hlsFragLoadProgress',
  // Identifier for fragment load aborting for emergency switch down - data: { frag : fragment object }
  FRAG_LOAD_EMERGENCY_ABORTED = 'hlsFragLoadEmergencyAborted',
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length } }
  FRAG_LOADED = 'hlsFragLoaded',
  // fired when a fragment has finished decrypting - data: { id : demuxer id, frag: fragment object, payload : fragment payload, stats : { tstart, tdecrypt } }
  FRAG_DECRYPTED = 'hlsFragDecrypted',
  // fired when Init Segment has been extracted from fragment - data: { id : demuxer id, frag: fragment object, moov : moov MP4 box, codecs : codecs found while parsing fragment }
  FRAG_PARSING_INIT_SEGMENT = 'hlsFragParsingInitSegment',
  // fired when parsing sei text is completed - data: { id : demuxer id, frag: fragment object, samples : [ sei samples pes ] }
  FRAG_PARSING_USERDATA = 'hlsFragParsingUserdata',
  // fired when parsing id3 is completed - data: { id : demuxer id, frag: fragment object, samples : [ id3 samples pes ] }
  FRAG_PARSING_METADATA = 'hlsFragParsingMetadata',
  // fired when data have been extracted from fragment - data: { id : demuxer id, frag: fragment object, data1 : moof MP4 box or TS fragments, data2 : mdat MP4 box or null}
  FRAG_PARSING_DATA = 'hlsFragParsingData',
  // fired when fragment parsing is completed - data: { id : demuxer id, frag: fragment object }
  FRAG_PARSED = 'hlsFragParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { id : demuxer id, frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length, bwEstimate } }
  FRAG_BUFFERED = 'hlsFragBuffered',
  // fired when fragment matching with current media position is changing - data : { id : demuxer id, frag : fragment object }
  FRAG_CHANGED = 'hlsFragChanged',
  // Identifier for a FPS drop event - data: { curentDropped, currentDecoded, totalDroppedFrames }
  FPS_DROP = 'hlsFpsDrop',
  // triggered when FPS drop triggers auto level capping - data: { level, droppedlevel }
  FPS_DROP_LEVEL_CAPPING = 'hlsFpsDropLevelCapping',
  ERROR = 'hlsError',
  DESTROYING = 'hlsDestroying',
  // fired when a decrypt key loading starts - data: { frag : fragment object }
  KEY_LOADING = 'hlsKeyLoading',
  // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length } }
  KEY_LOADED = 'hlsKeyLoaded',
  // fired upon stream controller state transitions - data: { previousState, nextState }
  STREAM_STATE_TRANSITION = 'hlsStreamStateTransition',
}

export interface HLSListeners {
  [HlsEvents.MEDIA_ATTACHING]: (data: {
    media: HTMLMediaElement;
  }) => void

  [HlsEvents.MEDIA_ATTACHED]: (data: {
    media: HTMLMediaElement;
  }) => void

  [HlsEvents.MEDIA_DETACHING]: () => void

  [HlsEvents.MEDIA_DETACHED]: () => void

  [HlsEvents.MANIFEST_LOADING]: (data: {
    url: string;
  }) => void

  [HlsEvents.MANIFEST_LOADED]: (data: {
    levels: any[];
    audioTracks: any[];
    subtitles?: any[];
    url: string;
    stats: LoaderStats;
    networkDetails: unknown;
  }) => void

  [HlsEvents.LEVEL_LOADING]: (data: {
    url: string;
    level: number | null;
    id: number;
  }) => void

  [HlsEvents.LEVEL_LOADED]: (data: {
    details: any; // LevelDetails type?
    level: number;
    id: number;
    stats: LoaderStats;
    networkDetails: unknown;
  }) => void

  [HlsEvents.AUDIO_TRACK_LOADING]: (data: {
    url: string;
    id: number | null;
  }) => void

  [HlsEvents.AUDIO_TRACK_LOADED]: (data: {
    details: any; // LevelDetails type?
    id: number | null;
    stats: LoaderStats;
    networkDetails: unknown;
  }) => void

  [HlsEvents.SUBTITLE_TRACK_LOADING]: (data: {
    url: string;
    id: number | null;
  }) => void

  [HlsEvents.SUBTITLE_TRACK_LOADED]: (data: {
    details: any; // LevelDetails type?
    id: number | null;
    stats: LoaderStats;
    networkDetails: unknown;
  }) => void;

  [HlsEvents.ERROR]: (data: {
    type: any // ErrorType enum
    details: any // ErrorDetails enum
    fatal: boolean

    // Other error specific data...
    [key: string]: any;
  }) => void

  [HlsEvents.DESTROYING]: () => void
}

type Arguments < T > = [ T ] extends [ (...args: infer U) => any ]
  ? U
  : [T] extends [void] ? [] : [T];

export interface TypedEventEmitter<Events> {
  addListener<E extends keyof Events> (event: E, listener: Events[E]): this
  on<E extends keyof Events> (event: E, listener: Events[E]): this
  once<E extends keyof Events> (event: E, listener: Events[E]): this

  removeAllListeners<E extends keyof Events> (event?: E): this
  removeListener<E extends keyof Events> (event: E, listener?: Events[E], context?: any, once?: boolean): this

  emit<E extends keyof Events> (event: E, ...args: Arguments<Events[E]>): boolean
  listeners<E extends keyof Events> (event: E): Function[]
  listenerCount<E extends keyof Events> (event: E): number
}

export interface IEventHandler {
  registerListeners(): void;
  unregisterListeners(): void;
  destroy(): void
}

export default HlsEvents;
