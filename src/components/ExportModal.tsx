import React from 'react';
import { BuiltDosExe } from '../utils/dosExeBuilder';
import { GbaHeader } from '../types/gba_dos';
import { exportJascPal, exportAdobeAct, getStandardVgaPalette } from '../utils/vgaPalette';
import { X, Download, Terminal, FileCode, CheckCircle, HelpCircle } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  builtExe: BuiltDosExe;
  gba: GbaHeader;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  builtExe,
  gba,
}) => {
  if (!isOpen) return null;

  const downloadFile = (data: BlobPart, filename: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExe = () => {
    // ArrayBuffer to BlobPart needs the underlying buffer or Uint8Array
    downloadFile(
      builtExe.binary as unknown as BlobPart,
      `${gba.gameCode.toUpperCase()}.EXE`,
      'application/x-msdos-program'
    );
  };

  const handleDownloadAsm = () => {
    downloadFile(builtExe.asmSource, `${gba.gameCode.toLowerCase()}_loader.asm`, 'text/plain');
  };

  const handleDownloadDosboxBundle = () => {
    downloadFile(builtExe.dosboxConf, 'dosbox.conf', 'text/plain');
  };

  const handleDownloadAutoexec = () => {
    downloadFile(builtExe.autoexecBat, 'AUTOEXEC.BAT', 'text/plain');
  };

  const handleDownloadPalette = () => {
    const pal = exportJascPal(getStandardVgaPalette());
    downloadFile(pal, `${gba.gameCode.toLowerCase()}.pal`, 'text/plain');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-neutral-100 font-dos">
              Export MS-DOS MZ Executable & Packages
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Binary Overview */}
        <div className="my-4 p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono space-y-1">
          <div className="flex justify-between text-neutral-400">
            <span>Executable Format:</span>
            <span className="text-amber-400 font-bold">MS-DOS MZ Binary (.EXE)</span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Header Signature:</span>
            <span className="text-neutral-200">0x5A4D ("MZ")</span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Total Binary Size:</span>
            <span className="text-neutral-200">{builtExe.binary.length.toLocaleString()} bytes</span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Pages in File (512b):</span>
            <span className="text-neutral-200">{builtExe.mzHeader.totalPages} pages</span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Target Video Mode:</span>
            <span className="text-emerald-400 font-bold">VGA Mode 13h (320×200 256c)</span>
          </div>
        </div>

        {/* Download Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* 1. Main .EXE */}
          <button
            onClick={handleDownloadExe}
            className="flex items-start gap-3 p-3 text-left bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 rounded-lg transition-colors group"
          >
            <Download className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-xs font-bold text-neutral-100 font-dos">
                Download {gba.gameCode.toUpperCase()}.EXE
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Byte-valid MS-DOS MZ Executable runnable directly in DOSBox or on vintage x86 PCs.
              </div>
            </div>
          </button>

          {/* 2. NASM Source */}
          <button
            onClick={handleDownloadAsm}
            className="flex items-start gap-3 p-3 text-left bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg transition-colors group"
          >
            <FileCode className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5 group-hover:text-amber-400 transition-colors" />
            <div>
              <div className="text-xs font-bold text-neutral-200 font-dos">
                Download {gba.gameCode.toLowerCase()}_loader.asm
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Commented 16-bit real-mode assembly source ready for NASM or TASM compilation.
              </div>
            </div>
          </button>

          {/* 3. DOSBox Config Bundle */}
          <button
            onClick={handleDownloadDosboxBundle}
            className="flex items-start gap-3 p-3 text-left bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg transition-colors group"
          >
            <FileCode className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5 group-hover:text-amber-400 transition-colors" />
            <div>
              <div className="text-xs font-bold text-neutral-200 font-dos">
                Download DOSBOX.CONF
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Configured with VGA S3 graphics, Sound Blaster 16 (IRQ 7, Port 220), and 16MB RAM.
              </div>
            </div>
          </button>

          {/* 4. Palette File */}
          <button
            onClick={handleDownloadPalette}
            className="flex items-start gap-3 p-3 text-left bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg transition-colors group"
          >
            <FileCode className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5 group-hover:text-amber-400 transition-colors" />
            <div>
              <div className="text-xs font-bold text-neutral-200 font-dos">
                Download Palette (.PAL)
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                JASC-PAL text palette compatible with retro sprite editors, GIMP, and PaintShop Pro.
              </div>
            </div>
          </button>
        </div>

        {/* Verification & Running Instructions */}
        <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg text-xs text-neutral-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>How to run in DOSBox / 86Box / FreeDOS:</span>
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-neutral-300 pl-1 font-mono">
            <li>Place <code className="text-amber-400">{gba.gameCode.toUpperCase()}.EXE</code> in your DOS folder.</li>
            <li>In DOSBox, type: <code className="text-amber-400">MOUNT C C:\DOS &amp;&amp; C:</code></li>
            <li>Launch: <code className="text-amber-400">{gba.gameCode.toUpperCase()}.EXE</code></li>
            <li>The VGA controller switches to 320×200 Mode 13h! Press <code className="text-amber-400">ESC</code> to exit.</li>
          </ol>
        </div>

        {/* Close Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
