import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';
import { Events } from '../events';
import { BufferHelper } from '../utils/buffer-helper';
import { ErrorDetails } from '../errors';
import { PlaylistLevelType } from '../types/loader';
import { logger } from '../utils/logger';
import type { Bufferable } from '../utils/buffer-helper';
import type { Fragment } from '../loader/fragment';
import type { Part } from '../loader/fragment';
import type { LoaderStats } from '../types/loader';
import type Hls from '../hls';
import type {
  FragLoadingData,
  FragLoadedData,
  FragBufferedData,
  ErrorData,
  LevelLoadedData,
} from '../types/events';
import type { ComponentAPI } from '../types/component-api';

class AbrController implements ComponentAPI {
  protected hls: Hls;
  private lastLoadedFragLevel: number = 0;
  private _nextAutoLevel: number = -1;
  private timer?: number;
  private onCheck: Function = this._abandonRulesCheck.bind(this);
  private fragCurrent: Fragment | null = null;
  private partCurrent: Part | null = null;
  private bitrateTestDelay: number = 0;

  public readonly bwEstimator: EwmaBandWidthEstimator;

  constructor(hls: Hls) {
    this.hls = hls;

    const config = hls.config;
    this.bwEstimator = new EwmaBandWidthEstimator(
      config.abrEwmaSlowVoD,
      config.abrEwmaFastVoD,
      config.abrEwmaDefaultEstimate
    );

    this.registerListeners();
  }

