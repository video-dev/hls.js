import { codecsSetSelectionPreferenceValue } from './codecs';
import { logger } from './logger';
import type { Level, VideoRange } from '../types/level';
import type { MediaPlaylist } from '../types/media-playlist';

export type CodecSetTier = {
  minBitrate: number;
  minHeight: number;
  minFramerate: number;
  maxScore: number;
  videoRanges: Record<string, number>;
  channels: Record<string, number>;
  hasDefaultAudio: boolean;
  fragmentError: number;
};

type AudioTrackGroup = {
  tracks: MediaPlaylist[];
  channels: Record<string, number>;
  hasDefault: boolean;
  hasAutoSelect: boolean;
};
type StartParameters = {
  codecSet: string | undefined;
  videoRange: VideoRange | undefined;
  minFramerate: number;
  minBitrate: number;
};

export function getStartCodecTier(
  codecTiers: Record<string, CodecSetTier>,
  videoRange: VideoRange | undefined,
  currentBw: number,
): StartParameters {
  const codecSets = Object.keys(codecTiers);
  // Use first level set to determine stereo, and minimum resolution and framerate
  let hasStereo = true;
  let hasCurrentVideoRange = false;
  let minHeight = Infinity;
  let minFramerate = Infinity;
  let minBitrate = Infinity;
  let selectedScore = 0;
  for (let i = codecSets.length; i--; ) {
    const tier = codecTiers[codecSets[i]];
    hasStereo = tier.channels[2] > 0;
    minHeight = Math.min(minHeight, tier.minHeight);
    minFramerate = Math.min(minFramerate, tier.minFramerate);
    minBitrate = Math.min(minBitrate, tier.minBitrate);
    if (videoRange) {
      hasCurrentVideoRange ||= tier.videoRanges[videoRange] > 0;
    }
  }
  minHeight = Number.isFinite(minHeight) ? minHeight : 0;
  minFramerate = Number.isFinite(minFramerate) ? minFramerate : 0;
  const maxHeight = Math.max(1080, minHeight);
  const maxFramerate = Math.max(30, minFramerate);
  minBitrate = Number.isFinite(minBitrate) ? minBitrate : currentBw;
  currentBw = Math.max(minBitrate, currentBw);
  // If there are no SDR variants, set currentVideoRange to undefined
  if (!hasCurrentVideoRange) {
    videoRange = undefined;
  }
  const codecSet = codecSets.reduce(
    (selected: string | undefined, candidate: string) => {
      // Remove candiates which do not meet bitrate, default audio, stereo, 1080p or lower, 30fps or lower, or SDR if present
      const candidateTier = codecTiers[candidate];
      if (candidate === selected) {
        return selected;
      }
      if (candidateTier.minBitrate > currentBw) {
        logStartCodecCandidateIgnored(
          candidate,
          `min bitrate of ${candidateTier.minBitrate} > current estimate of ${currentBw}`,
        );
        return selected;
      }
      if (!candidateTier.hasDefaultAudio) {
        logStartCodecCandidateIgnored(
          candidate,
          `no renditions with default or auto-select sound found`,
        );
        return selected;
      }
      if (hasStereo && candidateTier.channels['2'] === 0) {
        logStartCodecCandidateIgnored(
          candidate,
          `no renditions with stereo sound found`,
        );
        return selected;
      }
      if (candidateTier.minHeight > maxHeight) {
        logStartCodecCandidateIgnored(
          candidate,
          `min resolution of ${candidateTier.minHeight} > maximum of ${maxHeight}`,
        );
        return selected;
      }
      if (candidateTier.minFramerate > maxFramerate) {
        logStartCodecCandidateIgnored(
          candidate,
          `min framerate of ${candidateTier.minFramerate} > maximum of ${maxFramerate}`,
        );
        return selected;
      }
      if (videoRange && candidateTier.videoRanges[videoRange] === 0) {
        logStartCodecCandidateIgnored(
          candidate,
          `no variants with VIDEO-RANGE of ${videoRange} found`,
        );
        return selected;
      }
      if (candidateTier.maxScore < selectedScore) {
        logStartCodecCandidateIgnored(
          candidate,
          `max score of ${candidateTier.maxScore} < selected max of ${selectedScore}`,
        );
        return selected;
      }
      // Remove candiates with less preferred codecs or more errors
      if (
        selected &&
        (codecsSetSelectionPreferenceValue(candidate) >=
          codecsSetSelectionPreferenceValue(selected) ||
          candidateTier.fragmentError > codecTiers[selected].fragmentError)
      ) {
        return selected;
      }
      selectedScore = candidateTier.maxScore;
      return candidate;
    },
    undefined,
  );
  return {
    codecSet,
    videoRange,
    minFramerate,
    minBitrate,
  };
}

