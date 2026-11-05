/* Your next book: three quick questions (start.astro), and a shelf of picks worked out from the answers. All of it happens in
   your browser from taste.json, the shelf's genres, moods and lengths; the answers stay on this device and are never sent.
   Loaded only on the page that asks the questions, and on pages that show picks once you have answered. */
const KEY = "bookshelf:taste"; // { genres: { name: weight }, moods: { name: weight }, length, covers: [slug], at }
const SHOWN = 9;
const LENGTHS = { short: [0, 180], medium: [180, 480], long: [480, Infinity] };

const QUESTIONS = [
  { ask: "Where would you rather spend the evening?", answers: [
    ["In a haunted house", { genres: ["Horror"], moods: ["Eerie"] }],
    ["At a ballroom", { genres: ["Romance"], moods: ["Romantic"] }],
    ["On a desert island", { genres: ["Adventure"], moods: ["Adventurous"] }],
    ["In a detective’s study", { genres: ["Mystery"], moods: ["Gripping"] }],
    ["On another planet", { genres: ["Science fiction", "Fantasy"], moods: ["Adventurous"] }],
    ["With one very big idea", { genres: ["Philosophy", "Essays and letters"], moods: ["Thoughtful"] }],
  ] },
  { ask: "What should a book do to you?", answers: [
    ["Make me laugh", { moods: ["Funny"] }],
    ["Make me think", { genres: ["Literary fiction"], moods: ["Thoughtful"] }],
    ["Warm my heart", { genres: ["Children’s"], moods: ["Heartwarming"] }],
    ["Keep me up all night", { moods: ["Gripping"] }],
    ["Break my heart", { moods: ["Dark", "Romantic"] }],
  ] },
  { ask: "How long have you got?", answers: [
    ["An afternoon", { length: "short" }],
    ["A week or two", { length: "medium" }],
    ["A long journey", { length: "long" }],
    ["Surprise me", {}],
  ] },
];

const allows = (age) => window.BookshelfKids?.allows(age) !== false;
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

export const tasteOf = () => read(KEY);

const shelf = (() => {
  let asked = null;
  return () => {
    asked ||= fetch("taste.json").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    return asked;
  };
})();
const unpack = ({ genres, moods, books }) => books.map(([slug, title, author, g, m, minutes, age], rank) => ({
  slug, title, author, minutes, age, rank, genres: g.map((i) => genres[i]), moods: m.map((i) => moods[i]),
}));

/** The books for this taste, best first, with why each was chosen */
export function picksFor(books, taste, count = SHOWN) {
  const started = read("bookshelf:reading") || {};
  const [least, most] = LENGTHS[taste.length] || [0, Infinity];
  const scored = books.filter((b) => allows(b.age) && !started[b.slug] && !(taste.covers || []).includes(b.slug)).map((b) => {
    const genre = b.genres.filter((g) => taste.genres?.[g]).sort((x, y) => taste.genres[y] - taste.genres[x])[0];
    const mood = b.moods.filter((m) => taste.moods?.[m]).sort((x, y) => taste.moods[y] - taste.moods[x])[0];
    const fits = b.minutes >= least && b.minutes < most;
    const score = b.genres.reduce((sum, g) => sum + (taste.genres?.[g] || 0), 0) + b.moods.reduce((sum, m) => sum + (taste.moods?.[m] || 0), 0)
      + (taste.length && fits ? 2 : 0) - b.rank / 300; // the most read break a tie
    const why = [genre, mood?.toLowerCase()].filter(Boolean).join(", ");
    return { ...b, score, why };
  }).sort((a, b) => b.score - a.score);
  const authors = {};
  return scored.filter((b) => { authors[b.author] = (authors[b.author] || 0) + 1; return authors[b.author] <= 2; }).slice(0, count);
}

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

const pickCard = (b) => {
  const item = el("li");
  const link = el("a", "picked__book");
  link.href = `book-${b.slug}`;
  const img = Object.assign(el("img"), { src: `image/covers/${b.slug}-360.webp`, width: 360, height: 540, alt: "", loading: "lazy", decoding: "async" });
  link.append(img, el("span", "picked__title", b.title), el("span", "picked__author", b.author));
  if (b.why) link.append(el("span", "picked__why", b.why));
  item.append(link);
  return item;
};

