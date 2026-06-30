---
sidebar_position: 3
---

# Guards

Les guards décident si une requête peut poursuivre vers le handler. Ils implémentent l'interface `Guard<Ctx>` et sont résolus par DI — ils peuvent avoir des dépendances de constructeur comme n'importe quel autre service.

## Interface `Guard<Ctx>`

```typescript
interface Guard<Ctx extends GatewayContext> {
  canActivate(ctx: Ctx): boolean | Promise<boolean>;
}
```

Un guard reçoit le contexte de transport et retourne `true` pour autoriser la requête ou `false` pour la rejeter. Retourner `false` fait lever au pipeline une `UnauthorizedError`, que l'`ErrorMapper` mappe vers le code d'erreur d'autorisation configuré (typiquement `'UNAUTHORIZED'`).

Les guards peuvent aussi lever directement (par ex. pour distinguer différentes conditions d'autorisation), et l'`ErrorMapper` traite ces levées de la même manière.

## Définir un guard

Un guard est une simple classe qui implémente l'interface. Il peut injecter n'importe quel provider via son constructeur :

```typescript
import { Guard } from '@spinejs/gateway';
import { Inject } from '@spinejs/core';
import { SessionStore } from '../session';
import { ElectronIpcContext } from './electron-ipc.types';

@Inject([SessionStore])
export class SessionGuard implements Guard<ElectronIpcContext> {
  constructor(private readonly sessionStore: SessionStore) {}

  canActivate(ctx: ElectronIpcContext): boolean {
    // ctx.session is enriched by the ContextFactory from the session store.
    return ctx.session !== null;
  }
}
```

## Appliquer des guards avec `@UseGuards`

`@UseGuards` accepte une ou plusieurs **classes** de guard (pas des instances). Le conteneur résout les instances pendant l'initialisation du module de fonctionnalité.

### Guard au niveau classe

Attacher `@UseGuards` à la classe du contrôleur applique le guard à chaque handler de la classe :

```typescript
import { Controller, Handler, UseGuards } from '@spinejs/gateway';
import { SessionGuard } from './session.guard';

@UseGuards(SessionGuard)
@Controller()
export class ProjectsController {
  @Handler({ address: 'projects:list' })
  list(ctx: ElectronIpcContext): Promise<Project[]> {
    // SessionGuard runs before this handler.
    return this.projectService.findAll(ctx.session.userId);
  }

  @Handler({ address: 'projects:get' })
  get(ctx: ElectronIpcContext, input: string): Promise<Project> {
    // SessionGuard runs before this handler too.
    return this.projectService.findById(input);
  }
}
```

### Guard au niveau méthode

Attacher `@UseGuards` à une méthode ajoute des guards supplémentaires par-dessus les guards de niveau classe. Les guards de classe s'exécutent d'abord, puis les guards de méthode :

```typescript
@UseGuards(SessionGuard)
@Controller()
export class AdminController {
  @UseGuards(AdminRoleGuard)      // SessionGuard + AdminRoleGuard
  @Handler({ address: 'admin:reset' })
  reset(ctx: ElectronIpcContext): void {
    // ...
  }

  @Handler({ address: 'admin:status' })
  status(): string {              // SessionGuard only
    return 'ok';
  }
}
```

## Résolution des guards et le `guardMap`

À l'initialisation du module de fonctionnalité (dans `onInit()`), le framework :

1. Collecte toutes les classes de guard uniques référencées sur les contrôleurs du module.
2. Les résout via DI (elles doivent figurer comme providers — la factory du module de fonctionnalité le fait automatiquement).
3. Construit une `Map<GuardConstructor, Guard<Ctx>>` appelée le `guardMap`.
4. Passe le `guardMap` à `getRoutes()`, qui résout la liste de guards de chaque handler à partir de la map.

Cela signifie que les guards sont des singletons au sein de la portée du module — la même instance `SessionGuard` est réutilisée par tous les handlers qui la référencent.

:::warning Les guards doivent être dans les providers
La machinerie du module de fonctionnalité auto-enregistre toutes les classes de guard des contrôleurs dans `providers` et `inject`. Si vous référencez une classe de guard dans `@UseGuards` mais oubliez d'inclure ses dépendances (via `@Inject` sur la classe du guard), la résolution DI échouera au moment du `onInit()` avec une erreur claire.
:::

## Les guards comme consommateurs de DI

Parce que les guards sont résolus par DI, ils s'intègrent naturellement avec n'importe quel service du graphe de modules :

```typescript
import { Inject } from '@spinejs/core';
import { Guard } from '@spinejs/gateway';

@Inject([AuthService])
export class JwtGuard implements Guard<HttpContext> {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: HttpContext): Promise<boolean> {
    const token = ctx.request.headers.authorization?.split(' ')[1];
    if (!token) return false;
    return this.auth.verifyToken(token);
  }
}
```

## Combiner plusieurs guards

Plusieurs guards sont vérifiés dans l'ordre : niveau classe d'abord, puis niveau méthode. Le premier guard qui retourne `false` court-circuite — les guards suivants ne sont pas appelés.

```typescript
@UseGuards(AuthenticatedGuard, RateLimitGuard)
@Controller()
export class PublicApiController {
  @UseGuards(CsrfGuard)
  @Handler({ address: 'api:mutate' })
  mutate(ctx: HttpContext, input: unknown): Promise<Result> {
    // Guard order: AuthenticatedGuard → RateLimitGuard → CsrfGuard
    return this.service.mutate(input);
  }
}
```
