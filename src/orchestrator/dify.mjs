function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

export async function runDifyOrchestration({ student, task, capabilities, latestAttempt }) {
  const baseUrl = (process.env.DIFY_BASE_URL ?? "https://api.dify.ai").replace(/\/$/, "");
  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) throw new Error("DIFY_API_KEY is required when ORCHESTRATOR=dify");

  const response = await fetch(`${baseUrl}/v1/workflows/run`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: {
        context_json: JSON.stringify({ student, task }),
        capabilities_json: JSON.stringify(capabilities),
        latest_attempt_json: JSON.stringify(latestAttempt ?? null)
      },
      response_mode: "blocking",
      user: `foundry-${student.id}`
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Dify workflow failed with ${response.status}: ${detail}`);
  }

  const body = await response.json();
  const outputs = body?.data?.outputs ?? body?.outputs ?? {};
  const resolution = parseMaybeJson(outputs.resolution);
  const plan = parseMaybeJson(outputs.plan);

  if (resolution && plan) return { resolution, plan };

  const result = parseMaybeJson(outputs.result);
  if (result && typeof result === "object" && result.resolution && result.plan) return result;

  throw new Error("Dify workflow must return resolution + plan outputs, or a result JSON containing both.");
}
