import Chart from 'chart.js';
import 'chartjs-plugin-zoom';
import { applyChartInstanceOverrides, hhmmss } from './chartjs-horizontal-bar';
import Fragment from '../../src/loader/fragment';
import type { Level } from '../../src/types/level';
import type { TrackSet } from '../../src/types/track';
import type { MediaPlaylist } from '../../src/types/media-playlist';
import type LevelDetails from '../../src/loader/level-details';
import {
  FragChangedData,
  FragLoadedData,
  FragParsedData,
} from '../../src/types/events';

declare global {
  interface Window {
    Hls: any;
    hls: any;
    chart: any;
  }
}

const X_AXIS_SECONDS = 'x-axis-seconds';

interface ChartScale {
  height: number;
  min: number;
  max: number;
  options: any;
  determineDataLimits: () => void;
  buildTicks: () => void;
  getLabelForIndex: (index: number, datasetIndex: number) => string;
  getPixelForTick: (index: number) => number;
  getPixelForValue: (
    value: number,
    index?: number,
    datasetIndex?: number
  ) => number;
  getValueForPixel: (pixel: number) => number;
}

export class TimelineChart {
  private readonly chart: Chart;
  private rafDebounceRequestId: number = -1;
  private imageDataBuffer: ImageData | null = null;
  private media: HTMLMediaElement | null = null;
  private tracksChangeHandler?: (e) => void;
  private cuesChangeHandler?: (e) => void;
  private hidden: boolean = true;

