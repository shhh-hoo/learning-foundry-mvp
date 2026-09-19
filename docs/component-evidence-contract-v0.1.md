# Component Evidence Contract v0.1

Status: **Alpha experiment**

This contract defines how Learning Foundry projects persisted Component/runtime facts into a bounded, Agent-readable evidence packet.

It is **not** Component Protocol v1 and does not redefine the stable Component transport contract. Raw Product State remains canonical. This packet is a deterministic, reconstructible context projection.

## 1. Architecture boundary

```text
Component / Asset
  → schema-bound events, state and Attempt results
  → canonical Product State
  → Component Evidence projection
  → Foundry Agent
  → semantic interpretation / next action
```

A Component owns bounded interaction and local execution state. It may compute deterministic results when the family contract makes those results tractable.

A Component does not own durable learner interpretation such as mastery, broad misconception claims, curriculum routing or next-step selection.

The Agent may interpret evidence. Its interpretation is a separate object/class of information and must never overwrite the evidence that supported it.

## 2. Three epistemic layers

### Raw observation

What actually occurred in the Component/runtime:

- learner action/event;
- submitted response;
- state change;
- hint/support request;
- completion/cancellation/error;
- timestamps and artifacts.

### Deterministic fact

A reproducible fact computed from the interaction by Component/runtime code:

- correct / incorrect when correctness is mechanically defined;
- constraint violation;
- attempt count;
- assistance used;
- exact Component/version;
- completion status;
- elapsed runtime duration.

### Agent interpretation

A semantic inference over evidence:

- possible misconception;
- current support need;
- explanation of why a pattern matters;
- suggested next Asset;
- proposed review/transfer/retrieval action.

Agent interpretation is intentionally **not part of ComponentEvidence**.

## 3. Current packet

```js
{
  schemaVersion: "0.1",

  taskId,
  studentId,

  invocation: {
    runtimeSessionId,
    componentId,
    componentVersion
  },

  lifecycle: {
    status,
    createdAt,
    startedAt,
    completedAt,
    durationMs
  },

  observations: [
    {
      eventId,
      type,
      occurredAt,
      payload
    }
  ],

  observationCount,
  omittedObservationCount,

  attempts: [
    {
      attemptId,
      index,
      submittedAt,
      response,
      deterministicResult: {
        correct
      },
      assistanceUsed,
      stateSnapshot
    }
  ],

  deterministicFacts: {
    attemptCount,
    firstAttemptCorrect,
    latestAttemptCorrect,
    assistanceUsed,
    completed,
    failed
  },

  finalStateSnapshot,

  provenance: {
    source: "FOUNDry_PRODUCT_STATE",
    componentId,
    componentVersion,
    runtimeSessionId,
    sourceEventIds,
    includedEventIds,
    attemptIds
  }
}
```

Family-specific payloads remain inside their schema-bound event/result payloads. The generic projection must not invent domain meaning that the family contract did not establish.

## 4. Context compilation

The learner-turn Context Compiler may select a bounded number of recent evidence packets.

Selection is a context-budget decision, not evidence deletion. Canonical events/Attempts remain in Product State even when a particular Agent turn does not receive them.

For the current Alpha slice:

- include up to three recent Component invocations for the Task;
- retain exact Component/version/runtime identity;
- include up to 32 observations per invocation;
- if observations are omitted from the Agent packet, record the omitted count;
- active runtime state remains separately available for real-time guidance.

These are Alpha implementation defaults, not permanent product invariants.

## 5. Trace requirement

Every orchestration decision that consumed Component evidence should retain references to the evidence it used:

```text
runtimeSessionId
componentId
componentVersion
eventIds[]   # only observations actually supplied to the Agent
attemptIds[]
```

The trace answers:

> What observed interaction evidence was available when the Agent produced this response or next-action proposal?

It does not store hidden model chain-of-thought.

## 6. What this contract deliberately excludes

Do not place these fields in ComponentEvidence merely for convenience:

- mastery score;
- learner ability/profile;
- inferred misconception;
- preferred learning style;
- recommended next Component;
- pedagogical strategy label;
- teacher approval;
- institution policy;
- model-generated confidence presented as a deterministic fact.

Those belong to separate Agent interpretation, learner-state projection, policy or human-authority contracts.

## 7. Relation to Component Protocol v1

Component Protocol v1 already provides the correct lower-level seam:

```text
OBSERVATION
ATTEMPT_SUBMITTED
STATE_CHANGED
COMPLETED
CANCELLED
ERROR
+ family-owned schema-bound payloads
```

The Evidence Contract sits **above** this protocol in Foundry Core.

Normal development should therefore not modify Component Protocol v1 merely to make Agent analysis easier. Add or improve family schemas and the deterministic evidence projection first.

## 8. Next contract work

The next vertical slice should validate:

1. whether the generic packet gives the Agent enough information to make a materially better next decision than `latestAttempt`;
2. which family-specific deterministic facts deserve explicit evidence projections;
3. how artifacts such as diagrams, essays, code and generated learner work are referenced without copying large payloads into every model turn;
4. how much historical evidence the Context Compiler should select;
5. whether Agent interpretations need a separate typed claim contract with evidence refs and uncertainty;
6. whether the same evidence packet remains useful when the model/provider changes.

The immediate success criterion is narrow:

> A completed deterministic Component interaction produces attributable evidence; the next real Agent turn receives that evidence and its response/action can be traced back to it.
