import { fixLineBreaks } from './vttparser';
import { CaptionScreen, Row } from './cea-608-parser';

interface VTTCue extends TextTrackCue {
  new(start: number, end: number, cueText: string): VTTCue
  line: number
  align: string
  position: number
}

export function newCue (track: TextTrack, startTime: number, endTime: number, captionScreen: CaptionScreen) {
  let row: Row;
  // the type data states this is VTTCue, but it can potentially be a TextTrackCue on old browsers
  let cue: VTTCue;
  let indenting: boolean;
  let indent: number;
  let text: string;
  let VTTCue: VTTCue = (window as any).VTTCue as VTTCue || TextTrackCue;

  for (let r = 0; r < captionScreen.rows.length; r++) {
    row = captionScreen.rows[r];
    indenting = true;
    indent = 0;
    text = '';

    if (!row.isEmpty()) {
      for (let c = 0; c < row.chars.length; c++) {
        if (row.chars[c].uchar.match(/\s/) && indenting) {
          indent++;
        } else {
          text += row.chars[c].uchar;
          indenting = false;
        }
      }
      // To be used for cleaning-up orphaned roll-up captions
      row.cueStartTime = startTime;

      // Give a slight bump to the endTime if it's equal to startTime to avoid a SyntaxError in IE
      if (startTime === endTime) {
        endTime += 0.0001;
      }

      cue = new VTTCue(startTime, endTime, fixLineBreaks(text.trim()));

      if (indent >= 16) {
        indent--;
      } else {
        indent++;
      }

      // VTTCue.line get's flakey when using controls, so let's now include line 13&14
      // also, drop line 1 since it's to close to the top
      if (navigator.userAgent.match(/Firefox\//)) {
        cue.line = r + 1;
      } else {
        cue.line = (r > 7 ? r - 2 : r + 1);
      }

      cue.align = 'left';
      // Clamp the position between 0 and 100 - if out of these bounds, Firefox throws an exception and captions break
      cue.position = Math.max(0, Math.min(100, 100 * (indent / 32)));
      track.addCue(cue);
    }
  }
}
