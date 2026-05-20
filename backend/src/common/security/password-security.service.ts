import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import {
  ErrorCode,
  UnprocessableDomainError,
} from "../../common/errors";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";
const HIBP_TIMEOUT_MS = 2_500;

/**
 * Checks new passwords against Have I Been Pwned's k-anonymity API
 * (https://haveibeenpwned.com/API/v3#PwnedPasswords). The first 5 hex chars of
 * the SHA-1 are sent to HIBP; the rest of the hash is compared locally — the
 * full password is never transmitted.
 *
 * Behaviour:
 *  - Fail-open: if HIBP is unreachable or slow, we don't block the password
 *    change. Logging the failure lets us spot a sustained outage; blocking
 *    legitimate signups when a third party is down is the worse trade.
 *  - Hard-block when the password appears in any breach (count >= 1). The
 *    UnprocessableDomainError surfaces `PASSWORD_COMPROMISED` so the frontend
 *    can render targeted copy ("This password has appeared in known data
 *    breaches — please pick a different one").
 *  - Disable for tests / offline envs by setting `HIBP_ENABLED=false`.
 */
@Injectable()
export class PasswordSecurityService {
  private readonly logger = new Logger(PasswordSecurityService.name);

  constructor(private readonly configService: ConfigService) {}

  private get enabled(): boolean {
    return this.configService.get<string>("HIBP_ENABLED", "true") !== "false";
  }

  /** Throws PASSWORD_COMPROMISED if HIBP finds the password in a breach. */
  async assertNotBreached(password: string): Promise<void> {
    if (!this.enabled) return;

    const sha1 = createHash("sha1")
      .update(password)
      .digest("hex")
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    let body: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
      const res = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
        headers: { "Add-Padding": "true" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        this.logger.warn(`HIBP returned ${res.status} for prefix ${prefix}`);
        return; // fail-open
      }
      body = await res.text();
    } catch (err) {
      this.logger.warn(
        `HIBP lookup failed (failing open): ${(err as Error).message}`,
      );
      return; // fail-open
    }

    // Each line is "SUFFIX35:COUNT". When Add-Padding is on, some entries
    // have count=0 to mask the real candidates — ignore those.
    for (const line of body.split(/\r?\n/)) {
      const [candidate, countStr] = line.split(":");
      if (!candidate || !countStr) continue;
      if (candidate.toUpperCase() !== suffix) continue;
      const count = parseInt(countStr, 10);
      if (Number.isFinite(count) && count > 0) {
        throw new UnprocessableDomainError(
          ErrorCode.PASSWORD_COMPROMISED,
          "This password has appeared in known data breaches. Please pick a different one.",
        );
      }
    }
  }
}
