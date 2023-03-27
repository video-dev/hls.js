/**
 * MediaSource helper
 */

export function getMediaSource(): typeof MediaSource | undefined {
  if (typeof self === 'undefined') return undefined;
  return self.MediaSource || ((self as any).WebKitMediaSource as MediaSource);
}
