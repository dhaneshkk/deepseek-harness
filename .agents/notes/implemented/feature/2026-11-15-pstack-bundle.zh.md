# Agent Note: 以 dsh profile 组合包形式提供 pstack

Status: implemented

[English](2026-11-15-pstack-bundle.md) | 中文

## Problem

pstack 是一组为 Cursor 编写的工程工作流技能、playbook 和子代理 persona。其文本处处指名 Cursor 功能：带 `subagent_type` 和逐次调用模型 slug 的 `Task` 调用、`AskQuestion`、`/loop`、云端 VM worker、`~/.cursor/` 路径、Cursor 会话记录，以及 `cursor-team-kit` 插件。若原样复制进 dsh 技能根目录，这些技能会让模型调用不存在的工具，而 persona 也无法找到它们必须先读取的隐藏技能文件。

## Decision

`@deepseek-ai/dsh-pstack`（`packages/bundle/pstack`）是一个 profile 组合包，随附上游 pstack `0.15.42`（`cursor/plugins@bf0c7cd`）的改写副本，以及运行它所需的条目。

- **通过隔离提供方提供技能。** 第二个 `dsh-skill-filesystem` 条目使用 `providerName: pstack` 和 `includeDefaultRoots: false`，只扫描内置的 `skills/` 根目录。profile 自身的提供方保留其根目录与配置。
- **由本包渲染 persona。** `pstack-assets` 插件根据模块 URL 解析包根目录，用绝对技能路径渲染 `agents/` 中的每个 persona，并提供 `pstackAssets`。工具条目注入它，并通过 `!!js` 配置读取 persona，这与 `dsh-headless` 读取任务所用的惰性配置路径相同。
- **每个角色与模型组合对应一个委派工具。** 本 harness 的 `dsh-tool-subagent` 按实例固定 persona、工具过滤和 `agentOptions`，因此 pstack 逐次调用的 `subagent_type` 与模型 slug 变为六个 `spawn` 实例：`poteto_agent` 与 `poteto_worker`（可续接，`poteto-agent` persona，分别为 pro 与 flash）、`pstack_review_pro` 与 `pstack_review_flash`（一次性的小组席位）、`goldfish_reviewer`（仅读取与搜索），以及 `comment_sicko`。每个实例都使用 `spawn`，因此 pstack 的任何子代理都不会继承父级对话。
- **宿主词汇只有一个归属。** `skills/poteto-mode/references/dsh-host.md` 把角色映射到委派工具，并把每个 Cursor 宿主功能映射到对应的 dsh 功能或“不可用”。改写后的技能都指向它。角色覆盖以工具名形式存放在 `$DSH_HOME/pstack/models.md`；工具模型存放在 profile patch 中，由 `/setup-pstack` 写入。
- **Elephant-Goldfish 规格关卡。** `egm-review` 技能、Spec review playbook 和 `goldfish-reviewer` persona 是新增内容：零上下文的 `goldfish_reviewer` 子代理审计磁盘上的规格，Elephant 据此修订，直到通过或满三轮。

改写按下表映射上游术语。

| 上游 | dsh |
|---|---|
| 带 `subagent_type: "poteto-agent"` 的 `Task` | `poteto_agent`（琐碎编辑用 `poteto_worker`） |
| 带 `subagent_type: generalPurpose` 和模型 slug 的 `Task` | `dsh-host.md` 中该角色的委派工具 |
| `readonly: true` 的探索者 | `goldfish_reviewer` |
| `subagent_type: "comment-sicko"` | `comment_sicko` |
| 推理级别、快速模式 | 选择绑定所需模型的工具 |
| `AskQuestion` | `ask_user_question` |
| `/loop` | `/goal`，定时唤醒用 `schedule_create` |
| `~/.cursor/projects/` 下的 `agent-transcripts/` | `session_search`、`session_event_read`、`session_trace` |
| `~/.cursor/rules/pstack-models.mdc` | `$DSH_HOME/pstack/models.md` 加 profile patch 条目 |
| `.cursor/skills/`、`~/.cursor/skills/` | `.dsh/skills/`、`$DSH_HOME/skills/` |
| Cursor 的 `create-skill` | 遵循 dsh frontmatter 规则的 Authoring a skill playbook |
| `deslop`（`cursor-team-kit`） | 对 diff 应用 **principle-subtract-before-you-add** 技能 |
| `control-ui`、`control-cli`（`cursor-team-kit`） | 项目的 `verify-*` 技能 |
| 云端 VM worker | 进程内子代理，每个写入者一个 git worktree |

不随附 `make-bot-ui`（Cursor Automations webhook）和 `automations/benny` 包。上游 `docs/guide` 的链接指向上游副本。

## Alternatives considered

- **以 `ahmedbenaw/pstack` 为基础移植。** 该 fork 面向 Claude Code、Codex 和 ChatGPT，停留在上游 `0.15.2`，缺少包括两个形式化验证技能在内的十一个技能，并去掉了 dsh 会遵循的 `disable-model-invocation`。已否决；其本地化映射为映射表提供了参考。
- **用智能体预设承载 persona。** 本 harness 的预设从 `agent.cordis.yml` 文件组合整个智能体平面，而子代理的组合会加入父级的预设。每个 persona 一个预设会替换工具集，而不是添加 persona。已否决，改用 `dsh-tool-subagent` 按实例提供的 `persona` 与 `toolFilter`。
- **用 `customSkillDirs` 修补 profile 的 `skill-filesystem` 条目。** patch 会替换条目的整个 `config`，从而覆盖用户对该条目的设置。已否决，改用独立的提供方条目。
- **直接注册技能和子代理的 Cordis 插件。** 技能与子代理注册表已经通过现有插件和条目配置接收这类贡献。另写注册插件会造成重复。

## Consequences

- 技能在宿主引用之外保留上游的方法论与措辞，因此后续上游版本可以用同一映射改写。
- 角色的模型由工具选择决定，因此混合模型的小组需要每个模型一个工具，默认小组只有两个模型族。跨厂商小组需要另一个 subagent 提供方和条目。
- 条目位于 profile 根部。在 web profile 中，工具和技能经由全局层到达每个预设。
- 上游技能脚本（`watch-pr`、`statechart`）连同其 bun 工具链一起随附。`.oxlintrc.json` 和 `.jscpd.json` 排除 `packages/bundle/pstack/skills/**`，与排除其他导入代码的做法一致。

## Testing

`packages/bundle/pstack/tests/pstack.spec.ts` 通过 Loader 启动随附的 patch 条目，使用真实的资源提供方、真实的技能注册表和真实的 `dsh-skill-filesystem` 提供方。它断言：每个内置技能都由 `pstack` 提供方列出，且可由用户调用、对模型隐藏；每个工具条目都解析出其 persona、过滤和模型；渲染后的 persona 指名的绝对路径都存在；格式错误的 persona 或缺失的技能文件会在激活时失败。
