import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';
import { Events } from '../events';
import { ErrorDetails } from '../errors';
import { PlaylistLevelType } from '../types/loader';
import { logger } from '../utils/logger';
import {
  SUPPORTED_INFO_DEFAULT,
  getMediaDecodingInfoPromise,
  requiresMediaCapabilitiesDecodingInfo,
} from '../utils/mediacapabilities-helper';
import {
  getAudioTracksByGroup,
  getCodecTiers,
  getStartCodecTier,
  type AudioTracksByGroup,
  type CodecSetTier,
} from '../utils/rendition-helper';
import type { Fragment } from '../loader/fragment';
import type { Part } from '../loader/fragment';
import type { Level, VideoRange } from '../types/level';
import type { LoaderStats } from '../types/loader';
import type Hls from '../hls';
import type {
  FragLoadingData,
  FragLoadedData,
  FragBufferedData,
  LevelLoadedData,
  LevelSwitchingData,
  ManifestLoadingData,
  ErrorData,
} from '../types/events';
import type { AbrComponentAPI } from '../types/component-api';

class AbrController implements AbrComponentAPI {
  protected hls: Hls;
  private lastLevelLoadSec: number = 0;
  private lastLoadedFragLevel: number = -1;
  private _nextAutoLevel: number = -1;
  private nextAutoLevelKey: string = '';
  private audioTracksByGroup: AudioTracksByGroup | null = null;
  private codecTiers: Record<string, CodecSetTier> | null = null;
  private timer: number = -1;
  private onCheck: Function = this._abandonRulesCheck.bind(this);
  private fragCurrent: Fragment | null = null;
  private partCurrent: Part | null = null;
  private bitrateTestDelay: number = 0;

  public bwEstimator: EwmaBandWidthEstimator;

  constructor(hls: Hls) {
    this.hls = hls;
    this.bwEstimator = this.initEstimator();
    this.registerListeners();
  }

  public resetEstimator(abrEwmaDefaultEstimate?: number) {
    if (abrEwmaDefaultEstimate) {
      logger.log(`setting initial bwe to ${abrEwmaDefaultEstimate}`);
      this.hls.config.abrEwmaDefaultEstimate = abrEwmaDefaultEstimate;
    }
    this.bwEstimator = this.initEstimator();
  }
  private initEstimator(): EwmaBandWidthEstimator {
    const config = this.hls.config;
    return new EwmaBandWidthEstimator(
      config.abrEwmaSlowVoD,
      config.abrEwmaFastVoD,
      config.abrEwmaDefaultEstimate,
    );
  }

