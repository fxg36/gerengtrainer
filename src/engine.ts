import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";
import {
  allTargets,
  allExercises,
  memoryKey,
  uid,
  type AppState,
  type Content,
  type MemoryCard,
  type QueueItem,
  type Target,
  type Session,
  type ReviewEvent,
} from "./domain";

const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false });
export const ENGINE = "ts-fsrs-5.4.2-retention-0.9" as const;
export function dayKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export function reviewCard(
  previous: MemoryCard | undefined,
  good: boolean,
  now: Date,
): MemoryCard {
  if (previous?.last_review && now.getTime() < Date.parse(previous.last_review))
    throw new Error(
      "Die Geräteuhr liegt vor deiner letzten Antwort. Bitte prüfe Datum und Uhrzeit.",
    );
  const card: Card = previous
    ? {
        ...previous,
        due: new Date(previous.due),
        last_review: previous.last_review
          ? new Date(previous.last_review)
          : undefined,
      }
    : createEmptyCard(now);
  const next = scheduler.next(
    card,
    now,
    good ? Rating.Good : Rating.Again,
  ).card;
  return {
    ...next,
    due: next.due.toISOString(),
    last_review: next.last_review?.toISOString(),
  };
}
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(values: T[], random: () => number) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function permitted(
  state: AppState,
  item: QueueItem,
  targets: Map<string, Target>,
  session: Session | null = state.session,
  now = new Date(),
): boolean {
  const target = targets.get(item.exercise.targetId);
  if (!target) return false;
  const pref = state.preferences[target.ownerTopicId];
  if (!pref) return false;
  const participation = state.participation[target.id] ?? "regular";
  if (participation === "excluded") return false;
  if (item.mode === "explicit_archive") {
    if (
      session?.archiveTopic !== target.ownerTopicId ||
      participation !== "archived"
    )
      return false;
  } else {
    if (pref.mode === "paused") return false;
    if (item.mode === "archive") {
      if (
        participation !== "archived" ||
        pref.quota === 0 ||
        pref.revision !== item.preferenceRevision ||
        session?.quotaPlan[target.ownerTopicId]?.day !==
          dayKey(now, state.settings.timezone)
      )
        return false;
    } else if (
      participation !== "regular" ||
      (pref.mode === "maintain" &&
        !state.memory[memoryKey(target.id, item.exercise.channel)])
    )
      return false;
  }
  return item.exercise.relatedTargetIds.every((id) => {
    const related = targets.get(id);
    if (!related) return false;
    const status = state.participation[id] ?? "regular";
    const rp = state.preferences[related.ownerTopicId];
    if (status === "excluded") return false;
    if (status === "archived")
      return (
        item.mode === "explicit_archive" &&
        related.ownerTopicId === session?.archiveTopic
      );
    return rp?.mode !== "paused";
  });
}
export function planSession(
  state: AppState,
  content: Content,
  now = new Date(),
  archiveTopic: string | null = null,
): Session {
  const targets = allTargets(state, content),
    targetMap = new Map(targets.map((t) => [t.id, t]));
  const seed = now.getTime() % 2147483647,
    random = seeded(seed),
    day = dayKey(now, state.settings.timezone);
  const session: Session = {
    id: uid(),
    createdAt: now.toISOString(),
    minutes: state.settings.minutes,
    seed,
    queue: [],
    index: 0,
    revealed: false,
    feedback: null,
    finished: false,
    archiveTopic,
    quotaCommitted: false,
    quotaPlan: {},
  };
  const topics = content.topics
    .filter((t) =>
      archiveTopic
        ? t.id === archiveTopic
        : state.preferences[t.id]?.mode !== "paused",
    )
    .filter(
      (t) =>
        state.settings.mode === "mixed" ||
        archiveTopic ||
        (state.settings.mode === "grammar"
          ? t.id === "grammar"
          : t.id !== "grammar"),
    );
  const slots = Math.min(
    100,
    Math.max(6, Math.floor(state.settings.minutes * 2)),
  );
  const budget = topics.length ? Math.floor(slots / topics.length) : 0;
  const active = state.events.filter(
    (e) => !e.revokedAt && e.mode === "regular",
  );
  const firstSeen = new Map<string, string>();
  for (const event of active)
    if (!firstSeen.has(event.targetId))
      firstSeen.set(event.targetId, event.day);
  let newWords = [...firstSeen].filter(
    ([id, d]) => d === day && targetMap.get(id)?.kind === "lexical",
  ).length;
  let newGrammar = [...firstSeen].filter(
    ([id, d]) => d === day && targetMap.get(id)?.kind === "grammar",
  ).length;
  const usedTargets = new Set<string>();
  const exercises = allExercises(state, content);
  const latest = new Map<string, string>();
  for (const e of active)
    latest.set(memoryKey(e.targetId, e.exercise.channel), e.exercise.id);
  const topicQueues: QueueItem[][] = [];
  for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
    const topic = topics[topicIndex],
      pref = state.preferences[topic.id];
    const remainingWordTopics = topics
      .slice(topicIndex)
      .filter(
        (t) => t.id !== "grammar" && state.preferences[t.id]?.mode === "learn",
      ).length;
    const topicNewLimit = remainingWordTopics
      ? Math.ceil(
          Math.max(0, state.settings.newPerDay - newWords) /
            remainingWordTopics,
        )
      : 0;
    let topicNewCount = 0;
    const topicBudget = budget + (topicIndex < slots % topics.length ? 1 : 0);
    const remainder = pref.day === day ? pref.remainder : 0,
      raw = (topicBudget * pref.quota) / 100 + remainder;
    const archiveCap = archiveTopic ? topicBudget : Math.floor(raw);
    session.quotaPlan[topic.id] = {
      revision: pref.revision,
      day,
      remainder: pref.quota ? raw - Math.floor(raw) : 0,
    };
    const groups = new Map<string, typeof exercises>();
    for (const e of exercises) {
      if (targetMap.get(e.targetId)?.ownerTopicId !== topic.id) continue;
      const key = memoryKey(e.targetId, e.channel);
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    const candidates = [...groups]
      .map(([key, variants]) => {
        const others = variants.filter((e) => e.id !== latest.get(key));
        const e = shuffle(others.length ? others : variants, random)[0];
        const p = state.participation[e.targetId] ?? "regular";
        const mode = archiveTopic
          ? "explicit_archive"
          : p === "archived"
            ? "archive"
            : "regular";
        const item: QueueItem = {
          attemptId: uid(),
          exercise: { ...e, options: shuffle(e.options, random) },
          mode,
          retryOf: null,
          preferenceRevision: pref.revision,
        };
        const card = state.memory[key];
        return { item, card, rank: card ? Date.parse(card.due) : Infinity };
      })
      .filter((c) => permitted(state, c.item, targetMap, session, now))
      .filter(
        (c) =>
          !c.card || Date.parse(c.card.due) <= now.getTime() || archiveTopic,
      );
    const due = shuffle(
      candidates.filter((c) => c.item.mode === "regular" && c.card),
      random,
    ).sort((a, b) => a.rank - b.rank);
    const archived = shuffle(
      candidates.filter((c) => c.item.mode !== "regular"),
      random,
    );
    const fresh = shuffle(
      candidates.filter((c) => c.item.mode === "regular" && !c.card),
      random,
    );
    const queue: QueueItem[] = [];
    const add = (c: (typeof candidates)[number]) => {
      if (
        queue.length >= topicBudget ||
        usedTargets.has(c.item.exercise.targetId)
      )
        return false;
      queue.push(c.item);
      usedTargets.add(c.item.exercise.targetId);
      return true;
    };
    due.forEach(add);
    let archiveAdded = 0;
    for (const candidate of archived) {
      if (archiveAdded >= archiveCap) break;
      if (add(candidate)) archiveAdded++;
    }
    if (pref.mode === "learn" && !archiveTopic)
      for (const c of fresh) {
        const t = targetMap.get(c.item.exercise.targetId)!,
          seen = firstSeen.has(t.id);
        if (
          !seen &&
          ((t.kind === "lexical" && newWords >= state.settings.newPerDay) ||
            (t.kind === "grammar" &&
              newGrammar >= state.settings.grammarPerDay))
        )
          continue;
        if (!seen && t.kind === "lexical" && topicNewCount >= topicNewLimit)
          continue;
        // Reduce introductions when the topic already has more due items than it can serve.
        if (due.length >= topicBudget) continue;
        if (add(c) && !seen) {
          firstSeen.set(t.id, day);
          if (t.kind === "lexical") {
            newWords++;
            topicNewCount++;
          } else newGrammar++;
        }
      }
    topicQueues.push(queue);
  }
  // Round-robin prevents one large topic from monopolising the session.
  for (let index = 0; topicQueues.some((q) => index < q.length); index++)
    for (const queue of topicQueues)
      if (queue[index]) session.queue.push(queue[index]);
  session.finished = !session.queue.length;
  return session;
}
export function normalizeSession(
  state: AppState,
  content: Content,
  now = new Date(),
) {
  const s = state.session;
  if (!s || s.finished || s.feedback) return;
  const targets = new Map(allTargets(state, content).map((t) => [t.id, t]));
  while (
    s.index < s.queue.length &&
    !permitted(state, s.queue[s.index], targets, s, now)
  )
    s.index++;
  if (s.index >= s.queue.length) s.finished = true;
}
export function commitReview(
  state: AppState,
  content: Content,
  attemptId: string,
  good: boolean,
  choice: string | null,
  now = new Date(),
) {
  const s = state.session;
  if (!s) throw new Error("Keine laufende Sitzung.");
  if (state.events.some((e) => e.id === attemptId && !e.revokedAt)) return;
  const item = s.queue[s.index];
  if (!item || item.attemptId !== attemptId || s.feedback || s.finished)
    throw new Error(
      "Die Aufgabe hat sich geändert. Bitte lade den aktuellen Stand.",
    );
  if (
    !permitted(
      state,
      item,
      new Map(allTargets(state, content).map((t) => [t.id, t])),
      s,
      now,
    )
  )
    throw new Error(
      "Diese Aufgabe ist inzwischen pausiert oder ausgeschlossen.",
    );
  if (item.exercise.mode === "recall" && !s.revealed)
    throw new Error("Bitte decke zuerst die Antwort auf.");
  if (item.exercise.mode === "choice") {
    if (!choice || !item.exercise.options.includes(choice))
      throw new Error("Ungültige Antwort.");
    good = choice === item.exercise.answer;
  }
  const key = memoryKey(item.exercise.targetId, item.exercise.channel);
  state.memory[key] = reviewCard(state.memory[key], good, now);
  const event: ReviewEvent = {
    id: attemptId,
    deviceId: state.deviceId,
    sessionId: s.id,
    targetId: item.exercise.targetId,
    exercise: item.exercise,
    index: s.index,
    at: now.toISOString(),
    day: dayKey(now, state.settings.timezone),
    good,
    choice,
    mode: item.mode,
    retry: !!item.retryOf,
    revokedAt: null,
    engine: ENGINE,
  };
  state.events.push(event);
  if (!s.quotaCommitted) {
    for (const [id, quota] of Object.entries(s.quotaPlan)) {
      const pref = state.preferences[id];
      if (
        pref?.revision === quota.revision &&
        quota.day === dayKey(now, state.settings.timezone)
      ) {
        pref.remainder = quota.remainder;
        pref.day = quota.day;
      }
    }
    s.quotaCommitted = true;
  }
  s.revealed = true;
  s.feedback = { good, eventId: attemptId, choice };
  // One retry at most; only with two intervening cards. Archive quotas cannot be enlarged by retries.
  if (
    !good &&
    item.mode === "regular" &&
    !item.retryOf &&
    s.queue.length - s.index > 2 &&
    !s.queue.some((q) => q.retryOf === attemptId)
  )
    s.queue.push({ ...item, attemptId: uid(), retryOf: attemptId });
}
export function undoReview(state: AppState, now = new Date()) {
  const s = state.session;
  if (!s) return;
  const event = state.events.findLast(
    (e) => !e.revokedAt && e.sessionId === s.id,
  );
  if (!event) return;
  event.revokedAt = now.toISOString();
  const key = memoryKey(event.targetId, event.exercise.channel);
  delete state.memory[key];
  for (const e of state.events.filter(
    (e) => !e.revokedAt && memoryKey(e.targetId, e.exercise.channel) === key,
  ))
    state.memory[key] = reviewCard(state.memory[key], e.good, new Date(e.at));
  s.queue = s.queue.filter((q) => q.retryOf !== event.id);
  s.index = event.index;
  s.revealed = true;
  s.feedback = null;
  s.finished = false;
  s.queue[s.index].attemptId = uid();
}
export function setParticipation(
  state: AppState,
  targetId: string,
  value: "regular" | "archived" | "excluded",
) {
  const before = state.participation[targetId] ?? "regular";
  state.participation[targetId] = value;
  state.policyHistory.push({
    id: uid(),
    at: new Date().toISOString(),
    kind: "participation",
    targetId,
    before,
    after: value,
  });
}
export function setTopic(
  state: AppState,
  id: string,
  change: Partial<Pick<AppState["preferences"][string], "mode" | "quota">>,
) {
  const p = state.preferences[id],
    before = JSON.stringify(p);
  Object.assign(p, change, { revision: p.revision + 1, remainder: 0, day: "" });
  state.policyHistory.push({
    id: uid(),
    at: new Date().toISOString(),
    kind: "topic",
    targetId: id,
    before,
    after: JSON.stringify(p),
  });
}
