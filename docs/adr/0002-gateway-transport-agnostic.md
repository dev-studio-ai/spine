# ADR 0002 — Transport-agnostic gateway: `@spinejs/gateway` + `@spinejs/electron-ipc-gateway`

- **Status**: Accepted
- **Date**: 2026-06-29
- **Scope**: `packages/gateway`, `packages/electron-ipc-gateway`, `packages/electron`
- **Relation**: builds on the module/DI model defined in `packages/core`.

## Context

Before this decision, the IPC gateway logic was monolithic and coupled to the application:

- `IpcGateway` / `IpcModule` / `IpcContext` were defined directly in the app, mixing transport
  concerns (Electron `ipcMain`) with application concerns (session, error mapping, validation).
- Authorization was a boolean `auth: boolean` flag on each handler — not composable, not testable,
  not injectable.
- No separation between the pipeline core (guards → validate → invoke → envelope) and the transport
  layer, making everything hard to reuse and every unit test expensive (you had to mock `ipcMain`).

## Decision

The logic is split across three distinct packages.

### 1. `packages/gateway` — transport-agnostic core

Provides the shared pipeline and the decorator surface, with no external dependency (only
`@spinejs/core`):

- Abstract `Gateway<Ctx, Code>` class: the `guards → validate → invoke → envelope` pipeline.
  Every error is caught and converted to `{ ok: false, code }` via the `ErrorMapper<Code>` port.
- Decorators `@Controller()`, `@Handler({ address, input? })`, `@UseGuards(...guards)`.
  Metadata stored on own symbols (no `reflect-metadata`, esbuild-compatible).
- Ports (DIP interfaces): `Validator`, `ContextFactory<Raw, Ctx>`, `ErrorMapper<Code>`.
  The core depends on no validation library and no application concern.
- Module sugar: `gatewayFeatureFactory` (factory / `DynamicModule`) and `gatewayModuleDecorator`
  (class decorator, NestJS-style). Both synthesize an `onInit` that collects the controllers'
  routes, builds the `guardMap` and calls `gateway.register()`.

### 2. `packages/electron-ipc-gateway` — Electron IPC binding

Concrete binding for the Electron transport:

- `ElectronIpcGateway<Ctx, Code>` extends `Gateway`, implements `bind()` via `ipcMain.handle()`.
- Application-agnostic: the context (session, user) is produced by an injected
  `ContextFactory<ElectronIpcRaw, Ctx>` — nothing app-specific leaks into the lib.
- Base types: `ElectronIpcBaseContext` (holds `event: IpcMainInvokeEvent`),
  `ElectronIpcRaw` (`{ event, args }`).

### 3. `packages/electron` — Electron lifecycle module

`ElectronModule` and `WindowService` for the Electron window lifecycle (extracted into its own lib,
like `electron-ipc-gateway`).

### DI-injectable guards

Guards replace the `auth: boolean` flag. A guard is an ordinary class implementing `Guard<Ctx>`
(`canActivate(ctx): boolean | Promise<boolean>`), resolved by the DI container.

`@UseGuards(SessionGuard)` applies at the class level (all handlers) or at a method (a single
handler). `FeatureModuleConfig` automatically collects the referenced guard classes and adds them to
the synthesized module's `providers`/`inject` list.

## Alternatives considered

### Keep everything in the consuming application

Rejected: tight coupling between transport and application logic, not reusable, unit tests requiring
`ipcMain` to be mocked every time.

### NestJS microservices / NestJS transports

Rejected: incompatible with the esbuild build pipeline used for the Electron main process (no
`reflect-metadata`, NestJS runtime tree-shaking broken). `@spinejs/core` covers exactly the need
(modules + DI + lifecycle) without the weight of the NestJS runtime.

### A single monolithic `electron-ipc-gateway` lib

Rejected: it merges the pipeline core (transport-agnostic, testable with a mock transport) with the
Electron binding (which depends on the `electron` module). The core/transport split is the only way
to test the pipeline without launching an Electron process.

## Consequences

- **Positive**: the pipeline is testable via a mock transport (no `electron` import required in the
  core's unit tests).
- **Positive**: reusable — a second transport (HTTP, WebSocket) extends `Gateway` without touching
  either `@spinejs/gateway` or the existing controllers.
- **Positive**: guards are composable, DI-injectable, and isolated from the transport.
- **Positive**: clean separation of concerns — the transport only knows the raw event; the
  `ContextFactory` is the single point of contact with the session.
- **Negative**: 3 packages instead of 1. Justified by reusability and testability; the organizational
  cost is low in this monorepo.
- **Caution**: any new transport must implement `bind()` and provide its own `ContextFactory`,
  `ErrorMapper` and `Validator` adapters. The core must not acquire external dependencies.
