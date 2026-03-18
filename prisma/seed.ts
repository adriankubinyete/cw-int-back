import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encrypt } from "../src/lib/encryption";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
	const admin = await prisma.user.upsert({
		where: { email: "admin@example.com" },
		update: {},
		create: {
			name: "Admin",
			email: "admin@example.com",
			passwordHash: await bcrypt.hash("password", 10),
			integrations: {
				create: [
					{
						name: "test",
						erpType: "IXCSOFT",
						authConfig: encrypt(
							JSON.stringify({
								url: "https://fake.ixcsoft.com.br",
								token: "token",
							}),
						),
					},
				],
			},
			workflows: {
				create: [
					{
						name: "test",
						description: "test",
						graph: { nodes: [], edges: [] },
					},
				],
			},
		},
	});

	console.log({ admin });
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
