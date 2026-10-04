import { Award, X } from "lucide-react";
import type { Achievement } from "./achievements";
import "./milestones.css";

export default function AchievementNotice({
  items,
  onClose,
  onOpen,
}: {
  items: Achievement[];
  onClose: () => void;
  onOpen: () => void;
}) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {!!items.length && (
        <section className="achievement-notice" aria-label="Neuer Meilenstein">
          <Award size={24} aria-hidden="true" />
          <div>
            <strong>{items[0].title}</strong>
            <span>
              {items.length === 1
                ? "Neuer Erfolg"
                : `${items.length} neue Meilensteine erreicht.`}
            </span>
          </div>
          <button className="text-button" onClick={onOpen}>
            Ansehen
          </button>
          <button
            className="icon-button"
            aria-label="Erfolgshinweis schließen"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </section>
      )}
    </div>
  );
}
