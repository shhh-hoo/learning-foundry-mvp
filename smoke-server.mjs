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
  env: { ...process.env, PORT: String(port) },
  stdio: "inherit"
});

try {
  await waitForServer();

  const assignment = await json("/api/assignments", {
    method: "POST",
    body: JSON.stringify({
      goal: "Understand proportional reasoning",
      teacherInstruction: "Focus on meaning before calculation.",
      studentIds: ["alice"]
    })
  });
  const task = assignment.tasks[0];
  if (!task) throw new Error("Assignment did not create a Task");

  const opening = await json("/api/chat", {
    method: "POST",
    body: JSON.stringify({ studentId: "alice", taskId: task.id, trigger: "TASK_OPENED" })
  });
  if (opening.committedAction?.kind !== "NONE") throw new Error("Task opening should start with guidance");

  const offer = await json("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      studentId: "alice",
      taskId: task.id,
      trigger: "CHAT_MESSAGE",
      message: "I can calculate it but I don't understand what the ratio means."
    })
  });
  if (offer.committedAction?.kind !== "LAUNCH_ASSET") throw new Error("Learner need did not create an activity offer");

  let learner = await json("/api/student?id=alice");
  const offeredSession = learner.sessions.at(-1);
  if (!learner.conversationEvents?.some((item) => item.role === "ASSISTANT")) throw new Error("Assistant guidance was not persisted");
  if (offeredSession?.status !== "READY") throw new Error("Activity was not left ready for learner confirmation");

  const started = await json("/api/runtime-start", {
    method: "POST",
    body: JSON.stringify({ taskId: task.id, runtimeSessionId: offeredSession.id })
  });
  if (started.session?.status !== "LOADING") throw new Error("Explicit activity start did not move runtime to LOADING");

  learner = await json("/api/student?id=alice");
  if (learner.tasks.at(-1)?.learnerState !== "ACTIVITY_ACTIVE") throw new Error("Learner state did not enter activity mode");

  const appResponse = await fetch(`${baseUrl}/`);
  if (!appResponse.ok || !(await appResponse.text()).includes("Learning Foundry MVP")) throw new Error("React app build is not being served at root");

  const componentResponse = await fetch(`${baseUrl}/component-assets/ratio-explorer/component.html`);
  if (!componentResponse.ok) throw new Error("ComponentAsset is not being served");

  console.log("server smoke passed");
} finally {
  server.kill("SIGTERM");
  await resetState();
}
