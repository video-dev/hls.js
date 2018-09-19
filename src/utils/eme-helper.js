/**
 * @param {string} base64String base64 encoded string
 * @returns {ArrayBuffer}
 */
export function base64ToArrayBuffer (base64String) {
  let binaryString = window.atob(base64String);
  let len = binaryString.length;
  let bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

/**
 * https://www.w3.org/TR/eme-initdata-cenc/
 * @param {ArrayBuffer} binary data from the URI in the manifest
 * @returns {ArrayBuffer}
 */
export function buildPlayReadyPSSHBox (binary) {
  // https://dashif.org/identifiers/protection/ playready uuid: 9a04f079-9840-4286-ab92-e65be0885f95
  const uuid = ['0x9A04F079', '0x98404286', '0xAB92E65B', '0xE0885F95'];
  const psshBoxType = '0x70737368';
  const psshBoxVersion = 0;
  const uriData = binary;

  // create an ArrayBuffer with size of uriData and 32 bytes in padding
  const psshArray = new ArrayBuffer(uriData.length + 32);

  // create a data view with PSSH array buffer
  const data = new DataView(psshArray);

  // convert to unsigned 8 bit array
  const pssh = new Uint8Array(psshArray);

  data.setUint32(0, psshArray.byteLength);
  data.setUint32(4, psshBoxType);
  data.setUint32(8, psshBoxVersion);
  data.setUint32(12, uuid[0]);
  data.setUint32(16, uuid[1]);
  data.setUint32(20, uuid[2]);
  data.setUint32(24, uuid[3]);
  data.setUint32(28, uriData.length);

  pssh.set(uriData, 32);

  return pssh;
}

/*
* @param {ArrayBuffer} keyMessage
* @returns {Array} playReadyHeaders
*/
export function makePlayreadyHeaders (keyMessage) {
  const xmlContent = String.fromCharCode.apply(null, new Uint16Array(keyMessage));
  const parser = new window.DOMParser();
  const keyMessageXml = parser.parseFromString(xmlContent, 'application/xml');
  const headers = keyMessageXml.getElementsByTagName('HttpHeader');
  const playReadyHeaders = [];

  let header;

  for (let i = 0, len = headers.length; i < len; i++) {
    header = headers[i];
    playReadyHeaders.pushd({
      'name': header.querySelector('name').textContent,
      'value': header.querySelector('value').textContent
    });
  }

  return playReadyHeaders;
}
