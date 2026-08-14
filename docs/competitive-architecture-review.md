# Competitive Architecture Review — Learning Foundry MVP

Status: design review, not normative product definition  
Date: 2026-08-15  
Scope: learner experience, orchestration, teacher visibility, Component runtime, Dify boundary

## 1. Executive conclusion

The market has already converged on several ideas that Foundry previously treated as differentiating:

- teacher-defined AI learning experiences;
- student chat/tutoring;
- differentiated delivery;
- embedded interactive tools;
- real-time teacher monitoring;
- session analytics and follow-up recommendations.

The closest public product pattern is SchoolAI's `Space + Sidekick + PowerUps + Mission Control`. Flint is especially close on `teacher activity → student session → transcript/analytics → follow-up activity`. Kira combines a contextual AI Tutor, interactive activities, pacing and LMS state. Khanmigo combines tutoring with assigned activities and a curated content ecosystem. Synthesis is important for a different reason: it explicitly does not delegate all pedagogy to an LLM and uses curated interactive experiences plus continuous micro-assessment.

Therefore Foundry should **not** optimize for proving that chat and interactive tools can coexist. That is already a commodity direction.

The architectural idea still worth proving is narrower:

> Foundry can treat different learning behaviours as callable capabilities, route a learner between them from persistent learning state, keep teacher policy in the loop, and execute heterogeneous Web ComponentAssets behind one runtime contract.

Even this must be demonstrated, not claimed as a moat.

---

## 2. Products reviewed

Research used current official product/help documentation for:

- Flint — chats, activities, sessions, activity/class analytics, live alerts and suggested follow-up activities;
- SchoolAI — Spaces, Sidekick, PowerUps and Mission Control;
- Kira Learning — AI Tutor, Activity Builder, adaptive difficulty, classroom pacing and analytics;
- Khan Academy / Khanmigo — student tutor, assignable Khanmigo activities, Khan content and teacher tools;
- Synthesis Tutor — adaptive tutoring, expert-designed interactive experiences and continuous micro-assessment;
- Class Companion — teacher assignments, AI feedback, retry behaviour and student/class insights.

This document describes only publicly documented behaviour. Absence of a feature below means it was not found in the public material reviewed, not that the company cannot or does not implement it internally.

---

## 3. Competitive implications

### 3.1 Chat + tools is not the differentiator

SchoolAI already places focused interactive applications (PowerUps) inside a chat-led learning environment. Its public examples include flashcards, graphing, mind maps, drawing/document tools and video exploration.

Foundry should therefore stop framing this architecture as:

```text
Chat
+
Component
=
novel product
```

The useful question is:

```text
Who decides which learning behaviour runs next,
based on what state,
under what teacher constraints,
and how does the result return to the same learning loop?
```

### 3.2 Teacher observability is table stakes

Flint and SchoolAI both put substantial emphasis on teachers seeing student work while it happens and identifying who needs intervention. Class Companion and Kira also expose student/class learning insights.

For Foundry, a teacher dashboard that only lists raw Attempts is not enough for a polished demo. But implementing WebSockets, district analytics or predictive grades would be premature.

The MVP should show three useful teacher facts:

```text
student
current task / current activity
needs-attention reason
```

and allow one bounded intervention:

```text
continue
require capability
exclude capability
```

### 3.3 Per-turn dynamic routing can become a UX bug

A naive implementation would call the router on every learner message or every Attempt and allow it to replace the active activity immediately.

That sounds adaptive but can produce:

- activity thrashing;
- no stable mental model for the learner;
- lost unfinished work;
- hard-to-explain teacher traces;
- LLM instability becoming visible product instability.

Foundry should use **sticky activities and event-driven routing**.

### 3.4 Generation should remain the last supply option

Synthesis is a useful counterexample to the assumption that an LLM should generate every learning interaction. Its public product description emphasizes expert-designed pedagogy and interactive experiences, with AI used where appropriate.

Foundry's supply priority should remain:

```text
existing verified capability
→ parameterize
→ adapt / compose when justified
→ generate only on a genuine gap
```

For the MVP, generation should not block the core learner loop.

---

