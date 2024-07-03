import { defaultConfig } from './config-default';
import { getConfig, iife } from './config-editor';
import { hlsJsEvents } from './events-providers';
import {
  attachListenersToVideoElements,
  resetVideoElements,
} from './events-video';
import { storage } from './local-storage';
import { stringify } from './stringify';
import type { InterstitialAssetPlayerCreatedData } from '../../../src/types/events';
import type { HlsConfig } from '../../../src/config';
import type Hls from '../../../src/hls';

declare global {
  interface Window {
    hls: Hls;
  }
}

type LogGroup = {
  mode: string;
  eventGroup: string;
  event: string;
  lastEventGroup?: string;
  lastUiEvent?: string | null;
  lastVideoEvent?: string | null;
  container: HTMLDivElement;
  eventElement: HTMLDivElementForEvent;
  preVideo?: HTMLDivElementForEvent;
  preUi?: HTMLDivElementForEvent;
  pre?: HTMLDivElementForEvent;
};
type HTMLDivElementForEvent = HTMLDivElement & {
  expanded: boolean;
};

const ace = window.ace;
const history = window.history || {};
const searchOptions = new window.URL(location.href).searchParams;
const eventLogGroups: Record<string, LogGroup> = {};
let eventFlow = 'down';
let sequenceCount = 0;
let filterEventElement = (element: HTMLElement) => {};

