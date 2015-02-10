/*
 * fragment loader
 *
 */

import { logger } from '../utils/logger';
import Stream from '../utils/stream';

class FragmentLoader extends Stream {
    constructor() {
        super();
    }

    load(url) {
        this.url = url;
        this.trequest = Date.now();
        this.tfirst = null;
        var xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.responseType = 'arraybuffer';
        xhr.open('GET', url, true);
        xhr.send();
    }

    loadsuccess(event) {
        this.trigger('stats', {
            trequest: this.trequest,
            tfirst: this.tfirst,
            tend: Date.now(),
            length: event.currentTarget.response.byteLength,
            url: this.url
        });
        this.trigger('data', event.currentTarget.response);
    }

    loaderror(event) {
        logger.log('error loading ' + this.url);
    }

    loadprogress(event) {
        if (this.tfirst === null) {
            this.tfirst = Date.now();
        }
    }
}

export default FragmentLoader;
