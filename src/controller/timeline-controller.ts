import { Events } from '../events';
import Cea608Parser, { CaptionScreen } from '../utils/cea-608-parser';
import OutputFilter from '../utils/output-filter';
import { parseWebVTT } from '../utils/webvtt-parser';
import {
  sendAddTrackEvent,
  clearCurrentCues,
  addCueToTrack,
  removeCuesInRange,
} from '../utils/texttrack-utils';
import { parseIMSC1, IMSC1_CODEC } from '../utils/imsc1-ttml-parser';
import { appendUint8Array } from '../utils/mp4-tools';
import { PlaylistLevelType } from '../types/loader';
import { Fragment } from '../loader/fragment';
import {
  FragParsingUserdataData,
  FragLoadedData,
  FragDecryptedData,
  MediaAttachingData,
  ManifestLoadedData,
  InitPTSFoundData,
  SubtitleTracksUpdatedData,
  BufferFlushingData,
  FragLoadingData,
} from '../types/events';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import type { ComponentAPI } from '../types/component-api';
import type { HlsConfig } from '../config';
import type { CuesInterface } from '../utils/cues';
import type { MediaPlaylist } from '../types/media-playlist';
import type { VTTCCs } from '../types/vtt';

type TrackProperties = {
  label: string;
  languageCode: string;
  media?: MediaPlaylist;
};

type NonNativeCaptionsTrack = {
  _id?: string;
  label: string;
  kind: string;
  default: boolean;
  closedCaptions?: MediaPlaylist;
  subtitleTrack?: MediaPlaylist;
};

export class TimelineController implements ComponentAPI {
  private hls: Hls;
  private media: HTMLMediaElement | null = null;
  private config: HlsConfig;
  private enabled: boolean = true;
  private Cues: CuesInterface;
  private textTracks: Array<TextTrack> = [];
  private tracks: Array<MediaPlaylist> = [];
  private initPTS: Array<number> = [];
  private timescale: Array<number> = [];
  private unparsedVttFrags: Array<FragLoadedData | FragDecryptedData> = [];
  private captionsTracks: Record<string, TextTrack> = {};
  private nonNativeCaptionsTracks: Record<string, NonNativeCaptionsTrack> = {};
  private cea608Parser1!: Cea608Parser;
  private cea608Parser2!: Cea608Parser;
  private lastSn: number = -1;
  private lastPartIndex: number = -1;
  private prevCC: number = -1;
  private vttCCs: VTTCCs = newVTTCCs();
  private captionsProperties: {
    textTrack1: TrackProperties;
    textTrack2: TrackProperties;
    textTrack3: TrackProperties;
    textTrack4: TrackProperties;
  };

