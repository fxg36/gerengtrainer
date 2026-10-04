import { test, expect, type Page } from "@playwright/test";

async function stored(page: Page) {
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

test("free allowance and planned one-time offer are accessible from Today and the mobile menu", async ({
  page,
}) => {
  await page.goto("/");
  // Finish onboarding before capturing the baseline used to verify that
  // merely opening the offer does not mutate the profile.
  const tour = page.getByRole("dialog", { name: "Deine kurze App-Tour" });
  await tour.getByRole("button", { name: "Tour überspringen" }).click();
  await expect(tour).not.toBeVisible();
  const summary = page.getByRole("region", {
    name: "Dein kostenloses Kontingent",
  });
  await expect(summary).toContainText("500 Einstiegskarten übrig");
  await expect(summary).toContainText("250 Karten pro Woche kostenlos");
  await expect(summary).toContainText(/4,99\s*€ einmalig/);
  const before = await stored(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await summary
      .getByRole("button", { name: "Unbegrenzt lernen", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Unbegrenzt lernen" });
    await expect(dialog).toContainText(/4,99\s*€/);
    await expect(dialog).toContainText(
      "Der Einmalkauf ist noch nicht verfügbar",
    );
    await expect(
      dialog.getByRole("button", { name: "Kauf bald verfügbar" }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Weiter kostenlos lernen" }),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/learning-offer-${width}.png`,
      animations: "disabled",
    });
    await dialog.getByText("So werden Karten gezählt", { exact: true }).click();
    await expect(dialog).toContainText("sieben Kalendertagen");
    await dialog
      .getByRole("button", { name: "Weiter kostenlos lernen" })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  await page.getByRole("button", { name: "Menü öffnen", exact: true }).click();
  await page.locator(".offer-nav").click();
  await expect(
    page.getByRole("dialog", { name: "Unbegrenzt lernen" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
});

test("intro-to-week transition updates with real answers and undo; reaching the preview limit does not block practice", async ({
  page,
}) => {
  await page.goto("/");
  const tour = page.getByRole("dialog", { name: "Deine kurze App-Tour" });
  await tour.getByRole("button", { name: "Tour überspringen" }).click();
  await expect(tour).not.toBeVisible();
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

  async function seed(count: number) {
    await page.evaluate(async (count) => {
      const content = await (await fetch("/content/course.json")).json();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("wortnah");
        req.onerror = reject;
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("state", "readwrite");
          const store = tx.objectStore("state");
          const get = store.get("current");
          get.onsuccess = () => {
            const s = get.result;
            const reserved = new Set(
              s.session.queue.map((q: any) => q.exercise.targetId),
            );
            const exercises = [
              ...new Map<string, any>(
                content.exercises
                  .filter((e: any) => !reserved.has(e.targetId))
                  .map((e: any) => [`${e.targetId}~${e.channel}`, e]),
              ).values(),
            ].slice(0, count);
            s.events = exercises.map((exercise: any, i: number) => ({
              id: `offer-seed-${i}`,
              deviceId: s.deviceId,
              sessionId: "previous-round",
              targetId: exercise.targetId,
              exercise,
              index: i,
              at: new Date(Date.now() - 60000).toISOString(),
              day: "ignored-day",
              good: true,
              choice: null,
              mode: "regular",
              retry: false,
              revokedAt: null,
              engine: "ts-fsrs-5.4.2-retention-0.9",
            }));
            s.revision++;
            store.put(s, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = reject;
        };
      });
    }, count);
    await page.reload();
  }
  const summary = page.getByRole("region", {
    name: "Dein kostenloses Kontingent",
  });
  async function resume() {
    await page
      .getByRole("region", { name: "Dein Lernmoment" })
      .getByRole("button", {
        name: /Training fortsetzen|Freiwillig weiterüben/,
      })
      .click();
  }
  async function pause() {
    await page
      .getByRole("button", { name: "Speichern & pausieren", exact: true })
      .click();
  }
  async function answer() {
    const s = await stored(page);
    const e = s.session.queue[s.session.index].exercise;
    if (e.mode === "choice")
      await page.getByRole("button", { name: e.answer, exact: true }).click();
    else {
      await page
        .getByRole("button", { name: "Antwort zeigen", exact: true })
        .click();
      await page.getByRole("button", { name: "Gewusst", exact: true }).click();
    }
    await expect
      .poll(async () => (await stored(page)).events.length)
      .toBe(s.events.length + 1);
  }

  await seed(499);
  await expect(summary).toContainText("1 Einstiegskarte übrig");
  await resume();
  await answer();
  await pause();
  await expect(summary).toContainText("250 Wochenkarten übrig");
  await resume();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await pause();
  await expect(summary).toContainText("1 Einstiegskarte übrig");
  await resume();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect(page.locator(".training-daily-activity")).toHaveText(
    "Heute: 500 / 50 Karten",
  );
  await answer();
  await pause();
  await expect(summary).toContainText("249 Wochenkarten übrig");
  await page.reload();
  await expect(summary).toContainText("249 Wochenkarten übrig");

  await seed(750);
  await expect(summary).toContainText("0 Wochenkarten übrig");
  await expect(summary).toContainText("Derzeit ohne Begrenzung");
  await resume();
  await answer();
  await expect(page.locator(".exercise-card")).toBeVisible();
  await pause();
  await expect(summary).toContainText("0 Wochenkarten übrig");
  await summary.screenshot({
    path: "test-results/learning-offer-weekly.png",
    animations: "disabled",
  });
});
