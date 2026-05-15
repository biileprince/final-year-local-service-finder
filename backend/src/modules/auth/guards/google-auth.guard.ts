import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { GoogleAuthService } from "../google-auth.service";

/**
 * Wraps passport-google-oauth20 so we can carry a signed `state` JWT
 * through the redirect. The state encodes the optional role hint picked
 * on /register, plus a returnUrl so the user lands back where they came
 * from after the callback.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  constructor(private readonly googleAuthService: GoogleAuthService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const role = this.normalizeRole(req.query.role);
    const returnUrl =
      typeof req.query.returnUrl === "string" ? req.query.returnUrl : undefined;
    const state = this.googleAuthService.signState({ role, returnUrl });
    return { scope: ["email", "profile"], state };
  }

  private normalizeRole(raw: unknown): "CUSTOMER" | "PROVIDER" | undefined {
    if (raw === "PROVIDER" || raw === "provider") return "PROVIDER";
    if (raw === "CUSTOMER" || raw === "customer") return "CUSTOMER";
    return undefined;
  }
}
