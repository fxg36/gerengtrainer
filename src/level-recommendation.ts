import {
  allTargets,
  learningLevels,
  trainingLevels,
  targetInTopic,
  type AppState,
  type Content,
  type LearningLevel,
} from "./domain";
import { setTopic } from "./engine";

// Conservative product rules for trying harder course material, not a CEFR test.
export const levelRecommendationRules = {
  days: 30,
  samples: 60,
  minimum: 40,
  targets: 20,
  learningDays: 3,
  repeatedTargets: 5,
  directionSamples: 10,
  accuracy: 0.9,
  directionAccuracy: 0.85,
  snoozeDays: 7,
} as const;
export function recommendLevel(
  state: AppState,
  content: Content,
  now = new Date(),
) {
  const topics = content.topics.filter(
    (t) => state.preferences[t.id]?.mode === "learn",
  );
  const targets = allTargets(state, content);
  const scopes = [
    null,
    ...topics.filter((t) => state.preferences[t.id].level).map((t) => t.id),
  ];
  for (const topicId of scopes) {
    const from = topicId
      ? state.preferences[topicId].level!
      : state.settings.level;
    const to = learningLevels[learningLevels.indexOf(from) + 1];
    if (!to || !trainingLevels.includes(to)) continue;
    const key = topicId ?? "global";
    const decision = state.settings.levelSuggestions[key];
    if (
      decision?.snoozedUntil &&
      Date.parse(decision.snoozedUntil) > now.getTime()
    )
      continue;
    const selectedTopics = topicId
      ? [topicId]
      : topics.filter((t) => !state.preferences[t.id].level).map((t) => t.id);
    const eligible = targets.filter(
      (t) =>
        (state.participation[t.id] ?? "regular") === "regular" &&
        (state.settings.mode === "mixed" ||
          (state.settings.mode === "grammar") === (t.kind === "grammar")) &&
        selectedTopics.some((id) => targetInTopic(t, id)),
    );
    if (!eligible.some((t) => t.level === to)) continue;
    const current = new Map(
      eligible.filter((t) => t.level === from).map((t) => [t.id, t]),
    );
    if (current.size < levelRecommendationRules.repeatedTargets) continue;
    const cutoff = Math.max(
      now.getTime() - levelRecommendationRules.days * 86400000,
      decision ? Date.parse(decision.after) : 0,
    );
    const independent = new Set<string>();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: state.settings.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const samples = state.events
      .filter(
        (e) =>
          !e.revokedAt &&
          !e.retry &&
          e.mode === "regular" &&
          current.has(e.targetId) &&
          Date.parse(e.at) > cutoff &&
          Date.parse(e.at) <= now.getTime(),
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .flatMap((e) => {
        const day = formatter.format(new Date(e.at));
        const id = `${e.targetId}|${e.exercise.channel}|${day}`;
        if (independent.has(id)) return [];
        independent.add(id);
        return [{ ...e, localDay: day }];
      })
      .slice(-levelRecommendationRules.samples);
    if (
      samples.length < levelRecommendationRules.minimum ||
      new Set(samples.map((e) => e.localDay)).size <
        levelRecommendationRules.learningDays ||
      new Set(samples.map((e) => e.targetId)).size <
        Math.min(levelRecommendationRules.targets, current.size)
    )
      continue;
    const correct = samples.filter((e) => e.good).length;
    if (correct / samples.length < levelRecommendationRules.accuracy) continue;
    // Sparse grammar quotas must not make a vocabulary-based suggestion
    // impossible. Name its evidence, require both directions in that domain,
    // and veto other directions with at least five samples showing weakness.
    const domains = [
      {
        label: "Wortschatz",
        channels: ["productive_recall", "receptive_recall"],
      },
      {
        label: "Grammatik",
        channels: ["grammar_production", "grammar_recognition"],
      },
    ].map((domain) => ({
      ...domain,
      results: domain.channels.map((channel) => {
        const attempts = samples.filter((e) => e.exercise.channel === channel);
        return {
          count: attempts.length,
          accuracy: attempts.length
            ? attempts.filter((e) => e.good).length / attempts.length
            : 0,
        };
      }),
    }));
    if (
      domains.some((domain) =>
        domain.results.some(
          (result) =>
            result.count >= 5 &&
            result.accuracy < levelRecommendationRules.directionAccuracy,
        ),
      )
    )
      continue;
    const strong = domains.filter((domain) =>
      domain.results.every(
        (result) =>
          result.count >= levelRecommendationRules.directionSamples &&
          result.accuracy >= levelRecommendationRules.directionAccuracy,
      ),
    );
    if (!strong.length) continue;
    const byTarget = new Map<string, Set<string>>();
    for (const event of samples) {
      const days = byTarget.get(event.targetId) ?? new Set<string>();
      days.add(event.localDay);
      byTarget.set(event.targetId, days);
    }
    if (
      [...byTarget.values()].filter((days) => days.size > 1).length <
      levelRecommendationRules.repeatedTargets
    )
      continue;
    return {
      from,
      to,
      topicId,
      topic: topics.find((t) => t.id === topicId)?.title ?? null,
      basis: strong.map((domain) => domain.label).join(" und "),
      correct,
      count: samples.length,
      days: new Set(samples.map((e) => e.localDay)).size,
    };
  }
  return null;
}
export type LevelRecommendation = NonNullable<
  ReturnType<typeof recommendLevel>
>;

export function changeTrainingLevel(
  state: AppState,
  level: LearningLevel | null,
  topicId: string | null = null,
  now = new Date(),
) {
  if (level && !trainingLevels.includes(level)) return;
  const previous = topicId
    ? state.preferences[topicId]?.level
    : state.settings.level;
  if (previous === level || (!topicId && !level)) return;
  if (topicId) setTopic(state, topicId, { level });
  else state.settings.level = level!;
  state.settings.levelSuggestions[topicId ?? "global"] = {
    after: now.toISOString(),
    snoozedUntil: null,
  };
}
export function snoozeLevelRecommendation(
  state: AppState,
  topicId: string | null,
  now = new Date(),
) {
  state.settings.levelSuggestions[topicId ?? "global"] = {
    after: now.toISOString(),
    snoozedUntil: new Date(
      now.getTime() + levelRecommendationRules.snoozeDays * 86400000,
    ).toISOString(),
  };
}
