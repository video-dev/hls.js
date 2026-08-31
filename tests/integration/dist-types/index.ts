import Hls from 'hls.js';

import type {
  CMCDControllerConfig,
  CmcdCustomData,
  CmcdCustomReporter,
} from 'hls.js';

// @svta/cml-cmcd: CmcdKey, CmcdVersion, CmcdEventReportConfig
const cmcd: CMCDControllerConfig = {
  sessionId: 'a2e4b1c0-0000-4000-8000-000000000000',
  contentId: 'content-8006',
  includeKeys: ['br', 'bl', 'sid', 'ot'],
  version: 2,
  eventTargets: [
    {
      url: 'https://example.com/cmcd',
      version: 2,
      events: ['ps', 'e'],
      interval: 10,
      batchSize: 1,
      includeKeys: ['br', 'ts'],
    },
  ],
  loader: (request) => Promise.resolve({ status: 204 }),
  reporterCallback: (reporter: CmcdCustomReporter) => {
    // @svta/cml-cmcd: CmcdCustomKey (template literal index signature), CmcdCustomValue
    const customData: CmcdCustomData = {
      'com.example-appId': 'demo',
      'com.example-startupTime': 1234,
      'com.example-live': true,
    };
    reporter.updateCustomData(customData);
    reporter.recordCustomEvent('startup', customData);
  },
};

const hls = new Hls({ cmcd, debug: false });

hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
  console.log(event, data.levels.length, hls.currentLevel);
});

export default hls;
