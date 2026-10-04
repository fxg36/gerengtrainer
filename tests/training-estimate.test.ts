import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  initialState,
  type AppState,
  type Content,
  type LearningLevel,
  type ReviewEvent,
} from "../src/domain";
import { estimateTraining } from "../src/training-estimate";
import { exportBackup, parseBackup, restoredState } from "../src/backup";

const content: Content = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
);
const now = new Date("2026-10-04T12:00:00Z");
function add(
  state: AppState,
  kind: "lexical" | "grammar",
  level: LearningLevel,
) {
  const targets = content.targets
    .filter((t) => t.kind === kind && t.level === level)
    .slice(0, kind === "lexical" ? 20 : 5);
  const channels =
    kind === "lexical"
      ? ["productive_recall", "receptive_recall"]
      : ["grammar_production", "grammar_recognition"];
  for (let day = 1; day <= (kind === "lexical" ? 2 : 4); day++)
    targets.forEach((target, index) => {
      channels.forEach((channel, direction) => {
        // Word evidence has 40 samples over four dates; grammar 40 over four dates.
        if (kind === "lexical" && direction !== day - 1) return;
        const at = new Date(
          now.getTime() -
            (kind === "lexical" ? day * 3 + (index % 2) : day) * 86400000,
        ).toISOString();
        const exercise = content.exercises.find(
          (e) => e.targetId === target.id && e.channel === channel,
        )!;
        state.events.push({
          id: `event-${state.events.length}`,
          deviceId: state.deviceId,
          sessionId: "estimate-test",
          targetId: target.id,
          exercise,
          index,
          at,
          day: "ignored",
          good: true,
          choice: exercise.mode === "choice" ? exercise.answer : null,
          mode: "regular",
          retry: false,
          revokedAt: null,
          engine: "ts-fsrs-5.4.2-retention-0.9",
        });
      });
    });
  state.events.sort((a, b) => a.at.localeCompare(b.at));
}
function setup() {
  const state = initialState(content.topics, now);
  state.settings.timezone = "Europe/Berlin";
  return state;
}
describe("observed training estimates", () => {
  it("preserves evidence when a backup restores unchanged course snapshots", async () => {
    const s = setup();
    add(s, "lexical", "B1");
    add(s, "grammar", "B1");
    const restored = restoredState(
      await parseBackup(await exportBackup(s, content)),
      content,
    );
    expect(restored.personalTargets.length).toBeGreaterThan(0);
    expect(estimateTraining(restored, content, now)).toEqual(
      estimateTraining(s, content, now),
    );
  });
  it("does not infer skill from a chosen level and discloses sparse domains", () => {
    const s = setup();
    s.settings.level = "C2";
    expect(estimateTraining(s, content, now)).toMatchObject({
      level: null,
      words: { level: null },
      grammar: { level: null },
    });
    add(s, "lexical", "B1");
    expect(estimateTraining(s, content, now)).toMatchObject({
      level: null,
      words: { level: "B1" },
      grammar: { level: null },
    });
    expect(s.settings.level).toBe("C2");
  });
  it("uses the lower observed domain for the combined text estimate and the highest supported level per domain", () => {
    const s = setup();
    add(s, "lexical", "B2");
    add(s, "lexical", "A2");
    add(s, "grammar", "B1");
    expect(estimateTraining(s, content, now)).toMatchObject({
      level: "B1",
      words: { level: "B2" },
      grammar: { level: "B1" },
    });
    expect(
      estimateTraining(s, content, new Date("2026-12-01T12:00:00Z")).level,
    ).toBeNull();
  });
  it("requires broad multi-day evidence and both directions, excluding invalid evidence", () => {
    for (const change of [
      { retry: true },
      { revokedAt: now.toISOString() },
      { mode: "archive" },
      { at: "2026-10-05T12:00:00Z" },
      { at: "2026-08-01T12:00:00Z" },
    ] as Partial<ReviewEvent>[]) {
      const s = setup();
      add(s, "lexical", "B1");
      Object.assign(s.events[0], change);
      expect(estimateTraining(s, content, now).words.level).toBeNull();
    }
    const oneDay = setup();
    add(oneDay, "lexical", "B1");
    oneDay.events.forEach((e) => (e.at = now.toISOString()));
    expect(estimateTraining(oneDay, content, now).words.level).toBeNull();
    const oneDirection = setup();
    add(oneDirection, "lexical", "B1");
    oneDirection.events = oneDirection.events.filter(
      (e) => e.exercise.channel === "productive_recall",
    );
    oneDirection.events.push(
      ...oneDirection.events.map((e) => ({
        ...e,
        id: `${e.id}-repeat`,
        at: "2026-10-03T12:00:00Z",
      })),
    );
    expect(estimateTraining(oneDirection, content, now).words.level).toBeNull();
  });
  it("does not let repeat successes hide weak recall, or altered personal content confer a level", () => {
    const s = setup();
    add(s, "lexical", "B1");
    s.events
      .filter((e) => e.exercise.channel === "productive_recall")
      .slice(0, 4)
      .forEach((e) => (e.good = false));
    s.events.push(
      ...s.events
        .filter((e) => !e.good)
        .map((e) => ({
          ...e,
          id: `${e.id}-repeat`,
          at: new Date(Date.parse(e.at) + 60000).toISOString(),
          good: true,
        })),
    );
    expect(estimateTraining(s, content, now).words.level).toBeNull();
    const personal = setup();
    add(personal, "lexical", "B1");
    personal.personalTargets.push({
      ...content.targets.find((t) => t.id === personal.events[0].targetId)!,
      classification: "user",
      level: "C2",
    });
    expect(estimateTraining(personal, content, now).words.level).toBeNull();
    const altered = setup();
    add(altered, "lexical", "B1");
    altered.events[0].exercise = {
      ...altered.events[0].exercise,
      prompt: "An edited exercise",
    };
    expect(estimateTraining(altered, content, now).words.level).toBeNull();
  });
});
