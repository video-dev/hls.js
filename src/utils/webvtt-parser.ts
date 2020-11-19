import VTTParser from './vttparser';
import { utf8ArrayToStr } from '../demux/id3';
import { toMpegTsClockFromTimescale } from './timescale-conversion';
import type { VTTCCs } from '../types/vtt';

// String.prototype.startsWith is not supported in IE11
const startsWith = function (inputString: string, searchString: string, position: number = 0) {
  return inputString.substr(position, searchString.length) === searchString;
};

const cueString2millis = function (timeString: string) {
  let ts = parseInt(timeString.substr(-3));
  const secs = parseInt(timeString.substr(-6, 2));
  const mins = parseInt(timeString.substr(-9, 2));
  const hours = timeString.length > 9 ? parseInt(timeString.substr(0, timeString.indexOf(':'))) : 0;

  if (!Number.isFinite(ts) || !Number.isFinite(secs) || !Number.isFinite(mins) || !Number.isFinite(hours)) {
    throw Error(`Malformed X-TIMESTAMP-MAP: Local:${timeString}`);
  }

  ts += 1000 * secs;
  ts += 60 * 1000 * mins;
  ts += 60 * 60 * 1000 * hours;

  return ts;
};

// From https://github.com/darkskyapp/string-hash
const hash = function (text: string) {
  let hash = 5381;
  let i = text.length;
  while (i) {
    hash = (hash * 33) ^ text.charCodeAt(--i);
  }

  return (hash >>> 0).toString();
};

const calculateOffset = function (vttCCs: VTTCCs, cc, presentationTime) {
  let currCC = vttCCs[cc];
  let prevCC = vttCCs[currCC.prevCC];

  // This is the first discontinuity or cues have been processed since the last discontinuity
  // Offset = current discontinuity time
  if (!prevCC || (!prevCC.new && currCC.new)) {
    vttCCs.ccOffset = vttCCs.presentationOffset = currCC.start;
    currCC.new = false;
    return;
  }

  // There have been discontinuities since cues were last parsed.
  // Offset = time elapsed
  while (prevCC?.new) {
    vttCCs.ccOffset += currCC.start - prevCC.start;
    currCC.new = false;
    currCC = prevCC;
    prevCC = vttCCs[currCC.prevCC];
  }

  vttCCs.presentationOffset = presentationTime;
};

// TODO(typescript-vttparser): When VTT parser is typed, errorCallback needs to get the proper typing here.
export function parseWebVTT (
  vttByteArray: ArrayBuffer, initPTS: number, timescale: number, vttCCs: VTTCCs,
  cc: number, callBack: (cues: VTTCue[]) => void, errorCallBack: (arg0: any) => void
) {
  // Convert byteArray into string, replacing any somewhat exotic linefeeds with "\n", then split on that character.
  const re = /\r\n|\n\r|\n|\r/g;
  // Uint8Array.prototype.reduce is not implemented in IE11
  const vttLines = utf8ArrayToStr(new Uint8Array(vttByteArray)).trim().replace(re, '\n').split('\n');

  let syncPTS = toMpegTsClockFromTimescale(initPTS, timescale);
  let cueTime = '00:00.000';
  let mpegTs = 0;
  let localTime = 0;
  let presentationTime = 0;
  const cues: VTTCue[] = [];
  let parsingError;
  let inHeader = true;
  let timestampMap = false;
  // let VTTCue = VTTCue || window.TextTrackCue;

  // Create parser object using VTTCue with TextTrackCue fallback on certain browsers.
  const parser = new VTTParser();

  parser.oncue = function (cue: VTTCue) {
    // Adjust cue timing; clamp cues to start no earlier than - and drop cues that don't end after - 0 on timeline.
    const currCC = vttCCs[cc];
    let cueOffset = vttCCs.ccOffset;

    // Update offsets for new discontinuities
    if (currCC?.new) {
      if (localTime !== undefined) {
        // When local time is provided, offset = discontinuity start time - local time
        cueOffset = vttCCs.ccOffset = currCC.start;
      } else {
        calculateOffset(vttCCs, cc, presentationTime);
      }
    }

    if (presentationTime) {
      // If we have MPEGTS, offset = presentation time + discontinuity offset
      cueOffset = presentationTime - vttCCs.presentationOffset;
    }

    if (timestampMap) {
      cue.startTime += cueOffset - localTime;
      cue.endTime += cueOffset - localTime;
    }

    // Create a unique hash id for a cue based on start/end times and text.
    // This helps timeline-controller to avoid showing repeated captions.
    cue.id = hash(cue.startTime.toString()) + hash(cue.endTime.toString()) + hash(cue.text);

    // Fix encoding of special characters
    cue.text = decodeURIComponent(encodeURIComponent(cue.text));
    if (cue.endTime > 0) {
      cues.push(cue);
    }
  };

  parser.onparsingerror = function (e) {
    parsingError = e;
  };

  parser.onflush = function () {
    if (parsingError && errorCallBack) {
      errorCallBack(parsingError);
      return;
    }
    callBack(cues);
  };

  // Go through contents line by line.
  vttLines.forEach(line => {
    if (inHeader) {
      // Look for X-TIMESTAMP-MAP in header.
      if (startsWith(line, 'X-TIMESTAMP-MAP=')) {
        // Once found, no more are allowed anyway, so stop searching.
        inHeader = false;
        timestampMap = true;
        // Extract LOCAL and MPEGTS.
        line.substr(16).split(',').forEach(timestamp => {
          if (startsWith(timestamp, 'LOCAL:')) {
            cueTime = timestamp.substr(6);
          } else if (startsWith(timestamp, 'MPEGTS:')) {
            mpegTs = parseInt(timestamp.substr(7));
          }
        });
        try {
          // Calculate subtitle offset in milliseconds.
          if (syncPTS + ((vttCCs[cc].start * 90000) || 0) < 0) {
            syncPTS += 8589934592;
          }
          // Adjust MPEGTS by sync PTS.
          mpegTs -= syncPTS;
          // Convert cue time to seconds
          localTime = cueString2millis(cueTime) / 1000;
          // Convert MPEGTS to seconds from 90kHz.
          presentationTime = mpegTs / 90000;
        } catch (e) {
          timestampMap = false;
          parsingError = e;
        }
        // Return without parsing X-TIMESTAMP-MAP line.
        return;
      } else if (line === '') {
        inHeader = false;
      }
    }
    // Parse line by default.
    parser.parse(line + '\n');
  });

  parser.flush();
}
