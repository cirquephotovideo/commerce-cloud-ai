-- Create ai_request_logs table for monitoring AI provider requests
CREATE TABLE IF NOT EXISTS public.ai_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('lovable', 'ollama_cloud', 'ollama_local')),
  model text,
  prompt_type text,
  success boolean NOT NULL,
  latency_ms integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_ai_logs_user_date ON public.ai_request_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_logs_provider ON public.ai_request_logs(provider, success);
CREATE INDEX idx_ai_logs_created ON public.ai_request_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_request_logs
CREATE POLICY "Users can view their own AI logs"
  ON public.ai_request_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all AI logs"
  ON public.ai_request_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can insert AI logs"
  ON public.ai_request_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create ai_provider_health table for monitoring provider status
CREATE TABLE IF NOT EXISTS public.ai_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE CHECK (provider IN ('lovable', 'ollama_cloud', 'ollama_local')),
  status text NOT NULL CHECK (status IN ('online', 'offline', 'degraded')),
  response_time_ms integer,
  last_check timestamptz DEFAULT now(),
  error_details jsonb,
  available_models jsonb DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_provider_health
CREATE POLICY "Everyone can view provider health"
  ON public.ai_provider_health
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can update provider health"
  ON public.ai_provider_health
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert initial health records
INSERT INTO public.ai_provider_health (provider, status)
VALUES 
  ('lovable', 'online'),
  ('ollama_cloud', 'offline'),
  ('ollama_local', 'offline')
ON CONFLICT (provider) DO NOTHING;