import Chart from 'chart.js';
import 'chartjs-plugin-zoom';
import { Level, LevelParsed } from '../../src/types/level';
import { MediaPlaylist } from '../../src/types/media-playlist';
import { TrackSet } from '../../src/types/track';
import LevelDetails from '../../src/loader/level-details';
import { FragChangedData } from '../../src/types/events';
import Fragment from '../../src/loader/fragment';

export class TimelineChart {
  private chart: Chart;
  private rafDebounceRequestId: number = -1;

  constructor (canvas: HTMLCanvasElement, chartJsOptions?: any) {
    const ctx = canvas.getContext('2d');
    const chart = this.chart = self.chart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: [],
        datasets: []
      },
      options: Object.assign(getChartOptions(), chartJsOptions),
      plugins: [{
        afterRender: function () {
          if (self.hls?.media?.ontimeupdate) {
            ctx.imageDataBuffer = null;
            self.hls.media.ontimeupdate(null);
          }
        }
      }]
    });
    chart.onClick = (event) => {
      console.log('chart.onClick', event);
    };

    canvas.onmousedown = function (event) {
      const elements = chart.getElementsAtEvent(event);
      console.log('onmousedown', event, elements);
    };

    // TODO: prevent zoom over y axis labels
    // canvas.onwheel = function (event) {
    //   const elements = chart.getElementsAtEvent(event);
    //   console.log('onwheel', elements);
    //   event.stopPropagation();
    // };

    canvas.ondblclick = function () {
      chart.resetZoom();
    };

    // Parse custom dataset (Fragment)
    Object.keys(chart.scales).forEach((axis) => {
      const scale = chart.scales[axis];
      scale._parseValue = scaleParseValue;
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
    this.rafDebounceRequestId = self.requestAnimationFrame(() => {
      this.chart.resize();
    });
  }

  updateLevels (levels: LevelParsed[] | Level[]) {
    const { labels, datasets } = this.chart.data;
    levels.forEach((level, i) => {
      labels.push(getLevelName(level, level.level || level.id || i));
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: level.url,
        trackType: 'level',
        level: level.level
      });
      if (level.details) {
        this.updateLevelOrTrack(level.details);
      }
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
        url: track.url,
        trackType: 'audioTrack',
        audioTrack: i
      });
      if (track.details) {
        this.updateLevelOrTrack(track.details);
      }
    });
    this.resize(datasets);
  }

  updateSubtitleTracks (subtitles: MediaPlaylist[]) {
    const { labels, datasets } = this.chart.data;
    subtitles.forEach((track, i) => {
      labels.push(getSubtitlesName(track, i));
      datasets.push({
        data: [],
        categoryPercentage: 1,
        url: track.url,
        trackType: 'subtitleTrack',
        subtitleTrack: i
      });
      if (track.details) {
        this.updateLevelOrTrack(track.details);
      }
    });
    this.resize(datasets);
  }

  removeType (trackType: 'level' | 'audioTrack' | 'subtitleTrack') {
    const { labels, datasets } = this.chart.data;
    let i = datasets.length;
    while (i--) {
      if (datasets[i].trackType === trackType) {
        datasets.splice(i, 1);
        labels.splice(i, 1);
      }
    }
  }

  updateLevelOrTrack (details: LevelDetails) {
    const { totalduration, url } = details;
    const { datasets } = this.chart.data;
    // eslint-disable-next-line no-restricted-properties
    const { data } = datasets.find(dataset => dataset.url === url);
    data.length = 0;
    details.fragments.forEach((fragment) => {
      data.push(Object.assign({}, fragment));
    });
    if (this.chart.config?.options?.plugins?.zoom?.zoom?.rangeMax) {
      this.chart.config.options.plugins.zoom.zoom.rangeMax.x = Math.max(totalduration,
        this.chart.config.options.plugins.zoom.zoom.rangeMax.x);
    }
    this.rafDebounceRequestId = self.requestAnimationFrame(() => this.update());
  }

  updateFragment (data: FragChangedData) {
    const { datasets } = this.chart.data;
    const frag: Fragment = data.frag;
    // eslint-disable-next-line no-restricted-properties
    const levelDataSet = datasets.find(dataset => dataset.url === frag.baseurl);
    // eslint-disable-next-line no-restricted-properties
    const fragData = levelDataSet.data.find(fragData => fragData.relurl === frag.relurl);
    if (fragData !== frag) {
      Object.assign(fragData, frag);
    }
    this.rafDebounceRequestId = self.requestAnimationFrame(() => this.update());
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

    media.ontimeupdate = () => {
      const chart = this.chart;
      const scale = chart.scales['x-axis-0'];
      const ctx: CanvasRenderingContext2D = chart.ctx;
      const chartArea: { left, top, right, bottom } = chart.chartArea;
      const x = scale.getPixelForValue(media.currentTime);
      drawLineX(ctx, x, chartArea);
    };
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
    events: [
      'click', 'touchstart'
    ],
    hover: {
      mode: null,
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
            x: -10, y: null
          },
          rangeMax: {
            x: null, y: null
          }
        },
        zoom: {
          enabled: true,
          speed: 0.1,
          mode: 'x',
          rangeMin: {
            x: 0, y: null
          },
          rangeMax: {
            x: 60, y: null
          }
        }
      }
    }
  };
}

