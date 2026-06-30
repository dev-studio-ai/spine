---
sidebar_position: 5
---

# Feature Modules

Feature modules are the glue between your controllers and a gateway transport. They encapsulate the wiring: instantiate controllers via DI, resolve guard instances, build the guard map, and register the resulting routes on the gateway — all in a synthesized `onInit()`.

`@spinejs/gateway` provides two sugar functions that produce this wiring from a transport-specific binding:

| Function                                   | Style                                        | When to use                                         |
| ------------------------------------------ | -------------------------------------------- | --------------------------------------------------- |
| `gatewayFeatureFactory(token, transport)`  | Factory — returns a `DynamicModule`          | Inline feature registration, no named class needed. |
| `gatewayModuleDecorator(token, transport)` | Decorator — replaces a class with a subclass | NestJS-style, keeps a named `export class`.         |

Both are bound once per transport to produce the app-specific helpers (`ipcFeature` / `@IpcModule` in the reference app).

## Creating transport-specific helpers

Bind the generic functions to your transport's gateway class and module:

```typescript
// electron-ipc-module.ts
import {
  gatewayFeatureFactory,
  gatewayModuleDecorator,
} from "@spinejs/gateway";
import { ElectronIpcGateway } from "@spinejs/electron-ipc-gateway";
import { ElectronIpcGatewayModule } from "./electron-ipc-gateway.module";

/**
 * Factory form — no named module class:
 *   imports: [ ipcFeature({ controllers: [PingController] }) ]
 */
export const ipcFeature = gatewayFeatureFactory(
  ElectronIpcGateway,
  ElectronIpcGatewayModule
);

/**
 * Decorator form — keeps a named module class:
 *   @IpcModule({ controllers: [PingController] })
 *   export class PingModule {}
 */
export const IpcModule = gatewayModuleDecorator(
  ElectronIpcGateway,
  ElectronIpcGatewayModule
);
```

## `ipcFeature` — factory form

The factory form is the primitive. It produces a `DynamicModule` that can be passed directly to `imports`:

```typescript
import { Module } from "@spinejs/core";
import { ipcFeature } from "./electron-ipc-module";
import { HealthController } from "./health.controller";
import { UserController } from "./user.controller";

@Module({
  imports: [
    ipcFeature({ controllers: [HealthController] }),
    ipcFeature({
      controllers: [UserController],
      imports: [UserModule], // additional imports needed by UserController
    }),
  ],
})
export class AppModule {}
```

## `@IpcModule` — decorator form

The decorator form replaces the decorated class with a subclass that has the synthesized `onInit`. You keep a named, exportable module class:

```typescript
import { IpcModule } from "./electron-ipc-module";
import { ProjectsController } from "./projects.controller";
import { ProjectsModule } from "./projects.module";
import { SessionGuard } from "../session.guard";

@IpcModule({
  controllers: [ProjectsController],
  imports: [ProjectsModule],
})
export class ProjectsIpcModule {}
```

## `FeatureModuleConfig`

Both forms accept the same config object:

```typescript
interface FeatureModuleConfig extends ModuleMetadata {
  controllers: ProviderConstructor[];
}
```

| Field         | Type                    | Description                                                                                             |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `controllers` | `ProviderConstructor[]` | Controller classes to register. Required.                                                               |
| `imports`     | `ModuleEntry[]`         | Additional modules to import into this feature module.                                                  |
| `providers`   | `ProviderEntry[]`       | Additional providers beyond the controllers.                                                            |
| `exports`     | `Token[]`               | Tokens to export from this feature module.                                                              |
| `inject`      | `Token[]`               | Additional constructor deps for the module class (decorator form only, for the user's own constructor). |

## How the synthesized `onInit()` works

When the feature module initializes, the framework:

1. Collects all unique guard classes from all controllers' `@UseGuards` metadata.
2. Builds the DI inject order: `[gatewayToken, ...controllerClasses, ...guardClasses, ...userInject]`.
3. Receives resolved instances from DI in the same order.
4. Builds the `guardMap: Map<GuardConstructor, Guard>`.
5. For each controller, calls `getRoutes(controllerInstance, guardMap)` to produce `RouteDescriptor[]`.
6. Calls `gateway.register(routes)` with all descriptors.
7. If the user's class (decorator form) has its own `onInit()`, calls it afterwards.

## Full wiring example

Here is a complete IPC feature module with guards, an authenticated context, and multiple controllers:

```typescript
// projects.ipc.module.ts
import { IpcModule } from "../infrastructure/electron-ipc-module";
import { SessionGuard } from "../infrastructure/session.guard";
import { ProjectsController } from "./projects.controller";
import { IssuesController } from "./issues.controller";
import { ProjectsModule } from "./projects.module";

@IpcModule({
  controllers: [ProjectsController, IssuesController],
  imports: [ProjectsModule],
})
export class ProjectsIpcModule {}
```

```typescript
// projects.controller.ts
import { Controller, Handler, UseGuards } from "@spinejs/gateway";
import { SessionGuard } from "../infrastructure/session.guard";
import { ElectronIpcContext } from "../infrastructure/electron-ipc.types";
import { z } from "zod";

const createProjectSchema = z.object({ name: z.string().min(1) });

@UseGuards(SessionGuard)
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Handler({ address: "projects:list" })
  list(ctx: ElectronIpcContext): Promise<Project[]> {
    return this.projectsService.findAll(ctx.session.userId);
  }

  @Handler({ address: "projects:create", input: createProjectSchema })
  create(ctx: ElectronIpcContext, input: { name: string }): Promise<Project> {
    return this.projectsService.create(ctx.session.userId, input.name);
  }
}
```

```typescript
// main.module.ts
import { Module } from "@spinejs/core";
import { ProjectsIpcModule } from "./projects.ipc.module";

@Module({
  imports: [ProjectsIpcModule],
})
export class MainModule {}
```

## Guard auto-registration

You do not need to list guard classes in the `providers` array manually. The feature module factory scans all controllers' `@UseGuards` metadata at definition time and adds all unique guard classes to `providers` and `inject` automatically.

Guards referenced in `@UseGuards` must still have their own dependencies declared via `@Injectable` on the guard class — the DI container resolves them through the normal provider chain.
