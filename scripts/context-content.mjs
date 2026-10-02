import fs from "node:fs";
const readLines = (path) =>
  fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export function refineLearningContent(targets, exercises) {
  for (const line of readLines("content/usage-contexts.txt").filter(
    (s) => !s.startsWith("#"),
  )) {
    const fields = line.split("|");
    if (fields.length !== 6 || fields.some((s) => !s))
      throw new Error(`Invalid usage context: ${line}`);
    const [word, de, cueDe, cueEn, exampleEn, exampleDe] = fields;
    const matches = targets.filter(
      (t) => t.kind === "lexical" && t.word === word && t.de === de,
    );
    if (matches.length !== 1)
      throw new Error(
        `Usage context must identify one existing sense: ${word} / ${de}`,
      );
    const t = matches[0];
    t.previousSupport = { context: { ...t.senseContext }, example: t.example };
    t.senseContext = { de: cueDe, en: cueEn };
    t.example = `${exampleEn}\n${exampleDe}`;
    t.version++;
    for (const e of exercises.filter((e) => e.targetId === t.id)) {
      e.meaningCue = e.channel === "productive_recall" ? cueDe : cueEn;
      e.explanation = `${cueDe}\n${t.example}`;
      e.version++;
    }
  }

  // Keep the old cards for saved sessions/backups. Fresh production rounds use
  // these writing variants of the same learning goal and FSRS channel.
  const writingLevels = new Set(["B1", "B2", "C1", "C2"]);
  const targetMap = new Map(targets.map((t) => [t.id, t]));
  for (const e of [...exercises]) {
    const t = targetMap.get(e.targetId);
    if (e.channel !== "grammar_production" || !writingLevels.has(t.level))
      continue;
    exercises.push({
      ...e,
      id: `${e.id}:write`,
      version: 1,
      writing: {
        kind: "complete",
        instruction:
          "Schreibe den fehlenden Teil so, dass der Satz die deutsche Bedeutung ausdrückt.",
        checkpoints: [
          "Passen Zeitbezug und Verneinung zur deutschen Bedeutung?",
          "Ist die Verbform oder Wortstellung passend gebildet?",
        ],
      },
    });
  }

  let goal,
    variant = 0;
  for (const line of readLines("content/context-grammar.txt")) {
    if (line.startsWith("#")) {
      if (!line.startsWith("# context-")) continue;
      const fields = line.slice(2).split("|");
      if (fields.length !== 6) throw new Error(`Invalid context goal: ${line}`);
      const [id, level, section, title, rule, checks] = fields;
      goal = {
        id: `grammar-${id}`,
        title,
        rule,
        checkpoints: checks.split("~"),
      };
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
        source: {
          name: "KI-gestützter Aufgabenentwurf mit Anwendungskontext",
          url: "",
          license: "Projektinhalt",
          sourceId: "grammar-context-v1",
        },
        reviewStatus: "draft",
        classification: "editorial_draft",
        version: 1,
      });
      continue;
    }
    const fields = line.split("|");
    if (
      !goal ||
      fields.length < 9 ||
      fields.length > 10 ||
      fields.slice(0, 9).some((s) => !s)
    )
      throw new Error(`Invalid context task: ${line}`);
    const [
      kind,
      prompt,
      translation,
      instruction,
      answer,
      wrongA,
      wrongB,
      hint,
      reason,
      alternatives,
    ] = fields;
    variant++;
    for (const mode of ["choice", "recall"])
      exercises.push({
        id: `${goal.id}:${variant}:${mode}`,
        targetId: goal.id,
        mode,
        channel:
          mode === "choice" ? "grammar_recognition" : "grammar_production",
        prompt,
        translation,
        answer,
        alternatives: alternatives?.split("~") ?? [],
        explanation: `${goal.rule}\n${reason}`,
        context: goal.title,
        hint: mode === "choice" ? instruction : hint,
        options: mode === "choice" ? [answer, wrongA, wrongB] : [],
        relatedTargetIds: [],
        ...(mode === "recall"
          ? { writing: { kind, instruction, checkpoints: goal.checkpoints } }
          : {}),
        version: 1,
      });
  }
}
