const $ = s => document.querySelector(s);
const KEY = 'habit-tracker-v1';
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const QUOTES = [
  ["We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "Will Durant"],
  ["Small daily improvements are the key to staggering long-term results.", "Robin Sharma"],
  ["Discipline is choosing between what you want now and what you want most.", "Abraham Lincoln"],
  ["It does not matter how slowly you go as long as you do not stop.", "Confucius"],
  ["The secret of getting ahead is getting started.", "Mark Twain"],
  ["Motivation gets you going, but discipline keeps you growing.", "John C. Maxwell"],
  ["You don't have to be great to start, but you have to start to be great.", "Zig Ziglar"],
  ["Success is the sum of small efforts repeated day in and day out.", "Robert Collier"],
  ["Don't count the days, make the days count.", "Muhammad Ali"],
  ["The only bad workout is the one that didn't happen.", "Unknown"],
  ["Your future is created by what you do today, not tomorrow.", "Robert Kiyosaki"],
  ["Action is the foundational key to all success.", "Pablo Picasso"],
  ["A journey of a thousand miles begins with a single step.", "Lao Tzu"],
  ["Strength does not come from winning. Your struggles develop your strengths.", "Arnold Schwarzenegger"],
  ["The pain you feel today will be the strength you feel tomorrow.", "Unknown"],
  ["Do something today that your future self will thank you for.", "Unknown"],
  ["Habits are the compound interest of self-improvement.", "James Clear"],
  ["You do not rise to the level of your goals. You fall to the level of your systems.", "James Clear"],
  ["Energy and persistence conquer all things.", "Benjamin Franklin"],
  ["Well done is better than well said.", "Benjamin Franklin"],
  ["What you do every day matters more than what you do once in a while.", "Gretchen Rubin"],
  ["Fall seven times, stand up eight.", "Japanese proverb"],
  ["The best time to plant a tree was 20 years ago. The second best time is now.", "Chinese proverb"],
  ["Push yourself, because no one else is going to do it for you.", "Unknown"],
  ["Make each day your masterpiece.", "John Wooden"],
  ["Consistency is what transforms average into excellence.", "Unknown"],
  ["Done is better than perfect.", "Sheryl Sandberg"],
  ["Tough times never last, but tough people do.", "Robert H. Schuller"],
  ["The body achieves what the mind believes.", "Napoleon Hill"],
  ["One percent better every day.", "Unknown"],
  ["Quit doing the same things and expecting different results. Change starts with you.", "Unknown"],
  ["Perseverance is not a long race; it is many short races one after the other.", "Walter Elliot"],
  ["Don't wish it were easier. Wish you were better.", "Jim Rohn"],
  ["Hard work beats talent when talent doesn't work hard.", "Tim Notke"],
  ["Someone is sitting in the shade today because someone planted a tree long ago.", "Warren Buffett"],
  ["Start where you are. Use what you have. Do what you can.", "Arthur Ashe"],
  ["Winners are not people who never fail, but people who never quit.", "Unknown"],
  ["Every rep counts. Every day counts.", "Unknown"],
  ["Be stronger than your excuses.", "Unknown"],
  ["Progress, not perfection.", "Unknown"]
];

const uid = () => Math.random().toString(36).slice(2, 10);
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pad = n => String(n).padStart(2, '0');

function defaults() {
  return {
    habits: [],
    log: {}, fired: {}, firedDay: '',
    settings: { quoteMode: 'minute', quoteTime: '08:00', notify: false, quoteMinuteMigrated: true }
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.habits) {
      const st = Object.assign(defaults().settings, s.settings);
      if (!(s.settings && s.settings.quoteMinuteMigrated)) { if (st.quoteMode !== 'off') st.quoteMode = 'minute'; st.quoteMinuteMigrated = true; }
      return Object.assign(defaults(), s, { settings: st });
    }
  } catch (e) {}
  return defaults();
}
let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} if (window.cloudPush) window.cloudPush(); };

