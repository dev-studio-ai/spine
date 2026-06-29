---
sidebar_position: 1
slug: /
---

# Introduction

**SpineJS** is a lightweight, NestJS-flavored micro-framework for structuring long-lived Node processes. It brings the patterns you know from NestJS — modules, dependency injection, lifecycle hooks — without the weight of the full NestJS runtime or its HTTP-first assumptions.

It works equally well in Electron main processes, background workers, CLI daemons, or any Node program that outgrows a flat `index.ts`.

The ecosystem is organized in layers that you compose à la carte:

```
@spinejs/core          — module system, DI container, lifecycle, built-in logger
@spinejs/gateway       — transport-agnostic request pipeline (guards, validation, envelope)
@spinejs/electron-ipc-gateway  — Electron ipcMain transport binding for app-gateway
@spinejs/electron          — Electron lifecycle integration (BrowserWindow, app events)
@spinejs/config            — typed configuration loading
@spinejs/winston-logger    — opt-in Winston logger (file transports, richer formatting)
```

## Why SpineJS?

Node processes grow quickly. What starts as a flat script soon needs a config loader, logging, multiple cooperating services, and a clean shutdown path. NestJS solves these problems, but it pulls in reflect-metadata, a full HTTP stack, and several hundred kilobytes of runtime you may not need.

SpineJS answers the same architectural questions at a fraction of the weight:

- **No reflect-metadata.** Decorators store metadata as plain own-property symbols, safe under esbuild/swc without a global polyfill.
- **No transport lock-in.** The `Gateway` abstraction decouples your business controllers from whatever carries the bytes — Electron IPC, HTTP, WebSocket, or nothing at all.
- **Structured lifecycle.** Every module participates in `init → start → stop`. Graceful shutdown, signal handling, and error propagation are handled for you.

## Quick start

A minimal app with one service and a clean shutdown:

### 1. Define a module

```typescript
import { Module, OnInit } from '@spinejs/core';

@Module({ inject: [] })
export class GreeterModule implements OnInit {
  async onInit() {
    console.log('Hello from GreeterModule');
  }
}
```

### 2. Boot the app

```typescript
import { App } from '@spinejs/core';
import { GreeterModule } from './greeter.module';

const app = new App([GreeterModule]);

await app.init();
await app.start();
```

`SIGINT`/`SIGTERM` are handled automatically: `onStop()` runs in reverse init order, the logger flushes, then the process exits cleanly.

### With Electron IPC

If you are building an Electron main process, the same module system wires up IPC handlers:

```typescript
@Controller()
export class PingController {
  @Handler({ address: 'ping' })
  ping(_ctx: GatewayContext): string {
    return 'pong';
  }
}

// ping.module.ts — IpcModule is a thin sugar over gatewayModuleDecorator
@IpcModule({ controllers: [PingController] })
export class PingModule {}
```

See the [Electron IPC transport](transports/electron-ipc) page for the full setup.

## Package overview

| Package | Role |
|---|---|
| `@spinejs/core` | Module system, DI container, `App` orchestrator, lifecycle hooks, built-in logger |
| `@spinejs/gateway` | Transport-agnostic pipeline: `@Controller`, `@Handler`, `@UseGuards`, `Envelope` |
| `@spinejs/electron-ipc-gateway` | Binds `Gateway` to `ipcMain.handle` |
| `@spinejs/electron` | `ElectronModule` (window + lifecycle) and `WindowService` |
| `@spinejs/config` | Typed, async-capable config loading |
| `@spinejs/winston-logger` | Drop-in `Logger` implementation backed by Winston |
