import { getMediaSource } from './utils/mediasource-helper';
import { getCodecCompatibleName, mimeTypeForCodec } from './utils/codecs';
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

  // if SourceBuffer is exposed ensure its API is valid
  // Older browsers do not expose SourceBuffer globally so checking SourceBuffer.prototype is impossible
  const sourceBufferValidAPI =
    !sourceBuffer ||
    (sourceBuffer.prototype &&
      typeof sourceBuffer.prototype.appendBuffer === 'function' &&
      typeof sourceBuffer.prototype.remove === 'function');
  if (!sourceBufferValidAPI) {
    return false;
  }

  return (
    !!mediaSource &&
    typeof mediaSource.isTypeSupported === 'function' &&
    ([
      'avc1.42E01E,mp4a.40.2',
      'hvc1.1.6.L123.B0',
      'av01.0.01M.08',
      'vp09.00.50.08',
    ].some((codecsForVideoContainer) =>
      isMimeTypeSupported(
        mediaSource,
        mimeTypeForCodec(codecsForVideoContainer, 'video'),
      ),
    ) ||
      ['mp4a.40.2', 'fLaC'].some((codecForAudioContainer) =>
        isMimeTypeSupported(
          mediaSource,
          mimeTypeForCodec(codecForAudioContainer, 'audio'),
        ),
      ))
  );
}

function isMimeTypeSupported(
  mediaSource: typeof MediaSource,
  mimeType: string,
): boolean {
  return mediaSource.isTypeSupported(mimeType);
}

export function changeTypeSupported(): boolean {
  const sourceBuffer = getSourceBuffer();
  return (
    typeof (sourceBuffer?.prototype as ExtendedSourceBuffer)?.changeType ===
    'function'
  );
}
