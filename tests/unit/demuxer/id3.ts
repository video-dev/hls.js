// import { expect } from 'chai';
// import { Id3Frame } from '@svta/common-media-library';

// describe('ID3 tests', function () {

//   it('utf8ArrayToStr', function (done) {
//     const aB = new Uint8Array([97, 98]);
//     const aNullBNullC = new Uint8Array([97, 0, 98, 0, 99]);

//     expect(utf8ArrayToStr(aB)).to.equal('ab');
//     expect(utf8ArrayToStr(aNullBNullC)).to.equal('abc');
//     expect(utf8ArrayToStr(aNullBNullC, true)).to.equal('a');

//     done();
//   });

//   it('should decode a TXXX frame', function () {
//     const frame = {
//       type: 'TXXX',
//       data: new Uint8Array([0, 102, 111, 111, 0, 97, 98, 99]),
//       size: 2, // required by the _decodeTextFrame function
//     };

//     const result: Id3Frame | undefined = ID3.testables.decodeTextFrame(frame);
//     expect(result).to.exist;
//     expect(result!.key).to.equal('TXXX');
//     expect(result!.info).to.equal('foo');
//     expect(result!.data).to.equal('abc');
//   });
// });
