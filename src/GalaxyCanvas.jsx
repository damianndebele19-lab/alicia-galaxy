import React, { useEffect, useRef } from 'react';
import { CONFIG } from './content.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const NO_AUDIO = { bass: 0, level: 0, beat: 0, bins: new Uint8Array(32) };

// Colour ramp (deep red -> hot pink -> white) so the heart cloud never builds strings per frame
const SHADES = Array.from({ length: 32 }, (_, i) => {
  const t = i / 31;
  return `rgb(${Math.round(150 + 105 * t)},${Math.round(14 + 175 * t * t)},${Math.round(42 + 150 * t * t)})`;
});

const HEART_OUTLINE = Array.from({ length: 30 }, (_, i) => {
  const t = (i / 30) * TAU;
  return [
    (16 * Math.pow(Math.sin(t), 3)) / 17,
    (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17,
  ];
});

function buildHeartCloud(n, size) {
  const pts = [];
  while (pts.length < n) {
    const x = rand(-1.25, 1.25), y = rand(-1.2, 1.3);
    const q = Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
    if (q > 0) continue;
    const edge = Math.sqrt(Math.min(1, -q));
    const onSurface = Math.random() < 0.74;
    const z = (onSurface ? 1 : Math.random()) * edge * 0.5 * (Math.random() < 0.5 ? -1 : 1);
    pts.push({ x: x * size, y: (y - 0.1) * size, z: z * size, ph: rand(0, TAU), sz: rand(0.8, 1.5) });
  }
  return pts;
}

const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
};

const fourStar = (ctx, x, y, R, r) => {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, rad = i % 2 ? r : R;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
};

/**
 * The whole 3D galaxy. Everything is projected by hand on a 2D canvas (no extra dependencies).
 * `ctl.current` is a mutable bag shared with the React shell: state flowing in, callbacks flowing out.
 */
