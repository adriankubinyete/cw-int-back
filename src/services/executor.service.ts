import { prisma } from "../lib/prisma";
import { logger, toError } from "../lib/logger";
import { nodeRegistry } from "./nodes/node.registry";
import type { ExecutionContext } from "./nodes/node.interface";
import {
    type ChatwootWebhookPayload,
    extractContact,
    extractConversation,
    extractMessage,
} from "../schemas/chatwoot.schema";
import { IntegrationService } from "./integration.service";

const executorLogger = logger.child({ context: "WorkflowExecutor" });
const integrationService = new IntegrationService();

interface WorkflowNode {
    id: string;
    type: string;
    data: Record<string, any>;
}

interface WorkflowEdge {
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
}

interface WorkflowGraph {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

interface StepResult {
    nodeId: string;
    type: string;
    status: "success" | "error";
    durationMs: number;
    output?: string;
    error?: string;
    [key: string]: any;
}

export class WorkflowExecutor {
    private context: ExecutionContext;
    private steps: StepResult[] = [];

    constructor(
        private workflowId: string,
        private userId: string,
        private graph: WorkflowGraph,
        private chatwootIntegrationId: string,
        payload: ChatwootWebhookPayload,
    ) {
        const contact = extractContact(payload);
        const message = extractMessage(payload);
        const conversation = extractConversation(payload);

        this.context = {
            contact,
            message,
            conversation,
            client: null,
            contracts: [],
            variables: {},
        };
    }

    async run(): Promise<void> {
        const chatwoot = await integrationService.getChatwootClient(
            this.chatwootIntegrationId,
            this.userId,
        );

        const log = await prisma.executionLog.create({
            data: {
                workflowId: this.workflowId,
                status: "RUNNING",
                startedAt: new Date(),
                inputPayload: this.context,
                steps: [],
                contactPhone: this.context.contact.phone ?? null,
            },
        });

        executorLogger.info("execution started", {
            workflowId: this.workflowId,
            logId: log.id,
            contact: this.context.contact,
            conversationId: this.context.conversation.id,
        });

        try {
            const order = this.resolveExecutionOrder();

            for (const nodeId of order) {
                const node = this.graph.nodes.find((n) => n.id === nodeId)!;
                const handler = nodeRegistry.get(node.type);

                const start = Date.now();
                try {
                    const result = await handler.execute({
                        node,
                        execution: this.context,
                        userId: this.userId,
                        chatwoot,
                    });

                    if (result.contextPatch) {
                        this.context = { ...this.context, ...result.contextPatch };
                    }

                    this.steps.push({
                        nodeId: node.id,
                        type: node.type,
                        status: "success",
                        durationMs: Date.now() - start,
                        output: result.output,
                    });
                } catch (err) {
                    const error = toError(err);

                    this.steps.push({
                        nodeId: node.id,
                        type: node.type,
                        status: "error",
                        durationMs: Date.now() - start,
                        error: error.message,
                    });

                    throw error;
                }
            }

            await prisma.executionLog.update({
                where: { id: log.id },
                data: { status: "SUCCESS", finishedAt: new Date(), steps: this.steps },
            });

            executorLogger.info("execution finished", {
                workflowId: this.workflowId,
                logId: log.id,
                steps: this.steps.length,
            });
        } catch (err) {
            await prisma.executionLog.update({
                where: { id: log.id },
                data: {
                    status: "ERROR",
                    finishedAt: new Date(),
                    steps: this.steps,
                    errorMessage: toError(err).message,
                },
            });

            executorLogger.error("execution failed", {
                workflowId: this.workflowId,
                logId: log.id,
                err: toError(err),
            });
        }
    }

    private resolveExecutionOrder(): string[] {
        const { nodes, edges } = this.graph;
        const targetsSet = new Set(edges.map((e) => e.target));
        const roots = nodes.filter((n) => !targetsSet.has(n.id));

        if (roots.length === 0) throw new Error("Workflow has no root node");

        const visited = new Set<string>();
        const order: string[] = [];
        const queue = roots.map((n) => n.id);

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            order.push(current);

            edges
                .filter((e) => e.source === current)
                .forEach((e) => queue.push(e.target));
        }

        return order;
    }
}