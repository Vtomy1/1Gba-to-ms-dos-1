import React, { useState, useEffect, useRef } from 'react';
import { GbaHeader, AudioTarget } from '../types/gba_dos';
import { retroAudio } from '../utils/audioSynth';
import { Volume2, Radio, Activity, Sliders, Play, VolumeX, Cpu, Layers } from 'lucide-react';

interface SoundBlasterVisualizerProps {
  gba: GbaHeader;
  audioTarget: AudioTarget;
}

interface VoiceState {
  id: number;
  name: string;
  gbaChannel: string;
  sb16Mapping: string;
  type: string;
  freq: number;
  volume: number; // 0-15
  dutyOrParam: string;
  isMuted: boolean;
  waveShape: number[]; // 16 samples for mini-oscilloscope
}

export const SoundBlasterVisualizer: React.FC<SoundBlasterVisualizerProps> = ({
  gba,
  audioTarget,
}) => {
  const [voices, setVoices] = useState<VoiceState[]>([
    {
      id: 1,
      name: 'Voice 1',
      gbaChannel: 'CH1: Pulse & Sweep (0x04000060)',
      sb16Mapping: 'OPL3 Op 1+4 / DSP DMA Voice 1 (Port 0x22C/0x388)',
      type: 'Square + Pitch Sweep',
      freq: 440,
      volume: 12,
      dutyOrParam: 'Sweep: 7.8ms, Duty 50%',
      isMuted: false,
      waveShape: [1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1],
    },
    {
      id: 2,
      name: 'Voice 2',
      gbaChannel: 'CH2: Pulse / Harmony (0x04000068)',
      sb16Mapping: 'OPL3 Op 2+5 / DSP DMA Voice 2 (Port 0x22C/0x388)',
      type: 'Square Duty Wave',
      freq: 660,
      volume: 10,
      dutyOrParam: 'Duty: 25% (4-step pulse)',
      isMuted: false,
      waveShape: [1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    },
    {
      id: 3,
      name: 'Voice 3',
      gbaChannel: 'CH3: 4-Bit Wave RAM (0x04000070)',
      sb16Mapping: 'SB16 Auto-Init DMA Buffer (Port 0x22C, DMA 5)',
      type: '32-Sample Wave Table',
      freq: 220,
      volume: 14,
      dutyOrParam: 'Wave RAM: 32 nibbles / 4-bit DAC',
      isMuted: false,
      waveShape: [0, 3, 7, 11, 14, 15, 14, 11, 7, 3, 0, -3, -7, -11, -14, -15],
    },
    {
      id: 4,
      name: 'Voice 4',
      gbaChannel: 'CH4: Noise Generator (0x04000078)',
      sb16Mapping: 'OPL3 Rhythm / DSP White Noise (Port 0x22C)',
      type: 'LFSR Pseudo-Noise',
      freq: 1200,
      volume: 8,
      dutyOrParam: 'Polynomial Counter: 15-bit LFSR',
      isMuted: false,
      waveShape: [1, -1, 1, 1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1],
    },
  ]);

  // Live Simulated Register States
  const [activeDspCommand, setActiveDspCommand] = useState<string>('0xC0 (16-bit DMA)');
  const [dmaCounter, setDmaCounter] = useState<number>(1024);
  const [dmaRate, setDmaRate] = useState<'44100' | '22050'>('44100');
  const [opl3Status, setOpl3Status] = useState<string>('RHYTHM ENABLED (0xBD: 0x20)');
  const [activeVoiceTab, setActiveVoiceTab] = useState<number>(1);

  // Animated activity tick
  useEffect(() => {
    const timer = setInterval(() => {
      setDmaCounter(prev => (prev > 64 ? prev - 32 : 1024));

      // Slightly modulate active volumes to simulate real game audio playback activity
      setVoices(prevVoices =>
        prevVoices.map(v => {
          if (v.isMuted) return { ...v, volume: 0 };
          const jitter = (Math.random() - 0.5) * 3;
          const newVol = Math.min(15, Math.max(2, Math.round(v.volume + jitter)));
          return { ...v, volume: newVol };
        })
      );
    }, 150);

    return () => clearInterval(timer);
  }, []);

  const toggleMuteVoice = (id: number) => {
    setVoices(prev =>
      prev.map(v => (v.id === id ? { ...v, isMuted: !v.isMuted } : v))
    );
  };

  const handleTestTrigger = (voice: VoiceState) => {
    if (voice.id === 1) {
      retroAudio.playSfx('jump', audioTarget);
      setActiveDspCommand('0x10 (Direct 8-bit PCM Output)');
    } else if (voice.id === 2) {
      retroAudio.playSfx('coin', audioTarget);
      setActiveDspCommand('0x40 (Set Time Constant: 44.1kHz)');
    } else if (voice.id === 3) {
      retroAudio.playSfx('move', audioTarget);
      setActiveDspCommand('0xC0 (16-bit Auto-Init DMA)');
    } else {
      retroAudio.playSfx('shoot', audioTarget);
      setActiveDspCommand('0x14 (8-bit DMA Transfer)');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-neutral-950/90 border border-neutral-800 rounded-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-500" />
          <div>
            <h3 className="text-xs font-bold text-neutral-100 font-dos">
              Sound Blaster 16 &amp; OPL3 Register Visualizer
            </h3>
            <div className="text-[11px] text-neutral-400">
              Real-time hardware register simulation mapping GBA DMG &amp; DirectSound to SB16 DSP (Port 0x220–0x22F)
            </div>
          </div>
        </div>

        {/* Hardware Status Pills */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-300">
            BASE: <strong className="text-amber-400">0x220</strong>
          </span>
          <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-300">
            IRQ: <strong className="text-amber-400">7</strong>
          </span>
          <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-300">
            DMA: <strong className="text-amber-400">1 (8b) / 5 (16b)</strong>
          </span>
        </div>
      </div>

      {/* 4 Simulated Channel Voices (Voice 1-4) Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {voices.map(voice => {
          const isSelected = activeVoiceTab === voice.id;
          return (
            <div
              key={voice.id}
              onClick={() => setActiveVoiceTab(voice.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 text-neutral-100'
                  : 'bg-neutral-900 border-neutral-800/80 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              {/* Voice Top Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-dos font-bold text-xs">{voice.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleMuteVoice(voice.id);
                    }}
                    className={`p-1 rounded text-[10px] ${
                      voice.isMuted
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                    title={voice.isMuted ? 'Unmute voice' : 'Mute voice'}
                  >
                    {voice.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleTestTrigger(voice);
                    }}
                    className="p-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded text-[10px] font-mono flex items-center gap-0.5"
                    title="Test tone trigger"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                  </button>
                </div>
              </div>

              {/* Channel Type & Specs */}
              <div>
                <div className="text-[11px] font-semibold text-neutral-200">{voice.type}</div>
                <div className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">
                  {voice.dutyOrParam}
                </div>
              </div>

              {/* Animated Mini Oscilloscope Waveform */}
              <div className="h-9 bg-neutral-950 rounded border border-neutral-800 p-1 flex items-center justify-between gap-0.5 overflow-hidden">
                {voice.waveShape.map((sample, sIdx) => {
                  const heightPct = voice.isMuted
                    ? 5
                    : Math.max(10, Math.min(100, (Math.abs(sample) / 15) * 80 + voice.volume * 2));
                  return (
                    <div
                      key={sIdx}
                      className={`w-full rounded-xs transition-all duration-150 ${
                        voice.isMuted ? 'bg-neutral-800' : 'bg-amber-400/90'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  );
                })}
              </div>

              {/* Volume Meter (0-15 Level Bar) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                  <span>OUT VOL:</span>
                  <span className="text-amber-400 font-bold">{voice.volume} / 15</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-950 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full flex-1 rounded-xs transition-colors ${
                        i < voice.volume
                          ? i > 11
                            ? 'bg-red-500'
                            : i > 7
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                          : 'bg-neutral-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Hardware Port */}
              <div className="text-[9px] font-mono text-neutral-500 truncate pt-1 border-t border-neutral-800/80">
                {voice.sb16Mapping}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hardware Register Table & GBA to SB16 Mapping Translation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Left: SB16 DSP & Mixer Registers Live Status */}
        <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-neutral-300 font-semibold text-xs">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-500" />
              <span>SB16 DSP &amp; Mixer I/O Registers</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">DSP READY (0xAA)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px]">PORT 0x224 (MIXER ADDR)</div>
              <div className="text-neutral-200 font-bold">0x22 (Master Vol)</div>
            </div>
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px]">PORT 0x225 (MIXER DATA)</div>
              <div className="text-amber-400 font-bold">0xEE (L:7 / R:7)</div>
            </div>
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px]">PORT 0x22C (DSP COMMAND)</div>
              <div className="text-neutral-200 font-bold truncate">{activeDspCommand}</div>
            </div>
            <div className="p-2 bg-neutral-950 rounded border border-neutral-800/80">
              <div className="text-neutral-500 text-[10px]">DMA BUFFER (DMA 5)</div>
              <div className="text-amber-400 font-bold tabular-nums">{dmaCounter} / 1024 b</div>
            </div>
          </div>

          {/* Sample Rate Selector */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-400">
            <span>DMA Sampling Frequency:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDmaRate('44100')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                  dmaRate === '44100'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                44.1 kHz (CD Quality)
              </button>
              <button
                onClick={() => setDmaRate('22050')}
                className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                  dmaRate === '22050'
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                22.05 kHz (Low DMA)
              </button>
            </div>
          </div>
        </div>

        {/* Right: GBA to SB16 Mapping Translation Logic */}
        <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold text-xs">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>GBA Audio ➔ MS-DOS SB16 Emulation Translation</span>
          </div>

          <div className="space-y-1.5 text-[11px] font-mono text-neutral-300">
            <div className="p-1.5 bg-neutral-950 rounded border border-neutral-800/80 flex justify-between">
              <span className="text-amber-400 font-bold">GBA CH1/CH2 (Square)</span>
              <span className="text-neutral-400">➔ OPL3 FM Synthesizer (0x388)</span>
            </div>
            <div className="p-1.5 bg-neutral-950 rounded border border-neutral-800/80 flex justify-between">
              <span className="text-amber-400 font-bold">GBA CH3 (Wave RAM)</span>
              <span className="text-neutral-400">➔ SB16 DSP DMA Voice Buffer</span>
            </div>
            <div className="p-1.5 bg-neutral-950 rounded border border-neutral-800/80 flex justify-between">
              <span className="text-amber-400 font-bold">GBA CH4 (Noise)</span>
              <span className="text-neutral-400">➔ OPL3 Rhythm Mode (0xBD)</span>
            </div>
            <div className="p-1.5 bg-neutral-950 rounded border border-neutral-800/80 flex justify-between">
              <span className="text-amber-400 font-bold">DirectSound FIFO A/B</span>
              <span className="text-neutral-400">➔ 16-bit DMA 44.1kHz (Cmd 0xB0)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
