// @ts-check
// The service worker (sw.js) keeps what the reader and Your reading need, so a book you keep opens with no connection.
// It is written once the site is built, from src/sw.template.js: the files it keeps from the start are this build's own
// (their names carry a fingerprint), and its version changes whenever any of them does.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** @returns {import("astro").AstroIntegration} */
export function serviceWorker() {
  let template = "";
  return {
    name: "service-worker",
    hooks: {
      "astro:config:done": async ({ config }) => {
        template = await readFile(join(fileURLToPath(config.root), "src", "sw.template.js"), "utf-8");
      },
      "astro:build:done": async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const built = (await readdir(join(out, "_astro"))).sort().map((name) => `_astro/${name}`);
        const shell = ["read.html", "reading.html", "account.html", ...built, "image/logo.svg", "manifest.webmanifest"];
        const hash = createHash("sha1");
        for (const file of built) hash.update(await readFile(join(out, file)));
        const version = hash.digest("hex").slice(0, 8);
        await writeFile(join(out, "sw.js"), template.replace("__VERSION__", version).replace("__SHELL__", JSON.stringify(shell)));
        logger.info(`sw.js: version ${version}, keeps ${shell.length} files from the start`);
      },
    },
  };
}
