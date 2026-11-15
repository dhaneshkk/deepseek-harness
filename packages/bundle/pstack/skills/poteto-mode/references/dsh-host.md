# pstack on DeepSeek Harness

This file is the single home for every pstack term that names a host feature. A skill that names a role, a delegation tool, a transcript, or a model file means the DeepSeek Harness (`dsh`) feature listed here.

## Delegation tools

The `@deepseek-ai/dsh-pstack` bundle mounts these model-facing delegation tools. Each tool is one `@deepseek-ai/dsh-tool-subagent` instance over the in-process `spawn` provider, so every child starts with an empty conversation. A prompt to any of them must stand alone: pass file paths, the brief, and every directive. The child sees nothing else.

| Tool | Persona | Tools the child keeps | Background default | Model (bundle default) |
|---|---|---|---|---|
| `poteto_agent` | `poteto-agent` | all | background (continuable) | `deepseek-v4-pro` |
| `poteto_worker` | `poteto-agent` | all | background (continuable) | `deepseek-v4-flash` |
| `pstack_review_pro` | deployment persona | all | foreground (one-shot) | `deepseek-v4-pro` |
| `pstack_review_flash` | deployment persona | all | foreground (one-shot) | `deepseek-v4-flash` |
| `goldfish_reviewer` | `goldfish-reviewer` | `read`, `glob`, `grep`, `skill` | foreground (one-shot) | `deepseek-v4-pro` |
| `comment_sicko` | `comment-sicko` | all | foreground (one-shot) | `deepseek-v4-pro` |

The base profile also mounts `subagent` (fresh child, deployment persona, parent model) and `subagent_fork` (child seeded with the parent's completed turns). `subagent_fork` inherits context, so never use it for an independent review, a Goldfish audit, or `/interrogate`.

A model choice is a property of the tool, not of the call. To run a role on another model, call the tool bound to that model. `/setup-pstack` rebinds tool models in the profile patch.

## Roles

A role line in `$DSH_HOME/pstack/models.md` names the delegation tool, or a comma-separated list of tools for a panel role, that runs the role. A missing file or line means the default below. The value `inherit-parent` means the base `subagent` tool, which runs on the parent's model.

| Role | Default |
|---|---|
| `feature, refactoring` | `poteto_agent` |
| `bug-fix` | `poteto_agent` |
| `perf-issue` | `poteto_agent` |
| `hillclimb` | `poteto_agent` |
| `judgment and prose` | `poteto_agent` |
| `hardest tasks` | `poteto_agent` |
| `swarm workers` | `poteto_worker` |
| `reflect tooling` | `pstack_review_flash` |
| `reflect judgment, divergent, synthesizer` | `pstack_review_pro` |
| `arena runners` | `pstack_review_pro, pstack_review_flash` |
| `arena cross-judge pool` | `pstack_review_pro, pstack_review_flash` |
| `architect runners` | `pstack_review_pro, pstack_review_flash` |
| `interrogate reviewers` | `pstack_review_pro, pstack_review_flash` |
| `spec reviewers` | `goldfish_reviewer, goldfish_reviewer` |

A panel role runs one child per list entry, so the list length sets the fan-out. A repeated entry runs two independent children on the same tool.

**Families.** A family is the model a tool is bound to. With the bundle defaults the panel has two families, `deepseek-v4-pro` and `deepseek-v4-flash`. A rule that asks for a judge "from another vendor" means a tool bound to a model other than the parent's. When every panel tool shares the parent's model, say so in the reply and run the judge anyway. For cross-vendor panels, mount another provider (`@deepseek-ai/dsh-subagent-claude-code`, `@deepseek-ai/dsh-subagent-codex`, or `@deepseek-ai/dsh-subagent-acp`) with its own `@deepseek-ai/dsh-tool-subagent` row and name that tool in the role line.

**Rejections.** When a tool is absent from this session, use the role's default and say so. When the default is also absent, use the base `subagent` tool and say so.

## Background and follow-up

A continuable child (`poteto_agent`, `poteto_worker`) runs in the background unless the call passes `run_in_background: false`. Its settlement notice arrives in your conversation when it finishes. `send_message` sends more work to a running or idle child by id. A one-shot tool waits in the foreground unless the call passes `run_in_background: true`, then returns a job id for `job_output` and `job_kill`.

## Other host features

| pstack text | dsh feature |
|---|---|
| Ask the user (structured choice) | the `ask_user_question` tool |
| Todo list | the `todo_write` tool |
| A transcript of a past or current session | `session_search` to find a session, then `session_event_read` or `session_trace` to read it. Search only sessions of the active workspace. |
| Wake on an interval or keep going until a check passes | `/goal <check>` for a same-session loop that ends when the check passes, or `schedule_create` for a timed wake-up |
| Project skills directory | `<project>/.dsh/skills/` (or `<project>/.agents/skills/`) |
| User skills directory | `$DSH_HOME/skills/` (default `~/.dsh/skills/`) |
| Plan mode | the base profile's plan mode (`exit_plan_mode`) |
| Author or substantially edit a SKILL.md | the **authoring-a-skill** playbook, then validate the frontmatter: kebab-case `name`, a `description`, and only the keys `whenToUse`, `metadata`, `disable-model-invocation`, `user-invocable` beside them |
| Slop strip before commit | the **unslop** skill on prose and the **principle-subtract-before-you-add** skill on code |
| Drive the real app for proof | the project's `verify-*` skill; with none, generate one with `/create-verification-skill` |
| Cloud VM for a worker | not available. Every child runs in this process against this checkout. Give each parallel writer its own git worktree. |
| Cursor Bugbot, Cursor Automations | not available. Skip the step and say so in one line. |

## Loading pstack skills

Every pstack skill sets `disable-model-invocation: true`, so the model-facing skill catalog does not list it and the `skill` tool does not load it. A human starts one as a slash command. Inside a run, read a bundled skill or playbook with the `read` tool at its absolute path. Bundled skills live at `../<name>/SKILL.md` from the `poteto-mode` skill file. Each pstack persona carries that file's absolute path.
