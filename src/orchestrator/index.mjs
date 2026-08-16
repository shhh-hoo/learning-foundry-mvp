import { runDifyOrchestration } from "./dify.mjs";
import { runMockOrchestration } from "./mock.mjs";

export function runOrchestration(input) {
  const mode = process.env.ORCHESTRATOR?.trim() || "mock";
  if (mode === "mock") return runMockOrchestration(input);
  if (mode === "dify") return runDifyOrchestration(input);
  throw new Error(`Unsupported ORCHESTRATOR: ${mode}`);
}
