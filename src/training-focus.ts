import type { Channel, ReviewEvent } from "./domain";

export const focusRules = { days: 30, samples: 40, minimum: 10 } as const;
export const focusChannels: Channel[] = [
  "productive_recall",
  "receptive_recall",
  "grammar_production",
  "grammar_recognition",
];
export const focusLabels: Record<Channel, string> = {
  productive_recall: "Deutsch → Englisch",
  receptive_recall: "Englisch → Deutsch",
  grammar_production: "Grammatik selbst abrufen",
  grammar_recognition: "Grammatik auswählen",
};

// Bounded product heuristics, not calibrated proficiency scores or FSRS parameters.
export function trainingFocus(events: ReviewEvent[], now = new Date()) {
  const cutoff = now.getTime() - focusRules.days * 86_400_000;
  const evidence = events
    .filter((event) => {
      const at = Date.parse(event.at);
      return (
        !event.revokedAt &&
        !event.retry &&
        event.mode === "regular" &&
        at >= cutoff &&
        at <= now.getTime()
      );
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const independent = new Set<string>();
  const samples = Object.fromEntries(
    focusChannels.map((channel) => [channel, [] as boolean[]]),
  ) as Record<Channel, boolean[]>;
  for (const event of evidence) {
    // Repeated attempts at the same meaning on one learning day must not inflate
    // confidence. Use the first unrevoked answer, even if a later attempt succeeds.
    const key = `${event.targetId}|${event.exercise.channel}|${event.day}`;
    if (independent.has(key)) continue;
    independent.add(key);
    samples[event.exercise.channel].push(event.good);
  }
  return Object.fromEntries(
    focusChannels.map((channel) => {
      const recent = samples[channel].slice(-focusRules.samples);
      const count = recent.length;
      const accuracy = count ? recent.filter(Boolean).length / count : null;
      const weight =
        count < focusRules.minimum || accuracy === null
          ? 1
          : accuracy < 0.5
            ? 2
            : accuracy < 0.7
              ? 1.5
              : accuracy < 0.85
                ? 1.25
                : 1;
      return [channel, { count, accuracy, weight }];
    }),
  ) as Record<
    Channel,
    { count: number; accuracy: number | null; weight: number }
  >;
}
export type TrainingFocus = ReturnType<typeof trainingFocus>;

export function topicBudgets(slots: number, weights: number[]) {
  if (!weights.length) return [];
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const exact = weights.map((weight) => (slots * weight) / sum);
  const budgets = exact.map(Math.floor);
  const remaining =
    slots - budgets.reduce((total, budget) => total + budget, 0);
  const priority = exact
    .map((value, index) => ({ index, remainder: value - budgets[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of priority.slice(0, remaining)) budgets[index]++;
  return budgets;
}

// Pick one direction per meaning before the independent 60/40 level mix.
// Input order is already shuffled; unavailable directions are never synthesized.
export function chooseFreshDirections<T>(
  candidates: T[],
  identity: (candidate: T) => { targetId: string; channel: Channel },
  focus: TrainingFocus,
  random: () => number,
): T[] {
  const groups = new Map<string, T[]>();
  for (const candidate of candidates) {
    const id = identity(candidate).targetId;
    groups.set(id, [...(groups.get(id) ?? []), candidate]);
  }
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const weights = group.map(
      (candidate) => focus[identity(candidate).channel].weight,
    );
    let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < group.length; index++) {
      ticket -= weights[index];
      if (ticket < 0) return group[index];
    }
    return group.at(-1)!;
  });
}
