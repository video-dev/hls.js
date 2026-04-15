/**
 * PlayReady DRM Workarounds
 *
 * This module provides workarounds for PlayReady DRM compatibility issues,
 * particularly with Xbox One and Microsoft Edge browsers. It includes functions
 * to patch level details and fake encryption in MP4 init segments to ensure
 * smooth playback of DRM-protected content.
 */

import { logger } from './logger';
import { KeySystemFormats } from './mediakeys-helper';
import {
  appendUint8Array,
  bin2str,
  findBox,
  mp4Box,
  readUint32,
  writeUint32,
} from './mp4-tools';
import type { LevelDetails } from '../loader/level-details';

/**
 * Applies a PlayReady DRM workaround to level details.
 *
 * This function addresses PlayReady DRM compatibility issues by copying
 * levelkeys from the first encrypted fragment to all fragments that lack
 * levelkeys. This ensures smooth transitions in mixed clear and encrypted
 * content playlists on certain platforms like XBox.
 *
 * @param levelDetails - The level details object to apply the workaround to
 */
export function applyPlayReadyWorkaroundToLevelDetails(
  levelDetails: LevelDetails,
) {
  const firstEncryptedFragment = levelDetails.encryptedFragments?.[0];
  if (firstEncryptedFragment?.levelkeys?.[KeySystemFormats.PLAYREADY]) {
    for (let i = 0; i < levelDetails.fragments.length; i++) {
      const fragment = levelDetails.fragments[i];
      if (!fragment.levelkeys) {
        fragment.levelkeys = firstEncryptedFragment.levelkeys;
      }
    }
    logger.debug('Applied PlayReady workaround to level details');
  }
}

/**
 * Creates a fake sinf (protection scheme information) box for MP4.
 *
 * This function generates a sinf box that mimics encryption information,
 * which is required for PlayReady DRM compatibility on certain platforms.
 *
 * @param encType - The encryption type bytes (e.g., 'encv' or 'enca')
 * @param fourCC - The four-character code of the original sample entry
 * @param entry - The original sample entry data
 * @returns A Uint8Array containing the modified entry with the fake sinf box
 */
function createFakeSinfBox(
  encType: Uint8Array,
  fourCC: string,
  entry: Uint8Array,
) {
  const entryCopy = new Uint8Array(entry);
  entryCopy.set(encType, 4);

  const sinf = mp4Box(
    [0x73, 0x69, 0x6e, 0x66], // 'sinf'
    mp4Box(
      [0x66, 0x72, 0x6d, 0x61], // 'frma'
      new Uint8Array(fourCC.split('').map((c) => c.charCodeAt(0))),
    ),
    mp4Box(
      [0x73, 0x63, 0x68, 0x6d], // 'schm'
      new Uint8Array([
        0x00, 0x00, 0x00, 0x00, 0x63, 0x65, 0x6e, 0x63, 0x00, 0x01, 0x00, 0x00,
      ]),
    ),
    mp4Box(
      [0x73, 0x63, 0x68, 0x69], // 'schi'
      mp4Box(
        [0x74, 0x65, 0x6e, 0x63], // 'tenc'
        new Uint8Array([
          0x00, // version 0
          0x00,
          0x00,
          0x00, // flags
          0x00,
          0x00, // Reserved fields
          0x01, // Default protected: true
          0x08, // Default per-sample IV size: 8
          0x00, // Default KID (Key ID) - 16 bytes of zeros
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
        ]),
      ),
    ),
  );

  // Append the sinf box to the modified entry and update the size
  const entryWithSinf = appendUint8Array(entryCopy, sinf);
  writeUint32(entryWithSinf, 0, entryWithSinf.length);
  return entryWithSinf;
}

