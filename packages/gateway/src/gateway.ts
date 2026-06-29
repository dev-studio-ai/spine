import type { Envelope, GatewayContext, RouteDescriptor } from './gateway.types';
import { ErrorMapper, UnauthorizedError, Validator } from './ports';

/**
 * Transport-agnostic gateway. Owns the shared request pipeline
 * (guards → validate → invoke → envelope, every error mapped to a stable code) and
 * delegates the transport specifics — how to listen on an address, extract the raw input,
 * build the context and emit the envelope — to `bind`, implemented per transport (IPC, HTTP, …).
 */
export abstract class Gateway<Ctx extends GatewayContext, Code extends string = string> {
  protected constructor(
    private readonly validator: Validator,
    private readonly errorMapper: ErrorMapper<Code>,
  ) {}

  /** Registers pre-resolved route descriptors on the transport. */
  register(routes: RouteDescriptor<Ctx>[]): void {
    for (const route of routes) this.bind(route);
  }

  /** Transport-specific: listen on `route.address`, then call `dispatch` and emit its envelope. */
  protected abstract bind(route: RouteDescriptor<Ctx>): void;

  /** Shared pipeline. Never throws: failures become `{ ok: false, code }`. */
  protected async dispatch(
    route: RouteDescriptor<Ctx>,
    ctx: Ctx,
    rawInput: unknown,
  ): Promise<Envelope<unknown, Code>> {
    try {
      for (const guard of route.guards) {
        if (!(await guard.canActivate(ctx))) throw new UnauthorizedError();
      }
      const input = route.input ? this.validator.validate(route.input, rawInput) : rawInput;
      const data = await route.invoke(ctx, input);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, code: this.errorMapper.toCode(err) };
    }
  }
}
