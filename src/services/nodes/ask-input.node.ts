// src/services/nodes/ask-input.node.ts
import type { NodeHandler, NodeExecutionContext, NodeExecutionResult } from "./node.interface";
import { SuspendExecution } from "../runner.service";
import { logger } from "../../lib/logger";
import { interpolate } from "../../utils/format.utils";

const nodeLogger = logger.child({ context: "AskInputNode" });

export class AskInputNode implements NodeHandler {
    definition = {
        type: "askInput",
        label: "Aguardar Resposta",
        description: "Envia uma mensagem ao contato e aguarda a resposta, salvando-a em uma variável.",
        category: "interaction" as const,
        icon: "MessageSquare",
        configSchema: [
            {
                key: "message",
                label: "Mensagem",
                type: "textarea" as const,
                required: true,
            },
            {
                key: "variableName",
                label: "Salvar resposta em",
                type: "text" as const,
                required: true,
            },
            {
                key: "timeoutMinutes",
                label: "Timeout (minutos)",
                type: "number" as const,
                required: false,
            },
        ],
        outputs: [
            { key: "received", label: "Resposta recebida" },
        ],
    };

    async execute({ node, execution, chatwoot }: NodeExecutionContext): Promise<NodeExecutionResult> {
        const { message, variableName, timeoutMinutes } = node.data;

        if (!message) throw new Error("askInput: campo 'message' é obrigatório");
        if (!variableName) throw new Error("askInput: campo 'variableName' é obrigatório");

        const rendered = interpolate(message, execution); // interprets variables
        await chatwoot.sendMessage(execution.conversation.accountId, execution.conversation.id, rendered);

        nodeLogger.info(`waiting for input: variable=${variableName} conversationId=${execution.conversation.id}`);

        throw new SuspendExecution(variableName, node.id, timeoutMinutes ?? 10);
    }
}