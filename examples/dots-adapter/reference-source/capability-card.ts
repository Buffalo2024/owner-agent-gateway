// Historical deployed bridge reference; see ../README.md for dependencies and limits.
import type {AgentCapabilityCardV1} from "../../contracts/src/reception.ts";
export const dotsCapabilityCard:AgentCapabilityCardV1 = {
  "schemaVersion": "agent.capability-card.v1",
  "summary": "Example owner的私人dots，了解Example owner的部分思路。以异步方式处理任务，完成后返回结果。",
  "capabilities": [
    {
      "id": "general-test-task",
      "description": "测试阶段受理不限类型的任务，不按摘要、问答、写作、分析或其他业务类型限制接待。拒绝涉及个人数据、隐私，以及读取或披露任何人的私人资料的任务。需要工具、文件或外部操作时，先核实当前可用能力与授权；条件不足应说明缺少什么，不得虚构执行。",
      "examples": [
        "完成一项不涉及个人数据或隐私的任务"
      ]
    }
  ],
  "exclusions": [
    "涉及个人数据或隐私的任务，包括个人健康资料、身份信息、联系方式、私人文件、聊天、邮件、账户凭据和未经授权的个人日历信息。"
  ],
  "startupRequirements": [
    {
      "id": "task-request",
      "label": "请说明任务及希望得到的结果，不提供个人数据或隐私资料。",
      "required": true,
      "kind": "TEXT"
    }
  ],
  "outputs": [
    "按任务要求返回文字结果，可分段、列出依据和不确定项；不强制三点或逐字摘录。"
  ],
  "acceptsFiles": false,
  "execution": {
    "mode": "NATIVE",
    "timeoutSeconds": 900
  }
};
