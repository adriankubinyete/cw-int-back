import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth configs
// ---------------------------------------------------------------------------

const chatwootAuthConfig = z.object({
	baseUrl: z.string().url().max(2048).trim(),
	apiToken: z.string().min(1).max(2048).trim(),
});

const ixcsoftAuthConfig = z.object({
	url: z.string().url().max(2048).trim(),
	token: z.string().min(1).max(2048).trim(),
});

const sgpAuthConfig = z.object({
	url: z.string().url().max(2048).trim(),
	token: z.string().min(1).max(2048).trim(),
	app: z.string().min(1).max(512).trim(),
});

const hubsoftAuthConfig = z.object({
	url: z.string().url().max(2048).trim(),
	token: z.string().min(1).max(2048).trim(),
});

// ---------------------------------------------------------------------------
// Erp configs
// ---------------------------------------------------------------------------

const chatwootErpConfig = z.object({
	// @TODO: account_id default, inbox_id, etc
});

const ixcsoftErpConfig = z.object({
	enable_search_client_by_phone: z.boolean().default(true),
	open_ticket: z.boolean().default(true),
	check_open_ticket: z.boolean().default(true),
	generate_prospect: z.boolean().default(true),
	type_prospect: z.enum(["prospect", "lead"]).default("prospect"),
});

const sgpErpConfig = z.object({
	enable_search_client_by_phone: z.boolean().default(true),
	open_ticket: z.boolean().default(true),
	check_open_ticket: z.boolean().default(true),
});

const hubsoftErpConfig = z.object({
	enable_search_client_by_phone: z.boolean().default(true),
	open_ticket: z.boolean().default(true),
	check_open_ticket: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Schemas de criação — discriminatedUnion por instance_type
// ---------------------------------------------------------------------------

export const createIntegrationSchema = z.discriminatedUnion("instance_type", [
	z.object({
		instance_type: z.literal("chatwoot"),
		name: z.string().min(1).max(255).trim().optional(),
		auth_config: chatwootAuthConfig,
		erp_config: chatwootErpConfig.optional(),
	}),
	z.object({
		instance_type: z.literal("ixcsoft"),
		name: z.string().min(1).max(255).trim().optional(),
		auth_config: ixcsoftAuthConfig,
		erp_config: ixcsoftErpConfig.optional(),
	}),
	z.object({
		instance_type: z.literal("sgp"),
		name: z.string().min(1).max(255).trim().optional(),
		auth_config: sgpAuthConfig,
		erp_config: sgpErpConfig.optional(),
	}),
	z.object({
		instance_type: z.literal("hubsoft"),
		name: z.string().min(1).max(255).trim().optional(),
		auth_config: hubsoftAuthConfig,
		erp_config: hubsoftErpConfig.optional(),
	}),
]);

// ---------------------------------------------------------------------------
// Schema de update
// ---------------------------------------------------------------------------

export const updateIntegrationSchema = z
	.object({
		name: z.string().min(1).max(255).trim().optional(),
		auth_config: z.record(z.string().trim(), z.unknown()).optional(),
		erp_config: z.record(z.string().trim(), z.unknown()).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided for update",
	});

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

export type ChatwootAuthConfig = z.infer<typeof chatwootAuthConfig>;
export type IxcsoftAuthConfig = z.infer<typeof ixcsoftAuthConfig>;
export type SgpAuthConfig = z.infer<typeof sgpAuthConfig>;
export type HubsoftAuthConfig = z.infer<typeof hubsoftAuthConfig>;

export type ChatwootErpConfig = z.infer<typeof chatwootErpConfig>;
export type IxcsoftErpConfig = z.infer<typeof ixcsoftErpConfig>;
export type SgpErpConfig = z.infer<typeof sgpErpConfig>;
export type HubsoftErpConfig = z.infer<typeof hubsoftErpConfig>;

export type AnyAuthConfig = ChatwootAuthConfig | IxcsoftAuthConfig | SgpAuthConfig | HubsoftAuthConfig;
export type AnyErpConfig = ChatwootErpConfig | IxcsoftErpConfig | SgpErpConfig | HubsoftErpConfig;