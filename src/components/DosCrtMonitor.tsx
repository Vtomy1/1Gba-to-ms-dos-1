import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GbaHeader, VgaModeSettings } from '../types/gba_dos';
import { retroAudio } from '../utils/audioSynth';
import { Monitor, Volume2, VolumeX, Maximize2, Terminal, Play, RotateCcw, Keyboard } from 'lucide-react';

interface DosCrtMonitorProps {
  gba: GbaHeader;
  settings: VgaModeSettings;
  onUpdateSettings: (updater: (prev: VgaModeSettings) => VgaModeSettings) => void;
}

export const DosCrtMonitor: React.FC<DosCrtMonitorProps> = ({
  gba,
  settings,
  onUpdateSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeMode, setActiveMode] = useState<'game' | 'dos_prompt'>('game');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [dosInput, setDosInput] = useState('');
  const [dosHistory, setDosHistory] = useState<string[]>([
    'MS-DOS Version 6.22 (C)Copyright Microsoft Corp 1981-1994.',
    'GBA to MS-DOS Mode 13h Bridge loaded in High Memory (HMA).',
    'VGA 256-color DAC detected at I/O Port 3C8h/3C9h.',
    'Ready. Type RUN or HELP to begin.',
    '',
  ]);
  const dosBottomRef = useRef<HTMLDivElement | null>(null);

  // Game Interactive States
  const gameStateRef = useRef({
    tick: 0,
    // Cyber Run state
    carX: 120,
    carSpeed: 1,
    curveOffset: 0,
    turboActive: false,
    // Neo Quest state
    playerX: 110,
    playerY: 70,
    playerDir: 0, // 0: down, 1: up, 2: left, 3: right
    questDialogue: 'Welcome to the 8-bit DOS realm! Press [Z] to interact.',
    // Solar VGA state
    shipAngle: 0,
    shipX: 120,
    shipY: 80,
    shipVx: 0,
    shipVy: 0,
    asteroids: [
      { x: 40, y: 30, vx: 0.4, vy: 0.3, size: 14 },
      { x: 190, y: 50, vx: -0.3, vy: 0.5, size: 18 },
      { x: 100, y: 130, vx: 0.5, vy: -0.4, size: 12 },
    ],
    lasers: [] as Array<{ x: number; y: number; vx: number; vy: number; life: number }>,
    // Metro VGA state
    metroX: 40,
    metroY: 112,
    metroVy: 0,
    isJumping: false,
    facingRight: true,
    droneX: 180,
    droneDir: -1,
    metroBullets: [] as Array<{ x: number; y: number; vx: number }>,
    score: 100,
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Handle Keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing into DOS prompt input
      if (activeMode === 'dos_prompt' && document.activeElement?.tagName === 'INPUT') {
        return;
      }

      keysPressed.current[e.key.toLowerCase()] = true;

      if (e.key === 'Escape') {
        setActiveMode(prev => (prev === 'game' ? 'dos_prompt' : 'game'));
        retroAudio.playPostBeep();
      }

      // SFX triggers in game mode
      if (activeMode === 'game') {
        if (e.key === ' ' || e.key.toLowerCase() === 'z') {
          if (gba.gameCode === 'ASOL') {
            // Solar shoot
            const st = gameStateRef.current;
            const rad = (st.shipAngle * Math.PI) / 180;
            st.lasers.push({
              x: st.shipX,
              y: st.shipY,
              vx: Math.cos(rad) * 4,
              vy: Math.sin(rad) * 4,
              life: 35,
            });
            retroAudio.playSfx('shoot', settings.audioTarget);
          } else if (gba.gameCode === 'AMET') {
            // Metro jump
            const st = gameStateRef.current;
            if (!st.isJumping) {
              st.metroVy = -6.5;
              st.isJumping = true;
              retroAudio.playSfx('jump', settings.audioTarget);
            }
          } else if (gba.gameCode === 'ACBR') {
            // Turbo boost
            gameStateRef.current.turboActive = true;
            retroAudio.playSfx('jump', settings.audioTarget);
          }
        } else if (e.key.toLowerCase() === 'x') {
          if (gba.gameCode === 'AMET') {
            // Metro fire
            const st = gameStateRef.current;
            st.metroBullets.push({
              x: st.metroX + (st.facingRight ? 16 : -4),
              y: st.metroY + 8,
              vx: st.facingRight ? 5 : -5,
            });
            retroAudio.playSfx('shoot', settings.audioTarget);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      if (gba.gameCode === 'ACBR' && (e.key === ' ' || e.key.toLowerCase() === 'z')) {
        gameStateRef.current.turboActive = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeMode, gba.gameCode, settings.audioTarget]);

  // Main 320x200 Mode 13h Render Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Buffer canvas for native 320x200 rendering
    const offscreen = document.createElement('canvas');
    offscreen.width = 320;
    offscreen.height = 200;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Render 60 FPS
    const render = () => {
      const state = gameStateRef.current;
      state.tick++;

      // Clear 320x200 screen buffer with border color
      const borderIdx = settings.borderColor;
      const borderHex = settings.showDosBorder 
        ? (borderIdx === 1 ? '#0000AA' : borderIdx === 4 ? '#AA0000' : '#111111') 
        : '#000000';
      
      offCtx.fillStyle = borderHex;
      offCtx.fillRect(0, 0, 320, 200);

      // Determine viewport geometry
      let destX = 0;
      let destY = 0;
      let destW = 320;
      let destH = 200;

      if (settings.scaling === 'centered') {
        destX = 40; // (320 - 240) / 2
        destY = 20; // (200 - 160) / 2
        destW = 240;
        destH = 160;

        // Render DOS Bezel / HUD labels around 240x160 frame
        if (settings.showDosBorder) {
          offCtx.fillStyle = '#AAAAAA';
          offCtx.font = '8px monospace';
          offCtx.fillText(`[GBA: ${gba.gameCode}]`, 42, 14);
          offCtx.fillText('VGA MODE 13h 320x200', 170, 14);
          offCtx.fillText('ESC = DOS PROMPT', 42, 192);
          offCtx.fillText('DAC: 256c 18-BIT', 210, 192);

          // Hairline frame
          offCtx.strokeStyle = '#555555';
          offCtx.strokeRect(38.5, 18.5, 243, 163);
        }
      }

      // Clip to active game viewport
      offCtx.save();
      offCtx.beginPath();
      offCtx.rect(destX, destY, destW, destH);
      offCtx.clip();

      // RENDER GAME GRAPHICS ACCORDING TO GAME CODE
      renderGameFrame(offCtx, destX, destY, destW, destH, state, gba.gameCode);

      offCtx.restore();

      // Apply Phosphor Color Filter if Amber or Green mode
      if (settings.phosphor !== 'color') {
        const frameData = offCtx.getImageData(0, 0, 320, 200);
        const data = frameData.data;
        const isAmber = settings.phosphor === 'amber';

        for (let i = 0; i < data.length; i += 4) {
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (isAmber) {
            data[i] = lum;               // Amber R
            data[i + 1] = lum * 0.65;    // Amber G
            data[i + 2] = lum * 0.05;    // Amber B
          } else {
            // Green Phosphor
            data[i] = lum * 0.15;
            data[i + 1] = lum * 1.0;
            data[i + 2] = lum * 0.2;
          }
        }
        offCtx.putImageData(frameData, 0, 0);
      }

      // Blit offscreen buffer to display canvas (smooth pixel scaling)
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [gba.gameCode, settings]);

  // Render game frame inside (vx, vy, vw, vh)
  const renderGameFrame = (
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    vw: number,
    vh: number,
    st: typeof gameStateRef.current,
    code: string
  ) => {
    const keys = keysPressed.current;

    if (code === 'ACBR') {
      // ==========================================
      // CYBER_RUN: Mode 7 pseudo-3D racer
      // ==========================================
      const speed = st.turboActive ? 3.5 : 2.0;
      if (keys['arrowleft'] || keys['a']) st.carX = Math.max(vx + 30, st.carX - 2.5);
      if (keys['arrowright'] || keys['d']) st.carX = Math.min(vx + vw - 40, st.carX + 2.5);

      // Sky & Neon Grid Horizon
      const horizonY = vy + vh * 0.42;
      const skyGrad = ctx.createLinearGradient(vx, vy, vx, horizonY);
      skyGrad.addColorStop(0, '#100028');
      skyGrad.addColorStop(1, '#681858');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(vx, vy, vw, horizonY - vy);

      // Distant retro sun & mountains
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(vx + vw * 0.5, horizonY - 4, 24, Math.PI, 0, false);
      ctx.fill();

      // Mode 7 Road pseudo-perspective lines
      const roadGrad = ctx.createLinearGradient(vx, horizonY, vx, vy + vh);
      roadGrad.addColorStop(0, '#201040');
      roadGrad.addColorStop(1, '#050215');
      ctx.fillStyle = roadGrad;
      ctx.fillRect(vx, horizonY, vw, vy + vh - horizonY);

      // Perspective stripes
      const numLines = 14;
      for (let i = 0; i < numLines; i++) {
        const p = ((st.tick * speed * 0.05 + i / numLines) % 1);
        const y = horizonY + Math.pow(p, 2) * (vy + vh - horizonY);
        const lineH = Math.max(1, Math.floor(p * 3));
        ctx.fillStyle = (Math.floor(p * 10 + st.tick * 0.1) % 2 === 0) ? '#ff0077' : '#00ddff';
        ctx.fillRect(vx, y, vw, lineH);
      }

      // Road boundary curve
      ctx.fillStyle = '#0a0520';
      ctx.beginPath();
      ctx.moveTo(vx + vw * 0.45, horizonY);
      ctx.lineTo(vx + vw * 0.55, horizonY);
      ctx.lineTo(vx + vw * 0.88, vy + vh);
      ctx.lineTo(vx + vw * 0.12, vy + vh);
      ctx.closePath();
      ctx.fill();

      // Road center dashed line
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(vx + vw * 0.5, horizonY);
      ctx.lineTo(st.carX + 6, vy + vh);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cyber vehicle sprite
      const carW = 28;
      const carH = 14;
      const carDrawY = vy + vh - 26;
      ctx.fillStyle = st.turboActive ? '#00ffff' : '#ff2266';
      ctx.fillRect(st.carX - carW / 2, carDrawY, carW, carH);
      // Wheels
      ctx.fillStyle = '#111111';
      ctx.fillRect(st.carX - carW / 2 - 2, carDrawY + 2, 3, 10);
      ctx.fillRect(st.carX + carW / 2 - 1, carDrawY + 2, 3, 10);
      // Windshield & lights
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(st.carX - 8, carDrawY + 2, 16, 4);
      ctx.fillStyle = '#ffea00';
      ctx.fillRect(st.carX - 10, carDrawY + 11, 4, 2);
      ctx.fillRect(st.carX + 6, carDrawY + 11, 4, 2);

      // HUD overlay
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px monospace';
      ctx.fillText(`MPH: ${Math.floor(st.turboActive ? 185 : 124)}`, vx + 6, vy + 12);
      ctx.fillText(st.turboActive ? 'TURBO: BOOST!' : 'TURBO: READY', vx + vw - 80, vy + 12);
    } else if (code === 'ANQP') {
      // ==========================================
      // NEO_QUEST: 16-bit RPG Overworld
      // ==========================================
      if (keys['arrowup'] || keys['w']) { st.playerY = Math.max(vy + 12, st.playerY - 1.5); st.playerDir = 1; }
      if (keys['arrowdown'] || keys['s']) { st.playerY = Math.min(vy + vh - 40, st.playerY + 1.5); st.playerDir = 0; }
      if (keys['arrowleft'] || keys['a']) { st.playerX = Math.max(vx + 12, st.playerX - 1.5); st.playerDir = 2; }
      if (keys['arrowright'] || keys['d']) { st.playerX = Math.min(vx + vw - 24, st.playerX + 1.5); st.playerDir = 3; }

      // Grass terrain
      ctx.fillStyle = '#3a7d44';
      ctx.fillRect(vx, vy, vw, vh);

      // Cobblestone path
      ctx.fillStyle = '#7a6b58';
      ctx.fillRect(vx + vw * 0.45, vy, 26, vh);
      ctx.fillRect(vx, vy + vh * 0.45, vw, 22);

      // Animated River with shimmer
      ctx.fillStyle = '#2255aa';
      ctx.fillRect(vx, vy + vh * 0.72, vw, 24);
      const waveOffset = Math.sin(st.tick * 0.08) * 4;
      ctx.fillStyle = '#5588dd';
      for (let rx = vx; rx < vx + vw; rx += 16) {
        ctx.fillRect(rx + waveOffset, vy + vh * 0.76, 8, 2);
      }

      // Wooden bridge
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(vx + vw * 0.44, vy + vh * 0.71, 28, 26);
      ctx.strokeStyle = '#4a2f18';
      ctx.strokeRect(vx + vw * 0.44, vy + vh * 0.71, 28, 26);

      // Ancient temple gate at top center
      ctx.fillStyle = '#555566';
      ctx.fillRect(vx + vw * 0.4, vy + 4, 46, 26);
      ctx.fillStyle = '#111122';
      ctx.fillRect(vx + vw * 0.47, vy + 12, 16, 18);
      // Torches
      const flicker = (st.tick % 8 > 4) ? '#ffaa00' : '#ff4400';
      ctx.fillStyle = flicker;
      ctx.fillRect(vx + vw * 0.42, vy + 10, 3, 4);
      ctx.fillRect(vx + vw * 0.61, vy + 10, 3, 4);

      // Pine trees
      const trees = [
        { x: vx + 20, y: vy + 24 },
        { x: vx + 60, y: vy + 30 },
        { x: vx + 25, y: vy + 75 },
        { x: vx + vw - 40, y: vy + 30 },
        { x: vx + vw - 50, y: vy + 80 },
      ];
      for (const t of trees) {
        ctx.fillStyle = '#1e4620';
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + 12, t.y + 22);
        ctx.lineTo(t.x - 12, t.y + 22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#4a2f18';
        ctx.fillRect(t.x - 2, t.y + 22, 4, 6);
      }

      // Hero sprite
      const hx = st.playerX;
      const hy = st.playerY;
      ctx.fillStyle = '#d03030'; // Red tunic
      ctx.fillRect(hx, hy + 4, 10, 10);
      ctx.fillStyle = '#ffd199'; // Skin
      ctx.fillRect(hx + 2, hy, 6, 6);
      ctx.fillStyle = '#222222'; // Hat/hair
      ctx.fillRect(hx + 1, hy - 2, 8, 3);
      // Legs with walk anim
      const legOffset = (Math.floor(st.tick / 6) % 2 === 0) ? 1 : -1;
      ctx.fillStyle = '#2b2b68';
      ctx.fillRect(hx + 1 + legOffset, hy + 14, 3, 4);
      ctx.fillRect(hx + 6 - legOffset, hy + 14, 3, 4);

      // Dialogue Box HUD at bottom
      ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
      ctx.fillRect(vx + 8, vy + vh - 28, vw - 16, 22);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(vx + 8.5, vy + vh - 27.5, vw - 17, 21);
      ctx.fillStyle = '#ffea77';
      ctx.font = '7px monospace';
      ctx.fillText('ELDER: "VGA Mode 13h holds the 256 keys. Venture north!"', vx + 14, vy + vh - 14);
    } else if (code === 'ASOL') {
      // ==========================================
      // SOLAR_VGA: Vector / Asteroids Sim
      // ==========================================
      if (keys['arrowleft'] || keys['a']) st.shipAngle -= 4;
      if (keys['arrowright'] || keys['d']) st.shipAngle += 4;
      if (keys['arrowup'] || keys['w']) {
        const rad = (st.shipAngle * Math.PI) / 180;
        st.shipVx += Math.cos(rad) * 0.12;
        st.shipVy += Math.sin(rad) * 0.12;
      }
      st.shipX += st.shipVx;
      st.shipY += st.shipVy;
      st.shipVx *= 0.98;
      st.shipVy *= 0.98;

      // Wrap around bounds
      if (st.shipX < vx) st.shipX = vx + vw;
      if (st.shipX > vx + vw) st.shipX = vx;
      if (st.shipY < vy) st.shipY = vy + vh;
      if (st.shipY > vy + vh) st.shipY = vy;

      // Deep space background with twinkling stars
      ctx.fillStyle = '#020208';
      ctx.fillRect(vx, vy, vw, vh);

      for (let i = 0; i < 40; i++) {
        const sx = vx + ((i * 37 + st.tick * 0.05) % vw);
        const sy = vy + ((i * 53) % vh);
        ctx.fillStyle = (i % 3 === 0) ? '#ffffff' : '#6688aa';
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Update and draw Asteroids
      for (const ast of st.asteroids) {
        ast.x += ast.vx;
        ast.y += ast.vy;
        if (ast.x < vx) ast.x = vx + vw;
        if (ast.x > vx + vw) ast.x = vx;
        if (ast.y < vy) ast.y = vy + vh;
        if (ast.y > vy + vh) ast.y = vy;

        ctx.strokeStyle = '#9999aa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ast.x, ast.y, ast.size, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Update and draw Lasers
      ctx.fillStyle = '#ff3344';
      for (let i = st.lasers.length - 1; i >= 0; i--) {
        const l = st.lasers[i];
        l.x += l.vx;
        l.y += l.vy;
        l.life--;
        ctx.fillRect(l.x - 1, l.y - 1, 3, 3);
        if (l.life <= 0) st.lasers.splice(i, 1);
      }

      // Draw Ship
      ctx.save();
      ctx.translate(st.shipX, st.shipY);
      ctx.rotate((st.shipAngle * Math.PI) / 180);

      // Ship triangle body
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.stroke();

      // Thruster flame when accelerating
      if (keys['arrowup'] || keys['w']) {
        ctx.fillStyle = (st.tick % 4 > 2) ? '#ffaa00' : '#ff4400';
        ctx.beginPath();
        ctx.moveTo(-5, -3);
        ctx.lineTo(-12 - Math.random() * 4, 0);
        ctx.lineTo(-5, 3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px monospace';
      ctx.fillText('SHIELD: [||||||||||]', vx + 6, vy + 12);
      ctx.fillText('RADAR: ACTIVE', vx + vw - 75, vy + 12);
    } else {
      // ==========================================
      // METRO_VGA / Default: Cyber-Platformer
      // ==========================================
      if (keys['arrowleft'] || keys['a']) {
        st.metroX = Math.max(vx + 6, st.metroX - 2.5);
        st.facingRight = false;
      }
      if (keys['arrowright'] || keys['d']) {
        st.metroX = Math.min(vx + vw - 18, st.metroX + 2.5);
        st.facingRight = true;
      }

      // Gravity and jump
      st.metroY += st.metroVy;
      st.metroVy += 0.38; // gravity
      const groundY = vy + vh - 32;
      if (st.metroY >= groundY) {
        st.metroY = groundY;
        st.metroVy = 0;
        st.isJumping = false;
      }

      // Move drone
      st.droneX += st.droneDir * 0.8;
      if (st.droneX < vx + 90) st.droneDir = 1;
      if (st.droneX > vx + vw - 40) st.droneDir = -1;

      // Dark futuristic city skyline
      ctx.fillStyle = '#080a14';
      ctx.fillRect(vx, vy, vw, vh);

      // Distant neon skyscrapers
      ctx.fillStyle = '#14182b';
      for (let b = 0; b < 6; b++) {
        const bx = vx + b * 45;
        const bw = 35;
        const bh = 50 + (b % 3) * 25;
        ctx.fillRect(bx, vy + vh - 32 - bh, bw, bh);
        // Window dots
        ctx.fillStyle = '#3a4470';
        for (let wy = vy + vh - 30 - bh; wy < vy + vh - 35; wy += 8) {
          ctx.fillRect(bx + 6, wy, 2, 2);
          ctx.fillRect(bx + 18, wy, 2, 2);
        }
        ctx.fillStyle = '#14182b';
      }

      // Floating Platforms
      ctx.fillStyle = '#223355';
      ctx.fillRect(vx + 70, vy + vh - 60, 48, 6);
      ctx.fillRect(vx + 150, vy + vh - 85, 52, 6);
      ctx.fillStyle = '#00ffcc';
      ctx.fillRect(vx + 70, vy + vh - 60, 48, 1);
      ctx.fillRect(vx + 150, vy + vh - 85, 52, 1);

      // Industrial floor
      ctx.fillStyle = '#1a1f33';
      ctx.fillRect(vx, groundY + 16, vw, 16);
      ctx.fillStyle = '#334466';
      ctx.fillRect(vx, groundY + 16, vw, 2);

      // Security Drone
      ctx.fillStyle = '#aa2244';
      ctx.beginPath();
      ctx.arc(st.droneX, vy + 45 + Math.sin(st.tick * 0.1) * 6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(st.droneX - 2, vy + 44 + Math.sin(st.tick * 0.1) * 6, 4, 2);

      // Player Sprite
      const px = st.metroX;
      const py = st.metroY;
      ctx.fillStyle = '#00ddff'; // Cyber armor
      ctx.fillRect(px, py, 12, 16);
      ctx.fillStyle = '#ffffff'; // Visor
      ctx.fillRect(st.facingRight ? px + 6 : px + 1, py + 2, 5, 3);
      // Blaster arm
      ctx.fillStyle = '#88aacc';
      ctx.fillRect(st.facingRight ? px + 10 : px - 4, py + 7, 6, 3);

      // Player Bullets
      ctx.fillStyle = '#ffdd00';
      for (let i = st.metroBullets.length - 1; i >= 0; i--) {
        const b = st.metroBullets[i];
        b.x += b.vx;
        ctx.fillRect(b.x, b.y, 4, 2);
        if (b.x < vx || b.x > vx + vw) {
          st.metroBullets.splice(i, 1);
        }
      }

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px monospace';
      ctx.fillText('ENERGY: 99%', vx + 6, vy + 12);
      ctx.fillText('VGA A000:0000', vx + vw - 80, vy + 12);
    }
  };

  // Run DOS Command
  const handleExecuteDosCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = dosInput.trim();
    if (!cmd) return;

    const upper = cmd.toUpperCase();
    const newHistory = [...dosHistory, `C:\\GBA> ${cmd}`];

    if (upper === 'RUN' || upper === 'RUN.EXE' || upper === 'MODE 13' || upper === `${gba.gameCode}.EXE`) {
      newHistory.push(
        'Switching to VGA 320x200 Mode 13h...',
        'Reprogramming DAC 256-color palette (I/O 3C8h/3C9h)...',
        'Payload started. Press ESC to return to DOS.'
      );
      retroAudio.playPostBeep();
      setActiveMode('game');
    } else if (upper === 'DIR') {
      newHistory.push(
        ' Volume in drive C has no label',
        ' Volume Serial Number is 1337-BEEF',
        ' Directory of C:\\GBA',
        '',
        `RUN      EXE        65,536  10-20-94  12:00p`,
        `${gba.gameCode.padEnd(8)} EXE        65,536  10-20-94  12:00p`,
        `ROM      GBA        ${gba.romSize.toLocaleString().padStart(7)}  10-20-94  12:00p`,
        `README   TXT           768  10-20-94  12:00p`,
        `CONFIG   SYS           256  10-20-94  12:00p`,
        '        5 file(s)        132,096 bytes',
        '        0 dir(s)     524,288,000 bytes free'
      );
    } else if (upper === 'HELP') {
      newHistory.push(
        'Supported commands:',
        '  RUN / RUN.EXE   - Launch GBA payload in VGA Mode 13h (320x200)',
        '  DIR             - List files in current directory',
        '  TYPE README.TXT - View Mode 13h converter specification',
        '  DEBUG RUN.EXE   - Examine x86 registers and disassembly',
        '  MEM             - Display DOS memory allocation',
        '  CLS             - Clear command prompt',
        '  BEEP            - Test PC Speaker 8253 timer interrupt'
      );
    } else if (upper.startsWith('TYPE')) {
      newHistory.push(
        '--- README.TXT ---',
        `GBA to MS-DOS Mode 13h Binary Package`,
        `ROM Title: ${gba.gameTitle} (${gba.gameCode})`,
        `Entry Point: ${gba.entryPoint}`,
        `VGA Mode: INT 10h AH=00h AL=13h (320x200 256-Color)`,
        `Palette: 18-bit DAC (6-bit RGB) mapped via port 0x3C8/0x3C9`,
        `Framebuffer: 0xA000:0000 (64,000 bytes)`,
        `Centering: 240x160 inside 320x200 letterbox frame.`
      );
    } else if (upper.startsWith('DEBUG')) {
      newHistory.push(
        '-r',
        'AX=0013  BX=0000  CX=FA00  DX=03C8  SP=0800  BP=0000  SI=0120  DI=0000',
        'DS=1000  ES=A000  SS=1000  CS=1000  IP=0000   NV UP EI PL NZ NA PO NC',
        '1000:0000 FA            CLI',
        '1000:0001 B81300        MOV     AX,0013',
        '1000:0004 CD10          INT     10',
        '1000:0006 BAC803        MOV     DX,03C8'
      );
    } else if (upper === 'MEM') {
      newHistory.push(
        'Memory Type        Total       Used       Free',
        '----------------  --------   --------   --------',
        'Conventional          640K        48K       592K',
        'Upper (HMA)            64K         8K        56K',
        'Extended (XMS)      15,360K     1,024K    14,336K',
        '----------------  --------   --------   --------',
        'Total Memory       16,064K     1,080K    14,984K',
        '',
        'Largest executable program size:       591K (605,824 bytes)'
      );
    } else if (upper === 'CLS') {
      setDosHistory([]);
      setDosInput('');
      return;
    } else if (upper === 'BEEP') {
      retroAudio.playPostBeep();
      newHistory.push('PC Speaker beep generated.');
    } else {
      newHistory.push(`Bad command or file name: "${cmd}". Type HELP for assistance.`);
    }

    setDosHistory(newHistory);
    setDosInput('');
  };

  useEffect(() => {
    if (activeMode === 'dos_prompt' && dosBottomRef.current) {
      dosBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dosHistory, activeMode]);

  // Virtual Gamepad trigger
  const triggerVirtualKey = (key: string, isDown: boolean) => {
    keysPressed.current[key.toLowerCase()] = isDown;
    if (isDown) {
      if (key === 'z') {
        const fakeEv = new KeyboardEvent('keydown', { key: 'z' });
        window.dispatchEvent(fakeEv);
      } else if (key === 'x') {
        const fakeEv = new KeyboardEvent('keydown', { key: 'x' });
        window.dispatchEvent(fakeEv);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top Monitor Bar: Controls, Mode Toggle, Scanlines */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-300">Display Viewport</span>
          <span className="text-neutral-600">·</span>
          <span className="text-xs text-amber-400 font-dos">320×200 Mode 13h (8-Bit 256c)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Mode Control */}
          <div className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
            <button
              onClick={() => {
                setActiveMode('game');
                retroAudio.playPostBeep();
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMode === 'game'
                  ? 'bg-amber-500 text-neutral-950 font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>VGA Active</span>
            </button>
            <button
              onClick={() => {
                setActiveMode('dos_prompt');
                retroAudio.playPostBeep();
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeMode === 'dos_prompt'
                  ? 'bg-amber-500 text-neutral-950 font-semibold shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>DOS Prompt</span>
            </button>
          </div>

          {/* CRT Scanline Toggle */}
          <button
            onClick={() => onUpdateSettings(prev => ({ ...prev, crtScanlines: !prev.crtScanlines }))}
            className={`px-2.5 py-1 text-xs font-medium border rounded-md transition-colors ${
              settings.crtScanlines
                ? 'bg-neutral-800 border-amber-500/50 text-amber-400'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
            title="Toggle authentic CRT phosphor scanlines"
          >
            Scanlines: {settings.crtScanlines ? 'ON' : 'OFF'}
          </button>

          {/* Audio Mute Toggle */}
          <button
            onClick={() => {
              const next = !isAudioMuted;
              setIsAudioMuted(next);
              retroAudio.setMuted(next);
            }}
            className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-neutral-400 hover:text-neutral-200"
            title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Retro CRT Chassis Frame */}
      <div className="relative p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Chassis texture detail */}
        <div className="absolute top-2 left-4 text-[10px] tracking-wider text-neutral-500 font-dos uppercase">
          VGA MULTISYNC 320×200 // 70Hz REFRESH
        </div>
        <div className="absolute top-2 right-4 flex items-center gap-1.5 text-[10px] text-neutral-500 font-dos">
          <span>PORT 0x3C8</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        </div>

        {/* Inner Curved Bezel */}
        <div className="relative mt-4 bg-black rounded-lg border-2 border-neutral-800/80 overflow-hidden aspect-[4/3] max-h-[500px] flex items-center justify-center">
          {/* Active Mode: Game Canvas */}
          <canvas
            ref={canvasRef}
            width={640}
            height={400}
            className={`w-full h-full object-contain pixelated ${
              activeMode === 'game' ? 'block' : 'hidden'
            }`}
          />

          {/* Active Mode: MS-DOS Command Line Simulator */}
          {activeMode === 'dos_prompt' && (
            <div className="w-full h-full bg-black p-4 font-dos text-neutral-200 text-xs sm:text-sm overflow-y-auto flex flex-col justify-between">
              <div className="space-y-1">
                {dosHistory.map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                    {line}
                  </div>
                ))}
                <div ref={dosBottomRef} />
              </div>

              {/* Input Prompt */}
              <form onSubmit={handleExecuteDosCommand} className="flex items-center gap-1.5 mt-2 pt-2 border-t border-neutral-800">
                <span className="text-amber-400 font-bold shrink-0">C:\GBA&gt;</span>
                <input
                  type="text"
                  value={dosInput}
                  onChange={e => setDosInput(e.target.value)}
                  placeholder="type RUN or HELP..."
                  autoFocus
                  className="w-full bg-transparent border-none outline-none text-neutral-100 font-dos text-xs sm:text-sm placeholder:text-neutral-600"
                />
              </form>
            </div>
          )}

          {/* Optional CRT Scanlines Layer */}
          {settings.crtScanlines && (
            <div className="absolute inset-0 crt-scanlines pointer-events-none" />
          )}

          {/* CRT Vignette shadow */}
          {settings.crtCurvature && (
            <div className="absolute inset-0 crt-vignette pointer-events-none" />
          )}
        </div>

        {/* Bottom Chassis Control Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-1 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Controls:</span>
            <span className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300 font-mono text-[11px]">Arrows/WASD</span>
            <span className="text-neutral-600">·</span>
            <span className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300 font-mono text-[11px]">Space / Z (Action)</span>
            <span className="text-neutral-600">·</span>
            <span className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300 font-mono text-[11px]">X (Secondary)</span>
            <span className="text-neutral-600">·</span>
            <span className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300 font-mono text-[11px]">ESC (DOS)</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
            <span>Payload: {gba.gameTitle}</span>
            <span className="text-neutral-600">/</span>
            <span>{gba.gameCode}</span>
          </div>
        </div>
      </div>

      {/* On-Screen Retro Gamepad for Touch & Mouse Play */}
      <div className="flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
        {/* D-Pad */}
        <div className="grid grid-cols-3 gap-1 w-28 h-28">
          <div></div>
          <button
            onMouseDown={() => triggerVirtualKey('arrowup', true)}
            onMouseUp={() => triggerVirtualKey('arrowup', false)}
            onTouchStart={() => triggerVirtualKey('arrowup', true)}
            onTouchEnd={() => triggerVirtualKey('arrowup', false)}
            className="flex items-center justify-center bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 rounded font-mono font-bold text-xs"
          >
            ▲
          </button>
          <div></div>
          <button
            onMouseDown={() => triggerVirtualKey('arrowleft', true)}
            onMouseUp={() => triggerVirtualKey('arrowleft', false)}
            onTouchStart={() => triggerVirtualKey('arrowleft', true)}
            onTouchEnd={() => triggerVirtualKey('arrowleft', false)}
            className="flex items-center justify-center bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 rounded font-mono font-bold text-xs"
          >
            ◀
          </button>
          <div className="bg-neutral-850 rounded flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-neutral-700"></span>
          </div>
          <button
            onMouseDown={() => triggerVirtualKey('arrowright', true)}
            onMouseUp={() => triggerVirtualKey('arrowright', false)}
            onTouchStart={() => triggerVirtualKey('arrowright', true)}
            onTouchEnd={() => triggerVirtualKey('arrowright', false)}
            className="flex items-center justify-center bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 rounded font-mono font-bold text-xs"
          >
            ▶
          </button>
          <div></div>
          <button
            onMouseDown={() => triggerVirtualKey('arrowdown', true)}
            onMouseUp={() => triggerVirtualKey('arrowdown', false)}
            onTouchStart={() => triggerVirtualKey('arrowdown', true)}
            onTouchEnd={() => triggerVirtualKey('arrowdown', false)}
            className="flex items-center justify-center bg-neutral-800 active:bg-amber-500 active:text-neutral-950 text-neutral-300 rounded font-mono font-bold text-xs"
          >
            ▼
          </button>
          <div></div>
        </div>

        {/* Center Select / Start */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveMode(prev => (prev === 'game' ? 'dos_prompt' : 'game'));
                retroAudio.playPostBeep();
              }}
              className="px-3 py-1 bg-neutral-800 text-neutral-400 hover:text-neutral-200 active:bg-neutral-700 rounded text-[10px] font-mono uppercase tracking-wider"
            >
              Select [ESC]
            </button>
            <button
              onClick={() => {
                setActiveMode('game');
                retroAudio.playPostBeep();
              }}
              className="px-3 py-1 bg-neutral-800 text-neutral-400 hover:text-neutral-200 active:bg-neutral-700 rounded text-[10px] font-mono uppercase tracking-wider"
            >
              Start [RUN]
            </button>
          </div>
          <span className="text-[10px] text-neutral-500 font-dos">MODE 13H GAMEPAD</span>
        </div>

        {/* Action Buttons: B and A */}
        <div className="flex items-center gap-3 mr-2">
          <button
            onMouseDown={() => triggerVirtualKey('x', true)}
            onMouseUp={() => triggerVirtualKey('x', false)}
            onTouchStart={() => triggerVirtualKey('x', true)}
            onTouchEnd={() => triggerVirtualKey('x', false)}
            className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 active:bg-amber-500 active:text-neutral-950 text-amber-400 font-mono font-bold text-sm shadow-md flex items-center justify-center"
          >
            B
          </button>
          <button
            onMouseDown={() => triggerVirtualKey('z', true)}
            onMouseUp={() => triggerVirtualKey('z', false)}
            onTouchStart={() => triggerVirtualKey('z', true)}
            onTouchEnd={() => triggerVirtualKey('z', false)}
            className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 active:bg-amber-500 active:text-neutral-950 text-amber-400 font-mono font-bold text-sm shadow-md flex items-center justify-center"
          >
            A
          </button>
        </div>
      </div>
    </div>
  );
};
