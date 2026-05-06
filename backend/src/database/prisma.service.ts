import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { applySoftDelete } from "./soft-delete.extension";
import { applyAudit } from "./audit.extension";

function buildExtendedClient(client: PrismaClient) {
  return applyAudit(applySoftDelete(client) as unknown as PrismaClient);
}

type ExtendedClient = ReturnType<typeof buildExtendedClient>;

/**
 * PrismaService extends PrismaClient for lifecycle hooks ($connect/$disconnect)
 * and exposes the soft-delete-aware extended client transparently:
 *
 *   prisma.user.findMany()  -> filtered (deletedAt IS NULL) automatically
 *   prisma.user.delete(...) -> rewritten to set deletedAt = now()
 *
 * Caveat: queries issued inside `$transaction` callbacks receive the un-extended
 * `tx` client by Prisma design. Use `executeInTransaction` below — it re-wraps
 * the tx client with the same extension so soft-delete behavior is preserved.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly extended: ExtendedClient;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({
      adapter,
      log: [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "info" },
        { emit: "stdout", level: "warn" },
        { emit: "stdout", level: "error" },
      ],
    });

    this.extended = buildExtendedClient(this);

    // Forward model accessors (user, booking, …) to the extended client so
    // existing `prisma.user.findMany()` callsites pick up the soft-delete
    // extension automatically. Non-model props ($connect, $transaction,
    // $queryRaw, our custom helpers) stay on `this`.
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (
          typeof prop === "string" &&
          !prop.startsWith("$") &&
          !prop.startsWith("_") &&
          prop in this.extended &&
          typeof (this.extended as any)[prop] === "object"
        ) {
          return (this.extended as any)[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Database connection established");

    if (process.env.NODE_ENV === "development") {
      // @ts-ignore - Prisma event typing
      this.$on("query", (e: any) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Database connection closed");
  }

  /**
   * Clean database for testing purposes.
   * WARNING: only callable when NODE_ENV=test.
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("cleanDatabase can only be used in test environment");
    }

    const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== "_prisma_migrations")
      .map((name) => `"public"."${name}"`)
      .join(", ");

    if (tables.length > 0) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
  }

  /**
   * Run `operation` inside an interactive transaction. The `tx` passed to the
   * callback is wrapped with the soft-delete extension so writes/reads behave
   * the same as outside a transaction.
   */
  async executeInTransaction<T>(
    operation: (tx: ExtendedClient) => Promise<T>,
  ): Promise<T> {
    // Prisma's tx client (the value passed into the $transaction callback) does
    // not expose `$extends` — only the top-level client does. To get an
    // extension-aware tx, call `$transaction` on the already-extended client;
    // its tx clients inherit the extensions automatically.
    return (this.extended as unknown as PrismaClient).$transaction(
      async (tx) => operation(tx as unknown as ExtendedClient),
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}
