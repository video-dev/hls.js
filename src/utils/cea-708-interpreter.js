/*
 * CEA-708 interpreter
*/

class CEA708Interpreter {

  constructor(media) {
    this.text = "";
    this.media = media;
  }

  destroy() {
  }

  push(bytes)
  {
    var count = bytes[0] & 31;
    var position = 2;
    var byte, ccbyte1, ccbyte2, ccdata1, ccdata2, ccValid, ccType;

    for (var j=0; j<count; j++)
    {
      byte = bytes[position++];
      ccbyte1 = 0x7F & bytes[position++];
      ccbyte2 = 0x7F & bytes[position++];
      ccValid = !((4 & byte) == 0);
      ccType = (3 & byte);

      if (ccbyte1 === 0 && ccbyte2 === 0)
      {
        continue;
      }

      if (ccValid)
      {
        if (ccType === 0) // || ccType === 1
        {
          if (ccbyte1 === 0x11 || ccbyte1 === 0x19)
          {
            // extended chars, e.g. musical note, accents
            // TODO: fill these in
            this.text += "musical note, etc";
          }
          else if (ccbyte1 == 0x12 || ccbyte1 == 0x1A)
          {
            // spanish / french
            // TODO: fill these in
            this.text += "spanish/french";
          }
          else if (ccbyte1 == 0x13 || ccbyte1 == 0x1B)
          {
            // portugese/german/danish
            // TODO: fill these in
            this.text += "german";
          }
          else if (ccbyte1 == 0x14 || ccbyte1 == 0x1C)
          {
            // Command A
            // TODO: fill these in
            this._flushCaption();
          }            
          else if (ccbyte1 == 0x17 || ccbyte1 == 0x1F)
          {
            // Command A
            // TODO: fill these in
            this._flushCaption();
          }            
          else if (ccbyte1 >= 32 || ccbyte2 >= 32)
          {
            this.text += String.fromCharCode(ccbyte1) + String.fromCharCode(ccbyte2);
          }
        }
      }
    }  
  }

  _flushCaption()
  {
    if (!this._has708)
    {
      this._textTrack = this.media.addTextTrack("subtitles", "English", "en");
      this._textTrack.mode = "showing";
      this._has708 = true;
    }

    if (this.text)
    {
      var cue = new VTTCue(this.media.currentTime, this.media.currentTime+5, this.text);
      //cue.id = "cue";
      cue.pauseOnExit = false;
      this._textTrack.addCue(cue);
      this.text = "";
    }  
  }

}

export default CEA708Interpreter;

