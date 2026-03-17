import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { config } from "./config";
import { authRoutes } from "./routes/auth.routes";

export function buildApp() {
	const app = Fastify();

	app.register(cors);
	app.register(jwt, { secret: config.jwtSecret });

	app.register(authRoutes, { prefix: "/api" });

	return app;
}
