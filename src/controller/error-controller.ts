import { Events } from '../events';
import { ErrorDetails, ErrorTypes } from '../errors';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import {
  getRetryConfig,
  isTimeoutError,
  shouldRetry,
} from '../utils/error-helper';
import { HdcpLevel, HdcpLevels } from '../types/level';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import type { RetryConfig } from '../config';
import type { NetworkComponentAPI } from '../types/component-api';
import type { ErrorData } from '../types/events';
import type { Fragment } from '../loader/fragment';

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

export default class ErrorController implements NetworkComponentAPI {
  private readonly hls: Hls;
  private playlistError: number = 0;
  private log: (msg: any) => void;
  private warn: (msg: any) => void;
  private error: (msg: any) => void;

  constructor(hls: Hls) {
    this.hls = hls;
    this.log = logger.log.bind(logger, `[info]:`);
    this.warn = logger.warn.bind(logger, `[warning]:`);
    this.error = logger.error.bind(logger, `[error]:`);
    this.registerListeners();
  }

  private registerListeners() {
    this.hls.on(Events.ERROR, this.onError, this);
  }

  private unregisterListeners() {
    this.hls.off(Events.ERROR, this.onError, this);
    this.hls.off(Events.ERROR, this.onErrorOut, this);
  }

  destroy() {
    this.unregisterListeners();
    // @ts-ignore
    this.hls = null;
  }

  startLoad(startPosition: number): void {
    this.playlistError = 0;
  }

  stopLoad(): void {}

