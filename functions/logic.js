// Pure scheduling logic (no Firebase deps) so it can be unit-tested.
const QUOTES = require('./quotes');
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WINDOW = 10; // minutes after the scheduled time that we still send (tolerates a delayed run)

function localParts(tz, now) {
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }); }
  catch (e) { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }); }
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  const hour = +p.hour % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, hour, minute: +p.minute, dow: DOW.indexOf(p.weekday) };
}
const mins = hm => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// data: the synced users/{uid}/habitTracker/data doc; device: {tz, sentDay, sent}
function plan(data, device, now) {
  const p = localParts(device.tz || 'UTC', now);
  const sent = device.sentDay === p.date ? (device.sent || []) : [];
  const nowMin = p.hour * 60 + p.minute, out = [];
  const add = (key, title, body, tag) => { if (!sent.includes(key)) out.push({ key, title, body, tag }); };

  (data.habits || []).forEach(h => {
    if (!h.time || !(h.days || []).includes(p.dow)) return;
    const diff = nowMin - mins(h.time);
    if (diff < 0 || diff >= WINDOW) return;
    const done = ((data.log || {})[p.date] || {})[h.id] || 0;
    if (done >= Math.max(1, h.target || 1)) return;
    add('h' + h.id, `${h.emoji || ''} ${h.name}`.trim(), (h.target || 1) > 1 ? `Goal: ${h.target}. Let's go!` : 'Time to check it off!', h.id);
  });

  const q = data.quote || {}, mode = q.mode || 'daily';
  const pick = s => { const [t, a] = QUOTES[hash(s) % QUOTES.length]; return `${t} — ${a}`; };
  if (mode === 'hourly' && p.minute < 5) add('qh' + p.hour, 'Motivation', pick(p.date + p.hour), 'quote');
  if ((mode === 'daily' || mode === 'minute') && q.time) {
    const diff = nowMin - mins(q.time);
    if (diff >= 0 && diff < WINDOW) add('qd', 'Motivation', pick(p.date), 'quote');
  }
  return { out, sentDay: p.date, sent: sent.concat(out.map(o => o.key)) };
}
module.exports = { plan, localParts };
