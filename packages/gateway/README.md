# @spinejs/gateway

Transport-agnostic request pipeline for SpineJS. Decouples controllers from the transport layer (IPC, HTTP, WebSocket, …).

## Pipeline

```
raw call → ContextFactory → Guards → Validator → Handler → Envelope → transport
```

Every handler returns `{ ok: true, data }` or `{ ok: false, code }`. The pipeline never throws — errors are caught and mapped to stable codes via `ErrorMapper`.

## Key exports

### Decorators

```typescript
import { Controller, Handler, UseGuards } from "@spinejs/gateway";

@UseGuards(SessionGuard) // applies to all handlers
@Controller()
export class UsersController {
  @Handler({ address: "users:list" })
  list(ctx: AppContext): User[] {
    /* … */
  }

  @Handler({ address: "users:create", input: CreateUserSchema })
  create(ctx: AppContext, input: CreateUser): User {
    /* … */
  }
}
```

Metadata is stored as own-property symbols — no `reflect-metadata`, safe under esbuild/swc.

### `Envelope<T, Code>`

```typescript
type Envelope<T, Code extends string = string> =
  | { ok: true; data: T }
  | { ok: false; code: Code };
```

### Ports (interfaces to implement per transport)

| Port                       | Responsibility                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| `ContextFactory<Raw, Ctx>` | Builds a typed context from raw transport data.                        |
| `Validator`                | Validates input against a schema; throws `ValidationError` on failure. |
| `ErrorMapper<Code>`        | Maps any error to a stable `Code` string.                              |

### `Guard<Ctx>`

```typescript
export class SessionGuard implements Guard<AppContext> {
  canActivate(ctx: AppContext): boolean {
    return ctx.session !== null;
  }
}
```

Guards are DI-resolved. Apply at class or method level with `@UseGuards`.

### Module sugar

```typescript
import {
  gatewayFeatureFactory,
  gatewayModuleDecorator,
} from "@spinejs/gateway";

// Bind to a concrete gateway and its module:
export const ipcFeature = gatewayFeatureFactory(MyGateway, MyGatewayModule);
export const IpcModule = gatewayModuleDecorator(MyGateway, MyGatewayModule);

// Usage:
ipcFeature({ controllers: [HealthController] }); // factory form
@IpcModule({ controllers: [UsersController] }) // decorator form
export class UsersIpcModule {}
```

### Error types

| Class               | When                                                           |
| ------------------- | -------------------------------------------------------------- |
| `ValidationError`   | Thrown by `Validator` — maps to an `INVALID_INPUT`-style code. |
| `UnauthorizedError` | Thrown by the pipeline when a guard returns `false`.           |

## Interceptors

Interceptors wrap every `dispatch()` call and are the right place for cross-cutting concerns: logging, metrics, tracing, auditing.

### `GatewayInterceptor<Ctx, Code>`

```typescript
import { GatewayInterceptor } from "@spinejs/gateway";

class LoggingInterceptor implements GatewayInterceptor {
  async intercept(route, ctx, rawInput, next) {
    console.debug("→", route.address, rawInput);
    const envelope = await next();
    console.debug("←", route.address, envelope.ok);
    return envelope;
  }
}
```

`next()` calls the remainder of the chain (the next interceptor, or the core pipeline). Interceptors are chained in registration order — the first registered interceptor is the outermost wrapper.

### Wiring via `ElectronIpcGatewayModule.configure()`

```typescript
ElectronIpcGatewayModule.configure({
  // …
  interceptors: {
    inject: [loggerToken],
    factory: (logger) => [new IpcLoggingInterceptor(logger)],
  },
});
```

`@spinejs/electron-ipc-gateway` ships `IpcLoggingInterceptor` ready to use.

## Extending `Gateway`

To add a new transport, extend `Gateway<Ctx, Code>` and implement `bind()`:

```typescript
import { Gateway, RouteDescriptor } from "@spinejs/gateway";

export class HttpGateway<Ctx, Code extends string> extends Gateway<Ctx, Code> {
  protected bind(route: RouteDescriptor<Ctx>): void {
    this.fastify.post(route.address, async (req, reply) => {
      const envelope = await this.dispatch(
        route,
        req.body,
        rawFromRequest(req)
      );
      reply.send(envelope);
    });
  }
}
```

## Full docs

[apps/docs/docs/gateway/](../../apps/docs/docs/gateway/)
