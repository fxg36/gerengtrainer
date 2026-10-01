import type { DictionaryWord } from "./domain";

const normalize = (value: string) =>
  value.normalize("NFKC").replace(/’/g, "'").toLocaleLowerCase("de").trim();

export function searchDictionary(
  words: DictionaryWord[],
  query: string,
  pos: string,
) {
  const q = normalize(query),
    tokens = q.split(/\s+/).filter(Boolean);
  const hits: DictionaryWord[] = [];
  for (const word of words) {
    const senses = word.senses.filter(
      (sense) =>
        (!pos || sense.pos === pos) &&
        tokens.every((token) =>
          normalize(word.word + " " + sense.de.join(" ")).includes(token),
        ),
    );
    if (senses.length) hits.push({ ...word, senses });
  }
  // Exact headwords first, then prefixes. Word frequencies remain the tie-breaker.
  const rank = (word: DictionaryWord) =>
    normalize(word.word) === q ? 2 : normalize(word.word).startsWith(q) ? 1 : 0;
  hits.sort(
    (a, b) =>
      rank(b) - rank(a) ||
      b.frequency - a.frequency ||
      a.word.localeCompare(b.word, "en"),
  );
  return { count: hits.length, entries: hits.slice(0, 100) };
}
