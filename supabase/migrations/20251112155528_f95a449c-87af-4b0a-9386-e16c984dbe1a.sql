-- Phase 1: Create auto_link_jobs table for tracking batch processing
CREATE TABLE auto_link_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_to_process INTEGER,
  processed_count INTEGER DEFAULT 0,
  links_created INTEGER DEFAULT 0,
  current_offset INTEGER DEFAULT 0,
  batch_size INTEGER DEFAULT 100,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auto_link_jobs_user_status ON auto_link_jobs(user_id, status);

-- Enable RLS
ALTER TABLE auto_link_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON auto_link_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON auto_link_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON auto_link_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Create paginated link creation function
CREATE OR REPLACE FUNCTION bulk_create_product_links_chunked(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  links_created INTEGER,
  processed_count INTEGER,
  has_more BOOLEAN
) AS $$
DECLARE
  inserted_count INTEGER;
  total_analyzed INTEGER;
BEGIN
  -- Count products in this chunk
  SELECT COUNT(*) INTO total_analyzed
  FROM (
    SELECT pa.id
    FROM product_analyses pa
    WHERE pa.user_id = p_user_id
      AND pa.ean IS NOT NULL 
      AND pa.ean != ''
    ORDER BY pa.id
    LIMIT p_limit
    OFFSET p_offset
  ) sub;
  
  -- Create links for this chunk only
  WITH inserted AS (
    INSERT INTO product_links (analysis_id, supplier_product_id, link_type, confidence_score, user_id)
    SELECT 
      pa.id,
      sp.id,
      'auto',
      1.0,
      p_user_id
    FROM (
      SELECT * FROM product_analyses
      WHERE user_id = p_user_id
        AND ean IS NOT NULL 
        AND ean != ''
      ORDER BY id
      LIMIT p_limit
      OFFSET p_offset
    ) pa
    INNER JOIN supplier_products sp 
      ON LOWER(TRIM(pa.ean)) = LOWER(TRIM(sp.ean))
    WHERE sp.user_id = p_user_id
      AND sp.ean IS NOT NULL
      AND sp.ean != ''
      AND NOT EXISTS (
        SELECT 1 FROM product_links pl
        WHERE pl.analysis_id = pa.id 
          AND pl.supplier_product_id = sp.id
      )
    ON CONFLICT (analysis_id, supplier_product_id) DO NOTHING
    RETURNING *
  )
  SELECT COUNT(*)::INTEGER INTO inserted_count FROM inserted;
  
  RETURN QUERY SELECT 
    inserted_count,
    total_analyzed,
    total_analyzed >= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;