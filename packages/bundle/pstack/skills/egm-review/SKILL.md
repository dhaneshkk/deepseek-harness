---
name: egm-review
description: Audit a design spec with zero-context Goldfish reviewers before any code is written, and revise it until no blocking gap remains. Use for /egm-review, "review this spec", "is this design ready to build", or a design doc or RFC to harden before implementation.
disable-model-invocation: true
---

# EGM review

Design with full context, review with none. You hold the conversation and the repository history. Each Goldfish reviewer holds only the spec file and the repository. A gap a cold reader finds is a gap an implementer will hit.

Do not edit source files while this skill runs. The spec is the only file you change.

Open a todolist with one entry per step before you start.

## 1. Lock the spec

Find the target spec: a path the user named, or the design document under discussion. With no spec on disk, draft one from the conversation and write it to `docs/designs/<slug>.md` first. A reviewer can only read what is on disk.

## 2. Dispatch the reviewers

Take the reviewers from the `spec reviewers` role in the **poteto-mode** skill's `references/dsh-host.md` (default: two `goldfish_reviewer` children). Spawn every reviewer in one message.

Pass each reviewer only these things:

- The spec's path.
- The repository directories the spec names.
- This instruction: "Audit this spec cold per your checklist. Return the verdict in the checklist's output format."

Do not pass conversation summaries, rationale, hints, or your own reading of the spec. Never use `subagent_fork` here, because it hands the reviewer your history.

## 3. Synthesize and revise

Compare the reports against your full context. For each blocking gap and each unstated assumption:

- Resolve it in the spec when the answer is a fact you can verify in the code. Cite the file in the spec.
- Ask the user with `ask_user_question` when it is a product or preference call that no code or experiment settles.

Write the revised spec. Run step 2 again with fresh reviewers. Stop at `PASS` from every reviewer, or after three rounds. After three rounds without a pass, report the remaining gaps and stop.

## 4. Hand off

Reply with the spec path, the round count, and what each round changed. Then route the build through `/poteto-mode`: the **Feature** playbook for one PR, or the **Multi-phase or multi-PR plan** playbook for more.
