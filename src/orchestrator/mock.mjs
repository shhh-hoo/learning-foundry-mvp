function pickPreferredCapability(student, capabilities) {
  const preferredId = student.demoNeed === "procedural" ? "calculation-trainer" : "ratio-explorer";
  return capabilities.find((item) => item.id === preferredId) ?? capabilities[0] ?? null;
}

function otherCapability(capabilities, capabilityId) {
  return capabilities.find((item) => item.id !== capabilityId) ?? null;
}

function messageSuggestsVisualSupport(message) {
  return /(visual|picture|see|show|draw|imagine|看不懂|看一下|图|直观)/i.test(message);
}

function messageSuggestsPractice(message) {
  return /(practice|calculate|calculation|question|problem|try one|练习|计算|做题|试一道)/i.test(message);
}

export async function runMockOrchestration({
  trigger,
  student,
  task,
  userMessage,
  capabilities,
  latestAttempt,
  activeRuntime
}) {
  if (!capabilities.length) {
    return {
      guidance: {
        text: "I don't currently have an eligible activity for this step. I've kept your work and will not pretend that a suitable activity exists."
      },
      actionProposal: {
        kind: "NO_MATCH",
        reason: "No eligible Registry capability remains after teacher policy and availability filtering."
      }
    };
  }

  if (trigger === "CHAT_MESSAGE" && activeRuntime && ["LOADING", "RUNNING"].includes(activeRuntime.status)) {
    return {
      guidance: {
        text: "Stay with the current activity for now. Focus on what the two sides represent rather than trying to finish quickly; I can clarify the task without replacing it."
      },
      actionProposal: { kind: "CHAT_ONLY" }
    };
  }

  if (trigger === "COMPONENT_COMPLETED") {
    if (latestAttempt?.correct === false) {
      const alternative = otherCapability(capabilities, latestAttempt.capabilityId) ?? pickPreferredCapability(student, capabilities);
      return {
        guidance: {
          text: "I've saved that attempt. The last activity exposed a mismatch, so let's try the same goal through a different kind of activity rather than repeating the same interaction."
        },
        actionProposal: {
          kind: "LAUNCH_CAPABILITY",
          capabilityId: alternative.id,
          parameters: { goal: task.goal },
          reason: "Switch modality after a completed unsuccessful attempt."
        }
      };
    }

    return {
      guidance: {
        text: "Your work is saved. Before moving on, explain in your own words what stayed proportional in that activity."
      },
      actionProposal: { kind: "CHAT_ONLY" }
    };
  }

  if (trigger === "TEACHER_INTERVENTION") {
    const selected = pickPreferredCapability(student, capabilities);
    return {
      guidance: {
        text: "Your teacher changed the activity policy for this task. I'll use that constraint for the next step."
      },
      actionProposal: {
        kind: "LAUNCH_CAPABILITY",
        capabilityId: selected.id,
        parameters: { goal: task.goal },
        reason: "Apply the latest teacher capability policy."
      }
    };
  }

  if (trigger === "CHAT_MESSAGE") {
    const message = String(userMessage ?? "");
    const visual = capabilities.find((item) => item.id === "ratio-explorer");
    const practice = capabilities.find((item) => item.id === "calculation-trainer");

    if (messageSuggestsVisualSupport(message) && visual) {
      return {
        guidance: {
          text: "Let's make the relationship visible instead of adding more explanation. Try this short explorer; I'll still be here if you need help while using it."
        },
        actionProposal: {
          kind: "LAUNCH_CAPABILITY",
          capabilityId: visual.id,
          parameters: { goal: task.goal },
          reason: "Learner explicitly requested visual or concrete support."
        }
      };
    }

    if (messageSuggestsPractice(message) && practice) {
      return {
        guidance: {
          text: "Let's test that understanding with a short calculation rather than another explanation."
        },
        actionProposal: {
          kind: "LAUNCH_CAPABILITY",
          capabilityId: practice.id,
          parameters: { goal: task.goal },
          reason: "Learner explicitly requested practice."
        }
      };
    }

    return {
      guidance: {
        text: "The key question is which quantity you already know and which quantity you are trying to find. Tell me those two sides first, and we'll decide whether you need an activity or just a clearer explanation."
      },
      actionProposal: { kind: "CHAT_ONLY" }
    };
  }

  const selected = pickPreferredCapability(student, capabilities);
  return {
    guidance: {
      text: student.demoNeed === "procedural"
        ? "Let's start by trying one short calculation so I can see how you set up the ratio."
        : "Let's start by making the proportional relationship visible. You can ask me for help while the activity is open."
    },
    actionProposal: {
      kind: "LAUNCH_CAPABILITY",
      capabilityId: selected.id,
      parameters: { goal: task.goal },
      reason: "Seeded opening route for the Phase 1 learner-workspace demo."
    }
  };
}
