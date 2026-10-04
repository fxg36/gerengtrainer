import { describe, expect, it } from "vitest";
import {
  initialState,
  lexicalExercises,
  memoryKey,
  stateSchema,
  type Content,
  type Target,
} from "../src/domain";
import {
  commitReview,
  findSession,
  endSession,
  normalizeSession,
  openSession,
  planSession,
  reviewCard,
  setTopic,
} from "../src/engine";
import {
  exportBackup,
  parseBackup,
  restoredState,
  validateRelations,
} from "../src/backup";

const now = new Date("2026-10-01T12:00:00Z");
const topics = ["home", "travel"].map((id) => ({
  id,
  title: id,
  description: "",
  icon: "House",
  color: "sage",
}));
const targets: Target[] = topics.flatMap((topic) =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `${topic.id}-${i}`,
    kind: "lexical",
    ownerTopicId: topic.id,
    word: `${topic.id} word ${i}`,
    de: `Bedeutung ${i}`,
    gloss: "",
    pos: "noun",
    example: "",
    level: i < 10 ? "A1" : i < 20 ? "A2" : "B1",
    dimensions: {},
    source: { name: "Test", url: "", license: "Test", sourceId: "" },
    classification: "user",
    reviewStatus: "personal",
    version: 1,
  })),
);
const content: Content = {
  version: "test",
  topics,
  targets,
  exercises: targets.flatMap(lexicalExercises),
  manifest: {
    sourceCount: 60,
    generatedAt: now.toISOString(),
    reviewStatus: "personal",
  },
};
function setup() {
  const state = initialState(topics, now);
  state.settings.timezone = "Europe/Berlin";
  state.settings.dailyCardGoal = 30;
  setTopic(state, "home", { mode: "learn" });
  setTopic(state, "travel", { mode: "learn" });
  return state;
}
function answer(state: ReturnType<typeof setup>, at = now) {
  state.session!.revealed = true;
  commitReview(
    state,
    content,
    state.session!.queue[state.session!.index].attemptId,
    true,
    null,
    at,
  );
  normalizeSession(state, content, at);
}

