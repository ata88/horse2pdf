import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { dropFile, fixture, openViaDialog, waitForValidation } from "./helpers";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  test.info().annotations.push({ type: "errors", description: "" });
  // fail the test on uncaught errors and CSP violations
  page.on("close", () => expect(errors, "console errors").toEqual([]));
});

test("welcome screen offers opening a file", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "E-Rechnung hierher ziehen" })).toBeVisible();
  await expect(page.getByTestId("open")).toBeVisible();
});

test("shows an XRechnung (UBL) with all key data and validates it", async ({ page }) => {
  await openViaDialog(page, "custom/orgaMAX_Beispielrechnung_XRechnung.xml");
  await expect(page.getByTestId("profile")).toHaveText("XRechnung 3.0");
  const facts = page.getByTestId("header-facts");
  await expect(facts).toContainText("000073");
  await expect(facts).toContainText("07.01.2025");
  await expect(facts).toContainText("21.01.2025");
  await expect(facts).toContainText("K2624326-04716");
  await expect(page.getByTestId("lines").getByTestId("line")).toHaveCount(2);
  await expect(page.getByTestId("totals")).toContainText("504,20 €");
  await expect(page.getByTestId("totals")).toContainText("95,80 €");
  await expect(page.getByTestId("totals")).toContainText("600,00 €");
  await expect(page.getByTestId("payment")).toContainText("DE02 1203 0000 0000 2020 51");
  await expect(page.getByTestId("girocode").locator("img")).toBeVisible();
  await waitForValidation(page);
  await expect(page.getByTestId("validation-badge")).toHaveText(/Gültig/);
});

test("extracts and shows a ZUGFeRD PDF incl. the original PDF", async ({ page }) => {
  await openViaDialog(page, "zugferd/zugferd_2p0_EN16931_Einfach.pdf");
  await expect(page.getByTestId("profile")).toHaveText("ZUGFeRD / Factur-X EN 16931");
  await expect(page.getByTestId("header-facts")).toContainText("471102");
  await page.getByTestId("tab-original").click();
  await expect(page.getByTestId("pdf-pages").locator("img").first()).toBeVisible();
  expect(await page.getByTestId("pdf-pages").locator("img").count()).toBeGreaterThan(0);
  await page.getByTestId("tab-xml").click();
  await expect(page.getByTestId("xml")).toContainText("CrossIndustryInvoice");
});

test("opens files via drag & drop (CII and Peppol)", async ({ page }) => {
  await dropFile(page, "xrechnung/01.01a-INVOICE_uncefact.xml");
  await expect(page.getByTestId("profile")).toHaveText("XRechnung 3.0");
  await expect(page.getByTestId("header-facts")).toContainText("123456XX");
  await dropFile(page, "peppol/base-example.xml");
  await expect(page.getByTestId("profile")).toHaveText("Peppol BIS Billing 3.0");
  await expect(page.getByTestId("header-facts")).toContainText("Snippet1");
});

test("shows sub lines of the XRechnung extension", async ({ page }) => {
  await openViaDialog(page, "xrechnung/04.01a-INVOICE_ubl.xml");
  await page.getByTestId("tab-lines").click();
  await expect(page.getByTestId("line")).toHaveCount(15);
  await page.getByLabel("Positionen durchsuchen").fill("Heizung");
  await expect(page.getByTestId("line").first()).toContainText("Heizung");
});

test("lists validation errors of an invalid invoice", async ({ page }) => {
  await openViaDialog(page, "zugferd/Avoir_FR_type381_BASIC.pdf");
  await waitForValidation(page);
  await expect(page.getByTestId("validation-badge")).toHaveText(/Fehler/);
  await page.getByTestId("tab-validation").click();
  await expect(page.getByTestId("validation-title")).toHaveText("Die E-Rechnung ist nicht gültig");
  await expect(page.getByTestId("issue").first()).toContainText("CII-DT-031");
});

test("details tab lists every business term and is searchable", async ({ page }) => {
  await openViaDialog(page, "custom/orgaMAX_Beispielrechnung_XRechnung.xml");
  await page.getByTestId("tab-details").click();
  await expect(page.getByTestId("seller")).toContainText("313/5766/0931");
  await page.getByLabel("Alle Angaben durchsuchen").fill("BT-115");
  await expect(page.getByTestId("all-terms")).toContainText("Zahlbetrag");
  await expect(page.getByTestId("all-terms")).toContainText("600");
});

test("exports the generated PDF with the embedded XML", async ({ page }) => {
  await openViaDialog(page, "custom/orgaMAX_Beispielrechnung_XRechnung.xml");
  await waitForValidation(page);
  await page.getByTestId("export").click();
  const download = page.waitForEvent("download");
  await page.getByTestId("export-generated").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Rechnung_000073.pdf");
  const bytes = readFileSync((await file.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(20_000);
});

test("saves the original ZUGFeRD PDF unchanged", async ({ page }) => {
  await openViaDialog(page, "zugferd/zugferd_2p0_EN16931_Einfach.pdf");
  await page.getByTestId("export").click();
  const download = page.waitForEvent("download");
  await page.getByTestId("export-original").click();
  const bytes = readFileSync((await (await download).path())!);
  expect(bytes.equals(readFileSync(fixture("zugferd/zugferd_2p0_EN16931_Einfach.pdf")))).toBe(true);
});

test("prints the generated view and the original PDF", async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as { printCalls: number }).printCalls = 0;
    window.print = () => {
      (window as unknown as { printCalls: number }).printCalls++;
    };
  });
  await openViaDialog(page, "custom/orgaMAX_Beispielrechnung_XRechnung.xml");
  await page.getByTestId("print").click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls))
    .toBe(1);
  await expect(page.locator(".print-root")).toHaveCount(0);

  await openViaDialog(page, "zugferd/zugferd_2p0_EN16931_Einfach.pdf");
  await page.getByTestId("print").click();
  await page.getByTestId("print-original").click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls))
    .toBe(2);
});

test("shows a helpful error for files that are not e-invoices", async ({ page }) => {
  await openViaDialog(page, "README.md");
  await expect(page.getByTestId("load-error")).toContainText("kein gültiges XML");
});
