import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger } from "../lib/logger";
import { authMiddleware } from "../middlewares/auth.middleware";
import {
	createIntegrationSchema,
	updateIntegrationSchema,
} from "../schemas/integrations.schema";
import * as IntegrationService from "../services/integration.service";

const routeLogger = logger.child({ context: "IntegrationsRoutes" });

const idParamsSchema = z.object({ id: z.string() });

export async function integrationsRoutes(app: FastifyInstance) {
	app.addHook("preHandler", authMiddleware);

	// -------------------------------------------------------------------------
	// GET /integrations
	// Lista integrações do usuário. Filtro opcional: ?erpType=ixcsoft
	// -------------------------------------------------------------------------
	app.get("/integrations", async (request) => {
		const query = z
			.object({
				erpType: z.string().optional(),
			})
			.parse(request.query);

		routeLogger.debug("listing integrations", {
			userId: request.user.userId,
			erpType: query.erpType,
		});
		return IntegrationService.list(request.user.userId, query.erpType);
	});

	// -------------------------------------------------------------------------
	// GET /integrations/:id
	// Retorna uma integração pelo id. Nunca expõe authConfig/erpConfig.
	// -------------------------------------------------------------------------
	app.get("/integrations/:id", async (request, reply) => {
		const { id } = idParamsSchema.parse(request.params);

		try {
			const integration = await IntegrationService.getById(
				request.user.userId,
				id,
			);
			routeLogger.debug("getting integration", {
				userId: request.user.userId,
				integrationId: id,
			});
			return integration;
		} catch {
			return reply.code(404).send({ message: "Integration not found" });
		}
	});

	// -------------------------------------------------------------------------
	// POST /integrations
	// Cria uma nova integração.
	// O instance_type no body discrimina qual schema de auth_config usar.
	// Body: { instance_type, name?, auth_config, erp_config? }
	// Não ativa ainda — precisa chamar /test antes.
	// -------------------------------------------------------------------------
	app.post("/integrations", async (request, reply) => {
		const body = createIntegrationSchema.parse(request.body);

		const integration = await IntegrationService.save(
			request.user.userId,
			body.instance_type,
			body.auth_config,
			body.erp_config ?? {},
			body.name,
		);

		routeLogger.info("integration created", {
			userId: request.user.userId,
			integrationId: integration.id,
			integrationType: integration.integrationType,
			name: integration.name,
		});

		return reply.code(201).send(integration);
	});

	// -------------------------------------------------------------------------
	// PATCH /integrations/:id
	// Atualiza name, auth_config ou erp_config.
	// Se auth_config mudar, reseta isActive = false (precisa testar de novo).
	// -------------------------------------------------------------------------
	app.patch("/integrations/:id", async (request, reply) => {
		const { id } = idParamsSchema.parse(request.params);
		const body = updateIntegrationSchema.parse(request.body);

		try {
			const integration = await IntegrationService.update(
				request.user.userId,
				id,
				body,
			);
			routeLogger.info("integration updated", {
				userId: request.user.userId,
				integrationId: id,
			});
			return integration;
		} catch {
			return reply.code(404).send({ message: "Integration not found" });
		}
	});

	// -------------------------------------------------------------------------
	// POST /integrations/:id/test
	// Testa a conexão com o ERP usando as credenciais salvas.
	// Sucesso: isActive = true,  testedAt = now()
	// Falha:   isActive = false, testedAt = now()
	// -------------------------------------------------------------------------
	app.post("/integrations/:id/test", async (request, reply) => {
		const { id } = idParamsSchema.parse(request.params);

		try {
			const success = await IntegrationService.test(request.user.userId, id);
			routeLogger.info("integration tested", {
				userId: request.user.userId,
				integrationId: id,
				success,
			});

			if (success) {
				return { success: true };
			}

			return {
				success: false,
				error:
					"Não foi possível conectar ao ERP. Verifique as credenciais e a URL.",
			};
		} catch (error) {
			if ((error as Error).message === "INTEGRATION_NOT_FOUND") {
				return reply.code(404).send({ message: "Integration not found" });
			}
			if ((error as Error).message === "ERP_NOT_SUPPORTED") {
				return reply.code(400).send({ message: "ERP not supported" });
			}
			throw error;
		}
	});

	// -------------------------------------------------------------------------
	// DELETE /integrations/:id
	// Remove a integração. Retorna 204.
	// -------------------------------------------------------------------------
	app.delete("/integrations/:id", async (request, reply) => {
		const { id } = idParamsSchema.parse(request.params);

		try {
			await IntegrationService.remove(request.user.userId, id);
			routeLogger.info("integration deleted", {
				userId: request.user.userId,
				integrationId: id,
			});
			return reply.code(204).send();
		} catch {
			return reply.code(404).send({ message: "Integration not found" });
		}
	});

	routeLogger.info(
		[
			"- Integration Routes registered",
			"GET    /api/integrations          - lista integrações do usuário",
			"GET    /api/integrations/:id      - retorna integração por id",
			"POST   /api/integrations          - cria integração (instance_type: ixcsoft | sgp | hubsoft)",
			"PATCH  /api/integrations/:id      - atualiza integração",
			"POST   /api/integrations/:id/test - testa conexão com o ERP",
			"DELETE /api/integrations/:id      - remove integração",
		].join("\n"),
	);
}
