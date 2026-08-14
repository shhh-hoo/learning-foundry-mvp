export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

export function loadState() {
  return api("/api/state");
}

export function loadStudent(studentId) {
  return api(`/api/student?id=${encodeURIComponent(studentId)}`);
}

export function sendLearnerTurn({ studentId, taskId, message = "", trigger }) {
  return api("/api/chat", {
    method: "POST",
    body: JSON.stringify({ studentId, taskId, message, trigger })
  });
}

export function startRuntime({ taskId, runtimeSessionId }) {
  return api("/api/runtime-start", {
    method: "POST",
    body: JSON.stringify({ taskId, runtimeSessionId })
  });
}
