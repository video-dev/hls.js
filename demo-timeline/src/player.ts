import { TimelineChart } from './timeline-chart';
import { Events } from '../../src/events';
import { BufferCreatedData, LevelLoadedData, LevelUpdatedData, ManifestLoadedData } from '../../src/types/events';

const Hls = self.Hls;

export class Player {
  public hls: any = null;
  private config: any = null;
  private url: string | null = null;
  private width: number | null = null;
  private chart: TimelineChart;

  constructor (chart: TimelineChart) {
    this.chart = chart;
  }

  public setConfig (config) {
    this.config = config;
    this.loadSelectedStream();
  }

  public setUrl (url) {
    this.url = url;
    this.loadSelectedStream();
  }

  public setWidth (width) {
    this.width = width;
    updateStreamPermalink(this.config, width);
  }

  public loadSelectedStream () {
    if (!this.config || !this.url) {
      return;
    }

    if (!Hls.isSupported()) {
      console.error('This browser is not supported by Hls.js');
      return;
    }

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    updateStreamPermalink(this.config, this.width);

    const video = document.querySelector('#video') as HTMLMediaElement;

    console.log('Using Hls.js config:', this.config);
    // Copy the config so that it's not mutated by Hls.js
    const configCopy = Object.assign({}, this.config);
    self.hls = this.hls = new Hls(configCopy);

    this.addChartEventListeners();

    console.log(`Loading ${this.url}`);
    this.hls.loadSource(this.url);
    this.hls.attachMedia(video);
  }

  private addChartEventListeners () {
    const { hls } = this;

    hls.on(Events.MANIFEST_LOADING, () => {
      this.chart.reset();
    });

    hls.on(Events.MANIFEST_LOADED, (eventName, data: ManifestLoadedData) => {
      const { levels, audioTracks, subtitles = [] } = data;
      this.chart.updateLevels(levels);
      this.chart.updateAudioTracks(audioTracks);
      this.chart.updateSubtitles(subtitles);
    });

    // hls.on(Events.MANIFEST_PARSED, (eventName, data: ManifestParsedData) {
    //   console.log(eventName, data);
    // });

    // hls.on(Events.LEVELS_UPDATED, (eventName, data) {
    //   // A level was removed
    //   // { levels: [] }
    //   console.log(eventName, data);
    // });
    hls.on(Events.LEVEL_LOADED, (eventName, data: LevelLoadedData) => {
      console.log(eventName, data);
    });
    hls.on(Events.LEVEL_UPDATED, (eventName, data: LevelUpdatedData) => {
      console.log(eventName, data);
    });
    // // LEVEL_SWITCHED
    // hls.on(Events.LEVEL_PTS_UPDATED, (eventName, data: LevelPTSUpdatedData) {
    //   console.log(eventName, data);
    // });
    //
    // hls.on(Events.AUDIO_TRACKS_UPDATED, (eventName, data: AudioTracksUpdatedData) {
    //   console.log(eventName, data);
    // });
    // hls.on(Events.AUDIO_TRACK_LOADED, (eventName, data: AudioTrackLoadedData) {
    //   console.log(eventName, data);
    // });
    // // AUDIO_TRACK_SWITCHED
    //
    // hls.on(Events.SUBTITLE_TRACKS_UPDATED, (eventName, data: SubtitleTracksUpdatedData) {
    //   console.log(eventName, data);
    // });
    // hls.on(Events.SUBTITLE_TRACK_LOADED, (eventName, data: SubtitleTrackLoadedData) {
    //   console.log(eventName, data);
    // });
    // // SUBTITLE_TRACK_SWITCH
    //
    // hls.on(Events.INIT_PTS_FOUND, (eventName, data: InitPTSFoundData) {
    //   console.log(eventName, data);
    // });
    //
    // hls.on(Events.FRAG_PARSED, (eventName, data: FragParsedData) {
    //   console.log(eventName, data);
    // });
    // hls.on(Events.FRAG_BUFFERED, (eventName, data: FragBufferedData) {
    //   console.log(eventName, data);
    // });
    // hls.on(Events.FRAG_CHANGED, (eventName, data: FragChangedData) {
    //   console.log(eventName, data);
    // });
    //
    hls.on(Events.BUFFER_CREATED, (eventName, { tracks }: BufferCreatedData) => {
      this.chart.updateSourceBuffers(tracks, hls.media);
    });
    // hls.on(Events.BUFFER_APPENDED, (eventName, data: BufferAppendedData) {
    //   console.log(eventName, data);
    // });
    // hls.on(Events.BUFFER_FLUSHED, (eventName) {
    //   console.log(eventName);
    // });

    hls.on(Events.ERROR, (eventName, data) => {
      console.error(data);
    });
  }
}

function updateStreamPermalink (config, width) {
  const streamInput = document.querySelector('#streamURL') as HTMLInputElement;
  const streamPermalink = document.querySelector('#StreamPermalink') as HTMLElement;
  const serializedConfig = btoa(JSON.stringify(config));
  const baseURL = location.origin + location.pathname;
  const streamURL = streamInput.value;
  let permalinkURL = `${baseURL}?src=${encodeURIComponent(streamURL)}`;
  if (width) {
    permalinkURL += `&width=${encodeURIComponent(width)}`;
  }
  permalinkURL += `&config=${serializedConfig}`;
  streamPermalink.innerHTML = `<a href="${permalinkURL}">${permalinkURL}</a>`;
}
