import { ArrowRight, Check, Sparkles } from "lucide-react";
import {
  allowanceResetLabel,
  LEARNING_OFFER,
  unlimitedPrice,
  type FreeAllowance,
} from "./learning-offer";
import "./learning-offer.css";

function AllowanceStatus({ allowance }: { allowance: FreeAllowance }) {
  return (
    <div className="allowance-status">
      <span className="small-label">
        {allowance.phase === "intro"
          ? "DEIN KOSTENLOSER EINSTIEG"
          : "DEIN WOCHENKONTINGENT"}
      </span>
      <strong>
        {allowance.remaining}{" "}
        {allowance.phase === "intro"
          ? allowance.remaining === 1
            ? "Einstiegskarte"
            : "Einstiegskarten"
          : allowance.remaining === 1
            ? "Wochenkarte"
            : "Wochenkarten"}{" "}
        übrig
      </strong>
      <p>
        {allowance.phase === "intro"
          ? `Von ${LEARNING_OFFER.introCards} Einstiegskarten. Danach ${LEARNING_OFFER.weeklyCards} Karten pro Woche kostenlos.`
          : `Neue ${LEARNING_OFFER.weeklyCards} Karten am ${allowanceResetLabel(allowance.resetsOn!)}. Nicht genutzte Wochenkarten werden nicht angespart.`}
      </p>
    </div>
  );
}

export function LearningOfferSummary({
  allowance,
  onOpen,
}: {
  allowance: FreeAllowance;
  onOpen: () => void;
}) {
  return (
    <section
      className="learning-offer-summary"
      aria-label="Dein kostenloses Kontingent"
    >
      <AllowanceStatus allowance={allowance} />
      <div className="learning-offer-action">
        <button className="secondary" onClick={onOpen}>
          <Sparkles size={18} /> Unbegrenzt lernen <ArrowRight size={17} />
        </button>
        <span>Geplant: {unlimitedPrice} einmalig · kein Abo</span>
      </div>
      <p className="offer-availability">
        Derzeit ohne Begrenzung. Der Einmalkauf ist noch nicht verfügbar.
      </p>
    </section>
  );
}

export function LearningOfferDetails({
  allowance,
  onClose,
}: {
  allowance: FreeAllowance;
  onClose: () => void;
}) {
  return (
    <div className="learning-offer-details">
      <div className="offer-content">
        <p className="offer-intro">
          Mehr lernen, wann du möchtest. Ohne Abo und ohne Werbung.
        </p>
        <div className="offer-options">
          <section>
            <h3>Kostenlos lernen</h3>
            <AllowanceStatus allowance={allowance} />
            <p>
              Dein Lernstand bleibt erhalten. Du brauchst kein Konto, um zu
              lernen.
            </p>
          </section>
          <section className="offer-unlimited">
            <Sparkles size={24} />
            <h3>Unbegrenzt lernen</h3>
            <div className="offer-price">
              {unlimitedPrice} <span>einmalig · geplant</span>
            </div>
            <ul>
              <li>
                <Check size={17} /> Beliebig viele Karten üben
              </li>
              <li>
                <Check size={17} /> Dauerhafte Freischaltung
              </li>
              <li>
                <Check size={17} /> Kein Abo, keine Werbung
              </li>
            </ul>
            <p className="small">
              Der Einmalkauf ist noch nicht verfügbar. Bis dahin kannst du auch
              über das angezeigte Kontingent hinaus kostenlos weiterlernen.
            </p>
          </section>
        </div>
        <details className="offer-rules">
          <summary>So werden Karten gezählt</summary>
          <p>
            Jedes beantwortete Lernziel zählt je Abrufrichtung einmal pro Tag,
            auch bei einer falschen Antwort. Direkte Nachversuche und
            zurückgenommene Antworten verbrauchen keine zusätzlichen Karten.
            Auch die Einstiegskarten zählen zu deinem Lernfortschritt.
          </p>
          <p>
            Mit der 500. Karte endet der Einstieg; die nächste zählt zum ersten
            Wochenkontingent. Dieses erneuert sich jeweils nach sieben
            Kalendertagen, gerechnet ab dem letzten Einstiegstag in deiner
            eingestellten Zeitzone. Dein persönliches Tagesziel ändert dieses
            Kontingent nicht.
          </p>
        </details>
      </div>
      <div className="offer-footer">
        <button className="primary" disabled>
          Kauf bald verfügbar
        </button>
        <button className="secondary" onClick={onClose}>
          Weiter kostenlos lernen
        </button>
      </div>
    </div>
  );
}
