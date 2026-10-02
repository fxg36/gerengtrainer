import { test, expect, type Page, type Locator } from "@playwright/test";
import fs from "node:fs/promises";
// Topic switches reflect the committed IndexedDB state; wait for that render.
async function setTopicActive(control: Locator, active = true) {
  await expect(control).toBeChecked({ checked: !active });
  await control.click();
  await expect(control).toBeChecked({ checked: active });
}
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
  const before = await state(page);
  if (before.session.queue[before.session.index].exercise.writing) {
    if (!before.session.revealed) {
      await page
        .locator(".writing-practice textarea")
        .fill(before.session.queue[before.session.index].exercise.answer);
      await page
        .getByRole("button", { name: "Antwort vergleichen", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Gewusst", exact: true }).click();
    await expect
      .poll(async () => (await state(page)).session.index)
      .toBeGreaterThan(before.session.index);
    return;
  }
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
  await expect
    .poll(async () => (await state(page)).session.index)
    .toBeGreaterThan(before.session.index);
  await expect(
    page.getByRole("button", { name: "Weiter", exact: true }),
  ).toHaveCount(0);
}

test("legacy exclusions become archive and every entry control offers only the two current states", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Themen");
  await setTopicActive(page.locator(".topic-card").first().getByRole("switch"));
  await page
    .locator(".topic-card")
    .first()
    .locator(".topic-train-action button")
    .click();
  await answer(page);
  const before = await state(page);
  const ids = [
    before.events[0].targetId,
    before.session.queue[before.session.index].exercise.targetId,
  ];
  await page.evaluate(async (ids) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("wortnah");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const get = store.get("current");
        get.onsuccess = () => {
          const draft = get.result;
          for (const id of ids) draft.participation[id] = "excluded";
          store.put(draft, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      req.onerror = () => reject(req.error);
    });
  }, ids);
  await page.reload();
  await nav(page, "Themen");
  const migrated = await state(page);
  expect(ids.map((id) => migrated.participation[id])).toEqual([
    "archived",
    "archived",
  ]);
  expect(migrated.events).toEqual(before.events);
  expect(migrated.memory).toEqual(before.memory);
  await page.locator(".topic-card").first().locator(".topic-open").click();
  const filter = page.getByLabel("Inhalte filtern");
  await expect(filter.locator("option")).toHaveText([
    "Alle Inhalte",
    "Im Training",
    "Archiviert",
  ]);
  await filter.selectOption("archived");
  await expect(page.locator(".topic-word-list button")).toHaveCount(2);
  await page.locator(".topic-word-list button").first().click();
  await expect(
    page.getByRole("dialog").locator(".detail-actions button"),
  ).toHaveText(["Regulär üben", "Archivieren"]);
  await page.keyboard.press("Escape");
  await nav(page, "Wörterbuch");
  await expect(page.getByLabel("Status filtern").locator("option")).toHaveText([
    "Alle Status",
    "Im Training",
    "Archiviert",
  ]);
  await page.getByLabel("Status filtern").selectOption("archived");
  await expect(page.locator(".dictionary-row").first()).toBeVisible();
  await nav(page, "Archiv");
  await expect(page.locator(".archive-entry")).toHaveCount(2);
  await nav(page, "Themen");
  await page
    .locator(".topic-card")
    .first()
    .locator(".topic-train-action button")
    .click();
  const current = await state(page);
  const reportedId =
    current.session.queue[current.session.index].exercise.targetId;
  await page
    .getByRole("button", { name: "Inhalt melden", exact: true })
    .click();
  await page.getByLabel("Deine Notiz").fill("Bedeutung bitte prüfen.");
  await page
    .getByRole("button", { name: "Notieren & archivieren", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const reported = await state(page);
  expect(reported.participation[reportedId]).toBe("archived");
  expect(reported.events).toEqual(before.events);
  expect(reported.reports.at(-1).note).toBe("Bedeutung bitte prüfen.");
  await nav(page, "Archiv");
  await expect(page.locator(".archive-entry")).toHaveCount(3);
});

test("topic rounds resume independently of the mixed round after a reload", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  await answer(page);
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  const mixed = (await state(page)).session;
  await nav(page, "Themen");
  const card = page.locator(".topic-card").first();
  await expect(card.locator(".topic-train-action button")).toContainText(
    "Thema trainieren",
  );
  await page.screenshot({
    path: "test-results/topic-training-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await card.locator(".topic-train-action button").click();
  await expect(page.locator(".training-topic")).toContainText(
    "Themenrunde · Zuhause",
  );
  const focused = await state(page);
  expect(focused.session.topicId).toBe("home");
  expect(focused.savedSessions).toEqual([mixed]);
  const targets = await page.evaluate(
    async () => (await (await fetch("/content/course.json")).json()).targets,
  );
  expect(
    focused.session.queue.every((q: any) => {
      const target = targets.find((t: any) => t.id === q.exercise.targetId);
      return (
        target.ownerTopicId === "home" ||
        target.dimensions.Themen?.includes("home")
      );
    }),
  ).toBe(true);
  await answer(page);
  const focusedAfter = (await state(page)).session;
  await nav(page, "Heute");
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  const resumed = await state(page);
  expect(resumed.session.id).toBe(mixed.id);
  expect(resumed.session.queue).toEqual(mixed.queue);
  expect(resumed.session.index).toBeGreaterThanOrEqual(mixed.index);
  expect(resumed.savedSessions).toEqual([focusedAfter]);
  await page.reload();
  await nav(page, "Themen");
  await card.locator(".topic-open").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Thema fortsetzen", exact: true })
    .click();
  expect((await state(page)).session).toEqual(focusedAfter);
  await page
    .getByRole("button", { name: "Speichern & pausieren", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Womit beschäftigst du dich?" }),
  ).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(card.locator(".topic-train-action button")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/topic-training-${width}.png`,
      fullPage: false,
      animations: "disabled",
    });
  }
  await card.locator(".topic-train-action button").click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/topic-round-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("inactive topics block direct practice and preserve their round until reactivated", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Themen");
  const card = page.locator(".topic-card").first();
  await expect(card.getByRole("switch")).not.toBeChecked();
  await expect(card.locator(".topic-train-action button")).toBeDisabled();
  await card.locator(".topic-open").click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Thema trainieren", exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator(".topic-practice")).toContainText(
    "Aktiviere dieses Thema",
  );
  await expect(dialog.getByLabel(/^Trainingsmodus/)).toHaveCount(0);
  await setTopicActive(dialog.getByRole("switch"));
  await dialog
    .getByRole("button", { name: "Thema trainieren", exact: true })
    .click();
  await answer(page);
  const before = await state(page);
  await nav(page, "Themen");
  await setTopicActive(card.getByRole("switch"), false);
  const disabled = await state(page);
  expect(disabled.session).toEqual(before.session);
  expect(disabled.events).toEqual(before.events);
  expect(disabled.memory).toEqual(before.memory);
  await expect(card.locator(".topic-train-action button")).toBeDisabled();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await card.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/topic-toggle-${width}.png`,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.reload();
  await nav(page, "Fortschritt");
  await page
    .getByRole("combobox", { name: "Fortschritt für Thema" })
    .selectOption("home");
  await page
    .getByRole("button", { name: "Thema aktivieren", exact: true })
    .click();
  await expect(dialog.getByRole("switch")).not.toBeChecked();
  await expect(
    dialog.getByRole("button", { name: "Thema fortsetzen", exact: true }),
  ).toBeDisabled();
  await setTopicActive(dialog.getByRole("switch"));
  await dialog
    .getByRole("button", { name: "Thema fortsetzen", exact: true })
    .click();
  const resumed = await state(page);
  expect(resumed.session).toEqual(before.session);
  expect(resumed.preferences.home.mode).toBe("learn");
  await expect(page.locator(".exercise-card")).toBeVisible();
});

test("training levels persist, mix easier words and allow an optional topic override", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Themen");
  const global = page.locator(".level-control").first();
  await global.getByRole("button", { name: "C1", exact: true }).click();
  await expect.poll(async () => (await state(page)).settings.level).toBe("C1");
  await page.reload();
  await nav(page, "Themen");
  await expect(
    page.getByRole("slider", { name: "Dein Trainingslevel", exact: true }),
  ).toHaveAttribute("aria-valuetext", /C1/);
  await page.locator(".topic-card").first().locator(".topic-open").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Eigenes Level für dieses Thema").check();
  await dialog.getByRole("button", { name: "A2", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).preferences.home.level)
    .toBe("A2");
  await dialog.getByLabel("Eigenes Level für dieses Thema").uncheck();
  await expect
    .poll(async () => (await state(page)).preferences.home.level)
    .toBeNull();
  await page.keyboard.press("Escape");
  await global.getByRole("button", { name: "B2", exact: true }).click();
  await expect.poll(async () => (await state(page)).settings.level).toBe("B2");
  await page
    .getByRole("slider", { name: "Dein Trainingslevel", exact: true })
    .press("ArrowRight");
  await expect.poll(async () => (await state(page)).settings.level).toBe("C1");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(global).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/levels-${width}.png`,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav(page, "Heute");
  await start(page);
  const stored = await state(page);
  const targets = await page.evaluate(
    async () => (await (await fetch("/content/course.json")).json()).targets,
  );
  const selected = stored.session.queue.map((q: any) =>
    targets.find((t: any) => t.id === q.exercise.targetId),
  );
  expect(selected.some((t: any) => t.level === "C1")).toBe(true);
  expect(selected.some((t: any) => t.level === "A2")).toBe(true);
  expect(selected.every((t: any) => t.level !== "C2")).toBe(true);
  expect(stored.settings.level).toBe("C1");
});

test("C2 persists and offers real vocabulary and grammar with clear context on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Themen");
  const levels = page.locator(".level-control").first();
  await levels.getByRole("button", { name: "C2", exact: true }).click();
  await expect.poll(async () => (await state(page)).settings.level).toBe("C2");
  await expect(levels).toContainText(
    "60 % Schwerpunkt und 40 % leichtere Stufen",
  );
  await expect(levels).not.toContainText("noch keine eigenen Ziele");
  await page.reload();
  await nav(page, "Themen");
  await expect(
    page.getByRole("slider", { name: "Dein Trainingslevel", exact: true }),
  ).toHaveAttribute("aria-valuetext", /C2/);
  await levels.getByText("Wie wird gemischt?", { exact: true }).click();
  await expect(levels).toContainText(
    "Gut erinnerte Inhalte bekommen längere Abstände",
  );
  await page.screenshot({
    path: "test-results/c2-level-desktop.png",
    animations: "disabled",
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await setTopicActive(page.locator(".topic-card").first().getByRole("switch"));
  await page
    .locator(".topic-card")
    .first()
    .locator(".topic-train-action button")
    .click();
  const course = await page.evaluate(
    async () => await (await fetch("/content/course.json")).json(),
  );
  const findC2 = async () => {
    for (let i = 0; i < 40; i++) {
      const current = await state(page);
      const exercise = current.session.queue[current.session.index]?.exercise;
      const target = course.targets.find(
        (t: any) => t.id === exercise?.targetId,
      );
      if (target?.level === "C2") return { exercise, target };
      await answer(page);
    }
    throw new Error("No C2 task in this round");
  };
  const lexical = await findC2();
  await expect(page.locator(".meaning-cue")).toContainText(
    lexical.exercise.meaningCue,
  );
  await expect(page.locator(".answer-explanation")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Antwort zeigen", exact: true })
    .click();
  for (const sentence of lexical.target.example.split("\n"))
    await expect(page.locator(".answer-explanation")).toContainText(sentence);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/c2-word-${width}.png`,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await nav(page, "Themen");
  await page.getByLabel("Themen suchen").fill("Grammatik");
  await setTopicActive(page.locator(".topic-card").getByRole("switch"));
  await page
    .locator(".topic-card")
    .locator(".topic-train-action button")
    .click();
  const grammar = await findC2();
  await expect(page.locator(".grammar-cue")).toContainText(
    grammar.exercise.translation,
  );
  if (grammar.exercise.writing)
    await page.getByText("Tipp anzeigen", { exact: true }).click();
  await expect(page.locator(".grammar-hint")).toContainText(
    grammar.exercise.hint,
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/c2-grammar-${width}.png`,
      animations: "disabled",
    });
  }
  await answer(page);
  const after = await state(page);
  await page.reload();
  expect((await state(page)).settings.level).toBe("C2");
  expect((await state(page)).events).toEqual(after.events);
});

test("written grammar saves drafts, offers optional help and keeps self-assessment across reload and undo", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    const ids = [
      "grammar-context-causative:1:recall",
      "grammar-context-duration:1:recall",
      "grammar-context-regret:1:recall",
    ];
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("wortnah");
      req.onerror = reject;
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("state", "readwrite"),
          store = tx.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const saved = read.result;
          saved.session.queue = ids.map((id) => ({
            exercise: course.exercises.find((e: any) => e.id === id),
            attemptId: crypto.randomUUID(),
            topicId: "grammar",
            mode: "regular",
            retryOf: null,
            preferenceRevision: saved.preferences.grammar.revision,
          }));
          saved.session.index = 0;
          saved.session.revealed = false;
          store.put(saved, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
    });
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".writing-instruction")).toContainText(
    "Formuliere mit had",
  );
  await expect(page.locator(".grammar-cue")).toContainText("reparieren lassen");
  await expect(page.locator(".grammar-hint")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Antwort vergleichen", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Dein englischer Satz", exact: true })
    .fill("I had my brakes repaired yesterday.");
  await expect
    .poll(async () => (await state(page)).session.queue[0].draftAnswer)
    .toBe("I had my brakes repaired yesterday.");
  expect((await state(page)).events).toHaveLength(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Dein englischer Satz", exact: true }),
  ).toHaveValue("I had my brakes repaired yesterday.");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1050 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/writing-question-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
  }
  await page.getByText("Tipp anzeigen", { exact: true }).click();
  await expect(page.locator(".grammar-hint")).toBeVisible();
  await page
    .getByRole("button", { name: "Antwort vergleichen", exact: true })
    .click();
  await expect(page.locator(".written-response")).toContainText(
    "entspricht einer Musterlösung",
  );
  await expect(page.locator(".writing-checkpoints")).toContainText(
    "Wer führt die Arbeit",
  );
  expect((await state(page)).events).toHaveLength(0);
  await page.screenshot({
    path: "test-results/writing-answer-320.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect.poll(async () => (await state(page)).session.index).toBe(1);
  expect((await state(page)).events[0].writtenAnswer).toBe(
    "I had my brakes repaired yesterday.",
  );
  await expect(
    page.getByRole("button", { name: "Weiter", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.locator(".written-response")).toContainText(
    "I had my brakes repaired yesterday.",
  );
  expect((await state(page)).events[0].revokedAt).toBeTruthy();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Dein englischer Satz", exact: true })
    .fill("I have made my home here since 2021.");
  await page
    .getByRole("button", { name: "Antwort vergleichen", exact: true })
    .click();
  await expect(page.locator(".written-response")).toContainText(
    "Andere richtige Formulierungen sind möglich",
  );
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  expect((await state(page)).events.at(-1).good).toBe(true);
  await expect(
    page.getByRole("textbox", { name: "Dein englischer Satz", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "Dein englischer Satz", exact: true })
    .fill("I wish I save a copy.");
  await page
    .getByRole("button", { name: "Antwort vergleichen", exact: true })
    .click();
  await page.getByRole("button", { name: "Noch nicht", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Runde abgeschlossen.", exact: true }),
  ).toBeVisible();
  expect(
    (await state(page)).events.filter((e: any) => !e.revokedAt),
  ).toHaveLength(3);
});

test("archiving from training changes neither today's practice count nor learning progress", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  const before = await state(page);
  const archivedId = before.session.queue[0].exercise.targetId;
  await page.getByRole("button", { name: "Archivieren", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).participation[archivedId])
    .toBe("archived");
  const after = await state(page);
  expect(after.events).toEqual(before.events);
  expect(after.memory).toEqual(before.memory);
  expect(after.session.index).toBe(1);
  await nav(page, "Heute");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "heute geübt" })
      .locator("strong"),
  ).toHaveText("0");
  await expect(page.locator(".week .done")).toHaveCount(0);
  await nav(page, "Fortschritt");
  await expect(page.locator(".learning-coverage")).toContainText("0 in Übung");
  await expect(page.locator(".learning-coverage")).toContainText("0 gefestigt");
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("0");
  await nav(page, "Heute");
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await answer(page);
  await page.getByRole("button", { name: "Archivieren", exact: true }).click();
  await nav(page, "Heute");
  await expect(
    page
      .locator(".stat-card")
      .filter({ hasText: "heute geübt" })
      .locator("strong"),
  ).toHaveText("1");
});

test("complete learning flow, reload, undo, archive and cross-device backup", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Dein Lernheft/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-home.png",
    fullPage: true,
  });
  await start(page);
  expect((await state(page)).session.queue).toHaveLength(40);
  const original = (await state(page)).session.queue[0];
  await answer(page);
  const afterAnswer = await state(page);
  expect(afterAnswer.events.filter((e: any) => !e.revokedAt)).toHaveLength(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  expect((await state(page)).session.index).toBe(1);
  expect((await state(page)).session.revealed).toBe(false);
  expect((await state(page)).session.queue[0].exercise.id).toBe(
    original.exercise.id,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gewusst", exact: true }),
  ).toBeVisible();
  expect(Object.keys((await state(page)).memory)).toHaveLength(0);
  await page.getByRole("button", { name: "Noch nicht", exact: true }).click();
  await expect.poll(async () => (await state(page)).session.index).toBe(1);
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
    .getByRole("button", { name: "Archivieren", exact: true })
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
    other.getByRole("heading", { name: /Dein Lernheft/ }),
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
  await expect(other.locator(".exercise-card")).toBeVisible();
  expect((await state(other)).session.index).toBe(
    exported.payload.state.session.index,
  );
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
    page.getByRole("heading", { name: /Dein Lernheft/ }),
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
  await expect(page.locator(".exercise-card")).toBeVisible();
  expect((await state(page)).session.index).toBe(1);
  await nav(page, "Wörterbuch");
  await page.getByRole("button", { name: /Wörterbuch entdecken/ }).click();
  await page.getByLabel("Wörter suchen").fill("porcelain");
  await expect(page.locator(".source-row").first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".source-row").first()).toContainText("porcelain");
  await nav(page, "Fortschritt");
  await expect(
    page.getByRole("heading", { name: "Dein Lernstand." }),
  ).toBeVisible();
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("1");
  await context.setOffline(false);
});

test("mobile layout, keyboard focus and topic changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Dein Lernheft/ }),
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
  await setTopicActive(
    page.locator(".topic-card").first().getByRole("switch"),
    false,
  );
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
    "keine gültige Lernstand-Sicherung",
  );
  expect(await state(page)).toEqual(before);
});

test("choice feedback is non-blocking, double clicks are ignored and the last answer finishes", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  // A short deterministic grammar session in this isolated test profile.
  const exercises = await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    const first = course.exercises.find(
      (exercise: any) => exercise.mode === "choice",
    );
    const next = course.exercises.find(
      (exercise: any) =>
        exercise.mode === "choice" && exercise.targetId !== first.targetId,
    );
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("wortnah");
      req.onerror = reject;
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite"),
          store = tx.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const saved = read.result;
          saved.preferences.grammar.mode = "learn";
          saved.session.queue = [first, next].map((exercise) => ({
            attemptId: crypto.randomUUID(),
            exercise,
            mode: "regular",
            retryOf: null,
            preferenceRevision: saved.preferences.grammar.revision,
          }));
          store.put(saved, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
    });
    return [first, next];
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  const wrongIndex = exercises[0].options.findIndex(
    (option: string) => option !== exercises[0].answer,
  );
  await page.locator(".answer-options button").nth(wrongIndex).dblclick();
  await expect.poll(async () => (await state(page)).session.index).toBe(1);
  expect((await state(page)).events).toHaveLength(1);
  await expect(page.locator(".review-status")).toContainText(
    `Lösung: ${exercises[0].answer}`,
  );
  await expect(
    page.getByRole("button", { name: "Weiter", exact: true }),
  ).toHaveCount(0);
  await page.locator(".review-status summary").click();
  await expect(page.locator(".review-status details")).toContainText(
    exercises[0].explanation,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/automatic-next-feedback.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".answer-options button")
    .nth(exercises[1].options.indexOf(exercises[1].answer))
    .click();
  await expect(page.locator(".session-complete")).toBeVisible();
  await expect(page.locator(".review-status")).toContainText(
    "Richtig · gespeichert",
  );
  expect((await state(page)).events).toHaveLength(2);
  await expect(page.locator(".review-status")).not.toBeVisible({
    timeout: 6000,
  });
  await page
    .getByRole("button", { name: "Letzte Bewertung rückgängig", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  expect((await state(page)).session.index).toBe(1);
  expect(
    (await state(page)).events.filter((event: any) => !event.revokedAt),
  ).toHaveLength(1);
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

test("archive is directly accessible with global quotas, search, practice and restore", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Archiv anzeigen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dein Archiv.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archiv trainieren", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Archivquote für alle Themen", { exact: true })
    .selectOption("20");
  await expect
    .poll(async () =>
      Object.values((await state(page)).preferences).every(
        (pref: any) => pref.quota === 20,
      ),
    )
    .toBe(true);
  await page.getByText("Quoten pro Thema anpassen", { exact: true }).click();
  await page
    .getByLabel("Archivquote Zuhause & Wohnen", { exact: true })
    .selectOption("10");
  await expect(
    page.getByLabel("Archivquote für alle Themen", { exact: true }),
  ).toHaveValue("mixed");
  await nav(page, "Wörterbuch");
  for (const word of ["hinge", "boarding pass"]) {
    await page.getByLabel("Wörter suchen").fill(word);
    await page.locator(".dictionary-row").first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Archivieren", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
  await nav(page, "Archiv");
  await expect(page.locator(".archive-entry")).toHaveCount(2);
  await page.getByLabel("Archiv durchsuchen").fill("Scharnier");
  await expect(page.locator(".archive-entry")).toHaveCount(1);
  await expect(page.locator(".archive-entry")).toContainText("hinge");
  await page.getByLabel("Archiv durchsuchen").fill("");
  await page.getByLabel("Archivthema").selectOption("travel");
  await expect(page.locator(".archive-entry")).toHaveCount(1);
  await page.getByLabel("Archivthema").selectOption("");
  await page.screenshot({
    path: "test-results/notebook-archive-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [1024, 780, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation", { name: "Schnellnavigation" })
    .getByRole("button", { name: "Heute", exact: true })
    .click();
  await expect(page.locator(".home-archive")).toContainText("2 Einträge");
  await expect(page.locator(".home-quota")).toContainText("Je Thema");
  await page
    .getByRole("navigation", { name: "Schnellnavigation" })
    .getByRole("button", { name: "Archiv", exact: true })
    .click();
  await page
    .getByLabel("Archivquote für alle Themen", { exact: true })
    .selectOption("0");
  await page.screenshot({
    path: "test-results/notebook-archive-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await expect(
    page.getByRole("button", { name: "Archiv trainieren", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Themen aktivieren", exact: true })
    .click();
  for (const name of ["Zuhause & Wohnen", "Reisen & Entdecken"]) {
    await setTopicActive(
      page
        .locator(".topic-card")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
        .getByRole("switch"),
    );
  }
  await page
    .getByRole("navigation", { name: "Schnellnavigation" })
    .getByRole("button", { name: "Archiv", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Archiv trainieren", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  const archivedSession = await state(page);
  expect(archivedSession.session.archiveTopic).toBe("all-archived");
  expect(archivedSession.session.queue).toHaveLength(2);
  expect(
    archivedSession.session.queue.every(
      (item: any) =>
        item.mode === "explicit_archive" &&
        archivedSession.participation[item.exercise.targetId] === "archived",
    ),
  ).toBe(true);
  expect(
    Object.entries(archivedSession.preferences).every(
      ([id, pref]: [string, any]) =>
        pref.mode === (["home", "travel"].includes(id) ? "learn" : "paused") &&
        pref.quota === 0,
    ),
  ).toBe(true);
  await answer(page);
  await page
    .getByRole("button", { name: "Archiv anzeigen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Archiv weitertrainieren", exact: true })
    .click();
  expect((await state(page)).session.id).toBe(archivedSession.session.id);
  expect((await state(page)).session.index).toBe(1);
  await page
    .getByRole("button", { name: "Archiv anzeigen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "hinge wieder regulär üben", exact: true })
    .click();
  await expect(page.locator(".archive-entry")).toHaveCount(1);
  const after = await state(page);
  const restored = Object.values(after.participation).filter(
    (value) => value === "regular",
  );
  expect(restored).toHaveLength(1);
  expect(after.events).toHaveLength(1);
});

test("all topics quick selection requires confirmation and preserves individual levels and archive quotas", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Themen");
  await page.locator(".topic-card").first().locator(".topic-open").click();
  await setTopicActive(page.getByRole("dialog").getByRole("switch"));
  await page.getByLabel("Archivquote", { exact: true }).focus();
  await page.getByLabel("Archivquote", { exact: true }).press("End");
  await expect
    .poll(async () => (await state(page)).preferences.home.quota)
    .toBe(50);
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  const before = await state(page);
  await page.getByRole("textbox", { name: "Themen suchen" }).fill("Schule");
  const action = page.getByRole("button", {
    name: "Alle Themen aktivieren",
    exact: true,
  });
  await action.click();
  const dialog = page.getByRole("dialog", { name: "Alle Themen aktivieren?" });
  await expect(dialog).toContainText("alle 24 Themen");
  expect(await state(page)).toEqual(before);
  await dialog.getByRole("button", { name: "Nein", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await state(page)).toEqual(before);
  await action.click();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: "test-results/all-topics-confirm-320.png",
    animations: "disabled",
  });
  await dialog.getByRole("button", { name: "Ja", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(action).toBeDisabled();
  const after = await state(page);
  for (const [id, old] of Object.entries(before.preferences) as [
    string,
    any,
  ][]) {
    expect(after.preferences[id]).toMatchObject({
      mode: "learn",
      level: old.level,
      quota: old.quota,
    });
    if (old.mode === "learn") expect(after.preferences[id]).toEqual(old);
  }
  expect(after.events).toEqual(before.events);
  expect(after.memory).toEqual(before.memory);
  expect(after.participation).toEqual(before.participation);
  expect(after.revision).toBe(before.revision + 1);
  await page.getByRole("textbox", { name: "Themen suchen" }).fill("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Meldung schließen" }).click();
  await page
    .locator(".topic-toolbar")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.screenshot({
    path: "test-results/all-topics-toolbar-320.png",
    animations: "disabled",
  });
  await page.reload();
  await expect
    .poll(async () => (await state(page)).preferences)
    .toEqual(after.preferences);
});

test("settings controls save the selected values before asynchronous storage", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Daten & Einstellungen", exact: true })
    .click();
  await page.getByRole("slider", { name: "Lernzeit", exact: true }).focus();
  await page
    .getByRole("slider", { name: "Lernzeit", exact: true })
    .press("End");
  await expect.poll(async () => (await state(page)).settings.minutes).toBe(120);
  await page.getByLabel("Lernzeit in Minuten", { exact: true }).fill("37");
  await page.getByLabel("Lernzeit in Minuten", { exact: true }).press("Enter");
  await expect.poll(async () => (await state(page)).settings.minutes).toBe(37);
  await page
    .getByLabel("Neue Inhalte pro Tag begrenzen", { exact: true })
    .check();
  await expect
    .poll(async () => (await state(page)).settings.limitNewPerDay)
    .toBe(true);
  await page.getByLabel(/^Trainingsauswahl/).selectOption("grammar");
  await expect(page.getByLabel(/^Trainingsauswahl/)).toHaveValue("grammar");
  await page.getByLabel("Neue Wörter pro Tag", { exact: true }).fill("9");
  await expect.poll(async () => (await state(page)).settings.newPerDay).toBe(9);
  await page
    .getByLabel("Neue Grammatiklernziele pro Tag", { exact: true })
    .fill("3");
  await expect
    .poll(async () => (await state(page)).settings.grammarPerDay)
    .toBe(3);
  await page.reload();
  const saved = await state(page);
  expect(saved.settings).toMatchObject({
    minutes: 37,
    limitNewPerDay: true,
    mode: "grammar",
    newPerDay: 9,
    grammarPerDay: 3,
  });
  await nav(page, "Themen");
  await page.locator(".topic-card").first().locator(".topic-open").click();
  await setTopicActive(page.getByRole("dialog").getByRole("switch"));
  await expect
    .poll(async () => (await state(page)).preferences.home.mode)
    .toBe("learn");
  await page.getByLabel("Archivquote", { exact: true }).focus();
  await page.getByLabel("Archivquote", { exact: true }).press("End");
  await expect
    .poll(async () => (await state(page)).preferences.home.quota)
    .toBe(50);
});

test("successive batches introduce other words and the time slider allows two hours", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Daten & Einstellungen", exact: true })
    .click();
  await page.getByLabel(/^Trainingsauswahl/).selectOption("words");
  await expect
    .poll(async () => (await state(page)).settings.mode)
    .toBe("words");
  await nav(page, "Heute");
  await page.getByLabel("Lernzeit in Minuten", { exact: true }).fill("3");
  await page.getByLabel("Lernzeit in Minuten", { exact: true }).press("Enter");
  await expect.poll(async () => (await state(page)).settings.minutes).toBe(3);
  await start(page);
  const first = (await state(page)).session;
  expect(first.queue).toHaveLength(6);
  for (let i = 0; i < 6; i++) await answer(page);
  await expect(
    page.getByRole("heading", { name: "Runde abgeschlossen." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Weitere Runde · 6 Aufgaben" })
    .click();
  const second = (await state(page)).session;
  expect(second.id).not.toBe(first.id);
  expect(second.queue).toHaveLength(6);
  expect(
    second.queue.some((q: any) =>
      first.queue.some(
        (previous: any) => previous.exercise.targetId === q.exercise.targetId,
      ),
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Speichern & pausieren" }).click();
  await page
    .getByRole("slider", { name: "Lernzeit", exact: true })
    .press("End");
  await expect.poll(async () => (await state(page)).settings.minutes).toBe(120);
  await expect(page.locator(".time-budget")).toContainText("240 Aufgaben");
  expect((await state(page)).session.id).toBe(second.id);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/tempo-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(
    page.getByLabel("Lernzeit in Minuten", { exact: true }),
  ).toHaveValue("120");
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  expect((await state(page)).session.id).toBe(second.id);
});

test("grammar recall gives the German sentence and verb even for a legacy saved task", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    const exercise = course.exercises.find(
      (e: any) => e.id === "grammar-past-perfect:5:recall",
    );
    delete exercise.translation;
    delete exercise.hint;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("wortnah");
      req.onerror = reject;
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const saved = read.result;
          saved.session.queue = [
            {
              exercise,
              attemptId: crypto.randomUUID(),
              mode: "regular",
              retryOf: null,
              preferenceRevision: saved.preferences.grammar.revision,
            },
          ];
          store.put(saved, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
    });
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".grammar-cue")).toContainText(
    "Die Gäste waren angekommen, bevor der Sturm begann.",
  );
  await expect(page.locator(".grammar-hint")).toHaveText("Grundform: arrive");
  await expect(page.locator(".exercise-card h1")).not.toContainText("arrived");
  await page.screenshot({
    path: "test-results/grammar-context-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/grammar-context-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Antwort zeigen", exact: true })
    .click();
  await expect(page.locator(".exercise-card h1")).toContainText("arrived");
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Runde abgeschlossen." }),
  ).toBeVisible();
});

test("fern uses a short learner explanation even in a previously saved dictionary-based card", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    const fern = course.targets.find((t: any) => t.word === "fern");
    const exercise = course.exercises.find(
      (e: any) => e.targetId === fern.id && e.channel === "receptive_recall",
    );
    exercise.meaningCue = fern.gloss;
    exercise.explanation = fern.gloss;
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("wortnah");
      req.onerror = reject;
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const saved = read.result;
          saved.preferences.nature.mode = "learn";
          saved.personalTargets = [
            {
              ...fern,
              senseContext: {
                de: "Eine Pflanze in der Natur.",
                en: fern.gloss,
              },
            },
          ];
          saved.personalExercises = [exercise];
          saved.session.queue = [{ ...saved.session.queue[0], exercise }];
          delete saved.session.queue[0].topicId;
          store.put(saved, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
    });
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".exercise-card h1")).toHaveText("fern");
  await expect(page.locator(".exercise-card h1")).toHaveAttribute("lang", "en");
  await expect(page.locator(".meaning-cue")).toContainText("A green plant");
  await expect(page.locator(".exercise-card")).not.toContainText(
    "Pteridophyta",
  );
  await expect(page.locator(".exercise-card")).not.toContainText("Farn");
  await page
    .getByRole("button", { name: "Antwort zeigen", exact: true })
    .click();
  await expect(page.locator(".answer-reveal h2")).toHaveText("Farn");
  await expect(page.locator(".answer-reveal h2")).toHaveAttribute("lang", "de");
  await expect(page.locator(".answer-explanation")).toContainText(
    "Eine grüne Pflanze",
  );
  await expect(page.locator(".answer-explanation")).toContainText(
    "Ferns grow in the shade. – Farne wachsen im Schatten.",
  );
  await expect(page.locator(".answer-reveal")).not.toContainText(
    "Pteridophyta",
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/fern-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  const stored = await state(page);
  expect(stored.events).toHaveLength(1);
  expect(stored.events[0].exercise.explanation).toContain(
    "Ferns grow in the shade.",
  );
  expect(stored.events[0].exercise.explanation).not.toContain("Pteridophyta");
});

test("vocabulary cards explain the precise meaning before answering in both directions", async ({
  page,
}) => {
  await page.goto("/");
  await start(page);
  await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    const wanted = [
      ["embarrassed", "verlegen", "productive_recall"],
      ["lay", "verlegen", "productive_recall"],
      ["publish", "verlegen", "productive_recall"],
      ["trunk", "Baumstamm", "receptive_recall"],
      ["trunk", "Kofferraum", "receptive_recall"],
    ];
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("wortnah");
      req.onerror = reject;
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const saved = read.result;
          saved.session.queue = wanted.map(([word, de, channel]) => {
            const target = course.targets.find(
              (t: any) => t.word === word && t.de === de,
            );
            saved.preferences[target.ownerTopicId].mode = "learn";
            const exercise = course.exercises.find(
              (e: any) => e.targetId === target.id && e.channel === channel,
            );
            // Simulate a session saved before meaning cues were introduced.
            delete exercise.meaningCue;
            return {
              exercise,
              attemptId: crypto.randomUUID(),
              mode: "regular",
              retryOf: null,
              preferenceRevision:
                saved.preferences[target.ownerTopicId].revision,
            };
          });
          store.put(saved, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
    });
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Training fortsetzen", exact: true })
    .click();
  await expect(page.locator(".exercise-card h1")).toHaveText("verlegen");
  await expect(page.locator(".meaning-cue")).toContainText("Gefühl");
  await expect(page.locator(".meaning-cue p")).toHaveAttribute("lang", "de");
  await expect(page.locator(".exercise-card")).not.toContainText("embarrassed");
  await page.screenshot({
    path: "test-results/meaning-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/meaning-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await expect(page.locator(".reveal-button")).toBeInViewport({ ratio: 1 });
  }
  await answer(page);
  await expect(page.locator(".exercise-card h1")).toHaveText("verlegen");
  await expect(page.locator(".meaning-cue")).toContainText("Parkett");
  await page.getByRole("button", { name: "Archivieren", exact: true }).click();
  await expect(page.locator(".meaning-cue")).toContainText("Buch");
  expect((await state(page)).events).toHaveLength(1);
  await answer(page);
  await expect(page.locator(".exercise-card h1")).toHaveText("trunk");
  await expect(page.locator(".meaning-cue")).toContainText("tree");
  await expect(page.locator(".meaning-cue p")).toHaveAttribute("lang", "en");
  await expect(page.locator(".exercise-card")).not.toContainText("Baumstamm");
  await answer(page);
  await expect(page.locator(".exercise-card h1")).toHaveText("trunk");
  await expect(page.locator(".meaning-cue")).toContainText(
    "luggage compartment",
  );
  const saved = await state(page);
  expect(Object.keys(saved.memory)).toHaveLength(3);
  expect(saved.events.every((e: any) => e.exercise.meaningCue)).toBe(true);
});

test("dictionary links and groups meanings while a new meaning starts without inherited memory", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Wörterbuch");
  await page.getByLabel("Wörter suchen").fill("verlegen");
  const group = page.locator(".meaning-group");
  await expect(group.locator("summary")).toContainText("3 Bedeutungen");
  await group.locator("summary").click();
  await expect(group.locator("button.dictionary-row")).toHaveCount(3);
  await group
    .locator("button.dictionary-row")
    .filter({ hasText: "embarrassed" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".sense-context-detail")).toContainText("Gefühl");
  await expect(dialog.locator(".related-meanings button")).toHaveCount(2);
  await dialog
    .locator(".related-meanings button")
    .filter({ hasText: "Parkett" })
    .click();
  await expect(dialog.locator(".word-detail > h2")).toHaveText("lay");
  await expect(dialog.locator(".sense-context-detail")).toContainText(
    "Parkett",
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Wörter suchen").fill("trunk");
  await expect(group.locator("summary")).toContainText("2 Bedeutungen");
  await group.locator("summary").click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/meaning-dictionary-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await group
    .locator("button.dictionary-row")
    .filter({ has: page.getByText("Baumstamm", { exact: true }) })
    .click();
  await dialog
    .getByRole("button", { name: "Weitere Bedeutung anlegen", exact: true })
    .click();
  await page.getByLabel("Deutsche Bedeutung", { exact: true }).fill("Rüssel");
  await page
    .getByLabel("Kontext auf Deutsch (optional)")
    .fill("Das lange bewegliche Organ am Kopf eines Elefanten.");
  await page
    .getByLabel("Kontext auf Englisch (optional)")
    .fill("The long flexible organ on an elephant's face.");
  await page
    .getByRole("button", { name: "Eintrag speichern", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const saved = await state(page);
  const personal = saved.personalTargets.find((t: any) => t.de === "Rüssel");
  expect(personal.id).toMatch(/^user-/);
  expect(saved.events).toHaveLength(0);
  expect(saved.memory).toEqual({});
  expect(
    saved.personalExercises
      .filter((e: any) => e.targetId === personal.id)
      .every((e: any) => !!e.meaningCue),
  ).toBe(true);
  await expect(group.locator("summary")).toContainText("3 Bedeutungen");
});

test("analytics starts empty, explains its levels, and follows a review and undo", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Fortschritt");
  await expect(
    page.getByRole("heading", { name: "Dein Lernstand." }),
  ).toBeVisible();
  await expect(page.locator(".learning-stage h2")).toHaveText("Einstieg.");
  await expect(page.locator(".learning-coverage")).toContainText("0 gefestigt");
  await expect(page.locator(".answer-metrics > div").first()).toContainText(
    "—",
  );
  await expect(page.locator(".analytics-cefr")).toContainText(
    "Sprachniveau: noch nicht ermittelt",
  );
  await page.getByText("Wie entsteht mein Lernstand?", { exact: true }).click();
  await expect(page.locator(".analytics-method")).toContainText(
    "mindestens drei erfolgreiche Erstversuche",
  );
  await page.getByText("Wie entsteht mein Lernstand?", { exact: true }).click();
  await page
    .locator(".analytics-focus")
    .getByRole("button", { name: "Zum Training" })
    .click();
  await page.getByRole("button", { name: "Los geht’s", exact: true }).click();
  await answer(page);
  await nav(page, "Fortschritt");
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("1");
  await expect(page.locator(".learning-coverage")).toContainText("1 in Übung");
  await expect(page.locator(".learning-coverage")).toContainText("0 gefestigt");
  await page
    .locator(".analytics-focus")
    .getByRole("button", { name: "Training fortsetzen" })
    .click();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await nav(page, "Fortschritt");
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("0");
  await expect(page.locator(".learning-coverage")).toContainText("0 in Übung");
  await page.screenshot({
    path: "test-results/analytics-empty.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("analytics filters real learning history by topic and period on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Dein Lernheft/ }),
  ).toBeVisible();
  // Build a deterministic history in the isolated browser profile, never the user's database.
  await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("wortnah");
      request.onerror = reject;
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const saved = read.result;
          const now = Date.now();
          saved.settings.timezone = "Europe/Berlin";
          saved.events = [];
          saved.memory = {};
          saved.preferences.home.mode = "learn";
          saved.preferences.grammar.mode = "learn";
          const words = course.targets
            .filter((t: any) => t.ownerTopicId === "home")
            .slice(0, 20);
          const grammar = course.targets
            .filter((t: any) => t.kind === "grammar")
            .slice(0, 6);
          for (const [index, target] of [...words, ...grammar].entries()) {
            const firm = index < 10 || index === 20 || index === 21;
            const channels =
              target.kind === "grammar"
                ? ["grammar_production", "grammar_recognition"]
                : ["productive_recall", "receptive_recall"];
            for (const channel of firm ? channels : channels.slice(0, 1)) {
              const exercise = course.exercises.find(
                (e: any) => e.targetId === target.id && e.channel === channel,
              );
              for (const daysAgo of firm ? [15, 8, 1] : [0]) {
                saved.events.push({
                  id: crypto.randomUUID(),
                  deviceId: saved.deviceId,
                  sessionId: "analytics-fixture",
                  targetId: target.id,
                  exercise,
                  index: 0,
                  at: new Date(now - daysAgo * 86400000).toISOString(),
                  day: "2026-01-01",
                  good: firm || index % 3 !== 0,
                  choice: exercise.mode === "choice" ? exercise.answer : null,
                  mode: "regular",
                  retry: false,
                  revokedAt: null,
                  engine: "ts-fsrs-5.4.2-retention-0.9",
                });
              }
              saved.memory[`${target.id}~${channel}`] = {
                due: new Date(now + (firm ? 14 : -1) * 86400000).toISOString(),
                stability: firm ? 30 : 1,
                difficulty: 5,
                elapsed_days: 7,
                scheduled_days: firm ? 14 : 0,
                learning_steps: 0,
                reps: firm ? 3 : 1,
                lapses: 0,
                state: firm ? 2 : 1,
                last_review: new Date(
                  now - (firm ? 1 : 0) * 86400000,
                ).toISOString(),
              };
            }
          }
          saved.events.sort(
            (a: any, b: any) => Date.parse(a.at) - Date.parse(b.at),
          );
          store.put(saved, "current");
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
    });
  });
  await page.reload();
  await nav(page, "Fortschritt");
  const before = await state(page);
  await expect(page.locator(".learning-stage h2")).toHaveText("Im Aufbau.");
  await expect(page.locator(".learning-coverage")).toContainText(
    "12 gefestigt",
  );
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("86");
  await expect(page.locator(".analytics-topic")).toHaveCount(24);
  await page.screenshot({
    path: "test-results/analytics-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.screenshot({
    path: "test-results/analytics-desktop-top.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "7 Tage", exact: true }).click();
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("38");
  await expect(page.locator(".activity-chart button")).toHaveCount(7);
  await page.locator(".activity-chart button").last().click();
  await expect(page.locator(".activity-caption")).toContainText("14 Antworten");
  await page
    .getByRole("button", { name: "Fortschritt: Zuhause & Wohnen", exact: true })
    .click();
  await expect(
    page.getByLabel("Fortschritt für Thema", { exact: true }),
  ).toHaveValue("home");
  await expect(page.locator(".learning-coverage")).toContainText(
    "10 gefestigt",
  );
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("30");
  await page.getByRole("button", { name: "Thema anpassen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await page
    .getByLabel("Fortschritt für Thema", { exact: true })
    .selectOption("grammar");
  await expect(page.locator(".learning-coverage")).toContainText("2 gefestigt");
  await expect(
    page.locator(".analytics-metrics > div").first().locator("strong"),
  ).toHaveText("8");
  await expect(page.locator(".answer-metrics > div").last()).toContainText(
    "2 von 2 Auswahlantworten",
  );
  await page
    .getByText("Nach Abrufrichtung aufschlüsseln", { exact: true })
    .click();
  await expect(page.locator(".channel-details")).toContainText(
    "Grammatik selbst abrufen",
  );
  await page.getByRole("button", { name: "Gesamtübersicht" }).click();
  await page.getByRole("button", { name: "30 Tage", exact: true }).click();
  for (const width of [1024, 780, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/analytics-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/analytics-mobile-top.png",
    animations: "disabled",
  });
  expect(await state(page)).toEqual(before);
});

test("new themes have searchable sections and section rounds resume after reload", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Themen");
  await expect(page.locator(".topic-card")).toHaveCount(24);
  await page.getByLabel("Themen suchen").fill("Campus");
  await expect(page.locator(".topic-card")).toHaveCount(1);
  await page.locator(".topic-open").click();
  await setTopicActive(page.getByRole("dialog").getByRole("switch"));
  await page
    .getByLabel("Unterthema auswählen")
    .selectOption("education.university");
  await expect(page.locator(".topic-word-list button")).toHaveCount(13);
  await page.screenshot({
    path: "test-results/subtopics-desktop.png",
    animations: "disabled",
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .getByRole("dialog")
        .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/subtopics-${width}.png`,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .getByRole("button", { name: "Unterthema trainieren", exact: true })
    .click();
  await expect(page.locator(".training-topic")).toContainText(
    "Studium & Campus",
  );
  const initial = await state(page);
  expect(initial.session.subtopicId).toBe("education.university");
  expect(initial.preferences.education.mode).toBe("learn");
  const ids = await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    return course.targets
      .filter((t: any) =>
        t.dimensions.Unterthemen.includes("education.university"),
      )
      .map((t: any) => t.id);
  });
  expect(initial.session.queue.length).toBeGreaterThan(0);
  expect(
    initial.session.queue.every((q: any) => ids.includes(q.exercise.targetId)),
  ).toBe(true);
  await answer(page);
  await page.reload();
  await nav(page, "Themen");
  await page.getByLabel("Themen suchen").fill("Schule");
  await page.locator(".topic-open").click();
  await page
    .getByLabel("Unterthema auswählen")
    .selectOption("education.university");
  await page
    .getByRole("button", { name: "Unterthema fortsetzen", exact: true })
    .click();
  await expect(page.locator(".exercise-card")).toBeVisible();
  expect((await state(page)).session.id).toBe(initial.session.id);
  expect((await state(page)).session.index).toBe(1);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".exercise-card")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("dictionary navigation has clear counts and fits desktop and narrow phones", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Wörterbuch");
  const tabs = page.getByRole("group", { name: "Wörterbuchbereich" });
  const training = tabs.getByRole("button", { name: /Dein Trainingsbestand/ });
  const discover = tabs.getByRole("button", { name: /Wörterbuch entdecken/ });
  await expect(training).toHaveAttribute("aria-pressed", "true");
  await expect(discover).toContainText("7.242 Stichwörter");
  await discover.click();
  await expect(discover).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Wörter suchen").fill("school");
  await expect(
    page
      .locator(".dictionary-list summary")
      .filter({ hasText: "school" })
      .first(),
  ).toBeVisible();
  await training.click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    await expect(tabs).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/dictionary-tabs-${width}.png`,
      animations: "disabled",
    });
  }
});
