# Learner Experience and End-to-End Flow

Status: MVP design target  
Scope: `learning-foundry-mvp`  
Primary source of truth: `learning-foundry-docs/docs/00-current-mvp-contract.md`, `02-product-surfaces-and-user-journeys.md`, and `03-system-architecture.md`

## 1. Why this document exists

The current MVP proves the runtime spine:

```text
Teacher assigns a Task
→ Foundry resolves a Capability
→ Asset Stage launches a ComponentAsset
→ learner submits an Attempt
→ Foundry persists the Attempt
→ teacher can inspect and intervene
```

That is useful, but it is not yet the intended learner product experience.

The documented Learner Workspace is broader:

```text
Current Task
+ Chat / Guidance
+ Active Asset Stage
+ Attempts / Progress / Next step
```

The missing piece is the relationship between **conversation** and **executable learning activities**.

This document defines that relationship for the MVP.

---

## 2. Product principle

The learner should experience one continuous learning workspace, not a chatbot next to an unrelated tool launcher.

The three concepts have different responsibilities:

```text
Chat / Guidance
= conversational entry, explanation, clarification, reflection and help

ComponentAsset
= executable learning experience such as a trainer, simulation, quiz or interactive app

Asset Stage
= the controlled runtime surface where the selected ComponentAsset runs
```

The orchestration layer decides when the learner should remain in conversation and when an executable activity is more appropriate.

Therefore:

> Chat is a product surface inside Foundry. Dify is not the learner-facing chat product.

Foundry owns the chat UI, Task, conversation history, Attempt history, teacher constraints and runtime state. Dify is a replaceable reasoning/orchestration implementation behind the Foundry API.

---

## 3. Target Learner Workspace

Desktop MVP:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Task: Understand proportional reasoning                Status: Active │
│ Goal · teacher instruction · current next step                         │
├──────────────────────────────┬───────────────────────────────────────┤
│ Chat / Guidance              │ Asset Stage                           │
│                              │                                       │
│ Foundry: What feels unclear? │ [Ratio Explorer iframe]               │
│                              │                                       │
│ Learner: I know 2:3 but      │                                       │
│ I don't know what it means.  │                                       │
│                              │                                       │
│ Foundry: Let's make that     │                                       │
│ visible. Try the activity →  │                                       │
│                              │                                       │
│ [message box]                │                                       │
├──────────────────────────────┴───────────────────────────────────────┤
│ Latest Attempt · teacher review state · progress · suggested next     │
└──────────────────────────────────────────────────────────────────────┘
```

The Asset Stage does not replace Chat. Chat remains available while an activity is active.

On a narrow/mobile viewport, the same product can become two tabs:

```text
[ Guidance ] [ Activity ]
```

The underlying Task and Product State remain the same.

---

## 4. What the learner should actually do

### 4.1 Assigned Task entry

A teacher has already assigned a Task.

The learner opens Foundry and sees:

1. the learning goal;
2. a short teacher instruction if one exists;
3. the current system guidance;
4. either an already-selected first activity or a short conversational opening.

The learner should **not** have to click a technical button labelled `Plan next activity` in the intended experience.

That button is useful as a temporary debugging control, but normal orchestration should be triggered automatically by:

```text
Task opened
or
learner sends a message
or
learner submits an Attempt
or
teacher changes a constraint
```

### 4.2 Conversational entry

Later, Foundry should also support an unassigned start:

```text
Learner: I keep getting these ratio questions wrong.
        ↓
Foundry creates or clarifies a Task
        ↓
Task-scoped conversation begins
        ↓
Foundry decides whether more clarification is needed
or launches a suitable capability
```

This is part of the documented product, but it does not need to block the first assigned-Task MVP.

### 4.3 Guidance-only turn

Not every learner message should produce a ComponentAsset.

Example:

```text
Learner:
Why does 2:3 mean I multiply by 3/2 here?

Foundry:
Because the ratio tells you how many units of the target correspond to the amount you already know. Before I give you another exercise, which side of the ratio is the quantity you already have?
```

The orchestration decision is:

```text
CHAT_ONLY
```

No Component is launched.

### 4.4 Activity turn

Example:

```text
Learner:
I understand the explanation but I still can't picture it.

