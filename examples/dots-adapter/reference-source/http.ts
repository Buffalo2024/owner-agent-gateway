// Historical deployed bridge reference; see ../README.md for dependencies and limits.
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import type { NativeAccessService } from "../../native-access/src/index.ts";
import { BridgeError, requireThat } from "./contracts.ts";
import { DotsBridgeService, OAUTH_FLOW_TTL_MS } from "./service.ts";
import { PostgresBridgeStore } from "./store.ts";
import { DotsEvents } from "./events.ts";
import { localProxyTransport } from "./local-proxy.ts";
import { dotsRpc } from "./rpc.ts";
import { DotsPlatformAgent } from "./platform-agent.ts";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function readBridgeBody(req: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const x of req) {
    const b = Buffer.from(x);
    size += b.length;
    requireThat(size <= 32768, "REQUEST_BODY_TOO_LARGE", 413);
    chunks.push(b);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    if (
      String(req.headers["content-type"]).startsWith(
        "application/x-www-form-urlencoded",
      )
    ) {
      const p = new URLSearchParams(raw);
      requireThat([...p.keys()].length === new Set(p.keys()).size);
      return Object.fromEntries(p);
    }
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    if (e instanceof BridgeError) throw e;
    throw new BridgeError("INVALID_JSON", 400);
  }
}
function json(res: ServerResponse, status: number, value: any) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
function page(res: ServerResponse, status: number, content: string, redirectUri?: string) {
  const nonce = randomBytes(18).toString("base64");
  const callbackSource = redirectUri ? new URL(redirectUri).origin + new URL(redirectUri).pathname.replace(/[;\s']/g, c => encodeURIComponent(c)) : "";
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "same-origin",
    "content-security-policy":
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action 'self' ${callbackSource}; frame-ancestors 'none'; base-uri 'none'`,
  });
  res.end(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent Dispatch 任务授权</title><style>body{font:17px/1.6 system-ui;background:#f3f7fb;color:#142b40;margin:0}main{max-width:560px;margin:48px auto;padding:28px;background:white;border-radius:20px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;margin:12px 0}button{background:#087e79;color:white;border:0;border-radius:10px}label{display:block;word-break:break-all}</style><main>${content}</main><script nonce="${nonce}">const form=document.querySelector("form");if(form)form.addEventListener("submit",()=>{const button=form.querySelector("button");button.disabled=true;button.textContent="正在连接，请稍候…";});</script></html>`,
  );
}
export function createDotsRouter(
  pool: Pool,
  native: NativeAccessService,
  base: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const enabled = env.DOTS_BRIDGE_ENABLED === "true",
    resource = base + "/v1/dots/mcp";
  const users = JSON.parse(env.DOTS_TEST_USERS_JSON ?? "[]");
  requireThat(
    Array.isArray(users) && users.every((u) => typeof u === "string"),
    "DOTS_CONFIG_INVALID",
    503,
  );
  const clients = JSON.parse(env.DOTS_OAUTH_CLIENTS_JSON ?? "{}");
  if (enabled) {
    requireThat(
      new URL(base).protocol === "https:" ||
        ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
      "DOTS_HTTPS_REQUIRED",
      503,
    );
    for (const c of Object.values(clients) as any[])
      requireThat(
        Array.isArray(c.redirectUris) &&
          c.redirectUris.every(
            (u: any) =>
              typeof u === "string" &&
              (new URL(u).protocol === "https:" ||
                ["127.0.0.1", "localhost"].includes(new URL(u).hostname)),
          ),
        "DOTS_CONFIG_INVALID",
        503,
      );
  }
  const redirectUris = JSON.parse(env.DOTS_OAUTH_REDIRECT_URIS_JSON ?? "[]");
  requireThat(
    Array.isArray(redirectUris) &&
      redirectUris.every(
        (u: any) => typeof u === "string" && new URL(u).protocol === "https:",
      ),
    "DOTS_CONFIG_INVALID",
    503,
  );
  const service = new DotsBridgeService(new PostgresBridgeStore(pool), {
    users,
    resource,
    clients,
    redirectUris,
    persistentAuthorization: env.DOTS_OAUTH_PERSISTENT === 'true',
    publicExecution: env.DOTS_PUBLIC_EXECUTION_ENABLED === 'true',
    executorUserId: env.DOTS_EXECUTOR_OWNER_USER_ID,
  });
  const events =
    enabled && env.DOTS_EVENTS_ENABLED === "true"
      ? new DotsEvents(service, env.DOTS_EVENT_ENCRYPTION_KEY ?? "", env.DOTS_CALLBACK_PROXY_URL ? localProxyTransport(env.DOTS_CALLBACK_PROXY_URL) : undefined)
      : undefined;
  const issuer = new URL(base).origin;
  const platformAgent = env.DOTS_PLATFORM_AGENT_ENABLED === 'true' ? new DotsPlatformAgent(service, {
    owner:env.DOTS_EXECUTOR_OWNER_USER_ID??'',secret:env.DOTS_PLATFORM_AGENT_SECRET??'',
    encryptionKey:env.DOTS_EVENT_ENCRYPTION_KEY??'',endpointBase:base+'/v1/dots/agent',callbackOrigin:new URL(base).origin,
  }) : undefined;
  const challenge = `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/v1/dots/mcp", error="invalid_token", error_description="Connect your authorized test account"`;
  const user = async (req: IncomingMessage) => {
    const p = await native.authenticate(
      String(req.headers.authorization ?? ""),
    );
    native.scope(p, "native.client");
    service.allowed(p.userId);
    return p;
  };
  const internal = (req: IncomingMessage) =>
    requireThat(
      Boolean(env.INTERNAL_API_TOKEN) &&
        req.headers["x-internal-token"] === env.INTERNAL_API_TOKEN,
      "AUTH_REQUIRED",
      401,
    );
  return {
    service,
    events,
    platformAgent,
    async handle(req: IncomingMessage, res: ServerResponse, url: URL) {
      const path = url.pathname;
      if (
        !path.startsWith("/v1/dots") &&
        !path.startsWith("/internal/v1/dots") &&
        ![
          "/.well-known/oauth-protected-resource/v1/dots/mcp",
          "/.well-known/oauth-authorization-server",
          "/dots/oauth/authorize",
          "/dots/oauth/token",
          "/dots/oauth/register",
        ].includes(path)
      )
        return false;
      try {
        if (!enabled) {
          json(res, 404, { error: { code: "DOTS_BRIDGE_DISABLED" } });
          return true;
        }
        res.setHeader("cache-control", "no-store");
        res.setHeader("x-request-id", randomUUID());
        if (['/v1/dots/agent/runs','/v1/dots/agent/v1/platform/handshake','/v1/dots/agent/v1/platform/connection-test'].includes(path) && req.method === 'POST' && platformAgent) {
          const chunks:Buffer[]=[];let size=0;
          for await (const x of req) { const b=Buffer.from(x);size+=b.length;requireThat(size<=32768,'REQUEST_BODY_TOO_LARGE',413);chunks.push(b); }
          const raw=Buffer.concat(chunks).toString('utf8');
          if(path.endsWith('/handshake')||path.endsWith('/connection-test')) {
            const handshake=path.endsWith('/handshake');
            const header=handshake?'x-gsj-handshake-signature':'x-gsj-connection-signature';
            const signed=handshake?platformAgent.handshake(raw,String(req.headers[header]??'')):await platformAgent.connectionTest(raw,String(req.headers[header]??''));
            res.writeHead(200,{'content-type':'application/json',[header]:signed.signature});res.end(signed.raw);return true;
          }
          platformAgent.authenticate(String(req.headers['x-gongshengji-timestamp']??''),String(req.headers['x-gongshengji-signature']??''),raw);
          let request:any;try {request=JSON.parse(raw);} catch {throw new BridgeError('INVALID_JSON',400);}
          json(res,202,await platformAgent.start(request));return true;
        }
        const artifactPath=path.match(/^\/v1\/dots\/agent\/artifacts\/([0-9a-f-]{36})$/);
        if (artifactPath && req.method==='GET' && platformAgent) {
          const bytes=await platformAgent.artifact(artifactPath[1],url.searchParams.get('token')??'');
          res.writeHead(200,{'content-type':'text/plain; charset=utf-8','content-length':bytes.length,'x-content-type-options':'nosniff'});res.end(bytes);return true;
        }
        if (
          path === "/.well-known/oauth-protected-resource/v1/dots/mcp" &&
          req.method === "GET"
        ) {
          json(res, 200, {
            resource,
            authorization_servers: [issuer],
            scopes_supported: ["dots.execute"],
            bearer_methods_supported: ["header"],
          });
          return true;
        }
        if (
          path === "/.well-known/oauth-authorization-server" &&
          req.method === "GET"
        ) {
          json(res, 200, {
            issuer,
            authorization_endpoint: base + "/dots/oauth/authorize",
            token_endpoint: base + "/dots/oauth/token",
            response_types_supported: ["code"],
            grant_types_supported: env.DOTS_OAUTH_PERSISTENT === 'true' ? ["authorization_code", "refresh_token"] : ["authorization_code"],
            token_endpoint_auth_methods_supported: ["none"],
            code_challenge_methods_supported: ["S256"],
            scopes_supported: ["dots.execute"],
            ...(redirectUris.length
              ? { registration_endpoint: base + "/dots/oauth/register" }
              : {}),
            authorization_response_iss_parameter_supported: true,
          });
          return true;
        }
        if (path === "/dots/oauth/authorize") {
          if (req.method === "GET") {
            requireThat(
              [...url.searchParams.keys()].length ===
                new Set(url.searchParams.keys()).size,
              "OAUTH_REQUEST_INVALID",
              400,
            );
            const { flow, clientId } = await service.begin(
              Object.fromEntries(url.searchParams),
            );
            res.setHeader(
              "set-cookie",
              `dots_flow=${flow}; HttpOnly; SameSite=Strict; Path=/dots/oauth/authorize; Max-Age=${OAUTH_FLOW_TTL_MS / 1000}${new URL(base).protocol === "https:" ? "; Secure" : ""}`,
            );
            page(
              res,
              200,
              `<h1>授权公开摘要测试</h1><p>连接客户端：${escape(clientId)}</p><p>允许此连接领取你已审核的测试任务，并提交候选摘要。${env.DOTS_OAUTH_PERSISTENT === "true" ? "授权持续有效至你主动撤销；访问令牌自动续期，可在小程序或本机关闭。" : "授权有效期 24 小时，可在小程序撤销。"}</p><p>在小程序“我的 → 执行端连接管理”点击“生成授权码”，输入下方。首次连接需先核对并绑定主人平台账号。本授权页面有效期 15 分钟；授权码由服务器生成，5 分钟有效、仅可使用一次；无需预先设置。不要把授权码发送到聊天。</p><form method="post"><input type="hidden" name="flow" value="${escape(flow)}"><label for="pair">一次性授权码</label><input id="pair" name="pair" autocomplete="off" required maxlength="32"><button type="submit">同意并连接</button></form>`,
              url.searchParams.get("redirect_uri")!,
            );
            return true;
          }
          if (req.method === "POST") {
            requireThat(
              !req.headers.origin ||
                req.headers.origin === new URL(base).origin,
              "ORIGIN_NOT_ALLOWED",
              403,
            );
            const v = await readBridgeBody(req);
            requireThat(
              Object.keys(v).every((k) => ["flow", "pair"].includes(k)) &&
                typeof v.flow === "string" &&
                typeof v.pair === "string",
              "OAUTH_APPROVAL_INVALID",
              400,
            );
            requireThat(
              String(req.headers.cookie ?? "")
                .split(";")
                .some((x) => x.trim() === `dots_flow=${v.flow}`),
              "OAUTH_SESSION_EXPIRED",
              400,
            );
            const redirect = await service.consent(v.flow, v.pair);
            res.writeHead(303, {
              location: redirect,
              "set-cookie":
                "dots_flow=; HttpOnly; SameSite=Strict; Path=/dots/oauth/authorize; Max-Age=0",
            });
            res.end();
            return true;
          }
        }
        if (path === "/dots/oauth/register" && req.method === "POST") {
          json(res, 201, await service.register(await readBridgeBody(req)));
          return true;
        }
        if (path === "/dots/oauth/token" && req.method === "POST") {
          json(res, 200, await service.exchange(await readBridgeBody(req)));
          return true;
        }
        if (path === "/v1/dots/mcp") {
          if (req.headers.origin && req.headers.origin !== new URL(base).origin)
            throw new BridgeError("ORIGIN_NOT_ALLOWED", 403);
          if (req.method === "GET" || req.method === "DELETE") {
            json(res, 405, { error: { code: "STATELESS_POST_ONLY" } });
            return true;
          }
          requireThat(req.method === "POST", "METHOD_NOT_ALLOWED", 405);
          const v = await readBridgeBody(req),
            header = String(req.headers.authorization ?? "");
          // Protocol diagnostics only: never log arguments, headers, or tokens.
          res.once("finish", () => console.info(JSON.stringify({
            event: "dots_mcp_request", method: typeof v?.method === "string" ? v.method.slice(0, 80) : "invalid",
            protocolVersion: typeof v?.params?.protocolVersion === "string" ? v.params.protocolVersion.slice(0, 30) : String(req.headers["mcp-protocol-version"] ?? "absent"),
            status: res.statusCode,
          })));
          if (
            ![
              "server/discover",
              "initialize",
              "ping",
              "tools/list",
              "events/list",
              "notifications/initialized",
            ].includes(v?.method)
          ) {
            try {
              await service.transaction((s) => service.token(s, header));
            } catch (e) {
              res.setHeader("www-authenticate", challenge);
              throw e;
            }
          }
          const version = String(
            req.headers["mcp-protocol-version"] ?? "2026-07-28",
          );
          requireThat(
            ["2026-07-28", "2025-11-25", "2025-06-18"].includes(version),
            "MCP_VERSION_UNSUPPORTED",
            400,
          );
          requireThat(
            !String(v?.method ?? "").startsWith("events/") ||
              version === "2026-07-28",
            "MCP_VERSION_UNSUPPORTED",
            400,
          );
          const result = await dotsRpc(v, header, service, events, version);
          console.info(JSON.stringify({event:'dots_mcp_outcome',method:typeof v?.method==='string'?v.method.slice(0,80):'invalid',rpcErrorCode:result?.error?.code??null,subscriptionCreated:v?.method==='events/subscribe'&&Boolean(result?.result?.id)}));
          res.setHeader("MCP-Protocol-Version", version);
          if (result === null) {
            res.writeHead(202);
            res.end();
          } else json(res, 200, result);
          return true;
        }
        if (
          path === "/internal/v1/dots/intakes" ||
          path.endsWith("/intake-decision")
        ) {
          requireThat(
            Boolean(env.DOTS_INTAKE_AGENT_TOKEN) &&
              req.headers.authorization ===
                "Bearer " + env.DOTS_INTAKE_AGENT_TOKEN,
            "AUTH_REQUIRED",
            401,
          );
          if (path === "/internal/v1/dots/intakes" && req.method === "GET") {
            json(res, 200, await service.intakes());
            return true;
          }
          const decision = path.match(
            /^\/internal\/v1\/dots\/tasks\/([^/]+)\/intake-decision$/,
          );
          if (decision && req.method === "POST") {
            json(
              res,
              200,
              await service.intakeDecision(
                decision[1],
                await readBridgeBody(req),
              ),
            );
            return true;
          }
          json(res, 405, { error: { code: "METHOD_NOT_ALLOWED" } });
          return true;
        }
        if (path.startsWith("/internal/v1/dots")) {
          internal(req);
          if (path === "/internal/v1/dots/reviews" && req.method === "GET") {
            json(res, 200, await service.reviewList());
            return true;
          }
          const review = path.match(
            /^\/internal\/v1\/dots\/tasks\/([^/]+)\/review$/,
          );
          if (review && req.method === "POST") {
            json(
              res,
              200,
              await service.review(
                review[1],
                await readBridgeBody(req),
                "internal-reviewer",
              ),
            );
            return true;
          }
        } else {
          const p = await user(req);
          if (path === "/v1/dots/tasks" && req.method === "POST") {
            json(
              res,
              202,
              await service.create(
                p,
                String(req.headers["idempotency-key"] ?? ""),
                await readBridgeBody(req),
              ),
            );
            return true;
          }
          if (path === "/v1/dots/tasks" && req.method === "GET") {
            json(res, 200, await service.list(p));
            return true;
          }
          if (path === "/v1/dots/pairing" && req.method === "POST") {
            json(res, 201, await service.pair(p));
            return true;
          }
          if (path === "/v1/dots/connections" && req.method === "GET") {
            json(res, 200, await service.connections(p));
            return true;
          }
          const connection = path.match(/^\/v1\/dots\/connections\/([^/]+)$/);
          if (connection && req.method === "DELETE") {
            json(res, 200, await service.revoke(p, connection[1]));
            return true;
          }
          const task = path.match(
            /^\/v1\/dots\/tasks\/([^/]+)(?:\/(result|cancel|input))?$/,
          );
          if (task) {
            if (req.method === "GET" && (!task[2] || task[2] === "result")) {
              json(
                res,
                200,
                await service.read(p, task[1], task[2] === "result"),
              );
              return true;
            }
            if (req.method === "POST" && task[2] === "cancel") {
              json(
                res,
                200,
                await service.cancel(p, task[1], await readBridgeBody(req)),
              );
              return true;
            }
            if (req.method === "PUT" && task[2] === "input") {
              json(
                res,
                202,
                await service.clarify(p, task[1], await readBridgeBody(req)),
              );
              return true;
            }
          }
        }
        json(res, 404, { error: { code: "NOT_FOUND" } });
        return true;
      } catch (e) {
        const code =
            e instanceof BridgeError
              ? e.code
              : e instanceof Error && e.message === "NATIVE_AUTH_REQUIRED"
                ? "AUTH_REQUIRED"
                : "BRIDGE_UNAVAILABLE",
          status =
            e instanceof BridgeError
              ? e.status
              : code === "AUTH_REQUIRED"
                ? 401
                : 503;
        if (status === 429) res.setHeader("retry-after", "60");
        if (path === "/dots/oauth/authorize" && status === 400) {
          const messages: Record<string, string> = {
            OAUTH_SESSION_EXPIRED: "授权页面已过期或浏览器未保留连接会话。请重新打开授权页面，再生成新的授权码。",
            OAUTH_FLOW_EXPIRED: "授权页面已过期。请重新打开授权页面，再生成新的授权码。",
            OAUTH_PAIRING_INVALID: "授权码已过期、已被使用、被新码替换或输入有误。请在小程序重新生成，完整复制后于 5 分钟内提交。",
            OAUTH_APPROVAL_INVALID: "授权表单不完整，请重新打开授权页面。",
          };
          const restart = url.search ? `<p><a href="${escape(url.pathname + url.search)}">重新打开授权页面</a></p>` : "";
          page(res, status, `<h1>连接尚未完成</h1><p>${escape(messages[code] ?? "授权请求无效，请返回客户端重新发起连接。")}</p>${restart}<p>错误码：${escape(code)}</p><p>请求编号：${escape(String(res.getHeader("x-request-id")))}</p>`);
          return true;
        }
        if (path === "/dots/oauth/token")
          json(res, status, {
            error: code === "invalid_grant" ? code : "invalid_request",
          });
        else
          json(res, status, {
            error: { code, retryable: status === 503 },
            requestId: res.getHeader("x-request-id"),
          });
        return true;
      }
    },
  };
}