## 4. Revised product architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                       Learner Workspace                      │
│                                                              │
│  Task Header                                                  │
│  ┌──────────────────────┬──────────────────────────────────┐ │
│  │ Guidance Thread      │ Primary Learning Surface         │ │
│  │                      │                                  │ │
│  │ learner ↔ Foundry    │ Asset Stage OR guidance focus    │ │
│  └──────────────────────┴──────────────────────────────────┘ │
│  Attempt / saved state / teacher state / next step            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                       Foundry Product API                     │
│                                                              │
│  TaskService                                                  │
│  ConversationService                                          │
│  LearnerTurnService                                           │
│    ├── ContextViewBuilder                                     │
│    ├── DifyOrchestrator                                       │
│    └── ActionGate                                             │
│                                                              │
│  RuntimeService                                               │
│    ├── CapabilityRegistry                                     │
│    ├── AssetResolver                                          │
│    └── RuntimeSession                                         │
│                                                              │
│  TeacherDecisionService                                      │
│  ProductStateRepository                                      │
└───────────────┬──────────────────────┬───────────────────────┘
                │                      │
                ▼                      ▼
        Dify Workflow             Asset Stage
        (proposal only)                │
                                      iframe
                                        │
                                        ▼
                                  ComponentAsset
```

The essential rule is:

```text
LLM proposes.
Foundry validates and commits.
Component executes.
Product State records.
```

No single layer is allowed to perform all four responsibilities.

---

## 5. Learner Workspace: do not permanently split the screen 50/50

The earlier `Chat left / Asset right` layout is a useful architecture diagram but is not necessarily the best user experience.

A permanent equal split makes the learner decide where attention belongs. The system should instead expose one **primary learning surface** at a time while keeping guidance reachable.

### Guidance mode

```text
┌─────────────────────────────────────────────┐
│ Task                                        │
├─────────────────────────────────────────────┤
│                                             │
│             Guidance Thread                 │
│                                             │
│ learner ↔ Foundry                           │
│                                             │
├─────────────────────────────────────────────┤
│ [message]                                   │
└─────────────────────────────────────────────┘
```

### Activity mode

```text
┌─────────────────────────────────────────────┐
│ Task · Why this activity?                   │
├─────────────────────────────────────────────┤
│                                             │
│              Asset Stage                    │
│                                             │
│          ComponentAsset iframe              │
│                                             │
├─────────────────────────────────────────────┤
│ Need help? [Ask Foundry]                    │
└─────────────────────────────────────────────┘
```

Opening `Ask Foundry` reveals the guidance thread as a drawer/panel without destroying the Component.

### Review / transition mode

```text
Activity saved
What Foundry observed
Teacher review state if applicable
Next step
```

This is preferable to treating chat and activity as permanently equal applications.

---

## 6. Canonical Product State for the MVP

Do not reintroduce the old industrial schema.

The MVP needs only:

```ts
type ProductState = {
  students: Student[]
  tasks: Task[]
  conversationEvents: ConversationEvent[]
  orchestrationDecisions: OrchestrationDecision[]
  runtimeSessions: RuntimeSession[]
  learningEvents: LearningEvent[]
  attempts: Attempt[]
  observationProposals: ObservationProposal[]
  teacherDecisions: TeacherDecision[]
}
```

### Do not add yet

```text
Institution hierarchy
Course tenancy framework
Episode graph
Retry / Transfer / Retention entities
LearningOutcome
optimization proposals
workflow checkpoints
large audit tables
```

Those are future product concerns, not prerequisites for demonstrating the loop.

---

## 7. Conversation ownership

Foundry owns canonical conversation history.

```ts
type ConversationEvent = {
  id: string
  taskId: string
  studentId: string
  role: "LEARNER" | "ASSISTANT" | "SYSTEM"
  content: string
  createdAt: string
  turnId?: string
}
```

Dify should not be the source of truth for learner conversation state.

### Why use a Dify Workflow rather than a stateful Chatflow first

A stateful Chatflow can maintain its own conversation ID and conversation variables. That is useful for products where Dify owns the conversation.

Foundry already needs canonical Task-scoped conversation because:

- teachers inspect it;
- runtime events affect it;
- teacher interventions affect later turns;
- replacing Dify should not delete learning history.

Using both Foundry history and Dify conversation state creates two competing memories.

For the MVP, prefer:

```text
Foundry canonical history
→ bounded LearnerTurnInput
→ stateless-per-call Dify Workflow
```

Dify may still stream its workflow response; streaming does not require giving it canonical conversation ownership.

---

## 8. ContextViewBuilder: do not send the database to Dify

Every learner turn should build a small **TurnContextView**.

```ts
type TurnContextView = {
  trigger: TurnTrigger

  task: {
    id: string
    goal: string
    teacherInstruction?: string
  }

  learner: {
    id: string
    supportHint?: string
  }

  conversation: {
    recentMessages: Array<{
      role: "LEARNER" | "ASSISTANT"
      content: string
    }>
    rollingSummary?: string
  }

  activity?: {
    capabilityId: string
    runtimeStatus: string
    stateSummary?: unknown
  }

  latestAttempt?: {
    capabilityId: string
    responseSummary: unknown
    correct?: boolean | null
    assistanceUsed?: unknown[]
  }

  teacherPolicy: {
    requiredCapabilityId?: string | null
    excludedCapabilityIds: string[]
  }

  candidateCapabilities: CapabilityCandidate[]

  evidence?: {
    snippets: unknown[]
    sourceRefs: string[]
  }
}
```

`rollingSummary` is optional for the first demo. With short conversations, recent messages are enough.

---

## 9. Hard filtering belongs in Foundry, ranking can belong in Dify

Do not ask the model to reason over capabilities that are already invalid.

Before Dify receives candidates, Foundry performs deterministic hard filters:

```text
availability
teacher exclusion
teacher requirement
active-session lock
basic runtime compatibility
```

Dify receives only eligible candidates and decides which behaviour best fits the current learning need.

This reduces hallucinated capability IDs and makes teacher policy authoritative.

---

## 10. Revised learner-turn contract

The previous contract mixed a user-facing response and an immediately executable command too tightly.

Use a **proposal** contract:

```ts
type LearnerTurnProposal = {
  guidance: {
    text: string
    evidenceRefs?: string[]
  }

  actionProposal:
    | { kind: "NONE" }
    | {
        kind: "LAUNCH_CAPABILITY"
        capabilityId: string
        parameters: Record<string, unknown>
        reason: string
      }
    | {
        kind: "WAIT_FOR_TEACHER"
        reason: string
      }
    | {
        kind: "NO_MATCH"
        reason: string
      }
}
```

Important change:

> Dify selects a `capabilityId`, not an exact ComponentAsset version.

Foundry owns deployment/runtime knowledge and resolves the approved exact asset version after the proposal passes the ActionGate.

---

## 11. ActionGate: the missing architecture layer

The MVP does not need the old deterministic Activity Planner, but it does need a small deterministic gate between AI proposal and product action.

```text
Dify proposal
      │
      ▼
