/**
 * VGA Mode 13h Palette and Color Quantization Utilities
 * VGA Mode 13h is 320x200 with 256 indexed colors chosen from an 18-bit RGB DAC (6 bits per channel: 0-63).
 */

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

// Generate the classic standard 256-color IBM VGA Mode 13h palette
export function getStandardVgaPalette(): RgbColor[] {
  const palette: RgbColor[] = new Array(256);

  // Standard 16 CGA/EGA colors (0-15)
  const cga16: [number, number, number][] = [
    [0, 0, 0],       // 0: Black
    [0, 0, 170],     // 1: Blue
    [0, 170, 0],     // 2: Green
    [0, 170, 170],   // 3: Cyan
    [170, 0, 0],     // 4: Red
    [170, 0, 170],   // 5: Magenta
    [170, 85, 0],    // 6: Brown
    [170, 170, 170], // 7: Light Gray
    [85, 85, 85],    // 8: Dark Gray
    [85, 85, 255],   // 9: Light Blue
    [85, 255, 85],   // 10: Light Green
    [85, 255, 255],  // 11: Light Cyan
    [255, 85, 85],   // 12: Light Red
    [255, 85, 255],  // 13: Light Magenta
    [255, 255, 85],  // 14: Yellow
    [255, 255, 255], // 15: White
  ];

  for (let i = 0; i < 16; i++) {
    palette[i] = { r: cga16[i][0], g: cga16[i][1], b: cga16[i][2] };
  }

  // 16-shade Grayscale ramp (16-31)
  for (let i = 0; i < 16; i++) {
    const val = Math.round((i / 15) * 255);
    palette[16 + i] = { r: val, g: val, b: val };
  }

  // 216 Color Cube (32-247): 6x6x6 RGB cube
  let idx = 32;
  const levels = [0, 51, 102, 153, 204, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette[idx++] = { r: levels[r], g: levels[g], b: levels[b] };
      }
    }
  }

  // Remaining 8 slots (248-255): Darker Grays / Accent
  for (let i = 0; i < 8; i++) {
    const val = Math.round((i / 7) * 128);
    palette[idx++] = { r: val, g: Math.round(val * 0.9), b: Math.round(val * 1.1) };
  }

  return palette;
}

// Convert GBA 15-bit BGR555 format to RGB (0-255)
export function bgr555ToRgb(bgr: number): RgbColor {
  const r5 = bgr & 0x1f;
  const g5 = (bgr >> 5) & 0x1f;
  const b5 = (bgr >> 10) & 0x1f;

  return {
    r: Math.round((r5 * 255) / 31),
    g: Math.round((g5 * 255) / 31),
    b: Math.round((b5 * 255) / 31),
  };
}

// Convert 24-bit RGB to 6-bit VGA DAC format (0-63 per channel)
export function rgbToVgaDac(rgb: RgbColor): [number, number, number] {
  return [
    Math.min(63, Math.max(0, Math.floor((rgb.r * 63) / 255))),
    Math.min(63, Math.max(0, Math.floor((rgb.g * 63) / 255))),
    Math.min(63, Math.max(0, Math.floor((rgb.b * 63) / 255))),
  ];
}

// Convert 6-bit VGA DAC values back to 8-bit RGB
export function vgaDacToRgb(dac: [number, number, number]): RgbColor {
  return {
    r: Math.round((dac[0] * 255) / 63),
    g: Math.round((dac[1] * 255) / 63),
    b: Math.round((dac[2] * 255) / 63),
  };
}

// Find closest color in palette using Euclidean distance
export function findClosestPaletteIndex(
  rgb: RgbColor,
  palette: RgbColor[],
  maxIndex = 255
): number {
  let closest = 0;
  let minDistance = Infinity;

  for (let i = 0; i <= maxIndex; i++) {
    const p = palette[i];
    const dr = rgb.r - p.r;
    const dg = rgb.g - p.g;
    const db = rgb.b - p.b;
    // Perceptual color weight approximation
    const dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;

    if (dist < minDistance) {
      minDistance = dist;
      closest = i;
    }
  }

  return closest;
}

