import { createDoNothingErrorAction } from './error-controller';
import {
  InterstitialsSchedule,
  type TimelineType,
  type InterstitialScheduleEventItem,
  type InterstitialScheduleItem,
  type InterstitialSchedulePrimaryItem,
} from './interstitials-schedule';
import { ErrorDetails, ErrorTypes } from '../errors';
import { Events } from '../events';
import type Hls from '../hls';
import {
  generateAssetIdentifier,
  type InterstitialAssetItem,
  type InterstitialAssetId,
  type InterstitialEvent,
  type InterstitialEventWithAssetList,
  TimelineOccupancy,
} from '../loader/interstitial-event';
import { AssetListLoader } from '../loader/interstitial-asset-list';
import { LevelDetails } from '../loader/level-details';
import { HlsAssetPlayer } from './interstitial-player';
import { BufferHelper } from '../utils/buffer-helper';
import { hash } from '../utils/hash';
import { Logger } from '../utils/logger';
import { isCompatibleTrackChange } from '../utils/mediasource-helper';
import { getBasicSelectionOption } from '../utils/rendition-helper';
import type { HlsConfig } from '../config';
import type { SourceBufferName } from '../types/buffer';
import type { NetworkComponentAPI } from '../types/component-api';
import type {
  BufferAppendedData,
  ErrorData,
  AssetListLoadedData,
  LevelUpdatedData,
  MediaAttachedData,
  MediaAttachingData,
  MediaDetachingData,
  BufferCodecsData,
  AudioTrackUpdatedData,
  SubtitleTrackUpdatedData,
  BufferFlushedData,
  SubtitleTrackSwitchData,
  AudioTrackSwitchingData,
} from '../types/events';
import type { MediaPlaylist, MediaSelection } from '../types/media-playlist';

export interface InterstitialsManager {
  events: InterstitialEvent[];
  schedule: InterstitialScheduleItem[];
  playerQueue: HlsAssetPlayer[];
  bufferingPlayer: HlsAssetPlayer | null;
  bufferingAsset: InterstitialAssetItem | null;
  bufferingItem: InterstitialScheduleItem | null;
  bufferingIndex: number;
  playingAsset: InterstitialAssetItem | null;
  playingItem: InterstitialScheduleItem | null;
  playingIndex: number;
  waitingIndex: number;
  primary: PlayheadTimes;
  playout: PlayheadTimes;
  integrated: PlayheadTimes;
  skip: () => void;
}

export type PlayheadTimes = {
  bufferedEnd: number;
  currentTime: number;
  duration: number;
  seekTo: (time: number) => void;
};

