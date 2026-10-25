// The browser suites (tests/e2e, Python and Playwright, in Google Chrome), against the built site served by
// `astro preview`. Starts the server, runs each suite in turn, stops it, and fails if any suite failed.
// usage: npm run build, then: npm run test:e2e [-- check effects]      (PYTHON: the Python to use, default "python")
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}/`;
const SUITES = process.argv.slice(2).length ? process.argv.slice(2) : ["check", "effects", "library_check", "reader_check"];
const python = process.env.PYTHON || "python";
const shots = "test-results/e2e";
mkdirSync(shots, { recursive: true });

const server = spawn("npx", ["astro", "preview", "--port", String(PORT), "--host", "127.0.0.1"], { stdio: "ignore", shell: true });
const up = async () => {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`the site never answered at ${BASE}`);
};

let failed = 0;
try {
  await up();
  for (const suite of SUITES) {
    console.log(`\n== ${suite}`);
    const run = spawnSync(python, [`tests/e2e/${suite}.py`, BASE, shots], { stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    if (run.status !== 0) failed += 1;
  }
} finally {
  server.kill();
}
console.log(failed ? `\n${failed} of ${SUITES.length} suites failed` : `\nall ${SUITES.length} suites passed`);
process.exit(failed ? 1 : 0);