  constructor(hls: Hls) {
    this.hls = hls;
    this.config = hls.config;
    this.Cues = hls.config.cueHandler;

    this.captionsProperties = {
      textTrack1: {
        label: this.config.captionsTextTrack1Label,
        languageCode: this.config.captionsTextTrack1LanguageCode,
      },
      textTrack2: {
        label: this.config.captionsTextTrack2Label,
        languageCode: this.config.captionsTextTrack2LanguageCode,
      },
      textTrack3: {
        label: this.config.captionsTextTrack3Label,
        languageCode: this.config.captionsTextTrack3LanguageCode,
      },
      textTrack4: {
        label: this.config.captionsTextTrack4Label,
        languageCode: this.config.captionsTextTrack4LanguageCode,
      },
    };

    if (this.config.enableCEA708Captions) {
      const channel1 = new OutputFilter(this, 'textTrack1');
      const channel2 = new OutputFilter(this, 'textTrack2');
      const channel3 = new OutputFilter(this, 'textTrack3');
      const channel4 = new OutputFilter(this, 'textTrack4');
      this.cea608Parser1 = new Cea608Parser(1, channel1, channel2);
      this.cea608Parser2 = new Cea608Parser(3, channel3, channel4);
    }

    hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.on(Events.SUBTITLE_TRACKS_UPDATED, this.onSubtitleTracksUpdated, this);
    hls.on(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.FRAG_PARSING_USERDATA, this.onFragParsingUserdata, this);
    hls.on(Events.FRAG_DECRYPTED, this.onFragDecrypted, this);
    hls.on(Events.INIT_PTS_FOUND, this.onInitPtsFound, this);
    hls.on(Events.SUBTITLE_TRACKS_CLEARED, this.onSubtitleTracksCleared, this);
    hls.on(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
  }

  public destroy(): void {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.off(Events.SUBTITLE_TRACKS_UPDATED, this.onSubtitleTracksUpdated, this);
    hls.off(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.FRAG_PARSING_USERDATA, this.onFragParsingUserdata, this);
    hls.off(Events.FRAG_DECRYPTED, this.onFragDecrypted, this);
    hls.off(Events.INIT_PTS_FOUND, this.onInitPtsFound, this);
    hls.off(Events.SUBTITLE_TRACKS_CLEARED, this.onSubtitleTracksCleared, this);
    hls.off(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    // @ts-ignore
    this.hls = this.config = this.cea608Parser1 = this.cea608Parser2 = null;
  }

  public addCues(
    trackName: string,
    startTime: number,
    endTime: number,
    screen: CaptionScreen,
    cueRanges: Array<[number, number]>
  ) {
    // skip cues which overlap more than 50% with previously parsed time ranges
    let merged = false;
    for (let i = cueRanges.length; i--; ) {
      const cueRange = cueRanges[i];
      const overlap = intersection(
        cueRange[0],
        cueRange[1],
        startTime,
        endTime
      );
      if (overlap >= 0) {
        cueRange[0] = Math.min(cueRange[0], startTime);
        cueRange[1] = Math.max(cueRange[1], endTime);
        merged = true;
        if (overlap / (endTime - startTime) > 0.5) {
          return;
        }
      }
    }
    if (!merged) {
      cueRanges.push([startTime, endTime]);
    }

    if (this.config.renderTextTracksNatively) {
      const track = this.captionsTracks[trackName];
      this.Cues.newCue(track, startTime, endTime, screen);
    } else {
      const cues = this.Cues.newCue(null, startTime, endTime, screen);
      this.hls.trigger(Events.CUES_PARSED, {
        type: 'captions',
        cues,
        track: trackName,
      });
    }
  }

  // Triggered when an initial PTS is found; used for synchronisation of WebVTT.
  private onInitPtsFound(
    event: Events.INIT_PTS_FOUND,
    { frag, id, initPTS, timescale }: InitPTSFoundData
  ) {
    const { unparsedVttFrags } = this;
    if (id === 'main') {
      this.initPTS[frag.cc] = initPTS;
      this.timescale[frag.cc] = timescale;
    }

    // Due to asynchronous processing, initial PTS may arrive later than the first VTT fragments are loaded.
    // Parse any unparsed fragments upon receiving the initial PTS.
    if (unparsedVttFrags.length) {
      this.unparsedVttFrags = [];
      unparsedVttFrags.forEach((frag) => {
        this.onFragLoaded(Events.FRAG_LOADED, frag as FragLoadedData);
      });
    }
  }

  private getExistingTrack(trackName: string): TextTrack | null {
    const { media } = this;
    if (media) {
      for (let i = 0; i < media.textTracks.length; i++) {
        const textTrack = media.textTracks[i];
        if (textTrack[trackName]) {
          return textTrack;
        }
      }
    }
    return null;
  }

  public createCaptionsTrack(trackName: string) {
    if (this.config.renderTextTracksNatively) {
      this.createNativeTrack(trackName);
    } else {
      this.createNonNativeTrack(trackName);
    }
  }

  private createNativeTrack(trackName: string) {
    if (this.captionsTracks[trackName]) {
      return;
    }
    const { captionsProperties, captionsTracks, media } = this;
    const { label, languageCode } = captionsProperties[trackName];
    // Enable reuse of existing text track.
    const existingTrack = this.getExistingTrack(trackName);
    if (!existingTrack) {
      const textTrack = this.createTextTrack('captions', label, languageCode);
      if (textTrack) {
        // Set a special property on the track so we know it's managed by Hls.js
        textTrack[trackName] = true;
        captionsTracks[trackName] = textTrack;
      }
    } else {
      captionsTracks[trackName] = existingTrack;
      clearCurrentCues(captionsTracks[trackName]);
      sendAddTrackEvent(captionsTracks[trackName], media as HTMLMediaElement);
    }
  }

  private createNonNativeTrack(trackName: string) {
    if (this.nonNativeCaptionsTracks[trackName]) {
      return;
    }
    // Create a list of a single track for the provider to consume
    const trackProperties: TrackProperties = this.captionsProperties[trackName];
    if (!trackProperties) {
      return;
    }
    const label = trackProperties.label as string;
    const track = {
      _id: trackName,
      label,
      kind: 'captions',
      default: trackProperties.media ? !!trackProperties.media.default : false,
      closedCaptions: trackProperties.media,
    };
    this.nonNativeCaptionsTracks[trackName] = track;
    this.hls.trigger(Events.NON_NATIVE_TEXT_TRACKS_FOUND, { tracks: [track] });
  }

  private createTextTrack(
    kind: TextTrackKind,
    label: string,
    lang?: string
  ): TextTrack | undefined {
    const media = this.media;
    if (!media) {
      return;
    }
    return media.addTextTrack(kind, label, lang);
  }

  private onMediaAttaching(
    event: Events.MEDIA_ATTACHING,
    data: MediaAttachingData
  ) {
    this.media = data.media;
    this._cleanTracks();
  }

  private onMediaDetaching() {
    const { captionsTracks } = this;
    Object.keys(captionsTracks).forEach((trackName) => {
      clearCurrentCues(captionsTracks[trackName]);
      delete captionsTracks[trackName];
    });
    this.nonNativeCaptionsTracks = {};
  }

  private onManifestLoading() {
    this.lastSn = -1; // Detect discontinuity in fragment parsing
    this.lastPartIndex = -1;
    this.prevCC = -1;
    this.vttCCs = newVTTCCs(); // Detect discontinuity in subtitle manifests
    this._cleanTracks();
    this.tracks = [];
    this.captionsTracks = {};
    this.nonNativeCaptionsTracks = {};
    this.textTracks = [];
    this.unparsedVttFrags = this.unparsedVttFrags || [];
    this.initPTS = [];
    this.timescale = [];
    if (this.cea608Parser1 && this.cea608Parser2) {
      this.cea608Parser1.reset();
      this.cea608Parser2.reset();
    }
  }

  private _cleanTracks() {
    // clear outdated subtitles
    const { media } = this;
    if (!media) {
      return;
    }
    const textTracks = media.textTracks;
    if (textTracks) {
      for (let i = 0; i < textTracks.length; i++) {
        clearCurrentCues(textTracks[i]);
      }
    }
  }

  private onSubtitleTracksUpdated(
    event: Events.SUBTITLE_TRACKS_UPDATED,
    data: SubtitleTracksUpdatedData
  ) {
    this.textTracks = [];
    const tracks: Array<MediaPlaylist> = data.subtitleTracks || [];
    const hasIMSC1 = tracks.some((track) => track.textCodec === IMSC1_CODEC);
    if (this.config.enableWebVTT || (hasIMSC1 && this.config.enableIMSC1)) {
      const sameTracks =
        this.tracks && tracks && this.tracks.length === tracks.length;
      this.tracks = tracks || [];

      if (this.config.renderTextTracksNatively) {
        const inUseTracks = this.media ? this.media.textTracks : [];

        this.tracks.forEach((track, index) => {
          let textTrack: TextTrack | undefined;
          if (index < inUseTracks.length) {
            let inUseTrack: TextTrack | null = null;

            for (let i = 0; i < inUseTracks.length; i++) {
              if (canReuseVttTextTrack(inUseTracks[i], track)) {
                inUseTrack = inUseTracks[i];
                break;
              }
            }

            // Reuse tracks with the same label, but do not reuse 608/708 tracks
            if (inUseTrack) {
              textTrack = inUseTrack;
            }
          }
          if (textTrack) {
            clearCurrentCues(textTrack);
          } else {
            const textTrackKind =
              this._captionsOrSubtitlesFromCharacteristics(track);
            textTrack = this.createTextTrack(
              textTrackKind,
              track.name,
              track.lang
            );
            if (textTrack) {
              textTrack.mode = 'disabled';
            }
          }
          if (textTrack) {
            (textTrack as any).groupId = track.groupId;
            this.textTracks.push(textTrack);
          }
        });
      } else if (!sameTracks && this.tracks && this.tracks.length) {
        // Create a list of tracks for the provider to consume
        const tracksList = this.tracks.map((track) => {
          return {
            label: track.name,
            kind: track.type.toLowerCase(),
            default: track.default,
            subtitleTrack: track,
          };
        });
        this.hls.trigger(Events.NON_NATIVE_TEXT_TRACKS_FOUND, {
          tracks: tracksList,
        });
      }
    }
  }

  private _captionsOrSubtitlesFromCharacteristics(
    track: MediaPlaylist
  ): TextTrackKind {
    if (track.attrs?.CHARACTERISTICS) {
      const transcribesSpokenDialog = /transcribes-spoken-dialog/gi.test(
        track.attrs.CHARACTERISTICS
      );
      const describesMusicAndSound = /describes-music-and-sound/gi.test(
        track.attrs.CHARACTERISTICS
      );

      if (transcribesSpokenDialog && describesMusicAndSound) {
        return 'captions';
      }
    }

    return 'subtitles';
  }

  private onManifestLoaded(
    event: Events.MANIFEST_LOADED,
    data: ManifestLoadedData
  ) {
    if (this.config.enableCEA708Captions && data.captions) {
      data.captions.forEach((captionsTrack) => {
        const instreamIdMatch = /(?:CC|SERVICE)([1-4])/.exec(
          captionsTrack.instreamId as string
        );
        if (!instreamIdMatch) {
          return;
        }
        const trackName = `textTrack${instreamIdMatch[1]}`;
        const trackProperties: TrackProperties =
          this.captionsProperties[trackName];
        if (!trackProperties) {
          return;
        }
        trackProperties.label = captionsTrack.name;
        if (captionsTrack.lang) {
          // optional attribute
          trackProperties.languageCode = captionsTrack.lang;
        }
        trackProperties.media = captionsTrack;
      });
    }
  }

  private closedCaptionsForLevel(frag: Fragment): string | undefined {
    const level = this.hls.levels[frag.level];
    return level?.attrs['CLOSED-CAPTIONS'];
  }

  private onFragLoading(event: Events.FRAG_LOADING, data: FragLoadingData) {
    const { cea608Parser1, cea608Parser2, lastSn, lastPartIndex } = this;
    if (!this.enabled || !(cea608Parser1 && cea608Parser2)) {
      return;
    }
    // if this frag isn't contiguous, clear the parser so cues with bad start/end times aren't added to the textTrack
    if (data.frag.type === PlaylistLevelType.MAIN) {
      const sn = data.frag.sn;
      const partIndex = data?.part?.index ?? -1;
      if (
        !(
          sn === lastSn + 1 ||
          (sn === lastSn && partIndex === lastPartIndex + 1)
        )
      ) {
        cea608Parser1.reset();
        cea608Parser2.reset();
      }
      this.lastSn = sn as number;
      this.lastPartIndex = partIndex;
    }
  }

  private onFragLoaded(
    event: Events.FRAG_LOADED,
    data: FragDecryptedData | FragLoadedData
  ) {
    const { frag, payload } = data;
    const { initPTS, unparsedVttFrags } = this;
    if (frag.type === PlaylistLevelType.SUBTITLE) {
      // If fragment is subtitle type, parse as WebVTT.
      if (payload.byteLength) {
        // We need an initial synchronisation PTS. Store fragments as long as none has arrived.
        if (!Number.isFinite(initPTS[frag.cc])) {
          unparsedVttFrags.push(data);
          if (initPTS.length) {
            // finish unsuccessfully, otherwise the subtitle-stream-controller could be blocked from loading new frags.
            this.hls.trigger(Events.SUBTITLE_FRAG_PROCESSED, {
              success: false,
              frag,
              error: new Error('Missing initial subtitle PTS'),
            });
          }
          return;
        }

        const decryptData = frag.decryptdata;
        // fragment after decryption has a stats object
        const decrypted = 'stats' in data;
        // If the subtitles are not encrypted, parse VTTs now. Otherwise, we need to wait.
        if (decryptData == null || !decryptData.encrypted || decrypted) {
          const trackPlaylistMedia = this.tracks[frag.level];
          const vttCCs = this.vttCCs;
          if (!vttCCs[frag.cc]) {
            vttCCs[frag.cc] = {
              start: frag.start,
              prevCC: this.prevCC,
              new: true,
            };
            this.prevCC = frag.cc;
          }
          if (
            trackPlaylistMedia &&
            trackPlaylistMedia.textCodec === IMSC1_CODEC
          ) {
            this._parseIMSC1(frag, payload);
          } else {
            this._parseVTTs(frag, payload, vttCCs);
          }
        }
      } else {
        // In case there is no payload, finish unsuccessfully.
        this.hls.trigger(Events.SUBTITLE_FRAG_PROCESSED, {
          success: false,
          frag,
          error: new Error('Empty subtitle payload'),
        });
      }
    }
  }

  private _parseIMSC1(frag: Fragment, payload: ArrayBuffer) {
    const hls = this.hls;
    parseIMSC1(
      payload,
      this.initPTS[frag.cc],
      this.timescale[frag.cc],
      (cues) => {
        this._appendCues(cues, frag.level);
        hls.trigger(Events.SUBTITLE_FRAG_PROCESSED, {
          success: true,
          frag: frag,
        });
      },
      (error) => {
        logger.log(`Failed to parse IMSC1: ${error}`);
        hls.trigger(Events.SUBTITLE_FRAG_PROCESSED, {
          success: false,
          frag: frag,
          error,
        });
      }
    );
  }

  private _parseVTTs(frag: Fragment, payload: ArrayBuffer, vttCCs: any) {
    const hls = this.hls;
    // Parse the WebVTT file contents.
    const payloadWebVTT = frag.initSegment?.data
      ? appendUint8Array(frag.initSegment.data, new Uint8Array(payload))
      : payload;
    parseWebVTT(
      payloadWebVTT,
      this.initPTS[frag.cc],
      this.timescale[frag.cc],
      vttCCs,
      frag.cc,
      frag.start,
      (cues) => {
        this._appendCues(cues, frag.level);
        hls.trigger(Events.SUBTITLE_FRAG_PROCESSED, {
          success: true,
          frag: frag,
        });
      },
      (error) => {
        this._fallbackToIMSC1(frag, payload);
        // Something went wrong while parsing. Trigger event with success false.
        logger.log(`Failed to parse VTT cue: ${error}`);
        hls.trigger(Events.SUBTITLE_FRAG_PROCESSED, {
          success: false,
          frag: frag,
          error,
        });
      }
    );
  }

  private _fallbackToIMSC1(frag: Fragment, payload: ArrayBuffer) {
    // If textCodec is unknown, try parsing as IMSC1. Set textCodec based on the result
    const trackPlaylistMedia = this.tracks[frag.level];
    if (!trackPlaylistMedia.textCodec) {
      parseIMSC1(
        payload,
        this.initPTS[frag.cc],
        this.timescale[frag.cc],
        () => {
          trackPlaylistMedia.textCodec = IMSC1_CODEC;
          this._parseIMSC1(frag, payload);
        },
        () => {
          trackPlaylistMedia.textCodec = 'wvtt';
        }
      );
    }
  }

  private _appendCues(cues: VTTCue[], fragLevel: number) {
    const hls = this.hls;
    if (this.config.renderTextTracksNatively) {
      const textTrack = this.textTracks[fragLevel];
      // WebVTTParser.parse is an async method and if the currently selected text track mode is set to "disabled"
      // before parsing is done then don't try to access currentTrack.cues.getCueById as cues will be null
      // and trying to access getCueById method of cues will throw an exception
      // Because we check if the mode is disabled, we can force check `cues` below. They can't be null.
      if (!textTrack || textTrack.mode === 'disabled') {
        return;
      }
      cues.forEach((cue) => addCueToTrack(textTrack, cue));
    } else {
      const currentTrack = this.tracks[fragLevel];
      if (!currentTrack) {
        return;
      }
      const track = currentTrack.default ? 'default' : 'subtitles' + fragLevel;
      hls.trigger(Events.CUES_PARSED, { type: 'subtitles', cues, track });
    }
  }

  private onFragDecrypted(
    event: Events.FRAG_DECRYPTED,
    data: FragDecryptedData
  ) {
    const { frag } = data;
    if (frag.type === PlaylistLevelType.SUBTITLE) {
      if (!Number.isFinite(this.initPTS[frag.cc])) {
        this.unparsedVttFrags.push(data as unknown as FragLoadedData);
        return;
      }
      this.onFragLoaded(Events.FRAG_LOADED, data as unknown as FragLoadedData);
    }
  }

  private onSubtitleTracksCleared() {
    this.tracks = [];
    this.captionsTracks = {};
  }

  private onFragParsingUserdata(
    event: Events.FRAG_PARSING_USERDATA,
    data: FragParsingUserdataData
  ) {
    const { cea608Parser1, cea608Parser2 } = this;
    if (!this.enabled || !(cea608Parser1 && cea608Parser2)) {
      return;
    }

    const { frag, samples } = data;
    if (
      frag.type === PlaylistLevelType.MAIN &&
      this.closedCaptionsForLevel(frag) === 'NONE'
    ) {
      return;
    }
    // If the event contains captions (found in the bytes property), push all bytes into the parser immediately
    // It will create the proper timestamps based on the PTS value
    for (let i = 0; i < samples.length; i++) {
      const ccBytes = samples[i].bytes;
      if (ccBytes) {
        const ccdatas = this.extractCea608Data(ccBytes);
        cea608Parser1.addData(samples[i].pts, ccdatas[0]);
        cea608Parser2.addData(samples[i].pts, ccdatas[1]);
      }
    }
  }

  onBufferFlushing(
    event: Events.BUFFER_FLUSHING,
    { startOffset, endOffset, endOffsetSubtitles, type }: BufferFlushingData
  ) {
    const { media } = this;
    if (!media || media.currentTime < endOffset) {
      return;
    }
    // Clear 608 caption cues from the captions TextTracks when the video back buffer is flushed
    // Forward cues are never removed because we can loose streamed 608 content from recent fragments
    if (!type || type === 'video') {
      const { captionsTracks } = this;
      Object.keys(captionsTracks).forEach((trackName) =>
        removeCuesInRange(captionsTracks[trackName], startOffset, endOffset)
      );
    }
    if (this.config.renderTextTracksNatively) {
      // Clear VTT/IMSC1 subtitle cues from the subtitle TextTracks when the back buffer is flushed
      if (startOffset === 0 && endOffsetSubtitles !== undefined) {
        const { textTracks } = this;
        Object.keys(textTracks).forEach((trackName) =>
          removeCuesInRange(
            textTracks[trackName],
            startOffset,
            endOffsetSubtitles
          )
        );
      }
    }
  }

  private extractCea608Data(byteArray: Uint8Array): number[][] {
    const actualCCBytes: number[][] = [[], []];
    const count = byteArray[0] & 0x1f;
    let position = 2;

    for (let j = 0; j < count; j++) {
      const tmpByte = byteArray[position++];
      const ccbyte1 = 0x7f & byteArray[position++];
      const ccbyte2 = 0x7f & byteArray[position++];
      if (ccbyte1 === 0 && ccbyte2 === 0) {
        continue;
      }
      const ccValid = (0x04 & tmpByte) !== 0; // Support all four channels
      if (ccValid) {
        const ccType = 0x03 & tmpByte;
        if (
          0x00 /* CEA608 field1*/ === ccType ||
          0x01 /* CEA608 field2*/ === ccType
        ) {
          // Exclude CEA708 CC data.
          actualCCBytes[ccType].push(ccbyte1);
          actualCCBytes[ccType].push(ccbyte2);
        }
      }
    }
    return actualCCBytes;
  }
}

function canReuseVttTextTrack(inUseTrack, manifestTrack): boolean {
  return (
    inUseTrack &&
    inUseTrack.label === manifestTrack.name &&
    !(inUseTrack.textTrack1 || inUseTrack.textTrack2)
  );
}

function intersection(x1: number, x2: number, y1: number, y2: number): number {
  return Math.min(x2, y2) - Math.max(x1, y1);
}

function newVTTCCs(): VTTCCs {
  return {
    ccOffset: 0,
    presentationOffset: 0,
    0: {
      start: 0,
      prevCC: -1,
      new: true,
    },
  };
}
