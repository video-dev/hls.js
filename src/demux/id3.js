/**
 * ID3 parser
 */


 class ID3 {

  constructor(data) {
    this.data = data;
  }

  get hasTimeStamp() {
    return false;
  }
}

export default ID3;

