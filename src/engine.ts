import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";
import { effectiveLevel, mixFreshByLevel } from "./levels";
import {
  chooseFreshDirections,
  topicBudgets,
  trainingFocus,
} from "./training-focus";
import {
  allTargets,
  allExercises,
  targetInTopic,
  targetInSubtopic,
  ALL_ARCHIVE_TOPICS,
  memoryKey,
  uid,
  withExerciseCues,
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
export const sessionCapacity = (minutes: number) =>
  Math.min(240, Math.max(6, Math.floor(minutes * 2)));
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
  if (session?.topicId && !targetInTopic(target, session.topicId)) return false;
  if (session?.subtopicId && !targetInSubtopic(target, session.subtopicId))
    return false;
  const policyTopic = item.topicId ?? target.ownerTopicId;
  if (
    !targetInTopic(target, policyTopic) ||
    (session?.topicId && policyTopic !== session.topicId)
  )
    return false;
  const pref = state.preferences[policyTopic];
  if (!pref || pref.mode !== "learn") return false;
  const participation = state.participation[target.id] ?? "regular";
  if (item.mode === "explicit_archive") {
    if (
      (session?.archiveTopic !== ALL_ARCHIVE_TOPICS &&
        (!session?.archiveTopic ||
          !targetInTopic(target, session.archiveTopic))) ||
      participation !== "archived"
    )
      return false;
  } else {
    if (item.mode === "archive") {
      if (
        participation !== "archived" ||
        pref.quota === 0 ||
        pref.revision !== item.preferenceRevision ||
        session?.quotaPlan[policyTopic]?.day !==
          dayKey(now, state.settings.timezone)
      )
        return false;
    } else if (participation !== "regular") return false;
  }
  return item.exercise.relatedTargetIds.every((id) => {
    const related = targets.get(id);
    if (!related) return false;
    const status = state.participation[id] ?? "regular";
    const rp =
      state.preferences[
        targetInTopic(related, policyTopic) ? policyTopic : related.ownerTopicId
      ];
    if (!rp || rp.mode !== "learn") return false;
    if (status === "archived")
      return (
        item.mode === "explicit_archive" &&
        (session?.archiveTopic === ALL_ARCHIVE_TOPICS ||
          (!!session?.archiveTopic &&
            targetInTopic(related, session.archiveTopic)))
      );
    return true;
  });
}
export function planSession(
  state: AppState,
  content: Content,
  now = new Date(),
  archiveTopic: string | null = null,
  topicId: string | null = null,
  subtopicId: string | null = null,
): Session {
  if (archiveTopic && topicId)
    throw new Error("Bitte wähle eine Trainingsart.");
  if (topicId && !content.topics.some((t) => t.id === topicId))
    throw new Error("Dieses Thema ist nicht verfügbar.");
  if (
    subtopicId &&
    (!topicId ||
      !content.topics
        .find((t) => t.id === topicId)
        ?.subtopics?.some((s) => s.id === subtopicId))
  )
    throw new Error("Dieses Unterthema ist nicht verfügbar.");
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
    topicId,
    subtopicId,
    quotaCommitted: false,
    quotaPlan: {},
  };
  const topics = content.topics
    .filter((t) => state.preferences[t.id]?.mode === "learn")
    .filter((t) =>
      archiveTopic
        ? archiveTopic === ALL_ARCHIVE_TOPICS
          ? targets.some(
              (target) =>
                targetInTopic(target, t.id) &&
                state.participation[target.id] === "archived",
            )
          : t.id === archiveTopic
        : topicId
          ? t.id === topicId
          : state.preferences[t.id]?.mode !== "paused",
    )
    .filter(
      (t) =>
        state.settings.mode === "mixed" ||
        archiveTopic ||
        topicId ||
        (state.settings.mode === "grammar"
          ? t.id === "grammar"
          : t.id !== "grammar"),
    );
  const slots = sessionCapacity(state.settings.minutes);
  const wordLimit = state.settings.limitNewPerDay
    ? state.settings.newPerDay
    : Infinity;
  const grammarLimit = state.settings.limitNewPerDay
    ? state.settings.grammarPerDay
    : Infinity;
  const focus = trainingFocus(state.events, now);
  const budgets = topicBudgets(
    slots,
    topics.map((topic) => {
      if (archiveTopic) return 1;
      const channels =
        topic.id === "grammar"
          ? (["grammar_production", "grammar_recognition"] as const)
          : (["productive_recall", "receptive_recall"] as const);
      return (
        channels.reduce((sum, channel) => sum + focus[channel].weight, 0) /
        channels.length
      );
    }),
  );
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
  const lastDay = new Map<string, string>();
  const lastChannel = new Map<string, string>();
  const lastPrompt = new Map<string, string>();
  for (const e of state.events.filter((e) => !e.revokedAt)) {
    lastDay.set(e.targetId, e.day);
    lastChannel.set(e.targetId, e.exercise.channel);
    lastPrompt.set(e.targetId, e.exercise.prompt);
  }
  for (const e of active)
    latest.set(memoryKey(e.targetId, e.exercise.channel), e.exercise.id);
  const topicQueues: QueueItem[][] = [];
  const fillTopic: (() => boolean)[] = [];
  for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
    const topic = topics[topicIndex],
      pref = state.preferences[topic.id];
    const remainingWordTopics = topics
      .slice(topicIndex)
      .filter(
        (t) => t.id !== "grammar" && state.preferences[t.id]?.mode === "learn",
      ).length;
    const topicNewLimit = remainingWordTopics
      ? Math.ceil(Math.max(0, wordLimit - newWords) / remainingWordTopics)
      : 0;
    let topicNewCount = 0;
    let topicBudget = budgets[topicIndex];
    const remainder = pref.day === day ? pref.remainder : 0,
      raw = (topicBudget * pref.quota) / 100 + remainder;
    const archiveCap = archiveTopic ? topicBudget : Math.floor(raw);
    if (!archiveTopic)
      session.quotaPlan[topic.id] = {
        revision: pref.revision,
        day,
        remainder: pref.quota ? raw - Math.floor(raw) : 0,
      };
    const groups = new Map<string, typeof exercises>();
    for (const e of exercises) {
      const target = targetMap.get(e.targetId);
      if (
        !target ||
        !targetInTopic(target, topic.id) ||
        (subtopicId && !targetInSubtopic(target, subtopicId))
      )
        continue;
      const key = memoryKey(e.targetId, e.channel);
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    const candidates = [...groups]
      .map(([key, variants]) => {
        const writingVariants = variants.filter((e) => e.writing);
        const availableVariants = writingVariants.length
          ? writingVariants
          : variants;
        const differentPrompt = availableVariants.filter(
          (e) => e.prompt !== lastPrompt.get(e.targetId),
        );
        const others = differentPrompt.length
          ? differentPrompt
          : availableVariants.filter((e) => e.id !== latest.get(key));
        const e = shuffle(
          others.length ? others : availableVariants,
          random,
        )[0];
        const p = state.participation[e.targetId] ?? "regular";
        const mode = archiveTopic
          ? "explicit_archive"
          : p === "archived"
            ? "archive"
            : "regular";
        const item: QueueItem = {
          attemptId: uid(),
          topicId: topic.id,
          exercise: { ...e, options: shuffle(e.options, random) },
          mode,
          retryOf: null,
          preferenceRevision: pref.revision,
        };
        const card = state.memory[key];
        return {
          item,
          card,
          rank: card ? Date.parse(card.due) : Infinity,
          // Only due cards reach the review queue. Among them, prioritise
          // estimated forgetting risk rather than raw calendar age alone.
          recall: card ? scheduler.get_retrievability(card, now, false) : 1,
        };
      })
      .filter((c) => permitted(state, c.item, targetMap, session, now))
      .filter(
        (c) =>
          !c.card || Date.parse(c.card.due) <= now.getTime() || archiveTopic,
      )
      .filter(
        // Bury sibling directions for this learning day. Actual due reviews
        // of the direction just practised retain their FSRS schedule.
        (c) =>
          c.item.mode !== "regular" ||
          lastDay.get(c.item.exercise.targetId) !== day ||
          (c.card &&
            lastChannel.get(c.item.exercise.targetId) ===
              c.item.exercise.channel),
      );
    const due = shuffle(
      candidates.filter((c) => c.item.mode === "regular" && c.card),
      random,
    ).sort(
      (a, b) =>
        (1 - b.recall) * focus[b.item.exercise.channel].weight -
          (1 - a.recall) * focus[a.item.exercise.channel].weight ||
        a.rank - b.rank,
    );
    const archived = shuffle(
      candidates.filter((c) => c.item.mode !== "regular"),
      random,
    );
    const fresh = mixFreshByLevel(
      chooseFreshDirections(
        shuffle(
          candidates
            .filter((c) => c.item.mode === "regular" && !c.card)
            .filter(
              (c, _, freshCandidates) =>
                // Introduce a writing-enabled goal through active production first.
                // Recognition remains independently schedulable once production exists.
                c.item.exercise.channel !== "grammar_recognition" ||
                !!state.memory[
                  memoryKey(c.item.exercise.targetId, "grammar_production")
                ] ||
                !freshCandidates.some(
                  (other) =>
                    other.item.exercise.targetId === c.item.exercise.targetId &&
                    !!other.item.exercise.writing,
                ),
            ),
          random,
        ),
        (candidate) => candidate.item.exercise,
        focus,
        random,
      ),
      (c) => targetMap.get(c.item.exercise.targetId)!,
      effectiveLevel(state, topic.id),
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
    const addFresh = (c: (typeof candidates)[number], fairShare: boolean) => {
      if (archiveTopic || pref.mode !== "learn") return false;
      const t = targetMap.get(c.item.exercise.targetId)!,
        seen = firstSeen.has(t.id);
      if (
        !seen &&
        ((t.kind === "lexical" && newWords >= wordLimit) ||
          (t.kind === "grammar" && newGrammar >= grammarLimit))
      )
        return false;
      if (
        fairShare &&
        !seen &&
        t.kind === "lexical" &&
        topicNewCount >= topicNewLimit
      )
        return false;
      // Reduce introductions when the topic already has more due items than it can serve.
      if (due.some((d) => !usedTargets.has(d.item.exercise.targetId)))
        return false;
      if (!add(c)) return false;
      if (!seen) {
        firstSeen.set(t.id, day);
        if (t.kind === "lexical") {
          newWords++;
          topicNewCount++;
        } else newGrammar++;
      }
      return true;
    };
    fresh.forEach((c) => addFresh(c, true));
    topicQueues.push(queue);
    fillTopic.push(() => {
      topicBudget++;
      const added =
        due.some(add) ||
        (archiveTopic
          ? archived.some(add)
          : fresh.some((c) => addFresh(c, false)));
      if (!added) topicBudget--;
      return !!added;
    });
  }
  // Empty/small topics must not leave usable slots in a larger batch unfilled.
  // Automatic archive caps stay fixed; spare slots go to regular practice only.
  let remaining =
    slots - topicQueues.reduce((sum, queue) => sum + queue.length, 0);
  while (remaining > 0) {
    let added = false;
    for (const fill of fillTopic) {
      if (!remaining) break;
      if (fill()) {
        remaining--;
        added = true;
      }
    }
    if (!added) break;
  }
  // Round-robin prevents one large topic from monopolising the session.
  for (let index = 0; topicQueues.some((q) => index < q.length); index++)
    for (const queue of topicQueues)
      if (queue[index]) session.queue.push(queue[index]);
  const duePriority = (item: QueueItem) =>
    item.mode === "regular" &&
    state.memory[memoryKey(item.exercise.targetId, item.exercise.channel)]
      ? 0
      : 1;
  session.queue.sort((a, b) => duePriority(a) - duePriority(b));
  session.finished = !session.queue.length;
  return session;
}
export function sessionScope(
  session: Pick<Session, "archiveTopic" | "topicId"> & {
    subtopicId?: string | null;
  },
) {
  return session.archiveTopic
    ? `archive:${session.archiveTopic}`
    : session.topicId
      ? `topic:${session.topicId}:${session.subtopicId ?? "all"}`
      : "mixed";
}
export function findSession(
  state: AppState,
  archiveTopic: string | null = null,
  topicId: string | null = null,
  subtopicId: string | null = null,
) {
  const scope = sessionScope({ archiveTopic, topicId, subtopicId });
  return [state.session, ...(state.savedSessions ?? [])].find(
    (s): s is Session => !!s && !s.finished && sessionScope(s) === scope,
  );
}
export function sessionTopicInactive(
  state: AppState,
  session: Pick<Session, "topicId" | "archiveTopic">,
) {
  const id = session.topicId ?? session.archiveTopic;
  return (
    !!id && id !== ALL_ARCHIVE_TOPICS && state.preferences[id]?.mode !== "learn"
  );
}
// Keep one unfinished round per scope. History and memory are shared across all
// rounds; switching views never clones learning evidence or loses a queue.
export function openSession(
  state: AppState,
  content: Content,
  now = new Date(),
  archiveTopic: string | null = null,
  topicId: string | null = null,
  subtopicId: string | null = null,
) {
  if (sessionTopicInactive(state, { topicId, archiveTopic }))
    throw new Error("Aktiviere dieses Thema zuerst unter Themen.");
  const next =
    findSession(state, archiveTopic, topicId, subtopicId) ??
    planSession(state, content, now, archiveTopic, topicId, subtopicId);
  const saved = (state.savedSessions ?? []).filter(
    (s) => !s.finished && sessionScope(s) !== sessionScope(next),
  );
  if (
    state.session &&
    !state.session.finished &&
    sessionScope(state.session) !== sessionScope(next)
  )
    saved.push(state.session);
  state.savedSessions = saved;
  state.session = next;
  normalizeSession(state, content, now);
}

