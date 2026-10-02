import { useEffect, useId, useState } from "react";
import type { Exercise } from "./domain";
import { matchesModelAnswer } from "./writing";
import "./writing.css";

export default function WritingPractice({
  exercise,
  storedDraft,
  revealed,
  busy,
  onSave,
}: {
  exercise: Exercise;
  storedDraft: string;
  revealed: boolean;
  busy: boolean;
  onSave: (value: string, reveal: boolean) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(storedDraft);
  const id = useId();
  // Keep typing responsive; save the latest draft after a short pause. A
  // rejected/concurrent transaction gets another chance once busy clears.
  useEffect(() => {
    if (busy || revealed || draft === storedDraft) return;
    const timer = setTimeout(() => void onSave(draft, false), 250);
    return () => clearTimeout(timer);
  }, [draft, storedDraft, revealed, busy, onSave]);
  if (revealed)
    return (
      <div className="written-response">
        <span className="small-label">DEINE ANTWORT</span>
        <p lang="en">{storedDraft || "Keine Antwort eingegeben."}</p>
        <p className="small muted">
          {!storedDraft.trim()
            ? "Lies die Lösung und versuche es beim nächsten Mal selbst."
            : matchesModelAnswer(storedDraft, exercise)
              ? "Dein Text entspricht einer Musterlösung."
              : "Dein Text weicht von der Musterlösung ab. Andere richtige Formulierungen sind möglich; vergleiche Bedeutung und Satzbau."}
        </p>
      </div>
    );
  return (
    <div className="writing-practice">
      <label htmlFor={id}>
        {exercise.writing?.kind === "complete"
          ? "Deine Ergänzung"
          : "Dein englischer Satz"}
      </label>
      <textarea
        id={id}
        lang="en"
        rows={3}
        maxLength={4000}
        value={draft}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        aria-describedby={`${id}-save`}
        placeholder={
          exercise.writing?.kind === "complete"
            ? "Nur den fehlenden Teil schreiben …"
            : "Formuliere den vollständigen Satz …"
        }
        onChange={(event) => setDraft(event.currentTarget.value)}
      />
      <p id={`${id}-save`} className="small muted">
        {draft !== storedDraft
          ? "Entwurf wird gespeichert …"
          : "Dein Entwurf bleibt lokal gespeichert."}
      </p>
      <button
        className="primary reveal-button"
        disabled={busy || !draft.trim()}
        onClick={(event) => event.detail < 2 && void onSave(draft, true)}
      >
        Antwort vergleichen
      </button>
      <button
        className="text-button"
        disabled={busy}
        onClick={(event) => event.detail < 2 && void onSave(draft, true)}
      >
        Lösung ansehen
      </button>
    </div>
  );
}
