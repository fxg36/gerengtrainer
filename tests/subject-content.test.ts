import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  allTargets,
  initialState,
  targetInSubtopic,
  withExerciseCues,
  type Content,
} from "../src/domain";
import { exportBackup, parseBackup } from "../src/backup";
import { planSession, setTopic } from "../src/engine";
const content: Content = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
);
describe("specialist subject coverage", () => {
  it("updates every known earlier standard hint in imported cards while preserving personal notes", async () => {
    const state = initialState(content.topics);
    const contract = content.targets.find(
      (t) => t.word === "contract" && t.de === "Vertrag",
    )!;
    expect(contract.previousSupports?.length).toBeGreaterThan(0);
    for (const previous of [
      contract.previousSupport!,
      ...contract.previousSupports!,
    ]) {
      state.personalTargets = [
        {
          ...contract,
          senseContext: previous.context,
          example: previous.example,
        },
      ];
      const target = allTargets(state, content).find(
        (t) => t.id === contract.id,
      )!;
      expect(target.senseContext).toEqual(contract.senseContext);
      expect(target.example).toBe(contract.example);
      for (const current of content.exercises.filter(
        (e) => e.targetId === contract.id,
      )) {
        const old = {
          ...current,
          meaningCue:
            previous.context[
              current.channel === "productive_recall" ? "de" : "en"
            ],
          explanation: [previous.context.de, previous.example]
            .filter(Boolean)
            .join("\n"),
        };
        const before = structuredClone(old);
        expect(withExerciseCues(old, content)).toEqual(current);
        expect(old).toEqual(before);
      }
    }
    const own = {
      ...contract,
      senseContext: { de: "Meine Eselsbrücke", en: "My own note" },
      example: "Mein persönliches Beispiel",
    };
    state.personalTargets = [own];
    expect(
      allTargets(state, content).find((t) => t.id === contract.id),
    ).toEqual(own);
    const backup = await parseBackup(await exportBackup(state, content));
    expect(backup.state.personalTargets[0].previousSupports).toEqual(
      contract.previousSupports,
    );
  });
  it("offers focused content in all eleven new sections with examples and both directions", () => {
    for (const section of [
      "civic.courts",
      "civic.contracts",
      "business.economy",
      "business.accounting",
      "business.investment",
      "business.processes",
      "people.psychology",
      "body.hospital",
      "science.math",
      "science.lab",
      "science.physics",
    ]) {
      const targets = content.targets.filter((t) =>
        targetInSubtopic(t, section),
      );
      expect(targets.length, section).toBeGreaterThanOrEqual(10);
      for (const target of targets) {
        expect(target.example).toContain("\n");
        expect(target.senseContext?.de).toBeTruthy();
        expect(target.senseContext?.en).toBeTruthy();
        expect(
          new Set(
            content.exercises
              .filter((e) => e.targetId === target.id)
              .map((e) => e.channel),
          ),
        ).toEqual(new Set(["productive_recall", "receptive_recall"]));
      }
    }
  });
  it("shares related meanings, separates ambiguous words and introduces the new topic as inactive", () => {
    const contract = content.targets.filter(
      (t) => t.word === "contract" && t.de === "Vertrag",
    );
    expect(contract).toHaveLength(1);
    expect(contract[0].dimensions.Themen).toEqual(
      expect.arrayContaining(["work", "civic", "business", "shopping"]),
    );
    expect(content.targets.filter((t) => t.word === "defendant")).toHaveLength(
      2,
    );
    expect(
      content.targets.filter((t) => t.word === "court").map((t) => t.de),
    ).toEqual(
      expect.arrayContaining(["Gericht", "Spielfeld (etwa beim Tennis)"]),
    );
    expect(initialState(content.topics).preferences.business.mode).toBe(
      "paused",
    );
  });
  it("trains new sections with normal level, activation and shared memory rules", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    const state = initialState(content.topics, now);
    expect(
      planSession(state, content, now, null, "business", "business.accounting")
        .queue,
    ).toHaveLength(0);
    setTopic(state, "business", { mode: "learn", level: "C1" });
    const round = planSession(
      state,
      content,
      now,
      null,
      "business",
      "business.accounting",
    );
    expect(round.queue.length).toBeGreaterThan(10);
    expect(
      round.queue.every((q) =>
        targetInSubtopic(
          content.targets.find((t) => t.id === q.exercise.targetId)!,
          "business.accounting",
        ),
      ),
    ).toBe(true);
  });
});
