/* ambient sound player — uses real mp3 loops, persisted state.
   v0.2 */
(() => {
  const SOUNDS = [
    { id: 'rain',        label: 'rain',        src: 'sounds/rain.mp3' },
    { id: 'train-long',  label: 'train 6m',    src: 'sounds/train-long.mp3' },
    { id: 'train-short', label: 'train 1m',    src: 'sounds/train-short.mp3', endAt: 60 },
  ];
  const LS = 'focusTimer.player';

  const state = (() => {
    const def = { open: false, playing: false, sound: 'rain', vol: 0.6 };
    // playback never survives a reload (browsers block autoplay), so don't restore "playing"
    try { return Object.assign(def, JSON.parse(localStorage.getItem(LS) || '{}'), { playing: false }); }
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

  // 5 volume levels; rendered as rising bars
  const VOL_STEPS = [0.2, 0.4, 0.6, 0.8, 1.0];
  const BAR_H = [6, 8, 10, 12, 14]; // px

  // ---------- UI ----------
  const $player = document.getElementById('player');

  // inline svg icons — stroke-based, currentColor, consistent weight
  const IC = {
    note:  '<svg class="p-ic" viewBox="0 0 14 14" width="12" height="12"><path d="M5 11V3.2l6-1.2v7.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3.4" cy="11" r="1.7" fill="currentColor"/><circle cx="9.4" cy="9.5" r="1.7" fill="currentColor"/></svg>',
    play:  '<svg class="p-ic" viewBox="0 0 14 14" width="11" height="11"><path d="M4 2.5v9l7.5-4.5z" fill="currentColor"/></svg>',
    pause: '<svg class="p-ic" viewBox="0 0 14 14" width="11" height="11"><rect x="3.2" y="2.5" width="2.6" height="9" rx="1" fill="currentColor"/><rect x="8.2" y="2.5" width="2.6" height="9" rx="1" fill="currentColor"/></svg>',
    prev:  '<svg class="p-ic" viewBox="0 0 14 14" width="11" height="11"><path d="M9 3 5 7l4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next:  '<svg class="p-ic" viewBox="0 0 14 14" width="11" height="11"><path d="m5 3 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg class="p-ic" viewBox="0 0 14 14" width="10" height="10"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };

  function render() {
    audio.volume = state.vol;
    if (!state.open) {
      $player.className = 'player collapsed';
      $player.innerHTML = `<span class="icon">${IC.note}</span><span class="name">sound</span>`;
      return;
    }
    $player.className = 'player' + (state.playing ? ' playing' : '');
    const bars = VOL_STEPS.map((v, i) =>
      `<span class="p-hit" data-v="${v}" title="volume ${(i + 1)}/5"><i class="p-bar${state.vol >= v - 0.001 ? ' on' : ''}" style="height:${BAR_H[i]}px"></i></span>`
    ).join('');
    $player.innerHTML = `
      <button type="button" class="p-btn" data-act="play" title="${state.playing ? 'pause' : 'play'}">${state.playing ? IC.pause : IC.play}</button>
      <button type="button" class="p-btn" data-act="prev" title="previous sound">${IC.prev}</button>
      <span class="p-name" data-act="play" title="${state.playing ? 'pause' : 'play'}">${currentDef().label}</span>
      <button type="button" class="p-btn" data-act="next" title="next sound">${IC.next}</button>
      <span class="p-vol">${bars}</span>
      <button type="button" class="p-btn" data-act="close" title="close player">${IC.close}</button>
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
