# @spinejs/core

Module system, DI container, and lifecycle orchestrator for SpineJS.

## Quick start

An app is a graph of modules booted by `App`. Start from the entry point, then the module, then the service it injects.

```typescript
// main.ts
import { App } from "@spinejs/core";
import { AppModule } from "./app.module";

const app = new App([AppModule]);
await app.init();
await app.start();
// SIGINT/SIGTERM → onStop() in reverse order → process.exit(0)
```

```typescript
// app.module.ts
import { Module, OnInit } from "@spinejs/core";
import { GreetingService } from "./greeting.service";

@Module({ providers: [GreetingService], inject: [GreetingService] })
export class AppModule implements OnInit {
  constructor(private readonly greeting: GreetingService) {}

  async onInit() {
    console.log(this.greeting.hello());
  }
}
```

```typescript
// greeting.service.ts
import { Injectable } from "@spinejs/core";

@Injectable()
export class GreetingService {
  hello() {
    return "Hello, world!";
  }
}
```

`@Injectable({ inject: [...] })` on a class (or `inject` on a `@Module`) is type-checked: the tokens' resolved types must line up with the constructor parameters, in order.

## Injecting the logger

The active logger is registered under `loggerToken` (as is `App` under `appToken`):

```typescript
import { Module, Logger, loggerToken } from "@spinejs/core";

@Module({ inject: [loggerToken] })
export class MyModule {
  constructor(private readonly logger: Logger) {}

  async onInit() {
    this.logger.info("ready", MyModule.name);
  }
}
```

Type the field as `Logger` (the interface) so it works with any implementation (built-in `AppLogger` or `@spinejs/winston-logger`).

## Reference

### `AppOptions`

| Option              | Type            | Default     | Description                                                                                |
| ------------------- | --------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `logger`            | `Logger`        | `AppLogger` | Custom logger (e.g. `WinstonLogger`).                                                      |
| `loggerOptions`     | `LoggerOptions` | `{}`        | Built-in logger options (`level`).                                                         |
| `handleProcessExit` | `boolean`       | `true`      | Register SIGINT/SIGTERM handlers. Pass `false` in Electron (use `ElectronModule` instead). |

### Lifecycle hooks

| Interface | Method      | When                                                    |
| --------- | ----------- | ------------------------------------------------------- |
| `OnInit`  | `onInit()`  | After all modules in the dependency graph are resolved. |
| `OnStart` | `onStart()` | After `app.init()` completes.                           |
| `OnStop`  | `onStop()`  | In reverse init order, on shutdown.                     |

### Provider shapes

```typescript
// Class (shorthand)
providers: [MyService]

// Factory
{ provide: myToken, inject: [DepA], factory: (dep: DepA) => new MyService(dep) }

// Value
{ provide: versionToken, value: "1.0.0" }

// Delegate (lazy thunk)
{ provide: myToken, delegate: () => externalContainer.get(myToken) }

// Existing (alias — same cached instance)
{ provide: aliasToken, existing: MyService }
```

## Full docs

[apps/docs/docs/app-core/](../../apps/docs/docs/app-core/)
