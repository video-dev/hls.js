/*
 * CEA-708 interpreter
*/

class CEA708Interpreter {
    constructor() {}

    attach(media) {
        this.media = media;
        this.display = [];
        this.memory = [];
        this._createCue();
    }

    detatch() {
        this.clear();
    }

    destroy() {}

    _createCue() {
        this.cue = new VTTCue(-1, -1, '');
        this.cue.text = '';
        this.cue.pauseOnExit = false;

        // make sure it doesn't show up before it's ready
        this.startTime = Number.MAX_VALUE;

        // show it 'forever' once we do show it
        // (we'll set the end time once we know it later)
        this.cue.endTime = Number.MAX_VALUE;

        this.memory.push(this.cue);
    }

    clear() {
        if (this._textTrack && this._textTrack.cues) {
            while (this._textTrack.cues.length > 0) {
                this._textTrack.removeCue(this._textTrack.cues[0]);
            }
        }
    }

    push(timestamp, bytes) {
        var count = bytes[0] & 31;
        var position = 2;
        var byte, ccbyte1, ccbyte2, ccdata1, ccdata2, ccValid, ccType;

        for (var j = 0; j < count; j++) {
            byte = bytes[position++];
            ccbyte1 = 0x7f & bytes[position++];
            ccbyte2 = 0x7f & bytes[position++];
            ccValid = !((4 & byte) == 0);
            ccType = 3 & byte;

            if (ccbyte1 === 0 && ccbyte2 === 0) {
                continue;
            }

            if (ccValid) {
                if (ccType === 0) {
                    // || ccType === 1
                    // Standard Characters
                    if (0x20 & ccbyte1 || 0x40 & ccbyte1) {
                        this.cue.text +=
                            this._fromCharCode(ccbyte1) +
                            this._fromCharCode(ccbyte2);
                        console.log(this.cue.text);
                    } else if (
                        (ccbyte1 === 0x11 || ccbyte1 === 0x19) &&
                        ccbyte2 >= 0x30 &&
                        ccbyte2 <= 0x3f
                    ) {
                        // Special Characters
                        // extended chars, e.g. musical note, accents
                        switch (ccbyte2) {
                            case 48:
                                this.cue.text += '®';
                                break;
                            case 49:
                                this.cue.text += '°';
                                break;
                            case 50:
                                this.cue.text += '½';
                                break;
                            case 51:
                                this.cue.text += '¿';
                                break;
                            case 52:
                                this.cue.text += '™';
                                break;
                            case 53:
                                this.cue.text += '¢';
                                break;
                            case 54:
                                this.cue.text += '';
                                break;
                            case 55:
                                this.cue.text += '£';
                                break;
                            case 56:
                                this.cue.text += '♪';
                                break;
                            case 57:
                                this.cue.text += ' ';
                                break;
                            case 58:
                                this.cue.text += 'è';
                                break;
                            case 59:
                                this.cue.text += 'â';
                                break;
                            case 60:
                                this.cue.text += 'ê';
                                break;
                            case 61:
                                this.cue.text += 'î';
                                break;
                            case 62:
                                this.cue.text += 'ô';
                                break;
                            case 63:
                                this.cue.text += 'û';
                                break;
                        }
                    }
                    if (
                        (ccbyte1 === 0x11 || ccbyte1 === 0x19) &&
                        ccbyte2 >= 0x20 &&
                        ccbyte2 <= 0x2f
                    ) {
                        // Mid-row codes: color/underline
                        switch (ccbyte2) {
                            case 0x20:
                                // White
                                break;
                            case 0x21:
                                // White Underline
                                break;
                            case 0x22:
                                // Green
                                break;
                            case 0x23:
                                // Green Underline
                                break;
                            case 0x24:
                                // Blue
                                break;
                            case 0x25:
                                // Blue Underline
                                break;
                            case 0x26:
                                // Cyan
                                break;
                            case 0x27:
                                // Cyan Underline
                                break;
                            case 0x28:
                                // Red
                                break;
                            case 0x29:
                                // Red Underline
                                break;
                            case 0x2a:
                                // Yellow
                                break;
                            case 0x2b:
                                // Yellow Underline
                                break;
                            case 0x2c:
                                // Magenta
                                break;
                            case 0x2d:
                                // Magenta Underline
                                break;
                            case 0x2e:
                                // Italics
                                break;
                            case 0x2f:
                                // Italics Underline
                                break;
                        }
                    }
                    if (
                        (ccbyte1 === 0x14 || ccbyte1 === 0x1c) &&
                        ccbyte2 >= 0x20 &&
                        ccbyte2 <= 0x2f
                    ) {
                        // Mid-row codes: color/underline
                        switch (ccbyte2) {
                            case 0x20:
                                console.log('-RCL-');
                                // TODO: shouldn't affect roll-ups...
                                this._clearActiveCues(timestamp);
                                // RCL: Resume Caption Loading
                                // begin pop on
                                break;
                            case 0x21:
                                console.log('-BS-');
                                // BS: Backspace
                                this.cue.text = this.cue.text.substr(
                                    0,
                                    this.cue.text.length - 1
                                );
                                break;
                            case 0x22:
                                console.log('-AOF-');
                                // AOF: reserved (formerly alarm off)
                                break;
                            case 0x23:
                                console.log('-AON-');
                                // AON: reserved (formerly alarm on)
                                break;
                            case 0x24:
                                console.log('-DER-');
                                // DER: Delete to end of row
                                break;
                            case 0x25:
                                console.log('-RU2-');
                                // RU2: roll-up 2 rows
                                this._rollup(2);
                                break;
                            case 0x26:
                                console.log('-RU3-');
                                // RU3: roll-up 3 rows
                                this._rollup(3);
                                break;
                            case 0x27:
                                console.log('-RU4-');
                                // RU4: roll-up 4 rows
                                this._rollup(4);
                                break;
                            case 0x28:
                                console.log('-FON-');
                                // FON: Flash on
                                break;
                            case 0x29:
                                console.log('-RDC-');
                                // RDC: Resume direct captioning
                                this._clearActiveCues(timestamp);
                                break;
                            case 0x2a:
                                console.log('-TR-');
                                // TR: Text Restart
                                break;
                            case 0x2b:
                                console.log('-RTD-');
                                // RTD: Resume Text Display
                                break;
                            case 0x2c:
                                console.log('-EDM-');
                                // EDM: Erase Displayed Memory
                                this._clearActiveCues(timestamp);
                                break;
                            case 0x2d:
                                console.log('-CR-');
                                // CR: Carriage Return
                                // only affects roll-up
                                this._rollup(1);
                                break;
                            case 0x2e:
                                console.log('-ENM-');
                                // ENM: Erase non-displayed memory
                                this._text = '';
                                break;
                            case 0x2f:
                                console.log('-EOC-: ' + timestamp);
                                this._flipMemory(timestamp);
                                // EOC: End of caption
                                // hide any displayed captions and show any hidden one
                                break;
                        }
                    }
                    if (
                        (ccbyte1 === 0x17 || ccbyte1 === 0x1f) &&
                        ccbyte2 >= 0x21 &&
                        ccbyte2 <= 0x23
                    ) {
                        // Mid-row codes: color/underline
                        switch (ccbyte2) {
                            case 0x21:
                                // TO1: tab offset 1 column
                                break;
                            case 0x22:
                                // TO1: tab offset 2 column
                                break;
                            case 0x23:
                                // TO1: tab offset 3 column
                                break;
                        }
                    } else {
                        // Probably a pre-amble address code
                    }
                }
            }
        }
    }

