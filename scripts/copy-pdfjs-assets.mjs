#!/usr/bin/env node
/** Copies pdf.js runtime assets (CMaps, standard fonts, wasm decoders) to public/pdfjs. */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
const target = join(root, "public/pdfjs");
const stamp = join(target, ".version");

if (existsSync(stamp) && readFileSync(stamp, "utf8") === version) {
  console.log("pdfjs assets: up to date");
} else {
  mkdirSync(target, { recursive: true });
  for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
    if (existsSync(join(pkgDir, dir))) cpSync(join(pkgDir, dir), join(target, dir), { recursive: true });
  }
  writeFileSync(stamp, version);
  console.log(`pdfjs assets: copied (pdfjs-dist ${version})`);
}
