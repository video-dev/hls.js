const localStorage = window.localStorage || {};

export const NAMESPACE = ''; // /\/headless\.html\b/.test(location.pathname) ? 'headless_' : '';

export const storage: {
  getSetupVersion(version: number): string | null;
  defineProperty(property: string, serialize?: boolean): void;
  setupUpdated?: (version: number | null) => void;
  hlsjsEventsConfig: string | null;
  eventsFilter: string | null;
  setupVersion: number | null;
  setupConfig: object;
  pinConfig?: boolean;
} = Object.create({
  getSetupVersion(version: number) {
    try {
      return localStorage.getItem(`${NAMESPACE}setup_v${version}`);
    } catch (error) {
      return null;
    }
  },

  defineProperty: function (property, serialize) {
    const nsProperty = NAMESPACE + property;
    Object.defineProperty(this, property, {
      get: function () {
        try {
          if (serialize) {
            return JSON.parse(localStorage.getItem(nsProperty) || 'null');
          }
          return localStorage.getItem(nsProperty);
        } catch (error) {
          return null;
        }
      },
      set: function (value) {
        try {
          if (serialize) {
            localStorage.setItem(nsProperty, JSON.stringify(value));
          } else {
            localStorage.setItem(nsProperty, value);
          }
        } catch (error) {
          /* noop */
        }
      },
    });
  },
});

storage.defineProperty('hlsjsEventsConfig');
storage.defineProperty('eventsFilter');
storage.defineProperty('setupVersion', true);

Object.defineProperty(storage, 'setupConfig', {
  get: function () {
    const version = storage.setupVersion;
    if (!version) {
      return null;
    }
    return storage.getSetupVersion(version);
  },
  set: function (value) {
    let version = storage.setupVersion || 0;
    if (isNaN(version)) {
      version = 1;
    }
    try {
      localStorage.setItem(`${NAMESPACE}setup_v${version}`, value);
      localStorage.setupVersion = version;
      localStorage.removeItem(`${NAMESPACE}setup_v${version - 20}`);
      if (storage.setupUpdated) {
        storage.setupUpdated(version);
      }
    } catch (error) {
      console.error(error);
    }
  },
});
