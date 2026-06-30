# SpineJS

Lightweight, NestJS-flavored micro-framework for structuring long-lived Node processes.

Brings the patterns you know from NestJS — modules, dependency injection, lifecycle hooks — without the weight of the full NestJS runtime or its HTTP-first assumptions.

Works equally well in Electron main processes, background workers, CLI daemons, or any Node program that outgrows a flat `index.ts`.

## Packages

| Package                         | Role                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `@spinejs/core`                 | Module system, DI container, `App` orchestrator, lifecycle hooks, built-in logger |
| `@spinejs/gateway`              | Transport-agnostic pipeline: `@Controller`, `@Handler`, `@UseGuards`, `Envelope`  |
| `@spinejs/electron-ipc-gateway` | Binds `Gateway` to `ipcMain.handle`                                               |
| `@spinejs/electron`             | `ElectronModule` (window + lifecycle) and `WindowService`                         |
| `@spinejs/config`               | Typed, async-capable config loading                                               |
| `@spinejs/winston-logger`       | Drop-in `Logger` implementation backed by Winston                                 |

## Why SpineJS?

Node processes grow quickly. What starts as a flat script soon needs a config loader, logging, multiple cooperating services, and a clean shutdown path. NestJS solves these problems, but pulls in `reflect-metadata`, a full HTTP stack, and several hundred kilobytes of runtime you may not need.

SpineJS answers the same architectural questions at a fraction of the weight:

- **No `reflect-metadata`.** Decorators store metadata as plain own-property symbols — safe under esbuild/swc without a global polyfill.
- **No transport lock-in.** The `Gateway` abstraction decouples your controllers from whatever carries the bytes — Electron IPC, HTTP, WebSocket, or nothing at all.
- **Structured lifecycle.** Every module participates in `init → start → stop`. Graceful shutdown, signal handling, and error propagation are handled for you.

## Quick start

```typescript
import { Module, OnInit, App } from "@spinejs/core";

@Module({ inject: [] })
export class GreeterModule implements OnInit {
  async onInit() {
    console.log("Hello from GreeterModule");
  }
}

const app = new App([GreeterModule]);
await app.init();
await app.start();
// SIGINT/SIGTERM handled automatically — onStop() runs in reverse order, then process exits
```

### With Electron IPC

```typescript
import { Controller, Handler } from "@spinejs/gateway";
import { IpcModule } from "@spinejs/electron-ipc-gateway";

@Controller()
export class PingController {
  @Handler({ address: "ping" })
  ping(_ctx: GatewayContext): string {
    return "pong";
  }
}

@IpcModule({ controllers: [PingController] })
export class PingModule {}
```

## Documentation

Full docs live in [`apps/docs/`](apps/docs/) (Docusaurus). Architecture Decision Records are in [`docs/adr/`](docs/adr/).

```bash
yarn docs:dev
```

## Development

```bash
yarn install
yarn typecheck:all
yarn test:all
yarn lint:all
```
