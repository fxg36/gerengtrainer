import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { type Engagement, type recommendNext } from "./engagement";
import "./engagement.css";

export function DailyActivity({
  progress,
  compact = false,
}: {
  progress: Engagement;
  compact?: boolean;
}) {
  const reached = progress.todayCount >= progress.dailyGoal;
  return (
    <section
      className={`daily-activity ${compact ? "compact" : ""}`}
      aria-label="Heute geübt"
    >
      <div className="daily-activity-heading">
        <span>
          <BookOpen size={17} /> Heute geübt
        </span>
        <strong>
          {progress.todayCount} {progress.todayCount === 1 ? "Karte" : "Karten"}
        </strong>
      </div>
      <progress
        className="daily-goal-progress"
        aria-label="Fortschritt zum Tagesziel"
        value={Math.min(progress.todayCount, progress.dailyGoal)}
        max={progress.dailyGoal}
      />
      <div className="daily-goal-state" aria-live="polite" aria-atomic="true">
        <span className={`goal-state ${reached ? "reached" : "open"}`}>
          {reached && <CheckCircle2 size={17} aria-hidden="true" />}
          {reached ? "Tagesziel erreicht" : "Tagesziel noch offen"}
        </span>
        <span className="small muted">
          {progress.todayCount} von {progress.dailyGoal} Karten
        </span>
      </div>
    </section>
  );
}

export default function DailyProgress({
  progress,
  recommendation,
  onRecommend,
  onGoal,
  busy,
}: {
  progress: Engagement;
  recommendation: ReturnType<typeof recommendNext>;
  onRecommend: () => void;
  onGoal: () => void;
  busy: boolean;
}) {
  return (
    <section className="daily-overview" aria-label="Dein Lernmoment">
      <div className="daily-score">
        <DailyActivity progress={progress} />
        <button className="text-button" onClick={onGoal}>
          Tagesziel ändern
        </button>
      </div>
      <div className="daily-recommendation">
        <h2>{recommendation.welcome}</h2>
        <p>{recommendation.description}</p>
        <button className="primary" disabled={busy} onClick={onRecommend}>
          {recommendation.label}
          <ArrowRight size={17} />
        </button>
      </div>
      <div
        className="learning-rhythm"
        role="group"
        aria-label="Deine Lernaktivität"
      >
        <div>
          <strong>{progress.streak}</strong>
          <span>
            {progress.streak === 1 ? "Tag in Folge" : "Tage in Folge"}
          </span>
        </div>
        <div>
          <strong>{progress.activeDays}</strong>
          <span>Lerntage insgesamt</span>
        </div>
        <div>
          <strong>{progress.practicedTargets}</strong>
          <span>Lernziele geübt</span>
        </div>
      </div>
    </section>
  );
}
