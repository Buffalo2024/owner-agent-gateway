// Historical deployed bridge reference; see ../README.md for dependencies and limits.
import type { Pool } from "pg";
export type BridgeState = {
  clients: Record<string, any>;
  tasks: Record<string, any>;
  requests: Record<string, any>;
  pairs: Record<string, any>;
  flows: Record<string, any>;
  codes: Record<string, any>;
  tokens: Record<string, any>;
  grants?: Record<string, any>;
  refreshTokens?: Record<string, any>;
  subscriptions: Record<string, any>;
  audit: any[];
};
export const emptyState = (): BridgeState => ({
  clients: {},
  tasks: {},
  requests: {},
  pairs: {},
  flows: {},
  codes: {},
  tokens: {},
  subscriptions: {},
  audit: [],
});
export interface BridgeStore {
  transact<T>(fn: (s: BridgeState) => T | Promise<T>): Promise<T>;
}
export class PostgresBridgeStore implements BridgeStore {
  constructor(private pool: Pool) {}
  async transact<T>(fn: (s: BridgeState) => T | Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query(
        "SELECT value FROM dots_bridge_state WHERE id=1 FOR UPDATE",
      );
      if (!r.rows[0]) throw Error("DOTS_MIGRATION_REQUIRED");
      const state = r.rows[0].value as BridgeState;
      const result = await fn(state);
      await c.query(
        "UPDATE dots_bridge_state SET value=$1,updated_at=now() WHERE id=1",
        [JSON.stringify(state)],
      );
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
// Test-only transactional adapter. Never selected by the deployed API.
export class MemoryBridgeStore implements BridgeStore {
  state = emptyState();
  private tail: Promise<unknown> = Promise.resolve();
  transact<T>(fn: (s: BridgeState) => T | Promise<T>): Promise<T> {
    const p = this.tail.then(async () => {
      const copy = structuredClone(this.state),
        result = await fn(copy);
      this.state = copy;
      return structuredClone(result);
    });
    this.tail = p.catch(() => {});
    return p;
  }
}
