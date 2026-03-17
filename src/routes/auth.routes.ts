import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middlewares/auth.middleware";
import { AuthService } from "../services/auth.service";

const authService = new AuthService();

export async function authRoutes(app: FastifyInstance) {
	// @TODO: i dont like schema definition HERE. move this somewhere else
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
			const _user = await authService.register(name, email, password);
		} catch (err) {
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

			return { accessToken, user };
		} catch (_error) {
			return reply.code(401).send({
				message: "Invalid credentials",
			});
		}
	});

	app.get(
		"/auth/me",
		{ preHandler: authMiddleware },
		async (request, _reply) => {
			return { user: request.user };
		},
	);
}
