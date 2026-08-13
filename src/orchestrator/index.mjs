import { runMockOrchestration } from "./mock.mjs";
import { runDifyOrchestration } from "./dify.mjs";

export async function runOrchestration(input) {
  return process.env.ORCHESTRATOR === "dify"
    ? runDifyOrchestration(input)
    : runMockOrchestration(input);
}
