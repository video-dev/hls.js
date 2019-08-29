import { findBox } from './mp4-tools';
import { parseTimeStamp } from './vttparser';
import VTTCue from './vttcue';

export const IMSC1_CODEC = 'stpp.ttml.im1t';

// Time format: h:m:s:frames(.subframes)
const HMSF_REGEX = /^(\d{2,}):(\d{2}):(\d{2}):(\d{2})\.?(\d+)?$/;

// Time format: hours, minutes, seconds, milliseconds, frames, ticks
const TIME_UNIT_REGEX = /^(\d*(?:\.\d*)?)(h|m|s|ms|f|t)$/;

export function parseIMSC1(payload: ArrayBuffer, syncPTS: number, callBack: (cues: Array<VTTCue>) => any, errorCallBack: (error: Error) => any) {
  const results = findBox(new Uint8Array(payload), ['mdat']);
  if (results === null || results.length === 0) {
    errorCallBack(new Error('Could not parse IMSC1 mdat'));
    return;
  }
  const mdat = results[0];
  const ttml = String.fromCharCode.apply(null, new Uint8Array(payload, mdat.start, mdat.end - mdat.start));
  try {
    callBack(parseTTML(ttml, syncPTS));
  } catch (error) {
    errorCallBack(error);
  }
}

function parseTTML(ttml: string, syncPTS: number): Array<VTTCue> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(ttml, 'text/xml');
  const tt = xmlDoc.getElementsByTagName('tt')[0];
  if (!tt) {
    throw new Error('Invalid ttml');
  }
  const defaultRateInfo = {
    frameRate: 30,
    subFrameRate: 1,
    frameRateMultiplier: 0,
    tickRate: 0
  };
  const rateInfo: Object = Object.keys(defaultRateInfo).reduce((result, key) => {
    result[key] = tt.getAttribute(`ttp:${key}`) || defaultRateInfo[key];
    return result;
  }, {});

  const trim = tt.getAttribute('xml:space') !== 'preserve';

  // TODO: parse layout and style info

  const body = tt.getElementsByTagName('body')[0];
  const nodes = body.getElementsByTagName('p');

  return [].map.call(nodes, (node) => {
    const text = node.innerHTML;
    if (!text || !node.hasAttribute('begin')) {
      return null;
    }
    const startTime = parseTtmlTime(node.getAttribute('begin'), rateInfo);
    const duration = parseTtmlTime(node.getAttribute('dur'), rateInfo);
    let endTime = parseTtmlTime(node.getAttribute('end'), rateInfo);
    if (startTime === null) {
      throw timestampParsingError(node);
    }
    if (endTime === null) {
      if (duration === null) {
        throw timestampParsingError(node);
      }
      endTime = startTime + duration;
    }
    // TODO: apply layout and style info

    const cueText = trim ? text.trim() : text;
    return new VTTCue(startTime - syncPTS, endTime - syncPTS, cueText);
  }).filter((cue) => cue !== null);
}

function timestampParsingError(node) {
  return new Error(`Could not parse ttml timestamp ${node}`);
}

function parseTtmlTime(timeAttributeValue, rateInfo): number | null {
  if (!timeAttributeValue) {
    return null;
  }
  let seconds: number | null = parseTimeStamp(timeAttributeValue);
  if (seconds === null) {
    if (HMSF_REGEX.test(timeAttributeValue)) {
      seconds = parseHoursMinutesSecondsFrames(timeAttributeValue, rateInfo);
    } else if (TIME_UNIT_REGEX.test(timeAttributeValue)) {
      seconds = parseTimeUnits(timeAttributeValue, rateInfo);
    }
  }
  return seconds;
}

function parseHoursMinutesSecondsFrames(timeAttributeValue, rateInfo): number {
  const m = HMSF_REGEX.exec(timeAttributeValue) as Array<any>;
  const frames = (m[4] | 0) + (m[5] | 0) / rateInfo.subFrameRate;
  return (m[1] | 0) * 3600 + (m[2] | 0) * 60 + (m[3] | 0) + frames / rateInfo.frameRate;
}

function parseTimeUnits(timeAttributeValue, rateInfo): number {
  const m = TIME_UNIT_REGEX.exec(timeAttributeValue) as Array<any>;
  const value = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case 'h':
      return value * 3600;
    case 'm':
      return value * 60;
    case 'ms':
      return value * 1000;
    case 'f':
      return value / rateInfo.frameRate;
    case 't':
      return value / rateInfo.tickRate;
  }
  return value;
}
