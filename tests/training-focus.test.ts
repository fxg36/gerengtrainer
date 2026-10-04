import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  initialState,
  lexicalExercises,
  memoryKey,
  type AppState,
  type Channel,
  type Content,
  type ReviewEvent,
} from "../src/domain";
import { openSession, planSession, reviewCard, setTopic } from "../src/engine";
import {
  mixedTopicBudgets,
  spreadPractice,
  topicBudgets,
  trainingFocus,
} from "../src/training-focus";

const now = new Date("2026-10-02T12:00:00Z");
const course = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
) as Content;
const targets = (["lexical", "grammar"] as const).flatMap((kind) =>
  (["B1", "C2"] as const).flatMap((level) =>
    Array.from({ length: 100 }, (_, i) => ({
      ...course.targets.find((target) => target.kind === kind)!,
      id: `${kind}-${level}-${i}`,
      kind,
      level,
      ownerTopicId: kind === "grammar" ? "grammar" : "home",
      dimensions: { Themen: [kind === "grammar" ? "grammar" : "home"] },
    })),
  ),
);
const content: Content = {
  ...course,
  topics: course.topics.filter((topic) =>
    ["home", "grammar"].includes(topic.id),
  ),
  targets,
  exercises: targets.flatMap((target) =>
    lexicalExercises(target).map((exercise) => ({
      ...exercise,
      channel:
        target.kind === "lexical"
          ? exercise.channel
          : exercise.channel === "productive_recall"
            ? ("grammar_production" as const)
            : ("grammar_recognition" as const),
    })),
  ),
};
function setup() {
  const state = initialState(content.topics, now);
  state.settings.dailyCardGoal = 40;
  state.settings.level = "C2";
  state.settings.limitNewPerDay = false;
  setTopic(state, "home", { mode: "learn" });
  return state;
}
function history(
  state: AppState,
  channel: Channel,
  count: number,
  good: number,
  age = 1,
) {
  const available = content.exercises.filter(
    (exercise) => exercise.channel === channel,
  );
  const at = new Date(now.getTime() - age * 86_400_000).toISOString();
  return Array.from({ length: count }, (_, index): ReviewEvent => {
    const exercise = available[index];
    const event: ReviewEvent = {
      id: `event-${state.events.length}`,
      deviceId: state.deviceId,
      sessionId: "sample-session",
      targetId: exercise.targetId,
      exercise,
      index,
      at,
      day: at.slice(0, 10),
      good: index < good,
      choice: null,
      mode: "regular",
      retry: false,
      revokedAt: null,
      engine: "ts-fsrs-5.4.2-retention-0.9",
    };
    state.events.push(event);
    return event;
  });
}

describe("Bounded performance weights", () => {
  it("waits for evidence and uses the documented thresholds independently for all four directions", () => {
    const state = setup();
    history(state, "productive_recall", 20, 9);
    history(state, "receptive_recall", 20, 10);
    history(state, "grammar_production", 20, 14);
    history(state, "grammar_recognition", 20, 17);
    const result = trainingFocus(state.events, now);
    expect(Object.values(result).map((value) => value.weight)).toEqual([
      2, 1.5, 1.25, 1,
    ]);
    expect(
      trainingFocus(state.events.slice(0, 9), now).productive_recall.weight,
    ).toBe(1);
    expect(trainingFocus([], now).grammar_production.accuracy).toBeNull();
  });
  it("ignores undo, retries, archive practice, future and old records, and repeated same-day attempts", () => {
    const state = setup();
    const first = history(state, "productive_recall", 10, 0);
    for (const event of first) {
      state.events.push({
        ...event,
        id: `${event.id}-same-day`,
        good: true,
        at: event.at.replace("12:00", "13:00"),
      });
      state.events.push({
        ...event,
        id: `${event.id}-retry`,
        good: true,
        retry: true,
      });
    }
    history(state, "receptive_recall", 10, 0).forEach(
      (e) => (e.mode = "archive"),
    );
    history(state, "grammar_recognition", 10, 0).forEach(
      (e) => (e.mode = "explicit_archive"),
    );
    history(state, "grammar_production", 10, 0).forEach(
      (e) => (e.revokedAt = now.toISOString()),
    );
    history(state, "grammar_production", 10, 0, 31);
    history(state, "grammar_production", 10, 0, -1);
    const before = structuredClone(state);
    const focus = trainingFocus(state.events, now);
    expect(focus.productive_recall).toEqual({
      count: 10,
      accuracy: 0,
      weight: 2,
    });
    for (const channel of [
      "receptive_recall",
      "grammar_recognition",
      "grammar_production",
    ] as const)
      expect(focus[channel]).toEqual({ count: 0, accuracy: null, weight: 1 });
    expect(state).toEqual(before);
  });
  it("lets recent successes replace older weaknesses and returns to neutral when evidence expires", () => {
    const state = setup();
    history(state, "productive_recall", 40, 0, 5);
    history(state, "productive_recall", 40, 40);
    expect(
      trainingFocus(state.events.reverse(), now).productive_recall,
    ).toEqual({ count: 40, accuracy: 1, weight: 1 });
    expect(
      trainingFocus(state.events, new Date("2026-12-01T12:00:00Z"))
        .productive_recall.count,
    ).toBe(0);
  });
  it("allocates an exact integer budget and preserves the previous split with no evidence", () => {
    expect(topicBudgets(40, [1, 1, 1])).toEqual([14, 13, 13]);
    expect(topicBudgets(40, [1, 2])).toEqual([13, 27]);
    expect(topicBudgets(6, [])).toEqual([]);
  });
});

