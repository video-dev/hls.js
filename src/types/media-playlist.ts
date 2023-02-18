import type { LevelParsed } from './level';
import type { AttrList } from '../utils/attr-list';
export interface AudioGroup {
  id?: string;
  codec?: string;
}

export type AudioPlaylistType = 'AUDIO';

export type MainPlaylistType = AudioPlaylistType | 'VIDEO';

export type SubtitlePlaylistType = 'SUBTITLES' | 'CLOSED-CAPTIONS';

export type MediaPlaylistType = MainPlaylistType | SubtitlePlaylistType;

// audioTracks, captions and subtitles returned by `M3U8Parser.parseMasterPlaylistMedia`
export interface MediaPlaylist extends Omit<LevelParsed, 'attrs'> {
  attrs: MediaAttributes;
  autoselect: boolean; // implicit false if not present
  default: boolean; // implicit false if not present
  forced: boolean; // implicit false if not present
  groupId: string; // required in HLS playlists
  id: number; // incrementing number to track media playlists
  instreamId?: string;
  lang?: string;
  name: string;
  // 'main' is a custom type added to signal a audioCodec in main track?; see playlist-loader~L310
  type: MediaPlaylistType | 'main';
}

export interface MediaAttributes extends AttrList {
  'ASSOC-LANGUAGE'?: string;
  AUTOSELECT?: 'YES' | 'NO';
  CHANNELS?: string;
  CHARACTERISTICS?: string;
  DEFAULT?: 'YES' | 'NO';
  FORCED?: 'YES' | 'NO';
  'GROUP-ID': string;
  'INSTREAM-ID'?: string;
  LANGUAGE?: string;
  NAME: string;
  'PATHWAY-ID'?: string;
  'STABLE-RENDITION-ID'?: string;
  TYPE?: 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';
  URI?: string;
}
