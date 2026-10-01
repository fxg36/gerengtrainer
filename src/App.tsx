import {
  useCallback,
  useEffect,
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
  Circle,
  Pause,
  Play,
  AlertCircle,
  ExternalLink,
  Clock3,
  Bookmark,
  Ban,
  Pencil,
  MonitorSmartphone,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  allTargets,
  allExercises,
  exerciseSchema,
  targetSchema,
  topicSchema,
  lexicalExercises,
  memoryKey,
  uid,
  type AppState,
  type Content,
  type Target,
  type Topic,
  type DictionaryWord,
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
  normalizeSession,
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

type Page = "today" | "topics" | "dictionary" | "progress" | "data" | "session";
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
};
const number = (n: number) => n.toLocaleString("de-DE");
const date = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const modes = { learn: "Lernen", maintain: "Erhalten", paused: "Pausiert" };
const statusLabels = {
  regular: "Im Training",
  archived: "Archiviert",
  excluded: "Ausgeschlossen",
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
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
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
        <h2>{title}</h2>
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
    [onboarding, setOnboarding] = useState(false),
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
  const [offlineReady, setOfflineReady] = useState(false);
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
          w<span>·</span>
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
  const activeTopics = content.topics.filter(
    (t) => state.preferences[t.id]?.mode !== "paused",
  );
  const due = targets.filter(
    (t) =>
      (state.participation[t.id] ?? "regular") === "regular" &&
      state.preferences[t.ownerTopicId]?.mode !== "paused" &&
      Object.entries(state.memory).some(
        ([key, c]) =>
          key.startsWith(t.id + "~") && Date.parse(c.due) <= Date.now(),
      ),
  ).length;
  const start = async (archiveTopic: string | null = null) => {
    if (!state.settings.onboarded && !archiveTopic) {
      setOnboarding(true);
      return;
    }
    if (state.session && !state.session.finished && !archiveTopic) {
      if (await act(() => {})) navigate("session");
      return;
    }
    if (
      await act((s) => {
        s.session = planSession(s, content, new Date(), archiveTopic);
      })
    )
      navigate("session");
  };
  const participation = async (
    target: Target,
    value: "regular" | "archived" | "excluded",
  ) => {
    if (await act((s) => setParticipation(s, target.id, value))) {
      setToast(
        value === "regular"
          ? "Wieder im regulären Training."
          : value === "archived"
            ? "Archiviert. Dein Lernstand bleibt erhalten."
            : "Ausgeschlossen. Dein Lernstand bleibt erhalten.",
      );
      setDetail(null);
    }
  };
  const navItems: { id: Page; label: string; icon: typeof House }[] = [
    { id: "today", label: "Heute", icon: House },
    { id: "topics", label: "Themen", icon: Layers3 },
    { id: "dictionary", label: "Wörterbuch", icon: BookOpen },
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
            w<span>·</span>
          </div>
          <span>
            wortnah<span className="brand-sub">ENGLISCH FÜR DEINEN ALLTAG</span>
          </span>
        </a>
        <div className="nav-label">DEIN LERNRAUM</div>
        <nav aria-label="Hauptnavigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              {label}
              {id === "today" && due > 0 && (
                <span className="nav-count">{due}</span>
              )}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={21} />
            <strong>
              Dein Fortschritt.
              <br />
              Dein Gerät.
            </strong>
            <p>Ohne Konto. In deinem Tempo.</p>
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
            Gut zu wissen
          </button>
          <div className="sidebar-foot">
            <span className="status-dot" />
            PWA · Testversion 0.1
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
              Dein Englisch<span>/</span>
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
                <div className="eyebrow">EIN KLEINER SCHRITT. JEDEN TAG.</div>
                <h1>
                  Ein guter Tag für dein Englisch
                  <span className="heading-dot">.</span>
                </h1>
                <p>Die richtigen Worte für das, was dich im Alltag bewegt.</p>
              </div>
              <div className="today-layout">
                <div className="today-primary">
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-label">
                        <span className="tiny-spark">✳</span> DEINE TÄGLICHE
                        LERNZEIT
                      </span>
                      <h2>
                        Mehr im Kopf.
                        <br />
                        Mehr im Gespräch.
                      </h2>
                      <p>
                        Wörter festigen, Neues entdecken und
                        <br className="desktop-only" /> ganz nebenbei sicherer
                        formulieren.
                      </p>
                      <button
                        className="cream-button"
                        disabled={busy}
                        onClick={() => start()}
                      >
                        {state.session && !state.session.finished
                          ? "Training fortsetzen"
                          : !state.settings.onboarded
                            ? "Mein Training einrichten"
                            : "Training starten"}
                        <ArrowRight size={19} />
                      </button>
                      <div className="hero-meta">
                        <Clock3 size={14} />
                        Bis zu {state.settings.minutes} Minuten<span>·</span>
                        Dein Tempo zählt
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <span className="art-star star-one">✳</span>
                      <span className="art-star star-two">✧</span>
                      <div className="floating-card back-card">
                        <span>ONE WORD AT A TIME</span>
                        <div>little by little</div>
                      </div>
                      <div className="floating-card front-card">
                        <span>FÜR DIE KLEINEN FORTSCHRITTE</span>
                        <div>
                          little by little<span className="card-period">.</span>
                        </div>
                        <p>Stück für Stück</p>
                        <span className="art-card-footer">
                          <CheckCircle2 size={15} /> Etwas bleibt immer hängen.
                        </span>
                      </div>
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
                  <div className="section-heading">
                    <div>
                      <h2>Deine Themen</h2>
                      <p>Dein Alltag bestimmt, was du lernst.</p>
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
                        const tt = targets.filter(
                            (t) => t.ownerTopicId === topic.id,
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
                      <h3>Dein Lernrhythmus</h3>
                      <Clock3 size={18} />
                    </div>
                    <p>Wie viel Zeit möchtest du dir nehmen?</p>
                    <div className="segmented" aria-label="Lernzeit">
                      {[10, 20, 40].map((minutes) => (
                        <button
                          key={minutes}
                          className={
                            state.settings.minutes === minutes ? "selected" : ""
                          }
                          disabled={busy}
                          onClick={() =>
                            act((s) => {
                              s.settings.minutes = minutes;
                            })
                          }
                        >
                          {minutes}
                          <span>Min.</span>
                        </button>
                      ))}
                    </div>
                    <div className="rhythm-divider" />
                    <div className="small-label">DIESE WOCHE</div>
                    <Week state={state} />
                    <p className="small week-note">
                      {todayEvents.length
                        ? "Schön, dass du dir heute Zeit genommen hast."
                        : "Eine kleine Routine kann viel bewegen."}
                    </p>
                  </section>
                  <section className="word-card">
                    <div className="word-label">
                      <Sparkles size={16} /> EIN AUSDRUCK FÜR HEUTE
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
                  <div className="gentle-note">
                    <Leaf size={19} />
                    <p>
                      Du musst nicht alles wissen.
                      <br />
                      <strong>Nur neugierig bleiben.</strong>
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {page === "topics" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">WAS DICH BEWEGT</div>
                <h1>Deine Welt. Deine Wörter.</h1>
                <p>
                  Wähle deine Themen und entscheide, was gerade zu dir passt.
                </p>
              </div>
              <div className="info-strip">
                <Layers3 size={20} />
                <span>
                  <strong>Lernen</strong> bringt Neues dazu.{" "}
                  <strong>Erhalten</strong> wiederholt Bekanntes.{" "}
                  <strong>Pausiert</strong> lässt deinen Stand ruhen.
                </span>
              </div>
              <div className="topic-grid">
                {content.topics.map((topic) => {
                  const items = targets.filter(
                      (t) => t.ownerTopicId === topic.id,
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
                          <span className={`mode-badge ${pref.mode}`}>
                            {modes[pref.mode]}
                          </span>
                        </div>
                        <h3>{topic.title}</h3>
                        <p>{topic.description}</p>
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
                      </button>
                      <div
                        className="mode-select"
                        aria-label={`Modus für ${topic.title}`}
                      >
                        {(["learn", "maintain", "paused"] as const).map(
                          (mode) => (
                            <button
                              disabled={busy}
                              key={mode}
                              className={pref.mode === mode ? "selected" : ""}
                              onClick={() =>
                                act((s) => setTopic(s, topic.id, { mode }))
                              }
                            >
                              {modes[mode]}
                            </button>
                          ),
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
          {page === "progress" && <Progress state={state} content={content} />}
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
              onExit={() => navigate("today")}
              onTopic={() => navigate("topics")}
              onParticipation={participation}
              onReport={setReport}
            />
          )}
          <footer className="page-footer">
            <span>Wortnah · Ein bisschen sicherer. Jeden Tag.</span>
            <button onClick={() => setHelp(true)}>Inhalte & Quellen</button>
          </footer>
        </main>
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
      {onboarding && (
        <Onboarding
          content={content}
          state={state}
          onClose={() => setOnboarding(false)}
          onSave={async (ids, minutes) => {
            if (
              await act((s) => {
                for (const topic of content.topics)
                  setTopic(s, topic.id, {
                    mode: ids.includes(topic.id) ? "learn" : "paused",
                  });
                s.settings.minutes = minutes;
                s.settings.onboarded = true;
                s.session = planSession(s, content);
              })
            ) {
              setOnboarding(false);
              navigate("session");
            }
          }}
        />
      )}
      {topicDetail && (
        <Modal title={topicDetail.title} onClose={() => setTopicDetail(null)}>
          <TopicSettings
            topic={topicDetail}
            state={state}
            content={content}
            act={act}
            busy={busy}
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
            {detail.gloss && <p className="source-gloss">{detail.gloss}</p>}
            {detail.example && <blockquote>{detail.example}</blockquote>}
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
                            content.topics.find((t) => t.id === v)?.title ?? v,
                        )
                        .join(" · ")}
                    </dd>
                  </div>
                ))}
            </dl>
            <p className="small muted">
              Zuständiges Trainingsthema:{" "}
              {content.topics.find((t) => t.id === detail.ownerTopicId)?.title}.
              Weitere Themen sind Suchmerkmale.
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
              <button
                className="text-button danger-text"
                disabled={busy}
                onClick={() => participation(detail, "excluded")}
              >
                <Ban size={16} />
                Ausschließen
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
                  setParticipation(s, report.id, "excluded");
                })
              ) {
                setReport(null);
                setToast(
                  "Lokal notiert und aus dem Training genommen. Es wurde nichts versendet.",
                );
              }
            }}
          >
            <p>
              Was ist bei „{report.word}“ unklar? Der Eintrag wird
              ausgeschlossen, bis du ihn wieder freigibst.
            </p>
            <label>
              Deine Notiz
              <textarea name="note" required maxLength={2000} rows={4} />
            </label>
            <button className="primary" type="submit" disabled={busy}>
              Notieren & ausschließen
            </button>
          </form>
        </Modal>
      )}
      {help && (
        <Modal title="Gut zu wissen" onClose={() => setHelp(false)}>
          <div className="help-content">
            <h3>Englisch für deinen Alltag</h3>
            <p>
              Wortnah trainiert Wortabruf, Bedeutungen und schriftliche
              Grammatik. Die App misst keine Aussprache, kein Hörverstehen und
              kein allgemeines Sprachniveau.
            </p>
            <h3>Dein Lernstand bleibt lokal</h3>
            <p>
              Training und eigene Inhalte werden in diesem Browser gespeichert.
              Sichere deinen Stand regelmäßig unter „Daten & Einstellungen“.
              Ohne Sicherung können beim Löschen der Browserdaten Lernstände
              verloren gehen.
            </p>
            <h3>Wörterbuch und Testinhalte</h3>
            <p>
              {number(
                content.manifest.sourceWordCount ??
                  content.manifest.sourceCount,
              )}{" "}
              Wörter und Wendungen stehen im kompakten Wörterbuch bereit. Ihre
              unterschiedlichen Bedeutungen sind unter einem Stichwort
              zusammengefasst.{" "}
              {targets.filter((t) => t.kind === "lexical").length} aufbereitete
              Wörter und Wendungen und 150 Grammatikvarianten bilden den
              Testbestand. Deutsche Übersetzungen und Themenzuordnungen sind
              Entwürfe; die menschliche Fachprüfung steht noch aus.
            </p>
            <p>
              Quelle:{" "}
              <a
                href="https://en.wiktionary.org"
                target="_blank"
                rel="noreferrer"
              >
                Wiktionary und seine Mitwirkenden
              </a>
              , extrahiert über{" "}
              <a
                href="https://kaikki.org/dictionary/rawdata.html"
                target="_blank"
                rel="noreferrer"
              >
                Kaikki/Wiktextract
              </a>
              . Wörterbuchinhalte:{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA 4.0
              </a>
              . Auswahl, deutsche Lernbedeutungen und Zuordnungen wurden
              bearbeitet. Quellenlinks stehen an den Einträgen.{" "}
              <a href="/licenses/NOTICE.txt" target="_blank" rel="noreferrer">
                Vollständige Quellen- und Lizenzhinweise
              </a>
            </p>
            <p>
              Die Katalogauswahl nutzt wordfreq-Häufigkeitsschätzungen
              (Sprachdaten bis etwa 2021). Sie sind kein Nachweis für die
              Häufigkeit einer einzelnen Bedeutung. Der Katalog enthält auch
              noch Fachbegriffe; seine Alltagsfilterung ist vorläufig.
            </p>
            <h3>Offline lernen</h3>
            <p>
              Beim ersten vollständigen Laden werden App und Inhalte
              gespeichert. Danach kannst du offline lernen. Es gibt keine
              Werbung, Analyse-Tracker oder KI-Aufrufe während des Trainings.
            </p>
            <h3>Vom Rechner aufs nächste Gerät</h3>
            <p>
              Die JSON-Sicherung lässt sich in diese PWA auf einem anderen Gerät
              importieren. Das Format ist für die spätere Wortnah-Android-App
              vorbereitet. Fremde Lern-Apps benötigen einen passenden Importer.
            </p>
          </div>
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

function Onboarding({
  content,
  state,
  onSave,
  onClose,
}: {
  content: Content;
  state: AppState;
  onSave: (ids: string[], minutes: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState([
      "home",
      "travel",
      "phrases",
      "grammar",
    ]),
    [minutes, setMinutes] = useState(state.settings.minutes);
  return (
    <Modal title="Mach es zu deinem Training" onClose={onClose} wide>
      <p className="modal-intro">
        Womit möchtest du anfangen? Du kannst deine Auswahl jederzeit ändern.
        Dein Fortschritt wird nur auf deinem Gerät gespeichert.
      </p>
      <div className="onboarding-topics">
        {content.topics.map((t) => (
          <button
            key={t.id}
            className={selected.includes(t.id) ? "chosen" : ""}
            aria-pressed={selected.includes(t.id)}
            onClick={() =>
              setSelected((ids) =>
                ids.includes(t.id)
                  ? ids.filter((id) => id !== t.id)
                  : [...ids, t.id],
              )
            }
          >
            <TopicIcon topic={t} size={18} />
            <span>{t.title}</span>
            {selected.includes(t.id) ? (
              <CheckCircle2 size={18} />
            ) : (
              <Circle size={18} />
            )}
          </button>
        ))}
      </div>
      <div className="onboarding-bottom">
        <div>
          <span className="small-label">DEINE LERNZEIT</span>
          <div className="minute-buttons">
            {[10, 20, 40].map((n) => (
              <button
                className={minutes === n ? "selected" : ""}
                key={n}
                onClick={() => setMinutes(n)}
              >
                {n} Min.
              </button>
            ))}
          </div>
        </div>
        <button
          className="primary"
          disabled={!selected.length}
          onClick={() => onSave(selected, minutes)}
        >
          Los geht’s
          <ArrowRight size={18} />
        </button>
      </div>
      <p className="small muted">
        Testbestand: Die fachliche Freigabe der Inhalte steht noch aus.
      </p>
    </Modal>
  );
}

type Act = (fn: (state: AppState) => void) => Promise<boolean>;
function TopicSettings({
  topic,
  state,
  content,
  act,
  busy,
  onArchive,
  onWord,
}: {
  topic: Topic;
  state: AppState;
  content: Content;
  act: Act;
  busy: boolean;
  onArchive: () => void;
  onWord: (t: Target) => void;
}) {
  const pref = state.preferences[topic.id],
    targets = allTargets(state, content).filter(
      (t) => t.ownerTopicId === topic.id,
    ),
    archived = targets.filter((t) => state.participation[t.id] === "archived");
  const [filter, setFilter] = useState("all");
  return (
    <div className="topic-settings">
      <p>{topic.description}</p>
      <label>
        Trainingsmodus
        <select
          value={pref.mode}
          disabled={busy}
          onChange={(e) =>
            act((s) =>
              setTopic(s, topic.id, {
                mode: e.target.value as typeof pref.mode,
              }),
            )
          }
        >
          <option value="learn">Lernen – Neues und Wiederholungen</option>
          <option value="maintain">
            Erhalten – nur bereits eingeführte Abrufrichtungen
          </option>
          <option value="paused">
            Pausiert – keine automatischen Aufgaben
          </option>
        </select>
      </label>
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
            onChange={(e) =>
              act((s) =>
                setTopic(s, topic.id, { quota: Number(e.target.value) }),
              )
            }
          />
          <strong>{pref.quota === 0 ? "Aus" : pref.quota + " %"}</strong>
        </div>
        <button
          className="secondary"
          disabled={!archived.length || busy}
          onClick={onArchive}
        >
          <Archive size={16} />
          Archiv dieses Themas üben ({archived.length})
        </button>
        <p className="small muted">
          Diese bewusste Archivsitzung geht auch bei pausiertem Thema. Sie
          ändert keine Dauereinstellung.
        </p>
      </div>
      <div className="section-heading">
        <h3>{targets.length} Lernziele</h3>
        <select
          aria-label="Inhalte filtern"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Alle Inhalte</option>
          <option value="regular">Im Training</option>
          <option value="archived">Archiviert</option>
          <option value="excluded">Ausgeschlossen</option>
        </select>
      </div>
      <div className="topic-word-list">
        {targets
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
  onCustom,
}: {
  word: DictionaryWord;
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
                  de: sense.de.join(" / "),
                  gloss: sense.gloss,
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
        `${t.word} ${t.de} ${Object.values(t.dimensions).flat().join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <div className="eyebrow">WORTE FÜR DEINE WELT</div>
          <h1>Entdecken & behalten.</h1>
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
        <div className="tab-switch">
          <button
            className={!source ? "active" : ""}
            onClick={() => setSource(false)}
          >
            Dein Trainingsbestand <span>{targets.length}</span>
          </button>
          <button
            className={source ? "active" : ""}
            onClick={() => setSource(true)}
          >
            Wörterbuch entdecken{" "}
            <span>
              {number(
                content.manifest.sourceWordCount ??
                  content.manifest.sourceCount,
              )}
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
              <option value="excluded">Ausgeschlossen</option>
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
            {filtered.slice(0, limit).map((t) => (
              <button
                className="dictionary-row"
                key={t.id}
                onClick={() => onDetail(t)}
              >
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
                  <span>
                    {t.kind === "grammar" ? "Grammatiklernziel" : t.de}
                  </span>
                </span>
                <span className="dictionary-topic">
                  {
                    content.topics.find((topic) => topic.id === t.ownerTopicId)
                      ?.title
                  }
                </span>
                <span
                  className={`participation-tag ${state.participation[t.id] ?? "regular"}`}
                >
                  {statusLabels[state.participation[t.id] ?? "regular"]}
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {filtered.length > limit && (
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

function Training({
  state,
  content,
  busy,
  act,
  onExit,
  onTopic,
  onParticipation,
  onReport,
}: {
  state: AppState;
  content: Content;
  busy: boolean;
  act: Act;
  onExit: () => void;
  onTopic: () => void;
  onParticipation: (t: Target, p: "regular" | "archived" | "excluded") => void;
  onReport: (t: Target) => void;
}) {
  const s = state.session,
    targets = allTargets(state, content);
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
  const done = state.events.filter((e) => !e.revokedAt && e.sessionId === s.id);
  if (s.finished || s.index >= s.queue.length)
    return (
      <div className="session-complete">
        <div className="completion-art">
          <CheckCheck size={48} />
          <span>✧</span>
        </div>
        <div className="eyebrow">EIN SCHRITT WEITER</div>
        <h1>
          {done.length ? "Das bleibt hängen." : "Für jetzt ist alles erledigt."}
        </h1>
        <p>
          {done.length
            ? "Gut, dass du dir Zeit genommen hast. Deine Antworten sind gespeichert."
            : "Es gibt gerade keine weiteren passenden Aufgaben. Neue Lernziele sind pro Tag begrenzt; Themen und Einstellungen bestimmst du."}
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
          <button className="primary" onClick={onExit}>
            Zurück zu Heute
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
    exercise = item.exercise,
    target = targets.find((t) => t.id === exercise.targetId)!,
    topic = content.topics.find((t) => t.id === target.ownerTopicId)!;
  return (
    <div className="training">
      <div className="training-top">
        <button className="text-button" onClick={onExit}>
          <ChevronLeft size={17} />
          Speichern & pausieren
        </button>
        <span>
          {s.index + 1} / {s.queue.length}
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
          Für heute beenden
        </button>
      </div>
      <div className="training-progress">
        <span style={{ width: `${(s.index / s.queue.length) * 100}%` }} />
      </div>
      <div className="training-topic">
        <TopicIcon topic={topic} size={18} />
        <span>{topic.title}</span>
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
                    : "Grammatik abrufen"
            : "Archiv auffrischen"}
        </span>
      </div>
      <section className={`exercise-card ${s.revealed ? "revealed" : ""}`}>
        <div className="small-label">{exercise.context}</div>
        <h1>
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
        {exercise.mode === "recall" && !s.revealed && (
          <>
            <p className="think-hint">
              Überlege kurz oder sprich deine Antwort laut aus.
            </p>
            <button
              className="primary reveal-button"
              disabled={busy}
              onClick={() =>
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
                disabled={busy || !!s.feedback}
                className={`${s.feedback && option === exercise.answer ? "correct" : ""} ${s.feedback?.choice === option && !s.feedback.good ? "incorrect" : ""}`}
                onClick={() =>
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
                {s.feedback && option === exercise.answer && (
                  <Check size={20} />
                )}{" "}
                {s.feedback?.choice === option && !s.feedback.good && (
                  <X size={20} />
                )}
              </button>
            ))}
          </div>
        )}
        {s.revealed && (
          <div className="answer-reveal">
            {exercise.mode === "recall" && (
              <>
                <span className="small-label">DIE ANTWORT</span>
                <h2>{exercise.answer}</h2>
                {exercise.alternatives.length > 0 && (
                  <p>Auch möglich: {exercise.alternatives.join(" · ")}</p>
                )}
              </>
            )}
            <p>{exercise.explanation}</p>
            {exercise.mode === "recall" && !s.feedback && (
              <>
                <div className="rating-buttons">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
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
                    onClick={() =>
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
      {s.feedback && (
        <div
          className={`feedback ${s.feedback.good ? "success" : "again"}`}
          role="status"
        >
          <div>
            {s.feedback.good ? <CheckCircle2 size={24} /> : <Leaf size={24} />}
            <span>
              <strong>
                {s.feedback.good
                  ? "Richtig. Gut erinnert!"
                  : "Ein Lernschritt für das nächste Mal."}
              </strong>
              <small>
                {item.mode !== "regular"
                  ? "Der Eintrag bleibt archiviert."
                  : "Deine nächste Wiederholung wird passend eingeplant."}
              </small>
            </span>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              act((d) => {
                const session = d.session!;
                session.index++;
                session.revealed = false;
                session.feedback = null;
              })
            }
          >
            Weiter
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      {s.feedback && !s.feedback.good && item.mode !== "regular" && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => onParticipation(target, "regular")}
        >
          Wieder regulär üben
        </button>
      )}
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
          Schon bekannt · archivieren
        </button>
        <button
          disabled={busy}
          onClick={() => onParticipation(target, "excluded")}
        >
          <Ban size={16} />
          Ausschließen
        </button>
        <button onClick={() => onReport(target)}>
          <CircleHelp size={16} />
          Inhalt melden
        </button>
      </div>
      <div className="training-foot">
        <ShieldCheck size={14} />
        Dein Fortschritt wird nach jeder Antwort gespeichert.
      </div>
    </div>
  );
}

function Progress({ state, content }: { state: AppState; content: Content }) {
  const events = state.events.filter((e) => !e.revokedAt),
    targets = allTargets(state, content),
    ids = new Set(events.map((e) => e.targetId)),
    first = events.filter((e) => !e.retry),
    recall = first.filter((e) => e.exercise.mode === "recall"),
    choice = first.filter((e) => e.exercise.mode === "choice");
  const accuracy = (ev: typeof events) =>
    ev.length
      ? Math.round((ev.filter((e) => e.good).length / ev.length) * 100) + " %"
      : "—";
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">SICHTBAR WEITERKOMMEN</div>
        <h1>Viele kleine Schritte.</h1>
        <p>
          Deine Aktivität und dein Lernverlauf – ohne künstlichen Sprachlevel.
        </p>
      </div>
      <div className="progress-stats">
        <div className="metric">
          <span className="stat-icon sage">
            <BookOpen />
          </span>
          <strong>{ids.size}</strong>
          <span>Lernziele bearbeitet</span>
          <small>von {targets.length} im Trainingsbestand</small>
        </div>
        <div className="metric">
          <span className="stat-icon peach">
            <CheckCheck />
          </span>
          <strong>{events.length}</strong>
          <span>Antworten gegeben</span>
          <small>
            einschließlich {events.filter((e) => e.retry).length} Nachversuchen
          </small>
        </div>
        <div className="metric">
          <span className="stat-icon lilac">
            <Clock3 />
          </span>
          <strong>{new Set(events.map((e) => e.day)).size}</strong>
          <span>aktive Lerntage</span>
          <small>seit deinem ersten Training</small>
        </div>
      </div>
      <div className="progress-layout">
        <section className="panel">
          <h2>Deine letzte Woche</h2>
          <Week state={state} />
          <p className="small muted">
            Ein Haken steht für einen Tag mit mindestens einer gespeicherten
            Antwort.
          </p>
          <div className="score-row">
            <div>
              <strong>{accuracy(recall)}</strong>
              <span>selbst abgerufen</span>
              <small>{recall.length} Aufdeckantworten</small>
            </div>
            <div>
              <strong>{accuracy(choice)}</strong>
              <span>richtig ausgewählt</span>
              <small>{choice.length} Auswahlantworten</small>
            </div>
          </div>
          <p className="small muted">
            Gesamter Zeitraum, ohne direkte Nachversuche. Selbstbewertung und
            Auswahl werden getrennt ausgewertet. Kein Maß für allgemeine
            Englischkompetenz.
          </p>
        </section>
        <section className="panel">
          <h2>In deinen Themen</h2>
          <div className="topic-progress-list">
            {content.topics.map((t) => {
              const tt = targets.filter((x) => x.ownerTopicId === t.id),
                done = tt.filter((x) => ids.has(x.id)).length;
              return (
                <div key={t.id}>
                  <TopicIcon topic={t} size={16} />
                  <div>
                    <div>
                      <strong>{t.title}</strong>
                      <span>
                        {done} / {tt.length}
                      </span>
                    </div>
                    <div className="progress-track">
                      <span
                        style={{ width: `${(done / tt.length) * 100 || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="panel history">
        <h2>Deine letzten Antworten</h2>
        {!events.length ? (
          <p className="muted">
            Hier wächst dein Lernverlauf, sobald du loslegst.
          </p>
        ) : (
          events
            .slice(-15)
            .reverse()
            .map((e) => (
              <div className="history-row" key={e.id}>
                <span className={`history-icon ${e.good ? "good" : ""}`}>
                  {e.good ? <Check size={16} /> : <Undo2 size={16} />}
                </span>
                <div>
                  <strong>
                    {targets.find((t) => t.id === e.targetId)?.word ??
                      e.exercise.prompt}
                  </strong>
                  <small>
                    {e.exercise.channel.includes("recognition")
                      ? "Auswahl"
                      : "Selbst abgerufen"}
                    {e.retry ? " · Nachversuch" : ""}
                    {e.mode !== "regular" ? " · Archiv" : ""}
                  </small>
                </div>
                <span>{date(e.at)}</span>
              </div>
            ))
        )}
      </section>
    </>
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
        <div className="eyebrow">DEIN FORTSCHRITT ZUM MITNEHMEN</div>
        <h1>Bleibt bei dir. Geht mit dir.</h1>
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
            eine laufende Sitzung in einer Datei.
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
            onClick={async () => {
              try {
                downloadText(
                  await exportBackup(state, content),
                  `wortnah-lernstand-${dayKey(new Date(), state.settings.timezone)}.json`,
                );
                notify(
                  "Exportdatei erstellt. Bewahre sie an einem sicheren Ort auf.",
                );
              } catch (e) {
                notify(
                  e instanceof Error ? e.message : "Export fehlgeschlagen.",
                );
              }
            }}
          >
            <Download size={18} />
            Lernstand herunterladen
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
            Wähle eine Wortnah-Sicherung von deinem anderen Gerät. Vor der
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
            <span>JSON-Datei hier ablegen</span>
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
            onClick={async () =>
              downloadText(
                await exportBackup(recovery, content),
                "wortnah-ruecksicherung.json",
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
            parallele Verläufe werden nicht zusammengeführt. Die spätere
            Wortnah-App kann dasselbe Format verwenden.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Dein Training</h2>
          <label>
            Zeitbudget
            <select
              value={state.settings.minutes}
              onChange={(e) =>
                act((s) => {
                  s.settings.minutes = Number(e.target.value);
                })
              }
              disabled={busy}
            >
              {[10, 20, 40].map((n) => (
                <option key={n} value={n}>
                  {n} Minuten
                </option>
              ))}
            </select>
          </label>
          <label>
            Trainingsauswahl
            <select
              value={state.settings.mode}
              onChange={(e) =>
                act((s) => {
                  s.settings.mode = e.target
                    .value as AppState["settings"]["mode"];
                })
              }
              disabled={busy}
            >
              <option value="mixed">Wortschatz & Grammatik</option>
              <option value="words">Nur Wortschatz</option>
              <option value="grammar">Nur Grammatik</option>
            </select>
          </label>
          <label>
            Neue Wörter pro Tag
            <input
              type="number"
              min={0}
              max={50}
              value={state.settings.newPerDay}
              onChange={(e) =>
                act((s) => {
                  s.settings.newPerDay = Math.max(
                    0,
                    Math.min(50, Number(e.target.value)),
                  );
                })
              }
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
              onChange={(e) =>
                act((s) => {
                  s.settings.grammarPerDay = Math.max(
                    0,
                    Math.min(10, Number(e.target.value)),
                  );
                })
              }
              disabled={busy}
            />
          </label>
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
                {persistent
                  ? "Dauerhafter Speicher erlaubt"
                  : "Lokaler Browserspeicher"}
              </strong>
              <p>
                {storage === null
                  ? "Speicherbelegung wird ermittelt."
                  : `${(storage / 1024 / 1024).toFixed(1)} MB lokal belegt`}
              </p>
            </div>
          </div>
          <p className="small muted">
            Dauerhafter Speicher schützt besser vor automatischer Bereinigung.
            Manuell gelöschte Browserdaten lassen sich nur mit einer Sicherung
            wiederherstellen.
          </p>
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
          <div className="setting-section">
            <h3>Wie eine App verwenden</h3>
            <p>
              Installiere Wortnah für ein eigenes Fenster und schnellen Zugriff
              vom Startbildschirm.
            </p>
            <button className="secondary" onClick={onInstall}>
              <Plus size={17} />
              {installPrompt ? "Wortnah installieren" : "Installationshinweis"}
            </button>
          </div>
          <div className="setting-section">
            <h3>Lokale Inhaltsmeldungen</h3>
            <p className="small muted">
              {state.reports.length} Notizen, bisher nur auf diesem Gerät
              gespeichert.
            </p>
            <button
              className="text-button"
              disabled={!state.reports.length}
              onClick={() =>
                downloadText(
                  JSON.stringify(
                    {
                      format: "wortnah-content-reports",
                      reports: state.reports,
                    },
                    null,
                    2,
                  ),
                  "wortnah-inhaltsmeldungen.json",
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
              <dt>Laufende Sitzung</dt>
              <dd>
                {preview.state.session && !preview.state.session.finished
                  ? "Wird fortgesetzt"
                  : "Keine"}
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
