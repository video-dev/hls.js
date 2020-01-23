import { setup as setupJsonEditor } from './config-editor';
import { setup as setupDemoControls } from './demo-controls';
import { setup as setupTimelineChart } from './timeline-chart';

declare global {
  interface Window {
    Hls: any;
    hls: any;
  }
}

function initDemo () {
  setupJsonEditor('config-editor');
  setupTimelineChart();
  setupDemoControls();
}

self.addEventListener('DOMContentLoaded', initDemo);
