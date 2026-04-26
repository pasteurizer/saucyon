/* ambient sound player — uses real mp3 loops, persisted state. */
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
    // truncate train-short to first minute via timeupdate
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

  // ---------- UI ----------
  const $player = document.getElementById('player');

  function render() {
    audio.volume = state.vol;
    if (!state.open) {
      $player.className = 'player collapsed';
      $player.innerHTML = `<span class="icon"></span><span class="name">sound</span>`;
      return;
    }
    $player.className = 'player' + (state.playing ? ' playing' : '');
    const playIcon = state.playing ? '' : '';
    const bars = [0.2, 0.4, 0.6, 0.8, 1.0]
      .map(v => `<span class="b ${state.vol >= v - 0.001 ? 'on' : ''}" data-v="${v}"></span>`).join('');
    $player.innerHTML = `
      <span class="icon" data-act="play">${playIcon}</span>
      <span class="arr" data-act="prev">‹</span>
      <span class="name" data-act="play">${currentDef().label}</span>
      <span class="arr" data-act="next">›</span>
      <span class="vol">${bars}</span>
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
