import { Global, Module } from "@nestjs/common";
import { PasswordSecurityService } from "./password-security.service";

/**
 * Holds cross-cutting security utilities that don't belong to any single
 * domain module. Marked @Global so callers don't need to import it.
 */
@Global()
@Module({
  providers: [PasswordSecurityService],
  exports: [PasswordSecurityService],
})
export class SecurityModule {}
