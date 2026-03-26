import { State } from './base-stream-controller';
import { Events } from '../events';
import { type LoaderStats, PlaylistLevelType } from '../types/loader';
import { BufferHelper } from '../utils/buffer-helper';
import { Logger } from '../utils/logger';
import { getVideoPreference } from '../utils/rendition-helper';
import type { HlsConfig } from '../config';
import type Hls from '../hls';
import type StreamController from './stream-controller';
import type { Fragment, MediaFragment, Part } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type {
  InitPTSFoundData,
  LevelsUpdatedData,
  ManifestLoadedData,
} from '../types/events';
import type { Level, VariableMap } from '../types/level';
import type { TimestampOffset } from '../utils/timescale-conversion';

type Constructor<T = object, A extends any[] = any[], Static = {}> = (new (
  ...a: A
) => T) &
  Static;

export type LoadMediaAtOptions = { seekOnAppend: boolean };

const loadMediaAtOptionsDefault: LoadMediaAtOptions = {
  seekOnAppend: true,
};

export interface HlsIFramesOnly extends Hls {
  loadMediaAt(time: number, options?: Partial<LoadMediaAtOptions>): void;
}
interface IFrameStreamController extends StreamController {
  initDetails?: LevelDetails | null;
  setInitPts(initPTS: TimestampOffset[]): void;
  loadMediaAt(time: number, options: LoadMediaAtOptions): void;
}

let HlsIFramesOnlyClass: ReturnType<typeof createHlsIFramesOnly>;

export class IFrameController extends Logger {
  private hls: Hls | undefined;

  // ManifestLoadedData forwarded to iframe instances
  private stats?: LoaderStats;
  private variableList: VariableMap | null = null;

  private initPTS: TimestampOffset[] = [];

  private iframeInstances: HlsIFramesOnly[];
  private instanceCounter: number = 0;

  constructor(hls: Hls, HlsPlayerClass: typeof Hls) {
    super('iframes', hls.logger);
    HlsIFramesOnlyClass ||= createHlsIFramesOnly(HlsPlayerClass);
    this.hls = hls;
    this.iframeInstances = [];
    this.registerListeners();
  }

