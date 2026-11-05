import React, { useEffect, useRef, useState } from 'react';
import { CONFIG } from './content.js';

const TAU = Math.PI * 2;

// Normalised shapes (0..1 inside a square play area). Players drag from star to star along the faint guide lines.
const heartNodes = Array.from({ length: 10 }, (_, i) => {
  const t = (i / 10) * TAU + 0.31;
  const x = (16 * Math.pow(Math.sin(t), 3)) / 17;
  const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
  return [0.5 + x * 0.46, 0.5 - (y + 0.15) * 0.56];
});
const pent = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 5) * TAU;
  return [0.5 + Math.cos(a) * 0.47, 0.54 + Math.sin(a) * 0.47];
});

const SHAPES = {
  heart: { nodes: heartNodes, edges: heartNodes.map((_, i) => [i, (i + 1) % heartNodes.length]) },
  star: { nodes: pent, edges: [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]] },
};
const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export default function Constellation({ onClose, onComplete, doneIds }) {
  const list = CONFIG.constellations;
  const firstOpen = Math.max(0, list.findIndex((c) => !doneIds.includes(c.id)));
  const [idx, setIdx] = useState(firstOpen);
  const [revealed, setRevealed] = useState(false);
  const canvasRef = useRef(null);
  const state = useRef({ connected: new Set(), cur: -1, mouse: null, complete: false, glow: 0 });
  const idxRef = useRef(idx);
  idxRef.current = idx;

  useEffect(() => {
    state.current = { connected: new Set(), cur: -1, mouse: null, complete: false, glow: 0 };
    setRevealed(false);
  }, [idx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, raf = 0, S = 0, ox = 0, oy = 0, t = 0;
    let stars = [];
    const pos = (n) => [ox + n[0] * S, oy + n[1] * S];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      S = Math.min(w * 0.82, h * 0.58, 520); ox = (w - S) / 2; oy = h * 0.5 - S / 2 + 18;
      stars = Array.from({ length: 160 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.2, ph: Math.random() * 6 }));
    };

    const nearest = (px, py, r) => {
      const shape = SHAPES[list[idxRef.current].id];
      let best = -1, bd = r;
      shape.nodes.forEach((n, i) => { const [x, y] = pos(n); const d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = i; } });
      return best;
    };

    const finish = () => {
      const s = state.current;
      if (s.complete) return;
      s.complete = true;
      const c = list[idxRef.current];
      onComplete(c.id);
      setTimeout(() => setRevealed(true), 1100);
    };

    const pt = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const down = (e) => {
      const s = state.current; if (s.complete) return;
      canvas.setPointerCapture?.(e.pointerId);
      const [x, y] = pt(e); s.cur = nearest(x, y, 40); s.mouse = [x, y];
    };
    const move = (e) => {
      const s = state.current; if (s.complete) return;
      const [x, y] = pt(e); s.mouse = [x, y];
      if (s.cur < 0) return;
      const shape = SHAPES[list[idxRef.current].id];
      const j = nearest(x, y, 34);
      if (j >= 0 && j !== s.cur) {
        const k = key(s.cur, j);
        if (shape.edges.some(([a, b]) => key(a, b) === k)) {
          if (!s.connected.has(k)) s.connected.add(k);
          s.cur = j;
          if (s.connected.size === shape.edges.length) { s.cur = -1; finish(); }
        }
      }
    };
    const up = () => { state.current.cur = -1; state.current.mouse = null; };

    const draw = () => {
      t += 0.016;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7);
      bg.addColorStop(0, '#1c0a22'); bg.addColorStop(1, '#030107');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (const s of stars) { ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.4 * Math.sin(t * 1.5 + s.ph) ** 2})`; ctx.fillRect(s.x, s.y, s.r, s.r); }

      const st = state.current;
      const shape = SHAPES[list[idxRef.current].id];
      st.glow += ((st.complete ? 1 : 0) - st.glow) * 0.05;
      // faint guide lines
      ctx.setLineDash([4, 8]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,200,230,.16)';
      shape.edges.forEach(([a, b]) => { const [x1, y1] = pos(shape.nodes[a]), [x2, y2] = pos(shape.nodes[b]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); });
      ctx.setLineDash([]);
      // connected lines
      ctx.lineCap = 'round';
      shape.edges.forEach(([a, b]) => {
        if (!st.connected.has(key(a, b))) return;
        const [x1, y1] = pos(shape.nodes[a]), [x2, y2] = pos(shape.nodes[b]);
        ctx.shadowColor = '#ff7ab8'; ctx.shadowBlur = 16 + st.glow * 18;
        ctx.strokeStyle = `rgba(255,${200 + st.glow * 55},${230 + st.glow * 25},.95)`; ctx.lineWidth = 2.4 + st.glow * 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.shadowBlur = 0;
      // rubber band
      if (st.cur >= 0 && st.mouse) {
        const [x1, y1] = pos(shape.nodes[st.cur]);
        ctx.strokeStyle = 'rgba(255,230,245,.55)'; ctx.lineWidth = 1.8; ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(st.mouse[0], st.mouse[1]); ctx.stroke(); ctx.setLineDash([]);
      }
      // nodes
      shape.nodes.forEach((n, i) => {
        const [x, y] = pos(n);
        const touched = shape.edges.some(([a, b]) => (a === i || b === i) && st.connected.has(key(a, b)));
        const pulse = 0.75 + 0.25 * Math.sin(t * 3 + i);
        const R = (touched ? 7 : 6) * (touched ? 1 + st.glow * 0.4 : pulse) + (st.cur === i ? 3 : 0);
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * 4);
        g.addColorStop(0, touched ? 'rgba(255,230,250,.65)' : 'rgba(255,210,150,.5)'); g.addColorStop(1, 'rgba(255,200,230,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 4, 0, TAU); ctx.fill();
        ctx.fillStyle = touched ? '#fff' : '#ffe9b8'; ctx.beginPath(); ctx.arc(x, y, R * 0.7, 0, TAU); ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };

    resize(); draw();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    if (window.__galaxyDebug) window.__constellation = { shape: () => SHAPES[list[idxRef.current].id], pos, state };
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = list[idx];
  const remaining = list.filter((x, i) => i !== idx && !doneIds.includes(x.id));
  const next = () => { const n = list.findIndex((x, i) => i !== idx && !doneIds.includes(x.id)); if (n >= 0) setIdx(n); else onClose(); };

  return (
    <div className="overlay constellation">
      <canvas ref={canvasRef} className="constellation-canvas" />
      <header className="constellation-head">
        <div className="letter-kicker">🌌 CONSTELLATION {idx + 1} OF {list.length}</div>
        <h2>{c.name}</h2>
        <p>Drag from star to star to connect them — follow the faint lines.</p>
      </header>
      <button className="overlay-close" onClick={onClose} aria-label="Close">×</button>
      <div className="constellation-dots">
        {list.map((x, i) => <span key={x.id} className={`${doneIds.includes(x.id) ? 'done' : ''} ${i === idx ? 'now' : ''}`} />)}
      </div>
      {revealed && (
        <div className="constellation-reveal">
          <article className="polaroid-card">
            <div className="polaroid-photo"><img src={c.photo} alt={c.name} /></div>
            <h3>{c.name}</h3>
            <p>{c.memory}</p>
            <button className="reveal-btn" onClick={next}>{remaining.length ? 'Next constellation →' : 'Back to the galaxy ✨'}</button>
          </article>
        </div>
      )}
    </div>
  );
}
