import AESCrypto from './aes-crypto';
import FastAESKey from './fast-aes-key';
import AESDecryptor from './aes-decryptor';

import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

/*globals self: false */

class Decrypter {
  constructor(observer,config) {
    this.observer = observer;
    this.config = config;
    try {
      const browserCrypto = crypto ? crypto : self.crypto;
      this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
    } catch (e) {}
    this.disableWebCrypto = !this.subtle;
  }

  decrypt(data, key, iv, callback) {
    if (this.disableWebCrypto && this.config.enableSoftwareAES) {
      logger.log('JS AES decrypt');
      let decryptor = this.decryptor;
      if (!decryptor) {
        this.decryptor = decryptor = new AESDecryptor();
      }
      decryptor.expandKey(key);
      callback(decryptor.decrypt(data, 0, iv));
    }
    else {
      logger.log('WebCrypto AES decrypt');
      const subtle = this.subtle;
      if (this.key !== key) {
        this.key = key;
        this.fastAesKey = new FastAESKey(subtle,key);
      }

      this.fastAesKey.expandKey().
        then((aesKey) => {
          // decrypt using web crypto
          let crypto = new AESCrypto(subtle,iv);
          crypto.decrypt(data, aesKey).
            then((result) => {
              callback(result);
            });
        }).
        catch ((err) => {
          this.onWebCryptoError(err, data, key, iv, callback);
        });
    }
  }

  onWebCryptoError(err, data, key, iv, callback) {
    if (this.config.enableSoftwareAES) {
      logger.log('WebCrypto Error, disable WebCrypto API');
      this.disableWebCrypto = true;
      this.decrypt(data, key, iv, callback);
    }
    else {
      logger.error(`decrypting error : ${err.message}`);
      this.observer.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, details : ErrorDetails.FRAG_DECRYPT_ERROR, fatal : true, reason : err.message});
    }
  }

  destroy() {
    let decryptor = this.decryptor;
    if (decryptor) {
      decryptor.destroy();
      this.decryptor = undefined;
    }
  }
}

export default Decrypter;
