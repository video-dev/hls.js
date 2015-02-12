/*
 * fragment loader
 *
 */

import Event from '../events';
import observer from '../observer';
import { logger } from '../utils/logger';

class FragmentLoader {
    constructor() {}

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
        observer.trigger(Event.FRAGMENT_LOADING, { url: this.url });
    }

    loadsuccess(event) {
        observer.trigger(Event.FRAGMENT_LOADED, {
            payload: event.currentTarget.response,
            url: this.url,
            stats: {
                trequest: this.trequest,
                tfirst: this.tfirst,
                tend: Date.now(),
                length: event.currentTarget.response.byteLength
            }
        });
    }

    loaderror(event) {
        logger.log('error loading ' + this.url);
        observer.trigger(Event.LOAD_ERROR, { url: this.url, event: event });
    }

    loadprogress() {
        if (this.tfirst === null) {
            this.tfirst = Date.now();
        }
    }
}

export default FragmentLoader;
