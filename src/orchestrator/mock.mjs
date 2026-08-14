function pickPreferredCapability(student, capabilities) {
  const preferredId = student.demoNeed === "procedural" ? "calculation-trainer" : "ratio-explorer";
  return capabilities.find((item) => item.id === preferredId) ?? capabilities[0] ?? null;
}

function otherCapability(capabilities, capabilityId) {
  return capabilities.find((item) => item.id !== capabilityId) ?? null;
}

function messageSuggestsVisualSupport(message) {
  return /(visual|picture|see|show|draw|imagine|meaning|understand why|what it means|看不懂|看一下|图|直观|什么意思)/i.test(message);
}

function messageSuggestsPractice(message) {
  return /(practice|calculate|calculation|question|problem|try one|numbers|练习|计算|做题|试一道)/i.test(message);
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
      guidance: { text: "I don't have a suitable activity ready for this step yet. We can keep talking while the next step is worked out." },
      actionProposal: { kind: "NO_MATCH", reason: "No eligible activity is currently available." }
    };
  }

  if (trigger === "TASK_OPENED") {
    return {
      guidance: {
        text: "Before we start, what feels hardest about ratio questions right now: understanding what the relationship means, or doing the calculation?"
      },
      actionProposal: { kind: "CHAT_ONLY" }
    };
  }

  if (trigger === "CHAT_MESSAGE" && activeRuntime && ["READY", "LOADING", "RUNNING"].includes(activeRuntime.status)) {
    return {
      guidance: {
        text: activeRuntime.status === "READY"
          ? "That activity is still ready when you want it. If you tell me what feels unclear, I can help before you start."
          : "Stay with this activity for now. Tell me what part is confusing and I'll help without taking you out of it."
      },
      actionProposal: { kind: "CHAT_ONLY" }
    };
  }

  if (trigger === "COMPONENT_COMPLETED") {
    if (latestAttempt?.correct === false) {
      const alternative = otherCapability(capabilities, latestAttempt.capabilityId) ?? pickPreferredCapability(student, capabilities);
      return {
        guidance: {
          text: "Your work is saved. That attempt suggests a different kind of practice may help, so I have one short next activity ready for you."
        },
        actionProposal: {
          kind: "LAUNCH_CAPABILITY",
          capabilityId: alternative.id,
          parameters: { goal: task.goal },
          reason: "A different representation may be more useful after the completed attempt."
        }
      };
    }

    return {
      guidance: {
        text: "Your work is saved. Before we move on, explain in one sentence what stayed proportional in that activity."
      },
      actionProposal: { kind: "CHAT_ONLY" }
    };
  }

  if (trigger === "TEACHER_INTERVENTION") {
    const selected = pickPreferredCapability(student, capabilities);
    return {
      guidance: { text: "Your teacher adjusted the next step for this task. I have an activity ready when you want to continue." },
      actionProposal: {
        kind: "LAUNCH_CAPABILITY",
        capabilityId: selected.id,
        parameters: { goal: task.goal },
        reason: "This activity follows the teacher's latest guidance for the task."
      }
    };
  }

  if (trigger === "CHAT_MESSAGE") {
    const message = String(userMessage ?? "");
    const visual = capabilities.find((item) => item.id === "ratio-explorer");
    const practice = capabilities.find((item) => item.id === "calculation-trainer");

    if (messageSuggestsVisualSupport(message) && visual) {
      return {
        guidance: { text: "That sounds more like a meaning problem than a formula problem. Let's make the relationship visible first." },
        actionProposal: {
          kind: "LAUNCH_CAPABILITY",
          capabilityId: visual.id,
          parameters: { goal: task.goal },
          reason: "You said the relationship itself is hard to picture or explain."
        }
      };
    }

    if (messageSuggestsPractice(message) && practice) {
      return {
        guidance: { text: "Let's try one short calculation and use it to see exactly where the setup becomes difficult." },
        actionProposal: {
          kind: "LAUNCH_CAPABILITY",
          capabilityId: practice.id,
          parameters: { goal: task.goal },
          reason: "You asked to work through the calculation with practice."
        }
      };
    }

    const selected = pickPreferredCapability(student, capabilities);
    return {
      guidance: {
        text: "Thanks — I want to check that with something concrete rather than keep explaining in the abstract. I have a short activity you can try when you're ready."
      },
      actionProposal: {
        kind: "LAUNCH_CAPABILITY",
        capabilityId: selected.id,
        parameters: { goal: task.goal },
        reason: "A short interactive check can make the learner's current understanding more concrete."
      }
    };
  }

  return {
    guidance: { text: "Tell me what feels unclear and we'll decide the next useful step together." },
    actionProposal: { kind: "CHAT_ONLY" }
  };
}
