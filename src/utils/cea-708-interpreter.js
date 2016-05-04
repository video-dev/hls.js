/*
 * CEA-708 interpreter
*/

// Basic North American 608 CC char set, mostly ASCII. Indexed by (char-0x20).
const BASIC_CHARACTER_SET = [
  0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27,     //   ! " # $ % & '
  0x28, 0x29,                                         // ( )
  0xE1,       // 2A: 225 'á' "Latin small letter A with acute"
  0x2B, 0x2C, 0x2D, 0x2E, 0x2F,                       //       + , - . /
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37,     // 0 1 2 3 4 5 6 7
  0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F,     // 8 9 : ; < = > ?
  0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,     // @ A B C D E F G
  0x48, 0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F,     // H I J K L M N O
  0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57,     // P Q R S T U V W
  0x58, 0x59, 0x5A, 0x5B,                             // X Y Z [
  0xE9,       // 5C: 233 'é' "Latin small letter E with acute"
  0x5D,                                               //           ]
  0xED,       // 5E: 237 'í' "Latin small letter I with acute"
  0xF3,       // 5F: 243 'ó' "Latin small letter O with acute"
  0xFA,       // 60: 250 'ú' "Latin small letter U with acute"
  0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67,           //   a b c d e f g
  0x68, 0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F,     // h i j k l m n o
  0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77,     // p q r s t u v w
  0x78, 0x79, 0x7A,                                   // x y z
  0xE7,       // 7B: 231 'ç' "Latin small letter C with cedilla"
  0xF7,       // 7C: 247 '÷' "Division sign"
  0xD1,       // 7D: 209 'Ñ' "Latin capital letter N with tilde"
  0xF1,       // 7E: 241 'ñ' "Latin small letter N with tilde"
  0x25A0      // 7F:         "Black Square" (NB: 2588 = Full Block)
];

// Special North American 608 CC char set.
const SPECIAL_CHARACTER_SET = [
  0xAE,    // 30: 174 '®' "Registered Sign" - registered trademark symbol
  0xB0,    // 31: 176 '°' "Degree Sign"
  0xBD,    // 32: 189 '½' "Vulgar Fraction One Half" (1/2 symbol)
  0xBF,    // 33: 191 '¿' "Inverted Question Mark"
  0x2122,  // 34:         "Trade Mark Sign" (tm superscript)
  0xA2,    // 35: 162 '¢' "Cent Sign"
  0xA3,    // 36: 163 '£' "Pound Sign" - pounds sterling
  0x266A,  // 37:         "Eighth Note" - music note
  0xE0,    // 38: 224 'à' "Latin small letter A with grave"
  0x20,    // 39:         TRANSPARENT SPACE - for now use ordinary space
  0xE8,    // 3A: 232 'è' "Latin small letter E with grave"
  0xE2,    // 3B: 226 'â' "Latin small letter A with circumflex"
  0xEA,    // 3C: 234 'ê' "Latin small letter E with circumflex"
  0xEE,    // 3D: 238 'î' "Latin small letter I with circumflex"
  0xF4,    // 3E: 244 'ô' "Latin small letter O with circumflex"
  0xFB     // 3F: 251 'û' "Latin small letter U with circumflex"
];

// Extended Spanish/Miscellaneous and French char set.
const SPECIAL_ES_FR_CHARACTER_SET = [
  // Spanish and misc.
  0xC1, 0xC9, 0xD3, 0xDA, 0xDC, 0xFC, 0x2018, 0xA1,
  0x2A, 0x27, 0x2014, 0xA9, 0x2120, 0x2022, 0x201C, 0x201D,
  // French.
  0xC0, 0xC2, 0xC7, 0xC8, 0xCA, 0xCB, 0xEB, 0xCE,
  0xCF, 0xEF, 0xD4, 0xD9, 0xF9, 0xDB, 0xAB, 0xBB
];

// Extended Portuguese and German/Danish char set.
const SPECIAL_PT_DE_CHARACTER_SET = [
  // Portuguese.
  0xC3, 0xE3, 0xCD, 0xCC, 0xEC, 0xD2, 0xF2, 0xD5,
  0xF5, 0x7B, 0x7D, 0x5C, 0x5E, 0x5F, 0x7C, 0x7E,
  // German/Danish.
  0xC4, 0xE4, 0xD6, 0xF6, 0xDF, 0xA5, 0xA4, 0x2502,
  0xC5, 0xE5, 0xD8, 0xF8, 0x250C, 0x2510, 0x2514, 0x2518
];

const END_OF_CAPTION = 0x2F;