let view = 'today', weekOffset = 0, monthOffset = 0, histHabit = 'all', startCache = {};
let renderedDay = keyOf(new Date());
let quoteShift = 0;
let editingId = null;

const target = h => Math.max(1, h.target || 1);
const UNITS = {
  reps:    { label: 'Reps / times', abbr: 'reps',   presets: [5, 10, 20, 25] },
  minutes: { label: 'Minutes',      abbr: 'min',    presets: [5, 10, 15, 30] },
  hours:   { label: 'Hours',        abbr: 'hr',     presets: [0.5, 1, 2] },
  pages:   { label: 'Pages',        abbr: 'pages',  presets: [1, 5, 10, 20] },
  glasses: { label: 'Glasses',      abbr: 'glasses', presets: [1, 2, 4] },
  miles:   { label: 'Miles',        abbr: 'mi',     presets: [0.5, 1, 2, 5] },
  km:      { label: 'Kilometers',   abbr: 'km',     presets: [0.5, 1, 2, 5] },
  steps:   { label: 'Steps',        abbr: 'steps',  presets: [500, 1000, 2500, 5000] },
  custom:  { label: 'Custom…',      abbr: '',       presets: [1, 5, 10, 25] }
};
const fmt = n => +(+n).toFixed(2);
const unitOf = h => h.unit === 'custom' ? (h.customUnit || '') : h.unit ? (UNITS[h.unit] ? UNITS[h.unit].abbr : h.unit) : '';
const countOn = (h, key) => (state.log[key] && state.log[key][h.id]) || 0;
const isDone = (h, key) => countOn(h, key) >= target(h);
const scheduled = (h, d) => h.days.includes(d.getDay());

const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const goalLabel = g => g.months === 12 ? '1-year' : `${g.months}-month`;
function goalInfo(h) {
  const g = h.goal; if (!g) return null;
  const start = parseKey(g.start), end = new Date(start); end.setMonth(end.getMonth() + g.months);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let required = 0, done = 0;
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) if (scheduled(h, d)) required++;
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) if (scheduled(h, d) && isDone(h, keyOf(d))) done++;
  return { done, required: Math.max(1, required), end, left: Math.max(0, Math.ceil((end - today) / 864e5)) };
}
function setCount(h, n, key = keyOf(new Date())) {
  if (n > 0 && key < habitStart(h)) h.created = key; // backdating before the habit's start moves its start earlier
  state.log[key] = state.log[key] || {};
  state.log[key][h.id] = Math.max(0, Math.min(target(h), Math.round(n * 100) / 100));
  const gi = goalInfo(h);
  const justWon = gi && !h.goal.completedOn && gi.done >= gi.required;
  if (justWon) h.goal.completedOn = key;
  save(); render();
  if (justWon) setTimeout(() => alert(`🏆 ${goalLabel(h.goal)} challenge complete!\n"${h.name}" — ${gi.done} days done. Amazing work!`), 50);
}

function streak(h) {
  let s = 0;
  const d = new Date();
  for (let i = 0; i < 400; i++, d.setDate(d.getDate() - 1)) {
    if (!scheduled(h, d)) continue;
    if (isDone(h, keyOf(d))) s++;
    else if (i > 0) break; // today not done yet doesn't break the streak
  }
  return s;
}

function weekDots(h) {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(`<span class="${isDone(h, keyOf(d)) ? 'on' : ''} ${i === 0 ? 'today' : ''}" title="${keyOf(d)}"></span>`);
  }
  return out.join('');
}

