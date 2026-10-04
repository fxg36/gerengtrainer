import type { AppState } from "./domain";
import { countedCardDays, dayKey } from "./learning-activity";

export const dailyGoalRules = { min: 30, max: 250, initial: 50 } as const;

export const dailyGoalStops = [
  30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 140, 160, 180,
  200, 220, 240, 250,
];

// Allocate the middle 40% of the track to 50–80. Preserve existing values
// between stops until the user edits, including goals from older backups.
export function goalPosition(goal: number) {
  if (goal <= 50) return ((goal - 30) / 20) * 30;
  if (goal <= 80) return 30 + ((goal - 50) / 30) * 40;
  const upper = dailyGoalStops.findIndex((value) => value >= goal);
  if (upper < 0) return 100;
  const lower = upper - 1;
  return (
    70 +
    ((lower -
      10 +
      (goal - dailyGoalStops[lower]) /
        (dailyGoalStops[upper] - dailyGoalStops[lower])) /
      11) *
      30
  );
}

export function goalAtPosition(position: number) {
  return dailyGoalStops.reduce(
    (closest, goal) =>
      Math.abs(goalPosition(goal) - position) <
      Math.abs(goalPosition(closest) - position)
        ? goal
        : closest,
    dailyGoalStops[0],
  );
}

export function adjacentGoal(goal: number, direction: number) {
  return direction > 0
    ? (dailyGoalStops.find((value) => value > goal) ?? dailyGoalRules.max)
    : (dailyGoalStops.findLast((value) => value < goal) ?? dailyGoalRules.min);
}

export function goalGuidance(goal: number) {
  if (goal < 50)
    return {
      title: "Kleiner Einstieg",
      text: "30–49 Karten: ein überschaubares Ziel zum Anfangen. Auch weniger ist ein guter Lerntag.",
    };
  if (goal <= 80)
    return {
      title: "Unser Startvorschlag",
      text: "50–80 Karten: probiere diesen Bereich aus und passe ihn an deinen Alltag an. Wiederholungen zählen mit.",
    };
  return {
    title: "Ambitioniert",
    text: "Über 80 Karten: plane mehrere kleine Einheiten und senke dein Ziel, wenn die Konzentration nachlässt.",
  };
}

export function goalSessionCapacity(state: AppState, now: Date) {
  const today = dayKey(now, state.settings.timezone);
  const practiced = countedCardDays(state, now).get(today)?.size ?? 0;
  const remaining = state.settings.dailyCardGoal - practiced;
  // Reaching a personal goal never locks learning. An explicitly requested
  // extra round is a small batch, not an automatically increased daily goal.
  return remaining > 0 ? remaining : dailyGoalRules.min;
}
