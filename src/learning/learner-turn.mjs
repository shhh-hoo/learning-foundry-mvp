import { randomUUID } from "node:crypto";
import { listAvailableCapabilities } from "../capabilities/registry.mjs";
import { runOrchestration } from "../orchestrator/index.mjs";
import { commitActionProposal, eligibleCapabilitiesForTask } from "./action-gate.mjs";

function findTask(state, taskId) {
  return state.tasks.find((task) => task.id === taskId) ?? null;
}

function findStudent(state, studentId) {
  return state.students.find((student) => student.id === studentId) ?? null;
}

function latestBy(items, field) {
  return [...items].sort((a, b) => String(b[field] ?? "").localeCompare(String(a[field] ?? "")))[0] ?? null;
}

export async function executeLearnerTurn(state, { taskId, trigger, userMessage = "" }) {
  const task = findTask(state, taskId);
  if (!task) throw new Error("Task not found");
  const student = findStudent(state, task.studentId);
  if (!student) throw new Error("Student not found");

  if (trigger === "TASK_OPENED") {
    const alreadyOpened = state.orchestrationDecisions.some(
      (item) => item.taskId === task.id && item.trigger === "TASK_OPENED"
    );
    if (alreadyOpened) return { skipped: true, reason: "TASK_ALREADY_OPENED" };
  }

  const trimmedMessage = String(userMessage ?? "").trim();
  if (trimmedMessage) {
    state.conversationEvents.push({
      id: randomUUID(),
      taskId: task.id,
      studentId: student.id,
      role: "LEARNER",
      content: trimmedMessage,
      createdAt: new Date().toISOString()
    });
  }

  const conversation = state.conversationEvents
    .filter((item) => item.taskId === task.id && (item.role === "LEARNER" || item.role === "ASSISTANT"))
    .slice(-12)
    .map(({ role, content }) => ({ role, content }));

  const latestAttempt = latestBy(
    state.attempts.filter((attempt) => attempt.taskId === task.id),
    "submittedAt"
  );

  const currentRuntime = task.currentRuntimeSessionId
    ? state.runtimeSessions.find((session) => session.id === task.currentRuntimeSessionId) ?? null
    : null;

  const recentRuntimeEvents = currentRuntime
    ? state.learningEvents
        .filter((event) => event.runtimeSessionId === currentRuntime.id)
        .slice(-8)
    : [];

  const eligibleCapabilities = eligibleCapabilitiesForTask(task, listAvailableCapabilities());

  const proposal = await runOrchestration({
    trigger,
    student,
    task,
    userMessage: trimmedMessage,
    conversation,
    latestAttempt,
    activeRuntime: currentRuntime
      ? {
          id: currentRuntime.id,
          capabilityId: currentRuntime.capabilityId,
          capabilityVersion: currentRuntime.capabilityVersion,
          status: currentRuntime.status,
          stateSnapshot: currentRuntime.stateSnapshot,
          recentEvents: recentRuntimeEvents
        }
      : null,
    capabilities: eligibleCapabilities
  });

  const committedAction = commitActionProposal({
    proposal,
    eligibleCapabilities,
    activeRuntime: currentRuntime
  });

  const decision = {
    id: randomUUID(),
    taskId: task.id,
    studentId: student.id,
    trigger,
    proposal,
    committedAction,
    createdAt: new Date().toISOString()
  };
  state.orchestrationDecisions.push(decision);
  task.currentDecisionId = decision.id;

  const guidanceText = String(proposal?.guidance?.text ?? "").trim();
  let assistantEvent = null;
  if (guidanceText) {
    assistantEvent = {
      id: randomUUID(),
      taskId: task.id,
      studentId: student.id,
      role: "ASSISTANT",
      content: guidanceText,
      orchestrationDecisionId: decision.id,
      createdAt: new Date().toISOString()
    };
    state.conversationEvents.push(assistantEvent);
  }

  let runtimeSession = null;
  if (committedAction.kind === "LAUNCH_ASSET") {
    runtimeSession = {
      id: randomUUID(),
      studentId: student.id,
      taskId: task.id,
      capabilityId: committedAction.capabilityId,
      capabilityVersion: committedAction.capabilityVersion,
      status: "LOADING",
      parameters: committedAction.parameters ?? {},
      stateSnapshot: null,
      createdAt: new Date().toISOString()
    };
    state.runtimeSessions.push(runtimeSession);
    task.currentRuntimeSessionId = runtimeSession.id;
    task.learnerState = "ACTIVITY_ACTIVE";
  } else if (committedAction.kind === "CONTINUE_ACTIVE") {
    task.learnerState = "ACTIVITY_ACTIVE";
  } else if (committedAction.kind === "WAIT_FOR_TEACHER") {
    task.learnerState = "WAITING_FOR_TEACHER";
  } else if (committedAction.kind === "NO_MATCH") {
    task.learnerState = "NO_MATCH";
  } else {
    task.learnerState = currentRuntime && ["LOADING", "RUNNING"].includes(currentRuntime.status)
      ? "ACTIVITY_ACTIVE"
      : "GUIDANCE";
  }

  return {
    skipped: false,
    proposal,
    committedAction,
    decision,
    assistantEvent,
    runtimeSession
  };
}
