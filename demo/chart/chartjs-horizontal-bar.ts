import Chart from 'chart.js';

// Modify horizontalBar so that each dataset (fragments, timeRanges) draws on the same row (level, track or buffer)
Chart.controllers.horizontalBar.prototype.calculateBarValuePixels = function (
  datasetIndex,
  index,
  options
) {
  const chart = this.chart;
  const scale = this._getValueScale();
  const datasets = chart.data.datasets;
  if (!datasets) {
    throw new Error(`Chart datasets are ${datasets}`);
  }
  scale._parseValue = scaleParseValue;
  const obj = datasets[datasetIndex].data[index];
  const value = scale._parseValue(obj);
  const start =
    value.start === undefined
      ? 0
      : value.max >= 0 && value.min >= 0
      ? value.min
      : value.max;
  const length =
    value.start === undefined
      ? value.end
      : value.max >= 0 && value.min >= 0
      ? value.max - value.min
      : value.min - value.max;
  const base = scale.getPixelForValue(start);
  const head = scale.getPixelForValue(start + length);
  const size = head - base;

  return {
    size: size,
    base: base,
    head: head,
    center: head + size / 2,
  };
};

Chart.controllers.horizontalBar.prototype.calculateBarIndexPixels = function (
  datasetIndex,
  index,
  ruler,
  options
) {
  const rowHeight = options.barThickness;
  const size = rowHeight * options.categoryPercentage;
  const center = ruler.start + (datasetIndex * rowHeight + rowHeight / 2);
  return {
    base: center - size / 2,
    head: center + size / 2,
    center,
    size,
  };
};

