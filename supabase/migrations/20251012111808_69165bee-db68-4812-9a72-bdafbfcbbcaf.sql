-- Phase 5: Table pour historique de rotation Amazon Credentials
CREATE TABLE IF NOT EXISTS amazon_credential_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID REFERENCES amazon_credentials(id) ON DELETE CASCADE,
  rotation_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'manual_required')),
  error_message TEXT,
  rotated_by TEXT NOT NULL,
  new_expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE amazon_credential_rotations ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view rotation history
CREATE POLICY "Super admins can view rotation history"
ON amazon_credential_rotations
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Policy: System can insert rotation records
CREATE POLICY "System can insert rotation records"
ON amazon_credential_rotations
FOR INSERT
WITH CHECK (true);

-- Cron job pour rotation automatique tous les 7 jours
SELECT cron.schedule(
  'auto-rotate-amazon-credentials',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url:='https://ayjdtstugbqoadgipzon.supabase.co/functions/v1/rotate-amazon-credentials',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5amR0c3R1Z2Jxb2FkZ2lwem9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI2MTMsImV4cCI6MjA3NDgxODYxM30.vW7ptyCHwC01IMPaprVFj9bSLEGbQK8xrcPNDrJ0h8I"}'::jsonb,
    body:='{"auto": true}'::jsonb
  ) as request_id;
  $$
);

-- Enable realtime for user_alerts table (Phase 4)
ALTER PUBLICATION supabase_realtime ADD TABLE user_alerts;