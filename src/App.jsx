import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { CONFIG, GOALS } from './content.js';
import { CosmicAudio } from './audio.js';
import GalaxyCanvas from './GalaxyCanvas.jsx';
import Constellation from './Constellation.jsx';
import Ceremony from './Ceremony.jsx';

const EMPTY = { con: [], wish: [], planets: [], meteors: [], pol: [], music: [] };
const STORE = 'alicia-galaxy-progress-v1';

function loadProgress() {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return EMPTY; }
}

function MusicPanel({ audio, playing, onToggle, onClose }) {
  const ref = useRef(null);
  const [name, setName] = useState('');
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d');
    let raf = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const { bins, beat } = audio.levels();
      const n = 28, bw = W / n;
      for (let i = 0; i < n; i++) {
        const v = playing ? (bins[i] || 0) / 255 : 0.04 + 0.03 * Math.sin(Date.now() / 400 + i);
        const bh = Math.max(3, v * H * 0.95);
        const g = ctx.createLinearGradient(0, H, 0, H - bh);
        g.addColorStop(0, '#ff4f8b'); g.addColorStop(1, '#ffd3ef');
        ctx.fillStyle = g; ctx.fillRect(i * bw + 2, H - bh, bw - 4, bh);
      }
      ctx.fillStyle = `rgba(255,120,190,${beat * 0.25})`; ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [audio, playing]);

  return (
    <div className="panel music-panel">
      <button className="panel-close" onClick={onClose} aria-label="Close player">×</button>
      <div className="music-head">
        <div className={`mini-vinyl ${playing ? 'spin' : ''}`}><span>♥</span></div>
        <div>
          <div className="letter-kicker">🎵 COSMIC MUSIC PLAYER</div>
          <div className="music-title">{name || (audio.mode === 'file' && audio.fileName) || CONFIG.musicTitle}</div>
        </div>
      </div>
      <canvas ref={ref} className="visualizer" />
      <div className="music-actions">
        <button className="reveal-btn" onClick={onToggle}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
        {audio.playlist.length > 1 && (
          <button className="reveal-btn" onClick={() => audio.nextTrack?.()} aria-label="Next track">⏭ Next</button>
        )}
        <label className="close-letter file-btn">
          Play your own song
          <input type="file" accept="audio/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setName(f.name.replace(/\.[^.]+$/, '')); await audio.loadFile(f);
          }} />
        </label>
      </div>
    </div>
  );
}

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [focus, setFocus] = useState(-1);
  const [polaroid, setPolaroid] = useState(false);
  const [inspect, setInspect] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [game, setGame] = useState(false);
  const [ceremony, setCeremony] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [journey, setJourney] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState('');
  const [sparkle, setSparkle] = useState(0);
  const audio = useMemo(() => new CosmicAudio(CONFIG.musicSrc), []);
  const ctl = useRef({ focus: -1, polaroid: false, paused: false, wished: new Set(), playing: false, audio, dragging: false });
  const toastTimer = useRef(0);

  const say = useCallback((text) => {
    setToast(text); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3800);
  }, []);

  const mark = useCallback((key, id) => setProgress((p) => (p[key].includes(id) ? p : { ...p, [key]: [...p[key], id] })), []);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* private mode */ } }, [progress]);

  const doneCount = Object.keys(GOALS).filter((k) => progress[k].length >= GOALS[k].goal).length;
  const total = Object.keys(GOALS).length;
  const unlocked = doneCount >= CONFIG.ceremonyUnlockAt;
  const announced = useRef(false);
  useEffect(() => {
    if (doneCount === total && !announced.current) { announced.current = true; say('Everything discovered! 🌠 The Favourite Star Ceremony is ready.'); }
  }, [doneCount, total, say]);

  useEffect(() => { audio.onChange = (p) => setPlaying(p); return () => { audio.onChange = null; audio.pause(); }; }, [audio]);
  const togglePlay = useCallback(async () => { const p = await audio.toggle(); if (p) mark('music', 'played'); }, [audio, mark]);

  // keep the 3D engine's shared bag in sync with React state
  const C = ctl.current;
  C.focus = focus; C.polaroid = polaroid; C.playing = playing;
  C.paused = !!reveal || game || ceremony || inspect !== null;
  C.wished = new Set(progress.wish);
  C.onPlanet = (i) => { setFocus(i); mark('planets', CONFIG.planets[i].id); };
  C.onBackground = () => setFocus(-1);
  C.onBurst = () => setSparkle((v) => v + 1);
  C.onWish = (i) => { mark('wish', i); const w = CONFIG.wishes[i]; setReveal({ kicker: '✨ A WISH COMES TRUE', emoji: w.kind === 'memory' ? '🫶' : '💫', title: w.kind === 'memory' ? 'A memory' : 'A compliment, just for you', text: w.text }); };
  C.onMeteor = () => {
    const n = progress.meteors.length; const s = CONFIG.secrets[n % CONFIG.secrets.length]; mark('meteors', n);
    setReveal({ kicker: '☄️ HIDDEN CONTENT UNLOCKED', emoji: '🌠', title: s.title, text: s.text });
  };
  C.onVinyl = () => { setMusicOpen(true); togglePlay(); };
  C.onPolaroid = (i) => { mark('pol', i); setInspect(i); };

  const planet = focus >= 0 ? CONFIG.planets[focus] : null;
  const startCeremony = () => { if (!unlocked) { say(`Discover ${CONFIG.ceremonyUnlockAt - doneCount} more thing${CONFIG.ceremonyUnlockAt - doneCount > 1 ? 's' : ''} to unlock the ceremony ✨ (see your journey)`); return; } setFocus(-1); setPolaroid(false); setCeremony(true); };
  const closeCeremony = () => { setCeremony(false); };
  const quiet = focus >= 0 || polaroid;

  return (
    <main className="universe">
      <GalaxyCanvas ctl={ctl} />
      <div className="vignette" />

      <header className="topbar">
        <div className="brand"><span className="brand-dot" /> A LITTLE UNIVERSE</div>
        <button className="sound-btn" onClick={() => setJourney((v) => !v)} aria-label="Your journey">
          <Sparkles size={15} /><span>{doneCount} / {total} discovered</span>
        </button>
      </header>

      <section className={`hero ${quiet ? 'hero-quiet' : ''}`}>
        <div className="eyebrow"><Sparkles size={14} /> A SPECIAL PLACE IN THE STARS <Sparkles size={14} /></div>
        <h1>{CONFIG.headline}<span>.</span></h1>
        <p className="subheading">For <strong>{CONFIG.fullName}</strong> — because ordinary words aren't enough.</p>
      </section>

      {journey && (
        <div className="panel journey">
          <button className="panel-close" onClick={() => setJourney(false)} aria-label="Close">×</button>
          <div className="letter-kicker">YOUR JOURNEY THROUGH THE STARS</div>
          <ul>
            {Object.entries(GOALS).map(([k, g]) => {
              const n = Math.min(progress[k].length, g.goal), ok = n >= g.goal;
              return <li key={k} className={ok ? 'ok' : ''}><span>{g.icon}</span><em>{g.label}</em><b>{ok ? '✓' : `${n}/${g.goal}`}</b></li>;
            })}
          </ul>
          <p className="journey-note">{unlocked ? '🌠 The Favourite Star Ceremony is unlocked.' : `Complete ${CONFIG.ceremonyUnlockAt} to unlock the Favourite Star Ceremony.`}</p>
        </div>
      )}

      {planet && (
        <aside className="panel story" style={{ '--glow': planet.glow }}>
          <div className="story-emoji">{planet.emoji}</div>
          <div className="letter-kicker">{planet.trait.toUpperCase()} · PLANET {focus + 1} OF {CONFIG.planets.length}</div>
          <h2>{planet.name}</h2>
          <p>{planet.story}</p>
          <div className="story-actions">
            <button className="close-letter" onClick={() => setFocus((focus + 1) % CONFIG.planets.length)}>Next planet →</button>
            <button className="close-letter" onClick={() => setFocus(-1)}>Zoom back out</button>
          </div>
        </aside>
      )}

      {musicOpen && <MusicPanel audio={audio} playing={playing} onToggle={togglePlay} onClose={() => setMusicOpen(false)} />}

      <div className="hint">
        {polaroid ? 'Drag to rotate the galaxy · tap a polaroid to inspect it'
          : focus >= 0 ? 'Tap anywhere to zoom back out'
          : 'Drag to rotate · tap planets 🪐 golden stars ✨ the vinyl 🎵 and shooting stars ☄️'}
      </div>

      <nav className="dock" aria-label="Experiences">
        <button onClick={() => setGame(true)}><span>🌌</span><small>Constellations</small></button>
        <button className={polaroid ? 'on' : ''} onClick={() => { setPolaroid((v) => !v); setFocus(-1); }}><span>📸</span><small>Polaroids</small></button>
        <button className={musicOpen ? 'on' : ''} onClick={() => setMusicOpen((v) => !v)}><span>🎵</span><small>Music</small></button>
        <button className={`ceremony-btn ${unlocked ? 'ready' : ''}`} onClick={startCeremony}><span>{unlocked ? '🌠' : '🔒'}</span><small>Ceremony</small></button>
      </nav>

      {toast && <div className="toast">{toast}</div>}

      {reveal && (
        <div className="modal-backdrop" onClick={() => setReveal(null)}>
          <article className="letter panel" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setReveal(null)} aria-label="Close">×</button>
            <div className="letter-icon">{reveal.emoji}</div>
            <div className="letter-kicker">{reveal.kicker}</div>
            <h2>{reveal.title}</h2>
            <p>{reveal.text}</p>
            <button className="close-letter" onClick={() => setReveal(null)}>Back to the galaxy</button>
          </article>
        </div>
      )}

      {inspect !== null && (
        <div className="modal-backdrop" onClick={() => setInspect(null)}>
          <article className="polaroid-card panel" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setInspect(null)} aria-label="Close">×</button>
            <div className="polaroid-photo"><img src={CONFIG.polaroids[inspect].src} alt={CONFIG.polaroids[inspect].caption} /></div>
            <h3>{CONFIG.polaroids[inspect].caption}</h3>
            <p>{CONFIG.polaroids[inspect].note}</p>
            <button className="close-letter" onClick={() => setInspect(null)}>Back to the galaxy</button>
          </article>
        </div>
      )}

      {game && <Constellation doneIds={progress.con} onComplete={(id) => mark('con', id)} onClose={() => setGame(false)} />}
      {ceremony && <Ceremony onClose={closeCeremony} />}

      <div className="sparkle-count" key={sparkle}><Heart size={12} fill="currentColor" /> {sparkle > 0 ? `${sparkle} little wishes made` : 'tap the sky to make a wish'}</div>
    </main>
  );
}
