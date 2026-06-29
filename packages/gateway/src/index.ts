// app-gateway public API: a transport-agnostic gateway core (pipeline + decorators + ports).
// Dep-free besides app-core; concrete transports (IPC/HTTP/…) and validators live downstream.
export type { Envelope, GatewayContext, Guard, GuardConstructor, ParseableSchema, RouteDescriptor } from './gateway.types';
export { Controller, Handler, UseGuards, getGuardClasses, getRoutes, isController } from './route';
export type { HandlerOptions } from './route';
export { Gateway } from './gateway';
export { ValidationError, UnauthorizedError } from './ports';
export type { ContextFactory, ErrorMapper, Validator } from './ports';
export { gatewayFeatureFactory, gatewayModuleDecorator } from './feature-module';
export type { FeatureModuleConfig } from './feature-module';
