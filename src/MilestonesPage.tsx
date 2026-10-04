import { useMemo, useState } from "react";
import { Award, Check, LockKeyhole, ArrowRight } from "lucide-react";
import {
  buildAchievements,
  achievementGroups,
  type Achievement,
} from "./achievements";
import type { AppState, Content } from "./domain";
import type { Engagement } from "./engagement";
import "./milestones.css";

export function MilestonesSummary({
  state,
  content,
  progress,
  onOpen,
}: {
  state: AppState;
  content: Content;
  progress: Engagement;
  onOpen: () => void;
}) {
  const achievements = useMemo(
    () => buildAchievements(state, content, new Date(), progress),
    [state, content, progress],
  );
  const earned = achievements.filter((item) => item.earned).length;
  return (
    <button
      className="milestones-summary-card"
      onClick={onOpen}
      aria-label={`Meilensteine: ${earned} von ${achievements.length} erreicht`}
    >
      <Award size={28} aria-hidden="true" />
      <span>
        <strong>Meilensteine</strong>
        <span>
          {earned} von {achievements.length} erreicht
        </span>
      </span>
      <ArrowRight size={20} aria-hidden="true" />
    </button>
  );
}

export default function MilestonesPage({
  state,
  content,
  progress,
  onProgress,
}: {
  state: AppState;
  content: Content;
  progress: Engagement;
  onProgress: () => void;
}) {
  const achievements = useMemo(
    () => buildAchievements(state, content, new Date(), progress),
    [state, content, progress],
  );
  const [filter, setFilter] = useState("all");
  const earned = achievements.filter((item) => item.earned).length;
  const visible = achievements.filter(
    (item) =>
      filter === "all" || (filter === "earned" ? item.earned : !item.earned),
  );
  return (
    <div className="milestones-page">
      <div className="page-heading">
        <div className="eyebrow">DEIN LERNWEG</div>
        <h1>Deine Meilensteine.</h1>
        <p>
          Jeder kleine Erfolg zählt. Hier siehst du, was du schon erreicht hast
          und was als Nächstes wartet.
        </p>
      </div>
      <section
        className="achievement-summary"
        aria-label="Erreichte Meilensteine"
      >
        <Award size={34} />
        <div>
          <strong>
            {earned} von {achievements.length} erreicht
          </strong>
          <p>Pausen löschen deine Erfolge nicht.</p>
        </div>
        <button className="text-button" onClick={onProgress}>
          Aktuellen Lernstand ansehen <ArrowRight size={17} />
        </button>
      </section>
      <div
        className="achievement-filters"
        role="group"
        aria-label="Meilensteine filtern"
      >
        {[
          ["all", "Alle"],
          ["earned", "Erreicht"],
          ["open", "Noch offen"],
        ].map(([value, label]) => (
          <button
            className={filter === value ? "primary" : "secondary"}
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {!visible.length && (
        <p className="achievement-empty">
          {filter === "open"
            ? "Alle Meilensteine erreicht. Du kannst stolz auf deinen Lernweg sein."
            : "Noch kein Meilenstein erreicht. Mit der ersten beantworteten Karte geht es los."}
        </p>
      )}
      {achievementGroups.map((group) => {
        const items = visible.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <section
            className="achievement-section"
            key={group}
            aria-label={group}
          >
            <h2>{group === "Kursstufen" ? "Dein Weg durch B1–C2" : group}</h2>
            {group === "Tagesziele" && (
              <p>
                Es zählt das Tagesziel beim Antworten. Späteres Umstellen ändert
                erreichte Ziele nicht. Frühere Lerntage ohne gespeichertes Ziel
                werden nicht rückwirkend angerechnet.
              </p>
            )}
            {group === "Kursstufen" && (
              <>
                <p>
                  Diese Abzeichen zeigen Fortschritt in unseren Kursinhalten.
                  Sie bescheinigen kein A1–C2-Sprachniveau.
                </p>
                <details className="achievement-method">
                  <summary>Wann gilt eine Kursstufe als vertieft?</summary>
                  <p>
                    Für jedes zugeordnete Lernziel: beide Abrufrichtungen an je
                    mindestens drei verschiedenen Lerntagen über mindestens
                    sieben Tage richtig beantworten, ohne Fehler dazwischen.
                    Direkte Nachversuche zählen nicht. Ein einmal erreichter
                    Meilenstein bleibt auch nach einer Pause sichtbar.
                  </p>
                  <p>
                    Die Stufenzuordnung der Inhalte ist vorläufig; Aussprache,
                    Hörverstehen und freies Sprechen werden hier nicht geprüft.
                    Unter Fortschritt siehst du, was aktuell gefestigt ist.
                  </p>
                </details>
              </>
            )}
            <div className="achievement-grid">
              {items.map((item) => (
                <AchievementCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AchievementCard({ item }: { item: Achievement }) {
  return (
    <article
      className={`achievement-card ${item.earned ? "earned" : "locked"}`}
      aria-label={item.title}
    >
      <div className="achievement-icon" aria-hidden="true">
        {item.level ? (
          <strong>{item.level}</strong>
        ) : item.earned ? (
          <Award size={26} />
        ) : (
          <LockKeyhole size={23} />
        )}
      </div>
      <div className="achievement-body">
        <span className="achievement-state">
          {item.earned ? (
            <>
              <Check size={15} /> Erreicht
            </>
          ) : (
            "Noch offen"
          )}
        </span>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <progress
          value={Math.min(item.value, item.target)}
          max={item.target || 1}
          aria-label={`${item.title}: Fortschritt`}
        />
        <span className="achievement-count">
          {Math.min(item.value, item.target).toLocaleString("de-DE")} /{" "}
          {item.target.toLocaleString("de-DE")}
          {item.level ? " Lernziele" : ""}
        </span>
      </div>
    </article>
  );
}
