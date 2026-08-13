const root = document.querySelector("#app");

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function nav() {
  return `<div class="topbar"><div class="brand">Learning Foundry MVP</div><nav class="nav"><a href="#teacher">Teacher</a><a href="#student/alice">Alice</a><a href="#student/bob">Bob</a><a href="#student/charlie">Charlie</a></nav></div>`;
}

async function renderTeacher(selectedId) {
  const state = await request("/api/state");
  const selected = state.students.find((item) => item.id === selectedId) ?? state.students[0];
  const tasks = state.tasks.filter((item) => item.studentId === selected.id);
  const task = tasks.at(-1);
  const attempts = state.attempts.filter((item) => item.studentId === selected.id);
  const diagnoses = state.diagnosisProposals.filter((item) => item.studentId === selected.id);
  const decisions = state.teacherDecisions.filter((item) => item.studentId === selected.id);

  root.innerHTML = `${nav()}
    <div class="layout">
      <aside class="stack">
        <section class="card"><div class="pill">1 teacher · many students</div><h2>Assign a learning goal</h2>
          <form id="assignment-form" class="stack">
            <textarea id="goal" placeholder="Build confidence with proportional reasoning" required></textarea>
            ${state.students.map((student) => `<label class="row"><input style="width:auto" type="checkbox" name="student" value="${student.id}" checked> ${escapeHtml(student.name)}</label>`).join("")}
            <button class="primary" type="submit">Assign Task</button>
          </form>
        </section>
        <section class="card"><h3>Students</h3><div class="stack">${state.students.map((student) => {
          const latestTask = state.tasks.filter((item) => item.studentId === student.id).at(-1);
          return `<a class="student-card ${student.id === selected.id ? "active" : ""}" href="#teacher/${student.id}" style="text-decoration:none"><strong>${escapeHtml(student.name)}</strong><span class="small muted">${escapeHtml(student.demoNeed)} · ${latestTask ? escapeHtml(latestTask.goal) : "No task"}</span></a>`;
        }).join("")}</div></section>
      </aside>
      <section class="stack">
        <section class="card"><div class="row"><div class="grow"><div class="pill">${escapeHtml(state.orchestrator)} orchestrator</div><h1>${escapeHtml(selected.name)}</h1><p class="muted">Teacher and expert are one actor in this MVP.</p></div><a class="secondary" href="#student/${selected.id}">Open learner view</a></div></section>
        ${task ? `<section class="card"><div class="row"><div class="grow"><div class="pill good">Current Task</div><h2>${escapeHtml(task.goal)}</h2></div><span class="pill">${escapeHtml(task.status)}</span></div><p class="small muted">Required: ${escapeHtml(task.constraints?.requireCapabilityId ?? "none")} · Excluded: ${escapeHtml((task.constraints?.excludeCapabilityIds ?? []).join(", ") || "none")}</p><div class="row"><button class="secondary decision" data-action="CLEAR_CONSTRAINTS">Clear constraints</button>${state.capabilities.map((capability) => `<button class="secondary decision" data-action="REQUIRE_CAPABILITY" data-capability="${capability.id}">Require ${escapeHtml(capability.title)}</button><button class="secondary decision" data-action="EXCLUDE_CAPABILITY" data-capability="${capability.id}">Exclude ${escapeHtml(capability.title)}</button>`).join("")}</div></section>` : `<div class="empty">Assign a Task to ${escapeHtml(selected.name)} first.</div>`}
        <section class="card"><h2>Latest orchestration</h2>${task?.currentResolution ? `<pre>${escapeHtml(JSON.stringify({ resolution: task.currentResolution, plan: task.currentPlan }, null, 2))}</pre>` : `<div class="empty">No ActivityPlan yet.</div>`}</section>
        <section class="card"><h2>Attempts & diagnosis proposals</h2>${attempts.length ? `<div class="timeline">${attempts.slice().reverse().map((attempt) => { const diagnosis = diagnoses.find((item) => item.attemptId === attempt.id); return `<div><strong>${escapeHtml(attempt.capabilityId)}@${escapeHtml(attempt.capabilityVersion)}</strong><div class="small muted">${formatTime(attempt.submittedAt)} · correct=${escapeHtml(attempt.correct)}</div><pre>${escapeHtml(JSON.stringify(attempt.response, null, 2))}</pre>${diagnosis ? `<div class="notice">${escapeHtml(diagnosis.summary)}</div>` : ""}</div>`; }).join("")}</div>` : `<div class="empty">No learner Attempt yet.</div>`}</section>
        <section class="card"><h2>Teacher decisions</h2>${decisions.length ? `<div class="timeline">${decisions.slice().reverse().map((item) => `<div><strong>${escapeHtml(item.action)}</strong><div class="small muted">${formatTime(item.createdAt)} ${item.capabilityId ? `· ${escapeHtml(item.capabilityId)}` : ""}</div></div>`).join("")}</div>` : `<div class="empty">No intervention yet.</div>`}</section>
      </section>
    </div>`;

  document.querySelector("#assignment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const studentIds = [...document.querySelectorAll('input[name="student"]:checked')].map((item) => item.value);
    await request("/api/assignments", { method: "POST", body: JSON.stringify({ goal: document.querySelector("#goal").value, studentIds }) });
    location.hash = `teacher/${selected.id}`;
    await route();
  });

  document.querySelectorAll(".decision").forEach((button) => button.addEventListener("click", async () => {
    if (!task) return;
    await request("/api/teacher-decisions", {
      method: "POST",
      body: JSON.stringify({ taskId: task.id, action: button.dataset.action, capabilityId: button.dataset.capability ?? null })
    });
    await route();
  }));
}

