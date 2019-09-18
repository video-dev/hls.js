/**
 * MediaSource helper
 */

export function getMediaSource (): typeof MediaSource | undefined {
  return (self as any).MediaSource || (self as any).WebKitMediaSource;
}
