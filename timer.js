// Countdown timer modal. Uses an absolute end time, so it stays accurate if the phone sleeps or the tab is throttled.
// Survives reloads (stored in localStorage). Alarm = beeps + vibration + notification (if allowed).
(function () {
  const TKEY = 'ht-timer', MAXMIN = 600, CIRC = 2 * Math.PI * 90, TITLE = document.title;
  let T = load(), actx = null, alarmId = null, lock = null;

  function load() { try { return JSON.parse(localStorage.getItem(TKEY)); } catch (e) { return null; } }
  function persist() { try { T ? localStorage.setItem(TKEY, JSON.stringify(T)) : localStorage.removeItem(TKEY); } catch (e) {} }
  const habit = () => T && state.habits.find(h => h.id === T.id);
  const left = () => T.state === 'running' ? Math.max(0, Math.ceil((T.endAt - Date.now()) / 1000)) : T.left;
  const fmtT = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' : '') + pad(m) + ':' + pad(s % 60); };
  const dlg = () => $('#timerDlg');

  function defaultMin(h) {
    const rem = target(h) - countOn(h, keyOf(new Date()));
    let m = h.unit === 'minutes' && target(h) > 1 ? (rem > 0 ? rem : h.step || 10)
          : h.unit === 'hours' && target(h) > 1 ? Math.round((rem > 0 ? rem : 1) * 60)
          : h.timerMin || 10;
    return Math.min(MAXMIN, Math.max(1, Math.round(m)));
  }

  // ----- audio / alarm -----
  function ensureAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
  function beep() {
    if (actx) [0, 0.28, 0.56].forEach(o => {
      const osc = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + o;
      osc.type = 'sine'; osc.frequency.value = 880; osc.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.start(t); osc.stop(t + 0.25);
    });
    if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 500]);
  }
  function stopAlarm() { clearInterval(alarmId); alarmId = null; if (navigator.vibrate) navigator.vibrate(0); }
  function alarm() {
    stopAlarm(); beep(); let n = 0;
    alarmId = setInterval(() => { if (++n >= 15) stopAlarm(); else beep(); }, 2000); // repeats for ~30s or until you tap
    const h = habit();
    if ('Notification' in window && Notification.permission === 'granted' && h) notify("⏱ Time's up!", `${h.name}: ${Math.round(T.total / 60)} min finished`, 'timer');
  }

  // ----- screen wake lock (keeps the screen on while counting) -----
  async function lockScreen() {
    try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) {}
  }
  function unlock() { try { if (lock) lock.release(); } catch (e) {} lock = null; }

  // ----- rendering -----
  function renderTime() {
    if (!T) return;
    const l = left();
    $('#tTime').textContent = fmtT(l);
    $('#tArc').style.strokeDashoffset = String(CIRC * (1 - (T.total ? l / T.total : 0)));
  }
  function render() {
    const h = habit(); if (!T || !h) return;
    $('#tTitle').textContent = `⏱ ${h.emoji || ''} ${h.name}`.replace('  ', ' ');
    $('#tArc').classList.toggle('done', T.state === 'done');
    $('#tSet').hidden = T.state !== 'idle';
    $('#tMsg').textContent = { idle: 'Pick a duration, then press Start.', running: "You've got this. Stay with it.", paused: 'Paused', done: "⏰ Time's up! Nice work." }[T.state];
    const min = Math.round(T.total / 60);
    const logLabel = h.unit === 'minutes' ? `Log ${min} min` : h.unit === 'hours' ? `Log ${fmt(min / 60)} hr` : 'Mark habit done';
    $('#tBtns').innerHTML = {
      idle: '<button class="primary" data-t="start">▶ Start</button>',
      running: '<button data-t="pause">⏸ Pause</button><button class="danger" data-t="cancel">Cancel</button>',
      paused: '<button class="primary" data-t="resume">▶ Resume</button><button class="danger" data-t="cancel">Cancel</button>',
      done: `<button class="primary" data-t="log">${logLabel}</button><button data-t="restart">Restart</button>`
    }[T.state];
    renderTime();
    updatePill();
  }
  function updatePill() {
    const p = $('#timerPill'), h = habit();
    const show = T && h && T.state !== 'idle' && !dlg().open;
    p.hidden = !show;
    if (show) p.textContent = T.state === 'done' ? `⏰ ${h.name} — time's up, tap` : `⏱ ${h.name} · ${fmtT(left())}${T.state === 'paused' ? ' (paused)' : ''}`;
  }

  // ----- actions -----
  function openDialog() { if (!dlg().open) dlg().showModal(); }
  function setMinutes(m) {
    m = Math.min(MAXMIN, Math.max(1, Math.round(m) || 10));
    T.total = T.left = m * 60; persist(); $('#tMin').value = m; renderTime();
    document.querySelectorAll('#tChips button').forEach(b => b.classList.toggle('on', +b.dataset.m === m));
  }
  window.openTimer = function (h) {
    if (T && T.id !== h.id && T.state !== 'idle' && !confirm('A timer for another habit is in progress. Replace it?')) return;
    if (!T || T.id !== h.id) { const m = defaultMin(h); T = { id: h.id, state: 'idle', total: m * 60, left: m * 60 }; persist(); }
    $('#tMin').value = Math.round(T.total / 60);
    render(); setMinutes(Math.round(T.total / 60)); openDialog();
  };
  function start() {
    ensureAudio();
    const h = habit(), m = Math.min(MAXMIN, Math.max(1, Math.round(parseFloat($('#tMin').value)) || 10));
    T.total = T.left = m * 60; T.endAt = Date.now() + T.left * 1000; T.state = 'running';
    h.timerMin = m; save(); persist(); lockScreen(); render();
  }
  function pause() { T.left = left(); T.endAt = null; T.state = 'paused'; unlock(); persist(); render(); }
  function resume() { ensureAudio(); T.endAt = Date.now() + T.left * 1000; T.state = 'running'; lockScreen(); persist(); render(); }
  function cancel() { stopAlarm(); unlock(); T = null; persist(); document.title = TITLE; if (dlg().open) dlg().close(); updatePill(); }
  function finish(quiet) {
    T.state = 'done'; T.left = 0; T.endAt = null; persist(); unlock(); document.title = TITLE;
    openDialog(); render();
    if (!quiet) alarm();
  }
  function logIt() {
    const h = habit(), min = Math.round(T.total / 60), c = countOn(h, keyOf(new Date()));
    if (h.unit === 'minutes' && target(h) > 1) setCount(h, c + min);
    else if (h.unit === 'hours' && target(h) > 1) setCount(h, c + min / 60);
    else setCount(h, target(h));
    cancel();
  }

  // ----- wiring -----
  $('#tBtns').onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b || !T) return;
    stopAlarm(); const a = b.dataset.t;
    if (a === 'start') start(); else if (a === 'pause') pause(); else if (a === 'resume') resume();
    else if (a === 'cancel') cancel(); else if (a === 'log') logIt();
    else if (a === 'restart') { T.state = 'idle'; T.left = T.total; persist(); render(); }
  };
  $('#tMin').oninput = () => { if (T && T.state === 'idle') setMinutes(parseFloat($('#tMin').value)); };
  $('#tChips').innerHTML = [5, 10, 15, 20, 30, 45, 60].map(m => `<button type="button" data-m="${m}">${m}</button>`).join('');
  $('#tChips').onclick = e => { const b = e.target.closest('button'); if (b && T && T.state === 'idle') setMinutes(+b.dataset.m); };
  $('#tClose').onclick = () => { stopAlarm(); dlg().close(); };
  dlg().addEventListener('close', () => { stopAlarm(); updatePill(); });
  $('#timerPill').onclick = () => { render(); openDialog(); };

  function tick() {
    if (T && !habit()) { T = null; persist(); }
    if (!T) return updatePill();
    if (T.state === 'running') {
      if (left() <= 0) return finish(false);
      document.title = `${fmtT(left())} · ${TITLE}`;
    }
    if (dlg().open) renderTime();
    updatePill();
  }
  setInterval(tick, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (T && T.state === 'running') lockScreen(); tick(); } });

  // restore after a reload / app reopen
  if (T && habit()) {
    if (T.state === 'running' && T.endAt <= Date.now()) finish(true); // finished while the app was closed
    else { if (T.state === 'running') lockScreen(); updatePill(); }
  } else if (T) { T = null; persist(); }
  window.__timer = { get state() { return T; }, tick };
})();
