/**
 * Fetch based loader
 * timeout / abort / onprogress not supported for now
 * timeout / abort : some ideas here : https://github.com/whatwg/fetch/issues/20#issuecomment-196113354
 * but still it is not bullet proof as it fails to avoid data waste....
*/

const { Request, Headers, fetch, performance } = window;

class FetchLoader {
  constructor (config) {
    this.fetchSetup = config.fetchSetup;
  }

  destroy () {}

  abort () {}

  load (context, config, callbacks) {
    let stats = {
      trequest: performance.now(),
      retry: 0
    };

    let targetURL = context.url;
    let request;

    const initParams = {
      method: 'GET',
      mode: 'cors',
      credentials: 'same-origin'
    };

    const headersObj = {};

    if (context.rangeEnd) {
      headersObj['Range'] = 'bytes=' + context.rangeStart + '-' + String(context.rangeEnd - 1);
    } /* jshint ignore:line */

    initParams.headers = new Headers(headersObj);

    if (this.fetchSetup) {
      request = this.fetchSetup(context, initParams);
    } else {
      request = new Request(context.url, initParams);
    }

    let fetchPromise = fetch(request, initParams);

    // process fetchPromise
    let responsePromise = fetchPromise.then(function (response) {
      if (response.ok) {
        stats.tfirst = Math.max(stats.trequest, performance.now());
        targetURL = response.url;
        if (context.responseType === 'arraybuffer') {
          return response.arrayBuffer();
        } else {
          return response.text();
        }
      } else {
        callbacks.onError({ text: 'fetch, bad network response' }, context);
      }
    }).catch(function (error) {
      callbacks.onError({ text: error.message }, context);
    });
    // process response Promise
    responsePromise.then(function (responseData) {
      if (responseData) {
        stats.tload = Math.max(stats.tfirst, performance.now());
        let len;
        if (typeof responseData === 'string') {
          len = responseData.length;
        } else {
          len = responseData.byteLength;
        }

        stats.loaded = stats.total = len;
        let response = { url: targetURL, data: responseData };
        callbacks.onSuccess(response, stats, context);
      }
    });
  }
}

export default FetchLoader;
