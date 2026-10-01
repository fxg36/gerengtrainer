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
export const targetSchema = z.object({
  id,
  kind: z.enum(["lexical", "grammar"]),
  ownerTopicId: id,
  word: text,
  de: text,
  gloss: text.default(""),
  pos: text.default(""),
  example: text.default(""),
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
});
export type Topic = z.infer<typeof topicSchema>;
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
  mode: z.enum(["learn", "maintain", "paused"]),
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
  mode: z.enum(["regular", "archive", "explicit_archive"]),
  retry: z.boolean(),
  revokedAt: iso.nullable(),
  engine: z.literal("ts-fsrs-5.4.2-retention-0.9"),
});
export type ReviewEvent = z.infer<typeof eventSchema>;
export const queueItemSchema = z.object({
  attemptId: id,
  exercise: exerciseSchema,
  mode: z.enum(["regular", "archive", "explicit_archive"]),
  retryOf: id.nullable(),
  preferenceRevision: z.number().int().nonnegative(),
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
    mode: z.enum(["mixed", "words", "grammar"]),
    onboarded: z.boolean(),
    timezone: z.string().max(100),
  }),
  preferences: z.record(id, preferenceSchema),
  participation: z.record(id, z.enum(["regular", "archived", "excluded"])),
  memory: z.record(id, cardSchema),
  events: z.array(eventSchema).max(200000),
  personalTargets: z.array(targetSchema).max(20000),
  personalExercises: z.array(exerciseSchema).max(60000),
  session: sessionSchema.nullable(),
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
      mode: "mixed",
      onboarded: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    preferences: Object.fromEntries(
      topics.map((t) => [
        t.id,
        { mode: "paused", quota: 0, revision: 0, remainder: 0, day: "" },
      ]),
    ),
    participation: {},
    memory: {},
    events: [],
    personalTargets: [],
    personalExercises: [],
    session: null,
    reports: [],
    policyHistory: [],
  };
}
export const allTargets = (state: AppState, content: Content) => [
  ...content.targets.filter(
    (t) => !state.personalTargets.some((p) => p.id === t.id),
  ),
  ...state.personalTargets,
];
export const allExercises = (state: AppState, content: Content) => [
  ...content.exercises.filter(
    (e) => !state.personalExercises.some((p) => p.id === e.id),
  ),
  ...state.personalExercises,
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
      explanation: target.example || target.gloss,
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
      explanation: target.example || target.gloss,
      options: [],
      relatedTargetIds: [],
      version: target.version,
    },
  ];
}
