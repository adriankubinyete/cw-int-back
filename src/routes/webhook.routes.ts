import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger, toError } from "../lib/logger";
import { WorkflowExecutor } from "../services/executor.service";
import type { ChatwootWebhookPayload } from "../schemas/chatwoot.schema";
import { webhookParamsSchema } from "../schemas/chatwoot.schema";

const webhookLogger = logger.child({ context: "WebhookRoutes" });

export async function webhookRoutes(app: FastifyInstance) {
    // rota pública — sem authMiddleware
    app.post("/webhook/:workflowId", async (request, reply) => {
        const { workflowId } = webhookParamsSchema.parse(request.params);
        const payload = request.body as ChatwootWebhookPayload;

        webhookLogger.info("webhook received", {
            workflowId,
            event: payload.event,
            conversationId: payload.id,
        });

        // responde 200 imediatamente — Chatwoot não pode ficar esperando
        reply.code(200).send({ received: true });

        // executa em background
        setImmediate(async () => {
            try {
                const workflow = await prisma.workflow.findUnique({
                    where: { id: workflowId },
                });

                if (!workflow) {
                    webhookLogger.warn("workflow not found", { workflowId });
                    return;
                }

                if (!workflow.isActive) {
                    webhookLogger.info("workflow is inactive, skipping", { workflowId });
                    return;
                }

                if (!workflow.chatwootIntegrationId) {
                    webhookLogger.warn("workflow has no chatwoot integration", { workflowId });
                    return;
                }

                const graph = workflow.graph as { nodes: any[]; edges: any[] };

                const executor = new WorkflowExecutor(
                    workflow.id,
                    workflow.userId,
                    graph,
                    workflow.chatwootIntegrationId, // 👈
                    payload,
                );

                await executor.run();
            } catch (err) {
                webhookLogger.error("unhandled error in webhook background execution", {
                    workflowId,
                    err: toError(err),
                });
            }
        });
    });

    logger.info("- Webhook Routes registered\nPOST   /webhook/:workflowId");
}