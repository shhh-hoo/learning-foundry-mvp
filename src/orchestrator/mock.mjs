export async function runMockOrchestration({ student, task, capabilities, latestAttempt }) {
  const excluded = new Set(task.constraints?.excludeCapabilityIds ?? []);
  const eligible = capabilities.filter((item) => !excluded.has(item.id));
  const requiredId = task.constraints?.requireCapabilityId;
  let selected = requiredId ? eligible.find((item) => item.id === requiredId) : null;

  if (!selected) {
    const preferredId = student.demoNeed === "procedural" ? "calculation-trainer" : "ratio-explorer";
    selected = eligible.find((item) => item.id === preferredId) ?? eligible[0] ?? null;
  }

  if (latestAttempt?.correct === false && eligible.length > 1) {
    selected = eligible.find((item) => item.id !== latestAttempt.capabilityId) ?? selected;
  }

  if (!selected) {
    return {
      resolution: {
        type: "NO_MATCH",
        candidates: capabilities.map((item) => ({ id: item.id, version: item.version, eligible: false })),
        recommendedAction: "GENERATE",
        rationale: "No capability satisfies the current teacher constraints."
      },
      plan: { status: "BLOCKED", reason: "NO_MATCH" }
    };
  }

  return {
    resolution: {
      type: "SELECT",
      candidates: capabilities.map((item) => ({
        id: item.id,
        version: item.version,
        eligible: !excluded.has(item.id)
      })),
      selected: { id: selected.id, version: selected.version },
      parameters: { goal: task.goal },
      rationale: requiredId
        ? "Teacher-required capability."
        : latestAttempt?.correct === false
          ? "The mock switches modality after the latest unsuccessful attempt."
          : "Mock routing for the current seeded demo state."
    },
    plan: {
      status: "READY",
      capabilityId: selected.id,
      capabilityVersion: selected.version,
      parameters: { goal: task.goal },
      purpose: "NEXT_LEARNING_ACTIVITY"
    }
  };
}
