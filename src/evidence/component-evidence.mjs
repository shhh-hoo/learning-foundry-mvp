// Deterministic projection from persisted Component/runtime facts into Agent-readable evidence.
// This module does not infer misconception, mastery, learning quality, or next action.
// It only restructures observable events and deterministic Component results.

function byTimestamp(a, b, field) {
  return String(a?.[field] ?? "").localeCompare(String(b?.[field] ?? ""));
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function durationMs(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
}

function boundedObservations(events, maxObservations = 32) {
  if (maxObservations <= 0) return [];
  if (events.length <= maxObservations) return events;
  const headCount = Math.min(4, maxObservations);
  const tailCount = Math.max(0, maxObservations - headCount);
  return [...events.slice(0, headCount), ...events.slice(-tailCount)];
}

export function buildComponentEvidencePacket(state, session, { maxObservations = 32 } = {}) {
  if (!session) throw new Error("Runtime session is required");

  const allEvents = state.learningEvents
    .filter((event) => event.runtimeSessionId === session.id)
    .sort((a, b) => byTimestamp(a, b, "occurredAt"));

  const attempts = state.attempts
    .filter((attempt) => attempt.runtimeSessionId === session.id)
    .sort((a, b) => byTimestamp(a, b, "submittedAt"));

  const observations = boundedObservations(allEvents, maxObservations);
  const assistanceUsed = uniqueStrings(
    attempts.flatMap((attempt) => Array.isArray(attempt.assistanceUsed) ? attempt.assistanceUsed : [])
  );

  const firstAttempt = attempts[0] ?? null;
  const latestAttempt = attempts.at(-1) ?? null;

  return {
    schemaVersion: "0.1",
    taskId: session.taskId,
    studentId: session.studentId,
    invocation: {
      runtimeSessionId: session.id,
      componentId: session.capabilityId,
      componentVersion: session.capabilityVersion
    },
    lifecycle: {
      status: session.status,
      createdAt: session.createdAt ?? null,
      startedAt: session.startedAt ?? null,
      completedAt: session.completedAt ?? null,
      durationMs: durationMs(session.startedAt, session.completedAt)
    },
    observations: observations.map((event) => ({
      eventId: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload ?? {}
    })),
    observationCount: allEvents.length,
    omittedObservationCount: Math.max(0, allEvents.length - observations.length),
    attempts: attempts.map((attempt, index) => ({
      attemptId: attempt.id,
      index: index + 1,
      submittedAt: attempt.submittedAt,
      response: attempt.response ?? {},
      deterministicResult: {
        correct: typeof attempt.correct === "boolean" ? attempt.correct : null
      },
      assistanceUsed: attempt.assistanceUsed ?? [],
      stateSnapshot: attempt.stateSnapshot ?? null
    })),
    deterministicFacts: {
      attemptCount: attempts.length,
      firstAttemptCorrect: typeof firstAttempt?.correct === "boolean" ? firstAttempt.correct : null,
      latestAttemptCorrect: typeof latestAttempt?.correct === "boolean" ? latestAttempt.correct : null,
      assistanceUsed,
      completed: session.status === "COMPLETED",
      failed: session.status === "FAILED"
    },
    finalStateSnapshot: session.stateSnapshot ?? latestAttempt?.stateSnapshot ?? null,
    provenance: {
      source: "FOUNDry_PRODUCT_STATE",
      componentId: session.capabilityId,
      componentVersion: session.capabilityVersion,
      runtimeSessionId: session.id,
      sourceEventIds: allEvents.map((event) => event.id),
      includedEventIds: observations.map((event) => event.id),
      attemptIds: attempts.map((attempt) => attempt.id)
    }
  };
}

export function buildRecentComponentEvidence(
  state,
  { taskId, limit = 3, maxObservationsPerSession = 32 } = {}
) {
  if (!taskId) return [];

  return state.runtimeSessions
    .filter((session) => session.taskId === taskId)
    .filter((session) =>
      state.learningEvents.some((event) => event.runtimeSessionId === session.id)
      || state.attempts.some((attempt) => attempt.runtimeSessionId === session.id)
    )
    .sort((a, b) =>
      String(b.completedAt ?? b.startedAt ?? b.createdAt ?? "")
        .localeCompare(String(a.completedAt ?? a.startedAt ?? a.createdAt ?? ""))
    )
    .slice(0, limit)
    .reverse()
    .map((session) => buildComponentEvidencePacket(
      state,
      session,
      { maxObservations: maxObservationsPerSession }
    ));
}
