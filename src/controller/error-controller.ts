import { findFragmentByPTS } from './fragment-finders';
import { ErrorDetails, ErrorTypes } from '../errors';
import { Events } from '../events';
import { HdcpLevels } from '../types/level';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import { getCodecsForMimeType } from '../utils/codecs';
import {
  getRetryConfig,
  isTimeoutError,
  shouldRetry,
} from '../utils/error-helper';
import { Logger } from '../utils/logger';
import type { RetryConfig } from '../config';
import type Hls from '../hls';
import type { Fragment, MediaFragment } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type { NetworkComponentAPI } from '../types/component-api';
import type { ErrorData } from '../types/events';
import type { HdcpLevel } from '../types/level';

export const enum NetworkErrorAction {
  DoNothing = 0,
  SendEndCallback = 1, // Reserved for future use
  SendAlternateToPenaltyBox = 2,
  RemoveAlternatePermanently = 3, // Reserved for future use
  InsertDiscontinuity = 4, // Reserved for future use
  RetryRequest = 5,
}

export const enum ErrorActionFlags {
  None = 0,
  MoveAllAlternatesMatchingHost = 1,
  MoveAllAlternatesMatchingHDCP = 1 << 1,
  SwitchToSDR = 1 << 2, // Reserved for future use
}

export type IErrorAction = {
  action: NetworkErrorAction;
  flags: ErrorActionFlags;
  retryCount?: number;
  retryConfig?: RetryConfig;
  hdcpLevel?: HdcpLevel;
  nextAutoLevel?: number;
  resolved?: boolean;
};

type PenalizedRendition = {
  lastErrorPerfMs: number;
  errors: ErrorData[];
  details?: LevelDetails;
};

type PenalizedRenditions = { [key: number]: PenalizedRendition };

