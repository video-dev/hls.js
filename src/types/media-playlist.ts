export interface AudioGroup {
  id: string;
  codec: string;
}

export type MediaPlaylistType = 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';

export interface MediaPlaylist {
  audioCodec?: string;
  autoselect: boolean; // implicit false if not present
  characteristics?: string;
  default: boolean; // implicit false if not present
  forced: boolean; // implicit false if not present
  groupId?: string; // not optional in HLS playlists, but it isn't always specified.
  id: number; // incrementing number to track media playlists
  lang?: string;
  name: string;
  // 'main' is a custom type added to signal a audioCodec in main track?; see playlist-loader~L310
  type: MediaPlaylistType | 'main';
  url?: string;
}
