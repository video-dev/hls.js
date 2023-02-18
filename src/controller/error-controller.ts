import { Events } from '../events';
import { ErrorDetails, ErrorTypes } from '../errors';
import { PlaylistContextType, PlaylistLevelType } from '../types/loader';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import type { ErrorData } from '../types/events';
import type { Fragment } from '../loader/fragment';
import { HdcpLevel, HdcpLevels } from '../types/level';

export default class ErrorController {
  private readonly hls: Hls;
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

  private onError(event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      return;
    }
    const hls = this.hls;
    const context = data.context;
    const level = hls.levels[hls.loadLevel];

    switch (data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        {
          // Share fragment error count accross media options (main, audio, subs)
          // This allows for level based rendition switching when media option assets fail
          const variantLevelIndex = this.getVariantLevelIndex(data.frag);
          const level = hls.levels[variantLevelIndex];
          // Switch levels when out of retried or level index out of bounds
          if (level) {
            const { fragLoadPolicy, keyLoadPolicy } = hls.config;
            const isTimeout =
              data.details === ErrorDetails.FRAG_LOAD_TIMEOUT ||
              data.details === ErrorDetails.KEY_LOAD_TIMEOUT;
            const retryConfig = (
              data.details.startsWith('key') ? keyLoadPolicy : fragLoadPolicy
            ).default[`${isTimeout ? 'timeout' : 'error'}Retry`];
            const fragmentErrors = hls.levels.reduce(
              (acc, level) => acc + level.fragmentError,
              0
            );
            const retry =
              !!retryConfig && fragmentErrors < retryConfig.maxNumRetry;
            if (!retry) {
              this.levelSwitch(data, variantLevelIndex);
            }
          } else {
            this.levelSwitch(data, variantLevelIndex);
          }
        }
        return;
      case ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED:
        {
          const restrictedHdcpLevel = level?.attrs['HDCP-LEVEL'];
          if (restrictedHdcpLevel) {
            hls.maxHdcpLevel =
              HdcpLevels[
                HdcpLevels.indexOf(restrictedHdcpLevel as HdcpLevel) - 1
              ];
            this.warn(
              `Restricting playback to HDCP-LEVEL of "${hls.maxHdcpLevel}" or lower`
            );
          }
        }
        break;
      case ErrorDetails.FRAG_PARSING_ERROR:
      case ErrorDetails.FRAG_DECRYPT_ERROR: {
        const levelIndex = this.getVariantLevelIndex(data.frag);
        // Switch level if possible, otherwise allow retry count to reach max error retries
        this.levelSwitch(data, levelIndex);
        return;
      }
      case ErrorDetails.REMUX_ALLOC_ERROR:
        this.levelSwitch(data, data.level ?? hls.loadLevel);
        return;
      case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
      case ErrorDetails.SUBTITLE_LOAD_ERROR:
      case ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT:
        // Switch to redundant level when track fails to load
        if (
          context &&
          level &&
          ((context.type === PlaylistContextType.AUDIO_TRACK &&
            level.audioGroupIds &&
            context.groupId === level.audioGroupIds[level.urlId]) ||
            (context.type === PlaylistContextType.SUBTITLE_TRACK &&
              level.textGroupIds &&
              context.groupId === level.textGroupIds[level.urlId]))
        ) {
          this.redundantFailover(hls.loadLevel);
          return;
        }
        return;
    }

    if (data.type === ErrorTypes.KEY_SYSTEM_ERROR) {
      const levelIndex = this.getVariantLevelIndex(data.frag);
      // Do not retry level. Escalate to fatal if switching levels fails.
      data.levelRetry = false;
      this.levelSwitch(data, levelIndex);
      return;
    }
  }

  public onErrorOut(event: Events.ERROR, data: ErrorData) {
    const hls = this.hls;

    if (!data.fatal) {
      const context = data.context;

      switch (data.details) {
        case ErrorDetails.LEVEL_EMPTY_ERROR:
        case ErrorDetails.LEVEL_PARSING_ERROR:
          if (!data.levelRetry) {
            const levelIndex =
              data.parent === PlaylistLevelType.MAIN
                ? (data.level as number)
                : hls.loadLevel;
            this.levelSwitch(data, levelIndex);
          }
          break;
        case ErrorDetails.LEVEL_LOAD_ERROR:
        case ErrorDetails.LEVEL_LOAD_TIMEOUT:
          if (!data.levelRetry) {
            // Do not perform level switch if an error occurred using delivery directives
            // Attempt to reload level without directives first
            if (context && !context.deliveryDirectives) {
              this.levelSwitch(data, context.level);
            }
          }
          break;
        case ErrorDetails.FRAG_PARSING_ERROR:
        case ErrorDetails.FRAG_DECRYPT_ERROR:
        case ErrorDetails.FRAG_LOAD_ERROR:
        case ErrorDetails.FRAG_LOAD_TIMEOUT:
        case ErrorDetails.KEY_LOAD_ERROR:
        case ErrorDetails.KEY_LOAD_TIMEOUT:
          if (data.levelRetry === false) {
            data.fatal = true;
          }
      }
    }

    if (data.fatal) {
      hls.stopLoad();
      return;
    }

    this.hls.nextLoadLevel = this.hls.nextAutoLevel;
  }

  private levelSwitch(
    errorEvent: ErrorData,
    levelIndex: number | null | undefined
  ): void {
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
        errorEvent.levelRetry = true;
        this.redundantFailover(levelIndex);
        return;
      }

      if (hls.autoLevelEnabled) {
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
          this.warn(`${errorEvent.details}: switching to level ${nextLevel}`);
          errorEvent.levelRetry = true;
          this.hls.nextAutoLevel = nextLevel;
        } else if (errorEvent.levelRetry === false) {
          // No levels to switch to and no more retries
          // TODO: switch pathways first
          errorEvent.fatal = true;
        }
      } else {
        // TODO: switch pathways in manual level mode
      }
    }
  }

  private redundantFailover(levelIndex: number) {
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
      hls.levels.forEach((lv) => {
        lv.urlId = newUrlId;
      });
      hls.nextLoadLevel = levelIndex;
    }
  }

  private getVariantLevelIndex(frag: Fragment | undefined): number {
    return frag?.type === PlaylistLevelType.MAIN
      ? frag.level
      : this.hls.loadLevel;
  }
}
