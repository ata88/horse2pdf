#!/usr/bin/env node
/**
 * Downloads the pinned validation artefacts (see rules/sources.json), verifies
 * them against rules/sources.lock.json and compiles them into SaxonJS
 * "SEF" stylesheets in public/rules/. The app loads these at runtime to run
 * the official Schematron rules completely offline.
 *
 *   pnpm rules:build                 build (skips when nothing changed)
 *   pnpm rules:build --force         rebuild everything
 *   pnpm rules:build --update-lock   accept new upstream hashes (after a version bump)
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { unzipSync } from "fflate";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcesPath = join(root, "rules/sources.json");
const lockPath = join(root, "rules/sources.lock.json");
const cacheDir = join(root, ".cache/rules");
const outDir = join(root, "public/rules");
const oracleDir = join(cacheDir, "oracles");
const BUILD_FORMAT = 3; // bump when the output layout changes

const args = new Set(process.argv.slice(2));
const updateLock = args.has("--update-lock");
const force = args.has("--force") || updateLock;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
const lock = existsSync(lockPath) ? JSON.parse(await readFile(lockPath, "utf8")) : {};
const configHash = sha256(
  JSON.stringify({ sources, lock, BUILD_FORMAT, xslt3: require("xslt3/package.json").version }),
);

const manifestPath = join(outDir, "manifest.json");
if (!force && existsSync(manifestPath)) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest.configHash === configHash &&
    manifest.ruleSets.every((r) => existsSync(join(outDir, r.file))) &&
    existsSync(join(root, "public/vendor/saxon-js/SaxonJS2.rt.js")) &&
    (sources.testOracles ?? []).every((o) => existsSync(join(oracleDir, `${o.id}.sef.json`)))
  ) {
    console.log("rules: up to date");
    process.exit(0);
  }
}

async function downloadUncached(url) {
  const cached = join(cacheDir, "downloads", sha256(url));
  let data;
  if (existsSync(cached) && !updateLock) {
    data = await readFile(cached);
  } else {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = Buffer.from(await res.arrayBuffer());
        break;
      } catch (err) {
        if (attempt >= 4) throw new Error(`download failed: ${url}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  const hash = sha256(data);
  if (updateLock) {
    lock[url] = hash;
  } else if (!lock[url]) {
    throw new Error(`${url} is not in rules/sources.lock.json – run \`pnpm rules:build --update-lock\``);
  } else if (lock[url] !== hash) {
    throw new Error(`sha256 mismatch for ${url}\n  expected ${lock[url]}\n  got      ${hash}`);
  }
  await mkdir(dirname(cached), { recursive: true });
  // atomic write: parallel builds must never observe a half written cache file
  const tmp = `${cached}.${process.pid}.${Math.random().toString(36).slice(2)}`;
  await writeFile(tmp, data);
  await rename(tmp, cached);
  return data;
}

const downloads = new Map();
/** Each URL is fetched/verified once per run, even if several rule sets include it. */
function download(url) {
  if (!downloads.has(url)) downloads.set(url, downloadUncached(url));
  return downloads.get(url);
}

async function xslt3(...xsltArgs) {
  const cli = require.resolve("xslt3/xslt3.js");
  try {
    await run(process.execPath, [cli, ...xsltArgs], { maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`xslt3 ${xsltArgs.join(" ")} failed:\n${err.stderr || err.message}`);
  }
}

// SchXslt: Schematron -> XSLT compiler
const schxsltDir = join(cacheDir, `schxslt-${sources.schxslt.version}`);
const zip = unzipSync(new Uint8Array(await download(sources.schxslt.zip)));
for (const [name, content] of Object.entries(zip)) {
  if (name.endsWith("/")) continue;
  const target = join(schxsltDir, name.split("/").slice(1).join("/"));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
const schxsltPipeline = join(schxsltDir, "2.0/pipeline-for-svrl.xsl");

// SaxonJS browser runtime (not committed to git – its license forbids hosting it for download)
const saxonDir = join(root, "public/vendor/saxon-js");
const saxonZip = unzipSync(new Uint8Array(await download(sources.saxonjs.zip)));
await mkdir(saxonDir, { recursive: true });
for (const [from, to] of Object.entries(sources.saxonjs.files)) {
  if (!saxonZip[from]) throw new Error(`${from} missing in ${sources.saxonjs.zip}`);
  await writeFile(join(saxonDir, to), saxonZip[from]);
}

await mkdir(outDir, { recursive: true });

async function buildRuleSet(rs, target = outDir) {
  const work = join(cacheDir, "work", rs.id);
  await rm(work, { recursive: true, force: true });
  const mainName = posix.basename(new URL(rs.main).pathname);
  const mainPath = join(work, "main", mainName);
  const files = { [mainPath]: rs.main };
  for (const [rel, url] of Object.entries(rs.includes ?? {})) {
    files[join(dirname(mainPath), rel)] = url;
  }
  for (const [path, url] of Object.entries(files)) {
    let text = (await download(url)).toString("utf8");
    for (const [token, value] of Object.entries(rs.tokens ?? {})) {
      text = text.replaceAll(`@${token}@`, value);
    }
    if (path === mainPath) {
      // Documented, minimal patches for engine limitations (see `reason` in sources.json).
      for (const patch of rs.patches ?? []) {
        const found = text.split(patch.find).length - 1;
        if (found !== patch.count) {
          throw new Error(`${rs.id}: patch expected ${patch.count} match(es), found ${found}: ${patch.find}`);
        }
        text = text.replaceAll(patch.find, patch.replace);
      }
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }

  let xsl = mainPath;
  if (rs.kind === "schematron") {
    xsl = join(work, "compiled.xsl");
    await xslt3(`-xsl:${schxsltPipeline}`, `-s:${mainPath}`, `-o:${xsl}`);
  }
  const file = `${rs.id}.sef.json`;
  await xslt3(`-xsl:${xsl}`, `-export:${join(target, file)}`, "-nogo", "-relocate:on");
  console.log(`rules: built ${rs.id} (${rs.name} ${rs.version})`);
  return {
    id: rs.id,
    name: rs.name,
    version: rs.version,
    syntax: rs.syntax,
    license: rs.license,
    homepage: rs.homepage,
    file,
  };
}

await mkdir(oracleDir, { recursive: true });
const [built] = await Promise.all([
  Promise.all(sources.ruleSets.map((rs) => buildRuleSet(rs))),
  // Test-only reference mappings (KoSIT visualization): not shipped with the app.
  Promise.all((sources.testOracles ?? []).map((rs) => buildRuleSet({ ...rs, kind: "xslt" }, oracleDir))),
]);

if (updateLock) {
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(lockPath, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log("rules: updated rules/sources.lock.json");
}

const finalHash = sha256(
  JSON.stringify({ sources, lock, BUILD_FORMAT, xslt3: require("xslt3/package.json").version }),
);
await writeFile(
  manifestPath,
  `${JSON.stringify({ configHash: finalHash, builtAt: new Date().toISOString(), ruleSets: built }, null, 2)}\n`,
);
