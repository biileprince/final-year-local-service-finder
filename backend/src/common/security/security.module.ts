import { Global, Module } from "@nestjs/common";
import { PasswordSecurityService } from "./password-security.service";
import { RateLimitObserverService } from "./rate-limit-observer.service";

/**
 * Holds cross-cutting security utilities that don't belong to any single
 * domain module. Marked @Global so callers don't need to import it.
 */
@Global()
@Module({
  providers: [PasswordSecurityService, RateLimitObserverService],
  exports: [PasswordSecurityService, RateLimitObserverService],
})
export class SecurityModule {}
