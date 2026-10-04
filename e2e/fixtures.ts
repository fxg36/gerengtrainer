import { test as base, expect, type Page } from "@playwright/test";

// Existing flow tests explicitly dismiss onboarding. Tour behavior is tested
// separately with the unmodified Playwright fixture in engagement.spec.ts.
export async function dismissTourWhenShown(page: Page) {
  const tour = page.getByRole("dialog", { name: "Deine kurze App-Tour" });
  await page.addLocatorHandler(tour, async () => {
    await tour
      .getByRole("button", { name: "Tour überspringen", exact: true })
      .click();
    await expect(tour).not.toBeVisible();
  });
}
export const test = base.extend({
  page: async ({ page }, use) => {
    await dismissTourWhenShown(page);
    await use(page);
  },
});
export { expect };
