import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createWorkflowSchema, updateWorkflowSchema } from '../dtos/workflow.dto';
import { authMiddleware } from '../middlewares/auth.middleware';
import { logger, toError } from '../lib/logger';
import { WorkflowService } from '../services/workflow.service';

const workflowService = new WorkflowService();

export async function workflowsRoutes(app: FastifyInstance) {
    app.addHook("preHandler", authMiddleware);

    app.get("/workflows", async (request) => {
        logger.debug("listing workflows", { userId: request.user.userId });
        return workflowService.listByUser(request.user.userId);
    });

    app.post("/workflows", async (request, reply) => {
        const body = createWorkflowSchema.parse(request.body);
        const workflow = await workflowService.create(request.user.userId, body.name, body.description);
        logger.info("workflow created", { userId: request.user.userId, workflowId: workflow.id });
        return reply.code(201).send(workflow);
    });

    // ✅
    app.get("/workflows/:id", async (request, reply) => {
        const { id } = z.object({ id: z.string() }).parse(request.params);
        logger.info(`getting workflow: ${id} for user ${request.user.userId}`);
        try {
            return await workflowService.getById(id, request.user.userId);
        } catch (error) {
            return reply.code(404).send({ message: "Workflow not found" });
        }
    });

    app.put("/workflows/:id", async (request, reply) => {
        const { id } = z.object({ id: z.string() }).parse(request.params);
        const body = updateWorkflowSchema.parse(request.body);
        const workflow = await workflowService.update(id, request.user.userId, body);
        logger.info("workflow updated", { id, userId: request.user.userId });
        return workflow;
    });

    app.patch("/workflows/:id/toggle", async (request, reply) => {
        const { id } = z.object({ id: z.string() }).parse(request.params);
        const workflow = await workflowService.toggle(id, request.user.userId);
        logger.info("workflow toggled", { id, userId: request.user.userId, active: workflow.isActive });
        return workflow;
    });

    app.delete("/workflows/:id", async (request, reply) => {
        const { id } = z.object({ id: z.string() }).parse(request.params);
        await workflowService.delete(id, request.user.userId);
        logger.info("workflow deleted", { id, userId: request.user.userId });
        return reply.code(204).send();
    });

    app.get("/workflows/:id/logs", async (request, reply) => {
        const { id } = z.object({ id: z.string() }).parse(request.params);
        const query = z.object({
            page: z.coerce.number().default(1),
            limit: z.coerce.number().default(10),
            status: z.string().optional()
        }).parse(request.query);
        return workflowService.getLogs(id, request.user.userId, query.page, query.limit, query.status);
    });

    logger.info([
        "- Workflow Routes registered",
        "GET    /api/workflows",
        "POST   /api/workflows",
        "GET    /api/workflows/:id",
        "PUT    /api/workflows/:id",
        "PATCH  /api/workflows/:id/toggle",
        "DELETE /api/workflows/:id",
        "GET    /api/workflows/:id/logs",
    ].join("\n"));
}