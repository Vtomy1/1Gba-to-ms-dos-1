import React, { useRef } from 'react';
import { SAMPLE_GBA_ROMS } from '../utils/sampleRoms';
import { GbaHeader } from '../types/gba_dos';
import { Upload, Gamepad2, FileCheck } from 'lucide-react';
import { parseGbaRom } from '../utils/gbaParser';

interface RomSelectorProps {
  currentGba: GbaHeader;
  selectedRomId: string;
  onSelectSample: (romId: string) => void;
  onLoadCustomRom: (gba: GbaHeader) => void;
}

export const RomSelector: React.FC<RomSelectorProps> = ({
  currentGba,
  selectedRomId,
  onSelectSample,
  onLoadCustomRom,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          const parsed = parseGbaRom(buffer);
          onLoadCustomRom(parsed);
        } catch (err) {
          alert((err as Error).message);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-200">GBA ROM Cartridge Source</h2>
        </div>
        <div className="text-xs text-neutral-400">
          <span>{currentGba.gameTitle}</span>
          <span className="mx-1 text-neutral-600">·</span>
          <span className="font-mono text-amber-400">{(currentGba.romSize / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      {/* Preset ROM Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {SAMPLE_GBA_ROMS.map((rom) => {
          const isSelected = selectedRomId === rom.id;
          return (
            <button
              key={rom.id}
              onClick={() => onSelectSample(rom.id)}
              className={`p-3 text-left rounded-lg border transition-all ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-neutral-100'
                  : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-dos font-semibold text-xs tracking-wide">
                  {rom.title}
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  [{rom.gameCode}]
                </span>
              </div>
              <div className="text-[11px] text-amber-400/90 font-medium mb-1">
                {rom.genre}
              </div>
              <div className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                {rom.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Upload Custom ROM Option */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800 text-xs">
        <div className="text-neutral-400">
          <span>Have an existing GBA ROM or Homebrew?</span>
          <span className="hidden sm:inline text-neutral-500 ml-1">
            Loads standard .gba / .bin binaries and analyzes ARM header.
          </span>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".gba,.bin"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 rounded-md font-medium text-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-400" />
            <span>Upload .GBA ROM</span>
          </button>
        </div>
      </div>
    </div>
  );
};
