import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  initialState,
  stateSchema,
  type AppState,
  type Content,
  type ReviewEvent,
} from "../src/domain";
import { buildAchievements } from "../src/achievements";
import { buildEngagement, recommendNext } from "../src/engagement";
import { openSession } from "../src/engine";
import { goalSessionCapacity, goalGuidance } from "../src/learning-goal";
import { exportBackup, parseBackup } from "../src/backup";

const content: Content = JSON.parse(
  fs.readFileSync("public/content/course.json", "utf8"),
);
const now = new Date("2026-10-02T12:00:00Z");
function setup() {
  const state = initialState(content.topics, now);
  state.settings.timezone = "Europe/Berlin";
  return state;
}
function answer(
  state: AppState,
  index = 0,
  changes: Partial<ReviewEvent> = {},
) {
  const exercise = content.exercises[index];
  const event: ReviewEvent = {
    id: `answer-${state.events.length}`,
    deviceId: state.deviceId,
    sessionId: "test-round",
    targetId: exercise.targetId,
    exercise,
    index,
    at: "2026-10-02T10:00:00Z",
    day: "2026-10-02",
    good: false,
    choice: null,
    mode: "regular",
    retry: false,
    revokedAt: null,
    engine: "ts-fsrs-5.4.2-retention-0.9",
    ...changes,
  };
  state.events.push(event);
  return event;
}

