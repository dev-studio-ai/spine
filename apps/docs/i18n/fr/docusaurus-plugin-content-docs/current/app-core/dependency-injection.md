---
sidebar_position: 3
---

# Injection de dépendances

SpineJS inclut un conteneur DI synchrone avec détection de cycles. Il résout les providers paresseusement à la première demande et met le résultat en cache — chaque token se résout en singleton au sein d'une portée de conteneur.

## `InjectionToken<T>`

`InjectionToken<T>` est un token typé et opaque utilisé comme clé DI pour des valeurs et des interfaces (lorsqu'une référence de classe n'est pas disponible ou pas appropriée).

```typescript
import { InjectionToken } from '@spinejs/core';

// The generic T flows through to container.get<T>(token) call sites.
export const logLevelToken = new InjectionToken<string>('log.level');
export const configToken  = new InjectionToken<AppConfig>('app.config');
```

Chaque instance d'`InjectionToken` crée un `Symbol` unique en interne. Deux tokens ayant la même chaîne de description restent distincts — il n'y a pas de collision de noms.

## Types de providers

L'union `Provider<T>` a quatre formes :

### `BaseProvider` — constructeur de classe

La forme la plus simple : donnez au conteneur une référence de classe et laissez-le l'instancier.

```typescript
import { Module } from '@spinejs/core';
import { UserService } from './user.service';

@Module({
  providers: [UserService], // shorthand for { provide: UserService }
})
export class UserModule {}
```

Quand la classe a des dépendances de constructeur, déclarez-les avec `@Inject` ou avec `inject` sur le module :

```typescript
import { Inject, InjectionToken } from '@spinejs/core';

const dbToken = new InjectionToken<Database>('database');

@Inject([dbToken])
export class UserService {
  constructor(private readonly db: Database) {}
}
```

### `FactoryProvider` — fonction factory

Utilisez une factory quand la logique de construction ne peut pas s'exprimer comme un simple appel de constructeur :

```typescript
import { InjectionToken } from '@spinejs/core';

const validatorToken = new InjectionToken<Validator>('validator');

@Module({
  providers: [
    {
      provide: validatorToken,
      inject: [ConfigService],
      factory: (config: ConfigService) => new ZodValidator(config.get(strictModeKey)),
    },
  ],
  exports: [validatorToken],
})
export class ValidationModule {}
```

Le tableau `inject` est résolu par le conteneur avant l'appel de la factory. Le type de retour de la factory doit correspondre au `T` de l'`InjectionToken<T>`.

### `ValueProvider` — valeur pré-construite

Utilisez `value` lorsque vous disposez d'une instance prête à l'emploi ou d'une primitive :

```typescript
import { InjectionToken } from '@spinejs/core';

const appVersionToken = new InjectionToken<string>('app.version');

@Module({
  providers: [
    { provide: appVersionToken, value: process.env.APP_VERSION ?? '0.0.0' },
  ],
  exports: [appVersionToken],
})
export class CoreModule {}
```

Un value provider est particulièrement utile pour les patterns `DynamicModule.configure()` où l'appelant fournit un objet de configuration.

### `DelegateProvider` — transfert paresseux

Un delegate diffère la résolution à un thunk `() => T`. Le conteneur l'appelle à la première demande `get()`. C'est utile pour injecter des valeurs depuis un conteneur parent sans l'importer :

```typescript
import { InjectionToken } from '@spinejs/core';

const dbToken = new InjectionToken<Database>('database');

@Module({
  providers: [
    {
      provide: dbToken,
      delegate: () => globalContainer.get(dbToken),
    },
  ],
})
export class ChildModule {}
```

## Décorateur `@Inject`

`@Inject` est le décorateur de niveau classe pour déclarer les dépendances de constructeur sans `reflect-metadata`. Il est type-safe : le générique `D` lie le type résolu de chaque token à la position correspondante du paramètre de constructeur.

```typescript
import { Inject, InjectionToken } from '@spinejs/core';

const cacheToken = new InjectionToken<CacheService>('cache');
const dbToken    = new InjectionToken<Database>('database');

@Inject([dbToken, cacheToken])
export class UserRepository {
  // TypeScript enforces (Database, CacheService) — swapping them is a compile error.
  constructor(private readonly db: Database, private readonly cache: CacheService) {}
}
```

Les modules utilisent typiquement le champ `inject` de `@Module` plutôt que `@Inject` directement :

```typescript
@Module({
  inject: [dbToken, cacheToken],
  imports: [DatabaseModule, CacheModule],
})
export class UserModule {
  constructor(private readonly db: Database, private readonly cache: CacheService) {}
}
```

Les deux fonctionnent de la même façon à l'exécution — `@Module({ inject })` prend le pas sur `@Inject` quand les deux sont présents.

## `ResolvedTuple<D>`

`ResolvedTuple<D>` est le type utilitaire qui mappe un tuple de tokens vers le tuple de leurs types résolus. Il alimente l'application au niveau des types dans `@Module` et `@Inject` :

```typescript
type D = [InjectionToken<Database>, InjectionToken<Logger>];
// ResolvedTuple<D> = [Database, Logger]
```

Vous avez rarement besoin de référencer ce type directement ; il est inféré automatiquement à partir du tableau `inject` que vous fournissez.

## Règles de résolution du conteneur

1. **Le premier enregistrement gagne.** Si le même token est enregistré plusieurs fois (fréquent quand un export partagé est ré-importé par plusieurs modules), le premier enregistrement est conservé. Les doublons suivants sont silencieusement ignorés (journalisés en `verbose`).
2. **Singletons par conteneur.** Une valeur résolue est mise en cache après le premier appel `get()`. Les factories et constructeurs s'exécutent exactement une fois par portée de conteneur.
3. **Repli sur le conteneur parent.** Chaque module a son propre conteneur enfant. Si un token n'est pas trouvé localement, la résolution remonte jusqu'au conteneur global.
4. **Détection de cycles.** Les dépendances circulaires synchrones (`A → B → A`) sont détectées au moment de la résolution et lèvent une erreur descriptive avec la chaîne de résolution.

## API du conteneur

La classe `Container` n'est typiquement pas utilisée directement — l'`App` et le `ModuleLoader` la gèrent. Pour des cas d'usage avancés (par ex. construire un harnais de test) :

```typescript
import { Container, InjectionToken } from '@spinejs/core';
import { AppLogger } from '@spinejs/core';

const logger = new AppLogger();
const container = new Container(logger, 'Container.Test');

const serviceToken = new InjectionToken<MyService>('my-service');

container.add({ provide: serviceToken, factory: () => new MyService() });

const service = container.get<MyService>(serviceToken);
```

| Méthode | Description |
|---|---|
| `add(provider)` | Enregistre un seul provider. Le premier enregistrement gagne. |
| `addMany(providers[])` | Enregistre plusieurs providers en lot. |
| `get<T>(token)` | Résout (et met en cache) un token. Lève une erreur si introuvable. |
| `has(token)` | Retourne `true` si le token est enregistré (ne vérifie pas le parent). |
