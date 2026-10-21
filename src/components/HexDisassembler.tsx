import React, { useState } from 'react';
import { BuiltDosExe } from '../utils/dosExeBuilder';
import { Code2, FileText, Copy, Check } from 'lucide-react';

interface HexDisassemblerProps {
  builtExe: BuiltDosExe;
}

export const HexDisassembler: React.FC<HexDisassemblerProps> = ({ builtExe }) => {
  const [activeTab, setActiveTab] = useState<'disassembly' | 'hexdump' | 'nasm'>('disassembly');
  const [copied, setCopied] = useState(false);

  // Generate 256 bytes hex dump rows
  const binary = builtExe.binary;
  const hexDumpRows: Array<{ offset: string; hex: string[]; ascii: string }> = [];
  const previewSize = Math.min(binary.length, 512);

  for (let i = 0; i < previewSize; i += 16) {
    const chunk = binary.slice(i, i + 16);
    const hex: string[] = [];
    let ascii = '';

    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        const byte = chunk[j];
        hex.push(byte.toString(16).padStart(2, '0').toUpperCase());
        ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
      } else {
        hex.push('  ');
        ascii += ' ';
      }
    }

    hexDumpRows.push({
      offset: i.toString(16).padStart(4, '0').toUpperCase(),
      hex,
      ascii,
    });
  }

  const handleCopyNasm = () => {
    navigator.clipboard.writeText(builtExe.asmSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-200">
            x86 Real-Mode Disassembly & Binary Hex Dump
          </h2>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
          <button
            onClick={() => setActiveTab('disassembly')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'disassembly'
                ? 'bg-amber-500 text-neutral-950 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Instructions
          </button>
          <button
            onClick={() => setActiveTab('hexdump')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'hexdump'
                ? 'bg-amber-500 text-neutral-950 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Hex Dump (MZ)
          </button>
          <button
            onClick={() => setActiveTab('nasm')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === 'nasm'
                ? 'bg-amber-500 text-neutral-950 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            NASM .ASM Source
          </button>
        </div>
      </div>

      {/* Disassembly Tab */}
      {activeTab === 'disassembly' && (
        <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-neutral-900 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="py-2 px-3">Segment:Offset</th>
                <th className="py-2 px-3">Opcode Hex</th>
                <th className="py-2 px-3">16-Bit Instruction</th>
                <th className="py-2 px-3">Operation / Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {builtExe.disassembly.map((row, idx) => (
                <tr key={idx} className="hover:bg-neutral-800/40 text-neutral-300">
                  <td className="py-1.5 px-3 text-neutral-500">{row.offset}</td>
                  <td className="py-1.5 px-3 text-amber-400/90 font-bold">{row.hex}</td>
                  <td className="py-1.5 px-3 text-neutral-100 font-semibold">{row.instruction}</td>
                  <td className="py-1.5 px-3 text-neutral-400 font-sans text-[11px]">{row.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hex Dump Tab */}
      {activeTab === 'hexdump' && (
        <div className="p-3 bg-neutral-950/90 border border-neutral-800 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
          <div className="text-neutral-500 pb-1 border-b border-neutral-800 flex justify-between">
            <span>Offset   00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  | ASCII Dump</span>
            <span className="text-amber-400">First 512 bytes (Page 1)</span>
          </div>
          {hexDumpRows.map((row) => (
            <div key={row.offset} className="flex gap-4 hover:bg-neutral-800/40 px-1 rounded">
              <span className="text-neutral-500 shrink-0">{row.offset}</span>
              <span className="text-neutral-300 shrink-0">
                {row.hex.slice(0, 8).join(' ')}  {row.hex.slice(8, 16).join(' ')}
              </span>
              <span className="text-amber-400 shrink-0 tracking-widest border-l border-neutral-800 pl-3">
                {row.ascii}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* NASM Source Tab */}
      {activeTab === 'nasm' && (
        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={handleCopyNasm}
              className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy ASM'}</span>
            </button>
          </div>
          <pre className="p-4 bg-neutral-950/90 border border-neutral-800 rounded-lg font-mono text-xs text-neutral-300 overflow-x-auto max-h-96 leading-relaxed">
            {builtExe.asmSource}
          </pre>
        </div>
      )}
    </div>
  );
};
