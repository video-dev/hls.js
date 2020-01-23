import Chart from 'chart.js';
import 'chartjs-plugin-zoom';
import { LevelParsed } from '../../src/types/level';
import { MediaPlaylist } from '../../src/types/media-playlist';
import { TrackSet } from '../../src/types/track';

export class TimelineChart {
  private chart: Chart;
  private rafDebounceRequestId: number = -1;

  constructor (canvas: HTMLCanvasElement, chartJsOptions?: any) {
    const ctx = canvas.getContext('2d');
    const chart = this.chart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: ['1'],
        datasets: [{
          data: [[0, 167.999999]]
        }]
      },
      options: Object.assign(getChartOptions(), chartJsOptions)
    });

    // Parse custom dataset (Fragment)
    Object.keys(chart.scales).forEach((axis) => {
      const scale = chart.scales[axis];
      scale._parseValue = function (value: number[] | any) {
        let start, end, min, max;

        if (Array.isArray(value)) {
          start = +this.getRightValue(value[0]);
          end = +this.getRightValue(value[1]);
          min = Math.min(start, end);
          max = Math.max(start, end);
        } else {
          start = +this.getRightValue(value.start);
          end = +this.getRightValue(value.start + value.duration);
          min = Math.min(start, end);
          max = Math.max(start, end);
        }

        return {
          min,
          max,
          start,
          end
        };
      };
    });
  }

  reset () {
    const { labels, datasets } = this.chart.data;

    labels.length = 0;
    datasets.length = 0;
    this.resize(datasets);
  }

  update () {
    this.chart.update({
      duration: 0,
      lazy: true
    });
  }

  resize (datasets?) {
    if (datasets) {
      this.chart.canvas.parentNode.style.height = `${datasets.length * 35}px`;
    }
    self.cancelAnimationFrame(this.rafDebounceRequestId);
    this.rafDebounceRequestId = self.requestAnimationFrame(() => this.chart.resize());
  }

  updateLevels (levels: LevelParsed[]) {
    const { labels, datasets } = this.chart.data;
    levels.forEach((level, i) => {
      labels.push(getLevelName(level, i));
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: level.url
      });
    });
    this.resize(datasets);
  }

  updateAudioTracks (audioTracks: MediaPlaylist[]) {
    const { labels, datasets } = this.chart.data;
    audioTracks.forEach((track, i) => {
      labels.push(getAudioTrackName(track, i));
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: track.url
      });
    });
    this.resize(datasets);
  }

  updateSubtitles (subtitles: MediaPlaylist[]) {
    const { labels, datasets } = this.chart.data;
    subtitles.forEach((track, i) => {
      labels.push(getSubtitlesName(track, i));
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: track.url
      });
    });
    this.resize(datasets);
  }

  updateSourceBuffers (tracks: TrackSet, media: HTMLMediaElement) {
    const { labels, datasets } = this.chart.data;
    const trackTypes = Object.keys(tracks).sort((type) => type === 'video' ? 1 : -1);
    const mediaBufferData = [];

    trackTypes.forEach((type) => {
      const track = tracks[type];
      const data = [];
      const sourceBuffer = track.buffer;
      const backgroundColor = {
        video: 'rgba(0, 0, 255, 0.2)',
        audio: 'rgba(128, 128, 0, 0.2)',
        audiovideo: 'rgba(128, 128, 255, 0.2)'
      }[type];
      labels.unshift(`${type} buffer (${track.id})`);
      datasets.unshift({
        data,
        categoryPercentage: 0.5,
        backgroundColor,
        sourceBuffer
      });
      sourceBuffer.onupdate = () => {
        replaceTimeRangeTuples(sourceBuffer.buffered, data);
        replaceTimeRangeTuples(media.buffered, mediaBufferData);
        this.update();
      };
    });

    labels.unshift('media buffer');
    datasets.unshift({
      data: mediaBufferData,
      categoryPercentage: 0.5,
      backgroundColor: 'rgba(0, 255, 0, 0.2)',
      media
    });

    this.resize(datasets);
  }
}

function getLevelName (level: LevelParsed, index: number) {
  let label = '(main playlist)';
  if (level.attrs.BANDWIDTH) {
    label = `${getMainLevelAttribute(level)}@${level.attrs.BANDWIDTH}`;
    if (level.name) {
      label = `${label} (${level.name})`;
    }
  } else if (level.name) {
    label = level.name;
  }
  return `${label} L-${index}`;
}

function getMainLevelAttribute (level: LevelParsed) {
  return level.attrs.RESOLUTION || level.attrs.CODECS || level.attrs.AUDIO;
}

function getAudioTrackName (track: MediaPlaylist, index: number) {
  const label = track.lang ? `${track.name}/${track.lang}` : track.name;
  return `${label} (${track.attrs['GROUP-ID']}) A-${index}`;
}

function getSubtitlesName (track: MediaPlaylist, index: number) {
  const label = track.lang ? `${track.name}/${track.lang}` : track.name;
  return `${label} (${track.attrs['GROUP-ID']}) S-${index}`;
}

function replaceTimeRangeTuples (timeRanges, data) {
  data.length = 0;
  const { length } = timeRanges;
  for (let i = 0; i < length; i++) {
    data.push([timeRanges.start(i), timeRanges.end(i)]);
  }
}

function getChartOptions () {
  return {
    animation: {
      duration: 0
    },
    elements: {
      rectangle: {
        borderWidth: 1,
        borderColor: 'rgba(20, 20, 20, 1)'
      }
    },
    hover: {
      animationDuration: 0
    },
    legend: {
      display: false
    },
    maintainAspectRatio: false,

    responsiveAnimationDuration: 0,
    scales: {
      // TODO: additional xAxes for PTS and PDT
      xAxes: [{
        ticks: {
          beginAtZero: true
        }
      }],
      yAxes: [{
        gridLines: {
          display: false
        }
      }]
    },
    tooltips: {
      enabled: false
    },
    plugins: {
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
          rangeMin: {
            x: -30, y: 0
          }
        },
        zoom: {
          enabled: true,
          mode: 'x',
          rangeMin: {
            x: -30, y: 0
          }
        }
      }
    }
  };
}

// Modify horizontalBar so that each dataset (fragments, timeRanges) draws on the same row (level, track or buffer)
Chart.controllers.horizontalBar.prototype.calculateBarIndexPixels = function (datasetIndex, index, ruler, options) {
  const rowHeight = 35;
  const size = rowHeight * options.categoryPercentage;
  const center = datasetIndex * rowHeight + (rowHeight / 2);
  return {
    base: center - size / 2,
    head: center + size / 2,
    center,
    size
  };
};

// TODO: Draw currentTime on chart after each chart update

// TODO: Custom draw method for Fragments and TimeRanges
Chart.controllers.horizontalBar.prototype.draw = function () {
  const chart = this.chart;
  const scale = this._getValueScale();
  const rects = this.getMeta().data;
  const dataset = this.getDataset();
  const ilen = rects.length;
  Chart.helpers.canvas.clipArea(chart.ctx, chart.chartArea);
  for (let i = 0; i < ilen; ++i) {
    const val = scale._parseValue(dataset.data[i]);
    if (!isNaN(val.min) && !isNaN(val.max)) {
      rects[i].draw();
      // TODO: draw data?
    }
  }
  Chart.helpers.canvas.unclipArea(chart.ctx);
};
