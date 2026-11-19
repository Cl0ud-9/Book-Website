// The whole shelf for the All books page, in brief, most read first (scripts/app.js, catalogue). The page itself holds only
// the first cards; the rest are built from this as they are scrolled to, and search and filters work on all of it. Each
// row has what a card shows, worked out here, so the browser builds the same card the page does and never decides anything.
//   [slug, title, author, genres (their numbers), moods (their numbers), kind (1: non-fiction), age, minutes, words,
//    rank, card colour, the title's size (fit), the reading time as shown, abstract, collections]
import { COLLECTIONS, GENRES, LIBRARY, MOODS, TAG_COLOURS, ink } from "../lib/library";
import { fit, shortTime } from "../lib/text";

export function GET() {
  const genres = [...GENRES];
  const moods: string[] = [...MOODS];
  const rows = LIBRARY.map((b) => [
    b.slug, b.title, b.author, b.genres.map((g) => genres.indexOf(g)), b.moods.map((m) => moods.indexOf(m)), b.kind === "nonfiction" ? 1 : 0,
    b.age, b.minutes, b.words, b.popularity || 9999, b.colour, fit(b.title), shortTime(b.minutes), b.abstract, b.collections,
  ]);
  const colours = [...new Set(LIBRARY.map((b) => b.colour))];
  return new Response(JSON.stringify({
    genres, moods, collections: COLLECTIONS, tag: TAG_COLOURS, ink: Object.fromEntries(colours.map((c) => [c, ink(c)])), books: rows,
  }), { headers: { "Content-Type": "application/json" } });
}