export default class InterstitialsController
  extends Logger
  implements NetworkComponentAPI
{
  private readonly HlsPlayerClass: typeof Hls;
  private readonly hls: Hls;
  private readonly assetListLoader: AssetListLoader;

  // Last updated LevelDetails
  private mediaSelection: MediaSelection | null = null;
  private altSelection: {
    audio?: MediaPlaylist;
    subtitles?: MediaPlaylist;
  } | null = null;

  // Media and MediaSource/SourceBuffers
  private media: HTMLMediaElement | null = null;
  private detachedData: MediaAttachingData | null = null;
  private requiredTracks: Partial<BufferCodecsData> | null = null;

  // Public Interface for Interstitial playback state and control
  private manager: InterstitialsManager | null = null;

  // Interstitial Asset Players
  private playerQueue: HlsAssetPlayer[] = [];

  // Timeline position tracking
  private bufferedPos: number = -1;
  private timelinePos: number = -1;

  // Schedule
  private schedule: InterstitialsSchedule;

  // Schedule playback and buffering state
  private playingItem: InterstitialScheduleItem | null = null;
  private bufferingItem: InterstitialScheduleItem | null = null;
  private waitingItem: InterstitialScheduleEventItem | null = null;
  private playingAsset: InterstitialAssetItem | null = null;
  private bufferingAsset: InterstitialAssetItem | null = null;

  constructor(hls: Hls, HlsPlayerClass: typeof Hls) {
    super('interstitials', hls.logger);
    this.hls = hls;
    this.HlsPlayerClass = HlsPlayerClass;
    this.assetListLoader = new AssetListLoader(hls);
    this.schedule = new InterstitialsSchedule(this.onScheduleUpdate);
    this.registerListeners();
  }

  private registerListeners() {
    const hls = this.hls;
    hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    hls.on(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.on(Events.AUDIO_TRACK_UPDATED, this.onAudioTrackUpdated, this);
    hls.on(Events.SUBTITLE_TRACK_SWITCH, this.onSubtitleTrackSwitch, this);
    hls.on(Events.SUBTITLE_TRACK_UPDATED, this.onSubtitleTrackUpdated, this);
    hls.on(Events.ASSET_LIST_LOADED, this.onAssetListLoaded, this);
    hls.on(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.on(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.on(Events.BUFFERED_TO_END, this.onBufferedToEnd, this);
    hls.on(Events.MEDIA_ENDED, this.onMediaEnded, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.DESTROYING, this.onDestroying, this);
  }

  private unregisterListeners() {
    const hls = this.hls;
    if (!hls) {
      return;
    }
    hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    hls.off(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.off(Events.AUDIO_TRACK_UPDATED, this.onAudioTrackUpdated, this);
    hls.off(Events.SUBTITLE_TRACK_SWITCH, this.onSubtitleTrackSwitch, this);
    hls.off(Events.SUBTITLE_TRACK_UPDATED, this.onSubtitleTrackUpdated, this);
    hls.off(Events.ASSET_LIST_LOADED, this.onAssetListLoaded, this);
    hls.off(Events.BUFFER_CODECS, this.onBufferCodecs, this);
    hls.off(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.off(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.off(Events.BUFFERED_TO_END, this.onBufferedToEnd, this);
    hls.off(Events.MEDIA_ENDED, this.onMediaEnded, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.DESTROYING, this.onDestroying, this);
  }

  startLoad() {
    // TODO: startLoad - check for waitingItem and retry by resetting schedule
    this.resumeBuffering();
  }

  stopLoad() {
    // TODO: stopLoad - stop all scheule.events[].assetListLoader?.abort() then delete the loaders
    this.pauseBuffering();
  }

  resumeBuffering() {
    this.playerQueue.forEach((player) => player.resumeBuffering());
  }

  pauseBuffering() {
    this.playerQueue.forEach((player) => player.pauseBuffering());
  }

  destroy() {
    this.unregisterListeners();
    this.stopLoad();
    if (this.assetListLoader) {
      this.assetListLoader.destroy();
    }
    this.emptyPlayerQueue();
    this.clearScheduleState();
    if (this.schedule) {
      this.schedule.destroy();
    }
    this.media =
      this.detachedData =
      this.mediaSelection =
      this.altSelection =
      this.manager =
        null;
    // @ts-ignore
    this.hls = this.HlsPlayerClass = this.schedule = this.log = null;
    // @ts-ignore
    this.assetListLoader = null;
    // @ts-ignore
    this.onSeeking = this.onTimeupdate = null;
    // @ts-ignore
    this.onScheduleUpdate = null;
  }

  private onDestroying() {
    const media = this.primaryMedia;
    if (media) {
      media.removeEventListener('seeking', this.onSeeking);
      media.removeEventListener('timeupdate', this.onTimeupdate);
    }
  }

  private onMediaAttaching(
    event: Events.MEDIA_ATTACHING,
    data: MediaAttachingData,
  ) {
    const media = (this.media = data.media);
    media.removeEventListener('seeking', this.onSeeking);
    media.removeEventListener('timeupdate', this.onTimeupdate);
    media.addEventListener('seeking', this.onSeeking);
    media.addEventListener('timeupdate', this.onTimeupdate);
  }

  private onMediaAttached(
    event: Events.MEDIA_ATTACHED,
    data: MediaAttachedData,
  ) {
    const playingItem = this.playingItem;
    const detachedMedia = this.detachedData;
    this.detachedData = null;
    if (playingItem === null) {
      this.checkStart();
    } else if (!detachedMedia) {
      // Resume schedule after detached externally
      this.clearScheduleState();
      const playingIndex = this.schedule.findItemIndex(playingItem);
      this.setSchedulePosition(playingIndex);
    }
  }

  private clearScheduleState() {
    this.playingItem =
      this.bufferingItem =
      this.waitingItem =
      this.playingAsset =
      this.bufferingAsset =
        null;
  }

  private onMediaDetaching(
    event: Events.MEDIA_DETACHING,
    data: MediaDetachingData,
  ) {
    const transferringMedia = !!data.transferMedia;
    const media = this.media;
    this.media = null;
    if (transferringMedia) {
      return;
    }
    if (media) {
      media.removeEventListener('seeking', this.onSeeking);
      media.removeEventListener('timeupdate', this.onTimeupdate);
    }
    // If detachMedia is called while in an Interstitial, detach the asset player as well and reset the schedule position
    if (this.detachedData) {
      const player = this.getBufferingPlayer();
      if (player) {
        this.playingAsset = null;
        this.bufferingAsset = null;
        this.bufferingItem = null;
        this.waitingItem = null;
        this.detachedData = null;
        player.detachMedia();
      }
    }
  }

  public get interstitialsManager(): InterstitialsManager | null {
    if (!this.manager) {
      if (!this.hls || !this.schedule.events) {
        return null;
      }
      const c = this;
      const effectiveBufferingItem = () =>
        this.bufferingItem || this.waitingItem;
      const effectivePlayingItem = () => this.playingItem || this.waitingItem;
      const getAssetPlayer = (asset: InterstitialAssetItem | null) =>
        asset ? this.getAssetPlayer(asset.identifier) : asset;
      const getMappedTime = (
        item: InterstitialScheduleItem | null,
        timelineType: TimelineType,
        asset: InterstitialAssetItem | null,
        controllerField: 'bufferedPos' | 'timelinePos',
        assetPlayerField: 'bufferedEnd' | 'currentTime',
      ) => {
        if (item) {
          let time = item[timelineType].start;
          const interstitial = item.event;
          if (
            interstitial &&
            (timelineType === 'playout' ||
              interstitial.timelineOccupancy !== TimelineOccupancy.Point)
          ) {
            const assetPlayer = getAssetPlayer(asset);
            if (assetPlayer?.interstitial === interstitial) {
              time +=
                assetPlayer.assetItem.startOffset +
                assetPlayer[assetPlayerField];
            }
          } else {
            time += c[controllerField] - item.start;
          }
          return time;
        }
        return 0;
      };
      const seekTo = (time: number, timelineType: TimelineType) => {
        const item = effectivePlayingItem();
        if (item?.event?.restrictions.skip) {
          return;
        }
        c.log(`seek to ${time} "${timelineType}"`);
        const playingItem = effectivePlayingItem();
        const targetIndex = c.schedule.findItemIndexAtTime(time, timelineType);
        const targetItem = c.schedule.items?.[targetIndex];
        // playingAsset player

        if (playingItem && c.itemsMatch(playingItem, targetItem)) {
          // seek in item
          const assetPlayer = getAssetPlayer(c.playingAsset);
          const media = assetPlayer?.media || c.hls.media;
          if (media) {
            const currentTime =
              timelineType === 'primary'
                ? c.timelinePos
                : getMappedTime(
                    playingItem,
                    timelineType,
                    c.playingAsset,
                    'timelinePos',
                    'currentTime',
                  );
            const diff = time - currentTime;
            media.currentTime += diff;
            return;
          }
        }
        // seek out of item or asset
        let assetIndex = 0;
        const assetList = targetItem?.event?.assetList;
        if (assetList) {
          const eventTime =
            time - (targetItem[timelineType] || targetItem).start;
          for (let i = assetList.length; i--; ) {
            const asset = assetList[i];
            if (
              asset.duration &&
              asset.startOffset >= eventTime &&
              asset.startOffset + asset.duration < eventTime
            ) {
              assetIndex = i;
              break;
            }
          }
        }
        this.setSchedulePosition(targetIndex, assetIndex);
      };
      this.manager = {
        get events() {
          return c.schedule?.events?.slice(0) || [];
        },
        get schedule() {
          return c.schedule?.items?.slice(0) || [];
        },
        get playerQueue() {
          return c.playerQueue.slice(0);
        },
        get bufferingPlayer() {
          return c.getBufferingPlayer();
        },
        get bufferingAsset() {
          return c.bufferingAsset;
        },
        get bufferingItem() {
          return c.bufferingItem;
        },
        get playingAsset() {
          return c.playingAsset;
        },
        get playingItem() {
          return c.playingItem;
        },
        get bufferingIndex() {
          const item = effectiveBufferingItem();
          return item ? c.schedule.findItemIndex(item) : -1;
        },
        get playingIndex() {
          const item = effectivePlayingItem();
          return item ? c.schedule.findItemIndex(item) : -1;
        },
        get waitingIndex() {
          return c.waitingItem ? c.schedule.findItemIndex(c.waitingItem) : -1;
        },
        primary: {
          get bufferedEnd() {
            const bufferedPos = c.bufferedPos;
            return bufferedPos > 0 ? bufferedPos : 0;
          },
          get currentTime() {
            const timelinePos = c.timelinePos;
            return timelinePos > 0 ? timelinePos : 0;
          },
          get duration() {
            return c.schedule.durations.primary;
          },
          seekTo: (time) => seekTo(time, 'primary'),
        },
        playout: {
          get bufferedEnd() {
            return getMappedTime(
              effectiveBufferingItem(),
              'playout',
              c.bufferingAsset,
              'bufferedPos',
              'bufferedEnd',
            );
          },
          get currentTime() {
            return getMappedTime(
              effectivePlayingItem(),
              'playout',
              c.playingAsset,
              'timelinePos',
              'currentTime',
            );
          },
          get duration() {
            return c.schedule.durations.playout;
          },
          seekTo: (time) => seekTo(time, 'playout'),
        },
        integrated: {
          get bufferedEnd() {
            return getMappedTime(
              effectiveBufferingItem(),
              'integrated',
              c.bufferingAsset,
              'bufferedPos',
              'bufferedEnd',
            );
          },
          get currentTime() {
            return getMappedTime(
              effectivePlayingItem(),
              'integrated',
              c.playingAsset,
              'timelinePos',
              'currentTime',
            );
          },
          get duration() {
            return c.schedule.durations.integrated;
          },
          seekTo: (time) => seekTo(time, 'integrated'),
        },
        skip: () => {
          const item = effectivePlayingItem();
          const event = item?.event;
          if (event && !event.restrictions.skip) {
            const index = c.schedule.findItemIndex(item);
            if (!event.appendInPlace) {
              c.advanceAfterAssetEnded(event, index, Infinity);
            } else {
              // TODO: seek to start of next item
            }
          }
        },
      };
    }
    return this.manager;
  }

  // Schedule getters
  private get playingLastItem(): boolean {
    const playingItem = this.playingItem;
    if (!this.playbackStarted || !playingItem) {
      return false;
    }
    const items = this.schedule?.items;
    return this.itemsMatch(playingItem, items ? items[items.length - 1] : null);
  }

  private get playbackStarted(): boolean {
    return this.playingItem !== null;
  }

  // Media getters and event callbacks
  private get currentTime(): number | undefined {
    if (this.mediaSelection === null) {
      // Do not advance before schedule is known
      return undefined;
    }
    // Ignore currentTime when detached for Interstitial playback with source reset
    const queuedForPlayback = this.waitingItem || this.playingItem;
    if (
      this.isInterstitial(queuedForPlayback) &&
      !queuedForPlayback.event.appendInPlace
    ) {
      return undefined;
    }
    let media = this.media;
    if (!media && this.bufferingItem?.event?.appendInPlace) {
      // Observe detached media currentTime when appending in place
      media = this.primaryMedia;
    }
    const currentTime = media?.currentTime;
    if (currentTime === undefined || !Number.isFinite(currentTime)) {
      return undefined;
    }
    return currentTime;
  }

  private get primaryMedia(): HTMLMediaElement | null {
    return this.media || this.detachedData?.media || null;
  }

  private isInterstitial(
    item: InterstitialScheduleItem | null | undefined,
  ): item is InterstitialScheduleEventItem {
    return !!item?.event;
  }

  private retreiveMediaSource(
    assetId: InterstitialAssetId,
    toSegment: InterstitialScheduleItem | null,
  ) {
    const player = this.getAssetPlayer(assetId);
    if (player) {
      this.transferMediaFromPlayer(player, toSegment);
    }
  }

  private transferMediaFromPlayer(
    player: HlsAssetPlayer,
    toSegment: InterstitialScheduleItem | null | undefined,
  ) {
    const appendInPlace = player.interstitial.appendInPlace;
    const playerMedia = player.media;
    if (appendInPlace && playerMedia === this.primaryMedia) {
      if (
        !toSegment ||
        (this.isInterstitial(toSegment) && !toSegment.event.appendInPlace)
      ) {
        // MediaSource cannot be transfered back to an Interstitial that requires a source reset
        // no-op when toSegment is undefined
        if (toSegment && playerMedia) {
          this.detachedData = { media: playerMedia };
        }
        return;
      }
      const attachMediaSourceData = player.transferMedia();
      this.log(
        `transfer MediaSource from Interstitial Asset Player "${player.assetId}" ${JSON.stringify(attachMediaSourceData)}`,
      );
      this.bufferingAsset = null;
      this.detachedData = attachMediaSourceData;
    }
  }

  private transferMediaTo(
    player: Hls | HlsAssetPlayer,
    media: HTMLMediaElement,
  ) {
    let attachMediaSourceData: MediaAttachingData | null = null;
    const primaryPlayer = this.hls;
    const appendInPlace =
      player !== primaryPlayer &&
      (player as HlsAssetPlayer).interstitial.appendInPlace;
    const detachedMediaSource = this.detachedData?.mediaSource;
    this.log(`transferMediaTo ${(player as HlsAssetPlayer).assetId || 'main'}`);
    if (primaryPlayer.media && appendInPlace) {
      attachMediaSourceData = primaryPlayer.transferMedia();
      this.detachedData = attachMediaSourceData;
    } else if (detachedMediaSource) {
      const bufferingPlayer = this.getBufferingPlayer();
      if (bufferingPlayer) {
        attachMediaSourceData = bufferingPlayer.transferMedia();
      }
    }
    if (!attachMediaSourceData) {
      if (detachedMediaSource) {
        attachMediaSourceData = this.detachedData;
      } else if (!this.detachedData) {
        this.hls.detachMedia();
        this.detachedData = { media };
      }
    }
    const transferring =
      attachMediaSourceData &&
      'mediaSource' in attachMediaSourceData &&
      attachMediaSourceData.mediaSource?.readyState !== 'closed';
    const dataToAttach =
      transferring && attachMediaSourceData ? attachMediaSourceData : media;

    const isAssetPlayer = player !== primaryPlayer;
    this.log(
      `${transferring ? 'transfering MediaSource' : 'attaching media'} to ${
        isAssetPlayer
          ? 'Interstitial Asset ' + (player as HlsAssetPlayer).assetId
          : 'Primary'
      }`,
    );
    if (dataToAttach === attachMediaSourceData) {
      const isAssetAtEndOfSchedule =
        isAssetPlayer &&
        (player as HlsAssetPlayer).assetId === this.schedule.assetIdAtEnd;
      // Prevent asset players from marking EoS on transferred MediaSource
      dataToAttach.overrides = {
        duration: this.schedule.duration,
        endOfStream: !isAssetPlayer || isAssetAtEndOfSchedule,
      };
    }
    player.attachMedia(dataToAttach);
  }

  private onSeeking = () => {
    const currentTime = this.currentTime;
    if (currentTime === undefined || this.playbackDisabled) {
      return;
    }
    const diff = currentTime - this.timelinePos;
    const roundingError = Math.abs(diff) < 1 / 705600000; // one flick
    if (roundingError) {
      return;
    }
    const backwardSeek = diff <= -0.01;
    this.timelinePos = currentTime;
    this.bufferedPos = currentTime;
    this.checkBuffer();

    // Check if seeking out of an item
    const playingItem = this.playingItem;
    if (!playingItem) {
      return;
    }
    if (
      (backwardSeek && currentTime < playingItem.start) ||
      currentTime >= playingItem.end
    ) {
      const scheduleIndex = this.schedule.findItemIndexAtTime(this.timelinePos);
      if (!backwardSeek) {
        const playingIndex = this.schedule.findItemIndex(playingItem);
        // check if an Interstitial between the current item and target item has an X-RESTRICT JUMP restriction
        const jumpIndex = this.schedule.findJumpRestrictedIndex(
          playingIndex,
          scheduleIndex,
        );
        if (jumpIndex > playingIndex) {
          this.setSchedulePosition(jumpIndex);
          return;
        }
      }
      this.setSchedulePosition(scheduleIndex);
      return;
    }
    // Check if seeking out of an asset (assumes same item following above check)
    const playingAsset = this.playingAsset;
    if (!playingAsset) {
      // restart Interstitial at end
      if (this.playingLastItem && this.isInterstitial(playingItem)) {
        const restartAsset = playingItem.event.assetList[0];
        if (restartAsset) {
          this.playingItem = null;
          this.setScheduleToAssetAtTime(currentTime, restartAsset);
        }
      }
      return;
    }
    const start = playingAsset.timelineStart;
    const duration = playingAsset.duration || 0;
    if (
      (backwardSeek && currentTime < start) ||
      currentTime >= start + duration
    ) {
      this.setScheduleToAssetAtTime(currentTime, playingAsset);
    }
  };

  private onTimeupdate = () => {
    const currentTime = this.currentTime;
    if (currentTime === undefined || this.playbackDisabled) {
      return;
    }

    // Only allow timeupdate to advance primary position, seeking is used for jumping back
    // this prevents primaryPos from being reset to 0 after re-attach
    if (currentTime > this.timelinePos) {
      this.timelinePos = currentTime;
    } else {
      return;
    }

    // Check if playback has entered the next item
    const playingItem = this.playingItem;
    if (!playingItem || this.playingLastItem) {
      return;
    }
    if (currentTime >= playingItem.end) {
      this.timelinePos = playingItem.end;
      const playingIndex = this.schedule.findItemIndex(playingItem);
      this.setSchedulePosition(playingIndex + 1);
    }
    // Check if playback has entered the next asset
    const playingAsset = this.playingAsset;
    if (!playingAsset) {
      return;
    }
    const end = playingAsset.timelineStart + (playingAsset.duration || 0);
    if (currentTime >= end) {
      this.setScheduleToAssetAtTime(currentTime, playingAsset);
    }
  };

  // Scheduling methods
  private checkStart() {
    const schedule = this.schedule;
    const interstitialEvents = schedule.events;
    if (
      !interstitialEvents ||
      interstitialEvents.length === 0 ||
      this.playbackDisabled
    ) {
      return;
    }
    // Check buffered to pre-roll
    if (this.bufferedPos === -1) {
      this.bufferedPos = 0;
    }
    // Start stepping through schedule when playback begins for the first time and we have a pre-roll
    const timelinePos = this.timelinePos;
    const waitingItem = this.waitingItem;
    if (timelinePos === -1) {
      const startPosition = this.hls.startPosition;
      this.timelinePos = startPosition;
      if (interstitialEvents[0].cue.pre) {
        const index = schedule.findEventIndex(interstitialEvents[0].identifier);
        this.setSchedulePosition(index);
      } else if (startPosition >= 0 || !this.primaryLive) {
        const start = (this.timelinePos =
          startPosition > 0 ? startPosition : 0);
        const index = schedule.findItemIndexAtTime(start);
        this.setSchedulePosition(index);
      }
    } else if (waitingItem && !this.playingItem) {
      const index = schedule.findItemIndex(waitingItem);
      this.setSchedulePosition(index);
    }
  }

  private advanceAfterAssetEnded(
    interstitial: InterstitialEvent,
    index: number,
    assetListIndex: number,
  ) {
    const nextAssetIndex = assetListIndex + 1;
    if (
      !interstitial.isAssetPastPlayoutLimit(nextAssetIndex) &&
      !interstitial.assetList[nextAssetIndex].error
    ) {
      // Advance to next asset list item
      this.setSchedulePosition(index, nextAssetIndex);
    } else {
      // Advance to next schedule segment
      // check if we've reached the end of the program
      const scheduleItems = this.schedule.items;
      if (scheduleItems) {
        const nextIndex = index + 1;
        const scheduleLength = scheduleItems.length;
        if (nextIndex >= scheduleLength) {
          this.setSchedulePosition(-1);
          return;
        }
        this.setSchedulePosition(nextIndex);
      }
    }
  }

  private setScheduleToAssetAtTime(
    time: number,
    playingAsset: InterstitialAssetItem,
  ) {
    const schedule = this.schedule;
    const parentIdentifier = playingAsset.parentIdentifier;
    const interstitial = schedule.getEvent(parentIdentifier);
    if (interstitial) {
      const itemIndex = schedule.findEventIndex(parentIdentifier);
      const assetListIndex = schedule.findAssetIndex(interstitial, time);
      this.setSchedulePosition(itemIndex, assetListIndex);
    }
  }

  private setSchedulePosition(index: number, assetListIndex?: number) {
    const scheduleItems = this.schedule.items;
    if (!scheduleItems || this.playbackDisabled) {
      return;
    }
    this.log(`setSchedulePosition ${index}, ${assetListIndex}`);
    const scheduledItem = index >= 0 ? scheduleItems[index] : null;
    const media = this.primaryMedia;
    // Cleanup current item / asset
    const currentItem = this.playingItem;
    const playingLastItem = this.playingLastItem;
    if (this.isInterstitial(currentItem)) {
      const interstitial = currentItem.event;
      const playingAsset = this.playingAsset;
      const assetId = playingAsset?.identifier;
      const player = assetId ? this.getAssetPlayer(assetId) : null;
      if (
        player &&
        assetId &&
        (!this.eventItemsMatch(currentItem, scheduledItem) ||
          (assetListIndex !== undefined &&
            assetId !== interstitial.assetList?.[assetListIndex].identifier))
      ) {
        this.playingAsset = null;
        const assetListIndex = interstitial.assetList.indexOf(playingAsset);
        this.log(
          `INTERSTITIAL_ASSET_ENDED ${assetListIndex + 1}/${interstitial.assetList.length}`,
        );
        this.hls.trigger(Events.INTERSTITIAL_ASSET_ENDED, {
          asset: playingAsset,
          assetListIndex,
          event: interstitial,
          schedule: scheduleItems.slice(0),
          scheduleIndex: index,
          player,
        });
        this.retreiveMediaSource(assetId, scheduledItem);
        if (player.media && !this.detachedData) {
          player.detachMedia();
        }
        this.clearAssetPlayer(assetId, scheduledItem);
      }
      if (!this.eventItemsMatch(currentItem, scheduledItem)) {
        this.playingItem = null;
        this.log(`INTERSTITIAL_ENDED ${interstitial}`);
        interstitial.hasPlayed = true;
        this.hls.trigger(Events.INTERSTITIAL_ENDED, {
          event: interstitial,
          schedule: scheduleItems.slice(0),
          scheduleIndex: index,
        });
        // Exiting an Interstitial
        interstitial.assetList.forEach((asset) => {
          this.clearAssetPlayer(asset.identifier, scheduledItem);
        });
      }
    }
    if (this.isInterstitial(scheduledItem)) {
      // Handle Interstitial
      const interstitial = scheduledItem.event;
      // find asset index
      if (assetListIndex === undefined) {
        assetListIndex = this.schedule.findAssetIndex(
          interstitial,
          this.timelinePos,
        );
      }
      // Ensure Interstitial is enqueued
      const waitingItem = this.waitingItem;
      let player = this.preloadAssets(interstitial, assetListIndex);
      if (!player) {
        this.setBufferingItem(scheduledItem);
      }
      if (!this.eventItemsMatch(scheduledItem, currentItem || waitingItem)) {
        this.waitingItem = scheduledItem;
        this.log(`INTERSTITIAL_STARTED ${interstitial}`);
        this.hls.trigger(Events.INTERSTITIAL_STARTED, {
          event: interstitial,
          schedule: scheduleItems.slice(0),
          scheduleIndex: index,
        });
      }
      const assetListLength = interstitial.assetList.length;
      if (assetListLength === 0) {
        // Waiting at end of primary content segment
        // Expect setSchedulePosition to be called again once ASSET-LIST is loaded
        this.log(`Waiting for ASSET-LIST to complete loading ${interstitial}`);
        return;
      }
      if (interstitial.assetListLoader) {
        interstitial.assetListLoader.destroy();
        interstitial.assetListLoader = undefined;
      }
      if (!media) {
        this.log(`Waiting for attachMedia to start Interstitial`);
        return;
      }
      // Update schedule and asset list position now that it can start
      this.waitingItem = null;
      this.playingItem = scheduledItem;
      // Start Interstitial Playback
      const assetItem = interstitial.assetList[assetListIndex];
      if (!assetItem) {
        const error = new Error(
          `ASSET-LIST index ${assetListIndex} out of bounds [0-${
            assetListLength - 1
          }] ${interstitial}`,
        );
        const errorData: ErrorData = {
          fatal: true,
          type: ErrorTypes.OTHER_ERROR,
          details: ErrorDetails.INTERSTITIAL_ASSET_ITEM_ERROR,
          error,
        };
        this.handleAssetItemError(
          errorData,
          interstitial,
          index,
          assetListIndex,
          error.message,
        );
        return;
      }
      if (!player) {
        player = this.getAssetPlayer(assetItem.identifier);
      }
      if (player === null || player.destroyed) {
        this.warn(
          `asset ${
            assetListIndex + 1
          }/${assetListLength} player destroyed ${interstitial}`,
        );
        player = this.createAssetPlayer(
          interstitial,
          assetItem,
          assetListIndex,
        );
      }
      if (!this.eventItemsMatch(scheduledItem, this.bufferingItem)) {
        if (interstitial.appendInPlace && this.isAssetBuffered(assetItem)) {
          return;
        }
      }
      this.startAssetPlayer(
        player,
        assetListIndex,
        scheduleItems,
        index,
        media,
      );
    } else if (scheduledItem !== null) {
      this.resumePrimary(scheduledItem, index);
    } else if (playingLastItem && this.isInterstitial(currentItem)) {
      // Maintain playingItem state at end of schedule (setSchedulePosition(-1) called to end program)
      // this allows onSeeking handler to update schedule position
      this.playingItem = currentItem;
      if (!currentItem.event.appendInPlace) {
        // Media must be re-attached to resume primary schedule if not sharing source
        this.attachPrimary(this.schedule.durations.primary, null);
      }
    }
  }

  private get playbackDisabled(): boolean {
    return this.hls.config.enableInterstitialPlayback === false;
  }

  private get primaryDetails(): LevelDetails | undefined {
    return this.mediaSelection?.main?.details;
  }

  private get primaryLive(): boolean {
    return !!this.primaryDetails?.live;
  }

  private resumePrimary(
    scheduledItem: InterstitialSchedulePrimaryItem,
    index: number,
  ) {
    this.playingItem = scheduledItem;
    this.playingAsset = null;
    this.waitingItem = null;

    this.bufferedToItem(scheduledItem);

    this.log(`resuming primary ${scheduledItem.start}-${scheduledItem.end}`);

    if (!this.detachedData?.mediaSource) {
      const timelinePos = this.getPrimaryResumption(scheduledItem, index);
      this.timelinePos = timelinePos;
      this.attachPrimary(timelinePos, scheduledItem);
    }

    const scheduleItems = this.schedule.items;
    if (!scheduleItems) {
      return;
    }
    this.log(`primary resumed`);
    this.hls.trigger(Events.INTERSTITIALS_PRIMARY_RESUMED, {
      schedule: scheduleItems.slice(0),
      scheduleIndex: index,
    });
  }

  private getPrimaryResumption(
    scheduledItem: InterstitialSchedulePrimaryItem,
    index: number,
  ): number {
    const itemStart = scheduledItem.start;
    if (this.primaryLive) {
      const details = this.primaryDetails;
      if (index === 0) {
        return this.hls.startPosition;
      } else if (
        details &&
        (itemStart < details.fragmentStart || itemStart > details.edge)
      ) {
        return this.hls.liveSyncPosition || -1;
      }
    }
    return itemStart;
  }

  private isAssetBuffered(asset: InterstitialAssetItem): boolean {
    const player = this.getAssetPlayer(asset.identifier);
    if (player?.hls) {
      return player.hls.bufferedToEnd;
    }
    const bufferInfo = BufferHelper.bufferInfo(
      this.primaryMedia,
      this.timelinePos,
      0,
    );
    return bufferInfo.end + 1 >= asset.timelineStart + (asset.duration || 0);
  }

  private attachPrimary(
    timelinePos: number,
    item: InterstitialSchedulePrimaryItem | null,
    skipSeekToStartPosition?: boolean,
  ) {
    if (item) {
      this.setBufferingItem(item);
    } else {
      this.bufferingItem = null;
    }
    this.bufferingAsset = null;

    const media = this.primaryMedia;
    if (!media) {
      return;
    }
    const hls = this.hls;
    if (!hls.media) {
      this.transferMediaTo(hls, media);
      if (skipSeekToStartPosition) {
        hls.startLoad(timelinePos, skipSeekToStartPosition);
      }
    }
    if (!skipSeekToStartPosition) {
      // Set primary position to resume time
      this.timelinePos = timelinePos;
      hls.startLoad(timelinePos, skipSeekToStartPosition);
    }
  }

  // HLS.js event callbacks
  private onManifestLoading() {
    this.stopLoad();
    this.schedule.reset();
    this.emptyPlayerQueue();
    this.clearScheduleState();
    this.bufferedPos = this.timelinePos = -1;
    this.mediaSelection = this.altSelection = this.manager = null;
    // BUFFER_CODECS listener added here for buffer-controller to handle it first where it adds tracks
    this.hls.off(Events.BUFFER_CODECS, this.onBufferCodecs, this);
    this.hls.on(Events.BUFFER_CODECS, this.onBufferCodecs, this);
  }

  private onLevelUpdated(event: Events.LEVEL_UPDATED, data: LevelUpdatedData) {
    const main = this.hls.levels[data.level];
    const currentSelection = {
      ...(this.mediaSelection || this.altSelection),
      main,
    };
    this.mediaSelection = currentSelection;
    this.schedule.parseInterstitialDateRanges(currentSelection);
    const interstitialEvents = this.schedule.events;
    const scheduleItems = this.schedule.items;

    if (scheduleItems && interstitialEvents?.length && !this.playingItem) {
      this.checkStart();
    }
  }

  private onAudioTrackUpdated(
    event: Events.AUDIO_TRACK_UPDATED,
    data: AudioTrackUpdatedData,
  ) {
    const audio = this.hls.audioTracks[data.id];
    const previousSelection = this.mediaSelection;
    if (!previousSelection) {
      this.altSelection = { ...this.altSelection, audio };
      return;
    }
    const currentSelection = { ...previousSelection, audio };
    this.mediaSelection = currentSelection;
  }

  private onSubtitleTrackUpdated(
    event: Events.SUBTITLE_TRACK_UPDATED,
    data: SubtitleTrackUpdatedData,
  ) {
    const subtitles = this.hls.subtitleTracks[data.id];
    const previousSelection = this.mediaSelection;
    if (!previousSelection) {
      this.altSelection = { ...this.altSelection, subtitles };
      return;
    }
    const currentSelection = { ...previousSelection, subtitles };
    this.mediaSelection = currentSelection;
  }

  private onAudioTrackSwitching(
    event: Events.AUDIO_TRACK_SWITCHING,
    data: AudioTrackSwitchingData,
  ) {
    const audioOption = getBasicSelectionOption(data);
    this.playerQueue.forEach(
      (player) =>
        player.hls.setAudioOption(data) ||
        player.hls.setAudioOption(audioOption),
    );
  }

  private onSubtitleTrackSwitch(
    event: Events.SUBTITLE_TRACK_SWITCH,
    data: SubtitleTrackSwitchData,
  ) {
    const subtitleOption = getBasicSelectionOption(data);
    this.playerQueue.forEach(
      (player) =>
        player.hls.setSubtitleOption(data) ||
        (data.id !== -1 && player.hls.setSubtitleOption(subtitleOption)),
    );
  }

  private onBufferCodecs(event: Events.BUFFER_CODECS, data: BufferCodecsData) {
    const requiredTracks = data.tracks;
    if (requiredTracks) {
      this.requiredTracks = requiredTracks;
    }
  }

  private onBufferAppended(
    event: Events.BUFFER_APPENDED,
    data: BufferAppendedData,
  ) {
    this.checkBuffer();
  }

  private onBufferFlushed(
    event: Events.BUFFER_FLUSHED,
    data: BufferFlushedData,
  ) {
    const { playingItem } = this;
    if (
      playingItem &&
      playingItem !== this.bufferingItem &&
      !this.isInterstitial(playingItem)
    ) {
      const timelinePos = this.timelinePos;
      this.bufferedPos = timelinePos;
      this.setBufferingItem(playingItem);
    }
  }

  private onBufferedToEnd(event: Events.BUFFERED_TO_END) {
    // Buffered to post-roll
    const interstitialEvents = this.schedule.events;
    if (this.bufferedPos < Number.MAX_VALUE && interstitialEvents) {
      for (let i = 0; i < interstitialEvents.length; i++) {
        const interstitial = interstitialEvents[i];
        if (interstitial.cue.post) {
          const scheduleIndex = this.schedule.findEventIndex(
            interstitial.identifier,
          );
          const item = this.schedule.items?.[scheduleIndex];
          if (
            this.isInterstitial(item) &&
            this.eventItemsMatch(item, this.bufferingItem)
          ) {
            this.bufferedToItem(item, 0);
          }
          break;
        }
      }
      this.bufferedPos = Number.MAX_VALUE;
    }
  }

  private onMediaEnded(event: Events.MEDIA_ENDED) {
    const playingItem = this.playingItem;
    if (!this.playingLastItem && playingItem) {
      const playingIndex = this.schedule.findItemIndex(playingItem);
      this.setSchedulePosition(playingIndex + 1);
    }
  }

  // Schedule update callback
  private onScheduleUpdate = (removedInterstitials: InterstitialEvent[]) => {
    const schedule = this.schedule;
    const playingItem = this.playingItem;
    const interstitialEvents = schedule.events || [];
    const scheduleItems = schedule.items || [];
    const durations = schedule.durations;
    const removedIds = removedInterstitials.map(
      (interstitial) => interstitial.identifier,
    );
    if (interstitialEvents.length || removedIds.length) {
      this.log(
        `Interstitial events (${
          interstitialEvents.length
        }): ${interstitialEvents}
Schedule: ${scheduleItems.map(
          (seg) =>
            `${
              this.isInterstitial(seg)
                ? 'I' +
                  (seg.event.cue.pre ? '<pre>' : '') +
                  '[' +
                  seg.event.identifier +
                  ']'
                : 'P[' + seg.start + '-' + seg.end + ']'
            }`,
        )}
Removed events ${removedIds.length ? removedIds : '(none)'}`,
      );
    }
    if (
      this.isInterstitial(playingItem) &&
      removedIds.includes(playingItem.event.identifier)
    ) {
      this.warn(
        `Interstitial "${playingItem.event.identifier}" removed while playing`,
      );
    }

    this.playerQueue.forEach((player) => {
      if (player.interstitial.appendInPlace) {
        const timelineStart = player.assetItem.timelineStart;
        if (player.timelineOffset !== timelineStart) {
          try {
            player.timelineOffset = timelineStart;
          } catch (e) {
            this.warn(
              `${e} ("${player.assetId}" ${player.timelineOffset}->${timelineStart})`,
            );
          }
        }
      }
    });

    // Update schedule item references
    // Do not change Interstitial playingItem - used for INTERSTITIAL_ASSET_ENDED and INTERSTITIAL_ENDED
    if (playingItem && !playingItem.event) {
      this.playingItem = this.updateItem(playingItem, this.timelinePos);
    }
    // Do not change Interstitial bufferingItem - used for transfering media element or source
    const bufferingItem = this.bufferingItem;
    if (bufferingItem) {
      if (!bufferingItem.event) {
        this.bufferingItem = this.updateItem(bufferingItem, this.bufferedPos);
      } else if (!this.updateItem(bufferingItem)) {
        // Interstitial removed from schedule (Live -> VOD or other scenario where Start Date is outside the range of VOD Playlist)
        this.bufferingItem = null;
        bufferingItem.event.assetList.forEach((asset) => {
          this.clearAssetPlayer(asset.identifier);
        });
      }
    }
    // Clear waitingItem if it has been removed from the schedule
    this.waitingItem = this.updateItem(this.waitingItem);

    removedInterstitials.forEach((interstitial) => {
      interstitial.assetList.forEach((asset) => {
        this.clearAssetPlayer(asset.identifier);
      });
    });

    this.hls.trigger(Events.INTERSTITIALS_UPDATED, {
      events: interstitialEvents.slice(0),
      schedule: scheduleItems.slice(0),
      durations,
      removedIds,
    });
  };

  private updateItem<T extends InterstitialScheduleItem>(
    previousItem: T | null,
    time?: number,
  ): T | null {
    // find item in this.schedule.items;
    const items = this.schedule.items;
    if (previousItem && items) {
      const index = this.schedule.findItemIndex(previousItem, time);
      return (items[index] as T) || null;
    }
    return null;
  }

  private itemsMatch(
    a: InterstitialScheduleItem,
    b: InterstitialScheduleItem | null | undefined,
  ): boolean {
    return (
      !!b &&
      (a === b ||
        (a.event && b.event && this.eventItemsMatch(a, b)) ||
        (!a.event &&
          !b.event &&
          a.nextEvent?.identifier === b.nextEvent?.identifier))
    );
  }

  private eventItemsMatch(
    a: InterstitialScheduleEventItem,
    b: InterstitialScheduleItem | null | undefined,
  ): boolean {
    return !!b && (a === b || a.event.identifier === b.event?.identifier);
  }

  private updateSchedule() {
    const mediaSelection = this.mediaSelection;
    if (!mediaSelection) {
      return;
    }
    this.schedule.updateSchedule(mediaSelection, []);
  }

  // Schedule buffer control
  private checkBuffer() {
    const items = this.schedule.items;
    if (!items) {
      return;
    }
    // Find when combined forward buffer change reaches next schedule segment
    const bufferInfo = BufferHelper.bufferInfo(
      this.primaryMedia,
      this.timelinePos,
      0,
    );

    this.updateBufferedPos(bufferInfo.end, items, bufferInfo.len === 0);
  }

  private updateBufferedPos(
    bufferEnd: number,
    items: InterstitialScheduleItem[],
    bufferIsEmpty?: boolean,
  ) {
    if (this.bufferedPos > bufferEnd) {
      return;
    }
    const playingItem = this.playingItem;
    const playingIndex = playingItem ? items.indexOf(playingItem) : -1;
    const bufferingItem = this.bufferingItem;
    let bufferEndIndex = this.schedule.findItemIndexAtTime(bufferEnd);

    if (this.bufferedPos < bufferEnd) {
      const bufferingIndex = bufferingItem ? items.indexOf(bufferingItem) : -1;
      const nextToBufferIndex = Math.min(bufferingIndex + 1, items.length - 1);
      const nextItemToBuffer = items[nextToBufferIndex];
      if (
        bufferEndIndex === -1 &&
        bufferingItem &&
        bufferEnd >= bufferingItem.end
      ) {
        bufferEndIndex = nextToBufferIndex;
      }
      if (
        nextToBufferIndex - playingIndex > 1 &&
        bufferingItem?.event?.appendInPlace === false
      ) {
        // do not advance buffering item past Interstitial that requires source reset
        return;
      }
      this.bufferedPos = bufferEnd;
      if (bufferEndIndex > bufferingIndex && bufferEndIndex > playingIndex) {
        this.bufferedToItem(nextItemToBuffer);
      } else {
        // allow more time than distance from edge for assets to load
        const details = this.primaryDetails;
        if (
          this.primaryLive &&
          details &&
          bufferEnd > details.edge - details.targetduration &&
          nextItemToBuffer.start <
            details.edge + this.hls.config.interstitialLiveLookAhead &&
          this.isInterstitial(nextItemToBuffer)
        ) {
          this.preloadAssets(nextItemToBuffer.event, 0);
        }
      }
    } else if (
      bufferIsEmpty &&
      playingItem &&
      bufferingItem !== playingItem &&
      bufferEndIndex === playingIndex
    ) {
      this.bufferedToItem(playingItem);
    }
  }

  private setBufferingItem(
    item: InterstitialScheduleItem,
  ): InterstitialScheduleItem | null {
    const bufferingLast = this.bufferingItem;
    const schedule = this.schedule;
    const { items, events } = schedule;

    if (
      items &&
      events &&
      (!bufferingLast ||
        schedule.findItemIndex(bufferingLast) !== schedule.findItemIndex(item))
    ) {
      const isInterstitial = this.isInterstitial(item);
      const bufferingPlayer = this.getBufferingPlayer();
      const timeRemaining = bufferingPlayer
        ? bufferingPlayer.remaining
        : bufferingLast
          ? bufferingLast.end - this.timelinePos
          : 0;
      this.log(
        `setBufferingItem ${isInterstitial ? item.event.identifier : 'primary'}` +
          (bufferingLast ? ` (${timeRemaining} remaining)` : ''),
      );
      this.bufferingItem = item;
      this.bufferedPos = item.start;
      if (!this.playbackDisabled) {
        if (isInterstitial) {
          // primary fragment loading will exit early in base-stream-controller while `bufferingItem` is set to an Interstitial block
          this.playerQueue.forEach((player) => player.resumeBuffering());
        } else {
          this.hls.resumeBuffering();
          this.playerQueue.forEach((player) => player.pauseBuffering());
        }
      }
      this.hls.trigger(Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY, {
        events: events.slice(0),
        schedule: items.slice(0),
        bufferingIndex: item ? schedule.findItemIndex(item) : -1,
        playingIndex: this.playingItem
          ? schedule.findItemIndex(this.playingItem)
          : -1,
      });
    }
    return bufferingLast;
  }

  private bufferedToItem(
    item: InterstitialScheduleItem,
    assetListIndex: number = 0,
  ) {
    const bufferingLast = this.setBufferingItem(item);
    if (this.playbackDisabled) {
      return;
    }
    if (this.isInterstitial(item)) {
      // Ensure asset list is loaded
      this.bufferedToEvent(item, assetListIndex);
    } else if (bufferingLast !== null) {
      this.log(`buffered to segment (primary ${item?.start}-${item?.end})`);
      // If primary player is detached, it is also stopped, restart loading at primary position
      this.bufferingAsset = null;
      const detachedData = this.detachedData;
      if (detachedData) {
        if (detachedData.mediaSource) {
          const skipSeekToStartPosition = true;
          this.attachPrimary(item.start, item, skipSeekToStartPosition);
        } else {
          this.preloadPrimary(item);
        }
      } else {
        // If not detached seek to resumption point
        this.preloadPrimary(item);
      }
    }
  }

  private preloadPrimary(item: InterstitialSchedulePrimaryItem) {
    const index = this.schedule.findItemIndex(item);
    const timelinePos = this.getPrimaryResumption(item, index);
    this.hls.startLoad(timelinePos);
  }

  private bufferedToEvent(
    item: InterstitialScheduleEventItem,
    assetListIndex: number,
  ) {
    const interstitial = item.event;
    const neverLoaded =
      interstitial.assetList.length === 0 && !interstitial.assetListLoader;
    const playOnce = interstitial.cue.once;
    if (neverLoaded || !playOnce) {
      // Buffered to Interstitial boundary
      this.log(
        `buffered to interstitial: "${interstitial.identifier}" (${
          interstitial.cue.pre
            ? 'PRE-ROLL'
            : interstitial.cue.post
              ? 'POST-ROLL'
              : interstitial.timelineStart
        })`,
      );
      const player = this.preloadAssets(interstitial, assetListIndex);
      if (player?.interstitial.appendInPlace) {
        // If we have a player and asset list info, start buffering
        const assetItem = interstitial.assetList[assetListIndex];
        const media = this.primaryMedia;
        if (assetItem && media) {
          this.bufferAssetPlayer(player, media);
        }
      }
    }
  }

  private preloadAssets(
    interstitial: InterstitialEvent,
    assetListIndex: number,
  ): HlsAssetPlayer | null {
    const assetListLength = interstitial.assetList.length;
    const neverLoaded = assetListLength === 0 && !interstitial.assetListLoader;
    const playOnce = interstitial.cue.once;
    if (neverLoaded) {
      this.log(
        `Load interstitial ${interstitial} (asset index ${assetListIndex})`,
      );
      const timelineStart = interstitial.timelineStart;
      if (interstitial.appendInPlace) {
        this.flushFrontBuffer(timelineStart);
      }
      const uri = interstitial.assetUrl;
      if (uri) {
        return this.createAsset(
          interstitial,
          0,
          0,
          timelineStart,
          interstitial.duration,
          uri,
        );
      }
      let liveStartPosition = 0;
      if (!this.playingItem && this.primaryLive) {
        liveStartPosition = this.hls.startPosition;
        if (liveStartPosition === -1) {
          liveStartPosition = this.hls.liveSyncPosition || 0;
        }
      }
      const assetListLoader = this.assetListLoader.loadAssetList(
        interstitial as InterstitialEventWithAssetList,
        liveStartPosition,
      );
      if (assetListLoader) {
        interstitial.assetListLoader = assetListLoader;
      }
    } else if (!playOnce && assetListLength) {
      // Re-buffered to Interstitial boundary, re-create asset player(s)
      for (let i = assetListIndex; i < assetListLength; i++) {
        const asset = interstitial.assetList[i];
        const playerIndex = this.getAssetPlayerQueueIndex(asset.identifier);
        if (
          (playerIndex === -1 || this.playerQueue[playerIndex].destroyed) &&
          !asset.error
        ) {
          this.createAssetPlayer(interstitial, asset, i);
        }
      }
      return this.getAssetPlayer(
        interstitial.assetList[assetListIndex].identifier,
      );
    }
    return null;
  }

  private flushFrontBuffer(startOffset: number) {
    // Force queued flushing of all buffers
    const requiredTracks = this.requiredTracks;
    const sourceBufferNames = requiredTracks
      ? Object.keys(requiredTracks)
      : ['audio', 'video', 'audiovideo'];
    sourceBufferNames.forEach((type: SourceBufferName) => {
      this.hls.trigger(Events.BUFFER_FLUSHING, {
        startOffset,
        endOffset: Infinity,
        type,
      });
    });
  }

  // Interstitial Asset Player control
  private getAssetPlayerQueueIndex(assetId: InterstitialAssetId): number {
    const playerQueue = this.playerQueue;
    for (let i = 0; i < playerQueue.length; i++) {
      if (assetId === playerQueue[i].assetId) {
        return i;
      }
    }
    return -1;
  }

  private getAssetPlayer(assetId: InterstitialAssetId): HlsAssetPlayer | null {
    const index = this.getAssetPlayerQueueIndex(assetId);
    return this.playerQueue[index] || null;
  }

  private getBufferingPlayer(): HlsAssetPlayer | null {
    const { playerQueue, primaryMedia } = this;
    if (primaryMedia) {
      for (let i = 0; i < playerQueue.length; i++) {
        if (playerQueue[i].media === primaryMedia) {
          return playerQueue[i];
        }
      }
    }
    return null;
  }

  private createAsset(
    interstitial: InterstitialEvent,
    assetListIndex: number,
    startOffset: number,
    timelineStart: number,
    duration: number,
    uri: string,
  ): HlsAssetPlayer {
    const assetItem: InterstitialAssetItem = {
      parentIdentifier: interstitial.identifier,
      identifier: generateAssetIdentifier(interstitial, uri, assetListIndex),
      duration,
      startOffset,
      timelineStart,
      uri,
    };
    return this.createAssetPlayer(interstitial, assetItem, assetListIndex);
  }

  private createAssetPlayer(
    interstitial: InterstitialEvent,
    assetItem: InterstitialAssetItem,
    assetListIndex: number,
  ): HlsAssetPlayer {
    this.log(`createAssetPlayer ${interstitial.identifier} ${assetListIndex}`);
    const primary = this.hls;
    const userConfig = primary.userConfig;
    let videoPreference = userConfig.videoPreference;
    const currentLevel =
      primary.levels[primary.loadLevel] || primary.levels[primary.currentLevel];
    if (videoPreference || currentLevel) {
      videoPreference = Object.assign({}, videoPreference);
      if (currentLevel.videoCodec) {
        videoPreference.videoCodec = currentLevel.videoCodec;
      }
      if (currentLevel.videoRange) {
        videoPreference.allowedVideoRanges = [currentLevel.videoRange];
      }
    }
    const selectedAudio = primary.audioTracks[primary.audioTrack];
    const selectedSubtitle = primary.subtitleTracks[primary.subtitleTrack];
    let startPosition = 0;
    const timePastStart = this.timelinePos - assetItem.timelineStart;
    if (this.primaryLive && timePastStart > 1) {
      startPosition = timePastStart;
    }
    const playerConfig: Partial<HlsConfig> = {
      ...userConfig,
      // autoStartLoad: false,
      startFragPrefetch: true,
      primarySessionId: primary.sessionId,
      assetPlayerId: assetItem.identifier,
      abrEwmaDefaultEstimate: primary.bandwidthEstimate,
      interstitialsController: undefined,
      startPosition,
      liveDurationInfinity: false,
      testBandwidth: false,
      videoPreference,
      audioPreference: selectedAudio || userConfig.audioPreference,
      subtitlePreference: selectedSubtitle || userConfig.subtitlePreference,
    };
    const cmcd = playerConfig.cmcd;
    if (cmcd?.sessionId && cmcd.contentId) {
      playerConfig.cmcd = Object.assign({}, cmcd, {
        contentId: hash(assetItem.uri),
      });
    }
    if (interstitial.appendInPlace && assetItem.timelineStart) {
      playerConfig.timelineOffset = assetItem.timelineStart;
    }
    const player = new HlsAssetPlayer(
      this.HlsPlayerClass,
      playerConfig,
      interstitial,
      assetItem,
    );
    this.playerQueue.push(player);
    interstitial.assetList[assetListIndex] = assetItem;
    const assetId = assetItem.identifier;
    // Listen for LevelDetails and PTS change to update duration
    const updateAssetPlayerDetails = (details: LevelDetails) => {
      if (details.live) {
        const error = new Error(
          `Interstitials MUST be VOD assets ${interstitial}`,
        );
        const errorData: ErrorData = {
          fatal: true,
          type: ErrorTypes.OTHER_ERROR,
          details: ErrorDetails.INTERSTITIAL_ASSET_ITEM_ERROR,
          error,
        };
        this.handleAssetItemError(
          errorData,
          interstitial,
          this.schedule.findEventIndex(interstitial.identifier),
          assetListIndex,
          error.message,
        );
        return;
      }
      // Get time at end of last fragment
      const duration = details.edge - details.fragmentStart;
      const currentAssetDuration = assetItem.duration;
      if (currentAssetDuration === null || duration > currentAssetDuration) {
        this.log(
          `Interstitial asset ${assetId} duration change ${currentAssetDuration} > ${duration} (${assetItem.uri}`,
        );
        assetItem.duration = duration;
      }
      // Update schedule with new event and asset duration
      this.updateSchedule();
    };
    player.on(Events.LEVEL_UPDATED, (event, { details }) =>
      updateAssetPlayerDetails(details),
    );
    player.on(Events.LEVEL_PTS_UPDATED, (event, { details }) =>
      updateAssetPlayerDetails(details),
    );
    const onBufferCodecs = (
      event: Events.BUFFER_CODECS,
      data: BufferCodecsData,
    ) => {
      const inQueuPlayer = this.getAssetPlayer(assetId);
      if (inQueuPlayer && data.tracks) {
        inQueuPlayer.off(Events.BUFFER_CODECS, onBufferCodecs);
        inQueuPlayer.tracks = data.tracks;
        const media = this.primaryMedia;
        if (
          this.bufferingAsset === inQueuPlayer.assetItem &&
          media &&
          !inQueuPlayer.media
        ) {
          this.bufferAssetPlayer(inQueuPlayer, media);
        }
      }
    };
    player.on(Events.BUFFER_CODECS, onBufferCodecs);
    const bufferedToEnd = (name: Events.BUFFERED_TO_END) => {
      const inQueuPlayer = this.getAssetPlayer(assetId);
      this.log(`buffered to end of "${assetId}" player: ${inQueuPlayer}`);
      if (!inQueuPlayer) {
        return;
      }
      inQueuPlayer.off(Events.BUFFERED_TO_END, bufferedToEnd);

      // Preload at end of asset
      const scheduleIndex = this.schedule.findEventIndex(
        interstitial.identifier,
      );
      const assetListIndex = interstitial.assetList.indexOf(assetItem);
      const nextAssetIndex = assetListIndex + 1;
      const item = this.schedule.items?.[scheduleIndex];
      if (this.isInterstitial(item)) {
        if (
          assetListIndex !== -1 &&
          !interstitial.isAssetPastPlayoutLimit(nextAssetIndex) &&
          !interstitial.assetList[nextAssetIndex].error
        ) {
          this.bufferedToItem(item, assetListIndex + 1);
        } else {
          const nextItem = this.schedule.items?.[scheduleIndex + 1];
          if (nextItem) {
            this.bufferedToItem(nextItem);
          }
        }
      }
    };
    player.on(Events.BUFFERED_TO_END, bufferedToEnd);
    const endedWithAssetIndex = (assetIndex) => {
      return () => {
        const inQueuPlayer = this.getAssetPlayer(assetId);
        if (!inQueuPlayer) {
          return;
        }
        const scheduleIndex = this.schedule.findEventIndex(
          interstitial.identifier,
        );
        this.advanceAfterAssetEnded(interstitial, scheduleIndex, assetIndex);
      };
    };
    player.once(Events.MEDIA_ENDED, endedWithAssetIndex(assetListIndex));
    player.once(Events.PLAYOUT_LIMIT_REACHED, endedWithAssetIndex(Infinity));
    player.on(Events.ERROR, (event: Events.ERROR, data: ErrorData) => {
      this.handleAssetItemError(
        data,
        interstitial,
        this.schedule.findEventIndex(interstitial.identifier),
        assetListIndex,
        `Asset player error ${data.error} ${interstitial}`,
      );
    });
    player.on(Events.DESTROYING, () => {
      const inQueuPlayer = this.getAssetPlayer(assetId);
      if (!inQueuPlayer) {
        return;
      }
      const error = new Error(`Asset player destroyed unexpectedly ${assetId}`);
      const errorData: ErrorData = {
        fatal: true,
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.INTERSTITIAL_ASSET_ITEM_ERROR,
        error,
      };
      this.handleAssetItemError(
        errorData,
        interstitial,
        this.schedule.findEventIndex(interstitial.identifier),
        assetListIndex,
        error.message,
      );
    });

    this.hls.trigger(Events.INTERSTITIAL_ASSET_PLAYER_CREATED, {
      asset: assetItem,
      assetListIndex,
      event: interstitial,
      player,
    });
    return player;
  }

  private clearAssetPlayer(
    assetId: InterstitialAssetId,
    toSegment?: InterstitialScheduleItem | null,
  ) {
    if (toSegment === null) {
      return;
    }
    this.log(`clearAssetPlayer "${assetId}" toSegment: ${toSegment}`);
    const playerIndex = this.getAssetPlayerQueueIndex(assetId);
    if (playerIndex !== -1) {
      const player = this.playerQueue[playerIndex];
      this.transferMediaFromPlayer(player, toSegment);
      this.playerQueue.splice(playerIndex, 1);
      player.destroy();
    }
  }

  private emptyPlayerQueue() {
    let player: HlsAssetPlayer | undefined;
    while ((player = this.playerQueue.pop())) {
      player.destroy();
    }
    this.playerQueue = [];
  }

  private startAssetPlayer(
    player: HlsAssetPlayer,
    assetListIndex: number,
    scheduleItems: InterstitialScheduleItem[],
    scheduleIndex: number,
    media: HTMLMediaElement,
  ) {
    const { interstitial, assetItem, assetId } = player;
    const assetListLength = interstitial.assetList.length;

    const playingAsset = this.playingAsset;
    this.playingAsset = assetItem;
    if (!playingAsset || playingAsset.identifier !== assetId) {
      if (playingAsset) {
        // Exiting another Interstitial asset
        this.clearAssetPlayer(
          playingAsset.identifier,
          scheduleItems[scheduleIndex],
        );
        delete playingAsset.error;
      }
      this.log(
        `INTERSTITIAL_ASSET_STARTED ${assetListIndex + 1}/${assetListLength}`,
      );
      // player.resumeBuffering();
      this.hls.trigger(Events.INTERSTITIAL_ASSET_STARTED, {
        asset: assetItem,
        assetListIndex,
        event: interstitial,
        schedule: scheduleItems.slice(0),
        scheduleIndex,
        player,
      });
    }

    // detach media and attach to interstitial player if it does not have another element attached
    if (!player.media) {
      this.bufferAssetPlayer(player, media);
    }
  }

  private bufferAssetPlayer(player: HlsAssetPlayer, media: HTMLMediaElement) {
    const { interstitial, assetItem, assetId } = player;
    const scheduleIndex = this.schedule.findEventIndex(interstitial.identifier);
    const item = this.schedule.items?.[scheduleIndex];
    if (!item) {
      return;
    }
    this.setBufferingItem(item);
    this.bufferingAsset = assetItem;
    const bufferingPlayer = this.getBufferingPlayer();
    if (bufferingPlayer === player) {
      return;
    }
    const activeTracks =
      bufferingPlayer?.tracks ||
      this.detachedData?.tracks ||
      this.requiredTracks;
    if (interstitial.appendInPlace && assetItem !== this.playingAsset) {
      // Do not buffer another item if tracks are unknown or incompatible
      if (!player.tracks) {
        return;
      }
      if (
        activeTracks &&
        !isCompatibleTrackChange(activeTracks, player.tracks)
      ) {
        const error = new Error(
          `Asset "${assetId}" SourceBuffer tracks ('${Object.keys(player.tracks)}') are not compatible with primary content tracks ('${Object.keys(activeTracks)}')`,
        );
        const errorData: ErrorData = {
          fatal: true,
          type: ErrorTypes.OTHER_ERROR,
          details: ErrorDetails.INTERSTITIAL_ASSET_ITEM_ERROR,
          error,
        };
        const assetListIndex = interstitial.assetList.indexOf(assetItem);
        this.handleAssetItemError(
          errorData,
          interstitial,
          scheduleIndex,
          assetListIndex,
          error.message,
        );
        return;
      }
    }

    this.transferMediaTo(player, media);
  }

  private handleAssetItemError(
    data: ErrorData,
    interstitial: InterstitialEvent,
    scheduleIndex: number,
    assetListIndex: number,
    errorMessage: string,
  ) {
    if (data.details === ErrorDetails.BUFFER_STALLED_ERROR) {
      return;
    }

    const assetItem = interstitial.assetList[assetListIndex] || null;
    let player: HlsAssetPlayer | null = null;
    if (assetItem) {
      const playerIndex = this.getAssetPlayerQueueIndex(assetItem.identifier);
      player = this.playerQueue[playerIndex] || null;
    }
    const items = this.schedule.items;
    const interstitialAssetError = Object.assign({}, data, {
      fatal: false,
      errorAction: createDoNothingErrorAction(true),
      asset: assetItem,
      assetListIndex,
      event: interstitial,
      schedule: items,
      scheduleIndex,
      player,
    });
    this.warn(`Asset item error: ${data.error}`);
    this.hls.trigger(Events.INTERSTITIAL_ASSET_ERROR, interstitialAssetError);
    if (!data.fatal) {
      return;
    }

    const error = new Error(errorMessage);
    if (assetItem) {
      if (this.playingAsset !== assetItem) {
        this.clearAssetPlayer(assetItem.identifier);
      }
      assetItem.error = error;
    }

    // If all assets in interstitial fail, mark the interstitial with an error
    if (!interstitial.assetList.some((asset) => !asset.error)) {
      interstitial.error = error;
    } else if (interstitial.appendInPlace) {
      // Skip entire interstitial since moving up subsequent assets is error prone
      interstitial.error = error;
    }

    this.primaryFallback(interstitial);
  }

  private primaryFallback(interstitial: InterstitialEvent) {
    // Fallback to Primary by on current or future events by updating schedule to skip errored interstitials/assets
    const flushStart = interstitial.timelineStart;
    const playingItem = this.playingItem || this.waitingItem;
    // Update schedule now that interstitial/assets are flagged with `error` for fallback
    this.updateSchedule();
    if (playingItem) {
      if (interstitial.appendInPlace) {
        interstitial.appendInPlace = false;
        this.attachPrimary(flushStart, null);
        this.flushFrontBuffer(flushStart);
      }
      let timelinePos = this.timelinePos;
      if (timelinePos === -1) {
        timelinePos = this.hls.startPosition;
      }
      const newPlayingItem = this.updateItem(playingItem, timelinePos);
      if (!this.itemsMatch(playingItem, newPlayingItem)) {
        const scheduleIndex = this.schedule.findItemIndexAtTime(timelinePos);
        this.setSchedulePosition(scheduleIndex);
      }
    } else {
      this.checkStart();
    }
  }

  // Asset List loading
  private onAssetListLoaded(
    event: Events.ASSET_LIST_LOADED,
    data: AssetListLoadedData,
  ) {
    const interstitial = data.event;
    const interstitialId = interstitial.identifier;
    const assets = data.assetListResponse.ASSETS;
    if (!this.schedule.hasEvent(interstitialId)) {
      // Interstitial with id was removed
      return;
    }
    const eventStart = interstitial.timelineStart;
    let sumDuration = 0;
    assets.forEach((asset, assetListIndex) => {
      const duration = parseFloat(asset.DURATION);
      this.createAsset(
        interstitial,
        assetListIndex,
        sumDuration,
        eventStart + sumDuration,
        duration,
        asset.URI,
      );
      sumDuration += duration;
    });
    interstitial.duration = sumDuration;

    const waitingItem = this.waitingItem;
    const waitingForItem = waitingItem?.event.identifier === interstitialId;

    // Update schedule now that asset.DURATION(s) are parsed
    this.updateSchedule();

    const bufferingEvent = this.bufferingItem?.event;

    // If buffer reached Interstitial, start buffering first asset
    if (waitingForItem) {
      // Advance schedule when waiting for asset list data to play
      const scheduleIndex = this.schedule.findEventIndex(interstitialId);
      const item = this.schedule.items?.[scheduleIndex];
      if (item) {
        this.setBufferingItem(item);
      }
      this.setSchedulePosition(scheduleIndex);
    } else if (
      bufferingEvent?.identifier === interstitialId &&
      bufferingEvent.appendInPlace
    ) {
      // If buffering (but not playback) has reached this item transfer media-source
      const assetItem = interstitial.assetList[0];
      const player = this.getAssetPlayer(assetItem.identifier);
      const media = this.primaryMedia;
      if (assetItem && player && media) {
        this.bufferAssetPlayer(player, media);
      }
    }
  }

  private onError(event: Events.ERROR, data: ErrorData) {
    switch (data.details) {
      case ErrorDetails.ASSET_LIST_PARSING_ERROR:
      case ErrorDetails.ASSET_LIST_LOAD_ERROR:
      case ErrorDetails.ASSET_LIST_LOAD_TIMEOUT: {
        const interstitial = data.interstitial;
        if (interstitial) {
          this.primaryFallback(interstitial);
        }
      }
    }
  }
}
