---
sidebar_position: 2
---

# Controllers and Handlers

Controllers are the classes that group your incoming-message handling logic. They are declared with `@Controller` and expose individual handlers via `@Handler` on their methods.

## `@Controller()`

`@Controller` marks a class as a gateway controller. It carries no configuration — its sole purpose is to tag the class so the gateway can distinguish controllers from regular providers.

```typescript
import { Controller } from "@spinejs/gateway";

@Controller()
export class UserController {
  // ...
}
```

A controller class must be listed in the `controllers` array of a feature module (see [Feature Modules](./feature-modules)). The gateway resolves controller instances via DI.

## `@Handler({ address, input? })`

`@Handler` declares a gateway handler on a method. The `address` is a transport-opaque string: for IPC it becomes the `ipcMain.handle` channel; for HTTP it could be a path; for a custom transport it means whatever the transport's `bind()` implementation expects.

```typescript
import { Controller, Handler } from "@spinejs/gateway";

@Controller()
export class PingController {
  @Handler({ address: "ping" })
  ping(): string {
    return "pong";
  }
}
```

The handler method receives two arguments:

- **`ctx`** — the transport context (typed by the transport; carries the IPC event, session data, etc.).
- **`input`** — the validated input, or the raw input if no schema was provided.

Without a schema, `input` is `unknown` and must be cast manually:

```typescript
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Handler({ address: "users:get-by-id" })
  getById(ctx: GatewayContext, input: unknown): Promise<User> {
    const id = input as string; // raw — no schema, no type safety
    return this.userService.findById(id);
  }
}
```

With a schema, `input` is validated and fully typed:

```typescript
import { z } from "zod";

const getByIdSchema = z.string();

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Handler({ address: "users:get-by-id", input: getByIdSchema })
  getById(ctx: GatewayContext, input: string): Promise<User> {
    return this.userService.findById(input);
  }
}
```

### `HandlerOptions`

| Option    | Type                 | Required | Description                                                                                                           |
| --------- | -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `address` | `string`             | Yes      | The handler address. Transport-opaque — interpreted by the transport's `bind()`.                                      |
| `input`   | `ParseableSchema<T>` | No       | A schema with a `parse(input: unknown): T` method. When present, raw input is validated before the handler is called. |

## Input validation with `ParseableSchema<T>`

The `input` option accepts any object with a `parse(input: unknown): T` method. This structural contract is satisfied by zod schemas without importing zod into the gateway library.

```typescript
import { z } from "zod";
import { Controller, Handler } from "@spinejs/gateway";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Handler({ address: "users:create", input: createUserSchema })
  create(ctx: ElectronIpcContext, input: CreateUserInput): Promise<User> {
    // `input` is already parsed and typed as CreateUserInput.
    return this.userService.create(input);
  }
}
```

When validation fails, the `Validator` port (e.g. `ZodValidator`) throws a `ValidationError`, which the pipeline maps to the corresponding error code (typically `'INVALID_INPUT'`). The handler method is never called.

:::note Schema inference
TypeScript infers `input` as `CreateUserInput` in the handler body when the schema is typed (e.g. `z.ZodObject<...>`). The generic `In` on `@Handler<In>` flows from the schema's `parse` return type through `HandlerOptions<In>`, so you get type safety without any explicit annotation on the method parameter.
:::

## Controller constructor injection

Controllers are regular class providers in the DI container. Declare their dependencies with `@Injectable`:

```typescript
import { Injectable, InjectionToken } from "@spinejs/core";
import { Controller, Handler } from "@spinejs/gateway";

const userServiceToken = new InjectionToken<UserService>("user-service");

@Injectable({ inject: [userServiceToken] })
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Handler({ address: "users:list" })
  list(): Promise<User[]> {
    return this.userService.findAll();
  }
}
```

Or, when listed explicitly in the feature module's `inject` override — but the `@Injectable` + class-as-token pattern is usually simpler.

## Handler return values

A handler may return a plain value or a `Promise`. The pipeline wraps the resolved value in `{ ok: true, data: value }`. Throwing any error (or returning a rejected promise) causes `{ ok: false, code: <mapped code> }` to be returned instead.

```typescript
@Handler({ address: 'app:version' })
getVersion(): string {
  return '1.0.0';
}
// → { ok: true, data: '1.0.0' }

@Handler({ address: 'data:load' })
async loadData(): Promise<Data> {
  // If this rejects, the error is caught by dispatch() and mapped to a code.
  return await fetchData();
}
// → { ok: true, data: {...} }  or  { ok: false, code: 'SERVER' }
```
