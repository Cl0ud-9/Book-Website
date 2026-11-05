/* Kids mode: on this device, a parent chooses an age and a PIN, and books for older readers are hidden everywhere until the
   PIN is given again. It is kept on the device and nothing about the child is collected or sent. The hiding itself is CSS
   (html[data-kids], set by the first script on every page, so nothing flashes past); the scripts ask allows() where they
   list books of their own. It is a guard rail for a family's device, not a lock: clearing the browser's data turns it off. */
(() => {
  "use strict";

  const KEY = "bookshelf:kids"; // { limit, salt, hash, tries, lockedUntil }
  const TRIES = 5;
  const LOCK = 5 * 60 * 1000;
  const NAMES = { 0: "young children", 10: "ages 10 and up", 13: "ages 13 and up" };
  const root = document.documentElement;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const write = (value) => { try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch { return false; } };
  const digest = async (pin, salt) => {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const limit = () => (root.dataset.kids === undefined ? null : Number(root.dataset.kids));

  /** Is a book for this age shown? (with Kids mode off, every book is) */
  const allows = (age) => { const most = limit(); return most === null || (Number(age) || 0) <= most; };

  const turnOn = async (most, pin) => {
    const salt = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (!write({ limit: most, salt, hash: await digest(pin, salt), tries: 0, lockedUntil: 0 })) return false;
    root.dataset.kids = String(most);
    return true;
  };

  /** @returns {Promise<{ok: boolean, wait?: number, left?: number}>} */
  const turnOff = async (pin) => {
    const kept = read();
    if (!kept) { delete root.dataset.kids; return { ok: true }; }
    if (kept.lockedUntil > Date.now()) return { ok: false, wait: Math.ceil((kept.lockedUntil - Date.now()) / 60000) };
    if (await digest(pin, kept.salt) === kept.hash) {
      try { localStorage.removeItem(KEY); } catch { /* it stays on */ }
      delete root.dataset.kids;
      return { ok: true };
    }
    const tries = (kept.tries || 0) + 1;
    const locked = tries >= TRIES;
    write({ ...kept, tries: locked ? 0 : tries, lockedUntil: locked ? Date.now() + LOCK : 0 });
    return locked ? { ok: false, wait: LOCK / 60000 } : { ok: false, left: TRIES - tries };
  };

  /** The controls on Your reading */
  const panel = (page) => {
    const box = page.querySelector("[data-kids-panel]");
    if (!box) return;
    const on = box.querySelector("[data-kids-on]");
    const off = box.querySelector("[data-kids-off]");
    const status = box.querySelector("[data-kids-status]");
    const say = (text) => { status.textContent = text; };
    const show = () => {
      const most = limit();
      on.hidden = most !== null;
      off.hidden = most === null;
      if (most !== null) box.querySelector("[data-kids-now]").textContent = NAMES[most] || "";
    };
    on.addEventListener("submit", async (event) => {
      event.preventDefault();
      const [first, again] = on.querySelectorAll("input");
      if (!/^\d{4}$/.test(first.value)) { say("The PIN needs to be four digits."); first.focus(); return; }
      if (first.value !== again.value) { say("Those two PINs are not the same."); again.focus(); return; }
      if (!await turnOn(Number(on.querySelector("select").value), first.value)) { say("This browser is not keeping data, so Kids mode cannot stay on."); return; }
      on.reset();
      show();
      say("Kids mode is on. Books for older readers are hidden on this device.");
    });
    off.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = off.querySelector("input");
      const result = await turnOff(input.value);
      input.value = "";
      if (result.ok) { show(); say("Kids mode is off."); }
      else if (result.wait) say(`Too many wrong tries. Try again in ${result.wait} ${result.wait === 1 ? "minute" : "minutes"}.`);
      else say(`That is not the PIN. ${result.left} ${result.left === 1 ? "try" : "tries"} left.`);
    });
    show();
  };

  window.BookshelfKids = { limit, allows, panel };
})();
