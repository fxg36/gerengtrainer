import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  allTargets,
  initialState,
  lexicalExercises,
  memoryKey,
  type Content,
  type Target,
} from "../src/domain";
import {
  commitReview,
  dayKey,
  normalizeSession,
  permitted,
  planSession,
  reviewCard,
  setParticipation,
  setTopic,
  undoReview,
} from "../src/engine";
import {
  exportBackup,
  parseBackup,
  restoredState,
  validateRelations,
} from "../src/backup";

const now = new Date("2026-10-01T12:00:00Z");
const topics = [
  { id: "home", title: "Home", description: "", icon: "House", color: "sage" },
  {
    id: "travel",
    title: "Travel",
    description: "",
    icon: "Plane",
    color: "sand",
  },
  {
    id: "grammar",
    title: "Grammar",
    description: "",
    icon: "SpellCheck",
    color: "peach",
  },
];
const targets: Target[] = Array.from({ length: 40 }, (_, i) => ({
  id: `word-${i}`,
  kind: "lexical",
  ownerTopicId: i < 20 ? "home" : "travel",
  word: `word ${i}`,
  de: `Bedeutung ${i}`,
  gloss: "A test word.",
  pos: "noun",
  example: "",
  dimensions: { Themen: ["home", "travel"] },
  source: { name: "Test", url: "", license: "Test", sourceId: "" },
  classification: "user",
  reviewStatus: "personal",
  version: 1,
}));
const content: Content = {
  version: "test",
  targets,
  exercises: targets.flatMap(lexicalExercises),
  topics,
  manifest: {
    sourceCount: 40,
    generatedAt: now.toISOString(),
    reviewStatus: "personal",
  },
};
function setup() {
  const s = initialState(topics, now);
  s.settings.timezone = "Europe/Berlin";
  s.settings.onboarded = true;
  s.settings.minutes = 10;
  setTopic(s, "home", { mode: "learn" });
  return s;
}
function answer(s: ReturnType<typeof setup>, good = true) {
  s.session!.revealed = true;
  commitReview(
    s,
    content,
    s.session!.queue[s.session!.index].attemptId,
    good,
    null,
    now,
  );
}

