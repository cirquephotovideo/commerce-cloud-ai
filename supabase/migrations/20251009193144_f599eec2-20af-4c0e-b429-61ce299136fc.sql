-- Phase 8: Système de Liaison Intelligent
-- Table pour lier supplier_products et product_analyses
CREATE TABLE IF NOT EXISTS public.product_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_product_id UUID REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  link_type TEXT CHECK (link_type IN ('auto', 'manual', 'suggested')) NOT NULL,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(supplier_product_id, analysis_id)
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_product_links_supplier ON public.product_links(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_product_links_analysis ON public.product_links(analysis_id);
CREATE INDEX IF NOT EXISTS idx_product_links_type ON public.product_links(link_type);

-- Enable RLS
ALTER TABLE public.product_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own product links"
ON public.product_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_products sp
    WHERE sp.id = product_links.supplier_product_id
    AND sp.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.product_analyses pa
    WHERE pa.id = product_links.analysis_id
    AND pa.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own product links"
ON public.product_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_products sp
    WHERE sp.id = product_links.supplier_product_id
    AND sp.user_id = auth.uid()
  )
  AND
  EXISTS (
    SELECT 1 FROM public.product_analyses pa
    WHERE pa.id = product_links.analysis_id
    AND pa.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own product links"
ON public.product_links
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_products sp
    WHERE sp.id = product_links.supplier_product_id
    AND sp.user_id = auth.uid()
  )
);

-- Phase 9: Table pour la queue d'enrichissement batch
CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  supplier_product_id UUID REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  enrichment_type TEXT[] NOT NULL, -- ['amazon', 'images', 'video', 'rsgp']
  priority TEXT CHECK (priority IN ('low', 'normal', 'high')) DEFAULT 'normal',
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour la queue
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_user ON public.enrichment_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON public.enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_priority ON public.enrichment_queue(priority);

-- Enable RLS
ALTER TABLE public.enrichment_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own enrichment queue"
ON public.enrichment_queue
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own enrichment tasks"
ON public.enrichment_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own enrichment tasks"
ON public.enrichment_queue
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own enrichment tasks"
ON public.enrichment_queue
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_enrichment_queue_updated_at
BEFORE UPDATE ON public.enrichment_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();