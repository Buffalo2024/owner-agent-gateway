# GitHub 发布元信息

独立公开仓库：https://github.com/Buffalo2024/agent-dispatch。以下为发布配置；远程 CI 以 Actions 实际结果为准。

| 项目 | 计划值 |
| --- | --- |
| 账号 | `Buffalo2024`（作者已有个人账号） |
| 独立仓库名 | `agent-dispatch` |
| 地址 | `https://github.com/Buffalo2024/agent-dispatch` |
| 可见性 | Public |
| 默认分支 | `main` |
| Issues / Discussions | 启用；隔离讨论使用已有草稿 |
| Fork | 保持允许 |
| npm | 暂不发布；`private: true` 防止误发布，不影响 GitHub 公开与 Fork |

英文简介（用于 GitHub Description）：

> Owner-controlled task protocol and gateway for existing personal AI assistants, with a runnable reference scheduler and a documented dots bridge.

中文简介：

> 将已有个人 AI 助理接入受主人控制的任务流程：提供任务协议、网关、可运行参考调度器与 dots 本机桥接案例。

Topics：`personal-agents`、`ai-agents`、`agent-gateway`、`task-protocol`、`self-hosted`、`async-execution`、`mcp`、`nodejs`。

不使用 `multi-tenant`、`sandbox`、`production-ready` 作为能力宣传标签；当前 dots 无可验证的上下文隔离。
发布时启用私密漏洞报告，并完成 [许可门禁](license-review.md)。隔离讨论草稿不会自动发布。
