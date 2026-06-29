# @spinejs/core

Module system, DI container, and lifecycle orchestrator for SpineJS.

## What it provides

- **`App`** — boots the module graph, drives `init → start → stop`, handles `SIGINT`/`SIGTERM` and uncaught exceptions.
- **`@Module`** — structural unit of code. Declares providers, imports, and exports.
- **`@Inject`** / **`InjectionToken`** — type-safe dependency injection without `reflect-metadata`.
- **`AppLogger`** — built-in console logger (swappable via `AppOptions.logger`).

## Quick start

```typescript
import { App, Module, OnInit, InjectionToken, Inject } from "@spinejs/core";

const greetingToken = new InjectionToken<string>("greeting");

@Module({
  providers: [{ provide: greetingToken, value: "Hello, world!" }],
  exports: [greetingToken],
})
export class GreetingModule {}

@Module({
  imports: [GreetingModule],
  inject: [greetingToken],
})
export class AppModule implements OnInit {
  constructor(private readonly greeting: string) {}

  async onInit() {
    console.log(this.greeting);
  }
}

const app = new App([AppModule]);
await app.init();
await app.start();
// SIGINT/SIGTERM → onStop() in reverse order → process.exit(0)
```

## `AppOptions`

| Option              | Type            | Default     | Description                                                                                |
| ------------------- | --------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `logger`            | `Logger`        | `AppLogger` | Custom logger (e.g. `WinstonLogger`).                                                      |
| `loggerOptions`     | `LoggerOptions` | `{}`        | Built-in logger options (`level`).                                                         |
| `handleProcessExit` | `boolean`       | `true`      | Register SIGINT/SIGTERM handlers. Pass `false` in Electron (use `ElectronModule` instead). |

## Global tokens

```typescript
import { appToken, loggerToken } from "@spinejs/core";

@Module({ inject: [appToken, loggerToken] })
export class MyModule {
  constructor(private readonly app: App, private readonly logger: Logger) {}
}
```

## Lifecycle hooks

| Interface | Method      | When                                                    |
| --------- | ----------- | ------------------------------------------------------- |
| `OnInit`  | `onInit()`  | After all modules in the dependency graph are resolved. |
| `OnStart` | `onStart()` | After `app.init()` completes.                           |
| `OnStop`  | `onStop()`  | In reverse init order, on shutdown.                     |

## Provider types

```typescript
// Class (shorthand)
providers: [MyService]

// Factory
{ provide: myToken, inject: [DepA], factory: (dep: DepA) => new MyService(dep) }

// Value
{ provide: versionToken, value: '1.0.0' }

// Delegate (lazy thunk)
{ provide: myToken, delegate: () => externalContainer.get(myToken) }
```

## Full docs

[apps/docs/docs/app-core/](../../apps/docs/docs/app-core/)
