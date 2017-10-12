/*
 * Timeline Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import Cea608Parser from '../utils/cea-608-parser';
import WebVTTParser from '../utils/webvtt-parser';
import {logger} from '../utils/logger';

function clearCurrentCues(track) {
  if (track && track.cues) {
    while (track.cues.length > 0) {
      track.removeCue(track.cues[0]);
    }
  }
}

function reuseVttTextTrack(inUseTrack, manifestTrack) {
  return inUseTrack && inUseTrack.label === manifestTrack.name && !(inUseTrack.textTrack1 || inUseTrack.textTrack2);
}

function intersection(x1, x2, y1, y2) {
  return Math.min(x2, y2) - Math.max(x1, y1);
}

class TimelineController extends EventHandler {

  constructor(hls) {
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
    this.initPTS = undefined;
    this.cueRanges = [];

    if (this.config.enableCEA708Captions)
    {
      var self = this;
      var sendAddTrackEvent = function (track, media)
      {
        var e = null;
        try {
          e = new window.Event('addtrack');
        } catch (err) {
          //for IE11
          e = document.createEvent('Event');
          e.initEvent('addtrack', false, false);
        }
        e.track = track;
        media.dispatchEvent(e);
      };

      var channel1 =
      {
        'newCue': function(startTime, endTime, screen)
        {
          if (!self.textTrack1)
          {
            //Enable reuse of existing text track.
            var existingTrack1 = self.getExistingTrack('1');
            if (!existingTrack1)
            {
              const textTrack1 = self.createTextTrack('captions', self.config.captionsTextTrack1Label, self.config.captionsTextTrack1LanguageCode);
              if (textTrack1) {
                textTrack1.textTrack1 = true;
                self.textTrack1 = textTrack1;
              }
            }
            else
            {
              self.textTrack1 = existingTrack1;
              clearCurrentCues(self.textTrack1);

              sendAddTrackEvent(self.textTrack1, self.media);
            }
          }
          self.addCues('textTrack1', startTime, endTime, screen);
        }
      };

      var channel2 =
      {
        'newCue': function(startTime, endTime, screen)
        {
          if (!self.textTrack2)
          {
            //Enable reuse of existing text track.
            var existingTrack2 = self.getExistingTrack('2');
            if (!existingTrack2)
            {
              const textTrack2 = self.createTextTrack('captions', self.config.captionsTextTrack2Label, self.config.captionsTextTrack1LanguageCode);
              if (textTrack2) {
                textTrack2.textTrack2 = true;
                self.textTrack2 = textTrack2;
              }
            }
            else
            {
              self.textTrack2 = existingTrack2;
              clearCurrentCues(self.textTrack2);

              sendAddTrackEvent(self.textTrack2, self.media);
            }
          }
          self.addCues('textTrack2', startTime, endTime, screen);
        }
      };

      this.cea608Parser = new Cea608Parser(0, channel1, channel2);
    }
  }

  addCues(channel, startTime, endTime, screen) {
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
    this.Cues.newCue(this[channel], startTime, endTime, screen);
  }

  // Triggered when an initial PTS is found; used for synchronisation of WebVTT.
  onInitPtsFound(data) {
    if (typeof this.initPTS === 'undefined') {
      this.initPTS = data.initPTS;
    }

    // Due to asynchrony, initial PTS may arrive later than the first VTT fragments are loaded.
    // Parse any unparsed fragments upon receiving the initial PTS.
    if (this.unparsedVttFrags.length) {
      this.unparsedVttFrags.forEach(frag => {
        this.onFragLoaded(frag);
      });
      this.unparsedVttFrags = [];
    }
  }

  getExistingTrack(channelNumber) {
    const media = this.media;
    if (media) {
      for (let i = 0; i < media.textTracks.length; i++) {
        let textTrack = media.textTracks[i];
        let propName = 'textTrack' + channelNumber;
        if (textTrack[propName] === true) {
          return textTrack;
        }
      }
    }
    return null;
  }

  createTextTrack(kind, label, lang) {
    const media = this.media;
    if (media)
    {
      return media.addTextTrack(kind, label, lang);
    }
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onMediaAttaching(data) {
    this.media = data.media;
  }

  onMediaDetaching() {
    clearCurrentCues(this.textTrack1);
    clearCurrentCues(this.textTrack2);
  }

  onManifestLoading()
  {
    this.lastSn = -1; // Detect discontiguity in fragment parsing
    this.prevCC = -1;
    this.vttCCs = {ccOffset: 0, presentationOffset: 0}; // Detect discontinuity in subtitle manifests

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

  onManifestLoaded(data) {
    this.textTracks = [];
    this.unparsedVttFrags = this.unparsedVttFrags || [];
    this.initPTS = undefined;
    this.cueRanges = [];

    if (this.config.enableWebVTT) {
      this.tracks = data.subtitles || [];
      const inUseTracks = this.media ? this.media.textTracks : [];

      this.tracks.forEach((track, index) => {
        let textTrack;
        if (index < inUseTracks.length) {
          const inUseTrack = inUseTracks[index];
          // Reuse tracks with the same label, but do not reuse 608/708 tracks
          if (reuseVttTextTrack(inUseTrack, track)) {
            textTrack = inUseTrack;
          }
        }
        if (!textTrack) {
            textTrack = this.createTextTrack('subtitles', track.name, track.lang);
        }
        textTrack.mode = track.default ? 'showing' : 'hidden';
        this.textTracks.push(textTrack);
      });
    }
  }

  onLevelSwitching() {
    this.enabled = this.hls.currentLevel.closedCaptions !== 'NONE';
  }

  onFragLoaded(data) {
    let frag = data.frag,
      payload = data.payload;
    if (frag.type === 'main') {
      var sn = frag.sn;
      // if this frag isn't contiguous, clear the parser so cues with bad start/end times aren't added to the textTrack
      if (sn !== this.lastSn + 1) {
        const cea608Parser = this.cea608Parser;
        if (cea608Parser) {
          cea608Parser.reset();
        }
      }
      this.lastSn = sn;
    }
    // If fragment is subtitle type, parse as WebVTT.
    else if (frag.type === 'subtitle') {
      if (payload.byteLength) {
        // We need an initial synchronisation PTS. Store fragments as long as none has arrived.
        if (typeof this.initPTS === 'undefined') {
          this.unparsedVttFrags.push(data);
          return;
        }

        var decryptData = frag.decryptdata;
        // If the subtitles are not encrypted, parse VTTs now. Otherwise, we need to wait.
        if ((decryptData == null) || (decryptData.key == null) || (decryptData.method !== 'AES-128')) {
          this._parseVTTs(frag, payload);
        }
      }
      else {
        // In case there is no payload, finish unsuccessfully.
        this.hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, {success: false, frag: frag});
      }
    }
  }

  _parseVTTs(frag, payload) {
    let vttCCs = this.vttCCs;
    if (!vttCCs[frag.cc]) {
      vttCCs[frag.cc] = { start: frag.start, prevCC: this.prevCC, new: true };
      this.prevCC = frag.cc;
    }
    let textTracks = this.textTracks,
      hls = this.hls;

    // Parse the WebVTT file contents.
    WebVTTParser.parse(payload, this.initPTS, vttCCs, frag.cc, function (cues) {
        const currentTrack = textTracks[frag.trackId];
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
        });
        hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, {success: true, frag: frag});
      },
      function (e) {
        // Something went wrong while parsing. Trigger event with success false.
        logger.log(`Failed to parse VTT cue: ${e}`);
        hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, {success: false, frag: frag});
      });
  }

  onFragDecrypted(data) {
    var decryptedData = data.payload,
        frag = data.frag;

    if (frag.type === 'subtitle') {
      if (typeof this.initPTS === 'undefined') {
        this.unparsedVttFrags.push(data);
        return;
      }

      this._parseVTTs(frag, decryptedData);
    }
  }

  onFragParsingUserdata(data) {
    // push all of the CEA-708 messages into the interpreter
    // immediately. It will create the proper timestamps based on our PTS value
    if (this.enabled && this.config.enableCEA708Captions) {
      for (var i=0; i<data.samples.length; i++) {
        var ccdatas = this.extractCea608Data(data.samples[i].bytes);
        this.cea608Parser.addData(data.samples[i].pts, ccdatas);
      }
    }
  }

  extractCea608Data(byteArray) {
    var count = byteArray[0] & 31;
    var position = 2;
    var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;
    var actualCCBytes = [];

    for (var j = 0; j < count; j++) {
      tmpByte = byteArray[position++];
      ccbyte1 = 0x7F & byteArray[position++];
      ccbyte2 = 0x7F & byteArray[position++];
      ccValid = (4 & tmpByte) !== 0;
      ccType = 3 & tmpByte;

      if (ccbyte1 === 0 && ccbyte2 === 0) {
        continue;
      }

      if (ccValid) {
        if (ccType === 0) // || ccType === 1
        {
          actualCCBytes.push(ccbyte1);
          actualCCBytes.push(ccbyte2);
        }
      }
    }
    return actualCCBytes;
  }
}

export default TimelineController;
