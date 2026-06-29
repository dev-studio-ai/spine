// app-core public API (explicit re-exports, no wild export *).
export { App, appToken, loggerToken } from "./app";
export { AppLogger } from "./logger";
export type { LogLevel, Logger, ConsoleFormatOptions } from "./logger";
export {
  Container,
  InjectionToken,
  Inject,
  getInjectedDeps,
  ResolvedTuple,
  Provider,
  ProviderConstructor,
  ProviderFactory,
} from "./container";
export {
  Module,
  ModuleNode,
  ModuleConstructor,
  getModuleMetadata,
} from "./module";
export {
  OnInit,
  OnStart,
  OnStop,
  hasOnInit,
  hasOnStart,
  hasOnStop,
} from "./module";
export type { ModuleMetadata, DynamicModule, ModuleEntry } from "./module";
export type { LoggerOptions } from "./types";
export * from "./utils";
