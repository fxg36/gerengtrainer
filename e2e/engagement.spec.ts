import { test, expect, type Page } from "@playwright/test";

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
async function skipTour(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Deine kurze App-Tour" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Tour überspringen" }).click();
  await expect(dialog).not.toBeVisible();
}
async function menu(page: Page) {
  const opener = page.getByRole("button", { name: "Menü öffnen", exact: true });
  if (await opener.isVisible()) await opener.click();
}
async function firstRound(page: Page) {
  await page
    .getByRole("button", { name: "Themen auswählen", exact: true })
    .click();
  const toggle = page.getByRole("switch", {
    name: "Zuhause & Wohnen aktiv",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Heute", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Training starten", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
}
async function answer(page: Page) {
  const previous = await readState(page);
  const exercise = previous.session.queue[previous.session.index].exercise;
  if (exercise.mode === "choice")
    await page
      .getByRole("button", { name: exercise.answer, exact: true })
      .click();
  else {
    await page
      .getByRole("button", { name: "Antwort zeigen", exact: true })
      .click();
    await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  }
  await expect
    .poll(async () => (await readState(page)).events.length)
    .toBe(previous.events.length + 1);
}

test("first tour can be skipped, replayed and explored without changing learning data on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto("/");
  await skipTour(page);
  const before = await readState(page);
  expect(before.settings.tourVersion).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await menu(page);
  await page.getByRole("button", { name: "App-Tour", exact: true }).click();
  const tour = page.getByRole("dialog", { name: "Deine kurze App-Tour" });
  await expect(tour).toContainText("Jugendliche und Erwachsene");
  await tour.getByRole("button", { name: "Weiter", exact: true }).click();
  await tour.getByRole("button", { name: "Beispiel aufdecken" }).click();
  await expect(
    tour.getByText("Could we have the bill, please?", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/tour-example-320.png",
    animations: "disabled",
  });
  await expect(
    tour.getByRole("button", { name: "Weiter", exact: true }),
  ).toBeInViewport();
  await expect(
    tour.getByRole("button", { name: "Tour überspringen" }),
  ).toBeInViewport();
  await tour.getByRole("button", { name: "Zurück", exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await tour.getByRole("button", { name: "Weiter", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await tour
    .getByRole("button", { name: "Ziel speichern", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    tour.getByRole("button", { name: "Ziel speichern", exact: true }),
  ).toBeInViewport();
  await tour
    .getByRole("slider", { name: "Tagesziel in Karten" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/tour-daily-goal-mobile.png",
    animations: "disabled",
  });
  await tour
    .getByRole("button", { name: "Ziel speichern", exact: true })
    .click();
  await expect(tour).not.toBeVisible();
  const after = await readState(page);
  expect(after.events).toEqual(before.events);
  expect(after.memory).toEqual(before.memory);
  expect(after.preferences).toEqual(before.preferences);
  expect(after.session).toBeNull();
  await menu(page);
  await page.getByRole("button", { name: "App-Tour", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(tour).not.toBeVisible();
});

test("finishing the first tour leads to the sole topic selection without presetting topics", async ({
  page,
}) => {
  await page.goto("/");
  const tour = page.getByRole("dialog", { name: "Deine kurze App-Tour" });
  await expect(tour).toBeVisible();
  await page.screenshot({
    path: "test-results/tour-welcome-desktop.png",
    animations: "disabled",
  });
  for (let i = 0; i < 4; i++)
    await tour.getByRole("button", { name: "Weiter", exact: true }).click();
  const goal = tour.getByRole("slider", { name: "Tagesziel in Karten" });
  for (let i = 0; i < 6; i++) await goal.press("ArrowRight");
  await expect(goal).toHaveAttribute("aria-valuenow", "80");
  await tour.getByRole("button", { name: "Ziel speichern" }).click();
  await expect(
    page.getByRole("heading", { name: "Womit beschäftigst du dich?" }),
  ).toBeVisible();
  const state = await readState(page);
  expect(state.settings.tourVersion).toBe(1);
  expect(state.settings.dailyCardGoal).toBe(80);
  expect(
    Object.values(state.preferences).every((p: any) => p.mode === "paused"),
  ).toBe(true);
  expect(state.events).toEqual([]);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("slider", { name: "Tagesziel in Karten" }),
  ).toHaveAttribute("aria-valuenow", "80");
});

test("daily activity updates immediately, supports undo and stays independent of round planning", async ({
  page,
}) => {
  await page.goto("/");
  await skipTour(page);
  await firstRound(page);
  await page.evaluate(async () => {
    const content = await (await fetch("/content/course.json")).json();
    const req = indexedDB.open("wortnah");
    await new Promise<void>((resolve) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        const get = tx.objectStore("state").get("current");
        get.onsuccess = () => {
          const s = get.result;
          const reserved = new Set(
            s.session.queue.map((q: any) => q.exercise.targetId),
          );
          s.events = content.exercises
            .filter(
              (e: any) => e.mode === "recall" && !reserved.has(e.targetId),
            )
            .slice(0, 29)
            .map((e: any, i: number) => ({
              id: `goal-seed-${i}`,
              deviceId: s.deviceId,
              sessionId: "previous-round",
              targetId: e.targetId,
              exercise: e,
              index: i,
              at: new Date(Date.now() - 60000).toISOString(),
              day: "ignored-imported-day",
              good: true,
              choice: null,
              mode: "regular",
              retry: false,
              revokedAt: null,
              engine: "ts-fsrs-5.4.2-retention-0.9",
            }));
          s.settings.timezone = "Europe/Berlin";
          s.revision++;
          tx.objectStore("state").put(s, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  });
  await page.reload();
  const overview = page.getByRole("region", { name: "Dein Lernmoment" });
  const activity = overview.getByRole("region", {
    name: "Heute geübt",
    exact: true,
  });
  await expect(activity.getByText("29 Karten", { exact: true })).toBeVisible();
  await expect(overview.getByRole("progressbar")).toHaveAttribute(
    "value",
    "29",
  );
  await expect(overview).toContainText("29 von 50 Karten");
  await expect(
    activity.getByText("Tagesziel noch offen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Was zählt als Karte?", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Training fortsetzen", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Nächste Runde öffnen", exact: true }),
  ).toHaveCount(0);
  await overview.getByRole("button", { name: "Training fortsetzen" }).click();
  await answer(page);
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 30 / 50 Karten",
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 29 / 50 Karten",
  );
  // Undo preserves the revealed answer; submit it once more.
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 30 / 50 Karten",
  );
  await answer(page);
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 31 / 50 Karten",
  );
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await expect(activity).toContainText("31 Karten");
  const quota = page.getByRole("region", {
    name: "Dein kostenloses Kontingent",
  });
  const quotaBefore = await quota.innerText();
  const sessionBefore = (await readState(page)).session;
  const goal = page.getByRole("slider", { name: "Tagesziel in Karten" });
  await goal.press("Home");
  await expect
    .poll(async () => (await readState(page)).settings.dailyCardGoal)
    .toBe(30);
  await expect(
    activity.getByText("Tagesziel erreicht", { exact: true }),
  ).toBeVisible();
  await expect(activity.getByRole("progressbar")).toHaveAttribute("max", "30");
  await expect(activity.getByRole("progressbar")).toHaveAttribute(
    "value",
    "30",
  );
  await expect(activity).toContainText("31 von 30 Karten");
  await expect(
    page.getByRole("button", { name: "Freiwillig weiterüben", exact: true }),
  ).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/today-goal-reached.png",
    animations: "disabled",
  });
  await expect(goal).toBeEnabled();
  await goal.press("End");
  await expect
    .poll(async () => (await readState(page)).settings.dailyCardGoal)
    .toBe(250);
  await expect(activity).toContainText("31 Karten");
  await expect(
    activity.getByText("Tagesziel noch offen", { exact: true }),
  ).toBeVisible();
  await expect(activity.getByRole("progressbar")).toHaveAttribute("max", "250");
  await expect(activity.getByRole("progressbar")).toHaveAttribute(
    "value",
    "31",
  );
  await expect(
    page.getByRole("button", { name: "Training fortsetzen", exact: true }),
  ).toHaveCount(1);
  await expect(quota).toHaveText(quotaBefore, { useInnerText: true });
  expect((await readState(page)).session).toEqual(sessionBefore);
  await expect(page.locator(".daily-goal-control")).toContainText(
    "keine Sperre",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(overview.locator(".achievement-card")).toHaveCount(0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/daily-activity-${width}.png`,
      animations: "disabled",
    });
  }
});

test("returning after a break shows saved activity and resumes the recommended round", async ({
  page,
}) => {
  await page.goto("/");
  await skipTour(page);
  await firstRound(page);
  await answer(page);
  const before = await readState(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("wortnah");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("state", "readwrite");
          const get = tx.objectStore("state").get("current");
          get.onsuccess = () => {
            const s = get.result;
            s.events[0].at = new Date(Date.now() - 7 * 86400000).toISOString();
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
  await expect(
    page.getByRole("heading", { name: "Schön, dass du wieder da bist." }),
  ).toBeVisible();
  await expect(page.getByText(/Zuletzt hast du vor 7 Tagen/)).toBeVisible();
  await page.screenshot({
    path: "test-results/returning-learner.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Training fortsetzen" }).click();
  const after = await readState(page);
  expect(after.session.id).toBe(before.session.id);
  expect(after.session.index).toBe(before.session.index);
  expect(after.memory).toEqual(before.memory);
  expect(after.events).toHaveLength(1);
});

test("milestones have their own menu page, earned filters and persistent achievements on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await skipTour(page);
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  await page
    .getByRole("button", {
      name: "Meilensteine: 0 von 32 erreicht",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deine Meilensteine." }),
  ).toBeVisible();
  await expect(page.locator(".achievement-card")).toHaveCount(32);
  await expect(
    page.getByRole("article", { name: /A[12]-Kurs vertieft/ }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Kursstufen", exact: true })
      .getByRole("heading", { level: 2 }),
  ).toHaveText("Dein Weg durch B1–C2");
  await expect(
    page.getByRole("region", { name: "Erreichte Meilensteine" }),
  ).toContainText("0 von 32 erreicht");
  const filters = page.getByRole("group", { name: "Meilensteine filtern" });
  await filters.getByRole("button", { name: "Erreicht", exact: true }).click();
  await expect(page.locator(".achievement-card")).toHaveCount(0);
  await expect(page.locator(".achievement-empty")).toBeVisible();
  await nav.getByRole("button", { name: "Heute", exact: true }).click();
  await firstRound(page);
  await answer(page);
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Meilensteine: 1 von 32 erreicht",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("article", { name: "Erster Schritt", exact: true }),
  ).toHaveClass(/earned/);
  await expect(
    page.getByRole("article", { name: "B1-Kurs vertieft", exact: true }),
  ).toHaveClass(/locked/);
  await expect(
    page
      .getByRole("article", { name: "B1-Kurs vertieft", exact: true })
      .getByRole("progressbar"),
  ).toHaveAttribute("value", "0");
  await expect(
    page.getByRole("region", { name: "Kursstufen", exact: true }),
  ).toContainText("Sie bescheinigen kein A1–C2-Sprachniveau.");
  await page.screenshot({
    path: "test-results/milestones-desktop.png",
    animations: "disabled",
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/milestones-${width}.png`,
      animations: "disabled",
    });
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dein Lernheft." }),
  ).toBeVisible();
  await menu(page);
  await nav.getByRole("button", { name: "Meilensteine", exact: true }).click();
  await filters.getByRole("button", { name: "Erreicht", exact: true }).click();
  await expect(page.locator(".achievement-card")).toHaveCount(1);
  await expect(
    page.getByRole("article", { name: "Erster Schritt", exact: true }),
  ).toHaveClass(/earned/);
  await filters
    .getByRole("button", { name: "Noch offen", exact: true })
    .click();
  await expect(page.locator(".achievement-card")).toHaveCount(31);
  await page
    .getByRole("button", { name: "Aktuellen Lernstand ansehen" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dein Lernstand." }),
  ).toBeVisible();
});

test("daily goal uses a wide centered suggestion with five, ten and twenty card steps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/");
  await skipTour(page);
  const slider = page.getByRole("slider", { name: "Tagesziel in Karten" });
  await slider.scrollIntoViewIfNeeded();
  const track = await slider.boundingBox();
  const suggestion = await page.locator(".daily-goal-suggestion").boundingBox();
  expect(track).not.toBeNull();
  expect(suggestion!.width / track!.width).toBeCloseTo(0.4, 1);
  expect(
    (suggestion!.x + suggestion!.width / 2 - track!.x) / track!.width,
  ).toBeCloseTo(0.5, 1);
  await slider.click({
    position: { x: track!.width / 2, y: track!.height / 2 },
  });
  await expect(slider).toHaveAttribute("aria-valuenow", "65");
  await expect
    .poll(async () => (await readState(page)).settings.dailyCardGoal)
    .toBe(65);
  for (const expected of [70, 75, 80, 90, 100, 110, 120, 140]) {
    await expect(slider).toBeEnabled();
    await slider.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", `${expected}`);
    await expect
      .poll(async () => (await readState(page)).settings.dailyCardGoal)
      .toBe(expected);
  }
  await expect(slider).toBeEnabled();
  await slider.press("ArrowLeft");
  await expect
    .poll(async () => (await readState(page)).settings.dailyCardGoal)
    .toBe(120);
  await page.reload();
  await expect(slider).toHaveAttribute("aria-valuenow", "120");
  await expect(slider).toBeEnabled();
  await slider.press("Home");
  await expect
    .poll(async () => (await readState(page)).settings.dailyCardGoal)
    .toBe(30);
  await expect(slider).toBeEnabled();
  await slider.press("End");
  await expect
    .poll(async () => (await readState(page)).settings.dailyCardGoal)
    .toBe(250);
  await slider.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/daily-goal-scale-mobile.png",
    animations: "disabled",
  });
});

