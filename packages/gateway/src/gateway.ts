import type {
  Envelope,
  GatewayContext,
  RouteDescriptor,
} from "./gateway.types";
import {
  ErrorMapper,
  GatewayInterceptor,
  UnauthorizedError,
  Validator,
} from "./ports";

/**
 * Transport-agnostic gateway. Owns the shared request pipeline
 * (guards → validate → invoke → envelope, every error mapped to a stable code) and
 * delegates the transport specifics — how to listen on an address, extract the raw input,
 * build the context and emit the envelope — to `bind`, implemented per transport (IPC, HTTP, …).
 *
 * Optional interceptors wrap every `dispatch()` call in registration order (first = outermost).
 */
export abstract class Gateway<
  Ctx extends GatewayContext,
  Code extends string = string
> {
  protected constructor(
    private readonly validator: Validator,
    private readonly errorMapper: ErrorMapper<Code>,
    private readonly interceptors: GatewayInterceptor<Ctx, Code>[] = []
  ) {}

  /** Registers pre-resolved route descriptors on the transport. */
  register(routes: RouteDescriptor<Ctx>[]): void {
    for (const route of routes) this.bind(route);
  }

  /** Transport-specific: listen on `route.address`, then call `dispatch` and emit its envelope. */
  protected abstract bind(route: RouteDescriptor<Ctx>): void;

  /** Runs interceptor chain then the core pipeline. Never throws. */
  protected dispatch(
    route: RouteDescriptor<Ctx>,
    ctx: Ctx,
    rawInput: unknown
  ): Promise<Envelope<unknown, Code>> {
    const run = () => this.runPipeline(route, ctx, rawInput);
    const chain = this.interceptors.reduceRight(
      (next, interceptor) => () =>
        interceptor.intercept(route, ctx, rawInput, next),
      run
    );
    return chain();
  }

  /** Core pipeline (guards → validate → invoke → envelope). Never throws. */
  private async runPipeline(
    route: RouteDescriptor<Ctx>,
    ctx: Ctx,
    rawInput: unknown
  ): Promise<Envelope<unknown, Code>> {
    try {
      for (const guard of route.guards) {
        if (!(await guard.canActivate(ctx))) throw new UnauthorizedError();
      }
      const input = route.input
        ? this.validator.validate(route.input, rawInput)
        : rawInput;
      const data = await route.invoke(ctx, input);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, code: this.errorMapper.toCode(err) };
    }
  }
}
