import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readState, mutateState } from "./src/product-state/store.mjs";
import { getCapability, listAvailableCapabilities } from "./src/capabilities/registry.mjs";
import { executeLearnerTurn } from "./src/learning/learner-turn.mjs";
import { isComponentMessage } from "./src/runtime/protocol.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PUBLIC_ROOT = join(ROOT, "public");
const PORT = Number(process.env.PORT ?? 3000);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function findTask(state, taskId) {
  return state.tasks.find((task) => task.id === taskId) ?? null;
}

function findStudent(state, studentId) {
  return state.students.find((student) => student.id === studentId) ?? null;
}

function studentView(state, studentId) {
  const student = findStudent(state, studentId);
  if (!student) return null;
  const taskIds = new Set(state.tasks.filter((task) => task.studentId === studentId).map((task) => task.id));
  return {
    student,
    tasks: state.tasks.filter((task) => task.studentId === studentId),
    conversationEvents: state.conversationEvents.filter((item) => taskIds.has(item.taskId)),
    orchestrationDecisions: state.orchestrationDecisions.filter((item) => taskIds.has(item.taskId)),
    attempts: state.attempts.filter((attempt) => attempt.studentId === studentId),
    sessions: state.runtimeSessions.filter((session) => session.studentId === studentId)
  };
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    const state = await readState();
    return sendJson(res, 200, {
      ...state,
      capabilities: listAvailableCapabilities()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/student") {
    const state = await readState();
    const view = studentView(state, url.searchParams.get("id"));
    return view ? sendJson(res, 200, view) : sendJson(res, 404, { error: "Student not found" });
  }

  if (req.method === "POST" && url.pathname === "/api/assignments") {
    const input = await readJson(req);
    const goal = String(input.goal ?? "").trim();
    if (!goal) return sendJson(res, 400, { error: "goal is required" });

    const created = await mutateState((state) => {
      const selectedIds = Array.isArray(input.studentIds) && input.studentIds.length
        ? input.studentIds
        : state.students.map((student) => student.id);
      const now = new Date().toISOString();
      const tasks = selectedIds.flatMap((studentId) => {
        if (!findStudent(state, studentId)) return [];
        const task = {
          id: randomUUID(),
          studentId,
          goal,
          teacherInstruction: String(input.teacherInstruction ?? "").trim(),
          status: "OPEN",
          learnerState: "NOT_STARTED",
          createdAt: now,
          constraints: { requireCapabilityId: null, excludeCapabilityIds: [] },
          currentDecisionId: null,
          currentRuntimeSessionId: null
        };
        state.tasks.push(task);
        return [task];
      });
      return tasks;
    });
    return sendJson(res, 201, { tasks: created });
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const input = await readJson(req);
    const message = String(input.message ?? "").trim();
    const trigger = String(input.trigger ?? (message ? "CHAT_MESSAGE" : "TASK_OPENED"));
    const allowedTriggers = new Set(["TASK_OPENED", "CHAT_MESSAGE", "LEARNER_REQUESTED_SWITCH"]);
    if (!allowedTriggers.has(trigger)) return sendJson(res, 400, { error: "Unsupported learner-turn trigger" });
    if (trigger === "CHAT_MESSAGE" && !message) return sendJson(res, 400, { error: "message is required" });

    try {
      const result = await mutateState(async (state) => {
        const task = findTask(state, input.taskId);
        if (!task) throw new Error("Task not found");
        if (input.studentId && task.studentId !== input.studentId) throw new Error("Task does not belong to this student");
        return executeLearnerTurn(state, {
          taskId: task.id,
          trigger,
          userMessage: message
        });
      });
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/runtime-messages") {
    const input = await readJson(req);
    const message = input.message;
    if (!isComponentMessage(message)) return sendJson(res, 400, { error: "Invalid Component Runtime Protocol message" });

    try {
      const result = await mutateState(async (state) => {
        const session = state.runtimeSessions.find((item) => item.id === message.runtimeSessionId);
        if (!session) throw new Error("Runtime session not found");
        const task = findTask(state, session.taskId);
        if (!task) throw new Error("Task not found");

        state.learningEvents.push({
          id: randomUUID(),
          studentId: session.studentId,
          taskId: session.taskId,
          runtimeSessionId: session.id,
          type: message.type,
          payload: message.payload,
          occurredAt: message.timestamp
        });

        if (message.type === "COMPONENT_INITIALIZED") session.status = "RUNNING";
        if (message.type === "STATE_CHANGED") session.stateSnapshot = message.payload.state ?? null;
        if (message.type === "COMPONENT_COMPLETED") session.status = "COMPLETED";
        if (message.type === "COMPONENT_ERROR") {
          session.status = "FAILED";
          task.learnerState = "RUNTIME_FAILURE";
        }

        let attempt = null;
        if (message.type === "ATTEMPT_SUBMITTED") {
          attempt = {
            id: randomUUID(),
            studentId: session.studentId,
            taskId: session.taskId,
            runtimeSessionId: session.id,
            capabilityId: session.capabilityId,
            capabilityVersion: session.capabilityVersion,
            response: message.payload.attempt?.response ?? {},
            correct: message.payload.attempt?.correct ?? null,
            assistanceUsed: message.payload.attempt?.assistanceUsed ?? [],
            stateSnapshot: message.payload.attempt?.stateSnapshot ?? session.stateSnapshot,
            submittedAt: message.timestamp
          };
          state.attempts.push(attempt);
        }

        const nextTurn = message.type === "COMPONENT_COMPLETED"
          ? await executeLearnerTurn(state, { taskId: task.id, trigger: "COMPONENT_COMPLETED" })
          : null;

        return { session, attempt, nextTurn };
      });
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/teacher-decisions") {
    const input = await readJson(req);
    try {
      const result = await mutateState(async (state) => {
        const task = findTask(state, input.taskId);
        if (!task) throw new Error("Task not found");
        const action = String(input.action ?? "");
        const capabilityId = input.capabilityId ? String(input.capabilityId) : null;

        if (action === "REQUIRE_CAPABILITY") {
          if (!getCapability(capabilityId)) throw new Error("Capability not found");
          task.constraints.requireCapabilityId = capabilityId;
          task.constraints.excludeCapabilityIds = (task.constraints.excludeCapabilityIds ?? []).filter((id) => id !== capabilityId);
        } else if (action === "EXCLUDE_CAPABILITY") {
          if (!getCapability(capabilityId)) throw new Error("Capability not found");
          task.constraints.excludeCapabilityIds = [...new Set([...(task.constraints.excludeCapabilityIds ?? []), capabilityId])];
          if (task.constraints.requireCapabilityId === capabilityId) task.constraints.requireCapabilityId = null;
        } else if (action === "CLEAR_CONSTRAINTS") {
          task.constraints = { requireCapabilityId: null, excludeCapabilityIds: [] };
        } else {
          throw new Error("Unknown teacher decision");
        }

        const decision = {
          id: randomUUID(),
          studentId: task.studentId,
          taskId: task.id,
          action,
          capabilityId,
          rationale: String(input.rationale ?? "").trim(),
          createdAt: new Date().toISOString()
        };
        state.teacherDecisions.push(decision);

        const currentRuntime = task.currentRuntimeSessionId
          ? state.runtimeSessions.find((session) => session.id === task.currentRuntimeSessionId) ?? null
          : null;
        const canReplanNow = !currentRuntime || !["LOADING", "RUNNING"].includes(currentRuntime.status);
        const nextTurn = canReplanNow
          ? await executeLearnerTurn(state, { taskId: task.id, trigger: "TEACHER_INTERVENTION" })
          : null;

        return { decision, nextTurn };
      });
      return sendJson(res, 201, result);
    } catch (error) {
      return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  return false;
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/app/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_ROOT, safePath);
  if (!filePath.startsWith(PUBLIC_ROOT)) return sendJson(res, 403, { error: "Forbidden" });

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await api(req, res, url);
      if (handled !== false) return;
      return sendJson(res, 404, { error: "API route not found" });
    }
    return serveStatic(req, res, url);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Learning Foundry MVP: http://127.0.0.1:${PORT}`);
});
