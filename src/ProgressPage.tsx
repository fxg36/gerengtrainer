import { useEffect, useMemo, useState } from "react";
import TrainingEstimate from "./TrainingEstimate";
import { findSession } from "./engine";
import {
  focusChannels,
  focusLabels,
  focusRules,
  trainingFocus,
} from "./training-focus";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Layers3,
  Sprout,
} from "lucide-react";
import {
  buildAnalytics,
  learningStages,
  type LearningSummary,
  type Period,
} from "./analytics";
import {
  type AppState,
  type Channel,
  type Content,
  type Target,
  type Topic,
} from "./domain";

const number = (value: number) => new Intl.NumberFormat("de-DE").format(value);
const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
const channelLabels = focusLabels;

function LearningBar({ summary }: { summary: LearningSummary }) {
  const width = (count: number) =>
    `${summary.total ? (count / summary.total) * 100 : 0}%`;
  return (
    <div
      className="learning-bar"
      role="img"
      aria-label={`${summary.consolidated} gefestigt, ${summary.learning} in Übung, ${summary.unseen} noch offen`}
    >
      <span
        className="is-consolidated"
        style={{ width: width(summary.consolidated) }}
      />
      <span
        className="is-learning"
        style={{ width: width(summary.learning) }}
      />
    </div>
  );
}

