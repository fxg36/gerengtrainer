import fs from "node:fs";
import crypto from "node:crypto";
import { expandTopics } from "./expand-topics.mjs";
import { addAdvancedContent, advancedReferences } from "./advanced-content.mjs";
import { refineLearningContent } from "./context-content.mjs";
import { addEverydayContent } from "./everyday-content.mjs";
const read = (path) => fs.readFileSync(path, "utf8");
const topics = JSON.parse(read("content/topics.json"));
const levels = JSON.parse(read("content/learning-levels.json"));
const getLevel = (kind, key) => {
  const level = levels[kind][key];
  if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(level))
    throw new Error(`Missing learning level: ${kind}:${key}`);
  return level;
};
const sourcePath = fs.existsSync("data/work/seed-candidates.json")
  ? "data/work/seed-candidates.json"
  : "content/source-selection.json";
const source = [
    ...new Map(
      [
        ...JSON.parse(read(sourcePath)),
        ...JSON.parse(read("content/additional-senses.json")),
      ].map((row) => [row.id, row]),
    ).values(),
  ],
  byWord = new Map();
const lexicalContexts = JSON.parse(read("content/lexical-contexts.json"));
for (const row of source) {
  const key = row.word.toLowerCase();
  byWord.set(key, [...(byWord.get(key) ?? []), row]);
}
const targets = [],
  exercises = [],
  selected = [],
  missing = [];
const contexts = {
  home: ["Haushalt", "Einrichten"],
  repair: ["Reparieren", "Haushalt"],
  nature: ["Draußen", "Spaziergang"],
  weather: ["Draußen", "Reiseplanung"],
  body: ["Arztbesuch", "Alltag"],
  clothes: ["Einkaufen", "Alltag"],
  food: ["Kochen", "Einkaufen"],
  road: ["Unterwegs", "Werkstatt"],
  travel: ["Unterwegs", "Urlaub"],
  people: ["Gespräch", "Beziehungen"],
  work: ["Beruf", "Gespräch"],
  phrases: ["Gespräch", "Alltag"],
};
const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
const hash = (s) =>
  crypto.createHash("sha256").update(s).digest("hex").slice(0, 18);
