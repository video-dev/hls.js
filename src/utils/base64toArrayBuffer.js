export function base64ToArrayBuffer (base64String) {
  let binaryString = window.atob(base64String);
  let len = binaryString.length;
  let bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}
