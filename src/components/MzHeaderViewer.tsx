import React, { useState } from 'react';
import { DosMzHeader, MzHeaderField } from '../types/gba_dos';
import { Binary, Info, FileCode } from 'lucide-react';

interface MzHeaderViewerProps {
  mzHeader: DosMzHeader;
}

export const MzHeaderViewer: React.FC<MzHeaderViewerProps> = ({ mzHeader }) => {
  const [selectedField, setSelectedField] = useState<MzHeaderField | null>(
    mzHeader.fields[0] || null
  );

  return (
    <div className="flex flex-col gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Binary className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-200">
            MS-DOS MZ Executable Header Structure (64 Bytes)
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
          <span>Magic: <strong className="text-amber-400">0x5A4D ("MZ")</strong></span>
          <span className="text-neutral-600">·</span>
          <span>Header: 4 Paragraphs (64 bytes)</span>
        </div>
      </div>

      {/* Interactive Table of Header Fields */}
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950/80 text-neutral-400 font-mono border-b border-neutral-800">
            <tr>
              <th className="py-2.5 px-3">Offset</th>
              <th className="py-2.5 px-3">Field Name</th>
              <th className="py-2.5 px-3">C Struct Member</th>
              <th className="py-2.5 px-3">Hex Value</th>
              <th className="py-2.5 px-3">Decimal</th>
              <th className="py-2.5 px-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono">
            {mzHeader.fields.map((field) => {
              const isSelected = selectedField?.offset === field.offset;
              return (
                <tr
                  key={field.offset}
                  onClick={() => setSelectedField(field)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500/10 text-amber-200'
                      : 'hover:bg-neutral-800/40 text-neutral-300'
                  }`}
                >
                  <td className="py-2 px-3 text-neutral-500">
                    0x{field.offset.toString(16).padStart(2, '0').toUpperCase()}
                  </td>
                  <td className="py-2 px-3 font-semibold font-sans">
                    {field.name}
                  </td>
                  <td className="py-2 px-3 text-amber-400/90">
                    {field.shortName}
                  </td>
                  <td className="py-2 px-3 text-neutral-200 font-bold">
                    {field.valueHex}
                  </td>
                  <td className="py-2 px-3 text-neutral-400 tabular-nums">
                    {field.valueDec.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-neutral-500">
                    <span className="text-[11px] underline">Explain</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Field Explanatory Panel */}
      {selectedField && (
        <div className="p-3.5 bg-neutral-950/90 border border-neutral-800 rounded-lg flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-200">
                {selectedField.name} ({selectedField.shortName})
              </span>
              <span className="text-neutral-600">·</span>
              <span className="text-xs font-mono text-amber-400">
                Offset 0x{selectedField.offset.toString(16).padStart(2, '0').toUpperCase()} ({selectedField.size} bytes)
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {selectedField.description}
            </p>
          </div>
        </div>
      )}

      {/* Technical Summary of MZ Header in MS-DOS */}
      <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg text-xs leading-relaxed text-neutral-400">
        <strong className="text-neutral-200">How MS-DOS Executes This Binary:</strong> When you invoke the executable from the DOS prompt (<code className="text-amber-400 font-mono">C:\&gt; RUN.EXE</code>), DOS INT 21h AH=4Bh (EXEC) inspects the first two bytes for the <code className="text-amber-400 font-mono">0x5A4D ("MZ")</code> signature. It calculates total memory required from <code className="text-amber-400 font-mono">e_minalloc</code> and <code className="text-amber-400 font-mono">e_maxalloc</code>, loads the executable pages past the 64-byte header into conventional RAM, initializes the stack segment (<code className="text-amber-400 font-mono">SS:SP</code>), and sets the instruction pointer to <code className="text-amber-400 font-mono">CS:IP</code> (0000:0000) where the Mode 13h VGA setup routines begin.
      </div>
    </div>
  );
};
