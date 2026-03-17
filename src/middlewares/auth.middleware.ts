import type { FastifyReply, FastifyRequest } from "fastify";

export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply,
) {
	try {
		await request.jwtVerify();
	} catch {
		reply.code(401).send({
			message: "Unauthorized",
		});
	}
}
