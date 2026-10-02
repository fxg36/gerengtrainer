import fs from "node:fs";
import crypto from "node:crypto";

export const advancedReferences = [
  "https://englishprofile.org/?menu=english-vocabulary-profile",
  "https://learnenglish.britishcouncil.org/free-resources/grammar/c1/inversion-conditionals",
  "https://dictionary.cambridge.org/grammar/british-grammar/cleft-sentences-it-was-in-",
  "https://dictionary.cambridge.org/grammar/british-grammar/conditionals-other",
  "https://dictionary.cambridge.org/grammar/british-grammar/need",
  "https://dictionary.cambridge.org/grammar/british-grammar/would-rather-would-",
  "https://dictionary.cambridge.org/grammar/british-grammar/ellipsis",
];
const lines = (path) =>
  fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const source = {
  name: "KI-gestützter Lernentwurf mit eigenen Beispielen",
  url: "",
  license: "Projektinhalt",
  sourceId: "",
};

// Additive content: existing sense/exercise IDs and historical answers stay intact.
// Placement is an editorial practice tier, not an EVP/CEFR certification.
export function addAdvancedContent(topics, targets, exercises) {
  const sections = new Map(
    topics.flatMap((topic) => topic.subtopics.map((sub) => [sub.id, topic.id])),
  );
  for (const line of lines("content/advanced-vocabulary.txt").filter(
    (s) => !s.startsWith("#"),
  )) {
    const fields = line.split("|");
    if (fields.length !== 8 || fields.some((field) => !field))
      throw new Error(`Invalid advanced word: ${line}`);
    const [section, word, de, pos, cueDe, cueEn, exampleEn, exampleDe] = fields;
    const topicId = sections.get(section);
    if (!topicId) throw new Error(`Unknown advanced section: ${section}`);
    if (
      targets.some(
        (t) =>
          t.word.toLowerCase() === word.toLowerCase() &&
          t.de.toLowerCase() === de.toLowerCase(),
      )
    )
      throw new Error(`Duplicate existing meaning: ${word} / ${de}`);
    const id = `advanced-${crypto.createHash("sha256").update(`${word}|${de}`).digest("hex").slice(0, 18)}`;
    const target = {
      id,
      kind: "lexical",
      ownerTopicId: topicId,
      word,
      de,
      gloss: cueEn,
      pos,
      example: `${exampleEn}\n${exampleDe}`,
      senseContext: { de: cueDe, en: cueEn },
      level: "C2",
      dimensions: {
        Themen: [topicId],
        Unterthemen: [section],
        Lernziel: ["Nuancen und präziser Ausdruck"],
      },
      source: { ...source },
      reviewStatus: "draft",
      classification: "editorial_draft",
      version: 1,
    };
    targets.push(target);
    for (const channel of ["productive_recall", "receptive_recall"]) {
      const productive = channel === "productive_recall";
      exercises.push({
        id: `${id}:${channel}`,
        targetId: id,
        channel,
        mode: "recall",
        prompt: productive ? de : word,
        answer: productive ? word : de,
        alternatives: [],
        explanation: `${cueDe}\n${target.example}`,
        context: topics.find((t) => t.id === topicId).title,
        meaningCue: productive ? cueDe : cueEn,
        options: [],
        relatedTargetIds: [],
        version: 1,
      });
    }
  }
  let goal,
    variant = 0;
  for (const line of lines("content/advanced-grammar.txt")) {
    if (line.startsWith("# ")) {
      if (!line.startsWith("# advanced-")) continue;
      const fields = line.slice(2).split("|");
      if (fields.length !== 5)
        throw new Error(`Invalid advanced goal: ${line}`);
      const [key, level, section, title, rule] = fields;
      if (!sections.has(`grammar.${section}`))
        throw new Error(`Unknown grammar section: ${section}`);
      goal = { id: `grammar-${key}`, title, rule };
      variant = 0;
      targets.push({
        id: goal.id,
        kind: "grammar",
        ownerTopicId: "grammar",
        word: title,
        de: rule,
        gloss: "",
        pos: "grammar",
        example: "",
        level,
        dimensions: {
          Themen: ["grammar"],
          Unterthemen: [`grammar.${section}`],
          Lernziel: [title],
        },
        source: { ...source, sourceId: "grammar-advanced-v1" },
        reviewStatus: "draft",
        classification: "editorial_draft",
        version: 1,
      });
      continue;
    }
    const fields = line.split("|");
    if (!goal || fields.length !== 6 || fields.some((s) => !s))
      throw new Error(`Invalid advanced exercise: ${line}`);
    const [prompt, answer, wrongA, wrongB, translation, hint] = fields;
    variant++;
    for (const mode of ["choice", "recall"])
      exercises.push({
        id: `${goal.id}:${variant}:${mode}`,
        targetId: goal.id,
        channel:
          mode === "choice" ? "grammar_recognition" : "grammar_production",
        mode,
        prompt,
        answer,
        alternatives: [],
        explanation: goal.rule,
        context: goal.title,
        translation,
        hint,
        options: mode === "choice" ? [answer, wrongA, wrongB] : [],
        relatedTargetIds: [],
        version: 1,
      });
  }
}
