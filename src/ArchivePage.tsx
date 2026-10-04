import { useState } from "react";
import {
  Archive,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Play,
  Search,
  Undo2,
} from "lucide-react";
import {
  allTargets,
  targetInTopic,
  ALL_ARCHIVE_TOPICS,
  type AppState,
  type Content,
  type Target,
} from "./domain";
import { findSession, setTopic } from "./engine";

type Props = {
  state: AppState;
  content: Content;
  busy: boolean;
  act: (fn: (state: AppState) => void) => Promise<boolean>;
  onTrain: (scope: string) => void;
  onDetail: (target: Target) => void;
  onRestore: (target: Target) => void;
  onDictionary: () => void;
  onTopics: () => void;
};

export function archiveQuotaLabel(state: AppState): string {
  const quotas = new Set(
    Object.values(state.preferences).map((pref) => pref.quota),
  );
  if (quotas.size > 1) return "Je Thema";
  const quota = [...quotas][0] ?? 0;
  return quota ? `${quota} %` : "Aus";
}

const quotaOptions = Array.from({ length: 11 }, (_, index) => index * 5);

export default function ArchivePage({
  state,
  content,
  busy,
  act,
  onTrain,
  onDetail,
  onRestore,
  onDictionary,
  onTopics,
}: Props) {
  const [query, setQuery] = useState("");
  const [topic, setFilterTopic] = useState("");
  const [limit, setLimit] = useState(50);
  const archived = allTargets(state, content).filter(
    (target) => state.participation[target.id] === "archived",
  );
  const filtered = archived.filter(
    (target) =>
      (!topic || targetInTopic(target, topic)) &&
      `${target.word} ${target.de}`
        .toLocaleLowerCase("de")
        .includes(query.toLocaleLowerCase("de")),
  );
  const quotas = new Set(
    Object.values(state.preferences).map((pref) => pref.quota),
  );
  const globalQuota = quotas.size === 1 ? String([...quotas][0]) : "mixed";
  const practiceCount = archived
    .filter((target) => !topic || targetInTopic(target, topic))
    .filter((target) =>
      content.topics.some(
        (entry) =>
          (!topic || entry.id === topic) &&
          state.preferences[entry.id]?.mode === "learn" &&
          targetInTopic(target, entry.id),
      ),
    ).length;
  const changeQuota = (quota: number) =>
    act((draft) => {
      for (const entry of content.topics) {
        if (draft.preferences[entry.id].quota !== quota)
          setTopic(draft, entry.id, { quota });
      }
    });
  return (
    <div className="archive-page">
      <div className="page-heading archive-heading">
        <div>
          <div className="eyebrow">REGISTER / ARCHIV</div>
          <h1>Dein Archiv.</h1>
          <p>Hier liegt, was du gerade nicht regelmäßig üben möchtest.</p>
        </div>
        <span className="archive-stamp">
          <Archive size={22} />
          <strong>{archived.length}</strong>
          <span>Einträge</span>
        </span>
      </div>
      <div className="archive-controls">
        <section className="archive-practice">
          <span className="small-label">01 / GEZIELT AUFFRISCHEN</span>
          <h2>Eine Runde aus dem Archiv.</h2>
          <p>
            Übe archivierte Wörter und Grammatik. Sie bleiben danach im Archiv.
          </p>
          <label>
            Themenauswahl
            <select
              aria-label="Archivthema"
              value={topic}
              onChange={(event) => {
                setFilterTopic(event.target.value);
                setLimit(50);
              }}
            >
              <option value="">Alle archivierten Themen</option>
              {content.topics
                .filter((entry) =>
                  archived.some((target) => targetInTopic(target, entry.id)),
                )
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                    {state.preferences[entry.id]?.mode !== "learn"
                      ? " (inaktiv)"
                      : ""}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || !practiceCount}
            onClick={() => onTrain(topic || ALL_ARCHIVE_TOPICS)}
          >
            <Play size={18} />
            {findSession(state, topic || ALL_ARCHIVE_TOPICS)
              ? "Archiv weitertrainieren"
              : "Archiv trainieren"}
            <ArrowRight size={18} />
          </button>
          <p className="archive-control-note">
            Aus deinen aktiven Themen, auch bei 0 % Archivquote. Die Karten
            zählen zu deinem Tagesziel von {state.settings.dailyCardGoal}.
          </p>
          {!practiceCount && archived.length > 0 && (
            <button className="secondary" onClick={onTopics}>
              Themen aktivieren
            </button>
          )}
          <p className="archive-control-note">
            Deine anderen Trainingsrunden bleiben für später gespeichert.
          </p>
        </section>
        <section className="archive-quota">
          <span className="small-label">02 / IM NORMALEN TRAINING</span>
          <h2>Deine Archivquote.</h2>
          <p>
            Bestimme, wie viel Archiv in neue Trainingsrunden einfließen darf.
          </p>
          <label>
            Archivquote für alle Themen
            <select
              aria-label="Archivquote für alle Themen"
              disabled={busy}
              value={globalQuota}
              onChange={(event) => changeQuota(Number(event.target.value))}
            >
              {globalQuota === "mixed" && (
                <option value="mixed" disabled>
                  Unterschiedlich je Thema
                </option>
              )}
              {quotaOptions.map((quota) => (
                <option key={quota} value={quota}>
                  {quota === 0 ? "Aus · 0 %" : `Bis zu ${quota} %`}
                </option>
              ))}
            </select>
          </label>
          <div
            className="quota-presets"
            aria-label="Schnellauswahl Archivquote"
          >
            {[0, 10, 20, 30].map((quota) => (
              <button
                key={quota}
                className={globalQuota === String(quota) ? "selected" : ""}
                aria-pressed={globalQuota === String(quota)}
                disabled={busy}
                onClick={() => changeQuota(quota)}
              >
                {quota ? `${quota} %` : "Aus"}
              </button>
            ))}
          </div>
          <p className="archive-control-note">
            Bei 0 % nur über „Archiv trainieren“. Die Quote gilt für neu
            geplante Runden in aktiven Themen.
          </p>
          <details className="topic-quotas">
            <summary>Quoten pro Thema anpassen</summary>
            {content.topics.map((entry) => (
              <label key={entry.id}>
                <span>
                  {entry.title}
                  {state.preferences[entry.id].mode === "paused" && (
                    <small> · inaktiv</small>
                  )}
                </span>
                <select
                  aria-label={`Archivquote ${entry.title}`}
                  disabled={busy}
                  value={state.preferences[entry.id].quota}
                  onChange={(event) => {
                    const quota = Number(event.target.value);
                    act((draft) => setTopic(draft, entry.id, { quota }));
                  }}
                >
                  {quotaOptions.map((quota) => (
                    <option key={quota} value={quota}>
                      {quota ? `${quota} %` : "Aus"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </details>
        </section>
      </div>
      <section className="archive-index" aria-label="Archivierte Einträge">
        <div className="section-heading">
          <div>
            <span className="small-label">DEIN BESTAND</span>
            <h2>
              Im Archiv <span className="inline-count">{filtered.length}</span>
            </h2>
          </div>
          <label className="search-input">
            <Search size={18} />
            <input
              aria-label="Archiv durchsuchen"
              placeholder="Wort oder Bedeutung suchen"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(50);
              }}
            />
          </label>
        </div>
        {!archived.length ? (
          <div className="archive-empty">
            <img src="/pip.svg" alt="" aria-hidden="true" />
            <div>
              <h3>Hier ist noch Platz.</h3>
              <p>
                Wähle im Training oder Wörterbuch „Archivieren“. Deine Wörter
                findest du dann hier.
              </p>
              <button className="secondary" onClick={onDictionary}>
                <BookOpen size={17} />
                Zum Wörterbuch
              </button>
            </div>
          </div>
        ) : !filtered.length ? (
          <p className="archive-no-results">
            Keine Einträge gefunden. Ändere Suchbegriff oder Themenauswahl.
          </p>
        ) : (
          <div className="archive-list">
            {filtered.slice(0, limit).map((target) => (
              <div className="archive-entry" key={target.id}>
                <button
                  className="archive-entry-word"
                  onClick={() => onDetail(target)}
                >
                  <span>
                    <strong>{target.word}</strong>
                    <span>{target.de}</span>
                  </span>
                  <ChevronRight size={17} />
                </button>
                <span className="archive-entry-topic">
                  {
                    content.topics.find(
                      (entry) => entry.id === target.ownerTopicId,
                    )?.title
                  }
                </span>
                <button
                  className="text-button"
                  aria-label={`${target.word} wieder regulär üben`}
                  disabled={busy}
                  onClick={() => {
                    if (
                      topic &&
                      archived.filter((entry) => targetInTopic(entry, topic))
                        .length === 1
                    )
                      setFilterTopic("");
                    onRestore(target);
                  }}
                >
                  <Undo2 size={16} />
                  <span>Zurück ins Training</span>
                </button>
              </div>
            ))}
          </div>
        )}
        {filtered.length > limit && (
          <button
            className="secondary load-more"
            onClick={() => setLimit((value) => value + 50)}
          >
            Weitere Einträge anzeigen
          </button>
        )}
      </section>
    </div>
  );
}
