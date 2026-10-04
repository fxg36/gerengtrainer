import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addEverydayContent } from "../scripts/everyday-content.mjs";
import {
  allTargets,
  initialState,
  lexicalExercises,
  targetInSubtopic,
  type Content,
} from "../src/domain";
import { planSession, setParticipation, setTopic } from "../src/engine";

const course = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
) as Content;
const now = new Date("2026-10-02T12:00:00Z");

describe("Everyday situation expansion", () => {
  it("reuses an existing sense and preserves its source, level, exercise IDs and personal edits", () => {
    const original = {
      ...course.targets.find((t) => t.word === "reservation")!,
      example: "Previous example",
      senseContext: { de: "Previous German cue", en: "Previous English cue" },
      level: "C1" as const,
      dimensions: { Themen: ["travel"], Unterthemen: ["travel.stay"] },
    };
    delete original.previousSupport;
    const targets = [structuredClone(original)];
    const exercises = lexicalExercises(original);
    const before = structuredClone(exercises);
    const topics = structuredClone(course.topics);
    addEverydayContent(topics, targets, exercises);
    const enriched = targets.find((t) => t.id === original.id)!;
    expect(
      targets.filter((t) => t.word === original.word && t.de === original.de),
    ).toHaveLength(1);
    expect(enriched.source).toEqual(original.source);
    expect(enriched.level).toBe("C1");
    expect(enriched.previousSupport).toEqual({
      context: original.senseContext,
      example: original.example,
    });
    expect(targetInSubtopic(enriched, "travel.stay")).toBe(true);
    expect(targetInSubtopic(enriched, "travel.hotel")).toBe(true);
    for (const e of before) {
      const current = exercises.find((n) => n.id === e.id)!;
      expect([
        current.targetId,
        current.channel,
        current.prompt,
        current.answer,
      ]).toEqual([e.targetId, e.channel, e.prompt, e.answer]);
    }
    const content = { ...course, targets, exercises, topics };
    const state = initialState(topics, now);
    state.personalTargets = [original];
    expect(
      allTargets(state, content).find((t) => t.id === original.id)?.example,
    ).toBe(enriched.example);
    state.personalTargets = [
      {
        ...original,
        classification: "user",
        example: "My own example",
        senseContext: { de: "Mein Hinweis", en: "My cue" },
      },
    ];
    const personal = allTargets(state, content).find(
      (t) => t.id === original.id,
    )!;
    expect(personal.example).toBe("My own example");
    expect(personal.senseContext).toEqual({ de: "Mein Hinweis", en: "My cue" });
    expect(personal.dimensions).toEqual(original.dimensions);
  });

  it("makes the new hotel material available at the topic's level and honours archive and activation settings", () => {
    const state = initialState(course.topics, now);
    state.settings.dailyCardGoal = 240;
    const checkIn = course.targets.find((t) => t.word === "check in")!;
    setTopic(state, "travel", { mode: "learn", level: "A1" });
    expect(
      planSession(
        state,
        course,
        now,
        null,
        "travel",
        "travel.hotel",
      ).queue.some((q) => q.exercise.targetId === checkIn.id),
    ).toBe(false);
    setTopic(state, "travel", { level: "A2" });
    const queue = planSession(
      state,
      course,
      now,
      null,
      "travel",
      "travel.hotel",
    ).queue;
    expect(queue.some((q) => q.exercise.targetId === checkIn.id)).toBe(true);
    expect(
      queue.every((q) =>
        targetInSubtopic(
          course.targets.find((t) => t.id === q.exercise.targetId)!,
          "travel.hotel",
        ),
      ),
    ).toBe(true);
    expect(new Set(queue.map((q) => q.exercise.targetId)).size).toBe(
      queue.length,
    );
    setParticipation(state, checkIn.id, "archived");
    expect(
      planSession(
        state,
        course,
        now,
        null,
        "travel",
        "travel.hotel",
      ).queue.some((q) => q.exercise.targetId === checkIn.id),
    ).toBe(false);
    setTopic(state, "travel", { mode: "paused" });
    expect(
      planSession(state, course, now, null, "travel", "travel.hotel").queue,
    ).toHaveLength(0);
    expect(state.events).toHaveLength(0);
  });
});
