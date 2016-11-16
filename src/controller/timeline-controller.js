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
                Event.MEDIA_DETACHING,
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
            if(!existingTrack1)
            {
              self.textTrack1 = self.createTextTrack('captions', 'English', 'en');
              self.textTrack1.textTrack1 = true;
            }
            else
            {
              self.textTrack1 = existingTrack1;
              self.clearCurrentCues(self.textTrack1);

              let e = new window.Event('addtrack');
              e.track = self.textTrack1;
              self.media.dispatchEvent(e);
            }
          }

          self.Cues.newCue(self.textTrack1, startTime, endTime, screen);
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
            if(!existingTrack2)
            {
              self.textTrack2 = self.createTextTrack('captions', 'Spanish', 'es');
              self.textTrack2.textTrack2 = true;
            }
            else
            {
              self.textTrack2 = existingTrack2;
              self.clearCurrentCues(self.textTrack2);

              let e = new window.Event('addtrack');
              e.track = self.textTrack2;
              self.media.dispatchEvent(e);
            }
          }
          self.Cues.newCue(self.textTrack2, startTime, endTime, screen);
        }
      };

      this.cea608Parser = new Cea608Parser(0, channel1, channel2);
    }
  }

  // Triggered when an initial PTS is found; used for synchronisation of WebVTT.
  onInitPtsFound(data) {
    if(typeof this.initPTS === 'undefined') {
      this.initPTS = data.initPTS;
    }

    // Due to asynchrony, initial PTS may arrive later than the first VTT fragments are loaded.
    // Parse any unparsed fragments upon receiving the initial PTS.
    if(this.unparsedVttFrags.length) {
      this.unparsedVttFrags.forEach(frag => {
        this.onFragLoaded(frag);
      });
      this.unparsedVttFrags = [];
    }
  }

  clearCurrentCues(track) {
    if (track && track.cues)
    {
      while (track.cues.length > 0)
      {
        track.removeCue(track.cues[0]);
      }
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

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onMediaAttaching(data) {
    this.media = data.media;
  }

  onMediaDetaching() {
  }

  onManifestLoading()
  {
    this.lastPts = Number.NEGATIVE_INFINITY;
  }

  onManifestLoaded(data) {
    // TODO: actually remove the tracks from the media object.
    this.textTracks = [];

    this.unparsedVttFrags = [];
    this.initPTS = undefined;

    // TODO: maybe enable WebVTT if "forced"?
    if(this.config.enableWebVTT) {
      this.tracks = data.subtitles || [];
      const currentTracks = this.media.textTracks;

      // Reuse existing tracks before creating more
      this.tracks.forEach((track, index) => {
        let textTrack = currentTracks[index];
        if (!textTrack) {
          textTrack = this.createTextTrack('subtitles', track.name, track.lang);
        } else {
          this.clearCurrentCues(textTrack);
          textTrack.inuse = true;
          textTrack.name = track.name;
          textTrack.lang = track.lang;
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
      var pts = data.frag.start; //Number.POSITIVE_INFINITY;
      // if this is a frag for a previously loaded timerange, remove all captions
      // TODO: consider just removing captions for the timerange
      if (pts <= this.lastPts) {
        this.clearCurrentCues(this.textTrack1);
        this.clearCurrentCues(this.textTrack2);
      }
      this.lastPts = pts;
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
        let textTracks = this.textTracks,
          hls = this.hls;

        // Parse the WebVTT file contents.
        WebVTTParser.parse(data.payload, this.initPTS, function (cues) {
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
