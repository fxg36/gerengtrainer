import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import type { AppState, Content } from "./domain";
import {
  recommendLevel,
  type LevelRecommendation,
} from "./level-recommendation";
import "./level-suggestion.css";

export default function LevelSuggestion({
  state,
  content,
  day,
  busy,
  onAccept,
  onLater,
}: {
  state: AppState;
  content: Content;
  day: string;
  busy: boolean;
  onAccept: (suggestion: LevelRecommendation) => void;
  onLater: (suggestion: LevelRecommendation) => void;
}) {
  const suggestion = useMemo(
    () => recommendLevel(state, content),
    [state, content, day],
  );
  if (!suggestion) return null;
  return (
    <section
      className="level-suggestion"
      aria-label="Empfehlung zum Trainingslevel"
    >
      <TrendingUp size={24} aria-hidden="true" />
      <div>
        <h2>Bereit für {suggestion.to}?</h2>
        <p>
          {suggestion.topic ? `${suggestion.topic}: ` : ""}Deine letzten{" "}
          {suggestion.count} Antworten auf {suggestion.from} waren zu{" "}
          {Math.round((suggestion.correct / suggestion.count) * 100)} % richtig
          – über {suggestion.days} Lerntage. Möchtest du anspruchsvollere Karten
          ausprobieren? Die Empfehlung stützt sich auf {suggestion.basis}.
        </p>
        <div className="button-row">
          <button
            className="primary"
            disabled={busy}
            onClick={() => onAccept(suggestion)}
          >
            {suggestion.to} ausprobieren
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => onLater(suggestion)}
          >
            Später
          </button>
        </div>
        <details className="small muted">
          <summary>Worauf beruht der Vorschlag?</summary>
          <p>
            Mindestens 40 Antworten zu 20 verschiedenen Lernzielen an drei
            Lerntagen – bei kleinerem Bestand zu allen verfügbaren Zielen.
            Mindestens 90 % richtig, mit sicheren Antworten in beiden
            Richtungen. Mindestens fünf Inhalte wurden an mehreren Tagen geübt.
            Wir betrachten die letzten 30 Tage; Nachversuche und Archivtraining
            zählen dafür nicht.
          </p>
          <p>
            Das ist ein Vorschlag für die Schwierigkeit, keine Sprachprüfung.
            Der Wechsel gilt für neue Runden
            {suggestion.topic
              ? " in diesem Thema"
              : "; eigene Themenlevel bleiben erhalten"}
            . Du kannst ihn jederzeit manuell zurückstellen. „Später“ pausiert
            Vorschläge für diesen Bereich mindestens sieben Tage und bis
            genügend neue Antworten vorliegen.
          </p>
        </details>
      </div>
    </section>
  );
}
