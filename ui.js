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
  function openModal() { $modalBg.classList.add('show'); refreshSegs(); refreshSteppers(); }
  function closeModal() { $modalBg.classList.remove('show'); }
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

  // --- steppers: hold-to-repeat + direct keyboard input ---
  function isRunning() { return document.body.dataset.running === '1'; }

  function refreshSteppers() {
    const locked = isRunning();
    document.querySelectorAll('.stepper').forEach(st => {
      const inp = document.getElementById(st.dataset.target);
      const display = st.querySelector('.val');
      // Show the real input for keyboard editing, hide display span
      // We keep both in sync
      display.textContent = inp.value || '—';
      st.classList.toggle('locked', locked);
      st.querySelectorAll('button[data-d]').forEach(b => b.disabled = locked);
      // Make the display value editable directly
      if (!st.dataset.editBound) {
        st.dataset.editBound = '1';
        display.setAttribute('contenteditable', 'true');
        display.setAttribute('spellcheck', 'false');
        display.setAttribute('inputmode', 'numeric');

        display.addEventListener('focus', () => {
          // Select all text on focus
          const range = document.createRange();
          range.selectNodeContents(display);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        });

        display.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); display.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); display.textContent = inp.value; display.blur(); }
          // Only allow digits and control keys
          if (!/^\d$/.test(e.key) && !['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) {
            e.preventDefault();
          }
        });

        display.addEventListener('blur', () => {
          if (isRunning()) { display.textContent = inp.value; return; }
          const raw = parseInt(display.textContent, 10);
          const min = +st.dataset.min;
          const max = +st.dataset.max;
          if (!isNaN(raw)) {
            inp.value = Math.max(min, Math.min(max, raw));
            inp.dispatchEvent(new Event('change'));
          }
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

  function stepValue(st, delta) {
    if (isRunning()) return;
    const inp = document.getElementById(st.dataset.target);
    const min = +st.dataset.min;
    const max = +st.dataset.max;
    const cur = +inp.value || min;
    const next = Math.max(min, Math.min(+inp.max || max, cur + delta));
    inp.value = next;
    inp.dispatchEvent(new Event('change'));
    setTimeout(() => { refreshSteppers(); refreshSegs(); }, 0);
  }

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

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // ignore typing in inputs or contenteditable steppers
    const ae = document.activeElement;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(ae?.tagName) || ae?.isContentEditable) {
      if (e.key === 'Escape') { ae.blur(); closeModal(); }
      return;
    }
    if (e.key === ' ') { e.preventDefault(); document.getElementById('btnStart').click(); }
    else if (e.key === 'n' || e.key === 'ArrowRight') document.getElementById('btnSkip').click();
    else if (e.key === 'b' || e.key === 'ArrowLeft') document.getElementById('btnBack').click();
    else if (e.key === 'r') document.getElementById('btnReset').click();
    else if (e.key === ',') openModal();
    else if (e.key === 'Escape') closeModal();
  });
})();
