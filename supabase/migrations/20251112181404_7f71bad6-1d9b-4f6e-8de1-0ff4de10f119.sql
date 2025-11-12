-- Create table for Amazon/Code2ASIN product links
CREATE TABLE IF NOT EXISTS public.product_amazon_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_id UUID NOT NULL,
  enrichment_id UUID NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'automatic' CHECK (link_type IN ('automatic', 'manual')),
  confidence_score NUMERIC DEFAULT 100,
  matched_on TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.product_amazon_links
  ADD CONSTRAINT fk_amazon_links_analysis
  FOREIGN KEY (analysis_id) 
  REFERENCES public.product_analyses(id) 
  ON DELETE CASCADE;

ALTER TABLE public.product_amazon_links
  ADD CONSTRAINT fk_amazon_links_enrichment
  FOREIGN KEY (enrichment_id) 
  REFERENCES public.code2asin_enrichments(id) 
  ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_amazon_links_user ON public.product_amazon_links(user_id);
CREATE INDEX IF NOT EXISTS idx_amazon_links_analysis ON public.product_amazon_links(analysis_id);
CREATE INDEX IF NOT EXISTS idx_amazon_links_enrichment ON public.product_amazon_links(enrichment_id);

-- Enable RLS
ALTER TABLE public.product_amazon_links ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own amazon links"
  ON public.product_amazon_links
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own amazon links"
  ON public.product_amazon_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own amazon links"
  ON public.product_amazon_links
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own amazon links"
  ON public.product_amazon_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create table for Amazon auto-link jobs
CREATE TABLE IF NOT EXISTS public.amazon_auto_link_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_to_process INTEGER,
  processed_count INTEGER DEFAULT 0,
  links_created INTEGER DEFAULT 0,
  current_offset INTEGER DEFAULT 0,
  batch_size INTEGER DEFAULT 100,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_amazon_jobs_user ON public.amazon_auto_link_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_amazon_jobs_status ON public.amazon_auto_link_jobs(status);

-- Enable RLS
ALTER TABLE public.amazon_auto_link_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own amazon jobs"
  ON public.amazon_auto_link_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own amazon jobs"
  ON public.amazon_auto_link_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own amazon jobs"
  ON public.amazon_auto_link_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);