  constructor(canvas: HTMLCanvasElement, chartJsOptions?: any) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(
        `Could not get CanvasRenderingContext2D from canvas: ${canvas}`
      );
    }
    const chart = (this.chart = self.chart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: [],
        datasets: [],
      },
      options: Object.assign(getChartOptions(), chartJsOptions),
      plugins: [
        {
          afterRender: () => {
            this.imageDataBuffer = null;
            this.drawCurrentTime();
          },
        },
      ],
    }));

    applyChartInstanceOverrides(chart);

    // Log object on click and seek to position
    canvas.onclick = (event: MouseEvent) => {
      const chart = this.chart;
      const element = chart.getElementAtEvent(event);
      if (element.length && chart.data.datasets) {
        const dataset = chart.data.datasets[(element[0] as any)._datasetIndex];
        const obj = dataset.data![(element[0] as any)._index];
        // eslint-disable-next-line no-console
        console.log(obj);
        if (self.hls && self.hls.media) {
          const scale = this.chartScales[X_AXIS_SECONDS];
          const pos = Chart.helpers.getRelativePosition(event, chart);
          self.hls.media.currentTime = scale.getValueForPixel(pos.x);
        }
      }
    };

    canvas.ondblclick = (event: MouseEvent) => {
      const chart = this.chart;
      const chartArea: { left; top; right; bottom } = chart.chartArea;
      const element = chart.getElementAtEvent(event);
      const pos = Chart.helpers.getRelativePosition(event, chart);
      const scale = this.chartScales[X_AXIS_SECONDS];
      const range = scale.max - scale.min;
      const newDiff = range * (event.getModifierState('Shift') ? -1.0 : 0.5);
      const minPercent = (scale.getValueForPixel(pos.x) - scale.min) / range;
      const maxPercent = 1 - minPercent;
      const minDelta = newDiff * minPercent;
      const maxDelta = newDiff * maxPercent;
      // zoom in when double clicking near elements in chart area
      if (element.length || pos.x > chartArea.left) {
        scale.options.ticks.min = Math.max(this.minZoom, scale.min + minDelta);
        scale.options.ticks.max = Math.min(this.maxZoom, scale.max - maxDelta);
      } else {
        // chart.resetZoom();
        scale.options.ticks.min = this.minZoom;
        scale.options.ticks.max = this.maxZoom;
      }
      this.update();
    };

    // TODO: Prevent zoom over y axis labels
  }

  get chartScales(): { 'x-axis-seconds': ChartScale } {
    return (this.chart as any).scales;
  }

  reset() {
    const scale = this.chartScales[X_AXIS_SECONDS];
    scale.options.ticks.min = 0;
    scale.options.ticks.max = 60;
    const config = this.chart.config;
    if (config?.options) {
      (config.options.plugins as any).zoom.zoom.rangeMax.x = 60;
    }
    const { labels, datasets } = this.chart.data;
    if (labels && datasets) {
      labels.length = 0;
      datasets.length = 0;
      this.resize(datasets);
    }
  }

  update() {
    if (this.hidden || !this.chart.ctx?.canvas.width) {
      return;
    }
    this.chart.update({
      duration: 0,
      lazy: true,
    });
  }

  resize(datasets?) {
    if (this.hidden) {
      return;
    }
    if (datasets?.length) {
      const scale = this.chartScales[X_AXIS_SECONDS];
      const { top } = this.chart.chartArea;
      const height =
        top +
        datasets.reduce((val, dataset) => val + dataset.barThickness, 0) +
        scale.height +
        5;
      const container = this.chart.canvas?.parentElement;
      if (container) {
        container.style.height = `${height}px`;
      }
    }
    self.cancelAnimationFrame(this.rafDebounceRequestId);
    this.rafDebounceRequestId = self.requestAnimationFrame(() => {
      this.chart.resize();
    });
  }

  show() {
    this.hidden = false;
  }

  hide() {
    this.hidden = true;
  }

  updateLevels(levels: Level[], levelSwitched) {
    const { labels, datasets } = this.chart.data;
    if (!labels || !datasets) {
      return;
    }
    const { loadLevel, nextLoadLevel, nextAutoLevel } = self.hls;
    // eslint-disable-next-line no-undefined
    const currentLevel =
      levelSwitched !== undefined ? levelSwitched : self.hls.currentLevel;
    levels.forEach((level, i) => {
      const index = level.id || i;
      labels.push(getLevelName(level, index));
      let borderColor: string | null = null;
      if (currentLevel === i) {
        borderColor = 'rgba(32, 32, 240, 1.0)';
      } else if (loadLevel === i) {
        borderColor = 'rgba(255, 128, 0, 1.0)';
      } else if (nextLoadLevel === i) {
        borderColor = 'rgba(200, 200, 64, 1.0)';
      } else if (nextAutoLevel === i) {
        borderColor = 'rgba(160, 0, 160, 1.0)';
      }
      datasets.push(
        datasetWithDefaults({
          url: Array.isArray(level.url)
            ? level.url[level.urlId || 0]
            : level.url,
          trackType: 'level',
          borderColor,
          level: index,
        })
      );
      if (level.details) {
        this.updateLevelOrTrack(level.details);
      }
    });
    this.resize(datasets);
  }

  updateAudioTracks(audioTracks: MediaPlaylist[]) {
    const { labels, datasets } = this.chart.data;
    if (!labels || !datasets) {
      return;
    }
    const { audioTrack } = self.hls;
    audioTracks.forEach((track: MediaPlaylist, i) => {
      labels.push(getAudioTrackName(track, i));
      datasets.push(
        datasetWithDefaults({
          url: track.url,
          trackType: 'audioTrack',
          borderColor: audioTrack === i ? 'rgba(32, 32, 240, 1.0)' : null,
          audioTrack: i,
        })
      );
      if (track.details) {
        this.updateLevelOrTrack(track.details);
      }
    });
    this.resize(datasets);
  }

  updateSubtitleTracks(subtitles: MediaPlaylist[]) {
    const { labels, datasets } = this.chart.data;
    if (!labels || !datasets) {
      return;
    }
    const { subtitleTrack } = self.hls;
    subtitles.forEach((track, i) => {
      labels.push(getSubtitlesName(track, i));
      datasets.push(
        datasetWithDefaults({
          url: track.url,
          trackType: 'subtitleTrack',
          borderColor: subtitleTrack === i ? 'rgba(32, 32, 240, 1.0)' : null,
          subtitleTrack: i,
        })
      );
      if (track.details) {
        this.updateLevelOrTrack(track.details);
      }
    });
    this.resize(datasets);
  }

  removeType(
    trackType: 'level' | 'audioTrack' | 'subtitleTrack' | 'textTrack'
  ) {
    const { labels, datasets } = this.chart.data;
    if (!labels || !datasets) {
      return;
    }
    let i = datasets.length;
    while (i--) {
      if ((datasets[i] as any).trackType === trackType) {
        datasets.splice(i, 1);
        labels.splice(i, 1);
      }
    }
  }

  updateLevelOrTrack(details: LevelDetails) {
    const { targetduration, totalduration, url } = details;
    const { datasets } = this.chart.data;
    // eslint-disable-next-line no-restricted-properties
    const deliveryDirectivePattern = /[?&]_HLS_(?:msn|part|skip)=[^?&]+/g;
    const levelDataSet = arrayFind(
      datasets,
      (dataset) =>
        dataset.url?.toString().replace(deliveryDirectivePattern, '') ===
        url.replace(deliveryDirectivePattern, '')
    );
    if (!levelDataSet) {
      return;
    }
    const data = levelDataSet.data;
    data.length = 0;
    if (details.fragments) {
      details.fragments.forEach((fragment) => {
        // TODO: keep track of initial playlist start and duration so that we can show drift and pts offset
        // (Make that a feature of hls.js v1.0.0 fragments)
        data.push(
          Object.assign(
            {
              dataType: 'fragment',
            },
            fragment
          )
        );
      });
    }
    if (details.partList) {
      details.partList.forEach((part) => {
        data.push(
          Object.assign(
            {
              dataType: 'part',
              start: part.fragment.start + part.fragOffset,
            },
            part
          )
        );
      });
      if (details.fragmentHint) {
        data.push(
          Object.assign(
            {
              dataType: 'fragmentHint',
            },
            details.fragmentHint
          )
        );
      }
    }
    const start = getPlaylistStart(details);
    this.maxZoom = Math.max(
      start + totalduration + targetduration * 3,
      this.maxZoom
    );
    if (this.hidden) {
      return;
    }
    this.rafDebounceRequestId = self.requestAnimationFrame(() => this.update());
  }

  // @ts-ignore
  get minZoom(): number {
    if (this.chart.config?.options?.plugins) {
      return this.chart.config.options.plugins.zoom.zoom.rangeMin.x;
    }
    return 60;
  }

  // @ts-ignore
  get maxZoom(): number {
    if (this.chart.config?.options?.plugins) {
      return this.chart.config.options.plugins.zoom.zoom.rangeMax.x;
    }
    return 60;
  }

  // @ts-ignore
  set maxZoom(x: number) {
    const { chart } = this;
    const { config } = chart;
    if (config?.options?.plugins) {
      const currentZoom = config.options.plugins.zoom.zoom.rangeMax.x;
      const newZoom = Math.max(x, currentZoom);
      if (currentZoom === 60 && newZoom !== currentZoom) {
        const scale = this.chartScales[X_AXIS_SECONDS];
        scale.options.ticks.max = newZoom;
      }
      config.options.plugins.zoom.zoom.rangeMax.x = newZoom;
    }
  }

  updateFragment(data: FragLoadedData | FragParsedData | FragChangedData) {
    const { datasets } = this.chart.data;
    const frag: Fragment = data.frag;
    const levelDataSet = arrayFind(
      datasets,
      (dataset) => dataset.url === frag.baseurl
    );
    if (!levelDataSet) {
      return;
    }
    // eslint-disable-next-line no-restricted-properties
    const fragData = arrayFind(
      levelDataSet.data,
      (fragData) => fragData.relurl === frag.relurl && fragData.sn === frag.sn
    );
    if (fragData && fragData !== frag) {
      Object.assign(fragData, frag);
    }
    if (this.hidden) {
      return;
    }
    this.rafDebounceRequestId = self.requestAnimationFrame(() => this.update());
  }

  updateSourceBuffers(tracks: TrackSet, media: HTMLMediaElement) {
    const { labels, datasets } = this.chart.data;
    if (!labels || !datasets) {
      return;
    }
    const trackTypes = Object.keys(tracks).sort((type) =>
      type === 'video' ? 1 : -1
    );
    const mediaBufferData = [];

    this.removeSourceBuffers();

    this.media = media;

    trackTypes.forEach((type) => {
      const track = tracks[type];
      const data = [];
      const sourceBuffer = track.buffer;
      const backgroundColor = {
        video: 'rgba(0, 0, 255, 0.2)',
        audio: 'rgba(128, 128, 0, 0.2)',
        audiovideo: 'rgba(128, 128, 255, 0.2)',
      }[type];
      labels.unshift(`${type} buffer (${track.id})`);
      datasets.unshift(
        datasetWithDefaults({
          data,
          categoryPercentage: 0.5,
          backgroundColor,
          sourceBuffer,
        })
      );
      sourceBuffer.onupdate = () => {
        try {
          replaceTimeRangeTuples(sourceBuffer.buffered, data);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn(error);
          return;
        }
        replaceTimeRangeTuples(media.buffered, mediaBufferData);
        this.update();
      };
    });

    if (trackTypes.length === 0) {
      media.onprogress = () => {
        replaceTimeRangeTuples(media.buffered, mediaBufferData);
        this.update();
      };
    }

    labels.unshift('media buffer');
    datasets.unshift(
      datasetWithDefaults({
        data: mediaBufferData,
        categoryPercentage: 0.5,
        backgroundColor: 'rgba(0, 255, 0, 0.2)',
        media,
      })
    );

    media.ontimeupdate = () => this.drawCurrentTime();

    // TextTrackList
    const { textTracks } = media;
    this.tracksChangeHandler =
      this.tracksChangeHandler || ((e) => this.setTextTracks(e.currentTarget));
    textTracks.removeEventListener('addtrack', this.tracksChangeHandler);
    textTracks.removeEventListener('removetrack', this.tracksChangeHandler);
    textTracks.removeEventListener('change', this.tracksChangeHandler);
    textTracks.addEventListener('addtrack', this.tracksChangeHandler);
    textTracks.addEventListener('removetrack', this.tracksChangeHandler);
    textTracks.addEventListener('change', this.tracksChangeHandler);
    this.setTextTracks(textTracks);
    this.resize(datasets);
  }

  removeSourceBuffers() {
    const { labels, datasets } = this.chart.data;
    if (!labels || !datasets) {
      return;
    }
    let i = datasets.length;
    while (i--) {
      if ((labels[0] || '').toString().indexOf('buffer') > -1) {
        datasets.splice(i, 1);
        labels.splice(i, 1);
      }
    }
  }

  setTextTracks(textTracks) {
    const { labels, datasets } = this.chart.data;
    if (!labels || !datasets) {
      return;
    }
    this.removeType('textTrack');
    [].forEach.call(textTracks, (textTrack, i) => {
      // Uncomment to disable rending of subtitle/caption cues in the timeline
      // if (textTrack.kind === 'subtitles' || textTrack.kind === 'captions') {
      //   return;
      // }
      const data = [];
      labels.push(
        `${textTrack.name || textTrack.label} ${textTrack.kind} (${
          textTrack.mode
        })`
      );
      datasets.push(
        datasetWithDefaults({
          data,
          categoryPercentage: 0.5,
          url: '',
          trackType: 'textTrack',
          borderColor:
            (textTrack.mode !== 'hidden') === i
              ? 'rgba(32, 32, 240, 1.0)'
              : null,
          textTrack: i,
        })
      );
      this.cuesChangeHandler =
        this.cuesChangeHandler ||
        ((e) => this.updateTextTrackCues(e.currentTarget));
      textTrack._data = data;
      textTrack.removeEventListener('cuechange', this.cuesChangeHandler);
      textTrack.addEventListener('cuechange', this.cuesChangeHandler);
      this.updateTextTrackCues(textTrack);
    });
    this.resize(datasets);
  }

  updateTextTrackCues(textTrack) {
    const data = textTrack._data;
    if (!data) {
      return;
    }
    const { activeCues, cues } = textTrack;
    data.length = 0;
    if (!cues) {
      return;
    }
    const length = cues.length;

    let activeLength = 0;
    let activeMin = Infinity;
    let activeMax = 0;
    if (activeCues) {
      activeLength = activeCues.length;
      for (let i = 0; i < activeLength; i++) {
        let cue = activeCues[i];
        if (!cue && activeCues.item) {
          cue = activeCues.item(i);
        }
        if (cue) {
          activeMin = Math.min(activeMin, cue.startTime);
          activeMax = cue.endTime
            ? Math.max(activeMax, cue.endTime)
            : activeMax;
        } else {
          activeLength--;
        }
      }
    }
    for (let i = 0; i < length; i++) {
      let cue = cues[i];
      if (!cue && cues.item) {
        cue = cues.item(i);
      }
      if (!cue) {
        continue;
      }
      const start = cue.startTime;
      const end = cue.endTime;
      const content = getCueLabel(cue);
      let active = false;
      if (activeLength && end >= activeMin && start <= activeMax) {
        active = [].some.call(activeCues, (activeCue) =>
          cuesMatch(activeCue, cue)
        );
      }
      data.push({
        start,
        end,
        content,
        active,
        dataType: 'cue',
      });
    }
    if (this.hidden) {
      return;
    }
    self.cancelAnimationFrame(this.rafDebounceRequestId);
    this.rafDebounceRequestId = self.requestAnimationFrame(() => {
      this.update();
    });
  }

  drawCurrentTime() {
    const chart = this.chart;
    if (self.hls && self.hls.media && chart.data.datasets!.length) {
      const currentTime = self.hls.media.currentTime;
      const scale = this.chartScales[X_AXIS_SECONDS];
      const ctx = chart.ctx;
      if (this.hidden || !ctx || !ctx.canvas.width) {
        return;
      }
      const chartArea: { left; top; right; bottom } = chart.chartArea;
      const x = scale.getPixelForValue(currentTime);
      ctx.restore();
      ctx.save();
      this.drawLineX(ctx, x, chartArea);
      if (x > chartArea.left && x < chartArea.right) {
        ctx.fillStyle = this.getCurrentTimeColor(self.hls.media);
        const y = chartArea.top + chart.data.datasets![0].barThickness + 1;
        ctx.fillText(hhmmss(currentTime, 5), x + 2, y, 100);
      }
      ctx.restore();
    }
  }

  getCurrentTimeColor(video: HTMLMediaElement): string {
    if (!video.readyState || video.ended) {
      return 'rgba(0, 0, 0, 0.9)';
    }
    if (video.seeking || video.readyState < 3) {
      return 'rgba(255, 128, 0, 0.9)';
    }
    if (video.paused) {
      return 'rgba(128, 0, 255, 0.9)';
    }
    return 'rgba(0, 0, 255, 0.9)';
  }

  drawLineX(ctx, x: number, chartArea) {
    if (!this.imageDataBuffer) {
      const devicePixelRatio = self.devicePixelRatio || 1;
      this.imageDataBuffer = ctx.getImageData(
        0,
        0,
        chartArea.right * devicePixelRatio,
        chartArea.bottom * devicePixelRatio
      );
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, chartArea.right, chartArea.bottom);
      ctx.putImageData(this.imageDataBuffer, 0, 0);
    }
    if (x > chartArea.left && x < chartArea.right) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.getCurrentTimeColor(self.hls.media); // alpha '0.5'
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    }
  }
}