Foundry:
Let's make the relationship visible. Try this short ratio explorer; I'll stay here if you want help.
```

The orchestration decision is:

```text
LAUNCH_CAPABILITY
```

Asset Stage launches the selected exact ComponentAsset version.

### 4.5 Asking for help while a Component is active

The learner should still be able to type:

```text
I don't understand what I'm supposed to drag.
```

Foundry receives the message together with bounded runtime context:

```text
active capability
active runtime session
current state snapshot if available
recent learning events
latest Attempt if one exists
```

Dify can then return guidance without directly controlling the Component.

For the first MVP, keep this conservative:

```text
CHAT_ONLY guidance while activity is active
```

Do not silently replace an active Component in the middle of an unfinished Attempt.

A later version can support an explicit transition such as:

```text
"This activity isn't helping" → abandon/reset → re-resolve
```

### 4.6 Attempt submission

Component runtime sends:

```text
ATTEMPT_SUBMITTED
```

Foundry persists the Attempt first.

The Attempt is a learning fact, not a diagnosis.

Then Foundry may trigger a new learner-turn orchestration using:

```text
Task
+ Context
+ recent conversation
+ exact Capability/Component version
+ latest Attempt
+ teacher constraints
```

Possible result:

```text
Foundry:
You used the right ratio direction, but the last calculation changed both sides. Let's isolate that step.

→ launch Calculation Trainer
```

or:

```text
Foundry:
Nice — the representation and calculation now agree. Explain in one sentence why you used 3/2 rather than 2/3.

→ CHAT_ONLY
```

### 4.7 Teacher-review state

If the system decides a case requires teacher review, the learner should see an honest state:

```text
I've saved your work. Your teacher needs to review this before I change the next activity.
```

The learner should not see a fabricated diagnosis or a generic loading spinner.

The workspace becomes:

```text
WAITING_FOR_TEACHER
```

Chat can remain available for bounded guidance, but consequential re-routing waits for the teacher decision.

---

## 5. The chat architecture

### 5.1 Do not embed Dify's chat UI as the product

The learner should interact with:

```text
Foundry Chat UI
        ↓
Foundry Backend
        ↓
Dify Workflow
```

not:

```text
Foundry page
+ separate Dify chatbot
```

Why:

- Task history belongs to Foundry;
- teacher intervention must affect the next learner turn;
- Component events must affect conversation;
- conversation must affect Capability Resolution;
- switching Dify out later should not destroy learner history;
- the learner should experience one product.

### 5.2 Foundry owns canonical conversation state

Add a small canonical record:

```js
ConversationEvent = {
  id,
  taskId,
  studentId,
  role: "LEARNER" | "ASSISTANT" | "SYSTEM",
  content,
  createdAt,
  orchestrationDecisionId?
}
```

For the MVP this can be one `conversationEvents` array in the JSON Product State adapter.

Do not rely on a Dify `conversation_id` as the authoritative learning history.

Dify may keep provider-side state for convenience later, but Foundry must be able to reconstruct the Task-scoped learner turn from its own Product State.

---

## 6. One learner-turn API

The MVP should add:

```http
POST /api/chat
```

Request:

```json
{
  "studentId": "alice",
  "taskId": "task_123",
  "message": "I still don't understand why the ratio flips."
}
```

Backend sequence:

```text
1. validate student + Task
2. persist learner ConversationEvent
3. construct LearnerTurnInput
4. call orchestrator
5. validate structured result
6. persist assistant ConversationEvent
7. persist orchestration decision
8. if decision launches a capability:
     create RuntimeSession
     return launch metadata
