import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
async function state(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const req = indexedDB.open("wortnah");
        req.onsuccess = () => {
          const db = req.result;
          const read = db
            .transaction("state")
            .objectStore("state")
            .get("current");
          read.onsuccess = () => {
            resolve(read.result);
            db.close();
          };
          read.onerror = reject;
        };
        req.onerror = reject;
      }),
  );
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function start(page: Page) {
  await page
    .getByRole("button", { name: "Mein Training einrichten", exact: true })
    .click();
  await page.getByRole("button", { name: "Los geht’s", exact: true }).click();
  await expect(page.locator(".exercise-card")).toBeVisible();
}
async function answer(page: Page) {
  await expect(page.locator(".feedback")).not.toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Antwort zeigen", exact: true })
      .or(page.locator(".answer-options button").first()),
  ).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Antwort zeigen", exact: true })
      .isVisible()
  ) {
    await page
      .getByRole("button", { name: "Antwort zeigen", exact: true })
      .click();
    await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  } else await page.locator(".answer-options button").first().click();
  await expect(page.locator(".feedback")).toBeVisible();
}

test("complete learning flow, reload, undo, exclusions and cross-device backup", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Ein guter Tag/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-home.png",
    fullPage: true,
  });
  await start(page);
  const original = (await state(page)).session.queue[0];
  await answer(page);
  const afterAnswer = await state(page);
  expect(afterAnswer.events.filter((e: any) => !e.revokedAt)).toHaveLength(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".feedback")).toBeVisible();
  expect((await state(page)).session.queue[0].exercise.id).toBe(
    original.exercise.id,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gewusst", exact: true }),
  ).toBeVisible();
  expect(Object.keys((await state(page)).memory)).toHaveLength(0);
  await page.getByRole("button", { name: "Noch nicht", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await answer(page);
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await nav(page, "Wörterbuch");
  await page
    .getByRole("button", { name: "Eigener Eintrag", exact: true })
    .click();
  await page
    .getByLabel("Englischer Ausdruck", { exact: true })
    .fill("take a breather");
  await page
    .getByLabel("Deutsche Bedeutung", { exact: true })
    .fill("eine Verschnaufpause machen");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Wörter suchen").fill("hinge");
  await page.locator(".dictionary-row").first().click();
  await page.getByRole("button", { name: "Archivieren", exact: true }).click();
  await page.getByLabel("Wörter suchen").fill("porcelain");
  await page.locator(".dictionary-row").first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ausschließen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Daten & Einstellungen", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Lernstand herunterladen", exact: true })
    .click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
  const exported = JSON.parse(await fs.readFile(path!, "utf8"));
  expect(
    exported.payload.state.personalTargets.some(
      (t: any) => t.word === "take a breather",
    ),
  ).toBe(true);
  const second = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    other = await second.newPage();
  await other.goto("/");
  await expect(
    other.getByRole("heading", { name: /Ein guter Tag/ }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "Daten & Einstellungen", exact: true })
    .click();
  await other.getByLabel("Sicherungsdatei auswählen").setInputFiles(path!);
  await expect(
    other.getByRole("heading", { name: "Sicherung prüfen und übernehmen" }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "Diesen Lernstand übernehmen", exact: true })
    .click();
  await expect(other.getByRole("dialog")).not.toBeVisible();
  const imported = await state(other);
  expect(imported.events).toEqual(exported.payload.state.events);
  expect(imported.memory).toEqual(exported.payload.state.memory);
  expect(imported.participation).toEqual(exported.payload.state.participation);
  expect(imported.session).toEqual(exported.payload.state.session);
  expect(imported.deviceId).not.toBe(exported.payload.state.deviceId);
  await nav(other, "Heute");
  await other
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(other.locator(".feedback")).toBeVisible();
  await other.screenshot({ path: "test-results/session.png", fullPage: true });
  await second.close();
  expect(errors).toEqual([]);
});

test("production service worker makes learning and dictionary work offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Ein guter Tag/ }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(
      async () => page.evaluate(() => !!navigator.serviceWorker.controller),
      { timeout: 45000 },
    )
    .toBe(true);
  await start(page);
  await answer(page);
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Training fortsetzen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".feedback")).toBeVisible();
  await nav(page, "Wörterbuch");
  await page.getByRole("button", { name: /Wörterbuch entdecken/ }).click();
  await page.getByLabel("Wörter suchen").fill("porcelain");
  await expect(page.locator(".source-row").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".source-row").first()).toContainText("porcelain");
  await context.setOffline(false);
});

test("mobile layout, keyboard focus and topic changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Ein guter Tag/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await start(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await answer(page);
  await page.screenshot({
    path: "test-results/mobile-session.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  await nav(page, "Themen");
  await page
    .locator(".topic-card")
    .first()
    .getByRole("button", { name: "Pausiert", exact: true })
    .click();
  expect((await state(page)).preferences.home.mode).toBe("paused");
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/mobile-320-topics.png",
    fullPage: true,
  });
});

test("invalid backup leaves existing progress untouched", async ({ page }) => {
  await page.goto("/");
  await start(page);
  await answer(page);
  const before = await state(page);
  await page
    .getByRole("button", { name: "Daten & Einstellungen", exact: true })
    .click();
  await page.getByLabel("Sicherungsdatei auswählen").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"not-wortnah"}'),
  });
  await expect(page.getByRole("status")).toContainText(
    "keine Wortnah-Sicherung",
  );
  expect(await state(page)).toEqual(before);
});

test("compact dictionary groups words and adopts the selected meaning on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Wörterbuch");
  await page.getByRole("button", { name: /Wörterbuch entdecken/ }).click();
  for (const word of ["to", "and", "of"]) {
    await page.getByLabel("Wörter suchen").fill(word);
    await expect(page.locator(`.source-row[data-word="${word}"]`)).toHaveCount(
      1,
    );
    await expect(page.locator(".source-row").first()).toHaveAttribute(
      "data-word",
      word,
    );
  }
  await page.getByLabel("Wörter suchen").fill("bank");
  const bank = page.locator('.source-row[data-word="bank"]');
  await bank.locator("summary").click();
  await expect(
    bank.locator(".source-sense").filter({ hasText: "financial affairs" }),
  ).toBeVisible();
  const shore = bank
    .locator(".source-sense")
    .filter({ hasText: "edge of river" });
  while (!(await shore.isVisible())) {
    await bank.getByRole("button", { name: /Weitere Bedeutungen/ }).click();
  }
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/compact-dictionary-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await shore
    .getByRole("button", { name: "Bedeutung von bank übernehmen", exact: true })
    .click();
  await page
    .getByLabel("Deutsche Bedeutung", { exact: true })
    .fill("Flussufer");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const saved = (await state(page)).personalTargets.find(
    (target: any) => target.de === "Flussufer",
  );
  expect(saved.word).toBe("bank");
  expect(saved.gloss).toContain("edge of river");
  expect(saved.id).toBe(saved.source.sourceId);
});
