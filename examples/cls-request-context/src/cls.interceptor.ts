import { randomUUID } from "node:crypto";
import { ClsService } from "@spinejs/cls";
import type {
  Envelope,
  GatewayInterceptor,
  RouteDescriptor,
} from "@spinejs/gateway";
import type { AppContext } from "./app-context";

/**
 * Opens a CLS scope per dispatch, seeded from the context. `cls.run(seed, next)` IS the per-request
 * boundary: everything inside `next()` (guards, handler, the whole service graph) reads this store.
 * The seed maps the dispatch context to the store, so this glue is app-specific.
 */
export class ClsInterceptor implements GatewayInterceptor<AppContext> {
  constructor(private readonly cls: ClsService) {}

  intercept(
    _route: RouteDescriptor<AppContext>,
    ctx: AppContext,
    _rawInput: unknown,
    next: () => Promise<Envelope<unknown>>
  ): Promise<Envelope<unknown>> {
    return this.cls.run({ user: ctx.user, reqId: randomUUID() }, next);
  }
}