const verbs = new Set(
  "tighten loosen replace repair assemble measure install unplug sneeze peel chop slice dice grate stir whip knead simmer boil roast bake steam thaw season commute overtake apologize forgive blame argue persuade encourage reassure recruit resign delegate negotiate approve postpone confirm attach".split(
    " ",
  ),
);
const adjectives = new Set(
  "overcast chilly mild slippery muddy steep sore stiff numb striped checked wrinkled ripe stale bland savory bitter sour crunchy reliable thoughtful considerate stubborn shy outgoing generous stingy honest polite rude awkward confident embarrassed disappointed relieved grateful curious jealous proud available".split(
    " ",
  ),
);
const overrides = JSON.parse(read("content/source-overrides.json"));
for (const line of read("content/vocabulary.txt")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("#"))) {
  const [topic, word, de, hint = ""] = line.split("|");
  const candidates = byWord.get(word.toLowerCase()) ?? [];
  const expectedPos = verbs.has(word)
    ? "verb"
    : adjectives.has(word)
      ? "adj"
      : topic === "phrases"
        ? null
        : "noun";
  const score = (r) =>
    (r.pos === expectedPos ? 30 : 0) +
    (r.gloss.toLowerCase().includes(hint.toLowerCase()) ? 5 : 0) +
    (r.de.some((t) => norm(de).includes(norm(t))) ? 4 : 0) -
    (r.tags.some((t) => ["rare", "dated", "nonstandard"].includes(t)) ? 6 : 0);
  const override = overrides[topic + "|" + word];
  const candidate =
    override === null
      ? undefined
      : override
        ? source.find((r) => r.id === override)
        : [...candidates].sort((a, b) => score(b) - score(a))[0];
  const id = candidate?.id ?? "draft-" + hash(word + "|" + de);
  const existing = targets.find((t) => t.id === id);
  if (existing) {
    if (!existing.dimensions.Themen.includes(topic))
      existing.dimensions.Themen.push(topic);
    continue;
  }
  if (candidate) selected.push(candidate);
  else missing.push(word);
  const pos = candidate?.pos ?? expectedPos ?? "phrase";
  const learningCue = lexicalContexts[topic + "|" + word];
  if (!learningCue?.de || !learningCue?.en)
    throw new Error(`Missing meaning context: ${topic}|${word}`);
  const senseContext = { de: learningCue.de, en: learningCue.en };
  const target = {
    id,
    kind: "lexical",
    ownerTopicId: topic,
    word,
    de,
    gloss: candidate?.gloss ?? "",
    pos,
    example: learningCue.example ?? "",
    senseContext,
    level: getLevel("lexical", topic + "|" + word),
    dimensions: {
      Themen: [topic, ...(topic === "repair" ? ["home"] : [])],
      Situationen: contexts[topic],
      Wortart: [pos || "offen"],
      Register:
        candidate?.tags.filter((t) =>
          ["informal", "formal", "colloquial", "slang"].includes(t),
        ) ?? [],
      Region:
        candidate?.tags.filter((t) =>
          ["US", "UK", "British", "American"].includes(t),
        ) ?? [],
      Ausdrucksart: [word.includes(" ") ? "Wendung" : "Einzelwort"],
    },
    source: {
      name: candidate ? "Wiktionary via Kaikki" : "Eigener KI-Entwurf",
      url: candidate
        ? "https://en.wiktionary.org/wiki/" +
          encodeURIComponent(candidate.word) +
          "#English"
        : "",
      license: candidate ? "CC-BY-SA-4.0" : "Projektinhalt",
      sourceId: candidate?.id ?? "",
    },
    reviewStatus: "draft",
    classification: "editorial_draft",
    version: 2,
  };
  targets.push(target);
  for (const [channel, suffix, prompt, answer, context] of [
    ["productive_recall", "active", de, word, "Wie sagst du das auf Englisch?"],
    [
      "receptive_recall",
      "receptive",
      word,
      de,
      "Was bedeutet das auf Deutsch?",
    ],
  ])
    exercises.push({
      id: `${id}:${suffix}`,
      targetId: id,
      channel,
      mode: "recall",
      prompt,
      answer,
      alternatives: [],
      explanation: [target.senseContext.de, target.example]
        .filter(Boolean)
        .join("\n"),
      context,
      meaningCue:
        channel === "productive_recall"
          ? target.senseContext?.de
          : target.senseContext?.en,
      options: [],
      relatedTargetIds: [],
      version: 2,
    });
}
const grammarCues = JSON.parse(read("content/grammar-cues.json"));
let group = null,
  variant = 0;
