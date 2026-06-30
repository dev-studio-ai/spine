import type { ModuleEntry } from "@spinejs/core";
import { ClsModule, ClsService } from "@spinejs/cls";
import {
  ElectronIpcGatewayModule,
  ipcFeature,
} from "@spinejs/electron-ipc-gateway";
import { AppContextFactory, AppErrorMapper } from "./app-context";
import { ClsInterceptor } from "./cls.interceptor";
import { AuditService } from "./audit.service";
import { WhoAmIController } from "./whoami.controller";

/**
 * Wiring. `ClsModule` is imported in BOTH the transport module (for the interceptor) and the feature
 * module (for `AuditService`). Because `ClsModule` is a single (non-`fresh`) module, both imports
 * share the same `ClsService` instance — the interceptor's `run()` and the service's `get()` use the
 * same `AsyncLocalStorage`, which is essential.
 */
export const modules: ModuleEntry[] = [
  ElectronIpcGatewayModule.configure({
    imports: [ClsModule],
    contextFactory: { value: new AppContextFactory() },
    errorMapper: { value: new AppErrorMapper() },
    interceptors: {
      inject: [ClsService],
      factory: (cls: ClsService) => [new ClsInterceptor(cls)],
    },
  }),
  ipcFeature({
    controllers: [WhoAmIController],
    providers: [AuditService],
    imports: [ClsModule],
  }),
];
