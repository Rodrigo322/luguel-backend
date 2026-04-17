import type { FastifyBaseLogger } from "fastify";

interface AuditLogInput {
  action: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export function writeAuditLog(logger: FastifyBaseLogger, input: AuditLogInput): void {
  logger.info(
    {
      action: input.action,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata
    },
    "audit-log"
  );
}
