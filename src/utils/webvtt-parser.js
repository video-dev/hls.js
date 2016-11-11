import { WebVTT } from 'vtt.js';

const cueString2millis = function(timeString) {
    let ts = parseInt(timeString.substr(-3)),
        secs = parseInt(timeString.substr(-6,2)),
        mins = parseInt(timeString.substr(-9,2)),
        hours = timeString.length > 9 ? parseInt(timeString.substr(0, timeString.indexOf(':'))) : 0;

    if(isNaN(ts) || isNaN(secs) || isNaN(mins) || isNaN(hours)) {
      return -1;
    }

    ts += 1000 * secs;
    ts += 60*1000 * mins;
    ts += 60*60*1000 * hours;

    return ts;
};

const WebVTTParser = {
    parse: function(vttByteArray, syncPTS, callBack, errorCallBack) {
        // Convert byteArray into string, replacing any somewhat exotic linefeeds with "\n", then split on that character.
      let re = /\r\n|\n\r|\n|\r/g;
      let vttLines = String.fromCharCode.apply(null, new Uint8Array(vttByteArray)).trim().replace(re, '\n').split('\n');
      let cueTime = '00:00.000';
      let mpegTs = 0;
      let offsetMillis = 0;
      let cues = [];
      let parsingError;
      let inHeader = true;
      // let VTTCue = VTTCue || window.TextTrackCue;

        // Create parser object using VTTCue with TextTrackCue fallback on certain browsers.
        let parser = new WebVTT.Parser(window, WebVTT.StringDecoder());

        parser.oncue = function(cue) {
            // Adjust cue timing; clamp cues to start no earlier than - and drop cues that don't end after - 0 on timeline.
            cue.startTime = Math.max(0, cue.startTime + offsetMillis/1000);
            cue.endTime += offsetMillis/1000;
            // Fix encoding of special characters. TODO: Test with all sorts of weird characters.
            cue.text = decodeURIComponent(escape(cue.text));
            if(cue.endTime > 0) {
              cues.push(cue);
            }
        };

        parser.onparsingerror = function(e) {
            parsingError = e;
        };

        parser.onflush = function() {
            if(parsingError && errorCallBack) {
                errorCallBack(parsingError);
                return;
            }
            callBack(cues);
        };

        // Go through contents line by line.
        vttLines.forEach(line => {
            if(inHeader) {
                // Look for X-TIMESTAMP-MAP in header.
                if(line.startsWith('X-TIMESTAMP-MAP=')) {
                    // Once found, no more are allowed anyway, so stop searching.
                    inHeader = false;
                    // Extract LOCAL and MPEGTS.
                    line.substr(16).split(',').forEach(timestamp => {
                        if(timestamp.startsWith('LOCAL:')) {
                          cueTime = timestamp.substr(6);
                        }
                        else if(timestamp.startsWith('MPEGTS:')) {
                          mpegTs = parseInt(timestamp.substr(7));
                        }
                    });
                    try {
                        // Calculate subtitle offset in milliseconds.
                        // If sync PTS is less than zero, we have a 33-bit wraparound, which is fixed by adding 2^33 = 8589934592.
                        syncPTS = syncPTS < 0 ? syncPTS + 8589934592 : syncPTS;
                        // Adjust MPEGTS by sync PTS.
                        mpegTs -= syncPTS;
                        // Calculate cue timing in milliseconds and adjust by MPEGTS converted to milliseconds from 90kHz.
                        offsetMillis = cueString2millis(cueTime) + Math.floor(mpegTs/90);
                        if(offsetMillis === -1) {
                          parsingError = new Error(`Malformed X-TIMESTAMP-MAP: ${line}`);
                        }
                    }
                    catch(e) {
                        parsingError = new Error(`Malformed X-TIMESTAMP-MAP: ${line}`);
                    }
                    // Return without parsing X-TIMESTAMP-MAP line.
                    return;
                }
                else if(line === '') {
                  inHeader = false;
                }
            }
            // Parse line by default.
            parser.parse(line+'\n');
        });

        parser.flush();
    }
};


module.exports = WebVTTParser;
