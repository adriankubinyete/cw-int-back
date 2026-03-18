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
						name: "IXC - Teste",
						integrationType: "IXCSOFT",
						authConfig: encrypt(
							JSON.stringify({
								url: "https://fake.ixcsoft.com.br",
								token: "token",
							}),
						),
					},
					{
						name: "Chatwoot - Teste",
						integrationType: "CHATWOOT",
						authConfig: encrypt(
							JSON.stringify({
								baseUrl: "https://fake.chatwoot.com.br",
								apiToken: "token",
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
						// chatwootIntegrationId vai ser vinculado depois do create
						// porque precisamos do id gerado
					},
				],
			},
		},
		include: {
			integrations: true,
			workflows: true,
		},
	});

	// vincula o workflow à integração do Chatwoot
	const chatwootIntegration = admin.integrations.find(
		(i) => i.integrationType === "CHATWOOT"
	);
	const workflow = admin.workflows[0];

	if (chatwootIntegration && workflow) {
		await prisma.workflow.update({
			where: { id: workflow.id },
			data: { chatwootIntegrationId: chatwootIntegration.id },
		});
	}

	console.log({
		admin: { id: admin.id, email: admin.email },
		integrations: admin.integrations.map((i) => ({ id: i.id, name: i.name, type: i.integrationType })),
		workflow: { id: workflow?.id, chatwootIntegrationId: chatwootIntegration?.id },
	});
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