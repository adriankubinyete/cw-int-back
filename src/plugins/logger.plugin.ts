// src/plugins/logger.plugin.ts
import fp from "fastify-plugin"; // npm i fastify-plugin
import type { FastifyInstance } from "fastify";
import { logger } from "../lib/logger";

// Expõe o logger no app e loga cada request/response automaticamente
export const loggerPlugin = fp(async (app: FastifyInstance) => {
  // Torna o logger acessível via app.logger em qualquer lugar
  app.decorate("logger", logger);

  app.addHook("onRequest", (request, _reply, done) => {
    logger.info("incoming request", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
    });
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    logger.info("request completed", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      // @ts-ignore — definido abaixo no onRequest
      responseTimeMs: Date.now() - request.startTime,
    });
    done();
  });

  // Salva o timestamp inicial em cada request
  app.addHook("onRequest", (request, _reply, done) => {
    // @ts-ignore
    request.startTime = Date.now();
    done();
  });
});

// Augment para o TypeScript reconhecer app.logger
declare module "fastify" {
  interface FastifyInstance {
    logger: typeof logger;
  }
}