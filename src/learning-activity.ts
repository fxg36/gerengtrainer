import type { AppState, ReviewEvent } from "./domain";

export function reviewCountHint(
  state: AppState,
  review: ReviewEvent,
  now = new Date(),
) {
  if (review.revokedAt || Date.parse(review.at) > now.getTime())
    return "Nicht gezählt.";
  if (review.retry) return "Nachversuch · zählt nicht zusätzlich.";
  const day = dayKey(new Date(review.at), state.settings.timezone);
  if (day !== dayKey(now, state.settings.timezone))
    return "An einem früheren Lerntag gezählt.";
  const index = state.events.findIndex((event) => event.id === review.id);
  const earlier = state.events.some(
    (event, i) =>
      event.id !== review.id &&
      !event.revokedAt &&
      !event.retry &&
      event.targetId === review.targetId &&
      event.exercise.channel === review.exercise.channel &&
      (Date.parse(event.at) < Date.parse(review.at) ||
        (event.at === review.at && i < index)) &&
      dayKey(new Date(event.at), state.settings.timezone) === day,
  );
  return earlier
    ? "Heute bereits gezählt · kein weiterer Verbrauch."
    : "+1 Karte zum Tagesziel";
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
export function dayKey(date: Date, timezone: string): string {
  let formatter = dayFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(date);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}

// Shared by the daily goal, engagement and free allowance. Imported event.day
// is not authoritative; count in the profile's current learning timezone.
export function countedCardDays(state: AppState, now: Date) {
  const cards = new Map<string, Set<string>>();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: state.settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const event of state.events) {
    if (
      event.revokedAt ||
      event.retry ||
      !(Date.parse(event.at) <= now.getTime())
    )
      continue;
    const parts = formatter.formatToParts(new Date(event.at));
    const day = ["year", "month", "day"]
      .map((key) => parts.find((part) => part.type === key)!.value)
      .join("-");
    const counted = cards.get(day) ?? new Set<string>();
    counted.add(`${event.targetId}~${event.exercise.channel}`);
    cards.set(day, counted);
  }
  return cards;
}

// Goal changes alone never award a badge. Only a newly counted answer can
// reach its recorded goal. Later increases leave that achievement intact.
export function reachedGoalDays(state: AppState, now = new Date()) {
  const cards = new Map<string, Set<string>>();
  const reached = new Set<string>();
  const events = state.events
    .filter(
      (event) =>
        !event.revokedAt &&
        !event.retry &&
        Date.parse(event.at) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const event of events) {
    const day = dayKey(new Date(event.at), state.settings.timezone);
    const counted = cards.get(day) ?? new Set<string>();
    const key = `${event.targetId}~${event.exercise.channel}`;
    if (counted.has(key)) continue;
    counted.add(key);
    cards.set(day, counted);
    if (event.dailyGoal !== undefined && counted.size >= event.dailyGoal)
      reached.add(day);
  }
  return reached;
}