let activeFrame = null;
let activeSession = null;
let activeCapability = null;

function makeMessage(runtimeSessionId, type, payload = {}) {
  return {
    protocol: "foundry-component",
    protocolVersion: "0.1",
    messageId: crypto.randomUUID(),
    runtimeSessionId,
    type,
    timestamp: new Date().toISOString(),
    payload
  };
}

window.addEventListener("message", async (event) => {
  if (!activeFrame || event.source !== activeFrame.contentWindow) return;
  const message = event.data;
  if (!message || message.protocol !== "foundry-component" || message.protocolVersion !== "0.1") return;
  if (!activeSession || message.runtimeSessionId !== activeSession.id) return;

  if (message.type === "COMPONENT_READY") {
    activeFrame.contentWindow.postMessage(makeMessage(activeSession.id, "FOUNDRY_INIT", {
      capability: { id: activeCapability.id, version: activeCapability.version },
      parameters: activeSession.parameters,
      initialState: activeSession.stateSnapshot
    }), "*");
    return;
  }

  await request("/api/runtime-messages", { method: "POST", body: JSON.stringify({ message }) });
  if (["ATTEMPT_SUBMITTED", "COMPONENT_COMPLETED", "COMPONENT_ERROR"].includes(message.type)) await route();
});

async function renderStudent(studentId) {
  const [view, state] = await Promise.all([request(`/api/student?id=${encodeURIComponent(studentId)}`), request("/api/state")]);
  const task = view.tasks.at(-1);
  const session = task?.currentRuntimeSessionId ? view.sessions.find((item) => item.id === task.currentRuntimeSessionId) : null;
  const capability = session ? state.capabilities.find((item) => item.id === session.capabilityId && item.version === session.capabilityVersion) : null;
  const attempts = task ? view.attempts.filter((item) => item.taskId === task.id) : [];

  activeFrame = null; activeSession = session; activeCapability = capability;
  root.innerHTML = `${nav()}
    <section class="hero"><div class="pill">Learner Workspace</div><h1>${escapeHtml(view.student.name)}</h1><p>${task ? escapeHtml(task.goal) : "No Task assigned yet."}</p></section>
    <div class="layout">
      <aside class="stack">
        <section class="card"><h2>Current Task</h2>${task ? `<p>${escapeHtml(task.goal)}</p><button id="plan" class="primary">Plan next activity</button>` : `<div class="empty">Ask the teacher to assign a goal.</div>`}</section>
        <section class="card"><h3>Attempts</h3>${attempts.length ? attempts.slice().reverse().map((attempt) => `<div class="student-card"><strong>${escapeHtml(attempt.capabilityId)}</strong><span class="small muted">correct=${escapeHtml(attempt.correct)} · ${formatTime(attempt.submittedAt)}</span></div>`).join("") : `<div class="empty">No Attempt yet.</div>`}</section>
      </aside>
      <section class="stack">
        <section class="card"><div class="row"><div class="grow"><div class="pill">Asset Stage</div><h2>${capability ? escapeHtml(capability.title) : "Waiting for ActivityPlan"}</h2></div>${session ? `<span class="pill">${escapeHtml(session.status)}</span>` : ""}</div>${task?.currentResolution ? `<p class="muted">${escapeHtml(task.currentResolution.rationale)}</p>` : ""}</section>
        <section class="card" id="asset-stage">${capability && session ? `<iframe id="asset-frame" class="asset-frame" sandbox="allow-scripts" title="${escapeHtml(capability.title)}" src="${capability.runtime.launchUrl}"></iframe>` : `<div class="empty">Click “Plan next activity” to resolve and launch a ComponentAsset.</div>`}</section>
        <section class="card"><h3>Why this boundary matters</h3><p class="muted">The iframe only receives parameters and opaque state. It reports events and Attempts through Runtime Protocol v0.1; it does not write diagnosis, teacher decisions or learning outcomes.</p></section>
      </section>
    </div>`;

  const frame = document.querySelector("#asset-frame");
  if (frame) activeFrame = frame;

  document.querySelector("#plan")?.addEventListener("click", async () => {
    await request("/api/orchestrate", { method: "POST", body: JSON.stringify({ taskId: task.id }) });
    await route();
  });
}

async function route() {
  try {
    const [surface = "teacher", id] = location.hash.replace(/^#/, "").split("/");
    if (surface === "student") await renderStudent(id || "alice");
    else await renderTeacher(id);
  } catch (error) {
    root.innerHTML = `${nav()}<div class="notice"><strong>Demo error:</strong> ${escapeHtml(error.message)}</div>`;
  }
}

window.addEventListener("hashchange", route);
route();