ActionGate
      │
      ├── is routing allowed for this trigger?
      ├── is there an unfinished active Component?
      ├── is capability still available?
      ├── is it allowed by teacher policy?
      ├── are parameters valid enough for this asset?
      │
      ├── accepted → commit action
      └── rejected → keep current state / explicit failure
```

This is not a planner. It is a product integrity boundary.

### Committed action

```ts
type CommittedAction =
  | { kind: "GUIDANCE_ONLY" }
  | {
      kind: "LAUNCH_ASSET"
      capabilityId: string
      assetId: string
      assetVersion: string
      launchUrl: string
      parameters: Record<string, unknown>
    }
  | { kind: "WAIT_FOR_TEACHER" }
  | { kind: "NO_MATCH" }
```

The user-facing UI should distinguish AI guidance from a Foundry-committed action. The assistant does not need to claim that an asset has launched before the gate succeeds.

---

## 12. Routing triggers and stickiness

This is the most important correction to the earlier learner-flow document.

Do **not** automatically re-route after every `ATTEMPT_SUBMITTED`.

A Component may contain several attempts. Routing after each answer would make the activity unstable.

### Canonical triggers

```ts
type TurnTrigger =
  | "TASK_OPENED"
  | "LEARNER_MESSAGE"
  | "COMPONENT_COMPLETED"
  | "RUNTIME_ERROR"
  | "TEACHER_INTERVENTION"
  | "LEARNER_REQUESTED_SWITCH"
```

### Routing policy

| Trigger | Guidance | New capability allowed? |
| --- | --- | --- |
| `TASK_OPENED` | yes | yes |
| `LEARNER_MESSAGE`, no active activity | yes | yes |
| `LEARNER_MESSAGE`, active activity | yes | normally no |
| `COMPONENT_COMPLETED` | yes | yes |
| `RUNTIME_ERROR` | yes | yes |
| `TEACHER_INTERVENTION` | optional | yes |
| `LEARNER_REQUESTED_SWITCH` | yes | yes, after explicit abandon/reset |

### Attempt semantics

```text
ATTEMPT_SUBMITTED
→ persist Attempt
→ update visible work/evidence
→ DO NOT automatically replace the active activity
```

Then:

```text
COMPONENT_COMPLETED
→ build TurnContextView including Attempts
→ run orchestration
→ choose next step
```

This gives the learner a stable activity boundary.

---

## 13. Capability and ComponentAsset: keep the distinction conceptually, collapse persistence for now

Long term:

```text
Capability
= callable learning behaviour

