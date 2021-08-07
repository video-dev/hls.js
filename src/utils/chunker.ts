import { appendUint8Array } from './mp4-tools';
import { sliceUint8 } from './typed-array';

export default class Chunker {
  private chunkSize: number;
  public cache: Uint8Array | null = null;
  constructor(chunkSize = Math.pow(2, 19)) {
    this.chunkSize = chunkSize;
  }

  public push(data: Uint8Array): Array<Uint8Array> {
    const { cache, chunkSize } = this;
    const result: Array<Uint8Array> = [];

    let temp: Uint8Array | null = null;
    if (cache?.length) {
      temp = appendUint8Array(cache, data);
      this.cache = null;
    } else {
      temp = data;
    }

    if (temp.length < chunkSize) {
      this.cache = temp;
      return result;
    }

    if (temp.length > chunkSize) {
      let offset = 0;
      const len = temp.length;
      while (offset < len - chunkSize) {
        result.push(sliceUint8(temp, offset, offset + chunkSize));
        offset += chunkSize;
      }
      this.cache = sliceUint8(temp, offset);
    } else {
      result.push(temp);
    }

    return result;
  }
}
