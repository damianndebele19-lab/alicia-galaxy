import React, { useEffect, useRef, useState } from 'react';
import { CONFIG } from './content.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeIn = (t) => t * t * t;

// Favourite Star Ceremony: fly through space and gather every star into one giant glowing star.
export default function Ceremony({ onClose }) {
  const canvasRef = useRef(null);
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState(0); // 0 flying, 1 gathering, 2 message, 3 buttons

  useEffect(() => {
    setStage(0);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, raf = 0;
    const T0 = performance.now();
    const Z0 = 40;
    const N = 950;
    const stars = Array.from({ length: N }, () => ({
      x: (Math.random() * 2 - 1) * 1.8, y: (Math.random() * 2 - 1) * 1.8, z: Math.random() * Z0,
      hue: Math.random() < 0.55 ? 0 : Math.random() < 0.5 ? 1 : 2, ph: Math.random() * TAU, sx: 0, sy: 0, size: 1,
    }));
    const COLORS = ['255,255,255', '255,170,215', '255,225,150'];
    let camZ = 0, last = T0, snap = false;
    const timers = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };

    const draw = () => {
      const now = performance.now();
      const t = (now - T0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = w / 2, cy = h * 0.46, F = Math.min(w, h) * 0.9;
      ctx.fillStyle = 'rgba(2,1,8,.55)'; ctx.fillRect(0, 0, w, h); // motion-trail fade

      const gatherStart = 5.5, gatherEnd = 11;
      const speed = t < gatherStart ? 1.5 + Math.pow(clamp(t / 4.5, 0, 1), 2) * 55 : Math.max(0, 40 - (t - gatherStart) * 14);
      camZ += speed * dt;
      const e = easeIn(clamp((t - gatherStart) / (gatherEnd - gatherStart), 0, 1));

      if (t >= gatherStart && !snap) { snap = true; setStage(1); stars.forEach((s) => { s.gx = s.sx; s.gy = s.sy; s.ga = Math.atan2(s.sy - cy, s.sx - cx); s.gr = Math.hypot(s.sx - cx, s.sy - cy); }); }

      for (const s of stars) {
        if (t < gatherStart + 0.05 || e === 0) {
          const zc = (((s.z - camZ) % Z0) + Z0) % Z0 + 0.4;
          const zp = zc + speed * dt * 1.7;
          const px = cx + (s.x / zc) * F * 0.5, py = cy + (s.y / zc) * F * 0.5;
          const qx = cx + (s.x / zp) * F * 0.5, qy = cy + (s.y / zp) * F * 0.5;
          s.sx = px; s.sy = py; s.size = clamp(2.2 / zc * 3, 0.5, 3.2);
          const a = clamp(1.2 - zc / Z0, 0.1, 1);
          ctx.strokeStyle = `rgba(${COLORS[s.hue]},${a})`; ctx.lineWidth = s.size;
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
        } else {
          // spiral inwards to the centre
          const ang = s.ga + e * 5.5, rad = s.gr * (1 - e);
          const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
          const a = clamp(1 - e * 0.6, 0.2, 1);
          ctx.fillStyle = `rgba(${COLORS[s.hue]},${a})`;
          ctx.beginPath(); ctx.arc(x, y, s.size * (1 + e * 0.6), 0, TAU); ctx.fill();
        }
      }

      // the giant star
      const Rmax = Math.min(w, h) * 0.2;
      const grow = clamp((t - gatherStart - 0.6) / (gatherEnd - gatherStart), 0, 1);
      if (grow > 0) {
        const pulse = t > gatherEnd ? 1 + Math.sin((t - gatherEnd) * 2.2) * 0.05 : 1;
        const R = Rmax * Math.pow(grow, 1.6) * pulse;
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 4.5);
        halo.addColorStop(0, 'rgba(255,245,215,.95)'); halo.addColorStop(0.18, 'rgba(255,200,230,.55)'); halo.addColorStop(0.5, 'rgba(255,110,190,.16)'); halo.addColorStop(1, 'rgba(255,110,190,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 4.5, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.12);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU, len = R * (i % 2 ? 2.6 : 4.2) * (0.85 + 0.15 * Math.sin(t * 2 + i));
          const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
          g.addColorStop(0, 'rgba(255,240,220,.7)'); g.addColorStop(1, 'rgba(255,150,210,0)');
          ctx.strokeStyle = g; ctx.lineWidth = i % 2 ? R * 0.05 : R * 0.09;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke();
        }
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        core.addColorStop(0, '#fff'); core.addColorStop(0.55, '#fff0d2'); core.addColorStop(1, 'rgba(255,170,215,.85)');
        ctx.shadowColor = '#ff9ed0'; ctx.shadowBlur = R * 0.6;
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    ctx.fillStyle = '#020108'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();
    timers.push(setTimeout(() => setStage(2), 10800), setTimeout(() => setStage(3), 15500));
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); window.removeEventListener('resize', resize); };
  }, [run]);

  return (
    <div className="overlay ceremony">
      <canvas ref={canvasRef} className="ceremony-canvas" />
      {stage < 2 && <div className="ceremony-caption">{stage === 0 ? 'Traveling through the stars…' : 'Every star is finding its way to you…'}</div>}
      {stage >= 2 && (
        <div className="ceremony-text">
          <p className="ceremony-name">A STAR, JUST FOR {CONFIG.fullName.toUpperCase()} ✦</p>
        </div>
      )}
      {stage >= 3 && (
        <div className="ceremony-actions">
          <button className="close-letter" onClick={() => setRun((r) => r + 1)}>Replay ✦</button>
          <button className="reveal-btn" onClick={onClose}>Back to our galaxy</button>
        </div>
      )}
      {stage < 3 && <button className="overlay-close" onClick={onClose} aria-label="Skip">×</button>}
    </div>
  );
}
