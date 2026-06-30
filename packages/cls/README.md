# @spinejs/cls

Continuation-local storage for SpineJS: a single `AsyncLocalStorage` exposed as an injectable
singleton `ClsService`, plus `ClsModule`. Open a scope per request (e.g. from a gateway interceptor
calling `cls.run()`); deep services read the current request's data via `cls.get()` without threading
a context object. See [ADR 0003](../../docs/adr/0003-cls-request-context.md).
