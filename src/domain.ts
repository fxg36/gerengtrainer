import { z } from "zod";

const text = z.string().max(4000);
const id = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[a-zA-Z0-9_.:~-]+$/)
  .refine(
    (value) => !["__proto__", "constructor", "prototype"].includes(value),
    "Reserved identifier",
  );
const iso = z.iso.datetime();
export const channelSchema = z.enum([
  "productive_recall",
  "receptive_recall",
  "grammar_production",
  "grammar_recognition",
]);
export type Channel = z.infer<typeof channelSchema>;
export const learningLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const learningLevelSchema = z.enum(learningLevels);
export type LearningLevel = z.infer<typeof learningLevelSchema>;
export const DEFAULT_LEVEL: LearningLevel = "B1";
export const targetSchema = z.object({
  id,
  kind: z.enum(["lexical", "grammar"]),
  ownerTopicId: id,
  word: text,
  de: text,
  gloss: text.default(""),
  pos: text.default(""),
  example: text.default(""),
  senseContext: z.object({ de: text, en: text }).optional(),
  previousSupport: z
    .object({ context: z.object({ de: text, en: text }), example: text })
    .optional(),
  level: learningLevelSchema.optional(),
  dimensions: z.record(
    z.string().max(60),
    z.array(z.string().max(150)).max(30),
  ),
  source: z.object({
    name: text,
    url: z.string().max(2000),
    license: text,
    sourceId: text.default(""),
  }),
  reviewStatus: z.enum(["draft", "machine_checked", "approved", "personal"]),
  classification: z.enum(["editorial_draft", "source", "user"]),
  version: z.number().int().positive(),
});
export type Target = z.infer<typeof targetSchema>;
export const exerciseSchema = z.object({
  id,
  targetId: id,
  channel: channelSchema,
  mode: z.enum(["recall", "choice"]),
  prompt: text,
  answer: text,
  alternatives: z.array(text).max(20).default([]),
  explanation: text,
  context: text,
  meaningCue: text.optional(),
  translation: text.optional(),
  hint: text.optional(),
  writing: z
    .object({
      kind: z.enum(["complete", "rewrite", "correct", "compose"]),
      instruction: text,
      checkpoints: z.array(text).min(1).max(4),
    })
    .optional(),
  options: z.array(text).max(5).default([]),
  relatedTargetIds: z.array(id).max(20).default([]),
  version: z.number().int().positive(),
});
export type Exercise = z.infer<typeof exerciseSchema>;
export const topicSchema = z.object({
  id,
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  color: z.string(),
  subtopics: z
    .array(z.object({ id, title: z.string().max(100) }))
    .max(12)
    .optional(),
});
export type Topic = z.infer<typeof topicSchema>;
export const targetInTopic = (target: Target, topicId: string) =>
  target.ownerTopicId === topicId ||
  !!target.dimensions.Themen?.includes(topicId);
export const targetInSubtopic = (target: Target, subtopicId: string) =>
  !!target.dimensions.Unterthemen?.includes(subtopicId);
// Reserved session scope for deliberate practice across all archived topics.
export const ALL_ARCHIVE_TOPICS = "all-archived";
export interface Content {
  version: string;
  targets: Target[];
  exercises: Exercise[];
  topics: Topic[];
  manifest: {
    sourceCount: number;
    sourceWordCount?: number;
    generatedAt: string;
    reviewStatus: string;
  };
}
export interface DictionaryEntry {
  id: string;
  word: string;
  pos: string;
  gloss: string;
  de: string[];
  tags: string[];
  topics: string[];
  example: string | null;
  frequency?: number;
}
export type DictionarySense = Pick<
  DictionaryEntry,
  "id" | "pos" | "gloss" | "de" | "tags" | "topics"
