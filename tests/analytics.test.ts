import { describe, expect, it } from "vitest";
import { buildAnalytics, shiftDay } from "../src/analytics";
import { setParticipation } from "../src/engine";
import {
  initialState,
  lexicalExercises,
  memoryKey,
  stateSchema,
  type AppState,
  type Channel,
  type Content,
  type ReviewEvent,
  type Target,
} from "../src/domain";

const now = new Date("2026-10-01T12:00:00Z");
const topics = ["home", "grammar"].map((id) => ({
  id,
  title: id,
  description: "",
  icon: "BookOpen",
  color: "sage",
}));
const targets: Target[] = Array.from({ length: 4 }, (_, i) => ({
  id: `target-${i}`,
  word: `word ${i}`,
  de: `Bedeutung ${i}`,
  ownerTopicId: i === 3 ? "grammar" : "home",
  kind: i === 3 ? "grammar" : "lexical",
  pos: "",
  gloss: "",
  example: "",
  dimensions: {},
  source: { name: "test", url: "", sourceId: "", license: "test" },
  reviewStatus: "personal",
  classification: "user",
  version: 1,
}));
const content: Content = {
  version: "test",
  topics,
  targets,
  exercises: targets.flatMap(lexicalExercises),
  manifest: {
    generatedAt: now.toISOString(),
    reviewStatus: "personal",
    sourceCount: 0,
  },
};
function setup() {
  const state = initialState(topics, now);
  state.settings.timezone = "Europe/Berlin";
  for (const pref of Object.values(state.preferences)) pref.mode = "learn";
  return state;
}
function event(
  state: AppState,
  target = targets[0],
  channel: Channel = "productive_recall",
  daysAgo = 1,
  good = true,
  retry = false,
) {
  const at = new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  const exercise = {
    ...lexicalExercises(target)[0],
    channel,
    mode:
      channel === "grammar_recognition"
        ? ("choice" as const)
        : ("recall" as const),
  };
  const review: ReviewEvent = {
    id: `event-${state.events.length}`,
    deviceId: state.deviceId,
    sessionId: "test-session",
    targetId: target.id,
    exercise,
    index: 0,
    at,
    day: "unused-original-timezone",
    good,
    choice: null,
    mode: "regular",
    retry,
    revokedAt: null,
    engine: "ts-fsrs-5.4.2-retention-0.9",
  };
  state.events.push(review);
  return review;
}
function firmChannel(state: AppState, target: Target, channel: Channel) {
  for (const daysAgo of [15, 8, 1]) event(state, target, channel, daysAgo);
  state.memory[memoryKey(target.id, channel)] = {
    due: "2026-10-15T12:00:00Z",
    stability: 30,
    difficulty: 5,
    elapsed_days: 7,
    scheduled_days: 14,
    learning_steps: 0,
    reps: 3,
    lapses: 0,
    state: 2,
    last_review: "2026-09-30T12:00:00Z",
  };
}
function firmTarget(state: AppState, target = targets[0]) {
  const channels: Channel[] =
    target.kind === "grammar"
      ? ["grammar_production", "grammar_recognition"]
      : ["productive_recall", "receptive_recall"];
  channels.forEach((channel) => firmChannel(state, target, channel));
}

