import { CAPABILITIES } from "./src/capabilities/registry.mjs";
import { runMockOrchestration } from "./src/orchestrator/mock.mjs";

if (CAPABILITIES.length !== 2) throw new Error("Expected two demo capabilities");
const result = await runMockOrchestration({ student: { id: "alice", demoNeed: "conceptual" }, task: { id: "task", goal: "ratio", constraints: { requireCapabilityId: null, excludeCapabilityIds: [] } }, capabilities: CAPABILITIES, latestAttempt: null });
if (result.plan.capabilityId !== "ratio-explorer") throw new Error("Mock orchestration contract failed");
console.log("checks passed");
