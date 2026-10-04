import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  initialState,
  stateSchema,
  type AppState,
  type Content,
  type ReviewEvent,
} from "../src/domain";
import { buildAchievements, recordNewAchievements } from "../src/achievements";
import { reachedGoalDays } from "../src/learning-activity";
import { exportBackup, parseBackup } from "../src/backup";
import { commitReview, openSession, undoReview } from "../src/engine";

const content: Content = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
);
const now = new Date("2026-10-04T12:00:00Z");
function setup() {
  const s = initialState(content.topics, now);
  s.settings.timezone = "Europe/Berlin";
  s.settings.dailyCardGoal = 30;
  return s;
}
function add(state: AppState, count = 30, extra: Partial<ReviewEvent> = {}) {
  const targets = content.targets
    .filter((t) => t.kind === "lexical")
    .slice(0, count);
  for (const target of targets)
    state.events.push({
      id: `goal-event-${state.events.length}`,
      deviceId: state.deviceId,
      sessionId: "goal-test",
      targetId: target.id,
      exercise: content.exercises.find(
        (e) => e.targetId === target.id && e.channel === "productive_recall",
      )!,
      index: 0,
      at: now.toISOString(),
      day: "not-authoritative",
      dailyGoal: 30,
      good: true,
      choice: null,
      mode: "regular",
      retry: false,
      revokedAt: null,
      engine: "ts-fsrs-5.4.2-retention-0.9",
      ...extra,
    });
}
const goals = (s: AppState) =>
  buildAchievements(s, content, now).find((a) => a.id === "goals-1")!;

describe("daily goal achievements", () => {
  it("captures the active goal on a real answer and supports undo", () => {
    const s = setup();
    for (const pref of Object.values(s.preferences)) pref.mode = "learn";
    s.settings.mode = "words";
    openSession(s, content, now);
    s.session!.revealed = true;
    commitReview(s, content, s.session!.queue[0].attemptId, true, null, now);
    expect(s.events[0].dailyGoal).toBe(30);
    s.settings.dailyCardGoal = 80;
    expect(s.events[0].dailyGoal).toBe(30);
    undoReview(s, now);
    expect(s.events[0].revokedAt).toBe(now.toISOString());
  });
  it("counts one goal per day and preserves the goal achieved before a later increase", () => {
    const s = setup();
    add(s);
    expect(goals(s)).toMatchObject({ value: 1, earned: true });
    s.settings.dailyCardGoal = 250;
    add(s, 30, { dailyGoal: 250 });
    expect(goals(s).value).toBe(1);
    add(s, 30, { at: "2026-10-03T12:00:00Z" });
    expect(goals(s).value).toBe(2);
    s.events[29].revokedAt = now.toISOString();
    expect(goals(s).value).toBe(1);
  });
  it("does not invent past goals or grant achievements just by lowering the current goal", () => {
    const s = setup();
    add(s, 30, { dailyGoal: undefined });
    expect(goals(s).earned).toBe(false);
    s.settings.dailyCardGoal = 50;
    add(s, 30, { dailyGoal: 30 }); // same-day duplicates cannot reach a new goal
    expect(goals(s).earned).toBe(false);
    add(s, 31);
    expect(goals(s).earned).toBe(true); // the new 31st card has its own snapshot
  });
  it("excludes retries, revoked and future answers and uses local calendar days", () => {
    for (const changes of [
      { retry: true },
      { revokedAt: now.toISOString() },
      { at: "2026-10-05T12:00:00Z" },
    ]) {
      const s = setup();
      add(s, 29);
      add(s, 30, changes);
      expect(goals(s).earned).toBe(false);
    }
    const s = setup();
    add(s, 30, {
      at: "2026-10-03T22:30:00Z",
      good: false,
      mode: "explicit_archive",
    });
    expect([...reachedGoalDays(s, now)]).toEqual(["2026-10-04"]);
    s.events.reverse();
    expect(goals(s).earned).toBe(true);
  });
});

describe("new milestone notifications", () => {
  it("records new achievements once, including after undo/re-answer and reload", async () => {
    const before = setup(),
      after = structuredClone(before);
    add(after, 1);
    expect(
      recordNewAchievements(before, after, content, now).map((a) => a.id),
    ).toEqual(["cards-1"]);
    expect(after.celebratedAchievements).toEqual(["cards-1"]);
    expect(recordNewAchievements(after, after, content, now)).toEqual([]);
    const restored = (await parseBackup(await exportBackup(after, content)))
      .state;
    expect(restored.celebratedAchievements).toEqual(["cards-1"]);
    restored.events[0].revokedAt = now.toISOString();
    const redone = structuredClone(restored);
    add(redone, 1);
    expect(recordNewAchievements(restored, redone, content, now)).toEqual([]);
    expect(
      buildAchievements(redone, content, now).find((a) => a.id === "cards-1")
        ?.earned,
    ).toBe(true);
  });
  it("does not celebrate old imported achievements or settings changes", () => {
    const before = setup();
    add(before, 30, { dailyGoal: undefined });
    const after = structuredClone(before);
    after.settings.dailyCardGoal = 30;
    expect(recordNewAchievements(before, after, content, now)).toEqual([]);
    add(after, 1);
    expect(recordNewAchievements(before, after, content, now)).toEqual([]);
    const imported = structuredClone(before);
    add(imported, 10);
    expect(recordNewAchievements(before, imported, content, now)).toEqual([]);
  });
  it("migrates older states without inventing goal snapshots and preserves new metadata in backups", async () => {
    const old = setup();
    add(old, 30, { dailyGoal: undefined });
    const { celebratedAchievements: omitted, ...legacy } = old;
    expect(omitted).toEqual([]);
    expect(stateSchema.parse(legacy).celebratedAchievements).toEqual([]);
    const fresh = setup();
    add(fresh);
    const roundtrip = (await parseBackup(await exportBackup(fresh, content)))
      .state;
    expect(roundtrip.events[29].dailyGoal).toBe(30);
    expect(goals(roundtrip).earned).toBe(true);
  });
});
