import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allTargets,
  initialState,
  lexicalExercises,
  memoryKey,
  withExerciseCues,
  type Content,
} from "../src/domain";
import {
  commitReview,
  normalizeSession,
  planSession,
  setParticipation,
  setTopic,
} from "../src/engine";
import { buildAnalytics } from "../src/analytics";
import { exportBackup, parseBackup, restoredState } from "../src/backup";
import {
  groupMeanings,
  meaningSearchRank,
  relatedMeanings,
} from "../src/meanings";

const course = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
) as Content;
const now = new Date("2026-10-01T12:00:00Z");
const word = (en: string, de?: string) =>
  course.targets.find((t) => t.word === en && (!de || t.de === de))!;
const embarrassed = word("embarrassed"),
  lay = word("lay"),
  publish = word("publish");
const trio: Content = {
  ...course,
  targets: [embarrassed, lay, publish],
  exercises: course.exercises.filter((e) =>
    [embarrassed.id, lay.id, publish.id].includes(e.targetId),
  ),
};
function setup() {
  const state = initialState(course.topics, now);
  state.settings.level = "C1";
  for (const topic of course.topics)
    setTopic(state, topic.id, { mode: "learn" });
  state.session = planSession(state, trio, now);
  return state;
}

describe("Meaning-specific vocabulary", () => {
  it("uses short learner cues and German explanations instead of technical source definitions", () => {
    const fern = word("fern");
    expect(fern.gloss).toContain("Pteridophyta");
    expect(fern.senseContext?.en).not.toContain("Pteridophyta");
    expect(fern.example).toContain("Ferns grow in the shade.");
    for (const target of course.targets.filter((t) => t.kind === "lexical")) {
      expect(target.senseContext!.de.length, target.word).toBeLessThanOrEqual(
        180,
      );
      expect(target.senseContext!.en.length, target.word).toBeLessThanOrEqual(
        180,
      );
      for (const exercise of course.exercises.filter(
        (e) => e.targetId === target.id,
      )) {
        expect(exercise.explanation).toBe(
          [target.senseContext!.de, target.example].filter(Boolean).join("\n"),
        );
        if (target.gloss) expect(exercise.explanation).not.toBe(target.gloss);
      }
    }
  });
  it("refreshes exact legacy source copies without overwriting personal explanations or review history", async () => {
    const fern = word("fern");
    const current = course.exercises.find(
      (e) => e.targetId === fern.id && e.channel === "receptive_recall",
    )!;
    const legacy = {
      ...current,
      explanation: fern.gloss,
      meaningCue: fern.gloss,
    };
    const upgraded = withExerciseCues(legacy, course);
    expect(upgraded.explanation).toBe(current.explanation);
    expect(upgraded.meaningCue).toBe(fern.senseContext!.en);
    expect(legacy.explanation).toBe(fern.gloss);
    const custom = {
      ...legacy,
      explanation: "Meine eigene Eselsbrücke",
      meaningCue: "My own context",
    };
    expect(withExerciseCues(custom, course)).toEqual(custom);
    expect(
      withExerciseCues({ ...legacy, answer: "weit weg" }, course).explanation,
    ).toBe(fern.gloss);
    const state = setup();
    const small = { ...course, targets: [fern], exercises: [legacy] };
    state.session = planSession(state, small, now);
    state.session!.revealed = true;
    commitReview(
      state,
      small,
      state.session!.queue[0].attemptId,
      true,
      null,
      now,
    );
    const before = structuredClone(state.events);
    const restored = restoredState(
      await parseBackup(await exportBackup(state, course)),
      course,
    );
    expect(restored.events).toEqual(before);
    expect(
      withExerciseCues(restored.events[0].exercise, course).explanation,
    ).toBe(current.explanation);
    state.personalTargets = [
      {
        ...fern,
        senseContext: { de: "Mein deutscher Hinweis", en: fern.gloss },
      },
    ];
    expect(
      allTargets(state, course).find((t) => t.id === fern.id)!.senseContext,
    ).toEqual({ de: "Mein deutscher Hinweis", en: fern.senseContext!.en });
    state.personalTargets[0].senseContext!.en = "My own context";
    expect(
      allTargets(state, course).find((t) => t.id === fern.id)!.senseContext!.en,
    ).toBe("My own context");
  });
  it("provides a cue in the question language for every bundled lexical exercise", () => {
    const lexical = course.targets.filter((t) => t.kind === "lexical");
    expect(lexical.length).toBeGreaterThanOrEqual(950);
    for (const target of lexical) {
      expect(target.senseContext?.de.length, target.word).toBeGreaterThan(10);
      expect(target.senseContext?.en.length, target.word).toBeGreaterThan(10);
      const exercises = course.exercises.filter(
        (e) => e.targetId === target.id,
      );
      expect(exercises).toHaveLength(2);
      for (const e of exercises)
        expect(e.meaningCue).toBe(
          target.senseContext?.[
            e.channel === "productive_recall" ? "de" : "en"
          ],
        );
    }
  });
  it("distinguishes emotional, flooring and publishing meanings without revealing the translation", () => {
    expect(new Set(trio.targets.map((t) => t.id)).size).toBe(3);
    expect(trio.targets.every((t) => t.de === "verlegen")).toBe(true);
    expect(embarrassed.senseContext?.de).toContain("Gefühl");
    expect(lay.senseContext?.de).toContain("Parkett");
    expect(publish.senseContext?.de).toContain("Buch");
    for (const target of trio.targets) {
      expect(target.senseContext?.de.toLowerCase()).not.toContain(target.word);
      expect(target.senseContext?.en.toLowerCase()).not.toContain("verlegen");
    }
  });
  it("groups English or German headwords only for presentation and links separate meanings", () => {
    const trunks = course.targets.filter((t) => t.word === "trunk");
    expect(trunks).toHaveLength(2);
    expect(groupMeanings(trunks)).toHaveLength(1);
    expect(groupMeanings(trio.targets, "verlegen")).toMatchObject([
      { label: "verlegen", targets: trio.targets },
    ]);
    expect(groupMeanings(trio.targets)).toHaveLength(3);
    expect(
      relatedMeanings(embarrassed, course.targets)
        .map((t) => t.id)
        .sort(),
    ).toEqual([lay.id, publish.id].sort());
    expect(relatedMeanings(trunks[0], course.targets)).toEqual([trunks[1]]);
    expect(meaningSearchRank(trunks[0], "trunk")).toBeGreaterThan(
      meaningSearchRank(word("branch"), "trunk"),
    );
  });
  it("keeps answers, memory and archive participation independent for the same German word", () => {
    const state = setup();
    expect(state.session!.queue).toHaveLength(3);
    const index = state.session!.queue.findIndex(
      (q) => q.exercise.targetId === embarrassed.id,
    );
    state.session!.index = index;
    state.session!.revealed = true;
    const item = state.session!.queue[index];
    commitReview(state, trio, item.attemptId, true, null, now);
    normalizeSession(state, trio, now);
    expect(Object.keys(state.memory)).toEqual([
      memoryKey(embarrassed.id, item.exercise.channel),
    ]);
    const before = buildAnalytics(state, trio, now);
    expect(before.items.find((i) => i.target.id === embarrassed.id)?.seen).toBe(
      true,
    );
    expect(
      before.items
        .filter((i) => i.target.id !== embarrassed.id)
        .every((i) => !i.seen),
    ).toBe(true);
    setParticipation(state, embarrassed.id, "archived");
    const next = planSession(state, trio, now);
    expect(next.queue.map((q) => q.exercise.targetId).sort()).toEqual(
      [lay.id, publish.id].sort(),
    );
    expect(state.events).toHaveLength(1);
    expect(buildAnalytics(state, trio, now).stats).toEqual(before.stats);
  });
  it("keeps both meanings of an English word independently schedulable", () => {
    const trunk = course.targets.filter((t) => t.word === "trunk");
    const small = {
      ...course,
      targets: trunk,
      exercises: course.exercises.filter((e) =>
        trunk.some((t) => t.id === e.targetId),
      ),
    };
    const state = setup();
    state.session = planSession(state, small, now);
    expect(state.session.queue).toHaveLength(2);
    const first = state.session.queue[0];
    state.session.revealed = true;
    commitReview(state, small, first.attemptId, true, null, now);
    normalizeSession(state, small, now);
    expect(state.session.queue[state.session.index].exercise.targetId).not.toBe(
      first.exercise.targetId,
    );
    expect(planSession(state, small, now).queue).toHaveLength(1);
  });
  it("adds cues to matching legacy snapshots but not changed meanings or different channels", () => {
    const current = trio.exercises.find(
      (e) => e.targetId === embarrassed.id && e.channel === "productive_recall",
    )!;
    const old = { ...current, meaningCue: undefined };
    expect(withExerciseCues(old, course).meaningCue).toBe(
      embarrassed.senseContext?.de,
    );
    expect(
      withExerciseCues({ ...old, targetId: lay.id }, course).meaningCue,
    ).toBeUndefined();
    expect(
      withExerciseCues({ ...old, answer: "publish" }, course).meaningCue,
    ).toBeUndefined();
    expect(
      withExerciseCues({ ...old, channel: "receptive_recall" }, course)
        .meaningCue,
    ).toBeUndefined();
    expect(
      withExerciseCues({ ...old, meaningCue: "Eigener Hinweis" }, course)
        .meaningCue,
    ).toBe("Eigener Hinweis");
    const state = setup();
    state.personalTargets = [{ ...embarrassed, senseContext: undefined }];
    expect(
      allTargets(state, course).find((t) => t.id === embarrassed.id)
        ?.senseContext,
    ).toEqual(embarrassed.senseContext);
    state.personalTargets[0].de = "ein Buch verlegen";
    expect(
      allTargets(state, course).find((t) => t.id === embarrassed.id)
        ?.senseContext,
    ).toBeUndefined();
  });
  it("exports meaning cues and separate memory without rewriting older answer history", async () => {
    const state = setup();
    const item = state.session!.queue[0];
    delete item.exercise.meaningCue;
    state.session!.revealed = true;
    commitReview(state, trio, item.attemptId, true, null, now);
    expect(state.events[0].exercise.meaningCue).toBeTruthy();
    const backup = await parseBackup(await exportBackup(state, trio));
    const restored = restoredState(backup, trio);
    expect(restored.memory).toEqual(state.memory);
    expect(restored.events).toEqual(state.events);
    expect(allTargets(restored, trio).map((t) => t.senseContext)).toEqual(
      trio.targets.map((t) => t.senseContext),
    );
    const personal = {
      ...embarrassed,
      id: "user-new-meaning",
      senseContext: { de: "Eigener Kontext", en: "Personal context" },
    };
    const exercises = lexicalExercises(personal);
    expect(exercises.map((e) => e.meaningCue)).toEqual([
      "Eigener Kontext",
      "Personal context",
    ]);
    expect(exercises.every((e) => e.targetId !== embarrassed.id)).toBe(true);
  });
});
