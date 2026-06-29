import { ipcMain } from 'electron';
import { Logger } from '@spinejs/core';
import {
  ContextFactory,
  ErrorMapper,
  Gateway,
  GatewayInterceptor,
  RouteDescriptor,
  Validator,
} from '@spinejs/gateway';
import { ElectronIpcBaseContext, ElectronIpcRaw } from './electron-ipc-base.types';

/**
 * Generic electron IPC transport binding of the `Gateway`. App-agnostic: it knows only `ipcMain`
 * and the electron event — the context (session, user…) is built by an injected `ContextFactory`,
 * so nothing app-specific (SessionStore, UserProfile) leaks in. Constructed via a factory provider
 * (no `@Inject`) so the class stays free of DI-token identity — ready to lift into its own lib.
 */
export class ElectronIpcGateway<
  Ctx extends ElectronIpcBaseContext = ElectronIpcBaseContext,
  Code extends string = string,
> extends Gateway<Ctx, Code> {
  constructor(
    validator: Validator,
    errorMapper: ErrorMapper<Code>,
    private readonly contextFactory: ContextFactory<ElectronIpcRaw, Ctx>,
    private readonly logger: Logger,
    interceptors: GatewayInterceptor<Ctx, Code>[] = [],
  ) {
    super(validator, errorMapper, interceptors);
  }

  protected bind(route: RouteDescriptor<Ctx>): void {
    this.logger.debug(`Register IPC route ${route.address}.`, ElectronIpcGateway.name);

    ipcMain.handle(route.address, async (event, ...args) => {
      const ctx = this.contextFactory.create({ event, args });
      const rawInput = args.length > 1 ? args : args[0];
      const envelope = await this.dispatch(route, ctx, rawInput);
      if (!envelope.ok) {
        this.logger.debug(
          `IPC route ${route.address} failed: ${envelope.code}`,
          ElectronIpcGateway.name,
        );
      }
      return envelope;
    });
  }
}
