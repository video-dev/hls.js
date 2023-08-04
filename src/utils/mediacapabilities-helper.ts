import { mimeTypeForCodec } from './codecs';
import type { Level, VideoRange } from '../types/level';

export type MediaDecodingInfo = {
  supported: boolean;
  configurations: readonly MediaDecodingConfiguration[];
  decodingInfoResults: readonly MediaCapabilitiesDecodingInfo[];
  error?: Error;
};

type BaseVideoConfiguration = Omit<VideoConfiguration, 'contentType'>;

export const SUPPORTED_INFO_DEFAULT: MediaDecodingInfo = {
  supported: true,
  configurations: [] as MediaDecodingConfiguration[],
  decodingInfoResults: [
    {
      supported: true,
      powerEfficient: true,
      smooth: true,
    },
  ],
} as const;

export const SUPPORTED_INFO_CACHE: Record<
  string,
  Promise<MediaDecodingInfo>
> = {};

export function requiresMediaCapabilitiesDecodingInfo(
  level: Level,
  mediaCapabilities: MediaCapabilities | undefined,
  currentVideoRange: VideoRange | undefined,
  currentFrameRate: number,
  currentBw: number
): boolean {
  // Only test support when configuration is exceeds minimum options
  return (
    typeof mediaCapabilities?.decodingInfo == 'function' &&
    level.videoCodec !== undefined &&
    ((level.width > 1920 && level.height > 1088) ||
      (level.height > 1920 && level.width > 1088) ||
      level.frameRate > Math.max(currentFrameRate, 30) ||
      (level.videoRange !== 'SDR' && level.videoRange !== currentVideoRange) ||
      level.bitrate > Math.max(currentBw, 8e6))
  );
}

export function getMediaDecodingInfoPromise(
  level: Level,
  mediaCapabilities: MediaCapabilities
): Promise<MediaDecodingInfo> {
  const videoCodecs = level.videoCodec;
  if (!videoCodecs) {
    return Promise.resolve(SUPPORTED_INFO_DEFAULT);
  }

  const baseVideoConfiguration: BaseVideoConfiguration = {
    width: level.width,
    height: level.height,
    bitrate: Math.ceil(Math.max(level.bitrate * 0.9, level.averageBitrate)),
    framerate: level.frameRate,
  };

  const videoRange = level.videoRange;
  if (videoRange !== 'SDR') {
    baseVideoConfiguration.transferFunction =
      videoRange.toLowerCase() as TransferFunction;
  }

  // Cache MediaCapabilities promises
  const decodingInfoKey = getMediaDecodingInfoKey(
    baseVideoConfiguration,
    videoCodecs
  );
  let supportedPromise = SUPPORTED_INFO_CACHE[decodingInfoKey];
  if (supportedPromise) {
    return supportedPromise;
  }

  const configurations: MediaDecodingConfiguration[] = videoCodecs
    .split(',')
    .map((codec) => ({
      type: 'media-source',
      video: {
        ...baseVideoConfiguration,
        contentType: mimeTypeForCodec(codec, 'video'),
      },
    }));

  supportedPromise = SUPPORTED_INFO_CACHE[decodingInfoKey] = Promise.all(
    configurations.map((configuration) =>
      mediaCapabilities.decodingInfo(configuration)
    )
  )
    .then((decodingInfoResults) => ({
      supported: !decodingInfoResults.some((info) => !info.supported),
      configurations,
      decodingInfoResults,
    }))
    .catch((error) => ({
      supported: false,
      configurations,
      decodingInfoResults: [] as MediaCapabilitiesDecodingInfo[],
      error,
    }));
  return supportedPromise;
}

function getMediaDecodingInfoKey(
  video: BaseVideoConfiguration,
  videoCodecs: string
): string {
  return `r${video.height}x${video.width}b${Math.ceil(
    video.bitrate / 1e5
  )}f${Math.ceil(video.framerate)}${
    video.transferFunction || 'sd'
  }_${videoCodecs}`;
}
