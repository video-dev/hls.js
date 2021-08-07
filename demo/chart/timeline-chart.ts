import Chart from 'chart.js';
import { applyChartInstanceOverrides, hhmmss } from './chartjs-horizontal-bar';
import { Fragment } from '../../src/loader/fragment';
import type { Level } from '../../src/types/level';
import type { TrackSet } from '../../src/types/track';
import type { MediaPlaylist } from '../../src/types/media-playlist';
import type { LevelDetails } from '../../src/loader/level-details';
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
  width: number;
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
  private zoom100: number = 60;

  constructor(canvas: HTMLCanvasElement, chartJsOptions?: any) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(
        `Could not get CanvasRenderingContext2D from canvas: ${canvas}`
      );
    }
    const chart =
      (this.chart =
      self.chart =
        new Chart(ctx, {
          type: 'horizontalBar',
          data: {
            labels: [],
            datasets: [],
          },
          options: Object.assign(getChartOptions(), chartJsOptions),
          plugins: [
            {
              afterRender: (chart) => {
                this.imageDataBuffer = null;
                this.drawCurrentTime();
              },
            },
          ],
        }));

    applyChartInstanceOverrides(chart);

    canvas.ondblclick = (event: MouseEvent) => {
      const chart = this.chart;
      const chartArea: { left; top; right; bottom } = chart.chartArea;
      const element = chart.getElementAtEvent(event);
      const pos = Chart.helpers.getRelativePosition(event, chart);
      const scale = this.chartScales[X_AXIS_SECONDS];
      // zoom in when double clicking near elements in chart area
      if (element.length || pos.x > chartArea.left) {
        const amount = event.getModifierState('Shift') ? -1.0 : 0.5;
        this.zoom(scale, pos, amount);
      } else {
        scale.options.ticks.min = 0;
        scale.options.ticks.max = this.zoom100;
      }
      this.update();
    };

    canvas.onwheel = (event: WheelEvent) => {
      if (event.deltaMode) {
        // exit if wheel is in page or line scrolling mode
        return;
      }
      const chart = this.chart;
      const chartArea: { left; top; right; bottom } = chart.chartArea;
      const pos = Chart.helpers.getRelativePosition(event, chart);
      // zoom when scrolling over chart elements
      if (pos.x > chartArea.left - 11) {
        const scale = this.chartScales[X_AXIS_SECONDS];
        if (event.deltaY) {
          const direction = -event.deltaY / Math.abs(event.deltaY);
          const normal = Math.min(333, Math.abs(event.deltaY)) / 1000;
          const ease = 1 - (1 - normal) * (1 - normal);
          this.zoom(scale, pos, ease * direction);
        } else if (event.deltaX) {
          this.pan(scale, event.deltaX / 10, scale.min, scale.max);
        }
        event.preventDefault();
      }
    };

    let moved = false;
    let gestureScale = 1;
    canvas.onpointerdown = (downEvent: PointerEvent) => {
      if (!downEvent.isPrimary || gestureScale !== 1) {
        return;
      }
      const chart = this.chart;
      const chartArea: { left; top; right; bottom } = chart.chartArea;
      const pos = Chart.helpers.getRelativePosition(downEvent, chart);
      // pan when dragging over chart elements
      if (pos.x > chartArea.left) {
        const scale = this.chartScales[X_AXIS_SECONDS];
        const startX = downEvent.clientX;
        const { min, max } = scale;
        const xToVal = (max - min) / scale.width;
        moved = false;
        canvas.setPointerCapture(downEvent.pointerId);
        canvas.onpointermove = (moveEvent: PointerEvent) => {
          if (!downEvent.isPrimary || gestureScale !== 1) {
            return;
          }
          const movedX = startX - moveEvent.clientX;
          const movedValue = movedX * xToVal;
          moved = moved || Math.abs(movedX) > 8;
          this.pan(scale, movedValue, min, max);
        };
      }
    };

    canvas.onpointerup = canvas.onpointercancel = (upEvent: PointerEvent) => {
      if (canvas.onpointermove) {
        canvas.onpointermove = null;
        canvas.releasePointerCapture(upEvent.pointerId);
      }
      if (!moved && upEvent.isPrimary) {
        this.click(upEvent);
      }
    };

    // Gesture events are for iOS and easier to implement than pinch-zoom with multiple pointers for all browsers
    // @ts-ignore
    canvas.ongesturestart = (event) => {
      gestureScale = 1;
      event.preventDefault();
    };

    // @ts-ignore
    canvas.ongestureend = (event) => {
      gestureScale = 1;
    };

    // @ts-ignore
    canvas.ongesturechange = (event) => {
      const chart = this.chart;
      const chartArea: { left; top; right; bottom } = chart.chartArea;
      const pos = Chart.helpers.getRelativePosition(event, chart);
      // zoom when scrolling over chart elements
      if (pos.x > chartArea.left) {
        const scale = this.chartScales[X_AXIS_SECONDS];
        const amount = event.scale - gestureScale;
        this.zoom(scale, pos, amount);
        gestureScale = event.scale;
      }
    };
  }

  private click(event: MouseEvent) {
    // Log object on click and seek to position
    const chart = this.chart;
    const element = chart.getElementAtEvent(event);
    if (element.length && chart.data.datasets) {
      const dataset = chart.data.datasets[(element[0] as any)._datasetIndex];
      const obj = dataset.data![(element[0] as any)._index];
      // eslint-disable-next-line no-console
      console.log(obj);
      if (self.hls?.media) {
        const scale = this.chartScales[X_AXIS_SECONDS];
        const pos = Chart.helpers.getRelativePosition(event, chart);
        self.hls.media.currentTime = scale.getValueForPixel(pos.x);
      }
    }
  }

  private pan(scale: ChartScale, amount: number, min: number, max: number) {
    if (amount === 0) {
      return;
    }
    let pan = amount;
    if (amount > 0) {
      pan = Math.min(this.zoom100 + 10 - max, amount);
    } else {
      pan = Math.max(-10 - min, amount);
    }
    scale.options.ticks.min = min + pan;
    scale.options.ticks.max = max + pan;
    this.updateOnRepaint();
  }

  private zoom(scale: ChartScale, pos: any, amount: number) {
    const range = scale.max - scale.min;
    const diff = range * amount;
    const minPercent = (scale.getValueForPixel(pos.x) - scale.min) / range;
    const maxPercent = 1 - minPercent;
    const minDelta = diff * minPercent;
    const maxDelta = diff * maxPercent;
    scale.options.ticks.min = Math.max(-10, scale.min + minDelta);
    scale.options.ticks.max = Math.min(this.zoom100 + 10, scale.max - maxDelta);
    this.updateOnRepaint();
  }

  get chartScales(): { 'x-axis-seconds': ChartScale } {
    return (this.chart as any).scales;
  }

  reset() {
    const scale = this.chartScales[X_AXIS_SECONDS];
    scale.options.ticks.min = 0;
    scale.options.ticks.max = 60;
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
    self.cancelAnimationFrame(this.rafDebounceRequestId);
    this.chart.update({
      duration: 0,
      lazy: true,
    });
  }

  updateOnRepaint() {
    if (this.hidden) {
      return;
    }
    self.cancelAnimationFrame(this.rafDebounceRequestId);
    this.rafDebounceRequestId = self.requestAnimationFrame(() => this.update());
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
    let levelDataSet = arrayFind(
      datasets,
      (dataset) =>
        stripDeliveryDirectives(url) ===
        stripDeliveryDirectives(dataset.url || '')
    );
    if (!levelDataSet) {
      levelDataSet = arrayFind(
        datasets,
        (dataset) => details.fragments[0]?.level === dataset.level
      );
    }
    if (!levelDataSet) {
      return;
    }
    const data = levelDataSet.data;
    data.length = 0;
    if (details.fragments) {
      details.fragments.forEach((fragment) => {
        // TODO: keep track of initial playlist start and duration so that we can show drift and pts offset
        // (Make that a feature of hls.js v1.0.0 fragments)
        const chartFragment = Object.assign(
          {
            dataType: 'fragment',
          },
          fragment,
          // Remove loader references for GC
          { loader: null }
        );
        data.push(chartFragment);
      });
    }
    if (details.partList) {
      details.partList.forEach((part) => {
        const chartPart = Object.assign(
          {
            dataType: 'part',
            start: part.fragment.start + part.fragOffset,
          },
          part,
          {
            fragment: Object.assign({}, part.fragment, { loader: null }),
          }
        );
        data.push(chartPart);
      });
      if (details.fragmentHint) {
        const chartFragment = Object.assign(
          {
            dataType: 'fragmentHint',
          },
          details.fragmentHint,
          // Remove loader references for GC
          { loader: null }
        );
        data.push(chartFragment);
      }
    }
    const start = getPlaylistStart(details);
    this.maxZoom = this.zoom100 = Math.max(
      start + totalduration + targetduration * 3,
      this.zoom100
    );
    this.updateOnRepaint();
  }

  // @ts-ignore
  get minZoom(): number {
    const scale = this.chartScales[X_AXIS_SECONDS];
    if (scale) {
      return scale.options.ticks.min;
    }
    return 1;
  }

  // @ts-ignore
  get maxZoom(): number {
    const scale = this.chartScales[X_AXIS_SECONDS];
    if (scale) {
      return scale.options.ticks.max;
    }
    return this.zoom100;
  }

  // @ts-ignore
  set maxZoom(x: number) {
    const currentZoom = this.maxZoom;
    const newZoom = Math.max(x, currentZoom);
    if (currentZoom === 60 && newZoom !== currentZoom) {
      const scale = this.chartScales[X_AXIS_SECONDS];
      scale.options.ticks.max = newZoom;
    }
  }

  updateFragment(data: FragLoadedData | FragParsedData | FragChangedData) {
    const { datasets } = this.chart.data;
    const frag: Fragment = data.frag;
    let levelDataSet = arrayFind(
      datasets,
      (dataset) => frag.baseurl === dataset.url
    );
    if (!levelDataSet) {
      levelDataSet = arrayFind(
        datasets,
        (dataset) => frag.level === dataset.level
      );
    }
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
    this.updateOnRepaint();
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
      sourceBuffer.addEventListener('update', () => {
        try {
          replaceTimeRangeTuples(sourceBuffer.buffered, data);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn(error);
          return;
        }
        replaceTimeRangeTuples(media.buffered, mediaBufferData);
        this.update();
      });
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
    this.updateOnRepaint();
  }

  drawCurrentTime() {
    const chart = this.chart;
    if (self.hls?.media && chart.data.datasets!.length) {
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

function stripDeliveryDirectives(url: string): string {
  if (url === '') {
    return url;
  }
  try {
    const webUrl: URL = new self.URL(url);
    webUrl.searchParams.delete('_HLS_msn');
    webUrl.searchParams.delete('_HLS_part');
    webUrl.searchParams.delete('_HLS_skip');
    webUrl.searchParams.sort();
    return webUrl.href;
  } catch (e) {
    return url.replace(/[?&]_HLS_(?:msn|part|skip)=[^?&]+/g, '');
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
  return details.fragments?.length ? details.fragments[0].start : 0;
}

function getLevelName(level: Level, index: number) {
  let label = '(main playlist)';
  if (level.attrs?.BANDWIDTH) {
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
