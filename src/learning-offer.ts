import { shiftDay } from "./analytics";
import type { Engagement } from "./engagement";

// Display-only offer until verified, restorable store purchases are available.
// This is deliberately neither an entitlement nor a training gate.
export const LEARNING_OFFER = {
  introCards: 500,
  weeklyCards: 250,
  price: 4.99,
  currency: "EUR",
} as const;
export const unlimitedPrice = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: LEARNING_OFFER.currency,
}).format(LEARNING_OFFER.price);

export function freeAllowance(
  progress: Pick<Engagement, "today" | "cardDays">,
) {
  let introRemaining: number = LEARNING_OFFER.introCards;
  let introCompletedOn: string | null = null;
  const weeklyDays: { day: string; count: number }[] = [];
  // Use the same deduplicated local days as the activity display. Undo and
  // imported histories are reflected without maintaining a second ledger.
  for (const { day, count } of progress.cardDays) {
    const introductory = Math.min(introRemaining, count);
    introRemaining -= introductory;
    if (!introRemaining && !introCompletedOn) introCompletedOn = day;
    weeklyDays.push({ day, count: count - introductory });
  }
  if (!introCompletedOn)
    return {
      phase: "intro" as const,
      used: LEARNING_OFFER.introCards - introRemaining,
      remaining: introRemaining,
      limit: LEARNING_OFFER.introCards,
      periodStart: null,
      resetsOn: null,
    };

  // Fixed blocks of seven local calendar days, starting on the day the intro
  // ends. Calendar arithmetic avoids DST-dependent 167/169-hour weeks.
  const elapsedDays = Math.round(
    (Date.parse(progress.today) - Date.parse(introCompletedOn)) / 86400000,
  );
  const periodStart = shiftDay(
    introCompletedOn,
    Math.floor(elapsedDays / 7) * 7,
  );
  const resetsOn = shiftDay(periodStart, 7);
  const used = weeklyDays.reduce(
    (sum, { day, count }) =>
      sum + (day >= periodStart && day < resetsOn ? count : 0),
    0,
  );
  return {
    phase: "weekly" as const,
    used,
    remaining: Math.max(0, LEARNING_OFFER.weeklyCards - used),
    limit: LEARNING_OFFER.weeklyCards,
    periodStart,
    resetsOn,
  };
}
export type FreeAllowance = ReturnType<typeof freeAllowance>;

export function allowanceResetLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
