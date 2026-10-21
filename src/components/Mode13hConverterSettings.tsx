import React from 'react';
import { VgaModeSettings, ScalingMode, DitheringMode, AudioTarget, PhosphorMode, GbaHeader } from '../types/gba_dos';
import { Sliders, Monitor, Palette, Volume2, Sparkles } from 'lucide-react';
import { SoundBlasterVisualizer } from './SoundBlasterVisualizer';

interface Mode13hConverterSettingsProps {
  gba: GbaHeader;
  settings: VgaModeSettings;
  onChange: (updater: (prev: VgaModeSettings) => VgaModeSettings) => void;
}

export const Mode13hConverterSettings: React.FC<Mode13hConverterSettingsProps> = ({
  gba,
  settings,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-neutral-200">
            Mode 13h (320×200 8-Bit) Video & Audio Conversion Pipeline
          </h2>
        </div>
        <span className="text-xs text-neutral-400 font-mono">
          VGA Port 0x3C8/0x3C9 · Framebuffer 0xA000
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* 1. Scaling & Geometry */}
        <div className="flex flex-col gap-2 p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="flex items-center gap-1.5 font-medium text-neutral-300">
            <Monitor className="w-3.5 h-3.5 text-amber-500" />
            <span>Frame Geometry</span>
          </div>
          <div className="text-[11px] text-neutral-500 mb-1">
            GBA native 240×160 to VGA 320×200:
          </div>

          <div className="flex flex-col gap-1.5">
            {[
              { id: 'centered', label: 'Centered with DOS Border', desc: '40px left/right, 20px top/bottom' },
              { id: 'scaled_fit', label: '1.33× Aspect Fit', desc: 'Preserves pixel squareness' },
              { id: 'scaled_wide', label: 'Full 320×200 Stretched', desc: 'Classic non-square Mode 13h pixels' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  settings.scaling === opt.id
                    ? 'bg-amber-500/10 border-amber-500 text-neutral-100'
                    : 'border-neutral-800/80 hover:bg-neutral-900 text-neutral-400'
                }`}
              >
                <input
                  type="radio"
                  name="scaling_mode"
                  checked={settings.scaling === opt.id}
                  onChange={() => onChange(prev => ({ ...prev, scaling: opt.id as ScalingMode }))}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <div className="font-semibold text-neutral-200">{opt.label}</div>
                  <div className="text-[10px] text-neutral-500">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 2. Color Quantization & Dithering */}
        <div className="flex flex-col gap-2 p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="flex items-center gap-1.5 font-medium text-neutral-300">
            <Palette className="w-3.5 h-3.5 text-amber-500" />
            <span>8-Bit Palette & Dither</span>
          </div>
          <div className="text-[11px] text-neutral-500 mb-1">
            15-bit BGR555 to 256 VGA DAC:
          </div>

          <div className="flex flex-col gap-1.5">
            {[
              { id: 'custom_dac', label: 'Custom 18-Bit DAC', desc: 'Exact colors via Ports 3C8h/3C9h' },
              { id: 'vga_standard', label: 'Standard 256 VGA', desc: 'Default IBM BIOS color cube' },
              { id: 'bayer_ordered', label: 'Bayer 4×4 Dither', desc: 'Retro ordered matrix pattern' },
              { id: 'cga_16', label: '16-Color CGA Fallback', desc: 'Classic 4-bit PC compatibility' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  settings.dithering === opt.id
                    ? 'bg-amber-500/10 border-amber-500 text-neutral-100'
                    : 'border-neutral-800/80 hover:bg-neutral-900 text-neutral-400'
                }`}
              >
                <input
                  type="radio"
                  name="dither_mode"
                  checked={settings.dithering === opt.id}
                  onChange={() => onChange(prev => ({ ...prev, dithering: opt.id as DitheringMode }))}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <div className="font-semibold text-neutral-200">{opt.label}</div>
                  <div className="text-[10px] text-neutral-500">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 3. Audio Hardware Target */}
        <div className="flex flex-col gap-2 p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="flex items-center gap-1.5 font-medium text-neutral-300">
            <Volume2 className="w-3.5 h-3.5 text-amber-500" />
            <span>DOS Audio Engine</span>
          </div>
          <div className="text-[11px] text-neutral-500 mb-1">
            Sound playback architecture:
          </div>

          <div className="flex flex-col gap-1.5">
            {[
              { id: 'sb16', label: 'Sound Blaster 16', desc: 'DMA DSP 44.1kHz / FM OPL3' },
              { id: 'adlib', label: 'AdLib Music Card', desc: 'Yamaha YM3812 OPL2 FM synthesis' },
              { id: 'pc_speaker', label: 'PC Speaker (8253 PIT)', desc: 'Authentic 1-bit timer 2 beeps' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  settings.audioTarget === opt.id
                    ? 'bg-amber-500/10 border-amber-500 text-neutral-100'
                    : 'border-neutral-800/80 hover:bg-neutral-900 text-neutral-400'
                }`}
              >
                <input
                  type="radio"
                  name="audio_target"
                  checked={settings.audioTarget === opt.id}
                  onChange={() => onChange(prev => ({ ...prev, audioTarget: opt.id as AudioTarget }))}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <div className="font-semibold text-neutral-200">{opt.label}</div>
                  <div className="text-[10px] text-neutral-500">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 4. CRT Phosphor & Optics */}
        <div className="flex flex-col gap-2 p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg">
          <div className="flex items-center gap-1.5 font-medium text-neutral-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>CRT Optics & Phosphor</span>
          </div>
          <div className="text-[11px] text-neutral-500 mb-1">
            Display physical simulation:
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-2 bg-neutral-900 rounded border border-neutral-800/80">
              <span className="text-neutral-300">Phosphor Tube:</span>
              <select
                value={settings.phosphor}
                onChange={e => onChange(prev => ({ ...prev, phosphor: e.target.value as PhosphorMode }))}
                className="bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded px-2 py-1 outline-none"
              >
                <option value="color">Full Color VGA</option>
                <option value="amber">Amber CRT (P3)</option>
                <option value="green">Green CRT (P1)</option>
              </select>
            </div>

            <label className="flex items-center justify-between p-2 bg-neutral-900 rounded border border-neutral-800/80 cursor-pointer">
              <span className="text-neutral-300">CRT Scanlines</span>
              <input
                type="checkbox"
                checked={settings.crtScanlines}
                onChange={e => onChange(prev => ({ ...prev, crtScanlines: e.target.checked }))}
                className="accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-2 bg-neutral-900 rounded border border-neutral-800/80 cursor-pointer">
              <span className="text-neutral-300">Curvature Vignette</span>
              <input
                type="checkbox"
                checked={settings.crtCurvature}
                onChange={e => onChange(prev => ({ ...prev, crtCurvature: e.target.checked }))}
                className="accent-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-2 bg-neutral-900 rounded border border-neutral-800/80 cursor-pointer">
              <span className="text-neutral-300">DOS Bezel Overlay</span>
              <input
                type="checkbox"
                checked={settings.showDosBorder}
                onChange={e => onChange(prev => ({ ...prev, showDosBorder: e.target.checked }))}
                className="accent-amber-500"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Sound Blaster 16 & OPL3 Register Visualizer */}
      <div className="pt-2 border-t border-neutral-800/80">
        <SoundBlasterVisualizer gba={gba} audioTarget={settings.audioTarget} />
      </div>
    </div>
  );
};
