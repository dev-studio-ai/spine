import { defineOwnMeta, readOwnMeta } from '@spinejs/core';
import type { GatewayContext, Guard, GuardConstructor, ParseableSchema, RouteDescriptor } from './gateway.types';
import { UnauthorizedError } from './ports';

/** Keys (Symbol.for, stable across module copies) where decorator metadata is stored. */
const HANDLER_ROUTES = Symbol.for('app-gateway:handler-routes');
const CONTROLLER = Symbol.for('app-gateway:controller');
const CONTROLLER_GUARDS = Symbol.for('app-gateway:controller-guards');
const METHOD_GUARDS = Symbol.for('app-gateway:method-guards');

/** Options accepted by `@Handler`. `In` is inferred from the schema, narrowing the handler input. */
export interface HandlerOptions<In = unknown> {
  address: string;
  input?: ParseableSchema<In>;
}

/** One handler's metadata as accumulated on the class (method name + its options). */
interface HandlerMeta {
  methodName: string | symbol;
  options: HandlerOptions;
}

/**
 * Marks a class as a gateway controller. Pairs with `@Handler` on its methods.
 * No reflect-metadata: the marker is a plain own-property symbol on the constructor.
 */
export function Controller() {
  return <C extends new (...args: never[]) => object>(cls: C): C => {
    defineOwnMeta(cls, CONTROLLER, true);
    return cls;
  };
}

/**
 * Declares a gateway route on a controller method. Accumulates `{ methodName, options }` on the
 * constructor via `defineOwnMeta` (legacy decorator, esbuild-safe, **no reflect-metadata**).
 * The handler receives the **validated** input when `options.input` is set.
 */
export function Handler<In = unknown>(options: HandlerOptions<In>) {
  return (target: object, propertyKey: string | symbol): void => {
    const ctor = target.constructor;
    const routes = readOwnMeta<HandlerMeta[]>(ctor, HANDLER_ROUTES) ?? [];
    routes.push({ methodName: propertyKey, options: options as HandlerOptions });
    defineOwnMeta(ctor, HANDLER_ROUTES, routes);
  };
}

/**
 * Attaches guard classes to a controller class or a handler method. Works as both:
 * - Class decorator: guards apply to all methods on the class.
 * - Method decorator: guards apply only to that method (merged after class-level guards).
 */
export function UseGuards(...guards: GuardConstructor[]) {
  return (target: object, propertyKey?: string | symbol): void => {
    if (propertyKey === undefined) {
      // Class decorator — target is the constructor
      defineOwnMeta(target, CONTROLLER_GUARDS, guards);
    } else {
      // Method decorator — target is the prototype, accumulate per method on constructor
      const ctor = (target as { constructor: object }).constructor;
      const map = readOwnMeta<Map<string | symbol, GuardConstructor[]>>(ctor, METHOD_GUARDS) ?? new Map();
      const existing = map.get(propertyKey) ?? [];
      map.set(propertyKey, [...existing, ...guards]);
      defineOwnMeta(ctor, METHOD_GUARDS, map);
    }
  };
}

/** True when the class carries `@Controller`. */
export function isController(controller: object): boolean {
  return readOwnMeta<boolean>(controller.constructor, CONTROLLER) === true;
}

/**
 * Returns a deduplicated list of all guard classes referenced by this controller (class-level +
 * all method-level). Used by feature-module at synthesis time to add guards to the DI inject list.
 */
export function getGuardClasses(controller: new (...args: never[]) => object): GuardConstructor[] {
  const classGuards = readOwnMeta<GuardConstructor[]>(controller, CONTROLLER_GUARDS) ?? [];
  const methodMap = readOwnMeta<Map<string | symbol, GuardConstructor[]>>(controller, METHOD_GUARDS) ?? new Map();
  const allMethodGuards = [...methodMap.values()].flat();
  const seen = new Set<GuardConstructor>();
  for (const g of [...classGuards, ...allMethodGuards]) seen.add(g);
  return [...seen];
}

/**
 * Resolves a controller **instance** into transport-ready route descriptors: reads the `@Handler`
 * metadata, merges class- and method-level guard constructors, looks up resolved instances from
 * `guardMap`, and binds each method to the instance. Throws if the class is not a `@Controller`.
 */
export function getRoutes<Ctx extends GatewayContext>(
  controller: object,
  guardMap: Map<GuardConstructor, Guard<GatewayContext>>,
): RouteDescriptor<Ctx>[] {
  if (!isController(controller)) {
    throw new Error(`${controller.constructor.name} is not a @Controller.`);
  }
  const ctor = controller.constructor;
  const metas = readOwnMeta<HandlerMeta[]>(ctor, HANDLER_ROUTES) ?? [];
  const classGuardClasses = readOwnMeta<GuardConstructor[]>(ctor, CONTROLLER_GUARDS) ?? [];
  const methodGuardsMap =
    readOwnMeta<Map<string | symbol, GuardConstructor[]>>(ctor, METHOD_GUARDS) ?? new Map();

  return metas.map(({ methodName, options }) => {
    const methodGuardClasses = methodGuardsMap.get(methodName) ?? [];
    const allGuardClasses = [...classGuardClasses, ...methodGuardClasses];
    const guards = allGuardClasses.map((cls) => {
      const instance = guardMap.get(cls);
      if (!instance) throw new Error(`Guard ${cls.name} is not in the guard map — add it to DI inject.`);
      return instance as Guard<Ctx>;
    });

    return {
      address: options.address,
      guards,
      input: options.input,
      invoke: (ctx: Ctx, input: unknown) =>
        (controller as Record<string | symbol, (ctx: Ctx, input: unknown) => unknown>)[methodName](
          ctx,
          input,
        ),
    };
  });
}

// Re-export for convenience so callers importing from './route' get UnauthorizedError too.
export { UnauthorizedError };
