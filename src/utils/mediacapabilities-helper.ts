import { mimeTypeForCodec } from './codecs';
import type { Level, VideoRange } from '../types/level';
import type { AudioSelectionOption } from '../types/media-playlist';
import type { AudioTracksByGroup } from './rendition-helper';

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
  Promise<MediaCapabilitiesDecodingInfo>
> = {};

export function requiresMediaCapabilitiesDecodingInfo(
  level: Level,
  audioTracksByGroup: AudioTracksByGroup,
  currentVideoRange: VideoRange | undefined,
  currentFrameRate: number,
  currentBw: number,
  audioPreference: AudioSelectionOption | undefined,
): boolean {
  // Only test support when configuration is exceeds minimum options
  const audioGroups = level.audioCodec ? level.audioGroups : null;
  const audioCodecPreference = audioPreference?.audioCodec;
  const channelsPreference = audioPreference?.channels;
  const maxChannels = channelsPreference
    ? parseInt(channelsPreference)
    : audioCodecPreference
      ? Infinity
      : 2;
  let audioChannels: Record<string, number> | null = null;
  if (audioGroups?.length) {
    try {
      if (audioGroups.length === 1 && audioGroups[0]) {
        audioChannels = audioTracksByGroup.groups[audioGroups[0]].channels;
      } else {
        audioChannels = audioGroups.reduce(
          (acc, groupId) => {
            if (groupId) {
              const audioTrackGroup = audioTracksByGroup.groups[groupId];
              if (!audioTrackGroup) {
                throw new Error(`Audio track group ${groupId} not found`);
              }
              // Sum all channel key values
              Object.keys(audioTrackGroup.channels).forEach((key) => {
                acc[key] = (acc[key] || 0) + audioTrackGroup.channels[key];
              });
            }
            return acc;
          },
          { 2: 0 },
        );
      }
    } catch (error) {
      return true;
    }
  }
  return (
    (level.videoCodec !== undefined &&
      ((level.width > 1920 && level.height > 1088) ||
        (level.height > 1920 && level.width > 1088) ||
        level.frameRate > Math.max(currentFrameRate, 30) ||
        (level.videoRange !== 'SDR' &&
          level.videoRange !== currentVideoRange) ||
        level.bitrate > Math.max(currentBw, 8e6))) ||
    (!!audioChannels &&
      Number.isFinite(maxChannels) &&
      Object.keys(audioChannels).some(
        (channels) => parseInt(channels) > maxChannels,
      ))
  );
}

export function getMediaDecodingInfoPromise(
  level: Level,
  audioTracksByGroup: AudioTracksByGroup,
  mediaCapabilities: MediaCapabilities | undefined,
): Promise<MediaDecodingInfo> {
  const videoCodecs = level.videoCodec;
  const audioCodecs = level.audioCodec;
  if (!videoCodecs || !audioCodecs || !mediaCapabilities) {
    return Promise.resolve(SUPPORTED_INFO_DEFAULT);
  }

  const baseVideoConfiguration: BaseVideoConfiguration = {
    width: level.width,
    height: level.height,
    bitrate: Math.ceil(Math.max(level.bitrate * 0.9, level.averageBitrate)),
    // Assume a framerate of 30fps since MediaCapabilities will not accept Level default of 0.
    framerate: level.frameRate || 30,
  };

  const videoRange = level.videoRange;
  if (videoRange !== 'SDR') {
    baseVideoConfiguration.transferFunction =
      videoRange.toLowerCase() as TransferFunction;
  }

  const configurations: MediaDecodingConfiguration[] = videoCodecs
    .split(',')
    .map((videoCodec) => ({
      type: 'media-source',
      video: {
        ...baseVideoConfiguration,
        contentType: mimeTypeForCodec(videoCodec, 'video'),
      },
    }));

  if (audioCodecs && level.audioGroups) {
    level.audioGroups.forEach((audioGroupId) => {
      if (!audioGroupId) {
        return;
      }
      audioTracksByGroup.groups[audioGroupId]?.tracks.forEach((audioTrack) => {
        if (audioTrack.groupId === audioGroupId) {
          const channels = audioTrack.channels || '';
          const channelsNumber = parseFloat(channels);
          if (Number.isFinite(channelsNumber) && channelsNumber > 2) {
            configurations.push.apply(
              configurations,
              audioCodecs.split(',').map((audioCodec) => ({
                type: 'media-source',
                audio: {
                  contentType: mimeTypeForCodec(audioCodec, 'audio'),
                  channels: '' + channelsNumber,
                  // spatialRendering:
                  //   audioCodec === 'ec-3' && channels.indexOf('JOC'),
                },
              })),
            );
          }
        }
      });
    });
  }

  return Promise.all(
    configurations.map((configuration) => {
      // Cache MediaCapabilities promises
      const decodingInfoKey = getMediaDecodingInfoKey(configuration);
      return (
        SUPPORTED_INFO_CACHE[decodingInfoKey] ||
        (SUPPORTED_INFO_CACHE[decodingInfoKey] =
          mediaCapabilities.decodingInfo(configuration))
      );
    }),
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
}

function getMediaDecodingInfoKey(config: MediaDecodingConfiguration): string {
  const { audio, video } = config;
  const mediaConfig = video || audio;
  if (mediaConfig) {
    const codec = mediaConfig.contentType.split('"')[1];
    if (video) {
      return `r${video.height}x${video.width}f${Math.ceil(video.framerate)}${
        video.transferFunction || 'sd'
      }_${codec}_${Math.ceil(video.bitrate / 1e5)}`;
    }
    if (audio) {
      return `c${audio.channels}${audio.spatialRendering ? 's' : 'n'}_${codec}`;
    }
  }
  return '';
}
