const State = {
    INIT: 'INIT',
    NEXT_CUE: 'NEXT_CUE',
    PARSING_CUE: 'PARSING_CUE'
}

var string2Time = function(timeString) {
    console.log(timeString)
    let millis = parseInt(timeString.substr(-3));
    millis += 1000 * parseInt(timeString.substr(-6,2));

    console.log()
    return 0;
}

var getTiming = function(timingString) {
    return {
        startTime: string2Time(timingString.substr(0, timingString.indexOf(' '))),
        endTime: 0
    };
}

var WebVTTParser = {
    parse: function(vttByteArray) {
        let vttContents = String.fromCharCode.apply(null, new Uint8Array(vttByteArray)).trim(),
            re = /\r\n|\n\r|\n|\r/g,
            vttLines=vttContents.replace(re,"\n").split("\n");

        if(vttLines[0] !== 'WEBVTT') {
            console.log('WebVTT contents seem to be malformed.')
            return [];
        }
console.log('************ So far...')
        let state = State.INIT,
            cue = {},
            cues = [],
            parsedText = '';

        vttLines.forEach(line => {
            switch(state) {
                case State.INIT:
                    console.log(line)
                    if(line === '')
                        state = State.NEXT_CUE;
                    break;
                case State.NEXT_CUE:
                    if(line === '') break;
                    let timing = getTiming(line);
                    cue.startTime = timing.startTime;
                    cue.endTime = timing.endTime;
                    parsedText = '';
                    state = State.PARSING_CUE;
                    break;
                case State.PARSING_CUE:
                    if(line === '') {
                        cue.text = parsedText.trim();
                        cues.push(cue);
                        cue = {};
                        state = State.NEXT_CUE;
                        break;

                        parsedText += line + '\n';
                    }
                    break;
            };
        });
return
        console.log(vttLines,cues)
        return cues;
    }
}


module.exports = WebVTTParser;