function habitHTML(h, active) {
  const key = keyOf(new Date()), c = countOn(h, key), t = target(h), done = isDone(h, key), st = streak(h);
  const meta = [t > 1 ? `${fmt(c)}/${fmt(t)} ${unitOf(h)}`.trim() : '', h.time ? '⏰ ' + h.time : '', st ? `🔥 ${st}` : ''].filter(Boolean).join(' · ');
  return `<div class="habit ${done ? 'done' : ''}" data-id="${h.id}">
    <div class="row">
      <button class="check" data-act="toggle" aria-label="Toggle done">${done ? '✓' : h.emoji || ''}</button>
      <button class="info" data-act="edit"><div class="name">${esc(h.name)}</div><div class="meta">${meta || 'Tap ✓ when done'}</div></button>
    </div>
    ${t > 1 ? `<div class="bar"><i style="width:${Math.min(100, c / t * 100)}%"></i></div>` : ''}
    ${goalHTML(h)}
    <div class="tools">
      ${active && t > 1 ? `<button data-act="add">+${fmt(h.step || 10)} ${unitOf(h)}</button><button data-act="sub">−${fmt(h.step || 10)}</button>` : ''}
      <div class="dots">${weekDots(h)}</div>
    </div>
  </div>`;
}
function goalHTML(h) {
  const gi = goalInfo(h); if (!gi) return '';
  if (h.goal.completedOn) return `<div class="goal won"><span>🏆 ${goalLabel(h.goal)} challenge complete!</span><button data-act="newgoal">Start new</button></div>`;
  const pct = Math.min(100, gi.done / gi.required * 100);
  return `<div class="goal"><span>🎯 ${goalLabel(h.goal)} challenge: ${gi.done}/${gi.required} days · ${gi.left} days left (ends ${gi.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 'minute' mode: random quote, new one on every page load and every 60s while the app is open
let liveIdx = Math.floor(Math.random() * QUOTES.length), liveAt = Date.now();
function newLiveQuote() {
  let i; do { i = Math.floor(Math.random() * QUOTES.length); } while (i === liveIdx && QUOTES.length > 1);
  liveIdx = i; liveAt = Date.now();
}
function renderQuote() {
  const q = $('#quote');
  q.hidden = state.settings.quoteMode === 'off';
  if (q.hidden) return;
  const [t, a] = currentQuote();
  $('#qText').textContent = `“${t}”`; $('#qAuthor').textContent = '— ' + a;
}
function currentQuote() {
  if (state.settings.quoteMode === 'minute') return QUOTES[liveIdx];
  const now = new Date();
  const base = state.settings.quoteMode === 'hourly'
    ? Math.floor(now.getTime() / 3600000)
    : Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  return QUOTES[(((base * 7 + quoteShift) % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

function render() {
  const now = new Date();
  renderedDay = keyOf(now);
  $('#date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  renderQuote();
  const todays = state.habits.filter(h => scheduled(h, now));
  const others = state.habits.filter(h => !scheduled(h, now));
  const doneN = todays.filter(h => isDone(h, renderedDay)).length;
  $('#progress').textContent = !state.habits.length ? 'No habits yet. Tap + to add your first one.' : todays.length ? `${doneN} of ${todays.length} done today${doneN === todays.length ? ' 🎉' : ''}` : 'Nothing scheduled today. Tap + to add a habit.';
  $('#today').innerHTML = todays.map(h => habitHTML(h, true)).join('');
  $('#later').innerHTML = others.map(h => habitHTML(h, false)).join('');
  $('#laterH').hidden = !others.length;
  startCache = {};
  if (view === 'week') renderWeek();
  if (view === 'hist') renderHistory();
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const h = state.habits.find(x => x.id === btn.closest('.habit').dataset.id);
  const c = countOn(h, keyOf(new Date()));
  const act = btn.dataset.act;
  if (act === 'toggle') setCount(h, isDone(h, keyOf(new Date())) ? 0 : target(h));
  else if (act === 'add') setCount(h, c + (h.step || 10));
  else if (act === 'sub') setCount(h, c - (h.step || 10));
  else if (act === 'edit') openHabit(h);
  else if (act === 'newgoal') { h.goal = { months: h.goal.months, start: keyOf(new Date()) }; save(); render(); }
});
$('#qNext').onclick = () => { if (state.settings.quoteMode === 'minute') newLiveQuote(); else quoteShift++; renderQuote(); };

// ---------- weekly summary ----------
function habitStart(h) {
  if (h.created) return h.created;
  if (startCache[h.id]) return startCache[h.id];
  const ks = Object.keys(state.log).filter(k => state.log[k][h.id]).sort();
  return (startCache[h.id] = ks.length ? ks[0] : keyOf(new Date()));
}
function weekStats(off) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - start.getDay() + off * 7);
  const days = [...Array(7)].map((_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const dayTot = days.map(() => ({ s: 0, d: 0 }));
  const rows = state.habits.map(h => {
    const hs = habitStart(h);
    let s = 0, dn = 0, reps = 0;
    const cells = days.map((d, i) => {
      const k = keyOf(d), c = countOn(h, k), past = d <= today;
      if (!scheduled(h, d) || k < hs) return { cls: 'na', t: '·' };
      if (!past) return { cls: 'fut', t: '' };
      s++; dayTot[i].s++; reps += c;
      if (isDone(h, k)) { dn++; dayTot[i].d++; return { cls: 'ok', t: '✓' }; }
      if (c > 0) return { cls: 'part', t: c };
      return d.getTime() === today.getTime() ? { cls: 'now', t: '' } : { cls: 'miss', t: '✗' };
    });
    return { h, cells, s, dn, reps };
  }).filter(r => r.s > 0 || r.cells.some(c => c.cls !== 'na'));
  const s = rows.reduce((a, r) => a + r.s, 0), dn = rows.reduce((a, r) => a + r.dn, 0);
  const perfect = dayTot.filter((x, i) => x.s > 0 && x.d === x.s && days[i] <= today).length;
  return { days, rows, s, dn, perfect, pct: s ? Math.round(dn / s * 100) : null, today };
}
function renderWeek() {
  const w = weekStats(weekOffset), prev = weekStats(weekOffset - 1);
  const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const label = weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `${fmt(w.days[0])} – ${fmt(w.days[6])}`;
  let delta = '';
  if (w.pct !== null && prev.pct !== null && weekOffset <= 0) { const dd = w.pct - prev.pct; delta = dd === 0 ? 'Same as the previous week.' : `${dd > 0 ? '▲' : '▼'} ${Math.abs(dd)}% vs the previous week.`; }
  const msg = w.pct === null ? 'Nothing scheduled yet this week.' : w.pct === 100 ? '🎉 Perfect so far — keep it going!' : w.pct >= 70 ? '💪 Strong week. ' + delta : w.pct >= 40 ? 'Solid start — push for more. ' + delta : 'Every check-in counts. Start fresh today. ' + delta;
  const head = '<div></div>' + w.days.map(d => `<div class="dh ${d.getTime() === w.today.getTime() ? 'now' : ''}" ${d <= w.today ? `data-date="${keyOf(d)}"` : ''}>${DAYS[d.getDay()]}<br>${d.getDate()}</div>`).join('');
  const body = w.rows.map(r => {
    const pct = r.s ? Math.round(r.dn / r.s * 100) + '%' : '—';
    const reps = target(r.h) > 1 && r.reps ? ` · ${fmt(r.reps)} ${unitOf(r.h)} total`.replace(/ +total/, ' total') : '';
    return `<div class="hn">${esc(r.h.emoji || '')} ${esc(r.h.name)}<small>${r.dn}/${r.s} · ${pct}${reps}</small></div>` +
      r.cells.map((c, i) => `<div class="c ${c.cls}" ${w.days[i] <= w.today ? `data-date="${keyOf(w.days[i])}"` : ''}>${c.t}</div>`).join('');
  }).join('');
  $('#weekView').innerHTML = `
    <div class="wk-nav"><button id="wkPrev" aria-label="Previous week">‹</button><b>${label}<br><small class="date">${fmt(w.days[0])} – ${fmt(w.days[6])}</small></b><button id="wkNext" aria-label="Next week" ${weekOffset >= 0 ? 'disabled' : ''}>›</button></div>
    <div class="stats">
      <div class="stat"><strong>${w.pct === null ? '—' : w.pct + '%'}</strong><span>completion</span></div>
      <div class="stat"><strong>${w.dn}/${w.s}</strong><span>check-ins</span></div>
      <div class="stat"><strong>${w.perfect}</strong><span>perfect days</span></div>
    </div>
    <p class="wk-msg">${msg}</p>
    ${w.rows.length ? `<div class="wk">${head}${body}</div><p class="hint">Tap a day to edit it.</p>` : ''}`;
  $('#wkPrev').onclick = () => { weekOffset--; renderWeek(); };
  $('#wkNext').onclick = () => { if (weekOffset < 0) { weekOffset++; renderWeek(); } };
}
// ---------- streak calendar / history ----------
function dayStatus(h, d, today) {
  const k = keyOf(d), hs = h ? [h] : state.habits;
  let s = 0, dn = 0, part = false;
  hs.forEach(x => {
    if (!scheduled(x, d) || k < habitStart(x)) return;
    s++; if (isDone(x, k)) dn++; else if (countOn(x, k) > 0) part = true;
  });
  if (!s) return 'na';
  if (d > today) return 'fut';
  if (dn === s) return 'ok';
  const some = dn > 0 || part;
  return d.getTime() === today.getTime() ? (some ? 'part' : 'now') : (some ? 'part' : 'miss');
}
function streakStats(h) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const hs = h ? [h] : state.habits;
  if (!hs.length) return { cur: 0, best: 0, ok: 0, rate: null };
  let cur = 0, best = 0, ok = 0, tot = 0;
  for (const d = parseKey(hs.map(habitStart).sort()[0]); d <= today; d.setDate(d.getDate() + 1)) {
    const st = dayStatus(h, d, today);
    if (st === 'na') continue;
    if (st === 'ok') { cur++; ok++; tot++; best = Math.max(best, cur); }
    else if (d.getTime() !== today.getTime()) { cur = 0; tot++; } // today still pending: doesn't break the streak
  }
  return { cur, best, ok, rate: tot ? Math.round(ok / tot * 100) : null };
}
function renderHistory() {
  if (histHabit !== 'all' && !state.habits.find(x => x.id === histHabit)) histHabit = 'all';
  const h = histHabit === 'all' ? null : state.habits.find(x => x.id === histHabit);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const m = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const st = streakStats(h);
  let cells = '';
  for (let i = 0; i < m.getDay(); i++) cells += '<div></div>';
  for (let n = 1; n <= dim; n++) {
    const d = new Date(m.getFullYear(), m.getMonth(), n);
    cells += `<div class="d ${dayStatus(h, d, today)} ${d.getTime() === today.getTime() ? 'today' : ''}" title="${keyOf(d)}" ${d <= today ? `data-date="${keyOf(d)}"` : ''}>${n}</div>`;
  }
  $('#histView').innerHTML = `
    <select id="histSel" class="hist-sel"><option value="all">All habits</option>${state.habits.map(x => `<option value="${x.id}" ${x.id === histHabit ? 'selected' : ''}>${esc(x.emoji || '')} ${esc(x.name)}</option>`).join('')}</select>
    <div class="stats4">
      <div class="stat"><strong>🔥 ${st.cur}</strong><span>current streak</span></div>
      <div class="stat"><strong>🏅 ${st.best}</strong><span>best streak</span></div>
      <div class="stat"><strong>${st.ok}</strong><span>days done</span></div>
      <div class="stat"><strong>${st.rate === null ? '—' : st.rate + '%'}</strong><span>success rate</span></div>
    </div>
    <div class="wk-nav"><button id="mPrev" aria-label="Previous month">‹</button><b>${m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button id="mNext" aria-label="Next month" ${monthOffset >= 0 ? 'disabled' : ''}>›</button></div>
    <div class="cal"><div class="grid">${DAYS.map(x => `<div class="dh">${x}</div>`).join('')}${cells}</div>
      <p class="hint" style="margin:0 0 10px">Tap a day to edit it.</p><div class="legend"><span><i style="background:var(--ok)"></i>Done</span><span><i style="background:var(--warn)"></i>Partial</span><span><i style="background:rgba(239,68,68,.35)"></i>Missed</span></div></div>`;
  $('#histSel').onchange = e => { histHabit = e.target.value; renderHistory(); };
  $('#mPrev').onclick = () => { monthOffset--; renderHistory(); };
  $('#mNext').onclick = () => { if (monthOffset < 0) { monthOffset++; renderHistory(); } };
}
function setView(v) {
  view = v; weekOffset = 0; monthOffset = 0;
  [['today', '#tabToday', '#todayView'], ['week', '#tabWeek', '#weekView'], ['hist', '#tabHist', '#histView']].forEach(([n, t, p]) => {
    $(t).classList.toggle('on', v === n); $(p).hidden = v !== n;
  });
  $('#addBtn').hidden = v !== 'today';
  render();
}
$('#tabToday').onclick = () => setView('today');
$('#tabWeek').onclick = () => setView('week');
$('#tabHist').onclick = () => setView('hist');

// ---------- day editor (backdating) ----------
let dayKey = null;
function renderDay() {
  const d = parseKey(dayKey);
  $('#dayTitle').textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const hs = state.habits.filter(h => scheduled(h, d));
  $('#dayList').innerHTML = hs.length ? hs.map(h => {
    const c = countOn(h, dayKey), t = target(h), done = isDone(h, dayKey);
    return `<div class="habit ${done ? 'done' : ''}" data-id="${h.id}"><div class="row">
      <button class="check" data-dact="toggle" aria-label="Toggle done">${done ? '✓' : esc(h.emoji || '')}</button>
      <div class="info"><div class="name">${esc(h.name)}</div><div class="meta">${t > 1 ? `${fmt(c)}/${fmt(t)} ${unitOf(h)}`.trim() : done ? 'Done' : 'Not done'}</div></div></div>
      ${t > 1 ? `<div class="bar"><i style="width:${Math.min(100, c / t * 100)}%"></i></div><div class="tools"><button data-dact="add">+${fmt(h.step || 10)} ${unitOf(h)}</button><button data-dact="sub">−${fmt(h.step || 10)}</button></div>` : ''}
    </div>`;
  }).join('') : '<p class="note">No habits were scheduled on this day.</p>';
}
function openDay(key) {
  if (key > keyOf(new Date())) return; // can't log the future
  dayKey = key; renderDay(); $('#dayDlg').showModal();
}
$('#dayList').addEventListener('click', e => {
  const b = e.target.closest('[data-dact]'); if (!b) return;
  const h = state.habits.find(x => x.id === b.closest('.habit').dataset.id), c = countOn(h, dayKey);
  const a = b.dataset.dact;
  if (a === 'toggle') setCount(h, isDone(h, dayKey) ? 0 : target(h), dayKey);
  else if (a === 'add') setCount(h, c + (h.step || 10), dayKey);
  else if (a === 'sub') setCount(h, c - (h.step || 10), dayKey);
  renderDay();
});
$('#dayClose').onclick = () => $('#dayDlg').close();
$('#yBtn').onclick = () => { const d = new Date(); d.setDate(d.getDate() - 1); openDay(keyOf(d)); };
['#weekView', '#histView'].forEach(sel => $(sel).addEventListener('click', e => {
  const c = e.target.closest('[data-date]'); if (c) openDay(c.dataset.date);
}));

// ---------- habit dialog ----------
$('#fDays').innerHTML = DAYS.map((d, i) => `<label><input type="checkbox" value="${i}"><span>${d}</span></label>`).join('');
function openHabit(h) {
  editingId = h ? h.id : null;
  $('#dlgTitle').textContent = h ? 'Edit habit' : 'New habit';
  $('#fName').value = h ? h.name : '';
  $('#fEmoji').value = h ? h.emoji : '✅';
  $('#fTime').value = h ? h.time : '';
  $('#fTarget').value = h ? target(h) : 1;
  $('#fStep').value = h ? fmt(h.step || 10) : 10;
  $('#fUnit').value = h && h.unit ? h.unit : 'reps';
  $('#fCustomUnit').value = h && h.customUnit || '';
  unitUI(false);
  $('#fGoal').value = h && h.goal ? h.goal.months : 0;
  document.querySelectorAll('#fDays input').forEach(i => i.checked = h ? h.days.includes(+i.value) : true);
  $('#fDelete').hidden = !h;
  $('#habitDlg').showModal();
}
$('#fUnit').innerHTML = Object.entries(UNITS).map(([k, u]) => `<option value="${k}">${u.label}</option>`).join('');
function unitUI(setDefault) {
  const u = $('#fUnit').value, ps = UNITS[u].presets;
  $('#fCustomUnit').hidden = u !== 'custom';
  if (setDefault) $('#fStep').value = ps[Math.min(1, ps.length - 1)];
  const cur = parseFloat($('#fStep').value);
  $('#fChips').innerHTML = ps.map(p => `<button type="button" data-p="${p}" class="${p === cur ? 'on' : ''}">${p}${UNITS[u].abbr ? ' ' + UNITS[u].abbr : ''}</button>`).join('');
}
$('#fUnit').onchange = () => unitUI(true);
$('#fStep').oninput = () => unitUI(false);
$('#fChips').onclick = e => { const b = e.target.closest('button'); if (b) { $('#fStep').value = b.dataset.p; unitUI(false); } };
$('#addBtn').onclick = () => openHabit(null);
$('#fCancel').onclick = () => $('#habitDlg').close();
$('#fDelete').onclick = () => {
  if (!confirm('Delete this habit and its history?')) return;
  state.habits = state.habits.filter(h => h.id !== editingId);
  save(); render(); $('#habitDlg').close();
};
$('#habitForm').onsubmit = () => {
  const days = [...document.querySelectorAll('#fDays input:checked')].map(i => +i.value);
  const unitVal = $('#fUnit').value;
  const data = {
    unit: unitVal, customUnit: unitVal === 'custom' ? $('#fCustomUnit').value.trim() : '',
    name: $('#fName').value.trim(), emoji: $('#fEmoji').value.trim(), time: $('#fTime').value,
    target: Math.max(1, parseFloat($('#fTarget').value) || 1), step: Math.max(0.1, parseFloat($('#fStep').value) || 10),
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6]
  };
  if (!data.name) return;
  const months = +$('#fGoal').value, old = editingId && state.habits.find(h => h.id === editingId).goal;
  data.goal = !months ? null : (old && old.months === months ? old : { months, start: keyOf(new Date()) });
  if (editingId) Object.assign(state.habits.find(h => h.id === editingId), data);
  else state.habits.push({ id: uid(), ...data, created: keyOf(new Date()) });
  save(); render();
};

// ---------- settings ----------
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function notifReason() {
  if (!window.isSecureContext) return 'Notifications need a secure (https) page.';
  if (!('Notification' in window))
    return isIOS && !isStandalone()
      ? 'On iPhone/iPad, notifications only work from the Home Screen app (iOS 16.4+). Tap Share → Add to Home Screen, then open Habit Tracker from the new icon and enable them there.'
      : /FBAN|FBAV|Instagram|Line\/|GSA\/|; wv\)|Snapchat|Twitter|LinkedInApp|Slack/i.test(navigator.userAgent)
        ? "You're in an app's built-in browser, which can't do notifications. Open this page in Chrome (Android) or Safari instead."
        : "This browser doesn't support notifications. Try Chrome, Edge or Firefox (on iPhone, add the site to your Home Screen first).";
  if (Notification.permission === 'denied')
    return 'Blocked. ' + (isStandalone() ? 'Open your phone Settings → Notifications → Habit Tracker and allow them.' : 'Tap the lock/ⓘ icon next to the address bar → Site settings → Notifications → Allow, then come back.');
  if (Notification.permission === 'default') return 'The permission prompt was dismissed or hidden. Tap the button again and choose Allow.';
  return '';
}
function notifNote() {
  const on = state.settings.notify && 'Notification' in window && Notification.permission === 'granted';
  $('#sEnable').textContent = on ? 'Notifications on ✓ (tap to turn off)' : 'Enable notifications';
  $('#notifNote').textContent = on ? 'Habit reminders and quote notifications are on for this device.' : notifReason();
}
const askPermission = () => new Promise(res => {
  try { const p = Notification.requestPermission(res); if (p && p.then) p.then(res); } catch (e) { res(Notification.permission); }
});
$('#sEnable').onclick = async () => {
  if (state.settings.notify) { state.settings.notify = false; save(); return notifNote(); }
  if (!('Notification' in window) || !window.isSecureContext) return notifNote();
  if (Notification.permission === 'default') await askPermission();
  state.settings.notify = Notification.permission === 'granted';
  save(); notifNote();
  if (state.settings.notify) notify('Habit Tracker', 'Notifications are on 🎉', 'test');
};
$('#settingsBtn').onclick = () => {
  $('#sMode').value = state.settings.quoteMode;
  $('#sQTime').value = state.settings.quoteTime;
  notifNote();
  if (window.pushNote) window.pushNote();
  $('#setDlg').showModal();
};
$('#sClose').onclick = () => {
  state.settings.quoteMode = $('#sMode').value;
  state.settings.quoteTime = $('#sQTime').value || '08:00';
  save(); render(); $('#setDlg').close();
};
$('#sTest').onclick = async () => {
  if (!('Notification' in window)) return notifNote();
  if (Notification.permission === 'default') await askPermission();
  if (Notification.permission !== 'granted') return notifNote();
  state.settings.notify = true; save(); notifNote();
  notify('Habit Tracker', 'Notifications are working 🎉', 'test');
};

// ---------- notifications ----------
async function notify(title, body, tag) {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) return reg.showNotification(title, { body, tag, icon: 'icon.svg', badge: 'icon.svg' });
    new Notification(title, { body, tag, icon: 'icon.svg' });
  } catch (e) {}
}
function tick() {
  const now = new Date(), today = keyOf(now);
  if (today !== renderedDay) render(); // midnight: every habit restarts
  if (state.settings.push) return; // the server sends reminders; avoid duplicates
  if (!state.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (state.firedDay !== today) { state.fired = {}; state.firedDay = today; }
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const fire = (k, fn) => { if (!state.fired[k]) { state.fired[k] = 1; save(); fn(); } };
  state.habits.forEach(h => {
    if (h.time && scheduled(h, now) && hm >= h.time && !isDone(h, today) && now - new Date(`${today}T${h.time}`) < 3600000)
      fire('h' + h.id, () => notify(`${h.emoji || ''} ${h.name}`.trim(), target(h) > 1 ? `Goal: ${fmt(target(h))}${unitOf(h) ? ' ' + unitOf(h) : ''}. Let's go!` : "Time to check it off!", h.id));
  });
  const m = state.settings.quoteMode;
  if (m === 'hourly' && now.getMinutes() < 5) fire('qh' + now.getHours(), () => { const [t, a] = currentQuote(); notify('Motivation', `${t} — ${a}`, 'quote'); });
  if ((m === 'daily' || m === 'minute') && hm >= state.settings.quoteTime && now - new Date(`${today}T${state.settings.quoteTime}`) < 3600000)
    fire('qd', () => { const [t, a] = currentQuote(); notify('Motivation', `${t} — ${a}`, 'quote'); });
}
setInterval(tick, 20000);
setInterval(() => { if (state.settings.quoteMode === 'minute' && !document.hidden) { newLiveQuote(); renderQuote(); } }, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (state.settings.quoteMode === 'minute' && Date.now() - liveAt >= 60000) newLiveQuote();
  tick(); render();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
render(); tick();
