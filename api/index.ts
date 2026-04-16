import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/interfaces/http/app";

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = buildApp().then(async (app) => {
      await app.ready();
      return app;
    });
  }

  try {
    return await appPromise;
  } catch (error) {
    appPromise = null;
    throw error;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    app.server.emit("request", req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "BootFailure",
        message: "Unable to initialize API runtime."
      })
    );
  }
}
