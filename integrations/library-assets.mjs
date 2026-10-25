// @ts-check
// The books (EPUBs), their covers and the link-preview pictures are too big to keep in git. They live in a Cloudflare R2
// bucket, and a copy sits in .assets/ (the deploy fills it from R2; locally, `npm run assets:pull`). This integration
// serves that copy at the addresses the site has always used while developing, and copies it into the built site, so
// every file stays on the site's own address: no cross-site requests, and the service worker can keep them offline.
import { createReadStream, existsSync, statSync } from "node:fs";
import { cp } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SERVED = ["books/", "image/covers/", "image/social/"];
const TYPES = { ".epub": "application/epub+zip", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png" };

/** @returns {import("astro").AstroIntegration} */
export function libraryAssets(dir = ".assets") {
  let root = resolve(dir);
  return {
    name: "library-assets",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = resolve(fileURLToPath(config.root), dir);
      },
      "astro:server:setup": ({ server, logger }) => {
        if (!existsSync(root)) logger.warn(`${dir}/ is missing: books and covers will not load (npm run assets:pull)`);
        server.middlewares.use((req, res, next) => {
          const path = decodeURIComponent((req.url || "").split("?")[0]).replace(/^\/+/, "");
          if (!SERVED.some((prefix) => path.startsWith(prefix))) return next();
          const file = normalize(join(root, path));
          if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader("Content-Type", TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] || "application/octet-stream");
          res.setHeader("Content-Length", statSync(file).size);
          createReadStream(file).pipe(res);
        });
      },
      "astro:build:done": async ({ dir: out, logger }) => {
        if (!existsSync(root)) {
          logger.warn(`${dir}/ is missing: the site was built without its books and covers`);
          return;
        }
        await cp(root, fileURLToPath(out), { recursive: true });
        logger.info(`copied ${dir}/ (books, covers, link pictures) into the site`);
      },
    },
  };
}
