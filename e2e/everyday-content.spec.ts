import { expect, test } from "@playwright/test";

test("restaurant and hotel situations are discoverable and train offline on a narrow screen", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Themen", exact: true })
    .click();
  const search = page.getByRole("textbox", { name: "Themen suchen" });
  await search.fill("Restaurant");
  await expect(page.locator(".topic-card")).toHaveCount(1);
  await page.locator(".topic-open").click();
  const dialog = page.getByRole("dialog");
  const sections = dialog.getByLabel("Unterthema auswählen");
  await expect(
    sections.locator("option[value='food.restaurant']"),
  ).toContainText("Restaurant: reservieren, bestellen & bezahlen");
  await expect(sections.locator("option[value='food.dietary']")).toContainText(
    "Allergien",
  );
  await expect(sections.locator("option[value='food.cafe']")).toContainText(
    "Café",
  );
  await page.keyboard.press("Escape");
  await search.fill("Hotel");
  await expect(page.locator(".topic-card")).toHaveCount(1);
  await page.locator(".topic-open").click();
  await dialog.getByRole("switch").click();
  await expect(dialog.getByRole("switch")).toBeChecked();
  await sections.selectOption("travel.hotel");
  await expect(dialog.locator(".topic-word-list")).toContainText("check in");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/hotel-situations-320.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await dialog
    .getByRole("button", { name: "Unterthema trainieren", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  await expect(page.locator(".training-topic")).toContainText(
    "Hotel & Unterkunft",
  );
  await page
    .getByRole("button", { name: "Antwort zeigen", exact: true })
    .click();
  await expect(page.locator(".answer-reveal")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/hotel-practice-320.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Hauptnavigation" }),
  ).toBeAttached();
  await page.getByRole("button", { name: "Menü öffnen", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Themen", exact: true })
    .click();
  await search.fill("Hotel");
  await page.locator(".topic-open").click();
  await sections.selectOption("travel.hotel");
  await dialog
    .getByRole("button", { name: "Unterthema fortsetzen", exact: true })
    .click();
  await expect(page.locator(".answer-reveal")).toBeVisible();
});