  protected registerListeners() {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.on(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.on(Events.ERROR, this.onError, this);
  }

  protected unregisterListeners() {
    const { hls } = this;
    if (!hls) {
      return;
    }
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.off(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.off(Events.ERROR, this.onError, this);
  }

  public destroy() {
    this.unregisterListeners();
    this.clearTimer();
    // @ts-ignore
    this.hls = this.onCheck = null;
    this.fragCurrent = this.partCurrent = null;
  }

  protected onManifestLoading(
    event: Events.MANIFEST_LOADING,
    data: ManifestLoadingData,
  ) {
    this.lastLoadedFragLevel = -1;
    this.lastLevelLoadSec = 0;
    this.fragCurrent = this.partCurrent = null;
    this.audioTracksByGroup = null;
    this.onLevelsUpdated();
    this.clearTimer();
  }

  private onLevelsUpdated() {
    if (this.lastLoadedFragLevel > -1 && this.fragCurrent) {
      this.lastLoadedFragLevel = this.fragCurrent.level;
    }
    this._nextAutoLevel = -1;
    this.nextAutoLevelKey = '';
    this.codecTiers = null;
  }

  protected onFragLoading(event: Events.FRAG_LOADING, data: FragLoadingData) {
    const frag = data.frag;
    if (this.ignoreFragment(frag)) {
      return;
    }
    if (!frag.bitrateTest) {
      this.fragCurrent = frag;
      this.partCurrent = data.part ?? null;
    }
    this.clearTimer();
    this.timer = self.setInterval(this.onCheck, 100);
  }

  protected onLevelSwitching(
    event: Events.LEVEL_SWITCHING,
    data: LevelSwitchingData,
  ): void {
    this.clearTimer();
  }

  protected onError(event: Events.ERROR, data: ErrorData) {
    if (data.fatal) {
      return;
    }
    switch (data.details) {
      case ErrorDetails.BUFFER_ADD_CODEC_ERROR:
      case ErrorDetails.BUFFER_APPEND_ERROR:
        // Reset last loaded level so that a new selection can be made after calling recoverMediaError
        this.lastLoadedFragLevel = -1;
    }
  }

  private getTimeToLoadFrag(
    timeToFirstByteSec: number,
    bandwidth: number,
    fragSizeBits: number,
    isSwitch: boolean,
  ): number {
    const fragLoadSec = timeToFirstByteSec + fragSizeBits / bandwidth;
    const playlistLoadSec = isSwitch ? this.lastLevelLoadSec : 0;
    return fragLoadSec + playlistLoadSec;
  }

  protected onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    const config = this.hls.config;
    const { loading } = data.stats;
    const timeLoadingMs = loading.end - loading.start;
    if (Number.isFinite(timeLoadingMs)) {
      this.lastLevelLoadSec = timeLoadingMs / 1000;
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
    const minAutoLevel = hls.minAutoLevel;
    // If frag loading is aborted, complete, or from lowest level, stop timer and return
    if (
      stats.aborted ||
      (stats.loaded && stats.loaded === stats.total) ||
      frag.level <= minAutoLevel
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
    const bwEstimate: number = this.getBwEstimate();
    const levels = hls.levels;
    const level = levels[frag.level];
    const expectedLen =
      stats.total ||
      Math.max(stats.loaded, Math.round((duration * level.maxBitrate) / 8));
    let timeStreaming = loadedFirstByte ? timeLoading - ttfb : timeLoading;
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
        !levels[nextLoadLevel].details,
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
        stats.loaded,
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
        3,
      )} s
      TTFB estimate: ${ttfb}
      Current BW estimate: ${
        Number.isFinite(bwEstimate) ? (bwEstimate / 1024).toFixed(3) : 'Unknown'
      } Kb/s
      New BW estimate: ${(this.getBwEstimate() / 1024).toFixed(3)} Kb/s
      Aborting and switching to level ${nextLoadLevel}`);
    if (frag.loader) {
      this.fragCurrent = this.partCurrent = null;
      frag.abortRequests();
    }
    hls.trigger(Events.FRAG_LOAD_EMERGENCY_ABORTED, { frag, part, stats });
  }

  protected onFragLoaded(
    event: Events.FRAG_LOADED,
    { frag, part }: FragLoadedData,
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
    } else {
      // store level id after successful fragment load for playback
      this.lastLoadedFragLevel = frag.level;
    }
  }

  protected onFragBuffered(
    event: Events.FRAG_BUFFERED,
    data: FragBufferedData,
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
        this.bwEstimator.getEstimateTTFB(),
      );
    this.bwEstimator.sample(processingMs, stats.loaded);
    stats.bwEstimate = this.getBwEstimate();
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
    if (this.timer > -1) {
      self.clearInterval(this.timer);
      this.timer = -1;
    }
  }

  get firstAutoLevel(): number {
    const { maxAutoLevel, minAutoLevel } = this.hls;
    const maxStartDelay = this.hls.config.maxStarvationDelay;
    const abrAutoLevel = this.findBestLevel(
      this.getBwEstimate(),
      minAutoLevel,
      maxAutoLevel,
      0,
      maxStartDelay,
      1,
      1,
    );
    if (abrAutoLevel > -1) {
      return abrAutoLevel;
    }
    const firstLevel = this.hls.firstLevel;
    const clamped = Math.min(Math.max(firstLevel, minAutoLevel), maxAutoLevel);
    logger.warn(
      `[abr] Could not find best starting auto level. Defaulting to first in playlist ${firstLevel} clamped to ${clamped}`,
    );
    return clamped;
  }

  get forcedAutoLevel(): number {
    if (this.nextAutoLevelKey) {
      return -1;
    }
    return this._nextAutoLevel;
  }

  // return next auto level
  get nextAutoLevel(): number {
    const forcedAutoLevel = this._nextAutoLevel;
    const bwEstimator = this.bwEstimator;
    const useEstimate = bwEstimator.canEstimate();
    const loadedFirstFrag = this.lastLoadedFragLevel > -1;
    // in case next auto level has been forced, and bw not available or not reliable, return forced value
    if (
      forcedAutoLevel !== -1 &&
      (!useEstimate ||
        !loadedFirstFrag ||
        this.nextAutoLevelKey === this.getAutoLevelKey())
    ) {
      return forcedAutoLevel;
    }

    // compute next level using ABR logic
    let nextABRAutoLevel =
      useEstimate && loadedFirstFrag
        ? this.getNextABRAutoLevel()
        : this.firstAutoLevel;

    // use forced auto level when ABR selected level has errored
    if (forcedAutoLevel !== -1) {
      const levels = this.hls.levels;
      if (
        levels.length > Math.max(forcedAutoLevel, nextABRAutoLevel) &&
        levels[forcedAutoLevel].loadError < levels[nextABRAutoLevel].loadError
      ) {
        return forcedAutoLevel;
      }
    }
    // if forced auto level has been defined, use it to cap ABR computed quality level
    if (forcedAutoLevel !== -1) {
      nextABRAutoLevel = Math.min(forcedAutoLevel, nextABRAutoLevel);
    }

    // save result until state has changed
    this._nextAutoLevel = nextABRAutoLevel;
    this.nextAutoLevelKey = this.getAutoLevelKey();

    return nextABRAutoLevel;
  }

  private getAutoLevelKey(): string {
    return `${this.getBwEstimate()}_${this.hls.mainForwardBufferInfo?.len}`;
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
    const avgbw = this.getBwEstimate();
    // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
    const bufferInfo = hls.mainForwardBufferInfo;
    const bufferStarvationDelay =
      (bufferInfo ? bufferInfo.len : 0) / playbackRate;

    let bwFactor = config.abrBandWidthFactor;
    let bwUpFactor = config.abrBandWidthUpFactor;

    // First, look to see if we can find a level matching with our avg bandwidth AND that could also guarantee no rebuffering at all
    if (bufferStarvationDelay) {
      const bestLevel = this.findBestLevel(
        avgbw,
        minAutoLevel,
        maxAutoLevel,
        bufferStarvationDelay,
        0,
        bwFactor,
        bwUpFactor,
      );
      if (bestLevel >= 0) {
        return bestLevel;
      }
    }
    // not possible to get rid of rebuffering... try to find level that will guarantee less than maxStarvationDelay of rebuffering
    let maxStarvationDelay = currentFragDuration
      ? Math.min(currentFragDuration, config.maxStarvationDelay)
      : config.maxStarvationDelay;

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
        logger.info(
          `[abr] bitrate test took ${Math.round(
            1000 * bitrateTestDelay,
          )}ms, set first fragment max fetchDuration to ${Math.round(
            1000 * maxStarvationDelay,
          )} ms`,
        );
        // don't use conservative factor on bitrate test
        bwFactor = bwUpFactor = 1;
      }
    }
    const bestLevel = this.findBestLevel(
      avgbw,
      minAutoLevel,
      maxAutoLevel,
      bufferStarvationDelay,
      maxStarvationDelay,
      bwFactor,
      bwUpFactor,
    );
    logger.info(
      `[abr] ${
        bufferStarvationDelay ? 'rebuffering expected' : 'buffer is empty'
      }, optimal quality level ${bestLevel}`,
    );
    if (bestLevel > -1) {
      return bestLevel;
    }
    // If no matching level found, see if min auto level would be a better option
    const minLevel = hls.levels[minAutoLevel];
    const autoLevel = hls.levels[hls.loadLevel];
    if (minLevel?.bitrate < autoLevel?.bitrate) {
      return minAutoLevel;
    }
    // or if bitrate is not lower, continue to use loadLevel
    return hls.loadLevel;
  }

  private getBwEstimate(): number {
    return this.bwEstimator.canEstimate()
      ? this.bwEstimator.getEstimate()
      : this.hls.config.abrEwmaDefaultEstimate;
  }

  private findBestLevel(
    currentBw: number,
    minAutoLevel: number,
    maxAutoLevel: number,
    bufferStarvationDelay: number,
    maxStarvationDelay: number,
    bwFactor: number,
    bwUpFactor: number,
  ): number {
    const maxFetchDuration: number = bufferStarvationDelay + maxStarvationDelay;
    const lastLoadedFragLevel = this.lastLoadedFragLevel;
    const selectionBaseLevel =
      lastLoadedFragLevel === -1 ? this.hls.firstLevel : lastLoadedFragLevel;
    const { fragCurrent, partCurrent } = this;
    const { levels, allAudioTracks, loadLevel } = this.hls;
    if (levels.length === 1) {
      return 0;
    }
    const level: Level | undefined = levels[selectionBaseLevel];
    const live = !!level?.details?.live;
    const firstSelection = loadLevel === -1 || lastLoadedFragLevel === -1;
    let currentCodecSet: string | undefined;
    let currentVideoRange: VideoRange | undefined = 'SDR';
    let currentFrameRate = level?.frameRate || 0;
    const audioTracksByGroup =
      this.audioTracksByGroup ||
      (this.audioTracksByGroup = getAudioTracksByGroup(allAudioTracks));
    if (firstSelection) {
      const codecTiers =
        this.codecTiers ||
        (this.codecTiers = getCodecTiers(
          levels,
          audioTracksByGroup,
          minAutoLevel,
          maxAutoLevel,
        ));
      const { codecSet, videoRange, minFramerate, minBitrate } =
        getStartCodecTier(codecTiers, currentVideoRange, currentBw);
      currentCodecSet = codecSet;
      currentVideoRange = videoRange;
      currentFrameRate = minFramerate;
      currentBw = Math.max(currentBw, minBitrate);
    } else {
      currentCodecSet = level?.codecSet;
      currentVideoRange = level?.videoRange;
    }

    const currentFragDuration = partCurrent
      ? partCurrent.duration
      : fragCurrent
      ? fragCurrent.duration
      : 0;

    const ttfbEstimateSec = this.bwEstimator.getEstimateTTFB() / 1000;
    const levelsSkipped: number[] = [];
    for (let i = maxAutoLevel; i >= minAutoLevel; i--) {
      const levelInfo = levels[i];
      const upSwitch = i > selectionBaseLevel;
      if (!levelInfo) {
        continue;
      }
      if (
        __USE_MEDIA_CAPABILITIES__ &&
        this.hls.config.useMediaCapabilities &&
        !levelInfo.supportedResult &&
        !levelInfo.supportedPromise
      ) {
        const mediaCapabilities = navigator.mediaCapabilities;
        if (
          requiresMediaCapabilitiesDecodingInfo(
            levelInfo,
            audioTracksByGroup,
            mediaCapabilities,
            currentVideoRange,
            currentFrameRate,
            currentBw,
          )
        ) {
          levelInfo.supportedPromise = getMediaDecodingInfoPromise(
            levelInfo,
            audioTracksByGroup,
            mediaCapabilities,
          );
          levelInfo.supportedPromise.then((decodingInfo) => {
            levelInfo.supportedResult = decodingInfo;
            if (decodingInfo.error) {
              logger.warn(
                `[abr] MediaCapabilities decodingInfo error: "${
                  decodingInfo.error
                }" for level ${i} ${JSON.stringify(decodingInfo)}`,
              );
            } else if (!decodingInfo.supported) {
              logger.warn(
                `[abr] Removing unsupported level ${i} after MediaCapabilities decodingInfo check failed ${JSON.stringify(
                  decodingInfo,
                )}`,
              );
              if (i > 0) {
                this.hls.removeLevel(i);
              }
            }
          });
        } else {
          levelInfo.supportedResult = SUPPORTED_INFO_DEFAULT;
        }
      }

      // skip candidates which change codec-family or video-range,
      // and which decrease or increase frame-rate for up and down-switch respectfully
      if (
        (currentCodecSet && levelInfo.codecSet !== currentCodecSet) ||
        (currentVideoRange && levelInfo.videoRange !== currentVideoRange) ||
        (upSwitch && currentFrameRate > levelInfo.frameRate) ||
        (!upSwitch &&
          currentFrameRate > 0 &&
          currentFrameRate < levelInfo.frameRate) ||
        !levelInfo.supportedResult?.decodingInfoResults?.[0].smooth
      ) {
        levelsSkipped.push(i);
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
      if (!upSwitch) {
        adjustedbw = bwFactor * currentBw;
      } else {
        adjustedbw = bwUpFactor * currentBw;
      }

      // Use average bitrate when starvation delay (buffer length) is gt or eq two segment durations and rebuffering is not expected (maxStarvationDelay > 0)
      const bitrate: number =
        currentFragDuration &&
        bufferStarvationDelay >= currentFragDuration * 2 &&
        maxStarvationDelay === 0
          ? levels[i].averageBitrate
          : levels[i].maxBitrate;
      const fetchDuration: number = this.getTimeToLoadFrag(
        ttfbEstimateSec,
        adjustedbw,
        bitrate * avgDuration,
        levelDetails === undefined,
      );

      const canSwitchWithinTolerance =
        // if adjusted bw is greater than level bitrate AND
        adjustedbw >= bitrate &&
        // no level change, or new level has no error history
        (i === lastLoadedFragLevel ||
          (levelInfo.loadError === 0 && levelInfo.fragmentError === 0)) &&
        // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
        // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
        // special case to support startLevel = -1 (bitrateTest) on live streams : in that case we should not exit loop so that findBestLevel will return -1
        (fetchDuration <= ttfbEstimateSec ||
          !Number.isFinite(fetchDuration) ||
          (live && !this.bitrateTestDelay) ||
          fetchDuration < maxFetchDuration);
      if (canSwitchWithinTolerance) {
        if (i !== loadLevel) {
          if (levelsSkipped.length) {
            logger.trace(
              `[abr] Skipped level(s) ${levelsSkipped.join(
                ',',
              )} of ${maxAutoLevel} max with CODECS and VIDEO-RANGE:"${
                levels[levelsSkipped[0]].codecs
              }" ${levels[levelsSkipped[0]].videoRange}; not compatible with "${
                level.codecs
              }" ${currentVideoRange}`,
            );
          }
          logger.info(
            `[abr] switch candidate:${selectionBaseLevel}->${i} adjustedbw(${Math.round(
              adjustedbw,
            )})-bitrate=${Math.round(
              adjustedbw - bitrate,
            )} ttfb:${ttfbEstimateSec.toFixed(
              1,
            )} avgDuration:${avgDuration.toFixed(
              1,
            )} maxFetchDuration:${maxFetchDuration.toFixed(
              1,
            )} fetchDuration:${fetchDuration.toFixed(
              1,
            )} firstSelection:${firstSelection} codecSet:${currentCodecSet} videoRange:${currentVideoRange} hls.loadLevel:${loadLevel}`,
          );
        }
        // as we are looping from highest to lowest, this will return the best achievable quality level
        return i;
      }
    }
    // not enough time budget even with quality level 0 ... rebuffering might happen
    return -1;
  }

  set nextAutoLevel(nextLevel: number) {
    const value = Math.max(this.hls.minAutoLevel, nextLevel);
    if (this._nextAutoLevel != value) {
      this.nextAutoLevelKey = '';
      this._nextAutoLevel = value;
    }
  }
}

export default AbrController;
