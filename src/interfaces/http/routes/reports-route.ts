import { createHash } from "node:crypto";
import { extname } from "node:path";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createReport } from "../../../application/reports/create-report";
import { env } from "../../../shared/config/env";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";
import { writeAuditLog } from "../../../infra/logging/audit-logger";

const createReportBodySchema = z
  .object({
    listingId: z.string().uuid().optional(),
    rentalId: z.string().uuid().optional(),
    reason: z.string().min(8).max(300),
    details: z.string().max(2000).optional()
  })
  .refine((body) => body.listingId || body.rentalId, {
    message: "listingId or rentalId must be informed",
    path: ["listingId"]
  });

const reportSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  listingId: z.string().optional(),
  rentalId: z.string().optional(),
  reason: z.string(),
  details: z.string().optional(),
  status: z.enum(["OPEN", "TRIAGED", "RESOLVED", "REJECTED"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const uploadAttachmentBodySchema = z
  .object({
    file: z.string().optional().describe("Arquivo multipart (binário).")
  })
  .nullable()
  .optional();

const uploadAttachmentResponseSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  sha256: z.string().length(64)
});

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const blockedExtensions = new Set([".exe", ".bat", ".cmd", ".ps1", ".sh", ".msi", ".com", ".scr", ".jar", ".js"]);

function containsBlockedExtension(filename: string): boolean {
  const segments = filename
    .toLowerCase()
    .split(".")
    .slice(1)
    .map((segment) => `.${segment}`);

  return segments.some((segment) => blockedExtensions.has(segment));
}

function isExecutableSignature(fileBuffer: Buffer): boolean {
  if (fileBuffer.length >= 2 && fileBuffer[0] === 0x4d && fileBuffer[1] === 0x5a) {
    return true;
  }

  if (
    fileBuffer.length >= 4 &&
    fileBuffer[0] === 0x7f &&
    fileBuffer[1] === 0x45 &&
    fileBuffer[2] === 0x4c &&
    fileBuffer[3] === 0x46
  ) {
    return true;
  }

  return fileBuffer.length >= 2 && fileBuffer[0] === 0x23 && fileBuffer[1] === 0x21;
}

function hasExpectedSignature(mimeType: string, fileBuffer: Buffer): boolean {
  if (mimeType === "application/pdf") {
    return fileBuffer.length >= 5 && fileBuffer.subarray(0, 5).toString("utf8") === "%PDF-";
  }

  if (mimeType === "image/png") {
    return (
      fileBuffer.length >= 8 &&
      fileBuffer[0] === 0x89 &&
      fileBuffer[1] === 0x50 &&
      fileBuffer[2] === 0x4e &&
      fileBuffer[3] === 0x47 &&
      fileBuffer[4] === 0x0d &&
      fileBuffer[5] === 0x0a &&
      fileBuffer[6] === 0x1a &&
      fileBuffer[7] === 0x0a
    );
  }

  if (mimeType === "image/jpeg") {
    return fileBuffer.length >= 3 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff;
  }

  if (mimeType === "image/webp") {
    return (
      fileBuffer.length >= 12 &&
      fileBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      fileBuffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

async function streamToBuffer(part: {
  file: AsyncIterable<Buffer | Uint8Array>;
}): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of part.file) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function reportsRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/reports",
    schema: {
      tags: ["Reports"],
      summary: "Cria denúncia",
      description: "Registra denúncia com classificação automática de severidade.",
      body: createReportBodySchema,
      response: {
        201: reportSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      try {
        const report = await createReport({
          reporterId: context.user.id,
          listingId: request.body.listingId,
          rentalId: request.body.rentalId,
          reason: request.body.reason,
          details: request.body.details
        });

        writeAuditLog(request.log, {
          action: "REPORT_CREATED",
          actorId: context.user.id,
          entityType: "report",
          entityId: report.id,
          metadata: {
            listingId: report.listingId,
            rentalId: report.rentalId,
            riskLevel: report.riskLevel
          }
        });

        return reply.status(201).send({
          ...report,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/reports/attachments",
    schema: {
      tags: ["Reports"],
      summary: "Valida anexo de denúncia",
      description: "Valida upload com proteção contra arquivos maliciosos e abuso de API.",
      consumes: ["multipart/form-data"],
      body: uploadAttachmentBodySchema,
      response: {
        201: uploadAttachmentResponseSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        413: z.object({ error: z.string(), message: z.string() }),
        415: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      if (!request.isMultipart()) {
        return reply.status(400).send({
          error: "InvalidMultipartRequest",
          message: "Expected multipart/form-data with a file field."
        });
      }

      try {
        const part = await request.file();

        if (!part) {
          return reply.status(400).send({
            error: "MissingFile",
            message: "Attachment file is required."
          });
        }

        const normalizedFileName = part.filename.trim().toLowerCase();
        const extension = extname(normalizedFileName);

        if (!allowedExtensions.has(extension) || containsBlockedExtension(normalizedFileName)) {
          return reply.status(415).send({
            error: "UnsupportedFileExtension",
            message: "Only jpg, jpeg, png, webp and pdf files are allowed."
          });
        }

        if (!allowedMimeTypes.has(part.mimetype)) {
          return reply.status(415).send({
            error: "UnsupportedFileType",
            message: "Only image/jpeg, image/png, image/webp and application/pdf are allowed."
          });
        }

        const fileBuffer = await streamToBuffer(part);

        if (fileBuffer.length === 0) {
          return reply.status(400).send({
            error: "EmptyFile",
            message: "Uploaded file cannot be empty."
          });
        }

        if (fileBuffer.length > env.UPLOAD_MAX_SIZE_MB * 1024 * 1024) {
          return reply.status(413).send({
            error: "FileTooLarge",
            message: `File exceeds ${env.UPLOAD_MAX_SIZE_MB}MB limit.`
          });
        }

        if (!hasExpectedSignature(part.mimetype, fileBuffer) || isExecutableSignature(fileBuffer)) {
          writeAuditLog(request.log, {
            action: "MALICIOUS_UPLOAD_BLOCKED",
            actorId: context.user.id,
            entityType: "report-attachment",
            entityId: normalizedFileName,
            metadata: {
              mimeType: part.mimetype,
              size: fileBuffer.length
            }
          });

          return reply.status(415).send({
            error: "MaliciousUploadDetected",
            message: "Attachment signature is invalid or potentially malicious."
          });
        }

        const sha256 = createHash("sha256").update(fileBuffer).digest("hex");

        writeAuditLog(request.log, {
          action: "REPORT_ATTACHMENT_VALIDATED",
          actorId: context.user.id,
          entityType: "report-attachment",
          entityId: sha256,
          metadata: {
            filename: normalizedFileName,
            mimeType: part.mimetype,
            size: fileBuffer.length
          }
        });

        return reply.status(201).send({
          filename: normalizedFileName,
          mimeType: part.mimetype,
          size: fileBuffer.length,
          sha256
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("FST_REQ_FILE_TOO_LARGE") || errorMessage.includes("File too large")) {
          return reply.status(413).send({
            error: "FileTooLarge",
            message: `File exceeds ${env.UPLOAD_MAX_SIZE_MB}MB limit.`
          });
        }

        request.log.error(error as Error);
        return reply.status(400).send({
          error: "UploadValidationFailed",
          message: "Unable to validate attachment upload."
        });
      }
    }
  });
}
