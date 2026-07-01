import { Logger } from "@spinejs/core";
import type { Envelope } from "@spinejs/gateway-core";
import { GatewayInterceptor } from "@spinejs/gateway-core";
import type { ElectronIpcBaseContext } from "./electron-ipc-base.types";
import type { IpcRoute } from "./electron-ipc.gateway";

/**
 * Logs every IPC dispatch at debug level: channel + serialised input on the way in,
 * channel + ok/error-code on the way out. Wire via `ElectronIpcGatewayModule.configure()`.
 *
 * Transport-specific: narrows the interceptor `Target` to `IpcRoute` so `route.address`
 * (the string channel) is available — a plain `DispatchTarget` carries no address.
 */
export class IpcLoggingInterceptor
  implements GatewayInterceptor<ElectronIpcBaseContext, string, IpcRoute>
{
  constructor(private readonly logger: Logger) {}

  async intercept(
    route: IpcRoute,
    _ctx: ElectronIpcBaseContext,
    rawInput: unknown,
    next: () => Promise<Envelope<unknown>>
  ): Promise<Envelope<unknown>> {
    this.logger.debug(
      `→ ${route.address} ${JSON.stringify(rawInput)}`,
      IpcLoggingInterceptor.name
    );
    const envelope = await next();
    const detail = envelope.ok ? "ok" : `error:${envelope.code}`;
    this.logger.debug(
      `← ${route.address} ${detail}`,
      IpcLoggingInterceptor.name
    );
    return envelope;
  }
}
