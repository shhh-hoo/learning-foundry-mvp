# Learning Foundry MVP

A deliberately thin, runnable vertical slice of Learning Foundry.

Phase 1 turns the original runtime skeleton into an actual Learner Workspace:

```text
Teacher assigns a Task
→ learner opens the Task
→ Foundry creates a task-scoped learner turn
→ guidance is shown in Chat
→ Foundry may launch an eligible Capability in Asset Stage
→ learner can ask for help without losing an unfinished activity
→ Component reports events and Attempts through Runtime Protocol v0.1
→ Foundry persists factual Product State
→ activity completion can trigger the next learner turn
→ teacher can inspect conversation, routing and Attempts and change capability policy
```

## Phase 1 product boundary

The learner experiences one workspace with three modes:

```text
Guidance mode
  Chat / Guidance is primary

Activity mode
  Asset Stage is primary
  Chat remains available for help
  an unfinished activity is not silently replaced

Transition mode
  saved Attempt / next guidance / next activity / waiting state
```

Foundry owns canonical Task, conversation, runtime, Attempt and teacher-decision state. The orchestrator only proposes what should happen next.

```text
Foundry Product State
        ↓
eligible Capability view
        ↓
mock orchestrator (Phase 1)
        ↓
LearnerTurnProposal
        ↓
ActionGate
        ↓
committed guidance / asset launch / wait / no-match
```

The mock is intentionally deterministic enough to demonstrate product behavior. Dify is retained as a replaceable adapter but is not required for Phase 1.

## What this slice currently proves

- one teacher (teacher and expert are the same actor)
- multiple seeded students
- teacher assignment of one goal to multiple learners
- React Teacher and Learner Workspaces
- task-scoped canonical conversation history
- automatic learner turn when an assigned Task is first opened
- `POST /api/chat` as the normal learner interaction boundary
- persisted orchestration decisions with proposal + committed action
- hard filtering of excluded/required capabilities before orchestration
- activity stickiness while a RuntimeSession is unfinished
- Web ComponentAssets launched in a sandboxed iframe
- Component Runtime Protocol v0.1
- factual Attempt/event persistence
- automatic next learner turn on `COMPONENT_COMPLETED`
- teacher `REQUIRE_CAPABILITY` / `EXCLUDE_CAPABILITY` intervention
- no automatic diagnosis fabricated from a single incorrect Attempt
- mock orchestration that can later be replaced by Dify

The JSON store remains a demo persistence adapter. There is intentionally no Postgres, multi-tenant/RLS system, n8n, LangGraph, custom LLM control plane, Retry/Transfer/Retention system or optimization framework in this phase.

## Run

Requires Node.js `20.19+` or `22.12+`.

```bash
npm install
npm run build
npm start
```

Open:

```text
http://127.0.0.1:3000
```

The root redirects to the built React workspace.

Reset demo state:

```bash
npm run reset
```

Run the deliberately small contract checks and real-server smoke:

```bash
npm test
npm run smoke
```

## Demo surfaces

Hash-routed React surfaces:

```text
/app/index.html#teacher
/app/index.html#teacher/alice
/app/index.html#student/alice
/app/index.html#student/bob
/app/index.html#student/charlie
```

A Phase 1 walkthrough:

1. Open Teacher Workspace and assign the same proportional-reasoning goal to Alice, Bob and Charlie.
2. Open Alice's Learner Workspace. The Task automatically starts; there is no `Plan next activity` product button.
3. Alice receives opening guidance and `Ratio Explorer` launches because her seeded demo need is conceptual.
4. While the activity is unfinished, send a learner chat message asking for help. Foundry responds but keeps the same Component active.
5. Submit the Component Attempt. The Attempt is persisted as a fact; no generic diagnosis is automatically invented.
6. On Component completion, Foundry runs the next learner turn. An unsuccessful completed Attempt can route to a different eligible capability; a successful Attempt can return to guidance/reflection.
7. Return to Teacher Workspace to inspect the learner transcript, current routing decision and Attempts.
8. Require or exclude a capability. The policy is applied at the next safe routing boundary rather than interrupting an unfinished activity.
9. Repeat with Bob to see a different opening route (`Calculation Trainer`).

## Learner-turn contract

Canonical learner interactions enter through:

```http
POST /api/chat
```

The current mock returns a proposal shaped conceptually as:

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

Possible action proposals in this phase are:

```text
CHAT_ONLY
LAUNCH_CAPABILITY
WAIT_FOR_TEACHER
NO_MATCH
```

`src/learning/action-gate.mjs` converts that proposal into a committed product action after checking current runtime state and eligible Registry capabilities.

## Component integration

Learning Components are independent Web apps, not React UI components and not orchestrator nodes.

For the demo:

```text
public/component-assets/
  ratio-explorer/component.html
  calculation-trainer/component.html
```

The Registry stores the callable capability and its current exact asset runtime metadata. The orchestrator proposes a capability ID; Foundry resolves and commits the current Registry version.

The React `RuntimeFrame` owns the iframe handshake:

```text
COMPONENT_READY
→ FOUNDRY_INIT
→ LEARNING_EVENT / STATE_CHANGED / ATTEMPT_SUBMITTED
→ COMPONENT_COMPLETED or COMPONENT_ERROR
```

Components cannot write teacher decisions, authoritative diagnosis or learning outcomes directly.

A real deployment should place untrusted/generated ComponentAssets on a separate origin. Same-server sandboxed iframes are used here only to keep the demo small.

## Dify status

Dify is **not part of Phase 1 acceptance**.

The repo keeps `src/orchestrator/dify.mjs` behind the same replaceable orchestration boundary so Phase 2 can connect a real learner-turn Workflow without moving Product State or Component execution into Dify.

The intended boundary remains:

```text
Foundry builds bounded learner-turn context
→ Dify proposes guidance + next action
→ Foundry ActionGate validates/commits
→ Foundry persists state and launches runtime
```

Foundry remains the source of truth for conversation history, Task state, Registry, RuntimeSession, Attempts and teacher decisions.

## Repository map

```text
client/
  src/
    App.jsx                  React product shell + hash routing
    LearnerWorkspace.jsx     Chat / Guidance + Asset Stage experience
    TeacherWorkspace.jsx     Assign / monitor / intervene
    RuntimeFrame.jsx         iframe runtime bridge
    api.js                   Product API client

server.mjs                   HTTP + Product API
src/
  product-state/store.mjs    JSON persistence boundary
  capabilities/registry.mjs  Capability Registry
  learning/learner-turn.mjs  canonical learner-turn service
  learning/action-gate.mjs   deterministic commit boundary
  orchestrator/mock.mjs      Phase 1 orchestration
  orchestrator/dify.mjs      Phase 2 adapter seam
  runtime/protocol.mjs       Component Runtime Protocol v0.1

public/component-assets/     independent learning Web apps
data/seed.json               demo Product State seed
checks.mjs                   tiny contract smoke gate
smoke-server.mjs             real HTTP/server walkthrough smoke
```

## Next phase

Phase 2 should stay narrow:

1. connect one real Dify learner-turn Workflow behind the existing orchestrator seam;
2. add runtime schema validation (for example Zod) at Dify/Component/Registry boundaries;
3. make real conversation + latest Attempt materially affect the Dify proposal;
4. replace or add one richer ComponentAsset only after that loop is stable.

Do not expand school tenancy, analytics, Capability Workshop, Retry/Transfer/Retention or optimization until this learner loop feels good as a product.
