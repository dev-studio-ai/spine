import type { ParseableSchema } from './gateway.types';

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

/** Thrown by a `Validator` adapter when the input fails its schema. */
export class ValidationError extends Error {
  constructor(message = 'Input validation failed') {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Thrown by the pipeline when a guard rejects the call. */
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
