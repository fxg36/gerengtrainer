import { z } from "zod";
import {
  stateSchema,
  targetSchema,
  exerciseSchema,
  topicSchema,
  allTargets,
  allExercises,
  memoryKey,
  type AppState,
  type Content,
} from "./domain";

const payloadSchema = z.object({
  state: stateSchema,
  content: z.object({
    version: z.string(),
    targets: z.array(targetSchema).max(30000),
    exercises: z.array(exerciseSchema).max(90000),
    topics: z.array(topicSchema).max(100),
  }),
});
export type BackupPayload = z.infer<typeof payloadSchema>;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function exportBackup(
  state: AppState,
  content: Content,
): Promise<string> {
  const payload: BackupPayload = {
    state,
    content: {
      version: content.version,
      targets: allTargets(state, content),
      exercises: allExercises(state, content),
      topics: content.topics,
    },
  };
  return JSON.stringify(
    {
      format: "wortnah-backup",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      checksum: await sha256(payload),
      payload,
    },
    null,
    2,
  );
}
function unique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length)
    throw new Error(`Doppelte IDs in ${label}.`);
}
export function validateRelations(payload: BackupPayload) {
  const { state, content } = payload;
  unique(
    content.targets.map((t) => t.id),
    "Lerninhalten",
  );
  unique(
    content.exercises.map((e) => e.id),
    "Aufgaben",
  );
  unique(
    state.events.map((e) => e.id),
    "Lernhistorie",
  );
  unique(
    state.personalTargets.map((t) => t.id),
    "eigenen Einträgen",
  );
  unique(
    state.personalExercises.map((e) => e.id),
    "eigenen Aufgaben",
  );
  const targets = new Set(
      [...content.targets, ...state.personalTargets].map((t) => t.id),
    ),
    topics = new Set(content.topics.map((t) => t.id));
  try {
    new Intl.DateTimeFormat("de", { timeZone: state.settings.timezone });
  } catch {
    throw new Error("Unbekannte Zeitzone in der Sicherung.");
  }
  for (const target of [...content.targets, ...state.personalTargets])
    if (!topics.has(target.ownerTopicId))
      throw new Error("Ein Lerninhalt verweist auf ein unbekanntes Thema.");
  for (const topic of topics)
    if (!state.preferences[topic])
      throw new Error("Themeneinstellungen fehlen in der Sicherung.");
  const exercises = [
    ...content.exercises,
    ...state.personalExercises,
    ...state.events.map((e) => e.exercise),
    ...(state.session?.queue.map((q) => q.exercise) ?? []),
  ];
  for (const e of exercises) {
    if (
      !targets.has(e.targetId) ||
      e.relatedTargetIds.some((id) => !targets.has(id))
    )
      throw new Error("Eine Aufgabe verweist auf fehlende Lerninhalte.");
    if (
      e.mode === "choice" &&
      (e.options.length < 3 ||
        new Set(e.options).size !== e.options.length ||
        !e.options.includes(e.answer))
    )
      throw new Error("Ungültige Auswahlaufgabe in der Sicherung.");
  }
  for (const key of Object.keys(state.memory)) {
    const index = key.lastIndexOf("~"),
      target = key.slice(0, index),
      channel = key.slice(index + 1);
    if (
      !targets.has(target) ||
      ![
        "productive_recall",
        "receptive_recall",
        "grammar_production",
        "grammar_recognition",
      ].includes(channel)
    )
      throw new Error("Ein Lernstand verweist auf unbekannte Inhalte.");
  }
  for (const id of Object.keys(state.participation))
    if (!targets.has(id))
      throw new Error(
        "Eine Teilnahmeentscheidung verweist auf fehlende Inhalte.",
      );
  for (const e of state.events) {
    if (e.targetId !== e.exercise.targetId)
      throw new Error("Widersprüchliche Lernhistorie.");
    if (
      e.exercise.mode === "choice" &&
      (!e.choice ||
        !e.exercise.options.includes(e.choice) ||
        e.good !== (e.choice === e.exercise.answer))
    )
      throw new Error("Widersprüchliche Auswahlbewertung.");
  }
  const lastTime = new Map<string, number>();
  for (const e of state.events.filter((e) => !e.revokedAt)) {
    const key = memoryKey(e.targetId, e.exercise.channel),
      at = Date.parse(e.at);
    if (at < (lastTime.get(key) ?? 0))
      throw new Error("Die Reihenfolge der Lernhistorie ist ungültig.");
    lastTime.set(key, at);
  }
  if (state.session) {
    const s = state.session;
    if (s.index > s.queue.length)
      throw new Error("Ungültige Sitzungsposition.");
    unique(
      s.queue.map((q) => q.attemptId),
      "Sitzung",
    );
    if (
      s.feedback &&
      !state.events.some(
        (e) =>
          e.id === s.feedback!.eventId &&
          !e.revokedAt &&
          e.sessionId === s.id &&
          e.index === s.index,
      )
    )
      throw new Error("Ungültiger Antwortstatus der Sitzung.");
  }
}
export async function parseBackup(raw: string): Promise<BackupPayload> {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES)
    throw new Error("Die Datei ist größer als 50 MB.");
  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error("Die Datei enthält kein gültiges JSON.");
  }
  if (!envelope || envelope.format !== "wortnah-backup")
    throw new Error("Das ist keine Wortnah-Sicherung.");
  if (envelope.schemaVersion !== 1)
    throw new Error("Diese Sicherung benötigt eine andere App-Version.");
  if (
    typeof envelope.checksum !== "string" ||
    (await sha256(envelope.payload)) !== envelope.checksum
  )
    throw new Error(
      "Die Prüfsumme stimmt nicht. Die Datei wurde verändert oder ist unvollständig.",
    );
  const result = payloadSchema.safeParse(envelope.payload);
  if (!result.success)
    throw new Error(
      "Die Sicherung enthält ungültige oder unvollständige Daten.",
    );
  validateRelations(result.data);
  return result.data;
}
export function restoredState(
  payload: BackupPayload,
  currentContent: Content,
): AppState {
  const state = structuredClone(payload.state);
  // Include imported content snapshots. This keeps histories and active sessions usable across content versions.
  state.personalTargets = payload.content.targets;
  state.personalExercises = payload.content.exercises;
  for (const t of currentContent.topics)
    state.preferences[t.id] ??= {
      mode: "paused",
      quota: 0,
      revision: 0,
      remainder: 0,
      day: "",
    };
  return state;
}
export function downloadText(
  text: string,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
