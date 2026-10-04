import {
  allTargets,
  learningLevels,
  type AppState,
  type Content,
  type LearningLevel,
  type Target,
} from "./domain";

// Product heuristics for observed course performance, not a validated CEFR test.
export const estimateRules = {
  days: 30,
  window: 60,
  answers: 40,
  learningDays: 3,
  repeatedTargets: 5,
  words: 20,
  grammar: 5,
  perDirection: 10,
  accuracy: 0.9,
  directionAccuracy: 0.85,
} as const;

export function estimateTraining(
  state: AppState,
  content: Content,
  now = new Date(),
) {
  // User-created/edited levels must not confer an apparent course qualification.
  // A backup also stores unchanged bundled targets in personalTargets. Compare
  // actual content identity so restoring a backup preserves its evidence.
  const current = new Map(allTargets(state, content).map((t) => [t.id, t]));
  const targets = new Map(
    content.targets
      .filter((t) => {
        const active = current.get(t.id);
        return (
          t.level &&
          t.classification !== "user" &&
          active?.classification !== "user" &&
          active?.word === t.word &&
          active.de === t.de &&
          active.kind === t.kind &&
          active.level === t.level
        );
      })
      .map((t) => [t.id, t]),
  );
  const exercises = new Map(content.exercises.map((e) => [e.id, e]));
  const cutoff = now.getTime() - estimateRules.days * 86400000;
  const independent = new Set<string>();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: state.settings.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const evidence = state.events
    .filter((e) => {
      const original = exercises.get(e.exercise.id);
      return (
        !e.retry &&
        !e.revokedAt &&
        e.mode === "regular" &&
        targets.has(e.targetId) &&
        Date.parse(e.at) > cutoff &&
        Date.parse(e.at) <= now.getTime() &&
        original?.targetId === e.targetId &&
        original.channel === e.exercise.channel &&
        original.prompt === e.exercise.prompt &&
        original.answer === e.exercise.answer
      );
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .flatMap((event) => {
      const day = formatter.format(new Date(event.at));
      const key = `${event.targetId}|${event.exercise.channel}|${day}`;
      if (independent.has(key)) return [];
      independent.add(key);
      return [{ ...event, localDay: day }];
    });
  function domain(kind: Target["kind"]) {
    const channels =
      kind === "lexical"
        ? ["productive_recall", "receptive_recall"]
        : ["grammar_production", "grammar_recognition"];
    const levels = learningLevels.map((level) => {
      const samples = evidence
        .filter((e) => {
          const target = targets.get(e.targetId)!;
          return (
            target.kind === kind &&
            target.level === level &&
            channels.includes(e.exercise.channel)
          );
        })
        .slice(-estimateRules.window);
      const days = new Set(samples.map((e) => e.localDay)).size;
      const learned = new Map<string, Set<string>>();
      for (const event of samples) {
        const dates = learned.get(event.targetId) ?? new Set<string>();
        dates.add(event.localDay);
        learned.set(event.targetId, dates);
      }
      const accuracy = samples.length
        ? samples.filter((e) => e.good).length / samples.length
        : 0;
      const directions = channels.map((channel) => {
        const answers = samples.filter((e) => e.exercise.channel === channel);
        return {
          count: answers.length,
          accuracy: answers.length
            ? answers.filter((e) => e.good).length / answers.length
            : 0,
        };
      });
      const repeated = [...learned.values()].filter(
        (dates) => dates.size >= 2,
      ).length;
      const requiredTargets =
        kind === "lexical" ? estimateRules.words : estimateRules.grammar;
      const ready =
        samples.length >= estimateRules.answers &&
        days >= estimateRules.learningDays &&
        learned.size >= requiredTargets &&
        repeated >= estimateRules.repeatedTargets &&
        directions.every(
          (direction) => direction.count >= estimateRules.perDirection,
        );
      return {
        level,
        count: samples.length,
        days,
        targets: learned.size,
        repeated,
        requiredTargets,
        accuracy,
        directions,
        ready,
        secure:
          ready &&
          accuracy >= estimateRules.accuracy &&
          directions.every(
            (direction) =>
              direction.accuracy >= estimateRules.directionAccuracy,
          ),
      };
    });
    const secure = levels.findLast((level) => level.secure);
    // Show the best-supported candidate when there is no reliable estimate yet.
    const candidate =
      secure ?? [...levels].reverse().sort((a, b) => b.count - a.count)[0];
    return { kind, level: secure?.level ?? null, candidate, levels };
  }
  const words = domain("lexical"),
    grammar = domain("grammar");
  const level: LearningLevel | null =
    words.level && grammar.level
      ? learningLevels[
          Math.min(
            learningLevels.indexOf(words.level),
            learningLevels.indexOf(grammar.level),
          )
        ]
      : null;
  return { words, grammar, level };
}
