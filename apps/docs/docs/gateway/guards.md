---
sidebar_position: 3
---

# Guards

Guards decide whether a request may proceed to the handler. They implement the `Guard<Ctx>` interface and are resolved by DI — they can have constructor dependencies like any other service.

## `Guard<Ctx>` interface

```typescript
interface Guard<Ctx extends GatewayContext> {
  canActivate(ctx: Ctx): boolean | Promise<boolean>;
}
```

A guard receives the transport context and returns `true` to allow the request or `false` to reject it. Returning `false` causes the pipeline to throw `UnauthorizedError`, which the `ErrorMapper` maps to your configured unauthorized error code (typically `'UNAUTHORIZED'`).

Guards may also throw directly (e.g. to distinguish between different unauthorized conditions), and the `ErrorMapper` handles those throws the same way.

## Defining a guard

A guard is a plain class that implements the interface. It can inject any provider via its constructor:

```typescript
import { Guard } from '@spinejs/gateway';
import { Inject } from '@spinejs/core';
import { SessionStore } from '../session';
import { ElectronIpcContext } from './electron-ipc.types';

@Inject([SessionStore])
export class SessionGuard implements Guard<ElectronIpcContext> {
  constructor(private readonly sessionStore: SessionStore) {}

  canActivate(ctx: ElectronIpcContext): boolean {
    // ctx.session is enriched by the ContextFactory from the session store.
    return ctx.session !== null;
  }
}
```

## Applying guards with `@UseGuards`

`@UseGuards` accepts one or more guard **classes** (not instances). The container resolves the instances during feature module initialization.

### Class-level guard

Attaching `@UseGuards` to the controller class applies the guard to every handler in the class:

```typescript
import { Controller, Handler, UseGuards } from '@spinejs/gateway';
import { SessionGuard } from './session.guard';

@UseGuards(SessionGuard)
@Controller()
export class ProjectsController {
  @Handler({ address: 'projects:list' })
  list(ctx: ElectronIpcContext): Promise<Project[]> {
    // SessionGuard runs before this handler.
    return this.projectService.findAll(ctx.session.userId);
  }

  @Handler({ address: 'projects:get' })
  get(ctx: ElectronIpcContext, input: string): Promise<Project> {
    // SessionGuard runs before this handler too.
    return this.projectService.findById(input);
  }
}
```

### Method-level guard

Attaching `@UseGuards` to a method adds extra guards on top of any class-level guards. Class guards run first, then method guards:

```typescript
@UseGuards(SessionGuard)
@Controller()
export class AdminController {
  @UseGuards(AdminRoleGuard)      // SessionGuard + AdminRoleGuard
  @Handler({ address: 'admin:reset' })
  reset(ctx: ElectronIpcContext): void {
    // ...
  }

  @Handler({ address: 'admin:status' })
  status(): string {              // SessionGuard only
    return 'ok';
  }
}
```

## Guard resolution and the `guardMap`

At feature module initialization (inside `onInit()`), the framework:

1. Collects all unique guard classes referenced on the module's controllers.
2. Resolves them via DI (they must be listed as providers — the feature module factory does this automatically).
3. Builds a `Map<GuardConstructor, Guard<Ctx>>` called the `guardMap`.
4. Passes the `guardMap` to `getRoutes()`, which resolves each handler's guard list from the map.

This means guards are singletons within the module scope — the same `SessionGuard` instance is reused across all handlers that reference it.

:::warning Guards must be in providers
The feature module machinery auto-registers all guard classes from the controllers into `providers` and `inject`. If you reference a guard class in `@UseGuards` but forget to include its dependencies (via `@Inject` on the guard class), the DI resolution will fail at `onInit()` time with a clear error.
:::

## Guards as DI consumers

Because guards are DI-resolved, they integrate naturally with any service in the module graph:

```typescript
import { Inject } from '@spinejs/core';
import { Guard } from '@spinejs/gateway';

@Inject([AuthService])
export class JwtGuard implements Guard<HttpContext> {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: HttpContext): Promise<boolean> {
    const token = ctx.request.headers.authorization?.split(' ')[1];
    if (!token) return false;
    return this.auth.verifyToken(token);
  }
}
```

## Combining multiple guards

Multiple guards are checked in order: class-level first, then method-level. The first guard to return `false` short-circuits — subsequent guards are not called.

```typescript
@UseGuards(AuthenticatedGuard, RateLimitGuard)
@Controller()
export class PublicApiController {
  @UseGuards(CsrfGuard)
  @Handler({ address: 'api:mutate' })
  mutate(ctx: HttpContext, input: unknown): Promise<Result> {
    // Guard order: AuthenticatedGuard → RateLimitGuard → CsrfGuard
    return this.service.mutate(input);
  }
}
```
