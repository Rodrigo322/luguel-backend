import type { FastifyReply } from "fastify";
import { DomainError } from "../../../domain/shared/errors/domain-error";

export function handleDomainError(reply: FastifyReply, error: unknown): void {
  if (error instanceof DomainError) {
    void reply.status(error.statusCode).send({
      error: error.code,
      message: error.message
    });
    return;
  }

  throw error;
}
