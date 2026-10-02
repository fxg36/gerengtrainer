import { useEffect, useId, useState } from "react";
import { sessionCapacity } from "./engine";

export default function TimeBudget({
  value,
  disabled = false,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (minutes: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const minutes = Math.max(1, Math.min(120, Math.round(Number(draft) || 1)));
  const save = () => {
    setDraft(String(minutes));
    if (minutes !== value) onChange(minutes);
  };
  return (
    <div className="time-budget">
      <div className="time-budget-value">
        <label htmlFor={id}>Zeit für eine Runde</label>
        <span>
          <input
            id={id}
            aria-label="Lernzeit in Minuten"
            type="number"
            min={1}
            max={120}
            step={1}
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          />
          Min.
        </span>
      </div>
      <input
        type="range"
        aria-label="Lernzeit"
        aria-describedby={`${id}-hint`}
        min={1}
        max={120}
        step={1}
        value={minutes}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onPointerUp={save}
        onKeyUp={save}
        onBlur={save}
      />
      <div className="time-budget-scale">
        <span>1 Min.</span>
        <span>2 Stunden</span>
      </div>
      <p id={`${id}-hint`} className="small muted">
        Bis zu {sessionCapacity(minutes)} Aufgaben, je nach verfügbarem Stoff.
        Die Zeit ist ein Richtwert. Du kannst jederzeit pausieren oder eine
        weitere Runde starten.
      </p>
    </div>
  );
}
