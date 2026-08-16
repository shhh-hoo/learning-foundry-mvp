import { CAPABILITIES } from "./src/capabilities/registry.mjs";
import { eligibleCapabilitiesForTask } from "./src/learning/action-gate.mjs";
import { executeLearnerTurn } from "./src/learning/learner-turn.mjs";
import { buildDifyTurnContext, mapDifyResult } from "./src/orchestrator/dify.mjs";

if (CAPABILITIES.length !== 2) throw new Error("Expected two demo capabilities");

const task = {
  id: "task-1",
  studentId: "alice",
  goal: "Understand ratios",
  status: "OPEN",
  learnerState: "NOT_STARTED",
  teacherInstruction: "Focus on meaning before formulas.",
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

const difyContext = buildDifyTurnContext({
  trigger: "CHAT_MESSAGE",
  student: state.students[0],
  task,
  userMessage: "Can I try a numerical question?",
  conversation: [{ role: "LEARNER", content: "Can I try a numerical question?" }],
  latestAttempt: null,
  activeRuntime: null,
  capabilities: CAPABILITIES
});
if ("demoNeed" in difyContext.learner) throw new Error("Dify context must not include mock-only demoNeed");
if (difyContext.availableCapabilities.some((item) => "runtime" in item || "version" in item)) {
  throw new Error("Dify must receive semantic capability metadata, not runtime bindings");
}

const mappedSuggestion = mapDifyResult({
  assistant_message: "Let's try one numerical question.",
  action_type: "SUGGEST_CAPABILITY",
  capability_id: "calculation-trainer",
  reason: "The learner explicitly requested numerical practice."
});
if (mappedSuggestion.actionProposal.kind !== "LAUNCH_CAPABILITY") throw new Error("Dify suggestion mapping failed");
if (mappedSuggestion.actionProposal.capabilityId !== "calculation-trainer") throw new Error("Dify capability mapping failed");

const mappedResponse = mapDifyResult({
  assistant_message: "Tell me what part is unclear.",
  action_type: "RESPOND",
  capability_id: "",
  reason: "More clarification is useful."
});
if (mappedResponse.actionProposal.kind !== "CHAT_ONLY") throw new Error("Dify response mapping failed");

console.log("checks passed");
