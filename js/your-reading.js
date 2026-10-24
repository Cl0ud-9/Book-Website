/* Your reading (reading.html): what this device keeps for you. Your place in each book, your reading time, your
   highlights and notes, the books kept for offline reading and the books you finished, with a backup to move them to
   another device. Loaded by js/app.js on that page only. With an account (js/account.js) the same things are also
   kept in it, and reading time adds up the time read on your other devices. */
(() => {
  "use strict";

  const KEYS = { places: "bookshelf:reading", prefs: "bookshelf:reader", stats: "bookshelf:stats", offline: "bookshelf:offline" };
  const OTHERS = "bookshelf:stats-others"; // reading time on your other devices, from your account
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not kept */ } };
  const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const duration = (seconds) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`;
  };
  const ago = (time) => {
    const days = Math.floor((Date.now() - time) / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    return new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  };
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
  };

  function init(root, library) {
    const $ = (sel) => root.querySelector(sel);
    const store = window.BookshelfNotes;
    const offline = window.BookshelfOffline;
    let closed = false;
    let notes = [];

    // A book's little card: cover, title, author, and whatever the section adds
    const bookItem = (slug, extra) => {
      const book = library[slug];
      const li = el("li", "mine__book");
      const img = el("img", "mine__cover");
      img.src = `image/covers/${slug}-180.webp`;
      img.alt = "";
      img.width = 90;
      img.height = 135;
      img.loading = "lazy";
      const text = el("div", "mine__book-text");
      const title = el("a", "mine__book-title", book.title);
      title.href = `book-${slug}.html`;
      text.append(title, el("p", "mine__book-author", book.author));
      li.append(img, text);
      extra(text, li);
      return li;
    };

    /* ---------- Your week ---------- */

    function week() {
      // this device's reading time, and your other devices' when you are signed in
      const days = { ...(read(KEYS.stats, {}).days || {}) };
      const others = read(OTHERS, null);
      Object.entries(others?.days || {}).forEach(([day, seconds]) => { days[day] = (days[day] || 0) + seconds; });
      const today = new Date();
      const last7 = [...Array(7)].map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return { date: d, seconds: days[dayKey(d)] || 0 };
      });
      const weekSeconds = last7.reduce((sum, d) => sum + d.seconds, 0);
      // A streak runs back from today, or from yesterday if today has not started yet
      let streak = 0;
      const cursor = new Date(today);
      if ((days[dayKey(cursor)] || 0) < 60) cursor.setDate(cursor.getDate() - 1);
      while ((days[dayKey(cursor)] || 0) >= 60) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
      const places = read(KEYS.places, {});
      const finished = Object.entries(places).filter(([slug, p]) => library[slug] && (p.done || p.seen?.finished)).length;
      const total = Object.values(days).reduce((sum, s) => sum + s, 0);
      $("[data-stat=week]").textContent = duration(weekSeconds);
      $("[data-stat=streak]").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
      $("[data-stat=finished]").textContent = String(finished);
      $("[data-stat=total]").textContent = duration(total);
      $("[data-stat=total]").nextElementSibling.textContent = others ? "read, on all your devices" : "read here, in all";
      $(".mine__caption").textContent = weekSeconds
        ? "Minutes read on each of the last seven days. Time counts while a book is open and you are turning its pages."
        : "No reading yet this week. Open a book, and the minutes you spend reading show up here, day by day.";

      // Seven bars, one a day, scaled to the busiest day (at least 30 minutes, so a short day does not fill the chart)
      const chart = $("[data-chart]");
      chart.innerHTML = "";
      chart.classList.toggle("is--empty", weekSeconds === 0);
      const top = Math.max(1800, ...last7.map((d) => d.seconds));
      last7.forEach(({ date, seconds }, i) => {
        const minutes = Math.round(seconds / 60);
        const name = i === 6 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" });
        const full = i === 6 ? "Today" : date.toLocaleDateString(undefined, { weekday: "long" });
        const col = el("div", "mine__bar");
        col.setAttribute("role", "img");
        col.setAttribute("aria-label", `${full}: ${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
        const value = el("span", "mine__bar-value", minutes ? duration(seconds) : "");
        const track = el("span", "mine__bar-track");
        const fill = el("span", "mine__bar-fill");
        track.style.setProperty("--h", `${(seconds / top) * 100}%`);
        if (i === 6) col.classList.add("is--today");
        track.append(fill, value);
        col.append(track, el("span", "mine__bar-day", name));
        chart.append(col);
      });
    }

    /* ---------- Reading now and finished ---------- */

    function books() {
      const places = Object.entries(read(KEYS.places, {})).filter(([slug]) => library[slug]);
      const reading = places.filter(([, p]) => !(p.done || p.seen?.finished) && (p.percent ?? 0) < 0.98).sort((a, b) => b[1].at - a[1].at);
      const list = $("[data-reading-list]");
      list.innerHTML = "";
      reading.forEach(([slug, place]) => list.append(bookItem(slug, (text) => {
        const pct = Math.round((place.percent || 0) * 100);
        const bar = el("span", "mine__progress");
        const fill = el("span");
        fill.style.transform = `scaleX(${place.percent || 0})`;
        bar.append(fill);
        bar.setAttribute("role", "progressbar");
        bar.setAttribute("aria-label", "How far you have read");
        bar.setAttribute("aria-valuenow", String(pct));
        bar.setAttribute("aria-valuemin", "0");
        bar.setAttribute("aria-valuemax", "100");
        const go = el("a", "mine__button is--small", "Continue");
        go.href = `read.html?book=${slug}`;
        go.prepend(icon("read"));
        text.append(el("p", "mine__meta", `${pct}% read · last opened ${ago(place.at)}`), bar, go);
      })));
      $("[data-reading-empty]").hidden = reading.length > 0;

      const done = places.filter(([, p]) => p.done || p.seen?.finished).sort((a, b) => (b[1].done || b[1].at) - (a[1].done || a[1].at));
      const finished = $("[data-finished-list]");
      finished.innerHTML = "";
      done.forEach(([slug, place]) => finished.append(bookItem(slug, (text) => {
        text.append(el("p", "mine__meta", `Finished ${ago(place.done || place.at)}`));
      })));
      $("[data-finished-empty]").hidden = done.length > 0;
    }

    /* ---------- Kept for offline ---------- */

    async function kept() {
      const list = $("[data-offline-list]");
      $("[data-offline-unsupported]").hidden = !!offline?.supported;
      if (!offline?.supported) { $("[data-offline-empty]").hidden = true; return; }
      const books = (await offline.list()).filter((b) => library[b.slug]);
      if (closed) return;
      list.innerHTML = "";
      books.forEach((b) => list.append(bookItem(b.slug, (text, li) => {
        const actions = el("p", "mine__row");
        const go = el("a", "mine__button is--small", "Read");
        go.href = `read.html?book=${b.slug}`;
        go.prepend(icon("read"));
        const remove = el("button", "mine__button is--small is--quiet", "Remove");
        remove.type = "button";
        remove.addEventListener("click", async () => { await offline.drop(b.slug); li.remove(); $("[data-offline-empty]").hidden = list.children.length > 0; });
        actions.append(go, remove);
        text.append(el("p", "mine__meta", `Kept ${ago(b.at)}`), actions);
      })));
      $("[data-offline-empty]").hidden = books.length > 0;
    }

    // A short message at the foot of the screen, with Undo for a removal
    const toast = $("[data-mine-toast]");
    const toastText = toast.querySelector("[data-toast-text]");
    const toastUndo = toast.querySelector("[data-toast-undo]");
    let undoing = null;
    let toastTimer = 0;
    toastUndo.addEventListener("click", () => { const fn = undoing; undoing = null; toast.hidden = true; fn?.(); });
    const say = (text, undo) => {
      toastText.textContent = text;
      undoing = undo || null;
      toastUndo.hidden = !undo;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; undoing = null; }, undo ? 6000 : 2500);
    };

    /* ---------- Your notes ---------- */

    const notesBox = $("[data-notes-all]");
    const search = $("[data-notes-search]");
    const plain = (text) => text.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
    function showNotes() {
      const words = plain(search.value).split(/\s+/).filter(Boolean);
      const shown = notes.filter((n) => library[n.book] && words.every((w) => plain(`${n.text} ${n.note} ${library[n.book].title}`).includes(w)));
      notesBox.innerHTML = "";
      // grouped by book, the book you noted most recently first
      const groups = new Map();
      shown.forEach((n) => groups.set(n.book, [...(groups.get(n.book) || []), n]));
      [...groups.entries()].sort((a, b) => Math.max(...b[1].map((n) => n.updated)) - Math.max(...a[1].map((n) => n.updated))).forEach(([slug, items]) => {
        const group = el("section", "mine__note-group");
        const head = el("h3", "mine__note-book");
        const link = el("a", null, library[slug].title);
        link.href = `book-${slug}.html`;
        head.append(link, el("span", "mine__note-count", `${items.length} ${items.length === 1 ? "note" : "notes"}`));
        const list = el("ol", "mine__note-list");
        items.sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0)).forEach((n) => {
          const li = el("li", "mine__note");
          li.append(el("span", `mine__note-mark is--${n.style}`));
          const body = el("div", "mine__note-body");
          const bookmark = n.style === "bookmark"; // the opening words of a page
          body.append(el("blockquote", "mine__note-quote", bookmark ? `${n.text}…` : n.text));
          if (n.note) body.append(el("p", "mine__note-own", n.note));
          body.append(el("p", "mine__meta", [bookmark ? "Bookmark" : "", n.chapter, n.percent != null ? `${Math.round(n.percent * 100)}%` : ""].filter(Boolean).join(" · ")));
          const actions = el("p", "mine__row");
          const open = el("a", "mine__button is--small", "Open in the book");
          open.href = `read.html?book=${slug}&note=${encodeURIComponent(n.id)}`;
          open.prepend(icon("read"));
          const remove = el("button", "mine__button is--small is--quiet", "Remove");
          remove.type = "button";
          remove.addEventListener("click", async () => {
            await store.remove(n.id);
            notes = notes.filter((x) => x.id !== n.id);
            showNotes();
            say(n.note ? "Note removed" : "Highlight removed", async () => { notes.push(await store.put(n)); showNotes(); });
          });
          actions.append(open, remove);
          body.append(actions);
          li.append(body);
          list.append(li);
        });
        group.append(head, list);
        notesBox.append(group);
      });
      $("[data-notes-none]").hidden = notes.length > 0;
      $("[data-notes-none]").textContent = notes.length ? "" : "Select any words in a book to highlight them or add a note. They will all be here.";
      if (notes.length && !shown.length) notesBox.append(el("p", "mine__empty", "No notes match that."));
      $("[data-notes-find]").hidden = notes.length < 4;
      $("[data-notes-actions]").hidden = notes.length === 0;
    }
    search.addEventListener("input", showNotes);
    const saveFile = (name, type, text) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([text], { type }));
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };
    $("[data-notes-export]").addEventListener("click", () => {
      const lines = ["# My notes from The Bookshelf", ""];
      const books = [...new Set(notes.map((n) => n.book))].filter((slug) => library[slug]);
      books.forEach((slug) => {
        lines.push(`## ${library[slug].title}, ${library[slug].author}`, "");
        notes.filter((n) => n.book === slug).forEach((n) => {
          lines.push(`> ${n.text}`, "");
          if (n.note) lines.push(n.note, "");
          if (n.chapter) lines.push(`*${n.chapter}*`, "");
        });
      });
      saveFile("bookshelf-notes.md", "text/markdown", lines.join("\n"));
    });

    /* ---------- Back up, restore, clear ---------- */

    const message = $("[data-backup-message]");
    $("[data-backup]").addEventListener("click", async () => {
      const backup = {
        app: "The Bookshelf", kind: "backup", version: 1, saved: new Date().toISOString(),
        places: read(KEYS.places, {}), prefs: read(KEYS.prefs, {}), stats: read(KEYS.stats, {}), notes: await store.all(),
      };
      saveFile(`bookshelf-backup-${dayKey(new Date())}.json`, "application/json", JSON.stringify(backup, null, 1));
      message.textContent = `Saved a backup of ${Object.keys(backup.places).length} books and ${backup.notes.length} notes.`;
    });
    $("[data-restore]").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data?.app !== "The Bookshelf" || data.kind !== "backup") throw new Error("not a backup");
        // Places: the more recently read copy of each book wins. Reading time: the larger count for each day, so restoring
        // the same backup twice never counts a day twice. Text settings: kept as they are here, unless there are none.
        const places = read(KEYS.places, {});
        Object.entries(data.places || {}).forEach(([slug, p]) => { if (!places[slug] || (places[slug].at || 0) < (p.at || 0)) places[slug] = p; });
        write(KEYS.places, places);
        const stats = read(KEYS.stats, {});
        for (const part of ["days", "books"]) {
          stats[part] = { ...(stats[part] || {}) };
          Object.entries(data.stats?.[part] || {}).forEach(([k, v]) => { stats[part][k] = Math.max(stats[part][k] || 0, Number(v) || 0); });
        }
        write(KEYS.stats, stats);
        if (!localStorage.getItem(KEYS.prefs) && data.prefs) write(KEYS.prefs, data.prefs);
        const added = await store.restore(Array.isArray(data.notes) ? data.notes : []);
        window.dispatchEvent(new Event("bookshelf:changed"));
        notes = await store.all();
        render();
        message.textContent = `Restored ${Object.keys(data.places || {}).length} books and ${added} notes.`;
      } catch {
        message.textContent = "That file isn’t a Bookshelf backup. Choose the .json file that Back up saved.";
      }
    });
    // Clearing removes this device's copy. Signed in, it signs out first: your account keeps everything (deleting
    // that is on Your account), and would otherwise bring it straight back.
    const clear = $("[data-clear]");
    const account = window.BookshelfAccount;
    const signedIn = () => account?.current().state === "in";
    const clearLabel = () => (signedIn() ? "Sign out and clear this device" : "Clear everything");
    let armed = 0;
    clear.addEventListener("click", async () => {
      if (!armed) {
        clear.lastChild.textContent = "Press again to clear it";
        clear.classList.add("is--armed");
        armed = setTimeout(() => { armed = 0; clear.lastChild.textContent = clearLabel(); clear.classList.remove("is--armed"); }, 5000);
        return;
      }
      clearTimeout(armed);
      armed = 0;
      const wasIn = signedIn();
      if (wasIn) await account.signOut(false).catch(() => {});
      [...Object.values(KEYS), OTHERS, "bookshelf:removed", "bookshelf:owner"].forEach((key) => { try { localStorage.removeItem(key); } catch { /* none */ } });
      await Promise.all((await store.all()).map((n) => store.forget(n.id)));
      if (offline?.supported) await caches.delete("books");
      notes = [];
      render();
      clear.lastChild.textContent = clearLabel();
      clear.classList.remove("is--armed");
      message.textContent = wasIn ? "Signed out and cleared. Your account still keeps your reading." : "Cleared. This device keeps nothing of yours now.";
    });

    // Whether this is kept in an account, at the top of the page
    const banner = $("[data-mine-account]");
    const showAccount = (now) => {
      if (!banner || !account?.enabled) return;
      banner.hidden = false;
      banner.replaceChildren();
      const link = el("a", null, "");
      link.href = "account.html";
      banner.classList.toggle("is--out", now.state !== "in");
      if (now.state === "in") {
        banner.append(account.avatar(now.profile, "small"), el("span", null, `Kept in your account, @${now.profile.handle}${now.lastSync ? "" : " (keeping it now…)"}. `));
        link.textContent = "Your account";
        banner.append(link);
      } else if (now.state === "merge" || now.state === "setup") {
        banner.append(el("span", null, "You’re signed in, with one step left before this is kept in your account. "));
        link.textContent = "Finish it";
        banner.append(link);
      } else {
        banner.append(el("span", "mine__account-text", "Kept on this device only. Sign in to have it on every device, and never lose your place."));
        const actions = el("span", "mine__account-actions");
        const signIn = el("a", "mine__button is--small", "Sign in");
        signIn.href = "login.html";
        const signUp = el("a", "mine__button is--small is--quiet", "Create an account");
        signUp.href = "signup.html";
        actions.append(signIn, signUp);
        banner.append(actions);
      }
      if (!armed) clear.lastChild.textContent = clearLabel();
    };
    const stopAccount = account?.subscribe(showAccount);
    // What came down from your account
    const synced = () => store.all().then((found) => { if (!closed) { notes = found; render(); } });
    window.addEventListener("bookshelf:synced", synced);

    function render() {
      week();
      books();
      kept();
      showNotes();
    }
    render();
    store.all().then((found) => { if (!closed) { notes = found; showNotes(); } });
    // Coming back to this tab after reading elsewhere shows the new numbers
    const refresh = () => { if (document.visibilityState === "visible") render(); };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      closed = true;
      clearTimeout(armed);
      clearTimeout(toastTimer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("bookshelf:synced", synced);
      stopAccount?.();
    };
  }

  window.BookshelfYourReading = { init };
})();
