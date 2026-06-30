import type {
  ElectronIpcBaseContext,
  ElectronIpcRaw,
} from "@spinejs/electron-ipc-gateway";
import type { ContextFactory, ErrorMapper } from "@spinejs/gateway";

/**
 * The app's dispatch context: the transport's base context (the electron event) plus the caller's
 * identity, read from the IPC payload. The CLS interceptor seeds the request scope from this.
 */
export interface AppContext extends ElectronIpcBaseContext {
  user: string;
}

/** Builds one `AppContext` per IPC call, taking `user` from the payload (defaults to anonymous). */
export class AppContextFactory
  implements ContextFactory<ElectronIpcRaw, AppContext>
{
  create(raw: ElectronIpcRaw): AppContext {
    const [payload] = raw.args as [{ user?: string } | undefined];
    return { event: raw.event, user: payload?.user ?? "anonymous" };
  }
}

/** Minimal error mapper: turns any thrown error into its class name as a stable code. */
export class AppErrorMapper implements ErrorMapper<string> {
  toCode(err: unknown): string {
    return err instanceof Error ? err.name : "UNKNOWN";
  }
}