describe("Learning policies and scheduling", () => {
  it("pauses all non-selected topics, even when secondary topic tags match", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    expect(s.session.queue.length).toBe(6);
    expect(
      s.session.queue.every(
        (q) =>
          targets.find((t) => t.id === q.exercise.targetId)?.ownerTopicId ===
          "home",
      ),
    ).toBe(true);
  });
  it("distributes new vocabulary fairly across selected topics", () => {
    const s = setup();
    setTopic(s, "travel", { mode: "learn" });
    const session = planSession(s, content, now);
    expect(
      session.queue.filter(
        (q) =>
          targets.find((t) => t.id === q.exercise.targetId)?.ownerTopicId ===
          "home",
      ),
    ).toHaveLength(3);
    expect(
      session.queue.filter(
        (q) =>
          targets.find((t) => t.id === q.exercise.targetId)?.ownerTopicId ===
          "travel",
      ),
    ).toHaveLength(3);
  });
  it("maintain introduces no new recall channels", () => {
    const s = setup();
    setTopic(s, "home", { mode: "maintain" });
    expect(planSession(s, content, now).queue).toHaveLength(0);
    s.memory[memoryKey("word-0", "productive_recall")] = reviewCard(
      undefined,
      true,
      new Date("2026-09-01T12:00:00Z"),
    );
    const queue = planSession(s, content, now).queue;
    expect(queue).toHaveLength(1);
    expect(queue[0].exercise.channel).toBe("productive_recall");
  });
  it("respects excluded targets at planning, display and commit", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    const item = s.session.queue[0];
    setParticipation(s, item.exercise.targetId, "excluded");
    expect(() => answer(s)).toThrow(/ausgeschlossen/);
    normalizeSession(s, content);
    expect(s.session.index).toBe(1);
    expect(
      planSession(s, content, now).queue.some(
        (q) => q.exercise.targetId === item.exercise.targetId,
      ),
    ).toBe(false);
  });
  it("rechecks topic pauses at commit", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    setTopic(s, "home", { mode: "paused" });
    expect(() => answer(s)).toThrow();
    normalizeSession(s, content);
    expect(s.session.finished).toBe(true);
  });
  it("keeps archive at zero out of all automatic sessions", () => {
    const s = setup();
    for (const t of targets) setParticipation(s, t.id, "archived");
    expect(planSession(s, content, now).queue).toHaveLength(0);
  });
  it("caps archive against the nominal budget when only archive exists", () => {
    const s = setup();
    setTopic(s, "home", { quota: 20 });
    for (const t of targets) setParticipation(s, t.id, "archived");
    const session = planSession(s, content, now);
    expect(session.queue).toHaveLength(4);
    expect(session.queue.every((q) => q.mode === "archive")).toBe(true);
  });
  it("explicit archive practice works while paused but exclusions remain blocked", () => {
    const s = setup();
    setTopic(s, "home", { mode: "paused" });
    for (const t of targets) setParticipation(s, t.id, "archived");
    setParticipation(s, "word-0", "excluded");
    const session = planSession(s, content, now, "home");
    expect(session.queue).toHaveLength(19);
    expect(
      session.queue.every(
        (q) =>
          q.mode === "explicit_archive" && q.exercise.targetId !== "word-0",
      ),
    ).toBe(true);
  });
  it("archive failure does not reactivate and does not add retries outside quota", () => {
    const s = setup();
    setTopic(s, "home", { quota: 50 });
    for (const t of targets) setParticipation(s, t.id, "archived");
    s.session = planSession(s, content, now);
    const count = s.session.queue.length,
      id = s.session.queue[0].exercise.targetId;
    answer(s, false);
    expect(s.participation[id]).toBe("archived");
    expect(s.session.queue).toHaveLength(count);
  });
  it("quota changes immediately invalidate the pending archive allocation", () => {
    const s = setup();
    setTopic(s, "home", { quota: 50 });
    for (const t of targets) setParticipation(s, t.id, "archived");
    s.session = planSession(s, content, now);
    setTopic(s, "home", { quota: 10 });
    normalizeSession(s, content);
    expect(s.session.finished).toBe(true);
  });
  it("does not commit fractional archive carry during planning", () => {
    const s = setup();
    s.settings.minutes = 3;
    setTopic(s, "home", { quota: 5 });
    s.session = planSession(s, content, now);
    expect(s.preferences.home.remainder).toBe(0);
    answer(s);
    expect(s.preferences.home.remainder).toBeCloseTo(0.3);
    const value = s.preferences.home.remainder;
    const event = s.events[0];
    commitReview(s, content, event.id, true, null, now);
    expect(s.preferences.home.remainder).toBe(value);
  });
  it("blocks explicitly targeted excluded distractors", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    const item = structuredClone(s.session.queue[0]);
    item.exercise.relatedTargetIds = ["word-15"];
    setParticipation(s, "word-15", "excluded");
    expect(permitted(s, item, new Map(targets.map((t) => [t.id, t])))).toBe(
      false,
    );
  });
  it("never uses the same target twice in the original queue", () => {
    const s = setup();
    const session = planSession(s, content, now);
    expect(new Set(session.queue.map((q) => q.exercise.targetId)).size).toBe(
      session.queue.length,
    );
  });
  it("is reproducible with the same clock and state, including option order", () => {
    const s = setup();
    expect(
      planSession(s, content, now).queue.map((q) => q.exercise.id),
    ).toEqual(planSession(s, content, now).queue.map((q) => q.exercise.id));
  });
});
describe("Review commits", () => {
  it("invalidates a pending automatic archive allocation after the local day changes", () => {
    const s = setup();
    setTopic(s, "home", { quota: 50 });
    for (const t of targets) setParticipation(s, t.id, "archived");
    s.session = planSession(s, content, now);
    const tomorrow = new Date("2026-10-02T12:00:00Z");
    s.session.revealed = true;
    expect(() =>
      commitReview(
        s,
        content,
        s.session!.queue[0].attemptId,
        true,
        null,
        tomorrow,
      ),
    ).toThrow();
    normalizeSession(s, content, tomorrow);
    expect(s.session.finished).toBe(true);
  });
  it("commits a repeated attempt only once", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    answer(s);
    answer(s);
    expect(s.events).toHaveLength(1);
    expect(Object.values(s.memory)[0].reps).toBe(1);
  });
  it("does not score an unrevealed recall", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    expect(() =>
      commitReview(s, content, s.session!.queue[0].attemptId, true, null, now),
    ).toThrow(/auf/);
    expect(s.events).toHaveLength(0);
  });
  it("changes only the exercised recall direction", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    answer(s);
    const e = s.events[0];
    expect(Object.keys(s.memory)).toEqual([
      memoryKey(e.targetId, e.exercise.channel),
    ]);
  });
  it("undo preserves the event as revoked and restores the projection", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    const originalId = s.session.queue[0].attemptId;
    answer(s, false);
    expect(s.session.queue).toHaveLength(7);
    undoReview(s, now);
    expect(s.events[0].revokedAt).not.toBeNull();
    expect(s.memory).toEqual({});
    expect(s.session.queue).toHaveLength(6);
    expect(s.session.queue[0].attemptId).not.toBe(originalId);
    expect(s.session.revealed).toBe(true);
    answer(s, true);
    expect(s.events.filter((e) => !e.revokedAt)).toHaveLength(1);
  });
  it("does not repeatedly introduce more than the daily target limit", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    while (!s.session.finished) {
      answer(s);
      s.session.index++;
      s.session.feedback = null;
      s.session.revealed = false;
      normalizeSession(s, content);
    }
    const next = planSession(s, content, now);
    expect(
      next.queue.every((q) =>
        s.events.some((e) => e.targetId === q.exercise.targetId),
      ),
    ).toBe(true);
  });
  it("rejects backwards clocks", () => {
    const card = reviewCard(undefined, true, now);
    expect(() => reviewCard(card, true, new Date("2026-09-01"))).toThrow(
      /Geräteuhr/,
    );
  });
  it("uses an explicit timezone at date boundaries", () => {
    expect(dayKey(new Date("2026-10-01T22:30:00Z"), "Europe/Berlin")).toBe(
      "2026-10-02",
    );
    expect(dayKey(new Date("2026-10-01T22:30:00Z"), "America/New_York")).toBe(
      "2026-10-01",
    );
  });
});
describe("Portable backups", () => {
  it("round trips progress, pauses, archive, custom content and revealed session", async () => {
    const s = setup();
    s.session = planSession(s, content, now);
    answer(s);
    setParticipation(s, "word-15", "archived");
    s.reports.push({
      targetId: "word-15",
      at: now.toISOString(),
      note: "Check",
    });
    const parsed = await parseBackup(await exportBackup(s, content));
    expect(parsed.state).toEqual(s);
    const restored = restoredState(parsed, content);
    expect(allTargets(restored, content)).toHaveLength(targets.length);
    expect(restored.session).toEqual(s.session);
  });
  it("rejects corrupt payloads without changing the input state", async () => {
    const s = setup(),
      before = structuredClone(s),
      raw = JSON.parse(await exportBackup(s, content));
    raw.payload.state.settings.minutes = 40;
    await expect(parseBackup(JSON.stringify(raw))).rejects.toThrow(/Prüfsumme/);
    expect(s).toEqual(before);
  });
  it("rejects unknown schema versions and foreign formats", async () => {
    await expect(parseBackup('{"format":"other"}')).rejects.toThrow(/Wortnah/);
    await expect(
      parseBackup('{"format":"wortnah-backup","schemaVersion":2}'),
    ).rejects.toThrow(/Version/);
  });
  it("rejects dangling content references", () => {
    const s = setup();
    s.participation.unknown = "excluded";
    expect(() => validateRelations({ state: s, content })).toThrow(
      /fehlende Inhalte/,
    );
  });
  it("rejects malformed JSON", async () => {
    await expect(parseBackup("{")).rejects.toThrow(/JSON/);
  });
  it("validates the shipped corpus including 30 distinct grammar goals", async () => {
    const real = JSON.parse(
      readFileSync("public/content/course.json", "utf8"),
    ) as Content;
    const state = initialState(real.topics, now);
    const payload = await parseBackup(await exportBackup(state, real));
    expect(
      payload.content.targets.filter((t) => t.kind === "grammar"),
    ).toHaveLength(30);
    expect(
      payload.content.exercises.filter((e) => e.mode === "choice"),
    ).toHaveLength(150);
  });
});
