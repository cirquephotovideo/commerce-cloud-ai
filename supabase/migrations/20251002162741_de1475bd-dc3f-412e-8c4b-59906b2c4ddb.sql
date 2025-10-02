-- Create taxonomy_settings table
CREATE TABLE IF NOT EXISTS public.taxonomy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taxonomy_type TEXT NOT NULL CHECK (taxonomy_type IN ('google', 'amazon')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create product_taxonomy_mappings table
CREATE TABLE IF NOT EXISTS public.product_taxonomy_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  taxonomy_type TEXT NOT NULL CHECK (taxonomy_type IN ('google', 'amazon')),
  category_id TEXT NOT NULL,
  category_path TEXT NOT NULL,
  confidence_score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(analysis_id, taxonomy_type)
);

-- Enable RLS
ALTER TABLE public.taxonomy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_taxonomy_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for taxonomy_settings
CREATE POLICY "Users can manage their own taxonomy settings"
  ON public.taxonomy_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for product_taxonomy_mappings
CREATE POLICY "Users can view their own taxonomy mappings"
  ON public.product_taxonomy_mappings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.product_analyses
      WHERE product_analyses.id = product_taxonomy_mappings.analysis_id
      AND product_analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own taxonomy mappings"
  ON public.product_taxonomy_mappings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_analyses
      WHERE product_analyses.id = product_taxonomy_mappings.analysis_id
      AND product_analyses.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_taxonomy_settings_user_id ON public.taxonomy_settings(user_id);
CREATE INDEX idx_product_taxonomy_mappings_analysis_id ON public.product_taxonomy_mappings(analysis_id);
CREATE INDEX idx_product_taxonomy_mappings_taxonomy_type ON public.product_taxonomy_mappings(taxonomy_type);

-- Add trigger for updated_at
CREATE TRIGGER update_taxonomy_settings_updated_at
  BEFORE UPDATE ON public.taxonomy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();