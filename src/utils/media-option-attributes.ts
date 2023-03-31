import type { Level } from '../types/level';
import type { MediaAttributes, MediaPlaylist } from '../types/media-playlist';

export function subtitleOptionsIdentical(
  trackList1: MediaPlaylist[] | Level[],
  trackList2: MediaPlaylist[]
): boolean {
  if (trackList1.length !== trackList2.length) {
    return false;
  }
  for (let i = 0; i < trackList1.length; i++) {
    if (
      !subtitleAttributesIdentical(
        trackList1[i].attrs as MediaAttributes,
        trackList2[i].attrs
      )
    ) {
      return false;
    }
  }
  return true;
}

export function subtitleAttributesIdentical(
  attrs1: MediaAttributes,
  attrs2: MediaAttributes
): boolean {
  // Media options with the same rendition ID must be bit identical
  const stableRenditionId = attrs1['STABLE-RENDITION-ID'];
  if (stableRenditionId) {
    return stableRenditionId === attrs2['STABLE-RENDITION-ID'];
  }
  // When rendition ID is not present, compare attributes
  return ![
    'LANGUAGE',
    'NAME',
    'CHARACTERISTICS',
    'AUTOSELECT',
    'DEFAULT',
    'FORCED',
  ].some(
    (subtitleAttribute) =>
      attrs1[subtitleAttribute] !== attrs2[subtitleAttribute]
  );
}
