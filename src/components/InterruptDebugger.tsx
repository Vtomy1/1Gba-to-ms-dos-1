import React, { useState } from 'react';
import { GbaHeader } from '../types/gba_dos';
import { Terminal, Play, RotateCcw, ChevronRight, ChevronLeft, Cpu, Binary, CheckCircle2, AlertCircle } from 'lucide-react';

interface InterruptDebuggerProps {
  gba: GbaHeader;
}

interface Int10Call {
  step: number;
  title: string;
  shortDesc: string;
  ah: string;
  al: string;
  bx: string;
  cx: string;
  dx: string;
  si: string;
  di: string;
  cs: string;
  ip: string;
  opcodeBytes: string[];
  asmInstruction: string;
  ivtAddress: string;
  biosAction: string;
  flags: { cf: number; zf: number; sf: number; ifFlag: number; of: number };
  explanation: string;
}

export const InterruptDebugger: React.FC<InterruptDebuggerProps> = ({ gba }) => {
  // Sequence of INT 10h video BIOS calls executed during GBA-to-DOS Mode 13h lifecycle
  const int10Calls: Int10Call[] = [
    {
      step: 1,
      title: 'Query VGA Subsystem Capability',
      shortDesc: 'INT 10h, AH=12h, BL=10h (Get EGA/VGA Configuration)',
      ah: '12h',
      al: '00h',
      bx: '0010h',
      cx: '0000h',
      dx: '0000h',
      si: '0000h',
      di: '0000h',
      cs: '1000h',
      ip: '0008h',
      opcodeBytes: ['B4', '12', 'BB', '10', '00', 'CD', '10'],
      asmInstruction: 'MOV AH, 12h\nMOV BL, 10h\nINT 10h',
      ivtAddress: '0000:0040 -> C000:0420',
      biosAction: 'Inspects BIOS Data Area and CRTC. Returns BH=0 (color), BL=3 (256KB+ Video RAM installed). Confirms hardware VGA support.',
      flags: { cf: 0, zf: 1, sf: 0, ifFlag: 1, of: 0 },
      explanation: 'Ensures the host computer has genuine VGA hardware before switching away from text mode. If BL remains 0x10, the system lacks VGA capability.',
    },
    {
      step: 2,
      title: 'Mode Switch: Activate VGA Mode 13h (320×200 256c)',
      shortDesc: 'INT 10h, AH=00h, AL=13h (Set Video Mode 13h)',
      ah: '00h',
      al: '13h',
      bx: '0000h',
      cx: '0000h',
      dx: '0000h',
      si: '0000h',
      di: '0000h',
      cs: '1000h',
      ip: '000Fh',
      opcodeBytes: ['B8', '13', '00', 'CD', '10'],
      asmInstruction: 'MOV AX, 0013h  ; AH=00h (Set Mode), AL=13h (Mode 13h)\nINT 10h        ; Video BIOS Interrupt',
      ivtAddress: '0000:0040 -> C000:0053',
      biosAction: 'Programs VGA Sequencer, CRTC (320x200 raster timing), Graphics Controller (Maps 0xA000 segment aperture), and Attribute Controller (256-color DAC mode). Clears 64,000 bytes at A000:0000 to black.',
      flags: { cf: 0, zf: 1, sf: 0, ifFlag: 1, of: 0 },
      explanation: 'The primary mode switch! AH=00h commands the Video BIOS to set display mode, and AL=13h specifies 320 columns by 200 rows with 8 bits per pixel (256 indexed colors). Video memory is mapped linearly at segment 0xA000.',
    },
    {
      step: 3,
      title: 'Disable Hardware Text Cursor',
      shortDesc: 'INT 10h, AH=01h, CH=20h (Set Cursor Type / Invisible)',
      ah: '01h',
      al: '00h',
      bx: '0000h',
      cx: '2000h',
      dx: '0000h',
      si: '0000h',
      di: '0000h',
      cs: '1000h',
      ip: '0014h',
      opcodeBytes: ['B4', '01', 'B5', '20', 'CD', '10'],
      asmInstruction: 'MOV AH, 01h   ; Set Text Cursor Size\nMOV CH, 20h   ; Bit 5 set = Cursor Invisible\nINT 10h',
      ivtAddress: '0000:0040 -> C000:01B0',
      biosAction: 'Sets bit 5 of the CRTC Cursor Start Register (Port 0x3D4 Reg 0x0A) to 1, turning off blinking cursor scanlines over the graphics canvas.',
      flags: { cf: 0, zf: 0, sf: 0, ifFlag: 1, of: 0 },
      explanation: 'Prevents the flashing blinking cursor of DOS from glitching over the top-left corner of the GBA framebuffer at A000:0000.',
    },
    {
      step: 4,
      title: 'Query Active Video State Verification',
      shortDesc: 'INT 10h, AH=0Fh (Get Current Video Mode)',
      ah: '0Fh',
      al: '13h',
      bx: '0000h',
      cx: '0000h',
      dx: '0000h',
      si: '0000h',
      di: '0000h',
      cs: '1000h',
      ip: '0019h',
      opcodeBytes: ['B4', '0F', 'CD', '10'],
      asmInstruction: 'MOV AH, 0Fh   ; Get Current Video State\nINT 10h        ; Returns AL=Active Mode (13h)',
      ivtAddress: '0000:0040 -> C000:0280',
      biosAction: 'Reads byte at 0040:0049 (BIOS Data Area current mode). Returns AL=13h (Mode 13h active), AH=28h (40 columns per line in 8x8 font), BH=00h (active page 0).',
      flags: { cf: 0, zf: 1, sf: 0, ifFlag: 1, of: 0 },
      explanation: 'Verifies the hardware state confirmed AL=13h. In the GBA loader, this validates the display controller before pumping the 256-color DAC palette.',
    },
    {
      step: 5,
      title: 'Application Exit: Restore Standard 80×25 Text Mode',
      shortDesc: 'INT 10h, AH=00h, AL=03h (Restore 80x25 Color Text Mode 3)',
      ah: '00h',
      al: '03h',
      bx: '0000h',
      cx: '0000h',
      dx: '0000h',
      si: '0000h',
      di: '0000h',
      cs: '1000h',
      ip: '003Dh',
      opcodeBytes: ['B8', '03', '00', 'CD', '10'],
      asmInstruction: 'MOV AX, 0003h  ; AH=00h (Set Mode), AL=03h (80x25 Color Text)\nINT 10h        ; Restore text mode for DOS prompt\nMOV AX, 4C00h  ; Terminate to DOS\nINT 21h',
      ivtAddress: '0000:0040 -> C000:0053',
      biosAction: 'Restores alphanumeric text mode 03h (720x400 font raster at B800:0000), resets CRTC registers to 80 columns by 25 rows, clears screen, re-enables cursor, returns to COMMAND.COM prompt.',
      flags: { cf: 0, zf: 1, sf: 0, ifFlag: 1, of: 0 },
      explanation: 'Invoked when the player presses ESC. Without this call, returning to DOS would leave the monitor in 320x200 graphics mode, rendering the DOS prompt invisible.',
    },
  ];

  const [currentStepIdx, setCurrentStepIdx] = useState<number>(1); // Default to Mode 13h switch (Step 2)
  const currentCall = int10Calls[currentStepIdx];

  return (
    <div className="flex flex-col gap-5 p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-sm font-bold text-neutral-100 font-dos">
              Real-Mode INT 10h Video BIOS Interrupt Debugger
            </h2>
            <div className="text-xs text-neutral-400 mt-0.5">
              Live Instruction Stepper: Register States, Opcodes, and CPU Flags during VGA Mode 13h Switch
            </div>
          </div>
        </div>

        {/* Stepper Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentStepIdx(prev => Math.max(0, prev - 1))}
            disabled={currentStepIdx === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev Step</span>
          </button>

          <span className="text-xs font-mono text-amber-400 font-bold px-1.5">
            Step {currentCall.step} of {int10Calls.length}
          </span>

          <button
            onClick={() => setCurrentStepIdx(prev => Math.min(int10Calls.length - 1, prev + 1))}
            disabled={currentStepIdx === int10Calls.length - 1}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            <span>Next Step</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setCurrentStepIdx(1)}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors ml-1"
            title="Reset to Mode 13h switch (Step 2)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sequence Timeline Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {int10Calls.map((call, idx) => {
          const isCurrent = idx === currentStepIdx;
          return (
            <button
              key={call.step}
              onClick={() => setCurrentStepIdx(idx)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                isCurrent
                  ? 'bg-amber-500/15 border-amber-500 text-neutral-100 shadow-md ring-1 ring-amber-500/50'
                  : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 text-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className={isCurrent ? 'text-amber-400 font-bold' : 'text-neutral-500'}>
                  STEP 0{call.step}
                </span>
                <span className="text-neutral-500">INT 10h</span>
              </div>
              <div className="text-xs font-semibold truncate text-neutral-200 font-dos">
                {call.title}
              </div>
              <div className="text-[10px] text-neutral-500 truncate mt-0.5 font-mono">
                AH={call.ah} AL={call.al}
              </div>
            </button>
          );
        })}
      </div>

      {/* 16-Bit Real Mode Register States Display (High/Low Breakdown) */}
      <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-neutral-200 font-dos">
              x86 Real-Mode CPU Register File (State Prior to Interrupt Dispatch)
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400">
            Real Mode 16-Bit Architecture (8086 / 286 / 386 / 486)
          </span>
        </div>

        {/* Register Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 font-mono text-xs">
          {/* AX Register */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500 flex justify-between">
              <span>AX (Accumulator)</span>
            </div>
            <div className="text-base font-bold text-amber-400 mt-1">
              0x{currentCall.ah.replace('h', '')}{currentCall.al.replace('h', '')}
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              <span>AH: <strong className="text-neutral-200">{currentCall.ah}</strong></span>
              <span>AL: <strong className="text-amber-400">{currentCall.al}</strong></span>
            </div>
          </div>

          {/* BX Register */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500">BX (Base)</div>
            <div className="text-base font-bold text-neutral-200 mt-1">
              0x{currentCall.bx.replace('h', '')}
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              <span>BH: 00h</span>
              <span>BL: {currentCall.bx.slice(2)}</span>
            </div>
          </div>

          {/* CX Register */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500">CX (Count)</div>
            <div className="text-base font-bold text-neutral-200 mt-1">
              0x{currentCall.cx.replace('h', '')}
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              <span>CH: {currentCall.cx.slice(0, 2)}</span>
              <span>CL: {currentCall.cx.slice(2)}</span>
            </div>
          </div>

          {/* DX Register */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500">DX (Data/Port)</div>
            <div className="text-base font-bold text-neutral-200 mt-1">
              0x{currentCall.dx.replace('h', '')}
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              <span>DH: 00h</span>
              <span>DL: 00h</span>
            </div>
          </div>

          {/* CS:IP Pointer */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500">CS:IP (Entry)</div>
            <div className="text-sm font-bold text-neutral-200 mt-1 truncate">
              {currentCall.cs}:{currentCall.ip}
            </div>
            <div className="text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              Program Code
            </div>
          </div>

          {/* ES Segment */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500">ES (Extra Seg)</div>
            <div className="text-sm font-bold text-emerald-400 mt-1">
              0xA000
            </div>
            <div className="text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              VGA Framebuffer
            </div>
          </div>

          {/* DS Segment */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500">DS (Data Seg)</div>
            <div className="text-sm font-bold text-neutral-200 mt-1">
              0x1000
            </div>
            <div className="text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              GBA Payload
            </div>
          </div>

          {/* CPU FLAGS */}
          <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500">FLAGS</div>
            <div className="text-xs font-bold text-neutral-200 mt-1 flex gap-1">
              <span className={currentCall.flags.ifFlag ? 'text-emerald-400' : 'text-neutral-600'}>IF</span>
              <span className={currentCall.flags.zf ? 'text-amber-400' : 'text-neutral-600'}>ZF</span>
              <span className={currentCall.flags.cf ? 'text-red-400' : 'text-neutral-600'}>CF</span>
            </div>
            <div className="text-[9px] text-neutral-400 border-t border-neutral-800/80 pt-1 mt-1">
              NV UP EI PL
            </div>
          </div>
        </div>
      </div>

      {/* Disassembly, Opcode Bytes & IVT Vector Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Opcode Breakdown & Disassembly */}
        <div className="lg:col-span-7 flex flex-col gap-3 p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Binary className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-neutral-200 font-dos">
                Binary Opcode Bytes &amp; Machine Code Disassembly
              </h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-400">
              Offset: {currentCall.cs}:{currentCall.ip}
            </span>
          </div>

          {/* Machine Code Opcodes Visual */}
          <div className="flex items-center gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-800/80">
            <span className="text-xs text-neutral-400 font-mono">Raw Opcode Stream:</span>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              {currentCall.opcodeBytes.map((byte, bIdx) => (
                <span
                  key={bIdx}
                  className={`px-2 py-0.5 rounded font-bold ${
                    byte === 'CD' || byte === '10'
                      ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-200'
                  }`}
                >
                  {byte}
                </span>
              ))}
            </div>
          </div>

          {/* Assembly Code Snippet */}
          <pre className="p-3 bg-neutral-900 rounded-lg border border-neutral-800/80 text-xs font-mono text-neutral-200 leading-relaxed overflow-x-auto">
            {currentCall.asmInstruction}
          </pre>

          {/* Explanation Box */}
          <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800/80 text-xs leading-relaxed text-neutral-300 space-y-1">
            <div className="font-semibold text-neutral-100 font-dos">
              Interrupt Purpose:
            </div>
            <p className="text-neutral-400">{currentCall.explanation}</p>
          </div>
        </div>

        {/* Right Column: IVT Vector Table & Video BIOS Handler Details */}
        <div className="lg:col-span-5 flex flex-col gap-3 p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-neutral-200 font-dos">
                Interrupt Vector Table (IVT) Entry
              </h3>
            </div>
            <span className="text-[10px] text-amber-400">INT 10h (0x10)</span>
          </div>

          {/* Vector Memory Location */}
          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800/80 space-y-1.5">
            <div className="flex justify-between text-[11px] text-neutral-400">
              <span>IVT RAM Location:</span>
              <span className="text-neutral-200 font-bold">0000:0040 (4 * 0x10)</span>
            </div>
            <div className="flex justify-between text-[11px] text-neutral-400">
              <span>Physical Address:</span>
              <span className="text-neutral-200">0x00040 - 0x00043 (4 bytes)</span>
            </div>
            <div className="flex justify-between text-[11px] text-neutral-400">
              <span>Target Handler Vector:</span>
              <span className="text-amber-400 font-bold">{currentCall.ivtAddress}</span>
            </div>
          </div>

          {/* What CPU Hardware Executes On "INT 10h" */}
          <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800/80 space-y-1.5 text-[11px] text-neutral-300 leading-relaxed font-sans">
            <span className="font-mono font-bold text-neutral-200 block">
              CPU Hardware Execution Cycle (CD 10):
            </span>
            <ol className="list-decimal list-inside space-y-1 text-neutral-400 font-mono text-[10px] pl-1">
              <li>Pushes <strong className="text-neutral-200">FLAGS</strong> register onto stack (SP -= 2)</li>
              <li>Clears <strong className="text-neutral-200">IF</strong> (Interrupt Enable) and TF (Trap Flag)</li>
              <li>Pushes <strong className="text-neutral-200">CS:IP</strong> return address onto stack (SP -= 4)</li>
              <li>Fetches 4-byte far pointer from <strong className="text-amber-400">0000:0040</strong></li>
              <li>Jumps execution to Video BIOS ROM handler at <strong className="text-amber-400">C000:XXXX</strong></li>
              <li>BIOS executes function requested in <strong className="text-amber-400">AH</strong> and returns via <strong className="text-neutral-200">IRET</strong></li>
            </ol>
          </div>

          {/* Video BIOS Internal Actions */}
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-neutral-300 leading-relaxed">
            <strong className="text-amber-400 font-mono">Video BIOS Execution:</strong> {currentCall.biosAction}
          </div>
        </div>
      </div>
    </div>
  );
};
