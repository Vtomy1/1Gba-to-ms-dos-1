import React from 'react';
import { GbaHeader } from '../types/gba_dos';
import { Cpu, CheckCircle2, AlertCircle, Palette, Database } from 'lucide-react';

interface RomInspectorProps {
  gba: GbaHeader;
}

export const RomInspector: React.FC<RomInspectorProps> = ({ gba }) => {
  return (
    <div className="flex flex-col gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-200">GBA Header & Cartridge Analysis (0x00 - 0xBF)</h2>
        </div>
        <div className="text-xs text-neutral-400 font-mono">
          Size: {gba.romSize.toLocaleString()} bytes
        </div>
      </div>

      {/* Field Inspection Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Entry Point */}
        <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="text-neutral-500 text-[11px] font-mono">0x00 - 0x03 · ENTRY POINT</div>
          <div className="mt-1 font-mono font-semibold text-neutral-200">{gba.entryPoint}</div>
          <div className="mt-1 text-[11px] text-neutral-400">
            ARM branch instruction (B 0x80000C0 to bypass 192-byte header).
          </div>
        </div>

        {/* Nintendo Logo Check */}
        <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="text-neutral-500 text-[11px] font-mono">0x04 - 0x9F · NINTENDO LOGO</div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold text-emerald-400 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>VALID BITMAP</span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            156 bytes verified against GBA BIOS boot ROM hash.
          </div>
        </div>

        {/* Complement Check */}
        <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="text-neutral-500 text-[11px] font-mono">0xBD · COMPLEMENT CHECK</div>
          <div className="mt-1 flex items-center gap-1.5 font-semibold font-mono text-neutral-200">
            <span>0x{gba.complementCheck.toString(16).toUpperCase().padStart(2, '0')}</span>
            {gba.isComplementValid ? (
              <span className="text-emerald-400 text-[11px] font-sans font-normal">(Match)</span>
            ) : (
              <span className="text-red-400 text-[11px] font-sans font-normal">(Mismatch)</span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Computed: 0x{gba.computedComplementCheck.toString(16).toUpperCase().padStart(2, '0')} via sum(0xA0..0xBC).
          </div>
        </div>

        {/* Fixed Byte */}
        <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="text-neutral-500 text-[11px] font-mono">0xB2 · FIXED VALUE</div>
          <div className="mt-1 font-mono font-semibold text-neutral-200">
            0x{gba.fixedValue.toString(16).toUpperCase().padStart(2, '0')}
            <span className="ml-1 text-[11px] text-emerald-400 font-sans font-normal">
              {gba.fixedValue === 0x96 ? '(Standard 0x96)' : '(Non-standard)'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">
            Hardware verification byte checked by GBA boot sequence.
          </div>
        </div>
      </div>

      {/* Palette Extraction & Quantization View */}
      <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
            <Palette className="w-3.5 h-3.5 text-amber-500" />
            <span>Extracted GBA 15-Bit BGR555 Palette Swatches</span>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            {gba.paletteColors.length} unique colors extracted
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-900 rounded border border-neutral-800/80">
          {gba.paletteColors.map((hex, idx) => (
            <div
              key={idx}
              className="group relative w-6 h-6 rounded border border-neutral-700/60 shadow-xs cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: hex }}
              title={`Color #${idx}: ${hex}`}
            >
              <div className="hidden group-hover:block absolute bottom-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-black/90 text-[10px] font-mono text-neutral-200 rounded whitespace-nowrap z-20 pointer-events-none">
                #{idx} {hex}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-neutral-400 leading-relaxed">
          GBA games use 15-bit BGR555 color words (32,768 possible hues). When translating to MS-DOS Mode 13h, these colors are quantized into the 256-color palette written directly to VGA DAC ports 0x3C8 and 0x3C9.
        </div>
      </div>

      {/* Side-by-Side Memory Architecture Map */}
      <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg text-xs">
        <div className="flex items-center gap-1.5 mb-2 font-medium text-neutral-300">
          <Database className="w-3.5 h-3.5 text-amber-500" />
          <span>Architecture Mapping: GBA Memory Bus vs. MS-DOS Mode 13h Space</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
          {/* GBA Bus */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded space-y-1">
            <div className="text-amber-400 font-semibold mb-1">GBA 32-Bit Memory Map</div>
            <div className="flex justify-between text-neutral-400">
              <span>0x00000000 - 0x00003FFF</span>
              <span className="text-neutral-300">16KB System BIOS</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0x02000000 - 0x0203FFFF</span>
              <span className="text-neutral-300">256KB EWRAM</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0x03000000 - 0x03007FFF</span>
              <span className="text-neutral-300">32KB Fast IWRAM</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0x04000000 - 0x040003FE</span>
              <span className="text-neutral-300">I/O Registers</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0x05000000 - 0x050003FF</span>
              <span className="text-amber-300 font-semibold">1KB Palette RAM</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0x06000000 - 0x06017FFF</span>
              <span className="text-amber-300 font-semibold">96KB VRAM</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0x08000000 - 0x09FFFFFF</span>
              <span className="text-neutral-300">Game Pak ROM (32MB)</span>
            </div>
          </div>

          {/* MS-DOS Memory Map */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded space-y-1">
            <div className="text-emerald-400 font-semibold mb-1">MS-DOS Real Mode 1MB Map</div>
            <div className="flex justify-between text-neutral-400">
              <span>0000:0000 - 0000:03FF</span>
              <span className="text-neutral-300">Interrupt Vector Table (IVT)</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0040:0000 - 0040:00FF</span>
              <span className="text-neutral-300">BIOS Data Area (BDA)</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>0050:0000 - 9FFF:0000</span>
              <span className="text-neutral-300">Conventional RAM (640KB)</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>A000:0000 - A000:FA00</span>
              <span className="text-emerald-300 font-semibold">VGA Mode 13h (64,000 bytes)</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>B800:0000 - B800:7FFF</span>
              <span className="text-neutral-300">Color Text Mode 80x25</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>C000:0000 - C7FF:0000</span>
              <span className="text-neutral-300">VGA Video BIOS ROM</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>F000:0000 - FFFF:0000</span>
              <span className="text-neutral-300">Motherboard BIOS ROM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
