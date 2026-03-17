import "dotenv/config";

export const config = {
	databaseUrl: process.env.DATABASE_URL ?? "",
	jwtSecret: process.env.JWT_SECRET ?? "secret",
	jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
	encryptionKey: process.env.ENCRYPTION_KEY ?? "",
	port: Number(process.env.PORT) || 3000,
};