const RESUME_CAPTION_LOADING = 0x20;
const RESUME_DIRECT_CAPTIONING = 0x29;
const ERASE_DISPLAYED_MEMORY = 0x2C;
const CARRIAGE_RETURN = 0x2D;
const ERASE_NON_DISPLAYED_MEMORY = 0x2E;

const BACKSPACE = 0x21;

const MID_ROW_CHAN_1 = 0x11;
const MID_ROW_CHAN_2 = 0x19;

const MISC_CHAN_1 = 0x14;
const MISC_CHAN_2 = 0x1C;

const TAB_OFFSET_CHAN_1 = 0x17;
const TAB_OFFSET_CHAN_2 = 0x1F;

class CEA708Interpreter {

  constructor(options) {
    options = options || {};

    // We need to cap max caption display time in case endTime is not yet
    // determined and the user seeks beyond the end caption control code, and
    // we'd otherwise end up with a caption that stays on-screen for possibly
    // a very long time (if seeking far ahead for example)
    this.maxDisplayTime = options.maxDisplayTime || 30;

    // In some streams, captions only stay on-screen for fractions of a second.
    // We can enforce a minimum display time:
    this.minDisplayTime = options.minDisplayTime || false;

    // When minDisplayTime is applied, we don't overlap the next caption,
    // except if the caption is due to end X seconds after the next caption
    // begins:
    this.allowedOverlapTime = options.allowedOverlapTime || false;
  }

  attach(media) {
    this.media = media;
    this.display = [];
    this.memory = [];

    if (this.media.textTracks && this.media.textTracks.length) {
      this.textTrack = this.media.textTracks[0];
    } else {
      this.textTrack = this.media.addTextTrack('captions', 'English', 'en');
    }
  }

  detach() {
    this.clear();
    this.display = [];
    this.memory = [];
    this.textTrack = null;
    this.media = null;
  }

  createCue() {
    var VTTCue = window.VTTCue || window.TextTrackCue;

    var cue = this.cue = new VTTCue(-1, -1, '');
    cue.text = '';
    cue.pauseOnExit = false;

    // make sure it doesn't show up before it's ready
    cue.startTime = Number.MAX_VALUE;

    // show it 'forever' once we do show it
    // (we'll set the end time once we know it later)
    cue.endTime = Number.MAX_VALUE;

    this.memory.push(cue);
  }

  clear() {
    if (this.textTrack && this.textTrack.cues) {
      while (this.textTrack.cues.length) {
        this.textTrack.removeCue(this.textTrack.cues[0]);
      }
    }
  }

  push(timestamp, bytes) {
    this.timestamp = timestamp;

    let ccCount = bytes[0] & 0x1F;
    let position = 2;

    for (let i = 0; i < ccCount; i++) {
      let tmpByte = bytes[position++];

      let ccValid = ((4 & tmpByte) === 0 ? false : true);
      if (!ccValid) {
        continue;
      }

      let ccType = (3 & tmpByte);
      if (ccType !== 0) {
        continue;
      }

      let ccData1 = 0x7F & bytes[position++];
      let ccData2 = 0x7F & bytes[position++];

      // Ignore empty captions.
      if (ccData1 === 0 && ccData2 === 0) {
        continue;
      }

      // Special North American character set.
      // ccData2 - P|0|1|1|X|X|X|X
      if ((ccData1 === 0x11 || ccData1 === 0x19) && ((ccData2 & 0x70) === 0x30)) {
        this.pushChar(this.getSpecialChar(ccData2));
        continue;
      }

      // Extended Spanish/Miscellaneous and French character set.
      // ccData2 - P|0|1|X|X|X|X|X
      if ((ccData1 === 0x12 || ccData1 === 0x1A) && ((ccData2 & 0x60) === 0x20)) {
        this.pushBackspace(); // Remove standard equivalent of the special extended char.
        this.pushChar(this.getExtendedEsFrChar(ccData2));
        continue;
      }

      // Extended Portuguese and German/Danish character set.
      // ccData2 - P|0|1|X|X|X|X|X
      if ((ccData1 === 0x13 || ccData1 === 0x1B) && ((ccData2 & 0x60) === 0x20)) {
        this.pushBackspace(); // Remove standard equivalent of the special extended char.
        this.pushChar(this.getExtendedPtDeChar(ccData2));
        continue;
      }

      // Control character.
      if (ccData1 < 0x20) {
        this.pushCtrl(ccData1, ccData2);
        continue;
      }

      // Basic North American character set.
      this.pushChar(this.getChar(ccData1));
      if (ccData2 >= 0x20) {
        this.pushChar(this.getChar(ccData2));
      }
    }
  }

  getChar(ccData) {
    let index = (ccData & 0x7F) - 0x20;
    return String.fromCharCode(BASIC_CHARACTER_SET[index]);
  }

