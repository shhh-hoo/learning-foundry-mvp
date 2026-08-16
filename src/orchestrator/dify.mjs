const DIFY_ACTION_TYPES = new Set([
  "RESPOND",
  "SUGGEST_CAPABILITY",
  "WAIT_FOR_TEACHER"
]);

function asObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function asString(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function parseWorkflowResult(value) {
  if (typeof value !== "string") return asObject(value, "Dify result");
  try {
    return asObject(JSON.parse(value), "Dify result");
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Dify result was not valid JSON");
    throw error;
  }
}

export function buildDifyTurnContext({
  trigger,
  student,
  task,
  userMessage = "",
  conversation = [],
  latestAttempt = null,
  activeRuntime = null,
  capabilities = []
}) {
  return {
    trigger,
    task: {
      goal: task?.goal ?? "",
      teacherInstruction: task?.teacherInstruction ?? "",
      learnerState: task?.learnerState ?? null
    },
    learner: {
      id: student?.id ?? "",
      name: student?.name ?? ""
    },
    userMessage,
    conversation: conversation.map(({ role, content }) => ({ role, content })),
    latestAttempt: latestAttempt
      ? {
          capabilityId: latestAttempt.capabilityId,
          response: latestAttempt.response,
          correct: latestAttempt.correct,
          assistanceUsed: latestAttempt.assistanceUsed ?? [],
          stateSnapshot: latestAttempt.stateSnapshot ?? null,
          submittedAt: latestAttempt.submittedAt
        }
      : null,
    activeActivity: activeRuntime
      ? {
          capabilityId: activeRuntime.capabilityId,
          status: activeRuntime.status,
          stateSnapshot: activeRuntime.stateSnapshot ?? null,
          recentEvents: (activeRuntime.recentEvents ?? []).map(({ type, payload, occurredAt }) => ({
            type,
            payload,
            occurredAt
          }))
        }
      : null,
    availableCapabilities: capabilities.map(({ id, title, purpose, tags }) => ({
      id,
      title,
      purpose,
      tags: tags ?? []
    }))
  };
}

export function mapDifyResult(rawResult) {
  const result = parseWorkflowResult(rawResult);
  const assistantMessage = asString(result.assistant_message, "assistant_message").trim();
  const actionType = asString(result.action_type, "action_type");
  const capabilityId = asString(result.capability_id, "capability_id").trim();
  const reason = asString(result.reason, "reason").trim();

  if (!assistantMessage) throw new Error("Dify assistant_message must not be empty");
  if (!DIFY_ACTION_TYPES.has(actionType)) throw new Error(`Unsupported Dify action_type: ${actionType}`);

  const guidance = { text: assistantMessage };

  if (actionType === "RESPOND") {
    return { guidance, actionProposal: { kind: "CHAT_ONLY" } };
  }

  if (actionType === "WAIT_FOR_TEACHER") {
    return {
      guidance,
      actionProposal: {
        kind: "WAIT_FOR_TEACHER",
        reason: reason || "Teacher review is required."
      }
    };
  }

  if (!capabilityId) throw new Error("Dify capability_id is required for SUGGEST_CAPABILITY");
  return {
    guidance,
    actionProposal: {
      kind: "LAUNCH_CAPABILITY",
      capabilityId,
      parameters: {},
      reason
    }
  };
}

function difyErrorMessage(body) {
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.data?.error === "string") return body.data.error;
  if (typeof body?.error === "string") return body.error;
  return "Unknown Dify error";
}

export async function runDifyOrchestration(input) {
  const apiKey = process.env.DIFY_API_KEY?.trim();
  if (!apiKey) throw new Error("DIFY_API_KEY is required when ORCHESTRATOR=dify");

  const baseUrl = (process.env.DIFY_BASE_URL?.trim() || "https://api.dify.ai/v1").replace(/\/+$/, "");
  const turnContext = buildDifyTurnContext(input);
  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: {
        turn_context_json: JSON.stringify(turnContext)
      },
      response_mode: "blocking",
      user: `foundry-${input.student.id}`
    })
  });

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Dify workflow returned a non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`Dify workflow request failed (${response.status}): ${difyErrorMessage(body)}`);
  }

  if (body?.data?.status !== "succeeded") {
    throw new Error(`Dify workflow did not succeed: ${difyErrorMessage(body)}`);
  }

  return mapDifyResult(body?.data?.outputs?.result);
}
