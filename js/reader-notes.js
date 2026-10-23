/* The reader's highlights, underlines and notes, the meaning of a word, and opening a book at a given line. A plug-in
   for js/reader.js, loaded with it; notes are kept on this device by js/notes-store.js. */
(() => {
  "use strict";

  const COLOURS = {
    light: { yellow: "#ffd24a", green: "#69fe6f", blue: "#1ce8ed", pink: "#feb6fa" },
    night: { yellow: "#a88a1c", green: "#2f8a43", blue: "#1f8494", pink: "#9c4a98" },
  };
  const STYLES = ["yellow", "green", "blue", "pink", "underline"];
  const WIKTIONARY = "https://en.wiktionary.org/api/rest_v1/page/definition/";

  // Text compared loosely: curly quotes, dashes and runs of spaces do not matter
  const loose = (text) => text.normalize("NFKC").replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, "\"").replace(/[‐-―]/g, "-").replace(/\s+/g, " ");

  // A Range over the words `want` in a document, choosing the copy whose neighbours best match prefix and suffix
  function rangeOf(doc, want, prefix = "", suffix = "") {
    const nodes = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let flat = "";
    const map = []; // flat index -> [node, offset]
    let lastSpace = true;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push(node);
      const raw = node.nodeValue;
      for (let i = 0; i < raw.length; i += 1) {
        const ch = loose(raw[i]);
        if (ch === " ") { if (lastSpace) continue; lastSpace = true; } else lastSpace = false;
        flat += ch;
        map.push([node, i]);
      }
    }
    const target = loose(want).trim();
    if (!target) return null;
    const before = loose(prefix).trim().slice(-24);
    const after = loose(suffix).trim().slice(0, 24);
    let best = -1;
    let bestScore = -1;
    for (let at = flat.indexOf(target); at >= 0; at = flat.indexOf(target, at + 1)) {
      const score = (before && flat.slice(Math.max(0, at - 40), at).includes(before) ? 2 : 0)
        + (after && flat.slice(at + target.length, at + target.length + 40).includes(after) ? 2 : 0);
      if (score > bestScore) { best = at; bestScore = score; }
      if (score === 4) break;
    }
    if (best < 0) return null;
    const [startNode, startOffset] = map[best];
    const [endNode, endOffset] = map[best + target.length - 1];
    const range = doc.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset + 1);
    return range;
  }

  function plugin(ctx) {
    const { root, slug, info, book } = ctx;
    const store = window.BookshelfNotes;
    if (!store) return null;
    const $ = (sel) => root.querySelector(sel);
    const bar = $("[data-select-bar]");
    const editor = $("[data-note-editor]");
    const define = $("[data-define]");
    const toast = $("[data-reader-toast]");
    const list = $("[data-notes-list]");
    const empty = $("[data-notes-empty]");
    const exportButton = $("[data-notes-export]");
    const deleteButton = $("[data-select-delete]");
    const defineButton = $("[data-select-define]");
    $("[data-notes-warning]").hidden = true;

    let notes = [];
    let picked = null; // a new selection: { cfi, text, prefix, suffix, contents }
    let active = null; // the note whose highlight was tapped
    let closed = false;
    const lost = new Set(); // notes whose words are no longer in this edition
    ctx.selecting = () => !bar.hidden;

    /* ---------- Drawing ---------- */

    const typeOf = (note) => (note.style === "underline" ? "underline" : "highlight");
    const looks = (note) => {
      const night = ctx.theme === "night";
      if (note.style === "underline") return { stroke: night ? "#e4dfd2" : "#1d1b16", "stroke-opacity": "0.85", "stroke-width": "1.5" };
      return { fill: COLOURS[night ? "night" : "light"][note.style] || COLOURS.light.yellow, "fill-opacity": night ? "0.5" : "0.42", "mix-blend-mode": night ? "screen" : "multiply" };
    };
    const draw = (note) => {
      if (lost.has(note.id)) return;
      // one class only: epub.js adds it as a single token
      try { ctx.rendition.annotations.add(typeOf(note), note.cfi, { id: note.id }, null, `note-${note.style}`, looks(note)); } catch { /* drawn when its chapter shows */ }
    };
    const undraw = (note) => { try { ctx.rendition.annotations.remove(note.cfi, typeOf(note)); } catch { /* not drawn */ } };
    const drawAll = () => notes.forEach(draw);
    ctx.on("theme", () => { notes.forEach(undraw); drawAll(); });

    // A note is saved with its words and a few on either side as well as its place, because Standard Ebooks corrects
    // and republishes its editions: when the place no longer holds the same words, they are found again nearby.
    const check = (section, view) => {
      const doc = view?.contents?.document;
      if (!doc || !section) return;
      notes.filter((n) => n.cfi.includes(`${section.cfiBase}!`)).forEach((note) => {
        let ok = false;
        try { ok = loose(view.contents.range(note.cfi).toString()).trim() === loose(note.text).trim(); } catch { ok = false; }
        if (ok) { lost.delete(note.id); return; }
        const range = rangeOf(doc, note.text, note.prefix, note.suffix);
        undraw(note);
        if (!range) { lost.add(note.id); render(); return; }
        lost.delete(note.id);
        note.cfi = section.cfiFromRange(range);
        store.put(note).then(() => { draw(note); render(); });
      });
    };

    ctx.onRendition((rendition) => {
      rendition.on("selected", onSelected);
      rendition.on("markClicked", (cfi, data) => { const note = notes.find((n) => n.id === data?.id); if (note) openNote(note, cfi); });
      rendition.on("rendered", check);
      rendition.on("relocated", () => hideBar());
      drawAll();
    });

    /* ---------- The bar over a selection ---------- */

    const place = (range, contents) => {
      const frame = contents.window.frameElement?.getBoundingClientRect();
      const r = range.getBoundingClientRect();
      if (!frame) return;
      bar.hidden = false;
      const w = bar.offsetWidth;
      const h = bar.offsetHeight;
      const x = Math.min(Math.max(8, frame.left + r.left + r.width / 2 - w / 2), innerWidth - w - 8);
      // phones show their own copy menu above a selection, so ours goes below
      const below = matchMedia("(pointer: coarse)").matches || frame.top + r.top - h - 12 < 64;
      // kept on screen even when the selection runs past an edge of it (a long one, or one scrolled half away)
      const y = Math.min(Math.max(below ? frame.top + r.bottom + 12 : frame.top + r.top - h - 12, 64), innerHeight - h - 8);
      bar.style.left = `${x}px`;
      bar.style.top = `${y}px`;
    };
    const showBar = (range, contents, existing) => {
      deleteButton.hidden = !existing;
      const words = (existing ? existing.text : range.toString()).trim().split(/\s+/);
      defineButton.hidden = words.length > 3 || !/\p{L}/u.test(words.join(""));
      bar.querySelectorAll("[data-style]").forEach((b) => b.setAttribute("aria-pressed", String(existing?.style === b.dataset.style)));
      place(range, contents);
      ctx.gsap?.fromTo(bar, { opacity: 0, y: 6, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(2)", clearProps: "transform,opacity" });
    };
    function hideBar() {
      bar.hidden = true;
      picked = null;
      active = null;
    }
    function onSelected(cfi, contents) {
      const selection = contents.window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const text = selection.toString().replace(/\s+/g, " ").trim();
      if (!text) return;
      const doc = contents.document;
      const before = doc.createRange();
      before.setStart(doc.body, 0);
      before.setEnd(range.startContainer, range.startOffset);
      const after = doc.createRange();
      after.setStart(range.endContainer, range.endOffset);
      after.setEnd(doc.body, doc.body.childNodes.length);
      picked = { cfi, text, prefix: before.toString().replace(/\s+/g, " ").slice(-40), suffix: after.toString().replace(/\s+/g, " ").slice(0, 40), contents };
      active = null;
      showBar(range, contents, null);
    }
    function openNote(note, cfi) {
      active = note;
      picked = null;
      const view = ctx.rendition.manager?.views?.all?.().find((v) => cfi.includes(`${v.section.cfiBase}!`));
      try { const range = view.contents.range(cfi); showBar(range, view.contents, note); } catch { openEditor(note); }
    }

    const clearSelection = () => { try { picked?.contents?.window.getSelection().removeAllRanges(); } catch { /* gone */ } };
    // A short message; with undo, a button to take back what was just done (a removed highlight comes back)
    const toastText = toast.querySelector("[data-toast-text]");
    const toastUndo = toast.querySelector("[data-toast-undo]");
    let undoing = null;
    toastUndo.addEventListener("click", () => { const fn = undoing; undoing = null; toast.hidden = true; fn?.(); });
    const say = (text, undo) => {
      toastText.textContent = text;
      undoing = undo || null;
      toastUndo.hidden = !undo;
      toast.hidden = false;
      clearTimeout(say.timer);
      say.timer = setTimeout(() => { toast.hidden = true; undoing = null; }, undo ? 6000 : 2200);
    };
    const removeNote = async (note) => {
      undraw(note);
      await store.remove(note.id);
      notes = notes.filter((n) => n !== note);
      render();
      say(note.note ? "Note removed" : "Highlight removed", async () => {
        const back = await store.put(note);
        notes.push(back);
        draw(back);
        render();
      });
    };
    const chapterAt = (contents) => ctx.chapterOf(book.spine.get(contents?.sectionIndex)?.href || ctx.current?.start.href || "");
    const percentAt = (cfi) => { try { return book.locations.length() ? book.locations.percentageFromCfi(cfi) : null; } catch { return null; } };

    const create = async (style) => {
      const now = Date.now();
      const note = { id: store.id(), book: slug, cfi: picked.cfi, text: picked.text, prefix: picked.prefix, suffix: picked.suffix,
        style, note: "", chapter: chapterAt(picked.contents), percent: percentAt(picked.cfi), created: now, updated: now };
      const saved = await store.put(note);
      notes.push(saved);
      draw(saved);
      render();
      return saved;
    };
    const restyle = async (note, style) => {
      undraw(note);
      note.style = style;
      await store.put(note);
      draw(note);
      render();
    };

    bar.addEventListener("pointerdown", (event) => event.preventDefault()); // keep the words selected
    bar.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const style = button.dataset.style;
      if (style) {
        if (active) await restyle(active, style);
        else if (picked) { await create(style); say(style === "underline" ? "Underlined" : "Highlighted"); }
        clearSelection();
        hideBar();
      } else if (button.hasAttribute("data-select-note")) {
        const note = active || (picked && await create("yellow"));
        clearSelection();
        hideBar();
        if (note) openEditor(note);
      } else if (button.hasAttribute("data-select-define")) {
        const word = (active?.text || picked?.text || "").trim();
        clearSelection();
        hideBar();
        lookUp(word);
      } else if (button.hasAttribute("data-select-copy")) {
        const text = active?.text || picked?.text || "";
        try { await navigator.clipboard.writeText(`“${text}”\n${info.title}, ${info.author}`); say("Copied"); } catch { say("Copying is not allowed here"); }
        clearSelection();
        hideBar();
      } else if (button.hasAttribute("data-select-delete") && active) {
        const note = active;
        hideBar();
        await removeNote(note);
      }
    });

    /* ---------- A note's own words ---------- */

    const noteText = $("[data-note-text]");
    let editing = null;
    function openEditor(note) {
      editing = note;
      $("[data-note-quote]").textContent = `“${note.text.length > 220 ? `${note.text.slice(0, 220)}…` : note.text}”`;
      noteText.value = note.note || "";
      editor.hidden = false;
      noteText.focus();
    }
    const closeEditor = () => { editor.hidden = true; editing = null; };
    $("[data-note-cancel]").addEventListener("click", closeEditor);
    $("[data-note-save]").addEventListener("click", async () => {
      if (!editing) return;
      editing.note = noteText.value.trim();
      await store.put(editing);
      render();
      closeEditor();
      say("Note saved");
    });
    noteText.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) $("[data-note-save]").click();
      if (event.key === "Escape") closeEditor();
    });

    /* ---------- The Notes panel ---------- */

    function render() {
      list.innerHTML = "";
      empty.hidden = notes.length > 0;
      exportButton.hidden = notes.length === 0;
      notes.sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0) || a.created - b.created).forEach((note) => {
        const li = document.createElement("li");
        li.className = "reader__note";
        const open = document.createElement("button");
        open.type = "button";
        open.className = "reader__note-open";
        const mark = document.createElement("span");
        mark.className = `reader__note-mark is--${note.style}`;
        mark.setAttribute("aria-hidden", "true");
        const quote = document.createElement("span");
        quote.className = "reader__note-text";
        quote.textContent = `“${note.text}”`;
        const meta = document.createElement("span");
        meta.className = "reader__note-meta";
        meta.textContent = lost.has(note.id) ? "Not found in this edition of the book" : [note.chapter, note.percent != null ? `${Math.round(note.percent * 100)}%` : ""].filter(Boolean).join(" · ");
        open.append(mark, quote, meta);
        if (note.note) {
          const own = document.createElement("span");
          own.className = "reader__note-own";
          own.textContent = note.note;
          open.append(own);
        }
        open.addEventListener("click", () => { ctx.closePanels(); if (!lost.has(note.id)) ctx.jumpTo(note.cfi, note.chapter); });
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "reader__note-act";
        edit.setAttribute("aria-label", note.note ? "Edit the note" : "Add a note");
        edit.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-pencil"></use></svg>';
        edit.addEventListener("click", () => openEditor(note));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "reader__note-act";
        remove.setAttribute("aria-label", "Remove");
        remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>';
        remove.addEventListener("click", () => removeNote(note));
        li.append(open, edit, remove);
        list.append(li);
      });
    }
    exportButton.addEventListener("click", () => {
      const lines = [`# ${info.title}`, "", `${info.author}. Notes from The Bookshelf, ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.`, ""];
      let chapter = null;
      notes.forEach((note) => {
        if (note.chapter && note.chapter !== chapter) { chapter = note.chapter; lines.push(`## ${chapter}`, ""); }
        lines.push(`> ${note.text}`, "");
        if (note.note) lines.push(note.note, "");
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
      link.download = `${slug}-notes.md`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });

    /* ---------- What a word means (Wiktionary) ---------- */

    const meanings = new Map();
    const defineWord = $("[data-define-word]");
    const defineBody = $("[data-define-body]");
    const defineMore = $("[data-define-more]");
    const plainText = (html) => new DOMParser().parseFromString(html, "text/html").body.textContent.trim();
    async function fetchMeaning(word) {
      for (const tryWord of [word.toLowerCase(), word]) {
        if (meanings.has(tryWord)) return meanings.get(tryWord);
        const response = await fetch(WIKTIONARY + encodeURIComponent(tryWord), { headers: { "Api-User-Agent": "TheBookshelf (https://cl0ud-9.github.io/Book-Website/)" } });
        if (response.status === 404) continue;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const parts = (data.en || []).map((part) => ({
          kind: part.partOfSpeech,
          senses: part.definitions.map((d) => plainText(d.definition)).filter(Boolean).slice(0, 2),
        })).filter((part) => part.senses.length).slice(0, 3);
        meanings.set(tryWord, parts);
        if (parts.length) return parts;
      }
      return [];
    }
    async function lookUp(text) {
      const word = text.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
      if (!word) return;
      defineWord.textContent = word;
      defineBody.textContent = "Looking it up…";
      defineMore.href = `https://en.wiktionary.org/wiki/${encodeURIComponent(word.toLowerCase())}`;
      define.hidden = false;
      $("[data-define-close]").focus();
      try {
        const parts = await fetchMeaning(word);
        if (closed || define.hidden || defineWord.textContent !== word) return;
        defineBody.innerHTML = "";
        if (!parts.length) { defineBody.textContent = `No meaning found for “${word}”.`; return; }
        parts.forEach((part) => {
          const kind = document.createElement("p");
          kind.className = "reader__define-kind";
          kind.textContent = part.kind;
          const senses = document.createElement("ol");
          part.senses.forEach((s) => { const li = document.createElement("li"); li.textContent = s; senses.append(li); });
          defineBody.append(kind, senses);
        });
      } catch {
        defineBody.textContent = navigator.onLine === false ? "Meanings need a connection." : "The dictionary did not answer. Try again in a moment.";
      }
    }
    $("[data-define-close]").addEventListener("click", () => { define.hidden = true; });

    /* ---------- Opening the book at a line (?at=words&in=chapter file) or at a note (?note=id) ---------- */

    async function findText(text, file) {
      const sections = file && book.spine.get(file) ? [book.spine.get(file)] : book.spine.spineItems;
      for (const section of sections) {
        if (closed) return null;
        try {
          await section.load(book.load.bind(book));
          const range = rangeOf(section.document, text);
          if (range) return section.cfiFromRange(range);
        } catch { /* try the next chapter */ }
      }
      return null;
    }
    const flash = (cfi) => {
      try {
        ctx.rendition.annotations.add("highlight", cfi, {}, null, "note-flash", { fill: "#ff008c", "fill-opacity": "0.28", "mix-blend-mode": ctx.theme === "night" ? "screen" : "multiply" });
        setTimeout(() => { try { ctx.rendition.annotations.remove(cfi, "highlight"); drawAll(); } catch { /* gone */ } }, 3500);
      } catch { /* not drawn */ }
    };
    ctx.on("ready", async (params) => {
      const at = params.get("at");
      const noteId = params.get("note");
      if (at) {
        const cfi = await findText(at, params.get("in"));
        if (cfi && !closed) { await ctx.jumpTo(cfi, ctx.chapterOf(book.spine.get(cfi)?.href || "")); flash(cfi); } else if (!closed) say("That line wasn’t found in this edition.");
      } else if (noteId) {
        const note = notes.find((n) => n.id === noteId) || await store.get(noteId);
        if (note?.book === slug && !closed) await ctx.jumpTo(note.cfi, note.chapter);
      }
    });

    ctx.on("escape", () => { hideBar(); define.hidden = true; closeEditor(); });
    ctx.on("panel", () => { hideBar(); define.hidden = true; });

    store.forBook(slug).then((found) => {
      if (closed) return;
      notes = found;
      $("[data-notes-warning]").hidden = store.lasting;
      render();
      drawAll();
    });

    return () => {
      closed = true;
      clearTimeout(say.timer);
      hideBar();
      define.hidden = true;
      editor.hidden = true;
      toast.hidden = true;
    };
  }

  (window.BookshelfReaderPlugins ||= []).push(plugin);
})();
