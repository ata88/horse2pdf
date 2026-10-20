import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const fixture = (rel: string) => join(import.meta.dirname, "../tests/fixtures", rel);

/** Opens a file through the toolbar's "Öffnen" button (native file chooser). */
export async function openViaDialog(page: Page, rel: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("open").click();
  await (await chooser).setFiles(fixture(rel));
  await expect(
    page.locator(".app").getByTestId("invoice-sheet").or(page.getByTestId("load-error")),
  ).toBeVisible();
}

/** Simulates dropping a file onto the window. */
export async function dropFile(page: Page, rel: string, name = rel.split("/").pop()!) {
  const b64 = readFileSync(fixture(rel)).toString("base64");
  await page.evaluate(
    ({ b64, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name));
      for (const type of ["dragenter", "dragover", "drop"]) {
        window.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
      }
    },
    { b64, name },
  );
}

export async function waitForValidation(page: Page) {
  await expect(page.getByTestId("validation-badge")).not.toContainText("Prüfe", { timeout: 60_000 });
}
