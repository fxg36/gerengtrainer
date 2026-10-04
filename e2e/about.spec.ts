import { test, expect } from "./fixtures";

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
  await expect(dialog).toContainText(
    "Jugendliche und Erwachsene mit Vorkenntnissen",
  );
  await expect(dialog).toContainText("B1 bis C2");
  await expect(dialog.getByRole("link", { name: /Roediger/ })).toHaveAttribute(
    "href",
    "https://pubmed.ncbi.nlm.nih.gov/16507066/",
  );
  await dialog
    .getByText("Die konkreten Lernparameter", { exact: true })
    .click();
  await expect(dialog).toContainText("90 % Ziel-Erinnerung");
  await expect(dialog).toContainText("80 % Wortschatz · 20 % Grammatik");
  await expect(dialog).toContainText("60 % Schwerpunkt · 40 % Grundlagen");
  await dialog
    .getByText("Inhalte, Quellen und Qualität", { exact: true })
    .click();
  await expect(dialog).toContainText("54 Grammatikziele");
  await expect(dialog).toContainText("170 Schreibaufgaben");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.context().setOffline(true);
  await dialog
    .getByRole("button", { name: "Vollständige Quellen- und Lizenzhinweise" })
    .click();
  await expect(dialog.locator(".about-licenses")).toContainText("Wiktionary");
  await expect(dialog.locator(".about-licenses")).toContainText(
    "@capacitor/core",
  );
  await expect(dialog.locator(".about-licenses")).toContainText("scheduler");
  await expect(dialog.locator(".about-licenses")).toContainText(
    "workbox-precaching",
  );
  await dialog
    .getByText("Creative Commons Attribution-ShareAlike 4.0 International", {
      exact: true,
    })
    .click();
  await expect(
    dialog.locator(".about-license-text").filter({ hasText: "Section 3" }),
  ).toBeVisible();
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

test("closed mobile navigation is absent from accessibility navigation and keyboard order", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menü öffnen", exact: true });
  await expect(menu).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Hauptnavigation" }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(menu).toBeFocused();
  await menu.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Hauptnavigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Menü schließen", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Wörterbuch", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Hauptnavigation" }),
  ).toHaveCount(0);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
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
