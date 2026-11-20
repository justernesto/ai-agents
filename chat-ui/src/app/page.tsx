"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  browserReply,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_LENGTH,
  normalize,
  runbooks,
  samples,
} from "./demo";
import type { ConversationMessage, Mode, Reply, Runbook } from "./demo";

const apiUrl = (process.env.NEXT_PUBLIC_OPS_API_URL || "https://ops-copilot-api.vercel.app").trim().replace(/\/+$/, "");
const repoUrl = "https://github.com/justernesto/ai-agents";
const runbookCategories = [...new Set(runbooks.map(({ category }) => category))].sort();
const searchableRunbooks = runbooks.map((runbook) => ({
  runbook,
  text: normalize([runbook.title, runbook.summary, ...runbook.keywords].join(" ")),
}));

type Turn = {
  question: string;
  answer?: Reply;
  error?: string;
};
type Connection = "browser" | "checking" | Mode;

function normalizeReply(payload: unknown): Reply {
  const data = payload as Partial<Reply> | null;
  if (
    !data ||
    typeof data.reply !== "string" ||
    (data.mode !== "demo" && data.mode !== "gemini") ||
    !Array.isArray(data.sources)
  ) {
    throw new Error("Invalid assistant response");
  }

  return {
    reply: data.reply,
    mode: data.mode,
    sources: runbooks
      .filter((runbook) => data.sources?.some((source) => source?.id === runbook.id))
      .map(({ id, title }) => ({ id, title })),
  };
}

function historyFrom(turns: Turn[]): ConversationMessage[] {
  return turns
    .slice(-(MAX_HISTORY_MESSAGES / 2))
    .flatMap(({ question, answer }) =>
      answer
        ? [
            { role: "user" as const, content: question },
            { role: "assistant" as const, content: answer.reply.slice(0, 2400) },
          ]
        : [],
    );
}

