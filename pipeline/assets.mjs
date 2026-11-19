// The books, covers and link pictures (.assets/) are not kept in git. They live on the GitHub release "library-assets", which
// the build downloads before it starts, as a few archives ("shards") and a manifest of every file in them (its checksum and
// the shard it is in). A push uploads only the files that are new or changed, as a new shard, so a day's few books are a few
// megabytes and the whole set can grow past what one file on a release can hold (2 GB). A pull downloads the shards in the
// order they were made, so a later one replaces an earlier one's copy of a file.
// (The first release kept everything in one assets.tar. A pull still reads that when there is no manifest, and the first
// push writes the shards and removes it.)
// A file the manifest does not list is not part of the set: a pull deletes it (so what was taken off the shelf, or a size
// of cover no longer made, is not built into the site), and `push --prune` takes from the manifest what is no longer in .assets.
// usage: node pipeline/assets.mjs pull | push [--prune]   (npm run assets:pull, npm run assets:push; needs the GitHub CLI, gh)
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

const REPO = "Cl0ud-9/Book-Website";
const TAG = process.env.ASSETS_TAG || "library-assets"; // (the overrides are for trying this on a scratch release)
const DIR = process.env.ASSETS_DIR || ".assets";
const MANIFEST = "assets-manifest.json";
const LEGACY = "assets.tar";
const SHARD_LIMIT = 1_500_000_000; // bytes of files per shard: well under GitHub's 2 GB for one file on a release

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    console.error(`${cmd} ${args.slice(0, 3).join(" ")} … failed`);
    process.exit(result.status ?? 1);
  }
};
const quiet = (cmd, args) => spawnSync(cmd, args, { encoding: "utf-8" });

/** Downloads one file of the release into `into`; false when the release has no such file */
function download(pattern, into) {
  const result = spawnSync("gh", ["release", "download", TAG, "--repo", REPO, "--pattern", pattern, "--dir", into, "--clobber"], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf-8" });
  return result.status === 0 && existsSync(join(into, pattern));
}

/** The release's manifest ({ shards: [...], files: { "books/a.epub": { sha1, shard } } }), or null */
function remoteManifest(scratch) {
  return download(MANIFEST, scratch) ? JSON.parse(readFileSync(join(scratch, MANIFEST), "utf-8")) : null;
}

/** Every file under .assets, as { "books/a.epub": size } */
function localFiles() {
  const out = {};
  const walk = (dir) => {
    for (const entry of readdirSync(join(DIR, dir), { withFileTypes: true })) {
      const path = dir ? posix.join(dir, entry.name) : entry.name;
      if (entry.isDirectory()) walk(path);
      else if (!entry.name.startsWith(".")) out[path] = statSync(join(DIR, path)).size;
    }
  };
  walk("");
  return out;
}

const sha1 = (path) => new Promise((resolve, reject) => {
  const hash = createHash("sha1");
  createReadStream(join(DIR, path)).on("data", (d) => hash.update(d)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
});

const mode = process.argv[2];
// (a folder beside the project, with only relative paths: GNU tar on Windows reads "C:\..." as a host called C)
const scratch = ".assets-tmp";
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
try {
  if (mode === "pull") {
    mkdirSync(DIR, { recursive: true });
    const manifest = remoteManifest(scratch);
    const shards = manifest ? manifest.shards : [LEGACY];
    for (const shard of shards) {
      if (!download(shard, scratch)) { console.error(`${shard} is not on the ${TAG} release`); process.exit(1); }
      run("tar", ["-xf", join(scratch, shard), "-C", DIR]);
      rmSync(join(scratch, shard), { force: true }); // (one at a time: they add up)
    }
    if (manifest) {
      let removed = 0;
      for (const path of Object.keys(localFiles())) {
        if (!manifest.files[path]) { rmSync(join(DIR, path)); removed += 1; }
      }
      if (removed) console.log(`${DIR}/: ${removed} files the manifest does not list were removed`);
    }
    console.log(`${DIR}/: the books, covers and link pictures, from the ${TAG} release (${shards.length} ${shards.length === 1 ? "file" : "files"})`);
  } else if (mode === "push") {
    if (!existsSync(`${DIR}/books`) || !existsSync(`${DIR}/image`)) {
      console.error(`${DIR}/books and ${DIR}/image are needed (python pipeline/library.py makes them)`);
      process.exit(1);
    }
    // the release is made the first time, kept off the "latest" spot (that is for the site's versions)
    if (quiet("gh", ["release", "view", TAG, "--repo", REPO]).status !== 0) {
      run("gh", ["release", "create", TAG, "--repo", REPO, "--latest=false", "--title", "Books and covers, for the build",
        "--notes", "The EPUB files, covers and link pictures the site is built with (.assets/), as archives and a manifest. Not a version of the site: `npm run assets:pull` downloads them, `npm run assets:push` adds what is new."]);
    }
    const before = remoteManifest(scratch);
    const manifest = before || { version: 2, shards: [], files: {} };
    const sizes = localFiles();
    const changed = [];
    for (const path of Object.keys(sizes).sort()) {
      const hash = await sha1(path);
      if (manifest.files[path]?.sha1 !== hash) changed.push({ path, hash, size: sizes[path] });
    }
    let pruned = 0;
    if (before && process.argv.includes("--prune")) {
      for (const path of Object.keys(manifest.files)) {
        if (!(path in sizes)) { delete manifest.files[path]; pruned += 1; }
      }
    }
    if (!changed.length && before && !pruned) {
      console.log(`${DIR}/ is already on the ${TAG} release: nothing new`);
    } else {
      // new shards of what is new or changed, each no bigger than the limit
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const groups = [[]];
      let size = 0;
      for (const file of changed) {
        if (size + file.size > SHARD_LIMIT && groups.at(-1).length) { groups.push([]); size = 0; }
        groups.at(-1).push(file);
        size += file.size;
      }
      groups.forEach((group, i) => {
        if (!group.length) return;
        const name = `assets-${stamp}-${String(i + 1).padStart(2, "0")}.tar`;
        const list = join(scratch, `${name}.txt`);
        writeFileSync(list, group.map((f) => f.path).join("\n") + "\n");
        run("tar", ["-cf", join(scratch, name), "-C", DIR, "-T", list]);
        run("gh", ["release", "upload", TAG, join(scratch, name), "--repo", REPO, "--clobber"]);
        rmSync(join(scratch, name), { force: true });
        manifest.shards.push(name);
        for (const f of group) manifest.files[f.path] = { sha1: f.hash, shard: name };
        console.log(`${name}: ${group.length} files, ${(group.reduce((s, f) => s + f.size, 0) / 1e6).toFixed(1)} MB`);
      });
      // the manifest goes last: until it does, a pull still sees the old set
      writeFileSync(join(scratch, MANIFEST), JSON.stringify(manifest));
      run("gh", ["release", "upload", TAG, join(scratch, MANIFEST), "--repo", REPO, "--clobber"]);
      // the first release's one big file is replaced by the shards
      if (!before) quiet("gh", ["release", "delete-asset", TAG, LEGACY, "--repo", REPO, "--yes"]);
      console.log(`${DIR}/ uploaded to the ${TAG} release: ${changed.length} new or changed files${pruned ? `, ${pruned} no longer listed` : ""}`);
    }
  } else {
    console.error("usage: node pipeline/assets.mjs pull | push");
    process.exit(1);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
