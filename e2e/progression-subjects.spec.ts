import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function readState(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve) => {
        const req = indexedDB.open("wortnah");
        req.onsuccess = () => {
          const db = req.result;
          const get = db
            .transaction("state")
            .objectStore("state")
            .get("current");
          get.onsuccess = () => {
            resolve(get.result);
            db.close();
          };
        };
      }),
  );
}
async function seedRecommendation(page: Page, level: "A1" | "A2" = "A2") {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  await page.evaluate(async (level) => {
    const content = await (await fetch("/content/course.json")).json();
    await new Promise<void>((resolve) => {
      const req = indexedDB.open("wortnah");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        const get = tx.objectStore("state").get("current");
        get.onsuccess = () => {
          const s = get.result;
          s.settings.level = level;
          s.settings.mode = "mixed";
          s.settings.timezone = "Europe/Berlin";
          s.settings.levelSuggestions = {};
          for (const pref of Object.values(s.preferences) as any[])
            pref.mode = "learn";
          s.preferences.business.level = "B2";
          s.events = content.targets
            .filter((t: any) => t.kind === "lexical" && t.level === level)
            .slice(0, 20)
            .flatMap((target: any, i: number) =>
              ["productive_recall", "receptive_recall"].map(
                (channel, direction) => ({
                  id: `recommend-${i}-${direction}`,
                  deviceId: s.deviceId,
                  sessionId: "earlier-practice",
                  targetId: target.id,
                  exercise: content.exercises.find(
                    (e: any) =>
                      e.targetId === target.id && e.channel === channel,
                  ),
                  index: i,
                  at: new Date(
                    Date.now() -
                      (direction ? 1 + (i % 2) : 5 + (i % 2)) * 86400000,
                  ).toISOString(),
                  day: "derive-from-timestamp",
                  good: true,
                  choice: null,
                  mode: "regular",
                  retry: false,
                  revokedAt: null,
                  engine: "ts-fsrs-5.4.2-retention-0.9",
                }),
              ),
            )
            .sort((a: any, b: any) => a.at.localeCompare(b.at));
          s.revision++;
          tx.objectStore("state").put(s, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, level);
  await page.reload();
  if (level === "A1")
    await expect(
      page.getByRole("region", { name: "Empfehlung zum Trainingslevel" }),
    ).toHaveCount(0);
  else
    await expect(
      page.getByRole("region", { name: "Empfehlung zum Trainingslevel" }),
    ).toBeVisible();
}

test("mixed practice starts at 80/20 with all vocabulary topics active and preserves its saved queue", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Für Jugendliche und Erwachsene mit Vorkenntnissen:", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Themen", exact: true })
    .click();
  const level = page.locator(".level-control");
  await expect(level.locator(".level-ticks button")).toHaveText([
    "B1",
    "B2",
    "C1",
    "C2",
  ]);
  await expect(
    level.getByRole("button", { name: "B1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Alle Themen aktivieren", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Alle Themen aktivieren?" })
    .getByRole("button", { name: "Ja", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Heute", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Training starten", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  const before = await readState(page);
  const queue = before.session.queue;
  expect(queue).toHaveLength(50);
  expect(queue.filter((q: any) => q.topicId === "grammar")).toHaveLength(10);
  for (let i = 0; i < 50; i += 5)
    expect(
      queue.slice(i, i + 5).filter((q: any) => q.topicId === "grammar"),
    ).toHaveLength(1);
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  expect((await readState(page)).session.queue).toEqual(queue);
});

test("level recommendation needs consent and preserves the current round and topic overrides", async ({
  page,
}) => {
  await seedRecommendation(page);
  const suggestion = page.getByRole("region", {
    name: "Empfehlung zum Trainingslevel",
  });
  await expect(suggestion).toContainText("Bereit für B1?");
  await expect(suggestion).toContainText("Wortschatz");
  expect((await readState(page)).settings.level).toBe("A2");
  await page
    .getByRole("button", { name: "Training starten", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  const before = await readState(page);
  await suggestion.getByRole("button", { name: "B1 ausprobieren" }).click();
  await expect
    .poll(async () => (await readState(page)).settings.level)
    .toBe("B1");
  const after = await readState(page);
  expect(after.session).toEqual(before.session);
  expect(after.memory).toEqual(before.memory);
  expect(after.events).toEqual(before.events);
  expect(after.preferences).toEqual(before.preferences);
  await expect(suggestion).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  expect((await readState(page)).settings.level).toBe("B1");
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Themen", exact: true })
    .click();
  await page
    .locator(".level-control")
    .getByRole("button", { name: "B2", exact: true })
    .click();
  await expect
    .poll(async () => (await readState(page)).settings.level)
    .toBe("B2");
  await page
    .locator(".level-control")
    .getByRole("button", { name: "B1", exact: true })
    .click();
  await expect
    .poll(async () => (await readState(page)).settings.level)
    .toBe("B1");
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Heute", exact: true })
    .click();
  await expect(suggestion).toHaveCount(0);
});

test("level advice fits narrow screens and Later persists without changing difficulty", async ({
  page,
}) => {
  await seedRecommendation(page);
  const suggestion = page.getByRole("region", {
    name: "Empfehlung zum Trainingslevel",
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await suggestion.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      suggestion.getByRole("button", { name: "B1 ausprobieren" }),
    ).toBeInViewport();
    await page.screenshot({
      path: `test-results/level-suggestion-${width}.png`,
      animations: "disabled",
    });
  }
  const before = await readState(page);
  await suggestion.getByRole("button", { name: "Später", exact: true }).click();
  await expect(suggestion).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  await expect(suggestion).toHaveCount(0);
  const after = await readState(page);
  expect(after.settings.level).toBe("A2");
  expect(after.events).toEqual(before.events);
  expect(
    Date.parse(after.settings.levelSuggestions.global.snoozedUntil),
  ).toBeGreaterThan(Date.now() + 6 * 86400000);
});

test("specialist topics are discoverable and their focused rounds work on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Themen", exact: true })
    .click();
  await page
    .locator(".level-control")
    .getByRole("button", { name: "C2", exact: true })
    .click();
  await expect
    .poll(async () => (await readState(page)).settings.level)
    .toBe("C2");
  const search = page.getByLabel("Themen suchen");
  const dialog = page.getByRole("dialog");
  for (const [query, topic, section, word] of [
    ["Gerichte", "Behörden & Recht", "civic.courts", "judge"],
    ["Verträge", "Behörden & Recht", "civic.contracts", "breach of contract"],
    [
      "Volkswirtschaft",
      "Wirtschaft & Unternehmen",
      "business.economy",
      "gross domestic product",
    ],
    [
      "Controlling",
      "Wirtschaft & Unternehmen",
      "business.accounting",
      "contribution margin",
    ],
    [
      "Investitionen",
      "Wirtschaft & Unternehmen",
      "business.investment",
      "return on investment",
    ],
    [
      "Prozesse",
      "Wirtschaft & Unternehmen",
      "business.processes",
      "supply chain",
    ],
    [
      "Psychologie",
      "Menschen & Gefühle",
      "people.psychology",
      "cognitive bias",
    ],
    ["Krankenhaus", "Körper & Gesundheit", "body.hospital", "ward"],
    ["Mathematik", "Wissenschaft & Umwelt", "science.math", "proof"],
    ["Physik", "Wissenschaft & Umwelt", "science.physics", "velocity"],
    ["Labor", "Wissenschaft & Umwelt", "science.lab", "conical flask"],
  ]) {
    await search.fill(query);
    await page
      .locator(".topic-card")
      .filter({ has: page.getByRole("heading", { name: topic, exact: true }) })
      .locator(".topic-open")
      .click();
    await dialog.getByLabel("Unterthema auswählen").selectOption(section);
    await expect(dialog.locator(".topic-word-list")).toContainText(word);
    await page.keyboard.press("Escape");
  }
  await search.fill("Controlling");
  await page.locator(".topic-open").click();
  await dialog.getByRole("switch").click();
  await expect(dialog.getByRole("switch")).toBeChecked();
  await dialog
    .getByLabel("Unterthema auswählen")
    .selectOption("business.accounting");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: "test-results/business-content-320.png",
    animations: "disabled",
  });
  await dialog
    .getByRole("button", { name: "Unterthema trainieren", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  await expect(page.locator(".training-topic")).toContainText(
    "Controlling & Rechnungswesen",
  );
  expect((await readState(page)).session.subtopicId).toBe(
    "business.accounting",
  );
  await page
    .getByRole("button", { name: "Antwort zeigen", exact: true })
    .click();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect.poll(async () => (await readState(page)).events.length).toBe(1);
});

for (const previousLevel of ["A1", "A2"] as const)
  test(`training starts at B1 while legacy ${previousLevel} profiles remain intact until a deliberate change`, async ({
    page,
  }) => {
    await seedRecommendation(page, previousLevel);
    const before = await readState(page);
    await page
      .getByRole("navigation", { name: "Hauptnavigation" })
      .getByRole("button", { name: "Themen", exact: true })
      .click();
    const control = page.locator(".level-control");
    await expect(control.locator(".level-ticks button")).toHaveText([
      "B1",
      "B2",
      "C1",
      "C2",
    ]);
    await expect(control.getByRole("slider")).toHaveCount(0);
    await expect(control).toContainText(
      `Deine bisherige ${previousLevel}-Einstellung bleibt erhalten`,
    );
    expect((await readState(page)).settings.level).toBe(previousLevel);
    await page.locator(".topic-card").first().locator(".topic-open").click();
    const topicDialog = page.getByRole("dialog");
    await topicDialog.getByLabel("Eigenes Level für dieses Thema").check();
    await expect
      .poll(async () => (await readState(page)).preferences.home.level)
      .toBe("B1");
    await expect(topicDialog.locator(".level-ticks button")).toHaveText([
      "B1",
      "B2",
      "C1",
      "C2",
    ]);
    await topicDialog.getByLabel("Eigenes Level für dieses Thema").uncheck();
    await expect
      .poll(async () => (await readState(page)).preferences.home.level)
      .toBeNull();
    await page.keyboard.press("Escape");
    await control.getByRole("button", { name: "B1", exact: true }).click();
    await expect
      .poll(async () => (await readState(page)).settings.level)
      .toBe("B1");
    const slider = control.getByRole("slider");
    await expect(slider).toBeEnabled();
    await expect(slider).toHaveAttribute("min", "0");
    await expect(slider).toHaveAttribute("max", "3");
    await slider.press("End");
    await expect
      .poll(async () => (await readState(page)).settings.level)
      .toBe("C2");
    await expect(slider).toBeEnabled();
    await slider.press("Home");
    await expect
      .poll(async () => (await readState(page)).settings.level)
      .toBe("B1");
    await expect(slider).toBeEnabled();
    await slider.press("ArrowLeft");
    expect((await readState(page)).settings.level).toBe("B1");
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await control.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/positioning-levels-${previousLevel}-${width}.png`,
        animations: "disabled",
      });
    }
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Dein Lernheft." }),
    ).toBeVisible();
    const after = await readState(page);
    expect(after.settings.level).toBe("B1");
    expect(after.events).toEqual(before.events);
    expect(after.preferences).toEqual(before.preferences);
  });
