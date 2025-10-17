import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const enrichmentSchema = z.object({
  productId: z.string().uuid("Invalid product ID format"),
  enrichmentTypes: z.array(
    z.enum([
      'amazon', 
      'specifications', 
      'cost_analysis', 
      'technical_description',
      'images',
      'rsgp',
      'ai_analysis'
    ])
  ).min(1, "At least one enrichment type required").max(10, "Maximum 10 enrichment types allowed"),
  provider: z.enum([
    'lovable', 
    'claude', 
    'openai', 
    'openrouter', 
    'ollama',
    'ollama_cloud',
    'ollama_local'
  ]).optional(),
  model: z.string().optional()
});

export const productAnalysisSchema = z.object({
  name: z.string().min(1, "Product name is required").max(500, "Name too long"),
  ean: z.string().regex(/^\d{8,13}$/, "Invalid EAN format").optional(),
  purchase_price: z.number().positive("Price must be positive").optional(),
  description: z.string().max(5000, "Description too long").optional()
});

export const supplierImportSchema = z.object({
  supplierId: z.string().uuid("Invalid supplier ID"),
  fileType: z.enum(['csv', 'xlsx', 'xls'], { errorMap: () => ({ message: "Invalid file type" }) }),
  mappingConfig: z.record(z.string()).optional()
});