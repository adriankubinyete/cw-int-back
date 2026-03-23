import { prisma } from "../lib/prisma";
import type { ExecutionSnapshot, StepResult } from "../types";
import type { ExecutionContext } from "./nodes/node.interface";
import type { SuspendExecution } from "./runner.service";


export async function createExecution(workflowId: string, conversationKey: string, context: ExecutionContext) {
    return prisma.execution.create({
        data: {
            workflowId,
            status: "RUNNING",
            startedAt: new Date(),
            inputPayload: context,
            steps: [],
            contactPhone: context.contact.phone ?? null,
            conversationKey,
        },
    });
}

export async function markRunning(executionId: string) {
    return prisma.execution.update({
        where: { id: executionId },
        data: { status: "RUNNING", lastInteraction: new Date() },
    });
}

export async function markSuccess(executionId: string, steps: StepResult[]) {
    return prisma.execution.update({
        where: { id: executionId },
        data: { status: "SUCCESS", finishedAt: new Date(), steps },
    });
}

export async function markError(executionId: string, steps: StepResult[], errorMessage: string) {
    return prisma.execution.update({
        where: { id: executionId },
        data: { status: "ERROR", finishedAt: new Date(), steps, errorMessage },
    });
}

export async function markSuspended(executionId: string, suspend: SuspendExecution, snapshot: ExecutionSnapshot) {
    return prisma.execution.update({
        where: { id: executionId },
        data: {
            status: "WAITING_INPUT",
            lastInteraction: new Date(),
            timeoutMinutes: suspend.timeoutMinutes ?? 10,
            resumeNodeId: suspend.resumeNodeId,
            waitingVariable: suspend.variableName,
            snapshot,
        },
    });
}

export async function markTimedOut(executionId: string) {
    return prisma.execution.update({
        where: { id: executionId },
        data: { status: "TIMED_OUT", finishedAt: new Date() },
    });
}

export async function findPendingByConversation(conversationKey: string) {
    return prisma.execution.findFirst({
        where: { conversationKey, status: "WAITING_INPUT" },
    });
}