for (const line of read("content/grammar.txt").split(/\r?\n/).filter(Boolean)) {
  if (line.startsWith("# ")) {
    const [id, title, rule] = line.slice(2).split("|");
    group = { id: "grammar-" + id, title, rule };
    variant = 0;
    targets.push({
      id: group.id,
      kind: "grammar",
      ownerTopicId: "grammar",
      word: title,
      de: rule,
      gloss: "",
      pos: "grammar",
      example: "",
      level: getLevel("grammar", id),
      dimensions: {
        Themen: ["grammar"],
        Situationen: ["Alltag"],
        Lernziel: [title],
      },
      source: {
        name: "KI-gestützter Aufgabenentwurf",
        url: "",
        license: "Projektinhalt",
        sourceId: "grammar-v1",
      },
      reviewStatus: "draft",
      classification: "editorial_draft",
      version: 1,
    });
    continue;
  }
  const [prompt, answer, ...wrong] = line.split("|");
  variant++;
  const cue = grammarCues[group.id.replace(/^grammar-/, "")]?.[variant - 1];
  if (!cue?.[0] || !cue?.[1])
    throw new Error(`Missing grammar cue: ${group.id}:${variant}`);
  const [translation, hint] = cue;
  const linked = targets
    .filter(
      (t) =>
        t.kind === "lexical" &&
        new RegExp(
          "\\b" + t.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
          "i",
        ).test(prompt),
    )
    .map((t) => t.id);
  // These are incidental vocabulary links, not tested distractor targets; tracked separately in curriculum metadata.
  for (const mode of ["choice", "recall"])
    exercises.push({
      id: `${group.id}:${variant}:${mode}`,
      targetId: group.id,
      channel: mode === "choice" ? "grammar_recognition" : "grammar_production",
      mode,
      prompt,
      answer,
      alternatives: [],
      explanation: group.rule,
      context: group.title,
      translation,
      hint,
      options: mode === "choice" ? [answer, ...wrong] : [],
      relatedTargetIds: [],
      vocabularyTargetIds: linked,
      version: 2,
    });
}
expandTopics(topics, targets, exercises, selected);
// Grammar goals get meaningful sections without changing their stable IDs.
for (const target of targets.filter((t) => t.kind === "grammar")) {
  const text = `${target.word} ${target.id}`.toLowerCase();
  const section =
    /frage|indirekt|relativ|beding|if|satz|passiv|reported|condition/.test(text)
      ? "structure"
      : /vergangen|zeit|verb|have|for und since|plan|gerade|past|present|future|perfect/.test(
            text,
          )
        ? "tenses"
        : "precision";
  target.dimensions.Unterthemen = [`grammar.${section}`];
}
addAdvancedContent(topics, targets, exercises);
refineLearningContent(targets, exercises);
const everyday = addEverydayContent(topics, targets, exercises);
const catalogue = JSON.parse(read("public/dictionary/manifest.json"));
const content = {
  version: "2026.10.2-content.11",
  topics,
  targets,
  exercises,
  manifest: {
    sourceCount: catalogue.count,
    sourceWordCount: catalogue.words,
    generatedAt: new Date().toISOString(),
    reviewStatus: "draft",
    lexicalCount: targets.filter((t) => t.kind === "lexical").length,
    grammarGoals: targets.filter((t) => t.kind === "grammar").length,
    grammarVariants: exercises.filter((e) => e.mode === "choice").length,
    missingDictionaryMatches: targets
      .filter((t) => t.kind === "lexical" && !t.source.sourceId)
      .map((t) => t.word),
    humanApproved: 0,
  },
};
fs.mkdirSync("public/content", { recursive: true });
fs.writeFileSync("public/content/course.json", JSON.stringify(content));
fs.writeFileSync(
  "content/source-selection.json",
  JSON.stringify(selected, null, 2),
);
fs.writeFileSync(
  "public/content/provenance.json",
  JSON.stringify(
    {
      dictionary: JSON.parse(
        read(
          fs.existsSync("data/work/source.json")
            ? "data/work/source.json"
            : "content/dictionary-source.json",
        ),
      ),
      attribution:
        "Wiktionary contributors. Source page URLs are stored per meaning. Extracted by Kaikki/Wiktextract. German glosses, selection and thematic mapping edited for Einfach Englisch (formerly Wortnah); draft, not human approved.",
      license: "https://creativecommons.org/licenses/by-sa/4.0/",
      classification: {
        method:
          "assistant-authored topic assignments from a fixed taxonomy; source metadata preserved",
        status: "draft",
        learningLevels: levels.method,
        meaningContexts:
          "German and English sense cues authored for the selected meaning; English source definitions retained where suitable. Separate sense IDs remain separate learning targets; draft, not human approved.",
      },
      grammar: {
        method: "assistant-authored structured task drafts; no paid API calls",
        referencePages: advancedReferences,
        referenceUse: "Grammar and level-design references only; examples are original. Advanced practice levels are provisional, not validated CEFR assignments or copied English Vocabulary Profile entries.",
        humanApproved: 0,
        textPractice: "170 writing tasks with optional hints, intended German meaning, model answers and self-assessment criteria. No automatic semantic grading; original question/answer IDs retained.",
        contextReferences: [
          "https://www.cambridgeenglish.org/latinamerica/Images/167791-b2-first-handbook.pdf",
          "https://learnenglishteens.britishcouncil.org/sites/teens/files/gs_third_conditional.pdf",
        ],
      },
      usageContexts: "82 existing senses refined with specific bilingual cues and original bilingual examples. Source definitions and sense IDs retained; editorial drafts, not human approved.",
      everydaySituations: {
        ...everyday,
        method: "Original assistant-authored bilingual contexts and examples for everyday situations. Existing exact meanings reuse their IDs and sources; new meanings have no asserted dictionary match. Practice levels are provisional; human review outstanding.",
      },
      catalogue,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(content.manifest, null, 2));
