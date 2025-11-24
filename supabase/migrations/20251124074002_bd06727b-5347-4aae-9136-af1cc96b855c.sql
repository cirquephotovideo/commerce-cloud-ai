-- ============================================================
-- Phase 3: Security and Audit Enhancements
-- ============================================================
-- Purpose: Track encryption key rotation and security events
-- ============================================================

-- Create security audit table for key rotation events
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_logs(performed_by);

-- Enable RLS
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view security logs
CREATE POLICY "Admins can view security logs"
  ON security_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Policy: Service role can insert security logs
CREATE POLICY "Service role can insert security logs"
  ON security_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::JSONB,
  p_severity TEXT DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO security_audit_logs (
    event_type,
    performed_by,
    entity_type,
    entity_id,
    details,
    severity
  ) VALUES (
    p_event_type,
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_details,
    p_severity
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

COMMENT ON TABLE security_audit_logs IS 'Audit trail for security-sensitive operations (key rotation, access changes, etc.)';
COMMENT ON FUNCTION log_security_event IS 'Helper function to log security events with automatic user tracking';