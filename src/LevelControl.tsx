import { useId, useLayoutEffect, useState } from "react";
import {
  learningLevels,
  trainingLevels,
  type LearningLevel,
  type Target,
} from "./domain";
import { levelDescriptions, withinLevel } from "./levels";
import "./levels.css";

export default function LevelControl({
  value,
  onChange,
  disabled = false,
  targets,
  label = "Dein Trainingslevel",
}: {
  value: LearningLevel;
  onChange: (level: LearningLevel) => void | Promise<boolean>;
  disabled?: boolean;
  targets: Target[];
  label?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const legacyBasics = !trainingLevels.includes(value);
  // Apply the saved value before another input event can edit the draft.
  useLayoutEffect(() => setDraft(value), [value]);
  const commit = async (level: LearningLevel) => {
    if (!trainingLevels.includes(level)) return;
    setDraft(level);
    if (level !== value && (await onChange(level)) === false) setDraft(value);
  };
  const included = targets.filter(
    (target) => target.level && withinLevel(target, draft),
  );
  const highest = learningLevels.findLast((level) =>
    included.some((target) => target.level === level),
  );
  const unclassified = targets.filter((target) => !target.level).length;
  return (
    <section className="level-control" aria-labelledby={`${id}-label`}>
      <div className="level-control-heading">
        <label id={`${id}-label`} htmlFor={legacyBasics ? undefined : id}>
          {label}
        </label>
        <strong>{draft}</strong>
      </div>
      <p className="level-description">{levelDescriptions[draft]}</p>
      <p id={`${id}-audience`} className="small muted level-audience">
        Dein Trainingsschwerpunkt beginnt bei B1 und reicht bis C2. Einfachere
        A1-/A2-Inhalte bleiben zum Auffrischen dabei.
        {legacyBasics &&
          ` Deine bisherige ${value}-Einstellung bleibt erhalten, bis du eine Stufe ab B1 wählst.`}
      </p>
      {!legacyBasics && (
        <input
          id={id}
          type="range"
          min={0}
          max={trainingLevels.length - 1}
          step={1}
          value={trainingLevels.indexOf(draft)}
          disabled={disabled}
          aria-valuetext={`${draft} – ${levelDescriptions[draft]}`}
          aria-describedby={`${id}-audience ${id}-hint`}
          onChange={(e) => setDraft(trainingLevels[Number(e.target.value)])}
          onPointerUp={(e) =>
            void commit(trainingLevels[Number(e.currentTarget.value)])
          }
          onKeyUp={(e) =>
            void commit(trainingLevels[Number(e.currentTarget.value)])
          }
          onBlur={(e) =>
            void commit(trainingLevels[Number(e.currentTarget.value)])
          }
        />
      )}
      <div className="level-ticks" aria-label="Stufe auswählen">
        {trainingLevels.map((level) => (
          <button
            key={level}
            type="button"
            disabled={disabled}
            aria-pressed={draft === level}
            onClick={() => void commit(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <p id={`${id}-hint`} className="small muted">
        Neue Inhalte: etwa 60 % Schwerpunkt und 40 % leichtere Stufen.
        Wiederholungen richten sich nach deinen Antworten. Gilt ab der nächsten
        Runde.
      </p>
      <p className="level-stock small">
        <strong>
          {included.length} Lernziele bis {draft}
        </strong>{" "}
        im aktuellen Bestand.
        {unclassified > 0 && ` Dazu ${unclassified} eigene Inhalte ohne Stufe.`}
        {highest !== draft &&
          (highest
            ? ` Für ${draft} gibt es hier noch keine eigenen Ziele; dein Schwerpunkt liegt derzeit auf ${highest}.`
            : " Für diese Stufe sind hier noch keine eingeordneten Ziele vorhanden.")}
      </p>
      <details className="level-explanation small muted">
        <summary>Wie wird gemischt?</summary>
        <p>
          Wenn genug neue Inhalte vorhanden sind, ungefähr drei Aufgaben auf
          deiner Stufe und zwei leichtere. Fehlt Stoff auf deiner Stufe, rücken
          vorhandene niedrigere Stufen nach. Du musst keine Quoten einstellen.
        </p>
        <p>
          Gut erinnerte Inhalte bekommen längere Abstände. Fällige
          Wiederholungen gehen vor neuen Inhalten, unsichere innerhalb eines
          Themas zuerst. Die Mischung passt sich deshalb dem verfügbaren Stoff
          an. Archivierte Inhalte kommen nur über deine Archivquote oder ein
          Archivtraining zurück.
        </p>
        <p>
          Die Stufen der Inhalte sind vorläufige redaktionelle Einordnungen im
          Lernbestand. Die Auswahl ist kein Nachweis deines Sprachniveaus.
          Archivieren zählt nicht als Übung oder Lernerfolg.
        </p>
      </details>
    </section>
  );
}
