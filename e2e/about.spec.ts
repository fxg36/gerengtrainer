import { test, expect } from "@playwright/test";

test("about explains methods and limits, keeps licenses offline and stays readable on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".brand")).toContainText("Einfach Englisch");
  await expect(
    page.getByText(/PWA · Testversion|Gut zu wissen|Englischklar/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Über die App", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Über Einfach Englisch" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Du sprichst schon etwas Englisch");
  await expect(dialog.getByRole("link", { name: /Roediger/ })).toHaveAttribute(
    "href",
    "https://pubmed.ncbi.nlm.nih.gov/16507066/",
  );
  await dialog
    .getByText("Die konkreten Lernparameter", { exact: true })
    .click();
  await expect(dialog).toContainText("90 % Ziel-Erinnerung");
  await expect(dialog).toContainText("60 % Schwerpunkt · 40 % Grundlagen");
  await dialog
    .getByText("Inhalte, Quellen und Qualität", { exact: true })
    .click();
  await expect(dialog).toContainText("54 Grammatikziele");
  await expect(dialog).toContainText("170 Schreibaufgaben");
  await dialog
    .getByRole("button", { name: "Vollständige Quellen- und Lizenzhinweise" })
    .click();
  await expect(dialog.locator(".about-licenses")).toContainText("Wiktionary");
  // Test both phone widths without touching the user's real browser profile.
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await dialog.evaluate((el) => {
      el.scrollTop = 0;
    });
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/about-${width}.png` });
  }
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("native safe-area styles reserve room for system bars and the bottom navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".topbar")).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.classList.add("native-app");
    document.documentElement.style.setProperty("--safe-area-inset-top", "44px");
    document.documentElement.style.setProperty(
      "--safe-area-inset-bottom",
      "34px",
    );
  });
  expect(
    await page
      .locator(".topbar")
      .evaluate((el) => getComputedStyle(el).paddingTop),
  ).toBe("44px");
  expect(
    await page
      .locator(".mobile-dock")
      .evaluate((el) => getComputedStyle(el).paddingBottom),
  ).toBe("42px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/native-insets-390.png" });
});
