const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { plan } = require('./logic');

admin.initializeApp();
const db = admin.firestore();
const DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

// Runs every minute: sends habit reminders + quotes as data-only web pushes (the service worker shows them).
exports.habitReminders = onSchedule({ schedule: 'every 1 minutes', timeZone: 'UTC', region: 'us-central1' }, async () => {
  const now = new Date();
  const devices = await db.collectionGroup('habitTrackerDevices').get();
  const byUser = {};
  devices.forEach(d => { const uid = d.ref.parent.parent.id; (byUser[uid] = byUser[uid] || []).push(d); });

  for (const [uid, docs] of Object.entries(byUser)) {
    const snap = await db.doc(`users/${uid}/habitTracker/data`).get();
    if (!snap.exists) continue;
    const data = snap.data();
    for (const d of docs) {
      const dev = d.data();
      if (!dev.token) continue;
      const r = plan(data, dev, now);
      if (!r.out.length) continue;
      const res = await admin.messaging().sendEach(r.out.map(m => ({
        token: dev.token,
        data: { title: m.title, body: m.body, tag: m.tag },
        webpush: { headers: { Urgency: 'high', TTL: '3600' } }
      })));
      if (res.responses.some(x => x.error && DEAD.includes(x.error.code))) { await d.ref.delete(); continue; }
      if (res.successCount) await d.ref.update({ sentDay: r.sentDay, sent: r.sent });
    }
  }
});
