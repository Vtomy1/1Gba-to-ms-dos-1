import React from 'react';
import { Download, Terminal } from 'lucide-react';

interface HeaderProps {
  onOpenExport: () => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExport,
  activeSection,
  onSelectSection,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
        <Terminal className="w-5 h-5 text-amber-500" />
        <span className="text-base font-bold tracking-tight text-neutral-100 font-dos">
          GBA<span className="text-amber-500">→</span>MS-DOS 13h
        </span>
      </div>

      {/* Zone 2: clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
        <button
          onClick={() => onSelectSection('monitor')}
          className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${
            activeSection === 'monitor' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          CRT Mode 13h
        </button>
        <button
          onClick={() => onSelectSection('palette_editor')}
          className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${
            activeSection === 'palette_editor' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          Palette Editor
        </button>
        <button
          onClick={() => onSelectSection('vga_memory')}
          className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${
            activeSection === 'vga_memory' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          VGA Memory Map
        </button>
        <button
          onClick={() => onSelectSection('mz_header')}
          className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${
            activeSection === 'mz_header' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          MZ Header (0x5A4D)
        </button>
        <button
          onClick={() => onSelectSection('int10_debugger')}
          className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${
            activeSection === 'int10_debugger' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          INT 10h Debugger
        </button>
        <button
          onClick={() => onSelectSection('gba_analyzer')}
          className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${
            activeSection === 'gba_analyzer' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          GBA ROM Parser
        </button>
        <button
          onClick={() => onSelectSection('disassembly')}
          className={`hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 ${
            activeSection === 'disassembly' ? 'text-amber-400 font-semibold' : ''
          }`}
        >
          x86 Disassembly
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenExport}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export MZ .EXE</span>
        </button>
      </div>
    </header>
  );
};
