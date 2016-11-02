/**
 * HTTP Loader
 * select best loader depending on browser capabilities
 * FetchLoader if fetch supported
 * XhrLoader otherwise
 */

import XhrLoader from './xhr-loader';
import FetchLoader from './fetch-loader';

class HTTPLoader {

  constructor(config) {
    if (!HTTPLoader._loaderClass) {
      HTTPLoader._selectLoader();
    }
    return new HTTPLoader._loaderClass(config);
  }

  static _selectLoader() {
    if (FetchLoader.isSupported()) {
        HTTPLoader._loaderClass = FetchLoader;
    } else {
        HTTPLoader._loaderClass = XhrLoader;
    }
  }
}
export default HTTPLoader;
