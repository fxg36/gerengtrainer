import fs from "node:fs";
const data = JSON.parse(fs.readFileSync("public/content/course.json", "utf8"));
const ids = new Set(),
  targets = new Map(data.targets.map((t) => [t.id, t])),
  errors = [];
for (const t of data.targets) {
  if (ids.has(t.id)) errors.push(`Duplicate target ${t.id}`);
  ids.add(t.id);
  if (!data.topics.some((topic) => topic.id === t.ownerTopicId))
    errors.push(`Missing topic ${t.id}`);
  if (t.reviewStatus === "approved")
    errors.push(`No human review supplied for ${t.id}`);
}
ids.clear();
for (const e of data.exercises) {
  if (ids.has(e.id)) errors.push(`Duplicate exercise ${e.id}`);
  ids.add(e.id);
  if (!targets.has(e.targetId)) errors.push(`Missing target ${e.id}`);
  if (!e.prompt || !e.answer || !e.explanation)
    errors.push(`Missing text ${e.id}`);
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