    _fromCharCode(byte) {
        if (byte === 42) {
            return 'á';
        } else if (byte === 92) {
            return 'é';
        } else if (byte === 94) {
            return 'í';
        } else if (byte === 95) {
            return 'ó';
        } else if (byte === 96) {
            return 'ú';
        } else if (byte === 123) {
            return 'ç';
        } else if (byte === 124) {
            return '÷';
        } else if (byte === 125) {
            return 'Ñ';
        } else if (byte === 126) {
            return 'ñ';
        } else if (byte === 127) {
            return '█';
        } else {
            return String.fromCharCode(byte);
        }
    }

    _flipMemory(timestamp) {
        this._clearActiveCues(timestamp);
        this._flushCaptions(timestamp);
    }

    _flushCaptions(timestamp) {
        if (!this._has708) {
            this._textTrack = this.media.addTextTrack(
                'captions',
                'English',
                'en'
            );
            this._has708 = true;
        }

        for (var i = 0; i < this.memory.length; i++) {
            console.error(this.memory[i].text);

            this.memory[i].startTime = timestamp;
            this._textTrack.addCue(this.memory[i]);
            this.display.push(this.memory[i]);
        }

        this.memory = [];

        this._createCue();
    }

    _clearActiveCues(timestamp) {
        for (var i = 0; i < this.display.length; i++) {
            this.display[i].endTime = timestamp;
        }

        this.display = [];
    }

    _rollUp(n) {
        // TODO: implement roll-up captions
    }

    _clearBufferedCues() {
        //remove them all...
    }
}

export default CEA708Interpreter;
