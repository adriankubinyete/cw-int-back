// src/plugins/logger.plugin.ts

import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin"; // npm i fastify-plugin
import { logger } from "../lib/logger";

// Expõe o logger no app e loga cada request/response automaticamente
export const loggerPlugin = fp(async (app: FastifyInstance) => {
	// Torna o logger acessível via app.logger em qualquer lugar
	app.decorate("logger", logger);

	app.addHook("onRequest", (request, _reply, done) => {
		logger.silly(`incoming request: id=${request.id} method=${request.method} url=${request.url} ip=${request.ip}`);
		done();
	});

	app.addHook("onResponse", (request, reply, done) => {
		// @ts-expect-error shut up?
		logger.silly(`request completed: id=${request.id} method=${request.method} url=${request.url}: statusCode=${reply.statusCode} responseTimeMs=${Date.now() - request.startTime}ms`);
		done();
	});

	// Salva o timestamp inicial em cada request
	app.addHook("onRequest", (request, _reply, done) => {
		// @ts-expect-error
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
