# @spinejs/config

Typed, async-capable configuration loading for SpineJS. Phantom types bind a config key to its value type at compile time — `ConfigService.get(key)` returns the precise type without casting.

## Quick start

```typescript
import { configKey, ConfigProvider, ConfigModule, ConfigService } from '@spinejs/config';

// 1. Define typed keys
export const apiUrlKey    = configKey<string>('api.url');
export const maxRetriesKey = configKey<number>('api.maxRetries');

// 2. Define providers
export const apiConfig: ConfigProvider<string> = {
  key:    apiUrlKey,
  config: () => process.env.API_URL ?? 'http://localhost:3000',
};

// 3. Register in the module graph
@Module({
  imports: [ConfigModule.configure({ configs: [apiConfig] })],
})
export class AppModule {}

// 4. Inject and use
@Inject([ConfigService])
export class ApiService {
  constructor(private readonly config: ConfigService) {}

  fetch() {
    const url = this.config.get(apiUrlKey); // typed: string
  }
}
```

## `configKey<T>(description)`

Creates a typed `ConfigKey<T>` backed by `Symbol.for(description)`. Two calls with the same description return the same key.

## `ConfigProvider<T>`

```typescript
interface ConfigProvider<T> {
  key:    ConfigKey<T>;
  config: () => T | Promise<T>;
}
```

The factory is called once during `ConfigModule.onInit()`. Async factories are awaited in declaration order, so later providers can read values loaded by earlier ones via `ConfigService.get()`.

## `ConfigModule.configure({ configs })`

```typescript
ConfigModule.configure({
  configs: [jwtConfig, dbConfig, derivedConfig],
})
```

Providers load sequentially. A provider that depends on a previously loaded value can call `configService.get(earlierKey)` inside its factory.

## Async example (Electron `safeStorage`)

```typescript
export const llmApiKeyKey = configKey<string>('llm.apiKey');

export const llmConfig: ConfigProvider<string> = {
  key:    llmApiKeyKey,
  config: async () => {
    const encrypted = await readEncrypted('llm-api-key');
    return safeStorage.decryptString(encrypted);
  },
};
```

## Full docs

[apps/docs/docs/extensions/config](../../apps/docs/docs/extensions/config.md)