  getSpecialChar(ccData) {
    let index = ccData & 0xF;
    return String.fromCharCode(SPECIAL_CHARACTER_SET[index]);
  }

  getExtendedEsFrChar(ccData) {
    let index = ccData & 0x1F;
    return String.fromCharCode(SPECIAL_ES_FR_CHARACTER_SET[index]);
  }

  getExtendedPtDeChar(ccData) {
    let index = ccData & 0x1F;
    return String.fromCharCode(SPECIAL_PT_DE_CHARACTER_SET[index]);
  }

  pushBackspace() {
    this.pushCtrl(0x14, BACKSPACE);
  }

  pushChar(char) {
    this.ensureCue();

    if ((this.cue.text === '' || this.cue.text.substr(-1) === '\n') && /\s/.test(char)) {
      return;
    }

    this.cue.text += char;
  }

  pushCtrl(ccData1, ccData2) {
    this.ensureCue();

    if (this.isMiscCode(ccData1, ccData2)) {
      switch (ccData2) {
        case RESUME_CAPTION_LOADING:
          this.clearActiveCues();
          break;
        case BACKSPACE:
          this.cue.text = this.cue.text.slice(0, -1);
          break;
        case RESUME_DIRECT_CAPTIONING:
          this.clearActiveCues();
          break;
        case ERASE_DISPLAYED_MEMORY:
        case ERASE_NON_DISPLAYED_MEMORY:
          this.clearActiveCues();
          break;
        case END_OF_CAPTION:
          if (this.cue.text !== '') {
            this.flipMemory();
          }
          break;
        case CARRIAGE_RETURN:
          this.maybeAppendNewline();
          break;
      }
    } else if (this.isPreambleAddressCode(ccData1, ccData2)) {
      this.maybeAppendNewline();
    }
  }

  ensureCue() {
    if (!this.cue) {
      this.createCue();
    }

    if (!this.cue.text || typeof this.cue.text !== 'string') {
      this.cue.text = '';
    }
  }

  maybeAppendNewline() {
    if (this.cue.text.length > 0 && this.cue.text.substr(-1) !== '\n') {
      this.cue.text += '\n';
    }
  }

  isMidRowCode(cc1, cc2) {
    return (cc1 === MID_ROW_CHAN_1 || cc1 === MID_ROW_CHAN_2) && (cc2 >= 0x20 && cc2 <= 0x2F);
  }

  isMiscCode(cc1, cc2) {
    return (cc1 === MISC_CHAN_1 || cc1 === MISC_CHAN_2) && (cc2 >= 0x20 && cc2 <= 0x2F);
  }

  isTabOffsetCode(cc1, cc2) {
    return (cc1 === TAB_OFFSET_CHAN_1 || cc1 === TAB_OFFSET_CHAN_2) && (cc2 >= 0x21 && cc2 <= 0x23);
  }

  isPreambleAddressCode(cc1, cc2) {
    return (cc1 >= 0x10 && cc1 <= 0x1F) && (cc2 >= 0x40 && cc2 <= 0x7F);
  }

  flipMemory() {
    this.clearActiveCues();
    this.flushCaptions();
  }

  flushCaptions() {
    for (let memoryItem of this.memory) {
      memoryItem.startTime = this.timestamp;
      this.textTrack.addCue(memoryItem);
      this.display.push(memoryItem);
    }

    this.memory = [];
    this.cue = null;

    this.adjustCueTimingValues();
  }

  adjustCueTimingValues() {
    for (let i = 0; i < this.textTrack.cues.length; i++) {
      let cue = this.textTrack.cues[i];
      let nextCue = i < this.textTrack.cues.length - 1 ? this.textTrack.cues[i + 1] : null;
      let diff = cue.endTime - cue.startTime;

      if (this.minDisplayTime > 0) {
        if (diff < this.minDisplayTime) {
          cue.endTime = cue.startTime + this.minDisplayTime;
        }
      }

      if (this.allowedOverlapTime > 0) {
        if (nextCue && nextCue.startTime < cue.endTime && (cue.endTime - nextCue.startTime > this.allowedOverlapTime)) {
          cue.endTime = nextCue.startTime - 0.001;
        }
      }
    }
  }

  clearActiveCues() {
    for (let displayItem of this.display) {
      displayItem.endTime = this.timestamp;

      if (displayItem.startTime !== Number.MAX_VALUE && displayItem.endTime - displayItem.startTime > this.maxDisplayTime) {
        displayItem.endTime = displayItem.startTime + this.maxDisplayTime;
      }
    }

    this.display = [];
  }

}

export default CEA708Interpreter;