describe("daily activity and recommendations", () => {
  it("plans the remaining daily goal, allows optional extra practice and resets at local midnight", () => {
    const state = setup();
    state.settings.dailyCardGoal = 30;
    state.preferences.home.mode = "learn";
    for (let i = 0; i < 29; i++) answer(state, i);
    expect(goalSessionCapacity(state, now)).toBe(1);
    answer(state, 29);
    expect(goalSessionCapacity(state, now)).toBe(30);
    expect(
      recommendNext(state, content, buildEngagement(state, now), 0).title,
    ).toBe("Dein Tagesziel ist erreicht.");
    state.events[29].revokedAt = now.toISOString();
    expect(goalSessionCapacity(state, now)).toBe(1);
    expect(goalSessionCapacity(state, new Date("2026-10-02T22:01:00Z"))).toBe(
      30,
    );
    state.settings.dailyCardGoal = 80;
    expect(goalSessionCapacity(state, now)).toBe(51);
  });
  it("migrates the daily goal independently of legacy minutes and validates its bounds", () => {
    const old = setup() as any;
    delete old.settings.dailyCardGoal;
    old.settings.minutes = 120;
    const migrated = stateSchema.parse(old);
    expect(migrated.settings.dailyCardGoal).toBe(50);
    expect(goalSessionCapacity(migrated, now)).toBe(50);
    for (const value of [29, 251]) {
      old.settings.dailyCardGoal = value;
      expect(stateSchema.safeParse(old).success).toBe(false);
    }
    expect(goalGuidance(30).title).toBe("Kleiner Einstieg");
    expect(goalGuidance(50).title).toBe("Unser Startvorschlag");
    expect(goalGuidance(80).title).toBe("Unser Startvorschlag");
    expect(goalGuidance(85).title).toBe("Ambitioniert");
  });
  it("never recommends a paused topic or archive round on Today", () => {
    const state = setup();
    state.preferences.home.mode = "learn";
    openSession(state, content, now, null, "home");
    expect(
      recommendNext(state, content, buildEngagement(state, now), 0).kind,
    ).toBe("start");
    state.participation[content.targets[0].id] = "archived";
    openSession(state, content, now, "home");
    expect(
      recommendNext(state, content, buildEngagement(state, now), 0).kind,
    ).toBe("start");
  });
  it("starts empty and does not treat opening the app or archiving as practice", () => {
    const state = setup();
    state.participation[content.targets[0].id] = "archived";
    const progress = buildEngagement(state, now);
    expect(progress).toMatchObject({
      todayCount: 0,
      activeDays: 0,
      streak: 0,
    });
    expect(buildAchievements(state, content, now).every((m) => !m.earned)).toBe(
      true,
    );
    expect(recommendNext(state, content, progress, 0).kind).toBe("topics");
  });
  it("counts failed answers but not retries, duplicate directions, revocations or future events", () => {
    const state = setup();
    answer(state);
    answer(state, 0, {
      sessionId: "different-round",
      mode: "explicit_archive",
    });
    answer(state, 1, { retry: true });
    answer(state, 2, { revokedAt: now.toISOString() });
    answer(state, 3, { at: "2026-10-03T00:00:00Z" });
    expect(buildEngagement(state, now)).toMatchObject({
      todayCount: 1,
      totalCards: 1,
      activeDays: 1,
      streak: 1,
    });
    answer(state, 1);
    expect(buildEngagement(state, now).todayCount).toBe(2);
  });
  it("counts activity beyond 30 without a daily goal and recalculates after undo", () => {
    const state = setup();
    for (let i = 0; i < 31; i++) answer(state, i);
    expect(buildEngagement(state, now)).toMatchObject({
      todayCount: 31,
    });
    state.events[30].revokedAt = now.toISOString();
    state.events[29].revokedAt = now.toISOString();
    expect(buildEngagement(state, now)).toMatchObject({
      todayCount: 29,
    });
  });
  it("resets at local midnight and uses timestamps rather than an imported event day", () => {
    const state = setup();
    answer(state, 0, { at: "2026-10-01T22:30:00Z", day: "wrong-imported-day" });
    expect(buildEngagement(state, now).todayCount).toBe(1);
    expect(
      buildEngagement(state, new Date("2026-10-02T22:01:00Z")),
    ).toMatchObject({ todayCount: 0, streak: 1 });
  });
  it("keeps yesterday's streak alive and retains milestones after a longer break", () => {
    const state = setup();
    for (let day = 25; day <= 30; day++)
      answer(state, 0, { at: `2026-09-${day}T10:00:00Z` });
    answer(state, 0, { at: "2026-10-01T10:00:00Z" });
    expect(buildEngagement(state, now)).toMatchObject({
      activeDays: 7,
      streak: 7,
      todayCount: 0,
    });
    const later = buildEngagement(state, new Date("2026-10-10T12:00:00Z"));
    expect(later).toMatchObject({
      streak: 0,
      activeDays: 7,
      daysSincePractice: 9,
    });
    expect(
      buildAchievements(state, content, new Date("2026-10-10T12:00:00Z")).find(
        (m) => m.id === "days-7",
      )?.earned,
    ).toBe(true);
    state.preferences.home.mode = "learn";
    expect(recommendNext(state, content, later, 3).welcome).toBe(
      "Schön, dass du wieder da bist.",
    );
  });
  it("keeps Today on the mixed round even when a focused round was opened last", () => {
    const state = setup();
    state.preferences.home.mode = "learn";
    openSession(state, content, now);
    const mixed = state.session!.id;
    openSession(state, content, now, null, "home");
    const result = recommendNext(
      state,
      content,
      buildEngagement(state, now),
      0,
    );
    expect(result.kind).toBe("resume");
    expect(result.session?.id).toBe(mixed);
    state.preferences.home.mode = "paused";
    state.preferences.travel.mode = "learn";
    expect(
      recommendNext(state, content, buildEngagement(state, now), 2).kind,
    ).toBe("resume");
  });
  it("does not repeat the first-run tour for old profiles; new profiles receive it", () => {
    const state = setup();
    expect(state.settings.tourVersion).toBe(0);
    const legacy = structuredClone(state) as any;
    delete legacy.settings.tourVersion;
    expect(stateSchema.parse(legacy).settings.tourVersion).toBe(1);
  });
  it("retains tour completion and derives identical activity after a backup round trip", async () => {
    const state = setup();
    state.settings.tourVersion = 1;
    answer(state);
    const restored = await parseBackup(await exportBackup(state, content));
    expect(restored.state.settings.tourVersion).toBe(1);
    expect(buildEngagement(restored.state, now)).toEqual(
      buildEngagement(state, now),
    );
  });
});
