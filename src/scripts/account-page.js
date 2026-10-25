/* Signing in (login.html), signing up (signup.html), your account (account.html) and readers' pages
   (profile.html?u=username). app.js loads this on those pages; the account itself (signing in, keeping your
   reading in step) is account.js, on every page. */
(() => {
  "use strict";

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const duration = (seconds) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    return minutes % 60 ? `${h} h ${minutes % 60} min` : `${h} h`;
  };
  const month = (time) => new Date(time).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const ago = (time) => {
    const s = Math.round((Date.now() - time) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "long" });
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const say = (node, text, good = false) => {
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is--good", good);
  };
  const busy = (button, on) => {
    button.disabled = on;
    button.classList.toggle("is--busy", on);
  };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Timers that stop when the page is left
  function lifetime() {
    const timers = new Set();
    const life = {
      closed: false,
      later(fn, ms) {
        const t = setTimeout(() => { timers.delete(t); if (!life.closed) fn(); }, ms);
        timers.add(t);
        return t;
      },
      end() { life.closed = true; timers.forEach(clearTimeout); },
    };
    return life;
  }

  /* ---------- Pieces shared by the pages ---------- */

  // Signing in or up: Google, or an email and a password (mode "in" or "up")
  function signInForm(root, account, mode) {
    const $ = (sel) => root.querySelector(sel);
    const form = $("[data-acct-email]");
    const message = $("[data-acct-message]");
    if (!form) return;
    const submit = $("[data-acct-submit]");
    const label = submit.querySelector(".icon") ? submit.firstChild : null; // the words before the arrow
    const words = label?.textContent;
    $("[data-acct-google]").addEventListener("click", async () => {
      const button = $("[data-acct-google]");
      say(message, "");
      button.disabled = true;
      try { await account.google(); } catch (error) { say(message, account.explain(error)); }
      button.disabled = false;
    });
    $("[data-acct-show]").addEventListener("click", () => {
      const input = form.elements.password;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      const button = $("[data-acct-show]");
      button.setAttribute("aria-pressed", String(!showing));
      button.setAttribute("aria-label", showing ? "Show the password" : "Hide the password");
      button.querySelector("use").setAttribute("href", showing ? "#i-eye" : "#i-eye-off");
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!EMAIL.test(email)) { say(message, "Enter an email address, like reader@example.com."); form.elements.email.focus(); return; }
      if (!password) { say(message, "Enter your password."); form.elements.password.focus(); return; }
      if (mode === "up" && password.length < 8) { say(message, "Use at least 8 characters for your password."); form.elements.password.focus(); return; }
      busy(submit, true);
      if (label) label.textContent = mode === "in" ? "Signing in… " : "Creating your account… ";
      say(message, "");
      try {
        if (mode === "in") await account.signIn(email, password); else await account.signUp(email, password);
      } catch (error) {
        say(message, account.explain(error));
      }
      busy(submit, false);
      if (label) label.textContent = words;
    });
    $("[data-acct-forgot]")?.addEventListener("click", async () => {
      const email = form.elements.email.value.trim();
      if (!EMAIL.test(email)) { say(message, "Enter your email address above, then press Forgot your password again."); form.elements.email.focus(); return; }
      const sent = `If there’s an account for ${email}, we’ve emailed it a link to choose a new password.`;
      try {
        await account.resetPassword(email);
        say(message, sent, true);
      } catch (error) {
        if (error?.code === "auth/user-not-found") say(message, sent, true); else say(message, account.explain(error));
      }
    });
  }

  // Your name, username, colour and mark
  function setupForm(root, account, life, { onSaved, onCancel }) {
    const $ = (sel) => root.querySelector(sel);
    const setup = $("[data-acct-setup]");
    const nameInput = setup.elements.name;
    const handleInput = setup.elements.handle;
    const nameNote = $("[data-acct-name-note]");
    const handleNote = $("[data-acct-handle-note]");
    const message = $("[data-acct-setup-message]");
    let ticket = 0;
    let pause = 0;
    const picked = (name) => setup.querySelector(`input[name="${name}"]:checked`)?.value;
    const preview = () => {
      $("[data-acct-preview-avatar]").replaceChildren(account.avatar({ colour: picked("colour"), mark: picked("mark") }, "large"));
      $("[data-acct-preview-name]").textContent = nameInput.value.trim() || "Your name";
      $("[data-acct-preview-handle]").textContent = `@${handleInput.value || "username"}`;
    };
    const checkHandle = () => {
      const value = handleInput.value;
      const problem = account.checkHandle(value);
      handleNote.classList.remove("is--good", "is--bad");
      clearTimeout(pause);
      ticket += 1;
      if (problem) {
        handleNote.textContent = value ? problem : "3 to 20 small letters, numbers or _";
        if (value) handleNote.classList.add("is--bad");
        handleInput.setAttribute("aria-invalid", String(Boolean(value)));
        return;
      }
      if (value === account.current().profile?.handle) {
        handleNote.textContent = "That’s yours.";
        handleNote.classList.add("is--good");
        handleInput.setAttribute("aria-invalid", "false");
        return;
      }
      handleNote.textContent = "Checking…";
      const mine = ticket;
      pause = life.later(async () => {
        try {
          const free = await account.handleFree(value);
          if (mine !== ticket) return;
          handleNote.textContent = free ? `@${value} is free.` : `@${value} is taken. Try another.`;
          handleNote.classList.add(free ? "is--good" : "is--bad");
          handleInput.setAttribute("aria-invalid", String(!free));
        } catch {
          if (mine === ticket) handleNote.textContent = "Couldn’t check just now. It will be checked when you save.";
        }
      }, 400);
    };
    handleInput.addEventListener("input", () => {
      const cleaned = handleInput.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (cleaned !== handleInput.value) handleInput.value = cleaned;
      preview();
      checkHandle();
    });
    nameInput.addEventListener("input", () => {
      const problem = nameInput.value.trim() ? account.checkName(nameInput.value.trim()) : "";
      nameNote.textContent = problem;
      nameNote.classList.toggle("is--bad", Boolean(problem));
      nameInput.setAttribute("aria-invalid", String(Boolean(problem)));
      preview();
    });
    setup.addEventListener("change", (event) => { if (event.target.type === "radio") preview(); });
    setup.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim().replace(/\s+/g, " ");
      const handle = handleInput.value;
      const problem = account.checkName(name) || account.checkHandle(handle);
      if (problem) { say(message, problem); (account.checkName(name) ? nameInput : handleInput).focus(); return; }
      const save = $("[data-acct-save]");
      busy(save, true);
      say(message, "Saving…");
      try {
        await account.saveProfile({ handle, name, colour: picked("colour"), mark: picked("mark") });
        say(message, "");
        onSaved?.();
      } catch (error) {
        say(message, error?.code === "taken" ? `@${handle} was just taken. Try another.` : error?.code === "invalid" ? error.message : account.explain(error));
      }
      busy(save, false);
    });
    $("[data-acct-cancel]")?.addEventListener("click", () => onCancel?.());
    return {
      fill(profile, { editing = false, saveLabel = "Save" } = {}) {
        const s = profile.suggestion || {};
        nameInput.value = profile.name || s.name || "";
        handleInput.value = profile.handle || s.handle || "";
        const colour = profile.colour || account.COLOURS[Math.floor(Math.random() * account.COLOURS.length)];
        setup.querySelector(`input[name="colour"][value="${colour}"]`).checked = true;
        setup.querySelector(`input[name="mark"][value="${profile.mark || "book"}"]`).checked = true;
        $("[data-acct-setup-title]").textContent = editing ? "Edit your name and mark" : "Make it yours";
        $("[data-acct-save-label]").textContent = saveLabel;
        const cancel = $("[data-acct-cancel]");
        if (cancel) cancel.hidden = !editing;
        say(message, "");
        nameNote.textContent = "";
        preview();
        checkHandle();
      },
    };
  }

  // The reading already on this device, when signing in: add it to the account, or leave it out
  function mergePanel(root, account) {
    const $ = (sel) => root.querySelector(sel);
    const panel = $("[data-acct-merge]");
    const message = $("[data-acct-merge-message]");
    const answer = async (keep, button) => {
      busy(button, true);
      say(message, keep ? "Adding it to your account…" : "Leaving it out…");
      try { await account.settleReading(keep); say(message, ""); } catch (error) { say(message, account.explain(error)); }
      busy(button, false);
    };
    $("[data-acct-merge-keep]").addEventListener("click", (event) => answer(true, event.currentTarget));
    $("[data-acct-merge-drop]").addEventListener("click", (event) => answer(false, event.currentTarget));
    return {
      fill({ books, notes, other }) {
        const what = [books ? plural(books, "book", "books") : "", notes ? plural(notes, "highlight or note", "highlights and notes") : ""].filter(Boolean).join(" and ");
        $("[data-acct-merge-text]").textContent = other
          ? `This device has ${what} from another account, or read since its owner signed out. Add them to your account only if they’re yours.`
          : `This device has ${what} from before you signed in. Add them to your account, and they’ll be on all your devices too.`;
        // reading from another account: the safe choice is first
        const keep = $("[data-acct-merge-keep]");
        const drop = $("[data-acct-merge-drop]");
        keep.classList.toggle("is--primary", !other);
        keep.classList.toggle("is--quiet", other);
        drop.classList.toggle("is--primary", other);
        drop.classList.toggle("is--quiet", !other);
        if (other) panel.querySelector(".mine__actions").prepend(drop); else panel.querySelector(".mine__actions").prepend(keep);
      },
    };
  }

  /* ---------- Sign in and sign up ---------- */

  function authPage(root) {
    const account = window.BookshelfAccount;
    const $ = (sel) => root.querySelector(sel);
    const mode = root.dataset.authMode === "up" ? "up" : "in";
    const steps = { off: $("[data-acct-off]"), checking: $("[data-acct-checking]"), out: $("[data-acct-out]"),
      setup: $("[data-acct-setup]"), merge: $("[data-acct-merge]"), done: $("[data-auth-done]") };
    const show = (which) => Object.entries(steps).forEach(([name, node]) => { node.hidden = name !== which; });
    if (!account?.enabled) { show("off"); return () => {}; }
    const life = lifetime();
    let justMade = false; // a name was just saved, so the welcome says "all set" rather than "welcome back"
    let shown = "";
    signInForm(root, account, mode);
    const setup = setupForm(root, account, life, { onSaved: () => { justMade = true; render(account.current()); } });
    const merge = mergePanel(root, account);

    function render(now) {
      const step = now.state === "in" ? "done" : now.state === "out" ? "out" : now.state;
      if (step === shown && step !== "done") return;
      const first = shown !== step;
      shown = step;
      show(step);
      if (step === "setup" && first) setup.fill(now.profile, { saveLabel: "Save and start reading" });
      if (step === "merge") merge.fill(now.pending);
      if (step === "done") {
        const { profile } = now;
        $("[data-auth-done-avatar]").replaceChildren(account.avatar(profile, "large"));
        const first = profile.name.split(" ")[0];
        $("[data-auth-done-title]").textContent = justMade ? `You’re all set, ${first}` : `Welcome back, ${first}`;
        $("[data-auth-done-text]").textContent = justMade
          ? "Your reading is kept in your account now, and comes with you to every device you sign in on."
          : "You’re signed in. Your reading is here, and on every device you sign in on.";
      }
      // a step that follows something you did (signing in, saving your name) takes the focus to its first field
      if (first && ["setup", "merge", "done"].includes(step)) steps[step].querySelector("input, button:not([disabled]), a")?.focus({ preventScroll: true });
    }
    show("checking");
    const stop = account.subscribe((now) => { if (!life.closed) render(now); });
    account.start().then(() => { if (!life.closed) render(account.current()); }).catch(() => {
      show("out");
      say($("[data-acct-message]"), "Accounts couldn’t load. Check your connection, then reload the page.");
    });
    return () => { life.end(); stop(); };
  }

  /* ---------- Your account ---------- */

  function accountPage(root) {
    const account = window.BookshelfAccount;
    const $ = (sel) => root.querySelector(sel);
    const parts = { off: $("[data-acct-off]"), checking: $("[data-acct-checking]"), out: $("[data-acct-out]"), setup: $("[data-acct-setup]"),
      merge: $("[data-acct-merge]"), in: $("[data-acct-in]") };
    const show = (which) => Object.entries(parts).forEach(([name, node]) => { node.hidden = name !== which; });
    if (!account?.enabled) { show("off"); return () => {}; }
    const life = lifetime();
    let editing = false;
    const message = $("[data-acct-message]");
    const setup = setupForm(root, account, life, {
      onSaved: () => { editing = false; render(account.current()); },
      onCancel: () => { editing = false; render(account.current()); },
    });
    const merge = mergePanel(root, account);

    $("[data-acct-edit]").addEventListener("click", () => {
      editing = true;
      render(account.current());
      setup.fill(account.current().profile, { editing: true });
      root.querySelector("[data-acct-setup] input[name=name]").focus();
    });
    const syncText = $("[data-acct-sync-text]");
    $("[data-acct-sync-now]").addEventListener("click", () => account.sync());
    $("[data-acct-verify-again]").addEventListener("click", async (event) => {
      try { await account.verifyAgain(); event.target.textContent = "Sent. Check your inbox"; } catch (error) { event.target.textContent = account.explain(error) || "Send it again"; }
    });
    $("[data-acct-verify-check]").addEventListener("click", () => account.refresh());
    const shareMessage = $("[data-acct-share-message]");
    const publicBox = $("[data-acct-public]");
    const linesBox = $("[data-acct-lines]");
    const sharing = async () => {
      publicBox.disabled = true;
      linesBox.disabled = true;
      say(shareMessage, "Saving…");
      try {
        await account.setSharing({ public: publicBox.checked, showLines: linesBox.checked });
        say(shareMessage, publicBox.checked ? "Your reader page is shared. Anyone with its link can see it." : "Your reader page is private.", true);
      } catch (error) {
        say(shareMessage, account.explain(error));
      }
      render(account.current());
    };
    publicBox.addEventListener("change", sharing);
    linesBox.addEventListener("change", sharing);
    $("[data-acct-copy]").addEventListener("click", async () => {
      const link = account.url(account.current().profile.handle);
      try { await navigator.clipboard.writeText(link); say(shareMessage, "Link copied.", true); } catch { say(shareMessage, link); }
    });

    const leaveMessage = $("[data-acct-leave-message]");
    $("[data-acct-signout]").addEventListener("click", async () => {
      try { await account.signOut(false); say(message, "Signed out. Your reading is still on this device.", true); } catch (error) { say(leaveMessage, account.explain(error)); }
    });
    $("[data-acct-signout-clear]").addEventListener("click", async () => {
      try { await account.signOut(true); say(message, "Signed out, and this device’s copy of your reading is cleared.", true); } catch (error) { say(leaveMessage, account.explain(error)); }
    });
    const deleteButton = $("[data-acct-delete]");
    const reauth = $("[data-acct-reauth]");
    let armed = 0;
    deleteButton.addEventListener("click", async () => {
      const label = deleteButton.querySelector("span");
      if (!armed) {
        armed = life.later(() => { armed = 0; label.textContent = "Delete my account"; deleteButton.classList.remove("is--armed"); }, 6000);
        label.textContent = "Press again to delete it for good";
        deleteButton.classList.add("is--armed");
        return;
      }
      clearTimeout(armed);
      armed = 0;
      deleteButton.disabled = true;
      label.textContent = "Deleting…";
      try {
        if (!reauth.hidden) await account.reauthenticate($("[data-acct-reauth-password]").value);
        await account.deleteAccount();
        say(message, "Your account is deleted, with everything it kept. Your reading is still on this device.", true);
      } catch (error) {
        if (error?.code === "auth/requires-recent-login") {
          const google = account.current().profile?.provider === "google";
          reauth.hidden = google;
          say(leaveMessage, google ? "For your safety, confirm it’s you: press Delete my account again and choose your Google account." : "For your safety, enter your password, then press Delete my account again.");
          if (google) {
            try { await account.reauthenticate(); say(leaveMessage, "Thanks. Press Delete my account once more."); } catch (again) { say(leaveMessage, account.explain(again)); }
          } else $("[data-acct-reauth-password]").focus();
        } else say(leaveMessage, account.explain(error));
      }
      deleteButton.disabled = false;
      label.textContent = "Delete my account";
      deleteButton.classList.remove("is--armed");
    });

    let shown = "";
    function render(now) {
      const { state, profile } = now;
      if (state === "checking" || state === "out") { show(state); shown = state; return; }
      if (state === "setup" || editing) {
        if (shown !== "setup") setup.fill(profile, { editing: state !== "setup" });
        show("setup");
        shown = "setup";
        return;
      }
      if (state === "merge") { show("merge"); merge.fill(now.pending); shown = "merge"; return; }
      show("in");
      shown = "in";
      $("[data-acct-avatar]").replaceChildren(account.avatar(profile, "large"));
      $("[data-acct-name]").textContent = profile.name;
      $("[data-acct-handle]").textContent = `@${profile.handle}`;
      $("[data-acct-since]").textContent = `Reader since ${month(profile.since)}${profile.email ? ` · ${profile.email}` : ""}`;
      $("[data-acct-verify]").hidden = profile.verified !== false;
      $("[data-acct-email]").textContent = profile.email;
      syncText.textContent = now.syncing ? "Keeping your reading…" : now.error || (now.lastSync ? `Kept in your account ${ago(now.lastSync)}` : "Not kept yet");
      $("[data-acct-sync]").classList.toggle("is--busy", now.syncing);
      $("[data-acct-sync]").classList.toggle("is--bad", Boolean(now.error) && !now.syncing);
      publicBox.checked = Boolean(profile.public);
      linesBox.checked = Boolean(profile.showLines);
      publicBox.disabled = false;
      linesBox.disabled = !profile.public;
      $("[data-acct-lines-row]").classList.toggle("is--off", !profile.public);
      $("[data-acct-page-links]").hidden = !profile.public;
      $("[data-acct-page-link]").href = `profile.html?u=${encodeURIComponent(profile.handle)}`;
    }

    show("checking");
    const stop = account.subscribe((now) => { if (!life.closed) render(now); });
    account.start().then(() => { if (!life.closed) render(account.current()); }).catch(() => {
      show("out");
      say(message, "Accounts couldn’t load. Check your connection, then reload the page.");
    });
    // the "x min ago" line stays true while the page is open
    const tick = setInterval(() => { if (!parts.in.hidden) render(account.current()); }, 30000);
    return () => { life.end(); stop(); clearInterval(tick); };
  }

  /* ---------- A reader's page ---------- */

  function profilePage(root, library) {
    const account = window.BookshelfAccount;
    const $ = (sel) => root.querySelector(sel);
    const page = root.closest("[data-barba='container']") || document;
    const status = $("[data-profile-status]");
    let closed = false;
    const handle = (new URLSearchParams(location.search).get("u") || "").toLowerCase();
    if (!account?.enabled) { status.textContent = "Reader pages aren’t switched on for this copy of the Bookshelf."; return () => {}; }
    if (!handle) {
      const mine = account.current().profile?.handle;
      status.innerHTML = "";
      status.append(mine ? "Looking for your own page? " : "This address doesn’t name a reader. ");
      const link = el("a", null, mine ? "Open it" : "Find a book instead");
      link.href = mine ? `profile.html?u=${encodeURIComponent(mine)}` : "books.html";
      status.append(link, ".");
      return () => {};
    }
    const book = (slug, extra) => {
      const b = library[slug];
      const li = el("li", "mine__book");
      const img = el("img", "mine__cover");
      img.src = `image/covers/${slug}-180.webp`;
      img.alt = "";
      img.width = 90;
      img.height = 135;
      img.loading = "lazy";
      const text = el("div", "mine__book-text");
      const title = el("a", "mine__book-title", b.title);
      title.href = `book-${slug}.html`;
      text.append(title, el("p", "mine__book-author", b.author));
      extra?.(text);
      li.append(img, text);
      return li;
    };
    account.loadProfile(handle).then((data) => {
      if (closed) return;
      if (!data) {
        status.textContent = `There’s no reader page for @${handle}. It may be private, or the name may be spelt differently.`;
        page.querySelector("[data-profile-name]").textContent = "Not found";
        page.querySelector("[data-profile-about]").textContent = "This reader page isn’t shared, or doesn’t exist.";
        return;
      }
      status.hidden = true;
      document.title = `${data.name} (@${data.handle}) | The Bookshelf`;
      page.querySelector("[data-profile-avatar]").replaceChildren(account.avatar(data, "huge"));
      page.querySelector("[data-profile-name]").textContent = data.name;
      page.querySelector("[data-profile-about]").textContent = `@${data.handle} · Reader since ${month(data.since || Date.now())}`;
      const reading = (data.reading || []).filter((r) => library[r.book]);
      const finished = (data.finished || []).filter((r) => library[r.book]);
      const lines = (data.lines || []).filter((r) => library[r.book]);
      $("[data-profile-stats]").hidden = false;
      $("[data-profile-stat=finished]").textContent = String(finished.length);
      $("[data-profile-stat=reading]").textContent = String(reading.length);
      $("[data-profile-stat=time]").textContent = duration(data.seconds || 0);
      $("[data-profile-reading]").hidden = !reading.length;
      $("[data-profile-reading-list]").replaceChildren(...reading.map((r) => book(r.book, (text) => {
        const bar = el("span", "mine__progress");
        const fill = el("span");
        fill.style.transform = `scaleX(${(r.percent || 0) / 100})`;
        bar.append(fill);
        bar.setAttribute("role", "progressbar");
        bar.setAttribute("aria-valuenow", String(r.percent || 0));
        bar.setAttribute("aria-valuemin", "0");
        bar.setAttribute("aria-valuemax", "100");
        bar.setAttribute("aria-label", "How far they are");
        text.append(bar, el("p", "mine__meta", `${r.percent || 0}% read`));
      })));
      $("[data-profile-finished]").hidden = !finished.length;
      $("[data-profile-finished-list]").replaceChildren(...finished.map((r) => book(r.book, (text) => {
        if (r.at) text.append(el("p", "mine__meta", `Finished in ${month(r.at)}`));
      })));
      $("[data-profile-lines]").hidden = !lines.length;
      $("[data-profile-lines-list]").replaceChildren(...lines.map((line) => {
        const li = el("li", "line");
        li.append(el("blockquote", "line__text", `“${line.text}”`));
        const from = el("p", "line__from");
        const link = el("a", null, library[line.book].title);
        link.href = `book-${line.book}.html`;
        from.append(link, `, ${library[line.book].author}`);
        li.append(from);
        return li;
      }));
      if (!reading.length && !finished.length && !lines.length) {
        status.hidden = false;
        status.textContent = `${data.name} hasn’t started a book here yet.`;
      }
      const report = $("[data-profile-report]");
      report.href = `https://github.com/Cl0ud-9/Book-Website/issues/new?title=${encodeURIComponent(`Reader page report: @${data.handle}`)}&body=${encodeURIComponent("What's wrong with this reader page?\n\n")}`;
      report.target = "_blank";
      report.rel = "noopener";
      const mine = account.current().profile?.handle === data.handle;
      const own = $("[data-profile-mine]");
      own.textContent = mine ? "Change what your page shows" : "Make your own reader page";
      own.href = mine || account.current().state === "in" ? "account.html" : "signup.html";
      $("[data-profile-foot]").hidden = false;
    }).catch(() => {
      if (!closed) status.textContent = "This reader page didn’t load. Check your connection, then try again.";
    });
    return () => { closed = true; };
  }

  window.BookshelfAccountPage = {
    init(root, library) {
      if (root.hasAttribute("data-profile-page")) return profilePage(root, library);
      if (root.hasAttribute("data-auth-page")) return authPage(root, library);
      return accountPage(root, library);
    },
  };
})();

// loaded as a module (by main.ts or on demand)
export {};
