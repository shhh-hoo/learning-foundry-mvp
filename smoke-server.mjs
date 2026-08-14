import { spawn } from "node:child_process";
import { resetState } from "./src/product-state/store.mjs";

const port = 3197;
const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not become ready");
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `${path} failed`);
  return body;
}

await resetState();
const server = spawn(process.execPath, ["server.mjs"], {
  env: { ...process.env, PORT: String(port), ORCHESTRATOR: "mock" },
  stdio: "inherit"
});

try {
  await waitForServer();

  const assignment = await json("/api/assignments", {
    method: "POST",
    body: JSON.stringify({
      goal: "Understand proportional reasoning",
      teacherInstruction: "Start conceptually.",
      studentIds: ["alice"]
    })
  });
  const task = assignment.tasks[0];
  if (!task) throw new Error("Assignment did not create a Task");

  const opening = await json("/api/chat", {
    method: "POST",
    body: JSON.stringify({ studentId: "alice", taskId: task.id, trigger: "TASK_OPENED" })
  });
  if (opening.committedAction?.kind !== "LAUNCH_ASSET") throw new Error("Opening learner turn did not launch an asset");

  const learner = await json("/api/student?id=alice");
  if (!learner.conversationEvents?.some((item) => item.role === "ASSISTANT")) throw new Error("Assistant guidance was not persisted");
  if (!learner.sessions?.length) throw new Error("Runtime session was not persisted");

  const appResponse = await fetch(`${baseUrl}/app/`);
  if (!appResponse.ok || !(await appResponse.text()).includes("Learning Foundry MVP")) throw new Error("React app build is not being served");

  const componentResponse = await fetch(`${baseUrl}/component-assets/ratio-explorer/component.html`);
  if (!componentResponse.ok) throw new Error("ComponentAsset is not being served");

  console.log("server smoke passed");
} finally {
  server.kill("SIGTERM");
  await resetState();
}
