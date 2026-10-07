# GitHub 发布元信息

独立公开仓库：https://github.com/Buffalo2024/owner-agent-gateway。以下为发布配置；远程 CI 以 Actions 实际结果为准。

新版显示名为 **Owner Agent Gateway**，同一个仓库已改名为 `owner-agent-gateway`，不新建替代仓库。
2026-10-07 名称查询未发现精确 GitHub 搜索结果，账号目标地址和 npm 包名查询均为 404。
已执行远程改名；未发布 npm。[兼容说明](renaming.md)。

| 项目 | 计划值 |
| --- | --- |
| 账号 | `Buffalo2024`（作者已有个人账号） |
| 独立仓库名 | `owner-agent-gateway` |
| 地址 | `https://github.com/Buffalo2024/owner-agent-gateway` |
| 可见性 | Public |
| 默认分支 | `main` |
| Issues / Discussions | 启用；隔离讨论使用已有草稿 |
| Fork | 保持允许 |
| npm | 暂不发布；`private: true` 防止误发布，不影响 GitHub 公开与 Fork |

英文简介（用于 GitHub Description）：

> Owner-controlled gateway for existing personal agents: task leases, file delivery, Muse integration and a documented dots bridge.

中文简介：

> 将已有个人 AI 助理接入受主人控制的任务流程：提供任务协议、网关、可运行参考调度器与 dots 本机桥接案例。

Topics：`personal-agents`、`ai-agents`、`agent-gateway`、`task-protocol`、`self-hosted`、`async-execution`、`mcp`、`nodejs`。

不使用 `multi-tenant`、`sandbox`、`production-ready` 作为能力宣传标签；当前 dots 无可验证的上下文隔离。
发布时启用私密漏洞报告，并完成 [许可门禁](license-review.md)。隔离讨论草稿不会自动发布。