export default function Page() {
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [connection, setConnection] = useState<Connection>("browser");
  const [connectionError, setConnectionError] = useState("");
  const [runbookQuery, setRunbookQuery] = useState("");
  const [runbookCategory, setRunbookCategory] = useState("");
  const [openRunbook, setOpenRunbook] = useState<Runbook | null>(null);
  const request = useRef<AbortController | null>(null);
  const connectionCheck = useRef<AbortController | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDialogElement>(null);

  const searchTerms = normalize(runbookQuery).split(" ").filter(Boolean);
  const visibleRunbooks = searchableRunbooks
    .filter(({ runbook, text }) =>
      (!runbookCategory || runbook.category === runbookCategory) &&
      searchTerms.every((term) => text.includes(term)),
    )
    .map(({ runbook }) => runbook);

  useEffect(() => {
    if (turns.length) latest.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  useEffect(() => {
    if (openRunbook && !modal.current?.open) modal.current?.showModal();
  }, [openRunbook]);

  useEffect(
    () => () => {
      request.current?.abort();
      connectionCheck.current?.abort();
    },
    [],
  );

  async function connect() {
    if (!apiUrl || connectionCheck.current) return;
    if (connection === "demo" || connection === "gemini") {
      setConnection("browser");
      setConnectionError("");
      return;
    }
    const controller = new AbortController();
    connectionCheck.current = controller;
    setConnection("checking");
    setConnectionError("");

    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${apiUrl}/health`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Health check failed");
      const data = await response.json();
      if (data.status !== "ok" || (data.mode !== "demo" && data.mode !== "gemini")) {
        throw new Error("Unexpected health response");
      }
      setConnection(data.mode);
    } catch {
      setConnection("browser");
      setConnectionError("The configured API is unavailable. Browser demo is ready.");
    } finally {
      window.clearTimeout(timeout);
      connectionCheck.current = null;
    }
  }

  async function send(rawMessage: string, retry = false) {
    const question = rawMessage.trim();
    if (!question || question.length > MAX_MESSAGE_LENGTH || request.current) return;

    const earlierTurns = retry ? turns.slice(0, -1) : turns;
    const history = historyFrom(earlierTurns);
    setMessage("");

    if (connection === "browser" || connection === "checking" || !apiUrl) {
      setTurns([...earlierTurns, { question, answer: browserReply(question, history) }]);
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setTurns([...earlierTurns, { question }]);
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Response status ${response.status}`);
      const answer = normalizeReply(await response.json());
      if (request.current === controller) setTurns([...earlierTurns, { question, answer }]);
    } catch {
      if (request.current === controller) {
        setTurns([
          ...earlierTurns,
          {
            question,
            error: "The API couldn’t answer. Retry, or switch to Browser demo and retry locally.",
          },
        ]);
      }
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }

  function clearConversation() {
    const previousRequest = request.current;
    request.current = null;
    previousRequest?.abort();
    setPending(false);
    setTurns([]);
    setMessage("");
    composer.current?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(message);
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(message);
    }
  }

  const connected = connection === "gemini" || connection === "demo";
  const modeLabel = connection === "gemini" ? "Gemini API" : connection === "demo" ? "Demo API" : "Browser demo";
  const hasConversation = turns.length > 0;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <div><strong>Ops Copilot</strong><span>IT support prototype</span></div>
          </div>
          <div className="topbar-actions">
            <span className="mode-indicator"><i aria-hidden="true" />{modeLabel}</span>
            <a className="source-link" href={repoUrl} target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
        </div>
      </header>

      <div className="layout">
        <main className="workspace panel" id="workspace" tabIndex={-1}>
          <div className="workspace-bar">
            <span>{hasConversation ? "Triage conversation" : "Triage workspace"}</span>
            <button className="quiet-button" type="button" onClick={clearConversation} disabled={!hasConversation && !message}>
              <span aria-hidden="true">+</span> New conversation
            </button>
          </div>
          {!hasConversation ? (
            <div className="welcome">
              <h1>Get from symptom to <em>next step.</em></h1>
              <p>Practice IT support triage with reference runbooks. Describe a support issue or start with a sample scenario.</p>
              <div className="sample-grid" aria-label="Sample incident scenarios">
                {samples.map((runbook) => (
                  <button className="sample" key={runbook.id} type="button" onClick={() => void send(runbook.prompt)} disabled={pending}>
                    <span className="sample-code" aria-hidden="true">{runbook.code}</span>
                    <span className="sample-name">{runbook.scenario}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="transcript" role="log" aria-label="Triage conversation" aria-live="polite">
              <h1 className="sr-only">Triage conversation</h1>
              {turns.map((turn, index) => (
                <div className="turn" key={index}>
                  <div className="message message-user">
                    <span className="message-label">Your scenario</span>
                    <p>{turn.question}</p>
                  </div>
                  <div className="message message-assistant">
                    <div className="message-header">
                      <span className="message-label">Ops Copilot</span>
                      {turn.answer?.sources.length ? (
                        <span className="response-method">
                          {turn.answer.mode === "gemini" ? "Checks prioritized by Gemini" : "Runbook order"}
                        </span>
                      ) : null}
                    </div>
                    {turn.answer ? (
                      <>
                        <p className="answer-copy">{turn.answer.reply}</p>
                        {turn.answer.sources.length > 0 && (
                          <div className="source-row" aria-label="Reference runbooks">
                            {turn.answer.sources.map((source) => (
                              <button
                                className="source-chip"
                                type="button"
                                key={source.id}
                                onClick={() => setOpenRunbook(runbooks.find(({ id }) => source.id === id) ?? null)}
                              >
                                {source.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : turn.error ? (
                      <>
                        <p className="answer-error" role="alert">{turn.error}</p>
                        {index === turns.length - 1 && (
                          <button className="quiet-button" type="button" onClick={() => void send(turn.question, true)} disabled={pending}>
                            Retry this scenario
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="loading"><span aria-hidden="true" /> Preparing triage notes…</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={latest} aria-hidden="true" />
            </div>
          )}

          <form className="composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="scenario">Describe a support issue</label>
            <div className="composer-box">
              <textarea
                id="scenario"
                ref={composer}
                rows={2}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleComposerKey}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder="Describe a support issue…"
                aria-describedby="composer-help"
              />
              <button className="send-button" type="submit" disabled={!message.trim() || pending}>
                Send
              </button>
            </div>
            <div id="composer-help" className="composer-meta">
              <span>Use sample or anonymized details. Review suggestions before applying them.</span>
              <span className="character-count">{message.length}/{MAX_MESSAGE_LENGTH}</span>
            </div>
          </form>
        </main>

        <aside className="sidebar" aria-label="References and session settings">
          <section className="panel reference-panel" aria-labelledby="runbook-heading">
            <h2 id="runbook-heading">Reference runbooks</h2>
            <div className="runbook-filters">
              <label className="sr-only" htmlFor="runbook-search">Search runbooks</label>
              <input
                id="runbook-search"
                type="search"
                value={runbookQuery}
                onChange={(event) => setRunbookQuery(event.target.value)}
                placeholder="Search runbooks"
              />
              <label className="sr-only" htmlFor="runbook-category">Filter by topic</label>
              <select
                id="runbook-category"
                value={runbookCategory}
                onChange={(event) => setRunbookCategory(event.target.value)}
              >
                <option value="">All topics</option>
                {runbookCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
            <p role="status">
              {visibleRunbooks.length === 0
                ? "No runbooks match these filters."
                : `${visibleRunbooks.length} ${visibleRunbooks.length === 1 ? "runbook" : "runbooks"}`}
            </p>
            {visibleRunbooks.length > 0 && (
              <ul className="runbook-list" aria-label="Matching runbooks">
                {visibleRunbooks.map((runbook) => (
                  <li key={runbook.id}>
                    <button type="button" className="runbook-button" onClick={() => setOpenRunbook(runbook)}>
                      <span>{runbook.title}</span>
                      <span className="runbook-open" aria-hidden="true">+</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel session-panel" aria-labelledby="session-heading">
            <h2 id="session-heading">Session mode</h2>
            <span className="session-mode"><i aria-hidden="true" />{modeLabel}</span>
            <p>{connected
              ? "Messages and recent turns are sent to the configured API."
              : "The browser selects from the included runbooks. Your scenarios stay on this page."}</p>
            {apiUrl && (
              <>
                <button type="button" className="quiet-button connect-button" onClick={() => void connect()} disabled={pending || connection === "checking"}>
                  {connection === "checking" ? "Checking API…" : connected ? "Switch to browser demo" : "Connect configured API"}
                </button>
                {!connected && <p className="connection-hint">Connected mode shares new prompts and recent turns with the API. If enabled there, Gemini helps prioritize checks.</p>}
                {connectionError && <p className="answer-error" role="status">{connectionError}</p>}
              </>
            )}
          </section>
        </aside>
      </div>

      <footer className="footer">Built by Ernesto Cardenas to explore AI in everyday IT operations.</footer>

      <dialog ref={modal} onClose={() => setOpenRunbook(null)} className="runbook-dialog" aria-labelledby="runbook-title">
        {openRunbook && (
          <>
            <div className="dialog-header">
              <h2 id="runbook-title">{openRunbook.title}</h2>
              <button type="button" className="quiet-button" onClick={() => modal.current?.close()}>Close</button>
            </div>
            <p>{openRunbook.summary}</p>
            <ol>{openRunbook.checks.map(({ id, text }) => <li key={id}>{text}</li>)}</ol>
            <h3>Handoff</h3>
            <p>{openRunbook.handoff}</p>
          </>
        )}
      </dialog>
    </div>
  );
}
