// ✏️  EDIT ME — everything Alicia reads, sees and finds lives in this file.
// Swap the placeholder lines for your own words, memories and photos.

const publicAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

export const CONFIG = {
  fullName: 'Alicia Sibanda',
  herName: 'ALICIA',
  headline: 'A universe made for you',

  // Words that float around the galaxy
  words: ['Love You', 'Forever', 'Always', 'Alicia', 'Shine On', 'Beautiful', 'My Star', 'Mine 💗'],

  // The favourite-star ceremony unlocks after this many of the 6 discoveries are complete (use 0 to always allow it)
  ceremonyUnlockAt: 4,

  // Default playlist for the in-page music player. Keep them in /public/music.
  musicSrc: [
    publicAsset('/music/RNB%201.mpeg'),
    publicAsset('/music/RNB%202.mpeg'),
    publicAsset('/music/RNB%203.mpeg'),
    publicAsset('/music/RNB%204.mpeg'),
    publicAsset('/music/RNB%205.mpeg'),
  ],
  musicTitle: 'RNB Mix',

  // Photos (put more files in /public/photos and add them here)
  photos: [
    { src: publicAsset('/photos/photo-1.jpg'), caption: 'Keep shining', pos: '50% 35%' },
    { src: publicAsset('/photos/photo-2.jpg'), caption: 'Your beautiful energy', pos: '50% 45%' },
    { src: publicAsset('/photos/photo-3.jpg'), caption: 'One of a kind', pos: '50% 35%' },
    { src: publicAsset('/photos/birthday-memory.jpeg'), caption: 'A birthday to remember', pos: '50% 45%' },
    { src: publicAsset('/photos/street-memory.jpeg'), caption: 'A moment in time', pos: '50% 45%' },
    { src: publicAsset('/photos/sunny-day.jpeg'), caption: 'Out in the sunshine', pos: '50% 45%' },
    { src: publicAsset('/photos/smile-collage.jpeg'), caption: 'That beautiful smile', pos: '50% 40%' },
  ],

  // 📸 Polaroid Galaxy – these float in 3D. Add as many as you like.
  polaroids: [
    { src: publicAsset('/photos/photo-1.jpg'), caption: 'Keep shining ✨', note: 'The kind of glow you cannot fake.' },
    { src: publicAsset('/photos/photo-2.jpg'), caption: 'Pure energy', note: 'Every room feels brighter with you in it.' },
    { src: publicAsset('/photos/photo-3.jpg'), caption: 'One of a kind', note: 'They broke the mould, then hid it.' },
    { src: publicAsset('/photos/photo-1.jpg'), caption: 'Favourite view', note: 'Still my favourite view in the whole universe.' },
    { src: publicAsset('/photos/photo-3.jpg'), caption: 'Main character', note: 'Of this galaxy, and of my story.' },
    { src: publicAsset('/photos/photo-2.jpg'), caption: 'Starlight', note: 'Soft, bright, impossible to look away from.' },
    { src: publicAsset('/photos/birthday-memory.jpeg'), caption: 'Birthday magic 🎂', note: 'A little celebration for someone who makes life sweeter.' },
    { src: publicAsset('/photos/street-memory.jpeg'), caption: 'A moment in time', note: 'Every chapter looks better with you in it.' },
    { src: publicAsset('/photos/sunny-day.jpeg'), caption: 'Sunshine ✨', note: 'You bring your own light wherever you go.' },
    { src: publicAsset('/photos/smile-collage.jpeg'), caption: 'That smile 💗', note: 'A few of my favourite reasons to smile right back.' },
  ],

  // 🌌 Constellation of Memories – one photo + memory per completed shape
  constellations: [
    { id: 'heart', name: 'Our Heart', photo: publicAsset('/photos/photo-1.jpg'),
      memory: 'You connected the stars and made a heart — which is exactly what you did to me. 💗' },
    { id: 'star', name: 'My Favourite Star', photo: publicAsset('/photos/photo-3.jpg'),
      memory: 'Out of every star I could have connected, this is the one I would pick every single time.' },
  ],

  // 🪐 Planet Showcase – each planet carries a trait and a story
  planets: [
    { id: 'kindness', name: 'Kindness Planet', emoji: '🌸', trait: 'Kindness',
      orbit: 7.4, speed: 0.13, phase: 0.4, y: 0.4, size: 1.05, c1: '#ffd1e6', c2: '#e0568f', glow: '#ff9fcb',
      story: 'This planet runs on the way you treat people — gently, without keeping score. Your kindness is the quiet kind that never asks to be noticed, and it is the first thing that made this whole universe feel safe.' },
    { id: 'chaos', name: 'Chaos Planet 😤', emoji: '😤', trait: 'Chaos',
      orbit: 8.2, speed: -0.1, phase: 2.2, y: -0.5, size: 1.2, c1: '#ffe0a3', c2: '#ef7a1a', glow: '#ffb35c',
      story: 'Mahlezi ukwatile. Even the storm feels softer when it comes with your laughter in it.' },
    { id: 'loyalty', name: 'Loyalty Planet', emoji: '🛡️', trait: 'Loyalty',
      orbit: 8.9, speed: 0.085, phase: 4.1, y: 0.9, size: 1.15, c1: '#c9dcff', c2: '#3d63c9', glow: '#8fb2ff',
      story: 'A planet with a ring around it, because loyalty never really ends. You show up, you stay, you hold the line for the people you love. This is the planet that never drifts out of orbit.' },
    { id: 'smart', name: 'Smart Planet', emoji: '🧠', trait: 'Smart',
      orbit: 9.6, speed: -0.07, phase: 5.3, y: -0.9, size: 1.1, c1: '#bff6ee', c2: '#12877f', glow: '#6ff0de',
      story: 'Quick, sharp and always three steps ahead. Your mind is one of my favourite places to get lost in, and the way you figure things out will always impress me.' },
    { id: 'beautiful', name: 'Beautiful Planet', emoji: '💖', trait: 'Beautiful',
      orbit: 10.4, speed: 0.055, phase: 1.3, y: 0.2, size: 1.3, c1: '#f3dcff', c2: '#a24bd6', glow: '#d79bff',
      story: 'Everything on this planet glows, inside and out. Beauty here is not only how you look — it is how you make everyone around you feel. This is the planet the other four orbit around, if I am being honest.' },
  ],

  // ✨ Wish Upon a Star – the golden stars hide these
  wishes: [
    { kind: 'compliment', text: 'Your smile could outshine a supernova.' },
    { kind: 'compliment', text: 'You make ordinary days feel like starlight.' },
    { kind: 'compliment', text: 'You are the reason I believe in good things.' },
    { kind: 'memory', text: 'A memory to keep: the way you laugh until you cannot breathe.' },
    { kind: 'compliment', text: 'Your energy is genuinely contagious — in the best way.' },
    { kind: 'compliment', text: 'You are braver and more brilliant than you give yourself credit for.' },
    { kind: 'memory', text: 'A memory to keep: all the little moments that turned into my favourite ones.' },
    { kind: 'compliment', text: 'Somebody out there is so proud of you. (It’s me.)' },
    { kind: 'compliment', text: 'You are the plot twist I never saw coming and never want to lose.' },
    { kind: 'compliment', text: 'You deserve every star in this sky — and I would try to get them all.' },
  ],

  // ☄️ Hidden content unlocked by clicking shooting stars (one per star caught)
  secrets: [
    { title: 'Secret #1', text: 'The first time I really noticed you, I forgot what I was going to say.' },
    { title: 'Secret #2', text: 'You are the person I want to tell everything to — good news first.' },
    { title: 'Secret #3', text: 'I made this whole universe just so you would have somewhere that feels like you.' },
    { title: 'Secret #4', text: 'If I could rename the stars, they would all be called Alicia.' },
    { title: 'Secret #5', text: 'Your name is my favourite sound to say out loud.' },
    { title: 'Secret #6', text: 'You caught every shooting star — so you know. I wished on every one of them for you.' },
  ],
};

// How many of each thing counts as "done" for the journey tracker
export const GOALS = {
  con: { goal: 2, label: 'Complete both constellations', icon: '🌌' },
  wish: { goal: 5, label: 'Find 5 wishing stars', icon: '✨' },
  planets: { goal: 5, label: 'Visit all 5 planets', icon: '🪐' },
  meteors: { goal: 1, label: 'Catch a shooting star', icon: '☄️' },
  pol: { goal: 1, label: 'Inspect a polaroid memory', icon: '📸' },
  music: { goal: 1, label: 'Play the cosmic record', icon: '🎵' },
};
