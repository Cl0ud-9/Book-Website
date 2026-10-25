// An Atom feed of the books of the month, newest first: one entry a month, up to this one
import type { APIRoute } from "astro";
import { SITE } from "../lib/config";
import { BOOK, PICK_MONTHS, TODAY, bookUrl, monthKey, pickFor } from "../lib/library";

const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

export const GET: APIRoute = () => {
  const months = PICK_MONTHS.filter((m) => m <= monthKey(TODAY)).reverse();
  const entries = months.flatMap((m) => {
    const pick = pickFor(m);
    const b = pick && BOOK[pick.book];
    if (!pick || !b) return [];
    const name = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
    const summary = `${b.abstract} ${pick.why}`.trim();
    return [`  <entry>
    <title>Book of the month for ${name}: ${escape(b.title)} by ${escape(b.author)}</title>
    <link href="${SITE}${bookUrl(b.slug)}"/>
    <id>${SITE}${bookUrl(b.slug)}#${m}</id>
    <updated>${m}-01T00:00:00Z</updated>
    <summary>${escape(summary)}</summary>
  </entry>
`];
  });
  const updated = months.length ? `${months[0]}-01T00:00:00Z` : `${TODAY.toISOString().slice(0, 10)}T00:00:00Z`;
  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Bookshelf: book of the month</title>
  <subtitle>A free classic to read each month, chosen on the first.</subtitle>
  <link href="${SITE}"/>
  <link rel="self" href="${SITE}feed.xml"/>
  <id>${SITE}</id>
  <updated>${updated}</updated>
  <author><name>The Bookshelf</name></author>
${entries.join("")}</feed>
`;
  return new Response(body, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
};