/** A page's "Picked for you", once you have answered: it stays the invitation to answer until then */
export async function showPicks(root) {
  const taste = tasteOf();
  if (!taste) return;
  const picks = picksFor(unpack(await shelf()), taste);
  if (!picks.length) return;
  root.querySelector("[data-picked-title]").textContent = "Picked for you";
  root.querySelector("[data-picked-text]").textContent = "From your answers, worked out on this device. Change them any time.";
  root.querySelector("[data-picked-action] .button-alt__text, [data-picked-action]").textContent = "Change my answers";
  root.querySelector("[data-picked-list]").replaceChildren(...picks.map(pickCard));
  root.classList.add("has--picks");
}

/** The questions */
export async function ask(root) {
  const stage = root.querySelector("[data-start-stage]");
  const books = unpack(await shelf());
  const taste = { genres: {}, moods: {}, covers: [] };
  const add = (map, names, weight) => (names || []).forEach((n) => { map[n] = (map[n] || 0) + weight; });
  // Each new question is announced and brought into view; the first is simply there, under the page's heading
  let first = true;
  const scene = (...nodes) => {
    stage.replaceChildren(...nodes);
    if (first) { first = false; return; }
    root.scrollIntoView({ block: "start", behavior: "auto" });
    const heading = stage.querySelector(".start__ask");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  };

  const finish = () => {
    taste.at = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(taste)); } catch { /* shown here, not kept */ }
    const picks = picksFor(books, taste);
    const again = el("button", "start__skip", "Start again");
    again.type = "button";
    again.addEventListener("click", () => ask(root));
    const list = el("ol", "picked__list");
    list.replaceChildren(...picks.map(pickCard));
    const browse = el("a", "start__skip", "See all the books");
    browse.href = "books";
    const foot = el("p", "start__foot"); foot.append(again, browse);
    scene(el("h2", "start__ask", "We think you’d like these"), list, foot);
  };

  const question = (i) => {
    if (i >= QUESTIONS.length) { finish(); return; }
    const q = QUESTIONS[i];
    const grid = el("div", "start__answers");
    q.answers.forEach(([label, gives]) => {
      const button = el("button", "start__answer", label);
      button.type = "button";
      button.addEventListener("click", () => {
        add(taste.genres, gives.genres, 3);
        add(taste.moods, gives.moods, 3);
        if (gives.length) taste.length = gives.length;
        question(i + 1);
      });
      grid.append(button);
    });
    scene(el("p", "start__step", `Question ${i + 2} of ${QUESTIONS.length + 1}`), el("h2", "start__ask", q.ask), grid);
  };

  // the first question: twelve covers from different corners of the shelf, the most read of each, for this age
  const seen = new Set();
  const covers = books.filter((b) => { if (!allows(b.age) || seen.has(b.genres[0])) return false; seen.add(b.genres[0]); return true; });
  for (const b of books) { if (covers.length >= 12) break; if (allows(b.age) && !covers.includes(b) && !covers.some((c) => c.author === b.author)) covers.push(b); }
  const grid = el("div", "start__covers");
  covers.slice(0, 12).forEach((b) => {
    const button = el("button", "start__cover");
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `${b.title} by ${b.author}`);
    button.append(Object.assign(el("img"), { src: `image/covers/${b.slug}-360.webp`, width: 360, height: 540, alt: "", decoding: "async" }));
    button.addEventListener("click", () => {
      const chosen = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(chosen));
      taste.covers = chosen ? [...taste.covers, b.slug] : taste.covers.filter((s) => s !== b.slug);
    });
    grid.append(button);
    button.dataset.slug = b.slug;
  });
  const next = el("button", "start__next", "Next");
  next.type = "button";
  next.addEventListener("click", () => {
    books.filter((b) => taste.covers.includes(b.slug)).forEach((b) => { add(taste.genres, b.genres, 2); add(taste.moods, b.moods, 1); });
    question(0);
  });
  const foot = el("p", "start__foot"); foot.append(next);
  scene(el("p", "start__step", `Question 1 of ${QUESTIONS.length + 1}`), el("h2", "start__ask", "Tap any covers you’d pick up"), grid, foot);
}
