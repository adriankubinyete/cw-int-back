import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createWorkflowSchema, updateWorkflowSchema } from "../schemas/workflow.schema";
import { logger } from "../lib/logger";
import { authMiddleware } from "../middlewares/auth.middleware";
import * as WorkflowService from "../services/workflow.service";

const routeLogger = logger.child({ context: "WorkflowsRoutes" });

const paramsSchema = z.object({ id: z.string() });
const executionsQuerySchema = z.object({
	page: z.coerce.number().default(1),
	limit: z.coerce.number().default(10),
	status: z.string().optional(),
});

export async function workflowsRoutes(app: FastifyInstance) {
	app.addHook("preHandler", authMiddleware);

	app.get("/workflows", async (request) => {
		logger.debug("listing workflows", { userId: request.user.userId });
		return WorkflowService.listByUser(request.user.userId);
	});

	app.post("/workflows", async (request, reply) => {
		const body = createWorkflowSchema.parse(request.body);
		const workflow = await WorkflowService.create(
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
		const { id } = paramsSchema.parse(request.params);
		const workflow = await WorkflowService.findById(id);
		
		if (workflow.userId !== request.user.userId) {
			return reply.code(403).send({ message: "Forbidden" });
		}

		return workflow
	});

	app.patch("/workflows/:id", async (request) => {
		const { id } = paramsSchema.parse(request.params);
		const body = updateWorkflowSchema.parse(request.body);
		// todo: can this user edit this workflow?
		const workflow = await WorkflowService.update(id, request.user.userId, body);
		routeLogger.info("workflow updated", { id, userId: request.user.userId });
		return workflow;
	});

	app.patch("/workflows/:id/toggle", async (request) => {
		const { id } = paramsSchema.parse(request.params);
		// todo: can this user edit this workflow?
		const workflow = await WorkflowService.toggle(id, request.user.userId);
		routeLogger.info("workflow toggled", {
			id,
			userId: request.user.userId,
			active: workflow.isActive,
		});
		return workflow;
	});

	app.delete("/workflows/:id", async (request, reply) => {
		const { id } = paramsSchema.parse(request.params);
		// todo: can this user edit this workflow?
		await WorkflowService.remove(id, request.user.userId);
		routeLogger.info("workflow deleted", { id, userId: request.user.userId });
		return reply.code(204).send();
	});

	app.get("/workflows/:id/executions", async (request) => {
		const { id } = paramsSchema.parse(request.params);
		const query = executionsQuerySchema.parse(request.query);
		// todo: can this user edit this workflow?
		return WorkflowService.getExecutions(
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
			"GET    /api/workflows                    - list all workflows for current user",
			"POST   /api/workflows                    - create a new workflow",
			"GET    /api/workflows/:id                - get workflow by id",
			"PATCH  /api/workflows/:id                - update workflow",
			"PATCH  /api/workflows/:id/toggle         - toggle workflow active status",
			"DELETE /api/workflows/:id                - delete workflow",
			"GET    /api/workflows/:id/executions     - list workflow executions",
		].join("\n"),
	);
}