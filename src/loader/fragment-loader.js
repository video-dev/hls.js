/*
 * Fragment Loader
*/

import Event from '../events';
import { ErrorTypes, ErrorDetails } from '../errors';

class FragmentLoader {
    constructor(hls) {
        this.hls = hls;
        this.decryptkey = null;
        this.decrypturl = null;
        this.onfdkl = this.onFragDecryptKeyLoading.bind(this);
        hls.on(Event.FRAG_LOADING, this.onfdkl);
    }

    destroy() {
        if (this.loader) {
            this.loader.destroy();
            this.loader = null;
        }
        this.hls.off(Event.FRAG_LOADING, this.onfdkl);
    }

    onFragLoading(event, data) {
        var frag = data.frag;
        this.frag = frag;
        this.frag.loaded = 0;
        var config = this.hls.config;
        frag.loader = this.loader = new config.loader(config);
        this.loader.load(
            frag.url,
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
    }

    onFragDecryptKeyLoading(event, data) {
        var frag = data.frag;
        this.frag = frag;
        if ((frag.decryptdata.uri != null) & (frag.decryptdata.key == null)) {
            if (
                this.decrypturl == null ||
                frag.decryptdata.uri !== this.decrypturl
            ) {
                var config = this.hls.config;
                frag.loader = this.loader = new config.loader(config);
                this.loader.load(
                    frag.decryptdata.uri,
                    'arraybuffer',
                    this.loaddecryptkeysuccess.bind(this),
                    this.loaderror.bind(this),
                    this.loadtimeout.bind(this),
                    config.fragLoadingTimeOut,
                    config.fragLoadingMaxRetry,
                    config.fragLoadingRetryDelay,
                    this.loaddecryptkeyprogress.bind(this),
                    frag
                );
                this.decrypturl = frag.decryptdata.uri;
                return;
            }
        } else {
            this.decryptkey = frag.decryptdata.key;
        }
        this.frag.decryptdata.key = this.decryptkey;
        this.onFragLoading(event, data);
    }

    loadsuccess(event, stats) {
        var payload = event.currentTarget.response;
        stats.length = payload.byteLength;
        // detach fragment loader on load success
        this.frag.loader = undefined;
        this.hls.trigger(Event.FRAG_LOADED, {
            payload: payload,
            frag: this.frag,
            stats: stats
        });
    }

    loaderror(event) {
        this.loader.abort();
        this.hls.trigger(Event.ERROR, {
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_ERROR,
            fatal: false,
            frag: this.frag,
            response: event
        });
    }

    loadtimeout() {
        this.loader.abort();
        this.hls.trigger(Event.ERROR, {
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_TIMEOUT,
            fatal: false,
            frag: this.frag
        });
    }

    loadprogress(event, stats) {
        this.frag.loaded = stats.loaded;
        this.hls.trigger(Event.FRAG_LOAD_PROGRESS, {
            frag: this.frag,
            stats: stats
        });
    }

    loaddecryptkeysuccess(event) {
        this.frag.decryptdata.key = new Uint8Array(
            event.currentTarget.response
        );
        this.decryptkey = this.frag.decryptdata.key;
        // detach fragment loader on load success
        this.frag.loader = undefined;
        this.onFragLoading(event, { frag: this.frag });
    }

    loaddecryptkeyprogress() {}
}

export default FragmentLoader;
