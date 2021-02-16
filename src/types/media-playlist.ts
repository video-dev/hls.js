import type { LevelParsed } from './level';

export interface AudioGroup {
  id?: string;
  codec?: string;
}

export type AudioPlaylistType = 'AUDIO';

export type MainPlaylistType = AudioPlaylistType | 'VIDEO';

export type SubtitlePlaylistType = 'SUBTITLES' | 'CLOSED-CAPTIONS';

export type MediaPlaylistType = MainPlaylistType | SubtitlePlaylistType;

// audioTracks, captions and subtitles returned by `M3U8Parser.parseMasterPlaylistMedia`
export interface MediaPlaylist extends LevelParsed {
  autoselect: boolean; // implicit false if not present
  default: boolean; // implicit false if not present
  forced: boolean; // implicit false if not present
  groupId?: string; // not optional in HLS playlists, but it isn't always specified.
  id: number; // incrementing number to track media playlists
  instreamId?: string;
  lang?: string;
  name: string;
  // 'main' is a custom type added to signal a audioCodec in main track?; see playlist-loader~L310
  type: MediaPlaylistType | 'main';
}
