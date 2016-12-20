import VTTParser from './vttparser';

const cueString2millis = function(timeString) {
    let ts = parseInt(timeString.substr(-3)),
        secs = parseInt(timeString.substr(-6,2)),
        mins = parseInt(timeString.substr(-9,2)),
        hours = timeString.length > 9 ? parseInt(timeString.substr(0, timeString.indexOf(':'))) : 0;

    if (isNaN(ts) || isNaN(secs) || isNaN(mins) || isNaN(hours)) {
        return -1;
    }

    ts += 1000 * secs;
    ts += 60*1000 * mins;
    ts += 60*60*1000 * hours;

    return ts;
};

const calculateOffset = function(vttCCs, cc, presentationTime) {
    let currCC = vttCCs[cc],
        prevCC = vttCCs[currCC.prevCC];

    // This is the first discontinuity or cues have been processed since the last discontinuity
    // Offset = current discontinuity time
    if (!prevCC || (!prevCC.new && currCC.new)) {
        vttCCs.ccOffset = vttCCs.presentationOffset = currCC.start;
        currCC.new = false;
        return;
    }

    // There have been discontinuities since cues were last parsed.
    // Offset = time elapsed
    while (prevCC && prevCC.new) {
        vttCCs.ccOffset += currCC.start - prevCC.start;
        currCC.new = false;
        currCC = prevCC;
        prevCC = vttCCs[currCC.prevCC];
    }

    vttCCs.presentationOffset = presentationTime;
};

const WebVTTParser = {
    parse: function(vttByteArray, syncPTS, vttCCs, cc, callBack, errorCallBack) {
        // Convert byteArray into string, replacing any somewhat exotic linefeeds with "\n", then split on that character.
        let re = /\r\n|\n\r|\n|\r/g,
            vttLines = String.fromCharCode.apply(null, new Uint8Array(vttByteArray)).trim().replace(re, '\n').split('\n'),
            cueTime = '00:00.000',
            mpegTs = 0,
            localTime = 0,
            presentationTime = 0,
            cues = [],
            parsingError,
            inHeader = true;
        // let VTTCue = VTTCue || window.TextTrackCue;

        // Create parser object using VTTCue with TextTrackCue fallback on certain browsers.
        let parser = new VTTParser();

        parser.oncue = function(cue) {
            // Adjust cue timing; clamp cues to start no earlier than - and drop cues that don't end after - 0 on timeline.
            let currCC = vttCCs[cc],
                cueOffset = vttCCs.ccOffset;

            // Update offsets for new discontinuities
            if (currCC && currCC.new) {
                if (localTime) {
                    // When local time is provided, offset = discontinuity start time - local time
                    cueOffset = vttCCs.ccOffset = currCC.start;
                } else {
                    calculateOffset(vttCCs, cc, presentationTime);
                }
            }

            if (presentationTime && !localTime) {
                // If we have MPEGTS but no LOCAL time, offset = presentation time + discontinuity offset
                cueOffset = presentationTime + vttCCs.ccOffset - vttCCs.presentationOffset;
            }

            cue.startTime += cueOffset - localTime;
            cue.endTime += cueOffset - localTime;

            // Fix encoding of special characters. TODO: Test with all sorts of weird characters.
            cue.text = decodeURIComponent(escape(cue.text));
            if (cue.endTime > 0) {
              cues.push(cue);
            }
        };

        parser.onparsingerror = function(e) {
            parsingError = e;
        };

        parser.onflush = function() {
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
                if (line.startsWith('X-TIMESTAMP-MAP=')) {
                    // Once found, no more are allowed anyway, so stop searching.
                    inHeader = false;
                    // Extract LOCAL and MPEGTS.
                    line.substr(16).split(',').forEach(timestamp => {
                        if (timestamp.startsWith('LOCAL:')) {
                          cueTime = timestamp.substr(6);
                        } else if (timestamp.startsWith('MPEGTS:')) {
                          mpegTs = parseInt(timestamp.substr(7));
                        }
                    });
                    try {
                        // Calculate subtitle offset in milliseconds.
                        // If sync PTS is less than zero, we have a 33-bit wraparound, which is fixed by adding 2^33 = 8589934592.
                        syncPTS = syncPTS < 0 ? syncPTS + 8589934592 : syncPTS;
                        // Adjust MPEGTS by sync PTS.
                        mpegTs -= syncPTS;
                        // Convert cue time to seconds
                        localTime = cueString2millis(cueTime) / 1000;
                        // Convert MPEGTS to seconds from 90kHz.
                        presentationTime = mpegTs / 90000;

                        if (localTime === -1) {
                            parsingError = new Error(`Malformed X-TIMESTAMP-MAP: ${line}`);
                        }
                    }
                    catch(e) {
                        parsingError = new Error(`Malformed X-TIMESTAMP-MAP: ${line}`);
                    }
                    // Return without parsing X-TIMESTAMP-MAP line.
                    return;
                } else if (line === '') {
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