export function fakeEncryption(initSegment: Uint8Array) {
  const initSegmentCopy = new Uint8Array(initSegment);

  const moov = findBox(initSegmentCopy, ['moov'])[0];
  if (!moov) {
    return initSegment;
  }

  // Only patch single trak files (no audio+video)
  const traks = findBox(moov, ['trak']);
  if (!traks || traks.length > 1) {
    return initSegment;
  }

  const trak = traks[0];
  const mdia = findBox(trak, ['mdia'])[0];
  const minf = findBox(mdia, ['minf'])[0];
  const stbl = findBox(minf, ['stbl'])[0];
  const stsdBox = findBox(stbl, ['stsd'])[0];
  if (!mdia || !minf || !stbl || !stsdBox) {
    return initSegment;
  }

  // Patch stsd box
  const entryCount = readUint32(stsdBox, 4);
  let entryOffset = 8;
  const newEntries: Uint8Array[] = [];
  for (let i = 0; i < entryCount; i++) {
    const size = readUint32(stsdBox, entryOffset);
    const fourCC = bin2str(stsdBox.subarray(entryOffset + 4, entryOffset + 8));
    const entry = stsdBox.subarray(entryOffset, entryOffset + size);
    let boxType: Uint8Array | undefined = undefined;
    switch (fourCC) {
      case 'avc1':
      case 'avc2':
      case 'avc3':
      case 'avc4':
        boxType = new Uint8Array([0x65, 0x6e, 0x63, 0x76]); // 'encv'
        break;
      case 'mp4a':
        boxType = new Uint8Array([0x65, 0x6e, 0x63, 0x61]); // 'enca'
        break;
      default:
        break;
    }

    if (boxType) {
      const encEntry = createFakeSinfBox(boxType, fourCC, entry);
      // For Xbox One & Edge, we cut and insert at the start of the source box.
      // For other platforms, we cut and insert at the end of the source box. It's
      // not clear why this is necessary on Xbox One, but it seems to be evidence
      // of another bug in the firmware implementation of MediaSource & EME.
      // TODO: needs more tests
      if (navigator.userAgent.match(/Edge?\//)) {
        newEntries.push(encEntry);
        newEntries.push(entry);
      } else {
        newEntries.push(entry);
        newEntries.push(encEntry);
      }
    } else {
      newEntries.push(entry);
    }

    entryOffset += size;
  }

  // Rebuild stsd box with new entries
  const stsdHeader = stsdBox.subarray(0, 8);
  writeUint32(stsdHeader, 4, newEntries.length);
  const newStsd = mp4Box([0x73, 0x74, 0x73, 0x64], stsdHeader, ...newEntries);
  const stsdOffset = stsdBox.byteOffset - trak.byteOffset - 8;

  // Update sizes of parent boxes
  writeUint32(
    trak,
    stbl.byteOffset - trak.byteOffset - 8,
    stbl.length - stsdBox.length + newStsd.length,
  );
  writeUint32(
    trak,
    minf.byteOffset - trak.byteOffset - 8,
    minf.length - stsdBox.length + newStsd.length,
  );
  writeUint32(
    trak,
    mdia.byteOffset - trak.byteOffset - 8,
    mdia.length - stsdBox.length + newStsd.length,
  );

  // Rebuild trak with patched stsd box
  let patchedTrak = trak;
  if (stsdOffset > 0) {
    patchedTrak = new Uint8Array(
      trak.length - stsdBox.length + newStsd.length - 8,
    );
    patchedTrak.set(trak.subarray(0, stsdOffset), 0);
    patchedTrak.set(newStsd, stsdOffset);
    patchedTrak.set(
      trak.subarray(stsdOffset + stsdBox.length + 8),
      stsdOffset + newStsd.length,
    );
  }

  // Rebuild moov with patched trak
  let moovRest = moov;
  const trakOffset = trak.byteOffset - moov.byteOffset;
  writeUint32(moovRest, trakOffset - 8, patchedTrak.length + 8);

  if (trakOffset > 0) {
    const before = moovRest.subarray(0, trakOffset);
    const after = moovRest.subarray(trakOffset + trak.length);
    const newMoov = new Uint8Array(
      before.length + patchedTrak.length + after.length,
    );
    newMoov.set(before, 0);
    newMoov.set(patchedTrak, before.length);
    newMoov.set(after, before.length + patchedTrak.length);
    moovRest = newMoov;
  }

  const patchedMoov = new Uint8Array(8 + moovRest.length);
  patchedMoov.set(
    initSegment.subarray(moov.byteOffset - 8, moov.byteOffset),
    0,
  );
  patchedMoov.set(moovRest, 8);
  writeUint32(patchedMoov, 0, moovRest.length + 8);

  // Now reconstruct the full MP4, replacing only the moov atom
  const out: Uint8Array[] = [];
  let offset = 0;
  while (offset < initSegment.length) {
    const size = readUint32(initSegment, offset);
    const type = bin2str(initSegment.subarray(offset + 4, offset + 8));
    if (type === 'moov') {
      out.push(patchedMoov);
    } else {
      out.push(initSegment.subarray(offset, offset + size));
    }
    offset += size;
  }

  const modifiedInitSegment = appendUint8Array(out[0], out[1]);
  logger.debug(
    'Use fakeEncryption for clear to drm transition with PlayReady DRM',
  );
  // Edge Windows needs the unmodified init segment to be appended after the
  // patched one, otherwise video element throws following error:
  // CHUNK_DEMUXER_ERROR_APPEND_FAILED: Sample encryption info is not
  // available.
  if (navigator.userAgent.match(/Edge?\//)) {
    return appendUint8Array(modifiedInitSegment, initSegment);
  } else {
    return modifiedInitSegment;
  }
}