  protected registerListeners() {
    const { hls } = this;
    hls.on(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  protected unregisterListeners() {
    const { hls } = this;
    hls.off(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy() {
    this.unregisterListeners();
    this.clearTimer();
    // @ts-ignore
    this.hls = this.onCheck = null;
    this.fragCurrent = this.partCurrent = null;
  }

  protected onFragLoading(event: Events.FRAG_LOADING, data: FragLoadingData) {
    const frag = data.frag;
    if (frag.type === PlaylistLevelType.MAIN) {
      if (!this.timer) {
        this.fragCurrent = frag;
        this.partCurrent = data.part ?? null;
        this.timer = self.setInterval(this.onCheck, 100);
      }
    }
  }

  protected onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    const config = this.hls.config;
    if (data.details.live) {
      this.bwEstimator.update(config.abrEwmaSlowLive, config.abrEwmaFastLive);
    } else {
      this.bwEstimator.update(config.abrEwmaSlowVoD, config.abrEwmaFastVoD);
    }
  }

  /*
      This method monitors the download rate of the current fragment, and will downswitch if that fragment will not load
      quickly enough to prevent underbuffering
    */
  private _abandonRulesCheck() {
    const { fragCurrent: frag, partCurrent: part, hls } = this;
    const { autoLevelEnabled, config, media } = hls;
    if (!frag || !media) {
      return;
    }

    const stats: LoaderStats = part ? part.stats : frag.stats;
    const duration = part ? part.duration : frag.duration;
    // If loading has been aborted and not in lowLatencyMode, stop timer and return
    if (stats.aborted) {
      logger.warn('frag loader destroy or aborted, disarm abandonRules');
      this.clearTimer();
      // reset forced auto level value so that next level will be selected
      this._nextAutoLevel = -1;
      return;
    }

    // This check only runs if we're in ABR mode and actually playing
    if (
      !autoLevelEnabled ||
      media.paused ||
      !media.playbackRate ||
      !media.readyState
    ) {
      return;
    }

    const requestDelay = performance.now() - stats.loading.start;
    const playbackRate = Math.abs(media.playbackRate);
    // In order to work with a stable bandwidth, only begin monitoring bandwidth after half of the fragment has been loaded
    if (requestDelay <= (500 * duration) / playbackRate) {
      return;
    }

    const { levels, minAutoLevel } = hls;
    const level = levels[frag.level];
    const expectedLen =
      stats.total ||
      Math.max(stats.loaded, Math.round((duration * level.maxBitrate) / 8));
    const loadRate = Math.max(
      1,
      stats.bwEstimate
        ? stats.bwEstimate / 8
        : (stats.loaded * 1000) / requestDelay
    );
    // fragLoadDelay is an estimate of the time (in seconds) it will take to buffer the entire fragment
    const fragLoadedDelay = (expectedLen - stats.loaded) / loadRate;

    const pos = media.currentTime;
    // bufferStarvationDelay is an estimate of the amount time (in seconds) it will take to exhaust the buffer
    const bufferStarvationDelay =
      (BufferHelper.bufferInfo(media, pos, config.maxBufferHole).end - pos) /
      playbackRate;

    // Attempt an emergency downswitch only if less than 2 fragment lengths are buffered, and the time to finish loading
    // the current fragment is greater than the amount of buffer we have left
    if (
      bufferStarvationDelay >= (2 * duration) / playbackRate ||
      fragLoadedDelay <= bufferStarvationDelay
    ) {
      return;
    }

    let fragLevelNextLoadedDelay: number = Number.POSITIVE_INFINITY;
    let nextLoadLevel: number;
    // Iterate through lower level and try to find the largest one that avoids rebuffering
    for (
      nextLoadLevel = frag.level - 1;
      nextLoadLevel > minAutoLevel;
      nextLoadLevel--
    ) {
      // compute time to load next fragment at lower level
      // 0.8 : consider only 80% of current bw to be conservative
      // 8 = bits per byte (bps/Bps)
      const levelNextBitrate = levels[nextLoadLevel].maxBitrate;
      fragLevelNextLoadedDelay =
        (duration * levelNextBitrate) / (8 * 0.8 * loadRate);

      if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
        break;
      }
    }
    // Only emergency switch down if it takes less time to load a new fragment at lowest level instead of continuing
    // to load the current one
    if (fragLevelNextLoadedDelay >= fragLoadedDelay) {
      return;
    }
    const bwEstimate: number = this.bwEstimator.getEstimate();
    logger.warn(`Fragment ${frag.sn}${
      part ? ' part ' + part.index : ''
    } of level ${
      frag.level
    } is loading too slowly and will cause an underbuffer; aborting and switching to level ${nextLoadLevel}
      Current BW estimate: ${
        Number.isFinite(bwEstimate) ? (bwEstimate / 1024).toFixed(3) : 'Unknown'
      } Kb/s
      Estimated load time for current fragment: ${fragLoadedDelay.toFixed(3)} s
      Estimated load time for the next fragment: ${fragLevelNextLoadedDelay.toFixed(
        3
      )} s
      Time to underbuffer: ${bufferStarvationDelay.toFixed(3)} s`);
    hls.nextLoadLevel = nextLoadLevel;
    this.bwEstimator.sample(requestDelay, stats.loaded);
    this.clearTimer();
    if (frag.loader) {
      this.fragCurrent = this.partCurrent = null;
      frag.loader.abort();
    }
    hls.trigger(Events.FRAG_LOAD_EMERGENCY_ABORTED, { frag, part, stats });
  }

  protected onFragLoaded(
    event: Events.FRAG_LOADED,
    { frag, part }: FragLoadedData
  ) {
    if (
      frag.type === PlaylistLevelType.MAIN &&
      Number.isFinite(frag.sn as number)
    ) {
      const stats = part ? part.stats : frag.stats;
      const duration = part ? part.duration : frag.duration;
      // stop monitoring bw once frag loaded
      this.clearTimer();
      // store level id after successful fragment load
      this.lastLoadedFragLevel = frag.level;
      // reset forced auto level value so that next level will be selected
      this._nextAutoLevel = -1;

      // compute level average bitrate
      if (this.hls.config.abrMaxWithRealBitrate) {
        const level = this.hls.levels[frag.level];
        const loadedBytes =
          (level.loaded ? level.loaded.bytes : 0) + stats.loaded;
        const loadedDuration =
          (level.loaded ? level.loaded.duration : 0) + duration;
        level.loaded = { bytes: loadedBytes, duration: loadedDuration };
        level.realBitrate = Math.round((8 * loadedBytes) / loadedDuration);
      }
      if (frag.bitrateTest) {
        const fragBufferedData: FragBufferedData = {
          stats,
          frag,
          part,
          id: frag.type,
        };
        this.onFragBuffered(Events.FRAG_BUFFERED, fragBufferedData);
        frag.bitrateTest = false;
      }
    }
  }

  protected onFragBuffered(
    event: Events.FRAG_BUFFERED,
    data: FragBufferedData
  ) {
    const { frag, part } = data;
    const stats = part ? part.stats : frag.stats;

    if (stats.aborted) {
      return;
    }
    // Only count non-alt-audio frags which were actually buffered in our BW calculations
    if (frag.type !== PlaylistLevelType.MAIN || frag.sn === 'initSegment') {
      return;
    }
    // Use the difference between parsing and request instead of buffering and request to compute fragLoadingProcessing;
    // rationale is that buffer appending only happens once media is attached. This can happen when config.startFragPrefetch
    // is used. If we used buffering in that case, our BW estimate sample will be very large.
    const processingMs = stats.parsing.end - stats.loading.start;
    this.bwEstimator.sample(processingMs, stats.loaded);
    stats.bwEstimate = this.bwEstimator.getEstimate();
    if (frag.bitrateTest) {
      this.bitrateTestDelay = processingMs / 1000;
    } else {
      this.bitrateTestDelay = 0;
    }
  }

  protected onError(event: Events.ERROR, data: ErrorData) {
    // stop timer in case of frag loading error
    switch (data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
        this.clearTimer();
        break;
      default:
        break;
    }
  }

  clearTimer() {
    self.clearInterval(this.timer);
    this.timer = undefined;
  }

  // return next auto level
  get nextAutoLevel() {
    const forcedAutoLevel = this._nextAutoLevel;
    const bwEstimator = this.bwEstimator;
    // in case next auto level has been forced, and bw not available or not reliable, return forced value
    if (
      forcedAutoLevel !== -1 &&
      (!bwEstimator || !bwEstimator.canEstimate())
    ) {
      return forcedAutoLevel;
    }

    // compute next level using ABR logic
    let nextABRAutoLevel = this.getNextABRAutoLevel();
    // if forced auto level has been defined, use it to cap ABR computed quality level
    if (forcedAutoLevel !== -1) {
      nextABRAutoLevel = Math.min(forcedAutoLevel, nextABRAutoLevel);
    }

    return nextABRAutoLevel;
  }

  private getNextABRAutoLevel() {
    const { fragCurrent, partCurrent, hls } = this;
    const { maxAutoLevel, config, minAutoLevel, media } = hls;
    const currentFragDuration = partCurrent
      ? partCurrent.duration
      : fragCurrent
      ? fragCurrent.duration
      : 0;
    const pos = media ? media.currentTime : 0;

    // playbackRate is the absolute value of the playback rate; if media.playbackRate is 0, we use 1 to load as
    // if we're playing back at the normal rate.
    const playbackRate =
      media && media.playbackRate !== 0 ? Math.abs(media.playbackRate) : 1.0;
    const avgbw = this.bwEstimator
      ? this.bwEstimator.getEstimate()
      : config.abrEwmaDefaultEstimate;
    // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
    const bufferStarvationDelay =
      (BufferHelper.bufferInfo(media as Bufferable, pos, config.maxBufferHole)
        .end -
        pos) /
      playbackRate;

    // First, look to see if we can find a level matching with our avg bandwidth AND that could also guarantee no rebuffering at all
    let bestLevel = this.findBestLevel(
      avgbw,
      minAutoLevel,
      maxAutoLevel,
      bufferStarvationDelay,
      config.abrBandWidthFactor,
      config.abrBandWidthUpFactor
    );
    if (bestLevel >= 0) {
      return bestLevel;
    }
    logger.trace(
      `${
        bufferStarvationDelay ? 'rebuffering expected' : 'buffer is empty'
      }, finding optimal quality level`
    );
    // not possible to get rid of rebuffering ... let's try to find level that will guarantee less than maxStarvationDelay of rebuffering
    // if no matching level found, logic will return 0
    let maxStarvationDelay = currentFragDuration
      ? Math.min(currentFragDuration, config.maxStarvationDelay)
      : config.maxStarvationDelay;
    let bwFactor = config.abrBandWidthFactor;
    let bwUpFactor = config.abrBandWidthUpFactor;

    if (!bufferStarvationDelay) {
      // in case buffer is empty, let's check if previous fragment was loaded to perform a bitrate test
      const bitrateTestDelay = this.bitrateTestDelay;
      if (bitrateTestDelay) {
        // if it is the case, then we need to adjust our max starvation delay using maxLoadingDelay config value
        // max video loading delay used in  automatic start level selection :
        // in that mode ABR controller will ensure that video loading time (ie the time to fetch the first fragment at lowest quality level +
        // the time to fetch the fragment at the appropriate quality level is less than ```maxLoadingDelay``` )
        // cap maxLoadingDelay and ensure it is not bigger 'than bitrate test' frag duration
        const maxLoadingDelay = currentFragDuration
          ? Math.min(currentFragDuration, config.maxLoadingDelay)
          : config.maxLoadingDelay;
        maxStarvationDelay = maxLoadingDelay - bitrateTestDelay;
        logger.trace(
          `bitrate test took ${Math.round(
            1000 * bitrateTestDelay
          )}ms, set first fragment max fetchDuration to ${Math.round(
            1000 * maxStarvationDelay
          )} ms`
        );
        // don't use conservative factor on bitrate test
        bwFactor = bwUpFactor = 1;
      }
    }
    bestLevel = this.findBestLevel(
      avgbw,
      minAutoLevel,
      maxAutoLevel,
      bufferStarvationDelay + maxStarvationDelay,
      bwFactor,
      bwUpFactor
    );
    return Math.max(bestLevel, 0);
  }

  private findBestLevel(
    currentBw: number,
    minAutoLevel: number,
    maxAutoLevel: number,
    maxFetchDuration: number,
    bwFactor: number,
    bwUpFactor: number
  ): number {
    const {
      fragCurrent,
      partCurrent,
      lastLoadedFragLevel: currentLevel,
    } = this;
    const { levels } = this.hls;
    const level = levels[currentLevel];
    const live = !!level?.details?.live;
    const currentCodecSet = level?.codecSet;

    const currentFragDuration = partCurrent
      ? partCurrent.duration
      : fragCurrent
      ? fragCurrent.duration
      : 0;
    for (let i = maxAutoLevel; i >= minAutoLevel; i--) {
      const levelInfo = levels[i];

      if (
        !levelInfo ||
        (currentCodecSet && levelInfo.codecSet !== currentCodecSet)
      ) {
        continue;
      }

      const levelDetails = levelInfo.details;
      const avgDuration =
        (partCurrent
          ? levelDetails?.partTarget
          : levelDetails?.averagetargetduration) || currentFragDuration;

      let adjustedbw: number;
      // follow algorithm captured from stagefright :
      // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
      // Pick the highest bandwidth stream below or equal to estimated bandwidth.
      // consider only 80% of the available bandwidth, but if we are switching up,
      // be even more conservative (70%) to avoid overestimating and immediately
      // switching back.
      if (i <= currentLevel) {
        adjustedbw = bwFactor * currentBw;
      } else {
        adjustedbw = bwUpFactor * currentBw;
      }

      const bitrate: number = levels[i].maxBitrate;
      const fetchDuration: number = (bitrate * avgDuration) / adjustedbw;

      logger.trace(
        `level/adjustedbw/bitrate/avgDuration/maxFetchDuration/fetchDuration: ${i}/${Math.round(
          adjustedbw
        )}/${bitrate}/${avgDuration}/${maxFetchDuration}/${fetchDuration}`
      );
      // if adjusted bw is greater than level bitrate AND
      if (
        adjustedbw > bitrate &&
        // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
        // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
        // special case to support startLevel = -1 (bitrateTest) on live streams : in that case we should not exit loop so that findBestLevel will return -1
        (!fetchDuration ||
          (live && !this.bitrateTestDelay) ||
          fetchDuration < maxFetchDuration)
      ) {
        // as we are looping from highest to lowest, this will return the best achievable quality level
        return i;
      }
    }
    // not enough time budget even with quality level 0 ... rebuffering might happen
    return -1;
  }

  set nextAutoLevel(nextLevel) {
    this._nextAutoLevel = nextLevel;
  }
}

export default AbrController;
