/**
 * MS-DOS Audio Synthesizer Emulation:
 * - PC Speaker (8253 PIT Timer 2 1-bit square wave)
 * - AdLib / Sound Blaster OPL2 FM synth emulation
 */

import { AudioTarget } from '../types/gba_dos';

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Authentic PC Speaker boot beep (INT 10h / BIOS POST: 800Hz for 150ms)
  public playPostBeep() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(896, this.ctx.currentTime); // Standard IBM PC beep frequency

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  // Interactive Game SFX adapted to selected audio target
  public playSfx(type: 'jump' | 'shoot' | 'coin' | 'hit' | 'move', target: AudioTarget) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    if (target === 'pc_speaker') {
      // 1-Bit Square Wave PIT 8253 Tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      gain.gain.setValueAtTime(0.08, now);

      switch (type) {
        case 'jump':
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(880, now + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(now + 0.16);
          break;

        case 'shoot':
          osc.frequency.setValueAtTime(900, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(now + 0.13);
          break;

        case 'coin':
          osc.frequency.setValueAtTime(987.77, now); // B5
          osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(now + 0.32);
          break;

        case 'hit':
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.linearRampToValueAtTime(40, now + 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(now + 0.19);
          break;

        case 'move':
          osc.frequency.setValueAtTime(180, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(now + 0.05);
          break;
      }
    } else {
      // Sound Blaster 16 / AdLib OPL2 2-Operator FM Simulation
      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const masterGain = this.ctx.createGain();

      carrier.type = target === 'adlib' ? 'sine' : 'sawtooth';
      modulator.type = 'sine';

      masterGain.gain.setValueAtTime(0.1, now);

      switch (type) {
        case 'jump':
          carrier.frequency.setValueAtTime(300, now);
          carrier.frequency.exponentialRampToValueAtTime(700, now + 0.2);
          modulator.frequency.setValueAtTime(150, now);
          modGain.gain.setValueAtTime(200, now);
          modGain.gain.linearRampToValueAtTime(10, now + 0.2);
          masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          break;

        case 'shoot':
          carrier.frequency.setValueAtTime(1200, now);
          carrier.frequency.exponentialRampToValueAtTime(180, now + 0.15);
          modulator.frequency.setValueAtTime(300, now);
          modGain.gain.setValueAtTime(600, now);
          masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          break;

        case 'coin':
          carrier.frequency.setValueAtTime(1046.5, now); // C6
          carrier.frequency.setValueAtTime(1567.98, now + 0.09); // G6
          modulator.frequency.setValueAtTime(523.25, now);
          modGain.gain.setValueAtTime(150, now);
          masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          break;

        case 'hit':
          carrier.frequency.setValueAtTime(120, now);
          modulator.frequency.setValueAtTime(45, now);
          modGain.gain.setValueAtTime(400, now);
          masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          break;

        case 'move':
          carrier.frequency.setValueAtTime(220, now);
          modulator.frequency.setValueAtTime(110, now);
          modGain.gain.setValueAtTime(50, now);
          masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          break;
      }

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      carrier.start();
      modulator.start();
      carrier.stop(now + 0.36);
      modulator.stop(now + 0.36);
    }
  }
}

export const retroAudio = new RetroAudioEngine();
