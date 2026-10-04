import DailyGoal from "./DailyGoal";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Layers3 } from "lucide-react";
import "./engagement.css";

const steps = [
  {
    title: "Einfach anfangen.",
    text: "Für Jugendliche und Erwachsene, die schon etwas Englisch können. Frische dein Wissen auf und werde sicherer in Alltag und Beruf. Du wählst deine Themen, die App plant passende Übungen. Ohne Konto, auch offline.",
  },
  {
    title: "Erst überlegen. Dann aufdecken.",
    text: "Versuche die Antwort selbst zu finden. Vergleiche sie anschließend mit der Lösung. Probier es hier kurz aus – diese Beispielkarte verändert deinen Lernstand nicht.",
  },
  {
    title: "Deine Themen. Dein Level.",
    text: "Unter Themen aktivierst du, was dich interessiert – zum Beispiel Reisen oder Gespräche. Ein Thema reicht zum Start. Wähle deinen Schwerpunkt von B1 bis C2; B1 ist voreingestellt. Einfachere A1-/A2-Inhalte bleiben zum Auffrischen dabei. Die Auswahl ist kein Sprachtest.",
  },
  {
    title: "Die App denkt beim Wiederholen mit.",
    text: "Nach deiner Antwort wählst du „Gewusst“ oder „Noch üben“. Bekannte Inhalte kommen später wieder, unsichere früher. Bei Auswahlaufgaben zählt die gewählte Lösung; Schreibaufgaben bewertest du selbst.",
  },
  {
    title: "Dein Tagesziel.",
    text: "Wähle dein Ziel. Unter Heute kannst du es jederzeit ändern.",
  },
];

export default function AppTour({
  dailyGoal,
  firstRun,
  busy,
  onFinish,
}: {
  dailyGoal: number;
  firstRun: boolean;
  busy: boolean;
  onFinish: (chooseTopics: boolean, dailyGoal?: number) => Promise<boolean>;
}) {
  const [goal, setGoal] = useState(dailyGoal);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);
  async function finish(chooseTopics = false, saveGoal = false) {
    if (!(await onFinish(chooseTopics, saveGoal ? goal : undefined)))
      setError(
        "Deine Auswahl konnte nicht gespeichert werden. Bitte versuche es noch einmal.",
      );
  }
  return (
    <div className={`app-tour ${step === 4 ? "goal-step" : ""}`}>
      <div
        className="tour-progress"
        aria-label={`Schritt ${step + 1} von ${steps.length}`}
      >
        {steps.map((s, index) => (
          <span key={s.title} className={index <= step ? "done" : ""} />
        ))}
        <span>
          {step + 1} / {steps.length}
        </span>
      </div>
      <div className="tour-content">
        {step === 0 && (
          <img
            className="tour-pip"
            src="/pip.svg"
            alt="Pip begleitet dich durch die Tour"
          />
        )}
        <h3 ref={heading} tabIndex={-1}>
          {steps[step].title}
        </h3>
        <p>{steps[step].text}</p>
        {step === 0 && (
          <div className="tour-note">
            <Check size={20} />
            <span>
              Fünf kurze Schritte. Überspringen ist jederzeit möglich.
            </span>
          </div>
        )}
        {step === 1 && (
          <div className="tour-example">
            <span className="small-label">BEISPIEL · IM RESTAURANT</span>
            <strong>Könnten wir bitte die Rechnung haben?</strong>
            {revealed ? (
              <div className="tour-answer" role="status">
                <strong>Could we have the bill, please?</strong>
                <p>
                  Gewusst? Oder noch üben? Beide Antworten helfen der App, deine
                  Wiederholungen zu planen.
                </p>
              </div>
            ) : (
              <button className="secondary" onClick={() => setRevealed(true)}>
                Beispiel aufdecken
              </button>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="tour-note">
            <Layers3 size={22} />
            <span>
              Aktive Themen liefern Karten. Inaktive Themen behalten ihren
              Lernstand. Im Wörterbuch schlägst du Wörter nach, im Archiv
              findest du beiseitegelegte Karten. Deinen Lernstand siehst du
              unter Fortschritt; deine Erfolge unter Meilensteine.
            </span>
          </div>
        )}
        {step === 3 && (
          <div className="tour-note">
            <BookOpen size={22} />
            <span>
              Schon eine beantwortete Karte zählt als Lerntag. „Speichern &
              pausieren“ hält deine Runde offen. „Runde beenden“ schließt sie
              ab; deine Antworten bleiben gespeichert.
            </span>
          </div>
        )}
        {step === 4 && (
          <DailyGoal value={goal} disabled={busy} onChange={setGoal} />
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="tour-actions">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void finish()}
        >
          Tour überspringen
        </button>
        <div className="button-row">
          {step > 0 && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} />
              Zurück
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              className="primary"
              disabled={busy}
              onClick={() => setStep(step + 1)}
            >
              Weiter
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void finish(firstRun, true)}
            >
              Ziel speichern
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