ComponentAsset
= an implementation of that behaviour
```

But the MVP currently has only one asset implementation per capability. Creating separate tables, version graphs and resolver services would be premature.

Use one Registry entry:

```ts
type CapabilityEntry = {
  id: string
  title: string
  purpose: string
  tags: string[]
  availability: "AVAILABLE" | "DISABLED"

  parametersSchema?: unknown

  asset: {
    id: string
    version: string
    type: "web"
    launchUrl: string
    protocolVersion: "0.1"
    contentHash?: string
  }
}
```

Dify only sees:

```text
id
title
purpose
tags
supported parameter hints
```

It does not need `launchUrl`, content hash or deployment metadata.

Split Capability and ComponentAsset into separate persistence entities only when one of these becomes true:

- multiple assets implement the same capability;
- asset version lifecycle becomes independent of capability meaning;
- external providers need adapters;
- generated/adapted versions become a real supply workflow.

---

## 14. Runtime Protocol v0.1: keep it smaller than the old design

For the current demo, the useful protocol is:

### Foundry → Component

```text
FOUNDRY_INIT
FOUNDRY_RESET          optional
```

### Component → Foundry

```text
COMPONENT_READY
LEARNING_EVENT
STATE_CHANGED
ATTEMPT_SUBMITTED
COMPONENT_COMPLETED
COMPONENT_ERROR
```

Pause/resume can remain documented future capabilities but should not block the MVP unless a real Component needs them.

### Important semantic boundary

```text
ATTEMPT_SUBMITTED ≠ diagnosis
COMPONENT_COMPLETED ≠ mastery
runtime error ≠ learner failure
```

The runtime service records facts. Interpretation happens later.

---

## 15. Remove automatic generic diagnosis creation from the runtime handler

The current skeleton creates a generic diagnosis proposal immediately after every Attempt.

That is too eager and is not meaningfully diagnostic.

Better flow:

```text
Component
→ Attempt
→ persist factual Attempt
→ activity continues or completes
→ learner-turn / teacher-insight process may derive an ObservationProposal
```

Use:

```ts
type ObservationProposal = {
  id: string
  taskId: string
  studentId: string
  sourceAttemptIds: string[]
  summary: string
  status: "PROPOSED" | "REVIEWED"
  createdAt: string
}
```

Only create one when the system has something useful to say.

Calling every runtime result a diagnosis makes the product look more intelligent than the evidence supports.

---

## 16. Dify workflow architecture

Use **one learner-turn Workflow** for the MVP.

```text
START
  │
  ▼
Input: TurnContextView
  │
  ▼
Need / intent classification
  │
  ├── guidance needed
  │
  ├── activity selection allowed
  │
  ├── teacher review required
  │
  └── evidence retrieval required
  │
  ▼
Optional retrieval
  │
  ▼
LLM reasoning over candidate capabilities
  │
  ▼
Generate guidance + action proposal
  │
  ▼
Structured output
  │
  ▼
LearnerTurnProposal
```

### Inputs

Prefer named variables over one giant opaque payload where convenient:

```text
trigger
user_message
context_json
candidate_capabilities_json
latest_attempt_json
active_runtime_json
```

### Outputs

```text
guidance_text
action_kind
capability_id
parameters_json
action_reason
evidence_refs_json
```

The Foundry adapter converts these into `LearnerTurnProposal`.

### Workflow vs Chatflow

For this MVP, prefer Workflow because Foundry owns canonical conversation state.

A stateful Chatflow would create a second conversation memory unless carefully mirrored. That complexity buys little at this stage.

### Streaming

The UI can later proxy Dify streaming through Foundry so guidance appears incrementally. The structured action should be committed only after the workflow finishes and ActionGate validates it.

Do not block the first integrated chat demo on streaming.

---

## 17. Teacher Workspace after competitor review

Do not copy Mission Control or Flint analytics wholesale.

The demo only needs a useful teacher priority view:

```text
┌─────────────────────────────────────────────────────┐
│ Student   Current activity       State               │
├─────────────────────────────────────────────────────┤
│ Alice     Ratio Explorer         Active              │
│ Bob       Calculation Trainer    Needs attention     │
│ Charlie   Guidance               Waiting             │
└─────────────────────────────────────────────────────┘
```

Selecting a learner shows:

```text
Task goal
recent conversation
current / previous capability
latest Attempts
ObservationProposal if one exists
why the last action was selected
teacher policy
```

Teacher actions:

```text
Continue
Require capability
Exclude capability
Clear constraints
```

A raw orchestration JSON inspector can remain behind a `Debug` disclosure. It should not be the normal teacher experience.

---

## 18. Knowledge and Evidence boundary

Do not merge uploaded learning materials into the Component system.

```text
Knowledge / Evidence
= what the system may rely on

