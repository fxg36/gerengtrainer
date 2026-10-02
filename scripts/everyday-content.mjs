import fs from "node:fs";
import crypto from "node:crypto";

const key = (word, de) => `${word}|${de}`.normalize("NFKC").toLowerCase();

// Original, explicitly authored practice material. A matching spelling alone
// is not evidence of a dictionary sense match or of a CEFR level.
export function addEverydayContent(topics, targets, exercises) {
  const meanings = new Map(targets.map((t) => [key(t.word, t.de), t]));
  const authored = new Set();
  let topic, section;
  const summary = { newMeanings: 0, enrichedMeanings: 0, sections: [] };
  for (const raw of fs
    .readFileSync("content/everyday-situations.txt", "utf8")
    .split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    if (line.startsWith("# ")) {
      const [id, title] = line.slice(2).split("|");
      topic = topics.find((t) => id.startsWith(`${t.id}.`));
      if (!topic || !title || summary.sections.includes(id))
        throw new Error(`Invalid everyday section: ${line}`);
      section = topic.subtopics.find((s) => s.id === id);
      if (!section) {
        section = { id, title };
        topic.subtopics.push(section);
      } else section.title = title;
      summary.sections.push(id);
      continue;
    }
    const fields = line.split("|");
    if (!topic || fields.length !== 8 || fields.some((f) => !f.trim()))
      throw new Error(`Invalid everyday meaning: ${line}`);
    const [word, de, pos, level, cueDe, cueEn, exampleEn, exampleDe] = fields;
    if (
      !["A1", "A2", "B1", "B2", "C1", "C2"].includes(level) ||
      cueDe.length > 180 ||
      cueEn.length > 180
    )
      throw new Error(`Invalid level or context: ${word}`);
    const meaningKey = key(word, de);
    if (authored.has(meaningKey))
      throw new Error(`Duplicate everyday meaning: ${word} / ${de}`);
    authored.add(meaningKey);
    let target = meanings.get(meaningKey);
    if (target) {
      if (target.kind !== "lexical" || target.pos !== pos)
        throw new Error(`Conflicting existing meaning: ${word} / ${de}`);
      // Keep identity, source, level and exercise IDs for existing meanings.
      // Snapshots can update old stock hints without replacing custom edits.
      target.previousSupport ??= {
        context: { ...target.senseContext },
        example: target.example,
      };
      target.version++;
      summary.enrichedMeanings++;
    } else {
      const id = `everyday-${crypto.createHash("sha256").update(meaningKey).digest("hex").slice(0, 18)}`;
      target = {
        id,
        kind: "lexical",
        ownerTopicId: topic.id,
        word,
        de,
        pos,
        level,
        gloss: cueEn,
        dimensions: {
          Themen: [],
          Unterthemen: [],
          Situationen: [],
          Wortart: [pos],
        },
        source: {
          name: "KI-gestützter Lernentwurf mit eigenen Beispielen",
          url: "",
          license: "Projektinhalt",
          sourceId: "",
        },
        reviewStatus: "draft",
        classification: "editorial_draft",
        version: 1,
      };
      targets.push(target);
      meanings.set(meaningKey, target);
      summary.newMeanings++;
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
          context: topic.title,
          options: [],
          relatedTargetIds: [],
          version: 1,
        });
      }
    }
    target.senseContext = { de: cueDe, en: cueEn };
    target.example = `${exampleEn}\n${exampleDe}`;
    for (const [dimension, value] of [
      ["Themen", topic.id],
      ["Unterthemen", section.id],
      ["Situationen", section.title],
    ]) {
      const values = (target.dimensions[dimension] ??= []);
      if (!values.includes(value)) values.push(value);
    }
    for (const exercise of exercises.filter((e) => e.targetId === target.id)) {
      exercise.meaningCue =
        exercise.channel === "productive_recall" ? cueDe : cueEn;
      exercise.explanation = `${cueDe}\n${target.example}`;
      if (!target.id.startsWith("everyday-")) exercise.version++;
    }
  }
  const descriptions = {
    food: "Im Restaurant, im Café und am Herd: bestellen, genießen und Wünsche äußern.",
    travel: "Anreisen, Hotels buchen und Probleme unterwegs klären.",
    home: "Wohnen, eine Wohnung finden und den Haushalt organisieren.",
    phrases: "Nachfragen, telefonieren und Missverständnisse klären.",
  };
  for (const topic of topics)
    if (descriptions[topic.id]) topic.description = descriptions[topic.id];
  return summary;
}
