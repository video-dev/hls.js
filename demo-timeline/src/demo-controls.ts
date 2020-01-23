import testStreams from '../../tests/test-streams';
import { searchParams } from './search-params';
import { updateStreamUrl, updateVideoWidth } from './player';

export function setup () {
  setupStreamSelectAndInput();
  setupVideoSize();
}

function setupStreamSelectAndInput () {
  const streamSelect = document.querySelector('#streamSelect') as HTMLSelectElement;
  const streamInput = document.querySelector('#streamURL') as HTMLInputElement;

  streamInput.value = searchParams.src;
  updateStreamUrl(streamInput.value);

  Object.keys(testStreams).forEach((key) => {
    const stream = testStreams[key];
    const option = new Option(stream.description, key);
    if (stream.url === searchParams.src) {
      option.selected = true;
    }
    streamSelect.appendChild(option);
  });

  streamSelect.oninput = function () {
    const selected = testStreams[streamSelect.value];
    if (!selected) {
      return;
    }
    streamInput.value = selected.url;
    updateStreamUrl(streamInput.value);
  };

  streamInput.oninput = function () {
    updateStreamUrl(streamInput.value);
  };
}

function setupVideoSize () {
  const video = document.querySelector('#video') as HTMLMediaElement;
  const videoSize = document.querySelector('#videoSize') as HTMLSelectElement;

  video.style.width = searchParams.width;
  const foundWidth = [].slice.call(videoSize.querySelectorAll('option')).some((option: HTMLOptionElement) => {
    if (option.value === searchParams.width) {
      option.selected = true;
    }
  });
  if (!foundWidth) {
    videoSize.querySelector('option').textContent = `Custom (${searchParams.width})`;
  }
  videoSize.oninput = function () {
    video.style.width = videoSize.value;
    updateVideoWidth(videoSize.value);
  };
}
