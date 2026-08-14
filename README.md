# Learning Foundry MVP

A learner-first, runnable vertical slice of Learning Foundry.

Phase 1 is judged by the user journey, not by how much backend infrastructure exists:

```text
Teacher assigns a goal
→ learner sees it in My learning
→ learner opens the Task
→ Foundry starts with guidance, not a forced tool
→ learner explains what is difficult
→ Foundry may suggest a short activity
→ learner chooses Start
→ the activity becomes the primary surface
→ Ask Foundry remains available in a side sheet
→ work is saved as an Attempt
→ completion returns to guidance / another offered activity / a waiting state
→ teacher can see what is happening and steer the next safe step
```

## Phase 1 user surfaces

### Learner Home

`#student/alice` (and Bob / Charlie) is a simple **My learning** surface. Assigned Tasks appear as learner-facing cards with a human-readable state and a Start / Continue action.

### Guidance Mode

Opening an assigned Task does **not** immediately launch a Component. The first learner turn is conversational:

```text
Foundry:
Before we start, what feels hardest about ratio questions right now:
understanding what the relationship means, or doing the calculation?
```

Conversation is rendered with `assistant-ui`, while canonical message history remains in Foundry Product State.

### Activity Offer

When orchestration decides an interactive activity would help, Foundry creates a `READY` runtime and shows a learner-facing **Try this next** card. This is deliberately different from starting the iframe automatically.

```text
Foundry guidance
+
Try this next
Ratio Explorer
[ Start activity ]
```

The learner can keep asking questions before starting. The offered activity remains stable unless teacher policy changes.

### Activity Mode

After the learner chooses Start, the Component becomes the primary surface. Chat moves behind **Ask Foundry** in a Sheet, so it is available without competing with the activity for half the screen.

```text
Activity / ComponentAsset

                       [ Ask Foundry ]
```

### Transition Mode

On `COMPONENT_COMPLETED`, Foundry first confirms that work is saved, then runs the next learner turn. That turn may:

- continue in conversation;
- offer another activity;
- wait for teacher review;
- expose that no suitable activity is currently available.

An Attempt is a factual learning event. Phase 1 does not fabricate a diagnosis from one incorrect answer.

## Open-source foundations

Phase 1 intentionally uses mature open-source primitives for generic UI work instead of reimplementing them:

- **assistant-ui** (`@assistant-ui/react`) — conversation runtime and Thread / Message / Composer primitives, connected through an external-store runtime to Foundry's own conversation state;
- **shadcn/ui patterns** — local open-code Button, Card, Badge and Sheet primitives adapted from the MIT-licensed Radix implementation;
- **TanStack Query** — server state, mutations and query invalidation for Teacher / Learner workspaces;
- **Tailwind CSS** — product styling;
- **Radix UI** — accessible primitive underneath the local Sheet / Slot patterns;
- **React + Vite** — application and build foundation.

See `THIRD_PARTY_NOTICES.md` for provenance and licenses.

Foundry-specific code remains ours: Task / conversation Product State, learner-turn orchestration contract, ActionGate, Capability Registry, Component Runtime Protocol, RuntimeSession / Attempt capture and teacher policy.

## Product boundary

```text
Learner / Teacher UI
        │
        ▼
Foundry Product API
        │
        ├── Product State
        ├── Capability Registry
        ├── learner-turn service
        ├── mock orchestrator (Phase 1)
        └── ActionGate
                │
                ▼
          guidance / activity offer
                │
         learner chooses Start
                ▼
          Component Runtime
                │
                ▼
          events + Attempt
                │
                ▼
          next learner turn
```

The orchestrator proposes; Foundry validates and commits. A proposed capability does not get direct access to Product State or runtime execution.

## Current learner-turn contract

Canonical learner messages enter through:

```http
POST /api/chat
```

The mock returns a small proposal:

```js
{
  guidance: {
    text: "That sounds more like a meaning problem than a formula problem."
  },
  actionProposal: {
    kind: "LAUNCH_CAPABILITY",
    capabilityId: "ratio-explorer",
    parameters: { goal: "..." },
    reason: "You said the relationship itself is hard to picture or explain."
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

`src/learning/action-gate.mjs` applies Registry availability, teacher policy and current-runtime stickiness. `LAUNCH_CAPABILITY` currently creates a `READY` activity offer; the learner starts it through:

```http
POST /api/runtime-start
```

## Component runtime

Learning Components are independent Web apps rather than React product UI components or orchestrator nodes.

```text
public/component-assets/
  ratio-explorer/component.html
  calculation-trainer/component.html
```

The current Registry binds each capability to its exact demo asset version. The iframe runtime handshake remains:

```text
COMPONENT_READY
→ FOUNDRY_INIT
→ LEARNING_EVENT / STATE_CHANGED / ATTEMPT_SUBMITTED
→ COMPONENT_COMPLETED or COMPONENT_ERROR
```

Components cannot write teacher decisions, authoritative diagnosis or learning outcomes directly.

## Run

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

GitHub Actions also installs dependencies, builds the React UI, syntax-checks the core backend files, runs the learner-flow checks and runs a real HTTP smoke through:

```text
assign Task
→ TASK_OPENED guidance
→ learner message
→ activity offer (READY)
→ learner Start
→ runtime LOADING / ACTIVITY_ACTIVE
```

## Suggested demo walkthrough

1. Teacher assigns the same proportional-reasoning goal to Alice, Bob and Charlie.
2. Open Alice's **My learning** page and start the Task.
3. Foundry asks what she finds difficult; no iframe is forced on entry.
4. Answer: `I can calculate it but I don't understand what the ratio means.`
5. Foundry explains briefly and offers **Ratio Explorer**.
6. Ask one more question before starting; the offer remains available.
7. Choose **Start activity**. The activity becomes the primary page.
8. Use **Ask Foundry** while the activity stays open.
9. Submit the activity Attempt. On completion, return to the transition / guidance flow.
10. In Teacher Workspace, inspect the human-readable conversation, current activity, reason for the step and recent work; change the next activity policy if useful.

## Repository map

```text
client/
  src/
    App.jsx                         routes demo surfaces
    LearnerHome.jsx                 My learning / Task entry
    LearnerWorkspace.jsx            Guidance / Offer / Activity / Transition
    TeacherWorkspace.jsx            Assign / monitor / intervene
    RuntimeFrame.jsx                iframe runtime bridge
    api.js                          Product API client
    components/
      FoundryChatProvider.jsx        assistant-ui ↔ Foundry adapter
      FoundryThread.jsx              assistant-ui chat primitives
      ActivityOffer.jsx              learner-facing activity proposal
      ui/                            local shadcn-style primitives
    lib/utils.js                     shadcn-style `cn()` helper

server.mjs                           HTTP + Product API
src/
  product-state/store.mjs            JSON demo persistence
  capabilities/registry.mjs          Capability Registry
  learning/learner-turn.mjs          learner-turn service
  learning/action-gate.mjs           deterministic commit boundary
  orchestrator/index.mjs             replaceable orchestration seam
  orchestrator/mock.mjs              Phase 1 mock
  runtime/protocol.mjs               Component message validation

public/component-assets/             demo learning Web apps
data/seed.json                        demo Product State seed
THIRD_PARTY_NOTICES.md                open-source provenance
checks.mjs                            small contract checks
smoke-server.mjs                      real HTTP flow smoke
```

## Phase 1 acceptance

Automated checks being green is necessary but not sufficient. Do not call Phase 1 complete until a first-time learner can use the interface without knowing Foundry's architecture:

```text
open assigned learning
→ understand what to do
→ converse
→ understand why an activity is suggested
→ deliberately start it
→ ask for help during it
→ finish it
→ understand that work was saved and what happens next
```

The branch remains a draft until that user-facing walkthrough is manually reviewed.

## Phase 2

Only after the learner experience is accepted:

1. implement one real Dify learner-turn adapter behind `src/orchestrator/index.mjs`;
2. add runtime schema validation at Dify / Registry / Component boundaries;
3. make real conversation + latest Attempt materially affect the Dify proposal;
4. add a richer reusable ComponentAsset only after the loop remains coherent.
