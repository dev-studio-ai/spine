---
sidebar_position: 1
---

# Transport IPC Electron

`@spinejs/electron-ipc-gateway` fournit le binding IPC Electron pour `@spinejs/gateway`. Il lie `Gateway.bind()` à `ipcMain.handle(address, ...)` de sorte que chaque `@Handler({ address })` devienne un canal IPC actif.

## `ElectronIpcGateway`

```typescript
class ElectronIpcGateway<
  Ctx extends ElectronIpcBaseContext = ElectronIpcBaseContext,
  Code extends string = string,
> extends Gateway<Ctx, Code>
```

La gateway est agnostique de l'application : elle connaît `ipcMain` et l'événement Electron, mais rien des sessions ou des utilisateurs. Les préoccupations applicatives sont injectées via le port `ContextFactory`.

### Constructeur

```typescript
new ElectronIpcGateway(
  validator: Validator,
  errorMapper: ErrorMapper<Code>,
  contextFactory: ContextFactory<ElectronIpcRaw, Ctx>,
  logger: Logger,
)
```

Le constructeur est appelé via un factory provider — la classe elle-même n'a pas de décorateur `@Injectable`, ce qui la garde générique vis-à-vis du transport.

### Types

```typescript
// Base context — always available.
interface ElectronIpcBaseContext extends GatewayContext {
  event: IpcMainInvokeEvent;
}

// Raw call data passed to the ContextFactory.
interface ElectronIpcRaw {
  event: IpcMainInvokeEvent;
  args: unknown[];
}
```

## Ce que fournit `ElectronIpcGatewayModule`

`ElectronIpcGatewayModule` est le module de transport. Il câble les trois ports et produit l'instance `ElectronIpcGateway`. Vous le construisez une fois par application et y placez tous ses adaptateurs spécifiques à l'application.

Voici l'implémentation de référence :

```typescript
import { Logger, loggerToken, Module, InjectionToken } from "@spinejs/core";
import { ContextFactory, ErrorMapper, Validator } from "@spinejs/gateway";
import { ElectronIpcGateway } from "@spinejs/electron-ipc-gateway";
import { ZodValidator } from "./zod.validator";
import { ElectronIpcErrorMapper } from "./electron-ipc-error.mapper";
import { SessionContextFactory } from "./session.context-factory";
import { SessionStore } from "../session";

const validatorToken = new InjectionToken<Validator>("validator");
const errorMapperToken = new InjectionToken<ErrorMapper<ErrorCode>>(
  "error-mapper"
);
const contextFactoryToken = new InjectionToken<
  ContextFactory<ElectronIpcRaw, ElectronIpcContext>
>("context-factory");

@Module({
  imports: [SessionModule],
  providers: [
    { provide: validatorToken, factory: () => new ZodValidator() },
    { provide: errorMapperToken, factory: () => new ElectronIpcErrorMapper() },
    {
      provide: contextFactoryToken,
      inject: [SessionStore],
      factory: (session: SessionStore) => new SessionContextFactory(session),
    },
    {
      provide: ElectronIpcGateway,
      inject: [
        validatorToken,
        errorMapperToken,
        contextFactoryToken,
        loggerToken,
      ],
      factory: (
        validator: ZodValidator,
        errorMapper: ElectronIpcErrorMapper,
        contextFactory: SessionContextFactory,
        logger: Logger
      ) =>
        new ElectronIpcGateway(validator, errorMapper, contextFactory, logger),
    },
  ],
  exports: [ElectronIpcGateway],
})
export class ElectronIpcGatewayModule {}
```

## Implémenter les ports

### `ContextFactory` — enrichir le contexte

La `ContextFactory` transforme l'événement Electron brut en un contexte typé que reçoivent vos contrôleurs :

```typescript
import { ContextFactory } from "@spinejs/gateway";
import { ElectronIpcRaw } from "@spinejs/electron-ipc-gateway";

export interface ElectronIpcContext extends ElectronIpcBaseContext {
  session: Session | null;
}

export class SessionContextFactory
  implements ContextFactory<ElectronIpcRaw, ElectronIpcContext>
{
  constructor(private readonly sessionStore: SessionStore) {}

  create(raw: ElectronIpcRaw): ElectronIpcContext {
    return {
      event: raw.event,
      session: this.sessionStore.current(),
    };
  }
}
```

### `ErrorMapper` — mapper les erreurs vers des codes

L'`ErrorMapper` convertit toute erreur levée en une chaîne de code stable. Aucun message d'erreur brut n'atteint jamais le renderer :