describe("Independent topic rounds", () => {
  it("ends only the current scope, keeps answers and resumes the saved mix after reload", () => {
    const state = setup();
    openSession(state, content, now);
    answer(state);
    const mixedId = state.session!.id;
    openSession(state, content, now, null, "travel");
    answer(state);
    const topicId = state.session!.id;
    const events = structuredClone(state.events);
    const memory = structuredClone(state.memory);
    endSession(state);
    const restored = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(findSession(restored, null, "travel")).toBeUndefined();
    expect(findSession(restored)?.id).toBe(mixedId);
    expect(restored.events).toEqual(events);
    expect(restored.memory).toEqual(memory);
    openSession(restored, content, now);
    expect(restored.session!.id).toBe(mixedId);
    openSession(restored, content, now, null, "travel");
    expect(restored.session!.id).not.toBe(topicId);
  });
  it("blocks inactive scopes and keeps a focused round intact until reactivation, including after backup", async () => {
    const state = setup();
    openSession(state, content, now, null, "travel");
    state.session!.revealed = true;
    const round = structuredClone(state.session);
    setTopic(state, "travel", { mode: "paused" });
    const before = structuredClone(state);
    normalizeSession(state, content, now);
    expect(state).toEqual(before);
    expect(planSession(state, content, now, null, "travel").queue).toHaveLength(
      0,
    );
    expect(() => answer(state)).toThrow(/Trainingsrunde/);
    expect(() => openSession(state, content, now, null, "travel")).toThrow(
      /Aktiviere/,
    );
    expect(state.events).toHaveLength(0);
    const backup = await parseBackup(await exportBackup(state, content, now));
    const restored = restoredState(backup, content);
    expect(restored.session).toEqual(round);
    setTopic(restored, "travel", { mode: "learn" });
    openSession(restored, content, now, null, "travel");
    expect(restored.session).toEqual(round);
    answer(restored);
    expect(restored.events).toHaveLength(1);
  });

  it("migrates a legacy backup with maintenance selected to automatic active training", async () => {
    const state = setup();
    const legacy = JSON.parse(JSON.stringify(state));
    legacy.preferences.home.mode = "maintain";
    legacy.preferences.travel.mode = "paused";
    const backup = await parseBackup(await exportBackup(legacy, content, now));
    const restored = restoredState(backup, content);
    expect(restored.preferences.home.mode).toBe("learn");
    expect(restored.preferences.travel.mode).toBe("paused");
    expect(restored.events).toEqual(state.events);
    expect(restored.memory).toEqual(state.memory);
    expect(planSession(restored, content, now).queue).toHaveLength(30);
  });
  it("trains only the requested active topic with its level, despite a different global content filter", () => {
    const state = setup();
    state.settings.mode = "grammar";
    setTopic(state, "travel", { level: "A2" });
    state.participation["travel-0"] = "archived";
    state.participation["travel-1"] = "archived";
    const before = structuredClone(state.preferences);
    openSession(state, content, now, null, "travel");
    expect(state.session!.queue).toHaveLength(18);
    expect(
      state.session!.queue.every((q) => {
        const target = targets.find((t) => t.id === q.exercise.targetId)!;
        return (
          target.ownerTopicId === "travel" &&
          target.level !== "B1" &&
          !state.participation[target.id]
        );
      }),
    ).toBe(true);
    expect(state.preferences).toEqual(before);
    expect(state.settings.mode).toBe("grammar");
    answer(state);
    expect(state.events).toHaveLength(1);
    expect(state.preferences.travel.mode).toBe("learn");
    expect(planSession(state, content, now).queue).toHaveLength(0);
  });

  it("serves due reviews above the selected level before automatically adding new material", () => {
    const state = setup();
    setTopic(state, "travel", { mode: "learn", level: "A1" });
    const key = memoryKey("travel-29", "productive_recall");
    state.memory[key] = {
      ...reviewCard(undefined, true, now),
      due: now.toISOString(),
    };
    openSession(state, content, now, null, "travel");
    expect(state.session!.queue).toHaveLength(11);
    expect(state.session!.queue[0].exercise.targetId).toBe("travel-29");
  });

  it("preserves unfinished mixed and topic rounds through repeated switches and reloads", () => {
    let state = setup();
    openSession(state, content, now);
    answer(state);
    state.session!.revealed = true;
    const mixed = structuredClone(state.session);
    openSession(state, content, now, null, "travel");
    answer(state);
    const focused = structuredClone(state.session);
    for (let i = 0; i < 3; i++) {
      state = stateSchema.parse(JSON.parse(JSON.stringify(state)));
      openSession(state, content, now);
      expect(state.session).toEqual(mixed);
      expect(findSession(state, null, "travel")).toEqual(focused);
      expect(state.savedSessions).toHaveLength(1);
      openSession(state, content, now, null, "travel");
      expect(state.session).toEqual(focused);
      expect(state.savedSessions).toHaveLength(1);
    }
    expect(state.events).toHaveLength(2);
  });

  it.each([false, true])(
    "skips an overlapping task practised elsewhere (other direction: %s)",
    (sibling) => {
      const state = setup();
      openSession(state, content, now);
      const mixed = state.session!;
      const pending = mixed.queue[0];
      mixed.revealed = true;
      openSession(state, content, now, null, "home");
      state.session!.queue[0].exercise = sibling
        ? content.exercises.find(
            (e) =>
              e.targetId === pending.exercise.targetId &&
              e.channel !== pending.exercise.channel,
          )!
        : pending.exercise;
      answer(state);
      openSession(state, content, now);
      expect(state.session!.id).toBe(mixed.id);
      expect(state.session!.index).toBe(1);
      expect(state.session!.revealed).toBe(false);
      expect(state.events).toHaveLength(1);
    },
  );

  it("keeps a truly due repeated direction when returning to an older round", () => {
    const state = setup();
    openSession(state, content, now);
    const pending = state.session!.queue[0];
    openSession(state, content, now, null, "home");
    state.session!.queue[0].exercise = pending.exercise;
    answer(state);
    const due = new Date(
      state.memory[
        memoryKey(pending.exercise.targetId, pending.exercise.channel)
      ].due,
    );
    openSession(state, content, due);
    expect(state.session!.index).toBe(0);
  });

  it("shares daily introduction limits between previously planned rounds", () => {
    const state = setup();
    state.settings.limitNewPerDay = true;
    state.settings.newPerDay = 2;
    openSession(state, content, now);
    const mixed = state.session!.id;
    openSession(state, content, now, null, "travel");
    answer(state);
    answer(state);
    openSession(state, content, now);
    expect(state.session!.id).toBe(mixed);
    expect(state.session!.finished).toBe(true);
    expect(state.events).toHaveLength(2);
  });

  it("keeps archive and topic scopes distinct without replacing the mixed round", () => {
    const state = setup();
    state.participation["home-0"] = "archived";
    openSession(state, content, now);
    const mixed = state.session!.id;
    openSession(state, content, now, null, "home");
    const focused = state.session!.id;
    openSession(state, content, now, "home");
    expect(state.session!.queue[0].mode).toBe("explicit_archive");
    expect(state.savedSessions).toHaveLength(2);
    expect(findSession(state)?.id).toBe(mixed);
    expect(findSession(state, null, "home")?.id).toBe(focused);
  });

  it("exports every unfinished round and upgrades older backups without scope fields", async () => {
    const state = setup();
    openSession(state, content, now);
    answer(state);
    openSession(state, content, now, null, "travel");
    answer(state);
    const restored = restoredState(
      await parseBackup(await exportBackup(state, content)),
      content,
    );
    expect(restored.session).toEqual(state.session);
    expect(restored.savedSessions).toEqual(state.savedSessions);
    expect(restored.memory).toEqual(state.memory);
    const legacy = JSON.parse(JSON.stringify(state));
    delete legacy.savedSessions;
    delete legacy.session.topicId;
    const upgraded = await parseBackup(await exportBackup(legacy, content));
    expect(upgraded.state.savedSessions).toEqual([]);
    expect(upgraded.state.session!.topicId).toBeNull();
  });

  it("rejects duplicate scopes, unknown topics and broken saved exercise references", async () => {
    const state = setup();
    openSession(state, content, now);
    openSession(state, content, now, null, "travel");
    const original = await parseBackup(await exportBackup(state, content));
    let bad = structuredClone(original);
    bad.state.savedSessions[0].topicId = "travel";
    expect(() => validateRelations(bad)).toThrow(/Trainingsbereichen/);
    bad = structuredClone(original);
    bad.state.savedSessions[0].topicId = "unknown";
    expect(() => validateRelations(bad)).toThrow(/Thema/);
    bad = structuredClone(original);
    bad.state.savedSessions[0].queue[0].exercise.targetId = "missing";
    expect(() => validateRelations(bad)).toThrow(/fehlende Lerninhalte/);
    bad = structuredClone(original);
    bad.state.session!.queue[0].exercise.targetId = "home-0";
    expect(() => validateRelations(bad)).toThrow(
      /Trainingsthema|anderen Themas/,
    );
  });
});
