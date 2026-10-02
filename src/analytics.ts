import {
  allTargets,
  targetInTopic,
  memoryKey,
  type AppState,
  type Channel,
  type Content,
  type ReviewEvent,
  type Target,
} from "./domain";
import { dayKey } from "./engine";

const DAY = 86_400_000;
export const learningStages = [
  "Einstieg",
  "Im Aufbau",
  "Wird sicherer",
  "Gut gefestigt",
] as const;
export type Period = 7 | 30 | "all";
export type TargetProgress = {
  target: Target;
  seen: boolean;
  consolidated: boolean;
  archived: boolean;
  due: boolean;
  channels: { channel: Channel; seen: boolean; consolidated: boolean }[];
  last: ReviewEvent | undefined;
  reason: string;
};
export type LearningSummary = ReturnType<typeof summarizeLearning>;
export type AnswerStats = ReturnType<typeof answerStats>;

export function shiftDay(day: string, offset: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + offset * DAY)
    .toISOString()
    .slice(0, 10);
}

// These are transparent course-progress criteria, not a CEFR assessment.
// An immediate retry never supplies independent evidence of retention.
function consolidatedChannel(
  events: ReviewEvent[],
  state: AppState,
  target: Target,
  channel: Channel,
  now: Date,
  eventDay: (event: ReviewEvent) => string,
) {
  const card = state.memory[memoryKey(target.id, channel)];
  if (
    !card ||
    card.state !== 2 ||
    card.stability < 14 ||
    Date.parse(card.due) < now.getTime()
  )
    return false;
  if (!card.last_review || Date.parse(card.last_review) > now.getTime())
    return false;
  const independent = events.filter(
    (e) => e.exercise.channel === channel && !e.retry,
  );
  const lastWrong = independent.findLastIndex((e) => !e.good);
  const successes = independent.slice(lastWrong + 1);
  if (successes.length < 3) return false;
  const days = new Set(successes.map(eventDay));
  return (
    days.size >= 3 &&
    Date.parse(successes.at(-1)!.at) - Date.parse(successes[0].at) >= 7 * DAY
  );
}

export function summarizeLearning(
  items: TargetProgress[],
  events: ReviewEvent[],
  eventDay: (event: ReviewEvent) => string,
) {
  const targetIds = new Set(items.map((item) => item.target.id));
  const evidence = events.filter((e) => targetIds.has(e.targetId) && !e.retry);
  const total = items.length;
  const seen = items.filter((item) => item.seen).length;
  const consolidated = items.filter((item) => item.consolidated).length;
  const days = new Set(evidence.map(eventDay)).size;
  const coverage = total ? consolidated / total : 0;
  const stage =
    coverage >= 0.7
      ? 3
      : coverage >= 0.25
        ? 2
        : seen >= Math.min(10, total) && days >= 3 && total > 0
          ? 1
          : 0;
  return {
    total,
    seen,
    consolidated,
    learning: seen - consolidated,
    unseen: total - seen,
    archived: items.filter((item) => item.archived).length,
    due: items.filter((item) => item.due).length,
    days,
    percent: Math.round(coverage * 100),
    stage,
    stageLabel: total ? learningStages[stage] : "Keine Inhalte",
  };
}

export function answerStats(events: ReviewEvent[]) {
  const independent = events.filter((e) => !e.retry);
  const metric = (subset: ReviewEvent[]) => ({
    count: subset.length,
    good: subset.filter((e) => e.good).length,
    percent: subset.length
      ? Math.round((subset.filter((e) => e.good).length / subset.length) * 100)
      : null,
  });
  return {
    attempts: events.length,
    retries: events.length - independent.length,
    recall: metric(independent.filter((e) => e.exercise.mode === "recall")),
    choice: metric(independent.filter((e) => e.exercise.mode === "choice")),
    channels: Object.fromEntries(
      (
        [
          "productive_recall",
          "receptive_recall",
          "grammar_production",
          "grammar_recognition",
        ] as Channel[]
      ).map((channel) => [
        channel,
        metric(independent.filter((e) => e.exercise.channel === channel)),
      ]),
    ) as Record<Channel, ReturnType<typeof metric>>,
  };
}

