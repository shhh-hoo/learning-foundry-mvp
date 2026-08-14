import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, loadState, loadStudent, sendLearnerTurn } from "./api.js";
import { RuntimeFrame } from "./RuntimeFrame.jsx";

function latest(items, field) {
  return [...items].sort((a, b) => String(b[field] ?? "").localeCompare(String(a[field] ?? "")))[0] ?? null;
}

function ChatPanel({ conversation, draft, setDraft, onSend, sending, activeActivity, disabled }) {
  const prompts = activeActivity
    ? ["Can you explain what I should focus on?", "I don't understand what this activity is asking me to do."]
    : ["Can you explain this differently?", "I want to see this visually.", "Give me one practice question."];

  return (
    <section className="panel chat-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Chat / Guidance</span>
          <h2>Ask Foundry</h2>
        </div>
        {activeActivity && <span className="status-chip subtle">activity stays open</span>}
      </div>

      <div className="conversation" aria-live="polite">
        {conversation.length === 0 ? (
          <div className="empty-state compact">Opening guidance will appear here when the Task starts.</div>
        ) : (
          conversation.map((event) => (
            <article key={event.id} className={`message ${event.role === "LEARNER" ? "learner" : "assistant"}`}>
              <div className="message-role">{event.role === "LEARNER" ? "You" : "Foundry"}</div>
              <div>{event.content}</div>
            </article>
          ))
        )}
      </div>

      <div className="prompt-row">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="prompt-chip"
            disabled={disabled || sending}
            onClick={() => onSend(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          onSend(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={activeActivity ? "Ask for help without leaving the activity…" : "Tell Foundry what is unclear…"}
          disabled={disabled || sending}
          rows={3}
        />
        <button className="button primary" disabled={disabled || sending || !draft.trim()}>
          {sending ? "Thinking…" : "Send"}
        </button>
      </form>
    </section>
  );
}

function AttemptSummary({ attempt }) {
  if (!attempt) return <div className="empty-state compact">No Attempt recorded yet.</div>;
  return (
    <div className="attempt-summary">
      <div className="row-between">
        <strong>{attempt.capabilityId}</strong>
        <span className={`status-chip ${attempt.correct === false ? "warn" : "good"}`}>
          {attempt.correct === false ? "needs another look" : attempt.correct === true ? "successful attempt" : "recorded"}
        </span>
      </div>
      <pre>{JSON.stringify(attempt.response, null, 2)}</pre>
    </div>
  );
}

export function LearnerWorkspace({ studentId }) {
  const [view, setView] = useState(null);
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const openingTaskRef = useRef(null);

  const refresh = useCallback(async () => {
    const [nextView, nextState] = await Promise.all([loadStudent(studentId), loadState()]);
    setView(nextView);
    setState(nextState);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    setLoading(true);
    setError("");
    openingTaskRef.current = null;
    refresh().catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [refresh]);

  const task = view?.tasks?.at(-1) ?? null;
  const taskConversation = useMemo(
    () => (view?.conversationEvents ?? []).filter((event) => event.taskId === task?.id),
    [view, task]
  );
  const taskDecisions = useMemo(
    () => (view?.orchestrationDecisions ?? []).filter((decision) => decision.taskId === task?.id),
    [view, task]
  );

  useEffect(() => {
    if (!task || loading) return;
    const hasOpening = taskDecisions.some((decision) => decision.trigger === "TASK_OPENED");
    if (hasOpening || task.currentDecisionId || openingTaskRef.current === task.id) return;

    openingTaskRef.current = task.id;
    sendLearnerTurn({ studentId, taskId: task.id, trigger: "TASK_OPENED" })
      .then(refresh)
      .catch((err) => setError(err.message));
  }, [task, taskDecisions, studentId, loading, refresh]);

  const currentSession = task?.currentRuntimeSessionId
    ? (view?.sessions ?? []).find((session) => session.id === task.currentRuntimeSessionId) ?? null
    : null;
  const activeActivity = Boolean(currentSession && ["LOADING", "RUNNING"].includes(currentSession.status));
  const capability = currentSession
    ? state?.capabilities?.find(
        (item) => item.id === currentSession.capabilityId && item.version === currentSession.capabilityVersion
      ) ?? null
    : null;
  const attempts = (view?.attempts ?? []).filter((attempt) => attempt.taskId === task?.id);
  const latestAttempt = latest(attempts, "submittedAt");
  const currentDecision = taskDecisions.find((decision) => decision.id === task?.currentDecisionId) ?? taskDecisions.at(-1) ?? null;
  const selectionReason = currentDecision?.committedAction?.rationale || currentDecision?.proposal?.actionProposal?.reason || "";

  const sendMessage = async (message) => {
    if (!task || sending) return;
    setSending(true);
    setError("");
    setDraft("");
    try {
      await sendLearnerTurn({ studentId, taskId: task.id, message, trigger: "CHAT_MESSAGE" });
      await refresh();
    } catch (err) {
      setDraft(message);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleTerminal = useCallback(async () => {
    try {
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }, [refresh]);

  if (loading) return <div className="page-state">Loading learner workspace…</div>;
  if (error && !view) return <div className="notice error">{error}</div>;

  if (!task) {
    return (
      <section className="workspace-stack">
        <header className="workspace-hero small-hero">
          <span className="eyebrow">Learner Workspace</span>
          <h1>{view?.student?.name ?? studentId}</h1>
          <p>No active Task has been assigned yet.</p>
        </header>
        <div className="empty-state">Open Teacher Workspace and assign a learning goal first.</div>
      </section>
    );
  }

  return (
    <section className="workspace-stack">
      <header className="task-bar">
        <div>
          <span className="eyebrow">Current Task</span>
          <h1>{task.goal}</h1>
          {task.teacherInstruction && <p>{task.teacherInstruction}</p>}
        </div>
        <div className="task-meta">
          <span className="status-chip">{task.learnerState ?? "ACTIVE"}</span>
          <span className="muted">{view.student.name}</span>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}

      {task.learnerState === "WAITING_FOR_TEACHER" && (
        <div className="notice">Your work is saved. A teacher decision is required before the next activity changes.</div>
      )}
      {task.learnerState === "NO_MATCH" && (
        <div className="notice">Foundry does not currently have an eligible activity for this step. Your current work is preserved.</div>
      )}
      {task.learnerState === "RUNTIME_FAILURE" && (
        <div className="notice error">The learning activity failed to run. This is a runtime failure, not a learning failure.</div>
      )}

      {activeActivity && capability ? (
        <div className="learner-layout activity-mode">
          <section className="panel asset-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Active Asset Stage</span>
                <h2>{capability.title}</h2>
              </div>
              <span className="status-chip good">{currentSession.status.toLowerCase()}</span>
            </div>
            {selectionReason && <p className="selection-reason">Why this activity: {selectionReason}</p>}
            <RuntimeFrame session={currentSession} capability={capability} onTerminal={handleTerminal} />
          </section>

          <ChatPanel
            conversation={taskConversation}
            draft={draft}
            setDraft={setDraft}
            onSend={sendMessage}
            sending={sending}
            activeActivity
            disabled={false}
          />
        </div>
      ) : (
        <div className="learner-layout guidance-mode">
          <ChatPanel
            conversation={taskConversation}
            draft={draft}
            setDraft={setDraft}
            onSend={sendMessage}
            sending={sending}
            activeActivity={false}
            disabled={false}
          />

          <aside className="workspace-stack">
            <section className="panel">
              <span className="eyebrow">Latest Attempt</span>
              <h2>What Foundry has recorded</h2>
              <AttemptSummary attempt={latestAttempt} />
            </section>
            <section className="panel">
              <span className="eyebrow">Next step</span>
              <h2>{task.learnerState === "GUIDANCE" ? "Continue the conversation" : "Foundry is deciding what comes next"}</h2>
              <p className="muted">
                Activities only change at deliberate boundaries. A normal chat message will not silently replace an unfinished Component.
              </p>
            </section>
          </aside>
        </div>
      )}

      <footer className="attempt-strip">
        <strong>{attempts.length}</strong> Attempts recorded
        <span>·</span>
        <strong>{taskDecisions.length}</strong> orchestration decisions
        <span>·</span>
        <span className="muted">canonical history stays in Foundry</span>
      </footer>
    </section>
  );
}
