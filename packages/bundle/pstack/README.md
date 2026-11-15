# `@deepseek-ai/dsh-pstack`

English | [中文](README.zh.md)

A profile bundle that ports [pstack](https://github.com/cursor/plugins/tree/main/pstack) (Lauren Tan's engineering-workflow skills for Cursor, MIT) to dsh. It adds 58 slash-command skills (the `poteto-mode` router with 24 playbooks, 24 principle skills, review and investigation skills, and the `egm-review` spec audit) and six delegation tools that those skills name. The content tracks upstream pstack `0.15.42` (`cursor/plugins@bf0c7cd`). The [nativization Agent Note](../../../.agents/notes/implemented/feature/2026-11-15-pstack-bundle.md) records what changed from upstream and why.

## Install

```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-pstack
dsh --profile <name> --dump-config
```

The patch needs a profile over [`dsh-base`](../base/README.md): it requires the `skills` registry, the `spawn` subagent provider, and the `read`, `glob`, `grep`, and `skill` tools.

## Patch rows

[`cordis.patch.yml`](cordis.patch.yml) inserts these rows. Each is an ordinary row, so a user profile patch overrides its config by id; `/setup-pstack` rebinds tool models that way.

| Row id | Plugin | Role |
|---|---|---|
| `pstack-assets` | this package | Provides `pstackAssets`: the bundled skill root and the rendered personas. |
| `pstack-skill-filesystem` | `dsh-skill-filesystem` | Isolated provider `pstack` that scans only the bundled `skills/` root (`includeDefaultRoots: false`, `watch: false`). |
| `pstack-tool-poteto-agent` | `dsh-tool-subagent` | `poteto_agent`: continuable `spawn` child, `poteto-agent` persona, `deepseek-v4-pro`. |
| `pstack-tool-poteto-worker` | `dsh-tool-subagent` | `poteto_worker`: continuable `spawn` child, `poteto-agent` persona, `deepseek-v4-flash`. |
| `pstack-tool-review-pro` | `dsh-tool-subagent` | `pstack_review_pro`: one-shot `spawn` child, deployment persona, `deepseek-v4-pro`. |
| `pstack-tool-review-flash` | `dsh-tool-subagent` | `pstack_review_flash`: one-shot `spawn` child, deployment persona, `deepseek-v4-flash`. |
| `pstack-tool-goldfish-reviewer` | `dsh-tool-subagent` | `goldfish_reviewer`: one-shot `spawn` child, `goldfish-reviewer` persona, tool filter `allow: [read, glob, grep, skill]`, `deepseek-v4-pro`. |
| `pstack-tool-comment-sicko` | `dsh-tool-subagent` | `comment_sicko`: one-shot `spawn` child, `comment-sicko` persona, `deepseek-v4-pro`. |

Every tool row names `agentOptions.provider: deepseek-official`. A profile whose LLM route has no such provider rebinds each row's `agentOptions` with `/setup-pstack` or a user patch.

## Asset provider

The `pstack-assets` plugin resolves the package root from its own module URL, so `src/` and the built `lib/` read the same `skills/` and `agents/` directories. At activation it reads each persona in [`agents/`](agents), removes its YAML frontmatter, and substitutes `{{skillsDir}}`, `{{potetoModeSkill}}`, and `{{dshHostReference}}` with absolute paths. A missing skill file, a persona without frontmatter, or an unknown placeholder throws at activation, so the dependent rows never mount with a broken persona.

## Skills

Every skill keeps upstream's `disable-model-invocation: true`. The model-facing catalog and the `skill` tool never expose them; a user starts one with a `/name` token, and a delegate reads a bundled skill by absolute path. [`skills/poteto-mode/references/dsh-host.md`](skills/poteto-mode/references/dsh-host.md) is the single mapping from pstack's host vocabulary (roles, delegation tools, transcripts, loops) to dsh features; the rewritten skills point to it instead of naming Cursor features.

The `egm-review` skill, the Spec review playbook, and the `goldfish-reviewer` persona are additions for dsh. They run an Elephant-Goldfish spec audit: zero-context `goldfish_reviewer` children audit a spec on disk until it passes, before the Feature or Multi-phase plan playbook writes code.

Skill scripts under `skills/` (`poteto-mode/scripts/watch-pr`, `statechart/scripts`, and others) are upstream code with their own bun tooling. The repository's lint and duplication gates exclude `skills/**`.

## Model Experience

### Delegation tool schemas

#### What the model sees

Six instances of the generated [`subagent` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-subagent) under the names `poteto_agent`, `poteto_worker`, `pstack_review_pro`, `pstack_review_flash`, `goldfish_reviewer`, and `comment_sicko`, each while the `spawn` provider exists. The two continuable instances each add the `tool:<toolName>` delegation guidance section that `dsh-tool-subagent` owns.

#### Token effect

Six fixed tool schemas and two short system-prompt sections on every parent request in a profile that mounts the bundle.

#### KV Cache effect

Prefix-stable while the rows, tool names, and providers are unchanged. Installing or removing the bundle, or a provider reload, changes the tool list and invalidates reuse from the first changed definition.

### Child personas

#### What the model sees

A `poteto_agent`, `poteto_worker`, `goldfish_reviewer`, or `comment_sicko` child sees its rendered persona from [`agents/`](agents) in place of the deployment persona, with absolute skill paths substituted. `pstack_review_pro` and `pstack_review_flash` children keep the deployment persona. A `goldfish_reviewer` child's tool list holds only `read`, `glob`, `grep`, and `skill`.

#### Token effect

Each child request carries its persona once; the parent request carries none of it.

#### KV Cache effect

Independent child requests. The persona is fixed for the process, so a child's prefix is stable across children of the same tool; a different package install path or edited persona file changes it.

### Skill injection

#### What the model sees

A pstack skill reaches the model only when the user's message names it as a `/name` token, through the `dsh-tool-skill` injection that owns the rendering. pstack skills never appear in the model-facing catalog.

#### Token effect

Zero until invoked; an invoked skill's full body enters that step's request.

#### KV Cache effect

Append-only; the injected skill follows the reusable prefix.

## Known Limitations and Deferred Work

- **Global layer in preset-composed profiles** — the rows sit at the profile root, so in the web profile the six tools and the skills reach every agent preset through the global layer; no preset can opt out without disabling the rows.
- **Two model families by default** — the review panel defaults to `deepseek-v4-pro` and `deepseek-v4-flash`. A cross-vendor panel needs another subagent provider (`dsh-subagent-claude-code`, `dsh-subagent-codex`, `dsh-subagent-acp`) with its own `dsh-tool-subagent` row named in a role line.
- **No per-call model or effort** — this harness's `dsh-tool-subagent` fixes `agentOptions` per instance, so upstream's per-call reasoning-level and fast-mode choices map to choosing a tool.
- **Cursor-only features have no equivalent** — Bugbot, Automations (`make-bot-ui` and the `benny` pack are not shipped), cloud-VM workers, and Custom Modes are skipped with a one-line note.
- **Upstream sync is manual** — the content is a rewritten copy of upstream `0.15.42`; a newer upstream needs the rewrite reapplied and the host references rechecked.
