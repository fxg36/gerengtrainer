import {
  trainingLevels,
  allTargets,
  type AppState,
  type Content,
  type Channel,
} from "./domain";
import { buildEngagement } from "./engagement";
import { reachedGoalDays } from "./learning-activity";

export const achievementGroups = [
  "Lernschritte",
  "Dranbleiben",
  "Tagesziele",
  "Wissen ausbauen",
  "Grammatik",
  "Kursstufen",
] as const;
export type Achievement = {
  id: string;
  title: string;
  description: string;
  group: (typeof achievementGroups)[number];
  value: number;
  target: number;
  earned: boolean;
  level?: (typeof trainingLevels)[number];
};

// A historical course milestone, not the current retention estimate or CEFR.
// Each direction requires three successful learning days spanning seven days
// after its last failure. Once demonstrated, the milestone survives later gaps.
export function buildAchievements(
  state: AppState,
  content: Content,
  now = new Date(),
  progress = buildEngagement(state, now),
) {
  const targets = new Map(
    allTargets(state, content).map((target) => [target.id, target]),
  );
  const evidence = state.events
    .filter(
      (event) =>
        !event.revokedAt &&
        !event.retry &&
        targets.has(event.targetId) &&
        Date.parse(event.at) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const seen = new Set<string>();
  const grammar = new Set<string>();
  const successful = new Map<string, Set<Channel>>();
  const stableChannels = new Map<string, Set<Channel>>();
  const runs = new Map<string, { first: number; days: Set<string> }>();
  const independent = new Set<string>();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: state.settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const event of evidence) {
    const target = targets.get(event.targetId)!;
    seen.add(target.id);
    if (target.kind === "grammar") grammar.add(target.id);
    const key = `${target.id}~${event.exercise.channel}`;
    const parts = formatter.formatToParts(new Date(event.at));
    const day = ["year", "month", "day"]
      .map((key) => parts.find((part) => part.type === key)!.value)
      .join("-");
    if (!event.good) {
      runs.delete(key);
      independent.add(`${key}~${day}`);
      continue;
    }
    const directions = successful.get(target.id) ?? new Set<Channel>();
    directions.add(event.exercise.channel);
    successful.set(target.id, directions);
    if (independent.has(`${key}~${day}`)) continue;
    independent.add(`${key}~${day}`);
    const run = runs.get(key) ?? {
      first: Date.parse(event.at),
      days: new Set<string>(),
    };
    run.days.add(day);
    runs.set(key, run);
    if (
      run.days.size >= 3 &&
      Date.parse(event.at) - run.first >= 7 * 86400000
    ) {
      const channels = stableChannels.get(target.id) ?? new Set<Channel>();
      channels.add(event.exercise.channel);
      stableChannels.set(target.id, channels);
    }
  }
  const bothDirections = (id: string, map: Map<string, Set<Channel>>) => {
    const required: Channel[] =
      targets.get(id)?.kind === "grammar"
        ? ["grammar_production", "grammar_recognition"]
        : ["productive_recall", "receptive_recall"];
    return required.every((channel) => map.get(id)?.has(channel));
  };
  const both = [...seen].filter((id) => bothDirections(id, successful)).length;
  const stable = new Set(
    [...seen].filter((id) => bothDirections(id, stableChannels)),
  );
  const items: Achievement[] = [];
  const goalDays = reachedGoalDays(state, now).size;
  const add = (
    id: string,
    title: string,
    description: string,
    group: Achievement["group"],
    value: number,
    target: number,
    level?: Achievement["level"],
  ) =>
    items.push({
      id,
      title,
      description,
      group,
      value,
      target,
      earned: target > 0 && value >= target,
      level,
    });
  for (const amount of [1, 10, 100, 500, 1000, 5000])
    add(
      `cards-${amount}`,
      amount === 1
        ? "Erster Schritt"
        : `${amount.toLocaleString("de-DE")} Lernschritte`,
      amount === 1
        ? "Deine erste Karte beantworten."
        : `${amount.toLocaleString("de-DE")} Karten über alle Lerntage beantworten.`,
      "Lernschritte",
      progress.totalCards,
      amount,
    );
  for (const amount of [3, 7, 30, 100, 365])
    add(
      `days-${amount}`,
      `${amount} Lerntage`,
      "An so vielen Tagen üben. Pausen dazwischen sind willkommen.",
      "Dranbleiben",
      progress.activeDays,
      amount,
    );
  for (const amount of [1, 7, 30, 100])
    add(
      `goals-${amount}`,
      amount === 1 ? "Erstes Tagesziel" : `${amount} Tagesziele erreicht`,
      "An so vielen Tagen dein Tagesziel erreichen. Pausen dazwischen sind willkommen.",
      "Tagesziele",
      goalDays,
      amount,
    );
  for (const amount of [10, 50, 100, 500])
    add(
      `targets-${amount}`,
      `${amount} Inhalte entdeckt`,
      "Verschiedene Wörter oder Grammatiklernziele beantworten.",
      "Wissen ausbauen",
      seen.size,
      amount,
    );
  for (const amount of [1, 25, 100])
    add(
      `both-${amount}`,
      amount === 1 ? "In beide Richtungen" : `${amount} doppelte Erfolge`,
      "So viele Lernziele in beiden Abrufrichtungen richtig beantworten.",
      "Wissen ausbauen",
      both,
      amount,
    );
  for (const amount of [1, 10, 100])
    add(
      `stable-${amount}`,
      amount === 1 ? "Über Tage erinnert" : `${amount} Lernziele vertieft`,
      "Beide Richtungen an je drei Lerntagen über mindestens sieben Tage richtig abrufen.",
      "Wissen ausbauen",
      stable.size,
      amount,
    );
  for (const amount of [1, 10, 30])
    add(
      `grammar-${amount}`,
      amount === 1
        ? "Der erste Satzbau-Schritt"
        : `${amount} Grammatikziele geübt`,
      "Verschiedene Grammatiklernziele bearbeiten.",
      "Grammatik",
      grammar.size,
      amount,
    );
  for (const level of trainingLevels) {
    // Only bundled course targets define completion; selecting a higher level,
    // pausing themes or adding a personal card cannot award a course badge.
    const course = content.targets.filter((target) => target.level === level);
    add(
      `level-${level}`,
      `${level}-Kurs vertieft`,
      "Alle Inhalte dieser Kursstufe in beiden Richtungen über mehrere Tage erfolgreich wiederholt.",
      "Kursstufen",
      course.filter((target) => stable.has(target.id)).length,
      course.length,
      level,
    );
  }
  return items;
}

// Persist with the answer, so reloading or undo/re-answer cannot replay a notice.
// Loading, importing and changing settings never trigger celebrations.
export function recordNewAchievements(
  before: AppState,
  draft: AppState,
  content: Content,
  now = new Date(),
) {
  if (draft.events.length !== before.events.length + 1) return [];
  const latest = draft.events.at(-1)!;
  if (latest.retry || latest.revokedAt || Date.parse(latest.at) > now.getTime())
    return [];
  const prior = new Set(
    buildAchievements(before, content, now)
      .filter((item) => item.earned)
      .map((item) => item.id),
  );
  const fresh = buildAchievements(draft, content, now).filter(
    (item) =>
      item.earned &&
      !prior.has(item.id) &&
      !draft.celebratedAchievements.includes(item.id),
  );
  draft.celebratedAchievements.push(...fresh.map((item) => item.id));
  return fresh;
}
