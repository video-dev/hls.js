var FRAG_TOLERANCE = 0.5;
var CUE_TOLERANCE = 0.01;
var LEVEL_CUE_TOLERANCE = 0.1;
var ROLLUP_MAX_ROWS = 4;

function updateEndTimeForMultiFragCues(cue, track){
  //Check for sequential fragment loading - necessary for captions that span multiple fragments.
  if (track.curFragStartTime && track.prevFragEndTime && Math.abs(track.curFragStartTime - track.prevFragEndTime) > FRAG_TOLERANCE) {
    //We cannot fully rely on the endTime value for captions that span multiple fragments.
    //Confirm first if its startTime is in the previous fragment. This can be checked by its startTime not within the current fragment.
    if (cue.startTime < track.curFragStartTime - FRAG_TOLERANCE || cue.startTime > track.curFragEndTime + FRAG_TOLERANCE) {
      //Then check if its endTime is not in the previous fragment.
      if (cue.endTime < track.prevFragStartTime - FRAG_TOLERANCE || cue.endTime > track.prevFragEndTime + FRAG_TOLERANCE) {
        //For Pop-On captions, they could be parsed way before curFrag and prevFrag and are just waiting for an EOC command.
        if (track.prevFragEndTime > track.curFragEndTime && cue.endTime < track.prevFragEndTime) {
          return;
        }
        //By this point, we can only guarantee that its endTime should only be the endTime of the previous fragment.
        cue.endTime = track.prevFragEndTime;
      }
    }
  }
}

function binarySearchCue(num, arr){
  var mid;
  var lo = 0;
  var hi = arr.length - 1;
  var retVal = 0;
  if(arr.length > 0) {
    while (hi - lo > 1) {
      mid = Math.floor((lo + hi) / 2);
      if (Math.abs(arr[mid].startTime - num) < CUE_TOLERANCE) {
        return mid;
      }
      if (arr[mid].startTime < num) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    if (Math.abs(arr[hi].startTime - num) < CUE_TOLERANCE || arr[hi].startTime < num) {
      retVal = hi;
    } else {
      retVal = lo;
    }
  }
  return retVal;
}

function isADuplicate(cue, track){
  var duplicateFound = false;
  var tCues = track.cues;
  if (tCues && tCues.length > 0) {
    var len = tCues.length;
    var cueStartIndex = binarySearchCue(cue.startTime, tCues);
    if( cueStartIndex >= 0 && cueStartIndex < len) {
      //Consider up to +/-ROLLUP_MAX_ROWS cues for roll-up captions
      var cueStart = (cueStartIndex - ROLLUP_MAX_ROWS) < 0   ? 0 :   (cueStartIndex - ROLLUP_MAX_ROWS);
      var cueEnd   = (cueStartIndex + ROLLUP_MAX_ROWS) > len ? len : (cueStartIndex + ROLLUP_MAX_ROWS);
      for(var i = cueStart; i < cueEnd; i++) {
        var obj = tCues[i];
        var tol = CUE_TOLERANCE;
        if (obj && track && obj.curFragLevel !== track.curFragLevel) {
          tol += LEVEL_CUE_TOLERANCE;
        }
        //The || here is necessary to filter out the case when the endTime was added mainly because we found an EOC, RCL, RDL or EDM on a different fragment.
        if ((Math.abs(obj.startTime - cue.startTime) <= tol || Math.abs(obj.endTime - cue.endTime) <= tol) && obj.line === cue.line) {
          duplicateFound = true;
          break;
        }
        if (track.curFragEndTime && track.curFragEndTime + FRAG_TOLERANCE <= obj.startTime) {
          break;
        }
      }
    }
  }
  return duplicateFound;
}

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
        //To be used for cleaning-up orphaned roll-up captions
        row.cueStartTime = startTime;
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
        // Clamp the position between 0 and 100 - if out of these bounds, Firefox throws an exception and captions break
        cue.position = Math.max(0, Math.min(100, 100 * (indent / 32) + (navigator.userAgent.match(/Firefox\//) ? 50 : 0)));

        updateEndTimeForMultiFragCues(cue, track);

        if (isADuplicate(cue, track) === false) {
          cue.curFragLevel = track.curFragLevel;
          track.addCue(cue);
        }
      }
    }
  }

};

module.exports = Cues;
