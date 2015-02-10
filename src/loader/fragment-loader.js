/*
 * fragment loader
 *
 */

//import {enableLogs}    from '../utils/logger';
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
        xhr.onload = this.loadsuccess;
        xhr.onerror = this.loaderror;
        xhr.onprogress = this.loadprogress;
        xhr.responseType = 'arraybuffer';
        xhr.parent = this;
        xhr.open('GET', url, true);
        xhr.send();
    }

    loadsuccess(event) {
        this.parent.trigger('stats', {
            trequest: this.parent.trequest,
            tfirst: this.parent.tfirst,
            tend: Date.now(),
            length: event.currentTarget.response.byteLength,
            url: this.url
        });
        this.parent.trigger('data', event.currentTarget.response);
    }

    loaderror(event) {
        console.log('error loading ' + this.parent.url);
    }

    loadprogress(event) {
        if (this.parent.tfirst === null) {
            this.parent.tfirst = Date.now();
        }
    }
}

export default FragmentLoader;
