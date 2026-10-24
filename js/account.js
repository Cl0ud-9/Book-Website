/* Accounts: sign in with Google or an email address, choose a name and a mark, and your reading (your place in each
   book, your highlights and notes, your reading time) is kept in your account and comes with you to every device.
   You can also share a reader page. The site works the same without an account: everything is kept on the device
   first, and the account is a copy that follows you.

   Firebase (Google's) holds the accounts: Firebase Authentication for signing in and Cloud Firestore for what is kept.
   Its SDK (js/vendor/firebase.mjs, made by `npm run vendor:firebase`) is loaded only when it is needed: on the account
   and reader pages, or when you are signed in. The rules that keep each account's data its own are in
   firebase/firestore.rules. Accounts are off unless the site is built with a Firebase configuration (FIREBASE_CONFIG,
   see README). */
(() => {
  "use strict";

  const config = window.bookshelfAccounts || null;
  const here = document.currentScript?.src || location.href;
  const version = new URL(here).search.slice(1).replace(/^v=/, "");

  const KEYS = {
    account: "bookshelf:account", // the signed-in reader's profile, so the header can show it before anything loads
    device: "bookshelf:device", // this device's own name for itself, for its reading time
    sync: "bookshelf:sync", // what the account already has: { pulled, notes: { id: updated }, places, published }
    places: "bookshelf:reading",
    stats: "bookshelf:stats",
    others: "bookshelf:stats-others", // reading time on your other devices, added up
    prefs: "bookshelf:reader", // how you like the text: page colour, size, typeface (with "at", when you last chose)
    owner: "bookshelf:owner", // whose account this device's reading was last kept in
  };
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not kept */ } };
  const drop = (key) => { try { localStorage.removeItem(key); } catch { /* none */ } };

  /* ---------- Names, colours and marks ---------- */

  const COLOURS = ["yellow", "orange", "magenta", "cyan", "violet", "periwinkle", "pale-green", "olive"];
  const DARK = new Set(["magenta", "violet", "olive"]);
  const MARKS = ["book", "star", "moon", "sun", "leaf", "feather", "coffee", "cat"];
  const MARK_NAMES = { book: "Book", star: "Star", moon: "Moon", sun: "Sun", leaf: "Leaf", feather: "Feather", coffee: "Coffee", cat: "Cat" };
  // Names anyone can see, kept to letters and numbers and away from a few words, as the site has no moderators.
  // The same rules are checked again by the database (firebase/firestore.rules).
  const RESERVED = new Set(["admin", "administrator", "bookshelf", "thebookshelf", "support", "help", "moderator", "mod", "root",
    "system", "null", "undefined", "anonymous", "official", "staff", "team", "cloud9", "cl0ud9", "me", "you", "account", "reader"]);
  const BLOCKED = /fuck|shit|cunt|nigg|fagg|whore|slut|bitch|nazi|hitler|retard|porn|rapist/i;

  function checkHandle(handle) {
    if (!handle) return "Choose a username.";
    if (handle.length < 3) return "Use at least 3 characters.";
    if (handle.length > 20) return "Use 20 characters or fewer.";
    if (!/^[a-z0-9_]+$/.test(handle)) return "Use small letters, numbers and _ only.";
    if (RESERVED.has(handle) || BLOCKED.test(handle)) return "That username isn’t available. Try another.";
    return "";
  }
  function checkName(name) {
    if (!name) return "Enter the name to show on your reader page.";
    if (name.length > 40) return "Use 40 characters or fewer.";
    if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name)) return "Use letters, spaces, apostrophes, dots and hyphens.";
    if (BLOCKED.test(name)) return "Try a different name.";
    return "";
  }
  // a username suggested from a name or an email address
  const suggest = (text) => (text || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/@.*/, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 16) || "reader";

  function avatar(who, size = "") {
    const span = document.createElement("span");
    span.className = `avatar${size ? ` is--${size}` : ""}`;
    const colour = COLOURS.includes(who?.colour) ? who.colour : "yellow";
    span.style.setProperty("--avatar", `var(--${colour})`);
    span.style.setProperty("--avatar-ink", DARK.has(colour) ? "#fff" : "#000");
    span.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "avatar__mark");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${MARKS.includes(who?.mark) ? who.mark : "book"}`);
    svg.append(use);
    span.append(svg);
    return span;
  }

  /* ---------- Firebase, loaded when needed ---------- */

  let loading = null;
  let fb = null; // the SDK's functions
  let auth = null;
  let db = null;
  let user = null; // Firebase's signed-in user
  let profile = config ? read(KEYS.account, null) : null; // { uid, handle, name, colour, mark, since, public, showLines, email, provider, verified }
  let checked = false; // whether Firebase has said who is signed in, this visit
  const subscribers = new Set();

  function sdk() {
    if (!config) return Promise.reject(new Error("Accounts are off"));
    loading ||= import(new URL(`vendor/firebase.mjs${version ? `?v=${version}` : ""}`, here).href).then(async (m) => {
      fb = m;
      const app = m.initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId });
      auth = m.initializeAuth(app, { persistence: [m.indexedDBLocalPersistence, m.browserLocalPersistence], popupRedirectResolver: m.browserPopupRedirectResolver });
      db = m.getFirestore(app);
      if (config.emulator) {
        // local testing only (README: "Trying accounts locally")
        m.connectAuthEmulator(auth, `http://${config.emulator}:9099`, { disableWarnings: true });
        m.connectFirestoreEmulator(db, config.emulator, 8080);
      }
      await auth.authStateReady();
      m.onAuthStateChanged(auth, (u) => { onUser(u).catch(() => {}); });
      return m;
    });
    return loading;
  }

  // Signing in on a device that already holds reading (read signed out, or kept in another account): it is added to the
  // account only when the reader says so. Their own account's copy, or reading done before making a brand new account,
  // is simply kept.
  let pending = null; // { books, notes, other }: the reading here, waiting for an answer

  const state = () => {
    if (!config) return "off";
    if (!profile && !checked) return loading ? "checking" : "out";
    if (!profile) return "out";
    if (!profile.handle) return "setup";
    if (pending) return "merge";
    return "in";
  };
  async function whoseReading(uid, isNew) {
    const owner = read(KEYS.owner, null);
    if (owner === uid) return null;
    const books = Object.keys(read(KEYS.places, {})).length;
    const notes = (await (await notesStore()).all()).length;
    if ((!books && !notes) || (!owner && isNew)) {
      write(KEYS.owner, uid);
      return null;
    }
    return { books, notes, other: Boolean(owner) };
  }
  // The reader's answer: add this device's reading to the account, or leave it out (this device then takes the account's)
  async function settleReading(keep) {
    if (!pending || !user) return;
    if (!keep) await clearDevice();
    write(KEYS.owner, user.uid);
    pending = null;
    emit();
    await sync("settled");
  }
  function emit() {
    paintChips();
    const now = api.current();
    subscribers.forEach((fn) => { try { fn(now); } catch { /* a closed page */ } });
    window.dispatchEvent(new CustomEvent("bookshelf:account", { detail: now }));
  }
  const keepProfile = (next) => {
    profile = next;
    if (next?.handle) write(KEYS.account, next); else drop(KEYS.account);
  };

  async function onUser(u) {
    user = u;
    if (!u) {
      const was = profile;
      keepProfile(null);
      checked = true;
      if (was) forgetDevice(false);
      emit();
      return;
    }
    const snap = await fb.getDoc(fb.doc(db, "users", u.uid));
    const data = snap.exists() ? snap.data() : null;
    const provider = u.providerData[0]?.providerId === "google.com" ? "google" : "password";
    keepProfile({
      uid: u.uid, email: u.email || "", provider, verified: u.emailVerified || provider === "google",
      handle: data?.handle || "", name: data?.name || "", colour: data?.colour || "", mark: data?.mark || "",
      since: data?.since || Date.now(), public: Boolean(data?.public), showLines: Boolean(data?.showLines),
      suggestion: { name: u.displayName || "", handle: suggest(u.displayName || u.email) },
    });
    pending = await whoseReading(u.uid, !data);
    checked = true;
    emit();
    if (profile.handle && !pending) sync("signed in");
  }

  /* ---------- Signing in and out ---------- */

  const MESSAGES = {
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.",
    "auth/invalid-credential": "That email and password don’t match an account.",
    "auth/wrong-password": "That email and password don’t match an account.",
    "auth/user-not-found": "That email and password don’t match an account.",
    "auth/invalid-login-credentials": "That email and password don’t match an account.",
    "auth/email-already-in-use": "There’s already an account with that email. Sign in instead.",
    "auth/weak-password": "Use at least 8 characters for your password.",
    "auth/invalid-email": "Enter an email address, like reader@example.com.",
    "auth/missing-email": "Enter your email address first.",
    "auth/too-many-requests": "Too many tries. Wait a few minutes, then try again.",
    "auth/network-request-failed": "There’s no connection. Check it, then try again.",
    "auth/account-exists-with-different-credential": "That email already has an account that signs in another way. Use that way.",
    "auth/user-disabled": "This account has been switched off.",
    "auth/requires-recent-login": "For your safety, sign in again first.",
    "auth/operation-not-allowed": "That way of signing in isn’t switched on for this site.",
    "permission-denied": "That wasn’t allowed. Sign in again, then try once more.",
    unavailable: "There’s no connection. Check it, then try again.",
  };
  const quiet = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);
  const explain = (error) => (quiet.has(error?.code) ? "" : MESSAGES[error?.code] || "Something went wrong. Try again in a moment.");

  const google = () => sdk().then(() => fb.signInWithPopup(auth, new fb.GoogleAuthProvider()));
  const signIn = (email, password) => sdk().then(() => fb.signInWithEmailAndPassword(auth, email, password));
  const signUp = (email, password) => sdk().then(async () => {
    const made = await fb.createUserWithEmailAndPassword(auth, email, password);
    fb.sendEmailVerification(made.user).catch(() => {});
    return made;
  });
  const resetPassword = (email) => sdk().then(() => fb.sendPasswordResetEmail(auth, email));
  const verifyAgain = () => sdk().then(() => fb.sendEmailVerification(auth.currentUser));
  // Has the reader since confirmed their email (in another tab)?
  const refresh = () => sdk().then(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    if (profile) { keepProfile({ ...profile, verified: auth.currentUser.emailVerified || profile.provider === "google" }); emit(); }
  });

  // Signing out leaves this device's own copy of your reading here, unless you ask for it to be cleared too
  async function signOutNow(clear = false) {
    if (dirty) await sync("signing out").catch(() => {});
    await sdk();
    await fb.signOut(auth);
    forgetDevice(clear);
  }
  function forgetDevice(clear) {
    drop(KEYS.sync);
    drop(KEYS.others);
    pending = null;
    if (clear) clearDevice();
  }
  // This device's reading, gone (not the account's): places, reading time, notes, and whose they were
  async function clearDevice() {
    [KEYS.places, KEYS.stats, KEYS.others, KEYS.sync, KEYS.owner, "bookshelf:removed"].forEach(drop);
    const store = await notesStore();
    await Promise.all((await store.all()).map((n) => store.forget(n.id)));
  }

  /* ---------- Your profile ---------- */

  const handleFree = (handle) => sdk().then(async () => {
    const snap = await fb.getDoc(fb.doc(db, "handles", handle));
    return !snap.exists() || snap.data().uid === user?.uid;
  });

  async function saveProfile({ handle, name, colour, mark }) {
    await sdk();
    if (!user) throw Object.assign(new Error("signed out"), { code: "auth/requires-recent-login" });
    const problem = checkHandle(handle) || checkName(name);
    if (problem) throw Object.assign(new Error(problem), { code: "invalid", message: problem });
    const old = profile?.handle;
    const batch = fb.writeBatch(db);
    if (handle !== old) {
      const taken = await fb.getDoc(fb.doc(db, "handles", handle));
      if (taken.exists() && taken.data().uid !== user.uid) throw Object.assign(new Error("taken"), { code: "taken" });
      if (!taken.exists()) batch.set(fb.doc(db, "handles", handle), { uid: user.uid });
      if (old) {
        batch.delete(fb.doc(db, "handles", old));
        if ((await fb.getDoc(fb.doc(db, "profiles", old))).exists()) batch.delete(fb.doc(db, "profiles", old));
      }
    }
    const since = profile?.since || Date.now();
    batch.set(fb.doc(db, "users", user.uid), {
      handle, name, colour: COLOURS.includes(colour) ? colour : "yellow", mark: MARKS.includes(mark) ? mark : "book",
      since, public: Boolean(profile?.public), showLines: Boolean(profile?.showLines), updated: Date.now(),
    }, { merge: true });
    await batch.commit();
    const first = !old;
    keepProfile({ ...profile, handle, name, colour, mark, since });
    const s = read(KEYS.sync, {});
    delete s.published;
    write(KEYS.sync, s);
    emit();
    await sync(first ? "first" : "profile");
  }

  async function setSharing({ public: isPublic = profile.public, showLines = profile.showLines }) {
    await sdk();
    const batch = fb.writeBatch(db);
    batch.set(fb.doc(db, "users", user.uid), { public: isPublic, showLines, updated: Date.now() }, { merge: true });
    if (!isPublic && (await fb.getDoc(fb.doc(db, "profiles", profile.handle))).exists()) batch.delete(fb.doc(db, "profiles", profile.handle));
    await batch.commit();
    keepProfile({ ...profile, public: isPublic, showLines });
    const s = read(KEYS.sync, {});
    delete s.published;
    write(KEYS.sync, s);
    emit();
    if (isPublic) await publish(true);
  }

  // Deleting an account removes everything it keeps, then the account itself. This device keeps its own copy.
  async function deleteAccount() {
    await sdk();
    const uid = user.uid;
    const notes = await fb.getDocs(fb.collection(db, "users", uid, "notes"));
    for (let i = 0; i < notes.docs.length; i += 400) {
      const batch = fb.writeBatch(db);
      notes.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    const batch = fb.writeBatch(db);
    if (profile?.handle) {
      // (the rules allow removing only what exists and is yours, so a reader page is removed only if there is one)
      if ((await fb.getDoc(fb.doc(db, "profiles", profile.handle))).exists()) batch.delete(fb.doc(db, "profiles", profile.handle));
      batch.delete(fb.doc(db, "handles", profile.handle));
    }
    batch.delete(fb.doc(db, "users", uid));
    await batch.commit();
    await fb.deleteUser(auth.currentUser);
    forgetDevice(false);
    drop(KEYS.owner); // what stays on the device is nobody's account's now
  }
  // Asked for before deleting an account that signed in a while ago
  const reauthenticate = (password) => sdk().then(() => (profile.provider === "google"
    ? fb.reauthenticateWithPopup(auth.currentUser, new fb.GoogleAuthProvider())
    : fb.reauthenticateWithCredential(auth.currentUser, fb.EmailAuthProvider.credential(auth.currentUser.email, password))));

  /* ---------- Keeping your reading in step ---------- */

  const device = () => {
    let id = read(KEYS.device, "");
    if (!id) { id = (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 20); write(KEYS.device, id); }
    return id;
  };

  // Two copies of your place in a book: the one you read more recently wins, and what either has seen is kept
  function mergePlaces(mine, theirs) {
    const out = { ...mine };
    Object.entries(theirs || {}).forEach(([slug, other]) => {
      const own = out[slug];
      if (!own) { out[slug] = other; return; }
      const newer = (other.at || 0) > (own.at || 0) ? other : own;
      const done = [own.done, other.done].filter(Boolean);
      out[slug] = {
        ...newer,
        furthest: Math.max(own.furthest || 0, other.furthest || 0),
        spine: Math.max(own.spine ?? -1, other.spine ?? -1),
        seen: { ...(other.seen || {}), ...(own.seen || {}) },
        ...(done.length ? { done: Math.min(...done) } : {}),
      };
    });
    return out;
  }
  // the same data written the same way whatever order its keys came back in, to tell whether anything changed
  const stable = (value) => JSON.stringify(value, (key, v) => (v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
  const addStats = (into, stats) => {
    Object.entries(stats?.days || {}).forEach(([day, s]) => { into.days[day] = (into.days[day] || 0) + s; });
    Object.entries(stats?.books || {}).forEach(([book, s]) => { into.books[book] = (into.books[book] || 0) + s; });
    return into;
  };

  let dirty = false;
  let running = null;
  let again = false;
  let timer = 0;
  let lastSync = read(KEYS.sync, {}).at || 0;
  let lastError = "";

  function sync(reason = "") {
    if (!config || !profile?.handle || pending) return Promise.resolve(false);
    if (running) { again = true; return running; }
    clearTimeout(timer);
    running = (async () => {
      await sdk();
      if (!user) return false;
      const uid = user.uid;
      dirty = false;
      emit();
      const s = read(KEYS.sync, {});
      const me = device();
      const userRef = fb.doc(db, "users", uid);
      const remote = (await fb.getDoc(userRef)).data() || {};

      // Your place in each book
      const places = mergePlaces(read(KEYS.places, {}), remote.places);
      write(KEYS.places, places);
      // Reading time: each device writes its own, and adds up the others'
      const others = { days: {}, books: {} };
      Object.entries(remote.devices || {}).forEach(([id, stats]) => { if (id !== me) addStats(others, stats); });
      write(KEYS.others, others);
      const mine = read(KEYS.stats, { days: {}, books: {} });
      // How you like the text: the one chosen more recently wins
      const prefs = read(KEYS.prefs, null);
      let prefsUp = false;
      if (remote.prefs && (remote.prefs.at || 0) > (prefs?.at || 0)) write(KEYS.prefs, { ...(prefs || {}), ...remote.prefs });
      else if (prefs?.at && prefs.at > (remote.prefs?.at || 0)) prefsUp = true;

      // Highlights and notes: those changed in the account since the last time come down, the newer copy wins
      const store = await notesStore();
      const pulled = s.pulled ? fb.Timestamp.fromMillis(s.pulled) : null;
      const notesRef = fb.collection(db, "users", uid, "notes");
      const down = await fb.getDocs(pulled ? fb.query(notesRef, fb.where("synced", ">", pulled)) : notesRef);
      const known = { ...(s.notes || {}) };
      let newest = s.pulled || 0;
      for (const d of down.docs) {
        const n = d.data();
        newest = Math.max(newest, n.synced?.toMillis?.() || 0);
        const have = await store.get(d.id);
        if (n.deleted) {
          if (have && (have.updated || 0) <= (n.updated || 0)) await store.forget(d.id);
          delete known[d.id];
        } else if (!have || (have.updated || 0) < (n.updated || 0)) {
          const { synced, deleted, ...note } = n;
          await store.keep({ ...note, id: d.id });
          known[d.id] = note.updated;
        } else if ((have.updated || 0) === (n.updated || 0)) {
          known[d.id] = n.updated;
        }
      }

      // ... and those changed here go up, with the notes removed here
      const local = await store.all();
      const up = local.filter((n) => known[n.id] !== n.updated);
      const removed = Object.entries(store.removed());
      const writes = [
        ...up.map((n) => (b) => b.set(fb.doc(db, "users", uid, "notes", n.id), { ...n, synced: fb.serverTimestamp() })),
        ...removed.map(([id, at]) => (b) => b.set(fb.doc(db, "users", uid, "notes", id), { deleted: true, updated: at, synced: fb.serverTimestamp() })),
      ];
      const placesChanged = stable(places) !== stable(remote.places || {});
      const theirsOfMine = remote.devices?.[me];
      const statsChanged = stable({ days: mine.days || {}, books: mine.books || {} }) !== stable(theirsOfMine ? { days: theirsOfMine.days || {}, books: theirsOfMine.books || {} } : null);
      if (placesChanged || statsChanged || !remote.handle) {
        writes.push((b) => b.set(userRef, {
          ...(placesChanged ? { places } : {}),
          ...(statsChanged ? { devices: { [me]: { days: mine.days || {}, books: mine.books || {}, at: Date.now() } } } : {}),
          updated: Date.now(),
        }, { merge: true }));
      }
      for (let i = 0; i < writes.length; i += 400) {
        const batch = fb.writeBatch(db);
        writes.slice(i, i + 400).forEach((w) => w(batch));
        await batch.commit();
      }
      // on their own, so a database whose rules predate them refuses only them
      if (prefsUp) {
        await fb.setDoc(userRef, { prefs: { theme: prefs.theme, size: prefs.size, font: prefs.font, at: prefs.at } }, { merge: true }).catch(() => {});
      }
      up.forEach((n) => { known[n.id] = n.updated; });
      store.removedSynced(removed.map(([id]) => id));
      lastSync = Date.now();
      write(KEYS.sync, { ...read(KEYS.sync, {}), at: lastSync, pulled: newest, notes: known });
      lastError = "";
      write(KEYS.owner, uid);
      await publish(false);
      if (down.docs.length || reason === "signed in") window.dispatchEvent(new CustomEvent("bookshelf:synced", { detail: { reason } }));
      return true;
    })().catch((error) => {
      lastError = explain(error) || "Not kept just now. It will try again.";
      dirty = true;
      return false;
    }).finally(() => {
      running = null;
      emit();
      if (again) { again = false; sync("again"); }
    });
    return running;
  }

  // Your reader page, when you share it: who you are, what you are reading and have read, and (if you choose) the lines
  // you highlighted. Never your notes.
  async function publish(force) {
    if (!profile?.public || !user) return;
    const library = libraryData();
    const places = Object.entries(read(KEYS.places, {})).filter(([slug]) => library[slug]);
    const stats = addStats(addStats({ days: {}, books: {} }, read(KEYS.stats, {})), read(KEYS.others, {}));
    const finished = places.filter(([, p]) => p.done || p.seen?.finished).sort((a, b) => (b[1].done || b[1].at) - (a[1].done || a[1].at));
    const reading = places.filter(([, p]) => !(p.done || p.seen?.finished) && (p.percent || 0) < 0.98).sort((a, b) => b[1].at - a[1].at);
    let lines = [];
    if (profile.showLines) {
      const notes = await (await notesStore()).all();
      lines = notes.filter((n) => n.style !== "underline" && library[n.book] && n.text.length <= 600)
        .sort((a, b) => b.created - a.created).slice(0, 12).map((n) => ({ book: n.book, text: n.text, style: n.style }));
    }
    const page = {
      uid: user.uid, handle: profile.handle, name: profile.name, colour: profile.colour, mark: profile.mark, since: profile.since,
      seconds: Math.round(Object.values(stats.days).reduce((a, b) => a + b, 0)),
      reading: reading.slice(0, 12).map(([slug, p]) => ({ book: slug, percent: Math.round((p.percent || 0) * 100) })),
      finished: finished.slice(0, 200).map(([slug, p]) => ({ book: slug, at: p.done || p.at || 0 })),
      lines,
    };
    const text = JSON.stringify(page);
    const s = read(KEYS.sync, {});
    if (!force && s.published === text) return;
    await fb.setDoc(fb.doc(db, "profiles", profile.handle), { ...page, updated: Date.now() });
    write(KEYS.sync, { ...read(KEYS.sync, {}), published: text });
  }

  async function loadProfile(handle) {
    await sdk();
    const snap = await fb.getDoc(fb.doc(db, "profiles", handle));
    return snap.exists() ? snap.data() : null;
  }

  function notesStore() {
    if (window.BookshelfNotes) return Promise.resolve(window.BookshelfNotes);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = new URL(`notes-store.js${version ? `?v=${version}` : ""}`, here).href;
      s.onload = () => resolve(window.BookshelfNotes);
      s.onerror = reject;
      document.head.append(s);
    });
  }
  function libraryData() {
    try { return JSON.parse(document.querySelector("[data-library]")?.textContent || "{}"); } catch { return {}; }
  }

  // Something new to keep (a page turned, a highlight): kept in the account a little later, not on every page turn, so
  // a long read costs a few writes rather than hundreds. Leaving the page keeps it at once.
  window.addEventListener("bookshelf:changed", () => {
    if (state() !== "in") return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => sync("changed"), 60000);
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && dirty && state() === "in") sync("leaving"); });

  /* ---------- The header: Sign in, or your mark and name ---------- */

  function paintChips() {
    if (!config) return;
    const signedIn = Boolean(profile?.handle);
    document.documentElement.classList.toggle("is-signed-in", signedIn);
    if (!signedIn) return;
    document.querySelectorAll("[data-account-me-name]").forEach((name) => { name.textContent = profile.name.split(" ")[0] || `@${profile.handle}`; });
    document.querySelectorAll("[data-account-me-avatar]").forEach((spot) => {
      const mark = avatar(profile, "chip");
      spot.replaceWith(mark);
      mark.setAttribute("data-account-me-avatar", "");
    });
    document.querySelectorAll(".button-alt.is--me").forEach((button) => button.setAttribute("aria-label", `Your account, ${profile.name}`));
  }

  const api = {
    get enabled() { return Boolean(config); },
    current: () => ({ state: state(), profile, pending, syncing: Boolean(running), dirty, lastSync, error: lastError }),
    subscribe(fn) { subscribers.add(fn); fn(api.current()); return () => subscribers.delete(fn); },
    start: () => sdk().then(() => api.current()),
    google, signIn, signUp, resetPassword, verifyAgain, refresh, signOut: signOutNow, saveProfile, setSharing, deleteAccount,
    reauthenticate, handleFree, loadProfile, sync: () => sync("asked"), settleReading, explain, checkHandle, checkName, suggest, avatar,
    COLOURS, MARKS, MARK_NAMES,
    url: (handle) => new URL(`profile.html?u=${encodeURIComponent(handle)}`, document.baseURI).href,
  };
  window.BookshelfAccount = api;

  paintChips();
  // Signed in on this device: check in with the account once the page has settled
  if (config && profile?.handle) {
    const later = () => (window.requestIdleCallback ? requestIdleCallback(() => sdk().catch(() => {}), { timeout: 4000 }) : setTimeout(() => sdk().catch(() => {}), 2500));
    if (document.readyState === "complete") later(); else addEventListener("load", later, { once: true });
  }
})();
