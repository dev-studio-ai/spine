import { AsyncLocalStorage } from "node:async_hooks";

/** A per-scope key→value store. Apps narrow it with their own keys. */
export type ClsStore = Record<string, unknown>;

/**
 * Continuation-Local Storage: the single owner of one `AsyncLocalStorage`, exposed as an injectable
 * singleton. `run()` opens a scope (one per request / dispatch / job); any code in that async call
 * chain reads and writes the same store through `get`/`set`, with nothing threaded through the
 * signatures. Two concurrent `run()`s get isolated stores — the binding is to the async execution
 * context, not to an instance — so the singleton stays shared while the data stays per-scope.
 *
 * Centralise the `AsyncLocalStorage` here: never instantiate one elsewhere. Consumers depend on this
 * service (or a typed wrapper over it), keeping the ambient access in one place.
 */
export class ClsService {
  private readonly als = new AsyncLocalStorage<ClsStore>();

  /** Opens a fresh scope seeded with a copy of `seed`, runs `fn` inside it, returns its result. */
  run<R>(seed: ClsStore, fn: () => R): R {
    return this.als.run({ ...seed }, fn);
  }

  /** True when called inside an active `run()` scope. */
  get active(): boolean {
    return this.als.getStore() !== undefined;
  }

  /** Reads a key from the active scope; `undefined` if absent or called outside any scope. */
  get<T>(key: string): T | undefined {
    return this.als.getStore()?.[key] as T | undefined;
  }

  /** Writes a key into the active scope. Throws outside a scope — there is nothing to write to. */
  set<T>(key: string, value: T): void {
    const store = this.als.getStore();
    if (!store) {
      throw new Error(
        `ClsService.set("${key}") called outside an active scope. Open one with run().`
      );
    }
    store[key] = value;
  }

  /** True when `key` exists in the active scope. */
  has(key: string): boolean {
    const store = this.als.getStore();
    return store !== undefined && key in store;
  }
}