export default function GalaxyCanvas({ ctl }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, raf = 0, tick = 0, orbitT = 0, polT = 0;
    let lastNow = performance.now() / 1000;
    const cam = { yaw: 0, pitch: 0.5, D: 30, f: 1000, cx: 0, cy: 0, tx: 0, ty: 0, tz: 0, baseCx: 0, baseCy: 0 };
    const view = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const bursts = [];
    const hits = [];
    const meteors = [];
    let stars = [];
    let nextMeteor = lastNow + 4, nextShower = lastNow + 16;
    let A = 1; // base alpha for the item currently being drawn

    // ---------- scene data (world units, y is up) ----------
    const HEART_SIZE = 2.1;
    const cloud = buildHeartCloud(4200, HEART_SIZE);
    const halo = Array.from({ length: 460 }, () => ({ a: rand(0, TAU), r: 3.5 + rand(-0.18, 0.18), y: rand(-0.12, 0.12), sp: rand(0.8, 1.2) }));
    const dust = Array.from({ length: 380 }, () => {
      const ring = Math.random() < 0.45;
      const r = ring ? rand(9.1, 9.5) : Math.pow(Math.random(), 0.7) * 15 + 3;
      return { a: rand(0, TAU), r, y: ring ? rand(-0.05, 0.05) : rand(-1.8, 1.8), sz: rand(1, 2.6), hue: Math.random() < 0.6 ? 0 : 1, ph: rand(0, TAU) };
    });
    const WORDS = CONFIG.words;
    const MINI = 16;
    const planets = CONFIG.planets.map((p) => ({ ...p, pos: [0, 0, 0] }));
    const wishStars = CONFIG.wishes.map((_, i) => {
      const a = (i / CONFIG.wishes.length) * TAU + rand(-0.2, 0.2);
      const r = rand(5.5, 14.5);
      return { x: Math.cos(a) * r, y: rand(-3.5, 5.5), z: Math.sin(a) * r, ph: rand(0, TAU) };
    });
    const VINYL = { x: -6.3, y: 2.7, z: 4.2 };
    const images = CONFIG.polaroids.map((p) => { const im = new Image(); im.src = p.src; return im; });
    const polaroids = CONFIG.polaroids.map((p, i) => {
      const n = CONFIG.polaroids.length;
      return { a0: (i / n) * TAU, r: 7.4 + (i % 2) * 1.6, y: -1.4 + ((i * 1.7) % 4.4), roll: rand(-0.12, 0.12), ph: rand(0, TAU) };
    });

    // ---------- projection ----------
    const P = { x: 0, y: 0, z: 0, s: 0 };
    const proj = (x, y, z, o = P) => {
      x -= cam.tx; y -= cam.ty; z -= cam.tz;
      const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
      const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp;
      const s = cam.f / (cam.D + z2);
      o.x = cam.cx + x1 * s; o.y = cam.cy - y2 * s; o.z = z2; o.s = s;
      return o;
    };
    const mk = () => ({ x: 0, y: 0, z: 0, s: 0 });
    const po = mk(), pr = mk(), pu = mk();

    // Map a flat plane in the world (centre c, right r, up u – all unit-ish vectors) onto the canvas.
    // `k` = local pixels per world unit. Flips so the front always reads left-to-right.
    const planeTransform = (cxw, cyw, czw, rx, ry, rz, ux, uy, uz, k, flip = true) => {
      proj(cxw, cyw, czw, po);
      proj(cxw + rx, cyw + ry, czw + rz, pr);
      if (flip && pr.x < po.x) { rx = -rx; ry = -ry; rz = -rz; proj(cxw + rx, cyw + ry, czw + rz, pr); }
      proj(cxw + ux, cyw + uy, czw + uz, pu);
      ctx.setTransform(((pr.x - po.x) / k) * dpr, ((pr.y - po.y) / k) * dpr, (-(pu.x - po.x) / k) * dpr, (-(pu.y - po.y) / k) * dpr, po.x * dpr, po.y * dpr);
    };
    const resetTransform = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      const mobile = w < 600;
      cam.f = mobile ? w * 1.3 : Math.min(w * 1.1, h * 1.5);
      cam.baseCx = w / 2; cam.baseCy = h * (mobile ? 0.45 : 0.48);
      if (!cam.cx) { cam.cx = cam.baseCx; cam.cy = cam.baseCy; }
      stars = Array.from({ length: Math.min(420, Math.floor((w * h) / 3000)) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.7 + 0.15, tw: Math.random() * 3 + 0.5, ph: Math.random() * 6.28, d: Math.random(),
      }));
    };

    // ---------- drawers ----------
    const drawOrbGlow = (x, y, R, color) => {
      const g = ctx.createRadialGradient(x, y, R * 0.6, x, y, R * 2.4);
      g.addColorStop(0, color + '66'); g.addColorStop(1, color + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.4, 0, TAU); ctx.fill();
    };

    const drawPlanet = (pl, i) => {
      const focused = ctl.current.focus === i;
      const [px, py, pz] = pl.pos;
      const p = proj(px, py, pz, mk());
      const R = pl.size * p.s;
      drawOrbGlow(p.x, p.y, R, pl.glow);

      // ring for the Loyalty planet: back half behind the sphere, front half over it
      const ringPts = [];
      if (pl.id === 'loyalty') {
        for (let k = 0; k <= 48; k++) {
          const a = (k / 48) * TAU;
          ringPts.push(proj(px + Math.cos(a) * pl.size * 2.0, py + Math.sin(a) * pl.size * 0.55, pz + Math.sin(a) * pl.size * 1.5, mk()));
        }
        ctx.strokeStyle = 'rgba(190,215,255,.75)'; ctx.lineWidth = Math.max(1, R * 0.07);
        ctx.beginPath(); let on = false;
        ringPts.forEach((q) => { if (q.z >= p.z) { on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; } else on = false; });
        ctx.stroke();
      }

      const b = ctx.createRadialGradient(p.x - R * 0.35, p.y - R * 0.4, R * 0.1, p.x, p.y, R);
      b.addColorStop(0, '#ffffff'); b.addColorStop(0.3, pl.c1); b.addColorStop(1, pl.c2);
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();

      // surface details, clipped to the sphere
      ctx.save();
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.clip();
      ctx.globalAlpha = A * 0.28; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, R * 0.07);
      if (pl.id === 'chaos' || pl.id === 'kindness') {
        for (let k = -3; k <= 3; k++) {
          ctx.beginPath();
          for (let s = -1; s <= 1.001; s += 0.1) {
            const yy = p.y + k * R * 0.28 + Math.sin(s * 5 + tick * (pl.id === 'chaos' ? 5 : 1.4) + k) * R * (pl.id === 'chaos' ? 0.1 : 0.05);
            s === -1 ? ctx.moveTo(p.x + s * R, yy) : ctx.lineTo(p.x + s * R, yy);
          }
          ctx.stroke();
        }
      } else if (pl.id === 'smart') {
        const pts = [[-.5, -.3], [-.1, -.55], [.35, -.25], [.15, .2], [-.35, .3], [.5, .35]];
        ctx.beginPath(); pts.forEach(([a, c], k) => { const x = p.x + a * R, y = p.y + c * R; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
        ctx.fillStyle = '#fff'; pts.forEach(([a, c]) => { ctx.beginPath(); ctx.arc(p.x + a * R, p.y + c * R, Math.max(1, R * 0.05), 0, TAU); ctx.fill(); });
      } else if (pl.id === 'beautiful') {
        for (let k = 0; k < 6; k++) { const a = tick * 0.8 + k * 1.05; fourStar(ctx, p.x + Math.cos(a) * R * 0.55, p.y + Math.sin(a * 1.3) * R * 0.55, R * 0.12, R * 0.03); ctx.fillStyle = '#fff'; ctx.fill(); }
      }
      ctx.restore();
      ctx.globalAlpha = A;

      // emoji badge + name
      if (R > 16) {
        ctx.font = `${Math.round(R * 0.85)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = A * 0.92; ctx.fillText(pl.emoji, p.x, p.y + R * 0.04); ctx.globalAlpha = A;
      }
      ctx.font = `600 ${focused ? 12 : 10}px "DM Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffe9f4'; ctx.shadowColor = pl.glow; ctx.shadowBlur = 8;
      ctx.globalAlpha = A * (focused ? 0 : 0.85);
      ctx.fillText(pl.trait.toUpperCase(), p.x, p.y + R + 15);
      ctx.shadowBlur = 0; ctx.globalAlpha = A;

      if (ringPts.length) {
        ctx.strokeStyle = 'rgba(210,228,255,.95)'; ctx.lineWidth = Math.max(1, R * 0.07);
        ctx.beginPath(); let on = false;
        ringPts.forEach((q) => { if (q.z < p.z) { on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; } else on = false; });
        ctx.stroke();
      }
      hits.push({ type: 'planet', i, x: p.x, y: p.y, r: Math.max(R * 1.05, 20), z: p.z });
    };

    const drawMiniHeart = (i) => {
      const a = tick * 0.1 + (i / MINI) * TAU;
      const R = 6.6;
      const bob = Math.sin(tick * 2 + i) * 0.12;
      const cxw = Math.cos(a) * R, czw = Math.sin(a) * R;
      const sz = 0.62 * (1 + Math.sin(tick * 2.4 + i * 0.7) * 0.08);
      const spin = tick * 0.9 + i;
      const cs = Math.cos(spin), sn = Math.sin(spin);
      for (let layer = 0; layer < 2; layer++) {
        ctx.beginPath();
        for (let k = 0; k < HEART_OUTLINE.length; k++) {
          const hx = HEART_OUTLINE[k][0] * sz, hy = HEART_OUTLINE[k][1] * sz;
          const q = proj(cxw + hx * cs - hy * sn, bob + (layer ? 0 : -0.2), czw + hx * sn + hy * cs);
          k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
        }
        ctx.closePath();
        if (layer === 0) { ctx.fillStyle = '#7d0f2c'; ctx.shadowBlur = 0; }
        else { ctx.fillStyle = '#ff2f5e'; ctx.shadowColor = '#ff2f5e'; ctx.shadowBlur = 14; }
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const drawWord = (i) => {
      const n = WORDS.length;
      const a = tick * 0.06 + (i / n) * TAU;
      const R = 12.4;
      const y = 0.5 + Math.sin(tick * 1.3 + i * 1.7) * 0.35;
      const px = Math.cos(a) * R, pz = Math.sin(a) * R;
      planeTransform(px, y, pz, -Math.sin(a), 0, Math.cos(a), 0, 1, 0, 100);
      const fade = clamp(1 - (po.z + 10) / 40, 0.45, 1);
      ctx.globalAlpha = fade * A;
      ctx.font = 'italic 600 78px "Playfair Display", Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff5a8f'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#fff4fa';
      ctx.fillText(WORDS[i], 0, 0);
      resetTransform();
      ctx.shadowBlur = 0; ctx.globalAlpha = A;
    };

    const wishPulse = (i) => 0.6 + 0.4 * Math.sin(tick * 3 + wishStars[i].ph);
    const drawWish = (i) => {
      const s = wishStars[i];
      const p = proj(s.x, s.y, s.z, mk());
      const got = ctl.current.wished.has(i);
      const tw = wishPulse(i);
      const R = (got ? 4.5 : 9.5) * clamp(p.s / 40, 0.6, 1.6) * (got ? 1 : 0.8 + 0.3 * tw);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 3.2);
      g.addColorStop(0, `rgba(255,236,170,${got ? 0.18 : 0.55 * tw})`); g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R * 3.2, 0, TAU); ctx.fill();
      fourStar(ctx, p.x, p.y, R, R * 0.28);
      ctx.fillStyle = got ? '#d9c9a0' : '#fff6d6'; ctx.shadowColor = '#ffe08a'; ctx.shadowBlur = got ? 0 : 12; ctx.fill(); ctx.shadowBlur = 0;
      hits.push({ type: 'wish', i, x: p.x, y: p.y, r: Math.max(R * 2.1, 20), z: p.z });
    };

    const drawVinyl = (au) => {
      const spin = tick * (ctl.current.playing ? 5 : 0.6);
      const tilt = 1.05; // mostly lying flat
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const bob = Math.sin(tick * 1.5) * 0.18;
      const vy = VINYL.y + bob;
      const k = 100;
      planeTransform(VINYL.x, vy, VINYL.z, 1, 0, 0, 0, ct, st, k, false);
      const R = 130; // local px => 1.3 world units
      ctx.save();
      ctx.shadowColor = '#ff6aa8'; ctx.shadowBlur = 24;
      ctx.fillStyle = '#0b0610'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      for (let r = 52; r < R - 4; r += 7) { ctx.strokeStyle = `rgba(255,160,205,${0.07 + (r % 21 === 0 ? 0.06 : 0)})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
      // reflective sweep
      ctx.save(); ctx.rotate(spin);
      const sw = ctx.createLinearGradient(-R, 0, R, 0);
      sw.addColorStop(0.4, 'rgba(255,255,255,0)'); sw.addColorStop(0.5, 'rgba(255,200,230,.2)'); sw.addColorStop(0.6, 'rgba(255,255,255,0)');
      ctx.fillStyle = sw; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.fill();
      // label
      const lg = ctx.createRadialGradient(0, 0, 4, 0, 0, 48);
      lg.addColorStop(0, '#ff9fcb'); lg.addColorStop(1, '#c2336f');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '38px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♥', 0, 2);
      ctx.restore();
      ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
      // visualizer bars radiating from the record, in its own plane
      const bins = au.bins, nb = 48;
      for (let b = 0; b < nb; b++) {
        const v = (bins[b % bins.length] || 0) / 255;
        const len = 6 + v * 70 * (ctl.current.playing ? 1 : 0.0);
        const a = (b / nb) * TAU + spin * 0.15;
        ctx.strokeStyle = `hsla(${330 + v * 40}, 100%, ${60 + v * 25}%, ${0.35 + v * 0.65})`;
        ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R + 10), Math.sin(a) * (R + 10)); ctx.lineTo(Math.cos(a) * (R + 10 + len), Math.sin(a) * (R + 10 + len)); ctx.stroke();
      }
      ctx.restore();
      resetTransform();
      const c = proj(VINYL.x, vy, VINYL.z, mk());
      // little caption
      ctx.font = '600 10px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd3e8'; ctx.globalAlpha = A * 0.85;
      ctx.fillText(ctl.current.playing ? '♪ now playing' : '♪ tap to play', c.x, c.y + c.s * 1.9);
      ctx.globalAlpha = A;
      hits.push({ type: 'vinyl', x: c.x, y: c.y, r: Math.max(c.s * 1.5, 26), z: c.z });
    };

    const imgCover = (im, dw, dh) => {
      const ir = im.naturalWidth / im.naturalHeight, dr = dw / dh;
      let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
      if (ir > dr) { sw = sh * dr; sx = (im.naturalWidth - sw) * 0.35; } else { sh = sw / dr; sy = (im.naturalHeight - sh) * 0.3; }
      return [sx, sy, sw, sh];
    };
    const polaroidPos = (pd) => {
      const a = pd.a0 + tick * 0.05;
      return [Math.cos(a) * pd.r, pd.y + Math.sin(tick * 1.1 + pd.ph) * 0.25, Math.sin(a) * pd.r, a];
    };
    const drawPolaroid = (i) => {
      const pd = polaroids[i];
      const [x, y, z, a] = polaroidPos(pd);
      planeTransform(x, y, z, -Math.sin(a), 0, Math.cos(a), 0, 1, 0, 100);
      const W = 200, H = 244;
      ctx.save();
      ctx.rotate(pd.roll);
      ctx.shadowColor = '#ff8ac4'; ctx.shadowBlur = 26;
      ctx.fillStyle = '#fbf6f2'; rr(ctx, -W / 2, -H / 2, W, H, 6); ctx.fill();
      ctx.shadowBlur = 0;
      const im = images[i];
      if (im.complete && im.naturalWidth) {
        const [sx, sy, sw, sh] = imgCover(im, 176, 176);
        ctx.drawImage(im, sx, sy, sw, sh, -88, -H / 2 + 12, 176, 176);
      } else { ctx.fillStyle = '#3a2442'; ctx.fillRect(-88, -H / 2 + 12, 176, 176); }
      ctx.fillStyle = '#6d4a60'; ctx.font = 'italic 600 19px "Playfair Display", Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(CONFIG.polaroids[i].caption, 0, H / 2 - 28);
      ctx.restore();
      resetTransform();
      const c = proj(x, y, z, mk());
      hits.push({ type: 'polaroid', i, x: c.x, y: c.y, r: Math.max(c.s * 1.25, 28), z: c.z });
    };

    // heart cloud + halo ring drawn together, depth sorted
    const total = cloud.length + halo.length;
    const sx = new Float32Array(total), sy = new Float32Array(total), sz_ = new Float32Array(total), sc = new Uint8Array(total), sr = new Float32Array(total);
    const order = new Uint16Array(total);
    const drawHeartCloud = (au) => {
      const hc = proj(0, 1.5, 0, mk());
      const pulse = 1 + au.beat * 0.35;
      const gR = HEART_SIZE * 2.4 * hc.s * pulse;
      const g = ctx.createRadialGradient(hc.x, hc.y, 0, hc.x, hc.y, gR);
      g.addColorStop(0, `rgba(255,180,120,${0.26 + au.beat * 0.26})`);
      g.addColorStop(0.38, `rgba(255,90,140,${0.22 + au.beat * 0.18})`);
      g.addColorStop(1, 'rgba(255,40,80,0)');
      ctx.fillStyle = g; ctx.fillRect(hc.x - gR, hc.y - gR, gR * 2, gR * 2);

      ctx.save();
      ctx.translate(hc.x, hc.y);
      ctx.shadowColor = 'rgba(255,160,120,0.8)';
      ctx.shadowBlur = 26;
      ctx.globalAlpha = 0.22 + au.beat * 0.18;
      ctx.fillStyle = '#ff8d6e';
      ctx.beginPath();
      for (let k = 0; k < HEART_OUTLINE.length; k++) {
        const x = HEART_OUTLINE[k][0] * 1.1 * hc.s * 0.85;
        const y = HEART_OUTLINE[k][1] * 1.1 * hc.s * 0.85;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const ang = tick * 0.55, ca = Math.cos(ang), sa = Math.sin(ang);
      const tilt = 0.2, ct = Math.cos(tilt), st = Math.sin(tilt);
      const lift = 1.5 + Math.sin(tick * 1.6) * 0.12;
      const beat = 1 + Math.pow(Math.max(0, Math.sin(tick * 3.2)), 6) * 0.06 + au.beat * 0.09;
      const q = mk();
      let n = 0;
      for (let i = 0; i < cloud.length; i++, n++) {
        const c = cloud[i];
        const x0 = c.x * beat, y0 = c.y * beat, z0 = c.z * beat;
        const x1 = x0 * ca + z0 * sa, z1 = -x0 * sa + z0 * ca;
        const y2 = y0 * ct - z1 * st, z2 = y0 * st + z1 * ct;
        proj(x1, y2 + lift, z2, q);
        sx[n] = q.x; sy[n] = q.y; sz_[n] = q.z; sr[n] = Math.max(0.7, q.s * 0.028 * c.sz);
        const lit = clamp(0.5 - z1 / (HEART_SIZE * 1.3), 0, 1);
        const sparkle = Math.sin(tick * 4 + c.ph) > 0.88 ? 0.5 : 0;
        sc[n] = Math.floor(clamp(0.12 + lit * 0.5 + sparkle + au.beat * 0.12, 0, 1) * 31);
      }
      for (let i = 0; i < halo.length; i++, n++) {
        const p = halo[i];
        const a = p.a + tick * 0.35 * p.sp;
        const r = p.r * (1 + au.beat * 0.08);
        proj(Math.cos(a) * r, lift - 0.3 + p.y + Math.sin(a * 3 + tick) * 0.05, Math.sin(a) * r, q);
        sx[n] = q.x; sy[n] = q.y; sz_[n] = q.z; sr[n] = Math.max(0.8, q.s * 0.032);
        sc[n] = 14 + ((i * 7) % 13);
      }
      for (let i = 0; i < total; i++) order[i] = i;
      order.sort((a, b) => sz_[b] - sz_[a]);
      ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,170,200,0.8)';
      for (let k = 0; k < total; k++) {
        const i = order[k];
        ctx.fillStyle = SHADES[sc[i]];
        const r = sr[i];
        ctx.beginPath();
        ctx.arc(sx[i], sy[i], r * 1.15, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const drawDust = (back) => {
      for (const d of dust) {
        const a = d.a + tick * 0.03;
        proj(Math.cos(a) * d.r, d.y, Math.sin(a) * d.r);
        if ((P.z > 0) !== back) continue;
        const tw = 0.55 + 0.45 * Math.sin(tick * 2 + d.ph);
        ctx.globalAlpha = tw * clamp(1.15 - P.z / 30, 0.25, 1) * (polT > 0.5 ? 0.4 : 1);
        ctx.fillStyle = d.hue ? '#ff8a3d' : '#ff5a7a';
        const r = d.sz * clamp(P.s / 40, 0.5, 1.4);
        ctx.fillRect(P.x - r / 2, P.y - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
    };

    // ---------- meteors (screen-space, clickable) ----------
    const spawnMeteor = (special) => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = special ? rand(420, 520) : rand(700, 1000);
      const ang = rand(0.9, 1.2);
      meteors.push({
        id: Math.random(), special,
        x: dir > 0 ? rand(-0.1, 0.55) * w : rand(0.45, 1.1) * w, y: rand(-60, h * 0.1),
        vx: Math.cos(ang) * speed * dir, vy: Math.sin(ang) * speed,
        len: special ? 190 : rand(70, 140), life: 0,
      });
    };
    const updateMeteors = (dt, now) => {
      const busy = ctl.current.paused || document.hidden;
      if (!busy && now > nextMeteor) { spawnMeteor(true); nextMeteor = now + rand(7, 12); }
      if (!busy && now > nextShower) {
        for (let i = 0; i < 9; i++) setTimeout(() => spawnMeteor(false), i * 260 + rand(0, 160));
        nextShower = now + rand(26, 40);
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx * dt; m.y += m.vy * dt; m.life += dt;
        if (m.y > h + 80 || m.x < -250 || m.x > w + 250) { meteors.splice(i, 1); continue; }
        const sp = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, m.special ? 'rgba(255,240,190,1)' : 'rgba(255,255,255,.9)');
        g.addColorStop(1, m.special ? 'rgba(255,170,110,0)' : 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = m.special ? 3.2 : 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
        if (m.special) {
          const pulse = 0.7 + 0.3 * Math.sin(m.life * 14);
          drawOrbGlow(m.x, m.y, 6 * pulse, '#ffe08a');
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, TAU); ctx.fill();
          hits.push({ type: 'meteor', id: m.id, x: m.x, y: m.y, r: 42, z: -100 });
        }
      }
    };

    const burst = (x, y, gold) => {
      for (let i = 0; i < (gold ? 26 : 18); i++) bursts.push({
        x, y, vx: (Math.random() - 0.5) * 2.8, vy: (Math.random() - 0.8) * 2.8,
        life: 1, size: 12 + Math.random() * 17, gold,
      });
    };

    // ---------- main loop ----------
    const draw = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - lastNow); lastNow = now;
      const C = ctl.current;
      tick += 0.01;
      orbitT += 0.004 * (C.focus >= 0 ? 0.1 : 1);
      hits.length = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const au = C.audio ? C.audio.levels() : NO_AUDIO;

      // planets move with orbitT (slower, smoother drift for a more natural galaxy motion)
      planets.forEach((pl) => {
        const a = pl.phase + orbitT * pl.speed * 8;
        pl.pos = [Math.cos(a) * pl.orbit, pl.y + Math.sin(orbitT * 1.6 + pl.phase) * 0.12, Math.sin(a) * pl.orbit];
      });

      // camera: user drag + parallax + zoom targets
      pointer.x += (pointer.tx - pointer.x) * 0.04; pointer.y += (pointer.ty - pointer.y) * 0.04;
      if (!C.dragging) {
        view.yaw += view.vy * 0.35; view.pitch = clamp(view.pitch + view.vp, -0.3, 0.45);
        view.vy *= 0.75; view.vp *= 0.8;
        if (C.polaroid && Math.abs(view.vy) < 0.002) view.yaw += 0.0009;
        if (C.focus >= 0) { view.pitch *= 0.95; }
      }
      polT += ((C.polaroid ? 1 : 0) - polT) * 0.06;
      const focus = C.focus;
      const k = 0.065;
      let tx = 0, ty = 0.8, tz = 0, tD = 30 - polT * 3;
      let tcx = cam.baseCx, tcy = cam.baseCy;
      if (focus >= 0) {
        [tx, ty, tz] = planets[focus].pos;
        tD = 7.2 + planets[focus].size * 2.2;
        const mobile = w < 700;
        tcx = mobile ? w / 2 : w * 0.34; tcy = mobile ? h * 0.3 : h * 0.5;
      }
      cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k;
      cam.D += (tD - cam.D) * k; cam.cx += (tcx - cam.cx) * k; cam.cy += (tcy - cam.cy) * k;
      cam.yaw = Math.sin(tick * 0.18) * 0.08 + pointer.x * 0.18 + view.yaw;
      cam.pitch = clamp(0.38 + pointer.y * 0.08 + view.pitch, 0.15, 0.9);

      // deep space + crimson haze
      const bg = ctx.createRadialGradient(cam.baseCx, cam.baseCy, 10, cam.baseCx, cam.baseCy, Math.max(w, h) * 0.7);
      bg.addColorStop(0, `rgba(120,10,45,${0.2 + au.bass * 0.15})`); bg.addColorStop(0.5, 'rgba(50,8,40,.10)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const alpha = s.a * (0.55 + 0.45 * Math.sin(tick * s.tw + s.ph));
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(s.x - pointer.x * s.d * 14 - view.yaw * s.d * 40 % w, s.y - pointer.y * s.d * 8, s.r * 1.4, s.r * 1.4);
      }
      drawDust(true);

      // sorted solid objects (far -> near)
      const items = [];
      const dim = (focus >= 0 ? 0.14 : 1) * (1 - 0.72 * polT);
      const depth = (x, y, z) => proj(x, y, z, po).z;
      const add = (z, fn, a = dim) => items.push({ z, fn, a });
      for (let i = 0; i < MINI; i++) {
        const a = tick * 0.1 + (i / MINI) * TAU;
        add(depth(Math.cos(a) * 6.6, 0, Math.sin(a) * 6.6), () => drawMiniHeart(i));
      }
      for (let i = 0; i < WORDS.length; i++) {
        const a = tick * 0.06 + (i / WORDS.length) * TAU;
        add(depth(Math.cos(a) * 12.4, 0.5, Math.sin(a) * 12.4), () => drawWord(i));
      }
      planets.forEach((pl, i) => add(depth(...pl.pos), () => drawPlanet(pl, i), focus === i ? 1 : focus < 0 ? dim : 0.22));
      wishStars.forEach((s, i) => add(depth(s.x, s.y, s.z), () => drawWish(i), dim));
      add(depth(VINYL.x, VINYL.y, VINYL.z), () => drawVinyl(au), dim);
      add(0, () => drawHeartCloud(au), dim);
      if (polT > 0.02) polaroids.forEach((pd, i) => { const p = polaroidPos(pd); add(depth(p[0], p[1], p[2]), () => drawPolaroid(i), polT); });
      items.sort((a, b) => b.z - a.z);
      for (const it of items) { A = it.a; ctx.globalAlpha = A; if (A > 0.01) it.fn(); }
      A = 1; ctx.globalAlpha = 1;

      drawDust(false);
      updateMeteors(dt, now);

      // sparkles / floating hearts
      for (let i = bursts.length - 1; i >= 0; i--) { if (bursts[i].life <= 0) bursts.splice(i, 1); }
      for (const b of bursts) {
        b.x += b.vx; b.y += b.vy; b.life -= 0.012; b.vy -= 0.008;
        ctx.globalAlpha = Math.max(0, b.life);
        ctx.fillStyle = b.gold ? '#ffe08a' : '#ff7fb0';
        ctx.font = `${b.size}px serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(b.gold ? '✦' : '♥', b.x, b.y);
      }
      ctx.globalAlpha = 1;
      if (window.__galaxyDebug) window.__galaxyHits = hits.slice();
      raf = requestAnimationFrame(draw);
    };

    // ---------- input ----------
    const drag = { down: false, moved: false, sx: 0, sy: 0, lx: 0, ly: 0 };
    const UI = 'button,a,input,label,select,textarea,.panel,.modal-backdrop,.dock,.overlay,.story,.journey';
    const onDown = (e) => {
      if (e.target.closest?.(UI)) return;
      drag.down = true; drag.moved = false; drag.sx = drag.lx = e.clientX; drag.sy = drag.ly = e.clientY;
    };
    const onMove = (e) => {
      pointer.tx = (e.clientX / w - 0.5) * 2;
      pointer.ty = (e.clientY / h - 0.5) * 2;
      if (!drag.down) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      if (drag.moved) {
        ctl.current.dragging = true;
        const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
        view.yaw += dx * 0.0022; view.vy = dx * 0.0022;
        view.pitch = clamp(view.pitch + dy * 0.0018, -0.3, 0.45); view.vp = dy * 0.0018;
      }
      drag.lx = e.clientX; drag.ly = e.clientY;
    };
    const onUp = (e) => {
      if (!drag.down) return;
      drag.down = false; ctl.current.dragging = false;
      if (!drag.moved) tap(e.clientX, e.clientY);
    };
    const tap = (x, y) => {
      const C = ctl.current;
      if (C.paused) return;
      const pool = C.polaroid ? hits.filter((hh) => hh.type === 'polaroid' || hh.type === 'meteor') : hits; // only photos are tappable in Polaroid mode
      const cand = pool.filter((hh) => Math.hypot(hh.x - x, hh.y - y) <= hh.r).sort((a, b) => a.z - b.z)[0];
      if (!cand) {
        if (C.focus >= 0) { C.onBackground?.(); return; }
        burst(x, y, false); C.onBurst?.(); return;
      }
      if (C.focus >= 0 && !(cand.type === 'planet' && cand.i === C.focus)) { C.onBackground?.(); return; }
      if (cand.type === 'planet') C.onPlanet?.(cand.i);
      else if (cand.type === 'wish') { burst(cand.x, cand.y, true); C.onWish?.(cand.i); }
      else if (cand.type === 'vinyl') C.onVinyl?.();
      else if (cand.type === 'polaroid') C.onPolaroid?.(cand.i);
      else if (cand.type === 'meteor') {
        const idx = meteors.findIndex((m) => m.id === cand.id);
        if (idx >= 0) meteors.splice(idx, 1);
        burst(cand.x, cand.y, true); C.onMeteor?.();
      }
    };

    resize(); draw();
    window.addEventListener('resize', resize);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="galaxy-canvas" aria-label="Interactive 3D galaxy" />;
}
