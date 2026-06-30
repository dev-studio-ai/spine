---
sidebar_position: 1
---

# Aperçu Gateway

`@spinejs/gateway` est le pipeline de requête indépendant du transport qui s'intercale entre votre logique applicative et la couche de communication (IPC, HTTP, WebSocket, ou tout transport personnalisé). Il définit un contrat requête/réponse cohérent sans se lier à un runtime particulier.

## Philosophie de conception

Une erreur fréquente dans les applications Electron est d'écrire des handlers IPC qui appellent directement les services applicatifs, dispersent la logique de guard et passent des objets `IpcMainInvokeEvent` bruts au code métier. La gateway élimine ce couplage en établissant un pipeline clair aux responsabilités explicites.

```
Raw transport call
  │
  ▼
ContextFactory.create(raw)        ← enriches the call with app context (session, user, …)
  │
  ▼
Guards: canActivate(ctx)?         ← authorization checks (DI-resolved, composable)
  │
  ▼
Validator.validate(schema, input) ← input narrowing (zod, or any parse()-compatible schema)
  │
  ▼
Handler method invocation         ← your controller, receiving (ctx, input)
  │
  ▼
Envelope<T, Code>                 ← { ok: true, data } | { ok: false, code }
  │
  ▼
Transport sends the envelope back
```

La méthode `dispatch()` de la gateway implémente ce pipeline. Elle **ne lève jamais d'exception** : toute erreur — rejet de guard, échec de validation, exception de handler — est rattrapée et mappée vers un code d'erreur stable via `ErrorMapper`. L'appelant reçoit toujours une `Envelope`.

:::info Pourquoi une enveloppe, et non une exception levée ?
Les frontières de transport (IPC, HTTP) sérialisent mal les exceptions levées et laissent fuiter les stack traces. Retourner une `Envelope` discriminée garde le contrat explicite et la surface d'erreur stable pour chaque consommateur.
:::

## `Envelope<T, Code>`

Chaque handler retourne son résultat encapsulé dans une `Envelope` :

```typescript
type Envelope<T, Code extends string = string> =
  | { ok: true;  data: T    }
  | { ok: false; code: Code };
```

Côté renderer (ou tout consommateur du transport), vous discriminez sur `ok` :

```typescript
const result = await ipcRenderer.invoke('users:list');
if (result.ok) {
  console.log(result.data); // User[]
} else {
  console.error(result.code); // e.g. 'UNAUTHORIZED', 'SERVER', 'INVALID_INPUT'
}
```

Les codes d'erreur sont des chaînes définies par l'application — le cœur de la gateway ne laisse jamais fuiter de messages d'erreur bruts ni de stack traces vers le consommateur du transport.

## Conception indépendante du transport

La classe abstraite `Gateway<Ctx, Code>` détient la logique du pipeline. Les transports concrets l'étendent et implémentent une seule méthode :

```typescript
abstract class Gateway<Ctx extends GatewayContext, Code extends string> {
  protected abstract bind(route: RouteDescriptor<Ctx>): void;
}
```

`bind()` est appelée une fois par route enregistrée et a la responsabilité d'attacher un écouteur de transport (par ex. `ipcMain.handle(address, ...)` pour l'IPC). La méthode partagée `dispatch()` est ensuite appelée depuis cet écouteur.

Cela signifie que le même code `@Controller` / `@Handler` peut servir un transport IPC dans une application Electron et un transport HTTP dans une application Fastify, sans aucune modification du contrôleur.

## Ports

Trois interfaces définissent les points d'extension de la gateway. Votre module de transport fournit des implémentations concrètes :

| Port | Responsabilité |
|---|---|
| `ContextFactory<Raw, Ctx>` | Construit un contexte typé à partir des données d'appel brutes du transport. |
| `Validator` | Valide l'entrée brute contre un schéma ; lève `ValidationError` en cas d'échec. |
| `ErrorMapper<Code>` | Mappe toute erreur levée vers une chaîne de code d'erreur stable. |

Le module de transport câble ces implémentations dans la gateway via des factory providers DI. Le code des contrôleurs et des modules de fonctionnalité ne touche jamais directement aux ports.

## Types d'erreur

Deux classes d'erreur font partie de l'API publique de la gateway :

| Classe | Quand la lever |
|---|---|
| `ValidationError` | Levée par le `Validator` quand le parsing du schéma échoue. |
| `UnauthorizedError` | Levée par le pipeline quand le `canActivate()` d'un guard retourne `false`. |

Le code applicatif peut lever ses propres types d'erreur ; l'`ErrorMapper` les rattrape tous et les mappe vers des codes.
