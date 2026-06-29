/**
 * Structural schema contract used by the validation pipeline. Anything exposing a
 * `parse(input) -> T` satisfies it — notably a zod schema — so the gateway lib infers
 * the validated type **without importing any validation library** (stays dep-free).
 */
export interface ParseableSchema<T> {
  parse(input: unknown): T;
}

/** Base constraint for a transport context (IPC event + session, HTTP req/res, …). */
export type GatewayContext = object;

/**
 * Result wrapper returned by every handler, transport-agnostic. `Code` is the set of
 * stable error codes a given transport maps its exceptions to (opaque to the lib).
 */
export type Envelope<T, Code extends string = string> =
  | { ok: true; data: T }
  | { ok: false; code: Code };

/**
 * Injectable guard: decides whether a context is allowed to proceed. Replaces the old
 * `AuthGuard` port — guards are now plain classes resolved by DI, not gateway ports.
 */
export interface Guard<Ctx extends GatewayContext> {
  canActivate(ctx: Ctx): boolean | Promise<boolean>;
}

/** Constructor type for a guard class, used as the metadata key and DI token. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GuardConstructor = new (...args: any[]) => Guard<GatewayContext>;

/** A handler's metadata, resolved from `@Handler` + bound to its controller instance. */
export interface RouteDescriptor<Ctx extends GatewayContext> {
  /** Transport-opaque address. IPC reads it as a channel, HTTP as a path, … */
  address: string;
  /** Guards to run before invoking the handler. Any returning false throws UnauthorizedError. */
  guards: Guard<Ctx>[];
  /** Optional schema; when present the raw input is parsed/narrowed before `invoke`. */
  input?: ParseableSchema<unknown>;
  /** The controller method, bound to its instance. Receives the validated input. */
  invoke: (ctx: Ctx, input: unknown) => unknown | Promise<unknown>;
}
