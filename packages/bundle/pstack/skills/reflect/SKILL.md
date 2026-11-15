---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation's session with `session_search`, scoped to the active workspace. Pass reviewers the session id and tell them to read it with `session_event_read` or `session_trace`. If the session cannot be found, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three delegation calls. Reviewers keep every tool, because they look up the tickets, chat threads, and observability traces the session references. Each reviewer and the synthesizer run on the tool their role names in the **poteto-mode** skill's `references/dsh-host.md`.

| Lens | Role | Default tool | Prompt template |
|---|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `pstack_review_pro` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `pstack_review_flash` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `pstack_review_pro` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the session id or digest where marked. Reviewers return findings as their final message.

## 3. Synthesize

One delegation call on the `reflect judgment, divergent, synthesizer` tool. It spot-verifies citations through MCP. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Never edit a skill inside an installed plugin package. Before approval, show its destination, `<project>/.dsh/skills/<skill>/` or `$DSH_HOME/skills/<skill>/`. After approval, copy the skill folder there and edit the copy. Never open a PR or push.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): run the Authoring a skill playbook (`../poteto-mode/playbooks/authoring-a-skill.md`).
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to `create-skill` and run its description-optimization loop.
- `new skill via create-skill: <kebab-name>`: hand creation to `create-skill`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
