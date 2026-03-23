import type { FastifyInstance } from "fastify";
import { logger } from "../lib/logger";
import { webhookParamsSchema, type ChatwootWebhookPayload } from "../schemas/chatwoot.schema";
import * as WorkflowService from "../services/workflow.service";
import * as ExecutionService from "../services/execution.service";
import * as Runner from "../services/runner.service";

const webhookLogger = logger.child({ context: "WebhookRoutes" });

export async function webhookRoutes(app: FastifyInstance) {
    app.post("/webhook/:workflowId", async (request, reply) => {
        const { workflowId } = webhookParamsSchema.parse(request.params);
        const payload = request.body as ChatwootWebhookPayload;

        reply.code(200).send({ received: true });

        // log all request info
        // webhookLogger.info(`webhook received`, {
        //     workflowId,
        //     ip: request.ip,
        //     userAgent: request.headers["user-agent"],
        //     event: payload.event,
        //     accountId: payload.account_id,
        //     conversationId: payload.id,
        //     messageType: payload.messages?.[0]?.message_type,
        // });

        setImmediate(async () => {
            try {
                const messageType = payload.messages?.[0]?.message_type;
                if (messageType !== "incoming") {
                    webhookLogger.debug(`skipping non-incoming message: workflowId=${workflowId} type=${messageType}`);
                    return;
                }

                // @TODO (CRITICAL BEFORE PROD, IGNORED FOR PROOF OF CONCEPT RIGHT NOW)
                // validate user here somehow, based on the ip that is making the request
                // something like adding allowedIps to the Integration part and checking if it matches
                // or inside the Webhook itself "allowedIps" that can trigger the webhook.
                // this could still fall for a fake ip attack so beware.

                const workflow = await WorkflowService.findActiveById(workflowId);
                const conversationKey = `${workflow.chatwootIntegrationId}-${payload.account_id}-${payload.id}`;
                const pending = await ExecutionService.findPendingByConversation(conversationKey);

                webhookLogger.info(`Incoming Message for ${conversationKey}: "${payload.messages?.[0]?.content}"`);

                if (pending) {
                    const elapsed = Date.now() - pending.lastInteraction!.getTime();
                    const expired = elapsed > pending.timeoutMinutes * 60 * 1000;

                    if (!expired) {
                        webhookLogger.debug(`resuming execution: executionId=${pending.id} key=${conversationKey}`);
                        await Runner.resume(workflow, pending, payload);
                        return;
                    }

                    webhookLogger.debug(`execution timed out, starting fresh: executionId=${pending.id} key=${conversationKey}`);
                    await ExecutionService.markTimedOut(pending.id);
                }

                webhookLogger.debug(`starting new execution: workflowId=${workflowId} key=${conversationKey}`);
                await Runner.start(workflow, conversationKey, payload);
            } catch (err) {
                webhookLogger.error(`webhook execution failed: workflowId=${workflowId}`, err);
            }
        });
    });

    logger.info("- Webhook Routes registered\nPOST   /webhook/:workflowId");
}