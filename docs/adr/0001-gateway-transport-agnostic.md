# ADR 0001 — Gateway transport-agnostic : `@spinejs/gateway` + `@spinejs/electron-ipc-gateway`

- **Statut** : Accepté
- **Date** : 2026-06-29
- **Portée** : `packages/gateway`, `packages/electron-ipc-gateway`, `packages/electron`
- **Relation** : s'appuie sur le modèle de modules/DI défini dans `packages/core`.

> **Origine** : décision prise dans le repo `studio` (ADR 0010) puis rapatriée ici lors de
> l'extraction du framework dans son propre repo.

## Contexte

Avant cette décision, la logique de gateway IPC était monolithique et couplée à l'application :

- `IpcGateway` / `IpcModule` / `IpcContext` étaient définis directement dans l'app, mêlant
  préoccupations transport (Electron `ipcMain`) et préoccupations applicatives (session, mapping
  d'erreurs, validation).
- L'autorisation était représentée par un flag booléen `auth: boolean` sur chaque handler — pas
  composable, pas testable, non injectable.
- Aucune séparation entre le noyau pipeline (guards → validate → invoke → envelope) et la couche
  transport, rendant tout réutilisable difficile et tout test unitaire coûteux (il fallait mocker
  `ipcMain`).

## Décision

La logique est répartie en trois packages distincts.

### 1. `packages/gateway` — noyau transport-agnostic

Fournit le pipeline partagé et la surface de décoration, sans aucune dépendance externe (seulement
`@spinejs/core`) :

- Classe abstraite `Gateway<Ctx, Code>` : pipeline `guards → validate → invoke → envelope`.
  Toute erreur est capturée et convertie en `{ ok: false, code }` via le port `ErrorMapper<Code>`.
- Décorateurs `@Controller()`, `@Handler({ address, input? })`, `@UseGuards(...guards)`.
  Métadonnées stockées en symboles propres (pas de `reflect-metadata`, compatible esbuild).
- Ports (interfaces DIP) : `Validator`, `ContextFactory<Raw, Ctx>`, `ErrorMapper<Code>`.
  Le noyau ne dépend d'aucune lib de validation ni d'aucune préoccupation applicative.
- Sugar module : `gatewayFeatureFactory` (factory / `DynamicModule`) et `gatewayModuleDecorator`
  (décorateur de classe, style NestJS). Les deux synthétisent un `onInit` qui collecte les routes
  des controllers, construit la `guardMap` et appelle `gateway.register()`.

### 2. `packages/electron-ipc-gateway` — binding Electron IPC

Binding concret du transport Electron :

- `ElectronIpcGateway<Ctx, Code>` étend `Gateway`, implémente `bind()` via `ipcMain.handle()`.
- Agnostique à l'application : le contexte (session, utilisateur) est produit par une
  `ContextFactory<ElectronIpcRaw, Ctx>` injectée — rien d'applicatif ne fuit dans la lib.
- Types de base : `ElectronIpcBaseContext` (contient `event: IpcMainInvokeEvent`),
  `ElectronIpcRaw` (`{ event, args }`).

### 3. `packages/electron` — module cycle de vie Electron

Module `ElectronModule` et `WindowService` pour le cycle de vie de la fenêtre Electron (extrait
dans sa propre lib au même titre que `electron-ipc-gateway`).

### Guards DI-injectables

Les guards remplacent le flag `auth: boolean`. Un guard est une classe ordinaire implémentant
`Guard<Ctx>` (`canActivate(ctx): boolean | Promise<boolean>`), résolue par le conteneur DI.

`@UseGuards(SessionGuard)` s'applique au niveau de la classe (tous les handlers) ou d'une méthode
(un seul handler). `FeatureModuleConfig` collecte automatiquement les classes de guard référencées
et les ajoute à la liste `providers`/`inject` du module synthétisé.

## Alternatives considérées

### Garder tout dans l'application consommatrice

Rejetée : couplage fort entre transport et logique applicative, non réutilisable, tests unitaires
nécessitant de mocker `ipcMain` à chaque fois.

### NestJS microservices / transports NestJS

Rejetée : incompatible avec le pipeline de build esbuild utilisé pour le main Electron (pas de
`reflect-metadata`, tree-shaking du runtime NestJS cassé). `@spinejs/core` couvre exactement le
besoin (modules + DI + lifecycle) sans le poids du runtime NestJS.

### Une seule lib monolithique `electron-ipc-gateway`

Rejetée : fusionne le noyau pipeline (transport-agnostic, testable avec un transport mock) et le
binding Electron (qui dépend du module `electron`). La séparation core/transport est le seul moyen
de tester le pipeline sans lancer un processus Electron.

## Conséquences

- **Positif** : le pipeline est testable via un transport mock (pas d'import `electron` requis dans
  les tests unitaires du noyau).
- **Positif** : réutilisable — un second transport (HTTP, WebSocket) étend `Gateway` sans toucher
  ni `@spinejs/gateway` ni les controllers existants.
- **Positif** : les guards sont composables, injectables par DI, et isolés du transport.
- **Positif** : séparation nette des concerns — le transport ne connaît que l'événement brut ; la
  `ContextFactory` est l'unique point de contact avec la session.
- **Négatif** : 3 packages au lieu de 1. Justifié par la réutilisabilité et la testabilité ; le
  coût d'organisation est faible dans ce monorepo.
- **Attention** : tout nouveau transport doit implémenter `bind()` et fournir ses propres adapteurs
  `ContextFactory`, `ErrorMapper` et `Validator`. Le noyau ne doit pas acquérir de dépendances
  externes.
