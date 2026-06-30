---
sidebar_position: 5
---

# Modules de fonctionnalité

Les modules de fonctionnalité sont la colle entre vos contrôleurs et un transport de gateway. Ils encapsulent le câblage : instancier les contrôleurs via DI, résoudre les instances de guard, construire la guard map, et enregistrer les routes résultantes sur la gateway — le tout dans un `onInit()` synthétisé.

`@spinejs/gateway` fournit deux fonctions de confort qui produisent ce câblage à partir d'un binding spécifique au transport :

| Fonction | Style | Quand l'utiliser |
|---|---|---|
| `gatewayFeatureFactory(token, transport)` | Factory — retourne un `DynamicModule` | Enregistrement inline d'une fonctionnalité, sans classe nommée. |
| `gatewayModuleDecorator(token, transport)` | Décorateur — remplace une classe par une sous-classe | Style NestJS, conserve une `export class` nommée. |

Les deux sont liées une fois par transport pour produire les helpers spécifiques à l'application (`ipcFeature` / `@IpcModule` dans l'application de référence).

## Créer des helpers spécifiques au transport

Liez les fonctions génériques à la classe de gateway et au module de votre transport :

```typescript
// electron-ipc-module.ts
import { gatewayFeatureFactory, gatewayModuleDecorator } from '@spinejs/gateway';
import { ElectronIpcGateway } from '@spinejs/electron-ipc-gateway';
import { ElectronIpcGatewayModule } from './electron-ipc-gateway.module';

/**
 * Factory form — no named module class:
 *   imports: [ ipcFeature({ controllers: [PingController] }) ]
 */
export const ipcFeature = gatewayFeatureFactory(ElectronIpcGateway, ElectronIpcGatewayModule);

/**
 * Decorator form — keeps a named module class:
 *   @IpcModule({ controllers: [PingController] })
 *   export class PingModule {}
 */
export const IpcModule = gatewayModuleDecorator(ElectronIpcGateway, ElectronIpcGatewayModule);
```

## `ipcFeature` — forme factory

La forme factory est la primitive. Elle produit un `DynamicModule` qui peut être passé directement à `imports` :

```typescript
import { Module } from '@spinejs/core';
import { ipcFeature } from './electron-ipc-module';
import { HealthController } from './health.controller';
import { UserController } from './user.controller';

@Module({
  imports: [
    ipcFeature({ controllers: [HealthController] }),
    ipcFeature({
      controllers: [UserController],
      imports:   [UserModule],          // additional imports needed by UserController
    }),
  ],
})
export class AppModule {}
```

## `@IpcModule` — forme décorateur

La forme décorateur remplace la classe décorée par une sous-classe dotée du `onInit` synthétisé. Vous conservez une classe de module nommée et exportable :

```typescript
import { IpcModule } from './electron-ipc-module';
import { ProjectsController } from './projects.controller';
import { ProjectsModule } from './projects.module';
import { SessionGuard } from '../session.guard';

@IpcModule({
  controllers: [ProjectsController],
  imports:     [ProjectsModule],
})
export class ProjectsIpcModule {}
```

## `FeatureModuleConfig`

Les deux formes acceptent le même objet de config :

```typescript
interface FeatureModuleConfig extends ModuleMetadata {
  controllers: ProviderConstructor[];
}
```

| Champ | Type | Description |
|---|---|---|
| `controllers` | `ProviderConstructor[]` | Classes de contrôleur à enregistrer. Requis. |
| `imports` | `ModuleEntry[]` | Modules supplémentaires à importer dans ce module de fonctionnalité. |
| `providers` | `ProviderEntry[]` | Providers supplémentaires au-delà des contrôleurs. |
| `exports` | `Token[]` | Tokens à exporter depuis ce module de fonctionnalité. |
| `inject` | `Token[]` | Dépendances de constructeur supplémentaires pour la classe du module (forme décorateur uniquement, pour le constructeur propre à l'utilisateur). |

## Fonctionnement du `onInit()` synthétisé

Quand le module de fonctionnalité s'initialise, le framework :

1. Collecte toutes les classes de guard uniques depuis les métadonnées `@UseGuards` de tous les contrôleurs.
2. Construit l'ordre d'injection DI : `[gatewayToken, ...controllerClasses, ...guardClasses, ...userInject]`.
3. Reçoit les instances résolues de la DI dans le même ordre.
4. Construit le `guardMap: Map<GuardConstructor, Guard>`.
5. Pour chaque contrôleur, appelle `getRoutes(controllerInstance, guardMap)` pour produire `RouteDescriptor[]`.
6. Appelle `gateway.register(routes)` avec tous les descripteurs.
7. Si la classe de l'utilisateur (forme décorateur) a son propre `onInit()`, l'appelle ensuite.

## Exemple complet de câblage

Voici un module de fonctionnalité IPC complet avec guards, contexte authentifié et plusieurs contrôleurs :

```typescript
// projects.ipc.module.ts
import { IpcModule } from '../infrastructure/electron-ipc-module';
import { SessionGuard } from '../infrastructure/session.guard';
import { ProjectsController } from './projects.controller';
import { IssuesController } from './issues.controller';
import { ProjectsModule } from './projects.module';

@IpcModule({
  controllers: [ProjectsController, IssuesController],
  imports: [ProjectsModule],
})
export class ProjectsIpcModule {}
```

```typescript
// projects.controller.ts
import { Controller, Handler, UseGuards } from '@spinejs/gateway';
import { SessionGuard } from '../infrastructure/session.guard';
import { ElectronIpcContext } from '../infrastructure/electron-ipc.types';
import { z } from 'zod';

const createProjectSchema = z.object({ name: z.string().min(1) });

@UseGuards(SessionGuard)
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Handler({ address: 'projects:list' })
  list(ctx: ElectronIpcContext): Promise<Project[]> {
    return this.projectsService.findAll(ctx.session.userId);
  }

  @Handler({ address: 'projects:create', input: createProjectSchema })
  create(ctx: ElectronIpcContext, input: { name: string }): Promise<Project> {
    return this.projectsService.create(ctx.session.userId, input.name);
  }
}
```

```typescript
// main.module.ts
import { Module } from '@spinejs/core';
import { ProjectsIpcModule } from './projects.ipc.module';

@Module({
  imports: [ProjectsIpcModule],
})
export class MainModule {}
```

## Auto-enregistrement des guards

Vous n'avez pas besoin de lister manuellement les classes de guard dans le tableau `providers`. La factory du module de fonctionnalité scanne les métadonnées `@UseGuards` de tous les contrôleurs au moment de la définition et ajoute automatiquement toutes les classes de guard uniques à `providers` et `inject`.

Les guards référencés dans `@UseGuards` doivent tout de même avoir leurs propres dépendances déclarées via `@Inject` sur la classe du guard — le conteneur DI les résout à travers la chaîne normale de providers.
