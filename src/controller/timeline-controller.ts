import Event from '../events';
import EventHandler from '../event-handler';
import Cea608Parser, { CaptionScreen } from '../utils/cea-608-parser';
import OutputFilter from '../utils/output-filter';
import WebVTTParser from '../utils/webvtt-parser';
import { logger } from '../utils/logger';
import { sendAddTrackEvent, clearCurrentCues } from '../utils/texttrack-utils';
import Fragment from '../loader/fragment';
import { HlsConfig } from '../config';
import { CuesInterface } from '../utils/cues';
import { MediaPlaylist } from '../types/media-playlist';

type TrackProperties = {
  label: string,
  languageCode: string,
  media?: MediaPlaylist
};

type NonNativeCaptionsTrack = {
  _id?: string,
  label: string,
  kind: string,
  default: boolean,
  closedCaptions?: MediaPlaylist,
  subtitleTrack?: MediaPlaylist
};

type VTTCCs = {
  ccOffset: number,
  presentationOffset: number,
  [key: number]: {
    start: number,
    prevCC: number,
    new: boolean
  }
};

class TimelineController extends EventHandler {
  private media: HTMLMediaElement | null = null;
  private config: HlsConfig;
  private enabled: boolean = true;
  private Cues: CuesInterface;
  private textTracks: Array<TextTrack> = [];
  private tracks: Array<MediaPlaylist> = [];
  private initPTS: Array<number> = [];
  private unparsedVttFrags: Array<{ frag: Fragment, payload: ArrayBuffer }> = [];
  private cueRanges: Array<[number, number]> = [];
  private captionsTracks: Record<string, TextTrack> = {};
  private nonNativeCaptionsTracks: Record<string, NonNativeCaptionsTrack> = {};
  private captionsProperties: {
    textTrack1: TrackProperties
    textTrack2: TrackProperties
    textTrack3: TrackProperties
    textTrack4: TrackProperties
  };
  private readonly cea608Parser!: Cea608Parser;
  private lastSn: number = -1;
  private prevCC: number = -1;
  private vttCCs: VTTCCs = newVTTCCs();

  constructor (hls) {
    super(hls,
      Event.MEDIA_ATTACHING,
      Event.MEDIA_DETACHING,
      Event.FRAG_PARSING_USERDATA,
      Event.FRAG_DECRYPTED,
      Event.MANIFEST_LOADING,
      Event.MANIFEST_LOADED,
      Event.FRAG_LOADED,
      Event.INIT_PTS_FOUND);

    this.hls = hls;
    this.config = hls.config;
    this.Cues = hls.config.cueHandler;

    this.captionsProperties = {
      textTrack1: {
        label: this.config.captionsTextTrack1Label,
        languageCode: this.config.captionsTextTrack1LanguageCode
      },
      textTrack2: {
        label: this.config.captionsTextTrack2Label,
        languageCode: this.config.captionsTextTrack2LanguageCode
      },
      textTrack3: {
        label: this.config.captionsTextTrack3Label,
        languageCode: this.config.captionsTextTrack3LanguageCode
      },
      textTrack4: {
        label: this.config.captionsTextTrack4Label,
        languageCode: this.config.captionsTextTrack4LanguageCode
      }
    };

    if (this.config.enableCEA708Captions) {
      const channel1 = new OutputFilter(this, 'textTrack1');
      const channel2 = new OutputFilter(this, 'textTrack2');
      const channel3 = new OutputFilter(this, 'textTrack3');
      const channel4 = new OutputFilter(this, 'textTrack4');
      this.cea608Parser = new Cea608Parser(channel1, channel2, channel3, channel4);
    }
  }

