// Every local link, image and font in the built site resolves: href, src and srcset on every page, each page's link
// preview, and url() in the stylesheets. Links to other sites are skipped; ?query and #fragment are dropped.
// usage: npm run build, then: node tests/links.mjs [DIST_DIR]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] || "dist";
const site = (process.env.SITE_URL || "https://the-bookshelf.cl0ud-9.workers.dev").replace(/\/?$/, "/");
const missing = [];
const exists = (ref, from) => {
  const path = ref.split(/[?#]/)[0].replace(/^\//, "");
  if (path && !existsSync(join(dist, decodeURIComponent(path)))) missing.push(`${from}: missing ${ref}`);
};

for (const page of readdirSync(dist).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(dist, page), "utf-8");
  for (const [, ref] of html.matchAll(/\s(?:href|src)="([^":]+)"/g)) exists(ref, page);
  for (const [, set] of html.matchAll(/\s(?:srcset|imagesrcset)="([^"]+)"/g)) {
    for (const item of set.split(",")) exists(item.trim().split(/\s+/)[0], page);
  }
  for (const [, ref] of html.matchAll(/property="og:image" content="([^"]+)"/g)) {
    if (!ref.startsWith(site)) missing.push(`${page}: link preview ${ref} is not on ${site}`);
    else exists(ref.slice(site.length), `${page} (link preview)`);
  }
}
for (const css of readdirSync(join(dist, "_astro")).filter((f) => f.endsWith(".css"))) {
  const text = readFileSync(join(dist, "_astro", css), "utf-8");
  for (const [, raw] of text.matchAll(/url\(([^)]+)\)/g)) {
    const ref = raw.replace(/["']/g, "");
    if (!ref.startsWith("data:")) exists(ref, `_astro/${css}`);
  }
}

if (missing.length) {
  console.log(missing.slice(0, 40).join("\n"));
  console.log(`${missing.length} missing`);
  process.exit(1);
}
console.log("every local link, image and font is there");