9. return the updated learner workspace state
```

This endpoint becomes the main student orchestration boundary.

`POST /api/orchestrate` can remain temporarily as a debug endpoint, but the normal learner UI should stop calling it directly.

---

## 7. LearnerTurnInput

A Dify workflow should not receive the whole database.

A bounded input is enough:

```ts
type LearnerTurnInput = {
  task: {
    id: string
    goal: string
    teacherInstruction?: string
  }

  learner: {
    id: string
    demoNeed?: string
  }

  conversation: Array<{
    role: "LEARNER" | "ASSISTANT"
    content: string
  }>

  latestAttempt?: {
    capabilityId: string
    capabilityVersion: string
    response: unknown
    correct: boolean | null
    assistanceUsed: unknown[]
  }

  activeRuntime?: {
    capabilityId: string
    capabilityVersion: string
    status: string
    stateSnapshot?: unknown
    recentEvents?: unknown[]
  }

  teacherConstraints: {
    requireCapabilityId?: string | null
    excludeCapabilityIds: string[]
  }

  availableCapabilities: Array<{
    id: string
    version: string
    title: string
    purpose: string
    tags: string[]
  }>
}
```

Later, Evidence citations and richer Context can be added without changing the product surface.

---

## 8. LearnerTurnOutput

The Dify workflow should return one structured learner-turn decision.

Recommended MVP contract:

```ts
type LearnerTurnOutput = {
  assistantMessage: string

  decision:
    | {
        kind: "CHAT_ONLY"
      }
    | {
        kind: "LAUNCH_CAPABILITY"
        capabilityId: string
        capabilityVersion: string
        parameters: Record<string, unknown>
        rationale: string
      }
    | {
        kind: "WAIT_FOR_TEACHER"
        reason: string
      }
    | {
        kind: "NO_MATCH"
        reason: string
      }

  evidenceRefs?: string[]
}
```

This is intentionally smaller than the old industrial `Resolution → Planner → Runtime` stack.

Internally, Foundry can still derive/persist a `CapabilityResolution` and `ActivityPlan` when `kind = LAUNCH_CAPABILITY`.

The important product boundary is that the learner receives **one coherent turn**:

```text
assistant guidance + optional next activity
```

rather than two visibly unrelated systems.

---

## 9. Recommended Dify workflow

For the MVP, use one learner-turn workflow rather than several chained Dify workflows.

```text
START
  │
  ▼
Parse bounded Foundry state
  │
  ▼
LLM: determine current learning need
  │
  ├── needs clarification/explanation ─────────────┐
  │                                                │
  ├── suitable existing capability found          │
  │          │                                     │
  │          ▼                                     │
  │   choose exact capability                     │
  │                                                │
  ├── teacher review required                     │
  │                                                │
  └── no suitable capability                      │
                                                   │
                         ▼                         ▼
                  Structured Output ───────────────┘
                         │
                         ▼
                   LearnerTurnOutput
```

Dify should reason over the Registry view supplied by Foundry.

Dify does **not**:

- own the Task;
- persist canonical chat history;
- create RuntimeSession rows directly;
- render the Component;
- receive unrestricted database access;
- write TeacherDecision;
- write authoritative Diagnosis or LearningOutcome.

---

## 10. End-to-end assigned Task flow

```text
Teacher Workspace
      │
      │ assign goal to Alice, Bob, Charlie
      ▼
Foundry Product State
      │
      ├── Task(Alice)
      ├── Task(Bob)
      └── Task(Charlie)

Alice opens Learner Workspace
      │
      ▼
Foundry creates opening learner turn
      │
      ▼
Dify learner-turn workflow
      │
      ├── assistantMessage
      └── LAUNCH_CAPABILITY: ratio-explorer@1.0.0
      │
      ▼
Foundry validates Registry exact version
      │
      ▼
create RuntimeSession
      │
      ▼
Asset Stage iframe
      │
      ▼
COMPONENT_READY
      │
      ▼
FOUNDRY_INIT
      │
      ▼
learner interacts
      │
      ├── LEARNING_EVENT
      ├── STATE_CHANGED
      └── ATTEMPT_SUBMITTED
      │
      ▼
Foundry persists Attempt
      │
      ▼
new learner turn
      │
      ▼
Dify sees latest Attempt
      │
      ├── CHAT_ONLY
      ├── next Component
      └── WAIT_FOR_TEACHER
