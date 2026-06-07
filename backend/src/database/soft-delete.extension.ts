import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Models that have a `deletedAt` column (kept in sync with schema.prisma).
 * If you add `deletedAt` to a new model, append its delegate name here.
 */
const SOFT_DELETE_MODELS = new Set<string>([
  "file",
  "user",
  "category",
  "provider",
  "providerGallery",
  "booking",
  "review",
  "message",
]);

function isSoftDeleteModel(model: string | undefined): model is string {
  return !!model && SOFT_DELETE_MODELS.has(model);
}

function withNotDeleted(where: unknown): Record<string, unknown> {
  const w = (where ?? {}) as Record<string, unknown>;
  // Don't override an explicit caller-provided deletedAt filter — that's the
  // escape hatch for admin "list trashed records" use cases.
  if ("deletedAt" in w) return w;
  return { ...w, deletedAt: null };
}

export const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: "soft-delete",
    query: {
      $allModels: {
        // -- READS ----------------------------------------------------------
        async findUnique({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          // findUnique only accepts unique fields in `where`; widen via
          // findFirst so we can also filter deletedAt.
          return (client as any)[model].findFirst({
            ...args,
            where: withNotDeleted(args.where),
          });
        },
        async findUniqueOrThrow({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          return (client as any)[model].findFirstOrThrow({
            ...args,
            where: withNotDeleted(args.where),
          });
        },
        async findFirst({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          args.where = withNotDeleted(args.where) as any;
          return query(args);
        },
        async findFirstOrThrow({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          args.where = withNotDeleted(args.where) as any;
          return query(args);
        },
        async findMany({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          args.where = withNotDeleted(args.where) as any;
          return query(args);
        },
        async count({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          args.where = withNotDeleted(args.where) as any;
          return query(args);
        },
        async aggregate({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          args.where = withNotDeleted(args.where) as any;
          return query(args);
        },
        async groupBy({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          args.where = withNotDeleted(args.where) as any;
          return query(args);
        },

        // -- WRITES (don't touch already-deleted rows) ---------------------
        async update({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          // update() requires a unique where; same widen-via-findFirst trick.
          // To preserve atomicity, do an updateMany scoped by the unique
          // fields plus deletedAt, then re-fetch. Simpler: trust the unique
          // key but block via a precondition check.
          const existing = await (client as any)[model].findFirst({
            where: withNotDeleted(args.where),
            select: { id: true },
          });
          if (!existing) {
            throw new Error(
              `Cannot update ${model}: record not found or has been deleted`,
            );
          }
          return query(args);
        },
        async updateMany({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          args.where = withNotDeleted(args.where) as any;
          return query(args);
        },

        // -- DELETES (convert to soft-delete) ------------------------------
        async delete({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          return (client as any)[model].update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        },
        async deleteMany({ args, query, model }) {
          if (!isSoftDeleteModel(model)) return query(args);
          return (client as any)[model].updateMany({
            where: withNotDeleted(args.where),
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  }),
);

/**
 * Apply the soft-delete extension to a PrismaClient or a transaction client.
 * The return type carries fully-resolved model accessors so callers (e.g.
 * inside `executeInTransaction`) get type-safe `tx.user.findMany(...)`.
 */
export function applySoftDelete<T extends PrismaClient>(client: T) {
  return client.$extends(softDeleteExtension);
}

export type SoftDeleteClient = ReturnType<typeof applySoftDelete>;

