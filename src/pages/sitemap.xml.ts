// For search engines: every page except the reader, your account, reader pages and the sign-in pages
import type { APIRoute } from "astro";
import { SITE } from "../lib/config";
import { LIBRARY, bookUrl } from "../lib/library";

export const GET: APIRoute = () => {
  const urls = ["", "books.html", "genres.html", "faq.html", "reading.html", "privacy.html", ...LIBRARY.map((b) => bookUrl(b.slug))];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>\n`).join("")}</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