```

The same loop applies to Bob and Charlie independently.

This is where the product becomes genuinely personalized: the teacher can assign one goal while each learner receives a different sequence of guidance and capabilities.

---

## 11. Product State additions for the current repo

Current JSON state should minimally become:

```js
{
  teacher,
  students,
  tasks,

  conversationEvents,
  orchestrationDecisions,

  runtimeSessions,
  learningEvents,
  attempts,
  diagnosisProposals,
  teacherDecisions
}
```

No new database is required yet.

### OrchestrationDecision

For debugging and teacher transparency:

```js
{
  id,
  taskId,
  studentId,
  trigger: "TASK_OPENED" | "CHAT_MESSAGE" | "ATTEMPT_SUBMITTED" | "TEACHER_INTERVENTION",
  decision,
  rationale,
  createdAt
}
```

This gives us the visible `why this activity?` explanation without rebuilding the old giant trace infrastructure.

---

## 12. Learner UI states

Do not build a large explicit state machine yet. Derive the visible state from Product State.

The learner needs only these meaningful states:

### No Task

```text
No active learning goal.
```

Later this can offer conversational Task creation.

### Guidance

Chat is active; no Component currently needs learner action.

### Activity Ready / Active

Asset Stage contains the selected Component.

### Attempt Recorded

The learner sees that work was saved while Foundry decides the next step.

### Waiting for Teacher

A consequential next step is intentionally paused.

### No Match

Foundry says explicitly that it does not currently have a suitable activity.

This state later becomes the Capability Workshop supply trigger.

### Runtime Failure

Component failure is shown as a runtime failure, not as a learning failure.

---

## 13. Conversation and Component interaction rules

To keep the MVP coherent:

1. Chat is always Task-scoped.
2. Only one active RuntimeSession per Task in the first MVP.
3. A normal chat turn does not destroy or replace an unfinished runtime session.
4. Component state is opaque to Chat except for bounded state/event summaries supplied by Foundry.
5. Component output cannot become a diagnosis by itself.
6. Assistant text cannot directly mark an Attempt as correct, mastered or complete unless that fact exists in Product State.
7. Teacher `REQUIRE_CAPABILITY` / `EXCLUDE_CAPABILITY` constraints are included in every subsequent learner turn.
8. Component completion and Task completion are separate.
9. Conversation history remains available after Component completion.
10. Learners should never browse the Capability Registry as the primary experience.

---

## 14. Example complete interaction

Teacher assigns:

```text
Goal: Understand how proportional ratios map one known quantity to another.
```

Alice opens the Task.

```text
Foundry:
Before we calculate anything, what does a ratio like 2:3 mean to you?

Alice:
Two divided by three?

Foundry:
That's one numerical representation, but I want to check whether the relationship itself is clear. Try this short visual activity.
```

Decision:

```json
{
  "kind": "LAUNCH_CAPABILITY",
  "capabilityId": "ratio-explorer",
  "capabilityVersion": "1.0.0",
  "parameters": {},
  "rationale": "The learner describes the ratio as only a division result; a visual proportional representation is appropriate before calculation practice."
}
```

Alice completes the Component and submits the wrong ratio direction.

Foundry records the Attempt, then runs another learner turn.

```text
Foundry:
You kept the two quantities paired correctly, but reversed which quantity was being predicted. Which quantity are we starting from?

Alice:
The 2 side.

Foundry:
Right. Now let's use that relationship in one calculation.
```

Decision:

```text
LAUNCH_CAPABILITY → calculation-trainer@1.0.0
```

The learner experiences one conversation with activities appearing inside it, not a sequence of disconnected products.

---

## 15. Teacher visibility

Teacher Workspace should eventually display the learner's flow as a simple timeline:

```text
09:01 Task opened
09:02 Learner: "Two divided by three?"
09:02 Foundry → Ratio Explorer
09:05 Attempt submitted
09:05 Foundry → clarification
09:06 Learner answer
09:06 Foundry → Calculation Trainer
```

Teacher does not need raw prompts, model chain-of-thought or giant orchestration traces.

Useful teacher-facing information is:

- learner message;
- assistant guidance;
- selected capability and exact version;
- selection rationale;
- Attempt;
- diagnosis proposal if one exists;
- teacher intervention.

---

## 16. Evidence Retrieval later

Chat may need source-backed explanations.

Keep this semantically separate from Capability Resolution:

```text
Learner asks a factual/conceptual question
        ↓
