-- Create code2asin_enrichments table
CREATE TABLE IF NOT EXISTS public.code2asin_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  analysis_id UUID REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  
  -- Identifiers
  asin TEXT,
  ean TEXT,
  upc TEXT,
  part_number TEXT,
  
  -- Product information
  title TEXT,
  brand TEXT,
  manufacturer TEXT,
  product_group TEXT,
  product_type TEXT,
  browse_nodes TEXT,
  
  -- Pricing and Buy Box
  buybox_price NUMERIC,
  buybox_seller_id TEXT,
  buybox_seller_name TEXT,
  buybox_is_fba BOOLEAN,
  buybox_is_amazon BOOLEAN,
  amazon_price NUMERIC,
  lowest_fba_new NUMERIC,
  lowest_new NUMERIC,
  lowest_used NUMERIC,
  lowest_collectible NUMERIC,
  lowest_refurbished NUMERIC,
  list_price NUMERIC,
  
  -- Images
  image_urls JSONB DEFAULT '[]'::jsonb,
  
  -- Dimensions and weight
  item_length_cm NUMERIC,
  item_width_cm NUMERIC,
  item_height_cm NUMERIC,
  item_weight_g NUMERIC,
  package_length_cm NUMERIC,
  package_width_cm NUMERIC,
  package_height_cm NUMERIC,
  package_weight_g NUMERIC,
  package_quantity INTEGER,
  
  -- Offers
  offer_count_new INTEGER,
  offer_count_used INTEGER,
  offer_count_collectible INTEGER,
  offer_count_refurbished INTEGER,
  
  -- Amazon fees
  referral_fee_percentage NUMERIC,
  fulfillment_fee NUMERIC,
  
  -- Metadata
  sales_rank TEXT,
  variation_count INTEGER,
  color TEXT,
  size TEXT,
  features TEXT,
  item_count INTEGER,
  page_count INTEGER,
  is_tradeable BOOLEAN,
  marketplace TEXT,
  
  -- Dates
  publication_date DATE,
  release_date DATE,
  
  -- Tracking
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast searches
CREATE INDEX idx_code2asin_user ON public.code2asin_enrichments(user_id);
CREATE INDEX idx_code2asin_analysis ON public.code2asin_enrichments(analysis_id);
CREATE INDEX idx_code2asin_asin ON public.code2asin_enrichments(asin);
CREATE INDEX idx_code2asin_ean ON public.code2asin_enrichments(ean);

-- RLS Policies
ALTER TABLE public.code2asin_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own code2asin enrichments"
  ON public.code2asin_enrichments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own code2asin enrichments"
  ON public.code2asin_enrichments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own code2asin enrichments"
  ON public.code2asin_enrichments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own code2asin enrichments"
  ON public.code2asin_enrichments FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_code2asin_enrichments_updated_at
  BEFORE UPDATE ON public.code2asin_enrichments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add tracking columns to product_analyses
ALTER TABLE public.product_analyses 
ADD COLUMN IF NOT EXISTS code2asin_enrichment_status TEXT CHECK (
  code2asin_enrichment_status IN ('not_started', 'pending', 'completed', 'failed')
) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS code2asin_enriched_at TIMESTAMPTZ;

CREATE INDEX idx_product_analyses_code2asin_status 
ON public.product_analyses(code2asin_enrichment_status);