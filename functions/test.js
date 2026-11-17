const { plan } = require('./logic');
const assert = require('assert');
const data = {
  habits: [{ id: 'p', name: '50 Pushups', emoji: '💪', days: [0,1,2,3,4,5,6], time: '09:00', target: 50 },
           { id: 'r', name: 'Read', emoji: '', days: [1], time: '20:00', target: 1 }],
  log: {}, quote: { mode: 'daily', time: '08:00' }
};
// 2026-11-16 is a Monday. 09:00 in New York = 14:00 UTC.
const at = (iso, dev = { tz: 'America/New_York' }, d = data) => plan(d, dev, new Date(iso));
let r = at('2026-11-16T14:00:30Z');
assert.deepStrictEqual(r.out.map(o => o.key), ['hp']); assert.strictEqual(r.out[0].body, "Goal: 50. Let's go!");
r = at('2026-11-16T14:05:00Z'); assert.strictEqual(r.out.length, 1, 'late but within window');
assert.strictEqual(at('2026-11-16T14:15:00Z').out.length, 0, 'outside window');
assert.strictEqual(at('2026-11-16T14:00:30Z', { tz: 'America/New_York', sentDay: '2026-11-16', sent: ['hp'] }).out.length, 0, 'deduped');
assert.strictEqual(at('2026-11-16T14:00:30Z', { tz: 'America/New_York', sentDay: '2026-11-15', sent: ['hp'] }).out.length, 1, 'new day resets dedupe');
assert.strictEqual(at('2026-11-16T14:00:30Z', undefined, { ...data, log: { '2026-11-16': { p: 50 } } }).out.length, 0, 'done => no reminder');
assert.deepStrictEqual(at('2026-11-17T01:00:00Z').out.map(o => o.key), ['hr'], 'Mon 8pm NY = Tue 01:00 UTC; Monday-only habit');
assert.deepStrictEqual(at('2026-11-16T13:00:00Z').out.map(o => o.key), ['qd'], 'daily quote 8:00 NY');
assert.strictEqual(at('2026-11-16T14:00:00Z', { tz: 'UTC' }).out.length, 0, 'UTC device at 14:00: not its 9:00');
assert.deepStrictEqual(at('2026-11-16T09:00:00Z', { tz: 'UTC' }).out.map(o => o.key), ['hp'], 'UTC device at 09:00');
assert.deepStrictEqual(at('2026-11-16T10:02:00Z', { tz: 'UTC' }, { ...data, quote: { mode: 'hourly' } }).out.map(o => o.key), ['qh10'], 'hourly quote');
console.log('all logic tests passed');
const d2 = { ...data, habits: [{ id: 'm', name: 'Meditate', emoji: '🧘', days: [1], time: '09:00', target: 30, unit: 'minutes' }] };
assert.strictEqual(plan(d2, { tz: 'America/New_York' }, new Date('2026-11-16T14:00:00Z')).out[0].body, "Goal: 30 min. Let's go!");
console.log('unit message ok');
