# @spinejs/winston-logger

Production-grade logger for SpineJS. Implements the `Logger` interface from `@spinejs/core` — drop-in replacement for the built-in `AppLogger`. Keeps Winston and its transitive deps out of `@spinejs/core`.

## Setup

Pass a `WinstonLogger` instance to `AppOptions.logger`:

```typescript
import { App } from "@spinejs/core";
import { WinstonLogger } from "@spinejs/winston-logger";

const app = new App([AppModule], {
  logger: new WinstonLogger({
    level: process.env.LOG_LEVEL ?? "info",
    stdout: true,
    dir: "/var/log/myapp",
    files: [{ filename: "app.log" }, { filename: "error.log", level: "error" }],
  }),
});
```

The instance is registered under `loggerToken` automatically — no further wiring needed.

## `WinstonLoggerOptions`

| Option       | Type                   | Default  | Description                                                             |
| ------------ | ---------------------- | -------- | ----------------------------------------------------------------------- |
| `level`      | `string`               | `'info'` | Minimum log level.                                                      |
| `stdout`     | `boolean`              | `true`   | Add a Console transport with colored output.                            |
| `dir`        | `string`               | —        | Base directory for file transports. Required when `files` is non-empty. |
| `files`      | `LogFileConfig[]`      | `[]`     | File transport configs (`filename`, optionally `level`, `format`, …).   |
| `transports` | `unknown[]`            | `[]`     | Raw Winston transports (e.g. `DailyRotateFile`).                        |
| `console`    | `ConsoleFormatOptions` | —        | Console formatter tweaks (colors, timestamps, pid).                     |

## Using the logger in modules

```typescript
import { Module, Logger, loggerToken } from "@spinejs/core";

@Module({ inject: [loggerToken] })
export class MyModule {
  constructor(private readonly logger: Logger) {}

  async onInit() {
    this.logger.info("ready", MyModule.name);
  }
}
```

## Advanced: rotating file transport

```typescript
import DailyRotateFile from "winston-daily-rotate-file";

const logger = new WinstonLogger({
  level: "info",
  transports: [
    new DailyRotateFile({
      dirname: "/var/log/myapp",
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
});
```

## Flush on shutdown

`WinstonLogger` implements `Logger.exit()` by draining Winston transports (max 200 ms). `App.exit()` calls this automatically before `process.exit()`.

## Full docs

[apps/docs/docs/extensions/winston-logger](../../apps/docs/docs/extensions/winston-logger.md)
