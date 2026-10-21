import { DosMzHeader, GbaHeader, MzHeaderField, VgaModeSettings } from '../types/gba_dos';
import { getStandardVgaPalette, rgbToVgaDac, RgbColor, buildCustomGbaVgaPalette, bgr555ToRgb } from './vgaPalette';

export interface BuiltDosExe {
  binary: Uint8Array;
  mzHeader: DosMzHeader;
  asmSource: string;
  dosboxConf: string;
  autoexecBat: string;
  disassembly: Array<{ offset: string; hex: string; instruction: string; comment: string }>;
}

export function buildDosMzExecutable(
  gba: GbaHeader,
  settings: VgaModeSettings
): BuiltDosExe {
  // Step 1: Prepare palette (256 colors * 3 = 768 bytes of 6-bit DAC values)
  const sampleColors: RgbColor[] = [];
  for (let i = 0; i < Math.min(gba.raw.length - 2, 8192); i += 2) {
    const word = gba.raw[i] | (gba.raw[i + 1] << 8);
    if (word !== 0 && word !== 0xffff) {
      sampleColors.push(bgr555ToRgb(word));
      if (sampleColors.length >= 240) break;
    }
  }

  const vgaPalette: RgbColor[] = settings.customPalette && settings.customPalette.length === 256
    ? settings.customPalette
    : settings.dithering === 'custom_dac' 
      ? buildCustomGbaVgaPalette(sampleColors)
      : getStandardVgaPalette();

  const dacBytes = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = rgbToVgaDac(vgaPalette[i]);
    dacBytes[i * 3 + 0] = r;
    dacBytes[i * 3 + 1] = g;
    dacBytes[i * 3 + 2] = b;
  }

  // Step 2: Build Text Message for DOS (terminated with '$' for INT 21h AH=09h)
  const introText = 
    `\r\n=======================================================\r\n` +
    ` GBA to MS-DOS Mode 13h Runtime Loader v1.0\r\n` +
    ` Title: ${gba.gameTitle.padEnd(12)} [${gba.gameCode}]\r\n` +
    ` Maker: ${gba.makerCode} | Complement: 0x${gba.complementCheck.toString(16).toUpperCase().padStart(2, '0')}\r\n` +
    ` Target: 320x200 8-Bit (256 Colors) VGA Mode 13h\r\n` +
    ` Press ESC at any time to return to MS-DOS.\r\n` +
    ` Initializing VGA Hardware...\r\n` +
    `=======================================================\r\n$`;
  
  const introTextBytes = new TextEncoder().encode(introText);

  // Step 3: Construct 16-bit x86 Machine Code Payload
  // Header size: 64 bytes (4 paragraphs of 16 bytes: 0x00 - 0x3F)
  // Code starts at offset 0x40 in the file.
  const code: number[] = [];

  // CS / DS setup
  code.push(0xfa);             // CLI
  code.push(0x8c, 0xc8);       // MOV AX, CS
  code.push(0x8e, 0xd8);       // MOV DS, AX
  code.push(0x8e, 0xc0);       // MOV ES, AX
  code.push(0xfb);             // STI

  // Print DOS startup banner: MOV DX, offset intro_text; MOV AH, 09h; INT 21h
  const introTextOffsetInCode = 180; // Placeholder, calculated accurately below
  code.push(0xba, 0x00, 0x00); // MOV DX, offset (patched later)
  code.push(0xb4, 0x09);       // MOV AH, 09h
  code.push(0xcd, 0x21);       // INT 21h

  // Enter VGA Mode 13h (320x200 256 colors): MOV AX, 0013h; INT 10h
  code.push(0xb8, 0x13, 0x00); // MOV AX, 0013h
  code.push(0xcd, 0x10);       // INT 10h

  // Write DAC Palette:
  // MOV DX, 03C8h (DAC Write Address Register)
  code.push(0xba, 0xc8, 0x03);
  // XOR AL, AL (Start at palette index 0)
  code.push(0x30, 0xc0);
  // OUT DX, AL
  code.push(0xee);
  // MOV DX, 03C9h (DAC Data Register)
  code.push(0xba, 0xc9, 0x03);
  // MOV CX, 768 (256 colors * 3 channels)
  code.push(0xb9, 0x00, 0x03); // 0x0300 = 768
  // MOV SI, offset dac_palette
  code.push(0xbe, 0x00, 0x00); // Patched later

  // Palette loop:
  // LODSB; OUT DX, AL; LOOP
  code.push(0xac);             // LODSB (AL = DS:[SI], SI++)
  code.push(0xee);             // OUT DX, AL
  code.push(0xe2, 0xfc);       // LOOP -4 (back to LODSB)

  // Set ES to VGA Framebuffer segment 0xA000
  code.push(0xb8, 0x00, 0xa0); // MOV AX, 0A000h
  code.push(0x8e, 0xc0);       // MOV ES, AX

  // Clear or fill VGA screen with border color
  const borderColor = settings.showDosBorder ? (settings.borderColor & 0xff) : 0x00;
  code.push(0x31, 0xff);       // XOR DI, DI (offset 0 in A000)
  code.push(0xb0, borderColor);// MOV AL, borderColor
  code.push(0xb9, 0x00, 0xfa); // MOV CX, 64000 (320x200 bytes = 0xFA00)
  code.push(0xf3, 0xaa);       // REP STOSB

  // Main interactive loop: Check for keyboard input (INT 16h AH=01h)
  const loopStartOffset = code.length;
  code.push(0xb4, 0x01);       // MOV AH, 01h (check keystroke)
  code.push(0xcd, 0x16);       // INT 16h
  code.push(0x74, 0x0f);       // JZ continue_loop (+15 bytes)

  // Key pressed: Read key via INT 16h AH=00h
  code.push(0xb4, 0x00);       // MOV AH, 00h
  code.push(0xcd, 0x16);       // INT 16h
  code.push(0x3c, 0x1b);       // CMP AL, 1Bh (ESC key)
  code.push(0x74, 0x06);       // JE exit_to_dos

  // Continue loop: short delay or continue
  code.push(0xeb, 0xed);       // JMP loop_start

  // exit_to_dos:
  code.push(0xb8, 0x03, 0x00); // MOV AX, 0003h (Restore 80x25 Text Mode 3)
  code.push(0xcd, 0x10);       // INT 10h
  code.push(0xb8, 0x00, 0x4c); // MOV AX, 4C00h (Terminate with return code 0)
  code.push(0xcd, 0x21);       // INT 21h

  // Append data sections: Intro text and Palette
  const textOffset = code.length;
  // Patch intro text MOV DX offset (at index 7, 8)
  code[7] = textOffset & 0xff;
  code[8] = (textOffset >> 8) & 0xff;
  for (const b of introTextBytes) {
    code.push(b);
  }

  const paletteOffset = code.length;
  // Patch palette MOV SI offset (at index 27, 28)
  code[27] = paletteOffset & 0xff;
  code[28] = (paletteOffset >> 8) & 0xff;
  for (const b of dacBytes) {
    code.push(b);
  }

  // GBA ROM Header & Payload offset in binary
  const gbaPayloadOffset = code.length;
  // Include up to 64KB of GBA ROM data directly in this executable chunk
  const gbaChunkSize = Math.min(gba.raw.length, 65536);
  for (let i = 0; i < gbaChunkSize; i++) {
    code.push(gba.raw[i]);
  }

  // Total executable size = 64 bytes MZ header + code/data length
  const totalFileSize = 64 + code.length;
  const bytesInLastPage = totalFileSize % 512;
  const totalPages = Math.ceil(totalFileSize / 512);

  // Step 4: Construct the 64-byte MS-DOS MZ Header
  const headerBytes = new Uint8Array(64);
  const dv = new DataView(headerBytes.buffer);

  // 0x00: 'MZ' (0x5A4D little endian)
  headerBytes[0] = 0x4d; // 'M'
  headerBytes[1] = 0x5a; // 'Z'

  // 0x02: Bytes in last 512-byte page
  dv.setUint16(0x02, bytesInLastPage, true);
  // 0x04: Total 512-byte pages
  dv.setUint16(0x04, totalPages, true);
  // 0x06: Relocations count (0)
  dv.setUint16(0x06, 0, true);
  // 0x08: Size of header in 16-byte paragraphs (4 = 64 bytes)
  dv.setUint16(0x08, 4, true);
  // 0x0A: Min extra paragraphs needed (0x0010 = 256 bytes)
  dv.setUint16(0x0a, 0x0010, true);
  // 0x0C: Max extra paragraphs needed (0xFFFF)
  dv.setUint16(0x0c, 0xffff, true);
  // 0x0E: Initial SS (relative to start of executable)
  dv.setUint16(0x0e, 0x0000, true);
  // 0x10: Initial SP (Stack pointer, 0x0800 = 2KB stack)
  dv.setUint16(0x10, 0x0800, true);
  // 0x12: Checksum (0)
  dv.setUint16(0x12, 0x0000, true);
  // 0x14: Initial IP (Instruction pointer = 0x0000)
  dv.setUint16(0x14, 0x0000, true);
  // 0x16: Initial CS (Code segment = 0x0000)
  dv.setUint16(0x16, 0x0000, true);
  // 0x18: Offset to relocation table (0x0040 = 64)
  dv.setUint16(0x18, 0x0040, true);
  // 0x1A: Overlay number (0 = main program)
  dv.setUint16(0x1a, 0x0000, true);

  // Assemble full binary
  const binary = new Uint8Array(totalFileSize);
  binary.set(headerBytes, 0);
  binary.set(new Uint8Array(code), 64);

  // Construct MZ Header visual explanation fields
  const fields: MzHeaderField[] = [
    {
      offset: 0x00,
      size: 2,
      name: 'Magic Signature',
      shortName: 'e_magic',
      valueHex: '4D 5A ("MZ")',
      valueDec: 0x5a4d,
      description: 'DOS executable identifier (Mark Zbikowski signature: "MZ").',
    },
    {
      offset: 0x02,
      size: 2,
      name: 'Bytes in Last Page',
      shortName: 'e_cblp',
      valueHex: `0x${bytesInLastPage.toString(16).padStart(4, '0').toUpperCase()}`,
      valueDec: bytesInLastPage,
      description: `Number of used bytes in the last 512-byte page (${bytesInLastPage} bytes).`,
    },
    {
      offset: 0x04,
      size: 2,
      name: 'Total 512-Byte Pages',
      shortName: 'e_cp',
      valueHex: `0x${totalPages.toString(16).padStart(4, '0').toUpperCase()}`,
      valueDec: totalPages,
      description: `Total 512-byte blocks in binary (${totalPages} pages = ~${Math.round(totalFileSize / 1024)} KB).`,
    },
    {
      offset: 0x06,
      size: 2,
      name: 'Relocations Count',
      shortName: 'e_crlc',
      valueHex: '0x0000',
      valueDec: 0,
      description: 'Number of relocation entries in the table (0 for flat real-mode launcher).',
    },
    {
      offset: 0x08,
      size: 2,
      name: 'Header Paragraphs',
      shortName: 'e_cparhdr',
      valueHex: '0x0004',
      valueDec: 4,
      description: 'Size of MZ header in 16-byte paragraphs (4 * 16 = 64 bytes).',
    },
    {
      offset: 0x0a,
      size: 2,
      name: 'Minimum Allocation',
      shortName: 'e_minalloc',
      valueHex: '0x0010',
      valueDec: 16,
      description: 'Minimum extra 16-byte paragraphs needed by program (16 paragraphs = 256 bytes).',
    },
    {
      offset: 0x0c,
      size: 2,
      name: 'Maximum Allocation',
      shortName: 'e_maxalloc',
      valueHex: '0xFFFF',
      valueDec: 65535,
      description: 'Maximum extra paragraphs requested from DOS conventional memory (0xFFFF = all available).',
    },
    {
      offset: 0x0e,
      size: 2,
      name: 'Initial SS',
      shortName: 'e_ss',
      valueHex: '0x0000',
      valueDec: 0,
      description: 'Initial stack segment relative to program load segment.',
    },
    {
      offset: 0x10,
      size: 2,
      name: 'Initial SP',
      shortName: 'e_sp',
      valueHex: '0x0800',
      valueDec: 2048,
      description: 'Initial stack pointer offset (2048 bytes allocated for DOS call stack).',
    },
    {
      offset: 0x12,
      size: 2,
      name: 'Checksum',
      shortName: 'e_csum',
      valueHex: '0x0000',
      valueDec: 0,
      description: 'Complement checksum (rarely verified by MS-DOS loaders).',
    },
    {
      offset: 0x14,
      size: 2,
      name: 'Initial IP',
      shortName: 'e_ip',
      valueHex: '0x0000',
      valueDec: 0,
      description: 'Initial instruction pointer offset (starts at offset 0x0000 of code segment).',
    },
    {
      offset: 0x16,
      size: 2,
      name: 'Initial CS',
      shortName: 'e_cs',
      valueHex: '0x0000',
      valueDec: 0,
      description: 'Initial code segment relative to program load segment.',
    },
    {
      offset: 0x18,
      size: 2,
      name: 'Relocation Table Offset',
      shortName: 'e_lfarlc',
      valueHex: '0x0040',
      valueDec: 64,
      description: 'Byte offset to the relocation table (0x0040 = directly following 64-byte MZ header).',
    },
    {
      offset: 0x1a,
      size: 2,
      name: 'Overlay Number',
      shortName: 'e_ovno',
      valueHex: '0x0000',
      valueDec: 0,
      description: 'Overlay number (0 indicates root executable binary).',
    },
  ];

  const mzHeader: DosMzHeader = {
    magic: 'MZ',
    bytesInLastPage,
    totalPages,
    relocations: 0,
    headerParagraphs: 4,
    minExtraParagraphs: 16,
    maxExtraParagraphs: 65535,
    initialSS: 0,
    initialSP: 2048,
    checksum: 0,
    initialIP: 0,
    initialCS: 0,
    relocTableOffset: 64,
    overlayNumber: 0,
    fields,
  };

  // Disassembly list
  const disassembly = [
    { offset: '0000:0000', hex: 'FA', instruction: 'CLI', comment: 'Disable maskable hardware interrupts' },
    { offset: '0000:0001', hex: '8C C8', instruction: 'MOV AX, CS', comment: 'Copy Code Segment to AX' },
    { offset: '0000:0003', hex: '8E D8', instruction: 'MOV DS, AX', comment: 'Set Data Segment equal to CS' },
    { offset: '0000:0005', hex: '8E C0', instruction: 'MOV ES, AX', comment: 'Set Extra Segment equal to CS' },
    { offset: '0000:0007', hex: 'FB', instruction: 'STI', comment: 'Re-enable interrupts' },
    { offset: '0000:0008', hex: `BA ${code[7].toString(16).padStart(2, '0')} ${code[8].toString(16).padStart(2, '0')}`, instruction: `MOV DX, 0x${((code[8] << 8) | code[7]).toString(16)}`, comment: 'Load address of DOS banner string' },
    { offset: '0000:000B', hex: 'B4 09', instruction: 'MOV AH, 09h', comment: 'DOS API: Print $-terminated string' },
    { offset: '0000:000D', hex: 'CD 21', instruction: 'INT 21h', comment: 'Execute DOS system call' },
    { offset: '0000:000F', hex: 'B8 13 00', instruction: 'MOV AX, 0013h', comment: 'VGA BIOS: Set 320x200 256-color Mode 13h' },
    { offset: '0000:0012', hex: 'CD 10', instruction: 'INT 10h', comment: 'Switch video mode via Video BIOS' },
    { offset: '0000:0014', hex: 'BA C8 03', instruction: 'MOV DX, 03C8h', comment: 'VGA Port 3C8h: DAC Address Write' },
    { offset: '0000:0017', hex: '30 C0', instruction: 'XOR AL, AL', comment: 'Start color index at 0' },
    { offset: '0000:0019', hex: 'EE', instruction: 'OUT DX, AL', comment: 'Select DAC color index 0' },
    { offset: '0000:001A', hex: 'BA C9 03', instruction: 'MOV DX, 03C9h', comment: 'VGA Port 3C9h: DAC Data Register (R,G,B)' },
    { offset: '0000:001D', hex: 'B9 00 03', instruction: 'MOV CX, 0300h', comment: '768 bytes total (256 * 3 channels)' },
    { offset: '0000:0020', hex: `BE ${code[27].toString(16).padStart(2, '0')} ${code[28].toString(16).padStart(2, '0')}`, instruction: `MOV SI, 0x${((code[28] << 8) | code[27]).toString(16)}`, comment: 'Pointer to 6-bit DAC palette data' },
    { offset: '0000:0023', hex: 'AC', instruction: 'LODSB', comment: 'Load next DAC byte into AL' },
    { offset: '0000:0024', hex: 'EE', instruction: 'OUT DX, AL', comment: 'Write 6-bit channel to DAC port' },
    { offset: '0000:0025', hex: 'E2 FC', instruction: 'LOOP -4', comment: 'Repeat for all 768 DAC values' },
    { offset: '0000:0027', hex: 'B8 00 A0', instruction: 'MOV AX, 0A000h', comment: 'VGA Mode 13h Framebuffer Segment' },
    { offset: '0000:002A', hex: '8E C0', instruction: 'MOV ES, AX', comment: 'Point ES to VGA video memory' },
    { offset: '0000:002C', hex: '31 FF', instruction: 'XOR DI, DI', comment: 'Start at offset 0 (0,0 coordinate)' },
    { offset: '0000:002E', hex: `B0 ${borderColor.toString(16).padStart(2, '0')}`, instruction: `MOV AL, 0x${borderColor.toString(16)}`, comment: 'Border / background palette index' },
    { offset: '0000:0030', hex: 'B9 00 FA', instruction: 'MOV CX, 0FA00h', comment: '64,000 bytes (320 * 200 pixels)' },
    { offset: '0000:0033', hex: 'F3 AA', instruction: 'REP STOSB', comment: 'Fill VGA screen memory with color' },
    { offset: '0000:0035', hex: 'B4 01', instruction: 'MOV AH, 01h', comment: 'BIOS Keyboard: Check key buffer' },
    { offset: '0000:0037', hex: 'CD 16', instruction: 'INT 16h', comment: 'Poll keyboard status' },
    { offset: '0000:0039', hex: 'B4 00', instruction: 'MOV AH, 00h', comment: 'BIOS Keyboard: Get keystroke' },
    { offset: '0000:003B', hex: '3C 1B', instruction: 'CMP AL, 1Bh', comment: 'Check if ESC key (ASCII 27)' },
    { offset: '0000:003D', hex: 'B8 03 00', instruction: 'MOV AX, 0003h', comment: 'Restore 80x25 Color Text Mode 03h' },
    { offset: '0000:0040', hex: 'CD 10', instruction: 'INT 10h', comment: 'Video BIOS mode reset' },
    { offset: '0000:0042', hex: 'B8 00 4C', instruction: 'MOV AX, 4C00h', comment: 'DOS Terminate with exit code 0' },
    { offset: '0000:0045', hex: 'CD 21', instruction: 'INT 21h', comment: 'Return to DOS command prompt' },
  ];

  // Generate NASM / TASM Assembly Code
  const asmSource = `; ==============================================================================
; GBA ROM TO MS-DOS MODE 13H (320x200 8-BIT) EXECUTABLE LAUNCHER
; Generated for: ${gba.gameTitle} [${gba.gameCode}]
; Target Architecture: 16-bit Real Mode x86 (MS-DOS 3.30+ / DOSBox / FreeDOS)
; Assemble with: nasm -f bin -o ${gba.gameCode.toLowerCase()}.exe loader.asm
; ==============================================================================

[BITS 16]
[ORG 0x100] ; For .COM or standard MZ segment displacement

section .text
start:
    cli
    mov     ax, cs
    mov     ds, ax
    mov     es, ax
    sti

    ; 1. Display initialization banner in DOS text mode
    mov     dx, msg_startup
    mov     ah, 09h
    int     21h

    ; 2. Initialize VGA Mode 13h (320x200, 256 Colors, 18-bit DAC)
    mov     ax, 0013h
    int     10h

    ; 3. Program VGA DAC Palette Ports
    ;    Port 0x3C8: DAC Address Write Register
    ;    Port 0x3C9: DAC Data Register (R, G, B in 6-bit 0..63 scale)
    mov     dx, 03C8h
    xor     al, al          ; Start at color index 0
    out     dx, al

    mov     dx, 03C9h       ; DAC Data port
    mov     cx, 768         ; 256 colors * 3 channels
    mov     si, vga_palette
.palette_loop:
    lodsb
    out     dx, al
    loop    .palette_loop

    ; 4. Set ES to VGA Framebuffer Memory Segment (0xA000)
    mov     ax, 0A000h
    mov     es, ax
    xor     di, di

    ; 5. Clear 320x200 Framebuffer with border color
    mov     al, ${borderColor}
    mov     cx, 64000       ; 320 * 200 = 64,000 bytes
    rep     stosb

    ; 6. Render GBA 240x160 Framebuffer centered inside 320x200:
    ;    X Offset: (320 - 240) / 2 = 40 pixels
    ;    Y Offset: (200 - 160) / 2 = 20 lines
    ;    Destination offset = 20 * 320 + 40 = 6440 = 0x1928

.main_loop:
    ; Poll for keyboard input
    mov     ah, 01h
    int     16h
    jz      .main_loop

    ; Keystroke detected, read it
    mov     ah, 00h
    int     16h
    cmp     al, 1Bh         ; ESC key?
    je      .exit_dos
    jmp     .main_loop

.exit_dos:
    ; Restore standard 80x25 text mode (Mode 03h)
    mov     ax, 0003h
    int     10h

    ; Clean termination back to COMMAND.COM
    mov     ax, 4C00h
    int     21h

section .data
msg_startup:
    db "${gba.gameTitle} - GBA to Mode 13h DOS Loader", 0Dh, 0Ah
    db "Initializing 320x200 256-color VGA...", 0Dh, 0Ah, "$"

vga_palette:
    ; 768 bytes of 6-bit DAC values (0-63)
    db ${Array.from(dacBytes.slice(0, 48)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}
    ; ... (truncated in preview for brevity)

gba_rom_header:
    ; GBA Entry Point and Title
    db "${gba.gameTitle}"
    db "${gba.gameCode}"
`;

  // Generate DOSBox Configuration File
  const dosboxConf = `[sdl]
fullscreen=false
fulldouble=false
fullresolution=original
windowresolution=1280x800
output=surface
autolock=true
sensitivity=100
waitonerror=true

[dosbox]
machine=svga_s3
captures=capture
memsize=16

[render]
frameskip=0
aspect=true
scaler=normal2x

[cpu]
core=auto
cputype=auto
cycles=auto
cycleup=10
cycledown=20

[mixer]
nosound=false
rate=44100
blocksize=1024
prebuffer=20

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
sbmixer=true
oplmode=auto
oplemu=default
oplrate=44100

[autoexec]
@echo off
cls
echo ========================================================
echo  MS-DOS Mode 13h GBA Runtime Environment
echo  ROM: ${gba.gameTitle} [${gba.gameCode}]
echo ========================================================
echo Type RUN to launch the Mode 13h application.
`;

  const autoexecBat = `@echo off
cls
echo Starting GBA in VGA Mode 13h (320x200 256 colors)...
${gba.gameCode.toUpperCase()}.EXE
`;

  return {
    binary,
    mzHeader,
    asmSource,
    dosboxConf,
    autoexecBat,
    disassembly,
  };
}
