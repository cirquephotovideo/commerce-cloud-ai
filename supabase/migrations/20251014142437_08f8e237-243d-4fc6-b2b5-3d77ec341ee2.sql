-- Add auto-sync and auto-linking fields to supplier_configurations
ALTER TABLE public.supplier_configurations
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_frequency TEXT DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS auto_link_by_ean BOOLEAN DEFAULT false;

-- Create supplier_webhook_logs table for webhook tracking
CREATE TABLE IF NOT EXISTS public.supplier_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on supplier_webhook_logs
ALTER TABLE public.supplier_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own webhook logs
CREATE POLICY "Users can view their own webhook logs"
  ON public.supplier_webhook_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert webhook logs
CREATE POLICY "System can insert webhook logs"
  ON public.supplier_webhook_logs
  FOR INSERT
  WITH CHECK (true);

-- Add index for faster webhook log queries
CREATE INDEX IF NOT EXISTS idx_supplier_webhook_logs_supplier_id 
  ON public.supplier_webhook_logs(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_webhook_logs_user_id 
  ON public.supplier_webhook_logs(user_id);
