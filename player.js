/* ambient sound player — uses real mp3 loops, persisted state.
   v0.1 */
(() => {
  const SOUNDS = [
    { id: 'rain',        label: 'rain',        src: 'sounds/rain.mp3' },
    { id: 'train-long',  label: 'train 6m',    src: 'sounds/train-long.mp3' },
    { id: 'train-short', label: 'train 1m',    src: 'sounds/train-short.mp3', endAt: 60 },
  ];
  const LS = 'focusTimer.player';

  const state = (() => {
    const def = { open: false, playing: false, sound: 'rain', vol: 0.6 };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(LS) || '{}')); }
    catch { return def; }
  })();
  const save = () => localStorage.setItem(LS, JSON.stringify(state));

  // single audio element, swap src as needed
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = state.vol;

  function currentDef() { return SOUNDS.find(s => s.id === state.sound) || SOUNDS[0]; }

  function loadSound() {
    const def = currentDef();
    if (!audio.src.endsWith(def.src)) {
      audio.src = def.src;
    }
    audio.ontimeupdate = null;
    if (def.endAt) {
      audio.ontimeupdate = () => {
        if (audio.currentTime >= def.endAt) audio.currentTime = 0;
      };
    }
  }

  function play() {
    loadSound();
    audio.play().catch(() => { state.playing = false; render(); save(); });
  }
  function stop() {
    audio.pause();
    audio.currentTime = 0;
  }

  // Volume steps: 5 levels mapped to 0.0–1.0
  // Represented as speaker + arc waves (like a real speaker icon)
  // Each step lights up more waves to the right of the speaker cone
  const VOL_STEPS = [0.2, 0.4, 0.6, 0.8, 1.0];

  // SVG speaker cone + wave arcs — inline, theme-colored
  // Waves: 1=mute/very low, up to 3 arcs for full
  function volSvg(vol) {
    // How many arcs are active
    const active = VOL_STEPS.filter(v => vol >= v - 0.001).length; // 0–5
    // Map 5 steps to 3 arcs: steps 1-2 → 1 arc, 3 → 2 arcs, 4-5 → 3 arcs
    const arcsLit = active === 0 ? 0 : active <= 2 ? 1 : active === 3 ? 2 : 3;

    const on = 'var(--rp-foam)';
    const off = 'var(--rp-hl-med)';
    const cone = 'var(--rp-subtle)';

    // Speaker cone path + 3 concentric arcs
    // Viewbox 20x14, cone on left, arcs fan out right
    const a1col = arcsLit >= 1 ? on : off;
    const a2col = arcsLit >= 2 ? on : off;
    const a3col = arcsLit >= 3 ? on : off;

    return `<svg class="vol-svg" width="28" height="14" viewBox="0 0 28 14" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle">
      <!-- speaker cone: rectangle body + triangle flare -->
      <rect x="1" y="4" width="4" height="6" rx="0.5" fill="${cone}"/>
      <polygon points="5,4 9,1 9,13 5,10" fill="${cone}"/>
      <!-- arc 1: close -->
      <path d="M11,4.5 Q13,7 11,9.5" fill="none" stroke="${a1col}" stroke-width="1.4" stroke-linecap="round"/>
      <!-- arc 2: mid -->
      <path d="M13.5,2.5 Q17,7 13.5,11.5" fill="none" stroke="${a2col}" stroke-width="1.4" stroke-linecap="round"/>
      <!-- arc 3: far -->
      <path d="M16,0.5 Q21,7 16,13.5" fill="none" stroke="${a3col}" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
  }

  // ---------- UI ----------
  const $player = document.getElementById('player');

  function render() {
    audio.volume = state.vol;
    if (!state.open) {
      $player.className = 'player collapsed';
      $player.innerHTML = `<span class="icon">♪</span><span class="name">sound</span>`;
      return;
    }
    $player.className = 'player' + (state.playing ? ' playing' : '');
    const playIcon = state.playing ? '⏸' : '▶';
    $player.innerHTML = `
      <span class="icon" data-act="play">${playIcon}</span>
      <span class="arr" data-act="prev">‹</span>
      <span class="name" data-act="play">${currentDef().label}</span>
      <span class="arr" data-act="next">›</span>
      <span class="vol-ctrl">${VOL_STEPS.map(v => `<span class="vol-step" data-v="${v}" style="opacity:${state.vol >= v - 0.001 ? 1 : 0.3}">|</span>`).join('')}${volSvg(state.vol)}</span>
      <span class="close" data-act="close">×</span>
    `;
  }

  $player.addEventListener('click', (e) => {
    if (!state.open) {
      state.open = true; render(); save(); return;
    }
    const target = e.target.closest('[data-act],[data-v]');
    if (!target) return;
    const act = target.dataset.act;
    if (act === 'play') {
      state.playing = !state.playing;
      if (state.playing) play(); else stop();
    } else if (act === 'prev' || act === 'next') {
      const i = SOUNDS.findIndex(s => s.id === state.sound);
      const dir = act === 'next' ? 1 : -1;
      state.sound = SOUNDS[(i + dir + SOUNDS.length) % SOUNDS.length].id;
      if (state.playing) play();
    } else if (act === 'close') {
      state.playing = false; state.open = false; stop();
    } else if (target.dataset.v) {
      state.vol = +target.dataset.v;
    }
    render(); save();
  });

  render();
})();