>;
export interface DictionaryWord {
  word: string;
  frequency: number;
  senses: DictionarySense[];
}
export const preferenceSchema = z.object({
  // Keep the portable backup values; the UI exposes only active/inactive.
  // Legacy maintenance topics remain selected and use automatic planning now.
  mode: z
    .enum(["learn", "maintain", "paused"])
    .transform((mode) => (mode === "maintain" ? ("learn" as const) : mode)),
  level: learningLevelSchema.nullable().default(null),
  quota: z.number().int().min(0).max(50).multipleOf(5),
  revision: z.number().int().nonnegative(),
  remainder: z.number().min(0).lt(1),
  day: z.string(),
});
export const cardSchema = z.object({
  due: iso,
  stability: z.number().finite().nonnegative(),
  difficulty: z.number().finite().nonnegative(),
  elapsed_days: z.number().finite().nonnegative(),
  scheduled_days: z.number().finite().nonnegative(),
  learning_steps: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: z.number().int().min(0).max(3),
  last_review: iso.optional(),
});
export const eventSchema = z.object({
  id,
  deviceId: id,
  sessionId: id,
  targetId: id,
  exercise: exerciseSchema,
  index: z.number().int().nonnegative(),
  at: iso,
  day: z.string(),
  good: z.boolean(),
  choice: text.nullable(),
  writtenAnswer: text.optional(),
  mode: z.enum(["regular", "archive", "explicit_archive"]),
  retry: z.boolean(),
  revokedAt: iso.nullable(),
  engine: z.literal("ts-fsrs-5.4.2-retention-0.9"),
});
export type ReviewEvent = z.infer<typeof eventSchema>;
export const queueItemSchema = z.object({
  attemptId: id,
  topicId: id.optional(),
  exercise: exerciseSchema,
  mode: z.enum(["regular", "archive", "explicit_archive"]),
  retryOf: id.nullable(),
  preferenceRevision: z.number().int().nonnegative(),
  draftAnswer: text.optional(),
});
export type QueueItem = z.infer<typeof queueItemSchema>;
export const sessionSchema = z.object({
  id,
  createdAt: iso,
  minutes: z.number().int().min(1).max(120),
  seed: z.number(),
  queue: z.array(queueItemSchema).max(500),
  index: z.number().int().nonnegative(),
  revealed: z.boolean(),
  feedback: z
    .object({ good: z.boolean(), eventId: id, choice: text.nullable() })
    .nullable(),
  finished: z.boolean(),
  archiveTopic: id.nullable(),
  topicId: id.nullable().default(null),
  subtopicId: id.nullable().default(null),
  quotaCommitted: z.boolean(),
  quotaPlan: z.record(
    id,
    z.object({
      revision: z.number().int(),
      remainder: z.number().min(0).lt(1),
      day: z.string(),
    }),
  ),
});
export type Session = z.infer<typeof sessionSchema>;
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  profileId: id,
  deviceId: id,
  createdAt: iso,
  updatedAt: iso,
  settings: z.object({
    minutes: z.number().int().min(1).max(120),
    newPerDay: z.number().int().min(0).max(50),
    grammarPerDay: z.number().int().min(0).max(10),
    limitNewPerDay: z.boolean().default(false),
    level: learningLevelSchema.default(DEFAULT_LEVEL),
    mode: z.enum(["mixed", "words", "grammar"]),
    onboarded: z.boolean(),
    timezone: z.string().max(100),
  }),
  preferences: z.record(id, preferenceSchema),
  // Read older profiles/backups, but keep only the two current states in memory.
  participation: z.record(
    id,
    z
      .enum(["regular", "archived", "excluded"])
      .transform((status) =>
        status === "excluded" ? ("archived" as const) : status,
      ),
  ),
  memory: z.record(id, cardSchema),
  events: z.array(eventSchema).max(200000),
  personalTargets: z.array(targetSchema).max(20000),
  personalExercises: z.array(exerciseSchema).max(60000),
  session: sessionSchema.nullable(),
  savedSessions: z.array(sessionSchema).max(201).default([]),
  reports: z
    .array(
      z.object({
        targetId: id,
        exerciseId: id.optional(),
        at: iso,
        note: text,
      }),
    )
    .max(10000),
  policyHistory: z
    .array(
      z.object({
        id,
        at: iso,
        kind: z.enum(["topic", "participation"]),
        targetId: id,
        before: text,
        after: text,
      }),
    )
    .max(100000),
});
export type AppState = z.infer<typeof stateSchema>;
export type Preference = z.infer<typeof preferenceSchema>;
export type MemoryCard = z.infer<typeof cardSchema>;
export const uid = () => crypto.randomUUID();
export const memoryKey = (targetId: string, channel: Channel) =>
  `${targetId}~${channel}`;
