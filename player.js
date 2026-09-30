/* ambient sound player — seamless mp3 loops played gaplessly, persisted state.
   v0.3 */
(() => {
  // files are pre-made seamless loops (end crossfaded into start). rate = the file's sample
  // rate: decoding at it avoids upsampling, which roughly halves the memory a long loop needs.
  const SOUNDS = [
    { id: 'rain',        label: 'rain',        src: 'sounds/rain.mp3',      rate: 44100 },
    { id: 'storm',       label: 'storm',       src: 'sounds/storm.mp3',     rate: 44100 },
    { id: 'fireplace',   label: 'fireplace',   src: 'sounds/fireplace.mp3', rate: 44100 },
  ];
  const LS = 'focusTimer.player';

  const state = (() => {
    const def = { open: false, playing: false, sound: 'rain', vol: 0.6 };
    // playback never survives a reload (browsers block autoplay), so don't restore "playing"
    try { return Object.assign(def, JSON.parse(localStorage.getItem(LS) || '{}'), { playing: false }); }
    catch { return def; }
  })();
  const save = () => localStorage.setItem(LS, JSON.stringify(state));

  function currentDef() { return SOUNDS.find(s => s.id === state.sound) || SOUNDS[0]; }

  // ---------- engine ----------
  // web audio: the whole loop is decoded and repeated sample-accurately (an <audio loop>
  // leaves a small gap at every repeat). one AudioContext per playing sound, closed on
  // stop/switch so its decoded audio is freed. soft fades on start/stop/switch.
  const AC = window.AudioContext || window.webkitAudioContext;
  const FADE = 0.12; // time constant (s) — ~0.4s to settle
  let eng = null;    // { ctx, out } for the sound currently playing

  // mp3 files can decode with a few ms of encoder padding at either end; loop only the real audio
  function loopBounds(buf) {
    const ch = buf.getChannelData(0), max = Math.min(ch.length >> 1, buf.sampleRate * 0.2);
    let a = 0, b = ch.length;
    while (a < max && Math.abs(ch[a]) < 1e-4) a++;
    while (b > ch.length - max && Math.abs(ch[b - 1]) < 1e-4) b--;
    return [a / buf.sampleRate, b / buf.sampleRate];
  }

  // fallback when fetch/decoding isn't possible (e.g. page opened from file://): plain looping element
  const fallback = new Audio();
  fallback.loop = true;

  function play() {
    stop();
    const def = currentDef();
    if (!AC) return playFallback(def);
    let ctx;
    try { ctx = new AC({ sampleRate: def.rate }); }
    catch { try { ctx = new AC(); } catch { return playFallback(def); } }
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);
    const e = eng = { ctx, out };
    fetch(def.src)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(data => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
      .then(buf => {
        if (eng !== e) return; // stopped or switched while loading
        const [a, b] = loopBounds(buf);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = a;
        src.loopEnd = b;
        src.connect(out);
        src.start(0, a);
        out.gain.setTargetAtTime(state.vol, ctx.currentTime, FADE);
      })
      .catch(() => {
        if (eng !== e) return;
        eng = null;
        ctx.close();
        playFallback(def);
      });
  }
  function playFallback(def) {
    if (!fallback.src.endsWith(def.src)) fallback.src = def.src;
    fallback.volume = state.vol;
    fallback.play().catch(() => { state.playing = false; render(); save(); });
  }
  function stop() {
    fallback.pause();
    fallback.currentTime = 0;
    if (!eng) return;
    const { ctx, out } = eng;
    eng = null;
    out.gain.setTargetAtTime(0, ctx.currentTime, FADE);
    setTimeout(() => ctx.close(), FADE * 6 * 1000);
  }
  function setVolume() {
    fallback.volume = state.vol;
    if (eng) eng.out.gain.setTargetAtTime(state.vol, eng.ctx.currentTime, 0.03);
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
      const next = SOUNDS[(i + dir + SOUNDS.length) % SOUNDS.length].id;
      if (next !== state.sound) {   // with a single sound, don't restart it
        state.sound = next;
        if (state.playing) play();
      }
    } else if (act === 'close') {
      state.playing = false; state.open = false; stop();
    } else if (target.dataset.v) {
      state.vol = +target.dataset.v;
      setVolume();
    }
    render(); save();
  });

  render();
})();
