// Redacted deployed bridge reference (2026-10-06); see ../README.md for dependencies and limits.
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  publicHttp,
  validatePublicUrl,
  type PublicTransport,
} from "../../protocol-adapters/src/public-http.ts";
import { DotsBridgeService } from "./service.ts";
import type { BridgeState } from './store.ts';
import {
  BridgeError,
  object,
  requireThat,
  sha256Canonical,
} from "./contracts.ts";
function key(v: string) {
  requireThat(/^[a-f0-9]{64}$/i.test(v), "EVENT_KEY_NOT_CONFIGURED", 503);
  return Buffer.from(v, "hex");
}
export function encryptSecret(secret: string, k: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(k), iv),
    body = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}
export function decryptSecret(secret: string, k: string) {
  const b = Buffer.from(secret, "base64"),
    c = createDecipheriv("aes-256-gcm", key(k), b.subarray(0, 12));
  c.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString("utf8");
}
export function signingHeaders(
  secret: string,
  id: string,
  body: string,
  subscriptionId: string,
  at: number,
) {
  const timestamp = String(Math.floor(at / 1000)),
    sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${sig}`,
    "X-MCP-Subscription-Id": subscriptionId,
  };
}
export class DotsEvents {
  constructor(
    private service: DotsBridgeService,
    private encryptionKey: string,
    private transport: PublicTransport = publicHttp,
  ) {}
  private subscriptionId(s:BridgeState,p:any,v:any):string {
    const existing=p.grantId ? Object.values(s.subscriptions).find(sub=>sub.user===p.user && (!sub.grantId || sub.grantId===p.grantId) && sub.url===v.delivery.url) : undefined;
    return existing?.id ?? sha256Canonical({principal:p.grantId??p.id,url:v.delivery.url,name:v.name,arguments:v.arguments});
  }
  private params(v: any, unsubscribe = false) {
    object(
      v,
      ["name", "arguments", "delivery"],
      unsubscribe ? [] : ["cursor", "ttlMs"],
    );
    requireThat(v.name === "NEW_TASK_READY");
    object(v.arguments, []);
    object(v.delivery, ["mode", "url", ...(unsubscribe ? [] : ["secret"])]);
    requireThat(
      v.delivery.mode === "webhook" && typeof v.delivery.url === "string",
    );
    try {
      validatePublicUrl(v.delivery.url);
    } catch {
      throw new BridgeError("CALLBACK_URL_REJECTED");
    }
    if (!unsubscribe) {
      requireThat(v.cursor === undefined || v.cursor === null);
      const secret = v.delivery.secret;
      requireThat(
        typeof secret === "string" &&
          /^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret) &&
          Buffer.from(secret.slice(6), "base64").length >= 24 &&
          Buffer.from(secret.slice(6), "base64").length <= 64,
        "INVALID_WEBHOOK_SECRET",
      );
      requireThat(
        v.ttlMs === undefined ||
          v.ttlMs === null ||
          (Number.isFinite(v.ttlMs) && v.ttlMs > 0),
      );
    }
  }
  async subscribe(header: string, v: any) {
    this.params(v);
    key(this.encryptionKey);
    const p = await this.service.transaction((s) =>
      this.service.token(s, header),
    );
    const id = await this.service.transaction(s=>this.subscriptionId(s,p,v));
    const challenge = randomBytes(32).toString("base64url"),
      body = JSON.stringify({ type: "verification", challenge }),
      eventId = randomUUID();
    try {
      const r = await this.transport(v.delivery.url, {
        method: "POST",
        body,
        headers: signingHeaders(
          v.delivery.secret,
          eventId,
          body,
          id,
          this.service.now(),
        ),
      });
      console.info(JSON.stringify({event:'dots_callback_http',status:r.status,jsonResponse:Boolean(r.headers['content-type']?.includes('application/json'))}));
      const echoed = JSON.parse(r.text)?.challenge;
      console.info(JSON.stringify({event:'dots_callback_verification',status:r.status,challengeMatched:typeof echoed==='string'&&echoed===challenge}));
      requireThat(
        r.status >= 200 &&
          r.status < 300 &&
          typeof echoed === "string" &&
          Buffer.byteLength(echoed) === Buffer.byteLength(challenge) &&
          timingSafeEqual(Buffer.from(echoed), Buffer.from(challenge)),
        "CALLBACK_CHALLENGE_FAILED",
      );
    } catch (error) {
      const code=(error as any)?.code;
      const message=error instanceof Error?error.message:'';
      console.info(JSON.stringify({event:'dots_callback_verification_failed',reason:/^[A-Z_]{3,80}$/.test(message)?message:/^[A-Z_]{3,40}$/.test(code??'')?code:'CALLBACK_RESPONSE_INVALID'}));
      throw new BridgeError("CALLBACK_CHALLENGE_FAILED");
    }
    return this.service.transaction((s) => {
      const current = this.service.token(s, header);
      requireThat(current.id === p.id, "AUTH_REQUIRED", 401);
      const until = Math.min(
        current.grantId ? 253402300799000 : current.until,
        v.ttlMs === null && current.grantId ? 253402300799000 : this.service.now() + Math.min(v.ttlMs ?? 86400000, 86400000),
      );
      const old = s.subscriptions[id],
        encrypted = encryptSecret(v.delivery.secret, this.encryptionKey),
        rotated = Boolean(
          old &&
            decryptSecret(old.secret, this.encryptionKey) !== v.delivery.secret,
        );
      s.subscriptions[id] = {
        id,
        tokenHash: p.hash,
        ...(current.grantId ? { grantId:current.grantId } : {}),
        user: p.user,
        url: v.delivery.url,
        secret: encrypted,
        until,
        previous: rotated ? old.secret : old?.previous,
        previousUntil: rotated
          ? this.service.now() + 60000
          : (old?.previousUntil ?? 0),
      };
      return {
        id,
        refreshBefore: v.ttlMs === null && current.grantId ? null : new Date(until).toISOString(),
        cursor: null,
        truncated: false,
      };
    });
  }
  async unsubscribe(header: string, v: any) {
    this.params(v, true);
    return this.service.transaction((s) => {
      const p = this.service.token(s, header),
        id = this.subscriptionId(s,p,v);
      delete s.subscriptions[id];
      return {};
    });
  }
  async tick() {
    // Reserve work transactionally; never hold a DB transaction during network I/O.
    const jobs = await this.service.transaction((s) => {
      const now = this.service.now(),
        jobs: any[] = [];
      for (const t of Object.values(s.tasks)) {
        if (t.status !== "QUEUED" || !t.event) continue;
        if (now - t.event.createdAt >= 5 * 60000 && t.event.round < 3) {
          t.event = {
            id: randomUUID(),
            timestamp: new Date(now).toISOString(),
            createdAt: now,
            round: t.event.round + 1,
          };
          t.deliveries = {};
        }
        for (const sub of Object.values(s.subscriptions)) {
          const token = s.tokens[sub.tokenHash];
          const grant = sub.grantId ? s.grants?.[sub.grantId] : null;
          if (
            sub.user !== (t.executorOwner??t.owner) ||
            sub.until <= now ||
            (sub.grantId ? !grant || grant.revoked : !token || token.revoked || token.until <= now) ||
            !this.service.config.users.includes(sub.user)
          )
            continue;
          const delivery = t.deliveries[sub.id] ?? { attempts: 0, next: 0 };
          if (delivery.done || delivery.attempts >= 4 || delivery.next > now)
            continue;
          delivery.attempts++;
          delivery.next = now + 60000;
          t.deliveries[sub.id] = delivery;
          jobs.push({
            taskId: t.id,
            eventId: t.event.id,
            subscription: structuredClone(sub),
            event: {
              eventId: t.event.id,
              name: "NEW_TASK_READY",
              timestamp: t.event.timestamp,
              data: { taskId: t.id, schemaVersion: t.input.schemaVersion },
              cursor: null,
            },
          });
          if (jobs.length >= 10) return jobs;
        }
      }
      return jobs;
    });
    for (const job of jobs) {
      const active = await this.service.transaction((s) => {
        const sub = s.subscriptions[job.subscription.id],
          t = s.tasks[job.taskId],
          token = sub ? s.tokens[sub.tokenHash] : null;
        const grant = sub?.grantId ? s.grants?.[sub.grantId] : null;
        return sub &&
          sub.until > this.service.now() &&
          (sub.grantId ? grant && !grant.revoked : token && !token.revoked && token.until > this.service.now()) &&
          t?.status === "QUEUED" &&
          t.event.id === job.eventId
          ? structuredClone(sub)
          : null;
      });
      if (!active) continue;
      let status = 0;
      try {
        const sub = active,
          body = JSON.stringify(job.event),
          headers = signingHeaders(
            decryptSecret(sub.secret, this.encryptionKey),
            job.eventId,
            body,
            sub.id,
            this.service.now(),
          );
        if (sub.previous && sub.previousUntil > this.service.now())
          headers["webhook-signature"] +=
            " " +
            signingHeaders(
              decryptSecret(sub.previous, this.encryptionKey),
              job.eventId,
              body,
              sub.id,
              this.service.now(),
            )["webhook-signature"];
        status = (
          await this.transport(sub.url, { method: "POST", body, headers })
        ).status;
      } catch {
        /* Metadata only; never log secrets or event transport errors. */
      }
      await this.service.transaction((s) => {
        const t = s.tasks[job.taskId];
        if (t?.event?.id !== job.eventId) return;
        const d = t.deliveries[job.subscription.id];
        if (!d) return;
        d.lastStatus = status;
        d.done =
          (status >= 200 && status < 300) || status === 410 || status === 413;
        d.next = this.service.now() + Math.min(60000, 1000 * 2 ** d.attempts);
        if (status === 410) delete s.subscriptions[job.subscription.id];
        if (t.event.round === 3 && d.attempts >= 4 && !d.done)
          t.reason = "EVENT_DELIVERY_FAILED";
      });
    }
    return { processed: jobs.length };
  }
}
