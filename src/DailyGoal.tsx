import { useId, useLayoutEffect, useState } from "react";
import {
  dailyGoalRules,
  goalGuidance,
  goalAtPosition,
  goalPosition,
  adjacentGoal,
} from "./learning-goal";
import "./learning-goal.css";

export default function DailyGoal({
  value,
  disabled = false,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (cards: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useLayoutEffect(() => setDraft(value), [value]);
  const guidance = goalGuidance(draft);
  const save = () => {
    if (draft !== value) onChange(draft);
  };
  return (
    <div className="daily-goal-control">
      <div className="daily-goal-label">
        <label htmlFor={id}>Dein Tagesziel</label>
        <span className="daily-goal-value">
          <strong>{draft}</strong> Karten / Tag
        </span>
      </div>
      <div className="daily-goal-track">
        <span className="daily-goal-suggestion" aria-hidden="true" />
        <input
          id={id}
          type="range"
          aria-label="Tagesziel in Karten"
          aria-describedby={`${id}-guide ${id}-hint`}
          min={0}
          max={100}
          step={0.1}
          value={goalPosition(draft)}
          aria-valuemin={dailyGoalRules.min}
          aria-valuemax={dailyGoalRules.max}
          aria-valuenow={draft}
          aria-valuetext={`${draft} Karten pro Tag`}
          disabled={disabled}
          onChange={(event) =>
            setDraft(goalAtPosition(Number(event.target.value)))
          }
          onKeyDown={(event) => {
            if (
              ![
                "ArrowLeft",
                "ArrowDown",
                "ArrowRight",
                "ArrowUp",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(event.key)
            )
              return;
            event.preventDefault();
            const direction = ["ArrowLeft", "ArrowDown", "PageDown"].includes(
              event.key,
            )
              ? -1
              : 1;
            setDraft((current) =>
              event.key === "Home"
                ? dailyGoalRules.min
                : event.key === "End"
                  ? dailyGoalRules.max
                  : event.key.startsWith("Page")
                    ? adjacentGoal(adjacentGoal(current, direction), direction)
                    : adjacentGoal(current, direction),
            );
          }}
          onPointerUp={save}
          onKeyUp={save}
          onBlur={save}
        />
      </div>
      <div className="daily-goal-scale" aria-hidden="true">
        <span style={{ left: "0%" }}>30</span>
        <span style={{ left: "30%" }}>50</span>
        <span style={{ left: "70%" }}>80</span>
        <span style={{ left: "100%" }}>250</span>
      </div>
      <p className="daily-goal-range">50–80 Karten · unser Startvorschlag</p>
      <div
        id={`${id}-guide`}
        className="daily-goal-guidance"
        aria-live="polite"
      >
        <strong>{guidance.title}</strong>
        <p>{guidance.text}</p>
      </div>
      <p id={`${id}-hint`} className="small muted">
        Dein persönliches Ziel, keine Sperre. Neue Karten und Wiederholungen
        zählen gemeinsam. Du kannst jederzeit aufhören.
      </p>
      <details className="daily-goal-research small">
        <summary>Wie sind diese Bereiche begründet?</summary>
        <p>
          Die Forschung unterstützt verteiltes Üben und aktives Erinnern. Eine
          allgemein optimale Kartenzahl pro Tag lässt sich daraus nicht
          ableiten. Unsere Bereiche sind Vorschläge zum Ausprobieren, keine
          wissenschaftlichen Mindestmengen.
        </p>
        <a
          href="https://www.nature.com/articles/s44159-022-00089-1"
          target="_blank"
          rel="noreferrer"
        >
          Forschungsübersicht: Spacing & Retrieval Practice (2022)
        </a>
      </details>
    </div>
  );
}
