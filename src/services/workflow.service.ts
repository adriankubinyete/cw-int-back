import { ExecutionStatus } from "@prisma/client";
import type { UpdateWorkflowInput } from "../schemas/workflow.schema";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

const serviceLogger = logger.child({ context: "WorkflowService" });

export async function listByUser(userId: string) {
    return prisma.workflow.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
            _count: {
                select: { executions: true },
            },
        },
    });
}

export async function findById(id: string) {
    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
    return workflow;
}

export async function findActiveById(id: string) {
    const workflow = await findById(id);
    if (!workflow.isActive) throw new Error("WORKFLOW_INACTIVE");
    if (!workflow.chatwootIntegrationId) throw new Error("WORKFLOW_MISSING_CHATWOOT");
    return workflow;
}

export async function create(userId: string, name: string, description?: string) {
    return prisma.workflow.create({
        data: {
            userId,
            name,
            description: description ?? null,
            graph: { nodes: [], edges: [] },
        },
    });
}

export async function update(id: string, userId: string, data: UpdateWorkflowInput) {
    const workflow = await findById(id);
    if (workflow.userId !== userId) throw new Error("WORKFLOW_FORBIDDEN");

    if (data.graph) {
        await prisma.execution.updateMany({
            where: { workflowId: id, status: "WAITING_INPUT" },
            data: { status: "TIMED_OUT", finishedAt: new Date() },
        });
    }

    return prisma.workflow.update({ where: { id }, data });
}

export async function toggle(id: string, userId: string) {
    const workflow = await findById(id);
    if (workflow.userId !== userId) throw new Error("WORKFLOW_FORBIDDEN");
    
    return prisma.workflow.update({
        where: { id },
        data: { isActive: !workflow.isActive },
        select: { isActive: true },
    });
}

export async function remove(id: string, userId: string) {
    const workflow = await findById(id);
    if (workflow.userId !== userId) throw new Error("WORKFLOW_FORBIDDEN");
    await prisma.workflow.delete({ where: { id } });
}

export async function getExecutions(
    workflowId: string,
    userId: string,
    page: number,
    limit: number,
    status?: string,
) {
    const workflow = await findById(workflowId);
    if (workflow.userId !== userId) throw new Error("WORKFLOW_FORBIDDEN");

    const parsedStatus = Object.values(ExecutionStatus).includes(status as ExecutionStatus)
        ? (status as ExecutionStatus)
        : undefined;

    return prisma.execution.findMany({
        where: { workflowId, status: parsedStatus },
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
    });
}