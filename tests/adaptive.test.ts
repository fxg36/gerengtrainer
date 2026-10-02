import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  initialState,
  learningLevels,
  lexicalExercises,
  memoryKey,
  type Content,
  type Target,
} from "../src/domain";
import {
  planSession,
  reviewCard,
  setParticipation,
  setTopic,
} from "../src/engine";
import { mixFreshByLevel } from "../src/levels";

const now = new Date("2026-10-01T12:00:00Z");
const course = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
) as Content;
const targets: Target[] = learningLevels.flatMap((level) =>
  Array.from({ length: 80 }, (_, i) => ({
    ...course.targets.find((t) => t.kind === "lexical")!,
    id: `${level}-${i}`,
    level,
    ownerTopicId: "home",
    dimensions: { Themen: ["home"] },
  })),
);
const fixture: Content = {
  ...course,
  topics: course.topics.filter((t) => t.id === "home"),
  targets,
  exercises: targets.flatMap(lexicalExercises),
};
function setup() {
  const s = initialState(fixture.topics, now);
  s.settings.level = "C2";
  s.settings.minutes = 20;
  s.settings.limitNewPerDay = false;
  setTopic(s, "home", { mode: "learn" });
  return s;
}

describe("Adaptive focus and advanced content", () => {
  it("keeps 60/40 across starting phases, distributes lower stages and never duplicates a meaning", () => {
    for (const phase of [0, 0.21, 0.41, 0.61, 0.81, 0.999]) {
      const mixed = mixFreshByLevel(
        [...targets, ...targets],
        (t) => t,
        "C2",
        () => phase,
      ).slice(0, 40);
      expect(mixed.filter((t) => t.level === "C2")).toHaveLength(24);
      expect(mixed.filter((t) => t.level !== "C2")).toHaveLength(16);
      expect(new Set(mixed.map((t) => t.id)).size).toBe(40);
      for (const lower of learningLevels.slice(0, -1))
        expect(mixed.some((t) => t.level === lower)).toBe(true);
    }
  });

  it("fills with available focus material instead of bringing secure lower cards back before they are due", () => {
    const s = setup();
    for (const t of targets.filter((t) => t.level !== "C2"))
      for (const channel of ["productive_recall", "receptive_recall"] as const)
        s.memory[memoryKey(t.id, channel)] = {
          ...reviewCard(undefined, true, now),
          state: 2,
          stability: 60,
          reps: 8,
          due: "2026-11-01T12:00:00Z",
        };
    const before = structuredClone(s);
    const queue = planSession(s, fixture, now).queue;
    expect(queue).toHaveLength(40);
    expect(queue.every((q) => q.exercise.targetId.startsWith("C2-"))).toBe(
      true,
    );
    expect(s).toEqual(before);
  });

  it("prioritises forgetting risk among due cards, while due cards still precede new material", () => {
    const s = setup();
    const card = reviewCard(undefined, true, now);
    s.memory[memoryKey("A1-0", "productive_recall")] = {
      ...card,
      state: 2,
      stability: 90,
      reps: 12,
      last_review: "2026-06-01T12:00:00Z",
      due: "2026-09-01T12:00:00Z",
    };
    s.memory[memoryKey("A2-0", "productive_recall")] = {
      ...card,
      state: 2,
      stability: 2,
      reps: 3,
      last_review: "2026-09-21T12:00:00Z",
      due: "2026-09-30T12:00:00Z",
    };
    const queue = planSession(s, fixture, now).queue;
    expect(queue.slice(0, 2).map((q) => q.exercise.targetId)).toEqual([
      "A2-0",
      "A1-0",
    ]);
    expect(
      queue
        .slice(2)
        .every(
          (q) => !s.memory[memoryKey(q.exercise.targetId, q.exercise.channel)],
        ),
    ).toBe(true);
  });

  it("never uses archived lower words to fill the 40% share at archive quota zero", () => {
    const s = setup();
    targets
      .filter((t) => t.level !== "C2")
      .forEach((t) => setParticipation(s, t.id, "archived"));
    s.memory[memoryKey("A1-0", "productive_recall")] = reviewCard(
      undefined,
      false,
      new Date("2026-09-01T12:00:00Z"),
    );
    expect(
      planSession(s, fixture, now).queue.every((q) =>
        q.exercise.targetId.startsWith("C2-"),
      ),
    ).toBe(true);
    setTopic(s, "home", { quota: 20 });
    const queue = planSession(s, fixture, now).queue;
    expect(queue.filter((q) => q.mode === "archive")).toHaveLength(8);
    expect(
      queue
        .filter((q) => q.mode === "regular")
        .every((q) => q.exercise.targetId.startsWith("C2-")),
    ).toBe(true);
    expect(s.events).toHaveLength(0);
  });

  it("lengthens successful review intervals and brings a failed item back sooner", () => {
    let at = now;
    let card = reviewCard(undefined, true, at);
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      at = new Date(card.due);
      card = reviewCard(card, true, at);
      intervals.push(Date.parse(card.due) - at.getTime());
    }
    expect(
      intervals.every((interval, i) => i === 0 || interval > intervals[i - 1]),
    ).toBe(true);
    at = new Date(card.due);
    expect(Date.parse(reviewCard(card, false, at).due)).toBeLessThan(
      Date.parse(reviewCard(card, true, at).due),
    );
  });

  it("ships usable C2 goals in every topic, bilingual lexical examples and advanced grammar at C1/C2", () => {
    const s = initialState(course.topics, now);
    s.settings.level = "C2";
    s.settings.minutes = 20;
    s.settings.limitNewPerDay = false;
    for (const topic of course.topics) {
      setTopic(s, topic.id, { mode: "learn" });
      const high = course.targets.filter(
        (t) => t.ownerTopicId === topic.id && t.level === "C2",
      );
      expect(high.length, topic.id).toBeGreaterThanOrEqual(4);
      const queue = planSession(s, course, now, null, topic.id).queue;
      expect(
        queue.some((q) => high.some((t) => t.id === q.exercise.targetId)),
        topic.id,
      ).toBe(true);
      for (const t of high.filter((t) => t.kind === "lexical")) {
        expect(t.example.split("\n")).toHaveLength(2);
        expect(
          course.exercises.filter((e) => e.targetId === t.id),
        ).toHaveLength(2);
        // Examples and translations are only in the answer explanation.
        for (const e of course.exercises.filter((e) => e.targetId === t.id)) {
          expect(e.meaningCue).toBeTruthy();
          expect(e.explanation).toContain(t.example);
        }
      }
    }
    for (const level of ["C1", "C2"])
      expect(
        course.targets.filter((t) => t.kind === "grammar" && t.level === level),
      ).toHaveLength(6);
  });
});
