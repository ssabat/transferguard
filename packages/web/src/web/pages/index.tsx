import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  CircleHelp,
  ClipboardList,
  FileSearch,
  FlaskConical,
  Globe2,
  History,
  Info,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { AppRouterClient } from "../../api";
import { createSession, sandboxConfig, sessionHistory, submitMessage } from "../queries/sandbox";

type Snapshot = Awaited<ReturnType<AppRouterClient["sandbox"]["history"]>>;
type Audit = Snapshot["events"][number];
type Mode = "demo" | "bedrock";
const storage = "transfer-guard-session";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const formatTime = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const examples = [
  {
    title: "Standard transfer",
    detail: "$5,000 to Canada",
    text: "Send $5,000 to Alice in Canada",
    icon: ArrowUpRight,
    tone: "teal",
  },
  {
    title: "Over the limit",
    detail: "$12,000 to Germany",
    text: "Send $12,000 to Morgan in Germany",
    icon: CircleDollarSign,
    tone: "amber",
  },
  {
    title: "Restricted country",
    detail: "$750 to Somalia",
    text: "Send $750 to Alex in Somalia",
    icon: Globe2,
    tone: "red",
  },
];
const rules = [
  {
    icon: CircleDollarSign,
    title: "Single-transfer limit",
    text: "Amounts must be positive in USD and no more than $10,000.00 per transfer. Exactly $10,000.00 is within the limit.",
  },
  {
    icon: Globe2,
    title: "Destination verification",
    text: "Destinations must resolve to a recognized country name or a valid ISO alpha-2 or alpha-3 code. Unverified destinations are blocked.",
  },
  {
    icon: ShieldX,
    title: "Restricted destinations",
    text: "Afghanistan (AF) and Somalia (SO) are blocked by the policy in the supplied samples. This is not a live sanctions list.",
  },
  {
    icon: ClipboardList,
    title: "Recipient required",
    text: "A recipient name must be provided. Use fictional names and do not enter account details or personal information.",
  },
];
const decisionLabels: Record<Audit["decision"], string> = {
  APPROVED: "Approved",
  BLOCKED_INVALID_AMOUNT: "Invalid USD amount",
  BLOCKED_AMOUNT_LIMIT: "Amount over limit",
  BLOCKED_UNVERIFIED_COUNTRY: "Unverified destination",
  BLOCKED_RESTRICTED_COUNTRY: "Restricted destination",
  BLOCKED_MISSING_RECIPIENT: "Missing recipient",
};

