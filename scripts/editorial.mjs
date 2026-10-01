import fs from "node:fs";
import crypto from "node:crypto";
const args = process.argv.slice(2),
  course = JSON.parse(fs.readFileSync("public/content/course.json", "utf8"));
const schemaVersion = 1,
  promptVersion = "classification-1";
const blueprint = {
  schemaVersion,
  promptVersion,
  taxonomy: course.topics.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
  })),
  dimensions: [
    "Themen",
    "Situationen",
    "Wortart",
    "Register",
    "Region",
    "Ausdrucksart",
  ],
  rules: [
    "Classify an individual meaning, never a word without sense context.",
    "Reuse existing IDs; return unresolved if evidence is insufficient.",
    "Preserve source fields and origin; never invent frequency or CEFR evidence.",
    "Select one ownerTopicId; allow multiple thematic labels.",
    "Output is draft and cannot claim human approval.",
  ],
  sample: course.targets.filter((t) => t.kind === "lexical").slice(0, 10),
};
if (args[0] === "review-export") {
  fs.mkdirSync("data/work", { recursive: true });
  const path = "data/work/review.json";
  fs.writeFileSync(
    path,
    JSON.stringify(
      {
        contentVersion: course.version,
        hash: crypto
          .createHash("sha256")
          .update(JSON.stringify(course))
          .digest("hex"),
        status: "pending",
        reviewer: null,
        targets: course.targets,
        exercises: course.exercises,
      },
      null,
      2,
    ),
  );
  console.log(path);
} else if (args.includes("--run")) {
  throw new Error(
    "Kein kostenpflichtiger Anbieter konfiguriert. Erst Anbieter, Modell, Budget und Adapter ausdrücklich einrichten. Dry Run: npm run content:blueprint",
  );
} else
  console.log(
    JSON.stringify({ mode: "dry-run", apiCalls: 0, blueprint }, null, 2),
  );
