import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  initialState,
  type Content,
  type AppState,
  type ReviewEvent,
  type Target,
  type Channel,
} from "../src/domain";
import { buildAchievements } from "../src/achievements";
import { reviewCountHint } from "../src/learning-activity";
import { buildEngagement } from "../src/engagement";
import { exportBackup, parseBackup } from "../src/backup";

const now = new Date("2026-10-02T12:00:00Z");
const real: Content = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
);
const targets = [
  ...real.targets
    .filter((target) => target.level === "B1" && target.kind === "lexical")
    .slice(0, 2),
  real.targets.find(
    (target) => target.kind === "grammar" && target.level === "B2",
  )!,
];
const content = {
  ...real,
  targets,
  exercises: real.exercises.filter((exercise) =>
    targets.some((target) => target.id === exercise.targetId),
  ),
};
const setup = () => {
  const s = initialState(content.topics, now);
  s.settings.timezone = "Europe/Berlin";
  return s;
};
function answer(
  state: AppState,
  target = targets[0],
  channel: Channel = "productive_recall",
  daysAgo = 0,
  changes: Partial<ReviewEvent> = {},
) {
  const exercise = content.exercises.find(
    (exercise) =>
      exercise.targetId === target.id && exercise.channel === channel,
  )!;
  const at = new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const event: ReviewEvent = {
    id: `event-${state.events.length}`,
    deviceId: state.deviceId,
    sessionId: "test",
    targetId: target.id,
    exercise,
    index: 0,
    at,
    day: "ignored",
    good: true,
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
function deepen(state: AppState, target: Target) {
  for (const channel of ["productive_recall", "receptive_recall"] as const)
    for (const day of [16, 8, 1]) answer(state, target, channel, day);
}
const badge = (state: AppState, id: string, at = now) =>
  buildAchievements(state, content, at).find((item) => item.id === id)!;

describe("achievements", () => {
  it("offers thirty-two transparent milestones without awarding them for choosing a level or archiving", () => {
    const state = setup();
    state.settings.level = "C2";
    state.participation[targets[0].id] = "archived";
    const items = buildAchievements(state, content, now);
    expect(items).toHaveLength(32);
    expect(
      items
        .filter((item) => item.group === "Kursstufen")
        .map((item) => item.level),
    ).toEqual(["B1", "B2", "C1", "C2"]);
    expect(items.every((item) => !item.earned)).toBe(true);
    expect(badge(state, "level-B1").target).toBe(2);
  });
  it("counts first practice, grammar and both directions while excluding revoked, future and retry events", () => {
    const state = setup();
    answer(state);
    answer(state, targets[0], "receptive_recall");
    answer(state, targets[2], "grammar_production");
    answer(state, targets[1], "productive_recall", 0, { retry: true });
    answer(state, targets[1], "productive_recall", -1);
    answer(state, targets[1], "productive_recall", 0, {
      revokedAt: now.toISOString(),
    });
    expect(badge(state, "cards-1").earned).toBe(true);
    expect(badge(state, "grammar-1").earned).toBe(true);
    expect(badge(state, "both-1").earned).toBe(true);
    expect(badge(state, "targets-10").value).toBe(2);
    expect(badge(state, "level-B1").value).toBe(0);
  });
  it("requires every course target in both directions across days, retains achievements through pauses and restores them from backups", async () => {
    const state = setup();
    deepen(state, targets[0]);
    expect(badge(state, "level-B1")).toMatchObject({
      value: 1,
      target: 2,
      earned: false,
    });
    deepen(state, targets[1]);
    expect(badge(state, "level-B1").earned).toBe(true);
    answer(state, targets[0], "productive_recall", 0, { good: false });
    expect(
      badge(state, "level-B1", new Date("2027-01-01T12:00:00Z")).earned,
    ).toBe(true);
    const restored = await parseBackup(await exportBackup(state, content));
    expect(buildAchievements(restored.state, content, now)).toEqual(
      buildAchievements(state, content, now),
    );
    state.events.findLast(
      (event) =>
        event.targetId === targets[1].id &&
        event.exercise.channel === "receptive_recall",
    )!.revokedAt = now.toISOString();
    expect(badge(state, "level-B1").earned).toBe(false);
  });
  it("does not treat same-day repeats or successes interrupted by a mistake as seven-day retention", () => {
    const state = setup();
    for (let i = 0; i < 5; i++)
      answer(state, targets[0], "productive_recall", 16);
    answer(state, targets[0], "productive_recall", 8, { good: false });
    answer(state, targets[0], "productive_recall", 1);
    for (const day of [16, 8, 1])
      answer(state, targets[0], "receptive_recall", day);
    expect(badge(state, "stable-1").earned).toBe(false);
  });
});

describe("immediate card-count feedback", () => {
  it("explains new cards, duplicate directions and retries consistently with the counter, including undo", () => {
    const state = setup();
    const first = answer(state);
    expect(reviewCountHint(state, first, now)).toBe("+1 Karte zum Tagesziel");
    const duplicate = answer(state);
    expect(reviewCountHint(state, duplicate, now)).toContain(
      "Heute bereits gezählt",
    );
    const retry = answer(state, targets[0], "productive_recall", 0, {
      retry: true,
    });
    expect(reviewCountHint(state, retry, now)).toContain("Nachversuch");
    expect(buildEngagement(state, now).todayCount).toBe(1);
    first.revokedAt = now.toISOString();
    expect(reviewCountHint(state, duplicate, now)).toBe(
      "+1 Karte zum Tagesziel",
    );
    duplicate.revokedAt = now.toISOString();
    expect(buildEngagement(state, now).todayCount).toBe(0);
  });
});
