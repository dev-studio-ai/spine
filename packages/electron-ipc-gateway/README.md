# @spinejs/electron-ipc-gateway

Electron IPC transport binding for `@spinejs/gateway`. Binds each `@Handler({ address })` to an `ipcMain.handle(address, …)` channel.

## What it provides

- **`ElectronIpcGateway`** — extends `Gateway`, implements `bind()` via `ipcMain.handle`.
- **`ZodValidator`** — `Validator` implementation backed by Zod (used by default).
- **`ElectronIpcBaseContext`** / **`ElectronIpcRaw`** — base types for context and raw call data.
- **`gatewayFeatureFactory`** / **`gatewayModuleDecorator`** helpers pre-bound to `ElectronIpcGateway` (via `electron-ipc-module.ts` convention — see below).

## Setup

### 1. Create the gateway module

Wire the three ports for your application:

```typescript
import { Module, InjectionToken, loggerToken, Logger } from "@spinejs/core";
import { ContextFactory, ErrorMapper, Validator } from "@spinejs/gateway";
import {
  ElectronIpcGateway,
  ElectronIpcRaw,
} from "@spinejs/electron-ipc-gateway";

const validatorToken = new InjectionToken<Validator>("validator");
const errorMapperToken = new InjectionToken<ErrorMapper<ErrorCode>>(
  "error-mapper"
);
const contextFactoryToken = new InjectionToken<
  ContextFactory<ElectronIpcRaw, AppContext>
>("context-factory");

@Module({
  imports: [SessionModule],
  providers: [
    { provide: validatorToken, factory: () => new ZodValidator() },
    { provide: errorMapperToken, factory: () => new AppErrorMapper() },
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
      factory: (v, e, c, l: Logger) => new ElectronIpcGateway(v, e, c, l),
    },
  ],
  exports: [ElectronIpcGateway],
})
export class ElectronIpcGatewayModule {}
```

### 2. Create the IPC helpers

```typescript
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

### 3. Write controllers

```typescript
import { Controller, Handler, UseGuards } from "@spinejs/gateway";
import { IpcModule } from "./infrastructure/electron-ipc-module";
import { SessionGuard } from "./infrastructure/session.guard";

@UseGuards(SessionGuard)
@Controller()
export class ProjectsController {
  @Handler({ address: "projects:list" })
  list(ctx: AppContext): Project[] {
    /* … */
  }

  @Handler({ address: "projects:create", input: CreateProjectSchema })
  create(ctx: AppContext, input: CreateProject): Project {
    /* … */
  }
}

@IpcModule({ controllers: [ProjectsController] })
export class ProjectsIpcModule {}
```

## Implementing the ports

### `ContextFactory`

```typescript
export class SessionContextFactory
  implements ContextFactory<ElectronIpcRaw, AppContext>
{
  constructor(private readonly sessionStore: SessionStore) {}

  create(raw: ElectronIpcRaw): AppContext {
    return { event: raw.event, session: this.sessionStore.current() };
  }
}
```

### `ErrorMapper`

```typescript
import {
  ErrorMapper,
  UnauthorizedError,
  ValidationError,
} from "@spinejs/gateway";

type ErrorCode = "UNAUTHORIZED" | "INVALID_INPUT" | "NOT_FOUND" | "SERVER";

export class AppErrorMapper implements ErrorMapper<ErrorCode> {
  toCode(err: unknown): ErrorCode {
    if (err instanceof UnauthorizedError) return "UNAUTHORIZED";
    if (err instanceof ValidationError) return "INVALID_INPUT";
    if (err instanceof NotFoundError) return "NOT_FOUND";
    return "SERVER";
  }
}
```

## Raw input convention

`ipcRenderer.invoke(channel, arg)` → `arg` passed as `rawInput`.  
`ipcRenderer.invoke(channel, a, b)` → `[a, b]` passed as `rawInput`.

Prefer a single object argument per call to keep schemas simple.

## Full docs

[apps/docs/docs/transports/electron-ipc](../../apps/docs/docs/transports/electron-ipc.md)
