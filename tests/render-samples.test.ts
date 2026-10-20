import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { loadDocument } from "../src/core/load";
import { validateInvoice } from "../src/core/validate";
import { buildPdfDefinition, renderPdf } from "../src/export/pdf";
import { FIXTURES, getNodePdfMake, readFixture } from "./helpers";

const out = process.env.RENDER_OUT;
it.skipIf(!out)("renders sample PDFs", async () => {
  for (const f of (process.env.RENDER_FILES ?? "").split(",").filter(Boolean)) {
    const doc = await loadDocument(readFixture(join(FIXTURES, f)), f);
    const report = await validateInvoice(doc.xml, doc.invoice);
    const bytes = await renderPdf(getNodePdfMake(), buildPdfDefinition(doc, { report }));
    writeFileSync(join(out!, `${f.replace(/[/\\]/g, "_")}.pdf`), bytes);
  }
});