function HeroArt() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 520 205"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="hero-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#83aaa7" opacity=".44" />
        </pattern>
        <linearGradient
          id="shield-fill"
          x1="275"
          x2="392"
          y1="38"
          y2="168"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="1" stopColor="#b4e9df" />
        </linearGradient>
        <linearGradient id="fade-rings">
          <stop stopColor="#70a8a2" stopOpacity="0" />
          <stop offset="1" stopColor="#70a8a2" stopOpacity=".46" />
        </linearGradient>
      </defs>
      <path d="M85 0H520V205H85z" fill="url(#hero-dots)" opacity=".45" />
      {[68, 93, 120, 148, 177, 206, 235].map((r) => (
        <circle key={r} cx="341" cy="102" r={r} stroke="url(#fade-rings)" />
      ))}
      <path d="M342 0v205M114 102h406" stroke="#89b9b1" strokeOpacity=".38" strokeDasharray="4 5" />
      <g fill="#087d72">
        <circle cx="248" cy="102" r="3" />
        <circle cx="428" cy="70" r="3" />
        <circle cx="461" cy="102" r="3" />
        <circle cx="341" cy="34" r="2.5" />
      </g>
      <path
        d="M342 45c16 12 34 17 48 18v33c0 29-20 51-48 65-28-14-48-36-48-65V63c14-1 32-6 48-18Z"
        fill="#08695e"
        fillOpacity=".13"
        transform="translate(4 7)"
      />
      <path
        d="M342 43c16 12 34 17 48 18v33c0 29-20 51-48 65-28-14-48-36-48-65V61c14-1 32-6 48-18Z"
        fill="url(#shield-fill)"
        stroke="#167d72"
        strokeWidth="1.6"
      />
      <path
        d="M342 54c13 9 26 13 38 15v25c0 23-15 41-38 54-23-13-38-31-38-54V69c12-2 25-6 38-15Z"
        stroke="#459e92"
        strokeOpacity=".66"
      />
      <path
        d="m326 98 11 11 22-24"
        stroke="#08786d"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M231 47h12m-6-6v12m181 88h12m-6-6v12m50-112h10m-5-5v10"
        stroke="#4e9f95"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AuditPanel({
  events,
  full,
  loading,
}: {
  events: Audit[];
  full: boolean;
  loading: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const approved = events.filter((event) => event.decision === "APPROVED").length;
  const blocked = events.length - approved;
  const visible = events.filter(
    (e) =>
      filter === "all" ||
      (filter === "approved" ? e.decision === "APPROVED" : e.decision !== "APPROVED"),
  );
  return (
    <section
      className={`panel audit-panel ${full ? "full-panel" : ""}`}
      aria-labelledby="audit-title"
    >
      <header className="panel-head">
        <div className="panel-icon neutral">
          <ClipboardList size={19} />
        </div>
        <div className="panel-label">
          <h2 id="audit-title">Compliance audit</h2>
          <p>Policy decisions for this session</p>
        </div>
        <label className="filter" title="Filter audit events">
          <span className="sr-only">Filter audit events</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All events</option>
            <option value="approved">Approved</option>
            <option value="blocked">Blocked</option>
          </select>
          <ChevronDown size={13} />
        </label>
      </header>
      <div className="stats">
        <div>
          <span>Evaluated</span>
          <strong>{loading ? "—" : events.length}</strong>
        </div>
        <div>
          <span>
            <i className="green-dot" />
            Approved
          </span>
          <strong>{loading ? "—" : approved}</strong>
        </div>
        <div>
          <span>
            <i className="red-dot" />
            Blocked
          </span>
          <strong>{loading ? "—" : blocked}</strong>
        </div>
      </div>
      <div className="audit-body">
        {loading ? (
          <div className="audit-empty">
            <span className="loader" />
            <h3>Loading audit</h3>
          </div>
        ) : visible.length ? (
          <div className="event-list">
            {visible.map((event) => {
              const passed = event.decision === "APPROVED";
              return (
                <details className="audit-event" key={event.id}>
                  <summary>
                    <span className={`event-icon ${passed ? "pass" : "fail"}`}>
                      {passed ? <CircleCheck size={17} /> : <ShieldX size={17} />}
                    </span>
                    <span className="event-main">
                      <b>
                        {event.amountCents === null
                          ? "Invalid amount"
                          : money.format(event.amountCents / 100)}
                      </b>
                      <small>
                        {[event.country, event.recipient].filter(Boolean).join(" · ") ||
                          "No destination"}
                      </small>
                    </span>
                    <span className={`decision ${passed ? "pass" : "fail"}`}>
                      {passed ? "Approved" : "Blocked"}
                    </span>
                    <ChevronRight className="event-chevron" size={15} />
                  </summary>
                  <div className="event-detail">
                    <b>{decisionLabels[event.decision]}</b>
                    <p>{event.reason}</p>
                    <dl>
                      <div>
                        <dt>Destination ISO</dt>
                        <dd>{event.isoCode || "Unverified"}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{event.source === "bedrock" ? "AWS Bedrock" : "Demo"}</dd>
                      </div>
                      <div>
                        <dt>Evaluated</dt>
                        <dd>{new Date(event.createdAt).toLocaleString()}</dd>
                      </div>
                      {event.reference && (
                        <div>
                          <dt>Simulation ID</dt>
                          <dd>{event.reference}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="audit-empty">
            <div className="audit-illustration">
              <FileSearch size={25} strokeWidth={1.55} />
              <i />
            </div>
            <h3>{events.length ? "No matching events" : "No audit events yet"}</h3>
            <p>
              {events.length
                ? "Choose a different filter to see more decisions."
                : "Run a transfer simulation and its policy decision will appear here."}
            </p>
            {events.length > 0 && (
              <button className="text-button" onClick={() => setFilter("all")}>
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>
      <footer className="panel-foot">
        <LockKeyhole size={13} /> <span>Sandbox decisions only</span>
        {!full && (
          <Link href="/audit">
            View audit log <ArrowRight size={13} />
          </Link>
        )}
      </footer>
    </section>
  );
}

export default function Index() {
  const [location] = useLocation();
  const view = location === "/audit" ? "audit" : location === "/policy" ? "policy" : "simulator";
  const [token, setToken] = useState(() => sessionStorage.getItem(storage) || "");
  const created = useRef(false);
  const history = useQuery(sessionHistory(token));
  const config = useQuery(sandboxConfig);
  const start = useMutation(createSession);
  const chat = useMutation(submitMessage(token));
  const { mutateAsync: beginSession } = start;
  const { reset: resetChat } = chat;
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [pending, setPending] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("demo");
  const [accessKey, setAccessKey] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [popup, setPopup] = useState<"settings" | "help" | null>(null);
  const popupRef = useRef<HTMLDialogElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const state = history.data;
  const events = state?.events ?? [];
  const conversation = state?.conversation ?? [];
  const busy = starting || Boolean(pending);

  const newSession = useCallback(async () => {
    setStarting(true);
    setError("");
    try {
      const result = await beginSession();
      if (token) queryClient.removeQueries({ queryKey: ["sandbox-history", token] });
      sessionStorage.setItem(storage, result.token);
      setToken(result.token);
      setText("");
      resetChat();
    } catch {
      setError("Could not start a session. Try New session again.");
    } finally {
      setStarting(false);
    }
  }, [beginSession, resetChat, queryClient, token]);
  useEffect(() => {
    if (!token && !created.current) {
      created.current = true;
      void newSession();
    }
  }, [token, newSession]);
  useEffect(() => {
    if (pending || conversation.length) end.current?.scrollIntoView({ block: "nearest" });
  }, [pending, conversation.length, view]);
  useEffect(() => {
    const dialog = popupRef.current;
    if (popup && dialog && !dialog.open) dialog.showModal();
    else if (!popup && dialog?.open) dialog.close();
  }, [popup]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const message = text.trim();
    if (!message || !token || busy) return;
    setError("");
    setPending(message);
    setText("");
    try {
      const result = await chat.mutateAsync({
        message,
        mode,
        ...(mode === "bedrock" ? { accessKey } : {}),
      });
      queryClient.setQueryData(["sandbox-history", token], result);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "Internal server error"
          ? err.message
          : "The request could not be completed. Try again.",
      );
      setText(message);
    } finally {
      setPending("");
      chat.reset();
      composer.current?.focus();
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <ShieldCheck size={23} strokeWidth={1.9} />
          </span>
          <span>
            <strong>Transfer Guard</strong>
            <small>COMPLIANCE SANDBOX</small>
          </span>
        </Link>
        <div className="nav-wrap">
          <div className="nav-cap">WORKSPACE</div>
          <nav aria-label="Workspace">
            <Link
              href="/"
              className={view === "simulator" ? "nav-current" : ""}
              aria-current={view === "simulator" ? "page" : undefined}
            >
              <MessageSquare size={18} /> <span>Simulator</span>
            </Link>
            <Link
              href="/audit"
              className={view === "audit" ? "nav-current" : ""}
              aria-current={view === "audit" ? "page" : undefined}
            >
              <History size={18} /> <span>Audit log</span>
              {events.length > 0 && <small className="nav-count">{events.length}</small>}
            </Link>
            <Link
              href="/policy"
              className={view === "policy" ? "nav-current" : ""}
              aria-current={view === "policy" ? "page" : undefined}
            >
              <BookOpen size={18} /> <span>Policy rules</span>
            </Link>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <div>
              <FlaskConical size={15} />
              <strong>Simulation only</strong>
            </div>
            <p>No real funds are moved.</p>
          </div>
          <button onClick={() => setPopup("help")} className="help-button">
            <CircleHelp size={17} /> Help &amp; about <ArrowUpRight size={13} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Layers3 size={16} /> <span>Workspace</span> <ChevronRight size={13} />{" "}
            <strong>
              {view === "audit" ? "Audit log" : view === "policy" ? "Policy rules" : "Simulator"}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="mode-button"
              onClick={() => {
                setDraftKey(accessKey);
                setPopup("settings");
              }}
            >
              <i className="green-dot" />
              {mode === "demo" ? "Demo mode" : "Bedrock mode"}
              <ChevronDown size={13} />
            </button>
            <span className="top-divider" />
            <button
              className="button new-session"
              disabled={busy}
              onClick={() => void newSession()}
            >
              {starting ? <span className="loader" /> : <Plus size={16} />}
              <span>New session</span>
            </button>
          </div>
        </header>
        <main className="workspace">
          {view === "simulator" ? (
            <>
              <section className="hero">
                <HeroArt />
                <div className="hero-copy">
                  <div className="eyebrow">
                    <Activity size={13} /> TRANSFER SIMULATOR
                  </div>
                  <h1>Wire transfer assistant</h1>
                  <p>
                    Test transfer requests against compliance rules and see why each request is
                    approved or blocked.
                  </p>
                  <span className="hero-tag">
                    <ShieldCheck size={13} /> Server-side policy checks
                  </span>
                </div>
              </section>
              <div className="panels">
                <section className="panel chat-panel" aria-labelledby="chat-title">
                  <header className="panel-head">
                    <div className="panel-icon">
                      <MessageSquare size={19} />
                    </div>
                    <div className="panel-label">
                      <h2 id="chat-title">Transfer assistant</h2>
                      <p>Chat to evaluate a transfer</p>
                    </div>
                    <span className="session-chip" title={state?.sessionId}>
                      <span className="session-indicator" />{" "}
                      {state ? `Session ${state.sessionId.slice(0, 8)}` : "Sandbox session"}
                    </span>
                  </header>
                  <div
                    className={`chat-body ${conversation.length || pending ? "with-messages" : ""}`}
                  >
                    {conversation.length || pending ? (
                      <div className="messages" role="log" aria-label="Transfer chat">
                        {conversation.map((msg) => (
                          <div key={msg.id} className={`message ${msg.role}`}>
                            {msg.role === "assistant" && (
                              <span className="message-icon">
                                <ShieldCheck size={17} />
                              </span>
                            )}
                            <div className="message-content">
                              <div className="message-meta">
                                <b>{msg.role === "user" ? "You" : "Transfer assistant"}</b>
                                <span>{formatTime(msg.createdAt)}</span>
                              </div>
                              <p>{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {pending && (
                          <>
                            <div className="message user">
                              <div className="message-content">
                                <div className="message-meta">
                                  <b>You</b>
                                </div>
                                <p>{pending}</p>
                              </div>
                            </div>
                            <div className="message assistant">
                              <span className="message-icon">
                                <ShieldCheck size={17} />
                              </span>
                              <div className="evaluating">
                                <span className="loader" /> Evaluating request…
                              </div>
                            </div>
                          </>
                        )}
                        <div ref={end} />
                      </div>
                    ) : (
                      <div className="welcome">
                        <div className="welcome-art">
                          <div className="art-grid" />
                          <div className="welcome-icon">
                            <Sparkles size={24} strokeWidth={1.65} />
                          </div>
                          <i className="spark-one" />
                          <i className="spark-two" />
                        </div>
                        <h3>What would you like to test?</h3>
                        <p>
                          Enter an amount, recipient, and destination,
                          <br className="desktop-break" /> or choose a sample request.
                        </p>
                        <div className="examples">
                          {examples.map((ex) => (
                            <button
                              key={ex.title}
                              title={ex.text}
                              onClick={() => {
                                setText(ex.text);
                                composer.current?.focus();
                              }}
                            >
                              <span className={`example-icon ${ex.tone}`}>
                                <ex.icon size={15} />
                              </span>
                              <span>
                                <b>{ex.title}</b>
                                <small>{ex.detail}</small>
                              </span>
                              <ChevronRight className="example-arrow" size={13} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="compose-zone">
                    <form onSubmit={send} className="composer">
                      <textarea
                        aria-label="Transfer request"
                        maxLength={600}
                        rows={1}
                        ref={composer}
                        placeholder="e.g. Send $5,000 to Alice in Canada"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                      />
                      <button
                        type="submit"
                        aria-label="Send request"
                        title="Send request"
                        disabled={busy || !token || !text.trim()}
                      >
                        {pending ? <span className="loader" /> : <ArrowUp size={19} />}
                      </button>
                    </form>
                    <p className="compose-note">
                      <Info size={13} /> Use fictional details. This is a simulation, not a banking
                      service.
                    </p>
                  </div>
                </section>
                <AuditPanel events={events} full={false} loading={history.isLoading || starting} />
              </div>
            </>
          ) : view === "audit" ? (
            <>
              <PageHeading
                icon={<History size={19} />}
                title="Audit log"
                text="Review the outcome and rationale for every evaluated transfer in this session."
              />
              <AuditPanel
                key="audit-full"
                events={events}
                full
                loading={history.isLoading || starting}
              />
            </>
          ) : (
            <>
              <PageHeading
                icon={<BookOpen size={19} />}
                title="Policy rules"
                text="These checks are enforced on the server in both demo and Bedrock modes."
              />
              <section className="panel rules-panel">
                <header className="panel-head">
                  <div className="panel-icon">
                    <ShieldCheck size={19} />
                  </div>
                  <div className="panel-label">
                    <h2>Transfer evaluation</h2>
                    <p>Sample policy · USD transfers</p>
                  </div>
                  <div className="hero-tag">Simulation only</div>
                </header>
                <div className="rules-list">
                  {rules.map((rule, i) => (
                    <div className="rule" key={rule.title}>
                      <span className="rule-icon">
                        <rule.icon size={19} />
                      </span>
                      <div>
                        <h3>{rule.title}</h3>
                        <p>{rule.text}</p>
                      </div>
                      <span className="rule-number">0{i + 1}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {(error || history.isError) && (
            <div className="error-banner" role="alert">
              <Info size={16} />
              {error || "Unable to load this session."}
              {history.isError && (
                <button onClick={() => void newSession()}>
                  <RotateCcw size={14} /> Start again
                </button>
              )}
            </div>
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={14} /> Transfer Guard Sandbox
            </span>
            <Link href="/policy">
              Sample compliance policy <ArrowDownRight size={13} />
            </Link>
          </footer>
        </main>
      </div>
      <dialog
        ref={popupRef}
        className="dialog"
        aria-labelledby="dialog-title"
        onClose={() => setPopup(null)}
      >
        <div className="dialog-inner">
          <button className="close-button" aria-label="Close dialog" onClick={() => setPopup(null)}>
            <X size={20} />
          </button>
          {popup === "settings" ? (
            <>
              <div className="panel-icon">
                <FlaskConical size={20} />
              </div>
              <h2 id="dialog-title">Assistant mode</h2>
              <p>Both modes use the same server-side policy and never move funds.</p>
              <button
                className="mode-option"
                onClick={() => {
                  setMode("demo");
                  setPopup(null);
                }}
              >
                <span>
                  <b>Demo mode</b>
                  <small>Use built-in transfer parsing without AWS.</small>
                </span>
                {mode === "demo" && <Check size={18} />}
              </button>
              <div className="mode-option bedrock-option">
                <span>
                  <b>AWS Bedrock</b>
                  <small>
                    {config.isLoading
                      ? "Checking configuration…"
                      : config.isError
                        ? "Could not check Bedrock configuration."
                        : config.data?.bedrockAvailable
                          ? "Use the configured Return of Control agent."
                          : "Not configured on this server."}
                  </small>
                </span>
                {mode === "bedrock" && <Check size={18} />}
              </div>
              {config.data?.bedrockAvailable && (
                <form
                  className="mode-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draftKey.trim()) {
                      setAccessKey(draftKey.trim());
                      setMode("bedrock");
                      setPopup(null);
                    }
                  }}
                >
                  <label>
                    Bedrock access key
                    <input
                      autoComplete="off"
                      aria-label="Bedrock access key"
                      type="password"
                      required
                      value={draftKey}
                      maxLength={256}
                      onChange={(e) => setDraftKey(e.target.value)}
                    />
                  </label>
                  <button className="button primary" type="submit">
                    Use Bedrock <ArrowRight size={15} />
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="panel-icon">
                <CircleHelp size={20} />
              </div>
              <h2 id="dialog-title">About Transfer Guard</h2>
              <p>
                Transfer Guard is a simulator for the sample compliance policy. No funds move, and
                an approval is not a real transaction or a compliance guarantee.
              </p>
              <p>
                Try a request like “Send $5,000 to Alice in Canada.” Each evaluated request is
                recorded in your current session’s audit log. A new session starts a separate audit
                trail.
              </p>
              <button className="button primary" onClick={() => setPopup(null)}>
                Got it <Check size={15} />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

function PageHeading({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <section className="subhero">
      <div className="panel-icon">{icon}</div>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}
