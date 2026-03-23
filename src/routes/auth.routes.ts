import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger, toError } from "../lib/logger";
import { authMiddleware } from "../middlewares/auth.middleware";
import * as AuthService from "../services/auth.service";

const routeLogger = logger.child({ context: "AuthRoutes" });

export async function authRoutes(app: FastifyInstance) {
	const registerSchema = z.object({
		name: z.string().min(2),
		email: z.email(),
		password: z.string().min(6),
	});

	const loginSchema = z.object({
		email: z.email(),
		password: z.string(),
	});

	app.post("/auth/register", async (request, reply) => {
		const { name, email, password } = registerSchema.parse(request.body);

		try {
			const user = await AuthService.register(name, email, password);
			routeLogger.info("user registered", { userId: user.id, email });
			return reply.code(201).send(user);
		} catch (err) {
			routeLogger.warn("register failed", { email, err: toError(err) });
			return reply.code(400).send({
				message: err instanceof Error ? err.message : "Register failed",
			});
		}
	});

	app.post("/auth/login", async (request, reply) => {
		const { email, password } = loginSchema.parse(request.body);

		try {
			const user = await AuthService.login(email, password);

			const accessToken = await reply.jwtSign({
				userId: user.id,
				email: user.email,
			});

			routeLogger.info("user logged in", { userId: user.id, email });
			return { accessToken, user };
		} catch (err) {
			routeLogger.warn("login failed", { email, err: toError(err) });
			return reply.code(401).send({ message: "Invalid credentials" });
		}
	});

	app.get(
		"/auth/me",
		{ preHandler: authMiddleware },
		async (request, _reply) => {
			routeLogger.debug("auth/me", { userId: request.user.userId });
			return { user: request.user };
		},
	);

	routeLogger.info(
		[
			"- Auth Routes registered",
			"POST   /api/auth/register - create a new user",
			"POST   /api/auth/login    - logs an user to get access token",
			"GET    /api/auth/me       - returns the current authenticated user",
		].join("\n"),
	);
}
