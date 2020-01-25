import testStreams from '../../tests/test-streams';
import { searchParams } from './search-params';
import { Player } from './player';

export function setup (player: Player) {
  setupStreamSelectAndInput(player);
  setupVideoSize(player);
}

function setupStreamSelectAndInput (player) {
  const streamSelect = document.querySelector('#streamSelect') as HTMLSelectElement;
  const streamInput = document.querySelector('#streamURL') as HTMLInputElement;

  streamInput.value = searchParams.src;
  player.setUrl(streamInput.value);

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
    player.setUrl(streamInput.value);
  };

  streamInput.oninput = function () {
    player.setUrl(streamInput.value);
  };
}

function setupVideoSize (player) {
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
    player.setWidth(videoSize.value);
  };
  player.setWidth(searchParams.width);
}
