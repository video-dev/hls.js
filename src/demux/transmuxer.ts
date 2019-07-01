/**
 *
 * inline demuxer: probe fragments and instantiate
 * appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
 *
 */
import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';
import Decrypter from '../crypt/decrypter';
import AACDemuxer from '../demux/aacdemuxer';
import MP4Demuxer from '../demux/mp4demuxer';
import TSDemuxer from '../demux/tsdemuxer';
import MP3Demuxer from '../demux/mp3demuxer';
import MP4Remuxer from '../remux/mp4-remuxer';
import PassThroughRemuxer from '../remux/passthrough-remuxer';
import { Demuxer } from '../types/demuxer';
import { Remuxer } from '../types/remuxer';
import { TransmuxerResult, TransmuxIdentifier } from '../types/transmuxer';
import ChunkCache from './chunk-cache';
import { appendUint8Array } from '../utils/mp4-tools';

import { getSelfScope } from '../utils/get-self-scope';
import { logger } from '../utils/logger';

// see https://stackoverflow.com/a/11237259/589493
const global = getSelfScope(); // safeguard for code that might run both on worker and main thread

let now;
// performance.now() not available on WebWorker, at least on Safari Desktop
try {
  now = global.performance.now.bind(global.performance);
} catch (err) {
  logger.debug('Unable to use Performance API on this environment');
  now = global.Date.now;
}

const muxConfig = [
  { demux: TSDemuxer, remux: MP4Remuxer },
  { demux: MP4Demuxer, remux: PassThroughRemuxer },
  { demux: AACDemuxer, remux: MP4Remuxer },
  { demux: MP3Demuxer, remux: MP4Remuxer }
];

let minProbeByteLength = 1024;
muxConfig.forEach(({ demux }) => {
  minProbeByteLength = Math.max(minProbeByteLength, demux.minProbeByteLength);
});

export default class Transmuxer {
  private observer: any;
  private typeSupported: any;
  private config: any;
  private vendor: any;
  private demuxer?: Demuxer;
  private remuxer?: Remuxer;
  private decrypter: any;
  private probe!: Function;
  private decryptionPromise: Promise<TransmuxerResult> | null = null;
  private transmuxConfig!: TransmuxConfig;
  private currentTransmuxState!: TransmuxState;

  private cache: ChunkCache = new ChunkCache();

  constructor (observer, typeSupported, config, vendor) {
    this.observer = observer;
    this.typeSupported = typeSupported;
    this.config = config;
    this.vendor = vendor;
  }

  configure (transmuxConfig: TransmuxConfig, state: TransmuxState) {
    this.transmuxConfig = transmuxConfig;
    this.currentTransmuxState = state;
    if (this.decrypter) {
      this.decrypter.reset();
    }
  }

  push (data: ArrayBuffer,
    decryptdata: any | null,
    transmuxIdentifier: TransmuxIdentifier
  ): TransmuxerResult | Promise<TransmuxerResult> {
    let uintData = new Uint8Array(data);
    const encryptionType = getEncryptionType(uintData, decryptdata);

    // TODO: Handle progressive AES-128 decryption
    if (encryptionType === 'AES-128') {
      this.decryptionPromise = this.decryptAes128(uintData, decryptdata)
        .then(decryptedData => {
          const result = this.push(decryptedData, null, transmuxIdentifier);
          this.decryptionPromise = null;
          return result;
        });
      return this.decryptionPromise;
    }

    const { cache, currentTransmuxState: state, transmuxConfig: config } = this;
    const { contiguous, discontinuity, trackSwitch, accurateTimeOffset, timeOffset } = state;
    const { audioCodec, videoCodec, defaultInitPts, duration, initSegmentData } = config;

    // Reset muxers before probing to ensure that their state is clean, even if flushing occurs before a successful probe
    if (discontinuity || trackSwitch) {
      this.resetInitSegment(initSegmentData, audioCodec, videoCodec, duration);
    }

    if (discontinuity) {
      this.resetInitialTimestamp(defaultInitPts);
    }

    if (!contiguous) {
      this.resetNextTimestamp();
    }

    let { demuxer, remuxer } = this;
    if (this.needsProbing(uintData, discontinuity, trackSwitch)) {
      uintData = appendUint8Array(cache.flush(), uintData);
      ({ demuxer, remuxer } = this.configureTransmuxer(uintData, initSegmentData, audioCodec, videoCodec, duration));
    }

    if (!demuxer || !remuxer) {
      cache.push(uintData);
        return {
          remuxResult: {},
          transmuxIdentifier
        };
    }

    const result = this.transmux(uintData, decryptdata, encryptionType, timeOffset, accurateTimeOffset, transmuxIdentifier);

    state.contiguous = true;
    state.discontinuity = false;
    state.trackSwitch = false;

    return result;
  }

