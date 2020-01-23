import ace from '../libs/ace';
import '../libs/theme-github';
import '../libs/mode-json';
import { searchParams } from './search-params';
import { Storage } from './local-storage';
import { Player } from './player';

const hlsjsDefaults = {
  debug: true,
  enableWorker: true,
  liveBackBufferLength: 60 * 15
};

export function setup (id: string, player: Player) {
  const persistEditorCheckBox = document.querySelector('#config-persistence') as HTMLInputElement;
  const applyButton = document.querySelector('#config-apply') as HTMLButtonElement;

  const jsonEditor = ace.edit(id);
  jsonEditor.setTheme('ace/theme/github');
  ace.config.setModuleUrl('ace/mode/json_worker', './libs/worker-json.js');
  jsonEditor.session.setMode('ace/mode/json');

  const config = Object.assign({}, hlsjsDefaults);
  const useUrlConfig = !!searchParams.config;
  persistEditorCheckBox.disabled = useUrlConfig;
  if (useUrlConfig) {
    Object.assign(config, searchParams.config);
  } else if (Storage.persistEditor) {
    Object.assign(config, Storage.config);
  }

  player.setConfig(config);

  const json = JSON.stringify(config, null, 2);
  jsonEditor.session.setValue(json);

  persistEditorCheckBox.checked = Storage.persistEditor && !useUrlConfig;
  persistEditorCheckBox.onchange = function () {
    const checked = Storage.persistEditor = persistEditorCheckBox.checked;
    if (checked) {
      Storage.config = jsonEditor.session.getValue();
    } else {
      Storage.removePersistEditor();
    }
  };

  const applyConfig = function () {
    try {
      const configString = jsonEditor.session.getValue();
      const config = JSON.parse(configString);
      if (Storage.persistEditor) {
        Storage.config = config;
      }
      player.setConfig(config);
    } catch (error) {
      console.warn(error);
    }
  };

  applyButton.onclick = applyConfig;

  jsonEditor.commands.addCommand({
    name: 'Run',
    exec: applyConfig,
    bindKey: {
      mac: 'cmd-enter',
      win: 'ctrl-enter'
    }
  });

  jsonEditor.once('change', function () {
    persistEditorCheckBox.disabled = false;
    persistEditorCheckBox.checked = Storage.persistEditor;
  });

  return jsonEditor;
}