export default class ErrorController
  extends Logger
  implements NetworkComponentAPI
{
  private readonly hls: Hls;
  private playlistError: number = 0;
  private penalizedRenditions: PenalizedRenditions = {};

  constructor(hls: Hls) {
    super('error-controller', hls.logger);
    this.hls = hls;
    this.registerListeners();
  }

  private registerListeners() {
    const hls = this.hls;
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
  }

  private unregisterListeners() {
    const hls = this.hls;
    if (!hls) {
      return;
    }
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.ERROR, this.onErrorOut, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
  }

  destroy() {
    this.unregisterListeners();
    // @ts-ignore
    this.hls = null;
    this.penalizedRenditions = {};
  }

  startLoad(startPosition: number): void {}

  stopLoad(): void {
    this.playlistError = 0;
  }

  private getVariantLevelIndex(frag: Fragment | undefined): number {
    return frag?.type === PlaylistLevelType.MAIN
      ? frag.level
      : this.hls.loadLevel;
  }

  private onManifestLoading() {
    this.playlistError = 0;
    this.penalizedRenditions = {};
  }

  private onLevelUpdated() {
    this.playlistError = 0;
  }

  private onError(event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      return;
    }
    const hls = this.hls;
    const context = data.context;

    switch (data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        data.errorAction = this.getFragRetryOrSwitchAction(data);
        return;
      case ErrorDetails.FRAG_PARSING_ERROR:
        // ignore empty segment errors marked as gap
        if (data.frag?.gap) {
          data.errorAction = createDoNothingErrorAction();
          return;
        }
      // falls through
      case ErrorDetails.FRAG_GAP:
      case ErrorDetails.FRAG_DECRYPT_ERROR: {
        // Switch level if possible, otherwise allow retry count to reach max error retries
        data.errorAction = this.getFragRetryOrSwitchAction(data);
        data.errorAction.action = NetworkErrorAction.SendAlternateToPenaltyBox;
        return;
      }
      case ErrorDetails.LEVEL_EMPTY_ERROR:
      case ErrorDetails.LEVEL_PARSING_ERROR:
        {
          // Only retry when empty and live
          const levelIndex =
            data.parent === PlaylistLevelType.MAIN
              ? (data.level as number)
              : hls.loadLevel;
          if (
            data.details === ErrorDetails.LEVEL_EMPTY_ERROR &&
            !!data.context?.levelDetails?.live
          ) {
            data.errorAction = this.getPlaylistRetryOrSwitchAction(
              data,
              levelIndex,
            );
          } else {
            // Escalate to fatal if not retrying or switching
            data.levelRetry = false;
            data.errorAction = this.getLevelSwitchAction(data, levelIndex);
          }
        }
        return;
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
        if (typeof context?.level === 'number') {
          data.errorAction = this.getPlaylistRetryOrSwitchAction(
            data,
            context.level,
          );
        }
        return;
      case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
      case ErrorDetails.SUBTITLE_LOAD_ERROR:
      case ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT:
        if (context) {
          const level = hls.loadLevelObj;
          if (
            level &&
            ((context.type === PlaylistContextType.AUDIO_TRACK &&
              level.hasAudioGroup(context.groupId)) ||
              (context.type === PlaylistContextType.SUBTITLE_TRACK &&
                level.hasSubtitleGroup(context.groupId)))
          ) {
            // Perform Pathway switch or Redundant failover if possible for fastest recovery
            // otherwise allow playlist retry count to reach max error retries
            data.errorAction = this.getPlaylistRetryOrSwitchAction(
              data,
              hls.loadLevel,
            );
            data.errorAction.action =
              NetworkErrorAction.SendAlternateToPenaltyBox;
            data.errorAction.flags =
              ErrorActionFlags.MoveAllAlternatesMatchingHost;
            return;
          }
        }
        return;
      case ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED:
        {
          const level = hls.loadLevelObj;
          const restrictedHdcpLevel = level?.attrs['HDCP-LEVEL'];
          if (restrictedHdcpLevel) {
            data.errorAction = {
              action: NetworkErrorAction.SendAlternateToPenaltyBox,
              flags: ErrorActionFlags.MoveAllAlternatesMatchingHDCP,
              hdcpLevel: restrictedHdcpLevel,
            };
          } else {
            this.keySystemError(data);
          }
        }
        return;
      case ErrorDetails.BUFFER_ADD_CODEC_ERROR:
      case ErrorDetails.REMUX_ALLOC_ERROR:
      case ErrorDetails.BUFFER_APPEND_ERROR:
        // Buffer-controller can set errorAction when append errors can be ignored or resolved locally
        if (!data.errorAction) {
          data.errorAction = this.getLevelSwitchAction(
            data,
            data.level ?? hls.loadLevel,
          );
        }
        return;
      case ErrorDetails.INTERNAL_EXCEPTION:
      case ErrorDetails.BUFFER_APPENDING_ERROR:
      case ErrorDetails.BUFFER_FULL_ERROR:
      case ErrorDetails.LEVEL_SWITCH_ERROR:
      case ErrorDetails.BUFFER_STALLED_ERROR:
      case ErrorDetails.BUFFER_SEEK_OVER_HOLE:
      case ErrorDetails.BUFFER_NUDGE_ON_STALL:
        data.errorAction = createDoNothingErrorAction();
        return;
    }

    if (data.type === ErrorTypes.KEY_SYSTEM_ERROR) {
      this.keySystemError(data);
    }
  }

  private keySystemError(data: ErrorData) {
    const levelIndex = this.getVariantLevelIndex(data.frag);
    // Do not retry level. Escalate to fatal if switching levels fails.
    data.levelRetry = false;
    data.errorAction = this.getLevelSwitchAction(data, levelIndex);
  }

  private getPlaylistRetryOrSwitchAction(
    data: ErrorData,
    levelIndex: number | null | undefined,
  ): IErrorAction {
    const hls = this.hls;
    const retryConfig = getRetryConfig(hls.config.playlistLoadPolicy, data);
    const retryCount = this.playlistError++;
    const retry = shouldRetry(
      retryConfig,
      retryCount,
      isTimeoutError(data),
      data.response,
    );
    if (retry) {
      return {
        action: NetworkErrorAction.RetryRequest,
        flags: ErrorActionFlags.None,
        retryConfig,
        retryCount,
      };
    }
    const errorAction = this.getLevelSwitchAction(data, levelIndex);
    if (retryConfig) {
      errorAction.retryConfig = retryConfig;
      errorAction.retryCount = retryCount;
    }
    return errorAction;
  }

  private getFragRetryOrSwitchAction(data: ErrorData): IErrorAction {
    const hls = this.hls;
    // Share fragment error count accross media options (main, audio, subs)
    // This allows for level based rendition switching when media option assets fail
    const variantLevelIndex = this.getVariantLevelIndex(data.frag);
    const level = hls.levels[variantLevelIndex];
    const { fragLoadPolicy, keyLoadPolicy } = hls.config;
    const retryConfig = getRetryConfig(
      data.details.startsWith('key') ? keyLoadPolicy : fragLoadPolicy,
      data,
    );
    const fragmentErrors = hls.levels.reduce(
      (acc, level) => acc + level.fragmentError,
      0,
    );
    // Switch levels when out of retried or level index out of bounds
    if (level) {
      if (data.details !== ErrorDetails.FRAG_GAP) {
        level.fragmentError++;
      }
      const retry = shouldRetry(
        retryConfig,
        fragmentErrors,
        isTimeoutError(data),
        data.response,
      );
      if (retry) {
        return {
          action: NetworkErrorAction.RetryRequest,
          flags: ErrorActionFlags.None,
          retryConfig,
          retryCount: fragmentErrors,
        };
      }
    }
    // Reach max retry count, or Missing level reference
    // Switch to valid index
    const errorAction = this.getLevelSwitchAction(data, variantLevelIndex);
    // Add retry details to allow skipping of FRAG_PARSING_ERROR
    if (retryConfig) {
      errorAction.retryConfig = retryConfig;
      errorAction.retryCount = fragmentErrors;
    }
    return errorAction;
  }

  private getLevelSwitchAction(
    data: ErrorData,
    levelIndex: number | null | undefined,
  ): IErrorAction {
    const hls = this.hls;
    if (levelIndex === null || levelIndex === undefined) {
      levelIndex = hls.loadLevel;
    }
    const level = this.hls.levels[levelIndex];
    if (level) {
      const errorDetails = data.details;
      level.loadError++;
      if (errorDetails === ErrorDetails.BUFFER_APPEND_ERROR) {
        level.fragmentError++;
      }
      // Search for next level to retry
      let nextLevel = -1;
      const { levels, loadLevel, minAutoLevel, maxAutoLevel } = hls;
      if (!hls.autoLevelEnabled && !hls.config.preserveManualLevelOnError) {
        hls.loadLevel = -1;
      }
      const fragErrorType = data.frag?.type;
      // Find alternate audio codec if available on audio codec error
      const isAudioCodecError =
        (fragErrorType === PlaylistLevelType.AUDIO &&
          errorDetails === ErrorDetails.FRAG_PARSING_ERROR) ||
        (data.sourceBufferName === 'audio' &&
          (errorDetails === ErrorDetails.BUFFER_ADD_CODEC_ERROR ||
            errorDetails === ErrorDetails.BUFFER_APPEND_ERROR));
      const findAudioCodecAlternate =
        isAudioCodecError &&
        levels.some(({ audioCodec }) => level.audioCodec !== audioCodec);
      // Find alternate video codec if available on video codec error
      const isVideoCodecError =
        data.sourceBufferName === 'video' &&
        (errorDetails === ErrorDetails.BUFFER_ADD_CODEC_ERROR ||
          errorDetails === ErrorDetails.BUFFER_APPEND_ERROR);
      const findVideoCodecAlternate =
        isVideoCodecError &&
        levels.some(
          ({ codecSet, audioCodec }) =>
            level.codecSet !== codecSet && level.audioCodec === audioCodec,
        );
      const { type: playlistErrorType, groupId: playlistErrorGroupId } =
        data.context ?? {};
      for (let i = levels.length; i--; ) {
        const candidate = (i + loadLevel) % levels.length;
        if (
          candidate !== loadLevel &&
          candidate >= minAutoLevel &&
          candidate <= maxAutoLevel &&
          levels[candidate].loadError === 0
        ) {
          const levelCandidate = levels[candidate];
          // Skip level switch if GAP tag is found in next level at same position
          if (
            errorDetails === ErrorDetails.FRAG_GAP &&
            fragErrorType === PlaylistLevelType.MAIN &&
            data.frag
          ) {
            const levelDetails = levels[candidate].details;
            if (levelDetails) {
              const fragCandidate = findFragmentByPTS(
                data.frag as MediaFragment,
                levelDetails.fragments,
                data.frag.start,
              );
              if (fragCandidate?.gap) {
                continue;
              }
            }
          } else if (
            (playlistErrorType === PlaylistContextType.AUDIO_TRACK &&
              levelCandidate.hasAudioGroup(playlistErrorGroupId)) ||
            (playlistErrorType === PlaylistContextType.SUBTITLE_TRACK &&
              levelCandidate.hasSubtitleGroup(playlistErrorGroupId))
          ) {
            // For audio/subs playlist errors find another group ID or fallthrough to redundant fail-over
            continue;
          } else if (
            (fragErrorType === PlaylistLevelType.AUDIO &&
              level.audioGroups?.some((groupId) =>
                levelCandidate.hasAudioGroup(groupId),
              )) ||
            (fragErrorType === PlaylistLevelType.SUBTITLE &&
              level.subtitleGroups?.some((groupId) =>
                levelCandidate.hasSubtitleGroup(groupId),
              )) ||
            (findAudioCodecAlternate &&
              level.audioCodec === levelCandidate.audioCodec) ||
            (findVideoCodecAlternate &&
              level.codecSet === levelCandidate.codecSet) ||
            (!findAudioCodecAlternate &&
              level.codecSet !== levelCandidate.codecSet)
          ) {
            // For video/audio/subs frag errors find another group ID or fallthrough to redundant fail-over
            continue;
          }
          nextLevel = candidate;
          break;
        }
      }
      if (nextLevel > -1 && hls.loadLevel !== nextLevel) {
        data.levelRetry = true;
        this.playlistError = 0;
        return {
          action: NetworkErrorAction.SendAlternateToPenaltyBox,
          flags: ErrorActionFlags.None,
          nextAutoLevel: nextLevel,
        };
      }
    }
    // No levels to switch / Manual level selection / Level not found
    // Resolve with Pathway switch, Redundant fail-over, or stay on lowest Level
    return {
      action: NetworkErrorAction.SendAlternateToPenaltyBox,
      flags: ErrorActionFlags.MoveAllAlternatesMatchingHost,
    };
  }

  public onErrorOut(event: Events.ERROR, data: ErrorData) {
    switch (data.errorAction?.action) {
      case NetworkErrorAction.DoNothing:
        break;
      case NetworkErrorAction.SendAlternateToPenaltyBox:
        this.sendAlternateToPenaltyBox(data);
        if (
          !data.errorAction.resolved &&
          data.details !== ErrorDetails.FRAG_GAP
        ) {
          data.fatal = true;
        } else if (/MediaSource readyState: ended/.test(data.error.message)) {
          this.warn(
            `MediaSource ended after "${data.sourceBufferName}" sourceBuffer append error. Attempting to recover from media error.`,
          );
          this.hls.recoverMediaError();
        }
        break;
      case NetworkErrorAction.RetryRequest:
        // handled by stream and playlist/level controllers
        break;
    }

    if (data.fatal) {
      this.hls.stopLoad();
      return;
    }
  }

  private sendAlternateToPenaltyBox(data: ErrorData) {
    const hls = this.hls;
    const errorAction = data.errorAction;
    if (!errorAction) {
      return;
    }
    const { flags, hdcpLevel, nextAutoLevel } = errorAction;

    switch (flags) {
      case ErrorActionFlags.None:
        this.switchLevel(data, nextAutoLevel);
        break;
      case ErrorActionFlags.MoveAllAlternatesMatchingHDCP:
        if (hdcpLevel) {
          hls.maxHdcpLevel = HdcpLevels[HdcpLevels.indexOf(hdcpLevel) - 1];
          errorAction.resolved = true;
        }
        this.warn(
          `Restricting playback to HDCP-LEVEL of "${hls.maxHdcpLevel}" or lower`,
        );
        break;
    }
    // If not resolved by previous actions try to switch to next level
    if (!errorAction.resolved) {
      this.switchLevel(data, nextAutoLevel);
    }
  }

  private switchLevel(data: ErrorData, levelIndex: number | undefined) {
    if (levelIndex !== undefined && data.errorAction) {
      this.warn(`switching to level ${levelIndex} after ${data.details}`);
      this.hls.nextAutoLevel = levelIndex;
      data.errorAction.resolved = true;
      // Stream controller is responsible for this but won't switch on false start
      this.hls.nextLoadLevel = this.hls.nextAutoLevel;
      if (
        data.details === ErrorDetails.BUFFER_ADD_CODEC_ERROR &&
        data.mimeType &&
        data.sourceBufferName !== 'audiovideo'
      ) {
        const codec = getCodecsForMimeType(data.mimeType);
        const levels = this.hls.levels;
        for (let i = levels.length; i--; ) {
          if (levels[i][`${data.sourceBufferName}Codec`] === codec) {
            this.hls.removeLevel(i);
          }
        }
      }
    }
  }
}

export function createDoNothingErrorAction(resolved?: boolean): IErrorAction {
  const errorAction: IErrorAction = {
    action: NetworkErrorAction.DoNothing,
    flags: ErrorActionFlags.None,
  };
  if (resolved) {
    errorAction.resolved = true;
  }
  return errorAction;
}
