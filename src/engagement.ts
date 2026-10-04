import type { AppState, Content } from "./domain";
import { findSession } from "./engine";
import { dayKey, countedCardDays } from "./learning-activity";
import { shiftDay } from "./analytics";

export const TOUR_VERSION = 1;

export function buildEngagement(state: AppState, now = new Date()) {
  const today = dayKey(now, state.settings.timezone);
  const cards = countedCardDays(state, now);
  const targets = new Set(
    state.events
      .filter(
        (event) =>
          !event.revokedAt &&
          !event.retry &&
          Date.parse(event.at) <= now.getTime(),
      )
      .map((event) => event.targetId),
  );
  const days = [...cards.keys()].sort();
  const lastDay = days.at(-1);
  const todayCount = cards.get(today)?.size ?? 0;
  const totalCards = [...cards.values()].reduce(
    (sum, set) => sum + set.size,
    0,
  );
  let cursor = cards.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (cards.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  const daysSincePractice = lastDay
    ? Math.round((Date.parse(today) - Date.parse(lastDay)) / 86400000)
    : null;
  return {
    today,
    todayCount,
    dailyGoal: state.settings.dailyCardGoal,
    totalCards,
    cardDays: days.map((day) => ({ day, count: cards.get(day)!.size })),
    activeDays: days.length,
    practicedTargets: targets.size,
    streak,
    daysSincePractice,
    week: Array.from({ length: 7 }, (_, i) => {
      const day = shiftDay(today, i - 6);
      return { day, count: cards.get(day)?.size ?? 0 };
    }),
  };
}
export type Engagement = ReturnType<typeof buildEngagement>;

export function recommendNext(
  state: AppState,
  content: Content,
  progress: Engagement,
  due: number,
) {
  const active = content.topics.some(
    (topic) => state.preferences[topic.id]?.mode === "learn",
  );
  // Today resumes the mixed round only; focused rounds live under their topics.
  const session = findSession(state);
  const welcome =
    progress.activeDays === 0
      ? "Dein erster Schritt zählt."
      : (progress.daysSincePractice ?? 0) >= 3
        ? "Schön, dass du wieder da bist."
        : progress.todayCount > 0
          ? "Du bist schon mittendrin."
          : "Ein guter Tag für dein Englisch.";
  if (!active)
    return {
      welcome,
      title: "Wähle ein Thema, das zu deinem Alltag passt.",
      description:
        "Ein Thema genügt für den Anfang. Dein Level kannst du dort ebenfalls einstellen.",
      label: "Themen auswählen",
      kind: "topics" as const,
      session: null,
    };
  if (progress.todayCount >= progress.dailyGoal)
    return {
      welcome,
      title: "Dein Tagesziel ist erreicht.",
      description:
        "Für heute ist es genug. Dein Lernstand ist gespeichert; zusätzliche Karten sind freiwillig.",
      label: "Freiwillig weiterüben",
      kind: session ? ("resume" as const) : ("start" as const),
      session: session ?? null,
    };
  if (session)
    return {
      welcome,
      title: "Deine angefangene Runde wartet.",
      description:
        (progress.daysSincePractice ?? 0) >= 3
          ? `Dein Lernstand ist noch da. Zuletzt hast du vor ${progress.daysSincePractice} Tagen geübt – mach in deinem Tempo weiter.`
          : "Steige genau dort wieder ein, wo du aufgehört hast. Auch ein paar Karten bringen dich weiter.",
      label: "Training fortsetzen",
      kind: "resume" as const,
      session,
    };
  return {
    welcome,
    title:
      due > 0
        ? "Frische Bekanntes wieder auf."
        : "Entdecke die nächsten Karten.",
    description:
      (progress.daysSincePractice ?? 0) >= 3
        ? "Dein bisheriger Lernstand bleibt erhalten. Fällige Wiederholungen kommen zuerst; du kannst jederzeit pausieren."
        : due > 0
          ? `${due} Lernziele stehen zur Wiederholung an. Die App beginnt mit fälligen Karten.`
          : "Deine aktiven Themen und dein Level bestimmen die nächste Runde. Lass dir beim Antworten Zeit.",
    label: "Training starten",
    kind: "start" as const,
    session: null,
  };
}
