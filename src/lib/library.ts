// The shelf: every book (data/books.json, made by pipeline/library.py), checked against a schema when the site is built,
// and everything the pages work out from it (rankings, colours, moods, groups, the book of the month).
import { z } from "astro/zod";
import agesJson from "../../data/ages.json";
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

/** A guide to who a book suits (data/ages.json), written by hand: the youngest age it is suggested for, and what a parent may want to know */
export const AGE_NOTES = {
  fear: "Frightening scenes", violence: "Violence", death: "Death or grief", sex: "Sexual themes", race: "Racial language or attitudes of its time",
  slavery: "Slavery", suicide: "Suicide", substances: "Drink or drugs", war: "War", ideas: "Demanding adult ideas",
} as const;
export const ageLabel = (age: number): string => (age ? `${age} and up` : "All ages");

const AGES = entries(agesJson, z.object({
  age: z.union([z.literal(0), z.literal(10), z.literal(13), z.literal(16)]),
  notes: z.array(z.enum(Object.keys(AGE_NOTES) as [keyof typeof AGE_NOTES, ...(keyof typeof AGE_NOTES)[]])),
}), "ages.json");

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
  /** the youngest age it is suggested for; 0 is all ages */
  age: 0 | 10 | 13 | 16;
  notes: (keyof typeof AGE_NOTES)[];
  kind: "fiction" | "nonfiction";
  moods: string[];
  /** reading time in minutes, at an average adult's silent reading pace (READING_PACE) */
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

/** Words a minute: silent reading in English averages about 260 for fiction and 238 for non-fiction (Brysbaert, 2019,
    a review of 190 studies). Standard Ebooks' reading times assume 275, which made every book look a little shorter. */
export const READING_PACE = { fiction: 260, nonfiction: 238 } as const;

const moods = entries(moodsJson, z.array(z.string()), "moods.json");
const parsed = z.array(BookSchema).parse(booksJson);
const library: Book[] = parsed.map((b, n) => {
  const bookMoods = moods[b.slug] || [];
  const guide = AGES[b.slug];
  if (!guide) throw new Error(`${b.slug}: no entry in data/ages.json`);
  const unknown = bookMoods.filter((m) => !(MOODS as readonly string[]).includes(m));
  if (unknown.length || !bookMoods.length) throw new Error(`${b.slug}: unknown mood ${unknown.join(", ")}, or no mood in data/moods.json`);
  const kind = (NONFICTION as readonly string[]).includes(b.genres[0]) ? "nonfiction" : "fiction";
  return {
    ...b,
    kind,
    moods: bookMoods,
    age: guide.age,
    notes: guide.notes,
    minutes: Math.round(b.words / READING_PACE[kind]),
    // the card colours go round in the order of data/books.json, before the books are ranked
    colour: CARD_COLOURS[n % CARD_COLOURS.length],
  };
});

const rank = (b: Book): number => b.popularity || 10_000;
/** Every book, most read first (Standard Ebooks' popularity order, saved by pipeline/library.py) */
export const LIBRARY: readonly Book[] = [...library].sort((a, b) => rank(a) - rank(b));
export const BOOK: Readonly<Record<string, Book>> = Object.fromEntries(LIBRARY.map((b) => [b.slug, b]));
export const bookUrl = (slug: string): string => `book-${slug}`;

/** Books like this one: those sharing the most genres, then the rest of the shelf, most read first */
export function relatedTo(slug: string, count = 3): string[] {
  const b = BOOK[slug];
  const shared = (o: Book): number => o.genres.filter((g) => b.genres.includes(g)).length;
  return LIBRARY.filter((o) => o.slug !== slug).map((o, i) => [o, i] as const)
    .sort(([x, i], [y, j]) => shared(y) - shared(x) || i - j).slice(0, count).map(([o]) => o.slug);
}

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
export const readAt = (slug: string, line: Quote): string => `read?book=${slug}&at=${quote(line.text)}&in=${quote(line.in)}`;

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
    title: b.title, author: b.author, epub: b.epub, colour: b.colour, minutes: b.minutes, age: b.age,
    // what to read next, for the end of the book (more than shown, so books already read can be passed over)
    next: relatedTo(b.slug, 6),
    // numbered poems keep their bare numbers in the reader's contents, where chapters become "Chapter I"
    ...(b.genres.includes("Poetry") ? { verse: 1 } : {}),
  }]));
  return JSON.stringify(data);
}
