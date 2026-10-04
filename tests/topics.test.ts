import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allTargets,
  initialState,
  memoryKey,
  targetInTopic,
  targetInSubtopic,
  type Content,
} from "../src/domain";
import {
  commitReview,
  findSession,
  openSession,
  planSession,
  setParticipation,
  setTopic,
} from "../src/engine";
import { buildAnalytics } from "../src/analytics";
import {
  exportBackup,
  parseBackup,
  restoredState,
  validateRelations,
} from "../src/backup";

const course = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
) as Content;
const now = new Date("2026-10-01T12:00:00Z");
const stateFor = () => {
  const state = initialState(course.topics, now);
  state.settings.level = "C1";
  state.settings.dailyCardGoal = 240;
  for (const topic of course.topics)
    setTopic(state, topic.id, { mode: "learn" });
  return state;
};

describe("Expanded themes and shared meanings", () => {
  it("offers populated sections and a range of levels, words and phrases in every new theme", () => {
    const expansion = JSON.parse(
      readFileSync("content/topic-expansion.json", "utf8"),
    );
    expect(expansion).toHaveLength(11);
    expect(course.topics).toHaveLength(25);
    for (const entry of expansion) {
      const topic = course.topics.find((t) => t.id === entry.id)!;
      const targets = course.targets.filter((t) => targetInTopic(t, topic.id));
      expect(targets.length).toBeGreaterThanOrEqual(30);
      expect(new Set(targets.map((t) => t.level)).size).toBeGreaterThanOrEqual(
        3,
      );
      expect(targets.some((t) => t.pos === "verb" || t.pos === "phrase")).toBe(
        true,
      );
      for (const sub of topic.subtopics!) {
        expect(
          targets.filter((t) => targetInSubtopic(t, sub.id)).length,
        ).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("keeps different meanings of draw and court separate and reuses the same meaning across topics", () => {
    for (const [word, a, b] of [
      ["draw", "sport", "leisure"],
      ["court", "sport", "civic"],
      ["strength", "sport", "work"],
    ]) {
      const first = course.targets.find(
        (t) => t.word === word && targetInTopic(t, a),
      )!;
      const second = course.targets.find(
        (t) => t.word === word && targetInTopic(t, b),
      )!;
      expect(first.id).not.toBe(second.id);
      expect(first.senseContext?.en).not.toBe(second.senseContext?.en);
    }
    for (const [word, a, b] of [
      ["deadline", "work", "education"],
      ["contract", "work", "shopping"],
      ["subscription", "money", "shopping"],
    ]) {
      const shared = course.targets.filter((t) => t.word === word);
      expect(shared).toHaveLength(1);
      expect(targetInTopic(shared[0], a)).toBe(true);
      expect(targetInTopic(shared[0], b)).toBe(true);
    }
  });

  it("trains only a chosen section, preserves its round and exports its scope", async () => {
    const state = stateFor();
    openSession(state, course, now, null, "education", "education.university");
    const round = structuredClone(state.session!);
    expect(round.queue.length).toBeGreaterThanOrEqual(10);
    for (const item of round.queue) {
      const target = course.targets.find(
        (t) => t.id === item.exercise.targetId,
      )!;
      expect(targetInSubtopic(target, "education.university")).toBe(true);
      expect(item.topicId).toBe("education");
    }
    openSession(state, course, now, null, "education", "education.school");
    expect(
      findSession(state, null, "education", "education.university"),
    ).toEqual(round);
    const backup = await parseBackup(await exportBackup(state, course, now));
    const restored = restoredState(backup, course);
    openSession(
      restored,
      course,
      now,
      null,
      "education",
      "education.university",
    );
    expect(restored.session).toEqual(round);
    expect(state.preferences.education.mode).toBe("learn");
    const bad = structuredClone(backup);
    bad.state.savedSessions = [];
    bad.state.session!.subtopicId = "education.university";
    expect(() => validateRelations(bad)).toThrow(/Unterthema/);
    expect(() =>
      planSession(state, course, now, null, "education", "work.career"),
    ).toThrow(/Unterthema/);
  });

  it("shares review memory and archive decisions across topics without counting answers twice", () => {
    const state = stateFor();
    const target = course.targets.find((t) => t.word === "deadline")!;
    const small = {
      ...course,
      targets: [target],
      exercises: course.exercises.filter((e) => e.targetId === target.id),
    };
    openSession(state, small, now, null, "education", "education.study");
    const item = state.session!.queue[0];
    state.session!.revealed = true;
    commitReview(state, small, item.attemptId, true, null, now);
    expect(
      state.memory[memoryKey(target.id, item.exercise.channel)],
    ).toBeDefined();
    expect(planSession(state, small, now, null, "work").queue).toHaveLength(0);
    const analytics = buildAnalytics(state, small, now);
    expect(analytics.summary.seen).toBe(1);
    expect(analytics.stats.attempts).toBe(1);
    for (const topic of ["education", "work"])
      expect(analytics.topics.find((t) => t.topic.id === topic)!.seen).toBe(1);
    setParticipation(state, target.id, "archived");
    expect(planSession(state, small, now, null, "work").queue).toHaveLength(0);
    expect(planSession(state, small, now, "education").queue).toHaveLength(1);
    expect(planSession(state, small, now, "work").queue).toHaveLength(1);
    expect(state.events).toHaveLength(1);
  });

  it("never duplicates shared meanings in a mixed batch and uses the selecting topic's policies", () => {
    const state = stateFor();
    for (const topic of course.topics)
      setTopic(state, topic.id, { mode: "learn" });
    const round = planSession(state, course, now);
    expect(round.queue).toHaveLength(240);
    expect(new Set(round.queue.map((q) => q.exercise.targetId)).size).toBe(
      round.queue.length,
    );
    const deadline = course.targets.find((t) => t.word === "deadline")!;
    setParticipation(state, deadline.id, "archived");
    setTopic(state, "work", { mode: "paused", quota: 0 });
    setTopic(state, "education", { quota: 50 });
    const focused = planSession(state, course, now, null, "education");
    expect(
      focused.queue.find((q) => q.exercise.targetId === deadline.id)?.mode,
    ).toBe("archive");
  });

  it("enriches old bundled snapshots with new sections but respects a user's own assignments", () => {
    const target = course.targets.find((t) => t.word === "deadline")!;
    const state = stateFor();
    state.personalTargets = [{ ...target, dimensions: { Themen: ["work"] } }];
    const enriched = allTargets(state, course).find((t) => t.id === target.id)!;
    expect(targetInSubtopic(enriched, "education.study")).toBe(true);
    state.personalTargets[0].classification = "user";
    expect(
      allTargets(state, course).find((t) => t.id === target.id)!.dimensions,
    ).toEqual({ Themen: ["work"] });
  });
});