```typescript
import {
  ErrorMapper,
  UnauthorizedError,
  ValidationError,
} from "@spinejs/gateway";

type ErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "SERVER"
  | "NETWORK";

export class ElectronIpcErrorMapper implements ErrorMapper<ErrorCode> {
  toCode(err: unknown): ErrorCode {
    if (err instanceof ValidationError) return "INVALID_INPUT";
    if (err instanceof UnauthorizedError) return "UNAUTHORIZED";
    if (err instanceof NotFoundError) return "NOT_FOUND";
    if (err instanceof TypeError) return "NETWORK";
    return "SERVER";
  }
}
```

## Créer les helpers IPC

Liez les fonctions génériques de gateway à votre `ElectronIpcGateway` et `ElectronIpcGatewayModule` :

```typescript
// electron-ipc-module.ts
import {
  gatewayFeatureFactory,
  gatewayModuleDecorator,
} from "@spinejs/gateway";
import { ElectronIpcGateway } from "@spinejs/electron-ipc-gateway";
import { ElectronIpcGatewayModule } from "./electron-ipc-gateway.module";

export const ipcFeature = gatewayFeatureFactory(
  ElectronIpcGateway,
  ElectronIpcGatewayModule
);
export const IpcModule = gatewayModuleDecorator(
  ElectronIpcGateway,
  ElectronIpcGatewayModule
);
```

## Le `SessionGuard`

Un guard est la façon dont vous imposez l'authentification sur les canaux IPC. Puisque la `ContextFactory` enrichit déjà le contexte avec la session, le guard n'a qu'à vérifier :

```typescript
import { Guard } from "@spinejs/gateway";
import { ElectronIpcContext } from "./electron-ipc.types";

export class SessionGuard implements Guard<ElectronIpcContext> {
  canActivate(ctx: ElectronIpcContext): boolean {
    return ctx.session !== null;
  }
}
```

Appliquez-le à tous les handlers qui requièrent une authentification :

```typescript
import { UseGuards } from "@spinejs/gateway";
import { SessionGuard } from "../infrastructure/session.guard";

@UseGuards(SessionGuard)
@Controller()
export class SecureController {
  @Handler({ address: "secure:data" })
  getData(ctx: ElectronIpcContext): Data {
    // Guaranteed: ctx.session is not null.
    return this.dataService.getForUser(ctx.session.userId);
  }
}
```

## Exemple d'application complète

```typescript
// main.ts
import { App } from "@spinejs/core";
import { ElectronModule } from "@spinejs/electron";
import { ConfigModule } from "@spinejs/config";
import { MainModule } from "./modules/main.module";

const app = new App(
  [
    ConfigModule.configure({ configs: [appConfig] }),
    ElectronModule.configure({
      window: {
        width: 1280,
        height: 800,
        webPreferences: {
          preload: join(__dirname, "preload.js"),
          contextIsolation: true,
        },
      },
      devUrl: "http://localhost:5173",
      packagePath: join(__dirname, "../renderer/index.html"),
    }),
    MainModule,
  ],
  { handleProcessExit: false }
);

await app.init();
await app.start();
```

```typescript
// main.module.ts
import { Module, OnInit } from "@spinejs/core";
import { ElectronModule } from "@spinejs/electron";
import { ipcFeature, IpcModule } from "./infrastructure/electron-ipc-module";
import { AuthController } from "./interface/auth.controller";
import { ProjectsController } from "./interface/projects.controller";
import { HealthController } from "./interface/health.controller";
import { ProjectsModule } from "./domain/projects.module";
import { AuthModule } from "./domain/auth.module";

@Module({
  imports: [
    ElectronModule,
    AuthModule,
    ProjectsModule,
    // Factory form — inline, no named class:
    ipcFeature({ controllers: [HealthController] }),
    // Decorator form — named module:
    ProjectsIpcModule,
    AuthIpcModule,
  ],
  inject: [ElectronModule],
})
export class MainModule implements OnInit {
  constructor(private readonly electronModule: ElectronModule) {}

  async onInit(): Promise<void> {
    this.electronModule.createMainWindow();
  }
}
```

## Normalisation de l'entrée brute

Quand `ipcRenderer.invoke(channel, arg1)` envoie un seul argument, la gateway passe `arg1` directement comme `rawInput`. Quand plusieurs arguments sont envoyés (`ipcRenderer.invoke(channel, arg1, arg2)`), ils sont passés sous forme de tableau `[arg1, arg2]`. Votre schéma et votre handler doivent être conçus en conséquence.

:::tip Convention à un seul argument
Tenez-vous-en à un seul argument objet par appel IPC. Cela se mappe proprement à un schéma objet zod et évite l'ambiguïté du tableau. Par exemple : `ipcRenderer.invoke('users:create', { name: 'Alice', email: 'alice@example.com' })`.
:::
