-- Phase 2: Encrypt passwords with pgcrypto

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create functions to encrypt/decrypt passwords using JWT secret
CREATE OR REPLACE FUNCTION public.encrypt_email_password(plain_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(
      plain_password,
      current_setting('app.jwt_secret', true)
    ),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_email_password(encrypted_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_password, 'base64'),
    current_setting('app.jwt_secret', true)
  );
END;
$$;

-- Add index for better performance on email_poll_logs
CREATE INDEX IF NOT EXISTS idx_email_poll_logs_status ON public.email_poll_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_inbox_status ON public.email_inbox(status);

-- Add table for detailed IMAP session logs (for monitoring)
CREATE TABLE IF NOT EXISTS public.imap_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  commands_sent JSONB DEFAULT '[]'::jsonb,
  server_responses JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies for imap_session_logs
ALTER TABLE public.imap_session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own IMAP session logs"
  ON public.imap_session_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert IMAP session logs"
  ON public.imap_session_logs
  FOR INSERT
  WITH CHECK (true);

-- Index for session logs
CREATE INDEX idx_imap_session_logs_supplier ON public.imap_session_logs(supplier_id, session_start DESC);