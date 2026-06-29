import type {
  Envelope,
  GatewayContext,
  RouteDescriptor,
} from "./gateway.types";
import type { ParseableSchema } from "./gateway.types";

/**
 * Validation port (DIP). A concrete adapter (e.g. a zod-backed one) parses the raw
 * input against the schema and **must throw `ValidationError`** on failure, so the lib
 * never depends on any validation library nor its error type.
 */
export interface Validator {
  validate<T>(schema: ParseableSchema<T>, input: unknown): T;
}

/**
 * Builds the dispatch context from a transport's raw call data (e.g. the IPC event). Keeps every
 * app concern (session, user) out of the transport: the transport stays generic, the app provides
 * the factory that enriches the context.
 */
export interface ContextFactory<Raw, Ctx> {
  create(raw: Raw): Ctx;
}

/** Maps any thrown error to a transport-specific stable code (no raw message leaks). */
export interface ErrorMapper<Code extends string = string> {
  toCode(err: unknown): Code;
}

/**
 * Cross-cutting concern injected around every `dispatch()` call. Interceptors wrap the
 * pipeline in registration order — the first registered interceptor is the outermost wrapper.
 *
 * @example
 * class LoggingInterceptor implements GatewayInterceptor {
 *   async intercept(route, ctx, rawInput, next) {
 *     console.log('→', route.address);
 *     const envelope = await next();
 *     console.log('←', route.address, envelope.ok);
 *     return envelope;
 *   }
 * }
 */
export interface GatewayInterceptor<
  Ctx extends GatewayContext = GatewayContext,
  Code extends string = string
> {
  intercept(
    route: RouteDescriptor<Ctx>,
    ctx: Ctx,
    rawInput: unknown,
    next: () => Promise<Envelope<unknown, Code>>
  ): Promise<Envelope<unknown, Code>>;
}

/** Thrown by a `Validator` adapter when the input fails its schema. */
export class ValidationError extends Error {
  constructor(message = "Input validation failed") {
    super(message);
    this.name = "ValidationError";
  }
}

/** Thrown by the pipeline when a guard rejects the call. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