  addCues (trackName: string, startTime: number, endTime: number, screen: CaptionScreen) {
    // skip cues which overlap more than 50% with previously parsed time ranges
    const ranges = this.cueRanges;
    let merged = false;
    for (let i = ranges.length; i--;) {
      let cueRange = ranges[i];
      let overlap = intersection(cueRange[0], cueRange[1], startTime, endTime);
      if (overlap >= 0) {
        cueRange[0] = Math.min(cueRange[0], startTime);
        cueRange[1] = Math.max(cueRange[1], endTime);
        merged = true;
        if ((overlap / (endTime - startTime)) > 0.5) {
          return;
        }
      }
    }
    if (!merged) {
      ranges.push([startTime, endTime]);
    }

    if (this.config.renderTextTracksNatively) {
      this.Cues.newCue(this.captionsTracks[trackName], startTime, endTime, screen);
    } else {
      const cues = this.Cues.newCue(null, startTime, endTime, screen);
      this.hls.trigger(Event.CUES_PARSED, { type: 'captions', cues, track: trackName });
    }
  }

  // Triggered when an initial PTS is found; used for synchronisation of WebVTT.
  onInitPtsFound (data: { id: string, frag: Fragment, initPTS: number}) {
    const { frag, id, initPTS } = data;
    const { unparsedVttFrags } = this;
    if (id === 'main') {
      this.initPTS[frag.cc] = initPTS;
    }

    // Due to asynchronous processing, initial PTS may arrive later than the first VTT fragments are loaded.
    // Parse any unparsed fragments upon receiving the initial PTS.
    if (unparsedVttFrags.length) {
      this.unparsedVttFrags = [];
      unparsedVttFrags.forEach(frag => {
        this.onFragLoaded(frag);
      });
    }
  }

  getExistingTrack (trackName: string): TextTrack | null {
    const { media } = this;
    if (media) {
      for (let i = 0; i < media.textTracks.length; i++) {
        let textTrack = media.textTracks[i];
        if (textTrack[trackName]) {
          return textTrack;
        }
      }
    }
    return null;
  }

  createCaptionsTrack (trackName: string) {
    if (this.config.renderTextTracksNatively) {
      this.createNativeTrack(trackName);
    } else {
      this.createNonNativeTrack(trackName);
    }
  }

  createNativeTrack (trackName: string) {
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

  createNonNativeTrack (trackName: string) {
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
      closedCaptions: trackProperties.media
    };
    this.nonNativeCaptionsTracks[trackName] = track;
    this.hls.trigger(Event.NON_NATIVE_TEXT_TRACKS_FOUND, { tracks: [track] });
  }
  createTextTrack (kind: TextTrackKind, label: string, lang?: string): TextTrack | undefined {
    const media = this.media;
    if (!media) {
      return;
    }
    return media.addTextTrack(kind, label, lang);
  }

  destroy () {
    super.destroy();
  }

  onMediaAttaching (data: { media: HTMLMediaElement }) {
    this.media = data.media;
    this._cleanTracks();
  }

  onMediaDetaching () {
    const { captionsTracks } = this;
    Object.keys(captionsTracks).forEach(trackName => {
      clearCurrentCues(captionsTracks[trackName]);
      delete captionsTracks[trackName];
    });
    this.nonNativeCaptionsTracks = {};
  }

  onManifestLoading () {
    this.lastSn = -1; // Detect discontiguity in fragment parsing
    this.prevCC = -1;
    this.vttCCs = newVTTCCs(); // Detect discontinuity in subtitle manifests
    this._cleanTracks();
    this.tracks = [];
    this.captionsTracks = {};
    this.nonNativeCaptionsTracks = {};
  }

