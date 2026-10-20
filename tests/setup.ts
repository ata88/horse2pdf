import { setPdfjsLoader } from "../src/core/pdf";

// Node has no web worker – use the legacy build of pdf.js which runs in-process.
setPdfjsLoader(async () => (await import("pdfjs-dist/legacy/build/pdf.mjs")) as never);

// Validation: SaxonJS for Node + SEF files from public/rules (built by `pnpm rules:build`).
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { setValidationEnvironment } from "../src/core/validate";

const require = createRequire(import.meta.url);
const rules = join(import.meta.dirname, "../public/rules");
setValidationEnvironment({
  loadSaxon: async () => require("saxon-js"),
  loadManifest: async () => JSON.parse(await readFile(join(rules, "manifest.json"), "utf8")),
  loadSef: async (file) => JSON.parse(await readFile(join(rules, file), "utf8")),
});