function logStartCodecCandidateIgnored(codeSet: string, reason: string) {
  logger.log(
    `[abr] start candidates with "${codeSet}" ignored because ${reason}`,
  );
}

export type AudioTracksByGroup = {
  hasDefaultAudio: boolean;
  hasAutoSelectAudio: boolean;
  groups: Record<string, AudioTrackGroup>;
};

export function getAudioTracksByGroup(allAudioTracks: MediaPlaylist[]) {
  return allAudioTracks.reduce(
    (audioTracksByGroup: AudioTracksByGroup, track) => {
      let trackGroup = audioTracksByGroup.groups[track.groupId];
      if (!trackGroup) {
        trackGroup = audioTracksByGroup.groups[track.groupId] = {
          tracks: [],
          channels: { 2: 0 },
          hasDefault: false,
          hasAutoSelect: false,
        };
      }
      trackGroup.tracks.push(track);
      const channelsKey = track.channels || '2';
      trackGroup.channels[channelsKey] =
        (trackGroup.channels[channelsKey] || 0) + 1;
      trackGroup.hasDefault = trackGroup.hasDefault || track.default;
      trackGroup.hasAutoSelect = trackGroup.hasAutoSelect || track.autoselect;
      if (trackGroup.hasDefault) {
        audioTracksByGroup.hasDefaultAudio = true;
      }
      if (trackGroup.hasAutoSelect) {
        audioTracksByGroup.hasAutoSelectAudio = true;
      }
      return audioTracksByGroup;
    },
    {
      hasDefaultAudio: false,
      hasAutoSelectAudio: false,
      groups: {},
    },
  );
}

export function getCodecTiers(
  levels: Level[],
  audioTracksByGroup: AudioTracksByGroup,
  minAutoLevel: number,
  maxAutoLevel: number,
): Record<string, CodecSetTier> {
  return levels
    .slice(minAutoLevel, maxAutoLevel + 1)
    .reduce((tiers: Record<string, CodecSetTier>, level) => {
      if (!level.codecSet) {
        return tiers;
      }
      const audioGroup = level.audioGroupId
        ? audioTracksByGroup.groups[level.audioGroupId]
        : null;
      let tier = tiers[level.codecSet];
      if (!tier) {
        tiers[level.codecSet] = tier = {
          minBitrate: Infinity,
          minHeight: Infinity,
          minFramerate: Infinity,
          maxScore: 0,
          videoRanges: { SDR: 0 },
          channels: { '2': 0 },
          hasDefaultAudio: !audioGroup,
          fragmentError: 0,
        };
      }
      tier.minBitrate = Math.min(tier.minBitrate, level.bitrate);
      const lesserWidthOrHeight = Math.min(level.height, level.width);
      tier.minHeight = Math.min(tier.minHeight, lesserWidthOrHeight);
      tier.minFramerate = Math.min(tier.minFramerate, level.frameRate);
      tier.maxScore = Math.max(tier.maxScore, level.score);
      tier.fragmentError += level.fragmentError;
      tier.videoRanges[level.videoRange] =
        (tier.videoRanges[level.videoRange] || 0) + 1;
      if (audioGroup) {
        // Default audio is any group with DEFAULT=YES, or if missing then any group with AUTOSELECT=YES, or all variants
        tier.hasDefaultAudio =
          tier.hasDefaultAudio || audioTracksByGroup.hasDefaultAudio
            ? audioGroup.hasDefault
            : audioGroup.hasAutoSelect ||
              (!audioTracksByGroup.hasDefaultAudio &&
                !audioTracksByGroup.hasAutoSelectAudio);
        Object.keys(audioGroup.channels).forEach((channels) => {
          tier.channels[channels] =
            (tier.channels[channels] || 0) + audioGroup.channels[channels];
        });
      }

      return tiers;
    }, {});
}
