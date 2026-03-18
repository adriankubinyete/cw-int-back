import { prisma } from '../lib/prisma'
import { decrypt, encrypt } from '../lib/encryption'
import { erpRegistry } from './erp/erp.registry'
import type { ErpAdapter } from './erp/erp.interface'
import type { UpdateIntegrationInput } from '../schemas/integrations.schema'
import { ErpType } from '@prisma/client'

export class IntegrationService {

    // -------------------------------------------------------------------------
    // GetById — retorna uma integração específica (sem expor authConfig/erpConfig)
    // -------------------------------------------------------------------------
    async getById(userId: string, integrationId: string) {
        const integration = await this.findOwnedOrThrow(userId, integrationId)
        return this.toSafeView(integration)
    }

    // -------------------------------------------------------------------------
    // List — retorna integrações do usuário, nunca expõe authConfig/erpConfig
    // Aceita filtro opcional por erpType (case-insensitive)
    // -------------------------------------------------------------------------
    async list(userId: string, erpType?: string) {
        return prisma.integration.findMany({
            where: {
                userId,
                ...(erpType ? { erpType: erpType.toUpperCase() as ErpType } : {}),
            },
            select: {
                id: true,
                erpType: true,
                name: true,
                isActive: true,
                testedAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        })
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
        const resolvedErpType = erpType.toUpperCase() as ErpType
        const resolvedName = name ?? (await this.generateDefaultName(userId, resolvedErpType))

        return prisma.integration.create({
            data: {
                userId,
                erpType: resolvedErpType,
                name: resolvedName,
                authConfig: encrypt(JSON.stringify(authConfig)),
                erpConfig: encrypt(JSON.stringify(erpConfig)),
                isActive: false,
            },
            select: {
                id: true,
                erpType: true,
                name: true,
                isActive: true,
                testedAt: true,
                createdAt: true,
            },
        })
    }

    // -------------------------------------------------------------------------
    // Update — atualiza name, authConfig ou erpConfig
    // Se authConfig mudar, reseta isActive = false (precisa testar de novo)
    // -------------------------------------------------------------------------
    async update(userId: string, integrationId: string, data: UpdateIntegrationInput) {
        await this.findOwnedOrThrow(userId, integrationId)

        return prisma.integration.update({
            where: { id: integrationId },
            data: {
                ...(data.name !== undefined
                    ? { name: data.name }
                    : {}),
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
                erpType: true,
                name: true,
                isActive: true,
                testedAt: true,
            },
        })
    }

    // -------------------------------------------------------------------------
    // Test — testa a conexão com o ERP e atualiza isActive
    // -------------------------------------------------------------------------
    async test(userId: string, integrationId: string): Promise<boolean> {
        const adapter = await this.getAdapter(userId, integrationId)
        const success = await adapter.testConnection()

        await prisma.integration.update({
            where: { id: integrationId },
            data: {
                isActive: success,
                testedAt: new Date(),
            },
        })

        return success
    }

    // -------------------------------------------------------------------------
    // Delete — remove a integração (verifica ownership antes)
    // -------------------------------------------------------------------------
    async delete(userId: string, integrationId: string) {
        await this.findOwnedOrThrow(userId, integrationId)

        await prisma.integration.delete({
            where: { id: integrationId },
        })
    }

    // -------------------------------------------------------------------------
    // getAdapter — usado pelo executor de workflows
    // Recebe integrationId salvo no nó do grafo
    // Verifica ownership para não permitir uso cross-user
    // -------------------------------------------------------------------------
    async getAdapter(userId: string, integrationId: string): Promise<ErpAdapter> {
        const integration = await this.findOwnedOrThrow(userId, integrationId)

        const Adapter = erpRegistry[integration.erpType]
        if (!Adapter) {
            throw new Error('ERP_NOT_SUPPORTED')
        }

        const authConfig = JSON.parse(decrypt(integration.authConfig))
        const erpConfig = JSON.parse(decrypt(integration.erpConfig))

        return new Adapter({ authConfig, erpConfig })
    }

    // -------------------------------------------------------------------------
    // Helpers privados
    // -------------------------------------------------------------------------

    private async findOwnedOrThrow(userId: string, integrationId: string) {
        const integration = await prisma.integration.findUnique({
            where: { id: integrationId },
        })

        if (!integration || integration.userId !== userId) {
            throw new Error('INTEGRATION_NOT_FOUND')
        }

        return integration
    }

    private toSafeView(integration: {
        id: string
        erpType: ErpType
        name: string
        isActive: boolean
        testedAt: Date | null
        createdAt: Date
    }) {
        return {
            id: integration.id,
            erpType: integration.erpType,
            name: integration.name,
            isActive: integration.isActive,
            testedAt: integration.testedAt,
            createdAt: integration.createdAt,
        }
    }

    private async generateDefaultName(userId: string, erpType: ErpType): Promise<string> {
        const count = await prisma.integration.count({
            where: { userId, erpType },
        })

        return `${erpType} #${count + 1}`
    }
}