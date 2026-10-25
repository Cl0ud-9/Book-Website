/* The reader's highlights, underlines and notes, the meaning of a word, and opening a book at a given line. A plug-in
   for reader.js, loaded with it; notes are kept on this device by notes-store.js. */
(() => {
  "use strict";

  const COLOURS = {
    light: { yellow: "#ffd24a", green: "#69fe6f", blue: "#1ce8ed", pink: "#feb6fa" },
    night: { yellow: "#a88a1c", green: "#2f8a43", blue: "#1f8494", pink: "#9c4a98" },
  };
  const STYLES = ["yellow", "green", "blue", "pink", "underline"];
  const WIKTIONARY = "https://en.wiktionary.org/api/rest_v1/page/definition/";

  // Text compared loosely: curly quotes, dashes and runs of spaces do not matter
  // (and the invisible joiners Standard Ebooks puts around dashes)
  const INVISIBLE = /[⁠﻿​]/g; // word joiner, zero-width no-break space, zero-width space
  const loose = (text) => text.normalize("NFKC").replace(INVISIBLE, "").replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, "\"").replace(/[‐-―]/g, "-").replace(/\s+/g, " ");

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
    const shareButton = $("[data-select-share]");
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
      // epub.js draws an underline as a box round each line with a line under it: the colour goes on the line only
      // (src/styles/main.css), or every line was boxed
      if (note.style === "underline") return {};
      return { fill: COLOURS[night ? "night" : "light"][note.style] || COLOURS.light.yellow, "fill-opacity": night ? "0.5" : "0.42", "mix-blend-mode": night ? "screen" : "multiply" };
    };
    const marked = (note) => note.style === "bookmark";
    const draw = (note) => {
      if (lost.has(note.id) || marked(note)) return;
      // one class only: epub.js adds it as a single token
      try { ctx.rendition.annotations.add(typeOf(note), note.cfi, { id: note.id }, null, `note-${note.style}`, looks(note)); } catch { /* drawn when its chapter shows */ }
    };
    // both kinds, in case it was drawn as the other before a change of style
    const undraw = (note) => ["highlight", "underline"].forEach((type) => { try { ctx.rendition.annotations.remove(note.cfi, type); } catch { /* not drawn */ } });
    const drawAll = () => notes.forEach(draw);
    ctx.on("theme", () => { notes.forEach(undraw); drawAll(); });

    // A note is saved with its words and a few on either side as well as its place, because Standard Ebooks corrects
    // and republishes its editions: when the place no longer holds the same words, they are found again nearby.
    // the same words, however they are spaced (a saved note's spaces are tidied; the book has line breaks and invisible
    // joiners between some words, and a joiner once saved as a space made the note look lost)
    const sameWords = (a, b) => loose(a).replace(/\s+/g, "") === loose(b).replace(/\s+/g, "");
    const check = (section, view) => {
      const doc = view?.contents?.document;
      if (!doc || !section) return;
      notes.filter((n) => n.cfi.includes(`${section.cfiBase}!`)).forEach((note) => {
        let ok = false;
        try { ok = sameWords(view.contents.range(note.cfi).toString(), note.text); } catch { ok = false; }
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
      // Scrolling with words still selected keeps the bar (a phone scrolls a little as a selection's handle is dragged)
      rendition.on("relocated", () => { if (!stillSelected()) hideBar(); else if (picked && !docked()) place(picked.contents.window.getSelection().getRangeAt(0), picked.contents); });
      // Tapping elsewhere drops the selection, and the bar goes with it
      rendition.hooks.content.register((contents) => {
        contents.document.addEventListener("selectionchange", () => {
          if (picked?.contents === contents && !stillSelected()) setTimeout(() => { if (picked && !stillSelected()) hideBar(); }, 300);
        });
      });
      drawAll();
    });

    /* ---------- The bar over a selection ---------- */

    // Touch screens: the bar sits across the top, over the reader's own bar. Floating by the words it covered them and the
    // handles that stretch a selection, and it fought the phone's own Copy menu (just above a selection) and Google's
    // search panel (along the bottom) for the same space.
    const docked = () => matchMedia("(pointer: coarse)").matches;
    const stillSelected = () => {
      try { const sel = picked?.contents?.window.getSelection(); return Boolean(sel && !sel.isCollapsed && sel.rangeCount); } catch { return false; }
    };
    const place = (range, contents) => {
      bar.classList.toggle("is--docked", docked());
      if (docked()) {
        bar.hidden = false;
        bar.style.left = "";
        bar.style.top = "";
        return;
      }
      const frame = contents.window.frameElement?.getBoundingClientRect();
      const r = range.getBoundingClientRect();
      if (!frame) return;
      bar.hidden = false;
      const w = bar.offsetWidth;
      const h = bar.offsetHeight;
      const x = Math.min(Math.max(8, frame.left + r.left + r.width / 2 - w / 2), innerWidth - w - 8);
      const below = frame.top + r.top - h - 12 < 64;
      // kept on screen even when the selection runs past an edge of it (a long one, or one scrolled half away)
      const y = Math.min(Math.max(below ? frame.top + r.bottom + 12 : frame.top + r.top - h - 12, 64), innerHeight - h - 8);
      bar.style.left = `${x}px`;
      bar.style.top = `${y}px`;
    };
    const showBar = (range, contents, existing) => {
      deleteButton.hidden = !existing;
      const text = (existing ? existing.text : range.toString()).replace(/\s+/g, " ").trim();
      const words = text.split(" ");
      defineButton.hidden = words.length > 3 || !/\p{L}/u.test(words.join(""));
      // marked words show their mark, and what pressing it again does
      const mark = existing || overlapping(contents, range)[0] || null;
      bar.querySelectorAll("[data-style]").forEach((b) => b.setAttribute("aria-pressed", String(mark?.style === b.dataset.style)));
      $("[data-select-title]").textContent = existing ? "Your mark" : mark ? "Change the mark" : "Highlight";
      const hasNote = Boolean((existing || mark)?.note);
      $("[data-select-note-label]").textContent = hasNote ? "Edit note" : "Note";
      $("[data-select-note]").title = hasNote ? "Edit the note" : "Add a note";
      // Share makes a picture of the words (app.js)
      Object.assign(shareButton.dataset, { quote: `“${text.length > 420 ? `${text.slice(0, 420).replace(/\s\S*$/, "")}…` : text}”`,
        quoteBook: info.title, quoteAuthor: info.author, quoteColour: info.colour || "yellow" });
      const wasHidden = bar.hidden;
      place(range, contents);
      if (!wasHidden) return; // a selection being stretched: the bar stays as it is
      if (docked()) ctx.gsap?.fromTo(bar, { yPercent: -100 }, { yPercent: 0, duration: 0.35, ease: "expo.out", clearProps: "transform" });
      else ctx.gsap?.fromTo(bar, { opacity: 0, y: 6, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(2)", clearProps: "transform,opacity" });
    };
    function hideBar() {
      bar.hidden = true;
      picked = null;
      active = null;
    }
    // The words of a range, and a few on either side to find them again by
    const describe = (range, contents) => {
      const doc = contents.document;
      const before = doc.createRange();
      before.setStart(doc.body, 0);
      before.setEnd(range.startContainer, range.startOffset);
      const after = doc.createRange();
      after.setStart(range.endContainer, range.endOffset);
      after.setEnd(doc.body, doc.body.childNodes.length);
      const tidy = (text) => text.replace(INVISIBLE, "").replace(/\s+/g, " ");
      return { text: tidy(range.toString()).trim(), prefix: tidy(before.toString()).slice(-40), suffix: tidy(after.toString()).slice(0, 40) };
    };
    function onSelected(cfi, contents) {
      const selection = contents.window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const words = describe(range, contents);
      if (!words.text) return;
      picked = { cfi, ...words, contents, range: range.cloneRange() };
      active = null;
      showBar(range, contents, null);
    }
    // Marks in the same chapter whose words share any with a range
    const rangeIn = (contents, cfi) => { try { return contents.range(cfi); } catch { return null; } };
    const overlapping = (contents, range) => notes.filter((n) => {
      if (lost.has(n.id) || marked(n) || !contents?.cfiBase || !n.cfi.includes(`${contents.cfiBase}!`)) return false;
      const other = rangeIn(contents, n.cfi);
      return other && range.compareBoundaryPoints(Range.END_TO_START, other) < 0 && range.compareBoundaryPoints(Range.START_TO_END, other) > 0;
    });
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
      say(marked(note) ? "Bookmark removed" : note.note ? "Note removed" : "Highlight removed", async () => {
        const back = await store.put(note);
        notes.push(back);
        draw(back);
        render();
      });
    };
    const chapterAt = (contents) => ctx.chapterOf(book.spine.get(contents?.sectionIndex)?.href || ctx.current?.start.href || "");
    const percentAt = (cfi) => { try { return book.locations.length() ? book.locations.percentageFromCfi(cfi) : null; } catch { return null; } };

    // Marking words that are already marked changes that mark, or, where the words reach past it or across several,
    // joins them into one (keeping their notes): the same words are never marked twice, which drew a second line or
    // wash over the first that Remove then could not take away.
    const create = async (style) => {
      const { contents, range } = picked;
      const under = overlapping(contents, range);
      const now = Date.now();
      if (under.length === 1 && loose(under[0].text) === loose(picked.text)) {
        const same = under[0];
        if (same.style !== style) await restyle(same, style);
        return { note: same, joined: [], changed: true };
      }
      let cfi = picked.cfi;
      let words = picked;
      if (under.length) {
        const whole = range.cloneRange();
        under.forEach((n) => {
          const other = rangeIn(contents, n.cfi);
          if (other.compareBoundaryPoints(Range.START_TO_START, whole) < 0) whole.setStart(other.startContainer, other.startOffset);
          if (other.compareBoundaryPoints(Range.END_TO_END, whole) > 0) whole.setEnd(other.endContainer, other.endOffset);
        });
        cfi = contents.cfiFromRange(whole);
        words = describe(whole, contents);
      }
      const note = { id: store.id(), book: slug, cfi, text: words.text, prefix: words.prefix, suffix: words.suffix, style,
        note: under.map((n) => n.note).filter(Boolean).join("\n\n"), chapter: chapterAt(contents), percent: percentAt(cfi),
        created: Math.min(now, ...under.map((n) => n.created || now)), updated: now };
      for (const old of under) {
        undraw(old);
        await store.remove(old.id);
      }
      notes = notes.filter((n) => !under.includes(n));
      const saved = await store.put(note);
      notes.push(saved);
      draw(saved);
      render();
      return { note: saved, joined: under, changed: false };
    };
    // Taking back a mark just made, and the marks it joined
    const unmake = async ({ note, joined }) => {
      undraw(note);
      await store.remove(note.id);
      notes = notes.filter((n) => n.id !== note.id);
      for (const old of joined) {
        const back = await store.put(old);
        notes.push(back);
        draw(back);
      }
      render();
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
        if (active) {
          if (active.style !== style) { await restyle(active, style); say(style === "underline" ? "Changed to an underline" : "Colour changed"); }
        } else if (picked) {
          const before = overlapping(picked.contents, picked.range).find((n) => loose(n.text) === loose(picked.text))?.style;
          const made = await create(style);
          const what = style === "underline" ? "Underlined" : "Highlighted";
          if (made.changed) say(before === style ? `Already ${what.toLowerCase()}` : style === "underline" ? "Changed to an underline" : "Colour changed");
          else say(made.joined.length ? `${what}, joined with the marks beside it` : what, () => unmake(made));
        }
        clearSelection();
        hideBar();
      } else if (button.hasAttribute("data-select-note")) {
        const note = active || (picked && (overlapping(picked.contents, picked.range).find((n) => loose(n.text) === loose(picked.text)) || (await create("yellow")).note));
        clearSelection();
        hideBar();
        if (note) openEditor(note);
      } else if (button.hasAttribute("data-select-share")) {
        // app.js makes the picture from the words set on the button; the bar goes once it has them
        setTimeout(() => { clearSelection(); hideBar(); }, 0);
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

    const bookmarkList = $("[data-bookmarks-list]");
    const bookmarksHead = $("[data-bookmarks-head]");
    const notesHead = $("[data-notes-head]");
    function render() {
      list.innerHTML = "";
      bookmarkList.innerHTML = "";
      const marks = notes.filter(marked);
      const words = notes.filter((n) => !marked(n));
      empty.hidden = notes.length > 0;
      exportButton.hidden = words.length === 0;
      bookmarksHead.hidden = marks.length === 0;
      notesHead.hidden = marks.length === 0 || words.length === 0;
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
        quote.textContent = marked(note) ? `${note.text}…` : `“${note.text}”`;
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
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "reader__note-act";
        remove.setAttribute("aria-label", marked(note) ? "Remove the bookmark" : "Remove");
        remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>';
        remove.addEventListener("click", () => removeNote(note));
        if (marked(note)) {
          li.append(open, remove);
          li.classList.add("is--bookmark");
          bookmarkList.append(li);
          return;
        }
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "reader__note-act";
        edit.setAttribute("aria-label", note.note ? "Edit the note" : "Add a note");
        edit.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-pencil"></use></svg>';
        edit.addEventListener("click", () => openEditor(note));
        li.append(open, edit, remove);
        list.append(li);
      });
      showMark();
    }

    /* ---------- Bookmarks ---------- */

    // A bookmark keeps the opening words of its page (so, like a highlight, it is found again in a corrected edition).
    // The page you are on is marked when a bookmark's words begin on it: the button fills, and a ribbon hangs from the
    // top of the page.
    const bookmarkButton = $("[data-reader-bookmark]");
    const bookmarkLabel = $("[data-reader-bookmark-label]");
    const ribbon = $("[data-reader-ribbon]");
    const CFI = window.ePub?.CFI;
    const onPage = (note) => {
      const at = ctx.current;
      if (!at?.start?.cfi || !at.end?.cfi || !CFI) return false;
      try {
        const cfi = new CFI();
        return cfi.compare(note.cfi, at.start.cfi) >= 0 && cfi.compare(note.cfi, at.end.cfi) <= 0;
      } catch { return false; }
    };
    let ribbonShown = false;
    function showMark() {
      if (!bookmarkButton) return;
      const on = notes.some((n) => marked(n) && !lost.has(n.id) && onPage(n));
      bookmarkButton.setAttribute("aria-pressed", String(on));
      bookmarkButton.setAttribute("aria-label", on ? "Remove the bookmark from this page" : "Bookmark this page");
      bookmarkLabel.textContent = on ? "Marked" : "Bookmark";
      const hang = on && ctx.layout !== "scroll";
      if (hang === ribbonShown) return;
      ribbonShown = hang;
      if (hang) {
        ribbon.hidden = false;
        ctx.gsap?.fromTo(ribbon, { scaleY: 0 }, { scaleY: 1, duration: 0.55, ease: "back.out(1.6)", transformOrigin: "50% 0%", clearProps: "transform" });
      } else if (ctx.gsap && !ribbon.hidden) {
        ctx.gsap.to(ribbon, { scaleY: 0, duration: 0.25, ease: "power2.in", transformOrigin: "50% 0%", onComplete: () => { ribbon.hidden = !ribbonShown; ctx.gsap.set(ribbon, { clearProps: "transform" }); } });
      } else ribbon.hidden = true;
    }
    // the opening words of the page on screen (up to a short line of them), from its first letter
    const pageOpening = () => {
      const start = ctx.current?.start?.cfi;
      const contents = ctx.rendition?.getContents().find((c) => start?.includes(`${c.cfiBase}!`));
      const begin = contents && rangeIn(contents, start);
      if (!begin) return null;
      const doc = contents.document;
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      let text = begin.startContainer;
      let from = begin.startOffset;
      if (text.nodeType !== 3) {
        walker.currentNode = text.childNodes[from] || text;
        text = walker.currentNode.nodeType === 3 ? walker.currentNode : walker.nextNode();
        from = 0;
      } else walker.currentNode = text;
      const range = doc.createRange();
      let started = false;
      let taken = 0;
      while (text && taken < 120) {
        const data = text.data;
        let i = from;
        if (!started) {
          const first = data.slice(from).search(/\S/);
          if (first < 0) { text = walker.nextNode(); from = 0; continue; }
          i = from + first;
          range.setStart(text, i);
          started = true;
        }
        const room = 120 - taken;
        let end = Math.min(data.length, i + room);
        if (end < data.length) {
          const space = data.lastIndexOf(" ", end);
          if (space > i) end = space;
        }
        range.setEnd(text, end);
        taken += end - i;
        if (end < data.length) break;
        text = walker.nextNode();
        from = 0;
      }
      return started && range.toString().trim() ? { range, contents } : null;
    };
    const toggleBookmark = async () => {
      if (!ctx.current) return;
      const here = notes.filter((n) => marked(n) && onPage(n));
      if (here.length) {
        for (const n of here) await store.remove(n.id);
        notes = notes.filter((n) => !here.includes(n));
        render();
        say("Bookmark removed", async () => {
          for (const n of here) notes.push(await store.put(n));
          render();
        });
        return;
      }
      const opening = pageOpening();
      if (!opening) return;
      const { range, contents } = opening;
      const words = describe(range, contents);
      const cfi = contents.cfiFromRange(range);
      const now = Date.now();
      const note = await store.put({ id: store.id(), book: slug, cfi, text: words.text, prefix: words.prefix, suffix: words.suffix, style: "bookmark",
        note: "", chapter: chapterAt(contents), percent: percentAt(cfi), created: now, updated: now });
      notes.push(note);
      render();
      say("Page bookmarked", async () => {
        await store.remove(note.id);
        notes = notes.filter((n) => n !== note);
        render();
      });
    };
    bookmarkButton?.addEventListener("click", toggleBookmark);
    ctx.on("relocated", showMark);
    exportButton.addEventListener("click", () => {
      const lines = [`# ${info.title}`, "", `${info.author}. Notes from The Bookshelf, ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.`, ""];
      let chapter = null;
      notes.filter((note) => !marked(note)).forEach((note) => {
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
    // a place found by searching the book, shown for a moment
    ctx.on("flash", flash);
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

    // The first book opened on a device says how to mark words, once
    const tip = $("[data-reader-tip]");
    const TIP = "bookshelf:tip-select";
    const seenTip = () => { try { return localStorage.getItem(TIP) === "1"; } catch { return true; } };
    const dismissTip = () => {
      if (tip.hidden) return;
      try { localStorage.setItem(TIP, "1"); } catch { /* shown again next time */ }
      if (ctx.gsap) ctx.gsap.to(tip, { opacity: 0, y: 12, duration: 0.25, ease: "power2.in", onComplete: () => { tip.hidden = true; ctx.gsap.set(tip, { clearProps: "opacity,transform" }); } });
      else tip.hidden = true;
    };
    $("[data-reader-tip-ok]").addEventListener("click", dismissTip);
    ctx.on("ready", () => {
      if (seenTip() || notes.length || closed) return;
      if (matchMedia("(pointer: coarse)").matches) $("[data-reader-tip-text]").textContent = "Press and hold a word to select it, then drag to choose more: highlight, add a note, look it up or share it as a picture.";
      setTimeout(() => {
        if (closed || seenTip()) return;
        tip.hidden = false;
        ctx.gsap?.fromTo(tip, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out", clearProps: "transform,opacity" });
      }, 1800);
    });
    ctx.onRendition((rendition) => rendition.on("selected", dismissTip));

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
      tip.hidden = true;
    };
  }

  (window.BookshelfReaderPlugins ||= []).push(plugin);
})();

// loaded as a module (by main.ts or on demand)
export {};
