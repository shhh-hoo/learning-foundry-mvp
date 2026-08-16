# Learning Foundry MVP

A learner-facing vertical slice of Learning Foundry. The current branch is still a draft: the runtime spine is working, Dify is now the real AI orchestration path, and the learner / teacher UX is still being evaluated rather than treated as settled.

## Core product loop

```text
Teacher assigns a goal
→ learner opens the Task
→ Foundry assembles bounded learner-turn context
→ Dify decides the learner-facing response and whether to suggest a capability
→ Foundry ActionGate validates the proposal
→ learner may run a ComponentAsset
→ Component reports events and an Attempt
→ Foundry persists factual Product State
→ the next learner turn goes back through Dify
```

Foundry owns canonical Task, conversation, RuntimeSession, Attempt, teacher policy and Component execution. Dify owns AI orchestration. Components do not call Dify directly.

## Dify integration

The Dify app is a Workflow with one input:

```text
turn_context_json
```

Foundry sends a bounded JSON view containing:

```text
trigger
task: goal / teacherInstruction / learnerState
learner: id / name
userMessage
recent conversation
latest Attempt
active activity state
available capabilities: id / title / purpose / tags
```

Mock-only learner fields and Component runtime bindings are not sent to Dify.

The Workflow Output node exposes the LLM structured output as `result`:

```json
{
  "assistant_message": "...",
  "action_type": "RESPOND | SUGGEST_CAPABILITY | WAIT_FOR_TEACHER",
  "capability_id": "...",
  "reason": "..."
}
```

`src/orchestrator/dify.mjs` is deliberately a thin transport/contract adapter:

```text
Foundry context
→ POST /workflows/run
→ data.outputs.result
→ map Dify action to the existing Foundry proposal contract
```

Mappings are intentionally mechanical:

```text
RESPOND
→ CHAT_ONLY

SUGGEST_CAPABILITY
→ LAUNCH_CAPABILITY

WAIT_FOR_TEACHER
→ WAIT_FOR_TEACHER
```

The adapter contains no prompts, pedagogical classifier, keyword routing, retrieval logic or model selection. Those remain in Dify. There is no silent fallback from Dify to the mock.

## Orchestrator modes

Offline development / CI uses the deterministic mock by default:

```bash
npm start
```

Real MVP orchestration uses the published Dify Workflow:

```bash
ORCHESTRATOR=dify \
DIFY_API_KEY=your_workflow_app_api_key \
npm start
```

For Dify Cloud the default API base is:

```text
https://api.dify.ai/v1
```

For another deployment, override it server-side:

```bash
DIFY_BASE_URL=https://your-dify.example/v1
```

`DIFY_API_KEY` must remain server-side. If `ORCHESTRATOR=dify` is selected and Dify fails or the key is missing, the request fails visibly; the product does not secretly switch to the mock.

## Capability Registry

The current Registry keeps executable runtime metadata inside Foundry while exposing only semantic capability metadata to Dify.

Current demo capabilities:

```text
Ratio Explorer
- visual interactive activity for understanding what ratios and proportional relationships mean

Calculation Trainer
- numerical practice for independently solving proportional-reasoning calculation questions
```

Dify proposes a capability ID. Foundry resolves the exact registered version and runtime binding after the proposal is returned.

## Component Runtime Protocol v0.1

Learning Components are independent Web apps rather than React product UI components or Dify nodes.

```text
public/component-assets/
  ratio-explorer/component.html
  calculation-trainer/component.html
```

Current Component → Foundry messages:

```text
COMPONENT_READY
COMPONENT_INITIALIZED
LEARNING_EVENT
ATTEMPT_SUBMITTED
STATE_CHANGED
COMPONENT_COMPLETED
COMPONENT_ERROR
```

Messages use the `foundry-component` envelope with protocol version `0.1`, runtime session identity, message identity, timestamp and payload.

The runtime flow is:

```text
COMPONENT_READY
→ FOUNDRY_INIT
→ COMPONENT_INITIALIZED
→ LEARNING_EVENT / STATE_CHANGED / ATTEMPT_SUBMITTED
→ COMPONENT_COMPLETED or COMPONENT_ERROR
```

Attempts are factual evidence. A Component cannot write teacher decisions, authoritative diagnosis or learning outcomes directly.

## Current learner surfaces

The current UI contains:

```text
My learning
→ Task guidance / conversation
→ optional activity offer
→ learner Start
→ Component as primary surface
→ Ask Foundry remains available
→ completion returns to the learner flow
```

These interaction choices are still under product review. In particular, the Activity Offer, screen balance and Teacher Dashboard should not be treated as permanent architecture simply because they are implemented.

## Teacher surface

The current Teacher Workspace supports assigning a goal, seeing learner conversation / recent work and applying capability constraints. Its scope is intentionally subject to further simplification after the real Dify-powered learner loop is used end to end.

## Open-source foundations

Generic UI/state work uses mature open source rather than custom replacements:

- `@assistant-ui/react` — Thread / Message / Composer primitives with Foundry-backed external-store conversation state;
- shadcn/ui patterns — local open-code Button / Card / Badge / Sheet primitives;
- TanStack Query — React server state and invalidation;
- Tailwind CSS + Radix UI;
- React + Vite.

See `THIRD_PARTY_NOTICES.md` for provenance and licenses.

## Run and verify

Requires Node.js `22.12+`.

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

Run the deliberately small verification set:

```bash
npm test
npm run smoke
```

CI verifies the React build, backend syntax, learner-flow contracts, Dify context/result mapping and the offline HTTP smoke. CI does not contain a real Dify API secret, so the live published Workflow must be verified locally with `ORCHESTRATOR=dify`.

## Repository map

```text
client/
  src/
    App.jsx
    LearnerHome.jsx
    LearnerWorkspace.jsx
    TeacherWorkspace.jsx
    RuntimeFrame.jsx
    api.js
    components/
      FoundryChatProvider.jsx
      FoundryThread.jsx
      ActivityOffer.jsx
      ui/

server.mjs
src/
  product-state/store.mjs
  capabilities/registry.mjs
  learning/learner-turn.mjs
  learning/action-gate.mjs
  orchestrator/index.mjs
  orchestrator/mock.mjs        # offline / CI fixture
  orchestrator/dify.mjs        # real Dify Workflow adapter
  runtime/protocol.mjs

public/component-assets/
data/seed.json
checks.mjs
smoke-server.mjs
THIRD_PARTY_NOTICES.md
```

## Next validation

Do not add more orchestration infrastructure yet. The next useful test is to publish the existing Dify Workflow, run Foundry with `ORCHESTRATOR=dify`, and use one learner continuously through:

```text
Task
→ real Dify conversation
→ real capability suggestion
→ Component
→ Attempt
→ real Dify continuation
```

Only after that end-to-end experience is observed should the learner UX and Teacher Dashboard be simplified or changed.
