// src/app.ts
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { ZodError } from "zod";
import { config } from "./config";
import { logger, toError } from "./lib/logger";
import { loggerPlugin } from "./plugins/logger.plugin";
import { authRoutes } from "./routes/auth.routes";
import { workflowsRoutes } from "./routes/workflows.routes";
import { integrationsRoutes } from "./routes/integrations.routes";

export function buildApp() {
	const app = Fastify({ logger: false });

	app.register(loggerPlugin);
	app.register(cors);
	app.register(jwt, { secret: config.jwtSecret });

	app.register(authRoutes, { prefix: "/api" });
	app.register(workflowsRoutes, { prefix: "/api" });
	app.register(integrationsRoutes, { prefix: "/api" });

	app.setErrorHandler((error, request, reply) => {
		if (error instanceof ZodError) {
			logger.warn("validation error", {
				requestId: request.id,
				url: request.url,
				issues: error.issues,
			});
			return reply.code(400).send({
				message: "Validation error",
				errors: error.issues.map((issue) => ({
					path: issue.path,
					message: issue.message,
				})),
			});
		}

		if (error instanceof Error) {
			if (error.message === "WORKFLOW_NOT_FOUND") {
				logger.warn("workflow not found", {
					requestId: request.id,
					url: request.url,
				});
				return reply.code(404).send({ message: "Workflow not found" });
			}
		}

		logger.error("unhandled exception", {
			requestId: request.id,
			url: request.url,
			err: toError(error),
		});
		return reply.code(500).send({ message: "Internal server error" });
	});

	return app;
}