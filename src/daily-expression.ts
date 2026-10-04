import { targetInTopic, type Content } from "./domain";
import { dayKey } from "./learning-activity";

export function dailyExpression(
  content: Content,
  timezone: string,
  now = new Date(),
) {
  const pool = content.targets
    .filter(
      (target) =>
        target.kind === "lexical" &&
        target.pos === "phrase" &&
        targetInTopic(target, "phrases") &&
        target.example.includes("\n") &&
        target.senseContext?.de,
    )
    .sort((a, b) => a.id.localeCompare(b.id, "en"));
  if (!pool.length) return null;
  const day = Math.floor(
    Date.parse(`${dayKey(now, timezone)}T00:00:00Z`) / 86400000,
  );
  return pool[((day % pool.length) + pool.length) % pool.length];
}
