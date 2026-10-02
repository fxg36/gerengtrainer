import type { Target } from "./domain";

export const headwordKey = (word: string) =>
  word.normalize("NFKC").replace(/’/g, "'").trim().toLocaleLowerCase("de");
const germanHeadwords = (target: Target) =>
  target.de.split(/\s*\/\s*/).map(headwordKey);
export function meaningSearchRank(target: Target, query: string) {
  const search = headwordKey(query);
  if (!search) return 0;
  if (
    headwordKey(target.word) === search ||
    germanHeadwords(target).includes(search)
  )
    return 2;
  return headwordKey(target.word).startsWith(search) ? 1 : 0;
}
export function relatedMeanings(target: Target, targets: Target[]) {
  if (target.kind !== "lexical") return [];
  const german = new Set(germanHeadwords(target));
  return targets.filter(
    (other) =>
      other.kind === "lexical" &&
      other.id !== target.id &&
      (headwordKey(other.word) === headwordKey(target.word) ||
        germanHeadwords(other).some((word) => german.has(word))),
  );
}

// Grouping is presentation only. Every meaning keeps its own target ID,
// participation state and separate memory cards in both recall directions.
export function groupMeanings(targets: Target[], query = "") {
  const groups = new Map<
    string,
    { key: string; label: string; targets: Target[] }
  >();
  const search = headwordKey(query);
  for (const target of targets) {
    const germanMatch =
      search &&
      germanHeadwords(target).includes(search) &&
      headwordKey(target.word) !== search;
    const key =
      target.kind === "grammar"
        ? target.id
        : `${germanMatch ? "de" : "en"}:${germanMatch ? search : headwordKey(target.word)}`;
    const group = groups.get(key) ?? {
      key,
      label: germanMatch ? query.trim() : target.word,
      targets: [],
    };
    group.targets.push(target);
    groups.set(key, group);
  }
  return [...groups.values()];
}
