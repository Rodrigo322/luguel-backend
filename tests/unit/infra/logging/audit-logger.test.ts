import { describe, expect, it, vi } from "vitest";
import type { FastifyBaseLogger } from "fastify";
import { writeAuditLog } from "../../../../src/infra/logging/audit-logger";

describe("writeAuditLog", () => {
  it("should emit structured audit payload", () => {
    const info = vi.fn();
    const logger = { info } as unknown as FastifyBaseLogger;

    writeAuditLog(logger, {
      action: "TEST_ACTION",
      actorId: "actor-1",
      entityType: "entity",
      entityId: "entity-1",
      metadata: {
        foo: "bar"
      }
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "TEST_ACTION",
        actorId: "actor-1",
        entityType: "entity",
        entityId: "entity-1"
      }),
      "audit-log"
    );
  });
});
