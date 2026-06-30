---
sidebar_position: 3
---

# Dependency Injection

SpineJS includes a synchronous, cycle-detecting DI container. It resolves providers lazily on first request and caches the result — every token resolves to a singleton within a container scope.

## `InjectionToken<T>`

`InjectionToken<T>` is a typed, opaque token used as a DI key for values and interfaces (where a class reference is not available or not appropriate).

```typescript
import { InjectionToken } from "@spinejs/core";

// The generic T flows through to container.get<T>(token) call sites.
export const logLevelToken = new InjectionToken<string>("log.level");
export const configToken = new InjectionToken<AppConfig>("app.config");
```

Each `InjectionToken` instance creates a unique `Symbol` internally. Two tokens with the same description string are still distinct — there are no name collisions.

## Provider types

The `Provider<T>` union has four shapes:

### `BaseProvider` — class constructor

The simplest form: give the container a class reference and let it instantiate it.

```typescript
import { Module } from "@spinejs/core";
import { UserService } from "./user.service";

@Module({
  providers: [UserService], // shorthand for { provide: UserService }
})
export class UserModule {}
```

When the class has constructor dependencies, declare them with `@Inject` or with `inject` on the module:

```typescript
import { Inject, InjectionToken } from "@spinejs/core";

const dbToken = new InjectionToken<Database>("database");

@Inject([dbToken])
export class UserService {
  constructor(private readonly db: Database) {}
}
```

### `FactoryProvider` — factory function

Use a factory when construction logic cannot be expressed as a plain constructor call:

```typescript
import { InjectionToken } from "@spinejs/core";

const validatorToken = new InjectionToken<Validator>("validator");

@Module({
  providers: [
    {
      provide: validatorToken,
      inject: [ConfigService],
      factory: (config: ConfigService) =>
        new ZodValidator(config.get(strictModeKey)),
    },
  ],
  exports: [validatorToken],
})
export class ValidationModule {}
```

The `inject` array is resolved by the container before the factory is called. The factory's return type must match `T` of the `InjectionToken<T>`.

### `ValueProvider` — pre-built value

Use `value` when you have a ready-made instance or a primitive:

```typescript
import { InjectionToken } from "@spinejs/core";

const appVersionToken = new InjectionToken<string>("app.version");

@Module({
  providers: [
    { provide: appVersionToken, value: process.env.APP_VERSION ?? "0.0.0" },
  ],
  exports: [appVersionToken],
})
export class CoreModule {}
```

A value provider is particularly useful for `DynamicModule.configure()` patterns where the caller supplies a configuration object.

### `DelegateProvider` — lazy forwarding

A delegate defers resolution to a `() => T` thunk. The container calls it on the first `get()` request. This is useful for injecting values from a parent container without importing it:

```typescript
import { InjectionToken } from "@spinejs/core";

const dbToken = new InjectionToken<Database>("database");

@Module({
  providers: [
    {
      provide: dbToken,
      delegate: () => globalContainer.get(dbToken),
    },
  ],
})
export class ChildModule {}
```

## `@Inject` decorator

`@Inject` is the class-level decorator for declaring constructor dependencies without `reflect-metadata`. It is type-safe: TypeScript ties each token's resolved type to the corresponding constructor parameter position.

```typescript
import { Inject, InjectionToken } from "@spinejs/core";

const cacheToken = new InjectionToken<CacheService>("cache");
const dbToken = new InjectionToken<Database>("database");

@Inject([dbToken, cacheToken])
export class UserRepository {
  // TypeScript enforces (Database, CacheService) — swapping them is a compile error.
  constructor(
    private readonly db: Database,
    private readonly cache: CacheService
  ) {}
}
```

Modules typically use the `inject` field on `@Module` instead of `@Inject` directly:

```typescript
@Module({
  inject: [dbToken, cacheToken],
  imports: [DatabaseModule, CacheModule],
})
export class UserModule {
  constructor(
    private readonly db: Database,
    private readonly cache: CacheService
  ) {}
}
```

Both work the same at runtime — `@Module({ inject })` takes precedence over `@Inject` when both are present.

## `ResolvedTuple<D>`

`ResolvedTuple<D>` is the utility type that maps a tuple of tokens to the tuple of their resolved types. It powers the type-level enforcement in `@Module` and `@Inject`:

```typescript
type D = [InjectionToken<Database>, InjectionToken<Logger>];
// ResolvedTuple<D> = [Database, Logger]
```

You rarely need to reference this type directly; it is inferred automatically from the `inject` array you provide.

## Container resolution rules

1. **First registration wins.** If the same token is registered multiple times (common when a shared export is re-imported by several modules), the first registration is kept. Subsequent duplicates are silently dropped (logged at `verbose`).
2. **Singletons per container.** A resolved value is cached after the first `get()` call. Factories and constructors run exactly once per container scope.
3. **Parent container fallback.** Each module has its own child container. If a token is not found locally, resolution walks up to the global container.
4. **Cycle detection.** Synchronous circular dependencies (`A → B → A`) are detected at resolve time and throw a descriptive error with the resolution chain.

## Container API

The `Container` class is not typically used directly — the `App` and `ModuleLoader` manage it. For advanced use cases (e.g. building a test harness):

```typescript
import { Container, InjectionToken } from "@spinejs/core";
import { AppLogger } from "@spinejs/core";

const logger = new AppLogger();
const container = new Container(logger, "Container.Test");

const serviceToken = new InjectionToken<MyService>("my-service");

container.add({ provide: serviceToken, factory: () => new MyService() });

const service = container.get<MyService>(serviceToken);
```

| Method                 | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `add(provider)`        | Register a single provider. First registration wins.               |
| `addMany(providers[])` | Register multiple providers in batch.                              |
| `get<T>(token)`        | Resolve (and cache) a token. Throws if not found.                  |
| `has(token)`           | Returns `true` if the token is registered (does not check parent). |
