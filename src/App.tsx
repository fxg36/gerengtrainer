import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Archive,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CloudOff,
  Database,
  Download,
  Ellipsis,
  Flame,
  House,
  Layers3,
  Leaf,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target as TargetIcon,
  TrendingUp,
  Undo2,
  X,
  Wrench,
  CloudSun,
  HeartPulse,
  Shirt,
  CookingPot,
  CarFront,
  Plane,
  Users,
  BriefcaseBusiness,
  MessagesSquare,
  SpellCheck,
  CheckCircle2,
  Pause,
  Play,
  AlertCircle,
  ExternalLink,
  Clock3,
  Bookmark,
  Pencil,
  MonitorSmartphone,
  GraduationCap,
  CalendarDays,
  ShoppingBag,
  Wallet,
  Laptop,
  Dumbbell,
  Palette,
  Clapperboard,
  Landmark,
  FileText,
  FlaskConical,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import AboutApp from "./AboutApp";
import {
  isNative,
  listenForNativeBack,
  listenForNativeLinks,
} from "./platform";
import ArchivePage, { archiveQuotaLabel } from "./ArchivePage";
import TimeBudget from "./TimeBudget";
import LevelControl from "./LevelControl";
import TopicToggle from "./TopicToggle";
import WritingPractice from "./WritingPractice";
import { writingLabels } from "./writing";
import { effectiveLevel, withinLevel } from "./levels";
import { groupMeanings, meaningSearchRank, relatedMeanings } from "./meanings";
import "./meanings.css";
import "./catalogue.css";
import ProgressPage from "./ProgressPage";
import {
  allTargets,
  targetInTopic,
  targetInSubtopic,
  learningLevels,
  type LearningLevel,
  ALL_ARCHIVE_TOPICS,
  allExercises,
  exerciseSchema,
  targetSchema,
  topicSchema,
  lexicalExercises,
  memoryKey,
  withExerciseCues,
  uid,
  type AppState,
  type Content,
  type Target,
  type Topic,
  type DictionaryWord,
  type ReviewEvent,
} from "./domain";
import {
  loadState,
  mutateState,
  subscribe,
  replaceState,
  getRecovery,
  deleteLocalProfile,
} from "./storage";
import {
  commitReview,
  dayKey,
  findSession,
  normalizeSession,
  openSession,
  sessionTopicInactive,
  planSession,
  setParticipation,
  setTopic,
  undoReview,
} from "./engine";
import {
  downloadText,
  exportBackup,
  parseBackup,
  restoredState,
  MAX_BACKUP_BYTES,
  type BackupPayload,
} from "./backup";

type Page =
  | "today"
  | "topics"
  | "dictionary"
  | "archive"
  | "progress"
  | "data"
  | "session";