function datasetWithDefaults(options) {
  return Object.assign(
    {
      data: [],
      xAxisID: X_AXIS_SECONDS,
      barThickness: 35,
      categoryPercentage: 1,
    },
    options
  );
}

function getPlaylistStart(details: LevelDetails): number {
  return details.fragments && details.fragments.length
    ? details.fragments[0].start
    : 0;
}

function getLevelName(level: Level, index: number) {
  let label = '(main playlist)';
  if (level.attrs && level.attrs.BANDWIDTH) {
    label = `${getMainLevelAttribute(level)}@${level.attrs.BANDWIDTH}`;
    if (level.name) {
      label = `${label} (${level.name})`;
    }
  } else if (level.name) {
    label = level.name;
  }
  return `${label} L-${index}`;
}

function getMainLevelAttribute(level: Level) {
  return level.attrs.RESOLUTION || level.attrs.CODECS || level.attrs.AUDIO;
}

function getAudioTrackName(track: MediaPlaylist, index: number) {
  const label = track.lang ? `${track.name}/${track.lang}` : track.name;
  return `${label} (${track.groupId || track.attrs['GROUP-ID']}) A-${index}`;
}

function getSubtitlesName(track: MediaPlaylist, index: number) {
  const label = track.lang ? `${track.name}/${track.lang}` : track.name;
  return `${label} (${track.groupId || track.attrs['GROUP-ID']}) S-${index}`;
}

