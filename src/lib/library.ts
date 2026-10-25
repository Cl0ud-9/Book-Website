// The shelf: every book (data/books.json, made by pipeline/library.py), checked against a schema when the site is built,
// and everything the pages work out from it (rankings, colours, moods, groups, the book of the month).
import { z } from "astro/zod";
import booksJson from "../../data/books.json";
import guidesJson from "../../data/guides.json";
import listenJson from "../../data/librivox.json";
import moodsJson from "../../data/moods.json";
import picksJson from "../../data/picks.json";
import quotesJson from "../../data/quotes.json";
import { slugify } from "./text";

// Genres come in two families. A book is non-fiction when its first genre is one of the non-fiction ones.
export const FICTION = ["Romance", "Mystery", "Adventure", "Fantasy", "Science fiction", "Horror", "Poetry", "Children’s",
  "Plays", "Literary fiction"] as const;
export const NONFICTION = ["Philosophy", "Lives and memoirs", "History and politics", "Science and nature", "Essays and letters"] as const;
export const GENRES: readonly string[] = [...FICTION, ...NONFICTION];
export const MOODS = ["Funny", "Romantic", "Adventurous", "Dark", "Eerie", "Thoughtful", "Heartwarming", "Gripping"] as const;
/** Collections cut across genres; for now, the books from India */
export const COLLECTIONS: Record<string, string> = { india: "From India" };
export const LENGTHS = [["short", "Under 3 hours", 0, 180], ["medium", "3 to 8 hours", 180, 480], ["long", "Over 8 hours", 480, 10 ** 6]] as const;

export const TAG_COLOURS: Record<string, string> = {
  Romance: "pale-pink", Mystery: "pale-blue", Adventure: "orange", Fantasy: "pale-periwinkle", "Science fiction": "cyan",
  Horror: "black", Poetry: "pale-yellow", Philosophy: "soft-orange", "Children’s": "pale-green", Plays: "soft-periwinkle",
  "Literary fiction": "white", "Lives and memoirs": "pale-orange", "History and politics": "soft-pink",
  "Science and nature": "soft-blue", "Essays and letters": "yellow", "From India": "pale-orange", "Book of the month": "magenta",
};
const CARD_COLOURS = ["yellow", "pale-green", "pale-orange", "cyan", "periwinkle", "pale-pink", "pale-blue", "olive", "violet", "magenta"];
/** card colours that need white text (both pass WCAG AA with it) */
const DARK = new Set(["olive", "violet"]);
export const ink = (colour: string): string => (DARK.has(colour) ? "#fff" : "#000");
/** a cover's size as stored (360 x 540, 2:3) */
export const COVER = { width: 360, height: 540 } as const;

const BookSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  translator: z.string().nullable(),
  abstract: z.string().min(1),
  description: z.array(z.string()).min(1),
  words: z.number().int().positive(),
  reading_time: z.string().min(1),
  language: z.string(),
  standard_ebooks: z.url().nullable().optional(),
  gutenberg: z.url().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  genres: z.array(z.enum(GENRES as [string, ...string[]])).min(1),
  collections: z.array(z.string()).default([]),
  spine: z.string().regex(/^#[0-9a-f]{6}$/i),
  epub: z.string().min(1),
  size: z.number().int().positive(),
  popularity: z.number().int().nullable(),
  opening: z.string().nullable(),
  kindle: z.url(),
  kobo: z.url(),
});

export type Book = z.infer<typeof BookSchema> & {
  kind: "fiction" | "nonfiction";
  moods: string[];
  /** reading time in minutes, at 275 words a minute */
  minutes: number;
  /** the card colour: a site colour name */
  colour: string;
};

// The data files begin with a note on what they hold ("_about"); every other entry is checked as it is read
function entries<T>(json: Record<string, unknown>, schema: z.ZodType<T>, file: string): Record<string, T> {
  return Object.fromEntries(Object.entries(json).filter(([key]) => !key.startsWith("_")).map(([key, value]) => {
    const checked = schema.safeParse(value);
    if (!checked.success) throw new Error(`data/${file}: ${key}: ${checked.error.message}`);
    return [key, checked.data];
  }));
}

const moods = entries(moodsJson, z.array(z.string()), "moods.json");
const parsed = z.array(BookSchema).parse(booksJson);
const library: Book[] = parsed.map((b, n) => {
  const bookMoods = moods[b.slug] || [];
  const unknown = bookMoods.filter((m) => !(MOODS as readonly string[]).includes(m));
  if (unknown.length || !bookMoods.length) throw new Error(`${b.slug}: unknown mood ${unknown.join(", ")}, or no mood in data/moods.json`);
  return {
    ...b,
    kind: (NONFICTION as readonly string[]).includes(b.genres[0]) ? "nonfiction" : "fiction",
    moods: bookMoods,
    minutes: Math.round(b.words / 275),
    // the card colours go round in the order of data/books.json, before the books are ranked
    colour: CARD_COLOURS[n % CARD_COLOURS.length],
  };
});

const rank = (b: Book): number => b.popularity || 10_000;
/** Every book, most read first (Standard Ebooks' popularity order, saved by pipeline/library.py) */
export const LIBRARY: readonly Book[] = [...library].sort((a, b) => rank(a) - rank(b));
export const BOOK: Readonly<Record<string, Book>> = Object.fromEntries(LIBRARY.map((b) => [b.slug, b]));
export const bookUrl = (slug: string): string => `book-${slug}.html`;

