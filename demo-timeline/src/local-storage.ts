const PERSIST_EDITOR = 'hlsjs:config-editor-persist';
const HLSJS_CONFIG = 'hlsjs:config';

export class Storage {
  static get persistEditor () {
    return JSON.parse(localStorage.getItem(PERSIST_EDITOR)) === true;
  }

  static set persistEditor (value) {
    localStorage.setItem(PERSIST_EDITOR, JSON.stringify(value));
  }

  static removePersistEditor () {
    localStorage.removeItem(PERSIST_EDITOR);
  }

  static get config () {
    const value = localStorage.getItem(HLSJS_CONFIG);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        return parsed;
      } catch (error) {
        console.warn('[getPersistedHlsConfig] could not hls config json', error);
      }
    }
    return value;
  }

  static set config (value) {
    if (typeof value === 'string') {
      localStorage.setItem(HLSJS_CONFIG, value);
    } else {
      localStorage.setItem(HLSJS_CONFIG, JSON.stringify(value));
    }
  }
}
