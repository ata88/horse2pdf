import { setPdfjsLoader } from "../src/core/pdf";

// Node has no web worker – use the legacy build of pdf.js which runs in-process.
setPdfjsLoader(async () => (await import("pdfjs-dist/legacy/build/pdf.mjs")) as never);
