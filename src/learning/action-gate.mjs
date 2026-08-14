const ACTIVE_RUNTIME_STATUSES = new Set(["READY", "LOADING", "RUNNING"]);

export function eligibleCapabilitiesForTask(task, capabilities) {
  const excluded = new Set(task.constraints?.excludeCapabilityIds ?? []);
  const available = capabilities.filter((item) => !excluded.has(item.id));
  const requiredId = task.constraints?.requireCapabilityId;
  if (!requiredId) return available;
  return available.filter((item) => item.id === requiredId);
}

export function commitActionProposal({ proposal, eligibleCapabilities, activeRuntime }) {
  const action = proposal?.actionProposal ?? { kind: "CHAT_ONLY" };

  if (action.kind === "CHAT_ONLY") return { kind: "NONE" };

  if (action.kind === "WAIT_FOR_TEACHER") {
    return { kind: "WAIT_FOR_TEACHER", reason: action.reason ?? "Teacher review is required." };
  }

  if (action.kind === "NO_MATCH") {
    return { kind: "NO_MATCH", reason: action.reason ?? "No suitable capability is currently available." };
  }

  if (action.kind !== "LAUNCH_CAPABILITY") return { kind: "NONE" };

  if (activeRuntime && ACTIVE_RUNTIME_STATUSES.has(activeRuntime.status)) {
    return {
      kind: "CONTINUE_ACTIVE",
      runtimeSessionId: activeRuntime.id,
      reason: "Keep the current offered or active learning activity."
    };
  }

  const capability = eligibleCapabilities.find((item) => item.id === action.capabilityId);
  if (!capability) {
    return {
      kind: "NO_MATCH",
      reason: "The suggested activity is not currently available under teacher policy."
    };
  }

  return {
    kind: "LAUNCH_ASSET",
    capabilityId: capability.id,
    capabilityVersion: capability.version,
    parameters: action.parameters ?? {},
    rationale: action.reason ?? "",
    asset: {
      launchUrl: capability.runtime.launchUrl,
      protocolVersion: capability.runtime.protocolVersion,
      type: capability.runtime.type
    }
  };
}
