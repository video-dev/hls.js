/**
 * Fetch based logger
 * timeout / abort / onprogress not supported for now
 * timeout / abort : some ideas here : https://github.com/whatwg/fetch/issues/20#issuecomment-196113354
 * but still it is not bullet proof as it fails to avoid data waste.... we could only cancel the
*/

class FetchLoader {

  constructor(config) {
    this.config = config;
  }

  destroy() {
  }

  abort() {
  }

  load(url, context, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay, onProgress = null, frag = null) { // jshint ignore:line

    let stats = {trequest: performance.now(), retry: 0}, targetURL = url;

    let initParams = { method: 'GET',
                       mode: 'cors',
                       credentials: 'same-origin'
                     };

    let request = new Request(url,initParams),
        fetchPromise = fetch(request,initParams);

    // process fetchPromise
    let responsePromise = fetchPromise.then(function(response) {
      stats.tfirst = Math.max(stats.trequest,performance.now());
      targetURL = response.url;
      if (responseType === 'arraybuffer') {
        return response.arrayBuffer();
      } else {
        return response.text();
      }
    });
    // process response Promise
    responsePromise.then(function(responseData) {
      stats.tload = Math.max(stats.tfirst,performance.now());
      let event = { currentTarget : { responseURL : targetURL } };
      if (responseType === 'arraybuffer') {
        event.currentTarget.response = responseData;
      } else {
        event.currentTarget.responseText = responseData;
      }
      onSuccess(event, stats,context);
    });
  }
}
export default FetchLoader;
