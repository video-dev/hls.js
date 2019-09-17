/**
 * MediaSource helper
 */

export function getMediaSource (): typeof MediaSource | undefined {
  return (window as any).MediaSource || (window as any).WebKitMediaSource;
}
