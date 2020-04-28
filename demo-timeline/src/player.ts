import { TimelineChart } from './timeline-chart';
import { Events } from '../../src/events';
import {
  AudioTrackLoadedData,
  AudioTracksUpdatedData,
  BufferCreatedData,
  FragChangedData,
  FragParsedData,
  LevelPTSUpdatedData,
  LevelsUpdatedData,
  LevelUpdatedData,
  ManifestLoadedData,
  SubtitleTrackLoadedData,
  SubtitleTracksUpdatedData
} from '../../src/types/events';

const Hls = self.Hls;

export class Player {
  public hls: any = null;
  private config: any = null;
  private url: string | null = null;
  private width: number | null = null;
  private chart: TimelineChart;
  private video: HTMLMediaElement;

  constructor (chart: TimelineChart, video: HTMLMediaElement) {
    this.chart = chart;
    this.video = video;
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

    console.log('Using Hls.js config:', this.config);
    // Copy the config so that it's not mutated by Hls.js
    const configCopy = Object.assign({}, this.config);
    self.hls = this.hls = new Hls(configCopy);

    this.addChartEventListeners();

    console.log(`Loading ${this.url}`);
    this.hls.loadSource(this.url);
    this.hls.attachMedia(this.video);
  }

  private addChartEventListeners () {
    const { hls } = this;

    hls.on(Events.MANIFEST_LOADING, () => {
      this.chart.reset();
    });

    hls.on(Events.MANIFEST_LOADED, (eventName, data: ManifestLoadedData) => {
      const { levels, audioTracks, subtitles = [] } = data;
      this.chart.removeType('level');
      this.chart.removeType('audioTrack');
      this.chart.removeType('subtitleTrack');
      this.chart.updateLevels(levels);
      this.chart.updateAudioTracks(audioTracks);
      this.chart.updateSubtitleTracks(subtitles);
    });

    hls.on(Events.LEVELS_UPDATED, (eventName, { levels }: LevelsUpdatedData) => {
      this.chart.removeType('level');
      this.chart.updateLevels(levels);
    });
    // Events.LEVEL_LOADED
    hls.on(Events.LEVEL_UPDATED, (eventName, { details, level }: LevelUpdatedData) => {
      this.chart.updateLevelOrTrack(details);
    });

    hls.on(Events.AUDIO_TRACKS_UPDATED, (eventName, { audioTracks }: AudioTracksUpdatedData) => {
      this.chart.removeType('audioTrack');
      this.chart.updateAudioTracks(audioTracks);
    });
    hls.on(Events.SUBTITLE_TRACKS_UPDATED, (eventName, { subtitleTracks }: SubtitleTracksUpdatedData) => {
      this.chart.removeType('subtitleTrack');
      this.chart.updateSubtitleTracks(subtitleTracks);
    });
    hls.on(Events.AUDIO_TRACK_LOADED, (eventName, { details }: AudioTrackLoadedData) => {
      this.chart.updateLevelOrTrack(details);
    });

    hls.on(Events.SUBTITLE_TRACK_LOADED, (eventName, { details }: SubtitleTrackLoadedData) => {
      this.chart.updateLevelOrTrack(details);
    });

    // LEVEL_SWITCHED
    // AUDIO_TRACK_SWITCHED
    // SUBTITLE_TRACK_SWITCH

    hls.on(Events.LEVEL_PTS_UPDATED, (eventName, data: LevelPTSUpdatedData) => {
      this.chart.updateLevelOrTrack(data.details);
    });
    // hls.on(Events.INIT_PTS_FOUND, (eventName, data: InitPTSFoundData) => {
    //   console.log(eventName, data);
    // });

    // hls.on(Events.FRAG_LOADING, (eventName, data: FragLoadingData) => {
    //   this.chart.updateFragment(data);
    //   // The loader stats have not yet been assigned to the fragment.
    //   // Async update the fragment to get the new stats
    //   self.setTimeout(() => {
    //     this.chart.updateFragment(data);
    //   });
    // });
    hls.on(Events.FRAG_PARSED, (eventName, data: FragParsedData) => {
      this.chart.updateFragment(data);
    });
    hls.on(Events.FRAG_CHANGED, (eventName, data: FragChangedData) => {
      this.chart.updateFragment(data);
    });

    hls.on(Events.BUFFER_CREATED, (eventName, { tracks }: BufferCreatedData) => {
      this.chart.updateSourceBuffers(tracks, hls.media);
    });
    hls.on(Events.BUFFER_APPENDING, () => {
      this.chart.update();
    });
    hls.on(Events.BUFFER_APPENDED, () => {
      this.chart.update();
    });
    hls.on(Events.BUFFER_FLUSHED, () => {
      this.chart.update();
    });
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
