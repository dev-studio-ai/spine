# Example — CLS request context over the electron IPC gateway

Proof of concept for [ADR 0003](../../docs/adr/0003-cls-request-context.md): per-request ambient data
via `@spinejs/cls`, without DI request scope and without threading `ctx` through every service.

- A `ClsInterceptor` opens a CLS scope per dispatch (`cls.run`), seeded from the context.
- The singleton `AuditService` reads `cls.get("user")` — no `ctx` parameter — and still sees the
  right user per request, even under concurrency, because `AsyncLocalStorage` isolates by async
  context, not by instance.
- `@spinejs/core` and `@spinejs/gateway` are untouched: the scope rides the gateway's existing
  interceptor hook.

## Run

`electron` is mocked, so the real `ElectronIpcGateway` runs without an Electron process:

```bash
npx nx test example-cls-request-context
```

The spec fires two concurrent `whoami` invokes (alice + bob) and asserts each sees its own user.