Dify determines Evidence is required
        ↓
Evidence Retrieval
        ↓
assistant response with citation-ready evidence
```

versus:

```text
Learner needs practice / simulation / interaction
        ↓
Capability Resolution
        ↓
Asset Stage
```

The same learner turn may eventually use both, but they remain different operations.

Evidence Retrieval does not need to block the first chat MVP.

---

## 17. What to implement next in `learning-foundry-mvp`

### P0 — make the learner experience real

1. Add `conversationEvents` and `orchestrationDecisions` to seed/Product State.
2. Add `POST /api/chat`.
3. Replace the learner `Plan next activity` UX with an actual Chat panel.
4. Automatically run an opening learner turn when an assigned Task has no conversation/activity yet.
5. Change the orchestrator contract from only `{resolution, plan}` to `LearnerTurnOutput`.
6. Let `LAUNCH_CAPABILITY` create the existing RuntimeSession and Asset Stage flow.
7. After `ATTEMPT_SUBMITTED`, automatically run the next learner turn or expose an explicit `Continue` action while debugging.
8. Show `WAIT_FOR_TEACHER`, `NO_MATCH` and runtime failure honestly.

### P0.5 — connect real Dify

9. Build one Dify learner-turn workflow using the contract in this document.
10. Keep mock orchestration as a deterministic fallback/demo mode.
11. Do not introduce n8n.

### P1 — improve demo quality

12. Add short selection rationale below Asset Stage.
13. Add teacher timeline containing chat + activity + Attempt events.
14. Replace one toy Component with a real existing learning app that implements Runtime Protocol v0.1.
15. Add bounded active-runtime context to help requests.

### P2 — after the basic experience works

16. Conversational Task creation.
17. Evidence/citation path.
18. `NO_MATCH → Capability Workshop → preview → confirm → Registry → learner`.
19. richer Context and learner strategy.
20. Postgres/Supabase persistence if the demo starts needing real accounts or deployment.

---

## 18. What not to build yet

Do not reintroduce the old architecture merely because Chat now exists.

Still out of scope:

- generic multi-agent framework;
- custom LangGraph control plane;
- separate Chat database owned by Dify;
- school tenancy and complex RLS;
- long-term Retry/Transfer/Retention workflow;
- full analytics product;
- automated asset/routing optimization;
- generic CMS;
- large eval/test infrastructure;
- multiple concurrent Component runtimes in one Task.

The product proof is still one vertical loop:

```text
Teacher goal
→ learner conversation
→ selected learning activity
→ real Attempt
→ conversation adapts
→ teacher can inspect/intervene
```

If that feels coherent and useful, the MVP has proven substantially more than the current runtime-only slice.

---

## 19. Updated MVP architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                     Learner Workspace                        │
│                                                              │
│  Task Header                                                 │
│  ┌──────────────────────┬─────────────────────────────────┐  │
│  │ Chat / Guidance      │ Asset Stage                     │  │
│  │                      │                                 │  │
│  │ learner messages     │ sandboxed iframe                │  │
│  │ assistant guidance   │ ComponentAsset                  │  │
│  │ citations later      │                                 │  │
│  └──────────────────────┴─────────────────────────────────┘  │
│  Attempt / teacher state / Next                              │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
                     Foundry Product API
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
     Product State      Capability Registry   Asset Runtime
           │                   │                   │
           │                   │                   ▼
           │                   │            Runtime Protocol
           │                   │                   │
           │                   │                   ▼
           │                   │             ComponentAsset
           │                   │
           └──────────────┬────┘
                          │ bounded LearnerTurnInput
                          ▼
                    Dify Workflow
                          │
                          ▼
                   LearnerTurnOutput
                          │
             ┌────────────┼─────────────┐
             ▼            ▼             ▼
         CHAT_ONLY   LAUNCH_CAPABILITY  WAIT / NO_MATCH
                          │
                          ▼
                    RuntimeSession
```

The teacher uses the same Product State from another surface:

```text
Teacher Workspace
→ assignment
→ learner timeline
→ Attempt / diagnosis proposal
→ require/exclude/override
→ next learner turn receives updated teacher policy
```

That is the intended MVP product loop.