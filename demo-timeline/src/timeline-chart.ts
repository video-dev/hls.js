import Chart from 'chart.js';
import 'chartjs-plugin-zoom';
import { Events } from '../../src/events';
import {
  AudioTrackLoadedData,
  AudioTracksUpdatedData,
  BufferAppendedData,
  BufferCreatedData,
  FragBufferedData,
  FragChangedData,
  FragParsedData,
  InitPTSFoundData,
  LevelLoadedData,
  LevelPTSUpdatedData,
  LevelUpdatedData,
  ManifestLoadedData,
  ManifestParsedData,
  SubtitleTrackLoadedData,
  SubtitleTracksUpdatedData
} from '../../src/types/events';

let chart: Chart;
let rafDebounceRequestId = -1;

export function setup () {
  const canvas = document.querySelector('#timeline-chart') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  chart = new Chart(ctx, {
    type: 'horizontalBar',
    data: {
      labels: ['1'],
      datasets: [{
        data: [[0, 167.999999]]
      }]
    },
    options: getChartOptions()
  });

  // Parse custom dataset
  Object.keys(chart.scales).forEach((axis) => {
    const scale = chart.scales[axis];
    scale._parseValue = function (value) {
      var start, end, min, max;

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

  setupCheapResponsiveListeners(chart);
}

export function updatePlayer (hls) {
  hls.on(Events.MANIFEST_LOADING, function () {
    const { labels, datasets } = chart.data;

    labels.length = 0;
    datasets.length = 0;
    resize(chart, datasets);
  });

  hls.on(Events.MANIFEST_LOADED, function (eventName, data: ManifestLoadedData) {
    const { levels, audioTracks, subtitles } = data;
    const { labels, datasets } = chart.data;

    levels.forEach((level) => {
      labels.push(`${level.attrs.RESOLUTION}@${level.attrs.BANDWIDTH} (${level.name})`);
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: level.url
      });
    });
    audioTracks.forEach((level) => {
      labels.push(`${level.name}/${level.lang} (${level.attrs['GROUP-ID']})`);
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: level.url
      });
    });
    subtitles.forEach((level) => {
      labels.push(`${level.name}/${level.lang} (${level.attrs['GROUP-ID']})`);
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: level.url
      });
    });
    resize(chart, datasets);
  });
  // hls.on(Events.MANIFEST_PARSED, function (eventName, data: ManifestParsedData) {
  //   console.log(eventName, data);
  // });

  // hls.on(Events.LEVELS_UPDATED, function (eventName, data) {
  //   // A level was removed
  //   // { levels: [] }
  //   console.log(eventName, data);
  // });
  hls.on(Events.LEVEL_LOADED, function (eventName, data: LevelLoadedData) {
    console.log(eventName, data);
  });
  hls.on(Events.LEVEL_UPDATED, function (eventName, data: LevelUpdatedData) {
    console.log(eventName, data);
  });
  // // LEVEL_SWITCHED
  // hls.on(Events.LEVEL_PTS_UPDATED, function (eventName, data: LevelPTSUpdatedData) {
  //   console.log(eventName, data);
  // });
  //
  // hls.on(Events.AUDIO_TRACKS_UPDATED, function (eventName, data: AudioTracksUpdatedData) {
  //   console.log(eventName, data);
  // });
  // hls.on(Events.AUDIO_TRACK_LOADED, function (eventName, data: AudioTrackLoadedData) {
  //   console.log(eventName, data);
  // });
  // // AUDIO_TRACK_SWITCHED
  //
  // hls.on(Events.SUBTITLE_TRACKS_UPDATED, function (eventName, data: SubtitleTracksUpdatedData) {
  //   console.log(eventName, data);
  // });
  // hls.on(Events.SUBTITLE_TRACK_LOADED, function (eventName, data: SubtitleTrackLoadedData) {
  //   console.log(eventName, data);
  // });
  // // SUBTITLE_TRACK_SWITCH
  //
  // hls.on(Events.INIT_PTS_FOUND, function (eventName, data: InitPTSFoundData) {
  //   console.log(eventName, data);
  // });
  //
  // hls.on(Events.FRAG_PARSED, function (eventName, data: FragParsedData) {
  //   console.log(eventName, data);
  // });
  // hls.on(Events.FRAG_BUFFERED, function (eventName, data: FragBufferedData) {
  //   console.log(eventName, data);
  // });
  // hls.on(Events.FRAG_CHANGED, function (eventName, data: FragChangedData) {
  //   console.log(eventName, data);
  // });
  //
  hls.on(Events.BUFFER_CREATED, function (eventName, { tracks }: BufferCreatedData) {
    const { labels, datasets } = chart.data;
    const trackTypes = Object.keys(tracks).sort((type) => type === 'video' ? 1 : -1);
    console.log(eventName, tracks);
    trackTypes.forEach((type) => {
      const track = tracks[type];
      const data = [];
      const sourceBuffer = track.buffer;
      labels.unshift(`${type} buffer (${track.id})`);
      datasets.unshift({
        data,
        categoryPercentage: 0.5,
        sourceBuffer
      });
      // TODO: buffered to timeRange tuple
      sourceBuffer.onupdate = function () {
        const { buffered } = sourceBuffer;
        data.length = 0;
        for (let i = 0; i < buffered.length; i++) {
          data.push([buffered.start(i), buffered.end(i)]);
        }
        // TODO: updateChart
        chart.update({
          duration: 0,
          lazy: true
        });
      };
    });

    if (trackTypes.length > 1) {
      const data = [];
      labels.unshift('media buffer');
      datasets.unshift({
        data,
        categoryPercentage: 0.5,
        media: hls.media
      });
      // TODO: buffered to timeRange tuple
      hls.media.onprogress = function () {
        const { buffered } = hls.media;
        data.length = 0;
        for (let i = 0; i < buffered.length; i++) {
          data.push([buffered.start(i), buffered.end(i)]);
        }
        chart.update({
          duration: 0,
          lazy: true
        });
      };
    }

    resize(chart, datasets);
  });
  // hls.on(Events.BUFFER_APPENDED, function (eventName, data: BufferAppendedData) {
  //   console.log(eventName, data);
  // });
  // hls.on(Events.BUFFER_FLUSHED, function (eventName) {
  //   console.log(eventName);
  // });

  hls.on(Events.ERROR, function (eventName, data) {
    console.error(data);
  });
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
    responsive: false,
    responsiveAnimationDuration: 0,
    scales: {
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

function setupCheapResponsiveListeners (chart) {
  self.onresize = () => resize(chart);
  if (self.screen?.orientation) {
    self.screen.orientation.addEventListener('change', self.onresize);
  }
  resize(chart);
}

function resize (chart, datasets?) {
  if (datasets) {
    chart.canvas.parentNode.style.height = `${datasets.length * 35}px`;
  }
  self.cancelAnimationFrame(rafDebounceRequestId);
  rafDebounceRequestId = self.requestAnimationFrame(() => chart.resize());
}
