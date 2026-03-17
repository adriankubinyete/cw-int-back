import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { logger, toError } from "../lib/logger"; // 👈
import { AuthService } from "../services/auth.service";

const authService = new AuthService();

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
			const user = await authService.register(name, email, password);
			logger.info("user registered", { userId: user.id, email });
			return reply.code(201).send(user);
		} catch (err) {
			logger.warn("register failed", { email, err: toError(err) });
			return reply.code(400).send({
				message: err instanceof Error ? err.message : "Register failed",
			});
		}
	});

	app.post("/auth/login", async (request, reply) => {
		const { email, password } = loginSchema.parse(request.body);

		try {
			const user = await authService.login(email, password);

			const accessToken = await reply.jwtSign({
				userId: user.id,
				email: user.email,
			});

			logger.info("user logged in", { userId: user.id, email });
			return { accessToken, user };
		} catch (err) {
			logger.warn("login failed", { email, err: toError(err) });
			return reply.code(401).send({ message: "Invalid credentials" });
		}
	});

	app.get(
		"/auth/me",
		{ preHandler: authMiddleware },
		async (request, _reply) => {
			logger.debug("auth/me", { userId: request.user.userId });
			return { user: request.user };
		},
	);

	logger.info([
		"- Auth Routes registered",
		"POST   /api/auth/register",
		"POST   /api/auth/login",
		"GET    /api/auth/me",
	].join("\n"));
}