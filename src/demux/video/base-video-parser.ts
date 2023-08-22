import type { ParsedVideoSample } from '../tsdemuxer';
import {
  DemuxedVideoTrack,
  VideoSample,
  VideoSampleUnit,
} from '../../types/demuxer';
import { logger } from '../../utils/logger';

class BaseVideoParser {
  protected VideoSample: ParsedVideoSample | null = null;

  protected createVideoSample(
    key: boolean,
    pts: number | undefined,
    dts: number | undefined,
    debug: string,
  ): ParsedVideoSample {
    return {
      key,
      frame: false,
      pts,
      dts,
      units: [],
      debug,
      length: 0,
    };
  }

  protected getLastNalUnit(
    samples: VideoSample[],
  ): VideoSampleUnit | undefined {
    let VideoSample = this.VideoSample;
    let lastUnit: VideoSampleUnit | undefined;
    // try to fallback to previous sample if current one is empty
    if (!VideoSample || VideoSample.units.length === 0) {
      VideoSample = samples[samples.length - 1];
    }
    if (VideoSample?.units) {
      const units = VideoSample.units;
      lastUnit = units[units.length - 1];
    }
    return lastUnit;
  }

  protected pushAccessUnit(
    VideoSample: ParsedVideoSample,
    videoTrack: DemuxedVideoTrack,
  ) {
    if (VideoSample.units.length && VideoSample.frame) {
      // if sample does not have PTS/DTS, patch with last sample PTS/DTS
      if (VideoSample.pts === undefined) {
        const samples = videoTrack.samples;
        const nbSamples = samples.length;
        if (nbSamples) {
          const lastSample = samples[nbSamples - 1];
          VideoSample.pts = lastSample.pts;
          VideoSample.dts = lastSample.dts;
        } else {
          // dropping samples, no timestamp found
          videoTrack.dropped++;
          return;
        }
      }
      videoTrack.samples.push(VideoSample as VideoSample);
    }
    if (VideoSample.debug.length) {
      logger.log(
        VideoSample.pts + '/' + VideoSample.dts + ':' + VideoSample.debug,
      );
    }
  }
}

export default BaseVideoParser;
