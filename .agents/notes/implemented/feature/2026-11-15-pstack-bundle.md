# Agent Note: pstack as a dsh profile bundle

Status: implemented

English | [中文](2026-11-15-pstack-bundle.zh.md)

## Problem

pstack is a set of engineering-workflow skills, playbooks, and subagent personas written for Cursor. Its text names Cursor features throughout: `Task` calls with `subagent_type` and per-call model slugs, `AskQuestion`, `/loop`, cloud-VM workers, `~/.cursor/` paths, Cursor transcripts, and the `cursor-team-kit` plugin. Copied unchanged into a dsh skill root, the skills tell the model to call tools that do not exist, and the personas have no way to reach the hidden skill files they must read first.

## Decision

`@deepseek-ai/dsh-pstack` (`packages/bundle/pstack`) is a profile bundle that ships a rewritten copy of upstream pstack `0.15.42` (`cursor/plugins@bf0c7cd`) and the rows that run it.

- **Skills through an isolated provider.** A second `dsh-skill-filesystem` row with `providerName: pstack` and `includeDefaultRoots: false` scans only the bundled `skills/` root. The profile's own provider keeps its roots and configuration.
- **Personas rendered by the package.** The `pstack-assets` plugin resolves the package root from its module URL, renders each persona in `agents/` with absolute skill paths, and provides `pstackAssets`. Tool rows inject it and read the persona through `!!js` config, the same lazy-config path `dsh-headless` uses for its task.
- **One delegation tool per role-model pair.** This harness's `dsh-tool-subagent` fixes persona, tool filter, and `agentOptions` per instance, so pstack's per-call `subagent_type` and model slug become six `spawn` instances: `poteto_agent` and `poteto_worker` (continuable, `poteto-agent` persona, pro and flash), `pstack_review_pro` and `pstack_review_flash` (one-shot panel seats), `goldfish_reviewer` (read and search only), and `comment_sicko`. Every instance uses `spawn`, so no pstack child inherits the parent's conversation.
- **One home for host vocabulary.** `skills/poteto-mode/references/dsh-host.md` maps roles to delegation tools and every Cursor host feature to its dsh feature or to "not available". The rewritten skills point to it. Role overrides live in `$DSH_HOME/pstack/models.md` as tool names; tool models live in the profile patch, which `/setup-pstack` writes.
- **Elephant-Goldfish spec gate.** The `egm-review` skill, the Spec review playbook, and the `goldfish-reviewer` persona are additions: zero-context `goldfish_reviewer` children audit a spec on disk, and the Elephant revises it until it passes or three rounds elapse.

The rewrite maps upstream terms as follows.

| Upstream | dsh |
|---|---|
| `Task` with `subagent_type: "poteto-agent"` | `poteto_agent` (or `poteto_worker` for trivial edits) |
| `Task` with `subagent_type: generalPurpose`, a model slug | the role's delegation tool from `dsh-host.md` |
| `readonly: true` explorer | `goldfish_reviewer` |
| `subagent_type: "comment-sicko"` | `comment_sicko` |
| reasoning level, fast mode | choosing the tool bound to the needed model |
| `AskQuestion` | `ask_user_question` |
| `/loop` | `/goal`, or `schedule_create` for a timed wake-up |
| `agent-transcripts/` under `~/.cursor/projects/` | `session_search`, `session_event_read`, `session_trace` |
| `~/.cursor/rules/pstack-models.mdc` | `$DSH_HOME/pstack/models.md` plus profile patch rows |
| `.cursor/skills/`, `~/.cursor/skills/` | `.dsh/skills/`, `$DSH_HOME/skills/` |
| Cursor's `create-skill` | the Authoring a skill playbook with dsh's frontmatter rules |
| `deslop` (`cursor-team-kit`) | the **principle-subtract-before-you-add** skill on the diff |
| `control-ui`, `control-cli` (`cursor-team-kit`) | the project's `verify-*` skill |
| cloud-VM workers | in-process children, one git worktree per writer |

`make-bot-ui` (Cursor Automations webhooks) and the `automations/benny` pack are not shipped. Upstream's `docs/guide` links point to the upstream copy.

## Alternatives considered

- **Base the port on `ahmedbenaw/pstack`.** That fork targets Claude Code, Codex, and ChatGPT, stops at upstream `0.15.2`, drops eleven skills including both formal-verification skills, and strips `disable-model-invocation`, which dsh honors. Rejected; its nativization map informed the mapping table.
- **Agent presets for the personas.** Presets in this harness compose a whole agent plane from `agent.cordis.yml` files, and a child's composition joins its parent's preset. A preset per persona would replace the tool set rather than add a persona. Rejected in favor of `dsh-tool-subagent`'s per-instance `persona` and `toolFilter`.
- **Patching the profile's `skill-filesystem` row with `customSkillDirs`.** A patch replaces a row's whole `config`, so it would clobber the user's own settings for that row. Rejected for a separate provider row.
- **A Cordis plugin that registers skills and subagents directly.** The skill and subagent registries already accept these contributions through existing plugins configured by rows. Writing a registration plugin would duplicate them.

## Consequences

- The skills keep upstream's methodology and wording outside host references, so later upstream versions can be rewritten with the same mapping.
- A role's model is a tool choice, so a mixed-model panel needs a tool per model, and the default panel has two families. A cross-vendor panel needs another subagent provider and row.
- The rows sit at the profile root. In the web profile the tools and skills reach every preset through the global layer.
- Upstream skill scripts (`watch-pr`, `statechart`) ship with their bun tooling. `.oxlintrc.json` and `.jscpd.json` exclude `packages/bundle/pstack/skills/**`, as they exclude other imported code.

## Testing

`packages/bundle/pstack/tests/pstack.spec.ts` boots the shipped patch rows through the Loader with the real asset provider, the real skill registry, and the real `dsh-skill-filesystem` provider. It asserts every bundled skill is listed by the `pstack` provider as user-invocable and hidden from the model, that each tool row resolves its persona, filter, and model, that rendered personas name existing absolute paths, and that a malformed persona or missing skill file fails at activation.
