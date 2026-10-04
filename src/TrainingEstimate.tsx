import { useMemo } from "react";
import type { AppState, Content } from "./domain";
import { estimateRules, estimateTraining } from "./training-estimate";
import "./training-estimate.css";

export default function TrainingEstimate({
  state,
  content,
  now,
}: {
  state: AppState;
  content: Content;
  now: Date;
}) {
  const estimate = useMemo(
    () => estimateTraining(state, content, now),
    [state, content, now],
  );
  return (
    <section
      className="training-estimate panel"
      aria-label="Geschätzter Trainingsstand"
    >
      <span className="small-label">ORIENTIERUNG AUS DEINEN ANTWORTEN</span>
      <h2>
        {estimate.level
          ? `Textübungen: etwa ${estimate.level}`
          : "Dein geschätzter Trainingsstand"}
      </h2>
      <p>
        Wortschatz und Grammatik, über alle Themen der letzten 30 Tage. Deine
        gewählte Trainingsstufe bleibt unverändert.
      </p>
      <div className="estimate-domains">
        {[estimate.words, estimate.grammar].map((domain) => (
          <article
            key={domain.kind}
            aria-label={
              domain.kind === "lexical"
                ? "Wortschatz-Einschätzung"
                : "Grammatik-Einschätzung"
            }
          >
            <span>
              {domain.kind === "lexical" ? "Wortschatz" : "Grammatik"}
            </span>
            <strong>
              {domain.level ? `Wahrscheinlich ${domain.level}` : "Noch offen"}
            </strong>
            {domain.candidate.count ? (
              <p>
                {domain.candidate.count} Antworten auf {domain.candidate.level}{" "}
                · {Math.round(domain.candidate.accuracy * 100)} % sicher
                beantwortet · {domain.candidate.days} Lerntage
              </p>
            ) : (
              <p>
                Übe an mehreren Tagen und in beiden Richtungen. Daraus entsteht
                nach und nach deine Einschätzung.
              </p>
            )}
            {!domain.level && domain.candidate.count > 0 && (
              <p>
                {domain.candidate.ready
                  ? "Die Antworten sind noch wechselhaft. Weiteres Wiederholen hilft, die Stufe sicher einzuschätzen."
                  : `Für ${domain.candidate.level} fehlen noch genügend unterschiedliche Antworten, Lerntage oder beide Richtungen.`}
              </p>
            )}
          </article>
        ))}
      </div>
      <p className="small muted">
        Eine Orientierung für diese Textübungen, kein Sprachtest. Hören und
        Sprechen werden nicht erfasst; die Stufenzuordnung der Inhalte ist
        vorläufig.
      </p>
      <details>
        <summary>Wie entsteht die Einschätzung?</summary>
        <p>
          Wir betrachten je Bereich und Stufe die letzten {estimateRules.window}{" "}
          gezählten Erstantworten innerhalb von {estimateRules.days} Tagen.
          Nötig sind mindestens {estimateRules.answers} Antworten an{" "}
          {estimateRules.learningDays} Tagen, {estimateRules.words} verschiedene
          Wortschatz- bzw. {estimateRules.grammar} Grammatikziele und{" "}
          {estimateRules.repeatedTargets} Lernziele an mehreren Tagen. Beide
          Richtungen brauchen je mindestens {estimateRules.perDirection}{" "}
          Antworten.
        </p>
        <p>
          Ab 90 % sicheren Antworten insgesamt und mindestens 85 % je Richtung
          zeigen wir die höchste so belegte Kursstufe. Für den gemeinsamen
          Textübungsstand zählt die niedrigere der beiden Einschätzungen.
          Selbstbewertungen fließen mit ein. Nachversuche, mehrfach beantwortete
          Karten am selben Tag, Archivübungen und eigene oder bearbeitete
          Inhalte zählen dafür nicht.
        </p>
        <p>
          Diese Schwellen sind vorsichtige Regeln der App, kein wissenschaftlich
          validiertes Einstufungsverfahren. Ohne aktuelle Antworten bleibt die
          Einschätzung offen; deine Meilensteine bleiben erhalten.
        </p>
      </details>
    </section>
  );
}
