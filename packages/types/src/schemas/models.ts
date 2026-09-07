import { z } from "zod";

export const ModelObjectSchema = z.object({
    id: z.string(),
    object: z.literal("model"),
    created: z.number().optional(),
    owned_by: z.string(),
    custom: z.boolean().optional(),
    context_window: z.number().optional(),
    max_output_tokens: z.number().optional()
});

export type ModelObjectZod = z.infer<typeof ModelObjectSchema>;

export const ModelListResponseSchema = z.object({
    object: z.literal("list"),
    data: z.array(ModelObjectSchema)
});

export type ModelListResponseZod = z.infer<typeof ModelListResponseSchema>;
