# Learner Experience and End-to-End Flow

Status: Phase 1 implementation target  
Scope: `learning-foundry-mvp`

## 1. The product journey is the acceptance criterion

Phase 1 is not accepted because `Task → Runtime → Attempt` works internally. It is accepted when a learner can understand and complete the experience without knowing Foundry's architecture.

```text
My learning
→ open assigned Task
→ Guidance
→ optional Activity Offer
→ learner chooses Start
→ Activity
→ Ask Foundry when needed
→ completion / saved work
→ Transition
→ guidance, another offer, or teacher wait
```

The learner never needs to understand `Capability`, `Registry`, `RuntimeSession`, `ActionGate`, `orchestration decision` or `Product State`.

## 2. Learner Home

The student enters through **My learning**, not directly into an iframe or a developer-oriented task inspector.

Each assigned Task shows:

- learning goal;
- teacher guidance when present;
- a human-readable state;
- a Start or Continue action.

The demo may include a separate persona switcher for Alice / Bob / Charlie, but that switcher is demo chrome rather than learner product navigation.

## 3. Guidance Mode

The first Task turn begins conversationally.

Example:

```text
Foundry:
Before we start, what feels hardest about ratio questions right now:
understanding what the relationship means, or doing the calculation?

Learner:
I can calculate them but I don't understand what the ratio means.
```

This gives the system useful context before putting an interactive tool in front of the learner.

Conversation is Task-scoped. Foundry owns canonical conversation history. The Phase 1 UI renders it with `assistant-ui` through an external-store adapter; assistant-ui is not the source of truth.

## 4. Activity Offer is different from Activity Start

A key Phase 1 rule is:

```text
orchestrator suggests capability
≠
iframe starts immediately
```

When Foundry commits a `LAUNCH_CAPABILITY` proposal, it creates a runtime in `READY` state and shows a learner-facing offer:

```text
Try this next

Ratio Explorer
See what happens when both quantities change together.

[ Start activity ]
```

The learner may continue asking questions while the activity remains offered.

Teacher policy may replace a `READY` offer because the learner has not begun it yet. Once an activity is `LOADING` or `RUNNING`, normal chat and teacher preference changes do not silently replace it.

## 5. Activity Mode

After the learner explicitly chooses Start:

```text
READY
→ POST /api/runtime-start
→ LOADING
→ iframe loads
→ COMPONENT_READY
→ FOUNDRY_INIT
→ RUNNING
```

The Component is the primary surface.

Chat remains accessible through **Ask Foundry** in a side Sheet rather than permanently consuming half the viewport. The student can ask about instructions or concepts without losing the active activity.

For Phase 1, asking for help during an activity is guidance-only. Foundry does not silently switch the Component mid-attempt.

## 6. Attempt and completion

A Component can report learning events and an `ATTEMPT_SUBMITTED` before it completes.

Foundry persists the Attempt as a factual record:

```text
what component/version ran
what response was submitted
component-provided correctness if available
assistance used
state snapshot
submission time
```

An Attempt is not automatically a diagnosis or a learning outcome.

On `COMPONENT_COMPLETED`, the RuntimeSession becomes completed and Foundry runs a new learner turn.

## 7. Transition Mode

After completion, the learner first sees that work was saved.

Then the new learner turn may produce:

### Guidance

```text
Your work is saved.
Before we move on, explain in one sentence what stayed proportional.
```

### Another Activity Offer

```text
Your work is saved.
That attempt suggests another representation may help.

Try this next
Calculation Trainer
[ Start activity ]
```

The next Component is still an offer; it does not automatically start.

### Waiting for Teacher

```text
Your work is saved.
Your teacher needs to review this part before the next activity changes.
You can still ask Foundry questions.
```

### No suitable activity

Foundry says so explicitly rather than pretending a Registry match exists.

## 8. Teacher Workspace

Teacher Workspace should answer human questions:

```text
What is this student working on?
What did they say was difficult?
Why is this activity being suggested?
What work have they submitted?
Do I need to intervene?
What can I change about the next step?
```

It should not primarily display raw routing JSON or internal architecture vocabulary.

Phase 1 teacher actions are deliberately small:

- assign one goal to multiple learners;
- see current learner state;
- read learner / Foundry conversation;
- see current or suggested activity and its learner-facing reason;
- see recent Attempts;
- require or exclude a capability for the next safe step;
- clear those preferences.

If the learner has only a `READY` offer, teacher policy can cancel/replan it. A `LOADING` or `RUNNING` activity is not interrupted by a normal policy change.

## 9. Current API flow

### Open Task

```text
Learner Workspace
→ POST /api/chat { trigger: TASK_OPENED }
→ CHAT_ONLY opening guidance
```

### Learner message

```text
assistant-ui Composer
→ external-store runtime onNew
→ POST /api/chat { trigger: CHAT_MESSAGE }
→ Foundry persists learner message
→ learner-turn service
→ eligible capabilities
→ mock orchestrator
→ LearnerTurnProposal
→ ActionGate
→ assistant message + committed state
→ TanStack Query invalidates learner/server state
```

### Activity Offer

```text
LAUNCH_CAPABILITY proposal
→ ActionGate validates candidate
→ RuntimeSession(status=READY)
→ learnerState=ACTIVITY_READY
→ Activity Offer rendered
```

### Start

```text
learner clicks Start
→ POST /api/runtime-start
→ RuntimeSession READY → LOADING
→ learnerState=ACTIVITY_ACTIVE
→ Activity Mode renders RuntimeFrame
```

### Component runtime

```text
iframe
→ COMPONENT_READY
← FOUNDRY_INIT
→ LEARNING_EVENT / STATE_CHANGED
→ ATTEMPT_SUBMITTED
→ COMPONENT_COMPLETED
→ next learner turn
```

## 10. Current open-source boundaries

```text
assistant-ui
= chat primitives + external-store runtime

TanStack Query
= React server-state lifecycle

shadcn/ui-derived local primitives + Radix UI
= general interaction primitives (Button/Card/Badge/Sheet)

Tailwind CSS
= styling

Foundry code
= Task/conversation Product State, learner-turn orchestration,
  ActionGate, Registry, runtime protocol, Attempt capture and teacher policy
```

Open-source foundations should remove generic implementation work; they must not become the authority for Foundry learning state.

## 11. Phase 1 acceptance walkthrough

A first-time user should be able to complete all of this from visible UI alone:

```text
1. find an assigned Task in My learning
2. understand the goal
3. begin by talking with Foundry
4. understand why an activity is suggested
5. choose to start it
6. complete the activity without chat competing for the whole page
7. open Ask Foundry if help is needed
8. submit work
9. understand that it was saved
10. understand the next conversational/activity/teacher state
```

If this journey is confusing, Phase 1 is not complete even if every automated test passes.

## 12. Explicit non-scope

Phase 1 does not require:

- Dify;
- Postgres / Supabase;
- school tenancy / RLS;
- n8n;
- LangGraph;
- Capability Workshop;
- automatic diagnosis;
- Retry / Transfer / Retention;
- analytics platform;
- production hardening.

The next implementation decision should follow from manually using this learner journey, not from adding more infrastructure.
