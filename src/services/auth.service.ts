import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

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

		return {
			id: user.id,
			name: user.name,
			email: user.email,
		};
	}
}
