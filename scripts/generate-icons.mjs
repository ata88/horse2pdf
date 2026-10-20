#!/usr/bin/env node
/**
 * Renders public/icon.svg to a 1024px PNG and lets the Tauri CLI derive all
 * platform icons (icns, ico, PNG sizes) into src-tauri/icons.
 *   pnpm icons
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/icon.svg"));
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();
const tmp = join(mkdtempSync(join(tmpdir(), "horse2pdf-icon-")), "icon.png");
writeFileSync(tmp, png);
writeFileSync(
  join(root, "public/icon-512.png"),
  new Resvg(svg, { fitTo: { mode: "width", value: 512 } }).render().asPng(),
);
execFileSync("pnpm", ["exec", "tauri", "icon", tmp, "-o", join(root, "src-tauri/icons")], {
  stdio: "inherit",
  cwd: root,
  shell: process.platform === "win32",
});
// Mobile targets are not used.
for (const dir of ["android", "ios"])
  rmSync(join(root, "src-tauri/icons", dir), { recursive: true, force: true });
