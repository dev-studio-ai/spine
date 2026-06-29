import { Logger } from "@spinejs/core";
import type { Envelope, RouteDescriptor } from "@spinejs/gateway";
import { GatewayInterceptor } from "@spinejs/gateway";
import type { ElectronIpcBaseContext } from "./electron-ipc-base.types";

/**
 * Logs every IPC dispatch at debug level: channel + serialised input on the way in,
 * channel + ok/error-code on the way out. Wire via `ElectronIpcGatewayModule.configure()`.
 */
export class IpcLoggingInterceptor
  implements GatewayInterceptor<ElectronIpcBaseContext>
{
  constructor(private readonly logger: Logger) {}

  async intercept(
    route: RouteDescriptor<ElectronIpcBaseContext>,
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
