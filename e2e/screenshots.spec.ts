/**
 * Generates the screenshots used in README.md (not part of the normal test run):
 *   SCREENSHOTS=1 pnpm test:e2e screenshots
 */
import { expect, test } from "@playwright/test";
import { openViaDialog, waitForValidation } from "./helpers";

test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate docs/screenshots");
test.use({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });

const shot = (name: string) => `docs/screenshots/${name}.png`;

test("readme screenshots", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: shot("welcome") });

  await openViaDialog(page, "custom/demo-xrechnung.xml");
  await waitForValidation(page);
  await page.screenshot({ path: shot("overview") });
  await page.getByTestId("tab-details").click();
  await page.screenshot({ path: shot("details") });
  await page.getByTestId("tab-validation").click();
  await page.screenshot({ path: shot("validation") });

  await openViaDialog(page, "zugferd/zugferd_2p0_EN16931_Einfach.pdf");
  await page.getByTestId("tab-original").click();
  await expect(page.getByTestId("pdf-pages").locator("img").first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot("zugferd-original") });

  await openViaDialog(page, "xrechnung/04.05a-INVOICE_uncefact.xml");
  await waitForValidation(page);
  await page.getByTestId("tab-validation").click();
  await page.screenshot({ path: shot("validation-errors") });
});