const icons: Record<string, typeof House> = {
  House,
  Wrench,
  Leaf,
  CloudSun,
  HeartPulse,
  Shirt,
  CookingPot,
  CarFront,
  Plane,
  Users,
  BriefcaseBusiness,
  MessagesSquare,
  SpellCheck,
  GraduationCap,
  CalendarDays,
  ShoppingBag,
  Wallet,
  Laptop,
  Dumbbell,
  Palette,
  Clapperboard,
  Landmark,
  FileText,
  FlaskConical,
};
const number = (n: number) => n.toLocaleString("de-DE");
const date = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const statusLabels = {
  regular: "Im Training",
  archived: "Archiviert",
};
function TopicIcon({ topic, size = 22 }: { topic: Topic; size?: number }) {
  const Icon = icons[topic.icon] ?? BookOpen;
  return (
    <span className={`topic-icon ${topic.color}`}>
      <Icon size={size} />
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Schließen"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <BookOpen />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export default function App() {
  const [content, setContent] = useState<Content | null>(null),
    [state, setState] = useState<AppState | null>(null),
    [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<Page>("today"),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const [mobileNav, setMobileNav] = useState(false),
    [detail, setDetail] = useState<Target | null>(null),
    [topicDetail, setTopicDetail] = useState<Topic | null>(null);
  const [custom, setCustom] = useState<Partial<Target> | null>(null),
    [help, setHelp] = useState(false),
    [report, setReport] = useState<Target | null>(null);
  const [installPrompt, setInstallPrompt] = useState<
    | (Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      })
    | null
  >(null);
  const [offlineReady, setOfflineReady] = useState(isNative);
  const [topicQuery, setTopicQuery] = useState("");
  const [confirmAllTopics, setConfirmAllTopics] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onOfflineReady() {
      setOfflineReady(true);
    },
    onRegisterError() {
      setToast(
        "Die Offline-Installation konnte noch nicht abgeschlossen werden. Bitte einmal online neu laden.",
      );
    },
  });
  const lock = useRef(false);
  useEffect(() => {
    let mounted = true;
    fetch("/content/course.json")
      .then(async (r) => {
        if (!r.ok) throw new Error("Inhalte sind gerade nicht verfügbar.");
        const data = (await r.json()) as Content;
        data.targets = data.targets.map((t) => targetSchema.parse(t));
        data.exercises = data.exercises.map((e) => exerciseSchema.parse(e));
        data.topics = data.topics.map((t) => topicSchema.parse(t));
        const saved = await loadState(data.topics);
        if (mounted) {
          setContent(data);
          setState(saved);
        }
      })
      .catch((e) => mounted && setLoadError(e.message));
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!content) return;
    return subscribe(() => {
      loadState(content.topics)
        .then(setState)
        .catch((e) => setToast(e.message));
    });
  }, [content]);
  useEffect(() => {
    const handler = () => setOnline(navigator.onLine);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    const install = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as typeof installPrompt);
    };
    window.addEventListener("beforeinstallprompt", install);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(id);
  }, [toast]);
  const act = useCallback(
    async (fn: (draft: AppState) => void) => {
      if (!state || !content || lock.current) return false;
      lock.current = true;
      setBusy(true);
      try {
        const updated = await mutateState(state.revision, (draft) => {
          fn(draft);
          normalizeSession(draft, content);
        });
        setState(updated);
        return true;
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
        setState(await loadState(content.topics));
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [state, content],
  );
  const navigate = (next: Page) => {
    setPage(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const nativeBack = useRef<() => boolean>(() => false);
  nativeBack.current = () => {
    if (mobileNav) {
      setMobileNav(false);
      return true;
    }
    if (page !== "today") {
      navigate("today");
      return true;
    }
    return false;
  };
  useEffect(() => listenForNativeBack(() => nativeBack.current()), []);
  useEffect(() => listenForNativeLinks(setToast), []);
  if (loadError)
    return (
      <main className="fatal">
        <AlertCircle size={40} />
        <h1>Der Start hat nicht geklappt.</h1>
        <p>{loadError}</p>
        <p>
          Bitte prüfe, ob die Seite vollständig geladen werden kann und lokaler
          Speicher erlaubt ist.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Erneut versuchen
        </button>
      </main>
    );
  if (!state || !content)
    return (
      <main className="loading">
        <div className="brand-mark">
          <img src="/pip.svg" alt="" />
        </div>
        <p>Ein Moment für dein Englisch.</p>
        <LoaderCircle className="spin" size={24} />
      </main>
    );
  const targets = allTargets(state, content),
    events = state.events.filter((e) => !e.revokedAt),
    today = dayKey(new Date(), state.settings.timezone);
  const todayEvents = events.filter((e) => e.day === today),
    learned = new Set(events.map((e) => e.targetId));
  const archivedCount = targets.filter(
    (target) => state.participation[target.id] === "archived",
  ).length;
  const activeTopics = content.topics.filter(
    (t) => state.preferences[t.id]?.mode === "learn",
  );
  const trainableArchivedCount = targets.filter(
    (target) =>
      state.participation[target.id] === "archived" &&
      activeTopics.some((topic) => targetInTopic(target, topic.id)),
  ).length;
  const due = targets.filter(
    (t) =>
      (state.participation[t.id] ?? "regular") === "regular" &&
      activeTopics.some((topic) => targetInTopic(t, topic.id)) &&
      Object.entries(state.memory).some(
        ([key, c]) =>
          key.startsWith(t.id + "~") && Date.parse(c.due) <= Date.now(),
      ),
  ).length;
  const start = async (
    archiveTopic: string | null = null,
    topicId: string | null = null,
    subtopicId: string | null = null,
  ) => {
    const selectedTopic =
      topicId ?? (archiveTopic !== ALL_ARCHIVE_TOPICS ? archiveTopic : null);
    if (selectedTopic && state.preferences[selectedTopic]?.mode !== "learn") {
      setTopicDetail(
        content.topics.find((topic) => topic.id === selectedTopic) ?? null,
      );
      setToast("Aktiviere dieses Thema, um es zu trainieren.");
      return;
    }
    if (!archiveTopic && !topicId && !activeTopics.length) {
      navigate("topics");
      return;
    }
    if (
      await act((s) => {
        openSession(s, content, new Date(), archiveTopic, topicId, subtopicId);
        s.settings.onboarded = true;
      })
    )
      navigate("session");
  };
  const participation = async (
    target: Target,
    value: AppState["participation"][string],
  ) => {
    if (await act((s) => setParticipation(s, target.id, value))) {
      setToast(
        value === "regular"
          ? "Wieder im regulären Training."
          : "Archiviert. Zählt nicht als Übung oder Lernerfolg.",
      );
      setDetail(null);
    }
  };
  const navItems: { id: Page; label: string; icon: typeof House }[] = [
    { id: "today", label: "Heute", icon: House },
    { id: "topics", label: "Themen", icon: Layers3 },
    { id: "dictionary", label: "Wörterbuch", icon: BookOpen },
    { id: "archive", label: "Archiv", icon: Archive },
    { id: "progress", label: "Fortschritt", icon: TrendingUp },
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
        >
          <div className="brand-mark">
            <img src="/pip.svg" alt="" />
          </div>
          <span>
            Einfach Englisch
            <span className="brand-sub">Englisch im Alltag sicher nutzen.</span>
          </span>
        </a>
        <div className="nav-label">IN DIESEM HEFT</div>
        <nav aria-label="Hauptnavigation">
          {navItems.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              aria-label={label}
              aria-current={page === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <span className="nav-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon size={18} />
              {label}
              {id === "today" && due > 0 && (
                <span className="nav-count" aria-hidden="true">
                  {due}
                </span>
              )}
              {id === "archive" && (
                <span className="nav-count" aria-hidden="true">
                  {archivedCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="small-label">MEIN EXEMPLAR</span>
            <strong>Lokal gespeichert.</strong>
            <p>Ohne Konto · offline nutzbar</p>
          </div>
          <button
            className={`nav-item ${page === "data" ? "active" : ""}`}
            onClick={() => navigate("data")}
          >
            <Database size={19} />
            Daten & Einstellungen
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            Über die App
          </button>
          <div className="sidebar-foot">
            <span className="status-dot" />
            Dein Englisch. Dein Tempo.
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Navigation schließen"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Menü öffnen"
              onClick={() => setMobileNav(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Notizbuch<span>/</span>
              <strong>
                {page === "data"
                  ? "Daten & Einstellungen"
                  : page === "session"
                    ? "Deine Lernzeit"
                    : navItems.find((n) => n.id === page)?.label}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="connection">
              {online ? (
                <span className="status-dot" />
              ) : (
                <CloudOff size={15} />
              )}
              <span>
                {!online
                  ? "Offline"
                  : offlineReady
                    ? "Offline bereit"
                    : "Lokal gespeichert"}
              </span>
            </span>
            <button
              className="avatar"
              onClick={() => navigate("data")}
              aria-label="Persönliche Einstellungen"
            >
              DU
            </button>
          </div>
        </header>
        {needRefresh && (
          <div className="update-banner">
            Eine neue Version ist bereit. Dein Lernstand bleibt erhalten.
            <button onClick={() => updateServiceWorker(true)}>
              Jetzt aktualisieren
            </button>
          </div>
        )}
        <main
          className={`main-content ${page === "session" ? "session-main" : ""}`}
        >
          {page === "today" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">
                  {new Date().toLocaleDateString("de-DE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: state.settings.timezone,
                  })}
                </div>
                <h1>
                  Dein Lernheft<span className="heading-dot">.</span>
                </h1>
                <p>
                  Vokabeln, Grammatik und ein Platz für das, was hängen bleibt.
                </p>
              </div>
              <div className="today-layout">
                <div className="today-primary">
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-label">01 / TRAINING</span>
                      <h2>
                        Eine Runde
                        <br />
                        Englisch.
                      </h2>
                      <p>
                        Wörter abrufen. Sätze vervollständigen.
                        <br />
                        Mit den Themen, die du gewählt hast.
                      </p>
                      <button
                        className="cream-button"
                        disabled={busy}
                        onClick={() => start()}
                      >
                        {!activeTopics.length
                          ? "Themen auswählen"
                          : findSession(state)
                            ? "Training fortsetzen"
                            : "Training starten"}
                        <ArrowRight size={19} />
                      </button>
                      <div className="hero-meta">
                        <Clock3 size={14} />
                        Rund {state.settings.minutes} Minuten<span>·</span>
                        {activeTopics.length} aktive Themen
                      </div>
                    </div>
                    <div className="notebook-mascot">
                      <span className="bird-note">Shall we?</span>
                      <img
                        src="/pip.svg"
                        alt="Pip, ein kleiner blauer Vogel mit Bleistift und Notizbuch"
                      />
                      <span className="bird-caption">
                        PIP · HAT SCHON DEN STIFT
                      </span>
                    </div>
                  </section>
                  <div className="stats-row">
                    <div className="stat-card">
                      <span className="stat-icon sage">
                        <BookOpen size={20} />
                      </span>
                      <div>
                        <strong>{due}</strong>
                        <span>zur Wiederholung</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon peach">
                        <CheckCheck size={20} />
                      </span>
                      <div>
                        <strong>{todayEvents.length}</strong>
                        <span>heute geübt</span>
                      </div>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon lilac">
                        <Layers3 size={20} />
                      </span>
                      <div>
                        <strong>{activeTopics.length}</strong>
                        <span>aktive Themen</span>
                      </div>
                    </div>
                  </div>
                  <section
                    className="home-archive"
                    aria-label="Archivübersicht"
                  >
                    <div className="home-archive-label">
                      <Archive size={22} />
                      <div>
                        <span className="small-label">DEIN ARCHIV</span>
                        <h2>
                          {archivedCount}{" "}
                          {archivedCount === 1 ? "Eintrag" : "Einträge"}{" "}
                          beiseitegelegt.
                        </h2>
                      </div>
                    </div>
                    <button
                      className="home-quota"
                      onClick={() => navigate("archive")}
                    >
                      <span>Archivquote</span>
                      <strong>{archiveQuotaLabel(state)}</strong>
                      <Pencil size={14} />
                    </button>
                    <div className="home-archive-actions">
                      <button
                        className="secondary"
                        onClick={() => navigate("archive")}
                      >
                        Archiv anzeigen
                        <ArrowRight size={16} />
                      </button>
                      <button
                        className="text-button"
                        disabled={busy || !archivedCount}
                        onClick={() =>
                          trainableArchivedCount
                            ? start(ALL_ARCHIVE_TOPICS)
                            : navigate("topics")
                        }
                      >
                        <Play size={16} />
                        {archivedCount && !trainableArchivedCount
                          ? "Themen aktivieren"
                          : "Archiv trainieren"}
                      </button>
                    </div>
                  </section>
                  <div className="section-heading">
                    <div>
                      <h2>Deine Themen</h2>
                      <p>Deine Auswahl für die nächste Runde.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("topics")}
                    >
                      Alle Themen
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="home-topics">
                    {(activeTopics.length
                      ? activeTopics
                      : content.topics.filter((t) =>
                          ["home", "travel", "grammar"].includes(t.id),
                        )
                    )
                      .slice(0, 3)
                      .map((topic) => {
                        const tt = targets.filter((t) =>
                            targetInTopic(t, topic.id),
                          ),
                          done = tt.filter((t) => learned.has(t.id)).length;
                        return (
                          <button
                            className="home-topic"
                            key={topic.id}
                            onClick={() => setTopicDetail(topic)}
                          >
                            <div className="topic-card-top">
                              <TopicIcon topic={topic} />
                              <ChevronRight size={17} />
                            </div>
                            <h3>{topic.title}</h3>
                            <p>{topic.description}</p>
                            <div className="progress-track">
                              <span
                                style={{
                                  width: `${tt.length ? (done / tt.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="small muted">
                              {done} von {tt.length} Lernzielen bearbeitet
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  <div className="privacy-strip">
                    <ShieldCheck size={19} />
                    <span>
                      Dein Lernstand bleibt bei dir. Exportiere ihn jederzeit
                      und nimm ihn mit.
                    </span>
                    <button onClick={() => navigate("data")}>
                      Daten sichern
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
                <aside className="today-secondary">
                  <section className="panel rhythm">
                    <div className="section-heading">
                      <h3>Dein Tempo</h3>
                      <Clock3 size={18} />
                    </div>
                    <TimeBudget
                      value={state.settings.minutes}
                      disabled={busy}
                      onChange={(minutes) =>
                        act((s) => {
                          s.settings.minutes = minutes;
                        })
                      }
                    />
                    <p className="small muted">
                      {state.session && !state.session.finished
                        ? "Deine laufende Runde bleibt gespeichert. Die Einstellung gilt für die nächste Runde."
                        : state.settings.limitNewPerDay
                          ? `Tageslimit aktiv: ${state.settings.newPerDay} neue Wörter und ${state.settings.grammarPerDay} neue Grammatikthemen.`
                          : "Neue Inhalte ohne Tageslimit. Fällige Wiederholungen kommen zuerst."}
                    </p>
                    <div className="rhythm-divider" />
                    <button
                      className="home-level-link"
                      onClick={() => navigate("topics")}
                    >
                      Trainingslevel <strong>{state.settings.level}</strong>{" "}
                      <Pencil size={16} />
                    </button>
                    <div className="small-label">AN DIESEN TAGEN GEÜBT</div>
                    <Week state={state} />
                    <p className="small week-note">
                      {todayEvents.length
                        ? `${todayEvents.length} Antworten heute gespeichert.`
                        : "Heute noch keine Antworten gespeichert."}
                    </p>
                    <p className="small muted">
                      Ein Haken steht für einen Tag mit Antworten, nicht für ein
                      erreichtes Zeitziel.
                    </p>
                  </section>
                  <section className="word-card">
                    <div className="word-label">
                      <Pencil size={16} /> AM RAND NOTIERT
                    </div>
                    <h3>Fair enough.</h3>
                    <p className="word-translation">„Gut, das verstehe ich.“</p>
                    <div className="word-example">
                      “I'd rather take the train.”
                      <br />
                      “Fair enough.”
                    </div>
                    <p className="small muted">
                      Wenn du einen Standpunkt anerkennst – auch ohne völlig
                      zuzustimmen.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        const target = targets.find(
                          (t) => t.word === "fair enough",
                        );
                        if (target) setDetail(target);
                      }}
                    >
                      Ausdruck entdecken
                      <ArrowRight size={16} />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          )}
          {page === "topics" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">REGISTER / THEMEN</div>
                <h1>Womit beschäftigst du dich?</h1>
                <p>
                  Aktiviere, was du üben möchtest. Trainiere einzelne Themen
                  oder deinen Themenmix unter Heute.
                </p>
              </div>
              <LevelControl
                value={state.settings.level}
                targets={targets}
                disabled={busy}
                onChange={(level) =>
                  act((s) => {
                    s.settings.level = level;
                  })
                }
              />
              <div className="info-strip">
                <Layers3 size={20} />
                <span>
                  <strong>Du wählst die Themen. Wir planen die Übungen.</strong>{" "}
                  Fällige Wiederholungen kommen zuerst, neue Inhalte ergänzen
                  deine Runde. Inaktive Themen bleiben aus dem Training.
                </span>
              </div>
              <div className="topic-toolbar">
                <label className="search-input topic-search">
                  <Search size={20} />
                  <input
                    aria-label="Themen suchen"
                    placeholder="Thema oder Unterthema suchen …"
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  disabled={
                    busy ||
                    content.topics.every(
                      (topic) => state.preferences[topic.id].mode === "learn",
                    )
                  }
                  onClick={() => setConfirmAllTopics(true)}
                >
                  <CheckCheck size={19} /> Alle Themen aktivieren
                </button>
              </div>
              <div className="topic-grid">
                {content.topics
                  .filter((topic) =>
                    `${topic.title} ${topic.description} ${topic.subtopics?.map((sub) => sub.title).join(" ") ?? ""}`
                      .toLocaleLowerCase("de")
                      .includes(topicQuery.trim().toLocaleLowerCase("de")),
                  )
                  .map((topic) => {
                    const items = targets.filter((t) =>
                        targetInTopic(t, topic.id),
                      ),
                      done = items.filter((t) => learned.has(t.id)).length,
                      pref = state.preferences[topic.id];
                    return (
                      <section className="topic-card" key={topic.id}>
                        <button
                          className="topic-open"
                          onClick={() => setTopicDetail(topic)}
                        >
                          <div className="topic-card-top">
                            <TopicIcon topic={topic} />
                          </div>
                          <h3>{topic.title}</h3>
                          <p>{topic.description}</p>
                          <span className="topic-section-note">
                            {topic.subtopics?.length ?? 0} Unterthemen ·
                            Auswählen & ansehen <ChevronRight size={15} />
                          </span>
                          <div className="progress-track">
                            <span
                              style={{
                                width: `${(done / items.length) * 100 || 0}%`,
                              }}
                            />
                          </div>
                          <span className="small muted">
                            {done} von {items.length} Lernzielen bearbeitet
                          </span>
                          <span className="topic-level-note">
                            {effectiveLevel(state, topic.id)} ·{" "}
                            {pref.level ? "Eigene Stufe" : "Globales Level"} ·{" "}
                            {
                              items.filter((t) =>
                                withinLevel(t, effectiveLevel(state, topic.id)),
                              ).length
                            }{" "}
                            passende Ziele
                          </span>
                        </button>
                        <TopicToggle
                          title={topic.title}
                          active={pref.mode === "learn"}
                          disabled={busy}
                          onChange={(active) =>
                            void act((s) =>
                              setTopic(s, topic.id, {
                                mode: active ? "learn" : "paused",
                              }),
                            )
                          }
                        />
                        <div className="topic-train-action">
                          <button
                            className="primary"
                            disabled={busy || pref.mode !== "learn"}
                            onClick={() => start(null, topic.id)}
                            aria-label={`${topic.title}: ${findSession(state, null, topic.id) ? "Thema fortsetzen" : "Thema trainieren"}`}
                          >
                            <Play size={17} />
                            {findSession(state, null, topic.id)
                              ? "Thema fortsetzen"
                              : "Thema trainieren"}
                            <ArrowRight size={17} />
                          </button>
                          {pref.mode !== "learn" && (
                            <p className="small muted">
                              Zum Trainieren aktivieren.
                            </p>
                          )}
                        </div>
                      </section>
                    );
                  })}
              </div>
            </>
          )}
          {page === "dictionary" && (
            <Dictionary
              state={state}
              content={content}
              onDetail={setDetail}
              onCustom={setCustom}
            />
          )}
          {page === "progress" && (
            <ProgressPage
              state={state}
              content={content}
              onTrain={(topicId) => start(null, topicId ?? null)}
              onTopic={setTopicDetail}
              onDetail={setDetail}
            />
          )}
          {page === "archive" && (
            <ArchivePage
              state={state}
              content={content}
              busy={busy}
              act={act}
              onTrain={start}
              onDetail={setDetail}
              onRestore={(target) => participation(target, "regular")}
              onDictionary={() => navigate("dictionary")}
              onTopics={() => navigate("topics")}
            />
          )}
          {page === "data" && (
            <DataPage
              state={state}
              content={content}
              busy={busy}
              act={act}
              onState={setState}
              notify={setToast}
              installPrompt={installPrompt}
              onInstall={async () => {
                if (installPrompt) {
                  await installPrompt.prompt();
                  setInstallPrompt(null);
                } else
                  setToast(
                    "Zum Installieren: Im Browsermenü „App installieren“ oder „Zum Startbildschirm“ wählen.",
                  );
              }}
            />
          )}
          {page === "session" && (
            <Training
              state={state}
              content={content}
              busy={busy}
              act={act}
              onExit={() =>
                navigate(
                  state.session?.topicId
                    ? "topics"
                    : state.session?.archiveTopic
                      ? "archive"
                      : "today",
                )
              }
              onTopic={() => navigate("topics")}
              onParticipation={participation}
              onReport={setReport}
              onArchive={() => navigate("archive")}
            />
          )}
          <footer className="page-footer">
            <span>Einfach Englisch / Englisch im Alltag sicher nutzen.</span>
            <button onClick={() => setHelp(true)}>Inhalte & Quellen</button>
          </footer>
        </main>
        {page !== "session" && (
          <nav className="mobile-dock" aria-label="Schnellnavigation">
            {navItems
              .filter((item) =>
                ["today", "topics", "dictionary", "archive"].includes(item.id),
              )
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={page === id ? "active" : ""}
                  aria-current={page === id ? "page" : undefined}
                  onClick={() => navigate(id)}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              ))}
          </nav>
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <AlertCircle size={19} />
          <span>{toast}</span>
          <button aria-label="Meldung schließen" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {confirmAllTopics && (
        <Modal
          title="Alle Themen aktivieren?"
          onClose={() => {
            if (!busy) setConfirmAllTopics(false);
          }}
        >
          <p>
            Möchtest du wirklich alle {content.topics.length} Themen aktivieren?
            Die App plant neue Inhalte und Wiederholungen automatisch.
          </p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmAllTopics(false)}
            >
              Nein
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await act((draft) => {
                    for (const topic of content.topics) {
                      if (draft.preferences[topic.id].mode !== "learn")
                        setTopic(draft, topic.id, { mode: "learn" });
                    }
                  })
                ) {
                  setConfirmAllTopics(false);
                  setToast("Alle Themen sind jetzt aktiv.");
                }
              }}
            >
              {busy ? "Wird gespeichert …" : "Ja"}
            </button>
          </div>
        </Modal>
      )}
      {topicDetail && (
        <Modal title={topicDetail.title} onClose={() => setTopicDetail(null)}>
          <TopicSettings
            topic={topicDetail}
            state={state}
            content={content}
            act={act}
            busy={busy}
            onTrain={async (subtopicId) => {
              setTopicDetail(null);
              await start(null, topicDetail.id, subtopicId ?? null);
            }}
            onArchive={async () => {
              setTopicDetail(null);
              await start(topicDetail.id);
            }}
            onWord={(target) => {
              setTopicDetail(null);
              setDetail(target);
            }}
          />
        </Modal>
      )}
      {detail && (
        <Modal title="Ein Wort genauer" onClose={() => setDetail(null)}>
          <div className="word-detail">
            <span className="pill">
              {detail.kind === "grammar"
                ? "Grammatiklernziel"
                : detail.pos || "Wortschatz"}
            </span>
            <h2>{detail.word}</h2>
            <p className="detail-translation">{detail.de}</p>
            {detail.senseContext && (
              <div className="sense-context-detail">
                <span className="small-label">GEMEINTE BEDEUTUNG</span>
                <p lang="de">{detail.senseContext.de}</p>
                <p lang="en">{detail.senseContext.en}</p>
              </div>
            )}
            {detail.gloss && <p className="source-gloss">{detail.gloss}</p>}
            {detail.example && <blockquote>{detail.example}</blockquote>}
            {relatedMeanings(detail, targets).length > 0 && (
              <section className="related-meanings">
                <h3>Gleiches Wort, andere Bedeutung</h3>
                <p className="small muted">
                  Jede Bedeutung hat ihren eigenen Lernstand und Archivstatus.
                </p>
                {relatedMeanings(detail, targets).map((meaning) => (
                  <button key={meaning.id} onClick={() => setDetail(meaning)}>
                    <strong>
                      {meaning.word} · {meaning.de}
                    </strong>
                    <span>{meaning.senseContext?.de || meaning.gloss}</span>
                  </button>
                ))}
              </section>
            )}
            <dl className="dimension-list">
              {Object.entries(detail.dimensions)
                .filter(([, v]) => v.length)
                .map(([key, values]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>
                      {values
                        .map(
                          (v) =>
                            content.topics.find((t) => t.id === v)?.title ??
                            content.topics
                              .flatMap((t) => t.subtopics ?? [])
                              .find((sub) => sub.id === v)?.title ??
                            v,
                        )
                        .join(" · ")}
                    </dd>
                  </div>
                ))}
            </dl>
            <p className="small muted">
              Du kannst diese Bedeutung in jedem zugeordneten Thema üben. Dein
              Lernstand bleibt dabei derselbe.
            </p>
            <div className="detail-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => participation(detail, "regular")}
              >
                <Play size={17} />
                Regulär üben
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => participation(detail, "archived")}
              >
                <Archive size={17} />
                Archivieren
              </button>
            </div>
            <div className="source-note">
              {detail.source.url ? (
                <a href={detail.source.url} target="_blank" rel="noreferrer">
                  {detail.source.name}
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span>{detail.source.name}</span>
              )}
              <span>
                {detail.source.license} ·{" "}
                {detail.reviewStatus === "personal"
                  ? "Eigener Eintrag"
                  : "Testinhalt, fachliche Freigabe ausstehend"}
              </span>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setCustom(detail);
                setDetail(null);
              }}
            >
              <Pencil size={15} />
              Bedeutung & Zuordnung bearbeiten
            </button>
            {detail.kind === "lexical" && (
              <button
                className="text-button"
                onClick={() => {
                  setCustom({
                    word: detail.word,
                    ownerTopicId: detail.ownerTopicId,
                    pos: detail.pos,
                  });
                  setDetail(null);
                }}
              >
                <Plus size={15} />
                Weitere Bedeutung anlegen
              </button>
            )}
          </div>
        </Modal>
      )}
      {custom && (
        <CustomForm
          initial={custom}
          content={content}
          onClose={() => setCustom(null)}
          onSave={async (target) => {
            if (
              await act((s) => {
                s.personalTargets = s.personalTargets.filter(
                  (t) => t.id !== target.id,
                );
                s.personalTargets.push(target);
                s.personalExercises = s.personalExercises.filter(
                  (e) => e.targetId !== target.id,
                );
                if (target.kind === "lexical")
                  s.personalExercises.push(...lexicalExercises(target));
              })
            ) {
              setCustom(null);
              setToast("Dein Eintrag ist lokal gespeichert.");
            }
          }}
        />
      )}
      {report && (
        <Modal
          title="Inhalt zur Prüfung markieren"
          onClose={() => setReport(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const note = String(new FormData(e.currentTarget).get("note"));
              if (
                await act((s) => {
                  s.reports.push({
                    targetId: report.id,
                    at: new Date().toISOString(),
                    note,
                  });
                  setParticipation(s, report.id, "archived");
                })
              ) {
                setReport(null);
                setToast(
                  "Lokal notiert und archiviert. Es wurde nichts versendet.",
                );
              }
            }}
          >
            <p>
              Was ist bei „{report.word}“ unklar? Der Eintrag wird archiviert.
              Ob er automatisch wiederholt wird, bestimmt deine Archivquote.
            </p>
            <label>
              Deine Notiz
              <textarea name="note" required maxLength={2000} rows={4} />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              Notieren & archivieren
            </button>
          </form>
        </Modal>
      )}
      {help && (
        <Modal title="Über Einfach Englisch" onClose={() => setHelp(false)}>
          <AboutApp content={content} />
        </Modal>
      )}
    </div>
  );
}

function Week({ state }: { state: AppState }) {
  const now = new Date(),
    days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return {
        key: dayKey(d, state.settings.timezone),
        label: new Intl.DateTimeFormat("de-DE", {
          weekday: "short",
          timeZone: state.settings.timezone,
        })
          .format(d)
          .replace(".", ""),
      };
    });
  const done = new Set(
    state.events.filter((e) => !e.revokedAt).map((e) => e.day),
  );
  return (
    <div className="week">
      {days.map((day, i) => (
        <div key={day.key}>
          <span>{day.label}</span>
          <span
            className={`day-circle ${done.has(day.key) ? "done" : ""} ${i === 6 ? "current" : ""}`}
          >
            {done.has(day.key) ? (
              <Check size={15} />
            ) : i === 6 ? (
              <span className="day-dot" />
            ) : (
              <span>·</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

type Act = (fn: (state: AppState) => void) => Promise<boolean>;
function TopicSettings({
  topic,
  state,
  content,
  act,
  busy,
  onTrain,
  onArchive,
  onWord,
}: {
  topic: Topic;
  state: AppState;
  content: Content;
  act: Act;
  busy: boolean;
  onTrain: (subtopicId?: string) => void;
  onArchive: () => void;
  onWord: (t: Target) => void;
}) {
  const pref = state.preferences[topic.id],
    targets = allTargets(state, content).filter((t) =>
      targetInTopic(t, topic.id),
    ),
    archived = targets.filter((t) => state.participation[t.id] === "archived");
  const [filter, setFilter] = useState("all");
  const [subtopicId, setSubtopicId] = useState("");
  const scopedTargets = targets.filter(
    (t) => !subtopicId || targetInSubtopic(t, subtopicId),
  );
  const practiceTitle =
    topic.subtopics?.find((sub) => sub.id === subtopicId)?.title ?? topic.title;
  const [ownLevel, setOwnLevel] = useState(pref.level !== null);
  useEffect(() => setOwnLevel(pref.level !== null), [pref.level, topic.id]);
  return (
    <div className="topic-settings">
      <p>{topic.description}</p>
      <TopicToggle
        title={topic.title}
        active={pref.mode === "learn"}
        disabled={busy}
        onChange={(active) =>
          void act((s) =>
            setTopic(s, topic.id, { mode: active ? "learn" : "paused" }),
          )
        }
      />
      <div className="topic-practice">
        {!!topic.subtopics?.length && (
          <label className="subtopic-select">
            Was möchtest du üben?
            <select
              aria-label="Unterthema auswählen"
              value={subtopicId}
              onChange={(e) => setSubtopicId(e.target.value)}
            >
              <option value="">
                Ganzes Thema · {targets.length} Lernziele
              </option>
              {topic.subtopics.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title} ·{" "}
                  {targets.filter((t) => targetInSubtopic(t, sub.id)).length}{" "}
                  Lernziele
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="primary"
          disabled={busy || pref.mode !== "learn"}
          onClick={() => onTrain(subtopicId || undefined)}
        >
          <Play size={18} />
          {findSession(state, null, topic.id, subtopicId || null)
            ? subtopicId
              ? "Unterthema fortsetzen"
              : "Thema fortsetzen"
            : subtopicId
              ? "Unterthema trainieren"
              : "Thema trainieren"}
          <ArrowRight size={18} />
        </button>
        <p className="small muted">
          Nur {practiceTitle} · Level {effectiveLevel(state, topic.id)} · bis zu{" "}
          {state.settings.minutes} Minuten.
          {pref.mode === "paused"
            ? " Aktiviere dieses Thema, um es zu trainieren. Dein Lernstand und angefangene Runden bleiben erhalten."
            : " Neue Inhalte und fällige Wiederholungen werden automatisch geplant. Deine gemischte Runde bleibt für später gespeichert."}
        </p>
      </div>
      <label className="topic-level-override">
        <input
          type="checkbox"
          checked={ownLevel}
          disabled={busy}
          onChange={(e) => {
            const enabled = e.target.checked;
            const level = enabled ? state.settings.level : null;
            setOwnLevel(enabled);
            void act((s) => setTopic(s, topic.id, { level })).then((saved) => {
              if (!saved) setOwnLevel(pref.level !== null);
            });
          }}
        />
        Eigenes Level für dieses Thema
      </label>
      {ownLevel ? (
        <LevelControl
          label={`Trainingslevel für ${topic.title}`}
          value={pref.level ?? state.settings.level}
          targets={targets}
          disabled={busy}
          onChange={(level) => act((s) => setTopic(s, topic.id, { level }))}
        />
      ) : (
        <p className="small muted">
          Folgt deinem globalen Level {state.settings.level}. Leichtere Inhalte
          werden automatisch beigemischt.
        </p>
      )}
      <div className="setting-section">
        <h3>Archiv auffrischen</h3>
        <p className="small muted">
          Bis zu {pref.quota} % des geplanten Budgets dieses Themas. Bei 0 %
          bleiben archivierte Inhalte außen vor.
        </p>
        <div className="quota-control">
          <input
            aria-label="Archivquote"
            type="range"
            min={0}
            max={50}
            step={5}
            value={pref.quota}
            disabled={busy}
            onChange={(e) => {
              const quota = Number(e.target.value);
              act((s) => setTopic(s, topic.id, { quota }));
            }}
          />
          <strong>{pref.quota === 0 ? "Aus" : pref.quota + " %"}</strong>
        </div>
        <button
          className="secondary"
          disabled={!archived.length || busy || pref.mode !== "learn"}
          onClick={onArchive}
        >
          <Archive size={16} />
          Archiv dieses Themas üben ({archived.length})
        </button>
        <p className="small muted">
          Archivtraining ist bei aktivem Thema möglich, auch bei 0 %
          Archivquote. Die Inhalte bleiben dabei im Archiv.
        </p>
      </div>
      <div className="section-heading">
        <h3>{scopedTargets.length} Lernziele</h3>
        <select
          aria-label="Inhalte filtern"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Alle Inhalte</option>
          <option value="regular">Im Training</option>
          <option value="archived">Archiviert</option>
        </select>
      </div>
      <div className="topic-word-list">
        {scopedTargets
          .filter(
            (t) =>
              filter === "all" ||
              (state.participation[t.id] ?? "regular") === filter,
          )
          .map((t) => (
            <button key={t.id} onClick={() => onWord(t)}>
              <span>
                <strong>{t.word}</strong>
                <small>
                  {t.kind === "grammar" ? "Grammatiklernziel" : t.de}
                </small>
              </span>
              <span className="small muted">
                {statusLabels[state.participation[t.id] ?? "regular"]}
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
      </div>
    </div>
  );
}

function CustomForm({
  initial,
  content,
  onSave,
  onClose,
}: {
  initial: Partial<Target>;
  content: Content;
  onSave: (t: Target) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const data = new FormData(e.currentTarget),
      word = String(data.get("word")).trim(),
      de = String(data.get("de")).trim();
    if (!word || !de) return;
    setSaving(true);
    try {
      await onSave({
        id: initial.id ?? "user-" + uid(),
        kind: initial.kind ?? "lexical",
        ownerTopicId: String(data.get("topic")),
        word,
        de,
        gloss: initial.gloss ?? "",
        pos: String(data.get("pos")),
        example: String(data.get("example")).trim(),
        senseContext: {
          de: String(data.get("contextDe") ?? "").trim(),
          en: String(data.get("contextEn") ?? "").trim(),
        },
        level: String(data.get("level"))
          ? (String(data.get("level")) as LearningLevel)
          : undefined,
        dimensions: {
          ...initial.dimensions,
          Themen: [
            String(data.get("topic")),
            ...data.getAll("additional").map(String),
          ].filter((v, i, a) => a.indexOf(v) === i),
          Situationen: String(data.get("situations"))
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          Wortart: [String(data.get("pos"))],
        },
        source: initial.source ?? {
          name: "Persönlicher Eintrag",
          url: "",
          license: "Eigener Inhalt",
          sourceId: "",
        },
        classification: "user",
        reviewStatus: "personal",
        version: (initial.version ?? 0) + 1,
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={initial.id ? "Eintrag bearbeiten" : "Dein eigener Ausdruck"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="custom-form">
        <label>
          Trainingsstufe (optional)
          <select name="level" defaultValue={initial.level ?? ""}>
            <option value="">Ohne Stufe – im Training mitmischen</option>
            {learningLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Englischer Ausdruck
            <input
              name="word"
              required
              maxLength={150}
              defaultValue={initial.word}
              placeholder="z. B. make yourself at home"
            />
          </label>
          <label>
            Deutsche Bedeutung
            <input
              name="de"
              required
              maxLength={500}
              defaultValue={initial.de}
              placeholder="z. B. Fühl dich wie zu Hause"
            />
          </label>
        </div>
        <label>
          Beispielsatz <span className="muted">(optional)</span>
          <input
            name="example"
            maxLength={600}
            defaultValue={initial.example}
            placeholder="Ein Satz, der dir beim Erinnern hilft"
          />
        </label>
        {initial.kind !== "grammar" && (
          <fieldset>
            <legend>Welche Bedeutung ist gemeint?</legend>
            <p className="small muted">
              Diese Hinweise stehen vor dem Aufdecken: Deutsch beim Abruf ins
              Englische, Englisch in der Gegenrichtung. Eine andere Bedeutung
              bitte als eigenen Eintrag anlegen.
            </p>
            <label>
              Kontext auf Deutsch (optional)
              <textarea
                name="contextDe"
                maxLength={600}
                rows={2}
                defaultValue={initial.senseContext?.de}
                placeholder="z. B. Ein Gefühl nach einem peinlichen Missgeschick"
              />
            </label>
            <label>
              Kontext auf Englisch (optional)
              <textarea
                name="contextEn"
                maxLength={4000}
                rows={2}
                defaultValue={initial.senseContext?.en ?? initial.gloss}
                placeholder="e.g. A feeling after an awkward social moment"
              />
            </label>
          </fieldset>
        )}
        <div className="form-grid">
          <label>
            Zuständiges Trainingsthema
            <select
              name="topic"
              defaultValue={initial.ownerTopicId ?? "phrases"}
            >
              {content.topics
                .filter((t) =>
                  initial.kind === "grammar"
                    ? t.id === "grammar"
                    : t.id !== "grammar",
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Wortart
            <select name="pos" defaultValue={initial.pos ?? "phrase"}>
              {[
                ["noun", "Substantiv"],
                ["verb", "Verb"],
                ["adj", "Adjektiv"],
                ["adv", "Adverb"],
                ["phrase", "Wendung"],
                ["prep", "Präposition"],
                ["conj", "Konjunktion"],
                ["pron", "Pronomen"],
                ["det", "Begleiter"],
                ["intj", "Ausruf"],
                ["num", "Zahlwort"],
                ["grammar", "Grammatik"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Weitere Themen für Suche und Einordnung</legend>
          <div className="checkbox-grid">
            {content.topics
              .filter((t) => t.id !== "grammar")
              .map((t) => (
                <label key={t.id}>
                  <input
                    type="checkbox"
                    name="additional"
                    value={t.id}
                    defaultChecked={initial.dimensions?.Themen?.includes(t.id)}
                  />
                  {t.title}
                </label>
              ))}
          </div>
        </fieldset>
        <label>
          Situationen <span className="muted">(mit Komma trennen)</span>
          <input
            name="situations"
            maxLength={500}
            defaultValue={initial.dimensions?.Situationen?.join(", ")}
            placeholder="z. B. Besuch, Smalltalk"
          />
        </label>
        <p className="small muted">
          Bleibt auf deinem Gerät und ist im Datenexport enthalten. Fürs
          Training muss das zuständige Thema aktiv sein.
        </p>
        <button className="primary" disabled={saving} type="submit">
          <Check size={17} />
          Eintrag speichern
        </button>
      </form>
    </Modal>
  );
}

function SourceWord({
  word,
  targets,
  onCustom,
}: {
  word: DictionaryWord;
  targets: Target[];
  onCustom: (target: Partial<Target>) => void;
}) {
  const [visible, setVisible] = useState(5);
  const first = word.senses[0];
  return (
    <details className="source-row" data-word={word.word}>
      <summary className="dictionary-row">
        <div className="source-summary">
          <span className="word-heading">{word.word}</span>
          <p>{first.de.length ? first.de.join(" · ") : first.gloss}</p>
        </div>
        <span className="sense-count">
          {word.senses.length}{" "}
          {word.senses.length === 1 ? "Bedeutung" : "Bedeutungen"}
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="source-senses">
        {word.senses.slice(0, visible).map((sense) => (
          <div className="source-sense" key={sense.id}>
            <div>
              <span className="pos">{sense.pos}</span>
              <p>{sense.de.length ? sense.de.join(" · ") : sense.gloss}</p>
              {sense.de.length > 0 && <small>{sense.gloss}</small>}
            </div>
            <button
              className="secondary compact"
              aria-label={`Bedeutung von ${word.word} übernehmen`}
              onClick={() =>
                onCustom({
                  id: sense.id,
                  word: word.word,
                  de:
                    targets.find((t) => t.id === sense.id)?.de ??
                    sense.de.join(" / "),
                  gloss: sense.gloss,
                  senseContext: targets.find((t) => t.id === sense.id)
                    ?.senseContext ?? { de: "", en: sense.gloss },
                  level: targets.find((t) => t.id === sense.id)?.level,
                  pos: sense.pos,
                  source: {
                    name: "Wiktionary via Kaikki",
                    url:
                      "https://en.wiktionary.org/wiki/" +
                      encodeURIComponent(word.word) +
                      "#English",
                    license: "CC-BY-SA-4.0",
                    sourceId: sense.id,
                  },
                  dimensions: {
                    Themen: [],
                    Situationen: [],
                    Register: sense.tags,
                    Region: [],
                    Wortart: [sense.pos],
                  },
                })
              }
            >
              <Plus size={16} />
              <span>Übernehmen</span>
            </button>
          </div>
        ))}
        {visible < word.senses.length && (
          <button
            className="secondary compact"
            onClick={() => setVisible((value) => value + 10)}
          >
            Weitere Bedeutungen ({word.senses.length - visible})
          </button>
        )}
      </div>
    </details>
  );
}

function Dictionary({
  state,
  content,
  onDetail,
  onCustom,
}: {
  state: AppState;
  content: Content;
  onDetail: (t: Target) => void;
  onCustom: (t: Partial<Target>) => void;
}) {
  const [query, setQuery] = useState(""),
    [topic, setTopicFilter] = useState(""),
    [status, setStatus] = useState(""),
    [pos, setPos] = useState(""),
    [source, setSource] = useState(false),
    [limit, setLimit] = useState(60);
  const [results, setResults] = useState<DictionaryWord[]>([]),
    [count, setCount] = useState(0),
    [progress, setProgress] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const worker = useRef<Worker | null>(null),
    request = useRef(0);
  useEffect(
    () => () => {
      worker.current?.terminate();
    },
    [],
  );
  useEffect(() => {
    if (!source) return;
    if (!worker.current) {
      worker.current = new Worker(
        new URL("./dictionary.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current.onmessage = (e) => {
        if (e.data.type === "progress") setProgress(e.data.progress);
        if (e.data.requestId !== request.current) return;
        if (e.data.type === "result") {
          setResults(e.data.entries);
          setCount(e.data.count);
          setLoading(false);
          setError("");
        }
        if (e.data.type === "error") {
          setError(e.data.message);
          setLoading(false);
        }
      };
    }
    setLoading(true);
    const id = ++request.current;
    const timer = setTimeout(
      () => worker.current?.postMessage({ query, pos, requestId: id }),
      180,
    );
    return () => clearTimeout(timer);
  }, [source, query, pos]);
  const targets = allTargets(state, content),
    filtered = targets.filter(
      (t) =>
        (!topic ||
          t.dimensions.Themen?.includes(topic) ||
          t.ownerTopicId === topic) &&
        (!pos || t.pos === pos) &&
        (!status || (state.participation[t.id] ?? "regular") === status) &&
        `${t.word} ${t.de} ${t.senseContext?.de ?? ""} ${t.senseContext?.en ?? ""} ${Object.values(t.dimensions).flat().join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  filtered.sort(
    (a, b) => meaningSearchRank(b, query) - meaningSearchRank(a, query),
  );
  const groups = groupMeanings(filtered, query);
  const renderMeaning = (t: Target) => (
    <button className="dictionary-row" key={t.id} onClick={() => onDetail(t)}>
      <span
        className={`word-initial ${content.topics.find((topic) => topic.id === t.ownerTopicId)?.color ?? "sage"}`}
      >
        {t.kind === "grammar" ? (
          <SpellCheck size={20} />
        ) : (
          t.word.charAt(0).toUpperCase()
        )}
      </span>
      <span className="dictionary-word">
        <strong>{t.word}</strong>
        <span>{t.kind === "grammar" ? "Grammatiklernziel" : t.de}</span>
        {t.senseContext?.de && (
          <span className="meaning-preview">{t.senseContext.de}</span>
        )}
      </span>
      <span className="dictionary-topic">
        {content.topics.find((topic) => topic.id === t.ownerTopicId)?.title}
      </span>
      <span
        className={`participation-tag ${state.participation[t.id] ?? "regular"}`}
      >
        {statusLabels[state.participation[t.id] ?? "regular"]}
      </span>
      <ChevronRight size={17} />
    </button>
  );
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <div className="eyebrow">REGISTER / WÖRTERBUCH</div>
          <h1>Dein Wörterbuch.</h1>
          <p>
            Finde Bedeutungen, ordne sie ein und mache sie zu deinen eigenen.
          </p>
        </div>
        <button className="primary" onClick={() => onCustom({})}>
          <Plus size={18} />
          Eigener Eintrag
        </button>
      </div>
      <div className="dictionary-controls">
        <div
          className="dictionary-tabs"
          role="group"
          aria-label="Wörterbuchbereich"
        >
          <button
            className={!source ? "active" : ""}
            aria-pressed={!source}
            onClick={() => setSource(false)}
          >
            <Bookmark size={23} aria-hidden="true" />
            <span className="dictionary-tab-copy">
              <strong>Dein Trainingsbestand</strong>
              <span>{number(targets.length)} Lernziele · zum Üben bereit</span>
            </span>
          </button>
          <button
            className={source ? "active" : ""}
            aria-pressed={source}
            onClick={() => setSource(true)}
          >
            <BookOpen size={23} aria-hidden="true" />
            <span className="dictionary-tab-copy">
              <strong>Wörterbuch entdecken</strong>
              <span>
                {number(
                  content.manifest.sourceWordCount ??
                    content.manifest.sourceCount,
                )}{" "}
                Stichwörter · Neues finden
              </span>
            </span>
          </button>
        </div>
        <div className="search-row">
          <label className="search-input">
            <Search size={19} />
            <input
              aria-label="Wörter suchen"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              placeholder="Englisches Wort oder deutsche Bedeutung suchen …"
            />
            {query && (
              <button aria-label="Suche leeren" onClick={() => setQuery("")}>
                <X size={17} />
              </button>
            )}
          </label>
          <select
            aria-label="Wortart filtern"
            value={pos}
            onChange={(e) => setPos(e.target.value)}
          >
            <option value="">Alle Wortarten</option>
            <option value="noun">Substantiv</option>
            <option value="verb">Verb</option>
            <option value="adj">Adjektiv</option>
            <option value="adv">Adverb</option>
            <option value="phrase">Wendung</option>
            <option value="prep">Präposition</option>
            <option value="conj">Konjunktion</option>
            <option value="pron">Pronomen</option>
            <option value="det">Begleiter</option>
            <option value="intj">Ausruf</option>
            <option value="num">Zahlwort</option>
          </select>
        </div>
        {!source && (
          <div className="filter-row">
            <select
              aria-label="Thema filtern"
              value={topic}
              onChange={(e) => {
                setTopicFilter(e.target.value);
                setLimit(60);
              }}
            >
              <option value="">Alle Themen</option>
              {content.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Status filtern"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Alle Status</option>
              <option value="regular">Im Training</option>
              <option value="archived">Archiviert</option>
            </select>
            <span className="small muted">{filtered.length} Lernziele</span>
          </div>
        )}
      </div>
      {source ? (
        <>
          <div className="info-strip">
            <BookOpen size={20} />
            <span>
              Häufige Wörter und ausgewählte Wendungen aus Wiktionary. Jedes
              Stichwort erscheint einmal. Klappe es auf und wähle die passende
              Bedeutung für dein Training.
            </span>
          </div>
          {loading ? (
            <div className="loading-inline">
              <LoaderCircle className="spin" />
              Wörterbuch wird vorbereitet …{" "}
              {progress < 100 ? `${progress} %` : ""}
            </div>
          ) : error ? (
            <Empty title="Wörterbuch nicht verfügbar" description={error} />
          ) : (
            <>
              <p className="small muted">
                {number(count)} Wörter und Wendungen
                {count > 100 ? " · die ersten 100 werden angezeigt" : ""}
              </p>
              <div className="dictionary-list">
                {results.map((word) => (
                  <SourceWord
                    key={`${word.word}:${query}:${pos}`}
                    word={word}
                    targets={targets}
                    onCustom={onCustom}
                  />
                ))}
              </div>
              {!results.length && (
                <Empty
                  title="Noch kein Treffer"
                  description="Versuche die englische Grundform. Deutsche Übersetzungen sind nicht für jede Bedeutung vorhanden."
                />
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="dictionary-list">
            {groups.slice(0, limit).map((group) =>
              group.targets.length === 1 ? (
                renderMeaning(group.targets[0])
              ) : (
                <details key={group.key} className="meaning-group">
                  <summary>
                    <strong>{group.label}</strong>
                    <span>{group.targets.length} Bedeutungen</span>
                    <ChevronDown size={18} />
                  </summary>
                  <p className="meaning-group-note">
                    Getrennte Lernziele – jede Bedeutung zählt für sich.
                  </p>
                  {group.targets.map(renderMeaning)}
                </details>
              ),
            )}
          </div>
          {groups.length > limit && (
            <button
              className="secondary load-more"
              onClick={() => setLimit(limit + 60)}
            >
              Weitere Einträge anzeigen
            </button>
          )}
          {!filtered.length && (
            <Empty
              title="Keine passenden Einträge"
              description="Ändere deine Filter oder lege einen eigenen Ausdruck an."
              action={
                <button
                  className="secondary"
                  onClick={() => onCustom({ word: query })}
                >
                  <Plus size={16} />
                  Eintrag anlegen
                </button>
              }
            />
          )}
        </>
      )}
    </>
  );
}

function ReviewStatus({
  review,
  busy,
  onRestore,
}: {
  review: ReviewEvent;
  busy: boolean;
  onRestore?: () => void;
}) {
  const [visible, setVisible] = useState(
    !review.good || Date.now() - Date.parse(review.at) < 4500,
  );
  useEffect(() => {
    if (!review.good) return;
    const timer = setTimeout(
      () => setVisible(false),
      Math.max(0, 4500 - (Date.now() - Date.parse(review.at))),
    );
    return () => clearTimeout(timer);
  }, [review.id, review.at, review.good]);
  if (!visible) return null;
  return (
    <div className={`review-status ${review.good ? "success" : "again"}`}>
      <div className="review-status-line" role="status" aria-atomic="true">
        {review.good ? <CheckCircle2 size={16} /> : <Undo2 size={16} />}
        <span>
          {review.good ? (
            "Richtig · gespeichert"
          ) : (
            <>
              Letzte Antwort: noch nicht · Lösung:{" "}
              <strong>{review.exercise.answer}</strong>
            </>
          )}
        </span>
      </div>
      {!review.good && (
        <details>
          <summary>Letzte Aufgabe & Erklärung</summary>
          <p>
            {review.exercise.prompt.replaceAll("___", review.exercise.answer)}
          </p>
          <p className="answer-explanation">{review.exercise.explanation}</p>
        </details>
      )}
      {!review.good && onRestore && (
        <button className="text-button" disabled={busy} onClick={onRestore}>
          Wieder regulär üben
        </button>
      )}
    </div>
  );
}

function Training({
  state,
  content,
  busy,
  act,
  onExit,
  onTopic,
  onParticipation,
  onReport,
  onArchive,
}: {
  state: AppState;
  content: Content;
  busy: boolean;
  act: Act;
  onExit: () => void;
  onTopic: () => void;
  onParticipation: (t: Target, p: AppState["participation"][string]) => void;
  onReport: (t: Target) => void;
  onArchive: () => void;
}) {
  const s = state.session,
    targets = allTargets(state, content);
  const nextRound = useMemo(
    () =>
      s?.finished
        ? planSession(
            state,
            content,
            new Date(),
            s.archiveTopic,
            s.topicId,
            s.subtopicId,
          )
        : null,
    [state, content, s?.finished, s?.archiveTopic, s?.topicId, s?.subtopicId],
  );
  const promptRef = useRef<HTMLHeadingElement>(null);
  const attemptId = s?.queue[s.index]?.attemptId;
  useEffect(() => {
    promptRef.current?.focus({ preventScroll: true });
  }, [attemptId, s?.finished]);
  if (!s)
    return (
      <Empty
        title="Deine nächste Lernzeit wartet"
        description="Starte dein Training auf der Heute-Seite."
        action={
          <button className="primary" onClick={onExit}>
            Zu Heute
          </button>
        }
      />
    );
  if (sessionTopicInactive(state, s))
    return (
      <Empty
        title="Dieses Thema ist inaktiv."
        description="Aktiviere es unter Themen, um deine gespeicherte Runde fortzusetzen."
        action={
          <button className="primary" onClick={onTopic}>
            Themen ansehen
          </button>
        }
      />
    );
  const done = state.events.filter((e) => !e.revokedAt && e.sessionId === s.id);
  const lastReview = done.at(-1);
  const reviewedTarget = targets.find((t) => t.id === lastReview?.targetId);
  const status = lastReview && (
    <ReviewStatus
      key={lastReview.id}
      review={{
        ...lastReview,
        exercise: withExerciseCues(lastReview.exercise, content),
      }}
      busy={busy}
      onRestore={
        lastReview.mode !== "regular" &&
        reviewedTarget &&
        state.participation[reviewedTarget.id] === "archived"
          ? () => onParticipation(reviewedTarget, "regular")
          : undefined
      }
    />
  );
  if (s.finished || s.index >= s.queue.length)
    return (
      <div className="session-complete">
        {status}
        <div className="completion-art">
          <CheckCheck size={48} />
          <span>✧</span>
        </div>
        <div className="eyebrow">
          {s.topicId
            ? content.topics.find((t) => t.id === s.topicId)?.title
            : "EIN SCHRITT WEITER"}
        </div>
        <h1>
          {done.length ? "Runde abgeschlossen." : "Keine Aufgaben offen."}
        </h1>
        <p>
          {done.length
            ? "Gut, dass du dir Zeit genommen hast. Deine Antworten sind gespeichert."
            : state.settings.limitNewPerDay
              ? "Gerade ist nichts fällig oder dein Tageslimit ist erreicht. Du kannst weitere Themen wählen oder das Tageslimit in den Einstellungen abschalten."
              : "Für deine Themen ist gerade nichts mehr fällig oder neu. Wähle weitere Themen oder ergänze Wörter aus dem Wörterbuch."}
        </p>
        <div className="completion-stats">
          <div>
            <strong>{done.length}</strong>
            <span>Aufgaben geübt</span>
          </div>
          <div>
            <strong>{done.filter((e) => e.good).length}</strong>
            <span>erfolgreich beantwortet</span>
          </div>
          <div>
            <strong>{new Set(done.map((e) => e.targetId)).size}</strong>
            <span>Lernziele berührt</span>
          </div>
        </div>
        <div className="button-row">
          {!!nextRound?.queue.length && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                act((d) => {
                  d.session = planSession(
                    d,
                    content,
                    new Date(),
                    s.archiveTopic,
                    s.topicId,
                    s.subtopicId,
                  );
                })
              }
            >
              Weitere Runde · {nextRound.queue.length} Aufgaben{" "}
              <ArrowRight size={17} />
            </button>
          )}
          <button className="secondary" onClick={onExit}>
            {s.topicId
              ? "Zurück zu Themen"
              : s.archiveTopic
                ? "Zurück zum Archiv"
                : "Zurück zu Heute"}
            <ArrowRight size={17} />
          </button>
          <button className="secondary" onClick={onTopic}>
            Themen ansehen
          </button>
        </div>
        {done.length > 0 && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => act((d) => undoReview(d))}
          >
            <Undo2 size={16} />
            Letzte Bewertung rückgängig
          </button>
        )}
        <p className="small muted">
          Eine richtige Antwort ist ein Lernschritt, kein Nachweis dauerhafter
          Beherrschung.
        </p>
      </div>
    );
  const item = s.queue[s.index],
    exercise = withExerciseCues(item.exercise, content),
    target = targets.find((t) => t.id === exercise.targetId)!,
    topic = content.topics.find(
      (t) => t.id === (item.topicId ?? target.ownerTopicId),
    )!;
  return (
    <div
      className={`training ${exercise.meaningCue ? "lexical-training" : ""}`}
    >
      <div className="training-top">
        <button className="text-button" onClick={onExit}>
          <ChevronLeft size={17} />
          Speichern & pausieren
        </button>
        <span>
          Aufgabe {s.index + 1} / {s.queue.length}
        </span>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            act((d) => {
              d.session!.finished = true;
            })
          }
        >
          Runde beenden
        </button>
      </div>
      <div
        className="training-progress"
        aria-label="Position in der Runde, einschließlich übersprungener Aufgaben"
      >
        <span style={{ width: `${(s.index / s.queue.length) * 100}%` }} />
      </div>
      <div className="training-topic">
        <TopicIcon topic={topic} size={18} />
        <span>
          {s.subtopicId
            ? topic.subtopics?.find((sub) => sub.id === s.subtopicId)?.title
            : s.topicId
              ? `Themenrunde · ${topic.title}`
              : topic.title}
        </span>
        <span className="pill">
          {item.mode === "regular"
            ? item.retryOf
              ? "Noch einmal üben"
              : exercise.channel === "productive_recall"
                ? "Deutsch → Englisch"
                : exercise.channel === "receptive_recall"
                  ? "Englisch → Deutsch"
                  : exercise.mode === "choice"
                    ? "Grammatik auswählen"
                    : exercise.writing
                      ? writingLabels[exercise.writing.kind]
                      : "Grammatik abrufen"
            : "Archiv auffrischen"}
        </span>
      </div>
      <div className="review-status-slot">{status}</div>
      <section
        key={item.attemptId}
        className={`exercise-card ${s.revealed ? "revealed" : ""} ${exercise.meaningCue ? "has-meaning" : ""} ${exercise.writing ? "has-writing" : ""}`}
      >
        <div className="small-label">{exercise.context}</div>
        {exercise.translation && (
          <div className="grammar-cue">
            <span className="small-label">DAS SOLL DER SATZ SAGEN</span>
            <p>{exercise.translation}</p>
          </div>
        )}
        {exercise.writing && (
          <p className="writing-instruction">{exercise.writing.instruction}</p>
        )}
        <h1
          ref={promptRef}
          tabIndex={-1}
          lang={exercise.channel === "productive_recall" ? "de" : "en"}
        >
          {exercise.prompt.split("___").map((part, i) => (
            <span key={i}>
              {i > 0 && (
                <span className="blank">
                  {s.revealed ? exercise.answer : "…"}
                </span>
              )}
              {part}
            </span>
          ))}
        </h1>
        {exercise.meaningCue && (
          <div className="meaning-cue">
            <span className="small-label">GEMEINTE BEDEUTUNG</span>
            <p lang={exercise.channel === "productive_recall" ? "de" : "en"}>
              {exercise.meaningCue}
            </p>
          </div>
        )}
        {exercise.hint &&
          (exercise.writing ? (
            <details className="writing-hint">
              <summary>Tipp anzeigen</summary>
              <p className="grammar-hint">{exercise.hint}</p>
            </details>
          ) : (
            <p className="grammar-hint">{exercise.hint}</p>
          ))}
        {exercise.writing && (
          <WritingPractice
            key={item.attemptId}
            exercise={exercise}
            storedDraft={item.draftAnswer ?? ""}
            revealed={s.revealed}
            busy={busy}
            onSave={(value, reveal) =>
              act((draft) => {
                const current = draft.session?.queue[draft.session.index];
                if (!current || current.attemptId !== item.attemptId)
                  throw new Error(
                    "Die Aufgabe hat sich geändert. Bitte prüfe deinen aktuellen Stand.",
                  );
                current.draftAnswer = value;
                if (reveal) draft.session!.revealed = true;
              })
            }
          />
        )}
        {exercise.mode === "recall" && !exercise.writing && !s.revealed && (
          <>
            <p className="think-hint">
              Rufe die Antwort ab, bevor du die Lösung ansiehst.
            </p>
            <button
              className="primary reveal-button"
              disabled={busy}
              onClick={(event) =>
                event.detail < 2 &&
                act((d) => {
                  d.session!.revealed = true;
                })
              }
            >
              Antwort zeigen
              <ArrowRight size={18} />
            </button>
          </>
        )}
        {exercise.mode === "choice" && (
          <div className="answer-options">
            {exercise.options.map((option, i) => (
              <button
                key={option}
                disabled={busy}
                onClick={(event) =>
                  event.detail < 2 &&
                  act((d) =>
                    commitReview(
                      d,
                      content,
                      item.attemptId,
                      option === exercise.answer,
                      option,
                    ),
                  )
                }
              >
                <span className="option-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            ))}
          </div>
        )}
        {s.revealed && (
          <div className="answer-reveal">
            {exercise.mode === "recall" && (
              <>
                <span className="small-label">
                  {target.kind === "lexical"
                    ? exercise.channel === "receptive_recall"
                      ? "AUF DEUTSCH"
                      : "AUF ENGLISCH"
                    : exercise.writing
                      ? "EINE MUSTERLÖSUNG"
                      : "DIE ANTWORT"}
                </span>
                <h2
                  lang={exercise.channel === "receptive_recall" ? "de" : "en"}
                >
                  {exercise.answer}
                </h2>
                {exercise.alternatives.length > 0 && (
                  <p>Auch möglich: {exercise.alternatives.join(" · ")}</p>
                )}
              </>
            )}
            {exercise.explanation && (
              <p className="answer-explanation">{exercise.explanation}</p>
            )}
            {exercise.writing && (
              <ul className="writing-checkpoints">
                {exercise.writing.checkpoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            {exercise.mode === "recall" && (
              <>
                <div className="rating-buttons">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={(event) =>
                      event.detail < 2 &&
                      act((d) =>
                        commitReview(d, content, item.attemptId, false, null),
                      )
                    }
                  >
                    <Undo2 size={18} />
                    Noch nicht
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={(event) =>
                      event.detail < 2 &&
                      act((d) =>
                        commitReview(d, content, item.attemptId, true, null),
                      )
                    }
                  >
                    <Check size={19} />
                    Gewusst
                  </button>
                </div>
                <p className="small muted">
                  „Gewusst“ heißt: selbst abgerufen, bevor du die Lösung gesehen
                  hast.
                </p>
              </>
            )}
          </div>
        )}
      </section>
      <div className="training-tools">
        <button
          disabled={busy || !done.length}
          onClick={() => act((d) => undoReview(d))}
        >
          <Undo2 size={16} />
          Rückgängig
        </button>
        <button
          disabled={busy}
          onClick={() => onParticipation(target, "archived")}
        >
          <Archive size={16} />
          Archivieren
        </button>
        <button onClick={() => onReport(target)}>
          <CircleHelp size={16} />
          Inhalt melden
        </button>
      </div>
      <div className="training-foot">
        <ShieldCheck size={14} />
        Dein Fortschritt wird nach jeder Antwort gespeichert.
        <button className="text-button" onClick={onArchive}>
          <Archive size={14} />
          Archiv anzeigen
        </button>
      </div>
    </div>
  );
}

function DataPage({
  state,
  content,
  busy,
  act,
  onState,
  notify,
  installPrompt,
  onInstall,
}: {
  state: AppState;
  content: Content;
  busy: boolean;
  act: Act;
  onState: (s: AppState) => void;
  notify: (s: string) => void;
  installPrompt: unknown;
  onInstall: () => void;
}) {
  const [preview, setPreview] = useState<BackupPayload | null>(null),
    [fileName, setFileName] = useState(""),
    [importBusy, setImportBusy] = useState(false),
    [recovery, setRecovery] = useState<AppState | null>(null),
    [persistent, setPersistent] = useState<boolean | null>(null),
    [storage, setStorage] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [limitDraft, setLimitDraft] = useState(state.settings.limitNewPerDay);
  const [exportBusy, setExportBusy] = useState(false);
  const exportLock = useRef(false);
  async function saveFile(text: Promise<string> | string, name: string) {
    if (exportLock.current) return;
    exportLock.current = true;
    setExportBusy(true);
    try {
      const result = await downloadText(await text, name);
      notify(
        result === "shared"
          ? "Datei an den Teilen-Dialog übergeben. Prüfe, ob du sie am gewünschten Ort gespeichert hast."
          : "Exportdatei erstellt. Bewahre sie an einem sicheren Ort auf.",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export fehlgeschlagen.");
    } finally {
      exportLock.current = false;
      setExportBusy(false);
    }
  }
  useEffect(
    () => setLimitDraft(state.settings.limitNewPerDay),
    [state.settings.limitNewPerDay],
  );
  useEffect(() => {
    getRecovery().then(setRecovery);
    navigator.storage?.persisted?.().then(setPersistent);
    navigator.storage?.estimate?.().then((e) => setStorage(e.usage ?? 0));
  }, []);
  async function readFile(file: File) {
    setImportBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Die Datei ist größer als 50 MB.");
      const parsed = await parseBackup(await file.text());
      const unknown = parsed.content.topics.filter(
        (t) => !content.topics.some((x) => x.id === t.id),
      );
      if (unknown.length)
        throw new Error(
          "Diese Sicherung enthält Themen einer neueren App-Version. Bitte aktualisiere zuerst die App.",
        );
      setPreview(parsed);
      setFileName(file.name);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    } finally {
      setImportBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function performImport() {
    if (!preview || importBusy) return;
    setImportBusy(true);
    try {
      const result = await replaceState(
        restoredState(preview, content),
        state.revision,
      );
      onState(result);
      setRecovery(await getRecovery());
      setPreview(null);
      notify(
        "Lernstand übernommen. Der vorherige Stand liegt als Rücksicherung bereit.",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    } finally {
      setImportBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">REGISTER / DATEN</div>
        <h1>Deine Daten.</h1>
        <p>
          Sichere deinen Lernstand und lerne auf einem anderen Gerät weiter.
        </p>
      </div>
      <div className="backup-grid">
        <section className="backup-card export">
          <span className="backup-icon">
            <ArrowDownToLine size={26} />
          </span>
          <h2>Lernstand exportieren</h2>
          <p>
            Deine Antworten, Wiederholungszeiten, Themen, eigenen Einträge und
            alle angefangenen Trainingsrunden in einer Datei.
          </p>
          <div className="backup-summary">
            <span>
              {state.events.filter((e) => !e.revokedAt).length} Antworten
            </span>
            <span>
              {
                state.personalTargets.filter(
                  (t) => t.reviewStatus === "personal",
                ).length
              }{" "}
              eigene Einträge
            </span>
            <span>JSON · Format v1</span>
          </div>
          <button
            className="primary"
            disabled={exportBusy}
            onClick={() =>
              saveFile(
                exportBackup(state, content),
                `einfach-englisch-lernstand-${dayKey(new Date(), state.settings.timezone)}.json`,
              )
            }
          >
            <Download size={18} />
            {isNative
              ? "Lernstand speichern / teilen"
              : "Lernstand herunterladen"}
          </button>
          <p className="small muted">
            Die Datei enthält deine persönlichen Lerninformationen.
          </p>
        </section>
        <section className="backup-card">
          <span className="backup-icon pale">
            <ArrowUpFromLine size={26} />
          </span>
          <h2>Lernstand importieren</h2>
          <p>
            Wähle eine Lernstand-Sicherung von deinem anderen Gerät. Vor der
            Übernahme kannst du den Inhalt prüfen.
          </p>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
          >
            <ArrowUpFromLine size={25} />
            <span>
              {isNative
                ? "Sicherung vom Gerät öffnen"
                : "JSON-Datei hier ablegen"}
            </span>
            <small>oder vom Gerät auswählen</small>
            <button
              className="secondary"
              disabled={importBusy}
              onClick={() => input.current?.click()}
            >
              {importBusy ? "Datei wird geprüft …" : "Sicherung auswählen"}
            </button>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              aria-label="Sicherungsdatei auswählen"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
              }}
              hidden
            />
          </div>
        </section>
      </div>
      {recovery && (
        <div className="recovery-banner">
          <ShieldCheck size={21} />
          <div>
            <strong>Rücksicherung vor dem letzten Import</strong>
            <p>
              {date(recovery.updatedAt)} ·{" "}
              {recovery.events.filter((e) => !e.revokedAt).length} Antworten.
              Auch als Datei speicherbar.
            </p>
          </div>
          <button
            className="text-button"
            disabled={exportBusy}
            onClick={() =>
              saveFile(
                exportBackup(recovery, content),
                "einfach-englisch-ruecksicherung.json",
              )
            }
          >
            Herunterladen
          </button>
          <button
            className="secondary"
            disabled={importBusy}
            onClick={() => {
              setPreview({
                state: recovery,
                content: {
                  version: content.version,
                  targets: allTargets(recovery, content),
                  exercises: allExercises(recovery, content),
                  topics: content.topics,
                },
              });
              setFileName("Lokale Rücksicherung");
            }}
          >
            Wiederherstellen
          </button>
        </div>
      )}
      <div className="transfer-note">
        <MonitorSmartphone size={27} />
        <div>
          <h3>Am Rechner üben. Unterwegs weitermachen.</h3>
          <p>
            Exportiere deinen Stand, übertrage die Datei und importiere sie auf
            dem Zielgerät. Die Übernahme ersetzt den dortigen Stand; zwei
            parallele Verläufe werden nicht zusammengeführt. Web-App, Android
            und iOS verwenden dasselbe Dateiformat.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Dein Training</h2>
          <LevelControl
            value={state.settings.level}
            targets={allTargets(state, content)}
            disabled={busy}
            onChange={(level) =>
              act((s) => {
                s.settings.level = level;
              })
            }
          />
          <TimeBudget
            value={state.settings.minutes}
            disabled={busy}
            onChange={(minutes) =>
              act((s) => {
                s.settings.minutes = minutes;
              })
            }
          />
          <label>
            Trainingsauswahl
            <select
              value={state.settings.mode}
              onChange={(e) => {
                const mode = e.target.value as AppState["settings"]["mode"];
                act((s) => {
                  s.settings.mode = mode;
                });
              }}
              disabled={busy}
            >
              <option value="mixed">Wortschatz & Grammatik</option>
              <option value="words">Nur Wortschatz</option>
              <option value="grammar">Nur Grammatik</option>
            </select>
          </label>
          <label className="daily-limit-toggle">
            <input
              type="checkbox"
              checked={limitDraft}
              disabled={busy}
              onChange={async (e) => {
                const enabled = e.target.checked;
                setLimitDraft(enabled);
                const saved = await act((s) => {
                  s.settings.limitNewPerDay = enabled;
                });
                if (!saved) setLimitDraft(state.settings.limitNewPerDay);
              }}
            />
            Neue Inhalte pro Tag begrenzen
          </label>
          <p className="small muted">
            Ohne Tageslimit füllen neue Inhalte deine Runde auf. Bereits geübte
            Wörter kommen wieder, wenn sie fällig sind.
          </p>
          {limitDraft && (
            <>
              <label>
                Neue Wörter pro Tag
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={state.settings.newPerDay}
                  onChange={(e) => {
                    const count = Math.max(
                      0,
                      Math.min(50, Number(e.target.value)),
                    );
                    act((s) => {
                      s.settings.newPerDay = count;
                    });
                  }}
                  disabled={busy}
                />
              </label>
              <label>
                Neue Grammatiklernziele pro Tag
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={state.settings.grammarPerDay}
                  onChange={(e) => {
                    const count = Math.max(
                      0,
                      Math.min(10, Number(e.target.value)),
                    );
                    act((s) => {
                      s.settings.grammarPerDay = count;
                    });
                  }}
                  disabled={busy}
                />
              </label>
            </>
          )}
          <p className="small muted">
            Wiederholungen haben Vorrang. Eine begonnene Sitzung behält ihre
            geplante Länge. Lerntage richten sich nach {state.settings.timezone}
            .
          </p>
        </section>
        <section className="panel">
          <h2>Auf diesem Gerät</h2>
          <div className="storage-status">
            <ShieldCheck size={28} />
            <div>
              <strong>
                {isNative
                  ? "Lokaler App-Speicher"
                  : persistent
                    ? "Dauerhafter Speicher erlaubt"
                    : "Lokaler Browserspeicher"}
              </strong>
              <p>
                {isNative
                  ? "Dein Lernstand bleibt auf diesem Gerät."
                  : storage === null
                    ? "Speicherbelegung wird ermittelt."
                    : `${(storage / 1024 / 1024).toFixed(1)} MB lokal belegt`}
              </p>
            </div>
          </div>
          <p className="small muted">
            {isNative
              ? "Sichere deinen Stand vor einer Deinstallation oder dem Löschen der App-Daten als Datei."
              : "Dauerhafter Speicher schützt besser vor automatischer Bereinigung. Manuell gelöschte Browserdaten lassen sich nur mit einer Sicherung wiederherstellen."}
          </p>
          {!isNative && (
            <button
              className="secondary"
              onClick={async () => {
                const ok = await navigator.storage?.persist?.();
                setPersistent(!!ok);
                notify(
                  ok
                    ? "Dauerhafter Speicher ist erlaubt."
                    : "Der Browser hat keinen dauerhaften Speicher zugesagt. Deine Exportdatei bleibt die verlässliche Sicherung.",
                );
              }}
            >
              Dauerhaften Speicher anfragen
            </button>
          )}
          {!isNative && (
            <div className="setting-section">
              <h3>Wie eine App verwenden</h3>
              <p>
                Installiere Einfach Englisch für ein eigenes Fenster und
                schnellen Zugriff vom Startbildschirm.
              </p>
              <button className="secondary" onClick={onInstall}>
                <Plus size={17} />
                {installPrompt
                  ? "Einfach Englisch installieren"
                  : "Installationshinweis"}
              </button>
            </div>
          )}
          <div className="setting-section">
            <h3>Lokale Inhaltsmeldungen</h3>
            <p className="small muted">
              {state.reports.length} Notizen, bisher nur auf diesem Gerät
              gespeichert.
            </p>
            <button
              className="text-button"
              disabled={exportBusy || !state.reports.length}
              onClick={() =>
                saveFile(
                  JSON.stringify(
                    {
                      format: "wortnah-content-reports",
                      reports: state.reports,
                    },
                    null,
                    2,
                  ),
                  "einfach-englisch-inhaltsmeldungen.json",
                )
              }
            >
              <Download size={16} />
              Notizen exportieren
            </button>
          </div>
        </section>
      </div>
      <section className="panel delete-section">
        <h3>Lokale Lerndaten löschen</h3>
        <p className="small muted">
          Entfernt Lernverlauf, eigene Einträge, Einstellungen und die lokale
          Rücksicherung auf diesem Gerät. Exportdateien bleiben bestehen.
        </p>
        <button
          className="text-button danger-text"
          onClick={() => setDeleteDialog(true)}
        >
          Alle lokalen Lerndaten löschen
        </button>
      </section>
      {deleteDialog && (
        <Modal
          title="Lokale Lerndaten löschen?"
          onClose={() => setDeleteDialog(false)}
        >
          <p>
            Diese Aktion lässt sich nur mit einer zuvor exportierten Datei
            rückgängig machen. Auch die lokale Rücksicherung wird gelöscht.
          </p>
          <label>
            Zur Bestätigung LÖSCHEN eingeben
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => setDeleteDialog(false)}
            >
              Abbrechen
            </button>
            <button
              className="primary"
              disabled={deleteConfirm !== "LÖSCHEN" || importBusy}
              onClick={async () => {
                setImportBusy(true);
                try {
                  onState(
                    await deleteLocalProfile(content.topics, state.revision),
                  );
                  setRecovery(null);
                  setDeleteDialog(false);
                  setDeleteConfirm("");
                  notify("Lokale Lerndaten gelöscht. Du kannst neu anfangen.");
                } catch (e) {
                  notify(
                    e instanceof Error ? e.message : "Löschen fehlgeschlagen.",
                  );
                } finally {
                  setImportBusy(false);
                }
              }}
            >
              Jetzt löschen
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal
          title="Sicherung prüfen und übernehmen"
          onClose={() => !importBusy && setPreview(null)}
        >
          <p className="file-name">
            <Database size={20} />
            {fileName}
          </p>
          <dl className="import-preview">
            <div>
              <dt>Letzter Stand</dt>
              <dd>{date(preview.state.updatedAt)}</dd>
            </div>
            <div>
              <dt>Gespeicherte Antworten</dt>
              <dd>{preview.state.events.filter((e) => !e.revokedAt).length}</dd>
            </div>
            <div>
              <dt>Lernstände nach Abrufrichtung</dt>
              <dd>{Object.keys(preview.state.memory).length}</dd>
            </div>
            <div>
              <dt>Eigene Einträge</dt>
              <dd>
                {
                  preview.state.personalTargets.filter(
                    (t) => t.reviewStatus === "personal",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Fortsetzbare Trainingsrunden</dt>
              <dd>
                {
                  [
                    preview.state.session,
                    ...preview.state.savedSessions,
                  ].filter((s) => s && !s.finished).length
                }
              </dd>
            </div>
          </dl>
          <div className="import-warning">
            <AlertCircle size={20} />
            <p>
              <strong>Der aktuelle Stand auf diesem Gerät wird ersetzt.</strong>
              <br />
              Vorher wird eine lokale Rücksicherung erstellt. Es findet keine
              Zusammenführung statt.
            </p>
          </div>
          <div className="button-row">
            <button
              className="secondary"
              disabled={importBusy}
              onClick={() => setPreview(null)}
            >
              Abbrechen
            </button>
            <button
              className="primary"
              disabled={importBusy}
              onClick={performImport}
            >
              {importBusy ? "Wird übernommen …" : "Diesen Lernstand übernehmen"}
              <Check size={18} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
