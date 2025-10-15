-- Phase 2: Security - Table for encrypted email credentials
CREATE TABLE IF NOT EXISTS public.supplier_email_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supplier_id)
);

-- Enable RLS
ALTER TABLE public.supplier_email_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage credentials for their own suppliers
CREATE POLICY "Users can manage their supplier credentials"
ON public.supplier_email_credentials
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_configurations
    WHERE supplier_configurations.id = supplier_email_credentials.supplier_id
    AND supplier_configurations.user_id = auth.uid()
  )
);

-- Phase 3: Monitoring - Table for email polling logs
CREATE TABLE IF NOT EXISTS public.email_poll_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  poll_time TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('success', 'auth_failed', 'connection_error', 'no_new_emails', 'processing_error')),
  emails_found INT DEFAULT 0,
  emails_processed INT DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_poll_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own poll logs
CREATE POLICY "Users can view their own poll logs"
ON public.email_poll_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: System can insert poll logs
CREATE POLICY "System can insert poll logs"
ON public.email_poll_logs
FOR INSERT
WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_email_poll_logs_supplier_time ON public.email_poll_logs(supplier_id, poll_time DESC);
CREATE INDEX IF NOT EXISTS idx_email_poll_logs_user_time ON public.email_poll_logs(user_id, poll_time DESC);