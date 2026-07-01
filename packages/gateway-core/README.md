# @spinejs/gateway-core

Transport-agnostic request pipeline for SpineJS. Decouples your controllers from the transport layer (IPC, HTTP, WebSocket, …).

This package ships **building blocks**, not a base class. A concrete transport — [`@spinejs/http-gateway`](../http-gateway), [`@spinejs/electron-ipc-gateway`](../electron-ipc-gateway) — **composes** these blocks. You usually consume it through a transport, not directly.

## What you write

Controllers are plain classes; routes are **instance fields** built by a transport's typed helpers (`get`/`post`/… for HTTP, `handle` for IPC), imported straight from the transport package. No transport details leak into the controller:

```typescript
import { z } from "zod";
import { Controller } from "@spinejs/gateway-core";
import { get, post } from "@spinejs/http-gateway";

@Controller({ inject: [UsersStore] })
export class UsersController {
  constructor(private readonly users: UsersStore) {}

  // input is inferred from the schema; the same controller works over HTTP or IPC.
  list = get("/users", {}, () => this.users.list());
  create = post(
    "/users",
    { body: z.object({ name: z.string().min(1) }), successStatus: 201 },
    ({ body }) => this.users.create(body.name)
  );
}
```

The helper is a function call (not a decorator) so it can **infer** the handler's `input` type from the schema — one source of truth, checked at compile time, no `reflect-metadata`. Metadata is stored as own-property symbols, safe under esbuild/swc.

## The pipeline

```
raw call → ContextFactory → Guards → Validator → Handler → Envelope → transport
```

Every handler returns its value; the pipeline wraps it as `{ ok: true, data }` or, on any thrown error, `{ ok: false, code }`. It **never throws** — errors are mapped to stable codes via `ErrorMapper`.

```typescript
type Envelope<T, Code extends string = string> =
  | { ok: true; data: T }
  | { ok: false; code: Code };
```

## Guards

A guard is a class with `canActivate()`. Return `false` (or throw) to reject. Apply with `@UseGuards` on a controller, or per-route via the `guards` option:

```typescript
import { Guard, Controller, UseGuards } from "@spinejs/gateway-core";

export class SessionGuard implements Guard<AppContext> {
  canActivate(ctx: AppContext): boolean {
    return ctx.session !== null;
  }
}

@UseGuards(SessionGuard) // applies to every route on the controller
@Controller()
export class SecureController {
  /* … */
}
```

Guards are DI-resolved from the feature module's container.

## Interceptors

Interceptors wrap every `dispatch()` — the place for logging, metrics, tracing, auditing. Write an object with `intercept()` that calls `next()`:

```typescript
import { GatewayInterceptor } from "@spinejs/gateway-core";

class LoggingInterceptor implements GatewayInterceptor {
  async intercept(route, ctx, rawInput, next) {
    console.debug("→", route.address, rawInput);
    const envelope = await next();
    console.debug("←", route.address, envelope.ok);
    return envelope;
  }
}
```

Chained in registration order — the first registered is the outermost wrapper. Register them through the transport module's `configure({ interceptors })`.

## Feature-module sugar

Bind the generic helpers once to a concrete gateway + its module to get app-specific registration helpers:

```typescript
import {
  gatewayFeatureFactory,
  gatewayModuleDecorator,
} from "@spinejs/gateway-core";

export const httpFeature = gatewayFeatureFactory(MyGateway, MyGatewayModule);
export const HttpModule = gatewayModuleDecorator(MyGateway, MyGatewayModule);

httpFeature({ controllers: [HealthController] }); // factory form
@HttpModule({ controllers: [UsersController] }) // decorator form
export class UsersModule {}
```

## Reference

### Ports (implement one set per transport)

| Port                       | Responsibility                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| `ContextFactory<Raw, Ctx>` | Builds a typed context from raw transport data.                        |
| `Validator`                | Validates input against a schema; throws `ValidationError` on failure. |
| `ErrorMapper<Code>`        | Maps any error to a stable `Code` string.                              |

### Error types

| Class               | When                                                          |
| ------------------- | ------------------------------------------------------------- |
| `ValidationError`   | Thrown by `Validator` — map to an `INVALID_INPUT`-style code. |
| `UnauthorizedError` | Thrown by the pipeline when a guard returns `false`.          |

### Adding a transport

A concrete gateway **holds** a `DispatchPipeline` and calls `dispatch()` from its own listener; it does not extend a base class:

```typescript
import { DispatchPipeline } from "@spinejs/gateway-core";

export class MyGateway<Ctx, Code extends string> {
  private readonly pipeline = new DispatchPipeline<Ctx, Code>(
    validator,
    errorMapper,
    interceptors
  );

  register(routes) {
    for (const route of routes) this.bind(route); // attach a listener per route
  }
  // in bind(): build ctx + rawInput, then `await this.pipeline.dispatch(...)`
}
```

## Full docs

[apps/docs/docs/gateway/](../../apps/docs/docs/gateway/)
