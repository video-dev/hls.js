import { findBox } from './mp4-tools';
import { parseTimeStamp } from './vttparser';
import VTTCue from './vttcue';

export const IMSC1_CODEC = 'stpp.ttml.im1t';

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

  const body = xmlDoc.getElementsByTagName('body')[0];
  const nodes = body.getElementsByTagName('p');

  return [].map.call(nodes, (node) => {
    const text = node.innerHTML;
    if (!text || !node.hasAttribute('begin')) {
      return null;
    }
    // TODO: handle different time formats using `rateInfo` where needed
    const startTime = parseTimeStamp(node.getAttribute('begin')) - syncPTS;
    const endTime = parseTimeStamp(node.getAttribute('end')) - syncPTS;
    // TODO: elements may have a 'dur' attribute rather than 'end'

    // TODO: apply layout and style info

    const cueText = trim ? text.trim() : text;
    return new VTTCue(startTime, endTime, cueText);
  }).filter((cue) => cue !== null);
}
