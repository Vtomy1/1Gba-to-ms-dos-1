import { SampleGbaRom } from '../types/gba_dos';

// Helper to create a valid GBA binary header
function createGbaRomBinary(
  title: string,
  gameCode: string,
  makerCode: string,
  paletteWords: number[],
  extraPayloadSize = 8192
): Uint8Array {
  const size = 192 + extraPayloadSize;
  const rom = new Uint8Array(size);

  // 0x00-0x03: Entry point ARM branch (B 0x80000C0)
  rom[0] = 0x2e;
  rom[1] = 0x00;
  rom[2] = 0x00;
  rom[3] = 0xea;

  // 0x04-0x9F: Nintendo Logo compressed bitmap prefix
  const logo = [
    0x24, 0xff, 0xae, 0x51, 0x69, 0x9a, 0xa2, 0x21,
    0x3d, 0x84, 0x82, 0x0a, 0x84, 0xe4, 0x09, 0xad,
    0x11, 0x24, 0x8b, 0x98, 0xc0, 0x81, 0x7f, 0x21,
    0xa3, 0x52, 0xbe, 0x19, 0x93, 0x09, 0xce, 0x20
  ];
  for (let i = 0; i < logo.length; i++) {
    rom[4 + i] = logo[i];
  }

  // 0xA0-0xAB: Title (12 characters, uppercase, null padded)
  const cleanTitle = title.toUpperCase().slice(0, 12).padEnd(12, ' ');
  for (let i = 0; i < 12; i++) {
    rom[0xa0 + i] = cleanTitle.charCodeAt(i);
  }

  // 0xAC-0xAF: Game Code (4 characters)
  const cleanCode = gameCode.toUpperCase().slice(0, 4).padEnd(4, 'X');
  for (let i = 0; i < 4; i++) {
    rom[0xac + i] = cleanCode.charCodeAt(i);
  }

  // 0xB0-0xB1: Maker Code (2 characters)
  const cleanMaker = makerCode.toUpperCase().slice(0, 2).padEnd(2, '0');
  rom[0xb0] = cleanMaker.charCodeAt(0);
  rom[0xb1] = cleanMaker.charCodeAt(1);

  // 0xB2: Fixed value 0x96
  rom[0xb2] = 0x96;

  // 0xB3: Unit code (0x00 for standard GBA)
  rom[0xb3] = 0x00;

  // 0xB4: Device type (0x00)
  rom[0xb4] = 0x00;

  // 0xBC: Software version (1)
  rom[0xbc] = 0x01;

  // 0xBD: Complement Check calculation:
  // Complement = -(sum of bytes from 0xA0 to 0xBC + 0x19)
  let sum = 0;
  for (let i = 0xa0; i <= 0xbc; i++) {
    sum = (sum + rom[i]) & 0xff;
  }
  rom[0xbd] = (0x100 - sum - 0x19) & 0xff;

  // Embed palette 15-bit BGR555 words at offset 0xC0
  for (let i = 0; i < paletteWords.length && (0xc0 + i * 2) < size; i++) {
    const word = paletteWords[i];
    rom[0xc0 + i * 2] = word & 0xff;
    rom[0xc0 + i * 2 + 1] = (word >> 8) & 0xff;
  }

  // Calculate checksum for bytes 0x00..0xBD
  let csum = 0;
  for (let i = 0; i < 0xbe; i++) {
    csum = (csum + rom[i]) & 0xffff;
  }
  rom[0xbe] = csum & 0xff;
  rom[0xbf] = (csum >> 8) & 0xff;

  return rom;
}

// Convert 0-31 RGB components into 15-bit BGR555 word
function toBgr555(r: number, g: number, b: number): number {
  return (r & 0x1f) | ((g & 0x1f) << 5) | ((b & 0x1f) << 10);
}

export const SAMPLE_GBA_ROMS: SampleGbaRom[] = [
  {
    id: 'cyber_run',
    title: 'CYBER_RUN',
    gameCode: 'ACBR',
    makerCode: '01',
    genre: 'Mode 7 Pseudo-3D Racer',
    description: 'High-speed Mode 7 perspective road racer with neon horizon and responsive cyber-vehicle steering.',
    generateRom: () => {
      const palette = [
        toBgr555(2, 2, 4),    // dark purple-black
        toBgr555(31, 4, 18),  // neon magenta
        toBgr555(4, 28, 31),  // cyan
        toBgr555(31, 26, 4),  // yellow
        toBgr555(14, 4, 25),  // violet
        toBgr555(8, 12, 22),  // asphalt blue
        toBgr555(28, 28, 30), // bright white-gray
        toBgr555(18, 4, 8),   // brake light red
      ];
      return createGbaRomBinary('CYBER_RUN', 'ACBR', '01', palette);
    },
  },
  {
    id: 'neo_quest',
    title: 'NEO_QUEST',
    gameCode: 'ANQP',
    makerCode: '01',
    genre: '16-bit RPG Overworld',
    description: 'Classic top-down fantasy adventure with animated water, village tiles, dialogue boxes, and hero sprite.',
    generateRom: () => {
      const palette = [
        toBgr555(4, 18, 8),   // grass green
        toBgr555(8, 26, 12),  // light foliage
        toBgr555(4, 12, 28),  // lake blue
        toBgr555(18, 14, 8),  // dirt path
        toBgr555(28, 20, 14), // stone cobblestone
        toBgr555(30, 8, 4),   // hero red tunic
        toBgr555(31, 31, 20), // gold shield
        toBgr555(2, 4, 6),    // shadow
      ];
      return createGbaRomBinary('NEO_QUEST', 'ANQP', '01', palette);
    },
  },
  {
    id: 'solar_vga',
    title: 'SOLAR_VGA',
    gameCode: 'ASOL',
    makerCode: '08',
    genre: 'Vector / Asteroids Sim',
    description: 'Orbital physics space combat with 360-degree rotating starship, asteroid collisions, and pulse lasers.',
    generateRom: () => {
      const palette = [
        toBgr555(1, 1, 3),    // deep space
        toBgr555(28, 28, 31), // starlight white
        toBgr555(6, 22, 31),  // thruster blue
        toBgr555(31, 12, 4),  // laser amber
        toBgr555(16, 16, 18), // asteroid basalt
        toBgr555(24, 20, 16), // crust brown
        toBgr555(4, 30, 16),  // shield green
        toBgr555(31, 4, 4),   // critical warning red
      ];
      return createGbaRomBinary('SOLAR_VGA', 'ASOL', '08', palette);
    },
  },
  {
    id: 'metro_vga',
    title: 'METRO_VGA',
    gameCode: 'AMET',
    makerCode: '01',
    genre: 'Cyberpunk Metroidvania',
    description: 'Side-scrolling sci-fi action platformer with smooth jumps, security drone targets, and parallax background.',
    generateRom: () => {
      const palette = [
        toBgr555(3, 4, 8),    // industrial dark blue
        toBgr555(6, 10, 18),  // steel girders
        toBgr555(4, 26, 20),  // terminal green
        toBgr555(31, 14, 4),  // plasma blast orange
        toBgr555(18, 6, 24),  // neon sign purple
        toBgr555(28, 28, 30), // armored suit white
        toBgr555(31, 28, 6),  // warning stripes
        toBgr555(2, 2, 2),    // void black
      ];
      return createGbaRomBinary('METRO_VGA', 'AMET', '01', palette);
    },
  },
];
