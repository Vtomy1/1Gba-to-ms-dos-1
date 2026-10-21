/**
 * GBA ROM and MS-DOS MZ Executable Type Definitions
 */

export interface RgbColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface GbaHeader {
  raw: Uint8Array;
  entryPoint: string;
  romSize: number;
  gameTitle: string;
  gameCode: string;
  makerCode: string;
  fixedValue: number; // Must be 0x96
  mainUnitCode: number;
  deviceType: number;
  softwareVersion: number;
  complementCheck: number;
  computedComplementCheck: number;
  isComplementValid: boolean;
  checksum: number;
  computedChecksum: number;
  isChecksumValid: boolean;
  isLogoValid: boolean;
  paletteColors: string[]; // Hex color array extracted from ROM
}

export interface MzHeaderField {
  offset: number;
  size: number;
  name: string;
  shortName: string;
  valueHex: string;
  valueDec: number;
  description: string;
}

export interface DosMzHeader {
  magic: string; // 'MZ' (0x5A4D)
  bytesInLastPage: number; // e_cblp
  totalPages: number; // e_cp (512-byte pages)
  relocations: number; // e_crlc
  headerParagraphs: number; // e_cparhdr (16-byte paragraphs)
  minExtraParagraphs: number; // e_minalloc
  maxExtraParagraphs: number; // e_maxalloc
  initialSS: number; // e_ss
  initialSP: number; // e_sp
  checksum: number; // e_csum
  initialIP: number; // e_ip
  initialCS: number; // e_cs
  relocTableOffset: number; // e_lfarlc
  overlayNumber: number; // e_ovno
  fields: MzHeaderField[];
}

export type ScalingMode = 'centered' | 'scaled_fit' | 'scaled_wide';
export type DitheringMode = 'custom_dac' | 'vga_standard' | 'bayer_ordered' | 'cga_16';
export type AudioTarget = 'sb16' | 'adlib' | 'pc_speaker';
export type PhosphorMode = 'color' | 'amber' | 'green';

export interface VgaModeSettings {
  scaling: ScalingMode;
  dithering: DitheringMode;
  audioTarget: AudioTarget;
  phosphor: PhosphorMode;
  crtScanlines: boolean;
  crtCurvature: boolean;
  showDosBorder: boolean;
  borderColor: number; // Mode 13h palette index
  customPalette?: RgbColor[]; // User-edited 256-color VGA DAC palette
}

export interface SampleGbaRom {
  id: string;
  title: string;
  gameCode: string;
  makerCode: string;
  genre: string;
  description: string;
  generateRom: () => Uint8Array;
}
