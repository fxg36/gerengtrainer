import { ArrowRight, Pencil } from "lucide-react";
import { useMemo } from "react";
import type { Content, Target } from "./domain";
import { dailyExpression } from "./daily-expression";

export default function DailyExpression({
  content,
  timezone,
  now,
  onOpen,
}: {
  content: Content;
  timezone: string;
  now: Date;
  onOpen: (target: Target) => void;
}) {
  const target = useMemo(
    () => dailyExpression(content, timezone, now),
    [content, timezone, now],
  );
  if (!target) return null;
  return (
    <section className="word-card" aria-label="Ausdruck des Tages">
      <div className="word-label">
        <Pencil size={16} /> AUSDRUCK DES TAGES
      </div>
      <h3>{target.word}</h3>
      <p className="word-translation">{target.de}</p>
      <div className="word-example">
        {target.example.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <p className="small muted">{target.senseContext?.de}</p>
      <button className="text-button" onClick={() => onOpen(target)}>
        Ausdruck entdecken <ArrowRight size={16} />
      </button>
      <p className="small muted">Wechselt täglich · auch offline</p>
    </section>
  );
}
