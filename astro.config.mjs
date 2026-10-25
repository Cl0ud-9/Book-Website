// @ts-check
import { defineConfig } from "astro/config";
import { libraryAssets } from "./integrations/library-assets.mjs";
import { serviceWorker } from "./integrations/service-worker.mjs";

// The site is static: every page is built ahead of time. Pages keep the addresses they have always had
// (books.html, book-dracula.html), so links shared over the years still work.
export default defineConfig({
  site: process.env.SITE_URL || "https://the-bookshelf.pages.dev",
  build: { format: "file", assets: "_astro" },
  // Keep the spaces between inline elements as they are written (Astro 7 strips them by default, which ran words
  // together where a link or an icon meets text)
  compressHTML: true,
  devToolbar: { enabled: false },
  // the licences of every library bundled into the site's scripts, published with them
  vite: { build: { license: { fileName: "third-party-licenses.md" } } },
  integrations: [libraryAssets(), serviceWorker()],
});
