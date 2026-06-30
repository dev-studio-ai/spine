---
sidebar_position: 2
---

# Contrôleurs et handlers

Les contrôleurs sont les classes qui portent votre logique de traitement des requêtes. Ils sont déclarés avec `@Controller` et exposent des routes individuelles via `@Handler` sur leurs méthodes.

## `@Controller()`

`@Controller` marque une classe comme contrôleur de gateway. Il ne porte aucune configuration — son seul rôle est de taguer la classe pour que la gateway distingue les contrôleurs des providers ordinaires.

```typescript
import { Controller } from "@spinejs/gateway";

@Controller()
export class UserController {
  // ...
}
```

Une classe de contrôleur doit figurer dans le tableau `controllers` d'un module de fonctionnalité (voir [Modules de fonctionnalité](./feature-modules)). La gateway résout les instances de contrôleur via DI.

## `@Handler({ address, input? })`

`@Handler` déclare une route de gateway sur une méthode. L'`address` est une chaîne opaque au transport : pour l'IPC elle devient le canal `ipcMain.handle` ; pour le HTTP ce pourrait être un chemin ; pour un transport personnalisé elle signifie ce que l'implémentation `bind()` du transport attend.

```typescript
import { Controller, Handler } from "@spinejs/gateway";

@Controller()
export class PingController {
  @Handler({ address: "ping" })
  ping(): string {
    return "pong";
  }
}
```

La méthode handler reçoit deux arguments :

- **`ctx`** — le contexte de transport (typé par le transport ; porte l'événement IPC, les données de session, etc.).
- **`input`** — l'entrée validée, ou l'entrée brute si aucun schéma n'a été fourni.

```typescript
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Handler({ address: "users:get-by-id" })
  getById(ctx: ElectronIpcContext, input: unknown): Promise<User> {
    const id = input as string; // raw — no schema provided
    return this.userService.findById(id);
  }
}
```

### `HandlerOptions`

| Option    | Type                 | Requis | Description                                                                                                                |
| --------- | -------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `address` | `string`             | Oui    | L'adresse de la route. Opaque au transport — interprétée par le `bind()` du transport.                                     |
| `input`   | `ParseableSchema<T>` | Non    | Un schéma avec une méthode `parse(input: unknown): T`. Quand présent, l'entrée brute est validée avant l'appel du handler. |

## Validation d'entrée avec `ParseableSchema<T>`

L'option `input` accepte tout objet doté d'une méthode `parse(input: unknown): T`. Ce contrat structurel est satisfait par les schémas zod sans importer zod dans la bibliothèque gateway.

```typescript
import { z } from "zod";
import { Controller, Handler } from "@spinejs/gateway";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Handler({ address: "users:create", input: createUserSchema })
  create(ctx: ElectronIpcContext, input: CreateUserInput): Promise<User> {
    // `input` is already parsed and typed as CreateUserInput.
    return this.userService.create(input);
  }
}
```

Quand la validation échoue, le port `Validator` (par ex. `ZodValidator`) lève une `ValidationError`, que le pipeline mappe vers le code d'erreur correspondant (typiquement `'INVALID_INPUT'`). La méthode handler n'est jamais appelée.

:::note Inférence de schéma
TypeScript infère `input` comme `CreateUserInput` dans le corps du handler quand le schéma est typé (par ex. `z.ZodObject<...>`). Le générique `In` sur `@Handler<In>` circule depuis le type de retour de `parse` du schéma à travers `HandlerOptions<In>`, donc vous obtenez la sûreté de typage sans aucune annotation explicite sur le paramètre de méthode.
:::

## Injection de constructeur des contrôleurs

Les contrôleurs sont des providers de classe ordinaires dans le conteneur DI. Déclarez leurs dépendances avec `@Injectable` :

```typescript
import { Injectable, InjectionToken } from "@spinejs/core";
import { Controller, Handler } from "@spinejs/gateway";

const userServiceToken = new InjectionToken<UserService>("user-service");

@Injectable({ inject: [userServiceToken] })
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Handler({ address: "users:list" })
  list(): Promise<User[]> {
    return this.userService.findAll();
  }
}
```

Ou bien, en les listant explicitement dans la surcharge `inject` du module de fonctionnalité — mais le pattern `@Injectable` + classe-comme-token est généralement plus simple.

## Valeurs de retour des handlers

Un handler peut retourner une valeur simple ou une `Promise`. Le pipeline encapsule la valeur résolue dans `{ ok: true, data: value }`. Lever une erreur (ou retourner une promesse rejetée) provoque à la place le retour de `{ ok: false, code: <code mappé> }`.

```typescript
@Handler({ address: 'app:version' })
getVersion(): string {
  return '1.0.0';
}
// → { ok: true, data: '1.0.0' }

@Handler({ address: 'data:load' })
async loadData(): Promise<Data> {
  // If this rejects, the error is caught by dispatch() and mapped to a code.
  return await fetchData();
}
// → { ok: true, data: {...} }  or  { ok: false, code: 'SERVER' }
```
