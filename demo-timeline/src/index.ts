import { Player } from './player';
import { TimelineChart } from './timeline-chart';
import { setup as setupJsonEditor } from './config-editor';
import { setup as setupDemoControls } from './demo-controls';

declare global {
  interface Window {
    Hls: any;
    hls: any;
  }
}

function initDemo () {
  const canvas = document.querySelector('#timeline-chart') as HTMLCanvasElement;
  const timelineChart = new TimelineChart(canvas, {
    responsive: false
  });
  const player = new Player(timelineChart);

  // Chart.js responsive feature adds elements to the page for dealing with complex layouts
  // Since we're using 100% of the page width we can do this a lot cheaper
  setupCheapResponsiveListeners(timelineChart);

  setupJsonEditor('config-editor', player);
  setupDemoControls(player);
}

function setupCheapResponsiveListeners (chart) {
  self.onresize = () => chart.resize();
  if (self.screen?.orientation) {
    self.screen.orientation.addEventListener('change', self.onresize);
  }
  chart.resize();
}

self.addEventListener('DOMContentLoaded', initDemo);
