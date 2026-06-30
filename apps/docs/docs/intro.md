---
sidebar_position: 1
---

# Introduction

**SpineJS** is a lightweight, NestJS-flavored micro-framework for structuring long-lived Node processes. It brings the patterns you know from NestJS — modules, dependency injection, lifecycle hooks — without the weight of the full NestJS runtime or its HTTP-first assumptions.

It works equally well in background workers, CLI daemons, long-running services, or any Node program that outgrows a flat `index.ts`.

The ecosystem is organized in layers that you compose à la carte — see the [package overview](#package-overview) below.

## Why SpineJS?

Node processes grow quickly. What starts as a flat script soon needs a config loader, logging, multiple cooperating services, and a clean shutdown path. NestJS solves these problems, but it pulls in reflect-metadata, a full HTTP stack, and several hundred kilobytes of runtime you may not need.

SpineJS answers the same architectural questions at a fraction of the weight:

- **No reflect-metadata.** Decorators store metadata as plain own-property symbols, safe under esbuild/swc without a global polyfill.
- **No transport lock-in.** The `Gateway` abstraction decouples your business controllers from whatever carries the bytes — IPC, HTTP, WebSocket, or nothing at all.
- **Structured lifecycle.** Every module participates in `init → start → stop`. Graceful shutdown, signal handling, and error propagation are handled for you.

## Quick start

A minimal app with one service and a clean shutdown:

### 1. Define a module

```typescript
import { Module, OnInit } from "@spinejs/core";

@Module({ inject: [] })
export class GreeterModule implements OnInit {
  async onInit() {
    console.log("Hello from GreeterModule");
  }
}
```

### 2. Boot the app

```typescript
import { App } from "@spinejs/core";
import { GreeterModule } from "./greeter.module";

const app = new App([GreeterModule]);

await app.init();
await app.start();
```

`SIGINT`/`SIGTERM` are handled automatically: `onStop()` runs in reverse init order, the logger flushes, then the process exits cleanly.

:::tip
You never call `process.exit()` yourself. Let the lifecycle drain — `onStop()` hooks run in reverse order so dependents shut down before their dependencies.
:::

### Adding a gateway

If your process needs to expose request handlers — over IPC, HTTP, or any other transport — `@spinejs/gateway` gives you a transport-agnostic pipeline (guards, validation, error envelope) in front of plain controllers:

```typescript
@Controller()
export class PingController {
  @Handler({ address: "ping" })
  ping(_ctx: GatewayContext): string {
    return "pong";
  }
}
```

The same `PingController` can be served by any concrete transport binding without changes — see the [Gateway overview](gateway/overview) for the pipeline design, and the [transports](transports/electron-ipc) section for ready-made bindings.

## Core concepts

| Concept          | What it does                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Module**       | Structural unit declared with `@Module({ inject: [...] })`; participates in the `init → start → stop` lifecycle.                          |
| **DI container** | Resolves constructor dependencies between modules via `InjectionToken`s — no decorators-on-everything, no reflect-metadata.               |
| **`App`**        | Orchestrates the module graph: builds it, runs lifecycle hooks in order, and handles process signals.                                     |
| **Gateway**      | Optional transport-agnostic request pipeline (guards → validation → handler → envelope) for processes that need to expose an API surface. |

## Where to go next

| Section                              | Covers                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| [App Core](app-core/overview)        | `App`, modules, DI, lifecycle, built-in logger            |
| [Gateway](gateway/overview)          | Controllers, handlers, guards, validation, interceptors   |
| [Extensions](extensions/config)      | Typed config loading, Winston logger                      |
| [Electron](electron/electron-module) | Electron-specific lifecycle integration and IPC transport |

## Package overview

| Package                         | Role                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `@spinejs/core`                 | Module system, DI container, `App` orchestrator, lifecycle hooks, built-in logger |
| `@spinejs/gateway`              | Transport-agnostic pipeline: `@Controller`, `@Handler`, `@UseGuards`, `Envelope`  |
| `@spinejs/electron-ipc-gateway` | Binds `Gateway` to `ipcMain.handle`                                               |
| `@spinejs/electron`             | `ElectronModule` (window + lifecycle) and `WindowService`                         |
| `@spinejs/config`               | Typed, async-capable config loading                                               |
| `@spinejs/winston-logger`       | Drop-in `Logger` implementation backed by Winston                                 |
