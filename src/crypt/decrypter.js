import AESCrypto from './aes-crypto';
import FastAESKey from './fast-aes-key';
import AESDecryptor from './aes-decryptor';

import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

class Decrypter {
  constructor(hls) {
    this.hls = hls;
    try {
      const browserCrypto = window ? window.crypto : crypto;
      this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
    } catch (e) {}

    this.disableWebCrypto = !this.supportsWebCrypto();
  }

  supportsWebCrypto() {
    return this.subtle && window.location.protocol === 'https:';
  }

  decrypt(data, key, iv, callback) {
    if (this.disableWebCrypto && this.hls.config.enableSoftwareAES) {
      logger.log('decrypting by JavaScript Implementation');
      if (!this.decryptor) {
        this.decryptor = new AESDecryptor();
      }
      this.decryptor.expandKey(key);
      callback(this.decryptor.decrypt(data, 0, iv));
    }
    else {
      logger.log('decrypting by WebCrypto API');

      if (this.key !== key) {
        this.key = key;
        this.fastAesKey = new FastAESKey(key);
      }

      this.fastAesKey.expandKey().
        then((aesKey) => {
          // decrypt using web crypto
          let crypto = new AESCrypto(iv);
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
    if (this.hls.config.enableSoftwareAES) {
      logger.log('disabling to use WebCrypto API');
      this.disableWebCrypto = true;
      this.decrypt(data, key, iv, callback);
    }
    else {
      logger.error(`decrypting error : ${err.message}`);
      this.hls.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, details : ErrorDetails.FRAG_DECRYPT_ERROR, fatal : true, reason : err.message});
    }
  }

  destroy() {
    if (this.decryptor) {
      this.decryptor.destroy();
      this.decryptor = undefined;
    }
  }
}

export default Decrypter;
