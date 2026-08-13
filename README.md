# Learning Foundry MVP

A deliberately thin, runnable vertical slice of Learning Foundry.

The MVP proves one loop:

```text
Teacher assigns a goal
→ each student gets a Task
→ Foundry sends current Product State + available Capabilities to an orchestrator
→ orchestrator returns a Capability Resolution + Activity Plan
→ Asset Stage launches an exact ComponentAsset version in a sandboxed iframe
→ Component reports learning events and an Attempt through Runtime Protocol v0.1
→ Foundry persists the Attempt and a bounded diagnosis proposal
→ teacher can inspect evidence and intervene
```

## Scope

Current scope is intentionally small:

- one teacher (teacher and expert are the same actor)
- three seeded students
- local JSON Product State behind a repository boundary
- Capability Registry with two Web ComponentAssets
- sandboxed iframe Asset Stage
- Foundry Component Runtime Protocol v0.1
- mock orchestrator by default
- optional Dify Workflow adapter
- no n8n
- no school/multi-tenant model
- no LangGraph
- no custom LLM control plane
- no Retry / Transfer / Retention implementation
- no heavy migration or RLS machinery

The JSON store is a demo persistence adapter, not a long-term storage decision. It can later be replaced with Postgres/Supabase without changing the runtime protocol or orchestration contracts.

## Run

Requires Node.js 20+.

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

No dependency installation is required.

To reset the demo state:

```bash
npm run reset
```

Run the small test suite:

```bash
npm test
```

## Pages

- `/` — demo entry
- `/teacher.html` — one-teacher / multi-student workspace
- `/student.html?id=alice` — Alice
- `/student.html?id=bob` — Bob
- `/student.html?id=charlie` — Charlie

## Component integration

Learning Components are not React UI components and are not loaded by Dify.

They live as independent Web apps under `public/component-assets/` for this demo. The Capability Registry stores only their callable identity and runtime metadata:

```js
{
  capabilityId: "ratio-explorer",
  version: "1.0.0",
  runtime: {
    type: "web",
    launchUrl: "/component-assets/ratio-explorer/index.html",
    protocolVersion: "0.1"
  }
}
```

The Asset Stage talks to them through `window.postMessage()` using `src/runtime/protocol.mjs`.

A real deployment should serve untrusted/generated ComponentAssets from a separate origin. This MVP uses sandboxed iframes on one local server to keep setup trivial.

## Dify adapter

The app runs with the local mock orchestrator by default.

To use a Dify Workflow instead:

```bash
ORCHESTRATOR=dify \
DIFY_BASE_URL=https://api.dify.ai \
DIFY_API_KEY=your_server_side_workflow_key \
npm start
```

The Dify Workflow should accept these string inputs:

- `context_json`
- `capabilities_json`
- `latest_attempt_json`

and return either:

```json
{
  "resolution": { "...": "CapabilityResolution" },
  "plan": { "...": "ActivityPlan" }
}
```

as workflow output variables, or a `result` output containing that JSON.

Dify is only the replaceable AI orchestration implementation. Product State, Registry state, teacher decisions, Component execution, Attempts, and runtime events stay in Foundry.

## Repository map

```text
server.mjs
src/
  capabilities/registry.mjs
  orchestration/
    index.mjs
    mock.mjs
    dify.mjs
  product-state/store.mjs
  runtime/protocol.mjs
public/
  teacher.html / teacher.js
  student.html / student.js
  component-assets/
    ratio-explorer/
    calculation-trainer/
data/
  seed.json
scripts/
  reset-state.mjs
test/
```

## What comes next

Do not expand infrastructure yet. The next useful product work is:

1. connect a real Dify learner-orchestration workflow;
2. replace one demo ComponentAsset with a real existing learning app;
3. implement one teacher intervention that changes the next resolution;
4. add one `NO_MATCH → preview → confirm → register → learner uses it` capability-supply path.
