// Web push via Firebase Cloud Messaging. The server (functions/index.js) reads your synced habits and
// sends reminders to every registered device, even when the app is closed. Requires Google sign-in.
(function () {
  let messaging = null;
  try { if (typeof firebase !== 'undefined' && firebase.messaging.isSupported()) messaging = firebase.messaging(); } catch (e) {}
  const devId = (() => { try { let d = localStorage.getItem('ht-device'); if (!d) { d = uid(); localStorage.setItem('ht-device', d); } return d; } catch (e) { return uid(); } })();
  const user = () => (window.cloudUser ? window.cloudUser() : null);
  const devRef = u => firebase.firestore().collection('users').doc(u.uid).collection('habitTrackerDevices').doc(devId);

  function note(t) {
    const on = !!state.settings.push;
    $('#sPush').textContent = on ? 'Push reminders on ✓ (tap to turn off)' : 'Enable push reminders';
    $('#pushNote').textContent = t || (on ? 'Reminders are sent by the server, even when the app is closed.' : 'Sends reminders even when the app is closed. Requires Google sign-in.');
  }
  window.pushNote = note;

  async function register() {
    const reg = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({ serviceWorkerRegistration: reg });
    if (!token) throw new Error('No push token returned');
    await devRef(user()).set({ token, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, updated: Date.now(), ua: navigator.userAgent.slice(0, 120) }, { merge: true });
  }
  window.pushDisable = async function () {
    const u = user();
    try { if (u) await devRef(u).delete(); if (messaging) await messaging.deleteToken(); } catch (e) {}
    state.settings.push = false; save(); note();
  };

  $('#sPush').onclick = async () => {
    if (state.settings.push) return window.pushDisable();
    if (!user()) return note('Sign in with Google first (Account & sync, above) so reminders can be sent to your account.');
    if (!messaging || !('serviceWorker' in navigator)) return note(notifReason() || "Push isn't supported in this browser.");
    if (!('Notification' in window)) return note(notifReason());
    if (Notification.permission === 'default') await askPermission();
    if (Notification.permission !== 'granted') return note(notifReason());
    try {
      note('Setting up…');
      await register();
      state.settings.push = true; save(); note();
      notify('Habit Tracker', 'Push reminders are on 🎉', 'test');
    } catch (e) { note('Could not enable push: ' + (e.code || e.message)); }
  };

  if (messaging) messaging.onMessage(p => { const d = p.data || {}; notify(d.title || 'Habit Tracker', d.body || '', d.tag); }); // app is open
  // keep the token fresh whenever we're signed in
  document.addEventListener('cloudauth', e => {
    if (e.detail && state.settings.push && messaging && Notification.permission === 'granted') register().catch(() => {});
  });
})();
