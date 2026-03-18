import { ExecutionStatus } from "@prisma/client";
import type { UpdateWorkflowInput } from "../schemas/workflow.schema";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

const serviceLogger = logger.child({ context: "WorkflowService" });

export class WorkflowService {
	async listByUser(userId: string) {
		return prisma.workflow.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			include: {
				_count: {
					select: {
						executionLogs: true,
					},
				},
			},
		});
	}

	async getById(id: string, userId: string) {
		const workflow = await prisma.workflow.findUnique({ where: { id } });

		if (!workflow) {
			throw new Error("WORKFLOW_NOT_FOUND");
		}

		if (workflow.userId !== userId) {
			serviceLogger.warn(
				`workflow access denied: workflow ${id} for user ${userId}`,
			);
			throw new Error("WORKFLOW_FORBIDDEN");
		}
		return workflow;
	}

	async create(userId: string, name: string, description?: string) {
		return prisma.workflow.create({
			data: {
				userId,
				name,
				description: description ?? null,
				graph: {
					nodes: [],
					edges: [],
				},
			},
		});
	}

	async update(id: string, userId: string, data: UpdateWorkflowInput) {
		// handle workflow not found or workflow forbidden
		await this.getById(id, userId);

		// redundant
		// if (!workflow) {
		//     throw new Error("WORKFLOW_NOT_FOUND");
		// }

		return prisma.workflow.update({
			where: { id },
			data,
		});
	}

	async toggle(id: string, userId: string) {
		const workflow = await this.getById(id, userId);

		const updated = await prisma.workflow.update({
			where: { id },
			data: {
				isActive: !workflow.isActive,
			},
			select: {
				isActive: true,
			},
		});

		return updated;
	}

	async delete(id: string, userId: string) {
		// handle workflow not found or workflow forbidden
		await this.getById(id, userId);

		await prisma.workflow.delete({
			where: { id },
		});
	}

	async getLogs(
		workflowId: string,
		userId: string,
		page: number,
		limit: number,
		status?: string,
	) {
		// handle workflow not found or workflow forbidden
		await this.getById(workflowId, userId);

		const skip = (page - 1) * limit;

		const parsedStatus =
			status !== undefined
				? Object.values(ExecutionStatus).includes(status as ExecutionStatus)
					? (status as ExecutionStatus)
					: undefined
				: undefined;

		return prisma.executionLog.findMany({
			where: {
				workflowId,
				status: parsedStatus,
			},
			orderBy: {
				startedAt: "desc",
			},
			skip,
			take: limit,
		});
	}
}
