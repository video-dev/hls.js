/*
 * Timeline Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import Cea608Parser from '../utils/cea-608-parser';
import OutputFilter from '../utils/output-filter';
import WebVTTParser from '../utils/webvtt-parser';
import { logger } from '../utils/logger';
import { sendAddTrackEvent, clearCurrentCues } from '../utils/texttrack-utils';

function canReuseVttTextTrack (inUseTrack, manifestTrack) {
  return inUseTrack && inUseTrack.label === manifestTrack.name && !(inUseTrack.textTrack1 || inUseTrack.textTrack2);
}

function intersection (x1, x2, y1, y2) {
  return Math.min(x2, y2) - Math.max(x1, y1);
}

class TimelineController extends EventHandler {
  constructor (hls) {
    super(hls, Event.MEDIA_ATTACHING,
      Event.MEDIA_DETACHING,
      Event.FRAG_PARSING_USERDATA,
      Event.FRAG_DECRYPTED,
      Event.MANIFEST_LOADING,
      Event.MANIFEST_LOADED,
      Event.FRAG_LOADED,
      Event.LEVEL_SWITCHING,
      Event.INIT_PTS_FOUND);

    this.hls = hls;
    this.config = hls.config;
    this.enabled = true;
    this.Cues = hls.config.cueHandler;
    this.textTracks = [];
    this.tracks = [];
    this.unparsedVttFrags = [];
    this.initPTS = [];
    this.cueRanges = [];
    this.captionsTracks = {};

    this.captionsProperties = {
      textTrack1: {
        label: this.config.captionsTextTrack1Label,
        languageCode: this.config.captionsTextTrack1LanguageCode
      },
      textTrack2: {
        label: this.config.captionsTextTrack2Label,
        languageCode: this.config.captionsTextTrack2LanguageCode
      }
    };

    if (this.config.enableCEA708Captions) {
      let channel1 = new OutputFilter(this, 'textTrack1');
      let channel2 = new OutputFilter(this, 'textTrack2');

      this.cea608Parser = new Cea608Parser(0, channel1, channel2);
    }
  }

  addCues (trackName, startTime, endTime, screen) {
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

    this.Cues.newCue(this.captionsTracks[trackName], startTime, endTime, screen);
  }

  // Triggered when an initial PTS is found; used for synchronisation of WebVTT.
  onInitPtsFound (data) {
    if (data.id === 'main') {
      this.initPTS[data.frag.cc] = data.initPTS;
    }

    // Due to asynchronous processing, initial PTS may arrive later than the first VTT fragments are loaded.
    // Parse any unparsed fragments upon receiving the initial PTS.
    if (this.unparsedVttFrags.length) {
      const unparsedVttFrags = this.unparsedVttFrags;
      this.unparsedVttFrags = [];
      unparsedVttFrags.forEach(frag => {
        this.onFragLoaded(frag);
      });
    }
  }

  getExistingTrack (trackName) {
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

  createCaptionsTrack (trackName) {
    const { label, languageCode } = this.captionsProperties[trackName];
    const captionsTracks = this.captionsTracks;
    if (!captionsTracks[trackName]) {
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
        sendAddTrackEvent(captionsTracks[trackName], this.media);
      }
    }
  }

  createTextTrack (kind, label, lang) {
    const media = this.media;
    if (media) {
      return media.addTextTrack(kind, label, lang);
    }
  }

  destroy () {
    EventHandler.prototype.destroy.call(this);
  }

  onMediaAttaching (data) {
    this.media = data.media;
    this._cleanTracks();
  }

  onMediaDetaching () {
    const { captionsTracks } = this;
    Object.keys(captionsTracks).forEach(trackName => {
      clearCurrentCues(captionsTracks[trackName]);
      delete captionsTracks[trackName];
    });
  }

  onManifestLoading () {
    this.lastSn = -1; // Detect discontiguity in fragment parsing
    this.prevCC = -1;
    this.vttCCs = { // Detect discontinuity in subtitle manifests
      ccOffset: 0,
      presentationOffset: 0,
      0: {
        start: 0, prevCC: -1, new: false
      }
    };
    this._cleanTracks();
  }

  _cleanTracks () {
    // clear outdated subtitles
    const media = this.media;
    if (media) {
      const textTracks = media.textTracks;
      if (textTracks) {
        for (let i = 0; i < textTracks.length; i++) {
          clearCurrentCues(textTracks[i]);
        }
      }
    }
  }

  onManifestLoaded (data) {
    this.textTracks = [];
    this.unparsedVttFrags = this.unparsedVttFrags || [];
    this.initPTS = [];
    this.cueRanges = [];

    if (this.config.enableWebVTT) {
      this.tracks = data.subtitles || [];
      const inUseTracks = this.media ? this.media.textTracks : [];

      this.tracks.forEach((track, index) => {
        let textTrack;
        if (index < inUseTracks.length) {
          const inUseTrack = [].slice.call(inUseTracks).find(inUseTrack => canReuseVttTextTrack(inUseTrack, track));
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
    }
  }

  onLevelSwitching () {
    this.enabled = this.hls.currentLevel.closedCaptions !== 'NONE';
  }

  onFragLoaded (data) {
    let frag = data.frag,
      payload = data.payload;
    if (frag.type === 'main') {
      let sn = frag.sn;
      // if this frag isn't contiguous, clear the parser so cues with bad start/end times aren't added to the textTrack
      if (sn !== this.lastSn + 1) {
        const cea608Parser = this.cea608Parser;
        if (cea608Parser) {
          cea608Parser.reset();
        }
      }
      this.lastSn = sn;
    } // eslint-disable-line brace-style
    // If fragment is subtitle type, parse as WebVTT.
    else if (frag.type === 'subtitle') {
      if (payload.byteLength) {
        // We need an initial synchronisation PTS. Store fragments as long as none has arrived.
        if (!Number.isFinite(this.initPTS[frag.cc])) {
          this.unparsedVttFrags.push(data);
          if (this.initPTS.length) {
            // finish unsuccessfully, otherwise the subtitle-stream-controller could be blocked from loading new frags.
            this.hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
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
        this.hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
      }
    }
  }

  _parseVTTs (frag, payload) {
    let vttCCs = this.vttCCs;
    if (!vttCCs[frag.cc]) {
      vttCCs[frag.cc] = { start: frag.start, prevCC: this.prevCC, new: true };
      this.prevCC = frag.cc;
    }
    let textTracks = this.textTracks,
      hls = this.hls;

    // Parse the WebVTT file contents.
    WebVTTParser.parse(payload, this.initPTS[frag.cc], vttCCs, frag.cc, function (cues) {
      const currentTrack = textTracks[frag.trackId];
      // WebVTTParser.parse is an async method and if the currently selected text track mode is set to "disabled"
      // before parsing is done then don't try to access currentTrack.cues.getCueById as cues will be null
      // and trying to access getCueById method of cues will throw an exception
      if (currentTrack.mode === 'disabled') {
        hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
        return;
      }
      // Add cues and trigger event with success true.
      cues.forEach(cue => {
        // Sometimes there are cue overlaps on segmented vtts so the same
        // cue can appear more than once in different vtt files.
        // This avoid showing duplicated cues with same timecode and text.
        if (!currentTrack.cues.getCueById(cue.id)) {
          try {
            currentTrack.addCue(cue);
          } catch (err) {
            const textTrackCue = new window.TextTrackCue(cue.startTime, cue.endTime, cue.text);
            textTrackCue.id = cue.id;
            currentTrack.addCue(textTrackCue);
          }
        }
      }
      );
      hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: true, frag: frag });
    },
    function (e) {
      // Something went wrong while parsing. Trigger event with success false.
      logger.log(`Failed to parse VTT cue: ${e}`);
      hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, { success: false, frag: frag });
    });
  }

  onFragDecrypted (data) {
    let decryptedData = data.payload,
      frag = data.frag;

    if (frag.type === 'subtitle') {
      if (!Number.isFinite(this.initPTS[frag.cc])) {
        this.unparsedVttFrags.push(data);
        return;
      }

      this._parseVTTs(frag, decryptedData);
    }
  }

  onFragParsingUserdata (data) {
    // push all of the CEA-708 messages into the interpreter
    // immediately. It will create the proper timestamps based on our PTS value
    if (this.enabled && this.config.enableCEA708Captions) {
      for (let i = 0; i < data.samples.length; i++) {
        let ccdatas = this.extractCea608Data(data.samples[i].bytes);
        this.cea608Parser.addData(data.samples[i].pts, ccdatas);
      }
    }
  }

  extractCea608Data (byteArray) {
    let count = byteArray[0] & 31;
    let position = 2;
    let tmpByte, ccbyte1, ccbyte2, ccValid, ccType;
    let actualCCBytes = [];

    for (let j = 0; j < count; j++) {
      tmpByte = byteArray[position++];
      ccbyte1 = 0x7F & byteArray[position++];
      ccbyte2 = 0x7F & byteArray[position++];
      ccValid = (4 & tmpByte) !== 0;
      ccType = 3 & tmpByte;

      if (ccbyte1 === 0 && ccbyte2 === 0) {
        continue;
      }

      if (ccValid) {
        if (ccType === 0) { // || ccType === 1
          actualCCBytes.push(ccbyte1);
          actualCCBytes.push(ccbyte2);
        }
      }
    }
    return actualCCBytes;
  }
}

export default TimelineController;