// Bayer 4x4 matrix for ordered dithering
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Apply dithering to RGB pixel based on screen coordinate
export function applyBayerDither(
  rgb: RgbColor,
  x: number,
  y: number,
  palette: RgbColor[]
): number {
  const threshold = (BAYER_4X4[y % 4][x % 4] - 8) * 4;
  const ditheredRgb: RgbColor = {
    r: Math.min(255, Math.max(0, rgb.r + threshold)),
    g: Math.min(255, Math.max(0, rgb.g + threshold)),
    b: Math.min(255, Math.max(0, rgb.b + threshold)),
  };

  return findClosestPaletteIndex(ditheredRgb, palette);
}

// Build a custom 256-color VGA DAC palette optimized from GBA colors
export function buildCustomGbaVgaPalette(sampleRgbList: RgbColor[]): RgbColor[] {
  const palette: RgbColor[] = [];

  // Always keep first 16 entries as standard CGA/EGA for DOS UI / border safety
  const standard = getStandardVgaPalette();
  for (let i = 0; i < 16; i++) {
    palette.push(standard[i]);
  }

  // Populate remaining 240 colors with unique extracted colors, clamped to 6-bit DAC precision
  const seen = new Set<string>();
  for (let i = 0; i < 16; i++) {
    seen.add(`${palette[i].r},${palette[i].g},${palette[i].b}`);
  }

  for (const col of sampleRgbList) {
    if (palette.length >= 256) break;
    // Quantize to 6-bit DAC
    const dac = rgbToVgaDac(col);
    const quantized = vgaDacToRgb(dac);
    const key = `${quantized.r},${quantized.g},${quantized.b}`;
    if (!seen.has(key)) {
      seen.add(key);
      palette.push(quantized);
    }
  }

  // Fill any remaining entries from standard palette
  for (let i = 16; i < 256 && palette.length < 256; i++) {
    palette.push(standard[i]);
  }

  return palette;
}

// Export palette as JASC-PAL (text format compatible with GIMP / PSP / retro tools)
export function exportJascPal(palette: RgbColor[]): string {
  let output = 'JASC-PAL\r\n0100\r\n256\r\n';
  for (let i = 0; i < 256; i++) {
    const col = palette[i] || { r: 0, g: 0, b: 0 };
    output += `${col.r} ${col.g} ${col.b}\r\n`;
  }
  return output;
}

// Export palette as binary Adobe Color Table (.ACT, 768 bytes)
export function exportAdobeAct(palette: RgbColor[]): Uint8Array {
  const buffer = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const col = palette[i] || { r: 0, g: 0, b: 0 };
    buffer[i * 3 + 0] = col.r;
    buffer[i * 3 + 1] = col.g;
    buffer[i * 3 + 2] = col.b;
  }
  return buffer;
}

// Convert Hex string (#RRGGBB) to RgbColor
export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  const num = parseInt(clean, 16) || 0;
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

// Convert RgbColor to Hex string (#RRGGBB)
export function rgbToHex(color: RgbColor): string {
  const r = Math.min(255, Math.max(0, Math.round(color.r))).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, Math.round(color.g))).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, Math.round(color.b))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

// Convert 24-bit RGB to 15-bit GBA BGR555 word
export function rgbToBgr555(rgb: RgbColor): number {
  const r5 = Math.min(31, Math.max(0, Math.round((rgb.r * 31) / 255)));
  const g5 = Math.min(31, Math.max(0, Math.round((rgb.g * 31) / 255)));
  const b5 = Math.min(31, Math.max(0, Math.round((rgb.b * 31) / 255)));
  return r5 | (g5 << 5) | (b5 << 10);
}

// Extract [r5, g5, b5] 5-bit components (0-31) from 15-bit BGR555 word
export function bgr555To5BitComponents(word: number): [number, number, number] {
  return [word & 0x1f, (word >> 5) & 0x1f, (word >> 10) & 0x1f];
}
