import { test, expect } from "./fixtures";

test("global training focus reflects channel performance independently of report filters", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Dein Lernmoment" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const course = await (await fetch("/content/course.json")).json();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("wortnah");
      request.onerror = reject;
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("state", "readwrite");
        const store = transaction.objectStore("state");
        const read = store.get("current");
        read.onsuccess = () => {
          const saved = read.result;
          const at = new Date(Date.now() - 86_400_000).toISOString();
          const words = course.targets
            .filter((t: any) => t.kind === "lexical")
            .slice(0, 20);
          saved.events = words.flatMap((target: any) =>
            ["productive_recall", "receptive_recall"].map((channel) => ({
              id: crypto.randomUUID(),
              deviceId: saved.deviceId,
              sessionId: "focus-sample",
              targetId: target.id,
              exercise: course.exercises.find(
                (e: any) => e.targetId === target.id && e.channel === channel,
              ),
              index: 0,
              at,
              day: at.slice(0, 10),
              good: channel === "receptive_recall",
              choice: null,
              mode: "regular",
              retry: false,
              revokedAt: null,
              engine: "ts-fsrs-5.4.2-retention-0.9",
            })),
          );
          store.put(saved, "current");
        };
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = reject;
      };
    });
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Hauptnavigation" })
    .getByRole("button", { name: "Fortschritt", exact: true })
    .click();
  const focus = page.locator(".training-focus-details");
  await focus
    .getByText("Automatischer Trainingsfokus", { exact: true })
    .click();
  const productive = focus
    .locator("dl > div")
    .filter({ has: page.getByText("Deutsch → Englisch", { exact: true }) });
  const receptive = focus
    .locator("dl > div")
    .filter({ has: page.getByText("Englisch → Deutsch", { exact: true }) });
  await expect(productive).toContainText("2× Gewicht");
  await expect(productive).toContainText("0 % gewusst · 20 Antworten");
  await expect(receptive).toContainText("Standardgewicht");
  await expect(focus).toContainText("0 von 10 Antworten für eine Anpassung");
  await page.getByRole("button", { name: "7 Tage", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Fortschritt für Thema" })
    .selectOption("grammar");
  await expect(productive).toContainText("2× Gewicht");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await focus.evaluate((el) => el.scrollIntoView({ block: "start" }));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/training-focus-${width}.png`,
      animations: "disabled",
    });
  }
});
