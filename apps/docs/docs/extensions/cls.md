---
sidebar_position: 3
---

# CLS (request context)

`@spinejs/cls` provides per-request ambient state via Node's `AsyncLocalStorage`, exposed as an
injectable singleton `ClsService`. Use it to make request data (the authenticated user, a correlation
id, the current tenant) available deep in a service graph **without threading a context object**
through every method — and without the cost of a DI request scope (no per-request re-instantiation).

## Installation

`ClsModule` is a standard SpineJS module. Import it wherever you inject `ClsService`:

```typescript
import { Module } from "@spinejs/core";
import { ClsModule } from "@spinejs/cls";

@Module({ imports: [ClsModule] })
export class SomeFeatureModule {}
```

`ClsModule` provides a single shared `ClsService`. Import it in several modules freely — they all see
the same instance, which is required so the code that opens a scope and the code that reads it share
one `AsyncLocalStorage`.

## API

`ClsService`:

- `run<R>(seed, fn): R` — opens a scope seeded with a copy of `seed`, runs `fn` inside it.
- `get active(): boolean` — whether a scope is currently active.
- `get<T>(key): T | undefined` — read the active scope (`undefined` outside any scope).
- `set<T>(key, value): void` — write the active scope (throws outside a scope).
- `has(key): boolean` — whether the key exists in the active scope.

## Opening a scope per request

`ClsService.run()` is the per-request boundary. With the gateway, open it from an interceptor — the
gateway core is not touched:

```typescript
import { randomUUID } from "node:crypto";
import { ClsService } from "@spinejs/cls";
import type { GatewayInterceptor } from "@spinejs/gateway";

export class ClsInterceptor implements GatewayInterceptor<AppContext> {
  constructor(private readonly cls: ClsService) {}
  intercept(_route, ctx, _input, next) {
    return this.cls.run({ user: ctx.user, reqId: randomUUID() }, next);
  }
}
```

Register it via your transport's `configure({ interceptors })`.

## Reading the context

Inject `ClsService` (or a typed wrapper) into any singleton service — no `ctx` parameter:

```typescript
import { Injectable } from "@spinejs/core";
import { ClsService } from "@spinejs/cls";

@Injectable({ inject: [ClsService] })
export class AuditService {
  constructor(private readonly cls: ClsService) {}
  log(action: string) {
    const user = this.cls.get<string>("user");
    // ...
  }
}
```

## Concurrency

`AsyncLocalStorage` binds the store to the async execution context, not to an instance. Two
concurrent requests get isolated stores, so the same singleton returns each request's own value.

## Guidance

- Centralise the `AsyncLocalStorage` in `ClsService` — never instantiate one elsewhere.
- For shallow needs (a handler reading `ctx.user` directly), just use the context; CLS earns its keep
  when a deep service graph would otherwise thread `ctx` everywhere.
- Calling `get` outside a scope returns `undefined`; `set` throws. Make sure every entry point that
  needs the context opens one with `run()`.

A full runnable example lives in `examples/cls-request-context`.
