import type { IntegrationType } from "@prisma/client";
import { decrypt, encrypt } from "../lib/encryption";
import { prisma } from "../lib/prisma";
import type { ErpAdapter } from "./erp/erp.interface";
import { erpRegistry } from "./erp/erp.registry";
import type { ChatwootAuthConfig, UpdateIntegrationInput } from "../schemas/integrations.schema";
import { ChatwootClient } from "../lib/chatwoot";

// --- helpers ---

async function findOwnedOrThrow(userId: string, integrationId: string) {
    const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
    });

    if (!integration || integration.userId !== userId) {
        throw new Error("INTEGRATION_NOT_FOUND");
    }

    return integration;
}

async function generateDefaultName(userId: string, integrationType: IntegrationType) {
    const count = await prisma.integration.count({
        where: { userId, integrationType },
    });

    return `${integrationType} #${count + 1}`;
}

// --- service ---

const safeSelect = {
    id: true,
    integrationType: true,
    name: true,
    isActive: true,
    testedAt: true,
    createdAt: true,
} as const;

export async function getById(userId: string, integrationId: string) {
    const integration = await findOwnedOrThrow(userId, integrationId);

    return {
        id: integration.id,
        integrationType: integration.integrationType,
        name: integration.name,
        isActive: integration.isActive,
        testedAt: integration.testedAt,
        createdAt: integration.createdAt,
    };
}

export async function list(userId: string, integrationType?: string) {
    return prisma.integration.findMany({
        where: {
            userId,
            ...(integrationType
                ? { integrationType: integrationType.toUpperCase() as IntegrationType }
                : {}),
        },
        select: safeSelect,
        orderBy: { createdAt: "asc" },
    });
}

export async function save(
    userId: string,
    integrationType: string,
    authConfig: unknown,
    erpConfig: unknown = {},
    name?: string,
) {
    const resolvedType = integrationType.toUpperCase() as IntegrationType;
    const resolvedName = name ?? (await generateDefaultName(userId, resolvedType));

    return prisma.integration.create({
        data: {
            userId,
            integrationType: resolvedType,
            name: resolvedName,
            authConfig: encrypt(JSON.stringify(authConfig)),
            erpConfig: encrypt(JSON.stringify(erpConfig)),
            isActive: false,
        },
        select: safeSelect,
    });
}

export async function update(
    userId: string,
    integrationId: string,
    data: UpdateIntegrationInput,
) {
    await findOwnedOrThrow(userId, integrationId);

    return prisma.integration.update({
        where: { id: integrationId },
        data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.auth_config !== undefined && {
                authConfig: encrypt(JSON.stringify(data.auth_config)),
                isActive: false,
                testedAt: null,
            }),
            ...(data.erp_config !== undefined && {
                erpConfig: encrypt(JSON.stringify(data.erp_config)),
            }),
        },
        select: safeSelect,
    });
}

export async function test(userId: string, integrationId: string): Promise<boolean> {
    const integration = await findOwnedOrThrow(userId, integrationId);

    let success: boolean;

    if (integration.integrationType === "CHATWOOT") {
        const auth = JSON.parse(decrypt(integration.authConfig)) as ChatwootAuthConfig;
        success = !!(auth.baseUrl && auth.apiToken); // @TODO: GET /api/v1/profile
    } else {
        const adapter = await getErpAdapter(userId, integrationId);
        success = await adapter.testConnection();
    }

    await prisma.integration.update({
        where: { id: integrationId },
        data: { isActive: success, testedAt: new Date() },
    });

    return success;
}

export async function remove(userId: string, integrationId: string) {
    await findOwnedOrThrow(userId, integrationId);
    await prisma.integration.delete({ where: { id: integrationId } });
}

export async function getErpAdapter(userId: string, integrationId: string): Promise<ErpAdapter> {
    const integration = await findOwnedOrThrow(userId, integrationId);

    if (integration.integrationType === "CHATWOOT") {
        throw new Error("INTEGRATION_NOT_AN_ERP");
    }

    const Adapter = erpRegistry[integration.integrationType];
    if (!Adapter) throw new Error("ERP_NOT_SUPPORTED");

    return new Adapter({
        authConfig: JSON.parse(decrypt(integration.authConfig)),
        erpConfig: JSON.parse(decrypt(integration.erpConfig)),
    });
}

export async function getChatwootClient(userId: string, integrationId: string): Promise<ChatwootClient> {
    const integration = await findOwnedOrThrow(userId, integrationId);

    if (integration.integrationType !== "CHATWOOT") throw new Error("INTEGRATION_NOT_CHATWOOT");
    if (!integration.isActive) throw new Error("INTEGRATION_NOT_ACTIVE");

    const auth = JSON.parse(decrypt(integration.authConfig)) as ChatwootAuthConfig;
    return new ChatwootClient(auth);
}