// The books, covers and link pictures (.assets/) are not kept in git. They are one file, assets.tar, on the GitHub
// release "library-assets", which the build downloads before it starts.
// usage: node pipeline/assets.mjs pull | push   (npm run assets:pull, npm run assets:push; needs the GitHub CLI, gh)
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

const REPO = "Cl0ud-9/Book-Website";
const TAG = "library-assets";
const FILE = "assets.tar";
const DIR = ".assets";

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    rmSync(FILE, { force: true });
    process.exit(result.status ?? 1);
  }
};

const mode = process.argv[2];
if (mode === "pull") {
  run("gh", ["release", "download", TAG, "--repo", REPO, "--pattern", FILE, "--clobber"]);
  mkdirSync(DIR, { recursive: true });
  run("tar", ["-xf", FILE, "-C", DIR]);
  rmSync(FILE);
  console.log(`${DIR}/: the books, covers and link pictures, from the ${TAG} release`);
} else if (mode === "push") {
  if (!existsSync(`${DIR}/books`) || !existsSync(`${DIR}/image`)) {
    console.error(`${DIR}/books and ${DIR}/image are needed (python pipeline/library.py makes them)`);
    process.exit(1);
  }
  run("tar", ["-cf", FILE, "-C", DIR, "books", "image"]);
  // the release is made the first time, kept off the "latest" spot (that is for the site's versions)
  const exists = spawnSync("gh", ["release", "view", TAG, "--repo", REPO], { stdio: "ignore" }).status === 0;
  if (!exists) {
    run("gh", ["release", "create", TAG, "--repo", REPO, "--latest=false", "--title", "Books and covers, for the build",
      "--notes", "The EPUB files, covers and link pictures the site is built with (.assets/), as one file. Not a version of the site: `npm run assets:pull` downloads it, `npm run assets:push` replaces it."]);
  }
  run("gh", ["release", "upload", TAG, FILE, "--repo", REPO, "--clobber"]);
  rmSync(FILE);
  console.log(`${DIR}/ uploaded to the ${TAG} release`);
} else {
  console.error("usage: node pipeline/assets.mjs pull | push");
  process.exit(1);
}
