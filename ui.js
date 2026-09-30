/* ui glue: status bar updates, modal, keyboard shortcuts.
   timer.js owns state; this file reads from DOM hooks timer sets (data-phase, data-running, etc.)
   and updates the new status bar fields + handles modal + shortcuts.
   v0.1 */
(() => {
  const $modalBg = document.getElementById('modalBg');
  const $modal = document.getElementById('modal');
  const $openSettings = document.getElementById('openSettings');
  const $closeModal = document.getElementById('closeModal');

  const $sbDone = document.getElementById('sbDone');
  const $sbTotal = document.getElementById('sbTotal');
  const $sbEst = document.getElementById('sbEst');
  const $sbLongIn = document.getElementById('sbLongIn');
  const $sbLongHint = document.getElementById('sbLongHint');
  const $sbLongSep = document.getElementById('sbLongSep');
  const $sbF = document.getElementById('sbF');
  const $sbS = document.getElementById('sbS');
  const $sbL = document.getElementById('sbL');
  const $sbAuto = document.getElementById('sbAuto');
  const $autoToggle = document.getElementById('autoToggle');
  const $cfgAuto = document.getElementById('cfgAuto');
  const $meta = document.getElementById('meta');

  // observe meta string from timer.js: "X / Y focus complete · est. finish: HH:MM"
  function syncStatusFromMeta() {
    const txt = $meta.textContent || '';
    const m = txt.match(/^(\d+)\s*\/\s*(\d+).*?est\.\s*finish:\s*(\S+)/i);
    if (m) {
      // Show current pomodoro: completed + 1 (unless finished)
      const done = parseInt(m[1], 10);
      const total = parseInt(m[2], 10);
      const finished = document.body.dataset.finished === '1';
      const phase = document.body.dataset.phase;
      // current = done + 1 during focus, done during break (break belongs to just-finished focus)
      let current;
      if (finished) {
        current = total;
      } else if (phase === 'focus') {
        current = done + 1;
      } else {
        current = done;
      }
      $sbDone.textContent = current;
      $sbTotal.textContent = total;
      $sbEst.textContent = m[3];

      // long-break countdown: "long in N" where N = longAfter - completedFocus
      // Hide when finished, when long break already passed, or during the long break itself
      const longAfter = parseInt(document.getElementById('cfgAfter').value, 10);
      const remaining = longAfter - done;
      const showLongHint = !finished && remaining > 0 && longAfter > 0 && longAfter < total;
      if (showLongHint) {
        $sbLongIn.textContent = remaining;
        $sbLongHint.classList.remove('hidden');
        $sbLongSep.classList.remove('hidden');
      } else {
        $sbLongHint.classList.add('hidden');
        $sbLongSep.classList.add('hidden');
      }
    }
    // durations
    const f = document.getElementById('cfgFocus').value;
    const s = document.getElementById('cfgShort').value;
    const l = document.getElementById('cfgLong').value;
    if (f) $sbF.textContent = f;
    if (s) $sbS.textContent = s;
    if (l) $sbL.textContent = l;
    $sbAuto.textContent = $cfgAuto.checked ? 'on' : 'off';
    syncProgress(f, s, l);
  }

  // phase progress hairline (visual only — derived from #time + durations)
  const $sbProgress = document.getElementById('sbProgress');
  function syncProgress(f, s, l) {
    if (!$sbProgress) return;
    if (document.body.dataset.finished === '1') { $sbProgress.style.width = '0%'; return; }
    const t = document.getElementById('time').textContent.match(/^(\d+):(\d+)$/);
    if (!t) { $sbProgress.style.width = '0%'; return; }
    const remaining = (+t[1]) * 60 + (+t[2]);
    const phase = document.body.dataset.phase;
    const durMin = phase === 'focus' ? +f : phase === 'short' ? +s : +l;
    const dur = durMin * 60;
    if (!dur || remaining > dur) { $sbProgress.style.width = '0%'; return; }
    $sbProgress.style.width = ((1 - remaining / dur) * 100).toFixed(2) + '%';
  }

  // poll cheap & reliable; timer renders frequently
  setInterval(syncStatusFromMeta, 250);
  syncStatusFromMeta();

  // auto toggle from status bar
  $autoToggle.addEventListener('click', () => {
    $cfgAuto.checked = !$cfgAuto.checked;
    $cfgAuto.dispatchEvent(new Event('change'));
    syncStatusFromMeta();
  });

  // settings modal
  // closing plays a short fade-out (.closing) before hiding; the duration matches styles.css
  let closeTimer = null;
  function isModalOpen() { return $modalBg.classList.contains('show') && !$modalBg.classList.contains('closing'); }
  function openModal() {
    clearTimeout(closeTimer);
    $modalBg.classList.remove('closing');
    $modalBg.classList.add('show');
    refreshSegs(); refreshSteppers();
  }
  function closeModal() {
    if (!isModalOpen()) return;
    $modalBg.classList.add('closing');
    closeTimer = setTimeout(() => $modalBg.classList.remove('show', 'closing'), 180);
  }
  $openSettings.addEventListener('click', openModal);
  $closeModal.addEventListener('click', closeModal);
  $modalBg.addEventListener('click', (e) => { if (e.target === $modalBg) closeModal(); });

  // --- segmented selectors (preset + alarm) ---
  function refreshSegs() {
    const pres = document.querySelector('input[name=preset]:checked')?.value || 'focus';
    document.querySelectorAll('#segPreset button').forEach(b => b.classList.toggle('active', b.dataset.val === pres));
    const alarm = document.getElementById('cfgAlarm').value;
    document.querySelectorAll('#segAlarm button').forEach(b => b.classList.toggle('active', b.dataset.val === alarm));
  }
  document.querySelectorAll('#segPreset button').forEach(b => {
    b.addEventListener('click', () => {
      const r = document.querySelector(`input[name=preset][value="${b.dataset.val}"]`);
      r.checked = true; r.dispatchEvent(new Event('change'));
      refreshSegs(); refreshSteppers();
    });
  });
  document.querySelectorAll('#segAlarm button').forEach(b => {
    b.addEventListener('click', () => {
      const sel = document.getElementById('cfgAlarm');
      sel.value = b.dataset.val; sel.dispatchEvent(new Event('change'));
      refreshSegs();
    });
  });

  // --- appearance: theme + font ---
  // each theme has a default font; picking a theme resets the font to it, and the font
  // can then be overridden independently. the <head> script applies this before first paint.
  const APPEARANCE_KEY = 'focusTimer.appearance';
  const THEMES = {
    'rose-pine':  { font: 'jetbrains', meta: '#232136' },
    'koda-light': { font: 'iosevka',   meta: '#faf9f5' },
  };
  const FONTS = ['jetbrains', 'iosevka'];
  const $root = document.documentElement;
  const appearance = { theme: $root.dataset.theme, font: $root.dataset.font };

  function applyAppearance() {
    $root.dataset.theme = appearance.theme;
    $root.dataset.font = appearance.font;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[appearance.theme].meta);
    document.querySelectorAll('#segTheme button').forEach(b => b.classList.toggle('active', b.dataset.val === appearance.theme));
    document.querySelectorAll('#segFont button').forEach(b => b.classList.toggle('active', b.dataset.val === appearance.font));
    try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); } catch {}
  }
  document.querySelectorAll('#segTheme button').forEach(b => {
    b.addEventListener('click', () => {
      appearance.theme = b.dataset.val;
      appearance.font = THEMES[appearance.theme].font;
      applyAppearance();
    });
  });
  document.querySelectorAll('#segFont button').forEach(b => {
    b.addEventListener('click', () => {
      if (!FONTS.includes(b.dataset.val)) return;
      appearance.font = b.dataset.val;
      applyAppearance();
    });
  });
  applyAppearance();

  // --- steppers: hold-to-repeat + direct keyboard input ---
  function isRunning() { return document.body.dataset.running === '1'; }

  function refreshSteppers() {
    const locked = isRunning();
    document.querySelectorAll('.stepper').forEach(st => {
      const inp = document.getElementById(st.dataset.target);
      const display = st.querySelector('.val');
      // mirror the hidden input into the display span, except while the user is typing in it
      // (this runs every 300ms and used to wipe out whatever was being typed)
      if (document.activeElement !== display) display.textContent = inp.value || '—';
      st.classList.toggle('locked', locked);
      st.querySelectorAll('button[data-d]').forEach(b => b.disabled = locked);
      // Make the display value editable directly
      if (!st.dataset.editBound) {
        st.dataset.editBound = '1';
        display.setAttribute('contenteditable', 'true');
        display.setAttribute('spellcheck', 'false');
        display.setAttribute('inputmode', 'numeric');

        // select everything on focus so typing replaces the value; deferred because the
        // click that focused it would otherwise collapse the selection right after
        display.addEventListener('focus', () => setTimeout(() => {
          if (document.activeElement === display) selectAll(display);
        }, 0));

        display.addEventListener('keydown', (e) => {
          // enter commits, escape cancels the edit (and stays in the modal)
          if (e.key === 'Enter') { e.preventDefault(); display.blur(); return; }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); display.textContent = inp.value; display.blur(); return; }
          // up/down arrows step like the −/+ buttons
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            stepValue(st, e.key === 'ArrowUp' ? 1 : -1);
            display.textContent = inp.value;
            selectAll(display);
            return;
          }
          if (e.metaKey || e.ctrlKey) return; // copy / paste / select-all
          if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)) return;
          // digits only, and at most 2 of them (unless replacing a selection)
          const replacing = !window.getSelection().isCollapsed;
          if (!/^\d$/.test(e.key) || (!replacing && display.textContent.length >= 2)) e.preventDefault();
        });

        // pasted text or anything else that slips past keydown: keep only the first 2 digits
        display.addEventListener('input', () => {
          const clean = display.textContent.replace(/\D/g, '').slice(0, 2);
          if (clean !== display.textContent) {
            display.textContent = clean;
            window.getSelection().collapse(display, display.childNodes.length);
          }
        });

        display.addEventListener('blur', () => {
          const raw = parseInt(display.textContent, 10);
          // empty / garbage / running → keep the previous value
          if (!isRunning() && !isNaN(raw)) setValue(st, raw);
          display.textContent = inp.value;
        });
      }
      // Keep locked state in sync with contenteditable
      display.contentEditable = locked ? 'false' : 'true';
    });
    // also lock preset segment + reset button while running
    document.querySelectorAll('#segPreset button').forEach(b => b.disabled = locked);
  }

  // Hold-to-repeat logic
  let holdTimer = null;
  let holdInterval = null;

  function selectAll(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // clamp to the stepper's range (and the input's own max, which timer.js lowers for
  // "long break after"), and only notify timer.js on a real change — every change
  // switches the preset to custom and restarts the current phase's countdown.
  function setValue(st, n) {
    const inp = document.getElementById(st.dataset.target);
    const min = +st.dataset.min;
    const max = Math.min(+st.dataset.max, +inp.max || Infinity);
    const next = Math.max(min, Math.min(max, n));
    if (next === +inp.value) return;
    inp.value = next;
    inp.dispatchEvent(new Event('change'));
    setTimeout(() => { refreshSteppers(); refreshSegs(); }, 0);
  }

  function stepValue(st, delta) {
    if (isRunning()) return;
    const inp = document.getElementById(st.dataset.target);
    setValue(st, (+inp.value || +st.dataset.min) + delta);
  }

  // saved durations from before the 59-minute cap get pulled back into range
  document.querySelectorAll('.stepper').forEach(st => {
    const v = +document.getElementById(st.dataset.target).value;
    if (v > +st.dataset.max) setValue(st, v);
  });

  document.querySelectorAll('.stepper').forEach(st => {
    st.querySelectorAll('button[data-d]').forEach(btn => {
      const delta = +btn.dataset.d;

      btn.addEventListener('click', (e) => {
        // click fires after mouseup; if hold was active, skip to avoid double-step
        if (btn._wasHolding) { btn._wasHolding = false; return; }
        stepValue(st, delta);
      });

      btn.addEventListener('mousedown', () => {
        btn._wasHolding = false;
        // Short delay before hold kicks in
        holdTimer = setTimeout(() => {
          btn._wasHolding = true;
          // Step immediately then repeat
          stepValue(st, delta);
          holdInterval = setInterval(() => stepValue(st, delta), 80);
        }, 400);
      });

      const stopHold = () => {
        clearTimeout(holdTimer);
        clearInterval(holdInterval);
        holdTimer = null;
        holdInterval = null;
      };

      btn.addEventListener('mouseup', stopHold);
      btn.addEventListener('mouseleave', stopHold);
      btn.addEventListener('touchend', stopHold);
      btn.addEventListener('touchcancel', stopHold);
    });
  });

  // resync continuously so preset switches and timer state changes show up
  setInterval(() => { refreshSteppers(); if ($modalBg.classList.contains('show')) refreshSegs(); }, 300);

  // --- Clickable kbd hint buttons ---
  // Each hint has a data-action attribute; we map those to real button clicks
  document.querySelectorAll('.kbd-action').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (action === 'start')    document.getElementById('btnStart').click();
      else if (action === 'next')   document.getElementById('btnSkip').click();
      else if (action === 'back')   document.getElementById('btnBack').click();
      else if (action === 'reset')  document.getElementById('btnReset').click();
      else if (action === 'settings') openModal();
    });
  });

  // confirm before reload/close while the timer is running: timer.js only saves on pause or
  // phase end, so leaving mid-run loses the progress and comes back stopped. paused is already saved.
  window.addEventListener('beforeunload', (e) => {
    if (document.body.dataset.running !== '1' || document.body.dataset.finished === '1') return;
    e.preventDefault();
    e.returnValue = ''; // older chrome/safari need this to show the prompt
  });

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // ignore typing in inputs or contenteditable steppers
    const ae = document.activeElement;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(ae?.tagName) || ae?.isContentEditable) {
      if (e.key === 'Escape' || e.key === ',') { e.preventDefault(); ae.blur(); closeModal(); }
      return;
    }
    // leave browser/OS shortcuts alone (cmd+r would otherwise also trigger reset, ctrl+n next, …)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); document.getElementById('btnStart').click(); }
    else if (e.key === 'n' || e.key === 'ArrowRight') document.getElementById('btnSkip').click();
    else if (e.key === 'b' || e.key === 'ArrowLeft') document.getElementById('btnBack').click();
    else if (e.key === 'r') document.getElementById('btnReset').click();
    else if (e.key === ',') isModalOpen() ? closeModal() : openModal();
    else if (e.key === 'Escape') closeModal();
  });
})();
