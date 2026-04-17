import { describe, expect, it, vi } from "vitest";
import type { FastifyReply } from "fastify";
import { requireRoles } from "../../../../../src/interfaces/http/auth/guards";

describe("requireRoles", () => {
  it("should allow access when role is authorized", () => {
    const reply = {
      status: vi.fn(),
      send: vi.fn(),
      log: { info: vi.fn() },
      request: {
        method: "GET",
        url: "/api/v1/resource"
      }
    } as unknown as FastifyReply;

    const result = requireRoles(
      {
        session: {
          session: {},
          user: { id: "user-1", email: "user-1@example.com", name: "User 1" }
        },
        user: {
          id: "user-1",
          name: "User 1",
          email: "user-1@example.com",
          role: "LOCADOR",
          reputationScore: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      ["LOCADOR"],
      reply
    );

    expect(result).toBe(true);
  });

  it("should deny access when role is not authorized", () => {
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const reply = {
      status,
      send,
      log: { info: vi.fn() },
      request: {
        method: "GET",
        url: "/api/v1/admin/secure"
      }
    } as unknown as FastifyReply;

    const result = requireRoles(
      {
        session: {
          session: {},
          user: { id: "user-2", email: "user-2@example.com", name: "User 2" }
        },
        user: {
          id: "user-2",
          name: "User 2",
          email: "user-2@example.com",
          role: "LOCATARIO",
          reputationScore: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      ["ADMIN"],
      reply
    );

    expect(result).toBe(false);
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith({
      error: "Forbidden",
      message: "Insufficient role permissions."
    });
  });
});
