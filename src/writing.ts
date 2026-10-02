import type { Exercise } from "./domain";

// Conservative text comparison, never an automatic semantic grade.
export const normalizeWrittenAnswer = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .trim()
    .toLocaleLowerCase("en");

export function matchesModelAnswer(value: string, exercise: Exercise) {
  const normalized = normalizeWrittenAnswer(value);
  return (
    !!normalized &&
    [exercise.answer, ...exercise.alternatives].some(
      (answer) => normalizeWrittenAnswer(answer) === normalized,
    )
  );
}

export const writingLabels = {
  complete: "Form selbst bilden",
  rewrite: "Satz umformen",
  correct: "Fehler verbessern",
  compose: "Satz formulieren",
};