function replaceTimeRangeTuples(timeRanges, data) {
  data.length = 0;
  const { length } = timeRanges;
  for (let i = 0; i < length; i++) {
    data.push([timeRanges.start(i), timeRanges.end(i)]);
  }
}

function cuesMatch(cue1, cue2) {
  return (
    cue1.startTime === cue2.startTime &&
    cue1.endTime === cue2.endTime &&
    cue1.text === cue2.text &&
    cue1.data === cue2.data &&
    JSON.stringify(cue1.value) === JSON.stringify(cue2.value)
  );
}

function getCueLabel(cue) {
  if (cue.text) {
    return cue.text;
  }
  const result = parseDataCue(cue);
  return JSON.stringify(result);
}

function parseDataCue(cue) {
  const data = {};
  const { value } = cue;
  if (value) {
    if (value.info) {
      let collection = data[value.key];
      if (collection !== Object(collection)) {
        collection = {};
        data[value.key] = collection;
      }
      collection[value.info] = value.data;
    } else {
      data[value.key] = value.data;
    }
  }
  return data;
}

function getChartOptions() {
  return {
    animation: {
      duration: 0,
    },
    elements: {
      rectangle: {
        borderWidth: 1,
        borderColor: 'rgba(20, 20, 20, 1)',
      },
    },
    events: ['click', 'touchstart'],
    hover: {
      mode: null,
      animationDuration: 0,
    },
    legend: {
      display: false,
    },
    maintainAspectRatio: false,

    responsiveAnimationDuration: 0,
    scales: {
      // TODO: additional xAxes for PTS and PDT
      xAxes: [
        {
          id: X_AXIS_SECONDS,
          ticks: {
            beginAtZero: true,
            sampleSize: 0,
            maxRotation: 0,
            callback: (tickValue, i, ticks) => {
              if (i === 0 || i === ticks.length - 1) {
                return tickValue ? '' : '0';
              } else {
                return hhmmss(tickValue, 2);
              }
            },
          },
        },
      ],
      yAxes: [
        {
          gridLines: {
            display: false,
          },
        },
      ],
    },
    tooltips: {
      enabled: false,
    },
    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          rangeMin: {
            x: -10,
            y: null,
          },
          rangeMax: {
            x: null,
            y: null,
          },
        },
        zoom: {
          enabled: true,
          speed: 0.1,
          mode: 'x',
          rangeMin: {
            x: 0,
            y: null,
          },
          rangeMax: {
            x: 60,
            y: null,
          },
        },
      },
    },
  };
}

function arrayFind(array, predicate) {
  const len = array.length >>> 0;
  if (typeof predicate !== 'function') {
    throw TypeError('predicate must be a function');
  }
  const thisArg = arguments[2];
  let k = 0;
  while (k < len) {
    const kValue = array[k];
    if (predicate.call(thisArg, kValue, k, array)) {
      return kValue;
    }
    k++;
  }
  // eslint-disable-next-line no-undefined
  return undefined;
}
