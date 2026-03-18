import type { NodeHandler, NodeExecutionContext, NodeExecutionResult } from "./node.interface";
import { logger } from "../../lib/logger";
import { interpolate } from "../../utils/format.utils";

const nodeLogger = logger.child({ context: "SendMessageNode" });

export class SendMessageNode implements NodeHandler {
    definition = {
        type: "sendMessage",
        label: "Enviar Mensagem",
        description: "Envia uma mensagem de texto para o contato no Chatwoot.",
        category: "messaging" as const,
        icon: "MessageSquare",
        configSchema: [
            {
                key: "message",
                label: "Mensagem",
                type: "textarea" as const,
                required: true,
                placeholder: "Olá, {{contact.name}}! Como posso ajudar?",
            },
        ],
        outputs: [{ key: "default", label: "Próximo" }],
    };

    async execute({ node, execution, chatwoot }: NodeExecutionContext): Promise<NodeExecutionResult> {
        const raw = node.data.message as string;
        if (!raw) throw new Error("sendMessage: campo 'message' é obrigatório");

        const { accountId, id: conversationId } = execution.conversation;
        if (!accountId || !conversationId) {
            throw new Error("sendMessage: accountId ou conversationId ausente no contexto");
        }

        const rendered = interpolate(raw, execution);
        await chatwoot.sendMessage(accountId, conversationId, rendered);

        nodeLogger.info("message sent", { nodeId: node.id, conversationId, message: rendered });

        return { output: "default" };
    }
}