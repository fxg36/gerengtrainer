import fs from "node:fs";
const data = JSON.parse(fs.readFileSync("public/content/course.json", "utf8"));
const ids = new Set(),
  targets = new Map(data.targets.map((t) => [t.id, t])),
  errors = [];
const sections = new Map();
for (const topic of data.topics) {
  if (!topic.subtopics?.length) errors.push(`Missing sections ${topic.id}`);
  for (const sub of topic.subtopics ?? []) {
    if (sections.has(sub.id)) errors.push(`Duplicate section ${sub.id}`);
    sections.set(sub.id, topic.id);
    if (!data.targets.some((t) => t.dimensions.Unterthemen?.includes(sub.id)))
      errors.push(`Empty section ${sub.id}`);
  }
}
for (const t of data.targets) {
  if ((t.id.startsWith("advanced-") || t.id.startsWith("everyday-")) && t.example.split("\n").filter(Boolean).length !== 2)
    errors.push(`Enriched meaning needs a bilingual example ${t.id}`);
  if (ids.has(t.id)) errors.push(`Duplicate target ${t.id}`);
  ids.add(t.id);
  const topicIds = new Set([t.ownerTopicId, ...(t.dimensions.Themen ?? [])]);
  for (const topicId of topicIds) {
    if (!data.topics.some((topic) => topic.id === topicId))
      errors.push(`Unknown topic ${topicId} on ${t.id}`);
    if (!t.dimensions.Unterthemen?.some((sub) => sections.get(sub) === topicId))
      errors.push(`Missing section for ${topicId} on ${t.id}`);
  }
  for (const sub of t.dimensions.Unterthemen ?? []) {
    if (!sections.has(sub) || !topicIds.has(sections.get(sub)))
      errors.push(`Invalid section ${sub} on ${t.id}`);
  }
  if (!["A1", "A2", "B1", "B2", "C1", "C2"].includes(t.level))
    errors.push(`Missing learning level ${t.id}`);
  if (!data.topics.some((topic) => topic.id === t.ownerTopicId))
    errors.push(`Missing topic ${t.id}`);
  if (t.reviewStatus === "approved")
    errors.push(`No human review supplied for ${t.id}`);
  if (t.kind === "lexical" && (!t.senseContext?.de || !t.senseContext?.en))
    errors.push(`Missing bilingual meaning context ${t.id}`);
  if (
    t.kind === "lexical" &&
    Object.values(t.senseContext ?? {}).some((cue) => cue.length > 180)
  )
    errors.push(`Learning cue is too long ${t.id}`);
}
ids.clear();
for (const e of data.exercises) {
  if (ids.has(e.id)) errors.push(`Duplicate exercise ${e.id}`);
  ids.add(e.id);
  if (!targets.has(e.targetId)) errors.push(`Missing target ${e.id}`);
  if (!e.prompt || !e.answer || !e.explanation)
    errors.push(`Missing text ${e.id}`);
  const target = targets.get(e.targetId);
  if (e.writing) {
    if (target?.kind !== "grammar" || e.mode !== "recall" || e.channel !== "grammar_production")
      errors.push(`Writing task must use grammar production ${e.id}`);
    if (!e.writing.instruction || !e.writing.checkpoints?.length)
      errors.push(`Writing task needs instructions and assessment criteria ${e.id}`);
    if ((e.writing.kind === "complete") !== e.prompt.includes("___"))
      errors.push(`Writing task form disagrees with its answer scope ${e.id}`);
    if (e.options.length) errors.push(`Writing task exposes answer options ${e.id}`);
  }
  if (
    target?.kind === "lexical" &&
    e.explanation !==
      [target.senseContext.de, target.example].filter(Boolean).join("\n")
  )
    errors.push(
      `Lexical explanation must use the learner cue and example ${e.id}`,
    );
  if (
    target?.kind === "lexical" &&
    (!e.meaningCue ||
      e.meaningCue !==
        target.senseContext?.[e.channel === "productive_recall" ? "de" : "en"])
  )
    errors.push(`Missing or inconsistent meaning cue ${e.id}`);
  if (
    targets.get(e.targetId)?.kind === "grammar" &&
    (!e.translation || !e.hint)
  )
    errors.push(`Missing German meaning or grammar cue ${e.id}`);
  if (
    e.mode === "choice" &&
    (e.options.length < 3 ||
      new Set(e.options).size !== e.options.length ||
      !e.options.includes(e.answer))
  )
    errors.push(`Invalid options ${e.id}`);
}
for (const t of data.targets.filter((t) => t.kind === "grammar"))
  if (
    data.exercises.filter((e) => e.targetId === t.id && e.mode === "choice")
      .length < 5
  )
    errors.push(`Fewer than 5 variants: ${t.id}`);
for (const t of data.targets.filter((t) => t.kind === "grammar" && ["B1", "B2", "C1", "C2"].includes(t.level)))
  if (data.exercises.filter((e) => e.targetId === t.id && e.writing).length < 5)
    errors.push(`Fewer than 5 writing variants: ${t.id}`);
for (const t of data.targets.filter((t) => t.previousSupport))
  if (t.example.split("\n").filter(Boolean).length !== 2)
    errors.push(`Refined meaning needs a bilingual example ${t.id}`);
if (
  process.argv.includes("--release") &&
  data.targets.some((t) => t.reviewStatus !== "approved")
)
  errors.push("Public release blocked: human content approval is outstanding.");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Valid internal test package: ${data.targets.length} targets, ${data.exercises.length} exercises. Human review: outstanding.`,
);
