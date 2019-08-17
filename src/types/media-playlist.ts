export interface AudioGroup {
  id: string;
  codec: string;
}

export type MediaPlaylistType = 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';

export interface MediaPlaylist {
  groupId: string;
  name: string;
  // 'main' is a custom type added to signal a audioCodec in main track?; see playlist-loader~L310
  type: MediaPlaylistType | 'main';
  default: boolean; // implicit false if not present
  autoselect: boolean; // implicit false if not present
  forced: boolean; // implicit false if not present
  id: number; // incrementing number to track media playlists
  url?: string;
  lang?: string;
  audioCodec?: string;
}
