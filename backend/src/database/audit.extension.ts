import { Prisma, PrismaClient } from "@prisma/client";
import { getCurrentActor } from "../common/audit/audit.context";

/**
 * Allow-list of Prisma model delegate names that get audit-logged.
 * Keep the list intentionally narrow — every audit row costs a write, and
 * high-volume tables (Notification, ApiRequestLog, Message) would flood it.
 */
const AUDITED_MODELS = new Set<string>([
  "user",
  "provider",
  "booking",
  "review",
  "category",
  "providerCategory",
  "providerSpecialty",
  "providerGallery",
]);

/**
 * Fields excluded from oldValues/newValues snapshots (sensitive or noisy).
 */
const REDACTED_FIELDS = new Set<string>([
  "password",
  "tokenHash",
]);

function redact(obj: unknown): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_FIELDS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function diffFields(
  oldVals: Record<string, unknown> | undefined,
  newVals: Record<string, unknown> | undefined,
): string[] {
  if (!oldVals || !newVals) return [];
  const changed: string[] = [];
  for (const k of Object.keys(newVals)) {
    if (REDACTED_FIELDS.has(k)) continue;
    const a = oldVals[k];
    const b = newVals[k];
    // Cheap deep-equality for primitives + Date; fine for audit purposes
    if (a instanceof Date && b instanceof Date) {
      if (a.getTime() !== b.getTime()) changed.push(k);
    } else if (a !== b) {
      changed.push(k);
    }
  }
  return changed;
}

async function writeAuditLog(
  client: PrismaClient,
  entry: {
    tableName: string;
    recordId: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
): Promise<void> {
  const actor = getCurrentActor();
  try {
    await client.auditLog.create({
      data: {
        tableName: entry.tableName,
        recordId: entry.recordId,
        action: entry.action,
        oldValues: (entry.oldValues ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        newValues: (entry.newValues ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        changedFields: diffFields(entry.oldValues, entry.newValues),
        userId: actor?.userId ?? null,
        ipAddress: actor?.ipAddress ?? null,
        userAgent: actor?.userAgent ?? null,
      },
    });
  } catch {
    // Never let audit failure break the originating write. The exception
    // filter / Pino logger will pick this up if we surface it elsewhere.
  }
}

/**
 * Apply the audit extension to a PrismaClient. Order with soft-delete:
 *   applyAudit(applySoftDelete(client))
 * — soft-delete intercepts `delete` and rewrites it to an update, so the
 *   audit extension sees the update (action: "DELETE" intent is lost in
 *   that case; we infer it from `data.deletedAt` being set).
 */
export function applyAudit<T extends PrismaClient>(client: T) {
  return client.$extends({
    name: "audit-log",
    query: {
      $allModels: {
        async create({ args, query, model }) {
          const result = await query(args);
          if (model && AUDITED_MODELS.has(model)) {
            const id = (result as { id?: string })?.id;
            if (id) {
              void writeAuditLog(client, {
                tableName: model,
                recordId: id,
                action: "CREATE",
                newValues: redact(result),
              });
            }
          }
          return result;
        },

        async update({ args, query, model }) {
          if (!model || !AUDITED_MODELS.has(model)) return query(args);

          const before = await (client as any)[model].findFirst({
            where: args.where,
          });
          const result = await query(args);
          const id = (result as { id?: string })?.id;
          if (id) {
            const isSoftDelete =
              !!(args.data as Record<string, unknown> | undefined)?.deletedAt;
            void writeAuditLog(client, {
              tableName: model,
              recordId: id,
              action: isSoftDelete ? "DELETE" : "UPDATE",
              oldValues: redact(before),
              newValues: redact(result),
            });
          }
          return result;
        },

        async delete({ args, query, model }) {
          if (!model || !AUDITED_MODELS.has(model)) return query(args);

          const before = await (client as any)[model].findFirst({
            where: args.where,
          });
          const result = await query(args);
          const id =
            (result as { id?: string })?.id ?? (before as { id?: string })?.id;
          if (id) {
            void writeAuditLog(client, {
              tableName: model,
              recordId: id,
              action: "DELETE",
              oldValues: redact(before),
            });
          }
          return result;
        },
      },
    },
  });
}

export type AuditedClient = ReturnType<typeof applyAudit>;
