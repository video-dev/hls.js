import { TimelineType } from '../src/controller/interstitials-schedule';
import type Hls from '../src/hls';

const instances: Record<string, InterstitialTimelineCanvas> = {};
const requestAnimationFrame = self.requestAnimationFrame || self.setTimeout;
const cancelAnimationFrame = self.cancelAnimationFrame || self.clearTimeout;

export function registerInterstitialTimelineCanvas(
  canvas: HTMLCanvasElement,
  hls: Hls,
  timelineType: TimelineType
) {
  const id = canvas.id;
  const runningInstance = instances[id];
  if (runningInstance) {
    runningInstance.destroy();
  }
  instances[id] = new InterstitialTimelineCanvas(canvas, hls, timelineType);
}

class InterstitialTimelineCanvas {
  private canvas: HTMLCanvasElement;
  private hls: Hls;
  private refreshId: number = -1;
  private timelineType: TimelineType;

  constructor(canvas: HTMLCanvasElement, hls: Hls, timelineType: TimelineType) {
    this.canvas = canvas;
    this.hls = hls;
    this.timelineType = timelineType;
    this.canvas.onclick = this.onClick;
    this.refresh();
  }

  destroy() {
    cancelAnimationFrame(this.refreshId);
    // @ts-ignore
    this.canvas = this.hls = null;
  }

  onClick = (event: MouseEvent) => {
    const im = this.hls.interstitialsManager;
    if (!im) {
      return;
    }
    const type = this.timelineType;
    const imTimes = im[type];
    const targetTime =
      ((event.clientX - this.canvas.offsetLeft) / this.canvas.width) *
      imTimes.duration;
    imTimes.seekTo(targetTime);
  };

  refresh() {
    cancelAnimationFrame(this.refreshId);
    this.refreshId = requestAnimationFrame(() => this.refresh());
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    let width = canvas.width;
    const height = canvas.height;
    // resize
    const video = this.hls.media;
    if (video) {
      if (!width || width !== video.clientWidth) {
        width = canvas.width = video.clientWidth;
      }
    }

    // redraw background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    const im = this.hls.interstitialsManager;
    if (!im) {
      return;
    }
    const type = this.timelineType;
    const imTimes = im[type];

    const duration = imTimes.duration;
    const currentTime = imTimes.currentTime;
    const bufferedEnd = imTimes.bufferedEnd;

    // Interstitial event and asset boundaries
    const items = im.schedule;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const event = item.event;
      if (event) {
        // Interstitial event range
        const timeRange = type === 'primary' ? item : item[type];
        const xEventStart = (timeRange.start / duration) * width;
        const xEventEnd = (timeRange.end / duration) * width;
        const widthEvent = xEventEnd - xEventStart;
        const restrictions = event.restrictions;
        if (restrictions.jump) {
          ctx.fillStyle = 'red';
        } else if (restrictions.skip) {
          ctx.fillStyle = 'orange';
        } else if (event.supplementsPrimary) {
          ctx.fillStyle = 'green';
        } else {
          ctx.fillStyle = 'yellow';
        }
        ctx.fillRect(xEventStart, 0, Math.max(widthEvent, 1), height);
        // Fill with Asset ranges
        const assets = event.assetList;
        if (widthEvent > assets.length * 2) {
          for (let j = 0; j < assets.length; j++) {
            const asset = event.assetList[j];
            if (asset.duration) {
              const xAssetStart =
                ((timeRange.start + asset.startOffset) / duration) * width;
              const xAssetEnd =
                ((timeRange.start + asset.startOffset + asset.duration) /
                  duration) *
                width;
              const widthAsset = xAssetEnd - xAssetStart;
              ctx.fillStyle = 'rgb(120,120,0)';
              ctx.fillRect(
                xAssetStart + 1,
                1,
                Math.max(widthAsset - 2.5, 1),
                height - 2
              );
            }
          }
        }
      } else {
        // only drawing Interstitial segments
      }
    }

    // buffered
    const xCurrentTime = (currentTime / duration) * width;
    const xBufferedEnd = (bufferedEnd / duration) * width;
    if (bufferedEnd > currentTime) {
      ctx.fillStyle = 'gray';
      ctx.fillRect(xCurrentTime, 2, xBufferedEnd - xCurrentTime, height - 4);
    } else if (bufferedEnd < currentTime) {
      // console.log(
      //   `"${type}" bufferedEnd is less than currentTime (${bufferedEnd} < ${currentTime})`,
      // );
    }

    // current time
    ctx.fillStyle = 'rgb(16,128,255)';
    ctx.fillRect(xCurrentTime - 0.5, 0, 2, height);
  }
}
