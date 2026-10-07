// Redacted deployed bridge reference (2026-10-06); see ../README.md for dependencies and limits.
import { BridgeError, object, tools, eventDefinition } from "./contracts.ts";
import { DotsBridgeService } from "./service.ts";
import type { DotsEvents } from "./events.ts";
export async function dotsRpc(
  input: any,
  header: string,
  service: DotsBridgeService,
  events?: DotsEvents,
  protocolVersion = "2026-07-28",
) {
  const id = input?.id ?? null;
  if (
    !input ||
    Array.isArray(input) ||
    input.jsonrpc !== "2.0" ||
    typeof input.method !== "string" ||
    (input.id !== undefined &&
      typeof input.id !== "string" &&
      typeof input.id !== "number")
  )
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "INVALID_REQUEST" },
    };
  if (input.id === undefined) return null;
  // MCP transport metadata belongs to the protocol, not tool arguments.
  if (input.params && typeof input.params === "object" && !Array.isArray(input.params)) {
    const { _meta, ...params } = input.params;
    input = { ...input, params };
  }
  try {
    let result: any;
    if (input.method === "server/discover")
      result = {
        resultType: "complete",
        supportedVersions: ["2026-07-28"],
        capabilities: { tools: {}, ...(events ? { events: {} } : {}) },
        serverInfo: { name: "agent-dispatch-dots-reference", version: "1.0.0" },
      };
    else if (input.method === "initialize") {
      const version = input.params?.protocolVersion;
      if (!["2026-07-28", "2025-11-25", "2025-06-18"].includes(version))
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "MCP_VERSION_UNSUPPORTED" },
        };
      result = {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "agent-dispatch-dots-reference", version: "1.0.0" },
      };
    } else if (input.method === "ping") result = {};
    else if (input.method === "tools/list") {
      object(input.params ?? {}, []);
      result = { tools };
    } else if (input.method === "tools/call") {
      object(input.params, ["name", "arguments"]);
      if (!tools.some((t) => t.name === input.params.name))
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "UNKNOWN_TOOL" },
        };
      try {
        const value = await service.call(
          header,
          input.params.name,
          input.params.arguments,
        );
        result = {
          content: [{ type: "text", text: JSON.stringify(value) }],
          structuredContent: value,
          isError: false,
        };
      } catch (e) {
        if (!(e instanceof BridgeError)) throw e;
        result = {
          content: [
            { type: "text", text: JSON.stringify({ error: { code: e.code } }) },
          ],
          isError: true,
        };
      }
    } else if (input.method === "events/list" && events) {
      object(input.params ?? {}, []);
      result = { events: [eventDefinition] };
    } else if (input.method === "events/subscribe" && events)
      result = await events.subscribe(header, input.params);
    else if (input.method === "events/unsubscribe" && events)
      result = await events.unsubscribe(header, input.params);
    else
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "METHOD_NOT_SUPPORTED" },
      };
    // ChatGPT's MCP Events draft uses its own result shapes (no discriminator).
    if (protocolVersion === "2026-07-28" && !input.method.startsWith("events/")) result = { ...result, resultType: "complete" };
    return { jsonrpc: "2.0", id, result };
  } catch (e) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code:
          e instanceof BridgeError && e.code === "CALLBACK_CHALLENGE_FAILED"
            ? -32015
            : -32602,
        message: e instanceof BridgeError ? e.code : "REQUEST_FAILED",
        ...(e instanceof BridgeError && e.code === "CALLBACK_CHALLENGE_FAILED"
          ? { data: { reason: "challenge_failed" } }
          : {}),
      },
    };
  }
}
