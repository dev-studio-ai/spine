import { Injectable } from "@spinejs/core";
import { Controller, Handler } from "@spinejs/gateway";
import { AuditService } from "./audit.service";
import type { AppContext } from "./app-context";

/** Shape returned by the `whoami` handler. */
export interface WhoAmIResult {
  user: string;
  reqId: string;
}

/**
 * A singleton controller that never touches `ctx` for identity. It delegates to the singleton
 * `AuditService`, which reads the per-request user from CLS. The `await` forces interleaving so the
 * test exercises concurrent scopes.
 */
@Controller()
@Injectable({ inject: [AuditService] })
export class WhoAmIController {
  constructor(private readonly audit: AuditService) {}

  @Handler({ address: "whoami" })
  async whoami(_ctx: AppContext): Promise<WhoAmIResult> {
    await new Promise((r) => setTimeout(r, 5));
    return { user: this.audit.currentUser(), reqId: this.audit.currentReqId() };
  }
}
