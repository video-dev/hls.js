import { InitSegmentData, RemuxedTrack, Remuxer, RemuxerResult } from '../types/remuxer';
import { getDuration, getStartDTS, offsetStartDTS, parseInitSegment } from '../utils/mp4-tools';
import { TrackSet } from '../types/track';

class PassThroughRemuxer implements Remuxer {
  private emitInitSegment: boolean = false;
  private audioCodec?: string;
  private videoCodec?: string;
  private initData?: any;
  private initPTS?: number;
  private initTracks?: TrackSet;

  destroy () {
  }

  resetTimeStamp (defaultInitPTS) {
    this.initPTS = defaultInitPTS;
  }

  resetInitSegment (initSegment, audioCodec, videoCodec) {
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.generateInitSegment(initSegment);
    this.emitInitSegment = true;
  }

  generateInitSegment (initSegment): void {
    let { audioCodec, videoCodec } = this;
    if (!initSegment || !initSegment.byteLength) {
      this.initTracks = undefined;
      this.initData = undefined;
      return;
    }
    const initData = this.initData = parseInitSegment(initSegment) as any;

    // default audio codec if nothing specified
    // TODO : extract that from initsegment
    if (!audioCodec) {
      audioCodec = 'mp4a.40.5';
    }

    if (!videoCodec) {
      videoCodec = 'avc1.42e01e';
    }

    const tracks = {} as TrackSet;
    if (initData.audio && initData.video) {
      tracks.audiovideo = {
        container: 'video/mp4',
        codec: audioCodec + ',' + videoCodec,
        initSegment
      };
    } else {
      if (initData.audio) {
        tracks.audio = { container: 'audio/mp4', codec: audioCodec, initSegment };
      }

      if (initData.video) {
        tracks.video = { container: 'video/mp4', codec: videoCodec, initSegment };
      }
    }
    this.initTracks = tracks;
  }

  remux (audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous, accurateTimeOffset): RemuxerResult {
    // The binary segment data is added to the videoTrack in the mp4demuxer. We don't check to see if the data is only
    // audio or video (or both); adding it to video was an arbitrary choice.
    const data = videoTrack.samples;
    if (!data || !data.length) {
      return {
          audio: undefined,
          video: undefined,
          text: textTrack,
          id3: id3Track,
          initSegment: undefined
      };
    }

    const initSegment: InitSegmentData = {};
    let initData = this.initData;
    if (!initData) {
        this.generateInitSegment(data);
        initData = this.initData;
    }
    if (this.emitInitSegment) {
        initSegment.tracks = this.initTracks;
        this.emitInitSegment = false;
    }

    let startDTS = timeOffset;
    let initPTS = this.initPTS;
    if (!Number.isFinite(initPTS as number)) {
        let startDTS = getStartDTS(initData, data);
        this.initPTS = initPTS = startDTS - timeOffset;
        initSegment.initPTS = initPTS;
    }
    offsetStartDTS(initData, data, initPTS);

    const duration = getDuration(data, initData);
    const endDTS = duration + startDTS;

    const track: RemuxedTrack = {
        data1: data,
        startPTS: startDTS,
        startDTS,
        endPTS: endDTS,
        endDTS,
        type: '',
        hasAudio: !!audioTrack.data,
        hasVideo: !!videoTrack.data,
        nb: 1,
        dropped: 0
    };

    if (initData.audio) {
        track.type += 'audio';
    }

    if (initData.video) {
        track.type += 'video';
    }

    return {
      audio: track.type === 'audio' ? track : undefined,
      video: track.type !== 'audio' ? track : undefined,
      text: textTrack,
      id3: id3Track,
      initSegment
    };
  }
}

export default PassThroughRemuxer;
