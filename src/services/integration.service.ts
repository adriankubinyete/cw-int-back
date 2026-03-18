import type { IntegrationType } from "@prisma/client";
import { decrypt, encrypt } from "../lib/encryption";
import { prisma } from "../lib/prisma";
import type { UpdateIntegrationInput } from "../schemas/integrations.schema";
import type { ErpAdapter } from "./erp/erp.interface";
import { erpRegistry } from "./erp/erp.registry";
import { ChatwootClient, type ChatwootAuthConfig } from "../lib/chatwoot";

export class IntegrationService {
	// -------------------------------------------------------------------------
	// GetById — retorna uma integração específica (sem expor authConfig/erpConfig)
	// -------------------------------------------------------------------------
	async getById(userId: string, integrationId: string) {
		const integration = await this.findOwnedOrThrow(userId, integrationId);
		return this.toSafeView(integration);
	}

	// -------------------------------------------------------------------------
	// List — retorna integrações do usuário, nunca expõe authConfig/erpConfig
	// Aceita filtro opcional por erpType (case-insensitive)
	// -------------------------------------------------------------------------
	async list(userId: string, erpType?: string) {
		return prisma.integration.findMany({
			where: {
				userId,
				...(erpType ? { erpType: erpType.toUpperCase() as IntegrationType } : {}),
			},
			select: {
				id: true,
				integrationType: true,
				name: true,
				isActive: true,
				testedAt: true,
				createdAt: true,
			},
			orderBy: { createdAt: "asc" },
		});
	}

	// -------------------------------------------------------------------------
	// Save — cria uma nova integração
	// name é opcional: gera um default baseado em quantas do mesmo tipo existem
	// -------------------------------------------------------------------------
	async save(
		userId: string,
		erpType: string,
		authConfig: unknown,
		erpConfig: unknown = {},
		name?: string,
	) {
		const resolvedIntegrationType = erpType.toUpperCase() as IntegrationType;
		const resolvedName =
			name ?? (await this.generateDefaultName(userId, resolvedIntegrationType));

		return prisma.integration.create({
			data: {
				userId,
				integrationType: resolvedIntegrationType,
				name: resolvedName,
				authConfig: encrypt(JSON.stringify(authConfig)),
				erpConfig: encrypt(JSON.stringify(erpConfig)),
				isActive: false,
			},
			select: {
				id: true,
				integrationType: true,
				name: true,
				isActive: true,
				testedAt: true,
				createdAt: true,
			},
		});
	}

	// -------------------------------------------------------------------------
	// Update — atualiza name, authConfig ou erpConfig
	// Se authConfig mudar, reseta isActive = false (precisa testar de novo)
	// -------------------------------------------------------------------------
	async update(
		userId: string,
		integrationId: string,
		data: UpdateIntegrationInput,
	) {
		await this.findOwnedOrThrow(userId, integrationId);

		return prisma.integration.update({
			where: { id: integrationId },
			data: {
				...(data.name !== undefined ? { name: data.name } : {}),
				...(data.auth_config !== undefined
					? {
							authConfig: encrypt(JSON.stringify(data.auth_config)),
							isActive: false,
							testedAt: null,
						}
					: {}),
				...(data.erp_config !== undefined
					? { erpConfig: encrypt(JSON.stringify(data.erp_config)) }
					: {}),
			},
			select: {
				id: true,
				integrationType: true,
				name: true,
				isActive: true,
				testedAt: true,
			},
		});
	}

	// -------------------------------------------------------------------------
	// Test — testa a conexão com o ERP e atualiza isActive
	// -------------------------------------------------------------------------
	async test(userId: string, integrationId: string): Promise<boolean> {
		const adapter = await this.getAdapter(userId, integrationId);
		const success = await adapter.testConnection();

		await prisma.integration.update({
			where: { id: integrationId },
			data: {
				isActive: success,
				testedAt: new Date(),
			},
		});

		return success;
	}

	// -------------------------------------------------------------------------
	// Delete — remove a integração (verifica ownership antes)
	// -------------------------------------------------------------------------
	async delete(userId: string, integrationId: string) {
		await this.findOwnedOrThrow(userId, integrationId);

		await prisma.integration.delete({
			where: { id: integrationId },
		});
	}

	// -------------------------------------------------------------------------
	// getAdapter — usado pelo executor de workflows
	// Recebe integrationId salvo no nó do grafo
	// Verifica ownership para não permitir uso cross-user
	// -------------------------------------------------------------------------
	async getAdapter(userId: string, integrationId: string): Promise<ErpAdapter> {
		const integration = await this.findOwnedOrThrow(userId, integrationId);

		const Adapter = erpRegistry[integration.integrationType];
		if (!Adapter) {
			throw new Error("ERP_NOT_SUPPORTED");
		}

		const authConfig = JSON.parse(decrypt(integration.authConfig));
		const erpConfig = JSON.parse(decrypt(integration.erpConfig));

		return new Adapter({ authConfig, erpConfig });
	}

	async getChatwootClient(integrationId: string, userId: string): Promise<ChatwootClient> {
        const integration = await prisma.integration.findUnique({
            where: { id: integrationId },
        });

        if (!integration) throw new Error("INTEGRATION_NOT_FOUND");
        if (integration.userId !== userId) throw new Error("INTEGRATION_FORBIDDEN");
        if (integration.integrationType !== "CHATWOOT") {
            throw new Error("INTEGRATION_NOT_CHATWOOT");
        }
        if (!integration.isActive) throw new Error("INTEGRATION_NOT_ACTIVE");

        const auth = JSON.parse(decrypt(integration.authConfig)) as ChatwootAuthConfig;
        return new ChatwootClient(auth);
    }

	// -------------------------------------------------------------------------
	// Helpers privados
	// -------------------------------------------------------------------------

	private async findOwnedOrThrow(userId: string, integrationId: string) {
		const integration = await prisma.integration.findUnique({
			where: { id: integrationId },
		});

		if (!integration || integration.userId !== userId) {
			throw new Error("INTEGRATION_NOT_FOUND");
		}

		return integration;
	}

	private toSafeView(integration: {
		id: string;
		integrationType: IntegrationType;
		name: string;
		isActive: boolean;
		testedAt: Date | null;
		createdAt: Date;
	}) {
		return {
			id: integration.id,
			integrationType: integration.integrationType,
			name: integration.name,
			isActive: integration.isActive,
			testedAt: integration.testedAt,
			createdAt: integration.createdAt,
		};
	}

	private async generateDefaultName(
		userId: string,
		integrationType: IntegrationType,
	): Promise<string> {
		const count = await prisma.integration.count({
			where: { userId, integrationType },
		});

		return `${integrationType} #${count + 1}`;
	}
}
