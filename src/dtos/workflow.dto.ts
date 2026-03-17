import { z } from 'zod';

export const createWorkflowSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
});

export const updateWorkflowSchema = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    graph: z.any().optional(),
});

export type CreateWorkflowDto = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowDto = z.infer<typeof updateWorkflowSchema>;