export function initialState(topics: Topic[], now = new Date()): AppState {
  return {
    schemaVersion: 1,
    revision: 0,
    profileId: uid(),
    deviceId: uid(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    settings: {
      minutes: 20,
      newPerDay: 6,
      grammarPerDay: 1,
      limitNewPerDay: false,
      level: DEFAULT_LEVEL,
      mode: "mixed",
      onboarded: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    preferences: Object.fromEntries(
      topics.map((t) => [
        t.id,
        {
          mode: "paused",
          level: null,
          quota: 0,
          revision: 0,
          remainder: 0,
          day: "",
        },
      ]),
    ),
    participation: {},
    memory: {},
    events: [],
    personalTargets: [],
    personalExercises: [],
    session: null,
    savedSessions: [],
    reports: [],
    policyHistory: [],
  };
}
export const allTargets = (state: AppState, content: Content) => [
  ...content.targets.filter(
    (t) => !state.personalTargets.some((p) => p.id === t.id),
  ),
  ...state.personalTargets.map((target) => {
    const current = content.targets.find(
      (t) =>
        t.id === target.id &&
        t.word === target.word &&
        t.de === target.de &&
        t.kind === target.kind,
    );
    return current
      ? {
          ...target,
          level: target.level ?? current.level,
          example:
            target.classification !== "user" &&
            (!target.example ||
              target.example === current.previousSupport?.example)
              ? current.example
              : target.example,
          dimensions:
            target.classification === "user"
              ? target.dimensions
              : {
                  ...target.dimensions,
                  Themen: [
                    ...new Set([
                      ...(target.dimensions.Themen ?? []),
                      ...(current.dimensions.Themen ?? []),
                    ]),
                  ],
                  Unterthemen: [
                    ...new Set([
                      ...(target.dimensions.Unterthemen ?? []),
                      ...(current.dimensions.Unterthemen ?? []),
                    ]),
                  ],
                },
          senseContext:
            target.senseContext && current.senseContext
              ? {
                  ...target.senseContext,
                  de:
                    target.senseContext.de ===
                    current.previousSupport?.context.de
                      ? current.senseContext.de
                      : target.senseContext.de,
                  en:
                    target.senseContext.en === current.gloss ||
                    target.senseContext.en ===
                      current.previousSupport?.context.en
                      ? current.senseContext.en
                      : target.senseContext.en,
                }
              : (target.senseContext ?? current.senseContext),
        }
      : target;
  }),
];
// Older backups keep their exercise snapshots. Add cues only when the actual
// question and answer still match the bundled version; never replace history.
export function withExerciseCues(
  exercise: Exercise,
  content: Content,
): Exercise {
  const current = content.exercises.find(
    (e) =>
      e.id === exercise.id &&
      e.targetId === exercise.targetId &&
      e.channel === exercise.channel &&
      e.prompt === exercise.prompt &&
      e.answer === exercise.answer,
  );
  if (!current) return exercise;
  const target = content.targets.find(
    (t) => t.id === current.targetId && t.kind === "lexical",
  );
  // Source definitions used to be copied into learning cards. Only replace an
  // exact copy; custom explanations and immutable review history stay intact.
  const rawDefinition = (value: string | undefined) =>
    !!target?.gloss && value === target.gloss;
  return {
    ...exercise,
    explanation:
      rawDefinition(exercise.explanation) ||
      (target?.previousSupport &&
        exercise.explanation ===
          [target.previousSupport.context.de, target.previousSupport.example]
            .filter(Boolean)
            .join("\n"))
        ? current.explanation
        : exercise.explanation,
    translation: exercise.translation ?? current.translation,
    hint: exercise.hint ?? current.hint,
    writing: exercise.writing ?? current.writing,
    meaningCue:
      rawDefinition(exercise.meaningCue) ||
      (target?.previousSupport &&
        exercise.meaningCue ===
          target.previousSupport.context[
            exercise.channel === "productive_recall" ? "de" : "en"
          ])
        ? current.meaningCue
        : (exercise.meaningCue ?? current.meaningCue),
  };
}
export const allExercises = (state: AppState, content: Content) => [
  ...content.exercises.filter(
    (e) => !state.personalExercises.some((p) => p.id === e.id),
  ),
  ...state.personalExercises.map((e) => withExerciseCues(e, content)),
];
export function lexicalExercises(target: Target): Exercise[] {
  return [
    {
      id: `${target.id}:active`,
      targetId: target.id,
      channel: "productive_recall",
      mode: "recall",
      prompt: target.de,
      answer: target.word,
      alternatives: [],
      context: "Wie sagst du das auf Englisch?",
      meaningCue: target.senseContext?.de || undefined,
      explanation: [target.senseContext?.de, target.example]
        .filter(Boolean)
        .join("\n"),
      options: [],
      relatedTargetIds: [],
      version: target.version,
    },
    {
      id: `${target.id}:receptive`,
      targetId: target.id,
      channel: "receptive_recall",
      mode: "recall",
      prompt: target.word,
      answer: target.de,
      alternatives: [],
      context: "Was bedeutet das auf Deutsch?",
      meaningCue: target.senseContext?.en || undefined,
      explanation: [target.senseContext?.de, target.example]
        .filter(Boolean)
        .join("\n"),
      options: [],
      relatedTargetIds: [],
      version: target.version,
    },
  ];
}