function reviewedElsewhere(
  state: AppState,
  item: QueueItem,
  session: Session,
  now: Date,
) {
  // An explicit archive round is a deliberate request to practise again.
  if (item.mode === "explicit_archive") return false;
  const event = state.events.findLast(
    (e) =>
      !e.revokedAt &&
      e.targetId === item.exercise.targetId &&
      e.sessionId !== session.id &&
      e.at >= session.createdAt,
  );
  if (!event) return false;
  const card =
    state.memory[memoryKey(item.exercise.targetId, item.exercise.channel)];
  return (
    (card && Date.parse(card.due) > now.getTime()) ||
    (event.day === dayKey(now, state.settings.timezone) &&
      event.exercise.channel !== item.exercise.channel)
  );
}
export function normalizeSession(
  state: AppState,
  content: Content,
  now = new Date(),
) {
  const s = state.session;
  if (!s || s.finished) return;
  // Turning a focused topic off blocks practice without consuming its queue.
  if (sessionTopicInactive(state, s)) return;
  // Commit and advance are persisted in the same state transaction. This also
  // resumes v1 backups left on the former confirmation screen exactly once.
  if (s.feedback) {
    s.index++;
    s.revealed = false;
    s.feedback = null;
  }
  const targets = new Map(allTargets(state, content).map((t) => [t.id, t]));
  const introduced = new Map<string, string>();
  for (const event of state.events)
    if (
      !event.revokedAt &&
      event.mode === "regular" &&
      !introduced.has(event.targetId)
    )
      introduced.set(event.targetId, event.day);
  const today = dayKey(now, state.settings.timezone);
  const newToday = { lexical: 0, grammar: 0 };
  for (const [id, day] of introduced) {
    const target = targets.get(id);
    if (target && day === today) newToday[target.kind]++;
  }
  const limitReached = (item: QueueItem) => {
    if (
      !state.settings.limitNewPerDay ||
      item.mode !== "regular" ||
      introduced.has(item.exercise.targetId)
    )
      return false;
    const target = targets.get(item.exercise.targetId);
    if (!target) return false;
    return (
      newToday[target.kind] >=
      (target.kind === "lexical"
        ? state.settings.newPerDay
        : state.settings.grammarPerDay)
    );
  };
  while (
    s.index < s.queue.length &&
    (!permitted(state, s.queue[s.index], targets, s, now) ||
      reviewedElsewhere(state, s.queue[s.index], s, now) ||
      limitReached(s.queue[s.index]))
  ) {
    s.index++;
    s.revealed = false;
  }
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
      "Diese Aufgabe gehört nicht mehr zu dieser Trainingsrunde.",
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
    exercise: withExerciseCues(item.exercise, content),
    index: s.index,
    at: now.toISOString(),
    day: dayKey(now, state.settings.timezone),
    good,
    choice,
    writtenAnswer: withExerciseCues(item.exercise, content).writing
      ? (item.draftAnswer ?? "")
      : undefined,
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
    s.queue.push({
      ...item,
      attemptId: uid(),
      retryOf: attemptId,
      draftAnswer: undefined,
    });
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
  value: AppState["participation"][string],
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
  change: Partial<
    Pick<AppState["preferences"][string], "mode" | "quota" | "level">
  >,
) {
  const p = state.preferences[id],
    before = JSON.stringify(p);
  Object.assign(
    p,
    change,
    // Level changes apply to the next plan; keep the current archive allocation.
    "mode" in change || "quota" in change
      ? { revision: p.revision + 1, remainder: 0, day: "" }
      : {},
  );
  state.policyHistory.push({
    id: uid(),
    at: new Date().toISOString(),
    kind: "topic",
    targetId: id,
    before,
    after: JSON.stringify(p),
  });
}
