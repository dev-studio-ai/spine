---
sidebar_position: 1
---

# Gateway Overview

`@spinejs/gateway` is the transport-agnostic request pipeline that sits between your application logic and the communication layer (IPC, HTTP, WebSocket, or any custom transport). It defines a consistent request/response contract without binding to any particular runtime.

## Design philosophy

A common mistake in Electron apps is to write IPC handlers that directly call application services, scatter guard logic, and pass raw `IpcMainInvokeEvent` objects to business code. The gateway eliminates this coupling by establishing a clear pipeline with explicit responsibilities.

```
Raw transport call
  │
  ▼
ContextFactory.create(raw)        ← enriches the call with app context (session, user, …)
  │
  ▼
Guards: canActivate(ctx)?         ← authorization checks (DI-resolved, composable)
  │
  ▼
Validator.validate(schema, input) ← input narrowing (zod, or any parse()-compatible schema)
  │
  ▼
Handler method invocation         ← your controller, receiving (ctx, input)
  │
  ▼
Envelope<T, Code>                 ← { ok: true, data } | { ok: false, code }
  │
  ▼
Transport sends the envelope back
```

The gateway `dispatch()` method implements this pipeline. It **never throws**: any error — guard rejection, validation failure, handler exception — is caught and mapped to a stable error code via `ErrorMapper`. The caller always receives an `Envelope`.

:::info Why an envelope, not a thrown error?
Transport boundaries (IPC, HTTP) serialize poorly across thrown exceptions and leak stack traces. Returning a discriminated `Envelope` keeps the contract explicit and the error surface stable for every consumer.
:::

## `Envelope<T, Code>`

Every handler returns its result wrapped in an `Envelope`:

```typescript
type Envelope<T, Code extends string = string> =
  | { ok: true; data: T }
  | { ok: false; code: Code };
```

On the renderer side (or any consumer of the transport), you discriminate on `ok`:

```typescript
const result = await ipcRenderer.invoke("users:list");
if (result.ok) {
  console.log(result.data); // User[]
} else {
  console.error(result.code); // e.g. 'UNAUTHORIZED', 'SERVER', 'INVALID_INPUT'
}
```

Error codes are application-defined strings — the gateway core never leaks raw error messages or stack traces to the transport consumer.

## Transport-agnostic design

The `Gateway<Ctx, Code>` abstract class owns the pipeline logic. Concrete transports extend it and implement one method:

```typescript
abstract class Gateway<Ctx extends GatewayContext, Code extends string> {
  protected abstract bind(route: RouteDescriptor<Ctx>): void;
}
```

`bind()` is called once per registered route and is responsible for attaching a transport listener (e.g. `ipcMain.handle(address, ...)` for IPC). The shared `dispatch()` method is then called from within that listener.

This means the same `@Controller` / `@Handler` code can serve an IPC transport in an Electron app and an HTTP transport in a Fastify app, without any changes to the controller.

## Ports

Three interfaces define the extension points of the gateway. Your transport module provides concrete implementations:

| Port                       | Responsibility                                                             |
| -------------------------- | -------------------------------------------------------------------------- |
| `ContextFactory<Raw, Ctx>` | Builds a typed context from the transport's raw call data.                 |
| `Validator`                | Validates raw input against a schema; throws `ValidationError` on failure. |
| `ErrorMapper<Code>`        | Maps any thrown error to a stable error code string.                       |

The transport module wires these implementations into the gateway via DI factory providers. Controller and feature module code never touches the ports directly.

## Error types

Two error classes are part of the gateway's public API:

| Class               | When to throw                                                          |
| ------------------- | ---------------------------------------------------------------------- |
| `ValidationError`   | Thrown by the `Validator` when schema parsing fails.                   |
| `UnauthorizedError` | Thrown by the pipeline when a guard's `canActivate()` returns `false`. |

Application code may throw its own error types; the `ErrorMapper` catches all of them and maps them to codes.
