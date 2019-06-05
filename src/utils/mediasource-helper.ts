/**
 * MediaSource helper
 */

export function getMediaSource (): typeof MediaSource {
  return (window as any).MediaSource || (window as any).WebKitMediaSource;
}
