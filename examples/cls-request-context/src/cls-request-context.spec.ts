import { vi } from "vitest";
import type { Logger } from "@spinejs/core";

/**
 * Headless run: `electron` is mocked so the real `ElectronIpcGateway` binds its routes on a fake
 * `ipcMain`, and we replay IPC invokes by calling the captured listeners.
 */
const { ipcRegistry } = vi.hoisted(() => ({
  ipcRegistry: new Map<
    string,
    (event: unknown, ...args: unknown[]) => Promise<unknown>
  >(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => Promise<unknown>
    ) => ipcRegistry.set(channel, listener),
  },
}));

// Imported after the mock so the gateway picks up the fake ipcMain.
import { App } from "@spinejs/core";
import { createApp } from "./main";
import type { WhoAmIResult } from "./whoami.controller";

const silentLogger = {
  info() {},
  error() {},
  warn() {},
  debug() {},
  verbose() {},
  fatal() {},
  exit: async () => {},
} as unknown as Logger;

/** Simulates `ipcRenderer.invoke(channel, payload)`, unwrapping the envelope. */
async function invoke<T>(channel: string, payload: unknown): Promise<T> {
  const listener = ipcRegistry.get(channel);
  if (!listener) throw new Error(`No IPC handler registered for "${channel}".`);
  const envelope = (await listener({}, payload)) as
    | { ok: true; data: T }
    | { ok: false; code: string };
  if (!envelope.ok)
    throw new Error(`Dispatch "${channel}" failed: ${envelope.code}`);
  return envelope.data;
}

describe("CLS request context over the electron IPC gateway", () => {
  let app: App;

  beforeAll(async () => {
    app = createApp({ logger: silentLogger });
    await app.init(); // registers the "whoami" route on the fake ipcMain
  });

  afterAll(async () => {
    await app.stop();
  });

  it("gives each concurrent dispatch the right user via a shared singleton", async () => {
    const [alice, bob] = await Promise.all([
      invoke<WhoAmIResult>("whoami", { user: "alice" }),
      invoke<WhoAmIResult>("whoami", { user: "bob" }),
    ]);

    // The singleton AuditService saw the correct per-request user in each concurrent scope.
    expect(alice.user).toBe("alice");
    expect(bob.user).toBe("bob");

    // Each dispatch got its own reqId.
    expect(alice.reqId).not.toBe(bob.reqId);
  });

  it("defaults to anonymous when no user is supplied", async () => {
    const result = await invoke<WhoAmIResult>("whoami", {});
    expect(result.user).toBe("anonymous");
  });
});
