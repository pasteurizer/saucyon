/* ui glue: status bar updates, modal, keyboard shortcuts.
   timer.js owns state; this file reads from DOM hooks timer sets (data-phase, data-running, etc.)
   and updates the new status bar fields + handles modal + shortcuts. */
(() => {
  const $modalBg = document.getElementById('modalBg');
  const $modal = document.getElementById('modal');
  const $openSettings = document.getElementById('openSettings');
  const $closeModal = document.getElementById('closeModal');

  const $sbDone = document.getElementById('sbDone');
  const $sbTotal = document.getElementById('sbTotal');
  const $sbEst = document.getElementById('sbEst');
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
      $sbDone.textContent = m[1];
      $sbTotal.textContent = m[2];
      $sbEst.textContent = m[3];
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

  // --- steppers (replace number inputs) ---
  function isRunning() { return document.body.dataset.running === '1'; }
  function refreshSteppers() {
    const locked = isRunning();
    document.querySelectorAll('.stepper').forEach(st => {
      const inp = document.getElementById(st.dataset.target);
      st.querySelector('.val').textContent = inp.value || '—';
      st.classList.toggle('locked', locked);
      st.querySelectorAll('button[data-d]').forEach(b => b.disabled = locked);
    });
    // also lock preset segment + reset button while running
    document.querySelectorAll('#segPreset button').forEach(b => b.disabled = locked);
  }
  document.querySelectorAll('.stepper').forEach(st => {
    const inp = document.getElementById(st.dataset.target);
    const min = +st.dataset.min, max = +st.dataset.max;
    st.querySelectorAll('button[data-d]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isRunning()) return;
        const cur = +inp.value || min;
        const next = Math.max(min, Math.min(+inp.max || max, cur + (+btn.dataset.d)));
        inp.value = next;
        inp.dispatchEvent(new Event('change'));
        // refresh after timer.js writes back (sync), then re-show
        setTimeout(() => { refreshSteppers(); refreshSegs(); }, 0);
      });
    });
  });
  // resync continuously so preset switches and timer state changes show up
  setInterval(() => { refreshSteppers(); if ($modalBg.classList.contains('show')) refreshSegs(); }, 300);

  // visible reset button in status bar
  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('btnReset').click();
  });

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // ignore typing in inputs
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      if (e.key === 'Escape') { document.activeElement.blur(); closeModal(); }
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
