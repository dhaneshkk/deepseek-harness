---
name: setup-pstack
description: Choose which delegation tool runs each pstack role and which model each pstack delegation tool uses. Detects the configured models, writes the role file and a profile patch. Use for /setup-pstack, "configure pstack models", or changing pstack's model choices.
disable-model-invocation: true
---

# Setup pstack

pstack runs every role through a delegation tool, and each delegation tool is bound to one model. This skill sets both. The role table and the tool table live in the **poteto-mode** skill's `references/dsh-host.md`. Read it first.

## Steps

### 1. Detect available models

List the LLM providers and models configured for this harness: read the `llm-deepseek:` and `llm-pi-ai:` sections of `$DSH_HOME/settings.yaml`, and the `agent-default-model` row of the active profile (`dsh --profile <name> --dump-config`). If you cannot detect any, ask the user to paste the provider and model ids they use. Never write a model id you have not confirmed is configured.

### 2. Load current state

Read `$DSH_HOME/pstack/models.md` if it exists. Its role lines are the current role choices. Read `$DSH_HOME/profiles/<profile>/cordis.patch.yml` for rows whose `id` starts with `pstack-tool-`. Their `agentOptions` are the current tool models. A role line whose role is not in the role table is retired. Drop it.

### 3. Map and confirm

Show every pstack delegation tool with its current provider and model, and every role with its current tool. Ask whether to accept as-is or change specific entries with `ask_user_question`. Offer the detected models for tools, and the pstack tools plus `inherit-parent` for roles. A panel role takes a list, and one child runs per entry, so the list length sets the fan-out.

### 4. Validate

Every model written must be in the detected set. Every tool named in a role line must be a pstack delegation tool, a tool the user has mounted, or `inherit-parent`. If a choice fails, stop and ask again.

### 5. Write

Write `$DSH_HOME/pstack/models.md` with one line per changed role, in the shape `<role>: <tool>[, <tool>...]`. Delete a line to fall back to the default. Overwrite the whole file so re-runs stay idempotent.

For each tool whose model changed, write one patch row into `$DSH_HOME/profiles/<profile>/cordis.patch.yml`, keyed by the tool's row id:

```yaml
- id: pstack-tool-poteto-agent
  config:
    agentOptions:
      provider: deepseek-official
      model: deepseek-v4-pro
```

Replace an existing row with the same `id` rather than appending a second one. Then run `dsh --profile <profile> --dump-config` and confirm each row composed.

### 6. Confirm

Tell the user what changed and that tool models apply to new sessions. Re-running this skill updates both files.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, invoke `/create-verification-skill`. On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /create-formal-verification-skill." On yes, invoke `/create-formal-verification-skill`. On no, move on without pushing.