  private getVariantLevelIndex(frag: Fragment | undefined): number {
    return frag?.type === PlaylistLevelType.MAIN
      ? frag.level
      : this.hls.loadLevel;
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
              levelIndex
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
            context.level
          );
        }
        return;
      case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
      case ErrorDetails.SUBTITLE_LOAD_ERROR:
      case ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT:
        if (context) {
          const level = hls.levels[hls.loadLevel];
          if (
            level &&
            ((context.type === PlaylistContextType.AUDIO_TRACK &&
              level.audioGroupIds &&
              context.groupId === level.audioGroupIds[level.urlId]) ||
              (context.type === PlaylistContextType.SUBTITLE_TRACK &&
                level.textGroupIds &&
                context.groupId === level.textGroupIds[level.urlId]))
          ) {
            // Perform Pathway switch or Redundant failover if possible for fastest recovery
            // otherwise allow playlist retry count to reach max error retries
            data.errorAction = this.getPlaylistRetryOrSwitchAction(
              data,
              hls.loadLevel
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
          const level = hls.levels[hls.loadLevel];
          const restrictedHdcpLevel = level?.attrs['HDCP-LEVEL'];
          if (restrictedHdcpLevel) {
            data.errorAction = {
              action: NetworkErrorAction.SendAlternateToPenaltyBox,
              flags: ErrorActionFlags.MoveAllAlternatesMatchingHDCP,
              hdcpLevel: restrictedHdcpLevel,
            };
          }
        }
        return;
      case ErrorDetails.BUFFER_ADD_CODEC_ERROR:
      case ErrorDetails.REMUX_ALLOC_ERROR:
        data.errorAction = this.getLevelSwitchAction(
          data,
          data.level ?? hls.loadLevel
        );
        return;
      case ErrorDetails.INTERNAL_EXCEPTION:
      case ErrorDetails.BUFFER_APPENDING_ERROR:
      case ErrorDetails.BUFFER_APPEND_ERROR:
      case ErrorDetails.BUFFER_FULL_ERROR:
      case ErrorDetails.LEVEL_SWITCH_ERROR:
      case ErrorDetails.BUFFER_STALLED_ERROR:
      case ErrorDetails.BUFFER_SEEK_OVER_HOLE:
      case ErrorDetails.BUFFER_NUDGE_ON_STALL:
        data.errorAction = {
          action: NetworkErrorAction.DoNothing,
          flags: ErrorActionFlags.None,
        };
        return;
    }

    if (data.type === ErrorTypes.KEY_SYSTEM_ERROR) {
      const levelIndex = this.getVariantLevelIndex(data.frag);
      // Do not retry level. Escalate to fatal if switching levels fails.
      data.levelRetry = false;
      data.errorAction = this.getLevelSwitchAction(data, levelIndex);
      return;
    }
  }

  private getPlaylistRetryOrSwitchAction(
    data: ErrorData,
    levelIndex: number | null | undefined
  ): IErrorAction {
    const hls = this.hls;
    const retryConfig = getRetryConfig(hls.config.playlistLoadPolicy, data);
    const retryCount = this.playlistError++;
    const httpStatus = data.response?.code;
    const retry = shouldRetry(
      retryConfig,
      retryCount,
      isTimeoutError(data),
      httpStatus
    );
    if (retry) {
      return {
        action: NetworkErrorAction.RetryRequest,
        flags: ErrorActionFlags.None,
        retryConfig,
        retryCount,
      };
    }
    // Do not perform level switch if an error occurred using delivery directives
    // Allow reload without directives (handled in playlist-loader)
    if (data.context?.deliveryDirectives) {
      return {
        action: NetworkErrorAction.DoNothing,
        flags: ErrorActionFlags.None,
        retryConfig: retryConfig || {
          maxNumRetry: 0,
          retryDelayMs: 0,
          maxRetryDelayMs: 0,
        },
        retryCount,
      };
    }
    return this.getLevelSwitchAction(data, levelIndex);
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
      data
    );
    const fragmentErrors = hls.levels.reduce(
      (acc, level) => acc + level.fragmentError,
      0
    );
    // Switch levels when out of retried or level index out of bounds
    if (level) {
      level.fragmentError++;
      const httpStatus = data.response?.code;
      const retry = shouldRetry(
        retryConfig,
        fragmentErrors,
        isTimeoutError(data),
        httpStatus
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
    levelIndex: number | null | undefined
  ): IErrorAction {
    const hls = this.hls;
    if (levelIndex === null || levelIndex === undefined) {
      levelIndex = hls.loadLevel;
    }
    const level = this.hls.levels[levelIndex];
    if (level) {
      level.loadError++;
      const redundantLevels = level.url.length;
      // Try redundant fail-over until level.loadError reaches redundantLevels
      if (redundantLevels > 1 && level.loadError < redundantLevels) {
        data.levelRetry = true;
      } else if (hls.autoLevelEnabled) {
        // Search for next level to retry
        let nextLevel = -1;
        const levels = hls.levels;
        for (let i = levels.length; i--; ) {
          const candidate = (i + hls.loadLevel) % levels.length;
          if (
            candidate !== hls.loadLevel &&
            levels[candidate].loadError === 0
          ) {
            nextLevel = candidate;
            break;
          }
        }
        if (nextLevel > -1 && hls.loadLevel !== nextLevel) {
          data.levelRetry = true;
          return {
            action: NetworkErrorAction.SendAlternateToPenaltyBox,
            flags: ErrorActionFlags.None,
            nextAutoLevel: nextLevel,
          };
        }
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
        if (!data.errorAction.resolved) {
          data.fatal = true;
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
      case ErrorActionFlags.MoveAllAlternatesMatchingHost:
        {
          const levelIndex =
            data.parent === PlaylistLevelType.MAIN
              ? (data.level as number)
              : hls.loadLevel;
          // Handle Redundant Levels here. Patway switching is handled by content-steering-controller
          if (!errorAction.resolved) {
            errorAction.resolved = this.redundantFailover(levelIndex);
          }
        }
        break;
      case ErrorActionFlags.MoveAllAlternatesMatchingHDCP:
        if (hdcpLevel) {
          hls.maxHdcpLevel = HdcpLevels[HdcpLevels.indexOf(hdcpLevel) - 1];
          errorAction.resolved = true;
        }
        this.warn(
          `Restricting playback to HDCP-LEVEL of "${hls.maxHdcpLevel}" or lower`
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
      this.warn(`${data.details}: switching to level ${levelIndex}`);
      this.hls.nextAutoLevel = levelIndex;
      data.errorAction.resolved = true;
      // Stream controller is responsible for this but won't switch on false start
      this.hls.nextLoadLevel = this.hls.nextAutoLevel;
    }
  }

  private redundantFailover(levelIndex: number): boolean {
    const hls = this.hls;
    const level = hls.levels[levelIndex];
    const redundantLevels = level.url.length;
    if (redundantLevels > 1) {
      // Update the url id of all levels so that we stay on the same set of variants when level switching
      const newUrlId = (level.urlId + 1) % redundantLevels;
      this.log(
        `Switching to Redundant Stream ${newUrlId + 1}/${redundantLevels}: "${
          level.url[newUrlId]
        }"`
      );
      this.playlistError = 0;
      hls.levels.forEach((lv) => {
        lv.urlId = newUrlId;
      });
      hls.nextLoadLevel = levelIndex;
      return true;
    }
    return false;
  }
}
