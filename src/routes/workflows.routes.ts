import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createWorkflowSchema, updateWorkflowSchema } from "../schemas/workflow.schema";
import { logger } from "../lib/logger";
import { authMiddleware } from "../middlewares/auth.middleware";
import { WorkflowService } from "../services/workflow.service";

const workflowService = new WorkflowService();
const routeLogger = logger.child({ context: "WorkflowsRoutes" });

export async function workflowsRoutes(app: FastifyInstance) {
	app.addHook("preHandler", authMiddleware);

	app.get("/workflows", async (request) => {
		logger.debug("listing workflows", { userId: request.user.userId });
		return workflowService.listByUser(request.user.userId);
	});

	app.post("/workflows", async (request, reply) => {
		const body = createWorkflowSchema.parse(request.body);
		const workflow = await workflowService.create(
			request.user.userId,
			body.name,
			body.description,
		);
		routeLogger.info("workflow created", {
			userId: request.user.userId,
			workflowId: workflow.id,
		});
		return reply.code(201).send(workflow);
	});

	app.get("/workflows/:id", async (request, reply) => {
		const { id } = z.object({ id: z.string() }).parse(request.params);
		routeLogger.info(`getting workflow: ${id} for user ${request.user.userId}`);
		try {
			return await workflowService.getById(id, request.user.userId);
		} catch {
			return reply.code(404).send({ message: "Workflow not found" });
		}
	});

	app.patch("/workflows/:id", async (request) => {
		const { id } = z.object({ id: z.string() }).parse(request.params);
		const body = updateWorkflowSchema.parse(request.body);
		const workflow = await workflowService.update(
			id,
			request.user.userId,
			body,
		);
		routeLogger.info("workflow updated", { id, userId: request.user.userId });
		return workflow;
	});

	app.patch("/workflows/:id/toggle", async (request) => {
		const { id } = z.object({ id: z.string() }).parse(request.params);
		const workflow = await workflowService.toggle(id, request.user.userId);
		routeLogger.info("workflow toggled", {
			id,
			userId: request.user.userId,
			active: workflow.isActive,
		});
		return workflow;
	});

	app.delete("/workflows/:id", async (request, reply) => {
		const { id } = z.object({ id: z.string() }).parse(request.params);
		await workflowService.delete(id, request.user.userId);
		routeLogger.info("workflow deleted", { id, userId: request.user.userId });
		return reply.code(204).send();
	});

	app.get("/workflows/:id/logs", async (request) => {
		const { id } = z.object({ id: z.string() }).parse(request.params);
		const query = z
			.object({
				page: z.coerce.number().default(1),
				limit: z.coerce.number().default(10),
				status: z.string().optional(),
			})
			.parse(request.query);
		return workflowService.getLogs(
			id,
			request.user.userId,
			query.page,
			query.limit,
			query.status,
		);
	});

	routeLogger.info(
		[
			"- Workflow Routes registered",
			"GET    /api/workflows            - returns all workflows available to the current user",
			"POST   /api/workflows            - create a new workflow",
			"GET    /api/workflows/:id        - return an workflow data by id",
			"PATCH  /api/workflows/:id        - update a workflow's data",
			"PATCH  /api/workflows/:id/toggle - toggle a workflow's enabled status",
			"DELETE /api/workflows/:id        - delete a specific workflow",
			"GET    /api/workflows/:id/logs   - return workflow logs",
		].join("\n"),
	);
}
