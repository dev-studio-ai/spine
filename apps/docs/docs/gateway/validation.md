---
sidebar_position: 4
---

# Validation

The gateway validates handler input through the `Validator` port. This keeps the gateway core free of any runtime dependency on a validation library — you wire in your chosen adapter (zod, joi, class-validator, etc.) at the transport layer.

## The `Validator` port

```typescript
interface Validator {
  validate<T>(schema: ParseableSchema<T>, input: unknown): T;
}
```

The `validate` method receives:

- **`schema`** — any object with a `parse(input: unknown): T` method (the `ParseableSchema<T>` structural type).
- **`input`** — the raw input from the transport (typically the second argument of an IPC invoke call).

It must return the parsed and typed `T` on success, or **throw `ValidationError`** on failure.

## `ParseableSchema<T>`

```typescript
interface ParseableSchema<T> {
  parse(input: unknown): T;
}
```

This structural interface is satisfied by any schema library that exposes a `parse` method — most notably **zod**. Because the interface is structural (duck typing), your controller code imports zod schemas directly, while the gateway library itself never depends on zod.

## Zod validator implementation

Here is the `ZodValidator` implementation from the reference Electron app:

```typescript
import { ZodError } from "zod";
import { ParseableSchema, ValidationError, Validator } from "@spinejs/gateway";

export class ZodValidator implements Validator {
  validate<T>(schema: ParseableSchema<T>, input: unknown): T {
    try {
      return schema.parse(input);
    } catch (err) {
      if (err instanceof ZodError) {
        const detail = err.issues
          .map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`
          )
          .join("; ");
        throw new ValidationError(detail);
      }
      throw err;
    }
  }
}
```

The key contract: `ZodError` is normalized to `ValidationError`. The gateway pipeline catches `ValidationError` and the `ErrorMapper` converts it to the transport's error code (e.g. `'INVALID_INPUT'`).

## Wiring the validator into the gateway

The validator is injected into the gateway via a factory provider in the transport module:

```typescript
import { InjectionToken, Module } from "@spinejs/core";
import { Validator } from "@spinejs/gateway";
import { ElectronIpcGateway } from "@spinejs/electron-ipc-gateway";
import { ZodValidator } from "./zod.validator";

const validatorToken = new InjectionToken<Validator>("validator");

@Module({
  providers: [
    { provide: validatorToken, factory: () => new ZodValidator() },
    {
      provide: ElectronIpcGateway,
      inject: [validatorToken /* errorMapper, contextFactory, logger */],
      factory: (validator, errorMapper, contextFactory, logger) =>
        new ElectronIpcGateway(validator, errorMapper, contextFactory, logger),
    },
  ],
  exports: [ElectronIpcGateway],
})
export class ElectronIpcGatewayModule {}
```

## Using schemas in handlers

Pass a schema to `@Handler({ input: schema })`. The pipeline calls `validator.validate(schema, rawInput)` before invoking the handler:

```typescript
import { z } from "zod";
import { Controller, Handler } from "@spinejs/gateway";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginInput = z.infer<typeof loginSchema>;

@Controller()
export class AuthController {
  @Handler({ address: "auth:login", input: loginSchema })
  login(_ctx: ElectronIpcContext, input: LoginInput): Promise<AuthResult> {
    // `input` is already validated — email is a valid email, password has ≥8 chars.
    return this.authService.login(input.email, input.password);
  }
}
```

If the renderer sends `{ email: 'not-an-email', password: '123' }`, the handler is never called. The response is `{ ok: false, code: 'INVALID_INPUT' }`.

## Handlers without a schema

When `input` is omitted from `@Handler`, the raw input from the transport is passed directly to the handler without any transformation:

```typescript
@Handler({ address: 'ping' })
ping(_ctx: ElectronIpcContext, _input: unknown): string {
  return 'pong';
}
```

This is fine for handlers that take no input, or when you want to handle raw input yourself.

## `ValidationError`

`ValidationError` is re-exported from `@spinejs/gateway`. Import it in your `Validator` implementation and in your `ErrorMapper`:

```typescript
import { ValidationError } from "@spinejs/gateway";

// In ErrorMapper.toCode():
if (err instanceof ValidationError) return "INVALID_INPUT";
```

The message carried by `ValidationError` is not forwarded to the transport consumer (the `ErrorMapper` only returns the code string). Log it server-side if you need the detail.
