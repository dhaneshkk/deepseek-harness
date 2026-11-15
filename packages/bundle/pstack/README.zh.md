# `@deepseek-ai/dsh-pstack`

[English](README.md) | 中文

一个 profile 组合包，把 [pstack](https://github.com/cursor/plugins/tree/main/pstack)（Lauren Tan 为 Cursor 编写的工程工作流技能，MIT 许可）移植到 dsh。它新增 58 个斜杠命令技能（带 24 个 playbook 的 `poteto-mode` 路由器、24 个原则技能、审查与调查技能，以及 `egm-review` 规格审计），以及这些技能所指名的六个委派工具。内容跟随上游 pstack `0.15.42`（`cursor/plugins@bf0c7cd`）。[本地化 Agent Note](../../../.agents/notes/implemented/feature/2026-11-15-pstack-bundle.md) 记录了相对上游的改动及原因。

## 安装

```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-pstack
dsh --profile <name> --dump-config
```

该 patch 需要建立在 [`dsh-base`](../base/README.md) 之上的 profile：它依赖 `skills` 注册表、`spawn` subagent 提供方，以及 `read`、`glob`、`grep` 和 `skill` 工具。

## Patch 条目

[`cordis.patch.yml`](cordis.patch.yml) 插入以下条目。每条都是普通条目，因此用户 profile patch 可按 id 覆盖其配置；`/setup-pstack` 就是这样重新绑定工具模型的。

| 条目 id | 插件 | 职责 |
|---|---|---|
| `pstack-assets` | 本包 | 提供 `pstackAssets`：内置技能根目录与渲染后的 persona。 |
| `pstack-skill-filesystem` | `dsh-skill-filesystem` | 隔离的提供方 `pstack`，只扫描内置 `skills/` 根目录（`includeDefaultRoots: false`、`watch: false`）。 |
| `pstack-tool-poteto-agent` | `dsh-tool-subagent` | `poteto_agent`：可续接的 `spawn` 子代理，`poteto-agent` persona，`deepseek-v4-pro`。 |
| `pstack-tool-poteto-worker` | `dsh-tool-subagent` | `poteto_worker`：可续接的 `spawn` 子代理，`poteto-agent` persona，`deepseek-v4-flash`。 |
| `pstack-tool-review-pro` | `dsh-tool-subagent` | `pstack_review_pro`：一次性 `spawn` 子代理，部署 persona，`deepseek-v4-pro`。 |
| `pstack-tool-review-flash` | `dsh-tool-subagent` | `pstack_review_flash`：一次性 `spawn` 子代理，部署 persona，`deepseek-v4-flash`。 |
| `pstack-tool-goldfish-reviewer` | `dsh-tool-subagent` | `goldfish_reviewer`：一次性 `spawn` 子代理，`goldfish-reviewer` persona，工具过滤 `allow: [read, glob, grep, skill]`，`deepseek-v4-pro`。 |
| `pstack-tool-comment-sicko` | `dsh-tool-subagent` | `comment_sicko`：一次性 `spawn` 子代理，`comment-sicko` persona，`deepseek-v4-pro`。 |

每个工具条目都指定 `agentOptions.provider: deepseek-official`。若 profile 的 LLM 路由中没有该提供方，需用 `/setup-pstack` 或用户 patch 重新绑定每个条目的 `agentOptions`。

## 资源提供方

`pstack-assets` 插件根据自身模块 URL 解析包根目录，因此 `src/` 与构建后的 `lib/` 读取同一组 `skills/` 和 `agents/` 目录。激活时，它读取 [`agents/`](agents) 中的每个 persona，去掉 YAML frontmatter，并把 `{{skillsDir}}`、`{{potetoModeSkill}}` 和 `{{dshHostReference}}` 替换为绝对路径。缺失技能文件、persona 没有 frontmatter，或出现未知占位符，都会在激活时抛错，因此依赖它的条目不会带着损坏的 persona 挂载。

## 技能

每个技能都保留上游的 `disable-model-invocation: true`。面向模型的目录和 `skill` 工具从不暴露它们；用户通过 `/name` 标记启动技能，委派子代理按绝对路径读取内置技能。[`skills/poteto-mode/references/dsh-host.md`](skills/poteto-mode/references/dsh-host.md) 是从 pstack 宿主词汇（角色、委派工具、会话记录、循环）到 dsh 功能的唯一映射；改写后的技能指向它，而不再指名 Cursor 功能。

`egm-review` 技能、Spec review playbook 和 `goldfish-reviewer` persona 是为 dsh 新增的。它们执行 Elephant-Goldfish 规格审计：零上下文的 `goldfish_reviewer` 子代理审计磁盘上的规格，直到通过为止，然后才由 Feature 或 Multi-phase plan playbook 编写代码。

`skills/` 下的技能脚本（`poteto-mode/scripts/watch-pr`、`statechart/scripts` 等）是自带 bun 工具链的上游代码。仓库的 lint 与重复代码检查排除了 `skills/**`。

## 模型体验

### 委派工具 schema

#### 模型看到的内容

生成的 [`subagent` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-subagent) 的六个实例，名称分别为 `poteto_agent`、`poteto_worker`、`pstack_review_pro`、`pstack_review_flash`、`goldfish_reviewer` 和 `comment_sicko`，每个实例仅在 `spawn` 提供方存在时可见。两个可续接实例各自添加由 `dsh-tool-subagent` 拥有的 `tool:<toolName>` 委派指引段落。

#### Token 影响

在挂载本组合包的 profile 中，每个父请求固定增加六个工具 schema 和两个简短的系统提示词段落。

#### KV Cache 影响

只要条目、工具名称和提供方不变，前缀保持稳定。安装或移除本组合包，或提供方重新加载，会改变工具列表，并从第一个变化的定义处起使复用失效。

### 子代理 persona

#### 模型看到的内容

`poteto_agent`、`poteto_worker`、`goldfish_reviewer` 或 `comment_sicko` 子代理看到的是 [`agents/`](agents) 中渲染后的 persona（已替换绝对技能路径），取代部署 persona。`pstack_review_pro` 和 `pstack_review_flash` 子代理保留部署 persona。`goldfish_reviewer` 子代理的工具列表只有 `read`、`glob`、`grep` 和 `skill`。

#### Token 影响

每个子代理请求携带一次其 persona；父请求不携带任何 persona 内容。

#### KV Cache 影响

子代理请求彼此独立。persona 在进程内固定，因此同一工具的各子代理前缀稳定；包安装路径不同或 persona 文件被编辑会改变前缀。

### 技能注入

#### 模型看到的内容

只有当用户消息以 `/name` 标记指名某个 pstack 技能时，该技能才会经由负责渲染的 `dsh-tool-skill` 注入到达模型。pstack 技能从不出现在面向模型的目录中。

#### Token 影响

调用前为零；被调用技能的完整正文进入该步的请求。

#### KV Cache 影响

仅追加；注入的技能位于可复用前缀之后。

## 已知限制与暂缓事项

- **预设组合 profile 中的全局层** — 条目位于 profile 根部，因此在 web profile 中，六个工具和这些技能经由全局层到达每个智能体预设；任何预设都无法单独退出，除非禁用这些条目。
- **默认只有两个模型族** — 审查小组默认使用 `deepseek-v4-pro` 和 `deepseek-v4-flash`。跨厂商小组需要另一个 subagent 提供方（`dsh-subagent-claude-code`、`dsh-subagent-codex`、`dsh-subagent-acp`），配合各自的 `dsh-tool-subagent` 条目，并在角色行中指名。
- **无逐次调用的模型或推理强度** — 本 harness 的 `dsh-tool-subagent` 按实例固定 `agentOptions`，因此上游按调用选择推理级别和快速模式的做法映射为选择工具。
- **Cursor 专属功能没有对应物** — Bugbot、Automations（未随附 `make-bot-ui` 和 `benny` 包）、云端 VM worker 以及 Custom Modes 会被跳过，并附一行说明。
- **上游同步为手动** — 内容是上游 `0.15.42` 的改写副本；更新的上游版本需要重新执行改写并复核宿主引用。
