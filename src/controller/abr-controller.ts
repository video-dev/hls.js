import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';
import { Events } from '../events';
import { PlaylistLevelType } from '../types/loader';
import { logger } from '../utils/logger';
import type { Fragment } from '../loader/fragment';
import type { Part } from '../loader/fragment';
import type { LoaderStats } from '../types/loader';
import type Hls from '../hls';
import type {
  FragLoadingData,
  FragLoadedData,
  FragBufferedData,
  LevelLoadedData,
  LevelSwitchingData,
} from '../types/events';
import type { AbrComponentAPI } from '../types/component-api';

class AbrController implements AbrComponentAPI {
  protected hls: Hls;
  private lastLevelLoadSec: number = 0;
  private lastLoadedFragLevel: number = 0;
  private _nextAutoLevel: number = -1;
  private timer: number = -1;
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
    hls.on(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
  }

  protected unregisterListeners() {
    const { hls } = this;
    hls.off(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.off(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
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
    if (this.ignoreFragment(frag)) {
      return;
    }
    this.fragCurrent = frag;
    this.partCurrent = data.part ?? null;
    this.clearTimer();
    this.timer = self.setInterval(this.onCheck, 100);
  }

  protected onLevelSwitching(
    event: Events.LEVEL_SWITCHING,
    data: LevelSwitchingData
  ): void {
    this.clearTimer();
  }

  private getTimeToLoadFrag(
    timeToFirstByteSec: number,
    bandwidth: number,
    fragSizeBits: number,
    isSwitch: boolean
  ) {
    const fragLoadSec = timeToFirstByteSec + fragSizeBits / bandwidth;
    const playlistLoadSec = isSwitch ? this.lastLevelLoadSec : 0;
    return fragLoadSec + playlistLoadSec;
  }

  protected onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    const config = this.hls.config;
    const { total, bwEstimate } = data.stats;
    // Total is the bytelength and bwEstimate in bits/sec
    if (Number.isFinite(total) && Number.isFinite(bwEstimate)) {
      this.lastLevelLoadSec = (8 * total) / bwEstimate;
    }
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
    const { autoLevelEnabled, media } = hls;
    if (!frag || !media) {
      return;
    }

    const now = performance.now();
    const stats: LoaderStats = part ? part.stats : frag.stats;
    const duration = part ? part.duration : frag.duration;
    const timeLoading = now - stats.loading.start;
    // If frag loading is aborted, complete, or from lowest level, stop timer and return
    if (
      stats.aborted ||
      (stats.loaded && stats.loaded === stats.total) ||
      frag.level === 0
    ) {
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

    const bufferInfo = hls.mainForwardBufferInfo;
    if (bufferInfo === null) {
      return;
    }

    const ttfbEstimate = this.bwEstimator.getEstimateTTFB();
    const playbackRate = Math.abs(media.playbackRate);
    // To maintain stable adaptive playback, only begin monitoring frag loading after half or more of its playback duration has passed
    if (
      timeLoading <=
      Math.max(ttfbEstimate, 1000 * (duration / (playbackRate * 2)))
    ) {
      return;
    }

    // bufferStarvationDelay is an estimate of the amount time (in seconds) it will take to exhaust the buffer
    const bufferStarvationDelay = bufferInfo.len / playbackRate;
    // Only downswitch if less than 2 fragment lengths are buffered
    if (bufferStarvationDelay >= (2 * duration) / playbackRate) {
      return;
    }

    const ttfb = stats.loading.first
      ? stats.loading.first - stats.loading.start
      : -1;
    const loadedFirstByte = stats.loaded && ttfb > -1;
    const bwEstimate: number = this.bwEstimator.getEstimate();
    const { levels, minAutoLevel } = hls;
    const level = levels[frag.level];
    const expectedLen =
      stats.total ||
      Math.max(stats.loaded, Math.round((duration * level.maxBitrate) / 8));
    let timeStreaming = timeLoading - ttfb;
    if (timeStreaming < 1 && loadedFirstByte) {
      timeStreaming = Math.min(timeLoading, (stats.loaded * 8) / bwEstimate);
    }
    const loadRate = loadedFirstByte
      ? (stats.loaded * 1000) / timeStreaming
      : 0;
    // fragLoadDelay is an estimate of the time (in seconds) it will take to buffer the remainder of the fragment
    const fragLoadedDelay = loadRate
      ? (expectedLen - stats.loaded) / loadRate
      : (expectedLen * 8) / bwEstimate + ttfbEstimate / 1000;
    // Only downswitch if the time to finish loading the current fragment is greater than the amount of buffer left
    if (fragLoadedDelay <= bufferStarvationDelay) {
      return;
    }

    const bwe = loadRate ? loadRate * 8 : bwEstimate;
    let fragLevelNextLoadedDelay: number = Number.POSITIVE_INFINITY;
    let nextLoadLevel: number;
    // Iterate through lower level and try to find the largest one that avoids rebuffering
    for (
      nextLoadLevel = frag.level - 1;
      nextLoadLevel > minAutoLevel;
      nextLoadLevel--
    ) {
      // compute time to load next fragment at lower level
      // 8 = bits per byte (bps/Bps)
      const levelNextBitrate = levels[nextLoadLevel].maxBitrate;
      fragLevelNextLoadedDelay = this.getTimeToLoadFrag(
        ttfbEstimate / 1000,
        bwe,
        duration * levelNextBitrate,
        !levels[nextLoadLevel].details
      );
      if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
        break;
      }
    }
    // Only emergency switch down if it takes less time to load a new fragment at lowest level instead of continuing
    // to load the current one
    if (fragLevelNextLoadedDelay >= fragLoadedDelay) {
      return;
    }

    // if estimated load time of new segment is completely unreasonable, ignore and do not emergency switch down
    if (fragLevelNextLoadedDelay > duration * 10) {
      return;
    }
    hls.nextLoadLevel = nextLoadLevel;
    if (loadedFirstByte) {
      // If there has been loading progress, sample bandwidth using loading time offset by minimum TTFB time
      this.bwEstimator.sample(
        timeLoading - Math.min(ttfbEstimate, ttfb),
        stats.loaded
      );
    } else {
      // If there has been no loading progress, sample TTFB
      this.bwEstimator.sampleTTFB(timeLoading);
    }

    this.clearTimer();
    logger.warn(`[abr] Fragment ${frag.sn}${
      part ? ' part ' + part.index : ''
    } of level ${frag.level} is loading too slowly;
      Time to underbuffer: ${bufferStarvationDelay.toFixed(3)} s
      Estimated load time for current fragment: ${fragLoadedDelay.toFixed(3)} s
      Estimated load time for down switch fragment: ${fragLevelNextLoadedDelay.toFixed(
        3
      )} s
      TTFB estimate: ${ttfb}
      Current BW estimate: ${
        Number.isFinite(bwEstimate) ? (bwEstimate / 1024).toFixed(3) : 'Unknown'
      } Kb/s
      New BW estimate: ${(this.bwEstimator.getEstimate() / 1024).toFixed(
        3
      )} Kb/s
      Aborting and switching to level ${nextLoadLevel}`);
    if (frag.loader) {
      this.fragCurrent = this.partCurrent = null;
      frag.abortRequests();
    }
    hls.trigger(Events.FRAG_LOAD_EMERGENCY_ABORTED, { frag, part, stats });
  }

  protected onFragLoaded(
    event: Events.FRAG_LOADED,
    { frag, part }: FragLoadedData
  ) {
    const stats = part ? part.stats : frag.stats;
    if (frag.type === PlaylistLevelType.MAIN) {
      this.bwEstimator.sampleTTFB(stats.loading.first - stats.loading.start);
    }
    if (this.ignoreFragment(frag)) {
      return;
    }
    // stop monitoring bw once frag loaded
    this.clearTimer();
    // store level id after successful fragment load
    this.lastLoadedFragLevel = frag.level;
    // reset forced auto level value so that next level will be selected
    this._nextAutoLevel = -1;

    // compute level average bitrate
    if (this.hls.config.abrMaxWithRealBitrate) {
      const duration = part ? part.duration : frag.duration;
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

  protected onFragBuffered(
    event: Events.FRAG_BUFFERED,
    data: FragBufferedData
  ) {
    const { frag, part } = data;
    const stats = part?.stats.loaded ? part.stats : frag.stats;

    if (stats.aborted) {
      return;
    }
    if (this.ignoreFragment(frag)) {
      return;
    }
    // Use the difference between parsing and request instead of buffering and request to compute fragLoadingProcessing;
    // rationale is that buffer appending only happens once media is attached. This can happen when config.startFragPrefetch
    // is used. If we used buffering in that case, our BW estimate sample will be very large.
    const processingMs =
      stats.parsing.end -
      stats.loading.start -
      Math.min(
        stats.loading.first - stats.loading.start,
        this.bwEstimator.getEstimateTTFB()
      );
    this.bwEstimator.sample(processingMs, stats.loaded);
    stats.bwEstimate = this.bwEstimator.getEstimate();
    if (frag.bitrateTest) {
      this.bitrateTestDelay = processingMs / 1000;
    } else {
      this.bitrateTestDelay = 0;
    }
  }

  private ignoreFragment(frag: Fragment): boolean {
    // Only count non-alt-audio frags which were actually buffered in our BW calculations
    return frag.type !== PlaylistLevelType.MAIN || frag.sn === 'initSegment';
  }

  public clearTimer() {
    self.clearInterval(this.timer);
  }

  // return next auto level
  get nextAutoLevel() {
    const forcedAutoLevel = this._nextAutoLevel;
    const bwEstimator = this.bwEstimator;
    // in case next auto level has been forced, and bw not available or not reliable, return forced value
    if (forcedAutoLevel !== -1 && !bwEstimator.canEstimate()) {
      return forcedAutoLevel;
    }

    // compute next level using ABR logic
    let nextABRAutoLevel = this.getNextABRAutoLevel();
    // use forced auto level when ABR selected level has errored
    if (forcedAutoLevel !== -1) {
      const levels = this.hls.levels;
      if (
        levels.length > Math.max(forcedAutoLevel, nextABRAutoLevel) &&
        levels[forcedAutoLevel].loadError <= levels[nextABRAutoLevel].loadError
      ) {
        return forcedAutoLevel;
      }
    }
    // if forced auto level has been defined, use it to cap ABR computed quality level
    if (forcedAutoLevel !== -1) {
      nextABRAutoLevel = Math.min(forcedAutoLevel, nextABRAutoLevel);
    }

    return nextABRAutoLevel;
  }

  private getNextABRAutoLevel(): number {
    const { fragCurrent, partCurrent, hls } = this;
    const { maxAutoLevel, config, minAutoLevel, media } = hls;
    const currentFragDuration = partCurrent
      ? partCurrent.duration
      : fragCurrent
      ? fragCurrent.duration
      : 0;

    // playbackRate is the absolute value of the playback rate; if media.playbackRate is 0, we use 1 to load as
    // if we're playing back at the normal rate.
    const playbackRate =
      media && media.playbackRate !== 0 ? Math.abs(media.playbackRate) : 1.0;
    const avgbw = this.bwEstimator
      ? this.bwEstimator.getEstimate()
      : config.abrEwmaDefaultEstimate;
    // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
    const bufferInfo = hls.mainForwardBufferInfo;
    const bufferStarvationDelay =
      (bufferInfo ? bufferInfo.len : 0) / playbackRate;

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
      `[abr] ${
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
          `[abr] bitrate test took ${Math.round(
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

    const ttfbEstimateSec = this.bwEstimator.getEstimateTTFB() / 1000;
    let levelSkippedMin = minAutoLevel;
    let levelSkippedMax = -1;
    for (let i = maxAutoLevel; i >= minAutoLevel; i--) {
      const levelInfo = levels[i];

      if (
        !levelInfo ||
        (currentCodecSet && levelInfo.codecSet !== currentCodecSet)
      ) {
        if (levelInfo) {
          levelSkippedMin = Math.min(i, levelSkippedMin);
          levelSkippedMax = Math.max(i, levelSkippedMax);
        }
        continue;
      }
      if (levelSkippedMax !== -1) {
        logger.trace(
          `[abr] Skipped level(s) ${levelSkippedMin}-${levelSkippedMax} with CODECS:"${levels[levelSkippedMax].attrs.CODECS}"; not compatible with "${level.attrs.CODECS}"`
        );
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
      const fetchDuration: number = this.getTimeToLoadFrag(
        ttfbEstimateSec,
        adjustedbw,
        bitrate * avgDuration,
        levelDetails === undefined
      );

      logger.trace(
        `[abr] level:${i} adjustedbw-bitrate:${Math.round(
          adjustedbw - bitrate
        )} avgDuration:${avgDuration.toFixed(
          1
        )} maxFetchDuration:${maxFetchDuration.toFixed(
          1
        )} fetchDuration:${fetchDuration.toFixed(1)}`
      );
      // if adjusted bw is greater than level bitrate AND
      if (
        adjustedbw > bitrate &&
        // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
        // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
        // special case to support startLevel = -1 (bitrateTest) on live streams : in that case we should not exit loop so that findBestLevel will return -1
        (fetchDuration === 0 ||
          !Number.isFinite(fetchDuration) ||
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