function getAndSaveConfig(editor) {
  return getConfig(editor).then((config) => {
    const configToSave = editor
      .getValue()
      .replace(/("|')\.\.\/\.\.\/\.\.\/bin-/g, '$1../bin-');
    if (configToSave && configToSave !== storage.hlsjsEventsConfig) {
      storage.hlsjsEventsConfig = configToSave;
    }
    return config;
  });
}

function getEventGroup(eventName: string) {
  //   for (const key in events) {
  //     if (events[key].indexOf(eventName) > -1) {
  //       return key;
  //     }
  //   }
  if (hlsJsEvents.indexOf(eventName as any) > -1) {
    if (
      [
        'hlsInterstitialStarted',
        'hlsInterstitialAssetStarted',
        'hlsInterstitialAssetEnded',
        'hlsInterstitialEnded',
      ].indexOf(eventName as any) > -1
    ) {
      return 'adBreak'; // 'hlsjs'
    }
    if (['hlsInterstitialsPrimaryResumed'].indexOf(eventName as any) > -1) {
      return 'playback'; // 'hlsjs'
    }
    if (
      [
        'hlsMediaAttaching',
        'hlsMediaAttached',
        'hlsMediaDetaching',
        'hlsMediaDetached',

        'hlsInterstitialsBufferedToBoundary',
        'hlsBackBufferReached',

        'hlsFragLoading',
        'hlsFragLoaded',

        'hlsFragParsingInitSegment',
        'hlsFragParsingUserdata',
        'hlsLevelPtsUpdated',
        'hlsFragParsed',

        'hlsBufferAppending',
        'hlsBufferAppended',
        'hlsFragBuffered',

        'hlsAudioTrackSwitched',
        'hlsBufferCodecs',
      ].indexOf(eventName as any) > -1
    ) {
      return 'media'; // 'hlsjs'
    }

    return 'provider'; // 'hlsjs'
  }
  return 'unknown';
}

function getPlaybackMode(eventGroup, currentMode) {
  if (eventGroup === 'playback' || eventGroup === 'media') {
    return 'player';
  }
  if (eventGroup === 'adBreak') {
    return 'ads';
  }
  return currentMode;
}

function padStart(str, content, length) {
  if (str.length >= length) {
    return content;
  }
  return new Array(1 + length - str.length).join(' ') + content;
}

function createEventSequenceElement(inMode): HTMLDivElementForEvent {
  const element = document.createElement('div') as HTMLDivElementForEvent;
  element.classList.add('sequence', `mode-${inMode}`);
  element.setAttribute('data-sequence', `${sequenceCount++}`);
  return element;
}

function appendSequenceElement(container, element) {
  const firstSequenceElement = container.querySelector('.sequence');
  if (eventFlow === 'down' || !firstSequenceElement) {
    container.appendChild(element);
  } else {
    container.insertBefore(element, firstSequenceElement);
  }
}

function appendData(
  div: HTMLDivElement,
  inEvent: string,
  group: string,
  data: object | undefined
) {
  if (!data) {
    return;
  }
  if (
    // group === 'adRequest' ||
    // group === 'adBreak' ||
    // inEvent === 'time' ||
    // inEvent === 'meta' ||
    // inEvent === 'metadataCueParsed' ||
    group === 'provider' //||
    // inEvent === 'hlsBufferAppending' ||
    // inEvent === 'hlsBufferAppended'
  ) {
    const pre = document.createElement('pre');
    pre.classList.add('group-quickPeek');
    const quickPeekProps = [
      'currentTime',
      'metadataType',
      'adBreakId',
      'adPlayId',
      'frag.sn',
    ].reduce((obj, prop) => {
      if (prop === 'frag.sn' && ('frag' in data || 'parent' in data)) {
        // Uncomment to see if event is from "main" playlist or alt "audio" track
        // obj.parent = data.parent;
        if ('frag' in data) {
          (obj as any).sn = (data.frag as any).sn;
        }
        (obj as any).type = (data as any).type;
      } else if (prop in data) {
        obj[prop] = data[prop];
      }
      return obj;
    }, {});
    if (Object.keys(quickPeekProps).length) {
      pre.textContent = padStart(
        inEvent,
        JSON.stringify(quickPeekProps, null, 0),
        20
      );
      div.appendChild(pre);
    }
  }
}

function appendEvent(
  container: HTMLDivElement,
  inEvent: string,
  inEventGroup: string,
  mode: string,
  data?: object | undefined
): HTMLDivElementForEvent {
  const div = document.createElement('div') as HTMLDivElementForEvent;
  div.classList.add('group-' + inEventGroup, 'event-' + inEvent, 'pre');
  div.textContent = textContentGrouped(inEvent);
  appendData(div, inEvent, inEventGroup, data);
  div.setAttribute('title', `${mode} ${inEventGroup} event "${inEvent}"`);
  div.setAttribute('tabindex', '0');
  const clicked = (e?: Event): object[] | undefined => {
    if (e && 'keyCode' in e && e.keyCode !== 13) {
      return;
    }
    console.log(inEvent, data);
    if (!data) {
      return;
    }
    div.textContent = (div.expanded = !div.expanded)
      ? textContentExpanded(inEvent, [data])
      : textContentGrouped(inEvent);
    if (e) {
      e.preventDefault();
    }
    return [data];
  };
  div.onclick = div.onkeyup = clicked;
  filterEventElement(div);
  container.appendChild(div);
  if (inEvent === 'javascriptError') {
    div.setAttribute('title', div.textContent);
    clicked();
  }
  return div;
}

function incrementEvent(
  group: LogGroup,
  inEvent: string,
  inEventGroup: string,
  div: HTMLDivElementForEvent,
  data: object | undefined
) {
  group[inEvent]++;
  div.textContent = textContentGrouped(inEvent, group);
  appendData(div, div.textContent, inEventGroup, data);
  const logPreviousEvents: typeof clicked | null = div.onclick;
  const clicked = (e?: Event): object[] | undefined => {
    if (e && 'keyCode' in e && e.keyCode !== 13) {
      return;
    }
    console.log(inEvent, data);
    if (!data || logPreviousEvents === null) {
      return;
    }
    const allData = logPreviousEvents();
    if (!allData) {
      return;
    }
    allData.push(data);
    div.textContent = div.expanded
      ? textContentExpanded(inEvent, allData)
      : textContentGrouped(inEvent, group);
    if (e) {
      e.preventDefault();
    }
    return allData;
  };
  div.onclick = div.onkeyup = clicked;
  if (inEvent === 'javascriptError' && !div.expanded) {
    clicked();
  }
}

function textContentGrouped(inEvent: string, group?) {
  if (group) {
    return `${inEvent} (${group[inEvent]})`;
  }
  return inEvent;
}

function textContentExpanded(inEvent, allData) {
  return `${inEvent} (${allData
    .map(
      (item, i) =>
        (allData.length > 1 ? `[${i}] = ` : '') + stringify(item, null, 4)
    )
    .join('\n')})`;
}

function getPageEventsLoggerListeners() {
  const logContainer = document.querySelector('#event-log') as HTMLDivElement;
  let inEventGroup = '';
  let inMode = 'player';
  let inEvent = '';
  let lastEvent = '';
  let lastMode = 'player';
  let lastGroup: LogGroup | undefined;

  const genericEventHandler = function (
    e: object | undefined,
    type: string,
    eventGroup: string
  ) {
    inEventGroup = eventGroup;
    inMode = getPlaybackMode(eventGroup, lastMode);
    inEvent = type;

    performance.mark(inMode);
    performance.mark(inEvent);
    if (lastEvent && lastEvent !== inEvent) {
      performance.measure(lastEvent, lastEvent, inEvent);
    }
    let group = eventLogGroups[inMode];
    if (!group || group !== lastGroup) {
      const beforeReadyElement = createEventSequenceElement(inMode);
      appendSequenceElement(logContainer, beforeReadyElement);
      group = eventLogGroups[inMode] = {
        mode: inMode,
        eventGroup: inEventGroup,
        event: inEvent,
        container: logContainer,
        eventElement: beforeReadyElement,
      };
      lastGroup = lastGroup || group;
    }
    if (
      inEventGroup === 'globalUi' ||
      inEventGroup === 'related' ||
      inEventGroup === 'ping'
    ) {
      if (group.lastUiEvent === inEvent && group.preUi) {
        incrementEvent(group, inEvent, inEventGroup, group.preUi, e);
      } else {
        group[inEvent] = 1;
        group.lastUiEvent = inEvent;
        group.preUi = appendEvent(
          group.eventElement,
          inEvent,
          inEventGroup,
          inMode,
          e
        );
      }
      return;
    }
    if (inEventGroup === 'video') {
      if (/>(?:timeupdate|seeking)$/.test(inEvent)) {
        if (group.lastVideoEvent === inEvent && group.preVideo) {
          incrementEvent(group, inEvent, inEventGroup, group.preVideo, e);
        } else {
          const eventElement = createEventSequenceElement(inMode);
          group[inEvent] = 1;
          group.eventElement = eventElement;
          group.lastVideoEvent = inEvent;
          group.preVideo = appendEvent(
            group.eventElement,
            inEvent,
            inEventGroup,
            inMode,
            e
          );
          appendSequenceElement(group.container, eventElement);
        }
        return;
      }
      group.lastVideoEvent = null;
    }
    if (
      lastEvent === inEvent &&
      !/^(?:meta|hlsBufferAppend)/.test(inEvent) &&
      group.pre
    ) {
      incrementEvent(group, inEvent, inEventGroup, group.pre, e);
    } else {
      const eventElement = createEventSequenceElement(inMode);
      group[inEvent] = 1;
      group.eventElement = eventElement;
      group.lastEventGroup = inEventGroup;
      group.pre = appendEvent(eventElement, inEvent, inEventGroup, inMode, e);
      appendSequenceElement(group.container, eventElement);
    }
    lastEvent = inEvent;
    lastMode = inMode;
    lastGroup = group;
    group.lastUiEvent = null;
  };
  const firstEventHander = function (type: string, e?: object) {
    genericEventHandler(e, type, getEventGroup(type));
  };
  function errorToJSONPolyfill() {
    if (!('toJSON' in Error.prototype)) {
      Object.defineProperty(Error.prototype, 'toJSON', {
        value: function () {
          return { message: this.message };
        },
        configurable: true,
        writable: true,
      });
    }
  }
  window.addEventListener('error', function (event) {
    errorToJSONPolyfill();
    firstEventHander('javascriptError', {
      type: 'javascriptError',
      error: event.error,
      event: event,
    });
  });
  window.addEventListener('unhandledrejection', function (event) {
    errorToJSONPolyfill();
    firstEventHander('unhandledPromiseRejection', {
      type: 'unhandledPromiseRejection',
      error: (event as any).error || event.reason,
      event: event,
    });
  });
  setupButton(
    document.querySelector('#clear-events') as HTMLButtonElement,
    () => {
      if (logContainer === null) {
        console.assert(logContainer !== null, 'logContainer is not null');
        return;
      }
      Array.prototype.slice
        .call(logContainer.querySelectorAll('div'))
        .forEach((element) => {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
        });
    }
  );
  setupButton(
    document.querySelector('#event-flow-direction') as HTMLButtonElement,
    function (this: HTMLButtonElement) {
      eventFlow = eventFlow === 'down' ? 'up' : 'down';
      const dir = eventFlow === 'down' ? -1 : 1;
      const elements = document.querySelectorAll('.sequence');
      const sorted = [].slice.call(elements).sort((a, b) => {
        return (
          dir *
          (parseInt(b.getAttribute('data-sequence')) -
            parseInt(a.getAttribute('data-sequence')))
        );
      });
      const temp = document.createDocumentFragment();
      sorted.forEach((el) => temp.appendChild(el));
      document.querySelector('#event-log')?.appendChild(temp);
      this.innerHTML = { down: '&#x23EC;', up: '&#x23EB;' }[
        eventFlow
      ] as string;
    }
  );

  return hlsJsEvents.reduce(
    (val, key) => {
      val[key] = firstEventHander;
      return val;
    },
    Object.create({
      genericEventHandler: genericEventHandler,
    })
  );
}

function runSetup(editor) {
  getConfig(editor)
    .then(resize)
    .then((config) => {
      // Version new setup configs in storage and setup
      const setupConfig = editor.getValue();
      if (storage.setupConfig !== setupConfig) {
        storage.setupConfig = setupConfig;
      }
      setup(config);
    })
    .catch((error) => {
      console.warn(
        'Error parsing config. Falling back to default setup.',
        error
      );
      if (window.hls) {
        window.hls.destroy();
      }
    });
}

function resize(config) {
  const width = config.width || 640;
  document.body.style.minWidth = /%$/.test(width) ? '' : `${width}px`;
  return config;
}

function setup(config: HlsConfig) {
  const eventLoggerHandlers = getPageEventsLoggerListeners();

  const genericEventHandler = eventLoggerHandlers.genericEventHandler;

  resetVideoElements();

  genericEventHandler(
    {
      userAgent: window.navigator.userAgent,
    },
    'info:environment',
    getEventGroup('info:environment')
  );

  const hls = new ((window as any).Hls as typeof Hls)(config);
  window.hls = hls;
  hlsJsEvents.forEach((eventName) => {
    hls.on(eventName, function (type: string, e: any) {
      const handler = eventLoggerHandlers[type];
      if (!handler) {
        console.error(`Event "${type}" not defined in events list.`, e);
        // Run 'firstEventHander' on this event to add it to the log
        const firstEventHander = eventLoggerHandlers.hlsError;
        firstEventHander(type, e);
      } else {
        handler.call(hls, type, e);
      }
    });
  });
  hls.on(
    ((window as any).Hls as typeof Hls).Events
      .INTERSTITIAL_ASSET_PLAYER_CREATED,
    function (type: string, data: InterstitialAssetPlayerCreatedData) {
      const childPlayer = data.player;
      if (childPlayer) {
        const callback = function (type: string, e: any) {
          genericEventHandler(e, `${childPlayer.assetId}-${type}`, 'adBreak');
        };
        hlsJsEvents.forEach((eventName) => {
          childPlayer.on(eventName, callback);
        });
        childPlayer.on(
          ((window as any).Hls as typeof Hls).Events.DESTROYING,
          () => {
            hlsJsEvents.forEach((eventName) => {
              childPlayer.off(eventName, callback);
            });
          }
        );
      }
    }
  );
  (document.querySelector('.group-provider') as HTMLPreElement).textContent =
    'hlsjs';

  const container = document.getElementById('player') as HTMLDivElement;
  const video = document.createElement('video');
  video.controls = true;
  video.style.width = '100%';
  container.appendChild(video);

  attachListenersToVideoElements(genericEventHandler);

  hls.attachMedia(video);
  hls.loadSource(
    searchOptions.get('src') ||
      '//localhost/adaptive/meridian/index-interstitials.m3u8'
  );
}

function getConfigForEditor(configJs) {
  return (configJs || JSON.stringify(defaultConfig, null, 4)).replace(
    /("|')(\.\.\/)+bin-/g,
    '$1../../../bin-'
  );
}

interface ExpandableEditor extends AceAjax.Editor {
  pinned: boolean;
  expand: () => void;
  contract: () => void;
}

function setupEditor(savedConfig) {
  const configInput = document.querySelector(
    '#player-config'
  ) as HTMLInputElement;
  configInput.value = getConfigForEditor(savedConfig);
  const editor = ace.edit(configInput) as ExpandableEditor;
  editor.getSession().setMode('ace/mode/javascript');
  editor.setTheme('ace/theme/twilight');
  const options = {
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: false,
    maxLines: 1,
  };
  editor.setOptions(options);
  editor.expand = function () {
    console.assert(
      !!(editor as any).getFontSize,
      'getFontSize does not exist on Editor'
    );
    const lineHeight = (editor as any).getFontSize?.() + 5;
    const availableHeight =
      (document.documentElement.clientHeight, window.innerHeight || 0) - 100;
    options.maxLines = Math.min(
      Math.max(5, Math.floor(availableHeight / lineHeight)),
      150
    );
    editor.setOptions(options);
    editor.focus();
  };
  editor.contract = function () {
    options.maxLines = 1;
    editor.setOptions(options);
  };
  let focusTimeout;
  let saveTimeout;

  function changeCallback() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(function () {
      getAndSaveConfig(editor)
        .then(() => {
          // If the change is valid clear any config params in the url and save
          if (history.pushState && searchOptions.get('config')) {
            history.pushState(
              editor.getValue(),
              '',
              `${location.origin}${location.pathname}`
            );
          }
        })
        .catch(function () {
          /* noop */
        });
    }, 500);
  }
  editor.on('focus', function () {
    // Save the config when it's changed (in focus)
    editor.off('change', changeCallback);
    editor.on('change', changeCallback);
    clearTimeout(focusTimeout);
    focusTimeout = setTimeout(editor.expand);
  });
  editor.on('blur', function () {
    editor.off('change', changeCallback);
    clearTimeout(focusTimeout);
    if (editor.pinned) {
      return;
    }
    focusTimeout = setTimeout(editor.contract, 250);
  });
  editor.commands.addCommand({
    name: 'Run',
    exec: runSetup,
    bindKey: {
      mac: 'cmd-enter',
      win: 'ctrl-enter',
    },
  });
  // When navigating, setup the player according to the current location.search params or local storage
  window.onpopstate = function () {
    // getPlayerConfig(storage.setupConfig || storage.hlsjsEventsConfig).then(
    //   (configText) => {
    //     editor.setValue(configText);
    //     clearTimeout(saveTimeout);
    //     runSetup(editor);
    //   },
    // );
  };

  return editor;
}

function setupControls(editor) {
  const controls = document.querySelector('#config-controls') as HTMLDivElement;
  controls.onclick = function (event: Event) {
    if (event.target === controls) {
      editor.expand();
    }
  };
  setupSetup(document.querySelector('#setup'), editor);
  setupConfigNav(
    document.querySelector('#setup-prev'),
    document.querySelector('#setup-next'),
    editor
  );
  setupPin(document.querySelector('#pin-config'), editor);
  setupCopy(document.querySelector('#copy-config'), editor);
  setupPermalink(document.querySelector('#permalink-config'), editor);
  setupDownload(document.querySelector('#download-config'), editor);
}

function setupSetup(button, editor) {
  button.onclick = function () {
    runSetup(editor);
  };
}

function setupConfigNav(buttonPrev, buttonNext, editor) {
  storage.setupUpdated = (version) => {
    buttonPrev.disabled =
      !version || version === 1 || !storage.getSetupVersion(version - 1);
    buttonNext.disabled = !storage.getSetupVersion((version || 0) + 1);
  };
  const changeSetupVersion = function (version: number) {
    const setupConfig = storage.getSetupVersion(version);
    if (setupConfig) {
      storage.setupVersion = version;
    }
    if (storage.setupUpdated) {
      storage.setupUpdated(version);
    }
    editor.setValue(setupConfig);
    editor.clearSelection();
    // getConfig(editor).then(setup);
  };
  buttonPrev.onclick = function () {
    changeSetupVersion((storage.setupVersion || 0) - 1);
  };
  buttonNext.onclick = function () {
    changeSetupVersion((storage.setupVersion || 0) + 1);
  };
  storage.setupUpdated(storage.setupVersion);
}

function setupPin(button, editor: ExpandableEditor) {
  storage.defineProperty('pinConfig', true);
  const updatePin = function () {
    button.classList.toggle('disabled', !editor.pinned);
    if (editor.pinned) {
      editor.expand();
    } else {
      editor.contract();
    }
  };
  button.onclick = function () {
    editor.pinned = storage.pinConfig = !editor.pinned;
    updatePin();
  };
  editor.pinned = !!storage.pinConfig;
  updatePin();
}

function setupDownload(button, editor) {
  button.onclick = function () {
    const config = editor.getValue();
    const nameMatch = config.match(/(\w+)\s*=/);
    button.setAttribute(
      'download',
      (nameMatch ? nameMatch[1] : 'config') + '.js'
    );
    button.setAttribute(
      'href',
      'data:application/xml;charset=utf-8,' + iife(config)
    );
  };
}

function setupCopy(button, editor) {
  button.onclick = function () {
    // copy to clipboard
    const textarea = document.createElement('textarea');
    textarea.value = editor.getValue();
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };
}

function setupPermalink(button, editor) {
  button.onclick = function () {
    const base64Config = encodeURIComponent(
      `data:text/plain;base64,${btoa(editor.getValue())}`
    );
    history.pushState(
      null,
      '',
      `${location.origin}${location.pathname}?config=${base64Config}`
    );
  };
}

function setupButton(button: HTMLButtonElement, callback: (e?: Event) => void) {
  button.onclick = callback;
}

function updateToggle(element, groupClass, enabled) {
  element.classList.toggle('disabled', !enabled);
  (document.querySelector('#event-log') as HTMLDivElement).classList.toggle(
    groupClass + '-disabled',
    !enabled
  );
}

function setupLogFilters() {
  Array.prototype.slice
    .call(document.querySelectorAll('#group-toggles .toggle'))
    .forEach((element) => {
      const groupClass = element.className.replace(
        /^.*\b(group-\w+)\b.*$/,
        '$1'
      );
      const toggleName = groupClass + '-toggle';
      storage.defineProperty(toggleName);
      let enabled = storage[toggleName];
      enabled =
        enabled === null
          ? !element.classList.contains('disabled')
          : JSON.parse(enabled);
      updateToggle(element, groupClass, enabled);
      element.onclick = function () {
        enabled = storage[toggleName] = !enabled;
        updateToggle(element, groupClass, enabled);
      };
    });

  let filterTimeout = -1;
  const inputFilterField = document.querySelector(
    '#input-filter'
  ) as HTMLInputElement;
  const updateFilter = (derp: string) => {
    const filter = (function (textInput) {
      storage.eventsFilter = textInput;
      inputFilterField.setCustomValidity('');
      const regexParts = /^\/(.+)\/(g?i?m?s?u?y?)$/.exec(textInput);
      if (regexParts) {
        try {
          const regex = new RegExp(regexParts[1], regexParts[2]);
          return (input: string | null) => input !== null && regex.test(input);
        } catch (error) {
          /* Invalid Regular Expression */
          inputFilterField.setCustomValidity('Invalid Regular Expression');
          return () => true;
        }
      }
      return (input) =>
        !textInput || input.toLowerCase().indexOf(textInput.toLowerCase()) > -1;
    })(inputFilterField.value);
    filterEventElement = (element) => {
      element.classList.toggle(
        'filter-not-matched',
        !filter(element.textContent)
      );
    };
    Array.prototype.slice
      .call(document.querySelectorAll('.sequence > .pre'))
      .forEach(filterEventElement);
  };
  if (storage.eventsFilter) {
    inputFilterField.value = storage.eventsFilter;
    updateFilter(storage.eventsFilter);
  }
  inputFilterField.addEventListener('keyup', function () {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(updateFilter) as unknown as number;
  });
}

// const editorPromise = getPlayerConfig(storage.hlsjsEventsConfig)
//   .then((configText) => {
//     return setupEditor(configText);
//   })
//   .catch(function (error) {
//     console.error('Error loading js config', error);
//     return setupEditor(storage.hlsjsEventsConfig);
//   });

const editorPromise = Promise.resolve().then(() => {
  return setupEditor(storage.hlsjsEventsConfig);
});
editorPromise.then((editor) => {
  runSetup(editor);
  setupControls(editor);
});

setupLogFilters();
