# 名称与兼容性

2026-10-07 本地项目显示名改为 **Owner Agent Gateway**，包名为 `owner-agent-gateway`，候选版本 0.2.0。
GitHub 当前地址为 https://github.com/Buffalo2024/owner-agent-gateway；由原 `agent-dispatch` 仓库原地改名，保留历史与 Star。本地目录保留原位置。

精确 GitHub 名称搜索没有结果，`Buffalo2024/owner-agent-gateway` 和 npm `owner-agent-gateway` 查询返回 404。
这仅表示当次未发现占用，不是名称预留、完整商标调查或法律许可。
不采用 Agent Port：存在 https://github.com/yakkomajuri/agentport 等同名项目，npm `agentport` 已有发布。

## 不改动已有部署合同

- `AD_*` 环境变量保留，不强制迁移凭证配置。
- `agent-dispatch/0.1` 线协议标识保留；它是兼容标识，不是当前包版本。
- dots 原平台协议标识保留，不能为改名而破坏握手签名。
- 已发布历史版本与许可归属记录不回写为新产品的部署证明。
- npm 仍为 `private: true`；没有发布新 npm 包。

旧地址 https://github.com/Buffalo2024/agent-dispatch 使用 GitHub 的改名重定向；公开克隆说明已更新。没有创建第二个仓库。
