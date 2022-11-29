import { getMediaSource } from './utils/mediasource-helper';
import type { ExtendedSourceBuffer } from './types/buffer';

function getSourceBuffer(): typeof self.SourceBuffer {
  return self.SourceBuffer || (self as any).WebKitSourceBuffer;
}

export function isSupported(): boolean {
  const mediaSource = getMediaSource();
  if (!mediaSource) {
    return false;
  }
  const sourceBuffer = getSourceBuffer();
  const isTypeSupported =
    mediaSource &&
    typeof mediaSource.isTypeSupported === 'function' &&
    mediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');

  // if SourceBuffer is exposed ensure its API is valid
  // safari and old version of Chrome doe not expose SourceBuffer globally so checking SourceBuffer.prototype is impossible
  const sourceBufferValidAPI =
    !sourceBuffer ||
    (sourceBuffer.prototype &&
      typeof sourceBuffer.prototype.appendBuffer === 'function' &&
      typeof sourceBuffer.prototype.remove === 'function');
  return !!isTypeSupported && !!sourceBufferValidAPI;
}

export function changeTypeSupported(): boolean {
  const sourceBuffer = getSourceBuffer();
  return (
    typeof (sourceBuffer?.prototype as ExtendedSourceBuffer)?.changeType ===
    'function'
  );
}
