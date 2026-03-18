import "dotenv/config";

export const config = {
	databaseUrl: process.env.DATABASE_URL ?? "",
	jwtSecret: process.env.JWT_SECRET ?? "secret",
	jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
	encryptionKey: process.env.ENCRYPTION_KEY ?? "",
	fastifyPort: Number(process.env.FASTIFY_PORT) || 3000,
	fastifyHost: process.env.FASTIFY_HOST ?? "127.0.0.1",
	nodeEnv: process.env.NODE_ENV ?? "development",
	logLevel: process.env.LOG_LEVEL ?? "info",
};
