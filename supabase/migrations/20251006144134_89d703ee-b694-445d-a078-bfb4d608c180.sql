-- Create table for Amazon edge function logs
CREATE TABLE IF NOT EXISTS public.amazon_edge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_message TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_amazon_edge_logs_created_at ON public.amazon_edge_logs(created_at DESC);
CREATE INDEX idx_amazon_edge_logs_function_name ON public.amazon_edge_logs(function_name);
CREATE INDEX idx_amazon_edge_logs_level ON public.amazon_edge_logs(level);

-- Enable RLS
ALTER TABLE public.amazon_edge_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all logs
CREATE POLICY "Super admins can view all Amazon logs"
  ON public.amazon_edge_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- System can insert logs
CREATE POLICY "System can insert Amazon logs"
  ON public.amazon_edge_logs
  FOR INSERT
  WITH CHECK (true);

-- Add trigger for automatic cleanup (keep logs for 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_amazon_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.amazon_edge_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;