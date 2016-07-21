/**
 * Fetch based logger
 * timeout / abort / onprogress not supported for now
 * timeout / abort : some ideas here : https://github.com/whatwg/fetch/issues/20#issuecomment-196113354
 * but still it is not bullet proof as it fails to avoid data waste....
*/

class FetchLoader {

  constructor(config) {
    this.config = config;
  }

  destroy() {
  }

  abort() {
  }


  load(context, config, callbacks) {
    let stats = {trequest: performance.now(), retry: 0}, targetURL = context.url;

    let initParams = { method: 'GET',
                       mode: 'cors',
                       credentials: 'same-origin'
                     };

    if (context.rangeEnd) {
      initParams.headers = new Headers({ 'Range' :  'bytes=' + context.rangeStart + '-' + (context.rangeEnd-1)});
    }

    let request = new Request(context.url,initParams),
        fetchPromise = fetch(request,initParams);

    // process fetchPromise
    let responsePromise = fetchPromise.then(function(response) {
      if (response.ok) {
        stats.tfirst = Math.max(stats.trequest,performance.now());
        targetURL = response.url;
        if (context.responseType === 'arraybuffer') {
          return response.arrayBuffer();
        } else {
          return response.text();
        }
      } else {
        callbacks.onError({text : 'fetch, bad network response'}, context);
        return;
      }
    }).catch(function(error) {
      callbacks.onError({text : error.message}, context);
      return;
    });
    // process response Promise
    responsePromise.then(function(responseData) {
      if (responseData) {
        stats.tload = Math.max(stats.tfirst,performance.now());
        let response = { url : targetURL, data : responseData};
        callbacks.onSuccess(response,stats,context);
      }
    });
  }
}
export default FetchLoader;
