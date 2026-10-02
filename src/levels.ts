import {
  DEFAULT_LEVEL,
  learningLevels,
  type AppState,
  type LearningLevel,
  type Target,
} from "./domain";

export const levelDescriptions: Record<LearningLevel, string> = {
  A1: "Erste Grundlagen",
  A2: "Vertrauter Alltag",
  B1: "Selbstständig im Alltag",
  B2: "Mehr Ausdruck und Details",
  C1: "Anspruchsvoll und differenziert",
  C2: "Feinheiten und Nuancen",
};
export const effectiveLevel = (state: AppState, topicId: string) =>
  state.preferences[topicId]?.level ?? state.settings.level ?? DEFAULT_LEVEL;
export const withinLevel = (target: Target, level: LearningLevel) =>
  !target.level ||
  learningLevels.indexOf(target.level) <= learningLevels.indexOf(level);

// Approx. three focus targets for every two easier targets. This is a product choice,
// not a CEFR assessment or a replacement for the due-date scheduler.
// Input is already shuffled. Level buckets prevent abundant A1 words from
// crowding out smaller lower-level pools. Each target contributes only once.
export function mixFreshByLevel<T>(
  candidates: T[],
  targetOf: (candidate: T) => Target,
  selected: LearningLevel,
  random: () => number,
): T[] {
  const buckets = learningLevels.map(() => [] as T[]);
  const unknown: T[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const target = targetOf(candidate);
    if (seen.has(target.id) || !withinLevel(target, selected)) continue;
    seen.add(target.id);
    if (target.level)
      buckets[learningLevels.indexOf(target.level)].push(candidate);
    else unknown.push(candidate);
  }
  let lowerIndex = Math.floor(random() * (buckets.length + 1));
  const focusTurns = [true, false, true, false, true];
  let turn = Math.floor(random() * focusTurns.length);
  const takeEasier = (focusIndex: number) => {
    for (let attempt = 0; attempt <= buckets.length; attempt++) {
      const index = lowerIndex++ % (buckets.length + 1);
      const next =
        index === buckets.length
          ? unknown.shift()
          : index < focusIndex
            ? buckets[index].shift()
            : undefined;
      if (next) return next;
    }
    return undefined;
  };
  const ordered: T[] = [];
  while (true) {
    // Promote the next available level when upper material runs out; keep
    // easier words occasional even in small topics and subsequent rounds.
    const focusIndex = buckets.findLastIndex((bucket) => bucket.length > 0);
    if (focusIndex < 0) return [...ordered, ...unknown];
    const focus = buckets[focusIndex];
    const next = !focusTurns[turn++ % focusTurns.length]
      ? (takeEasier(focusIndex) ?? focus.shift())
      : focus.shift();
    if (next) ordered.push(next);
  }
}
