import { GbaHeader } from '../types/gba_dos';
import { bgr555ToRgb } from './vgaPalette';

// Known Nintendo Logo bytes prefix (first 16 bytes of GBA logo compressed bitmap)
const NINTENDO_LOGO_PREFIX = [
  0x24, 0xff, 0xae, 0x51, 0x69, 0x9a, 0xa2, 0x21,
  0x3d, 0x84, 0x82, 0x0a, 0x84, 0xe4, 0x09, 0xad
];

export function parseGbaRom(buffer: ArrayBuffer | Uint8Array): GbaHeader {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.length < 192) {
    throw new Error('File too small to be a valid GBA ROM (minimum 192 bytes required for GBA header).');
  }

  // 1. Entry point (0x00 - 0x03)
  const entryPointBytes = [bytes[0], bytes[1], bytes[2], bytes[3]];
  const entryPoint = '0x' + entryPointBytes.map(b => b.toString(16).padStart(2, '0')).reverse().join('').toUpperCase();

  // 2. Nintendo Logo check (0x04 - 0x9F)
  let logoMatches = 0;
  for (let i = 0; i < NINTENDO_LOGO_PREFIX.length && (4 + i) < bytes.length; i++) {
    if (bytes[4 + i] === NINTENDO_LOGO_PREFIX[i]) {
      logoMatches++;
    }
  }
  const isLogoValid = logoMatches >= 8;

  // 3. Game Title (0xA0 - 0xAB, 12 ASCII characters)
  let gameTitle = '';
  for (let i = 0xa0; i <= 0xab && i < bytes.length; i++) {
    const charCode = bytes[i];
    if (charCode >= 32 && charCode <= 126) {
      gameTitle += String.fromCharCode(charCode);
    } else if (charCode === 0) {
      // null terminator
      break;
    }
  }
  gameTitle = gameTitle.trim() || 'UNTITLED_GBA';

  // 4. Game Code (0xAC - 0xAF, 4 ASCII chars)
  let gameCode = '';
  for (let i = 0xac; i <= 0xaf && i < bytes.length; i++) {
    const charCode = bytes[i];
    if (charCode >= 32 && charCode <= 126) {
      gameCode += String.fromCharCode(charCode);
    }
  }
  gameCode = gameCode.trim() || 'AGBA';

  // 5. Maker Code (0xB0 - 0xB1, 2 ASCII chars)
  let makerCode = '';
  for (let i = 0xb0; i <= 0xb1 && i < bytes.length; i++) {
    const charCode = bytes[i];
    if (charCode >= 32 && charCode <= 126) {
      makerCode += String.fromCharCode(charCode);
    }
  }
  makerCode = makerCode.trim() || '01';

  // 6. Fixed Value (0xB2, must be 0x96)
  const fixedValue = bytes[0xb2] ?? 0;

  // 7. Unit Code & Device Type
  const mainUnitCode = bytes[0xb3] ?? 0;
  const deviceType = bytes[0xb4] ?? 0;
  const softwareVersion = bytes[0xbc] ?? 0;

  // 8. Complement Check (0xBD)
  const complementCheck = bytes[0xbd] ?? 0;
  let sum = 0;
  for (let i = 0xa0; i <= 0xbc && i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xff;
  }
  const computedComplementCheck = (0x100 - sum - 0x19) & 0xff;
  const isComplementValid = complementCheck === computedComplementCheck;

  // 9. Checksum (0xBE - 0xBF, 16-bit)
  const checksum = ((bytes[0xbf] ?? 0) << 8) | (bytes[0xbe] ?? 0);
  let computedChecksum = 0;
  for (let i = 0; i < 0xbe && i < bytes.length; i++) {
    computedChecksum = (computedChecksum + bytes[i]) & 0xffff;
  }
  const isChecksumValid = checksum === computedChecksum || checksum === 0;

  // 10. Extract potential 15-bit BGR555 palettes from ROM data
  const paletteColors: string[] = [];
  const paletteColorSet = new Set<string>();

  // Look for 16-color chunks of valid 15-bit BGR555 words
  for (let i = 0xc0; i < Math.min(bytes.length - 32, 16384); i += 2) {
    const word = bytes[i] | (bytes[i + 1] << 8);
    // Ignore pure black or 0xFFFF if repeating
    if (word !== 0 && word !== 0xffff) {
      const rgb = bgr555ToRgb(word);
      const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
      if (!paletteColorSet.has(hex)) {
        paletteColorSet.add(hex);
        paletteColors.push(hex);
        if (paletteColors.length >= 32) break;
      }
    }
  }

  // Fallback pleasant palette if ROM was stripped
  if (paletteColors.length < 8) {
    const defaults = [
      '#081820', '#346856', '#88c070', '#e0f8d0',
      '#1f244b', '#603f83', '#a16ae8', '#e9b5f9',
      '#2b1810', '#63381a', '#b86f34', '#e8b382',
      '#102830', '#205868', '#4098a8', '#88e0e8'
    ];
    for (const d of defaults) {
      if (!paletteColorSet.has(d)) {
        paletteColors.push(d);
      }
    }
  }

  return {
    raw: bytes,
    entryPoint,
    romSize: bytes.length,
    gameTitle,
    gameCode,
    makerCode,
    fixedValue,
    mainUnitCode,
    deviceType,
    softwareVersion,
    complementCheck,
    computedComplementCheck,
    isComplementValid,
    checksum,
    computedChecksum,
    isChecksumValid,
    isLogoValid,
    paletteColors,
  };
}
