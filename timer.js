// FOCUS TIMER — functional engine. LOCKED. Do not modify.
(() => {
  const LS_KEY = 'focusTimer.v2';
  const PRESETS = {
    focus:   { focus: 50, short: 10, long: 30 },
    classic: { focus: 25, short: 5,  long: 30 },
  };

  const defaultState = {
    preset: 'focus',
    focus: 50, short: 10, long: 30,
    total: 4,
    longAfter: 2,
    auto: true,
    notif: false,
    alarm: 'bell',
    phase: 'focus',
    remaining: 50 * 60,
    running: false,
    completedFocus: 0,
    finished: false,
  };

  let s = load();
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed, running: false };
    } catch { return { ...defaultState }; }
  }
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

  function longBreakAfter() {
    if (s.total <= 1) return 0;
    return Math.max(1, Math.min(s.total - 1, s.longAfter || Math.floor(s.total / 2)));
  }

  let tickHandle = null;
  let lastTick = null;

  function start() {
    if (s.running || s.finished) return;
    s.running = true;
    lastTick = Date.now();
    tickHandle = setInterval(tick, 250);
    render();
  }
  function pause() {
    if (!s.running) return;
    s.running = false;
    clearInterval(tickHandle);
    tickHandle = null;
    save();
    render();
  }
  function tick() {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    s.remaining -= dt;
    if (s.remaining <= 0) {
      s.remaining = 0;
      onIntervalEnd();
      return;
    }
    render();
  }
  function onIntervalEnd() {
    pause();
    playAlarm();
    notify();
    if (s.phase === 'focus') s.completedFocus += 1;
    if (s.phase === 'focus' && s.completedFocus >= s.total) {
      s.finished = true; save(); render(); return;
    }
    advancePhase();
    save();
    if (s.auto) start(); else render();
  }

  function advancePhase() {
    if (s.phase === 'focus') {
      s.phase = (s.completedFocus === longBreakAfter()) ? 'long' : 'short';
    } else {
      s.phase = 'focus';
    }
    s.remaining = phaseDuration(s.phase) * 60;
  }

  function rewindPhase() {
    if (s.phase === 'focus') {
      if (s.completedFocus === 0) { s.remaining = s.focus * 60; return; }
      s.phase = (s.completedFocus === longBreakAfter()) ? 'long' : 'short';
    } else {
      s.phase = 'focus';
      if (s.completedFocus > 0) s.completedFocus -= 1;
    }
    s.remaining = phaseDuration(s.phase) * 60;
  }

  function phaseDuration(p) {
    return p === 'focus' ? s.focus : p === 'short' ? s.short : s.long;
  }

  function reset() {
    if (!confirm('reset the entire session?')) return;
    pause();
    s.phase = 'focus';
    s.remaining = s.focus * 60;
    s.completedFocus = 0;
    s.finished = false;
    save(); render();
  }

  let audioCtx = null;
  function playAlarm() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (s.alarm === 'bell') beep([880, 660, 880, 660, 880, 660, 880], 0.35);
      else beep([520, 780, 1040, 780, 520, 780, 1040], 0.35);
    } catch (e) {}
  }
  function beep(freqs, dur) {
    let t = audioCtx.currentTime;
    for (const f of freqs) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur);
      t += dur;
    }
  }
  function notify() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const label = s.phase === 'focus' ? 'focus complete' : (s.phase === 'short' ? 'short break complete' : 'long break complete');
    try { new Notification('focus timer', { body: label, silent: !s.notif }); } catch (e) {}
  }

  const $time = document.getElementById('time');
  const $phase = document.getElementById('phase');
  const $meta = document.getElementById('meta');
  const $btnStart = document.getElementById('btnStart');
  const $btnBack = document.getElementById('btnBack');
  const $btnSkip = document.getElementById('btnSkip');
  const $doneBanner = document.getElementById('doneBanner');

  function fmt(secs) {
    secs = Math.max(0, Math.ceil(secs));
    const m = Math.floor(secs / 60);
    const ss = secs % 60;
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }
  function phaseLabel() {
    return s.phase === 'focus' ? 'focus' : s.phase === 'short' ? 'short break' : 'long break';
  }
  function render() {
    $doneBanner.classList.toggle('show', s.finished);

    if (s.finished) {
      $time.textContent = '00:00';
      $phase.textContent = 'session complete';
      $btnStart.disabled = true; $btnSkip.disabled = true; $btnBack.disabled = true;
    } else {
      $time.textContent = fmt(s.remaining);
      $phase.textContent = phaseLabel();
      $btnStart.disabled = false; $btnSkip.disabled = false;
      $btnStart.textContent = s.running ? 'pause' : 'start';
      $btnBack.disabled = s.completedFocus === 0 && s.phase === 'focus';
    }

    // expose phase + running on body for CSS to hook into
    document.body.dataset.phase = s.phase;
    document.body.dataset.running = s.running ? '1' : '0';
    document.body.dataset.finished = s.finished ? '1' : '0';

    $meta.textContent = `${s.completedFocus} / ${s.total} focus complete · est. finish: ${s.finished ? '—' : estimateFinish()}`;
    document.title = (s.running && !s.finished) ? `${fmt(s.remaining)} · ${phaseLabel()}` : 'saucy';
  }

  function estimateFinish() {
    let secs = s.remaining;
    let phase = s.phase;
    let done = s.completedFocus;
    let safety = 50;
    while (safety-- > 0) {
      if (phase === 'focus') {
        const newDone = done + 1;
        if (newDone >= s.total) break;
        const isLong = (newDone === longBreakAfter());
        secs += (isLong ? s.long : s.short) * 60;
        phase = isLong ? 'long' : 'short';
        done = newDone;
      } else {
        secs += s.focus * 60;
        phase = 'focus';
      }
    }
    const end = new Date(Date.now() + secs * 1000);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const $cfgFocus = document.getElementById('cfgFocus');
  const $cfgShort = document.getElementById('cfgShort');
  const $cfgLong = document.getElementById('cfgLong');
  const $cfgTotal = document.getElementById('cfgTotal');
  const $cfgAfter = document.getElementById('cfgAfter');
  const $cfgAuto = document.getElementById('cfgAuto');
  const $cfgNotif = document.getElementById('cfgNotif');
  const $cfgAlarm = document.getElementById('cfgAlarm');

  function syncSettingsUI() {
    document.querySelector(`input[name=preset][value="${s.preset}"]`).checked = true;
    $cfgFocus.value = s.focus;
    $cfgShort.value = s.short;
    $cfgLong.value = s.long;
    $cfgTotal.value = s.total;
    $cfgAfter.value = s.longAfter;
    $cfgAfter.max = Math.max(1, s.total - 1);
    $cfgAuto.checked = s.auto;
    $cfgNotif.checked = s.notif;
    $cfgAlarm.value = s.alarm;
  }
  function applyPreset(name) {
    s.preset = name;
    if (PRESETS[name]) Object.assign(s, PRESETS[name]);
    if (!s.running && s.phase === 'focus') s.remaining = s.focus * 60;
    save(); syncSettingsUI(); render();
  }
  document.querySelectorAll('input[name=preset]').forEach(r => {
    r.addEventListener('change', e => applyPreset(e.target.value));
  });
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, isFinite(n) ? n : lo)); }
  function onDurChange() {
    s.preset = 'custom';
    s.focus = clamp(+$cfgFocus.value, 1, 180);
    s.short = clamp(+$cfgShort.value, 1, 60);
    s.long  = clamp(+$cfgLong.value, 1, 120);
    s.total = clamp(+$cfgTotal.value, 2, 12);
    s.longAfter = clamp(+$cfgAfter.value, 1, Math.max(1, s.total - 1));
    if (s.completedFocus > s.total) s.completedFocus = s.total;
    if (!s.running) s.remaining = phaseDuration(s.phase) * 60;
    save(); syncSettingsUI(); render();
  }
  [$cfgFocus, $cfgShort, $cfgLong, $cfgTotal, $cfgAfter].forEach(el => el.addEventListener('change', onDurChange));
  $cfgAuto.addEventListener('change', () => { s.auto = $cfgAuto.checked; save(); });
  $cfgNotif.addEventListener('change', () => { s.notif = $cfgNotif.checked; save(); });
  $cfgAlarm.addEventListener('change', () => { s.alarm = $cfgAlarm.value; save(); });

  document.getElementById('btnNotifReq').addEventListener('click', async () => {
    if (typeof Notification === 'undefined') return alert('notifications not supported.');
    const p = await Notification.requestPermission();
    if (p === 'granted') { s.notif = true; $cfgNotif.checked = true; save(); }
  });
  document.getElementById('btnTestAlarm').addEventListener('click', playAlarm);

  $btnStart.addEventListener('click', () => s.running ? pause() : start());
  $btnSkip.addEventListener('click', () => {
    if (s.finished) return;
    const wasRunning = s.running;
    pause();
    if (s.phase === 'focus') s.completedFocus += 1;
    if (s.phase === 'focus' && s.completedFocus >= s.total) {
      s.finished = true; save(); render(); return;
    }
    advancePhase();
    save();
    if (wasRunning) start(); else render();
  });
  $btnBack.addEventListener('click', () => {
    const wasRunning = s.running;
    pause();
    rewindPhase();
    save();
    if (wasRunning) start(); else render();
  });
  document.getElementById('btnReset').addEventListener('click', reset);
  document.getElementById('btnNewDay').addEventListener('click', () => {
    s.finished = false;
    s.phase = 'focus';
    s.remaining = s.focus * 60;
    s.completedFocus = 0;
    save(); render();
  });

  syncSettingsUI();
  if (!s.running && (s.remaining > phaseDuration(s.phase) * 60 || s.remaining <= 0)) {
    s.remaining = phaseDuration(s.phase) * 60;
  }
  render();
})();