Chart.controllers.horizontalBar.prototype.draw = function () {
  const rects = this.getMeta().data;
  const len = rects.length;
  const dataset = this.getDataset();
  if (len !== dataset.data.length) {
    // View does not match dataset (wait for redraw)
    return;
  }
  const chart = this.chart;
  const scale = this._getValueScale();
  scale._parseValue = scaleParseValue;
  const ctx: CanvasRenderingContext2D = chart.ctx;
  const chartArea: { left; top; right; bottom } = chart.chartArea;
  Chart.helpers.canvas.clipArea(ctx, chartArea);
  if (!this.lineHeight) {
    this.lineHeight =
      Math.ceil(ctx.measureText('0').actualBoundingBoxAscent) + 2;
  }
  const lineHeight = this.lineHeight;
  let range = 0;
  for (let i = 0; i < len; ++i) {
    const rect = rects[i];
    const view = rect._view;
    if (!intersects(view.base, view.x, chartArea.left, chartArea.right)) {
      // Do not draw elements outside of the chart's viewport
      continue;
    }
    const obj = dataset.data[i];
    const val = scale._parseValue(obj);
    if (!isNaN(val.min) && !isNaN(val.max)) {
      const { dataType } = obj;
      let { stats } = obj;
      const isPart = dataType === 'part';
      const isFragmentHint = dataType === 'fragmentHint';
      const isFragment = dataType === 'fragment' || isPart || isFragmentHint;
      const isCue = dataType === 'cue';
      if (isCue) {
        view.y += view.height * 0.5 * (i % 2) - view.height * 0.25;
      } else if (isPart) {
        view.height -= 22;
      }
      const bounds = boundingRects(view);
      const drawText = bounds.w > lineHeight * 1.5 && !isFragmentHint;
      if (isFragment || isCue) {
        if (drawText) {
          view.borderWidth = 1;
          if (i === 0) {
            view.borderSkipped = false;
          }
        } else {
          range =
            range ||
            scale.getValueForPixel(chartArea.right) -
              scale.getValueForPixel(chartArea.left);
          if (range > 300 || isCue) {
            view.borderWidth = 0;
          }
        }
        if (isFragmentHint) {
          view.borderWidth = 0;
          view.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        } else {
          view.backgroundColor = `rgba(0, 0, 0, ${0.05 + (i % 2) / 12})`;
        }
      }
      rect.draw();
      if (isFragment) {
        if (!stats) {
          stats = {};
        }
        if (isPart) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        }
        if (stats.aborted) {
          ctx.fillStyle = 'rgba(100, 0, 0, 0.3)';
          ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        }
        if (stats.loaded && stats.total) {
          ctx.fillStyle = 'rgba(50, 20, 100, 0.3)';
          ctx.fillRect(
            bounds.x,
            bounds.y,
            (bounds.w * stats.loaded) / stats.total,
            bounds.h
          );
        }
      } else if (isCue) {
        if (obj.active) {
          ctx.fillStyle = 'rgba(100, 100, 10, 0.4)';
          ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        }
      }
      if (drawText) {
        const start = val.start; // obj.start;
        ctx.fillStyle = 'rgb(0, 0, 0)';
        if (stats) {
          const snBounds = Object.assign({}, bounds);
          if (obj.cc) {
            const ccLabel = `cc:${obj.cc}`;
            const ccWidth = Math.min(
              ctx.measureText(ccLabel).width + 2,
              snBounds.w / 2 - 2
            );
            if (ccWidth) {
              ctx.fillText(
                ccLabel,
                snBounds.x + 2,
                snBounds.y + lineHeight,
                snBounds.w / 2 - 4
              );
              snBounds.x += ccWidth;
              snBounds.w -= ccWidth;
            }
          }
          const snLabel = isPart ? `part: ${obj.index}` : `sn: ${obj.sn}`;
          const textWidth = Math.min(
            ctx.measureText(snLabel).width + 2,
            snBounds.w - 2
          );
          ctx.fillText(
            snLabel,
            snBounds.x + snBounds.w - textWidth,
            snBounds.y + lineHeight,
            snBounds.w - 4
          );
        }
        if (isCue) {
          const strLength = Math.min(
            30,
            Math.ceil(bounds.w / (lineHeight / 3))
          );
          ctx.fillText(
            ('' + obj.content).substr(0, strLength),
            bounds.x + 2,
            bounds.y + bounds.h - 3,
            bounds.w - 5
          );
        } else if (!isPart) {
          const float = start !== (start | 0);
          const fixedDigits = float
            ? Math.min(5, Math.max(1, Math.floor(bounds.w / 10 - 1)))
            : 0;
          const startString = hhmmss(start, fixedDigits);
          ctx.fillText(
            startString,
            bounds.x + 2,
            bounds.y + bounds.h - 3,
            bounds.w - 5
          );
        }
      }
    }
  }

  Chart.helpers.canvas.unclipArea(chart.ctx);
};

export function applyChartInstanceOverrides(chart) {
  Object.keys(chart.scales).forEach((axis) => {
    const scale = chart.scales![axis];
    scale._parseValue = scaleParseValue;
  });
}

function scaleParseValue(value: number[] | any) {
  if (value === undefined) {
    console.warn('Chart values undefined (update chart)');
    return {};
  }

  let start;
  let end;
  let min;
  let max;

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
    end,
  };
}

function intersects(x1, x2, x3, x4) {
  return x2 > x3 && x1 < x4;
}

function boundingRects(vm) {
  const half = vm.height / 2;
  const left = Math.min(vm.x, vm.base);
  const right = Math.max(vm.x, vm.base);
  const top = vm.y - half;
  const bottom = vm.y + half;
  return {
    x: left,
    y: top,
    w: right - left,
    h: bottom - top,
  };
}

export function hhmmss(value, fixedDigits) {
  const h = (value / 3600) | 0;
  const m = ((value / 60) | 0) % 60;
  const s = value % 60;
  return `${h}:${pad(m, 2)}:${pad(
    s.toFixed(fixedDigits),
    fixedDigits ? fixedDigits + 3 : 2
  )}`.replace(/^(?:0+:?)*(\d.*?)(?:\.0*)?$/, '$1');
}

function pad(str, length) {
  str = '' + str;
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}
