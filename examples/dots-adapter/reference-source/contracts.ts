// Redacted deployed bridge reference (2026-10-06); see ../README.md for dependencies and limits.
import { sha256Canonical } from "../../protocol-adapters/src/canonical-json.ts";
export { sha256Canonical };
export class BridgeError extends Error {
  constructor(
    public code: string,
    public status = 422,
  ) {
    super(code);
  }
}
export function requireThat(
  ok: unknown,
  code = "INVALID_INPUT",
  status = 422,
): asserts ok {
  if (!ok) throw new BridgeError(code, status);
}
export function object(
  value: any,
  required: string[],
  optional: string[] = [],
) {
  requireThat(value && typeof value === "object" && !Array.isArray(value));
  requireThat(
    required.every((k) => Object.hasOwn(value, k)) &&
      Object.keys(value).every((k) => [...required, ...optional].includes(k)),
  );
}
export function uuid(value: any) {
  requireThat(
    typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
export const length = (s: string) => Array.from(s).length;
export const normalize = (s: string) =>
  s.normalize("NFC").replace(/\r\n?/g, "\n").trim();
export function requireSourceOnlyResult(text:string,result:{points:string[]}) {
  const source=normalize(text);
  requireThat(result.points.every(point=>length(normalize(point))>=8&&source.includes(normalize(point))),'RESULT_NOT_FROM_TASK_SOURCE');
}
export function risk(s: string) {
  return /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b|\b(?:sk-|Bearer\s|password\s*[:=]|api[_ -]?key\s*[:=])|密码\s*[:：]|身份证|(?:读取|泄露|披露|转发|克隆|导出).{0,20}(?:邮件|聊天记录|私人|记忆|git.{0,8}仓库|仓库.{0,8}(?:代码|凭据|记录))|忽略.{0,8}(?:规则|指令)/i.test(
    s,
  );
}
export function inputContract(v: any) {
  object(v, ["schemaVersion", "input"]);
  const general = v.schemaVersion === "public_task.v1";
  requireThat(general || v.schemaVersion === "public_text_summary.v1");
  object(v.input, ["text", "declaredPublic"], ["publicSourceLabel"]);
  requireThat(
    typeof v.input.text === "string" && v.input.declaredPublic === true,
  );
  const text = normalize(v.input.text);
  requireThat(length(text) >= (general ? 5 : 100) && length(text) <= 6000);
  if (v.input.publicSourceLabel !== undefined)
    requireThat(
      typeof v.input.publicSourceLabel === "string" &&
        length(v.input.publicSourceLabel) <= 200,
    );
  requireThat(
    Buffer.byteLength(JSON.stringify(v)) <= 32768,
    "REQUEST_BODY_TOO_LARGE",
    413,
  );
  requireThat(
    !risk(text + " " + (v.input.publicSourceLabel ?? "")),
    "INPUT_BOUNDARY_REJECTED",
  );
  return {
    schemaVersion: v.schemaVersion,
    input: {
      text,
      declaredPublic: true,
      ...(v.input.publicSourceLabel !== undefined
        ? { publicSourceLabel: normalize(v.input.publicSourceLabel) }
        : {}),
    },
  };
}
export function resultContract(v: any) {
  if(v?.schemaVersion==='public_task.result.v2') {
    object(v,['schemaVersion','taskId','inputHash','files'],['text','points']);uuid(v.taskId);
    requireThat(typeof v.inputHash==='string'&&/^[a-f0-9]{64}$/.test(v.inputHash),'RESULT_TASK_BINDING_INVALID');
    requireThat(Array.isArray(v.files)&&v.files.length<=8&&new Set(v.files).size===v.files.length&&v.files.every((x:any)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)),'RESULT_FILES_INVALID');
    requireThat(v.text===undefined||(typeof v.text==='string'&&length(v.text)<=20000&&!risk(v.text)),'RESULT_BOUNDARY_REJECTED');
    return {schemaVersion:v.schemaVersion,taskId:v.taskId,inputHash:v.inputHash,files:[...v.files] as string[],...(v.text?{text:normalize(v.text)}:{}),points:v.text?[normalize(v.text)]:[]};
  }
  object(v, ["schemaVersion", "points"]);
  const general = v.schemaVersion === "public_task.result.v1";
  requireThat(general || v.schemaVersion === "public_text_summary.result.v1");
  requireThat(
    Array.isArray(v.points) &&
      (general ? v.points.length >= 1 && v.points.length <= 30 : v.points.length === 3) &&
      v.points.every((p: any) => typeof p === "string"),
  );
  const points = v.points.map(normalize) as string[];
  requireThat(
    points.every((p) => length(p) > 0 && length(p) <= (general ? 4000 : 200)) &&
      points.reduce((n, p) => n + length(p), 0) <= (general ? 20000 : 500),
  );
  requireThat(
    points.every((p) => !risk(p) && !/<\/?[a-z][^>]*>/i.test(p)),
    "RESULT_BOUNDARY_REJECTED",
  );
  return { schemaVersion: v.schemaVersion, points };
}
const id = { type: "string", format: "uuid" };
const schema = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", properties, required, additionalProperties: false });
const attempt = { taskId: id, attemptId: id, leaseId: id };
const resultSchema = schema({
  taskId:id,inputHash:{type:"string",pattern:"^[a-f0-9]{64}$"},text:{type:"string",maxLength:20000},files:{type:"array",maxItems:8,items:{type:"string",pattern:"^[a-f0-9]{64}$"}},
  schemaVersion: { enum: ["public_text_summary.result.v1", "public_task.result.v1", "public_task.result.v2"] },
  points: {
    type: "array",
    minItems: 1,
    maxItems: 30,
    items: { type: "string", minLength: 1, maxLength: 4000 },
  },
},["schemaVersion"]);
export const tools = [
  {
    name: "claim_task",
    description:
      "领取已授权队列中的指定任务。任务不限业务类型；执行协议由 get_task 返回，不能按旧摘要规则拒绝一般任务。",
    inputSchema: schema({ taskId: id, claimRequestId: id }),
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  {
    name: "get_task",
    description:
      "读取已确认的任务需求、输出协议及隐私边界。public_task.v1 是一般任务，允许问答、比较、规划等，不要求提供待摘要原文；public_text_summary.v1 才要求原文摘要。",
    inputSchema: schema(attempt),
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_task_status",
    description: "读取受权任务状态及回写回执，不返回未审核候选正文。",
    inputSchema: schema({ taskId: id }),
    annotations: { readOnlyHint: true },
  },
  {
    name:"prepare_result_upload",
    description:"为当前有效任务获取一次任务绑定的文件上传地址。使用本任务生成的文件原始字节POST上传，再将回执artifactId放入public_task.result.v2.files；不能上传主人私人文件。单文件10MiB，最多8个。",
    inputSchema:schema(attempt),annotations:{readOnlyHint:false,idempotentHint:true},
  },
  {
    name: "submit_result",
    description: "提交符合 get_task 输出协议的候选结果，审核后展示。",
    inputSchema: schema(
      {
        ...attempt,
        submissionId: id,
        result: resultSchema,
        resultHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
      },
      ["taskId", "attemptId", "leaseId", "submissionId", "result"],
    ),
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  {
    name: "fail_task",
    description: "报告固定执行失败原因，服务器按额度决定重试，不改变任务范围。",
    inputSchema: schema({
      ...attempt,
      failureId: id,
      code: { enum: ["INPUT_UNUSABLE", "EXECUTION_ERROR"] },
    }),
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
].map((t) => ({
  ...t,
  securitySchemes: [{ type: "oauth2", scopes: ["dots.execute"] }],
  annotations: {
    ...t.annotations,
    destructiveHint: false,
    openWorldHint: false,
  },
}));
export const eventDefinition = {
  name: "NEW_TASK_READY",
  description: "已确认的非隐私任务待领取。根据任务 schemaVersion 和 get_task 的 outputContract 执行，不能默认当作摘要任务。",
  delivery: ["webhook"],
  inputSchema: schema({}),
  payloadSchema: schema({
    taskId: id,
    schemaVersion: { enum: ["public_text_summary.v1", "public_task.v1"] },
  }),
};