  _cleanTracks () {
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

  onManifestLoaded (data: { subtitles: Array<MediaPlaylist>, captions: Array<MediaPlaylist> }) {
    this.textTracks = [];
    this.unparsedVttFrags = this.unparsedVttFrags || [];
    this.initPTS = [];
    this.cueRanges = [];

    if (this.config.enableWebVTT) {
      const tracks = data.subtitles || [];
      const sameTracks = this.tracks && tracks && this.tracks.length === tracks.length;
      this.tracks = data.subtitles || [];

      if (this.config.renderTextTracksNatively) {
        const inUseTracks = this.media ? this.media.textTracks : [];

        this.tracks.forEach((track, index) => {
          let textTrack;
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
          if (!textTrack) {
            textTrack = this.createTextTrack('subtitles', track.name, track.lang);
          }

          if (track.default) {
            textTrack.mode = this.hls.subtitleDisplay ? 'showing' : 'hidden';
          } else {
            textTrack.mode = 'disabled';
          }

          this.textTracks.push(textTrack);
        });
      } else if (!sameTracks && this.tracks && this.tracks.length) {
        // Create a list of tracks for the provider to consume
        const tracksList = this.tracks.map((track) => {
          return {
            label: track.name,
            kind: track.type.toLowerCase(),
            default: track.default,
            subtitleTrack: track
          };
        });
        this.hls.trigger(Event.NON_NATIVE_TEXT_TRACKS_FOUND, { tracks: tracksList });
      }
    }

    if (this.config.enableCEA708Captions && data.captions) {
      data.captions.forEach(captionsTrack => {
        const instreamIdMatch = /(?:CC|SERVICE)([1-4])/.exec(captionsTrack.instreamId as string);
        if (!instreamIdMatch) {
          return;
        }
        const trackName = `textTrack${instreamIdMatch[1]}`;
        const trackProperties: TrackProperties = this.captionsProperties[trackName];
        if (!trackProperties) {
          return;
        }
        trackProperties.label = captionsTrack.name;
        if (captionsTrack.lang) { // optional attribute
          trackProperties.languageCode = captionsTrack.lang;
        }
        trackProperties.media = captionsTrack;
      });
    }
  }

  onFragLoaded (data: { frag: Fragment, payload: ArrayBuffer }) {
    const { frag, payload } = data;
    const { cea608Parser, initPTS, lastSn, unparsedVttFrags } = this;
    if (frag.type === 'main') {
      const sn = frag.sn;
      // if this frag isn't contiguous, clear the parser so cues with bad start/end times aren't added to the textTrack
      if (frag.sn !== lastSn + 1) {
        if (cea608Parser) {
          cea608Parser.reset();
        }
      }
      this.lastSn = sn as number;
    } // eslint-disable-line brace-style
    // If fragment is subtitle type, parse as WebVTT.
    else if (frag.type === 'subtitle') {
      if (payload.byteLength) {
        // We need an initial synchronisation PTS. Store fragments as long as none has arrived.
        if (!Number.isFinite(initPTS[frag.cc])) {
          unparsedVttFrags.push(data);
          if (initPTS.length) {
            // finish unsuccessfully, otherwise the subtitle-stream-controller could be blocked from loading new frags.
            this.hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag });
          }
          return;
        }

        let decryptData = frag.decryptdata;
        // If the subtitles are not encrypted, parse VTTs now. Otherwise, we need to wait.
        if ((decryptData == null) || (decryptData.key == null) || (decryptData.method !== 'AES-128')) {
          this._parseVTTs(frag, payload);
        }
      } else {
        // In case there is no payload, finish unsuccessfully.
        this.hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag });
      }
    }
  }

  _parseVTTs (frag: Fragment, payload: ArrayBuffer) {
    const { hls, prevCC, textTracks, vttCCs } = this;
    if (!vttCCs[frag.cc]) {
      vttCCs[frag.cc] = { start: frag.start, prevCC, new: true };
      this.prevCC = frag.cc;
    }
    // Parse the WebVTT file contents.
    WebVTTParser.parse(payload, this.initPTS[frag.cc], vttCCs, frag.cc, (cues) => {
      if (this.config.renderTextTracksNatively) {
        const currentTrack = textTracks[frag.level];
        // WebVTTParser.parse is an async method and if the currently selected text track mode is set to "disabled"
        // before parsing is done then don't try to access currentTrack.cues.getCueById as cues will be null
        // and trying to access getCueById method of cues will throw an exception
        // Because we check if the mode is diabled, we can force check `cues` below. They can't be null.
        if (currentTrack.mode === 'disabled') {
          hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
          return;
        }

        // Add cues and trigger event with success true.
        cues.forEach(cue => {
          // Sometimes there are cue overlaps on segmented vtts so the same
          // cue can appear more than once in different vtt files.
          // This avoid showing duplicated cues with same timecode and text.
          if (!currentTrack.cues!.getCueById(cue.id)) {
            try {
              currentTrack.addCue(cue);
              if (!currentTrack.cues!.getCueById(cue.id)) {
                throw new Error(`addCue is failed for: ${cue}`);
              }
            } catch (err) {
              logger.debug(`Failed occurred on adding cues: ${err}`);
              const textTrackCue = new (window as any).TextTrackCue(cue.startTime, cue.endTime, cue.text);
              textTrackCue.id = cue.id;
              currentTrack.addCue(textTrackCue);
            }
          }
        });
      } else {
        let trackId = this.tracks[frag.level].default ? 'default' : 'subtitles' + frag.level;
        hls.trigger(Event.CUES_PARSED, { type: 'subtitles', cues: cues, track: trackId });
      }
      hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: true, frag: frag });
    },
    function (e) {
      // Something went wrong while parsing. Trigger event with success false.
      logger.log(`Failed to parse VTT cue: ${e}`);
      hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
    });
  }

  onFragDecrypted (data: { frag: Fragment, payload: any}) {
    const { frag, payload } = data;
    if (frag.type === 'subtitle') {
      if (!Number.isFinite(this.initPTS[frag.cc])) {
        this.unparsedVttFrags.push(data);
        return;
      }

      this._parseVTTs(frag, payload);
    }
  }

  onFragParsingUserdata (data: { samples: Array<any> }) {
    if (!this.enabled || !this.cea608Parser) {
      return;
    }

    // If the event contains captions (found in the bytes property), push all bytes into the parser immediately
    // It will create the proper timestamps based on the PTS value
    const cea608Parser = this.cea608Parser;
    for (let i = 0; i < data.samples.length; i++) {
      const ccBytes = data.samples[i].bytes;
      if (ccBytes) {
        const ccdatas = this.extractCea608Data(ccBytes);
        cea608Parser.addData(data.samples[i].pts, ccdatas[0], 1);
        cea608Parser.addData(data.samples[i].pts, ccdatas[1], 3);
      }
    }
  }

  extractCea608Data (byteArray: Uint8Array): number[][] {
    const count = byteArray[0] & 31;
    let position = 2;
    const actualCCBytes: number[][] = [[], []];

    for (let j = 0; j < count; j++) {
      const tmpByte = byteArray[position++];
      const ccbyte1 = 0x7F & byteArray[position++];
      const ccbyte2 = 0x7F & byteArray[position++];
      const ccValid = (4 & tmpByte) !== 0;
      const ccType = 3 & tmpByte;

      if (ccbyte1 === 0 && ccbyte2 === 0) {
        continue;
      }

      if (ccValid) {
        if (ccType === 0 || ccType === 1) {
          actualCCBytes[ccType].push(ccbyte1);
          actualCCBytes[ccType].push(ccbyte2);
        }
      }
    }
    return actualCCBytes;
  }
}

function canReuseVttTextTrack (inUseTrack, manifestTrack): boolean {
  return inUseTrack && inUseTrack.label === manifestTrack.name && !(inUseTrack.textTrack1 || inUseTrack.textTrack2);
}

function intersection (x1: number, x2: number, y1: number, y2: number): number {
  return Math.min(x2, y2) - Math.max(x1, y1);
}

function newVTTCCs (): VTTCCs {
  return {
    ccOffset: 0,
    presentationOffset: 0,
    0: {
      start: 0,
      prevCC: -1,
      new: false
    }
  };
}

export default TimelineController;