Capability
= what learning behaviour the system may invoke
```

For the first Dify integration, a manually configured Dify Knowledge Base is acceptable.

Foundry should pass a bounded task/source scope to the workflow, not hard-code a Chemistry taxonomy into the Registry.

Later, add a `KnowledgeAdapter` or source connector when upload/connect becomes part of the demo.

---

## 19. What is actually distinctive enough to demo

The demo should not pitch:

```text
AI tutor
personalized chat
teacher dashboard
interactive tools
```

Competitors already do these well.

The demo should visibly prove this sequence:

```text
ONE teacher goal
      ↓
Alice, Bob, Charlie share the goal
      ↓
different persisted learner state
      ↓
Foundry gives different guidance / capability choices
      ↓
real ComponentAssets run behind the same protocol
      ↓
Attempts return to Product State
      ↓
activity stays stable until a meaningful routing boundary
      ↓
teacher policy changes the next decision
```

A stronger second slice is:

```text
NO_MATCH
→ capability gap
→ adapt/generate candidate
→ preview
→ teacher confirms
→ Registry
→ learner actually uses it
```

That second slice is more differentiated, but it should follow rather than precede the learner loop.

---

## 20. Architecture cuts: what not to build

Before the learner loop feels good, do not add:

- WebSockets just to imitate real-time dashboards;
- Postgres/Supabase solely for architectural credibility;
- multi-tenant RLS matrices;
- a generic plugin marketplace;
- multiple Dify workflows chained through n8n;
- a long-lived Dify conversation as a second Product State;
- a full planner between AI proposal and runtime;
- automatic diagnosis after every Attempt;
- routing after every Component interaction;
- Capability Workshop before existing capabilities work well;
- school analytics, grading or predictive scores;
- Retry/Transfer/Retention entities;
- optimization pipelines.

The MVP should remain understandable in one architecture diagram and runnable by one person.

---

## 21. Revised implementation sequence

### P0 — make the learner experience real

1. add `conversationEvents` and `orchestrationDecisions` to Product State;
2. add `POST /api/chat`;
3. add `ContextViewBuilder`;
4. change mock orchestrator to the `LearnerTurnProposal` contract;
5. add `ActionGate`;
6. make the learner UI guidance-first / activity-focus rather than debug-plan-first;
7. keep the current iframe components;
8. stop creating generic diagnosis in `/api/runtime-messages`;
9. trigger rerouting on `COMPONENT_COMPLETED`, not every Attempt;
10. show the teacher a compact needs-attention view.

### P1 — connect real AI orchestration

1. implement the Dify learner-turn Workflow;
2. send candidate capabilities after hard filtering;
3. validate structured outputs;
4. add optional Evidence Retrieval;
5. add streaming guidance only after the blocking path works.

### P2 — prove supply

1. explicit `NO_MATCH`;
2. one adaptation/generation candidate;
3. preview in the same Asset Stage runtime;
4. teacher confirmation;
5. Registry registration;
6. real learner delivery.

Everything else waits.

---

## 22. Demo acceptance criteria

The first learner-experience demo is good enough when:

- the teacher assigns one goal to three learners;
- each learner opens the same product, not a debug launcher;
- learner messages are persisted by Foundry;
- guidance can be returned without launching an activity;
- the system can launch at least two different capabilities through one runtime contract;
- asking for help during an active activity does not replace the activity;
- multiple Attempts can occur without automatic rerouting;
- completion can trigger a next-step decision;
- teacher require/exclude policy changes the next valid decision;
- the teacher sees recent conversation, current activity and Attempt evidence;
- a runtime failure is not displayed as learner failure;
- the entire product still runs without n8n or the old orchestration stack.

At that point Foundry demonstrates a coherent product architecture rather than a collection of AI features.
