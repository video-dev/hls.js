/**
 * MediaSource helper
 */

export function getMediaSource (): typeof MediaSource {
  return MediaSource || (window as any).WebKitMediaSource;
}