  private registerListeners() {
    const hls = this.hls;
    if (hls) {
      hls.on(Events.MANIFEST_LOADING, this.clearAsset, this);
      hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
      hls.on(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
      hls.on(Events.INIT_PTS_FOUND, this.onInitPtsFound, this);
      hls.on(Events.DESTROYING, this.onDestroying, this);
    }
  }

  private unregisterListeners() {
    const hls = this.hls;
    if (hls) {
      hls.off(Events.MANIFEST_LOADING, this.clearAsset, this);
      hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
      hls.off(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
      hls.off(Events.INIT_PTS_FOUND, this.onInitPtsFound, this);
      hls.off(Events.DESTROYING, this.onDestroying, this);
    }
  }

  private clearAsset() {
    this.stats = undefined;
    this.variableList = null;
    this.initPTS = [];
    this.iframeInstances.forEach((instance) => instance.destroy());
    this.iframeInstances.length = 0;
  }

  private onDestroying() {
    this.unregisterListeners();
    this.clearAsset();
    this.hls = undefined;
  }

  private onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    data: ManifestLoadedData,
  ) {
    this.stats = data.stats;
    this.variableList = data.variableList;
  }

  private onLevelsUpdated(
    event: Events.LEVELS_UPDATED,
    { levels }: LevelsUpdatedData,
  ) {
    // Check for Pathway switch and priority change
    const pathwayPriority = this.hls?.pathwayPriority;
    if (levels.length && pathwayPriority) {
      this.iframeInstances.forEach((instance) => {
        instance.pathwayPriority = pathwayPriority;
      });
    }
  }

  private onInitPtsFound(
    event: Events.INIT_PTS_FOUND,
    { id, timestampOffsets }: InitPTSFoundData,
  ) {
    if (id === PlaylistLevelType.MAIN) {
      this.initPTS = timestampOffsets;
    }
  }

  public createIFramePlayer(
    configOverride?: Partial<HlsConfig> | undefined,
  ): HlsIFramesOnly | null {
    const { hls } = this;
    if (!hls) {
      return null;
    }
    const {
      iframeVariants,
      url,
      userConfig,
      latestLevelDetails,
      loadLevelObj,
      loadLevel,
      bandwidthEstimate,
      sessionId,
    } = hls;
    const { stats, variableList } = this;
    if (!iframeVariants || !stats || !url) {
      return null;
    }
    const loggerId = `iframe-player-${this.instanceCounter++}`;
    const levels = hls.levels as (Level | undefined)[];
    const activeLevel = loadLevelObj || levels[loadLevel];
    const videoPreference = getVideoPreference(
      activeLevel,
      userConfig.videoPreference,
    );
    const pathwayId = activeLevel?.pathwayId || '.';

    const iframeInstance = new HlsIFramesOnlyClass(
      userConfig,
      {
        loggerId,
        primarySessionId: sessionId,
        videoPreference,
        abrEwmaDefaultEstimate: bandwidthEstimate,
        streamController: hls.config.streamController,
      },
      configOverride,
      url,
      this.initPTS,
      latestLevelDetails,
    );

    // Remove destroyed instanced from list before adding new ones
    this.iframeInstances = this.iframeInstances.filter(
      (instance) => !instance.url,
    );
    this.iframeInstances.push(iframeInstance);

    iframeInstance.trigger(Events.MANIFEST_LOADED, {
      levels: iframeVariants,
      contentSteering: { uri: '', pathwayId },
      sessionKeys: null,
      audioTracks: [],
      iframeVariants: [],
      sessionData: null,
      startTimeOffset: null,
      stats,
      networkDetails: null,
      url,
      variableList,
    });

    return iframeInstance;
  }
}

interface HlsIFramesOnlyAlias extends HlsIFramesOnly {}

function createHlsIFramesOnly(Base: Constructor<Hls>) {
  return class HlsIFramesOnly extends Base implements HlsIFramesOnlyAlias {
    constructor(
      userConfig: Partial<HlsConfig>,
      parentConfig: Partial<HlsConfig> & {
        streamController: typeof StreamController;
      },
      configOverride: Partial<HlsConfig> | undefined,
      url: string,
      initPTS: TimestampOffset[],
      latestLevelDetails: LevelDetails | null,
    ) {
      const playerConfig: Partial<HlsConfig> = {
        ...userConfig,
        ...parentConfig,

        streamController: createIFrameStreamController(
          parentConfig.streamController,
        ),

        // Disable features not essential to streaming video I-Frames
        audioStreamController: undefined,
        audioTrackController: undefined,
        subtitleStreamController: undefined,
        subtitleTrackController: undefined,
        timelineController: undefined,
        id3TrackController: undefined,
        fpsController: undefined,
        gapController: undefined,
        iframeController: undefined,
        cmcd: undefined,
        // FIXME: Interstitials must not be loaded independently of parent platyer. Schedule should come from parent. (disabled for now)
        interstitialsController: undefined,

        // Only load and unload as needed
        // maxMaxBufferLength: 8,
        backBufferLength: Infinity,
        // Adapt to attached HTMLVideoElement dimension
        capLevelToPlayerSize: true,

        // Streamline loading
        enableWorker: false,
        autoStartLoad: false,
        startFragPrefetch: false,
        testBandwidth: false,
        progressive: false,
        // startOnSegmentBoundary: true,
        ...configOverride,
      };

      super(playerConfig);

      // Hls.url matches the parent player session source url.
      // `Hls.url==null` is used in many places to determine if the instance was destroyed.
      this._url = url;

      // Align timestamps based on parent initPts (accounts for audio prime offset and parent variant decode time difference)
      (this.streamController as IFrameStreamController).setInitPts(initPTS);
      (this.streamController as IFrameStreamController).initDetails =
        latestLevelDetails;
    }

    loadSource(url: string) {}

    loadMediaAt(
      time: number,
      options: Partial<LoadMediaAtOptions> = loadMediaAtOptionsDefault,
    ) {
      if (time < 0) {
        return;
      }
      const settings = {
        ...loadMediaAtOptionsDefault,
        ...options,
      };
      if (!this.loadingEnabled) {
        this.startLoad(time);
      }
      (this.streamController as IFrameStreamController).loadMediaAt(
        time,
        settings,
      );
    }
  };
}

interface IFrameStreamControllerAlias extends IFrameStreamController {}

function createIFrameStreamController(Base: Constructor<StreamController>) {
  return class IFrameStreamController
    extends Base
    implements IFrameStreamControllerAlias
  {
    private currentOp?: [time: number, options: LoadMediaAtOptions];
    private nextOp?: [time: number, options: LoadMediaAtOptions];
    private gotNext: boolean = false;
    initDetails?: LevelDetails | null;

    setInitPts(initPTS: TimestampOffset[]) {
      this.initPTS = initPTS;
    }

    loadMediaAt(time: number, options: LoadMediaAtOptions) {
      const { seekOnAppend } = options;
      const adjustedTime = time + this.timelineOffset;
      this.nextLoadPosition = this.lastCurrentTime = adjustedTime;
      this.startPosition = time;
      switch (this.state) {
        case State.STOPPED:
        case State.ENDED:
        case State.ERROR:
          this.state = State.IDLE;
      }
      if (this.state === State.IDLE) {
        this.hls.resumeBuffering();
        this.tick();
        this.currentOp = [adjustedTime, options];
      } else {
        const fragCurrent = this.fragCurrent;
        if (
          !fragCurrent ||
          (time >= fragCurrent.start && time < fragCurrent.end)
        ) {
          this.nextOp = [adjustedTime, options];
        }
      }
      const media = this.media;
      if (seekOnAppend && media) {
        const seeking = this.seekTo(adjustedTime);
        if (seeking) {
          this.currentOp = [adjustedTime, options];
          this.nextOp = undefined;
        }
      }
    }

    private seekTo(time: number): boolean {
      const media = this.media;
      if (media) {
        const bufferInfo = BufferHelper.bufferInfo(media, time, 0);
        const hasEnough = bufferInfo.len > 0 && this.getBufferedAt(time);
        if (hasEnough) {
          media.currentTime = time;
          if (this.state === State.IDLE) {
            this.tick();
          }
          return true;
        }
      }
      return false;
    }

    private getBufferedAt(time: number): MediaFragment | null {
      return this.fragmentTracker.getBufferedFrag(time, PlaylistLevelType.MAIN);
    }

    // overrides
    protected fragBufferedComplete(frag: Fragment, part: Part | null) {
      super.fragBufferedComplete(frag, part);

      const { currentOp, nextOp } = this;
      this.currentOp = this.nextOp = undefined;
      this.state = State.STOPPED;
      if (currentOp?.[1].seekOnAppend) {
        this.seekTo(currentOp[0]);
        if (!nextOp && !this.gotNext) {
          // repeat op to get next segment (Chrome may require two HEVC frame appends, or one with EoS, before rendering)
          this.gotNext = true;
          this.loadMediaAt.apply(this, currentOp);
        }
      }
      if (nextOp) {
        this.loadMediaAt.apply(this, nextOp);
      }
    }

    get playhead(): number {
      return this.nextLoadPosition;
    }

    startLoad() {
      if (!this.startFragRequested) {
        const hlsIFrames = this.hls;
        hlsIFrames.nextLoadLevel =
          hlsIFrames.startLevel === -1 ? 0 : hlsIFrames.firstAutoLevel;
      }
    }
    // public getLevelDetails
    protected seekToStartPos() {}
    protected setStartPosition() {}
    protected onMediaSeeking = () => {
      this.gotNext = false;
    };

    protected alignPlaylists(
      details: LevelDetails,
      previousDetails: LevelDetails | undefined,
      switchDetails: LevelDetails | undefined,
    ): number {
      return super.alignPlaylists(
        details,
        previousDetails,
        switchDetails || this.initDetails || undefined,
      );
    }

    getMainFwdBufferInfo() {
      const t = this.playhead;
      const bufferedFragAtPos = this.getBufferedAt(t);
      if (bufferedFragAtPos) {
        const len = bufferedFragAtPos.duration;
        return { len, start: t, end: t + len, bufferedIndex: -1 };
      }
      return { len: 0, start: t, end: t, bufferedIndex: -1 };
    }

    protected _streamEnded() {
      const t = this.playhead;
      const bufferedFragAtPos = this.fragmentTracker.getBufferedFrag(
        t,
        PlaylistLevelType.MAIN,
      );
      return !!bufferedFragAtPos?.endList;
    }
  };
}
