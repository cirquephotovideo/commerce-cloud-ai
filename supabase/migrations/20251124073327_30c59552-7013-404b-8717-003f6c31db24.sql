-- ============================================================
-- Phase 2.2: Structured Metrics for Real-Time Monitoring
-- ============================================================
-- Purpose: Provide real-time import performance metrics
-- Expected gain: Visibility into bottlenecks and error patterns
-- ============================================================

-- Function to get import metrics for a time window
CREATE OR REPLACE FUNCTION get_import_metrics(
  p_user_id UUID DEFAULT NULL,
  time_window INTERVAL DEFAULT '1 hour'::INTERVAL
)
RETURNS TABLE (
  imports_per_minute NUMERIC,
  avg_chunk_duration_seconds NUMERIC,
  error_rate NUMERIC,
  total_processed BIGINT,
  total_errors BIGINT,
  active_jobs BIGINT,
  stalled_jobs BIGINT,
  dlq_entries BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Imports per minute
    COALESCE(
      COUNT(*)::NUMERIC / GREATEST(EXTRACT(EPOCH FROM time_window) / 60, 1),
      0
    ) as imports_per_minute,
    
    -- Average chunk duration in seconds
    COALESCE(
      AVG(
        EXTRACT(EPOCH FROM (
          COALESCE(ij.completed_at, ij.updated_at) - ij.created_at
        ))
      ),
      0
    ) as avg_chunk_duration_seconds,
    
    -- Error rate (0-1)
    COALESCE(
      COUNT(*) FILTER (WHERE ij.status = 'failed')::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0),
      0
    ) as error_rate,
    
    -- Total processed
    COUNT(*) as total_processed,
    
    -- Total errors
    COUNT(*) FILTER (WHERE ij.status = 'failed') as total_errors,
    
    -- Active jobs
    COUNT(*) FILTER (WHERE ij.status IN ('processing', 'queued')) as active_jobs,
    
    -- Stalled jobs (processing for > 10 min)
    COUNT(*) FILTER (
      WHERE ij.status = 'processing' 
      AND ij.updated_at < NOW() - INTERVAL '10 minutes'
    ) as stalled_jobs,
    
    -- Dead letter queue entries
    (
      SELECT COUNT(*) 
      FROM import_dead_letters idl
      JOIN import_jobs ij2 ON idl.job_id = ij2.id
      WHERE idl.resolved_at IS NULL
        AND (p_user_id IS NULL OR ij2.user_id = p_user_id)
    ) as dlq_entries
    
  FROM import_jobs ij
  WHERE ij.created_at > NOW() - time_window
    AND (p_user_id IS NULL OR ij.user_id = p_user_id);
END;
$$;

COMMENT ON FUNCTION get_import_metrics IS 'Returns real-time import performance metrics for monitoring dashboards';