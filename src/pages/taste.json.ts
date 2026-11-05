// The shelf in brief, for picks worked out in the browser (scripts/taste.js), most read first. Fetched only once someone has
// answered the questions, so nobody else pays for it.
import { GENRES, LIBRARY, MOODS } from "../lib/library";

export function GET() {
  const genres = [...GENRES];
  const moods: string[] = [...MOODS];
  const books = LIBRARY.map((b) => [b.slug, b.title, b.author, b.genres.map((g) => genres.indexOf(g)), b.moods.map((m) => moods.indexOf(m)), b.minutes, b.age]);
  return new Response(JSON.stringify({ genres, moods, books }), { headers: { "Content-Type": "application/json" } });
}
