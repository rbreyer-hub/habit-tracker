// Google sign-in + Firestore sync. Local-first: the app works signed out; signing in syncs across devices.
(function () {
  if (typeof firebase === 'undefined') { $('#acctBtn').disabled = true; return; }
  const auth = firebase.auth(), db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  let user = null, unsub = null, timer = null, applying = false;
  const ref = () => db.collection('users').doc(user.uid).collection('habitTracker').doc('data');

  function status(t) {
    $('#syncStatus').textContent = t;
    $('#acctText').textContent = user ? (user.email || user.displayName || 'Signed in') : 'Not signed in';
    $('#acctBtn').textContent = user ? 'Sign out' : 'Sign in with Google';
  }
  const snapshotData = () => JSON.parse(JSON.stringify({
    habits: state.habits, log: state.log,
    quote: { mode: state.settings.quoteMode, time: state.settings.quoteTime, v: 2 }, updated: Date.now()
  }));

  // first sign-in on this device: union habits, max the daily counts
  function merge(cloud) {
    const norm = h => (h.name || '').trim().toLowerCase();
    const byId = {}, byName = {}, remap = {};
    (cloud.habits || []).forEach(h => { byId[h.id] = h; byName[norm(h)] = h.id; });
    // a local habit with the same name as a cloud one is the same habit: don't duplicate it
    state.habits.forEach(h => {
      if (byId[h.id]) return;
      if (byName[norm(h)]) remap[h.id] = byName[norm(h)]; else byId[h.id] = h;
    });
    const log = JSON.parse(JSON.stringify(cloud.log || {}));
    Object.entries(state.log).forEach(([day, m]) => {
      log[day] = log[day] || {};
      Object.entries(m).forEach(([id, n]) => { const t = remap[id] || id; log[day][t] = Math.max(log[day][t] || 0, n); });
    });
    return { habits: Object.values(byId), log, quote: cloud.quote };
  }
  function apply(d) {
    applying = true;
    state.habits = d.habits || []; state.log = d.log || {};
    if (d.quote && (d.quote.v >= 2 || !state.settings.quoteMinuteMigrated)) { state.settings.quoteMode = d.quote.mode; state.settings.quoteTime = d.quote.time; }
    save(); applying = false; render();
  }
  function pushNow() {
    if (!user || state.mergedFor !== user.uid) return;
    status('Syncing…');
    ref().set(snapshotData()).then(() => status('☁️ Synced'), () => status('⚠️ Sync failed (will retry)'));
  }
  window.cloudPush = function () {
    if (!user || applying) return;
    clearTimeout(timer); timer = setTimeout(pushNow, 800);
  };

  window.cloudUser = () => user;
  auth.onAuthStateChanged(u => {
    user = u; document.dispatchEvent(new CustomEvent('cloudauth', { detail: u })); if (unsub) { unsub(); unsub = null; }
    if (!u) return status('');
    status('Syncing…');
    unsub = ref().onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return;
      const cloud = snap.exists ? snap.data() : null;
      if (state.mergedFor !== u.uid) {
        if (cloud) apply(merge(cloud));
        state.mergedFor = u.uid; save(); pushNow();
      } else if (cloud) { apply(cloud); status('☁️ Synced'); }
      else pushNow();
    }, err => status('⚠️ ' + err.code));
  });

  $('#acctBtn').onclick = async () => {
    if (user) { if (window.pushDisable) await window.pushDisable(); return auth.signOut().then(() => status('')); }
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')
        auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
      else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') alert('Sign-in failed: ' + e.message);
    }
  };
})();