export default function ProgressPage({
  state,
  content,
  onTrain,
  onTopic,
  onDetail,
}: {
  state: AppState;
  content: Content;
  onTrain: (topicId?: string) => void;
  onTopic: (topic: Topic) => void;
  onDetail: (target: Target) => void;
}) {
  const [topicId, setTopicId] = useState("");
  const [period, setPeriod] = useState<Period>(30);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const data = useMemo(
    () => buildAnalytics(state, content, now, topicId, period),
    [state, content, now, topicId, period],
  );
  const { summary, stats } = data;
  const focus = useMemo(
    () => trainingFocus(state.events, now),
    [state.events, now],
  );
  const topic = content.topics.find((t) => t.id === topicId);
  const scopeLabel = topic?.title ?? "Alle Themen";
  const rate = (percent: number | null) =>
    percent === null ? "—" : `${percent} %`;
  const maxActivity = Math.max(1, ...data.activity.map((day) => day.count));
  const selectedActivity = data.activity.find((day) => day.day === selectedDay);
  const selectTopic = (id: string) => {
    setTopicId(id);
    setSelectedDay(null);
    document
      .querySelector(".analytics-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="analytics-page">
      <div className="page-heading analytics-heading">
        <div className="eyebrow">REGISTER / FORTSCHRITT</div>
        <h1>Dein Lernstand.</h1>
        <p>Was wächst. Was bleibt. Und was noch Übung braucht.</p>
      </div>
      <div className="analytics-toolbar">
        <label>
          Dein Blick auf
          <select
            aria-label="Fortschritt für Thema"
            value={topicId}
            onChange={(e) => {
              setTopicId(e.target.value);
              setSelectedDay(null);
            }}
          >
            <option value="">Alle Themen</option>
            {content.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        {topic && (
          <button className="text-button" onClick={() => onTopic(topic)}>
            Thema anpassen <ArrowRight size={16} />
          </button>
        )}
        {!topic && (
          <span className="small muted">
            Wortschatz & Grammatik · lokal ausgewertet
          </span>
        )}
      </div>

      <section className="learning-overview" aria-label="Aktueller Lernstand">
        <div className="learning-stage">
          <div className="small-label">
            DEINE LERNSTUFE · {scopeLabel.toLocaleUpperCase("de")}
          </div>
          <h2>
            {summary.stageLabel}
            <span>.</span>
          </h2>
          <p>
            {!summary.total
              ? "Hier sind noch keine Lerninhalte vorhanden."
              : !summary.seen
                ? "Dein erstes Training macht den Anfang. Mit jeder Wiederholung wird dein Lernstand aussagekräftiger."
                : summary.stage === 0
                  ? "Die ersten Spuren sind gelegt. Weitere Lerntage zeigen, was langfristig hängen bleibt."
                  : summary.stage === 1
                    ? "Du baust deinen Bestand auf. Verteilte Wiederholungen helfen, die Inhalte zu festigen."
                    : summary.stage === 2
                      ? "Ein wachsender Teil sitzt in beiden Richtungen. Im übrigen Bestand gibt es noch etwas zu entdecken."
                      : "Ein großer Teil dieses Bestands ist in beiden Richtungen gefestigt. Halte ihn mit den fälligen Wiederholungen frisch."}
          </p>
          <ol
            className="learning-steps"
            aria-label="Lernstufen im Trainingsbestand"
          >
            {learningStages.map((stage, index) => (
              <li
                key={stage}
                aria-current={index === summary.stage ? "step" : undefined}
                className={index <= summary.stage ? "reached" : ""}
              >
                <span>
                  {index < summary.stage ? <Check size={12} /> : index + 1}
                </span>
                {stage}
              </li>
            ))}
          </ol>
          <p className="small muted">
            Bezieht sich auf den verfügbaren Trainingsbestand in diesem Bereich.
          </p>
        </div>
        <div className="learning-coverage">
          <span className="small-label">GEFESTIGT IM BESTAND</span>
          <div className="coverage-number">
            {summary.percent}
            <span>%</span>
          </div>
          <p>
            <strong>{number(summary.consolidated)}</strong> von{" "}
            {number(summary.total)} Lernzielen
          </p>
          <LearningBar summary={summary} />
          <div className="learning-legend">
            <span>
              <i className="is-consolidated" />
              {number(summary.consolidated)} gefestigt
            </span>
            <span>
              <i className="is-learning" />
              {number(summary.learning)} in Übung
            </span>
            <span>
              <i />
              {number(summary.unseen)} noch offen
            </span>
          </div>
        </div>
      </section>

      <details className="analytics-method">
        <summary>
          Wie entsteht mein Lernstand? <ChevronDown size={16} />
        </summary>
        <div>
          <p>
            <strong>Gefestigt</strong> bedeutet: in beiden Abrufrichtungen seit
            dem letzten Fehler jeweils mindestens drei erfolgreiche Erstversuche
            an drei verschiedenen Tagen, über mindestens sieben Tage verteilt.
            Die Wiederholungskarte hat mindestens 14 Tage geschätzte Stabilität
            und ist noch nicht überfällig. Direkte Nachversuche zählen dafür
            nicht.
          </p>
          <p>
            <strong>Die vier Lernstufen:</strong> Einstieg zu Beginn; Im Aufbau
            ab mindestens zehn geübten Zielen und drei Lerntagen (bei kleineren
            Beständen alle Ziele); Wird sicherer ab 25 % gefestigtem Bestand;
            Gut gefestigt ab 70 %. Das sind nachvollziehbare Kriterien dieser
            App.
          </p>
          <p>
            Archivieren gilt nicht als „gelernt“. Archivierte Inhalte und
            inaktive Themen behalten ihren Lernstand. Neue Inhalte können den
            Prozentwert senken; überfällige Wiederholungen oder Fehler können
            den Status „gefestigt“ ändern. Aufdeckkarten beruhen auf deiner
            Selbstbewertung.
          </p>
        </div>
      </details>

      <TrainingEstimate state={state} content={content} now={now} />

      <section className="analytics-activity panel">
        <div className="section-heading">
          <div>
            <span className="small-label">DEIN LERNVERLAUF</span>
            <h2>Drangeblieben.</h2>
          </div>
          <div
            className="analytics-period"
            role="group"
            aria-label="Zeitraum der Auswertung"
          >
            {([7, 30, "all"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={period === value}
                onClick={() => {
                  setPeriod(value);
                  setSelectedDay(null);
                }}
              >
                {value === "all" ? "Gesamt" : `${value} Tage`}
              </button>
            ))}
          </div>
        </div>
        <div className="analytics-metrics">
          <div>
            <strong>{number(stats.attempts)}</strong>
            <span>Antworten</span>
            <small>{stats.retries} direkte Nachversuche dabei</small>
          </div>
          <div>
            <strong>{number(data.activeDays)}</strong>
            <span>aktive Lerntage</span>
            <small>im gewählten Zeitraum</small>
          </div>
          <div>
            <strong>{number(summary.due)}</strong>
            <span>jetzt fällig</span>
            <small>im aktiven Training</small>
          </div>
        </div>
        <div
          className="activity-chart"
          role="group"
          aria-label={`Antworten der letzten ${data.activity.length} Tage`}
        >
          {data.activity.map((day) => (
            <button
              key={day.day}
              aria-label={`${dayLabel(day.day)}: ${day.count} Antworten`}
              aria-pressed={selectedDay === day.day}
              onClick={() => setSelectedDay(day.day)}
              className={day.day === data.today ? "is-today" : ""}
            >
              <span
                style={{
                  height: `${day.count ? Math.max(5, (day.count / maxActivity) * 100) : 2}%`,
                }}
                className={day.count ? "has-activity" : ""}
              />
            </button>
          ))}
        </div>
        <div className="activity-axis">
          <span>{dayLabel(data.activity[0].day)}</span>
          <span>Heute</span>
        </div>
        <p className="activity-caption" aria-live="polite">
          {selectedActivity
            ? `${dayLabel(selectedActivity.day)} · ${selectedActivity.count} Antworten in ${scopeLabel}`
            : stats.attempts
              ? `Wähle einen Balken für die Tageszahl.${period === "all" ? " Die Grafik zeigt die letzten 30 Tage." : ""}`
              : "Hier erscheinen deine Antworten, sobald du in diesem Bereich trainierst."}
        </p>
        <div className="answer-metrics">
          <div>
            <span className="small-label">SELBSTBEWERTUNG</span>
            <strong>{rate(stats.recall.percent)}</strong>
            <p>als gewusst bewertet</p>
            <small>
              {stats.recall.good} von {stats.recall.count} Aufdeckantworten
            </small>
          </div>
          <div>
            <span className="small-label">AUSWAHLAUFGABEN</span>
            <strong>{rate(stats.choice.percent)}</strong>
            <p>richtig ausgewählt</p>
            <small>
              {stats.choice.good} von {stats.choice.count} Auswahlantworten
            </small>
          </div>
        </div>
        <details className="channel-details">
          <summary>
            Nach Abrufrichtung aufschlüsseln <ChevronDown size={15} />
          </summary>
          <div>
            {(Object.keys(channelLabels) as Channel[]).map((channel) => (
              <div key={channel}>
                <span>{channelLabels[channel]}</span>
                <strong>{rate(stats.channels[channel].percent)}</strong>
                <small>{stats.channels[channel].count} Antworten</small>
              </div>
            ))}
          </div>
        </details>
        <p className="small muted">
          Antwortquoten ohne direkte Nachversuche. Wenige Antworten liefern erst
          einen ersten Eindruck. Zeitraumfilter ändern den Verlauf; der
          Lernstand oben nutzt immer deine gesamte Historie.
        </p>
        <details className="training-focus-details">
          <summary>Automatischer Trainingsfokus</summary>
          <p>
            Grundlage für neue Runden: die letzten {focusRules.samples}{" "}
            regulären Antworten je Richtung innerhalb von {focusRules.days}{" "}
            Tagen, über alle Themen. Die Filter dieser Auswertung ändern die
            Gewichtung nicht.
          </p>
          <p className="small muted">
            Pro Bedeutung, Richtung und Lerntag zählt nur der erste reguläre
            Versuch. Archivübungen und zurückgenommene Antworten zählen nicht
            mit.
          </p>
          <dl>
            {focusChannels.map((channel) => (
              <div key={channel}>
                <dt>{focusLabels[channel]}</dt>
                <dd>
                  <strong>
                    {focus[channel].weight === 1
                      ? "Standardgewicht"
                      : `${number(focus[channel].weight)}× Gewicht`}
                  </strong>
                  <span>
                    {focus[channel].count < focusRules.minimum
                      ? `${focus[channel].count} von ${focusRules.minimum} Antworten für eine Anpassung`
                      : `${Math.round(focus[channel].accuracy! * 100)} % gewusst · ${focus[channel].count} Antworten`}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p>
            Schwächere Richtungen erhalten bis zum doppelten Gewicht bei der
            Auswahl verfügbarer Aufgaben. Gemischte Runden starten mit 80 %
            Wortschatz und 20 % Grammatik, wenn beide aktiv sind. Sichere
            Bereiche bekommen weniger, schwächere mehr Platz. Fälligkeiten,
            verfügbare Inhalte, Tageslimits und Archivquoten gelten weiter.
            Angefangene Runden bleiben erhalten.
          </p>
        </details>
      </section>

      <section className="analytics-topics" aria-label="Lernstand nach Thema">
        <div className="section-heading">
          <div>
            <span className="small-label">EIN THEMA NACH DEM ANDEREN</span>
            <h2>Wo stehst du?</h2>
          </div>
          {topic && (
            <button className="text-button" onClick={() => selectTopic("")}>
              Gesamtübersicht <Layers3 size={16} />
            </button>
          )}
        </div>
        <div className="analytics-topic-list">
          {data.topics.map((entry) => (
            <button
              key={entry.topic.id}
              className={`analytics-topic ${topicId === entry.topic.id ? "selected" : ""}`}
              aria-label={`Fortschritt: ${entry.topic.title}`}
              aria-pressed={topicId === entry.topic.id}
              onClick={() => selectTopic(entry.topic.id)}
            >
              <div className="analytics-topic-title">
                <strong>{entry.topic.title}</strong>
                <small>
                  {entry.seen} von {entry.total} geübt
                  {state.preferences[entry.topic.id]?.mode === "paused"
                    ? " · inaktiv"
                    : ""}
                </small>
              </div>
              <span className={`learning-stage-tag stage-${entry.stage}`}>
                {entry.stageLabel}
              </span>
              <div className="analytics-topic-bar">
                <LearningBar summary={entry} />
                <small>
                  {entry.consolidated} gefestigt · {entry.unseen} noch offen
                </small>
              </div>
              <span className="analytics-topic-percent">
                {entry.percent} %<ChevronRight size={17} />
              </span>
            </button>
          ))}
        </div>
        <p className="small muted">
          Gefestigter Anteil je Themenbestand. Bedeutungen können zu mehreren
          Themen gehören; insgesamt zählt jede nur einmal.{" "}
          {summary.archived > 0
            ? `${summary.archived} archivierte Inhalte sind in deinem ausgewählten Bereich enthalten. `
            : ""}
        </p>
      </section>

      <div className="analytics-bottom">
        <section className="panel analytics-focus">
          <span className="small-label">DIE NÄCHSTEN SCHRITTE</span>
          <h2>Hier lohnt sich Übung.</h2>
          {data.focus.length ? (
            data.focus.map((item) => (
              <button
                className="focus-item"
                key={item.target.id}
                onClick={() => onDetail(item.target)}
              >
                <span>
                  <strong>{item.target.word}</strong>
                  <small>{item.reason}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))
          ) : (
            <div className="analytics-empty">
              <Sprout size={30} />
              <p>
                {summary.seen
                  ? "Aktuell gibt es hier keine offenen Hinweise für aktive Inhalte. Deine Themenübersicht zeigt dir weiteren Stoff."
                  : "Beginne mit einer Runde. Hier sammeln sich danach konkrete Hinweise für dein Training."}
              </p>
            </div>
          )}
          <button
            className="primary"
            onClick={() =>
              topic && state.preferences[topic.id]?.mode !== "learn"
                ? onTopic(topic)
                : onTrain(topicId || undefined)
            }
          >
            {topic && state.preferences[topic.id]?.mode !== "learn"
              ? "Thema aktivieren"
              : findSession(state, null, topicId || null)
                ? topicId
                  ? "Thema fortsetzen"
                  : "Training fortsetzen"
                : topicId
                  ? "Thema trainieren"
                  : "Zum Training"}
            <ArrowRight size={16} />
          </button>
        </section>
        <section className="panel analytics-history">
          <span className="small-label">ZU LETZT NOTIERT</span>
          <h2>Deine Antworten.</h2>
          {!data.history.length ? (
            <div className="analytics-empty">
              <BookOpen size={30} />
              <p>
                In diesem Bereich und Zeitraum gibt es noch keine Antworten.
              </p>
            </div>
          ) : (
            data.history.map((event) => (
              <div className="analytics-history-row" key={event.id}>
                <span className={`answer-mark ${event.good ? "good" : ""}`}>
                  {event.good ? <Check size={14} /> : <Clock3 size={14} />}
                </span>
                <div>
                  <strong>
                    {data.items.find(
                      (item) => item.target.id === event.targetId,
                    )?.target.word ?? event.exercise.prompt}
                  </strong>
                  <small>
                    {event.exercise.mode === "choice"
                      ? "Auswahl"
                      : "Selbstbewertung"}
                    {event.retry ? " · Nachversuch" : ""}
                    {event.mode !== "regular" ? " · Archiv" : ""}
                  </small>
                </div>
                <time dateTime={event.at}>
                  {new Intl.DateTimeFormat("de-DE", {
                    day: "numeric",
                    month: "short",
                    timeZone: state.settings.timezone,
                  }).format(new Date(event.at))}
                </time>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
