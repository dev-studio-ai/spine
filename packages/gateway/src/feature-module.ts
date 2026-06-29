import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleConstructor,
  ModuleEntry,
  ModuleMetadata,
  OnInit,
  ProviderConstructor,
} from "@spinejs/core";
import type {
  Guard,
  GatewayContext,
  GuardConstructor,
  RouteDescriptor,
} from "./gateway.types";
import { getGuardClasses, getRoutes } from "./route";

/** Minimal structural view of a gateway: all the feature module needs is to register routes. */
interface GatewayRegistrar {
  register(routes: RouteDescriptor<GatewayContext>[]): void;
}

/** Token resolving to a gateway (a transport's concrete `Gateway`, by class or InjectionToken). */
type GatewayToken =
  | ProviderConstructor<GatewayRegistrar>
  | InjectionToken<GatewayRegistrar>;

/** Feature module config: standard module metadata plus the controllers to auto-register. */
export interface FeatureModuleConfig extends ModuleMetadata {
  controllers: ProviderConstructor[];
}

/** Base a feature module extends — `class {}` for the factory, the user class for the decorator. */
type ModuleBase = ModuleConstructor;

/**
 * Core mechanic shared by both sugar forms. Builds a module **class** whose synthesized `onInit`
 * resolves the gateway + controllers + guard instances (constructor-injected, fixed order
 * `[gateway, ...controllers, ...uniqueGuardClasses, ...userInject]`), builds a guard map, calls
 * `getRoutes(ctrl, guardMap)` for each controller, and passes the pre-resolved descriptors to
 * `gateway.register()`. The user's own `onInit` (if any) runs **after** registration.
 */
function defineFeatureModuleClass(
  token: GatewayToken,
  transport: ModuleEntry,
  config: FeatureModuleConfig,
  Base: ModuleBase
): ModuleConstructor {
  const {
    controllers,
    providers = [],
    imports = [],
    inject = [],
    exports,
  } = config;

  // Collect guard constructors at definition time — deduplicated union across all controllers.
  const uniqueGuardClasses: GuardConstructor[] = [];
  const seen = new Set<GuardConstructor>();
  for (const ctrl of controllers) {
    for (const cls of getGuardClasses(
      ctrl as unknown as new (...args: never[]) => object
    )) {
      if (!seen.has(cls)) {
        seen.add(cls);
        uniqueGuardClasses.push(cls);
      }
    }
  }

  class FeatureModule extends Base implements OnInit {
    private readonly __gateway: GatewayRegistrar;
    private readonly __controllers: object[];
    private readonly __guardInstances: Guard<GatewayContext>[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      const [gateway, ...rest] = args as [GatewayRegistrar, ...object[]];
      const controllerInstances = rest.slice(0, controllers.length) as object[];
      const guardInstances = rest.slice(
        controllers.length,
        controllers.length + uniqueGuardClasses.length
      ) as Guard<GatewayContext>[];
      const userDeps = rest.slice(
        controllers.length + uniqueGuardClasses.length
      );
      super(...(userDeps as never[]));
      this.__gateway = gateway;
      this.__controllers = controllerInstances;
      this.__guardInstances = guardInstances;
    }

    async onInit(): Promise<void> {
      const guardMap = new Map<GuardConstructor, Guard<GatewayContext>>(
        uniqueGuardClasses.map((cls, i) => [cls, this.__guardInstances[i]])
      );
      const allRoutes = this.__controllers.flatMap((ctrl) =>
        getRoutes(ctrl, guardMap)
      );
      this.__gateway.register(allRoutes);
      const parentInit = (Base.prototype as Partial<OnInit>).onInit;
      if (typeof parentInit === "function") await parentInit.call(this);
    }
  }

  Module({
    imports: [transport, ...imports],
    providers: [...controllers, ...uniqueGuardClasses, ...providers],
    inject: [token, ...controllers, ...uniqueGuardClasses, ...inject],
    exports,
  })(FeatureModule);

  return FeatureModule;
}

/**
 * Factory (primitive) — mirrors the repo's `Module.configure()` idiom. Returns a self-contained
 * `DynamicModule` that registers `controllers` on the gateway. No named class, no subclass magic.
 *
 *   imports: [ ipcFeature({ controllers: [PingController] }) ]
 */
export function gatewayFeatureFactory(
  token: GatewayToken,
  transport: ModuleEntry
) {
  return (config: FeatureModuleConfig): DynamicModule => {
    const Empty = class {} as ModuleBase;
    const module = defineFeatureModuleClass(token, transport, config, Empty);
    const label = config.controllers.map((c) => c.name).join(",");
    Object.defineProperty(module, "name", {
      value: `GatewayFeature(${label})`,
    });
    return { module };
  };
}

/**
 * Decorator (sugar) — NestJS-style ergonomics, keeps a named module class. Replaces the class with
 * a subclass carrying the registrar `onInit`; the user may still declare `providers`/`imports`/
 * `exports`/`inject` (for its own constructor) and its own `onInit`.
 *
 *   @IpcModule({ controllers: [PingController] })
 *   export class PingModule {}
 */
export function gatewayModuleDecorator(
  token: GatewayToken,
  transport: ModuleEntry
) {
  return (config: FeatureModuleConfig) =>
    <C extends new (...args: never[]) => object>(UserClass: C): C => {
      const module = defineFeatureModuleClass(
        token,
        transport,
        config,
        UserClass as unknown as ModuleBase
      );
      Object.defineProperty(module, "name", { value: UserClass.name });
      return module as unknown as C;
    };
}
