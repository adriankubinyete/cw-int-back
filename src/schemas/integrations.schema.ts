import { z } from 'zod'

// ---------------------------------------------------------------------------
// Auth configs por ERP
// Cada ERP define exatamente o que precisa pra autenticar
// ---------------------------------------------------------------------------

const ixcsoftAuthConfig = z.object({
    url:   z.string().url().max(2048).trim(),
    token: z.string().min(1).max(2048).trim(),
})

const sgpAuthConfig = z.object({
    url:   z.string().url().max(2048).trim(),
    token: z.string().min(1).max(2048).trim(),
    app:   z.string().min(1).max(512).trim(),
})

const hubsoftAuthConfig = z.object({
    url:   z.string().url().max(2048).trim(),
    token: z.string().min(1).max(2048).trim(),
})

// ---------------------------------------------------------------------------
// Erp configs por ERP (comportamentos específicos)
// Por ora opcionais — sem erp_config o sistema usa os defaults
// ---------------------------------------------------------------------------

const ixcsoftErpConfig = z.object({
    enable_search_client_by_phone: z.boolean().default(true),
    open_ticket:                   z.boolean().default(true),
    check_open_ticket:             z.boolean().default(true),
    generate_prospect:             z.boolean().default(true),
    type_prospect:                 z.enum(['prospect', 'lead']).default('prospect'),
})

const sgpErpConfig = z.object({
    enable_search_client_by_phone: z.boolean().default(true),
    open_ticket:                   z.boolean().default(true),
    check_open_ticket:             z.boolean().default(true),
})

const hubsoftErpConfig = z.object({
    enable_search_client_by_phone: z.boolean().default(true),
    open_ticket:                   z.boolean().default(true),
    check_open_ticket:             z.boolean().default(true),
})

// ---------------------------------------------------------------------------
// Schemas de criação — discriminatedUnion por instance_type
// ---------------------------------------------------------------------------

const createIxcsoftSchema = z.object({
    instance_type: z.literal('ixcsoft'),
    name:          z.string().min(1).max(255).trim().optional(),
    auth_config:   ixcsoftAuthConfig,
    erp_config:    ixcsoftErpConfig.optional(),
})

const createSgpSchema = z.object({
    instance_type: z.literal('sgp'),
    name:          z.string().min(1).max(255).trim().optional(),
    auth_config:   sgpAuthConfig,
    erp_config:    sgpErpConfig.optional(),
})

const createHubsoftSchema = z.object({
    instance_type: z.literal('hubsoft'),
    name:          z.string().min(1).max(255).trim().optional(),
    auth_config:   hubsoftAuthConfig,
    erp_config:    hubsoftErpConfig.optional(),
})

export const createIntegrationSchema = z.discriminatedUnion('instance_type', [
    createIxcsoftSchema,
    createSgpSchema,
    createHubsoftSchema,
])

// ---------------------------------------------------------------------------
// Schema de update — campos livres, sem discriminar por tipo
// auth_config e erp_config são objetos abertos — a validação específica
// não acontece aqui porque não sabemos o tipo sem buscar no banco
// ---------------------------------------------------------------------------

export const updateIntegrationSchema = z.object({
    name:        z.string().min(1).max(255).trim().optional(),
    auth_config: z.record(z.string().trim(), z.unknown()).optional(),
    erp_config:  z.record(z.string().trim(), z.unknown()).optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided for update' }
)

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>