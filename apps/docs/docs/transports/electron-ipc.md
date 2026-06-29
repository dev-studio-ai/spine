---
sidebar_position: 1
---

# Electron IPC Transport

`@spinejs/electron-ipc-gateway` provides the Electron IPC binding for `@spinejs/gateway`. It binds `Gateway.bind()` to `ipcMain.handle(address, ...)` so that every `@Handler({ address })` becomes a live IPC channel.

## `ElectronIpcGateway`

```typescript
class ElectronIpcGateway<
  Ctx extends ElectronIpcBaseContext = ElectronIpcBaseContext,
  Code extends string = string,
> extends Gateway<Ctx, Code>
```

The gateway is app-agnostic: it knows `ipcMain` and the Electron event, but nothing about sessions or users. App concerns are injected through the `ContextFactory` port.

### Constructor

```typescript
new ElectronIpcGateway(
  validator: Validator,
  errorMapper: ErrorMapper<Code>,
  contextFactory: ContextFactory<ElectronIpcRaw, Ctx>,
  logger: Logger,
)
```

The constructor is called via a factory provider — the class itself has no `@Inject` decorator, keeping it transport-generic.

### Types

```typescript
// Base context — always available.
interface ElectronIpcBaseContext extends GatewayContext {
  event: IpcMainInvokeEvent;
}

// Raw call data passed to the ContextFactory.
interface ElectronIpcRaw {
  event: IpcMainInvokeEvent;
  args: unknown[];
}
```

## What `ElectronIpcGatewayModule` provides

`ElectronIpcGatewayModule` is the transport module. It wires the three ports and produces the `ElectronIpcGateway` instance. You build it once per application and put all its app-specific adapters there.

Here is the reference implementation:

```typescript
import { Logger, loggerToken, Module, InjectionToken } from "@spinejs/core";
import { ContextFactory, ErrorMapper, Validator } from "@spinejs/gateway";
import { ElectronIpcGateway } from "@spinejs/electron-ipc-gateway";
import { ZodValidator } from "./zod.validator";
import { ElectronIpcErrorMapper } from "./electron-ipc-error.mapper";
import { SessionContextFactory } from "./session.context-factory";
import { SessionStore } from "../session";

const validatorToken = new InjectionToken<Validator>("validator");
const errorMapperToken = new InjectionToken<ErrorMapper<ErrorCode>>(
  "error-mapper"
);
const contextFactoryToken = new InjectionToken<
  ContextFactory<ElectronIpcRaw, ElectronIpcContext>
>("context-factory");

@Module({
  imports: [SessionModule],
  providers: [
    { provide: validatorToken, factory: () => new ZodValidator() },
    { provide: errorMapperToken, factory: () => new ElectronIpcErrorMapper() },
    {
      provide: contextFactoryToken,
      inject: [SessionStore],
      factory: (session: SessionStore) => new SessionContextFactory(session),
    },
    {
      provide: ElectronIpcGateway,
      inject: [
        validatorToken,
        errorMapperToken,
        contextFactoryToken,
        loggerToken,
      ],
      factory: (
        validator: ZodValidator,
        errorMapper: ElectronIpcErrorMapper,
        contextFactory: SessionContextFactory,
        logger: Logger
      ) =>
        new ElectronIpcGateway(validator, errorMapper, contextFactory, logger),
    },
  ],
  exports: [ElectronIpcGateway],
})
export class ElectronIpcGatewayModule {}
```

## Implementing the ports

### `ContextFactory` — enriching the context

The `ContextFactory` transforms the raw Electron event into a typed context your controllers receive:

```typescript
import { ContextFactory } from "@spinejs/gateway";
import { ElectronIpcRaw } from "@spinejs/electron-ipc-gateway";

export interface ElectronIpcContext extends ElectronIpcBaseContext {
  session: Session | null;
}

export class SessionContextFactory
  implements ContextFactory<ElectronIpcRaw, ElectronIpcContext>
{
  constructor(private readonly sessionStore: SessionStore) {}

  create(raw: ElectronIpcRaw): ElectronIpcContext {
    return {
      event: raw.event,
      session: this.sessionStore.current(),
    };
  }
}
```

### `ErrorMapper` — mapping errors to codes

The `ErrorMapper` converts any thrown error to a stable code string. No raw error message ever reaches the renderer:

```typescript
import {
  ErrorMapper,
  UnauthorizedError,
  ValidationError,
} from "@spinejs/gateway";

type ErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "SERVER"
  | "NETWORK";

export class ElectronIpcErrorMapper implements ErrorMapper<ErrorCode> {
  toCode(err: unknown): ErrorCode {
    if (err instanceof ValidationError) return "INVALID_INPUT";
    if (err instanceof UnauthorizedError) return "UNAUTHORIZED";
    if (err instanceof NotFoundError) return "NOT_FOUND";
    if (err instanceof TypeError) return "NETWORK";
    return "SERVER";
  }
}
```

## Creating the IPC helpers

Bind the generic gateway functions to your `ElectronIpcGateway` and `ElectronIpcGatewayModule`:

```typescript
// electron-ipc-module.ts
import {
  gatewayFeatureFactory,
  gatewayModuleDecorator,
} from "@spinejs/gateway";
import { ElectronIpcGateway } from "@spinejs/electron-ipc-gateway";
import { ElectronIpcGatewayModule } from "./electron-ipc-gateway.module";

export const ipcFeature = gatewayFeatureFactory(
  ElectronIpcGateway,
  ElectronIpcGatewayModule
);
export const IpcModule = gatewayModuleDecorator(
  ElectronIpcGateway,
  ElectronIpcGatewayModule
);
```

## The `SessionGuard`

A guard is how you enforce authentication on IPC channels. Since the `ContextFactory` already enriches the context with the session, the guard only needs to check:

```typescript
import { Guard } from "@spinejs/gateway";
import { ElectronIpcContext } from "./electron-ipc.types";

export class SessionGuard implements Guard<ElectronIpcContext> {
  canActivate(ctx: ElectronIpcContext): boolean {
    return ctx.session !== null;
  }
}
```

Apply it to all handlers that require authentication:

```typescript
import { UseGuards } from "@spinejs/gateway";
import { SessionGuard } from "../infrastructure/session.guard";

@UseGuards(SessionGuard)
@Controller()
export class SecureController {
  @Handler({ address: "secure:data" })
  getData(ctx: ElectronIpcContext): Data {
    // Guaranteed: ctx.session is not null.
    return this.dataService.getForUser(ctx.session.userId);
  }
}
```

## Full application example

```typescript
// main.ts
import { App } from "@spinejs/core";
import { ElectronModule } from "@spinejs/electron";
import { ConfigModule } from "@spinejs/config";
import { MainModule } from "./modules/main.module";

const app = new App(
  [
    ConfigModule.configure({ configs: [appConfig] }),
    ElectronModule.configure({
      window: {
        width: 1280,
        height: 800,
        webPreferences: {
          preload: join(__dirname, "preload.js"),
          contextIsolation: true,
        },
      },
      devUrl: "http://localhost:5173",
      packagePath: join(__dirname, "../renderer/index.html"),
    }),
    MainModule,
  ],
  { handleProcessExit: false }
);

await app.init();
await app.start();
```

```typescript
// main.module.ts
import { Module, OnInit } from "@spinejs/core";
import { ElectronModule } from "@spinejs/electron";
import { ipcFeature, IpcModule } from "./infrastructure/electron-ipc-module";
import { AuthController } from "./interface/auth.controller";
import { ProjectsController } from "./interface/projects.controller";
import { HealthController } from "./interface/health.controller";
import { ProjectsModule } from "./domain/projects.module";
import { AuthModule } from "./domain/auth.module";

@Module({
  imports: [
    ElectronModule,
    AuthModule,
    ProjectsModule,
    // Factory form — inline, no named class:
    ipcFeature({ controllers: [HealthController] }),
    // Decorator form — named module:
    ProjectsIpcModule,
    AuthIpcModule,
  ],
  inject: [ElectronModule],
})
export class MainModule implements OnInit {
  constructor(private readonly electronModule: ElectronModule) {}

  async onInit(): Promise<void> {
    this.electronModule.createMainWindow();
  }
}
```

## Raw input normalization

When `ipcRenderer.invoke(channel, arg1)` sends a single argument, the gateway passes `arg1` directly as `rawInput`. When multiple arguments are sent (`ipcRenderer.invoke(channel, arg1, arg2)`), they are passed as an array `[arg1, arg2]`. Your schema and handler should be designed accordingly.

:::tip Single-argument convention
Stick to a single object argument per IPC call. This maps cleanly to a zod object schema and avoids the array ambiguity. For example: `ipcRenderer.invoke('users:create', { name: 'Alice', email: 'alice@example.com' })`.
:::