export function buildAnalytics(
  state: AppState,
  content: Content,
  now = new Date(),
  topicId = "",
  period: Period = 30,
) {
  const timezone = state.settings.timezone;
  const today = dayKey(now, timezone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayCache = new Map<string, string>();
  const eventDay = (event: ReviewEvent) => {
    let day = dayCache.get(event.at);
    if (!day) {
      const parts = formatter.formatToParts(new Date(event.at));
      day = ["year", "month", "day"]
        .map((type) => parts.find((p) => p.type === type)!.value)
        .join("-");
      dayCache.set(event.at, day);
    }
    return day;
  };
  const targets = allTargets(state, content);
  const targetIds = new Set(targets.map((t) => t.id));
  const events = state.events
    .filter(
      (e) =>
        !e.revokedAt &&
        targetIds.has(e.targetId) &&
        Date.parse(e.at) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const grouped = new Map<string, ReviewEvent[]>();
  for (const event of events) {
    const group = grouped.get(event.targetId) ?? [];
    group.push(event);
    grouped.set(event.targetId, group);
  }
  const items: TargetProgress[] = targets.map((target) => {
    const reviews = grouped.get(target.id) ?? [];
    const required: Channel[] =
      target.kind === "grammar"
        ? ["grammar_production", "grammar_recognition"]
        : ["productive_recall", "receptive_recall"];
    const channels = required.map((channel) => ({
      channel,
      seen: reviews.some((e) => e.exercise.channel === channel),
      consolidated: consolidatedChannel(
        reviews,
        state,
        target,
        channel,
        now,
        eventDay,
      ),
    }));
    const last = reviews.filter((e) => !e.retry).at(-1);
    const lastAny = reviews.at(-1);
    const archived = state.participation[target.id] === "archived";
    const active =
      content.topics.some(
        (topic) =>
          targetInTopic(target, topic.id) &&
          state.preferences[topic.id]?.mode !== "paused" &&
          (!archived || state.preferences[topic.id]?.quota > 0),
      ) &&
      (state.settings.mode === "mixed" ||
        (state.settings.mode === "grammar"
          ? target.kind === "grammar"
          : target.kind === "lexical"));
    const due =
      !!active &&
      required.some((channel) => {
        const card = state.memory[memoryKey(target.id, channel)];
        // The same sibling-burying rule as normal session planning.
        const siblingBuried =
          !archived &&
          lastAny &&
          eventDay(lastAny) === today &&
          lastAny.exercise.channel !== channel;
        return card && Date.parse(card.due) <= now.getTime() && !siblingBuried;
      });
    const consolidated = channels.every((c) => c.consolidated);
    const reason =
      last && !last.good
        ? "Zuletzt noch unsicher"
        : due
          ? "Wiederholung fällig"
          : !channels[0].seen
            ? target.kind === "grammar"
              ? "Selbst abrufen noch offen"
              : "Deutsch → Englisch noch offen"
            : !channels[1].seen
              ? target.kind === "grammar"
                ? "Auswahl noch offen"
                : "Englisch → Deutsch noch offen"
              : "Über mehrere Tage festigen";
    return {
      target,
      seen: reviews.length > 0,
      consolidated,
      archived,
      due,
      channels,
      last,
      reason,
    };
  });
  const summaries = content.topics.map((topic) => ({
    topic,
    ...summarizeLearning(
      items.filter((item) => targetInTopic(item.target, topic.id)),
      events,
      eventDay,
    ),
  }));
  const scoped = items.filter(
    (item) => !topicId || targetInTopic(item.target, topicId),
  );
  const scopedIds = new Set(scoped.map((item) => item.target.id));
  const scopedEvents = events.filter((e) => scopedIds.has(e.targetId));
  const start = period === "all" ? null : shiftDay(today, -(period - 1));
  const selectedEvents = scopedEvents.filter(
    (e) => !start || eventDay(e) >= start,
  );
  const chartDays = period === 7 ? 7 : 30;
  const counts = new Map<string, number>();
  for (const event of scopedEvents) {
    const day = eventDay(event);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const activity = Array.from({ length: chartDays }, (_, index) => {
    const day = shiftDay(today, index - chartDays + 1);
    return { day, count: counts.get(day) ?? 0 };
  });
  const focus = scoped
    .filter(
      (item) =>
        item.seen &&
        !item.archived &&
        !item.consolidated &&
        content.topics.some(
          (topic) =>
            targetInTopic(item.target, topic.id) &&
            state.preferences[topic.id]?.mode !== "paused",
        ),
    )
    .sort(
      (a, b) =>
        Number(b.last?.good === false) - Number(a.last?.good === false) ||
        Number(b.due) - Number(a.due),
    )
    .slice(0, 5);
  return {
    summary: summarizeLearning(scoped, scopedEvents, eventDay),
    topics: summaries,
    items: scoped,
    stats: answerStats(selectedEvents),
    activity,
    activeDays: new Set(selectedEvents.map(eventDay)).size,
    history: selectedEvents.slice(-12).reverse(),
    focus,
    today,
  };
}
