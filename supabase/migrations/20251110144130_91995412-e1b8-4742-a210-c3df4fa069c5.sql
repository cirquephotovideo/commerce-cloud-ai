-- Add UNIQUE constraint on analysis_id in code2asin_enrichments
-- First, delete any duplicates if they exist
DELETE FROM public.code2asin_enrichments a
USING public.code2asin_enrichments b
WHERE a.id > b.id 
  AND a.analysis_id = b.analysis_id
  AND a.analysis_id IS NOT NULL;

-- Add the UNIQUE constraint
ALTER TABLE public.code2asin_enrichments
ADD CONSTRAINT code2asin_enrichments_analysis_id_unique UNIQUE (analysis_id);

-- Make analysis_id NOT NULL to ensure data integrity
ALTER TABLE public.code2asin_enrichments
ALTER COLUMN analysis_id SET NOT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_code2asin_enrichments_analysis_id 
ON public.code2asin_enrichments(analysis_id);