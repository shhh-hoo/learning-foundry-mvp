import { useCallback, useEffect, useMemo, useState } from "react";
import { api, loadState } from "./api.js";

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "";
}

export function TeacherWorkspace({ selectedStudentId = "alice" }) {
  const [state, setState] = useState(null);
  const [goal, setGoal] = useState("Build confidence with proportional reasoning");
  const [instruction, setInstruction] = useState("Explain the relationship before relying on a calculation shortcut.");
  const [selectedStudents, setSelectedStudents] = useState(new Set(["alice", "bob", "charlie"]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setState(await loadState());
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  const selected = state?.students?.find((student) => student.id === selectedStudentId) ?? state?.students?.[0] ?? null;
  const tasks = useMemo(
    () => (state?.tasks ?? []).filter((task) => task.studentId === selected?.id),
    [state, selected]
  );
  const task = tasks.at(-1) ?? null;
  const attempts = (state?.attempts ?? []).filter((attempt) => attempt.taskId === task?.id);
  const conversation = (state?.conversationEvents ?? []).filter((event) => event.taskId === task?.id);
  const orchestration = (state?.orchestrationDecisions ?? []).filter((decision) => decision.taskId === task?.id);
  const teacherDecisions = (state?.teacherDecisions ?? []).filter((decision) => decision.taskId === task?.id);
  const currentDecision = orchestration.find((decision) => decision.id === task?.currentDecisionId) ?? orchestration.at(-1) ?? null;

  async function assign(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          goal,
          teacherInstruction: instruction,
          studentIds: [...selectedStudents]
        })
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(action, capabilityId = null) {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/teacher-decisions", {
        method: "POST",
        body: JSON.stringify({ taskId: task.id, action, capabilityId })
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <div className="page-state">Loading Teacher Workspace…</div>;

  return (
    <section className="teacher-layout">
      <aside className="workspace-stack teacher-sidebar">
        <section className="panel">
          <span className="eyebrow">Assign</span>
          <h2>One goal, multiple learners</h2>
          <form className="form-stack" onSubmit={assign}>
            <label>
              <span>Learning goal</span>
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} required />
            </label>
            <label>
              <span>Teacher instruction</span>
              <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />
            </label>
            <div className="checkbox-list">
              {state.students.map((student) => (
                <label key={student.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={(event) => {
                      const next = new Set(selectedStudents);
                      if (event.target.checked) next.add(student.id);
                      else next.delete(student.id);
                      setSelectedStudents(next);
                    }}
                  />
                  <span>{student.name}</span>
                </label>
              ))}
            </div>
            <button className="button primary" disabled={busy || selectedStudents.size === 0}>
              {busy ? "Saving…" : "Assign Task"}
            </button>
          </form>
        </section>

        <section className="panel">
          <span className="eyebrow">Students</span>
          <div className="student-list">
            {state.students.map((student) => {
              const latestTask = state.tasks.filter((item) => item.studentId === student.id).at(-1);
              return (
                <a
                  key={student.id}
                  className={`student-link ${student.id === selected?.id ? "active" : ""}`}
                  href={`#teacher/${student.id}`}
                >
                  <strong>{student.name}</strong>
                  <span>{latestTask?.learnerState ?? "NO TASK"}</span>
                </a>
              );
            })}
          </div>
        </section>
      </aside>

      <main className="workspace-stack">
        {error && <div className="notice error">{error}</div>}
        <header className="workspace-hero small-hero teacher-hero">
          <div>
            <span className="eyebrow">Monitor & Intervene</span>
            <h1>{selected?.name}</h1>
            <p>Teacher and expert are one actor in this MVP.</p>
          </div>
          <a className="button secondary" href={`#student/${selected?.id ?? "alice"}`}>Open learner view</a>
        </header>

        {!task ? (
          <div className="empty-state">Assign a Task to {selected?.name} first.</div>
        ) : (
          <>
            <section className="panel">
              <div className="row-between">
                <div>
                  <span className="eyebrow">Current Task</span>
                  <h2>{task.goal}</h2>
                  {task.teacherInstruction && <p className="muted">{task.teacherInstruction}</p>}
                </div>
                <span className="status-chip">{task.learnerState ?? task.status}</span>
              </div>
              <div className="policy-line">
                Required: <strong>{task.constraints?.requireCapabilityId ?? "none"}</strong>
                <span>·</span>
                Excluded: <strong>{(task.constraints?.excludeCapabilityIds ?? []).join(", ") || "none"}</strong>
              </div>
              <div className="button-row">
                <button className="button secondary" disabled={busy} onClick={() => decide("CLEAR_CONSTRAINTS")}>Clear constraints</button>
                {state.capabilities.map((capability) => (
                  <span key={capability.id} className="button-pair">
                    <button className="button secondary" disabled={busy} onClick={() => decide("REQUIRE_CAPABILITY", capability.id)}>
                      Require {capability.title}
                    </button>
                    <button className="button ghost" disabled={busy} onClick={() => decide("EXCLUDE_CAPABILITY", capability.id)}>
                      Exclude
                    </button>
                  </span>
                ))}
              </div>
            </section>

            <div className="teacher-grid">
              <section className="panel">
                <span className="eyebrow">Learner conversation</span>
                <h2>What the learner and Foundry said</h2>
                <div className="teacher-transcript">
                  {conversation.length ? conversation.map((event) => (
                    <div key={event.id} className="transcript-line">
                      <strong>{event.role === "LEARNER" ? selected.name : "Foundry"}</strong>
                      <span>{event.content}</span>
                    </div>
                  )) : <div className="empty-state compact">The learner has not opened this Task yet.</div>}
                </div>
              </section>

              <section className="panel">
                <span className="eyebrow">Current routing</span>
                <h2>Why the product did this</h2>
                {currentDecision ? (
                  <pre>{JSON.stringify({
                    trigger: currentDecision.trigger,
                    proposal: currentDecision.proposal,
                    committedAction: currentDecision.committedAction
                  }, null, 2)}</pre>
                ) : <div className="empty-state compact">No learner-turn decision yet.</div>}
              </section>
            </div>

            <section className="panel">
              <span className="eyebrow">Learning evidence</span>
              <h2>Attempts</h2>
              {attempts.length ? (
                <div className="timeline">
                  {[...attempts].reverse().map((attempt) => (
                    <article key={attempt.id}>
                      <div className="row-between">
                        <strong>{attempt.capabilityId}@{attempt.capabilityVersion}</strong>
                        <span className={`status-chip ${attempt.correct === false ? "warn" : "good"}`}>
                          correct={String(attempt.correct)}
                        </span>
                      </div>
                      <span className="muted small-text">{formatTime(attempt.submittedAt)}</span>
                      <pre>{JSON.stringify(attempt.response, null, 2)}</pre>
                    </article>
                  ))}
                </div>
              ) : <div className="empty-state compact">No Attempt recorded yet.</div>}
            </section>

            <section className="panel">
              <span className="eyebrow">Teacher authority</span>
              <h2>Intervention history</h2>
              {teacherDecisions.length ? (
                <div className="timeline">
                  {[...teacherDecisions].reverse().map((decision) => (
                    <div key={decision.id}>
                      <strong>{decision.action}</strong>
                      {decision.capabilityId && <span> · {decision.capabilityId}</span>}
                      <div className="muted small-text">{formatTime(decision.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state compact">No teacher intervention yet.</div>}
            </section>
          </>
        )}
      </main>
    </section>
  );
}
