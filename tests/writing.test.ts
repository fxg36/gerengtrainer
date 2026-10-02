import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allTargets,
  initialState,
  memoryKey,
  withExerciseCues,
  type Content,
} from "../src/domain";
import {
  commitReview,
  normalizeSession,
  planSession,
  setTopic,
  undoReview,
} from "../src/engine";
import {
  exportBackup,
  parseBackup,
  restoredState,
  validateRelations,
} from "../src/backup";
import { matchesModelAnswer } from "../src/writing";

const course = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
) as Content;
const now = new Date("2026-10-02T12:00:00Z");
const writing = course.exercises.find(
  (e) => e.id === "grammar-context-causative:1:recall",
)!;
function setup() {
  const s = initialState(course.topics, now);
  s.settings.level = "B2";
  s.settings.minutes = 20;
  setTopic(s, "grammar", { mode: "learn" });
  s.session = planSession(s, course, now, null, "grammar");
  s.session.queue[0].exercise = writing;
  return s;
}

describe("Text production and learning context", () => {
  it("rejects writing metadata attached to an incompatible task", () => {
    const s = setup();
    s.session!.queue[0].exercise = {
      ...writing,
      writing: { ...writing.writing!, kind: "complete" },
    };
    expect(() => validateRelations({ state: s, content: course })).toThrow(
      /Schreibaufgabe/,
    );
  });
  it("only equates formatting changes or explicit alternatives, never the opposite meaning", () => {
    const exercise = course.exercises.find(
      (e) => e.id === "grammar-context-modality:1:recall",
    )!;
    expect(
      matchesModelAnswer(
        "  YOU  DO NOT HAVE TO bring your own laptop! ",
        exercise,
      ),
    ).toBe(true);
    expect(
      matchesModelAnswer("You don’t have to bring your own laptop.", exercise),
    ).toBe(true);
    expect(
      matchesModelAnswer("You must not bring your own laptop.", exercise),
    ).toBe(false);
    expect(
      matchesModelAnswer("You have to bring your own laptop.", exercise),
    ).toBe(false);
    expect(matchesModelAnswer("", exercise)).toBe(false);
  });

  it("starts writing-enabled grammar goals through production while keeping lower practice and 60/40", () => {
    const s = setup();
    const queue = planSession(s, course, now, null, "grammar").queue;
    const writingTargets = new Set(
      course.exercises.filter((e) => e.writing).map((e) => e.targetId),
    );
    expect(queue.some((q) => !writingTargets.has(q.exercise.targetId))).toBe(
      true,
    );
    for (const q of queue.filter((q) =>
      writingTargets.has(q.exercise.targetId),
    )) {
      expect(q.exercise.writing).toBeTruthy();
      expect(q.exercise.channel).toBe("grammar_production");
    }
    // A learned production direction unlocks a separately scheduled recognition direction.
    const only = {
      ...course,
      targets: course.targets.filter((t) => t.id === writing.targetId),
      exercises: course.exercises.filter(
        (e) => e.targetId === writing.targetId,
      ),
    };
    s.session!.queue = [s.session!.queue[0]];
    s.session!.revealed = true;
    s.session!.queue[0].draftAnswer = writing.answer;
    commitReview(s, course, s.session!.queue[0].attemptId, true, null, now);
    const tomorrow = new Date("2026-10-03T12:00:00Z");
    s.memory[memoryKey(writing.targetId, "grammar_production")].due =
      "2026-11-01T12:00:00Z";
    expect(
      planSession(s, only, tomorrow, null, "grammar").queue[0].exercise.channel,
    ).toBe("grammar_recognition");
  });

  it("saves typed responses without grading them, preserves drafts in backups and records self-assessment", async () => {
    const s = setup();
    const item = s.session!.queue[0];
    item.draftAnswer = "I got my brakes repaired yesterday.";
    const payload = await parseBackup(await exportBackup(s, course));
    const restored = restoredState(payload, course);
    expect(restored.session!.queue[0].draftAnswer).toBe(item.draftAnswer);
    expect(restored.events).toHaveLength(0);
    expect(restored.memory).toEqual({});
    restored.session!.revealed = true;
    commitReview(restored, course, item.attemptId, true, null, now);
    normalizeSession(restored, course, now);
    expect(restored.events[0].good).toBe(true);
    expect(restored.events[0].writtenAnswer).toBe(item.draftAnswer);
    expect(restored.events[0].exercise.writing).toEqual(writing.writing);
    expect(restored.session!.index).toBe(1);
    const again = await parseBackup(await exportBackup(restored, course));
    expect(again.state.events[0].writtenAnswer).toBe(item.draftAnswer);
  });

  it("clears an old draft for a retry and restores the original response when undoing", () => {
    const s = setup();
    const item = s.session!.queue[0];
    item.draftAnswer = "I repaired my brakes myself yesterday.";
    s.session!.revealed = true;
    commitReview(s, course, item.attemptId, false, null, now);
    normalizeSession(s, course, now);
    const retry = s.session!.queue.find((q) => q.retryOf === item.attemptId)!;
    expect(retry).toBeTruthy();
    expect(retry.draftAnswer).toBeUndefined();
    undoReview(s, now);
    expect(s.session!.queue[s.session!.index].draftAnswer).toBe(
      item.draftAnswer,
    );
    expect(s.events[0].revokedAt).toBeTruthy();
  });

  it("updates known old context copies while preserving personal explanations and immutable events", () => {
    const t = course.targets.find((t) => t.word === "borrow")!;
    const current = course.exercises.find(
      (e) => e.targetId === t.id && e.channel === "productive_recall",
    )!;
    const old = {
      ...current,
      explanation: t.previousSupport!.context.de,
      meaningCue: t.previousSupport!.context.de,
    };
    const before = structuredClone(old);
    expect(withExerciseCues(old, course).explanation).toBe(current.explanation);
    expect(old).toEqual(before);
    const own = {
      ...old,
      explanation: "Meine Eselsbrücke",
      meaningCue: "Mein eigener Hinweis",
    };
    expect(withExerciseCues(own, course)).toEqual(own);
    const s = setup();
    s.personalTargets = [
      { ...t, senseContext: t.previousSupport!.context, example: "" },
    ];
    const enriched = allTargets(s, course).find(
      (target) => target.id === t.id,
    )!;
    expect(enriched.senseContext).toEqual(t.senseContext);
    expect(enriched.example).toBe(t.example);
    s.personalTargets[0].example = "Mein eigener Beispielsatz";
    expect(
      allTargets(s, course).find((target) => target.id === t.id)!.example,
    ).toBe("Mein eigener Beispielsatz");
  });

  it("has distinct writing variants with clear meaning, criteria and support for every B1–C2 grammar goal", () => {
    for (const target of course.targets.filter(
      (t) =>
        t.kind === "grammar" && ["B1", "B2", "C1", "C2"].includes(t.level!),
    )) {
      const tasks = course.exercises.filter(
        (e) => e.targetId === target.id && e.writing,
      );
      expect(tasks.length, target.id).toBeGreaterThanOrEqual(5);
      expect(new Set(tasks.map((e) => e.prompt)).size).toBe(tasks.length);
      for (const e of tasks) {
        expect(e.translation).toBeTruthy();
        expect(e.writing!.instruction).toBeTruthy();
        expect(e.writing!.checkpoints.length).toBeGreaterThan(0);
        expect(e.writing!.kind === "complete").toBe(e.prompt.includes("___"));
        expect(e.options).toHaveLength(0);
      }
    }
    const refined = course.targets.filter((t) => t.previousSupport);
    expect(refined).toHaveLength(99);
    expect(new Set(refined.map((t) => t.ownerTopicId)).size).toBe(23);
    expect(refined.every((t) => t.example.split("\n").length === 2)).toBe(true);
  });
});
