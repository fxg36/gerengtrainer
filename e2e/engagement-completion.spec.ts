import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function state(page: Page) {
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
async function nav(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Menü öffnen", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function start(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Themen auswählen", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Zuhause & Wohnen aktiv", exact: true })
    .click();
  await nav(page, "Heute");
  await page
    .getByRole("button", { name: "Training starten", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
}
async function answer(page: Page) {
  await expect(page.locator(".exercise-card")).toBeVisible();
  const before = await state(page);
  const reveal = page.getByRole("button", {
    name: "Antwort zeigen",
    exact: true,
  });
  if (await reveal.isVisible()) await reveal.click();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).events.length)
    .toBe(before.events.length + 1);
}
async function seed(page: Page, mode: "goal" | "estimate") {
  await page.evaluate(async (mode) => {
    const content = await (await fetch("/content/course.json")).json();
    await new Promise<void>((resolve) => {
      const req = indexedDB.open("wortnah");
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("state", "readwrite");
        const get = tx.objectStore("state").get("current");
        get.onsuccess = () => {
          const s = get.result;
          s.settings.timezone = "Europe/Berlin";
          s.events = [];
          s.celebratedAchievements = [];
          const add = (e: any, at: number) =>
            s.events.push({
              id: `seed-${s.events.length}`,
              deviceId: s.deviceId,
              sessionId: "earlier-practice",
              targetId: e.targetId,
              exercise: e,
              index: s.events.length,
              at: new Date(at).toISOString(),
              day: "derived",
              good: true,
              choice: e.mode === "choice" ? e.answer : null,
              mode: "regular",
              retry: false,
              revokedAt: null,
              engine: "ts-fsrs-5.4.2-retention-0.9",
            });
          if (mode === "goal") {
            s.settings.dailyCardGoal = 30;
            const reserved = new Set(
              s.session.queue.map((q: any) => q.exercise.targetId),
            );
            content.exercises
              .filter(
                (e: any) =>
                  e.channel === "productive_recall" &&
                  !reserved.has(e.targetId),
              )
              .slice(0, 29)
              .forEach((e: any) => add(e, Date.now() - 60000));
          } else {
            s.settings.level = "C2";
            for (const kind of ["lexical", "grammar"]) {
              const targets = content.targets
                .filter((t: any) => t.kind === kind && t.level === "B1")
                .slice(0, kind === "lexical" ? 20 : 5);
              const channels =
                kind === "lexical"
                  ? ["productive_recall", "receptive_recall"]
                  : ["grammar_production", "grammar_recognition"];
              for (let day = 1; day <= (kind === "lexical" ? 2 : 4); day++)
                targets.forEach((target: any, i: number) => {
                  channels.forEach((channel, direction) => {
                    if (kind === "lexical" && direction !== day - 1) return;
                    add(
                      content.exercises.find(
                        (e: any) =>
                          e.targetId === target.id && e.channel === channel,
                      ),
                      Date.now() -
                        (kind === "lexical" ? day * 3 + (i % 2) : day) *
                          86400000,
                    );
                  });
                });
            }
          }
          s.events.sort((a: any, b: any) => a.at.localeCompare(b.at));
          s.revision++;
          tx.objectStore("state").put(s, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, mode);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
}

test("new achievements appear once without interrupting training and survive undo and reload", async ({
  page,
}) => {
  await start(page);
  await answer(page);
  const notice = page.getByRole("region", { name: "Neuer Meilenstein" });
  await expect(notice).toContainText("Erster Schritt");
  await expect(page.locator(".exercise-card")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(() => scrollTo(0, 0));
    await expect(
      notice.getByRole("button", { name: "Erfolgshinweis schließen" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/achievement-notice-${width}.png`,
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await answer(page);
  await expect(notice).toHaveCount(0);
  expect((await state(page)).celebratedAchievements).toEqual(["cards-1"]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  await expect(notice).toHaveCount(0);
  await nav(page, "Meilensteine");
  await expect(
    page.getByRole("article", { name: "Erster Schritt", exact: true }),
  ).toHaveClass(/earned/);
});

test("reaching a daily goal awards a persisted badge and its notice opens milestones without losing the round", async ({
  page,
}) => {
  await start(page);
  await seed(page, "goal");
  await expect(
    page.getByRole("region", { name: "Neuer Meilenstein" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await answer(page);
  const after = await state(page);
  expect(after.events.at(-1).dailyGoal).toBe(30);
  expect(after.celebratedAchievements).toContain("goals-1");
  const notice = page.getByRole("region", { name: "Neuer Meilenstein" });
  await expect(notice).toContainText("Erstes Tagesziel");
  await notice.getByRole("button", { name: "Ansehen", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "Erstes Tagesziel", exact: true }),
  ).toHaveClass(/earned/);
  await nav(page, "Heute");
  const slider = page.getByRole("slider", {
    name: "Tagesziel in Karten",
    exact: true,
  });
  await slider.focus();
  await slider.press("End");
  await expect(slider).toBeEnabled();
  await expect
    .poll(async () => (await state(page)).settings.dailyCardGoal)
    .toBe(250);
  await nav(page, "Meilensteine");
  await expect(
    page.getByRole("article", { name: "Erstes Tagesziel", exact: true }),
  ).toHaveClass(/earned/);
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  expect((await state(page)).session.id).toBe(after.session.id);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await nav(page, "Meilensteine");
  await expect(
    page.getByRole("article", { name: "Erstes Tagesziel", exact: true }),
  ).toHaveClass(/locked/);
});

test("daily expression is stable on reload and changes at local midnight without adding reviews", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-04T21:58:00Z") });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  // Set the test profile timezone explicitly for machines outside Germany.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("wortnah");
        req.onsuccess = () => {
          const db = req.result,
            tx = db.transaction("state", "readwrite"),
            get = tx.objectStore("state").get("current");
          get.onsuccess = () => {
            const s = get.result;
            s.settings.timezone = "Europe/Berlin";
            s.revision++;
            tx.objectStore("state").put(s, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  const expression = page.getByRole("region", { name: "Ausdruck des Tages" });
  const heading = expression.getByRole("heading");
  const first = await heading.innerText();
  await page.reload();
  await expect(heading).toHaveText(first);
  await page.clock.fastForward(3 * 60 * 1000);
  await expect(heading).not.toHaveText(first);
  const next = await heading.innerText();
  await expression.getByRole("button", { name: "Ausdruck entdecken" }).click();
  await expect(page.getByRole("dialog")).toContainText(next);
  expect((await state(page)).events).toHaveLength(0);
});

test("training estimate reflects observed vocabulary and grammar instead of selected level", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  await seed(page, "estimate");
  await expect(
    page.getByRole("region", { name: "Neuer Meilenstein" }),
  ).toHaveCount(0);
  await nav(page, "Fortschritt");
  const estimate = page.getByRole("region", {
    name: "Geschätzter Trainingsstand",
  });
  await expect(estimate.getByRole("heading")).toHaveText(
    "Textübungen: etwa B1",
  );
  for (const name of ["Wortschatz-Einschätzung", "Grammatik-Einschätzung"])
    await expect(estimate.getByRole("article", { name })).toContainText(
      "Wahrscheinlich B1",
    );
  await expect(estimate).toContainText("kein Sprachtest");
  expect((await state(page)).settings.level).toBe("C2");
  await estimate
    .getByText("Wie entsteht die Einschätzung?", { exact: true })
    .click();
  await expect(estimate).toContainText("Selbstbewertungen fließen mit ein");
  await estimate
    .getByText("Wie entsteht die Einschätzung?", { exact: true })
    .click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await estimate.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/training-estimate-${width}.png`,
      animations: "disabled",
    });
  }
});
