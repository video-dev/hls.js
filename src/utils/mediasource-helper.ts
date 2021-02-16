/**
 * MediaSource helper
 */

export function getMediaSource(): typeof MediaSource | undefined {
  return self.MediaSource || ((self as any).WebKitMediaSource as MediaSource);
}
