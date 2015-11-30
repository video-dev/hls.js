/*
 * AES128 decryption.
 */

import AES128Decrypter from './aes128-decrypter';
import {ErrorTypes, ErrorDetails} from '../errors';
import {logger} from '../utils/logger';

class Decrypter {

  constructor(hls) {
    this.hls = hls;
  }

  destroy() {
  }

  static set enableSoftware(value) {
    this.softwareEnabled = value;
  }
  static get enableSoftware() {
    return this.softwareEnabled;
  }
  static set disableWebCrypto(value) {
    this.webCryptoDisabled = value;
  }
  static get disableWebCrypto() {
    return this.webCryptoDisabled;
  }

  decrypt(data, key, iv, callback) {
    if (Decrypter.disableWebCrypto && Decrypter.enableSoftware) {
      this.decryptBySoftware(data, key, iv, callback);
    }
    else {
      this.decryptByWebCrypto(data, key, iv, callback);
    }
  }
  
  decryptByWebCrypto(data, key, iv, callback) {
    logger.log('decrypting by WebCrypto API');

    var localthis = this;
    window.crypto.subtle.importKey('raw', key, { name : 'AES-CBC', length : 128 }, false, ['decrypt']).
      then(function (importedKey) {
        window.crypto.subtle.decrypt({ name : 'AES-CBC', iv : iv.buffer }, importedKey, data).
          then(callback).
          catch (function (err) {
            localthis.onWebCryptoError(err, data, key, iv, callback);
          });
      }).
    catch (function (err) {
      localthis.onWebCryptoError(err, data, key, iv, callback);
    });
  }

  decryptBySoftware(data, key8, iv, callback) {
    logger.log('decrypting by JavaScript Implementation');

    var view = new DataView(key8.buffer);
    var key = new Uint32Array([
        view.getUint32(0),
        view.getUint32(4),
        view.getUint32(8),
        view.getUint32(12)
    ]);

    var decrypter = new AES128Decrypter(key, iv);
    callback(decrypter.decrypt(data).buffer);
  }

  onWebCryptoError(err, data, key, iv, callback) {
    if (Decrypter.enableSoftware) {
      logger.log('disabling to use WebCrypto API');
      Decrypter.disableWebCrypto = true;
      this.decryptBySoftware(data, key, iv, callback);
    }
    else {
      logger.error(`decrypting error : ${err.message}`);
      this.hls.trigger(Event.ERROR, {type : ErrorTypes.MEDIA_ERROR, details : ErrorDetails.FRAG_DECRYPT_ERROR, fatal : true, reason : err.message});
    }
  }

}

export default Decrypter;
