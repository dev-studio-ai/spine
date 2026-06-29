import { Logger } from '../logger';
import { InjectionToken } from './injection-token';
import { getInjectedDeps } from './injectable';
import type {
  ProviderConstructor,
  Provider,
  ProviderEntry,
  Token,
  FactoryProvider,
  TokenKey,
} from './container.types';

/** Bare class → `{ provide: Class }`; explicit provider → unchanged. */
export function normalizeProvider(entry: ProviderEntry): Provider {
  return typeof entry === 'function' ? { provide: entry } : entry;
}

/** Comparison/Map key for a token: a class by reference, an InjectionToken by its unique Symbol. */
export function tokenKey(token: Token): TokenKey {
  return token instanceof InjectionToken ? token.key : token;
}

/** True when two tokens resolve to the same provider (compares by `tokenKey`). */
export function sameToken(a: Token, b: Token): boolean {
  return tokenKey(a) === tokenKey(b);
}

export function stringifyToken(token: Token): string {
  return token instanceof InjectionToken ? token.toString() : token.name;
}

/**
 * Dependency injection container.
 * Lazily instantiates providers, recursively resolves their deps, detects cycles.
 */
export class Container {
  private readonly providers: Map<TokenKey, Provider> = new Map();
  private readonly resolved: Map<TokenKey, unknown> = new Map();

  constructor(
    private readonly logger: Logger,
    private readonly logContext?: string,
    private readonly parent?: Container,
  ) {}

  has(token: Token): boolean {
    return this.providers.has(tokenKey(token));
  }

  get<T = unknown>(token: Token): T {
    return this.resolveToken<T>(token, []);
  }

  add(provider: Provider): void {
    const token = provider.provide;
    const key = tokenKey(token);

    // First registration of a token wins (the module system relies on this). A duplicate is dropped
    // silently by design, but logged at verbose: dups are normal/frequent (a shared exported token
    // is re-added by every importer), so anything louder would spam — yet it stays traceable when
    // an unintended override silently keeps the wrong provider.
    if (this.providers.has(key)) {
      this.logger.verbose(
        `Provider ${stringifyToken(token)} already registered, ignored.`,
        this.logContext,
      );
      return;
    }

    this.providers.set(key, provider);

    // Cheap guard: a provider injecting itself is a trivial cycle.
    // Transitive cycles are caught lazily at resolve time.
    if ('inject' in provider && provider.inject?.some((t) => tokenKey(t) === key)) {
      throw new Error(`Circular dependency: provider ${stringifyToken(token)} injects itself.`);
    }
  }

  addMany(providers: Provider[]): void {
    for (const provider of providers) {
      this.add(provider);
    }
  }

  private resolveToken<T = unknown>(token: Token, parents: Token[] = []): T {
    const key = tokenKey(token);
    // `has`, not a truthy check: a falsy resolved value (0, '', false, null) must
    // stay cached, else factory/value would re-run on every injection.
    if (this.resolved.has(key)) {
      return this.resolved.get(key) as T;
    }

    if (this.has(token)) {
      // Thread a copy of `parents` down to `resolve` to keep the transitive
      // resolution chain — used for both cycle detection and error context.
      const resolved = this.resolve<T>(token, [...parents]);
      this.resolved.set(key, resolved);

      return resolved;
    }

    if (this.parent) return this.parent.resolveToken<T>(token, parents);

    throw this.unknownProviderError(token, parents);
  }

  /** Rich error: token category of the missing provider plus the resolution chain. */
  private unknownProviderError(token: Token, parents: Token[]): Error {
    const hint =
      typeof token === 'function'
        ? `'${stringifyToken(token)}' is a class (e.g. a Module or a service) used as an ` +
          `injection token, but it is not registered as a provider in any container. ` +
          `Declare it in the module's \`providers\`, or export it (\`exports\`) from an imported module.`
        : `Token '${stringifyToken(token)}' is not registered as a provider in any container.`;

    const chain = [...parents, token].map(stringifyToken).join(' -> ');
    const chainLine = parents.length ? `\n  → Resolution chain: ${chain}` : '';

    return new Error(`Unknown provider ${stringifyToken(token)}.\n  → ${hint}${chainLine}`);
  }

  private resolve<T = unknown>(token: Token, parents: Token[] = []): T {
    const provider = this.providers.get(tokenKey(token)) as Provider<T>;
    parents.push(token);

    // Value provider: identified by the `value` key, even if falsy or undefined.
    if ('value' in provider) {
      this.logger.verbose(`Return value for provider ${stringifyToken(token)}.`, this.logContext);

      return provider.value as T;
    }

    // Delegated provider: defer resolution to another container.
    if ('delegate' in provider && provider.delegate !== undefined) {
      this.logger.verbose(
        `Delegate provider resolution for provider ${stringifyToken(token)}.`,
        this.logContext,
      );
      return provider.delegate();
    }

    // Deps to inject: explicit `inject:` wins, else deps from `@Inject` on the class.
    const explicitInject =
      'inject' in provider && provider.inject !== undefined ? provider.inject : undefined;
    const deps = explicitInject ?? getInjectedDeps(provider.provide);

    let providers: unknown[] = [];
    if (deps && deps.length) {
      providers = this.resolveDeps(deps, parents);
    }

    const args: unknown[] = [...providers];

    // Factory provider.
    if ('factory' in provider && provider.factory !== undefined) {
      this.logger.verbose(`Call factory for provider ${stringifyToken(token)}.`, this.logContext);

      return (provider as FactoryProvider<T>).factory(...args);
    }

    // Constructor provider: at this point the provider has no value/factory/delegate, so the only
    // valid shape left is a class/constructor as `provide`. Detected by `typeof === 'function'`
    // (newable) rather than by source text — robust under transpilation (a class downleveled to a
    // `function` still instantiates) and to pre-ES6 function constructors. A non-function `provide`
    // (e.g. an InjectionToken with no value/factory/delegate) cannot be built → falls through.
    if (typeof provider.provide === 'function') {
      this.logger.verbose(
        `Instanciate class for provider ${stringifyToken(token)}.`,
        this.logContext,
      );

      const Class = provider.provide as ProviderConstructor<T>;
      return new Class(...args);
    }

    throw new Error(
      `Invalid provider for ${stringifyToken(token)}: it has no value/factory/delegate and its ` +
        `token is not a constructor. Declare one of value/factory/delegate, or use a class token.`,
    );
  }

  private resolveDeps(deps: readonly Token[], parents: Token[]): unknown[] {
    return deps.map((token) => {
      const key = tokenKey(token);
      if (parents.some((parent) => tokenKey(parent) === key)) {
        throw new Error(
          `Circular dependency: ${stringifyToken(token)} -> ${parents
            .map(stringifyToken)
            .join(' -> ')}`,
        );
      }
      return this.resolveToken(token, parents); // via resolveToken, not resolve: uses cache and parent
    });
  }
}
