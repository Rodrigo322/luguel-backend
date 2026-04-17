import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const maliciousExecutableBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

describe("Reports attachment upload", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let authCookie: string[] | undefined;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();

    const signup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Uploader",
      email: "uploader@example.com",
      password: "StrongPass123!"
    });
    authCookie = signup.headers["set-cookie"];
  });

  afterAll(async () => {
    await app.close();
  });

  it("should validate and accept allowed attachment", async () => {
    const response = await request(app.server)
      .post("/api/v1/reports/attachments")
      .set("Cookie", authCookie)
      .attach("file", validPngBuffer, {
        filename: "evidencia.png",
        contentType: "image/png"
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.mimeType).toBe("image/png");
    expect(response.body.sha256).toHaveLength(64);
  });

  it("should block executable signature disguised as image", async () => {
    const response = await request(app.server)
      .post("/api/v1/reports/attachments")
      .set("Cookie", authCookie)
      .attach("file", maliciousExecutableBuffer, {
        filename: "foto.png",
        contentType: "image/png"
      });

    expect(response.statusCode).toBe(415);
    expect(response.body.error).toBe("MaliciousUploadDetected");
  });

  it("should block dangerous extensions", async () => {
    const response = await request(app.server)
      .post("/api/v1/reports/attachments")
      .set("Cookie", authCookie)
      .attach("file", validPngBuffer, {
        filename: "arquivo.exe",
        contentType: "application/octet-stream"
      });

    expect(response.statusCode).toBe(415);
    expect(response.body.error).toBe("UnsupportedFileExtension");
  });
});
