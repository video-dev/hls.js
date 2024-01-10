import { codecsSetSelectionPreferenceValue } from './codecs';
import { getVideoSelectionOptions } from './hdr';
import { logger } from './logger';
import type { Level, VideoRange } from '../types/level';
import type {
  AudioSelectionOption,
  MediaPlaylist,
  SubtitleSelectionOption,
  VideoSelectionOption,
} from '../types/media-playlist';

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
  videoRanges: Array<VideoRange>;
  preferHDR: boolean;
  minFramerate: number;
  minBitrate: number;
};

export function getStartCodecTier(
  codecTiers: Record<string, CodecSetTier>,
  currentVideoRange: VideoRange | undefined,
  currentBw: number,
  audioPreference: AudioSelectionOption | undefined,
  videoPreference: VideoSelectionOption | undefined,
): StartParameters {
  const codecSets = Object.keys(codecTiers);
  const channelsPreference = audioPreference?.channels;
  const audioCodecPreference = audioPreference?.audioCodec;
  const preferStereo = channelsPreference && parseInt(channelsPreference) === 2;
  // Use first level set to determine stereo, and minimum resolution and framerate
  let hasStereo = true;
  let hasCurrentVideoRange = false;
  let minHeight = Infinity;
  let minFramerate = Infinity;
  let minBitrate = Infinity;
  let selectedScore = 0;
  let videoRanges: Array<VideoRange> = [];

  const { preferHDR, allowedVideoRanges } = getVideoSelectionOptions(
    currentVideoRange,
    videoPreference,
  );

  for (let i = codecSets.length; i--; ) {
    const tier = codecTiers[codecSets[i]];
    hasStereo = tier.channels[2] > 0;
    minHeight = Math.min(minHeight, tier.minHeight);
    minFramerate = Math.min(minFramerate, tier.minFramerate);
    minBitrate = Math.min(minBitrate, tier.minBitrate);
    const matchingVideoRanges = allowedVideoRanges.filter(
      (range) => tier.videoRanges[range] > 0,
    );
    if (matchingVideoRanges.length > 0) {
      hasCurrentVideoRange = true;
      videoRanges = matchingVideoRanges;
    }
  }
  minHeight = Number.isFinite(minHeight) ? minHeight : 0;
  minFramerate = Number.isFinite(minFramerate) ? minFramerate : 0;
  const maxHeight = Math.max(1080, minHeight);
  const maxFramerate = Math.max(30, minFramerate);
  minBitrate = Number.isFinite(minBitrate) ? minBitrate : currentBw;
  currentBw = Math.max(minBitrate, currentBw);
  // If there are no variants with matching preference, set currentVideoRange to undefined
  if (!hasCurrentVideoRange) {
    currentVideoRange = undefined;
    videoRanges = [];
  }
  const codecSet = codecSets.reduce(
    (selected: string | undefined, candidate: string) => {
      // Remove candiates which do not meet bitrate, default audio, stereo or channels preference, 1080p or lower, 30fps or lower, or SDR/HDR selection if present
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
      if (
        audioCodecPreference &&
        candidate.indexOf(audioCodecPreference.substring(0, 4)) % 5 !== 0
      ) {
        logStartCodecCandidateIgnored(
          candidate,
          `audio codec preference "${audioCodecPreference}" not found`,
        );
        return selected;
      }
      if (channelsPreference && !preferStereo) {
        if (!candidateTier.channels[channelsPreference]) {
          logStartCodecCandidateIgnored(
            candidate,
            `no renditions with ${channelsPreference} channel sound found (channels options: ${Object.keys(
              candidateTier.channels,
            )})`,
          );
          return selected;
        }
      } else if (
        (!audioCodecPreference || preferStereo) &&
        hasStereo &&
        candidateTier.channels['2'] === 0
      ) {
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
      if (!videoRanges.some((range) => candidateTier.videoRanges[range] > 0)) {
        logStartCodecCandidateIgnored(
          candidate,
          `no variants with VIDEO-RANGE of ${JSON.stringify(
            videoRanges,
          )} found`,
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
    videoRanges,
    preferHDR,
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
      const audioGroups = level.audioGroups;
      let tier = tiers[level.codecSet];
      if (!tier) {
        tiers[level.codecSet] = tier = {
          minBitrate: Infinity,
          minHeight: Infinity,
          minFramerate: Infinity,
          maxScore: 0,
          videoRanges: { SDR: 0 },
          channels: { '2': 0 },
          hasDefaultAudio: !audioGroups,
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
      if (audioGroups) {
        audioGroups.forEach((audioGroupId) => {
          if (!audioGroupId) {
            return;
          }
          const audioGroup = audioTracksByGroup.groups[audioGroupId];
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
        });
      }
      return tiers;
    }, {});
}

export function findMatchingOption(
  option: MediaPlaylist | AudioSelectionOption | SubtitleSelectionOption,
  tracks: MediaPlaylist[],
  matchPredicate?: (
    option: MediaPlaylist | AudioSelectionOption | SubtitleSelectionOption,
    track: MediaPlaylist,
  ) => boolean,
): number {
  if ('attrs' in option) {
    const index = tracks.indexOf(option);
    if (index !== -1) {
      return index;
    }
  }
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (matchesOption(option, track, matchPredicate)) {
      return i;
    }
  }
  return -1;
}

export function matchesOption(
  option: MediaPlaylist | AudioSelectionOption | SubtitleSelectionOption,
  track: MediaPlaylist,
  matchPredicate?: (
    option: MediaPlaylist | AudioSelectionOption | SubtitleSelectionOption,
    track: MediaPlaylist,
  ) => boolean,
): boolean {
  const {
    groupId,
    name,
    lang,
    assocLang,
    characteristics,
    default: isDefault,
  } = option;
  const forced = (option as SubtitleSelectionOption).forced;
  return (
    (groupId === undefined || track.groupId === groupId) &&
    (name === undefined || track.name === name) &&
    (lang === undefined || track.lang === lang) &&
    (lang === undefined || track.assocLang === assocLang) &&
    (isDefault === undefined || track.default === isDefault) &&
    (forced === undefined || track.forced === forced) &&
    (characteristics === undefined ||
      characteristicsMatch(characteristics, track.characteristics)) &&
    (matchPredicate === undefined || matchPredicate(option, track))
  );
}

function characteristicsMatch(
  characteristicsA: string,
  characteristicsB: string = '',
): boolean {
  const arrA = characteristicsA.split(',');
  const arrB = characteristicsB.split(',');
  // Expects each item to be unique:
  return (
    arrA.length === arrB.length && !arrA.some((el) => arrB.indexOf(el) === -1)
  );
}

export function audioMatchPredicate(
  option: MediaPlaylist | AudioSelectionOption,
  track: MediaPlaylist,
) {
  const { audioCodec, channels } = option;
  return (
    (audioCodec === undefined ||
      (track.audioCodec || '').substring(0, 4) ===
        audioCodec.substring(0, 4)) &&
    (channels === undefined || channels === (track.channels || '2'))
  );
}

export function findClosestLevelWithAudioGroup(
  option: MediaPlaylist | AudioSelectionOption,
  levels: Level[],
  allAudioTracks: MediaPlaylist[],
  searchIndex: number,
  matchPredicate: (
    option: MediaPlaylist | AudioSelectionOption,
    track: MediaPlaylist,
  ) => boolean,
): number {
  const currentLevel = levels[searchIndex];
  // Are there variants with same URI as current level?
  // If so, find a match that does not require any level URI change
  const variants = levels.reduce(
    (variantMap: { [uri: string]: number[] }, level, index) => {
      const uri = level.uri;
      const renditions = variantMap[uri] || (variantMap[uri] = []);
      renditions.push(index);
      return variantMap;
    },
    {},
  );
  const renditions = variants[currentLevel.uri];
  if (renditions.length > 1) {
    searchIndex = Math.max.apply(Math, renditions);
  }
  // Find best match
  const currentVideoRange = currentLevel.videoRange;
  const currentFrameRate = currentLevel.frameRate;
  const currentVideoCodec = currentLevel.codecSet.substring(0, 4);
  const matchingVideo = searchDownAndUpList(
    levels,
    searchIndex,
    (level: Level) => {
      if (
        level.videoRange !== currentVideoRange ||
        level.frameRate !== currentFrameRate ||
        level.codecSet.substring(0, 4) !== currentVideoCodec
      ) {
        return false;
      }
      const audioGroups = level.audioGroups;
      const tracks = allAudioTracks.filter(
        (track): boolean =>
          !audioGroups || audioGroups.indexOf(track.groupId) !== -1,
      );
      return findMatchingOption(option, tracks, matchPredicate) > -1;
    },
  );
  if (matchingVideo > -1) {
    return matchingVideo;
  }
  return searchDownAndUpList(levels, searchIndex, (level: Level) => {
    const audioGroups = level.audioGroups;
    const tracks = allAudioTracks.filter(
      (track): boolean =>
        !audioGroups || audioGroups.indexOf(track.groupId) !== -1,
    );
    return findMatchingOption(option, tracks, matchPredicate) > -1;
  });
}

function searchDownAndUpList(
  arr: any[],
  searchIndex: number,
  predicate: (item: any) => boolean,
): number {
  for (let i = searchIndex; i; i--) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  for (let i = searchIndex + 1; i < arr.length; i++) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
}
