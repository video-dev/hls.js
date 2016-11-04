/**
 * Fetch based logger
 * timeout / abort / onprogress not supported for now
 * timeout / abort : some ideas here : https://github.com/whatwg/fetch/issues/20#issuecomment-196113354
 * but still it is not bullet proof as it fails to avoid data waste....
*/

class FetchLoader {


  static isSupported() {
    try {
        // fetch + stream is broken on Microsoft Edge. Disable for now.
        // see https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8196907/
        return (window.fetch && window.ReadableStream && navigator.userAgent.toLowerCase().indexOf('edge') === -1);
      } catch (e) {
        return false;
      }
    }

  constructor(config) {
    this.fetchSetup = config.fetchSetup;
  }

  destroy() {
  }

  abort() {
    this._requestAbort = true;
  }


  load(context, config, callbacks) {
    let stats = this.stats = {trequest: performance.now(), retry: 0, loaded : 0}, request,
        initParams = { method: 'GET',
                       mode: 'cors',
                       credentials: 'same-origin'
                     };
    this.context = context;
    this.callbacks = callbacks;
    this.targetURL = context.url;

    if (context.rangeEnd) {
      initParams.headers = new Headers({ 'Range' :  'bytes=' + context.rangeStart + '-' + (context.rangeEnd-1)});
    }

    if (this.fetchSetup) {
      request = this.fetchSetup(context,initParams);
    } else {
      request = new Request(context.url,initParams);
    }

    let fetchPromise = fetch(request,initParams);

    // process fetchPromise
    let responsePromise = fetchPromise.then(function(response) {
      if (!this._requestAbort && response.ok) {
        stats.tfirst = Math.max(stats.trequest,performance.now());
        this.targetURL = response.url;
        if (context.progressData && callbacks.onProgress) {
          this._pump.call(this, response.body.getReader());
        } else {
          if (context.responseType === 'arraybuffer') {
            return response.arrayBuffer();
          } else {
            return response.text();
          }
        }
      } else {
        callbacks.onError({text : 'fetch, bad network response'}, context);
        return;
      }
    }.bind(this)).catch(function(error) {
      callbacks.onError({text : error.message}, context);
      return;
    });
    // process response Promise
    if (!this._requestAbort && responsePromise) {
      responsePromise.then(function(responseData) {
        if (responseData && !this._requestAbort) {
          stats.tload = Math.max(stats.tfirst,performance.now());
          let len;
          if (typeof responseData === 'string') {
            len = responseData.length;
          } else {
            len = responseData.byteLength;
          }
          stats.loaded = stats.total = len;
          let response = { url : this.targetURL, data : responseData};
          callbacks.onSuccess(response,stats,context);
        }
      }.bind(this));
    }
  }

  _pump(reader) {  // ReadableStreamReader
    if(!this._requestAbort) {
      reader.read().then(
        ({ value, done }) => {
          let callbacks = this.callbacks,
              stats = this.stats,
              context = this.context;
          if (done) {
            stats.total = stats.loaded;
            stats.tload = Math.max(stats.tfirst,performance.now());
            callbacks.onSuccess({url :this.targetURL},stats,context);
          } else {
            stats.loaded += value.length;
            callbacks.onProgress(stats, this.context, value);
            return this._pump(reader);
          }
        }
      );
    }
  }
}
export default FetchLoader;
