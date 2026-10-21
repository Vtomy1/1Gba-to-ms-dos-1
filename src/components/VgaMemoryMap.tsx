import React, { useState } from 'react';
import { GbaHeader, VgaModeSettings } from '../types/gba_dos';
import { Database, Binary, Info, ArrowRight, Layers, Eye, Cpu } from 'lucide-react';

interface VgaMemoryMapProps {
  gba: GbaHeader;
  settings: VgaModeSettings;
}

interface MemoryRegion {
  id: string;
  name: string;
  startOffset: number;
  endOffset: number;
  sizeBytes: number;
  hexRange: string;
  segmentOffset: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
  x86Usage: string;
}

export const VgaMemoryMap: React.FC<VgaMemoryMapProps> = ({ gba, settings }) => {
  // Interactive coordinate calculators
  const [inspectX, setInspectX] = useState<number>(120); // GBA X center
  const [inspectY, setInspectY] = useState<number>(80);  // GBA Y center

  // Memory Regions in the 64KB 0xA000 Aperture
  const regions: MemoryRegion[] = [
    {
      id: 'top_border',
      name: 'VGA Top Letterbox Border',
      startOffset: 0x0000,
      endOffset: 0x1927,
      sizeBytes: 6440,
      hexRange: '0x0000 - 0x1927',
      segmentOffset: 'A000:0000 - A000:1927',
      colorClass: 'text-neutral-400',
      bgClass: 'bg-neutral-800',
      borderClass: 'border-neutral-700',
      description: 'First 20 scanlines of 320 pixels (20 * 320 = 6,400 bytes + 40 leading pixels) filled with border color or DOS bezel text.',
      x86Usage: 'rep stosb (sets initial border color at A000:0000)',
    },
    {
      id: 'gba_framebuffer',
      name: 'Active GBA 240×160 Framebuffer',
      startOffset: 0x1928,
      endOffset: 0xE0D7,
      sizeBytes: 51120, // Span covering 160 scanlines of 320 bytes
      hexRange: '0x1928 - 0xE0D7',
      segmentOffset: 'A000:1928 - A000:E0D7',
      colorClass: 'text-amber-400',
      bgClass: 'bg-amber-500/30',
      borderClass: 'border-amber-500',
      description: '160 active scanlines containing 240 GBA pixels centered with 40-pixel left and right borders per scanline (38,400 GBA pixels).',
      x86Usage: 'mov es:[di], al (rendered line-by-line via 320-byte stride)',
    },
    {
      id: 'bottom_border',
      name: 'VGA Bottom Letterbox Border',
      startOffset: 0xE0D8,
      endOffset: 0xF9FF,
      sizeBytes: 6440,
      hexRange: '0xE0D8 - 0xF9FF',
      segmentOffset: 'A000:E0D8 - A000:F9FF',
      colorClass: 'text-neutral-400',
      bgClass: 'bg-neutral-800',
      borderClass: 'border-neutral-700',
      description: 'Trailing 20 scanlines (Y=180 to Y=199) completing the 64,000-byte visible Mode 13h raster frame.',
      x86Usage: 'rep stosb (clears bottom border at A000:E0D8)',
    },
    {
      id: 'unused_scratch',
      name: 'Unused Video RAM / Scratchpad',
      startOffset: 0xFA00,
      endOffset: 0xFFFF,
      sizeBytes: 1536,
      hexRange: '0xFA00 - 0xFFFF',
      segmentOffset: 'A000:FA00 - A000:FFFF',
      colorClass: 'text-indigo-400',
      bgClass: 'bg-indigo-500/20',
      borderClass: 'border-indigo-500/50',
      description: 'Remaining 1,536 bytes of the 64KB video memory aperture. Frequently utilized by DOS demosceners for off-screen sprite buffers or font caches.',
      x86Usage: 'Free for off-screen scratchpad or double buffer storage',
    },
  ];

  const [selectedRegion, setSelectedRegion] = useState<MemoryRegion>(regions[1]);

  // Coordinate Calculations
  const isCentered = settings.scaling === 'centered';
  const vgaX = isCentered ? inspectX + 40 : Math.round((inspectX * 320) / 240);
  const vgaY = isCentered ? inspectY + 20 : Math.round((inspectY * 200) / 160);
  const vgaOffset = vgaY * 320 + vgaX;
  const vgaHexOffset = '0x' + vgaOffset.toString(16).padStart(4, '0').toUpperCase();
  const physicalAddr = '0x' + (0xa0000 + vgaOffset).toString(16).toUpperCase();
  const gbaVramOffset = '0x0600' + ((inspectY * 240 + inspectX) * 2).toString(16).padStart(4, '0').toUpperCase();

  return (
    <div className="flex flex-col gap-5 p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-sm font-bold text-neutral-100 font-dos">
              VGA 64KB Video Memory Map &amp; Segment 0xA000 Architecture
            </h2>
            <div className="text-xs text-neutral-400 mt-0.5">
              Linear Framebuffer Layout: 320×200 Mode 13h Pixel Mapping vs. I/O Port DAC Registers
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-neutral-300">
            SEGMENT: <strong className="text-amber-400">0xA000</strong> (Physical: 0xA0000)
          </span>
          <span className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-neutral-300">
            TOTAL APERTURE: <strong className="text-neutral-100">65,536 Bytes (64 KB)</strong>
          </span>
        </div>
      </div>

      {/* 64KB Segmented Memory Bar (Proportional Visualization) */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-neutral-300">
            64KB Memory Aperture Segmentation (0x0000 - 0xFFFF)
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            Click any block to inspect segmentation
          </span>
        </div>

        {/* Segment Bar */}
        <div className="h-10 w-full bg-neutral-950 rounded-lg border border-neutral-800 p-1 flex gap-1 overflow-hidden">
          {regions.map((reg) => {
            const isSelected = selectedRegion.id === reg.id;
            const pct = (reg.sizeBytes / 65536) * 100;
            return (
              <button
                key={reg.id}
                onClick={() => setSelectedRegion(reg)}
                style={{ width: `${pct}%` }}
                className={`h-full rounded transition-all flex items-center justify-center relative overflow-hidden group ${
                  reg.bgClass
                } ${
                  isSelected
                    ? 'ring-2 ring-amber-400 z-10 shadow-md'
                    : 'opacity-80 hover:opacity-100'
                }`}
                title={`${reg.name}: ${reg.sizeBytes.toLocaleString()} bytes (${reg.hexRange})`}
              >
                <span className="text-[10px] font-mono font-bold truncate px-1 text-neutral-200">
                  {reg.id === 'gba_framebuffer' ? 'GBA 240×160 ACTIVE (38.4KB)' : reg.id === 'unused_scratch' ? 'SCRATCH' : 'BORDER'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Memory Bar Offsets Markers */}
        <div className="flex justify-between text-[10px] font-mono text-neutral-500 px-1">
          <span>0x0000 (0b)</span>
          <span>0x1928 (6,440b)</span>
          <span>0xE0D8 (57,560b)</span>
          <span>0xFA00 (64,000b)</span>
          <span>0xFFFF (65,535b)</span>
        </div>
      </div>

      {/* Selected Memory Region Inspector Card */}
      <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col md:flex-row items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold font-dos ${selectedRegion.colorClass}`}>
              {selectedRegion.name}
            </span>
            <span className="text-neutral-600">·</span>
            <span className="text-xs font-mono text-neutral-300">
              {selectedRegion.sizeBytes.toLocaleString()} Bytes ({selectedRegion.segmentOffset})
            </span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {selectedRegion.description}
          </p>
        </div>

        <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono space-y-1 shrink-0 w-full md:w-80">
          <div className="text-[10px] text-neutral-500 font-bold uppercase">x86 Real-Mode Code Pattern:</div>
          <div className="text-amber-400 font-semibold">{selectedRegion.x86Usage}</div>
          <div className="text-[10px] text-neutral-400">
            Address Span: <strong className="text-neutral-200">{selectedRegion.hexRange}</strong>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Coordinate Mapper on Left, Memory vs I/O Bus on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Coordinate & Memory Offset Resolver */}
        <div className="lg:col-span-7 flex flex-col gap-3 p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-neutral-200 font-dos">
                GBA ➔ VGA Pixel Coordinate &amp; Offset Resolver
              </h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              Stride: 320 Bytes per Scanline
            </span>
          </div>

          {/* Coordinate Sliders */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400">GBA Pixel X (0..239):</span>
                <span className="text-amber-400 font-bold">{inspectX}</span>
              </div>
              <input
                type="range"
                min="0"
                max="239"
                value={inspectX}
                onChange={(e) => setInspectX(parseInt(e.target.value) || 0)}
                className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400">GBA Pixel Y (0..159):</span>
                <span className="text-amber-400 font-bold">{inspectY}</span>
              </div>
              <input
                type="range"
                min="0"
                max="159"
                value={inspectY}
                onChange={(e) => setInspectY(parseInt(e.target.value) || 0)}
                className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Translation Formula & Address Breakdown */}
          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800/80 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-[11px]">
              <span className="text-neutral-400">Centering Formula:</span>
              <span className="text-neutral-200">
                X_vga = {inspectX} + 40 = <strong className="text-amber-400">{vgaX}</strong> · Y_vga = {inspectY} + 20 = <strong className="text-amber-400">{vgaY}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-neutral-500 block">VGA Buffer Linear Offset:</span>
                <span className="text-neutral-200 font-bold">{vgaOffset.toLocaleString()} ({vgaHexOffset})</span>
              </div>
              <div>
                <span className="text-neutral-500 block">DOS Real-Mode Segment:Offset:</span>
                <span className="text-amber-400 font-bold">A000:{vgaHexOffset.replace('0x', '')}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">x86 20-Bit Physical Address:</span>
                <span className="text-emerald-400 font-bold">{physicalAddr}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">GBA ARM Native VRAM:</span>
                <span className="text-neutral-300 font-bold">{gbaVramOffset}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 text-[11px] text-neutral-400 leading-relaxed font-sans">
              <strong className="text-neutral-200 font-mono">Real-Mode x86 Machine Code:</strong>
              <div className="mt-1 p-2 bg-neutral-950 rounded font-mono text-[10px] text-amber-300">
                MOV AX, 0A000h &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;; Set ES to VGA segment<br />
                MOV ES, AX<br />
                MOV DI, {vgaHexOffset}h &nbsp;&nbsp;&nbsp;; Offset = Y*320 + X ({vgaOffset})<br />
                MOV AL, [color_idx] &nbsp;; Load 8-bit DAC palette index (0..255)<br />
                MOV ES:[DI], AL &nbsp;&nbsp;&nbsp;&nbsp;; Write pixel to Mode 13h framebuffer
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Architectural Clarity: Video Memory (A000) vs I/O Ports (3C8/3C9) */}
        <div className="lg:col-span-5 flex flex-col gap-3 p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-bold text-neutral-200 font-dos">
              Dual Bus Architecture: Framebuffer RAM vs. DAC I/O Ports
            </h3>
          </div>

          <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
            {/* Bus 1: Memory Bus */}
            <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800/80 space-y-1">
              <div className="flex items-center justify-between text-neutral-200 font-bold text-xs">
                <span className="text-emerald-400">1. Memory Bus (Segment 0xA000)</span>
                <span className="text-[10px] font-mono text-neutral-400">CPU RAM Address Space</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                The 64,000 screen pixels are stored in the PC's memory map between physical addresses <code className="text-neutral-200 font-mono">0xA0000</code> and <code className="text-neutral-200 font-mono">0xAFA00</code>. Writing a byte here directly plots a pixel on CRT scanline <code className="text-neutral-200 font-mono">Y = Offset / 320</code>.
              </p>
            </div>

            {/* Bus 2: I/O Bus */}
            <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800/80 space-y-1">
              <div className="flex items-center justify-between text-neutral-200 font-bold text-xs">
                <span className="text-amber-400">2. I/O Bus (Ports 0x3C8 &amp; 0x3C9)</span>
                <span className="text-[10px] font-mono text-neutral-400">Separate I/O Port Space</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                The 256-color DAC palette is <strong>NOT</strong> stored in segment <code className="text-neutral-200 font-mono">0xA000</code>! It is configured via x86 <code className="text-amber-400 font-mono">IN / OUT</code> instructions to peripheral ports:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] font-mono text-neutral-300 pt-1 pl-1">
                <li><strong className="text-amber-400">Port 0x3C8:</strong> DAC Address Write (color index 0-255)</li>
                <li><strong className="text-amber-400">Port 0x3C9:</strong> DAC Data Port (3 bytes: R, G, B in 6-bit 0-63 scale)</li>
                <li><strong className="text-amber-400">Port 0x3C6:</strong> PEL Mask Register (default 0xFF)</li>
              </ul>
            </div>

            {/* Crucial Takeaway */}
            <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-neutral-300">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>
                Because DAC registers exist in I/O space, reprogramming the palette never reduces or fragments the 64KB video framebuffer at 0xA000.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
