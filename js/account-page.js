/* Your account (account.html) and readers' pages (profile.html?u=username). js/app.js loads this on those pages; the
   account itself (signing in, keeping your reading in step) is js/account.js, on every page. */
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

  /* ---------- Your account ---------- */

  function accountPage(root) {
    const account = window.BookshelfAccount;
    const $ = (sel) => root.querySelector(sel);
    const parts = { off: $("[data-acct-off]"), checking: $("[data-acct-checking]"), out: $("[data-acct-out]"), setup: $("[data-acct-setup]"), in: $("[data-acct-in]") };
    const show = (which) => Object.entries(parts).forEach(([name, node]) => { node.hidden = name !== which; });
    if (!account?.enabled) { show("off"); return () => {}; }

    let editing = false;
    let closed = false;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!closed) fn(); }, ms); timers.add(t); return t; };

    /* Signing in */
    const form = $("[data-acct-email]");
    const message = $("[data-acct-message]");
    const submit = $("[data-acct-submit]");
    let mode = "in";
    const setMode = (next) => {
      mode = next;
      root.querySelectorAll("[data-acct-mode]").forEach((tab) => {
        const on = tab.dataset.acctMode === mode;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on) form.setAttribute("aria-labelledby", tab.id);
      });
      $("[data-acct-out-title]").textContent = mode === "in" ? "Sign in" : "Create an account";
      submit.textContent = mode === "in" ? "Sign in" : "Create my account";
      form.elements.password.autocomplete = mode === "in" ? "current-password" : "new-password";
      $("[data-acct-password-hint]").hidden = mode === "in";
      $("[data-acct-forgot]").hidden = mode !== "in";
      message.textContent = "";
    };
    root.querySelectorAll("[data-acct-mode]").forEach((tab) => {
      tab.addEventListener("click", () => setMode(tab.dataset.acctMode));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const other = root.querySelector(`[data-acct-mode="${tab.dataset.acctMode === "in" ? "up" : "in"}"]`);
        setMode(other.dataset.acctMode);
        other.focus();
      });
    });
    const busy = (button, on, text) => {
      button.disabled = on;
      button.classList.toggle("is--busy", on);
      if (text != null) button.textContent = text;
    };
    const say = (node, text, good = false) => { node.textContent = text; node.classList.toggle("is--good", good); };

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
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!EMAIL.test(email)) { say(message, "Enter an email address, like reader@example.com."); form.elements.email.focus(); return; }
      if (!password) { say(message, "Enter your password."); form.elements.password.focus(); return; }
      if (mode === "up" && password.length < 8) { say(message, "Use at least 8 characters for your password."); form.elements.password.focus(); return; }
      const label = submit.textContent;
      busy(submit, true, mode === "in" ? "Signing in…" : "Creating your account…");
      say(message, "");
      try {
        if (mode === "in") await account.signIn(email, password); else await account.signUp(email, password);
      } catch (error) {
        say(message, account.explain(error));
      }
      busy(submit, false, label);
    });
    $("[data-acct-forgot]").addEventListener("click", async () => {
      const email = form.elements.email.value.trim();
      if (!EMAIL.test(email)) { say(message, "Enter your email address above, then press Forgot your password again."); form.elements.email.focus(); return; }
      try {
        await account.resetPassword(email);
        say(message, `If there’s an account for ${email}, we’ve emailed it a link to choose a new password.`, true);
      } catch (error) {
        say(message, error?.code === "auth/user-not-found" ? `If there’s an account for ${email}, we’ve emailed it a link to choose a new password.` : account.explain(error), error?.code === "auth/user-not-found");
      }
    });

    /* Your name and mark */
    const setup = parts.setup;
    const nameInput = setup.elements.name;
    const handleInput = setup.elements.handle;
    const nameNote = $("[data-acct-name-note]");
    const handleNote = $("[data-acct-handle-note]");
    const setupMessage = $("[data-acct-setup-message]");
    const previewAvatar = $("[data-acct-preview-avatar]");
    let handleCheck = 0;
    let handleOk = false;
    const picked = (name) => setup.querySelector(`input[name="${name}"]:checked`)?.value;
    const preview = () => {
      previewAvatar.replaceChildren(account.avatar({ colour: picked("colour"), mark: picked("mark") }, "large"));
      $("[data-acct-preview-name]").textContent = nameInput.value.trim() || "Your name";
      $("[data-acct-preview-handle]").textContent = `@${handleInput.value || "username"}`;
    };
    const checkHandle = () => {
      const value = handleInput.value;
      const problem = account.checkHandle(value);
      handleOk = false;
      handleNote.classList.remove("is--good", "is--bad");
      if (problem) {
        handleNote.textContent = value ? problem : "3 to 20 small letters, numbers or _";
        if (value) handleNote.classList.add("is--bad");
        handleInput.setAttribute("aria-invalid", String(Boolean(value)));
        return;
      }
      const mine = account.current().profile?.handle;
      if (value === mine) { handleOk = true; handleNote.textContent = "That’s yours."; handleNote.classList.add("is--good"); handleInput.setAttribute("aria-invalid", "false"); return; }
      handleNote.textContent = "Checking…";
      const ticket = ++handleCheck;
      clearTimeout(checkHandle.timer);
      checkHandle.timer = later(async () => {
        try {
          const free = await account.handleFree(value);
          if (ticket !== handleCheck) return;
          handleOk = free;
          handleNote.textContent = free ? `@${value} is free.` : `@${value} is taken. Try another.`;
          handleNote.classList.add(free ? "is--good" : "is--bad");
          handleInput.setAttribute("aria-invalid", String(!free));
        } catch {
          if (ticket === handleCheck) handleNote.textContent = "Couldn’t check just now. It will be checked when you save.";
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
    const fillSetup = (profile) => {
      const s = profile.suggestion || {};
      nameInput.value = profile.name || s.name || "";
      handleInput.value = profile.handle || s.handle || "";
      const colour = profile.colour || account.COLOURS[Math.floor(Math.random() * account.COLOURS.length)];
      const mark = profile.mark || "book";
      setup.querySelector(`input[name="colour"][value="${colour}"]`).checked = true;
      setup.querySelector(`input[name="mark"][value="${mark}"]`).checked = true;
      $("[data-acct-setup-title]").textContent = profile.handle ? "Edit your name and mark" : "Make it yours";
      $("[data-acct-cancel]").hidden = !profile.handle;
      say(setupMessage, "");
      nameNote.textContent = "";
      preview();
      checkHandle();
    };
    setup.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = nameInput.value.trim().replace(/\s+/g, " ");
      const handle = handleInput.value;
      const problem = account.checkName(name) || account.checkHandle(handle);
      if (problem) { say(setupMessage, problem); (account.checkName(name) ? nameInput : handleInput).focus(); return; }
      const save = $("[data-acct-save]");
      busy(save, true);
      say(setupMessage, "Saving…");
      try {
        await account.saveProfile({ handle, name, colour: picked("colour"), mark: picked("mark") });
        editing = false;
        say(setupMessage, "");
        render(account.current());
      } catch (error) {
        say(setupMessage, error?.code === "taken" ? `@${handle} was just taken. Try another.` : error?.code === "invalid" ? error.message : account.explain(error));
      }
      busy(save, false);
    });
    $("[data-acct-cancel]").addEventListener("click", () => { editing = false; render(account.current()); });
    $("[data-acct-edit]").addEventListener("click", () => {
      editing = true;
      render(account.current());
      nameInput.focus();
    });

    /* Signed in */
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
        armed = later(() => { armed = 0; label.textContent = "Delete my account"; deleteButton.classList.remove("is--armed"); }, 6000);
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

    function render(now) {
      const { state, profile } = now;
      if (state === "checking") { show("checking"); return; }
      if (state === "out") { show("out"); return; }
      if (state === "setup" || editing) {
        const wasHidden = setup.hidden;
        show("setup");
        if (wasHidden) fillSetup(profile);
        return;
      }
      show("in");
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
    const stop = account.subscribe((now) => { if (!closed) render(now); });
    account.start().then(() => { if (!closed) render(account.current()); }).catch(() => {
      show("out");
      say(message, "Accounts couldn’t load. Check your connection, then reload the page.");
    });
    // the "x min ago" line stays true while the page is open
    const tick = setInterval(() => { if (!parts.in.hidden) render(account.current()); }, 30000);
    return () => { closed = true; stop(); clearInterval(tick); timers.forEach(clearTimeout); };
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
      $("[data-profile-mine]").textContent = account.current().profile?.handle === data.handle ? "Change what your page shows" : "Make your own reader page";
      $("[data-profile-foot]").hidden = false;
    }).catch(() => {
      if (!closed) status.textContent = "This reader page didn’t load. Check your connection, then try again.";
    });
    return () => { closed = true; };
  }

  window.BookshelfAccountPage = {
    init(root, library) {
      return root.hasAttribute("data-profile-page") ? profilePage(root, library) : accountPage(root, library);
    },
  };
})();
