# Learning Foundry MVP

A thin, runnable vertical slice of Learning Foundry focused on the learner loop.

```text
Teacher assigns a Task
→ learner opens the Task
→ Foundry runs a task-scoped learner turn
→ guidance appears in Chat
→ Foundry may launch an eligible Capability in Asset Stage
→ learner can ask for help without losing an unfinished activity
→ Component reports events and Attempts through Runtime Protocol v0.1
→ Foundry persists factual Product State
→ Component completion may trigger the next learner turn
→ teacher can inspect conversation, routing and Attempts and change capability policy
```

## Current boundary

Foundry owns canonical Task, conversation, runtime, Attempt and teacher-decision state. The orchestrator only proposes what should happen next.

```text
Product State
    ↓
eligible Capability view
    ↓
mock orchestrator
    ↓
LearnerTurnProposal
    ↓
ActionGate
    ↓
committed guidance / asset launch / wait / no-match
```

Phase 1 intentionally uses a deterministic mock orchestrator. A real Dify workflow is Phase 2 work and is not included in this branch yet.

## What this slice proves

- one teacher / multiple learners;
- one goal assigned to multiple learners;
- React Teacher and Learner Workspaces;
- task-scoped canonical conversation history;
- automatic learner turn when an assigned Task is first opened;
- `POST /api/chat` as the normal learner interaction boundary;
- persisted orchestration decisions with proposal + committed action;
- hard filtering of required/excluded capabilities before orchestration;
- activity stickiness while a RuntimeSession is unfinished;
- sandboxed Web ComponentAssets;
- Component Runtime Protocol v0.1;
- factual Attempt and event persistence;
- next learner turn on `COMPONENT_COMPLETED`;
- teacher `REQUIRE_CAPABILITY` / `EXCLUDE_CAPABILITY` intervention;
- no automatic diagnosis fabricated from a single Attempt.

The JSON store is only a demo persistence adapter. There is no Postgres, multi-tenant/RLS system, n8n, LangGraph, Capability Workshop, Retry/Transfer/Retention system or optimization framework in this phase.

## Run

Requires Node.js `20.19+` or `22.12+`.

```bash
npm install
npm run build
npm start
```

Open `http://127.0.0.1:3000`.

Reset demo state:

```bash
npm run reset
```

Run the deliberately small checks:

```bash
npm test
npm run smoke
```

## Demo walkthrough

1. Open Teacher Workspace and assign the same proportional-reasoning goal to Alice, Bob and Charlie.
2. Open Alice. The Task starts automatically and the mock chooses `Ratio Explorer` for her seeded conceptual need.
3. Ask for help while the activity is open. Chat continues without replacing the unfinished Component.
4. Submit the Component Attempt. Foundry stores the Attempt as a fact.
5. On Component completion, Foundry runs the next learner turn.
6. Return to Teacher Workspace to inspect the transcript, routing decision and Attempts.
7. Require or exclude a capability and observe the policy at the next safe routing boundary.
8. Open Bob to see a different opening route (`Calculation Trainer`).

## Learner-turn contract

Canonical learner interactions enter through:

```http
POST /api/chat
```

The mock returns:

```js
{
  guidance: {
    text: "Let's make the relationship visible."
  },
  actionProposal: {
    kind: "LAUNCH_CAPABILITY",
    capabilityId: "ratio-explorer",
    parameters: { goal: "..." },
    reason: "Learner requested visual support."
  }
}
```

Supported proposal kinds:

```text
CHAT_ONLY
LAUNCH_CAPABILITY
WAIT_FOR_TEACHER
NO_MATCH
```

`src/learning/action-gate.mjs` turns the proposal into a committed product action after checking the current runtime and eligible Registry capabilities.

## Component integration

Learning Components are independent Web apps, not React UI components and not orchestrator nodes.

```text
public/component-assets/
  ratio-explorer/component.html
  calculation-trainer/component.html
```

The Registry stores callable capability metadata and its current exact asset version. The orchestrator proposes a capability ID; Foundry resolves and commits the Registry version.

The React `RuntimeFrame` owns the iframe handshake:

```text
COMPONENT_READY
→ FOUNDRY_INIT
→ LEARNING_EVENT / STATE_CHANGED / ATTEMPT_SUBMITTED
→ COMPONENT_COMPLETED or COMPONENT_ERROR
```

Components cannot write teacher decisions, authoritative diagnosis or learning outcomes directly.

## Repository map

```text
client/
  src/
    App.jsx                  React product shell + hash routing
    LearnerWorkspace.jsx     Chat / Guidance + Asset Stage
    TeacherWorkspace.jsx     Assign / monitor / intervene
    RuntimeFrame.jsx         iframe runtime bridge
    api.js                   Product API client

server.mjs                   HTTP + Product API
src/
  product-state/store.mjs    JSON persistence boundary
  capabilities/registry.mjs  Capability Registry
  learning/learner-turn.mjs  canonical learner-turn service
  learning/action-gate.mjs   deterministic commit boundary
  orchestrator/index.mjs     replaceable orchestration seam
  orchestrator/mock.mjs      Phase 1 orchestration implementation
  runtime/protocol.mjs       Component message validation

public/component-assets/     independent learning Web apps
data/seed.json               demo Product State seed
checks.mjs                   small contract checks
smoke-server.mjs             real HTTP/server walkthrough smoke
```

## Phase 2

Keep the next step narrow:

1. implement one real Dify learner-turn adapter behind `src/orchestrator/index.mjs`;
2. validate Dify, Registry and Component boundaries with runtime schemas;
3. make real conversation and latest Attempt materially affect the Dify proposal;
4. only then add a richer ComponentAsset.
