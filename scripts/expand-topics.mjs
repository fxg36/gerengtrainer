import fs from "node:fs";
import crypto from "node:crypto";
const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const key = (value) => value.toLowerCase().normalize("NFKC").trim();
const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 18);
export function expandTopics(topics, targets, exercises, selected) {
  const taxonomy = read("content/topic-sections.json");
  for (const topic of topics) {
    const sections = taxonomy[topic.id];
    topic.subtopics = sections.map(([id, title]) => ({
      id: `${topic.id}.${id}`,
      title,
    }));
    for (const target of targets.filter(
      (t) =>
        t.ownerTopicId === topic.id || t.dimensions.Themen?.includes(topic.id),
    )) {
      const section =
        sections.find((s) => s[2].split("|").includes(target.word)) ??
        sections.at(-1);
      (target.dimensions.Unterthemen ??= []).push(`${topic.id}.${section[0]}`);
    }
  }
  const manifest = read("public/dictionary/manifest.json");
  const catalogue = manifest.files.flatMap((path) => read(`public${path}`));
  const byWord = new Map(catalogue.map((row) => [key(row.word), row.senses]));
  const sourceAssignments = new Map(
    read("content/topic-sources.json").entries.map((entry) => [
      `${entry.word}|${entry.de}`,
      entry.sourceId,
    ]),
  );
  const chosen = new Set(selected.map((row) => row.id));
  for (const expansion of [
    ...read("content/topic-expansion.json"),
    ...read("content/topic-broadening.json"),
  ]) {
    let topic = topics.find((t) => t.id === expansion.id);
    if (!topic) {
      topic = {
        id: expansion.id,
        title: expansion.title,
        description: expansion.description,
        icon: expansion.icon,
        color: expansion.color,
        subtopics: [],
      };
      topics.splice(
        topics.findIndex((t) => t.id === "grammar"),
        0,
        topic,
      );
    } else {
      if (expansion.title) topic.title = expansion.title;
      if (expansion.description) topic.description = expansion.description;
    }
    for (const section of expansion.sections) {
      const subtopicId = `${topic.id}.${section.id}`;
      topic.subtopics.push({ id: subtopicId, title: section.title });
      for (const [word, de, pos, level, en] of section.entries) {
        // Fixed, inspected source senses: token overlap alone is not a
        // semantic match. Missing German glosses are translated separately.
        const sourceId = sourceAssignments.get(`${word}|${de}`);
        const candidate = (byWord.get(key(word)) ?? []).find(
          (sense) => sense.id === sourceId,
        );
        if (sourceId && !candidate)
          throw new Error(
            `Missing assigned source sense: ${word} (${sourceId})`,
          );
        const id = candidate?.id ?? `draft-${hash(`${word}|${de}`)}`;
        let target = targets.find(
          (t) => t.id === id || (key(t.word) === key(word) && t.de === de),
        );
        if (!target) {
          target = {
            id,
            kind: "lexical",
            ownerTopicId: topic.id,
            word,
            de,
            pos,
            level,
            gloss: candidate?.gloss ?? "",
            example: "",
            senseContext: { de: section.context, en },
            dimensions: {
              Themen: [],
              Unterthemen: [],
              Situationen: [section.title],
              Wortart: [pos],
              Register: [],
              Region: [],
              Ausdrucksart: [word.includes(" ") ? "Wendung" : "Einzelwort"],
            },
            source: {
              name: candidate ? "Wiktionary via Kaikki" : "Eigener KI-Entwurf",
              url: candidate
                ? `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#English`
                : "",
              license: candidate ? "CC-BY-SA-4.0" : "Projektinhalt",
              sourceId: candidate?.id ?? "",
            },
            reviewStatus: "draft",
            classification: "editorial_draft",
            version: 1,
          };
          targets.push(target);
          for (const [channel, suffix] of [
            ["productive_recall", "active"],
            ["receptive_recall", "receptive"],
          ]) {
            const productive = channel === "productive_recall";
            exercises.push({
              id: `${id}:${suffix}`,
              targetId: id,
              channel,
              mode: "recall",
              prompt: productive ? de : word,
              answer: productive ? word : de,
              alternatives: [],
              explanation: section.context,
              context: productive
                ? "Wie sagst du das auf Englisch?"
                : "Was bedeutet das auf Deutsch?",
              meaningCue: productive ? section.context : en,
              options: [],
              relatedTargetIds: [],
              version: 1,
            });
          }
          if (candidate && !chosen.has(id)) {
            selected.push({ ...candidate, word, example: null });
            chosen.add(id);
          }
        }
        if (!target.dimensions.Themen.includes(topic.id))
          target.dimensions.Themen.push(topic.id);
        if (!(target.dimensions.Unterthemen ??= []).includes(subtopicId))
          target.dimensions.Unterthemen.push(subtopicId);
      }
    }
  }
}
