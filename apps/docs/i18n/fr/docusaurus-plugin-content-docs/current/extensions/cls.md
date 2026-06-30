---
sidebar_position: 3
---

# CLS (contexte de requête)

`@spinejs/cls` fournit un état ambiant par requête via l'`AsyncLocalStorage` de Node, exposé comme un
singleton injectable `ClsService`. Utilisez-le pour rendre les données de requête (l'utilisateur
authentifié, un identifiant de corrélation, le tenant courant) disponibles au fond d'un graphe de
services **sans faire passer un objet de contexte** à travers chaque méthode — et sans le coût d'une
portée DI « request » (pas de réinstanciation par requête).

## Installation

`ClsModule` est un module SpineJS standard. Importez-le partout où vous injectez `ClsService` :

```typescript
import { Module } from "@spinejs/core";
import { ClsModule } from "@spinejs/cls";

@Module({ imports: [ClsModule] })
export class SomeFeatureModule {}
```

`ClsModule` fournit un unique `ClsService` partagé. Importez-le librement dans plusieurs modules — ils
voient tous la même instance, ce qui est nécessaire pour que le code qui ouvre une portée et celui qui
la lit partagent le même `AsyncLocalStorage`.

## API

`ClsService` :

- `run<R>(seed, fn): R` — ouvre une portée initialisée avec une copie de `seed`, exécute `fn` à
  l'intérieur.
- `get active(): boolean` — indique si une portée est actuellement active.
- `get<T>(key): T | undefined` — lit la portée active (`undefined` en dehors de toute portée).
- `set<T>(key, value): void` — écrit dans la portée active (lève en dehors d'une portée).
- `has(key): boolean` — indique si la clé existe dans la portée active.

## Ouvrir une portée par requête

`ClsService.run()` est la frontière par requête. Avec la gateway, ouvrez-la depuis un interceptor — le
cœur de la gateway n'est pas modifié :

```typescript
import { randomUUID } from "node:crypto";
import { ClsService } from "@spinejs/cls";
import type { GatewayInterceptor } from "@spinejs/gateway";

export class ClsInterceptor implements GatewayInterceptor<AppContext> {
  constructor(private readonly cls: ClsService) {}
  intercept(_route, ctx, _input, next) {
    return this.cls.run({ user: ctx.user, reqId: randomUUID() }, next);
  }
}
```

Enregistrez-le via le `configure({ interceptors })` de votre transport.

## Lire le contexte

Injectez `ClsService` (ou un wrapper typé) dans n'importe quel service singleton — sans paramètre
`ctx` :

```typescript
import { Injectable } from "@spinejs/core";
import { ClsService } from "@spinejs/cls";

@Injectable({ inject: [ClsService] })
export class AuditService {
  constructor(private readonly cls: ClsService) {}
  log(action: string) {
    const user = this.cls.get<string>("user");
    // ...
  }
}
```

## Concurrence

`AsyncLocalStorage` lie le store au contexte d'exécution asynchrone, pas à une instance. Deux requêtes
concurrentes obtiennent des stores isolés, donc le même singleton retourne la valeur propre à chaque
requête.

## Recommandations

- Centralisez l'`AsyncLocalStorage` dans `ClsService` — n'en instanciez jamais ailleurs.
- Pour des besoins superficiels (un handler qui lit `ctx.user` directement), utilisez simplement le
  contexte ; CLS se justifie quand un graphe de services profond devrait sinon faire passer `ctx`
  partout.
- Appeler `get` en dehors d'une portée retourne `undefined` ; `set` lève une exception. Assurez-vous
  que chaque point d'entrée ayant besoin du contexte ouvre une portée avec `run()`.

Un exemple complet et exécutable se trouve dans `examples/cls-request-context`.
