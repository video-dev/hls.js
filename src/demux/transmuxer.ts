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

class Transmuxer {
  private observer: any;
  private typeSupported: any;
  private config: any;
  private vendor: any;
  private demuxer?: Demuxer;
  private remuxer?: Remuxer;
  private decrypter: any;
  private probe!: Function;
  private decryptionPromise: Promise<TransmuxerResult> | null = null;

  private timeOffset: number = 0;
  private accurateTimeOffset: boolean = false;

  private cache: ChunkCache = new ChunkCache();

  constructor (observer, typeSupported, config, vendor) {
    this.observer = observer;
    this.typeSupported = typeSupported;
    this.config = config;
    this.vendor = vendor;
  }

  push (data: ArrayBuffer,
    decryptdata: any | null,
    initSegment: any,
    audioCodec: string,
    videoCodec: string,
    timeOffset: number,
    discontinuity: boolean,
    trackSwitch: boolean,
    contiguous: boolean,
    duration: number,
    accurateTimeOffset: boolean,
    defaultInitPTS: number | null,
    transmuxIdentifier: TransmuxIdentifier
  ): TransmuxerResult | Promise<TransmuxerResult> {
    let uintData = new Uint8Array(data);
    const uintInitSegment = new Uint8Array(initSegment);
    const cache = this.cache;
    const encryptionType = getEncryptionType(uintData, decryptdata);

    // TODO: Handle progressive AES-128 decryption
    if (encryptionType === 'AES-128') {
      this.decryptionPromise = this.decryptAes128(data, decryptdata)
        .then(decryptedData => {
          const result = this.push(decryptedData,
            null,
            initSegment,
            audioCodec,
            videoCodec,
            timeOffset,
            discontinuity,
            trackSwitch,
            contiguous,
            duration,
            accurateTimeOffset,
            defaultInitPTS,
            transmuxIdentifier);
          this.decryptionPromise = null;
          return result;
        });
      return this.decryptionPromise;
    }

    this.timeOffset = timeOffset;
    this.accurateTimeOffset = accurateTimeOffset;

    // Reset muxers before probing to ensure that their state is clean, even if flushing occurs before a successful probe
    if (discontinuity || trackSwitch) {
      this.resetInitSegment(uintInitSegment, audioCodec, videoCodec, duration);
    }

    if (discontinuity) {
      this.resetInitialTimestamp(defaultInitPTS);
    }

    if (!contiguous) {
      this.resetNextTimestamp();
    }

    const needsProbing = this.needsProbing(uintData, discontinuity, trackSwitch);
    if (needsProbing && (uintData.length + cache.dataLength < minProbeByteLength)) {
      logger.log(`[transmuxer.ts]: Received ${uintData.length} bytes, but at least ${minProbeByteLength} are required to probe for demuxer types\n` +
        'This data will be cached until the minimum amount is met.');
      cache.push(uintData);
      return {
        remuxResult: {},
        transmuxIdentifier
      };
    } else if (cache.dataLength) {
      logger.log(`[transmuxer.ts]: Cache now has enough data to probe.`);
      uintData = appendUint8Array(cache.flush(), uintData);
    }

    let { demuxer, remuxer } = this;
    if (needsProbing) {
      ({ demuxer, remuxer } = this.configureTransmuxer(uintData, uintInitSegment, audioCodec, videoCodec, duration));
    }

    if (!demuxer || !remuxer) {
      this.observer.trigger(Event.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
      return {
        remuxResult: {},
        transmuxIdentifier
      };
    }

   let result;
   if (encryptionType === 'SAMPLE-AES') {
      result = this.transmuxSampleAes(uintData, decryptdata, timeOffset, accurateTimeOffset, transmuxIdentifier);
    } else {
      result = this.transmux(uintData, timeOffset, accurateTimeOffset, transmuxIdentifier);
    }
    return result;
  }

  // TODO: Probe for demuxer on flush
  flush (transmuxIdentifier: TransmuxIdentifier) : TransmuxerResult | Promise<TransmuxerResult>  {
    if (this.decryptionPromise) {
      return this.decryptionPromise.then(() => {
        return this.flush(transmuxIdentifier);
      });
    }

    this.cache.reset();
    if (!this.demuxer) {
      return {
        remuxResult: {},
        transmuxIdentifier
      }
    }
    const { audioTrack, avcTrack, id3Track, textTrack } = this.demuxer!.flush(this.timeOffset);
    // TODO: ensure that remuxers use last DTS as the timeOffset when passed null
    return {
        remuxResult: this.remuxer!.remux(audioTrack, avcTrack, id3Track, textTrack, this.timeOffset, this.accurateTimeOffset),
        transmuxIdentifier
    }
  }

  resetInitialTimestamp (defaultInitPTS) {
    const { demuxer, remuxer } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetTimeStamp(defaultInitPTS);
    remuxer.resetTimeStamp(defaultInitPTS);
  }

  resetNextTimestamp () {
    const { demuxer, remuxer } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    remuxer.resetNextTimestamp();
  }

  resetInitSegment (initSegment: Uint8Array, audioCodec: string, videoCodec: string, duration: number) {
    const { demuxer, remuxer } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetInitSegment(audioCodec, videoCodec, duration);
    remuxer.resetInitSegment(initSegment, audioCodec, videoCodec);
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

  private transmux (data: Uint8Array, timeOffset: number, accurateTimeOffset: boolean, transmuxIdentifier: TransmuxIdentifier): TransmuxerResult {
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

  private decryptAes128 (data: ArrayBuffer, decryptData: any): Promise<ArrayBuffer> {
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

export default Transmuxer;