export function mostPopular(genre: string, skip: ReadonlySet<string> = new Set()): string {
  const found = LIBRARY.find((b) => b.genres.includes(genre) && !skip.has(b.slug));
  if (!found) throw new Error(`no book in ${genre}`);
  return found.slug;
}

// Lines from the books, each checked against our edition by pipeline/quotes.py ("in": its chapter file, "at": how far
// in). Only lines from the first 70% of a book are used, so opening one never lands near the ending.
const QuoteSchema = z.object({ text: z.string().min(1), in: z.string(), at: z.number().optional() });
export type Quote = z.infer<typeof QuoteSchema>;
export const QUOTES: Readonly<Record<string, Quote[]>> = Object.fromEntries(
  Object.entries(entries(quotesJson, z.array(QuoteSchema), "quotes.json"))
    .map(([slug, items]) => [slug, items.filter((q) => q.in && (q.at ?? 1) <= 0.7)]),
);

/** Before you start: spoiler-free notes for the most read books */
const GuideSchema = z.object({ when: z.string(), who: z.array(z.string()), tips: z.array(z.string()) });
export type Guide = z.infer<typeof GuideSchema>;
export const GUIDES: Readonly<Record<string, Guide>> = entries(guidesJson, GuideSchema, "guides.json");

/** Free audiobooks: each book's recording on LibriVox, found by pipeline/listen.py */
export const LISTEN: Readonly<Record<string, string>> = entries(listenJson, z.url(), "librivox.json");

/** Percent-encoding for an address, leaving "/" as it is (as the links have always been written) */
const quote = (s: string): string =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replaceAll("%2F", "/");

/** The reader opens the book at these words, without moving your place in it */
export const readAt = (slug: string, line: Quote): string => `read.html?book=${slug}&at=${quote(line.text)}&in=${quote(line.in)}`;

// ---- The book of the month ----

type Pick = string | { book: string; why?: string };
const PICKS = entries<Pick>(picksJson, z.union([z.string(), z.object({ book: z.string(), why: z.string().optional() })]), "picks.json");
const pickBook = (pick: Pick | undefined): string => (typeof pick === "object" ? pick.book : pick || "");
const pickWhy = (pick: Pick | undefined): string => (typeof pick === "object" ? pick.why || "" : "");
export const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** the months that have a pick, with its book and why it was chosen */
export const pickFor = (month: string): { book: string; why: string } | null =>
  PICKS[month] ? { book: pickBook(PICKS[month]), why: pickWhy(PICKS[month]) } : null;
export const PICK_MONTHS: readonly string[] = Object.keys(PICKS).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort();

// Each month's pick is written down in data/picks.json, so a month never changes once it has been shown. The deploy
// rebuilds the site on the first of every month. A month missing from the list falls back to the twelve most read
// books with an opening line, one a month in turn.
export function bookOfTheMonth(today: Date): string {
  const chosen = pickBook(PICKS[monthKey(today)]);
  if (BOOK[chosen]?.opening) return chosen;
  const picks = LIBRARY.filter((b) => b.opening).slice(0, 12).map((b) => b.slug);
  return picks[(today.getFullYear() * 12 + today.getMonth()) % picks.length];
}

export const TODAY = new Date();

// ---- What the home page features: every name is a book's slug ----

const starts: [string, string][] = [];
for (const [genre, label] of [["Romance", "If you love a love story"], ["Mystery", "If you love a good mystery"],
  ["Horror", "If you like a little fear"], ["Adventure", "If you want an adventure"]] as const) {
  starts.push([mostPopular(genre, new Set(starts.map(([s]) => s))), label]);
}

/** The hero, the opening book and the gift are chosen for how their covers look; everything else follows the rankings */
export const FEATURED = {
  hero: ["wuthering-heights", "pride-and-prejudice"] as const, // behind, in front
  shelf: LIBRARY.slice(0, 10).map((b) => b.slug),
  openBook: "alices-adventures-in-wonderland",
  gift: "little-women",
  starts,
  spotlight: bookOfTheMonth(TODAY),
};

// ---- Groups: a genre, "Non-fiction", or a collection such as "From India" ----

/** Home lists the stories by genre, then non-fiction and the books from India as one entry each */
export const HOME_GROUPS: readonly string[] = [...FICTION, "Non-fiction", "From India"];
/** The Genres page has a shelf for every group */
export const SHELF_GROUPS: readonly string[] = ["From India", ...FICTION, ...NONFICTION];

const collectionOf = (name: string): string | undefined => Object.entries(COLLECTIONS).find(([, label]) => label === name)?.[0];

/** a group's books, most read first */
export function groupBooks(name: string): Book[] {
  if (name === "Non-fiction") return LIBRARY.filter((b) => b.kind === "nonfiction");
  const collection = collectionOf(name);
  if (collection) return LIBRARY.filter((b) => b.collections.includes(collection));
  return LIBRARY.filter((b) => b.genres.includes(name));
}

/** the All books address that shows a group */
export function groupQuery(name: string): string {
  if (name === "Non-fiction") return "kind=nonfiction";
  const collection = collectionOf(name);
  return collection ? `collection=${collection}` : `genre=${slugify(name)}`;
}

/** What the reader and "Continue reading" need to know about each book (read by the scripts from the page) */
export function libraryData(): string {
  const data = Object.fromEntries(LIBRARY.map((b) => [b.slug, {
    title: b.title, author: b.author, epub: b.epub, colour: b.colour, minutes: b.minutes,
    // numbered poems keep their bare numbers in the reader's contents, where chapters become "Chapter I"
    ...(b.genres.includes("Poetry") ? { verse: 1 } : {}),
  }]));
  return JSON.stringify(data);
}
