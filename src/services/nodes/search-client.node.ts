// src/services/nodes/search-client.node.ts
import type { NodeHandler, NodeExecutionContext, NodeExecutionResult } from "./node.interface";
import * as IntegrationService from "../integration.service";
import { logger } from "../../lib/logger";

const nodeLogger = logger.child({ context: "SearchClientNode" });

export class SearchClientNode implements NodeHandler {
    definition = {
        type: "searchClient",
        label: "Buscar Cliente",
        description: "Busca o cliente no ERP pelo telefone ou CPF/CNPJ.",
        category: "erp" as const,
        icon: "UserSearch",
        configSchema: [
            {
                key: "integrationId",
                label: "Integração ERP",
                type: "integration" as const,
                required: true,
            },
            {
                key: "searchBy",
                label: "Buscar por",
                type: "select" as const,
                required: true,
                options: [
                    { label: "Telefone", value: "phone" },
                    { label: "CPF/CNPJ", value: "document" },
                ],
            },
        ],
        outputs: [
            { key: "found", label: "Cliente encontrado" },
            { key: "not_found", label: "Não encontrado" },
        ],
    };

    async execute({ node, execution, userId }: NodeExecutionContext): Promise<NodeExecutionResult> {
        const { integrationId, searchBy } = node.data;
        if (!integrationId) throw new Error("searchClient: campo 'integrationId' é obrigatório");

        const adapter = await IntegrationService.getErpAdapter(userId, integrationId);

        let client = null;

        if (searchBy === "phone") {
            const phone = execution.contact.phone;
            if (!phone) throw new Error("searchClient: telefone do contato não disponível no contexto");
            client = await adapter.searchClientByPhone(phone);
        } else if (searchBy === "document") {
            const document = execution.variables.document;
            if (!document) throw new Error("searchClient: variável 'document' não disponível no contexto");
            client = await adapter.searchClientByDocument(document);
        } else {
            throw new Error(`searchClient: searchBy inválido: "${searchBy}"`);
        }

        if (client) {
            nodeLogger.info("client found", { nodeId: node.id, clientId: client.id });
            return { output: "found", contextPatch: { client } };
        }

        nodeLogger.info("client not found", { nodeId: node.id });
        return { output: "not_found" };
    }
}