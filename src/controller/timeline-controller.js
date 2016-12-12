/*
 * Timeline Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import Cea608Parser from '../utils/cea-608-parser';

class TimelineController extends EventHandler {

  constructor(hls) {
    super(hls, Event.MEDIA_ATTACHING,
                Event.MEDIA_DETACHING,
                Event.FRAG_PARSING_USERDATA,
                Event.MANIFEST_LOADING,
                Event.FRAG_LOADED,
                Event.LEVEL_SWITCH);

    this.hls = hls;
    this.config = hls.config;
    this.enabled = true;
    this.Cues = hls.config.cueHandler;

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
            if(!existingTrack1)
            {
              self.textTrack1 = self.createTextTrack('captions', 'English', 'en');
              self.textTrack1.textTrack1 = true;
            }
            else
            {
              self.textTrack1 = existingTrack1;
              self.clearCurrentCues(self.textTrack1);

              sendAddTrackEvent(self.textTrack1, self.media);
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

              sendAddTrackEvent(self.textTrack2, self.media);
            }
          }

          self.Cues.newCue(self.textTrack2, startTime, endTime, screen);        }
      };

      this.cea608Parser = new Cea608Parser(0, channel1, channel2);
    }
  }

  clearCurrentCues(track)
  {
    if (track && track.cues)
    {
      while (track.cues.length > 0)
      {
        track.removeCue(track.cues[0]);
      }
    }
  }

  getExistingTrack(channelNumber)
  {
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

  createTextTrack(kind, label, lang)
  {
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
    this.clearCurrentCues(this.textTrack1);
    this.clearCurrentCues(this.textTrack2);
  }

  onManifestLoading()
  {
    this.lastPts = Number.NEGATIVE_INFINITY;
  }

  onLevelSwitch()
  {
    if (this.hls.currentLevel.closedCaptions === 'NONE')
    {
      this.enabled = false;
    }
    else
    {
      this.enabled = true;
    }
  }

  onFragLoaded(data)
  {
    if (data.frag.type === 'main') {
      var pts = data.frag.start; //Number.POSITIVE_INFINITY;
      // if this is a frag for a previously loaded timerange, remove all captions
      // TODO: consider just removing captions for the timerange
      if (pts <= this.lastPts)
      {
      this.clearCurrentCues(this.textTrack1);
      this.clearCurrentCues(this.textTrack2);
      }
      this.lastPts = pts;
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

  extractCea608Data(byteArray)
  {
    var count = byteArray[0] & 31;
    var position = 2;
    var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;
    var actualCCBytes = [];

    for (var j = 0; j < count; j++) {
      tmpByte = byteArray[position++];
      ccbyte1 = 0x7F & byteArray[position++];
      ccbyte2 = 0x7F & byteArray[position++];
      ccValid = (4 & tmpByte) === 0 ? false : true;
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
