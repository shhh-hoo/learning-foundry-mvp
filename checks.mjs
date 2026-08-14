import { CAPABILITIES } from "./src/capabilities/registry.mjs";
import { eligibleCapabilitiesForTask } from "./src/learning/action-gate.mjs";
import { executeLearnerTurn } from "./src/learning/learner-turn.mjs";

if (CAPABILITIES.length !== 2) throw new Error("Expected two demo capabilities");

const task = {
  id: "task-1",
  studentId: "alice",
  goal: "Understand ratios",
  status: "OPEN",
  learnerState: "NOT_STARTED",
  constraints: { requireCapabilityId: null, excludeCapabilityIds: [] },
  currentDecisionId: null,
  currentRuntimeSessionId: null
};

const state = {
  teacher: { id: "teacher-1", name: "Demo Teacher" },
  students: [{ id: "alice", name: "Alice", demoNeed: "conceptual" }],
  tasks: [task],
  conversationEvents: [],
  orchestrationDecisions: [],
  runtimeSessions: [],
  attempts: [],
  learningEvents: [],
  teacherDecisions: []
};

const opening = await executeLearnerTurn(state, { taskId: task.id, trigger: "TASK_OPENED" });
if (opening.committedAction.kind !== "LAUNCH_ASSET") throw new Error("Opening turn should launch an activity");
if (opening.committedAction.capabilityId !== "ratio-explorer") throw new Error("Alice should open with Ratio Explorer");
if (state.conversationEvents.at(-1)?.role !== "ASSISTANT") throw new Error("Opening guidance was not persisted");
if (state.runtimeSessions.length !== 1) throw new Error("Runtime session was not created");

const eligible = eligibleCapabilitiesForTask(
  { constraints: { requireCapabilityId: null, excludeCapabilityIds: ["ratio-explorer"] } },
  CAPABILITIES
);
if (eligible.some((item) => item.id === "ratio-explorer")) throw new Error("Teacher exclusion was not hard-filtered");

const chat = await executeLearnerTurn(state, {
  taskId: task.id,
  trigger: "CHAT_MESSAGE",
  userMessage: "I don't understand what this activity is asking me to do."
});
if (chat.committedAction.kind !== "NONE") throw new Error("Chat must not replace an unfinished activity");
if (state.runtimeSessions.length !== 1) throw new Error("Activity stickiness failed");

console.log("checks passed");
