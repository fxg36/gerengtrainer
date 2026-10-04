import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  initialState,
  stateSchema,
  type AppState,
  type Content,
  type ReviewEvent,
} from "../src/domain";
import {
  recommendLevel,
  changeTrainingLevel,
  snoozeLevelRecommendation,
} from "../src/level-recommendation";
import { openSession } from "../src/engine";
import { exportBackup, parseBackup } from "../src/backup";

const content: Content = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
);
const now = new Date("2026-10-02T12:00:00Z");
const targets = content.targets
  .filter((t) => t.kind === "lexical" && t.level === "B1")
  .slice(0, 20);
function setup() {
  const state = initialState(content.topics, now);
  state.settings.level = "B1";
  state.settings.mode = "words";
  state.settings.timezone = "Europe/Berlin";
  for (const pref of Object.values(state.preferences)) pref.mode = "learn";
  state.events = targets
    .flatMap((target, index) =>
      ["productive_recall", "receptive_recall"].map(
        (channel, direction) =>
          ({
            id: `e-${index}-${direction}`,
            deviceId: state.deviceId,
            sessionId: "evidence",
            targetId: target.id,
            exercise: content.exercises.find(
              (e) => e.targetId === target.id && e.channel === channel,
            )!,
            index,
            at: new Date(
              now.getTime() -
                (direction ? 1 + (index % 2) : 5 + (index % 2)) * 86400000,
            ).toISOString(),
            day: "ignore-imported-day",
            good: true,
            choice: null,
            mode: "regular",
            retry: false,
            revokedAt: null,
            engine: "ts-fsrs-5.4.2-retention-0.9",
          }) as ReviewEvent,
      ),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  return state;
}

describe("training level recommendations", () => {
  it("preserves legacy settings but rejects new A1/A2 choices and never recommends A2", () => {
    const state = setup();
    const before = structuredClone(state);
    for (const level of ["A1", "A2"] as const) {
      changeTrainingLevel(state, level, null, now);
      changeTrainingLevel(state, level, "home", now);
    }
    expect(state).toEqual(before);
    state.settings.level = "A1";
    expect(recommendLevel(state, content, now)).toBeNull();
    expect(stateSchema.parse(state).settings.level).toBe("A1");
    state.settings.level = "A2";
    expect(stateSchema.parse(state).settings.level).toBe("A2");
  });
  it("suggests exactly the next available level after broad reliable practice without changing state", () => {
    const state = setup();
    const before = structuredClone(state);
    expect(recommendLevel(state, content, now)).toMatchObject({
      from: "B1",
      to: "B2",
      topicId: null,
      count: 40,
      correct: 40,
    });
    expect(state).toEqual(before);
  });
  it("requires independent days, sufficient topics' content, repeated meanings and both directions", () => {
    const state = setup();
    state.events = state.events.slice(0, 39);
    expect(recommendLevel(state, content, now)).toBeNull();
    const oneDay = setup();
    oneDay.events.forEach((e) => (e.at = now.toISOString()));
    expect(recommendLevel(oneDay, content, now)).toBeNull();
    const oneWay = setup();
    oneWay.events = oneWay.events.filter(
      (e) => e.exercise.channel === "receptive_recall",
    );
    oneWay.events = [
      ...oneWay.events,
      ...oneWay.events.map((e) => ({
        ...e,
        id: `${e.id}-again`,
        at: new Date(now.getTime() - 10 * 86400000).toISOString(),
      })),
    ];
    expect(recommendLevel(oneWay, content, now)).toBeNull();
  });
  it("does not hide weaknesses with repeats, retries, archive, future, old or revoked answers", () => {
    for (const changes of [
      { retry: true },
      { mode: "archive" as const },
      { revokedAt: now.toISOString() },
      { at: "2027-01-01T00:00:00Z" },
      { at: "2026-08-01T00:00:00Z" },
    ]) {
      const state = setup();
      Object.assign(state.events[0], changes);
      expect(recommendLevel(state, content, now)).toBeNull();
    }
    const state = setup();
    state.events.slice(0, 5).forEach((e) => {
      e.good = false;
    });
    state.events.push(
      ...state.events.slice(0, 5).map((e) => ({
        ...e,
        id: `${e.id}-repeat`,
        good: true,
        at: new Date(Date.parse(e.at) + 60000).toISOString(),
      })),
    );
    expect(recommendLevel(state, content, now)).toBeNull();
    const weakDirection = setup();
    weakDirection.events
      .filter((e) => e.exercise.channel === "productive_recall")
      .slice(0, 4)
      .forEach((e) => (e.good = false));
    expect(recommendLevel(weakDirection, content, now)).toBeNull(); // 90% overall, only 80% productive.
  });
  it("names the practiced domain in mixed mode and ignores easier levels and missing next-level stock", () => {
    const state = setup();
    state.settings.mode = "mixed";
    expect(recommendLevel(state, content, now)?.basis).toBe("Wortschatz");
    state.settings.mode = "words";
    state.settings.level = "B2";
    expect(recommendLevel(state, content, now)).toBeNull();
    state.settings.level = "C2";
    expect(recommendLevel(state, content, now)).toBeNull();
    state.settings.level = "B1";
    expect(
      recommendLevel(
        state,
        {
          ...content,
          targets: content.targets.filter((t) => t.level !== "B2"),
        },
        now,
      ),
    ).toBeNull();
  });
  it("does not let strong vocabulary hide a weak grammar direction in mixed mode", () => {
    const state = setup();
    state.settings.mode = "mixed";
    const grammar = content.targets.find(
      (t) => t.kind === "grammar" && t.level === "B1",
    )!;
    const exercise = content.exercises.find(
      (e) => e.targetId === grammar.id && e.channel === "grammar_production",
    )!;
    for (let i = 0; i < 5; i++)
      state.events.push({
        ...state.events[0],
        id: `weak-grammar-${i}`,
        targetId: grammar.id,
        exercise,
        at: new Date(now.getTime() - (i + 1) * 86400000).toISOString(),
        good: i === 0,
      });
    // Still over 90% overall, but only 20% in the observed grammar direction.
    expect(recommendLevel(state, content, now)).toBeNull();
  });
  it("respects inactive topics and makes a specific suggestion for an explicitly overridden topic", () => {
    const state = setup();
    Object.values(state.preferences).forEach((pref) => (pref.mode = "paused"));
    expect(recommendLevel(state, content, now)).toBeNull();
    const topicId = "test-topic";
    const scoped: Content = {
      ...content,
      topics: [{ ...content.topics[0], id: topicId }],
      targets: content.targets.map((t) => ({
        ...t,
        ownerTopicId: topicId,
        dimensions: { ...t.dimensions, Themen: [topicId] },
      })),
    };
    const specific = setup();
    specific.settings.level = "C1";
    specific.preferences[topicId] = {
      ...specific.preferences.home,
      mode: "learn",
      level: "B1",
    };
    expect(recommendLevel(specific, scoped, now)).toMatchObject({
      from: "B1",
      to: "B2",
      topicId,
    });
    changeTrainingLevel(specific, "B2", topicId, now);
    expect(specific.settings.level).toBe("C1");
    expect(specific.preferences[topicId].level).toBe("B2");
  });
  it("snoozes persistently, preserves backups and requires new evidence after manual changes", async () => {
    const state = setup();
    snoozeLevelRecommendation(state, null, now);
    expect(recommendLevel(state, content, now)).toBeNull();
    expect(
      recommendLevel(state, content, new Date(now.getTime() + 8 * 86400000)),
    ).toBeNull();
    const restored = await parseBackup(await exportBackup(state, content));
    expect(restored.state.settings.levelSuggestions).toEqual(
      state.settings.levelSuggestions,
    );
    const legacy = structuredClone(state) as any;
    delete legacy.settings.levelSuggestions;
    expect(stateSchema.parse(legacy).settings.levelSuggestions).toEqual({});
    const manual = setup();
    changeTrainingLevel(manual, "B2", null, now);
    changeTrainingLevel(manual, "B1", null, now);
    expect(recommendLevel(manual, content, now)).toBeNull();
  });
  it("acceptance leaves current sessions, learning memory and explicit topic levels untouched", () => {
    const state = setup();
    state.preferences.travel.level = "C1";
    openSession(state, content, now);
    const before = structuredClone(state);
    changeTrainingLevel(state, "B2", null, now);
    expect(state.settings.level).toBe("B2");
    expect(state.session).toEqual(before.session);
    expect(state.memory).toEqual(before.memory);
    expect(state.events).toEqual(before.events);
    expect(state.preferences).toEqual(before.preferences);
    expect(state.savedSessions).toEqual(before.savedSessions);
  });
});
