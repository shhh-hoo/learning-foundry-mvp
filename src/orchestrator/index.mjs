import { runMockOrchestration } from "./mock.mjs";
import { runDifyOrchestration } from "./dify.mjs";

function normalizeLegacyResult(result) {
  if (result?.guidance && result?.actionProposal) return result;

  if (result?.plan?.status === "READY") {
    return {
      guidance: {
        text: result.resolution?.rationale ?? "I've selected the next activity for this task."
      },
      actionProposal: {
        kind: "LAUNCH_CAPABILITY",
        capabilityId: result.plan.capabilityId,
        parameters: result.plan.parameters ?? {},
        reason: result.resolution?.rationale ?? "Legacy orchestration result."
      }
    };
  }

  if (result?.resolution?.type === "NO_MATCH" || result?.plan?.reason === "NO_MATCH") {
    return {
      guidance: {
        text: result.resolution?.rationale ?? "I don't currently have a suitable activity for this step."
      },
      actionProposal: {
        kind: "NO_MATCH",
        reason: result.resolution?.rationale ?? "Legacy orchestration returned no match."
      }
    };
  }

  return {
    guidance: {
      text: result?.resolution?.rationale ?? "Let's continue with guidance before starting another activity."
    },
    actionProposal: { kind: "CHAT_ONLY" }
  };
}

export async function runOrchestration(input) {
  const raw = process.env.ORCHESTRATOR === "dify"
    ? await runDifyOrchestration(input)
    : await runMockOrchestration(input);
  return normalizeLegacyResult(raw);
}
