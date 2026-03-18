import bcrypt from "bcryptjs";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

const serviceLogger = logger.child({ context: "AuthService" });

export class AuthService {
	async register(name: string, email: string, password: string) {
		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			throw new Error("Email already registered");
		}

		const passwordHash = await bcrypt.hash(password, 10);

		const user = await prisma.user.create({
			data: { name, email, passwordHash },
		});

		serviceLogger.info(`user registered: ${email}, id: ${user.id}`);

		return {
			id: user.id,
			name: user.name,
			email: user.email,
		};
	}

	async login(email: string, password: string) {
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			// there is the slight possibility of a second-channel attack, because we early return if the user is not found
			throw new Error("Invalid credentials");
		}

		const valid = await bcrypt.compare(password, user.passwordHash);

		if (!valid) {
			throw new Error("Invalid credentials");
		}

		serviceLogger.info(
			`user logged in: ${email.replace(/^(.{2})[^@]*(?=@)/, "$1***")}, id: ${user.id}`,
		);

		return {
			id: user.id,
			name: user.name,
			email: user.email,
		};
	}
}
