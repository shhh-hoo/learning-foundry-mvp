function runtimeMessage(runtimeSessionId, type, payload = {}) {
  return { protocol: "foundry-component", protocolVersion: "0.1", messageId: crypto.randomUUID(), runtimeSessionId, type, timestamp: new Date().toISOString(), payload };
}

window.addEventListener("message", async (event) => {
  const message = event.data;
  if (!message || message.protocol !== "foundry-component" || message.protocolVersion !== "0.1" || message.type !== "COMPONENT_READY") return;
  const frame = document.querySelector("#asset-frame");
  if (!frame || event.source !== frame.contentWindow) return;
  const [surface, studentId = "alice"] = location.hash.replace(/^#/, "").split("/");
  if (surface !== "student") return;
  const [studentResponse, stateResponse] = await Promise.all([fetch(`/api/student?id=${encodeURIComponent(studentId)}`), fetch("/api/state")]);
  if (!studentResponse.ok || !stateResponse.ok) return;
  const view = await studentResponse.json();
  const state = await stateResponse.json();
  const task = view.tasks.at(-1);
  const session = task?.currentRuntimeSessionId ? view.sessions.find((item) => item.id === task.currentRuntimeSessionId) : null;
  const capability = session ? state.capabilities.find((item) => item.id === session.capabilityId && item.version === session.capabilityVersion) : null;
  if (!session || !capability) return;
  frame.contentWindow.postMessage(runtimeMessage(session.id, "FOUNDRY_INIT", { capability: { id: capability.id, version: capability.version }, parameters: session.parameters, initialState: session.stateSnapshot }), "*");
});
