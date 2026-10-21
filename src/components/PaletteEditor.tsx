import React, { useState, useMemo } from 'react';
import { GbaHeader, VgaModeSettings } from '../types/gba_dos';
import {
  RgbColor,
  getStandardVgaPalette,
  rgbToVgaDac,
  vgaDacToRgb,
  hexToRgb,
  rgbToHex,
  rgbToBgr555,
  bgr555To5BitComponents,
  exportJascPal,
  exportAdobeAct,
  buildCustomGbaVgaPalette,
} from '../utils/vgaPalette';
import {
  Palette,
  ArrowRight,
  RotateCcw,
  Sliders,
  Download,
  Sparkles,
  Info,
  Check,
  Cpu,
} from 'lucide-react';

interface PaletteEditorProps {
  gba: GbaHeader;
  settings: VgaModeSettings;
  onChangeSettings: (updater: (prev: VgaModeSettings) => VgaModeSettings) => void;
}

export const PaletteEditor: React.FC<PaletteEditorProps> = ({
  gba,
  settings,
  onChangeSettings,
}) => {
  // Current 256-color palette (defaults to custom palette if already set, or builds from GBA colors)
  const currentPalette: RgbColor[] = useMemo(() => {
    if (settings.customPalette && settings.customPalette.length === 256) {
      return settings.customPalette;
    }
    const sampleRgb = gba.paletteColors.map(hexToRgb);
    return buildCustomGbaVgaPalette(sampleRgb);
  }, [settings.customPalette, gba.paletteColors]);

  // Selected VGA DAC Slot (0-255)
  const [selectedVgaIndex, setSelectedVgaIndex] = useState<number>(16);

  // Selected GBA Color Index
  const [selectedGbaIndex, setSelectedGbaIndex] = useState<number>(0);

  // Active color at selected VGA slot
  const activeVgaColor = currentPalette[selectedVgaIndex] || { r: 0, g: 0, b: 0 };
  const activeVgaDac = rgbToVgaDac(activeVgaColor);

  // Active selected GBA color
  const activeGbaHex = gba.paletteColors[selectedGbaIndex] || '#000000';
  const activeGbaRgb = hexToRgb(activeGbaHex);
  const activeGbaWord = rgbToBgr555(activeGbaRgb);
  const [gbaR5, gbaG5, gbaB5] = bgr555To5BitComponents(activeGbaWord);

  // Quantized GBA to 6-bit DAC values
  const gbaDacR6 = Math.round((gbaR5 * 63) / 31);
  const gbaDacG6 = Math.round((gbaG5 * 63) / 31);
  const gbaDacB6 = Math.round((gbaB5 * 63) / 31);
  const gbaQuantizedRgb = vgaDacToRgb([gbaDacR6, gbaDacG6, gbaDacB6]);

  // Update a single VGA DAC slot
  const updateVgaSlot = (index: number, newRgb: RgbColor) => {
    const updated = [...currentPalette];
    updated[index] = newRgb;
    onChangeSettings(prev => ({ ...prev, customPalette: updated }));
  };

  // Direct 6-bit DAC slider change for active slot
  const handleDacChannelChange = (channel: 'r' | 'g' | 'b', val6: number) => {
    const clamped = Math.min(63, Math.max(0, val6));
    const [currR, currG, currB] = activeVgaDac;
    const newDac: [number, number, number] = [
      channel === 'r' ? clamped : currR,
      channel === 'g' ? clamped : currG,
      channel === 'b' ? clamped : currB,
    ];
    updateVgaSlot(selectedVgaIndex, vgaDacToRgb(newDac));
  };

  // Map selected GBA color to the selected VGA slot
  const handleMapGbaToVgaSlot = () => {
    updateVgaSlot(selectedVgaIndex, gbaQuantizedRgb);
  };

  // Auto-map all extracted GBA colors sequentially into VGA slots starting at index 16
  const handleAutoMapAll = () => {
    const updated = [...currentPalette];
    gba.paletteColors.forEach((hex, i) => {
      const vgaSlot = 16 + i;
      if (vgaSlot < 256) {
        const rgb = hexToRgb(hex);
        const dac = rgbToVgaDac(rgb);
        updated[vgaSlot] = vgaDacToRgb(dac);
      }
    });
    onChangeSettings(prev => ({ ...prev, customPalette: updated }));
  };

  // Reset to default IBM standard Mode 13h palette
  const handleResetToStandard = () => {
    const std = getStandardVgaPalette();
    onChangeSettings(prev => ({ ...prev, customPalette: std }));
  };

  // Download palette files
  const handleDownloadPal = () => {
    const palText = exportJascPal(currentPalette);
    const blob = new Blob([palText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${gba.gameCode.toLowerCase()}_vga.pal`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-sm font-bold text-neutral-100 font-dos">
              GBA to VGA DAC 256-Color Palette Mapper &amp; Quantizer
            </h2>
            <div className="text-xs text-neutral-400 mt-0.5">
              15-Bit BGR555 (32,768 Colors) Downsampled to 18-Bit VGA DAC (256 Indexed Slots, Ports 0x3C8/0x3C9)
            </div>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoMapAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-medium transition-colors"
            title="Auto-map all extracted GBA colors into VGA DAC slots 16-255"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Map GBA Colors</span>
          </button>
          <button
            onClick={handleResetToStandard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            title="Restore standard IBM BIOS 256-color palette"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Standard</span>
          </button>
          <button
            onClick={handleDownloadPal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            title="Download JASC-PAL color palette"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .PAL</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 256-Color VGA DAC Table Grid (16x16) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-200">
              VGA 256-Color DAC Table (Mode 13h)
            </span>
            <span className="text-neutral-400 font-mono text-[11px]">
              Slot: #{selectedVgaIndex} (0x{selectedVgaIndex.toString(16).padStart(2, '0').toUpperCase()}) · {rgbToHex(activeVgaColor)}
            </span>
          </div>

          {/* 16x16 Interactive Palette Matrix */}
          <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 shadow-inner">
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 sm:gap-1.5 aspect-square max-h-[380px]">
              {currentPalette.map((col, idx) => {
                const isSelected = selectedVgaIndex === idx;
                const isCgaBase = idx < 16;
                const isGrayRamp = idx >= 16 && idx < 32;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedVgaIndex(idx)}
                    className={`relative rounded-xs sm:rounded-sm transition-all focus:outline-none ${
                      isSelected
                        ? 'ring-2 ring-amber-400 scale-125 z-10 shadow-lg'
                        : 'hover:scale-110 hover:z-5'
                    }`}
                    style={{ backgroundColor: rgbToHex(col) }}
                    title={`Slot #${idx} (0x${idx.toString(16).padStart(2, '0').toUpperCase()}): ${rgbToHex(col)} [DAC R:${rgbToVgaDac(col)[0]} G:${rgbToVgaDac(col)[1]} B:${rgbToVgaDac(col)[2]}]`}
                  >
                    {/* Subtle marker for slot 0 (black/border) and slot 15 (white) */}
                    {idx === 0 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[7px] text-white/50 font-mono">
                        0
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Color Zone Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-neutral-800/80 text-[11px] text-neutral-400 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-neutral-700"></span>
                <span>0-15: Standard CGA/EGA</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-neutral-400"></span>
                <span>16-31: Grayscale Ramp</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                <span>32-255: GBA Remapped Range</span>
              </div>
            </div>
          </div>

          {/* Extracted GBA 15-Bit Source Palette Swatches */}
          <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300">
                GBA Cartridge Palette ({gba.paletteColors.length} Colors Extracted)
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">
                Click color to inspect or map
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-neutral-900/60 rounded border border-neutral-800/60">
              {gba.paletteColors.map((hex, idx) => {
                const isSelected = selectedGbaIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedGbaIndex(idx)}
                    className={`relative w-6 h-6 rounded-xs transition-transform ${
                      isSelected
                        ? 'ring-2 ring-amber-400 scale-120 z-10 shadow-sm'
                        : 'hover:scale-110 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: hex }}
                    title={`GBA Color #${idx}: ${hex}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Visual Downsampling & Bit-Level Inspector */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Downsampling & Quantization Pipeline Visualizer */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-neutral-200 font-dos">
                15-Bit to 18-Bit DAC Downsampling Visualizer
              </span>
            </div>

            {/* Side-by-Side Swatch Comparison */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-900 rounded-lg border border-neutral-800/80">
              {/* GBA Source */}
              <div className="flex flex-col items-center text-center gap-1.5">
                <span className="text-[11px] font-mono text-neutral-400">GBA 15-Bit Input</span>
                <div
                  className="w-14 h-14 rounded-lg border border-neutral-700 shadow-md"
                  style={{ backgroundColor: activeGbaHex }}
                />
                <span className="font-mono text-xs font-bold text-neutral-100">
                  {activeGbaHex}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  BGR555: 0x{activeGbaWord.toString(16).padStart(4, '0').toUpperCase()}
                </span>
              </div>

              {/* Quantized VGA Output */}
              <div className="flex flex-col items-center text-center gap-1.5">
                <span className="text-[11px] font-mono text-amber-400 font-semibold">VGA DAC 18-Bit Output</span>
                <div
                  className="w-14 h-14 rounded-lg border border-amber-500/60 shadow-md"
                  style={{ backgroundColor: rgbToHex(gbaQuantizedRgb) }}
                />
                <span className="font-mono text-xs font-bold text-amber-300">
                  {rgbToHex(gbaQuantizedRgb)}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  DAC: [{gbaDacR6}, {gbaDacG6}, {gbaDacB6}]
                </span>
              </div>
            </div>

            {/* Bit-Level Conversion Breakdown Table */}
            <div className="space-y-2 text-xs font-mono">
              {/* Red Channel */}
              <div className="p-2 bg-neutral-900 rounded border border-neutral-800/60">
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span className="text-red-400 font-semibold">RED CHANNEL</span>
                  <span className="text-neutral-500">
                    5-bit: {gbaR5} (0..31) → 6-bit: {gbaDacR6} (0..63)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-300">
                  <span>GBA: [{gbaR5.toString(2).padStart(5, '0')}]</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                  <span className="text-amber-400">DAC: [{gbaDacR6.toString(2).padStart(6, '0')}]</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                  <span>24b: {gbaQuantizedRgb.r}</span>
                </div>
              </div>

              {/* Green Channel */}
              <div className="p-2 bg-neutral-900 rounded border border-neutral-800/60">
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span className="text-green-400 font-semibold">GREEN CHANNEL</span>
                  <span className="text-neutral-500">
                    5-bit: {gbaG5} (0..31) → 6-bit: {gbaDacG6} (0..63)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-300">
                  <span>GBA: [{gbaG5.toString(2).padStart(5, '0')}]</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                  <span className="text-amber-400">DAC: [{gbaDacG6.toString(2).padStart(6, '0')}]</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                  <span>24b: {gbaQuantizedRgb.g}</span>
                </div>
              </div>

              {/* Blue Channel */}
              <div className="p-2 bg-neutral-900 rounded border border-neutral-800/60">
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span className="text-blue-400 font-semibold">BLUE CHANNEL</span>
                  <span className="text-neutral-500">
                    5-bit: {gbaB5} (0..31) → 6-bit: {gbaDacB6} (0..63)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-300">
                  <span>GBA: [{gbaB5.toString(2).padStart(5, '0')}]</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                  <span className="text-amber-400">DAC: [{gbaDacB6.toString(2).padStart(6, '0')}]</span>
                  <ArrowRight className="w-3 h-3 text-neutral-600" />
                  <span>24b: {gbaQuantizedRgb.b}</span>
                </div>
              </div>
            </div>

            {/* Map Action Button */}
            <button
              onClick={handleMapGbaToVgaSlot}
              className="flex items-center justify-center gap-2 w-full py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Map GBA Color #{selectedGbaIndex} to VGA Slot #{selectedVgaIndex}</span>
            </button>
          </div>

          {/* Direct 6-Bit VGA DAC Channel Sliders (Ports 0x3C8/0x3C9) */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-neutral-200 font-dos">
                  Direct DAC Adjuster (VGA Port 0x3C9)
                </span>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">
                Editing Slot #{selectedVgaIndex}
              </span>
            </div>

            {/* Red Channel (0-63) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-red-400">DAC RED (6-bit)</span>
                <span className="text-neutral-300 tabular-nums">{activeVgaDac[0]} / 63</span>
              </div>
              <input
                type="range"
                min="0"
                max="63"
                value={activeVgaDac[0]}
                onChange={e => handleDacChannelChange('r', parseInt(e.target.value) || 0)}
                className="w-full accent-red-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Green Channel (0-63) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-green-400">DAC GREEN (6-bit)</span>
                <span className="text-neutral-300 tabular-nums">{activeVgaDac[1]} / 63</span>
              </div>
              <input
                type="range"
                min="0"
                max="63"
                value={activeVgaDac[1]}
                onChange={e => handleDacChannelChange('g', parseInt(e.target.value) || 0)}
                className="w-full accent-green-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Blue Channel (0-63) */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-blue-400">DAC BLUE (6-bit)</span>
                <span className="text-neutral-300 tabular-nums">{activeVgaDac[2]} / 63</span>
              </div>
              <input
                type="range"
                min="0"
                max="63"
                value={activeVgaDac[2]}
                onChange={e => handleDacChannelChange('b', parseInt(e.target.value) || 0)}
                className="w-full accent-blue-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Hardware Note */}
            <div className="flex items-start gap-2 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-500 leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-400" />
              <span>
                Standard VGA DAC hardware uses 6 bits per channel (values 0–63). Modifying these sliders immediately updates the live CRT monitor and the machine code payload embedded inside the MS-DOS binary.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
