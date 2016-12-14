/*
 * Timeline Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import Cea608Parser from '../utils/cea-608-parser';
import WebVTTParser from '../utils/webvtt-parser';
import {logger} from '../utils/logger';

class TimelineController extends EventHandler {

  constructor(hls) {
    super(hls, Event.MEDIA_ATTACHING,
                Event.FRAG_PARSING_USERDATA,
                Event.MANIFEST_LOADING,
                Event.MANIFEST_LOADED,
                Event.FRAG_LOADED,
                Event.LEVEL_SWITCH,
                Event.INIT_PTS_FOUND);

    this.hls = hls;
    this.config = hls.config;
    this.enabled = true;
    this.Cues = hls.config.cueHandler;
    this.textTracks = [];
    this.tracks = [];
    this.unparsedVttFrags = [];
    this.initPTS = undefined;
    this.addedCues = {};

    if (this.config.enableCEA708Captions)
    {
      var self = this;

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
              self.textTrack1 = self.createTextTrack('captions', 'English', 'en');
              self.textTrack1.textTrack1 = true;
            }
            else
            {
              self.textTrack1 = existingTrack1;
              let e = new window.Event('addtrack');
              e.track = self.textTrack1;
              self.media.dispatchEvent(e);
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
              self.textTrack2 = self.createTextTrack('captions', 'Spanish', 'es');
              self.textTrack2.textTrack2 = true;
            }
            else
            {
              self.textTrack2 = existingTrack2;

              let e = new window.Event('addtrack');
              e.track = self.textTrack2;
              self.media.dispatchEvent(e);
            }
          }
          self.addCues('textTrack2', startTime, endTime, screen);
        }
      };

      this.cea608Parser = new Cea608Parser(0, channel1, channel2);
    }
  }

  addCues(channel, startTime, endTime, screen) {
    let addedCues = this.addedCues[channel];

    if (!addedCues) {
      addedCues = this.addedCues[channel] = {};
    }

    // Fragment start times don't always align on level switches.
    // Adding a tolerance of .05s ensures we don't add duplicate cues during a level switch.
    let key = Math.floor(startTime * 20);
    let cuesAdded = addedCues[key] || addedCues[key - 1] || addedCues[key + 1];

    if (!cuesAdded) {
      this.Cues.newCue(this[channel], startTime, endTime, screen);
      addedCues[key] = endTime;
    }
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
    let media = this.media;
    if (media)
    {
      for (let i = 0; i < media.textTracks.length; i++)
      {
        let textTrack = media.textTracks[i];
        let propName = 'textTrack' + channelNumber;
        if (textTrack[propName] === true)
        {
          return textTrack;
        }
      }
    }
    return null;
  }

  createTextTrack(kind, label, lang) {
    if (this.media)
    {
      return this.media.addTextTrack(kind, label, lang);
    }
  }

  reuseVttTextTrack(inUseTrack, manifestTrack) {
    return inUseTrack && inUseTrack.label === manifestTrack.name && !(inUseTrack.textTrack1 || inUseTrack.textTrack2);
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onMediaAttaching(data) {
    this.media = data.media;
  }

  onManifestLoading()
  {
    this.lastSn = -1; // Detect discontiguity in fragment parsing
    this.lastDiscontinuity = { cc: 0, start: 0, new: false }; // Detect discontinuity in subtitle manifests
  }

  onManifestLoaded(data) {
    this.textTracks = [];
    this.unparsedVttFrags = this.unparsedVttFrags || [];
    this.initPTS = undefined;
    this.addedCues = {};

    if (this.config.enableWebVTT) {
      this.tracks = data.subtitles || [];
      const inUseTracks = this.media ? this.media.textTracks : [];

      this.tracks.forEach((track, index) => {
        let textTrack;
        const inUseTrack = inUseTracks[index];
        // Reuse tracks with the same label, but do not reuse 608/708 tracks
        if (this.reuseVttTextTrack(inUseTrack, track)) {
          textTrack = inUseTrack;
        } else {
          textTrack = this.createTextTrack('subtitles', track.name, track.lang);
        }
        textTrack.mode = track.default ? 'showing' : 'hidden';
        this.textTracks.push(textTrack);
      });
    }
  }

  onLevelSwitch() {
    this.enabled = this.hls.currentLevel.closedCaptions !== 'NONE';
  }

  onFragLoaded(data) {
    if (data.frag.type === 'main') {
      var sn = data.frag.sn;
      // if this frag isn't contiguous, clear the parser so cues with bad start/end times aren't added to the textTrack
      if (sn !== this.lastSn + 1) {
        this.cea608Parser.reset();
      }
      this.lastSn = sn;
    }
    // If fragment is subtitle type, parse as WebVTT.
    else if (data.frag.type === 'subtitle') {
      if (data.payload.byteLength) {
        // We need an initial synchronisation PTS. Store fragments as long as none has arrived.
        if (typeof this.initPTS === 'undefined') {
          this.unparsedVttFrags.push(data);
          logger.log(`timelineController: Tried to parse WebVTT frag without PTS. Saving frag for later...`);
          return;
        }

        let discontinuity = this.lastDiscontinuity;
        if (discontinuity.cc < data.frag.cc) {
          discontinuity = { cc: data.frag.cc, start: data.frag.start, new: true };
        }
        let textTracks = this.textTracks,
          hls = this.hls;

        // Parse the WebVTT file contents.
        WebVTTParser.parse(data.payload, this.initPTS, discontinuity, function (cues) {
            // Add cues and trigger event with success true.
            cues.forEach(cue => {
              textTracks[data.frag.trackId].addCue(cue);
            });
            hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, {success: true, frag: data.frag});
          },
          function (e) {
            // Something went wrong while parsing. Trigger event with success false.
            logger.log(`Failed to parse VTT cue: ${e}`);
            hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, {success: false, frag: data.frag});
          });
      }
      else {
        // In case there is no payload, finish unsuccessfully.
        this.hls.trigger(Event.SUBTITLE_FRAG_PROCESSED, {success: false, frag: data.frag});
      }
    }
  }

  onFragParsingUserdata(data) {
    // push all of the CEA-708 messages into the interpreter
    // immediately. It will create the proper timestamps based on our PTS value
    if (this.enabled && this.config.enableCEA708Captions)
    {
      for (var i=0; i<data.samples.length; i++)
      {
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