// Modify horizontalBar so that each dataset (fragments, timeRanges) draws on the same row (level, track or buffer)
Chart.controllers.horizontalBar.prototype.calculateBarValuePixels = function (datasetIndex, index, options) {
  const chart = this.chart;
  const scale = this._getValueScale();
  const datasets = chart.data.datasets;
  // const metasets = scale._getMatchingVisibleMetas(this._type);
  const value = scale._parseValue(datasets[datasetIndex].data[index]);
  const start = value.start === undefined ? 0 : value.max >= 0 && value.min >= 0 ? value.min : value.max;
  const length = value.start === undefined ? value.end : value.max >= 0 && value.min >= 0 ? value.max - value.min : value.min - value.max;
  const base = scale.getPixelForValue(start);
  const head = scale.getPixelForValue(start + length);
  const size = head - base;

  return {
    size: size,
    base: base,
    head: head,
    center: head + size / 2
  };
};

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

Chart.controllers.horizontalBar.prototype.draw = function () {
  const chart = this.chart;
  const scale = this._getValueScale();
  const rects = this.getMeta().data;
  const dataset = this.getDataset();
  const len = rects.length;
  if (len !== dataset.data.length) {
    // View does not match dataset (wait for redraw)
    return;
  }
  let drawCount = 0;
  let drawTextCount = 0;
  const ctx: CanvasRenderingContext2D = chart.ctx;
  const chartArea: { left, top, right, bottom } = chart.chartArea;
  Chart.helpers.canvas.clipArea(ctx, chartArea);
  const lineHeight = Math.ceil(ctx.measureText('0').actualBoundingBoxAscent) + 2;
  for (let i = 0; i < len; ++i) {
    const rect = rects[i];
    const view = rect._view;
    if (!intersects(view.base, view.x, chartArea.left, chartArea.right)) {
      // Do not draw elements outside of the chart's viewport
      continue;
    }
    const obj = dataset.data[i];
    scale._parseValue = scaleParseValue;
    const val = scale._parseValue(obj);
    if (!isNaN(val.min) && !isNaN(val.max)) {
      const { stats } = obj;
      const isFragment = !!stats;
      const bounds = boundingRects(view);
      const drawText = bounds.w > lineHeight;
      if (isFragment) {
        if (drawText) {
          view.borderWidth = 1;
          if (i === 0) {
            view.borderSkipped = null;
          }
        } else {
          view.borderWidth = 0;
          view.backgroundColor = `rgba(0, 0, 0, ${0.1 + (i % 2) / 4})`;
        }
      }
      rect.draw();
      if (isFragment) {
        if (stats.aborted) {
          ctx.fillStyle = 'rgba(100, 0, 0, 0.3)';
          ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        }
        if (stats.loaded && stats.total) {
          ctx.fillStyle = 'rgba(50, 20, 100, 0.3)';
          ctx.fillRect(bounds.x, bounds.y, bounds.w * stats.loaded / stats.total, bounds.h);
        }
      }
      if (drawText) {
        const start = val.start; // obj.start;
        ctx.fillStyle = 'rgb(0, 0, 0)';
        if (stats) {
          const snLabel = 'sn: ' + obj.sn;
          const textWidth = Math.min(ctx.measureText(snLabel).width + 2, bounds.w - 2);
          ctx.fillText(snLabel, bounds.x + bounds.w - textWidth, bounds.y + lineHeight, bounds.w - 4);
          drawTextCount++;
        }
        const float = start !== (start | 0);
        const fixedPoint = float ? Math.min(5, Math.max(1, Math.floor(bounds.w / 10 - 1))) : 0;
        const startString = fixedPoint ? start.toFixed(fixedPoint).replace(/\.0$/, '..') : start.toString();
        ctx.fillText(startString, bounds.x + 2, bounds.y + bounds.h - 3, bounds.w - 5);
        drawTextCount++;
      }
      drawCount++;
    }
  }

  Chart.helpers.canvas.unclipArea(chart.ctx);
  // if (drawCount) {
  //   console.warn('rects drawn', drawCount);
  // }
  // if (drawTextCount) {
  //   console.log('text drawn', drawTextCount);
  // }
};

function drawLineX (ctx, x, chartArea) {
  if (!ctx.imageDataBuffer) {
    const devicePixelRatio = self.devicePixelRatio || 1;
    ctx.imageDataBuffer = ctx.getImageData(0, 0, chartArea.right * devicePixelRatio, chartArea.bottom * devicePixelRatio);
  } else {
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chartArea.right, chartArea.bottom);
    ctx.putImageData(ctx.imageDataBuffer, 0, 0);
  }
  if (x > chartArea.left && x < chartArea.right) {
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  }
}

function scaleParseValue (value: number[] | any) {
  let start, end, min, max;

  if (value === undefined) {
    console.warn('value must be defined');
    return {};
  }

  if (Array.isArray(value)) {
    start = +this.getRightValue(value[0]);
    end = +this.getRightValue(value[1]);
    min = Math.min(start, end);
    max = Math.max(start, end);
  } else {
    start = +this.getRightValue(value.start);
    if ('end' in value) {
      end = +this.getRightValue(value.end);
    } else {
      end = +this.getRightValue(value.start + value.duration);
    }
    min = Math.min(start, end);
    max = Math.max(start, end);
  }

  return {
    min,
    max,
    start,
    end
  };
}

function intersects (x1, x2, x3, x4) {
  return x2 > x3 && x1 < x4;
}

function boundingRects (vm) {
  const half = vm.height / 2;
  const left = Math.min(vm.x, vm.base);
  const right = Math.max(vm.x, vm.base);
  const top = vm.y - half;
  const bottom = vm.y + half;
  return {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top
  };
}
