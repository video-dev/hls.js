import { fixLineBreaks } from './vttparser';
import VTTCue from './vttcue';

export function createCues (startTime, endTime, captionScreen) {
  let row;
  let cue;
  let indenting;
  let indent;
  let text;
  const cues = [];

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

      // Assume that if there's the same amount of white space (indent) before and after cue.text,
      // the text should be centered.
      // Account for slight overflow by using a tolerance of 2 columns
      if (Math.abs(32 - (cue.text.length + indent * 2)) > 2) {
        // The column width is defined as 2.5% of the video width, because CEA-608 requires 32 columns of characters
        // to be rendered on 80% of the video's width.
        // https://dvcs.w3.org/hg/text-tracks/raw-file/default/608toVTT/608toVTT.html#positioning-in-cea-608
        cue.align = 'left';
        cue.position = Math.max(10, Math.min(90, 10 + 2.5 * indent));
      }
      cues.push(cue);
    }
  }

  return cues;
}
