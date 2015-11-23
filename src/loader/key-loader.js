/*
 * Decrypt key Loader
*/

import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';

class KeyLoader {
    constructor(hls) {
        this.hls = hls;
        this.decryptkey = null;
        this.decrypturl = null;
        this.ondkl = this.onDecryptKeyLoading.bind(this);
        hls.on(Event.KEY_LOADING, this.ondkl);
    }

    destroy() {
        if (this.loader) {
            this.loader.destroy();
            this.loader = null;
        }
        this.hls.off(Event.KEY_LOADING, this.ondkl);
    }

    onDecryptKeyLoading(event, data) {
        var frag = data.frag;
        this.frag = frag;
        if (frag.decryptdata.uri != null && frag.decryptdata.key == null) {
            if (
                this.decrypturl == null ||
                frag.decryptdata.uri !== this.decrypturl
            ) {
                var config = this.hls.config;
                frag.loader = this.loader = new config.loader(config);
                this.loader.load(
                    frag.decryptdata.uri,
                    'arraybuffer',
                    this.loadsuccess.bind(this),
                    this.loaderror.bind(this),
                    this.loadtimeout.bind(this),
                    config.fragLoadingTimeOut,
                    config.fragLoadingMaxRetry,
                    config.fragLoadingRetryDelay,
                    this.loadprogress.bind(this),
                    frag
                );
                this.decrypturl = frag.decryptdata.uri;
                return;
            }
        } else {
            this.decryptkey = frag.decryptdata.key;
        }
        this.frag.decryptdata.key = this.decryptkey;
        this.hls.trigger(Event.KEY_LOADED, { frag: this.frag });
    }

    loadsuccess(event) {
        this.frag.decryptdata.key = new Uint8Array(
            event.currentTarget.response
        );
        this.decryptkey = this.frag.decryptdata.key;
        // detach fragment loader on load success
        this.frag.loader = undefined;
        this.hls.trigger(Event.KEY_LOADED, { frag: this.frag });
    }

    loaderror(event) {
        this.loader.abort();
        this.hls.trigger(Event.ERROR, {
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.KEY_LOAD_ERROR,
            fatal: false,
            frag: this.frag,
            response: event
        });
    }

    loadtimeout() {
        this.loader.abort();
        this.hls.trigger(Event.ERROR, {
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.KEY_LOAD_TIMEOUT,
            fatal: false,
            frag: this.frag
        });
    }

    loadprogress() {}
}

export default KeyLoader;
