// What the reader, Your reading, "Continue reading" and your account need to know about each book. A file of its own, fetched
// (scripts/library-data.js) only by the pages that need it: embedded in every one of them it grew with every book added.
import { libraryData } from "../lib/library";

export function GET() {
  return new Response(libraryData(), { headers: { "Content-Type": "application/json" } });
}
