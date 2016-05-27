var Cues = {

  newCue: function(track, startTime, endTime, captionScreen) {
    var row;
    var cue;
    var indenting;
    var indent;
    var text;
    var VTTCue = window.VTTCue || window.TextTrackCue;

    for (var r=0; r<captionScreen.rows.length; r++)
    {
      row = captionScreen.rows[r];
      indenting = true;
      indent = 0;
      text = '';

      if (!row.isEmpty())
      {
        for (var c=0; c<row.chars.length; c++)
        {
          if (row.chars[c].uchar.match(/\s/) && indenting)
          {
            indent++;
          }
          else
          {
            text += row.chars[c].uchar;
            indenting = false;
          }
        }
        cue = new VTTCue(startTime, endTime, text.trim());

        if (indent >= 16)
        {
          indent--;
        }
        else
        {
          indent++;
        }

        // VTTCue.line get's flakey when using controls, so let's now include line 13&14
        // also, drop line 1 since it's to close to the top
        if (navigator.userAgent.match(/Firefox\//))
        {
          cue.line = r + 1;
        }
        else
        {
          cue.line = (r > 7 ? r - 2 : r + 1);
        }
        cue.align = 'left';
        cue.position = 100 * (indent / 32) + (navigator.userAgent.match(/Firefox\//) ? 50 : 0);
        track.addCue(cue);
      }
    }
  }

};

module.exports = Cues;
