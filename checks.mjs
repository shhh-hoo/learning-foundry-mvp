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
if (opening.committedAction.kind !== "NONE") throw new Error("Opening turn should begin with guidance, not force an activity");
if (state.conversationEvents.at(-1)?.role !== "ASSISTANT") throw new Error("Opening guidance was not persisted");
if (state.runtimeSessions.length !== 0) throw new Error("Opening guidance should not create a runtime session");

const offer = await executeLearnerTurn(state, {
  taskId: task.id,
  trigger: "CHAT_MESSAGE",
  userMessage: "I can calculate them but I don't understand what the ratio means."
});
if (offer.committedAction.kind !== "LAUNCH_ASSET") throw new Error("Learner need should produce an activity offer");
if (offer.committedAction.capabilityId !== "ratio-explorer") throw new Error("Conceptual need should offer Ratio Explorer");
if (state.runtimeSessions.at(-1)?.status !== "READY") throw new Error("Activity should be offered before it is started");
if (task.learnerState !== "ACTIVITY_READY") throw new Error("Task should expose an activity-ready state");

const sessionId = state.runtimeSessions.at(-1).id;
const chat = await executeLearnerTurn(state, {
  taskId: task.id,
  trigger: "CHAT_MESSAGE",
  userMessage: "Can you explain what I should look for before I start?"
});
if (chat.committedAction.kind !== "NONE") throw new Error("Guidance should not replace an offered activity");
if (state.runtimeSessions.length !== 1 || state.runtimeSessions[0].id !== sessionId) throw new Error("Activity offer stickiness failed");

const eligible = eligibleCapabilitiesForTask(
  { constraints: { requireCapabilityId: null, excludeCapabilityIds: ["ratio-explorer"] } },
  CAPABILITIES
);
if (eligible.some((item) => item.id === "ratio-explorer")) throw new Error("Teacher exclusion was not hard-filtered");

console.log("checks passed");
