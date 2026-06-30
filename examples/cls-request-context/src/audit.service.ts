import { Injectable } from "@spinejs/core";
import { ClsService } from "@spinejs/cls";

/**
 * A deep singleton with NO `ctx` parameter. It reads the current request's data straight from the
 * CLS store, so it sees the right user even though it is shared across all concurrent requests.
 */
@Injectable({ inject: [ClsService] })
export class AuditService {
  constructor(private readonly cls: ClsService) {}

  currentUser(): string {
    return this.cls.get<string>("user") ?? "anonymous";
  }

  currentReqId(): string {
    return this.cls.get<string>("reqId") ?? "none";
  }
}
