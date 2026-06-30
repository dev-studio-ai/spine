---
sidebar_position: 4
---

# Validation

La gateway valide l'entrée des handlers via le port `Validator`. Cela garde le cœur de la gateway libre de toute dépendance à l'exécution envers une bibliothèque de validation — vous câblez l'adaptateur de votre choix (zod, joi, class-validator, etc.) au niveau de la couche de transport.

## Le port `Validator`

```typescript
interface Validator {
  validate<T>(schema: ParseableSchema<T>, input: unknown): T;
}
```

La méthode `validate` reçoit :
- **`schema`** — tout objet doté d'une méthode `parse(input: unknown): T` (le type structurel `ParseableSchema<T>`).
- **`input`** — l'entrée brute du transport (typiquement le second argument d'un appel invoke IPC).

Elle doit retourner le `T` parsé et typé en cas de succès, ou **lever `ValidationError`** en cas d'échec.

## `ParseableSchema<T>`

```typescript
interface ParseableSchema<T> {
  parse(input: unknown): T;
}
```

Cette interface structurelle est satisfaite par toute bibliothèque de schéma qui expose une méthode `parse` — notamment **zod**. Parce que l'interface est structurelle (duck typing), le code de votre contrôleur importe directement les schémas zod, tandis que la bibliothèque gateway elle-même ne dépend jamais de zod.

## Implémentation du validateur Zod

Voici l'implémentation `ZodValidator` de l'application Electron de référence :

```typescript
import { ZodError } from 'zod';
import { ParseableSchema, ValidationError, Validator } from '@spinejs/gateway';

export class ZodValidator implements Validator {
  validate<T>(schema: ParseableSchema<T>, input: unknown): T {
    try {
      return schema.parse(input);
    } catch (err) {
      if (err instanceof ZodError) {
        const detail = err.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ');
        throw new ValidationError(detail);
      }
      throw err;
    }
  }
}
```

Le contrat clé : `ZodError` est normalisée en `ValidationError`. Le pipeline de la gateway rattrape `ValidationError` et l'`ErrorMapper` la convertit vers le code d'erreur du transport (par ex. `'INVALID_INPUT'`).

## Câbler le validateur dans la gateway

Le validateur est injecté dans la gateway via un factory provider dans le module de transport :

```typescript
import { InjectionToken, Module } from '@spinejs/core';
import { Validator } from '@spinejs/gateway';
import { ElectronIpcGateway } from '@spinejs/electron-ipc-gateway';
import { ZodValidator } from './zod.validator';

const validatorToken = new InjectionToken<Validator>('validator');

@Module({
  providers: [
    { provide: validatorToken, factory: () => new ZodValidator() },
    {
      provide: ElectronIpcGateway,
      inject: [validatorToken, /* errorMapper, contextFactory, logger */],
      factory: (validator, errorMapper, contextFactory, logger) =>
        new ElectronIpcGateway(validator, errorMapper, contextFactory, logger),
    },
  ],
  exports: [ElectronIpcGateway],
})
export class ElectronIpcGatewayModule {}
```

## Utiliser des schémas dans les handlers

Passez un schéma à `@Handler({ input: schema })`. Le pipeline appelle `validator.validate(schema, rawInput)` avant d'invoquer le handler :

```typescript
import { z } from 'zod';
import { Controller, Handler } from '@spinejs/gateway';

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
});

type LoginInput = z.infer<typeof loginSchema>;

@Controller()
export class AuthController {
  @Handler({ address: 'auth:login', input: loginSchema })
  login(_ctx: ElectronIpcContext, input: LoginInput): Promise<AuthResult> {
    // `input` is already validated — email is a valid email, password has ≥8 chars.
    return this.authService.login(input.email, input.password);
  }
}
```

Si le renderer envoie `{ email: 'not-an-email', password: '123' }`, le handler n'est jamais appelé. La réponse est `{ ok: false, code: 'INVALID_INPUT' }`.

## Handlers sans schéma

Quand `input` est omis de `@Handler`, l'entrée brute du transport est passée directement au handler sans aucune transformation :

```typescript
@Handler({ address: 'ping' })
ping(_ctx: ElectronIpcContext, _input: unknown): string {
  return 'pong';
}
```

C'est très bien pour les handlers qui ne prennent aucune entrée, ou quand vous voulez gérer l'entrée brute vous-même.

## `ValidationError`

`ValidationError` est ré-exportée depuis `@spinejs/gateway`. Importez-la dans votre implémentation de `Validator` et dans votre `ErrorMapper` :

```typescript
import { ValidationError } from '@spinejs/gateway';

// In ErrorMapper.toCode():
if (err instanceof ValidationError) return 'INVALID_INPUT';
```

Le message porté par `ValidationError` n'est pas transmis au consommateur du transport (l'`ErrorMapper` ne retourne que la chaîne de code). Journalisez-le côté serveur si vous avez besoin du détail.