  flush (transmuxIdentifier: TransmuxIdentifier) : TransmuxerResult | Promise<TransmuxerResult>  {
    const { decrypter, demuxer, remuxer, cache, currentTransmuxState, decryptionPromise, observer } = this;
    if (decryptionPromise) {
      return decryptionPromise.then(() => {
        return this.flush(transmuxIdentifier);
      });
    }

    const bytesSeen = cache.dataLength;
    cache.reset();
    if (!demuxer || !remuxer) {
      // If probing failed, and each demuxer saw enough bytes to be able to probe, then Hls.js has been given content its not able to handle
      if (bytesSeen >= minProbeByteLength) {
        observer.trigger(Event.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
      }
      return {
        remuxResult: {},
        transmuxIdentifier
      }
    }

    const { accurateTimeOffset, timeOffset } = currentTransmuxState;
    if (decrypter) {
      const data = decrypter.flush();
      if (data) {
        demuxer.demux(data, timeOffset, false);
      }
    }

    const { audioTrack, avcTrack, id3Track, textTrack } = demuxer.flush(timeOffset);
    logger.log(`[transmuxer.ts]: Flushed fragment ${transmuxIdentifier.sn} of level ${transmuxIdentifier.level}`);
    return {
        remuxResult: remuxer.remux(audioTrack, avcTrack, id3Track, textTrack, timeOffset, accurateTimeOffset),
        transmuxIdentifier
    }
  }

  resetInitialTimestamp (defaultInitPts: number | undefined) {
    const { demuxer, remuxer } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetTimeStamp(defaultInitPts);
    remuxer.resetTimeStamp(defaultInitPts);
  }

  resetNextTimestamp () {
    const { demuxer, remuxer } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    remuxer.resetNextTimestamp();
  }

  resetInitSegment (initSegmentData: Uint8Array, audioCodec: string, videoCodec: string, duration: number) {
    const { demuxer, remuxer } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetInitSegment(audioCodec, videoCodec, duration);
    remuxer.resetInitSegment(initSegmentData, audioCodec, videoCodec);
  }

  destroy (): void {
    if (this.demuxer) {
      this.demuxer.destroy();
      this.demuxer = undefined;
    }
    if (this.remuxer) {
      this.remuxer.destroy();
      this.remuxer = undefined;
    }
  }

  private transmux (data: Uint8Array, decryptData: Uint8Array, encryptionType: string | null, timeOffset: number, accurateTimeOffset: boolean, transmuxIdentifier: TransmuxIdentifier): TransmuxerResult | Promise<TransmuxerResult> {
    let result: TransmuxerResult | Promise<TransmuxerResult>;
    if (encryptionType === 'SAMPLE-AES') {
      result = this.transmuxSampleAes(data, decryptData, timeOffset, accurateTimeOffset, transmuxIdentifier);
    } else {
      result = this.transmuxUnencrypted(data, timeOffset, accurateTimeOffset, transmuxIdentifier);
    }
    return result;
  }

  private transmuxUnencrypted (data: Uint8Array, timeOffset: number, accurateTimeOffset: boolean, transmuxIdentifier: TransmuxIdentifier) {
    const { audioTrack, avcTrack, id3Track, textTrack } = this.demuxer!.demux(data, timeOffset,false);
    return {
      remuxResult: this.remuxer!.remux(audioTrack, avcTrack, id3Track, textTrack, timeOffset, accurateTimeOffset),
      transmuxIdentifier
    }
  }

  // TODO: Handle flush with Sample-AES
  private transmuxSampleAes (data: Uint8Array, decryptData: any, timeOffset: number, accurateTimeOffset: boolean, transmuxIdentifier: TransmuxIdentifier) : Promise<TransmuxerResult> {
    return this.demuxer!.demuxSampleAes(data, decryptData, timeOffset)
      .then(demuxResult => ({
              remuxResult: this.remuxer!.remux(demuxResult.audioTrack, demuxResult.avcTrack, demuxResult.id3Track, demuxResult.textTrack, timeOffset,  accurateTimeOffset),
              transmuxIdentifier
          })
      );
  }

  private decryptAes128 (data: Uint8Array, decryptData: any): Promise<ArrayBuffer> {
    let decrypter = this.decrypter;
    if (!decrypter) {
      decrypter = this.decrypter = new Decrypter(this.observer, this.config);
    }
    return new Promise(resolve => {
      const startTime = now();
      decrypter.decrypt(data, decryptData.key.buffer, decryptData.iv.buffer, (decryptedData) => {
        const endTime = now();
        this.observer.trigger(Event.FRAG_DECRYPTED, { stats: { tstart: startTime, tdecrypt: endTime } });
        resolve(decryptedData);
      });
    });
  }

  private configureTransmuxer (data: Uint8Array, initSegmentData: Uint8Array, audioCodec: string, videoCodec: string, duration: number) {
    const { config, observer, typeSupported, vendor } = this;
    let demuxer, remuxer;
    // probe for content type
    for (let i = 0, len = muxConfig.length; i < len; i++) {
      const mux = muxConfig[i];
      const probe = mux.demux.probe;
      if (probe(data)) {
        remuxer = this.remuxer = new mux.remux(observer, config, typeSupported, vendor);
        demuxer = this.demuxer = new mux.demux(observer, config, typeSupported);

        // Ensure that muxers are always initialized with an initSegment
        demuxer.resetInitSegment(audioCodec, videoCodec, duration);
        remuxer.resetInitSegment(initSegmentData, audioCodec, videoCodec);
        logger.log(`[transmuxer.ts]: Probe succeeded with a data length of ${data.length}.`);
        this.probe = probe;
        break;
      }
    }

    return { demuxer, remuxer };
  }

  private needsProbing (data: Uint8Array, discontinuity: boolean, trackSwitch: boolean) : boolean {
    // in case of continuity change, or track switch
    // we might switch from content type (AAC container to TS container, or TS to fmp4 for example)
    // so let's check that current demuxer is still valid
    return !this.demuxer || ((discontinuity || trackSwitch) && !this.probe(data));
  }
}

function getEncryptionType (data: Uint8Array, decryptData: any): string | null {
  let encryptionType = null;
  if ((data.byteLength > 0) && (decryptData != null) && (decryptData.key != null)) {
    encryptionType = decryptData.method;
  }
  return encryptionType;
}

export class TransmuxConfig {
  public audioCodec: string;
  public videoCodec: string;
  public initSegmentData: Uint8Array;
  public duration: number;
  public defaultInitPts?: number;

  constructor (audioCodec: string, videoCodec: string, initSegmentData: Uint8Array, duration: number, defaultInitPts?: number) {
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.initSegmentData = initSegmentData;
    this.duration = duration;
    this.defaultInitPts = defaultInitPts;
  }
}

export class TransmuxState {
  public discontinuity: boolean;
  public contiguous: boolean;
  public accurateTimeOffset: boolean;
  public trackSwitch: boolean;
  public timeOffset: number;

  constructor(discontinuity: boolean, contiguous: boolean, accurateTimeOffset: boolean, trackSwitch: boolean, timeOffset: number){
    this.discontinuity = discontinuity;
    this.contiguous = contiguous;
    this.accurateTimeOffset = accurateTimeOffset;
    this.trackSwitch = trackSwitch;
    this.timeOffset = timeOffset;
  }
}