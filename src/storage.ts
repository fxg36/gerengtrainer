import { openDB } from "idb";
import { initialState, stateSchema, type AppState, type Topic } from "./domain";

const dbPromise = openDB("wortnah", 1, {
  upgrade(db) {
    db.createObjectStore("state");
    db.createObjectStore("recovery");
  },
});
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("wortnah-state");
const listeners = new Set<() => void>();
channel?.addEventListener("message", () => listeners.forEach((fn) => fn()));
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notify() {
  listeners.forEach((fn) => fn());
  channel?.postMessage("changed");
}
export async function loadState(topics: Topic[]): Promise<AppState> {
  const db = await dbPromise,
    tx = db.transaction("state", "readwrite");
  const stored = await tx.store.get("current");
  const state = stored ? stateSchema.parse(stored) : initialState(topics);
  const newTopics = topics.filter((topic) => !state.preferences[topic.id]);
  for (const topic of newTopics)
    state.preferences[topic.id] = {
      mode: "paused",
      level: null,
      quota: 0,
      revision: 0,
      remainder: 0,
      day: "",
    };
  const migrated =
    stored &&
    (newTopics.length > 0 ||
      Object.keys(state.preferences).some(
        (id) => state.preferences[id].mode !== stored.preferences[id]?.mode,
      ) ||
      Object.keys(state.participation).some(
        (id) => state.participation[id] !== stored.participation[id],
      ));
  if (migrated) {
    state.revision++;
    state.updatedAt = new Date().toISOString();
  }
  if (!stored || migrated) {
    await tx.store.put(state, "current");
  }
  await tx.done;
  if (migrated) notify();
  return state;
}
export async function mutateState(
  expectedRevision: number,
  mutate: (state: AppState) => void,
): Promise<AppState> {
  const db = await dbPromise,
    tx = db.transaction("state", "readwrite");
  const stored = await tx.store.get("current");
  if (stored.revision !== expectedRevision) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(
      "Dein Lernstand wurde in einem anderen Fenster geändert. Der aktuelle Stand wurde geladen; bitte wiederhole die Aktion.",
    );
  }
  try {
    const state = stateSchema.parse(stored);
    mutate(state);
    state.revision++;
    state.updatedAt = new Date().toISOString();
    const valid = stateSchema.parse(state);
    await tx.store.put(valid, "current");
    await tx.done;
    notify();
    return valid;
  } catch (error) {
    try {
      tx.abort();
    } catch {}
    await tx.done.catch(() => {});
    throw error;
  }
}
export async function replaceState(
  incoming: AppState,
  expectedRevision: number,
): Promise<AppState> {
  const valid = stateSchema.parse(incoming),
    db = await dbPromise,
    tx = db.transaction(["state", "recovery"], "readwrite");
  const current: AppState = await tx.objectStore("state").get("current");
  if (current.revision !== expectedRevision) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(
      "Der Lernstand hat sich geändert. Bitte öffne die Importvorschau erneut.",
    );
  }
  valid.deviceId = current.deviceId;
  valid.revision = current.revision + 1;
  valid.updatedAt = new Date().toISOString();
  await tx.objectStore("recovery").put(current, "before-import");
  await tx.objectStore("state").put(valid, "current");
  await tx.done;
  notify();
  return valid;
}
export async function getRecovery(): Promise<AppState | null> {
  const stored = await (await dbPromise).get("recovery", "before-import");
  return stored ? stateSchema.parse(stored) : null;
}
export async function deleteLocalProfile(
  topics: Topic[],
  expectedRevision: number,
): Promise<AppState> {
  const db = await dbPromise,
    tx = db.transaction(["state", "recovery"], "readwrite");
  const current: AppState = await tx.objectStore("state").get("current");
  if (current.revision !== expectedRevision) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(
      "Der Stand hat sich geändert. Bitte prüfe ihn vor dem Löschen erneut.",
    );
  }
  const fresh = initialState(topics);
  fresh.revision = current.revision + 1;
  await tx.objectStore("state").clear();
  await tx.objectStore("recovery").clear();
  await tx.objectStore("state").put(fresh, "current");
  await tx.done;
  notify();
  return fresh;
}