describe("Local learning analytics", () => {
  it("keeps an empty profile honest and fills zero-activity days", () => {
    const result = buildAnalytics(setup(), content, now);
    expect(result.summary).toMatchObject({
      total: 4,
      seen: 0,
      consolidated: 0,
      percent: 0,
      stage: 0,
    });
    expect(result.stats.recall.percent).toBeNull();
    expect(result.stats.choice.percent).toBeNull();
    expect(result.activity).toHaveLength(30);
    expect(result.activity.every((day) => day.count === 0)).toBe(true);
    expect(result.focus).toHaveLength(0);
  });
  it("requires independent spaced success in both directions, even with a mature card", () => {
    const s = setup();
    firmChannel(s, targets[0], "productive_recall");
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(0);
    firmChannel(s, targets[0], "receptive_recall");
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(1);
    s.events = s.events.slice(-2);
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(0);
  });
  it("does not use immediate retries or same-day success as retention evidence", () => {
    const s = setup();
    firmTarget(s);
    s.events.forEach((e) => {
      e.retry = true;
    });
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(0);
    expect(buildAnalytics(s, content, now).stats.recall.percent).toBeNull();
    s.events.forEach((e) => {
      e.retry = false;
      e.at = "2026-09-30T12:00:00Z";
    });
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(0);
  });
  it("requires seven elapsed days and a still-current review card", () => {
    const s = setup();
    firmTarget(s);
    const originals = structuredClone(s.events);
    s.events.forEach((e, i) => {
      e.at = new Date(now.getTime() - (3 - (i % 3)) * 86_400_000).toISOString();
    });
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(0);
    s.events = originals;
    const card = s.memory[memoryKey(targets[0].id, "productive_recall")];
    card.due = "2026-09-30T11:00:00Z";
    expect(buildAnalytics(s, content, now).summary).toMatchObject({
      consolidated: 0,
      due: 1,
    });
    card.due = "2026-10-15T12:00:00Z";
    card.stability = 13;
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(0);
    card.stability = 14;
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(1);
  });
  it("a failure resets consolidation and undo removes that evidence", () => {
    const s = setup();
    firmTarget(s);
    const wrong = event(s, targets[0], "productive_recall", 0, false);
    event(s, targets[0], "productive_recall", 0, true, true);
    expect(buildAnalytics(s, content, now).summary.consolidated).toBe(0);
    wrong.revokedAt = now.toISOString();
    const result = buildAnalytics(s, content, now);
    expect(result.summary.consolidated).toBe(1);
    expect(result.stats.recall).toMatchObject({
      good: 6,
      count: 6,
      percent: 100,
    });
    expect(result.stats.retries).toBe(1);
  });
  it("does not count archiving unseen words as activity, mastery or a learning day", () => {
    const s = setup();
    const before = buildAnalytics(s, content, now);
    setParticipation(s, targets[0].id, "archived");
    setParticipation(s, targets[1].id, "archived");
    s.settings.level = "C1";
    const after = buildAnalytics(s, content, now);
    expect(after.summary).toEqual({ ...before.summary, archived: 2 });
    expect(after.stats).toEqual(before.stats);
    expect(after.activity).toEqual(before.activity);
    expect(s.memory).toEqual({});
    expect(s.events).toEqual([]);
  });
  it("keeps paused and archived learning, without treating archiving as success", () => {
    const s = setup();
    firmTarget(s);
    s.participation[targets[0].id] = "archived";
    s.participation[targets[1].id] = "archived";
    s.preferences.home.mode = "paused";
    const result = buildAnalytics(s, content, now);
    expect(result.summary).toMatchObject({
      consolidated: 1,
      seen: 1,
      archived: 2,
      total: 4,
    });
    expect(result.focus).toHaveLength(0);
    s.memory[memoryKey(targets[0].id, "productive_recall")].due =
      "2026-09-30T12:00:00Z";
    expect(buildAnalytics(s, content, now).summary.due).toBe(0);
  });
  it("migrates old exclusions to archive without inventing answers or mastery", () => {
    const s = setup();
    firmTarget(s);
    const legacy = {
      ...s,
      participation: Object.fromEntries(targets.map((t) => [t.id, "excluded"])),
    };
    const migrated = stateSchema.parse(legacy);
    const result = buildAnalytics(migrated, content, now);
    expect(result.summary).toMatchObject({
      total: 4,
      seen: 1,
      consolidated: 1,
      archived: 4,
    });
    expect(result.stats.attempts).toBe(6);
    expect(result.activity).toEqual(buildAnalytics(s, content, now).activity);
    expect(result.focus).toHaveLength(0);
    expect(migrated.events).toEqual(s.events);
    expect(migrated.memory).toEqual(s.memory);
  });
  it("filters topic and period while learning status always uses the full history", () => {
    const s = setup();
    firmTarget(s);
    firmTarget(s, targets[3]);
    const result = buildAnalytics(s, content, now, "grammar", 7);
    expect(result.summary).toMatchObject({
      total: 1,
      consolidated: 1,
      percent: 100,
      stage: 3,
    });
    expect(result.stats.attempts).toBe(2);
    expect(result.stats.recall.count).toBe(1);
    expect(result.stats.choice.count).toBe(1);
    expect(result.activeDays).toBe(1);
    expect(result.topics).toHaveLength(2);
    expect(result.topics[0].consolidated).toBe(1);
    expect(
      buildAnalytics(s, content, now, "grammar", "all").stats.attempts,
    ).toBe(6);
  });
  it("counts learning days in the profile timezone, including month and DST boundaries", () => {
    const s = setup();
    const e = event(s);
    e.at = "2026-09-30T22:30:00Z";
    expect(buildAnalytics(s, content, now).activity.at(-1)?.count).toBe(1);
    expect(shiftDay("2026-03-30", -1)).toBe("2026-03-29");
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("ignores revoked and future events, and sorts imported history by time", () => {
    const s = setup();
    firmTarget(s);
    s.events.reverse();
    event(s, targets[1], "productive_recall", -1, false);
    event(s, targets[2], "productive_recall", 0, false).revokedAt =
      now.toISOString();
    const result = buildAnalytics(s, content, now);
    expect(result.summary).toMatchObject({ consolidated: 1, seen: 1 });
    expect(result.stats.attempts).toBe(6);
    expect(result.history[0].at).toBe("2026-09-30T12:00:00.000Z");
  });
  it("never counts a buried sibling as due today", () => {
    const s = setup();
    firmTarget(s);
    event(s, targets[0], "productive_recall", 0);
    s.memory[memoryKey(targets[0].id, "receptive_recall")].due =
      "2026-09-30T12:00:00Z";
    expect(buildAnalytics(s, content, now).summary.due).toBe(0);
    s.events = s.events.filter((e) => e.at !== now.toISOString());
    s.settings.mode = "grammar";
    expect(buildAnalytics(s, content, now).summary.due).toBe(0);
    s.settings.mode = "words";
    expect(buildAnalytics(s, content, now).summary.due).toBe(1);
  });
});
