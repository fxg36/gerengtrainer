import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  allTargets,
  ALL_ARCHIVE_TOPICS,
  initialState,
  lexicalExercises,
  memoryKey,
  stateSchema,
  withExerciseCues,
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
  dimensions: { Themen: [i < 20 ? "home" : "travel"] },
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
  s.settings.dailyCardGoal = 30;
  s.settings.limitNewPerDay = true;
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
  const levelContent: Content = (() => {
    const graded = ["A1", "A2", "B1", "B2", "C1", "C2"].flatMap((level) =>
      Array.from({ length: 80 }, (_, i) => ({
        ...targets[0],
        id: `${level}-${i}`,
        level: level as NonNullable<Target["level"]>,
        word: `${level} word ${i}`,
      })),
    );
    return {
      ...content,
      targets: graded,
      exercises: graded.flatMap(lexicalExercises),
    };
  })();
  it("mixes 60% focus and 40% easier targets at B2, C1 and C2 without harder introductions", () => {
    for (const level of ["B2", "C1", "C2"] as const) {
      const s = setup();
      s.settings.level = level;
      s.settings.limitNewPerDay = false;
      s.settings.dailyCardGoal = 40;
      const queue = planSession(s, levelContent, now).queue;
      expect(queue).toHaveLength(40);
      expect(new Set(queue.map((item) => item.exercise.targetId)).size).toBe(
        40,
      );
      expect(
        queue.filter((item) => item.exercise.targetId.startsWith(level)),
      ).toHaveLength(24);
      expect(
        queue.some((item) => item.exercise.targetId.startsWith("A2")),
      ).toBe(true);
      if (level !== "C2")
        expect(
          queue.some((item) => item.exercise.targetId.startsWith("C2")),
        ).toBe(false);
      if (level === "B2")
        expect(
          queue.some((item) => item.exercise.targetId.startsWith("C1")),
        ).toBe(false);
      expect(
        planSession(s, levelContent, now).queue.map((q) => q.exercise.id),
      ).toEqual(queue.map((q) => q.exercise.id));
    }
  });
  it("uses a topic override and returns to the global level when it is removed", () => {
    const s = setup();
    s.settings.limitNewPerDay = false;
    s.settings.level = "C1";
    setTopic(s, "home", { level: "A2" });
    const queue = planSession(s, levelContent, now).queue;
    expect(queue.every((q) => /^(A1|A2)-/.test(q.exercise.targetId))).toBe(
      true,
    );
    expect(
      queue.filter((q) => q.exercise.targetId.startsWith("A2")),
    ).toHaveLength(18);
    setTopic(s, "home", { level: null });
    expect(
      planSession(s, levelContent, now).queue.filter((q) =>
        q.exercise.targetId.startsWith("C1"),
      ),
    ).toHaveLength(18);
  });
  it("keeps due reviews at any level first and leaves the running round untouched", () => {
    const s = setup();
    s.settings.limitNewPerDay = false;
    s.settings.level = "C1";
    s.session = planSession(s, levelContent, now);
    const snapshot = structuredClone(s.session);
    s.memory[memoryKey("C2-0", "productive_recall")] = reviewCard(
      undefined,
      true,
      new Date("2026-09-01T12:00:00Z"),
    );
    s.settings.level = "A1";
    const queue = planSession(s, levelContent, now).queue;
    expect(queue[0].exercise.targetId).toBe("C2-0");
    expect(
      queue.slice(1).every((q) => q.exercise.targetId.startsWith("A1")),
    ).toBe(true);
    expect(s.session).toEqual(snapshot);
    setParticipation(s, "C2-0", "archived");
    expect(
      planSession(s, levelContent, now).queue.some(
        (q) => q.exercise.targetId === "C2-0",
      ),
    ).toBe(false);
  });
  it("falls back to available lower material and still mixes unclassified personal entries", () => {
    const s = setup();
    s.settings.limitNewPerDay = false;
    s.settings.level = "C2";
    const smaller = {
      ...levelContent,
      targets: levelContent.targets.filter((t) =>
        ["A1", "A2"].includes(t.level!),
      ),
    };
    const queue = planSession(s, smaller, now).queue;
    expect(queue).toHaveLength(30);
    expect(
      queue.filter((q) => q.exercise.targetId.startsWith("A2")),
    ).toHaveLength(18);
    s.personalTargets = targets.slice(0, 4);
    s.personalExercises = s.personalTargets.flatMap(lexicalExercises);
    expect(
      planSession(s, smaller, now).queue.some((q) =>
        q.exercise.targetId.startsWith("word"),
      ),
    ).toBe(true);
    s.settings.level = "A1";
    const empty = {
      ...content,
      targets: levelContent.targets.filter((t) => t.level === "C2"),
      exercises: levelContent.exercises,
    };
    s.personalTargets = [];
    s.personalExercises = [];
    expect(planSession(s, empty, now).queue).toHaveLength(0);
  });
  it("does not cancel an existing archive allocation when only the topic level changes", () => {
    const s = setup();
    s.settings.limitNewPerDay = false;
    setTopic(s, "home", { quota: 50 });
    targets.slice(0, 10).forEach((t) => setParticipation(s, t.id, "archived"));
    s.session = planSession(s, content, now);
    const archived = s.session.queue.filter((q) => q.mode === "archive");
    expect(archived).toHaveLength(10);
    const revision = s.preferences.home.revision;
    setTopic(s, "home", { level: "A1" });
    expect(s.preferences.home.revision).toBe(revision);
    const targetMap = new Map(targets.map((t) => [t.id, t]));
    expect(
      archived.every((q) => permitted(s, q, targetMap, s.session, now)),
    ).toBe(true);
  });
  it("archives an unanswered task without creating learning evidence or using the daily budget", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    const id = s.session.queue[0].exercise.targetId;
    const before = structuredClone({
      events: s.events,
      memory: s.memory,
      preferences: s.preferences,
    });
    setParticipation(s, id, "archived");
    normalizeSession(s, content, now);
    expect(s.session.index).toBe(1);
    expect({
      events: s.events,
      memory: s.memory,
      preferences: s.preferences,
    }).toEqual(before);
    expect(s.session.quotaCommitted).toBe(false);
    expect(planSession(s, content, now).queue).toHaveLength(6);
    expect(
      planSession(s, content, now).queue.some(
        (q) => q.exercise.targetId === id,
      ),
    ).toBe(false);
  });
  it("defaults legacy levels and preserves choices and classifications through backup", async () => {
    const old = structuredClone(setup()) as any;
    delete old.settings.level;
    for (const pref of Object.values(old.preferences) as any[])
      delete pref.level;
    const upgraded = stateSchema.parse(old);
    expect(upgraded.settings.level).toBe("B1");
    expect(upgraded.preferences.home.level).toBeNull();
    upgraded.settings.level = "C1";
    setTopic(upgraded, "home", { level: "B2" });
    const restored = restoredState(
      await parseBackup(await exportBackup(upgraded, levelContent)),
      levelContent,
    );
    expect(restored.settings.level).toBe("C1");
    expect(restored.preferences.home.level).toBe("B2");
    expect(allTargets(restored, levelContent)).toEqual(levelContent.targets);
    const historic = structuredClone(levelContent.targets[0]);
    delete historic.level;
    restored.personalTargets = [historic];
    expect(
      allTargets(restored, levelContent).find((t) => t.id === historic.id)
        ?.level,
    ).toBe("A1");
    historic.de = "Persönlich veränderte Bedeutung";
    expect(
      allTargets(restored, levelContent).find((t) => t.id === historic.id)
        ?.level,
    ).toBeUndefined();
  });
  it("makes daily new-content caps optional, including older profiles", () => {
    const s = setup();
    const old = structuredClone(s) as any;
    delete old.settings.limitNewPerDay;
    const upgraded = stateSchema.parse(old);
    expect(upgraded.settings.limitNewPerDay).toBe(false);
    expect(upgraded.settings.newPerDay).toBe(6);
    expect(planSession(upgraded, content, now).queue).toHaveLength(20);
    expect(planSession(s, content, now).queue).toHaveLength(6);
  });
  it("fills spare slots from other topics without bypassing an archive quota of zero", () => {
    const s = setup();
    s.settings.limitNewPerDay = false;
    setTopic(s, "travel", { mode: "learn" });
    targets
      .filter((t) => t.ownerTopicId === "travel")
      .forEach((t) => setParticipation(s, t.id, "archived"));
    const queue = planSession(s, content, now).queue;
    expect(queue).toHaveLength(20);
    expect(
      queue.every((q) => Number(q.exercise.targetId.split("-")[1]) < 20),
    ).toBe(true);
  });
  it("starts the next batch with other targets, without immediately reversing learned words", () => {
    const s = setup();
    s.settings.limitNewPerDay = false;
    s.settings.dailyCardGoal = 30;
    setTopic(s, "travel", { mode: "learn" });
    s.session = planSession(s, content, now);
    const first = s.session.queue.map((q) => q.exercise.targetId);
    while (!s.session.finished) {
      answer(s);
      normalizeSession(s, content, now);
    }
    const second = planSession(s, content, new Date(now.getTime() + 1000));
    expect(second.queue).toHaveLength(10);
    expect(second.queue.some((q) => first.includes(q.exercise.targetId))).toBe(
      false,
    );
    const reviewed = s.events[0];
    const dueAt =
      s.memory[memoryKey(reviewed.targetId, reviewed.exercise.channel)].due;
    const due = planSession(s, content, new Date(dueAt));
    expect(
      due.queue.some(
        (q) =>
          q.exercise.targetId === reviewed.targetId &&
          q.exercise.channel === reviewed.exercise.channel,
      ),
    ).toBe(true);
    expect(
      due.queue.slice(0, 6).every((q) => first.includes(q.exercise.targetId)),
    ).toBe(true);
  });
  it("unlocks an unseen direction on the next learning day and does not bury due cards", () => {
    const s = setup();
    s.settings.limitNewPerDay = false;
    s.session = planSession(s, content, now);
    answer(s);
    const e = s.events[0];
    for (const t of targets)
      if (t.id !== e.targetId) setParticipation(s, t.id, "archived");
    s.memory[memoryKey(e.targetId, e.exercise.channel)].due =
      "2026-10-08T12:00:00Z";
    expect(planSession(s, content, now).queue).toHaveLength(0);
    const nextDay = planSession(s, content, new Date("2026-10-02T12:00:00Z"));
    expect(nextDay.queue).toHaveLength(1);
    expect(nextDay.queue[0].exercise.channel).not.toBe(e.exercise.channel);
    const siblingKey = memoryKey(e.targetId, nextDay.queue[0].exercise.channel);
    s.memory[siblingKey] = reviewCard(
      undefined,
      true,
      new Date("2026-09-01T12:00:00Z"),
    );
    // Even an already learned opposite direction waits until tomorrow.
    expect(planSession(s, content, now).queue).toHaveLength(0);
    expect(
      planSession(s, content, new Date("2026-10-02T12:00:00Z")).queue,
    ).toHaveLength(1);
  });
  it("plans up to 250 distinct targets for the daily goal, including uneven topics", () => {
    const real = JSON.parse(
      readFileSync("public/content/course.json", "utf8"),
    ) as Content;
    const s = initialState(real.topics, now);
    s.settings.dailyCardGoal = 250;
    for (const t of real.topics) setTopic(s, t.id, { mode: "learn" });
    const queue = planSession(s, real, now).queue;
    expect(queue).toHaveLength(250);
    expect(new Set(queue.map((q) => q.exercise.targetId)).size).toBe(250);
    s.settings.dailyCardGoal = 74;
    expect(planSession(s, real, now).queue).toHaveLength(74);
  });
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
  it("legacy maintain becomes active and combines due reviews with new material", () => {
    const before = setup();
    const s = stateSchema.parse({
      ...before,
      preferences: {
        ...before.preferences,
        home: { ...before.preferences.home, mode: "maintain" },
      },
    });
    expect(s.preferences.home.mode).toBe("learn");
    s.memory[memoryKey("word-0", "productive_recall")] = reviewCard(
      undefined,
      true,
      new Date("2026-09-01T12:00:00Z"),
    );
    const queue = planSession(s, content, now).queue;
    expect(queue.length).toBeGreaterThan(1);
    expect(queue[0].exercise.targetId).toBe("word-0");
    expect(queue[0].exercise.channel).toBe("productive_recall");
  });
  it("removes an archived target from a pending regular task and future plans at quota zero", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    const item = s.session.queue[0];
    setParticipation(s, item.exercise.targetId, "archived");
    expect(() => answer(s)).toThrow(/Trainingsrunde/);
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
    expect(session.queue).toHaveLength(6);
    expect(session.queue.every((q) => q.mode === "archive")).toBe(true);
  });
  it("explicit archive practice requires an active topic and leaves regular targets out", () => {
    const s = setup();
    setTopic(s, "home", { mode: "paused" });
    for (const t of targets) setParticipation(s, t.id, "archived");
    setParticipation(s, "word-0", "regular");
    expect(planSession(s, content, now, "home").queue).toHaveLength(0);
    setTopic(s, "home", { mode: "learn" });
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
  it("combined archive practice skips inactive topics and includes them after activation", () => {
    const s = setup();
    setTopic(s, "home", { mode: "paused", quota: 15 });
    setParticipation(s, "word-0", "archived");
    setParticipation(s, "word-20", "archived");
    setParticipation(s, "word-1", "regular");
    setTopic(s, "travel", { mode: "learn" });
    expect(
      planSession(s, content, now, ALL_ARCHIVE_TOPICS).queue.map(
        (q) => q.exercise.targetId,
      ),
    ).toEqual(["word-20"]);
    setTopic(s, "home", { mode: "learn" });
    const preferences = structuredClone(s.preferences);
    s.session = planSession(s, content, now, ALL_ARCHIVE_TOPICS);
    expect(
      s.session.queue.map((item) => item.exercise.targetId).sort(),
    ).toEqual(["word-0", "word-20"]);
    expect(
      s.session.queue.every((item) => item.mode === "explicit_archive"),
    ).toBe(true);
    answer(s, false);
    normalizeSession(s, content, now);
    expect(s.session.queue).toHaveLength(2);
    expect(s.preferences).toEqual(preferences);
    expect(s.participation["word-0"]).toBe("archived");
  });
  it("skips a target restored to regular practice during a combined archive round", () => {
    const s = setup();
    setParticipation(s, "word-0", "archived");
    setParticipation(s, "word-20", "archived");
    s.session = planSession(s, content, now, ALL_ARCHIVE_TOPICS);
    setParticipation(s, s.session.queue[0].exercise.targetId, "regular");
    expect(() => answer(s)).toThrow(/Trainingsrunde/);
    normalizeSession(s, content, now);
    expect(s.session.index).toBe(1);
    expect(s.events).toHaveLength(0);
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
    s.settings.dailyCardGoal = 30;
    setTopic(s, "home", { quota: 5 });
    s.session = planSession(s, content, now);
    expect(s.preferences.home.remainder).toBe(0);
    answer(s);
    expect(s.preferences.home.remainder).toBeCloseTo(0.5);
    const value = s.preferences.home.remainder;
    const event = s.events[0];
    commitReview(s, content, event.id, true, null, now);
    expect(s.preferences.home.remainder).toBe(value);
  });
  it("keeps archived related targets out of regular tasks", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    const item = structuredClone(s.session.queue[0]);
    item.exercise.relatedTargetIds = ["word-15"];
    setParticipation(s, "word-15", "archived");
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
    normalizeSession(s, content, now);
    expect(s.session.index).toBe(1);
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
      normalizeSession(s, content, now);
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
  it("advances once after saving a review, including duplicate submissions", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    const first = s.session.queue[0].attemptId;
    answer(s);
    normalizeSession(s, content, now);
    expect(s.session.index).toBe(1);
    expect(s.session.revealed).toBe(false);
    expect(s.session.feedback).toBeNull();
    commitReview(s, content, first, true, null, now);
    normalizeSession(s, content, now);
    expect(s.session.index).toBe(1);
    expect(s.events).toHaveLength(1);
    expect(Object.keys(s.memory)).toHaveLength(1);
  });
  it("finishes on the last answer without confirmation and can undo it", () => {
    const s = setup();
    s.session = planSession(s, content, now);
    s.session.queue = s.session.queue.slice(0, 1);
    answer(s, false);
    normalizeSession(s, content, now);
    expect(s.session.finished).toBe(true);
    expect(s.session.index).toBe(1);
    undoReview(s, now);
    normalizeSession(s, content, now);
    expect(s.session.finished).toBe(false);
    expect(s.session.index).toBe(0);
    expect(s.session.revealed).toBe(true);
    expect(s.memory).toEqual({});
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
  it("round trips a combined archive session", async () => {
    const original = setup();
    setTopic(original, "travel", { mode: "learn" });
    setParticipation(original, "word-0", "archived");
    setParticipation(original, "word-20", "archived");
    original.session = planSession(original, content, now, ALL_ARCHIVE_TOPICS);
    answer(original);
    normalizeSession(original, content, now);
    const restored = restoredState(
      await parseBackup(await exportBackup(original, content)),
      content,
    );
    expect(restored.session).toEqual(original.session);
    expect(restored.session!.archiveTopic).toBe(ALL_ARCHIVE_TOPICS);
    answer(restored);
    normalizeSession(restored, content, now);
    expect(restored.session!.finished).toBe(true);
  });
  it("resumes an old confirmation screen without rescheduling the saved answer", async () => {
    const original = setup();
    original.session = planSession(original, content, now);
    answer(original);
    const restored = restoredState(
      await parseBackup(await exportBackup(original, content)),
      content,
    );
    normalizeSession(restored, content, now);
    normalizeSession(restored, content, now);
    expect(restored.session!.index).toBe(1);
    expect(restored.session!.feedback).toBeNull();
    expect(restored.events).toEqual(original.events);
    expect(restored.memory).toEqual(original.memory);
  });
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
  it("imports legacy exclusions into archive, preserving evidence and applying the archive quota", async () => {
    const original = setup();
    original.session = planSession(original, content, now);
    answer(original);
    normalizeSession(original, content, now);
    const reviewedId = original.events[0].targetId;
    const pendingId =
      original.session.queue[original.session.index].exercise.targetId;
    const legacy = JSON.parse(JSON.stringify(original));
    legacy.participation[reviewedId] = "excluded";
    legacy.participation[pendingId] = "excluded";
    const restored = restoredState(
      await parseBackup(await exportBackup(legacy, content)),
      content,
    );
    expect(restored.participation[reviewedId]).toBe("archived");
    expect(restored.participation[pendingId]).toBe("archived");
    expect(restored.events).toEqual(original.events);
    expect(restored.memory).toEqual(original.memory);
    expect(restored.preferences).toEqual(original.preferences);
    expect(
      planSession(restored, content, now).queue.some((q) =>
        [reviewedId, pendingId].includes(q.exercise.targetId),
      ),
    ).toBe(false);
    normalizeSession(restored, content, now);
    expect(restored.session!.index).toBe(original.session.index + 1);
    setTopic(restored, "home", { quota: 50 });
    expect(
      planSession(restored, content, now).queue.some(
        (q) => q.mode === "archive" && q.exercise.targetId === pendingId,
      ),
    ).toBe(true);
    expect(planSession(restored, content, now, "home").queue).toHaveLength(2);
    const exported = JSON.parse(await exportBackup(restored, content));
    expect(Object.values(exported.payload.state.participation)).toEqual([
      "archived",
      "archived",
    ]);
  });
  it("rejects corrupt payloads without changing the input state", async () => {
    const s = setup(),
      before = structuredClone(s),
      raw = JSON.parse(await exportBackup(s, content));
    raw.payload.state.settings.dailyCardGoal = 80;
    await expect(parseBackup(JSON.stringify(raw))).rejects.toThrow(/Prüfsumme/);
    expect(s).toEqual(before);
  });
  it("rejects unknown schema versions and foreign formats", async () => {
    await expect(parseBackup('{"format":"other"}')).rejects.toThrow(
      /Lernstand-Sicherung/,
    );
    await expect(
      parseBackup('{"format":"wortnah-backup","schemaVersion":2}'),
    ).rejects.toThrow(/Version/);
  });
  it("rejects dangling content references", () => {
    const s = setup();
    s.participation.unknown = "archived";
    expect(() => validateRelations({ state: s, content })).toThrow(
      /fehlende Inhalte/,
    );
  });
  it("rejects malformed JSON", async () => {
    await expect(parseBackup("{")).rejects.toThrow(/JSON/);
  });
  it("validates the shipped corpus including 54 distinct grammar goals", async () => {
    const real = JSON.parse(
      readFileSync("public/content/course.json", "utf8"),
    ) as Content;
    const state = initialState(real.topics, now);
    const payload = await parseBackup(await exportBackup(state, real));
    expect(
      payload.content.targets.filter((t) => t.kind === "grammar"),
    ).toHaveLength(54);
    expect(
      payload.content.exercises.filter((e) => e.mode === "choice"),
    ).toHaveLength(270);
    for (const e of payload.content.exercises.filter((e) =>
      e.channel.startsWith("grammar_"),
    )) {
      expect(e.translation?.length).toBeGreaterThan(15);
      expect(e.hint?.length).toBeGreaterThan(5);
    }
    const guests = payload.content.exercises.find(
      (e) => e.id === "grammar-past-perfect:5:recall",
    )!;
    expect(guests.translation).toBe(
      "Die Gäste waren angekommen, bevor der Sturm begann.",
    );
    expect(guests.hint).toBe("Grundform: arrive");
  });
  it("adds German cues to matching legacy snapshots without overwriting edited questions", async () => {
    const real = JSON.parse(
      readFileSync("public/content/course.json", "utf8"),
    ) as Content;
    const current = real.exercises.find(
      (e) => e.id === "grammar-past-perfect:5:recall",
    )!;
    const old = structuredClone(current);
    delete old.translation;
    delete old.hint;
    expect(withExerciseCues(old, real).translation).toBe(current.translation);
    expect(old.translation).toBeUndefined();
    expect(
      withExerciseCues({ ...old, answer: "left" }, real).translation,
    ).toBeUndefined();
    const s = initialState(real.topics, now);
    s.settings.dailyCardGoal = 240;
    s.personalExercises = [old];
    const restored = restoredState(
      await parseBackup(await exportBackup(s, real)),
      real,
    );
    expect(restored.settings.dailyCardGoal).toBe(240);
    expect(restored.settings.limitNewPerDay).toBe(false);
    expect(
      restored.personalExercises.find((e) => e.id === old.id)?.translation,
    ).toBe(current.translation);
  });
});
