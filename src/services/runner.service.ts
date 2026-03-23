import { logger, toError } from "../lib/logger";
import { nodeRegistry } from "./nodes/node.registry";
import type { ExecutionContext } from "./nodes/node.interface";
import {
    type ChatwootWebhookPayload,
    extractContact,
    extractConversation,
    extractMessage,
} from "../schemas/chatwoot.schema";
import * as IntegrationService from "./integration.service";
import * as ExecutionService from "./execution.service";
import type { Execution, Prisma, Workflow } from "@prisma/client";
import type { ExecutionSnapshot, StepResult } from "../types";

const runnerLogger = logger.child({ context: "WorkflowRunner" });

// --- tipos ---

interface WorkflowNode {
    id: string;
    type: string;
    data: Record<string, unknown>;
}

interface WorkflowEdge {
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
}

export interface WorkflowGraph {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

export class SuspendExecution {
    constructor(
        public readonly variableName: string,
        public readonly resumeNodeId: string,
        public readonly timeoutMinutes?: number,
    ) { }
}

// --- internals ---

interface ExecuteParams {
    logId: string;
    order: string[];
    graph: WorkflowGraph;
    userId: string;
    context: ExecutionContext;
    steps: StepResult[];
    chatwoot: Awaited<ReturnType<typeof IntegrationService.getChatwootClient>>;
}

const COMMANDS: Record<string, (pending?: Execution) => Promise<void>> = {
    ".end": async (pending) => {
        if (pending) {
            await ExecutionService.markTimedOut(pending.id);
            runnerLogger.info(`execution ended by user command: logId=${pending.id}`);
        }
    },
};

function parseCommand(payload: ChatwootWebhookPayload): string | null {
    const content = extractMessage(payload).content?.trim();
    return content && content in COMMANDS ? content : null;
}

function parseGraph(value: Prisma.JsonValue): WorkflowGraph {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("INVALID_WORKFLOW_GRAPH");
    }

    return value as unknown as WorkflowGraph;
}

function resolveExecutionOrder(graph: WorkflowGraph, startFromNodeId?: string): string[] {
    const { nodes, edges } = graph;

    const roots = startFromNodeId
        ? [{ id: startFromNodeId }]
        : (() => {
              const targets = new Set(edges.map((e) => e.target));
              return nodes.filter((n) => !targets.has(n.id));
          })();

    if (roots.length === 0) throw new Error("WORKFLOW_NO_ROOT_NODE");

    const visited = new Set<string>();
    const order: string[] = [];
    const queue = roots.map((n) => n.id);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        // pula o nó de início quando retomando — ele já foi executado
        if (current !== startFromNodeId) {
            order.push(current);
        }

        edges.filter((e) => e.source === current).forEach((e) => queue.push(e.target));
    }

    return order;
}

async function execute({ logId, order, graph, userId, context, steps, chatwoot }: ExecuteParams): Promise<void> {
    try {
        for (const nodeId of order) {
            const node = graph.nodes.find((n) => n.id === nodeId)!;
            const handler = nodeRegistry.get(node.type);
            const start = Date.now();

            try {
                const result = await handler.execute({ node, execution: context, userId, chatwoot });

                if (result.contextPatch) {
                    context = { ...context, ...result.contextPatch };
                }

                steps.push({
                    nodeId: node.id,
                    type: node.type,
                    status: "success",
                    durationMs: Date.now() - start,
                    output: result.output,
                });
            } catch (err) {
                if (err instanceof SuspendExecution) {
                    await ExecutionService.markSuspended(logId, err, { variables: context.variables, steps });
                    runnerLogger.info(`execution suspended: logId=${logId} waitingVariable=${err.variableName}`);
                    return;
                }

                const error = toError(err);
                steps.push({
                    nodeId: node.id,
                    type: node.type,
                    status: "error",
                    durationMs: Date.now() - start,
                    error: error.message,
                });

                throw error;
            }
        }

        await ExecutionService.markSuccess(logId, steps);
        runnerLogger.info(`execution finished: logId=${logId} steps=${steps.length}`);
    } catch (err) {
        await ExecutionService.markError(logId, steps, toError(err).message);
        runnerLogger.error(`execution failed: logId=${logId}`, err);
    }
}

// --- API pública ---
export async function start(
    workflow: Workflow,
    conversationKey: string,
    payload: ChatwootWebhookPayload,
): Promise<void> {
    const chatwoot = await IntegrationService.getChatwootClient(
        workflow.userId,
        workflow.chatwootIntegrationId!,
    );

    const graph = parseGraph(workflow.graph);

    const context: ExecutionContext = {
        contact: extractContact(payload),
        message: extractMessage(payload),
        conversation: extractConversation(payload),
        client: null,
        contracts: [],
        variables: {},
    };

    const log = await ExecutionService.createExecution(workflow.id, conversationKey, context);
    runnerLogger.info(`execution started: workflowId=${workflow.id} logId=${log.id} key=${conversationKey}`);

    await execute({
        logId: log.id,
        order: resolveExecutionOrder(graph),
        graph,
        userId: workflow.userId,
        context,
        steps: [],
        chatwoot,
    });
}

export async function resume(workflow: Workflow, pending: Execution, payload: ChatwootWebhookPayload): Promise<void> {
    const chatwoot = await IntegrationService.getChatwootClient(
        workflow.userId,
        workflow.chatwootIntegrationId!,
    );

    const graph = parseGraph(workflow.graph);
    const snapshot = pending.snapshot as ExecutionSnapshot;

    runnerLogger.warn(`pending.waitingVariable=${pending.waitingVariable}, payload.message.content=${extractMessage(payload).content}`);

    const rawUserInput = extractMessage(payload).content
    // const userInput = rawUserInput?.replace(/\{\{/g, "\\{\\{").replace(/\}\}/g, "\\}\\}") ?? ""; // no need
    const userInput = rawUserInput

    const context: ExecutionContext = {
        contact: extractContact(payload),
        message: extractMessage(payload),
        conversation: extractConversation(payload),
        client: null,
        contracts: [],
        variables: {
            ...snapshot.variables,
            [pending.waitingVariable!]: userInput,
        },
    };

    await ExecutionService.markRunning(pending.id);
    runnerLogger.info(`execution resumed: logId=${pending.id}`);

    const command = parseCommand(payload);
    if (command) {
        await COMMANDS[command]?.(pending);
        return;
    }

    await execute({
        logId: pending.id,
        order: resolveExecutionOrder(graph, pending.resumeNodeId!),
        graph,
        userId: workflow.userId,
        context,
        steps: snapshot.steps,
        chatwoot,
    });
}