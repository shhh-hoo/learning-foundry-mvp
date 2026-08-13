# Learning Foundry MVP

A deliberately thin, runnable vertical slice of Learning Foundry.

```text
Teacher assigns a goal
→ each student gets a Task
→ Foundry sends current state + available Capabilities to an orchestrator
→ orchestrator returns Capability Resolution + ActivityPlan
→ Asset Stage launches an exact ComponentAsset in a sandboxed iframe
→ Component reports events and Attempt through Runtime Protocol v0.1
→ Foundry persists the Attempt and a bounded diagnosis proposal
→ teacher inspects evidence and can change the next capability resolution
```

## What this MVP proves

- one teacher (teacher and expert are the same actor)
- multiple seeded students
- persistent Product State behind a repository boundary
- a Capability Registry independent of subject knowledge
- Web ComponentAssets launched in a sandboxed iframe
- a small `postMessage` Runtime Protocol
- teacher `REQUIRE_CAPABILITY` / `EXCLUDE_CAPABILITY` intervention
- mock orchestration that can be replaced by Dify
- no n8n, LangGraph, custom LLM control plane, multi-tenant/RLS machinery, or long-term learning lifecycle yet

The local JSON store is only a demo persistence adapter. It is intentionally easy to replace with Postgres/Supabase later.

## Run

Requires Node.js 20+ and no third-party packages.

```bash
npm start
```

Open `http://127.0.0.1:3000`.

Reset demo state:

```bash
npm run reset
```

Run the small smoke checks:

```bash
npm test
```

## Demo surfaces

The product is one small shell with hash-routed surfaces:

- `/#teacher` — Teacher Workspace
- `/#teacher/alice` — Alice in the teacher dashboard
- `/#student/alice`
- `/#student/bob`
- `/#student/charlie`

A typical walkthrough is:

1. Teacher assigns one goal to all three students.
2. Open Alice and plan her next activity → `Ratio Explorer`.
3. Open Bob and plan his next activity → `Calculation Trainer`.
4. Submit an Attempt inside the iframe ComponentAsset.
5. Return to Teacher Workspace and inspect the persisted Attempt + diagnosis proposal.
6. Require or exclude a capability, then plan the learner's next activity again.

## Component integration

Learning Components are independent Web apps, not React UI components and not Dify nodes.

For the demo they live under:

```text
public/component-assets/
  ratio-explorer/component.html
  calculation-trainer/component.html
```

The Registry stores their callable identity and runtime metadata:

```js
{
  id: "ratio-explorer",
  version: "1.0.0",
  runtime: {
    type: "web",
    launchUrl: "/component-assets/ratio-explorer/component.html",
    protocolVersion: "0.1"
  }
}
```

`public/bridge.js` owns the `COMPONENT_READY → FOUNDRY_INIT` handshake. `public/app.js` forwards subsequent Component events to Foundry Product State. Components cannot write diagnoses, teacher decisions, or learning outcomes directly.

A real deployment should serve untrusted/generated ComponentAssets from a separate origin. Same-server sandboxed iframes are used here only to keep the MVP one-command runnable.

## Dify adapter

Mock orchestration is the default so the repo runs without external services.

To switch to a Dify Workflow:

```bash
ORCHESTRATOR=dify \
DIFY_BASE_URL=https://api.dify.ai \
DIFY_API_KEY=your_workflow_api_key \
npm start
```

The Workflow receives three string inputs:

```text
context_json
capabilities_json
latest_attempt_json
```

It should return either `resolution` + `plan` output variables, or a `result` output containing:

```json
{
  "resolution": {},
  "plan": {}
}
```

Dify is only a replaceable orchestration implementation. Foundry still owns Product State, the Registry, runtime sessions, Attempts, and teacher decisions.

## Repository map

```text
server.mjs                  HTTP + Product API
src/
  product-state/store.mjs   persistence boundary
  capabilities/registry.mjs Capability Registry
  orchestrator/mock.mjs     local runnable orchestration
  orchestrator/dify.mjs     Dify Workflow adapter
  runtime/protocol.mjs      Runtime Protocol v0.1
public/
  demo.html                 single-page shell
  app.js                    Teacher + Learner surfaces
  bridge.js                 iframe runtime bridge
  component-assets/         independent learning Web apps
data/seed.json              demo Product State seed
checks.mjs                  intentionally small smoke gate
```

## Next product work

Keep the sequence narrow:

1. connect a real Dify learner-orchestration workflow;
2. replace one demo ComponentAsset with a real existing learning app;
3. make Attempt/context input materially change the Dify decision;
4. add one `NO_MATCH → preview → confirm → register → learner uses it` supply path.

Do not expand school tenancy, analytics, Retry/Transfer/Retention, or optimization until this loop feels good as a product demo.
