import AESCrypto from './aes-crypto';
import FastAESKey from './fast-aes-key';
import AESDecryptor from './aes-decryptor';

import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

/*globals self: false */

class Decrypter {
  constructor(observer,config) {
    this._observer = observer;
    this._config = config;
    this._logEnabled = true;
    try {
      const browserCrypto = crypto ? crypto : self.crypto;
      this._subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
    } catch (e) {}
    this._disableWebCrypto = !this._subtle;
  }

  isSync() {
    return (this._disableWebCrypto && this._config.enableSoftwareAES);
  }

  decrypt(data, key, iv, callback) {
    if (this._disableWebCrypto && this._config.enableSoftwareAES) {
      if (this._logEnabled) {
        logger.log('JS AES decrypt');
        this._logEnabled = false;
      }
      let decryptor = this._decryptor;
      if (!decryptor) {
        this._decryptor = decryptor = new AESDecryptor();
      }
      decryptor.expandKey(key);
      callback(decryptor.decrypt(data, 0, iv));
    }
    else {
      if (this._logEnabled) {
        logger.log('WebCrypto AES decrypt');
        this._logEnabled = false;
      }
      const subtle = this._subtle;
      if (this._key !== key) {
        this._key = key;
        this._fastAesKey = new FastAESKey(subtle,key);
      }

      this._fastAesKey.expandKey().
        then((aesKey) => {
          // decrypt using web crypto
          let crypto = new AESCrypto(subtle,iv);
          crypto.decrypt(data, aesKey).
          catch ((err) => {
            this._onWebCryptoError(err, data, key, iv, callback);
          }).
          then((result) => {
            callback(result);
          });
        }).
        catch ((err) => {
          this._onWebCryptoError(err, data, key, iv, callback);
        });
    }
  }

  _onWebCryptoError(err, data, key, iv, callback) {
    if (this._config.enableSoftwareAES) {
      logger.log('WebCrypto Error, disable WebCrypto API');
      this._disableWebCrypto = true;
      this._logEnabled = true;
      this.decrypt(data, key, iv, callback);
    }
    else {
      logger.error(`decrypting error : ${err.message}`);
      this._observer.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, details : ErrorDetails.FRAG_DECRYPT_ERROR, fatal : true, reason : err.message});
    }
  }

  destroy() {
    let decryptor = this._decryptor;
    if (decryptor) {
      decryptor.destroy();
      this._decryptor = undefined;
    }
  }
}

export default Decrypter;