test("training explains immediately when a repeat or retry does not increase today's count", async ({
  page,
}) => {
  await page.goto("/");
  await skipTour(page);
  await firstRound(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open("wortnah");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("state", "readwrite");
          const get = tx.objectStore("state").get("current");
          get.onsuccess = () => {
            const s = get.result;
            const first = s.session.queue[0];
            s.session.queue = [
              first,
              { ...first, attemptId: "same-card-again" },
              {
                ...first,
                attemptId: "same-card-retry",
                retryOf: first.attemptId,
              },
              s.session.queue[1],
            ];
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
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await answer(page);
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 1 / 50 Karten",
  );
  await expect(page.locator(".review-count-note")).toHaveText(
    "+1 Karte zum Tagesziel",
  );
  await answer(page);
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 1 / 50 Karten",
  );
  await expect(page.locator(".review-count-note")).toHaveText(
    "Heute bereits gezählt · kein weiterer Verbrauch.",
  );
  await answer(page);
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 1 / 50 Karten",
  );
  await expect(page.locator(".review-count-note")).toHaveText(
    "Nachversuch · zählt nicht zusätzlich.",
  );
  expect((await readState(page)).session.finished).toBe(false);
  await page.screenshot({
    path: "test-results/training-count-feedback.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 1 / 50 Karten",
  );
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Heute geübt", exact: true }),
  ).toContainText("1 Karte");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Heute geübt", exact: true }),
  ).toContainText("1 Karte");
});