describe("Performance-weighted planning", () => {
  it("starts at 80/20 regardless of the number of active vocabulary topics and spreads grammar through the round", () => {
    const neutral = trainingFocus([], now);
    for (const words of [1, 3, 24]) {
      const ids = [
        ...Array.from({ length: words }, (_, i) => `word-${i}`),
        "grammar",
      ];
      const budgets = mixedTopicBudgets(50, ids, neutral);
      expect(budgets.at(-1)).toBe(10);
      expect(budgets.reduce((a, b) => a + b, 0)).toBe(50);
    }
    const state = setup();
    setTopic(state, "grammar", { mode: "learn" });
    const queue = planSession(state, content, now).queue;
    expect(queue).toHaveLength(40);
    expect(queue.filter((q) => q.topicId === "grammar")).toHaveLength(8);
    for (let i = 0; i < 40; i += 5)
      expect(
        queue.slice(i, i + 5).filter((q) => q.topicId === "grammar"),
      ).toHaveLength(1);
    expect(spreadPractice([], [1, 2])).toEqual([1, 2]);
    expect(spreadPractice([1, 2], [])).toEqual([1, 2]);
    expect(spreadPractice([], [])).toEqual([]);
  });
  it("reduces securely recalled grammar only with enough evidence in both directions", () => {
    const state = setup();
    setTopic(state, "grammar", { mode: "learn" });
    history(state, "grammar_production", 20, 20);
    expect(
      planSession(state, content, now).queue.filter(
        (q) => q.topicId === "grammar",
      ),
    ).toHaveLength(8);
    history(state, "grammar_recognition", 20, 20);
    expect(
      planSession(state, content, now).queue.filter(
        (q) => q.topicId === "grammar",
      ),
    ).toHaveLength(6);
    state.settings.mode = "grammar";
    expect(
      planSession(state, content, now).queue.every(
        (q) => q.topicId === "grammar",
      ),
    ).toBe(true);
  });
  it("refills an empty vocabulary topic from other vocabulary before changing the 80/20 mix", () => {
    const expanded = {
      ...content,
      topics: [...content.topics, { ...content.topics[0], id: "empty" }],
    };
    const state = initialState(expanded.topics, now);
    state.settings.dailyCardGoal = 50;
    expanded.topics.forEach((t) => setTopic(state, t.id, { mode: "learn" }));
    const queue = planSession(state, expanded, now).queue;
    expect(queue).toHaveLength(50);
    expect(queue.filter((q) => q.topicId === "grammar")).toHaveLength(10);
    const withoutGrammar = {
      ...expanded,
      targets: expanded.targets.filter((t) => t.kind !== "grammar"),
      exercises: expanded.exercises.filter(
        (e) => !e.channel.startsWith("grammar"),
      ),
    };
    const fallback = planSession(state, withoutGrammar, now).queue;
    expect(fallback).toHaveLength(50);
    expect(fallback.every((q) => q.topicId === "home")).toBe(true);
  });
  it.each([
    "productive_recall",
    "receptive_recall",
    "grammar_production",
    "grammar_recognition",
  ] as const)(
    "gives weak %s more practice while retaining 60/40 and unique meanings",
    (channel) => {
      const state = setup();
      history(state, channel, 20, 0);
      const topic = channel.startsWith("grammar") ? "grammar" : "home";
      setTopic(state, topic, { mode: "learn" });
      let preferred = 0,
        total = 0;
      for (let run = 0; run < 16; run++) {
        const queue = planSession(
          state,
          content,
          new Date(now.getTime() + run * 60_000),
          null,
          topic,
        ).queue;
        expect(queue).toHaveLength(40);
        expect(new Set(queue.map((item) => item.exercise.targetId)).size).toBe(
          40,
        );
        expect(
          queue.filter((item) => item.exercise.targetId.includes("C2")),
        ).toHaveLength(24);
        preferred += queue.filter(
          (item) => item.exercise.channel === channel,
        ).length;
        total += queue.length;
      }
      expect(preferred / total).toBeGreaterThan(0.59);
      expect(preferred / total).toBeLessThan(0.75);
    },
  );
  it("gives weaker grammar more slots without activating paused topics or overriding the user's training mode", () => {
    const state = setup();
    setTopic(state, "grammar", { mode: "learn" });
    history(state, "grammar_production", 20, 0);
    history(state, "grammar_recognition", 20, 0);
    expect(
      planSession(state, content, now).queue.filter(
        (q) => q.topicId === "grammar",
      ),
    ).toHaveLength(13);
    state.settings.mode = "words";
    expect(
      planSession(state, content, now).queue.every((q) => q.topicId === "home"),
    ).toBe(true);
    state.settings.mode = "mixed";
    setTopic(state, "grammar", { mode: "paused" });
    expect(
      planSession(state, content, now).queue.every((q) => q.topicId === "home"),
    ).toBe(true);
  });
  it("weights due directions but never pulls future cards forward or bypasses zero archive quota", () => {
    const state = setup();
    history(state, "productive_recall", 20, 0);
    const card = {
      ...reviewCard(undefined, true, new Date("2026-09-15T12:00:00Z")),
      state: 2,
      stability: 10,
      due: "2026-10-01T12:00:00Z",
    };
    const due = targets
      .filter((target) => target.kind === "lexical" && target.level === "C2")
      .slice(0, 6);
    due.forEach((target, index) => {
      state.memory[
        memoryKey(
          target.id,
          index < 3 ? "productive_recall" : "receptive_recall",
        )
      ] = { ...card };
    });
    const future = targets.find((target) => target.id === "lexical-C2-98")!;
    const archived = targets.find((target) => target.id === "lexical-C2-99")!;
    for (const channel of ["productive_recall", "receptive_recall"] as const) {
      state.memory[memoryKey(future.id, channel)] = {
        ...card,
        due: "2026-11-01T12:00:00Z",
      };
      state.memory[memoryKey(archived.id, channel)] = { ...card };
    }
    state.participation[archived.id] = "archived";
    const before = structuredClone(state);
    const queue = planSession(state, content, now).queue;
    expect(
      queue
        .slice(0, 3)
        .every((q) => q.exercise.channel === "productive_recall"),
    ).toBe(true);
    expect(
      queue
        .slice(0, 6)
        .every(
          (q) =>
            state.memory[memoryKey(q.exercise.targetId, q.exercise.channel)],
        ),
    ).toBe(true);
    expect(
      queue.some((q) => [future.id, archived.id].includes(q.exercise.targetId)),
    ).toBe(false);
    expect(state).toEqual(before);
  });
  it("resumes a saved round unchanged when newer results change the focus", () => {
    const state = setup();
    openSession(state, content, now);
    const session = structuredClone(state.session);
    history(state, "productive_recall", 20, 0);
    openSession(state, content, new Date(now.getTime() + 60_000));
    expect(state.session).toEqual(session);
  });
});
