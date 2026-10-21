import React, { useState, useMemo } from 'react';
import { SAMPLE_GBA_ROMS } from './utils/sampleRoms';
import { parseGbaRom } from './utils/gbaParser';
import { buildDosMzExecutable } from './utils/dosExeBuilder';
import { GbaHeader, VgaModeSettings } from './types/gba_dos';
import { Header } from './components/Header';
import { RomSelector } from './components/RomSelector';
import { DosCrtMonitor } from './components/DosCrtMonitor';
import { Mode13hConverterSettings } from './components/Mode13hConverterSettings';
import { MzHeaderViewer } from './components/MzHeaderViewer';
import { RomInspector } from './components/RomInspector';
import { HexDisassembler } from './components/HexDisassembler';
import { PaletteEditor } from './components/PaletteEditor';
import { VgaMemoryMap } from './components/VgaMemoryMap';
import { InterruptDebugger } from './components/InterruptDebugger';
import { ExportModal } from './components/ExportModal';

export default function App() {
  const [selectedRomId, setSelectedRomId] = useState<string>('cyber_run');

  // Initial GBA ROM from sample
  const [currentGba, setCurrentGba] = useState<GbaHeader>(() => {
    const sample = SAMPLE_GBA_ROMS[0];
    return parseGbaRom(sample.generateRom());
  });

  // VGA Mode 13h Conversion Settings
  const [settings, setSettings] = useState<VgaModeSettings>({
    scaling: 'centered',
    dithering: 'custom_dac',
    audioTarget: 'sb16',
    phosphor: 'color',
    crtScanlines: true,
    crtCurvature: true,
    showDosBorder: true,
    borderColor: 1, // Classic DOS Blue border
  });

  const [activeSection, setActiveSection] = useState<string>('monitor');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Re-generate binary when ROM or settings change
  const builtExe = useMemo(() => {
    return buildDosMzExecutable(currentGba, settings);
  }, [currentGba, settings]);

  const handleSelectSample = (romId: string) => {
    setSelectedRomId(romId);
    const sample = SAMPLE_GBA_ROMS.find(r => r.id === romId);
    if (sample) {
      const parsed = parseGbaRom(sample.generateRom());
      setCurrentGba(parsed);
      setSettings(prev => ({ ...prev, customPalette: undefined }));
    }
  };

  const handleLoadCustomRom = (gba: GbaHeader) => {
    setSelectedRomId('custom');
    setCurrentGba(gba);
    setSettings(prev => ({ ...prev, customPalette: undefined }));
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* 3-Zone Top Bar Contract */}
      <Header
        activeSection={activeSection}
        onSelectSection={scrollToSection}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-8">
        {/* Cartridge Selector */}
        <RomSelector
          currentGba={currentGba}
          selectedRomId={selectedRomId}
          onSelectSample={handleSelectSample}
          onLoadCustomRom={handleLoadCustomRom}
        />

        {/* Hero Section: 2-Column Split (CRT Viewport on Left, Pipeline Settings on Right) */}
        <section id="monitor" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start scroll-mt-20">
          {/* Left Column: CRT Monitor & Live 320x200 Display */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <DosCrtMonitor
              gba={currentGba}
              settings={settings}
              onUpdateSettings={setSettings}
            />
          </div>

          {/* Right Column: Mode 13h Conversion Pipeline Controls & MZ Quick Card */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-3 gap-2.5 p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center">
              <div className="p-2 bg-neutral-950 rounded-lg">
                <div className="text-[10px] text-neutral-500 font-mono">MZ SIGNATURE</div>
                <div className="text-xs font-bold text-amber-400 font-dos mt-0.5">0x5A4D (MZ)</div>
              </div>
              <div className="p-2 bg-neutral-950 rounded-lg">
                <div className="text-[10px] text-neutral-500 font-mono">TARGET MODE</div>
                <div className="text-xs font-bold text-emerald-400 font-dos mt-0.5">320×200 256c</div>
              </div>
              <div className="p-2 bg-neutral-950 rounded-lg">
                <div className="text-[10px] text-neutral-500 font-mono">TOTAL PAGES</div>
                <div className="text-xs font-bold text-neutral-200 font-dos mt-0.5 tabular-nums">
                  {builtExe.mzHeader.totalPages} Pages
                </div>
              </div>
            </div>

            {/* Pipeline Settings Controls */}
            <Mode13hConverterSettings
              gba={currentGba}
              settings={settings}
              onChange={setSettings}
            />
          </div>
        </section>

        {/* Section 1: GBA to VGA DAC 256-Color Palette Mapper & Downsampling Visualizer */}
        <section id="palette_editor" className="scroll-mt-20">
          <PaletteEditor
            gba={currentGba}
            settings={settings}
            onChangeSettings={setSettings}
          />
        </section>

        {/* Section 2: VGA 64KB Video Memory Map & Segment 0xA000 Architecture */}
        <section id="vga_memory" className="scroll-mt-20">
          <VgaMemoryMap
            gba={currentGba}
            settings={settings}
          />
        </section>

        {/* Section 3: MS-DOS MZ Executable Header (0x5A4D) Deep Dive */}
        <section id="mz_header" className="scroll-mt-20">
          <MzHeaderViewer mzHeader={builtExe.mzHeader} />
        </section>

        {/* Section 4: Real-Mode INT 10h Video BIOS Interrupt Debugger */}
        <section id="int10_debugger" className="scroll-mt-20">
          <InterruptDebugger gba={currentGba} />
        </section>

        {/* Section 5: GBA Header & Cartridge Analysis (0x00 - 0xBF) */}
        <section id="gba_analyzer" className="scroll-mt-20">
          <RomInspector gba={currentGba} />
        </section>

        {/* Section 6: x86 Real-Mode Disassembly & Binary Hex Dump */}
        <section id="disassembly" className="scroll-mt-20">
          <HexDisassembler builtExe={builtExe} />
        </section>
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        builtExe={builtExe}
        gba={currentGba}
      />

      {/* Retro Industrial Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 mt-12 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-dos text-neutral-400">
            <span>MS-DOS VGA MODE 13h ARCHITECTURE</span>
            <span className="text-neutral-700">·</span>
            <span>INT 10h (AH=00h, AL=13h)</span>
            <span className="text-neutral-700">·</span>
            <span>PORT 0x3C8/0x3C9</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-500 text-[11px]">
            <span>GBA 240×160 15-Bit BGR555</span>
            <span>→</span>
            <span>VGA 320×200 8-Bit DAC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
