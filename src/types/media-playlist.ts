import AttrList from '../utils/attr-list';

export interface AudioGroup {
  id: string;
  codec: string;
}

export type MediaPlaylistType = 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';

// audioTracks, captions and subtitles returned by `M3U8Parser.parseMasterPlaylistMedia`
export interface MediaPlaylist {
  attrs: AttrList
  audioCodec?: string;
  autoselect: boolean; // implicit false if not present
  default: boolean; // implicit false if not present
  forced: boolean; // implicit false if not present
  groupId?: string; // not optional in HLS playlists, but it isn't always specified.
  id: number; // incrementing number to track media playlists
  instreamId?: string; // ex: "CC1" or "SERVICE2"
  lang?: string;
  name: string;
  // 'main' is a custom type added to signal a audioCodec in main track?; see playlist-loader~L310
  type: MediaPlaylistType | 'main';
  url?: string;
}
